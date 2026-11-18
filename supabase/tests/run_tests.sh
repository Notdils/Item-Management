#!/usr/bin/env bash
# Uji skema di Postgres 15+ lokal (bukan Supabase).
# Jalankan: PGHOST=<host> PGPORT=<port> bash supabase/tests/run_tests.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE/.."
DB=bengkel_test
psql -U postgres -qc "drop database if exists $DB" -c "create database $DB"
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql
for f in migrations/*.sql; do psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f "$f"; done
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/test_schema.sql
bash "$HERE/test_concurrency.sh"
