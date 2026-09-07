# Project Constitution

**Version**: 1.0.0 | **Ratified**: [DATE] | **Last Amended**: [DATE]

## Document Hierarchy

This constitution defines **architectural principles**. For operational guidance:

- **Constitution** (.specify/memory/constitution.md) - Architectural principles & quality gates
- **CONTRIBUTING.md** - Git workflow, branches, commits, pull requests
- **CLAUDE.md** / **AGENTS.md** - AI assistant operational guidance
- **docs/** - Technical documentation

## Core Principles

### I. [First Principle Name]

[Describe the architectural principle and its requirements]

- **Requirement 1**: [What MUST be done]
- **Requirement 2**: [What MUST be done]
- **Exception**: [Any legitimate exceptions to this principle]

**Rationale**: [Why this principle exists and what problem it solves]

### II. [Second Principle Name]

[Describe the architectural principle and its requirements]

- **Requirement 1**: [What MUST be done]
- **Requirement 2**: [What MUST be done]

**Rationale**: [Why this principle exists and what problem it solves]

### III. [Third Principle Name]

[Describe the architectural principle and its requirements]

- **Requirement 1**: [What MUST be done]
- **Requirement 2**: [What MUST be done]

**Rationale**: [Why this principle exists and what problem it solves]

<!--
  Add more principles as needed. Use /speckit.constitution to interactively
  define your project's architectural principles.

  Guidelines:
  - Each principle should address ONE architectural concern
  - Use MUST/SHOULD/MAY language (RFC 2119)
  - Include rationale explaining WHY, not just WHAT
  - Keep principles testable and enforceable
  - Number principles sequentially with Roman numerals
-->

## Quality Standards

### Code Formatting

- **Formatter**: [Your formatter, e.g., Prettier, Black, PHP-CS-Fixer]
- **Indentation**: [Spaces or tabs, how many]
- **Style Guide**: [Reference to style guide]

### Testing Standards

- **Test Isolation**: Each test MUST be independent
- **Naming**: [Your test naming convention]
- **Coverage**: [Your coverage requirements]

### Deployment Standards

- **Environment Separation**: [Your environments]
- **Configuration**: [How config is managed]

## Governance

### Amendment Process

Constitution amendments require formal process:

1. **Proposal**: Document proposed change with rationale
2. **Discussion**: Team review of implications
3. **Approval**: Consensus among maintainers
4. **Documentation**: Update constitution with version increment

### Version Semantics

- **MAJOR**: Backward incompatible changes to core principles
- **MINOR**: New principles or material expansions
- **PATCH**: Clarifications, typo fixes

### Compliance Enforcement

- **SpecKit Gates**: `/speckit.plan` and `/speckit.analyze` enforce constitution compliance
- **Pull Request Reviews**: Verify adherence to MUST principles
- **Technical Debt**: Violations permitted only with explicit justification

### Complexity Justification

When constitution principles must be violated:

```markdown
## Constitution Violation Justification

**Principle Violated**: [Principle name]
**Why Needed**: [Specific technical requirement]
**Alternatives Considered**: [Simpler approaches rejected]
**Mitigation**: [How impact is minimized]
**Type**: [Technical debt | Architectural decision]
```
