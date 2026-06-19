---
name: speckit.converge
description: Assess the current codebase against the feature's spec, plan, and tasks, then append any remaining unbuilt work as new, traceable tasks to tasks.md so speckit.implement can complete it. Append-only — never rewrites spec/plan or existing tasks, never edits code.
handoffs:
  - label: Implement Convergence Tasks
    agent: speckit.implement
    prompt: Implement the appended convergence tasks in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

0. **Load project config**: Read `.specify/speckit.env` from the repo root. Parse all `SPECKIT_*` variables to determine paths and naming conventions. If `.specify/speckit.env` does not exist, fall back to defaults: `SPECKIT_SPEC_DIR=".specify/specs"`, `SPECKIT_SCRIPTS_DIR=".specify/scripts/bash"`, `SPECKIT_TEMPLATES_DIR=".specify/templates"`, `SPECKIT_CONSTITUTION=".specify/memory/constitution.md"`.

1. **Setup**: Run `${SPECKIT_SCRIPTS_DIR}/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS. All paths must be absolute. (The script resolves FEATURE_DIR via the branch prefix first, then `.specify/feature.json` as fallback.) For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

## Goal

Close the gap between what a feature's specification, plan, and tasks call for and what the codebase currently implements. Read `spec.md`, `plan.md`, and `tasks.md` as the **sole source of intent** (with the constitution as governing constraints), assess the current state of the code, determine which requirements, acceptance criteria, plan decisions, and existing tasks are unmet, incomplete, or only partially satisfied, and **append each piece of remaining work as a new, traceable task** at the bottom of `tasks.md` so that `/speckit.implement` can complete it.

This command MUST run only **after** `/speckit.implement` has run on the current `tasks.md`, and after `/speckit.tasks` produced a complete `tasks.md`.

This is **not** a diff tool and does **not** track changes. It assesses the present state of the code relative to the feature's artifacts — no git, no branch comparison, no history.

## Operating Constraints

**APPEND-ONLY, NEVER REWRITE**: The command's **only** write is appending a new `## Phase N: Convergence` section to `tasks.md`. It MUST NOT:

- modify `spec.md` or `plan.md` in any way;
- rewrite, renumber, reorder, or delete any existing task (including tasks from a prior Convergence phase);
- modify, create, or delete any application code — completing the appended tasks is the job of `/speckit.implement`.

When the codebase already satisfies everything, the command MUST leave `tasks.md` **byte-for-byte unchanged** (no empty Convergence header) and report a clean result.

**Constitution Authority**: The project constitution (`${SPECKIT_CONSTITUTION}`) is **non-negotiable**. Code that violates a MUST principle is the highest-severity finding and produces a corresponding remediation task. If the constitution is an unfilled template, skip constitution checks gracefully rather than failing.

## Execution Steps

### 1. Initialize Convergence Context

From the script output (step 1 of the Outline), derive absolute paths:

- `SPEC = FEATURE_DIR/spec.md`
- `PLAN = FEATURE_DIR/plan.md`
- `TASKS = FEATURE_DIR/tasks.md`
- `CONSTITUTION = ${SPECKIT_CONSTITUTION}` (if present)

If `spec.md`, `plan.md`, or `tasks.md` is missing, STOP with a clear, actionable message naming the prerequisite command to run (`/speckit.specify` for a missing spec, `/speckit.plan` for a missing plan, `/speckit.tasks` for missing tasks). Do not produce partial output.

### 2. Load Artifacts (Progressive Disclosure)

Load only the minimal necessary context from each artifact:

**From spec.md**: Functional Requirements (FR-###); Success Criteria (SC-###) — only items requiring buildable work, exclude post-launch outcome metrics and business KPIs; User Stories and their Acceptance Scenarios; Edge Cases (if present).

**From plan.md**: Architecture/stack choices and technical decisions; Data Model references; Phases and named touch-points (files/components the plan says will be created or edited); Technical constraints.

**From tasks.md**: Task IDs (to compute the next ID and next phase number); descriptions, phase grouping, and referenced file paths.

**From constitution (if not an unfilled template)**: Principle names and MUST/SHOULD normative statements.

### 3. Build the Intent Inventory

Create an internal model (do not echo raw artifacts):

- **Requirements inventory**: one stable key per FR-### / SC-### / user-story acceptance scenario (e.g. `US1/AC2`), plus the plan decisions and constitution principles that impose buildable obligations.
- **Code-scope map**: from the file paths named in `plan.md` and `tasks.md`, plus a keyword search for the concepts each requirement describes, derive the set of source files and components in scope. Bound the assessment to these — do **not** infer scope beyond what the artifacts define.

### 4. Assess the Codebase and Classify Findings

For each item in the intent inventory, inspect the current code in scope and produce a `Finding` only where there is a gap. Classify every finding by **gap type**:

- **`missing`**: the required work is absent from the code entirely.
- **`partial`**: the work exists but does not yet fully satisfy the requirement / acceptance criterion / plan decision.
- **`contradicts`**: the code does something that conflicts with stated intent or a constitution MUST principle.
- **`unrequested`**: the code contains work not called for by the spec, plan, or tasks (surfaced for awareness — converge does **not** delete code, it only appends a task to review/justify or remove it).

Each `Finding` records: a stable id, the `source-ref` it traces to, the `gap-type`, a severity, and a short human-readable description with the evidence (the file/area observed).

**Edge cases:**

- **Little or no code yet**: treat the entire specified scope as `missing` remaining work rather than failing.
- **Nothing remains**: produce zero findings and follow the converged branch in Step 7.

### 5. Assign Severity

- **CRITICAL**: violates a constitution MUST principle, or a `missing`/`contradicts` gap that blocks baseline functionality of a P1 user story.
- **HIGH**: a `missing` or `partial` gap on a core functional requirement or acceptance criterion.
- **MEDIUM**: a `partial` gap on a secondary requirement, or an `unrequested` addition with unclear justification.
- **LOW**: minor partial gaps, polish, or low-risk `unrequested` additions.

### 6. Present the In-Session Findings Summary

Before appending anything, output a compact, severity-graded summary (no file writes yet):

```markdown
## Convergence Findings

| ID | Gap Type | Severity | Source | Evidence | Remaining Work |
|----|----------|----------|--------|----------|----------------|
| F1 | missing  | HIGH     | FR-008 | no append-only guard in path/to/module when writing tasks.md | Add append-only enforcement |
```

**Summary metrics**: requirements / acceptance criteria checked; plan decisions checked; constitution principles checked (or "skipped — template"); findings by gap type (missing / partial / contradicts / unrequested); findings by severity.

### 7. Append Convergence Tasks (or report converged)

**If there are one or more actionable findings** (`tasks_appended` outcome):

Append to the **end** of `tasks.md`, per the append contract:

1. Scan all existing task IDs; let `M` be the maximum. Determine the next phase number `N` (highest existing phase + 1).
2. Write a single new section header `## Phase N: Convergence`.
3. Emit one checklist item per actionable finding, ordered CRITICAL/HIGH first, assigning zero-padded IDs `T{M+1:03d}, T{M+2:03d}, …`:

   ```markdown
   - [ ] T042 <imperative description with file path> per <source-ref> (<gap-type>)
   ```

   `<source-ref>` traces the task to its origin: e.g. `FR-003`, `SC-002`, `US1/AC2`, `plan: storage decision`, `Constitution II`. `<gap-type>` is one of `missing`, `partial`, `contradicts`, `unrequested`. Constitution-violation tasks MUST be emitted first and described as `CRITICAL`.
4. Never reuse or renumber existing IDs. If a prior Convergence phase exists, add a new, separately-numbered one below it — do not touch the old one.

**7b. Hydrate Claude Tasks** (session tracking — mirrors `speckit.tasks` / `speckit.implement`):

For each newly appended `- [ ]` convergence task, call `TaskCreate` with:

- **subject**: `"{TaskID} {Description}"` (e.g. `"T042 Add append-only enforcement in path/to/module"`)
- **description**: `"Phase {N} - Convergence: {Full description}. Source: {source-ref}. Feature: {feature-dir-name}"`
- **activeForm**: present continuous form (e.g. `"Adding append-only enforcement"`)
- **metadata**: `{ "speckit_id": "{TaskID}", "phase": "{N}", "story": null, "gap_type": "{gap-type}", "convergence": true, "feature": "{feature-dir-name}" }`

Set dependencies: all Convergence-phase tasks `addBlockedBy` the highest existing User-Story / Polish phase task IDs (convergence closes the feature, so it runs last). Within the Convergence phase, non-parallel tasks block on the previous one. Report a hydration summary (tasks created, ready/blocked).

**Append a session log entry** to `FEATURE_DIR/sessions.md`:

```markdown
## Session {ISO-8601-timestamp} - Convergence
- **Branch**: {current-git-branch}
- **Action**: appended Phase {N} (Convergence) — {count} tasks
- **Findings**: {missing}/{partial}/{contradicts}/{unrequested}
- **Next**: run /speckit.implement to complete convergence tasks
```

**If there are no actionable findings** (`converged` outcome):

- Do **not** modify `tasks.md` at all — no empty phase header.
- Report: **"✅ Converged — the implementation satisfies the spec, plan, and tasks."**
- Include the summary counts of what was checked.

### 8. Provide Next Actions (Handoff)

- On `tasks_appended`: state how many tasks were appended under which phase, and recommend running `/speckit.implement` to complete them; note that a follow-up `/speckit.converge` run will then find fewer or no remaining items (the loop converges).
- On `converged`: recommend proceeding to review / opening a PR. No further implement pass is needed for this feature's specified scope.

## Key rules

- Use absolute paths.
- APPEND-ONLY: the sole file write is the new `## Phase N: Convergence` section in `tasks.md` (plus Claude Tasks + `sessions.md` session tracking). Never touch spec/plan, existing tasks, or application code.
- Run only after at least one `/speckit.implement` pass.
- Designed to loop: `implement → converge → implement` until `converged`.
