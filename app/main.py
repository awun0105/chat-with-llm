from __future__ import annotations

import os
from app.factory import create_app

# ASGI entrypoint for `uvicorn app.main:app`. Other projects should import
# create_app, attach_chat, or ChatService instead of this module-level app.
include_ui = os.getenv("CHAT_INCLUDE_UI", "true").lower() == "true"
app = create_app(include_ui=include_ui)
