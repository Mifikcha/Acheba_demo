"""Synchronize the explicitly approved HnD notes and their local assets into this demo."""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("HND_SOURCE_CONTENT", r"E:\Камень\Hopes and Dreams\Публичный сайт"))
CONTENT = ROOT / "Публичный сайт"
MANIFEST = ROOT / "scripts" / "demo_manifest.json"


def safe_path(base: Path, relative: str) -> Path:
    path = (base / relative).resolve()
    if not path.is_relative_to(base.resolve()):
        raise ValueError(f"Path escapes content root: {relative}")
    return path


def resource_references(text: str) -> set[str]:
    refs = set()
    for value in re.findall(r"!?\[\[([^\]]+)\]\]", text):
        target = unquote(value.split("|", 1)[0].split("#", 1)[0].strip())
        if Path(target).suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".csv", ".pdf"}:
            refs.add(target)
    for value in re.findall(r"(?:src|href)=[\"']([^\"']+)[\"']", text):
        target = unquote(value.split("?", 1)[0].split("#", 1)[0])
        if target.startswith(("/assets/", "./assets/")):
            refs.add(target.lstrip("./"))
    return refs


def source_resource(reference: str) -> tuple[str, Path]:
    if reference.startswith("assets/"):
        relative = reference
    elif reference.startswith("_Resours/"):
        relative = reference
    else:
        matches = list((SOURCE / "_Resours").glob(Path(reference).name))
        if len(matches) != 1:
            raise FileNotFoundError(f"Ambiguous or missing attachment: {reference}")
        relative = matches[0].relative_to(SOURCE).as_posix()
    source = safe_path(SOURCE, relative)
    if not source.is_file():
        raise FileNotFoundError(source)
    return relative, source


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    notes = manifest["notes"]
    assert len(notes) == len(set(notes)), "Duplicate notes in manifest"
    approved = set(notes)
    assets: dict[str, Path] = {}
    for relative in notes:
        if not relative.endswith(".md") or relative.startswith(("private/", "assets/")):
            raise ValueError(f"Unapproved note path: {relative}")
        source = safe_path(SOURCE, relative)
        if not source.is_file():
            raise FileNotFoundError(source)
        for reference in resource_references(source.read_text(encoding="utf-8")):
            resource_relative, resource_source = source_resource(reference)
            assets[resource_relative] = resource_source

    if "--check" in sys.argv:
        for relative in notes:
            assert safe_path(CONTENT, relative).read_bytes() == safe_path(SOURCE, relative).read_bytes(), relative
        for relative, source in assets.items():
            assert safe_path(CONTENT, relative).read_bytes() == source.read_bytes(), relative
        print(f"Exact source copies verified: {len(notes)} notes, {len(assets)} assets")
        return

    for relative in notes:
        target = safe_path(CONTENT, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(safe_path(SOURCE, relative), target)
    for relative, source in assets.items():
        target = safe_path(CONTENT, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    print(f"Synchronized {len(notes)} notes and {len(assets)} assets")


if __name__ == "__main__":
    main()
