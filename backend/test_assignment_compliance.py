import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, default_seed_path, init_schema, load_seed_file, seed_from_dict

STUDENT = {"X-ILS-Role": "STUDENT_FOUNDER"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "ils_p0a.sqlite"
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


def by_id(rows, row_id):
    return next(row for row in rows if row["id"] == row_id)


def test_case_a_recorded_update_is_preserved(client):
    case_a = by_id(state(client)["ventures"], "case-a")
    assert case_a["recorded_update"] == "Pilot running; pursuing agency deals; no early customers; no sale."


def test_case_a_signup_observation_keeps_unknown_period(client):
    case_a_observation = by_id(state(client)["evidence_observations"], "A-E01-S1")
    assert case_a_observation["period_label"] is None

    body = {
        "id": "P0A-SIGNUP-U1",
        "venture_id": "case-a",
        "business_line_id": "bl-a-b2c",
        "criterion_id": "L0L1-AIB2C-1",
        "summary_metric": "32 sign-ups",
        "summary_period": "Week ending 4 October; Week ending 11 October",
        "claimed_metrics_json": {"signups": 32, "target_segment_membership": "not recorded"},
        "evidence": {
            "id": "P0A-SIGNUP-E1",
            "source_type": "Analytics Excerpt",
            "ledger_bucket": "USAGE_METRIC",
            "unit": "COUNT",
            "period_label": "Week ending 4 October; Week ending 11 October",
        },
        "observations": [
            {
                "id": "P0A-SIGNUP-O1",
                "criterion_id": "L0L1-AIB2C-1",
                "metric_type": "COUNT",
                "numeric_value": 32,
                "unit": "COUNT",
            }
        ],
        "blocker": "Target-segment membership of sign-ups not recorded",
        "next_action": "Record target-segment membership and re-verify",
    }
    response = client.post("/api/updates", json=body, headers=STUDENT)
    assert response.status_code == 201, response.text
    stored = by_id(state(client)["evidence_observations"], "P0A-SIGNUP-O1")
    assert stored["period_label"] is None


def test_case_b_evidence_dates_counterparty_and_details(client):
    evidence = state(client)["evidence_records"]
    b01 = by_id(evidence, "B-E01")
    b02 = by_id(evidence, "B-E02")
    b03 = by_id(evidence, "B-E03")
    assert b01["period_label"] == "10 October"
    assert "no payment commitment" in b01["detail_note"].lower()
    assert b02["period_label"] == "8 October"
    assert b02["counterparty"] == "Factory X"
    assert "marked unpaid" in b02["detail_note"].lower()
    assert b03["period_label"] == "11 October"
    assert b03["payment_date"] == "11 October"
    assert b03["counterparty"] == "Factory X"
    assert "partial" in b03["detail_note"].lower()


def test_case_b_baseline_only_on_services_line(client):
    payload = state(client)
    services = next(
        row
        for row in payload["ledgers"]
        if row["venture_id"] == "case-b" and row["business_line_id"] == "bl-b-services"
    )
    saas = next(
        row
        for row in payload["ledgers"]
        if row["venture_id"] == "case-b" and row["business_line_id"] == "bl-b-saas"
    )
    case_c_lines = [row for row in payload["ledgers"] if row["venture_id"] == "case-c"]
    assert services["historical_baseline_paise"] == 120000000
    assert saas["historical_baseline_paise"] is None
    assert all(row["historical_baseline_paise"] is None for row in case_c_lines)


def test_case_c_provenance_tracker_sector_and_counterparty(client):
    payload = state(client)
    case_c = by_id(payload["ventures"], "case-c")
    transition = next(row for row in payload["transitions"] if row["venture_id"] == "case-c")
    sponsor = by_id(payload["evidence_records"], "C-E03")
    assert "Programme owner clarification" in case_c["programme_level_provenance"]
    assert "Programme owner clarification" in transition["provenance_note"]
    assert case_c["tracker_sector"] == "Unknown"
    assert sponsor["counterparty"] == "Sponsor Y"
    assert transition["approved_by"] == "Unknown"
    assert transition["approved_at"] == "Unknown"


def test_schema_migration_preserves_existing_venture_rows(tmp_path):
    path = tmp_path / "legacy.sqlite"
    con = connect(path)
    con.execute("CREATE TABLE ventures (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
    con.execute("INSERT INTO ventures (id, name) VALUES ('legacy', 'Legacy Venture')")
    con.commit()

    init_schema(con)

    columns = {row[1] for row in con.execute("PRAGMA table_info(ventures)")}
    assert "recorded_update" in columns
    assert "historical_traction_business_line_id" in columns
    row = con.execute("SELECT id, name FROM ventures WHERE id = 'legacy'").fetchone()
    assert tuple(row) == ("legacy", "Legacy Venture")
    con.close()
