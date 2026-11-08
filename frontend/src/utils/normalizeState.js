function groupBy(rows, key) {
  const map = {};
  for (const r of rows ?? []) {
    const k = r?.[key] ?? "";
    (map[k] ??= []).push(r);
  }
  return map;
}

export function normalizeState(s) {
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

  const evalMap = new Map(
    evaluated.map((e) => [`${e.venture_id}|${e.business_line_id ?? ""}|${e.criterion_id}`, e])
  );

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

export function evalFor(norm, ventureId, lineId, criterionId) {
  return norm.evalMap.get(`${ventureId}|${lineId ?? ""}|${criterionId}`) ?? null;
}
