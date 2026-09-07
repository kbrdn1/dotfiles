"""PHP Linter (PHPStan)"""

import subprocess
import json
from pathlib import Path
from typing import List, Dict
from .base_linter import BaseLinter


class PHPLinter(BaseLinter):
    """Linter for PHP using PHPStan"""

    def get_tool_name(self) -> str:
        return "PHPStan"

    def check_tool_available(self) -> bool:
        try:
            result = subprocess.run(
                ["vendor/bin/phpstan", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False

    def analyze(self, files: List[Path]) -> Dict:
        """Analyze PHP files with PHPStan"""
        cmd = ["vendor/bin/phpstan", "analyse", "--error-format=json"]

        # Add config if specified
        if "phpstan" in self.config:
            cmd.extend(["-c", self.config["phpstan"]])

        # Add files
        cmd.extend([str(f) for f in files])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            # Parse JSON output
            try:
                data = json.loads(result.stdout)
                issues = []

                for file, file_errors in data.get("files", {}).items():
                    for error in file_errors.get("messages", []):
                        issues.append({
                            "file": file,
                            "line": error.get("line"),
                            "severity": "error" if error.get("ignorable", False) is False else "warning",
                            "message": error.get("message"),
                            "category": "linting"
                        })

                return {
                    "tool": "PHPStan",
                    "issues": issues,
                    "exit_code": result.returncode
                }

            except json.JSONDecodeError:
                # Fallback to text parsing
                issues = []
                for line in result.stdout.splitlines():
                    if ":" in line and (" error" in line.lower() or " warning" in line.lower()):
                        issues.append({
                            "file": "unknown",
                            "severity": "error",
                            "message": line.strip(),
                            "category": "linting"
                        })

                return {"tool": "PHPStan", "issues": issues}

        except subprocess.TimeoutExpired:
            return {"issues": [], "errors": ["PHPStan timeout"]}
        except Exception as e:
            return {"issues": [], "errors": [str(e)]}
