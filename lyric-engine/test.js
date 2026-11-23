// Run: node lyric-engine/test.js
const assert = require('assert');
const E=require('./engine.js');
// regression: earlier syllable tests
const cases=[['ផ្កាឈូករីក',3],['ចង',1],['កម្ពុជា',3],['សម្លាញ់',2],['ប្រទេស',2],['សង្គម',2],['ខ្មែរ',1],['អក្សរ',2],['ចម្រៀង',2],['បទ',1],['ពិរោះ',2],['ស្រលាញ់',2],['ភ្នំពេញ',2],['សួស្តី',2],['អរគុណ',2],['មនុស្ស',2],['សប្បាយ',2],['ជនជាតិ',2],['ច័ន្ទអើយអ្នករះខ្ពស់ម្លេះទេ',7],['ប៉ុន្តែមាសមេអ្នកនៅសែនឆ្ងាយ',8],['ថ្ងៃណាបាននែបនិត្យកាយ',6],['បើនៅឆ្ងាយឈងមិនដល់',6],['នគររងកម្ម',4],['the night is bright',4]];
let pass=0;for(const [t,n] of cases){const c=E.analyze(t).lines[0].count;if(c===n)pass++;else console.log('FAIL',t,c,'want',n);}
console.log('syllables',pass+'/'+cases.length);
// Real verse from km.wikipedia (បទពាក្យ៨ example), two stanzas, two ឃ្លា per visual line
const p8=`រៀន​រស់​រៀន​រក​រៀន​រាប់​រាក់​ទាក់ រៀន​ចេះ​ជឿ​ជាក់​រៀន​ជួយ​ខ្លួន​ឯង
រៀន​ស្រាយ​កំហឹង​រៀន​កុំ​ចំបែង រៀន​ខំ​ប្រឹង​ប្រែង​រៀន​ក្រែង​ចិត្ត​គេ។
រៀន​រួម​ធ្វើការ​រៀន​ការ​ចាត់​ចែង រៀន​គ្រប់​កន្លែង​កុំ​បី​ទំនេរ
រៀន​ស្អប់​ពាក្យ​ឈ្លោះ​តែ​កុំ​រៀន​ជេរ រៀន​ធ្វើ​ឲ្យ​គេ​មាន​ទំនុក​ចិត្ត។`;
const f=E.fitMeter(p8,'pheak8');
f.stanzas.forEach((s,i)=>{console.log('stanza',i+1,'syll',s.syllables+'/'+s.expected);s.lines.forEach(l=>console.log('  ',l.length,l.join('·')));s.links.forEach(l=>console.log('   link',l.from.join(':'),l.fromText,'->',l.found?l.found.pos.join(':')+' '+l.found.kind:(l.near?'near '+l.near.pos.join(':')+' '+l.near.kind:'none')));});
console.log('cross',JSON.stringify(f.cross),'score',f.score.toFixed(2));
const g=E.guessMeter(p8);console.log('guess',g&&g.name,g&&g.score.toFixed(2));
// km.wikipedia កាកគតិ example (one stanza)
const kk='មេសាចិតប្រាំ នគររងកម្ម សិទិ្ធសេរីចុះ\nសីលធម៌ជាតិ ឃ្លាតធ្លាក់ផ្លូវខុស ជនទាំងស្រីប្រុស\nជាប់ទោសពេញដី។';
const k=E.fitMeter(kk,'kakagati');k.stanzas.forEach(s=>{console.log('kakagati syll',s.syllables+'/'+s.expected);s.lines.forEach(l=>console.log('  ',l.join('·')));s.links.forEach(l=>console.log('   link',l.from.join(':'),l.fromText,'->',l.found?l.found.pos.join(':')+' '+l.found.kind:(l.near?'near':'none')));});
console.log('guess',(E.guessMeter(kk)||{}).name);
console.log('user verse guess',(E.guessMeter('ច័ន្ទអើយអ្នករះខ្ពស់ម្លេះទេ\nប៉ុន្តែមាសមេអ្នកនៅសែនឆ្ងាយ\nថ្ងៃណាបាននែបនិត្យកាយ\nបើនៅឆ្ងាយឈងមិនដល់')||{name:'none'}).name);
console.log('kinds', E.rhymeKind({text:'ត្រី',rime:'a',vowel:'ី:'},{text:'ពីរ',rime:'o',vowel:'ី:'},{strict:false}));
// house rules
const end=(t)=>E.analyze(t).lines[0].syllables.slice(-1)[0];
assert.strictEqual(E.rhymeKind(end('សួរ'),end('ជួរ')),'sound');          // ួ ៀ ឿ cross the series
assert.strictEqual(E.rhymeKind(end('កា'),end('គា')),null);              // strict: series must match
assert.strictEqual(E.rhymeKind({text:'ត្រី',rime:'a',vowel:'ី:'},{text:'ពីរ',rime:'o',vowel:'ី:'}),null);
assert.strictEqual(E.rhymeKind({text:'ត្រី',rime:'a',vowel:'ី:'},{text:'ពីរ',rime:'o',vowel:'ី:'},{strict:false}),'written');
assert.strictEqual(E.analyze('ប្រវត្តិសាស្ត្រ').lines[0].count,3);
assert.deepStrictEqual(E.analyze('បងនៅឈរកន្លែងដដែល').lines[0].techniques,[]);
assert.deepStrictEqual(E.analyze('ទឹកត្រជាក់ត្រជុំត្រជាក់ចិត្ត').lines[0].techniques,['ទទះស្ទួន','ទទះស្លាប']);
// assertions: these must stay true
assert.strictEqual(E.guessMeter(p8).id, 'pheak8');
assert.strictEqual(E.guessMeter(kk).id, 'kakagati');
assert.strictEqual(E.guessMeter('ច័ន្ទអើយអ្នករះខ្ពស់ម្លេះទេ\nប៉ុន្តែមាសមេអ្នកនៅសែនឆ្ងាយ\nថ្ងៃណាបាននែបនិត្យកាយ\nបើនៅឆ្ងាយឈងមិនដល់'), null);
assert.strictEqual(pass, cases.length);
console.log('all assertions passed');
// lessons from the Bantol Kak poem (EBC grade 9)
for (const [t, want] of [['ត្រីផងយាត្រា','ត្រី·ផង·យា·ត្រា'],['បុណ្យអ្នកឯង','បុណ្យ·អ្នក·ឯង'],['ក៏មកប្រើអញ','ក៏·មក·ប្រើ·អញ'],['ឱ្យយល់ជាក់ស្តែង','ឱ្យ·យល់·ជាក់·ស្តែង'],['រៀនរស់','រៀន·រស់'],['ទៅជនបទ','ទៅ·ជន·បទ']])
  assert.strictEqual(E.analyze(t).lines[0].syllables.map(s => s.text).join('·'), want);
console.log('bantol kak lessons passed');
// lessons from the owner's PDFs (Khmer Wikipedia pages)
const p7 = E.meters.filter(m => m.id === 'pheak7')[0];
assert.deepStrictEqual(p7.samePosition, [[0, 2]]);
const bk = E.meters.filter(m => m.id === 'bantolkak')[0];
assert.deepStrictEqual(bk.links[0].to, [[2, 2], [2, 4]]);
assert.deepStrictEqual(E.meters.filter(m => m.id === 'pumnol')[0].lines, [6, 4, 6]);
console.log('pdf lessons passed');
// lessons from the full Pheak 8 poem (Wikipedia PDF, four stanzas)
for (const [t, want] of [['រៀនឲ្យលម្អិតរបៀបរស់នៅ', 8], ['រៀនចៀសរណ្តៅអបាយតណ្ហា', 8], ['ទៅកម្សាន្ត', 3]])
  assert.strictEqual(E.analyze(t).lines[0].count, want);
assert.ok(/ម្អិត/.test(E.analyze('រៀនឲ្យលម្អិតរបៀបរស់នៅ').lines[0].syllables.map(s => s.text).join('·')));
const p8full = `រៀនរស់រៀនរករៀនរាប់រាក់ទាក់ រៀនចេះជឿជាក់រៀនជួយខ្លួនឯង
រៀនស្រាយកំហឹងរៀនកុំចំបែង រៀនខំប្រឹងប្រែងរៀនក្រែងចិត្តគេ។
រៀនរួមធ្វើការរៀនការចាត់ចែង រៀនគ្រប់កន្លែងកុំបីទំនេរ
រៀនស្អប់ពាក្យឈ្លោះតែកុំរៀនជេរ រៀនធ្វើឲ្យគេមានទំនុកចិត្ត។
រៀនចេះរាប់អានរៀនកុំរើសអើង រៀនរស់មិនឆ្មើងរៀនរស់ស្នាលស្និទ្ធ
រៀនកុំលោភលន់បំភាន់បាំងបិទ រៀនឲ្យលម្អិតរបៀបរស់នៅ។
រៀនដឹងរៀនដាស់ច្បាស់តួនាទី រៀនដើររកស៊ីរៀនចាប់គោលដៅ
រៀនធ្វើអ្នកចេះកុំស្អប់អ្នកខ្លៅ រៀនចៀសរណ្តៅអបាយតណ្ហា៕`;
const f8 = E.fitMeter(p8full, 'pheak8');
f8.stanzas.forEach(st => assert.strictEqual(st.syllables, 32));
console.log('pheak8 full poem score', f8.score.toFixed(2));
assert.strictEqual(E.guessMeter(p8full).id, 'pheak8');
console.log('pheak8 full poem passed');
assert.deepStrictEqual(E.meters.filter(m => m.id === 'phujong')[0].cross.also, [[2, 4]]);
console.log('phujong cross passed');

// ៗ repeats the syllable before it
assert.strictEqual(E.analyze('ផ្សេងៗ').lines[0].count, 2);
assert.strictEqual(E.analyze('ផ្សេង ៗ').lines[0].count, 2);
assert.strictEqual(E.analyze('តិចៗយឺតៗ').lines[0].count, 4);
assert.ok(E.analyze('ផ្សេងៗ').lines[0].approx);
console.log('repetition mark passed');

// EBC grade-11 «កំណាព្យបទទ្វេមាត្រ» — two real ពាក្យ៧ variants (transcribed from the lesson images)
const gopoat = `ប្រាសាទអង្គរគ្រឹះជាតិខ្មែរ
ខ្មែរយើងត្រូវតែថែឱ្យគង់
គង់កេរដំណែលតផៅពង្ស
ពង្សយើងជាវង្សសាងប្រាង្គប្រា ។
ប្រាសាទរាប់ពាន់លោកសាងទុក
ទុកតទៅមុខតាងសាវតារ
ជាជាក់ជាប់ធ្លាក់ល្អថ្លៃថ្លា
ថ្លាថ្កើងអស្ចារ្យជូនតាយើង ។`;
const aksar = `ចាស់ៗចូលចិត្តចេះចាត់ចែង
ប្រឹងប្រែងប្រាយប្រាប់ប្រើប្រុសៗ
ដាស់ដីដឹកដៀវដាក់ដាំដុះ
បកបុរសបបេះបោកបែនបា។
ស្រីៗស្រុកស្រែស្រុះស្រស់ស្រាយ
កកេះកកាយកាន់កិច្ចការ
តូចៗតាក់តែងតាមតាតា
បួតបេះបោចបាបានបែនបុក ។`;
const sy = w => E.analyze(w).lines[0].syllables.map(s => s.text).join('·');
assert.strictEqual(sy('ផៅពង្ស'), 'ផៅ·ពង្ស');            // silent ្ស: ពង្ស is one syllable
assert.strictEqual(sy('ជាវង្ស'), 'ជា·វង្ស');
assert.strictEqual(sy('រៀនគ្រប់'), 'រៀន·គ្រប់');           // ្រ is an onset, not silent
for (const [name, t] of [['គោព័ទ្ធស្នឹង', gopoat], ['អក្សររលូន', aksar]]) {
  const f = E.fitMeter(t, 'pheak7');
  f.stanzas.forEach(st => assert.strictEqual(st.syllables, 28));
  assert.strictEqual(E.guessMeter(t).id, 'pheak7');
  console.log('pheak7', name, 'score', f.score.toFixed(2));
}
assert.strictEqual(E.fitMeter(gopoat, 'pheak7').score, 1);


// ច្បាប់ប្រុស (km.wikipedia), ព្រហ្មគីតិ ៥-៦-៥-៦ — the first six of 96 stanzas
const chbab = `នេះបទព្រហ្មគីតិ
ពីព្រេងព្រឹទ្ធទុកទូន្មាន
ចែងចងជានិទាន
ទុកគ្រាន់មើលជាច្បាប់ថ្មី។
ឲ្យអស់កូនចៅក្រោយ
ស្ដាប់កុំឲ្យភ្លេចស្មារតី
ប្រដៅទាំងប្រុសស្រី
យកទុកខ្លួនគ្រប់អាត្មា។
ធម្មតាកើតជាមនុស្ស
ទោះស្រីប្រុសក្រណាស់ណា
ក្រគិតក្នុងចិន្ដា
ឲ្យបានដឹងសមនិងគួរ។
នឹងអស់ញាតិសន្ដាន
សោះគេមានពាក្យថាជួ
កុំឆ្មើងកុំតែងតួ
ធ្វើកំប៉ោងកុំពាក្យធំ។
នឹងដើរដូចភុជង្គ
ឲ្យឱនអង្គអាចបារម្ភ
ឲ្យត្រូវនឹងច្បាប់ក្រម
គួរប្រតិបត្តិកុំឲ្យឆ្គង។
រៀនបទរៀនបាទចាស៎
កុំច្រឡាសលើរៀមច្បង
ស្រដីនឹងអ្នកផង
ពាក្យឲ្យគួរកុំឯងវ៉ី។`;
const fb = E.fitMeter(chbab, 'brahmagiti');
fb.stanzas.forEach(st => assert.strictEqual(st.syllables, 22));
assert.strictEqual(fb.stanzas[2].merged, 2);                 // ធម·ម·តា … ម·នុស្ស: minor syllables fold when a line is too long
assert.ok(fb.score >= 0.9, 'brahmagiti score ' + fb.score);
assert.strictEqual(E.guessMeter(chbab).id, 'brahmagiti');
console.log('brahmagiti ច្បាប់ប្រុស score', fb.score.toFixed(2));
// segmentation lessons from the same poem
assert.strictEqual(sy('ប្រយ័ត្ន'), 'ប្រ·យ័ត្ន');               // ័ is a vowel
assert.strictEqual(sy('ប្រពន្ធ'), 'ប្រ·ពន្ធ');                 // silent ្ធ closes ព, not ប្រ
assert.strictEqual(sy('ឪពុកផ្ដាំ'), 'ឪ·ពុក·ផ្ដាំ');            // ផ្ដ starts a syllable
assert.strictEqual(sy('ឆ្កួតល្បែង'), 'ឆ្កួត·ល្បែង');
assert.strictEqual(E.analyze('ទៅកម្សាន្ត').lines[0].count, 3);
assert.strictEqual(sy('ដូចចិត្ត។'), 'ដូច·ចិត្ត');               // ។ is not a consonant
assert.strictEqual(E.analyze('កេរ្តិ៍').lines[0].count, 1);      // ៍ silences
assert.strictEqual(sy('ស្រីស្រដី'), 'ស្រី·ស្រ·ដី');             // ្រ is never silent
// classical rhymes (non-strict only); lyrics keep the strict house rule
const pair = (a, b, strict) => { const s = E.analyze(a + ' ' + b).lines[0].syllables; return E.rhymeKind(s[0], s[1], { strict }); };
for (const [a, b] of [['ក្រោយ', 'ឲ្យ'], ['ងាប់', 'ខ្ជាប់'], ['ទាំ', 'ចាំ'], ['អាល័យ', 'ថ្ងៃ'], ['វិញ', 'ចេញ'], ['កុំ', 'បារម្ភ'], ['ប្អូន', 'ខ្លួន']]) {
  const A = E.analyze(a).lines[0].syllables, B = E.analyze(b).lines[0].syllables;
  assert.ok(E.rhymeKind(A[A.length - 1], B[B.length - 1], { strict: false }), a + '/' + b);
}
assert.strictEqual(pair('វិញ', 'ចេញ', true), null);
console.log('classical rhymes passed');

// Corpus lessons (Khmer Wikipedia poetry category, 13 poems, 5,000+ lines)
const kromngoy = `ពូជខ្លៅមិនសូវប្រាជ្ញ
ពូជកោងកាចមិនសូវស្លូត
ពូជត្រង់ៗរហូត
ពូជភរភូតមិនផុតផៅ ។
ឪពុកម្តាយស្លូតត្រង់
ចិត្តមិនចង់ឲ្យកូនខ្លៅ
ជេរវាយស្តីប្រេដៅ
ឲ្យកូនចៅបានចេះដឹង។
ឪពុកគ្មានតំរិះ
ឃើញកូនចេះមិនដែលខឹង
ឃើញកូនខំប្រិតប្រឹង
ឪពុកដឹងតែងត្រេកអរ។`;                                    // បណ្ដាំក្រមង៉ុយ (ព្រហ្មគីតិ)
const hemchieu = `ត្រកូលជនបទក្បែរភ្នំពេញ
គ្មានចិត្តទោម្នេញប្រើកម្លាំង
ចិញ្ចឹមកូនចៅស្រែចម្បាំង
តតាំងប្រឹថពីក្រតែមាន។
កុមារហែម ចៀវ បឋមវ័យ
ជីវិតមានន័យដ្បិតរស់រាន
ឃុំទំនប់ធំកំណើតស្ពាន
ស្រូវស្រែកល់លានពញាឮ។
បុរាណសម័យខេត្តកណ្តាល
កុមារស្រួចស្រាលនឹងជំងឺ
ស្រឡាញ់វត្តវ៉ាទោះបីឈឺ
រន្ទឺទេសនាត្រងត្រាប់ស្តាប់។`;                              // ប្រវត្តិអាចារ្យ ហែម ចៀវ (ពាក្យ៧)
assert.strictEqual(E.guessMeter(kromngoy).id, 'brahmagiti');
assert.strictEqual(E.guessMeter(hemchieu).id, 'pheak7');
assert.ok(E.fitMeter(kromngoy, 'brahmagiti').stanzas[0].links[2].optional);
for (const [w, want] of [['មិត្រ', 'មិត្រ'], ['បុត្រ', 'បុត្រ'], ['ជាសត្វ', 'ជា·សត្វ'], ['មគ្គផល', 'មគ្គ·ផល'], ['សកល', 'ស·កល'],
  ['នរក', 'ន·រក'], ['រវល់', 'រ·វល់'], ['ពលករ', 'ពល·ករ'], ['ជនជាតិ', 'ជន·ជាតិ'], ['បរទេស', 'បរ·ទេស'], ['រងកម្ម', 'រង·កម្ម']])
  assert.strictEqual(sy(w), want, w);
// a verse with no metre is still not forced into one
assert.strictEqual(E.guessMeter('ច័ន្ទអើយអ្នករះខ្ពស់ម្លេះទេ\nប៉ុន្តែមាសមេអ្នកនៅសែនឆ្ងាយ\nថ្ងៃណាបាននែបនិត្យកាយ'), null);
console.log('corpus lessons passed');

// count range: minor syllables are sung in lyrics but classical poets may leave them out
const rng = E.analyze('ធម្មតាកើតជាមនុស្ស').lines[0];
assert.strictEqual(rng.count, 7); assert.strictEqual(rng.min, 5);
assert.strictEqual(E.analyze('ខ្ញុំស្រលាញ់អូន').lines[0].min, E.analyze('ខ្ញុំស្រលាញ់អូន').lines[0].count - 1);
console.log('count range passed');

// filler words: a hint to re-read for meaning, never a rule
assert.deepStrictEqual(E.analyze('ចិត្តបងរលែកដូចទឹកថ្ងៃឡើង').lines[0].fillers, ['រលែក', 'ថ្ងៃឡើង']);
assert.deepStrictEqual(E.analyze('ម៉ោងដប់យប់ហើយ ភ្លៀងក៏រលឹម').lines[0].fillers, []);
console.log('filler hints passed');

// silent ៍ tails, aspirate subscripts, Pali loanwords
for (const [w, want] of [['ការណ៍', 'ការណ៍'], ['សាសន៍', 'សាសន៍'], ['ប្រយោជន៍', 'ប្រ·យោជន៍'], ['ទុក្ខទោស', 'ទុក្ខ·ទោស'],
  ['ភូមិឃុំ', 'ភូមិ·ឃុំ'], ['រៀនសូត្រ', 'រៀន·សូត្រ'], ['ស័ក្តិ', 'ស័ក្តិ']]) assert.strictEqual(sy(w), want, w);
console.log('loanwords passed');

// a change of form inside one work (ច្បាប់កូនចៅល្បើក: កាកគតិ then ព្រហ្មគីតិ)
const two = E.guessSections(p8full + '\n\n' + chbab);
assert.deepStrictEqual(two.map(s => [s.id, s.from, s.to]), [['pheak8', 1, 4], ['brahmagiti', 5, 10]]);
assert.strictEqual(E.guessSections(chbab), null);                // one form: no sections
assert.strictEqual(sy('ប្រកបការ'), 'ប្រ·កប·ការ');
assert.strictEqual(sy('បុត្រទាំងបី'), 'បុត្រ·ទាំង·បី');
console.log('sections passed');

// hand-off to music: stanzas labelled for Box 2, a repeated stanza is the chorus
const sheet = E.songSheet('ក ខ\nគ ឃ\n\nបន្ទរ មួយ\nបន្ទរ ពីរ\n\nង ច\n\nបន្ទរ  មួយ\nបន្ទរ ពីរ');
assert.strictEqual(sheet.split('\n').filter(l => l.startsWith('[')).join(','), '[Verse 1],[Chorus],[Verse 2],[Chorus]');
assert.strictEqual(E.songSheet('[Intro]\nអូន'), '[Intro]\nអូន');          // already tagged: left as written
assert.strictEqual(E.songSheet('មួយឃ្លា'), '[Verse]\nមួយឃ្លា');
assert.strictEqual(E.songSheet('  '), '');
console.log('song sheet passed');
