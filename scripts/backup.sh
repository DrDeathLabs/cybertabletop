#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-cybertabletop-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-cybertabletop}"
POSTGRES_DB="${POSTGRES_DB:-cybertabletop}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/cybertabletop-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT"
echo "Backup written to $OUT"
