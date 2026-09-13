/* size-[18px] size-[15px] size-[22px] */ 
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "./components/Composer.jsx";
import { IconMenu } from "./components/Icons.jsx";
import { ChatMessage, EventMessage } from "./components/Message.jsx";
import { PromptDialog } from "./components/PromptDialog.jsx";
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
    return { kind: "ok", label: `${configured.length} providers ready` };
  }
  if (configured.length) {
    return { kind: "partial", label: `${configured.length} of ${providers.length} providers ready` };
  }
  return { kind: "offline", label: "Add API keys to start" };
}

export default function App() {
  const [models, setModels] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState(DEFAULT_PROMPT);
  const [toasts, setToasts] = useState([]);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const toastId = useRef(0);

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
  }, [messages, pin]);

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
        system_prompt: DEFAULT_PROMPT,
      });
      setCurrent({ ...session, messages: [] });
      await refreshSessions();
      setSidebarOpen(false);
    } catch (error) {
      toast(error.message, "error");
    }
  }, [refreshSessions, sending, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nextModels, nextSessions] = await Promise.all([api.models(), api.sessions()]);
        if (cancelled) return;
        setModels(nextModels);
        setSessions(nextSessions);
        if (!nextSessions.length) {
          const session = await api.createSession({
            title: "New conversation",
            system_prompt: DEFAULT_PROMPT,
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
        event.preventDefault();
        createSession();
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSidebarOpen(false);
        setPromptOpen(false);
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
  }, [createSession]);

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

  async function streamInto(url, body, assistantSeed) {
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
        Object.assign(assistantSeed, payload, { content: raw, streaming: false });
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
    });
    return raw;
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !current || sending) return;
    const model = activeModel;
    if (!model?.configured) toast(`Add ${model?.provider || "provider"} API key to app/.env`, "error");

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

    try {
      await streamInto(`/api/sessions/${current.id}/chat`, { message: text }, assistantMessage);
      if (wasEmpty) {
        const title = text.length > 48 ? `${text.slice(0, 47)}…` : text;
        await api.updateSession(current.id, { title });
        setCurrent((prev) => (prev ? { ...prev, title } : prev));
      }
      const [nextSessions, nextModels] = await Promise.all([api.sessions(), api.models()]);
      setSessions(nextSessions);
      setModels(nextModels);
    } catch (error) {
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
    } finally {
      setSending(false);
    }
  }

  async function retryMessage(message) {
    if (!current || sending) return;
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
    try {
      const body = Number.isInteger(numericId) && numericId > 0 ? { message_id: numericId } : {};
      await streamInto(`/api/sessions/${current.id}/retry`, body, {});
      const [nextSessions, nextModels] = await Promise.all([api.sessions(), api.models()]);
      setSessions(nextSessions);
      setModels(nextModels);
    } catch (error) {
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
    } finally {
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

  return (
    <div className="grid h-dvh min-h-0 grid-cols-[320px_minmax(0,1fr)] overflow-hidden max-[820px]:block">
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        currentId={current?.id}
        providerStatus={providerStatusFrom(models)}
        onClose={() => setSidebarOpen(false)}
        onNewChat={createSession}
        onSelect={selectSession}
      />
      <main className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[radial-gradient(circle_at_50%_-20%,rgb(101_88_211_/_6%),transparent_36%),var(--color-paper)] max-[820px]:h-dvh">
        <header className="relative z-20 flex min-h-[72px] items-center gap-[18px] border-b border-line/85 bg-paper/87 px-8 backdrop-blur-[18px] max-[820px]:min-h-16 max-[820px]:gap-2.5 max-[820px]:px-4">
          <button
            type="button"
            className="hidden size-[38px] place-items-center rounded-[10px] bg-transparent hover:bg-panel max-[820px]:grid"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <IconMenu />
          </button>
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
                <div className="mt-[42px] grid w-full grid-cols-3 gap-3 max-[820px]:grid-cols-1">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      className="min-h-[108px] cursor-pointer rounded-[14px] border border-line bg-white/62 p-4 text-left transition duration-160 hover:-translate-y-0.5 hover:border-line-strong hover:bg-white max-[820px]:min-h-[76px]"
                      onClick={() => setDraft(starter.prompt)}
                    >
                      <span className="mb-[22px] block text-[0.72rem] font-bold uppercase tracking-[0.1em] text-accent max-[820px]:mb-2.5">
                        {starter.label}
                      </span>
                      <strong className="text-[0.95rem] font-semibold">{starter.title}</strong>
                    </button>
                  ))}
                </div>
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
            onSwitchModel={switchModel}
            onOpenInstructions={() => {
              if (!current) return;
              setPromptValue(current.system_prompt || DEFAULT_PROMPT);
              setPromptOpen(true);
            }}
          />
        </div>
      </main>
      <PromptDialog
        open={promptOpen}
        value={promptValue}
        onChange={setPromptValue}
        onClose={() => setPromptOpen(false)}
        onSave={savePrompt}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}
