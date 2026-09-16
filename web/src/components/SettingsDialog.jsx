import { useRef, useState } from "react";
import { IconClose, IconTrash } from "./Icons.jsx";
import { useDialogFocus } from "../lib/useDialogFocus.js";

import { DEFAULT_PROMPT } from "../lib/api.js";

const TABS = [
  { id: "prompt", label: "Global prompt" },
  { id: "features", label: "Features" },
  { id: "history", label: "History" },
];

export function SettingsDialog({ settings, sessionCount, saving, clearing, blocked, onClose, onSavePrompt, onToggleStarters, onClearAll }) {
  const [tab, setTab] = useState("prompt");
  const [prompt, setPrompt] = useState(settings.default_system_prompt);
  const [confirming, setConfirming] = useState(false);
  const firstTabRef = useRef(null);
  const dialogRef = useDialogFocus({ onClose, initialFocusRef: firstTabRef, closeDisabled: saving || clearing });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(20_20_18_/_28%)] p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !clearing) onClose(); }}>
      <div ref={dialogRef} className="flex max-h-[min(720px,90vh)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_rgb(20_20_18_/_20%)]" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="settings-title" className="m-0 text-lg font-semibold tracking-[-0.02em]">Settings</h2>
          <button type="button" className="grid size-9 place-items-center rounded-lg transition-colors hover:bg-black/5 disabled:opacity-50" onClick={onClose} disabled={saving || clearing} aria-label="Close settings"><IconClose className="size-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] max-[620px]:grid-cols-1 max-[620px]:grid-rows-[auto_minmax(0,1fr)]">
          <nav className="border-r border-line bg-panel/60 p-3 max-[620px]:flex max-[620px]:overflow-x-auto max-[620px]:border-b max-[620px]:border-r-0" aria-label="Settings sections">
            {TABS.map((item, index) => (
              <button ref={index === 0 ? firstTabRef : undefined} key={item.id} type="button" className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold whitespace-nowrap max-[620px]:mb-0 max-[620px]:w-auto ${tab === item.id ? "bg-white shadow-sm" : "text-muted hover:bg-white/70 hover:text-ink"}`} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}>{item.label}</button>
            ))}
          </nav>

          <div className="min-h-0 overflow-y-auto p-6">
            {tab === "prompt" && (
              <form onSubmit={(event) => { event.preventDefault(); onSavePrompt(prompt); }}>
                <h3 className="m-0 text-base font-semibold">Default system prompt</h3>
                <p className="mb-4 mt-1 text-sm leading-6 text-muted">Used when a new conversation is created. Existing conversations keep their own instructions.</p>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={10} maxLength={8000} className="w-full resize-y rounded-xl border border-line-strong p-3.5 text-sm leading-6 outline-none focus:border-accent" />
                <div className="mt-2 flex items-center justify-between font-mono text-[0.75rem] text-soft">
                  <button type="button" className="cursor-pointer p-0 text-[0.82rem] font-bold text-accent" onClick={() => setPrompt(DEFAULT_PROMPT)}>Use global default</button>
                  <span>{prompt.length.toLocaleString()} / 8,000</span>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || !prompt.trim() || prompt.trim() === settings.default_system_prompt}>{saving ? "Saving…" : "Save prompt"}</button>
                </div>
              </form>
            )}

            {tab === "features" && (
              <div>
                <h3 className="m-0 text-base font-semibold">Optional features</h3>
                <p className="mb-4 mt-1 text-sm leading-6 text-muted">Choose which helpers appear in the chat interface.</p>
                <div className="flex items-center gap-4 rounded-xl border border-line p-4">
                  <div className="min-w-0 flex-1"><strong className="block text-sm">Starter prompts</strong><span className="mt-1 block text-sm leading-5 text-muted">Show example questions when a new conversation has no messages.</span></div>
                  <button type="button" role="switch" aria-checked={settings.show_starter_prompts} aria-label="Show starter prompts" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.show_starter_prompts ? "bg-accent" : "bg-line-strong"}`} onClick={() => onToggleStarters(!settings.show_starter_prompts)} disabled={saving}><span className={`absolute left-0 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${settings.show_starter_prompts ? "translate-x-6" : "translate-x-1"}`} /></button>
                </div>
              </div>
            )}

            {tab === "history" && (
              <div>
                <h3 className="m-0 text-base font-semibold">Chat history</h3>
                <p className="mb-4 mt-1 text-sm leading-6 text-muted">Manage conversations stored in the local SQLite database.</p>
                <div className="rounded-xl border border-line p-4">
                  {!confirming ? (
                    <div className="flex items-center gap-4 max-[520px]:items-start max-[520px]:flex-col">
                      <div className="min-w-0 flex-1"><h4 className="m-0 text-[0.96rem] font-semibold">Clear all chat history</h4><p className="mb-0 mt-1 text-sm leading-6 text-muted">Permanently delete {sessionCount} {sessionCount === 1 ? "conversation" : "conversations"} and all messages.</p></div>
                      <button type="button" className="shrink-0 rounded-lg border border-danger/35 px-3.5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/5 disabled:opacity-50" onClick={() => setConfirming(true)} disabled={sessionCount === 0 || blocked}>Clear all</button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-danger/10 text-danger"><IconTrash /></span><div><h4 className="m-0 text-[0.96rem] font-semibold">Delete every conversation?</h4><p className="mb-0 mt-1 text-sm leading-6 text-muted">This cannot be undone. A new empty conversation will be created afterward.</p></div></div>
                      <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-black/5" onClick={() => setConfirming(false)} disabled={clearing}>Cancel</button><button type="button" className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={onClearAll} disabled={clearing}>{clearing ? "Clearing…" : "Clear all chats"}</button></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
