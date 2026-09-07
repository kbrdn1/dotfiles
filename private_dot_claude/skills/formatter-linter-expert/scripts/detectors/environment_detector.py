"""
Environment Detector - Identifies project ecosystem(s)
"""

import json
from pathlib import Path
from typing import List, Dict, Optional


class EnvironmentDetector:
    """Detects project ecosystem based on file markers and patterns"""

    # File markers for ecosystem detection
    MARKERS = {
        "laravel": {
            "required": ["composer.json", "artisan"],
            "optional": ["app/Http/Kernel.php", "routes/web.php"],
            "extensions": [".php"],
            "required_tools": ["php", "composer"]
        },
        "php": {
            "required": ["composer.json"],
            "optional": [".php-cs-fixer.php", "phpstan.neon"],
            "extensions": [".php"],
            "required_tools": ["php", "composer"]
        },
        "bun": {
            "required": ["package.json", "bun.lockb"],
            "optional": ["bunfig.toml"],
            "extensions": [".js", ".ts", ".jsx", ".tsx"],
            "required_tools": ["bun"]
        },
        "node": {
            "required": ["package.json"],
            "optional": ["package-lock.json", "yarn.lock"],
            "extensions": [".js", ".ts", ".jsx", ".tsx"],
            "required_tools": ["node", "npm"]
        },
        "go": {
            "required": ["go.mod"],
            "optional": ["go.sum", ".golangci.yml"],
            "extensions": [".go"],
            "required_tools": ["go"]
        },
        "rust": {
            "required": ["Cargo.toml"],
            "optional": ["Cargo.lock", "rustfmt.toml"],
            "extensions": [".rs"],
            "required_tools": ["rust", "cargo"]
        },
        "deno": {
            "required": ["deno.json"],
            "optional": ["deno.jsonc", "deno.lock"],
            "extensions": [".ts", ".tsx", ".js", ".jsx"],
            "required_tools": ["deno"]
        }
    }

    # Framework detection in package.json
    FRAMEWORKS = {
        "react": ["react", "react-dom"],
        "vue": ["vue"],
        "astro": ["astro"],
        "nuxt": ["nuxt"]
    }

    def __init__(self, project_root: Path):
        self.project_root = project_root

    def detect_all(self) -> List[Dict]:
        """
        Detect all ecosystems present in the project

        Returns:
            List of detected environments with metadata
        """
        detected = []

        for env_name, markers in self.MARKERS.items():
            confidence = self._calculate_confidence(markers)

            if confidence > 50:  # Threshold for detection
                env_info = {
                    "name": env_name,
                    "confidence": confidence,
                    "file_extensions": markers["extensions"],
                    "required_tools": markers["required_tools"]
                }

                # Detect framework if JS/TS ecosystem
                if env_name in ["bun", "node"]:
                    framework = self._detect_framework()
                    if framework:
                        env_info["framework"] = framework
                        env_info["name"] = f"{env_name}/{framework}"

                detected.append(env_info)

        # Sort by confidence
        detected.sort(key=lambda x: x["confidence"], reverse=True)

        return detected

    def detect_specific(self, env_name: str) -> List[Dict]:
        """
        Detect specific environment manually specified by user

        Args:
            env_name: Environment name (laravel, typescript, go, etc.)

        Returns:
            List with single environment if valid
        """
        # Normalize name
        env_name = env_name.lower()

        # Map common aliases
        aliases = {
            "typescript": "node",
            "javascript": "node",
            "ts": "node",
            "js": "node",
            "react": "node",
            "vue": "node",
            "nuxt": "node",
            "astro": "node"
        }

        env_name = aliases.get(env_name, env_name)

        if env_name in self.MARKERS:
            markers = self.MARKERS[env_name]
            return [{
                "name": env_name,
                "confidence": 100,  # User-specified = 100% confidence
                "file_extensions": markers["extensions"],
                "required_tools": markers["required_tools"]
            }]

        return []

    def _calculate_confidence(self, markers: Dict) -> int:
        """
        Calculate confidence score for environment detection

        Args:
            markers: Marker dictionary for environment

        Returns:
            Confidence score (0-100)
        """
        score = 0

        # Required files (70% weight)
        required = markers["required"]
        required_found = sum(
            1 for f in required
            if (self.project_root / f).exists()
        )

        if len(required) > 0:
            score += (required_found / len(required)) * 70

        # Optional files (30% weight)
        optional = markers.get("optional", [])
        if optional:
            optional_found = sum(
                1 for f in optional
                if (self.project_root / f).exists()
            )
            score += (optional_found / len(optional)) * 30

        return int(score)

    def _detect_framework(self) -> Optional[str]:
        """
        Detect JavaScript/TypeScript framework from package.json

        Returns:
            Framework name or None
        """
        package_json = self.project_root / "package.json"

        if not package_json.exists():
            return None

        try:
            with open(package_json) as f:
                data = json.load(f)

            dependencies = {
                **data.get("dependencies", {}),
                **data.get("devDependencies", {})
            }

            for framework, packages in self.FRAMEWORKS.items():
                if any(pkg in dependencies for pkg in packages):
                    return framework

        except (json.JSONDecodeError, KeyError):
            pass

        return None

    def is_typescript_project(self) -> bool:
        """Check if project uses TypeScript"""
        markers = [
            self.project_root / "tsconfig.json",
            self.project_root / "package.json"  # Check for typescript dep
        ]

        if markers[0].exists():
            return True

        if markers[1].exists():
            try:
                with open(markers[1]) as f:
                    data = json.load(f)
                    dependencies = {
                        **data.get("dependencies", {}),
                        **data.get("devDependencies", {})
                    }
                    return "typescript" in dependencies
            except:
                pass

        return False
