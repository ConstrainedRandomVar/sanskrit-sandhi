# sanskrit-sandhi

The sandhi library behind **adhyayana-sahakārī** (https://constrainedrandomvar.github.io/adhyayana-sahakari/): its site-wide and
in-page search, the exact pratīka links in its commentaries, and the अन्वाख्यातवृत्तिः vṛtti generator
(https://github.com/ConstrainedRandomVar/anvakhyata-vrtti), which uses it to join the words of its vṛttis by sandhi and to check
reference vṛttis regardless of sandhi. Live search built on it: https://constrainedrandomvar.github.io/prasthanatrayi-search/

| File | What |
|---|---|
| `sanskrit-search.js` | Normalisation, ITRANS/IAST → Devanāgarī, sandhi joining (`sandhiJoin`), query expansion and matching, highlighted snippets. |
| `sandhi-align.js` | Where each पद of a word sits inside its printed sandhi form (`pieceSpans`, `piecePortion`) — to mark exactly the quoted part of a joined word. |
| `highlight-core.js` | Highlight spans for a match in a surface string (`findSpans`), DOM-free. |
| `norm.py` | The same normaliser in Python, kept in step by the tests. |

## sanskrit-search.js

Orthography-, space- & **sandhi-tolerant** matching for Devanāgarī text. One dependency-free,
DOM-free JavaScript file that powers a search box: it normalizes orthographic variation,
expands a query into the sandhi surface forms it could take in running text, matches against a
prebuilt index, and produces highlighted snippets.

- **Zero dependencies.** Pure JS, one file.
- **Runs anywhere.** Load as a classic `<script src>` (works from `file://`, offline) **or**
  `require()` it in Node. (UMD-lite: sets `window.SanskritSearch` / `module.exports`.)
- **DOM-free.** The consuming page owns its UI, index, and filters; this module owns the
  language logic only.

> **Philosophy: high _recall_, not linguistic generation.** The rules deliberately
> over-generate candidate surface forms so a query in pausā (citation) form still finds the
> sandhi-fused text. Documented approximations are acceptable; misses are not.

## Load it

```html
<!-- browser -->
<script src="lib/sanskrit-search.js"></script>
<script>const SS = window.SanskritSearch;</script>
```
```js
// node
const SS = require('./lib/sanskrit-search.js');
```

## Quick start

```js
// 1. Prepare each index block once (precompute normalized forms):
const blocks = rawBlocks.map(b => Object.assign(b, SS.prepBlock(b.s)));
//    prepBlock(surface) -> { s, _n, _nc }

// 2. Per query:
const ex = SS.expandQuery(userInput, 'sandhi');   // ITRANS or Devanāgarī; mode below
const hits = blocks.filter(b => SS.matches(b, ex));

// 3. Render a highlighted snippet (sentinels -> <mark>):
const html = esc(SS.snippet(hit, ex))
  .replaceAll(SS.M1, '<mark>').replaceAll(SS.M2, '</mark>');
```

## Modes

| mode | behavior |
|---|---|
| `exact`   | normalized substring, spaces significant |
| `loose`   | normalized substring; also space-insensitive. **Not** sandhi-aware. Supported by `matches`/`snippet`; the shipped search UIs use `sandhi` instead. |
| `sandhi`  | high-recall: reconstructs sandhi surface forms (visarga, vowel sandhi, mātrā fusion, left-edge absorption). **Default.** |
| `cooccur` | all query words in one daṇḍa-delimited sentence, any order |

## API

| function | returns | notes |
|---|---|---|
| `normalize(s, drop?)` | string | Canonical form. `drop=true` removes all spaces. |
| `normMap(str)` | `{n, map}` | Same normalization, position-tracked for highlighting. Invariant: `normMap(x).n === normalize(x)`. |
| `toDeva(input)` | string | ITRANS → Devanāgarī (pass-through if already Devanāgarī). |
| `stripSandhi(w)` | string | Strip trailing visarga/anusvāra/candrabindu/halant → stem. |
| `matraLead(w)` | string \| null | Vowel-initial word as a mātrā (left-edge fusion). |
| `vowelSandhi(a,b)`, `sandhiJoin(a,b)` | string | Low-level joiners (exported for tests). |
| `expandQuery(input, mode)` | object | Everything `matches`/`snippet` need (words, stems, candidates…). |
| `prepBlock(surface)` | `{s,_n,_nc}` | Precompute per block. |
| `matches(block, ex)` | boolean | `block` must have `_n`/`_nc` from `prepBlock`. |
| `snippet(block, ex)` | string | Snippet with `M1`/`M2` sentinels around matches. |
| `M1`, `M2` | string | Highlight sentinels (``/``); replace with `<mark>`/`</mark>` **after** HTML-escaping. |

### ITRANS convention (standard)
`ch`=च (also `c`), `Ch`/`chh`=छ, `.a`=ऽ, `~N`=ङ, `~n`=ञ, `Sh`/`S`=ष, `RRi`=ृ, `M`=ं (anusvāra),
`H`=ः (visarga). The ASCII path is standard ITRANS (2026-07-23); IAST input (diacritics, auto-detected)
is separate and uses IAST's own tables (`c`=च, `ch`=छ). IAST vocalic `ṛ`/`ḷ` accept both the IAST
dot-below (`ṛ`, U+1E5B) and the ISO-15919 ring-below (`r̥`, U+0325) forms.

## Sandhi coverage

- **Normalization:** NFC · drop ZWJ/ZWNJ/avagraha · candrabindu→anusvāra · varga-nasal+halant+consonant→anusvāra (**idempotent**, nested clusters) · **word-final म्≡anusvāra** · daṇḍa→space · drop non-Devanāgarī.
- **Visarga:** `-aḥ`+voiced→o, `-āḥ`+voiced→ā, **`-iḥ/-uḥ/-ṛḥ/-eḥ/-oḥ`(any vowel but a/ā)+voiced→r** (`buddheḥ jāyamānāḥ`→`buddher jāyamānāḥ`); sibilants ḥ+c/ch→ś, +t/th→s, +ṭ/ṭh→ṣ; retained before k/kh/p/ph, ś/ṣ/s; **+ vowel:** `-aḥ`→hiatus (`aḥ+a→o'`), `-āḥ`→ā hiatus, **any other vowel+ḥ → r** (fused as mātrā: `jñānaiḥ iti`→`jñānair iti`); **r-stem `-aḥ`:** a consonant+`-aḥ` word may be a ru-form (`punaḥ`, `antaḥ`, `prātaḥ`) whose visarga → `र्` before a vowel/voiced sound — this form is enumerated as an *extra* candidate (`punaḥ āvartinaḥ`→`punar āvartinaḥ`), inert for ordinary `-as` words since their r-form never occurs in the text. **su-lopa (6.1.132):** `सः`/`एषः` → `स`/`एष` before any consonant or non-`a` vowel (`सोऽ` before `a`) — applied when `saḥ`/`eṣaḥ` leads the word-pair.
- **Vowel sandhi:** savarṇa-dīrgha (like vowels lengthen: a+a→ā, **i+i→ī, u+u→ū, ṛ+ṛ→ṝ**) · yaṇ (i/u/ṛ→y/v/r before a *dissimilar* vowel) · guṇa/vṛddhi · pūrvarūpa (e/o + a) · **āvādi** (ai/au + vowel → `āy/āv` semivowel, e.g. `dvau imau`→`द्वाविमौ`, `ubhau api`→`उभावपि`; the elided `ā`-hiatus form is also emitted, since both occur) · **ayādi** (e/o + non-a vowel) emitted only in the elided `a`+V form (`te iti`→`त इति`), which is what the corpus uses.
- **Consonant fusion:** halant+vowel → consonant+mātrā **with jaś-tva** (word-final stop voices before a vowel: `त्→द्`, `क्→ग्`, `ट्→ड्`, `प्→ब्`) **and ṅ/ṇ/n-doubling** (word-final `न्/ङ्/ण्` after a *short* vowel doubles before a vowel — 8.3.32: `tiṣṭhan iti`→`tiṣṭhann iti`; long-vowel `rāmān iti` does not double); dental त्/द्+consonant (ścutva/ṣṭutva/voicing/anunāsika); **word-final न्+voiceless stop → anusvāra + class sibilant** (`न्`+c/ch→`ंश्`, +t/th→`ंस्`, +ṭ/ṭh→`ंष्`: `vikārān cet`→`vikārāṃś cet`); **word-final क्/ट्/प् → voiced ग्/ड्/ब् before a voiced consonant** (`samyak jñānam`→`samyag jñānam`, `ṣaṭ bhiḥ`→`ṣaḍbhiḥ`) **or homorganic nasal before a nasal** (`vāk maya`→`vāṅmaya`); before a vowel they voice via jaś-tva (`vāk īśa`→`vāg īśa`).
- **Word boundaries:** word-final `-ṃ`(=-m)+vowel → म+mātrā; **break combinations** — a phrase may cross one or more daṇḍas / commas / compound boundaries where no external sandhi applies, mixed with boundaries that do; sandhi/abut choices are enumerated only at the boundaries where sandhi actually **diverges** from plain abutment (consonant-consonant / retained-visarga boundaries collapse and are pinned), so `2^k` stays small even for long phrases — a query can therefore need an arbitrary *mix* of sandhi and abut across many boundaries; **pada-split forms** — some editions (e.g. upasanayoga) separate words with the left word's sandhi-final change applied but the right word kept as its own token (`punaḥ→punar āvartino`, `ca api→cāpy akṣaram`): each non-final word gets an alternate form (visarga→`र्`, final `i/u/ṛ`→semivowel+halant) and the sandhi/abut enumeration yields both the fused and the pada-separated surface; **left-edge** absorption of a query's initial vowel onto a preceding consonant; **right-edge** — the last query word is also matched as a *stem/core* (trailing ending — visarga/anusvāra/halant *or a final vowel* — dropped, matched as a prefix) **as a yaṇ form** (final `i/u/ṛ` → semivowel `y/v/r`), **and as a jaś-tva form** (final stop `k/c/ṭ/t/p` → voiced `g/j/ḍ/d/b` before a following out-of-query vowel), so it can be a compound member or have its ending sandhi'd with a following out-of-query word (`kṛtam abhojyam` → `kṛtam-abhojya-bhojanādikam`; `jānāmi iti` → `jānāmīty-anubhavāt`; `agni uṣṇa` → `agny-uṣṇa`; `viruddhatvāt iti` → `viruddhatvād ity-arthaḥ`). Each break combination is emitted with the last word in every right-edge form.

## Known, deliberate limitations (locked by tests — discuss before "fixing")

- **Visarga before ś/ṣ/s is retained** (`रामः शेते`), not assimilated — matches corpus orthography (853 vs 6 in the reference corpus).
- **Consonant-final external sandhi covers dental त्/द्, word-final न्, and word-final क्/ट्/प्.** Word-final क्/ट्/प् voice/assimilate before voiced sounds and vowels, and correctly stay before voiceless/sibilants (`samyak ca`→`samyak ca`). **Word-final ङ्/ण् are not extended the `न्`-style sibilant insertion** (8.3.7 is specific to `न्`): before a c/t/ṭ-class stop they abut (`प्राङ् च`→`प्राङ्च`, `षण् च`→`षण्च`) rather than taking `ंश्/ंस्/ंष्`. This is a narrow, low-impact case — word-final ङ्/ण् occur in only a tiny closed set of words (`प्राङ्`, `प्रत्यङ्`, `उदङ्`, `सम्यङ्`, `षण्`…), abut is often the linguistically correct output for them anyway, and the one place ṅ/ṇ visibly change — **doubling before a vowel** (`pratyaṅ ātmā`→`pratyaṅṅātmā`) — **is** handled (8.3.32 applies to `न्/ङ्/ण्`).
- **ayādi (e/o + non-a vowel)** is emitted only in the elided `a`+V form (`te iti`→`त इति`), not the retained-semivowel `अय्/अव्` form — the corpus uses the elided form ~50:1 (`तएव` 864 vs `तयेव` 16). (āvādi ai/au **is** fully handled — both semivowel and elided.)
- **Leading short अ** is left-edge-expanded (अ→ā, savarṇa-dīrgha) in the multi-word phrase path always, and for a **single-word** query only when the stem is ≥5 chars (`avidyā`→ finds `svāvidyā`). Shorter अ-words (`अ`, `अत्र`, `अर्थ`…) are **not** expanded — the `ा`-form floods the index (`ार्थ` alone hits ~3000, many false like `पात्र` for `atra`). The ≥5 cutoff cleanly separates specific stems from floods.

## sandhi-align.js

```js
const SA = require('./sandhi-align.js');
// printed word, its पद (a compound member list joined with '-'), and the run of pieces a..b being quoted
SA.piecePortion('एवंभूतमात्मानं', ['एवम्-भूतम्', 'आत्मानम्'], 1, 1);   // → [start, end) of 'मात्मानं'
```

The पद must rejoin by sandhi to exactly the printed word; pieces are then found by position, never by searching their letters, so
short and repeated words are placed as surely as long ones. An akṣara is never split: a merged vowel's akṣara goes with the quote; otherwise
an akṣara belongs to the word whose vowel it carries; an avagraha goes with the word whose अ it stands for. If the pieces do not line up
with the print (a misprint or a bad split), the result is `null`: mark nothing rather than guess. Built on `sanskrit-search.js`'s sandhi
rules, so search and pratīka cuts share one set of rules — a new sandhi rule goes into `sanskrit-search.js` and its tests.

## Tests

```
node test/run.js      # or: npm test
```

Sandhi-join outputs, ITRANS/IAST conversion, normalisation invariants (`normMap(x).n === normalize(x)`, idempotency), controlled
match / highlight / snippet cases, the sandhi-align cuts, and JS ↔ Python normaliser parity (when `python3` is available). The
corpus hit-count tests run in the source repository against the full search index and are not included here.

## Licence and source

MIT — see `LICENSE`. Please credit **adhyayana-sahakārī**. This repository is generated from the site's source; issues and
suggestions are welcome here.
