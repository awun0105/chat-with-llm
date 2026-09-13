from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent

DEFAULT_SYSTEM_PROMPT = (
    "You are a thoughtful, concise AI assistant. Give accurate, practical answers. "
    "State uncertainty clearly and ask a focused question when essential context is missing."
)


@dataclass(frozen=True)
class Settings:
    """Deployment settings for one chat application instance."""

    project_dir: Path
    app_dir: Path
    static_dir: Path
    data_dir: Path
    db_path: Path
    models_config_path: Path
    max_completion_tokens: int = 2048
    default_system_prompt: str = DEFAULT_SYSTEM_PROMPT

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(PROJECT_DIR / ".env")
        load_dotenv(APP_DIR / ".env")

        data_dir = Path(os.getenv("CHAT_DATA_DIR", APP_DIR / "data"))
        configured_catalog = Path(
            os.getenv("MODELS_CONFIG_PATH", APP_DIR / "models.toml")
        )
        if not configured_catalog.is_absolute():
            configured_catalog = PROJECT_DIR / configured_catalog

        return cls(
            project_dir=PROJECT_DIR,
            app_dir=APP_DIR,
            static_dir=PROJECT_DIR / "web" / "dist",
            data_dir=data_dir,
            db_path=data_dir / "chat.db",
            models_config_path=configured_catalog,
            max_completion_tokens=int(os.getenv("MAX_COMPLETION_TOKENS", "2048")),
        )
