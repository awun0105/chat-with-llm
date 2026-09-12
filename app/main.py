from __future__ import annotations

from app.factory import create_app

# ASGI entrypoint for `uvicorn app.main:app`. Other projects should import
# create_app, attach_chat, or ChatService instead of this module-level app.
app = create_app()
