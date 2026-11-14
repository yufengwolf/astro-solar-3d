#!/usr/bin/env bash
# 一次性工具：VizieR asu-tsv 单连接被代理限速，按 recno 分片小批量并行拉取后合并。
# 用法: _fetch_vizier.sh OUT "URL_TPL_with_@S_@E" RECNO_MAX STEP BATCH [START]
set -u
OUT="$1"; TPL="$2"; SMAX="$3"; STEP="$4"; BATCH="${5:-4}"; START="${6:-1}"
DIR="$(dirname "$OUT")/.parts_$(basename "$OUT")"
mkdir -p "$DIR"
N=$(( (SMAX - START + 1 + STEP - 1) / STEP ))

get() {
  local i="$1" s e u f
  s=$(( START + i * STEP )); e=$(( s + STEP - 1 )); (( e > SMAX )) && e=$SMAX
  u="${TPL//@S/$s}"; u="${u//@E/$e}"
  f="$DIR/$i.tsv"
  local want=$(( e - s + 1 )) rows
  complete() {
    [ -s "$f" ] || return 1
    rows=$(awk 'seen && NF { n++ } /^-----/ { seen=1 } END { print n+0 }' "$f")
    [ "$rows" -eq "$want" ]
  }
  if complete; then return 0; fi
  for t in 1 2 3; do
    curl -sS --max-time 240 -o "$f" "$u" 2>/dev/null
    if complete; then return 0; fi
  done
  echo "FAILED part $i" >&2; return 1
}

fail=0
for ((st=0; st<N; st+=BATCH)); do
  pids=()
  for ((i=st; i<st+BATCH && i<N; i++)); do get "$i" & pids+=($!); done
  for p in "${pids[@]}"; do wait "$p" || fail=1; done
done
(( fail )) && { echo VIZIER_PART_FAILED; exit 1; }
: > "$OUT"
for ((i=0; i<N; i++)); do
  awk 'seen && NF { print } /^-----/ { seen=1 }' "$DIR/$i.tsv" >> "$OUT"
done
rm -rf "$DIR"
echo "DONE $(wc -l < "$OUT") data rows"
