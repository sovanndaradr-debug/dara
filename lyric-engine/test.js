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
