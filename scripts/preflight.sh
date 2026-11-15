#!/bin/sh
# An explicit executable keeps bootstrap independent of aliases and version-manager shims.
set -eu
fail() {
  printf '{"bootstrap":{"status":"failed","reason":"%s Inspect stderr; do not change sandbox permissions."},"session":{"status":"untested"}}\n' "$1"
  exit 2
}
usage='Pass an approved absolute Node executable and absolute launcher path.'
[ "$#" -ge 1 ] || fail "$usage"
node=$1
shift
case "$node" in /*) ;; *) fail "$usage" ;; esac
case "$0" in /*) ;; *) fail "$usage" ;; esac
[ -x "$node" ] || fail "$usage"
actual=$("$node" -p 'process.execPath') || fail "$usage"
case "$actual" in /*) ;; *) fail "$usage" ;; esac
module="$(dirname "$0")/companion.mjs"
[ -r "$module" ] || fail 'The companion module beside the launcher is missing or unreadable; refresh the host plugin and restart.'
status=0
report=$("$actual" "$module" "$@") || status=$?
# Node exits 1 for any uncaught load or runtime error. Exit 0 or 1 is a detection result only
# when it carries a matching report; anything else failed before detection finished.
# The check is plain CommonJS so that a Node too old for the module still reaches it.
check='var c = +process.argv[1], r; try { r = JSON.parse(require("fs").readFileSync(0, "utf8")); } catch (e) { process.exit(1); }
var s = r && r.session && r.session.status;
var boot = r && r.bootstrap && r.bootstrap.status;
var companion = r && r.companion && r.companion.status;
var detection = boot === "supported" && companion === "supported" &&
  ((c === 0 && s === "supported") || (c === 1 && s === "unavailable"));
var failure = c === 2 && s === "untested" &&
  (boot === "failed" || companion === "unavailable" || (r.probe && r.probe.status === "failed"));
process.exit(detection || failure ? 0 : 1);'
if printf '%s' "$report" | "$actual" -e "$check" "$status"; then
  printf '%s\n' "$report"
  exit "$status"
fi
fail "Node exited $status without a valid preflight report, so session detection did not complete."
