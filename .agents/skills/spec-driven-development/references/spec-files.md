# Spec Files

Use this structure for feature specs:

```text
docs/specs/<module>/<feature>/specs/
├── requirements.md
├── design.md
├── tasks.md
└── decisions.md
```

Example:

```text
docs/specs/transactions/core/specs/
├── requirements.md
├── design.md
├── tasks.md
└── decisions.md
```

## requirements.md

Purpose: define what must happen and why, without implementation code.

Include:

- objective;
- context/source docs;
- in scope;
- out of scope;
- business rules;
- user/system flows;
- edge cases;
- acceptance criteria;
- frontend/API expectations when relevant.

Prefer testable wording:

```text
WHEN <condition>
THE SYSTEM SHALL <behavior>
```

```text
IF <condition>
THEN <expected result>
```

## design.md

Purpose: define how the approved requirements will be implemented.

Include:

- architecture/layers touched;
- module dependencies;
- entity/model shape;
- database schema and migrations;
- validation and invariants;
- errors and HTTP contract impact;
- events/outbox behavior when relevant;
- security/ownership rules;
- testing strategy;
- documentation/integration/swagger impact;
- important trade-offs.

Do not hide business-rule changes here. If design reveals a rule change, update `requirements.md`.

For any database schema change, the design must mention the impact on `docs/database/schema.md`. Read that file before creating, generating, or running migrations so existing tables, indexes, triggers, functions, enums, and naming conventions are reused instead of duplicated.

## tasks.md

Purpose: break implementation into small, ordered, trackable tasks.

Use checkbox tasks:

```md
- [ ] 1. Create transaction enums
- [ ] 2. Create transaction ORM entity
- [ ] 3. Add migration
```

Rules:

- one task should have a clear output;
- avoid vague tasks like "implement everything";
- include tests/docs tasks explicitly;
- keep order close to execution order;
- update status as work progresses when the task list is part of the active workflow.

## decisions.md

Purpose: keep the spec alive by recording decisions, trade-offs, and changes.

Use lightweight local ADRs:

```md
## DEC-001 - Store transaction amount in cents

Status: accepted

Decision:
Transactions store `amount_cents` as integer cents.

Reason:
Avoid decimal/float precision issues in money calculations.

Impact:
API/domain can expose amount, but persistence stores cents.
```

Record:

- naming choices;
- schema trade-offs;
- rejected alternatives;
- cross-module impacts;
- deviations from original design;
- implementation surprises.

## Approval Rule

Do not implement feature code before `requirements.md`, `design.md`, and `tasks.md` exist and are approved or explicitly cleared by the user.

During implementation:

- if business behavior changes, update `requirements.md`;
- if technical design changes, update `design.md`;
- if task order/scope changes, update `tasks.md`;
- if a decision/trade-off appears, update `decisions.md`.
- if a migration changes database structure, update `docs/database/schema.md` in the same task.
