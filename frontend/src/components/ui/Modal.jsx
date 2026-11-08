import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children, wide = false }) {
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
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-nav/40 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-modal flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-border-ui px-5 py-3">
          <h2 className="text-base font-semibold text-nav">{title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close dialog" className="rounded-md p-1.5 text-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
