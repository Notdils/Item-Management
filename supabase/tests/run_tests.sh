#!/usr/bin/env bash
# Uji skema di Postgres 15+ lokal (bukan Supabase).
# Jalankan: PGHOST=<host> PGPORT=<port> bash supabase/tests/run_tests.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE/.."
DB=bengkel_test
psql -U postgres -qc "drop database if exists $DB" -c "create database $DB"
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql
# Bagian 1 master.sql (skema). Bagian 2 (data produksi + akun) butuh skema auth Supabase asli.
awk '/^-- BAGIAN 2: DATA PRODUKSI/{exit} {print}' master.sql | psql -U postgres -d $DB -q -v ON_ERROR_STOP=1
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/test_schema.sql
bash "$HERE/test_concurrency.sh"
