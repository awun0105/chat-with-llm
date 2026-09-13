# React + Tailwind UI (comparison)

This is the same chat as `app/static`, rebuilt with Vite, React, and Tailwind CSS.
The FastAPI backend is unchanged. Use this folder to compare stacks, not to
replace the vanilla UI.

Vanilla UI: http://127.0.0.1:8000  
React UI (dev): http://127.0.0.1:5173

## Prerequisites

- Node.js 20+ (`node -v`)
- The Python app already running (venv, `app/.env`, Uvicorn)

## Dev (side by side)

Terminal 1, from the **repository root**:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd web
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. If Uvicorn is on another port:

```bash
VITE_API_PROXY=http://127.0.0.1:8010 npm run dev
```

Both UIs share sessions, SQLite, and models.

## Serve the built React UI from FastAPI

```bash
cd web
npm run build:fastapi
```

Restart Uvicorn. Then:

- Vanilla: http://127.0.0.1:8000
- React: http://127.0.0.1:8000/react/
