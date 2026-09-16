from __future__ import annotations

import json
import re
import sqlite3
import time
import uuid
from copy import deepcopy
from pathlib import Path
from typing import Protocol

from app.config import DEFAULT_SYSTEM_PROMPT
from app.domain import ChatMessage, ChatSession


class SessionNotFoundError(LookupError):
    pass


class SessionRepository(Protocol):
    """Persistence port used by the chat service."""

    @property
    def location(self) -> str: ...

    def initialize(self, model_ids: tuple[str, ...], default_model_id: str) -> None: ...
    def list_sessions(self, user_id: str = "default", ) -> list[ChatSession]: ...
    def search_sessions(self, query: str, user_id: str = "default", 
        limit: int = 20, offset: int = 0
    ) -> tuple[list[ChatSession], int]: ...
    def get_session(self, session_id: str, *, include_messages: bool = False) -> ChatSession: ...
    def create_session(self, title: str, system_prompt: str, model_id: str, user_id: str = "default") -> ChatSession: ...
    def update_session(
        self, session_id: str, *, title: str | None = None, system_prompt: str | None = None
    ) -> ChatSession: ...
    def delete_session(self, session_id: str) -> None: ...
    def clear_sessions(self, user_id: str = "default") -> int: ...
    def get_settings(self) -> dict[str, str]: ...
    def update_settings(self, values: dict[str, str]) -> dict[str, str]: ...
    def recent_latencies(self, model_id: str, limit: int = 8) -> list[float]: ...
    def change_model(
        self, session_id: str, model_id: str, content: str, metadata: dict
    ) -> ChatMessage: ...
    def last_assistant_tokens(self, session_id: str) -> tuple[int, int]: ...
    def add_user_message(
        self, session_id: str, content: str, model_id: str, history_limit: int = 30
    ) -> tuple[int, list[dict]]: ...
    def add_assistant_message(
        self,
        session_id: str,
        content: str,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        latency_seconds: float,
        estimated_seconds: float,
        metadata: dict,
    ) -> int: ...
    def prepare_retry(
        self, session_id: str, assistant_id: int | None = None, history_limit: int = 30
    ) -> tuple[int, list[dict]]: ...


class SQLiteSessionRepository:
    """SQLite adapter implementing the session persistence port."""

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)

    @property
    def location(self) -> str:
        return str(self.db_path)

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @staticmethod
    def _message(row: sqlite3.Row) -> ChatMessage:
        return ChatMessage.from_mapping(dict(row))

    @staticmethod
    def _session(row: sqlite3.Row, messages: list[ChatMessage] | None = None) -> ChatSession:
        return ChatSession.from_mapping(dict(row), messages=messages)

    def initialize(self, model_ids: tuple[str, ...], default_model_id: str) -> None:
        with self._connect() as db:
            db.executescript(
                """
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    active_model TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    pinned INTEGER NOT NULL DEFAULT 0,
                    user_id TEXT NOT NULL DEFAULT 'default'
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    model_id TEXT,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    latency_seconds REAL,
                    estimated_seconds REAL,
                    metadata TEXT,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_messages_session
                ON messages(session_id, id);
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts
                USING fts5(session_id UNINDEXED, title, tokenize='unicode61 remove_diacritics 2');
                CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
                USING fts5(message_id UNINDEXED, session_id UNINDEXED, content,
                           tokenize='unicode61 remove_diacritics 2');
                CREATE TRIGGER IF NOT EXISTS sessions_fts_insert AFTER INSERT ON sessions BEGIN
                    INSERT INTO sessions_fts(session_id, title) VALUES (new.id, new.title);
                END;
                CREATE TRIGGER IF NOT EXISTS sessions_fts_update AFTER UPDATE OF title ON sessions BEGIN
                    DELETE FROM sessions_fts WHERE session_id = old.id;
                    INSERT INTO sessions_fts(session_id, title) VALUES (new.id, new.title);
                END;
                CREATE TRIGGER IF NOT EXISTS sessions_fts_delete AFTER DELETE ON sessions BEGIN
                    DELETE FROM sessions_fts WHERE session_id = old.id;
                END;
                CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages
                WHEN new.role IN ('user', 'assistant') BEGIN
                    INSERT INTO messages_fts(message_id, session_id, content)
                    VALUES (new.id, new.session_id, new.content);
                END;
                CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages
                WHEN old.role IN ('user', 'assistant') BEGIN
                    DELETE FROM messages_fts WHERE message_id = old.id;
                END;
                """
            )
            # Add pinned column to existing DBs
            try:
                db.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'")
            except sqlite3.OperationalError:
                pass
            
            try:
                db.execute("ALTER TABLE sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
            except sqlite3.OperationalError:
                pass
            db.execute(
                "INSERT OR IGNORE INTO app_settings(key, value) VALUES (?, ?)",
                ("default_system_prompt", DEFAULT_SYSTEM_PROMPT),
            )
            db.execute(
                "INSERT OR IGNORE INTO app_settings(key, value) VALUES (?, ?)",
                ("show_starter_prompts", "true"),
            )
            if db.execute("SELECT COUNT(*) FROM sessions_fts").fetchone()[0] == 0:
                db.execute(
                    "INSERT INTO sessions_fts(session_id, title) SELECT id, title FROM sessions"
                )
            if db.execute("SELECT COUNT(*) FROM messages_fts").fetchone()[0] == 0:
                db.execute(
                    """
                    INSERT INTO messages_fts(message_id, session_id, content)
                    SELECT id, session_id, content FROM messages
                    WHERE role IN ('user', 'assistant')
                    """
                )
            placeholders = ", ".join("?" for _ in model_ids)
            db.execute(
                f"UPDATE sessions SET active_model = ? "
                f"WHERE active_model NOT IN ({placeholders})",
                (default_model_id, *model_ids),
            )

    def list_sessions(self, user_id: str = "default") -> list[ChatSession]:
        with self._connect() as db:
            rows = db.execute(
                """
                SELECT s.*,
                       (SELECT content FROM messages m WHERE m.session_id = s.id
                        AND m.role IN ('user', 'assistant')
                        ORDER BY m.id DESC LIMIT 1) AS preview
                FROM sessions s 
                WHERE s.user_id = ?
                ORDER BY s.pinned DESC, s.updated_at DESC
                """,
                (user_id,)
            ).fetchall()
        return [self._session(row) for row in rows]

    @staticmethod
    def _fts_query(query: str) -> str:
        tokens = re.findall(r"\w+", query, flags=re.UNICODE)
        return " AND ".join(
            f'"{token.replace(chr(34), chr(34) * 2)}"*' for token in tokens
        )

    def search_sessions(self, query: str, user_id: str = "default", 
        limit: int = 20, offset: int = 0
    ) -> tuple[list[ChatSession], int]:
        match_query = self._fts_query(query)
        if not match_query:
            return [], 0
        with self._connect() as db:
            session_rows = db.execute(
                """
                WITH hits AS (
                    SELECT session_id FROM sessions_fts WHERE sessions_fts MATCH ?
                    UNION
                    SELECT session_id FROM messages_fts WHERE messages_fts MATCH ?
                )
                SELECT s.* FROM sessions s
                JOIN hits ON hits.session_id = s.id
                WHERE s.user_id = ?
                ORDER BY s.pinned DESC, s.updated_at DESC
                LIMIT ? OFFSET ?
                """,
                (match_query, match_query, user_id, limit, offset),
            ).fetchall()
            total = db.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT session_id FROM sessions_fts WHERE sessions_fts MATCH ?
                    UNION
                    SELECT session_id FROM messages_fts WHERE messages_fts MATCH ?
                ) hits
                JOIN sessions s ON s.id = hits.session_id
                WHERE s.user_id = ?
                """,
                (match_query, match_query, user_id),
            ).fetchone()[0]
            session_ids = [row["id"] for row in session_rows]
            if not session_ids:
                return [], int(total)
            placeholders = ", ".join("?" for _ in session_ids)
            message_rows = db.execute(
                f"""
                SELECT session_id, content FROM messages
                WHERE role IN ('user', 'assistant')
                  AND session_id IN ({placeholders})
                ORDER BY id
                """,
                session_ids,
            ).fetchall()

        messages_by_session: dict[str, list[str]] = {}
        for message in message_rows:
            messages_by_session.setdefault(message["session_id"], []).append(message["content"])

        needle = query.casefold()
        matches = []
        for row in session_rows:
            messages = messages_by_session.get(row["id"], [])
            matching_message = next(
                (content for content in reversed(messages) if needle in content.casefold()),
                None,
            )
            values = dict(row)
            values["preview"] = matching_message or (messages[-1] if messages else None)
            matches.append(self._session(values))
        return matches, int(total)

    def get_session(self, session_id: str, *, include_messages: bool = False) -> ChatSession:
        with self._connect() as db:
            row = db.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is None:
                raise SessionNotFoundError(session_id)
            messages = None
            if include_messages:
                message_rows = db.execute(
                    "SELECT * FROM messages WHERE session_id = ? ORDER BY id",
                    (session_id,),
                ).fetchall()
                messages = [self._message(message) for message in message_rows]
        return self._session(row, messages=messages)

    def create_session(self, title: str, system_prompt: str, model_id: str, user_id: str = "default") -> ChatSession:
        now = time.time()
        session_id = uuid.uuid4().hex
        with self._connect() as db:
            db.execute(
                "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (session_id, title, system_prompt, model_id, now, now, 0, user_id),
            )
        return self.get_session(session_id)

    def update_session(
        self,
        session_id: str,
        *,
        title: str | None = None,
        system_prompt: str | None = None,
        pinned: bool | None = None,
    ) -> ChatSession:
        session = self.get_session(session_id)
        next_title = session.title if title is None else title
        next_prompt = session.system_prompt if system_prompt is None else system_prompt
        next_pinned = int(session.pinned if pinned is None else pinned)
        with self._connect() as db:
            db.execute(
                "UPDATE sessions SET title = ?, system_prompt = ?, pinned = ?, updated_at = ? "
                "WHERE id = ?",
                (next_title, next_prompt, next_pinned, time.time(), session_id),
            )
        return self.get_session(session_id)

    def delete_session(self, session_id: str) -> None:
        self.get_session(session_id)
        with self._connect() as db:
            db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    def clear_sessions(self, user_id: str = "default") -> int:
        with self._connect() as db:
            count = db.execute("SELECT COUNT(*) FROM sessions WHERE user_id = ?", (user_id,)).fetchone()[0]
            db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        return int(count)

    def get_settings(self) -> dict[str, str]:
        with self._connect() as db:
            rows = db.execute("SELECT key, value FROM app_settings").fetchall()
        return {row["key"]: row["value"] for row in rows}

    def update_settings(self, values: dict[str, str]) -> dict[str, str]:
        with self._connect() as db:
            db.executemany(
                """
                INSERT INTO app_settings(key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                values.items(),
            )
        return self.get_settings()

    def recent_latencies(self, model_id: str, limit: int = 8) -> list[float]:
        with self._connect() as db:
            rows = db.execute(
                """
                SELECT latency_seconds FROM messages
                WHERE role = 'assistant' AND model_id = ?
                  AND latency_seconds IS NOT NULL
                ORDER BY id DESC LIMIT ?
                """,
                (model_id, limit),
            ).fetchall()
        return [float(row[0]) for row in rows]

    def change_model(
        self, session_id: str, model_id: str, content: str, metadata: dict
    ) -> ChatMessage:
        now = time.time()
        with self._connect() as db:
            cursor = db.execute(
                """
                INSERT INTO messages
                (session_id, role, content, model_id, metadata, created_at)
                VALUES (?, 'event', ?, ?, ?, ?)
                """,
                (session_id, content, model_id, json.dumps(metadata), now),
            )
            db.execute(
                "UPDATE sessions SET active_model = ?, updated_at = ? WHERE id = ?",
                (model_id, now, session_id),
            )
            row = db.execute(
                "SELECT * FROM messages WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        return self._message(row)

    def last_assistant_tokens(self, session_id: str) -> tuple[int, int]:
        with self._connect() as db:
            row = db.execute(
                """
                SELECT input_tokens, output_tokens FROM messages
                WHERE session_id = ? AND role = 'assistant'
                ORDER BY id DESC LIMIT 1
                """,
                (session_id,),
            ).fetchone()
        if row is None:
            return 0, 0
        return row["input_tokens"] or 0, row["output_tokens"] or 0

    def add_user_message(
        self, session_id: str, content: str, model_id: str, history_limit: int = 30
    ) -> tuple[int, list[dict]]:
        now = time.time()
        with self._connect() as db:
            cursor = db.execute(
                """
                INSERT INTO messages (session_id, role, content, model_id, created_at)
                VALUES (?, 'user', ?, ?, ?)
                """,
                (session_id, content, model_id, now),
            )
            rows = db.execute(
                """
                SELECT role, content FROM messages
                WHERE session_id = ? AND role IN ('user', 'assistant')
                ORDER BY id DESC LIMIT ?
                """,
                (session_id, history_limit),
            ).fetchall()
            db.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id),
            )
        return cursor.lastrowid, [dict(row) for row in reversed(rows)]

    def add_assistant_message(
        self,
        session_id: str,
        content: str,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        latency_seconds: float,
        estimated_seconds: float,
        metadata: dict,
    ) -> int:
        now = time.time()
        with self._connect() as db:
            cursor = db.execute(
                """
                INSERT INTO messages
                (session_id, role, content, model_id, input_tokens, output_tokens,
                 latency_seconds, estimated_seconds, metadata, created_at)
                VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    content,
                    model_id,
                    input_tokens,
                    output_tokens,
                    latency_seconds,
                    estimated_seconds,
                    json.dumps(metadata),
                    now,
                ),
            )
            db.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id),
            )
        return cursor.lastrowid

    def prepare_retry(
        self, session_id: str, assistant_id: int | None = None, history_limit: int = 30
    ) -> tuple[int, list[dict]]:
        session = self.get_session(session_id, include_messages=True)
        messages = session.messages or []
        target = None
        if assistant_id is not None:
            target = next(
                (item for item in messages if item.id == assistant_id and item.role == "assistant"),
                None,
            )
            if target is None:
                raise SessionNotFoundError(str(assistant_id))
        else:
            target = next((item for item in reversed(messages) if item.role == "assistant"), None)

        user = None
        if target is not None:
            for item in messages:
                if item.id == target.id:
                    break
                if item.role == "user":
                    user = item
            cut_id = target.id
        else:
            user = next((item for item in reversed(messages) if item.role == "user"), None)
            cut_id = (user.id + 1) if user and user.id is not None else None

        if user is None or user.id is None:
            raise SessionNotFoundError(session_id)

        with self._connect() as db:
            if cut_id is not None:
                db.execute(
                    "DELETE FROM messages WHERE session_id = ? AND id >= ?",
                    (session_id, cut_id),
                )
            db.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (time.time(), session_id),
            )
            rows = db.execute(
                """
                SELECT role, content FROM messages
                WHERE session_id = ? AND role IN ('user', 'assistant')
                ORDER BY id DESC LIMIT ?
                """,
                (session_id, history_limit),
            ).fetchall()
        return user.id, [dict(row) for row in reversed(rows)]


class InMemorySessionRepository:
    """Process-local adapter for tests and hosts that do not want SQLite."""

    def __init__(self):
        self._sessions: dict[str, ChatSession] = {}
        self._messages: dict[str, list[ChatMessage]] = {}
        self._next_id = 1
        self._default_model_id = ""
        self._settings = {
            "default_system_prompt": DEFAULT_SYSTEM_PROMPT,
            "show_starter_prompts": "true",
        }

    @property
    def location(self) -> str:
        return "memory"

    def initialize(self, model_ids: tuple[str, ...], default_model_id: str) -> None:
        self._default_model_id = default_model_id
        for session in self._sessions.values():
            if session.active_model not in model_ids:
                session.active_model = default_model_id

    def list_sessions(self, user_id: str = "default") -> list[ChatSession]:
        sessions = [s for s in self._sessions.values() if s.user_id == user_id]
        sessions = sorted(sessions, key=lambda item: (item.pinned, item.updated_at), reverse=True)
        result = []
        for session in sessions:
            preview = next(
                (
                    message.content
                    for message in reversed(self._messages.get(session.id, []))
                    if message.role in {"user", "assistant"}
                ),
                None,
            )
            result.append(
                ChatSession(
                    id=session.id,
                    title=session.title,
                    system_prompt=session.system_prompt,
                    active_model=session.active_model,
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                    preview=preview,
                    pinned=session.pinned,
                    user_id=session.user_id,
                )
            )
        return result

    def search_sessions(self, query: str, user_id: str = "default", 
        limit: int = 20, offset: int = 0
    ) -> tuple[list[ChatSession], int]:
        needle = query.casefold()
        matches = []
        for session in self.list_sessions(user_id):
            messages = self._messages.get(session.id, [])
            matching_message = next(
                (
                    message.content
                    for message in reversed(messages)
                    if message.role in {"user", "assistant"}
                    and needle in message.content.casefold()
                ),
                None,
            )
            if needle not in session.title.casefold() and matching_message is None:
                continue
            if matching_message is not None:
                session.preview = matching_message
            matches.append(session)
        return matches[offset : offset + limit], len(matches)

    def get_session(self, session_id: str, *, include_messages: bool = False) -> ChatSession:
        if session_id not in self._sessions:
            raise SessionNotFoundError(session_id)
        session = self._sessions[session_id]
        if include_messages:
            session.messages = list(self._messages.get(session_id, []))
        return session

    def create_session(self, title: str, system_prompt: str, model_id: str, user_id: str = "default") -> ChatSession:
        now = time.time()
        session = ChatSession(
            id=uuid.uuid4().hex,
            title=title,
            system_prompt=system_prompt,
            active_model=model_id,
            created_at=now,
            updated_at=now,
            user_id=user_id,
        )
        self._sessions[session.id] = session
        self._messages[session.id] = []
        return session

    def update_session(
        self, session_id: str, *, title: str | None = None, system_prompt: str | None = None, pinned: bool | None = None
    ) -> ChatSession:
        stored = self.get_session(session_id)
        stored.title = stored.title if title is None else title
        stored.system_prompt = stored.system_prompt if system_prompt is None else system_prompt
        stored.pinned = stored.pinned if pinned is None else pinned
        stored.updated_at = time.time()
        return stored

    def delete_session(self, session_id: str) -> None:
        self.get_session(session_id)
        self._sessions.pop(session_id, None)
        self._messages.pop(session_id, None)

    def clear_sessions(self, user_id: str = "default") -> int:
        count = len(self._sessions)
        self._sessions.clear()
        self._messages.clear()
        return count

    def get_settings(self) -> dict[str, str]:
        return dict(self._settings)

    def update_settings(self, values: dict[str, str]) -> dict[str, str]:
        self._settings.update(values)
        return self.get_settings()

    def recent_latencies(self, model_id: str, limit: int = 8) -> list[float]:
        values = []
        for messages in self._messages.values():
            for message in messages:
                if (
                    message.role == "assistant"
                    and message.model_id == model_id
                    and message.latency_seconds is not None
                ):
                    values.append((message.id or 0, float(message.latency_seconds)))
        values.sort(key=lambda item: item[0], reverse=True)
        return [latency for _, latency in values[:limit]]

    def change_model(
        self, session_id: str, model_id: str, content: str, metadata: dict
    ) -> ChatMessage:
        session = self._sessions[self.get_session(session_id).id]
        message = ChatMessage(
            id=self._next_id,
            session_id=session_id,
            role="event",
            content=content,
            model_id=model_id,
            metadata=deepcopy(metadata),
            created_at=time.time(),
        )
        self._next_id += 1
        self._messages[session_id].append(message)
        session.active_model = model_id
        session.updated_at = message.created_at or time.time()
        return deepcopy(message)

    def last_assistant_tokens(self, session_id: str) -> tuple[int, int]:
        self.get_session(session_id)
        for message in reversed(self._messages.get(session_id, [])):
            if message.role == "assistant":
                return message.input_tokens or 0, message.output_tokens or 0
        return 0, 0

    def add_user_message(
        self, session_id: str, content: str, model_id: str, history_limit: int = 30
    ) -> tuple[int, list[dict]]:
        session = self._sessions[self.get_session(session_id).id]
        message = ChatMessage(
            id=self._next_id,
            session_id=session_id,
            role="user",
            content=content,
            model_id=model_id,
            created_at=time.time(),
        )
        self._next_id += 1
        self._messages[session_id].append(message)
        session.updated_at = message.created_at or time.time()
        history = [
            item.as_provider_turn()
            for item in self._messages[session_id]
            if item.role in {"user", "assistant"}
        ][-history_limit:]
        return message.id or 0, history

    def add_assistant_message(
        self,
        session_id: str,
        content: str,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        latency_seconds: float,
        estimated_seconds: float,
        metadata: dict,
    ) -> int:
        session = self._sessions[self.get_session(session_id).id]
        message = ChatMessage(
            id=self._next_id,
            session_id=session_id,
            role="assistant",
            content=content,
            model_id=model_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_seconds=latency_seconds,
            estimated_seconds=estimated_seconds,
            metadata=deepcopy(metadata),
            created_at=time.time(),
        )
        self._next_id += 1
        self._messages[session_id].append(message)
        session.updated_at = message.created_at or time.time()
        return message.id or 0

    def prepare_retry(
        self, session_id: str, assistant_id: int | None = None, history_limit: int = 30
    ) -> tuple[int, list[dict]]:
        session = self.get_session(session_id, include_messages=True)
        messages = session.messages or []
        target = None
        if assistant_id is not None:
            target = next(
                (item for item in messages if item.id == assistant_id and item.role == "assistant"),
                None,
            )
            if target is None:
                raise SessionNotFoundError(str(assistant_id))
        else:
            target = next((item for item in reversed(messages) if item.role == "assistant"), None)

        user = None
        if target is not None:
            kept = []
            for item in messages:
                if item.id == target.id:
                    break
                kept.append(item)
                if item.role == "user":
                    user = item
            self._messages[session_id] = kept
        else:
            user = next((item for item in reversed(messages) if item.role == "user"), None)
            if user is not None:
                index = next(i for i, item in enumerate(messages) if item.id == user.id)
                self._messages[session_id] = messages[: index + 1]

        if user is None or user.id is None:
            raise SessionNotFoundError(session_id)

        stored = self._sessions[session_id]
        stored.updated_at = time.time()
        history = [
            item.as_provider_turn()
            for item in self._messages[session_id]
            if item.role in {"user", "assistant"}
        ][-history_limit:]
        return user.id, history
