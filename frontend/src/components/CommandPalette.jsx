import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Briefcase, FileSearch, Inbox, Settings2 } from "lucide-react";
import { can } from "../utils/status.js";

export default function CommandPalette({ norm, role, onNavigate, onOpenVenture, onReview, onAction, onClose }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || String(s ?? "").toLowerCase().includes(q);
    const out = [];
    for (const v of norm.ventures) {
      if (match(`${v.name} ${v.id} venture open`)) {
        out.push({ group: "Ventures", icon: Briefcase, label: v.name, hint: v.id, run: () => onOpenVenture(v.id, "overview") });
      }
    }
    for (const e of norm.staffQueue.unreviewed_evidence ?? []) {
      if (match(`${e.id} ${e.source_type} review evidence ${e.venture_id}`)) {
        out.push({ group: "Evidence", icon: FileSearch, label: `Review ${e.id}`, hint: norm.venturesById[e.venture_id]?.name ?? e.venture_id, run: () => onReview(e.id) });
      }
    }
    const pages = [["Work Queue", "queue"], ["Ventures", "ventures"], ["System Notes", "notes"]];
    for (const [label, id] of pages) {
      if (match(`go to ${label} page`)) out.push({ group: "Pages", icon: Inbox, label: `Go to ${label}`, hint: "", run: () => onNavigate(id) });
    }
    const actions = [
      ["Import venture", "import", "import_venture"],
      ["Export data", "export", "export_data"],
      ["Reset to seed", "reset", "reset_seed"],
      ["Submit update", "submit", "submit_update"],
    ];
    for (const [label, id, capability] of actions) {
      if (can(role, capability) && match(label)) out.push({ group: "Actions", icon: Settings2, label, hint: "", run: () => onAction(id) });
    }
    return out.slice(0, 24);
  }, [norm, role, query, onNavigate, onOpenVenture, onReview, onAction]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function onKey(e) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      const item = items[index];
      if (item) { onClose(); item.run(); }
    }
  }

  let lastGroup = null;
  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-start justify-center bg-nav/40 p-4 pt-[12vh]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="anim-modal w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b border-border-ui px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to a venture, evidence, page, or action…"
            aria-label="Command palette"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[index] ? `palette-${index}` : undefined}
            className="w-full bg-transparent text-sm text-nav placeholder:text-muted focus:outline-none"
          />
        </div>
        <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[40vh] overflow-y-auto py-1.5">
          {items.length === 0 ? <li className="px-4 py-3 text-sm text-muted">No matches.</li> : null}
          {items.map((item, i) => {
            const Icon = item.icon;
            const header = item.group !== lastGroup ? ((lastGroup = item.group), true) : false;
            return (
              <li key={`${item.group}-${item.label}-${i}`}>
                {header ? <p className="px-4 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{item.group}</p> : null}
                <button
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === index}
                  data-active={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => { onClose(); item.run(); }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${i === index ? "bg-slate-100" : ""}`}
                >
                  <Icon size={15} aria-hidden className="shrink-0 text-muted" />
                  <span className="flex-1 truncate font-medium text-nav">{item.label}</span>
                  {item.hint ? <span className="truncate text-xs text-muted">{item.hint}</span> : null}
                  <ArrowRight size={14} aria-hidden className="shrink-0 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
