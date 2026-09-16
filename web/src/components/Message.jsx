import { useState } from "react";
import { renderMarkdown } from "../lib/markdown.js";
import { IconCopy, IconRetry } from "./Icons.jsx";

function formatSeconds(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(Number(value) < 10 ? 1 : 0)}s`;
}

function modelInitial(model) {
  return model?.company?.slice(0, 1).toUpperCase() || "M";
}

export function EventMessage({ message }) {
  const meta = message.metadata || {};
  return (
    <article className="my-7 block">
      <div className="mx-auto flex w-fit max-w-full items-center gap-2.5 rounded-full border border-line bg-white/65 px-3.5 py-2 font-mono text-[0.75rem] text-muted">
        <span className="size-1.5 rounded-full bg-accent" />
        <strong className="font-medium text-ink">{message.content}</strong>
        <span>
          previous {meta.input_tokens || 0} in / {meta.output_tokens || 0} out · next ~
          {meta.estimate_low || "—"}–{meta.estimate_high || "—"}s
        </span>
      </div>
    </article>
  );
}

export function ChatMessage({ message, model, sending, onCopy, onRetry }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const streaming = Boolean(message.streaming);

  async function copy() {
    await onCopy(message.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const metrics = [];
  if (!isUser && !streaming && message.input_tokens !== undefined) {
    metrics.push(["IN", message.input_tokens ?? 0]);
    metrics.push(["OUT", message.output_tokens ?? 0]);
    metrics.push(["TIME", formatSeconds(message.latency_seconds)]);
    if (message.estimateRange) metrics.push(["EST", message.estimateRange]);
    else if (message.estimated_seconds) metrics.push(["EST", `~${formatSeconds(message.estimated_seconds)}`]);
    if (message.metadata?.ttft_seconds !== undefined) {
      metrics.push(["FIRST", formatSeconds(message.metadata.ttft_seconds)]);
    }
    if (message.metadata?.stopped) metrics.push(["STATUS", "STOPPED"]);
  } else if (!isUser && streaming && message.input_tokens !== undefined) {
    metrics.push(["IN", message.input_tokens]);
    if (message.estimateRange) metrics.push(["EST", message.estimateRange]);
  }

  return (
    <article
      className={[
        "mb-8 animate-[message-in_220ms_ease_both]",
        isUser ? "flex justify-end" : "grid grid-cols-[40px_minmax(0,1fr)] gap-4",
      ].join(" ")}
    >
      {!isUser && (
        <div
          className="grid size-[38px] place-items-center rounded-xl border border-line bg-white text-[0.68rem] font-bold"
          style={model ? { color: model.color } : undefined}
        >
          {modelInitial(model)}
        </div>
      )}
      <div className={isUser ? "flex max-w-[min(72%,560px)] flex-col items-end" : "min-w-0"}>
        {!isUser && (
          <div className="min-h-[22px] pt-0.5 text-[0.75rem] font-bold uppercase tracking-[0.05em] text-muted">
            {model?.label || "Assistant"}
          </div>
        )}
        <div
          className={[
            "markdown-body [overflow-wrap:anywhere] text-[1.02rem] leading-[1.7]",
            isUser
              ? "user-bubble w-fit max-w-full rounded-[18px_18px_6px_18px] bg-ink px-4 py-2.5 text-[#f7f7f4]"
              : "text-[#282b2b]",
            streaming ? "streaming-caret" : "",
          ].join(" ")}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || "") }}
        />
        <div className={["mt-2 flex items-center gap-1", isUser ? "justify-end" : "", streaming ? "invisible" : ""].join(" ")}>
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[0.78rem] font-semibold hover:bg-panel hover:text-ink ${copied ? "text-success" : "text-muted"}`}
            onClick={copy}
            aria-label="Copy message"
          >
            <IconCopy />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          {!isUser && (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[0.78rem] font-semibold text-muted hover:bg-panel hover:text-ink disabled:cursor-default disabled:opacity-40"
              onClick={() => onRetry(message)}
              disabled={sending}
              aria-label="Retry response"
            >
              <IconRetry />
              <span>Retry</span>
            </button>
          )}
        </div>
        {metrics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[0.75rem] text-soft">
            {metrics.map(([label, value]) => (
              <span key={label} className="inline-flex items-center gap-1">
                {label} {value}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
