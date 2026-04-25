from __future__ import annotations

import hashlib
import math


class LocalHashEmbeddingFunction:
    """Small deterministic embedding fallback for local Chroma usage."""

    def __init__(self, dimensions: int = 64):
        self.dimensions = dimensions

    def _embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = (text or "").lower().split()
        if not tokens:
            return vector
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            for index in range(self.dimensions):
                vector[index] += (digest[index % len(digest)] / 255.0) - 0.5
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]

    def __call__(self, input: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in input]
