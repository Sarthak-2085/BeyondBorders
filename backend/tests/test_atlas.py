import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.store import period, read_rows


class TestAtlas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.config = patch.dict(
            os.environ,
            {
                "ATLAS_DB": str(Path(cls.tmp.name) / "test.sqlite"),
                "ATLAS_ADMIN_KEY": "unit-test-key",
            },
        )
        cls.config.start()
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        cls.config.stop()
        cls.tmp.cleanup()

    def test_reference_and_sources(self):
        data = self.client.get("/api/atlas").json()
        self.assertEqual(len(data["records"]), 13713)
        self.assertEqual(len(self.client.get("/api/sources").json()), 3)
        response = self.client.get(
            "/api/observations",
            params=dict(
                dataset_id="uis-mobility",
                origin="IND",
                destination="DEU",
                measure="bilateral",
                period="2024",
            ),
        )
        self.assertEqual(response.json()[0]["value"], 49243)
        self.assertEqual(
            self.client.get(
                "/api/observations", params={"dataset_id": "uis-mobility", "limit": 0}
            ).status_code,
            422,
        )
        self.assertEqual(self.client.get("/api/health").json()["status"], "ok")

    def test_transactional_preview_and_retry(self):
        source = dict(
            id="user-unit",
            publisher="Fixture",
            name="Import test",
            url="https://example.org/fixture",
            period="2023/24",
            retrieved="2026-11-22",
            coverage="Test only",
            definition="Fixture",
            dimensions=["origin", "destination"],
            classification="DEMO DATA",
        )
        header = "origin,destination,period,measure,level,field,value\n"
        body = {
            "csv_text": header
            + "IN,DE,2023/24,bilateral,Master,ict,5\nIN,UK,2023/24,bilateral,Master,ict,:",
            "source": source,
            "preview": True,
        }

        def send():
            return self.client.post(
                "/api/import",
                json=body,
                headers={"Authorization": "Bearer unit-test-key"},
            )

        self.assertEqual(self.client.post("/api/import", json=body).status_code, 403)
        self.assertEqual(send().json()["added"], 1)
        self.assertEqual(send().json()["missing"], 1)

        def rows():
            return self.client.get(
                "/api/observations", params={"dataset_id": "user-unit"}
            ).json()

        self.assertFalse(rows())
        body["preview"] = False
        self.assertEqual(send().json()["added"], 1)
        self.assertEqual(send().json()["added"], 0)
        self.assertEqual(rows()[0]["period"], "2023/2024")
        self.assertEqual(rows()[0]["field"], "Computer Science")
        body["csv_text"] = (
            header
            + "IN,US,2023,bilateral,All,All,3\nIN,DE,2023/24,bilateral,Master,ict,6"
        )
        self.assertEqual(send().status_code, 422)
        self.assertEqual(len(rows()), 1)
        body["source"]["id"] = "uis-mobility"
        self.assertEqual(send().status_code, 422)

    def test_invalid_records_and_periods(self):
        for row in [
            "ABC,DE,2023,bilateral,All,All,1",
            "IN,DE,2023,bilateral,All,All,-1",
            "IN,IN,2023,bilateral,All,All,1",
            "IN,DE,2023,bilateral,Unknown,All,3",
            "WLD,DEU,2023,outbound,All,All,3",
        ]:
            with self.subTest(row=row), self.assertRaises(ValueError):
                read_rows(
                    "origin,destination,period,measure,level,field,value\n" + row, "qa"
                )
        self.assertEqual(period("2023–24"), "2023/2024")
        with self.assertRaises(ValueError):
            period("2023/26")

    def test_every_plan_source_and_exchange(self):
        p = self.client.get("/api/atlas").json()["planning"]
        self.assertEqual(len(p["universities"]), 10)
        for u in p["universities"]:
            self.assertTrue(u["source"].startswith("https://"))
            self.assertTrue(u["programs"])
            self.assertTrue(all(x["url"].startswith("https://") for x in u["programs"]))
        for c in p["countries"]:
            self.assertGreater(p["exchange"]["rates"][c["cost"]["currency"]], 0)
            self.assertTrue(c["visa"]["verified"])
