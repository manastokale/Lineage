"""
Dummy data for testing. All responses are pre-written.
Activated when USE_DUMMY_DATA=true in .env
"""

import random

DUMMY_DIALOGUES = {
    "Chandler": [
        "Could this BE any more of a disaster? I once had a job that was literally keeping track of how many times I said 'could this be' and even THAT was better than this.",
        "Oh great, because what this situation needed was more chaos. I am SO comfortable right now.",
    ],
    "Monica": [
        "Okay, everyone needs to calm down and listen to me because I have a PLAN. Step one: we organize.",
        "I just cleaned that! Could you please, for the love of everything, use a coaster?",
    ],
    "Ross": [
        "Actually, and I think this is important, what we're experiencing right now is remarkably similar to the social dynamics of late Pleistocene hominid groups—",
        "Guys! You will not BELIEVE what just happened. It changes everything we know about—",
    ],
    "Rachel": [
        "Oh my God, okay, this is like the most insane thing that has ever happened and I have been through some things.",
        "You know what? I am a STRONG, independent woman and I do not need this.",
    ],
    "Joey": [
        "How YOU doin'?",
        "Okay but can we eat first? Because I cannot process any emotional content on an empty stomach.",
    ],
    "Phoebe": [
        "Oh, I totally understand. My psychic said something like this would happen.",
        "You guys, I feel like the universe is trying to tell us something.",
    ],
}

GENERIC_DIALOGUES = [
    "This is... a lot to take in.",
    "You know what, I think we're going to be okay.",
]

def get_dummy_dialogue(context: str = "") -> str:
    for character in DUMMY_DIALOGUES:
        if character.lower() in context.lower():
            return random.choice(DUMMY_DIALOGUES[character])
    return random.choice(GENERIC_DIALOGUES)

# ── Dummy REST responses ──────────────────────────────────────────────────────

DUMMY_EPISODES = [
    {"episode_id": "s01e01", "title": "The One Where It All Began",              "status": "final",          "created_at": "Sept 22, 1994", "scene_count": 8},
    {"episode_id": "s01e02", "title": "The One with the Sonogram",               "status": "draft",          "created_at": "Sept 29, 1994", "scene_count": 7},
    {"episode_id": "s01e03", "title": "The One with the Thumb",                  "status": "final",          "created_at": "Oct 6, 1994",   "scene_count": 9},
    {"episode_id": "s01e04", "title": "The One with George Stephanopoulos",      "status": "final",          "created_at": "Oct 13, 1994",  "scene_count": 6},
    {"episode_id": "s01e07", "title": "The One Where the Power Never Came Back", "status": "final",          "created_at": "Oct 12, 1994",  "scene_count": 11},
]
