"""Export the exact SQLite edition used by the self-contained web frontend."""

import json
from contextlib import closing
from backend.app.store import ROOT, connect, initialize, snapshot


def export():
    initialize()
    with closing(connect()) as db:
        atlas = snapshot(db)
        gl = db.execute(
            "SELECT period,value FROM observations WHERE dataset_id='uis-mobility' AND measure='global' ORDER BY period DESC LIMIT 1"
        ).fetchone()
        year = gl[0]
        inbound = list(
            db.execute(
                "SELECT destination,value FROM observations WHERE dataset_id='uis-mobility' AND measure='inbound' AND period=? AND field='All' AND level='All' ORDER BY value DESC",
                (year,),
            )
        )
        outbound = db.execute(
            "SELECT count(*) FROM observations WHERE dataset_id='uis-outbound' AND measure='outbound' AND period=?",
            (year,),
        ).fetchone()[0]
    data = ROOT / "public" / "data"
    data.mkdir(parents=True, exist_ok=True)
    for name, obj in [
        ("atlas", atlas),
        (
            "summary",
            dict(
                period=year,
                total=gl[1],
                destinations=len(inbound),
                origins=outbound,
                leader=atlas["places"][inbound[0][0]]["name"],
                leading=inbound[0][1],
                source="uis-mobility",
            ),
        ),
    ]:
        target = data / f"{name}.json"
        temp = target.with_suffix(".tmp")
        temp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        temp.replace(target)
    print(
        f"Exported {len(atlas['records']):,} observations from {len(atlas['sources'])} datasets."
    )


if __name__ == "__main__":
    export()
