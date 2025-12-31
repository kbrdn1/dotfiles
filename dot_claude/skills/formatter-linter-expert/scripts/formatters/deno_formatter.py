"""Deno Formatter (deno fmt)"""

from pathlib import Path
from typing import List, Dict
from .base_formatter import BaseFormatter


class DenoFormatter(BaseFormatter):
    """Formatter for Deno using deno fmt"""

    def get_tool_name(self) -> str:
        return "deno fmt"

    def check_tool_available(self) -> bool:
        # TODO: Check deno availability
        return True

    def analyze(self, files: List[Path]) -> Dict:
        # TODO: Implement deno fmt --check
        return {"tool": "deno fmt", "issues": []}

    def format(self, files: List[Path]) -> Dict:
        # TODO: Implement deno fmt
        return {"tool": "deno fmt", "modified_files": 0}

    def preview_changes(self, files: List[Path]) -> str:
        return ""
