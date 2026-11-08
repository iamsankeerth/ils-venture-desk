import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Drawer({ title, subtitle, onClose, children, footer }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="anim-overlay fixed inset-0 z-50 bg-nav/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-drawer absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-xl sm:w-[520px] sm:max-w-[92vw]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-ui px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-nav">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close panel" className="rounded-md p-1.5 text-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-border-ui px-5 py-3">{footer}</div> : null}
      </aside>
    </div>
  );
}
