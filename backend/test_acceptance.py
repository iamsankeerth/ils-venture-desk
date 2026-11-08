"""19-scenario acceptance matrix (AT-01..AT-14) against an isolated tmp SQLite fixture."""
import json
import os

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, seed_from_dict, load_seed_file, default_seed_path

OWNER = {"X-ILS-Role": "PROGRAMME_OWNER"}
REVIEWER = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
STUDENT = {"X-ILS-Role": "STUDENT_FOUNDER"}
MENTOR_H = {"X-ILS-Role": "MENTOR"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    dbp = tmp_path / "ils_test.db"
    con = connect(dbp)
    seed_from_dict(con, load_seed_file(default_seed_path()))
    con.close()
    monkeypatch.setenv("ILS_DB", str(dbp))
    monkeypatch.setenv("ILS_SEED", str(default_seed_path()))
    return TestClient(app)


def state(client):
    r = client.get("/api/state")
    assert r.status_code == 200
    return r.json()


def by_id(rows, id):
    return next(x for x in rows if x["id"] == id)


def eval_lookup(s, venture_id, line_id, criterion_id):
    return next(e for e in s["evaluated_criteria"]
                if e["venture_id"] == venture_id and e["business_line_id"] == line_id
                and e["criterion_id"] == criterion_id)


def approve(client, eid, decision="APPROVED"):
    return client.post(f"/api/evidence/{eid}/review", json={
        "decision": decision, "reviewer": "Demo Programme Reviewer",
        "reason": "Excerpt reviewed; Week 2 WAU (8) is below 10 and target segment is unrecorded."},
        headers=REVIEWER)


# AT-01 seed preservation
def test_at01_seed(client):
    s = state(client)
    assert len(s["criteria_catalog"]) == 38
    a, b, c = by_id(s["ventures"], "case-a"), by_id(s["ventures"], "case-b"), by_id(s["ventures"], "case-c")
    assert a["programme_level"] == "Unknown" and b["programme_level"] == "Unknown"
    assert c["programme_level"] == "Level 2"
    assert b["msl_eligibility"] == "Eligible for MSL" and b["msl_eligibility_provenance"] == "Imported from tracker"
    assert c["msl_eligibility"] == "Eligible for MSL"
    assert b["fundraising_preference"] == "Grants; does not want equity funding"
    assert c["fundraising_preference"] == "No, per tracker"
    assert c["msl_handover_status"] == "Unknown" and c["msl_acceptance_status"] == "Unknown"
    assert b["historical_traction_amount_paise"] == 120000000
    assert c["historical_traction_amount_paise"] == 1300000000


# AT-02 verbatim claim
def test_at02_update_claim(client):
    s = state(client)
    u = by_id(s["progress_updates"], "A-01")
    claimed = json.loads(u["claimed_metrics_json"]) if isinstance(u["claimed_metrics_json"], str) else u["claimed_metrics_json"]
    assert claimed["signups"] == 32
    assert {"period": "Week ending 4 October", "value": 12} in claimed["wau"]
    assert {"period": "Week ending 11 October", "value": 8} in claimed["wau"]
    assert claimed["evidence_ref"] == "A-E01"
    assert u["blocker"] and u["next_action"] and u["evidence_id"] == "A-E01"


# AT-03A approve -> NOT_MET + UNKNOWN
def test_at03a_approve(client):
    r = approve(client, "A-E01", "APPROVED")
    assert r.status_code == 200
    s = state(client)
    assert by_id(s["evidence"], "A-E01")["evidence_status"] == "APPROVED"
    assert eval_lookup(s, "case-a", "bl-a-b2c", "L0L1-AIB2C-2")["criterion_result"] == "NOT_MET"
    assert eval_lookup(s, "case-a", "bl-a-b2c", "L0L1-AIB2C-1")["criterion_result"] == "UNKNOWN"


# AT-03B request changes
def test_at03b_changes_requested(client):
    r = approve(client, "A-E01", "CHANGES_REQUESTED")
    assert r.status_code == 200
    s = state(client)
    assert by_id(s["evidence"], "A-E01")["evidence_status"] == "CHANGES_REQUESTED"
    h = [x for x in s["history"] if x["evidence_id"] == "A-E01"]
    assert h and h[0]["reviewer"] == "Demo Programme Reviewer" and h[0]["reviewed_at"] and h[0]["reason"]
    assert any(x.get("id") == "A-E01" for x in s["staff_queue"]["pending_actions"])


# AT-04A qualitative unknowns
def test_at04a_qualitative(client):
    s = state(client)
    for q in ["L0-Q1", "L0-Q2", "L0-Q3", "L0-Q4", "L0-Q5"]:
        assert eval_lookup(s, "case-a", None, q)["criterion_result"] == "UNKNOWN", q
    roll = next(r for r in s["venture_rollups"] if r["venture_id"] == "case-a")
    assert "5 qualitative items Unknown" in roll["full_level_status"]


# AT-04B queue + levels
def test_at04b_queue_levels(client):
    s = state(client)
    levels = {v["id"]: v["programme_level"] for v in s["ventures"]}
    assert levels == {"case-a": "Unknown", "case-b": "Unknown", "case-c": "Level 2"}
    assert len(s["staff_queue"]["unreviewed_evidence"]) >= 7
    assert any(v["msl_eligibility"] == "Eligible for MSL"
               and v["msl_acceptance_status"] == "Unknown" for v in s["ventures"] if v["id"] in ("case-b", "case-c"))


# AT-05 invoice + receipt
def test_at05_invoice_receipt(client):
    approve(client, "B-E02", "APPROVED")
    approve(client, "B-E03", "APPROVED")
    s = state(client)
    led = next(l for l in s["ledgers"] if l["business_line_id"] == "bl-b-services")
    assert led["billed_paise"] == 10000000 and led["billed_display"] == "\u20b9100,000"
    assert led["collected_paise"] == 6000000
    assert led["arithmetic_difference_paise"] == 4000000
    assert led["historical_baseline_paise"] == 120000000
    assert led["billed_paise"] != 130000000  # never summed with baseline


# AT-06 LOI commercial intent
def test_at06_loi(client):
    approve(client, "B-E01", "APPROVED")
    s = state(client)
    led = next(l for l in s["ledgers"] if l["business_line_id"] == "bl-b-saas")
    assert led["signed_lois"] == 1
    assert led["billed_paise"] is None and led["collected_paise"] is None
    assert eval_lookup(s, "case-b", "bl-b-saas", "L1L2-AIB2B-2")["criterion_result"] == "UNKNOWN"


# AT-07 streaming dual periods
def test_at07_streaming(client):
    approve(client, "C-E01", "APPROVED")
    approve(client, "C-E02", "APPROVED")
    s = state(client)
    e1, e2 = by_id(s["evidence"], "C-E01"), by_id(s["evidence"], "C-E02")
    assert e1["earned_period"] == "September" and e2["payment_date"] == "5 October"
    assert e2["parent_evidence_id"] == "C-E01" if "parent_evidence_id" in e2 else True
    led = next(l for l in s["ledgers"] if l["business_line_id"] == "bl-c-main")
    assert led["earned_paise"] == 8000000 and led["collected_paise"] == 7000000
    assert led["arithmetic_difference_paise"] == 1000000
    assert by_id(s["evidence"], "C-E03")["ledger_bucket"] == "BILLED"


# AT-08 direct-entry history
def test_at08_history(client):
    s = state(client)
    tr = [t for t in s["transitions"] if t["venture_id"] == "case-c"]
    assert tr and tr[0]["transition_type"] == "HISTORICAL_IMPORTED" and tr[0]["to_level"] == "Level 2"
    assert tr[0]["approved_by"] == "Unknown" and tr[0]["approved_at"] == "Unknown"
    assert any(m["venture_id"] == "case-c" and m["decision_status"] == "Eligible for MSL" for m in s["msl"])


# AT-09 unmet advancement rejected
def test_at09_blocked_advancement(client):
    r = client.post("/api/ventures/case-a/transitions",
                    json={"to_level": "Level 1", "transition_type": "STANDARD_ADVANCEMENT",
                          "approved_by": "Demo Programme Reviewer", "reason": "attempt"},
                    headers=REVIEWER)
    assert r.status_code == 400
    assert r.json()["detail"]["blocking_reasons"]


# AT-10A direct entry
def test_at10a_direct_entry(client):
    r = client.post("/api/ventures/case-a/transitions",
                    json={"to_level": "Level 1", "transition_type": "DIRECT_ENTRY",
                          "approved_by": "Demo Programme Reviewer", "reason": "Prior work"},
                    headers=REVIEWER)
    assert r.status_code == 200
    body = r.json()
    assert body["approved_by"] == "Demo Programme Reviewer" and body["approved_at"]
    assert body["criteria_snapshot_json"]
    assert state(client)["ventures"] and by_id(state(client)["ventures"], "case-a")["programme_level"] == "Level 1"


def _make_met_venture(client):
    r = client.post("/api/ventures", json={
        "id": "case-t", "name": "Fixture", "primary_business_model": "Services",
        "model_resolution_status": "CONFIRMED", "programme_level": "Level 0",
        "programme_level_provenance": "Test fixture",
        "business_lines": [{"id": "bl-t", "line_name": "Services", "track_role": "ACTIVE_GOVERNING",
                            "candidate_models": ["Services"], "approved_model": "Services",
                            "resolution_status": "CONFIRMED"}]}, headers=OWNER)
    assert r.status_code == 201, r.text
    eids = []
    specs = [
        ("L0L1-SRV-1", [{"criterion_id": "L0L1-SRV-1", "numeric_value": 5, "unit": "COUNT", "qualifier_status": "PRICED_YES"}]),
        ("L0L1-SRV-2", [{"criterion_id": "L0L1-SRV-2", "numeric_value": 2, "unit": "COUNT", "qualifier_status": "PAYING"}]),
        ("L0L1-SRV-3", []),
    ]
    for crit, obs in specs:
        body = {"id": f"T-{crit}", "venture_id": "case-t", "business_line_id": "bl-t",
                "criterion_id": crit, "claimed_metrics_json": {"note": "fixture"},
                "evidence": {"id": f"TE-{crit}",
                             "source_type": "Payment Receipt" if crit == "L0L1-SRV-3" else "Mentor Note",
                             "ledger_bucket": "COLLECTED" if crit == "L0L1-SRV-3" else "USAGE_METRIC",
                             "amount_minor_or_count": 1500000 if crit == "L0L1-SRV-3" else None,
                             "unit": "INR_PAISE" if crit == "L0L1-SRV-3" else "COUNT"},
                "observations": obs, "blocker": "No blocker", "next_action": "Reviewer verifies synthetic fixture", "summary_period": "Test period"}
        rr = client.post("/api/updates", json=body, headers=REVIEWER)
        assert rr.status_code == 201, rr.text
        eids.append(f"TE-{crit}")
    for q in ["L0-Q1", "L0-Q2", "L0-Q3", "L0-Q4", "L0-Q5"]:
        qv = {"met": True, "canvas": True, "mentor_signoff": True,
              "unique_conversations": 55, "weeks_spanned": 3,
              "target_segment": 40, "workaround_users": 10,
              "predeclared_test": True, "result": True, "decision": True}
        rr = client.post("/api/updates", json={
            "id": f"T-{q}", "venture_id": "case-t", "criterion_id": q,
            "claimed_metrics_json": {"note": "fixture"},
            "evidence": {"id": f"TE-{q}", "source_type": "Mentor Note", "ledger_bucket": "USAGE_METRIC"},
            "observations": [{"criterion_id": q, "qualitative_value_json": qv, "qualifier_status": "met"}],
            "summary_period": "Test period", "blocker": "No blocker", "next_action": "Reviewer verifies synthetic checklist"},
            headers=REVIEWER)
        assert rr.status_code == 201, rr.text
        eids.append(f"TE-{q}")
    for eid in eids:
        assert approve(client, eid, "APPROVED").status_code == 200
    return eids


# AT-10B valid standard advancement, zero waiting rule
def test_at10b_standard_advancement(client):
    _make_met_venture(client)
    r = client.post("/api/ventures/case-t/transitions",
                    json={"to_level": "Level 1", "transition_type": "STANDARD_ADVANCEMENT",
                          "approved_by": "Demo Programme Reviewer", "reason": "All MET"},
                    headers=REVIEWER)
    assert r.status_code == 200, r.text
    assert by_id(state(client)["ventures"], "case-t")["programme_level"] == "Level 1"


# AT-11 MSL blocked, imports preserved
def test_at11_msl_blocked(client):
    r = client.post("/api/ventures/case-a/msl-eligibility",
                    json={"approved_by": "Demo Programme Reviewer", "reason": "attempt"}, headers=REVIEWER)
    assert r.status_code == 400
    s = state(client)
    assert by_id(s["ventures"], "case-b")["msl_eligibility"] == "Eligible for MSL"
    assert by_id(s["ventures"], "case-c")["msl_eligibility"] == "Eligible for MSL"


# AT-12A student reset/import denied
def test_at12a_student_reset_import(client):
    assert client.post("/api/reset", headers=STUDENT).status_code == 403
    assert client.post("/api/import", json={}, headers=STUDENT).status_code == 403


# AT-12B student reviewer actions denied, update allowed
def test_at12b_student_roles(client):
    assert client.post("/api/evidence/A-E01/review",
                       json={"decision": "APPROVED", "reviewer": "x", "reason": "x"},
                       headers=STUDENT).status_code == 403
    assert client.post("/api/ventures/case-a/transitions",
                       json={"to_level": "Level 1", "transition_type": "DIRECT_ENTRY",
                             "approved_by": "x", "reason": "x"}, headers=STUDENT).status_code == 403
    r = client.post("/api/updates", json={
        "venture_id": "case-a", "business_line_id": "bl-a-b2c", "criterion_id": "L0L1-AIB2C-2",
        "claimed_metrics_json": {"note": "student claim"}, "blocker": "b", "next_action": "n",
        "summary_period": "Week ending 18 October",
        "evidence": {"source_type": "Analytics excerpt", "ledger_bucket": "USAGE_METRIC"},
        "observations": [{"criterion_id": "L0L1-AIB2C-2", "numeric_value": 11,
                           "metric_type": "WAU", "unit": "COUNT", "period_label": "Week ending 18 October"}]},
        headers=STUDENT)
    assert r.status_code == 201


def _submit_a_e02(client):
    return client.post("/api/updates", json={
        "id": "A-E02U", "venture_id": "case-a", "business_line_id": "bl-a-b2c",
        "criterion_id": "L0L1-AIB2C-2", "claimed_metrics_json": {"wau": [{"period": "Week ending 11 October", "value": 11}]},
        "evidence": {"id": "A-E02", "source_type": "Analytics Excerpt", "ledger_bucket": "USAGE_METRIC"},
        "summary_period": "Week ending 11 October", "blocker": "No blocker", "next_action": "Review revised reading",
        "observations": [{"id": "A-E02-W2", "criterion_id": "L0L1-AIB2C-2", "metric_type": "WAU",
                          "period_label": "Week ending 11 October", "period_sequence": 2,
                          "numeric_value": 11, "unit": "COUNT",
                          "supersedes_observation_id": "A-E01-W2"}]},
        headers=REVIEWER)


# AT-13A approved supersession
def test_at13a_supersession(client):
    approve(client, "A-E01", "APPROVED")
    assert _submit_a_e02(client).status_code == 201
    assert approve(client, "A-E02", "APPROVED").status_code == 200
    s = state(client)
    ev = eval_lookup(s, "case-a", "bl-a-b2c", "L0L1-AIB2C-2")
    assert ev["criterion_result"] == "MET" and ev["verified_readings"] == [12, 11]
    assert any(o["id"] == "A-E01-W2" for o in s["observations"])  # preserved in history
    roll = next(r for r in s["venture_rollups"] if r["venture_id"] == "case-a")
    assert "Not Yet Verified" in roll["full_level_status"]


# AT-13B unreviewed correction stays pending
def test_at13b_pending(client):
    approve(client, "A-E01", "APPROVED")
    assert _submit_a_e02(client).status_code == 201
    s = state(client)
    ev = eval_lookup(s, "case-a", "bl-a-b2c", "L0L1-AIB2C-2")
    assert ev["criterion_result"] == "NOT_MET" and ev["verified_readings"] == [12, 8]
    assert ev["pending_corrections"] and ev["pending_corrections"][0]["numeric_value"] == 11


# AT-14 export/import round-trip
def test_at14_roundtrip(client, tmp_path):
    approve(client, "A-E01", "APPROVED")
    exported = client.get("/api/export", headers=OWNER).json()
    assert len(exported["criteria_catalog"]) == 38
    db2 = tmp_path / "ils_import.db"
    import os as _os
    _os.environ["ILS_DB"] = str(db2)
    r = client.post("/api/import", json=exported, headers=OWNER)
    assert r.status_code == 200
    s2 = state(client)
    assert len(s2["evidence"]) == len(exported["evidence_records"])
    assert len(s2["observations"]) == len(exported["evidence_observations"])
    assert len(s2["transitions"]) == len(exported["transition_decisions"])
    assert len(s2["msl"]) == len(exported["msl_eligibility_decisions"])
    assert by_id(s2["evidence"], "A-E01")["evidence_status"] == "APPROVED"


# REG-01 blank venture import rejected with 422
def test_reg01_blank_venture_import_rejected_422(client):
    assert client.post("/api/ventures", json={}, headers=OWNER).status_code == 422
    assert client.post("/api/ventures", json={"name": ""}, headers=OWNER).status_code == 422
    assert client.post("/api/ventures", json={"name": "Untitled Venture"}, headers=OWNER).status_code == 422
    assert client.post("/api/ventures", json={"name": "Valid Name", "activity": ""}, headers=OWNER).status_code == 422


# REG-02 unresolved model + active governing line rejected with 422
def test_reg02_unresolved_model_with_active_governing_line_rejected_422(client):
    r = client.post("/api/ventures", json={
        "name": "Bad Unresolved",
        "activity": "Testing invariant",
        "model_resolution_status": "UNRESOLVED",
        "business_lines": [{"line_name": "Line 1", "candidate_models": ["AI_B2C"], "track_role": "ACTIVE_GOVERNING"}],
    }, headers=OWNER)
    assert r.status_code == 422


# REG-03 confirmed model without governing line rejected with 422
def test_reg03_confirmed_model_without_governing_line_rejected_422(client):
    r = client.post("/api/ventures", json={
        "name": "Bad Confirmed No Line",
        "activity": "Testing invariant",
        "primary_business_model": "Services",
        "model_resolution_status": "CONFIRMED",
        "business_lines": [{"line_name": "Line 1", "candidate_models": ["Services"], "track_role": "CANDIDATE"}],
    }, headers=OWNER)
    assert r.status_code == 422


# REG-04 confirmed model with two governing lines rejected with 422
def test_reg04_confirmed_model_with_two_governing_lines_rejected_422(client):
    r = client.post("/api/ventures", json={
        "name": "Bad Confirmed Two Lines",
        "activity": "Testing invariant",
        "primary_business_model": "Services",
        "model_resolution_status": "CONFIRMED",
        "business_lines": [
            {"line_name": "Line 1", "approved_model": "Services", "track_role": "ACTIVE_GOVERNING"},
            {"line_name": "Line 2", "approved_model": "Services", "track_role": "ACTIVE_GOVERNING"},
        ],
    }, headers=OWNER)
    assert r.status_code == 422


# REG-05 one evidence item (A-E01) measures two criteria; both show Awaiting Review (UNREVIEWED)
def test_reg05_one_evidence_measures_two_criteria_both_awaiting_review(client):
    s = state(client)
    ev_signups = eval_lookup(s, "case-a", "bl-a-b2c", "L0L1-AIB2C-1")
    ev_wau = eval_lookup(s, "case-a", "bl-a-b2c", "L0L1-AIB2C-2")
    assert "A-E01" in ev_signups["related_evidence_ids"]
    assert "A-E01" in ev_wau["related_evidence_ids"]
    assert ev_signups["latest_evidence_status"] == "UNREVIEWED"
    assert ev_wau["latest_evidence_status"] == "UNREVIEWED"
    assert ev_signups["criterion_result"] == "UNKNOWN"
    assert ev_wau["criterion_result"] == "UNKNOWN"


# REG-06 Case A governing model is null while unresolved, and no line is ACTIVE_GOVERNING
def test_reg06_case_a_governing_model_is_null_while_unresolved(client):
    s = state(client)
    a = by_id(s["ventures"], "case-a")
    assert a["model_resolution_status"] == "UNRESOLVED"
    assert a["primary_business_model"] is None
    a_lines = [l for l in s["venture_business_lines"] if l["venture_id"] == "case-a"]
    assert all(l["track_role"] != "ACTIVE_GOVERNING" for l in a_lines)


# REG-07 unreviewed invoice + receipt shows claimed Rs 40k difference while verified values remain Unknown
def test_reg07_unreviewed_invoice_and_receipt_claimed_40k_diff_verified_unknown(client):
    s = state(client)
    led = next(l for l in s["ledgers"] if l["business_line_id"] == "bl-b-services")
    assert led["claimed_billed_paise"] == 10000000 and led["claimed_billed_display"] == "\u20b9100,000"
    assert led["claimed_collected_paise"] == 6000000 and led["claimed_collected_display"] == "\u20b960,000"
    assert led["claimed_arithmetic_difference_paise"] == 4000000 and led["claimed_arithmetic_difference_display"] == "\u20b940,000"
    assert led["billed_paise"] is None and led["collected_paise"] is None and led["arithmetic_difference_paise"] is None
    assert led["verified_balance_note"] == "Not a verified outstanding balance"


# REG-08 unreviewed earnings + payout shows claimed Rs 10k difference while verified values remain Unknown
def test_reg08_unreviewed_earnings_and_payout_claimed_10k_diff_verified_unknown(client):
    s = state(client)
    led = next(l for l in s["ledgers"] if l["business_line_id"] == "bl-c-main")
    assert led["claimed_earned_paise"] == 8000000 and led["claimed_earned_display"] == "\u20b980,000"
    assert led["claimed_collected_paise"] == 7000000 and led["claimed_collected_display"] == "\u20b970,000"
    assert led["claimed_arithmetic_difference_paise"] == 1000000 and led["claimed_arithmetic_difference_display"] == "\u20b910,000"
    assert led["earned_paise"] is None and led["collected_paise"] is None and led["arithmetic_difference_paise"] is None
    assert led["verified_balance_note"] == "Not a verified receivable"


# REG-09 empty business line row rejected with 422
def test_reg09_empty_business_line_row_rejected_422(client):
    r = client.post("/api/ventures", json={
        "name": "Venture With Blank Line",
        "activity": "Testing blank line rejection",
        "model_resolution_status": "UNRESOLVED",
        "business_lines": [{"line_name": "   ", "candidate_models": ["Services"]}],
    }, headers=OWNER)
    assert r.status_code == 422


# REG-10 unresolved model with non-null primary_business_model rejected with 422
def test_reg10_unresolved_model_with_non_null_primary_model_rejected_422(client):
    r = client.post("/api/ventures", json={
        "name": "Contradictory Venture",
        "activity": "Testing unresolved + primary model contradiction",
        "primary_business_model": "AI_B2C",
        "model_resolution_status": "UNRESOLVED",
    }, headers=OWNER)
    assert r.status_code == 422


# REG-11 clarify model sets single ACTIVE_GOVERNING line and preserves prior track
def test_reg11_clarify_model_sets_single_active_governing_and_preserves_prior(client):
    r = client.post("/api/ventures/case-a/seam-actions", json={
        "action": "CLARIFY_MODEL",
        "approved_model": "AI_B2B",
        "business_line_id": "bl-a-b2b",
        "note": "Owner confirmed agency AI B2B motion",
    }, headers=OWNER)
    assert r.status_code == 200
    s = state(client)
    a = by_id(s["ventures"], "case-a")
    assert a["model_resolution_status"] == "CONFIRMED" and a["primary_business_model"] == "AI_B2B"
    b2b = by_id(s["venture_business_lines"], "bl-a-b2b")
    b2c = by_id(s["venture_business_lines"], "bl-a-b2c")
    assert b2b["track_role"] == "ACTIVE_GOVERNING" and b2b["approved_model"] == "AI_B2B"
    assert b2c["track_role"] == "HISTORICAL_PRESERVED"
    assert by_id(s["evidence"], "A-E01")["id"] == "A-E01"


# REG-12 distinct rule vs model clarification counts & line model scoping
def test_reg12_rule_vs_model_clarification_counts_disambiguated(client):
    s = state(client)
    clarifs = s["staff_queue"]["owner_clarifications"]
    model_clarifs = [c for c in clarifs if c.get("venture_id")]
    rule_clarifs = [c for c in clarifs if c.get("criterion_id")]
    assert len(model_clarifs) == 2  # case-a and case-b
    assert len(rule_clarifs) == 8   # 8 programme-wide configurable rules
    a_b2c_models = {e["business_model"] for e in s["evaluated_criteria"]
                    if e["venture_id"] == "case-a" and e["business_line_id"] == "bl-a-b2c"}
    assert a_b2c_models == {"AI_B2C"}
