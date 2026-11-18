import { digestRevision } from './task-record-store.mjs';

// Observes a checkout on another hc machine. The remote side needs only POSIX
// sh, git and standard tools (ls, wc, cat, readlink -n, xargs -0): no node, hc
// templates or repository clone. It sends git's raw outputs and each path's
// `ls -ld` type and permissions plus its bytes; `digestRevision` hashes them
// here, so equal trees give the same `raw-worktree-v1` digest as observeRevision.

const EXCLUDE = `-- . ':(exclude).herdr-tasks'`;

// Records: `C <commit>`, then `S|T|O <length>` and git's bytes, then one
// `P <name length> <ls mode|missing> <length>` per path with its name and
// content, then `E`. Every record ends in a newline. Commands run twice for
// length then bytes; a change between them breaks the framing and fails parsing.
const MAIN = `set -u
export LC_ALL=C
cd "$1" || exit 3
prefix=$(git rev-parse --show-prefix) || exit 3
[ -z "$prefix" ] || { echo 'checkout must be the repository root' >&2; exit 3; }
commit=$(git rev-parse HEAD) || exit 3
printf 'C %s\\n' "$commit"
field() {
  tag=$1; shift
  n=$("$@" | wc -c) || exit 3
  printf '%s %s\\n' "$tag" $n
  "$@" || exit 3
  printf '\\n'
}
field S git ls-files --stage -z ${EXCLUDE}
field T git ls-tree -rz HEAD
field O git ls-files --others --exclude-standard -z ${EXCLUDE}
{ git ls-files -z --cached --others --exclude-standard ${EXCLUDE} &&
  git diff-index -z --name-only --no-renames --cached --diff-filter=D HEAD ${EXCLUDE}; } |
  xargs -0 sh -c "$2" sh || exit 3
printf 'E\\n'
`;

const PATHS = `set -u
for p do
  case $p in .herdr-tasks|.herdr-tasks/*) continue;; esac
  n=$(printf %s "$p" | wc -c)
  if l=$(ls -ld -- "$p" 2>&1); then
    mode=\${l%"\${l#??????????}"}
    case $mode in
      l*) t=$(readlink -n -- "$p" && printf x) || exit 255
          t=\${t%x}
          printf 'P %s %s %s\\n' $n "$mode" $(printf %s "$t" | wc -c)
          printf %s "$p"; printf %s "$t" ;;
      -*) s=$(wc -c < "$p") || exit 255
          printf 'P %s %s %s\\n' $n "$mode" $s
          printf %s "$p"; cat -- "$p" || exit 255 ;;
      *) printf 'P %s %s 0\\n' $n "$mode"; printf %s "$p" ;;
    esac
  else
    case $l in
      *'No such file or directory'*|*'Not a directory'*) printf 'P %s missing 0\\n' $n; printf %s "$p" ;;
      *) printf '%s\\n' "$l" >&2; exit 255 ;;
    esac
  fi
  printf '\\n'
done
`;

/** The argv a remote observer runs for `checkout`, without the hc prefix. */
export const remoteObserverArgv = checkout => ['sh', '-c', MAIN, 'sh', checkout, PATHS];

const TYPES = { '-': 0o100000, d: 0o040000, l: 0o120000, p: 0o010000, s: 0o140000, c: 0o020000, b: 0o060000 };

/** The st_mode that an `ls -l` type and permission string such as `-rwxr-sr-T` stands for. */
export function lsMode(text) {
  if (!/^[-dlpscb](?:[-r][-w][-xsS]){2}[-r][-w][-xtT]$/.test(text)) throw new Error(`unrecognized ls mode: ${text}`);
  let mode = TYPES[text[0]];
  for (const [index, special] of [[1, 0o4000], [4, 0o2000], [7, 0o1000]]) {
    const [read, write, exec] = text.slice(index, index + 3);
    const shift = 6 - (index - 1);
    if (read === 'r') mode |= 4 << shift;
    if (write === 'w') mode |= 2 << shift;
    if ('xst'.includes(exec)) mode |= 1 << shift;
    if ('sStT'.includes(exec)) mode |= special;
  }
  return mode;
}

/** Parses the observer's output into digest inputs; throws on any framing fault. */
export function parseObserverOutput(output) {
  let position = 0;
  const line = () => {
    const end = output.indexOf(0x0a, position);
    if (end < 0) throw new Error('remote observation ended early');
    const text = output.subarray(position, end).toString('latin1');
    position = end + 1;
    return text.split(' ');
  };
  const take = length => {
    if (!Number.isSafeInteger(length) || length < 0 || position + length > output.length) throw new Error('remote observation ended early');
    const bytes = output.subarray(position, position + length);
    position += length;
    return bytes;
  };
  const close = () => { if (take(1)[0] !== 0x0a) throw new Error('remote observation framing is corrupt'); };
  const count = text => /^\d+$/.test(text ?? '') ? Number(text) : NaN;
  const [c, commit, ...extra] = line();
  if (c !== 'C' || extra.length || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit ?? '')) throw new Error('remote observation has no commit');
  const fields = {};
  for (const tag of ['S', 'T', 'O']) {
    const [got, length, ...rest] = line();
    if (got !== tag || rest.length) throw new Error(`remote observation is missing ${tag}`);
    fields[tag] = take(count(length));
    close();
  }
  const entries = new Map();
  for (;;) {
    const [tag, nameLength, mode, length, ...rest] = line();
    if (tag === 'E' && nameLength === undefined) break;
    if (tag !== 'P' || rest.length || mode === undefined) throw new Error('remote observation framing is corrupt');
    const name = take(count(nameLength)).toString();
    const value = mode === 'missing' ? null : { mode: lsMode(mode), content: take(count(length)) };
    if (mode === 'missing' && count(length) !== 0) throw new Error('remote observation framing is corrupt');
    close();
    if (entries.has(name)) {
      const seen = entries.get(name);
      if (seen?.mode !== value?.mode || (seen && !seen.content.equals(value.content))) throw new Error(`remote observation changed during reading: ${name}`);
    }
    entries.set(name, value);
  }
  if (position !== output.length) throw new Error('remote observation has trailing output');
  return { commit, staged: fields.S, tree: fields.T, others: fields.O, entries };
}

/**
 * Reads `hc exec --json` output. Anything but a clean exit 0 with complete
 * output throws, so a failed or partial remote observation is never a revision.
 */
export function parseExecResult(json) {
  let result;
  try { result = JSON.parse(json); } catch { throw new Error('hc exec returned no JSON'); }
  if (result?.error) throw new Error(`hc exec failed: ${result.error.kind ?? 'error'}: ${result.error.message ?? ''}`.trim());
  if (result?.timed_out) throw new Error('hc exec timed out');
  if (result?.truncated) throw new Error('hc exec output was truncated; the revision inputs exceed its output limit');
  if (result?.signal) throw new Error(`hc exec ended by signal ${result.signal}`);
  if (result?.code !== 0) throw new Error(`hc exec exited ${result?.code}: ${String(result?.stderr ?? '').trim()}`);
  if (typeof result.stdout !== 'string') throw new Error('hc exec returned no stdout');
  return Buffer.from(result.stdout, 'base64');
}

/** Default executor: `hc exec --json --on <machine>`, returning the program's stdout bytes. */
export async function hcExec({ machine, argv, timeout }) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  let stdout;
  try {
    ({ stdout } = await promisify(execFile)('hc', ['exec', '--json', '--on', machine, '--timeout', String(timeout), '--', ...argv],
      // A hung connection must still fail, so node gives up shortly after hc's own limit.
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: (timeout + 30) * 1000 }));
  } catch (error) {
    // hc exits nonzero for its own failures, such as an unknown or unreachable machine.
    if (typeof error.stdout === 'string' && error.stdout.trim()) parseExecResult(error.stdout);
    throw error;
  }
  return parseExecResult(stdout);
}

/**
 * Observes `checkout` on `machine` through hc, never through a local path.
 * Throws on any failure; the caller must treat that as unknown, never clean.
 * @param {string} machine An hc machine name from `hc machine ls`.
 * @param {string} checkout Absolute repository root on that machine.
 * @param {{ exec?: typeof hcExec, timeout?: number }} [options] `exec` is injectable for tests.
 * @returns {Promise<{ machine: string, checkout: string, commit: string, worktreeDigest: string }>}
 */
export async function observeRemoteRevision(machine, checkout, { exec = hcExec, timeout = 300 } = {}) {
  if (typeof machine !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(machine)) throw new Error('machine must be an hc machine name');
  if (typeof checkout !== 'string' || !checkout.startsWith('/')) throw new Error('checkout must be absolute');
  const output = await exec({ machine, argv: remoteObserverArgv(checkout), timeout });
  const { entries, ...inputs } = parseObserverOutput(output);
  const revision = await digestRevision({ ...inputs, entry: async name => {
    if (!entries.has(name)) throw new Error(`remote observation omitted ${name}`);
    const found = entries.get(name);
    return found && { mode: found.mode, bytes: async () => found.content };
  } });
  return { machine, checkout, ...revision };
}
