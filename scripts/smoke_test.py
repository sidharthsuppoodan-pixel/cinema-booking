#!/usr/bin/env python3
"""End-to-end API test for CINEBOOK (standard library only).

    python3 scripts/smoke_test.py http://localhost <admin-email> <admin-password>

Exercises customer and admin workflows, RBAC, validation and seat-booking
concurrency against a running stack. Creates and then removes its own test data.
"""
import json
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost").rstrip("/")
ADMIN_EMAIL = sys.argv[2] if len(sys.argv) > 2 else "admin@cinebook.local"
ADMIN_PASSWORD = sys.argv[3] if len(sys.argv) > 3 else "Admin@12345"

passed = failed = 0


def call(method, path, body=None, token=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", ctype)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except ValueError:
            return e.code, txt


def check(name, cond, info=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}  {info}")


def main():
    print(f"Testing {BASE}\n")
    print("[public]")
    s, b = call("GET", "/api/health")
    check("health", s == 200 and b["database"] == "ok", b)
    s, movies = call("GET", "/api/movies")
    check("list movies", s == 200 and len(movies) > 0, s)
    s, theatres = call("GET", "/api/theatres")
    check("list theatres", s == 200 and len(theatres) > 0, s)
    s, shows = call("GET", "/api/showtimes")
    check("list upcoming showtimes", s == 200 and len(shows) > 0, s)
    s, _ = call("GET", f"/api/movies/{movies[0]['id']}")
    check("movie detail", s == 200)

    print("\n[auth & validation]")
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    s, b = call("POST", "/api/auth/register", {"full_name": "Test User", "email": email, "password": "short"})
    check("weak password rejected (422)", s == 422 and isinstance(b["detail"], str), b)
    s, b = call("POST", "/api/auth/register", {"full_name": "Test User", "email": "not-an-email", "password": "Passw0rd!"})
    check("invalid email rejected (422)", s == 422, b)
    s, b = call("POST", "/api/auth/register",
                {"full_name": "Test User", "email": email, "phone": "+91 98765 43210", "password": "Passw0rd!"})
    check("register customer", s == 201 and b["user"]["role"] == "customer", b)
    s, _ = call("POST", "/api/auth/register", {"full_name": "Dup", "email": email, "password": "Passw0rd!"})
    check("duplicate email rejected (409)", s == 409)
    s, b = call("POST", "/api/auth/login", {"email": email, "password": "wrong-pass1"})
    check("wrong password rejected (401)", s == 401)
    s, b = call("POST", "/api/auth/login", {"email": email.upper(), "password": "Passw0rd!"})
    check("login (case-insensitive email)", s == 200 and "access_token" in b, b)
    ctok = b["access_token"]
    s, b = call("GET", "/api/auth/me", token=ctok)
    check("me", s == 200 and b["email"] == email)
    s, b = call("GET", "/api/movies?q=" + urllib.parse.quote("' OR 1=1 --"))
    check("SQL injection attempt is inert", s == 200 and b == [], b)

    print("\n[RBAC]")
    s, _ = call("GET", "/api/admin/stats")
    check("admin endpoint without token -> 401", s == 401)
    s, _ = call("GET", "/api/admin/stats", token=ctok)
    check("admin endpoint as customer -> 403", s == 403)
    s, _ = call("POST", "/api/movies", {"title": "x"}, token=ctok)
    check("customer cannot create movie -> 403", s == 403)
    s, _ = call("GET", "/api/auth/me", token="garbage.token.value")
    check("forged token -> 401", s == 401)

    print("\n[customer booking]")
    later = datetime.now(timezone.utc) + timedelta(hours=26)
    show = next(x for x in shows if x["available_count"] >= 6
                and datetime.fromisoformat(x["start_time"].replace("Z", "+00:00")) > later)
    s, smap = call("GET", f"/api/showtimes/{show['id']}/seats")
    check("seat map", s == 200 and len(smap["rows"]) > 0, s)
    avail = [seat for row in smap["rows"] for seat in row["seats"] if seat["status"] == "available"]
    pick = avail[:2]
    s, bk = call("POST", "/api/bookings",
                 {"showtime_id": show["id"], "seat_ids": [p["id"] for p in pick], "payment_method": "UPI"}, ctok)
    check("create booking", s == 201 and bk["booking_code"].startswith("CB"), bk)
    expected = sum(p["price"] for p in pick) + smap["convenience_fee_per_ticket"] * 2
    check("price calculated server-side", abs(bk["total_amount"] - expected) < 0.01, (bk["total_amount"], expected))
    check("payment captured", bk["payment"]["status"] == "PAID")
    code = bk["booking_code"]
    s, _ = call("POST", "/api/bookings",
                {"showtime_id": show["id"], "seat_ids": [pick[0]["id"]], "payment_method": "CARD"}, ctok)
    check("double booking same seat -> 409", s == 409)
    s, smap2 = call("GET", f"/api/showtimes/{show['id']}/seats")
    st = {seat["id"]: seat["status"] for row in smap2["rows"] for seat in row["seats"]}
    check("seats show as booked", all(st[p["id"]] == "booked" for p in pick))

    # Concurrency: 8 parallel requests for the same free seat -> exactly one wins.
    target = avail[3]["id"]
    results = []

    def grab():
        results.append(call("POST", "/api/bookings",
                            {"showtime_id": show["id"], "seat_ids": [target], "payment_method": "CARD"}, ctok)[0])

    threads = [threading.Thread(target=grab) for _ in range(8)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    check("concurrent booking of one seat: exactly one success",
          results.count(201) == 1 and results.count(409) == 7, results)

    s, mine = call("GET", "/api/bookings/me", token=ctok)
    check("booking history", s == 200 and any(x["booking_code"] == code for x in mine))
    s, q = call("GET", f"/api/bookings/{code}/cancellation", token=ctok)
    check("cancellation quote", s == 200 and "cancellable" in q, q)
    if q["cancellable"]:
        s, cb = call("POST", f"/api/bookings/{code}/cancel", {"reason": "test"}, ctok)
        check("cancel booking", s == 200 and cb["status"] == "CANCELLED", cb)
        check("refund recorded", cb["payment"]["status"] in ("REFUNDED", "PARTIALLY_REFUNDED"), cb["payment"])
        s, smap3 = call("GET", f"/api/showtimes/{show['id']}/seats")
        st = {seat["id"]: seat["status"] for row in smap3["rows"] for seat in row["seats"]}
        check("cancelled seats released", all(st[p["id"]] == "available" for p in pick))
    s, _ = call("POST", f"/api/bookings/{code}/cancel", None, ctok)
    check("cannot cancel twice -> 400", s == 400)

    print("\n[admin]")
    s, b = call("POST", "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    check("admin login", s == 200 and b["user"]["role"] == "admin", b)
    atok = b["access_token"]
    s, b = call("POST", "/api/bookings",
                {"showtime_id": show["id"], "seat_ids": [avail[5]["id"]], "payment_method": "UPI"}, atok)
    check("admin cannot place customer booking -> 403", s == 403)
    s, stats = call("GET", "/api/admin/stats", token=atok)
    check("dashboard stats", s == 200 and stats["total_movies"] > 0 and len(stats["daily"]) == 7, stats if s != 200 else "")

    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    boundary = "----cinebook" + uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"p.png\"\r\n"
            f"Content-Type: image/png\r\n\r\n").encode() + png + f"\r\n--{boundary}--\r\n".encode()
    s, up = call("POST", "/api/admin/uploads/poster", raw=body, token=atok,
                 ctype=f"multipart/form-data; boundary={boundary}")
    check("poster upload", s == 201 and up["url"].startswith("/media/posters/"), up)

    movie = {"title": "Smoke Test Movie", "description": "d", "genre": "Drama", "language": "Malayalam",
             "duration_minutes": 125, "rating": 8.2, "certificate": "UA", "release_date": "2026-10-01",
             "poster_url": up.get("url") if isinstance(up, dict) else None,
             "trailer_url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "is_active": True}
    s, m = call("POST", "/api/movies", movie, atok)
    check("create movie", s == 201, m)
    s, m2 = call("PUT", f"/api/movies/{m['id']}", {**movie, "title": "Smoke Test Movie 2"}, atok)
    check("update movie", s == 200 and m2["title"] == "Smoke Test Movie 2", m2)
    s, _ = call("POST", "/api/movies", {**movie, "duration_minutes": 0}, atok)
    check("invalid movie rejected (422)", s == 422)

    s, t = call("POST", "/api/theatres", {"name": "Smoke Cinema", "address": "1 Test St", "city": "Testville"}, atok)
    check("create theatre", s == 201, t)
    s, t2 = call("PUT", f"/api/theatres/{t['id']}",
                 {"name": "Smoke Cinema 2", "address": "2 Test St", "city": "Testville"}, atok)
    check("update theatre", s == 200 and t2["name"] == "Smoke Cinema 2", t2)

    layout = [{"category": "STANDARD", "rows": 2}, {"category": "RECLINER", "rows": 1}]
    s, sc = call("POST", "/api/screens", {"theatre_id": t["id"], "name": "S1", "screen_type": "2D",
                                          "seats_per_row": 8, "seat_layout": layout}, atok)
    check("create screen with seats", s == 201 and sc["capacity"] == 24, sc)
    s, sc2 = call("PUT", f"/api/screens/{sc['id']}", {"name": "S1", "screen_type": "IMAX", "seats_per_row": 10,
                                                       "seat_layout": layout + [{"category": "PREMIUM", "rows": 1}]},
                  atok)
    check("update screen layout regenerates seats", s == 200 and sc2["capacity"] == 40, sc2)
    s, seat = call("PATCH", f"/api/screens/seats/{sc2['seats'][0]['id']}", {"is_active": False}, atok)
    check("disable a seat", s == 200 and seat["is_active"] is False)

    start = (datetime.now(timezone.utc) + timedelta(days=2)).replace(minute=0, second=0, microsecond=0)
    payload = {"movie_id": m["id"], "screen_id": sc["id"], "start_time": start.isoformat(),
               "price_standard": 150, "price_premium": 220, "price_recliner": 400}
    s, sh = call("POST", "/api/showtimes", payload, atok)
    check("create showtime", s == 201 and sh["capacity"] == 39, sh)
    s, b = call("POST", "/api/showtimes", {**payload, "start_time": (start + timedelta(minutes=60)).isoformat()}, atok)
    check("overlapping showtime rejected (409)", s == 409, b)
    s, sh2 = call("PUT", f"/api/showtimes/{sh['id']}", {**payload, "price_standard": 175}, atok)
    check("update showtime price", s == 200 and sh2["price_standard"] == 175, sh2)

    s, smap = call("GET", f"/api/showtimes/{sh['id']}/seats")
    free = [x["id"] for r in smap["rows"] for x in r["seats"] if x["status"] == "available"][:3]
    s, bk2 = call("POST", "/api/bookings", {"showtime_id": sh["id"], "seat_ids": free, "payment_method": "CARD"}, ctok)
    check("customer books new showtime", s == 201, bk2)
    code2 = bk2["booking_code"]
    s, b = call("DELETE", f"/api/showtimes/{sh['id']}", token=atok)
    check("cannot delete showtime with bookings (409)", s == 409, b)
    s, b = call("PUT", f"/api/screens/{sc['id']}", {"name": "S1", "screen_type": "2D", "seats_per_row": 6,
                                                     "seat_layout": layout}, atok)
    check("cannot change layout of booked screen (409)", s == 409, b)

    s, pg = call("GET", f"/api/admin/bookings?q={code2}", token=atok)
    check("search booking by ID", s == 200 and pg["total"] == 1 and pg["items"][0]["customer_email"] == email, pg)
    s, b = call("PATCH", f"/api/admin/bookings/{code2}", {"status": "COMPLETED"}, atok)
    check("update booking status", s == 200 and b["status"] == "COMPLETED", b)
    s, b = call("PATCH", f"/api/admin/bookings/{code2}", {"status": "CONFIRMED"}, atok)
    s, b = call("POST", f"/api/admin/bookings/{code2}/cancel", {"reason": "admin test"}, atok)
    check("admin cancel with full refund", s == 200 and b["payment"]["status"] == "REFUNDED", b)

    s, cs = call("GET", f"/api/admin/customers?q={urllib.parse.quote(email)}", token=atok)
    check("search customers", s == 200 and cs["total"] == 1, cs)
    cid = cs["items"][0]["id"]
    s, c = call("PUT", f"/api/admin/customers/{cid}", {"full_name": "Renamed User", "phone": "+91 90000 00000"}, atok)
    check("update customer", s == 200 and c["full_name"] == "Renamed User", c)
    s, c = call("GET", f"/api/admin/customers/{cid}", token=atok)
    check("customer detail with bookings", s == 200 and len(c["bookings"]) >= 2, c)

    print("\n[cleanup]")
    s, _ = call("DELETE", f"/api/admin/customers/{cid}", token=atok)
    check("delete customer (cascades their bookings)", s == 204)
    s, _ = call("DELETE", f"/api/showtimes/{sh['id']}", token=atok)
    check("delete showtime", s == 204)
    s, _ = call("DELETE", f"/api/screens/{sc['id']}", token=atok)
    check("delete screen", s == 204)
    s, _ = call("DELETE", f"/api/theatres/{t['id']}", token=atok)
    check("delete theatre", s == 204)
    s, _ = call("DELETE", f"/api/movies/{m['id']}", token=atok)
    check("delete movie", s == 204)
    s, _ = call("GET", f"/api/movies/{m['id']}")
    check("deleted movie is gone (404)", s == 404)

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
