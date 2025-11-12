"""File scanning utility"""

from pathlib import Path
from typing import List, Optional


class FileScanner:
    """Scans project for files matching criteria"""

    def __init__(self, project_root: Path, exclude_patterns: List[str] = None):
        self.project_root = project_root
        self.exclude_patterns = exclude_patterns or [
            "node_modules",
            "vendor",
            "dist",
            "build",
            ".git",
            "__pycache__",
            ".next",
            ".nuxt",
            "target"
        ]

    def scan(
        self,
        scope: Optional[str] = None,
        extensions: List[str] = None
    ) -> List[Path]:
        """
        Scan for files

        Args:
            scope: Specific file/directory to limit scan
            extensions: List of extensions to include (e.g., [".php", ".js"])

        Returns:
            List of file paths
        """
        if scope:
            scope_path = self.project_root / scope

            if scope_path.is_file():
                return [scope_path] if self._should_include(scope_path, extensions) else []

            if scope_path.is_dir():
                return self._scan_directory(scope_path, extensions)

            return []

        # Scan entire project
        return self._scan_directory(self.project_root, extensions)

    def _scan_directory(self, directory: Path, extensions: List[str] = None) -> List[Path]:
        """Recursively scan directory"""
        files = []

        try:
            for item in directory.rglob("*"):
                if item.is_file() and self._should_include(item, extensions):
                    if not self._is_excluded(item):
                        files.append(item)

        except PermissionError:
            pass  # Skip directories we can't access

        return files

    def _should_include(self, file_path: Path, extensions: List[str] = None) -> bool:
        """Check if file should be included"""
        if not extensions:
            return True

        return file_path.suffix in extensions

    def _is_excluded(self, file_path: Path) -> bool:
        """Check if file matches exclusion patterns"""
        path_str = str(file_path)

        for pattern in self.exclude_patterns:
            if pattern in path_str:
                return True

        return False
