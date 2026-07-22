#!/usr/bin/env bash
# 形音鬥士美術批次：國風酒精渲染水墨風 + 倉頡造字神話 Q 版人物，1:1 方形。
# 用法：./gen-art-lane.sh <lane 0-3>　每條 lane 處理索引 % 4 == lane 的項目。
set -euo pipefail

LANE="$1"
root=$(cd "$(dirname "$0")/.." && pwd)
codex_home="$root/.codex-lane-$LANE"
generated_dir="$codex_home/generated_images"
out_dir="$root/assets/art"
timeout_seconds=${IMAGE_TIMEOUT_SECONDS:-200}
model=${CODEX_IMAGE_MODEL:-gpt-5.5}

mkdir -p "$out_dir" "$generated_dir"

STYLE="Traditional Chinese ink wash painting fused with alcohol-ink (酒精流體墨) fluid art technique — flowing marbled ink swirls in indigo blue, jade green, and vermilion red blooming across a warm cream rice-paper background, elegant soft brushstroke texture, Q版/chibi cute proportions (oversized head, small body, big expressive eyes), single character fully visible and centered filling most of the frame, ancient Chinese mythology aesthetic, no text or letters or numbers anywhere, square 1:1 canvas, 1024x1024"

# id|description
ITEMS=(
"mascot-cangjie|A friendly four-eyed sage Cangjie (倉頡) as a cute site mascot, wearing simple ancient scholar robes in indigo and cream, one hand giving a cheerful thumbs-up, the other holding a small bamboo writing tablet and brush, warm welcoming smile, all four eyes sparkling"
"hero-banner|Cangjie (four-eyed sage) gazing up at the stars and down at bird and beast footprints in a moment of inspiration, surrounded by faint glowing constellation lines and animal-track symbols swirling into early pictograph shapes, bamboo scrolls drifting around him, awe-struck joyful expression"
"opp-oracle|A young Q版 oracle-bone diviner apprentice, holding an inscribed turtle shell (甲骨) covered in ancient pictographs, curious determined expression, simple Shang-dynasty style robe"
"opp-bronze|A dignified Q版 bronze-age court scribe (金文尚書) in ceremonial robe, holding a small bronze ding ritual vessel (鼎) with cast inscriptions, confident calm expression"
"opp-greatseal|A studious Q版 great-seal-script scholar (大篆博士), holding an unrolled scroll covered in flowing seal-script characters, calligraphy brush in the other hand, spectacles, thoughtful smile"
"opp-smallseal|A formal Q版 chancellor figure inspired by small-seal-script unification (小篆丞相), holding a jade tablet inscribed with neat small-seal characters, stern but noble court robe with dark trim"
"opp-clerical|A brisk Q版 clerical-script clerk (隸書刀筆吏) holding a bundle of bamboo slips and a small engraving knife (書刀), practical worn robe, energetic efficient expression"
"opp-regular|An elegant Q版 regular-script calligraphy master (楷書大家), mid brush-stroke with a flowing writing brush, refined flowing robe, serene graceful expression, ink droplet sparkles in the air"
"opp-xushen|A scholarly Q版 lexicographer inspired by Xu Shen (說文解字), holding a thick bound book radiating faint character symbols, round glasses, long beard, wise gentle expression"
"opp-cangjie-boss|Cangjie (倉頡) in his full divine four-eyed form, imposing and majestic final-boss presence, radiant swirling ancient character symbols orbiting around him like a halo, dramatic flowing robe caught in mystic wind, powerful commanding expression, more intense and grand than the friendly mascot version"
)

if [[ ! -e "$codex_home/auth.json" ]]; then
  ln -sf "$HOME/.codex/auth.json" "$codex_home/auth.json"
fi

i=0
for entry in "${ITEMS[@]}"; do
  if (( i % 4 != LANE )); then i=$((i+1)); continue; fi
  i=$((i+1))
  id="${entry%%|*}"
  desc="${entry#*|}"
  final="$out_dir/$id.png"
  if [[ -f "$final" ]]; then
    echo "SKIP ${id}（已存在）"
    continue
  fi

  marker="$root/.art-marker-$id"
  prompt_file="$root/.art-prompt-$id.txt"
  touch "$marker"
  cat >"$prompt_file" <<EOF
Please generate one image with the built-in image generation tool.

Subject: $desc

Style requirements: $STYLE

不要嘗試寫入 /tmp。圖片生成後保留在 \$CODEX_HOME/generated_images。完成前必須用 shell 找到本次新生成的 PNG，實際驗證檔案已落盤且檔案大小 > 500KB；若未落盤，必須重生，不能只用文字宣稱完成。
EOF
  echo "[lane ${LANE}] GENERATE ${id}"
  set +e
  perl -e 'alarm shift; exec @ARGV' "$timeout_seconds" \
    env CODEX_HOME="$codex_home" codex exec --ignore-user-config \
    -c 'features.code_mode_host=false' \
    -m "$model" -s workspace-write -C "$root" - \
    <"$prompt_file" >"$root/.art-$id.log" 2>&1
  status=$?
  set -e
  if (( status != 0 )); then
    echo "[lane ${LANE}] codex exec 失敗或逾時：${id}（status=${status}）" >&2
  fi
  source_png=$(find "$generated_dir" -type f -name '*.png' -newer "$marker" -size +500000c \
    -print 2>/dev/null | while IFS= read -r path; do
      printf '%s\t%s\n' "$(stat -f%m "$path")" "$path"
    done | sort -nr | head -1 | cut -f2-)
  if [[ -z "$source_png" ]]; then
    echo "[lane ${LANE}] 找不到本次新生成的 PNG：${id}" >&2
    tail -20 "$root/.art-$id.log" >&2
    continue
  fi
  cp "$source_png" "$final"
  /bin/rm -f "$marker" "$prompt_file"
  size=$(stat -f%z "$final")
  echo "[lane ${LANE}] OK ${id} ${size} bytes"
done

echo "[lane ${LANE}] 完成。"
