import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.catalog import ModelCatalog
from app.config import APP_DIR, PROJECT_DIR, Settings
from app.domain import StreamEvent
from app.factory import attach_chat, build_backend, create_app
from app.providers import ProviderRegistry
from app.repositories import InMemorySessionRepository


class ScriptedProvider:
    def __init__(self, chunks):
        self.chunks = chunks
        self.calls = []

    def stream(self, model, messages):
        self.calls.append((model, list(messages)))
        if self.chunks and isinstance(self.chunks[0], (list, tuple)):
            yield from self.chunks[min(len(self.calls) - 1, len(self.chunks) - 1)]
        else:
            yield from self.chunks


def make_settings(tmp_path, catalog_path=None):
    return Settings(
        project_dir=PROJECT_DIR,
        app_dir=APP_DIR,
        static_dir=APP_DIR / "static",
        data_dir=tmp_path,
        db_path=tmp_path / "chat.db",
        models_config_path=catalog_path or (APP_DIR / "models.toml"),
    )


def make_client(tmp_path, chunks=("Hello", " from the model.")):
    provider = ScriptedProvider(list(chunks))
    application = create_app(
        settings=make_settings(tmp_path),
        providers=ProviderRegistry({"openai_compatible": provider}),
    )
    return TestClient(application), provider


def create_session(client):
    response = client.post(
        "/api/sessions",
        json={"title": "Test chat", "system_prompt": "Be concise."},
    )
    assert response.status_code == 201
    return response.json()


def test_model_catalog_matches_nvidia_nim_environment(tmp_path):
    client, _ = make_client(tmp_path)
    models = client.get("/api/models").json()
    assert len(models) == 4
    assert {model["provider"] for model in models} == {"NVIDIA NIM"}
    assert {model["company"] for model in models} == {"NVIDIA", "OpenAI", "DeepSeek"}
    assert {model["tier"] for model in models} == {"Large", "Small"}
    assert [model["model"] for model in models] == [
        "nvidia/nemotron-3-ultra-550b-a55b",
        "openai/gpt-oss-20b",
        "nvidia/nemotron-3-super-120b-a12b",
        "deepseek-ai/deepseek-v4-flash-0731",
    ]
    assert all("key_env" not in model and "base_url" not in model for model in models)


def test_create_and_update_session(tmp_path):
    client, _ = make_client(tmp_path)
    session = create_session(client)
    loaded = client.get(f"/api/sessions/{session['id']}").json()
    assert loaded["title"] == "Test chat"
    assert loaded["system_prompt"] == "Be concise."
    assert loaded["messages"] == []

    updated = client.patch(
        f"/api/sessions/{session['id']}",
        json={"system_prompt": "Answer in Vietnamese."},
    ).json()
    assert updated["system_prompt"] == "Answer in Vietnamese."


def test_model_switch_creates_a_timeline_event(tmp_path):
    client, _ = make_client(tmp_path)
    session = create_session(client)
    response = client.post(
        f"/api/sessions/{session['id']}/model",
        json={"model_id": "small-model-2"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["changed"] is True
    assert body["event"]["role"] == "event"
    assert body["event"]["metadata"]["to"] == "DeepSeek V4 Flash"


def test_chat_stream_persists_tokens_and_latency(tmp_path):
    client, provider = make_client(tmp_path)
    session = create_session(client)
    response = client.post(
        f"/api/sessions/{session['id']}/chat",
        json={"message": "Hello"},
    )
    assert response.status_code == 200
    assert "event: token" in response.text
    assert "event: done" in response.text
    assert provider.calls
    assert provider.calls[0][1][0] == {"role": "system", "content": "Be concise."}

    loaded = client.get(f"/api/sessions/{session['id']}").json()
    assistant = loaded["messages"][-1]
    assert assistant["role"] == "assistant"
    assert assistant["content"] == "Hello from the model."
    assert assistant["input_tokens"] > 0
    assert assistant["output_tokens"] > 0
    assert assistant["latency_seconds"] >= 0
    assert isinstance(assistant["metadata"]["ttft_seconds"], float)


def test_retry_replaces_assistant_without_duplicating_user(tmp_path):
    client, provider = make_client(tmp_path, chunks=(["Hello"], ["Again"]))
    session = create_session(client)
    client.post(f"/api/sessions/{session['id']}/chat", json={"message": "Hello"})
    first = client.get(f"/api/sessions/{session['id']}").json()
    assistant_id = first["messages"][-1]["id"]

    response = client.post(
        f"/api/sessions/{session['id']}/retry",
        json={"message_id": assistant_id},
    )
    assert response.status_code == 200
    assert "event: token" in response.text

    loaded = client.get(f"/api/sessions/{session['id']}").json()
    roles = [message["role"] for message in loaded["messages"]]
    assert roles == ["user", "assistant"]
    assert loaded["messages"][0]["content"] == "Hello"
    assert loaded["messages"][-1]["content"] == "Again"
    assert loaded["messages"][-1]["id"] != assistant_id
    assert len(provider.calls) == 2


def test_sse_payload_is_valid_json():
    block = StreamEvent("token", {"text": "xin chào"}).to_sse()
    assert block.startswith("event: token\n")
    payload = block.split("data: ", 1)[1].strip()
    assert json.loads(payload) == {"text": "xin chào"}


def test_catalog_can_add_a_provider_and_models_without_code_changes(tmp_path, monkeypatch):
    monkeypatch.setenv("ACME_URL", "https://api.acme.test/v1")
    catalog = tmp_path / "models.toml"
    catalog.write_text(
        """
default_model = "acme-fast"

[providers.acme]
label = "Acme AI"
base_url = "${ACME_URL}"
api_key_env = "ACME_API_KEY"
token_parameter = "max_tokens"
system_role = "system"
request_options = { temperature = 0.4 }

[[models]]
id = "acme-fast"
provider = "acme"
model = "acme/fast-v1"
company = "Acme"
tier = "Small"
request_options = { top_p = 0.9 }

[[models]]
id = "acme-large"
provider = "acme"
model = "acme/large-v1"
company = "Acme"
tier = "Large"
""",
        encoding="utf-8",
    )

    loaded = ModelCatalog.load(catalog)

    assert list(loaded) == ["acme-fast", "acme-large"]
    assert loaded.default_model_id == "acme-fast"
    assert loaded["acme-fast"].base_url == "https://api.acme.test/v1"
    assert loaded["acme-fast"].request_options == {
        "temperature": 0.4,
        "top_p": 0.9,
    }


def test_catalog_rejects_an_unknown_provider(tmp_path):
    catalog = tmp_path / "invalid.toml"
    catalog.write_text(
        """
[providers.known]
api_key_env = "KNOWN_API_KEY"

[[models]]
id = "broken"
provider = "missing"
model = "missing/model"
""",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="unknown provider"):
        ModelCatalog.load(catalog)


def test_chat_service_works_without_http(tmp_path):
    provider = ScriptedProvider(["Hi"])
    backend = build_backend(
        settings=make_settings(tmp_path),
        repository=InMemorySessionRepository(),
        providers=ProviderRegistry({"openai_compatible": provider}),
    )
    backend.service.initialize()
    session = backend.service.create_session("Offline", "Be brief.")
    events = list(backend.service.stream_chat(session.id, "Ping"))
    names = [event.name for event in events]
    assert names == ["start", "token", "done"]
    stored = backend.service.get_session(session.id)
    assert stored.messages[-1].content == "Hi"


def test_attach_chat_mounts_on_another_fastapi_app(tmp_path):
    host = FastAPI()
    attach_chat(
        host,
        prefix="/assistant",
        settings=make_settings(tmp_path),
        repository=InMemorySessionRepository(),
        providers=ProviderRegistry({"openai_compatible": ScriptedProvider(["ok"])}),
    )
    client = TestClient(host)
    created = client.post(
        "/assistant/api/sessions",
        json={"title": "Hosted", "system_prompt": "Be concise."},
    )
    assert created.status_code == 201
    models = client.get("/assistant/api/models").json()
    assert len(models) == 4
