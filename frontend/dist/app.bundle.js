/* ILS Venture Desk: dependency-free offline bundle */
(function(){
'use strict';
const modules = Object.create(null);
const cache = Object.create(null);
function load(id, from) {
 if (id==='react') return window.ILSReactCompat;
 if (id==='react-dom/client') return {createRoot:(el)=>({render:(v)=>window.ReactDOM.render(v,el),unmount:()=>window.ReactDOM.unmountComponentAtNode(el)})};
 if (id==='lucide-react') return window.ILSLucideLite;
 if (id.endsWith('.css')) return {};
 let key = id;
 if (id.startsWith('.')) {
   const bits = from.split('/').slice(0,-1).concat(id.split('/'));
   const clean = [];
   for(const b of bits){if(b==='.'||b==='')continue; if(b==='..') clean.pop(); else clean.push(b);}
   key=clean.join('/');
 }
 if(!modules[key] && modules[key+'.js']) key+='.js';
 if(!modules[key] && modules[key+'.jsx']) key+='.jsx';
 if(!modules[key]) throw Error('Missing frontend module: '+key+' (from '+from+')');
 if(cache[key]) return cache[key].exports;
 const m={exports:{}}; cache[key]=m;
 modules[key](m,m.exports,(name)=>load(name,key));
 return m.exports;
}
modules["src/api/client.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRequest = apiRequest;
exports.downloadExport = downloadExport;
const API_BASE = "/api";
function extractMessage(result, fallback) {
    const d = result?.detail;
    if (typeof d === "string" && d)
        return d;
    if (d && typeof d === "object" && typeof d.error === "string")
        return d.error;
    if (typeof result?.message === "string")
        return result.message;
    return fallback;
}
function extractBlockers(result) {
    return (result?.detail?.blocking_reasons ??
        result?.blocking_reasons ??
        result?.blockingReasons ??
        []);
}
async function apiRequest(path, { method = "GET", body, role = "PROGRAMME_REVIEWER" } = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "X-ILS-Role": role,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
        const status = response.status;
        const error = new Error(status === 403
            ? "Action unavailable for the selected demonstration role."
            : status === 400
                ? extractMessage(result, "Request rejected by programme rules.")
                : status === 422
                    ? extractMessage(result, "Some fields are invalid or missing.")
                    : extractMessage(result, "Request failed."));
        error.status = status;
        error.blockingReasons = extractBlockers(result);
        throw error;
    }
    return result;
}
async function downloadExport(role = "PROGRAMME_REVIEWER") {
    const response = await fetch(`${API_BASE}/export`, {
        headers: { "X-ILS-Role": role },
    });
    if (!response.ok)
        throw new Error("Export failed.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ils-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

};
modules["src/App.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const client_js_1 = require("./api/client.js");
const normalizeState_js_1 = require("./utils/normalizeState.js");
const status_js_1 = require("./utils/status.js");
const AppShell_jsx_1 = __importDefault(require("./components/layout/AppShell.jsx"));
const StaffQueueView_jsx_1 = __importDefault(require("./components/StaffQueueView.jsx"));
const VentureListView_jsx_1 = __importDefault(require("./components/VentureListView.jsx"));
const VentureWorkspace_jsx_1 = __importDefault(require("./components/VentureWorkspace.jsx"));
const SubmitUpdateModal_jsx_1 = __importDefault(require("./components/SubmitUpdateModal.jsx"));
const ReviewModal_jsx_1 = __importDefault(require("./components/ReviewModal.jsx"));
const ImportVentureModal_jsx_1 = __importDefault(require("./components/ImportVentureModal.jsx"));
const SystemNoteView_jsx_1 = __importDefault(require("./components/SystemNoteView.jsx"));
const CommandPalette_jsx_1 = __importDefault(require("./components/CommandPalette.jsx"));
const Modal_jsx_1 = __importDefault(require("./components/ui/Modal.jsx"));
const Button_jsx_1 = __importDefault(require("./components/ui/Button.jsx"));
const DecisionModals_jsx_1 = require("./components/DecisionModals.jsx");
const EmptyState_jsx_1 = require("./components/ui/EmptyState.jsx");
function App() {
    const [raw, setRaw] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)("");
    const [notice, setNotice] = (0, react_1.useState)("");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [activePage, setActivePage] = (0, react_1.useState)("queue");
    const [selectedVentureId, setSelectedVentureId] = (0, react_1.useState)(null);
    const [ventureTab, setVentureTab] = (0, react_1.useState)("overview");
    const [role, setRole] = (0, react_1.useState)("PROGRAMME_REVIEWER");
    const [search, setSearch] = (0, react_1.useState)("");
    const [reviewId, setReviewId] = (0, react_1.useState)(null);
    const [submitFor, setSubmitFor] = (0, react_1.useState)(null);
    const [showImport, setShowImport] = (0, react_1.useState)(false);
    const [transitionFor, setTransitionFor] = (0, react_1.useState)(null);
    const [clarifyFor, setClarifyFor] = (0, react_1.useState)(null);
    const [mentorFor, setMentorFor] = (0, react_1.useState)(null);
    const [mslFor, setMslFor] = (0, react_1.useState)(null);
    const [criterionId, setCriterionId] = (0, react_1.useState)(null);
    const [paletteOpen, setPaletteOpen] = (0, react_1.useState)(false);
    const [resetOpen, setResetOpen] = (0, react_1.useState)(false);
    const refresh = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setError("");
        try {
            const s = await (0, client_js_1.apiRequest)("/state", { role: "PROGRAMME_REVIEWER" });
            setRaw(s);
        }
        catch (err) {
            setError(err.message === "Failed to fetch" ? "Cannot reach the backend at /api. Start FastAPI on 127.0.0.1:8000 first." : err.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        refresh();
    }, [refresh]);
    (0, react_1.useEffect)(() => {
        if (!notice)
            return;
        const t = setTimeout(() => setNotice(""), 5000);
        return () => clearTimeout(t);
    }, [notice]);
    (0, react_1.useEffect)(() => {
        function onKey(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    const norm = (0, react_1.useMemo)(() => (raw ? (0, normalizeState_js_1.normalizeState)(raw) : null), [raw]);
    const queueCount = (0, react_1.useMemo)(() => {
        if (!norm)
            return 0;
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
        if (tab)
            setVentureTab(tab);
    }
    async function handleExport() {
        if (!needRole((0, status_js_1.can)(role, "export_data"), "Programme Owner or Reviewer"))
            return;
        setBusy(true);
        try {
            await (0, client_js_1.downloadExport)(role);
            flash("Export downloaded as ils-export.json.");
        }
        catch {
            flash("Export failed — is the backend running?");
        }
        finally {
            setBusy(false);
        }
    }
    async function handleReset() {
        if (!needRole((0, status_js_1.canManageData)(role), "Programme Owner or Reviewer") || busy)
            return;
        setBusy(true);
        try {
            await (0, client_js_1.apiRequest)("/reset", { method: "POST", role });
            await refresh();
            setResetOpen(false);
            flash("Workspace reset to seed data.");
        }
        catch (err) {
            flash(err.message);
        }
        finally {
            setBusy(false);
        }
    }
    function handlePaletteAction(id) {
        if (id === "import") {
            if (needRole((0, status_js_1.canManageData)(role), "Programme Owner or Reviewer"))
                setShowImport(true);
        }
        else if (id === "export") {
            if (needRole((0, status_js_1.can)(role, "export_data"), "Programme Owner or Reviewer"))
                handleExport();
        }
        else if (id === "reset") {
            if (needRole((0, status_js_1.canManageData)(role), "Programme Owner or Reviewer"))
                setResetOpen(true);
        }
        else if (id === "submit") {
            const first = norm?.ventures[0]?.id;
            if (first) {
                setSelectedVentureId(first);
                setSubmitFor({ ventureId: first });
            }
        }
    }
    function afterMutation(msg) {
        return async () => {
            await refresh();
            if (msg)
                flash(msg);
        };
    }
    function openSubmitUpdate(target) {
        if (!target)
            return;
        if (typeof target === "string") {
            setSubmitFor({ ventureId: target });
        }
        else {
            setSubmitFor(target);
        }
    }
    return (React.createElement(AppShell_jsx_1.default, { activePage: selectedVentureId ? "ventures" : activePage, scrollKey: `${activePage}|${selectedVentureId ?? ""}`, onNavigate: (p) => { setActivePage(p); setSelectedVentureId(null); }, role: role, onRoleChange: setRole, search: search, onSearch: (v) => { setSearch(v); if (v) {
            setActivePage("ventures");
            setSelectedVentureId(null);
        } }, onExport: handleExport, onResetRequest: () => needRole((0, status_js_1.canManageData)(role), "Programme Owner or Reviewer") && setResetOpen(true), onPalette: () => setPaletteOpen(true), busy: busy, queueCount: queueCount },
        notice ? (React.createElement("p", { role: "status", className: "mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-800" }, notice)) : null,
        loading ? React.createElement(EmptyState_jsx_1.LoadingState, null) : null,
        !loading && error ? React.createElement(EmptyState_jsx_1.ErrorState, { message: error, onRetry: refresh }) : null,
        !loading && !error && norm ? (React.createElement(React.Fragment, null, selectedVentureId ? (React.createElement("div", { className: "flex flex-col gap-4" },
            React.createElement("button", { onClick: () => setSelectedVentureId(null), className: "flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-slate-100 hover:text-nav" },
                React.createElement(lucide_react_1.ArrowLeft, { size: 16, "aria-hidden": true }),
                " All ventures"),
            React.createElement(VentureWorkspace_jsx_1.default, { key: selectedVentureId, norm: norm, ventureId: selectedVentureId, tab: ventureTab, onTab: setVentureTab, role: role, onReview: (id) => setReviewId(id), onSubmitUpdate: openSubmitUpdate, onTransition: (id) => needRole((0, status_js_1.canReview)(role), "Programme Reviewer") && setTransitionFor(id), onClarify: (id) => needRole((0, status_js_1.canConfigure)(role), "Programme Owner") && setClarifyFor(id), onMentor: (id) => needRole((0, status_js_1.canLogMentor)(role), "Mentor, Owner or Reviewer") && setMentorFor(id), onCertifyMsl: (id) => needRole((0, status_js_1.canReview)(role), "Programme Reviewer") && setMslFor(id), onChanged: afterMutation(), openCriterionId: criterionId }))) : activePage === "queue" ? (React.createElement(StaffQueueView_jsx_1.default, { norm: norm, role: role, onOpenVenture: openVenture, onReview: (id) => setReviewId(id), onClarify: (id) => needRole((0, status_js_1.canConfigure)(role), "Programme Owner") && (openVenture(id, "overview"), setClarifyFor(id)), onMentor: (id) => needRole((0, status_js_1.canLogMentor)(role), "Mentor, Owner or Reviewer") && (openVenture(id, "overview"), setMentorFor(id)), onImport: () => needRole((0, status_js_1.canManageData)(role), "Programme Owner or Reviewer") && setShowImport(true), canImport: (0, status_js_1.canManageData)(role), onSubmitUpdate: openSubmitUpdate })) : activePage === "ventures" ? (React.createElement(VentureListView_jsx_1.default, { norm: norm, search: search, onOpen: (id) => openVenture(id, "overview"), onImport: () => needRole((0, status_js_1.canManageData)(role), "Programme Owner or Reviewer") && setShowImport(true), canImport: (0, status_js_1.canManageData)(role) })) : (React.createElement(SystemNoteView_jsx_1.default, { norm: norm })))) : null,
        reviewId && norm ? (React.createElement(ReviewModal_jsx_1.default, { evidenceId: reviewId, norm: norm, role: role, onClose: () => setReviewId(null), onDecided: afterMutation(), onOpenCriterion: (cid) => {
                const v = norm.evidenceById[reviewId]?.venture_id;
                if (v) {
                    setSelectedVentureId(v);
                    setVentureTab("requirements");
                    setCriterionId(cid);
                }
            } })) : null,
        criterionId && norm && !selectedVentureId ? (React.createElement(DecisionModals_jsx_1.CriterionDrawer, { norm: norm, criterionId: criterionId, onClose: () => setCriterionId(null) })) : null,
        submitFor ? (React.createElement(SubmitUpdateModal_jsx_1.default, { norm: norm, ventureId: submitFor.ventureId, initialLineId: submitFor.lineId ?? "", initialCriterionId: submitFor.criterionId ?? "", role: role, onClose: () => setSubmitFor(null), onSubmitted: async () => { setSubmitFor(null); await refresh(); flash("Progress update submitted — awaiting review."); } })) : null,
        showImport ? (React.createElement(ImportVentureModal_jsx_1.default, { role: role, onClose: () => setShowImport(false), onCreated: async (id) => { setShowImport(false); await refresh(); openVenture(id, "overview"); flash("Venture imported with Unknown provenance preserved."); } })) : null,
        transitionFor ? (React.createElement(DecisionModals_jsx_1.TransitionModal, { norm: norm, ventureId: transitionFor, role: role, onClose: () => setTransitionFor(null), onDone: async () => { setTransitionFor(null); await refresh(); flash("Transition recorded."); } })) : null,
        clarifyFor ? (React.createElement(DecisionModals_jsx_1.ClarifyModal, { norm: norm, ventureId: clarifyFor, role: role, onClose: () => setClarifyFor(null), onDone: async () => { setClarifyFor(null); await refresh(); flash("Governing model clarified — prior track preserved."); } })) : null,
        mentorFor ? (React.createElement(DecisionModals_jsx_1.MentorModal, { norm: norm, ventureId: mentorFor, role: role, onClose: () => setMentorFor(null), onDone: async () => { setMentorFor(null); await refresh(); flash("Mentor outcome recorded."); } })) : null,
        mslFor ? (React.createElement(DecisionModals_jsx_1.MslModal, { norm: norm, ventureId: mslFor, role: role, onClose: () => setMslFor(null), onDone: async () => { setMslFor(null); await refresh(); flash("MSL eligibility certified."); } })) : null,
        paletteOpen && norm ? (React.createElement(CommandPalette_jsx_1.default, { norm: norm, role: role, onNavigate: (p) => { setActivePage(p); setSelectedVentureId(null); }, onOpenVenture: (id, tab) => openVenture(id, tab), onReview: (id) => setReviewId(id), onAction: handlePaletteAction, onClose: () => setPaletteOpen(false) })) : null,
        resetOpen ? (React.createElement(Modal_jsx_1.default, { title: "Reset workspace", onClose: () => !busy && setResetOpen(false) },
            React.createElement("div", { className: "flex flex-col gap-3" },
                React.createElement("p", { className: "text-sm text-muted" },
                    "This discards all demo changes and restores ",
                    React.createElement("span", { className: "font-mono text-xs" }, "seed_data.json"),
                    ". There is no undo."),
                React.createElement("div", { className: "flex flex-wrap justify-end gap-2" },
                    React.createElement(Button_jsx_1.default, { variant: "secondary", onClick: () => setResetOpen(false), disabled: busy, autoFocus: true }, "No, keep data"),
                    React.createElement(Button_jsx_1.default, { variant: "danger", onClick: handleReset, disabled: busy }, busy ? "Resetting..." : "Yes, reset data"))))) : null));
}

};
modules["src/components/BusinessLineTabs.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelsForLine = modelsForLine;
exports.default = BusinessLineTabs;
const React = __importStar(require("react"));
const format_js_1 = require("../utils/format.js");
function modelsForLine(line) {
    if (line?.approved_model)
        return [line.approved_model];
    const cand = (0, format_js_1.parseJSON)(line?.candidate_models_json, []);
    return Array.isArray(cand) ? cand : [];
}
function BusinessLineTabs({ lines, selectedId, onSelect }) {
    if (!lines?.length)
        return null;
    return (React.createElement("div", { className: "flex flex-wrap gap-2", role: "tablist", "aria-label": "Business lines" }, lines.map((l) => {
        const active = l.id === selectedId;
        return (React.createElement("button", { key: l.id, role: "tab", "aria-selected": active, onClick: () => onSelect(l.id), className: `rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors duration-150 ${active
                ? "bg-nav text-white ring-nav"
                : "bg-white text-nav ring-border-ui hover:bg-slate-50"}` },
            l.line_name,
            l.track_role && l.track_role !== "ACTIVE_GOVERNING" ? (React.createElement("span", { className: `ml-1.5 rounded px-1.5 py-0.5 font-mono text-[11px] ${active ? "bg-white/15 text-white" : "bg-slate-100 text-muted"}` }, l.track_role)) : null));
    })));
}

};
modules["src/components/CommandPalette.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CommandPalette;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const status_js_1 = require("../utils/status.js");
function CommandPalette({ norm, role, onNavigate, onOpenVenture, onReview, onAction, onClose }) {
    const [query, setQuery] = (0, react_1.useState)("");
    const [index, setIndex] = (0, react_1.useState)(0);
    const inputRef = (0, react_1.useRef)(null);
    const listRef = (0, react_1.useRef)(null);
    const items = (0, react_1.useMemo)(() => {
        const q = query.trim().toLowerCase();
        const match = (s) => !q || String(s ?? "").toLowerCase().includes(q);
        const out = [];
        for (const v of norm.ventures) {
            if (match(`${v.name} ${v.id} venture open`)) {
                out.push({ group: "Ventures", icon: lucide_react_1.Briefcase, label: v.name, hint: v.id, run: () => onOpenVenture(v.id, "overview") });
            }
        }
        for (const e of norm.staffQueue.unreviewed_evidence ?? []) {
            if (match(`${e.id} ${e.source_type} review evidence ${e.venture_id}`)) {
                out.push({ group: "Evidence", icon: lucide_react_1.FileSearch, label: `Review ${e.id}`, hint: norm.venturesById[e.venture_id]?.name ?? e.venture_id, run: () => onReview(e.id) });
            }
        }
        const pages = [["Work Queue", "queue"], ["Ventures", "ventures"], ["System Notes", "notes"]];
        for (const [label, id] of pages) {
            if (match(`go to ${label} page`))
                out.push({ group: "Pages", icon: lucide_react_1.Inbox, label: `Go to ${label}`, hint: "", run: () => onNavigate(id) });
        }
        const actions = [
            ["Import venture", "import", "import_venture"],
            ["Export data", "export", "export_data"],
            ["Reset to seed", "reset", "reset_seed"],
            ["Submit update", "submit", "submit_update"],
        ];
        for (const [label, id, capability] of actions) {
            if ((0, status_js_1.can)(role, capability) && match(label))
                out.push({ group: "Actions", icon: lucide_react_1.Settings2, label, hint: "", run: () => onAction(id) });
        }
        return out.slice(0, 24);
    }, [norm, role, query, onNavigate, onOpenVenture, onReview, onAction]);
    (0, react_1.useEffect)(() => {
        setIndex(0);
    }, [query]);
    (0, react_1.useEffect)(() => {
        inputRef.current?.focus();
    }, []);
    (0, react_1.useEffect)(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    }, [index]);
    function onKey(e) {
        if (e.key === "Escape")
            onClose();
        else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, items.length - 1));
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
        }
        else if (e.key === "Enter") {
            const item = items[index];
            if (item) {
                onClose();
                item.run();
            }
        }
    }
    let lastGroup = null;
    return (React.createElement("div", { className: "anim-overlay fixed inset-0 z-50 flex items-start justify-center bg-nav/40 p-4 pt-[12vh]", role: "presentation", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); } },
        React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": "Command palette", className: "anim-modal w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl" },
            React.createElement("div", { className: "border-b border-border-ui px-4 py-3" },
                React.createElement("input", { ref: inputRef, value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: onKey, placeholder: "Jump to a venture, evidence, page, or action\u2026", "aria-label": "Command palette", role: "combobox", "aria-expanded": "true", "aria-controls": "palette-list", "aria-activedescendant": items[index] ? `palette-${index}` : undefined, className: "w-full bg-transparent text-sm text-nav placeholder:text-muted focus:outline-none" })),
            React.createElement("ul", { ref: listRef, id: "palette-list", role: "listbox", className: "max-h-[40vh] overflow-y-auto py-1.5" },
                items.length === 0 ? React.createElement("li", { className: "px-4 py-3 text-sm text-muted" }, "No matches.") : null,
                items.map((item, i) => {
                    const Icon = item.icon;
                    const header = item.group !== lastGroup ? ((lastGroup = item.group), true) : false;
                    return (React.createElement("li", { key: `${item.group}-${item.label}-${i}` },
                        header ? React.createElement("p", { className: "px-4 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted" }, item.group) : null,
                        React.createElement("button", { id: `palette-${i}`, role: "option", "aria-selected": i === index, "data-active": i === index, onMouseEnter: () => setIndex(i), onClick: () => { onClose(); item.run(); }, className: `flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${i === index ? "bg-slate-100" : ""}` },
                            React.createElement(Icon, { size: 15, "aria-hidden": true, className: "shrink-0 text-muted" }),
                            React.createElement("span", { className: "flex-1 truncate font-medium text-nav" }, item.label),
                            item.hint ? React.createElement("span", { className: "truncate text-xs text-muted" }, item.hint) : null,
                            React.createElement(lucide_react_1.ArrowRight, { size: 14, "aria-hidden": true, className: "shrink-0 text-muted" }))));
                })))));
}

};
modules["src/components/CriteriaMatrix.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CriteriaMatrix;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const client_js_1 = require("../api/client.js");
const status_js_1 = require("../utils/status.js");
const format_js_1 = require("../utils/format.js");
const criteria_js_1 = require("../utils/criteria.js");
const normalizeState_js_1 = require("../utils/normalizeState.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const StatusBadge_jsx_1 = __importDefault(require("./ui/StatusBadge.jsx"));
const EmptyState_jsx_1 = require("./ui/EmptyState.jsx");
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
const BusinessLineTabs_jsx_1 = require("./BusinessLineTabs.jsx");
const GATES = [
    ["L0_QUALITATIVE_CHECKLIST", "L0 qualitative requirements"],
    ["L0_TO_L1_DEMAND_BAR", "L0 → L1 demand bars"],
    ["L1_TO_L2_TRACTION_TARGET", "L1 → L2 traction targets"],
    ["MSL_COMMON", "MSL common requirements"],
    ["MSL_MODEL_SPECIFIC", "MSL model-specific requirements"],
];
function relatedEvidence(norm, ventureId, lineId, criterionId, evaluation = null) {
    const obs = norm.observations.filter((o) => o.venture_id === ventureId &&
        o.criterion_id === criterionId &&
        (!lineId || !o.business_line_id || o.business_line_id === lineId));
    const obsEvIds = new Set(obs.map((o) => o.evidence_id).filter(Boolean));
    const evaluatedEvIds = new Set(evaluation?.related_evidence_ids ?? []);
    const rel = [];
    for (const e of norm.evidence) {
        if (e.venture_id !== ventureId)
            continue;
        if (lineId && e.business_line_id && e.business_line_id !== lineId)
            continue;
        if (e.criterion_id === criterionId || obsEvIds.has(e.id) || evaluatedEvIds.has(e.id)) {
            rel.push(e);
        }
    }
    return { rel, obs };
}
function CriterionRow({ norm, ventureId, lineId, criterion, role, onReviewed, onSubmitUpdate, onReview, defaultOpen }) {
    const [open, setOpen] = (0, react_1.useState)(!!defaultOpen);
    const schema = (0, criteria_js_1.configurationSchema)(criterion);
    const existingRule = (0, format_js_1.parseJSON)(criterion.configured_rule_json, {}) ?? {};
    const [cfg, setCfg] = (0, react_1.useState)(() => ({
        value: criterion.configured_value == null
            ? ""
            : String(criterion.unit === "INR_PAISE" ? criterion.configured_value / 100 : criterion.configured_value),
        method: existingRule.aggregation_method ?? schema?.defaultMethod ?? "SUM",
        basis: existingRule.metric_basis ?? schema?.defaultBasis ?? "COLLECTED",
        period: existingRule.period ?? (schema?.fields.includes("period") ? "All supplied periods" : ""),
        window: existingRule.window_weeks ?? criterion.window_length ?? "",
        cohort: existingRule.cohort_definition ?? "",
        pilot: existingRule.pilot_qualification ?? criteria_js_1.PILOT_QUALIFICATION_OPTIONS[0],
        rangeLow: existingRule.range_low ?? "",
        rangeHigh: existingRule.range_high ?? "",
        note: "",
    }));
    const [cfgBusy, setCfgBusy] = (0, react_1.useState)(false);
    const [cfgError, setCfgError] = (0, react_1.useState)("");
    const ev = (0, normalizeState_js_1.evalFor)(norm, ventureId, criterion.criterion_scope === "VENTURE" ? null : lineId, criterion.id);
    const result = ev?.criterion_result ?? "UNKNOWN";
    const { rel, obs } = (0, react_1.useMemo)(() => relatedEvidence(norm, ventureId, criterion.criterion_scope === "VENTURE" ? null : lineId, criterion.id, ev), [norm, ventureId, lineId, criterion, ev]);
    const latestStatus = ev?.latest_evidence_status ?? (rel.length ? rel[rel.length - 1].evidence_status : null);
    const subconds = (0, format_js_1.parseJSON)(criterion.subconditions_json, null)?.subconditions ?? null;
    function updateCfg(key) {
        return (event) => setCfg((previous) => ({ ...previous, [key]: event.target.value }));
    }
    async function configure(e) {
        e.preventDefault();
        setCfgBusy(true);
        setCfgError("");
        try {
            const rule = { aggregation_method: cfg.method };
            if (schema.fields.includes("basis")) {
                rule.metric_basis = cfg.basis;
                rule.period = cfg.period;
            }
            if (schema.fields.includes("window")) {
                rule.window_weeks = cfg.window === "" ? null : Number(cfg.window);
            }
            if (schema.fields.includes("cohort")) {
                rule.cohort_definition = cfg.cohort;
            }
            if (schema.fields.includes("pilot")) {
                rule.pilot_qualification = cfg.pilot;
            }
            if (schema.fields.includes("range")) {
                if (cfg.rangeLow !== "")
                    rule.range_low = Number(cfg.rangeLow);
                if (cfg.rangeHigh !== "")
                    rule.range_high = Number(cfg.rangeHigh);
            }
            const value = cfg.value === ""
                ? null
                : (criterion.unit === "INR_PAISE" ? Math.round(Number(cfg.value) * 100) : Number(cfg.value));
            await (0, client_js_1.apiRequest)(`/criteria/${criterion.id}/configure`, {
                method: "POST",
                body: {
                    actor: "Demo Programme Owner",
                    configured_value: value,
                    configured_rule: rule,
                    configured_rule_note: cfg.note || undefined,
                },
                role,
            });
            onReviewed();
        }
        catch (err) {
            setCfgError(err.message);
        }
        finally {
            setCfgBusy(false);
        }
    }
    return (React.createElement("li", { className: "border-b border-border-ui last:border-0" },
        React.createElement("div", { className: "flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3" },
            React.createElement("button", { type: "button", onClick: () => setOpen((o) => !o), "aria-expanded": open, className: "flex min-w-0 flex-1 items-start gap-2.5 text-left sm:items-center" },
                React.createElement(lucide_react_1.ChevronDown, { size: 16, "aria-hidden": true, className: `mt-0.5 shrink-0 text-muted transition-transform sm:mt-0 ${open ? "" : "-rotate-90"}` }),
                React.createElement("span", { className: "min-w-0 flex-1" },
                    React.createElement("span", { className: "block break-words text-sm font-medium text-nav" }, criterion.name),
                    React.createElement("span", { className: "block break-words font-mono text-xs text-muted" },
                        criterion.id,
                        " \u00B7 ",
                        criterion.threshold_description ?? ""))),
            React.createElement("div", { className: "flex flex-wrap items-center gap-2 pl-6 sm:pl-0" },
                latestStatus ? (React.createElement(StatusBadge_jsx_1.default, { status: latestStatus, title: "Evidence review status" })) : (React.createElement("span", { className: "text-xs text-muted" }, "No evidence")),
                React.createElement(StatusBadge_jsx_1.default, { status: result, title: ev?.detail ?? result }),
                (0, status_js_1.can)(role, "submit_update") ? (React.createElement("button", { type: "button", onClick: () => onSubmitUpdate?.({ ventureId, lineId, criterionId: criterion.id }), className: "inline-flex items-center gap-1 rounded-lg border border-border-ui bg-white px-2.5 py-1 text-xs font-medium text-nav hover:bg-slate-100" },
                    React.createElement(lucide_react_1.PlusCircle, { size: 13, "aria-hidden": true }),
                    " Submit Update")) : null)),
        open ? (React.createElement("div", { className: "flex flex-col gap-3 bg-slate-50/60 px-4 py-3 sm:pl-9 text-sm" },
            React.createElement("p", { className: "text-muted" }, criterion.threshold_description ?? criterion.name),
            subconds ? (React.createElement("ul", { className: "list-disc pl-5 text-muted" }, subconds.map((s) => React.createElement("li", { key: s.id },
                s.description,
                s.threshold != null ? ` (≥ ${s.threshold})` : "")))) : null,
            ev ? (React.createElement("div", { className: "rounded-lg bg-white p-3 ring-1 ring-inset ring-border-ui" },
                React.createElement("p", { className: "text-nav" },
                    React.createElement("span", { className: "font-semibold" },
                        "Computed result: ",
                        result,
                        "."),
                    " ",
                    ev.detail),
                ev.verified_readings?.length ? React.createElement("p", { className: "mt-1 font-mono text-xs text-muted" },
                    "Verified readings: ",
                    JSON.stringify(ev.verified_readings)) : null,
                ev.pending_corrections?.length ? (React.createElement("div", { className: "mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800" },
                    "Pending correction (unreviewed): ",
                    ev.pending_corrections.map((p) => `${p.numeric_value} · ${p.period_label}`).join("; "))) : null)) : React.createElement("p", { className: "text-muted" }, "No evaluation for this scope yet."),
            obs.length > 0 ? (React.createElement("div", null,
                React.createElement("p", { className: "mb-1 font-medium text-nav" },
                    "Claimed measurements (",
                    obs.length,
                    ")"),
                React.createElement("ul", { className: "flex flex-col gap-1" }, obs.map((o) => (React.createElement("li", { key: o.id, className: "font-mono text-xs text-muted" },
                    o.id,
                    " \u00B7 ",
                    o.period_label ?? "—",
                    " \u00B7 value: ",
                    o.numeric_value ?? "qualitative",
                    " \u00B7 ",
                    o.qualifier_status ?? "no qualifier",
                    " \u00B7 evidence ",
                    (norm.evidenceById[o.evidence_id]?.evidence_status) ?? "?")))))) : null,
            rel.length > 0 ? (React.createElement("div", null,
                React.createElement("p", { className: "mb-1 font-medium text-nav" }, "Evidence references"),
                React.createElement("ul", { className: "flex flex-wrap gap-2" }, rel.map((e) => (React.createElement("li", { key: e.id, className: "flex items-center gap-1.5" },
                    React.createElement("button", { type: "button", onClick: () => onReview?.(e.id), className: "inline-flex items-center gap-1.5 rounded-lg border border-border-ui bg-white px-2.5 py-1 text-xs font-medium text-nav hover:bg-slate-100" },
                        React.createElement("span", { className: "font-mono" }, e.id),
                        React.createElement(StatusBadge_jsx_1.default, { status: e.evidence_status, title: `${e.id} · ${e.source_type}` })))))))) : null,
            criterion.is_configurable_range ? (React.createElement("div", { className: "rounded-lg bg-amber-50 p-3 ring-1 ring-inset ring-amber-200" },
                React.createElement("p", { className: "flex items-center gap-1.5 font-medium text-amber-900" },
                    React.createElement(lucide_react_1.Settings2, { size: 15, "aria-hidden": true }),
                    " ",
                    result === "BLOCKED" ? "Configuration required" : "Programme rule configuration"),
                React.createElement("p", { className: "mt-0.5 text-xs text-amber-800" }, criterion.configured_value == null
                    ? "This rule has no valid configuration yet. Only a Programme Owner can configure it."
                    : `Current configured value: ${criterion.configured_value}. Only a Programme Owner can change it.`),
                (0, status_js_1.canConfigure)(role) ? (React.createElement("form", { onSubmit: configure, className: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" },
                    schema.fields.includes("threshold") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, schema.thresholdLabel),
                        React.createElement("input", { value: cfg.value, onChange: updateCfg("value"), inputMode: "decimal", className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" }))) : null,
                    schema.fields.includes("aggregation") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, "Aggregation method"),
                        React.createElement("select", { value: cfg.method, onChange: updateCfg("method"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" }, schema.methods.map((method) => React.createElement("option", { key: method, value: method }, method))))) : null,
                    schema.fields.includes("basis") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, "Measurement basis"),
                        React.createElement("select", { value: cfg.basis, onChange: updateCfg("basis"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" },
                            React.createElement("option", { value: "COLLECTED" }, "COLLECTED"),
                            React.createElement("option", { value: "EARNED" }, "EARNED"),
                            React.createElement("option", { value: "BILLED" }, "BILLED")))) : null,
                    schema.fields.includes("period") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, "Measurement period"),
                        React.createElement("input", { value: cfg.period, onChange: updateCfg("period"), placeholder: "Verbatim period", className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" }))) : null,
                    schema.fields.includes("window") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, schema.windowLabel ?? "Window weeks"),
                        React.createElement("input", { type: "number", min: "1", value: cfg.window, onChange: updateCfg("window"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" }))) : null,
                    schema.fields.includes("cohort") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, "Cohort definition"),
                        React.createElement("input", { value: cfg.cohort, onChange: updateCfg("cohort"), placeholder: "Named cohort", className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" }))) : null,
                    schema.fields.includes("pilot") ? (React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, "Pilot qualification"),
                        React.createElement("select", { value: cfg.pilot, onChange: updateCfg("pilot"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" }, criteria_js_1.PILOT_QUALIFICATION_OPTIONS.map((option) => React.createElement("option", { key: option, value: option }, option))))) : null,
                    schema.fields.includes("range") ? (React.createElement(React.Fragment, null,
                        React.createElement("label", { className: "block text-xs text-amber-900" },
                            React.createElement("span", { className: "mb-1 block" }, "Range low"),
                            React.createElement("input", { type: "number", min: "0", value: cfg.rangeLow, onChange: updateCfg("rangeLow"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" })),
                        React.createElement("label", { className: "block text-xs text-amber-900" },
                            React.createElement("span", { className: "mb-1 block" }, "Range high"),
                            React.createElement("input", { type: "number", min: "0", value: cfg.rangeHigh, onChange: updateCfg("rangeHigh"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" })))) : null,
                    React.createElement("label", { className: "block text-xs text-amber-900" },
                        React.createElement("span", { className: "mb-1 block" }, "Configuration note"),
                        React.createElement("input", { value: cfg.note, onChange: updateCfg("note"), className: "w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" })),
                    React.createElement("div", { className: "flex items-end sm:col-span-2" },
                        React.createElement(Button_jsx_1.default, { type: "submit", disabled: cfgBusy }, cfgBusy ? "Saving..." : "Configure Rule")))) : React.createElement("p", { className: "mt-1 text-xs text-amber-800" }, "Switch to the Programme Owner role to configure."),
                cfgError ? React.createElement("p", { role: "alert", className: "mt-1 text-xs text-red-700" }, cfgError) : null)) : null)) : null));
}
function CriteriaMatrix({ norm, ventureId, line, role, onChanged, onSubmitUpdate, onReview, openCriterionId }) {
    const models = (0, BusinessLineTabs_jsx_1.modelsForLine)(line);
    const sections = GATES.map(([gate, title]) => {
        const rows = norm.catalog.filter((c) => {
            if (c.transition_gate !== gate)
                return false;
            if (c.criterion_scope === "VENTURE")
                return true;
            return models.includes(c.business_model);
        });
        return { gate, title, rows };
    }).filter((s) => s.rows.length > 0);
    const rollup = norm.rollupByVenture[ventureId];
    if (!sections.length)
        return React.createElement(EmptyState_jsx_1.EmptyState, { title: "No applicable criteria", hint: "The selected business line has no mapped model yet." });
    return (React.createElement("div", { className: "flex flex-col gap-5" },
        rollup ? (React.createElement("div", { className: "rounded-xl border border-border-ui bg-white px-4 py-3 text-sm" },
            React.createElement("p", { className: "text-nav" },
                React.createElement("span", { className: "font-semibold" },
                    "Demand bar (",
                    rollup.governing_model ?? "Governing model unresolved",
                    "): ",
                    rollup.demand_bar,
                    "."),
                " ",
                React.createElement("span", { className: "text-muted" },
                    "Full level status: ",
                    rollup.full_level_status)))) : null,
        sections.map((s) => (React.createElement("section", { key: s.gate },
            React.createElement(SectionHeader_jsx_1.default, { title: s.title, subtitle: `${s.rows.length} requirement${s.rows.length === 1 ? "" : "s"}` }),
            React.createElement("ul", { className: "overflow-hidden rounded-xl border border-border-ui bg-white" }, s.rows.map((c) => (React.createElement(CriterionRow, { key: `${line?.id ?? "venture"}-${c.id}`, norm: norm, ventureId: ventureId, lineId: c.criterion_scope === "VENTURE" ? null : line?.id ?? null, criterion: c, role: role, onReviewed: onChanged, onSubmitUpdate: onSubmitUpdate, onReview: onReview, defaultOpen: openCriterionId === c.id })))))))));
}

};
modules["src/components/DecisionHistoryTimeline.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DecisionHistoryTimeline;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const format_js_1 = require("../utils/format.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const StatusBadge_jsx_1 = __importStar(require("./ui/StatusBadge.jsx"));
const EmptyState_jsx_1 = require("./ui/EmptyState.jsx");
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
const status_js_1 = require("../utils/status.js");
function Snapshot({ data }) {
    const [open, setOpen] = (0, react_1.useState)(false);
    const snap = (0, format_js_1.parseJSON)(data, null);
    if (!snap || typeof snap !== "object")
        return null;
    const entries = Object.entries(snap);
    if (!entries.length)
        return null;
    return (React.createElement("div", { className: "mt-2" },
        React.createElement("button", { onClick: () => setOpen((o) => !o), "aria-expanded": open, className: "flex items-center gap-1 text-xs font-medium text-muted hover:text-nav" },
            React.createElement(lucide_react_1.ChevronDown, { size: 14, "aria-hidden": true, className: open ? "" : "-rotate-90" }),
            "Criteria snapshot (",
            entries.length,
            ")"),
        open ? (React.createElement("ul", { className: "mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg bg-slate-50 p-2" }, entries.map(([id, r]) => (React.createElement("li", { key: id, className: "flex items-center justify-between gap-2 text-xs" },
            React.createElement("span", { className: "truncate font-mono text-muted" }, id),
            React.createElement(StatusBadge_jsx_1.default, { status: r })))))) : null));
}
function DecisionHistoryTimeline({ norm, ventureId, role, onTransition, onClarify, onMentor, onCertifyMsl }) {
    const transitions = [...(norm.transitionsByVenture[ventureId] ?? [])].reverse();
    const msl = [...(norm.mslByVenture[ventureId] ?? [])].reverse();
    return (React.createElement("div", { className: "flex flex-col gap-5" },
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Level transitions", subtitle: "Standard advancement and direct-entry placements. MSL eligibility is separate.", action: (0, status_js_1.canReview)(role) ? React.createElement(Button_jsx_1.default, { onClick: () => onTransition(ventureId) }, "Record Transition") : null }),
            transitions.length === 0 ? (React.createElement(EmptyState_jsx_1.EmptyState, { title: "No transitions recorded", hint: "This venture has no level transitions yet." })) : (React.createElement("ol", { className: "relative ml-2 flex flex-col gap-3 border-l-2 border-border-ui pl-5" }, transitions.map((t) => (React.createElement("li", { key: t.id, className: "rounded-xl border border-border-ui bg-white px-4 py-3 text-sm" },
                React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                    React.createElement("span", { className: "font-semibold text-nav" },
                        t.from_level,
                        " \u2192 ",
                        t.to_level),
                    React.createElement("span", { className: "rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-muted" }, t.transition_type),
                    t.transition_type === "HISTORICAL_IMPORTED" ? React.createElement(StatusBadge_jsx_1.ProvenanceLabel, { text: "Historical" }) : null),
                React.createElement("p", { className: "mt-1 text-nav" }, t.reason),
                React.createElement("p", { className: "mt-0.5 text-xs text-muted" },
                    "by ",
                    t.approved_by,
                    " \u00B7 ",
                    (0, format_js_1.formatDateTime)(t.approved_at),
                    t.provenance_note ? ` · ${t.provenance_note}` : ""),
                React.createElement(Snapshot, { data: t.criteria_snapshot_json }))))))),
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "MSL eligibility", subtitle: "Preserved imports stay intact; new certification needs the full checklist met.", action: (0, status_js_1.canReview)(role) ? React.createElement(Button_jsx_1.default, { onClick: () => onCertifyMsl(ventureId) }, "Certify Eligible") : null }),
            msl.length === 0 ? (React.createElement(EmptyState_jsx_1.EmptyState, { title: "No MSL decisions", hint: "Eligibility is Unknown until certified or imported." })) : (React.createElement("ol", { className: "relative ml-2 flex flex-col gap-3 border-l-2 border-border-ui pl-5" }, msl.map((m) => (React.createElement("li", { key: m.id, className: "rounded-xl border border-border-ui bg-white px-4 py-3 text-sm" },
                React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                    React.createElement("span", { className: "font-semibold text-nav" }, m.decision_status),
                    React.createElement("span", { className: "rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-muted" }, m.decision_type),
                    m.provenance_source ? React.createElement(StatusBadge_jsx_1.ProvenanceLabel, { text: m.provenance_source }) : null),
                React.createElement("p", { className: "mt-1 text-nav" }, m.reason),
                React.createElement("p", { className: "mt-0.5 text-xs text-muted" },
                    "by ",
                    m.approved_by,
                    " \u00B7 ",
                    (0, format_js_1.formatDateTime)(m.approved_at)),
                React.createElement(Snapshot, { data: m.msl_criteria_snapshot_json }))))))),
        ((0, status_js_1.can)(role, "clarify_model") || (0, status_js_1.canLogMentor)(role)) ? (React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Model & mentor actions" }),
            React.createElement("div", { className: "flex flex-wrap gap-2" },
                (0, status_js_1.can)(role, "clarify_model") ? React.createElement(Button_jsx_1.default, { onClick: () => onClarify(ventureId) }, "Clarify Model") : null,
                (0, status_js_1.canLogMentor)(role) ? React.createElement(Button_jsx_1.default, { onClick: () => onMentor(ventureId) }, "Record Mentor Outcome") : null))) : null));
}

};
modules["src/components/DecisionModals.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransitionModal = TransitionModal;
exports.ClarifyModal = ClarifyModal;
exports.MentorModal = MentorModal;
exports.MslModal = MslModal;
exports.CriterionDrawer = CriterionDrawer;
const React = __importStar(require("react"));
const react_1 = require("react");
const client_js_1 = require("../api/client.js");
const format_js_1 = require("../utils/format.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const Modal_jsx_1 = __importDefault(require("./ui/Modal.jsx"));
const Drawer_jsx_1 = __importDefault(require("./ui/Drawer.jsx"));
const StatusBadge_jsx_1 = __importDefault(require("./ui/StatusBadge.jsx"));
const BusinessLineTabs_jsx_1 = require("./BusinessLineTabs.jsx");
const inputCls = "w-full rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav placeholder:text-muted";
const LEVELS = ["Level 0", "Level 1", "Level 2"];
function BlockerList({ reasons }) {
    if (!reasons?.length)
        return null;
    return (React.createElement("div", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" },
        React.createElement("p", { className: "font-medium" }, "Blocked by programme rules:"),
        React.createElement("ul", { className: "mt-1 list-disc pl-5 font-mono text-xs" }, reasons.map((r, i) => React.createElement("li", { key: i }, r)))));
}
function requiredForStandard(norm, venture) {
    // Display-only selection of the backend's required set (results come from the server).
    const gov = venture.primary_business_model;
    const lines = norm.linesByVenture[venture.id] ?? [];
    const out = [];
    const lineIds = lines.filter((l) => l.track_role === "ACTIVE_GOVERNING" && l.approved_model === gov).map((l) => l.id);
    if (venture.programme_level === "Level 0") {
        for (const c of norm.catalog) {
            if (c.transition_gate === "L0_TO_L1_DEMAND_BAR" && c.criterion_scope === "BUSINESS_LINE" && c.business_model === gov) {
                for (const lid of lineIds)
                    out.push({ criterion: c, lineId: lid });
            }
            if (c.transition_gate === "L0_QUALITATIVE_CHECKLIST")
                out.push({ criterion: c, lineId: null });
        }
    }
    else if (venture.programme_level === "Level 1") {
        for (const c of norm.catalog) {
            if (c.transition_gate === "L1_TO_L2_TRACTION_TARGET" && c.criterion_scope === "BUSINESS_LINE" && c.business_model === gov) {
                for (const lid of lineIds)
                    out.push({ criterion: c, lineId: lid });
            }
        }
    }
    return out;
}
function TransitionModal({ norm, ventureId, role, onClose, onDone }) {
    const venture = norm.venturesById[ventureId];
    const [toLevel, setToLevel] = (0, react_1.useState)(venture?.programme_level === "Level 0" ? "Level 1" : "Level 2");
    const [type, setType] = (0, react_1.useState)("STANDARD_ADVANCEMENT");
    const [reason, setReason] = (0, react_1.useState)("");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)("");
    const [blockers, setBlockers] = (0, react_1.useState)([]);
    const required = requiredForStandard(norm, venture);
    const results = required.map(({ criterion, lineId }) => norm.evalMap.get(`${ventureId}|${lineId ?? ""}|${criterion.id}`)?.criterion_result ?? "UNKNOWN");
    const order = { "Level 0": 0, "Level 1": 1, "Level 2": 2 };
    const currentRank = order[venture?.programme_level];
    const directTargets = LEVELS.filter((level) => level !== "Level 0" && (currentRank === undefined || order[level] >= currentRank));
    const targetLevels = type === "DIRECT_ENTRY" ? directTargets : LEVELS;
    const directTargetInvalid = type === "DIRECT_ENTRY" && !directTargets.includes(toLevel);
    const sequential = order[toLevel] - (order[venture?.programme_level] ?? -99) === 1;
    const modelOk = venture?.model_resolution_status === "CONFIRMED";
    const unmet = results.some((r) => r !== "MET");
    const standardBlocked = type === "STANDARD_ADVANCEMENT" && (!sequential || !modelOk || !required.length || unmet);
    function chooseType(nextType) {
        setType(nextType);
        if (nextType === "DIRECT_ENTRY" && !directTargets.includes(toLevel)) {
            setToLevel(directTargets[0]);
        }
    }
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        setBlockers([]);
        try {
            await (0, client_js_1.apiRequest)(`/ventures/${ventureId}/transitions`, {
                method: "POST",
                body: { to_level: toLevel, transition_type: type, approved_by: "Demo Programme Reviewer", reason },
                role,
            });
            onDone();
        }
        catch (err) {
            setError(err.message);
            setBlockers(err.blockingReasons ?? []);
        }
        finally {
            setBusy(false);
        }
    }
    return (React.createElement(Modal_jsx_1.default, { title: `Record Transition · ${venture?.name ?? ventureId}`, onClose: onClose },
        React.createElement("form", { onSubmit: submit, className: "flex flex-col gap-4" },
            React.createElement("div", { className: "grid grid-cols-2 gap-3 text-sm" },
                React.createElement("div", { className: "rounded-lg bg-slate-50 p-2.5" },
                    React.createElement("p", { className: "text-xs text-muted" }, "Current level"),
                    React.createElement("p", { className: "font-semibold text-nav" }, venture?.programme_level)),
                React.createElement("div", { className: "rounded-lg bg-slate-50 p-2.5" },
                    React.createElement("p", { className: "text-xs text-muted" }, "Governing model"),
                    React.createElement("p", { className: "font-semibold text-nav" },
                        venture?.primary_business_model ?? "Unknown",
                        " ",
                        modelOk ? "" : "(unresolved)"))),
            React.createElement("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2" },
                React.createElement("label", { className: `block rounded-xl border p-3 ${type === "STANDARD_ADVANCEMENT" ? "border-brand bg-teal-50/40" : "border-border-ui"}` },
                    React.createElement("span", { className: "flex items-center gap-2 text-sm font-medium text-nav" },
                        React.createElement("input", { type: "radio", checked: type === "STANDARD_ADVANCEMENT", onChange: () => setType("STANDARD_ADVANCEMENT"), className: "h-4 w-4 accent-brand" }),
                        "Standard Advancement"),
                    React.createElement("span", { className: "mt-1 block text-xs text-muted" }, "Sequential step only, after every applicable requirement is met.")),
                React.createElement("label", { className: `block rounded-xl border p-3 ${type === "DIRECT_ENTRY" ? "border-brand bg-teal-50/40" : "border-border-ui"}` },
                    React.createElement("span", { className: "flex items-center gap-2 text-sm font-medium text-nav" },
                        React.createElement("input", { type: "radio", checked: type === "DIRECT_ENTRY", onChange: () => chooseType("DIRECT_ENTRY"), className: "h-4 w-4 accent-brand" }),
                        "Direct Entry"),
                    React.createElement("span", { className: "mt-1 block text-xs text-muted" }, "Placement at Level 1/2 on prior work with justification."))),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Target level"),
                React.createElement("select", { value: toLevel, onChange: (e) => setToLevel(e.target.value), className: inputCls }, targetLevels.map((l) => React.createElement("option", { key: l, value: l }, l))),
                directTargetInvalid ? React.createElement("p", { className: "mt-1 text-xs text-red-700" }, "Direct entry cannot target a level below the current level.") : null),
            type === "STANDARD_ADVANCEMENT" ? (React.createElement("div", null,
                React.createElement("p", { className: "mb-1 text-sm font-medium text-nav" }, "Required criteria (backend verdicts, display only)"),
                !sequential ? React.createElement("p", { className: "mb-1 text-xs text-red-700" },
                    "Not a single sequential step from ",
                    venture?.programme_level,
                    ".") : null,
                !modelOk ? React.createElement("p", { className: "mb-1 text-xs text-red-700" }, "Governing model is unresolved \u2014 clarify it first.") : null,
                React.createElement("ul", { className: "flex max-h-44 flex-col gap-1 overflow-y-auto" }, required.map(({ criterion, lineId }) => {
                    const r = norm.evalMap.get(`${ventureId}|${lineId ?? ""}|${criterion.id}`)?.criterion_result ?? "UNKNOWN";
                    return (React.createElement("li", { key: `${lineId ?? "v"}-${criterion.id}`, className: "flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs" },
                        React.createElement("span", { className: "truncate font-mono text-muted" },
                            criterion.id,
                            lineId ? ` · ${lineId}` : ""),
                        React.createElement(StatusBadge_jsx_1.default, { status: r })));
                })))) : (React.createElement("p", { className: "rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted" }, "Direct entry records reviewer-approved placement with a criteria snapshot. It does not certify MSL eligibility.")),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Reviewer reason"),
                React.createElement("textarea", { required: true, value: reason, onChange: (e) => setReason(e.target.value), rows: 2, placeholder: "Justification for this decision\u2026", className: inputCls })),
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            React.createElement(BlockerList, { reasons: blockers }),
            React.createElement("div", { className: "flex justify-end gap-2" },
                React.createElement(Button_jsx_1.default, { type: "button", onClick: onClose }, "Cancel"),
                React.createElement(Button_jsx_1.default, { type: "submit", variant: "primary", disabled: busy || (type === "STANDARD_ADVANCEMENT" && standardBlocked) || directTargetInvalid, title: standardBlocked ? "Blocked: the UI can already see unmet requirements (the server validates too)" : undefined }, busy ? "Recording…" : "Record Transition")))));
}
function ClarifyModal({ norm, ventureId, role, onClose, onDone }) {
    const venture = norm.venturesById[ventureId];
    const lines = norm.linesByVenture[ventureId] ?? [];
    const [model, setModel] = (0, react_1.useState)(venture?.primary_business_model ?? "");
    const [lineId, setLineId] = (0, react_1.useState)("");
    const [note, setNote] = (0, react_1.useState)("");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)("");
    const compatibleLines = model ? lines.filter((line) => (0, BusinessLineTabs_jsx_1.modelsForLine)(line).includes(model)) : [];
    const selectedLineId = compatibleLines.some((line) => line.id === lineId)
        ? lineId
        : (compatibleLines.length === 1 ? compatibleLines[0].id : "");
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await (0, client_js_1.apiRequest)(`/ventures/${ventureId}/seam-actions`, {
                method: "POST",
                body: { action: "CLARIFY_MODEL", approved_model: model, business_line_id: selectedLineId || undefined, note: note || undefined },
                role,
            });
            onDone();
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (React.createElement(Modal_jsx_1.default, { title: `Clarify Governing Model · ${venture?.name ?? ventureId}`, onClose: onClose },
        React.createElement("form", { onSubmit: submit, className: "flex flex-col gap-3" },
            React.createElement("p", { className: "text-sm text-muted" }, "Prior tracks stay visible as historical records \u2014 clarification never deletes review history."),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Governing model"),
                React.createElement("select", { value: model, onChange: (e) => setModel(e.target.value), className: inputCls, required: true },
                    React.createElement("option", { value: "" }, "\u2014 Select \u2014"),
                    ["Consumer", "Services", "AI_B2C", "AI_B2B"].map((m) => React.createElement("option", { key: m, value: m }, m)))),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Governing business line"),
                React.createElement("select", { value: selectedLineId, onChange: (e) => setLineId(e.target.value), className: inputCls, disabled: !model || !compatibleLines.length },
                    React.createElement("option", { value: "" }, "\u2014 Select a compatible line \u2014"),
                    compatibleLines.map((l) => React.createElement("option", { key: l.id, value: l.id }, l.line_name)))),
            model && !compatibleLines.length ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" },
                "No business line is compatible with ",
                model,
                ". Select a different model or clarify the line data first.") : null,
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Note"),
                React.createElement("input", { value: note, onChange: (e) => setNote(e.target.value), placeholder: "Programme owner clarification", className: inputCls })),
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            React.createElement("div", { className: "flex justify-end gap-2" },
                React.createElement(Button_jsx_1.default, { type: "button", onClick: onClose }, "Cancel"),
                React.createElement(Button_jsx_1.default, { type: "submit", variant: "primary", disabled: busy || !selectedLineId }, busy ? "Saving…" : "Confirm Model")))));
}
function MentorModal({ norm, ventureId, role, onClose, onDone }) {
    const venture = norm.venturesById[ventureId];
    const [f, setF] = (0, react_1.useState)({ mentor_goal: venture?.mentor_goal ?? "", mentor_status: venture?.mentor_status ?? "", next_update_date: venture?.next_update_date ?? "", follow_up_note: venture?.follow_up_note ?? "" });
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)("");
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await (0, client_js_1.apiRequest)(`/ventures/${ventureId}/seam-actions`, { method: "POST", body: { action: "LOG_MENTOR_OUTCOME", ...f }, role });
            onDone();
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (React.createElement(Modal_jsx_1.default, { title: `Record Mentor Outcome · ${venture?.name ?? ventureId}`, onClose: onClose },
        React.createElement("form", { onSubmit: submit, className: "flex flex-col gap-3" },
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Mentor goal"),
                React.createElement("input", { value: f.mentor_goal, onChange: set("mentor_goal"), className: inputCls })),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Mentor status"),
                React.createElement("input", { value: f.mentor_status, onChange: set("mentor_status"), className: inputCls })),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Next update date"),
                React.createElement("input", { value: f.next_update_date, onChange: set("next_update_date"), placeholder: "e.g. 2026-11-20", className: inputCls })),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Follow-up note"),
                React.createElement("textarea", { value: f.follow_up_note, onChange: set("follow_up_note"), rows: 2, className: inputCls })),
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            React.createElement("div", { className: "flex justify-end gap-2" },
                React.createElement(Button_jsx_1.default, { type: "button", onClick: onClose }, "Cancel"),
                React.createElement(Button_jsx_1.default, { type: "submit", variant: "primary", disabled: busy }, busy ? "Saving…" : "Save Outcome")))));
}
function MslModal({ norm, ventureId, role, onClose, onDone }) {
    const venture = norm.venturesById[ventureId];
    const [reason, setReason] = (0, react_1.useState)("");
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)("");
    const [blockers, setBlockers] = (0, react_1.useState)([]);
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        setBlockers([]);
        try {
            await (0, client_js_1.apiRequest)(`/ventures/${ventureId}/msl-eligibility`, {
                method: "POST",
                body: { approved_by: "Demo Programme Reviewer", reason },
                role,
            });
            onDone();
        }
        catch (err) {
            setError(err.message);
            setBlockers(err.blockingReasons ?? []);
        }
        finally {
            setBusy(false);
        }
    }
    return (React.createElement(Modal_jsx_1.default, { title: `Certify MSL Eligibility · ${venture?.name ?? ventureId}`, onClose: onClose },
        React.createElement("form", { onSubmit: submit, className: "flex flex-col gap-3" },
            React.createElement("p", { className: "text-sm text-muted" }, "New certification needs a confirmed model and every MSL checklist item met. Imported eligibility on other ventures is preserved regardless."),
            React.createElement("label", { className: "block" },
                React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Reviewer reason"),
                React.createElement("textarea", { required: true, value: reason, onChange: (e) => setReason(e.target.value), rows: 2, placeholder: "Verified complete MSL checklist\u2026", className: inputCls })),
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            React.createElement(BlockerList, { reasons: blockers }),
            React.createElement("div", { className: "flex justify-end gap-2" },
                React.createElement(Button_jsx_1.default, { type: "button", onClick: onClose }, "Cancel"),
                React.createElement(Button_jsx_1.default, { type: "submit", variant: "primary", disabled: busy }, busy ? "Certifying…" : "Certify Eligible")))));
}
function CriterionDrawer({ norm, criterionId, onClose }) {
    const c = norm.catalogById[criterionId];
    if (!c)
        return null;
    const subconds = (0, format_js_1.parseJSON)(c.subconditions_json, null)?.subconditions ?? null;
    return (React.createElement(Drawer_jsx_1.default, { title: `${c.id} · ${c.name}`, subtitle: c.transition_gate, onClose: onClose },
        React.createElement("div", { className: "flex flex-col gap-3 text-sm" },
            React.createElement("p", { className: "text-nav" }, c.threshold_description ?? c.name),
            React.createElement("dl", { className: "rounded-xl border border-border-ui bg-white px-4 py-2" },
                React.createElement("div", { className: "flex justify-between py-1" },
                    React.createElement("dt", { className: "text-muted" }, "Scope"),
                    React.createElement("dd", { className: "text-nav" },
                        c.criterion_scope,
                        " \u00B7 ",
                        c.business_model)),
                React.createElement("div", { className: "flex justify-between py-1" },
                    React.createElement("dt", { className: "text-muted" }, "Unit"),
                    React.createElement("dd", { className: "font-mono text-xs text-nav" }, c.unit)),
                c.threshold_value != null ? React.createElement("div", { className: "flex justify-between py-1" },
                    React.createElement("dt", { className: "text-muted" }, "Threshold"),
                    React.createElement("dd", { className: "text-nav" },
                        c.threshold_value,
                        c.window_length ? ` × ${c.window_length}` : "")) : null,
                c.is_configurable_range ? React.createElement("div", { className: "flex justify-between py-1" },
                    React.createElement("dt", { className: "text-muted" }, "Configurable"),
                    React.createElement("dd", { className: "text-nav" }, c.configured_value ?? "Unconfigured (BLOCKED)")) : null),
            subconds ? (React.createElement("ul", { className: "list-disc pl-5 text-muted" }, subconds.map((s) => React.createElement("li", { key: s.id }, s.description)))) : null)));
}

};
modules["src/components/FinancialLedger.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FinancialLedger;
const React = __importStar(require("react"));
const format_js_1 = require("../utils/format.js");
const status_js_1 = require("../utils/status.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const StatusBadge_jsx_1 = __importDefault(require("./ui/StatusBadge.jsx"));
const EmptyState_jsx_1 = require("./ui/EmptyState.jsx");
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
function DualLedgerRow({ label, claimedDisplay, verifiedDisplay, verifiedFallback = "Unknown", highlightDiff = false }) {
    return (React.createElement("tr", { className: highlightDiff ? "border-t border-border-ui bg-slate-50/70 font-medium" : "border-t border-slate-100" },
        React.createElement("th", { scope: "row", className: "py-2 pr-3 text-left font-normal text-nav" }, label),
        React.createElement("td", { className: "py-2 px-3 text-right font-mono text-xs font-semibold text-amber-900" }, claimedDisplay ?? "Unknown"),
        React.createElement("td", { className: "py-2 pl-3 text-right font-mono text-xs font-semibold text-nav" }, verifiedDisplay ?? React.createElement("span", { className: "font-sans font-normal text-muted" }, verifiedFallback))));
}
function EvidenceCard({ ev, history, role, onReview }) {
    const children = history?._children ?? [];
    const canDecide = (0, status_js_1.can)(role, "review_evidence");
    return (React.createElement("article", { className: "rounded-xl border border-border-ui bg-white px-4 py-3" },
        React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
            React.createElement("p", { className: "font-mono text-xs font-semibold text-nav" }, ev.id),
            React.createElement(StatusBadge_jsx_1.default, { status: ev.evidence_status }),
            React.createElement("span", { className: "text-xs text-muted" },
                ev.source_type,
                " \u00B7 ",
                ev.ledger_bucket ?? "no bucket"),
            React.createElement("span", { className: "ml-auto" }),
            React.createElement(Button_jsx_1.default, { onClick: () => onReview(ev.id) }, canDecide ? "Review" : "View details")),
        ev.detail_note ? React.createElement("p", { className: "mt-1.5 text-sm text-nav" }, ev.detail_note) : null,
        React.createElement("dl", { className: "mt-1 text-xs text-muted" },
            ev.amount_minor_or_count != null ? React.createElement("p", null,
                "Amount: ",
                React.createElement("span", { className: "font-mono" }, ev.unit === "INR_PAISE" ? (0, format_js_1.formatINRPaise)(ev.amount_minor_or_count) : ev.amount_minor_or_count)) : null,
            ev.period_label ? React.createElement("p", null,
                "Period: ",
                ev.period_label) : null,
            ev.earned_period ? React.createElement("p", null,
                "Earned: ",
                ev.earned_period) : null,
            ev.payment_date ? React.createElement("p", null,
                "Paid: ",
                ev.payment_date) : null,
            ev.parent_evidence_id ? React.createElement("p", { className: "font-mono" },
                "\u21B3 settles ",
                ev.parent_evidence_id) : null,
            children.length ? React.createElement("p", { className: "font-mono" },
                "\u21B3 settled by ",
                children.map((c) => c.id).join(", ")) : null,
            ev.reviewer ? React.createElement("p", null,
                "Last review: ",
                ev.reviewer,
                " \u00B7 ",
                (0, format_js_1.formatDateTime)(ev.reviewed_at)) : null),
        history?.items?.length ? (React.createElement("ul", { className: "mt-2 flex flex-col gap-1 border-t border-border-ui pt-2" }, history.items.map((h) => (React.createElement("li", { key: h.id, className: "flex flex-wrap items-center gap-2 text-xs" },
            React.createElement(StatusBadge_jsx_1.default, { status: h.decision }),
            React.createElement("span", { className: "text-muted" },
                h.reviewer,
                " \u00B7 ",
                (0, format_js_1.formatDateTime)(h.reviewed_at)),
            React.createElement("span", { className: "w-full text-nav" }, h.reason)))))) : null));
}
function FinancialLedger({ norm, ventureId, role, onReview }) {
    var _a;
    const lines = norm.linesByVenture[ventureId] ?? [];
    const venture = norm.venturesById[ventureId];
    const evidence = norm.evidence.filter((e) => e.venture_id === ventureId);
    const byParent = {};
    for (const e of evidence) {
        if (e.parent_evidence_id)
            (byParent[_a = e.parent_evidence_id] ?? (byParent[_a] = [])).push(e);
    }
    const roots = evidence.filter((e) => !e.parent_evidence_id);
    const histOf = (id) => ({ items: norm.historyByEvidence[id] ?? [], _children: byParent[id] ?? [] });
    return (React.createElement("div", { className: "flex flex-col gap-5" },
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Reconciled ledgers (Claimed vs. Verified)", subtitle: "Submitted claims are shown beside verified (Approved) figures. Arithmetic differences in claims are never certified as verified balances." }),
            React.createElement("div", { className: "grid grid-cols-1 gap-3 lg:grid-cols-2" }, lines.map((l) => {
                const led = norm.ledgerByLine[`${ventureId}|${l.id}`];
                if (!led)
                    return null;
                const hasEarned = led.claimed_earned_paise != null || led.earned_paise != null;
                const hasBilled = led.claimed_billed_paise != null || led.billed_paise != null;
                const verifiedPeriod = led.earned_period && led.earned_period !== "Unknown" ? led.earned_period : "Unknown";
                const claimedPeriod = led.claimed_earned_period && led.claimed_earned_period !== "Unknown" ? led.claimed_earned_period : "Unknown";
                const earnedLabel = verifiedPeriod === claimedPeriod
                    ? (verifiedPeriod === "Unknown" ? "Earned (period Unknown)" : `${verifiedPeriod} earned`)
                    : `Earned (claimed ${claimedPeriod}; verified ${verifiedPeriod})`;
                const receivedLabel = verifiedPeriod === claimedPeriod
                    ? (verifiedPeriod === "Unknown" ? "Received against Unknown" : `Received against ${verifiedPeriod}`)
                    : `Received (claimed ${claimedPeriod}; verified ${verifiedPeriod})`;
                const diffFallback = led.verified_balance_note ?? (hasEarned ? "Not a verified receivable" : "Not a verified outstanding balance");
                return (React.createElement("div", { key: l.id, className: "rounded-xl border border-border-ui bg-white px-4 py-3" },
                    React.createElement("div", { className: "flex items-center justify-between gap-2" },
                        React.createElement("p", { className: "text-sm font-semibold text-nav" }, l.line_name),
                        React.createElement("span", { className: "font-mono text-xs text-muted" }, l.track_role)),
                    React.createElement("div", { className: "mt-2 overflow-x-auto" },
                        React.createElement("table", { className: "w-full text-sm" },
                            React.createElement("thead", null,
                                React.createElement("tr", { className: "text-xs uppercase tracking-wide text-muted" },
                                    React.createElement("th", { className: "pb-1.5 text-left font-semibold" }, "Value"),
                                    React.createElement("th", { className: "pb-1.5 px-3 text-right font-semibold" }, "Claimed (Submitted)"),
                                    React.createElement("th", { className: "pb-1.5 pl-3 text-right font-semibold" }, "Verified (Approved)"))),
                            React.createElement("tbody", null,
                                hasBilled || !hasEarned ? (React.createElement(DualLedgerRow, { label: hasEarned && hasBilled ? "Sponsorship billed (invoice)" : "Billed", claimedDisplay: led.claimed_billed_display, verifiedDisplay: led.billed_display })) : null,
                                hasEarned ? (React.createElement(DualLedgerRow, { label: earnedLabel, claimedDisplay: led.claimed_earned_display, verifiedDisplay: led.earned_display })) : null,
                                React.createElement(DualLedgerRow, { label: hasEarned ? receivedLabel : "Collected", claimedDisplay: led.claimed_collected_display, verifiedDisplay: led.collected_display }),
                                React.createElement(DualLedgerRow, { label: "Arithmetic difference", claimedDisplay: led.claimed_arithmetic_difference_display, verifiedDisplay: led.arithmetic_difference_display, verifiedFallback: diffFallback, highlightDiff: true })))),
                    React.createElement("div", { className: "mt-2 space-y-1 text-xs text-muted" },
                        (led.claimed_signed_lois || led.signed_lois) ? (React.createElement("p", { className: "rounded-lg bg-slate-50 px-2.5 py-1.5" },
                            "Commercial intent: ",
                            React.createElement("span", { className: "font-semibold text-nav" },
                                led.claimed_signed_lois ?? 0,
                                " claimed LOI(s)"),
                            " \u00B7",
                            " ",
                            React.createElement("span", { className: "font-semibold text-nav" },
                                led.signed_lois ?? 0,
                                " verified LOI(s)"),
                            " \u2014 \u20B90 revenue contribution.")) : null,
                        React.createElement("p", { className: "rounded-lg bg-slate-50 px-2.5 py-1.5" },
                            React.createElement("span", { className: "font-semibold text-nav" }, led.completed_pilots == null ? "Unknown completed pilots" : `${led.completed_pilots} completed pilot(s)`),
                            "."))));
            })),
            venture?.historical_traction_text ? (React.createElement("div", { className: "mt-3 rounded-xl border border-dashed border-border-ui bg-white px-4 py-3 text-sm" },
                React.createElement("p", { className: "font-semibold text-nav" },
                    "Imported historical statement: ",
                    venture.historical_traction_text),
                React.createElement("p", { className: "mt-0.5 text-muted" }, "Period unknown \u00B7 isolated from granular evidence \u00B7 never summed into the ledgers above."))) : null),
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Evidence records", subtitle: `${evidence.length} record${evidence.length === 1 ? "" : "s"} · settlements nested under their obligations.` }),
            evidence.length === 0 ? (React.createElement(EmptyState_jsx_1.EmptyState, { title: "No evidence yet", hint: "Submit a progress update to create the first record." })) : (React.createElement("div", { className: "flex flex-col gap-3" }, roots.map((e) => (React.createElement("div", { key: e.id, className: "flex flex-col gap-2" },
                React.createElement(EvidenceCard, { ev: e, history: histOf(e.id), role: role, onReview: onReview }),
                (byParent[e.id] ?? []).map((c) => (React.createElement("div", { key: c.id, className: "ml-4 border-l-2 border-border-ui pl-3 sm:ml-8" },
                    React.createElement(EvidenceCard, { ev: c, history: histOf(c.id), role: role, onReview: onReview }))))))))))));
}

};
modules["src/components/ImportVentureModal.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ImportVentureModal;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const client_js_1 = require("../api/client.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const Modal_jsx_1 = __importDefault(require("./ui/Modal.jsx"));
const MODELS = ["", "Consumer", "Services", "AI_B2C", "AI_B2B"];
const LEVELS = ["", "Level 0", "Level 1", "Level 2"];
const UNRESOLVED_ROLES = ["ASSIGNED_IN_TRACKER", "CANDIDATE", "PROVISIONAL", "HISTORICAL_PRESERVED"];
const CONFIRMED_ROLES = ["ACTIVE_GOVERNING", "ASSIGNED_IN_TRACKER", "CANDIDATE", "PROVISIONAL", "HISTORICAL_PRESERVED"];
function field(label, control, hint) {
    return (React.createElement("label", { className: "block" },
        React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, label),
        control,
        hint ? React.createElement("span", { className: "mt-1 block text-xs text-muted" }, hint) : null));
}
const inputCls = "w-full rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav placeholder:text-muted";
function ImportVentureModal({ role, onClose, onCreated }) {
    const [form, setForm] = (0, react_1.useState)({
        name: "",
        activity: "",
        source_type: "Imported from tracker",
        tracker_sector: "",
        primary_business_model: "",
        model_resolution_status: "UNRESOLVED",
        programme_level: "",
        development_stage: "",
        fundraising_preference: "",
    });
    const [lines, setLines] = (0, react_1.useState)([
        { line_name: "", model: "", track_role: "ASSIGNED_IN_TRACKER" },
    ]);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)("");
    const set = (k) => (e) => {
        const val = e.target.value;
        setForm((f) => {
            const next = { ...f, [k]: val };
            if (k === "model_resolution_status" && val === "UNRESOLVED") {
                next.primary_business_model = "";
                setLines((prev) => prev.map((l) => ({
                    ...l,
                    track_role: l.track_role === "ACTIVE_GOVERNING" ? "ASSIGNED_IN_TRACKER" : l.track_role,
                })));
            }
            else if (k === "model_resolution_status" && val === "CONFIRMED") {
                setLines((prev) => {
                    if (!prev.length)
                        return [{ line_name: "Primary line", model: next.primary_business_model || "Services", track_role: "ACTIVE_GOVERNING" }];
                    return prev.map((l, idx) => (idx === 0 ? { ...l, track_role: "ACTIVE_GOVERNING", model: l.model || next.primary_business_model } : l));
                });
            }
            return next;
        });
    };
    function validateForm() {
        const trimmedName = form.name.trim();
        if (!trimmedName || trimmedName.toLowerCase() === "untitled venture") {
            return "Venture name is required.";
        }
        if (!form.activity.trim()) {
            return "Activity is required for an imported or manually entered venture.";
        }
        if (!form.source_type.trim()) {
            return "Source reference / provenance is required (e.g. Imported from tracker or Manual entry).";
        }
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            const hasAny = l.line_name.trim() || l.model;
            if (!hasAny && lines.length === 1 && form.model_resolution_status === "UNRESOLVED") {
                continue;
            }
            if (!l.line_name.trim()) {
                return `Business line ${i + 1} requires a line name (or remove the empty row).`;
            }
            if (!l.model) {
                return `Business line "${l.line_name.trim()}" requires a business model.`;
            }
        }
        const nonEmptyLines = lines.filter((l) => l.line_name.trim() && l.model);
        if (form.model_resolution_status === "UNRESOLVED") {
            if (form.primary_business_model) {
                return "When model resolution is UNRESOLVED, governing business model must remain Unresolved.";
            }
            if (nonEmptyLines.some((l) => l.track_role === "ACTIVE_GOVERNING")) {
                return "When model resolution is UNRESOLVED, no business line may be ACTIVE_GOVERNING.";
            }
        }
        else {
            if (!form.primary_business_model) {
                return "When model resolution is CONFIRMED, select the confirmed governing business model.";
            }
            const govLines = nonEmptyLines.filter((l) => l.track_role === "ACTIVE_GOVERNING");
            if (govLines.length !== 1) {
                return "When model resolution is CONFIRMED, exactly one business line must be ACTIVE_GOVERNING.";
            }
            if (govLines[0].model !== form.primary_business_model) {
                return `The ACTIVE_GOVERNING line model (${govLines[0].model}) must match the confirmed governing model (${form.primary_business_model}).`;
            }
        }
        return null;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: form.name.trim(),
                activity: form.activity.trim(),
                programme_level_provenance: form.source_type.trim(),
                model_resolution_status: form.model_resolution_status,
            };
            if (form.model_resolution_status === "CONFIRMED" && form.primary_business_model) {
                body.primary_business_model = form.primary_business_model;
            }
            for (const k of ["tracker_sector", "programme_level", "development_stage", "fundraising_preference"]) {
                if (form[k]?.trim())
                    body[k] = form[k].trim();
            }
            const bl = lines
                .filter((l) => l.line_name.trim() && l.model)
                .map((l) => ({
                line_name: l.line_name.trim(),
                approved_model: form.model_resolution_status === "CONFIRMED" && l.track_role === "ACTIVE_GOVERNING" ? l.model : null,
                track_role: l.track_role,
                candidate_models: [l.model],
            }));
            if (bl.length)
                body.business_lines = bl;
            const created = await (0, client_js_1.apiRequest)("/ventures", { method: "POST", body, role });
            onCreated(created.id);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setSaving(false);
        }
    }
    const allowedRoles = form.model_resolution_status === "CONFIRMED" ? CONFIRMED_ROLES : UNRESOLVED_ROLES;
    return (React.createElement(Modal_jsx_1.default, { title: "Import Venture", onClose: onClose, wide: true },
        React.createElement("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", noValidate: true },
            React.createElement("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2" },
                field("Venture name *", React.createElement("input", { value: form.name, onChange: set("name"), required: true, placeholder: "e.g. Case D \u2014 Industrial Vision", className: inputCls })),
                field("Activity *", React.createElement("input", { value: form.activity, onChange: set("activity"), required: true, placeholder: "What the venture does", className: inputCls })),
                field("Source / Provenance *", React.createElement("input", { value: form.source_type, onChange: set("source_type"), required: true, placeholder: "e.g. Imported from tracker or Manual entry", className: inputCls }), "Preserved alongside Unknown fields."),
                field("Tracker sector (legacy label)", React.createElement("input", { value: form.tracker_sector, onChange: set("tracker_sector"), placeholder: "Leave blank \u2192 Unknown", className: inputCls })),
                field("Model resolution", (React.createElement("select", { value: form.model_resolution_status, onChange: set("model_resolution_status"), className: inputCls },
                    React.createElement("option", { value: "UNRESOLVED" }, "UNRESOLVED (Owner clarification required)"),
                    React.createElement("option", { value: "CONFIRMED" }, "CONFIRMED")))),
                field("Governing business model", (React.createElement("select", { value: form.model_resolution_status === "UNRESOLVED" ? "" : form.primary_business_model, onChange: set("primary_business_model"), disabled: form.model_resolution_status === "UNRESOLVED", className: `${inputCls} disabled:bg-slate-100 disabled:text-muted` }, MODELS.map((m) => (React.createElement("option", { key: m, value: m }, m || (form.model_resolution_status === "UNRESOLVED" ? "— Unresolved (locked until CONFIRMED) —" : "— Select confirmed model —")))))), "Criteria attach to models, never to tracker sectors."),
                field("Programme level", (React.createElement("select", { value: form.programme_level, onChange: set("programme_level"), className: inputCls }, LEVELS.map((l) => React.createElement("option", { key: l, value: l }, l || "— Unknown —"))))),
                field("Development stage", React.createElement("input", { value: form.development_stage, onChange: set("development_stage"), placeholder: "Leave blank \u2192 Unknown", className: inputCls })),
                field("Fundraising preference", React.createElement("input", { value: form.fundraising_preference, onChange: set("fundraising_preference"), placeholder: "Leave blank \u2192 Unknown", className: inputCls }), "Never affects MSL eligibility.")),
            React.createElement("div", null,
                React.createElement("p", { className: "mb-2 text-sm font-medium text-nav" }, "Business lines"),
                React.createElement("div", { className: "flex flex-col gap-2" }, lines.map((l, i) => (React.createElement("div", { key: i, className: "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_12rem_auto]" },
                    React.createElement("input", { value: l.line_name, onChange: (e) => setLines((p) => p.map((x, j) => j === i ? { ...x, line_name: e.target.value } : x)), placeholder: "Line name (e.g. AI B2C Assigned)", "aria-label": `Business line ${i + 1} name`, className: inputCls }),
                    React.createElement("select", { value: l.model, onChange: (e) => setLines((p) => p.map((x, j) => j === i ? { ...x, model: e.target.value } : x)), "aria-label": `Business line ${i + 1} model`, className: inputCls }, MODELS.map((m) => React.createElement("option", { key: m, value: m }, m || "— model —"))),
                    React.createElement("select", { value: l.track_role, onChange: (e) => setLines((p) => p.map((x, j) => j === i ? { ...x, track_role: e.target.value } : x)), "aria-label": `Business line ${i + 1} role`, className: inputCls }, allowedRoles.map((r) => React.createElement("option", { key: r, value: r }, r))),
                    React.createElement("button", { type: "button", onClick: () => setLines((p) => p.filter((_, j) => j !== i)), "aria-label": `Remove line ${i + 1}`, className: "rounded-lg p-2 text-muted hover:bg-slate-100" },
                        React.createElement(lucide_react_1.Trash2, { size: 16 })))))),
                React.createElement(Button_jsx_1.default, { type: "button", onClick: () => setLines((p) => [...p, { line_name: "", model: "", track_role: form.model_resolution_status === "CONFIRMED" && p.length === 0 ? "ACTIVE_GOVERNING" : "ASSIGNED_IN_TRACKER" }]), className: "mt-2" },
                    React.createElement(lucide_react_1.Plus, { size: 15, "aria-hidden": true }),
                    " Add line")),
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            React.createElement("div", { className: "flex justify-end gap-2" },
                React.createElement(Button_jsx_1.default, { type: "button", onClick: onClose }, "Cancel"),
                React.createElement(Button_jsx_1.default, { type: "submit", variant: "primary", disabled: saving }, saving ? "Importing…" : "Import Venture")))));
}

};
modules["src/components/layout/AppShell.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppShell;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const Sidebar_jsx_1 = __importDefault(require("./Sidebar.jsx"));
const Topbar_jsx_1 = __importDefault(require("./Topbar.jsx"));
const MOBILE_ITEMS = [
    { id: "queue", label: "Work Queue", icon: lucide_react_1.Inbox },
    { id: "ventures", label: "Ventures", icon: lucide_react_1.Briefcase },
    { id: "notes", label: "System Notes", icon: lucide_react_1.FileText },
];
function AppShell(props) {
    const { queueCount, scrollKey, children } = props;
    const mainRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }
    }, [scrollKey]);
    return (React.createElement("div", { className: "flex h-screen overflow-hidden bg-canvas text-nav" },
        React.createElement(Sidebar_jsx_1.default, { activePage: props.activePage, onNavigate: props.onNavigate, counts: queueCount }),
        React.createElement("div", { className: "flex min-w-0 flex-1 flex-col" },
            React.createElement(Topbar_jsx_1.default, { activePage: props.activePage, onNavigate: props.onNavigate, role: props.role, onRoleChange: props.onRoleChange, search: props.search, onSearch: props.onSearch, onExport: props.onExport, onResetRequest: props.onResetRequest, onPalette: props.onPalette, busy: props.busy }),
            React.createElement("main", { ref: mainRef, className: "min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0" },
                React.createElement("div", { className: "mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8" }, children)),
            React.createElement("nav", { "aria-label": "Primary mobile", className: "fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-border-ui bg-white px-2 md:hidden" }, MOBILE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = props.activePage === item.id;
                return (React.createElement("button", { key: item.id, type: "button", onClick: () => props.onNavigate(item.id), "aria-current": active ? "page" : undefined, className: `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium ${active ? "text-brand" : "text-muted hover:text-nav"}` },
                    React.createElement(Icon, { size: 17, "aria-hidden": true }),
                    React.createElement("span", null, item.label)));
            })))));
}

};
modules["src/components/layout/Sidebar.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Sidebar;
const React = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const ITEMS = [
    { id: "queue", label: "Work Queue", icon: lucide_react_1.Inbox },
    { id: "ventures", label: "Ventures", icon: lucide_react_1.Briefcase },
    { id: "notes", label: "System Notes", icon: lucide_react_1.FileText },
];
function Sidebar({ activePage, onNavigate, counts }) {
    return (React.createElement("nav", { "aria-label": "Primary", className: "hidden w-60 shrink-0 flex-col bg-nav text-slate-200 md:flex" },
        React.createElement("div", { className: "px-5 pb-4 pt-6" },
            React.createElement("p", { className: "text-lg font-bold tracking-tight text-white" }, "ILS Desk"),
            React.createElement("p", { className: "mt-0.5 text-xs text-slate-400" }, "Venture Progress & Readiness")),
        React.createElement("ul", { className: "flex flex-col gap-1 px-3" }, ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (React.createElement("li", { key: item.id },
                React.createElement("button", { onClick: () => onNavigate(item.id), "aria-current": active ? "page" : undefined, className: `flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}` },
                    React.createElement(Icon, { size: 17, "aria-hidden": true }),
                    React.createElement("span", { className: "flex-1 text-left" }, item.label),
                    item.id === "queue" && counts > 0 ? (React.createElement("span", { className: "rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white" }, counts)) : null)));
        })),
        React.createElement("div", { className: "mt-auto px-5 py-4 text-xs leading-relaxed text-slate-400" },
            "Demo roles only.",
            React.createElement("br", null),
            "X-ILS-Role seam.")));
}

};
modules["src/components/layout/Topbar.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Topbar;
const React = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const status_js_1 = require("../../utils/status.js");
function Topbar({ role, onRoleChange, search, onSearch, onExport, onResetRequest, onPalette, busy, }) {
    const showExport = (0, status_js_1.can)(role, "export_data");
    const showReset = (0, status_js_1.can)(role, "reset_seed");
    return (React.createElement("header", { className: "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-ui bg-white px-3 sm:h-16 sm:px-6" },
        React.createElement("div", { className: "min-w-0 shrink-0 sm:hidden" },
            React.createElement("p", { className: "text-sm font-bold tracking-tight text-nav" }, "ILS Desk")),
        React.createElement("div", { className: "relative hidden min-w-0 flex-1 sm:block sm:max-w-xs" },
            React.createElement(lucide_react_1.Search, { size: 16, className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted", "aria-hidden": true }),
            React.createElement("input", { value: search, onChange: (e) => onSearch(e.target.value), placeholder: "Search ventures", "aria-label": "Search ventures", className: "w-full rounded-lg bg-white py-2 pl-9 pr-3 text-sm text-nav ring-1 ring-inset ring-border-ui placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand" })),
        React.createElement("div", { className: "flex items-center gap-1.5 sm:gap-2" },
            React.createElement("label", { className: "flex items-center gap-1.5 text-xs text-muted sm:text-sm" },
                React.createElement("span", { className: "hidden sm:inline", "aria-hidden": true }, "Role (Demo Seam)"),
                React.createElement("select", { value: role, onChange: (e) => onRoleChange(e.target.value), "aria-label": "Simulated role", title: `Simulated role: ${(0, status_js_1.roleLabel)(role)}`, className: "rounded-lg border border-border-ui bg-white px-2.5 py-1.5 text-xs font-medium text-nav sm:text-sm" }, status_js_1.ROLES.map((r) => (React.createElement("option", { key: r.id, value: r.id }, r.label))))),
            React.createElement("button", { onClick: onPalette, title: "Command palette (Ctrl+K)", "aria-label": "Open command palette", className: "hidden items-center gap-1.5 rounded-lg px-2 py-2 text-muted ring-1 ring-inset ring-border-ui hover:bg-slate-50 sm:flex" },
                React.createElement(lucide_react_1.Command, { size: 16, "aria-hidden": true }),
                React.createElement("kbd", { className: "font-mono text-[11px]" }, "\u2318K")),
            showExport ? (React.createElement("button", { onClick: onExport, disabled: busy, title: "Export all data (JSON)", "aria-label": "Export data", className: "rounded-lg p-2 text-muted hover:bg-slate-100 disabled:opacity-50" },
                React.createElement(lucide_react_1.Download, { size: 18 }))) : null,
            showReset ? (React.createElement("button", { onClick: onResetRequest, disabled: busy, title: "Reset to seed data", "aria-label": "Reset to seed data", className: "rounded-lg p-2 text-muted hover:bg-slate-100 disabled:opacity-50" },
                React.createElement(lucide_react_1.RotateCcw, { size: 18 }))) : null)));
}

};
modules["src/components/ReviewModal.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReviewModal;
const React = __importStar(require("react"));
const react_1 = require("react");
const client_js_1 = require("../api/client.js");
const status_js_1 = require("../utils/status.js");
const format_js_1 = require("../utils/format.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const Drawer_jsx_1 = __importDefault(require("./ui/Drawer.jsx"));
const StatusBadge_jsx_1 = __importDefault(require("./ui/StatusBadge.jsx"));
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
function KV({ k, v, mono }) {
    return (React.createElement("div", { className: "flex items-start justify-between gap-3 py-1 text-sm" },
        React.createElement("dt", { className: "shrink-0 text-muted" }, k),
        React.createElement("dd", { className: `min-w-0 text-right text-nav ${mono ? "font-mono text-xs" : ""}` }, v ?? "—")));
}
function ReviewModal({ evidenceId, norm, role, onClose, onDecided, onOpenCriterion }) {
    const ev = norm.evidenceById[evidenceId];
    const [reason, setReason] = (0, react_1.useState)("");
    const [touched, setTouched] = (0, react_1.useState)(false);
    const [saving, setSaving] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)("");
    const [done, setDone] = (0, react_1.useState)(null);
    const obs = (0, react_1.useMemo)(() => norm.obsByEvidence[evidenceId] ?? [], [norm, evidenceId]);
    const history = (0, react_1.useMemo)(() => norm.historyByEvidence[evidenceId] ?? [], [norm, evidenceId]);
    const obsByCriterion = (0, react_1.useMemo)(() => {
        const groups = new Map();
        for (const o of obs) {
            const cid = o.criterion_id || "UNLINKED";
            if (!groups.has(cid))
                groups.set(cid, []);
            groups.get(cid).push(o);
        }
        return [...groups.entries()];
    }, [obs]);
    const pendingAgainst = (0, react_1.useMemo)(() => {
        const mine = new Set(obs.map((o) => o.id));
        return norm.observations.filter((o) => o.supersedes_observation_id && mine.has(o.supersedes_observation_id)
            && (norm.evidenceById[o.evidence_id]?.evidence_status ?? "UNREVIEWED") !== "APPROVED");
    }, [norm, obs]);
    const hints = (0, react_1.useMemo)(() => {
        const out = [];
        for (const o of obs) {
            const cat = norm.catalogById[o.criterion_id];
            if (!cat)
                continue;
            if (o.criterion_id === "L0L1-AIB2C-2" && o.numeric_value != null && o.numeric_value < 10) {
                out.push(`Week “${o.period_label}” WAU (${o.numeric_value}) is below the 10 threshold.`);
            }
            if (o.criterion_id === "L0L1-AIB2C-1" && (o.qualifier_status ?? "").includes("unrecorded")) {
                out.push("Target-segment membership of the sign-ups is not recorded — sign-up criterion cannot verify.");
            }
            if (cat.unit === "INR_PAISE" && o.numeric_value == null) {
                out.push(`${cat.id}: amount observation missing; cash criteria evaluate from approved COLLECTED records.`);
            }
        }
        return [...new Set(out)];
    }, [obs, norm]);
    if (!ev)
        return null;
    const venture = norm.venturesById[ev.venture_id];
    const reasonInvalid = touched && !reason.trim();
    const reviewerAllowed = (0, status_js_1.canReview)(role);
    async function decide(decision) {
        setTouched(true);
        if (!reason.trim() || !reviewerAllowed)
            return;
        setSaving(decision);
        setError("");
        try {
            const res = await (0, client_js_1.apiRequest)(`/evidence/${evidenceId}/review`, {
                method: "POST",
                body: { decision, reviewer: "Demo Programme Reviewer", reason: reason.trim() },
                role,
            });
            setDone(res);
            onDecided(res);
        }
        catch (err) {
            setError(err.blockingReasons?.length ? `${err.message} — ${err.blockingReasons.join("; ")}` : err.message);
        }
        finally {
            setSaving(null);
        }
    }
    const allCriteriaMeasured = obsByCriterion
        .map(([cid]) => cid)
        .filter((cid) => cid !== "UNLINKED");
    if (ev.criterion_id && !allCriteriaMeasured.includes(ev.criterion_id)) {
        allCriteriaMeasured.push(ev.criterion_id);
    }
    return (React.createElement(Drawer_jsx_1.default, { title: `${reviewerAllowed ? "Review Evidence" : "Evidence Details"} · ${ev.id}`, subtitle: `${venture?.name ?? ev.venture_id} · ${ev.source_type ?? "Evidence"}`, onClose: onClose, footer: reviewerAllowed ? (React.createElement("div", { className: "flex flex-col gap-2" },
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            done ? (React.createElement("p", { role: "status", className: "rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800" },
                "Saved: ",
                done.evidence_status,
                " by ",
                done.reviewer,
                " at ",
                (0, format_js_1.formatDateTime)(done.reviewed_at),
                ". Criterion results refreshed from the server.")) : null,
            React.createElement("div", { className: "flex gap-2" },
                React.createElement(Button_jsx_1.default, { variant: "secondary", className: "flex-1", disabled: saving !== null, onClick: () => decide("CHANGES_REQUESTED") }, saving === "CHANGES_REQUESTED" ? "Saving…" : "Request Changes"),
                React.createElement(Button_jsx_1.default, { variant: "primary", className: "flex-1", disabled: saving !== null, onClick: () => decide("APPROVED") }, saving === "APPROVED" ? "Saving…" : "Approve Evidence")))) : (React.createElement("div", { className: "flex items-center justify-between gap-2" },
            React.createElement("p", { className: "text-xs text-muted" }, "Read-only inspection for current role. Programme Reviewer role is required to record review decisions."),
            React.createElement(Button_jsx_1.default, { onClick: onClose }, "Close"))) },
        React.createElement("div", { className: "flex flex-col gap-5" },
            React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
                React.createElement(StatusBadge_jsx_1.default, { status: ev.evidence_status }),
                ev.reviewer ? React.createElement("span", { className: "text-xs text-muted" },
                    "by ",
                    ev.reviewer,
                    " \u00B7 ",
                    (0, format_js_1.formatDateTime)(ev.reviewed_at)) : null),
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Submitted measurements by criterion", subtitle: "Each measurement is evaluated strictly against its own criterion threshold." }),
                obsByCriterion.length === 0 ? (React.createElement("p", { className: "text-sm text-muted" },
                    "No period observations attached",
                    ev.amount_minor_or_count != null ? " — amount recorded on the evidence itself" : "",
                    ".")) : (React.createElement("div", { className: "flex flex-col gap-3" }, obsByCriterion.map(([cid, groupObs]) => {
                    const cat = norm.catalogById[cid];
                    const ordered = [...groupObs].sort((a, b) => (a.period_sequence ?? 0) - (b.period_sequence ?? 0));
                    return (React.createElement("div", { key: cid, className: "rounded-xl border border-border-ui bg-white p-3.5 text-sm" },
                        React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" },
                            React.createElement("p", { className: "font-semibold text-nav" }, cat?.name ?? cid),
                            cid !== "UNLINKED" ? (React.createElement("button", { type: "button", onClick: () => onOpenCriterion?.(cid), className: "font-mono text-xs text-brand hover:underline" }, cid)) : null),
                        React.createElement("ul", { className: "mt-2 flex flex-col gap-1.5" }, ordered.map((o) => (React.createElement("li", { key: o.id, className: "flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs" },
                            React.createElement("span", { className: "text-nav" },
                                React.createElement("span", { className: "font-medium" },
                                    o.period_label ?? "Reported",
                                    ":"),
                                " ",
                                React.createElement("span", { className: "font-mono font-bold" }, o.numeric_value ?? "qualitative"),
                                " ",
                                o.unit === "COUNT" && cid === "L0L1-AIB2C-1" ? "claimed sign-ups" : o.metric_type === "WAU" ? "WAU" : ""),
                            o.qualifier_status ? (React.createElement("span", { className: "font-mono text-[11px] text-amber-800" }, o.qualifier_status.includes("unrecorded")
                                ? "Target-segment membership: Unknown"
                                : o.qualifier_status)) : null)))),
                        cat?.threshold_description ? (React.createElement("p", { className: "mt-2 text-xs text-muted" },
                            "Threshold: ",
                            React.createElement("span", { className: "font-medium text-nav" }, cat.threshold_description))) : null));
                }))),
                ev.amount_minor_or_count != null ? (React.createElement("p", { className: "mt-2 text-sm text-nav" },
                    "Recorded amount: ",
                    React.createElement("span", { className: "font-semibold" }, ev.unit === "INR_PAISE" ? (0, format_js_1.formatINRPaise)(ev.amount_minor_or_count) : ev.amount_minor_or_count))) : null),
            pendingAgainst.length > 0 ? (React.createElement("section", { className: "rounded-xl border border-amber-300 bg-amber-50 p-3" },
                React.createElement("p", { className: "text-sm font-semibold text-amber-900" }, "Pending correction (unreviewed) \u2014 not counted"),
                pendingAgainst.map((o) => (React.createElement("p", { key: o.id, className: "mt-1 text-sm text-amber-800" },
                    o.numeric_value,
                    " \u00B7 ",
                    o.period_label,
                    " \u00B7 from ",
                    o.evidence_id,
                    " (supersedes ",
                    o.supersedes_observation_id,
                    ")"))))) : null,
            hints.length > 0 ? (React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Automated diagnostics", subtitle: "Preliminary hints \u2014 official criterion verdict is computed by the backend." }),
                React.createElement("ul", { className: "list-disc space-y-1 pl-5 text-sm text-muted" }, hints.map((h, i) => React.createElement("li", { key: i }, h))))) : null,
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Record metadata" }),
                React.createElement("dl", { className: "rounded-xl border border-border-ui bg-white px-4 py-2" },
                    React.createElement(KV, { k: "Ledger bucket", v: ev.ledger_bucket }),
                    React.createElement(KV, { k: "Measured criteria", v: allCriteriaMeasured.length ? allCriteriaMeasured.join(", ") : "Ledger-only", mono: true }),
                    React.createElement(KV, { k: "Period", v: ev.period_label }),
                    React.createElement(KV, { k: "Earned period", v: ev.earned_period }),
                    React.createElement(KV, { k: "Payment date", v: ev.payment_date }),
                    React.createElement(KV, { k: "Counterparty", v: ev.counterparty }),
                    React.createElement(KV, { k: "Parent record", v: ev.parent_evidence_id, mono: true }),
                    React.createElement(KV, { k: "Detail", v: ev.detail_note }))),
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Review history" }),
                history.length === 0 ? (React.createElement("p", { className: "text-sm text-muted" }, "No reviews recorded yet.")) : (React.createElement("ul", { className: "flex flex-col gap-2" }, history.map((h) => (React.createElement("li", { key: h.id, className: "rounded-xl border border-border-ui bg-white px-4 py-2.5 text-sm" },
                    React.createElement("div", { className: "flex items-center justify-between gap-2" },
                        React.createElement(StatusBadge_jsx_1.default, { status: h.decision }),
                        React.createElement("span", { className: "text-xs text-muted" }, (0, format_js_1.formatDateTime)(h.reviewed_at))),
                    React.createElement("p", { className: "mt-1 text-nav" }, h.reason),
                    React.createElement("p", { className: "text-xs text-muted" },
                        "by ",
                        h.reviewer))))))),
            reviewerAllowed ? (React.createElement("section", null,
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Reviewer reason (required)"),
                    React.createElement("textarea", { value: reason, onChange: (e) => setReason(e.target.value), onBlur: () => setTouched(true), rows: 3, placeholder: "Explain what was checked before approving or requesting changes\u2026", "aria-invalid": reasonInvalid, className: `w-full rounded-lg border bg-white px-3 py-2 text-sm text-nav placeholder:text-muted ${reasonInvalid ? "border-red-400" : "border-border-ui"}` }),
                    reasonInvalid ? React.createElement("span", { className: "mt-1 block text-xs text-red-700" }, "A reason is required to record a decision.") : null))) : null)));
}

};
modules["src/components/SevenStateCards.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SevenStateCards;
const React = __importStar(require("react"));
const StatusBadge_jsx_1 = __importStar(require("./ui/StatusBadge.jsx"));
const DIMS = [
    ["Development stage", "development_stage", null],
    ["Programme level", "programme_level", "programme_level_provenance"],
    ["MSL eligibility", "msl_eligibility", "msl_eligibility_provenance"],
    ["Advancement", "advancement_status", null],
    ["Fundraising", "fundraising_preference", null],
    ["MSL handover", "msl_handover_status", null],
    ["MSL acceptance", "msl_acceptance_status", null],
];
function SevenStateCards({ venture }) {
    if (!venture)
        return null;
    const resolved = venture.model_resolution_status === "CONFIRMED";
    const modelDisplay = resolved ? (venture.primary_business_model ?? "Unknown") : "Unresolved";
    return (React.createElement("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" },
        DIMS.map(([label, key, provKey]) => (React.createElement("div", { key: key, className: "min-w-0 rounded-xl border border-border-ui bg-white px-3 py-2.5" },
            React.createElement("p", { className: "text-xs text-muted" }, label),
            React.createElement("p", { className: "mt-0.5 break-words text-sm font-semibold text-nav" }, venture[key] ?? "Unknown"),
            provKey && venture[provKey] ? (React.createElement("div", { className: "mt-1" },
                React.createElement(StatusBadge_jsx_1.ProvenanceLabel, { text: venture[provKey] }))) : null))),
        React.createElement("div", { className: "min-w-0 rounded-xl border border-border-ui bg-white px-3 py-2.5" },
            React.createElement("p", { className: "text-xs text-muted" }, "Governing business model"),
            React.createElement("p", { className: "mt-0.5 break-words text-sm font-semibold text-nav" }, modelDisplay),
            React.createElement("div", { className: "mt-1 flex flex-wrap items-center gap-1.5" },
                resolved ? (React.createElement("span", { className: "text-xs font-medium text-teal-800" }, "Confirmed governing")) : (React.createElement(StatusBadge_jsx_1.default, { status: "UNRESOLVED", title: "Owner clarification required" })),
                !resolved ? (React.createElement("span", { className: "text-xs text-muted" }, "Owner clarification required")) : null))));
}

};
modules["src/components/StaffQueueView.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = StaffQueueView;
const React = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const status_js_1 = require("../utils/status.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const EmptyState_jsx_1 = require("./ui/EmptyState.jsx");
function ventureName(norm, id) {
    return norm.venturesById[id]?.name ?? id;
}
function Row({ title, meta, context, actionLabel, onAction, icon: Icon }) {
    return (React.createElement("li", { className: "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4" },
        React.createElement("span", { className: "hidden rounded-lg bg-slate-100 p-2 text-muted sm:block", "aria-hidden": true },
            React.createElement(Icon, { size: 17 })),
        React.createElement("div", { className: "min-w-0 flex-1" },
            React.createElement("p", { className: "break-words text-sm font-medium text-nav" }, title),
            React.createElement("p", { className: "mt-0.5 break-words text-sm text-muted" }, meta),
            context ? React.createElement("p", { className: "mt-0.5 font-mono text-xs text-muted" }, context) : null),
        React.createElement(Button_jsx_1.default, { onClick: onAction, className: "shrink-0 self-start sm:self-center" },
            actionLabel,
            React.createElement(lucide_react_1.ArrowRight, { size: 15, "aria-hidden": true }))));
}
function Section({ title, count, children, emptyHint }) {
    return (React.createElement("section", { className: "overflow-hidden rounded-xl border border-border-ui bg-white" },
        React.createElement("div", { className: "flex items-center justify-between border-b border-border-ui px-4 py-3" },
            React.createElement("h2", { className: "text-sm font-semibold text-nav" }, title),
            React.createElement("span", { className: "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600" }, count)),
        count === 0 ? (React.createElement("div", { className: "px-4 py-2" },
            React.createElement(EmptyState_jsx_1.EmptyState, { bare: true, title: "All clear", hint: emptyHint }))) : (React.createElement("ul", { className: "divide-y divide-border-ui" }, children))));
}
function StaffQueueView({ norm, role, onOpenVenture, onReview, onClarify, onMentor, onImport, canImport, onSubmitUpdate }) {
    const q = norm.staffQueue;
    const unreviewed = q.unreviewed_evidence ?? [];
    const clarifs = q.owner_clarifications ?? [];
    const followups = q.mentor_followups ?? [];
    const pending = q.pending_actions ?? [];
    const unresolved = q.unresolved_criteria ?? [];
    const allowReview = (0, status_js_1.can)(role, "review_evidence");
    const allowClarify = (0, status_js_1.can)(role, "clarify_model");
    const allowMentor = (0, status_js_1.can)(role, "record_mentor");
    const modelClarifsCount = clarifs.filter((c) => c.venture_id).length;
    const ruleClarifsCount = clarifs.filter((c) => c.criterion_id).length;
    return (React.createElement("div", { className: "flex flex-col gap-5" },
        React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
            React.createElement("div", null,
                React.createElement("h1", { className: "text-xl font-bold tracking-tight text-nav" }, "Work Queue"),
                React.createElement("p", { className: "mt-1 text-sm text-muted" },
                    unreviewed.length,
                    " evidence review",
                    unreviewed.length === 1 ? "" : "s",
                    " pending \u00B7",
                    " ",
                    modelClarifsCount,
                    " model decision",
                    modelClarifsCount === 1 ? "" : "s",
                    " required \u00B7",
                    " ",
                    ruleClarifsCount,
                    " programme rule",
                    ruleClarifsCount === 1 ? "" : "s",
                    " awaiting configuration")),
            canImport ? React.createElement(Button_jsx_1.default, { variant: "primary", onClick: onImport }, "Import Venture") : null),
        React.createElement("div", { className: "grid grid-cols-1 gap-5 xl:grid-cols-2" },
            React.createElement(Section, { title: "Evidence requiring review", count: unreviewed.length, emptyHint: "No evidence awaiting review." }, unreviewed.map((item) => (React.createElement(Row, { key: item.id, icon: lucide_react_1.FileSearch, title: `${item.id} · ${item.source_type ?? "Evidence"}`, meta: `${ventureName(norm, item.venture_id)} · ${item.detail ?? "Submitted measurements awaiting review"}`, context: item.venture_id, actionLabel: allowReview ? "Review evidence" : "View details", onAction: () => onReview(item.id) })))),
            React.createElement(Section, { title: "Reviewed criteria needing follow-up", count: unresolved.length, emptyHint: "No reviewed criteria remain unresolved." }, unresolved.map((item) => {
                const canSubmit = (0, status_js_1.can)(role, "submit_update");
                return (React.createElement(Row, { key: `${item.venture_id}-${item.business_line_id ?? "venture"}-${item.criterion_id}`, icon: lucide_react_1.FileText, title: `${item.criterion_id} - ${item.criterion_name ?? "Requirement"}`, meta: `${ventureName(norm, item.venture_id)} - ${item.line_name ?? "Venture level"} - ${item.criterion_result}`, context: item.detail, actionLabel: canSubmit ? "Submit follow-up" : "Open venture", onAction: () => canSubmit
                        ? onSubmitUpdate?.({ ventureId: item.venture_id, lineId: item.business_line_id ?? "", criterionId: item.criterion_id })
                        : onOpenVenture(item.venture_id, "requirements") }));
            })),
            React.createElement(Section, { title: `Owner clarification (${modelClarifsCount} models, ${ruleClarifsCount} rules)`, count: clarifs.length, emptyHint: "No unresolved models or rules." }, clarifs.map((item, i) => (React.createElement(Row, { key: `${item.venture_id ?? item.criterion_id ?? i}`, icon: item.criterion_id ? lucide_react_1.Settings2 : lucide_react_1.CircleAlert, title: item.venture_id ? `${ventureName(norm, item.venture_id)} · Business model unresolved` : `Rule configuration · ${item.criterion_id}`, meta: item.reason, context: item.venture_id ?? item.criterion_id, actionLabel: item.venture_id
                    ? (allowClarify ? "Clarify model" : "Open venture")
                    : "View catalogue", onAction: () => item.venture_id
                    ? (allowClarify ? onClarify(item.venture_id) : onOpenVenture(item.venture_id, "overview"))
                    : onOpenVenture(null) })))),
            React.createElement(Section, { title: "Mentor & participant follow-up", count: followups.length, emptyHint: "No follow-ups outstanding." }, followups.map((item, i) => (React.createElement(Row, { key: `${item.venture_id}-${i}`, icon: lucide_react_1.Stethoscope, title: `${ventureName(norm, item.venture_id)} · Follow-up required`, meta: item.note, context: item.venture_id, actionLabel: allowMentor ? "Record outcome" : "Open venture", onAction: () => allowMentor ? onMentor(item.venture_id) : onOpenVenture(item.venture_id, "overview") })))),
            React.createElement(Section, { title: "Transition & handover", count: pending.length, emptyHint: "No pending transitions or handovers." }, pending.map((item, i) => (React.createElement(Row, { key: `${item.id ?? item.venture_id}-${i}`, icon: lucide_react_1.Truck, title: item.id ? `${item.id} · Changes requested` : `${ventureName(norm, item.venture_id)} · MSL handover context`, meta: item.reason ?? item.note ?? "", context: item.venture_id, actionLabel: item.id ? (allowReview ? "Re-review" : "View details") : "Inspect handover", onAction: () => item.id ? onReview(item.id) : onOpenVenture(item.venture_id, "history") })))))));
}

};
modules["src/components/SubmitUpdateModal.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SubmitUpdateModal;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const client_js_1 = require("../api/client.js");
const format_js_1 = require("../utils/format.js");
const criteria_js_1 = require("../utils/criteria.js");
const evidence_js_1 = require("../utils/evidence.js");
const qa_js_1 = require("../utils/qa.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const Modal_jsx_1 = __importDefault(require("./ui/Modal.jsx"));
const inputCls = "w-full rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav placeholder:text-muted";
const LEDGERS = ["", "COMMERCIAL_INTENT", "BILLED", "EARNED", "COLLECTED", "USAGE_METRIC"];
const UNIT_OPTIONS = ["", "INR_PAISE", "COUNT", "PERCENT", "QUALITATIVE"];
function blankMetric(criterionId = "") {
    return { criterion_id: criterionId, period_label: "", period_sequence: "", numeric_value: "", qualifier_status: "", supersedes_observation_id: "" };
}
function hasMetricContent(metric) {
    return metric.numeric_value !== ""
        || Boolean(String(metric.period_label ?? "").trim())
        || Boolean(metric.qualifier_status)
        || Boolean(metric.supersedes_observation_id);
}
function SubmitUpdateModal({ norm, ventureId, initialLineId = "", initialCriterionId = "", role, onClose, onSubmitted }) {
    const venture = norm.venturesById[ventureId];
    const lines = norm.linesByVenture[ventureId] ?? [];
    const initialCriterion = initialCriterionId ? norm.catalogById[initialCriterionId] : null;
    const [businessLineId, setBusinessLineId] = (0, react_1.useState)(initialLineId || (initialCriterion?.criterion_scope === "VENTURE" ? "" : (lines[0]?.id ?? "")));
    const [criterionId, setCriterionId] = (0, react_1.useState)(initialCriterionId || "");
    const [summaryMetric, setSummaryMetric] = (0, react_1.useState)("");
    const [summaryPeriod, setSummaryPeriod] = (0, react_1.useState)("");
    const [metrics, setMetrics] = (0, react_1.useState)([blankMetric(initialCriterionId || "")]);
    const [qualitative, setQualitative] = (0, react_1.useState)({});
    const [useExisting, setUseExisting] = (0, react_1.useState)(false);
    const [existingId, setExistingId] = (0, react_1.useState)("");
    const [ev, setEv] = (0, react_1.useState)({ id: "", source_type: "", ledger_bucket: "", unit: "", display_amount: "", earned_period: "", payment_date: "", counterparty: "", detail_note: "", parent_evidence_id: "" });
    const [amountInr, setAmountInr] = (0, react_1.useState)("");
    const [blocker, setBlocker] = (0, react_1.useState)("");
    const [nextAction, setNextAction] = (0, react_1.useState)("");
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)("");
    const selectedCriterion = norm.catalogById[criterionId] ?? null;
    const fields = (0, criteria_js_1.qualitativeFields)(selectedCriterion);
    const qualitativeMode = (0, criteria_js_1.isQualitativeCriterion)(selectedCriterion);
    const isVentureCriterion = selectedCriterion?.criterion_scope === "VENTURE";
    const metricCatalog = selectedCriterion?.criterion_scope
        ? norm.catalog.filter((criterion) => criterion.criterion_scope === selectedCriterion.criterion_scope)
        : norm.catalog;
    const policy = (0, evidence_js_1.sourcePolicy)(norm, ev.source_type);
    const allowedUnits = (policy?.units ?? UNIT_OPTIONS).map((unitValue) => unitValue ?? "");
    const defaultUnit = policy?.allow_amount ? "INR_PAISE" : "";
    const effectiveUnit = ev.unit && allowedUnits.includes(ev.unit) ? ev.unit : defaultUnit;
    const amountPaise = amountInr === "" ? null : Math.round(Number(amountInr) * 100);
    const ventureEvidence = norm.evidence.filter((e) => e.venture_id === ventureId);
    const prefillEnabled = ventureId === "case-a" && (0, qa_js_1.isQaOnly)();
    (0, react_1.useEffect)(() => {
        const selected = norm.catalogById[criterionId];
        setBusinessLineId(selected?.criterion_scope === "VENTURE" ? "" : (initialLineId || lines[0]?.id || ""));
        setQualitative((0, criteria_js_1.blankQualitative)(selected));
    }, [criterionId]);
    function prefillA01() {
        setBusinessLineId(lines.find((l) => l.approved_model === "AI_B2C")?.id ?? lines[0]?.id ?? "");
        setCriterionId("L0L1-AIB2C-2");
        setSummaryMetric("32 sign-ups; 12 WAU then 8 WAU");
        setSummaryPeriod("Week ending 4 October; Week ending 11 October");
        setMetrics([
            { ...blankMetric("L0L1-AIB2C-1"), numeric_value: "32", qualifier_status: "target_segment_membership_unrecorded", period_label: "", period_sequence: "1" },
            { ...blankMetric("L0L1-AIB2C-2"), numeric_value: "12", period_label: "Week ending 4 October", period_sequence: "1" },
            { ...blankMetric("L0L1-AIB2C-2"), numeric_value: "8", period_label: "Week ending 11 October", period_sequence: "2" },
        ]);
        setEv((previous) => ({ ...previous, source_type: "Analytics Excerpt", ledger_bucket: "USAGE_METRIC", unit: "", detail_note: "WAU excerpt; target-segment membership of sign-ups not recorded" }));
        setAmountInr("");
        setBlocker("Target-segment membership of sign-ups not recorded");
        setNextAction("Record target-segment membership and re-verify WAU");
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            if (!blocker.trim() || !nextAction.trim()) {
                throw new Error("Enter a blocker (or 'No blocker') and a concrete next action.");
            }
            if (!useExisting && !ev.source_type.trim()) {
                throw new Error("Provide a supporting evidence source type, or select an existing evidence record.");
            }
            if (!summaryPeriod.trim() && !metrics.some((m) => m.period_label.trim()) && !qualitativeMode) {
                throw new Error("At least one reporting period is required.");
            }
            if (!useExisting && policy?.amount_required && amountInr === "") {
                throw new Error(`${ev.source_type} requires a monetary amount.`);
            }
            if (amountInr !== "" && (!Number.isFinite(Number(amountInr)) || Number(amountInr) < 0)) {
                throw new Error("Amount must be a nonnegative number.");
            }
            const submittedMetrics = metrics.filter(hasMetricContent);
            const numericObservations = submittedMetrics.map((m, i) => ({
                criterion_id: m.criterion_id || criterionId || undefined,
                metric_type: undefined,
                period_label: m.period_label || undefined,
                period_sequence: m.period_sequence === "" ? i + 1 : Number(m.period_sequence),
                numeric_value: m.numeric_value === "" ? undefined : Number(m.numeric_value),
                unit: undefined,
                qualifier_status: m.qualifier_status || undefined,
                supersedes_observation_id: m.supersedes_observation_id || undefined,
            }));
            const qualitativeObservation = qualitativeMode ? {
                criterion_id: criterionId,
                metric_type: selectedCriterion.metric_type,
                period_label: summaryPeriod || "Qualitative review",
                period_sequence: 1,
                unit: selectedCriterion.unit,
                qualifier_status: "met",
                qualitative_value_json: (0, criteria_js_1.qualitativeValues)(selectedCriterion, qualitative),
            } : null;
            const observations = qualitativeObservation ? [...numericObservations, qualitativeObservation] : numericObservations;
            const body = {
                venture_id: ventureId,
                business_line_id: isVentureCriterion ? undefined : (businessLineId || undefined),
                criterion_id: criterionId || undefined,
                summary_metric: summaryMetric || undefined,
                summary_period: summaryPeriod || undefined,
                claimed_metrics_json: { metrics: submittedMetrics.map((m) => ({ criterion: m.criterion_id, period: m.period_label, value: m.numeric_value === "" ? undefined : Number(m.numeric_value), qualifier: m.qualifier_status || undefined })) },
                blocker: blocker || undefined,
                next_action: nextAction || undefined,
            };
            if (useExisting) {
                if (!existingId)
                    throw new Error("Select an existing evidence record.");
                body.evidence_id = existingId;
            }
            else {
                body.evidence = {
                    ...(ev.id ? { id: ev.id } : {}),
                    source_type: ev.source_type || undefined,
                    ledger_bucket: ev.ledger_bucket || undefined,
                    amount_minor_or_count: amountPaise === null ? undefined : amountPaise,
                    unit: effectiveUnit || undefined,
                    display_amount: ev.display_amount || undefined,
                    period_label: summaryPeriod || undefined,
                    earned_period: ev.earned_period || undefined,
                    payment_date: ev.payment_date || undefined,
                    counterparty: ev.counterparty || undefined,
                    detail_note: ev.detail_note || undefined,
                    parent_evidence_id: ev.parent_evidence_id || undefined,
                };
            }
            body.observations = observations;
            await (0, client_js_1.apiRequest)("/updates", { method: "POST", body, role });
            onSubmitted();
        }
        catch (err) {
            setError(err.blockingReasons?.length ? `${err.message} - ${err.blockingReasons.join("; ")}` : err.message);
        }
        finally {
            setSaving(false);
        }
    }
    return (React.createElement(Modal_jsx_1.default, { title: `Submit Progress Update - ${venture?.name ?? ventureId}`, onClose: onClose, wide: true },
        React.createElement("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4" },
            React.createElement("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2" },
                React.createElement("div", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Business line"),
                    isVentureCriterion ? (React.createElement("p", { className: "rounded-lg border border-border-ui bg-slate-50 px-3 py-2 text-sm text-muted" }, "Venture-level criterion. No business line is required.")) : (React.createElement("select", { value: businessLineId, onChange: (e) => setBusinessLineId(e.target.value), "aria-label": "Business line", className: inputCls },
                        React.createElement("option", { value: "" }, "- Select a business line -"),
                        lines.map((l) => React.createElement("option", { key: l.id, value: l.id }, l.line_name))))),
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Primary criterion"),
                    React.createElement("select", { value: criterionId, onChange: (e) => setCriterionId(e.target.value), className: inputCls },
                        React.createElement("option", { value: "" }, "- None -"),
                        norm.catalog.map((c) => React.createElement("option", { key: c.id, value: c.id },
                            c.id,
                            " - ",
                            c.name)))),
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Summary metric"),
                    React.createElement("input", { value: summaryMetric, onChange: (e) => setSummaryMetric(e.target.value), placeholder: "e.g. 32 sign-ups; 12 then 8 WAU", className: inputCls })),
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Summary period (verbatim)"),
                    React.createElement("input", { value: summaryPeriod, onChange: (e) => setSummaryPeriod(e.target.value), placeholder: "Keep source wording, no invented years", className: inputCls }))),
            qualitativeMode ? (React.createElement("div", { className: "rounded-lg border border-border-ui bg-slate-50 p-3" },
                React.createElement("p", { className: "mb-2 text-sm font-medium text-nav" }, "Qualitative evidence"),
                React.createElement("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2" }, fields.map((field) => (field.kind === "number" ? (React.createElement("label", { key: field.key, className: "block text-xs text-nav" },
                    React.createElement("span", { className: "mb-1 block" }, field.label),
                    React.createElement("input", { type: "number", min: "0", value: qualitative[field.key] ?? "", onChange: (e) => setQualitative((previous) => ({ ...previous, [field.key]: e.target.value })), "aria-label": field.label, className: inputCls }),
                    field.threshold != null ? React.createElement("span", { className: "mt-0.5 block text-muted" },
                        "Required: at least ",
                        field.threshold) : null)) : (React.createElement("label", { key: field.key, className: "flex items-center gap-2 rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav" },
                    React.createElement("input", { type: "checkbox", checked: Boolean(qualitative[field.key]), onChange: (e) => setQualitative((previous) => ({ ...previous, [field.key]: e.target.checked })), "aria-label": field.label, className: "h-4 w-4 accent-brand" }),
                    React.createElement("span", null, field.label)))))))) : null,
            !qualitativeMode ? (React.createElement("div", null,
                React.createElement("div", { className: "mb-2 flex items-center justify-between" },
                    React.createElement("p", { className: "text-sm font-medium text-nav" }, "Reported metrics"),
                    React.createElement(Button_jsx_1.default, { type: "button", onClick: () => setMetrics((previous) => [...previous, blankMetric(criterionId)]) },
                        React.createElement(lucide_react_1.Plus, { size: 15, "aria-hidden": true }),
                        " Add row")),
                React.createElement("div", { className: "flex flex-col gap-2" }, metrics.map((m, i) => {
                    const qualifierOptions = norm.qualifierOptions?.[m.criterion_id || criterionId] ?? [];
                    return (React.createElement("div", { key: i, className: "grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_5rem_1fr_auto]" },
                        React.createElement("select", { value: m.criterion_id, onChange: (e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, criterion_id: e.target.value } : x)), "aria-label": `Metric ${i + 1} criterion`, className: inputCls },
                            React.createElement("option", { value: "" }, "- criterion -"),
                            metricCatalog.map((c) => React.createElement("option", { key: c.id, value: c.id }, c.id))),
                        React.createElement("input", { value: m.period_label, onChange: (e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, period_label: e.target.value } : x)), placeholder: "Period (verbatim)", "aria-label": `Metric ${i + 1} period`, className: inputCls }),
                        React.createElement("input", { value: m.numeric_value, onChange: (e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, numeric_value: e.target.value } : x)), placeholder: "Value", inputMode: "numeric", "aria-label": `Metric ${i + 1} value`, className: inputCls }),
                        qualifierOptions.length ? (React.createElement("select", { value: m.qualifier_status, onChange: (e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, qualifier_status: e.target.value } : x)), "aria-label": `Metric ${i + 1} qualifier`, className: inputCls },
                            React.createElement("option", { value: "" }, "- qualifier -"),
                            qualifierOptions.map((option) => React.createElement("option", { key: option, value: option }, option)))) : (React.createElement("input", { value: m.qualifier_status, onChange: (e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, qualifier_status: e.target.value } : x)), placeholder: "Qualifier (optional)", "aria-label": `Metric ${i + 1} qualifier`, className: inputCls })),
                        React.createElement("button", { type: "button", onClick: () => setMetrics((previous) => previous.filter((_, j) => j !== i)), "aria-label": `Remove metric ${i + 1}`, className: "col-span-2 rounded-lg p-2 text-muted hover:bg-slate-200 sm:col-span-1" },
                            React.createElement(lucide_react_1.Trash2, { size: 16 })),
                        React.createElement("input", { value: m.supersedes_observation_id, onChange: (e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, supersedes_observation_id: e.target.value } : x)), placeholder: "Supersedes observation ID (corrections only)", "aria-label": `Metric ${i + 1} supersedes`, className: `${inputCls} col-span-2 font-mono text-xs sm:col-span-5` })));
                })))) : null,
            React.createElement("div", { className: "rounded-lg border border-border-ui p-3" },
                React.createElement("label", { className: "mb-2 flex items-center gap-2 text-sm text-nav" },
                    React.createElement("input", { type: "checkbox", checked: useExisting, onChange: (e) => setUseExisting(e.target.checked), className: "h-4 w-4 accent-brand" }),
                    "Attach to an existing evidence record"),
                useExisting ? (React.createElement("select", { value: existingId, onChange: (e) => setExistingId(e.target.value), className: inputCls, "aria-label": "Existing evidence record" },
                    React.createElement("option", { value: "" }, "- Select record -"),
                    ventureEvidence.map((e) => React.createElement("option", { key: e.id, value: e.id },
                        e.id,
                        " - ",
                        e.source_type,
                        " - ",
                        e.evidence_status)))) : (React.createElement("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2" },
                    React.createElement("input", { value: ev.id, onChange: (e) => setEv((previous) => ({ ...previous, id: e.target.value })), placeholder: "Evidence ID (blank = auto)", "aria-label": "New evidence ID", className: `${inputCls} font-mono` }),
                    React.createElement("input", { value: ev.source_type, onChange: (e) => setEv((previous) => ({ ...previous, source_type: e.target.value })), placeholder: "Source type (Invoice, LOI...)", "aria-label": "Source type", className: inputCls }),
                    React.createElement("select", { value: ev.ledger_bucket, onChange: (e) => setEv((previous) => ({ ...previous, ledger_bucket: e.target.value })), "aria-label": "Ledger bucket", className: inputCls }, LEDGERS.map((l) => React.createElement("option", { key: l, value: l }, l || "- ledger bucket -"))),
                    React.createElement("label", { className: "block text-xs text-nav" },
                        React.createElement("span", { className: "mb-1 block" }, "Evidence unit"),
                        React.createElement("select", { value: effectiveUnit, onChange: (e) => setEv((previous) => ({ ...previous, unit: e.target.value })), "aria-label": "Evidence unit", className: inputCls }, allowedUnits.map((unitValue) => React.createElement("option", { key: unitValue || "none", value: unitValue }, (0, evidence_js_1.unitLabel)(unitValue))))),
                    effectiveUnit === "INR_PAISE" ? (React.createElement("label", { className: "block text-xs text-nav" },
                        React.createElement("span", { className: "mb-1 block" }, "Amount (INR)"),
                        React.createElement("input", { value: amountInr, onChange: (e) => setAmountInr(e.target.value), placeholder: "e.g. 20000", inputMode: "decimal", "aria-label": "Amount (INR)", className: inputCls }),
                        React.createElement("span", { className: "mt-0.5 block text-muted" }, amountPaise === null || !Number.isFinite(amountPaise) ? "Stored as integer paise" : `Stored as ${amountPaise} paise`))) : null,
                    React.createElement("input", { value: ev.detail_note, onChange: (e) => setEv((previous) => ({ ...previous, detail_note: e.target.value })), placeholder: "Detail note", "aria-label": "Detail note", className: `${inputCls} sm:col-span-2` }),
                    React.createElement("input", { value: ev.parent_evidence_id, onChange: (e) => setEv((previous) => ({ ...previous, parent_evidence_id: e.target.value })), placeholder: "Parent evidence ID (settlements only)", "aria-label": "Parent evidence ID", className: `${inputCls} font-mono` }),
                    React.createElement("input", { value: ev.counterparty, onChange: (e) => setEv((previous) => ({ ...previous, counterparty: e.target.value })), placeholder: "Counterparty", "aria-label": "Counterparty", className: inputCls }),
                    React.createElement("input", { value: ev.earned_period, onChange: (e) => setEv((previous) => ({ ...previous, earned_period: e.target.value })), placeholder: "Earned period (verbatim)", "aria-label": "Earned period", className: inputCls }),
                    React.createElement("input", { value: ev.payment_date, onChange: (e) => setEv((previous) => ({ ...previous, payment_date: e.target.value })), placeholder: "Payment date (verbatim)", "aria-label": "Payment date", className: inputCls })))),
            React.createElement("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2" },
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Blocker"),
                    React.createElement("input", { required: true, value: blocker, onChange: (e) => setBlocker(e.target.value), placeholder: "If none, enter 'No blocker'", className: inputCls })),
                React.createElement("label", { className: "block" },
                    React.createElement("span", { className: "mb-1 block text-sm font-medium text-nav" }, "Next action"),
                    React.createElement("input", { required: true, value: nextAction, onChange: (e) => setNextAction(e.target.value), placeholder: "What happens next?", className: inputCls }))),
            error ? React.createElement("p", { role: "alert", className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" }, error) : null,
            React.createElement("div", { className: "flex flex-wrap justify-between gap-2" },
                prefillEnabled ? (React.createElement(Button_jsx_1.default, { type: "button", onClick: prefillA01 },
                    React.createElement(lucide_react_1.Wand2, { size: 15, "aria-hidden": true }),
                    " Prefill Mock A-01 (QA only)")) : React.createElement("span", null),
                React.createElement("div", { className: "flex gap-2" },
                    React.createElement(Button_jsx_1.default, { type: "button", onClick: onClose }, "Cancel"),
                    React.createElement(Button_jsx_1.default, { type: "submit", variant: "primary", disabled: saving }, saving ? "Submitting..." : "Submit Update"))))));
}

};
modules["src/components/SystemNoteView.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SystemNoteView;
const React = __importStar(require("react"));
const react_1 = require("react");
const StatusBadge_jsx_1 = __importDefault(require("./ui/StatusBadge.jsx"));
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
const ASSUMPTIONS = [
    "Unknown is never coerced to 0, false, or failed — unsupplied fields render as “Not supplied” or “Unknown”.",
    "A submitted update is a claim awaiting review, not proof. Evidence status and criterion result are evaluated independently.",
    "All money is stored, summed, and returned by the API in integer paise; the UI formats to ₹ for display only.",
    "Historical baselines are isolated references and are never added to granular evidence.",
    "Settlements link to obligations via parent records; differences shown are arithmetic, not verified balances.",
    "Roles are a demonstration-only seam (X-ILS-Role header), not production authentication.",
    "MSL eligibility, handover, and acceptance are independent dimensions — none is inferred from another.",
];
const AT_ROWS = [
    ["AT-01", "Venture Directory + Import", "Seeded cases, Unknown provenance preserved; blank imports rejected (422)"],
    ["AT-02", "Submit Update form", "Verbatim periods, A-E01 reference, blocker, next action"],
    ["AT-03A", "Review drawer (approve)", "APPROVED evidence, WAU NOT_MET, sign-ups UNKNOWN"],
    ["AT-03B", "Review drawer (changes)", "History entry + staff-queue follow-up"],
    ["AT-04A", "Requirements matrix", "5 qualitative items Unknown"],
    ["AT-04B", "Work Queue", "Current level + 4 buckets, MSL preserved"],
    ["AT-05", "Financial ledger", "Claimed vs Verified: ₹100,000 / ₹60,000 / ₹40,000, baseline isolated"],
    ["AT-06", "Financial ledger", "LOI is commercial intent only"],
    ["AT-07", "Financial ledger", "September earned vs 5 Oct payout, ₹10,000 difference"],
    ["AT-08", "Decision history", "Level 2 direct entry, Unknown reviewer/date"],
    ["AT-09", "Transition drawer", "Unmet standard advancement rejected with reasons"],
    ["AT-10A", "Transition drawer", "Direct entry recorded with snapshot"],
    ["AT-10B", "Transition drawer", "Valid standard advancement, zero waiting rule"],
    ["AT-11", "MSL panel", "New certification blocked, imports preserved"],
    ["AT-12A", "Topbar reset / import", "Student role rejected (403) & controls hidden"],
    ["AT-12B", "Role switcher", "Student denied reviewer actions, allowed Submit Update"],
    ["AT-13A", "Review drawer", "Approved supersession: 12, 11 MET"],
    ["AT-13B", "Review drawer", "Unreviewed correction stays pending"],
    ["AT-14", "Export / reset", "Lossless round-trip of all tables"],
];
function SystemNoteView({ norm }) {
    const blocked = (norm?.catalog ?? []).filter((c) => c.is_configurable_range && (c.configured_value == null));
    const [uiStatus, setUiStatus] = (0, react_1.useState)({});
    function toggleStatus(id) {
        setUiStatus((prev) => ({
            ...prev,
            [id]: prev[id] === "PASSED" ? "NOT_RUN" : "PASSED",
        }));
    }
    const uiPassedCount = Object.values(uiStatus).filter((v) => v === "PASSED").length;
    return (React.createElement("div", { className: "flex max-w-4xl flex-col gap-6" },
        React.createElement("div", null,
            React.createElement("h1", { className: "text-xl font-bold tracking-tight text-nav" }, "System Notes"),
            React.createElement("p", { className: "mt-1 text-sm text-muted" }, "Assumptions, unresolved rules, and acceptance-test coverage for this prototype.")),
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Working assumptions" }),
            React.createElement("ul", { className: "list-disc space-y-1.5 rounded-xl border border-border-ui bg-white py-3 pl-9 pr-4 text-sm text-nav" }, ASSUMPTIONS.map((a, i) => React.createElement("li", { key: i }, a)))),
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Unresolved programme rules", subtitle: `${blocked.length} programme-wide configurable threshold${blocked.length === 1 ? "" : "s"} awaiting a Programme Owner. Until configured, affected criteria evaluate to BLOCKED.` }),
            blocked.length === 0 ? (React.createElement("p", { className: "text-sm text-muted" }, "All configurable rules have values.")) : (React.createElement("ul", { className: "flex flex-col gap-2" }, blocked.map((c) => (React.createElement("li", { key: c.id, className: "flex flex-wrap items-center gap-2 rounded-xl border border-border-ui bg-white px-4 py-2.5 text-sm" },
                React.createElement("span", { className: "font-mono text-xs font-semibold text-nav" }, c.id),
                React.createElement("span", { className: "flex-1 text-muted" }, c.threshold_description ?? c.name),
                React.createElement(StatusBadge_jsx_1.default, { status: "BLOCKED" }))))))),
        React.createElement("section", null,
            React.createElement(SectionHeader_jsx_1.default, { title: "Verification & test status", subtitle: "Test execution states use PASSED / NOT_RUN / FAILED / BLOCKED (never source-data Unknown)." }),
            React.createElement("div", { className: "mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2" },
                React.createElement("div", { className: "rounded-xl border border-border-ui bg-white p-4" },
                    React.createElement("div", { className: "flex items-center justify-between gap-2" },
                        React.createElement("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted" }, "Backend automated suite"),
                        React.createElement(StatusBadge_jsx_1.default, { status: "PASSED" })),
                    React.createElement("p", { className: "mt-1 text-base font-bold text-nav" }, "Backend tests: 31 passed"),
                    React.createElement("p", { className: "mt-0.5 font-mono text-xs text-muted" }, "Runner: pytest \u00B7 Fixture: isolated tmp_path/ils_test.db \u00B7 Coverage: 19 AT + 12 regression checks")),
                React.createElement("div", { className: "rounded-xl border border-border-ui bg-white p-4" },
                    React.createElement("div", { className: "flex items-center justify-between gap-2" },
                        React.createElement("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted" }, "Frontend demonstration checkpoints"),
                        React.createElement(StatusBadge_jsx_1.default, { status: uiPassedCount === AT_ROWS.length ? "PASSED" : "NOT_RUN" })),
                    React.createElement("p", { className: "mt-1 text-base font-bold text-nav" }, uiPassedCount === 0
                        ? "Frontend demonstration checkpoints: Not run"
                        : `${uiPassedCount} / ${AT_ROWS.length} checkpoints marked Passed in this session`),
                    React.createElement("p", { className: "mt-0.5 text-xs text-muted" }, "Click any row badge below during your live walkthrough to toggle its observed UI status."))),
            React.createElement("div", { className: "overflow-x-auto rounded-xl border border-border-ui bg-white" },
                React.createElement("table", { className: "w-full min-w-[640px] text-left text-sm" },
                    React.createElement("thead", null,
                        React.createElement("tr", { className: "border-b border-border-ui text-xs uppercase tracking-wide text-muted" },
                            React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Test"),
                            React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Frontend area"),
                            React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Expects"),
                            React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Backend pytest"),
                            React.createElement("th", { className: "px-4 py-3 font-semibold" }, "UI checkpoint"))),
                    React.createElement("tbody", { className: "divide-y divide-border-ui" }, AT_ROWS.map(([id, area, expects]) => {
                        const st = uiStatus[id] ?? "NOT_RUN";
                        return (React.createElement("tr", { key: id, className: "hover:bg-slate-50" },
                            React.createElement("td", { className: "whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold text-nav" }, id),
                            React.createElement("td", { className: "px-4 py-2 text-nav" }, area),
                            React.createElement("td", { className: "px-4 py-2 text-muted" }, expects),
                            React.createElement("td", { className: "px-4 py-2" },
                                React.createElement(StatusBadge_jsx_1.default, { status: "PASSED", title: "Verified in pytest backend/test_acceptance.py" })),
                            React.createElement("td", { className: "px-4 py-2" },
                                React.createElement("button", { type: "button", onClick: () => toggleStatus(id), title: "Click to toggle observed UI checkpoint status" },
                                    React.createElement(StatusBadge_jsx_1.default, { status: st })))));
                    })))))));
}

};
modules["src/components/ui/Button.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Button;
const React = __importStar(require("react"));
const VARIANTS = {
    primary: "bg-brand text-white hover:brightness-110 disabled:bg-slate-300 disabled:text-slate-500",
    secondary: "bg-white text-nav ring-1 ring-inset ring-border-ui hover:bg-slate-50 disabled:text-slate-400",
    danger: "bg-danger-ui text-white hover:brightness-110 disabled:bg-slate-300 disabled:text-slate-500",
    ghost: "bg-transparent text-muted hover:bg-slate-100 disabled:text-slate-300",
};
function Button({ variant = "secondary", className = "", ...props }) {
    return (React.createElement("button", { className: `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,filter] duration-150 disabled:cursor-not-allowed ${VARIANTS[variant] ?? VARIANTS.secondary} ${className}`, ...props }));
}

};
modules["src/components/ui/Drawer.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Drawer;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
function Drawer({ title, subtitle, onClose, children, footer }) {
    const closeRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        closeRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape")
                onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (React.createElement("div", { className: "anim-overlay fixed inset-0 z-50 bg-nav/40", role: "presentation", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose?.(); } },
        React.createElement("aside", { role: "dialog", "aria-modal": "true", "aria-label": title, className: "anim-drawer absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-xl sm:w-[520px] sm:max-w-[92vw]" },
            React.createElement("div", { className: "flex items-start justify-between gap-3 border-b border-border-ui px-5 py-4" },
                React.createElement("div", { className: "min-w-0" },
                    React.createElement("h2", { className: "truncate text-base font-semibold text-nav" }, title),
                    subtitle ? React.createElement("p", { className: "mt-0.5 truncate text-sm text-muted" }, subtitle) : null),
                React.createElement("button", { ref: closeRef, onClick: onClose, "aria-label": "Close panel", className: "rounded-md p-1.5 text-muted hover:bg-slate-100" },
                    React.createElement(lucide_react_1.X, { size: 18 }))),
            React.createElement("div", { className: "flex-1 overflow-y-auto px-5 py-4" }, children),
            footer ? React.createElement("div", { className: "border-t border-border-ui px-5 py-3" }, footer) : null)));
}

};
modules["src/components/ui/EmptyState.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyState = EmptyState;
exports.LoadingState = LoadingState;
exports.ErrorState = ErrorState;
const React = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
function EmptyState({ title = "Nothing here yet", hint, bare = false }) {
    if (bare) {
        return (React.createElement("div", { className: "flex flex-col items-center gap-1.5 px-6 py-6 text-center" },
            React.createElement(lucide_react_1.Inbox, { size: 20, className: "text-slate-400", "aria-hidden": true }),
            React.createElement("p", { className: "text-sm font-medium text-nav" }, title),
            hint ? React.createElement("p", { className: "max-w-sm text-sm text-muted" }, hint) : null));
    }
    return (React.createElement("div", { className: "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-ui bg-white px-6 py-10 text-center" },
        React.createElement(lucide_react_1.Inbox, { size: 22, className: "text-muted", "aria-hidden": true }),
        React.createElement("p", { className: "text-sm font-medium text-nav" }, title),
        hint ? React.createElement("p", { className: "max-w-sm text-sm text-muted" }, hint) : null));
}
function LoadingState({ label = "Loading…" }) {
    return (React.createElement("div", { className: "flex flex-col gap-3", "aria-label": label, role: "status" },
        [0, 1, 2].map((i) => (React.createElement("div", { key: i, className: "h-16 animate-pulse rounded-xl bg-slate-100" }))),
        React.createElement("span", { className: "sr-only" }, label)));
}
function ErrorState({ message, onRetry }) {
    return (React.createElement("div", { className: "flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4" },
        React.createElement("p", { className: "text-sm font-medium text-red-800" }, "Something went wrong"),
        React.createElement("p", { className: "text-sm text-red-700" }, message),
        onRetry ? (React.createElement("button", { onClick: onRetry, className: "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-300 hover:bg-red-100" }, "Retry")) : null));
}

};
modules["src/components/ui/Modal.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Modal;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
function Modal({ title, onClose, children, wide = false }) {
    const closeRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        closeRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape")
                onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (React.createElement("div", { className: "anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-nav/40 p-0 sm:items-center sm:p-6", role: "presentation", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose?.(); } },
        React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": title, className: `anim-modal flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}` },
            React.createElement("div", { className: "flex items-center justify-between border-b border-border-ui px-5 py-3" },
                React.createElement("h2", { className: "text-base font-semibold text-nav" }, title),
                React.createElement("button", { ref: closeRef, onClick: onClose, "aria-label": "Close dialog", className: "rounded-md p-1.5 text-muted hover:bg-slate-100" },
                    React.createElement(lucide_react_1.X, { size: 18 }))),
            React.createElement("div", { className: "overflow-y-auto px-5 py-4" }, children))));
}

};
modules["src/components/ui/SectionHeader.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SectionHeader;
const React = __importStar(require("react"));
function SectionHeader({ title, subtitle, action }) {
    return (React.createElement("div", { className: "mb-3 flex flex-wrap items-start justify-between gap-3" },
        React.createElement("div", { className: "min-w-0" },
            React.createElement("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted" }, title),
            subtitle ? React.createElement("p", { className: "mt-1 text-sm text-muted" }, subtitle) : null),
        action));
}

};
modules["src/components/ui/Sparkline.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sparkline = Sparkline;
exports.ProportionBar = ProportionBar;
const React = __importStar(require("react"));
/** Tiny inline SVG data-ink: sparklines for verified readings, proportion bars for ledgers. */
function Sparkline({ values, threshold, width = 120, height = 32, label }) {
    const nums = (values ?? []).filter((v) => typeof v === "number");
    if (nums.length < 2)
        return null;
    const max = Math.max(...nums, threshold ?? 0, 1);
    const min = Math.min(...nums, 0);
    const span = max - min || 1;
    const stepX = nums.length > 1 ? width / (nums.length - 1) : 0;
    const pts = nums.map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
    const thrY = threshold == null ? null : (height - 3 - ((threshold - min) / span) * (height - 6)).toFixed(1);
    return (React.createElement("svg", { width: width, height: height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label ?? `Trend: ${nums.join(", ")}`, className: "shrink-0 overflow-visible" },
        thrY != null ? (React.createElement("line", { x1: "0", x2: width, y1: thrY, y2: thrY, stroke: "#b91c1c", strokeWidth: "1", strokeDasharray: "3 2", opacity: "0.7" })) : null,
        React.createElement("polyline", { points: pts.join(" "), fill: "none", stroke: "#0f766e", strokeWidth: "1.75", strokeLinejoin: "round", strokeLinecap: "round" }),
        pts.map((p, i) => {
            const [cx, cy] = p.split(",");
            return React.createElement("circle", { key: i, cx: cx, cy: cy, r: "2.25", fill: "#0f766e" });
        })));
}
function ProportionBar({ parts, label }) {
    // parts: [{value, color, name}] — widths proportional to max.
    const max = Math.max(...parts.map((p) => p.value ?? 0), 1);
    return (React.createElement("div", { role: "img", "aria-label": label, className: "flex flex-col gap-1" }, parts.map((p) => (React.createElement("div", { key: p.name, className: "flex items-center gap-2" },
        React.createElement("span", { className: "w-20 shrink-0 truncate text-xs text-muted" }, p.name),
        React.createElement("div", { className: "h-2 min-w-0 flex-1 rounded-full bg-slate-100" },
            React.createElement("div", { className: "h-2 rounded-full", style: { width: `${((p.value ?? 0) / max) * 100}%`, backgroundColor: p.color } })))))));
}

};
modules["src/components/ui/StatusBadge.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = StatusBadge;
exports.ProvenanceLabel = ProvenanceLabel;
const React = __importStar(require("react"));
const status_js_1 = require("../../utils/status.js");
function StatusBadge({ status, title }) {
    const meta = (0, status_js_1.statusMeta)(status);
    return (React.createElement("span", { title: title ?? meta.label, className: `inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.classes}` }, meta.label));
}
function ProvenanceLabel({ text }) {
    if (!text)
        return null;
    return (React.createElement("span", { title: `Provenance: ${text}`, className: "inline-flex max-w-full shrink-0 items-center truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-500/20" }, text));
}

};
modules["src/components/VentureListView.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VentureListView;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const EmptyState_jsx_1 = require("./ui/EmptyState.jsx");
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
const StatusBadge_jsx_1 = __importStar(require("./ui/StatusBadge.jsx"));
function attentionFor(norm, venture) {
    const flags = [];
    const unrev = (norm.staffQueue.unreviewed_evidence ?? []).filter((e) => e.venture_id === venture.id).length;
    if (unrev > 0)
        flags.push(`Evidence ×${unrev}`);
    if (venture.model_resolution_status !== "CONFIRMED")
        flags.push("Model");
    if ((norm.staffQueue.mentor_followups ?? []).some((f) => f.venture_id === venture.id))
        flags.push("Follow-up");
    return flags.length ? flags.join(" + ") : "—";
}
function VentureListView({ norm, search, onOpen, onImport, canImport }) {
    const [level, setLevel] = (0, react_1.useState)("all");
    const [model, setModel] = (0, react_1.useState)("all");
    const [review, setReview] = (0, react_1.useState)("all");
    const rows = (0, react_1.useMemo)(() => {
        const q = search.trim().toLowerCase();
        return norm.ventures.filter((v) => {
            if (q && !`${v.name ?? ""} ${v.id} ${v.activity ?? ""}`.toLowerCase().includes(q))
                return false;
            if (level !== "all" && v.programme_level !== level)
                return false;
            if (model !== "all" && v.primary_business_model !== model)
                return false;
            if (review === "attention" && attentionFor(norm, v) === "—")
                return false;
            if (review === "unreviewed" && !(norm.staffQueue.unreviewed_evidence ?? []).some((e) => e.venture_id === v.id))
                return false;
            return true;
        });
    }, [norm, search, level, model, review]);
    const levels = [...new Set(norm.ventures.map((v) => v.programme_level))];
    const models = [...new Set(norm.ventures.map((v) => v.primary_business_model).filter(Boolean))];
    const selectCls = "rounded-lg border border-border-ui bg-white px-2 py-1.5 text-sm text-nav";
    return (React.createElement("div", { className: "flex flex-col gap-5" },
        React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
            React.createElement("div", null,
                React.createElement("h1", { className: "text-xl font-bold tracking-tight text-nav" }, "Ventures"),
                React.createElement("p", { className: "mt-1 text-sm text-muted" }, "Seeded cases plus any imported venture records.")),
            canImport ? React.createElement(Button_jsx_1.default, { variant: "primary", onClick: onImport },
                React.createElement(lucide_react_1.Plus, { size: 16, "aria-hidden": true }),
                " Add Venture") : null),
        React.createElement("div", { className: "flex flex-wrap items-center gap-2", role: "group", "aria-label": "Venture filters" },
            React.createElement("label", { className: "text-sm text-muted" },
                "Level",
                React.createElement("select", { value: level, onChange: (e) => setLevel(e.target.value), className: `${selectCls} ml-1.5`, "aria-label": "Filter by programme level" },
                    React.createElement("option", { value: "all" }, "All"),
                    levels.map((l) => React.createElement("option", { key: l, value: l }, l)))),
            React.createElement("label", { className: "text-sm text-muted" },
                "Model",
                React.createElement("select", { value: model, onChange: (e) => setModel(e.target.value), className: `${selectCls} ml-1.5`, "aria-label": "Filter by business model" },
                    React.createElement("option", { value: "all" }, "All"),
                    models.map((m) => React.createElement("option", { key: m, value: m }, m)))),
            React.createElement("label", { className: "text-sm text-muted" },
                "Review",
                React.createElement("select", { value: review, onChange: (e) => setReview(e.target.value), className: `${selectCls} ml-1.5`, "aria-label": "Filter by review status" },
                    React.createElement("option", { value: "all" }, "All"),
                    React.createElement("option", { value: "unreviewed" }, "Has unreviewed"),
                    React.createElement("option", { value: "attention" }, "Needs attention")))),
        React.createElement("section", { className: "overflow-x-auto rounded-xl border border-border-ui bg-white" },
            React.createElement("table", { className: "w-full min-w-[760px] text-left text-sm" },
                React.createElement("thead", null,
                    React.createElement("tr", { className: "border-b border-border-ui text-xs uppercase tracking-wide text-muted" },
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Venture"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Programme level"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Business model"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "MSL status"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Attention"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" },
                            React.createElement("span", { className: "sr-only" }, "Action")))),
                React.createElement("tbody", { className: "divide-y divide-border-ui" }, rows.map((v) => (React.createElement("tr", { key: v.id, className: "h-12 hover:bg-slate-50" },
                    React.createElement("td", { className: "px-4 py-2" },
                        React.createElement("p", { className: "font-medium text-nav" }, v.name),
                        React.createElement("p", { className: "font-mono text-xs text-muted" }, v.id)),
                    React.createElement("td", { className: "px-4 py-2 text-nav" }, v.programme_level),
                    React.createElement("td", { className: "px-4 py-2" }, v.model_resolution_status === "CONFIRMED" ? (React.createElement("span", { className: "mr-1.5 font-medium text-nav" }, v.primary_business_model)) : (React.createElement("div", { className: "flex flex-wrap items-center gap-1.5" },
                        React.createElement(StatusBadge_jsx_1.default, { status: "UNRESOLVED", title: "Owner clarification required" }),
                        React.createElement("span", { className: "text-xs text-muted" }, "Owner clarification required")))),
                    React.createElement("td", { className: "px-4 py-2" },
                        React.createElement("span", { className: "mr-1.5 text-nav" }, v.msl_eligibility),
                        React.createElement(StatusBadge_jsx_1.ProvenanceLabel, { text: v.msl_eligibility_provenance })),
                    React.createElement("td", { className: "px-4 py-2 text-muted" }, attentionFor(norm, v)),
                    React.createElement("td", { className: "px-4 py-2 text-right" },
                        React.createElement(Button_jsx_1.default, { onClick: () => onOpen(v.id) },
                            "View ",
                            React.createElement(lucide_react_1.ArrowRight, { size: 15, "aria-hidden": true })))))))),
            rows.length === 0 ? (React.createElement("div", { className: "px-4 py-4" },
                React.createElement(EmptyState_jsx_1.EmptyState, { title: "No ventures match", hint: "Clear search or filters to see all records." }))) : null),
        React.createElement(SectionHeader_jsx_1.default, { title: "Programme catalogue", subtitle: `${norm.catalog.length} criteria across five gates (reference, programme-wide).` }),
        React.createElement("section", { className: "overflow-x-auto rounded-xl border border-border-ui bg-white" },
            React.createElement("table", { className: "w-full min-w-[680px] text-left text-sm" },
                React.createElement("thead", null,
                    React.createElement("tr", { className: "border-b border-border-ui text-xs uppercase tracking-wide text-muted" },
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Criterion"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Gate"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Scope"),
                        React.createElement("th", { className: "px-4 py-3 font-semibold" }, "Definition"))),
                React.createElement("tbody", { className: "divide-y divide-border-ui" }, norm.catalog.map((c) => (React.createElement("tr", { key: c.id, className: "hover:bg-slate-50" },
                    React.createElement("td", { className: "whitespace-nowrap px-4 py-2 font-mono text-xs text-nav" }, c.id),
                    React.createElement("td", { className: "whitespace-nowrap px-4 py-2 text-xs text-muted" }, c.transition_gate),
                    React.createElement("td", { className: "whitespace-nowrap px-4 py-2 text-xs text-muted" },
                        c.criterion_scope,
                        " \u00B7 ",
                        c.business_model),
                    React.createElement("td", { className: "px-4 py-2 text-nav" }, c.threshold_description ?? c.name)))))))));
}

};
modules["src/components/VentureWorkspace.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VentureWorkspace;
const React = __importStar(require("react"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const format_js_1 = require("../utils/format.js");
const status_js_1 = require("../utils/status.js");
const Button_jsx_1 = __importDefault(require("./ui/Button.jsx"));
const StatusBadge_jsx_1 = __importStar(require("./ui/StatusBadge.jsx"));
const SectionHeader_jsx_1 = __importDefault(require("./ui/SectionHeader.jsx"));
const SevenStateCards_jsx_1 = __importDefault(require("./SevenStateCards.jsx"));
const BusinessLineTabs_jsx_1 = __importDefault(require("./BusinessLineTabs.jsx"));
const CriteriaMatrix_jsx_1 = __importDefault(require("./CriteriaMatrix.jsx"));
const FinancialLedger_jsx_1 = __importDefault(require("./FinancialLedger.jsx"));
const DecisionHistoryTimeline_jsx_1 = __importDefault(require("./DecisionHistoryTimeline.jsx"));
const TABS = [
    ["overview", "Overview"],
    ["requirements", "Requirements"],
    ["evidence", "Evidence & Financials"],
    ["history", "Decision History"],
];
function lineRoleSummary(line) {
    const models = line.approved_model ? [line.approved_model] : ((0, format_js_1.parseJSON)(line.candidate_models_json, []) ?? []);
    const modelText = models.length ? models.join(", ") : "Model pending";
    if (line.track_role === "ACTIVE_GOVERNING") {
        return `${modelText} · Confirmed governing`;
    }
    if (line.track_role === "ASSIGNED_IN_TRACKER") {
        return `${modelText} · Assigned in tracker · Not confirmed governing`;
    }
    if (line.track_role === "CANDIDATE") {
        return `${modelText} · Candidate`;
    }
    if (line.track_role === "PROVISIONAL") {
        return `${modelText} · Provisional · Pending owner confirmation`;
    }
    if (line.track_role === "HISTORICAL_PRESERVED") {
        return `${modelText} · Historical track preserved`;
    }
    return `${modelText} · ${line.track_role}`;
}
function IssueChips({ norm, ventureId }) {
    const chips = [];
    const v = norm.venturesById[ventureId];
    if (v?.model_resolution_status !== "CONFIRMED") {
        chips.push("1 model decision required");
    }
    const unconfiguredProgRules = (norm.catalog ?? []).filter((c) => c.is_configurable_range && c.configured_value == null).length;
    if (unconfiguredProgRules > 0) {
        chips.push(`${unconfiguredProgRules} programme rules awaiting configuration`);
    }
    const unrev = (norm.staffQueue.unreviewed_evidence ?? []).filter((e) => e.venture_id === ventureId).length;
    if (unrev > 0) {
        chips.push(`${unrev} evidence review${unrev === 1 ? "" : "s"} pending`);
    }
    if (!chips.length)
        chips.push("No open issues");
    return (React.createElement("div", { className: "flex flex-wrap gap-1.5" }, chips.map((c) => (React.createElement("span", { key: c, className: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted" }, c)))));
}
function LatestUpdate({ norm, ventureId, role, onReview }) {
    const updates = [...(norm.updatesByVenture[ventureId] ?? [])].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
    const u = updates[0];
    if (!u) {
        return (React.createElement("div", { className: "rounded-xl border border-border-ui bg-white px-4 py-3 text-sm" },
            React.createElement("p", { className: "text-muted" }, "No updates submitted yet.")));
    }
    const claimed = (0, format_js_1.parseJSON)(u.claimed_metrics_json, null);
    const metrics = Array.isArray(claimed?.metrics) ? claimed.metrics : Array.isArray(claimed?.wau) ? claimed.wau : null;
    return (React.createElement("div", { className: "rounded-xl border border-border-ui bg-white px-4 py-3 text-sm" },
        React.createElement("div", { className: "flex flex-wrap items-center gap-2" },
            React.createElement("p", { className: "font-mono text-xs font-semibold text-nav" }, u.id),
            React.createElement("span", { className: "text-xs text-muted" }, u.summary_period ?? ""),
            u.evidence_id ? (React.createElement(Button_jsx_1.default, { onClick: () => onReview(u.evidence_id) }, (0, status_js_1.can)(role, "review_evidence") ? `Review ${u.evidence_id}` : `View ${u.evidence_id}`)) : null),
        u.summary_metric ? React.createElement("p", { className: "mt-1 text-nav" }, u.summary_metric) : null,
        metrics ? (React.createElement("ul", { className: "mt-1 list-disc pl-5 text-muted" }, metrics.slice(0, 6).map((m, i) => (React.createElement("li", { key: i, className: "font-mono text-xs" },
            m.criterion ?? m.period ?? "",
            " ",
            m.period ? `· ${m.period}` : "",
            " ",
            m.value ?? m.value === 0 ? `· ${m.value}` : ""))))) : claimed ? React.createElement("p", { className: "mt-1 font-mono text-xs text-muted" }, JSON.stringify(claimed).slice(0, 220)) : null,
        u.blocker ? React.createElement("p", { className: "mt-1 text-nav" },
            React.createElement("span", { className: "font-medium" }, "Blocker:"),
            " ",
            u.blocker) : null,
        u.next_action ? React.createElement("p", { className: "text-nav" },
            React.createElement("span", { className: "font-medium" }, "Next:"),
            " ",
            u.next_action) : null));
}
function VentureWorkspace(props) {
    const { norm, ventureId, tab, onTab, role } = props;
    const venture = norm.venturesById[ventureId];
    const lines = norm.linesByVenture[ventureId] ?? [];
    const [lineId, setLineId] = (0, react_1.useState)(lines.find((l) => l.track_role === "ACTIVE_GOVERNING")?.id
        ?? lines.find((l) => l.track_role === "ASSIGNED_IN_TRACKER")?.id
        ?? lines[0]?.id
        ?? null);
    const line = norm.linesById[lineId] ?? lines[0] ?? null;
    if (!venture)
        return null;
    const isConfirmedModel = venture.model_resolution_status === "CONFIRMED";
    const modelHeaderLabel = isConfirmedModel
        ? venture.primary_business_model
        : "Unresolved · Owner clarification required";
    return (React.createElement("div", { className: "flex flex-col gap-5" },
        React.createElement("div", { className: "flex flex-wrap items-start justify-between gap-3" },
            React.createElement("div", { className: "min-w-0 flex-1" },
                React.createElement("p", { className: "break-words text-xs text-muted" },
                    venture.id,
                    " \u00B7 Governing model: ",
                    modelHeaderLabel,
                    " \u00B7 Venture workspace"),
                React.createElement("div", { className: "mt-1 flex flex-wrap items-center gap-2" },
                    React.createElement("h1", { className: "text-xl font-bold tracking-tight text-nav" }, venture.name)),
                React.createElement("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-sm" },
                    React.createElement("span", { className: "rounded-lg bg-nav px-2.5 py-1 text-xs font-semibold text-white" }, venture.programme_level),
                    React.createElement("span", { className: "text-nav" }, venture.msl_eligibility),
                    React.createElement(StatusBadge_jsx_1.ProvenanceLabel, { text: venture.msl_eligibility_provenance }),
                    venture.advancement_status && venture.advancement_status !== "No transition recorded" ? (React.createElement("span", { className: "text-xs text-muted" }, venture.advancement_status)) : null)),
            (0, status_js_1.can)(role, "submit_update") ? (React.createElement(Button_jsx_1.default, { variant: "primary", onClick: () => props.onSubmitUpdate({ ventureId, lineId: line?.id }), className: "shrink-0" },
                React.createElement(lucide_react_1.PlusCircle, { size: 15, "aria-hidden": true }),
                " Submit Update")) : null),
        React.createElement(SevenStateCards_jsx_1.default, { venture: venture }),
        venture.programme_level_provenance ? (React.createElement("p", { className: "text-xs text-muted" },
            "Programme level provenance: ",
            venture.programme_level_provenance)) : null,
        React.createElement("div", { className: "relative" },
            React.createElement("div", { className: "flex gap-1 overflow-x-auto border-b border-border-ui pb-px", role: "tablist", "aria-label": "Venture workspace tabs" }, TABS.map(([id, label]) => (React.createElement("button", { key: id, role: "tab", "aria-selected": tab === id, onClick: () => onTab(id), className: `shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${tab === id ? "border-b-2 border-brand text-nav" : "text-muted hover:text-nav"}` }, label))))),
        tab === "overview" ? (React.createElement("div", { className: "flex flex-col gap-5" },
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Key issues" }),
                React.createElement(IssueChips, { norm: norm, ventureId: ventureId })),
            venture.recorded_update ? (React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Recorded update" }),
                React.createElement("div", { className: "rounded-xl border border-border-ui bg-white px-4 py-3 text-sm text-nav" }, venture.recorded_update))) : null,
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Latest update", action: (0, status_js_1.can)(role, "submit_update") ? (React.createElement(Button_jsx_1.default, { onClick: () => props.onSubmitUpdate({ ventureId, lineId: line?.id }) }, "Submit Update")) : null }),
                React.createElement(LatestUpdate, { norm: norm, ventureId: ventureId, role: role, onReview: props.onReview })),
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Business-model context", subtitle: isConfirmedModel
                        ? `Governing business model: ${venture.primary_business_model} (Confirmed)`
                        : "Governing business model: Unresolved · Owner clarification required" }),
                React.createElement("ul", { className: "flex flex-col gap-2" }, lines.map((l) => (React.createElement("li", { key: l.id, className: "flex flex-wrap items-center gap-2 rounded-xl border border-border-ui bg-white px-4 py-2.5 text-sm" },
                    React.createElement("span", { className: "font-medium text-nav" }, l.line_name),
                    React.createElement("span", { className: "font-mono text-xs text-muted" }, l.id),
                    l.track_role === "ACTIVE_GOVERNING" && l.approved_model ? (React.createElement(StatusBadge_jsx_1.default, { status: "MET", title: `Confirmed governing model ${l.approved_model}` })) : null,
                    React.createElement("span", { className: "text-xs text-muted" }, lineRoleSummary(l))))))),
            React.createElement("section", null,
                React.createElement(SectionHeader_jsx_1.default, { title: "Next actions" }),
                React.createElement("div", { className: "flex flex-wrap gap-2" },
                    (0, status_js_1.can)(role, "submit_update") ? (React.createElement(Button_jsx_1.default, { variant: "primary", onClick: () => props.onSubmitUpdate({ ventureId, lineId: line?.id }) },
                        "Submit Update ",
                        React.createElement(lucide_react_1.ArrowRight, { size: 15, "aria-hidden": true }))) : null,
                    (0, status_js_1.can)(role, "record_transition") ? (React.createElement(Button_jsx_1.default, { onClick: () => props.onTransition(ventureId) }, "Record Transition")) : null,
                    (0, status_js_1.can)(role, "clarify_model") && venture.model_resolution_status !== "CONFIRMED" ? (React.createElement(Button_jsx_1.default, { onClick: () => props.onClarify(ventureId) }, "Clarify Model")) : null,
                    (0, status_js_1.can)(role, "record_mentor") ? (React.createElement(Button_jsx_1.default, { onClick: () => props.onMentor(ventureId) }, "Record Mentor Outcome")) : null)))) : null,
        tab === "requirements" ? (React.createElement("div", { className: "flex flex-col gap-4" },
            React.createElement(BusinessLineTabs_jsx_1.default, { lines: lines, selectedId: line?.id, onSelect: setLineId }),
            React.createElement(CriteriaMatrix_jsx_1.default, { norm: norm, ventureId: ventureId, line: line, role: role, onChanged: props.onChanged, onSubmitUpdate: props.onSubmitUpdate, onReview: props.onReview, openCriterionId: props.openCriterionId }))) : null,
        tab === "evidence" ? React.createElement(FinancialLedger_jsx_1.default, { norm: norm, ventureId: ventureId, role: role, onReview: props.onReview }) : null,
        tab === "history" ? (React.createElement(DecisionHistoryTimeline_jsx_1.default, { norm: norm, ventureId: ventureId, role: role, onTransition: props.onTransition, onClarify: props.onClarify, onMentor: props.onMentor, onCertifyMsl: props.onCertifyMsl })) : null));
}

};
modules["src/main.jsx"]=function(module,exports,require){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const React = __importStar(require("react"));
const react_1 = require("react");
const client_1 = require("react-dom/client");
require("./styles.css");
const App_jsx_1 = __importDefault(require("./App.jsx"));
(0, client_1.createRoot)(document.getElementById('root')).render(React.createElement(react_1.StrictMode, null,
    React.createElement(App_jsx_1.default, null)));

};
modules["src/utils/criteria.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PILOT_QUALIFICATION_OPTIONS = void 0;
exports.isQualitativeCriterion = isQualitativeCriterion;
exports.qualitativeFields = qualitativeFields;
exports.blankQualitative = blankQualitative;
exports.qualitativeValues = qualitativeValues;
exports.configurationSchema = configurationSchema;
const format_js_1 = require("./format.js");
exports.PILOT_QUALIFICATION_OPTIONS = ["Pilot completion report"];
const AGGREGATION_METHODS = [
    "SUM",
    "DISTINCT_ENTITY",
    "SUSTAINED_MIN",
    "PERCENT",
    "COHORT",
    "CUMULATIVE",
    "COLLECTED",
    "EARNED",
    "QUALIFYING_PILOTS",
];
function isQualitativeCriterion(criterion) {
    if (!criterion)
        return false;
    return (criterion.unit === "QUALITATIVE"
        || criterion.metric_type === "QUALITATIVE"
        || String(criterion.id).startsWith("L0-Q"));
}
function qualitativeFields(criterion) {
    if (!isQualitativeCriterion(criterion))
        return [];
    const subconditions = (0, format_js_1.parseJSON)(criterion.subconditions_json, null)?.subconditions;
    if (Array.isArray(subconditions) && subconditions.length) {
        return subconditions.map((subcondition) => ({
            key: subcondition.id,
            label: subcondition.description,
            kind: subcondition.threshold != null ? "number" : "boolean",
            threshold: subcondition.threshold,
        }));
    }
    return [{ key: "met", label: "Confirmed as met", kind: "boolean" }];
}
function blankQualitative(criterion) {
    const values = {};
    for (const field of qualitativeFields(criterion)) {
        values[field.key] = field.kind === "number" ? "" : false;
    }
    return values;
}
function qualitativeValues(criterion, values) {
    const out = {};
    for (const field of qualitativeFields(criterion)) {
        if (field.kind === "number") {
            if (values[field.key] !== "" && values[field.key] != null) {
                out[field.key] = Number(values[field.key]);
            }
        }
        else {
            out[field.key] = Boolean(values[field.key]);
        }
    }
    return out;
}
function configurationSchema(criterion) {
    if (!criterion)
        return null;
    const metric = criterion.metric_type;
    const unit = criterion.unit;
    if (metric === "WAU") {
        return {
            fields: ["threshold", "aggregation", "window"],
            methods: ["SUSTAINED_MIN"],
            thresholdLabel: "Threshold (WAU)",
            windowLabel: "Window weeks",
            defaultMethod: "SUSTAINED_MIN",
        };
    }
    if (unit === "INR_PAISE") {
        return {
            fields: ["threshold", "aggregation", "basis", "period"],
            methods: ["SUM"],
            thresholdLabel: "Threshold (INR)",
            defaultMethod: "SUM",
            defaultBasis: "COLLECTED",
        };
    }
    if (metric === "RETENTION") {
        return {
            fields: ["threshold", "aggregation", "cohort", "window"],
            methods: ["PERCENT"],
            thresholdLabel: "Threshold (%)",
            windowLabel: "Retention window",
            defaultMethod: "PERCENT",
        };
    }
    if (metric === "PILOT_COUNT") {
        return {
            fields: ["threshold", "aggregation", "pilot"],
            methods: ["QUALIFYING_PILOTS"],
            thresholdLabel: "Threshold",
            defaultMethod: "QUALIFYING_PILOTS",
        };
    }
    if (unit === "COUNT" || unit === "PERCENT") {
        return {
            fields: ["threshold", "aggregation", "range"],
            methods: ["DISTINCT_ENTITY"],
            thresholdLabel: unit === "PERCENT" ? "Threshold (%)" : "Threshold",
            defaultMethod: "DISTINCT_ENTITY",
        };
    }
    return {
        fields: ["threshold", "aggregation"],
        methods: AGGREGATION_METHODS,
        thresholdLabel: "Threshold",
        defaultMethod: "SUM",
    };
}

};
modules["src/utils/evidence.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourcePolicy = sourcePolicy;
exports.unitLabel = unitLabel;
function sourcePolicy(norm, sourceType) {
    const policy = norm?.evidenceTypePolicy ?? {};
    const wanted = String(sourceType ?? "").trim().toLowerCase();
    if (!wanted)
        return null;
    const key = Object.keys(policy).find((name) => name.toLowerCase() === wanted);
    return key ? policy[key] : null;
}
const UNIT_LABELS = {
    INR_PAISE: "INR_PAISE (paise)",
    COUNT: "COUNT",
    PERCENT: "PERCENT",
    QUALITATIVE: "QUALITATIVE",
};
function unitLabel(unit) {
    if (!unit)
        return "None";
    return UNIT_LABELS[unit] ?? unit;
}

};
modules["src/utils/format.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatINRPaise = formatINRPaise;
exports.parseJSON = parseJSON;
exports.formatDateTime = formatDateTime;
exports.shortId = shortId;
function formatINRPaise(value) {
    if (value == null)
        return "Unknown";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value / 100);
}
function parseJSON(value, fallback = null) {
    if (value == null)
        return fallback;
    if (typeof value === "object")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
function formatDateTime(value) {
    if (!value || value === "Unknown")
        return "Unknown";
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return String(value);
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function shortId(value, n = 8) {
    if (!value)
        return "—";
    return String(value).length > n + 3 ? `${String(value).slice(0, n)}…` : String(value);
}

};
modules["src/utils/normalizeState.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeState = normalizeState;
exports.evalFor = evalFor;
function groupBy(rows, key) {
    const map = {};
    for (const r of rows ?? []) {
        const k = r?.[key] ?? "";
        (map[k] ?? (map[k] = [])).push(r);
    }
    return map;
}
function normalizeState(s) {
    const ventures = s?.ventures ?? [];
    const lines = s?.venture_business_lines ?? [];
    const catalog = s?.criteria_catalog ?? [];
    const updates = s?.progress_updates ?? [];
    const evidence = s?.evidence_records ?? s?.evidence ?? [];
    const observations = s?.evidence_observations ?? s?.observations ?? [];
    const history = s?.evidence_review_history ?? s?.history ?? [];
    const transitions = s?.transition_decisions ?? s?.transitions ?? [];
    const msl = s?.msl_eligibility_decisions ?? s?.msl ?? [];
    const evaluated = s?.evaluated_criteria ?? [];
    const rollups = s?.venture_rollups ?? [];
    const ledgers = s?.ledgers ?? [];
    const evalMap = new Map(evaluated.map((e) => [`${e.venture_id}|${e.business_line_id ?? ""}|${e.criterion_id}`, e]));
    return {
        raw: s,
        ventures,
        lines,
        catalog,
        updates,
        evidence,
        observations,
        history,
        transitions,
        msl,
        evaluated,
        ledgers,
        staffQueue: s?.staff_queue ?? { unreviewed_evidence: [], owner_clarifications: [], mentor_followups: [], pending_actions: [], unresolved_criteria: [] },
        qualifierOptions: s?.qualifier_options ?? {},
        evidenceTypePolicy: s?.evidence_type_policy ?? {},
        pendingCorrections: s?.pending_corrections ?? [],
        venturesById: Object.fromEntries(ventures.map((v) => [v.id, v])),
        linesByVenture: groupBy(lines, "venture_id"),
        linesById: Object.fromEntries(lines.map((l) => [l.id, l])),
        catalogById: Object.fromEntries(catalog.map((c) => [c.id, c])),
        evidenceById: Object.fromEntries(evidence.map((e) => [e.id, e])),
        obsByEvidence: groupBy(observations, "evidence_id"),
        historyByEvidence: groupBy(history, "evidence_id"),
        updatesByVenture: groupBy(updates, "venture_id"),
        transitionsByVenture: groupBy(transitions, "venture_id"),
        mslByVenture: groupBy(msl, "venture_id"),
        rollupByVenture: Object.fromEntries(rollups.map((r) => [r.venture_id, r])),
        ledgerByLine: Object.fromEntries(ledgers.map((l) => [`${l.venture_id}|${l.business_line_id}`, l])),
        evalMap,
    };
}
function evalFor(norm, ventureId, lineId, criterionId) {
    return norm.evalMap.get(`${ventureId}|${lineId ?? ""}|${criterionId}`) ?? null;
}

};
modules["src/utils/qa.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQaOnly = isQaOnly;
function isQaOnly() {
    if (typeof window === "undefined")
        return false;
    if (window.__ILS_QA_ONLY__ === true)
        return true;
    try {
        return new URLSearchParams(window.location.search).get("qa") === "1";
    }
    catch {
        return false;
    }
}

};
modules["src/utils/status.js"]=function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITY_MATRIX = exports.ROLES = exports.RESULT_TONE = exports.STATUS_META = void 0;
exports.statusMeta = statusMeta;
exports.roleLabel = roleLabel;
exports.can = can;
exports.canReview = canReview;
exports.canManageData = canManageData;
exports.canConfigure = canConfigure;
exports.canLogMentor = canLogMentor;
exports.STATUS_META = {
    APPROVED: { label: "Approved", classes: "bg-teal-50 text-teal-800 ring-teal-600/20" },
    MET: { label: "Met", classes: "bg-teal-50 text-teal-800 ring-teal-600/20" },
    PASSED: { label: "Passed", classes: "bg-teal-50 text-teal-800 ring-teal-600/20" },
    UNREVIEWED: { label: "Awaiting review", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    CHANGES_REQUESTED: { label: "Changes requested", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    BLOCKED: { label: "Blocked", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    UNRESOLVED: { label: "Unresolved", classes: "bg-amber-50 text-amber-800 ring-amber-600/20" },
    NOT_MET: { label: "Not met", classes: "bg-red-50 text-red-800 ring-red-600/20" },
    FAILED: { label: "Failed", classes: "bg-red-50 text-red-800 ring-red-600/20" },
    UNKNOWN: { label: "Not supplied", classes: "bg-slate-100 text-slate-600 ring-slate-500/20" },
    NOT_RUN: { label: "Not Run", classes: "bg-slate-100 text-slate-600 ring-slate-500/20" },
    NOT_APPLICABLE: { label: "Not applicable", classes: "bg-slate-100 text-slate-600 ring-slate-500/20" },
    IN_PROGRESS: { label: "In progress", classes: "bg-blue-50 text-blue-800 ring-blue-600/20" },
};
function statusMeta(status) {
    return (exports.STATUS_META[status] ?? {
        label: status ?? "Not supplied",
        classes: "bg-slate-100 text-slate-600 ring-slate-500/20",
    });
}
exports.RESULT_TONE = {
    MET: "met",
    NOT_MET: "not-met",
    UNKNOWN: "unknown",
    IN_PROGRESS: "progress",
    BLOCKED: "blocked",
};
exports.ROLES = [
    { id: "PROGRAMME_OWNER", label: "Programme Owner" },
    { id: "PROGRAMME_REVIEWER", label: "Programme Reviewer" },
    { id: "MENTOR", label: "Mentor" },
    { id: "STUDENT_FOUNDER", label: "Student Founder" },
];
function roleLabel(role) {
    return exports.ROLES.find((r) => r.id === role)?.label ?? role;
}
exports.CAPABILITY_MATRIX = {
    submit_update: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: true, MENTOR: true, STUDENT_FOUNDER: true },
    review_evidence: { PROGRAMME_OWNER: false, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
    record_transition: { PROGRAMME_OWNER: false, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
    certify_msl: { PROGRAMME_OWNER: false, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
    clarify_model: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: false, MENTOR: false, STUDENT_FOUNDER: false },
    configure_rule: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: false, MENTOR: false, STUDENT_FOUNDER: false },
    record_mentor: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: true, MENTOR: true, STUDENT_FOUNDER: false },
    import_venture: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
    reset_seed: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
    export_data: { PROGRAMME_OWNER: true, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
};
function can(role, action) {
    return Boolean(exports.CAPABILITY_MATRIX[action]?.[role]);
}
function canReview(role) {
    return can(role, "review_evidence");
}
function canManageData(role) {
    return can(role, "import_venture");
}
function canConfigure(role) {
    return can(role, "configure_rule");
}
function canLogMentor(role) {
    return can(role, "record_mentor");
}

};
load('src/main.jsx', 'src/main.jsx');
})();
