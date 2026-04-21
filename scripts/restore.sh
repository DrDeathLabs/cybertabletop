#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore.sh <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-cybertabletop-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-cybertabletop}"
POSTGRES_DB="${POSTGRES_DB:-cybertabletop}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "Restoring $BACKUP_FILE into $POSTGRES_DB on $POSTGRES_CONTAINER"
gunzip -c "$BACKUP_FILE" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
echo "Restore complete"
