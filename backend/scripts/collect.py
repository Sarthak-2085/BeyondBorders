"""Refresh the atlas's published education statistics using official free APIs.

Run with Python 3.10+ from any directory. Missing values stay absent. For a
reproducible edition, use the UNESCO release pinned below. Eurostat's API
serves its current vintage, so preserving the output commit matters.
"""

from __future__ import annotations

import csv
import itertools
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

SEEDS = Path(__file__).resolve().parents[1] / "seeds"
CSV_KEYS = "dataset_id origin destination period measure level field value".split()
START, END = 2016, 2024
UIS_VERSION = "20261110-392b682a"
UIS_URL = "https://api.uis.unesco.org/api/public/data/indicators"
EU_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/educ_uoe_mobs01"
INBOUND, OUTBOUND = "26637", "OE.5T8.40510"
ORIGINS = dict(
    zip(
        "26442 26445 26454 26458 26483 26494 26503 26508 26524 26528 26533 26534 26538 26542 26548 26552 26554 26564 26568 26584 26585 26590 26591 26599 26608 26613 26617".split(),
        "GHA KEN MAR NGA CAN MEX USA BRA BGD CHN IND IDN JPN KOR MYS NPL PAK TUR VNM FRA DEU IRL ITA NLD ESP GBR AUS".split(),
    )
)
# Curate a tractable set of corridors while keeping worldwide national totals.
DESTINATIONS = set(ORIGINS.values()) | set(
    "AUT NZL CHE PRT SWE BEL FIN DNK POL SGP ARE ZAF".split()
)
EU_COUNTRIES = dict(
    zip(
        "AT BE DE DK ES FI FR IE IT NL PL PT SE".split(),
        "AUT BEL DEU DNK ESP FIN FRA IRL ITA NLD POL PRT SWE".split(),
    )
)
LEVELS = {
    "ED5-8": "All",
    "ED5": "Short-cycle",
    "ED6": "Bachelor's",
    "ED7": "Master's",
    "ED8": "Doctorate",
}
FIELDS = {
    "F06": ("Computer Science", "Information and communication technologies"),
    "F041": ("Business and Management", "Business and administration"),
    "F071": ("Engineering", "Engineering and engineering trades"),
    "F091": ("Medicine and Healthcare", "Health"),
    "F03": ("Social Sciences", "Social sciences, journalism and information"),
    "F02": ("Arts and Humanities", "Arts and humanities"),
    "F05": ("Natural Sciences", "Natural sciences, mathematics and statistics"),
    "F042": ("Law", "Law"),
}


def query(url, params):
    return url + "?" + urllib.parse.urlencode(params, doseq=True)


def fetch(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return json.load(response, parse_float=Decimal)


def whole_people(value):
    return int(Decimal(value).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def get_uis(code):
    url = query(
        UIS_URL,
        {
            "indicator": code,
            "version": UIS_VERSION,
            "start": START,
            "end": END,
            "footnotes": "true",
        },
    )
    result = fetch(url)
    records = result["records"]
    if not records:
        raise ValueError(
            f"No UIS records for {code}; check the pinned release and API."
        )
    output = []
    for row in records:
        country, value = row["geoUnit"], row.get("value")
        if value is None or value < 0 or row.get("magnitude") not in (None, "", 1):
            continue
        if row["indicatorId"] != code or not START <= row["year"] <= END:
            raise ValueError(
                "UIS returned an unexpected indicator or reference period."
            )
        if code == INBOUND and country == "UIS: World":
            origin, dest, measure, dataset = "WLD", "WLD", "global", "uis-mobility"
        elif not re.fullmatch(r"[A-Z]{3}", country) or country in {
            "ANT",
            "XKX",
            "SCG",
            "YUG",
            "SUN",
            "CSK",
            "ZAN",
            "PSE_OLD",
        }:
            continue
        elif code == INBOUND:
            origin, dest, measure, dataset = "WLD", country, "inbound", "uis-mobility"
        elif code == OUTBOUND:
            origin, dest, measure, dataset = country, "WLD", "outbound", "uis-outbound"
        elif country in DESTINATIONS and country != ORIGINS[code]:
            origin, dest, measure, dataset = (
                ORIGINS[code],
                country,
                "bilateral",
                "uis-mobility",
            )
        else:
            continue
        output.append(
            (
                dataset,
                origin,
                dest,
                row["year"],
                measure,
                "All",
                "All",
                whole_people(value),
            )
        )
    return output


def get_fields(geo):
    url = query(
        EU_URL,
        {
            "lang": "en",
            "geo": geo,
            "unit": "NR",
            "sex": "T",
            "freq": "A",
            "sinceTimePeriod": START,
            "untilTimePeriod": END,
            "iscedf13": list(FIELDS),
        },
    )
    result = fetch(url)
    dims = result["id"]
    keys = []
    for dim in dims:
        index = result["dimension"][dim]["category"]["index"]
        keys.append([k for k, _ in sorted(index.items(), key=lambda kv: kv[1])])
    output = []
    for position, values in enumerate(itertools.product(*keys)):
        val = result["value"].get(str(position))
        entry = dict(zip(dims, values))
        if val is None or val < 0 or entry["isced11"] not in LEVELS:
            continue
        if (
            val != int(val)
            or entry["sex"] != "T"
            or entry["unit"] != "NR"
            or entry["geo"] != geo
        ):
            raise ValueError("Unexpected Eurostat record.")
        output.append(
            (
                "eurostat-fields",
                "WLD",
                EU_COUNTRIES[geo],
                int(entry["time"]),
                "inbound",
                LEVELS[entry["isced11"]],
                FIELDS[entry["iscedf13"]][0],
                int(val),
            )
        )
    return output


def build_sources(rows):
    stamp = date.today().isoformat()
    base = {
        "publisher": "UNESCO Institute for Statistics",
        "retrieved": stamp,
        "release": UIS_VERSION,
        "period": f"{START}–{END}",
        "dimensions": ["origin", "destination", "reference year"],
        "coverage": "Published national totals worldwide, one published world total, and selected bilateral corridors.",
    }
    evidence = {
        "id": "uis-mobility",
        **base,
        "name": "Internationally mobile tertiary students · inbound and bilateral",
        "url": query(
            UIS_URL,
            {
                "indicator": INBOUND,
                "geoUnit": "UIS: World",
                "start": START,
                "end": END,
                "version": UIS_VERSION,
                "indicatorMetadata": "true",
            },
        ),
        "definition": "Students who crossed an international border to study. Origin follows prior education, with residence or citizenship used where necessary. Counts describe enrolment in each reference year. The worldwide value is published by UIS. Some published values contain fractions and are rounded to the nearest student. Available bilateral corridors are a subset. Missing observations are omitted.",
        "indicator_codes": {
            "inbound_and_world": INBOUND,
            "bilateral_by_origin": {v: k for k, v in ORIGINS.items()},
        },
        "api": UIS_URL,
    }
    outbound = {
        **base,
        "id": "uis-outbound",
        "name": "Outbound internationally mobile tertiary students · UIS estimates",
        "url": query(
            UIS_URL,
            {
                "indicator": OUTBOUND,
                "geoUnit": "IND",
                "start": START,
                "end": END,
                "version": UIS_VERSION,
                "indicatorMetadata": "true",
            },
        ),
        "coverage": "Countries and territories with a published outbound estimate.",
        "definition": "UIS estimates of tertiary students from the reporting country studying abroad in all destinations. Published fractional values are rounded to the nearest student. These are publisher estimates. No missing observation is filled.",
        "indicator_codes": {"outbound": OUTBOUND},
        "api": UIS_URL,
    }
    eu = {
        "id": "eurostat-fields",
        "publisher": "Eurostat",
        "name": "Mobile students from abroad enrolled by education level, sex and field of education",
        "url": "https://doi.org/10.2908/EDUC_UOE_MOBS01",
        "api": EU_URL,
        "retrieved": stamp,
        "period": f"{START}–{END}",
        "dimensions": ["destination", "reference year", "ISCED level", "ISCED-F field"],
        "coverage": "Selected European destinations. All origins and sexes combined.",
        "definition": "Enrolled mobile students from abroad. Atlas disciplines group published ISCED-F categories: Computer Science uses ICT, Engineering uses engineering and engineering trades, and Medicine and Healthcare uses health. Counts refer to the published categories, which can include adjacent subjects. The all-level total covers ISCED 5–8. Degree-specific rows are disaggregations of that total. The selected fields do not cover the entire curriculum. Publisher estimates, provisional values, and breaks in series can occur; consult the linked dataset flags before comparison.",
        "field_mapping": {
            name: {"code": key, "published": label}
            for key, (name, label) in FIELDS.items()
        },
        "level_mapping": LEVELS,
    }
    sources = [evidence, outbound, eu]
    for src in sources:
        subset = [r for r in rows if r[0] == src["id"]]
        src["period"] = f"{min(r[3] for r in subset)}–{max(r[3] for r in subset)}"
    return sources


def main():
    with ThreadPoolExecutor(max_workers=6) as pool:
        uis = list(
            itertools.chain.from_iterable(
                pool.map(get_uis, [INBOUND, OUTBOUND, *ORIGINS])
            )
        )
        eu = list(itertools.chain.from_iterable(pool.map(get_fields, EU_COUNTRIES)))
    rows = sorted([*uis, *eu])
    keys = {r[:-1] for r in rows}
    if len(keys) != len(rows):
        raise ValueError("Duplicate observations in the source response.")
    if not any(r[4] == "global" for r in rows) or not any(
        r[1:3] == ("IND", "USA") for r in rows
    ):
        raise ValueError("Missing global or India–USA series.")
    sources = build_sources(rows)
    SEEDS.mkdir(parents=True, exist_ok=True)
    out = SEEDS / "observations.csv"
    with out.with_suffix(".tmp").open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(CSV_KEYS)
        writer.writerows(rows)
    out.with_suffix(".tmp").replace(out)
    out = SEEDS / "sources.json"
    out.with_suffix(".tmp").write_text(
        json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    out.with_suffix(".tmp").replace(out)
    print(f"Wrote {len(rows):,} official observations across {len(sources)} datasets.")


if __name__ == "__main__":
    main()
