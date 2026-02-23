#!/usr/bin/env bash
set -euo pipefail

# Sincroniza con origin/<branch> preservando rutas locales sensibles.
# Uso:
#   ./scripts/sync_safe.sh
#   ./scripts/sync_safe.sh --branch main
#   ./scripts/sync_safe.sh --dry-run

BRANCH="main"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "Parametro no reconocido: $1" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: no es un repo Git: $REPO_ROOT" >&2
  exit 1
fi

# Rutas locales a preservar siempre (ignorada o no por git)
PRESERVE=(
  "backend/.env"
  "frontend/.env"
  "backend/.ssh"
  "scripts/data_imports"
  "scripts/sync_safe.sh"
)

echo "==> Repo: $REPO_ROOT"
echo "==> Branch remota objetivo: origin/$BRANCH"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "==> Modo: DRY-RUN"
fi

echo "==> Fetch"
git fetch origin "$BRANCH"

echo "==> Reset duro a origin/$BRANCH"
if [[ "$DRY_RUN" -eq 0 ]]; then
  git reset --hard "origin/$BRANCH"
else
  echo "[dry-run] git reset --hard origin/$BRANCH"
fi

CLEAN_ARGS=("-fd")
for p in "${PRESERVE[@]}"; do
  CLEAN_ARGS+=("-e" "$p")
done

echo "==> Limpieza de archivos no versionados con exclusiones:"
for p in "${PRESERVE[@]}"; do
  echo "   - $p"
done

if [[ "$DRY_RUN" -eq 0 ]]; then
  git clean "${CLEAN_ARGS[@]}"
else
  git clean -n "${CLEAN_ARGS[@]}"
fi

echo "==> Estado final"
git status --short --ignored | sed -n '1,120p'
