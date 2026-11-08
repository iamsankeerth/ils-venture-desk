import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, default_seed_path, load_seed_file, seed_from_dict

R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
O = {"X-ILS-Role": "PROGRAMME_OWNER"}
S = {"X-ILS-Role": "STUDENT_FOUNDER"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "ils_p0b.sqlite"
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


def criterion(payload, venture_id, line_id, criterion_id):
    return next(
        row
        for row in payload["evaluated_criteria"]
        if row["venture_id"] == venture_id
        and row.get("business_line_id") == line_id
        and row["criterion_id"] == criterion_id
    )


def ledger(payload, venture_id, line_id):
    return next(
        row
        for row in payload["ledgers"]
        if row["venture_id"] == venture_id and row["business_line_id"] == line_id
    )


def approve(client, evidence_id):
    response = client.post(
        f"/api/evidence/{evidence_id}/review",
        json={
            "decision": "APPROVED",
            "reviewer": "Demo Programme Reviewer",
            "reason": "QA-only P0-B review",
        },
        headers=R,
    )
    assert response.status_code == 200, response.text


def configure(client, criterion_id, value, rule):
    return client.post(
        f"/api/criteria/{criterion_id}/configure",
        json={"configured_value": value, "configured_rule": rule},
        headers=O,
    )


def submit(
    client,
    prefix,
    venture_id,
    line_id,
    criterion_id,
    source_type,
    ledger_bucket,
    unit,
    observations,
    amount=None,
    parent=None,
    supersedes=None,
    summary_period="QA-only period",
):
    evidence = {
        "id": f"{prefix}-E",
        "source_type": source_type,
        "ledger_bucket": ledger_bucket,
        "unit": unit,
        "period_label": summary_period,
        "detail_note": "QA-only P0-B fixture",
    }
    if amount is not None:
        evidence["amount_minor_or_count"] = amount
    if parent:
        evidence["parent_evidence_id"] = parent
    if supersedes:
        evidence["supersedes_evidence_id"] = supersedes
    body = {
        "id": f"{prefix}-U",
        "venture_id": venture_id,
        "business_line_id": line_id,
        "criterion_id": criterion_id,
        "summary_metric": "QA-only P0-B metric",
        "summary_period": summary_period,
        "claimed_metrics_json": {"qa_only": True},
        "evidence": evidence,
        "observations": observations,
        "blocker": "No blocker",
        "next_action": "QA-only review",
    }
    return client.post("/api/updates", json=body, headers=S)


def observation(
    prefix,
    criterion_id,
    numeric_value,
    qualifier_status="QUALIFIED",
    cohort_key=None,
    period_sequence=1,
    period_label="QA-only period",
    unit="COUNT",
    metric_type="COUNT",
):
    row = {
        "id": f"{prefix}-O",
        "criterion_id": criterion_id,
        "metric_type": metric_type,
        "numeric_value": numeric_value,
        "unit": unit,
        "qualifier_status": qualifier_status,
        "period_sequence": period_sequence,
        "period_label": period_label,
    }
    if cohort_key is not None:
        row["cohort_key"] = cohort_key
    return row


def test_p0b_evidence_type_policy_rejects_mismatches(client):
    mismatches = [
        ("P0B-TYPE-LOI", "L0L1-AIB2B-2", "bl-b-saas", "Signed LOI", "COLLECTED", "INR_PAISE", 1000000),
        ("P0B-TYPE-LOI-CASE", "L0L1-AIB2B-2", "bl-b-saas", "signed loi", "COLLECTED", "INR_PAISE", 1000000),
        ("P0B-TYPE-INV", "L0L1-SRV-3", "bl-b-services", "Invoice", "COLLECTED", "INR_PAISE", 1000000),
        ("P0B-TYPE-RCPT", "L0L1-SRV-3", "bl-b-services", "Payment Receipt", "BILLED", "INR_PAISE", 1000000),
        ("P0B-TYPE-NOAMT", "L0L1-SRV-3", "bl-b-services", "Invoice", "BILLED", "INR_PAISE", None),
    ]
    for prefix, crit, line, source, bucket, unit, amount in mismatches:
        response = submit(client, prefix, "case-b", line, crit, source, bucket, unit, [], amount=amount)
        assert response.status_code == 422, f"{prefix}: {response.status_code} {response.text}"

    valid = submit(
        client,
        "P0B-TYPE-VALID",
        "case-b",
        "bl-b-services",
        "L0L1-SRV-3",
        "Payment Receipt",
        "COLLECTED",
        "INR_PAISE",
        [],
        amount=1000000,
    )
    assert valid.status_code == 201, valid.text

    export = client.get("/api/export", headers=O).json()
    b01 = next(row for row in export["evidence_records"] if row["id"] == "B-E01")
    b01["ledger_bucket"] = "COLLECTED"
    b01["unit"] = "INR_PAISE"
    b01["amount_minor_or_count"] = 1000000
    imported = client.post("/api/import", json=export, headers=O)
    assert imported.status_code == 422, imported.text
    after = state(client)
    b01_after = next(row for row in after["evidence_records"] if row["id"] == "B-E01")
    assert b01_after["ledger_bucket"] == "COMMERCIAL_INTENT"
    assert b01_after["unit"] == "COUNT"


def test_p0b_signed_loi_not_cash_or_completed_pilot(client):
    approve(client, "B-E01")
    payload = state(client)
    assert criterion(payload, "case-b", "bl-b-saas", "L0L1-AIB2B-2")["criterion_result"] == "MET"
    assert criterion(payload, "case-b", "bl-b-saas", "L1L2-AIB2B-2")["criterion_result"] == "UNKNOWN"
    saas = ledger(payload, "case-b", "bl-b-saas")
    assert saas["signed_lois"] == 1
    assert saas["billed_paise"] is None and saas["collected_paise"] is None

    response = submit(
        client,
        "P0B-LOI-PILOT",
        "case-b",
        "bl-b-saas",
        "L1L2-AIB2B-2",
        "Signed LOI",
        "COMMERCIAL_INTENT",
        "COUNT",
        [observation("P0B-LOI-PILOT", "L1L2-AIB2B-2", 1, metric_type="COMPLETED_PILOTS")],
    )
    assert response.status_code == 201, response.text
    approve(client, "P0B-LOI-PILOT-E")
    payload = state(client)
    assert criterion(payload, "case-b", "bl-b-saas", "L1L2-AIB2B-2")["criterion_result"] == "UNKNOWN"


def test_p0b_qualifier_policy(client):
    cases = [
        ("P0B-Q-SRV1", "L0L1-SRV-1", "bl-b-services", 5, "PRICED_YES"),
        ("P0B-Q-SRV2", "L0L1-SRV-2", "bl-b-services", 2, "PAYING"),
        ("P0B-Q-AIB2B1", "L0L1-AIB2B-1", "bl-b-saas", 5, "BUDGET_HOLDER"),
    ]
    for prefix, crit, line, value, good in cases:
        bad = submit(
            client,
            f"{prefix}-BAD",
            "case-b",
            line,
            crit,
            "Mentor Note",
            "USAGE_METRIC",
            "COUNT",
            [observation(f"{prefix}-BAD", crit, value, qualifier_status="PROSPECT")],
        )
        assert bad.status_code == 422, f"{prefix} bad qualifier: {bad.status_code} {bad.text}"
        good_response = submit(
            client,
            f"{prefix}-GOOD",
            "case-b",
            line,
            crit,
            "Mentor Note",
            "USAGE_METRIC",
            "COUNT",
            [observation(f"{prefix}-GOOD", crit, value, qualifier_status=good)],
        )
        assert good_response.status_code == 201, good_response.text
        approve(client, f"{prefix}-GOOD-E")
        payload = state(client)
        assert criterion(payload, "case-b", line, crit)["criterion_result"] == "MET"


def test_p0b_three_week_active_window(client):
    first = submit(
        client,
        "P0B-WINDOW-1",
        "case-a",
        "bl-a-b2c",
        "L1L2-AIB2C-2",
        "Analytics Excerpt",
        "USAGE_METRIC",
        "COUNT",
        [observation("P0B-WINDOW-1", "L1L2-AIB2C-2", 5, cohort_key="QA-cohort", period_sequence=1, period_label="Week 1")],
    )
    assert first.status_code == 201, first.text
    approve(client, "P0B-WINDOW-1-E")
    payload = state(client)
    assert criterion(payload, "case-a", "bl-a-b2c", "L1L2-AIB2C-2")["criterion_result"] != "MET"

    second = submit(
        client,
        "P0B-WINDOW-3",
        "case-a",
        "bl-a-b2c",
        "L1L2-AIB2C-2",
        "Analytics Excerpt",
        "USAGE_METRIC",
        "COUNT",
        [observation("P0B-WINDOW-3", "L1L2-AIB2C-2", 5, cohort_key="QA-cohort", period_sequence=3, period_label="Week 3")],
    )
    assert second.status_code == 201, second.text
    approve(client, "P0B-WINDOW-3-E")
    payload = state(client)
    assert criterion(payload, "case-a", "bl-a-b2c", "L1L2-AIB2C-2")["criterion_result"] == "MET"


def test_p0b_retention_requires_cohort_and_window(client):
    incomplete = configure(client, "MSL-SRV-3", 35, {"aggregation_method": "PERCENT"})
    assert incomplete.status_code == 422, incomplete.text
    payload = state(client)
    assert criterion(payload, "case-c", "bl-c-main", "MSL-SRV-3")["criterion_result"] == "BLOCKED"

    complete = configure(
        client,
        "MSL-SRV-3",
        35,
        {"aggregation_method": "PERCENT", "cohort_definition": "QA-cohort", "window_weeks": 3},
    )
    assert complete.status_code == 200, complete.text

    wrong_cohort = submit(
        client,
        "P0B-RET-WRONG",
        "case-c",
        "bl-c-main",
        "MSL-SRV-3",
        "Mentor Note",
        "USAGE_METRIC",
        None,
        [
            observation(
                "P0B-RET-WRONG",
                "MSL-SRV-3",
                35,
                cohort_key="other-cohort",
                period_sequence=3,
                period_label="Week 3",
                unit="PERCENT",
                metric_type="RETENTION",
            )
        ],
    )
    assert wrong_cohort.status_code == 201, wrong_cohort.text
    approve(client, "P0B-RET-WRONG-E")
    payload = state(client)
    assert criterion(payload, "case-c", "bl-c-main", "MSL-SRV-3")["criterion_result"] != "MET"

    valid = submit(
        client,
        "P0B-RET-VALID",
        "case-c",
        "bl-c-main",
        "MSL-SRV-3",
        "Mentor Note",
        "USAGE_METRIC",
        None,
        [
            observation(
                "P0B-RET-VALID",
                "MSL-SRV-3",
                35,
                cohort_key="QA-cohort",
                period_sequence=3,
                period_label="Week 3",
                unit="PERCENT",
                metric_type="RETENTION",
            )
        ],
    )
    assert valid.status_code == 201, valid.text
    approve(client, "P0B-RET-VALID-E")
    payload = state(client)
    assert criterion(payload, "case-c", "bl-c-main", "MSL-SRV-3")["criterion_result"] == "MET"


def test_p0b_missing_numeric_stays_unknown(client):
    wau = submit(
        client,
        "P0B-NULL-WAU",
        "case-a",
        "bl-a-b2c",
        "L0L1-AIB2C-2",
        "Analytics Excerpt",
        "USAGE_METRIC",
        "COUNT",
        [observation("P0B-NULL-WAU", "L0L1-AIB2C-2", None, period_sequence=3, period_label="Week ending 18 October", metric_type="WAU")],
    )
    assert wau.status_code == 201, wau.text
    approve(client, "P0B-NULL-WAU-E")
    payload = state(client)
    assert criterion(payload, "case-a", "bl-a-b2c", "L0L1-AIB2C-2")["criterion_result"] == "UNKNOWN"

    count = submit(
        client,
        "P0B-NULL-COUNT",
        "case-b",
        "bl-b-services",
        "L0L1-SRV-1",
        "Mentor Note",
        "USAGE_METRIC",
        "COUNT",
        [observation("P0B-NULL-COUNT", "L0L1-SRV-1", None, qualifier_status="PRICED_YES")],
    )
    assert count.status_code == 201, count.text
    approve(client, "P0B-NULL-COUNT-E")
    payload = state(client)
    assert criterion(payload, "case-b", "bl-b-services", "L0L1-SRV-1")["criterion_result"] == "UNKNOWN"


def test_p0b_explicit_zero_preserved(client):
    approve(client, "B-E02")
    zero = submit(
        client,
        "P0B-ZERO",
        "case-b",
        "bl-b-services",
        "L0L1-SRV-3",
        "Payment Receipt",
        "COLLECTED",
        "INR_PAISE",
        [],
        amount=0,
        parent="B-E02",
        summary_period="11 October",
    )
    assert zero.status_code == 201, zero.text
    approve(client, "P0B-ZERO-E")
    payload = state(client)
    cash = criterion(payload, "case-b", "bl-b-services", "L0L1-SRV-3")
    assert cash["criterion_result"] == "IN_PROGRESS"
    assert cash["verified_readings"] == [0]
    services = ledger(payload, "case-b", "bl-b-services")
    assert services["collected_paise"] == 0
    assert services["billed_paise"] == 10000000
    assert services["arithmetic_difference_paise"] == 10000000


def test_p0b_superseded_evidence_not_double_counted(client):
    original = submit(
        client,
        "P0B-SUP-ORIG",
        "case-b",
        "bl-b-services",
        "L0L1-SRV-3",
        "Payment Receipt",
        "COLLECTED",
        "INR_PAISE",
        [],
        amount=1000000,
    )
    assert original.status_code == 201, original.text
    approve(client, "P0B-SUP-ORIG-E")

    replacement = submit(
        client,
        "P0B-SUP-NEW",
        "case-b",
        "bl-b-services",
        "L0L1-SRV-3",
        "Payment Receipt",
        "COLLECTED",
        "INR_PAISE",
        [],
        amount=500000,
        supersedes="P0B-SUP-ORIG-E",
    )
    assert replacement.status_code == 201, replacement.text
    approve(client, "P0B-SUP-NEW-E")

    payload = state(client)
    cash = criterion(payload, "case-b", "bl-b-services", "L0L1-SRV-3")
    assert cash["verified_readings"] == [500000]
    assert cash["criterion_result"] == "IN_PROGRESS"
    services = ledger(payload, "case-b", "bl-b-services")
    assert services["collected_paise"] == 500000


def test_p0b_met_evidence_ids_and_c_e03_ledger_only(client):
    approve(client, "C-E01")
    approve(client, "C-E02")
    approve(client, "C-E03")
    payload = state(client)
    cash = criterion(payload, "case-c", "bl-c-main", "L0L1-SRV-3")
    assert cash["criterion_result"] == "MET"
    assert "C-E02" in cash["related_evidence_ids"]
    second_cash = criterion(payload, "case-c", "bl-c-main", "L1L2-SRV-2")
    assert "C-E01" in second_cash["related_evidence_ids"]
    assert "C-E02" in second_cash["related_evidence_ids"]
    assert "C-E03" not in second_cash["related_evidence_ids"]
    c03 = next(row for row in payload["evidence_records"] if row["id"] == "C-E03")
    assert c03["criterion_id"] is None
    assert c03["counterparty"] == "Sponsor Y"
    assert c03["ledger_bucket"] == "BILLED"
    main = ledger(payload, "case-c", "bl-c-main")
    assert main["billed_paise"] == 12000000
    assert main["earned_paise"] == 8000000
    assert main["collected_paise"] == 7000000
    assert main["arithmetic_difference_paise"] == 1000000


def test_p0b_a01_timestamp_is_seed_metadata(client):
    payload = state(client)
    update = next(row for row in payload["progress_updates"] if row["id"] == "A-01")
    assert update["submitted_at"] == "2026-01-10T10:00:00"
