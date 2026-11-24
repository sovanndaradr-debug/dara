/* Regression test on 13 real Khmer poems (Khmer Wikipedia, CC BY-SA; see corpus/SOURCES.md).
   A rule that helps one word must not quietly break the corpus: each poem keeps its metre, and its
   share of stanzas with the right syllable count and its metre score stay at or above the floor.
   Floors = measured 2026-11-23, minus 0.02. Raise them when the engine improves; never lower them
   to make a change pass. Run: node lyric-engine/corpus.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');

const POEMS = {
  // file:               [metre,        stanzas ok, score]
  'chbab-pros':          ['brahmagiti', 0.90, 0.81],
  'kerkal-thmey':        ['brahmagiti', 0.79, 0.74],
  'lbaek-thmey':         ['kakagati',   0.80, 0.72],
  'kerkal':              ['brahmagiti', 0.81, 0.71],
  'peak-chas':           ['brahmagiti', 0.87, 0.81],
  'kram-ngoy':           ['brahmagiti', 0.78, 0.76],
  'peali':               ['pheak8',     0.74, 0.66],
  'hem-chieu':           ['pheak7',     0.72, 0.69],
  'pradao-pros-srey':    ['pheak7',     0.51, 0.49],
  'mream-dai':           ['pheak8',     0.51, 0.48],
  'romleuk':             ['pheak7',     0.65, 0.64],
  'trey':                ['pheak7',     0.78, 0.73],
};
const read = f => fs.readFileSync(path.join(__dirname, 'corpus', f + '.txt'), 'utf8');

let lines = 0;
for (const [file, [metre, stanzaFloor, scoreFloor]] of Object.entries(POEMS)) {
  const text = read(file);
  lines += text.split('\n').filter(l => l.trim()).length;
  const guess = E.guessSections(text) ? 'sections' : (E.guessMeter(text) || {}).id;
  assert.strictEqual(guess, metre, `${file}: metre ${guess}, expected ${metre}`);
  const fit = E.fitMeter(text, metre);
  const ok = fit.stanzas.filter(s => s.syllables === s.expected).length / fit.stanzas.length;
  assert.ok(ok >= stanzaFloor, `${file}: ${ok.toFixed(3)} of stanzas counted right, floor ${stanzaFloor}`);
  assert.ok(fit.score >= scoreFloor, `${file}: score ${fit.score.toFixed(3)}, floor ${scoreFloor}`);
  console.log(file.padEnd(18), metre.padEnd(11), 'stanzas', ok.toFixed(3), 'score', fit.score.toFixed(3));
}
// a poem that changes form: កាកគតិ for stanzas 1-68, then ព្រហ្មគីតិ
const parts = E.guessSections(read('kon-chao-lbaek'));
assert.deepStrictEqual(parts && parts.map(p => p.id), ['kakagati', 'brahmagiti']);
assert.ok(Math.abs(parts[1].from - 69) <= 2, 'switch near stanza 69, got ' + parts[1].from);
console.log(`corpus passed: 13 poems, ${lines} lines`);
