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
console.log('kinds', E.rhymeKind({text:'ត្រី',rime:'a',vowel:'ី:'},{text:'ពីរ',rime:'o',vowel:'ី:'}));
// assertions: these must stay true
assert.strictEqual(E.guessMeter(p8).id, 'pheak8');
assert.strictEqual(E.guessMeter(kk).id, 'kakagati');
assert.strictEqual(E.guessMeter('ច័ន្ទអើយអ្នករះខ្ពស់ម្លេះទេ\nប៉ុន្តែមាសមេអ្នកនៅសែនឆ្ងាយ\nថ្ងៃណាបាននែបនិត្យកាយ\nបើនៅឆ្ងាយឈងមិនដល់'), null);
assert.strictEqual(pass, cases.length);
console.log('all assertions passed');
