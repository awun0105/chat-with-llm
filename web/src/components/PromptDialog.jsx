import { useRef } from "react";
import { IconClose } from "./Icons.jsx";
import { useDialogFocus } from "../lib/useDialogFocus.js";

export function PromptDialog({ value, defaultValue, onChange, onClose, onSave }) {
  const textareaRef = useRef(null);
  const dialogRef = useDialogFocus({ onClose, initialFocusRef: textareaRef });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgb(25_26_24_/_30%)] backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        ref={dialogRef}
        className="w-[min(620px,calc(100vw-32px))] rounded-[18px] border border-line bg-white p-7 shadow-lift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">Session behavior</span>
            <h2 id="instructions-title" className="mt-1 text-[1.4rem] font-semibold tracking-[-0.04em]">System instructions</h2>
          </div>
          <button type="button" className="grid size-[38px] place-items-center rounded-[10px] bg-transparent hover:bg-panel" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <p className="my-[18px] mb-[22px] text-[0.95rem] leading-[1.6] text-muted">
          Set the role, tone, and boundaries for this conversation. Changes apply to the next message.
        </p>
        <label htmlFor="systemPrompt" className="mb-2 block text-[0.85rem] font-bold">Custom system prompt</label>
        <textarea
          ref={textareaRef}
          id="systemPrompt"
          maxLength={8000}
          rows={10}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-y rounded-xl border border-line-strong p-3.5 text-[0.95rem] leading-[1.65] text-ink outline-none focus:border-[#aca6e2]"
        />
        <div className="mt-2 flex items-center justify-between font-mono text-[0.75rem] text-soft">
          <button type="button" className="cursor-pointer p-0 text-[0.82rem] font-bold text-accent" onClick={() => onChange(defaultValue)}>Use global default</button>
          <span>{value.length.toLocaleString()} / 8,000</span>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button type="button" className="cursor-pointer rounded-[10px] border border-line bg-white px-4 py-2.5 text-[0.88rem] font-bold" onClick={onClose}>Cancel</button>
          <button type="submit" className="cursor-pointer rounded-[10px] bg-ink px-4 py-2.5 text-[0.88rem] font-bold text-white">Save instructions</button>
        </div>
      </form>
    </div>
  );
}
