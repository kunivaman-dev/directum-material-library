#!/usr/bin/env python3
"""Validate the published icon catalog and report changes against an approved state."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "public" / "catalog.js"
CONFIG_PATH = ROOT / "sync" / "figma-sync.json"
BASELINE_PATH = ROOT / "sync" / "approved-state.json"
PREFIX = "window.ICON_CATALOG="


class GuardError(Exception):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_catalog() -> list[dict]:
    raw = CATALOG_PATH.read_text(encoding="utf-8").strip()
    if not raw.startswith(PREFIX) or not raw.endswith(";"):
        raise GuardError("public/catalog.js has an unexpected wrapper")
    value = json.loads(raw[len(PREFIX) : -1])
    if not isinstance(value, list):
        raise GuardError("ICON_CATALOG must be an array")
    return value


def validate_svg(path: Path, expected_width: object, expected_height: object) -> str:
    try:
        data = path.read_bytes()
    except FileNotFoundError as exc:
        raise GuardError(f"missing SVG: {path.relative_to(ROOT)}") from exc
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise GuardError(f"invalid SVG: {path.relative_to(ROOT)}: {exc}") from exc
    if root.tag.split("}")[-1].lower() != "svg":
        raise GuardError(f"not an SVG root: {path.relative_to(ROOT)}")
    if not root.get("viewBox") and not (root.get("width") and root.get("height")):
        raise GuardError(f"SVG has no viewBox or size: {path.relative_to(ROOT)}")
    if not isinstance(expected_width, (int, float)) or not isinstance(expected_height, (int, float)):
        raise GuardError(f"invalid catalog dimensions: {path.relative_to(ROOT)}")
    return sha256(data)


def build_state(catalog: list[dict], config: dict) -> tuple[dict, list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    icon_ids: set[str] = set()
    variant_ids: set[str] = set()
    files: set[str] = set()
    allowed_categories = set(config["categories"])
    expected_family = config["variantOrder"]
    icons: dict[str, dict] = {}

    for index, icon in enumerate(catalog):
        where = f"icon #{index + 1}"
        icon_id = icon.get("id")
        if not isinstance(icon_id, str) or not re.fullmatch(r"\d+:\d+", icon_id):
            errors.append(f"{where}: invalid owner id")
            continue
        if icon_id in icon_ids:
            errors.append(f"{where}: duplicate owner id {icon_id}")
        icon_ids.add(icon_id)
        if "description" in icon:
            errors.append(f"{icon_id}: legacy description is present")
        name = icon.get("name")
        category = icon.get("cat")
        keywords = icon.get("keywords")
        variants = icon.get("variants")
        if not isinstance(name, str) or not name.strip():
            errors.append(f"{icon_id}: empty name")
        if category not in allowed_categories:
            errors.append(f"{icon_id}: unknown category {category!r}")
        if not isinstance(keywords, list) or not all(isinstance(x, str) and x.strip() for x in keywords):
            errors.append(f"{icon_id}: keywords must be a string array")
            keywords = keywords if isinstance(keywords, list) else []
        if any(re.fullmatch(r"[-—–\s]+", x) for x in keywords if isinstance(x, str)):
            warnings.append(f"{icon_id}: placeholder-like keyword")
        if not isinstance(variants, list) or not variants:
            errors.append(f"{icon_id}: variants must be a non-empty array")
            variants = []

        labels = [v.get("label") for v in variants if isinstance(v, dict)]
        if labels not in (["base"], expected_family):
            errors.append(f"{icon_id}: unexpected variant family {labels}")

        variant_state: dict[str, dict] = {}
        for variant in variants:
            if not isinstance(variant, dict):
                errors.append(f"{icon_id}: variant is not an object")
                continue
            variant_id = variant.get("id")
            rel_file = variant.get("file")
            label = variant.get("label")
            if not isinstance(variant_id, str) or not re.fullmatch(r"\d+:\d+", variant_id):
                errors.append(f"{icon_id}: invalid variant id {variant_id!r}")
                continue
            if variant_id in variant_ids:
                errors.append(f"{icon_id}: duplicate variant id {variant_id}")
            variant_ids.add(variant_id)
            expected_file = f"assets/variants/{variant_id.replace(':', '-')}.svg"
            if rel_file != expected_file:
                errors.append(f"{variant_id}: file must be {expected_file}")
                continue
            if rel_file in files:
                errors.append(f"{variant_id}: duplicate file {rel_file}")
            files.add(rel_file)
            try:
                digest = validate_svg(ROOT / "public" / rel_file, variant.get("width"), variant.get("height"))
            except GuardError as exc:
                errors.append(str(exc))
                continue
            if label == "mono" and (variant.get("width"), variant.get("height")) != (24, 24):
                errors.append(f"{variant_id}: mono must be 24x24")
            variant_state[variant_id] = {
                "label": label,
                "width": variant.get("width"),
                "height": variant.get("height"),
                "file": rel_file,
                "sha256": digest,
            }

        icons[icon_id] = {
            "name": name,
            "title": icon.get("title"),
            "category": category,
            "keywords": keywords,
            "variants": variant_state,
        }

    if errors:
        raise GuardError("\n".join(errors))
    state = {
        "version": 1,
        "summary": {
            "icons": len(catalog),
            "families": sum(len(x.get("variants", [])) == len(expected_family) for x in catalog),
            "standalone": sum(len(x.get("variants", [])) == 1 for x in catalog),
            "variants": sum(len(x.get("variants", [])) for x in catalog),
            "mono": sum(v.get("label") == "mono" for x in catalog for v in x.get("variants", [])),
        },
        "icons": icons,
    }
    state["catalogSha256"] = sha256(
        json.dumps(icons, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    return state, warnings


def compare(old: dict, new: dict) -> dict:
    before = old.get("icons", {})
    after = new.get("icons", {})
    result: dict[str, object] = {
        "changed": old.get("catalogSha256") != new.get("catalogSha256"),
        "before": old.get("summary", {}),
        "after": new.get("summary", {}),
        "addedIcons": [],
        "removedIcons": [],
        "metadataChanges": [],
        "variantChanges": [],
    }
    result["addedIcons"] = [{"id": i, "name": after[i]["name"]} for i in sorted(after.keys() - before.keys())]
    result["removedIcons"] = [{"id": i, "name": before[i]["name"]} for i in sorted(before.keys() - after.keys())]
    for icon_id in sorted(before.keys() & after.keys()):
        left, right = before[icon_id], after[icon_id]
        fields = [f for f in ("name", "title", "category", "keywords") if left.get(f) != right.get(f)]
        if fields:
            result["metadataChanges"].append({"id": icon_id, "name": right["name"], "fields": fields})
        left_v, right_v = left.get("variants", {}), right.get("variants", {})
        for variant_id in sorted(left_v.keys() | right_v.keys()):
            if variant_id not in left_v:
                kind = "added"
            elif variant_id not in right_v:
                kind = "removed"
            else:
                changed_fields = [
                    f for f in ("label", "width", "height", "file", "sha256")
                    if left_v[variant_id].get(f) != right_v[variant_id].get(f)
                ]
                if not changed_fields:
                    continue
                kind = "svg" if changed_fields == ["sha256"] else "properties+svg" if "sha256" in changed_fields else "properties"
            result["variantChanges"].append(
                {"iconId": icon_id, "icon": right["name"], "variantId": variant_id, "change": kind}
            )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("check", "approve"), nargs="?", default="check")
    parser.add_argument("--json", action="store_true", help="print a machine-readable report")
    args = parser.parse_args()
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    try:
        state, warnings = build_state(load_catalog(), config)
    except (GuardError, json.JSONDecodeError) as exc:
        print(f"Catalog check failed:\n{exc}", file=sys.stderr)
        return 1

    if args.mode == "approve":
        BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
        BASELINE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Approved state saved: {state['summary']}")
        return 0

    if not BASELINE_PATH.exists():
        print("Catalog is valid, but no approved state exists. Run: python3 scripts/catalog_guard.py approve")
        return 2
    old = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    report = compare(old, state)
    report["warnings"] = warnings
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif report["changed"]:
        print(
            "Changes found: "
            f"+{len(report['addedIcons'])} / -{len(report['removedIcons'])} icons, "
            f"{len(report['metadataChanges'])} metadata, {len(report['variantChanges'])} variants"
        )
    else:
        print(f"Catalog matches the approved state: {state['summary']}")
    for warning in warnings:
        print(f"Warning: {warning}", file=sys.stderr)
    return 3 if report["changed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
