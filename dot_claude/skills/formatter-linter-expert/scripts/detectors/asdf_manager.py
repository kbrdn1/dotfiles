"""
asdf Manager - Integration with asdf version manager
"""

import subprocess
import re
from pathlib import Path
from typing import Dict, Optional


class AsdfManager:
    """Manages asdf version resolution and validation"""

    def __init__(self, project_root: Path, mode: str = "fallback"):
        """
        Initialize asdf manager

        Args:
            project_root: Project root directory
            mode: Integration mode (strict, fallback, warn, ignore)
        """
        self.project_root = project_root
        self.mode = mode
        self.asdf_available = self._check_asdf_available()
        self.tool_versions = self._parse_tool_versions()

    def _check_asdf_available(self) -> bool:
        """Check if asdf is installed and available"""
        try:
            result = subprocess.run(
                ["asdf", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _parse_tool_versions(self) -> Dict[str, str]:
        """
        Parse .tool-versions file(s) from project root up to $HOME

        Returns:
            Dict mapping tool name to version
        """
        versions = {}
        current_dir = self.project_root

        # Traverse up to home directory
        while current_dir != current_dir.parent:
            tool_versions_file = current_dir / ".tool-versions"

            if tool_versions_file.exists():
                try:
                    with open(tool_versions_file) as f:
                        for line in f:
                            line = line.strip()

                            # Skip comments and empty lines
                            if not line or line.startswith("#"):
                                continue

                            # Parse "tool version" format
                            parts = line.split(maxsplit=1)
                            if len(parts) == 2:
                                tool, version = parts
                                # First occurrence wins (closest to project root)
                                if tool not in versions:
                                    versions[tool] = version

                except IOError:
                    pass

            # Stop at home directory
            if current_dir == Path.home():
                break

            current_dir = current_dir.parent

        return versions

    def get_version(self, tool: str) -> Dict:
        """
        Get version information for a tool

        Args:
            tool: Tool name (php, nodejs, golang, rust, etc.)

        Returns:
            Dict with keys: version, source (asdf/system/not_found), path
        """
        # Mode: ignore asdf completely
        if self.mode == "ignore" or not self.asdf_available:
            return self._get_system_version(tool)

        # Check if tool is in .tool-versions
        if tool in self.tool_versions:
            expected_version = self.tool_versions[tool]

            # Try to get current asdf version
            asdf_version = self._get_asdf_current_version(tool)

            if asdf_version:
                # Check if installed version matches expected
                if asdf_version == expected_version:
                    return {
                        "version": asdf_version,
                        "source": "asdf",
                        "path": self._get_asdf_tool_path(tool),
                        "expected": expected_version,
                        "match": True
                    }
                else:
                    return {
                        "version": asdf_version,
                        "source": "asdf",
                        "path": self._get_asdf_tool_path(tool),
                        "expected": expected_version,
                        "match": False
                    }

        # Fallback to system version
        if self.mode in ["fallback", "warn"]:
            return self._get_system_version(tool)

        # Strict mode: no fallback
        return {
            "version": None,
            "source": "not_found",
            "path": None
        }

    def _get_asdf_current_version(self, tool: str) -> Optional[str]:
        """Get current asdf version for tool using 'asdf current'"""
        try:
            result = subprocess.run(
                ["asdf", "current", tool],
                capture_output=True,
                text=True,
                cwd=self.project_root,
                timeout=5
            )

            if result.returncode == 0:
                # Output format: "golang 1.21.0 /path/.tool-versions"
                match = re.search(r"(\S+)\s+([\d.]+)", result.stdout)
                if match:
                    return match.group(2)

        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        return None

    def _get_asdf_tool_path(self, tool: str) -> Optional[str]:
        """Get installation path for tool using 'asdf where'"""
        try:
            result = subprocess.run(
                ["asdf", "where", tool],
                capture_output=True,
                text=True,
                cwd=self.project_root,
                timeout=5
            )

            if result.returncode == 0:
                return result.stdout.strip()

        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        return None

    def _get_system_version(self, tool: str) -> Dict:
        """Get version from system PATH"""
        # Map tool names to executables
        executable_map = {
            "php": "php",
            "nodejs": "node",
            "node": "node",
            "golang": "go",
            "go": "go",
            "rust": "rustc",
            "python": "python3",
            "ruby": "ruby"
        }

        executable = executable_map.get(tool, tool)

        try:
            # Try to get version
            result = subprocess.run(
                [executable, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                # Extract version number (basic regex)
                version_match = re.search(r"(\d+\.\d+\.\d+)", result.stdout)
                version = version_match.group(1) if version_match else result.stdout.split()[0]

                # Get path
                which_result = subprocess.run(
                    ["which", executable],
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                return {
                    "version": version,
                    "source": "system",
                    "path": which_result.stdout.strip() if which_result.returncode == 0 else None
                }

        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        return {
            "version": None,
            "source": "not_found",
            "path": None
        }

    def list_installed_versions(self, tool: str) -> list:
        """List all installed versions for a tool"""
        if not self.asdf_available:
            return []

        try:
            result = subprocess.run(
                ["asdf", "list", tool],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                # Parse output (one version per line, may have "*" for current)
                versions = []
                for line in result.stdout.splitlines():
                    line = line.strip().lstrip("*").strip()
                    if line:
                        versions.append(line)
                return versions

        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        return []
