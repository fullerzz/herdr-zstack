# herdr-zstack

This repository owns Herdr-specific execution workflows, mods, layouts, and runtime validation. Shared engineering principles and acceptance rules remain in zstack; do not copy its entire skill library or silently diverge from it.

## Working rules

- Use `uv` for Python, `xh` instead of curl, and mise or brew for global tools. Use fff MCP for repository file searches and grep when available.
- Read the installed `~/.config/herdr-app/AGENTS.md`, `herdr.d.ts`, and `gpui-kit.d.ts` before mod changes. These generated files describe the installed version; never edit them.
- Use `hc` for authorized task-owned agents, terminals, long-running checks, and process supervision; use `herdr-app` for workspace presentation and navigation. Verify installed CLI help before using syntax. Ordinary file edits and brief checks may use direct tools.
- Developing or installing this repository does not activate z-mode or Herdr execution. Explicit session selection and host permissions still govern delegation. Workers do not inherit parent controls, credentials, conversation, or approval authority.
- Do not dispatch agents, write trackers, commit, push, publish, or change unrelated personal configuration without authorization. Preserve concurrent changes.
- Use Conventional Commit messages: `type: description` or `type(scope): description`, such as `feat: add a collapsible task sidebar`, `fix: restore panel selection`, or `docs: update installation steps`.
- Clone shipped layouts before changing them. Preserve personal layouts, keybindings, and other mods. Never infer the task's target from whichever terminal has focus.
- Treat task identity, terminal/session identity, runtime activity, and acceptance as separate facts. A restored terminal may contain a fresh shell. Reconcile before sending prompts; never replay an assignment automatically.
- Mods are trusted code. Keep Task & Evidence read-only apart from one write: removing a board entry the user confirms, by compare-and-swap on the board file. File reads and navigation otherwise; no record or evidence writes, command execution, or agent messaging.

## Structure and verification

Keep mods under `mods/`. Keep tests beside the code they exercise. Add workflow skills and layouts only when implementing their actual behavior; no placeholder skill activation.

Run `node --test mods/task-evidence/*.test.mjs`, `herdr-app check mods/task-evidence`, `just check`, and `git diff --check` after relevant changes. Inspect the running UI after async reads, artifact selection, and refresh. Record actual host checks and their limits in `docs/validation.md`; a checker pass is not live UI proof.

Keep generated `.d.ts`, `jsconfig.json`, error files, and local session state out of Git. Preserve license notices. Do not build a custom installer until the installation contract needs one.
