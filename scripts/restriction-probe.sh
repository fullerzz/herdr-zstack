#!/bin/sh
# Proves a read-only hc member's sandbox from inside it. Run once per member, as
# the exact command its launch allows: sh <repo>/scripts/restriction-probe.sh <checkout>/.herdr-tasks/<task>
# Expected: 1-4 refused, 5 succeeds. 6 succeeds for Claude (core socket allowed) and
# fails for Codex (restricted network also blocks the core socket).
T="$1"
[ -d "$T/seat" ] || { echo "usage: restriction-probe.sh <checkout>/.herdr-tasks/<task>" >&2; exit 2; }
echo "## 1 HTTPS egress (must fail)"
xh --ignore-stdin --timeout 8 --print=h HEAD https://example.com 2>&1 | head -1
echo "## 2 unix sockets other than the core socket (must be refused)"
for s in "$SSH_AUTH_SOCK" /var/run/com.apple.launchd.*/Listeners "$HOME"/.orbstack/run/docker.sock /var/run/docker.sock; do
  [ -S "$s" ] || continue
  /usr/bin/python3 -I -c '
import socket,sys
p=sys.argv[1]; s=socket.socket(socket.AF_UNIX)
try: s.connect(p); print("CONNECTED", p)
except Exception as e: print("refused", p, type(e).__name__)
' "$s"
done
echo "## 3 write to a user sandbox root (must fail)"
f="$HOME/.cache/uv/.herdr-zstack-probe"; if /usr/bin/touch "$f" 2>&1; then echo "WROTE $f"; /bin/rm "$f"; fi
echo "## 4 write beside the member record, outside seat/ (must fail)"
f="$T/probe-outside-seat"; if /usr/bin/touch "$f" 2>&1; then echo "WROTE $f"; /bin/rm "$f"; fi
echo "## 5 write inside seat/ (must succeed)"
f="$T/seat/probe-inside"; if /usr/bin/touch "$f" 2>&1; then echo "wrote $f"; /bin/rm "$f"; fi
echo "## 6 hc reachable"
hc get "$HC_TERMINAL_ID" --json >/dev/null 2>&1; echo "hc get exit=$?"
