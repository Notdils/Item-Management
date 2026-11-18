#!/usr/bin/env bash
# Dua sesi memakai 100 pcs dari sisa 125 secara bersamaan. Harus tepat satu yang berhasil.
set -uo pipefail
DB=bengkel_test
q() { psql -U postgres -d $DB -qAt -v ON_ERROR_STOP=1 -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);" \
  -c "begin; select qty_after from public.move_stock('Cable ties 15 cm','PAKAI',2,100); select pg_sleep(1); commit;" 2>&1; }
q > /tmp/c1 & q > /tmp/c2 & wait
ok=$(grep -c '^25$' /tmp/c1 /tmp/c2 | awk -F: '{s+=$2} END{print s}')
fail=$(grep -c 'Stok tidak cukup' /tmp/c1 /tmp/c2 | awk -F: '{s+=$2} END{print s}')
final=$(psql -U postgres -d $DB -qAt -c "select qty from public.stock_levels where location_id=2")
echo "berhasil=$ok ditolak=$fail sisa=$final"
[ "$ok" = 1 ] && [ "$fail" = 1 ] && [ "$final" = 25 ] && echo 'OK konkurensi: stok tidak pernah minus' || { echo GAGAL; cat /tmp/c1 /tmp/c2; exit 1; }
