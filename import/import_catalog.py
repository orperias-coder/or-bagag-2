"""הקטלוג הישן (or-bagag-catalog.js, 40 פריטים) → settings.catalog של אור, במיזוג עם מה שכבר יובא (14). קיים גובר לפי שם.
שימוש: python3 import_catalog.py > out.sql ; supabase db query --linked -f out.sql"""
import json, re, sys, os, subprocess
UID = "2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667"
src = os.path.expanduser("~/Documents/Claude/Projects/or-bagag-app/or-bagag-catalog.js")
js = open(src, encoding="utf-8").read()
m = re.search(r'window\.V210_DEFAULT_CATALOG_JSON\s*=\s*("(?:[^"\\]|\\.)*")', js)
data = json.loads(json.loads(m.group(1)))

def walk(node, cat_name, out):
    pass
cats = {c.get("id"): (c.get("name_he") or c.get("name") or c.get("id")) for c in (data.get("categories") or [])}
def parse_items(data):
    out = []
    for it in data.get("items") or []:
        pr = it.get("pricing") or {}
        out.append({"name": it.get("name_he") or it.get("name") or "", "category": cats.get(it.get("category"), it.get("category") or ""), "unit": it.get("unit") or "",
                    "price": pr.get("base") if pr.get("base") is not None else pr.get("min"), "price_min": pr.get("min"), "price_max": pr.get("max"),
                    "description": it.get("description") or it.get("essence") or "", "note": pr.get("note") or "", "legacy_id": it.get("id")})
    return out
items = parse_items(data)
# הקיים בענן
cur = subprocess.run(["supabase", "db", "query", "--linked", f"select catalog::text as c from app2.settings where user_id='{UID}'"], capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))).stdout
existing = []
try:
    rows = json.loads(cur[cur.index("{"):]).get("rows") or []
    if rows: existing = json.loads(rows[0]["c"])
except Exception as e:
    print("-- warn: could not read existing catalog:", e, file=sys.stderr)
names = {(c.get("name") or "").strip() for c in existing}
merged = existing + [i for i in items if (i["name"] or "").strip() and i["name"].strip() not in names]
print("-- old catalog items:", len(items), "existing:", len(existing), "merged:", len(merged), file=sys.stderr)
print(f"update app2.settings set catalog = '{json.dumps(merged, ensure_ascii=False).replace(chr(39), chr(39)*2)}'::jsonb where user_id = '{UID}';")
