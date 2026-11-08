import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, default_seed_path, load_seed_file, seed_from_dict

O = {"X-ILS-Role": "PROGRAMME_OWNER"}
R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
S = {"X-ILS-Role": "STUDENT_FOUNDER"}
M = {"X-ILS-Role": "MENTOR"}
X = {"X-ILS-Role": "INTRUDER"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "ils_p2.sqlite"
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


def create(client, payload):
    response = client.post("/api/ventures", json=payload, headers=O)
    assert response.status_code == 201, response.text
    return response.json()


def update_body(prefix, venture_id="case-a", line_id="bl-a-b2c", criterion_id="L0L1-AIB2C-2"):
    return {
        "id": f"{prefix}-U",
        "venture_id": venture_id,
        "business_line_id": line_id,
        "criterion_id": criterion_id,
        "summary_metric": "P2 role test claim",
        "summary_period": "P2 period",
        "claimed_metrics_json": {"qa_only": True},
        "evidence": {
            "id": f"{prefix}-E",
            "source_type": "Analytics Excerpt",
            "ledger_bucket": "USAGE_METRIC",
            "unit": "COUNT",
            "period_label": "P2 period",
        },
        "observations": [{
            "id": f"{prefix}-O",
            "criterion_id": criterion_id,
            "metric_type": "WAU",
            "period_label": "P2 period",
            "period_sequence": 1,
            "numeric_value": 11,
            "unit": "COUNT",
            "qualifier_status": "QUALIFIED",
        }],
        "blocker": "No blocker",
        "next_action": "P2 review",
    }


def qa_venture(venture_id="qa-p2"):
    return {
        "id": venture_id,
        "name": f"QA-only {venture_id}",
        "activity": "QA-only P2 fixture",
        "primary_business_model": "Services",
        "model_resolution_status": "CONFIRMED",
        "programme_level": "Level 2",
        "programme_level_provenance": "QA-only fixture",
        "business_lines": [{
            "id": f"{venture_id}-line",
            "line_name": "QA Services line",
            "track_role": "ACTIVE_GOVERNING",
            "candidate_models": ["Services"],
            "approved_model": "Services",
            "resolution_status": "CONFIRMED",
        }],
    }


def approve(client, evidence_id):
    response = client.post(
        f"/api/evidence/{evidence_id}/review",
        json={"decision": "APPROVED", "reviewer": "Demo Programme Reviewer", "reason": "P2 QA review"},
        headers=R,
    )
    assert response.status_code == 200, response.text


def test_p2_export_requires_authorized_role(client):
    for headers in (None, X, S, M):
        response = client.get("/api/export", headers=headers or {})
        assert response.status_code == 403, response.text
    for headers in (O, R):
        response = client.get("/api/export", headers=headers)
        assert response.status_code == 200, response.text
        assert len(response.json()) == 9


def test_p2_update_requires_a_recognized_role(client):
    assert client.post("/api/updates", json=update_body("P2-NO"), headers={}).status_code == 403
    assert client.post("/api/updates", json=update_body("P2-X"), headers=X).status_code == 403
    for index, headers in enumerate((O, R, S, M)):
        response = client.post("/api/updates", json=update_body(f"P2-R{index}", line_id="bl-a-b2c"), headers=headers)
        assert response.status_code == 201, response.text


def test_p2_import_advancement_defaults_to_unknown_and_preserves_explicit(client):
    create(client, {
        "id": "qa-p2-import-default",
        "name": "QA-only P2 import default",
        "activity": "QA-only import default",
        "model_resolution_status": "UNRESOLVED",
        "programme_level_provenance": "QA-only fixture",
    })
    create(client, {
        "id": "qa-p2-import-explicit",
        "name": "QA-only P2 import explicit",
        "activity": "QA-only import explicit",
        "model_resolution_status": "UNRESOLVED",
        "programme_level": "Level 2",
        "programme_level_provenance": "QA-only fixture",
        "advancement_status": "Historical direct entry to Level 2",
    })
    payload = state(client)
    default = next(row for row in payload["ventures"] if row["id"] == "qa-p2-import-default")
    explicit = next(row for row in payload["ventures"] if row["id"] == "qa-p2-import-explicit")
    assert default["advancement_status"] == "Unknown"
    assert explicit["advancement_status"] == "Historical direct entry to Level 2"
    assert not any(row["venture_id"] in ("qa-p2-import-default", "qa-p2-import-explicit") for row in payload["transition_decisions"])


def test_p2_ledger_derives_earned_period_and_completed_pilots(client):
    payload = state(client)
    case_c = next(row for row in payload["ledgers"] if row["venture_id"] == "case-c" and row["business_line_id"] == "bl-c-main")
    case_b_saas = next(row for row in payload["ledgers"] if row["venture_id"] == "case-b" and row["business_line_id"] == "bl-b-saas")
    assert case_c["earned_period"] == "Unknown"
    assert case_c["claimed_earned_period"] == "September"
    assert case_b_saas["completed_pilots"] is None

    create(client, qa_venture())
    response = client.post("/api/updates", json={
        "id": "P2-PILOT-U",
        "venture_id": "qa-p2",
        "business_line_id": "qa-p2-line",
        "criterion_id": "L1L2-SRV-1",
        "summary_metric": "P2 completed pilot",
        "summary_period": "P2 period",
        "claimed_metrics_json": {"qa_only": True},
        "evidence": {
            "id": "P2-PILOT-E",
            "source_type": "Pilot Completion Report",
            "ledger_bucket": "USAGE_METRIC",
            "unit": "COUNT",
            "period_label": "P2 period",
        },
        "observations": [{"id": "P2-PILOT-O", "criterion_id": "L1L2-SRV-1", "numeric_value": 1, "unit": "COUNT", "qualifier_status": "QUALIFIED", "period_label": "P2 period"}],
        "blocker": "No blocker",
        "next_action": "P2 review",
    }, headers=S)
    assert response.status_code == 201, response.text
    approve(client, "P2-PILOT-E")

    response = client.post("/api/updates", json={
        "id": "P2-EARNED-U",
        "venture_id": "qa-p2",
        "business_line_id": "qa-p2-line",
        "criterion_id": "L1L2-SRV-2",
        "summary_metric": "P2 earned amount with no period",
        "summary_period": "P2 period",
        "claimed_metrics_json": {"qa_only": True},
        "evidence": {
            "id": "P2-EARNED-E",
            "source_type": "Streaming Statement",
            "ledger_bucket": "EARNED",
            "amount_minor_or_count": 100000,
            "unit": "INR_PAISE",
            "period_label": "P2 period",
        },
        "observations": [],
        "blocker": "No blocker",
        "next_action": "P2 review",
    }, headers=S)
    assert response.status_code == 201, response.text
    approve(client, "P2-EARNED-E")

    response = client.post("/api/updates", json={
        "id": "P2-EARNED-CLAIM-U",
        "venture_id": "qa-p2",
        "business_line_id": "qa-p2-line",
        "criterion_id": "L1L2-SRV-2",
        "summary_metric": "P2 unreviewed October claim with no approved period",
        "summary_period": "P2 period",
        "claimed_metrics_json": {"qa_only": True},
        "evidence": {
            "id": "P2-EARNED-CLAIM-E",
            "source_type": "Streaming Statement",
            "ledger_bucket": "EARNED",
            "amount_minor_or_count": 200000,
            "unit": "INR_PAISE",
            "period_label": "P2 period",
            "earned_period": "October",
        },
        "observations": [],
        "blocker": "No blocker",
        "next_action": "P2 review",
    }, headers=S)
    assert response.status_code == 201, response.text

    payload = state(client)
    qa = next(row for row in payload["ledgers"] if row["venture_id"] == "qa-p2" and row["business_line_id"] == "qa-p2-line")
    assert qa["completed_pilots"] == 1
    assert qa["earned_period"] == "Unknown"
    assert qa["claimed_earned_period"] == "October"


def test_p2_import_endpoint_defaults_omitted_advancement_to_unknown(client):
    payload = client.get("/api/export", headers=O).json()
    omitted = next(row for row in payload["ventures"] if row["id"] == "case-a")
    omitted.pop("advancement_status", None)
    explicit = next(row for row in payload["ventures"] if row["id"] == "case-b")
    explicit["advancement_status"] = "Historical direct entry to Level 2"

    response = client.post("/api/import", json=payload, headers=O)
    assert response.status_code == 200, response.text
    imported = state(client)
    default = next(row for row in imported["ventures"] if row["id"] == "case-a")
    preserved = next(row for row in imported["ventures"] if row["id"] == "case-b")
    assert default["advancement_status"] == "Unknown"
    assert preserved["advancement_status"] == "Historical direct entry to Level 2"
