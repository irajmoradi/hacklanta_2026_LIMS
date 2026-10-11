"""House choices share the repository registry with the browser."""

import json

from app.catalog_registry import CATALOG_PATH, load_catalog

OPTIONS = json.loads(CATALOG_PATH.with_name("house-options.json").read_text(encoding="utf-8"))
STYLES = ("cottage", "modern", "aframe", "tudor", "beach", "townhouse")


def validate_options(field, value):
    if value is None:
        return None
    choices = OPTIONS["variants" if field == "house_variant" else "materials"]
    for key, choice in value.items():
        if key not in choices or choice not in choices[key]:
            raise ValueError(f"Invalid {field} choice")
        if field == "house_variant" and choice != "classic":
            entries = load_catalog().entries
            for style in STYLES:
                entry = entries.get(f"house_{style}_lv{key}_{choice}", {})
                if entry.get("kind") != "house" or not entry.get("asset", {}).get("glb"):
                    raise ValueError("House variant is not registered")
    return value
