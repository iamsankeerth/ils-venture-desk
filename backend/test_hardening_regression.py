"""Additional QA-only checks for reviewed evidence immutability and atomic import.

These use temporary databases and never modify the supplied A/B/C seed.
"""
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.db import connect, load_seed_file, seed_from_dict, default_seed_path

R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
O = {"X-ILS-Role": "PROGRAMME_OWNER"}
S = {"X-ILS-Role": "STUDENT_FOUNDER"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    path = tmp_path / "safe_workflow.sqlite"
    con = connect(path)
    seed_from_dict(con, load_seed_file(default_seed_path()))
    con.close()
    monkeypatch.setenv("ILS_DB", str(path))
    monkeypatch.setenv("ILS_SEED", str(default_seed_path()))
    with TestClient(app) as test_client:
        yield test_client


def test_student_cannot_extend_reviewed_evidence_to_make_fake_verified_signups(client):
    approval = client.post('/api/evidence/A-E01/review', json={
        'decision':'APPROVED','reviewer':'Demo Reviewer','reason':'QA review'},headers=R)
    assert approval.status_code==200
    body={
        'venture_id':'case-a','business_line_id':'bl-a-b2c',
        'criterion_id':'L0L1-AIB2C-1','evidence_id':'A-E01',
        'summary_period':'October', 'summary_metric':'Synthetic qualifying 35',
        'claimed_metrics_json':{'value':35},
        'next_action':'Review', 'blocker':'No blocker',
        'observations':[{'criterion_id':'L0L1-AIB2C-1','metric_type':'COUNT',
            'period_label':'October','numeric_value':35,'qualifier_status':'QUALIFIED', 'unit':'COUNT'}]
    }
    assert client.post('/api/updates',json=body,headers=S).status_code==422
    s=client.get('/api/state').json()
    q=[x for x in s['evaluated_criteria'] if x['venture_id']=='case-a'
       and x['criterion_id']=='L0L1-AIB2C-1' and x['business_line_id']=='bl-a-b2c'][0]
    assert q['criterion_result']=='UNKNOWN'


def test_complete_but_corrupt_import_rolls_back_all_original_records(client):
    data=client.get('/api/export',headers=O).json()
    data['evidence_records'].append({
        'id':'BAD-FK','venture_id':'NOT-A-VENTURE','evidence_status':'UNREVIEWED'})
    r=client.post('/api/import',json=data,headers=O)
    assert r.status_code==422
    s=client.get('/api/state').json()
    assert {x['id'] for x in s['ventures']}=={'case-a','case-b','case-c'}
    assert len(s['evidence_records'])==7


def test_unknown_venture_level_fails_without_database_mutation(client):
    r=client.post('/api/ventures',json={
        'name':'QA-only dummy','activity':'Test','programme_level':'Level 99'},headers=O)
    assert r.status_code==422
    assert len(client.get('/api/state').json()['ventures'])==3


def test_blank_reviewer_identity_and_reason_rejected_and_audit_unchanged(client):
    r=client.post('/api/evidence/A-E01/review', json={
        'decision':'APPROVED','reviewer':' ','reason':' '},headers=R)
    assert r.status_code==422
    state=client.get('/api/state').json()
    assert next(x for x in state['evidence_records'] if x['id']=='A-E01')['evidence_status']=='UNREVIEWED'
    assert not [x for x in state['evidence_review_history'] if x['evidence_id']=='A-E01']
