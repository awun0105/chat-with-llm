import { IconClose, IconPlus } from "./Icons.jsx";

export function Sidebar({
  open,
  hiddenDesktop,
  sessions,
  currentId,
  providerStatus,
  onClose,
  onNewChat,
  onSelect,
}) {
  return (
    <>
      <aside
        className={[
          "relative z-30 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-line bg-panel px-[22px] pb-5 pt-7",
          "max-[820px]:fixed max-[820px]:inset-y-0 max-[820px]:left-0 max-[820px]:h-dvh max-[820px]:w-[min(320px,88vw)] max-[820px]:shadow-[12px_0_40px_rgb(20_20_18_/_12%)] max-[820px]:transition-transform max-[820px]:duration-[180ms]",
          open
            ? "max-[820px]:visible max-[820px]:pointer-events-auto max-[820px]:translate-x-0"
            : "max-[820px]:invisible max-[820px]:pointer-events-none max-[820px]:-translate-x-[102%]",
          hiddenDesktop ? "hidden max-[820px]:flex" : "",
        ].join(" ")}
        aria-label="Chat sessions"
      >
        <div className="flex items-center justify-between px-1.5 pb-6">
          <a
            href="/"
            className="flex min-w-[200px] items-center gap-2.5 text-[1.15rem] font-bold tracking-[-0.04em] text-ink no-underline"
            aria-label="Chat with LLM home"
          >
            <span className="flex h-[26px] w-[26px] shrink-0 items-end gap-0.5 rounded-lg bg-ink p-[5px]" aria-hidden="true">
              <span className="h-2 w-1 rounded-sm bg-white" />
              <span className="h-[15px] w-1 rounded-sm bg-white" />
              <span className="h-[11px] w-1 rounded-sm bg-white" />
            </span>
            <span>ChatWithLLM</span>
          </a>
          <button
            type="button"
            className="hidden size-[38px] place-items-center rounded-[10px] bg-transparent hover:bg-panel max-[820px]:grid"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <IconClose />
          </button>
        </div>

        <button
          type="button"
          className="flex min-h-[52px] w-full min-w-[200px] shrink-0 cursor-pointer items-center gap-3 rounded-[14px] border border-line-strong bg-white/70 px-3.5 text-[0.95rem] font-semibold transition duration-160 hover:-translate-y-px hover:border-[#c7c8c1] hover:bg-white"
          onClick={onNewChat}
        >
          <IconPlus />
          <span className="whitespace-nowrap">New conversation</span>
          <kbd className="ml-auto shrink-0 font-mono text-[0.72rem] font-normal text-soft">⌘ K</kbd>
        </button>

        <div className="px-2.5 pb-2.5 pt-7 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">
          Recent
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={[
                "my-0.5 w-full min-w-[200px] cursor-pointer rounded-xl border-0 px-[13px] py-3 text-left transition-colors duration-140",
                session.id === currentId
                  ? "bg-white shadow-[0_1px_2px_rgb(20_20_18_/_5%)]"
                  : "bg-transparent hover:bg-white/70",
              ].join(" ")}
              onClick={() => onSelect(session.id)}
            >
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.95rem] font-semibold">
                {session.title}
              </span>
              <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[0.8rem] text-muted">
                {session.preview || "No messages yet"}
              </span>
            </button>
          ))}
        </nav>

        <div className="border-t border-line pt-3">
          <div className="flex min-w-[200px] items-center gap-2 px-2.5 py-1.5 pb-3 text-[0.8rem] whitespace-nowrap text-muted">
            <span
              className={[
                "size-2 shrink-0 rounded-full",
                providerStatus.kind === "ok" && "bg-success shadow-[0_0_0_3px_rgb(31_138_91_/_10%)]",
                providerStatus.kind === "partial" && "bg-[#db9236] shadow-[0_0_0_3px_rgb(219_146_54_/_12%)]",
                providerStatus.kind === "offline" && "bg-danger shadow-[0_0_0_3px_rgb(199_66_66_/_10%)]",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <span>{providerStatus.label}</span>
          </div>
        </div>
      </aside>
      <div
        className={open ? "fixed inset-0 z-[25] hidden bg-[rgb(20_20_18_/_22%)] max-[820px]:block" : "hidden"}
        onClick={onClose}
      />
    </>
  );
}
