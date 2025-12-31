"""Console Output Reporter"""

from typing import Dict


class ConsoleReporter:
    """Generates console output"""

    def __init__(self, results: Dict):
        self.results = results

    def print_summary(self):
        """Print summary to console"""
        print("\n" + "="*60)
        print("                    SUMMARY")
        print("="*60 + "\n")

        summary = self.results['summary']

        print(f"📊 Files analyzed:  {summary['files_analyzed']}")
        print(f"✏️  Files modified:  {summary['files_modified']}")

        issues = summary['issues']
        total_issues = sum(issues.values())

        print(f"\n🔍 Issues found:    {total_issues}")
        print(f"   🔴 Errors:       {issues.get('errors', 0)}")
        print(f"   🟡 Warnings:     {issues.get('warnings', 0)}")
        print(f"   🔵 Info:         {issues.get('info', 0)}")

        # Status
        print("\n" + "="*60)

        if issues.get('errors', 0) > 0:
            print("❌ Status: FAILED - Errors found")
        elif issues.get('warnings', 0) > 0:
            print("⚠️  Status: WARNINGS - Review recommended")
        elif total_issues > 0:
            print("ℹ️  Status: INFO - Minor issues detected")
        else:
            print("✅ Status: SUCCESS - No issues found")

        print("="*60 + "\n")
