package splitter

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/flippad/changelog-generator/internal/parser"
)

// Config holds options for the Split operation.
type Config struct {
	OutputDir     string // default: "./changelogs"
	PreReleaseDir string // default: "pre-releases"
	ClientDir     string // default: "client"
	CleanOrphans  bool   // remove files not in changelog
}

// Result reports what happened during a Split call.
type Result struct {
	Created   []string // files created
	Updated   []string // files updated (content changed)
	Unchanged []string // files that didn't change
	Orphaned  []string // files removed (if CleanOrphans)
	Total     int
}

func (r *Result) computeTotal() {
	r.Total = len(r.Created) + len(r.Updated) + len(r.Unchanged)
}

// Split generates individual changelog files from parsed versions.
func Split(versions []parser.Version, cfg Config) (Result, error) {
	cfg = applyDefaults(cfg)

	if err := ensureDirs(cfg); err != nil {
		return Result{}, fmt.Errorf("splitter: create directories: %w", err)
	}

	var res Result
	written := make(map[string]struct{}, len(versions))

	for _, v := range versions {
		path, content := resolveFile(v, cfg)
		written[path] = struct{}{}

		status, err := writeIfChanged(path, content)
		if err != nil {
			return res, fmt.Errorf("splitter: write %s: %w", path, err)
		}

		switch status {
		case statusCreated:
			res.Created = append(res.Created, path)
		case statusUpdated:
			res.Updated = append(res.Updated, path)
		case statusUnchanged:
			res.Unchanged = append(res.Unchanged, path)
		}
	}

	if cfg.CleanOrphans {
		orphans, err := findOrphans(cfg, written)
		if err != nil {
			return res, fmt.Errorf("splitter: find orphans: %w", err)
		}
		for _, o := range orphans {
			if err := os.Remove(o); err != nil && !os.IsNotExist(err) {
				return res, fmt.Errorf("splitter: remove orphan %s: %w", o, err)
			}
			res.Orphaned = append(res.Orphaned, o)
		}
	}

	res.computeTotal()
	return res, nil
}

// applyDefaults fills in zero-value Config fields.
func applyDefaults(cfg Config) Config {
	if cfg.OutputDir == "" {
		cfg.OutputDir = "./changelogs"
	}
	if cfg.PreReleaseDir == "" {
		cfg.PreReleaseDir = "pre-releases"
	}
	if cfg.ClientDir == "" {
		cfg.ClientDir = "client"
	}
	return cfg
}

// ensureDirs creates the base, pre-release, and client directories.
func ensureDirs(cfg Config) error {
	dirs := []string{
		cfg.OutputDir,
		filepath.Join(cfg.OutputDir, cfg.PreReleaseDir),
		filepath.Join(cfg.OutputDir, cfg.ClientDir),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
	}
	return nil
}

// resolveFile returns the output path and rendered markdown for a version.
func resolveFile(v parser.Version, cfg Config) (string, string) {
	dir := cfg.OutputDir
	if v.IsPreRelease {
		dir = filepath.Join(cfg.OutputDir, cfg.PreReleaseDir)
	}
	filename := sanitizeFilename(v.Number) + ".md"
	path := filepath.Join(dir, filename)
	return path, renderVersion(v)
}

// renderVersion produces markdown content for a version entry.
func renderVersion(v parser.Version) string {
	var sb strings.Builder

	header := "# Version " + v.Number
	if v.Date != "" {
		header += " - " + v.Date
	}
	sb.WriteString(header + "\n\n")

	if len(v.Features) > 0 {
		sb.WriteString("## Features\n\n")
		for _, e := range v.Features {
			sb.WriteString(renderEntry(e))
		}
		sb.WriteByte('\n')
	}

	if len(v.Fixes) > 0 {
		sb.WriteString("## Bug Fixes\n\n")
		for _, e := range v.Fixes {
			sb.WriteString(renderEntry(e))
		}
		sb.WriteByte('\n')
	}

	if len(v.Chores) > 0 {
		sb.WriteString("## Chores\n\n")
		for _, e := range v.Chores {
			sb.WriteString(renderEntry(e))
		}
		sb.WriteByte('\n')
	}

	// Fall back to raw content when entries were not categorized.
	if len(v.Features) == 0 && len(v.Fixes) == 0 && len(v.Chores) == 0 {
		for _, line := range v.Content {
			sb.WriteString(line)
			sb.WriteByte('\n')
		}
	}

	return sb.String()
}

// renderEntry formats a single Entry as a markdown list item.
func renderEntry(e parser.Entry) string {
	var sb strings.Builder
	sb.WriteString("- ")
	if e.Level != "" {
		sb.WriteString("**" + e.Level + "**: ")
	}
	sb.WriteString(e.Description)
	if e.Issue != "" {
		sb.WriteString(fmt.Sprintf(" (#%s)", e.Issue))
	}
	if e.PRLink != "" {
		sb.WriteString(fmt.Sprintf(" ([PR #%s](%s))", e.PR, e.PRLink))
	} else if e.PR != "" {
		sb.WriteString(fmt.Sprintf(" (#%s)", e.PR))
	}
	if e.Author != "" {
		sb.WriteString(" @" + e.Author)
	}
	sb.WriteByte('\n')
	if e.Details != "" {
		sb.WriteString("  > " + e.Details + "\n")
	}
	return sb.String()
}

// writeStatus represents the outcome of a single file write attempt.
type writeStatus int

const (
	statusCreated   writeStatus = iota
	statusUpdated
	statusUnchanged
)

// writeIfChanged writes content to path only when it differs from what is
// already on disk (compared by SHA-256 hash). Returns the outcome status.
func writeIfChanged(path, content string) (writeStatus, error) {
	newHash := sha256Hash(content)

	existing, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return 0, err
	}

	if err == nil {
		if sha256Hash(string(existing)) == newHash {
			return statusUnchanged, nil
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return 0, err
		}
		return statusUpdated, nil
	}

	// File did not exist — create it.
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return 0, err
	}
	return statusCreated, nil
}

// sha256Hash returns the hex-encoded SHA-256 digest of s.
func sha256Hash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", sum)
}

// sanitizeFilename converts a version number into a safe filename component.
// e.g. "1.2.3-beta.1" → "1.2.3-beta.1" (strips only path separators).
func sanitizeFilename(version string) string {
	return strings.ReplaceAll(version, "/", "_")
}

// findOrphans returns markdown files inside the output directories that are
// not present in the written set.
func findOrphans(cfg Config, written map[string]struct{}) ([]string, error) {
	searchDirs := []string{
		cfg.OutputDir,
		filepath.Join(cfg.OutputDir, cfg.PreReleaseDir),
		filepath.Join(cfg.OutputDir, cfg.ClientDir),
	}

	var orphans []string
	seen := make(map[string]struct{})

	for _, dir := range searchDirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
				continue
			}
			path := filepath.Join(dir, e.Name())
			if _, exists := seen[path]; exists {
				continue
			}
			seen[path] = struct{}{}
			if _, ok := written[path]; !ok {
				orphans = append(orphans, path)
			}
		}
	}
	return orphans, nil
}
