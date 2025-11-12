package calendar

import (
	"encoding/json"
	"os"
	"time"

	"github.com/rickar/cal/v2"
	"github.com/rickar/cal/v2/fr"
)

// Exclusions represents working days exclusions configuration
type Exclusions struct {
	Country       string       `json:"country"`
	CourseWeeks   []DateRange  `json:"course_weeks"`
	CustomHolidays []CustomHoliday `json:"custom_holidays"`
}

// DateRange represents a date range
type DateRange struct {
	Start       string `json:"start"`
	End         string `json:"end"`
	Description string `json:"description"`
}

// CustomHoliday represents a custom holiday
type CustomHoliday struct {
	Date        string `json:"date"`
	Description string `json:"description"`
}

// Calculator calculates working days with exclusions
type Calculator struct {
	calendar    *cal.BusinessCalendar
	courseWeeks []dateRange
}

type dateRange struct {
	Start time.Time
	End   time.Time
}

// NewCalculator creates a new working days calculator
func NewCalculator(exclusionsPath string) (*Calculator, error) {
	// Load exclusions config
	exclusions, err := loadExclusions(exclusionsPath)
	if err != nil {
		return nil, err
	}

	// Create business calendar
	businessCal := cal.NewBusinessCalendar()

	// Add French holidays if country is FR
	if exclusions.Country == "FR" {
		businessCal.AddHoliday(fr.Holidays...)
	}

	// Add custom holidays
	for _, holiday := range exclusions.CustomHolidays {
		date, err := time.Parse("2006-01-02", holiday.Date)
		if err != nil {
			continue
		}
		businessCal.AddHoliday(&cal.Holiday{
			Name:  holiday.Description,
			Type:  cal.ObservancePublic,
			Month: date.Month(),
			Day:   date.Day(),
			Func:  cal.CalcDayOfMonth,
		})
	}

	// Parse course weeks
	courseWeeks := make([]dateRange, 0, len(exclusions.CourseWeeks))
	for _, week := range exclusions.CourseWeeks {
		start, err := time.Parse("2006-01-02", week.Start)
		if err != nil {
			continue
		}
		end, err := time.Parse("2006-01-02", week.End)
		if err != nil {
			continue
		}
		courseWeeks = append(courseWeeks, dateRange{Start: start, End: end})
	}

	return &Calculator{
		calendar:    businessCal,
		courseWeeks: courseWeeks,
	}, nil
}

// loadExclusions loads exclusions from JSON file
func loadExclusions(path string) (*Exclusions, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var exclusions Exclusions
	if err := json.Unmarshal(data, &exclusions); err != nil {
		return nil, err
	}

	return &exclusions, nil
}

// CountWorkingDays counts working days between two dates
func (c *Calculator) CountWorkingDays(start, end time.Time) int {
	if start.After(end) {
		return 0
	}

	count := 0
	current := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	endDate := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)

	for !current.After(endDate) {
		if c.IsWorkingDay(current) {
			count++
		}
		current = current.AddDate(0, 0, 1)
	}

	return count
}

// IsWorkingDay checks if a date is a working day
func (c *Calculator) IsWorkingDay(date time.Time) bool {
	// Normalize to UTC date
	normalized := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)

	// Check if weekend
	if !c.calendar.IsWorkday(normalized) {
		return false
	}

	// Check if in a course week
	for _, week := range c.courseWeeks {
		if !normalized.Before(week.Start) && !normalized.After(week.End) {
			return false
		}
	}

	return true
}

// GetWorkingDates returns all working dates between two dates
func (c *Calculator) GetWorkingDates(start, end time.Time) []time.Time {
	if start.After(end) {
		return []time.Time{}
	}

	dates := make([]time.Time, 0)
	current := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	endDate := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)

	for !current.After(endDate) {
		if c.IsWorkingDay(current) {
			dates = append(dates, current)
		}
		current = current.AddDate(0, 0, 1)
	}

	return dates
}

// GetExcludedDates returns all excluded dates between two dates
func (c *Calculator) GetExcludedDates(start, end time.Time) map[string][]time.Time {
	if start.After(end) {
		return map[string][]time.Time{}
	}

	weekends := make([]time.Time, 0)
	holidays := make([]time.Time, 0)
	courseWeeks := make([]time.Time, 0)

	current := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	endDate := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)

	for !current.After(endDate) {
		if !c.IsWorkingDay(current) {
			// Determine exclusion reason
			if c.isWeekend(current) {
				weekends = append(weekends, current)
			} else if c.isHoliday(current) {
				holidays = append(holidays, current)
			} else if c.isCourseWeek(current) {
				courseWeeks = append(courseWeeks, current)
			}
		}
		current = current.AddDate(0, 0, 1)
	}

	return map[string][]time.Time{
		"weekends":     weekends,
		"holidays":     holidays,
		"course_weeks": courseWeeks,
	}
}

// isWeekend checks if date is weekend
func (c *Calculator) isWeekend(date time.Time) bool {
	weekday := date.Weekday()
	return weekday == time.Saturday || weekday == time.Sunday
}

// isHoliday checks if date is a holiday
func (c *Calculator) isHoliday(date time.Time) bool {
	return !c.calendar.IsWorkday(date) && !c.isWeekend(date)
}

// isCourseWeek checks if date is in a course week
func (c *Calculator) isCourseWeek(date time.Time) bool {
	for _, week := range c.courseWeeks {
		if !date.Before(week.Start) && !date.After(week.End) {
			return true
		}
	}
	return false
}

// CalculateMetrics calculates comprehensive metrics for a date range
func (c *Calculator) CalculateMetrics(start, end time.Time, commitDates []time.Time) *Metrics {
	calendarDays := int(end.Sub(start).Hours()/24) + 1
	totalWorkingDays := c.CountWorkingDays(start, end)

	// Count unique working days with commits
	uniqueDates := make(map[string]bool)
	for _, commitDate := range commitDates {
		if c.IsWorkingDay(commitDate) {
			dateKey := commitDate.Format("2006-01-02")
			uniqueDates[dateKey] = true
		}
	}

	workingDaysWithCommits := len(uniqueDates)
	efficiency := 0.0
	if totalWorkingDays > 0 {
		efficiency = float64(workingDaysWithCommits) / float64(totalWorkingDays) * 100
	}

	avgCommitsPerDay := 0.0
	if workingDaysWithCommits > 0 {
		avgCommitsPerDay = float64(len(commitDates)) / float64(workingDaysWithCommits)
	}

	excluded := c.GetExcludedDates(start, end)

	return &Metrics{
		CalendarDays:           calendarDays,
		TotalWorkingDays:       totalWorkingDays,
		WorkingDaysWithCommits: workingDaysWithCommits,
		Efficiency:             efficiency,
		AverageCommitsPerDay:   avgCommitsPerDay,
		ExcludedDays: ExcludedDays{
			Weekends:    len(excluded["weekends"]),
			Holidays:    len(excluded["holidays"]),
			CourseWeeks: len(excluded["course_weeks"]),
			Total:       len(excluded["weekends"]) + len(excluded["holidays"]) + len(excluded["course_weeks"]),
		},
	}
}

// Metrics represents working days metrics
type Metrics struct {
	CalendarDays           int
	TotalWorkingDays       int
	WorkingDaysWithCommits int
	Efficiency             float64
	AverageCommitsPerDay   float64
	ExcludedDays           ExcludedDays
}

// ExcludedDays represents excluded days breakdown
type ExcludedDays struct {
	Weekends    int
	Holidays    int
	CourseWeeks int
	Total       int
}
