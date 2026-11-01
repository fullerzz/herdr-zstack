# List available recipes.
default:
    @just --list

# Install or update sidebar mods, hc templates, and both host plugins.
install: update-sidebar install-templates install-codex install-claude-code

# Install or update hc role templates with the CLI default models.
install-templates:
    node scripts/install.mjs install --target templates --home "${XDG_CONFIG_HOME:-$HOME/.config}/herdr-core" --apply

# Update the Task & Evidence sidebar mods from this checkout.
update-sidebar:
    node scripts/install.mjs update --home "${HERDR_APP_HOME:-$HOME/.config/herdr-app}" --apply

# Install the Codex plugin from this checkout.
install-codex:
    codex plugin marketplace add "{{ justfile_directory() }}"
    codex plugin add herdr-zstack@herdr-zstack-local

# Refresh the installed Codex plugin from this checkout.
update-codex:
    codex plugin add herdr-zstack@herdr-zstack-local

# Install the Claude Code plugin from this checkout.
install-claude-code:
    claude plugin install herdr-zstack --marketplace "{{ justfile_directory() }}"
    claude plugin marketplace update herdr-zstack-local
    claude plugin update herdr-zstack@herdr-zstack-local

# Refresh the Claude Code marketplace and plugin.
update-claude-code:
    claude plugin marketplace update herdr-zstack-local
    claude plugin update herdr-zstack@herdr-zstack-local
