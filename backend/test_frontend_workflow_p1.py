import json

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, default_seed_path, load_seed_file, seed_from_dict

R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
O = {"X-ILS-Role": "PROGRAMME_OWNER"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "ils_p1.sqlite"
    con = connect(path)
    seed_from_dict(con, load_seed_file(default_seed_path()))
    con.close()
    monkeypatch.setenv("ILS_DB", str(path))
    with TestClient(app) as test_client:
        yield test_client


def state(client):
    response = client.get("/api/state")
    assert response.status_code == 200, response.text
    return response.json()


def venture(payload, venture_id):
    return next(row for row in payload["ventures"] if row["id"] == venture_id)


def criterion(payload, venture_id, line_id, criterion_id):
    return next(
        row
        for row in payload["evaluated_criteria"]
        if row["venture_id"] == venture_id
        and row.get("business_line_id") == line_id
        and row["criterion_id"] == criterion_id
    )


def approve(client, evidence_id):
    response = client.post(
        f"/api/evidence/{evidence_id}/review",
        json={
            "decision": "APPROVED",
            "reviewer": "Demo Programme Reviewer",
            "reason": "P1 QA-only review",
        },
        headers=R,
    )
    assert response.status_code == 200, response.text


def create_qa_venture(client):
    response = client.post(
        "/api/ventures",
        json={
            "id": "qa-p1",
            "name": "QA-only P1 provenance",
            "activity": "QA-only provenance fixture",
            "primary_business_model": "Services",
            "model_resolution_status": "CONFIRMED",
            "programme_level": "Level 0",
            "programme_level_provenance": "QA-only fixture",
            "business_lines": [
                {
                    "id": "qa-p1-line",
                    "line_name": "QA Services line",
                    "track_role": "ACTIVE_GOVERNING",
                    "candidate_models": ["Services"],
                    "approved_model": "Services",
                    "resolution_status": "CONFIRMED",
                }
            ],
        },
        headers=O,
    )
    assert response.status_code == 201, response.text


def direct_entry(client, venture_id, to_level="Level 1", provenance_note=None):
    body = {
        "to_level": to_level,
        "transition_type": "DIRECT_ENTRY",
        "approved_by": "Demo Programme Reviewer",
        "reason": "P1 QA-only direct entry",
    }
    if provenance_note is not None:
        body["provenance_note"] = provenance_note
    response = client.post(
        f"/api/ventures/{venture_id}/transitions",
        json=body,
        headers=R,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_p1_state_exposes_qualifier_options_and_evidence_policy(client):
    payload = state(client)
    options = payload["qualifier_options"]["L0L1-AIB2B-1"]
    assert "BUDGET_HOLDER" in options
    assert "budget_holder" in options

    policy = payload["evidence_type_policy"]
    receipt = policy["Payment Receipt"]
    assert receipt["buckets"] == ["COLLECTED"]
    assert receipt["units"] == ["INR_PAISE"]
    assert receipt["amount_required"] is True
    assert receipt["allow_amount"] is True

    analytics = policy["Analytics Excerpt"]
    assert analytics["units"] == [None, "COUNT"]
    assert analytics["allow_amount"] is False
    assert analytics["amount_required"] is False


def test_p1_staff_queue_lists_reviewed_unresolved_criteria(client):
    approve(client, "A-E01")
    queue = state(client)["staff_queue"]["unresolved_criteria"]
    by_key = {(row["venture_id"], row["business_line_id"], row["criterion_id"]): row for row in queue}
    wau = by_key[("case-a", "bl-a-b2c", "L0L1-AIB2C-2")]
    signups = by_key[("case-a", "bl-a-b2c", "L0L1-AIB2C-1")]
    assert wau["criterion_result"] == "NOT_MET"
    assert signups["criterion_result"] == "UNKNOWN"
    assert wau["criterion_name"]
    assert wau["line_name"] == "AI B2C (Assigned in Tracker)"
    assert "A-E01" in wau["evidence_ids"]
    assert "A-E01" in signups["evidence_ids"]
    assert all(row["evidence_ids"] for row in queue)
    assert not any(row["criterion_id"] == "MSL-COM-1" for row in queue)


def test_p1_transition_refreshes_programme_level_provenance(client):
    create_qa_venture(client)
    before = state(client)
    case_c_before = venture(before, "case-c")
    case_c_transitions_before = [
        row for row in before["transition_decisions"] if row["venture_id"] == "case-c"
    ]
    result = direct_entry(client, "qa-p1")

    after = state(client)
    qa = venture(after, "qa-p1")
    assert result["to_level"] == "Level 1"
    assert qa["programme_level"] == "Level 1"
    assert "Reviewer-approved direct entry to Level 1" == qa["programme_level_provenance"]
    assert "DIRECT_ENTRY to Level 1" in qa["advancement_status"]

    case_c_after = venture(after, "case-c")
    assert case_c_after["programme_level_provenance"] == case_c_before["programme_level_provenance"]
    assert case_c_after["programme_level"] == case_c_before["programme_level"]
    assert [
        row for row in after["transition_decisions"] if row["venture_id"] == "case-c"
    ] == case_c_transitions_before
    assert any(
        row["id"] == "tr-c-hist" and row["transition_type"] == "HISTORICAL_IMPORTED"
        for row in after["transition_decisions"]
    )


def test_p1_transition_ignores_blank_provenance_note(client):
    create_qa_venture(client)
    direct_entry(client, "qa-p1", provenance_note="   ")
    assert venture(state(client), "qa-p1")["programme_level_provenance"] == (
        "Reviewer-approved direct entry to Level 1"
    )


def test_p1_transition_record_keeps_reviewer_metadata(client):
    create_qa_venture(client)
    result = direct_entry(client, "qa-p1")
    payload = state(client)
    record = next(row for row in payload["transition_decisions"] if row["id"] == result["id"])
    assert record["approved_by"] == "Demo Programme Reviewer"
    assert record["reason"] == "P1 QA-only direct entry"
    assert isinstance(json.loads(record["criteria_snapshot_json"]), dict)
