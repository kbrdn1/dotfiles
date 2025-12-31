"""Base formatter abstract class"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Dict, Optional


class BaseFormatter(ABC):
    """Abstract base class for all formatters"""

    def __init__(self, config: Dict, dry_run: bool = True):
        self.config = config
        self.dry_run = dry_run

    @abstractmethod
    def analyze(self, files: List[Path]) -> Dict:
        """
        Analyze files for formatting issues

        Args:
            files: List of file paths

        Returns:
            Dict with issues found
        """
        pass

    @abstractmethod
    def format(self, files: List[Path]) -> Dict:
        """
        Format files (apply fixes)

        Args:
            files: List of file paths

        Returns:
            Dict with results
        """
        pass

    @abstractmethod
    def preview_changes(self, files: List[Path]) -> str:
        """
        Preview formatting changes (diff)

        Args:
            files: List of file paths

        Returns:
            Diff string
        """
        pass

    @abstractmethod
    def get_tool_name(self) -> str:
        """Get formatter tool name"""
        pass

    @abstractmethod
    def check_tool_available(self) -> bool:
        """Check if formatter tool is installed"""
        pass
