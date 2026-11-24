"""Create a portable, source-inclusive release from the production export."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
bundle = OUT / "downloads" / "beyond-borders.zip"
bundle.parent.mkdir(parents=True, exist_ok=True)
roots = [
    "app",
    "api",
    "components",
    "lib",
    "public",
    "backend",
    "scripts",
    "tests",
    "out",
]
config = [
    "README.md",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next-env.d.ts",
    "next.config.mjs",
    "postcss.config.mjs",
    "vitest.config.ts",
    "vitest.config.mts",
    "requirements.txt",
    "render.yaml",
    "vercel.json",
    ".env.example",
    ".gitignore",
]
with ZipFile(bundle, "w", ZIP_DEFLATED, compresslevel=5) as z:
    for file in [
        *(ROOT / f for f in config),
        *(p for d in roots for p in (ROOT / d).rglob("*")),
    ]:
        rel = file.relative_to(ROOT)
        if (
            not file.is_file()
            or (rel.parts[:2] == ("backend", "data"))
            or ("downloads" in rel.parts)
            or "__pycache__" in rel.parts
            or file.suffix == ".pyc"
        ):
            continue
        z.write(file, "beyond-borders/" + str(rel))
print(f"Portable release: {bundle.stat().st_size:,} bytes")
