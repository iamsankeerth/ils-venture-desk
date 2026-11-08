"""Offline Chromium smoke tests for the Vite-free Mesa ILS frontend.

Browser URL navigation is disabled in this test environment, so the compiled
assets are injected into about:blank. fetch('/api/...') is routed to the REAL
FastAPI TestClient (no mocked backend responses). Each test gets a freshly
seeded temporary SQLite database. No production/demo DB is modified.

Requires playwright (pip install playwright) + a Chromium browser binary.
Run: PYTHONPATH=. python -m pytest -q frontend/tests/test_offline_ui.py
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "frontend" / "dist"
R = {"X-ILS-Role": "PROGRAMME_REVIEWER"}
O = {"X-ILS-Role": "PROGRAMME_OWNER"}


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('ILS_CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
        yield browser
        browser.close()


@pytest.fixture
def ui(tmp_path, monkeypatch, browser):
    monkeypatch.setenv('ILS_DB', str(tmp_path / 'ils-ui-test.sqlite'))
    from backend.app import app
    client = TestClient(app)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(3500)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))

    def bridge(request):
        try:
            response = client.request(request.get('method', 'GET'), request['url'], json=request.get('body'), headers=request.get('headers') or {})
            return {'status': response.status_code, 'body': response.text, 'headers': dict(response.headers)}
        except Exception as exc:
            return {'status': 503, 'body': json.dumps({'detail': str(exc)}), 'headers': {}}

    page.expose_function('__apiBridge', bridge)
    page.set_content('<!doctype html><html><head><style>'+ (DIST / 'styles.css').read_text(encoding='utf-8') +'</style></head><body><div id="root"></div></body></html>')
    page.evaluate("""window.fetch=async (url,options={})=>{
      const r=await window.__apiBridge({url:String(url),method:options.method||'GET',headers:options.headers||{},body:options.body?JSON.parse(options.body):null});
      return {ok:r.status>=200&&r.status<300,status:r.status,headers:new Headers(r.headers),json:async()=>JSON.parse(r.body),text:async()=>r.body,blob:async()=>new Blob([r.body],{type:'application/json'})};
    }""")
    for f in ['vendor/react16.min.js','vendor/react-dom16.min.js','vendor/react-hooks-compat.js','vendor/lucide-lite.js','app.bundle.js']:
        page.add_script_tag(content=(DIST / f).read_text(encoding='utf-8'))
    page.get_by_text('Evidence requiring review').wait_for(timeout=8000)
    yield page, client, errors
    page.close()


def open_case(page, name):
    page.get_by_role('button', name='Ventures', exact=True).click()
    page.locator('table tbody tr').filter(has_text=name).get_by_role('button', name='View').first.click()
    page.get_by_role('heading', name=name, exact=True).wait_for(timeout=8000)


def open_requirements(page):
    page.get_by_role('tab', name='Requirements').click()
    page.wait_for_timeout(200)


def open_case_criterion(page, name, criterion_id):
    open_case(page, name)
    open_requirements(page)
    row = page.locator('li').filter(has_text=criterion_id).first
    row.get_by_role('button', name='Submit Update').first.click()
    return page.get_by_role('dialog')


def open_config(page, criterion_id):
    row = page.locator('li').filter(has_text=criterion_id).first
    row.locator('button').first.click()
    page.wait_for_timeout(150)
    return row


def eval_criterion(payload, venture_id, line_id, criterion_id):
    return next(
        row for row in payload['evaluated_criteria']
        if row['venture_id'] == venture_id
        and row.get('business_line_id') == line_id
        and row['criterion_id'] == criterion_id
    )


def latest_evidence(payload, venture_id, criterion_id):
    updates = [
        row for row in payload['progress_updates']
        if row['venture_id'] == venture_id and row.get('criterion_id') == criterion_id
    ]
    return sorted(updates, key=lambda row: row['submitted_at'])[-1]['evidence_id']


def approve_api(client, evidence_id):
    response = client.post(
        f'/api/evidence/{evidence_id}/review',
        json={'decision': 'APPROVED', 'reviewer': 'Demo Programme Reviewer', 'reason': 'P1 UI smoke review'},
        headers=R,
    )
    assert response.status_code == 200, response.text


def test_p1_qualitative_l0_checklist_entry(ui):
    page, client, errors = ui
    dialog = open_case_criterion(page, 'Case A', 'L0-Q1')
    assert 'Venture-level criterion. No business line is required.' in dialog.inner_text()
    dialog.get_by_label('Evidence-backed canvas submitted').check()
    dialog.get_by_label('Mentor sign-off recorded').check()
    dialog.get_by_label('Summary period (verbatim)').fill('QA-only period')
    dialog.get_by_label('Source type').fill('Mentor Note')
    dialog.get_by_label('Ledger bucket').select_option('USAGE_METRIC')
    dialog.get_by_label('Blocker').fill('No blocker')
    dialog.get_by_label('Next action').fill('QA-only review')
    dialog.get_by_role('button', name='Submit Update').click()
    page.get_by_role('dialog').wait_for(state='hidden', timeout=8000)
    page.wait_for_timeout(250)

    payload = client.get('/api/state').json()
    update = next(u for u in payload['progress_updates'] if u['venture_id'] == 'case-a' and u['criterion_id'] == 'L0-Q1')
    evidence_id = update['evidence_id']
    observation = next(o for o in payload['evidence_observations'] if o['evidence_id'] == evidence_id and o['criterion_id'] == 'L0-Q1')
    assert json.loads(observation['qualitative_value_json']) == {'canvas': True, 'mentor_signoff': True}
    approve_api(client, evidence_id)
    payload = client.get('/api/state').json()
    assert eval_criterion(payload, 'case-a', None, 'L0-Q1')['criterion_result'] == 'MET'
    assert not errors, errors


def test_p1_qualitative_l0_numeric_subconditions(ui):
    page, client, errors = ui
    dialog = open_case_criterion(page, 'Case A', 'L0-Q3')
    assert 'Venture-level criterion. No business line is required.' in dialog.inner_text()
    dialog.get_by_role('spinbutton', name='55 unique discovery conversations').fill('55')
    dialog.get_by_role('spinbutton', name='Spanned across >=3 weeks').fill('3')
    dialog.get_by_role('spinbutton', name='>=40 target-segment participants').fill('40')
    dialog.get_by_role('spinbutton', name='>=10 workaround users').fill('10')
    dialog.get_by_label('Summary period (verbatim)').fill('QA-only period')
    dialog.get_by_label('Source type').fill('Mentor Note')
    dialog.get_by_label('Ledger bucket').select_option('USAGE_METRIC')
    dialog.get_by_label('Blocker').fill('No blocker')
    dialog.get_by_label('Next action').fill('QA-only review')
    dialog.get_by_role('button', name='Submit Update').click()
    page.get_by_role('dialog').wait_for(state='hidden', timeout=8000)
    page.wait_for_timeout(250)

    payload = client.get('/api/state').json()
    evidence_id = latest_evidence(payload, 'case-a', 'L0-Q3')
    observation = next(o for o in payload['evidence_observations'] if o['evidence_id'] == evidence_id and o['criterion_id'] == 'L0-Q3')
    assert json.loads(observation['qualitative_value_json']) == {
        'unique_conversations': 55,
        'weeks_spanned': 3,
        'target_segment': 40,
        'workaround_users': 10,
    }
    approve_api(client, evidence_id)
    payload = client.get('/api/state').json()
    assert eval_criterion(payload, 'case-a', None, 'L0-Q3')['criterion_result'] == 'MET'
    assert not errors, errors


def test_p1_qualitative_msl_entry(ui):
    page, client, errors = ui
    dialog = open_case_criterion(page, 'Case C', 'MSL-COM-1')
    assert 'Venture-level criterion. No business line is required.' in dialog.inner_text()
    dialog.get_by_label('Confirmed as met').check()
    dialog.get_by_label('Summary period (verbatim)').fill('QA-only period')
    dialog.get_by_label('Source type').fill('Mentor Note')
    dialog.get_by_label('Ledger bucket').select_option('USAGE_METRIC')
    dialog.get_by_label('Blocker').fill('No blocker')
    dialog.get_by_label('Next action').fill('QA-only review')
    dialog.get_by_role('button', name='Submit Update').click()
    page.get_by_role('dialog').wait_for(state='hidden', timeout=8000)
    page.wait_for_timeout(250)

    payload = client.get('/api/state').json()
    update = next(u for u in payload['progress_updates'] if u['venture_id'] == 'case-c' and u['criterion_id'] == 'MSL-COM-1')
    assert update['business_line_id'] is None
    evidence_id = update['evidence_id']
    observation = next(o for o in payload['evidence_observations'] if o['evidence_id'] == evidence_id and o['criterion_id'] == 'MSL-COM-1')
    assert json.loads(observation['qualitative_value_json']) == {'met': True}
    approve_api(client, evidence_id)
    payload = client.get('/api/state').json()
    assert eval_criterion(payload, 'case-c', None, 'MSL-COM-1')['criterion_result'] == 'MET'
    assert not errors, errors


def test_p1_cash_form_uses_inr_and_paise(ui):
    page, client, errors = ui
    dialog = open_case_criterion(page, 'Case B', 'L0L1-SRV-3')
    dialog.get_by_label('Source type').fill('Payment Receipt')
    page.wait_for_timeout(200)
    assert dialog.get_by_label('Evidence unit').input_value() == 'INR_PAISE'
    dialog.get_by_label('Amount (INR)').fill('20000')
    dialog.get_by_label('Ledger bucket').select_option('COLLECTED')
    dialog.get_by_label('Summary period (verbatim)').fill('QA-only period')
    dialog.get_by_label('Blocker').fill('No blocker')
    dialog.get_by_label('Next action').fill('QA-only review')
    dialog.get_by_role('button', name='Submit Update').click()
    page.get_by_role('dialog').wait_for(state='hidden', timeout=8000)
    page.wait_for_timeout(250)

    payload = client.get('/api/state').json()
    update = next(u for u in payload['progress_updates'] if u['venture_id'] == 'case-b' and u['criterion_id'] == 'L0L1-SRV-3')
    evidence = next(e for e in payload['evidence_records'] if e['id'] == update['evidence_id'])
    assert evidence['amount_minor_or_count'] == 2000000
    assert evidence['unit'] == 'INR_PAISE'
    approve_api(client, evidence['id'])
    payload = client.get('/api/state').json()
    assert eval_criterion(payload, 'case-b', 'bl-b-services', 'L0L1-SRV-3')['criterion_result'] == 'MET'
    assert not errors, errors


def test_p1_required_qualifier_is_a_select(ui):
    page, client, errors = ui
    open_case(page, 'Case A')
    open_requirements(page)
    page.get_by_role('tab', name=re.compile('AI B2B')).click()
    row = page.locator('li').filter(has_text='L0L1-AIB2B-1').first
    row.get_by_role('button', name='Submit Update').first.click()
    dialog = page.get_by_role('dialog')
    qualifier = dialog.get_by_label('Metric 1 qualifier')
    assert qualifier.evaluate("el => el.tagName") == 'SELECT'
    qualifier.select_option('BUDGET_HOLDER')
    dialog.get_by_label('Metric 1 value').fill('5')
    dialog.get_by_label('Metric 1 period').fill('QA-only period')
    dialog.get_by_label('Summary period (verbatim)').fill('QA-only period')
    dialog.get_by_label('Source type').fill('Mentor Note')
    dialog.get_by_label('Ledger bucket').select_option('USAGE_METRIC')
    dialog.get_by_label('Blocker').fill('No blocker')
    dialog.get_by_label('Next action').fill('QA-only review')
    dialog.get_by_role('button', name='Submit Update').click()
    page.get_by_role('dialog').wait_for(state='hidden', timeout=8000)
    page.wait_for_timeout(250)

    payload = client.get('/api/state').json()
    update = next(u for u in payload['progress_updates'] if u['venture_id'] == 'case-a' and u['criterion_id'] == 'L0L1-AIB2B-1')
    observation = next(o for o in payload['evidence_observations'] if o['evidence_id'] == update['evidence_id'] and o['criterion_id'] == 'L0L1-AIB2B-1')
    assert observation['qualifier_status'] == 'BUDGET_HOLDER'
    approve_api(client, update['evidence_id'])
    payload = client.get('/api/state').json()
    assert eval_criterion(payload, 'case-a', 'bl-a-b2b', 'L0L1-AIB2B-1')['criterion_result'] == 'MET'
    assert not errors, errors


def test_p1_owner_cash_and_retention_configuration_controls(ui):
    page, client, errors = ui
    page.get_by_role('combobox', name='Simulated role').select_option('PROGRAMME_OWNER')
    open_case(page, 'Case C')
    open_requirements(page)

    row = open_config(page, 'MSL-SRV-2')
    row.get_by_label('Threshold (INR)').fill('200000')
    row.get_by_label('Aggregation method').select_option('SUM')
    row.get_by_label('Measurement basis').select_option('COLLECTED')
    row.get_by_label('Measurement period').fill('All supplied periods')
    row.get_by_role('button', name='Configure Rule').click()
    page.wait_for_timeout(300)

    row = open_config(page, 'MSL-SRV-3')
    row.get_by_label(re.compile('^Threshold')).fill('30')
    row.get_by_label('Aggregation method').select_option('PERCENT')
    row.get_by_label('Cohort definition').fill('QA-cohort')
    row.get_by_label('Retention window').fill('3')
    row.get_by_role('button', name='Configure Rule').click()
    page.wait_for_timeout(300)

    row = open_config(page, 'MSL-SRV-1')
    assert row.get_by_label('Range low').count() == 1
    assert row.get_by_label('Range high').count() == 1
    row.get_by_label(re.compile('^Threshold')).fill('10')
    row.get_by_label('Aggregation method').select_option('DISTINCT_ENTITY')
    row.get_by_label('Range low').fill('10')
    row.get_by_label('Range high').fill('20')
    row.get_by_role('button', name='Configure Rule').click()
    page.wait_for_timeout(300)

    payload = client.get('/api/state').json()
    catalog = {c['id']: c for c in payload['criteria_catalog']}
    assert catalog['MSL-SRV-2']['configured_value'] == 20000000
    cash_rule = json.loads(catalog['MSL-SRV-2']['configured_rule_json'])
    assert cash_rule['aggregation_method'] == 'SUM'
    assert cash_rule['metric_basis'] == 'COLLECTED'
    assert cash_rule['period'] == 'All supplied periods'
    assert catalog['MSL-SRV-3']['configured_value'] == 30
    retention_rule = json.loads(catalog['MSL-SRV-3']['configured_rule_json'])
    assert retention_rule['cohort_definition'] == 'QA-cohort'
    assert retention_rule['window_weeks'] == 3
    count_rule = json.loads(catalog['MSL-SRV-1']['configured_rule_json'])
    assert count_rule['range_low'] == 10
    assert count_rule['range_high'] == 20
    assert not errors, errors


def test_p1_owner_pilot_and_wau_configuration_controls(ui):
    page, client, errors = ui
    page.get_by_role('combobox', name='Simulated role').select_option('PROGRAMME_OWNER')
    open_case(page, 'Case A')
    open_requirements(page)
    page.get_by_role('tab', name=re.compile('AI B2B')).click()
    row = open_config(page, 'MSL-AIB2B-4')
    row.get_by_label(re.compile('^Threshold')).fill('2')
    row.get_by_label('Aggregation method').select_option('QUALIFYING_PILOTS')
    row.get_by_label('Pilot qualification').select_option('Pilot completion report')
    row.get_by_role('button', name='Configure Rule').click()
    page.wait_for_timeout(300)

    page.get_by_role('tab', name=re.compile('AI B2C')).click()
    row = open_config(page, 'L1L2-AIB2C-1')
    row.get_by_label(re.compile('^Threshold')).fill('35')
    row.get_by_label('Aggregation method').select_option('SUSTAINED_MIN')
    row.get_by_label('Window weeks').fill('4')
    row.get_by_role('button', name='Configure Rule').click()
    page.wait_for_timeout(300)

    payload = client.get('/api/state').json()
    catalog = {c['id']: c for c in payload['criteria_catalog']}
    pilot_rule = json.loads(catalog['MSL-AIB2B-4']['configured_rule_json'])
    assert pilot_rule['pilot_qualification'] == 'Pilot completion report'
    wau_rule = json.loads(catalog['L1L2-AIB2C-1']['configured_rule_json'])
    assert wau_rule['aggregation_method'] == 'SUSTAINED_MIN'
    assert wau_rule['window_weeks'] == 4
    assert not errors, errors


def test_p1_staff_queue_unresolved_criteria(ui):
    page, client, errors = ui
    page.get_by_role('button', name='Review evidence').first.click()
    dialog = page.get_by_role('dialog')
    dialog.locator('textarea').fill('P1 UI smoke approval')
    dialog.get_by_role('button', name='Approve Evidence').click()
    page.get_by_text('Saved: APPROVED', exact=False).wait_for(timeout=8000)
    dialog.get_by_role('button', name='Close panel').click()
    page.get_by_text('Reviewed criteria needing follow-up').wait_for(timeout=8000)
    body = page.locator('body').inner_text()
    assert 'L0L1-AIB2C-2' in body
    assert 'L0L1-AIB2C-1' in body
    follow = page.locator('li').filter(has_text='L0L1-AIB2C-2').first.get_by_role('button', name='Submit follow-up')
    follow.click()
    submit = page.get_by_role('dialog')
    assert submit.get_by_label('Primary criterion').input_value() == 'L0L1-AIB2C-2'
    assert submit.get_by_label('Business line').input_value() == 'bl-a-b2c'
    submit.get_by_role('button', name='Cancel').click()
    assert not errors, errors


def test_p1_mock_prefill_is_explicit_qa_only(ui):
    page, client, errors = ui
    open_case(page, 'Case A')
    page.get_by_role('button', name='Submit Update').first.click()
    dialog = page.get_by_role('dialog')
    assert dialog.get_by_role('button', name=re.compile('Prefill Mock A-01')).count() == 0
    dialog.get_by_role('button', name='Cancel').click()

    page.evaluate("window.__ILS_QA_ONLY__ = true")
    page.get_by_role('button', name='Submit Update').first.click()
    dialog = page.get_by_role('dialog')
    assert dialog.get_by_role('button', name=re.compile('Prefill Mock A-01')).count() == 1
    dialog.get_by_role('button', name='Cancel').click()

    open_case(page, 'Case B')
    page.get_by_role('button', name='Submit Update').first.click()
    dialog = page.get_by_role('dialog')
    assert dialog.get_by_role('button', name=re.compile('Prefill Mock A-01')).count() == 0
    dialog.get_by_role('button', name='Cancel').click()
    assert not errors, errors


def test_p2_export_permissions_and_palette(ui):
    page, client, errors = ui
    assert page.get_by_role('button', name='Export data').count() == 1
    page.get_by_role('button', name='Open command palette').click()
    palette = page.get_by_role('dialog', name='Command palette')
    assert palette.get_by_role('option', name=re.compile('Export data')).count() == 1
    page.get_by_role('combobox', name='Command palette').press('Escape')
    palette.wait_for(state='hidden')

    page.get_by_role('combobox', name='Simulated role').select_option('STUDENT_FOUNDER')
    assert page.get_by_role('button', name='Export data').count() == 0
    page.get_by_role('button', name='Open command palette').click()
    palette = page.get_by_role('dialog', name='Command palette')
    assert palette.get_by_role('option', name=re.compile('Export data')).count() == 0
    assert palette.get_by_role('option', name=re.compile('Import venture')).count() == 0
    assert palette.get_by_role('option', name=re.compile('Reset to seed')).count() == 0
    assert palette.get_by_role('option', name=re.compile('Submit update')).count() == 1
    page.get_by_role('combobox', name='Command palette').press('Escape')
    palette.wait_for(state='hidden')

    assert client.get('/api/export', headers={}).status_code == 403
    assert client.get('/api/export', headers={'X-ILS-Role': 'STUDENT_FOUNDER'}).status_code == 403
    assert client.get('/api/export', headers={'X-ILS-Role': 'MENTOR'}).status_code == 403
    assert client.get('/api/export', headers={'X-ILS-Role': 'PROGRAMME_REVIEWER'}).status_code == 200
    assert client.get('/api/export', headers={'X-ILS-Role': 'PROGRAMME_OWNER'}).status_code == 200
    assert not errors, errors


def test_p2_financial_labels_and_derived_periods(ui):
    page, client, errors = ui
    open_case(page, 'Case B')
    page.get_by_role('tab', name='Evidence & Financials').click()
    page.wait_for_timeout(250)
    body = page.locator('body').inner_text()
    visible = body.upper()
    assert 'CLAIMED (SUBMITTED)' in visible
    assert 'CLAIMED (AWAITING REVIEW)' not in visible
    assert '0 COMPLETED PILOTS' not in visible
    assert 'UNKNOWN COMPLETED PILOTS' in visible

    open_case(page, 'Case C')
    page.get_by_role('tab', name='Evidence & Financials').click()
    page.wait_for_timeout(250)
    over = page.locator('body').inner_text()
    assert 'Earned (claimed September; verified Unknown)' in over
    assert 'Received (claimed September; verified Unknown)' in over
    assert 'CLAIMED (SUBMITTED)' in over.upper()
    assert not errors, errors


def test_final_direct_entry_hides_lower_targets(ui):
    page, _, errors = ui
    page.get_by_role('combobox', name='Simulated role').select_option('PROGRAMME_REVIEWER')
    open_case(page, 'Case C')
    page.get_by_role('tab', name='Decision History').click()
    page.get_by_role('button', name='Record Transition').first.click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('radio', name='Direct Entry').check()
    options = dialog.get_by_label('Target level').locator('option').all_inner_texts()
    assert 'Level 1' not in options
    assert 'Level 2' in options
    dialog.get_by_role('button', name='Cancel').click()
    assert not errors, errors


def test_static_assets_without_vite(ui):
    _, client, errors = ui
    for url, marker in [('/', 'ILS Venture Desk'),('/styles.css', '.bg-white'),('/app.bundle.js', 'ILS Venture Desk'),('/vendor/react16.min.js','React')]:
        response=client.get(url)
        assert response.status_code == 200, f'{url}: HTTP {response.status_code}'
        assert marker.lower() in response.text.lower(), f'{url}: marker missing'
    assert not errors, errors


def test_queue_and_venture_navigation(ui):
    page, client, errors = ui
    assert page.get_by_role('button', name='Review evidence').count() == 7
    page.get_by_role('button', name='Ventures', exact=True).click()
    for case in ('Case A','Case B','Case C'):
        assert case in page.locator('body').inner_text()
    page.locator('table tbody tr').nth(2).get_by_role('button', name='View').click()
    assert 'Level 2' in page.locator('body').inner_text()
    page.get_by_role('tab', name='Decision History').click()
    assert 'HISTORICAL_IMPORTED' in page.locator('body').inner_text()
    assert not errors, errors


def test_review_reason_required_and_approval_effect(ui):
    page, client, errors = ui
    page.get_by_role('button', name='Review evidence').first.click()
    page.get_by_role('button',name='Approve Evidence').click()
    assert next(x for x in client.get('/api/state').json()['evidence_records'] if x['id']=='A-E01')['evidence_status'] == 'UNREVIEWED'
    page.get_by_role('dialog').locator('textarea').fill('Test-only approval of supplied A-E01 excerpt')
    page.get_by_role('button',name='Approve Evidence').click()
    page.get_by_text('Saved: APPROVED', exact=False).wait_for(timeout=8000)
    state=client.get('/api/state').json()
    assert next(x for x in state['evidence_records'] if x['id']=='A-E01')['evidence_status'] == 'APPROVED'
    assert any(x.get('criterion_id')=='L0L1-AIB2C-2' and x.get('criterion_result')=='NOT_MET' for x in state['evaluated_criteria'])
    assert not errors, errors


def test_review_changes_requested_in_queue(ui):
    page, client, errors=ui
    page.get_by_role('button',name='Review evidence').first.click()
    page.get_by_role('dialog').locator('textarea').fill('Test only: please verify target-segment breakdown')
    page.get_by_role('button',name='Request Changes').click()
    page.get_by_text('Saved: CHANGES_REQUESTED',exact=False).wait_for(timeout=8000)
    state=client.get('/api/state').json()
    assert next(x for x in state['evidence_records'] if x['id']=='A-E01')['evidence_status']=='CHANGES_REQUESTED'
    assert any(x['evidence_id']=='A-E01' for x in state['evidence_review_history'])
    assert not errors,errors


def test_submit_update_full_form(ui):
    page, client, errors=ui
    page.evaluate("window.__ILS_QA_ONLY__ = true")
    page.get_by_role('button',name='Ventures',exact=True).click()
    page.locator('table tbody tr').first.get_by_role('button',name='View').click()
    page.get_by_role('button',name='Submit Update').first.click()
    page.get_by_role('button',name=re.compile('Prefill Mock A-01')).click()
    page.get_by_role('dialog').get_by_role('button',name='Submit Update').click()
    page.get_by_text('LATEST UPDATE').wait_for(timeout=8000)
    page.wait_for_timeout(300)
    assert len(client.get('/api/state').json()['progress_updates']) == 2
    assert 'Target-segment membership' in page.locator('body').inner_text()
    assert not errors, errors


def test_latest_update_empty_state_has_no_contextual_submit(ui):
    page, _, errors = ui
    open_case(page, 'Case B')
    empty = page.get_by_text('No updates submitted yet.', exact=True)
    assert empty.locator('..').get_by_role('button', name='Submit Update').count() == 0
    assert page.get_by_role('button', name='Submit Update').count() == 3
    assert not errors, errors


def test_reset_workspace_uses_yes_no_and_no_is_safe(ui):
    page, client, errors = ui
    created = client.post('/api/ventures', json={
        'name': 'QA-only reset confirmation',
        'activity': 'QA-only reset confirmation fixture',
        'model_resolution_status': 'UNRESOLVED',
        'programme_level_provenance': 'QA-only fixture',
    }, headers=O)
    assert created.status_code == 201, created.text
    assert len(client.get('/api/state').json()['ventures']) == 4

    page.get_by_role('button', name='Reset to seed data').click()
    dialog = page.get_by_role('dialog')
    assert dialog.get_by_role('button', name='No, keep data').count() == 1
    assert dialog.get_by_role('button', name='Yes, reset data').count() == 1
    assert page.get_by_role('slider', name='Slide to reset').count() == 0
    dialog.get_by_role('button', name='No, keep data').click()
    dialog.wait_for(state='hidden')
    assert len(client.get('/api/state').json()['ventures']) == 4

    page.get_by_role('button', name='Reset to seed data').click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('button', name='Yes, reset data').click()
    page.get_by_text('Workspace reset to seed data.', exact=False).wait_for(timeout=10000)
    page.wait_for_timeout(300)
    state = client.get('/api/state').json()
    assert len(state['ventures']) == 3
    assert len(state['evidence_records']) == 7
    assert all(not venture['name'].startswith('QA-only') for venture in state['ventures'])
    assert not errors, errors


def test_role_permissions_are_reflected_in_ui(ui):
    page, client, errors=ui
    page.get_by_role('combobox',name='Simulated role').select_option('STUDENT_FOUNDER')
    assert page.get_by_role('button',name='Export data').count()==0
    assert page.get_by_role('button',name='Reset to seed data').count()==0
    assert page.get_by_role('button',name='Review evidence').count()==0
    page.get_by_role('button',name='Ventures',exact=True).click()
    page.locator('table tbody tr').first.get_by_role('button',name='View').click()
    assert page.get_by_role('button',name='Submit Update').count()>0
    assert not errors,errors


def test_financial_ledger_case_b(ui):
    page, client, errors=ui
    page.get_by_role('button',name='Ventures',exact=True).click()
    page.locator('table tbody tr').nth(1).get_by_role('button',name='View').click()
    page.get_by_role('tab',name='Evidence & Financials').click()
    body=page.locator('body').inner_text()
    assert '100,000' in body and '60,000' in body
    assert '12 lakh' in body or '12,00,000' in body or '1,200,000' in body
    assert not errors,errors


def test_unresolved_case_a_standard_transition_is_disabled(ui):
    page, client, errors = ui
    page.get_by_role('button', name='Ventures', exact=True).click()
    page.locator('table tbody tr').first.get_by_role('button', name='View').click()
    page.get_by_role('button', name='Record Transition').first.click()
    dialog = page.get_by_role('dialog')
    assert 'Governing model is unresolved' in dialog.inner_text()
    assert dialog.get_by_role('button', name='Record Transition').is_disabled()
    assert not errors, errors


def test_mobile_queue_remains_usable(ui):
    page, client, errors = ui
    page.set_viewport_size({'width': 390, 'height': 844})
    assert 'Work Queue' in page.locator('body').inner_text()
    assert 'Evidence requiring review' in page.locator('body').inner_text()
    assert page.get_by_role('button', name='Review evidence').count() == 7
    assert not errors, errors
