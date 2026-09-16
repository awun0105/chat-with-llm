import { useState, useEffect, useRef } from "react";
import {
  IconClose,
  IconMore,
  IconPen,
  IconSearch,
  IconSettings,
  IconSidebarClose,
  IconSidebarOpen,
  IconTrash,
  IconPin,
  IconUnpin
} from "./Icons.jsx";

function RailButton({ label, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      className="grid size-10 place-items-center rounded-xl bg-transparent text-ink transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function Sidebar({
  open,
  collapsed,
  sessions,
  currentId,
  providerStatus,
  onClose,
  onNewChat,
  onSelect,
  onManage,
  onSearch,
  onSettings,
  onToggleDesktop,
  onPin,
  busy,
}) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pinnedSessions = sessions.filter((s) => s.pinned);
  const recentSessions = sessions.filter((s) => !s.pinned);

  const renderSessionList = (list) => {
    return list.map((session) => (
      <div
        key={session.id}
        className={[
          "group my-0.5 flex w-full items-center rounded-xl transition-colors duration-140 relative",
          session.id === currentId
            ? "bg-white shadow-[0_1px_2px_rgb(20_20_18_/_5%)]"
            : "bg-transparent hover:bg-white/70",
        ].join(" ")}
      >
        <button type="button" className="min-w-0 flex-1 px-3 py-2.5 text-left" onClick={() => onSelect(session.id)}>
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.92rem] font-semibold">{session.title}</span>
          <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem] text-muted">{session.preview || "No messages yet"}</span>
        </button>
        <button
          type="button"
          className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted opacity-0 transition hover:bg-black/5 hover:text-ink focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 group-hover:opacity-100 max-[820px]:opacity-100"
          onClick={(e) => {
            if (activeDropdown?.id === session.id) {
              setActiveDropdown(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              const isMobile = window.innerWidth <= 820;
              setActiveDropdown({
                id: session.id,
                x: isMobile ? Math.max(10, rect.left - 160) : rect.right + 10,
                y: Math.min(rect.top, window.innerHeight - 150)
              });
            }
          }}
          disabled={busy}
          aria-label={`Options for ${session.title}`}
          title="Options"
        >
          <IconMore />
        </button>
      </div>
    ));
  };

  return (
    <>
      <aside
        className={[
          "relative z-30 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-line bg-panel transition-[width] duration-300 ease-in-out",
          "max-[820px]:fixed max-[820px]:inset-y-0 max-[820px]:left-0 max-[820px]:h-dvh max-[820px]:w-[min(290px,88vw)] max-[820px]:shadow-[12px_0_40px_rgb(20_20_18_/_12%)] max-[820px]:transition-transform max-[820px]:duration-[180ms]",
          open
            ? "max-[820px]:visible max-[820px]:pointer-events-auto max-[820px]:translate-x-0"
            : "max-[820px]:invisible max-[820px]:pointer-events-none max-[820px]:-translate-x-[102%]",
        ].join(" ")}
        aria-label="Chat sessions"
      >
        <div className={collapsed ? "flex h-full flex-col items-center py-5 max-[820px]:hidden" : "hidden"}>
          <div className="flex flex-col items-center gap-1.5">
            <RailButton label="Open sidebar" onClick={onToggleDesktop}>
              <IconSidebarOpen />
            </RailButton>
            <RailButton label="New conversation" onClick={onNewChat} disabled={busy}>
              <IconPen />
            </RailButton>
            <RailButton label="Search chats" onClick={onSearch}>
              <IconSearch />
            </RailButton>
          </div>
          <div className="mt-auto">
            <RailButton label="Settings" onClick={onSettings}>
              <IconSettings />
            </RailButton>
          </div>
        </div>

        <div className={collapsed ? "hidden max-[820px]:flex max-[820px]:h-full max-[820px]:flex-col" : "flex h-full min-h-0 flex-col"}>
          <div className="px-[18px] pt-5">
            <div className="flex items-center justify-between px-1 pb-4">
              <a
                href="/"
                className="flex min-w-0 items-center gap-2.5 text-[1.1rem] font-bold tracking-[-0.04em] text-ink no-underline"
                aria-label="Chat with LLM home"
              >
                <span className="flex size-[26px] shrink-0 items-end gap-0.5 rounded-lg bg-ink p-[5px]" aria-hidden="true">
                  <span className="h-2 w-1 rounded-sm bg-white" />
                  <span className="h-[15px] w-1 rounded-sm bg-white" />
                  <span className="h-[11px] w-1 rounded-sm bg-white" />
                </span>
                <span className="truncate">ChatWithLLM</span>
              </a>
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-transparent transition-colors hover:bg-black/5 max-[820px]:hidden"
                onClick={onToggleDesktop}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <IconSidebarClose />
              </button>
              <button
                type="button"
                className="hidden size-10 shrink-0 place-items-center rounded-xl bg-transparent transition-colors hover:bg-black/5 max-[820px]:grid"
                onClick={onClose}
                aria-label="Close sidebar"
              >
                <IconClose />
              </button>
            </div>

            <button
              type="button"
              className="group mb-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[0.94rem] font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onNewChat}
              disabled={busy}
            >
              <IconPen className="size-[18px] shrink-0" />
              <span className="truncate">New conversation</span>
              <kbd className="ml-auto shrink-0 font-mono text-[0.7rem] font-normal text-muted opacity-0 transition-opacity group-hover:opacity-100">Alt N</kbd>
            </button>
            <button
              type="button"
              className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[0.94rem] font-medium transition-colors hover:bg-black/5"
              onClick={onSearch}
            >
              <IconSearch className="size-[18px] shrink-0" />
              <span className="truncate">Search chats</span>
              <kbd className="ml-auto shrink-0 font-mono text-[0.7rem] font-normal text-muted opacity-0 transition-opacity group-hover:opacity-100">Ctrl K</kbd>
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-[18px]" aria-live="polite">
            {pinnedSessions.length > 0 && (
              <>
                <div className="px-3 pb-2 pt-7 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted">Pinned</div>
                {renderSessionList(pinnedSessions)}
              </>
            )}
            {recentSessions.length > 0 && (
              <>
                <div className="px-3 pb-2 pt-7 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted">Recent</div>
                {renderSessionList(recentSessions)}
              </>
            )}
          </nav>

          <div className="border-t border-line px-[18px] pb-4 pt-2.5">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] font-medium transition-colors hover:bg-black/5"
              onClick={onSettings}
            >
              <IconSettings />
              <span>Settings</span>
            </button>
            <div className="flex items-center gap-2 px-3 pt-2 text-[0.76rem] whitespace-nowrap text-muted">
              <span
                className={[
                  "size-2 shrink-0 rounded-full",
                  providerStatus.kind === "ok" && "bg-success shadow-[0_0_0_3px_rgb(31_138_91_/_10%)]",
                  providerStatus.kind === "partial" && "bg-[#db9236] shadow-[0_0_0_3px_rgb(219_146_54_/_12%)]",
                  providerStatus.kind === "offline" && "bg-danger shadow-[0_0_0_3px_rgb(199_66_66_/_10%)]",
                ].filter(Boolean).join(" ")}
              />
              <span className="truncate">{providerStatus.label}</span>
            </div>
          </div>
        </div>
      </aside>
      <div
        className={open ? "fixed inset-0 z-[25] hidden bg-[rgb(20_20_18_/_22%)] max-[820px]:block" : "hidden"}
        onClick={onClose}
        aria-hidden="true"
      />
      {activeDropdown && (
        <div 
          ref={dropdownRef} 
          className="fixed z-50 w-44 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-[0_10px_40px_rgb(0_0_0_/_10%)] max-[820px]:shadow-[0_4px_16px_rgb(0_0_0_/_10%)]"
          style={{ top: activeDropdown.y, left: activeDropdown.x }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-[0.92rem] hover:bg-black/5"
            onClick={() => { 
              const session = sessions.find(s => s.id === activeDropdown.id);
              setActiveDropdown(null); 
              onManage(session, "rename"); 
            }}
          >
            <IconPen className="size-[17px] text-muted" />
            Rename
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-[0.92rem] hover:bg-black/5"
            onClick={() => { 
              const session = sessions.find(s => s.id === activeDropdown.id);
              setActiveDropdown(null); 
              onPin(session, !session.pinned); 
            }}
          >
            {sessions.find(s => s.id === activeDropdown.id)?.pinned ? (
              <><IconUnpin className="size-[17px] text-muted" /> Unpin chat</>
            ) : (
              <><IconPin className="size-[17px] text-muted" /> Pin chat</>
            )}
          </button>
          <div className="my-1 h-[1px] bg-line/60" />
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-[0.92rem] text-danger hover:bg-danger/5 group"
            onClick={() => { 
              const session = sessions.find(s => s.id === activeDropdown.id);
              setActiveDropdown(null); 
              onManage(session, "delete");
            }}
          >
            <IconTrash className="size-[17px] opacity-70 group-hover:opacity-100" />
            Delete
          </button>
        </div>
      )}
    </>
  );
}
