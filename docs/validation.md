# Validation

## Initial migration — 2026-10-31

Migration accepted locally. Runtime files and tests were transferred byte-for-byte; no new execution behavior was introduced.

- New checkout: all 7 Node tests passed; `herdr-app check mods/task-evidence` passed.
- Original checkout after extraction: structural validation passed (57 skills, zero problems), Node suite passed (212 passed, 61 optional tests skipped), Python suite passed (143 tests).
- Both repositories passed `git diff --check` for tracked changes.
- Live app: migration notes rendered from this checkout; clicking Verification opened this checkout's `docs/validation.md`; app status reported no errors. The original personal layout and both tabs were preserved.
- Installed runtime copies match `mods/task-evidence/`. No commits or pushes were made.

Recovery copy of the original mod (including generated local files) and pre-migration layout: `/private/tmp/herdr-zstack-migration/backup`. This is a local temporary recovery artifact, not a portable dependency.

Historical evidence before migration: all seven focused tests and the native mod checker passed. Live task notes, scoped Codex activity, artifact navigation, and manual refresh were verified in the personal-task-evidence layout. A host initialization bug was fixed by reading herdr.props(), with a regression modeling undefined root init props.

Limits: remote reads have unit coverage only. Windows paths, theme switching, and restart recovery have not been tested live. Native children without core terminals are absent from the activity list. Activity covers a linked space, not proof of task ownership. The panel is explicitly configured and refreshed manually.
