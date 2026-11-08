"""Criterion evaluation engine: evidence_status != criterion_result, atomic supersession, rollups, ledgers, staff queue."""
from __future__ import annotations

import json
import sqlite3
import re
from datetime import date

from backend.db import fetch_all
from backend.rules import (
    MSL_COMMON_GATE,
    MSL_MODEL_SPECIFIC_GATE,
    PILOT_QUALIFICATION_SOURCES,
    canonical_source_type,
    configuration_error,
    is_completed_pilot_source,
    is_loi_source,
    line_models,
    required_qualifiers,
)


def _parse(v):
    if v is None or isinstance(v, (dict, list)):
        return v
    try:
        return json.loads(v)
    except (ValueError, TypeError):
        return v


def format_inr(paise: int | None) -> str | None:
    if paise is None:
        return None
    return f"\u20b9{paise // 100:,}"


def load_state(con: sqlite3.Connection) -> dict:
    ventures = fetch_all(con, "ventures")
    lines = fetch_all(con, "venture_business_lines")
    catalog = fetch_all(con, "criteria_catalog")
    updates = fetch_all(con, "progress_updates")
    evidence = fetch_all(con, "evidence_records")
    observations = fetch_all(con, "evidence_observations")
    history = fetch_all(con, "evidence_review_history")
    transitions = fetch_all(con, "transition_decisions")
    msl = fetch_all(con, "msl_eligibility_decisions")
    return {
        "ventures": ventures, "lines": lines, "catalog": catalog,
        "updates": updates, "evidence": evidence, "observations": observations,
        "history": history, "transitions": transitions, "msl": msl,
    }


def _rule_blocked(crit: dict) -> bool:
    """Never mark an unresolved or invalid programme rule as satisfied."""
    if not crit.get("is_configurable_range"):
        return False
    return configuration_error(
        crit,
        crit.get("configured_value"),
        _parse(crit.get("configured_rule_json")),
    ) is not None


def _configured_period_matches(evidence: dict, period: str | None) -> bool:
    if not period or str(period).strip().lower() in {"all supplied periods", "all supplied period"}:
        return True
    target = str(period).strip()
    values = {
        str(value)
        for value in (
            evidence.get("period_label"),
            evidence.get("earned_period"),
            evidence.get("payment_date"),
        )
        if value
    }
    return target in values


def _metric_threshold(crit: dict) -> int | float | None:
    if crit.get("is_configurable_range") and crit.get("configured_value") is not None:
        return crit["configured_value"]
    return crit.get("threshold_value")


def _period_week(label: str | None):
    """Parse source's week-ending month and day WITHOUT inventing an actual year."""
    if not label:
        return None
    m = re.search(r"(?:week\s+ending\s+)(\d{1,2})\s+([A-Za-z]+)", label, re.I)
    if not m:
        return None
    months = {name.lower(): i for i, name in enumerate(
        ('January','February','March','April','May','June','July','August',
         'September','October','November','December'),1)}
    mon = months.get(m.group(2).lower())
    if mon is None:
        return None
    try:
        return date(2000, mon, int(m.group(1)))
    except ValueError:
        return None


def _distinct_week_windows(obs: list[dict], window: int) -> tuple[list, bool]:
    """Return sorted latest weekly readings and whether a true consecutive window exists."""
    ordered = sorted(obs, key=lambda o: (o.get("period_sequence") or 0, o.get("period_label") or ""))
    if len(ordered) < window:
        return ordered, False
    # Multiple unsuperseded observations for the same reporting period are not two weeks.
    periods = [(o.get("period_label"), o.get("period_sequence")) for o in ordered]
    if len({o[0] for o in periods}) < len(periods):
        return ordered, False
    for offset in range(len(ordered)-window+1):
        segment = ordered[offset:offset+window]
        seqs = [x.get("period_sequence") for x in segment]
        if any(not isinstance(x, int) or x <= 0 for x in seqs):
            continue
        if not all(seqs[i+1] == seqs[i] + 1 for i in range(window-1)):
            continue
        parsed = [_period_week(x.get("period_label")) for x in segment]
        if all(parsed) and not all((parsed[i+1]-parsed[i]).days == 7 for i in range(window-1)):
            continue
        return segment, True
    return ordered, False


def _result(crit: dict, rel_ev: list, status: str, readings: list, detail: str):
    return _with_ev_meta({"criterion_id": crit["id"], "criterion_result": status,
        "verified_readings": readings, "pending_corrections": [], "detail": detail}, rel_ev)


def _superseded_evidence_ids(evidence: list[dict]) -> set[str]:
    return {
        e["supersedes_evidence_id"]
        for e in evidence
        if e.get("evidence_status") == "APPROVED" and e.get("supersedes_evidence_id")
    }


def _active_evidence(evidence: list[dict]) -> list[dict]:
    superseded = _superseded_evidence_ids(evidence)
    return [
        e
        for e in evidence
        if not (e.get("evidence_status") == "APPROVED" and e["id"] in superseded)
    ]


def split_observations(state: dict) -> tuple[list, list]:
    """Return (active_verified_observations, pending_corrections).

    An observation is verified only when its parent evidence is APPROVED and
    no APPROVED observation supersedes it. A replacement whose parent is
    still UNREVIEWED is a pending correction (AT-13B), never counted.
    """
    ev_status = {e["id"]: e["evidence_status"] for e in state["evidence"]}
    obs = state["observations"]
    superseded_evidence = _superseded_evidence_ids(state["evidence"])
    superseded_by_approved: set[str] = set()
    for o in obs:
        sid = o.get("supersedes_observation_id")
        if sid and ev_status.get(o["evidence_id"]) == "APPROVED":
            superseded_by_approved.add(sid)
    active, pending = [], []
    for o in obs:
        st = ev_status.get(o["evidence_id"])
        if o["evidence_id"] in superseded_evidence:
            continue
        if o["id"] in superseded_by_approved:
            continue  # atomically replaced in audit history
        if st == "APPROVED":
            active.append(o)
        elif st == "UNREVIEWED" and o.get("supersedes_observation_id"):
            pending.append(o)
        # CHANGES_REQUESTED / UNREVIEWED base claims are not verified
    return active, pending


def _line_models(line: dict) -> list[str]:
    return line_models(line)


def _related_evidence_for_criterion(state: dict, venture_id: str, criterion_id: str, line_id: str | None) -> list[dict]:
    ev_by_id = {e["id"]: e for e in state["evidence"]}
    matched_ids: list[str] = []
    for e in state["evidence"]:
        if e.get("venture_id") != venture_id:
            continue
        if (line_id is not None and e.get("business_line_id") != line_id) or (line_id is None and e.get("business_line_id") is not None):
            continue
        if e.get("criterion_id") == criterion_id and e["id"] not in matched_ids:
            matched_ids.append(e["id"])
    for o in state["observations"]:
        if o.get("venture_id") != venture_id or o.get("criterion_id") != criterion_id:
            continue
        if (line_id is not None and o.get("business_line_id") != line_id) or (line_id is None and o.get("business_line_id") is not None):
            continue
        eid = o.get("evidence_id")
        if eid and eid in ev_by_id and eid not in matched_ids:
            matched_ids.append(eid)
    superseded = _superseded_evidence_ids(state["evidence"])
    return [ev_by_id[eid] for eid in matched_ids if eid not in superseded]


def _obs_for(active: list, venture_id: str, criterion_id: str, line_id: str | None) -> list:
    out = [o for o in active if o.get("venture_id") == venture_id and o.get("criterion_id") == criterion_id]
    out = [o for o in out if o.get("business_line_id") == line_id]
    return out


def _with_ev_meta(res: dict, rel_ev: list[dict]) -> dict:
    res["related_evidence_ids"] = [e["id"] for e in rel_ev]
    res["latest_evidence_status"] = rel_ev[-1]["evidence_status"] if rel_ev else None
    return res


def evaluate_criterion(crit: dict, active: list, state: dict, venture_id: str, line_id: str | None) -> dict:
    cid = crit["id"]
    rel_ev = _related_evidence_for_criterion(state, venture_id, cid, line_id)
    if _rule_blocked(crit):
        return _result(crit, rel_ev, "BLOCKED", [], "Programme rule requires valid owner configuration")
    obs = _obs_for(active, venture_id, cid, line_id)
    threshold = _metric_threshold(crit)
    ev_by_id = {e["id"]: e for e in state["evidence"]}
    # Evidence may support several criteria, but its ownership must match the observation.
    obs = [o for o in obs if (ev_by_id.get(o["evidence_id"], {}).get("venture_id") == venture_id)
           and (line_id is None or ev_by_id[o["evidence_id"]].get("business_line_id") in (None,line_id))]

    if cid.startswith("L0-Q") or crit.get("unit") == "QUALITATIVE":
        subspec = (_parse(crit.get("subconditions_json")) or {})
        conditions = subspec.get("subconditions", []) if isinstance(subspec,dict) else []
        if not obs:
            return _result(crit, rel_ev, "UNKNOWN", [], "No approved qualitative evidence")
        for o in obs:
            data = _parse(o.get("qualitative_value_json"))
            if not isinstance(data, dict):
                data = {}
            if conditions:
                failures = []
                for sub in conditions:
                    key = sub["id"]
                    v = data.get(key)
                    aliases = {"canvas":"canvas_evidence", "mentor_signoff":"mentor_sign_off",
                               "result":"recorded_result", "decision":"recorded_decision"}
                    if v is None:
                        v = data.get(aliases.get(key, key))
                    limit = sub.get("threshold")
                    if limit is not None:
                        # Boolean True is NOT evidence of 55 conversations or >=3 weeks.
                        if isinstance(v, bool) or not isinstance(v, (int,float)) or v < limit:
                            failures.append(f"{key} requires >= {limit}")
                    elif v is not True and (not isinstance(v,str) or not v.strip()):
                        failures.append(key)
                if not failures:
                    return _result(crit, rel_ev, "MET", ["met"], "All approved qualitative subconditions confirmed")
            elif data.get("met") is True or o.get("qualifier_status") in ("met","MET"):
                return _result(crit, rel_ev, "MET", ["met"], "Approved qualitative evidence")
        return _result(crit, rel_ev, "IN_PROGRESS", [], "Missing or insufficient qualitative subconditions")

    if crit.get("metric_type") == "WAU" or cid == "L0L1-AIB2C-2":
        numeric_obs = [o for o in obs if o.get("numeric_value") is not None]
        if not numeric_obs:
            return _result(crit, rel_ev, "UNKNOWN", [], "No numeric weekly observations")
        need = int((_parse(crit.get("configured_rule_json")) or {}).get("window_weeks") or crit.get("window_length") or 2)
        win, consecutive = _distinct_week_windows(numeric_obs, need)
        ordered = sorted(numeric_obs,key=lambda o:o.get("period_sequence") or 0)
        readings = [o.get("numeric_value") for o in ordered]
        if consecutive:
            windows = []
            for start in range(len(ordered)-need+1):
                part=ordered[start:start+need]
                _, valid = _distinct_week_windows(part, need)
                if valid:
                    windows.append(part)
            if any(all((o.get("numeric_value") is not None and o["numeric_value"] >= threshold) for o in w) for w in windows):
                status="MET"
            else:
                status="NOT_MET"
        else:
            status="IN_PROGRESS" if len(ordered) < need else "NOT_MET"
        if status == "MET":
            detail = f"WAU {readings}; {need} consecutive weeks at >= {threshold}"
        elif status == "NOT_MET":
            detail = f"WAU {readings}; no {need}-week consecutive window at >= {threshold}"
        else:
            detail = f"WAU {readings}; {len(readings)} of {need} weekly readings"
        return _result(crit, rel_ev, status, readings, detail)

    if cid == "L0L1-AIB2C-1":
        obs = [
            o
            for o in obs
            if o.get("qualifier_status") in ("QUALIFIED", "qualified")
            and o.get("numeric_value") is not None
        ]
        if not obs:
            return _result(crit, rel_ev, "UNKNOWN", [], "Target-segment membership not verified")
        # Counts with a distinct person key are deduplicated, otherwise treat repeated aggregate
        # readings as cumulative snapshots, never add overlapping cohorts blindly.
        if all(o.get("entity_key") for o in obs):
            total = len({o["entity_key"] for o in obs})
        else:
            total = max((o.get("numeric_value") or 0) for o in obs)
        return _result(crit, rel_ev, "MET" if total >= threshold else "IN_PROGRESS", [total],
                       f"Verified target-segment sign-ups {total} / {threshold}")

    if crit.get("metric_type") in ("DOCUMENT", "COMPLETED_PILOTS", "PILOT_COUNT"):
        metric = crit.get("metric_type")
        is_loi = "LOI" in (crit.get("name") or "").upper() or "LOI" in cid
        rule = _parse(crit.get("configured_rule_json")) or {}
        allowed_pilot_sources = PILOT_QUALIFICATION_SOURCES.get(rule.get("pilot_qualification"))
        qualifying = []
        for e in _active_evidence(state["evidence"]):
            if e.get("venture_id") != venture_id or e.get("evidence_status") != "APPROVED":
                continue
            if line_id is not None and e.get("business_line_id") != line_id:
                continue
            if is_loi:
                if not is_loi_source(e.get("source_type")):
                    continue
                if e.get("ledger_bucket") != "COMMERCIAL_INTENT":
                    continue
            else:
                if not is_completed_pilot_source(e.get("source_type")):
                    continue
                if allowed_pilot_sources is not None and canonical_source_type(e.get("source_type")) not in allowed_pilot_sources:
                    continue
                if e.get("criterion_id") != cid:
                    continue
            qualifying.append(e)
        # One document and its attached observation represent ONE commercial event.
        # Deduplicate repeated agreement copies from the same counterparty.
        distinct = set()
        for e in qualifying:
            doc_type = "SIGNED_LOI" if is_loi else metric
            distinct.add((doc_type, e.get("counterparty") or e["id"]))
        count=len(distinct)
        return _result(crit, rel_ev, "MET" if count >= threshold else ("IN_PROGRESS" if count else "UNKNOWN"),
                       [count] if count else [], f"{count} distinct qualifying documents / {threshold}")

    if crit.get("unit") == "INR_PAISE":
        # Count each approved monetary source once. A numeric observation attached to the same
        # receipt is descriptive, not another payment.
        rule = _parse(crit.get("configured_rule_json")) or {}
        basis = rule.get("metric_basis")
        configured_period = rule.get("period") if crit.get("is_configurable_range") else None
        source_buckets = {"COLLECTED"} if basis in (None, "COLLECTED") else ({"EARNED"} if basis == "EARNED" else {"BILLED"})
        related_cash = [e for e in _active_evidence(state["evidence"])
            if e.get("venture_id")==venture_id and e.get("evidence_status")=="APPROVED"
            and e.get("ledger_bucket") in source_buckets and e.get("unit")=="INR_PAISE"
            and (line_id is None or e.get("business_line_id")==line_id)
            and e.get("amount_minor_or_count") is not None
            and _configured_period_matches(e, configured_period)]
        total=sum(max(0,e["amount_minor_or_count"]) for e in related_cash)
        related_ids={e["id"] for e in related_cash}
        fallback=[]
        for o in obs:
            if o.get("unit") != "INR_PAISE" or o.get("numeric_value") is None or o["evidence_id"] in related_ids:
                continue
            ev=ev_by_id.get(o["evidence_id"])
            if not ev or ev.get("evidence_status")!="APPROVED" or ev.get("ledger_bucket") not in source_buckets:
                continue
            if not _configured_period_matches(ev, configured_period):
                continue
            fallback.append(o)
        total += sum(o["numeric_value"] for o in fallback)
        contributing = {e["id"]: e for e in related_cash}
        for o in fallback:
            ev=ev_by_id.get(o["evidence_id"])
            if ev:
                contributing[ev["id"]]=ev
        related_ev_ids={e["id"] for e in rel_ev}
        for eid, ev in contributing.items():
            if eid not in related_ev_ids:
                rel_ev.append(ev)
                related_ev_ids.add(eid)
        exists=bool(related_cash or fallback)
        if not exists:
            return _result(crit, rel_ev, "UNKNOWN", [], "No approved collected/earned financial evidence")
        return _result(crit, rel_ev, "MET" if total>=threshold else "IN_PROGRESS", [total], f"{total} paise / {threshold}")

    if crit.get("unit") in ("COUNT", "PERCENT"):
        if not obs:
            return _result(crit, rel_ev, "UNKNOWN", [], "No approved observations")
        qualified=[
            o for o in obs
            if o.get("numeric_value") is not None
            and o.get("qualifier_status") not in ("UNQUALIFIED", "unqualified")
        ]
        required = required_qualifiers(cid)
        if required:
            qualified = [
                o for o in qualified
                if (o.get("qualifier_status") or "") in required
            ]
        if not qualified:
            return _result(crit, rel_ev, "UNKNOWN", [], "No qualifying numeric observations")

        if crit.get("metric_type") == "RETENTION":
            rule = _parse(crit.get("configured_rule_json")) or {}
            cohort = rule.get("cohort_definition")
            window = rule.get("window_weeks") or crit.get("window_length")
            if not cohort or not window:
                return _result(crit, rel_ev, "BLOCKED", [], "Retention cohort and window require configuration")
            cohort_obs = [
                o for o in qualified
                if o.get("cohort_key") == cohort
                and (o.get("period_sequence") or 0) >= int(window)
            ]
            if not cohort_obs:
                return _result(
                    crit, rel_ev, "IN_PROGRESS", [],
                    f"Retention requires cohort {cohort} observed for {window} weeks",
                )
            qualified = cohort_obs

        window = crit.get("window_length")
        if window:
            cohort_obs = [
                o for o in qualified
                if o.get("cohort_key") and (o.get("period_sequence") or 0) >= int(window)
            ]
            if not cohort_obs:
                return _result(
                    crit, rel_ev, "IN_PROGRESS", [],
                    f"Requires a cohort observed for {window} weeks",
                )
            qualified = cohort_obs

        if crit.get("unit")=="PERCENT":
            total=qualified[-1].get("numeric_value")
        elif any(o.get("entity_key") for o in qualified):
            entities={o["entity_key"] for o in qualified if o.get("entity_key")}
            anonymous=max(
                (o["numeric_value"] for o in qualified if not o.get("entity_key")),
                default=0,
            )
            total=len(entities)+anonymous
        else:
            # A sequence of numeric aggregate snapshots cannot be safely summed without
            # an explicitly declared non-overlapping period-delta methodology.
            total=max(o["numeric_value"] for o in qualified)
        if total is None:
            return _result(crit, rel_ev, "UNKNOWN", [], "No qualifying numeric observations")
        return _result(crit, rel_ev, "MET" if total >= threshold else "IN_PROGRESS", [total],
                       f"{total} / {threshold}")
    return _result(crit, rel_ev, "UNKNOWN", [], "No qualifying evidence")


def _rollup(results: list[str]) -> str:
    if not results:
        return "UNKNOWN"
    if all(r == "MET" for r in results):
        return "MET"
    if any(r == "NOT_MET" for r in results):
        return "NOT_MET"
    if any(r == "BLOCKED" for r in results):
        return "BLOCKED"
    if any(r == "IN_PROGRESS" for r in results):
        return "IN_PROGRESS"
    return "UNKNOWN"


def demand_bar_criteria(catalog: list, gate: str, model: str) -> list:
    return [c for c in catalog if c.get("transition_gate") == gate
            and c.get("criterion_scope") == "BUSINESS_LINE" and c.get("business_model") == model]


def evaluate_all(con: sqlite3.Connection) -> dict:
    state = load_state(con)
    active, pending = split_observations(state)
    lines_by_venture: dict[str, list] = {}
    for l in state["lines"]:
        lines_by_venture.setdefault(l["venture_id"], []).append(l)

    evaluated: list[dict] = []
    by_key: dict[tuple, dict] = {}
    for v in state["ventures"]:
        vid = v["id"]
        for c in state["catalog"]:
            if c.get("criterion_scope") == "VENTURE":
                ev = evaluate_criterion(c, active, state, vid, None)
                ev.update({"venture_id": vid, "business_line_id": None,
                           "business_model": c.get("business_model")})
                evaluated.append(ev)
                by_key[(vid, None, c["id"])] = ev
            else:
                for l in lines_by_venture.get(vid, []):
                    l_models = _line_models(l)
                    if l_models and c.get("business_model") not in l_models:
                        continue
                    ev = evaluate_criterion(c, active, state, vid, l["id"])
                    ev.update({"venture_id": vid, "business_line_id": l["id"],
                               "business_model": c.get("business_model")})
                    evaluated.append(ev)
                    by_key[(vid, l["id"], c["id"])] = ev
    # attach pending corrections to matching criterion evals
    for p in pending:
        key = (p.get("venture_id"), p.get("business_line_id"), p.get("criterion_id"))
        if key in by_key:
            by_key[key].setdefault("pending_corrections", []).append(
                {"observation_id": p["id"], "period_label": p.get("period_label"),
                 "numeric_value": p.get("numeric_value"), "status": "Pending Correction (Unreviewed)"})

    # venture rollups
    rollups = []
    for v in state["ventures"]:
        vid = v["id"]
        models = {c.get("business_model") for c in state["catalog"]
                  if c.get("transition_gate") == "L0_TO_L1_DEMAND_BAR"}
        bars = {}
        for m in sorted(models):
            req = demand_bar_criteria(state["catalog"], "L0_TO_L1_DEMAND_BAR", m)
            res = []
            for c in req:
                for l in lines_by_venture.get(vid, []):
                    l_models = _line_models(l)
                    if l_models and m not in l_models:
                        continue
                    k = (vid, l["id"], c["id"])
                    if k in by_key:
                        res.append(by_key[k]["criterion_result"])
            bars[m] = _rollup(res) if res else "UNKNOWN"
        qual_ids = [c["id"] for c in state["catalog"] if c.get("transition_gate") == "L0_QUALITATIVE_CHECKLIST"]
        qual_res = [by_key.get((vid, None, q), {}).get("criterion_result", "UNKNOWN") for q in qual_ids]
        unknown_n = sum(1 for r in qual_res if r == "UNKNOWN")
        gov = v.get("primary_business_model") if v.get("model_resolution_status") == "CONFIRMED" else None
        bar = bars.get(gov, "UNKNOWN") if gov else "UNKNOWN"
        if bar == "MET" and all(r == "MET" for r in qual_res):
            full = "Complete"
        else:
            full = f"Not Yet Verified \u2014 {unknown_n} qualitative items Unknown" if unknown_n else "Not Yet Verified"
        rollups.append({"venture_id": vid, "demand_bars": bars, "governing_model": gov,
                        "demand_bar": bar, "qualitative": dict(zip(qual_ids, qual_res)),
                        "full_level_status": full})

    ledgers = build_ledgers(state)
    queue = build_staff_queue(state, evaluated)
    return {"evaluated_criteria": evaluated, "venture_rollups": rollups,
            "ledgers": ledgers, "staff_queue": queue,
            "pending_corrections": [{"observation_id": p["id"], "evidence_id": p["evidence_id"],
                                     "period_label": p.get("period_label"),
                                     "numeric_value": p.get("numeric_value")} for p in pending]}


def _compute_side_totals(records: list[dict]) -> dict:
    records = _active_evidence(records)
    by_id = {e["id"]: e for e in records}
    billed = sum(e["amount_minor_or_count"] for e in records
                 if e.get("ledger_bucket") == "BILLED" and e.get("amount_minor_or_count") is not None and e.get("amount_minor_or_count") >= 0)
    earned = sum(e["amount_minor_or_count"] for e in records
                 if e.get("ledger_bucket") == "EARNED" and e.get("amount_minor_or_count") is not None and e.get("amount_minor_or_count") >= 0)
    collected = sum(e["amount_minor_or_count"] for e in records
                    if e.get("ledger_bucket") == "COLLECTED" and e.get("amount_minor_or_count") is not None and e.get("amount_minor_or_count") >= 0)

    # Compute arithmetic difference across linked parent-child chains first
    settled_by_parent: dict[str, int] = {}
    for e in records:
        if e.get("ledger_bucket") == "COLLECTED" and e.get("amount_minor_or_count") is not None and e.get("parent_evidence_id"):
            pid = e["parent_evidence_id"]
            if pid in by_id and by_id[pid].get("amount_minor_or_count") is not None:
                settled_by_parent[pid] = settled_by_parent.get(pid, 0) + e["amount_minor_or_count"]

    has_billed = any(e.get("ledger_bucket")=="BILLED" and e.get("amount_minor_or_count") is not None for e in records)
    has_earned = any(e.get("ledger_bucket")=="EARNED" and e.get("amount_minor_or_count") is not None for e in records)
    has_collected = any(e.get("ledger_bucket")=="COLLECTED" and e.get("amount_minor_or_count") is not None for e in records)

    if settled_by_parent:
        diff = sum((by_id[pid]["amount_minor_or_count"] - settled_amt)
                   for pid, settled_amt in settled_by_parent.items())
    else:
        base = billed if has_billed else (earned if has_earned else None)
        diff = (base - collected) if (base is not None and has_collected) else None

    lois = sum(
        1
        for e in records
        if e.get("ledger_bucket") == "COMMERCIAL_INTENT" and is_loi_source(e.get("source_type"))
    )
    return {
        "billed": billed if has_billed else None,
        "earned": earned if has_earned else None,
        "collected": collected if has_collected else None,
        "diff": diff,
        "lois": lois,
    }


def _earned_period_label(records: list[dict]) -> str:
    periods = sorted({
        str(e.get("earned_period")).strip()
        for e in _active_evidence(records)
        if e.get("ledger_bucket") in ("EARNED", "COLLECTED")
        and isinstance(e.get("earned_period"), str)
        and e.get("earned_period").strip()
    })
    return "; ".join(periods) if periods else "Unknown"


def _completed_pilot_count(records: list[dict]) -> int | None:
    qualified = [
        e for e in _active_evidence(records)
        if e.get("evidence_status") == "APPROVED"
        and is_completed_pilot_source(e.get("source_type"))
    ]
    if not qualified:
        return None
    return len({e.get("counterparty") or e["id"] for e in qualified})


def build_ledgers(state: dict) -> list[dict]:
    out = []
    for v in state["ventures"]:
        for l in [x for x in state["lines"] if x["venture_id"] == v["id"]]:
            line_ev = [e for e in state["evidence"]
                       if e.get("venture_id") == v["id"] and e.get("business_line_id") == l["id"]]
            approved = [e for e in line_ev if e.get("evidence_status") == "APPROVED"]
            claimed_pool = [e for e in line_ev if e.get("evidence_status") in ("UNREVIEWED", "APPROVED")]

            ver = _compute_side_totals(approved)
            clm = _compute_side_totals(claimed_pool)
            has_earned = clm["earned"] is not None or ver["earned"] is not None
            diff_note = (
                "Not a verified receivable" if has_earned
                else "Not a verified outstanding balance"
            )
            baseline_line_id = v.get("historical_traction_business_line_id")
            baseline_amount = (
                v.get("historical_traction_amount_paise")
                if baseline_line_id == l["id"]
                else None
            )
            out.append({
                "venture_id": v["id"],
                "business_line_id": l["id"],
                # Verified projection (APPROVED evidence only; None stays Unknown, never 0)
                "billed_paise": ver["billed"],
                "billed_display": format_inr(ver["billed"]) if ver["billed"] is not None else None,
                "earned_paise": ver["earned"],
                "earned_display": format_inr(ver["earned"]) if ver["earned"] is not None else None,
                "collected_paise": ver["collected"],
                "collected_display": format_inr(ver["collected"]) if ver["collected"] is not None else None,
                "arithmetic_difference_paise": ver["diff"],
                "arithmetic_difference_display": format_inr(ver["diff"]) if ver["diff"] is not None else None,
                "verified_balance_note": diff_note,
                "signed_lois": ver["lois"],
                "earned_period": _earned_period_label(approved),
                "completed_pilots": _completed_pilot_count(approved),
                # Claimed projection (submitted evidence awaiting review + approved)
                "claimed_billed_paise": clm["billed"],
                "claimed_billed_display": format_inr(clm["billed"]) if clm["billed"] is not None else None,
                "claimed_earned_paise": clm["earned"],
                "claimed_earned_display": format_inr(clm["earned"]) if clm["earned"] is not None else None,
                "claimed_collected_paise": clm["collected"],
                "claimed_collected_display": format_inr(clm["collected"]) if clm["collected"] is not None else None,
                "claimed_arithmetic_difference_paise": clm["diff"],
                "claimed_arithmetic_difference_display": format_inr(clm["diff"]) if clm["diff"] is not None else None,
                "claimed_signed_lois": clm["lois"],
                "claimed_earned_period": _earned_period_label(claimed_pool),
                # Isolated historical baseline, scoped to its business line
                "historical_baseline_paise": baseline_amount,
                "historical_baseline_display": format_inr(baseline_amount),
                "historical_note": "Isolated baseline; never summed with granular evidence",
            })
    return out


def build_staff_queue(state: dict, evaluated: list[dict]) -> dict:
    unreviewed = [{"id": e["id"], "venture_id": e["venture_id"], "source_type": e.get("source_type"),
                   "detail": e.get("detail_note")}
                  for e in state["evidence"] if e.get("evidence_status") == "UNREVIEWED"]
    changes = [{"id": e["id"], "venture_id": e["venture_id"], "reviewer": e.get("reviewer"),
                "reason": e.get("review_reason")}
               for e in state["evidence"] if e.get("evidence_status") == "CHANGES_REQUESTED"]
    clarifs = [{"venture_id": v["id"], "reason": "Model UNRESOLVED; owner clarification pending"}
               for v in state["ventures"] if v.get("model_resolution_status") == "UNRESOLVED"]
    clarifs += [{"criterion_id": c["id"], "reason": "Configurable rule BLOCKED; owner configuration pending"}
                for c in state["catalog"] if _rule_blocked(c)]
    followups = [{"venture_id": v["id"], "note": v.get("follow_up_note") or "Mentor/participant follow-up pending"}
                 for v in state["ventures"] if v.get("follow_up_note") or v.get("mentor_status")]
    pending = changes + [{"venture_id": v["id"], "note": "MSL handover Unknown for MSL-eligible venture"}
                         for v in state["ventures"]
                         if v.get("msl_eligibility") == "Eligible for MSL"
                         and v.get("msl_handover_status") == "Unknown"]
    catalog = {c["id"]: c for c in state["catalog"]}
    lines = {l["id"]: l for l in state["lines"]}
    unresolved = []
    for item in evaluated:
        if item.get("latest_evidence_status") != "APPROVED":
            continue
        if item.get("criterion_result") not in ("UNKNOWN", "IN_PROGRESS", "NOT_MET"):
            continue
        criterion = catalog.get(item["criterion_id"], {})
        line = lines.get(item.get("business_line_id"))
        unresolved.append({
            "venture_id": item["venture_id"],
            "business_line_id": item.get("business_line_id"),
            "line_name": line.get("line_name") if line else None,
            "criterion_id": item["criterion_id"],
            "criterion_name": criterion.get("name"),
            "criterion_result": item["criterion_result"],
            "detail": item.get("detail"),
            "evidence_ids": item.get("related_evidence_ids", []),
        })
    unresolved.sort(key=lambda row: (row["venture_id"], row["criterion_id"], row["business_line_id"] or ""))
    return {"unreviewed_evidence": unreviewed, "owner_clarifications": clarifs,
            "mentor_followups": followups, "pending_actions": pending,
            "unresolved_criteria": unresolved}


def required_msl_criteria(state: dict, venture: dict) -> list[dict]:
    out = [c for c in state["catalog"] if c.get("transition_gate") == MSL_COMMON_GATE]
    if venture.get("model_resolution_status") == "CONFIRMED":
        out += [c for c in state["catalog"]
                if c.get("transition_gate") == MSL_MODEL_SPECIFIC_GATE
                and c.get("business_model") == venture.get("primary_business_model")]
    else:
        out += [c for c in state["catalog"]
                if c.get("transition_gate") == MSL_MODEL_SPECIFIC_GATE]
    return out
