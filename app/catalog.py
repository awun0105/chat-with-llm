from __future__ import annotations

import os
import re
import tomllib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterator, Mapping


@dataclass(frozen=True)
class ModelConfig:
    """Immutable model entry shared by the service and provider layers."""

    id: str
    label: str
    company: str
    provider: str
    adapter: str
    tier: str
    model: str
    key_env: str
    base_url: str | None
    token_parameter: str
    system_role: str
    timeout_seconds: float
    request_options: dict
    estimate_low: float
    estimate_high: float
    color: str

    @property
    def configured(self) -> bool:
        return bool(os.getenv(self.key_env))

    def public_dict(self, latency: tuple[float, float] | None = None) -> dict:
        data = asdict(self)
        for private_field in (
            "key_env",
            "base_url",
            "adapter",
            "token_parameter",
            "system_role",
            "timeout_seconds",
            "request_options",
        ):
            data.pop(private_field)
        data["configured"] = self.configured
        low, high = latency or (self.estimate_low, self.estimate_high)
        data["latency_estimate"] = {"low": round(low, 1), "high": round(high, 1)}
        return data


class ModelCatalog(Mapping[str, ModelConfig]):
    """Validated registry of models loaded from a deployment-owned TOML file."""

    def __init__(self, models: dict[str, ModelConfig], default_model_id: str):
        if not models:
            raise ValueError("A model catalog cannot be empty")
        if default_model_id not in models:
            raise ValueError("The default model must exist in the catalog")
        self._models = dict(models)
        self.default_model_id = default_model_id

    def __getitem__(self, model_id: str) -> ModelConfig:
        return self._models[model_id]

    def __iter__(self) -> Iterator[str]:
        return iter(self._models)

    def __len__(self) -> int:
        return len(self._models)

    @classmethod
    def load(cls, path: Path) -> "ModelCatalog":
        models, default_model_id = load_model_catalog(path)
        return cls(models, default_model_id)


def model_company(model_name: str) -> str:
    organization = model_name.split("/", 1)[0].lower() if "/" in model_name else ""
    return {
        "nvidia": "NVIDIA",
        "openai": "OpenAI",
        "deepseek-ai": "DeepSeek",
        "deepseek": "DeepSeek",
        "qwen": "Qwen",
        "moonshotai": "Moonshot AI",
    }.get(organization, organization.replace("-", " ").title() or "Community")


def model_label(model_name: str) -> str:
    known_labels = {
        "nvidia/nemotron-3-ultra-550b-a55b": "Nemotron 3 Ultra 550B",
        "openai/gpt-oss-20b": "GPT-OSS 20B",
        "nvidia/nemotron-3-super-120b-a12b": "Nemotron 3 Super 120B",
        "deepseek-ai/deepseek-v4-flash-0731": "DeepSeek V4 Flash",
    }
    if model_name in known_labels:
        return known_labels[model_name]
    words = model_name.rsplit("/", 1)[-1].replace("_", "-").split("-")
    return " ".join(
        word.upper() if any(char.isdigit() for char in word) else word.title()
        for word in words
    )


ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?}")


def expand_environment(value):
    if isinstance(value, str):
        return ENV_PATTERN.sub(
            lambda match: os.getenv(match.group(1), match.group(2) or ""), value
        )
    if isinstance(value, dict):
        return {key: expand_environment(item) for key, item in value.items()}
    if isinstance(value, list):
        return [expand_environment(item) for item in value]
    return value


def load_model_catalog(path: Path) -> tuple[dict[str, ModelConfig], str]:
    try:
        with path.open("rb") as config_file:
            raw = tomllib.load(config_file)
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise RuntimeError(f"Cannot load model catalog {path}: {error}") from error

    provider_rows = raw.get("providers", {})
    model_rows = raw.get("models", [])
    if not provider_rows or not model_rows:
        raise RuntimeError("Model catalog requires at least one provider and one model")

    providers: dict[str, dict] = {}
    for provider_id, provider_row in provider_rows.items():
        provider = expand_environment(provider_row)
        key_env = str(provider.get("api_key_env", "")).strip()
        if not key_env:
            raise RuntimeError(f"Provider {provider_id!r} is missing api_key_env")
        token_parameter = provider.get("token_parameter", "max_tokens")
        if token_parameter not in {"max_tokens", "max_completion_tokens"}:
            raise RuntimeError(
                f"Provider {provider_id!r} has unsupported token_parameter "
                f"{token_parameter!r}"
            )
        providers[provider_id] = {
            "label": provider.get("label", provider_id.replace("_", " ").title()),
            "adapter": provider.get("adapter", "openai_compatible"),
            "base_url": provider.get("base_url") or None,
            "key_env": key_env,
            "token_parameter": token_parameter,
            "system_role": provider.get("system_role", "system"),
            "timeout_seconds": float(provider.get("timeout_seconds", 90)),
            "request_options": provider.get("request_options", {}),
        }

    models: dict[str, ModelConfig] = {}
    for model_row in model_rows:
        row = expand_environment(model_row)
        model_id = str(row.get("id", "")).strip()
        provider_id = str(row.get("provider", "")).strip()
        model_name = str(row.get("model", "")).strip()
        if not model_id or not model_name:
            raise RuntimeError("Every model requires non-empty id and model values")
        if model_id in models:
            raise RuntimeError(f"Duplicate model id {model_id!r}")
        if provider_id not in providers:
            raise RuntimeError(
                f"Model {model_id!r} references unknown provider {provider_id!r}"
            )
        provider = providers[provider_id]
        models[model_id] = ModelConfig(
            id=model_id,
            label=row.get("label") or model_label(model_name),
            company=row.get("company") or model_company(model_name),
            provider=provider["label"],
            adapter=provider["adapter"],
            tier=row.get("tier", "General"),
            model=model_name,
            key_env=provider["key_env"],
            base_url=provider["base_url"],
            token_parameter=provider["token_parameter"],
            system_role=provider["system_role"],
            timeout_seconds=provider["timeout_seconds"],
            request_options={
                **provider["request_options"],
                **row.get("request_options", {}),
            },
            estimate_low=float(row.get("estimate_low", 3)),
            estimate_high=float(row.get("estimate_high", 15)),
            color=row.get("color", "#374151"),
        )

    configured_default = str(expand_environment(raw.get("default_model", ""))).strip()
    if configured_default in models:
        default_model_id = configured_default
    else:
        matching_model = next(
            (item.id for item in models.values() if item.model == configured_default),
            None,
        )
        default_model_id = matching_model or next(iter(models))
    return models, default_model_id
