import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import engine
from app.routes import admin, auth, bookings, movies, screens, showtimes, theatres

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("cinebook")

app = FastAPI(
    title="CINEBOOK API",
    version="1.0.0",
    description="Cinema booking & management REST API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = []
    for e in exc.errors():
        loc = ".".join(str(p) for p in e.get("loc", []) if p not in ("body", "query", "path"))
        msg = e.get("msg", "Invalid value").removeprefix("Value error, ")
        errors.append(f"{loc}: {msg}" if loc else msg)
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(errors) or "Invalid request", "errors": jsonable_encoder(exc.errors())},
    )


@app.exception_handler(IntegrityError)
async def integrity_handler(request: Request, exc: IntegrityError):
    msg = str(exc.orig) if exc.orig else str(exc)
    log.warning("Integrity error on %s %s: %s", request.method, request.url.path, msg.splitlines()[0])
    if "ex_showtimes_screen_no_overlap" in msg:
        detail = "This showtime overlaps another show on the same screen."
    elif "uq_booking_seats_active_showtime_seat" in msg:
        detail = "One or more seats are already booked for this show."
    elif "violates foreign key constraint" in msg:
        detail = (
            "This record is referenced by existing bookings and cannot be deleted. "
            "Deactivate it instead, or cancel/remove the related bookings first."
        )
    elif "duplicate key" in msg or "unique" in msg.lower():
        detail = "A record with the same unique value already exists."
    else:
        detail = "The request conflicts with existing data."
    return JSONResponse(status_code=409, content={"detail": detail})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred."})


for r in (auth, movies, theatres, screens, showtimes, bookings, admin):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health", tags=["Health"])
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


@app.on_event("startup")
def ensure_media_dir() -> None:
    Path(settings.media_dir, "posters").mkdir(parents=True, exist_ok=True)
