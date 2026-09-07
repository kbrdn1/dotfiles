---
name: speckit.implement
description: Execute the implementation plan by processing and executing all tasks defined in tasks.md
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

0. **Load project config**: Read `.specify/speckit.env` from the repo root. Parse all `SPECKIT_*` variables to determine paths and naming conventions. If `.specify/speckit.env` does not exist, fall back to defaults: `SPECKIT_SPEC_DIR=".specify/specs"`, `SPECKIT_SCRIPTS_DIR=".specify/scripts/bash"`, `SPECKIT_TEMPLATES_DIR=".specify/templates"`.

1. Run `${SPECKIT_SCRIPTS_DIR}/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - For each checklist, count total/completed/incomplete items
   - Create a status table (PASS/FAIL per checklist)
   - **If any checklist is incomplete**: STOP and ask user to proceed or halt
   - **If all complete**: Automatically proceed

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md, contracts/, research.md, quickstart.md

4. **Project Setup Verification**: Create/verify ignore files based on actual project setup (.gitignore, .dockerignore, etc.). Skip for existing projects where these are already configured.

5. Parse tasks.md structure and extract:
   - **Task phases**: Setup, Tests, Core, Integration, Polish
   - **Task dependencies**: Sequential vs parallel execution rules
   - **Task details**: ID, description, file paths, parallel markers [P]
   - **Execution flow**: Order and dependency requirements

6. **Hydrate/Resume Claude Tasks** (session tracking via hydration pattern):

   Parse tasks.md and identify the state of each task (`- [X]`/`- [x]` = completed, `- [ ]` = pending).

   **6a. Determine session mode**:
   - If ALL tasks are `- [ ]` -> **Fresh start**: hydrate all tasks
   - If SOME tasks are `- [X]` -> **Resume mode**: hydrate only pending tasks
   - If ALL tasks are `- [X]` -> **Already complete**: skip to step 10

   **6b. Create Claude Tasks for pending items only**:
   - For each `- [ ]` line, call `TaskCreate` with:
     - **subject**: `"{TaskID} {[Story]?} {Description}"` (e.g. `"T012 [US1] Create User model"`)
     - **description**: `"Phase {N} - {Phase Title}: {Full description with file path}. Feature: {feature-name}"`
     - **activeForm**: Present continuous form (e.g. `"Creating User model"`, `"Implementing service"`, `"Adding tests"`)
     - **metadata**: `{ "speckit_id": "{TaskID}", "phase": "{N}", "story": "{USx|null}", "parallel": {true|false}, "feature": "{feature-dir-name}" }`
   - Store mapping: speckit ID (T001) -> Claude Task ID (#1) for dependency setup

   **6c. Set up dependencies**:
   - **Phase-level**: Phase 2 tasks -> `addBlockedBy` all Phase 1 Claude Task IDs
   - **Phase-level**: Phase 3+ (User Story) tasks -> `addBlockedBy` all Phase 2 Claude Task IDs
   - **Phase-level**: Final Phase (Polish) tasks -> `addBlockedBy` all User Story phase task IDs
   - **Cross-story**: User Story phases are independent of each other (no cross-story blocking)
   - **Within a phase**: `[P]` tasks have no intra-phase dependencies
   - **Within a phase**: Non-`[P]` tasks -> `addBlockedBy` previous task in same phase
   - **Skip completed phases**: If all tasks in Phase 1 are `[X]`, don't create blockers for Phase 2

   **6d. Log session start**:
   - Create or append to `FEATURE_DIR/sessions.md`:
     ```markdown
     ## Session {ISO-8601-timestamp} - Implementation {fresh|resume}
     - **Branch**: {current-git-branch}
     - **Mode**: {Fresh start|Resume from {first-pending-TaskID}}
     - **Progress**: {completed-count}/{total-count} tasks completed
     - **Pending**: {list of pending task IDs}
     - **Ready** (unblocked): {list of immediately available task IDs}
     ```

   **6e. Report hydration summary**:
   - Display: `"{X} tasks hydrated ({Y} already completed, {Z} pending). Ready: {list}. Resuming from {first-ready-TaskID}."`

7. Execute implementation following the task plan:
   - **Phase-by-phase execution**: Complete each phase before moving to the next
   - **Respect dependencies**: Run sequential tasks in order, parallel tasks [P] can run together
   - **Follow TDD approach**: Execute test tasks before their corresponding implementation tasks
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify each phase completion before proceeding

8. Implementation execution rules:
   - **Setup first**: Initialize project structure, dependencies, configuration
   - **Tests before code**: If you need to write tests for contracts, entities, and integration scenarios
   - **Core development**: Implement models, services, CLI commands, endpoints
   - **Integration work**: Database connections, middleware, logging, external services
   - **Polish and validation**: Unit tests, performance optimization, documentation

9. Progress tracking and error handling (with Claude Tasks sync):

   **9a. Before starting each task**:
   - Call `TaskUpdate(taskId: {claude-task-id}, status: "in_progress")` to activate the spinner with `activeForm`

   **9b. After completing each task**:
   - Call `TaskUpdate(taskId: {claude-task-id}, status: "completed")` to mark done in Claude Tasks
   - Mark the task as `[X]` in tasks.md (file-based persistence for cross-session resume)
   - **Both updates MUST happen together** to keep Claude Tasks and tasks.md in sync

   **9c. On task failure**:
   - Keep the Claude Task as `in_progress` (do NOT mark completed)
   - Do NOT mark `[X]` in tasks.md
   - Halt execution if non-parallel task fails
   - For `[P]` tasks: continue with other parallel tasks, report the failure

   **9d. Phase checkpoint**:
   - After all tasks in a phase complete, call `TaskList()` to verify status
   - Report: `"Phase {N} complete ({X}/{Y} tasks). Moving to Phase {N+1}."`

10. Completion validation:
    - Verify all required tasks are completed
    - Call `TaskList()` to confirm all Claude Tasks are in `completed` status
    - Check that implemented features match the original specification
    - Validate that tests pass and coverage meets requirements
    - Report final status with summary of completed work

11. **Session end - finalize session log**:
    - Append completion entry to `FEATURE_DIR/sessions.md`:
      ```markdown
      ### Session End: {ISO-8601-timestamp}
      - **Completed this session**: {list of task IDs completed during this session}
      - **Remaining**: {list of still-pending task IDs, or "none - feature complete"}
      - **Final progress**: {completed}/{total} tasks
      - **Status**: {in progress|feature complete}
      - **Next**: {first pending task ID to resume, or "ready for PR"}
      ```
    - If all tasks completed: append `**Feature fully implemented.**` marker

Note: This command assumes a complete task breakdown exists in tasks.md. If tasks are incomplete or missing, suggest running `/speckit.tasks` first to regenerate the task list.
