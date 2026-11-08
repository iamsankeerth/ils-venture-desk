import { Briefcase, FileText, Inbox } from "lucide-react";

const ITEMS = [
  { id: "queue", label: "Work Queue", icon: Inbox },
  { id: "ventures", label: "Ventures", icon: Briefcase },
  { id: "notes", label: "System Notes", icon: FileText },
];

export default function Sidebar({ activePage, onNavigate, counts }) {
  return (
    <nav aria-label="Primary" className="hidden w-60 shrink-0 flex-col bg-nav text-slate-200 md:flex">
      <div className="px-5 pb-4 pt-6">
        <p className="text-lg font-bold tracking-tight text-white">ILS Desk</p>
        <p className="mt-0.5 text-xs text-slate-400">Venture Progress &amp; Readiness</p>
      </div>
      <ul className="flex flex-col gap-1 px-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={17} aria-hidden />
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === "queue" && counts > 0 ? (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">{counts}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto px-5 py-4 text-xs leading-relaxed text-slate-400">
        Demo roles only.
        <br />
        X-ILS-Role seam.
      </div>
    </nav>
  );
}
