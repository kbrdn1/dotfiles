package git

import (
	"fmt"
	"os/exec"
	"strings"
)

// Parser handles Git operations and commit parsing
type Parser struct {
	RepoPath string
}

// NewParser creates a new Git parser
func NewParser(repoPath string) *Parser {
	if repoPath == "" {
		repoPath = "."
	}
	return &Parser{RepoPath: repoPath}
}

// GetCommitsBetweenRefs gets all commits between two Git refs (branches, tags)
func (p *Parser) GetCommitsBetweenRefs(base, compare string) ([]*Commit, error) {
	// Format: hash|date|author|email|subject|body
	format := "%H|%ai|%an|%ae|%s|%b%x00"
	rangeSpec := fmt.Sprintf("%s..%s", base, compare)

	cmd := exec.Command("git", "-C", p.RepoPath, "log", rangeSpec, "--pretty=format:"+format)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w", err)
	}

	return p.parseCommits(string(output))
}

// GetCommitsBetweenDates gets commits between two dates
func (p *Parser) GetCommitsBetweenDates(startDate, endDate string) ([]*Commit, error) {
	format := "%H|%ai|%an|%ae|%s|%b%x00"

	cmd := exec.Command("git", "-C", p.RepoPath, "log",
		fmt.Sprintf("--since=%s", startDate),
		fmt.Sprintf("--until=%s", endDate),
		"--pretty=format:"+format)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w", err)
	}

	return p.parseCommits(string(output))
}

// GetAllCommits gets all commits in the repository
func (p *Parser) GetAllCommits() ([]*Commit, error) {
	format := "%H|%ai|%an|%ae|%s|%b%x00"

	cmd := exec.Command("git", "-C", p.RepoPath, "log", "--all", "--pretty=format:"+format)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w", err)
	}

	return p.parseCommits(string(output))
}

// parseCommits parses the output of git log
func (p *Parser) parseCommits(output string) ([]*Commit, error) {
	if output == "" {
		return []*Commit{}, nil
	}

	// Split by null character (commit separator)
	rawCommits := strings.Split(strings.TrimSpace(output), "\x00")
	commits := make([]*Commit, 0, len(rawCommits))

	for _, raw := range rawCommits {
		if raw == "" {
			continue
		}

		commit, err := p.parseCommit(raw)
		if err != nil {
			// Log error but continue processing
			fmt.Printf("Warning: failed to parse commit: %v\n", err)
			continue
		}

		commits = append(commits, commit)
	}

	return commits, nil
}

// parseCommit parses a single commit from git log output
func (p *Parser) parseCommit(raw string) (*Commit, error) {
	// Format: hash|date|author|email|subject|body
	parts := strings.SplitN(raw, "|", 6)
	if len(parts) < 5 {
		return nil, fmt.Errorf("invalid commit format: %s", raw)
	}

	hash := strings.TrimSpace(parts[0])
	date := strings.TrimSpace(parts[1])
	author := strings.TrimSpace(parts[2])
	email := strings.TrimSpace(parts[3])
	subject := strings.TrimSpace(parts[4])

	body := ""
	if len(parts) > 5 {
		body = strings.TrimSpace(parts[5])
	}

	return ParseCommit(hash, date, author, email, subject, body)
}

// BranchExists checks if a branch exists
func (p *Parser) BranchExists(branch string) bool {
	cmd := exec.Command("git", "-C", p.RepoPath, "rev-parse", "--verify", branch)
	err := cmd.Run()
	return err == nil
}

// GetCurrentBranch returns the current branch name
func (p *Parser) GetCurrentBranch() (string, error) {
	cmd := exec.Command("git", "-C", p.RepoPath, "rev-parse", "--abbrev-ref", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get current branch: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

// GetTags returns all tags in the repository
func (p *Parser) GetTags() ([]string, error) {
	cmd := exec.Command("git", "-C", p.RepoPath, "tag", "-l")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get tags: %w", err)
	}

	tags := strings.Split(strings.TrimSpace(string(output)), "\n")
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		if tag != "" {
			result = append(result, tag)
		}
	}

	return result, nil
}

// GetCommitStats returns statistics for a commit (files changed, lines added/removed)
func (p *Parser) GetCommitStats(hash string) (*CommitStats, error) {
	cmd := exec.Command("git", "-C", p.RepoPath, "show", "--stat", "--format=", hash)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get commit stats: %w", err)
	}

	return parseCommitStats(string(output)), nil
}

// CommitStats represents statistics for a commit
type CommitStats struct {
	FilesChanged int
	LinesAdded   int
	LinesRemoved int
}

// parseCommitStats parses git show --stat output
func parseCommitStats(output string) *CommitStats {
	stats := &CommitStats{}

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Look for the summary line: "X files changed, Y insertions(+), Z deletions(-)"
		if strings.Contains(line, "file") && strings.Contains(line, "changed") {
			// Parse files changed
			if strings.Contains(line, "files changed") {
				parts := strings.Split(line, " ")
				for i, part := range parts {
					if part == "files" && i > 0 {
						fmt.Sscanf(parts[i-1], "%d", &stats.FilesChanged)
						break
					}
					if part == "file" && i > 0 {
						stats.FilesChanged = 1
						break
					}
				}
			}

			// Parse insertions
			if strings.Contains(line, "insertion") {
				parts := strings.Split(line, ",")
				for _, part := range parts {
					if strings.Contains(part, "insertion") {
						fmt.Sscanf(strings.TrimSpace(part), "%d", &stats.LinesAdded)
						break
					}
				}
			}

			// Parse deletions
			if strings.Contains(line, "deletion") {
				parts := strings.Split(line, ",")
				for _, part := range parts {
					if strings.Contains(part, "deletion") {
						fmt.Sscanf(strings.TrimSpace(part), "%d", &stats.LinesRemoved)
						break
					}
				}
			}
		}
	}

	return stats
}

// GetRemoteURL returns the remote URL for origin
func (p *Parser) GetRemoteURL() (string, error) {
	cmd := exec.Command("git", "-C", p.RepoPath, "config", "--get", "remote.origin.url")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get remote URL: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}
