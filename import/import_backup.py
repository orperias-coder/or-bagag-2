"""ייבוא מגיבוי של האפליקציה הישנה (orBagag_backup_*.json) לסכימת app2 — כקובץ SQL של upserts.
אידמפוטנטי: לכל רשומה legacy_id, ריצה חוזרת על גיבוי חדש יותר מעדכנת ולא מכפילה.
שימוש: python3 import_backup.py <backup.json> <user_uuid> > out.sql
המיפוי: לקוח(client)→customers · פרויקט/ביקור/ליד → job אחד (לפי הקישורים ביניהם) · הצעה→quotes(+גרסה) · תשלום→payments · תמונה→media(thumb בלבד).
"""
import json, sys, datetime, uuid, re

src, UID = sys.argv[1], sys.argv[2]
d = json.load(open(src))
NS = uuid.UUID("6d3b1f2e-0000-4000-8000-000000000a02")  # מזהי-UUID יציבים מהמזהים הישנים
def U(kind, lid): return str(uuid.uuid5(NS, f"{kind}:{lid}"))
def q(v):
    if v is None or v == "": return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return repr(v)
    return "'" + str(v).replace("'", "''") + "'"
def J(v): return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
def ts(v):
    if not v: return "null"
    try:
        if isinstance(v, (int, float)): return q(datetime.datetime.fromtimestamp(v / 1000, datetime.timezone.utc).isoformat())
        if isinstance(v, str): return q(v)
    except Exception: pass
    return "null"
def lst(v):  # תמונות בישנה: לפעמים רשימה, לפעמים מילון {id: photo}
    if isinstance(v, dict): return [x if isinstance(x, dict) else {"id": k, "thumbDataUrl": x} for k, x in v.items()]
    return v if isinstance(v, list) else []
def num(v):
    try: return float(str(v).replace(",", "")) if v not in (None, "") else None
    except Exception: return None

out = ["begin;", f"set local search_path = app2;"]
def emit(table, row, conflict="user_id, legacy_id"):
    cols = list(row); vals = [row[c] for c in cols]
    upd = ", ".join(f"{c}=excluded.{c}" for c in cols if c not in ("id", "user_id", "legacy_id", "created_at"))
    where = " where legacy_id is not null" if "legacy_id" in conflict else ""
    out.append(f"insert into {table} ({', '.join(cols)}) values ({', '.join(vals)}) on conflict ({conflict}){where} do update set {upd};")

clients, projects, visits, leads, quotes = d.get("clients") or [], d.get("projects") or [], d.get("visits") or [], d.get("leads") or [], d.get("quotes") or []
cust_by_lid, cust_by_phone, cust_by_name = {}, {}, {}
def norm_phone(p): return re.sub(r"\D", "", p or "")[-9:] if p else ""

# ---- לקוחות ----
for c in clients:
    lid = str(c["id"]); cid = U("client", lid); cust_by_lid[lid] = cid
    if norm_phone(c.get("phone")): cust_by_phone.setdefault(norm_phone(c.get("phone")), cid)
    if c.get("clientName"): cust_by_name.setdefault(c["clientName"].strip(), cid)
    emit("customers", {"id": q(cid), "user_id": q(UID), "name": q(c.get("clientName") or "ללא שם"), "phone": q(c.get("phone")), "address": q(c.get("address")),
        "email": q(c.get("email")), "notes": q(c.get("notes")), "source": q(c.get("source") or "ישן"), "legacy_id": q(lid),
        "created_at": ts(c.get("createdAt")) if c.get("createdAt") else "now()", "deleted_at": ts(c.get("mergedAt")) if c.get("mergedIntoId") else "null"})

def customer_for(obj):
    """מוצא/יוצר לקוח לרשומה ישנה (clientId → טלפון → שם → חדש)."""
    lid = str(obj.get("clientId") or "")
    if lid in cust_by_lid: return cust_by_lid[lid]
    ph = norm_phone(obj.get("phone") or obj.get("clientPhone"))
    if ph in cust_by_phone: return cust_by_phone[ph]
    name = (obj.get("clientName") or "").strip()
    if name in cust_by_name: return cust_by_name[name]
    key = f"auto:{name}:{ph}" if (name or ph) else f"auto:{obj.get('id')}"
    cid = U("client", key); cust_by_lid[key] = cid
    if ph: cust_by_phone[ph] = cid
    if name: cust_by_name[name] = cid
    emit("customers", {"id": q(cid), "user_id": q(UID), "name": q(name or "ללא שם"), "phone": q(obj.get("phone") or obj.get("clientPhone")),
        "address": q(obj.get("address") or obj.get("clientAddress")), "email": q(obj.get("email")), "source": q("ישן"), "legacy_id": q(key), "created_at": ts(obj.get("createdAt")) or "now()"})
    return cid

# ---- עבודות: פרויקט = עוגן; ביקורים/לידים/הצעות מקושרים מצטרפים אליו ----
job_of_visit, job_of_lead, job_of_quote, job_of_project = {}, {}, {}, {}
STAGE_P = {"active": "doing", "in_progress": "doing", "doing": "doing", "done": "paid", "completed": "paid", "finished": "paid", "paid": "paid", "planned": "approved", "scheduled": "approved", "approved": "approved", "cancelled": "lost", "lost": "lost"}
def stage_of_quote(qs): return {"sent": "sent", "accepted": "approved", "rejected": "lost"}.get(qs, "quote")
jobs = {}
for p in projects:
    jid = U("project", p["id"]); job_of_project[str(p["id"])] = jid
    paid = sum(num(x.get("amount")) or 0 for x in (p.get("payments") or []))
    est = num(p.get("estimatedTotal"))
    stage = STAGE_P.get(str(p.get("status") or "").lower(), "doing")
    if stage == "doing" and est and paid >= est - 1: stage = "paid"
    jobs[jid] = {"id": jid, "customer": customer_for(p), "title": p.get("title") or p.get("jobType"), "stage": stage, "stage_at": p.get("statusChangedAt") or p.get("updatedAt"),
        "visit_at": p.get("visitDate"), "notes": p.get("notes"), "approved_at": p.get("createdAt"), "started_at": p.get("actualStartDate") or p.get("targetStartDate"),
        "finished_at": p.get("actualEndDate") or p.get("finishedAt"), "paid_at": None, "price": est, "legacy_id": p["id"], "kind": "project", "created": p.get("createdAt"), "payments": lst(p.get("payments")), "photos": lst(p.get("progressPhotos"))}
    for vid in (p.get("sourceVisitId"),):
        if vid: job_of_visit[str(vid)] = jid
    for qid in [p.get("sourceQuoteId")] + list(p.get("linkedQuoteIds") or []):
        if qid: job_of_quote[str(qid)] = jid
for v in visits:
    for pid in (v.get("linkedProjectIds") or []):
        if str(pid) in job_of_project: job_of_visit[str(v["id"])] = job_of_project[str(pid)]
    if str(v["id"]) not in job_of_visit:
        jid = U("visit", v["id"]); job_of_visit[str(v["id"])] = jid
        jobs[jid] = {"id": jid, "customer": customer_for(v), "title": None, "stage": "visit", "stage_at": v.get("updatedAt"), "visit_at": v.get("scheduledAt") or v.get("arrivedAt") or v.get("occurredAt"),
            "notes": v.get("finalNote"), "approved_at": None, "started_at": None, "finished_at": None, "paid_at": None, "price": None, "legacy_id": v["id"], "kind": "visit", "created": v.get("createdAt"), "payments": [], "photos": []}
    jid = job_of_visit[str(v["id"])]
    for qid in (v.get("linkedQuoteIds") or []): job_of_quote.setdefault(str(qid), jid)
    if v.get("leadId"): job_of_lead[str(v["leadId"])] = jid
    J_ = jobs.get(jid)
    if J_ is not None:
        J_["visit_at"] = J_["visit_at"] or v.get("scheduledAt") or v.get("arrivedAt")
        if v.get("finalNote") and not J_["notes"]: J_["notes"] = v.get("finalNote")
        meas = v.get("measurements");
        if meas: J_["notes"] = ((J_["notes"] or "") + "\nמטראז'ים: " + json.dumps(meas, ensure_ascii=False)).strip()
        J_["photos"] = lst(J_["photos"]) + [ph for k in ("photos", "roofPhotos", "outsidePhotos", "interiorMoisturePhotos") for ph in lst(v.get(k))]
for l in leads:
    if l.get("linkedVisitId") and str(l["linkedVisitId"]) in job_of_visit: job_of_lead[str(l["id"])] = job_of_visit[str(l["linkedVisitId"])]
    if str(l["id"]) not in job_of_lead:
        jid = U("lead", l["id"]); job_of_lead[str(l["id"])] = jid
        st = "lost" if str(l.get("status") or "").lower() in ("lost", "closed", "rejected", "dead") else "lead"
        jobs[jid] = {"id": jid, "customer": customer_for(l), "title": None, "stage": st, "stage_at": l.get("updatedAt"), "visit_at": l.get("nextActionAt"),
            "notes": l.get("notes"), "approved_at": None, "started_at": None, "finished_at": None, "paid_at": None, "price": None, "legacy_id": l["id"], "kind": "lead", "created": l.get("createdAt"), "payments": [], "photos": lst(l.get("photos")), "problem": l.get("description")}
for qu in quotes:
    lid = str(qu["id"])
    jid = job_of_quote.get(lid) or (job_of_project.get(str(qu.get("linkedProjectId"))) if qu.get("linkedProjectId") else None) or (job_of_visit.get(str(qu.get("sourceVisitId"))) if qu.get("sourceVisitId") else None) or (job_of_lead.get(str(qu.get("leadId"))) if qu.get("leadId") else None)
    if not jid:
        jid = U("quote-job", lid)
        jobs[jid] = {"id": jid, "customer": customer_for(qu), "title": None, "stage": stage_of_quote(qu.get("status")), "stage_at": qu.get("sentAt") or qu.get("updatedAt"), "visit_at": None,
            "notes": None, "approved_at": None, "started_at": None, "finished_at": None, "paid_at": None, "price": None, "legacy_id": "q:" + lid, "kind": "quote", "created": qu.get("createdAt"), "payments": [], "photos": []}
    job_of_quote[lid] = jid
    J_ = jobs[jid]
    if J_["stage"] in ("lead", "visit", "quote", "sent") and stage_of_quote(qu.get("status")) != "quote":
        order = ["lead", "visit", "quote", "sent", "approved", "doing", "paid", "lost"]
        ns = stage_of_quote(qu.get("status"))
        if ns == "lost" and J_["stage"] != "lead": pass
        elif order.index(ns) > order.index(J_["stage"]): J_["stage"] = ns
    elif J_["stage"] in ("lead", "visit") : J_["stage"] = "quote"
    if qu.get("sentAt"): J_["sent_at"] = qu.get("sentAt")

for jid, j in jobs.items():
    row = {"id": q(jid), "user_id": q(UID), "customer_id": q(j["customer"]), "title": q(j.get("title")), "stage": q(j["stage"]), "stage_changed_at": ts(j.get("stage_at")) if j.get("stage_at") else "now()",
        "problem": q(j.get("problem")), "visit_at": ts(j.get("visit_at")), "visit_notes": q(j.get("notes")), "quote_sent_at": ts(j.get("sent_at")),
        "approved_at": ts(j.get("approved_at")) if j["stage"] in ("approved", "doing", "paid") else "null", "started_at": ts(j.get("started_at")), "finished_at": ts(j.get("finished_at")),
        "paid_at": ts(max((x.get("date") or 0) for x in j["payments"])) if j["payments"] and j["stage"] == "paid" else "null",
        "price_agreed": q(j.get("price")), "legacy_id": q(j["legacy_id"]), "legacy_kind": q(j["kind"]), "created_at": ts(j.get("created")) if j.get("created") else "now()"}
    emit("jobs", row)
    for pay in j["payments"]:
        emit("payments", {"id": q(U("payment", pay.get("id") or f"{jid}:{pay.get('date')}")), "user_id": q(UID), "job_id": q(jid), "amount": q(num(pay.get("amount")) or 0),
            "paid_at": (ts(pay.get("date")) + "::date") if pay.get("date") else "current_date", "method": q(pay.get("method")), "note": q(pay.get("note")), "invoice_issued": q(bool(pay.get("invoiceIssued"))),
            "legacy_id": q(pay.get("id") or f"{jid}:{pay.get('date')}"), "created_at": ts(pay.get("createdAt")) if pay.get("createdAt") else "now()"})
    for ph in j["photos"]:
        if not isinstance(ph, dict) or not ph.get("id"): continue
        thumb = ph.get("thumbDataUrl") or ph.get("thumb")
        if thumb and len(thumb) > 80000: thumb = None
        emit("media", {"id": q(U("media", ph["id"])), "user_id": q(UID), "job_id": q(jid), "customer_id": q(j["customer"]), "kind": q("photo"), "thumb_data": q(thumb),
            "taken_at": ts(ph.get("ts") or ph.get("createdAt") or ph.get("takenAt")), "caption": q(ph.get("caption") or ph.get("note")), "legacy_id": q(ph["id"]),
            "created_at": ts(ph.get("createdAt")) if ph.get("createdAt") else "now()"})

# ---- הצעות ----
def qnum(qu):  # בישנה: quoteNumber=9 → מוצג "2026-009" (השנה לפי תאריך היצירה)
    n = qu.get("quoteNumber"); code = qu.get("quoteCode")
    if isinstance(code, str) and re.fullmatch(r"\d{4}-\d{3}", code): return code
    if n in (None, ""): return None
    c = qu.get("createdAt"); y = None
    try: y = datetime.datetime.fromtimestamp(c / 1000).year if isinstance(c, (int, float)) else int(str(c)[:4])
    except Exception: y = int(d.get("lastQuoteYear") or datetime.date.today().year)
    return f"{y}-{int(float(n)):03d}"
for qu in quotes:
    lid = str(qu["id"]); qid = U("quote", lid)
    items = []
    for it in (qu.get("items") or []):
        if not isinstance(it, dict): continue
        items.append({"title": it.get("title") or "", "description": it.get("description") or "", "qty": num(it.get("quantity")) or 1, "unit": it.get("unit") or "",
            "price_per_unit": num(it.get("pricePerUnit")) or 0, "total": num(it.get("total")) or 0, "urgency": it.get("urgency") or "", "visible": it.get("visible", True), "legacy_id": it.get("id")})
    before = sum(x["total"] for x in items if x["visible"])
    disc = None
    if qu.get("discountValue"):
        disc = {"type": qu.get("discountType") or "amount", "value": num(qu.get("discountValue"))}
        before = before - (before * disc["value"] / 100 if disc["type"] in ("percent", "%") else disc["value"])
    vat = num(qu.get("vatRate")) if qu.get("vatRate") not in (None, "") else 18
    opts = {k: qu[k] for k in qu if k.startswith("show") or k in ("hidePricePerUnitInPDF", "extendedPDF", "unforeseenClause", "estimatedDays", "estimatedStartDate", "estimatedStartCustom")}
    st = qu.get("status") if qu.get("status") in ("draft", "sent", "accepted", "rejected") else "draft"
    emit("quotes", {"id": q(qid), "user_id": q(UID), "job_id": q(job_of_quote[lid]), "number": q(qnum(qu)), "version": "1", "status": q(st),
        "items": J(items), "discount": J(disc) if disc else "null", "vat_rate": q(vat), "validity_days": q(int(num(qu.get("validityDays")) or 30)), "payment_terms": q(qu.get("paymentTerms")),
        "notes": q(qu.get("notes")), "options": J(opts), "total_before_vat": q(round(before, 2)), "total": q(round(before * (1 + vat / 100), 2)), "sent_at": ts(qu.get("sentAt")),
        "legacy_id": q(lid), "created_at": ts(qu.get("createdAt")) if qu.get("createdAt") else "now()"})
    if st != "draft":  # הצעה שכבר נשלחה — הגרסה שנשלחה נשמרת כגרסה 1
        emit("quote_versions", {"id": q(U("qv", lid + ":1")), "user_id": q(UID), "quote_id": q(qid), "version": "1", "snapshot": J({"items": items, "discount": disc, "vat_rate": vat, "number": qu.get("quoteNumber"), "sent_at": qu.get("sentAt")}), "created_at": ts(qu.get("sentAt") or qu.get("updatedAt")) or "now()"}, conflict="id")

# ---- הגדרות: עסק, תבנית, מונה, קטלוג ----
catalog = []
for name, w in (d.get("workTypeTemplates") or {}).items():
    pr = w.get("pricing") or {}
    catalog.append({"name": w.get("name") or name, "category": w.get("category"), "unit": w.get("unit"), "price": pr.get("base"), "price_min": pr.get("min"), "price_max": pr.get("max"), "description": w.get("quote_summary") or w.get("essence") or "", "legacy_id": w.get("id")})
for m in (d.get("modifiers") or []):
    catalog.append({"name": m.get("name"), "category": "מקדם: " + (m.get("category") or ""), "unit": m.get("unit"), "price": m.get("min"), "price_min": m.get("min"), "price_max": m.get("max"), "description": m.get("description") or "", "legacy_id": m.get("id")})
year = int(d.get("lastQuoteYear") or datetime.date.today().year)
out.append(f"insert into settings (user_id, business, quote_template, next_quote_number, quote_year, catalog) values ({q(UID)}, {J(d.get('business') or {})}, {J(d.get('quoteTemplate') or {})}, {int(d.get('nextQuoteNumber') or 1)}, {year}, {J(catalog)}) "
           f"on conflict (user_id) do update set business=excluded.business, quote_template=excluded.quote_template, next_quote_number=greatest(settings.next_quote_number, excluded.next_quote_number), quote_year=excluded.quote_year, catalog=excluded.catalog;")
out.append(f"insert into events (user_id, entity, entity_id, action, diff) values ({q(UID)}, 'import', {q(U('import', src))}, 'import', {J({'source': src.split('/')[-1], 'clients': len(clients), 'projects': len(projects), 'visits': len(visits), 'leads': len(leads), 'quotes': len(quotes), 'jobs': len(jobs), 'catalog': len(catalog)})});")
out.append("commit;")
print("\n".join(out))
print(f"-- summary: customers~{len(cust_by_lid)} jobs={len(jobs)} quotes={len(quotes)} catalog={len(catalog)}", file=sys.stderr)
