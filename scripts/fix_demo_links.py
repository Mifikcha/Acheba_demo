"""Repair known source wikilinks after Quartz renders the approved demo subset.

The source-derived Markdown is synchronized with explicit demo edits. Known
short links to lessons represented in the demo resolve locally.
"""

from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BASE = "https://mifikcha.github.io/Acheba_demo/"
LOCAL = {
    "типы-данных": "информатика/истинный-фундамент/03-строки,-переменные-и-типы-данных/",
    "экранированные-последовательности": "информатика/истинный-фундамент/03-строки,-переменные-и-типы-данных/03.3-экранирование",
    "что-такое-переменная": "информатика/истинный-фундамент/03-строки,-переменные-и-типы-данных/03.5-что-такое-переменная",
    "№16-простая-рекурсия": "информатика/_разборы-задач/№16-простая-рекурсия",
}

repaired = 0
for page in PUBLIC.rglob("*.html"):
    source = page.read_text(encoding="utf-8")
    page_url = urljoin(BASE, page.relative_to(PUBLIC).as_posix())

    def replace(match: re.Match[str]) -> str:
        global repaired
        href = match.group(1)
        target = urlparse(urljoin(page_url, href))
        if target.netloc != "mifikcha.github.io" or not target.path.startswith("/Acheba_demo/"):
            return match.group(0)
        slug = unquote(target.path.removeprefix("/Acheba_demo/")).strip("/")
        if slug in LOCAL:
            repaired += 1
            return f'href="/Acheba_demo/{LOCAL[slug]}"'
        return match.group(0)

    output = re.sub(r'href="([^\"]+)"', replace, source)
    if output != source:
        page.write_text(output, encoding="utf-8")

print(f"Repaired {repaired} known source links")

index_path = PUBLIC / "static/contentIndex.json"
index = json.loads(index_path.read_text(encoding="utf-8"))
graph_repaired = 0
for item in index.values():
    links = []
    for slug in item.get("links", []):
        if slug in LOCAL:
            destination = LOCAL[slug]
            links.append(destination + "index" if destination.endswith("/") else destination)
            graph_repaired += 1
        else:
            links.append(slug)
    item["links"] = links
index_path.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
print(f"Repaired {graph_repaired} graph references")
