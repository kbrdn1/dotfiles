// Package calendar provides working day calculation with support for
// public holidays, configurable course week exclusions, and multiple countries.
package calendar

import (
	"fmt"
	"time"
)

// Config holds calculator configuration.
type Config struct {
	// Country code for public holiday rules. Defaults to "FR" if empty.
	Country string
	// CourseWeeks are date ranges excluded from working day counts (e.g. school course periods).
	CourseWeeks []DateRange
	// CustomHolidays are additional holidays appended to the country's standard list.
	CustomHolidays []time.Time
}

// DateRange represents an inclusive start/end period.
type DateRange struct {
	Start time.Time
	End   time.Time
}

// Metrics holds the result of a working day calculation.
type Metrics struct {
	CalendarDays   int     // total days in the period (inclusive)
	WorkingDays    int     // calendar days minus weekends, holidays, and course weeks
	ExcludedDays   int     // weekends + holidays + course week days (may overlap; counted once)
	WeekendDays    int     // days falling on Saturday or Sunday
	HolidayDays    int     // public/custom holidays on weekdays not already in course weeks
	CourseWeekDays int     // weekdays falling within a course week range
	UniqueWorkDays int     // days with at least one commit
	CommitCount    int     // total number of commits supplied
	Efficiency     float64 // commits per working day (0 if WorkingDays == 0)
	Period         string  // formatted as "DD/MM/YYYY - DD/MM/YYYY"
}

// Calculator computes working day metrics for a configured country and exclusion rules.
type Calculator struct {
	cfg Config
}

// NewCalculator creates a Calculator with the given Config.
// If Config.Country is empty it defaults to "FR".
func NewCalculator(cfg Config) *Calculator {
	if cfg.Country == "" {
		cfg.Country = "FR"
	}
	return &Calculator{cfg: cfg}
}

// Calculate computes Metrics for the period [start, end] (inclusive).
// commitDates is an optional list of commit timestamps used to populate
// UniqueWorkDays, CommitCount, and Efficiency.
func (c *Calculator) Calculate(start, end time.Time, commitDates []time.Time) Metrics {
	start = truncateToDay(start)
	end = truncateToDay(end)

	// Collect all holidays across every year spanned by the period.
	holidaySet := c.buildHolidaySet(start, end)

	var (
		calendarDays   int
		weekendDays    int
		holidayDays    int
		courseWeekDays int
		workingDays    int
	)

	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		calendarDays++

		weekend := isWeekend(d)
		holiday := isHoliday(d, holidaySet)
		course := c.isCourseWeek(d)

		switch {
		case weekend:
			weekendDays++
		case course:
			// Weekday within a course week: excluded from working days.
			courseWeekDays++
			// A holiday that also falls in a course week is counted only once (courseWeek wins).
		case holiday:
			holidayDays++
		default:
			workingDays++
		}
	}

	excludedDays := weekendDays + holidayDays + courseWeekDays

	// Commit metrics.
	commitCount := len(commitDates)
	uniqueWorkDays := countUniqueWorkDays(commitDates, holidaySet, c)

	var efficiency float64
	if workingDays > 0 {
		efficiency = float64(commitCount) / float64(workingDays)
	}

	return Metrics{
		CalendarDays:   calendarDays,
		WorkingDays:    workingDays,
		ExcludedDays:   excludedDays,
		WeekendDays:    weekendDays,
		HolidayDays:    holidayDays,
		CourseWeekDays: courseWeekDays,
		UniqueWorkDays: uniqueWorkDays,
		CommitCount:    commitCount,
		Efficiency:     efficiency,
		Period:         fmt.Sprintf("%s - %s", start.Format("02/01/2006"), end.Format("02/01/2006")),
	}
}

// IsWorkingDay reports whether t is a working day under the calculator's config.
func (c *Calculator) IsWorkingDay(t time.Time) bool {
	t = truncateToDay(t)
	holidaySet := c.buildHolidaySet(t, t)
	return !isWeekend(t) && !isHoliday(t, holidaySet) && !c.isCourseWeek(t)
}

// ── internal helpers ──────────────────────────────────────────────────────────

// truncateToDay strips hours/minutes/seconds from t, preserving its location.
func truncateToDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

// isWeekend reports whether t falls on a Saturday or Sunday.
func isWeekend(t time.Time) bool {
	w := t.Weekday()
	return w == time.Saturday || w == time.Sunday
}

// isHoliday reports whether day t is present in the prebuilt holiday set.
func isHoliday(t time.Time, set map[time.Time]struct{}) bool {
	_, ok := set[truncateToDay(t)]
	return ok
}

// isCourseWeek reports whether t falls within any configured CourseWeek range.
func (c *Calculator) isCourseWeek(t time.Time) bool {
	t = truncateToDay(t)
	for _, r := range c.cfg.CourseWeeks {
		start := truncateToDay(r.Start)
		end := truncateToDay(r.End)
		if !t.Before(start) && !t.After(end) {
			return true
		}
	}
	return false
}

// buildHolidaySet collects all holidays for every year in [start, end] into a
// fast lookup map keyed by truncated day.
func (c *Calculator) buildHolidaySet(start, end time.Time) map[time.Time]struct{} {
	set := make(map[time.Time]struct{})

	for year := start.Year(); year <= end.Year(); year++ {
		var holidays []time.Time
		switch c.cfg.Country {
		case "FR":
			holidays = getFrenchHolidays(year)
		default:
			// Unknown country: fall back to no standard holidays.
		}
		for _, h := range holidays {
			set[truncateToDay(h)] = struct{}{}
		}
	}

	// Append custom holidays regardless of country.
	for _, h := range c.cfg.CustomHolidays {
		set[truncateToDay(h)] = struct{}{}
	}

	return set
}

// countUniqueWorkDays counts distinct calendar days (not weekends/holidays/course weeks)
// that appear in commitDates.
func countUniqueWorkDays(commitDates []time.Time, holidaySet map[time.Time]struct{}, c *Calculator) int {
	seen := make(map[time.Time]struct{}, len(commitDates))
	for _, cd := range commitDates {
		d := truncateToDay(cd)
		if isWeekend(d) || isHoliday(d, holidaySet) || c.isCourseWeek(d) {
			continue
		}
		seen[d] = struct{}{}
	}
	return len(seen)
}

// ── French public holidays ────────────────────────────────────────────────────

// getFrenchHolidays returns the 11 French public holidays (jours fériés) for year.
// Eight are fixed dates; three are computed from Easter Sunday.
func getFrenchHolidays(year int) []time.Time {
	easter := calculateEaster(year)

	fixed := []time.Time{
		time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC),   // Jour de l'An
		time.Date(year, time.May, 1, 0, 0, 0, 0, time.UTC),       // Fête du Travail
		time.Date(year, time.May, 8, 0, 0, 0, 0, time.UTC),       // Victoire 1945
		time.Date(year, time.July, 14, 0, 0, 0, 0, time.UTC),     // Fête Nationale
		time.Date(year, time.August, 15, 0, 0, 0, 0, time.UTC),   // Assomption
		time.Date(year, time.November, 1, 0, 0, 0, 0, time.UTC),  // Toussaint
		time.Date(year, time.November, 11, 0, 0, 0, 0, time.UTC), // Armistice
		time.Date(year, time.December, 25, 0, 0, 0, 0, time.UTC), // Noël
	}

	// Easter-relative holidays.
	easterRelative := []time.Time{
		easter.AddDate(0, 0, 1),  // Lundi de Pâques (+1)
		easter.AddDate(0, 0, 39), // Ascension (+39)
		easter.AddDate(0, 0, 50), // Lundi de Pentecôte (+50)
	}

	return append(fixed, easterRelative...)
}

// calculateEaster computes Easter Sunday for the given year using the
// anonymous Gregorian computus algorithm.
func calculateEaster(year int) time.Time {
	a := year % 19
	b := year / 100
	c := year % 100
	d := b / 4
	e := b % 4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i := c / 4
	k := c % 4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := ((h + l - 7*m + 114) % 31) + 1
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
}
