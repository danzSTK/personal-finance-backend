---
name: spec-driven-development
description: "Use when starting, planning, reviewing, or implementing a feature/spec in this repository. Enforces Spec-Driven Development as the default project workflow: create or update docs/specs/module/feature/specs requirements, design, tasks, and decisions before coding; keep the spec alive during implementation; stop and update the spec when business rules or design decisions change."
---

# Spec-Driven Development

Use Spec-Driven Development as the default workflow for new features and relevant feature changes in this repository.

The spec is the implementation contract. Do not treat it as a throwaway note.

## Core Rule

Before implementing a new feature, create or update:

```text
docs/specs/<module>/<feature>/specs/
├── requirements.md
├── design.md
├── tasks.md
└── decisions.md
```

Implementation may start only after `requirements.md`, `design.md`, and `tasks.md` are reviewed or explicitly approved by the user.

For any schema change, `docs/database/schema.md` is part of the implementation contract. Read it before creating, generating, or running migrations, and update it whenever a migration creates, drops, renames, or changes any table, column, constraint, index, trigger, function, enum, or database-level invariant.

## Workflow

1. Read existing domain docs first, such as `docs/<module>/**`, `docs/database/schema.md`, and related integration docs.
2. Create or update `requirements.md` with behavior, scope, out-of-scope items, requirements, edge cases, and acceptance criteria.
3. Create or update `design.md` with technical design, data model, dependencies, validation, errors, tests, migrations, and documentation impact.
4. Create or update `tasks.md` with small, ordered, trackable implementation tasks.
5. Create or update `decisions.md` whenever a relevant trade-off, design choice, or change of direction appears.
6. Implement task by task, keeping `tasks.md` status current when requested or when the task list is part of the deliverable.

## Stop Conditions

Stop implementation and update the spec first when:

- a business rule changes;
- an edge case appears that was not covered;
- a schema/API contract changes;
- a migration reveals missing or stale `docs/database/schema.md` coverage;
- a task requires a different design than the approved one;
- a decision would affect another module or frontend integration.

If the change is only an implementation detail that preserves the approved behavior, record it in `decisions.md` and continue.

## File Details

For the expected content of each spec file, read `references/spec-files.md`.
