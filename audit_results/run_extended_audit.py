#!/usr/bin/env python3
"""Independent assignment-scoped black-box API regression audit.
Uses a fresh seeded temporary SQLite database for EVERY case. Never writes to user's project.
"""
from __future__ import annotations
import csv, json, os, sys, tempfile, traceback, uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fastapi.testclient import TestClient
from backend.app import app
from backend.db import connect, seed_from_dict, load_seed_file
from backend.evaluation import evaluate_all

O={'X-ILS-Role':'PROGRAMME_OWNER'}
R={'X-ILS-Role':'PROGRAMME_REVIEWER'}
S={'X-ILS-Role':'STUDENT_FOUNDER'}
M={'X-ILS-Role':'MENTOR'}
X={'X-ILS-Role':'INTRUDER'}

cases=[]
results=[]

def case(category,slug,priority,kind,expected):
    def deco(f):
        cases.append((category,slug,priority,kind,expected,f))
        return f
    return deco

class Env:
    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='ils_scope_')
        self.p = Path(self.tmp.name)/'test.sqlite'
        con=connect(self.p)
        seed_from_dict(con,load_seed_file(ROOT/'backend/seed_data.json'))
        con.close()
        os.environ['ILS_DB']=str(self.p)
        os.environ['ILS_SEED']=str(ROOT/'backend/seed_data.json')
        self.c=TestClient(app,raise_server_exceptions=False)
    def close(self):
        self.c.close()
        self.tmp.cleanup()
    def req(self,method,path,body=None,role=None):
        kw={'headers':role or {}}
        if body is not None: kw['json']=body
        return self.c.request(method,path,**kw)
    def state(self):
        r=self.req('GET','/api/state')
        assert r.status_code==200, f'State HTTP {r.status_code}: {r.text[:140]}'
        return r.json()
    def sql(self,query,params=()):
        con=connect(self.p)
        try:
            cur=con.execute(query,params)
            rows=[dict(x) for x in cur.fetchall()] if query.lstrip().upper().startswith('SELECT') else []
            con.commit()
            return rows
        finally:con.close()
    def approval(self,eid,decision='APPROVED',reviewer='Demo Programme Reviewer',reason='Reviewed for test'):
        return self.req('POST',f'/api/evidence/{eid}/review',{'decision':decision,'reviewer':reviewer,'reason':reason},R)
    def criterion(self,vid,line,cid):
        l=[e for e in self.state()['evaluated_criteria'] if e['venture_id']==vid and e['business_line_id']==line and e['criterion_id']==cid]
        assert len(l)==1,f'Criterion missing/duplicated: {vid}/{line}/{cid} ({len(l)})'
        return l[0]
    def update(self,venture_id='case-a',line='bl-a-b2c',crit='L0L1-AIB2C-2',ev_id=None,observations=None,**override):
        ev_id=ev_id or f'X-E-{uuid.uuid4().hex[:7]}'
        body={
            'venture_id':venture_id,'business_line_id':line,'criterion_id':crit,
            'summary_metric':'11 weekly active users','summary_period':'Week ending 18 October',
            'claimed_metrics_json':{'metric':'WAU','value':11,'period':'Week ending 18 October'},
            'evidence':{'id':ev_id,'source_type':'Analytics Excerpt','ledger_bucket':'USAGE_METRIC','period_label':'Week ending 18 October','unit':'COUNT','display_amount':'11 WAU'},
            'observations':observations if observations is not None else [{'id':ev_id+'-O1','criterion_id':crit,'metric_type':'WAU','period_label':'Week ending 18 October','period_sequence':3,'numeric_value':11,'unit':'COUNT','qualifier_status':'QUALIFIED'}],
            'blocker':'None reported','next_action':'Review updated evidence',
        }
        body.update(override)
        return self.req('POST','/api/updates',body,S)
    def add_observation(self,oid,eid,vid,line,cid,metric='COUNT',value=1,period='Week ending 18 October',seq=3,qual='QUALIFIED',qjson=None,sup=None,entity=None,unit='COUNT'):
        return self.sql('INSERT INTO evidence_observations (id,evidence_id,venture_id,business_line_id,criterion_id,metric_type,period_label,period_sequence,entity_key,numeric_value,qualifier_status,qualitative_value_json,supersedes_observation_id,unit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            (oid,eid,vid,line,cid,metric,period,seq,entity,value,qual,json.dumps(qjson) if qjson is not None else None,sup,unit))
    def add_evidence(self,eid,vid,line,cid,ledger='USAGE_METRIC',amount=None,unit='COUNT',status='APPROVED',counterparty=None,parent=None,period='October',source_type='Audit test'):
        self.sql('INSERT INTO evidence_records (id,venture_id,business_line_id,criterion_id,source_type,ledger_bucket,amount_minor_or_count,unit,display_amount,period_label,evidence_status,counterparty,parent_evidence_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
             (eid,vid,line,cid,source_type,ledger,amount,unit,str(amount),period,status,counterparty,parent))

def expect_status(r,code):
    assert r.status_code==code, f'Expected HTTP {code}; received {r.status_code}: {r.text[:280]}'
    return f'HTTP {r.status_code}'

def expect_reject(r,code_set={400,422}):
    assert r.status_code in code_set, f'Expected rejection {sorted(code_set)}; received {r.status_code}: {r.text[:280]}'
    return f'HTTP {r.status_code}'

def check(cond,message):
    assert cond,message
    return message

# Seed, preservation and required system state
@case('Seed & original data','38-row catalog and 9 tables','P0','Core','38 seeded criteria; 9 tables present')
def t01(e):
    s=e.state(); check(len(s['criteria_catalog'])==38,'Criteria not 38')
    return check(len(e.req('GET','/api/export',role=R).json())==9,'Tables not 9')
@case('Seed & original data','Exactly three required anonymised cases seeded','P0','Core','Cases A, B, C present')
def t02(e): return check({v['id'] for v in e.state()['ventures']}=={'case-a','case-b','case-c'},'Wrong venture IDs')
@case('Seed & original data','Unknown original programme levels preserved','P0','Core','Case A & B Unknown; C Level 2')
def t03(e):
 s={v['id']:v['programme_level'] for v in e.state()['ventures']};return check(s=={'case-a':'Unknown','case-b':'Unknown','case-c':'Level 2'},str(s))
@case('Seed & original data','Imported MSL eligibility retained','P0','Core','B/C eligible; acceptance unknown')
def t04(e):
 s={v['id']:v for v in e.state()['ventures']};return check(all(s[x]['msl_eligibility']=='Eligible for MSL' and s[x]['msl_acceptance_status']=='Unknown' for x in ('case-b','case-c')),'Historical eligibility lost/inferred acceptance')
@case('Seed & original data','Imported historical financial baselines kept isolated','P0','Core','B=₹12L and C=₹1.3Cr, not combined')
def t05(e):
 s={v['id']:v for v in e.state()['ventures']};return check(s['case-b']['historical_traction_amount_paise']==120000000 and s['case-c']['historical_traction_amount_paise']==1300000000,'Wrong baseline')
@case('Seed & original data','Case C direct-entry history retained','P0','Core','Level 2 imported, unknown reviewer and date')
def t06(e):
 t=[v for v in e.state()['transitions'] if v['venture_id']=='case-c'];return check(len(t)>0 and t[0]['transition_type']=='HISTORICAL_IMPORTED' and t[0]['approved_at']=='Unknown','History incorrect')
@case('Seed & original data','Five initial L0 qualitative requirements unknown','P0','Core','Each L0-Q result UNKNOWN')
def t07(e):return check(all(e.criterion('case-a',None,f'L0-Q{i}')['criterion_result']=='UNKNOWN' for i in range(1,6)),'Unknown qualitative evidence lost')
@case('Seed & original data','Business lines separated for Case B','P0','Core','B services and SaaS lines distinct')
def t08(e):
 lines=[l['id'] for l in e.state()['venture_business_lines'] if l['venture_id']=='case-b'];return check(set(lines)=={'bl-b-services','bl-b-saas'},str(lines))
@case('Seed & original data','Case A source sign-up/W AU are unreviewed','P0','Core','A-E01 unreviewed; no criterion MET')
def t09(e):
 s=e.state(); a=next(x for x in s['evidence'] if x['id']=='A-E01'); c=e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2');return check(a['evidence_status']=='UNREVIEWED' and c['criterion_result']=='UNKNOWN','Seed improperly verified')

# Import and data identity
@case('Venture import','Valid new venture imports without requiring 3-only limit','P0','Core','201 and new venture visible')
def t10(e):
 r=e.req('POST','/api/ventures',{'name':'Extra Test Venture','activity':'Small service pilot','model_resolution_status':'UNRESOLVED','business_lines':[{'line_name':'Services','candidate_models':['Services']}]},O)
 expect_status(r,201);return check(any(v['id']==r.json()['id'] for v in e.state()['ventures']),'Not visible')
@case('Venture import','Blank venture name rejected','P1','Integrity','422')
def t11(e):return expect_status(e.req('POST','/api/ventures',{'name':'','activity':'Test'},O),422)
@case('Venture import','Contradictory unresolved model import rejected','P1','Integrity','422')
def t12(e):return expect_status(e.req('POST','/api/ventures',{'name':'Bad','activity':'Test','primary_business_model':'AI_B2C','model_resolution_status':'UNRESOLVED'},O),422)
@case('Venture import','Confirmed model without governing line rejected','P1','Integrity','422')
def t13(e):return expect_status(e.req('POST','/api/ventures',{'name':'Bad','activity':'Test','model_resolution_status':'CONFIRMED','primary_business_model':'Services'},O),422)
@case('Venture import','Unrecognised programme level rejected','P1','Integrity','422 rather than silently saving Level 99')
def t14(e):return expect_status(e.req('POST','/api/ventures',{'name':'Bad Level','activity':'Test','programme_level':'Level 99','source_type':'Test'},O),422)
@case('Venture import','Duplicate venture ID rejected with controlled 4xx','P1','Integrity','Controlled 4xx')
def t15(e):return expect_reject(e.req('POST','/api/ventures',{'id':'case-a','name':'Duplicate','activity':'Test'},O))
@case('Venture import','Invalid model enum rejected','P1','Integrity','422')
def t16(e):return expect_status(e.req('POST','/api/ventures',{'name':'Bad Model','activity':'Test','primary_business_model':'AI_Product'},O),422)
@case('Venture import','Wrong business line structure rejected','P1','Integrity','422')
def t17(e):return expect_status(e.req('POST','/api/ventures',{'name':'Bad Line','activity':'Test','business_lines':[{}]},O),422)
@case('Venture import','Venture added by student denied','P1','Core','403')
def t18(e):return expect_status(e.req('POST','/api/ventures',{'name':'No Permission','activity':'Test'},S),403)
@case('Venture import','Import extra venture preserves Unknown rather than zero','P0','Core','programme_level Unknown, msl Unknown')
def t19(e):
 r=e.req('POST','/api/ventures',{'name':'New Venture','activity':'Test'},O); expect_status(r,201)
 v=next(x for x in e.state()['ventures'] if x['id']==r.json()['id']);return check(v['programme_level']=='Unknown' and v['msl_eligibility']=='Unknown','Unknown coerced')

# Updates, data input, provenance
@case('Progress update','Valid multi-measurement founder update is created','P0','Core','201, unreviewed evidence and observations')
def t20(e):
 r=e.update();expect_status(r,201); s=e.state();ev=next(x for x in s['evidence'] if x['id']==r.json()['evidence_id']);return check(ev['evidence_status']=='UNREVIEWED' and len(r.json()['observations'])==1,'Incorrect submission')
@case('Progress update','Unknown venture ID rejected','P0','Core','4xx')
def t21(e):return expect_reject(e.update(venture_id='does-not-exist'))
@case('Progress update','Atomic metric can substitute for optional summary label','P1','Core','201 if observation carries metric and claim value')
def t22(e):return expect_status(e.update(summary_metric=None),201)
@case('Progress update','Atomic observation period can substitute for summary period','P1','Core','201 if observation period is populated')
def t23(e):return expect_status(e.update(summary_period=None),201)
@case('Progress update','Missing evidence reference and content rejected','P0','Core','422; cannot create empty evidence')
def t24(e):return expect_status(e.update(evidence={}),422)
@case('Progress update','Missing next action rejected','P0','Core','422')
def t25(e):return expect_status(e.update(next_action=None),422)
@case('Progress update','Missing blocker state rejected','P1','Core','422 or explicit No blocker value')
def t26(e):return expect_status(e.update(blocker=None),422)
@case('Progress update','Missing claims and no observations rejected','P0','Core','422')
def t27(e):return expect_status(e.update(claimed_metrics_json=None,observations=[]),422)
@case('Progress update','Negative metric count rejected','P0','Integrity','422')
def t28(e):
 obs=[{'criterion_id':'L0L1-AIB2C-2','metric_type':'WAU','period_label':'Week ending 18 October','numeric_value':-100,'unit':'COUNT'}]
 return expect_status(e.update(observations=obs),422)
@case('Progress update','Fractional weekly-user count rejected','P1','Integrity','422')
def t29(e):
 obs=[{'criterion_id':'L0L1-AIB2C-2','metric_type':'WAU','period_label':'Week ending 18 October','numeric_value':1.5,'unit':'COUNT'}]
 return expect_status(e.update(observations=obs),422)
@case('Progress update','Foreign venture business-line association rejected','P0','Integrity','4xx, not cross-venture association')
def t30(e):return expect_reject(e.update(venture_id='case-a',line='bl-b-services',crit='L0L1-SRV-1'))
@case('Progress update','Cross-venture parent evidence association rejected','P0','Integrity','4xx, not attach case A to C-E01')
def t31(e):
 r=e.update(evidence={'source_type':'Receipt','ledger_bucket':'COLLECTED','parent_evidence_id':'C-E01','amount_minor_or_count':10000,'unit':'INR_PAISE','period_label':'October'})
 return expect_reject(r)
@case('Progress update','Duplicate update ID returns controlled conflict','P1','Integrity','4xx rather than 500')
def t32(e):
 expect_status(e.update(id='DUPLICATE-U'),201);return expect_reject(e.update(id='DUPLICATE-U'))
@case('Progress update','Existing evidence ID from another venture rejected','P0','Integrity','4xx on wrong venture evidence reuse')
def t33(e):return expect_reject(e.update(venture_id='case-a',evidence_id='B-E01'))
@case('Progress update','Malformed claims JSON rejected','P1','Integrity','422')
def t34(e):return expect_status(e.update(claimed_metrics_json='not-json'),422)
@case('Progress update','Invalid criterion ID rejected gracefully','P1','Integrity','Controlled 4xx')
def t35(e):return expect_reject(e.update(crit='FAKE-CRITERION'))
@case('Progress update','Submitted timestamp generated server-side','P1','Integrity','Client cannot impersonate submission date')
def t36(e):
 r=e.update(submitted_at='1900-01-01T00:00:00Z');expect_status(r,201)
 s=e.state();u=next(x for x in s['progress_updates'] if x['id']==r.json()['id']);return check(u['submitted_at']!='1900-01-01T00:00:00Z','Client-supplied forged date was accepted')
@case('Progress update','Student can submit an allowed update','P0','Core','201')
def t37(e):return expect_status(e.update(),201)

# Review and history
@case('Evidence review','Reviewer approves original claim','P0','Core','200; approved status and audit trail')
def t38(e):
 expect_status(e.approval('A-E01'),200);s=e.state();ev=next(x for x in s['evidence'] if x['id']=='A-E01');return check(ev['evidence_status']=='APPROVED' and any(h['evidence_id']=='A-E01' for h in s['history']),'No audit')
@case('Evidence review','Reviewer requests changes and queue follow-up','P0','Core','CHANGES_REQUESTED and follow-up')
def t39(e):
 expect_status(e.approval('A-E01','CHANGES_REQUESTED'),200);s=e.state();return check(any(x['id']=='A-E01' for x in s['staff_queue']['pending_actions']),'No followup')
@case('Evidence review','Blank reviewer reason rejected','P0','Core','422')
def t40(e):return expect_status(e.approval('A-E01',reason=''),422)
@case('Evidence review','Blank reviewer identity rejected','P0','Core','422')
def t41(e):return expect_status(e.approval('A-E01',reviewer=''),422)
@case('Evidence review','Invalid review decision rejected','P1','Integrity','4xx')
def t42(e):return expect_reject(e.approval('A-E01','DELETE_EVIDENCE'))
@case('Evidence review','Nonexistent evidence denied','P1','Integrity','404')
def t43(e):return expect_status(e.approval('does-not-exist'),404)
@case('Evidence review','Student cannot approve evidence','P0','Core','403')
def t44(e):return expect_status(e.req('POST','/api/evidence/A-E01/review',{'decision':'APPROVED','reason':'Try'},S),403)
@case('Evidence review','Programme Owner cannot impersonate reviewer','P1','Core','403')
def t45(e):return expect_status(e.req('POST','/api/evidence/A-E01/review',{'decision':'APPROVED','reason':'Try'},O),403)
@case('Evidence review','Multiple reviews retained in append-only history','P0','Core','2 audit rows after change request then approval')
def t46(e):
 expect_status(e.approval('A-E01','CHANGES_REQUESTED'),200);expect_status(e.approval('A-E01','APPROVED'),200)
 return check(len([h for h in e.state()['history'] if h['evidence_id']=='A-E01'])==2,'Lost review history')
@case('Evidence review','Original source remains unchanged after review','P0','Core','Original A-01 claim retained')
def t47(e):
 orig=next(x for x in e.state()['progress_updates'] if x['id']=='A-01')['claimed_metrics_json'];expect_status(e.approval('A-E01'),200)
 aft=next(x for x in e.state()['progress_updates'] if x['id']=='A-01')['claimed_metrics_json'];return check(orig==aft,'Original claim changed')

# Criterion calculation and observations
@case('Criteria & evidence','A-E01 approval yields WAU NOT_MET and signup UNKNOWN','P0','Core','NOT_MET / UNKNOWN')
def t48(e):
 expect_status(e.approval('A-E01'),200);return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']=='NOT_MET' and e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']=='UNKNOWN','Conflated status')
@case('Criteria & evidence','L0-Q1 cannot pass without mentor signoff','P0','Core','IN_PROGRESS, not MET')
def t49(e):
 e.add_evidence('Q1-INCOMPLETE','case-a',None,'L0-Q1');e.add_observation('Q1O','Q1-INCOMPLETE','case-a',None,'L0-Q1','QUALITATIVE',None,'October',1,'met',{'met':True,'canvas_evidence':True,'mentor_sign_off':False})
 return check(e.criterion('case-a',None,'L0-Q1')['criterion_result']!='MET','L0-Q1 marked MET without mentor signoff')
@case('Criteria & evidence','L0-Q3 cannot pass 1 of 55 conversations','P0','Core','IN_PROGRESS, not MET')
def t50(e):
 e.add_evidence('Q3-INCOMPLETE','case-a',None,'L0-Q3');e.add_observation('Q3O','Q3-INCOMPLETE','case-a',None,'L0-Q3','COUNT',1,'October',1,'met',{'met':True,'unique_conversations':1,'weeks_spanned':1,'target_segment':1,'workaround_users':1})
 return check(e.criterion('case-a',None,'L0-Q3')['criterion_result']!='MET','L0-Q3 false MET on inadequate counts')
@case('Criteria & evidence','L0-Q5 requires predeclared test result and decision','P0','Core','Not MET without recorded decision')
def t51(e):
 e.add_evidence('Q5-INCOMPLETE','case-a',None,'L0-Q5');e.add_observation('Q5O','Q5-INCOMPLETE','case-a',None,'L0-Q5','QUALITATIVE',None,'October',1,'met',{'met':True,'predeclared_test':True,'recorded_result':True,'recorded_decision':False})
 return check(e.criterion('case-a',None,'L0-Q5')['criterion_result']!='MET','L0-Q5 false MET')
@case('Criteria & evidence','WAU original two-week result below threshold','P0','Core','12,8 -> NOT_MET')
def t52(e):
 expect_status(e.approval('A-E01'),200);return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']=='NOT_MET','WAU wrong')
@case('Criteria & evidence','Corrected 12,11 two-week WAU passes','P0','Core','12,11 -> MET after approved replacement')
def t53(e):
 expect_status(e.approval('A-E01'),200)
 obs=[{'id':'WAU2-CORR','criterion_id':'L0L1-AIB2C-2','metric_type':'WAU','period_label':'Week ending 11 October','period_sequence':2,'numeric_value':11,'unit':'COUNT','supersedes_observation_id':'A-E01-W2'}]
 r=e.update(ev_id='WAU2-NEW',observations=obs);expect_status(r,201);expect_status(e.approval('WAU2-NEW'),200)
 ev=e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2');return check(ev['criterion_result']=='MET' and ev['verified_readings']==[12,11],str(ev))
@case('Criteria & evidence','Unreviewed correction does not replace approved WAU','P0','Core','12,8 remain; new 11 pending')
def t54(e):
 expect_status(e.approval('A-E01'),200)
 obs=[{'id':'WAU2-UNREVIEWED','criterion_id':'L0L1-AIB2C-2','metric_type':'WAU','period_label':'Week ending 11 October','period_sequence':2,'numeric_value':11,'unit':'COUNT','supersedes_observation_id':'A-E01-W2'}]
 expect_status(e.update(ev_id='WAU2-UNREVIEWED-EV',observations=obs),201)
 ev=e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2');return check(ev['criterion_result']=='NOT_MET' and ev['verified_readings']==[12,8] and ev['pending_corrections'],'Incorrect supersession')
@case('Criteria & evidence','Non-consecutive WAU weeks must not meet two-week rule','P0','Core','Week indices 1 and 5 -> NOT_MET/IN_PROGRESS')
def t55(e):
 expect_status(e.approval('A-E01'),200)
 e.sql("UPDATE evidence_observations SET period_sequence=5, period_label='Week ending 1 November', numeric_value=11 WHERE id='A-E01-W2'")
 return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']!='MET','Gap 1->5 falsely counted as consecutive')
@case('Criteria & evidence','Duplicate WAU week cannot count as two consecutive weeks','P0','Core','Same reporting period twice -> NOT_MET')
def t56(e):
 expect_status(e.approval('A-E01'),200)
 e.sql("UPDATE evidence_observations SET period_sequence=1, period_label='Week ending 4 October', numeric_value=11 WHERE id='A-E01-W2'")
 return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']!='MET','Duplicate week counted as two weeks')
@case('Criteria & evidence','Unrecorded target segment 32 signups cannot pass','P0','Core','UNKNOWN')
def t57(e):
 expect_status(e.approval('A-E01'),200);return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']=='UNKNOWN','Source unknown inferred')
@case('Criteria & evidence','Thirty confirmed target-segment signups pass','P0','Core','MET')
def t58(e):
 e.add_evidence('SIGNED-UP-30','case-a','bl-a-b2c','L0L1-AIB2C-1')
 e.add_observation('SO30','SIGNED-UP-30','case-a','bl-a-b2c','L0L1-AIB2C-1','COUNT',30,'October',1,'QUALIFIED')
 return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']=='MET','Qualified 30 not MET')
@case('Criteria & evidence','Cumulative signup snapshots must not be added','P0','Integrity','20 snapshot then 20 snapshot does not prove 30 unique')
def t59(e):
 for k in (1,2):
  eid=f'SNAPSHOT-{k}';e.add_evidence(eid,'case-a','bl-a-b2c','L0L1-AIB2C-1')
  e.add_observation(f'SNAP-OBS-{k}',eid,'case-a','bl-a-b2c','L0L1-AIB2C-1','COUNT',20,f'Week {k}',k,'QUALIFIED')
 return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']!='MET','20+20 cumulative snapshots double counted')
@case('Criteria & evidence','Same paying client on multiple receipts cannot count twice','P0','Core','Distinct paying client count=1, not 2')
def t60(e):
 for k in (1,2):
  eid=f'CLIENTPAY-{k}';e.add_evidence(eid,'case-b','bl-b-services','L0L1-SRV-2',ledger='COLLECTED',amount=100000,unit='INR_PAISE',counterparty='Factory X')
  e.add_observation(f'CL-OBS-{k}',eid,'case-b','bl-b-services','L0L1-SRV-2','COUNT',1,'October',k,'PAYING',entity='Factory X')
 return check(e.criterion('case-b','bl-b-services','L0L1-SRV-2')['criterion_result']!='MET','One payer counted as two paying clients')
@case('Criteria & evidence','Duplicate LOI document cannot satisfy 3-LOI rule','P0','Core','Two copies + original same prospect not 3 qualifying LOIs')
def t61(e):
 expect_status(e.approval('B-E01'),200)
 for k in (1,2):e.add_evidence(f'B-LOI-COPY-{k}','case-b','bl-b-saas','L1L2-AIB2B-1',ledger='COMMERCIAL_INTENT',counterparty='Prospective SaaS customer',source_type='Signed LOI')
 return check(e.criterion('case-b','bl-b-saas','L1L2-AIB2B-1')['criterion_result']!='MET','Duplicate same LOI counted as multiple agreements')
@case('Criteria & evidence','LOI does not certify completed pilot','P0','Core','Completed pilot remains UNKNOWN')
def t62(e):
 expect_status(e.approval('B-E01'),200);return check(e.criterion('case-b','bl-b-saas','L1L2-AIB2B-2')['criterion_result']=='UNKNOWN','LOI inferred as pilot')
@case('Criteria & evidence','Unconfigured MSL rules remain BLOCKED','P0','Core','MSL-SRV-3 BLOCKED')
def t63(e):return check(e.criterion('case-c','bl-c-main','MSL-SRV-3')['criterion_result']=='BLOCKED','Threshold guessed')
@case('Criteria & evidence','Unreviewed evidence must not satisfy demand bar','P0','Core','Case A WAU remains UNKNOWN')
def t64(e):return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']=='UNKNOWN','Unreviewed MET')
@case('Criteria & evidence','Actual collected services cash may satisfy cash bar regardless of evidence tag','P0','Core','Eligible collected cash must count within Services line')
def t65(e):
 e.add_evidence('UNRELATED-CASH','case-b','bl-b-services','L0L1-SRV-1',ledger='COLLECTED',amount=2000000,unit='INR_PAISE')
 return check(e.criterion('case-b','bl-b-services','L0L1-SRV-3')['criterion_result']=='MET','Approved Services cash not counted')
@case('Criteria & evidence','Observation and receipt representing same cash must not double count','P0','Core','₹8k collected + same ₹8k observation < ₹15k threshold')
def t66(e):
 eid='RECEIPT-8K';e.add_evidence(eid,'case-b','bl-b-services','L0L1-SRV-3',ledger='COLLECTED',amount=800000,unit='INR_PAISE')
 e.add_observation('R8K-O',eid,'case-b','bl-b-services','L0L1-SRV-3','CASH_COLLECTED',800000,'October',1,'QUALIFIED',unit='INR_PAISE')
 return check(e.criterion('case-b','bl-b-services','L0L1-SRV-3')['criterion_result']!='MET','Same ₹8k double counted to ₹16k')
@case('Criteria & evidence','MSL 35 WAU four-week rule remains BLOCKED before configuration','P0','Core','BLOCKED')
def t67(e):return check(e.criterion('case-a','bl-a-b2c','L1L2-AIB2C-1')['criterion_result']=='BLOCKED','Ambiguous rule guessed')

# Finance and linkage
@case('Financial reconciliation','Case B claimed invoice receipt show ₹40k difference','P0','Core','100k billed/60k received/40k claimed difference')
def t68(e):
 l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check((l['claimed_billed_paise'],l['claimed_collected_paise'],l['claimed_arithmetic_difference_paise'])==(10000000,6000000,4000000),'Wrong claimed ledger')
@case('Financial reconciliation','Case B unreviewed financial amounts not verified','P0','Core','Verified amounts Unknown')
def t69(e):
 l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check(l['billed_paise'] is None and l['collected_paise'] is None,'False verified amount')
@case('Financial reconciliation','Case B approved invoice+receipt still no double counting','P0','Core','Billed 100k; Collected 60k; difference 40k')
def t70(e):
 expect_status(e.approval('B-E02'),200);expect_status(e.approval('B-E03'),200)
 l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check((l['billed_paise'],l['collected_paise'],l['arithmetic_difference_paise'])==(10000000,6000000,4000000),'Financial reconciliation wrong')
@case('Financial reconciliation','Case C payout recorded in September earnings chain','P0','Core','80k earned, 70k payout, 10k unreconciled')
def t71(e):
 expect_status(e.approval('C-E01'),200);expect_status(e.approval('C-E02'),200)
 l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-c-main');return check((l['earned_paise'],l['collected_paise'],l['arithmetic_difference_paise'])==(8000000,7000000,1000000),'C chain wrong')
@case('Financial reconciliation','Unpaid sponsorship invoice not classified Collected','P0','Core','Billed only')
def t72(e):
 r=next(x for x in e.state()['evidence'] if x['id']=='C-E03');return check(r['ledger_bucket']=='BILLED' and r['amount_minor_or_count']==12000000,'Incorrect sponsorship classification')
@case('Financial reconciliation','Signed SaaS LOI does not create money','P0','Core','0 earned/collected from LOI')
def t73(e):
 expect_status(e.approval('B-E01'),200);l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-saas');return check(l['billed_paise'] is None and l['collected_paise'] is None,'LOI money inferred')
@case('Financial reconciliation','Approved child receipt with unapproved invoice stays partially verified','P0','Core','Collected verified, parent billed Unknown, diff Unknown')
def t74(e):
 expect_status(e.approval('B-E03'),200);l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check(l['collected_paise']==6000000 and l['billed_paise'] is None and l['arithmetic_difference_paise'] is None,'Unsupported balance')
@case('Financial reconciliation','Negative payment receipt cannot increase negative collected money','P1','Integrity','Reject negative payment value')
def t75(e):
 eid='NEG-CASH';e.add_evidence(eid,'case-b','bl-b-services','L0L1-SRV-3',ledger='COLLECTED',amount=-2000000,unit='INR_PAISE',status='UNREVIEWED')
 r=e.approval(eid);expect_status(r,200)
 l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check(l['collected_paise'] is None or l['collected_paise']>=0,'Negative payment accepted as positive cash')
@case('Financial reconciliation','Explicit approved zero is distinct from Unknown','P0','Core','0 paise shown as verified zero rather than Unknown')
def t76(e):
 e.add_evidence('ZERO','case-b','bl-b-services','L0L1-SRV-3',ledger='COLLECTED',amount=0,unit='INR_PAISE')
 l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check(l['collected_paise']==0,'Verified zero erased as Unknown')
@case('Financial reconciliation','Historical Case B baseline never added to invoice cash','P0','Core','120000000 paise baseline isolated')
def t77(e):
 expect_status(e.approval('B-E02'),200);l=next(l for l in e.state()['ledgers'] if l['business_line_id']=='bl-b-services');return check(l['historical_baseline_paise']==120000000 and l['billed_paise']==10000000,'Baseline mixed')

# Progressions and decisions
@case('Transitions','Unresolved A model blocks STANDARD_ADVANCEMENT','P0','Core','400 with blocking reasons')
def t78(e):
 r=e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 1','transition_type':'STANDARD_ADVANCEMENT','reason':'test','approved_by':'Demo'},R);expect_status(r,400);return check('blocking_reasons' in r.text,'No blockers')
@case('Transitions','Student cannot approve level advancement','P0','Core','403')
def t79(e):return expect_status(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'DIRECT_ENTRY','reason':'test'},S),403)
@case('Transitions','Direct entry to Level 2 succeeds with reviewer reason','P0','Core','200; immutable decision history')
def t80(e):
 r=e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'DIRECT_ENTRY','approved_by':'Demo','reason':'Documented prior work'},R);expect_status(r,200)
 return check(any(x['to_level']=='Level 2' and x['transition_type']=='DIRECT_ENTRY' for x in e.state()['transitions'] if x['venture_id']=='case-a'),'Missing transition history')
@case('Transitions','Direct entry requires non-empty justification','P0','Core','422/400 for empty reason')
def t81(e):return expect_reject(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'DIRECT_ENTRY','approved_by':'Demo','reason':''},R))
@case('Transitions','Direct entry not allowed to Level 0','P1','Integrity','4xx (direct entry is to advanced levels)')
def t82(e):return expect_reject(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 0','transition_type':'DIRECT_ENTRY','approved_by':'Demo','reason':'prior work'},R))
@case('Transitions','Unknown target level rejected','P0','Core','4xx')
def t83(e):return expect_reject(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'MSL_ELIGIBLE','transition_type':'DIRECT_ENTRY','reason':'test'},R))
@case('Transitions','Non-sequential standard advancement rejected','P0','Core','400')
def t84(e):
 e.sql("UPDATE ventures SET programme_level='Level 0',primary_business_model='AI_B2C',model_resolution_status='CONFIRMED' WHERE id='case-a'")
 r=e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'STANDARD_ADVANCEMENT','reason':'test'},R);return expect_status(r,400)
@case('Transitions','Case C cannot standard advance beyond Level 2','P0','Core','4xx')
def t85(e):return expect_reject(e.req('POST','/api/ventures/case-c/transitions',{'to_level':'Level 2','transition_type':'STANDARD_ADVANCEMENT','reason':'test'},R))
@case('Transitions','Standard advance blocked when required criteria are Unknown','P0','Core','400')
def t86(e):
 e.sql("UPDATE ventures SET programme_level='Level 0',primary_business_model='AI_B2C',model_resolution_status='CONFIRMED' WHERE id='case-a'")
 e.sql("UPDATE venture_business_lines SET approved_model='AI_B2C',track_role='ACTIVE_GOVERNING' WHERE id='bl-a-b2c'")
 r=e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 1','transition_type':'STANDARD_ADVANCEMENT','reason':'test'},R);return expect_status(r,400)
@case('Transitions','Standard advancement with no required evaluated criteria must fail closed','P0','Integrity','Reject empty/missing gate evidence')
def t87(e):
 e.sql("UPDATE ventures SET programme_level='Level 1',primary_business_model='Services',model_resolution_status='CONFIRMED' WHERE id='case-a'")
 e.sql("UPDATE venture_business_lines SET approved_model='AI_B2B',track_role='ACTIVE_GOVERNING' WHERE id='bl-a-b2b'")
 r=e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'STANDARD_ADVANCEMENT','reason':'test'},R)
 return expect_reject(r)
@case('Transitions','Transition approval timestamp generated on server','P0','Core','Ignores client forged approved_at')
def t88(e):
 r=e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 1','transition_type':'DIRECT_ENTRY','approved_by':'Demo','reason':'prior work','approved_at':'1800-01-01T00:00:00Z'},R);expect_status(r,200)
 return check(r.json()['approved_at']!='1800-01-01T00:00:00Z','Client forged approved_at')
@case('Transitions','Reviewer approval without identity rejected','P0','Core','4xx')
def t89(e):return expect_reject(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'DIRECT_ENTRY','approved_by':'','reason':'prior work'},R))

# Model clarification, configuration, acceptance
@case('Owner actions','Owner can clarify A model preserving historical track','P0','Core','Case A confirmed AI B2B; old track retained')
def t90(e):
 r=e.req('POST','/api/ventures/case-a/seam-actions',{'action':'CLARIFY_MODEL','approved_model':'AI_B2B','business_line_id':'bl-a-b2b','note':'Clarified'},O);expect_status(r,200)
 s=e.state();v=next(x for x in s['ventures'] if x['id']=='case-a');b2c=next(x for x in s['venture_business_lines'] if x['id']=='bl-a-b2c');return check(v['primary_business_model']=='AI_B2B' and b2c['track_role']=='HISTORICAL_PRESERVED','Model/history incorrect')
@case('Owner actions','Mentor cannot configure threshold','P0','Core','403')
def t91(e):return expect_status(e.req('POST','/api/criteria/MSL-SRV-3/configure',{'configured_value':35,'configured_rule':{'aggregation_method':'EXACT'}},M),403)
@case('Owner actions','Owner can configure programme rule','P0','Core','200 and configured_by/timestamp set')
def t92(e):
 r=e.req('POST','/api/criteria/MSL-SRV-3/configure',{'configured_value':35,'configured_rule':{'aggregation_method':'PERCENT','cohort_definition':'Configured cohort','window_weeks':3}},O);expect_status(r,200)
 return check(next(x for x in e.state()['criteria_catalog'] if x['id']=='MSL-SRV-3')['configured_at'] is not None,'No timestamp')
@case('Owner actions','Unknown or invalid configuration cannot turn criterion ready','P0','Integrity','422, no write, remains BLOCKED')
def t93(e):
 before=next(x for x in e.state()['criteria_catalog'] if x['id']=='L1L2-AIB2C-1')
 r=e.req('POST','/api/criteria/L1L2-AIB2C-1/configure',{'configured_value':35,'configured_rule':{'aggregation_method':'MADE_UP','window_weeks':4}},O);expect_status(r,422)
 after=next(x for x in e.state()['criteria_catalog'] if x['id']=='L1L2-AIB2C-1')
 ev=e.criterion('case-a','bl-a-b2c','L1L2-AIB2C-1');return check(before==after and ev['criterion_result']=='BLOCKED','Invalid rule was written or resolved')
@case('Owner actions','Student cannot change programme model','P0','Core','403')
def t94(e):return expect_status(e.req('POST','/api/ventures/case-a/seam-actions',{'action':'CLARIFY_MODEL','approved_model':'AI_B2B'},S),403)
@case('Owner actions','Mentor can record post-work outcome','P1','Core','200 and mentor status updated')
def t95(e):
 r=e.req('POST','/api/ventures/case-c/seam-actions',{'action':'LOG_MENTOR_OUTCOME','mentor_status':'Meeting outcome recorded','mentor_goal':'Follow-up','next_update_date':'Not supplied'},M);expect_status(r,200)
 return check(next(v for v in e.state()['ventures'] if v['id']=='case-c')['mentor_status']=='Meeting outcome recorded','No outcome')
@case('Owner actions','Student cannot log mentor outcome','P1','Integrity','403')
def t96(e):return expect_status(e.req('POST','/api/ventures/case-c/seam-actions',{'action':'LOG_MENTOR_OUTCOME','mentor_status':'Edited'},S),403)
@case('Owner actions','New MSL certification not allowed from partial evidence','P0','Core','400 preserves existing MSL eligibility')
def t97(e):
 r=e.req('POST','/api/ventures/case-c/msl-eligibility',{'approved_by':'Demo','reason':'Test'},R);expect_status(r,400)
 return check(next(v for v in e.state()['ventures'] if v['id']=='case-c')['msl_eligibility']=='Eligible for MSL','Imported eligibility erased')
@case('Owner actions','No cross-venture model clarification allowed','P1','Integrity','4xx on a business line belonging to another venture')
def t98(e):return expect_reject(e.req('POST','/api/ventures/case-a/seam-actions',{'action':'CLARIFY_MODEL','approved_model':'Services','business_line_id':'bl-b-services'},O))

# Permissions/queue/export/import
@case('Permissions & queue','Student reset is forbidden','P0','Core','403')
def t99(e):return expect_status(e.req('POST','/api/reset',role=S),403)
@case('Permissions & queue','Student import is forbidden','P0','Core','403')
def t100(e):return expect_status(e.req('POST','/api/import',{},S),403)
@case('Permissions & queue','Mentor cannot record transition','P0','Core','403')
def t101(e):return expect_status(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 2','transition_type':'DIRECT_ENTRY','reason':'test'},M),403)
@case('Permissions & queue','No role can approve evidence','P0','Core','403 when header missing')
def t102(e):return expect_status(e.req('POST','/api/evidence/A-E01/review',{'decision':'APPROVED','reviewer':'Test','reason':'test'}),403)
@case('Permissions & queue','Staff queue includes initial unreviewed evidence','P0','Core','A-E01, B-E01..03, C-E01..03')
def t103(e):
 q=e.state()['staff_queue']['unreviewed_evidence'];return check({i['id'] for i in q}>={'A-E01','B-E01','B-E02','B-E03','C-E01','C-E02','C-E03'},'Queue lacks unreviewed')
@case('Permissions & queue','Staff queue removes reviewed item after approval','P0','Core','A-E01 removed from unreviewed')
def t104(e):
 expect_status(e.approval('A-E01'),200)
 return check(not any(x['id']=='A-E01' for x in e.state()['staff_queue']['unreviewed_evidence']),'Approved evidence still queued for review')
@case('Permissions & queue','Staff queue flags unresolved business models','P0','Core','Cases A and B owner clarification')
def t105(e):
 q=e.state()['staff_queue']['owner_clarifications'];return check({'case-a','case-b'}<={x.get('venture_id') for x in q},'Missing model clarification')
@case('Permissions & queue','Unknown mentor action appears in staff follow-ups','P0','Core','Case C missing outcome followed up')
def t106(e):
 q=e.state()['staff_queue']['mentor_followups'];return check(any(x['venture_id']=='case-c' for x in q),'Case C mentor omission not queued')
@case('Permissions & queue','JSON export has all 9 tables','P0','Core','Nine tables serialized')
def t107(e):return check(len(e.req('GET','/api/export',role=R).json())==9,'Export incomplete')
@case('Permissions & queue','JSON export/import round-trip retains evidence status','P0','Core','Approved A-E01 remains approved after round-trip')
def t108(e):
 expect_status(e.approval('A-E01'),200);data=e.req('GET','/api/export',role=R).json()
 expect_status(e.req('POST','/api/import',data,O),200)
 st=e.state();return check(next(x for x in st['evidence'] if x['id']=='A-E01')['evidence_status']=='APPROVED','History lost on import')
@case('Permissions & queue','Missing mandatory export tables rejected on import','P0','Integrity','4xx; cannot wipe all records with {}')
def t109(e):
 r=e.req('POST','/api/import',{},O)
 if r.status_code>=400: return f'HTTP {r.status_code}; rejected incomplete export'
 n=len(e.state()['ventures']);return check(False,f'HTTP {r.status_code}; empty import accepted leaving {n} ventures')
@case('Permissions & queue','Invalid import atomicity preserves existing seeded data','P0','Integrity','4xx and original venture records unchanged')
def t110(e):
 r=e.req('POST','/api/import',{'ventures':[{'id':'x','name':'Imported'}]},O)
 s=e.state();return check(r.status_code>=400 and len(s['ventures'])==3,f'HTTP {r.status_code}, remaining ventures={len(s["ventures"])}')
@case('Permissions & queue','Reset recreates seeded 3 ventures and original evidence','P0','Core','3 original ventures; 7 evidence after reset')
def t111(e):
 expect_status(e.approval('A-E01'),200);expect_status(e.req('POST','/api/reset',role=O),200)
 st=e.state();return check(len(st['ventures'])==3 and len(st['evidence'])==7 and next(x for x in st['evidence'] if x['id']=='A-E01')['evidence_status']=='UNREVIEWED','Reset incorrect')

# Final cross-case and UI contract checks
@case('Cross-case isolation','Approving Case A evidence never changes B/C source records','P0','Core','Only A-E01 status changes')
def t112(e):
 before={x['id']:x['evidence_status'] for x in e.state()['evidence']};expect_status(e.approval('A-E01'),200)
 after={x['id']:x['evidence_status'] for x in e.state()['evidence']};return check(all(after[k]==v for k,v in before.items() if not k.startswith('A-')),'Other venture evidence modified')
@case('Cross-case isolation','Case B owner change does not change Case A model','P0','Core','Case A remains UNRESOLVED')
def t113(e):
 expect_status(e.req('POST','/api/ventures/case-b/seam-actions',{'action':'CLARIFY_MODEL','approved_model':'Services','business_line_id':'bl-b-services'},O),200)
 a=next(x for x in e.state()['ventures'] if x['id']=='case-a');return check(a['model_resolution_status']=='UNRESOLVED','Case A model changed')
@case('Cross-case isolation','Advancing Case A does not overwrite Case C history','P0','Core','Case C historical decision intact')
def t114(e):
 before=[x for x in e.state()['transitions'] if x['venture_id']=='case-c'];expect_status(e.req('POST','/api/ventures/case-a/transitions',{'to_level':'Level 1','transition_type':'DIRECT_ENTRY','reason':'test'},R),200)
 after=[x for x in e.state()['transitions'] if x['venture_id']=='case-c'];return check(before==after,'Case C history modified')
@case('Cross-case isolation','Case B Services revenue not shown under SaaS','P0','Core','SaaS billed and cash Unknown')
def t115(e):
 expect_status(e.approval('B-E02'),200);expect_status(e.approval('B-E03'),200)
 l=next(x for x in e.state()['ledgers'] if x['business_line_id']=='bl-b-saas');return check(l['billed_paise'] is None and l['collected_paise'] is None,'Services money leaked into SaaS')

# Integrated paths and boundary tests
@case('End-to-end workflow','Founder update enters staff queue then reviewer decision removes it','P0','Core','201 -> pending queue -> APPROVED -> no pending review')
def t116(e):
 r=e.update();expect_status(r,201)
 eid=r.json()['evidence_id']
 check(any(x['id']==eid for x in e.state()['staff_queue']['unreviewed_evidence']),'Submission not queued')
 expect_status(e.approval(eid),200)
 return check(not any(x['id']==eid for x in e.state()['staff_queue']['unreviewed_evidence']),'Approved evidence remains queued')
@case('End-to-end workflow','Change requested triggers follow-up and does not certify criterion','P0','Core','Changes requested -> follow-up, Unknown criterion')
def t117(e):
 r=e.update();expect_status(r,201); eid=r.json()['evidence_id']
 expect_status(e.approval(eid,'CHANGES_REQUESTED'),200)
 st=e.state();return check(any(x.get('id')==eid for x in st['staff_queue']['pending_actions']) and e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-2')['criterion_result']=='UNKNOWN','Rejected evidence affected verification')
@case('End-to-end workflow','Valid standard L0->L1 advancement passes on isolated complete fixture','P0','Core','200; transition history and Level 1')
def t118(e):
 from backend.test_acceptance import _make_met_venture
 _make_met_venture(e.c)
 r=e.req('POST','/api/ventures/case-t/transitions',{'to_level':'Level 1','transition_type':'STANDARD_ADVANCEMENT','approved_by':'Demo Programme Reviewer','reason':'Criteria met'},R)
 expect_status(r,200)
 s=e.state();return check(next(x for x in s['ventures'] if x['id']=='case-t')['programme_level']=='Level 1' and any(t['venture_id']=='case-t' for t in s['transitions']),'Standard advancement not persisted')
@case('End-to-end workflow','Valid standard L1->L2 advancement works with Services evidence','P0','Core','200 for 8 clients, ₹125k cumulative with rule configured')
def t119(e):
 r=e.req('POST','/api/ventures',{'id':'case-l1','name':'L1 fixture','activity':'Services','model_resolution_status':'CONFIRMED','primary_business_model':'Services','programme_level':'Level 1','programme_level_provenance':'Test fixture','business_lines':[{'id':'bl-l1','line_name':'Services','approved_model':'Services','track_role':'ACTIVE_GOVERNING'}]},O);expect_status(r,201)
 r=e.req('POST','/api/criteria/L1L2-SRV-2/configure',{'configured_value':12500000,'configured_rule':{'aggregation_method':'SUM','metric_basis':'COLLECTED','period':'all supplied period'}},O);expect_status(r,200)
 eid1='L1-CLIENTS';eid2='L1-RECEIPT'
 r=e.update(venture_id='case-l1',line='bl-l1',crit='L1L2-SRV-1',ev_id=eid1,observations=[{'criterion_id':'L1L2-SRV-1','metric_type':'COUNT','numeric_value':8,'unit':'COUNT','period_label':'October','period_sequence':1}]);expect_status(r,201)
 r=e.update(venture_id='case-l1',line='bl-l1',crit='L1L2-SRV-2',ev_id=eid2,observations=[],evidence={'id':eid2,'source_type':'Receipt','ledger_bucket':'COLLECTED','amount_minor_or_count':12500000,'unit':'INR_PAISE','period_label':'October'});expect_status(r,201)
 expect_status(e.approval(eid1),200);expect_status(e.approval(eid2),200)
 r=e.req('POST','/api/ventures/case-l1/transitions',{'to_level':'Level 2','transition_type':'STANDARD_ADVANCEMENT','approved_by':'Demo','reason':'Test eligible'},R)
 expect_status(r,200);return check(next(x for x in e.state()['ventures'] if x['id']=='case-l1')['programme_level']=='Level 2','Not advanced')
@case('End-to-end workflow','An uploaded evidence belonging to Case B cannot approve Case A metrics','P0','Integrity','Case A criterion stays Unknown after B-E01 approval')
def t120(e):
 obs=[{'id':'CROSS-A-SIGNUPS','criterion_id':'L0L1-AIB2C-1','metric_type':'COUNT','numeric_value':35,'unit':'COUNT','period_label':'October','qualifier_status':'QUALIFIED'}]
 r=e.update(venture_id='case-a',line='bl-a-b2c',crit='L0L1-AIB2C-1',evidence_id='B-E01',observations=obs)
 # If rejected, the isolation guard worked.
 if r.status_code>=400:return f'HTTP {r.status_code}; cross-venture evidence refused'
 expect_status(e.approval('B-E01'),200)
 return check(e.criterion('case-a','bl-a-b2c','L0L1-AIB2C-1')['criterion_result']!='MET','Approving Case B LOI falsely verified Case A sign-ups')
@case('Owner actions','Configured MSL Services customer threshold must be applied','P0','Core','10 qualified customers meet configured cutoff 10')
def t121(e):
 r=e.req('POST','/api/criteria/MSL-SRV-1/configure',{'configured_value':10,'configured_rule':{'aggregation_method':'DISTINCT_ENTITY','range_low':10,'range_high':20}},O);expect_status(r,200)
 e.add_evidence('MSL-SRV-10','case-c','bl-c-main','MSL-SRV-1')
 e.add_observation('MSL-CUST-10','MSL-SRV-10','case-c','bl-c-main','MSL-SRV-1','COUNT',10,'October',1,'QUALIFIED')
 return check(e.criterion('case-c','bl-c-main','MSL-SRV-1')['criterion_result']=='MET','Configured 10-customer cutoff ignored')
@case('Owner actions','Configuring 35 WAU sustained minimum must not turn four weeks of 10 into MET','P0','Core','Four weekly 10 readings do not satisfy sustained 35 WAU')
def t122(e):
 r=e.req('POST','/api/criteria/L1L2-AIB2C-1/configure',{'configured_value':35,'configured_rule':{'aggregation_method':'SUSTAINED_MIN','window_weeks':4}},O);expect_status(r,200)
 e.add_evidence('WAU35TEST','case-a','bl-a-b2c','L1L2-AIB2C-1')
 for seq in range(1,5):e.add_observation(f'WAU35-{seq}','WAU35TEST','case-a','bl-a-b2c','L1L2-AIB2C-1','WAU',10,f'Week {seq}',seq,'QUALIFIED')
 return check(e.criterion('case-a','bl-a-b2c','L1L2-AIB2C-1')['criterion_result']!='MET','Summed 10+10+10+10 and ignored SUSTAINED_MIN rule')
@case('Criteria & evidence','Correction referencing nonexistent observation should be rejected','P1','Integrity','4xx, no dangling supersession reference')
def t123(e):
 obs=[{'criterion_id':'L0L1-AIB2C-2','metric_type':'WAU','numeric_value':11,'unit':'COUNT','period_label':'Week ending 11 October','supersedes_observation_id':'NO-SUCH-OBS'}]
 return expect_reject(e.update(observations=obs))
@case('Owner actions','Configured programme threshold cannot be negative','P1','Integrity','4xx on negative customer threshold')
def t124(e):return expect_reject(e.req('POST','/api/criteria/MSL-SRV-1/configure',{'configured_value':-100,'configured_rule':{'aggregation_method':'DISTINCT_ENTITY'}},O))

if __name__ == '__main__':
    # Fixed array order is intentional so all results are reproducible.
    for idx,(category,slug,priority,kind,expected,func) in enumerate(cases,1):
        env=Env()
        status='PASS'; detail=''
        try:
            msg=func(env)
            detail=str(msg if msg is not None else 'Verified')
        except AssertionError as exc:
            status='FAIL';detail=str(exc) or 'Assertion failed'
        except Exception as exc:
            status='ERROR';detail=f'{type(exc).__name__}: {exc}'
        finally:
            env.close()
        results.append({'id':f'SCOPE-{idx:03d}','category':category,'test':slug,'priority':priority,'classification':kind,'expected':expected,'result':status,'observed':detail})
        print(f'{"✓" if status=="PASS" else "✗"} {idx:03d} {slug}: {status} {detail[:120]}')
    folder=Path(__file__).resolve().parent
    (folder/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    with (folder/'results.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=list(results[0]));writer.writeheader();writer.writerows(results)
    from collections import Counter
    print('SUMMARY',dict(Counter(x['result'] for x in results)))
    print('FAILURES:')
    for r in results:
        if r['result']!='PASS':print(' ',r['id'],r['category'],r['test'],'->',r['observed'][:300])
