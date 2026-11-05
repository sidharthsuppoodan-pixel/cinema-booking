"""Bootstrap data.

* Always ensures the administrator account from ADMIN_EMAIL / ADMIN_PASSWORD exists.
* When SEED_SAMPLE_DATA=true and the database has no movies, loads a starter
  catalogue (Blender Foundation open movies, CC-BY licensed) with theatres,
  screens and a week of showtimes.

Usage:
    python -m app.services.seed               # admin + sample data (if empty)
    python -m app.services.seed --showtimes   # add another week of showtimes
"""
import argparse
import html
import logging
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.config import settings
from app.database import SessionLocal
from app.models import Movie, Screen, Showtime, Theatre, User
from app.models.enums import UserRole
from app.services.screen_service import generate_seats
from app.services.security import hash_password

log = logging.getLogger("cinebook.seed")

MOVIES = [
    dict(title="Sintel", genre="Animation, Fantasy, Adventure", language="English", duration_minutes=15,
         rating=8.1, certificate="UA", release_date=date(2010, 9, 27), director="Colin Levy",
         cast_members="Halina Reijn, Thom Hoffman",
         trailer_url="https://www.youtube.com/watch?v=eRsGyueVLvQ",
         description="A lone young woman crosses frozen mountains and scorched deserts searching for the baby "
                     "dragon she once rescued, only to discover that the hunt has changed her more than she knows.",
         colors=("#7f1d1d", "#111827")),
    dict(title="Tears of Steel", genre="Sci-Fi, Action", language="English", duration_minutes=12,
         rating=7.4, certificate="UA", release_date=date(2012, 9, 26), director="Ian Hubert",
         cast_members="Derek de Lint, Sergio Hasselbaink, Rogier Schippers",
         trailer_url="https://www.youtube.com/watch?v=R6MlUcmOul8",
         description="In a future Amsterdam overrun by machines, a band of scientists and warriors stages a "
                     "desperate experiment to rewrite one painful memory and save the world.",
         colors=("#0f172a", "#b91c1c")),
    dict(title="Big Buck Bunny", genre="Animation, Comedy, Family", language="No Dialogue", duration_minutes=10,
         rating=7.9, certificate="U", release_date=date(2008, 5, 30), director="Sacha Goedegebure",
         cast_members="Animated feature",
         trailer_url="https://www.youtube.com/watch?v=aqz-KE-bpKQ",
         description="A gentle giant of a rabbit has his peaceful morning ruined by three mischievous rodents "
                     "and plots a delightfully elaborate revenge.",
         colors=("#14532d", "#facc15")),
    dict(title="Sprite Fright", genre="Horror, Comedy", language="English", duration_minutes=10,
         rating=7.6, certificate="UA", release_date=date(2021, 10, 29),
         director="Matthew Luhn, Hjalti Hjálmarsson", cast_members="Animated feature",
         trailer_url="https://www.youtube.com/watch?v=_cMxraX_5RE",
         description="A group of rowdy teenagers on a woodland outing learns the hard way that the forest's "
                     "tiny, adorable mushroom folk do not take kindly to littering.",
         colors=("#3f6212", "#450a0a")),
    dict(title="Cosmos Laundromat", genre="Comedy, Drama, Fantasy", language="English", duration_minutes=12,
         rating=7.3, certificate="UA", release_date=date(2015, 8, 10), director="Mathieu Auvray",
         cast_members="Pierre Bokma, Reinout Scholten van Aschat",
         trailer_url="https://www.youtube.com/watch?v=Y-rmzh0PI3c",
         description="On a desolate island, a weary sheep named Franck meets a fast-talking salesman who offers "
                     "him a ticket to any life he can imagine.",
         colors=("#1e3a8a", "#831843")),
    dict(title="Spring", genre="Animation, Fantasy", language="No Dialogue", duration_minutes=8,
         rating=7.7, certificate="U", release_date=date(2019, 4, 4), director="Andy Goralczyk",
         cast_members="Animated feature",
         trailer_url="https://www.youtube.com/watch?v=WhWc3b3KhnY",
         description="A shepherd girl and her loyal dog face ancient mountain spirits in a breathtaking quest "
                     "to bring the land back to life after a long winter.",
         colors=("#064e3b", "#7c2d12")),
    dict(title="Agent 327: Operation Barbershop", genre="Action, Comedy, Spy", language="English",
         duration_minutes=4, rating=7.8, certificate="UA", release_date=date(2017, 5, 15),
         director="Colin Levy, Hjalti Hjálmarsson", cast_members="Animated feature",
         trailer_url="https://www.youtube.com/watch?v=mN0zPOpADL4",
         description="Europe's most unlucky secret agent goes undercover in a barbershop that hides far more "
                     "than hair tonic and sharp razors.",
         colors=("#1c1917", "#ea580c")),
    dict(title="Charge", genre="Action, Thriller, Sci-Fi", language="English", duration_minutes=4,
         rating=7.2, certificate="A", release_date=date(2022, 12, 13), director=None,
         cast_members="Animated feature",
         trailer_url="https://www.youtube.com/watch?v=UXqq0ZvbOnk",
         description="In a dystopian, energy-starved future, an old man breaks into a heavily guarded power "
                     "plant for a single charge, and a ruthless security droid is waiting.",
         colors=("#172554", "#dc2626")),
]

THEATRES = [
    dict(name="Starlight Cinemas", address="MG Road, Ernakulam", city="Kochi", state="Kerala", pincode="682016",
         contact_phone="+91 484 400 1234", amenities="Dolby Atmos, Recliners, Food Court, Parking",
         screens=[("Screen 1", "IMAX"), ("Screen 2", "2D"), ("Screen 3", "3D")]),
    dict(name="Royal Screens Multiplex", address="100 Feet Road, Indiranagar", city="Bengaluru",
         state="Karnataka", pincode="560038", contact_phone="+91 80 4000 5678",
         amenities="4K Laser, Recliners, Café, Wheelchair Access",
         screens=[("Audi 1", "2D"), ("Audi 2", "4DX")]),
    dict(name="Galaxy Picture Palace", address="Usman Road, T. Nagar", city="Chennai", state="Tamil Nadu",
         pincode="600017", contact_phone="+91 44 4000 9012", amenities="Dolby 7.1, Snack Bar, Parking",
         screens=[("Screen A", "2D"), ("Screen B", "3D")]),
]

LAYOUTS = {
    "IMAX": (16, [{"category": "STANDARD", "rows": 5}, {"category": "PREMIUM", "rows": 4},
                  {"category": "RECLINER", "rows": 2}]),
    "4DX": (12, [{"category": "PREMIUM", "rows": 6}, {"category": "RECLINER", "rows": 2}]),
    "3D": (14, [{"category": "STANDARD", "rows": 5}, {"category": "PREMIUM", "rows": 3},
                {"category": "RECLINER", "rows": 2}]),
    "2D": (14, [{"category": "STANDARD", "rows": 4}, {"category": "PREMIUM", "rows": 4},
                {"category": "RECLINER", "rows": 2}]),
}
PRICES = {"2D": (180, 260, 450), "3D": (220, 300, 500), "IMAX": (320, 420, 700), "4DX": (450, 550, 800)}
SHOW_TIMES = [time(10, 0), time(13, 15), time(16, 30), time(19, 45), time(22, 30)]


def _poster_svg(title: str, genre: str, c1: str, c2: str) -> str:
    words, lines, cur = title.upper().split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > 14 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    tspans = "".join(
        f'<tspan x="200" dy="{0 if i == 0 else 52}">{html.escape(line)}</tspan>' for i, line in enumerate(lines)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="{c1}"/>
<stop offset="1" stop-color="{c2}"/></linearGradient>
<radialGradient id="r" cx="0.7" cy="0.25" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.25"/>
<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="600" fill="url(#g)"/><rect width="400" height="600" fill="url(#r)"/>
<circle cx="280" cy="170" r="110" fill="none" stroke="#fff" stroke-opacity="0.15" stroke-width="2"/>
<circle cx="280" cy="170" r="70" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="2"/>
<rect x="0" y="430" width="400" height="170" fill="#000" fill-opacity="0.45"/>
<text x="200" y="{470 - (len(lines) - 1) * 26}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
 font-weight="800" font-size="42" fill="#fff" letter-spacing="1">{tspans}</text>
<text x="200" y="572" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15"
 fill="#fca5a5" letter-spacing="3">{html.escape(genre.upper())}</text>
<text x="24" y="40" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="14" fill="#fff"
 fill-opacity="0.8" letter-spacing="4">CINEBOOK PRESENTS</text></svg>"""


def ensure_admin(db) -> None:
    email = settings.admin_email.lower()
    if db.scalar(select(User).where(User.email == email)):
        return
    db.add(User(full_name=settings.admin_name, email=email, password_hash=hash_password(settings.admin_password),
                role=UserRole.ADMIN.value))
    db.commit()
    log.info("Created administrator account %s", email)


def add_showtimes(db, days: int = 7, start_day: date | None = None) -> int:
    tz = ZoneInfo(settings.app_timezone)
    now = datetime.now(tz)
    movies = db.scalars(select(Movie).where(Movie.is_active).order_by(Movie.id)).all()
    screens = db.scalars(select(Screen).where(Screen.is_active).order_by(Screen.id)).all()
    if not movies or not screens:
        return 0
    first = start_day or now.date()
    created = 0
    for d in range(days):
        day = first + timedelta(days=d)
        for s_idx, screen in enumerate(screens):
            std, prem, rec = PRICES.get(screen.screen_type, PRICES["2D"])
            for t_idx, t in enumerate(SHOW_TIMES):
                start = datetime.combine(day, t, tzinfo=tz)
                if start <= now + timedelta(minutes=30):
                    continue
                movie = movies[(s_idx * 3 + t_idx + d) % len(movies)]
                end = start + timedelta(minutes=movie.duration_minutes + settings.showtime_cleanup_minutes)
                clash = db.scalar(select(func.count(Showtime.id)).where(
                    Showtime.screen_id == screen.id, Showtime.is_active,
                    Showtime.start_time < end, Showtime.end_time > start))
                if clash:
                    continue
                db.add(Showtime(movie_id=movie.id, screen_id=screen.id, start_time=start, end_time=end,
                                price_standard=std, price_premium=prem, price_recliner=rec))
                created += 1
    db.commit()
    return created


def seed_sample_data(db) -> None:
    if db.scalar(select(func.count(Movie.id))):
        return
    poster_dir = Path(settings.media_dir) / "posters"
    poster_dir.mkdir(parents=True, exist_ok=True)
    for i, m in enumerate(MOVIES, start=1):
        data = dict(m)
        c1, c2 = data.pop("colors")
        fname = f"seed-{i}.svg"
        (poster_dir / fname).write_text(_poster_svg(data["title"], data["genre"].split(",")[0], c1, c2))
        db.add(Movie(**data, poster_url=f"{settings.media_url_prefix}/posters/{fname}"))
    for t in THEATRES:
        data = dict(t)
        screens = data.pop("screens")
        theatre = Theatre(**data)
        for name, stype in screens:
            per_row, layout = LAYOUTS[stype]
            screen = Screen(name=name, screen_type=stype, seats_per_row=per_row, seat_layout=layout)
            screen.seats = generate_seats(screen)
            theatre.screens.append(screen)
        db.add(theatre)
    db.commit()
    n = add_showtimes(db)
    log.info("Seeded %d movies, %d theatres and %d showtimes", len(MOVIES), len(THEATRES), n)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [seed] %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--showtimes", action="store_true", help="add another week of showtimes")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()
    with SessionLocal() as db:
        ensure_admin(db)
        if args.showtimes:
            log.info("Added %d showtimes", add_showtimes(db, days=args.days))
        elif settings.seed_sample_data:
            seed_sample_data(db)


if __name__ == "__main__":
    main()
