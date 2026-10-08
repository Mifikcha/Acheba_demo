"""Check that the demo contains only selected notes and has no broken local links."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import json

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "Публичный сайт"
PUBLIC = ROOT / "public"
BASE = "https://mifikcha.github.io/Acheba_demo/"
EXISTING = {
    "index.md",
    "statistics.md",
    "Информатика/index.md",
    "Математика/index.md",
    "Физика/index.md",
}
NOTES = set(json.loads((ROOT / "scripts/demo_manifest.json").read_text(encoding="utf-8"))["notes"])
EXPECTED = EXISTING | NOTES
assert "Физика/_Теория/Механика/Движение по окружности.md" in NOTES
assert "Информатика/_Разборы задач/№16 Простая рекурсия.md" in NOTES
assert not any("№21 Качественная задача" in note or "Звезды" in note for note in NOTES)
assert all("/№ 19 Параметр/" in note for note in NOTES if note.startswith("Математика/_Разборы задач/"))
assert all("/Теория/04 Функции/" in note for note in NOTES if note.startswith("Математика/Теория/"))
assert all(any(f"/Истинный фундамент/{chapter}" in note for chapter in ("02 ", "03 ", "04 ")) for note in NOTES if note.startswith("Информатика/Истинный фундамент/"))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        self.values.extend(value for name, value in attrs if name in {"href", "src"} and value)


actual = {path.relative_to(CONTENT).as_posix() for path in CONTENT.rglob("*.md")}
assert actual == EXPECTED, f"Unexpected Markdown set: {actual ^ EXPECTED}"
for subject in ("Информатика", "Математика", "Физика"):
    assert "Все заметки" not in (CONTENT / subject / "index.md").read_text(encoding="utf-8")
circle = (CONTENT / "Физика/_Теория/Механика/Движение по окружности.md").read_text(encoding="utf-8")
assert circle.index("### Скорость и ускорения при движении по окружности") < circle.index('class="circle-animation"')
assert "В демо недоступно" in circle
index = json.loads((PUBLIC / "static/contentIndex.json").read_text(encoding="utf-8"))
assert EXPECTED <= {item["filePath"] for item in index.values()}
home = (PUBLIC / "index.html").read_text(encoding="utf-8")
for subject in ("Физики", "Математики", "Информатики"):
    assert f"Демонстрационный модуль {subject}" in home
assert not (PUBLIC / "CNAME").exists()
assert {"pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json", "LICENSE"} <= {
    path.name for path in (PUBLIC / "static/pyodide").iterdir() if path.is_file()
}
for item in index.values():
    for slug in item.get("links", []):
        relative = slug.strip("/")
        assert any(path.is_file() for path in (PUBLIC / f"{relative}.html", PUBLIC / relative / "index.html")), f"Broken graph link: {slug}"

checked = 0
broken = []
for page in PUBLIC.rglob("*.html"):
    html = page.read_text(encoding="utf-8")
    assert "katex-error" not in html, f"Broken formula: {page}"
    assert "note-cheatsheet" not in html and "Шпора" not in html, f"Cheat sheet remains: {page}"
    assert "впадлу" not in html, f"Colloquial draft remains: {page}"
    assert "hopes-and-dreams.fifikcha.workers.dev" not in html, f"Original HnD link remains: {page}"
    links = Links()
    links.feed(html)
    page_url = urljoin(BASE, page.relative_to(PUBLIC).as_posix())
    for value in links.values:
        target = urlparse(urljoin(page_url, value))
        if target.netloc != "mifikcha.github.io":
            continue
        assert target.path == "/Acheba_demo" or target.path.startswith("/Acheba_demo/"), f"Escaped base path: {page}: {value}"
        relative = unquote(target.path.removeprefix("/Acheba_demo/") if target.path != "/Acheba_demo" else "")
        candidates = [PUBLIC / relative, PUBLIC / f"{relative}.html", PUBLIC / relative / "index.html"]
        if not any(candidate.is_file() for candidate in candidates):
            broken.append((page.relative_to(PUBLIC).as_posix(), value))
        checked += 1

assert not broken, f"{len(broken)} broken local links:\n" + "\n".join(f"{page}: {value}" for page, value in broken[:80])
print(f"Demo check passed: {len(EXPECTED)} Markdown files, {len(index)} indexed pages, {checked} local links")
