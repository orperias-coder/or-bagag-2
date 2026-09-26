#!/bin/zsh
# גיבוי לילי של הנתונים של אור בגג 2 (סכימת app2) לתיקיית הדרייב "Or BaGag - גיבויים/app2" — קובץ JSON אחד ליום.
# בלי Docker: שולף כל טבלה כ-JSON דרך supabase db query. רץ מ-launchd (com.orbagag2.backup) ב-03:00 כשהמק דלוק.
cd "$HOME/Documents/Claude/Projects/or-bagag-2" || exit 1
OUT="$HOME/Library/CloudStorage/GoogleDrive-or.perias@gmail.com/האחסון שלי/Or BaGag - גיבויים/app2"
mkdir -p "$OUT"
F="$OUT/app2-$(date +%Y-%m-%d).json"; T=$(mktemp)
echo "{\"exportedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" > "$T"
ok=1
for tb in customers jobs quotes quote_versions payments media settings events alerts daily_counts tasks; do
  R=$(/opt/homebrew/bin/supabase db query --linked "select coalesce(json_agg(t),'[]'::json)::text as j from app2.$tb t" 2>/dev/null)
  J=$(printf '%s' "$R" | python3 -c 'import sys,json; s=sys.stdin.read(); d=json.loads(s[s.index("{"):]); print(d["rows"][0]["j"])' 2>/dev/null)
  if [ -z "$J" ]; then ok=0; echo "$(date '+%F %T') FAILED table $tb" >> /tmp/or-bagag-2-backup.log; J='null'; fi
  printf ',"%s":%s' "$tb" "$J" >> "$T"
done
echo "}" >> "$T"
if [ $ok = 1 ] && python3 -c 'import sys,json; d=json.load(open(sys.argv[1])); assert len(d["customers"])>0' "$T" 2>/dev/null; then
  mv "$T" "$F"; echo "$(date '+%F %T') ok $F $(wc -c < "$F") bytes customers=$(python3 -c 'import sys,json; print(len(json.load(open(sys.argv[1]))["customers"]))' "$F")" >> /tmp/or-bagag-2-backup.log
else
  rm -f "$T"; echo "$(date '+%F %T') FAILED (no file written)" >> /tmp/or-bagag-2-backup.log; exit 1
fi
