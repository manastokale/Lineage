"""
HTML Episode Script Parser
Converts raw HTML episode files into structured scene graph JSON.

Input:  episode_scripts/s01e01.html
Output: {
  "episode_id": "s01e01",
  "title": "The One Where Monica Gets A Roommate",
  "scenes": [
    {
      "scene_id": "s01e01_sc01",
      "location": "Central Perk",
      "time_of_day": "afternoon",
      "lines": [
        {
          "speaker": "Monica",
          "text": "There's nothing to tell!",
          "emotion_tags": ["defensive", "nervous"],
          "addressed_to": ["Rachel"]
        }
      ],
      "scene_description": "The gang is sitting around the couch..."
    }
  ]
}
"""

import re
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup, NavigableString

# All recognized character names (expand as needed)
CHARACTERS = {
    "Monica", "Rachel", "Ross", "Chandler", "Joey", "Phoebe",
    "Gunther", "Janice", "Carol", "Susan", "Mr. Heckles", "Tag"
}

# Emotion keyword → tag mapping (extend freely)
EMOTION_KEYWORDS = {
    "laughing": "joy", "smiling": "joy", "excited": "joy", "happy": "joy",
    "crying": "sadness", "tearful": "sadness",
    "angry": "anger", "furious": "anger", "yelling": "anger",
    "nervous": "anxiety", "anxious": "anxiety", "worried": "anxiety",
    "sarcastic": "sarcasm", "sarcastically": "sarcasm",
    "confused": "confusion", "hesitant": "confusion"
}

LOCATION_PATTERNS = [
    r"\[\s*Scene:?\s*(.+?)(?:\]|\)|$)",
    r"\[\s*Scene:?\s*(.+?)\]",
    r"\[\s*at\s+(.+?)(?:\.|\]|\)|$)",
    r"\(Scene:?\s*(.+?)\)",
    r"INT\.\s+(.+?)\s*[-–]",
    r"EXT\.\s+(.+?)\s*[-–]"
]

SCENE_MARKER_PATTERNS = [
    r"(\[Scene:?\s*.+?\])",
    r"(\[Scene\s+.+?\])",
    r"(\(Scene:?\s*.+?\))",
]
SCENE_MARKER_RE = re.compile(r"(\[(?:Scene|SCENE):?[^\]]+\]|\((?:Scene|SCENE):?[^)]+\))", re.IGNORECASE)
LOCATION_PAREN_RE = re.compile(r"^\(([^)]+)\)$")
META_PREFIXES = (
    "written by:",
    "story by:",
    "teleplay by:",
    "with minor adjustments by:",
    "with help from:",
    "transcribed by:",
    "additional transcribing by:",
    "note:",
)
SCRIPT_BLOCK_TAGS = ("p", "font")


def _clean_scene_description(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text or "").strip()
    if not normalized:
        return ""
    normalized = re.sub(r"^[\[(]\s*scene:?\s*", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"[\])]\s*$", "", normalized).strip()
    normalized = re.sub(r"^\s*scene:?\s*", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bSCENE:\s*\[?SCENE:?\s*", "", normalized, flags=re.IGNORECASE)
    normalized = normalized.strip("[]() ").strip()
    if not normalized or normalized.lower() in {"unknown", "scene unknown", "scene", "time lapse"}:
        return ""
    return normalized

def extract_emotion_tags(stage_direction: str) -> list[str]:
    tags = []
    direction_lower = stage_direction.lower()
    for keyword, emotion in EMOTION_KEYWORDS.items():
        if keyword in direction_lower and emotion not in tags:
            tags.append(emotion)
    return tags

def extract_location(text: str) -> Optional[str]:
    for pattern in LOCATION_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            location = re.sub(r"^\s*scene:?\s*", "", match.group(1).strip().rstrip("."), flags=re.IGNORECASE)
            location = location.split(",", 1)[0].strip()
            location = location.strip("[]() ")
            if location.lower() in {"unknown", "scene unknown"}:
                return None
            return location
    paren_match = LOCATION_PAREN_RE.match(_normalize_text(text))
    if paren_match:
        candidate = paren_match.group(1).strip().rstrip(".")
        if candidate and len(candidate.split()) <= 4:
            return candidate
    return None


def extract_scene_description(text: str) -> str:
    for pattern in SCENE_MARKER_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            return _clean_scene_description(match.group(1))
    normalized = re.sub(r"\s+", " ", text).strip()
    if re.match(r"^\[\s*at\s+", normalized, re.IGNORECASE):
        return _clean_scene_description(re.sub(r"^\[\s*at\s+", "", normalized, flags=re.IGNORECASE))
    paren_match = LOCATION_PAREN_RE.match(normalized)
    if paren_match:
        candidate = _clean_scene_description(paren_match.group(1))
        lower = candidate.lower()
        if candidate and lower not in {"knock", "laughing", "sighs", "pause", "silence", "music plays", "applause", "clears her throat"}:
            return candidate
    if normalized.lower() in {"scene", "scene unknown", "[scene: unknown]", "[time lapse]"}:
        return ""
    if re.match(r"^\[", normalized):
        return _clean_scene_description(normalized)
    return ""

def infer_addressee(text: str, speaker: str) -> list[str]:
    """Simple heuristic: if a character name appears in dialogue, they may be addressed."""
    mentioned = []
    for char in CHARACTERS:
        if char != speaker and re.search(r'\b' + char + r'\b', text, re.IGNORECASE):
            mentioned.append(char)
    return mentioned[:2]  # cap at 2 to avoid noise


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _looks_like_new_script_line(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False
    if SCENE_MARKER_RE.fullmatch(normalized) or re.match(r"^\s*[\[(]\s*(scene|at)\b", normalized, re.IGNORECASE):
        return True
    if re.match(r"^[A-Za-z][A-Za-z0-9 .,'&/()_-]{0,80}:\s*", normalized):
        return True
    if _looks_like_scene_parenthetical(normalized):
        return True
    if normalized.upper() in {"OPENING CREDITS", "CLOSING CREDITS", "COMMERCIAL BREAK"}:
        return True
    return False


def _looks_like_scene_parenthetical(text: str) -> bool:
    normalized = _normalize_text(text)
    match = LOCATION_PAREN_RE.match(normalized)
    if not match:
        return False
    inner = match.group(1).strip()
    lower = inner.lower()
    if lower in {"knock", "pause", "beat", "silence", "laughing", "cries", "crying", "applause", "sighs", "clears her throat"}:
        return False
    return len(inner) >= 8


def _split_script_block_lines(text: str) -> list[str]:
    raw_lines = [
        _normalize_text(part)
        for part in re.split(r"\n+", text or "")
    ]
    raw_lines = [line for line in raw_lines if line]
    merged: list[str] = []
    for line in raw_lines:
        if not merged or _looks_like_new_script_line(line):
            merged.append(line)
            continue
        merged[-1] = _normalize_text(f"{merged[-1]} {line}")
    return [line for line in merged if line and line.upper() not in {"OPENING CREDITS", "CLOSING CREDITS", "COMMERCIAL BREAK"}]


def _parse_dialogue_line(raw: str) -> tuple[str, str, str]:
    normalized = _normalize_text(raw)
    if not normalized:
        return ("", "", "")
    match = re.match(r"^([A-Za-z][A-Za-z0-9 .,'&/()_-]{0,80}?):\s*(.+)$", normalized)
    if not match:
        return ("", "", "")
    speaker = match.group(1).strip()
    dialogue = match.group(2).strip()
    if speaker.lower() in {prefix.rstrip(":") for prefix in META_PREFIXES}:
        return ("", "", "")
    stage_match = re.findall(r"\(([^)]+)\)", dialogue)
    stage_text = _normalize_text(" ".join(stage_match))
    dialogue = _normalize_text(re.sub(r"\([^)]*\)", "", dialogue))
    if not dialogue and stage_text:
        dialogue = f"({stage_text})"
    return (speaker, dialogue, stage_text)


def _append_dialogue(raw: str, current_scene: dict | None, scene_counter: int, episode_id: str, scenes: list[dict]) -> tuple[dict | None, int]:
    speaker, dialogue, stage_text = _parse_dialogue_line(raw)
    if not speaker or not dialogue:
        return current_scene, scene_counter
    if current_scene is None:
        scene_counter += 1
        current_scene = {
            "scene_id": f"{episode_id}_sc{scene_counter:02d}",
            "location": "Unknown",
            "time_of_day": "day",
            "lines": [],
            "scene_description": "",
        }
        scenes.append(current_scene)
    current_scene["lines"].append(
        {
            "speaker": speaker,
            "text": dialogue,
            "emotion_tags": extract_emotion_tags(stage_text),
            "addressed_to": infer_addressee(dialogue, speaker),
            "stage_direction": stage_text,
        }
    )
    return current_scene, scene_counter


def _start_scene(marker_text: str, current_location: str | None, scene_counter: int, episode_id: str, scenes: list[dict]) -> tuple[dict, int, str]:
    scene_counter += 1
    description = extract_scene_description(marker_text)
    location = extract_location(marker_text) or current_location or "Unknown"
    current_scene = {
        "scene_id": f"{episode_id}_sc{scene_counter:02d}",
        "location": location,
        "time_of_day": "day",
        "lines": [],
        "scene_description": description or (location if location != "Unknown" else ""),
    }
    scenes.append(current_scene)
    return current_scene, scene_counter, location


def _extract_font_blocks(tag) -> list[str]:
    blocks: list[str] = []
    pending_label = ""
    for child in tag.children:
        if isinstance(child, NavigableString):
            parts = _split_script_block_lines(str(child))
            if not parts:
                continue
            for text in parts:
                if pending_label:
                    blocks.append(_normalize_text(f"{pending_label} {text}"))
                    pending_label = ""
                else:
                    blocks.append(text)
            continue
        child_parts = _split_script_block_lines(child.get_text(separator="\n", strip=True))
        if not child_parts:
            continue
        if child.name == "b" and len(child_parts) == 1 and child_parts[0].endswith(":"):
            pending_label = child_parts[0]
            continue
        if child.name == "p":
            continue
        for child_text in child_parts:
            if pending_label:
                blocks.append(_normalize_text(f"{pending_label} {child_text}"))
                pending_label = ""
            else:
                blocks.append(child_text)
    if pending_label:
        blocks.append(pending_label)
    return blocks


def _iter_script_blocks(soup: BeautifulSoup) -> list[str]:
    blocks: list[str] = []
    for tag in soup.find_all(SCRIPT_BLOCK_TAGS):
        if tag.name == "font":
            if tag.find_parent("p"):
                continue
            blocks.extend(block for block in _extract_font_blocks(tag) if block)
            continue
        blocks.extend(_split_script_block_lines(tag.get_text(separator="\n", strip=True)))
    return blocks


def _iter_script_blocks_classic(soup: BeautifulSoup) -> list[str]:
    return _iter_script_blocks(soup)


def _iter_script_blocks_paragraph_only(soup: BeautifulSoup) -> list[str]:
    blocks: list[str] = []
    for tag in soup.find_all("p"):
        blocks.extend(_split_script_block_lines(tag.get_text(separator="\n", strip=True)))
    return blocks


def _iter_script_blocks_paragraph_primary(soup: BeautifulSoup) -> list[str]:
    paragraph_blocks = _iter_script_blocks_paragraph_only(soup)
    # Some mid-season transcripts include a small top-level <font> wrapper that carries
    # missing scene headers or opening lines. Prefer <p>, but merge in any unique extras.
    if not paragraph_blocks:
        return _iter_script_blocks_classic(soup)
    merged = list(paragraph_blocks)
    seen = set(paragraph_blocks)
    for block in _iter_script_blocks_classic(soup):
        if block not in seen:
            merged.append(block)
            seen.add(block)
    return merged


def _iter_script_blocks_modern(soup: BeautifulSoup) -> list[str]:
    return _iter_script_blocks_paragraph_only(soup)


def _iter_script_blocks_season_two(soup: BeautifulSoup) -> list[str]:
    blocks = _iter_script_blocks_classic(soup)
    # Season 2 has multiple BR-heavy transcripts where one top-level font block contains
    # an entire scene. Keep the classic mixed parser, but drop duplicate END/meta noise.
    cleaned: list[str] = []
    for block in blocks:
        if _normalize_text(block).upper() == "END" and cleaned:
            continue
        cleaned.append(block)
    return cleaned


def _iter_script_blocks_late_plain(soup: BeautifulSoup) -> list[str]:
    return _iter_script_blocks_paragraph_only(soup)


def _parse_episode_with_block_iterator(html_path: Path, block_iterator) -> dict:
    with open(html_path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    episode_id = html_path.stem  # e.g. "s01e01"
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else episode_id

    blocks = block_iterator(soup)

    scenes = []
    current_scene = None
    current_location = None
    scene_counter = 0

    for raw in blocks:
        parts = [part for part in SCENE_MARKER_RE.split(raw) if _normalize_text(part)]
        if not parts:
            continue
        for part in parts:
            part = _normalize_text(part)
            if not part:
                continue
            if (
                SCENE_MARKER_RE.fullmatch(part)
                or re.match(r"^\s*[\[(]\s*(scene|at)\b", part, re.IGNORECASE)
                or _looks_like_scene_parenthetical(part)
            ):
                current_scene, scene_counter, current_location = _start_scene(
                    part,
                    current_location,
                    scene_counter,
                    episode_id,
                    scenes,
                )
                continue

            current_scene, scene_counter = _append_dialogue(part, current_scene, scene_counter, episode_id, scenes)

    return {
        "episode_id": episode_id,
        "title": title,
        "scene_count": len(scenes),
        "scenes": scenes
    }


def _parse_episode_default(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_classic)

def _parse_episode_season_one(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_classic)


def _parse_episode_season_two(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_season_two)


def _parse_episode_season_three(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_paragraph_primary)


def _parse_episode_season_four(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_paragraph_primary)


def _parse_episode_season_five(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_modern)


def _parse_episode_season_six(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_modern)


def _parse_episode_season_seven(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_modern)


def _parse_episode_season_eight(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_modern)


def _parse_episode_season_nine(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_late_plain)


def _parse_episode_season_ten(html_path: Path) -> dict:
    return _parse_episode_with_block_iterator(html_path, _iter_script_blocks_late_plain)


def _season_from_path(html_path: Path) -> int:
    match = re.match(r"s(\d{2})e\d{2}", html_path.stem, re.IGNORECASE)
    return int(match.group(1)) if match else 1


def parse_episode(html_path: Path) -> dict:
    season = _season_from_path(html_path)
    parser = {
        1: _parse_episode_season_one,
        2: _parse_episode_season_two,
        3: _parse_episode_season_three,
        4: _parse_episode_season_four,
        5: _parse_episode_season_five,
        6: _parse_episode_season_six,
        7: _parse_episode_season_seven,
        8: _parse_episode_season_eight,
        9: _parse_episode_season_nine,
        10: _parse_episode_season_ten,
    }.get(season, _parse_episode_default)
    return parser(html_path)


def episode_to_markdown(episode: dict) -> str:
    season_match = re.match(r"s(\d{2})e(\d{2})", episode.get("episode_id", ""), re.IGNORECASE)
    season = int(season_match.group(1)) if season_match else int(episode.get("season", 1) or 1)
    number = int(season_match.group(2)) if season_match else int(episode.get("episode", 0) or 0)
    lines = [
        "---",
        f"episode_id: {episode.get('episode_id', '').lower()}",
        f"title: {episode.get('title', '').replace(':', ' -')}",
        f"season: {season}",
        f"episode: {number}",
        "---",
        "",
        f"# {episode.get('episode_id', '').upper()} {episode.get('title', '')}",
        "",
    ]

    for scene in episode.get("scenes", []):
        location = (scene.get("location") or "Unknown").replace("|", "/")
        description = (scene.get("scene_description") or "").strip()
        lines.append(f"## Scene {scene.get('scene_id')} | {location}")
        if description:
            lines.append(f"Description: {description}")
        lines.append("")
        for index, line in enumerate(scene.get("lines", [])):
            speaker = (line.get("speaker") or "Scene").replace("|", "/")
            text = (line.get("text") or "").strip()
            stage_direction = (line.get("stage_direction") or "").strip()
            emotions = ",".join(line.get("emotion_tags", []) or [])
            metadata = [f"line_index={index}"]
            if emotions:
                metadata.append(f"emotions={emotions}")
            if stage_direction:
                metadata.append(f"stage={stage_direction.replace('|', '/')}")
            lines.append(f"- {speaker}: {text} [{'; '.join(metadata)}]")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def parse_episode_markdown(markdown_path: Path) -> dict:
    raw = markdown_path.read_text(encoding="utf-8")
    frontmatter_match = re.match(r"^---\n(.*?)\n---\n", raw, re.DOTALL)
    metadata: dict[str, str] = {}
    body = raw
    if frontmatter_match:
        body = raw[frontmatter_match.end():]
        for row in frontmatter_match.group(1).splitlines():
            if ":" not in row:
                continue
            key, value = row.split(":", 1)
            metadata[key.strip()] = value.strip()

    episode_id = metadata.get("episode_id", markdown_path.stem.lower())
    title = metadata.get("title", episode_id.upper())
    scenes: list[dict] = []
    current_scene: dict | None = None
    scene_re = re.compile(r"^## Scene\s+(\S+)\s+\|\s+(.+)$")
    line_re = re.compile(r"^- (.+?): (.*?)(?: \[(.*)\])?$")

    for raw_line in body.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        scene_match = scene_re.match(line)
        if scene_match:
            current_scene = {
                "scene_id": scene_match.group(1).strip(),
                "location": scene_match.group(2).strip(),
                "time_of_day": "day",
                "scene_description": "",
                "lines": [],
            }
            scenes.append(current_scene)
            continue
        if current_scene is None:
            continue
        if line.startswith("Description: "):
            current_scene["scene_description"] = line.replace("Description: ", "", 1).strip()
            continue
        line_match = line_re.match(line)
        if not line_match:
            continue
        speaker = line_match.group(1).strip()
        text = line_match.group(2).strip()
        meta_blob = line_match.group(3) or ""
        meta_parts = {}
        for chunk in meta_blob.split(";"):
            if "=" not in chunk:
                continue
            key, value = chunk.split("=", 1)
            meta_parts[key.strip()] = value.strip()
        current_scene["lines"].append(
            {
                "speaker": speaker,
                "text": text,
                "emotion_tags": [item for item in meta_parts.get("emotions", "").split(",") if item],
                "addressed_to": infer_addressee(text, speaker),
                "stage_direction": meta_parts.get("stage", ""),
            }
        )

    return {
        "episode_id": episode_id,
        "title": title,
        "scene_count": len(scenes),
        "scenes": scenes,
    }

def parse_all(scripts_dir: Path) -> list[dict]:
    results = []
    for html_file in sorted(scripts_dir.glob("*.html")):
        print(f"Parsing {html_file.name}...")
        try:
            parsed = parse_episode(html_file)
            results.append(parsed)
            print(f"  → {parsed['scene_count']} scenes, {sum(len(s['lines']) for s in parsed['scenes'])} lines")
        except Exception as e:
            print(f"  ERROR: {e}")
    return results
