package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/flippad/changelog-generator/internal/calendar"
	"github.com/flippad/changelog-generator/internal/parser"
	"github.com/flippad/changelog-generator/internal/splitter"
)

const (
	green  = "\033[0;32m"
	yellow = "\033[0;33m"
	red    = "\033[0;31m"
	blue   = "\033[0;34m"
	bold   = "\033[1m"
	reset  = "\033[0m"
)

type Config struct {
	Subcommand  string
	Version     string
	Base        string
	Compare     string
	Limit       int
	ConfigFile  string
	OutputDir   string
	Format      string
	ProjectRoot string
	Changelog   string
	Clean       bool
}

func main() {
	cfg, err := parseArgs()
	if err != nil {
		fatalf("%v", err)
	}
	if err := run(cfg); err != nil {
		fatalf("%v", err)
	}
}

func parseArgs() (*Config, error) {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	sub := os.Args[1]
	if sub == "-h" || sub == "--help" || sub == "help" {
		printUsage()
		os.Exit(0)
	}

	fs := flag.NewFlagSet("changelog-generator", flag.ExitOnError)
	version := fs.String("version", "", "Version tag (e.g. v1.2.3)")
	base := fs.String("base", "main", "Base branch")
	compare := fs.String("compare", "dev", "Compare branch")
	limit := fs.Int("limit", 400, "Max git log entries")
	configFile := fs.String("config", "changelog.config.json", "Config file path")
	outputDir := fs.String("output-dir", "./changelogs", "Output directory")
	format := fs.String("format", "both", "Format: client, technical, both")
	changelog := fs.String("changelog", "CHANGELOG.md", "Path to main CHANGELOG.md")
	clean := fs.Bool("clean", false, "Remove orphaned changelog files")

	if err := fs.Parse(os.Args[2:]); err != nil {
		return nil, err
	}

	projectRoot, _ := findProjectRoot()
	if projectRoot == "" {
		projectRoot = "."
	}

	valid := map[string]bool{
		"extract": true, "split": true, "metrics": true, "generate": true,
	}
	if !valid[sub] {
		return nil, fmt.Errorf("unknown subcommand %q -- run 'changelog-generator help'", sub)
	}

	return &Config{
		Subcommand:  sub,
		Version:     *version,
		Base:        *base,
		Compare:     *compare,
		Limit:       *limit,
		ConfigFile:  *configFile,
		OutputDir:   *outputDir,
		Format:      *format,
		ProjectRoot: projectRoot,
		Changelog:   *changelog,
		Clean:       *clean,
	}, nil
}

func run(cfg *Config) error {
	switch cfg.Subcommand {
	case "extract":
		return runExtract(cfg)
	case "split":
		return runSplit(cfg)
	case "metrics":
		return runMetrics(cfg)
	case "generate":
		return runGenerate(cfg)
	}
	return nil
}

// -- extract: git log to file ------------------------------------------------

func runExtract(cfg *Config) error {
	infof("extracting git log: %s..%s (limit: %d)", cfg.Base, cfg.Compare, cfg.Limit)

	outFile := filepath.Join(cfg.ProjectRoot, "git-log.txt")
	format := "---COMMIT---%n%H\x1f%ad\x1f%s\x1f%an\x1f%ae\x1f%D"
	args := []string{
		"log", fmt.Sprintf("%s..%s", cfg.Base, cfg.Compare),
		"--pretty=format:" + format,
		"--date=iso",
		fmt.Sprintf("-n%d", cfg.Limit),
	}

	cmd := exec.Command("git", args...)
	cmd.Dir = cfg.ProjectRoot
	out, err := cmd.Output()
	if err != nil {
		// fallback: log all commits on compare branch
		args = []string{
			"log", cfg.Compare,
			"--pretty=format:" + format,
			"--date=iso",
			fmt.Sprintf("-n%d", cfg.Limit),
		}
		cmd = exec.Command("git", args...)
		cmd.Dir = cfg.ProjectRoot
		out, err = cmd.Output()
		if err != nil {
			return fmt.Errorf("git log failed: %w", err)
		}
	}

	if err := os.WriteFile(outFile, out, 0o644); err != nil {
		return fmt.Errorf("write git-log.txt: %w", err)
	}

	successf("git log extracted to %s (%d bytes)", outFile, len(out))
	return nil
}

// -- split: CHANGELOG.md -> individual files ---------------------------------

func runSplit(cfg *Config) error {
	changelogPath := resolveChangelog(cfg)
	infof("splitting %s into individual files...", changelogPath)

	versions, err := parser.ParseChangelog(changelogPath)
	if err != nil {
		return fmt.Errorf("parse changelog: %w", err)
	}

	infof("found %d versions", len(versions))

	result, err := splitter.Split(versions, splitter.Config{
		OutputDir:     cfg.OutputDir,
		PreReleaseDir: "pre-releases",
		ClientDir:     "client",
		CleanOrphans:  cfg.Clean,
	})
	if err != nil {
		return fmt.Errorf("split: %w", err)
	}

	successf("done: %d created, %d updated, %d unchanged",
		len(result.Created), len(result.Updated), len(result.Unchanged))

	for _, f := range result.Created {
		fmt.Printf("  %s+%s %s\n", green, reset, f)
	}
	for _, f := range result.Updated {
		fmt.Printf("  %s~%s %s\n", yellow, reset, f)
	}
	for _, f := range result.Orphaned {
		fmt.Printf("  %s-%s %s (removed)\n", red, reset, f)
	}

	return nil
}

// -- metrics: working days calculation ---------------------------------------

func runMetrics(cfg *Config) error {
	changelogPath := resolveChangelog(cfg)
	infof("calculating metrics from %s...", changelogPath)

	versions, err := parser.ParseChangelog(changelogPath)
	if err != nil {
		return fmt.Errorf("parse changelog: %w", err)
	}

	// load commit dates from git
	gitLogPath := filepath.Join(cfg.ProjectRoot, "git-log.txt")
	commits, _ := parser.ParseGitLog(gitLogPath) // ok if missing

	// load config for exclusions
	calCfg := loadCalendarConfig(cfg)
	calc := calendar.NewCalculator(calCfg)

	type versionMetrics struct {
		Version string          `json:"version"`
		Metrics calendar.Metrics `json:"metrics"`
	}

	var results []versionMetrics

	for _, v := range versions {
		// find commits related to this version (by date range heuristic)
		var commitDates []time.Time
		for _, c := range commits {
			commitDates = append(commitDates, c.Date)
		}

		if v.Date == "" {
			continue
		}

		releaseDate, err := time.Parse("2006-01-02", v.Date)
		if err != nil {
			continue
		}

		// estimate start: 30 days before release or previous version date
		start := releaseDate.AddDate(0, 0, -30)
		m := calc.Calculate(start, releaseDate, commitDates)

		results = append(results, versionMetrics{
			Version: v.Number,
			Metrics: m,
		})

		fmt.Printf("\n%sv%s%s\n", bold, v.Number, reset)
		fmt.Printf("  period:       %s\n", m.Period)
		fmt.Printf("  calendar:     %d days\n", m.CalendarDays)
		fmt.Printf("  working:      %d days\n", m.WorkingDays)
		fmt.Printf("  excluded:     %d (weekends: %d, holidays: %d, course: %d)\n",
			m.ExcludedDays, m.WeekendDays, m.HolidayDays, m.CourseWeekDays)
		if m.CommitCount > 0 {
			fmt.Printf("  commits:      %d\n", m.CommitCount)
			fmt.Printf("  efficiency:   %.1f commits/day\n", m.Efficiency)
		}
	}

	// write JSON report
	reportPath := filepath.Join(cfg.ProjectRoot, "working_days_report.json")
	data, _ := json.MarshalIndent(results, "", "  ")
	if err := os.WriteFile(reportPath, data, 0o644); err != nil {
		return fmt.Errorf("write report: %w", err)
	}

	successf("report saved to %s", reportPath)
	return nil
}

// -- generate: full pipeline -------------------------------------------------

func runGenerate(cfg *Config) error {
	if cfg.Version == "" {
		return fmt.Errorf("--version is required for generate")
	}

	fmt.Printf("\n%s%schangelog-generator%s — version %s\n\n", bold, blue, reset, cfg.Version)

	// step 1: extract
	infof("[1/3] extracting git log...")
	if err := runExtract(cfg); err != nil {
		warnf("extract failed (continuing): %v", err)
	}

	// step 2: prompt context (print instructions for the user)
	infof("[2/3] changelog redaction...")
	changelogPath := resolveChangelog(cfg)
	fmt.Printf("\n  the git log has been extracted. to generate the changelog content:\n\n")
	fmt.Printf("  %soption a%s: run the Claude command:\n", bold, reset)
	fmt.Printf("    /generate_changelog\n\n")
	fmt.Printf("  %soption b%s: edit %s manually with the git-log.txt as reference\n\n", bold, reset, changelogPath)
	fmt.Printf("  once CHANGELOG.md is updated, run:\n")
	fmt.Printf("    changelog-generator split --output-dir %s\n\n", cfg.OutputDir)

	// step 3: split (if changelog exists and has content)
	infof("[3/3] splitting existing changelog...")
	if err := runSplit(cfg); err != nil {
		warnf("split: %v", err)
	}

	successf("pipeline complete for %s", cfg.Version)
	return nil
}

// -- helpers -----------------------------------------------------------------

func resolveChangelog(cfg *Config) string {
	if filepath.IsAbs(cfg.Changelog) {
		return cfg.Changelog
	}
	return filepath.Join(cfg.ProjectRoot, cfg.Changelog)
}

func loadCalendarConfig(cfg *Config) calendar.Config {
	calCfg := calendar.Config{Country: "FR"}

	configPath := filepath.Join(cfg.ProjectRoot, cfg.ConfigFile)
	data, err := os.ReadFile(configPath)
	if err != nil {
		return calCfg
	}

	var raw struct {
		Country    string `json:"country"`
		CourseWeeks []struct {
			Start string `json:"start"`
			End   string `json:"end"`
		} `json:"course_weeks"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return calCfg
	}

	if raw.Country != "" {
		calCfg.Country = raw.Country
	}

	for _, w := range raw.CourseWeeks {
		start, err1 := time.Parse("2006-01-02", w.Start)
		end, err2 := time.Parse("2006-01-02", w.End)
		if err1 == nil && err2 == nil {
			calCfg.CourseWeeks = append(calCfg.CourseWeeks, calendar.DateRange{Start: start, End: end})
		}
	}

	return calCfg
}

func findProjectRoot() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func printUsage() {
	fmt.Printf(`%s%schangelog-generator%s -- generate structured changelogs from git history

%ssubcommands%s
  extract    extract git log to git-log.txt
  split      split CHANGELOG.md into individual version files
  metrics    calculate working days and productivity metrics
  generate   full pipeline: extract + prompt + split

%sflags%s
  --version      version tag (e.g. v1.2.3)         [required for generate]
  --base         base branch                        (default: main)
  --compare      compare branch                     (default: dev)
  --limit        max git log entries                 (default: 400)
  --changelog    path to CHANGELOG.md               (default: CHANGELOG.md)
  --output-dir   output directory                    (default: ./changelogs)
  --config       config file for exclusions          (default: changelog.config.json)
  --format       output format: client|technical|both (default: both)
  --clean        remove orphaned changelog files

%sexamples%s
  changelog-generator generate --version v2.1.0
  changelog-generator extract --base main --compare dev --limit 200
  changelog-generator split --output-dir ./releases --clean
  changelog-generator metrics --changelog CHANGELOG.md

`, bold, blue, reset, bold, reset, bold, reset, bold, reset)
}

func infof(format string, args ...any) {
	fmt.Printf("%s->%s %s\n", blue, reset, fmt.Sprintf(format, args...))
}

func successf(format string, args ...any) {
	fmt.Printf("%s ok%s %s\n", green, reset, fmt.Sprintf(format, args...))
}

func warnf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "%s warn%s %s\n", yellow, reset, fmt.Sprintf(format, args...))
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "%s error%s %s\n", red, reset, fmt.Sprintf(format, args...))
	os.Exit(1)
}
