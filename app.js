/* Director's Brief v3 — 화면 동작 */
(function () {
  'use strict';

  var DB = window.DB, PROMPTS = window.PROMPTS, COURSES = window.COURSES || [], EX = window.EXAMPLES || {};
  var M0 = '', M1 = '';
  var body = document.body;

  /* ---------- 저장 ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('db.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('db.' + k, JSON.stringify(v)); } catch (e) { /* 저장할 수 없는 환경 */ } }
  };
  var state = {
    brief: store.get('brief', {}),
    inputs: store.get('inputs', {}),
    fav: new Set(store.get('fav', [])),
    copied: new Set(store.get('copied', [])),
    recent: store.get('recent', []),
    searches: store.get('searches', []),
    courses: store.get('courses', {}),
    mode: store.get('mode', 'explore'),
    principles: store.get('principles', true),
    f: { p: 'all', types: new Set(), outs: new Set() },
    draft: { types: new Set(), outs: new Set() },
    openId: null, courseId: null, bIdx: 0, lib: 'fav'
  };

  var purposeById = {}, ctxByKey = {}, byId = {}, courseById = {};
  DB.purposes.forEach(function (p) { purposeById[p.id] = p; });
  DB.ctx.forEach(function (c, i) { ctxByKey[c.k] = c; c.i = i; });
  COURSES.forEach(function (c) { courseById[c.id] = c; });
  PROMPTS.forEach(function (p) {
    byId[p.id] = p;
    p._hay = [p.id, p.title, p.task, p.role, DB.types[p.t], purposeById[p.p].label, purposeById[p.p].ex, DB.outs[p.out]].concat(p.output).join(' ').toLowerCase();
  });

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var val = function (v) { return (v == null ? '' : String(v)).trim(); };
  var haptic = function () { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* 미지원 */ } };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var I = {
    copy: '<svg class="ic-copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    check: '<svg class="ic-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    done: '<svg class="card__done" viewBox="0 0 16 16" role="img" aria-label="복사한 적 있음"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    get: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor" opacity=".14"/><path d="M6.5 10.2l2.4 2.3 4.6-4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var GOAL_IC = {
    brand: '<circle cx="12" cy="9.5" r="5.5"/><path d="M8.6 13.8L7 21l5-2.6 5 2.6-1.6-7.2"/>',
    convert: '<path d="M3.5 12.6V5A1.5 1.5 0 0 1 5 3.5h7.6l8 8a1.5 1.5 0 0 1 0 2.1l-6.5 6.5a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.6"/>',
    product: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    content: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M10 9.3v5.4l4.6-2.7z"/>',
    persuade: '<path d="M3.5 4.5h17M5 4.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10M12 15.5V20M8.5 20h7M9 12v-2M12 12V8M15 12v-3.5"/>',
    review: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5M8 10.6l2 2 3.6-3.6"/>'
  };

  /* ---------- 조사 처리 ---------- */
  var PCLS = { '이': 'ig', '가': 'ig', '이(가)': 'ig', '은': 'en', '는': 'en', '은(는)': 'en', '을': 'el', '를': 'el', '을(를)': 'el', '과': 'gw', '와': 'gw', '과(와)': 'gw', '으로': 'ro', '로': 'ro', '(으)로': 'ro' };
  var PFORM = { ig: ['이', '가', '이(가)'], en: ['은', '는', '은(는)'], el: ['을', '를', '을(를)'], gw: ['과', '와', '과(와)'], ro: ['으로', '로', '(으)로'] };
  function finalSound(word) {
    var w = String(word).replace(/[\s"'”’)\]}.,!?…]+$/, ''), c = w.charAt(w.length - 1);
    if (!c) return 'none';
    var code = c.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) { var j = (code - 0xAC00) % 28; return j === 0 ? 'none' : (j === 8 ? 'rieul' : 'yes'); }
    if (/[0-9]/.test(c)) return { 0: 'yes', 1: 'rieul', 2: 'none', 3: 'yes', 4: 'none', 5: 'none', 6: 'yes', 7: 'rieul', 8: 'rieul', 9: 'none' }[c];
    c = c.toLowerCase();
    if (c === 'l') return 'rieul';
    return 'mnbkpt'.indexOf(c) > -1 ? 'yes' : 'none';
  }
  function particle(word, cls) { var s = finalSound(word), f = PFORM[cls]; return cls === 'ro' ? (s === 'yes' ? f[0] : f[1]) : (s === 'none' ? f[1] : f[0]); }

  /* ---------- 프롬프트 조립 ---------- */
  function resolve(key, p) {
    if (ctxByKey[key]) return { v: val(state.brief[key]), label: ctxByKey[key].ph };
    var inp = (p.in || []).filter(function (i) { return i.k === key; })[0];
    return { v: val((state.inputs[p.id] || {})[key]), label: inp ? inp.l : key };
  }
  function mark(r) { return r.v ? M0 + 'V' + r.v + M1 : M0 + 'P' + r.label + M1; }
  var RE_TOK = /\{(\w+)\}(이\(가\)|은\(는\)|을\(를\)|과\(와\)|\(으\)로|으로|이|가|은|는|을|를|과|와|로)?/g;
  function fill(text, p) {
    return text.replace(RE_TOK, function (_, k, pt) {
      var r = resolve(k, p), out = mark(r);
      if (!pt) return out;
      var cls = PCLS[pt];
      return out + (r.v ? particle(r.v, cls) : PFORM[cls][2]);
    });
  }
  // 장르가 분명한 과제는 장르 기준, 나머지는 브리프의 톤으로 고른다. 기본은 차분한 금융형
  function pickRef(p) {
    if (['072', '076', '084', '068'].indexOf(p.id) > -1) return 'editorial';
    if (['024', '030', '034', '060', '070'].indexOf(p.id) > -1) return 'lively';
    var tone = String(state.brief.tone || '');
    if (/활기|경쾌|유쾌|발랄|에너지|재미|신나/.test(tone)) return 'lively';
    if (/감성|우아|매거진|에디토리얼|문학|고급|잔잔/.test(tone)) return 'editorial';
    return 'calm';
  }
  function compose(p) {
    var L = ['당신은 ' + p.role + '입니다.', '', '## 프로젝트 맥락'];
    // 브랜드 코어는 선택 칸: 있으면 바꾸지 않고 이어 쓰고, 비어 있으면 전략 프롬프트만 이 과제에서 정한다
    var hasCore = p.ctx.indexOf('core') > -1, coreSet = hasCore && val(state.brief.core), coreMaker = hasCore && !coreSet && p.t === 'strategy';
    p.ctx.forEach(function (k) {
      if (k === 'core') {
        if (coreSet) L.push('- 브랜드 코어: ' + mark(resolve(k, p)) + ' (이미 정한 결정입니다. 바꾸지 말고 이어서 쓰되, 코어의 수치를 다시 나열하지 말고 "코어 기준"이라고만 적으세요)');
        else if (coreMaker) L.push('- 브랜드 코어: 아직 정하지 않음. 이 과제의 결론으로 정하세요');
        return;
      }
      L.push('- ' + ctxByKey[k].label + ': ' + mark(resolve(k, p)));
    });
    L.push('', '## 과제', fill(p.task, p), '', '## 진행 방식');
    var n = 0;
    p.steps.forEach(function (s) { L.push((++n) + '. ' + fill(s, p)); });
    if (p.x) {
      L.push((++n) + '. ' + (state.mode === 'explore'
        ? '먼저 서로 확연히 다른 방향 3가지를 제안하세요. 방향마다 이름, 핵심 근거 1줄, 위험 요소 1줄을 붙이고, 제가 하나를 고르면 그 방향으로 아래 산출물을 완성하세요.'
        : '방향 탐색은 생략하고, 가장 근거가 강한 1안으로 아래 산출물을 완성하세요. 그 안을 고른 이유를 2줄로 덧붙이세요.'));
    }
    L.push('', '## 산출물');
    p.output.forEach(function (o) { L.push('- ' + fill(o, p)); });
    if (p.p === 'convert' && (p.out === 'code' || p.t === 'landing')) L.push('- 주요 버튼의 이벤트 이름(data-event)과, 이 화면 다음에 이어질 수익 행동 1개');
    if (coreMaker) L.push('- 맨 끝에 "브랜드 코어" 4줄: 핵심 개념 / 확정한 태그라인 1개 / 시각 모티프 1개와 쓰는 법 / 확정한 기준(주 행동 색을 포함한 색 역할과 값, 서체, 문구·알림 같은 서비스 행동). 글자 크기·간격 같은 화면 수치는 넣지 마세요. 그건 타이포·컬러 프롬프트가 화면 위계를 보고 정합니다. 다음 프롬프트의 브리프에 그대로 붙여 넣을 수 있게 쓰세요.');
    if (state.principles) {
      L.push('', '## 디렉팅 원칙');
      DB.principles.forEach(function (x) { if (x.when(p)) L.push('- ' + x.line); });
      if (p.out === 'image') L.push('- ' + DB.imageRule);
    }
    if (p.out === 'code' && p.p !== 'brand' && ['044', '053', '063', '091'].indexOf(p.id) < 0) L.push('', DB.visualRefs[pickRef(p)]);
    L.push('', '## 출력 전 자기 검수', '아래 기준으로 결과물을 스스로 점검하고, 통과하지 못한 부분은 고친 결과만 출력하세요. 검수 결과표는 따로 쓰지 마세요.');
    p.checks.forEach(function (c) { L.push('- ' + fill(c, p)); });
    if (p.out === 'code') L.push('- 그대로 열었을 때 깨지지 않는가: 가려짐·잘림·두 줄로 깨진 버튼 없음, 390px 정상, [hidden] 유지, 누를 요소 44px 이상, 본문 15px 이상, 한글 keep-all');
    if (coreSet) L.push('- 브랜드 코어(핵심 개념·태그라인·모티프·수치)와 어긋나는 결정이 없는가. 바꿔야 한다면(예: 사용자가 이미 알아보는 기존 자산과 부딪힐 때) 본문과 섞지 말고 이유와 함께 따로 제안할 것');
    if (DB.scoreWhen(p)) L.push(DB.scoreLine);
    L.push('', '## 사실과 가정');
    L.push('- 프로젝트 맥락에 적힌 사실(수익 모델, 현재 상태, 숫자)은 바꾸거나 다른 가정으로 대신하지 마세요.');
    L.push('- 정보가 부족하면 멈추지 말고 가정하되, 맨 앞에 3개 이내로 모아 적고 본문에서는 [가정]으로 표시하세요.');
    L.push('- 측정하지 않은 효과("3초 안에 이해된다")는 사실이 아니라 목표로 쓰세요. "유일하다"는 비교한 범위 안에서만 주장하세요.');
    L.push('답변은 한국어로, 제목과 표를 써서 구조화하세요.');
    return L.join('\n');
  }
  var RE_P = new RegExp(M0 + 'P([\\s\\S]*?)' + M1, 'g'), RE_V = new RegExp(M0 + 'V([\\s\\S]*?)' + M1, 'g');
  function plain(s) { return s.replace(RE_P, '[$1]').replace(RE_V, '$1'); }
  function html(s) {
    return esc(s).replace(/^## (.*)$/gm, '<span class="h">## $1</span>')
      .replace(RE_P, '<mark class="ph">[$1]</mark>').replace(RE_V, '<mark class="val">$1</mark>');
  }
  function blanks(s) { var seen = {}, m, re = new RegExp(RE_P.source, 'g'); while ((m = re.exec(s))) seen[m[1]] = 1; return Object.keys(seen).length; }
  function markBrackets(s) { return esc(s).replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>'); }

  /* ---------- 공통 조각 ---------- */
  function copyBtn(id, label) { return '<button class="copy-ic" type="button" data-copy="' + id + '" aria-label="' + (label || id + ' 프롬프트 복사') + '">' + I.copy + I.check + '</button>'; }
  function markBtn(id) { return '<button class="mark-ic" type="button" data-mark="' + id + '" aria-pressed="' + state.fav.has(id) + '" aria-label="' + id + ' 보관함에 담기">' + I.mark + '</button>'; }
  function hlText(text, terms) {
    var low = text.toLowerCase(), best = null;
    (terms || []).forEach(function (t) { var at = low.indexOf(t); if (at > -1 && (!best || t.length > best.t.length)) best = { at: at, t: t }; });
    if (!best) return esc(text);
    return esc(text.slice(0, best.at)) + '<mark>' + esc(text.slice(best.at, best.at + best.t.length)) + '</mark>' + esc(text.slice(best.at + best.t.length));
  }
  function rowHTML(id, i, hit) {
    var p = byId[id], title = hit ? hlText(p.title, hit.terms) : esc(p.title);
    return '<li class="row is-in" style="--i:' + Math.min(i, 12) + '"><button class="row__open" type="button" data-open="' + id + '"><span class="row__title">' + title + '</span>' +
      '<span class="row__meta"><b>' + id + '</b> ' + esc(DB.types[p.t]) + '</span>' + (hit && hit.ctx ? '<span class="row__ctx">' + hit.ctx + '</span>' : '') + '</button>' + copyBtn(id) + '</li>';
  }
  function getsText(p) { return plain(fill(p.output[0], p)); }

  /* ---------- 홈: 목적 타일, 코스 ---------- */
  function renderGoals() {
    $('#goals').innerHTML = DB.purposes.map(function (pp, i) {
      var n = PROMPTS.filter(function (p) { return p.p === pp.id; }).length;
      return '<button class="goal" type="button" data-goal="' + pp.id + '" style="--i:' + i + '">' +
        '<span class="goal__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GOAL_IC[pp.id] + '</svg></span>' +
        '<span class="goal__n" aria-hidden="true">' + n + '</span>' +
        '<span class="goal__label">' + esc(pp.label) + '</span><span class="goal__ex">' + esc(pp.ex) + '</span><span class="sr">, 프롬프트 ' + n + '개</span></button>';
    }).join('');
  }
  function courseDone(c) { var d = state.courses[c.id] || []; return c.steps.filter(function (s) { return d.indexOf(s.id) > -1; }).length; }
  function renderCourses() {
    var C = 125.66;
    $('#courses').innerHTML = COURSES.map(function (c, i) {
      var done = courseDone(c), total = c.steps.length;
      return '<button class="course" type="button" data-course="' + c.id + '" style="--i:' + i + '">' +
        '<span class="course__n"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="20"/><circle class="fg" cx="22" cy="22" r="20" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - done / total)).toFixed(1) + '"/></svg>' + total + '</span>' +
        '<span class="course__body"><span class="course__title">' + esc(c.title) + '</span><span class="course__who">' + (done ? done + '/' + total + '단계 진행 중' : esc(c.who)) + '</span></span>' +
        I.chev + '<span class="sr">' + total + '단계 중 ' + done + '단계 완료</span></button>';
    }).join('');
  }

  /* ---------- 레일과 목록 ---------- */
  var rail = $('#rail'), ind = $('#railInd');
  function renderRail() {
    var items = [{ id: 'all', label: '전체' }].concat(DB.purposes.map(function (p) { return { id: p.id, label: p.label }; }));
    $$('.rail__item', rail).forEach(function (b) { b.remove(); });
    rail.insertAdjacentHTML('beforeend', items.map(function (it) {
      return '<button class="rail__item" type="button" data-p="' + it.id + '" aria-pressed="' + (state.f.p === it.id) + '">' + esc(it.label) + '</button>';
    }).join(''));
    moveInd(true);
  }
  function moveInd(instant) {
    var b = $('.rail__item[aria-pressed="true"]', rail); if (!b) return;
    if (instant) ind.style.transition = 'none';
    ind.style.width = b.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
    var left = b.offsetLeft - (rail.clientWidth - b.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: instant || reduced ? 'auto' : 'smooth' });
  }
  function hit(p, f) {
    if (f.p !== 'all' && p.p !== f.p) return false;
    if (f.types.size && !f.types.has(p.t)) return false;
    if (f.outs.size && !f.outs.has(p.out)) return false;
    return true;
  }
  function cardHTML(p, i, animate) {
    var gets = getsText(p), more = p.output.length - 1;
    return '<article class="card' + (state.copied.has(p.id) ? ' is-copied' : '') + (animate && i < 12 ? ' is-in' : '') + '" data-id="' + p.id + '" style="--i:' + i + '">' +
      '<div class="card__main"><div class="card__meta"><span class="card__type">' + esc(DB.types[p.t]) + '</span><span class="card__id">' + p.id + '</span>' + I.done + '</div>' +
      '<h3 class="card__title"><button class="card__open" type="button">' + esc(p.title) + '</button></h3>' +
      '<p class="card__gets"><span class="t">' + esc(gets) + '</span>' + (more > 0 ? '<span class="n">외 ' + more + '개</span>' : '') + '</p></div>' +
      '<div class="card__acts">' + copyBtn(p.id) + markBtn(p.id) + '</div>' +
      '<div class="stamp" aria-hidden="true"><div><b>복사</b><small>' + p.id + '</small></div></div></article>';
  }
  var lastCount = null;
  function renderList(animate) {
    var f = state.f, list = PROMPTS.filter(function (p) { return hit(p, f); });
    renderHead(animate);
    var cnt = $('#listCount');
    cnt.textContent = list.length + '개';
    if (lastCount !== null && lastCount !== list.length && !reduced) { cnt.classList.remove('is-tick'); void cnt.offsetWidth; cnt.classList.add('is-tick'); }
    lastCount = list.length;
    $('#grid').innerHTML = list.map(function (p, i) { return cardHTML(p, i, animate && !reduced); }).join('');
    $('#empty').hidden = list.length > 0;
    var tokens = Array.from(f.types).map(function (t) { return { k: 't', v: t, label: DB.types[t] }; })
      .concat(Array.from(f.outs).map(function (o) { return { k: 'o', v: o, label: DB.outs[o] }; }));
    $('#tokens').hidden = !tokens.length;
    $('#tokens').innerHTML = tokens.map(function (t) {
      return '<button class="token" type="button" data-untoken="' + t.k + ':' + t.v + '" aria-label="' + esc(t.label) + ' 필터 빼기">' + esc(t.label) + I.x + '</button>';
    }).join('') + (tokens.length > 1 ? '<button class="token token--clear" type="button" data-untoken="all">모두 풀기</button>' : '');
    var badge = $('#filterBadge'), n = f.types.size + f.outs.size;
    badge.hidden = !n; badge.textContent = n;
    $('#openFilter').setAttribute('aria-label', n ? '필터 ' + n + '개 적용됨' : '필터');
  }
  var headP = null;
  function renderHead(animate) {
    var p = state.f.p; if (headP === p) return;
    var pp = purposeById[p];
    $('#vTitle').textContent = pp ? pp.label : '전체 프롬프트';
    $('#vSub').textContent = pp ? pp.ex + '. ' + pp.desc + ' 써요.' : '하려는 일, 유형, 결과물로 걸러서 찾으세요.';
    if (headP !== null && animate && !reduced && state.view === 'list') { var t = $('#vHeadText'); t.classList.remove('is-swap'); void t.offsetWidth; t.classList.add('is-swap'); }
    headP = p;
    if (state.view === 'list') document.title = (pp ? pp.label : '전체 프롬프트') + ' · Director\'s Brief';
  }
  function applyPurpose(id) {
    state.f.p = id;
    // 새 목적에 없는 유형은 자동으로 푼다
    state.f.types.forEach(function (t) { if (!PROMPTS.some(function (p) { return (id === 'all' || p.p === id) && p.t === t; })) state.f.types.delete(t); });
    $$('.rail__item', rail).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.p === id); });
  }
  function setPurpose(id, jump) {
    if (state.f.p === id && !jump) return;
    applyPurpose(id);
    moveInd(false);
    renderList(true);
    if (state.view === 'list' && !stack.length) history.replaceState(history.state, '', listHash(id));
    var sentinel = $('#sentinel');
    if (jump || sentinel.getBoundingClientRect().top < 0) window.scrollTo({ top: sentinel.offsetTop + 2, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ---------- 화면: 홈(인덱스) ↔ 목록 ----------
   * 홈의 "하려는 일"과 "전체 100개"는 같은 목록으로 들어가는 다른 입구다.
   * 주소: #list, #list-brand. 뒤로가기로 홈에 돌아온다. */
  var VIEWS = { home: $('#vHome'), list: $('#vList') }, scrollMem = { home: 0, list: 0 };
  state.view = 'home'; state.viewPushed = false;
  function listHash(p) { return '#list' + (p && p !== 'all' ? '-' + p : ''); }
  function homeAnchor(p) { return p === 'all' ? $('#openAll .divider__all-label') : $('#goals [data-goal="' + p + '"] .goal__label'); }
  function onScreen(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; }
  function go(view, o) {
    o = o || {};
    if (view === state.view) { if (view === 'list' && o.p && o.p !== state.f.p) setPurpose(o.p, true); return; }
    var from = state.view, dir = view === 'home' ? 'back' : 'fwd', p = view === 'list' ? (o.p || 'all') : state.f.p;
    if (o.history === 'push') { history.pushState({ view: view }, '', view === 'list' ? listHash(p) : location.pathname + location.search); state.viewPushed = view === 'list'; }
    else if (o.history === 'replace') history.replaceState({ view: view }, '', view === 'list' ? listHash(p) : location.pathname + location.search);
    if (view === 'home') state.viewPushed = false;
    scrollMem[from] = window.scrollY;
    var animate = !o.instant && !reduced;
    var useVT = animate && typeof document.startViewTransition === 'function';
    function swap() {
      VIEWS[from].hidden = true; VIEWS[view].hidden = false;
      body.dataset.view = view; state.view = view;
      if (view === 'list') { applyPurpose(p); renderHead(false); renderList(animate && !useVT); moveInd(true); railEdges(); }
      else document.title = "Director's Brief: 디자인 디렉팅 프롬프트 100";
      window.scrollTo(0, view === 'home' ? scrollMem.home : 0);
    }
    function settle() {
      var f = view === 'list' ? $('#vTitle') : homeAnchor(state.f.p);
      if (f) { if (view === 'home') f = f.closest('button'); f.focus({ preventScroll: true }); }
    }
    if (useVT) {
      // 누른 입구의 이름이 목록 제목 자리로 날아간다 (뒤로 갈 때는 반대로)
      var root = document.documentElement, src = view === 'list' ? homeAnchor(p) : $('#vTitle');
      // 맨 위 줄(처음·보관함)은 전환 전후 모두 화면에 있을 때만 제자리에 고정한다
      var topH = $('.top').offsetHeight, nextY = view === 'home' ? scrollMem.home : 0;
      root.dataset.dir = dir; root.classList.toggle('vt-on', window.scrollY < topH && nextY < topH);
      if (!onScreen(src)) src = null;
      if (src) src.style.viewTransitionName = 'vt-title';
      var dst = null;
      var t = document.startViewTransition(function () {
        if (src) src.style.viewTransitionName = '';
        swap();
        dst = view === 'list' ? $('#vTitle') : homeAnchor(p);
        if (src && onScreen(dst)) dst.style.viewTransitionName = 'vt-title'; else dst = null;
      });
      t.finished.finally(function () { if (dst) dst.style.viewTransitionName = ''; delete root.dataset.dir; root.classList.remove('vt-on'); settle(); });
    } else {
      swap();
      if (animate) { var v = VIEWS[view]; v.classList.remove('is-in-fwd', 'is-in-back'); void v.offsetWidth; v.classList.add('is-in-' + dir); setTimeout(function () { v.classList.remove('is-in-' + dir); }, 460); }
      settle();
    }
    haptic();
  }
  function goHome() {
    if (state.view === 'home') { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
    if (state.viewPushed) history.back(); else go('home', { history: 'replace' });
  }
  function route(instant) {
    var h = (location.hash || '').replace('#', ''), m = /^list(?:-(\w+))?$/.exec(h);
    if (m) { go('list', { p: m[1] && purposeById[m[1]] ? m[1] : 'all', instant: instant }); return; }
    if (!h && state.view !== 'home') go('home', { instant: instant });
    fromHash();
  }

  /* ---------- 토스트 ---------- */
  var toastTimer;
  function toast(msg, sub, action) {
    var t = $('#toast'), a = $('#toastAction');
    $('#toastMsg').innerHTML = esc(msg) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    a.hidden = !action; t.classList.toggle('has-action', !!action);
    a.onclick = action ? function () { action.fn(); hideToast(); } : null;
    if (action) a.textContent = action.label;
    t.classList.remove('is-show'); void t.offsetWidth; t.classList.add('is-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, action ? 4000 : 2400);
  }
  function hideToast() { $('#toast').classList.remove('is-show', 'has-action'); }

  /* ---------- 복사·보관 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  function flashCopy(id) {
    $$('.copy-ic[data-copy="' + id + '"]').forEach(function (b) {
      b.classList.remove('is-done'); void b.offsetWidth; b.classList.add('is-done');
      setTimeout(function () { b.classList.remove('is-done'); }, 1600);
    });
  }
  function copyPrompt(id, quiet) {
    var p = byId[id], composed = compose(p), n = blanks(composed);
    return copyText(plain(composed)).then(function (ok) {
      if (!ok) { toast('복사하지 못했어요', '프롬프트를 길게 눌러 직접 복사해 주세요.'); if (!state.openId) openPrompt(id, true); return false; }
      haptic();
      state.copied.add(id); store.set('copied', Array.from(state.copied));
      state.recent = [id].concat(state.recent.filter(function (x) { return x !== id; })).slice(0, 8); store.set('recent', state.recent);
      flashCopy(id);
      var card = $('.card[data-id="' + id + '"]');
      if (card) { card.classList.add('is-copied'); card.classList.remove('is-stamped'); void card.offsetWidth; card.classList.add('is-stamped'); setTimeout(function () { card.classList.remove('is-stamped'); }, 2000); }
      if (!quiet) toast(id + ' 복사했어요', n ? '빈칸 ' + n + '개는 붙여넣은 뒤 채워 주세요.' : 'Claude에 붙여넣으세요.');
      if (isOpen('libSheet')) renderLib();
      return true;
    });
  }
  function renderLibCount(bump) {
    var n = state.fav.size, el = $('#libCount');
    el.hidden = !n; el.textContent = n;
    if (bump && n) { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); }
  }
  function toggleFav(id) {
    if (state.fav.has(id)) state.fav.delete(id); else state.fav.add(id);
    store.set('fav', Array.from(state.fav));
    var on = state.fav.has(id);
    haptic(); renderLibCount(true);
    $$('.mark-ic[data-mark="' + id + '"]').forEach(function (b) {
      b.setAttribute('aria-pressed', on);
      b.classList.remove('is-pop'); if (on && !reduced) { void b.offsetWidth; b.classList.add('is-pop'); }
    });
    if (state.openId === id) $('#dFav').setAttribute('aria-pressed', on);
    if (isOpen('libSheet')) renderLib();
    toast(on ? '보관함에 담았어요' : '보관함에서 뺐어요', on ? '위쪽 보관함에서 언제든 다시 찾을 수 있어요.' : null, on ? null : { label: '되돌리기', fn: function () { toggleFav(id); } });
  }

  /* ---------- 시트: 뒤로가기로 닫히고 아래로 끌어 닫는다 ---------- */
  var stack = [], focusStack = [], lockY = 0;
  function isOpen(id) { return stack.some(function (x) { return x.id === id; }); }
  function lockScroll() { if (body.classList.contains('is-locked')) return; lockY = window.scrollY; body.style.top = -lockY + 'px'; body.classList.add('is-locked'); }
  function unlockScroll() { body.classList.remove('is-locked'); body.style.top = ''; window.scrollTo(0, lockY); }
  function showSheet(el, push, url) {
    if (stack.indexOf(el) > -1) return;
    el._pushed = !!push;
    if (push) history.pushState({ sheet: el.id }, '', url || location.href);
    focusStack.push(document.activeElement);
    stack.push(el);
    var scrim = $('#scrim');
    scrim.hidden = false; el.hidden = false; el.style.transform = '';
    lockScroll(); body.classList.add('has-drawer');
    void el.offsetWidth;
    scrim.classList.add('is-open'); el.classList.add('is-open');
    el.style.zIndex = 44 + stack.length * 2;
    scrim.style.zIndex = 43 + stack.length * 2;
    if (el.classList.contains('drawer')) {
      el.classList.add('is-entering'); setTimeout(function () { el.classList.remove('is-entering'); }, 700);
      setTimeout(function () {
        if (el.id === 'briefDrawer' && !$('#bStep').hidden) return;
        var c = el.querySelector('[data-close]'); if (c) c.focus({ preventScroll: true });
      }, 80);
    }
  }
  function hideSheet(el) {
    if (stack.indexOf(el) < 0) return;
    stack = stack.filter(function (x) { return x !== el; });
    if (el.classList.contains('is-dragging') || el.style.transform) { el.classList.remove('is-dragging'); el.style.transform = window.innerWidth < 900 ? 'translateY(100%)' : ''; }
    el.classList.remove('is-open');
    setTimeout(function () { if (!el.classList.contains('is-open')) { el.hidden = true; el.style.transform = ''; } }, 380);
    var scrim = $('#scrim');
    if (!stack.length) {
      scrim.classList.remove('is-open');
      setTimeout(function () { if (!stack.length) scrim.hidden = true; }, 260);
      body.classList.remove('has-drawer'); unlockScroll();
    } else { scrim.style.zIndex = 43 + stack.length * 2; }
    if (el.id === 'drawer') state.openId = null;
    if (el.id === 'courseSheet') state.courseId = null;
    if (el.id === 'briefDrawer') { store.set('brief', state.brief); renderBriefBar(); renderList(false); if (state.openId) renderDrawer(); }
    if (el.id === 'drawer' && isOpen('courseSheet')) renderCourse();
    if (el.id === 'filterSheet' && state.pendingApply) {
      state.pendingApply = false; renderList(true);
      requestAnimationFrame(function () { window.scrollTo({ top: $('#sentinel').offsetTop + 2, behavior: reduced ? 'auto' : 'smooth' }); });
    }
    var f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true });
  }
  function requestClose(el) {
    el = el || stack[stack.length - 1]; if (!el) return;
    if (el._pushed) { history.back(); return; }
    hideSheet(el);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('popstate', function (e) {
    var top = stack[stack.length - 1];
    if (top && top._pushed) { hideSheet(top); return; }
    // iOS 사파리처럼 브라우저가 이미 스와이프 전환을 보여줬다면 다시 움직이지 않는다
    route(!!e.hasUAVisualTransition);
  });
  function enableDrag(el) {
    var head = el.querySelector('[data-drag]'), startY = 0, dy = 0, t0 = 0, on = false;
    head.addEventListener('pointerdown', function (e) {
      if (window.innerWidth >= 900 || e.target.closest('button')) return;
      on = true; startY = e.clientY; dy = 0; t0 = Date.now(); el.classList.add('is-dragging');
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    });
    head.addEventListener('pointermove', function (e) {
      if (!on) return;
      var raw = e.clientY - startY;
      dy = raw > 0 ? raw : raw / 6; // 위로는 고무줄처럼 조금만
      el.style.transform = 'translateY(' + dy + 'px)';
    });
    var end = function () {
      if (!on) return; on = false;
      var v = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || (v > 0.6 && dy > 24)) { requestClose(el); return; }
      el.classList.remove('is-dragging'); el.style.transform = '';
    };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  }

  /* ---------- 검색 화면 ---------- */
  var SUGGEST = ['로고', '랜딩', '상세페이지', '피치덱', '앱 화면', '대시보드', '썸네일', '검수'];
  var PICKS = ['001', '019', '039', '073', '087'];
  function openSearch() {
    var s = $('#search');
    showSheet(s, true);
    var q = $('#sq'); q.focus({ preventScroll: true });
    renderSearch();
  }
  function saveSearch(q) {
    q = val(q); if (!q) return;
    state.searches = [q].concat(state.searches.filter(function (x) { return x !== q; })).slice(0, 6);
    store.set('searches', state.searches);
  }
  function renderSearch() {
    var q = val($('#sq').value);
    $('#sqClear').hidden = !q;
    $('#sIdle').hidden = !!q; $('#sResults').hidden = !q;
    if (!q) {
      var out = '';
      if (state.searches.length) out += '<section class="search__sec"><h3>최근 검색<button class="link-btn" type="button" data-clear-searches>지우기</button></h3><div class="search__chips">' +
        state.searches.map(function (s) { return '<button class="schip" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div></section>';
      out += '<section class="search__sec"><h3>이렇게 찾아보세요</h3><div class="search__chips">' +
        SUGGEST.map(function (s) { return '<button class="schip" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div></section>';
      out += '<section class="search__sec"><h3>처음 써 보기 좋은 프롬프트</h3><ul class="rows">' + PICKS.map(function (id, i) { return rowHTML(id, i); }).join('') + '</ul></section>';
      $('#sIdle').innerHTML = out;
      return;
    }
    var res = searchPrompts(q);
    $('#sCount').textContent = res.length ? '"' + q + '" 결과 ' + res.length + '개' : '"' + q + '"에 맞는 프롬프트가 없어요. 아래 말로 찾아보세요.';
    $('#sList').innerHTML = res.length
      ? res.map(function (r, i) { return rowHTML(r.p.id, i, r); }).join('')
      : '<li class="search__chips search__chips--empty">' + SUGGEST.map(function (s) { return '<button class="schip" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</li>';
  }

  /* ---------- 검색 점수: 번호 > 제목 > 유형 > 하려는 일 > 과제 > 받는 것 ---------- */
  var ALIAS = {
    '피치': ['피치덱', '투자'], '투자': ['피치덱', '투자'], 'ir': ['피치덱', '투자'], 'ppt': ['슬라이드', '발표'], '발표자료': ['슬라이드', '발표'], '프레젠테이션': ['슬라이드', '발표'], '덱': ['피치덱', '슬라이드'],
    '홈페이지': ['랜딩페이지', '웹페이지', '히어로'], '웹사이트': ['랜딩페이지', '웹페이지', '히어로'], '사이트': ['랜딩페이지', '웹페이지'], '상페': ['상세페이지'], '상세': ['상세페이지'],
    '인스타': ['sns', '카드뉴스'], '인스타그램': ['sns', '카드뉴스'], '유튜브': ['썸네일', '숏폼'], '릴스': ['숏폼'], '쇼츠': ['숏폼'], '영상': ['숏폼', '스토리보드'],
    '색': ['컬러'], '색상': ['컬러'], '컬러': ['컬러'], '폰트': ['타이포'], '글꼴': ['타이포'], '글씨체': ['타이포'], '서체': ['타이포'],
    '이름': ['네이밍'], '브랜드명': ['네이밍'], '작명': ['네이밍'], '로딩': ['상태', '로딩'], '에러': ['오류', '상태'], '빈화면': ['빈 화면', '상태'],
    '다크': ['다크 모드'], '문구': ['라이팅', '카피', '문구'], '카피': ['카피', '라이팅'], '메일': ['이메일'], '뉴스레터': ['뉴스레터', '이메일'],
    '그래프': ['차트'], '보고서': ['보고'], '검수': ['점검', '감사', '리뷰'], '감사': ['감사', '점검'], '리뷰': ['리뷰', '크리틱', '점검'],
    '캐릭터': ['마스코트'], '결제': ['결제', '페이월', '가격'], '가격': ['가격', '요금제'], '요금': ['요금제', '가격'], '구독': ['페이월', '요금제', '구독'],
    '전단': ['홍보물', '전단'], '메뉴판': ['홍보물'], '앱': ['앱'], '화면': ['화면'], '설문': ['사용자 테스트'], '테스트': ['테스트', '사용자 테스트'],
    '출시': ['출시', '런칭'], '런칭': ['출시'], '주식': ['트레이딩', '투자'], '코인': ['트레이딩'], '여행': ['여행']
  };
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function initials(s) {
    return String(s).split('').map(function (ch) {
      var c = ch.charCodeAt(0);
      return c >= 0xAC00 && c <= 0xD7A3 ? CHO.charAt(Math.floor((c - 0xAC00) / 588)) : ch.toLowerCase();
    }).join('').replace(/\s+/g, '');
  }
  PROMPTS.forEach(function (p) {
    p._f = {
      title: p.title.toLowerCase(), type: DB.types[p.t].toLowerCase(),
      purpose: (purposeById[p.p].label + ' ' + purposeById[p.p].ex).toLowerCase(),
      task: p.task.replace(/\{\w+\}/g, '').toLowerCase(), role: p.role.toLowerCase(),
      out: p.output.join(' / ').toLowerCase(), cho: initials(p.title)
    };
  });
  var W = { title: 100, type: 60, purpose: 40, task: 20, role: 10, out: 8 };
  var HANGUL = /[가-힣]/;
  // 한 글자 검색어는 단어 첫머리에서만, "랜딩"은 "브랜딩" 속에서는 맞지 않게
  function findTerm(text, t) {
    var from = 0, at;
    while ((at = text.indexOf(t, from)) > -1) {
      var prev = text.charAt(at - 1);
      var bad = (t.length === 1 && HANGUL.test(t) && HANGUL.test(prev)) || (t === '랜딩' && prev === '브');
      if (!bad) return at;
      from = at + 1;
    }
    return -1;
  }
  function wordInitials(s) { return String(s).split(/[\s:·,()"'\/]+/).filter(Boolean).map(initials); }
  function choMatch(s, cq) {
    var ws = wordInitials(s);
    for (var i = 0; i < ws.length; i++) { if (ws.slice(i).join('').indexOf(cq) === 0) return i === 0 ? 2 : 1; }
    return 0;
  }
  function snippet(text, term) {
    var low = text.toLowerCase(), at = low.indexOf(term); if (at < 0) return esc(text.slice(0, 40));
    var s = Math.max(0, at - 14), e = Math.min(text.length, at + term.length + 22);
    return (s > 0 ? '…' : '') + esc(text.slice(s, at)) + '<mark>' + esc(text.slice(at, at + term.length)) + '</mark>' + esc(text.slice(at + term.length, e)) + (e < text.length ? '…' : '');
  }
  function searchPrompts(q) {
    var raw = val(q).toLowerCase();
    if (!raw) return [];
    // 초성만 입력했을 때 (예: ㄹㄱ → 로고)
    if (/^[ㄱ-ㅎ\s]+$/.test(raw)) {
      var cq = raw.replace(/\s+/g, '');
      return PROMPTS.map(function (p) {
        var m = choMatch(p.title, cq), mt = choMatch(DB.types[p.t], cq);
        return { p: p, score: m ? (m === 2 ? 120 : 100) : (mt ? 60 : 0), terms: [], ctx: !m && mt ? '유형: ' + esc(DB.types[p.t]) : '' };
      }).filter(function (r) { return r.score; }).sort(function (a, b) { return b.score - a.score || a.p.id.localeCompare(b.p.id); });
    }
    var words = raw.split(/\s+/).filter(Boolean), out = [];
    PROMPTS.forEach(function (p) {
      if (words.length === 1 && /^\d{1,3}$/.test(words[0]) && p.id === words[0].padStart(3, '0')) { out.push({ p: p, score: 1000, terms: [], ctx: '' }); return; }
      var total = 0, terms = [], where = null, ok = words.every(function (w) {
        var cands = [w].concat(ALIAS[w] || []), best = 0, bestF = null, bestT = null, perField = {};
        cands.forEach(function (t, ci) {
          var m = ci === 0 ? 1 : (w.length === 1 ? 1 : 0.8);
          Object.keys(W).forEach(function (f) {
            var at = findTerm(p._f[f], t); if (at < 0) return;
            var sc = W[f] * m + (f === 'title' && at === 0 && t.length > 1 ? 20 : 0);
            perField[f] = Math.max(perField[f] || 0, sc);
            if (sc > best) { best = sc; bestF = f; bestT = t; }
          });
        });
        if (!best) return false;
        // 가장 잘 맞는 곳 + 다른 곳에서도 맞으면 조금 더
        var rest = Object.keys(perField).reduce(function (s, f) { return s + perField[f]; }, 0) - best;
        total += best + rest * 0.25; terms.push(bestT);
        if (!where || W[bestF] > W[where.f]) where = { f: bestF, t: bestT };
        return true;
      });
      if (!ok) return;
      var ctx = '';
      if (where && where.f !== 'title') {
        var label = { type: '유형', purpose: '하려는 일', task: '과제', role: '역할', out: '받는 것' }[where.f];
        var src = { type: DB.types[p.t], purpose: purposeById[p.p].label + ' (' + purposeById[p.p].ex + ')', task: plain(fill(p.task, p)), role: p.role, out: p.output.map(function (o) { return plain(fill(o, p)); }).join(' / ') }[where.f];
        ctx = label + ': ' + snippet(src, where.t);
      }
      out.push({ p: p, score: total, terms: terms, ctx: ctx });
    });
    return out.sort(function (a, b) { return b.score - a.score || a.p.id.localeCompare(b.p.id); });
  }

  /* ---------- 필터 시트 ---------- */
  function openFilter() {
    state.draft = { types: new Set(state.f.types), outs: new Set(state.f.outs) };
    renderFilter(); showSheet($('#filterSheet'), true);
  }
  function renderFilter() {
    var f = state.f, d = state.draft;
    var inPurpose = PROMPTS.filter(function (p) { return f.p === 'all' || p.p === f.p; });
    var tCount = {}, oCount = {};
    inPurpose.forEach(function (p) {
      if (!d.outs.size || d.outs.has(p.out)) tCount[p.t] = (tCount[p.t] || 0) + 1;
      if (!d.types.size || d.types.has(p.t)) oCount[p.out] = (oCount[p.out] || 0) + 1;
    });
    var types = Object.keys(DB.types).filter(function (t) { return inPurpose.some(function (p) { return p.t === t; }); });
    $('#fTypes').innerHTML = types.map(function (t) {
      var on = d.types.has(t), n = tCount[t] || 0;
      return '<button class="optbtn" type="button" data-ft="' + t + '" aria-pressed="' + on + '"' + (!n && !on ? ' disabled' : '') + '>' + I.tick + '<span>' + esc(DB.types[t]) + '</span><small>' + n + '</small></button>';
    }).join('');
    $('#fOuts').innerHTML = Object.keys(DB.outs).map(function (o) {
      var on = d.outs.has(o), n = oCount[o] || 0;
      return '<button class="optbtn" type="button" data-fo="' + o + '" aria-pressed="' + on + '"' + (!n && !on ? ' disabled' : '') + '>' + I.tick + '<span>' + esc(DB.outs[o]) + '</span><small>' + n + '</small></button>';
    }).join('');
    var total = PROMPTS.filter(function (p) { return hit(p, { p: f.p, types: d.types, outs: d.outs }); }).length;
    var nEl = $('#fApplyN');
    if (nEl.textContent !== String(total) && !reduced) { nEl.classList.remove('is-tick'); void nEl.offsetWidth; nEl.classList.add('is-tick'); }
    nEl.textContent = total;
    $('#fApply').disabled = total === 0;
  }

  /* ---------- 보관함 ---------- */
  function renderLib() {
    $$('[data-lib]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.lib === state.lib); });
    roving();
    var ids = state.lib === 'fav' ? Array.from(state.fav).reverse() : state.recent.slice();
    ids = ids.filter(function (id) { return byId[id]; });
    $('#lList').innerHTML = ids.map(function (id, i) { return rowHTML(id, i); }).join('');
    var e = $('#lEmpty'); e.hidden = ids.length > 0;
    e.innerHTML = state.lib === 'fav'
      ? '<b>아직 담은 프롬프트가 없어요</b>카드의 책갈피를 누르면 여기에 모여요.'
      : '<b>아직 복사한 프롬프트가 없어요</b>복사하면 최근 8개가 여기에 남아요.';
  }

  /* ---------- 코스 ---------- */
  function openCourse(id, push) {
    if (!courseById[id]) return;
    state.courseId = id; renderCourse();
    showSheet($('#courseSheet'), push, '#c-' + id);
  }
  function renderCourse() {
    var c = courseById[state.courseId]; if (!c) return;
    var doneIds = state.courses[c.id] || [], done = courseDone(c), total = c.steps.length;
    var nextIdx = -1;
    c.steps.some(function (s, i) { if (doneIds.indexOf(s.id) < 0) { nextIdx = i; return true; } return false; });
    $('#cMeta').innerHTML = '<span class="tag">코스</span><span class="tag">' + total + '단계</span>';
    $('#cTitle').textContent = c.title;
    $('#cWho').textContent = c.who + '에게. ' + c.result + ' 순서대로 받아요.';
    $('#cBar').style.width = (done / total * 100) + '%';
    $('#cProg').textContent = done + ' / ' + total;
    $('#cSteps').innerHTML = c.steps.map(function (s, i) {
      var p = byId[s.id], isDone = doneIds.indexOf(s.id) > -1;
      return '<li class="step' + (isDone ? ' is-done' : '') + (i === nextIdx ? ' is-next' : '') + '">' +
        '<span class="step__n">' + (i + 1) + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '<div class="step__body"><button class="step__title" type="button" data-open="' + s.id + '">' + esc(p.title) + '</button><p class="step__note">' + esc(s.note) + '</p></div>' +
        copyBtn(s.id, (i + 1) + '단계 프롬프트 복사') + '<span class="sr">' + (isDone ? '완료' : '') + '</span></li>';
    }).join('');
    $('#cNext').textContent = nextIdx > -1 ? (nextIdx + 1) + '단계 복사' : '모든 단계를 마쳤어요';
    $('#cNext').disabled = nextIdx < 0;
    $('#cReset').hidden = !done;
  }
  function copyCourseStep(id) {
    var c = courseById[state.courseId], idx = c.steps.map(function (s) { return s.id; }).indexOf(id);
    copyPrompt(id, true).then(function (ok) {
      if (!ok) return;
      var d = state.courses[c.id] || [];
      if (d.indexOf(id) < 0) d.push(id);
      state.courses[c.id] = d; store.set('courses', state.courses);
      renderCourse(); renderCourses();
      var last = courseDone(c) === c.steps.length;
      toast((idx + 1) + '단계 복사했어요', last ? '코스를 모두 마쳤어요. 결과를 같은 대화에서 다듬어 보세요.' : (idx === 0 ? '새 대화에 붙여넣고, 결과가 나오면 다음 단계로 가요.' : '같은 대화에 이어서 붙여넣으세요.'));
    });
  }

  /* ---------- 프롬프트 상세 ---------- */
  function openPrompt(id, push) {
    if (!byId[id]) return;
    var fresh = state.openId !== id;
    state.openId = id;
    renderDrawer(true);
    if (fresh) $('#dBody').scrollTop = 0;
    if (!isOpen('drawer')) showSheet($('#drawer'), push, '#' + id);
  }
  var MODE_LABEL = { explore: '3안 먼저 보기', direct: '바로 완성하기' };
  var MODE_HELP = { explore: '방향 3개를 먼저 받고, 고른 방향으로 완성해요.', direct: '가장 근거가 강한 1안을 바로 받아요.' };
  function syncOpts() {
    $$('.seg [data-mode]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === state.mode); });
    $$('[data-mode-help]').forEach(function (h) { h.textContent = MODE_HELP[state.mode]; });
    $('#dPrinciples').checked = state.principles; $('#bPrinciples').checked = state.principles;
    var p = byId[state.openId];
    if (p) $('#dDiscSum').textContent = (p.x ? MODE_LABEL[state.mode] + ', ' : '') + (state.principles ? '디렉팅 원칙 넣음' : '디렉팅 원칙 뺌');
    roving();
  }
  function renderPreview() {
    var p = byId[state.openId]; if (!p) return;
    var c = compose(p);
    $('#dPrompt').innerHTML = html(c);
    $('#dLines').textContent = c.split('\n').length + '줄';
  }
  function setFold(open, instant) {
    var fold = $('#dFold'), btn = $('#dFoldBtn');
    btn.setAttribute('aria-expanded', open);
    btn.querySelector('span').textContent = open ? '접기' : '전체 보기';
    if (instant) { fold.style.maxHeight = open ? 'none' : ''; fold.classList.toggle('is-open', open); return; }
    if (open) {
      fold.style.maxHeight = fold.scrollHeight + 'px'; fold.classList.add('is-open');
      setTimeout(function () { if (fold.classList.contains('is-open')) fold.style.maxHeight = 'none'; }, 520);
    } else {
      fold.style.maxHeight = fold.scrollHeight + 'px'; void fold.offsetHeight;
      fold.style.maxHeight = ''; fold.classList.remove('is-open');
    }
  }
  function renderBriefRow(p) {
    var used = p.ctx.filter(function (k) { return !ctxByKey[k].optional; }), filled = used.filter(function (k) { return val(state.brief[k]); }), all = filled.length === used.length;
    $('#dBrief').innerHTML = '<p class="brief-row__text"><b>' + (all ? '브리프 정보가 모두 들어가요' : '브리프 ' + used.length + '칸 중 ' + filled.length + '칸이 채워져 있어요') + '</b>' +
      (all ? '내 브리프에서 ' + used.length + '칸을 가져왔어요.' : '비어 있는 칸은 [ ]로 남아요.') + '</p>' +
      '<button class="btn btn--ink brief-row__btn" type="button" id="dEditBrief">' + (all ? '고치기' : '채우기') + '</button>';
    $('#dCtxList').innerHTML = p.ctx.map(function (k) {
      var v = val(state.brief[k]);
      return '<span class="ctx' + (v ? ' ctx--full' : '') + '" title="' + esc(v || '비어 있음') + '">' + (v ? I.tick : '') + esc(ctxByKey[k].label) + '</span>';
    }).join('');
  }
  function renderDrawer(full) {
    var p = byId[state.openId]; if (!p) return;
    if (full) {
      $('#dMeta').innerHTML = '<b>' + p.id + '</b><span class="tag">' + esc(DB.types[p.t]) + '</span><span class="tag">' + esc(DB.outs[p.out]) + '</span>';
      $('#dTitle').textContent = p.title;
      $('#dGets').innerHTML = p.output.map(function (o) { return '<li>' + I.get + '<span>' + esc(plain(fill(o, p))) + '</span></li>'; }).join('');
      var saved = state.inputs[p.id] || {};
      $('#dInputs').innerHTML = (p.in || []).map(function (i) {
        var fid = 'in-' + p.id + '-' + i.k, ex = EX[p.id + '.' + i.k] || '', v = saved[i.k] || '';
        return '<div class="field"><div class="field__head"><label class="field__label" for="' + fid + '">' + esc(i.l) + '</label>' +
          (ex ? '<button class="field__ex" type="button" data-ex="' + i.k + '"' + (val(v) ? ' hidden' : '') + '>예시 넣기</button>' : '') + '</div>' +
          '<textarea class="field__input" id="' + fid + '" data-k="' + i.k + '" rows="2" placeholder="' + esc(ex ? '예: ' + ex : '비워 두면 빈칸으로 남아요') + '">' + esc(v) + '</textarea></div>';
      }).join('');
      $('#dModeWrap').hidden = !p.x;
      var next = p.next || [];
      $('#dNextWrap').hidden = !next.length;
      $('#dNext').innerHTML = next.map(function (t, i) {
        return '<div class="next"><p class="next__text">' + markBrackets(t) + '</p><button class="copy-ic" type="button" data-next="' + i + '" aria-label="다음 단계 프롬프트 복사">' + I.copy + I.check + '</button></div>';
      }).join('');
      $('#dFav').setAttribute('aria-pressed', state.fav.has(p.id));
      var btn = $('#dCopy'); btn.textContent = '프롬프트 복사'; btn.classList.remove('is-done');
      setFold(false, true);
      $('#dDisc').setAttribute('aria-expanded', 'false'); $('#dDiscPanel').classList.remove('is-open');
    }
    renderBriefRow(p); syncOpts(); renderPreview();
  }

  /* ---------- 내 브리프 ---------- */
  function renderBriefBar() {
    var req = DB.ctx.filter(function (c) { return !c.optional; }), filled = req.filter(function (c) { return val(state.brief[c.k]); }).length, total = req.length;
    $('#briefRing').style.strokeDashoffset = (100.5 * (1 - filled / total)).toFixed(1);
    $('#briefStatus').textContent = filled === total ? '모든 프롬프트에 내 정보가 들어가요' : total + '칸 중 ' + filled + '칸 채움';
    $('#briefGo').textContent = filled === total ? '고치기' : (filled ? '이어서' : '채우기');
  }
  function openBrief(startKey) {
    var req = DB.ctx.filter(function (c) { return !c.optional; }), empty = req.filter(function (c) { return !val(state.brief[c.k]); });
    if (startKey && ctxByKey[startKey]) showStep(ctxByKey[startKey].i);
    else if (empty.length === req.length) showStep(0);
    else if (empty.length) showStep(empty[0].i);
    else showSum();
    showSheet($('#briefDrawer'), true);
  }
  function showStep(i) {
    state.bIdx = i;
    var c = DB.ctx[i], total = DB.ctx.length;
    $('#bStep').hidden = false; $('#bSum').hidden = true; $('#bFootStep').hidden = false; $('#bFootSum').hidden = true;
    $('#bBack').hidden = i === 0;
    $('#bBar').style.width = ((i + 1) / total * 100) + '%';
    $('#bCount').textContent = (i + 1) + ' / ' + total;
    $('#bQ').textContent = c.q;
    var input = $('#bInput'); input.value = state.brief[c.k] || ''; input.placeholder = c.hint;
    $('#bHint').textContent = '비워 두고 넘어가도 돼요. 나중에 언제든 고칠 수 있어요.';
    $('#bNext').textContent = i === total - 1 ? '완료' : '다음';
    var step = $('#bStep'); step.classList.remove('is-enter'); void step.offsetWidth; step.classList.add('is-enter');
    setTimeout(function () { input.focus({ preventScroll: true }); autoGrow(input); }, isOpen('briefDrawer') ? 60 : 380);
  }
  function showSum() {
    $('#bStep').hidden = true; $('#bSum').hidden = false; $('#bFootStep').hidden = true; $('#bFootSum').hidden = false; $('#bBack').hidden = true;
    $('#bList').innerHTML = DB.ctx.map(function (c, i) {
      var v = val(state.brief[c.k]);
      return '<li><button class="qsum__item" type="button" data-i="' + i + '"><span class="qsum__body"><span class="qsum__label">' + esc(c.label) + '</span><span class="qsum__val' + (v ? '' : ' is-empty') + '">' + esc(v || '비어 있음') + '</span></span>' + I.chev + '</button></li>';
    }).join('');
    syncOpts();
  }
  function stepNext() {
    store.set('brief', state.brief); renderBriefBar();
    if (state.bIdx < DB.ctx.length - 1) showStep(state.bIdx + 1);
    else { showSum(); toast('브리프를 저장했어요', '이제 모든 프롬프트에 들어가요.'); }
  }
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }

  /* ---------- 기타 렌더 ---------- */
  function renderPrinciples() {
    $('#principleList').innerHTML = DB.principles.map(function (x) { return '<li><div><b>' + esc(x.title) + '</b><span>' + esc(x.body) + '</span></div></li>'; }).join('');
  }
  function renderRuler() {
    var r = $('#ruler'); if (!r || !r.clientWidth) return;
    var w = r.clientWidth, out = '';
    for (var i = 0, x = 0; x <= w - 8; i++, x += 60) out += '<span style="left:' + x + 'px">' + i + '</span>';
    r.innerHTML = out;
  }

  /* ---------- 이벤트 ---------- */
  $('#openSearch').addEventListener('click', openSearch);
  $('#barSearch').addEventListener('click', openSearch);
  $('#openBrief').addEventListener('click', function () { openBrief(); });
  $('#openLib').addEventListener('click', function () { renderLib(); showSheet($('#libSheet'), true); });
  $('#openFilter').addEventListener('click', openFilter);
  $('#scrim').addEventListener('click', function () { requestClose(); });
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { requestClose(b.closest('.drawer, .search')); }); });
  ['drawer', 'courseSheet', 'filterSheet', 'libSheet', 'briefDrawer'].forEach(function (id) { enableDrag($('#' + id)); });

  $('#goals').addEventListener('click', function (e) { var b = e.target.closest('[data-goal]'); if (b) go('list', { p: b.dataset.goal, history: 'push' }); });
  $('#openAll').addEventListener('click', function () { go('list', { p: 'all', history: 'push' }); });
  $('#back').addEventListener('click', goHome);
  $('#brand').addEventListener('click', function (e) { e.preventDefault(); goHome(); });
  $('#courses').addEventListener('click', function (e) { var b = e.target.closest('[data-course]'); if (b) openCourse(b.dataset.course, true); });
  rail.addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) { haptic(); setPurpose(b.dataset.p); } });
  function railEdges() { var fit = rail.scrollWidth <= rail.clientWidth + 2, end = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2; rail.classList.toggle('is-fit', fit); rail.classList.toggle('is-end', end); rail.classList.toggle('is-mid', !end && rail.scrollLeft > 2); }
  rail.addEventListener('scroll', railEdges, { passive: true });
  $('#tokens').addEventListener('click', function (e) {
    var b = e.target.closest('[data-untoken]'); if (!b) return;
    var v = b.dataset.untoken;
    if (v === 'all') { state.f.types.clear(); state.f.outs.clear(); }
    else { var kv = v.split(':'); (kv[0] === 't' ? state.f.types : state.f.outs).delete(kv[1]); }
    renderList(true);
  });
  $('#resetFilters').addEventListener('click', function () { state.f.types.clear(); state.f.outs.clear(); setPurpose('all'); renderList(true); });

  // 카드·줄 공통: 복사, 담기, 열기
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]');
    if (c) {
      var id = c.dataset.copy;
      if (c.closest('#courseSheet')) copyCourseStep(id);
      else { if (c.closest('#search')) saveSearch($('#sq').value); copyPrompt(id); }
      return;
    }
    var m = e.target.closest('[data-mark]'); if (m) { toggleFav(m.dataset.mark); return; }
    var o = e.target.closest('[data-open]');
    if (o) { if (o.closest('#search')) saveSearch($('#sq').value); openPrompt(o.dataset.open, true); return; }
    var card = e.target.closest('.card'); if (card && !e.target.closest('button:not(.card__open)')) openPrompt(card.dataset.id, true);
  });
  var grid = $('#grid');
  grid.addEventListener('pointerdown', function (e) { var card = e.target.closest('.card'); if (card && !e.target.closest('.copy-ic, .mark-ic')) card.classList.add('is-pressed'); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { grid.addEventListener(ev, function () { $$('.card.is-pressed').forEach(function (c) { c.classList.remove('is-pressed'); }); }, true); });

  // 검색
  var sTimer;
  $('#sq').addEventListener('input', function () { clearTimeout(sTimer); sTimer = setTimeout(renderSearch, 90); });
  $('#sq').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveSearch(this.value); this.blur(); } });
  $('#sqClear').addEventListener('click', function () { $('#sq').value = ''; renderSearch(); $('#sq').focus(); });
  $('#sIdle').addEventListener('click', function (e) {
    var q = e.target.closest('[data-q]');
    if (q) { $('#sq').value = q.dataset.q; saveSearch(q.dataset.q); renderSearch(); return; }
    if (e.target.closest('[data-clear-searches]')) { state.searches = []; store.set('searches', []); renderSearch(); }
  });

  // 필터
  $('#fTypes').addEventListener('click', function (e) { var b = e.target.closest('[data-ft]'); if (!b) return; var s = state.draft.types, t = b.dataset.ft; if (s.has(t)) s.delete(t); else s.add(t); haptic(); renderFilter(); });
  $('#fOuts').addEventListener('click', function (e) { var b = e.target.closest('[data-fo]'); if (!b) return; var s = state.draft.outs, o = b.dataset.fo; if (s.has(o)) s.delete(o); else s.add(o); haptic(); renderFilter(); });
  $('#fReset').addEventListener('click', function () { state.draft = { types: new Set(), outs: new Set() }; renderFilter(); });
  $('#fApply').addEventListener('click', function () {
    state.f.types = new Set(state.draft.types); state.f.outs = new Set(state.draft.outs);
    state.pendingApply = true;
    requestClose($('#filterSheet'));
  });

  // 보관함
  $('#libSheet').addEventListener('click', function (e) { var b = e.target.closest('[data-lib]'); if (b) { state.lib = b.dataset.lib; renderLib(); } });

  // 코스
  $('#cNext').addEventListener('click', function () {
    var c = courseById[state.courseId], d = state.courses[c.id] || [];
    var next = c.steps.filter(function (s) { return d.indexOf(s.id) < 0; })[0];
    if (next) copyCourseStep(next.id);
  });
  $('#cShare').addEventListener('click', function () {
    var url = location.origin + location.pathname + '#c-' + state.courseId;
    copyText(url).then(function (ok) { toast(ok ? '코스 링크를 복사했어요' : '복사하지 못했어요', ok ? '팀원이 열면 같은 순서로 따라올 수 있어요.' : url); });
  });
  $('#cReset').addEventListener('click', function () {
    var id = state.courseId, before = (state.courses[id] || []).slice();
    delete state.courses[id]; store.set('courses', state.courses); renderCourse(); renderCourses();
    toast('진행 기록을 지웠어요', null, { label: '되돌리기', fn: function () { state.courses[id] = before; store.set('courses', state.courses); renderCourse(); renderCourses(); } });
  });

  // 상세
  $('#dCopy').addEventListener('click', function () {
    var btn = this;
    copyPrompt(state.openId).then(function (ok) {
      if (!ok) return;
      btn.textContent = '복사했어요'; btn.classList.add('is-done');
      setTimeout(function () { btn.textContent = '프롬프트 복사'; btn.classList.remove('is-done'); }, 1600);
    });
  });
  $('#dShare').addEventListener('click', function () {
    var url = location.origin + location.pathname + '#' + state.openId;
    copyText(url).then(function (ok) { toast(ok ? '링크를 복사했어요' : '복사하지 못했어요', ok ? '받는 사람이 열면 이 프롬프트가 바로 보여요.' : url); });
  });
  $('#dFav').addEventListener('click', function () { toggleFav(state.openId); });
  $('#dFoldBtn').addEventListener('click', function () { setFold(this.getAttribute('aria-expanded') !== 'true'); });
  $('#dDisc').addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') !== 'true';
    this.setAttribute('aria-expanded', open); $('#dDiscPanel').classList.toggle('is-open', open);
  });
  $('#dNext').addEventListener('click', function (e) {
    var b = e.target.closest('[data-next]'); if (!b) return;
    copyText(byId[state.openId].next[+b.dataset.next]).then(function (ok) {
      if (ok) { haptic(); b.classList.remove('is-done'); void b.offsetWidth; b.classList.add('is-done'); setTimeout(function () { b.classList.remove('is-done'); }, 1600); }
      toast(ok ? '다음 단계 프롬프트를 복사했어요' : '복사하지 못했어요', ok ? '첫 결과가 나온 같은 대화에 붙여넣으세요.' : '문장을 길게 눌러 직접 복사해 주세요.');
    });
  });
  $('#dInputs').addEventListener('input', function (e) {
    var k = e.target.dataset.k; if (!k) return;
    var id = state.openId; state.inputs[id] = state.inputs[id] || {}; state.inputs[id][k] = e.target.value;
    store.set('inputs', state.inputs); renderPreview();
    var exb = $('#dInputs [data-ex="' + k + '"]'); if (exb) exb.hidden = !!val(e.target.value);
  });
  $('#dInputs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ex]'); if (!b) return;
    var k = b.dataset.ex, id = state.openId, t = $('#in-' + id + '-' + k), ex = EX[id + '.' + k];
    if (!t || !ex) return;
    t.value = ex; t.classList.remove('is-filled-anim'); void t.offsetWidth; t.classList.add('is-filled-anim');
    state.inputs[id] = state.inputs[id] || {}; state.inputs[id][k] = ex; store.set('inputs', state.inputs);
    b.hidden = true; renderPreview(); haptic();
    toast('예시를 넣었어요', '내 상황에 맞게 고쳐서 쓰세요.');
  });
  $('#dBody').addEventListener('click', function (e) {
    if (!e.target.closest('#dEditBrief')) return;
    var p = byId[state.openId];
    openBrief(p.ctx.filter(function (k) { return !val(state.brief[k]); })[0] || null);
  });

  // 브리프
  var bInput = $('#bInput');
  bInput.addEventListener('input', function () { state.brief[DB.ctx[state.bIdx].k] = bInput.value; autoGrow(bInput); });
  bInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); stepNext(); } });
  $('#bNext').addEventListener('click', stepNext);
  $('#bSkip').addEventListener('click', stepNext);
  $('#bBack').addEventListener('click', function () { if (state.bIdx > 0) showStep(state.bIdx - 1); });
  $('#bList').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) showStep(+b.dataset.i); });
  $('#briefClear').addEventListener('click', function () {
    var before = Object.assign({}, state.brief);
    state.brief = {}; store.set('brief', state.brief); showSum(); renderBriefBar();
    toast('브리프를 비웠어요', null, { label: '되돌리기', fn: function () { state.brief = before; store.set('brief', state.brief); showSum(); renderBriefBar(); } });
  });
  $$('.seg [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { state.mode = b.dataset.mode; store.set('mode', state.mode); syncOpts(); renderPreview(); });
  });
  ['#dPrinciples', '#bPrinciples'].forEach(function (s) {
    $(s).addEventListener('change', function () { state.principles = this.checked; store.set('principles', state.principles); syncOpts(); renderPreview(); });
  });

  // 키보드: 세그먼트와 탭은 좌우 방향키로 이동
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var b = e.target.closest('[role="radio"], [role="tab"]'); if (!b) return;
    var group = b.parentElement, items = $$('[role="radio"], [role="tab"]', group), i = items.indexOf(b);
    var n = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
    e.preventDefault(); n.focus(); n.click();
  });
  function roving() {
    $$('.seg').forEach(function (g) {
      $$('[role="radio"], [role="tab"]', g).forEach(function (x) {
        var on = x.getAttribute('aria-checked') === 'true' || x.getAttribute('aria-selected') === 'true';
        x.tabIndex = on ? 0 : -1;
      });
    });
  }

  // 키보드
  document.addEventListener('keydown', function (e) {
    if (!stack.length) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); openSearch(); }
      return;
    }
    var top = stack[stack.length - 1];
    if (e.key === 'Escape') { e.preventDefault(); requestClose(top); return; }
    if (e.key === 'Tab') {
      var f = $$('button, input, textarea, a[href], [tabindex]:not([tabindex="-1"])', top).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // 고정 막대가 붙으면 배경을 깐다
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      var e = en[0]; $('#bar').classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe($('#sentinel'));
  }
  var rTimer;
  window.addEventListener('resize', function () { clearTimeout(rTimer); rTimer = setTimeout(function () { renderRuler(); moveInd(true); railEdges(); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveInd(true); });

  /* ---------- 시작 ---------- */
  function fromHash() {
    var h = (location.hash || '').replace('#', '');
    if (/^\d{3}$/.test(h) && byId[h] && state.openId !== h) openPrompt(h, false);
    else if (/^c-/.test(h) && courseById[h.slice(2)] && state.courseId !== h.slice(2)) openCourse(h.slice(2), false);
  }
  renderGoals(); renderCourses(); renderRail(); renderList(false);
  renderBriefBar(); renderLibCount(); renderPrinciples(); renderRuler();
  if (/^#list/.test(location.hash)) { body.classList.remove('is-intro'); route(true); history.replaceState({ view: 'list' }, '', location.href); }
  else fromHash();
  window.addEventListener('load', function () {
    body.classList.remove('is-loading'); moveInd(true);
    // 첫 등장 애니메이션은 한 번만: 홈으로 돌아올 때 다시 재생되지 않게
    setTimeout(function () { body.classList.remove('is-intro'); }, 1400);
  });

  window.DirectorsBrief = { compose: function (id) { return plain(compose(byId[id])); }, search: function (q) { return searchPrompts(q).map(function (r) { return r.p.id; }); }, state: state, go: go };
})();
