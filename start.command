#!/bin/zsh
set -e
cd "${0:A:h}"

# Use a normal Node/pnpm install, or Codex's bundled runtime on this Mac.
runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1 && [[ -x "$runtime/node/bin/node" ]]; then
  export PATH="$runtime/node/bin:$PATH"
fi
if ! command -v pnpm >/dev/null 2>&1 && [[ -x "$runtime/bin/fallback/pnpm" ]]; then
  export PATH="$runtime/bin/fallback:$PATH"
fi
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo 'Install Node.js 22.12+ and pnpm, then run this launcher again.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  pnpm install --frozen-lockfile
fi
exec pnpm dev
