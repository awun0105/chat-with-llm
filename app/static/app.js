const DEFAULT_PROMPT = "You are a thoughtful, concise AI assistant. Give accurate, practical answers. State uncertainty clearly and ask a focused question when essential context is missing.";

class ApiClient {
  async request(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        message = body.detail || message;
      } catch (_) {
        // Keep the status-based fallback.
      }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  }

  models() { return this.request("/api/models"); }
  sessions() { return this.request("/api/sessions"); }
  session(id) { return this.request(`/api/sessions/${id}`); }
  createSession(payload) {
    return this.request("/api/sessions", { method: "POST", body: JSON.stringify(payload) });
  }
  updateSession(id, payload) {
    return this.request(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
  changeModel(id, modelId) {
    return this.request(`/api/sessions/${id}/model`, {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    });
  }
}

class MarkdownRenderer {
  constructor() {
    if (window.marked?.setOptions) {
      window.marked.setOptions({ gfm: true, breaks: true });
    }
  }

  toHtml(text) {
    if (!text) return "";
    const parsed = window.marked?.parse ? window.marked.parse(text) : this.escape(text).replaceAll("\n", "<br>");
    const clean = window.DOMPurify?.sanitize
      ? window.DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } })
      : parsed;
    return clean;
  }

  renderInto(element, text) {
    element.innerHTML = this.toHtml(text);
    element.querySelectorAll("a[href]").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  escape(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}

class ChatScroller {
  constructor(element, threshold = 120) {
    this.element = element;
    this.threshold = threshold;
    this.stickToBottom = true;
    this.element.addEventListener("scroll", () => this.syncFromUser(), { passive: true });
    this.element.addEventListener("wheel", () => this.syncFromUser(), { passive: true });
    this.element.addEventListener("touchmove", () => this.syncFromUser(), { passive: true });
  }

  distanceFromBottom() {
    const node = this.element;
    return node.scrollHeight - node.scrollTop - node.clientHeight;
  }

  syncFromUser() {
    this.stickToBottom = this.distanceFromBottom() <= this.threshold;
  }

  pin({ force = false } = {}) {
    if (force) this.stickToBottom = true;
    if (!this.stickToBottom) return;
    this.element.scrollTop = this.element.scrollHeight;
  }
}

class ChatApp {
  constructor() {
    this.api = new ApiClient();
    this.state = { models: [], sessions: [], current: null, sending: false };
    this.el = Object.fromEntries([
      "sidebar", "sidebarScrim", "openSidebar", "closeSidebar", "newChatButton",
      "sessionList", "providerStatus", "conversationTitle", "modelTrigger", "modelMenu",
      "modelSigil", "activeModelLabel", "activeModelMeta", "openPromptButton",
      "chatScroll", "welcomeState", "messageList", "composer",
      "messageInput", "sendButton", "latencyHint", "promptDialog", "promptForm",
      "systemPrompt", "promptCount", "resetPrompt", "savePrompt", "toastRegion",
      "messageTemplate",
    ].map((id) => [id, document.getElementById(id)]));
    this.scroller = new ChatScroller(this.el.chatScroll);
    this.markdown = new MarkdownRenderer();
  }

  modelById(id) {
    return this.state.models.find((model) => model.id === id);
  }

  modelInitial(model) {
    return model?.company?.slice(0, 1).toUpperCase() || "M";
  }

  formatSeconds(value) {
    if (value === null || value === undefined) return "—";
    return `${Number(value).toFixed(Number(value) < 10 ? 1 : 0)}s`;
  }

  showToast(message, type = "default") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.el.toastRegion.append(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  closeSidebar() {
    this.el.sidebar.classList.remove("open");
    this.el.sidebarScrim.classList.remove("open");
  }

  closeModelMenu() {
    this.el.modelMenu.hidden = true;
    this.el.modelTrigger.setAttribute("aria-expanded", "false");
  }

  renderSessions() {
    this.el.sessionList.replaceChildren();
    for (const session of this.state.sessions) {
      const button = document.createElement("button");
      button.className = `session-item ${session.id === this.state.current?.id ? "active" : ""}`;
      button.type = "button";
      button.dataset.id = session.id;
      const title = document.createElement("span");
      title.className = "session-title";
      title.textContent = session.title;
      const preview = document.createElement("span");
      preview.className = "session-preview";
      preview.textContent = session.preview || "No messages yet";
      button.append(title, preview);
      button.addEventListener("click", () => this.selectSession(session.id));
      this.el.sessionList.append(button);
    }
  }

  renderProviderStatus() {
    const providers = [...new Set(this.state.models.map((model) => model.provider))];
    const configured = providers.filter((provider) =>
      this.state.models.some((model) => model.provider === provider && model.configured),
    );
    const dot = this.el.providerStatus.querySelector(".status-dot");
    const copy = this.el.providerStatus.querySelector("span:last-child");
    dot.className = "status-dot";
    if (configured.length === providers.length) {
      copy.textContent = `${configured.length} providers ready`;
    } else if (configured.length) {
      dot.classList.add("partial");
      copy.textContent = `${configured.length} of ${providers.length} providers ready`;
    } else {
      dot.classList.add("offline");
      copy.textContent = "Add API keys to start";
    }
  }

  renderModelMenu() {
    this.el.modelMenu.replaceChildren();
    const header = document.createElement("div");
    header.className = "model-menu-header";
    header.textContent = "Switch model";
    this.el.modelMenu.append(header);

    for (const model of this.state.models) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `model-option ${model.id === this.state.current?.active_model ? "active" : ""}`;
      button.dataset.modelId = model.id;

      const sigil = document.createElement("span");
      sigil.className = "model-sigil";
      sigil.style.background = model.color;
      sigil.textContent = this.modelInitial(model);

      const copy = document.createElement("span");
      copy.className = "model-option-copy";
      const name = document.createElement("strong");
      name.textContent = model.label;
      const details = document.createElement("small");
      details.textContent = `${model.company} · ${model.tier} via ${model.provider} · ${model.latency_estimate.low}–${model.latency_estimate.high}s`;
      copy.append(name, details);

      const status = document.createElement("span");
      status.className = `model-option-status ${model.configured ? "" : "missing"}`;
      status.textContent = model.configured ? "READY" : "NO KEY";

      button.append(sigil, copy, status);
      button.addEventListener("click", () => this.switchModel(model.id));
      this.el.modelMenu.append(button);
    }
  }

  renderActiveModel() {
    const model = this.modelById(this.state.current?.active_model);
    if (!model) return;
    this.el.modelSigil.textContent = this.modelInitial(model);
    this.el.modelSigil.style.background = model.color;
    this.el.activeModelLabel.textContent = model.label;
    this.el.activeModelMeta.textContent = `${model.company} · ${model.tier}`;
    this.el.latencyHint.querySelector("span:last-child").textContent =
      `Est. ${model.latency_estimate.low}–${model.latency_estimate.high}s`;
    this.renderModelMenu();
  }

  metric(label, value) {
    const span = document.createElement("span");
    span.textContent = `${label} ${value}`;
    return span;
  }

  renderEvent(message) {
    const article = document.createElement("article");
    article.className = "message event";
    const pill = document.createElement("div");
    pill.className = "event-pill";
    const dot = document.createElement("span");
    dot.className = "event-dot";
    const title = document.createElement("strong");
    title.textContent = message.content;
    const meta = message.metadata || {};
    const detail = document.createElement("span");
    detail.textContent = `previous ${meta.input_tokens || 0} in / ${meta.output_tokens || 0} out · next ~${meta.estimate_low || "—"}–${meta.estimate_high || "—"}s`;
    pill.append(dot, title, detail);
    article.append(pill);
    return article;
  }

  renderMessage(message, { streaming = false } = {}) {
    if (message.role === "event") return this.renderEvent(message);
    const article = this.el.messageTemplate.content.firstElementChild.cloneNode(true);
    article.classList.add(message.role);
    if (streaming) article.classList.add("streaming");
    article.dataset.messageId = message.id || "pending";

    const avatar = article.querySelector(".message-avatar");
    const author = article.querySelector(".message-author");
    const content = article.querySelector(".message-content");
    const metrics = article.querySelector(".message-metrics");
    const model = this.modelById(message.model_id);

    avatar.textContent = message.role === "user" ? "YOU" : this.modelInitial(model);
    if (message.role === "assistant" && model) avatar.style.color = model.color;
    author.textContent = message.role === "user" ? "You" : (model?.label || "Assistant");
    this.setMessageContent(article, message.content || "");
    const retryButton = article.querySelector(".retry-button");
    if (retryButton) {
      retryButton.hidden = message.role !== "assistant";
      retryButton.onclick = () => this.retryMessage(article);
    }

    if (message.role === "assistant" && !streaming && message.input_tokens !== undefined) {
      metrics.append(
        this.metric("IN", message.input_tokens ?? 0),
        this.metric("OUT", message.output_tokens ?? 0),
        this.metric("TIME", this.formatSeconds(message.latency_seconds)),
      );
      if (message.estimated_seconds) metrics.append(this.metric("EST", `~${this.formatSeconds(message.estimated_seconds)}`));
      if (message.metadata?.ttft_seconds !== undefined) metrics.append(this.metric("FIRST", this.formatSeconds(message.metadata.ttft_seconds)));
    }
    return article;
  }

  setMessageContent(article, text) {
    const content = article.querySelector(".message-content");
    const copyButton = article.querySelector(".copy-button");
    this.markdown.renderInto(content, text);
    if (copyButton) {
      copyButton.dataset.text = text;
      copyButton.onclick = () => this.copyMessage(copyButton);
    }
  }

  async copyMessage(button) {
    const text = button.dataset.text || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
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
    const label = button.querySelector("span");
    button.classList.add("copied");
    if (label) label.textContent = "Copied";
    this.showToast("Copied to clipboard");
    setTimeout(() => {
      button.classList.remove("copied");
      if (label) label.textContent = "Copy";
    }, 1600);
  }

  renderConversation() {
    const messages = this.state.current?.messages || [];
    this.el.messageList.replaceChildren(...messages.map((message) => this.renderMessage(message)));
    this.el.welcomeState.hidden = messages.length > 0;
    this.el.conversationTitle.textContent = this.state.current?.title || "New conversation";
    requestAnimationFrame(() => this.scroller.pin({ force: true }));
  }

  async refreshSessions() {
    this.state.sessions = await this.api.sessions();
    this.renderSessions();
  }

  async selectSession(id) {
    if (this.state.sending || this.state.current?.id === id) {
      this.closeSidebar();
      return;
    }
    try {
      this.state.current = await this.api.session(id);
      this.renderSessions();
      this.renderConversation();
      this.renderActiveModel();
      this.closeSidebar();
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  async createSession() {
    if (this.state.sending) return;
    try {
      const session = await this.api.createSession({
        title: "New conversation",
        system_prompt: DEFAULT_PROMPT,
      });
      this.state.current = { ...session, messages: [] };
      await this.refreshSessions();
      this.renderConversation();
      this.renderActiveModel();
      this.closeSidebar();
      this.el.messageInput.focus();
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  async switchModel(modelId) {
    this.closeModelMenu();
    if (!this.state.current || this.state.sending || this.state.current.active_model === modelId) return;
    try {
      const result = await this.api.changeModel(this.state.current.id, modelId);
      this.state.current.active_model = modelId;
      if (result.event) {
        this.state.current.messages.push(result.event);
        this.el.welcomeState.hidden = true;
        this.el.messageList.append(this.renderMessage(result.event));
        this.scroller.pin({ force: true });
      }
      this.renderActiveModel();
      await this.refreshSessions();
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  setSending(value) {
    this.state.sending = value;
    this.el.messageInput.disabled = value;
    this.el.sendButton.disabled = value || !this.el.messageInput.value.trim();
    this.el.modelTrigger.disabled = value;
  }

  resizeComposer() {
    this.el.messageInput.style.height = "auto";
    this.el.messageInput.style.height = `${Math.min(this.el.messageInput.scrollHeight, 200)}px`;
    this.el.sendButton.disabled = this.state.sending || !this.el.messageInput.value.trim();
  }

  parseEventBlock(block) {
    const lines = block.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!data) return null;
    return { event, payload: JSON.parse(data) };
  }

  async consumeSSE(response, handler) {
    if (!response.body) throw new Error("Streaming is not supported by this browser.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replaceAll("\r\n", "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const parsed = this.parseEventBlock(block);
        if (parsed) handler(parsed.event, parsed.payload);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const parsed = this.parseEventBlock(buffer);
      if (parsed) handler(parsed.event, parsed.payload);
    }
  }

  async streamAssistantReply(assistantNode, assistantMessage, url, body) {
    const assistantMetrics = assistantNode.querySelector(".message-metrics");
    let rawReply = "";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || `Chat request failed (${response.status})`);
    }

    let streamError = null;
    await this.consumeSSE(response, (eventName, payload) => {
      if (eventName === "start") {
        assistantMetrics.replaceChildren(
          this.metric("IN", payload.input_tokens),
          this.metric("EST", `${payload.model.latency_estimate.low}–${payload.model.latency_estimate.high}s`),
        );
      } else if (eventName === "token") {
        rawReply += payload.text;
        this.setMessageContent(assistantNode, rawReply);
        this.scroller.pin();
      } else if (eventName === "done") {
        assistantNode.classList.remove("streaming");
        assistantNode.dataset.messageId = payload.assistant_id;
        assistantMetrics.replaceChildren(
          this.metric("IN", payload.input_tokens),
          this.metric("OUT", payload.output_tokens),
          this.metric("TIME", this.formatSeconds(payload.latency_seconds)),
          this.metric("EST", `${payload.estimated_low}–${payload.estimated_high}s`),
          this.metric("FIRST", this.formatSeconds(payload.ttft_seconds)),
        );
        assistantMessage.id = payload.assistant_id;
        Object.assign(assistantMessage, payload, { content: rawReply });
        this.setMessageContent(assistantNode, rawReply);
        this.scroller.pin();
      } else if (eventName === "error") {
        streamError = payload.message;
      }
    });
    if (streamError) throw new Error(streamError);
    return rawReply;
  }

  async sendMessage(event) {
    event?.preventDefault();
    const text = this.el.messageInput.value.trim();
    if (!text || !this.state.current || this.state.sending) return;

    const wasEmpty = !(this.state.current.messages || []).some((message) => message.role === "user");
    const model = this.modelById(this.state.current.active_model);
    if (!model?.configured) this.showToast(`Add ${model?.provider || "provider"} API key to app/.env`, "error");

    const userMessage = { role: "user", content: text, model_id: model.id };
    const assistantMessage = { role: "assistant", content: "", model_id: model.id };
    const userNode = this.renderMessage(userMessage);
    const assistantNode = this.renderMessage(assistantMessage, { streaming: true });

    this.el.welcomeState.hidden = true;
    this.el.messageList.append(userNode, assistantNode);
    this.el.messageInput.value = "";
    this.resizeComposer();
    this.setSending(true);
    this.scroller.pin({ force: true });

    try {
      await this.streamAssistantReply(
        assistantNode,
        assistantMessage,
        `/api/sessions/${this.state.current.id}/chat`,
        { message: text },
      );
      this.state.current.messages.push(userMessage, assistantMessage);
      if (wasEmpty) {
        const title = text.length > 48 ? `${text.slice(0, 47)}…` : text;
        await this.api.updateSession(this.state.current.id, { title });
        this.state.current.title = title;
        this.el.conversationTitle.textContent = title;
      }
      await Promise.all([
        this.refreshSessions(),
        this.api.models().then((models) => { this.state.models = models; this.renderActiveModel(); }),
      ]);
    } catch (error) {
      assistantNode.classList.remove("streaming");
      this.setMessageContent(assistantNode, `Could not complete the response. ${error.message}`);
      assistantNode.querySelector(".message-metrics")?.replaceChildren();
      this.showToast(error.message, "error");
    } finally {
      this.setSending(false);
      this.el.messageInput.focus();
    }
  }

  async retryMessage(article) {
    if (!this.state.current || this.state.sending) return;
    const model = this.modelById(this.state.current.active_model);
    if (!model) return;

    const messageId = article.dataset.messageId;
    const numericId = Number(messageId);
    const messages = this.state.current.messages || [];
    let cut = messages.findIndex((item) => String(item.id) === String(messageId));
    if (cut < 0 && messages.at(-1)?.role === "assistant") cut = messages.length - 1;
    if (cut >= 0) this.state.current.messages = messages.slice(0, cut);

    let node = article;
    while (node) {
      const next = node.nextElementSibling;
      node.remove();
      node = next;
    }

    const assistantMessage = { role: "assistant", content: "", model_id: model.id };
    const assistantNode = this.renderMessage(assistantMessage, { streaming: true });
    this.el.messageList.append(assistantNode);
    this.setSending(true);
    this.scroller.pin({ force: true });

    try {
      const body = Number.isInteger(numericId) && numericId > 0 ? { message_id: numericId } : {};
      await this.streamAssistantReply(
        assistantNode,
        assistantMessage,
        `/api/sessions/${this.state.current.id}/retry`,
        body,
      );
      this.state.current.messages.push(assistantMessage);
      await Promise.all([
        this.refreshSessions(),
        this.api.models().then((models) => { this.state.models = models; this.renderActiveModel(); }),
      ]);
    } catch (error) {
      assistantNode.classList.remove("streaming");
      this.setMessageContent(assistantNode, `Could not complete the response. ${error.message}`);
      assistantNode.querySelector(".message-metrics")?.replaceChildren();
      this.showToast(error.message, "error");
    } finally {
      this.setSending(false);
      this.el.messageInput.focus();
    }
  }

  openPromptDialog() {
    if (!this.state.current) return;
    this.el.systemPrompt.value = this.state.current.system_prompt || DEFAULT_PROMPT;
    this.el.promptCount.textContent = `${this.el.systemPrompt.value.length.toLocaleString()} / 8,000`;
    this.el.promptDialog.showModal();
  }

  async savePrompt(event) {
    event.preventDefault();
    if (!this.state.current) return;
    try {
      const updated = await this.api.updateSession(this.state.current.id, {
        system_prompt: this.el.systemPrompt.value,
      });
      this.state.current.system_prompt = updated.system_prompt;
      this.el.promptDialog.close();
      this.showToast("System instructions saved");
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  bindEvents() {
    this.el.newChatButton.addEventListener("click", () => this.createSession());
    this.el.openSidebar.addEventListener("click", () => {
      this.el.sidebar.classList.add("open");
      this.el.sidebarScrim.classList.add("open");
    });
    this.el.closeSidebar.addEventListener("click", () => this.closeSidebar());
    this.el.sidebarScrim.addEventListener("click", () => this.closeSidebar());
    this.el.modelTrigger.addEventListener("click", () => {
      const willOpen = this.el.modelMenu.hidden;
      this.el.modelMenu.hidden = !willOpen;
      this.el.modelTrigger.setAttribute("aria-expanded", String(willOpen));
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".model-control")) this.closeModelMenu();
    });
    this.el.openPromptButton.addEventListener("click", () => this.openPromptDialog());
    this.el.promptForm.addEventListener("submit", (event) => this.savePrompt(event));
    this.el.resetPrompt.addEventListener("click", () => {
      this.el.systemPrompt.value = DEFAULT_PROMPT;
      this.el.systemPrompt.dispatchEvent(new Event("input"));
    });
    this.el.systemPrompt.addEventListener("input", () => {
      this.el.promptCount.textContent = `${this.el.systemPrompt.value.length.toLocaleString()} / 8,000`;
    });
    this.el.composer.addEventListener("submit", (event) => this.sendMessage(event));
    this.el.messageInput.addEventListener("input", () => this.resizeComposer());
    this.el.messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });
    document.querySelectorAll(".starter").forEach((button) => {
      button.addEventListener("click", () => {
        this.el.messageInput.value = button.dataset.prompt;
        this.resizeComposer();
        this.el.messageInput.focus();
      });
    });
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        this.createSession();
      }
      if (event.key === "Escape") {
        this.closeModelMenu();
        this.closeSidebar();
      }
    });
  }

  async start() {
    this.bindEvents();
    try {
      [this.state.models, this.state.sessions] = await Promise.all([
        this.api.models(),
        this.api.sessions(),
      ]);
      this.renderProviderStatus();
      if (!this.state.sessions.length) {
        await this.createSession();
      } else {
        this.state.current = await this.api.session(this.state.sessions[0].id);
        this.renderSessions();
        this.renderConversation();
        this.renderActiveModel();
      }
    } catch (error) {
      this.showToast(`App failed to initialize: ${error.message}`, "error");
    }
  }
}

new ChatApp().start();
