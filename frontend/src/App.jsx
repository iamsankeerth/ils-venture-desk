import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { apiRequest, downloadExport } from "./api/client.js";
import { normalizeState } from "./utils/normalizeState.js";
import { can, canManageData, canReview, canLogMentor, canConfigure } from "./utils/status.js";
import AppShell from "./components/layout/AppShell.jsx";
import StaffQueueView from "./components/StaffQueueView.jsx";
import VentureListView from "./components/VentureListView.jsx";
import VentureWorkspace from "./components/VentureWorkspace.jsx";
import SubmitUpdateModal from "./components/SubmitUpdateModal.jsx";
import ReviewModal from "./components/ReviewModal.jsx";
import ImportVentureModal from "./components/ImportVentureModal.jsx";
import SystemNoteView from "./components/SystemNoteView.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import Modal from "./components/ui/Modal.jsx";
import Button from "./components/ui/Button.jsx";
import { TransitionModal, ClarifyModal, MentorModal, MslModal, CriterionDrawer } from "./components/DecisionModals.jsx";
import { ErrorState, LoadingState } from "./components/ui/EmptyState.jsx";

export default function App() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [activePage, setActivePage] = useState("queue");
  const [selectedVentureId, setSelectedVentureId] = useState(null);
  const [ventureTab, setVentureTab] = useState("overview");
  const [role, setRole] = useState("PROGRAMME_REVIEWER");
  const [search, setSearch] = useState("");

  const [reviewId, setReviewId] = useState(null);
  const [submitFor, setSubmitFor] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [transitionFor, setTransitionFor] = useState(null);
  const [clarifyFor, setClarifyFor] = useState(null);
  const [mentorFor, setMentorFor] = useState(null);
  const [mslFor, setMslFor] = useState(null);
  const [criterionId, setCriterionId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await apiRequest("/state", { role: "PROGRAMME_REVIEWER" });
      setRaw(s);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot reach the backend at /api. Start FastAPI on 127.0.0.1:8000 first." : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const norm = useMemo(() => (raw ? normalizeState(raw) : null), [raw]);

  const queueCount = useMemo(() => {
    if (!norm) return 0;
    const q = norm.staffQueue;
    return (q.unreviewed_evidence?.length ?? 0) + (q.owner_clarifications?.length ?? 0)
      + (q.mentor_followups?.length ?? 0) + (q.pending_actions?.length ?? 0)
      + (q.unresolved_criteria?.length ?? 0);
  }, [norm]);

  function flash(msg) {
    setNotice(msg);
  }

  function needRole(ok, label) {
    if (!ok) {
      flash(`Action unavailable for the current demonstration role — ${label} required.`);
      return false;
    }
    return true;
  }

  function openVenture(id, tab) {
    if (!id) {
      setActivePage("ventures");
      return;
    }
    setSelectedVentureId(id);
    if (tab) setVentureTab(tab);
  }

  async function handleExport() {
    if (!needRole(can(role, "export_data"), "Programme Owner or Reviewer")) return;
    setBusy(true);
    try {
      await downloadExport(role);
      flash("Export downloaded as ils-export.json.");
    } catch {
      flash("Export failed — is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!needRole(canManageData(role), "Programme Owner or Reviewer") || busy) return;
    setBusy(true);
    try {
      await apiRequest("/reset", { method: "POST", role });
      await refresh();
      setResetOpen(false);
      flash("Workspace reset to seed data.");
    } catch (err) {
      flash(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handlePaletteAction(id) {
    if (id === "import") {
      if (needRole(canManageData(role), "Programme Owner or Reviewer")) setShowImport(true);
    } else if (id === "export") {
      if (needRole(can(role, "export_data"), "Programme Owner or Reviewer")) handleExport();
    }
    else if (id === "reset") {
      if (needRole(canManageData(role), "Programme Owner or Reviewer")) setResetOpen(true);
    } else if (id === "submit") {
      const first = norm?.ventures[0]?.id;
      if (first) { setSelectedVentureId(first); setSubmitFor({ ventureId: first }); }
    }
  }

  function afterMutation(msg) {
    return async () => {
      await refresh();
      if (msg) flash(msg);
    };
  }

  function openSubmitUpdate(target) {
    if (!target) return;
    if (typeof target === "string") {
      setSubmitFor({ ventureId: target });
    } else {
      setSubmitFor(target);
    }
  }

  return (
    <AppShell
      activePage={selectedVentureId ? "ventures" : activePage}
      scrollKey={`${activePage}|${selectedVentureId ?? ""}`}
      onNavigate={(p) => { setActivePage(p); setSelectedVentureId(null); }}
      role={role}
      onRoleChange={setRole}
      search={search}
      onSearch={(v) => { setSearch(v); if (v) { setActivePage("ventures"); setSelectedVentureId(null); } }}
      onExport={handleExport}
      onResetRequest={() => needRole(canManageData(role), "Programme Owner or Reviewer") && setResetOpen(true)}
      onPalette={() => setPaletteOpen(true)}
      busy={busy}
      queueCount={queueCount}
    >
      {notice ? (
        <p role="status" className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-800">{notice}</p>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {!loading && !error && norm ? (
        <>
          {selectedVentureId ? (
            <div className="flex flex-col gap-4">
              <button onClick={() => setSelectedVentureId(null)} className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-slate-100 hover:text-nav">
                <ArrowLeft size={16} aria-hidden /> All ventures
              </button>
              <VentureWorkspace
                key={selectedVentureId}
                norm={norm}
                ventureId={selectedVentureId}
                tab={ventureTab}
                onTab={setVentureTab}
                role={role}
                onReview={(id) => setReviewId(id)}
                onSubmitUpdate={openSubmitUpdate}
                onTransition={(id) => needRole(canReview(role), "Programme Reviewer") && setTransitionFor(id)}
                onClarify={(id) => needRole(canConfigure(role), "Programme Owner") && setClarifyFor(id)}
                onMentor={(id) => needRole(canLogMentor(role), "Mentor, Owner or Reviewer") && setMentorFor(id)}
                onCertifyMsl={(id) => needRole(canReview(role), "Programme Reviewer") && setMslFor(id)}
                onChanged={afterMutation()}
                openCriterionId={criterionId}
              />
            </div>
          ) : activePage === "queue" ? (
            <StaffQueueView
              norm={norm}
              role={role}
              onOpenVenture={openVenture}
              onReview={(id) => setReviewId(id)}
              onClarify={(id) => needRole(canConfigure(role), "Programme Owner") && (openVenture(id, "overview"), setClarifyFor(id))}
              onMentor={(id) => needRole(canLogMentor(role), "Mentor, Owner or Reviewer") && (openVenture(id, "overview"), setMentorFor(id))}
              onImport={() => needRole(canManageData(role), "Programme Owner or Reviewer") && setShowImport(true)}
              canImport={canManageData(role)}
              onSubmitUpdate={openSubmitUpdate}
            />
          ) : activePage === "ventures" ? (
            <VentureListView
              norm={norm}
              search={search}
              onOpen={(id) => openVenture(id, "overview")}
              onImport={() => needRole(canManageData(role), "Programme Owner or Reviewer") && setShowImport(true)}
              canImport={canManageData(role)}
            />
          ) : (
            <SystemNoteView norm={norm} />
          )}
        </>
      ) : null}

      {reviewId && norm ? (
        <ReviewModal
          evidenceId={reviewId}
          norm={norm}
          role={role}
          onClose={() => setReviewId(null)}
          onDecided={afterMutation()}
          onOpenCriterion={(cid) => {
            const v = norm.evidenceById[reviewId]?.venture_id;
            if (v) {
              setSelectedVentureId(v);
              setVentureTab("requirements");
              setCriterionId(cid);
            }
          }}
        />
      ) : null}

      {criterionId && norm && !selectedVentureId ? (
        <CriterionDrawer norm={norm} criterionId={criterionId} onClose={() => setCriterionId(null)} />
      ) : null}

      {submitFor ? (
        <SubmitUpdateModal
          norm={norm}
          ventureId={submitFor.ventureId}
          initialLineId={submitFor.lineId ?? ""}
          initialCriterionId={submitFor.criterionId ?? ""}
          role={role}
          onClose={() => setSubmitFor(null)}
          onSubmitted={async () => { setSubmitFor(null); await refresh(); flash("Progress update submitted — awaiting review."); }}
        />
      ) : null}

      {showImport ? (
        <ImportVentureModal
          role={role}
          onClose={() => setShowImport(false)}
          onCreated={async (id) => { setShowImport(false); await refresh(); openVenture(id, "overview"); flash("Venture imported with Unknown provenance preserved."); }}
        />
      ) : null}

      {transitionFor ? (
        <TransitionModal norm={norm} ventureId={transitionFor} role={role}
          onClose={() => setTransitionFor(null)}
          onDone={async () => { setTransitionFor(null); await refresh(); flash("Transition recorded."); }} />
      ) : null}

      {clarifyFor ? (
        <ClarifyModal norm={norm} ventureId={clarifyFor} role={role}
          onClose={() => setClarifyFor(null)}
          onDone={async () => { setClarifyFor(null); await refresh(); flash("Governing model clarified — prior track preserved."); }} />
      ) : null}

      {mentorFor ? (
        <MentorModal norm={norm} ventureId={mentorFor} role={role}
          onClose={() => setMentorFor(null)}
          onDone={async () => { setMentorFor(null); await refresh(); flash("Mentor outcome recorded."); }} />
      ) : null}

      {mslFor ? (
        <MslModal norm={norm} ventureId={mslFor} role={role}
          onClose={() => setMslFor(null)}
          onDone={async () => { setMslFor(null); await refresh(); flash("MSL eligibility certified."); }} />
      ) : null}

      {paletteOpen && norm ? (
        <CommandPalette
          norm={norm}
          role={role}
          onNavigate={(p) => { setActivePage(p); setSelectedVentureId(null); }}
          onOpenVenture={(id, tab) => openVenture(id, tab)}
          onReview={(id) => setReviewId(id)}
          onAction={handlePaletteAction}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}

      {resetOpen ? (
        <Modal title="Reset workspace" onClose={() => !busy && setResetOpen(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              This discards all demo changes and restores <span className="font-mono text-xs">seed_data.json</span>.
              There is no undo.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={busy} autoFocus>
                No, keep data
              </Button>
              <Button variant="danger" onClick={handleReset} disabled={busy}>
                {busy ? "Resetting..." : "Yes, reset data"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
