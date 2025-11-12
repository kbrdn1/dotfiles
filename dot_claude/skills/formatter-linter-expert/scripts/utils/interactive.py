"""Interactive prompt utility"""

import sys
from typing import List


class InteractivePrompt:
    """Handles interactive user prompts"""

    def prompt_apply_fix(self) -> str:
        """
        Prompt user to apply fix

        Returns:
            'y' (yes), 'n' (no), 's' (skip), 'q' (quit)
        """
        while True:
            response = input("\nApply fixes to this file? [y/n/s(kip)/q(uit)]: ").strip().lower()

            if response in ['y', 'n', 's', 'q']:
                return response

            print("Invalid input. Please enter y, n, s, or q.")

    def confirm(self, message: str) -> bool:
        """
        Simple yes/no confirmation

        Args:
            message: Message to display

        Returns:
            True if yes, False if no
        """
        while True:
            response = input(f"{message} [y/n]: ").strip().lower()

            if response in ['y', 'yes']:
                return True
            elif response in ['n', 'no']:
                return False

            print("Invalid input. Please enter y or n.")

    def select_option(self, message: str, options: List[str]) -> str:
        """
        Select from list of options

        Args:
            message: Message to display
            options: List of option strings

        Returns:
            Selected option
        """
        print(f"\n{message}")

        for i, option in enumerate(options, 1):
            print(f"  {i}. {option}")

        while True:
            try:
                choice = int(input("\nSelect option (number): ").strip())

                if 1 <= choice <= len(options):
                    return options[choice - 1]

                print(f"Invalid choice. Please enter 1-{len(options)}.")

            except ValueError:
                print("Invalid input. Please enter a number.")
