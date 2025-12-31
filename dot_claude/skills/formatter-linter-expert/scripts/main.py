#!/usr/bin/env python3
"""
Formatter & Linter Expert - Main Entry Point

Universal code formatter and linter for multi-ecosystem projects.
Supports Laravel/PHP, Bun/Node/TS/JS, React, Vue, Astro, Nuxt, Go, Rust, Deno.
"""

import sys
import argparse
import json
from pathlib import Path
from typing import List, Dict, Optional

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from detectors.environment_detector import EnvironmentDetector
from detectors.asdf_manager import AsdfManager
from detectors.config_finder import ConfigFinder
from reporters.markdown_reporter import MarkdownReporter
from reporters.json_reporter import JSONReporter
from reporters.console_reporter import ConsoleReporter
from utils.interactive import InteractivePrompt
from utils.file_scanner import FileScanner


class FormatterLinterExpert:
    """Main orchestrator for formatting and linting operations"""

    def __init__(self, args):
        self.args = args
        self.project_root = Path(args.project_root).resolve()
        self.results = {
            "project": self.project_root.name,
            "environments": [],
            "summary": {
                "files_analyzed": 0,
                "files_modified": 0,
                "issues": {"errors": 0, "warnings": 0, "info": 0}
            },
            "issues": [],
            "configurations": []
        }

        # Initialize components
        self.env_detector = EnvironmentDetector(self.project_root)
        self.asdf_manager = AsdfManager(self.project_root, args.asdf_mode)
        self.config_finder = ConfigFinder(self.project_root)
        self.interactive = InteractivePrompt() if args.mode == "interactive" else None

    def run(self) -> int:
        """
        Main execution flow

        Returns:
            int: Exit code (0 = success, >0 = issues found)
        """
        try:
            print("🚀 Formatter & Linter Expert starting...\n")

            # Step 1: Detect environments
            print("🔍 Detecting project environment(s)...")
            environments = self._detect_environments()

            if not environments:
                print("❌ No supported ecosystem detected!")
                print("   Try specifying manually with --env flag")
                return 12

            self.results["environments"] = [e["name"] for e in environments]

            # Step 2: Validate versions (if using asdf)
            if self.args.asdf_mode != "ignore":
                print("\n📦 Validating tool versions with asdf...")
                self._validate_versions(environments)

            # Step 3: Find configurations
            print("\n⚙️  Locating configurations...")
            self._find_configurations(environments)

            # Step 4: Scan files
            print("\n📁 Scanning files...")
            files = self._scan_files(environments)
            self.results["summary"]["files_analyzed"] = len(files)

            if not files:
                print("   No files to analyze!")
                return 0

            print(f"   Found {len(files)} files to process")

            # Step 5: Execute formatting/linting
            print(f"\n⚡ Executing {self.args.mode} mode...\n")
            exit_code = self._execute_operations(environments, files)

            # Step 6: Generate reports
            print("\n📊 Generating reports...")
            self._generate_reports()

            # Step 7: Summary
            self._print_summary()

            return exit_code

        except KeyboardInterrupt:
            print("\n\n⚠️  Operation cancelled by user")
            return 130
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            if self.args.verbose:
                import traceback
                traceback.print_exc()
            return 99

    def _detect_environments(self) -> List[Dict]:
        """Detect all ecosystems in the project"""
        if self.args.env:
            # Manual specification
            return self.env_detector.detect_specific(self.args.env)

        # Auto-detection
        environments = self.env_detector.detect_all()

        for env in environments:
            print(f"   ✅ Detected: {env['name']} ({env['confidence']}% confidence)")
            if env.get("framework"):
                print(f"      Framework: {env['framework']}")

        return environments

    def _validate_versions(self, environments: List[Dict]):
        """Validate tool versions using asdf"""
        for env in environments:
            tools = env.get("required_tools", [])
            for tool in tools:
                version_info = self.asdf_manager.get_version(tool)

                if version_info["source"] == "asdf":
                    print(f"   ✅ {tool}: {version_info['version']} (asdf)")
                elif version_info["source"] == "system":
                    if self.args.asdf_mode == "strict":
                        print(f"   ❌ {tool}: Not managed by asdf (strict mode)")
                        raise SystemExit(11)
                    else:
                        print(f"   ⚠️  {tool}: {version_info['version']} (system fallback)")
                else:
                    print(f"   ❌ {tool}: Not found!")
                    if self.args.asdf_mode == "strict":
                        raise SystemExit(10)

    def _find_configurations(self, environments: List[Dict]):
        """Locate configuration files for each environment"""
        for env in environments:
            configs = self.config_finder.find_for_environment(env["name"])

            if self.args.config:
                # Custom config provided
                custom_config = Path(self.args.config)
                if custom_config.exists():
                    configs["custom"] = str(custom_config)
                    print(f"   ✅ Using custom config: {custom_config}")
                else:
                    print(f"   ⚠️  Custom config not found: {custom_config}")

            if configs:
                print(f"   ✅ {env['name']} configs:")
                for config_type, config_path in configs.items():
                    print(f"      - {config_type}: {config_path}")
                self.results["configurations"].append({
                    "environment": env["name"],
                    "configs": configs
                })
            else:
                print(f"   ℹ️  {env['name']}: Using default configuration")
                if self.args.use_defaults:
                    # Copy default config
                    default_config = self._get_default_config(env["name"])
                    if default_config:
                        print(f"      Fallback: {default_config}")

    def _scan_files(self, environments: List[Dict]) -> List[Path]:
        """Scan project for files to analyze"""
        scanner = FileScanner(
            self.project_root,
            exclude_patterns=self.args.exclude
        )

        files = []
        for env in environments:
            extensions = env.get("file_extensions", [])
            env_files = scanner.scan(
                scope=self.args.scope,
                extensions=extensions
            )
            files.extend(env_files)

        # Remove duplicates
        return list(set(files))

    def _execute_operations(self, environments: List[Dict], files: List[Path]) -> int:
        """Execute formatting/linting operations"""
        max_exit_code = 0

        for env in environments:
            print(f"\n{'='*60}")
            print(f"Processing {env['name']} files...")
            print(f"{'='*60}\n")

            # Filter files for this environment
            env_files = [
                f for f in files
                if f.suffix in env.get("file_extensions", [])
            ]

            if not env_files:
                print(f"   No {env['name']} files to process")
                continue

            # Import and instantiate formatter/linter for this environment
            formatter_class = self._get_formatter_class(env["name"])
            linter_class = self._get_linter_class(env["name"])

            if not formatter_class and not linter_class:
                print(f"   ⚠️  No formatter/linter available for {env['name']}")
                continue

            # Get configuration for this environment
            config = next(
                (c["configs"] for c in self.results["configurations"]
                 if c["environment"] == env["name"]),
                {}
            )

            # Execute based on mode
            if self.args.mode == "analyze":
                exit_code = self._analyze_only(
                    env, env_files, formatter_class, linter_class, config
                )
            elif self.args.mode == "format":
                exit_code = self._format_only(
                    env, env_files, formatter_class, config
                )
            elif self.args.mode == "interactive":
                exit_code = self._interactive_mode(
                    env, env_files, formatter_class, linter_class, config
                )

            max_exit_code = max(max_exit_code, exit_code)

        return max_exit_code

    def _analyze_only(self, env, files, formatter_class, linter_class, config) -> int:
        """Analyze mode: report issues without modifying files"""
        if formatter_class:
            formatter = formatter_class(config, dry_run=True)
            format_results = formatter.analyze(files)
            self._aggregate_results(format_results, "formatting")

        if linter_class:
            linter = linter_class(config)
            lint_results = linter.analyze(files)
            self._aggregate_results(lint_results, "linting")

        return 1 if self.results["summary"]["issues"]["errors"] > 0 else 0

    def _format_only(self, env, files, formatter_class, config) -> int:
        """Format mode: apply fixes directly"""
        if not formatter_class:
            print("   ⚠️  No formatter available")
            return 0

        formatter = formatter_class(config, dry_run=False)
        results = formatter.format(files)

        modified = results.get("modified_files", 0)
        self.results["summary"]["files_modified"] += modified

        print(f"   ✅ Formatted {modified} files")
        return 0

    def _interactive_mode(self, env, files, formatter_class, linter_class, config) -> int:
        """Interactive mode: review and approve changes file-by-file"""
        if not formatter_class:
            print("   ⚠️  No formatter available")
            return 0

        formatter = formatter_class(config, dry_run=True)

        for file_path in files:
            # Analyze this file
            file_results = formatter.analyze([file_path])

            if not file_results.get("issues"):
                continue  # No issues, skip

            # Show file info
            print(f"\n📄 File: {file_path.relative_to(self.project_root)}")
            print(f"   Issues: {len(file_results['issues'])}")

            # Show preview
            diff = formatter.preview_changes([file_path])
            if diff:
                print("\nPreview of changes:")
                print(diff)

            # Prompt user
            choice = self.interactive.prompt_apply_fix()

            if choice == "y":
                formatter.dry_run = False
                formatter.format([file_path])
                formatter.dry_run = True
                print("   ✅ Applied")
                self.results["summary"]["files_modified"] += 1
            elif choice == "s":
                print("   ⏭️  Skipped")
            elif choice == "q":
                print("\n   🛑 Quit interactive mode")
                break

        return 0

    def _aggregate_results(self, results: Dict, category: str):
        """Aggregate results from formatter/linter"""
        for issue in results.get("issues", []):
            issue["category"] = category
            self.results["issues"].append(issue)

            severity = issue.get("severity", "info")
            if severity in self.results["summary"]["issues"]:
                self.results["summary"]["issues"][severity] += 1

    def _generate_reports(self):
        """Generate output reports"""
        if self.args.output in ["markdown", "both"]:
            reporter = MarkdownReporter(self.results)
            md_path = self.project_root / (self.args.report_name + ".md")
            reporter.generate(md_path)
            print(f"   ✅ Markdown report: {md_path}")

        if self.args.export_json or self.args.output == "both":
            reporter = JSONReporter(self.results)
            json_path = self.project_root / (self.args.report_name + ".json")
            reporter.generate(json_path)
            print(f"   ✅ JSON report: {json_path}")

    def _print_summary(self):
        """Print final summary"""
        ConsoleReporter(self.results).print_summary()

    def _get_formatter_class(self, env_name: str):
        """Dynamically import formatter class for environment"""
        try:
            if "php" in env_name.lower() or "laravel" in env_name.lower():
                from formatters.php_formatter import PHPFormatter
                return PHPFormatter
            elif any(x in env_name.lower() for x in ["js", "ts", "react", "vue", "astro", "nuxt"]):
                from formatters.js_formatter import JSFormatter
                return JSFormatter
            elif "go" in env_name.lower():
                from formatters.go_formatter import GoFormatter
                return GoFormatter
            elif "rust" in env_name.lower():
                from formatters.rust_formatter import RustFormatter
                return RustFormatter
            elif "deno" in env_name.lower():
                from formatters.deno_formatter import DenoFormatter
                return DenoFormatter
        except ImportError as e:
            print(f"   ⚠️  Could not import formatter: {e}")
        return None

    def _get_linter_class(self, env_name: str):
        """Dynamically import linter class for environment"""
        try:
            if "php" in env_name.lower() or "laravel" in env_name.lower():
                from linters.php_linter import PHPLinter
                return PHPLinter
            elif any(x in env_name.lower() for x in ["js", "ts", "react", "vue", "astro", "nuxt"]):
                from linters.js_linter import JSLinter
                return JSLinter
            elif "go" in env_name.lower():
                from linters.go_linter import GoLinter
                return GoLinter
            elif "rust" in env_name.lower():
                from linters.rust_linter import RustLinter
                return RustLinter
            elif "deno" in env_name.lower():
                from linters.deno_linter import DenoLinter
                return DenoLinter
        except ImportError as e:
            print(f"   ⚠️  Could not import linter: {e}")
        return None

    def _get_default_config(self, env_name: str) -> Optional[Path]:
        """Get path to default configuration for environment"""
        configs_dir = Path(__file__).parent.parent / "configs" / "defaults"

        mapping = {
            "laravel": configs_dir / "php" / "pint.json",
            "php": configs_dir / "php" / "pint.json",
            "javascript": configs_dir / "js" / ".prettierrc",
            "typescript": configs_dir / "js" / ".prettierrc",
            "go": configs_dir / "go" / ".golangci.yml",
            "rust": configs_dir / "rust" / "rustfmt.toml",
            "deno": configs_dir / "deno" / "deno.json"
        }

        return mapping.get(env_name.lower())


def parse_arguments():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description="Universal code formatter and linter for multi-ecosystem projects",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze entire project
  python main.py --mode analyze --project-root /path/to/project

  # Format all files
  python main.py --mode format --project-root .

  # Interactive mode
  python main.py --mode interactive

  # Custom config and scope
  python main.py --mode format --config my-pint.json --scope src/

  # Export JSON report
  python main.py --mode analyze --export-json --report-name quality-report
        """
    )

    parser.add_argument(
        "--project-root",
        type=str,
        default=".",
        help="Project root directory (default: current directory)"
    )

    parser.add_argument(
        "--mode",
        choices=["analyze", "format", "interactive"],
        default="analyze",
        help="Operation mode (default: analyze)"
    )

    parser.add_argument(
        "--scope",
        type=str,
        default=None,
        help="Limit scope to specific file/directory (default: entire project)"
    )

    parser.add_argument(
        "--env",
        type=str,
        default=None,
        help="Manually specify environment (laravel, typescript, go, rust, deno)"
    )

    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to custom configuration file"
    )

    parser.add_argument(
        "--use-defaults",
        action="store_true",
        help="Use skill's default configs if none found"
    )

    parser.add_argument(
        "--asdf-mode",
        choices=["strict", "fallback", "warn", "ignore"],
        default="fallback",
        help="asdf integration mode (default: fallback)"
    )

    parser.add_argument(
        "--output",
        choices=["markdown", "json", "both"],
        default="markdown",
        help="Report output format (default: markdown)"
    )

    parser.add_argument(
        "--export-json",
        action="store_true",
        help="Export JSON report (alias for --output json)"
    )

    parser.add_argument(
        "--report-name",
        type=str,
        default="code-quality-report",
        help="Report filename (without extension)"
    )

    parser.add_argument(
        "--exclude",
        type=str,
        nargs="+",
        default=["node_modules", "vendor", "dist", "build", ".git"],
        help="Directories to exclude from scanning"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )

    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_arguments()

    expert = FormatterLinterExpert(args)
    exit_code = expert.run()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
