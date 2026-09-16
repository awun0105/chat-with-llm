# Chat with LLM

Ứng dụng chat local sử dụng FastAPI, React, SQLite và NVIDIA NIM.

## Prerequisites

- Git
- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 20.19+
- NVIDIA API key từ [build.nvidia.com](https://build.nvidia.com/)

## Cài đặt và chạy

```bash
git clone https://github.com/awun0105/chat-with-llm.git
cd chat-with-llm
uv sync
cd web && npm ci && npm run build && cd ..
cp .env.example .env
```

Mở `.env` và thêm API key:

```dotenv
NVIDIA_API_KEY=nvapi-your-key-here
```

Chạy ứng dụng:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765
```

Truy cập [http://127.0.0.1:8765](http://127.0.0.1:8765).

Khi phát triển frontend và backend cùng lúc:

```bash
make dev
```

Sau đó mở [http://127.0.0.1:5173](http://127.0.0.1:5173).
