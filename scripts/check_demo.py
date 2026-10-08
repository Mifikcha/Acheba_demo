"""Check that the demo contains only selected notes and has no broken local links."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import json

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "Публичный сайт"
PUBLIC = ROOT / "public"
BASE = "https://mifikcha.github.io/Acheba_demo/"
EXPECTED = {
    "index.md",
    "statistics.md",
    "Информатика/Истинный фундамент/Звезды/A Автоматизм/Звезда 019. Палиндром.md",
    "Математика/_Разборы задач/11 класс ЕГЭ/№ 19 Параметр/Теория по параметру.md",
    "Физика/_Разборы задач/11 класс ЕГЭ/№21 Качественная задача.md",
    "Физика/_Теория/МКТ/Пары.md",
    "Физика/_Теория/Механика/Движение по окружности.md",
}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        self.values.extend(value for name, value in attrs if name in {"href", "src"} and value)


actual = {path.relative_to(CONTENT).as_posix() for path in CONTENT.rglob("*.md")}
assert actual == EXPECTED, f"Unexpected Markdown set: {actual ^ EXPECTED}"
index = json.loads((PUBLIC / "static/contentIndex.json").read_text(encoding="utf-8"))
assert EXPECTED <= {item["filePath"] for item in index.values()}
assert not (PUBLIC / "CNAME").exists()

checked = 0
for page in PUBLIC.rglob("*.html"):
    links = Links()
    links.feed(page.read_text(encoding="utf-8"))
    page_url = urljoin(BASE, page.relative_to(PUBLIC).as_posix())
    for value in links.values:
        target = urlparse(urljoin(page_url, value))
        if target.netloc != "mifikcha.github.io":
            continue
        assert target.path == "/Acheba_demo" or target.path.startswith("/Acheba_demo/"), f"Escaped base path: {page}: {value}"
        relative = unquote(target.path.removeprefix("/Acheba_demo/") if target.path != "/Acheba_demo" else "")
        candidates = [PUBLIC / relative, PUBLIC / f"{relative}.html", PUBLIC / relative / "index.html"]
        assert any(candidate.is_file() for candidate in candidates), f"Broken local link: {page}: {value}"
        checked += 1

print(f"Demo check passed: {len(EXPECTED)} Markdown files, {len(index)} indexed pages, {checked} local links")
