package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/kbrdn1/changelog-generator/internal/calendar"
	"github.com/kbrdn1/changelog-generator/internal/consolidator"
	"github.com/kbrdn1/changelog-generator/internal/generator"
	"github.com/kbrdn1/changelog-generator/internal/git"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// Configuration structure
type Config struct {
	Branches struct {
		DefaultBase    string `mapstructure:"default_base"`
		DefaultCompare string `mapstructure:"default_compare"`
	}
	Output struct {
		Dir          string `mapstructure:"dir"`
		ClientSubdir string `mapstructure:"client_subdir"`
	}
	Metadata struct {
		IncludePRs         bool `mapstructure:"include_prs"`
		IncludeIssues      bool `mapstructure:"include_issues"`
		IncludeContributors bool `mapstructure:"include_contributors"`
		IncludeMetrics     struct {
			WorkingDays bool `mapstructure:"working_days"`
			Efficiency  bool `mapstructure:"efficiency"`
			LOCChanges  bool `mapstructure:"loc_changes"`
		} `mapstructure:"include_metrics"`
	}
	Consolidation struct {
		Enabled            bool `mapstructure:"enabled"`
		TimeThresholdDays  int  `mapstructure:"time_threshold_days"`
		ScopeMatching      bool `mapstructure:"scope_matching"`
	}
	GitHub struct {
		Enabled      bool   `mapstructure:"enabled"`
		TokenEnvVar  string `mapstructure:"token_env_var"`
		Organization string `mapstructure:"organization"`
		Repository   string `mapstructure:"repository"`
	}
}

var (
	cfgFile string
	config  Config
	rootCmd = &cobra.Command{
		Use:   "changelog-generator",
		Short: "Generate intelligent changelogs from Git history",
		Long: `Changelog Generator analyzes Git history to produce comprehensive,
dual-format changelogs (client-accessible and technical) with working days
calculation, feature consolidation, and GitHub enrichment.`,
	}

	generateCmd = &cobra.Command{
		Use:   "generate",
		Short: "Generate changelog for a version",
		Long:  `Generate dual-format changelogs from Git history between branches or tags.`,
		RunE:  generateChangelog,
	}

	calculateCmd = &cobra.Command{
		Use:   "calculate",
		Short: "Calculate working days only",
		Long:  `Calculate working days between dates or tags without generating changelog.`,
		RunE:  calculateWorkingDays,
	}

	validateCmd = &cobra.Command{
		Use:   "validate",
		Short: "Validate configuration files",
		Long:  `Validate all configuration files and check Git repository state.`,
		RunE:  validateConfig,
	}
)

func init() {
	cobra.OnInitialize(initConfig)

	// Global flags
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is ./config/changelog_config.json)")

	// Generate command flags
	generateCmd.Flags().String("version", "", "Version number (e.g., v0.38.0)")
	generateCmd.Flags().String("base", "", "Base branch (default from config)")
	generateCmd.Flags().String("compare", "", "Compare branch (default from config)")
	generateCmd.Flags().String("from-tag", "", "Start tag for range")
	generateCmd.Flags().String("to-tag", "", "End tag for range")
	generateCmd.Flags().String("format", "both", "Output format: client, technical, or both")
	generateCmd.MarkFlagRequired("version")

	// Calculate command flags
	calculateCmd.Flags().String("from-tag", "", "Start tag")
	calculateCmd.Flags().String("to-tag", "", "End tag")
	calculateCmd.Flags().String("from", "", "Start date (YYYY-MM-DD)")
	calculateCmd.Flags().String("to", "", "End date (YYYY-MM-DD)")
	calculateCmd.Flags().Bool("show-excluded-dates", false, "Show excluded dates")

	rootCmd.AddCommand(generateCmd, calculateCmd, validateCmd)
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		// Try local config first, then fall back to skill directory
		viper.AddConfigPath("./config")
		viper.AddConfigPath(filepath.Join(getSkillDir(), "config"))
		viper.SetConfigName("changelog_config")
		viper.SetConfigType("json")
	}

	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		log.Printf("Warning: Could not read config file: %v", err)
		log.Printf("Using default configuration")
		// Set defaults
		config.Branches.DefaultBase = "main"
		config.Branches.DefaultCompare = "dev"
		config.Output.Dir = "./changelogs"
		config.Output.ClientSubdir = "client"
		config.Consolidation.Enabled = true
		config.Consolidation.TimeThresholdDays = 3
		config.Consolidation.ScopeMatching = true
	} else {
		if err := viper.Unmarshal(&config); err != nil {
			log.Fatalf("Unable to decode config: %v", err)
		}
	}
}

func generateChangelog(cmd *cobra.Command, args []string) error {
	version, _ := cmd.Flags().GetString("version")
	base, _ := cmd.Flags().GetString("base")
	compare, _ := cmd.Flags().GetString("compare")
	fromTag, _ := cmd.Flags().GetString("from-tag")
	toTag, _ := cmd.Flags().GetString("to-tag")
	format, _ := cmd.Flags().GetString("format")

	// Use defaults from config if not specified
	if base == "" {
		base = config.Branches.DefaultBase
	}
	if compare == "" {
		compare = config.Branches.DefaultCompare
	}

	fmt.Println("🚀 Generating changelog...")
	fmt.Printf("   Version: %s\n", version)
	if fromTag != "" && toTag != "" {
		fmt.Printf("   Range: %s..%s\n", fromTag, toTag)
	} else {
		fmt.Printf("   Comparing: %s ↔ %s\n", base, compare)
	}
	fmt.Printf("   Format: %s\n", format)

	// Initialize Git parser
	gitParser := git.NewParser(".")

	// Fetch commits
	fmt.Println("   📝 Fetching commits...")
	var commits []*git.Commit
	var err error

	if fromTag != "" && toTag != "" {
		// Use tag range
		commits, err = gitParser.GetCommitsBetweenRefs(fromTag, toTag)
	} else {
		// Use branch comparison
		commits, err = gitParser.GetCommitsBetweenRefs(base, compare)
	}

	if err != nil {
		return fmt.Errorf("failed to fetch commits: %w", err)
	}

	if len(commits) == 0 {
		fmt.Println("   ⚠️  No commits found in the specified range")
		return nil
	}

	fmt.Printf("   ✅ Found %d commits\n", len(commits))

	// Initialize calendar calculator
	// Try local config first, fall back to skill directory
	exclusionsPath := filepath.Join("config", "exclusions.json")
	if _, err := os.Stat(exclusionsPath); os.IsNotExist(err) {
		exclusionsPath = filepath.Join(getSkillDir(), "config", "exclusions.json")
	}
	calCalculator, err := calendar.NewCalculator(exclusionsPath)
	if err != nil {
		return fmt.Errorf("failed to initialize calendar: %w", err)
	}

	// Calculate working days metrics
	fmt.Println("   📊 Calculating working days...")
	commitDates := make([]time.Time, len(commits))
	for i, commit := range commits {
		commitDates[i] = commit.Date
	}

	startDate := commits[len(commits)-1].Date // Oldest
	endDate := commits[0].Date                 // Newest
	metrics := calCalculator.CalculateMetrics(startDate, endDate, commitDates)

	fmt.Printf("   ✅ Calendar days: %d, Working days: %d\n", metrics.CalendarDays, metrics.TotalWorkingDays)

	// Consolidate features
	fmt.Println("   🔄 Consolidating features...")
	consolidatorConfig := &consolidator.Config{
		Enabled:           config.Consolidation.Enabled,
		TimeThresholdDays: config.Consolidation.TimeThresholdDays,
		ScopeMatching:     config.Consolidation.ScopeMatching,
	}
	featureConsolidator := consolidator.NewConsolidator(consolidatorConfig)
	features := featureConsolidator.GroupCommits(commits)

	fmt.Printf("   ✅ Grouped into %d features\n", len(features))

	// Prepare generator config
	genConfig := &generator.Config{
		TemplateDir:  filepath.Join(getSkillDir(), "templates"),
		OutputDir:    config.Output.Dir,
		ClientSubdir: config.Output.ClientSubdir,
		IncludePRs:   config.Metadata.IncludePRs,
		IncludeIssues: config.Metadata.IncludeIssues,
		IncludeContributors: config.Metadata.IncludeContributors,
		GithubOrg:    config.GitHub.Organization,
		GithubRepo:   config.GitHub.Repository,
	}
	genConfig.IncludeMetrics.WorkingDays = config.Metadata.IncludeMetrics.WorkingDays
	genConfig.IncludeMetrics.Efficiency = config.Metadata.IncludeMetrics.Efficiency
	genConfig.IncludeMetrics.LOCChanges = config.Metadata.IncludeMetrics.LOCChanges

	// Load type labels and emojis from config
	genConfig.TypeLabels = make(map[string]string)
	genConfig.TypeEmojis = make(map[string]string)

	// Generate changelogs
	var clientPath, technicalPath string

	if format == "both" || format == "client" {
		fmt.Println("   📄 Generating client changelog...")
		clientGen := generator.NewClientGenerator(genConfig)
		clientPath, err = clientGen.Generate(version, commits, features, metrics)
		if err != nil {
			return fmt.Errorf("failed to generate client changelog: %w", err)
		}
		fmt.Printf("   ✅ Client changelog: %s\n", clientPath)
	}

	if format == "both" || format == "technical" {
		fmt.Println("   📄 Generating technical changelog...")
		techGen := generator.NewTechnicalGenerator(genConfig)
		technicalPath, err = techGen.Generate(version, commits, features, metrics)
		if err != nil {
			return fmt.Errorf("failed to generate technical changelog: %w", err)
		}
		fmt.Printf("   ✅ Technical changelog: %s\n", technicalPath)
	}

	// Print summary
	fmt.Println("\n✅ Changelog generation completed!")
	result := map[string]interface{}{
		"status":  "success",
		"version": version,
		"files": map[string]string{
			"client":    clientPath,
			"technical": technicalPath,
		},
		"metrics": map[string]interface{}{
			"commits":                   len(commits),
			"features":                  len(features),
			"working_days":              metrics.TotalWorkingDays,
			"working_days_with_commits": metrics.WorkingDaysWithCommits,
			"calendar_days":             metrics.CalendarDays,
			"efficiency":                fmt.Sprintf("%.1f%%", metrics.Efficiency),
			"average_commits_per_day":   fmt.Sprintf("%.2f", metrics.AverageCommitsPerDay),
		},
	}

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))

	return nil
}

// getSkillDir returns the skill directory path
func getSkillDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "skills", "changelog-generator")
}

func calculateWorkingDays(cmd *cobra.Command, args []string) error {
	fromTag, _ := cmd.Flags().GetString("from-tag")
	toTag, _ := cmd.Flags().GetString("to-tag")
	fromDate, _ := cmd.Flags().GetString("from")
	toDate, _ := cmd.Flags().GetString("to")
	showExcluded, _ := cmd.Flags().GetBool("show-excluded-dates")

	fmt.Println("📊 Calculating working days...")

	if fromTag != "" && toTag != "" {
		fmt.Printf("   Between tags: %s..%s\n", fromTag, toTag)
	} else if fromDate != "" && toDate != "" {
		fmt.Printf("   Between dates: %s → %s\n", fromDate, toDate)
	}

	if showExcluded {
		fmt.Println("   Showing excluded dates")
	}

	// TODO: Implement actual calculation
	// Placeholder result
	result := map[string]interface{}{
		"calendar_days": 21,
		"working_days":  14,
		"excluded_days": 7,
		"exclusions": map[string]int{
			"weekends":     6,
			"holidays":     0,
			"course_weeks": 1,
		},
		"period": "2024-12-20 - 2025-01-10",
		"message": "Working days calculation not yet fully implemented.",
	}

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))

	return nil
}

func validateConfig(cmd *cobra.Command, args []string) error {
	fmt.Println("🔍 Validating configuration...")

	errors := []string{}

	// Check Git repository
	if _, err := os.Stat(".git"); os.IsNotExist(err) {
		errors = append(errors, "GIT001: Git repository not found")
	} else {
		fmt.Println("   ✅ Git repository found")
	}

	// Check config files
	configFiles := []string{
		"config/changelog_config.json",
		"config/exclusions.json",
		"config/translation_rules.json",
	}

	for _, file := range configFiles {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			errors = append(errors, fmt.Sprintf("CFG001: Configuration file missing: %s", file))
		} else {
			fmt.Printf("   ✅ %s found\n", file)
		}
	}

	// Check GitHub token if enabled
	if config.GitHub.Enabled {
		token := os.Getenv(config.GitHub.TokenEnvVar)
		if token == "" {
			errors = append(errors, fmt.Sprintf("GH001: GitHub token not found in environment variable %s", config.GitHub.TokenEnvVar))
		} else {
			fmt.Println("   ✅ GitHub token configured")
		}
	}

	// Check output directories
	if _, err := os.Stat(config.Output.Dir); os.IsNotExist(err) {
		fmt.Printf("   ⚠️  Output directory %s does not exist (will be created)\n", config.Output.Dir)
	}

	if len(errors) > 0 {
		fmt.Println("\n❌ Validation failed:")
		for _, err := range errors {
			fmt.Printf("   - %s\n", err)
		}
		return fmt.Errorf("validation failed with %d errors", len(errors))
	}

	fmt.Println("\n✅ All validations passed!")
	return nil
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
