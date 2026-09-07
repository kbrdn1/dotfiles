"""JavaScript/TypeScript Formatter (Prettier + Biome)"""

import subprocess
from pathlib import Path
from typing import List, Dict
from .base_formatter import BaseFormatter


class JSFormatter(BaseFormatter):
    """Formatter for JS/TS using Prettier or Biome"""

    def get_tool_name(self) -> str:
        if self._check_biome():
            return "Biome"
        elif self._check_prettier():
            return "Prettier"
        return "None"

    def check_tool_available(self) -> bool:
        return self._check_biome() or self._check_prettier()

    def analyze(self, files: List[Path]) -> Dict:
        if self._check_biome():
            return self._analyze_with_biome(files)
        return self._analyze_with_prettier(files)

    def format(self, files: List[Path]) -> Dict:
        if self._check_biome():
            return self._format_with_biome(files)
        return self._format_with_prettier(files)

    def preview_changes(self, files: List[Path]) -> str:
        # TODO: Implement diff preview
        return ""

    def _check_biome(self) -> bool:
        try:
            result = subprocess.run(["biome", "--version"], capture_output=True, timeout=5)
            return result.returncode == 0
        except:
            return False

    def _check_prettier(self) -> bool:
        try:
            result = subprocess.run(["prettier", "--version"], capture_output=True, timeout=5)
            return result.returncode == 0
        except:
            return False

    def _analyze_with_biome(self, files: List[Path]) -> Dict:
        # TODO: Implement biome check logic
        return {"tool": "Biome", "issues": []}

    def _analyze_with_prettier(self, files: List[Path]) -> Dict:
        # TODO: Implement prettier --check logic
        return {"tool": "Prettier", "issues": []}

    def _format_with_biome(self, files: List[Path]) -> Dict:
        # TODO: Implement biome format --write
        return {"tool": "Biome", "modified_files": 0}

    def _format_with_prettier(self, files: List[Path]) -> Dict:
        # TODO: Implement prettier --write
        return {"tool": "Prettier", "modified_files": 0}
