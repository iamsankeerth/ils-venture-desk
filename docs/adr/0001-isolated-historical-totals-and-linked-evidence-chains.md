# Isolate Historical Baselines and Link Settlement Evidence Chains

Imported tracker records contain aggregate traction statements (such as Case B's `₹12 lakh` Services statement and Case C's `₹1.3 crore` traction) with no period or underlying document breakdown, alongside incoming granular evidence (`Invoice` + `Payment Receipt`, `Streaming Statement` + `Streaming Payout`, `Signed LOI`). We decided to store imported lump sums in an isolated `HistoricalBaseline` structure that is never mathematically summed with granular `EvidenceRecord` rows, and to link settlement records (`PAY-01`, `C-E02`) to their parent obligations (`INV-01`, `C-E01`) via `parent_evidence_id` while classifying every record into an explicit `ledger_bucket` (`COMMERCIAL_INTENT`, `BILLED`, `EARNED`, `COLLECTED`, `USAGE_METRIC`). This prevents double-counting invoices with their receipts, stops October payouts of September streaming earnings from being misclassified as October earned revenue, and avoids corrupting historical totals whose overlap with new evidence is unknown.

## Consequences

- Criteria evaluators only aggregate verified `EvidenceRecord` items within the matching `business_line` and `ledger_bucket` (for example, counting `COLLECTED` amounts rather than unpaid `BILLED` amounts toward collected-cash thresholds).
- The UI displays **Historical Baseline** figures and **Reconciled Evidence Chains** side-by-side rather than rolling them into a single synthetic total.
