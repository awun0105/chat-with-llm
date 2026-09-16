import { useRef, useState } from "react";
import { IconClose, IconTrash } from "./Icons.jsx";
import { useDialogFocus } from "../lib/useDialogFocus.js";

export function ConversationDialog({ session, mode, busy, onClose, onRename, onDelete }) {
  const isNew = session.title === "New conversation";
  const [title, setTitle] = useState(isNew ? "" : session.title);
  const inputRef = useRef(null);
  const dialogRef = useDialogFocus({ onClose, initialFocusRef: inputRef, closeDisabled: busy });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgb(20_20_18_/_28%)] p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div ref={dialogRef} className="w-full max-w-[500px] rounded-2xl border border-line bg-white p-6 shadow-[0_24px_80px_rgb(20_20_18_/_20%)]" role="dialog" aria-modal="true" aria-labelledby="conversation-dialog-title">
        <div className="flex items-center justify-between">
          <h2 id="conversation-dialog-title" className="m-0 text-lg font-semibold">
            {mode === "rename" ? "Rename conversation" : "Delete conversation"}
          </h2>
          <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-panel" onClick={onClose} disabled={busy} aria-label="Close"><IconClose className="size-5" /></button>
        </div>

        {mode === "rename" ? (
          <form className="mt-6" onSubmit={(event) => { event.preventDefault(); onRename(title); }}>
            <label htmlFor="conversation-title" className="mb-2 block text-sm font-semibold">Title</label>
            <div className="flex gap-2 max-[520px]:flex-col">
              <input ref={inputRef} id="conversation-title" placeholder="Enter new name" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent" />
              <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !title.trim() || title.trim() === session.title}>{busy ? "Saving…" : "Rename"}</button>
            </div>
          </form>
        ) : (
          <div className="mt-6">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/10 text-danger"><IconTrash /></span>
              <div>
                <h3 className="m-0 text-base font-semibold">Delete “{session.title}”?</h3>
                <p className="mb-0 mt-1 text-sm leading-6 text-muted">This conversation and all of its messages will be permanently deleted.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-panel" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={onDelete} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
