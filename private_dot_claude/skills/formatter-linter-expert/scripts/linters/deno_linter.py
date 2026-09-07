"""Deno Linter (deno lint)"""

from pathlib import Path
from typing import List, Dict
from .base_linter import BaseLinter


class DenoLinter(BaseLinter):
    """Linter for Deno using deno lint"""

    def get_tool_name(self) -> str:
        return "deno lint"

    def check_tool_available(self) -> bool:
        # TODO: Check deno availability
        return True

    def analyze(self, files: List[Path]) -> Dict:
        # TODO: Implement deno lint
        return {"tool": "deno lint", "issues": []}
