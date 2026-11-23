/* Director's Brief — 화면 동작 */
(function () {
  'use strict';

  var DB = window.DB;
  var PROMPTS = window.PROMPTS;
  var M0 = '', M1 = ''; // 빈칸·채운 값 표시용 내부 기호
  var body = document.body;

  /* ---------- 저장 ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('db.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('db.' + k, JSON.stringify(v)); } catch (e) { /* 저장할 수 없는 환경은 무시 */ } }
  };

  var state = {
    brief: store.get('brief', {}),
    inputs: store.get('inputs', {}),
    fav: new Set(store.get('fav', [])),
    copied: new Set(store.get('copied', [])),
    recent: store.get('recent', []),
    mode: store.get('mode', 'explore'),
    principles: store.get('principles', true),
    f: { p: 'all', t: 'all', q: '' },
    openId: null,
    bIdx: 0
  };

  var purposeById = {};
  DB.purposes.forEach(function (p) { purposeById[p.id] = p; });
  var ctxByKey = {};
  DB.ctx.forEach(function (c, i) { ctxByKey[c.k] = c; c.i = i; });
  var byId = {};
  PROMPTS.forEach(function (p) {
    byId[p.id] = p;
    p._hay = [p.id, p.title, p.task, p.role, DB.types[p.t], purposeById[p.p].label, DB.outs[p.out]]
      .concat(p.output).join(' ').toLowerCase();
  });

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var val = function (v) { return (v == null ? '' : String(v)).trim(); };
  var haptic = function () { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* 지원하지 않는 기기 */ } };

  var ICON = {
    text: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M3 7h10M3 10.5h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    image: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 11.5l3-3.5 2.2 2.6 1.4-1.4 2.4 2.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4L2.5 8 6 12M10 4l3.5 4L10 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spec: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 6.5h11M6.5 6.5v7" stroke="currentColor" stroke-width="1.5"/></svg>',
    check: '<svg class="card__done" viewBox="0 0 16 16" aria-label="복사한 적 있음" role="img"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"/></svg>',
    chev: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- 조사 처리 (은/는, 이/가, 을/를, 과/와, 으로/로) ---------- */
  var PCLS = { '이': 'ig', '가': 'ig', '이(가)': 'ig', '은': 'en', '는': 'en', '은(는)': 'en', '을': 'el', '를': 'el', '을(를)': 'el', '과': 'gw', '와': 'gw', '과(와)': 'gw', '으로': 'ro', '로': 'ro', '(으)로': 'ro' };
  var PFORM = { ig: ['이', '가', '이(가)'], en: ['은', '는', '은(는)'], el: ['을', '를', '을(를)'], gw: ['과', '와', '과(와)'], ro: ['으로', '로', '(으)로'] };
  function finalSound(word) {
    var w = String(word).replace(/[\s"'”’)\]}.,!?…]+$/, '');
    var c = w.charAt(w.length - 1);
    if (!c) return 'none';
    var code = c.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      var jong = (code - 0xAC00) % 28;
      return jong === 0 ? 'none' : (jong === 8 ? 'rieul' : 'yes');
    }
    if (/[0-9]/.test(c)) return { '0': 'yes', '1': 'rieul', '2': 'none', '3': 'yes', '4': 'none', '5': 'none', '6': 'yes', '7': 'rieul', '8': 'rieul', '9': 'none' }[c];
    c = c.toLowerCase();
    if (c === 'l') return 'rieul';
    if ('mnbkpt'.indexOf(c) > -1) return 'yes';
    return 'none';
  }
  function particle(word, cls) {
    var s = finalSound(word), f = PFORM[cls];
    if (cls === 'ro') return s === 'yes' ? f[0] : f[1];
    return s === 'none' ? f[1] : f[0];
  }

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

  function compose(p) {
    var L = [];
    L.push('당신은 ' + p.role + '입니다.');
    L.push('');
    L.push('## 프로젝트 맥락');
    p.ctx.forEach(function (k) { L.push('- ' + ctxByKey[k].label + ': ' + mark(resolve(k, p))); });
    L.push('');
    L.push('## 과제');
    L.push(fill(p.task, p));
    L.push('');
    L.push('## 진행 방식');
    var n = 0;
    p.steps.forEach(function (s) { L.push((++n) + '. ' + fill(s, p)); });
    if (p.x) {
      L.push((++n) + '. ' + (state.mode === 'explore'
        ? '먼저 서로 확연히 다른 방향 3가지를 제안하세요. 방향마다 이름, 핵심 근거 1줄, 위험 요소 1줄을 붙이고, 제가 하나를 고르면 그 방향으로 아래 산출물을 완성하세요.'
        : '방향 탐색은 생략하고, 가장 근거가 강한 1안으로 아래 산출물을 완성하세요. 그 안을 고른 이유를 2줄로 덧붙이세요.'));
    }
    L.push('');
    L.push('## 산출물');
    p.output.forEach(function (o) { L.push('- ' + fill(o, p)); });
    if (state.principles) {
      var pr = DB.principles.filter(function (x) { return x.when(p); }).map(function (x) { return '- ' + x.line; });
      if (p.out === 'image') pr.push('- ' + DB.imageRule);
      L.push('');
      L.push('## 디렉팅 원칙');
      L = L.concat(pr);
    }
    L.push('');
    L.push('## 출력 전 자기 검수');
    L.push('아래 기준으로 결과물을 스스로 점검하고, 통과하지 못한 항목은 고친 뒤 출력하세요.');
    p.checks.forEach(function (c) { L.push('- ' + fill(c, p)); });
    if (DB.scoreWhen(p)) L.push(DB.scoreLine);
    L.push('정보가 부족하면 멈추지 말고 합리적으로 가정하되, 가정한 부분은 [가정]으로 표시하세요. 답변은 한국어로, 제목과 표를 써서 구조화하세요.');
    return L.join('\n');
  }

  var RE_P = new RegExp(M0 + 'P([\\s\\S]*?)' + M1, 'g');
  var RE_V = new RegExp(M0 + 'V([\\s\\S]*?)' + M1, 'g');
  function plain(s) { return s.replace(RE_P, '[$1]').replace(RE_V, '$1'); }
  function html(s) {
    return esc(s)
      .replace(/^## (.*)$/gm, '<span class="h">## $1</span>')
      .replace(RE_P, '<mark class="ph">[$1]</mark>')
      .replace(RE_V, '<mark class="val">$1</mark>');
  }
  function blanks(s) {
    var seen = {}, m, re = new RegExp(RE_P.source, 'g');
    while ((m = re.exec(s))) seen[m[1]] = 1;
    return Object.keys(seen).length;
  }
  function markBrackets(s) { return esc(s).replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>'); }

  /* ---------- 필터 ---------- */
  function words() { return state.f.q.toLowerCase().split(/\s+/).filter(Boolean); }
  function matchQ(p, ws) { return ws.every(function (w) { return p._hay.indexOf(w) > -1; }); }
  function hit(p, ignoreType) {
    var f = state.f;
    if (f.p === 'fav') { if (!state.fav.has(p.id)) return false; }
    else if (f.p !== 'all' && p.p !== f.p) return false;
    if (!ignoreType && f.t !== 'all' && p.t !== f.t) return false;
    return matchQ(p, words());
  }

  function renderTabs() {
    var ws = words();
    var count = function (fn) { return PROMPTS.filter(function (p) { return fn(p) && matchQ(p, ws); }).length; };
    var items = [{ id: 'all', label: '전체', n: count(function () { return true; }) }]
      .concat(DB.purposes.map(function (pp) { return { id: pp.id, label: pp.label, n: count(function (p) { return p.p === pp.id; }) }; }))
      .concat([{ id: 'fav', label: '즐겨찾기', n: count(function (p) { return state.fav.has(p.id); }) }]);
    $('#tabs').innerHTML = items.map(function (it) {
      return '<button class="tab" type="button" data-p="' + it.id + '" aria-pressed="' + (state.f.p === it.id) + '">' +
        esc(it.label) + '<span class="tab__n">' + it.n + '</span></button>';
    }).join('');
  }

  function renderChips() {
    var pool = PROMPTS.filter(function (p) { return hit(p, true); });
    var counts = {};
    pool.forEach(function (p) { counts[p.t] = (counts[p.t] || 0) + 1; });
    var keys = Object.keys(DB.types).filter(function (k) { return counts[k]; });
    if (state.f.t !== 'all' && !counts[state.f.t]) state.f.t = 'all';
    var out = '<button class="chip" type="button" data-t="all" aria-pressed="' + (state.f.t === 'all') + '">모든 유형<span class="chip__n">' + pool.length + '</span></button>';
    out += keys.map(function (k) {
      return '<button class="chip" type="button" data-t="' + k + '" aria-pressed="' + (state.f.t === k) + '">' + esc(DB.types[k]) + '<span class="chip__n">' + counts[k] + '</span></button>';
    }).join('');
    $('#chips').innerHTML = keys.length ? out : '';
  }

  function cardHTML(p) {
    var fav = state.fav.has(p.id);
    return '<article class="card' + (state.copied.has(p.id) ? ' is-copied' : '') + '" data-id="' + p.id + '">' +
      '<div class="card__top"><span class="card__id">' + p.id + '</span>' + ICON.check +
      '<span class="card__type">' + esc(DB.types[p.t]) + '</span></div>' +
      '<h3 class="card__title"><button class="card__open" type="button">' + esc(p.title) + '</button></h3>' +
      '<p class="card__task">' + html(fill(p.task, p)) + '</p>' +
      '<div class="card__foot"><span class="card__out">' + ICON[p.out] + esc(DB.outs[p.out]) + '</span>' +
      '<button class="card__star" type="button" aria-pressed="' + fav + '" aria-label="' + p.id + ' 즐겨찾기">' + ICON.star + '</button>' +
      '<button class="card__copy" type="button" aria-label="' + p.id + ' 프롬프트 복사">복사</button></div>' +
      '<div class="stamp" aria-hidden="true"><div><b>복사</b><small>' + p.id + '</small></div></div>' +
      '</article>';
  }

  var SUGGEST = ['로고', '랜딩', '상세페이지', '앱 화면', '대시보드', '피치덱', '검수'];
  function renderGrid() {
    var f = state.f;
    var list = PROMPTS.filter(function (p) { return hit(p); });
    $('#grid').innerHTML = list.map(cardHTML).join('');

    var favEmpty = f.p === 'fav' && !f.q && !state.fav.size;
    $('#empty').hidden = list.length > 0;
    if (!list.length) {
      $('#emptyTitle').textContent = favEmpty ? '아직 즐겨찾기한 프롬프트가 없어요' : '찾는 프롬프트가 없어요';
      $('#emptyText').textContent = favEmpty ? '카드의 별을 누르면 여기에 모여요.' : '검색어를 줄이거나 아래 추천어로 찾아보세요.';
      $('#emptySuggest').innerHTML = favEmpty ? '' : SUGGEST.map(function (s) {
        return '<button class="suggest" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('');
    }

    var d;
    if (f.p === 'all') d = '목적 6가지, 유형 22가지로 나눈 프롬프트예요.';
    else if (f.p === 'fav') d = '즐겨찾기한 프롬프트예요.';
    else d = purposeById[f.p].desc + ' 쓰는 프롬프트예요.';
    $('#filterDesc').innerHTML = f.q ? '"' + esc(f.q) + '" 검색 결과 <b>' + list.length + '개</b>' : esc(d) + ' <b>' + list.length + '개</b>';

    renderRecent();
  }

  function renderRecent() {
    var f = state.f;
    var ids = state.recent.filter(function (id) { return byId[id]; });
    var show = f.p === 'all' && f.t === 'all' && !f.q && ids.length > 0;
    $('#recent').hidden = !show;
    if (!show) return;
    $('#recentRow').innerHTML = ids.map(function (id) {
      return '<button class="mini" type="button" data-id="' + id + '"><b>' + id + '</b><span>' + esc(byId[id].title) + '</span></button>';
    }).join('');
  }

  function renderAll() { renderTabs(); renderChips(); renderGrid(); }

  function renderTally(which) {
    $('#copyCount').textContent = state.copied.size;
    $('#favCount').textContent = state.fav.size;
    if (which) {
      var el = $(which === 'copy' ? '#copyCount' : '#favCount').parentNode;
      el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
    }
  }

  function renderBriefCard() {
    var filled = DB.ctx.filter(function (c) { return val(state.brief[c.k]); }).length, total = DB.ctx.length;
    $('#briefRing').style.strokeDashoffset = (100.5 * (1 - filled / total)).toFixed(1);
    $('#briefStatus').textContent = filled === total ? '모두 채웠어요' : total + '칸 중 ' + filled + '칸 채움';
    var brand = val(state.brief.brand);
    $('#briefCardText').innerHTML = filled
      ? (brand ? '<mark class="val">' + esc(brand) + '</mark> 기준으로 ' : '') + '모든 프롬프트의 빈칸이 채워져요. 비어 있는 칸은 <mark class="ph">[ ]</mark>로 남아요.'
      : '한 번만 채우면 100개 프롬프트의 빈칸이 내 서비스 정보로 바뀌어요. 1분이면 돼요.';
    $('#openBrief').textContent = filled ? '고치기' : '채우기';
  }

  function renderPrinciples() {
    $('#principleList').innerHTML = DB.principles.map(function (x) {
      return '<li><div><b>' + esc(x.title) + '</b><span>' + esc(x.body) + '</span></div></li>';
    }).join('');
  }

  function renderRuler() {
    var r = $('#ruler'); if (!r) return;
    var w = r.clientWidth, out = '';
    for (var i = 0, x = 0; x <= w - 8; i++, x += 60) out += '<span style="left:' + x + 'px">' + i + '</span>';
    r.innerHTML = out;
  }

  /* ---------- 토스트 ---------- */
  var toastTimer;
  function toast(msg, sub, action) {
    var t = $('#toast'), a = $('#toastAction');
    $('#toastMsg').innerHTML = esc(msg) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    a.hidden = !action;
    t.classList.toggle('has-action', !!action);
    a.onclick = action ? function () { action.fn(); hideToast(); } : null;
    if (action) a.textContent = action.label;
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 4000 : 2400);
  }
  function hideToast() { var t = $('#toast'); t.classList.remove('is-show', 'has-action'); }

  /* ---------- 복사 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }

  function copyPrompt(id) {
    var p = byId[id], composed = compose(p), n = blanks(composed);
    return copyText(plain(composed)).then(function (ok) {
      if (!ok) { toast('복사하지 못했어요', '프롬프트를 길게 눌러 직접 복사해 주세요.'); if (!state.openId) openPrompt(id, true); return false; }
      haptic();
      state.copied.add(id); store.set('copied', Array.from(state.copied));
      state.recent = [id].concat(state.recent.filter(function (x) { return x !== id; })).slice(0, 8);
      store.set('recent', state.recent);
      renderTally('copy');
      var card = document.querySelector('.card[data-id="' + id + '"]');
      if (card) {
        card.classList.add('is-copied');
        card.classList.remove('is-stamped'); void card.offsetWidth; card.classList.add('is-stamped');
        setTimeout(function () { card.classList.remove('is-stamped'); }, 2000);
      }
      if (!state.openId) renderRecent();
      toast(id + ' 복사했어요', n ? '빈칸 ' + n + '개는 붙여넣은 뒤 채워 주세요.' : 'Claude에 붙여넣으세요.');
      return true;
    });
  }

  function toggleFav(id, btn) {
    if (state.fav.has(id)) state.fav.delete(id); else state.fav.add(id);
    store.set('fav', Array.from(state.fav));
    var on = state.fav.has(id);
    renderTally('fav'); haptic();
    $$('.card[data-id="' + id + '"] .card__star').forEach(function (b) {
      b.setAttribute('aria-pressed', on);
      if (on) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
    });
    if (state.openId === id) $('#dFav').setAttribute('aria-pressed', on);
    if (state.f.p === 'fav' && !state.openId) renderAll(); else renderTabs();
    toast(on ? '즐겨찾기에 담았어요' : '즐겨찾기에서 뺐어요', null, on ? null : { label: '되돌리기', fn: function () { toggleFav(id); } });
  }

  /* ---------- 시트: 뒤로가기로 닫히고, 아래로 끌어 닫는다 ---------- */
  var stack = [], focusStack = [], lockY = 0;
  function lockScroll() {
    if (body.classList.contains('is-locked')) return;
    lockY = window.scrollY; body.style.top = -lockY + 'px'; body.classList.add('is-locked');
  }
  function unlockScroll() {
    body.classList.remove('is-locked'); body.style.top = ''; window.scrollTo(0, lockY);
  }
  function showSheet(el, push, url) {
    if (stack.indexOf(el) > -1) return;
    el._pushed = !!push;
    if (push) history.pushState({ sheet: el.id }, '', url || location.href);
    focusStack.push(document.activeElement);
    stack.push(el);
    var scrim = $('#scrim');
    scrim.hidden = false; el.hidden = false; el.style.transform = '';
    lockScroll();
    body.classList.add('has-drawer');
    void el.offsetWidth;
    scrim.classList.add('is-open'); el.classList.add('is-open');
    el.style.zIndex = 41 + stack.length;
    setTimeout(function () {
      if (el.id === 'briefDrawer' && !$('#bStep').hidden) return;
      var c = el.querySelector('[data-close]'); if (c) c.focus({ preventScroll: true });
    }, 80);
  }
  function hideSheet(el) {
    if (stack.indexOf(el) < 0) return;
    stack = stack.filter(function (x) { return x !== el; });
    if (el.classList.contains('is-dragging') || el.style.transform) { el.classList.remove('is-dragging'); el.style.transform = window.innerWidth < 900 ? 'translateY(100%)' : ''; }
    el.classList.remove('is-open');
    setTimeout(function () { if (!el.classList.contains('is-open')) { el.hidden = true; el.style.transform = ''; } }, 380);
    if (!stack.length) {
      $('#scrim').classList.remove('is-open');
      setTimeout(function () { if (!stack.length) $('#scrim').hidden = true; }, 260);
      body.classList.remove('has-drawer');
      unlockScroll();
    }
    if (el.id === 'drawer') state.openId = null;
    if (el.id === 'briefDrawer') {
      store.set('brief', state.brief);
      renderBriefCard(); renderGrid();
      if (state.openId) renderDrawer();
    }
    var f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true });
  }
  function requestClose(el) {
    el = el || stack[stack.length - 1]; if (!el) return;
    if (el._pushed) { history.back(); return; }
    hideSheet(el);
    if (el.id === 'drawer' && location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('popstate', function () {
    var top = stack[stack.length - 1];
    if (top && top._pushed) { hideSheet(top); return; }
    fromHash();
  });

  function enableDrag(el) {
    var head = el.querySelector('[data-drag]'), startY = 0, dy = 0, t0 = 0, on = false;
    head.addEventListener('pointerdown', function (e) {
      if (window.innerWidth >= 900 || e.target.closest('button')) return;
      on = true; startY = e.clientY; dy = 0; t0 = Date.now();
      el.classList.add('is-dragging');
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    });
    head.addEventListener('pointermove', function (e) {
      if (!on) return;
      dy = Math.max(0, e.clientY - startY);
      el.style.transform = 'translateY(' + dy + 'px)';
    });
    var end = function () {
      if (!on) return; on = false;
      var v = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || (v > 0.6 && dy > 24)) { requestClose(el); return; }
      el.classList.remove('is-dragging'); el.style.transform = '';
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }

  /* ---------- 상세 ---------- */
  function openPrompt(id, push) {
    if (!byId[id]) return;
    state.openId = id;
    renderDrawer(true);
    $('#dBody').scrollTop = 0;
    if ($('#drawer').hidden || !$('#drawer').classList.contains('is-open')) showSheet($('#drawer'), push, '#' + id);
  }

  var MODE_HELP = { explore: '방향 3개를 먼저 받고, 고른 방향으로 완성해요.', direct: '가장 근거가 강한 1안을 바로 받아요.' };
  function syncOpts() {
    $$('.seg [data-mode]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === state.mode); });
    $$('[data-mode-help]').forEach(function (h) { h.textContent = MODE_HELP[state.mode]; });
    $('#dPrinciples').checked = state.principles;
    $('#bPrinciples').checked = state.principles;
  }

  function renderPreview() {
    var p = byId[state.openId]; if (!p) return;
    $('#dPrompt').innerHTML = html(compose(p));
  }

  function renderBriefRow(p) {
    var used = p.ctx, filled = used.filter(function (k) { return val(state.brief[k]); });
    var all = filled.length === used.length;
    $('#dBrief').innerHTML =
      '<p class="brief-row__text"><b>' + (all ? '브리프 정보가 모두 들어가요' : '브리프 ' + used.length + '칸 중 ' + filled.length + '칸이 채워져 있어요') + '</b>' +
      (all ? '내 브리프에서 ' + used.length + '칸을 가져왔어요.' : '비어 있는 칸은 [ ]로 남아요.') + '</p>' +
      '<button class="btn btn--ink brief-row__btn" type="button" id="dEditBrief">' + (all ? '고치기' : '채우기') + '</button>';
    var chips = used.map(function (k) {
      var v = val(state.brief[k]);
      return '<span class="ctx' + (v ? ' ctx--full' : '') + '" title="' + esc(v || '비어 있음') + '">' + (v ? ICON.tick : '') + esc(ctxByKey[k].label) + '</span>';
    }).join('');
    var list = $('#dCtxList');
    if (!list) { list = document.createElement('div'); list.className = 'ctx-list'; list.id = 'dCtxList'; $('#dBrief').after(list); }
    list.innerHTML = chips;
  }

  function renderDrawer(full) {
    var p = byId[state.openId]; if (!p) return;
    if (full) {
      $('#dMeta').innerHTML = '<span class="card__id">' + p.id + '</span><span class="tag tag--purpose">' + esc(purposeById[p.p].label) + '</span><span class="tag">' + esc(DB.types[p.t]) + '</span><span class="tag">' + esc(DB.outs[p.out]) + '</span>';
      $('#dTitle').textContent = p.title;
      $('#dRole').textContent = 'AI에게 맡길 역할: ' + p.role;
      var saved = state.inputs[p.id] || {};
      $('#dInputs').innerHTML = (p.in || []).map(function (i) {
        var fid = 'in-' + p.id + '-' + i.k, v = saved[i.k] || '';
        return '<div class="field"><label class="field__label" for="' + fid + '">' + esc(i.l) + '</label>' +
          '<textarea class="field__input' + (val(v) ? ' is-filled' : '') + '" id="' + fid + '" data-k="' + i.k + '" rows="2" placeholder="비워 두면 빈칸으로 남아요">' + esc(v) + '</textarea></div>';
      }).join('');
      $('#dInputs').hidden = !(p.in && p.in.length);
      $('#dModeWrap').hidden = !p.x;
      var next = p.next || [];
      $('#dNextWrap').hidden = !next.length;
      $('#dNext').innerHTML = next.map(function (t, i) {
        return '<div class="next"><p class="next__text">' + markBrackets(t) + '</p><button class="next__copy" type="button" data-next="' + i + '">복사</button></div>';
      }).join('');
      $('#dFav').setAttribute('aria-pressed', state.fav.has(p.id));
      var btn = $('#dCopy'); btn.textContent = '프롬프트 복사'; btn.classList.remove('is-done');
    }
    renderBriefRow(p);
    syncOpts();
    renderPreview();
  }

  /* ---------- 내 브리프: 한 번에 한 질문 ---------- */
  function openBrief(startKey) {
    var filled = DB.ctx.filter(function (c) { return val(state.brief[c.k]); }).length;
    if (startKey && ctxByKey[startKey]) showStep(ctxByKey[startKey].i);
    else if (!filled) showStep(0);
    else showSum();
    showSheet($('#briefDrawer'), true);
  }
  function showStep(i) {
    state.bIdx = i;
    var c = DB.ctx[i], total = DB.ctx.length;
    $('#bStep').hidden = false; $('#bSum').hidden = true;
    $('#bFootStep').hidden = false; $('#bFootSum').hidden = true;
    $('#bBack').hidden = i === 0;
    $('#bBar').style.width = ((i + 1) / total * 100) + '%';
    $('#bCount').textContent = (i + 1) + ' / ' + total;
    $('#bQ').textContent = c.q;
    var input = $('#bInput');
    input.value = state.brief[c.k] || '';
    input.placeholder = c.hint;
    $('#bHint').textContent = '비워 두고 넘어가도 돼요. 나중에 언제든 고칠 수 있어요.';
    $('#bNext').textContent = i === total - 1 ? '완료' : '다음';
    var step = $('#bStep'); step.classList.remove('is-enter'); void step.offsetWidth; step.classList.add('is-enter');
    setTimeout(function () { input.focus({ preventScroll: true }); autoGrow(input); }, stack.length ? 60 : 380);
  }
  function showSum() {
    $('#bStep').hidden = true; $('#bSum').hidden = false;
    $('#bFootStep').hidden = true; $('#bFootSum').hidden = false;
    $('#bBack').hidden = true;
    $('#bList').innerHTML = DB.ctx.map(function (c, i) {
      var v = val(state.brief[c.k]);
      return '<li><button class="qsum__item" type="button" data-i="' + i + '"><span class="qsum__body"><span class="qsum__label">' + esc(c.label) + '</span>' +
        '<span class="qsum__val' + (v ? '' : ' is-empty') + '">' + esc(v || '비어 있음') + '</span></span>' + ICON.chev + '</button></li>';
    }).join('');
    syncOpts();
  }
  function stepNext() {
    store.set('brief', state.brief);
    if (state.bIdx < DB.ctx.length - 1) showStep(state.bIdx + 1);
    else { showSum(); renderBriefCard(); toast('브리프를 저장했어요', '이제 모든 프롬프트에 들어가요.'); }
  }
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }

  /* ---------- 이벤트 ---------- */
  var qTimer;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(qTimer);
    var v = e.target.value;
    $('#qClear').hidden = !v;
    qTimer = setTimeout(function () { state.f.q = v.trim(); renderAll(); }, 120);
  });
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });
  $('#qClear').addEventListener('click', function () {
    $('#q').value = ''; this.hidden = true; state.f.q = ''; renderAll(); $('#q').focus();
  });
  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    state.f.p = b.dataset.p; state.f.t = 'all'; renderAll();
    b = $('#tabs [data-p="' + state.f.p + '"]');
    if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    var list = $('#list');
    if (list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' });
  });
  $('#chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b) return;
    state.f.t = b.dataset.t; renderChips(); renderGrid();
  });
  $('#resetFilters').addEventListener('click', function () {
    state.f = { p: 'all', t: 'all', q: '' }; $('#q').value = ''; $('#qClear').hidden = true; renderAll();
  });
  $('#emptySuggest').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    state.f = { p: 'all', t: 'all', q: b.dataset.q }; $('#q').value = b.dataset.q; $('#qClear').hidden = false; renderAll();
  });
  $('#recentRow').addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (b) openPrompt(b.dataset.id, true);
  });

  var grid = $('#grid');
  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.card'); if (!card) return;
    var id = card.dataset.id;
    if (e.target.closest('.card__copy')) { copyPrompt(id); return; }
    if (e.target.closest('.card__star')) { toggleFav(id); return; }
    openPrompt(id, true);
  });
  grid.addEventListener('pointerdown', function (e) {
    var card = e.target.closest('.card'); if (!card || e.target.closest('.card__copy, .card__star')) return;
    card.classList.add('is-pressed');
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
    grid.addEventListener(ev, function () { $$('.card.is-pressed').forEach(function (c) { c.classList.remove('is-pressed'); }); }, true);
  });

  $('#openBrief').addEventListener('click', function () { openBrief(); });
  $('#scrim').addEventListener('click', function () { requestClose(); });
  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { requestClose(b.closest('.drawer')); });
  });
  enableDrag($('#drawer'));
  enableDrag($('#briefDrawer'));

  document.addEventListener('keydown', function (e) {
    if (!stack.length) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); $('#q').focus(); }
      return;
    }
    var top = stack[stack.length - 1];
    if (e.key === 'Escape') { e.preventDefault(); requestClose(top); return; }
    if (e.key === 'Tab') {
      var f = $$('button, input, textarea, a[href], [tabindex]:not([tabindex="-1"])', top).filter(function (x) {
        return !x.disabled && x.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

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
  $('#dNext').addEventListener('click', function (e) {
    var b = e.target.closest('[data-next]'); if (!b) return;
    copyText(byId[state.openId].next[+b.dataset.next]).then(function (ok) {
      if (ok) { haptic(); b.textContent = '복사했어요'; setTimeout(function () { b.textContent = '복사'; }, 1400); }
      toast(ok ? '다음 단계 프롬프트를 복사했어요' : '복사하지 못했어요', ok ? '첫 결과가 나온 같은 대화에 붙여넣으세요.' : '문장을 길게 눌러 직접 복사해 주세요.');
    });
  });
  $('#dInputs').addEventListener('input', function (e) {
    var k = e.target.dataset.k; if (!k) return;
    var id = state.openId;
    state.inputs[id] = state.inputs[id] || {};
    state.inputs[id][k] = e.target.value;
    e.target.classList.toggle('is-filled', !!val(e.target.value));
    store.set('inputs', state.inputs);
    renderPreview();
    var card = document.querySelector('.card[data-id="' + id + '"] .card__task');
    if (card) card.innerHTML = html(fill(byId[id].task, byId[id]));
  });
  $('#dBody').addEventListener('click', function (e) {
    if (!e.target.closest('#dEditBrief')) return;
    var p = byId[state.openId];
    var firstEmpty = p.ctx.filter(function (k) { return !val(state.brief[k]); })[0];
    openBrief(firstEmpty || null);
  });

  var bInput = $('#bInput');
  bInput.addEventListener('input', function () {
    state.brief[DB.ctx[state.bIdx].k] = bInput.value;
    autoGrow(bInput);
  });
  bInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); stepNext(); }
  });
  $('#bNext').addEventListener('click', stepNext);
  $('#bSkip').addEventListener('click', stepNext);
  $('#bBack').addEventListener('click', function () { if (state.bIdx > 0) showStep(state.bIdx - 1); });
  $('#bList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-i]'); if (b) showStep(+b.dataset.i);
  });
  $('#briefClear').addEventListener('click', function () {
    var before = Object.assign({}, state.brief);
    state.brief = {}; store.set('brief', state.brief); showSum(); renderBriefCard();
    toast('브리프를 비웠어요', null, { label: '되돌리기', fn: function () { state.brief = before; store.set('brief', state.brief); showSum(); renderBriefCard(); } });
  });

  $$('.seg').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]'); if (!b) return;
      state.mode = b.dataset.mode; store.set('mode', state.mode); syncOpts(); renderPreview();
    });
  });
  ['#dPrinciples', '#bPrinciples'].forEach(function (s) {
    $(s).addEventListener('change', function () {
      state.principles = this.checked; store.set('principles', state.principles); syncOpts(); renderPreview();
    });
  });

  var rTimer;
  window.addEventListener('resize', function () { clearTimeout(rTimer); rTimer = setTimeout(renderRuler, 150); });

  /* ---------- 시작 ---------- */
  function fromHash() {
    var h = (location.hash || '').replace('#', '');
    if (/^\d{3}$/.test(h) && byId[h] && state.openId !== h) openPrompt(h, false);
  }
  renderPrinciples();
  renderBriefCard();
  renderTally();
  renderAll();
  renderRuler();
  fromHash();

  // 테스트·확장용
  window.DirectorsBrief = { compose: function (id) { return plain(compose(byId[id])); }, state: state };
})();
