"""Exercise every exported route and its local references through the real API host."""
import re
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from unittest.mock import patch
from os import environ
from zipfile import ZipFile
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.store import ROOT
ROUTES="explore countries courses universities planner costs scholarships visa shortlist intelligence forecast network reports import".split()

@unittest.skipUnless((ROOT/"out/index.html").exists(),"Requires production frontend build")
class TestRelease(unittest.TestCase):
    def test_every_page_asset_and_portable_archive(self):
        with tempfile.TemporaryDirectory() as tmp,patch.dict(environ,{"ATLAS_DB":str(Path(tmp)/"qa.sqlite")}),TestClient(app) as c:
            assets=set()
            for route in ["/",*[f"/{s}/" for s in ROUTES]]:
                with self.subTest(route=route):
                    r=c.get(route)
                    self.assertEqual(r.status_code,200)
                    self.assertIn('id="main"',r.text)
                    assets.update(urlsplit(s).path for s in re.findall(r'(?:href|src)="(/[^"]+)"',r.text))
            for path in sorted(assets):
                with self.subTest(asset=path):
                    self.assertEqual(c.get(path).status_code,200)
            self.assertIn("location.origin",c.get("/atlas-runtime.js").text)
            self.assertEqual(c.get("/api/observations",params={"dataset_id":"uis-mobility","origin":"IND","destination":"CAN","period":"2024"}).json()[0]["value"],189018)
            self.assertEqual(c.get("/unknown-edition/").status_code,404)
        with ZipFile(ROOT/"out/downloads/beyond-borders.zip") as release:
            self.assertIsNone(release.testzip())
            self.assertIn("beyond-borders/backend/app/main.py",release.namelist())
            self.assertIn("beyond-borders/out/planner/index.html",release.namelist())
            self.assertFalse(any("/.git/" in n or "/node_modules/" in n for n in release.namelist()))
