package git

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Commit represents a Git commit with parsed metadata
type Commit struct {
	Hash         string
	ShortHash    string
	Date         time.Time
	Author       string
	AuthorEmail  string
	Subject      string
	Body         string
	Type         string   // feat, fix, chore, etc.
	Scope        string   // optional scope from conventional commits
	Breaking     bool     // BREAKING CHANGE detected
	PRNumbers    []int    // Pull request numbers
	IssueNumbers []int    // Issue numbers
	Raw          string   // Raw commit message
}

// CommitType categorizes commits
type CommitType string

const (
	TypeFeat     CommitType = "feat"
	TypeFix      CommitType = "fix"
	TypeHotfix   CommitType = "hotfix"
	TypeChore    CommitType = "chore"
	TypeRefactor CommitType = "refactor"
	TypeDocs     CommitType = "docs"
	TypeStyle    CommitType = "style"
	TypeTest     CommitType = "test"
	TypeCI       CommitType = "ci"
	TypePerf     CommitType = "perf"
	TypeRevert   CommitType = "revert"
	TypeUnknown  CommitType = "unknown"
)

var (
	// Conventional Commits pattern: type(scope)?: subject
	conventionalPattern = regexp.MustCompile(`^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$`)

	// Emoji-prefixed commits: 🎉 feat: subject
	emojiPattern = regexp.MustCompile(`^[\p{So}\p{Sk}]+\s+([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$`)

	// PR/Issue patterns
	prPattern    = regexp.MustCompile(`#(\d+)`)
	issuePattern = regexp.MustCompile(`(?:fix|close|resolve)(?:s|d)?\s+#(\d+)`)

	// Breaking change patterns
	breakingPattern = regexp.MustCompile(`(?i)BREAKING\s+CHANGE`)
)

// ParseCommit parses a commit and extracts structured metadata
func ParseCommit(hash, date, author, email, subject, body string) (*Commit, error) {
	parsedDate, err := time.Parse("2006-01-02 15:04:05 -0700", date)
	if err != nil {
		return nil, err
	}

	commit := &Commit{
		Hash:        hash,
		ShortHash:   hash[:8],
		Date:        parsedDate,
		Author:      author,
		AuthorEmail: email,
		Subject:     subject,
		Body:        body,
		Raw:         subject + "\n" + body,
		Type:        string(TypeUnknown),
	}

	// Try parsing as Conventional Commit
	if parseConventionalCommit(commit, subject) {
		// Successfully parsed
	} else if parseEmojiCommit(commit, subject) {
		// Successfully parsed emoji format
	} else {
		// Fallback: guess type from keywords
		guessCommitType(commit, subject)
	}

	// Extract PR and Issue numbers
	commit.PRNumbers = extractNumbers(prPattern, subject+" "+body)
	commit.IssueNumbers = extractNumbers(issuePattern, subject+" "+body)

	// Detect breaking changes
	commit.Breaking = breakingPattern.MatchString(subject + " " + body)

	return commit, nil
}

// parseConventionalCommit tries to parse as Conventional Commit
func parseConventionalCommit(commit *Commit, subject string) bool {
	matches := conventionalPattern.FindStringSubmatch(subject)
	if len(matches) == 0 {
		return false
	}

	commit.Type = strings.ToLower(matches[1])
	commit.Scope = matches[2]
	commit.Breaking = matches[3] == "!"
	commit.Subject = strings.TrimSpace(matches[4])

	return true
}

// parseEmojiCommit tries to parse emoji-prefixed commits
func parseEmojiCommit(commit *Commit, subject string) bool {
	matches := emojiPattern.FindStringSubmatch(subject)
	if len(matches) == 0 {
		return false
	}

	commit.Type = strings.ToLower(matches[1])
	commit.Scope = matches[2]
	commit.Breaking = matches[3] == "!"
	commit.Subject = strings.TrimSpace(matches[4])

	return true
}

// guessCommitType attempts to guess commit type from keywords
func guessCommitType(commit *Commit, subject string) {
	lower := strings.ToLower(subject)

	// Check for type at the beginning of the subject (even without colon)
	switch {
	case strings.HasPrefix(lower, "feat") || strings.Contains(lower, "feat:") || strings.Contains(lower, "feature"):
		commit.Type = string(TypeFeat)
	case strings.HasPrefix(lower, "hotfix") || strings.Contains(lower, "hotfix:"):
		commit.Type = string(TypeHotfix)
	case strings.HasPrefix(lower, "fix") || strings.Contains(lower, "fix:"):
		commit.Type = string(TypeFix)
	case strings.HasPrefix(lower, "chore") || strings.Contains(lower, "chore:"):
		commit.Type = string(TypeChore)
	case strings.HasPrefix(lower, "refactor") || strings.Contains(lower, "refactor:"):
		commit.Type = string(TypeRefactor)
	case strings.HasPrefix(lower, "docs") || strings.HasPrefix(lower, "doc") || strings.Contains(lower, "docs:") || strings.Contains(lower, "doc:"):
		commit.Type = string(TypeDocs)
	case strings.HasPrefix(lower, "style") || strings.Contains(lower, "style:"):
		commit.Type = string(TypeStyle)
	case strings.HasPrefix(lower, "test") || strings.Contains(lower, "test:"):
		commit.Type = string(TypeTest)
	case strings.HasPrefix(lower, "ci") || strings.Contains(lower, "ci:"):
		commit.Type = string(TypeCI)
	case strings.HasPrefix(lower, "perf") || strings.Contains(lower, "perf:"):
		commit.Type = string(TypePerf)
	case strings.HasPrefix(lower, "revert") || strings.Contains(lower, "revert:"):
		commit.Type = string(TypeRevert)
	default:
		// Try to infer from content
		switch {
		case strings.Contains(lower, "add") || strings.Contains(lower, "implement"):
			commit.Type = string(TypeFeat)
		case strings.Contains(lower, "fix") || strings.Contains(lower, "correct"):
			commit.Type = string(TypeFix)
		case strings.Contains(lower, "update") || strings.Contains(lower, "improve"):
			commit.Type = string(TypeChore)
		case strings.Contains(lower, "refactor") || strings.Contains(lower, "clean"):
			commit.Type = string(TypeRefactor)
		case strings.Contains(lower, "doc") || strings.Contains(lower, "readme"):
			commit.Type = string(TypeDocs)
		default:
			commit.Type = string(TypeUnknown)
		}
	}

	// Extract scope if present (even in non-conventional format)
	if idx := strings.Index(lower, "("); idx != -1 {
		if endIdx := strings.Index(lower[idx:], ")"); endIdx != -1 {
			commit.Scope = strings.TrimSpace(lower[idx+1 : idx+endIdx])
		}
	}
}

// extractNumbers extracts all numbers matching a pattern
func extractNumbers(pattern *regexp.Regexp, text string) []int {
	matches := pattern.FindAllStringSubmatch(text, -1)
	numbers := make([]int, 0, len(matches))
	seen := make(map[int]bool)

	for _, match := range matches {
		if len(match) > 1 {
			if num, err := strconv.Atoi(match[1]); err == nil && !seen[num] {
				numbers = append(numbers, num)
				seen[num] = true
			}
		}
	}

	return numbers
}

// IsFeat returns true if commit is a feature
func (c *Commit) IsFeat() bool {
	return c.Type == string(TypeFeat)
}

// IsFix returns true if commit is a fix or hotfix
func (c *Commit) IsFix() bool {
	return c.Type == string(TypeFix) || c.Type == string(TypeHotfix)
}

// IsChore returns true if commit is chore-related
func (c *Commit) IsChore() bool {
	return c.Type == string(TypeChore) || c.Type == string(TypeCI)
}

// IsRefactor returns true if commit is a refactor
func (c *Commit) IsRefactor() bool {
	return c.Type == string(TypeRefactor)
}

// IsDocs returns true if commit is documentation
func (c *Commit) IsDocs() bool {
	return c.Type == string(TypeDocs)
}

// IsPerf returns true if commit is performance-related
func (c *Commit) IsPerf() bool {
	return c.Type == string(TypePerf)
}
