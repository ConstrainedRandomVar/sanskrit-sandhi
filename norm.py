#!/usr/bin/env python3
"""Shared Sanskrit search normalizer (Tier 1) — MUST stay in sync with the JS core
`_norm` in lib/sanskrit-search.js (parity is asserted by lib/test/run.js).
Canonicalizes orthographic variation so search is robust: NFC, drop ZWJ/ZWNJ +
avagraha, candrabindu->anusvara, homorganic nasal+virama+consonant -> anusvara
(idempotent over nested clusters, e.g. सन्न्यस्त == संन्यस्त), word-final म् ->
anusvara, dandas -> space, keep only Devanagari, collapse/trim whitespace.
"""
import unicodedata, re

_NASAL = "ङञणनम"          # ṅ ñ ṇ n m
_CONS = "क-ह"             # U+0915..U+0939, matches JS isCons (c>='क' && c<='ह')
# nasal + virama + (optional word-boundary whitespace) + consonant -> anusvara.
# The \s* lets a word-final nasal collapse across a space (अदेङ् गुणः), matching the JS peekC scan;
# the whitespace is preserved (group 1) so space-preserving output stays identical to JS.
_NAS_RE = re.compile(f"[{_NASAL}]्(\\s*)([{_CONS}])")


def normalize(s: str, drop_spaces: bool = False) -> str:
    s = unicodedata.normalize("NFC", s)
    s = s.replace("‌", "").replace("‍", "")   # ZWNJ / ZWJ
    s = s.replace("ऽ", "")                              # avagraha
    s = s.replace("ँ", "ं")                             # candrabindu -> anusvara
    # homorganic nasal + virama + consonant -> anusvara; loop to a fixpoint so nested
    # clusters (न्न्य) collapse fully and identically to the JS left-to-right scan.
    while True:
        s2 = _NAS_RE.sub("ं\\1\\2", s)
        if s2 == s:
            break
        s = s2
    s = s.replace("म्", "ं")                            # word-final म् -> anusvara
    s = re.sub(r"[।॥]", " ", s)                         # dandas -> space
    s = re.sub(r"[^ऀ-ॿ\s]", "", s)                     # keep only devanagari + whitespace
    s = re.sub(r"\s+", "" if drop_spaces else " ", s)
    return s.strip()


if __name__ == "__main__":
    for a, b in [("सङ्ग्रहः", "संग्रहः"), ("सन्न्यस्त", "संन्यस्त"),
                 ("रामम्", "रामं"), ("देवोऽत्र", "देवो अत्र")]:
        print(repr(a), "->", repr(normalize(a)), "|", repr(b), "->", repr(normalize(b)),
              "| EQUAL" if normalize(a) == normalize(b) else "| DIFFER")
