'use strict';
// sandhi-align.js — CENTRAL library: where the पद pieces of a word sit inside its PRINTED (sandhi) form. Built on the search engine's own
// sandhi rules (sanskrit-search.js: sandhiJoin / sandhiJoinVariants for the junctions, normMap for print-vs-ours spelling), so the
// sandhi-tolerant search and every exact pratīka cut share ONE set of learnings (Harsha 2026-11-22: "make sure these learnings are added
// as a central library and shared with the sandhi tolerant tool"). A new sandhi rule goes into sanskrit-search.js (+ its test cases,
// lib/test/cases.json), never into a caller.
//
// Why: a commentary quotes a verse word inside a sandhi-joined word (एवंभूतमात्मानं → आत्मानम्) and only that SANDHI PORTION may be marked
// ("fix this pratīka mess once and for all"). Used by: the unified lanes' pratīka detectors (extract_maniprabha.js …), lane_cards.js (पद copy),
// and — next — the unified bhāṣya words and the prakaraṇa fused words.
//
// pieceSpans(P, pieces) → [[start, end) per piece] in the printed word P, or null — the split is the word's OWN पद (rejoin-checked against the
//   print, #10b), so a piece is found by POSITION, never by searching its letters (short words ईशा/आह, repeats निधिरनित्यमनित्य are as sure as
//   long ones). Spans may OVERLAP where a junction merged two sounds into one akṣara (ते|नेशा: न is in both तेन and ईशा).
// piecePortion(P, pieces, a, b) → [start, end) of the run a..b, akṣara-safe, or null (pieces don't line up with the print: a misprint or a
//   bad split → mark nothing, exact or nothing #9e).
// piecePortion(P, pieces, a, b, { ma, mb }) → the same, but the run may start/end at a MEMBER of a hyphenated piece (प्राण-देवता → देवता).
// memberSpans(P, pieces, i) → [start, end) of each member of piece i (null if they don't line up).
// The rules for a cut (an akṣara is never split; Devanāgarī can't show half of one):
//   • a merged vowel's akṣara goes with the QUOTE on either side (एवंभूत|मात्मानं, ते|नेशा, अय|मा…, ब्रह्मो|…, निधि|रनित्यम्);
//   • otherwise an akṣara belongs to the word whose vowel it carries: a final in a conjunct with the next word stays out at the run's end
//     (समभव|त्प्राप्त…, महा|न्परि…) and comes in at the run's start (भिन्न|स्तावता);
//   • an avagraha goes with the word whose अ it stands for (यज्ञो|ऽग्नि…, आत्मा|ऽणुः, हा|ऽऽह).
const SS = require('./sanskrit-search.js');
const COMB = c => /[ऀ-ःऺ-़ा-ॏ॑-ॗॢॣ]/.test(c || '');   // vowel signs, virama, ं ः ँ, nukta — NOT ऽ
const VOW0 = /^[ऄ-औॠॡ]/;
const VOWELISH = /[ा-ौॢॣऄ-औॠॡ]/;
const clean = s => String(s || '').normalize('NFC').replace(/[^ऀ-ॿ\-‐]/g, '');
const okAt = (P, i) => i <= 0 || i >= P.length || (!COMB(P[i]) && P[i - 1] !== '्');
// a compound piece (members with hyphens) as the commentary writes it: members sandhi-joined
const joinPiece = (x, P) => { const ms = clean(x).split(/[-‐]/).filter(Boolean); if (ms.length < 2) return ms[0] || '';
  // members joined; where a junction has another legitimate form (गो+आदयः → गवादयः beside the corpus's गआदयः), the one the PRINT shows wins
  const nP = P ? SS.normMap(P).n : '';
  return ms.reduce((l, r) => { const vs = SS.sandhiJoinVariants(l, r); return (P && vs.find(v => nP.indexOf(SS.stripSandhi(SS.normMap(v).n).replace(/[ा-ौ]$/, "")) >= 0)) || vs[0]; }); };   // the final sound (or vowel length, 6.1.101) may have changed before the next word
const cpre = (x, y) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
const csuf = (x, y, cap) => { let c = 0; while (c < x.length && c < y.length && c < cap && x[x.length - 1 - c] === y[y.length - 1 - c]) c++; return c; };

// rejoin junction by junction from PRISTINE neighbouring pieces (sandhiJoin's exception lists — पुनः, सः, … — match whole words, so a
// junction is computed on the two pieces themselves and spliced, never on the accumulated string). choice[k] picks a variant at junction k.
function rejoin(pc, choice) {
  let S = pc[0]; const jn = [null];
  for (let k = 1; k < pc.length; k++) {
    const L = pc[k - 1], R = pc[k], vars = SS.sandhiJoinVariants(L, R), pair = vars[Math.min(choice[k] || 0, vars.length - 1)];
    const lp = cpre(pair, L), tailOld = L.slice(lp);
    if (S.endsWith(tailOld) && S.length - tailOld.length >= 0) {
      const jS = S.length - tailOld.length; S = S.slice(0, jS) + pair.slice(lp);
      const c = csuf(S, R, S.length - jS); jn.push([jS, S.length - c, c < R.length]);   // [2]: the piece's OWN first letter(s) changed (8.4.63 शश्छोऽटि: …च्छब्दात्)
    } else {   // the left piece's own end was already changed by the junction before it (a one-letter piece) — join on the string
      const L2 = S; S = SS.sandhiJoin(L2, R); const jS = cpre(S, L2), c = csuf(S, R, S.length - jS); jn.push([jS, S.length - c, c < R.length]);
    }
  }
  return { S, jn };
}
// map every index of our rejoined S to the printed P through the engine's normalization (ँ ≡ ं, a nasal by place ≡ ं, word-final म् ≡ ं,
// ऽ dropped): both normalize to the same string except possibly the last sound or two (the print's final took the NEXT word's sandhi)
function align(P, S) {
  const nP = SS.normMap(P), nS = SS.normMap(S); const a = nP.n, b = nS.n;
  const k = cpre(a, b);
  if (k < b.length && !(b.length - k <= 2 && a.length - k <= 2)) return null;
  const toN = new Array(S.length + 1); let q = 0;   // S index → normalized index (the last normalized char at or before it)
  for (let j = 0; j <= S.length; j++) { while (q + 1 < nS.map.length && nS.map[q + 1] <= j) q++; toN[j] = (nS.map.length && nS.map[0] <= j) ? q : 0; }
  const map = new Array(S.length + 1);
  for (let j = 0; j < S.length; j++) { const kk = toN[j]; const pi = kk < nP.map.length ? nP.map[kk] : P.length;
    // offset within a char run that normalization kept 1:1
    map[j] = (kk < nP.map.length && nS.map[kk] === j) ? pi : (j > 0 ? Math.max(map[j - 1], pi) : pi); }
  map[S.length] = P.length;
  for (let j = 1; j <= S.length; j++) if (map[j] < map[j - 1]) map[j] = map[j - 1];
  return map;
}
function prepare(P, pieces) {
  P = String(P || '').normalize('NFC'); const pc = pieces.map(x => joinPiece(x, P));
  if (!P || !pc.length || pc.some(x => !x)) return null;
  // try the primary join; if the print doesn't line up, a junction's other legitimate form (गवादयः for the corpus's गआदयः …)
  let choice = [], r = rejoin(pc, choice), map = align(P, r.S);
  for (let k = 1; !map && k < pc.length; k++) { const n = SS.sandhiJoinVariants(pc[k - 1], pc[k]).length;
    for (let v = 1; !map && v < n; v++) { const ch = []; ch[k] = v; const r2 = rejoin(pc, ch), m2 = align(P, r2.S); if (m2) { r = r2; map = m2; } } }
  return map ? { P, pc, S: r.S, jn: r.jn, map } : null;
}
function cut(x, a, b) {
  const { P, pc, S, jn, map } = x;
  if (a === 0 && b === pc.length - 1) return [0, P.length];
  const avaIn = (u, v) => { for (let q = u; q < v; q++) if (P[q] === 'ऽ') return q; return -1; };
  // a MERGE at junction k: piece k's first vowel did not survive as a letter — it went into a vowel sign (ते|नेशा) or a consonant's inherent
  // अ (निधि|रनित्यम्, अय|मा…): the akṣara holding it is shared, and goes with the quote
  const merged = k => { const [jS, jE] = jn[k]; return VOW0.test(pc[k]) ? S[jE] !== pc[k][0] : VOWELISH.test(S.slice(jS, jE)); };
  const mergeStart = k => { const [jS, jE] = jn[k]; return jS < jE ? map[jE - 1] : Math.max(0, map[jS] - 1); };   // the akṣara holding the quote's OWN first vowel (ता|वन्वीक्ष्य, ते|नेशा)
  let s = 0, e = P.length;
  if (a > 0) {
    const [jS, jE] = jn[a], pe = map[jE], av = avaIn(map[Math.max(0, jS - 1)], pe + 1);
    if (av >= 0 && VOW0.test(pc[a])) s = av;
    else if (merged(a)) s = mergeStart(a);
    else if (jn[a][2] && jS < jE) s = map[jS];                                   // the piece's own first letter changed inside the junction: it starts there (प्रतिपादका|च्छब्दात्)
    else s = pe;
    while (s > 0 && !okAt(P, s)) s--;
  }
  if (b < pc.length - 1) {
    const [jS, jE] = jn[b + 1], ps = map[jS], pe = map[jE], av = avaIn(jS > 0 ? map[jS - 1] + 1 : 0, pe + 1);   // the ऽ sits between the two (षडेते|ऽग्न्य…)
    if (av >= 0 && VOW0.test(pc[b + 1])) e = av;
    else if (merged(b + 1)) { e = Math.max(pe, map[jS]); while (e < P.length && !okAt(P, e)) e++; }
    else { e = (jS < jE && P[pe - 1] !== '्') ? pe : ps;
      while (e < P.length && COMB(P[e]) && P[e] !== '्') e++;                 // a ं/ँ/ः or vowel sign belongs to the akṣara before it (तस्मिँ|ल्लोके)
      while (e > 0 && !okAt(P, e)) e--; }
  }
  return s < e ? [s, e] : null;
}
// MEMBER-level cuts (2026-11-25): a quote may be ONE MEMBER (or a run of members) of a hyphenated पद piece — प्राण-देवता quoted as देवता.
// mem = { ma, mb }: the run starts at member ma of piece a and ends at member mb of piece b (members = the piece split on its hyphens; default
// ma = 0, mb = the last member of b, i.e. the whole pieces — then the result is EXACTLY the piece-level cut, the same code path). Only pieces
// a and b are split into members; every other piece stays joined as before, and the members of a and b are rejoined junction by junction
// like any two pieces (rejoin + align), so the same akṣara rules and the merged-akṣara convention apply at a member boundary.
// null = the members don't line up with the print (exact or nothing).
const membersOf = x => clean(x).split(/[-‐]/).filter(Boolean);
function memberPieces(pieces, a, b, ma, mb) {
  const out = [], ia = [];   // ia[i] = index in out of piece i's first member
  for (let i = 0; i < pieces.length; i++) { ia[i] = out.length;
    if (i === a || i === b) { const ms = membersOf(pieces[i]); if (!ms.length) return null; out.push(...ms); } else out.push(pieces[i]); }
  const na = membersOf(pieces[a]).length, nb = membersOf(pieces[b]).length;
  if (!(ma >= 0 && ma < na && mb >= 0 && mb < nb) || (a === b && ma > mb)) return null;
  return { pcs: out, a: ia[a] + ma, b: ia[b] + mb };
}
function piecePortion(P, pieces, a, b, mem) {
  if (a < 0 || b >= pieces.length || a > b) return null;
  if (mem) { const ma = mem.ma == null ? 0 : mem.ma, nb = membersOf(pieces[b]).length, mb = mem.mb == null ? nb - 1 : mem.mb;
    if (!(ma === 0 && mb === nb - 1)) { const m = memberPieces(pieces, a, b, ma, mb); if (!m) return null;
      if (m.a === 0 && m.b === m.pcs.length - 1) return [0, String(P || '').length];
      const x = prepare(P, m.pcs); return x ? cut(x, m.a, m.b) : null; } }
  if (a === 0 && b === pieces.length - 1) return [0, String(P || '').length];
  const x = prepare(P, pieces); return x ? cut(x, a, b) : null;
}
function pieceSpans(P, pieces) { const x = prepare(P, pieces); return x ? pieces.map((_, i) => cut(x, i, i)) : null; }
// memberSpans(P, pieces, i) → [[start, end) per member of piece i] in the print (piece i split on its hyphens, the others joined), or null
function memberSpans(P, pieces, i) {
  if (i < 0 || i >= pieces.length) return null; const n = membersOf(pieces[i]).length; if (!n) return null;
  const m = memberPieces(pieces, i, i, 0, n - 1); if (!m) return null; const x = prepare(P, m.pcs); if (!x) return null;
  const o = []; for (let k = 0; k < n; k++) o.push(m.a + k === 0 && m.a + k === m.pcs.length - 1 ? [0, x.P.length] : cut(x, m.a + k, m.a + k)); return o;
}
module.exports = { piecePortion, pieceSpans, memberSpans, joinPiece, okAt };
