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


def make_settings(tmp_path, catalog_path=None, static_dir=None):
    return Settings(
        project_dir=PROJECT_DIR,
        app_dir=APP_DIR,
        static_dir=static_dir or (APP_DIR / "static"),
        data_dir=tmp_path,
        db_path=tmp_path / "chat.db",
        models_config_path=catalog_path or (APP_DIR / "models.toml"),
    )


def make_client(tmp_path, chunks=("Hello", " from the model.")):
    provider = ScriptedProvider(list(chunks))
    application = create_app(
        settings=make_settings(tmp_path),
        providers=ProviderRegistry({"openai_compatible": provider}),
        include_ui=False,
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


def test_delete_session_returns_an_empty_204(tmp_path):
    client, _ = make_client(tmp_path)
    session = create_session(client)

    response = client.delete(f"/api/sessions/{session['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/api/sessions/{session['id']}").status_code == 404


def test_search_sessions_matches_titles_and_message_content(tmp_path):
    client, _ = make_client(tmp_path)
    title_match = client.post(
        "/api/sessions",
        json={"title": "KẾ HOẠCH Python", "system_prompt": "Be concise."},
    ).json()
    content_match = create_session(client)
    client.post(
        f"/api/sessions/{content_match['id']}/chat",
        json={"message": "Explain dependency injection"},
    )

    by_title = client.get("/api/sessions/search", params={"q": "kế hoạch"})
    by_content = client.get("/api/sessions/search", params={"q": "dependency"})

    assert by_title.status_code == 200
    assert [session["id"] for session in by_title.json()["items"]] == [title_match["id"]]
    assert by_content.status_code == 200
    assert [session["id"] for session in by_content.json()["items"]] == [content_match["id"]]
    assert "dependency injection" in by_content.json()["items"][0]["preview"]
    assert by_content.json()["total"] == 1


def test_clear_all_sessions_returns_count_and_removes_messages(tmp_path):
    client, _ = make_client(tmp_path)
    first = create_session(client)
    create_session(client)
    client.post(f"/api/sessions/{first['id']}/chat", json={"message": "Keep nothing"})

    response = client.delete("/api/sessions")

    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    assert client.get("/api/sessions").json() == []
    assert client.get("/api/sessions/search", params={"q": "nothing"}).json()["items"] == []


def test_settings_persist_and_supply_the_new_session_default(tmp_path):
    client, _ = make_client(tmp_path)

    updated = client.patch(
        "/api/settings",
        json={
            "default_system_prompt": "Answer as a staff engineer.",
            "show_starter_prompts": False,
        },
    )
    created = client.post(
        "/api/sessions",
        json={"title": "Uses global prompt", "system_prompt": ""},
    )

    assert updated.status_code == 200
    assert updated.json()["show_starter_prompts"] is False
    assert created.json()["system_prompt"] == "Answer as a staff engineer."
    assert client.get("/api/settings").json() == updated.json()


def test_search_sessions_is_paginated(tmp_path):
    client, _ = make_client(tmp_path)
    for index in range(3):
        client.post(
            "/api/sessions",
            json={"title": f"Shared topic {index}", "system_prompt": "Be concise."},
        )

    first_page = client.get(
        "/api/sessions/search", params={"q": "shared", "limit": 2}
    ).json()
    second_page = client.get(
        "/api/sessions/search", params={"q": "shared", "limit": 2, "offset": 2}
    ).json()

    assert first_page["total"] == 3
    assert len(first_page["items"]) == 2
    assert len(second_page["items"]) == 1
    assert not ({item["id"] for item in first_page["items"]} & {second_page["items"][0]["id"]})


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


def test_closing_a_stream_persists_the_partial_response(tmp_path):
    provider = ScriptedProvider(["Partial", " response"])
    backend = build_backend(
        settings=make_settings(tmp_path),
        repository=InMemorySessionRepository(),
        providers=ProviderRegistry({"openai_compatible": provider}),
    )
    backend.service.initialize()
    session = backend.service.create_session("Stopped", "Be brief.")
    events = backend.service.stream_chat(session.id, "Ping")

    assert next(events).name == "start"
    assert next(events).payload == {"text": "Partial"}
    events.close()

    stored = backend.service.get_session(session.id)
    assert stored.messages[-1].content == "Partial"
    assert stored.messages[-1].metadata["stopped"] is True


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


def test_standalone_app_explains_how_to_build_missing_ui(tmp_path):
    with pytest.raises(RuntimeError, match="npm run build:fastapi"):
        create_app(settings=make_settings(tmp_path))
    assert not (tmp_path / "chat.db").exists()


def test_standalone_app_serves_built_ui_without_shadowing_api(tmp_path):
    static_dir = tmp_path / "dist"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<h1>Chat UI</h1>", encoding="utf-8")
    application = create_app(
        settings=make_settings(tmp_path, static_dir=static_dir),
        providers=ProviderRegistry(
            {"openai_compatible": ScriptedProvider(["ok"])}
        ),
    )
    client = TestClient(application)

    assert client.get("/").text == "<h1>Chat UI</h1>"
    assert client.get("/api/health").json()["status"] == "ok"
