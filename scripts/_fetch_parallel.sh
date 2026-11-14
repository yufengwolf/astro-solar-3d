#!/usr/bin/env bash
# 一次性工具：代理对单连接限速、服务端对高并发敏感。
# 小批量 Range 分段下载 + 断点续传 + 重试，最后按序合并。
set -u
URL="$1"; OUT="$2"; TOTAL="$3"; PARTS="${4:-24}"; BATCH="${5:-6}"
DIR="$(dirname "$OUT")/.parts_$(basename "$OUT")"
mkdir -p "$DIR"
CHUNK=$(( (TOTAL + PARTS - 1) / PARTS ))

fetch_part() {
  local i="$1" S E f
  S=$(( i * CHUNK )); E=$(( S + CHUNK - 1 )); if (( E >= TOTAL )); then E=$((TOTAL-1)); fi
  (( S >= TOTAL )) && return 0
  f="$DIR/$i.part"
  local want=$(( E - S + 1 ))
  if [ -f "$f" ] && [ "$(wc -c < "$f")" -eq "$want" ]; then return 0; fi
  for try in 1 2 3; do
    curl -sS --max-time 240 -H "Range: bytes=${S}-${E}" -o "$f" "$URL" 2>/dev/null
    if [ -f "$f" ] && [ "$(wc -c < "$f")" -eq "$want" ]; then return 0; fi
  done
  echo "FAILED part $i (want $want)" >&2
  return 1
}

fail=0
for ((start=0; start<PARTS; start+=BATCH)); do
  pids=()
  for ((i=start; i<start+BATCH && i<PARTS; i++)); do
    fetch_part "$i" & pids+=($!)
  done
  for p in "${pids[@]}"; do wait "$p" || fail=1; done
done
if (( fail )); then echo "PART_FAILED"; exit 1; fi
: > "$OUT"
for ((i=0; i<PARTS; i++)); do
  f="$DIR/$i.part"; [ -f "$f" ] || continue
  cat "$f" >> "$OUT"
done
rm -rf "$DIR"
echo "DONE $(wc -c < "$OUT") bytes"
