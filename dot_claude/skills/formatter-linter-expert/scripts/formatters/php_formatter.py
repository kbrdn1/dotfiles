"""PHP/Laravel Formatter (Pint + PHP-CS-Fixer)"""

import subprocess
import json
from pathlib import Path
from typing import List, Dict
from .base_formatter import BaseFormatter


class PHPFormatter(BaseFormatter):
    """Formatter for PHP using Laravel Pint or PHP-CS-Fixer"""

    def get_tool_name(self) -> str:
        # Prefer Pint if available, fallback to PHP-CS-Fixer
        if self._check_pint():
            return "Laravel Pint"
        elif self._check_php_cs_fixer():
            return "PHP-CS-Fixer"
        return "None"

    def check_tool_available(self) -> bool:
        return self._check_pint() or self._check_php_cs_fixer()

    def analyze(self, files: List[Path]) -> Dict:
        if self._check_pint():
            return self._analyze_with_pint(files)
        elif self._check_php_cs_fixer():
            return self._analyze_with_php_cs_fixer(files)

        return {"issues": [], "tool": "none"}

    def format(self, files: List[Path]) -> Dict:
        if self._check_pint():
            return self._format_with_pint(files)
        elif self._check_php_cs_fixer():
            return self._format_with_php_cs_fixer(files)

        return {"modified_files": 0, "errors": ["No PHP formatter available"]}

    def preview_changes(self, files: List[Path]) -> str:
        # Generate diff preview
        if self._check_pint():
            return self._preview_pint(files)
        return ""

    def _check_pint(self) -> bool:
        """Check if Laravel Pint is available"""
        try:
            # Try vendor/bin/pint first (project-local)
            result = subprocess.run(
                ["vendor/bin/pint", "--version"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                return True
        except:
            pass

        # Try global pint
        try:
            result = subprocess.run(
                ["pint", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False

    def _check_php_cs_fixer(self) -> bool:
        """Check if PHP-CS-Fixer is available"""
        try:
            result = subprocess.run(
                ["php-cs-fixer", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False

    def _analyze_with_pint(self, files: List[Path]) -> Dict:
        """Analyze with Pint (test mode)"""
        cmd = ["vendor/bin/pint", "--test"]

        # Add config if specified
        if "pint" in self.config:
            cmd.extend(["--config", self.config["pint"]])

        # Add files
        cmd.extend([str(f) for f in files])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            issues = []

            # Parse output for issues
            for line in result.stdout.splitlines():
                if "FAIL" in line or "✗" in line:
                    # Extract file and issue
                    parts = line.split()
                    if len(parts) >= 2:
                        issues.append({
                            "file": parts[1] if len(parts) > 1 else "unknown",
                            "severity": "error",
                            "message": " ".join(parts[2:]) if len(parts) > 2 else "Formatting issue",
                            "category": "formatting"
                        })

            return {
                "tool": "Laravel Pint",
                "issues": issues,
                "exit_code": result.returncode
            }

        except subprocess.TimeoutExpired:
            return {"issues": [], "errors": ["Pint timeout"]}
        except Exception as e:
            return {"issues": [], "errors": [str(e)]}

    def _format_with_pint(self, files: List[Path]) -> Dict:
        """Format with Pint"""
        cmd = ["vendor/bin/pint"]

        if "pint" in self.config:
            cmd.extend(["--config", self.config["pint"]])

        cmd.extend([str(f) for f in files])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            # Count modified files from output
            modified = result.stdout.count("FIXED")

            return {
                "tool": "Laravel Pint",
                "modified_files": modified,
                "exit_code": result.returncode,
                "output": result.stdout
            }

        except Exception as e:
            return {"modified_files": 0, "errors": [str(e)]}

    def _preview_pint(self, files: List[Path]) -> str:
        """Preview changes with Pint"""
        # Pint doesn't have built-in diff, so we'll show test output
        cmd = ["vendor/bin/pint", "--test", "-v"]

        if "pint" in self.config:
            cmd.extend(["--config", self.config["pint"]])

        cmd.extend([str(f) for f in files])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            return result.stdout

        except:
            return ""

    def _analyze_with_php_cs_fixer(self, files: List[Path]) -> Dict:
        """Analyze with PHP-CS-Fixer (dry-run)"""
        cmd = ["php-cs-fixer", "fix", "--dry-run", "--diff"]

        if "php-cs-fixer" in self.config:
            cmd.extend(["--config", self.config["php-cs-fixer"]])

        cmd.extend([str(f) for f in files])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            # Parse output for issues
            issues = []
            for line in result.stdout.splitlines():
                if line.strip().startswith("---"):
                    # File with issues
                    issues.append({
                        "file": "parsed from output",
                        "severity": "warning",
                        "message": "Formatting required",
                        "category": "formatting"
                    })

            return {
                "tool": "PHP-CS-Fixer",
                "issues": issues,
                "exit_code": result.returncode
            }

        except Exception as e:
            return {"issues": [], "errors": [str(e)]}

    def _format_with_php_cs_fixer(self, files: List[Path]) -> Dict:
        """Format with PHP-CS-Fixer"""
        cmd = ["php-cs-fixer", "fix"]

        if "php-cs-fixer" in self.config:
            cmd.extend(["--config", self.config["php-cs-fixer"]])

        cmd.extend([str(f) for f in files])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            # Count fixed files
            modified = result.stdout.count("Fixed")

            return {
                "tool": "PHP-CS-Fixer",
                "modified_files": modified,
                "exit_code": result.returncode
            }

        except Exception as e:
            return {"modified_files": 0, "errors": [str(e)]}
