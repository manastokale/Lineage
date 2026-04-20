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

DUMMY_AGENTS = [
    {"name": "Ross",     "emotions": {"joy": 2, "anger": 8, "sarcasm": 4, "anxiety": 7},  "occupation": "Paleontologist", "emoji": "😢"},
    {"name": "Joey",     "emotions": {"joy": 9, "anger": 1, "sarcasm": 2, "anxiety": 0},  "occupation": "Actor",          "emoji": "😂"},
    {"name": "Chandler", "emotions": {"joy": 4, "anger": 3, "sarcasm": 9, "anxiety": 8},  "occupation": "Transponster",   "emoji": "😐"},
    {"name": "Monica",   "emotions": {"joy": 7, "anger": 5, "sarcasm": 3, "anxiety": 8},  "occupation": "Chef",           "emoji": "😤"},
    {"name": "Rachel",   "emotions": {"joy": 7, "anger": 4, "sarcasm": 5, "anxiety": 4},  "occupation": "Fashion",        "emoji": "💅"},
    {"name": "Phoebe",   "emotions": {"joy": 8, "anger": 2, "sarcasm": 2, "anxiety": 2},  "occupation": "Musician",       "emoji": "🎸"},
]

DUMMY_EPISODES = [
    {"episode_id": "s01e01", "title": "The One Where It All Began",              "status": "final",          "created_at": "Sept 22, 1994", "scene_count": 8},
    {"episode_id": "s01e02", "title": "The One with the Sonogram",               "status": "draft",          "created_at": "Sept 29, 1994", "scene_count": 7},
    {"episode_id": "s01e03", "title": "The One with the Thumb",                  "status": "final",          "created_at": "Oct 6, 1994",   "scene_count": 9},
    {"episode_id": "s01e04", "title": "The One with George Stephanopoulos",      "status": "final",          "created_at": "Oct 13, 1994",  "scene_count": 6},
    {"episode_id": "s01e07", "title": "The One Where the Power Never Came Back", "status": "what-if-branch", "created_at": "Oct 12, 1994",  "scene_count": 11},
]

DUMMY_STREAM_LINES = [
    {"speaker": "Chandler", "text": "Could this coffee BE any hotter? I think I just lost a layer of skin on my tongue.",                                         "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Monica",   "text": "Well, if you didn't gulp it down like a pelican, maybe you'd be fine. And please use a coaster, I just wiped that table.",   "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Ross",     "text": "Guys! You will not believe what they just unearthed at the museum. It changes everything we know about the late Cretaceous period!", "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Joey",     "text": "Cool. Can we eat? I haven't had anything since the pizza, the sandwich, and the leftover pizza.",                             "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Rachel",   "text": "Oh my God you guys, I just ran into Barry at the coffee shop. He was with his new— you know what, never mind. I'm FINE.",     "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Phoebe",   "text": "I had a dream about a pigeon last night and NOW I understand everything that's happening.",                                    "scene_id": "s01e01_sc01", "generated": True},
]

DUMMY_WHAT_IF_DIFF = {
    "original": [
        {"speaker": "Chandler", "text": "Could this coffee BE any hotter?"},
        {"speaker": "Monica",   "text": "Please use a coaster."},
        {"speaker": "Ross",     "text": "It changes everything we know about the Cretaceous period!"},
    ],
    "generated": [
        {"speaker": "Chandler", "text": "A monkey just stole my coffee. I don't know how to feel about this."},
        {"speaker": "Monica",   "text": "That monkey better not have touched my table. Does anyone have a disinfectant?"},
        {"speaker": "Ross",     "text": "Actually, that species is indigenous to— wait, IS that Marcel??"},
    ],
}

# ── Per-agent profiles (for /api/agents/{name}/profile) ───────────────────────

_PROFILE_TEMPLATE = {
    "version": "V1.2",
    "status": "ACTIVE",
}

DUMMY_AGENT_PROFILES = {
    "Chandler": {
        **_PROFILE_TEMPLATE,
        "subtitle": "Professional Sarcasm Engine",
        "quote": "I'm not great at advice. Can I interest you in a sarcastic comment?",
        "personality": {"neuroticism": 92, "sarcasm": 98, "anxiety": 85, "wit": 74, "loyalty": 80},
        "recentLines": [
            {"scene": "SCENE 04", "text": "And I just want a million dollars!", "time": "2m ago"},
            {"scene": "SCENE 07", "text": "You have to stop the Q-tip when there's resistance!", "time": "15m ago"},
            {"scene": "SCENE 12", "text": "I'm hopeless and awkward and desperate for love!", "time": "1h ago"},
        ],
        "relationships": [
            {"id": "MN", "strength": "strong"},
            {"id": "JY", "strength": "strong"},
            {"id": "RS", "strength": "moderate"},
            {"id": "RC", "strength": "moderate"},
        ],
    },
    "Monica": {
        **_PROFILE_TEMPLATE,
        "subtitle": "Precision Control Freak",
        "quote": "Rules are good! Rules help control the fun!",
        "personality": {"perfectionism": 99, "competitiveness": 95, "nurturing": 80, "anxiety": 70, "cooking_skill": 98},
        "recentLines": [
            {"scene": "SCENE 02", "text": "I KNOW! And the worst part is they didn't even use a coaster!", "time": "5m ago"},
            {"scene": "SCENE 05", "text": "Seven! SEVEN! SEVEN!", "time": "22m ago"},
            {"scene": "SCENE 09", "text": "Fine, we'll do it YOUR way. But I want it on the record.", "time": "45m ago"},
        ],
        "relationships": [
            {"id": "CH", "strength": "strong"},
            {"id": "RC", "strength": "strong"},
            {"id": "RS", "strength": "strong"},
            {"id": "PH", "strength": "moderate"},
        ],
    },
    "Ross": {
        **_PROFILE_TEMPLATE,
        "subtitle": "Paleontology-Obsessed Romantic",
        "quote": "We were on a BREAK!",
        "personality": {"intellectualism": 95, "romanticism": 90, "anxiety": 85, "stubbornness": 88, "divorce_rate": 100},
        "recentLines": [
            {"scene": "SCENE 03", "text": "It changes everything we know about the late Cretaceous!", "time": "3m ago"},
            {"scene": "SCENE 06", "text": "I'm FINE. Totally fine.", "time": "18m ago"},
            {"scene": "SCENE 11", "text": "MY SANDWICH?!", "time": "1h ago"},
        ],
        "relationships": [
            {"id": "RC", "strength": "strong"},
            {"id": "MN", "strength": "strong"},
            {"id": "CH", "strength": "moderate"},
            {"id": "JY", "strength": "moderate"},
        ],
    },
    "Rachel": {
        **_PROFILE_TEMPLATE,
        "subtitle": "Fashion-Forward Survivor",
        "quote": "It's like all my life everyone's told me, 'You're a shoe!' Well, what if I don't want to be a shoe?",
        "personality": {"confidence": 75, "fashion_sense": 98, "independence": 70, "drama": 85, "growth": 90},
        "recentLines": [
            {"scene": "SCENE 01", "text": "Oh my God you guys, I just ran into Barry!", "time": "1m ago"},
            {"scene": "SCENE 08", "text": "I got off the plane.", "time": "30m ago"},
            {"scene": "SCENE 10", "text": "Does this qualify me for anything?", "time": "2h ago"},
        ],
        "relationships": [
            {"id": "RS", "strength": "strong"},
            {"id": "MN", "strength": "strong"},
            {"id": "PH", "strength": "moderate"},
            {"id": "JY", "strength": "moderate"},
        ],
    },
    "Joey": {
        **_PROFILE_TEMPLATE,
        "subtitle": "Sandwich-Powered Actor",
        "quote": "Joey doesn't share food!",
        "personality": {"loyalty": 100, "appetite": 100, "acting_range": 60, "heartwarming": 90, "vocabulary": 40},
        "recentLines": [
            {"scene": "SCENE 01", "text": "How YOU doin'?", "time": "30s ago"},
            {"scene": "SCENE 04", "text": "Can we eat first?", "time": "10m ago"},
            {"scene": "SCENE 09", "text": "That is so NOT how you eat a meatball sub.", "time": "1h ago"},
        ],
        "relationships": [
            {"id": "CH", "strength": "strong"},
            {"id": "PH", "strength": "moderate"},
            {"id": "RS", "strength": "moderate"},
            {"id": "RC", "strength": "moderate"},
        ],
    },
    "Phoebe": {
        **_PROFILE_TEMPLATE,
        "subtitle": "Mystic Songstress",
        "quote": "Smelly cat, smelly caaaat, what are they feeding you?",
        "personality": {"eccentricity": 100, "empathy": 90, "musical_talent": 60, "street_smarts": 85, "spirituality": 95},
        "recentLines": [
            {"scene": "SCENE 02", "text": "My psychic said this would happen.", "time": "4m ago"},
            {"scene": "SCENE 06", "text": "I had a dream about a pigeon.", "time": "20m ago"},
            {"scene": "SCENE 11", "text": "Oh no, not Princess Consuela Banana-Hammock!", "time": "2h ago"},
        ],
        "relationships": [
            {"id": "JY", "strength": "moderate"},
            {"id": "MN", "strength": "moderate"},
            {"id": "RC", "strength": "moderate"},
            {"id": "RS", "strength": "moderate"},
        ],
    },
}
