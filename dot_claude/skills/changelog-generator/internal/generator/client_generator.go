package generator

import (
	"fmt"
	"path/filepath"

	"github.com/kbrdn1/changelog-generator/internal/calendar"
	"github.com/kbrdn1/changelog-generator/internal/consolidator"
	"github.com/kbrdn1/changelog-generator/internal/git"
)

// ClientGenerator generates client-friendly changelogs
type ClientGenerator struct {
	engine *Engine
}

// NewClientGenerator creates a new client generator
func NewClientGenerator(config *Config) *ClientGenerator {
	return &ClientGenerator{
		engine: NewEngine(config),
	}
}

// Generate creates a client-friendly changelog
func (g *ClientGenerator) Generate(
	version string,
	commits []*git.Commit,
	features []*consolidator.Feature,
	metrics *calendar.Metrics,
) (string, error) {
	// Prepare data
	data := g.engine.PrepareData(version, commits, features, metrics)

	// Render template
	content, err := g.engine.RenderTemplate("client.tmpl", data)
	if err != nil {
		return "", fmt.Errorf("failed to render client template: %w", err)
	}

	// Write output
	outputPath := filepath.Join(
		g.engine.config.OutputDir,
		g.engine.config.ClientSubdir,
		fmt.Sprintf("%s_client.md", version),
	)

	if err := g.engine.WriteOutput(outputPath, content); err != nil {
		return "", fmt.Errorf("failed to write client changelog: %w", err)
	}

	return outputPath, nil
}
