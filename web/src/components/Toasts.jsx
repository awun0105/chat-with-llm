export function Toasts({ toasts }) {
  return (
    <div className="fixed right-5 bottom-5 z-[60] grid gap-2" aria-live="assertive">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-[380px] animate-[toast-in_180ms_ease] rounded-xl border bg-white px-4 py-3 text-[0.88rem] shadow-lift ${
            toast.type === "error" ? "border-[#edcaca] text-danger" : "border-line text-ink"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
