"""Open the configured persistent PostgreSQL database or a local SQLite file."""

import os
import sqlite3
from pathlib import Path


class Postgres:
    def __init__(self, dsn):
        import psycopg

        self.connection = psycopg.connect(dsn, connect_timeout=15)

    def execute(self, sql, params=()):
        return self.connection.execute(sql.replace("?", "%s"), params)

    def executemany(self, sql, rows):
        with self.connection.cursor() as cursor:
            cursor.executemany(sql.replace("?", "%s"), rows)

    def executescript(self, script):
        for sql in script.split(";"):
            if sql.strip():
                self.execute(sql)

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()

    def __enter__(self):
        return self

    def __exit__(self, kind, value, trace):
        if kind:
            self.connection.rollback()
        else:
            self.connection.commit()


def connect():
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return Postgres(dsn)
    default = (
        "/tmp/bb-atlas.sqlite"
        if os.environ.get("VERCEL")
        else Path(__file__).resolve().parents[1] / "data" / "atlas.sqlite"
    )
    path = Path(os.environ.get("ATLAS_DB", default))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    return db


def lock_writer(db):
    if isinstance(db, Postgres):
        db.execute("SELECT pg_advisory_xact_lock(827391146)")
    else:
        db.execute("BEGIN IMMEDIATE")
