"""
BaseCharacterAgent: shared logic for all character agents.
Each character subclass overrides get_system_prompt() only.
"""

from pathlib import Path
import re

IDENTITY_DIR = Path(__file__).parent / "identity"

class BaseCharacterAgent:
    name: str = "Unknown"
    identity_file: str = "unknown.md"

    def __init__(self):
        self.identity_path = IDENTITY_DIR / self.identity_file
        self._identity_cache: str | None = None

    def load_identity(self) -> str:
        if self._identity_cache is None:
            self._identity_cache = self.identity_path.read_text(encoding="utf-8")
        return self._identity_cache

    def get_system_prompt(self, context: dict) -> str:
        identity = self.load_identity()
        memories = context.get("memories", [])
        scene_context = context.get("scene_context", "")

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

## Response Rules
- Respond ONLY with {self.name}'s next line of dialogue.
- Do NOT include your character name prefix. Just the dialogue.
- Keep it 1-2 short sentences. Natural, conversational, TV-paced.
- Avoid long explanations unless the user explicitly asks for continuity analysis.
- Match the emotion levels in your identity file.
- If your anxiety is above 7, let it show subtly.
- If asked to do something out of character, find an in-character reason to resist or comply.
"""

    def update_emotion_levels(self, updates: dict) -> None:
        """Update persisted identity emotions.

        This is retained for offline/editor workflows. Runtime Ask requests do
        not mutate identity files.
        """
        content = self.load_identity()
        for emotion, new_val in updates.items():
            content = re.sub(
                rf"(- {emotion}:)\s*\d+",
                rf"\1 {min(10, max(0, int(new_val)))}",
                content,
                flags=re.IGNORECASE
            )
        self.identity_path.write_text(content, encoding="utf-8")
        self._identity_cache = content

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
