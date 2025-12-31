package consolidator

import (
	"sort"
	"strings"
	"time"

	"github.com/kbrdn1/changelog-generator/internal/git"
)

// Feature represents a consolidated group of related commits
type Feature struct {
	ID          string
	Name        string
	Scope       string
	Type        string
	Commits     []*git.Commit
	StartDate   time.Time
	EndDate     time.Time
	WorkingDays int
	Breaking    bool
	PRNumbers   []int
	Authors     []string
}

// Config holds consolidation settings
type Config struct {
	Enabled           bool
	TimeThresholdDays int
	ScopeMatching     bool
}

// Consolidator groups commits into features
type Consolidator struct {
	config *Config
}

// NewConsolidator creates a new consolidator
func NewConsolidator(config *Config) *Consolidator {
	return &Consolidator{config: config}
}

// GroupCommits groups commits into features based on temporal proximity and scope
func (c *Consolidator) GroupCommits(commits []*git.Commit) []*Feature {
	if !c.config.Enabled || len(commits) == 0 {
		// Return individual features for each commit
		return c.individualFeatures(commits)
	}

	// Sort commits by date (oldest first)
	sortedCommits := make([]*git.Commit, len(commits))
	copy(sortedCommits, commits)
	sort.Slice(sortedCommits, func(i, j int) bool {
		return sortedCommits[i].Date.Before(sortedCommits[j].Date)
	})

	features := make([]*Feature, 0)
	processed := make(map[string]bool)

	for _, commit := range sortedCommits {
		if processed[commit.Hash] {
			continue
		}

		// Start a new feature with this commit
		feature := &Feature{
			ID:        commit.Hash[:8],
			Scope:     commit.Scope,
			Type:      commit.Type,
			Commits:   []*git.Commit{commit},
			StartDate: commit.Date,
			EndDate:   commit.Date,
			Breaking:  commit.Breaking,
		}

		processed[commit.Hash] = true

		// Find related commits
		if c.config.ScopeMatching && commit.Scope != "" {
			c.findRelatedCommits(feature, sortedCommits, processed)
		}

		// Finalize feature
		c.finalizeFeature(feature)
		features = append(features, feature)
	}

	return features
}

// findRelatedCommits finds commits related to a feature
func (c *Consolidator) findRelatedCommits(feature *Feature, commits []*git.Commit, processed map[string]bool) {
	timeThreshold := time.Duration(c.config.TimeThresholdDays) * 24 * time.Hour

	for _, commit := range commits {
		if processed[commit.Hash] {
			continue
		}

		// Check temporal proximity
		timeDiff := commit.Date.Sub(feature.EndDate)
		if timeDiff < 0 {
			timeDiff = -timeDiff
		}

		// Check scope match
		scopeMatch := c.isScopeMatch(feature.Scope, commit.Scope)

		// Add if within time threshold and scope matches
		if timeDiff <= timeThreshold && scopeMatch {
			feature.Commits = append(feature.Commits, commit)
			feature.EndDate = commit.Date
			if commit.Breaking {
				feature.Breaking = true
			}
			processed[commit.Hash] = true
		}
	}
}

// isScopeMatch checks if two scopes are related
func (c *Consolidator) isScopeMatch(scope1, scope2 string) bool {
	if scope1 == "" || scope2 == "" {
		return false
	}

	// Exact match
	if scope1 == scope2 {
		return true
	}

	// Check if one contains the other
	if strings.Contains(scope1, scope2) || strings.Contains(scope2, scope1) {
		return true
	}

	// Check common prefixes (e.g., "auth" matches "auth/login", "auth/register")
	parts1 := strings.Split(scope1, "/")
	parts2 := strings.Split(scope2, "/")

	if len(parts1) > 0 && len(parts2) > 0 && parts1[0] == parts2[0] {
		return true
	}

	return false
}

// finalizeFeature computes final feature metadata
func (c *Consolidator) finalizeFeature(feature *Feature) {
	if len(feature.Commits) == 0 {
		return
	}

	// Sort commits by date
	sort.Slice(feature.Commits, func(i, j int) bool {
		return feature.Commits[i].Date.Before(feature.Commits[j].Date)
	})

	// Update date range
	feature.StartDate = feature.Commits[0].Date
	feature.EndDate = feature.Commits[len(feature.Commits)-1].Date

	// Calculate working days (rough estimate: calendar days / 7 * 5)
	// This will be recalculated more accurately by calendar package if needed
	calendarDays := int(feature.EndDate.Sub(feature.StartDate).Hours() / 24)
	if calendarDays == 0 {
		feature.WorkingDays = 1
	} else {
		// Rough estimate: 5 working days per 7 calendar days
		feature.WorkingDays = (calendarDays * 5 / 7) + 1
		if feature.WorkingDays < 1 {
			feature.WorkingDays = 1
		}
	}

	// Generate feature name from commits
	feature.Name = c.generateFeatureName(feature)

	// Collect unique PRs
	prMap := make(map[int]bool)
	for _, commit := range feature.Commits {
		for _, pr := range commit.PRNumbers {
			prMap[pr] = true
		}
	}
	feature.PRNumbers = make([]int, 0, len(prMap))
	for pr := range prMap {
		feature.PRNumbers = append(feature.PRNumbers, pr)
	}
	sort.Ints(feature.PRNumbers)

	// Collect unique authors
	authorMap := make(map[string]bool)
	for _, commit := range feature.Commits {
		authorMap[commit.Author] = true
	}
	feature.Authors = make([]string, 0, len(authorMap))
	for author := range authorMap {
		feature.Authors = append(feature.Authors, author)
	}
	sort.Strings(feature.Authors)
}

// generateFeatureName creates a descriptive name for the feature
func (c *Consolidator) generateFeatureName(feature *Feature) string {
	if len(feature.Commits) == 1 {
		return feature.Commits[0].Subject
	}

	// For multiple commits, use the first commit's subject as base
	// and indicate it's a consolidated feature
	baseSubject := feature.Commits[0].Subject
	if len(baseSubject) > 60 {
		baseSubject = baseSubject[:60] + "..."
	}

	if len(feature.Commits) > 1 {
		return baseSubject + " (+" + string(rune(len(feature.Commits)-1)) + " related)"
	}

	return baseSubject
}

// individualFeatures converts each commit to a separate feature
func (c *Consolidator) individualFeatures(commits []*git.Commit) []*Feature {
	features := make([]*Feature, len(commits))

	for i, commit := range commits {
		features[i] = &Feature{
			ID:        commit.Hash[:8],
			Name:      commit.Subject,
			Scope:     commit.Scope,
			Type:      commit.Type,
			Commits:   []*git.Commit{commit},
			StartDate: commit.Date,
			EndDate:   commit.Date,
			Breaking:  commit.Breaking,
			PRNumbers: commit.PRNumbers,
			Authors:   []string{commit.Author},
		}
	}

	return features
}

// GetFeaturesByType returns features grouped by commit type
func GetFeaturesByType(features []*Feature) map[string][]*Feature {
	byType := make(map[string][]*Feature)

	for _, feature := range features {
		byType[feature.Type] = append(byType[feature.Type], feature)
	}

	return byType
}

// GetBreakingFeatures returns only breaking change features
func GetBreakingFeatures(features []*Feature) []*Feature {
	breaking := make([]*Feature, 0)

	for _, feature := range features {
		if feature.Breaking {
			breaking = append(breaking, feature)
		}
	}

	return breaking
}
