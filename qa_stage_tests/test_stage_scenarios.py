"""ILS stage walkthrough and negative-case regression tests.

- Official source/seed data are not modified.
- Every test runs against an independent temporary SQLite database.
- Counterfactual test-only changes are never exported as venture evidence.

Run: PYTHONPATH=/path/to/extracted/project pytest -q test_stage_scenarios.py
"""
import copy
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, seed_from_dict, load_seed_file, default_seed_path

REVIEWER = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
STUDENT = {"X-ILS-Role": "STUDENT_FOUNDER"}
OWNER = {"X-ILS-Role": "PROGRAMME_OWNER"}
MENTOR = {"X-ILS-Role": "MENTOR"}

@pytest.fixture
def client(tmp_path, monkeypatch):
    dbpath = tmp_path / "test_only_ils.db"
    con = connect(dbpath)
    seed_from_dict(con, load_seed_file(default_seed_path()))
    con.close()
    monkeypatch.setenv("ILS_DB", str(dbpath))
    monkeypatch.setenv("ILS_SEED", str(default_seed_path()))
    with TestClient(app) as c:
        yield c


def state(client):
    r = client.get('/api/state')
    assert r.status_code == 200, r.text
    return r.json()


def row(rows, key):
    return next(r for r in rows if r['id'] == key)


def criterion(s, v, line, c):
    return next(x for x in s['evaluated_criteria'] if x['venture_id']==v and x['business_line_id']==line and x['criterion_id']==c)


def review(client, id, decision='APPROVED', reviewer='Demo Programme Reviewer', reason='Test-only review of supplied mock evidence'):
    return client.post(f'/api/evidence/{id}/review', headers=REVIEWER,
                       json={'decision':decision,'reviewer':reviewer,'reason':reason})

# ===== Source-only stage states (no synthetic data added) =====
def test_S01_seeded_three_ventures_and_38_criteria(client):
    s=state(client)
    assert {v['id'] for v in s['ventures']}=={'case-a','case-b','case-c'}
    assert len(s['criteria_catalog'])==38


def test_S02_case_a_separates_mvp_from_unknown_level(client):
    a=row(state(client)['ventures'],'case-a')
    assert a['development_stage']=='MVP Developed'
    assert a['programme_level']=='Unknown'
    assert a['model_resolution_status']=='UNRESOLVED'


def test_S03_case_a_source_update_unreviewed(client):
    s=state(client)
    assert row(s['evidence'],'A-E01')['evidence_status']=='UNREVIEWED'
    assert criterion(s,'case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']=='UNKNOWN'
    assert criterion(s,'case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']=='UNKNOWN'


def test_S04_case_a_approved_evidence_does_not_pass_10_wau(client):
    assert review(client,'A-E01').status_code==200
    s=state(client)
    assert row(s['evidence'],'A-E01')['evidence_status']=='APPROVED'
    assert criterion(s,'case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']=='NOT_MET'
    assert criterion(s,'case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']=='UNKNOWN'


def test_S05_case_a_changes_requested_becomes_follow_up(client):
    assert review(client,'A-E01','CHANGES_REQUESTED').status_code==200
    s=state(client)
    assert row(s['evidence'],'A-E01')['evidence_status']=='CHANGES_REQUESTED'
    assert any(h['evidence_id']=='A-E01' for h in s['history'])
    assert any(x.get('id')=='A-E01' for x in s['staff_queue']['pending_actions'])


def test_S06_case_a_unknown_L0_checklist_stays_unknown(client):
    s=state(client)
    for q in ('L0-Q1','L0-Q2','L0-Q3','L0-Q4','L0-Q5'):
        assert criterion(s,'case-a',None,q)['criterion_result']=='UNKNOWN'


def test_S07_case_b_imported_msl_status_not_recategorized(client):
    s=state(client); b=row(s['ventures'],'case-b')
    assert b['programme_level']=='Unknown'
    assert b['msl_eligibility']=='Eligible for MSL'
    assert b['fundraising_preference']=='Grants; does not want equity funding'
    assert b['historical_traction_amount_paise']==120000000


def test_S08_case_b_loi_is_intent_not_a_pilot_or_revenue(client):
    assert review(client,'B-E01').status_code==200
    s=state(client)
    ledger=next(l for l in s['ledgers'] if l['business_line_id']=='bl-b-saas')
    assert ledger['signed_lois']==1
    assert ledger['collected_paise'] is None and ledger['billed_paise'] is None
    assert criterion(s,'case-b','bl-b-saas','L1L2-AIB2B-2')['criterion_result']=='UNKNOWN'


def test_S09_case_b_invoice_and_receipt_reconcile(client):
    assert review(client,'B-E02').status_code==200
    assert review(client,'B-E03').status_code==200
    s=state(client)
    ledger=next(l for l in s['ledgers'] if l['business_line_id']=='bl-b-services')
    assert ledger['billed_paise']==10000000
    assert ledger['collected_paise']==6000000
    assert ledger['arithmetic_difference_paise']==4000000
    assert ledger['historical_baseline_paise']==120000000


def test_S10_case_c_direct_entry_level_2_and_msl_unknown_acceptance(client):
    s=state(client); c=row(s['ventures'],'case-c')
    assert c['programme_level']=='Level 2'
    assert c['msl_eligibility']=='Eligible for MSL'
    assert c['msl_acceptance_status']=='Unknown'
    assert c['fundraising_preference']=='No, per tracker'
    assert any(t['venture_id']=='case-c' and t['transition_type']=='HISTORICAL_IMPORTED' for t in s['transitions'])


def test_S11_case_c_september_earnings_october_payout(client):
    assert review(client,'C-E01').status_code==200
    assert review(client,'C-E02').status_code==200
    s=state(client)
    ledger=next(l for l in s['ledgers'] if l['business_line_id']=='bl-c-main')
    assert ledger['earned_paise']==8000000
    assert ledger['collected_paise']==7000000
    assert ledger['arithmetic_difference_paise']==1000000
    assert row(s['evidence'],'C-E03')['ledger_bucket']=='BILLED'


def test_S12_case_a_unresolved_model_blocks_standard_advancement(client):
    r=client.post('/api/ventures/case-a/transitions',headers=REVIEWER,json={
        'transition_type':'STANDARD_ADVANCEMENT','to_level':'Level 1',
        'approved_by':'Demo Programme Reviewer','reason':'QA-only attempt'})
    assert r.status_code==400
    assert row(state(client)['ventures'],'case-a')['programme_level']=='Unknown'


def test_S13_student_cannot_approve_evidence(client):
    r=client.post('/api/evidence/A-E01/review',headers=STUDENT,json={
        'decision':'APPROVED','reviewer':'Test only','reason':'Test only'})
    assert r.status_code==403


def test_S14_eligibility_is_independent_of_msl_acceptance(client):
    for id in ('case-b','case-c'):
        v=row(state(client)['ventures'],id)
        assert v['msl_eligibility']=='Eligible for MSL'
        assert v['msl_handover_status']=='Unknown' and v['msl_acceptance_status']=='Unknown'

# ===== Diagnostic negative tests: synthetic manipulations ONLY in tmp DB =====
def test_N01_empty_student_update_must_be_rejected(client):
    r=client.post('/api/updates',headers=STUDENT,json={'venture_id':'case-a'})
    assert r.status_code==422, f'Found input-validation defect: {r.status_code}, {r.text[:240]}'


def test_N02_review_blank_identity_and_reason_must_be_rejected(client):
    r=review(client,'A-E01', reviewer='',reason='')
    assert r.status_code==422, f'Found review-validation defect: {r.status_code}'


def test_N03_blank_reason_direct_entry_must_be_rejected(client):
    r=client.post('/api/ventures/case-a/transitions',headers=REVIEWER,json={
        'to_level':'Level 1','transition_type':'DIRECT_ENTRY',
        'approved_by':'Demo Programme Reviewer','reason':''})
    assert r.status_code==422, f'Found transition-justification defect: {r.status_code}'


def test_N04_cross_case_evidence_reference_must_be_rejected(client):
    # Uses only source evidence B-E01, but tries to reuse it for venture A.
    r=client.post('/api/updates',headers=STUDENT,json={
        'id':'QA-XREF','venture_id':'case-a','business_line_id':'bl-a-b2c',
        'criterion_id':'L0L1-AIB2C-2','evidence_id':'B-E01',
        'summary_metric':'WAU','summary_period':'Week ending 4 October',
        'claimed_metrics_json':{'qa_only':True},'blocker':'None','next_action':'Review'})
    assert r.status_code in (400,422), f'Cross-venture reference accepted: {r.status_code}'


def test_N05_incomplete_import_cannot_destroy_seed(client):
    r=client.post('/api/import',headers=OWNER,json={'ventures':[]})
    assert r.status_code in (400,422), f'Incomplete import accepted: {r.status_code}'
    assert len(state(client)['ventures'])==3


def test_N06_nonconsecutive_week_sequences_do_not_pass(client, monkeypatch):
    # Counterfactual: reuse source 12 WAU value for week 2 and give it a 4-week gap.
    # Source record is altered only inside this test's temporary database.
    assert review(client,'A-E01').status_code==200
    from backend.app import db_path
    db=connect(db_path())
    db.execute("UPDATE evidence_observations SET numeric_value=12, period_sequence=5, period_label='QA ONLY: nonconsecutive' WHERE id='A-E01-W2'")
    db.commit(); db.close()
    res=criterion(state(client),'case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']
    assert res!='MET', f'Nonconsecutive week sequence incorrectly passed: {res}'


def test_N07_l0_discovery_counts_must_be_compared_numerically(client):
    # QA-only counterfactual, never actual evidence. 8 conversations cannot satisfy 55.
    r=client.post('/api/updates',headers=STUDENT,json={
        'id':'QA-Q3','venture_id':'case-a','criterion_id':'L0-Q3',
        'summary_metric':'Discovery conversations','summary_period':'QA-only',
        'claimed_metrics_json':{'qa_only':True},'blocker':'Count below threshold','next_action':'Continue discovery',
        'evidence':{'id':'QA-E-Q3','source_type':'QA-only test fixture','ledger_bucket':'QUALITATIVE'},
        'observations':[{'id':'QA-O-Q3','criterion_id':'L0-Q3','metric_type':'QUALITATIVE_CHECKLIST',
                         'qualifier_status':'met','qualitative_value_json':{
                             'met':True,'unique_conversations':8,'weeks_spanned':1,
                             'target_segment':1,'workaround_users':1}}]})
    assert r.status_code==201
    assert review(client,'QA-E-Q3').status_code==200
    res=criterion(state(client),'case-a',None,'L0-Q3')['criterion_result']
    assert res!='MET', f'Numerically insufficient discovery was accepted: {res}'


def test_N08_same_receipt_not_counted_as_cash_twice(client):
    # QA-only observation duplicates B-E03's original ₹60,000 receipt, not a new payment.
    assert review(client,'B-E03').status_code==200
    from backend.app import db_path
    db=connect(db_path())
    db.execute("INSERT INTO evidence_observations (id,evidence_id,venture_id,business_line_id,criterion_id,metric_type,period_label,period_sequence,numeric_value,unit,qualifier_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
               ('QA-DUP-PAY','B-E03','case-b','bl-b-services','L0L1-SRV-3','CASH_COLLECTED','Received 11 October',1,6000000,'INR_PAISE','QUALIFIED'))
    db.commit();db.close()
    reading=criterion(state(client),'case-b','bl-b-services','L0L1-SRV-3')['verified_readings']
    assert reading==[6000000], f'Receipt double-counted from record + observation: {reading}'

