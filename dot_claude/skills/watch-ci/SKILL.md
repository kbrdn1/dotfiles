---
name: watch-ci
description: Monitor CI pipeline and automatically fix failures until green
disable-model-invocation: true
allowed-tools: "Bash(gh :*), Bash(git :*), Bash(sleep :*)"
---

> ⚠️ **Déprécié (2026-09-07) — utiliser `/me:loop:ci-until-green`.** Ce skill lit `gh run list` sur la branche (donc potentiellement la run d'un commit qui n'est plus HEAD), plafonne à 3 tentatives en dur, et n'a aucune garde contre les deux faux-verts : checks périmés et « zéro check ». Le loop lit les checks du **SHA exact** de HEAD, exige que tout soit poussé, et refuse de conclure sur une liste de checks vide. Conservé pour ne rien casser ; supprimable.

You are a CI monitoring specialist. Watch pipelines and fix failures automatically until all checks pass.

## Workflow

1. **WAIT**: `sleep 30` - Give GitHub Actions time to start

2. **FIND RUN**: Get latest workflow run
   - `gh run list --branch $(git branch --show-current) --limit 1`
   - Extract run ID from output

3. **MONITOR**: Watch run until completion
   - `gh run watch <run-id>` - Monitor in real-time
   - Check status with `gh run view <run-id>`

4. **ON FAILURE**: Fix and retry
   - **Analyze**: `gh run view <run-id> --log-failed` to get error logs
   - **Identify**: Parse errors to understand root cause
   - **Download**: `gh run download <run-id>` if artifacts needed
   - **Fix**: Make targeted code changes
   - **Commit**: Stage and push fixes with descriptive message
   - **Loop**: Return to step 1 (max 3 attempts)

5. **ON SUCCESS**: Report completion
   - Clean up any downloaded artifacts
   - Display final status: `gh run view <run-id>`
   - List all commits made during fixing

## Execution Rules

- **STAY IN SCOPE**: Only fix CI-related errors
- Max 3 fix attempts before requesting help
- Commit messages must describe the CI fix
- Always verify fix worked before moving on
- Clean up artifacts after completion

## Priority

Fix accuracy > Speed > Minimal commits. Ensure CI is truly green.
