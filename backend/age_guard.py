from __future__ import annotations

import re

MIN_AGE = 10

_AGE_PATTERNS = [
    re.compile(r"\bi(?:'m|\s+am)\s+(\d{1,2})\s*(?:years?\s*old|yo|y/o)\b", re.I),
    re.compile(r"\bmy\s+age\s+is\s+(\d{1,2})\b", re.I),
    re.compile(r"\b(\d{1,2})\s*yaş(?:ım|ında(?:yam|yım)?|ındayım)\b", re.I),
    re.compile(r"\byaşım\s+(\d{1,2})\b", re.I),
]

_GRADE_PATTERNS = [
    re.compile(r"\bi(?:'m|\s+am)\s+in\s+(?:the\s+)?(?:1st|2nd|3rd|first|second|third)\s+grade\b", re.I),
    re.compile(r"\bmən\s+[123]\s*-?\s*(?:ci|cı|cü|cu)?\s*sinifdə(?:yəm)?\b", re.I),
    re.compile(r"\b[123]\.?\s*sınıftayım\b", re.I),
]


def is_underage(text: str) -> bool:
    for pattern in _AGE_PATTERNS:
        for match in pattern.finditer(text):
            if 1 <= int(match.group(1)) < MIN_AGE:
                return True
    return any(pattern.search(text) for pattern in _GRADE_PATTERNS)
