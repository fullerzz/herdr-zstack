# List available recipes.
default:
    @just --list

# Install the Codex plugin from this checkout.
install-codex:
    codex plugin marketplace add "{{ justfile_directory() }}"
    codex plugin add herdr-zstack@herdr-zstack-local

# Refresh the installed Codex plugin from this checkout.
update-codex:
    codex plugin add herdr-zstack@herdr-zstack-local

# Install the Claude Code plugin from this checkout.
install-claude-code:
    claude plugin marketplace add "{{ justfile_directory() }}"
    claude plugin install herdr-zstack@herdr-zstack-local

# Refresh the Claude Code marketplace and plugin.
update-claude-code:
    claude plugin marketplace update herdr-zstack-local
    claude plugin update herdr-zstack@herdr-zstack-local
