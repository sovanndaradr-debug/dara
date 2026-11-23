/* Lyric Engine core: analyze(text) -> lines with syllables, counts and rhyme groups.
   One function for one word, one line or a whole song. Rule-based; Khmer and English. */
(function (root) {
  var COENG = '្';
  function isCons(c) { return c >= 'ក' && c <= 'អ'; }
  function isIndepVowel(c) { return c >= 'ឣ' && c <= 'ឳ'; }
  function isDepVowel(c) { return c >= 'ា' && c <= 'ៅ'; }
  function isKhmerMark(c) { return c >= 'ំ' && c <= '៑' || c === '៝'; }
  function isKhmer(c) { return c >= 'ក' && c <= '៿'; }
  var CLOSING = 'ំះៈ';            // nikahit ំ, reahmuk ះ, yuukaleapintu ៈ: syllable already closed
  var FINAL_MARKS = '់៌៍';         // bantoc ់, robat ៌, toandakhiat ៍: marks a final consonant
  var O_SERIES = 'គឃងជឈញឌឍណទធនពភមយរលវ';  // ណ is a-series in modern use, kept simple below
  O_SERIES = O_SERIES.replace('ណ', '');
  // independent vowels written as the dependent vowel they sound like
  var INDEP = { 'ឥ': 'ិ', 'ឦ': 'ី', 'ឧ': 'ុ', 'ឩ': 'ូ', 'ឪ': 'ៅ', 'ឫ': 'ឹ', 'ឬ': 'ឺ', 'ឭ': 'ឹ', 'ឮ': 'ឺ', 'ឯ': 'ែ', 'ឰ': 'ៃ', 'ឱ': 'ោ', 'ឲ': 'ោ', 'ឳ': 'ៅ' };
  var FINAL_CLASS = {};
  [['k', 'កខគឃ'], ['ng', 'ង'], ['c', 'ចឆជឈ'], ['nh', 'ញ'], ['t', 'ដឋឌឍតថទធ'], ['n', 'ណន'],
   ['p', 'បផពភ'], ['m', 'ម'], ['y', 'យ'], ['', 'រ'], ['l', 'លឡ'], ['w', 'វ'], ['h', 'សឝឞហ'], ['', 'អ']]
    .forEach(function (p) { p[1].split('').forEach(function (ch) { FINAL_CLASS[ch] = p[0]; }); });
  // Words whose written form breaks the rules (a silent final vowel). Grows as people correct counts.
  // Words whose written form breaks the rules: their real syllables, written out. Grows as people correct counts.
  var EXCEPTIONS = { 'ជាតិ': ['ជាតិ'], 'ធាតុ': ['ធាតុ'], 'ហេតុ': ['ហេតុ'], 'ប្រវត្តិ': ['ប្រ', 'វត្តិ'],
    'ធម្មតា': ['ធម', 'ម', 'តា'], 'ធម្មជាតិ': ['ធម', 'ម', 'ជាតិ'], 'នគរ': ['ន', 'គរ'], 'សីលធម៌': ['សី', 'ល', 'ធម៌'], 'កន្លែង': ['កន', 'លែង'], 'សិទ្ធិ': ['សិទ្ធិ'], 'សិទិ្ធ': ['សិទិ្ធ'] };

  // 1. Khmer orthographic clusters: base (+ coeng subscripts) + vowels and marks
  function clusters(run) {
    var out = [], i = 0;
    while (i < run.length) {
      var c = run[i], cl = { text: c, base: c, subs: [], vowels: '', marks: '' };
      i++;
      while (i < run.length) {
        var d = run[i];
        if (d === COENG && i + 1 < run.length && isCons(run[i + 1])) { cl.subs.push(run[i + 1]); cl.text += d + run[i + 1]; i += 2; }
        else if (isDepVowel(d)) { cl.vowels += d; cl.text += d; i++; }
        else if (isKhmerMark(d)) { cl.marks += d; cl.text += d; i++; }
        else break;
      }
      out.push(cl);
    }
    return out;
  }
  function hasNucleus(cl) { return cl.vowels.length > 0 || /[ំះៈ]/.test(cl.marks) || isIndepVowel(cl.base); }
  function isFinalMarked(cl) { return !cl.vowels && /[់៌៍]/.test(cl.marks); }

  // 2. Clusters -> syllables. Returns [{text, rime, approx}]
  function khmerSyllables(run) {
    var cls = clusters(run), syl = [], cur = null;
    for (var k = 0; k < cls.length; k++) {
      var cl = cls[k], next = cls[k + 1];
      if (!isCons(cl.base) && !isIndepVowel(cl.base)) continue;
      var canTakeFinal = cur && !cur.closed;
      var bare = !hasNucleus(cl);
      if (cur && cur.nikahitOnly && bare && cl.subs.length === 0 && cl.base === 'ង' && !cur.fin) { attach(cur, cl); continue; }   // ាំង
      if (canTakeFinal && isFinalMarked(cl)) { attach(cur, cl); continue; }
      if (canTakeFinal && bare && cl.subs.length === 0) { attach(cur, cl); continue; }
      if (canTakeFinal && bare && cl.subs.length > 0) {
        // a subscript cluster with no vowel ends the syllable unless a bare consonant follows (សង្គម vs ចន្ទ)
        var nextBare = next && !hasNucleus(next) && !isFinalMarked(next);
        if (!nextBare) { attach(cur, cl); cur.approx = true; continue; }
        cur.approx = true;
      }
      cur = { text: cl.text, base: cl.base, subs: cl.subs.slice(), vowels: cl.vowels, marks: cl.marks, fin: '', closed: /[ំះៈ]/.test(cl.marks), nikahitOnly: /ំ/.test(cl.marks) && !/[ះៈ]/.test(cl.marks), approx: false };
      syl.push(cur);
    }
    function attach(s, cl) { s.text += cl.text; s.fin = cl.base; s.closed = true; }
    return syl.map(function (s) {
      var fin = s.fin ? (FINAL_CLASS[s.fin] !== undefined ? FINAL_CLASS[s.fin] : s.fin) : '';
      var r = khmerRime(s);
      return { text: s.text, rime: r, vowel: r.split(':').slice(1).join(':'),
               onset: s.base + s.subs.join(''), approx: s.approx };
    });
  }
  function khmerRime(s) {
    var series = O_SERIES.indexOf(s.base) >= 0 ? 'o' : 'a';
    if (s.marks.indexOf('៉') >= 0) series = 'a';   // muusikatoan ៉ shifts to a-series
    if (s.marks.indexOf('៊') >= 0) series = 'o';   // triisap ៊ shifts to o-series
    var nasal = s.marks.replace(/[^ំៈ]/g, '');
    var fin = s.fin ? (FINAL_CLASS[s.fin] !== undefined ? FINAL_CLASS[s.fin] : s.fin) : '';
    var v = (s.vowels || '-') + nasal;
    if (isIndepVowel(s.base)) { series = 'a'; v = INDEP[s.base] || s.base; }
    if (/^[\u17BD\u17C0\u17BF]/.test(v)) series = '*';   // ួ ៀ ឿ rhyme across អឃោសៈ / ឃោសៈ (house rule)    // ឯង sounds like -ែង
    if (s.marks.indexOf('ះ') >= 0 && !fin) fin = 'h';                     // ចុះ rhymes with ខុស
    if (series === 'a' && v === '\u17B6\u17C6' && !fin) { v = '-'; fin = 'm'; }
    if (v === '\u17C6' && !fin) { v = '-'; fin = 'm'; }
    return series + ':' + v + ':' + fin;
  }

  // English: vowel groups, minus a silent final e
  function englishSyllables(word) {
    var w = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return [];
    var n = (w.replace(/e$/, '').match(/[aeiouy]+/g) || []).length || 1;
    var m = w.match(/[aeiouy]+[^aeiouy]*$/);
    var rime = 'en:' + (m ? m[0].replace(/e$/, '') : w);
    var out = [];
    for (var i = 0; i < n; i++) out.push({ text: i === n - 1 ? word : '', rime: i === n - 1 ? rime : null, approx: false, en: true });
    out[0].text = word;
    for (var j = 1; j < n; j++) out[j].text = '';
    return out;
  }

  function lineSyllables(line) {
    var out = [];
    // split into Khmer runs and other words
    var re = /[ក-៝]+|[A-Za-z']+/g, m;
    while ((m = re.exec(line))) {
      var run = m[0];
      if (isKhmer(run[0])) {
        // exceptions first, greedy longest match
        var i = 0, buf = '';
        var keys = Object.keys(EXCEPTIONS).sort(function (a, b) { return b.length - a.length; });
        while (i < run.length) {
          var hit = null;
          for (var k = 0; k < keys.length; k++) if (run.substr(i, keys[k].length) === keys[k]) { hit = keys[k]; break; }
          if (hit) {
            if (buf) { out = out.concat(khmerSyllables(buf)); buf = ''; }
            EXCEPTIONS[hit].forEach(function (piece) {
              var ps = khmerSyllables(piece), last = ps[ps.length - 1] || {};
              out.push({ text: piece, rime: last.rime || null, vowel: last.vowel, onset: last.onset, approx: false });
            });
            i += hit.length;
          } else { buf += run[i]; i++; }
        }
        if (buf) out = out.concat(khmerSyllables(buf));
      } else {
        out = out.concat(englishSyllables(run));
      }
    }
    return out;
  }

  // 3. The one function
  function analyze(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (raw) {
      var syl = lineSyllables(raw);
      var visible = syl.filter(function (s) { return s.text; });
      var last = null;
      for (var i = syl.length - 1; i >= 0; i--) if (syl[i].rime) { last = syl[i]; break; }
      return { text: raw, syllables: visible.map(function (s) { return { text: s.text, rime: s.rime }; }),
               count: syl.length, approx: syl.some(function (s) { return s.approx; }), endRime: last ? last.rime : null, group: null,
               techniques: techniques(syl) };
    });
    // rhyme groups: line endings that share a rime with another line ending
    var byRime = {};
    lines.forEach(function (l, i) { if (l.endRime && l.count) (byRime[l.endRime] = byRime[l.endRime] || []).push(i); });
    var groups = [], letters = 'ABCDEFGH';
    Object.keys(byRime).forEach(function (r) { if (byRime[r].length > 1) groups.push({ rime: r, lines: byRime[r] }); });
    groups.sort(function (a, b) { return a.lines[0] - b.lines[0]; });
    groups.forEach(function (g, gi) { g.label = letters[gi % letters.length]; g.lines.forEach(function (li) { lines[li].group = g.label; }); });
    // internal echoes: syllables inside any line that share a group's rime
    var rimeLabel = {};
    groups.forEach(function (g) { rimeLabel[g.rime] = g.label; });
    lines.forEach(function (l) { l.syllables.forEach(function (s) { s.group = rimeLabel[s.rime] || null; }); });
    var counted = lines.filter(function (l) { return l.count; });
    return { lines: lines, groups: groups, totalLines: counted.length,
             totalSyllables: counted.reduce(function (a, l) { return a + l.count; }, 0) };
  }


  /* ---------- Knowledge: Khmer prosody (what the engine has learned) ----------
     Sources: km.wikipedia.org pages for each metre (រង្វាស់កាព្យ, ចំណាប់ជួន, ចង្វាក់, បរិយាកាស);
     studykhmer.com "Khmer Versification: Poetic Meters" for the kinds of rhyme.
     Positions are 1-based: [line, syllable]. "to" may list alternatives (any one is enough). */
  var METERS = [
    { id: 'pheak6', name: 'បទពាក្យ៦', lines: [6, 6, 6, 6], stress: [2, 4], verified: true, use: 'ចង្វាក់លឿន Pop', tempo: ['fast'],
      links: [{ from: [1, 6], to: [[2, 2], [2, 4]] }, { from: [2, 6], to: [[3, 6]] }, { from: [3, 6], to: [[4, 2], [4, 4]] }],
      cross: { from: [4, 6], to: [2, 6] }, mood: '' },
    { id: 'pheak7', name: 'បទពាក្យ៧', lines: [7, 7, 7, 7], stress: [2, 4], verified: true, phrasing: ['2-2-3', '3+4', '4+3'],
      use: 'និទានរឿង មនោសញ្ចេតនា Pop Ballad, R&B, Acoustic', tempo: ['slow', 'mid'],
      links: [{ from: [1, 7], to: [[2, 2], [2, 4], [2, 7]] }, { from: [2, 7], to: [[3, 7]] }, { from: [3, 7], to: [[4, 2], [4, 4], [4, 7]] }],
      cross: { from: [4, 7], to: [2, 7] }, mood: 'គ្រប់បរិយាកាស៖ កំហឹង ទុក្ខសោក ការព្រាត់ប្រាស់ ភាពរីករាយ ការសន្ទនា ធម្មជាតិ' },
    { id: 'pheak8', name: 'បទពាក្យ៨', lines: [8, 8, 8, 8], stress: [3, 5], verified: true, phrasing: ['4+4'],
      use: 'សាច់រឿងធំ វីរភាព ធម៌អប់រំ គុណមាតាបិតា ចម្រៀងប្រជាប្រិយ', tempo: ['mid', 'festive'],
      note: 'សៀវភៅថាព្យាង្គទី៣ ឬទី៥ ប៉ុន្តែកំណាព្យពិត (ឧទាហរណ៍វិគីភីឌា) ជួននៅព្យាង្គទី៤ ដូច្នេះទទួលយក ៣ ៤ ឬ ៥',
      links: [{ from: [1, 8], to: [[2, 3], [2, 4], [2, 5]] }, { from: [2, 8], to: [[3, 8]] }, { from: [3, 8], to: [[4, 3], [4, 4], [4, 5]] }],
      cross: { from: [4, 8], to: [2, 8] }, mood: 'គ្រប់បរិយាកាស' },
    { id: 'kakagati', name: 'បទកាកគតិ', lines: [4, 4, 4, 4, 4, 4, 4], stress: [2], verified: true, use: 'ចង្វាក់លឿន លោតៗ', tempo: ['fast'],
      links: [{ from: [1, 4], to: [[2, 4]] }, { from: [3, 4], to: [[5, 4]] }, { from: [5, 4], to: [[6, 4]] }],
      cross: { from: [7, 4], to: [3, 4] }, mood: 'ពណ៌នាទីកន្លែង តួអង្គ ធម្មជាតិ ផ្តើមរឿង ពេលខ្លះសម្តែងទុក្ខសោក' },
    { id: 'brahmagiti', name: 'បទព្រហ្មគីតិ', lines: [5, 6, 5, 6], stress: [], verified: true, use: 'ការអប់រំ ទូន្មាន បរិយាកាសឧត្តុង្គឧត្តម', tempo: ['festive'],
      note: 'វិគីភីឌា និង studykhmer ថា ៥-៦-៥-៦ ឯកសារម្ចាស់គម្រោងថា ៥-៤-៥-៤៖ ត្រូវការប្រភពមួយទៀត',
      links: [{ from: [1, 5], to: [[2, 3]] }, { from: [2, 6], to: [[3, 5]] }, { from: [3, 5], to: [[4, 3]] }],
      cross: { from: [4, 6], to: [2, 6] }, mood: '' },
    { id: 'phujong', name: 'បទភុជង្គលីលា', lines: [6, 4, 4], stress: [], verified: true, use: 'ភាពរន្ធត់ តានតឹង ការផ្លាស់ប្តូរភ្ញាក់ផ្អើល Hard Trap', tempo: ['fast', 'drama'],
      links: [{ from: [1, 6], to: [[2, 4]] }],
      cross: { from: [3, 4], to: [1, 6] }, mood: '' },
    { id: 'pumnol', name: 'បទពំនោល', lines: [4, 6, 4, 6], stress: [2, 4], verified: false,
      note: 'ប្រភពផ្ទុយគ្នា (៤/៦/៤/៦, ៦/៤/៦, ឬ ៨-៦ តាមឯកសារម្ចាស់គម្រោង)៖ មិនទាន់ប្រើពិនិត្យ', tempo: ['drama'],
      links: [], cross: null, mood: 'កំហឹង ការគំរាមកំហែង ពាក្យអង្វរ ជម្លោះចម្បាំង', use: 'ការបញ្ចេញអារម្មណ៍ខ្លាំងៗ' },
    { id: 'pheak9', name: 'បទពាក្យ៩ (កម្រងកែវ)', lines: null, phrasing: ['3+3+3'], verified: false, links: [], cross: null,
      note: 'ឃ្លាមាន ៩ ព្យាង្គ ចុងជួនប្រទាក់ខាងក្នុង៖ ចំណាប់ជួនពេញលេញមិនទាន់មានប្រភព',
      use: 'មនោសញ្ចេតនាជ្រៅ Melisma 6/8 យឺត ឈុតកម្សត់', tempo: ['slow'] },
    { id: 'kakha', name: 'បទកខ', lines: null, phrasing: ['4-4'], verified: false, links: [], cross: null,
      note: 'ចំណាប់ជួនមិនទាន់មានប្រភព', use: 'អប់រំ', tempo: ['festive'] }
  ];

  /* Which forms suit which tempo (house notes). Meaning still comes first: this is a starting point, not a rule. */
  var TEMPO = {
    slow: { name: 'ចង្វាក់យឺត មនោសញ្ចេតនាជ្រៅ (Ballad, Acoustic, 6/8)', advice: 'ប្រយោគវែងល្មម រូបភាព ឈូករីកកណ្តាលស្រះ ទទះស្ទួន', forms: ['pheak7', 'pheak9', 'free'] },
    mid: { name: 'ចង្វាក់មធ្យម និទានរឿង (Pop, Romvong, R&B)', advice: 'ប្រយោគសន្ទនាធម្មជាតិ ដកដង្ហើមច្បាស់', forms: ['pheak7', 'pheak8'] },
    fast: { name: 'ចង្វាក់លឿន Rap Rock Trap', advice: 'ឃ្លាខ្លី មុតស្រួច បុកចំស្គរ ទទះស្លាប ញ៉ែងញ៉ង', forms: ['kakagati', 'phujong', 'free'] },
    festive: { name: 'ពិធីបុណ្យ ប្រពៃណី អប់រំ', advice: 'ពាក្យមានទម្ងន់ ឆ្លើយឆ្លង លើកទឹកចិត្ត', forms: ['pheak8', 'brahmagiti', 'kakha'] },
    drama: { name: 'ផ្ទុះអារម្មណ៍ខ្លាំង ល្ខោន', advice: 'ទុកចន្លោះផ្អាក ឲ្យភាពស្ងាត់និយាយ', forms: ['pumnol', 'free'] }
  };

  /* Free verse (កម្រងកែវសេរី) sound techniques the engine can see inside one line.
     ញ៉ែងញ៉ង (twisted rhyme) depends on meaning and humour: the engine cannot judge it. */
  function techniques(syl) {
    var out = [], seen = {}, rep = false;
    syl.forEach(function (s) { if (s.text && s.text.length > 1) { if (seen[s.text]) rep = true; seen[s.text] = 1; } });
    if (rep) out.push('ទទះស្ទួន');
    var onsets = {};   // three or more syllables starting with the same consonant cluster (a word like ដដែល alone is not a device)
    syl.forEach(function (s) { if (s.onset) onsets[s.onset] = (onsets[s.onset] || 0) + 1; });
    if (Object.keys(onsets).some(function (k) { return onsets[k] >= 3; })) out.push('ទទះស្លាប');
    var inner = syl.slice(0, -1), rimes = {};
    for (var j = 0; j < inner.length; j++) {
      var r = inner[j].rime; if (!r || /:-:$/.test(r)) continue;
      if (rimes[r] && rimes[r] !== inner[j].text) { out.push('ឈូករីកកណ្តាលស្រះ'); break; }
      rimes[r] = inner[j].text;
    }
    return out;
  }

  /* Kinds of Khmer rhyme (ចួន), strongest first. Near rhymes ("cheater" rhymes) are a poet's last resort:
     the engine never counts them, and never suggests them. */
  /* opts.strict (the house rule, default): អឃោសៈ rhymes only with អឃោសៈ and ឃោសៈ only with ឃោសៈ,
     except ួ ៀ ឿ. Classical verse also accepts a matching written vowel across series (ត្រី / ពីរ),
     so fitMeter reads traditional poems with strict: false. */
  function rhymeKind(a, b, opts) {
    var strict = !opts || opts.strict !== false;
    if (!a || !b || !a.text || !b.text) return null;
    if (a.text === b.text) return 'repeat';                  // the same syllable repeated: allowed, sometimes required
    if (a.rime && a.rime === b.rime) return 'sound';         // same vowel sound, final sound and series
    if (!strict && a.vowel && a.vowel === b.vowel) return 'written';
    return null;
  }

  function syllablesOf(text) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (l) { out = out.concat(lineSyllables(l).filter(function (s) { return s.text; })); });
    return out;
  }
  // Stanzas end at a blank line or at ។ / ៕
  function stanzas(text) {
    return String(text || '').split(/\n\s*\n|[។៕]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  /* Fit a text to one metre. Line breaks are ignored: Khmer often writes two ឃ្លា on one visual line,
     so the stanza's syllables are cut by the metre's own counts. Reports, never corrects. */
  function fitMeter(text, id) {
    var m = METERS.filter(function (x) { return x.id === id; })[0];
    if (!m) return null;
    var need = m.lines.reduce(function (a, b) { return a + b; }, 0);
    var sts = stanzas(text).map(function (t) {
      var syl = syllablesOf(t), lines = [], k = 0;
      m.lines.forEach(function (n) { lines.push(syl.slice(k, k + n)); k += n; });
      var at = function (p) { var l = lines[p[0] - 1]; return l && l[p[1] - 1]; };
      var links = m.links.map(function (ln) {
        var a = at(ln.from), best = null;
        ln.to.forEach(function (p) { var kind = rhymeKind(a, at(p), { strict: false }); if (kind && !best) best = { pos: p, kind: kind }; });
        var near = null;   // rhyme found at a neighbouring syllable instead (common in real verse)
        if (!best && a) ln.to.forEach(function (p) {
          [p[1] - 1, p[1] + 1].forEach(function (q) { var kind = rhymeKind(a, at([p[0], q]), { strict: false }); if (kind && !near && !best) near = { pos: [p[0], q], kind: kind }; });
        });
        return { from: ln.from, fromText: a ? a.text : null, expected: ln.to, found: best, near: near };
      });
      return { syllables: syl.length, expected: need, lines: lines.map(function (l) { return l.map(function (s) { return s.text; }); }), links: links };
    });
    var cross = [];
    if (m.cross) for (var i = 0; i + 1 < sts.length; i++) {
      var A = sts[i].lines[m.cross.from[0] - 1], B = sts[i + 1].lines[m.cross.to[0] - 1];
      var a = A && A[m.cross.from[1] - 1], b = B && B[m.cross.to[1] - 1];
      cross.push({ stanza: i + 1, from: a, to: b, kind: rhymeKind({ text: a, rime: rimeOf(a), vowel: vowelOf(a) }, { text: b, rime: rimeOf(b), vowel: vowelOf(b) }, { strict: false }) });
    }
    var total = 0, ok = 0;
    sts.forEach(function (st) { total += 1 + st.links.length; if (st.syllables === st.expected) ok++; st.links.forEach(function (l) { if (l.found) ok++; else if (l.near) ok += 0.5; }); });
    return { id: m.id, name: m.name, verified: m.verified, note: m.note || '', stanzas: sts, cross: cross, score: total ? ok / total : 0 };
  }
  function rimeOf(t) { if (!t) return null; var s = lineSyllables(t); return s.length ? s[s.length - 1].rime : null; }
  function vowelOf(t) { if (!t) return null; var s = lineSyllables(t); return s.length ? s[s.length - 1].vowel : null; }

  // Which metre is this closest to? Quiet information; returns null unless the fit is clear.
  function guessMeter(text) {
    var best = null;
    METERS.forEach(function (m) { if (!m.verified || !m.lines) return; var f = fitMeter(text, m.id); if (f && (!best || f.score > best.score)) best = f; });
    return best && best.score >= 0.75 ? best : null;
  }

  root.LyricEngine = { analyze: analyze, rhymeKind: rhymeKind, fitMeter: fitMeter, guessMeter: guessMeter, meters: METERS, tempo: TEMPO };
  if (typeof module !== 'undefined') module.exports = root.LyricEngine;
})(typeof window !== 'undefined' ? window : globalThis);
