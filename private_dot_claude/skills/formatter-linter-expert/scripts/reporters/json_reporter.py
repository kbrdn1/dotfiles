"""JSON Report Generator"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict


class JSONReporter:
    """Generates JSON reports for CI/CD integration"""

    def __init__(self, results: Dict):
        self.results = results

    def generate(self, output_path: Path):
        """Generate JSON report"""
        report = self._build_report()

        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)

    def _build_report(self) -> Dict:
        """Build JSON structure"""
        report = {
            "generated_at": datetime.now().isoformat(),
            "project": self.results['project'],
            "environments": self.results.get('environments', []),
            "summary": self.results.get('summary', {}),
            "configurations": self.results.get('configurations', []),
            "issues": self.results.get('issues', []),
            "exit_code": self._determine_exit_code()
        }

        return report

    def _determine_exit_code(self) -> int:
        """Determine appropriate exit code"""
        issues = self.results.get('summary', {}).get('issues', {})

        if issues.get('errors', 0) > 0:
            return 3  # Errors found
        elif issues.get('warnings', 0) > 0:
            return 2  # Warnings found
        elif issues.get('info', 0) > 0:
            return 1  # Info issues found

        return 0  # Success
