---
name: speckit.tasks
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs:
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

0. **Load project config**: Read `.specify/speckit.env` from the repo root. Parse all `SPECKIT_*` variables to determine:
   - `SPECKIT_SPEC_DIR`: where spec directories live
   - `SPECKIT_BRANCH_PATTERN` / `SPECKIT_SPEC_PATTERN`: naming conventions
   - `SPECKIT_SCRIPTS_DIR`: path to bash scripts
   - `SPECKIT_TEMPLATES_DIR`: path to templates
   - If `.specify/speckit.env` does not exist, fall back to defaults: `SPECKIT_SPEC_DIR=".specify/specs"`, `SPECKIT_SCRIPTS_DIR=".specify/scripts/bash"`, `SPECKIT_TEMPLATES_DIR=".specify/templates"`.

1. **Setup**: Run `${SPECKIT_SCRIPTS_DIR}/check-prerequisites.sh --json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map endpoints to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate tasks.md**: Use `${SPECKIT_TEMPLATES_DIR}/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per user story
   - Parallel opportunities identified
   - Independent test criteria for each story
   - Suggested MVP scope (typically just User Story 1)
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

6. **Hydrate Claude Tasks** (session tracking): After generating tasks.md, create Claude Code native Tasks for real-time session tracking using the hydration pattern:

   **6a. Parse and create tasks**:
   - For each `- [ ]` line in the generated tasks.md, call `TaskCreate` with:
     - **subject**: `"{TaskID} {[Story]?} {Description}"` (e.g. `"T012 [US1] Create User model in src/models/user.py"`)
     - **description**: `"Phase {N} - {Phase Title}: {Full description}. Feature: {feature-name-from-branch}"`
     - **activeForm**: Present continuous form of the description (e.g. `"Creating User model"`, `"Implementing StatsService"`, `"Adding validation rules"`)
     - **metadata**: `{ "speckit_id": "{TaskID}", "phase": "{N}", "story": "{USx|null}", "parallel": {true|false}, "feature": "{feature-dir-name}" }`
   - Store a mapping of speckit task IDs to Claude Task IDs for dependency setup

   **6b. Set up dependencies between tasks**:
   - **Phase-level**: All Phase 2 tasks -> `addBlockedBy` all Phase 1 Claude Task IDs
   - **Phase-level**: All Phase 3+ (User Story) tasks -> `addBlockedBy` all Phase 2 Claude Task IDs
   - **Phase-level**: Final Phase (Polish) tasks -> `addBlockedBy` all User Story phase task IDs
   - **Note**: User Story phases (Phase 3, 4, 5...) are independent of each other (no cross-story blocking)
   - **Within a phase**: Tasks marked `[P]` have no intra-phase dependencies (parallelizable)
   - **Within a phase**: Tasks NOT marked `[P]` -> `addBlockedBy` the previous task in the same phase (sequential)

   **6c. Report hydration summary**:
   - Total tasks hydrated
   - Dependency links created
   - Ready tasks (unblocked, available immediately)
   - Blocked tasks by phase
   - Example: `"15 tasks hydrated, 12 dependency links. Ready: T001, T002, T003 (Phase 1). Blocked: 12 tasks across 4 phases."`

   **6d. Initialize session log**:
   - Create or append to `FEATURE_DIR/sessions.md` with:
     ```markdown
     # Session Log: {feature-name}

     ## Session {ISO-8601-timestamp} - Task Generation
     - **Branch**: {current-git-branch}
     - **Action**: tasks.md generated + Claude Tasks hydrated
     - **Total tasks**: {count}
     - **Ready**: {list of ready task IDs}
     ```

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are OPTIONAL**: Only generate test tasks if explicitly requested in the feature specification or if user requests TDD approach.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: Include ONLY if task is parallelizable (different files, no dependencies on incomplete tasks)
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path

### Phase Structure

- **Phase 1**: Setup (project initialization)
- **Phase 2**: Foundational (blocking prerequisites - MUST complete before user stories)
- **Phase 3+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Tests (if requested) -> Models -> Services -> Endpoints -> Integration
  - Each phase should be a complete, independently testable increment
- **Final Phase**: Polish & Cross-Cutting Concerns
