package generator

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"text/template"
	"time"

	"github.com/kbrdn1/changelog-generator/internal/calendar"
	"github.com/kbrdn1/changelog-generator/internal/consolidator"
	"github.com/kbrdn1/changelog-generator/internal/git"
)

// TemplateData holds data for template rendering
type TemplateData struct {
	Version         string
	PreviousVersion string
	Date            string
	Features        []*consolidator.Feature
	FeaturesByType  map[string][]*consolidator.Feature
	Breaking        []*consolidator.Feature
	Metrics         *calendar.Metrics
	Config          *Config

	// Helper data
	TotalCommits  int
	TotalAuthors  int
	Authors       []string
	PRNumbers     []int
}

// Config holds generator configuration
type Config struct {
	// Paths
	TemplateDir string
	OutputDir   string
	ClientSubdir string

	// Metadata toggles
	IncludePRs         bool
	IncludeIssues      bool
	IncludeContributors bool
	IncludeMetrics     struct {
		WorkingDays bool
		Efficiency  bool
		LOCChanges  bool
	}

	// Commit type mappings
	TypeLabels map[string]string
	TypeEmojis map[string]string

	// Repository configuration
	GithubOrg  string
	GithubRepo string
}

// Engine handles template rendering
type Engine struct {
	config *Config
}

// NewEngine creates a new template engine
func NewEngine(config *Config) *Engine {
	return &Engine{config: config}
}

// PrepareData prepares template data from commits and features
func (e *Engine) PrepareData(
	version string,
	commits []*git.Commit,
	features []*consolidator.Feature,
	metrics *calendar.Metrics,
) *TemplateData {
	// Calculate previous version (decrement patch version)
	previousVersion := calculatePreviousVersion(version)

	data := &TemplateData{
		Version:         version,
		PreviousVersion: previousVersion,
		Date:            time.Now().Format("2006-01-02"),
		Features:        features,
		FeaturesByType:  consolidator.GetFeaturesByType(features),
		Breaking:        consolidator.GetBreakingFeatures(features),
		Metrics:         metrics,
		Config:          e.config,
		TotalCommits:    len(commits),
	}

	// Collect unique authors
	authorMap := make(map[string]bool)
	for _, commit := range commits {
		authorMap[commit.Author] = true
	}
	data.Authors = make([]string, 0, len(authorMap))
	for author := range authorMap {
		data.Authors = append(data.Authors, author)
	}
	data.TotalAuthors = len(data.Authors)

	// Collect unique PR numbers
	prMap := make(map[int]bool)
	for _, commit := range commits {
		for _, pr := range commit.PRNumbers {
			prMap[pr] = true
		}
	}
	data.PRNumbers = make([]int, 0, len(prMap))
	for pr := range prMap {
		data.PRNumbers = append(data.PRNumbers, pr)
	}

	return data
}

// calculatePreviousVersion calculates the previous version by decrementing patch
func calculatePreviousVersion(version string) string {
	// Remove 'v' prefix if present
	v := version
	if len(v) > 0 && v[0] == 'v' {
		v = v[1:]
	}

	// Try to parse version and decrement patch
	var major, minor, patch int
	if n, _ := fmt.Sscanf(v, "%d.%d.%d", &major, &minor, &patch); n == 3 {
		if patch > 0 {
			return fmt.Sprintf("v%d.%d.%d", major, minor, patch-1)
		} else if minor > 0 {
			return fmt.Sprintf("v%d.%d.0", major, minor-1)
		} else if major > 0 {
			return fmt.Sprintf("v%d.0.0", major-1)
		}
	}

	// Fallback: return v0.0.0 or main
	return "main"
}

// RenderTemplate renders a template file with data
func (e *Engine) RenderTemplate(templateName string, data *TemplateData) (string, error) {
	templatePath := filepath.Join(e.config.TemplateDir, templateName)

	// Read template file
	tmplContent, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template %s: %w", templateName, err)
	}

	// Parse template with custom functions
	tmpl, err := template.New(templateName).Funcs(e.templateFuncs()).Parse(string(tmplContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse template %s: %w", templateName, err)
	}

	// Execute template
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template %s: %w", templateName, err)
	}

	return buf.String(), nil
}

// WriteOutput writes rendered content to output file
func (e *Engine) WriteOutput(outputPath, content string) error {
	// Create output directory if it doesn't exist
	dir := filepath.Dir(outputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Write file
	if err := os.WriteFile(outputPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write output file: %w", err)
	}

	return nil
}

// templateFuncs returns custom template functions
func (e *Engine) templateFuncs() template.FuncMap {
	return template.FuncMap{
		"typeLabel": func(commitType string) string {
			if label, ok := e.config.TypeLabels[commitType]; ok {
				return label
			}
			return commitType
		},
		"typeEmoji": func(commitType string) string {
			if emoji, ok := e.config.TypeEmojis[commitType]; ok {
				return emoji
			}
			return ""
		},
		"formatDate": func(t time.Time) string {
			return t.Format("02/01/2006") // DD/MM/YYYY format
		},
		"formatPRLink": func(pr int) string {
			if e.config.GithubOrg != "" && e.config.GithubRepo != "" {
				return fmt.Sprintf("([#%d](https://github.com/%s/%s/pull/%d))", pr, e.config.GithubOrg, e.config.GithubRepo, pr)
			}
			return fmt.Sprintf("#%d", pr)
		},
		"formatDuration": func(days int) string {
			if days == 1 {
				return "1 jour"
			}
			return fmt.Sprintf("%d jours", days)
		},
		"formatEfficiency": func(efficiency float64) string {
			return fmt.Sprintf("%.1f%%", efficiency)
		},
		"formatFloat": func(f float64) string {
			return fmt.Sprintf("%.2f", f)
		},
		"join": func(items []string, sep string) string {
			result := ""
			for i, item := range items {
				if i > 0 {
					result += sep
				}
				result += item
			}
			return result
		},
		"hasFeatures": func(features []*consolidator.Feature) bool {
			return len(features) > 0
		},
		"sub": func(a, b int) int {
			return a - b
		},
	}
}
