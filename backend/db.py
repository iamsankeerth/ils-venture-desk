"""SQLite relational store for ILS Venture Progress & Readiness (9 tables, stdlib sqlite3)."""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

from backend.rules import validate_evidence_type

TABLES = [
    "ventures",
    "venture_business_lines",
    "criteria_catalog",
    "progress_updates",
    "evidence_records",
    "evidence_observations",
    "evidence_review_history",
    "transition_decisions",
    "msl_eligibility_decisions",
]

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ventures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  activity TEXT,
  tracker_sector TEXT,
  primary_business_model TEXT,
  model_resolution_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
  model_clarification_note TEXT,
  recorded_update TEXT,
  development_stage TEXT DEFAULT 'Unknown',
  programme_level TEXT DEFAULT 'Unknown',
  programme_level_provenance TEXT,
  msl_eligibility TEXT DEFAULT 'Unknown',
  msl_eligibility_provenance TEXT,
  advancement_status TEXT,
  fundraising_preference TEXT,
  msl_handover_status TEXT DEFAULT 'Unknown',
  msl_acceptance_status TEXT DEFAULT 'Unknown',
  historical_traction_text TEXT,
  historical_traction_amount_paise INTEGER,
  historical_traction_period TEXT DEFAULT 'Unknown',
  historical_traction_note TEXT,
  historical_traction_business_line_id TEXT,
  mentor_goal TEXT,
  mentor_status TEXT,
  next_update_date TEXT,
  follow_up_note TEXT
);

CREATE TABLE IF NOT EXISTS venture_business_lines (
  id TEXT PRIMARY KEY,
  venture_id TEXT NOT NULL REFERENCES ventures(id),
  line_name TEXT NOT NULL,
  track_role TEXT NOT NULL DEFAULT 'ASSIGNED_IN_TRACKER',
  candidate_models_json TEXT,
  approved_model TEXT,
  resolution_status TEXT,
  clarification_provenance TEXT
);

CREATE TABLE IF NOT EXISTS criteria_catalog (
  id TEXT PRIMARY KEY,
  transition_gate TEXT NOT NULL,
  criterion_scope TEXT NOT NULL,
  business_model TEXT NOT NULL,
  name TEXT NOT NULL,
  metric_type TEXT,
  unit TEXT NOT NULL,
  threshold_value REAL,
  window_length INTEGER,
  subconditions_json TEXT,
  threshold_description TEXT,
  is_configurable_range INTEGER NOT NULL DEFAULT 0,
  configured_value REAL,
  configured_rule_json TEXT,
  configured_by TEXT,
  configured_at TEXT
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id TEXT PRIMARY KEY,
  venture_id TEXT NOT NULL REFERENCES ventures(id),
  business_line_id TEXT REFERENCES venture_business_lines(id),
  criterion_id TEXT REFERENCES criteria_catalog(id),
  summary_metric TEXT,
  summary_period TEXT,
  claimed_metrics_json TEXT,
  evidence_id TEXT,
  blocker TEXT,
  next_action TEXT,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY,
  venture_id TEXT NOT NULL REFERENCES ventures(id),
  business_line_id TEXT REFERENCES venture_business_lines(id),
  criterion_id TEXT REFERENCES criteria_catalog(id),
  source_type TEXT,
  ledger_bucket TEXT,
  amount_minor_or_count INTEGER,
  unit TEXT,
  display_amount TEXT,
  period_label TEXT,
  earned_period TEXT,
  payment_date TEXT,
  counterparty TEXT,
  detail_note TEXT,
  parent_evidence_id TEXT REFERENCES evidence_records(id),
  supersedes_evidence_id TEXT,
  historical_total_relation TEXT DEFAULT 'ISOLATED',
  evidence_status TEXT NOT NULL DEFAULT 'UNREVIEWED',
  reviewer TEXT,
  reviewed_at TEXT,
  review_reason TEXT
);

CREATE TABLE IF NOT EXISTS evidence_observations (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES evidence_records(id),
  venture_id TEXT NOT NULL REFERENCES ventures(id),
  business_line_id TEXT REFERENCES venture_business_lines(id),
  criterion_id TEXT REFERENCES criteria_catalog(id),
  metric_type TEXT,
  period_label TEXT,
  period_sequence INTEGER,
  entity_key TEXT,
  cohort_key TEXT,
  numeric_value INTEGER,
  qualitative_value_json TEXT,
  unit TEXT,
  qualifier_status TEXT,
  supersedes_observation_id TEXT
);

CREATE TABLE IF NOT EXISTS evidence_review_history (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES evidence_records(id),
  decision TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS transition_decisions (
  id TEXT PRIMARY KEY,
  venture_id TEXT NOT NULL REFERENCES ventures(id),
  from_level TEXT,
  to_level TEXT NOT NULL,
  transition_type TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  reason TEXT,
  provenance_note TEXT,
  criteria_snapshot_json TEXT
);

CREATE TABLE IF NOT EXISTS msl_eligibility_decisions (
  id TEXT PRIMARY KEY,
  venture_id TEXT NOT NULL REFERENCES ventures(id),
  decision_status TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  reason TEXT,
  provenance_source TEXT,
  msl_criteria_snapshot_json TEXT
);
"""


def connect(db_path: str | os.PathLike) -> sqlite3.Connection:
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def ensure_columns(con: sqlite3.Connection) -> None:
    columns = {row["name"] for row in con.execute("PRAGMA table_info(ventures)").fetchall()}
    additions = {
        "recorded_update": "TEXT",
        "historical_traction_business_line_id": "TEXT",
    }
    for name, ddl in additions.items():
        if name not in columns:
            con.execute(f"ALTER TABLE ventures ADD COLUMN {name} {ddl}")


def init_schema(con: sqlite3.Connection) -> None:
    con.executescript(SCHEMA_SQL)
    ensure_columns(con)
    con.commit()


def clear_all(con: sqlite3.Connection) -> None:
    for t in reversed(TABLES):
        con.execute(f"DELETE FROM {t}")
    # Caller manages the transaction when clearing and reseeding.


def _json(v):
    if v is None:
        return None
    if isinstance(v, str):
        return v
    return json.dumps(v)


def seed_from_dict(con: sqlite3.Connection, seed: dict) -> None:
    init_schema(con)
    con.execute("SAVEPOINT ils_seed_transaction")
    try:
        _seed_rows(con, seed)
        con.execute("RELEASE SAVEPOINT ils_seed_transaction")
    except Exception:
        con.execute("ROLLBACK TO SAVEPOINT ils_seed_transaction")
        con.execute("RELEASE SAVEPOINT ils_seed_transaction")
        raise
    con.commit()


def _seed_rows(con: sqlite3.Connection, seed: dict) -> None:
    # All changes are part of the savepoint managed by seed_from_dict.
    for t in reversed(TABLES):
        con.execute(f"DELETE FROM {t}")
    for row in seed.get("ventures", []):
        cols = list(row.keys())
        con.execute(
            f"INSERT INTO ventures ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [row[c] for c in cols],
        )
    for row in seed.get("venture_business_lines", []):
        r = dict(row)
        if "candidate_models_json" in r:
            r["candidate_models_json"] = _json(r["candidate_models_json"])
        cols = list(r.keys())
        con.execute(
            f"INSERT INTO venture_business_lines ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [r[c] for c in cols],
        )
    for row in seed.get("criteria_catalog", []):
        r = dict(row)
        for k in ("subconditions_json", "configured_rule_json"):
            if k in r:
                r[k] = _json(r[k])
        cols = list(r.keys())
        con.execute(
            f"INSERT INTO criteria_catalog ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [r[c] for c in cols],
        )
    for row in seed.get("progress_updates", []):
        r = dict(row)
        if "claimed_metrics_json" in r:
            r["claimed_metrics_json"] = _json(r["claimed_metrics_json"])
        cols = list(r.keys())
        con.execute(
            f"INSERT INTO progress_updates ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [r[c] for c in cols],
        )
    for row in seed.get("evidence_records", []):
        cols = list(row.keys())
        con.execute(
            f"INSERT INTO evidence_records ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [row[c] for c in cols],
        )
    for row in seed.get("evidence_observations", []):
        r = dict(row)
        if "qualitative_value_json" in r:
            r["qualitative_value_json"] = _json(r["qualitative_value_json"])
        cols = list(r.keys())
        con.execute(
            f"INSERT INTO evidence_observations ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [r[c] for c in cols],
        )
    for row in seed.get("evidence_review_history", []):
        cols = list(row.keys())
        con.execute(
            f"INSERT INTO evidence_review_history ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [row[c] for c in cols],
        )
    for row in seed.get("transition_decisions", []):
        r = dict(row)
        for k in ("criteria_snapshot_json",):
            if k in r:
                r[k] = _json(r[k])
        cols = list(r.keys())
        con.execute(
            f"INSERT INTO transition_decisions ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [r[c] for c in cols],
        )
    for row in seed.get("msl_eligibility_decisions", []):
        r = dict(row)
        if "msl_criteria_snapshot_json" in r:
            r["msl_criteria_snapshot_json"] = _json(r["msl_criteria_snapshot_json"])
        cols = list(r.keys())
        con.execute(
            f"INSERT INTO msl_eligibility_decisions ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [r[c] for c in cols],
        )
    # No commit here: the parent caller decides whether to commit or roll back.


def load_seed_file(path: str | os.PathLike) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def init_db(db_path: str | os.PathLike, seed_path: str | os.PathLike | None = None) -> sqlite3.Connection:
    con = connect(db_path)
    init_schema(con)
    if seed_path is not None:
        seed_from_dict(con, load_seed_file(seed_path))
    return con


def fetch_all(con: sqlite3.Connection, table: str) -> list[dict]:
    return [dict(r) for r in con.execute(f"SELECT * FROM {table}").fetchall()]


def export_all(con: sqlite3.Connection) -> dict:
    return {t: fetch_all(con, t) for t in TABLES}


def import_all(con: sqlite3.Connection, data: dict) -> None:
    """Import a complete 9-table snapshot, preserving old data on any validation failure."""
    if not isinstance(data, dict) or set(data) != set(TABLES):
        raise ValueError("Import requires a complete nine-table export; partial imports are not supported")
    for t in TABLES:
        if not isinstance(data[t], list) or any(not isinstance(row, dict) for row in data[t]):
            raise ValueError(f"Invalid array of records for {t}")
        columns = {row[1] for row in con.execute(f"PRAGMA table_info({t})")}
        for record in data[t]:
            if not set(record).issubset(columns):
                raise ValueError(f"Unknown columns in {t}: {set(record)-columns}")
    if not data["ventures"] or not data["criteria_catalog"]:
        raise ValueError("Import must include ventures and criteria_catalog")
    for record in data["ventures"]:
        value = record.get("advancement_status")
        if not isinstance(value, str) or not value.strip():
            record["advancement_status"] = "Unknown"
    for record in data["evidence_records"]:
        try:
            validate_evidence_type(
                record.get("source_type"),
                record.get("ledger_bucket"),
                record.get("unit"),
                record.get("amount_minor_or_count"),
            )
        except ValueError as exc:
            raise ValueError(f"Invalid evidence record {record.get('id')}: {exc}") from exc
    seed_from_dict(con, data)


def default_db_path() -> Path:
    return Path(__file__).resolve().parent / "ils.db"


def default_seed_path() -> Path:
    return Path(__file__).resolve().parent / "seed_data.json"
