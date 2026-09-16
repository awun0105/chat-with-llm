import { useEffect, useMemo, useRef, useState } from "react";
import { IconClose, IconSearch } from "./Icons.jsx";
import { api } from "../lib/api.js";
import { useDialogFocus } from "../lib/useDialogFocus.js";

const PAGE_SIZE = 20;

function Highlight({ text = "", query }) {
  const parts = useMemo(() => {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [text];
    const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  }, [query, text]);
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return parts.map((part, index) =>
    terms.includes(part.toLocaleLowerCase()) ? <mark key={`${part}-${index}`} className="rounded bg-accent-soft px-0.5 text-inherit">{part}</mark> : part,
  );
}

export function SearchDialog({ recentSessions, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useDialogFocus({ onClose, initialFocusRef: inputRef });

  useEffect(() => {
    if (!query.trim()) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const page = await api.searchSessions(query.trim(), PAGE_SIZE, 0);
        if (!cancelled) {
          setResults(page.items);
          setTotal(page.total);
          setActiveIndex(0);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const visibleResults = query.trim() ? results : recentSessions;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await api.searchSessions(query.trim(), PAGE_SIZE, results.length);
      setResults((items) => [...items, ...page.items]);
      setTotal(page.total);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMore(false);
    }
  }

  function onInputKeyDown(event) {
    if (!visibleResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onSelect(visibleResults[activeIndex]?.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(20_20_18_/_28%)] px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="flex max-h-[72vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_rgb(20_20_18_/_20%)]" role="dialog" aria-modal="true" aria-label="Search chats">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <IconSearch className="size-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setLoading(Boolean(value.trim()));
              setError("");
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[1rem] text-ink outline-none placeholder:text-muted"
            placeholder="Search titles and messages"
            aria-label="Search titles and messages"
            aria-controls="chat-search-results"
            aria-activedescendant={visibleResults[activeIndex] ? `search-result-${visibleResults[activeIndex].id}` : undefined}
          />
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-black/5" onClick={onClose} aria-label="Close search"><IconClose className="size-5" /></button>
        </div>
        <div id="chat-search-results" className="min-h-[180px] overflow-y-auto p-2" role="listbox">
          <div className="px-3 pb-2 pt-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted">{query.trim() ? `${total} results` : "Recent"}</div>
          {loading && <p className="px-3 py-6 text-center text-sm text-muted">Searching…</p>}
          {!loading && error && <p className="px-3 py-6 text-center text-sm text-danger">{error}</p>}
          {!loading && !error && visibleResults.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">No conversations found.</p>}
          {!loading && !error && visibleResults.map((session, index) => (
            <button
              id={`search-result-${session.id}`}
              key={session.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${index === activeIndex ? "bg-panel" : "hover:bg-panel"}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(session.id)}
            >
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.94rem] font-semibold"><Highlight text={session.title} query={query} /></span>
              <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[0.8rem] text-muted"><Highlight text={session.preview || "No messages yet"} query={query} /></span>
            </button>
          ))}
          {!loading && !error && query.trim() && results.length < total && (
            <button type="button" className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-50" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
