import { useEffect, useRef } from "react";
import { IconChevron, IconInstructions, IconSend } from "./Icons.jsx";

function modelInitial(model) {
  return model?.company?.slice(0, 1).toUpperCase() || "M";
}

export function Composer({
  draft,
  setDraft,
  sending,
  models,
  activeModel,
  menuOpen,
  setMenuOpen,
  onSend,
  onSwitchModel,
  onOpenInstructions,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [draft]);

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <footer className="shrink-0 bg-[linear-gradient(to_top,var(--color-paper)_72%,rgb(251_251_248_/_0%))] px-6 pb-5 pt-3 max-[820px]:px-3 max-[820px]:pb-3.5 max-[820px]:pt-2">
      <form
        className="mx-auto w-[min(860px,100%)] rounded-[22px] border border-line-strong bg-white px-[18px] pb-3 pt-3.5 shadow-[0_12px_35px_rgb(35_36_32_/_7%)] transition duration-160 focus-within:border-[#b8b3e8] focus-within:shadow-[0_14px_40px_rgb(57_52_112_/_10%)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          maxLength={32000}
          value={draft}
          disabled={sending}
          placeholder="Message the model…"
          aria-label="Chat message"
          className="block max-h-[200px] w-full resize-none border-0 bg-transparent text-[1.02rem] leading-[1.55] text-ink outline-none placeholder:text-[#a9aba8]"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative" data-model-menu>
              <button
                className="flex max-w-[280px] min-w-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-panel py-1.5 pr-2 pl-1.5 text-left hover:border-line-strong hover:bg-white max-[820px]:max-w-[180px]"
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Switch model"
                disabled={sending}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span
                  className="grid size-[26px] shrink-0 place-items-center rounded-full text-[0.72rem] font-bold text-white"
                  style={{ background: activeModel?.color || "#151718" }}
                >
                  {modelInitial(activeModel)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-bold">
                    {activeModel?.label || "Loading…"}
                  </strong>
                  <small className="mt-px overflow-hidden text-ellipsis whitespace-nowrap text-[0.68rem] text-muted max-[820px]:hidden">
                    {activeModel ? `${activeModel.company} · ${activeModel.tier}` : "Model"}
                  </small>
                </span>
                <IconChevron className="ml-0.5 size-4 text-muted" />
              </button>
              {menuOpen && (
                <div
                  className="absolute bottom-[calc(100%+10px)] left-0 z-40 w-[min(360px,82vw)] rounded-2xl border border-line bg-white p-2 shadow-lift"
                  role="menu"
                >
                  <div className="px-2.5 pb-2.5 pt-2 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted">
                    Switch model
                  </div>
                  {models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      className={`grid w-full cursor-pointer grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border-0 p-2.5 text-left ${
                        model.id === activeModel?.id ? "bg-accent-soft" : "bg-transparent hover:bg-panel"
                      }`}
                      onClick={() => onSwitchModel(model.id)}
                    >
                      <span
                        className="grid size-[34px] place-items-center rounded-[10px] text-[0.72rem] font-bold text-white"
                        style={{ background: model.color }}
                      >
                        {modelInitial(model)}
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-[0.9rem]">{model.label}</strong>
                        <small className="mt-0.5 block text-[0.75rem] text-muted">
                          {model.company} · {model.tier} via {model.provider} · {model.latency_estimate.low}–
                          {model.latency_estimate.high}s
                        </small>
                      </span>
                      <span className={`text-[0.7rem] font-bold ${model.configured ? "text-success" : "text-danger"}`}>
                        {model.configured ? "READY" : "NO KEY"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.82rem] font-semibold text-[#555958] hover:bg-panel"
              type="button"
              title="System instructions"
              onClick={onOpenInstructions}
            >
              <IconInstructions />
              <span className="max-[820px]:hidden">Instructions</span>
            </button>
            <div className="ml-1 flex items-center gap-2 font-mono text-[0.75rem] text-muted max-[820px]:hidden">
              <span className="size-1.5 rounded-full bg-success" />
              <span>
                {activeModel
                  ? `Est. ${activeModel.latency_estimate.low}–${activeModel.latency_estimate.high}s`
                  : "Estimated response —"}
              </span>
            </div>
          </div>
          <button
            className="grid size-10 place-items-center rounded-xl bg-ink text-white transition duration-150 hover:enabled:-translate-y-px disabled:cursor-default disabled:opacity-20"
            type="submit"
            aria-label="Send message"
            disabled={sending || !draft.trim()}
          >
            <IconSend className="size-[18px]" />
          </button>
        </div>
      </form>
      <p className="mt-2.5 text-center text-[0.75rem] text-soft">Models can make mistakes. Verify important information.</p>
    </footer>
  );
}

