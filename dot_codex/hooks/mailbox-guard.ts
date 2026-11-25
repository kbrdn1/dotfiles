#!/usr/bin/env bun
// PreToolUse Codex (matcher "*") : la boîte aux lettres de herdr-bridge reste fermée aux outils qui ne
// sont pas Bash. Port des règles deny Read(...)/Edit(...) de ~/.claude/settings.json : en Codex, on
// écrit par apply_patch et on lit aussi par des MCP. Bash est gardé par ~/.claude/hooks/no-shell-write.ts
// (même fonction mailbox, branché à côté dans ~/.codex/hooks.json) ; ici on ne fait que le reste.
// Au moindre doute on laisse passer, comme le hook Claude dont la règle vient.
//
// Check : bun ~/.codex/hooks/mailbox-guard.check.ts

import { mailbox, MAILBOX_WHY } from "/Users/kbrdn1/.claude/hooks/no-shell-write.ts";

if (import.meta.main) {
  try {
    const input = JSON.parse(await Bun.stdin.text());
    if (input?.tool_name !== "Bash" && mailbox(JSON.stringify(input?.tool_input ?? ""), input?.cwd ?? "")) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Refusé : ${MAILBOX_WHY}. Ces fichiers portent les demandes d'autorisation et les réponses de Kylian : seul Herdr y écrit, sur son clic. Aucun agent n'y lit ni n'y écrit.`,
        },
      }));
    }
  } catch { /* entrée illisible : on laisse passer */ }
}
