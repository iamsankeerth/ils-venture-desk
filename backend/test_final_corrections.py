import json

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, default_seed_path, load_seed_file, seed_from_dict
from backend.test_acceptance import _make_met_venture

O = {"X-ILS-Role": "PROGRAMME_OWNER"}
R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
S = {"X-ILS-Role": "STUDENT_FOUNDER"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "ils_final.sqlite"
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


def catalog_row(payload, criterion_id):
    return next(row for row in payload["criteria_catalog"] if row["id"] == criterion_id)


CRITERION_CONTEXT = {
    "L1L2-AIB2C-1": ("case-a", "bl-a-b2c"),
    "MSL-AIB2B-4": ("case-a", "bl-a-b2b"),
}


def evaluated(payload, criterion_id, venture_id="case-c", line_id="bl-c-main"):
    return next(
        row for row in payload["evaluated_criteria"]
        if row["venture_id"] == venture_id
        and row.get("business_line_id") == line_id
        and row["criterion_id"] == criterion_id
    )


def create_qa(client, venture_id, level):
    response = client.post("/api/ventures", json={
        "id": venture_id,
        "name": f"QA-only {venture_id}",
        "activity": "QA-only final correction fixture",
        "primary_business_model": "Services",
        "model_resolution_status": "CONFIRMED",
        "programme_level": level,
        "programme_level_provenance": "QA-only fixture",
        "business_lines": [{
            "id": f"{venture_id}-line",
            "line_name": "QA Services line",
            "track_role": "ACTIVE_GOVERNING",
            "candidate_models": ["Services"],
            "approved_model": "Services",
            "resolution_status": "CONFIRMED",
        }],
    }, headers=O)
    assert response.status_code == 201, response.text


def direct_entry(client, venture_id, to_level):
    return client.post(f"/api/ventures/{venture_id}/transitions", json={
        "to_level": to_level,
        "transition_type": "DIRECT_ENTRY",
        "approved_by": "Demo Programme Reviewer",
        "reason": "QA-only final correction probe",
    }, headers=R)


def approve(client, evidence_id):
    response = client.post(f"/api/evidence/{evidence_id}/review", json={
        "decision": "APPROVED",
        "reviewer": "Demo Programme Reviewer",
        "reason": "QA-only final correction review",
    }, headers=R)
    assert response.status_code == 200, response.text


def test_direct_entry_rejects_downward_target_without_write(client):
    create_qa(client, "qa-final-down", "Level 2")
    before = state(client)
    case_c_before = [
        row for row in before["transition_decisions"] if row["venture_id"] == "case-c"
    ]
    response = direct_entry(client, "qa-final-down", "Level 1")
    assert response.status_code in (400, 422), response.text

    after = state(client)
    qa = venture(after, "qa-final-down")
    assert qa["programme_level"] == "Level 2"
    assert not any(
        row["venture_id"] == "qa-final-down" for row in after["transition_decisions"]
    )
    assert [
        row for row in after["transition_decisions"] if row["venture_id"] == "case-c"
    ] == case_c_before


@pytest.mark.parametrize(
    "venture_id,start_level,to_level",
    [
        ("qa-final-unknown", "Unknown", "Level 2"),
        ("qa-final-zero", "Level 0", "Level 2"),
        ("qa-final-one", "Level 1", "Level 2"),
    ],
)
def test_direct_entry_allows_unknown_and_upward_targets(client, venture_id, start_level, to_level):
    create_qa(client, venture_id, start_level)
    response = direct_entry(client, venture_id, to_level)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["transition_type"] == "DIRECT_ENTRY"
    assert body["to_level"] == to_level
    assert body["approved_by"] == "Demo Programme Reviewer"
    assert body["approved_at"]
    payload = state(client)
    record = next(row for row in payload["transition_decisions"] if row["id"] == body["id"])
    assert record["reason"] == "QA-only final correction probe"
    assert venture(payload, venture_id)["programme_level"] == to_level


def test_direct_entry_same_level_remains_allowed(client):
    create_qa(client, "qa-final-same", "Level 2")
    response = direct_entry(client, "qa-final-same", "Level 2")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["from_level"] == "Level 2"
    assert body["to_level"] == "Level 2"


def test_standard_advancement_remains_valid_when_all_criteria_met(client):
    _make_met_venture(client)
    response = client.post("/api/ventures/case-t/transitions", json={
        "to_level": "Level 1",
        "transition_type": "STANDARD_ADVANCEMENT",
        "approved_by": "Demo Programme Reviewer",
        "reason": "All Level 0 criteria are met",
    }, headers=R)
    assert response.status_code == 200, response.text
    assert venture(state(client), "case-t")["programme_level"] == "Level 1"


INVALID_CONFIGS = [
    ("cash-missing-basis", "MSL-SRV-2", 20_000_000, {
        "aggregation_method": "SUM", "period": "All supplied periods",
    }),
    ("cash-missing-period", "MSL-SRV-2", 20_000_000, {
        "aggregation_method": "SUM", "metric_basis": "COLLECTED",
    }),
    ("cash-unsupported-method", "MSL-SRV-2", 20_000_000, {
        "aggregation_method": "PERCENT", "metric_basis": "COLLECTED",
        "period": "All supplied periods",
    }),
    ("retention-missing-cohort", "MSL-SRV-3", 30, {
        "aggregation_method": "PERCENT", "window_weeks": 3,
    }),
    ("retention-bad-window", "MSL-SRV-3", 30, {
        "aggregation_method": "PERCENT", "cohort_definition": "QA-cohort",
        "window_weeks": 0,
    }),
    ("retention-out-of-range", "MSL-SRV-3", 130, {
        "aggregation_method": "PERCENT", "cohort_definition": "QA-cohort",
        "window_weeks": 3,
    }),
    ("wau-missing-window", "L1L2-AIB2C-1", 35, {
        "aggregation_method": "SUSTAINED_MIN",
    }),
    ("wau-unsupported-method", "L1L2-AIB2C-1", 35, {
        "aggregation_method": "SUM", "window_weeks": 4,
    }),
    ("count-missing-range", "MSL-SRV-1", 10, {
        "aggregation_method": "DISTINCT_ENTITY",
    }),
    ("count-low-above-high", "MSL-SRV-1", 10, {
        "aggregation_method": "DISTINCT_ENTITY", "range_low": 20, "range_high": 10,
    }),
    ("count-fractional-range", "MSL-SRV-1", 10, {
        "aggregation_method": "DISTINCT_ENTITY", "range_low": 1.5, "range_high": 20,
    }),
    ("count-value-outside-range", "MSL-SRV-1", 25, {
        "aggregation_method": "DISTINCT_ENTITY", "range_low": 10, "range_high": 20,
    }),
    ("pilot-missing-qualification", "MSL-AIB2B-4", 2, {
        "aggregation_method": "QUALIFYING_PILOTS",
    }),
    ("pilot-unsupported-qualification", "MSL-AIB2B-4", 2, {
        "aggregation_method": "QUALIFYING_PILOTS", "pilot_qualification": "N/A",
    }),
    ("non-configurable-qualitative", "L0-Q1", None, {
        "aggregation_method": "SUM",
    }),
    ("missing-value", "MSL-SRV-2", None, {
        "aggregation_method": "SUM", "metric_basis": "COLLECTED",
        "period": "All supplied periods",
    }),
    ("rule-not-object", "MSL-SRV-1", 10, []),
    ("unknown-rule-field", "MSL-SRV-2", 20_000_000, {
        "aggregation_method": "SUM", "metric_basis": "COLLECTED",
        "period": "All supplied periods", "range_low": 10,
    }),
]


@pytest.mark.parametrize(
    "criterion_id,value,rule",
    [(case[1], case[2], case[3]) for case in INVALID_CONFIGS],
    ids=[case[0] for case in INVALID_CONFIGS],
)
def test_invalid_configuration_is_rejected_without_write(client, criterion_id, value, rule):
    before = state(client)
    before_row = catalog_row(before, criterion_id)
    context = CRITERION_CONTEXT.get(criterion_id, ("case-c", "bl-c-main"))
    before_result = (
        evaluated(before, criterion_id, *context)["criterion_result"]
        if criterion_id != "L0-Q1" else None
    )
    response = client.post(f"/api/criteria/{criterion_id}/configure", json={
        "actor": "Demo Programme Owner",
        "configured_value": value,
        "configured_rule": rule,
    }, headers=O)
    assert response.status_code == 422, response.text

    after = state(client)
    after_row = catalog_row(after, criterion_id)
    assert after_row == before_row
    if before_result is not None:
        assert evaluated(after, criterion_id, *context)["criterion_result"] == before_result
        assert before_result == "BLOCKED"


def test_cash_period_configuration_filters_approved_evidence(client):
    create_qa(client, "qa-final-period", "Level 1")
    response = client.post("/api/criteria/L1L2-SRV-2/configure", json={
        "actor": "Demo Programme Owner",
        "configured_value": 12_500_000,
        "configured_rule": {
            "aggregation_method": "SUM",
            "metric_basis": "COLLECTED",
            "period": "September",
        },
    }, headers=O)
    assert response.status_code == 200, response.text

    for label, amount in (("September", 7_000_000), ("October", 6_000_000)):
        response = client.post("/api/updates", json={
            "id": f"QA-FINAL-PERIOD-{label}-U",
            "venture_id": "qa-final-period",
            "business_line_id": "qa-final-period-line",
            "criterion_id": "L1L2-SRV-2",
            "summary_metric": "QA-only cash period",
            "summary_period": label,
            "claimed_metrics_json": {"qa_only": True},
            "evidence": {
                "id": f"QA-FINAL-PERIOD-{label}-E",
                "source_type": "Payment Receipt",
                "ledger_bucket": "COLLECTED",
                "amount_minor_or_count": amount,
                "unit": "INR_PAISE",
                "period_label": label,
            },
            "observations": [],
            "blocker": "No blocker",
            "next_action": "QA-only cash review",
        }, headers=S)
        assert response.status_code == 201, response.text
        approve(client, f"QA-FINAL-PERIOD-{label}-E")

    payload = state(client)
    september = evaluated(payload, "L1L2-SRV-2", "qa-final-period", "qa-final-period-line")
    assert september["criterion_result"] == "IN_PROGRESS"
    assert september["verified_readings"] == [7_000_000]

    response = client.post("/api/criteria/L1L2-SRV-2/configure", json={
        "actor": "Demo Programme Owner",
        "configured_value": 12_500_000,
        "configured_rule": {
            "aggregation_method": "SUM",
            "metric_basis": "COLLECTED",
            "period": "All supplied periods",
        },
    }, headers=O)
    assert response.status_code == 200, response.text
    all_periods = evaluated(state(client), "L1L2-SRV-2", "qa-final-period", "qa-final-period-line")
    assert all_periods["criterion_result"] == "MET"
    assert all_periods["verified_readings"] == [13_000_000]


VALID_CONFIGS = [
    ("MSL-SRV-2", 20_000_000, {
        "aggregation_method": "SUM", "metric_basis": "COLLECTED",
        "period": "All supplied periods",
    }),
    ("L1L2-SRV-2", 12_500_000, {
        "aggregation_method": "SUM", "metric_basis": "COLLECTED",
        "period": "All supplied periods",
    }),
    ("MSL-SRV-3", 30, {
        "aggregation_method": "PERCENT", "cohort_definition": "QA-cohort",
        "window_weeks": 3,
    }),
    ("L1L2-AIB2C-1", 35, {
        "aggregation_method": "SUSTAINED_MIN", "window_weeks": 4,
    }),
    ("MSL-SRV-1", 10, {
        "aggregation_method": "DISTINCT_ENTITY", "range_low": 10, "range_high": 20,
    }),
    ("MSL-AIB2B-4", 2, {
        "aggregation_method": "QUALIFYING_PILOTS",
        "pilot_qualification": "Pilot completion report",
    }),
]


@pytest.mark.parametrize(
    "criterion_id,value,rule",
    VALID_CONFIGS,
    ids=[case[0] for case in VALID_CONFIGS],
)
def test_valid_configuration_is_accepted_and_evaluated(client, criterion_id, value, rule):
    response = client.post(f"/api/criteria/{criterion_id}/configure", json={
        "actor": "Demo Programme Owner",
        "configured_value": value,
        "configured_rule": rule,
    }, headers=O)
    assert response.status_code == 200, response.text
    row = catalog_row(state(client), criterion_id)
    assert row["configured_value"] == value
    assert json.loads(row["configured_rule_json"]) == rule
    assert row["configured_at"]
    assert row["configured_by"] == "Demo Programme Owner"
    if criterion_id != "L0-Q1":
        context = CRITERION_CONTEXT.get(criterion_id, ("case-c", "bl-c-main"))
        assert evaluated(state(client), criterion_id, *context)["criterion_result"] != "BLOCKED"
