#!/usr/bin/env python3
"""
Migrate ~/.claude/commands/ to ~/.claude/skills/ format.

Transforms command .md files into skill directories with SKILL.md,
converting frontmatter fields to the skills standard.
"""

import os
import re
import shutil
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude"
COMMANDS_DIR = CLAUDE_DIR / "commands"
SKILLS_DIR = CLAUDE_DIR / "skills"

# Commands that should only be invoked by the user (side effects)
DISABLE_MODEL_INVOCATION = {
    "commit",
    "create-pull-request",
    "run-tasks",
    "watch-ci",
    "fix-pr-comments",
    "sc/git",
    "sc/build",
    "sc/save",
    "sc/load",
    "me/create-agent",
    "me/create-command",
    "me/skill-create",
    "me/check-reviews",
}

# Fragments and templates: background knowledge only
USER_INVOCABLE_FALSE = {
    "_fragments",
    "_templates",
}

# Fields to keep in skills frontmatter
VALID_SKILL_FIELDS = {
    "name",
    "description",
    "argument-hint",
    "disable-model-invocation",
    "user-invocable",
    "allowed-tools",
    "model",
    "context",
    "agent",
    "hooks",
}

# Fields to remove (SuperClaude-specific, not recognized by skills)
REMOVE_FIELDS = {
    "category",
    "complexity",
    "mcp-servers",
    "personas",
    "version",
    "dependencies",
    "command",
    "wave-enabled",
    "performance-profile",
    "purpose",
}


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter and body from markdown content."""
    if not content.startswith("---"):
        return {}, content

    # Find the closing ---
    end_idx = content.index("---", 3)
    frontmatter_str = content[3:end_idx].strip()
    body = content[end_idx + 3:].strip()

    # Simple YAML parsing (handles our use cases)
    frontmatter = {}
    current_key = None
    current_value_lines = []

    for line in frontmatter_str.split("\n"):
        # Skip empty lines
        if not line.strip():
            continue

        # Check if this is a key: value pair
        match = re.match(r'^(\S[\w-]*)\s*:\s*(.*)', line)
        if match:
            # Save previous key if any
            if current_key:
                frontmatter[current_key] = _parse_value(
                    "\n".join(current_value_lines)
                )

            current_key = match.group(1)
            current_value_lines = [match.group(2).strip()]
        elif current_key and line.startswith("  "):
            # Continuation of previous value (list items, etc.)
            current_value_lines.append(line.strip())

    # Save last key
    if current_key:
        frontmatter[current_key] = _parse_value("\n".join(current_value_lines))

    return frontmatter, body


def _parse_value(value: str) -> str | list | bool:
    """Parse a YAML value string."""
    value = value.strip()

    # Boolean
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False

    # List in bracket notation: [item1, item2]
    if value.startswith("[") and value.endswith("]"):
        items = value[1:-1].strip()
        if not items:
            return []
        return [item.strip().strip('"').strip("'") for item in items.split(",")]

    # List with - notation
    if value.startswith("- "):
        lines = value.split("\n")
        return [line.lstrip("- ").strip().strip('"').strip("'") for line in lines]

    # Quoted string
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]

    return value


def serialize_frontmatter(fm: dict) -> str:
    """Serialize frontmatter dict back to YAML string."""
    lines = ["---"]

    # Order: name, description, argument-hint, disable-model-invocation,
    # user-invocable, allowed-tools, model, context, agent
    order = [
        "name",
        "description",
        "argument-hint",
        "disable-model-invocation",
        "user-invocable",
        "allowed-tools",
        "model",
        "context",
        "agent",
    ]

    done = set()
    for key in order:
        if key in fm:
            lines.append(_serialize_field(key, fm[key]))
            done.add(key)

    # Any remaining fields
    for key, value in fm.items():
        if key not in done:
            lines.append(_serialize_field(key, value))

    lines.append("---")
    return "\n".join(lines)


def _serialize_field(key: str, value) -> str:
    """Serialize a single frontmatter field."""
    if isinstance(value, bool):
        return f"{key}: {'true' if value else 'false'}"
    if isinstance(value, list):
        if not value:
            return f"{key}: []"
        # Use inline format for short lists
        items = ", ".join(str(v) for v in value)
        if len(items) < 80:
            return f"{key}: {items}"
        # Multi-line for long lists
        lines = [f"{key}:"]
        for item in value:
            lines.append(f"  - {item}")
        return "\n".join(lines)
    # String - quote if contains special chars
    s = str(value)
    if ":" in s or "#" in s or s.startswith("{") or s.startswith("["):
        return f'{key}: "{s}"'
    return f"{key}: {s}"


def transform_frontmatter(
    fm: dict, rel_path: str, dir_name: str
) -> dict:
    """Transform command frontmatter to skills frontmatter."""
    new_fm = {}

    # Copy valid fields
    for key in VALID_SKILL_FIELDS:
        if key in fm:
            new_fm[key] = fm[key]

    # Ensure name exists
    if "name" not in new_fm:
        new_fm["name"] = dir_name

    # Ensure description exists
    if "description" not in new_fm:
        new_fm["description"] = f"Skill migrated from {rel_path}"

    # Clean description quotes
    if isinstance(new_fm.get("description"), str):
        new_fm["description"] = new_fm["description"].strip('"').strip("'")

    # Add disable-model-invocation for side-effect commands
    if rel_path in DISABLE_MODEL_INVOCATION:
        new_fm["disable-model-invocation"] = True

    # Add user-invocable: false for fragments/templates
    for prefix in USER_INVOCABLE_FALSE:
        if rel_path.startswith(prefix):
            new_fm["user-invocable"] = False
            break

    return new_fm


def get_relative_command_path(filepath: Path) -> str:
    """Get relative path from commands dir without extension."""
    rel = filepath.relative_to(COMMANDS_DIR)
    return str(rel.with_suffix(""))


def get_skill_dir_name(rel_path: str) -> str:
    """Get the skill directory name from relative path."""
    # The last component is the skill name
    return Path(rel_path).name


def migrate_file(filepath: Path, dry_run: bool = False) -> str | None:
    """Migrate a single command file to a skill."""
    rel_path = get_relative_command_path(filepath)
    dir_name = get_skill_dir_name(rel_path)

    # Determine output directory
    # commands/sc/analyze.md -> skills/sc/analyze/SKILL.md
    # commands/commit.md -> skills/commit/SKILL.md
    # commands/_fragments/base/output-formats.md -> skills/_fragments/base/output-formats/SKILL.md
    skill_dir = SKILLS_DIR / rel_path
    skill_file = skill_dir / "SKILL.md"

    # Read source
    content = filepath.read_text(encoding="utf-8")

    # Parse frontmatter
    fm, body = parse_frontmatter(content)

    # Transform frontmatter
    new_fm = transform_frontmatter(fm, rel_path, dir_name)

    # Build new content
    new_content = serialize_frontmatter(new_fm) + "\n\n" + body + "\n"

    if dry_run:
        return f"  {rel_path}.md -> skills/{rel_path}/SKILL.md"

    # Create directory and write
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_file.write_text(new_content, encoding="utf-8")

    return f"  ✅ {rel_path}"


def main():
    """Run the migration."""
    if not COMMANDS_DIR.exists():
        print("❌ Commands directory not found!")
        return

    # Create skills directory
    SKILLS_DIR.mkdir(parents=True, exist_ok=True)

    # Find all .md files in commands/
    md_files = sorted(COMMANDS_DIR.rglob("*.md"))

    print(f"📋 Found {len(md_files)} command files to migrate")
    print(f"📁 Source: {COMMANDS_DIR}")
    print(f"📁 Target: {SKILLS_DIR}")
    print()

    # Categorize
    sc_files = [f for f in md_files if "commands/sc/" in str(f)]
    me_files = [f for f in md_files if "commands/me/" in str(f)]
    fragment_files = [f for f in md_files if "commands/_fragments/" in str(f)]
    template_files = [f for f in md_files if "commands/_templates/" in str(f)]
    standalone_files = [
        f
        for f in md_files
        if f not in sc_files
        and f not in me_files
        and f not in fragment_files
        and f not in template_files
    ]

    # Migrate each category
    categories = [
        ("SuperClaude /sc: commands", sc_files),
        ("Standalone commands", standalone_files),
        ("Meta /me: commands", me_files),
        ("Fragments (user-invocable: false)", fragment_files),
        ("Templates (user-invocable: false)", template_files),
    ]

    total = 0
    for cat_name, files in categories:
        if not files:
            continue
        print(f"{'='*60}")
        print(f"📦 {cat_name} ({len(files)} files)")
        print(f"{'='*60}")

        for filepath in files:
            result = migrate_file(filepath)
            if result:
                print(result)
                total += 1

        print()

    print(f"{'='*60}")
    print(f"🎉 Migration complete! {total} skills created")
    print(f"📁 Skills directory: {SKILLS_DIR}")
    print()

    # Summary
    print("📊 Summary:")
    for cat_name, files in categories:
        if files:
            print(f"  {cat_name}: {len(files)}")

    print()
    print("💡 Notes:")
    print("  - commands/ directory preserved as backup")
    print("  - Skills with disable-model-invocation: true are user-only")
    print("  - Fragments/templates have user-invocable: false")
    print("  - All other skills can be invoked by both user and Claude")


if __name__ == "__main__":
    main()
