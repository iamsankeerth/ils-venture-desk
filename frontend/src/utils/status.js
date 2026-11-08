export const STATUS_META = {
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

export function statusMeta(status) {
  return (
    STATUS_META[status] ?? {
      label: status ?? "Not supplied",
      classes: "bg-slate-100 text-slate-600 ring-slate-500/20",
    }
  );
}

export const RESULT_TONE = {
  MET: "met",
  NOT_MET: "not-met",
  UNKNOWN: "unknown",
  IN_PROGRESS: "progress",
  BLOCKED: "blocked",
};

export const ROLES = [
  { id: "PROGRAMME_OWNER", label: "Programme Owner" },
  { id: "PROGRAMME_REVIEWER", label: "Programme Reviewer" },
  { id: "MENTOR", label: "Mentor" },
  { id: "STUDENT_FOUNDER", label: "Student Founder" },
];

export function roleLabel(role) {
  return ROLES.find((r) => r.id === role)?.label ?? role;
}

export const CAPABILITY_MATRIX = {
  submit_update:   { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: true,  MENTOR: true,  STUDENT_FOUNDER: true },
  review_evidence: { PROGRAMME_OWNER: false, PROGRAMME_REVIEWER: true,  MENTOR: false, STUDENT_FOUNDER: false },
  record_transition: { PROGRAMME_OWNER: false, PROGRAMME_REVIEWER: true, MENTOR: false, STUDENT_FOUNDER: false },
  certify_msl:     { PROGRAMME_OWNER: false, PROGRAMME_REVIEWER: true,  MENTOR: false, STUDENT_FOUNDER: false },
  clarify_model:   { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: false, MENTOR: false, STUDENT_FOUNDER: false },
  configure_rule:  { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: false, MENTOR: false, STUDENT_FOUNDER: false },
  record_mentor:   { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: true,  MENTOR: true,  STUDENT_FOUNDER: false },
  import_venture:  { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: true,  MENTOR: false, STUDENT_FOUNDER: false },
  reset_seed:      { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: true,  MENTOR: false, STUDENT_FOUNDER: false },
  export_data:     { PROGRAMME_OWNER: true,  PROGRAMME_REVIEWER: true,  MENTOR: false, STUDENT_FOUNDER: false },
};

export function can(role, action) {
  return Boolean(CAPABILITY_MATRIX[action]?.[role]);
}

export function canReview(role) {
  return can(role, "review_evidence");
}
export function canManageData(role) {
  return can(role, "import_venture");
}
export function canConfigure(role) {
  return can(role, "configure_rule");
}
export function canLogMentor(role) {
  return can(role, "record_mentor");
}
