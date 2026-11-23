/* Director's Brief — 화면 동작 */
(function () {
  'use strict';

  var DB = window.DB;
  var PROMPTS = window.PROMPTS;
  var M0 = '', M1 = ''; // 빈칸·채운 값 표시용 내부 기호

  /* ---------- 저장 ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('db.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('db.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경은 무시 */ } }
  };

  var state = {
    brief: store.get('brief', {}),
    inputs: store.get('inputs', {}),
    fav: new Set(store.get('fav', [])),
    copied: new Set(store.get('copied', [])),
    mode: store.get('mode', 'explore'),
    principles: store.get('principles', true),
    f: { p: 'all', t: 'all', q: '' },
    openId: null
  };

  var purposeById = {};
  DB.purposes.forEach(function (p) { purposeById[p.id] = p; });
  var ctxByKey = {};
  DB.ctx.forEach(function (c) { ctxByKey[c.k] = c; });
  var byId = {};
  PROMPTS.forEach(function (p) {
    byId[p.id] = p;
    p._hay = [p.id, p.title, p.task, p.role, DB.types[p.t], purposeById[p.p].label, DB.outs[p.out]]
      .concat(p.output).join(' ').toLowerCase();
  });

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ICON = {
    text: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M3 7h10M3 10.5h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    image: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 11.5l3-3.5 2.2 2.6 1.4-1.4 2.4 2.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4L2.5 8 6 12M10 4l3.5 4L10 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spec: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 6.5h11M6.5 6.5v7" stroke="currentColor" stroke-width="1.5"/></svg>',
    check: '<svg class="card__done" viewBox="0 0 16 16" aria-label="복사한 적 있음" role="img"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"/></svg>'
  };

  /* ---------- 프롬프트 조립 ---------- */
  function val(v) { return (v == null ? '' : String(v)).trim(); }

  function tok(key, p) {
    if (ctxByKey[key]) {
      var v = val(state.brief[key]);
      return v ? M0 + 'V' + v + M1 : M0 + 'P' + ctxByKey[key].ph + M1;
    }
    var inp = (p.in || []).filter(function (i) { return i.k === key; })[0];
    var saved = val((state.inputs[p.id] || {})[key]);
    if (saved) return M0 + 'V' + saved + M1;
    return M0 + 'P' + (inp ? inp.l : key) + M1;
  }

  function fill(text, p) {
    return text.replace(/\{(\w+)\}/g, function (_, k) { return tok(k, p); });
  }

  function compose(p) {
    var L = [];
    L.push('당신은 ' + p.role + '입니다.');
    L.push('');
    L.push('## 프로젝트 맥락');
    p.ctx.forEach(function (k) { L.push('- ' + ctxByKey[k].label + ': ' + tok(k, p)); });
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
  function hit(p, ignoreType) {
    var f = state.f;
    if (f.p === 'fav') { if (!state.fav.has(p.id)) return false; }
    else if (f.p !== 'all' && p.p !== f.p) return false;
    if (!ignoreType && f.t !== 'all' && p.t !== f.t) return false;
    if (f.q) {
      var words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (p._hay.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  function renderTabs() {
    var q = state.f.q.toLowerCase();
    var countFor = function (fn) {
      return PROMPTS.filter(function (p) {
        if (!fn(p)) return false;
        if (!q) return true;
        return q.split(/\s+/).filter(Boolean).every(function (w) { return p._hay.indexOf(w) > -1; });
      }).length;
    };
    var items = [{ id: 'all', label: '전체', n: countFor(function () { return true; }) }]
      .concat(DB.purposes.map(function (pp) { return { id: pp.id, label: pp.label, n: countFor(function (p) { return p.p === pp.id; }) }; }))
      .concat([{ id: 'fav', label: '즐겨찾기', n: countFor(function (p) { return state.fav.has(p.id); }) }]);
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
    var html_ = '<button class="chip" type="button" data-t="all" aria-pressed="' + (state.f.t === 'all') + '">모든 유형<span class="chip__n">' + pool.length + '</span></button>';
    html_ += keys.map(function (k) {
      return '<button class="chip" type="button" data-t="' + k + '" aria-pressed="' + (state.f.t === k) + '">' + esc(DB.types[k]) + '<span class="chip__n">' + counts[k] + '</span></button>';
    }).join('');
    $('#chips').innerHTML = keys.length ? html_ : '';
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

  function renderGrid() {
    var list = PROMPTS.filter(function (p) { return hit(p); });
    $('#grid').innerHTML = list.map(cardHTML).join('');
    var empty = $('#empty');
    empty.hidden = list.length > 0;
    if (!list.length) {
      $('#emptyText').textContent = state.f.p === 'fav' && !state.f.q
        ? '아직 별표한 프롬프트가 없습니다. 카드의 별을 눌러 자주 쓰는 프롬프트를 모아 두세요.'
        : '검색어를 줄이거나 유형을 "모든 유형"으로 바꿔 보세요.';
    }
    var f = state.f, d;
    if (f.p === 'all') d = '목적 6가지, 유형 22가지로 나눈 프롬프트입니다.';
    else if (f.p === 'fav') d = '별표한 프롬프트입니다.';
    else d = purposeById[f.p].desc + ' 쓰는 프롬프트입니다.';
    var tail = ' <b>' + list.length + '개</b>' + (f.q ? ', "' + esc(f.q) + '" 검색 결과' : '');
    $('#filterDesc').innerHTML = esc(d) + tail;
  }

  function renderAll() { renderTabs(); renderChips(); renderGrid(); }

  function renderTally() {
    $('#copyCount').textContent = state.copied.size;
    $('#favCount').textContent = state.fav.size;
  }

  function renderBriefCard() {
    var filled = DB.ctx.filter(function (c) { return val(state.brief[c.k]); }).length;
    $('#briefMeterBar').style.width = (filled / DB.ctx.length * 100) + '%';
    $('#briefMeter').setAttribute('aria-valuenow', filled);
    $('#briefStatus').textContent = DB.ctx.length + '칸 중 ' + filled + '칸 채움';
    var brand = val(state.brief.brand);
    $('#briefCardText').innerHTML = filled
      ? (brand ? '<mark class="val">' + esc(brand) + '</mark> 기준으로 ' : '') + '모든 프롬프트의 빈칸이 채워집니다. 비어 있는 칸은 <mark class="ph">[ ]</mark>로 복사됩니다.'
      : '아직 비어 있습니다. 채우지 않아도 쓸 수 있고, 비어 있는 칸은 <mark class="ph">[ ]</mark>로 복사됩니다.';
    $('#openBrief').textContent = filled ? '브리프 고치기' : '브리프 채우기';
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
  function toast(msg, sub) {
    var t = $('#toast');
    t.innerHTML = esc(msg) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-show'); }, 2600);
  }

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
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }

  function copyPrompt(id) {
    var p = byId[id], composed = compose(p), n = blanks(composed);
    return copyText(plain(composed)).then(function (ok) {
      if (!ok) { toast('복사하지 못했습니다.', '상세 화면의 프롬프트를 길게 눌러 직접 복사하세요.'); if (!state.openId) openPrompt(id); return false; }
      state.copied.add(id); store.set('copied', Array.from(state.copied)); renderTally();
      var card = document.querySelector('.card[data-id="' + id + '"]');
      if (card) {
        card.classList.add('is-copied');
        card.classList.remove('is-stamped'); void card.offsetWidth; card.classList.add('is-stamped');
        setTimeout(function () { card.classList.remove('is-stamped'); }, 2000);
      }
      toast(id + ' 복사됨. Claude에 붙여넣으세요.', n ? '빈칸 ' + n + '개는 [ ]로 남아 있으니 붙여넣은 뒤 채워 주세요.' : '');
      return true;
    });
  }

  function toggleFav(id) {
    if (state.fav.has(id)) state.fav.delete(id); else state.fav.add(id);
    store.set('fav', Array.from(state.fav)); renderTally();
    var on = state.fav.has(id);
    document.querySelectorAll('.card[data-id="' + id + '"] .card__star').forEach(function (b) { b.setAttribute('aria-pressed', on); });
    if (state.openId === id) $('#dFav').setAttribute('aria-pressed', on);
    if (state.f.p === 'fav') renderAll(); else renderTabs();
    toast(on ? id + ' 즐겨찾기에 담았습니다.' : id + ' 즐겨찾기에서 뺐습니다.');
  }

  /* ---------- 시트 (상세 / 브리프) ---------- */
  var stack = [], lastFocus = [];
  function openSheet(el) {
    lastFocus.push(document.activeElement);
    stack.push(el);
    var scrim = $('#scrim');
    scrim.hidden = false; el.hidden = false;
    document.body.classList.add('is-locked', 'has-drawer');
    void el.offsetWidth;
    scrim.classList.add('is-open'); el.classList.add('is-open');
    el.style.zIndex = 41 + stack.length;
    setTimeout(function () { var c = el.querySelector('[data-close]'); if (c) c.focus(); }, 60);
  }
  function closeSheet(el) {
    el = el || stack[stack.length - 1]; if (!el) return;
    stack = stack.filter(function (x) { return x !== el; });
    el.classList.remove('is-open');
    setTimeout(function () { if (!el.classList.contains('is-open')) el.hidden = true; }, 340);
    if (!stack.length) {
      $('#scrim').classList.remove('is-open');
      setTimeout(function () { if (!stack.length) $('#scrim').hidden = true; }, 260);
      document.body.classList.remove('is-locked', 'has-drawer');
    }
    if (el.id === 'drawer') {
      state.openId = null;
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }
    if (el.id === 'briefDrawer') { renderBriefCard(); renderGrid(); if (state.openId) renderDrawer(); }
    var f = lastFocus.pop(); if (f && f.focus && document.contains(f)) f.focus();
  }

  function openPrompt(id) {
    if (!byId[id]) return;
    state.openId = id;
    renderDrawer(true);
    $('#dBody').scrollTop = 0;
    if ($('#drawer').hidden) openSheet($('#drawer'));
    history.replaceState(null, '', '#' + id);
  }

  function syncOpts() {
    document.querySelectorAll('.seg [data-mode]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === state.mode); });
    $('#dPrinciples').checked = state.principles;
    $('#bPrinciples').checked = state.principles;
  }

  function renderPreview() {
    var p = byId[state.openId]; if (!p) return;
    $('#dPrompt').innerHTML = html(compose(p));
  }

  function renderDrawer(full) {
    var p = byId[state.openId]; if (!p) return;
    if (full) {
      $('#dMeta').innerHTML = '<span class="card__id">' + p.id + '</span><span class="tag">' + esc(purposeById[p.p].label) + '</span><span class="tag">' + esc(DB.types[p.t]) + '</span><span class="tag">' + esc(DB.outs[p.out]) + '</span>';
      $('#dTitle').textContent = p.title;
      $('#dRole').textContent = 'AI에게 맡길 역할: ' + p.role;
      var saved = state.inputs[p.id] || {};
      $('#dInputs').innerHTML = (p.in || []).map(function (i) {
        var fid = 'in-' + p.id + '-' + i.k;
        return '<div class="field"><label class="field__label" for="' + fid + '">' + esc(i.l) + '</label>' +
          '<textarea class="field__input" id="' + fid + '" data-k="' + i.k + '" rows="2" placeholder="비워 두면 [ ]로 복사됩니다">' + esc(saved[i.k] || '') + '</textarea></div>';
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
    $('#dCtx').innerHTML = p.ctx.map(function (k) {
      var v = val(state.brief[k]), c = ctxByKey[k];
      return '<span class="ctx ' + (v ? 'ctx--full' : 'ctx--empty') + '" title="' + esc(v || '비어 있음') + '">' +
        (v ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
        esc(c.label) + (v ? '' : ' 비어 있음') + '</span>';
    }).join('') + '<button class="ctx-list__edit" type="button" id="dEditBrief">브리프에서 채우기</button>';
    syncOpts();
    renderPreview();
  }

  function renderBriefForm() {
    $('#briefForm').innerHTML = DB.ctx.map(function (c) {
      var id = 'b-' + c.k, v = state.brief[c.k] || '';
      var long = c.k === 'what' || c.k === 'need' || c.k === 'money';
      var field = long
        ? '<textarea class="field__input" id="' + id + '" data-k="' + c.k + '" rows="2" placeholder="' + esc(c.hint) + '">' + esc(v) + '</textarea>'
        : '<input class="field__input" id="' + id + '" data-k="' + c.k + '" type="text" placeholder="' + esc(c.hint) + '" value="' + esc(v) + '">';
      return '<div class="field"><label class="field__label" for="' + id + '">' + esc(c.label) + '</label>' + field + '</div>';
    }).join('');
  }

  function openBrief() { renderBriefForm(); syncOpts(); openSheet($('#briefDrawer')); }

  /* ---------- 이벤트 ---------- */
  var qTimer;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(qTimer);
    var v = e.target.value;
    $('#qClear').hidden = !v;
    qTimer = setTimeout(function () { state.f.q = v.trim(); renderAll(); }, 120);
  });
  $('#qClear').addEventListener('click', function () {
    $('#q').value = ''; this.hidden = true; state.f.q = ''; renderAll(); $('#q').focus();
  });
  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    state.f.p = b.dataset.p; state.f.t = 'all'; renderAll();
    b = $('#tabs [data-p="' + state.f.p + '"]');
    if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
  $('#grid').addEventListener('click', function (e) {
    var card = e.target.closest('.card'); if (!card) return;
    var id = card.dataset.id;
    if (e.target.closest('.card__copy')) { copyPrompt(id); return; }
    if (e.target.closest('.card__star')) { toggleFav(id); return; }
    openPrompt(id);
  });

  $('#openBrief').addEventListener('click', openBrief);
  $('#scrim').addEventListener('click', function () { closeSheet(); });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeSheet(b.closest('.drawer')); });
  });
  document.addEventListener('keydown', function (e) {
    if (!stack.length) return;
    var top = stack[stack.length - 1];
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(top); return; }
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(top.querySelectorAll('button, input, textarea, a[href], [tabindex]:not([tabindex="-1"])'), function (x) {
        return !x.disabled && x.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  $('#dCopy').addEventListener('click', function () {
    var btn = this, id = state.openId;
    copyPrompt(id).then(function (ok) {
      if (!ok) return;
      btn.textContent = '복사됨'; btn.classList.add('is-done');
      setTimeout(function () { btn.textContent = '프롬프트 복사'; btn.classList.remove('is-done'); }, 1600);
    });
  });
  $('#dFav').addEventListener('click', function () { toggleFav(state.openId); });
  $('#dNext').addEventListener('click', function (e) {
    var b = e.target.closest('[data-next]'); if (!b) return;
    var t = byId[state.openId].next[+b.dataset.next];
    copyText(t).then(function (ok) {
      toast(ok ? '다음 단계 프롬프트 복사됨.' : '복사하지 못했습니다.', ok ? '첫 결과가 나온 같은 대화에 붙여넣으세요.' : '문장을 길게 눌러 직접 복사하세요.');
      if (ok) { b.textContent = '복사됨'; setTimeout(function () { b.textContent = '복사'; }, 1400); }
    });
  });
  $('#dInputs').addEventListener('input', function (e) {
    var k = e.target.dataset.k; if (!k) return;
    var id = state.openId;
    state.inputs[id] = state.inputs[id] || {};
    state.inputs[id][k] = e.target.value;
    store.set('inputs', state.inputs);
    renderPreview();
    var card = document.querySelector('.card[data-id="' + id + '"] .card__task');
    if (card) card.innerHTML = html(fill(byId[id].task, byId[id]));
  });
  $('#dCtx').addEventListener('click', function (e) { if (e.target.closest('#dEditBrief')) openBrief(); });

  var briefTimer;
  $('#briefForm').addEventListener('input', function (e) {
    var k = e.target.dataset.k; if (!k) return;
    state.brief[k] = e.target.value;
    clearTimeout(briefTimer);
    briefTimer = setTimeout(function () { store.set('brief', state.brief); renderBriefCard(); }, 200);
  });
  $('#briefForm').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#briefClear').addEventListener('click', function () {
    var before = state.brief;
    state.brief = {}; store.set('brief', state.brief); renderBriefForm(); renderBriefCard();
    var t = $('#toast');
    toast('브리프를 비웠습니다.');
    t.insertAdjacentHTML('beforeend', ' <button type="button" class="btn btn--paper" style="min-height:36px;margin-left:8px" id="undoClear">되돌리기</button>');
    t.style.pointerEvents = 'auto';
    $('#undoClear').addEventListener('click', function () {
      state.brief = before; store.set('brief', state.brief); renderBriefForm(); renderBriefCard();
      t.classList.remove('is-show'); t.style.pointerEvents = '';
    });
    setTimeout(function () { t.style.pointerEvents = ''; }, 2600);
  });

  document.querySelectorAll('.seg').forEach(function (seg) {
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
  renderPrinciples();
  renderBriefCard();
  renderTally();
  renderAll();
  renderRuler();
  function fromHash() {
    var h = (location.hash || '').replace('#', '');
    if (/^\d{3}$/.test(h) && byId[h] && state.openId !== h) openPrompt(h);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();

  // 테스트·확장용
  window.DirectorsBrief = { compose: function (id) { return plain(compose(byId[id])); }, state: state };
})();
