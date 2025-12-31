"""Command execution utility"""

import subprocess
from typing import Dict, List, Optional


class CommandRunner:
    """Executes external commands safely"""

    @staticmethod
    def run(
        command: List[str],
        cwd: Optional[str] = None,
        timeout: int = 120,
        capture_output: bool = True
    ) -> Dict:
        """
        Execute a command

        Args:
            command: Command and arguments as list
            cwd: Working directory
            timeout: Timeout in seconds
            capture_output: Whether to capture stdout/stderr

        Returns:
            Dict with returncode, stdout, stderr
        """
        try:
            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                cwd=cwd,
                timeout=timeout
            )

            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "stdout": result.stdout if capture_output else "",
                "stderr": result.stderr if capture_output else ""
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s"
            }

        except FileNotFoundError:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": f"Command not found: {command[0]}"
            }

        except Exception as e:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": str(e)
            }
