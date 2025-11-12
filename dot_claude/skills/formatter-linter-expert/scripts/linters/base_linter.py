"""Base linter abstract class"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Dict


class BaseLinter(ABC):
    """Abstract base class for all linters"""

    def __init__(self, config: Dict):
        self.config = config

    @abstractmethod
    def analyze(self, files: List[Path]) -> Dict:
        """
        Analyze files for linting issues

        Args:
            files: List of file paths

        Returns:
            Dict with issues found
        """
        pass

    @abstractmethod
    def get_tool_name(self) -> str:
        """Get linter tool name"""
        pass

    @abstractmethod
    def check_tool_available(self) -> bool:
        """Check if linter tool is installed"""
        pass
