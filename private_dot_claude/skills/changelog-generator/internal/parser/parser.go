package parser

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

// Version represents a parsed changelog version block.
type Version struct {
	Number       string
	Date         string
	Content      []string
	IsPreRelease bool
	Features     []Entry
	Fixes        []Entry
	Chores       []Entry
}

// Entry represents a single changelog entry with metadata.
type Entry struct {
	Level       string
	Issue       string
	PR          string
	PRLink      string
	Description string
	Details     string
	Date        string
	Author      string
}

// Commit represents a single parsed git log commit.
type Commit struct {
	Hash    string
	Date    time.Time
	Subject string
	Author  string
	Email   string
	Refs    string
}

var (
	// Matches: `# Version X.Y.Z - DATE`, `## [X.Y.Z] - DATE`, `# X.Y.Z - DATE`
	versionHeaderRe = regexp.MustCompile(`^#+ (?:Version )?\[?(\d+\.\d+\.\d+(?:-[\w.]+)?)\]? ?-? ?(\d{4}-\d{2}-\d{2})?`)

	// Pre-release suffix: -alpha, -beta, -rc.1, -dev, etc.
	preReleaseSuffixRe = regexp.MustCompile(`-(?:alpha|beta|rc|dev|pre|snapshot)(?:\.\d+)?$`)

	// Issue reference: #123
	issueRe = regexp.MustCompile(`#(\d+)`)

	// PR link: full GitHub PR URL
	prLinkRe = regexp.MustCompile(`https?://[^\s)]+/pull/(\d+)`)

	// Bold level marker: **Feat**, **Fix**, **Chore**, etc.
	levelRe = regexp.MustCompile(`\*\*([A-Za-z]+)\*\*`)

	// Author @mention
	authorRe = regexp.MustCompile(`@([\w-]+)`)

	// Blockquote date in entry details
	entryDateRe = regexp.MustCompile(`(\d{4}-\d{2}-\d{2})`)

	// Git log separator used with --format
	gitLogSeparator = "---COMMIT---"

	// Git log field separator
	gitLogFieldSep = "\x1f"
)

// IsPreRelease determines if a version string is pre-release.
// Returns true for: 0.x.y (major == 0), or versions with -alpha/-beta/-rc/-dev suffix.
func IsPreRelease(version string) bool {
	if version == "" {
		return false
	}
	parts := strings.SplitN(version, ".", 3)
	if len(parts) >= 1 && parts[0] == "0" {
		return true
	}
	return preReleaseSuffixRe.MatchString(version)
}

// ExtractPRNumber extracts the PR number from a commit subject line.
// Handles formats: (#123), #123, /pull/123
func ExtractPRNumber(subject string) string {
	// Prefer explicit "(#NNN)" style
	parenRe := regexp.MustCompile(`\(#(\d+)\)`)
	if m := parenRe.FindStringSubmatch(subject); len(m) > 1 {
		return m[1]
	}
	// Fall back to PR link URL
	if m := prLinkRe.FindStringSubmatch(subject); len(m) > 1 {
		return m[1]
	}
	// Bare #NNN
	if m := issueRe.FindStringSubmatch(subject); len(m) > 1 {
		return m[1]
	}
	return ""
}

// ParseChangelog reads a CHANGELOG.md file and returns structured versions.
func ParseChangelog(filename string) ([]Version, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("parser: open changelog %q: %w", filename, err)
	}
	defer f.Close()

	var versions []Version
	var current *Version

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()

		if m := versionHeaderRe.FindStringSubmatch(line); len(m) > 1 {
			if current != nil {
				categorizeEntries(current)
				versions = append(versions, *current)
			}
			number := m[1]
			date := ""
			if len(m) > 2 {
				date = m[2]
			}
			current = &Version{
				Number:       number,
				Date:         date,
				IsPreRelease: IsPreRelease(number),
			}
			continue
		}

		if current != nil {
			current.Content = append(current.Content, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("parser: scan changelog %q: %w", filename, err)
	}

	if current != nil {
		categorizeEntries(current)
		versions = append(versions, *current)
	}

	return versions, nil
}

// categorizeEntries parses Content lines into Features, Fixes, and Chores.
func categorizeEntries(v *Version) {
	var currentEntry *Entry

	for i, line := range v.Content {
		trimmed := strings.TrimSpace(line)

		// List item: starts with - or *
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			if currentEntry != nil {
				bucket(v, currentEntry)
			}
			text := trimmed[2:]
			currentEntry = parseEntry(text)
			continue
		}

		// Blockquote detail line
		if strings.HasPrefix(trimmed, ">") && currentEntry != nil {
			detail := strings.TrimSpace(strings.TrimPrefix(trimmed, ">"))
			if currentEntry.Details != "" {
				currentEntry.Details += " " + detail
			} else {
				currentEntry.Details = detail
			}
			// Extract date from detail if not set
			if currentEntry.Date == "" {
				if m := entryDateRe.FindString(detail); m != "" {
					currentEntry.Date = m
				}
			}
			// Extract author from detail if not set
			if currentEntry.Author == "" {
				if m := authorRe.FindStringSubmatch(detail); len(m) > 1 {
					currentEntry.Author = m[1]
				}
			}
			_ = i
			continue
		}

		// Flush on blank line or section header
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			if currentEntry != nil {
				bucket(v, currentEntry)
				currentEntry = nil
			}
		}
	}

	if currentEntry != nil {
		bucket(v, currentEntry)
	}
}

// parseEntry parses a single changelog list item text into an Entry.
func parseEntry(text string) *Entry {
	e := &Entry{}

	// Extract level from bold marker
	if m := levelRe.FindStringSubmatch(text); len(m) > 1 {
		e.Level = m[1]
		text = strings.Replace(text, m[0], "", 1)
	}

	// Extract PR link
	if m := prLinkRe.FindStringSubmatch(text); len(m) > 1 {
		e.PRLink = m[0]
		e.PR = m[1]
		text = strings.Replace(text, m[0], "", 1)
	}

	// Extract issue number (skip if same as PR)
	issues := issueRe.FindAllStringSubmatch(text, -1)
	for _, m := range issues {
		if m[1] != e.PR {
			e.Issue = m[1]
			break
		}
	}

	// Extract @author
	if m := authorRe.FindStringSubmatch(text); len(m) > 1 {
		e.Author = m[1]
		text = strings.Replace(text, m[0], "", 1)
	}

	// Clean up description
	e.Description = cleanDescription(text)

	// Infer level from description keywords if not set
	if e.Level == "" {
		e.Level = inferLevel(e.Description)
	}

	return e
}

// cleanDescription strips markdown punctuation and trims the description.
func cleanDescription(s string) string {
	// Remove parenthetical PR refs like (#123)
	parenRef := regexp.MustCompile(`\(#\d+\)`)
	s = parenRef.ReplaceAllString(s, "")
	// Remove bare #NNN refs when preceded by space
	s = regexp.MustCompile(`\s+#\d+`).ReplaceAllString(s, "")
	// Collapse multiple spaces
	s = regexp.MustCompile(`\s{2,}`).ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

// inferLevel guesses an entry level from common commit-message keywords.
func inferLevel(desc string) string {
	lower := strings.ToLower(desc)
	switch {
	case strings.HasPrefix(lower, "fix") || strings.HasPrefix(lower, "hotfix") || strings.HasPrefix(lower, "bug"):
		return "Fix"
	case strings.HasPrefix(lower, "feat") || strings.HasPrefix(lower, "add") || strings.HasPrefix(lower, "new"):
		return "Feat"
	case strings.HasPrefix(lower, "refactor") || strings.HasPrefix(lower, "rename") || strings.HasPrefix(lower, "move"):
		return "Refactor"
	case strings.HasPrefix(lower, "chore") || strings.HasPrefix(lower, "bump") || strings.HasPrefix(lower, "update dep"):
		return "Chore"
	case strings.HasPrefix(lower, "doc") || strings.HasPrefix(lower, "readme"):
		return "Docs"
	case strings.HasPrefix(lower, "test"):
		return "Test"
	case strings.HasPrefix(lower, "perf") || strings.HasPrefix(lower, "optim"):
		return "Perf"
	case strings.HasPrefix(lower, "ci") || strings.HasPrefix(lower, "build"):
		return "CI"
	}
	return "Chore"
}

// bucket places an entry into the correct Version slice.
func bucket(v *Version, e *Entry) {
	switch strings.ToLower(e.Level) {
	case "feat", "feature", "add", "new":
		v.Features = append(v.Features, *e)
	case "fix", "hotfix", "bugfix":
		v.Fixes = append(v.Fixes, *e)
	default:
		v.Chores = append(v.Chores, *e)
	}
}

// ParseGitLog reads a git log file and returns structured commits.
//
// Expected format produced by:
//
//	git log --pretty=format:"---COMMIT---%n%H%x1f%ad%x1f%s%x1f%an%x1f%ae%x1f%D" --date=iso
func ParseGitLog(filename string) ([]Commit, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("parser: open git log %q: %w", filename, err)
	}
	defer f.Close()

	var commits []Commit
	var block strings.Builder
	inBlock := false

	flush := func() error {
		raw := strings.TrimSpace(block.String())
		block.Reset()
		if raw == "" {
			return nil
		}
		c, err := parseCommitBlock(raw)
		if err != nil {
			return err
		}
		commits = append(commits, c)
		return nil
	}

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if line == gitLogSeparator {
			if inBlock {
				if err := flush(); err != nil {
					return nil, err
				}
			}
			inBlock = true
			continue
		}
		if inBlock {
			block.WriteString(line)
			block.WriteByte('\n')
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("parser: scan git log %q: %w", filename, err)
	}

	if inBlock {
		if err := flush(); err != nil {
			return nil, err
		}
	}

	return commits, nil
}

// parseCommitBlock parses a single commit block into a Commit struct.
// Expected content: HASH\x1fDATE\x1fSUBJECT\x1fAUTHOR\x1fEMAIL\x1fREFS
func parseCommitBlock(raw string) (Commit, error) {
	// The block may be a single line with \x1f separators, or the line itself.
	line := strings.TrimSpace(raw)
	fields := strings.SplitN(line, gitLogFieldSep, 6)

	var c Commit
	if len(fields) < 1 {
		return c, fmt.Errorf("parser: empty commit block")
	}

	if len(fields) > 0 {
		c.Hash = strings.TrimSpace(fields[0])
	}
	if len(fields) > 1 {
		raw := strings.TrimSpace(fields[1])
		t, err := parseGitDate(raw)
		if err == nil {
			c.Date = t
		}
	}
	if len(fields) > 2 {
		c.Subject = strings.TrimSpace(fields[2])
	}
	if len(fields) > 3 {
		c.Author = strings.TrimSpace(fields[3])
	}
	if len(fields) > 4 {
		c.Email = strings.TrimSpace(fields[4])
	}
	if len(fields) > 5 {
		c.Refs = strings.TrimSpace(fields[5])
	}

	return c, nil
}

// parseGitDate parses git's iso date format: "2024-01-15 10:30:00 +0000"
// or RFC3339: "2024-01-15T10:30:00Z"
func parseGitDate(raw string) (time.Time, error) {
	formats := []string{
		"2006-01-02 15:04:05 -0700",
		"2006-01-02 15:04:05 +0000",
		"2006-01-02T15:04:05Z07:00",
		time.RFC3339,
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, raw); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("parser: unrecognized date format %q", raw)
}
