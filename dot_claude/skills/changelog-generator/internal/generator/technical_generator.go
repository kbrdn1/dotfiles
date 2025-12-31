package generator

import (
	"fmt"
	"path/filepath"

	"github.com/kbrdn1/changelog-generator/internal/calendar"
	"github.com/kbrdn1/changelog-generator/internal/consolidator"
	"github.com/kbrdn1/changelog-generator/internal/git"
)

// TechnicalGenerator generates technical changelogs
type TechnicalGenerator struct {
	engine *Engine
}

// NewTechnicalGenerator creates a new technical generator
func NewTechnicalGenerator(config *Config) *TechnicalGenerator {
	return &TechnicalGenerator{
		engine: NewEngine(config),
	}
}

// Generate creates a technical changelog
func (g *TechnicalGenerator) Generate(
	version string,
	commits []*git.Commit,
	features []*consolidator.Feature,
	metrics *calendar.Metrics,
) (string, error) {
	// Prepare data
	data := g.engine.PrepareData(version, commits, features, metrics)

	// Render template
	content, err := g.engine.RenderTemplate("technical.tmpl", data)
	if err != nil {
		return "", fmt.Errorf("failed to render technical template: %w", err)
	}

	// Write output
	outputPath := filepath.Join(
		g.engine.config.OutputDir,
		fmt.Sprintf("%s_technical.md", version),
	)

	if err := g.engine.WriteOutput(outputPath, content); err != nil {
		return "", fmt.Errorf("failed to write technical changelog: %w", err)
	}

	return outputPath, nil
}
