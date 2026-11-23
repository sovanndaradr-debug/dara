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
  var ONSET_SUBS = 'រលវយនមងញ';
  // consonants that often stand alone as a minor syllable before a vowel syllable: រ·បៀប ក·ន្លែង ស·ម្រាប់ ម·នុស្ស
  var MINOR_ONSETS = 'កគចជតទបពភរលសម';
  // A subscript cluster whose base is a nasal closes the syllable before it (រណ្តៅ ចម្ការ កម្សាន្ត លម្អិត);
  // other bases start a syllable (ពុក·ផ្ដាំ ឆ្កួត·ល្បែង), and so do the common initials ម្ដ ម្ត ម្ច (ម្ដាយ ម្ចាស់)
  function closesBefore(cl) { return 'ងញណនម'.indexOf(cl.base) >= 0 && !(cl.base === 'ម' && 'ដតច'.indexOf(cl.subs[0]) >= 0); }
  var FINAL_CLASS = {};
  [['k', 'កខគឃ'], ['ng', 'ង'], ['c', 'ចឆជឈ'], ['nh', 'ញ'], ['t', 'ដឋឌឍតថទធ'], ['n', 'ណន'],
   ['p', 'បផពភ'], ['m', 'ម'], ['y', 'យ'], ['', 'រ'], ['l', 'លឡ'], ['w', 'វ'], ['h', 'សឝឞហ'], ['', 'អ']]
    .forEach(function (p) { p[1].split('').forEach(function (ch) { FINAL_CLASS[ch] = p[0]; }); });
  // Words whose written form breaks the rules (a silent final vowel). Grows as people correct counts.
  // Words whose written form breaks the rules: their real syllables, written out. Grows as people correct counts.
  var EXCEPTIONS = { 'ជាតិ': ['ជាតិ'], 'ធាតុ': ['ធាតុ'], 'ហេតុ': ['ហេតុ'], 'ប្រវត្តិ': ['ប្រ', 'វត្តិ'],
    'ធម្មតា': ['ធម', 'ម', 'តា'], 'ធម្មជាតិ': ['ធម', 'ម', 'ជាតិ'], 'នគរ': ['ន', 'គរ'], 'ញាតិ': ['ញាតិ'], 'មនុស្ស': ['ម', 'នុស្ស'], 'ភូមិ': ['ភូមិ'], 'កោដិ': ['កោដិ'], 'ស័ក្តិ': ['ស័ក្តិ'], 'ស័ក្ដិ': ['ស័ក្ដិ'], 'សូត្រ': ['សូត្រ'], 'សីលធម៌': ['សី', 'ល', 'ធម៌'], 'កន្លែង': ['កន', 'លែង'], 'សិទ្ធិ': ['សិទ្ធិ'], 'សិទិ្ធ': ['សិទិ្ធ'] };

  // 1. Khmer orthographic clusters: base (+ coeng subscripts) + vowels and marks
  function clusters(run) {
    var out = [], i = 0;
    while (i < run.length) {
      var c = run[i], cl = { text: c, base: c, subs: [], vowels: '', marks: '' };
      i++;
      while (i < run.length) {
        var d = run[i];
        if (d === COENG && i + 1 < run.length && isCons(run[i + 1])) { cl.subs.push(run[i + 1]); cl.text += d + run[i + 1]; i += 2; }
        else if (isDepVowel(d) || d === '\u17D0') { cl.vowels += d; cl.text += d; i++; }   // ័ (short a) acts as a vowel: ប្រ·យ័ត្ន
        else if (isKhmerMark(d)) { cl.marks += d; cl.text += d; i++; }
        else break;
      }
      out.push(cl);
    }
    return out;
  }
  function hasNucleus(cl) { return cl.vowels.length > 0 || /[ំះៈ]/.test(cl.marks) || isIndepVowel(cl.base); }
  function isFinalMarked(cl) { return (!cl.vowels && /[់៌៍]/.test(cl.marks)) || /៍/.test(cl.marks); }   // ៍ silences its vowel too: កេរ្តិ៍

  // 2. Clusters -> syllables. Returns [{text, rime, approx}]
  function khmerSyllables(run) {
    var cls = clusters(run), syl = [], cur = null;
    for (var k = 0; k < cls.length; k++) {
      var cl = cls[k], next = cls[k + 1];
      if (cl.base === '\u17D7') {   // ៗ: repeat the previous syllable
        if (cur) { cur = { text: '\u17D7', base: cur.base, subs: cur.subs.slice(), vowels: cur.vowels, marks: cur.marks, fin: cur.fin, closed: true, approx: true }; syl.push(cur); }
        continue;
      }
      if (!isCons(cl.base) && !isIndepVowel(cl.base)) continue;
      if (cur && /៍/.test(cl.marks) && !cl.vowels.replace('ិ', '').length) { cur.text += cl.text; cur.closed = true; continue; }   // ការ·ណ៍ -> ការណ៍
      var canTakeFinal = cur && !cur.closed;
      var bare = !hasNucleus(cl);
      if (cl.base === '\u17A2' && bare && cl.subs.length === 0 && !isFinalMarked(cl)) canTakeFinal = false;   // អ is never a final (ណ្តៅ|អបាយ)
      if (cur && cur.nikahitOnly && bare && cl.subs.length === 0 && cl.base === 'ង' && !cur.fin) { attach(cur, cl); continue; }   // ាំង
      if (canTakeFinal && isFinalMarked(cl)) { attach(cur, cl); continue; }
      var silentNext = next && isCons(next.base) && next.subs.length && !hasNucleus(next) && !isFinalMarked(next) && ONSET_SUBS.indexOf(next.subs[0]) < 0 && !(cls[k + 2] && (isFinalMarked(cls[k + 2]) || !hasNucleus(cls[k + 2])));
      var n2 = cls[k + 2];
      var closedPair = next && isCons(next.base) && next.subs.length === 0 && (isFinalMarked(next) || !hasNucleus(next)) && (!n2 || hasNucleus(n2) && !isFinalMarked(n2));   // ស·កល ន·រក រ·វល់
      if (canTakeFinal && bare && cl.subs.length === 0 && !cur.vowels && isCons(cur.base) && !silentNext && !closedPair) { attach(cur, cl); continue; }   // ប្រ·កប   // inherent vowel + final: រង, ជន
      if (canTakeFinal && bare && cl.subs.length === 0) {
        // A run of bare consonants after an open syllable pairs up as (onset + final):
        // odd run -> the first one closes the open syllable (រៀ|ន រស់), even run -> they pair (ត្រី|ផង, ប្រើ|អញ, ឱ្យ|យល់)
        var n = 0;
        for (var q = k; q < cls.length; q++) {
          var c2 = cls[q];
          if (c2.base === '\u17A2' && !hasNucleus(c2)) break;
          if (/៍/.test(c2.marks)) break;   // a silent ៍ tail does not count
          if (isCons(c2.base) && c2.subs.length === 0 && !hasNucleus(c2)) { n++; continue; }
          // ង្ស in ពង្ស / វង្ស: a vowel-less subscript cluster is the final of the bare consonant before it
          if (isCons(c2.base) && c2.subs.length && !hasNucleus(c2) && !isFinalMarked(c2) && 'រល'.indexOf(c2.subs[0]) < 0 && !(cls[q + 1] && (isFinalMarked(cls[q + 1]) || !hasNucleus(cls[q + 1])))) n++;   // not គ្រ|ប់
          // ណ in រណ្តៅ, ម in លម្អិត: the base of a following subscript cluster is heard as a final when the
          // subscript is the real onset (a stop); with ្រ ្ល ្វ ្យ ្ន ្ម ្ង ្ញ ្ហ the base is the onset (ក្រុង)
          if (isCons(c2.base) && c2.subs.length && hasNucleus(c2) && closesBefore(c2)) n++;   // ល·ម្អិត, but ពុក·ផ្ដាំ
          break;
        }
        // ...unless the run ends in a likely minor syllable before a vowel syllable: ម្អិ|ត រ·បៀប (not ម្អិ·តរ)
        var after = cls[k + n], lastRun = cls[k + n - 1];
        var minorEnd = n >= 2 && n % 2 === 0 && !!cur.vowels && after && hasNucleus(after) && lastRun && !isFinalMarked(lastRun) && MINOR_ONSETS.indexOf(lastRun.base) >= 0;
        if (n % 2 === 1 || minorEnd) { attach(cur, cl); continue; }
      }
      if (canTakeFinal && bare && cl.subs.length > 0 && !('រល'.indexOf(cl.subs[0]) >= 0 && next && !/^[ិុ]$/.test(cur.vowels))) {   // បុត្រ·ទាំង (after a short vowel ្រ is silent)   // ស្រី·ស្រ·ដី, but មិត្រ បុត្រ (silent at word end)
        // a subscript cluster with no vowel ends the syllable unless a bare consonant follows (សង្គម vs ចន្ទ)
        var nextBare = next && isCons(next.base) && !hasNucleus(next) && !isFinalMarked(next) && next.subs.length === 0;   // សង្គម (ម follows) vs បុណ្យ|អ្នក
        if (!nextBare || cl.subs[0] === cl.base || FINAL_CLASS[cl.subs[0]] === FINAL_CLASS[cl.base]) { attach(cur, cl); cur.approx = true; continue; }   // មគ្គ·ផល
        cur.approx = true;
      }
      var indepClosed = isIndepVowel(cl.base) && cl.subs.length > 0;   // ឲ្យ ឱ្យ end in -y
      cur = { text: cl.text, base: cl.base, subs: cl.subs.slice(), vowels: cl.vowels, marks: cl.marks, fin: '', closed: /[ំះៈ៏]/.test(cl.marks), nikahitOnly: /ំ/.test(cl.marks) && !/[ះៈ]/.test(cl.marks), approx: false };
      if (indepClosed) { cur.closed = true; cur.fin = cl.subs[0]; }
      syl.push(cur);
    }
    function attach(s, cl) { s.text += cl.text; s.fin = cl.base; s.closed = true; }
    return syl.map(function (s, i) {
      // a minor syllable (ម·នុស្ស ក·ម្លាំង ប·ន្លា): bare inherent vowel inside a word; classical poets may count it as half
      var minor = i < syl.length - 1 && !s.vowels && !s.fin && !s.marks && isCons(s.base) && !s.approx;
      var fin = s.fin ? (FINAL_CLASS[s.fin] !== undefined ? FINAL_CLASS[s.fin] : s.fin) : '';
      var r = khmerRime(s);
      return { text: s.text, rime: r, vowel: s.written,
               onset: s.base + s.subs.join(''), approx: s.approx, minor: minor };
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
    s.written = v + ':' + (s.marks.indexOf('ះ') >= 0 && !fin ? 'h' : fin);
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
    line = String(line).replace(/[ \t\u00A0\u200B]+\u17D7/g, '\u17D7');
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
            EXCEPTIONS[hit].forEach(function (piece, pi, all) {
              var ps = khmerSyllables(piece), last = ps[ps.length - 1] || {};
              var minor = pi < all.length - 1 && /^[ក-អ]$/.test(piece);   // ធម·ម·តា ម·នុស្ស
              out.push({ text: piece, rime: last.rime || null, vowel: last.vowel, onset: last.onset, approx: false, minor: minor });
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
      var minors = visible.filter(function (s) { return s.minor; }).length;   // classical poets may leave minor syllables uncounted
      return { text: raw, syllables: visible.map(function (s) { return { text: s.text, rime: s.rime, vowel: s.vowel, minor: !!s.minor }; }),
               count: syl.length, min: syl.length - minors, approx: syl.some(function (s) { return s.approx; }), endRime: last ? last.rime : null, group: null,
               techniques: techniques(syl), fillers: fillersIn(raw) };
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
      samePosition: [[0, 2]],   // វិគីភីឌា៖ បើជួននឹងព្យាង្គ២ ឃ្លា២ ត្រូវជួននឹងព្យាង្គ២ ឃ្លា៤ គ្រប់វគ្គ (ដូចគ្នាសម្រាប់ ៤)
      cross: { from: [4, 7], to: [2, 7] }, mood: 'គ្រប់បរិយាកាស៖ កំហឹង ទុក្ខសោក ការព្រាត់ប្រាស់ ភាពរីករាយ ការសន្ទនា ធម្មជាតិ' },
    { id: 'pheak8', name: 'បទពាក្យ៨', lines: [8, 8, 8, 8], stress: [3, 5], verified: true, phrasing: ['4+4'],
      use: 'សាច់រឿងធំ វីរភាព ធម៌អប់រំ គុណមាតាបិតា ចម្រៀងប្រជាប្រិយ', tempo: ['mid', 'festive'],
      note: 'សៀវភៅថាព្យាង្គទី៣ ឬទី៥ ប៉ុន្តែកំណាព្យពិត (ឧទាហរណ៍វិគីភីឌា) ជួននៅព្យាង្គទី៤ ដូច្នេះទទួលយក ៣ ៤ ឬ ៥',
      links: [{ from: [1, 8], to: [[2, 3], [2, 4], [2, 5]] }, { from: [2, 8], to: [[3, 8]] }, { from: [3, 8], to: [[4, 3], [4, 4], [4, 5]] }],
      cross: { from: [4, 8], to: [2, 8] }, mood: 'គ្រប់បរិយាកាស' },
    { id: 'kakagati', name: 'បទកាកគតិ', lines: [4, 4, 4, 4, 4, 4, 4], stress: [2], verified: true, use: 'ចង្វាក់លឿន លោតៗ', tempo: ['fast'],
      links: [{ from: [1, 4], to: [[2, 4]] }, { from: [3, 4], to: [[5, 4]] }, { from: [5, 4], to: [[6, 4]] }],
      cross: { from: [7, 4], to: [3, 4] }, mood: 'ពណ៌នាទីកន្លែង តួអង្គ ធម្មជាតិ ផ្តើមរឿង ពេលខ្លះសម្តែងទុក្ខសោក' },
    { id: 'brahmagiti', name: 'បទព្រហ្មគីតិ', lines: [5, 6, 5, 6], stress: [2, 3], stressNote: 'ព្យាង្គ២ ក្នុងឃ្លា៥ព្យាង្គ · ព្យាង្គ៣ ក្នុងឃ្លា៦ព្យាង្គ', verified: true, use: 'ការអប់រំ ទូន្មាន បរិយាកាសឧត្តុង្គឧត្តម', tempo: ['festive'],
      note: 'ប្រភព ៤ (វិគីភីឌា studykhmer learnkhmer24 rosveasna) ថា ៥-៦-៥-៦',
      // ១:៥→២:៣ និង ២:៦→៣:៥ ជួនស្ទើរគ្រប់វគ្គ។ ៣:៥→៤:៣ ជាជម្រើស៖ ច្បាប់ប្រុស ៦/៦០ កេរកាលថ្មី ៣៦/១១១ ក្រមង៉ុយ ៣៨/៦៩
      links: [{ from: [1, 5], to: [[2, 3]] }, { from: [2, 6], to: [[3, 5]] }, { from: [3, 5], to: [[4, 3]], optional: true }],
      cross: { from: [4, 6], to: [2, 6] }, mood: 'ភាពលន្លង់លន្លោច ទុក្ខសោក ការព្រាត់ប្រាស ប្រដៅ ផ្តែផ្តាំ ការឈឺចាប់' },
    { id: 'phujong', name: 'បទភុជង្គលីលា', lines: [6, 4, 4], stress: [], verified: true, use: 'ភាពរន្ធត់ តានតឹង ការផ្លាស់ប្តូរភ្ញាក់ផ្អើល Hard Trap', tempo: ['fast', 'drama'],
      links: [{ from: [1, 6], to: [[2, 4]] }],
      cross: { from: [3, 4], to: [1, 6], also: [[2, 4]] }, mood: '' },   // វិគីភីឌា៖ ជួននឹងព្យាង្គ៦ ឃ្លា១ និងព្យាង្គ៤ ឃ្លា២ នៃវគ្គបន្ទាប់
    { id: 'pumnol', name: 'បទពំនោល', lines: [6, 4, 6], stress: [2, 4], verified: true,
      note: 'EBC ថ្នាក់ទី៩ learnkhmer24 khmer-lit rosveasna៖ ៣ឃ្លា ៦-៤-៦ (ផ្នែកខាងលើនៃទំព័រវិគីភីឌាថា ៤-៦-៤-៦ ខុសពីប្រភពផ្សេង)',
      links: [{ from: [1, 6], to: [[2, 4]] }],
      cross: { from: [3, 6], to: [1, 6] }, mood: 'កំហឹង ការគំរាមកំហែង ពាក្យអង្វរ ជម្លោះចម្បាំង', use: 'ការបញ្ចេញអារម្មណ៍ខ្លាំងៗ ល្ខោន', tempo: ['drama'] },
    { id: 'pheak9', name: 'បទពាក្យ៩', lines: [9, 9, 9, 9], stress: [3, 6], phrasing: ['3+3+3'], verified: true,
      links: [{ from: [1, 9], to: [[2, 3]] }, { from: [2, 9], to: [[3, 9]] }, { from: [3, 9], to: [[4, 3]] }],
      cross: { from: [4, 9], to: [2, 9] }, mood: 'មនោសញ្ចេតនា ការឆ្លើយឆ្លងលែបខាយ ស្តីបន្ទោស គំហកគំហឹន',
      use: 'មនោសញ្ចេតនាជ្រៅ Melisma 6/8 យឺត ឈុតកម្សត់', tempo: ['slow'] },
    { id: 'bantolkak', name: 'បទបន្ទោលកាក', lines: [4, 6, 4, 6], stress: [2, 4], verified: true,
      links: [{ from: [1, 4], to: [[2, 2], [2, 4]] }, { from: [2, 6], to: [[3, 4]] }, { from: [3, 4], to: [[4, 2], [4, 4]] }],
      note: 'ព្យាង្គ៤ ឃ្លា១ ជួននឹងព្យាង្គ២ ឬ៤ ឃ្លា២ (វិគីភីឌា)៖ EBC ថា ៤ តែប៉ុណ្ណោះ',
      cross: { from: [4, 6], to: [2, 6] }, mood: 'ការសន្ទនា ផ្តោះផ្តងគ្នាពីរនាក់', use: 'ការឆ្លើយឆ្លង ការសន្ទនា', tempo: ['mid', 'festive'] },
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

  /* Filler words (ពាក្យបំពេញជើងកាព្យ): words often added only to fill a count or close a rhyme.
     A hint to re-read the line for meaning, never a rule: the engine cannot judge meaning. */
  var FILLERS = ['រលែក', 'ពិសក្តៅ', 'ពិសក្ដៅ', 'ត្រួតត្រាល់', 'ថ្ងៃឡើង'];
  function fillersIn(raw) {
    var t = String(raw || '').replace(/[\s\u200B]+/g, '');
    return FILLERS.filter(function (w, i) { return t.indexOf(w) >= 0 && FILLERS.indexOf(w.replace('ដ', 'ត')) === i; });
  }

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
    if (!strict && a.rime && b.rime && classicalKey(a.rime) === classicalKey(b.rime)) return 'classical';
    return null;
  }
  /* Sounds that classical poets rhyme across series, each seen more than once in ច្បាប់ប្រុស (ព្រហ្មគីតិ):
     អាល័យ/ថ្ងៃ, ហ័ស/ណាស់, វិញ/ចេញ, កុំ/បារម្ភ, អប្រិយ/ចី, ប្អូន/ខ្លួន. Not used for lyrics (strict). */
  function classicalKey(r) {
    var p = r.split(':'), se = p[0], v = p[1], f = p[2];
    if (v === '\u17D0' && f === 'y') return 'a:\u17C3:';          // ័យ = ៃ
    if (v === '\u17D0') v = '\u17B6';                            // ័ = short ា
    if (v === '\u17B7' && f === 'y') { v = '\u17B8'; f = ''; }      // ិយ = ី
    if (se === 'o' && v === '\u17B7' && f === 'nh') return 'a:\u17C1:nh';   // វិញ = ចេញ
    if (se === 'a' && v === '\u17BB\u17C6' && !f) return 'o:-:m';  // កុំ = -ម្ភ
    if (v === '\u17BD') v = '\u17BC';                            // ួ ≈ ូ (ប្អូន/ខ្លួន)
    if (se === '*') se = 'a';
    return (v === '\u17BC' ? '*' : se) + ':' + v + ':' + f;
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
      var syl = syllablesOf(t), lines = [], k = 0, merged = 0;
      // Line by line, a line that is too long may fold its minor syllables into the next one (ម·នុស្ស -> មនុស្ស)
      var vis = String(t).split(/\r?\n/).filter(function (l) { return syllablesOf(l).length; });
      if (vis.length === m.lines.length && syl.length !== need) {
        syl = [];
        vis.forEach(function (l, li) {
          var ls = syllablesOf(l);
          for (var j = 0; ls.length > m.lines[li] && j < ls.length - 1; j++) {
            if (ls[j].minor) { var nx = ls[j + 1]; ls.splice(j, 2, { text: ls[j].text + nx.text, rime: nx.rime, vowel: nx.vowel }); merged++; j--; }
          }
          syl = syl.concat(ls);
        });
      }
      m.lines.forEach(function (n) { lines.push(syl.slice(k, k + n)); k += n; });
      var at = function (p) { var l = lines[p[0] - 1]; return l && l[p[1] - 1]; };
      var links = m.links.map(function (ln) {
        var a = at(ln.from), best = null;
        ln.to.forEach(function (p) { var kind = rhymeKind(a, at(p), { strict: false }); if (kind && !best) best = { pos: p, kind: kind }; });
        var near = null;   // rhyme found at a neighbouring syllable instead (common in real verse)
        if (!best && a) ln.to.forEach(function (p) {
          [p[1] - 1, p[1] + 1].forEach(function (q) { var kind = rhymeKind(a, at([p[0], q]), { strict: false }); if (kind && !near && !best) near = { pos: [p[0], q], kind: kind }; });
        });
        return { from: ln.from, fromText: a ? a.text : null, expected: ln.to, found: best, near: near, optional: !!ln.optional };
      });
      var consistency = (m.samePosition || []).map(function (pair) {
        var a = links[pair[0]].found || links[pair[0]].near, b = links[pair[1]].found || links[pair[1]].near;
        return { links: pair, same: !!(a && b && a.pos[1] === b.pos[1]), positions: [a ? a.pos[1] : null, b ? b.pos[1] : null] };
      });
      return { syllables: syl.length, expected: need, merged: merged, lines: lines.map(function (l) { return l.map(function (s) { return s.text; }); }), links: links, consistency: consistency };
    });
    var cross = [];
    if (m.cross) for (var i = 0; i + 1 < sts.length; i++) {
      var A = sts[i].lines[m.cross.from[0] - 1], B = sts[i + 1].lines[m.cross.to[0] - 1];
      var a = A && A[m.cross.from[1] - 1], b = B && B[m.cross.to[1] - 1];
      var mk = function (t) { return { text: t, rime: rimeOf(t), vowel: vowelOf(t) }; };
      var entry = { stanza: i + 1, from: a, to: b, kind: rhymeKind(mk(a), mk(b), { strict: false }) };
      if (m.cross.also) entry.also = m.cross.also.map(function (p) {
        var L = sts[i + 1].lines[p[0] - 1], t = L && L[p[1] - 1];
        return { pos: p, to: t, kind: rhymeKind(mk(a), mk(t), { strict: false }) };
      });
      cross.push(entry);
    }
    var total = 0, ok = 0;
    // an optional link (a rhyme many poets use, not all) earns nothing and costs nothing
    sts.forEach(function (st) { total += 1; if (st.syllables === st.expected) ok++; st.links.forEach(function (l) { if (l.optional) return; total++; if (l.found) ok++; else if (l.near) ok += 0.5; }); });
    return { id: m.id, name: m.name, verified: m.verified, note: m.note || '', stanzas: sts, cross: cross, score: total ? ok / total : 0 };
  }
  function rimeOf(t) { if (!t) return null; var s = lineSyllables(t); return s.length ? s[s.length - 1].rime : null; }
  function vowelOf(t) { if (!t) return null; var s = lineSyllables(t); return s.length ? s[s.length - 1].vowel : null; }

  // Which metre is this closest to? Quiet information; returns null unless the fit is clear.
  function guessMeter(text) {
    var fits = [];
    METERS.forEach(function (m) { if (!m.verified || !m.lines) return; var f = fitMeter(text, m.id); if (f) fits.push(f); });
    fits.sort(function (a, b) { return b.score - a.score; });
    var best = fits[0], second = fits[1] ? fits[1].score : 0;
    if (!best) return null;
    if (best.score >= 0.75) return best;
    // a long real poem is never perfect: from 3 stanzas, a clear lead (twice the next metre) is enough
    if (best.stanzas.length >= 3 && best.score >= 0.45 && best.score >= 2 * second) return best;
    return null;
  }

  /* A long poem or song can change form (ច្បាប់កូនចៅល្បើក: កាកគតិ, then ព្រហ្មគីតិ; a verse and a chorus).
     Best metre per stanza, gaps filled from both sides, one-stanza blips absorbed. Returns the sections
     only when there are at least two, each of 3 stanzas or more; otherwise null (use guessMeter). */
  function guessSections(text) {
    var sts = stanzas(text);
    if (sts.length < 6) return null;
    var ids = sts.map(function (t) {
      var best = null;
      METERS.forEach(function (m) { if (!m.verified || !m.lines) return; var f = fitMeter(t, m.id); if (f && f.score >= 0.6 && (!best || f.score > best.score)) best = { id: m.id, score: f.score }; });
      return best ? best.id : null;
    });
    for (var i = 0; i < ids.length; i++) if (!ids[i]) {
      var a = null, b = null, j;
      for (j = i - 1; j >= 0 && !a; j--) a = ids[j];
      for (j = i + 1; j < ids.length && !b; j++) b = ids[j];
      ids[i] = a && (a === b || !b) ? a : (b && !a ? b : null);
    }
    var runs = [];
    ids.forEach(function (id, k) { var r = runs[runs.length - 1]; if (r && r.id === id) r.to = k + 1; else runs.push({ id: id, from: k + 1, to: k + 1 }); });
    runs = runs.filter(function (r, k) {   // absorb short blips into the run before them
      if (k > 0 && r.to - r.from < 2) { runs[k - 1].to = r.to; return false; } return true;
    }).reduce(function (out, r) { var last = out[out.length - 1]; if (last && last.id === r.id) last.to = r.to; else out.push(r); return out; }, []);
    runs = runs.filter(function (r) { return r.id; }).reduce(function (out, r) { var last = out[out.length - 1]; if (last && last.id === r.id) last.to = r.to; else out.push(r); return out; }, []);
    // A-B-A: a passage sandwiched by the same form is noise (loanwords that miscount), not a change of form
    for (var q = 1; q + 1 < runs.length; q++) if (runs[q - 1].id === runs[q + 1].id) { runs[q - 1].to = runs[q + 1].to; runs.splice(q, 2); q--; }
    if (runs.length < 2 || runs.some(function (r) { return r.to - r.from < 2; })) return null;
    return runs.map(function (r) { var m = METERS.filter(function (x) { return x.id === r.id; })[0]; return { id: r.id, name: m.name, from: r.from, to: r.to }; });
  }

  /* Hand-off to part 2 (music): stanzas (blank-line separated) labelled the way Suno reads them.
     A stanza that comes back word for word is the chorus. Text already tagged [..] is left as written. */
  function songSheet(text) {
    var t = String(text || '').replace(/\r/g, '').replace(/[ \t\u00A0]+$/gm, '').trim();
    if (!t) return '';
    if (/^\s*\[[^\]]+\]\s*$/m.test(t)) return t;
    var sts = t.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var key = function (x) { return x.replace(/\s+/g, ''); }, seen = {};
    sts.forEach(function (x) { seen[key(x)] = (seen[key(x)] || 0) + 1; });
    if (sts.length === 1) return '[Verse]\n' + sts[0];
    var v = 0;
    return sts.map(function (x) { return (seen[key(x)] > 1 ? '[Chorus]' : '[Verse ' + (++v) + ']') + '\n' + x; }).join('\n\n');
  }

  root.LyricEngine = { analyze: analyze, guessSections: guessSections, songSheet: songSheet, rhymeKind: rhymeKind, fitMeter: fitMeter, guessMeter: guessMeter, meters: METERS, tempo: TEMPO, fillers: FILLERS };
  if (typeof module !== 'undefined') module.exports = root.LyricEngine;
})(typeof window !== 'undefined' ? window : globalThis);
