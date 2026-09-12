# Chat with LLM

A local chat workspace: FastAPI backend, vanilla HTML/CSS/JavaScript UI, SQLite
session storage. Run it on your machine, then talk to models through NVIDIA NIM
(or another OpenAI-compatible provider).

This file is the path from a fresh clone to a working app. Commands below assume
you are in the **repository root** (`chat-with-llm/`), not inside `app/`.
`uvicorn app.main:app` only works when Python can import the `app` package.

## Prerequisites

Install these before you clone:

| Tool | Why | Check |
|---|---|---|
| **Git** | Clone the repository | `git --version` |
| **Python 3.11 or newer** | Runtime | `python3 --version` |
| **pip** | Installs packages into the venv | `python3 -m pip --version` |
| **A NVIDIA API key** | The default catalog uses NVIDIA NIM | Create one at [build.nvidia.com](https://build.nvidia.com/) |

Optional: `curl` is useful to ping `/api/health`. A current browser is required
to use the UI.

On Debian/Ubuntu if Python is missing:

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip
```

On macOS with Homebrew:

```bash
brew install git python
```

On Windows, install Python 3.11+ from [python.org](https://www.python.org/downloads/)
and tick **Add python.exe to PATH**. Git is at [git-scm.com](https://git-scm.com/).

## 1. Clone the project

```bash
git clone https://github.com/awun0105/chat-with-llm.git
cd chat-with-llm
```

Confirm you see `app/main.py` and `app/requirements.txt`.

## 2. Create and activate a virtual environment

Always use a venv so lab/system Python packages do not mix with this app.

**Linux / macOS (bash or zsh):**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Your prompt should start with `(.venv)`.

**Windows Command Prompt:**

```bat
python -m venv .venv
.venv\Scripts\activate.bat
```

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks the script, run this once in that session, then activate
again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Leave the venv on for the rest of this guide. To leave it later, run `deactivate`.

If `python3 -m venv` fails with `ensurepip is not available` on Ubuntu:

```bash
sudo apt install -y python3-venv
```

## 3. Install Python dependencies

With the venv active, from the repository root:

```bash
python -m pip install --upgrade pip
python -m pip install -r app/requirements.txt
```

This installs FastAPI, Uvicorn, the OpenAI-compatible client, `python-dotenv`,
`tiktoken`, and test extras.

## 4. Configure secrets

```bash
cp app/.env.example app/.env
```

Edit `app/.env` and set at least:

```dotenv
NVIDIA_API_KEY=your-key-here
```

Do not commit `app/.env`. The repo gitignore already excludes it.

The default catalog talks to NVIDIA NIM at `https://integrate.api.nvidia.com/v1`.
The four shipped model slots (`large-model-1`, `large-model-2`, `small-model-1`,
`small-model-2`) all use `NVIDIA_API_KEY`. You can change model IDs in `app/.env`
or `app/models.toml` later; you do not need that to start.

The app also reads a repository-level `.env` if one exists. If the same variable
is set in both files, the repository-level value loaded first takes precedence.
Keep one authoritative copy.

## 5. Run the app

With the venv still active, from the repository root:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

`--reload` restarts the process when Python files change. Omit it if you want a
plain production-style process.

You should see something like:

```text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.

## 6. Confirm it worked

The app is up when all of these are true:

1. The terminal still shows Uvicorn running with no traceback.
2. The browser loads the **withllm** chat UI (sidebar + message box).
3. The sidebar footer says **1 providers ready** (or more, if you added keys).
4. Optional health check:

   ```bash
   curl http://127.0.0.1:8000/api/health
   ```

   Expected: `{"status":"ok","database":".../app/data/chat.db"}`.

Send a short message. A streaming reply means the API key and model catalog are
working. If the model picker shows **NO KEY**, `NVIDIA_API_KEY` is empty or the
process was started before you saved `app/.env` — stop Uvicorn (`Ctrl+C`), fix
the file, activate the venv again if needed, and rerun step 5.

## Everyday restart

After the first setup, each new terminal:

```bash
cd chat-with-llm
source .venv/bin/activate          # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Tests

Tests fake the provider stream. They do not need an API key and do not spend
credits.

```bash
source .venv/bin/activate
python -m pytest app/tests -q
```

## Troubleshooting

| Symptom | What to try |
|---|---|
| `No module named app` | You are not in the repository root. `cd` to `chat-with-llm` (the folder that contains `app/`). |
| `command not found: uvicorn` | The venv is not active, or step 3 was skipped. `source .venv/bin/activate` then reinstall from `app/requirements.txt`. |
| `Address already in use` on port 8000 | Another process owns 8000. Use `--port 8010` and open that URL instead. |
| Sidebar says **Add API keys to start** / **NO KEY** | `app/.env` is missing `NVIDIA_API_KEY`, or Uvicorn was started without that file. Restart after saving. |
| `python3 -m venv` fails | Install the venv package for your OS (`python3-venv` on Ubuntu). |
| PowerShell `cannot be loaded because running scripts is disabled` | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` then activate again. |
| Clone asks for a password | Use the HTTPS URL above, or set up a GitHub SSH key and clone `git@github.com:awun0105/chat-with-llm.git`. |

## Features

- Persistent chat sessions and **New conversation**.
- Streaming replies (SSE), Markdown rendering, copy, and retry.
- Switch models mid-conversation.
- Per-session system instructions.
- API keys stay on the server; the browser only sees whether a provider is configured.

Default NVIDIA NIM slots:

- Large 1: `nvidia/nemotron-3-ultra-550b-a55b`
- Large 2: `openai/gpt-oss-20b`
- Small 1: `nvidia/nemotron-3-super-120b-a12b`
- Small 2: `deepseek-ai/deepseek-v4-flash-0731`

## Architecture

The backend is a ports-and-adapters core, so another project can reuse it
without copying the UI.

| Piece | Pattern | Role |
|---|---|---|
| `ChatService` | Facade | Session, model-switch, streaming, retry |
| `SessionRepository` | Port | Persistence contract |
| `SQLiteSessionRepository` / `InMemorySessionRepository` | Adapter | Swap storage without changing use cases |
| `ChatProvider` + `ProviderRegistry` | Strategy / Registry | Add OpenAI-compatible or custom protocols |
| `ModelCatalog` | Registry | Models and providers come from TOML |
| `TokenCounter` | Strategy | tiktoken, with a heuristic fallback |
| `create_app` / `attach_chat` | Factory | Standalone app or embed in another FastAPI host |
| `StreamEvent` | Domain event | Same stream for SSE, WebSockets, or in-process callers |

### Embed in another FastAPI app

```python
from fastapi import FastAPI
from app import attach_chat, create_app, build_backend, InMemorySessionRepository

app = create_app()

host = FastAPI()
attach_chat(host, prefix="/assistant")

backend = build_backend(repository=InMemorySessionRepository())
backend.service.initialize()
session = backend.service.create_session("Research", "Be concise.")
for event in backend.service.stream_chat(session.id, "Hello"):
    print(event.name, event.payload)
```

Import `create_app`, `attach_chat`, or `ChatService` from the `app` package. Do
not import `app.main`; that module is only the Uvicorn entrypoint.

## Configuration

- `app/.env` — secrets and endpoint overrides.
- `app/models.toml` — provider registry and model catalog.
- Adding a compatible model does not require changing Python or JavaScript.

TOML may use `${NAME}` or `${NAME:-fallback}`.

### Environment variables

| Variable | Purpose |
|---|---|
| `NVIDIA_API_KEY` | Enables the four NVIDIA NIM-hosted slots. |
| `BASE_URL` | NVIDIA NIM-compatible base URL. |
| `BIG_MODEL1` / `BIG_MODEL2` | Full model IDs for the large slots. |
| `LAB_MINI_MODEL1` / `LAB_MINI_MODEL2` | Full model IDs for the small slots. |
| `DEFAULT_CHAT_MODEL` | New-session default: slot ID or full model ID. |
| `MAX_COMPLETION_TOKENS` | Caps each response; default `2048`. |
| `CHAT_DATA_DIR` | Moves the SQLite data directory. |
| `MODELS_CONFIG_PATH` | Selects a different TOML catalog. |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | Direct OpenAI or DeepSeek, if you add those models. |

### Add another model to an existing provider

Append one block to `app/models.toml`. `id` must stay unique because sessions
store it. `model` is the identifier sent to the provider.

```toml
[[models]]
id = "nemotron-nano"
provider = "nvidia_nim"
model = "nvidia/nemotron-3-nano-30b-a3b"
label = "Nemotron 3 Nano"
company = "NVIDIA"
tier = "Small"
estimate_low = 2
estimate_high = 8
color = "#0f766e"
```

### Add OpenAI or DeepSeek (direct APIs)

Put the key in `app/.env`, then add a `[[models]]` row with `provider = "openai"`
or `provider = "deepseek"`. Those provider blocks already exist in `models.toml`.
The OpenAI provider uses `developer` for system instructions and
`max_completion_tokens` for the output cap.

### Add a new OpenAI-compatible provider

```dotenv
ACME_API_KEY=your-key
ACME_BASE_URL=https://api.example.com/v1
```

```toml
[providers.acme]
label = "Acme AI"
base_url = "${ACME_BASE_URL:-https://api.example.com/v1}"
api_key_env = "ACME_API_KEY"
token_parameter = "max_tokens"
system_role = "system"
timeout_seconds = 90
request_options = { temperature = 0.7 }
```

Then add `[[models]]` entries with `provider = "acme"`. A provider that is not
OpenAI Chat Completions needs a small Python adapter in `ProviderRegistry`
before it can be declared in TOML.
