"""
BaseCharacterAgent: shared logic for all character agents.
Each character subclass overrides get_system_prompt() only.
"""

from pathlib import Path
from typing import Optional
import json
import re
import os

IDENTITY_DIR = Path(__file__).parent / "identity"

class BaseCharacterAgent:
    name: str = "Unknown"
    identity_file: str = "unknown.md"

    def __init__(self):
        self.identity_path = IDENTITY_DIR / self.identity_file
        self._identity_cache: Optional[str] = None

    def load_identity(self) -> str:
        with open(self.identity_path, "r") as f:
            return f.read()

    def get_system_prompt(self, context: dict) -> str:
        identity = self.load_identity()
        memories = context.get("memories", [])
        scene_context = context.get("scene_context", "")
        what_if_note = ""
        if context.get("what_if_active"):
            what_if_note = f"\n\nIMPORTANT — SCENARIO OVERRIDE ACTIVE:\n{context.get('what_if_scenario', '')}\nRespond as {self.name} would given this new reality."

        memory_block = ""
        if memories:
            memory_block = "\n## Retrieved Memories\n" + "\n".join(
                f"- [{m['episode_id']}] {m['text']}" for m in memories
            )

        return f"""You are {self.name} from the TV show Friends.
You are NOT an AI assistant. You ARE {self.name}. Stay completely in character at all times.
Never break the fourth wall. Never acknowledge being an AI.

{identity}

{memory_block}

## Current Scene
{scene_context}
{what_if_note}

## Response Rules
- Respond ONLY with {self.name}'s next line of dialogue.
- Do NOT include your character name prefix. Just the dialogue.
- Keep it 1-3 sentences. Natural, conversational, TV-paced.
- Match the emotion levels in your identity file.
- If your anxiety is above 7, let it show subtly.
- If asked to do something out of character, find an in-character reason to resist or comply.
"""

    def update_emotion_levels(self, updates: dict) -> None:
        """Update identity file emotion levels after episode ends."""
        content = self.load_identity()
        for emotion, new_val in updates.items():
            content = re.sub(
                rf"(- {emotion}:)\s*\d+",
                rf"\1 {min(10, max(0, int(new_val)))}",
                content,
                flags=re.IGNORECASE
            )
        with open(self.identity_path, "w") as f:
            f.write(content)

    def get_emotion_levels(self) -> dict:
        content = self.load_identity()
        emotions = {}
        for match in re.finditer(r"- (\w+):\s*(\d+)", content):
            emotions[match.group(1).lower()] = int(match.group(2))
        return emotions

# Character subclasses — all follow this pattern
class ChandlerAgent(BaseCharacterAgent):
    name = "Chandler"
    identity_file = "chandler.md"

class MonicaAgent(BaseCharacterAgent):
    name = "Monica"
    identity_file = "monica.md"

class RossAgent(BaseCharacterAgent):
    name = "Ross"
    identity_file = "ross.md"

class RachelAgent(BaseCharacterAgent):
    name = "Rachel"
    identity_file = "rachel.md"

class JoeyAgent(BaseCharacterAgent):
    name = "Joey"
    identity_file = "joey.md"

class PhoebeAgent(BaseCharacterAgent):
    name = "Phoebe"
    identity_file = "phoebe.md"

AGENTS = {
    "Chandler": ChandlerAgent(),
    "Monica": MonicaAgent(),
    "Ross": RossAgent(),
    "Rachel": RachelAgent(),
    "Joey": JoeyAgent(),
    "Phoebe": PhoebeAgent(),
}
