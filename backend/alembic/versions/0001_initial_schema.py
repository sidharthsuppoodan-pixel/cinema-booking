"""Initial CINEBOOK schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-04
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # ---------------------------------------------------------------- users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="customer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.CheckConstraint("role IN ('admin', 'customer')", name="ck_users_role_valid"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --------------------------------------------------------------- movies
    op.create_table(
        "movies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("genre", sa.String(120), nullable=False),
        sa.Column("language", sa.String(60), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Numeric(3, 1)),
        sa.Column("certificate", sa.String(10)),
        sa.Column("release_date", sa.Date()),
        sa.Column("poster_url", sa.String(500)),
        sa.Column("trailer_url", sa.String(500)),
        sa.Column("cast_members", sa.String(500)),
        sa.Column("director", sa.String(120)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.CheckConstraint(
            "duration_minutes > 0 AND duration_minutes <= 600", name="ck_movies_duration_valid"
        ),
        sa.CheckConstraint(
            "rating IS NULL OR (rating >= 0 AND rating <= 10)", name="ck_movies_rating_valid"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_movies"),
    )
    op.create_index("ix_movies_title", "movies", ["title"])

    # ------------------------------------------------------------- theatres
    op.create_table(
        "theatres",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100)),
        sa.Column("pincode", sa.String(12)),
        sa.Column("contact_phone", sa.String(20)),
        sa.Column("amenities", sa.String(300)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_theatres"),
    )
    op.create_index("ix_theatres_city", "theatres", ["city"])

    # -------------------------------------------------------------- screens
    op.create_table(
        "screens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("theatre_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("screen_type", sa.String(10), nullable=False, server_default="2D"),
        sa.Column("seats_per_row", sa.Integer(), nullable=False),
        sa.Column("seat_layout", postgresql.JSONB(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["theatre_id"], ["theatres.id"], ondelete="CASCADE", name="fk_screens_theatre_id_theatres"
        ),
        sa.UniqueConstraint("theatre_id", "name", name="uq_screens_theatre_name"),
        sa.CheckConstraint("screen_type IN ('2D', '3D', 'IMAX', '4DX')", name="ck_screens_type_valid"),
        sa.CheckConstraint(
            "seats_per_row > 0 AND seats_per_row <= 40", name="ck_screens_seats_per_row_valid"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_screens"),
    )
    op.create_index("ix_screens_theatre_id", "screens", ["theatre_id"])

    # ---------------------------------------------------------------- seats
    op.create_table(
        "seats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("screen_id", sa.Integer(), nullable=False),
        sa.Column("row_label", sa.String(3), nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("seat_number", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["screen_id"], ["screens.id"], ondelete="CASCADE", name="fk_seats_screen_id_screens"
        ),
        sa.UniqueConstraint(
            "screen_id", "row_label", "seat_number", name="uq_seats_screen_row_number"
        ),
        sa.CheckConstraint(
            "category IN ('STANDARD', 'PREMIUM', 'RECLINER')", name="ck_seats_category_valid"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_seats"),
    )
    op.create_index("ix_seats_screen_id", "seats", ["screen_id"])

    # ------------------------------------------------------------ showtimes
    op.create_table(
        "showtimes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("movie_id", sa.Integer(), nullable=False),
        sa.Column("screen_id", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("language", sa.String(60)),
        sa.Column("price_standard", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_premium", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_recliner", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["movie_id"], ["movies.id"], ondelete="CASCADE", name="fk_showtimes_movie_id_movies"
        ),
        sa.ForeignKeyConstraint(
            ["screen_id"], ["screens.id"], ondelete="CASCADE", name="fk_showtimes_screen_id_screens"
        ),
        sa.CheckConstraint("end_time > start_time", name="ck_showtimes_time_order"),
        sa.CheckConstraint(
            "price_standard >= 0 AND price_premium >= 0 AND price_recliner >= 0",
            name="ck_showtimes_prices_non_negative",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_showtimes"),
    )
    op.create_index("ix_showtimes_movie_id", "showtimes", ["movie_id"])
    op.create_index("ix_showtimes_screen_id", "showtimes", ["screen_id"])
    op.create_index("ix_showtimes_start_time", "showtimes", ["start_time"])
    # Two active showtimes can never overlap on the same screen.
    op.execute(
        "ALTER TABLE showtimes ADD CONSTRAINT ex_showtimes_screen_no_overlap "
        "EXCLUDE USING gist (screen_id WITH =, tstzrange(start_time, end_time) WITH &&) "
        "WHERE (is_active)"
    )

    # ------------------------------------------------------------- bookings
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_code", sa.String(16), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("showtime_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="CONFIRMED"),
        sa.Column("seat_count", sa.Integer(), nullable=False),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("convenience_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("cancellation_reason", sa.String(300)),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_bookings_user_id_users"
        ),
        sa.ForeignKeyConstraint(
            ["showtime_id"], ["showtimes.id"], ondelete="RESTRICT", name="fk_bookings_showtime_id_showtimes"
        ),
        sa.CheckConstraint(
            "status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED')", name="ck_bookings_status_valid"
        ),
        sa.CheckConstraint("total_amount >= 0", name="ck_bookings_total_non_negative"),
        sa.PrimaryKeyConstraint("id", name="pk_bookings"),
    )
    op.create_index("ix_bookings_booking_code", "bookings", ["booking_code"], unique=True)
    op.create_index("ix_bookings_user_id", "bookings", ["user_id"])
    op.create_index("ix_bookings_showtime_id", "bookings", ["showtime_id"])

    # -------------------------------------------------------- booking_seats
    op.create_table(
        "booking_seats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("showtime_id", sa.Integer(), nullable=False),
        sa.Column("seat_id", sa.Integer(), nullable=False),
        sa.Column("seat_label", sa.String(8), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], ondelete="CASCADE", name="fk_booking_seats_booking_id_bookings"
        ),
        sa.ForeignKeyConstraint(
            ["showtime_id"], ["showtimes.id"], ondelete="RESTRICT", name="fk_booking_seats_showtime_id_showtimes"
        ),
        sa.ForeignKeyConstraint(
            ["seat_id"], ["seats.id"], ondelete="RESTRICT", name="fk_booking_seats_seat_id_seats"
        ),
        sa.CheckConstraint("price >= 0", name="ck_booking_seats_price_non_negative"),
        sa.PrimaryKeyConstraint("id", name="pk_booking_seats"),
    )
    op.create_index("ix_booking_seats_booking_id", "booking_seats", ["booking_id"])
    # A seat can be held by only ONE active booking per showtime.
    op.create_index(
        "uq_booking_seats_active_showtime_seat",
        "booking_seats",
        ["showtime_id", "seat_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    # ------------------------------------------------------------- payments
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("refund_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("transaction_ref", sa.String(40), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], ondelete="CASCADE", name="fk_payments_booking_id_bookings"
        ),
        sa.UniqueConstraint("booking_id", name="uq_payments_booking_id"),
        sa.UniqueConstraint("transaction_ref", name="uq_payments_transaction_ref"),
        sa.CheckConstraint(
            "status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')",
            name="ck_payments_status_valid",
        ),
        sa.CheckConstraint(
            "method IN ('CARD', 'UPI', 'NET_BANKING', 'WALLET', 'CASH')", name="ck_payments_method_valid"
        ),
        sa.CheckConstraint(
            "amount >= 0 AND refund_amount >= 0", name="ck_payments_amounts_non_negative"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_payments"),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_index("uq_booking_seats_active_showtime_seat", table_name="booking_seats")
    op.drop_table("booking_seats")
    op.drop_table("bookings")
    op.drop_table("showtimes")
    op.drop_table("seats")
    op.drop_table("screens")
    op.drop_table("theatres")
    op.drop_table("movies")
    op.drop_table("users")
