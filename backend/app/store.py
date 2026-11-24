"""Validated, transactional storage for distinct education data series."""

import csv
import hashlib
import io
import json
import os
import re
from .database import connect, lock_writer, Postgres
from contextlib import closing
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
SEEDS = ROOT / "backend" / "seeds"
COLUMNS = "dataset_id origin destination period measure level field value".split()
COUNTRIES = json.loads((SEEDS / "countries.json").read_text())
COUNTRY_CODES = {
    name.casefold(): code
    for code, item in COUNTRIES.items()
    for name in (code, item["name"], item["iso2"])
    if name
}
COUNTRY_CODES.update(
    {"uk": "GBR", "united states of america": "USA", "all countries": "WLD"}
)
FIELDS = [
    "All",
    "Computer Science",
    "Business and Management",
    "Engineering",
    "Medicine and Healthcare",
    "Social Sciences",
    "Arts and Humanities",
    "Natural Sciences",
    "Law",
]
LEVELS = ["All", "Short-cycle", "Bachelor's", "Master's", "Doctorate"]
ALIASES = {
    "ict": "Computer Science",
    "business and administration": "Business and Management",
    "engineering and engineering trades": "Engineering",
    "health": "Medicine and Healthcare",
}
FIELD_MAP = {s.casefold(): s for s in FIELDS} | ALIASES
LEVEL_MAP = {s.casefold(): s for s in LEVELS} | {
    "bachelor": "Bachelor's",
    "master": "Master's",
    "phd": "Doctorate",
}
SEED_IDS = {s["id"] for s in json.loads((SEEDS / "sources.json").read_text())}
SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS observations(
 dataset_id TEXT NOT NULL REFERENCES datasets(id), origin TEXT NOT NULL, destination TEXT NOT NULL,
 period TEXT NOT NULL, measure TEXT NOT NULL, level TEXT NOT NULL, field TEXT NOT NULL,
 value BIGINT NOT NULL CHECK(value>=0),
 PRIMARY KEY(dataset_id,origin,destination,period,measure,level,field));
CREATE INDEX IF NOT EXISTS observations_series ON observations(dataset_id,measure,destination,period);
CREATE TABLE IF NOT EXISTS editions(version TEXT PRIMARY KEY);
"""


def period(raw):
    match = re.fullmatch(r"(\d{4})(?:[-/–](\d{4}|\d{2}))?", raw.strip())
    if not match:
        raise ValueError("Use YYYY or a consecutive academic year such as 2022/23.")
    start, end = match.groups()
    if not 1900 <= int(start) <= 2100:
        raise ValueError("Reference year is outside the supported range.")
    if not end:
        return start
    if end not in (str(int(start) + 1), str(int(start) + 1)[-2:]):
        raise ValueError("Academic years must be consecutive.")
    return f"{start}/{int(start) + 1}"


def validate_source(source):
    for k in "id publisher name url period retrieved coverage definition".split():
        if not isinstance(source.get(k), str) or not source[k].strip():
            raise ValueError(f"Source requires {k}.")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,60}", source["id"]):
        raise ValueError("Use a lowercase dataset ID.")
    url = urlsplit(source["url"])
    if url.scheme not in ("https", "http") or not url.netloc:
        raise ValueError("A public source URL is required.")
    date.fromisoformat(source["retrieved"])
    if not isinstance(source.get("dimensions"), list) or not source["dimensions"]:
        raise ValueError("Declare the available dimensions.")
    return source


def normalize(row, source_id):
    if row.get("dataset_id", source_id).strip() not in ("", source_id):
        raise ValueError("Dataset ID does not match its provenance.")
    codes = [
        COUNTRY_CODES.get(row[key].strip().casefold())
        for key in ("origin", "destination")
    ]
    if None in codes:
        raise ValueError("Unknown origin or destination country.")
    measure = row["measure"].strip().lower()
    required = {
        "bilateral": (False, False),
        "inbound": (True, False),
        "outbound": (False, True),
        "global": (True, True),
    }
    if measure not in required or tuple(x == "WLD" for x in codes) != required[measure]:
        raise ValueError("Geography does not match the measure.")
    if measure == "bilateral" and codes[0] == codes[1]:
        raise ValueError("A bilateral corridor requires distinct countries.")
    level = LEVEL_MAP.get(row["level"].strip().casefold())
    field = FIELD_MAP.get(row["field"].strip().casefold())
    if not field or not level:
        raise ValueError(
            "Unknown field or study level. Use All for a published aggregate."
        )
    ref = period(row["period"])
    raw = row["value"].strip()
    if raw.casefold() in ("", "na", "n/a", "..", ":"):
        return None
    if not re.fullmatch(r"\d+", raw) or int(raw) > 9007199254740991:
        raise ValueError("Count must be a nonnegative whole number.")
    return (source_id, *codes, ref, measure, level, field, int(raw))


def read_rows(content, source_id):
    reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")))
    if not reader.fieldnames or not set(COLUMNS[1:]) <= set(reader.fieldnames):
        raise ValueError("CSV header must contain " + ", ".join(COLUMNS[1:]))
    seen = {}
    missing = duplicates = 0
    for n, row in enumerate(reader, 2):
        try:
            record = normalize(row, source_id)
            if record is None:
                missing += 1
                continue
            key = record[:-1]
            if key in seen:
                if seen[key] != record[-1]:
                    raise ValueError("Conflicting counts for one observation.")
                duplicates += 1
            seen[key] = record[-1]
        except (ValueError, KeyError, AttributeError) as exc:
            raise ValueError(f"Row {n}: {exc}") from exc
    if not seen:
        raise ValueError("The CSV contains no observations.")
    return [(*key, v) for key, v in seen.items()], missing, duplicates


def insert_dataset(db, source, rows):
    validate_source(source)
    encoded = json.dumps(source, sort_keys=True)
    existing = db.execute(
        "SELECT metadata FROM datasets WHERE id=?", (source["id"],)
    ).fetchone()
    if existing and existing[0] != encoded:
        raise ValueError(
            "This dataset ID already has different provenance. Use a new edition ID."
        )
    if not existing:
        db.execute("INSERT INTO datasets VALUES(?,?)", (source["id"], encoded))
    stored = {
        tuple(r[:-1]): r[-1]
        for r in db.execute(
            "SELECT * FROM observations WHERE dataset_id=?", (source["id"],)
        )
    }
    fresh = []
    for row in rows:
        key = tuple(row[:-1])
        if key in stored:
            if stored[key] != row[-1]:
                raise ValueError(
                    "A stored count differs. Import a new edition to preserve provenance."
                )
        else:
            fresh.append(row)
            stored[key] = row[-1]
    db.executemany("INSERT INTO observations VALUES(?,?,?,?,?,?,?,?)", fresh)
    return len(fresh)


def initialize():
    with closing(connect()) as db:
        if not isinstance(db, Postgres):
            db.executescript(SCHEMA)
        with db:
            lock_writer(db)
            if isinstance(db, Postgres):
                db.executescript(SCHEMA)
            edition = hashlib.sha256(
                (SEEDS / "observations.csv").read_bytes()
                + (SEEDS / "sources.json").read_bytes()
            ).hexdigest()
            if db.execute(
                "SELECT 1 FROM editions WHERE version=?", (edition,)
            ).fetchone():
                return
            for ident in SEED_IDS:
                db.execute("DELETE FROM observations WHERE dataset_id=?", (ident,))
                db.execute("DELETE FROM datasets WHERE id=?", (ident,))
            sources = json.loads((SEEDS / "sources.json").read_text())
            by_id = {s["id"]: [] for s in sources}
            with (SEEDS / "observations.csv").open() as file:
                for row in csv.DictReader(file):
                    by_id[row["dataset_id"]].append(normalize(row, row["dataset_id"]))
            for s in sources:
                insert_dataset(db, s, by_id[s["id"]])
            db.execute("DELETE FROM editions")
            db.execute("INSERT INTO editions VALUES(?)", (edition,))


def snapshot(db):
    return {
        "sources": [
            json.loads(row[0])
            for row in db.execute("SELECT metadata FROM datasets ORDER BY id")
        ],
        "columns": COLUMNS,
        "records": [
            list(row)
            for row in db.execute(
                "SELECT * FROM observations ORDER BY dataset_id,period,origin,destination,level,field"
            )
        ],
        "places": COUNTRIES,
        "planning": json.loads((SEEDS / "planning.json").read_text()),
    }
