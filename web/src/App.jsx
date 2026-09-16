/* size-[18px] size-[15px] size-[22px] */ 
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "./components/Composer.jsx";
import { ConversationDialog } from "./components/ConversationDialog.jsx";
import { IconSidebarOpen } from "./components/Icons.jsx";
import { ChatMessage, EventMessage } from "./components/Message.jsx";
import { PromptDialog } from "./components/PromptDialog.jsx";
import { SearchDialog } from "./components/SearchDialog.jsx";
import { SettingsDialog } from "./components/SettingsDialog.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { Toasts } from "./components/Toasts.jsx";
import { DEFAULT_PROMPT, api } from "./lib/api.js";
import { streamChat } from "./lib/sse.js";

const STARTERS = [
  { label: "Learn", title: "Explain a difficult concept", prompt: "Explain a difficult concept to me using a simple analogy." },
  { label: "Plan", title: "Structure a rough idea", prompt: "Help me turn a rough idea into a clear step-by-step plan." },
  { label: "Review", title: "Challenge my thinking", prompt: "Review this idea critically and identify its biggest risks: " },
];

function providerStatusFrom(models) {
  const providers = [...new Set(models.map((model) => model.provider))];
  const configured = providers.filter((provider) =>
    models.some((model) => model.provider === provider && model.configured),
  );
  if (!providers.length) return { kind: "offline", label: "Checking providers…" };
  if (configured.length === providers.length) {
    return {
      kind: "ok",
      label: `${configured.length} ${configured.length === 1 ? "provider" : "providers"} ready`,
    };
  }
  if (configured.length) {
    return { kind: "partial", label: `${configured.length} of ${providers.length} providers ready` };
  }
  return { kind: "offline", label: "Add API keys to start" };
}

export default function App() {
  const [models, setModels] = useState([]);
  const [appSettings, setAppSettings] = useState({
    default_system_prompt: DEFAULT_PROMPT,
    show_starter_prompts: true,
  });
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarDesktopOpen, setSidebarDesktopOpen] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [managedSession, setManagedSession] = useState(null);
  const [managingSession, setManagingSession] = useState(false);
  const [promptValue, setPromptValue] = useState(DEFAULT_PROMPT);
  const [toasts, setToasts] = useState([]);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const toastId = useRef(0);
  const abortRef = useRef(null);

  const activeModel = useMemo(
    () => models.find((model) => model.id === current?.active_model),
    [models, current?.active_model],
  );
  const messages = current?.messages || [];
  const hasMessages = messages.length > 0;

  const toast = useCallback((message, type = "default") => {
    const id = ++toastId.current;
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4200);
  }, []);

  const pin = useCallback((force = false) => {
    if (force) stickToBottom.current = true;
    const node = scrollRef.current;
    if (!node || !stickToBottom.current) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const sync = () => {
      stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 120;
    };
    node.addEventListener("scroll", sync, { passive: true });
    node.addEventListener("wheel", sync, { passive: true });
    return () => {
      node.removeEventListener("scroll", sync);
      node.removeEventListener("wheel", sync);
    };
  }, []);

  useEffect(() => {
    pin(true);
  }, [current?.id, pin]);

  useEffect(() => {
    pin();
  }, [current?.messages, pin]);

  const refreshSessions = useCallback(async () => {
    setSessions(await api.sessions());
  }, []);

  const selectSession = useCallback(
    async (id) => {
      if (sending || current?.id === id) {
        setSidebarOpen(false);
        return;
      }
      try {
        setCurrent(await api.session(id));
        setSidebarOpen(false);
        await refreshSessions();
      } catch (error) {
        toast(error.message, "error");
      }
    },
    [current?.id, refreshSessions, sending, toast],
  );

  const createSession = useCallback(async () => {
    if (sending) return;
    try {
      const session = await api.createSession({
        title: "New conversation",
        system_prompt: appSettings.default_system_prompt,
      });
      setCurrent({ ...session, messages: [] });
      await refreshSessions();
      setSidebarOpen(false);
    } catch (error) {
      toast(error.message, "error");
    }
  }, [appSettings.default_system_prompt, refreshSessions, sending, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nextModels, nextSessions, nextSettings] = await Promise.all([
          api.models(),
          api.sessions(),
          api.settings(),
        ]);
        if (cancelled) return;
        setModels(nextModels);
        setSessions(nextSessions);
        setAppSettings(nextSettings);
        if (!nextSessions.length) {
          const session = await api.createSession({
            title: "New conversation",
            system_prompt: nextSettings.default_system_prompt,
          });
          if (cancelled) return;
          setCurrent({ ...session, messages: [] });
          setSessions(await api.sessions());
        } else {
          setCurrent(await api.session(nextSessions[0].id));
        }
      } catch (error) {
        if (!cancelled) toast(`App failed to initialize: ${error.message}`, "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector('[role="dialog"]')) return;
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.altKey && event.key.toLowerCase() === "n") {
        if (document.querySelector('[role="dialog"]')) return;
        event.preventDefault();
        createSession();
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSidebarOpen(false);
      }
    }
    function onClick(event) {
      if (!event.target.closest("[data-model-menu]")) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.append(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    toast("Copied to clipboard");
  }

  async function switchModel(modelId) {
    setMenuOpen(false);
    if (!current || sending || current.active_model === modelId) return;
    try {
      const result = await api.changeModel(current.id, modelId);
      setCurrent((prev) => {
        if (!prev) return prev;
        const next = { ...prev, active_model: modelId, messages: [...(prev.messages || [])] };
        if (result.event) next.messages.push(result.event);
        return next;
      });
      await refreshSessions();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function streamInto(url, body, signal) {
    let raw = "";
    await streamChat(url, body, (event, payload) => {
      if (event === "start") {
        setCurrent((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          const last = { ...messages.at(-1) };
          last.input_tokens = payload.input_tokens;
          last.estimateRange = `${payload.model.latency_estimate.low}–${payload.model.latency_estimate.high}s`;
          messages[messages.length - 1] = last;
          return { ...prev, messages };
        });
      } else if (event === "token") {
        raw += payload.text;
        const snapshot = raw;
        setCurrent((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          messages[messages.length - 1] = { ...messages.at(-1), content: snapshot };
          return { ...prev, messages };
        });
      } else if (event === "done") {
        setCurrent((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          messages[messages.length - 1] = {
            ...messages.at(-1),
            ...payload,
            id: payload.assistant_id,
            content: raw,
            streaming: false,
            metadata: { ttft_seconds: payload.ttft_seconds },
            estimateRange: `${payload.estimated_low}–${payload.estimated_high}s`,
          };
          return { ...prev, messages };
        });
      }
    }, signal);
    return raw;
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function markStopped() {
    setCurrent((prev) => {
      if (!prev) return prev;
      const messages = [...prev.messages];
      messages[messages.length - 1] = {
        ...messages.at(-1),
        streaming: false,
        metadata: { ...(messages.at(-1)?.metadata || {}), stopped: true },
      };
      return { ...prev, messages };
    });
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !current || sending) return;
    const model = activeModel;
    if (!model?.configured) {
      toast(`Add ${model?.provider || "provider"} API key to .env`, "error");
      return;
    }

    const wasEmpty = !(current.messages || []).some((message) => message.role === "user");
    const userMessage = { role: "user", content: text, model_id: model?.id };
    const assistantMessage = { role: "assistant", content: "", model_id: model?.id, streaming: true };

    setDraft("");
    setSending(true);
    stickToBottom.current = true;
    setCurrent((prev) => ({
      ...prev,
      messages: [...(prev.messages || []), userMessage, assistantMessage],
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamInto(`/api/sessions/${current.id}/chat`, { message: text }, controller.signal);
      if (wasEmpty) {
        const title = text.length > 48 ? `${text.slice(0, 47)}…` : text;
        await api.updateSession(current.id, { title });
        setCurrent((prev) => (prev ? { ...prev, title } : prev));
      }
      const [nextSessions, nextModels] = await Promise.all([api.sessions(), api.models()]);
      setSessions(nextSessions);
      setModels(nextModels);
    } catch (error) {
      if (error.name === "AbortError") {
        markStopped();
        if (wasEmpty) {
          const title = text.length > 48 ? `${text.slice(0, 47)}…` : text;
          await api.updateSession(current.id, { title }).catch(() => null);
          setCurrent((prev) => (prev ? { ...prev, title } : prev));
        }
        toast("Generation stopped");
      } else {
        setCurrent((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          messages[messages.length - 1] = {
            ...messages.at(-1),
            streaming: false,
            content: `Could not complete the response. ${error.message}`,
          };
          return { ...prev, messages };
        });
        toast(error.message, "error");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }

  async function retryMessage(message) {
    if (!current || sending) return;
    if (!activeModel?.configured) {
      toast(`Add ${activeModel?.provider || "provider"} API key to .env`, "error");
      return;
    }
    const numericId = Number(message.id);
    setCurrent((prev) => {
      if (!prev) return prev;
      const list = prev.messages || [];
      let cut = list.findIndex((item) => String(item.id) === String(message.id));
      if (cut < 0 && list.at(-1)?.role === "assistant") cut = list.length - 1;
      const kept = cut >= 0 ? list.slice(0, cut) : list;
      return {
        ...prev,
        messages: [...kept, { role: "assistant", content: "", model_id: activeModel?.id, streaming: true }],
      };
    });
    setSending(true);
    stickToBottom.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const body = Number.isInteger(numericId) && numericId > 0 ? { message_id: numericId } : {};
      await streamInto(`/api/sessions/${current.id}/retry`, body, controller.signal);
      const [nextSessions, nextModels] = await Promise.all([api.sessions(), api.models()]);
      setSessions(nextSessions);
      setModels(nextModels);
    } catch (error) {
      if (error.name === "AbortError") {
        markStopped();
        toast("Generation stopped");
      } else {
        setCurrent((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          messages[messages.length - 1] = {
            ...messages.at(-1),
            streaming: false,
            content: `Could not complete the response. ${error.message}`,
          };
          return { ...prev, messages };
        });
        toast(error.message, "error");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }

  async function savePrompt() {
    if (!current) return;
    try {
      const updated = await api.updateSession(current.id, { system_prompt: promptValue });
      setCurrent((prev) => (prev ? { ...prev, system_prompt: updated.system_prompt } : prev));
      setPromptOpen(false);
      toast("System instructions saved");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function saveGlobalPrompt(value) {
    setSavingSettings(true);
    try {
      const updated = await api.updateSettings({ default_system_prompt: value });
      setAppSettings(updated);
      toast("Global system prompt saved");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function toggleStarterPrompts(enabled) {
    setSavingSettings(true);
    try {
      const updated = await api.updateSettings({ show_starter_prompts: enabled });
      setAppSettings(updated);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function renameConversation(title) {
    if (!managedSession) return;
    setManagingSession(true);
    try {
      await api.updateSession(managedSession.session.id, { title });
      await refreshSessions();
      if (current?.id === managedSession.session.id) {
        setCurrent((prev) => (prev ? { ...prev, title } : prev));
      }
      setManagedSession(null);
    } catch (error) {
      toast(`Rename failed: ${error.message}`, "error");
    } finally {
      setManagingSession(false);
    }
  }

  async function pinConversation(session, pinned) {
    try {
      await api.updateSession(session.id, { pinned });
      await refreshSessions();
    } catch (error) {
      toast(`Pin failed: ${error.message}`, "error");
    }
  }

  async function deleteConversation() {
    if (!managedSession || sending) return;
    const deletingId = managedSession.session.id;
    setManagingSession(true);
    try {
      await api.deleteSession(deletingId);
      let remaining = await api.sessions();
      if (current?.id === deletingId) {
        if (!remaining.length) {
          const created = await api.createSession({
            title: "New conversation",
            system_prompt: appSettings.default_system_prompt,
          });
          setCurrent({ ...created, messages: [] });
          remaining = await api.sessions();
        } else {
          setCurrent(await api.session(remaining[0].id));
        }
      }
      setSessions(remaining);
      setManagedSession(null);
      toast("Conversation deleted");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setManagingSession(false);
    }
  }

  async function clearAllHistory() {
    if (sending || clearingHistory) return;
    setClearingHistory(true);
    try {
      const result = await api.clearSessions();
      const session = await api.createSession({
        title: "New conversation",
        system_prompt: appSettings.default_system_prompt,
      });
      setCurrent({ ...session, messages: [] });
      await refreshSessions();
      setSettingsOpen(false);
      setSidebarOpen(false);
      toast(`${result.deleted} ${result.deleted === 1 ? "conversation" : "conversations"} cleared`);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setClearingHistory(false);
    }
  }

  return (
    <div 
    className={[
      "grid h-dvh min-h-0 overflow-hidden max-[820px]:block transition-[grid-template-columns] duration-300 ease-in-out",
      sidebarDesktopOpen ? "grid-cols-[290px_minmax(0,1fr)]" : "grid-cols-[64px_minmax(0,1fr)]"
    ].join(" ")}
  >
      <Sidebar
        open={sidebarOpen}
        collapsed={!sidebarDesktopOpen}
        onToggleDesktop={() => setSidebarDesktopOpen(!sidebarDesktopOpen)}
        sessions={sessions}
        currentId={current?.id}
        providerStatus={providerStatusFrom(models)}
        onClose={() => setSidebarOpen(false)}
        onNewChat={createSession}
        onSearch={() => {
          setSearchOpen(true);
          setSidebarOpen(false);
        }}
        onSettings={() => {
          setSettingsOpen(true);
          setSidebarOpen(false);
        }}
        onSelect={selectSession}
        onManage={(session, mode) => {
          setManagedSession({ session, mode });
          setSidebarOpen(false);
        }}
        onPin={pinConversation}
        busy={sending || clearingHistory}
      />
      <main className="relative grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[radial-gradient(circle_at_50%_-20%,rgb(101_88_211_/_6%),transparent_36%),var(--color-paper)] max-[820px]:h-dvh">

        <header className="relative z-20 flex min-h-[72px] items-center gap-[18px] border-b border-line/85 bg-paper/87 px-8 backdrop-blur-[18px] max-[820px]:min-h-16 max-[820px]:gap-2.5 max-[820px]:px-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="hidden size-[38px] place-items-center rounded-lg bg-transparent transition-colors hover:bg-black/5 max-[820px]:grid"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <IconSidebarOpen />
            </button>
          </div>
          <div className="mr-auto min-w-0">
            <span className="mb-1 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">
              Conversation
            </span>
            <h1 className="m-0 max-w-[640px] overflow-hidden text-[1.05rem] font-[650] tracking-[-0.02em] text-ellipsis whitespace-nowrap max-[820px]:text-[0.98rem]">
              {current?.title || "New conversation"}
            </h1>
          </div>
        </header>

        <section
          ref={scrollRef}
          className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain [overflow-anchor:none] [touch-action:pan-y]"
          aria-live="polite"
        >
          <div className="mx-auto min-h-full w-[min(860px,calc(100%-48px))] py-10 pb-7 max-[820px]:w-[min(calc(100%-28px),760px)] max-[820px]:pt-6">
            {!hasMessages && (
              <div className="flex min-h-full flex-col items-center justify-center px-0 pt-[5vh] pb-12 text-center max-[820px]:pb-6">
                <div className="mb-6 grid size-16 place-items-center rounded-full border border-line-strong bg-white text-[1.3rem] text-accent shadow-[0_10px_30px_rgb(30_31_28_/_6%)]">
                  ✦
                </div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">A clearer place to think</p>
                <h2 className="my-2.5 text-[clamp(2rem,4vw,2.7rem)] font-medium tracking-[-0.055em]">What can we explore?</h2>
                <p className="m-0 max-w-[540px] text-base leading-[1.7] text-muted">
                  Choose a model, shape its instructions, and start a focused conversation.
                </p>
                {appSettings.show_starter_prompts && (
                  <div className="mt-[42px] grid w-full grid-cols-3 gap-3 max-[820px]:grid-cols-1">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        className="min-h-[108px] cursor-pointer rounded-[14px] border border-line bg-white/62 p-4 text-left transition duration-160 hover:-translate-y-0.5 hover:border-line-strong hover:bg-white max-[820px]:min-h-[76px]"
                        onClick={() => setDraft(starter.prompt)}
                      >
                        <span className="mb-[22px] block text-[0.72rem] font-bold uppercase tracking-[0.1em] text-accent max-[820px]:mb-2.5">{starter.label}</span>
                        <strong className="text-[0.95rem] font-semibold">{starter.title}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="pb-3">
              {messages.map((message, index) =>
                message.role === "event" ? (
                  <EventMessage key={message.id || `event-${index}`} message={message} />
                ) : (
                  <ChatMessage
                    key={message.id || `${message.role}-${index}`}
                    message={message}
                    model={models.find((item) => item.id === message.model_id)}
                    sending={sending}
                    onCopy={copyText}
                    onRetry={retryMessage}
                  />
                ),
              )}
            </div>
          </div>
        </section>

        <div>
          <Composer
            draft={draft}
            setDraft={setDraft}
            sending={sending}
            models={models}
            activeModel={activeModel}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            onSend={sendMessage}
            onStop={stopGeneration}
            onSwitchModel={switchModel}
            onOpenInstructions={() => {
              if (!current) return;
              setPromptValue(current.system_prompt || appSettings.default_system_prompt);
              setPromptOpen(true);
            }}
          />
        </div>
      </main>
      {promptOpen && (
        <PromptDialog
          value={promptValue}
          defaultValue={appSettings.default_system_prompt}
          onChange={setPromptValue}
          onClose={() => setPromptOpen(false)}
          onSave={savePrompt}
        />
      )}
      {searchOpen && (
        <SearchDialog
          recentSessions={sessions}
          onClose={() => setSearchOpen(false)}
          onSelect={async (id) => {
            await selectSession(id);
            setSearchOpen(false);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={appSettings}
          sessionCount={sessions.length}
          saving={savingSettings}
          clearing={clearingHistory}
          blocked={sending}
          onClose={() => setSettingsOpen(false)}
          onSavePrompt={saveGlobalPrompt}
          onToggleStarters={toggleStarterPrompts}
          onClearAll={clearAllHistory}
        />
      )}
      {managedSession && (
        <ConversationDialog
          session={managedSession.session}
          mode={managedSession.mode}
          busy={managingSession}
          onClose={() => setManagedSession(null)}
          onRename={renameConversation}
          onDelete={deleteConversation}
        />
      )}
      <Toasts toasts={toasts} />
    </div>
  );
}
