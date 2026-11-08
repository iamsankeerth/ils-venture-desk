"""Assignment evidence and qualification rules shared by the API and evaluator."""
from __future__ import annotations

import json
import math

VALID_MODELS = ("Consumer", "Services", "AI_B2C", "AI_B2B")
PILOT_QUALIFICATION_OPTIONS = ("Pilot completion report",)
PILOT_QUALIFICATION_SOURCES = {
    "Pilot completion report": frozenset({"Pilot Completion Report"}),
}
CONFIGURATION_SCHEMAS = {
    "WAU": {
        "methods": frozenset({"SUSTAINED_MIN"}),
        "required": frozenset({"aggregation_method", "window_weeks"}),
        "allowed": frozenset({"aggregation_method", "window_weeks"}),
        "value": "integer",
    },
    "MONEY": {
        "methods": frozenset({"SUM"}),
        "required": frozenset({"aggregation_method", "metric_basis", "period"}),
        "allowed": frozenset({"aggregation_method", "metric_basis", "period"}),
        "value": "integer",
    },
    "RETENTION": {
        "methods": frozenset({"PERCENT"}),
        "required": frozenset({"aggregation_method", "cohort_definition", "window_weeks"}),
        "allowed": frozenset({"aggregation_method", "cohort_definition", "window_weeks"}),
        "value": "percent",
    },
    "PILOT": {
        "methods": frozenset({"QUALIFYING_PILOTS"}),
        "required": frozenset({"aggregation_method", "pilot_qualification"}),
        "allowed": frozenset({"aggregation_method", "pilot_qualification"}),
        "value": "integer",
    },
    "COUNT": {
        "methods": frozenset({"DISTINCT_ENTITY"}),
        "required": frozenset({"aggregation_method", "range_low", "range_high"}),
        "allowed": frozenset({"aggregation_method", "range_low", "range_high"}),
        "value": "integer",
    },
}
MSL_COMMON_GATE = "MSL_COMMON"
MSL_MODEL_SPECIFIC_GATE = "MSL_MODEL_SPECIFIC"
MSL_COMMON_IDS = ("MSL-COM-1", "MSL-COM-2", "MSL-COM-3", "MSL-COM-4", "MSL-COM-5")
MSL_MODEL_SPECIFIC_IDS = {
    "Consumer": (),
    "Services": ("MSL-SRV-1", "MSL-SRV-2", "MSL-SRV-3", "MSL-SRV-4"),
    "AI_B2C": (),
    "AI_B2B": (
        "MSL-AIB2B-1",
        "MSL-AIB2B-2",
        "MSL-AIB2B-3",
        "MSL-AIB2B-4",
        "MSL-AIB2B-5",
    ),
}
MSL_COMMON_COUNT = len(MSL_COMMON_IDS)
MSL_MODEL_SPECIFIC_COUNTS = {
    model: len(criterion_ids) for model, criterion_ids in MSL_MODEL_SPECIFIC_IDS.items()
}

EVIDENCE_TYPE_POLICY = {
    "Signed LOI": {
        "buckets": {"COMMERCIAL_INTENT"},
        "units": {None, "COUNT"},
        "allow_amount": False,
        "amount_required": False,
        "loi": True,
        "completed_pilot": False,
    },
    "Invoice": {
        "buckets": {"BILLED"},
        "units": {"INR_PAISE"},
        "allow_amount": True,
        "amount_required": True,
        "loi": False,
        "completed_pilot": False,
    },
    "Payment Receipt": {
        "buckets": {"COLLECTED"},
        "units": {"INR_PAISE"},
        "allow_amount": True,
        "amount_required": True,
        "loi": False,
        "completed_pilot": False,
    },
    "Streaming Statement": {
        "buckets": {"EARNED"},
        "units": {"INR_PAISE"},
        "allow_amount": True,
        "amount_required": True,
        "loi": False,
        "completed_pilot": False,
    },
    "Streaming Payout": {
        "buckets": {"COLLECTED"},
        "units": {"INR_PAISE"},
        "allow_amount": True,
        "amount_required": True,
        "loi": False,
        "completed_pilot": False,
    },
    "Analytics Excerpt": {
        "buckets": {"USAGE_METRIC"},
        "units": {None, "COUNT"},
        "allow_amount": False,
        "amount_required": False,
        "loi": False,
        "completed_pilot": False,
    },
    "Mentor Note": {
        "buckets": {"USAGE_METRIC"},
        "units": {None, "QUALITATIVE", "COUNT", "PERCENT"},
        "allow_amount": False,
        "amount_required": False,
        "loi": False,
        "completed_pilot": False,
    },
    "Pilot Completion Report": {
        "buckets": {"USAGE_METRIC"},
        "units": {None, "COUNT"},
        "allow_amount": False,
        "amount_required": False,
        "loi": False,
        "completed_pilot": True,
    },
}

LOI_SOURCE_TYPES = {name for name, policy in EVIDENCE_TYPE_POLICY.items() if policy["loi"]}
COMPLETED_PILOT_SOURCE_TYPES = {
    name for name, policy in EVIDENCE_TYPE_POLICY.items() if policy["completed_pilot"]
}

REQUIRED_QUALIFIERS = {
    "L0L1-CON-1": frozenset({"PRICED_YES", "priced_yes", "PRICED", "priced"}),
    "L0L1-CON-2": frozenset({"PAYING", "paying", "PAID", "paid"}),
    "L0L1-SRV-1": frozenset({"PRICED_YES", "priced_yes", "PRICED", "priced"}),
    "L0L1-SRV-2": frozenset({"PAYING", "paying", "PAID", "paid"}),
    "L0L1-AIB2B-1": frozenset(
        {"BUDGET_HOLDER", "budget_holder", "BUDGET_HOLDER_PRICING", "budget_holder_pricing"}
    ),
}


def required_qualifiers(criterion_id: str | None) -> frozenset[str] | None:
    return REQUIRED_QUALIFIERS.get(criterion_id or "")


def line_models(line: dict) -> list[str]:
    """Return the model(s) a line can govern. Approved model wins over candidates."""
    if line.get("approved_model"):
        return [str(line["approved_model"])]
    candidate = line.get("candidate_models_json")
    if isinstance(candidate, str):
        try:
            candidate = json.loads(candidate)
        except (ValueError, TypeError):
            candidate = None
    if isinstance(candidate, (list, tuple)):
        return [str(model) for model in candidate if model]
    return []


def canonical_source_type(source_type: str | None) -> str | None:
    if not isinstance(source_type, str):
        return None
    normalized = source_type.strip().lower()
    for name in EVIDENCE_TYPE_POLICY:
        if name.lower() == normalized:
            return name
    return None


def is_loi_source(source_type: str | None) -> bool:
    return canonical_source_type(source_type) in LOI_SOURCE_TYPES


def is_completed_pilot_source(source_type: str | None) -> bool:
    return canonical_source_type(source_type) in COMPLETED_PILOT_SOURCE_TYPES


def evidence_type_error(
    source_type: str | None,
    ledger_bucket: str | None,
    unit: str | None,
    amount_minor_or_count: int | None = None,
) -> str | None:
    policy = EVIDENCE_TYPE_POLICY.get(canonical_source_type(source_type))
    if policy is None:
        return None
    if ledger_bucket not in policy["buckets"]:
        allowed = ", ".join(sorted(policy["buckets"]))
        return f"{source_type} requires ledger bucket {allowed}, received {ledger_bucket or 'none'}"
    if unit not in policy["units"]:
        allowed = ", ".join(sorted(str(value) for value in policy["units"]))
        return f"{source_type} requires unit {allowed}, received {unit or 'none'}"
    if not policy["allow_amount"] and amount_minor_or_count is not None:
        return f"{source_type} cannot carry a monetary amount"
    if policy["amount_required"] and amount_minor_or_count is None:
        return f"{source_type} requires an amount"
    return None


def validate_evidence_type(
    source_type: str | None,
    ledger_bucket: str | None,
    unit: str | None,
    amount_minor_or_count: int | None = None,
) -> None:
    error = evidence_type_error(source_type, ledger_bucket, unit, amount_minor_or_count)
    if error:
        raise ValueError(error)


def _configuration_kind(criterion: dict) -> str | None:
    if not criterion.get("is_configurable_range"):
        return None
    metric = criterion.get("metric_type")
    unit = criterion.get("unit")
    if metric == "WAU":
        return "WAU"
    if metric == "RETENTION":
        return "RETENTION"
    if metric == "PILOT_COUNT":
        return "PILOT"
    if unit == "INR_PAISE":
        return "MONEY"
    if unit in ("COUNT", "PERCENT"):
        return "COUNT"
    return None


def _nonblank(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _whole_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and (not isinstance(value, float) or (math.isfinite(value) and value.is_integer()))
    )


def _configuration_value_error(value: object, kind: str) -> str | None:
    if value is None:
        return "configured_value is required"
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return "configured_value must be numeric"
    if isinstance(value, float) and not math.isfinite(value):
        return "configured_value must be finite"
    if value < 0:
        return "configured_value must be nonnegative"
    if kind == "RETENTION":
        if value > 100:
            return "configured_value for a retention percentage must be at most 100"
    elif not _whole_number(value):
        return "configured_value must be a whole number for this criterion"
    return None


def configuration_error(
    criterion: dict,
    configured_value: object,
    rule: object,
) -> str | None:
    kind = _configuration_kind(criterion)
    if kind is None:
        return "criterion is not configurable"
    spec = CONFIGURATION_SCHEMAS[kind]
    value_error = _configuration_value_error(configured_value, kind)
    if value_error:
        return value_error
    if not isinstance(rule, dict):
        return "configured_rule must be an object"

    missing = sorted(spec["required"] - set(rule))
    if missing:
        return f"configured_rule is missing required field(s): {', '.join(missing)}"
    extra = sorted(set(rule) - spec["allowed"])
    if extra:
        return f"configured_rule contains unsupported field(s): {', '.join(extra)}"

    method = rule.get("aggregation_method")
    if method not in spec["methods"]:
        allowed = ", ".join(sorted(spec["methods"]))
        return f"configured_rule.aggregation_method must be one of: {allowed}"

    if "window_weeks" in spec["required"]:
        window = rule.get("window_weeks")
        if not _whole_number(window) or window < 1:
            return "configured_rule.window_weeks must be a positive whole number"

    if "cohort_definition" in spec["required"] and not _nonblank(rule.get("cohort_definition")):
        return "configured_rule.cohort_definition must be nonblank"

    if "pilot_qualification" in spec["required"] and rule.get("pilot_qualification") not in PILOT_QUALIFICATION_OPTIONS:
        allowed = ", ".join(PILOT_QUALIFICATION_OPTIONS)
        return f"configured_rule.pilot_qualification must be one of: {allowed}"

    if "metric_basis" in spec["required"] and rule.get("metric_basis") not in {"COLLECTED", "EARNED", "BILLED"}:
        return "configured_rule.metric_basis must be COLLECTED, EARNED or BILLED"

    if "period" in spec["required"] and not _nonblank(rule.get("period")):
        return "configured_rule.period must be nonblank"

    if "range_low" in spec["required"] or "range_high" in spec["required"]:
        low = rule.get("range_low")
        high = rule.get("range_high")
        if not _whole_number(low) or low < 0:
            return "configured_rule.range_low must be a nonnegative whole number"
        if not _whole_number(high) or high < 0:
            return "configured_rule.range_high must be a nonnegative whole number"
        if low > high:
            return "configured_rule.range_low must not exceed range_high"
        if not (low <= configured_value <= high):
            return "configured_value must fall within range_low and range_high"

    return None
