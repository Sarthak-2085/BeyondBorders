"""Optional shared API for hosted or local atlas clients."""

import hmac
import json
import os
from contextlib import asynccontextmanager, closing
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .database import lock_writer
from .store import (
    COLUMNS,
    SEED_IDS,
    connect,
    initialize,
    insert_dataset,
    read_rows,
    snapshot,
    validate_source,
)


@asynccontextmanager
async def lifespan(app):
    initialize()
    yield


app = FastAPI(title="Beyond Borders education atlas", version="2.0", lifespan=lifespan)
origins = os.environ.get(
    "ATLAS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/atlas")
def atlas():
    with closing(connect()) as db:
        return snapshot(db)


@app.get("/api/sources")
def sources():
    with closing(connect()) as db:
        return [
            json.loads(r[0])
            for r in db.execute("SELECT metadata FROM datasets ORDER BY id")
        ]


@app.get("/api/observations")
def observations(
    dataset_id: str,
    origin: str | None = None,
    destination: str | None = None,
    period: str | None = None,
    measure: str | None = None,
    level: str | None = None,
    field: str | None = None,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    params = {
        key: value
        for key, value in locals().items()
        if value is not None and key not in ("limit", "offset")
    }
    query = "SELECT * FROM observations WHERE " + " AND ".join(
        f"{key}=?" for key in params
    )
    with closing(connect()) as db:
        return [
            dict(zip(COLUMNS, r))
            for r in db.execute(
                query
                + " ORDER BY period,origin,destination,level,field LIMIT ? OFFSET ?",
                [*params.values(), limit, offset],
            )
        ]


class ImportRequest(BaseModel):
    source: dict
    csv_text: str = Field(max_length=2_000_000)
    preview: bool = True


@app.post("/api/import")
def import_csv(payload: ImportRequest, authorization: str = Header("")):
    if (os.environ.get("VERCEL") or os.environ.get("RENDER")) and not os.environ.get(
        "DATABASE_URL"
    ):
        raise HTTPException(
            503,
            "Shared imports require a persistent database. Use a device edition or configure PostgreSQL.",
        )
    key = os.environ.get("ATLAS_ADMIN_KEY")
    if not key or not hmac.compare_digest(authorization, "Bearer " + key):
        raise HTTPException(403, "A configured administrator key is required.")
    try:
        source = validate_source(payload.source)
        if source["id"] in SEED_IDS:
            raise ValueError("Published editions have reserved IDs.")
        rows, missing, dupes = read_rows(payload.csv_text, source["id"])
        with closing(connect()) as db, db:
            lock_writer(db)
            added = insert_dataset(db, source, rows)
            if payload.preview:
                db.rollback()
            return {
                "rows": len(rows),
                "missing": missing,
                "duplicates": dupes + len(rows) - added,
                "added": added,
                "preview": payload.preview,
            }
    except (TypeError, ValueError) as exc:
        raise HTTPException(422, str(exc)) from exc


# The same production export runs on any ordinary FastAPI host.
from pathlib import Path
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from .store import ROOT


@app.get("/atlas-runtime.js")
def runtime():
    return Response(
        "window.__BB_API__=location.origin;",
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


if (ROOT / "out" / "index.html").is_file():
    app.mount("/", StaticFiles(directory=ROOT / "out", html=True), name="frontend")
