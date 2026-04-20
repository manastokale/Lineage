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

from bs4 import BeautifulSoup
import json
import re
from pathlib import Path
from typing import Optional

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
    r"\[Scene:?\s*(.+?)\]",
    r"\(Scene:?\s*(.+?)\)",
    r"INT\.\s+(.+?)\s*[-–]",
    r"EXT\.\s+(.+?)\s*[-–]"
]

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
            return match.group(1).strip().rstrip(".")
    return None

def infer_addressee(text: str, speaker: str) -> list[str]:
    """Simple heuristic: if a character name appears in dialogue, they may be addressed."""
    mentioned = []
    for char in CHARACTERS:
        if char != speaker and re.search(r'\b' + char + r'\b', text, re.IGNORECASE):
            mentioned.append(char)
    return mentioned[:2]  # cap at 2 to avoid noise

def parse_episode(html_path: Path) -> dict:
    with open(html_path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    episode_id = html_path.stem  # e.g. "s01e01"
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else episode_id

    paragraphs = soup.find_all("p")

    scenes = []
    current_scene = None
    current_location = None
    scene_counter = 0

    for p in paragraphs:
        raw = p.get_text(separator=" ", strip=True)
        if not raw:
            continue

        # Detect scene boundary
        loc = extract_location(raw)
        if loc or re.match(r'^\[Scene', raw, re.IGNORECASE):
            scene_counter += 1
            current_location = loc or current_location or "Unknown"
            current_scene = {
                "scene_id": f"{episode_id}_sc{scene_counter:02d}",
                "location": current_location,
                "time_of_day": "day",
                "lines": [],
                "scene_description": raw
            }
            scenes.append(current_scene)
            continue

        # Detect character dialogue: bold tag → character name
        bold = p.find("b")
        if bold:
            speaker_raw = bold.get_text(strip=True).rstrip(":")
            if speaker_raw in CHARACTERS:
                full_text = raw.replace(bold.get_text(), "").strip()
                stage_match = re.findall(r'\(([^)]+)\)', full_text)
                stage_text = " ".join(stage_match)
                dialogue = re.sub(r'\([^)]*\)', '', full_text).strip()
                emotion_tags = extract_emotion_tags(stage_text)

                if current_scene is None:
                    scene_counter += 1
                    current_scene = {
                        "scene_id": f"{episode_id}_sc{scene_counter:02d}",
                        "location": "Unknown",
                        "time_of_day": "day",
                        "lines": [],
                        "scene_description": ""
                    }
                    scenes.append(current_scene)

                current_scene["lines"].append({
                    "speaker": speaker_raw,
                    "text": dialogue,
                    "emotion_tags": emotion_tags,
                    "addressed_to": infer_addressee(dialogue, speaker_raw),
                    "stage_direction": stage_text
                })
                continue

        # Pure stage direction (italic text)
        em = p.find("em")
        if em and current_scene:
            current_scene["scene_description"] += " " + raw

    return {
        "episode_id": episode_id,
        "title": title,
        "scene_count": len(scenes),
        "scenes": scenes
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
