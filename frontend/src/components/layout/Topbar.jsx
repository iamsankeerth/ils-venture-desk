import { Command, Download, RotateCcw, Search } from "lucide-react";
import { ROLES, roleLabel, can } from "../../utils/status.js";

export default function Topbar({
  role, onRoleChange, search, onSearch,
  onExport, onResetRequest, onPalette, busy,
}) {
  const showExport = can(role, "export_data");
  const showReset = can(role, "reset_seed");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-ui bg-white px-3 sm:h-16 sm:px-6">
      <div className="min-w-0 shrink-0 sm:hidden">
        <p className="text-sm font-bold tracking-tight text-nav">ILS Desk</p>
      </div>

      <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search ventures"
          aria-label="Search ventures"
          className="w-full rounded-lg bg-white py-2 pl-9 pr-3 text-sm text-nav ring-1 ring-inset ring-border-ui placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted sm:text-sm">
          <span className="hidden sm:inline" aria-hidden>Role (Demo Seam)</span>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            aria-label="Simulated role"
            title={`Simulated role: ${roleLabel(role)}`}
            className="rounded-lg border border-border-ui bg-white px-2.5 py-1.5 text-xs font-medium text-nav sm:text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </label>

        <button
          onClick={onPalette}
          title="Command palette (Ctrl+K)"
          aria-label="Open command palette"
          className="hidden items-center gap-1.5 rounded-lg px-2 py-2 text-muted ring-1 ring-inset ring-border-ui hover:bg-slate-50 sm:flex"
        >
          <Command size={16} aria-hidden />
          <kbd className="font-mono text-[11px]">⌘K</kbd>
        </button>

        {showExport ? (
          <button
            onClick={onExport}
            disabled={busy}
            title="Export all data (JSON)"
            aria-label="Export data"
            className="rounded-lg p-2 text-muted hover:bg-slate-100 disabled:opacity-50"
          >
            <Download size={18} />
          </button>
        ) : null}

        {showReset ? (
          <button
            onClick={onResetRequest}
            disabled={busy}
            title="Reset to seed data"
            aria-label="Reset to seed data"
            className="rounded-lg p-2 text-muted hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCcw size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
