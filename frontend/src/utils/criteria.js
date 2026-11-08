import { parseJSON } from "./format.js";

export const PILOT_QUALIFICATION_OPTIONS = ["Pilot completion report"];

const AGGREGATION_METHODS = [
  "SUM",
  "DISTINCT_ENTITY",
  "SUSTAINED_MIN",
  "PERCENT",
  "COHORT",
  "CUMULATIVE",
  "COLLECTED",
  "EARNED",
  "QUALIFYING_PILOTS",
];

export function isQualitativeCriterion(criterion) {
  if (!criterion) return false;
  return (
    criterion.unit === "QUALITATIVE"
    || criterion.metric_type === "QUALITATIVE"
    || String(criterion.id).startsWith("L0-Q")
  );
}

export function qualitativeFields(criterion) {
  if (!isQualitativeCriterion(criterion)) return [];
  const subconditions = parseJSON(criterion.subconditions_json, null)?.subconditions;
  if (Array.isArray(subconditions) && subconditions.length) {
    return subconditions.map((subcondition) => ({
      key: subcondition.id,
      label: subcondition.description,
      kind: subcondition.threshold != null ? "number" : "boolean",
      threshold: subcondition.threshold,
    }));
  }
  return [{ key: "met", label: "Confirmed as met", kind: "boolean" }];
}

export function blankQualitative(criterion) {
  const values = {};
  for (const field of qualitativeFields(criterion)) {
    values[field.key] = field.kind === "number" ? "" : false;
  }
  return values;
}

export function qualitativeValues(criterion, values) {
  const out = {};
  for (const field of qualitativeFields(criterion)) {
    if (field.kind === "number") {
      if (values[field.key] !== "" && values[field.key] != null) {
        out[field.key] = Number(values[field.key]);
      }
    } else {
      out[field.key] = Boolean(values[field.key]);
    }
  }
  return out;
}

export function configurationSchema(criterion) {
  if (!criterion) return null;
  const metric = criterion.metric_type;
  const unit = criterion.unit;
  if (metric === "WAU") {
    return {
      fields: ["threshold", "aggregation", "window"],
      methods: ["SUSTAINED_MIN"],
      thresholdLabel: "Threshold (WAU)",
      windowLabel: "Window weeks",
      defaultMethod: "SUSTAINED_MIN",
    };
  }
  if (unit === "INR_PAISE") {
    return {
      fields: ["threshold", "aggregation", "basis", "period"],
      methods: ["SUM"],
      thresholdLabel: "Threshold (INR)",
      defaultMethod: "SUM",
      defaultBasis: "COLLECTED",
    };
  }
  if (metric === "RETENTION") {
    return {
      fields: ["threshold", "aggregation", "cohort", "window"],
      methods: ["PERCENT"],
      thresholdLabel: "Threshold (%)",
      windowLabel: "Retention window",
      defaultMethod: "PERCENT",
    };
  }
  if (metric === "PILOT_COUNT") {
    return {
      fields: ["threshold", "aggregation", "pilot"],
      methods: ["QUALIFYING_PILOTS"],
      thresholdLabel: "Threshold",
      defaultMethod: "QUALIFYING_PILOTS",
    };
  }
  if (unit === "COUNT" || unit === "PERCENT") {
    return {
      fields: ["threshold", "aggregation", "range"],
      methods: ["DISTINCT_ENTITY"],
      thresholdLabel: unit === "PERCENT" ? "Threshold (%)" : "Threshold",
      defaultMethod: "DISTINCT_ENTITY",
    };
  }
  return {
    fields: ["threshold", "aggregation"],
    methods: AGGREGATION_METHODS,
    thresholdLabel: "Threshold",
    defaultMethod: "SUM",
  };
}
