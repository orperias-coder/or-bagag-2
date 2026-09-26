"""תמונות מלאות מהגיבויים הישנים → Storage (app2-media/<uid>/<media.id>.jpg) + עדכון storage_path.
המפתח בגיבוי מסתיים במזהה-התמונה הישן (= media.legacy_id). מקטין ל-1600px. אידמפוטנטי: מדלג על מה שכבר הועלה.
שימוש: python3 import_media.py   (מריץ גם את ההעלאה דרך supabase storage cp --experimental)"""
import json, glob, os, base64, io, subprocess, sys, tempfile
from PIL import Image, ImageOps
UID = "2f8efb6f-3f81-4f1a-b7f9-c654bb4c0667"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BK = os.path.expanduser("~/Library/CloudStorage/GoogleDrive-or.perias@gmail.com/האחסון שלי/Or BaGag - גיבויים")
def q(sql):
    r = subprocess.run(["supabase", "db", "query", "--linked", sql], capture_output=True, text=True, cwd=ROOT)
    out = r.stdout; j = json.loads(out[out.index("{"):]); return j.get("rows") or []
rows = q(f"select id, legacy_id from app2.media where user_id='{UID}' and storage_path is null and legacy_id is not null")
want = {r["legacy_id"]: r["id"] for r in rows}
print("media without full photo:", len(want), file=sys.stderr)
found = {}
for f in sorted(glob.glob(BK + "/orBagag_backup_*.json"), key=os.path.getmtime, reverse=True):
    if not want: break
    if os.path.getsize(f) < 3_000_000: continue
    try: d = json.load(open(f))
    except Exception: continue
    m = d.get("media") or {}
    for k, v in m.items():
        if not isinstance(v, str) or not v.startswith("data:image"): continue
        for lid in list(want):
            if k.endswith(lid) or k == lid:
                found[lid] = v; want.pop(lid, None)
    print(os.path.basename(f), "→ found so far", len(found), "still missing", len(want), file=sys.stderr)
tmp = tempfile.mkdtemp(); done = 0; fails = 0
for lid, data in found.items():
    mid = [r["id"] for r in rows if r["legacy_id"] == lid][0]
    try:
        raw = base64.b64decode(data.split(",", 1)[1]); im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
        im.thumbnail((1600, 1600)); p = f"{tmp}/{mid}.jpg"; im.save(p, "JPEG", quality=85)
        path = f"{UID}/{mid}.jpg"
        r = subprocess.run(["supabase", "storage", "cp", "--experimental", p, f"ss:///app2-media/{path}"], capture_output=True, text=True, cwd=ROOT)
        if r.returncode or '"uploaded":[]' in r.stdout: raise RuntimeError(r.stdout[-200:] or r.stderr[-200:])
        q(f"update app2.media set storage_path='{path}' where id='{mid}'"); done += 1
    except Exception as e:
        fails += 1; print("FAIL", lid, str(e)[:160], file=sys.stderr)
    if (done + fails) % 10 == 0: print(f"progress {done} ok / {fails} fail", file=sys.stderr, flush=True)
print(f"DONE uploaded={done} failed={fails} missing_in_backups={len(want)}", file=sys.stderr)
