"""
Config Finder - Locates configuration files for formatters and linters
"""

from pathlib import Path
from typing import Dict, List, Optional


class ConfigFinder:
    """Finds configuration files for various formatters and linters"""

    # Configuration file patterns by ecosystem
    CONFIG_PATTERNS = {
        "laravel": [
            "pint.json",
            ".php-cs-fixer.php",
            ".php-cs-fixer.dist.php",
            "phpstan.neon",
            "phpstan.neon.dist"
        ],
        "php": [
            ".php-cs-fixer.php",
            ".php-cs-fixer.dist.php",
            "phpstan.neon",
            "phpstan.neon.dist",
            "pint.json"
        ],
        "javascript": [
            ".prettierrc",
            ".prettierrc.json",
            ".prettierrc.js",
            "prettier.config.js",
            ".eslintrc",
            ".eslintrc.json",
            ".eslintrc.js",
            "biome.json",
            "biome.jsonc"
        ],
        "typescript": [
            ".prettierrc",
            ".prettierrc.json",
            ".prettierrc.js",
            "prettier.config.js",
            ".eslintrc",
            ".eslintrc.json",
            ".eslintrc.js",
            "biome.json",
            "biome.jsonc",
            "tsconfig.json"
        ],
        "go": [
            ".golangci.yml",
            ".golangci.yaml",
            "golangci.yml"
        ],
        "rust": [
            "rustfmt.toml",
            ".rustfmt.toml",
            "clippy.toml"
        ],
        "deno": [
            "deno.json",
            "deno.jsonc"
        ]
    }

    def __init__(self, project_root: Path):
        self.project_root = project_root

    def find_for_environment(self, env_name: str) -> Dict[str, str]:
        """
        Find all configuration files for an environment

        Args:
            env_name: Environment name (laravel, typescript, go, etc.)

        Returns:
            Dict mapping config type to file path
        """
        env_name = env_name.lower()

        # Handle environment aliases
        if any(x in env_name for x in ["bun", "node", "react", "vue", "astro", "nuxt"]):
            if "typescript" in env_name or "ts" in env_name:
                env_name = "typescript"
            else:
                env_name = "javascript"

        patterns = self.CONFIG_PATTERNS.get(env_name, [])
        found_configs = {}

        for pattern in patterns:
            config_path = self.project_root / pattern

            if config_path.exists():
                # Determine config type from filename
                config_type = self._classify_config(pattern)
                found_configs[config_type] = str(config_path.relative_to(self.project_root))

        return found_configs

    def find_specific(self, config_name: str) -> Optional[Path]:
        """
        Find a specific configuration file

        Args:
            config_name: Config filename

        Returns:
            Path to config or None
        """
        config_path = self.project_root / config_name

        if config_path.exists():
            return config_path

        # Try searching in common directories
        search_dirs = [
            self.project_root / "config",
            self.project_root / ".config",
            self.project_root
        ]

        for directory in search_dirs:
            candidate = directory / config_name
            if candidate.exists():
                return candidate

        return None

    def _classify_config(self, filename: str) -> str:
        """Classify config file by its purpose"""
        filename_lower = filename.lower()

        if "prettier" in filename_lower:
            return "prettier"
        elif "eslint" in filename_lower:
            return "eslint"
        elif "biome" in filename_lower:
            return "biome"
        elif "pint" in filename_lower:
            return "pint"
        elif "php-cs-fixer" in filename_lower:
            return "php-cs-fixer"
        elif "phpstan" in filename_lower:
            return "phpstan"
        elif "golangci" in filename_lower:
            return "golangci-lint"
        elif "rustfmt" in filename_lower:
            return "rustfmt"
        elif "clippy" in filename_lower:
            return "clippy"
        elif "deno" in filename_lower:
            return "deno"
        elif "tsconfig" in filename_lower:
            return "typescript"
        else:
            return "unknown"

    def get_default_config_path(self, env_name: str, config_type: str) -> Optional[Path]:
        """
        Get path to skill's default configuration

        Args:
            env_name: Environment name
            config_type: Config type (prettier, eslint, etc.)

        Returns:
            Path to default config or None
        """
        # Path to skill's default configs
        skill_root = Path(__file__).parent.parent.parent
        defaults_dir = skill_root / "configs" / "defaults"

        # Map environment to directory
        env_dir_map = {
            "laravel": "php",
            "php": "php",
            "javascript": "js",
            "typescript": "js",
            "bun": "js",
            "node": "js",
            "go": "go",
            "rust": "rust",
            "deno": "deno"
        }

        env_dir = env_dir_map.get(env_name.lower())
        if not env_dir:
            return None

        # Map config type to filename
        config_file_map = {
            "prettier": ".prettierrc",
            "eslint": ".eslintrc.json",
            "biome": "biome.json",
            "pint": "pint.json",
            "php-cs-fixer": ".php-cs-fixer.php",
            "phpstan": "phpstan.neon",
            "golangci-lint": ".golangci.yml",
            "rustfmt": "rustfmt.toml",
            "clippy": "clippy.toml",
            "deno": "deno.json"
        }

        config_file = config_file_map.get(config_type)
        if not config_file:
            return None

        default_path = defaults_dir / env_dir / config_file

        if default_path.exists():
            return default_path

        return None

    def list_all_configs(self) -> List[Dict]:
        """
        List all configuration files found in project

        Returns:
            List of dicts with config metadata
        """
        all_configs = []

        for env_name, patterns in self.CONFIG_PATTERNS.items():
            for pattern in patterns:
                config_path = self.project_root / pattern

                if config_path.exists():
                    all_configs.append({
                        "environment": env_name,
                        "type": self._classify_config(pattern),
                        "path": str(config_path.relative_to(self.project_root)),
                        "absolute_path": str(config_path)
                    })

        return all_configs
