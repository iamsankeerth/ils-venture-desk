import pytest
from fastapi.testclient import TestClient

from backend.app import app, db_path
from backend.db import connect, default_seed_path, load_seed_file, seed_from_dict

R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
O = {"X-ILS-Role": "PROGRAMME_OWNER"}
S = {"X-ILS-Role": "STUDENT_FOUNDER"}

QA_VENTURE = {
    "id": "qa-msl",
    "name": "QA-only MSL fixture",
    "activity": "QA-only Services venture for MSL verification",
    "primary_business_model": "Services",
    "model_resolution_status": "CONFIRMED",
    "programme_level": "Level 2",
    "programme_level_provenance": "QA-only fixture",
    "business_lines": [
        {
            "id": "qa-msl-line",
            "line_name": "QA Services line",
            "track_role": "ACTIVE_GOVERNING",
            "candidate_models": ["Services"],
            "approved_model": "Services",
            "resolution_status": "CONFIRMED",
        }
    ],
}

QA_PRESERVED_SAAS = {
    "id": "qa-msl-saas",
    "line_name": "QA preserved SaaS line",
    "track_role": "HISTORICAL_PRESERVED",
    "candidate_models": ["AI_B2B"],
    "approved_model": None,
    "resolution_status": "HISTORICAL_PRESERVED",
}

QA_AMBIGUOUS = {
    "id": "qa-ambiguous",
    "name": "QA-only ambiguous model fixture",
    "activity": "QA-only venture with two compatible lines",
    "model_resolution_status": "UNRESOLVED",
    "programme_level_provenance": "QA-only fixture",
    "business_lines": [
        {
            "id": "qa-ambiguous-1",
            "line_name": "QA ambiguous line 1",
            "track_role": "ASSIGNED_IN_TRACKER",
            "candidate_models": ["AI_B2B"],
        },
        {
            "id": "qa-ambiguous-2",
            "line_name": "QA ambiguous line 2",
            "track_role": "CANDIDATE",
            "candidate_models": ["AI_B2B"],
        },
    ],
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "ils_p0c.sqlite"
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


def criterion(payload, venture_id, line_id, criterion_id):
    return next(
        row
        for row in payload["evaluated_criteria"]
        if row["venture_id"] == venture_id
        and row.get("business_line_id") == line_id
        and row["criterion_id"] == criterion_id
    )


def create(client, payload):
    return client.post("/api/ventures", json=payload, headers=O)


def configure(client, criterion_id, value, rule, actor="Demo Programme Owner"):
    return client.post(
        f"/api/criteria/{criterion_id}/configure",
        json={"actor": actor, "configured_value": value, "configured_rule": rule},
        headers=O,
    )


def approve(client, evidence_id):
    response = client.post(
        f"/api/evidence/{evidence_id}/review",
        json={
            "decision": "APPROVED",
            "reviewer": "Demo Programme Reviewer",
            "reason": "QA-only P0-C review",
        },
        headers=R,
    )
    assert response.status_code == 200, response.text


def submit(
    client,
    prefix,
    criterion_id,
    observations,
    line_id=None,
    source_type="Mentor Note",
    ledger_bucket="USAGE_METRIC",
    unit=None,
    amount=None,
    venture_id=None,
):
    evidence = {
        "id": f"{prefix}-E",
        "source_type": source_type,
        "ledger_bucket": ledger_bucket,
        "unit": unit,
        "period_label": "QA-only period",
        "detail_note": "QA-only P0-C fixture",
    }
    if amount is not None:
        evidence["amount_minor_or_count"] = amount
    body = {
        "id": f"{prefix}-U",
        "venture_id": venture_id or QA_VENTURE["id"],
        "criterion_id": criterion_id,
        "summary_metric": "QA-only P0-C metric",
        "summary_period": "QA-only period",
        "claimed_metrics_json": {"qa_only": True},
        "evidence": evidence,
        "observations": observations,
        "blocker": "No blocker",
        "next_action": "QA-only review",
    }
    if line_id:
        body["business_line_id"] = line_id
    response = client.post("/api/updates", json=body, headers=S)
    assert response.status_code == 201, response.text
    approve(client, f"{prefix}-E")


def qualitative(prefix, criterion_id):
    return {
        "id": f"{prefix}-O",
        "criterion_id": criterion_id,
        "metric_type": "QUALITATIVE",
        "qualifier_status": "met",
        "qualitative_value_json": {"met": True},
        "period_label": "QA-only period",
    }


def build_msl_fixture(client, preserved_saas=False):
    payload = dict(QA_VENTURE)
    payload["business_lines"] = list(QA_VENTURE["business_lines"])
    if preserved_saas:
        payload["business_lines"] = payload["business_lines"] + [dict(QA_PRESERVED_SAAS)]
    response = create(client, payload)
    assert response.status_code == 201, response.text

    assert configure(client, "MSL-SRV-1", 10, {"aggregation_method": "DISTINCT_ENTITY", "range_low": 10, "range_high": 20}).status_code == 200
    assert configure(client, "MSL-SRV-2", 20000000, {"aggregation_method": "SUM", "metric_basis": "COLLECTED", "period": "QA-only period"}).status_code == 200
    assert configure(client, "MSL-SRV-3", 30, {"aggregation_method": "PERCENT", "cohort_definition": "QA-cohort", "window_weeks": 3}).status_code == 200

    for index in range(1, 6):
        crit = f"MSL-COM-{index}"
        submit(client, f"QA-{crit}", crit, [qualitative(f"QA-{crit}", crit)])

    submit(client, "QA-MSL-SRV-4", "MSL-SRV-4", [qualitative("QA-MSL-SRV-4", "MSL-SRV-4")], line_id="qa-msl-line")
    submit(
        client,
        "QA-MSL-SRV-1",
        "MSL-SRV-1",
        [{"id": "QA-MSL-SRV-1-O", "criterion_id": "MSL-SRV-1", "metric_type": "COUNT", "numeric_value": 10, "unit": "COUNT", "qualifier_status": "QUALIFIED", "period_label": "QA-only period"}],
        line_id="qa-msl-line",
        unit="COUNT",
    )
    submit(
        client,
        "QA-MSL-SRV-2",
        "MSL-SRV-2",
        [],
        line_id="qa-msl-line",
        source_type="Payment Receipt",
        ledger_bucket="COLLECTED",
        unit="INR_PAISE",
        amount=20000000,
    )
    submit(
        client,
        "QA-MSL-SRV-3",
        "MSL-SRV-3",
        [{"id": "QA-MSL-SRV-3-O", "criterion_id": "MSL-SRV-3", "metric_type": "RETENTION", "numeric_value": 30, "unit": "PERCENT", "qualifier_status": "QUALIFIED", "cohort_key": "QA-cohort", "period_sequence": 3, "period_label": "Week 3"}],
        line_id="qa-msl-line",
    )


def certify_venture(client, venture_id, reason="QA-only full checklist verified"):
    return client.post(
        f"/api/ventures/{venture_id}/msl-eligibility",
        json={"approved_by": "Demo Programme Reviewer", "reason": reason},
        headers=R,
    )


def certify(client, reason="QA-only full checklist verified"):
    return certify_venture(client, "qa-msl", reason)


def sql(client, query, params=()):
    con = connect(db_path())
    try:
        con.execute(query, params)
        con.commit()
    finally:
        con.close()


def replace_criterion_id(old_id, new_id):
    con = connect(db_path())
    try:
        old = con.execute("SELECT * FROM criteria_catalog WHERE id=?", (old_id,)).fetchone()
        assert old is not None
        columns = [row[1] for row in con.execute("PRAGMA table_info(criteria_catalog)")]
        values = [(new_id if column == "id" else old[column]) for column in columns]
        con.execute(
            f"INSERT INTO criteria_catalog ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
            values,
        )
        for table in ("progress_updates", "evidence_records", "evidence_observations"):
            con.execute(
                f"UPDATE {table} SET criterion_id=? WHERE criterion_id=?", (new_id, old_id)
            )
        con.execute("DELETE FROM criteria_catalog WHERE id=?", (old_id,))
        con.commit()
    finally:
        con.close()


def build_common_msl_fixture(client, venture_id, model):
    payload = {
        "id": venture_id,
        "name": f"QA-only {model} common MSL fixture",
        "activity": f"QA-only {model} common-only MSL verification",
        "primary_business_model": model,
        "model_resolution_status": "CONFIRMED",
        "programme_level": "Level 2",
        "programme_level_provenance": "QA-only fixture",
        "business_lines": [
            {
                "id": f"{venture_id}-line",
                "line_name": f"QA {model} line",
                "track_role": "ACTIVE_GOVERNING",
                "candidate_models": [model],
                "approved_model": model,
                "resolution_status": "CONFIRMED",
            }
        ],
    }
    assert create(client, payload).status_code == 201
    for index in range(1, 6):
        crit = f"MSL-COM-{index}"
        submit(
            client,
            f"QA-{venture_id}-{crit}",
            crit,
            [qualitative(f"QA-{venture_id}-{crit}", crit)],
            venture_id=venture_id,
        )


def decision_count(client):
    return len(state(client)["msl_eligibility_decisions"])


def error_detail(response):
    detail = response.json().get("detail")
    if isinstance(detail, dict):
        return detail.get("error", ""), detail.get("blocking_reasons", [])
    return detail or "", []


def test_p0c_clarify_model_rejects_incompatible_line(client):
    response = client.post(
        "/api/ventures/case-a/seam-actions",
        json={"action": "CLARIFY_MODEL", "approved_model": "AI_B2B", "business_line_id": "bl-a-b2c"},
        headers=O,
    )
    assert response.status_code == 422, response.text
    error, _ = error_detail(response)
    assert "not compatible" in error
    assert "bl-a-b2c" in error
    payload = state(client)
    case_a = by_id(payload["ventures"], "case-a")
    assert case_a["primary_business_model"] is None
    assert case_a["model_resolution_status"] == "UNRESOLVED"
    lines = {row["id"]: row for row in payload["venture_business_lines"] if row["venture_id"] == "case-a"}
    assert lines["bl-a-b2c"]["track_role"] == "ASSIGNED_IN_TRACKER"
    assert lines["bl-a-b2b"]["track_role"] == "CANDIDATE"

    valid = client.post(
        "/api/ventures/case-a/seam-actions",
        json={"action": "CLARIFY_MODEL", "approved_model": "AI_B2B", "business_line_id": "bl-a-b2b"},
        headers=O,
    )
    assert valid.status_code == 200, valid.text
    payload = state(client)
    case_a = by_id(payload["ventures"], "case-a")
    lines = {row["id"]: row for row in payload["venture_business_lines"] if row["venture_id"] == "case-a"}
    assert case_a["primary_business_model"] == "AI_B2B"
    assert case_a["model_resolution_status"] == "CONFIRMED"
    assert lines["bl-a-b2b"]["track_role"] == "ACTIVE_GOVERNING"
    assert lines["bl-a-b2c"]["track_role"] == "HISTORICAL_PRESERVED"


def test_p0c_clarify_model_requires_explicit_line_when_ambiguous(client):
    assert create(client, QA_AMBIGUOUS).status_code == 201
    ambiguous = client.post(
        "/api/ventures/qa-ambiguous/seam-actions",
        json={"action": "CLARIFY_MODEL", "approved_model": "AI_B2B"},
        headers=O,
    )
    assert ambiguous.status_code == 422, ambiguous.text
    error, _ = error_detail(ambiguous)
    assert "Multiple business lines" in error
    assert "choose one explicitly" in error
    payload = state(client)
    venture = by_id(payload["ventures"], "qa-ambiguous")
    assert venture["primary_business_model"] is None
    assert venture["model_resolution_status"] == "UNRESOLVED"

    explicit = client.post(
        "/api/ventures/qa-ambiguous/seam-actions",
        json={"action": "CLARIFY_MODEL", "approved_model": "AI_B2B", "business_line_id": "qa-ambiguous-2"},
        headers=O,
    )
    assert explicit.status_code == 200, explicit.text
    payload = state(client)
    venture = by_id(payload["ventures"], "qa-ambiguous")
    lines = {row["id"]: row for row in payload["venture_business_lines"] if row["venture_id"] == "qa-ambiguous"}
    assert venture["primary_business_model"] == "AI_B2B"
    assert lines["qa-ambiguous-2"]["track_role"] == "ACTIVE_GOVERNING"
    assert lines["qa-ambiguous-1"]["track_role"] == "HISTORICAL_PRESERVED"


def test_p0c_update_rejects_incompatible_model_line_without_orphan(client):
    before = state(client)
    evidence_before = len(before["evidence_records"])
    observations_before = len(before["evidence_observations"])
    response = client.post(
        "/api/updates",
        json={
            "id": "QA-P0C-XREF-U",
            "venture_id": "case-b",
            "business_line_id": "bl-b-services",
            "criterion_id": "L0L1-AIB2C-2",
            "summary_metric": "QA-only incompatible model probe",
            "summary_period": "QA-only period",
            "claimed_metrics_json": {"qa_only": True},
            "evidence": {
                "id": "QA-P0C-XREF-E",
                "source_type": "Analytics Excerpt",
                "ledger_bucket": "USAGE_METRIC",
                "unit": "COUNT",
                "period_label": "QA-only period",
            },
            "observations": [
                {
                    "id": "QA-P0C-XREF-O",
                    "criterion_id": "L0L1-AIB2C-2",
                    "metric_type": "COUNT",
                    "numeric_value": 10,
                    "unit": "COUNT",
                    "qualifier_status": "QUALIFIED",
                    "period_label": "QA-only period",
                }
            ],
            "blocker": "No blocker",
            "next_action": "QA-only review",
        },
        headers=S,
    )
    assert response.status_code == 422, response.text
    error, _ = error_detail(response)
    assert "not compatible" in error
    assert "L0L1-AIB2C-2" in error
    after = state(client)
    assert len(after["evidence_records"]) == evidence_before
    assert len(after["evidence_observations"]) == observations_before
    assert not any(row["id"] == "QA-P0C-XREF-E" for row in after["evidence_records"])
    assert not any(row["id"] == "QA-P0C-XREF-O" for row in after["evidence_observations"])


def test_p0c_valid_services_msl_not_blocked_by_preserved_saas(client):
    build_msl_fixture(client, preserved_saas=True)
    response = certify(client)
    assert response.status_code == 200, response.text
    payload = state(client)
    venture = by_id(payload["ventures"], "qa-msl")
    lines = {row["id"]: row for row in payload["venture_business_lines"] if row["venture_id"] == "qa-msl"}
    assert venture["msl_eligibility"] == "Eligible for MSL"
    assert venture["msl_eligibility_provenance"] == "Reviewer certification"
    assert lines["qa-msl-line"]["track_role"] == "ACTIVE_GOVERNING"
    assert lines["qa-msl-saas"]["track_role"] == "HISTORICAL_PRESERVED"


def test_p0c_msl_rejects_services_id_substitution(client):
    build_msl_fixture(client)
    before = decision_count(client)
    replace_criterion_id("MSL-SRV-3", "MSL-SRV-X")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "MSL criteria catalogue identity mismatch"
    assert any("MSL-SRV-3" in reason for reason in reasons)
    assert any("MSL-SRV-X" in reason for reason in reasons)
    payload = state(client)
    assert by_id(payload["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_rejects_common_id_substitution(client):
    build_msl_fixture(client)
    before = decision_count(client)
    replace_criterion_id("MSL-COM-1", "MSL-COM-X")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "MSL criteria catalogue identity mismatch"
    assert any("MSL-COM-1" in reason for reason in reasons)
    assert any("MSL-COM-X" in reason for reason in reasons)
    assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_rejects_ai_b2b_id_substitution(client):
    response = create(client, {
        "id": "qa-msl-aib2b",
        "name": "QA-only AI B2B MSL fixture",
        "activity": "QA-only AI B2B identity fixture",
        "primary_business_model": "AI_B2B",
        "model_resolution_status": "CONFIRMED",
        "programme_level": "Level 2",
        "programme_level_provenance": "QA-only fixture",
        "business_lines": [{
            "id": "qa-msl-aib2b-line",
            "line_name": "QA AI B2B line",
            "track_role": "ACTIVE_GOVERNING",
            "candidate_models": ["AI_B2B"],
            "approved_model": "AI_B2B",
            "resolution_status": "CONFIRMED",
        }],
    })
    assert response.status_code == 201, response.text
    before = decision_count(client)
    replace_criterion_id("MSL-AIB2B-3", "MSL-AIB2B-X")
    response = certify_venture(client, "qa-msl-aib2b")
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "MSL criteria catalogue identity mismatch"
    assert any("MSL-AIB2B-3" in reason for reason in reasons)
    assert any("MSL-AIB2B-X" in reason for reason in reasons)
    assert by_id(state(client)["ventures"], "qa-msl-aib2b")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


@pytest.mark.parametrize("model", ["Consumer", "AI_B2C"])
def test_p0c_common_only_msl_certification(client, model):
    venture_id = f"qa-common-{model.lower()}"
    build_common_msl_fixture(client, venture_id, model)
    before = state(client)
    imported_before = {
        row["id"]: (row["msl_eligibility"], row["msl_eligibility_provenance"])
        for row in before["ventures"] if row["id"] in ("case-b", "case-c")
    }
    response = certify_venture(client, venture_id)
    assert response.status_code == 200, response.text
    body = response.json()
    payload = state(client)
    qa = by_id(payload["ventures"], venture_id)
    assert qa["msl_eligibility"] == "Eligible for MSL"
    assert qa["msl_eligibility_provenance"] == "Reviewer certification"
    assert len(body["msl_criteria_snapshot_json"]) == 5
    assert set(body["msl_criteria_snapshot_json"]) == {
        f"MSL-COM-{index}" for index in range(1, 6)
    }
    decisions = [row for row in payload["msl_eligibility_decisions"] if row["venture_id"] == venture_id]
    assert len(decisions) == 1
    imported_after = {
        row["id"]: (row["msl_eligibility"], row["msl_eligibility_provenance"])
        for row in payload["ventures"] if row["id"] in ("case-b", "case-c")
    }
    assert imported_after == imported_before


def test_p0c_msl_requires_valid_primary_model(client):
    build_msl_fixture(client)
    before = decision_count(client)
    sql(client, "UPDATE ventures SET primary_business_model=NULL WHERE id='qa-msl'")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "Primary business model invalid"
    assert "primary_business_model=none" in reasons
    payload = state(client)
    venture = by_id(payload["ventures"], "qa-msl")
    assert venture["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before

    sql(client, "UPDATE ventures SET primary_business_model='AI/Product' WHERE id='qa-msl'")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "Primary business model invalid"
    assert "primary_business_model=AI/Product" in reasons
    assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_requires_zero_governing_line(client):
    build_msl_fixture(client)
    before = decision_count(client)
    sql(client, "UPDATE venture_business_lines SET track_role='HISTORICAL_PRESERVED' WHERE id='qa-msl-line'")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "Governing business line invalid"
    assert "expected exactly one ACTIVE_GOVERNING line, found 0" in reasons
    assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_requires_multiple_governing_lines(client):
    build_msl_fixture(client)
    before = decision_count(client)
    sql(
        client,
        "INSERT INTO venture_business_lines (id, venture_id, line_name, track_role, candidate_models_json, approved_model, resolution_status) VALUES ('qa-msl-extra', 'qa-msl', 'QA extra governing line', 'ACTIVE_GOVERNING', '[\"Services\"]', 'Services', 'CONFIRMED')",
    )
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "Governing business line invalid"
    assert "expected exactly one ACTIVE_GOVERNING line, found 2" in reasons
    assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_requires_complete_catalogue(client):
    build_msl_fixture(client)
    before = decision_count(client)
    sql(client, "DELETE FROM evidence_review_history WHERE evidence_id='QA-MSL-SRV-3-E'")
    sql(client, "DELETE FROM evidence_observations WHERE evidence_id='QA-MSL-SRV-3-E'")
    sql(client, "DELETE FROM evidence_records WHERE id='QA-MSL-SRV-3-E'")
    sql(client, "DELETE FROM progress_updates WHERE id='QA-MSL-SRV-3-U'")
    sql(client, "DELETE FROM criteria_catalog WHERE id='MSL-SRV-3'")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "MSL criteria catalogue incomplete"
    assert "expected 4 Services criteria, found 3" in reasons
    assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_requires_inconsistent_catalogue_scope(client):
    build_msl_fixture(client)
    before = decision_count(client)
    sql(client, "UPDATE criteria_catalog SET criterion_scope='BUSINESS_LINE' WHERE id='MSL-COM-1'")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "MSL criteria catalogue inconsistent"
    assert "a common MSL criterion is not venture-wide" in reasons
    assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
    assert decision_count(client) == before


def test_p0c_msl_requires_reviewer_reason(client):
    build_msl_fixture(client)
    before = decision_count(client)
    for invalid_reason in ("   ", None, 123):
        response = certify(client, reason=invalid_reason)
        assert response.status_code == 422, response.text
        assert response.json()["detail"] == "A meaningful reviewer reason is required"
        assert by_id(state(client)["ventures"], "qa-msl")["msl_eligibility"] == "Unknown"
        assert decision_count(client) == before


def test_p0c_valid_msl_certification_and_imported_preservation(client):
    build_msl_fixture(client)
    before = state(client)
    imported_before = {
        row["id"]: (row["msl_eligibility"], row["msl_eligibility_provenance"])
        for row in before["ventures"]
        if row["id"] in ("case-b", "case-c")
    }
    decisions_before = decision_count(client)

    response = certify(client)
    assert response.status_code == 200, response.text
    body = response.json()
    payload = state(client)
    venture = by_id(payload["ventures"], "qa-msl")
    assert venture["msl_eligibility"] == "Eligible for MSL"
    assert venture["msl_eligibility_provenance"] == "Reviewer certification"
    assert body["approved_by"] == "Demo Programme Reviewer"
    assert body["approved_at"]
    assert len(body["msl_criteria_snapshot_json"]) == 9
    assert decision_count(client) == decisions_before + 1
    decision = by_id(payload["msl_eligibility_decisions"], body["id"])
    assert decision["reason"] == "QA-only full checklist verified"
    imported_after = {
        row["id"]: (row["msl_eligibility"], row["msl_eligibility_provenance"])
        for row in payload["ventures"]
        if row["id"] in ("case-b", "case-c")
    }
    assert imported_after == imported_before
    assert imported_before == {
        "case-b": ("Eligible for MSL", "Imported from tracker"),
        "case-c": ("Eligible for MSL", "Programme owner clarification"),
    }


def test_p0c_failed_msl_writes_nothing(client):
    build_msl_fixture(client)
    before = state(client)
    before_qa = by_id(before["ventures"], "qa-msl")
    before_decisions = len(before["msl_eligibility_decisions"])
    sql(client, "UPDATE ventures SET primary_business_model=NULL WHERE id='qa-msl'")
    response = certify(client)
    assert response.status_code == 400, response.text
    error, reasons = error_detail(response)
    assert error == "Primary business model invalid"
    assert "primary_business_model=none" in reasons
    after = state(client)
    after_qa = by_id(after["ventures"], "qa-msl")
    assert after_qa["msl_eligibility"] == before_qa["msl_eligibility"] == "Unknown"
    assert after_qa["msl_eligibility_provenance"] == before_qa["msl_eligibility_provenance"]
    assert len(after["msl_eligibility_decisions"]) == before_decisions
    assert not any(row["venture_id"] == "qa-msl" for row in after["msl_eligibility_decisions"])
