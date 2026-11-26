#!/usr/bin/env node
'use strict';
// Regression runner: node test/run.js   (exit 0 = all pass). Python parity runs if python3 is on PATH.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'sanskrit-search.js'));
const HL = require(path.join(ROOT, 'highlight-core.js'));
const SA = require(path.join(ROOT, 'sandhi-align.js'));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const AC = JSON.parse(fs.readFileSync(path.join(__dirname, 'sandhi-align-cases.json'), 'utf8'));
let pass = 0, fail = 0; const fails = [];
const check = (ok, id, d) => { if (ok) pass++; else { fail++; fails.push(id + '  ::  ' + d); } };

for (const [a, b] of cases.normEqual) check(S.normalize(a) === S.normalize(b), 'normEqual ' + a + '/' + b, S.normalize(a) + ' ≠ ' + S.normalize(b));
for (const x of cases.idempotent) check(S.normalize(S.normalize(x)) === S.normalize(x), 'idempotent ' + x, 'not stable');
for (const x of cases.normMapEq) check(S.normMap(x).n === S.normalize(x), 'normMapEq ' + x, S.normMap(x).n + ' ≠ ' + S.normalize(x));
for (const c of cases.sandhiJoin) { const g = S.sandhiJoin(c.a, c.b); check(g === c.expect, 'sandhiJoin ' + c.a + '+' + c.b, 'got ' + g + ', want ' + c.expect + ' (' + (c.note || '') + ')'); }
for (const c of cases.toDeva) { const g = S.toDeva(c.in); check(g === c.expect, 'toDeva ' + c.in, 'got ' + g + ', want ' + c.expect); }
for (const c of cases.unitMatch) {
  const g = S.matches(S.prepBlock(c.surface), S.expandQuery(c.query, c.mode || 'sandhi', c.wide || false));
  check(g === c.shouldMatch, 'unitMatch ' + c.id, c.query + ' on "' + c.surface + '" → ' + g + ', want ' + c.shouldMatch);
}
for (const c of cases.unitSpans) {
  const sp = HL.findSpans(c.surface, S.expandQuery(c.query, c.mode || 'sandhi', c.wide || false), S);
  const g = sp.length ? c.surface.slice(sp[0][0], sp[0][1]) : '';
  check(g === c.expect, 'unitSpans ' + c.id, '"' + g + '", want "' + c.expect + '"');
}
for (const c of cases.unitSnippet) {
  const sn = S.snippet(S.prepBlock(c.surface), S.expandQuery(c.query, c.mode || 'sandhi', c.wide || false));
  const m = sn.match(new RegExp(S.M1 + '(.*?)' + S.M2)); const g = m ? m[1] : '';
  check(g === c.expect, 'unitSnippet ' + c.id, '"' + g + '", want "' + c.expect + '"');
}
for (const c of AC) {
  const r = SA.piecePortion(c.P, c.pieces, c.a, c.b, c.mem);   // c.mem { ma, mb }: a member-level run (round 11)
  const g = r ? c.P.slice(0, r[0]) + '[' + c.P.slice(r[0], r[1]) + ']' + c.P.slice(r[1]) : 'NULL';
  check(g === c.want, 'sandhi-align ' + c.P, 'got ' + g + ', want ' + c.want);
}
// JS ↔ Python normalizer parity (norm.py must stay in step with the JS normalize)
(function () {
  const sample = [].concat(cases.paritySample, cases.idempotent, cases.normMapEq, ...cases.normEqual, cases.unitMatch.map(c => c.surface));
  let out;
  try { out = execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); from norm import normalize; print(json.dumps([normalize(x) for x in json.load(sys.stdin)], ensure_ascii=False))', ROOT], { input: JSON.stringify(sample), encoding: 'utf8' }); }
  catch (e) { console.log('(python3 not available — parity check skipped)'); return; }
  const py = JSON.parse(out); let bad = 0, first = '';
  sample.forEach((x, i) => { if (S.normalize(x) !== py[i]) { bad++; if (!first) first = x; } });
  check(bad === 0, 'parity', bad + '/' + sample.length + ' JS≠PY; first: ' + first);
})();
console.log('sanskrit-sandhi tests: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
