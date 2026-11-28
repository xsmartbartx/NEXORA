# Growth Strategy Intelligence

## Purpose

Growth Strategy Intelligence turns organisation-owned Product–Segment Fit assessments into a reviewable register of strategy candidates. It is a decision-support workflow, not an autonomous growth operator.

## Inputs

The deterministic rule engine reads only saved `growth_segment_product_fits` records and their linked customer segment. It snapshots:

- assessment status;
- need alignment;
- capability coverage;
- urgency;
- budget readiness;
- buying-committee fit;
- source rationale and evidence notes.

It does not infer market size, revenue, conversion probability, customer propensity or a forecast.

## Rule catalogue

All numeric thresholds below use the manually entered 0–5 assessment scale. `NULL` means unknown and is never treated as zero.

| Category         | Rule                                                                                            | Suggested next step                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Segment priority | Need alignment >= 4, capability coverage >= 3, urgency >= 3                                     | Design a bounded discovery or pilot experiment              |
| Product gap      | Need alignment >= 3, capability coverage <= 2                                                   | Validate the smallest capability gap with the product owner |
| Evidence gap     | Urgency, budget readiness or buying-committee fit is unknown, or source status is not validated | Collect targeted research and update the source assessment  |
| Positioning      | Need alignment >= 3 and buying-committee fit <= 2                                               | Map evaluator, technical approver and budget owner concerns |

Rules are intentionally explicit and deterministic. They are hypotheses to support human review, not statistically calibrated scores.

## Confidence

- `low`: source assessment is a hypothesis or evidence notes are absent.
- `medium`: source assessment is marked validated and includes evidence notes.
- `high`: not assigned automatically. A future review workflow may introduce it only with an explicit evidence standard.

## Human decision lifecycle

Recommendations are created as `draft`. An organisation member can accept, reject or mark a recommendation implemented, optionally recording a decision note. Refreshing generated content preserves existing human decisions. Draft candidates that no longer satisfy their source rule are marked `superseded`; if a rule becomes applicable again, an unreviewed superseded candidate returns to `draft`.

## Data boundaries

- All reads and writes are scoped to the active organisation.
- Source fit and segment relationships are enforced with composite organisation-aware foreign keys.
- Product slugs are checked against Product Registry before generation.
- Evidence notes must contain non-sensitive source references and research limitations. Do not store personal contact details or sensitive personal attributes.
- No campaign is created or launched, no message is sent and no product roadmap is changed by this module.

## Operational follow-up

A future iteration can connect accepted recommendations to experiment briefs and campaign drafts, but those actions must remain separate approval-gated workflows with explicit ownership, budgets and success criteria.
