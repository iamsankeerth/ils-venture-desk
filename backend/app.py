"""FastAPI contract for ILS Venture Progress & Readiness.

Demo-only auth seam: all simulated role checks read the ``X-ILS-Role`` header.
This is explicitly NOT production authentication.
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from backend.db import connect, export_all, import_all, init_schema, load_seed_file, seed_from_dict
from backend.evaluation import evaluate_all, load_state, required_msl_criteria
from backend.rules import (
    EVIDENCE_TYPE_POLICY,
    MSL_COMMON_COUNT,
    MSL_COMMON_GATE,
    MSL_COMMON_IDS,
    MSL_MODEL_SPECIFIC_COUNTS,
    MSL_MODEL_SPECIFIC_GATE,
    MSL_MODEL_SPECIFIC_IDS,
    REQUIRED_QUALIFIERS,
    VALID_MODELS as RULE_VALID_MODELS,
    configuration_error,
    evidence_type_error,
    line_models,
    required_qualifiers,
)

OWNER = "PROGRAMME_OWNER"
REVIEWER = "PROGRAMME_REVIEWER"
STUDENT = "STUDENT_FOUNDER"
MENTOR = "MENTOR"

LEVELS = ["Level 0", "Level 1", "Level 2"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_path() -> Path:
    return Path(os.environ.get("ILS_DB", str(Path(__file__).resolve().parent / "ils.db")))


def seed_path() -> Path:
    return Path(os.environ.get("ILS_SEED", str(Path(__file__).resolve().parent / "seed_data.json")))


def get_con() -> sqlite3.Connection:
    p = db_path()
    fresh = not p.exists()
    con = connect(p)
    init_schema(con)
    if fresh and seed_path().exists():
        seed_from_dict(con, load_seed_file(seed_path()))
    return con


def need_role(role: str | None, allowed: list[str]) -> str:
    r = (role or "").strip()
    if r not in allowed:
        raise HTTPException(status_code=403, detail=f"Role '{r or 'missing'}' not permitted (demo seam X-ILS-Role)")
    return r


app = FastAPI(title="ILS Venture Progress & Readiness")


@app.middleware("http")
async def disable_ui_cache(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@app.get("/api/state")
def api_state():
    con = get_con()
    try:
        state = load_state(con)
        ev = evaluate_all(con)
        return {
            "ventures": state["ventures"],
            "venture_business_lines": state["lines"],
            "criteria_catalog": state["catalog"],
            "progress_updates": state["updates"],
            "evidence_records": state["evidence"],
            "evidence": state["evidence"],
            "evidence_observations": state["observations"],
            "observations": state["observations"],
            "evidence_review_history": state["history"],
            "history": state["history"],
            "transition_decisions": state["transitions"],
            "transitions": state["transitions"],
            "msl_eligibility_decisions": state["msl"],
            "msl": state["msl"],
            "qualifier_options": {
                criterion_id: sorted(options)
                for criterion_id, options in REQUIRED_QUALIFIERS.items()
            },
            "evidence_type_policy": {
                source_type: {
                    "buckets": sorted(policy["buckets"]),
                    "units": sorted(policy["units"], key=lambda value: value or ""),
                    "allow_amount": policy["allow_amount"],
                    "amount_required": policy["amount_required"],
                    "loi": policy["loi"],
                    "completed_pilot": policy["completed_pilot"],
                }
                for source_type, policy in EVIDENCE_TYPE_POLICY.items()
            },
            **ev,
        }
    finally:
        con.close()


VALID_MODELS = set(RULE_VALID_MODELS)


def _validate_venture_import(body: dict[str, Any]) -> tuple[str, str, str | None, list[dict[str, Any]]]:
    raw_name = (body.get("name") or "").strip()
    if not raw_name or raw_name.lower() == "untitled venture":
        raise HTTPException(status_code=422, detail="Venture name is required and cannot be blank or Untitled Venture.")

    if "activity" in body and (body.get("activity") is None or not str(body.get("activity")).strip()):
        raise HTTPException(status_code=422, detail="Venture activity cannot be blank.")

    source_type = (body.get("source_type") or body.get("programme_level_provenance") or "").strip()
    activity_str = (body.get("activity") or "").strip()
    if not activity_str and not source_type:
        raise HTTPException(status_code=422, detail="Activity and provenance/source_type are required to import a venture.")

    res_status = (body.get("model_resolution_status") or "UNRESOLVED").strip().upper()
    if res_status not in ("UNRESOLVED", "CONFIRMED"):
        raise HTTPException(status_code=422, detail="model_resolution_status must be UNRESOLVED or CONFIRMED.")

    primary_model = (body.get("primary_business_model") or "").strip() or None
    if primary_model is not None and primary_model not in VALID_MODELS:
        raise HTTPException(status_code=422, detail=f"Invalid primary_business_model '{primary_model}'.")

    raw_lines = body.get("business_lines") or []
    if not isinstance(raw_lines, list):
        raise HTTPException(status_code=422, detail="business_lines must be a list.")

    normalized_lines: list[dict[str, Any]] = []
    for idx, bl in enumerate(raw_lines):
        if not isinstance(bl, dict):
            raise HTTPException(status_code=422, detail=f"Business line {idx + 1} must be an object.")
        lname = (bl.get("line_name") or bl.get("name") or "").strip()
        if not lname:
            raise HTTPException(status_code=422, detail=f"Business line {idx + 1} name is required.")
        cand = bl.get("candidate_models_json") or bl.get("candidate_models") or []
        if isinstance(cand, str):
            try:
                cand = json.loads(cand)
            except ValueError:
                cand = [cand] if cand.strip() else []
        app_model = (bl.get("approved_model") or bl.get("model") or "").strip() or None
        if not cand and app_model:
            cand = [app_model]
        if not cand and not app_model:
            raise HTTPException(status_code=422, detail=f"Business line '{lname}' requires a business model.")
        for m in cand:
            if m not in VALID_MODELS:
                raise HTTPException(status_code=422, detail=f"Invalid model '{m}' on business line '{lname}'.")
        if app_model and app_model not in VALID_MODELS:
            raise HTTPException(status_code=422, detail=f"Invalid approved_model '{app_model}' on business line '{lname}'.")

        default_role = "ACTIVE_GOVERNING" if res_status == "CONFIRMED" else "ASSIGNED_IN_TRACKER"
        t_role = (bl.get("track_role") or default_role).strip().upper()
        normalized_lines.append({
            "id": bl.get("id") or f"bl-{uuid.uuid4().hex[:8]}",
            "line_name": lname,
            "track_role": t_role,
            "candidate_models": cand,
            "approved_model": app_model if res_status == "CONFIRMED" and t_role == "ACTIVE_GOVERNING" else (bl.get("approved_model") or None),
            "resolution_status": bl.get("resolution_status") or (
                "CONFIRMED" if res_status == "CONFIRMED" and t_role == "ACTIVE_GOVERNING" else t_role
            ),
            "clarification_provenance": bl.get("clarification_provenance"),
        })

    active_gov_lines = [l for l in normalized_lines if l["track_role"] == "ACTIVE_GOVERNING"]

    if res_status == "UNRESOLVED":
        if primary_model is not None:
            raise HTTPException(
                status_code=422,
                detail="When model_resolution_status is UNRESOLVED, primary_business_model must be null.",
            )
        if active_gov_lines:
            raise HTTPException(
                status_code=422,
                detail="When model_resolution_status is UNRESOLVED, no business line may be ACTIVE_GOVERNING.",
            )
    else:  # CONFIRMED
        if primary_model is None:
            raise HTTPException(
                status_code=422,
                detail="When model_resolution_status is CONFIRMED, primary_business_model is required.",
            )
        if len(active_gov_lines) != 1:
            raise HTTPException(
                status_code=422,
                detail=f"When model_resolution_status is CONFIRMED, exactly one business line must be ACTIVE_GOVERNING (found {len(active_gov_lines)}).",
            )
        gov_line = active_gov_lines[0]
        gov_model = gov_line.get("approved_model") or (gov_line["candidate_models"][0] if gov_line["candidate_models"] else None)
        if gov_model != primary_model:
            raise HTTPException(
                status_code=422,
                detail=f"Governing business line model '{gov_model}' must match primary_business_model '{primary_model}'.",
            )
        gov_line["approved_model"] = primary_model

    return raw_name, res_status, primary_model, normalized_lines


@app.post("/api/ventures", status_code=201)
def api_create_venture(body: dict[str, Any], x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [OWNER, REVIEWER])
    raw_name, res_status, primary_model, normalized_lines = _validate_venture_import(body)
    con = get_con()
    try:
        vid = (body.get("id") or "").strip() or f"v-{uuid.uuid4().hex[:8]}"
        level = (body.get("programme_level") or "Unknown").strip()
        if level not in (*LEVELS, "Unknown"):
            raise HTTPException(status_code=422, detail=f"Invalid programme_level '{level}'")
        provenance = (body.get("programme_level_provenance") or body.get("source_type") or "Manual entry").strip()
        row = {
            "id": vid,
            "name": raw_name,
            "activity": (body.get("activity") or "").strip() or None,
            "tracker_sector": (body.get("tracker_sector") or "").strip() or "Unknown",
            "primary_business_model": primary_model,
            "model_resolution_status": res_status,
            "model_clarification_note": body.get("model_clarification_note"),
            "recorded_update": body.get("recorded_update"),
            "development_stage": (body.get("development_stage") or "").strip() or "Unknown",
            "programme_level": (body.get("programme_level") or "").strip() or "Unknown",
            "programme_level_provenance": provenance,
            "msl_eligibility": (body.get("msl_eligibility") or "").strip() or "Unknown",
            "msl_eligibility_provenance": body.get("msl_eligibility_provenance"),
            "advancement_status": (
                body.get("advancement_status").strip()
                if isinstance(body.get("advancement_status"), str) and body.get("advancement_status").strip()
                else "Unknown"
            ),
            "fundraising_preference": (body.get("fundraising_preference") or "").strip() or "Unknown",
            "msl_handover_status": body.get("msl_handover_status", "Unknown"),
            "msl_acceptance_status": body.get("msl_acceptance_status", "Unknown"),
            "historical_traction_text": body.get("historical_traction_text"),
            "historical_traction_amount_paise": body.get("historical_traction_amount_paise"),
            "historical_traction_period": body.get("historical_traction_period", "Unknown"),
            "historical_traction_note": body.get("historical_traction_note"),
            "historical_traction_business_line_id": body.get("historical_traction_business_line_id"),
            "mentor_goal": body.get("mentor_goal"),
            "mentor_status": body.get("mentor_status"),
            "next_update_date": body.get("next_update_date"),
            "follow_up_note": body.get("follow_up_note"),
        }
        cols = list(row.keys())
        try:
            con.execute(
                f"INSERT INTO ventures ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
                [row[c] for c in cols],
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=400, detail=f"Venture exists: {exc}")
        for bl in normalized_lines:
            con.execute(
                "INSERT INTO venture_business_lines (id, venture_id, line_name, track_role,"
                " candidate_models_json, approved_model, resolution_status, clarification_provenance)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (bl["id"], vid, bl["line_name"], bl["track_role"],
                 json.dumps(bl["candidate_models"]), bl["approved_model"], bl["resolution_status"],
                 bl["clarification_provenance"]),
            )
        con.commit()
        return {"id": vid, **row}
    finally:
        con.close()


def _nonblank(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _require_owned(con: sqlite3.Connection, table: str, identifier: str, venture_id: str,
                   field: str) -> dict:
    obj = con.execute(f"SELECT * FROM {table} WHERE id=?", (identifier,)).fetchone()
    if not obj or obj["venture_id"] != venture_id:
        raise HTTPException(status_code=422, detail=f"{field} must belong to the selected venture")
    return dict(obj)


def _line_model_error(label: str, model: str | None, line: dict) -> str:
    allowed = ", ".join(line_models(line)) or "none"
    return (
        f"{label} model {model or 'none'} is not compatible with business line "
        f"{line.get('id')} (supports {allowed})"
    )


def _catalog_identity_blockers(label: str, expected, actual) -> list[str]:
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    if not missing and not unexpected:
        return []
    return [
        f"{label} missing: {', '.join(missing) or 'none'}",
        f"{label} unexpected: {', '.join(unexpected) or 'none'}",
    ]



def _validate_update(con: sqlite3.Connection, body: dict[str, Any]) -> tuple[str, dict, list, Any, str]:
    vid = body.get("venture_id")
    if not _nonblank(vid) or not con.execute("SELECT 1 FROM ventures WHERE id=?", (vid,)).fetchone():
        raise HTTPException(status_code=400, detail="Unknown venture_id")
    line_id, crit_id = body.get("business_line_id"), body.get("criterion_id")
    line = None
    if line_id:
        line = _require_owned(con, "venture_business_lines", line_id, vid, "business_line_id")
    crit = None
    if crit_id:
        crit = con.execute("SELECT * FROM criteria_catalog WHERE id=?", (crit_id,)).fetchone()
        if crit is None:
            raise HTTPException(status_code=422, detail="Unknown criterion_id")
        if crit["criterion_scope"] == "VENTURE" and line_id is not None:
            raise HTTPException(status_code=422, detail="Venture-wide criterion cannot belong to a business line")
        if crit["criterion_scope"] == "BUSINESS_LINE" and not line_id:
            raise HTTPException(status_code=422, detail="Business-line criterion needs a business line")
        if line is not None and crit["business_model"] != "ALL" and crit["business_model"] not in line_models(line):
            raise HTTPException(status_code=422, detail=_line_model_error(crit_id, crit["business_model"], line))
    if not _nonblank(body.get("next_action")):
        raise HTTPException(status_code=422, detail="A next action is required")
    if not _nonblank(body.get("blocker")):
        raise HTTPException(status_code=422, detail="Record a blocker or explicitly state 'No blocker'")
    observations = body.get("observations", [])
    if not isinstance(observations, list) or any(not isinstance(o, dict) for o in observations):
        raise HTTPException(status_code=422, detail="observations must be an array")
    claimed = body.get("claimed_metrics_json", body.get("claimed_metrics"))
    if isinstance(claimed, str):
        try:
            claimed = json.loads(claimed)
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="claimed_metrics_json must be valid JSON")
    if claimed is not None and not isinstance(claimed, (dict, list)):
        raise HTTPException(status_code=422, detail="claimed_metrics_json must be a JSON object or array")
    ev = body.get("evidence")
    existing = body.get("evidence_id") or (ev or {}).get("id") if isinstance(ev,dict) else body.get("evidence_id")
    if not isinstance(ev,(dict,type(None))):
        raise HTTPException(status_code=422, detail="evidence must be an object")
    existing_record = None
    if existing:
        found=con.execute("SELECT * FROM evidence_records WHERE id=?", (existing,)).fetchone()
        if found:
            existing_record = found
            _require_owned(con,"evidence_records",existing,vid,"evidence_id")
            # An already reviewed document is immutable: new metrics need a new
            # UNREVIEWED evidence record, not a fresh observation on approved proof.
            if observations and found["evidence_status"] != "UNREVIEWED":
                raise HTTPException(status_code=422, detail="Cannot attach new observations to reviewed evidence; submit a new evidence record for review")
            if found["business_line_id"] != line_id:
                raise HTTPException(status_code=422, detail="Referenced evidence must match the update's exact business line or venture-wide scope")
        elif not ev or not _nonblank(ev.get("source_type")):
            raise HTTPException(status_code=422, detail="New evidence requires source_type")
    elif not ev or not _nonblank(ev.get("source_type")):
        raise HTTPException(status_code=422, detail="An existing evidence reference or a source_type is required")
    if ev and existing_record is None:
        policy_error = evidence_type_error(
            ev.get("source_type"),
            ev.get("ledger_bucket"),
            ev.get("unit"),
            ev.get("amount_minor_or_count"),
        )
        if policy_error:
            raise HTTPException(status_code=422, detail=policy_error)
    if ev:
        amount=ev.get("amount_minor_or_count")
        if amount is not None and (isinstance(amount,bool) or not isinstance(amount,int) or amount<0):
            raise HTTPException(status_code=422, detail="Monetary amounts and counts must be nonnegative integers")
        parent=ev.get("parent_evidence_id")
        if parent:
            _require_owned(con,"evidence_records",parent,vid,"parent_evidence_id")
        supersedes=ev.get("supersedes_evidence_id")
        if supersedes:
            _require_owned(con,"evidence_records",supersedes,vid,"supersedes_evidence_id")
    if not (observations or (ev and ev.get("amount_minor_or_count") is not None)):
        raise HTTPException(status_code=422, detail="Update must include a measurement or monetary evidence")
    if not (claimed or observations or (ev and ev.get("amount_minor_or_count") is not None)):
        raise HTTPException(status_code=422, detail="Update is missing a submitted claim")
    periods=[]
    for o in observations:
        ocid=o.get("criterion_id",crit_id)
        oc=con.execute("SELECT * FROM criteria_catalog WHERE id=?",(ocid,)).fetchone() if ocid else None
        if oc is None:
            raise HTTPException(status_code=422, detail="Every observation must use an existing criterion_id")
        scope=oc["criterion_scope"]
        lid=o.get("business_line_id",line_id)
        if scope=="VENTURE" and lid:
            raise HTTPException(status_code=422, detail="Venture-wide observation must not have business_line_id")
        if scope=="BUSINESS_LINE" and not lid:
            raise HTTPException(status_code=422, detail="Business-line observation requires business_line_id")
        obs_line = None
        if lid:
            obs_line = _require_owned(con,"venture_business_lines",lid,vid,"observation business_line_id")
            if oc["business_model"] != "ALL" and oc["business_model"] not in line_models(obs_line):
                raise HTTPException(
                    status_code=422,
                    detail=_line_model_error(ocid, oc["business_model"], obs_line),
                )
        if o.get("unit") and oc["unit"] and o["unit"] != oc["unit"]:
            raise HTTPException(
                status_code=422,
                detail=f"Observation unit must match criterion unit {oc['unit']}",
            )
        qualifiers = required_qualifiers(ocid)
        if qualifiers and (o.get("qualifier_status") or "") not in qualifiers:
            allowed = ", ".join(sorted(qualifiers))
            raise HTTPException(
                status_code=422,
                detail=f"{ocid} requires a qualifying status: {allowed}",
            )
        num=o.get("numeric_value")
        if num is not None and (isinstance(num,bool) or not isinstance(num,int) or num<0):
            raise HTTPException(status_code=422, detail="numeric_value must be a nonnegative integer")
        sup=o.get("supersedes_observation_id")
        if sup:
            old=con.execute("SELECT * FROM evidence_observations WHERE id=?",(sup,)).fetchone()
            if not old or old["venture_id"]!=vid or old["criterion_id"]!=ocid or old["business_line_id"]!=lid:
                raise HTTPException(status_code=422, detail="Corrected observation must match existing venture/criterion/line")
            if o.get("period_label") and old["period_label"] != o["period_label"]:
                raise HTTPException(status_code=422, detail="Correction cannot change its original reporting period")
        if o.get("period_label"):
            periods.append(o["period_label"])
    period=body.get("summary_period") or (ev or {}).get("period_label") or (periods[0] if periods else None)
    if not _nonblank(period):
        raise HTTPException(status_code=422, detail="Reporting period is required")
    if not (body.get("summary_metric") or observations or (ev and ev.get("amount_minor_or_count") is not None)):
        raise HTTPException(status_code=422, detail="Metric or amount is required")
    return vid, ev or {}, observations, claimed, period


@app.post("/api/updates", status_code=201)
def api_submit_update(body: dict[str, Any], x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [OWNER, REVIEWER, STUDENT, MENTOR])
    con = get_con()
    try:
        venture_id, ev_spec, observations, claimed, period = _validate_update(con, body)
        update_id = body.get("id") or f"u-{uuid.uuid4().hex[:8]}"
        evidence_id = body.get("evidence_id") or ev_spec.get("id") or f"E-{uuid.uuid4().hex[:8]}"
        try:
            if not con.execute("SELECT 1 FROM evidence_records WHERE id=?", (evidence_id,)).fetchone():
                con.execute(
                    "INSERT INTO evidence_records (id, venture_id, business_line_id, criterion_id, source_type,"
                    " ledger_bucket, amount_minor_or_count, unit, display_amount, period_label, earned_period,"
                    " payment_date, counterparty, detail_note, parent_evidence_id, supersedes_evidence_id,"
                    " historical_total_relation, evidence_status, reviewer, reviewed_at, review_reason)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (evidence_id, venture_id, body.get("business_line_id"), body.get("criterion_id"),
                     ev_spec.get("source_type"), ev_spec.get("ledger_bucket"), ev_spec.get("amount_minor_or_count"),
                     ev_spec.get("unit"), ev_spec.get("display_amount"), ev_spec.get("period_label") or period,
                     ev_spec.get("earned_period"), ev_spec.get("payment_date"), ev_spec.get("counterparty"),
                     ev_spec.get("detail_note"), ev_spec.get("parent_evidence_id"),
                     ev_spec.get("supersedes_evidence_id"), ev_spec.get("historical_total_relation", "ISOLATED"),
                     "UNREVIEWED", None, None, None),
                )
            con.execute(
                "INSERT INTO progress_updates (id, venture_id, business_line_id, criterion_id, summary_metric,"
                " summary_period, claimed_metrics_json, evidence_id, blocker, next_action, submitted_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (update_id, venture_id, body.get("business_line_id"), body.get("criterion_id"),
                 body.get("summary_metric") or "Reported evidence", period,
                 json.dumps(claimed) if claimed is not None else None, evidence_id,
                 body.get("blocker"), body.get("next_action"), now_iso()),
            )
            created_obs=[]
            for i,o in enumerate(observations):
                oid=o.get("id") or f"{evidence_id}-O{i+1}"
                qv=o.get("qualitative_value_json")
                con.execute(
                    "INSERT INTO evidence_observations (id, evidence_id, venture_id, business_line_id, criterion_id,"
                    " metric_type, period_label, period_sequence, entity_key, cohort_key, numeric_value,"
                    " qualitative_value_json, unit, qualifier_status, supersedes_observation_id)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (oid,evidence_id,venture_id,o.get("business_line_id",body.get("business_line_id")),
                     o.get("criterion_id",body.get("criterion_id")),o.get("metric_type"),
                     o.get("period_label"),o.get("period_sequence",i+1),o.get("entity_key"),
                     o.get("cohort_key"),o.get("numeric_value"),
                     json.dumps(qv) if isinstance(qv,(dict,list)) else qv,
                     o.get("unit"),o.get("qualifier_status"),o.get("supersedes_observation_id")),
                )
                created_obs.append(oid)
            con.commit()
            return {"id":update_id,"evidence_id":evidence_id,"observations":created_obs}
        except sqlite3.IntegrityError as exc:
            con.rollback()
            raise HTTPException(status_code=422,detail=f"Conflicting or invalid update ID/reference: {exc}")
    finally:
        con.close()


@app.post("/api/evidence/{evidence_id}/review")
def api_review_evidence(evidence_id: str, body: dict[str, Any],
                        x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [REVIEWER])
    decision = (body.get("decision") or "").upper()
    if decision not in ("APPROVED", "CHANGES_REQUESTED"):
        raise HTTPException(status_code=400, detail="decision must be APPROVED or CHANGES_REQUESTED")
    reviewer = body.get("reviewer")
    reason = body.get("reason")
    if not _nonblank(reviewer) or not _nonblank(reason):
        raise HTTPException(status_code=422, detail="Reviewer identity and review reason must be nonblank")
    con = get_con()
    try:
        row = con.execute("SELECT * FROM evidence_records WHERE id=?", (evidence_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Evidence not found")
        ts = now_iso()
        con.execute(
            "UPDATE evidence_records SET evidence_status=?, reviewer=?, reviewed_at=?, review_reason=? WHERE id=?",
            (decision, reviewer, ts, reason, evidence_id),
        )
        con.execute(
            "INSERT INTO evidence_review_history (id, evidence_id, decision, reviewer, reviewed_at, reason)"
            " VALUES (?,?,?,?,?,?)",
            (f"h-{uuid.uuid4().hex[:8]}", evidence_id, decision, reviewer, ts, reason),
        )
        con.commit()
        return {"id": evidence_id, "evidence_status": decision, "reviewer": reviewer,
                "reviewed_at": ts, "supersession_activated": decision == "APPROVED"}
    finally:
        con.close()


def _required_gate_evals(con: sqlite3.Connection, venture_id: str, from_level: str) -> tuple[list[dict], list[str]]:
    state = load_state(con)
    v = next((x for x in state["ventures"] if x["id"] == venture_id), None)
    if not v:
        raise HTTPException(status_code=404, detail="Venture not found")
    if v.get("model_resolution_status") != "CONFIRMED" or v.get("primary_business_model") not in VALID_MODELS:
        return [], ["Governing model must be confirmed"]
    governing=[l for l in state["lines"] if l["venture_id"]==venture_id
               and l.get("track_role")=="ACTIVE_GOVERNING"
               and l.get("approved_model")==v["primary_business_model"]]
    if len(governing)!=1:
        return [], ["Exactly one confirmed governing business line is required"]
    gate={"Level 0":"L0_TO_L1_DEMAND_BAR", "Level 1":"L1_TO_L2_TRACTION_TARGET"}.get(from_level)
    if not gate:
        return [], ["Standard advancement only from Level 0 or Level 1"]
    req_catalog=[c for c in state["catalog"] if c["transition_gate"]==gate and c["business_model"]==v["primary_business_model"]]
    if from_level=="Level 0":
        req_catalog += [c for c in state["catalog"] if c["transition_gate"]=="L0_QUALITATIVE_CHECKLIST"]
    expected_n={"Level 0":{"Consumer":8,"Services":8,"AI_B2C":7,"AI_B2B":8},
                "Level 1":{"Consumer":2,"Services":2,"AI_B2C":2,"AI_B2B":2}}[from_level][v["primary_business_model"]]
    if len(req_catalog)!=expected_n:
        return [], [f"Incomplete criteria catalogue: expected {expected_n}, found {len(req_catalog)}"]
    calculated=evaluate_all(con)["evaluated_criteria"]
    by_key={(e["venture_id"],e["business_line_id"],e["criterion_id"]):e for e in calculated}
    required=[]
    for c in req_catalog:
        line=None if c["criterion_scope"]=="VENTURE" else governing[0]["id"]
        required.append(by_key.get((venture_id,line,c["id"])) or
                        {"criterion_id":c["id"],"criterion_result":"UNKNOWN","detail":"Required criterion missing"})
    blocking=[f"{e['criterion_id']}={e['criterion_result']}" for e in required if e["criterion_result"]!="MET"]
    return required,blocking


@app.post("/api/ventures/{venture_id}/transitions")
def api_transition(venture_id: str, body: dict[str, Any],
                   x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [REVIEWER])
    to_level = body.get("to_level")
    ttype = body.get("transition_type")
    if to_level not in LEVELS:
        raise HTTPException(status_code=400, detail=f"to_level must be one of {LEVELS}")
    if ttype not in ("STANDARD_ADVANCEMENT", "DIRECT_ENTRY"):
        raise HTTPException(status_code=400, detail="transition_type must be STANDARD_ADVANCEMENT or DIRECT_ENTRY")
    con = get_con()
    try:
        v = con.execute("SELECT * FROM ventures WHERE id=?", (venture_id,)).fetchone()
        if not v:
            raise HTTPException(status_code=404, detail="Venture not found")
        from_level = v["programme_level"]
        approved_by = body.get("approved_by", "Demo Programme Reviewer")
        if not _nonblank(approved_by) or not _nonblank(body.get("reason")):
            raise HTTPException(status_code=422, detail="Approval requires reviewer and nonblank justification")
        if ttype == "DIRECT_ENTRY" and to_level not in ("Level 1", "Level 2"):
            raise HTTPException(status_code=422, detail="Direct entry only supports Level 1 or Level 2")
        order = {l: i for i, l in enumerate(LEVELS)}
        if ttype == "DIRECT_ENTRY" and from_level in order and order[to_level] < order[from_level]:
            raise HTTPException(status_code=400, detail={
                "error": "Downward direct entry not allowed",
                "blocking_reasons": [
                    f"current level {from_level} is above direct-entry target {to_level}"
                ],
            })
        ts = now_iso()
        if ttype == "STANDARD_ADVANCEMENT":
            if from_level not in order or order.get(to_level, -99) - order.get(from_level, -99) != 1:
                raise HTTPException(status_code=400, detail={
                    "error": "Non-sequential STANDARD_ADVANCEMENT",
                    "blocking_reasons": [f"from={from_level} to={to_level} is not a single sequential step"]})
            required, blocking = _required_gate_evals(con, venture_id, from_level)
            if blocking:
                raise HTTPException(status_code=400, detail={
                    "error": "Gate criteria unmet", "blocking_reasons": blocking})
            snapshot = {e["criterion_id"]: e["criterion_result"] for e in required}
        else:
            ev = evaluate_all(con)
            snapshot = {e["criterion_id"]: e["criterion_result"] for e in ev["evaluated_criteria"]
                        if e["venture_id"] == venture_id}
        tid = f"t-{uuid.uuid4().hex[:8]}"
        con.execute(
            "INSERT INTO transition_decisions (id, venture_id, from_level, to_level, transition_type,"
            " approved_by, approved_at, reason, provenance_note, criteria_snapshot_json)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            (tid, venture_id, from_level, to_level, ttype, approved_by, ts,
             body.get("reason"), body.get("provenance_note"), json.dumps(snapshot)),
        )
        raw_provenance = body.get("provenance_note")
        note = raw_provenance.strip() if isinstance(raw_provenance, str) else ""
        provenance = note or (
            f"Reviewer-approved {ttype.replace('_', ' ').lower()} to {to_level}"
        )
        con.execute(
            "UPDATE ventures SET programme_level=?, advancement_status=?,"
            " programme_level_provenance=? WHERE id=?",
            (to_level, f"{ttype} to {to_level} by {approved_by}", provenance, venture_id),
        )
        con.commit()
        return {"id": tid, "from_level": from_level, "to_level": to_level,
                "transition_type": ttype, "approved_by": approved_by,
                "approved_at": ts, "criteria_snapshot_json": snapshot}
    finally:
        con.close()


@app.post("/api/ventures/{venture_id}/msl-eligibility")
def api_msl_eligibility(venture_id: str, body: dict[str, Any],
                        x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [REVIEWER])
    con = get_con()
    try:
        state = load_state(con)
        v = next((x for x in state["ventures"] if x["id"] == venture_id), None)
        if not v:
            raise HTTPException(status_code=404, detail="Venture not found")
        if v.get("model_resolution_status") != "CONFIRMED":
            raise HTTPException(status_code=400, detail={
                "error": "Model unresolved", "blocking_reasons": ["model_resolution_status != CONFIRMED"]})
        primary = v.get("primary_business_model")
        if primary not in VALID_MODELS:
            raise HTTPException(status_code=400, detail={
                "error": "Primary business model invalid",
                "blocking_reasons": [f"primary_business_model={primary or 'none'}"],
            })
        lines = [l for l in state["lines"] if l["venture_id"] == venture_id]
        governing = [line for line in lines if line.get("track_role") == "ACTIVE_GOVERNING"]
        if len(governing) != 1:
            raise HTTPException(status_code=400, detail={
                "error": "Governing business line invalid",
                "blocking_reasons": [
                    f"expected exactly one ACTIVE_GOVERNING line, found {len(governing)}"
                ],
            })
        gov = governing[0]
        if primary not in line_models(gov):
            raise HTTPException(status_code=400, detail={
                "error": "Governing business line incompatible",
                "blocking_reasons": [
                    f"primary model {primary} is not supported by {gov.get('id')}"
                ],
            })
        required = required_msl_criteria(state, v)
        common = [c for c in required if c.get("transition_gate") == MSL_COMMON_GATE]
        model_specific = [
            c for c in required if c.get("transition_gate") == MSL_MODEL_SPECIFIC_GATE
        ]
        if len(common) != MSL_COMMON_COUNT:
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue incomplete",
                "blocking_reasons": [
                    f"expected {MSL_COMMON_COUNT} common criteria, found {len(common)}"
                ],
            })
        if any(
            c.get("criterion_scope") != "VENTURE" or c.get("business_model") != "ALL"
            for c in common
        ):
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue inconsistent",
                "blocking_reasons": ["a common MSL criterion is not venture-wide"],
            })
        common_identity = _catalog_identity_blockers(
            "Common MSL criteria", MSL_COMMON_IDS, [c["id"] for c in common]
        )
        if common_identity:
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue identity mismatch",
                "blocking_reasons": common_identity,
            })
        expected_model_specific = MSL_MODEL_SPECIFIC_COUNTS.get(primary)
        if expected_model_specific is None:
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue incomplete",
                "blocking_reasons": [f"no model-specific criteria count for {primary}"],
            })
        if len(model_specific) != expected_model_specific:
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue incomplete",
                "blocking_reasons": [
                    f"expected {expected_model_specific} {primary} criteria, "
                    f"found {len(model_specific)}"
                ],
            })
        if any(
            c.get("criterion_scope") != "BUSINESS_LINE"
            or c.get("business_model") != primary
            for c in model_specific
        ):
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue inconsistent",
                "blocking_reasons": [
                    f"a {primary} criterion is not scoped to the governing business line"
                ],
            })
        model_identity = _catalog_identity_blockers(
            f"{primary} MSL criteria",
            MSL_MODEL_SPECIFIC_IDS.get(primary, ()),
            [c["id"] for c in model_specific],
        )
        if model_identity:
            raise HTTPException(status_code=400, detail={
                "error": "MSL criteria catalogue identity mismatch",
                "blocking_reasons": model_identity,
            })
        raw_reason = body.get("reason")
        reason = raw_reason.strip() if isinstance(raw_reason, str) else ""
        if not reason:
            raise HTTPException(status_code=422, detail="A meaningful reviewer reason is required")
        ev = evaluate_all(con)
        by_key = {(e["venture_id"], e["business_line_id"], e["criterion_id"]): e
                  for e in ev["evaluated_criteria"]}
        results = []
        for c in required:
            if c.get("criterion_scope") == "VENTURE":
                e = by_key.get((venture_id, None, c["id"]))
            else:
                e = by_key.get((venture_id, gov["id"], c["id"]))
            results.append(e or {"criterion_id": c["id"], "criterion_result": "UNKNOWN"})
        if len(results) < len(required):
            raise HTTPException(status_code=400, detail="MSL evaluation missing required items")
        blocking = [f"{e['criterion_id']}={e['criterion_result']}" for e in results
                    if e["criterion_result"] != "MET"]
        if blocking:
            raise HTTPException(status_code=400, detail={
                "error": "MSL checklist incomplete", "blocking_reasons": blocking})
        ts = now_iso()
        approved_by = body.get("approved_by", "Demo Programme Reviewer")
        snapshot = {e["criterion_id"]: e["criterion_result"] for e in results}
        mid = f"m-{uuid.uuid4().hex[:8]}"
        con.execute(
            "INSERT INTO msl_eligibility_decisions (id, venture_id, decision_status, decision_type,"
            " approved_by, approved_at, reason, provenance_source, msl_criteria_snapshot_json)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (mid, venture_id, "Eligible for MSL", "REVIEWER_CERTIFIED", approved_by, ts,
             reason, "Reviewer certification", json.dumps(snapshot)),
        )
        con.execute("UPDATE ventures SET msl_eligibility=?, msl_eligibility_provenance=? WHERE id=?",
                    ("Eligible for MSL", "Reviewer certification", venture_id))
        con.commit()
        return {"id": mid, "decision_status": "Eligible for MSL", "approved_by": approved_by,
                "approved_at": ts, "msl_criteria_snapshot_json": snapshot}
    finally:
        con.close()


@app.post("/api/criteria/{criterion_id}/configure")
def api_configure_criterion(criterion_id: str, body: dict[str, Any],
                            x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [OWNER])
    con = get_con()
    try:
        row = con.execute("SELECT * FROM criteria_catalog WHERE id=?", (criterion_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Criterion not found")
        rule = body.get("configured_rule")
        value = body.get("configured_value")
        error = configuration_error(dict(row), value, rule)
        if error:
            raise HTTPException(status_code=422, detail=error)
        ts = now_iso()
        con.execute(
            "UPDATE criteria_catalog SET configured_value=?, configured_rule_json=?,"
            " configured_by=?, configured_at=? WHERE id=?",
            (body.get("configured_value"), json.dumps(rule) if isinstance(rule, (dict, list)) else rule,
             body.get("actor", "Demo Programme Owner"), ts, criterion_id),
        )
        con.commit()
        return {"id": criterion_id, "configured_value": body.get("configured_value"),
                "configured_rule": rule, "configured_by": body.get("actor"),
                "configured_at": ts, "note": body.get("configured_rule_note")}
    finally:
        con.close()


@app.post("/api/ventures/{venture_id}/seam-actions")
def api_seam_actions(venture_id: str, body: dict[str, Any],
                     x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    action = body.get("action")
    con = get_con()
    try:
        v = con.execute("SELECT * FROM ventures WHERE id=?", (venture_id,)).fetchone()
        if not v:
            raise HTTPException(status_code=404, detail="Venture not found")
        if action == "CLARIFY_MODEL":
            need_role(x_ils_role, [OWNER])
            model = (body.get("approved_model") or "").strip()
            line_id = (body.get("business_line_id") or "").strip() or None
            if not model or model not in VALID_MODELS:
                raise HTTPException(status_code=422, detail="Valid approved_model is required")
            lines = [dict(r) for r in con.execute("SELECT * FROM venture_business_lines WHERE venture_id=?", (venture_id,)).fetchall()]
            line_by_id = {line["id"]: line for line in lines}
            if line_id and line_id not in line_by_id:
                raise HTTPException(status_code=422, detail="A governing business_line_id belonging to this venture is required")
            compatible = [line for line in lines if model in line_models(line)]
            if line_id:
                chosen = line_by_id[line_id]
                if model not in line_models(chosen):
                    raise HTTPException(
                        status_code=422,
                        detail=_line_model_error("approved_model", model, chosen),
                    )
            else:
                if not compatible:
                    raise HTTPException(
                        status_code=422,
                        detail=f"No business line is compatible with approved_model {model}; select a governing line first",
                    )
                if len(compatible) > 1:
                    ids = ", ".join(line["id"] for line in compatible)
                    raise HTTPException(
                        status_code=422,
                        detail=f"Multiple business lines are compatible with approved_model {model} ({ids}); choose one explicitly",
                    )
                chosen = compatible[0]
            line_id = chosen["id"]
            con.execute("UPDATE ventures SET primary_business_model=?, model_resolution_status=?,"
                        " model_clarification_note=? WHERE id=?",
                        (model, "CONFIRMED", body.get("note", "Programme owner clarification"), venture_id))
            con.execute("UPDATE venture_business_lines SET track_role=?, approved_model=?,"
                        " resolution_status=?, clarification_provenance=? WHERE id=?",
                        ("ACTIVE_GOVERNING", model, "CONFIRMED", "Programme owner clarification", line_id))
            con.execute("UPDATE venture_business_lines SET track_role=?, approved_model=NULL WHERE venture_id=? AND id!=?",
                        ("HISTORICAL_PRESERVED", venture_id, line_id))
            con.commit()
            return {"venture_id": venture_id, "primary_business_model": model,
                    "governing_business_line_id": line_id, "model_resolution_status": "CONFIRMED"}
        if action == "LOG_MENTOR_OUTCOME":
            need_role(x_ils_role, [MENTOR, OWNER, REVIEWER])
            con.execute("UPDATE ventures SET mentor_goal=?, mentor_status=?, next_update_date=?,"
                        " follow_up_note=? WHERE id=?",
                        (body.get("mentor_goal"), body.get("mentor_status"),
                         body.get("next_update_date"), body.get("follow_up_note"), venture_id))
            con.commit()
            return {"venture_id": venture_id, "mentor_status": body.get("mentor_status")}
        raise HTTPException(status_code=400, detail="Unknown seam action")
    finally:
        con.close()


@app.get("/api/export")
def api_export(x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [OWNER, REVIEWER])
    con = get_con()
    try:
        return JSONResponse(export_all(con))
    finally:
        con.close()


@app.post("/api/import")
def api_import(body: dict[str, Any],
               x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [OWNER, REVIEWER])
    con = get_con()
    try:
        try:
            import_all(con, body)
        except (ValueError, sqlite3.IntegrityError, sqlite3.OperationalError) as exc:
            con.rollback()
            raise HTTPException(status_code=422, detail=f"Invalid complete export: {exc}")
        return {"imported_tables": list(body.keys())}
    finally:
        con.close()


@app.post("/api/reset")
def api_reset(x_ils_role: str | None = Header(default=None, alias="X-ILS-Role")):
    need_role(x_ils_role, [OWNER, REVIEWER])
    con = get_con()
    try:
        seed_from_dict(con, load_seed_file(seed_path()))
        return {"reset": True}
    finally:
        con.close()


# Vite-free frontend: serve the prebuilt, self-contained UI from FastAPI.
# Keep this mount last so every /api/* endpoint has priority.
from fastapi.staticfiles import StaticFiles

_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.joinpath("index.html").exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="ils-frontend")
