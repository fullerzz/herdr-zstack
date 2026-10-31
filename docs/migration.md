# Initial migration — 2026-10-31

Goal: establish herdr-zstack as the source of the Herdr integration without forking zstack's shared skill library.

Moved Task & Evidence runtime files, seven tests, and usage documentation from `zachs-agent-skills/integrations/herdr-app/task-evidence/` into `mods/task-evidence/`. Runtime behavior is unchanged. Examples now use portable placeholders. Generated host typings and editor configuration are excluded.

Added repository instructions, dependency-free Node test commands, provenance, and validation records. The existing destination LICENSE is preserved. Historical validation remains in zstack with a migration pointer; no zstack skills or session controls are changed.

Local presentation: preserve `personal` and the existing `personal-task-evidence` arrangement. Point the latter's Task & Evidence block at this checkout, using this migration brief and `docs/validation.md`. Keep the existing space binding; it includes the user's new tab 2. Do not rename tabs, move terminals, or send prompts during migration.

Next milestone: specify and prove one task lifecycle through hc with explicit worker ownership, result collection, revision-bound verification, and pause/pickup reconciliation. No orchestration implementation is claimed by this migration.
