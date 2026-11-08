import { Inbox } from "lucide-react";

export function EmptyState({ title = "Nothing here yet", hint, bare = false }) {
  if (bare) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-6 text-center">
        <Inbox size={20} className="text-slate-400" aria-hidden />
        <p className="text-sm font-medium text-nav">{title}</p>
        {hint ? <p className="max-w-sm text-sm text-muted">{hint}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-ui bg-white px-6 py-10 text-center">
      <Inbox size={22} className="text-muted" aria-hidden />
      <p className="text-sm font-medium text-nav">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex flex-col gap-3" aria-label={label} role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <p className="text-sm font-medium text-red-800">Something went wrong</p>
      <p className="text-sm text-red-700">{message}</p>
      {onRetry ? (
        <button onClick={onRetry} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-300 hover:bg-red-100">
          Retry
        </button>
      ) : null}
    </div>
  );
}
