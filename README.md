# BeyondBorders
 Global Education Intelligence Ecosystem

An interactive global education atlas built with Next.js, React, Three.js, FastAPI and SQLite. The published edition includes 13,713 UNESCO UIS and Eurostat observations for 2016–2024. Its study directory includes 10 universities, 25 selected programs, six scholarships and five destination planning guides.

## Run the application

Use Node.js 22 or newer and Python 3.12 or newer. From the repository root:

```sh
npm ci
python -m pip install -r backend/requirements.txt
python -m backend.scripts.export
npm run build
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. The server serves the built atlas and the live database API on one origin. The release download includes the built frontend in `out/`, so the Python install and the uvicorn command are sufficient for that edition. API documentation is at `/docs`.

For frontend development, run `npm run dev`. It uses the committed database export at `public/data/atlas.json`. Set `NEXT_PUBLIC_ATLAS_API` before the frontend build and `ATLAS_ORIGINS` on the API when using separate origins. The application runs without API keys or map tiles. Country boundaries, relief, photographs and fonts are bundled. Credits are linked in Sources & reports.

## Data and imports

`backend/scripts/collect.py` retrieves published UIS indicators and Eurostat field-of-study observations. UIS uses a pinned data release. Eurostat serves its current release. Rebuild the database export with `python -m backend.scripts.export` after a source refresh. Source manifests and raw normalized CSVs live in `backend/seeds`. The database transaction covers validation and import. Seed refreshes replace only the bundled editions and preserve user editions.

The Data import screen accepts CSV files up to 2 MB, previews missing values and duplicate keys, and requires confirmation before insertion. It accepts ISO2/ISO3 or recognized country names, published aggregates and consecutive academic periods. A conflicting duplicate or changed edition definition requires a new edition ID. Imports are labelled User import or DEMO DATA. Imported records appear in reports and compatible bilateral datasets in the atlas. Country, course and forecasting comparisons use their explicitly named official sources.

On static hosts, plans, shortlists and imported editions persist in browser storage. On the FastAPI host set `ATLAS_ADMIN_KEY` to a strong secret for authenticated shared imports. PostgreSQL is selected through `DATABASE_URL`. The default local database is `backend/data/atlas.sqlite`, configurable with `ATLAS_DB`. Serverless and ephemeral hosts serve the bundled edition and require persistent PostgreSQL for shared imports. Browser imports remain available on those hosts.

## Deployment

The Next.js build exports static pages to `out/`. The repository contains Vercel configuration for the frontend and the FastAPI function in `api/index.py`. Vercel serves the frontend and `/api/*` on the same origin. Use a persistent PostgreSQL connection and an administrator key to enable shared writes. The Render blueprint provides a free-tier FastAPI deployment option. Configure the frontend origin in `ATLAS_ORIGINS` when deploying the API separately. No paid integration or AI model is required.

## Verification

```sh
npm test
npm run typecheck
python -m unittest discover -s backend/tests -v
npm run build
```

Install `httpx` for the FastAPI test client. UI tests exercise filters, comparisons, matching, calculators, scholarships, citations, imports and exports. The tests also check forecast periods, actual source values and missing data. The rule-based analyst retrieves records from the same edition the other modules display. Forecasts require at least five consecutive observations and show their training window and prediction intervals.
