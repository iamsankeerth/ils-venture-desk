import { useEffect, useRef } from "react";
import { Briefcase, FileText, Inbox } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

const MOBILE_ITEMS = [
  { id: "queue", label: "Work Queue", icon: Inbox },
  { id: "ventures", label: "Ventures", icon: Briefcase },
  { id: "notes", label: "System Notes", icon: FileText },
];

export default function AppShell(props) {
  const { queueCount, scrollKey, children } = props;
  const mainRef = useRef(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [scrollKey]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-nav">
      <Sidebar activePage={props.activePage} onNavigate={props.onNavigate} counts={queueCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          activePage={props.activePage}
          onNavigate={props.onNavigate}
          role={props.role}
          onRoleChange={props.onRoleChange}
          search={props.search}
          onSearch={props.onSearch}
          onExport={props.onExport}
          onResetRequest={props.onResetRequest}
          onPalette={props.onPalette}
          busy={props.busy}
        />
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
        <nav
          aria-label="Primary mobile"
          className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-border-ui bg-white px-2 md:hidden"
        >
          {MOBILE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = props.activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium ${
                  active ? "text-brand" : "text-muted hover:text-nav"
                }`}
              >
                <Icon size={17} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
