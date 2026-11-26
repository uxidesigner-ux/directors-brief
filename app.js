/* Director's Brief v3 — 화면 동작 */
(function () {
  'use strict';

  var DB = window.DB, PROMPTS = window.PROMPTS, COURSES = window.COURSES || [], EX = window.EXAMPLES || {};
  var M0 = '', M1 = '';
  var body = document.body;

  /* ---------- 저장 ----------
     한 칸(브리프 항목 하나, 작업 입력 하나, 코스 단계 하나, 복사 버전 하나)마다 localStorage 키를 따로 쓴다.
     키 하나의 setItem은 한 번에 끝나므로, 두 탭이 같은 순간에 서로 다른 칸을 저장해도 서로 덮지 않는다.
     같은 칸은 마지막으로 저장한 쪽이 남는다. 지운 칸은 키를 없애고, 되돌리기는 그동안 아무도 다시 쓰지 않은 칸만 되살린다. */
  // 저장이 실패하면(저장 공간 부족 등) false를 돌려준다. 실패를 성공으로 치지 않는다
  var store = {
    raw: function (k) { try { return localStorage.getItem('db.' + k); } catch (e) { return null; } },
    get: function (k, d) { try { var v = localStorage.getItem('db.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) {
      var s = JSON.stringify(v);
      try { localStorage.setItem('db.' + k, s); } catch (e) { return false; }
      return store.raw(k) === s;
    },
    del: function (k) { try { localStorage.removeItem('db.' + k); } catch (e) { /* 무시 */ } }
  };
  var SEP = '|';
  // ns: b 브리프, i 작업 입력(작업|칸), c 코스 단계(코스|작업 → 기록 시각), v 복사 버전(코스:작업 → 원문 지문), f 보관함, cp 복사한 작업, g 초기화 세대
  /* 저장하지 못한 칸(초안): 이 탭에서 사용자가 마지막으로 쓴 값. 읽을 때는 저장값 위에 겹쳐서
     미리보기·실제 복사·버전 판정·백업의 현재 값이 모두 같은 값을 쓴다. 빈 문자열도 그대로 지킨다.
     탭을 새로고침해도 남도록 이 탭의 sessionStorage에도 적어 둔다(별도 공간, 실패해도 메모리에는 남는다). */
  var drafts = (function () { try { return JSON.parse(sessionStorage.getItem('db.drafts') || '{}') || {}; } catch (e) { return {}; } })();
  function keepDrafts() { try { if (Object.keys(drafts).length) sessionStorage.setItem('db.drafts', JSON.stringify(drafts)); else sessionStorage.removeItem('db.drafts'); } catch (e) { /* 메모리에는 남는다 */ } }
  var kv = {
    raw: function (ns, key) { return store.raw(ns + SEP + key); },
    get: function (ns, key, d) { var k = ns + SEP + key; return k in drafts ? drafts[k] : store.get(k, d); },
    set: function (ns, key, v) {
      var k = ns + SEP + key, ok = store.set(k, v);
      if (ok) { if (k in drafts) { delete drafts[k]; keepDrafts(); renderSaveWarn(); } }
      else { drafts[k] = v; keepDrafts(); noteSaveFail(); }
      return ok;
    },
    del: function (ns, key) { var k = ns + SEP + key; store.del(k); if (k in drafts) { delete drafts[k]; keepDrafts(); renderSaveWarn(); } },
    all: function (ns) {
      var out = {}, pre = 'db.' + ns + SEP, dp = ns + SEP;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(pre) === 0) { try { out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* 깨진 값은 건너뜀 */ } }
        }
      } catch (e) { /* 저장소를 못 읽는 환경 */ }
      Object.keys(drafts).forEach(function (k) { if (k.indexOf(dp) === 0) out[k.slice(dp.length)] = drafts[k]; });
      return out;
    },
    // 저장값만 (백업의 saved, 되돌리기 판정용)
    savedAll: function (ns) {
      var out = {}, pre = 'db.' + ns + SEP;
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(pre) === 0) { try { out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* 무시 */ } } } } catch (e) { /* 무시 */ }
      return out;
    }
  };
  // 공간을 돌려받은 뒤 초안을 다시 저장한다. 기록하고 다시 읽어 확인한 칸만 초안에서 뺀다
  function retryDrafts() {
    var left = 0;
    Object.keys(drafts).forEach(function (k) { if (store.set(k, drafts[k])) delete drafts[k]; else left++; });
    keepDrafts(); return left === 0;
  }

  /* ---------- 이전 저장 형식 옮기기 ----------
     이전 버전은 브리프·입력·코스 기록을 객체 하나로 저장했다. 칸별 키로 옮기되,
     1) 모든 칸을 써 보고 다시 읽어 같은지 확인한 뒤에만 완료 표시를 하고 원본(구 키)을 지운다.
     2) 하나라도 실패하면 이번에 새로 만든 사본만 지워 공간을 돌려주고, 원본은 그대로 둔다. 화면은 원본을 계속 읽는다.
     3) 다른 탭이 먼저 옮겼거나 그 칸에 새 값을 썼다면 그 값을 남긴다.
     원본을 지우는 일은 공간이 모자라서가 아니라, 옮긴 것이 확인됐을 때만 한다. */
  var LEGACY = ['brief', 'inputs', 'courses', 'copylog2', 'fav', 'copied'];
  var migration = { pending: false, failed: [] };
  function legacyPlan(first) {
    var plan = [], add = function (ns, key, v, label) { plan.push({ ns: ns, key: key, v: v, label: label }); };
    var b = store.get('brief', null);
    if (b && typeof b === 'object') Object.keys(b).forEach(function (k) { add('b', k, b[k], '브리프 · ' + ((DB.ctx.filter(function (c) { return c.k === k; })[0] || {}).label || k)); });
    var ins = store.get('inputs', null);
    if (ins && typeof ins === 'object') Object.keys(ins).forEach(function (id) {
      var o = ins[id] || {};
      Object.keys(o).forEach(function (k) {
        if (k === '@reuse') { (o[k] || []).forEach(function (r) { add('i', id + SEP + '@reuse:' + r, true, id + ' 이전 단계 자료 선택'); }); return; }
        var pp = (window.PROMPTS || []).filter(function (x) { return x.id === id; })[0], il = pp && (pp.in || []).filter(function (x) { return x.k === k; })[0];
        add('i', id + SEP + k, o[k], id + ' ' + (il ? il.l.replace(/\s*\(.*\)$/, '') : k) + ' (' + String(o[k] || '').length.toLocaleString() + '자)');
      });
    });
    var cs = store.get('courses', null);
    if (cs && typeof cs === 'object') Object.keys(cs).forEach(function (cid) { (cs[cid] || []).forEach(function (id, n) { plan.push({ ns: 'c', key: cid + SEP + id, v: first ? n + 1 : Date.now() + n, label: '코스 기록 · ' + cid + ' ' + id, keepAny: true }); }); });
    var vl = store.get('copylog2', null);
    if (vl && typeof vl === 'object') Object.keys(vl).forEach(function (k) { add('v', k, vl[k], '복사 버전 · ' + k); });
    (store.get('fav', []) || []).forEach(function (id, n) { plan.push({ ns: 'f', key: id, v: first ? n + 1 : Date.now() + n, label: '보관함 · ' + id, keepAny: true }); });
    (store.get('copied', []) || []).forEach(function (id) { plan.push({ ns: 'cp', key: id, v: 1, label: '복사 기록 · ' + id, keepAny: true }); });
    return plan;
  }
  function absorbLegacy() {
    var first = store.get('schema', 0) < 3;
    var seen = {}; LEGACY.forEach(function (k) { seen[k] = store.raw(k); });
    var any = LEGACY.some(function (k) { return seen[k] != null; });
    if (!any) { if (first) store.set('schema', 3); migration.pending = false; migration.failed = []; return true; }
    var plan = legacyPlan(first), wrote = [], failed = [];
    plan.forEach(function (w) {
      var prev = kv.raw(w.ns, w.key);
      // 첫 이관: 이미 있는 칸은 다른 탭이 옮겼거나 새로 쓴 값이라 그대로 둔다. 코스 단계·보관함은 있으면 그대로 둔다
      if (prev != null && (first || w.keepAny)) return;
      if (store.set(w.ns + SEP + w.key, w.v)) wrote.push({ w: w, prev: prev });
      else failed.push(w);
    });
    var missing = plan.filter(function (w) { return kv.raw(w.ns, w.key) == null; });
    if (failed.length || missing.length) {
      // 이번에 만든 사본만 되돌린다 (원본이 그대로 있으므로 읽는 값은 같다)
      wrote.forEach(function (x) { if (x.prev == null) kv.del(x.w.ns, x.w.key); else { try { localStorage.setItem('db.' + x.w.ns + SEP + x.w.key, x.prev); } catch (e) { /* 원래 값보다 크지 않으므로 대개 성공 */ } } });
      migration.pending = true; migration.failed = failed.concat(missing.filter(function (m) { return failed.indexOf(m) < 0; }));
      return false;
    }
    if (first && !store.set('schema', 3)) { migration.pending = true; migration.failed = [{ label: '이관 완료 표시' }]; return false; }
    // 읽은 뒤 이전 버전 탭이 원본을 또 바꿨다면 지우지 않고 다음에 다시 옮긴다
    LEGACY.forEach(function (k) { if (seen[k] != null && store.raw(k) === seen[k]) store.del(k); });
    migration.pending = false; migration.failed = [];
    return true;
  }
  absorbLegacy();
  // 옮기지 못한 원본이 남아 있으면 원본을 바탕으로, 그 위에 칸별 값(더 새것)을 겹쳐 읽는다
  function legacyBase() {
    var out = { brief: {}, inputs: {}, courses: {}, copyLog: {}, fav: [], copied: [] };
    var b = store.get('brief', null); if (b && typeof b === 'object') out.brief = b;
    var ins = store.get('inputs', null);
    if (ins && typeof ins === 'object') Object.keys(ins).forEach(function (id) {
      var o = {}; Object.keys(ins[id] || {}).forEach(function (k) {
        if (k === '@reuse') (ins[id][k] || []).forEach(function (r) { o['@reuse:' + r] = true; });
        else o[k] = ins[id][k];
      }); out.inputs[id] = o;
    });
    var cs = store.get('courses', null); if (cs && typeof cs === 'object') out.courses = cs;
    var vl = store.get('copylog2', null); if (vl && typeof vl === 'object') out.copyLog = vl;
    out.fav = store.get('fav', []) || []; out.copied = store.get('copied', []) || [];
    return out;
  }
  function readAll() {
    var L = legacyBase(), inputs = {}, tmp = {}, courses = {}, ii = kv.all('i'), cc = kv.all('c'), fav = kv.all('f');
    Object.keys(L.inputs).forEach(function (id) { inputs[id] = Object.assign({}, L.inputs[id]); });
    Object.keys(ii).forEach(function (key) { var j = key.indexOf(SEP), id = key.slice(0, j); (inputs[id] = inputs[id] || {})[key.slice(j + 1)] = ii[key]; });
    Object.keys(L.courses).forEach(function (cid) { (L.courses[cid] || []).forEach(function (id, n) { (tmp[cid] = tmp[cid] || {})[id] = n + 1; }); });
    Object.keys(cc).forEach(function (key) { var j = key.indexOf(SEP), cid = key.slice(0, j); (tmp[cid] = tmp[cid] || {})[key.slice(j + 1)] = +cc[key] || 0; });
    Object.keys(tmp).forEach(function (cid) { courses[cid] = Object.keys(tmp[cid]).sort(function (a, b) { return tmp[cid][a] - tmp[cid][b]; }); });
    L.fav.forEach(function (id, n) { if (!(id in fav)) fav[id] = n + 1; });
    return {
      brief: Object.assign({}, L.brief, kv.all('b')), inputs: inputs, courses: courses,
      // 코스·단계별로 마지막에 복사한 원문의 지문. 키는 "코스id:프롬프트id", 코스 밖 복사는 "_:프롬프트id"
      copyLog: Object.assign({}, L.copyLog, kv.all('v')),
      fav: new Set(Object.keys(fav).sort(function (a, b) { return fav[a] - fav[b]; })),
      copied: new Set(L.copied.concat(Object.keys(kv.all('cp'))))
    };
  }
  // 이관이 끝나지 않아 원본이 남아 있을 때, 사용자가 지운 것은 원본에서도 지운다 (지운 것이 되살아나지 않게)
  function legacyDrop(kind, fn) {
    var cur = store.get(kind, null); if (cur == null) return;
    var out = fn(cur); store.set(kind, out === undefined ? cur : out);
  }
  /* ---------- 저장 실패 알림·백업 ---------- */
  var warnClosed = false;
  function noteSaveFail() { warnClosed = false; renderSaveWarn(); }
  function draftLabel(k) {
    var p = k.split(SEP), ns = p[0];
    if (ns === 'b') { var c = DB.ctx.filter(function (x) { return x.k === p[1]; })[0]; return '브리프 · ' + (c ? c.label : p[1]); }
    if (ns === 'i') {
      if (/^@reuse:/.test(p[2])) return p[1] + ' 이전 단계 자료 선택';
      var pp = (window.PROMPTS || []).filter(function (x) { return x.id === p[1]; })[0], il = pp && (pp.in || []).filter(function (x) { return x.k === p[2]; })[0];
      return p[1] + ' ' + (il ? il.l.replace(/\s*\(.*\)$/, '') : p[2]) + ' (' + String(drafts[k] || '').length.toLocaleString() + '자)';
    }
    return { c: '코스 기록', v: '복사 버전', f: '보관함', cp: '복사 기록', g: '되돌리기 기록' }[ns] || k;
  }
  function renderSaveWarn() {
    var box = document.getElementById('saveWarn'); if (!box) return;
    var unsaved = Object.keys(drafts);
    var show = (migration.pending || unsaved.length > 0) && !warnClosed;
    box.hidden = !show; if (!show) return;
    var msg;
    if (unsaved.length) {
      var dn = unsaved.map(draftLabel);
      msg = '저장 공간이 부족해 방금 바꾼 ' + dn.slice(0, 3).join(', ') + (dn.length > 3 ? ' 외 ' + (dn.length - 3) + '개' : '') +
        '를 이 브라우저에 저장하지 못했어요. 이 탭의 미리보기·복사·백업에는 방금 쓴 내용이 그대로 쓰여요. 공간을 늘린 뒤 "다시 시도"를 누르면 저장돼요.' +
        (migration.pending ? ' 기존 데이터 이관도 아직 끝나지 않았어요.' : '');
    } else if (migration.pending) {
      var names = migration.failed.map(function (w) { return w.label; }), more = names.length > 3 ? ' 외 ' + (names.length - 3) + '개' : '';
      msg = '이 브라우저의 저장 공간이 부족해 기존 데이터를 새 저장 방식으로 옮기지 못했어요. 기존 데이터는 지우지 않았고 지금도 그대로 읽고 있어요. 옮기지 못한 항목: ' +
        (names.slice(0, 3).join(', ') || '확인 중') + more + '. 공간을 늘린 뒤 "다시 시도"를 누르거나 백업을 받아 두세요.';
    } else {
      msg = '저장 공간이 부족해 방금 바꾼 내용을 이 브라우저에 저장하지 못했어요. 이 탭에서는 계속 쓰이지만 새로고침하거나 닫으면 사라져요. 백업을 받아 두세요.';
    }
    document.getElementById('saveWarnMsg').textContent = msg;
    document.getElementById('saveRetry').hidden = false;
  }
  function downloadBackup() {
    var saved = {};
    purgeUndo();
    // 되돌리기용 임시 사본(db.u|)은 업무 데이터가 아니라서 백업에 넣지 않는다. 지운 내용이 파일로 새어 나가지 않게 한다
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('db.') === 0 && k.indexOf('db.u' + SEP) !== 0) saved[k] = localStorage.getItem(k); } } catch (e) { /* 무시 */ }
    // saved: 이 브라우저에 실제로 저장된 값, current: 지금 이 탭이 쓰는 값(저장하지 못한 초안 포함), unsaved: 저장하지 못한 칸
    pullState();
    var data = { app: 'directors-brief', at: new Date().toISOString(), saved: saved,
      current: { brief: state.brief, inputs: state.inputs, courses: state.courses, copyLog: state.copyLog, fav: Array.from(state.fav) },
      unsaved: Object.keys(drafts).map(function (k) { return { key: k, label: draftLabel(k), value: drafts[k] }; }) };
    var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    var a = document.createElement('a'); a.href = url; a.download = 'directors-brief-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // 목록 두 개(최근 본 것, 최근 검색)는 작은 편의 기록이라 마지막 저장을 그대로 쓴다
  function saveList(k, fn) { var a = store.get(k, []); if (!Array.isArray(a)) a = []; a = fn(a); store.set(k, a); return a; }
  var state = Object.assign(readAll(), {
    recent: store.get('recent', []),
    searches: store.get('searches', []),
    mode: store.get('mode', 'explore'),
    principles: store.get('principles', true),
    refs: store.get('refs', false),
    f: { p: 'all', types: new Set(), outs: new Set() },
    draft: { types: new Set(), outs: new Set() },
    openId: null, courseId: null, drawerCourse: null, bIdx: 0, lib: 'fav'
  });

  /* ---------- 여러 탭: 칸 단위로 저장하고, 다른 탭의 저장을 받아 온다 ---------- */
  function saveBrief(k, v) { kv.set('b', k, v); state.brief[k] = v; }
  function saveInput(id, k, v) { kv.set('i', id + SEP + k, v); (state.inputs[id] = state.inputs[id] || {})[k] = v; }
  // 이 탭에서 지금 입력 중인 칸 (입력한 뒤 아직 포커스를 벗어나지 않은 칸)
  function typingField() {
    var el = document.activeElement;
    if (!el || !el.dataset || el.dataset.dirty !== '1') return null;
    if (el.dataset.dec) return { kind: 'brief', k: el.dataset.dec, v: el.value };
    if (el.id === 'bInput') return { kind: 'brief', k: DB.ctx[state.bIdx].k, v: el.value };
    if (el.dataset.k && el.closest('#dInputs') && state.openId) return { kind: 'input', id: state.openId, k: el.dataset.k, v: el.value };
    return null;
  }
  // 다른 탭이 같은 칸을 바꿔도 입력 중인 글은 덮지 않는다
  function keepTyping() {
    var t = typingField(); if (!t) return;
    if (t.kind === 'brief') state.brief[t.k] = t.v;
    else { state.inputs[t.id] = state.inputs[t.id] || {}; state.inputs[t.id][t.k] = t.v; }
  }
  // 저장소의 최신 값을 읽어 온다. 미리보기와 실제 복사 원문이 항상 같은 최신 값을 쓴다
  function pullState() {
    Object.assign(state, readAll());
    state.recent = store.get('recent', []); state.searches = store.get('searches', []);
    state.mode = store.get('mode', 'explore'); state.principles = store.get('principles', true); state.refs = store.get('refs', false);
    keepTyping();
  }
  document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('textarea, input')) e.target.dataset.dirty = '1'; }, true);
  document.addEventListener('focusout', function (e) {
    var el = e.target; if (!el.dataset || el.dataset.dirty !== '1') return;
    // 입력을 마친 칸은 다시 저장해, 입력하는 동안 다른 탭이 같은 칸을 바꿨더라도 이 탭에서 쓴 글이 남게 한다
    if (el.dataset.dec) saveBrief(el.dataset.dec, el.value);
    else if (el.id === 'bInput') saveBrief(DB.ctx[state.bIdx].k, el.value);
    else if (el.dataset.k && el.closest('#dInputs') && state.openId) saveInput(state.openId, el.dataset.k, el.value);
    delete el.dataset.dirty;
  }, true);

  var purposeById = {}, ctxByKey = {}, byId = {}, courseById = {};
  DB.purposes.forEach(function (p) { purposeById[p.id] = p; });
  DB.ctx.forEach(function (c, i) { ctxByKey[c.k] = c; c.i = i; });
  // 목적별 기본 맥락: 서비스·사용자 문제·수익을 모르면 AI가 일반론으로 답한다 (콘텐츠 검증에서 확인)
  var BASE_CTX = { convert: ['what', 'audience', 'need', 'money'], persuade: ['what', 'audience', 'need', 'money'], review: ['what', 'audience', 'need', 'money'], product: ['what', 'audience', 'need'] };
  var CTX_SKIP = ['075', '077', '079', '092', '093', '096', '098'];
  window.PROMPTS.forEach(function (p) {
    var add = BASE_CTX[p.p];
    if (!add || CTX_SKIP.indexOf(p.id) > -1 || p.t === 'system' || p.t === 'motion') return;
    add.forEach(function (k) { if (p.ctx.indexOf(k) < 0) p.ctx.splice(p.ctx.indexOf('core') > -1 ? p.ctx.indexOf('core') : p.ctx.length, 0, k); });
  });
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
    var inp = (p.in || []).filter(function (i) { return i.k === key; })[0], own = val((state.inputs[p.id] || {})[key]);
    if (!own) {
      // 직접 입력이 비어 있고 앞 단계 자료를 골랐다면, 과제는 그 자료를 가리킨다 (빈칸 수·경고·알림이 같은 판정을 쓴다)
      var use = reuseList(p).filter(function (r) { return r.on && r.fills === key; })[0];
      if (use) return { v: '아래 "이전 단계에서 가져온 자료"의 ' + use.id + ' ' + use.label, label: inp ? inp.l : key };
    }
    return { v: own, label: inp ? inp.l : key };
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
  /* ---------- 확정한 결정: 앞 단계에서 사용자가 정한 값을 필요한 작업에만 넘긴다 ---------- */
  var DEC_KEYS = DB.ctx.filter(function (c) { return c.dec; }).map(function (c) { return c.k; });
  var VISUAL_REVIEW = ['087', '088', '090', '091', '092', '093', '096', '097', '098'];
  var FLOW_REVIEW = ['087', '088', '096', '098'];
  // 이 작업이 따라야 할 결정
  function decUse(p) {
    var u = [];
    if (p.ctx.indexOf('core') > -1) u.push('core');
    if ((p.out === 'code' && p.p !== 'persuade') || p.id === '045' || p.id === '055' || VISUAL_REVIEW.indexOf(p.id) > -1) u.push('visual');
    if ((p.p === 'product' && p.t === 'app') || FLOW_REVIEW.indexOf(p.id) > -1) u.push('flow');
    if (p.p === 'persuade' && ['077', '079'].indexOf(p.id) < 0) u.push('goal');
    if ((p.p === 'content' && ['social', 'motion', 'poster'].indexOf(p.t) > -1) || (p.p === 'convert' && ['ad', 'crm', 'poster'].indexOf(p.t) > -1)) u.push('launch');
    return u;
  }
  // 이 작업의 결과에서 정해지는 결정 (결과 맨 끝에 붙여 넣기 좋은 블록을 요청한다)
  var DEC_MAKE = {
    visual: '이미 정한 값은 그대로 두고, 주 행동 색·글자 크기·간격·모서리·터치 높이 기준을 토큰 이름과 값으로',
    flow: '정상 경로 1줄과 예외 경로 1줄(무엇이 막히고, 무엇을 유지하고, 사용자가 무엇을 골라 다시 확정하는지)',
    launch: '발행 채널, 날짜·시간, 정원, 참가비·가격, 신청 경로(같은 링크 하나)'
  };
  // 발행 결정을 쓰는 작업은 공통 브리프의 플랫폼·채널도 함께 받는다 (발행 결정에 채널이 없을 때의 기본값)
  PROMPTS.forEach(function (p) { if (decUse(p).indexOf('launch') > -1 && p.ctx.indexOf('platform') < 0) p.ctx.push('platform'); });
  // 앞 단계에 적은 원자료를 사용자가 골라서 다음 단계에 넘긴다. fills: 이 자료로 대신할 수 있는 이번 단계 입력
  var REUSE = {
    '075': [{ id: '073', k: 'traction', fills: 'dataset' }],
    '076': [{ id: '073', k: 'traction' }, { id: '075', k: 'dataset' }]
  };
  function reuseList(p) {
    var mine = state.inputs[p.id] || {};
    return (REUSE[p.id] || []).map(function (r) {
      var src = byId[r.id], label = src.in.filter(function (i) { return i.k === r.k; })[0].l.replace(/\s*\(.*\)$/, ''), text = val((state.inputs[r.id] || {})[r.k]);
      return { key: r.id + '.' + r.k, id: r.id, label: label, text: text, fills: r.fills, on: !!text && mine['@reuse:' + r.id + '.' + r.k] === true };
    });
  }
  function decMake(p) { return DB.ctx.filter(function (c) { return c.dec && c.from === p.id && DEC_MAKE[c.k]; }).map(function (c) { return c.k; }); }
  function decFilled(p) { return decUse(p).filter(function (k) { return val(state.brief[k]); }); }

  function compose(p) {
    var L = ['당신은 ' + p.role + '입니다.', '', '## 프로젝트 맥락'];
    // 브랜드 코어는 선택 칸: 있으면 바꾸지 않고 이어 쓰고, 비어 있으면 전략 프롬프트만 이 과제에서 정한다
    var hasCore = p.ctx.indexOf('core') > -1, coreSet = hasCore && val(state.brief.core), coreMaker = hasCore && !coreSet && p.t === 'strategy';
    p.ctx.forEach(function (k) {
      if (ctxByKey[k].dec) { if (k === 'core' && coreMaker) L.push('- 브랜드 코어: 아직 정하지 않음. 이 과제의 결론으로 정하세요'); return; }
      L.push('- ' + ctxByKey[k].label + ': ' + mark(resolve(k, p)));
    });
    var decs = decFilled(p);
    if (decs.length) {
      L.push('', '## 확정한 결정 (사용자가 정한 값, 가장 우선)');
      decs.forEach(function (k) { L.push('- ' + ctxByKey[k].label + ': ' + mark(resolve(k, p))); });
      if (decs.indexOf('launch') > -1) L.push('- 발행 채널: 위 "발행 채널과 신청 경로"에 채널이 적혀 있으면 그 채널이 우선합니다. 적혀 있지 않으면 프로젝트 맥락의 플랫폼·채널' + (val(state.brief.platform) ? '(' + val(state.brief.platform) + ')' : '') + '에 발행하세요.');
      L.push('- 위 값은 사용자가 이미 확정했습니다. 아래 디렉팅 원칙, 시각 기준의 예시 값, 기본 수치(예: 터치 44px)와 다르면 위 값을 따르세요. 바꾸지 말고 그대로 쓰고, 꼭 바꿔야 한다면 본문과 섞지 말고 이유와 함께 따로 제안하세요.');
    }
    L.push('', '## 과제', fill(p.task, p));
    var reused = reuseList(p).filter(function (r) { return r.on; });
    if (reused.length) {
      L.push('', '## 이전 단계에서 가져온 자료 (사용자가 확인하고 고른 원자료)');
      reused.forEach(function (r) { L.push('- ' + r.id + ' ' + r.label + ': ' + r.text); });
      L.push('- 사용자가 앞 단계에 직접 적은 원자료입니다. 숫자를 바꾸거나 다른 자료와 섞지 마세요. 기간·집단마다 분자와 분모를 따로 적고 비율을 따로 계산하세요. 대조군이 없거나 측정하지 않은 항목은 결론이 아니라 한계로 밝히세요.');
    }
    L.push('', '## 진행 방식');
    var n = 0;
    if (p.p === 'content' && p.out !== 'code' && ['social', 'motion', 'poster'].indexOf(p.t) > -1) L.push((++n) + '. 보는 사람이 지금 느끼는 감정(불안, 귀찮음, 의심 등) 1개와 다 본 뒤 느껴야 할 감정 1개를 정하세요. 장면과 문구는 그 감정의 변화를 보여 주는 데 쓰세요.');
    p.steps.forEach(function (s) { L.push((++n) + '. ' + fill(s, p)); });
    if (p.x) {
      L.push((++n) + '. ' + (state.mode === 'explore'
        ? '먼저 서로 확연히 다른 방향 3가지를 제안하세요. 방향마다 이름, 핵심 근거 1줄, 위험 요소 1줄을 붙이고, 제가 하나를 고르면 그 방향으로 아래 산출물을 완성하세요.'
        : '방향 탐색은 생략하고, 가장 근거가 강한 1안으로 아래 산출물을 완성하세요. 그 안을 고른 이유를 2줄로 덧붙이세요.'));
    }
    L.push('', '## 산출물');
    p.output.forEach(function (o) { L.push('- ' + fill(o, p)); });
    if (p.p === 'convert' && (p.out === 'code' || p.t === 'landing')) L.push('- 주요 버튼의 이벤트 이름(data-event)과, 이 화면 다음에 이어질 수익 행동 1개');
    if (p.p === 'content' && p.out !== 'code' && ['social','motion','poster'].indexOf(p.t) > -1) L.push('- 이 콘텐츠를 본 사람이 할 다음 행동 1개(앱 설치, 알림 켜기, 구독 등)와 그 행동을 잴 지표, 연결 방법(링크·UTM 등)');
    if (decs.indexOf('flow') > -1 && p.out === 'code') L.push('- 확정한 화면 흐름의 정상·예외 경로를 실제로 눌러 이동해 볼 수 있게');
    decMake(p).forEach(function (k) { L.push('- 맨 끝에 "확정 결정 · ' + ctxByKey[k].label + '" 3~6줄: ' + DEC_MAKE[k] + '. 다음 작업의 같은 이름 칸에 그대로 붙여 넣을 수 있게 쓰세요'); });
    if (coreMaker) L.push('- 맨 끝에 "브랜드 코어" 4줄: 핵심 개념 / 확정한 태그라인 1개 / 시각 모티프 1개와 쓰는 법 / 확정한 기준(주 행동 색을 포함한 색 역할과 값, 서체, 문구·알림 같은 서비스 행동). 글자 크기·간격 같은 화면 수치는 넣지 마세요. 그건 타이포·컬러 프롬프트가 화면 위계를 보고 정합니다. 다음 프롬프트의 브리프에 그대로 붙여 넣을 수 있게 쓰세요.');
    if (state.principles) {
      L.push('', '## 디렉팅 원칙');
      DB.principles.forEach(function (x) { if (x.when(p)) L.push('- ' + x.line); });
      if (p.out === 'image') L.push('- ' + DB.imageRule);
    }
    if (p.out === 'code' && p.p !== 'brand' && ['044', '053', '063', '091'].indexOf(p.id) < 0) {
      // 다른 업종의 HTML 예시는 고르는 작업(refOpt)에서는 "상세 예시 포함"을 켤 때만 넣는다. 끄면 정돈 기준 문장만 남긴다
      var ref = DB.visualRefs[pickRef(p)];
      if (p.refOpt && !state.refs) ref = ref.split('\n```')[0].split('\n').filter(function (l) { return !/^아래 예시는/.test(l); }).join('\n').replace(/\s+$/, '');
      L.push('', ref);
    }
    var deliversTable = p.output.some(function (o) { return /점검|감사|판정|진단/.test(o); });
    L.push('', '## 출력 전 자기 검수', '아래 기준은 제출하기 전에 스스로 확인하는 내부 점검입니다. 통과하지 못한 부분은 고친 결과만 내고, 이 내부 점검의 결과는 따로 쓰지 마세요.' +
      (deliversTable ? ' 단, "산출물"에 적힌 점검·판정 결과표는 의뢰인에게 납품하는 결과물이므로 그 형식 그대로 작성하세요.' : '') +
      (p.output.some(function (o) { return /관찰|미검증/.test(o); }) ? ' 시안 파일이나 주소가 없거나 직접 열어 조작할 수 없으면 관찰 근거를 지어내지 말고 그 항목을 "미검증"으로 표시하세요.' : ''));
    p.checks.forEach(function (c) { L.push('- ' + fill(c, p)); });
    if (p.out === 'code') L.push('- 그대로 열었을 때 깨지지 않는가: 가려짐·잘림·두 줄로 깨진 버튼 없음, 390px 정상, [hidden] 유지, 누를 요소 44px 이상, 본문 15px 이상, 한글 keep-all');
    if (decs.length) L.push('- 확정한 결정의 값(색·수치·경로·요청·일정·가격·링크)이 결과물 곳곳에 바뀌지 않고 같은 값으로 쓰였는가');
    if (decs.indexOf('goal') > -1) L.push('- 문서가 확정한 합의 하나를 요청하는 문장으로 끝나는가');
    if (coreSet) L.push('- 브랜드 코어(핵심 개념·태그라인·모티프)와 어긋나는 결정이 없는가. 바꿔야 한다면(예: 사용자가 이미 알아보는 기존 자산과 부딪힐 때) 본문과 섞지 말고 이유와 함께 따로 제안할 것');
    if (DB.scoreWhen(p)) L.push(typeof DB.scoreLine === 'function' ? DB.scoreLine(p) : DB.scoreLine);
    L.push('', '## 사실과 가정');
    L.push('- 프로젝트 맥락에 적힌 사실(수익 모델, 현재 상태, 숫자)은 바꾸거나 다른 가정으로 대신하지 마세요.');
    L.push('- 정보가 부족하면 멈추지 말고 가정하되, 맨 앞에 3개 이내로 모아 적고 본문에서는 [가정]으로 표시하세요.');
    L.push('- 측정하지 않은 효과("3초 안에 이해된다")는 사실이 아니라 목표로 쓰세요. "유일하다"는 비교한 범위 안에서만 주장하세요.');
    if (p.out !== 'code' && p.p === 'persuade') L.push('- 주어진 숫자는 그대로 두지 말고 서로 곱하거나 나눠, 이 과제의 판단에 필요한 지표(매출, 전환, 규모 등)로 계산해 보여 주세요. 계산식을 함께 적고, 가정한 값(수수료율 등)이 들어간 숫자는 [가정]으로 표시해 제목이나 헤드라인에 쓰지 마세요.');
    if (p.out !== 'code' && p.p === 'review') L.push('- 계산은 수정 여부나 우선순위를 바꾸는 수치만 하세요(예: 기준과 납품값의 차이 50 − 44 = 6px). 판단에 쓰이지 않는 환산(검수 시간·인건비 합계 등)은 넣지 마세요. 가정한 값이 들어간 숫자는 [가정]으로 표시하세요.');
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
        '<span class="course__body"><span class="course__title">' + esc(c.title) + '</span><span class="course__who">' + (done ? total + '단계 중 ' + done + '개 복사' : esc(c.who)) + '</span></span>' +
        I.chev + '<span class="sr">' + (done ? '' : total + '단계 중 0개 복사') + '</span></button>';
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
  // 목록에 적용한 필터를 방문 기록 칸에 함께 남긴다. 새로고침·뒤로가기 뒤에도 같은 목록으로 돌아오게 한다.
  // 같은 탭의 기록에만 남으므로 새 탭에서 연 공유 링크에는 섞이지 않는다
  function fState() { return { t: Array.from(state.f.types), o: Array.from(state.f.outs) }; }
  function patchEntry(o) { try { history.replaceState(Object.assign({}, history.state || {}, o), '', location.href); } catch (e) { /* 무시 */ } }
  function sameF(x) { var c = fState(); return !!x && String(x.t || []) === String(c.t) && String(x.o || []) === String(c.o); }
  function useF(x) {
    if (!x || sameF(x)) return false;
    state.f.types = new Set((x.t || []).filter(function (t) { return DB.types[t]; }));
    state.f.outs = new Set((x.o || []).filter(function (o) { return DB.outs[o]; }));
    return true;
  }
  function renderList(animate) {
    if (state.view === 'list' && !stack.length && history.state && !history.state.sheet && !sameF(history.state.f)) patchEntry({ f: fState() });
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
    // 버튼은 알림이 보이는 동안만 유효하다. 숨은 뒤에는 키보드로 닿아도 실행되지 않는다
    var until = Date.now() + 4000;
    a.onclick = action ? function () { if (Date.now() > until || a.hidden) { hideToast(); return; } action.fn(); hideToast(); } : null;
    if (action) a.textContent = action.label;
    t.classList.remove('is-show'); void t.offsetWidth; t.classList.add('is-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, action ? 4000 : 2400);
  }
  function hideToast() {
    var a = $('#toastAction');
    $('#toast').classList.remove('is-show', 'has-action');
    // 숨은 버튼이 키보드 탐색에 남지 않게 한다. 포커스가 그 버튼에 있었다면 본문으로 옮긴다
    a.onclick = null;
    if (document.activeElement === a) a.blur();
    a.hidden = true;
  }

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
  // 복사한 원문의 지문을 돌려준다 (실패하면 null). course: 실패 뒤 열리는 상세가 이어받을 코스
  function copyPrompt(id, quiet, course) {
    var p = byId[id], composed = compose(p), n = blanks(composed), text = plain(composed);
    return copyText(text).then(function (ok) {
      if (!ok) {
        toast('복사하지 못했어요', '프롬프트를 길게 눌러 직접 복사해 주세요.');
        // 확인창 칸을 지우는 중이면 그 뒤에 상세를 연다. 그래야 주소·방문 기록·화면·코스 출처가 맞는다
        afterHistory(function () { if (!isOpen('drawer')) openPrompt(id, true, course); });
        return null;
      }
      haptic();
      kv.set('cp', id, 1); state.copied.add(id);
      state.recent = saveList('recent', function (a) { return [id].concat(a.filter(function (x) { return x !== id; })).slice(0, 8); });
      flashCopy(id);
      var card = $('.card[data-id="' + id + '"]');
      if (card) { card.classList.add('is-copied'); card.classList.remove('is-stamped'); void card.offsetWidth; card.classList.add('is-stamped'); setTimeout(function () { card.classList.remove('is-stamped'); }, 2000); }
      if (!quiet) toast(id + ' 복사했어요', n ? '빈칸 ' + n + '개는 붙여넣은 뒤 채워 주세요.' : 'Claude에 붙여넣으세요.');
      if (isOpen('libSheet')) renderLib();
      return hashText(text);
    });
  }
  function hashText(t) { var h = 5381; for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return String(h >>> 0); }
  // 코스의 한 단계가 지금 원문과 같은 버전으로 복사됐는지. 각 코스가 마지막으로 복사한 원문을 기준으로 본다.
  // '' = 최신, 'stale' = 그 뒤 결정이 바뀜, 'unknown' = 복사 기록은 있지만 그때 원문을 모름(이전 버전에서 복사)
  function stepState(cid, id) {
    if ((state.courses[cid] || []).indexOf(id) < 0) return '';
    var h = state.copyLog[cid + ':' + id];
    if (h == null) return 'unknown';
    return h === hashText(plain(compose(byId[id]))) ? '' : 'stale';
  }

  /* ---------- 복사 전 빈칸 확인 ---------- */
  function missingFor(p) {
    var out = [];
    var covered = reuseList(p).filter(function (r) { return r.on && r.fills; }).map(function (r) { return r.fills; });
    (p.in || []).forEach(function (i) {
      if (i.opt || val((state.inputs[p.id] || {})[i.k]) || covered.indexOf(i.k) > -1) return;
      out.push({ kind: 'in', k: i.k, label: i.l, why: '이번 작업의 재료예요. 비어 있으면 AI가 내용을 지어내거나 되물어서 결과를 그대로 쓰기 어려워요.' });
    });
    p.ctx.forEach(function (k) {
      var c = ctxByKey[k]; if (c.optional || val(state.brief[k])) return;
      out.push({ kind: 'brief', k: k, label: c.label, why: '[' + c.ph + '] 빈칸으로 남아요. AI가 일반적인 예로 채워 내 서비스와 다른 답이 나올 수 있어요.' });
    });
    return out;
  }
  // 확인창도 방문 기록에 한 칸을 차지한다: 뒤로가기 한 번이면 확인창과 보류한 복사만 취소된다
  var pending = null, confirmReturn = null, confirmPushed = false, confirmNext = null;
  // 모든 복사 버튼이 거치는 길: 빈칸 확인 → 복사 → (코스에서 왔으면) 그 코스 기록
  function requestCopy(id, o) {
    o = o || {};
    pullState();
    var miss = missingFor(byId[id]);
    if (!miss.length) return doCopy(id, o);
    pending = { id: id, o: o, miss: miss };
    showConfirm();
    return Promise.resolve(false);
  }
  // 복사를 요청한 코스가 아직 화면에 있을 때만 그 코스에 기록한다 (떠난 화면의 요청은 기록하지 않는다)
  function courseLive(cid) {
    return !!cid && ((isOpen('courseSheet') && state.courseId === cid) || (isOpen('drawer') && state.drawerCourse === cid));
  }
  function doCopy(id, o) {
    pullState();
    var cid = courseLive(o.course) ? o.course : null;
    return copyPrompt(id, !!cid, cid).then(function (h) {
      var ok = h != null;
      if (ok) {
        kv.set('v', (cid || '_') + ':' + id, h); state.copyLog[(cid || '_') + ':' + id] = h;
        if (cid) recordStep(cid, id);
      }
      if (o.after) o.after(ok);
      return ok;
    });
  }
  function showConfirm() {
    var p = byId[pending.id], m = pending.miss;
    confirmReturn = document.activeElement;
    $('#cfTitle').textContent = p.id + ' 프롬프트에 빈칸 ' + m.length + '개가 있어요';
    $('#cfLead').textContent = '지금 복사하면 아래 칸이 [ ]로 남아요. 결과에 미치는 영향을 확인하고 골라 주세요.';
    $('#cfList').innerHTML = m.map(function (x) { return '<li><b>' + esc(x.label) + '</b>' + esc(x.why) + '</li>'; }).join('');
    $('#confirmScrim').hidden = false; $('#confirm').hidden = false;
    history.pushState(Object.assign({}, history.state || {}, { confirm: 1 }), '', location.href); confirmPushed = true;
    $('#cfFill').focus();
  }
  function afterHistory(fn) {
    if (confirmPushed) { var prev = confirmNext; confirmNext = function () { if (prev) prev(); fn(); }; }
    else fn();
  }
  // 화면에서만 닫는다. 보류한 복사는 버린다
  function closeConfirmUI() {
    $('#confirmScrim').hidden = true; $('#confirm').hidden = true;
    var r = confirmReturn; pending = null; confirmReturn = null;
    if (r && r.focus && document.contains(r)) r.focus({ preventScroll: true });
  }
  // 확인창을 닫고 방문 기록의 확인창 칸도 지운다. then: 기록이 정리된 뒤 할 일
  function hideConfirm(then) {
    if (confirmPushed) { confirmNext = then || null; closeConfirmUI(); history.back(); }
    else { closeConfirmUI(); if (then) then(); }
  }
  function fillFirst(pd) {
    var first = pd.miss[0];
    if (state.openId !== pd.id || !isOpen('drawer')) openPrompt(pd.id, true, pd.o.course || null);
    else if (pd.o.course) state.drawerCourse = pd.o.course;
    if (first.kind === 'in') {
      setTimeout(function () { var t = $('#in-' + pd.id + '-' + first.k); if (t) { t.scrollIntoView({ block: 'center' }); t.focus({ preventScroll: true }); } }, 420);
      toast('빈칸을 채운 뒤 "프롬프트 복사"를 누르세요', first.label);
    } else openBrief(first.k);
  }
  function recordStep(cid, id) {
    var c = courseById[cid]; if (!c) return;
    var idx = c.steps.map(function (s) { return s.id; }).indexOf(id); if (idx < 0) return;
    var fresh = kv.get('c', cid + SEP + id, undefined) === undefined;
    if (fresh) kv.set('c', cid + SEP + id, Date.now());
    state.courses = readAll().courses;
    renderCourses(); if (isOpen('courseSheet') && state.courseId === cid) renderCourse();
    var done = courseDone(c), total = c.steps.length, prog = total + '단계 중 ' + done + '개 복사';
    toast((idx + 1) + '단계 복사했어요', fresh ? prog + (done === total ? '. 결과를 같은 대화에서 다듬어 보세요.' : (idx === 0 ? '. 새 대화에 붙여넣으세요.' : '. 같은 대화에 이어서 붙여넣으세요.')) : '다시 복사했어요. 진행 기록은 그대로예요 (' + prog + ').');
  }

  function renderLibCount(bump) {
    var n = state.fav.size, el = $('#libCount');
    el.hidden = !n; el.textContent = n;
    if (bump && n) { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); }
  }
  function toggleFav(id) {
    var want = !state.fav.has(id);
    if (want) kv.set('f', id, Date.now()); else { kv.del('f', id); legacyDrop('fav', function (a) { return (a || []).filter(function (x) { return x !== id; }); }); }
    state.fav = readAll().fav;
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
  function showSheet(el, push, url, extra) {
    if (stack.indexOf(el) > -1) return;
    // push === 'here': 지금 방문 기록 칸이 이미 이 시트의 칸이다 (앞으로가기로 돌아온 경우)
    el._pushed = !!push;
    // bg: 이 시트 아래 배경 화면(홈 또는 목록). 새로고침·뒤로가기 뒤에 배경을 맞추는 데 쓴다
    if (push && push !== 'here') history.pushState(Object.assign({ sheet: el.id, bg: state.view === 'list' ? listHash(state.f.p) : '' }, state.view === 'list' ? { bgf: fState() } : {}, extra || {}), '', url || location.href);
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
    if (el.id === 'briefDrawer') { renderBriefBar(); renderList(false); if (state.openId) renderDrawer(); }
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
    if (confirmPushed) {
      // 확인창 칸에서 한 칸 뒤로: 확인창과 보류한 복사만 취소하고 아래 화면은 그대로 둔다
      confirmPushed = false;
      if (!$('#confirm').hidden) closeConfirmUI();
      var n = confirmNext; confirmNext = null; if (n) n();
      return;
    }
    if (skipPop) { skipPop = false; return; }
    var st = e.state || {};
    if (st.confirm || st.dup) {
      // 만료된 확인창 칸(앞으로가기로 다시 온 칸)은 확인창도 보류 복사도 되살리지 않는다. 이 칸을 바로 앞 칸과 같은 화면의
      // '별칭 칸'으로 표시하고 한 칸 뒤로 조용히 돌아간다. 앞으로가기를 몇 번 눌러도 별칭 칸에 머물지 않으므로 닫기 한 번이면 된다
      st = stripConfirm(st); st.dup = 1; history.replaceState(st, '', location.href);
      applyEntry(st); syncView(st, true); skipPop = true; history.back(); return;
    }
    var closed = applyEntry(st);
    // 시트를 닫고 끝나더라도 배경 화면(홈·목록)을 주소에 맞춘다
    syncView(st, closed || !!e.hasUAVisualTransition);
  });
  // 주소와 방문 기록 칸에 맞는 배경 화면. 목록 주소면 그 목적의 목록, 빈 주소면 홈, 시트 주소면 시트를 열던 때의 배경
  function viewFor(st) {
    var h = (location.hash || '').replace('#', ''), m = /^list(?:-(\w+))?$/.exec(h);
    var pOf = function (x) { return x && purposeById[x] ? x : 'all'; };
    if (m) return { view: 'list', p: pOf(m[1]) };
    if (!h) return { view: 'home' };
    if (st && typeof st.bg === 'string') { var mb = /^#?list(?:-(\w+))?$/.exec(st.bg); return mb ? { view: 'list', p: pOf(mb[1]) } : { view: 'home' }; }
    return null;
  }
  function syncView(st, instant) {
    var v = viewFor(st); if (!v) return;
    // 이 칸에 남긴 필터(목록 칸은 f, 시트 칸은 열 때의 배경 필터 bgf). 칸에 기록이 없으면(이전 버전 기록) 지금 필터를 그대로 둔다
    var cur = history.state || st || {}, changed = v.view === 'list' && useF(cur.sheet ? cur.bgf : cur.f);
    if (v.view !== state.view || (v.view === 'list' && v.p !== state.f.p)) go(v.view, { p: v.p, instant: instant !== false });
    else if (changed) renderList(false);
  }
  var skipPop = false;
  function stripConfirm(st) { st = Object.assign({}, st || {}); delete st.confirm; return st; }
  // 방문 기록 칸 하나가 뜻하는 시트 쌓임. 코스에서 연 상세는 그 코스 위에 있다
  function entrySheets(st) {
    var h = (location.hash || '').replace('#', ''), out = [];
    // 상태가 없는 칸(직접 연 주소, 새로 연 공유 링크)은 주소만 보고 정한다. 이때 상세는 코스 출처가 없다
    if (!st || !st.sheet) {
      if (/^c-/.test(h) && courseById[h.slice(2)]) out.push({ id: 'courseSheet', course: h.slice(2), direct: true });
      else if (/^\d{3}$/.test(h) && byId[h]) out.push({ id: 'drawer', prompt: h, from: null, direct: true });
      return out;
    }
    if (st.sheet === 'drawer') {
      if (st.from && courseById[st.from]) out.push({ id: 'courseSheet', course: st.from });
      if (/^\d{3}$/.test(h) && byId[h]) out.push({ id: 'drawer', prompt: h, from: st.from });
    } else if (st.sheet === 'courseSheet') {
      if (/^c-/.test(h) && courseById[h.slice(2)]) out.push({ id: 'courseSheet', course: h.slice(2) });
    } else out.push({ id: st.sheet });
    return out;
  }
  function sameSheet(el, w) {
    if (el.id !== w.id) return false;
    if (w.id === 'courseSheet') return state.courseId === w.course;
    if (w.id === 'drawer') return state.openId === w.prompt;
    return true;
  }
  // 방문 기록 칸에 맞춰 화면을 맞춘다: 맞지 않는 시트는 위에서부터 닫고(새로고침 뒤 열린 시트 포함), 빠진 시트는 그 칸 기준으로 연다
  function applyEntry(st) {
    var want = entrySheets(st), keep = 0, closed = false;
    while (keep < stack.length && keep < want.length && sameSheet(stack[keep], want[keep])) keep++;
    while (stack.length > keep) { hideSheet(stack[stack.length - 1]); closed = true; }
    for (var i = keep; i < want.length; i++) {
      var w = want[i], how = w.direct ? false : 'here';
      if (w.id === 'courseSheet') openCourse(w.course, how);
      else if (w.id === 'drawer') openPrompt(w.prompt, how, w.from);
      else if (w.id === 'briefDrawer') openBrief(null, 'here');
      else if (w.id === 'search') openSearch('here');
      else if (w.id === 'filterSheet') openFilter('here', st && st.sheet === 'filterSheet' ? st.fd : null);
      else if (w.id === 'libSheet') { if (st && (st.lib === 'fav' || st.lib === 'recent')) state.lib = st.lib; renderLib(); showSheet($('#libSheet'), 'here'); }
    }
    return closed;
  }
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
  function openSearch(push) {
    var s = $('#search');
    showSheet(s, push === undefined ? true : push);
    var q = $('#sq'); q.focus({ preventScroll: true });
    renderSearch();
  }
  function saveSearch(q) {
    q = val(q); if (!q) return;
    state.searches = saveList('searches', function (a) { return [q].concat(a.filter(function (x) { return x !== q; })).slice(0, 6); });
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
    $('#sCount').textContent = res.length
      ? '"' + q + '" 결과 ' + res.length + '개' + (res.loose && res.loose.length ? ' · "' + res.loose.join(', ') + '"은(는) 업종·상황으로 보고 작업 말로 찾았어요' : '')
      : '"' + q + '"에 맞는 프롬프트가 없어요. 아래 말로 찾아보세요.';
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
    '출시': ['출시', '런칭'], '런칭': ['출시'], '주식': ['트레이딩', '투자'], '코인': ['트레이딩'], '여행': ['여행'],
    // 사용자가 자기 업무를 말하는 표현
    '이름짓기': ['네이밍'], '상호': ['네이밍'], '가게이름': ['네이밍'], '오류': ['오류', '상태'], '실패': ['오류', '상태'], '버그': ['오류', '상태'], '안내문': ['문구', '라이팅'],
    '모집': ['카드뉴스', 'sns', '홍보물'], '홍보': ['카드뉴스', 'sns', '홍보물', '광고'], '공지': ['카드뉴스', 'sns'], '게시물': ['카드뉴스', 'sns'], '피드': ['sns', '카드뉴스'], '캡션': ['카드뉴스', 'sns'],
    '흐름': ['흐름'], '플로우': ['흐름'], '동선': ['흐름'], '토큰': ['토큰'], '디자인시스템': ['토큰', '디자인 시스템'], '시안': ['화면', '점검'], '품질': ['점검', '품질'],
    '제안서': ['제안서'], '투자자': ['피치덱', '투자'], '심사역': ['피치덱', '투자'], '미팅': ['제안서', '피치덱']
  };
  // 조사·어미를 떼어 낸 말도 함께 찾는다 (예: 카드뉴스를 → 카드뉴스, 이름짓기 → 이름)
  var TAIL = /(으로|에서|에게|부터|까지|하기|만들기|짓기|을|를|이|가|은|는|의|에|도|로|용)$/;
  function stems(w) {
    var out = [w], t = w;
    for (var i = 0; i < 2; i++) { var n = t.replace(TAIL, ''); if (n === t || n.length < 2) break; t = n; out.push(t); }
    return out;
  }
  // 띄어쓰기 없이 붙여 쓴 말(예: 예약오류) 속에서 아는 낱말을 찾는다
  var VOCAB = (function () {
    var set = {};
    Object.keys(ALIAS).forEach(function (k) { if (k.length > 1) set[k] = 1; });
    PROMPTS.forEach(function (p) { (p.title + ' ' + DB.types[p.t]).toLowerCase().split(/[^가-힣a-z0-9]+/).forEach(function (w) { if (w.length > 1) set[w] = 1; }); });
    return Object.keys(set).sort(function (a, b) { return b.length - a.length; });
  })();
  // 무엇을 하든 붙는 말은 찾는 데 쓰지 않는다
  var STOP = ['만들기', '만들어', '만들어줘', '만들고', '하기', '해줘', '하고', '싶어', '싶다', '위한', '관련', '용', '좀', '어떻게', '프롬프트'];
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
    var kept = words.filter(function (w) { return STOP.indexOf(w) < 0; });
    if (kept.length) words = kept;
    // 낱말마다 찾을 후보: 원래 말 → 조사 뗀 말 → 같은 뜻 → 붙여 쓴 말 속 낱말
    var cand = words.map(function (w) {
      var list = [], add = function (t, m) { if (t && !list.some(function (x) { return x.t === t; })) list.push({ t: t, m: m }); };
      stems(w).forEach(function (st, si) { add(st, si ? 0.95 : 1); (ALIAS[st] || []).forEach(function (a) { add(a, w.length === 1 ? 1 : 0.8); }); });
      var direct = PROMPTS.some(function (p) { return list.some(function (c) { return Object.keys(W).some(function (f) { return findTerm(p._f[f], c.t) > -1; }); }); });
      if (!direct && w.length >= 3) VOCAB.forEach(function (v) { if (w !== v && w.indexOf(v) > -1) { add(v, 0.7); (ALIAS[v] || []).forEach(function (a) { add(a, 0.6); }); } });
      return list;
    });
    PROMPTS.forEach(function (p) {
      if (words.length === 1 && /^\d{1,3}$/.test(words[0]) && p.id === words[0].padStart(3, '0')) { out.push({ p: p, score: 1000, terms: [], ctx: '', missed: 0 }); return; }
      var total = 0, terms = [], where = null, missed = 0;
      words.forEach(function (w, wi) {
        var best = 0, bestF = null, bestT = null, perField = {};
        cand[wi].forEach(function (c) {
          var t = c.t, m = c.m;
          Object.keys(W).forEach(function (f) {
            var at = findTerm(p._f[f], t); if (at < 0) return;
            var sc = W[f] * m + (f === 'title' && at === 0 && t.length > 1 ? 20 : 0);
            perField[f] = Math.max(perField[f] || 0, sc);
            if (sc > best) { best = sc; bestF = f; bestT = t; }
          });
        });
        if (!best) { missed++; return; }
        // 가장 잘 맞는 곳 + 다른 곳에서도 맞으면 조금 더
        var rest = Object.keys(perField).reduce(function (s, f) { return s + perField[f]; }, 0) - best;
        total += best + rest * 0.25; terms.push(bestT);
        if (!where || W[bestF] > W[where.f]) where = { f: bestF, t: bestT };
      });
      // 업종·상황을 뜻하는 말(공방, 예약, 북클럽)은 프롬프트에 없어도 된다. 단, 작업을 뜻하는 말 하나는 맞아야 한다
      if (missed === words.length) return;
      if (missed) total *= 0.6;
      var ctx = '';
      if (where && where.f !== 'title') {
        var label = { type: '유형', purpose: '하려는 일', task: '과제', role: '역할', out: '받는 것' }[where.f];
        var src = { type: DB.types[p.t], purpose: purposeById[p.p].label + ' (' + purposeById[p.p].ex + ')', task: plain(fill(p.task, p)), role: p.role, out: p.output.map(function (o) { return plain(fill(o, p)); }).join(' / ') }[where.f];
        ctx = label + ': ' + snippet(src, where.t);
      }
      out.push({ p: p, score: total, terms: terms, ctx: ctx, missed: missed });
    });
    out.sort(function (a, b) { return a.missed - b.missed || b.score - a.score || a.p.id.localeCompare(b.p.id); });
    // 모든 말이 맞는 결과가 있으면 그것만, 없으면 일부만 맞는 결과를 보여 준다
    if (out.length && !out[0].missed) out = out.filter(function (r) { return !r.missed; });
    else if (out.length) out.loose = words.filter(function (w, wi) { return !out.some(function (r) { return r.terms.some(function (t) { return cand[wi].some(function (c) { return c.t === t; }); }); }); });
    return out;
  }

  /* ---------- 필터 시트 ---------- */
  function openFilter(push, fd) {
    state.draft = { types: new Set(state.f.types), outs: new Set(state.f.outs) };
    // 같은 창을 새로고침했다면 적용 전에 고르던 선택을 되살린다 (배경 목록은 '적용' 전까지 그대로)
    if (fd) state.draft = { types: new Set((fd.t || []).filter(function (t) { return DB.types[t]; })), outs: new Set((fd.o || []).filter(function (o) { return DB.outs[o]; })) };
    renderFilter(); showSheet($('#filterSheet'), push === undefined ? true : push);
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
    if (history.state && history.state.sheet === 'filterSheet' && stack[stack.length - 1] === $('#filterSheet')) patchEntry({ fd: { t: Array.from(d.types), o: Array.from(d.outs) } });
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
    var nextIdx = -1, redoIdx = -1, states = c.steps.map(function (s) { return stepState(c.id, s.id); });
    c.steps.some(function (s, i) { if (doneIds.indexOf(s.id) < 0) { nextIdx = i; return true; } return false; });
    redoIdx = states.indexOf('stale'); if (redoIdx < 0) redoIdx = states.indexOf('unknown');
    $('#cMeta').innerHTML = '<span class="tag">코스</span><span class="tag">' + total + '단계</span>';
    $('#cTitle').textContent = c.title;
    $('#cWho').textContent = c.who + '에게. ' + c.result + ' 순서대로 받아요.';
    $('#cBar').style.width = (done / total * 100) + '%';
    $('#cProg').textContent = total + '단계 중 ' + done + '개 복사';
    $('#cSteps').innerHTML = c.steps.map(function (s, i) {
      var p = byId[s.id], isDone = doneIds.indexOf(s.id) > -1, st = states[i];
      return '<li class="step' + (isDone ? ' is-done' : '') + (i === nextIdx ? ' is-next' : '') + '">' +
        '<span class="step__n">' + (i + 1) + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '<div class="step__body"><button class="step__title" type="button" data-open="' + s.id + '">' + esc(p.title) + '</button><p class="step__note">' + esc(s.note) + '</p>' + (st === 'stale' ? '<span class="step__stale">결정이 바뀌었어요 · 다시 복사</span>' : st === 'unknown' ? '<span class="step__stale step__stale--unknown">버전 미확인 · 다시 복사하면 최신으로</span>' : '') + '</div>' +
        copyBtn(s.id, (i + 1) + '단계 프롬프트 복사') + '<span class="sr">' + (isDone ? '완료' : '') + '</span></li>';
    }).join('');
    $('#cNext').textContent = nextIdx > -1 ? (nextIdx + 1) + '단계 복사' : (redoIdx > -1 ? (redoIdx + 1) + '단계 다시 복사' : '모든 단계를 복사했어요');
    $('#cNext').disabled = nextIdx < 0 && redoIdx < 0;
    $('#cReset').hidden = !done;
  }
  /* ---------- 프롬프트 상세 ---------- */
  function openPrompt(id, push, course) {
    if (!byId[id]) return;
    var fresh = state.openId !== id;
    state.openId = id;
    state.drawerCourse = course && courseById[course] && courseById[course].steps.some(function (s) { return s.id === id; }) ? course : null;
    renderDrawer(true);
    if (fresh) $('#dBody').scrollTop = 0;
    // 어느 코스에서 열었는지는 이 탭의 방문 기록 칸에만 적는다. 주소(#076)를 복사해 새로 열면 출처가 없다
    if (!isOpen('drawer')) showSheet($('#drawer'), push, '#' + id, { from: state.drawerCourse });
    else if (history.state && history.state.sheet === 'drawer') history.replaceState(Object.assign({}, history.state, { from: state.drawerCourse }), '', '#' + id);
  }
  var MODE_LABEL = { explore: '3안 먼저 보기', direct: '바로 완성하기' };
  var MODE_HELP = { explore: '방향 3개를 먼저 받고, 고른 방향으로 완성해요.', direct: '가장 근거가 강한 1안을 바로 받아요.' };
  function syncOpts() {
    $$('.seg [data-mode]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === state.mode); });
    $$('[data-mode-help]').forEach(function (h) { h.textContent = MODE_HELP[state.mode]; });
    $('#dPrinciples').checked = state.principles; $('#bPrinciples').checked = state.principles; $('#dRefs').checked = state.refs;
    var p = byId[state.openId];
    if (p) {
      $('#dRefsWrap').hidden = !p.refOpt;
      $('#dDiscSum').textContent = (p.x ? MODE_LABEL[state.mode] + ', ' : '') + (state.principles ? '디렉팅 원칙 넣음' : '디렉팅 원칙 뺌') + (p.refOpt ? (state.refs ? ', 상세 예시 넣음' : ', 상세 예시 뺌') : '');
    }
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
    $('#dCtxList').innerHTML = p.ctx.filter(function (k) { return !ctxByKey[k].dec; }).map(function (k) {
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
      setDisc(false);
    }
    if (full) { renderDecs(p); renderReuse(p); }
    renderBriefRow(p); syncOpts(); renderPreview();
  }
  function renderReuse(p) {
    var list = reuseList(p).filter(function (r) { return r.text; }), box = $('#dReuse');
    box.hidden = !list.length;
    box.innerHTML = list.map(function (r) {
      return '<div class="reuse"><p class="reuse__label">이전 단계 자료 · ' + r.id + ' ' + esc(r.label) + '</p>' +
        '<p class="reuse__text">' + esc(r.text) + '</p>' +
        '<button class="btn btn--paper reuse__btn" type="button" data-reuse="' + r.key + '" aria-pressed="' + r.on + '">' + (r.on ? '이 자료 사용 중 · 빼기' : '이 자료 사용') + '</button>' +
        '<p class="field__help">' + (r.on ? '원문 그대로 "이전 단계에서 가져온 자료"로 들어가요. 이번 단계 입력은 따로 전달돼요.' : '확인하고 맞으면 고르세요. 고르기 전에는 넣지 않아요.') + '</p></div>';
    }).join('');
  }
  function renderDecs(p) {
    var use = decUse(p), make = decMake(p), makesCore = p.t === 'strategy' && use.indexOf('core') > -1;
    var keys = use.concat(make.filter(function (k) { return use.indexOf(k) < 0; }));
    $('#dDecWrap').hidden = !keys.length;
    $('#dDecs').innerHTML = keys.map(function (k) {
      var c = ctxByKey[k], v = state.brief[k] || '', fid = 'dec-' + k;
      var mk = make.indexOf(k) > -1 || (k === 'core' && makesCore);
      var help = mk
        ? '이 작업 결과 맨 끝의 "' + (k === 'core' ? '브랜드 코어' : '확정 결정 · ' + c.label) + '" 중 확정한 줄만 붙여 넣으세요.' + (use.indexOf(k) > -1 ? ' 이미 정한 값이 있으면 이 작업도 그 값을 따라요.' : '')
        : '이 작업이 따르는 결정이에요. 비워 두면 넣지 않아요.';
      var legacy = '';
      if (k === 'visual' && !val(v) && /#[0-9a-fA-F]{3,8}\b|\d+\s*px/.test(state.brief.tone || '')) {
        legacy = '<div class="legacy-note"><p>톤 키워드에 색·크기 값이 적혀 있어요: “' + esc(state.brief.tone) + '”. 이 값은 시각 기준으로 전달되지 않아요. 확정한 값이면 아래 칸에 옮겨 적고 필요 없는 말은 지우세요. 톤 키워드에는 말투만 남기면 돼요.</p>' +
          '<button class="btn btn--paper" type="button" data-legacy-tone>톤 문장을 시각 기준 칸에 붙여 넣고 고치기</button></div>';
      }
      return legacy + '<div class="field"><div class="field__head"><label class="field__label" for="' + fid + '">' + esc(c.label) + '</label></div>' +
        '<textarea class="field__input" id="' + fid + '" data-dec="' + k + '" rows="2" placeholder="' + esc(c.hint) + '">' + esc(v) + '</textarea>' +
        '<p class="field__help">' + esc(help) + '</p></div>';
    }).join('');
  }

  /* ---------- 내 브리프 ---------- */
  function renderBriefBar() {
    var req = DB.ctx.filter(function (c) { return !c.optional; }), filled = req.filter(function (c) { return val(state.brief[c.k]); }).length, total = req.length;
    $('#briefRing').style.strokeDashoffset = (100.5 * (1 - filled / total)).toFixed(1);
    $('#briefStatus').textContent = filled === total ? '모든 프롬프트에 내 정보가 들어가요' : total + '칸 중 ' + filled + '칸 채움';
    $('#briefGo').textContent = filled === total ? '고치기' : (filled ? '이어서' : '채우기');
  }
  function openBrief(startKey, push) {
    var req = DB.ctx.filter(function (c) { return !c.optional; }), empty = req.filter(function (c) { return !val(state.brief[c.k]); });
    if (startKey && ctxByKey[startKey]) showStep(ctxByKey[startKey].i);
    else if (empty.length === req.length) showStep(0);
    else if (empty.length) showStep(empty[0].i);
    else showSum();
    showSheet($('#briefDrawer'), push === undefined ? true : push);
  }
  var STEP_IDX = DB.ctx.map(function (c, i) { return c.dec ? -1 : i; }).filter(function (i) { return i > -1; });
  function showStep(i) {
    state.bIdx = i;
    var c = DB.ctx[i], total = STEP_IDX.length, pos = STEP_IDX.indexOf(i);
    $('#bStep').hidden = false; $('#bSum').hidden = true; $('#bFootStep').hidden = false; $('#bFootSum').hidden = true;
    $('#bBack').hidden = i === 0 || !!c.dec;
    $('#bBar').style.width = (c.dec ? 100 : (pos + 1) / total * 100) + '%';
    $('#bCount').textContent = c.dec ? '확정한 결정 · 선택' : (pos + 1) + ' / ' + total;
    $('#bQ').textContent = c.q;
    var input = $('#bInput'); input.value = state.brief[c.k] || ''; input.placeholder = c.hint;
    $('#bHint').textContent = c.dec ? '앞 단계 결과에서 확정한 값만 적으세요. 이 결정이 필요한 작업의 프롬프트에 들어가요.' : '비워 두고 넘어가도 돼요. 나중에 언제든 고칠 수 있어요.';
    $('#bNext').textContent = c.dec ? '저장' : (pos === total - 1 ? '완료' : '다음');
    var step = $('#bStep'); step.classList.remove('is-enter'); void step.offsetWidth; step.classList.add('is-enter');
    setTimeout(function () { input.focus({ preventScroll: true }); autoGrow(input); }, isOpen('briefDrawer') ? 60 : 380);
  }
  function showSum() {
    $('#bStep').hidden = true; $('#bSum').hidden = false; $('#bFootStep').hidden = true; $('#bFootSum').hidden = false; $('#bBack').hidden = true;
    var item = function (c) {
      var v = val(state.brief[c.k]);
      return '<li><button class="qsum__item" type="button" data-i="' + c.i + '"><span class="qsum__body"><span class="qsum__label">' + esc(c.label) + '</span><span class="qsum__val' + (v ? '' : ' is-empty') + '">' + esc(v || '비어 있음') + '</span></span>' + I.chev + '</button></li>';
    };
    $('#bList').innerHTML = DB.ctx.filter(function (c) { return !c.dec; }).map(item).join('') +
      '<li class="qsum__group">확정한 결정 (선택)</li>' + DB.ctx.filter(function (c) { return c.dec; }).map(item).join('');
    syncOpts();
  }
  function stepNext() {
    saveBrief(DB.ctx[state.bIdx].k, $('#bInput').value); renderBriefBar();
    if (state.openId && isOpen('drawer')) { renderDecs(byId[state.openId]); renderBriefRow(byId[state.openId]); renderPreview(); }
    var pos = STEP_IDX.indexOf(state.bIdx);
    if (DB.ctx[state.bIdx].dec) { showSum(); toast('결정을 저장했어요', '이 결정이 필요한 작업의 프롬프트에 들어가요.'); }
    else if (pos < STEP_IDX.length - 1) showStep(STEP_IDX[pos + 1]);
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
  // 여는 순간 보이는 탭을 이 방문 기록 칸에 남긴다 (탭을 다시 누르지 않아도 새로고침·뒤로가기 뒤 같은 탭)
  $('#openLib').addEventListener('click', function () { renderLib(); showSheet($('#libSheet'), true, null, { lib: state.lib }); });
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
      if (c.closest('#courseSheet')) requestCopy(id, { course: state.courseId });
      else { if (c.closest('#search')) saveSearch($('#sq').value); requestCopy(id); }
      return;
    }
    var m = e.target.closest('[data-mark]'); if (m) { toggleFav(m.dataset.mark); return; }
    var o = e.target.closest('[data-open]');
    if (o) { if (o.closest('#search')) saveSearch($('#sq').value); openPrompt(o.dataset.open, true, o.closest('#courseSheet') ? state.courseId : null); return; }
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
  $('#libSheet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lib]'); if (!b) return;
    state.lib = b.dataset.lib; renderLib();
    if (history.state && history.state.sheet === 'libSheet') patchEntry({ lib: state.lib });
  });

  // 코스
  $('#cNext').addEventListener('click', function () {
    var c = courseById[state.courseId], d = state.courses[c.id] || [];
    var next = c.steps.filter(function (s) { return d.indexOf(s.id) < 0; })[0] || c.steps.filter(function (s) { return stepState(c.id, s.id) === 'stale'; })[0] || c.steps.filter(function (s) { return stepState(c.id, s.id) === 'unknown'; })[0];
    if (next) requestCopy(next.id, { course: c.id });
  });
  $('#cShare').addEventListener('click', function () {
    var url = location.origin + location.pathname + '#c-' + state.courseId;
    copyText(url).then(function (ok) { toast(ok ? '코스 링크를 복사했어요' : '복사하지 못했어요', ok ? '팀원이 열면 같은 순서로 따라올 수 있어요.' : url); });
  });
  // 전체 초기화마다 범위별 세대를 올린다. 되돌리기는 내 초기화 뒤에 같은 범위의 초기화가 또 없었을 때만 실행된다
  // 초기화마다 고유 표식을 범위 키에 기록한다. 같은 순간 두 탭이 초기화해도 마지막에 저장된 표식 하나만 남으므로
  // 되돌리기는 그 한 작업만 유효하다. 표식 저장에 실패하면 되돌리기를 제공하지 않는다. 예전 숫자 세대도 그대로 읽는다
  // seen: 이 초기화를 시작할 때 보였던 표식. 그 사이 표식이 바뀌었다면 같은 순간의 다른 탭 초기화이므로
  // 그 탭이 지운 내용까지 합쳐 기록한다. 그래야 마지막에 남는 하나의 되돌리기가 두 탭이 지운 것을 모두 되살린다
  function bumpGen(scope, seen, removed) {
    var tok = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), now = genNow(scope), data = removed;
    if (now !== seen) { var prev = store.get('u' + SEP + scope, null); if (prev && prev.t === now) data = mergeRemoved(prev.d, removed); }
    if (!store.set('u' + SEP + scope, { t: tok, at: Date.now(), d: data })) return null;
    return store.set('g' + SEP + scope, tok) ? { tok: tok, data: data } : null;
  }
  // 되돌리기 사본은 동시 초기화를 합치는 짧은 순간에만 필요하다. 되돌리기 버튼(4초)이 끝나면 지우고,
  // 탭이 닫혀 남은 사본이나 이전 버전이 남긴 사본은 시작할 때·백업할 때 정리한다. 유효한 되돌리기는 사본이 아니라 그 탭의 메모리로 실행된다
  var UNDO_TTL = 5000, myUndo = {};
  // 탭을 닫거나 다른 주소로 떠날 때 이 탭이 남긴 사본을 지운다 (되돌리기 버튼도 함께 사라진다)
  window.addEventListener('pagehide', function () { Object.keys(myUndo).forEach(function (sc) { purgeUndo(sc, myUndo[sc]); }); });
  function undoAge(u) { var t = u && (u.at || parseInt(String(u.t || '').split('-')[0], 36)); return t ? Date.now() - t : Infinity; }
  function purgeUndo(scope, tok) {
    try {
      var pre = 'db.u' + SEP, ks = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(pre) === 0) ks.push(k); }
      ks.forEach(function (k) {
        var u = null; try { u = JSON.parse(localStorage.getItem(k)); } catch (e) { /* 깨진 값은 지운다 */ }
        var mine = scope && k === pre + scope && u && u.t === tok;
        if (mine || undoAge(u) > UNDO_TTL) { localStorage.removeItem(k); if (mine) delete myUndo[scope]; }
      });
    } catch (e) { /* 저장소를 못 읽는 환경 */ }
  }
  function mergeRemoved(a, b) {
    var o = {}; [a, b].forEach(function (x) { Object.keys(x || {}).forEach(function (k) {
      var v = x[k]; o[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? Object.assign({}, o[k] || {}, v) : (k in o ? o[k] : v); }); });
    return o;
  }
  function genNow(scope) { var v = store.get('g' + SEP + scope, 0); return v == null ? '' : String(v); }
  // 같은 범위의 초기화·되돌리기는 탭 사이에서 한 번에 하나씩만 실행한다(Web Locks). 지원하지 않는 브라우저는 바로 실행하고 위 표식 비교로 막는다
  function withLock(scope, fn) {
    if (navigator.locks && navigator.locks.request) navigator.locks.request('db-reset:' + scope, function () { fn(); }).catch(function () { fn(); });
    else fn();
  }
  var liveUndo = null;
  function undoToast(msg, scope, op, fn) {
    if (!op) { liveUndo = null; toast(msg, '저장 공간이 부족해 되돌리기를 기록하지 못했어요.'); return; }
    var gen = op.tok;
    liveUndo = { scope: scope, gen: gen };
    myUndo[scope] = gen; setTimeout(function () { purgeUndo(scope, gen); }, 4500);
    var until = Date.now() + 4000;
    toast(msg, null, { label: '되돌리기', fn: function () {
      liveUndo = null;
      if (Date.now() > until) return;   // 만료된 되돌리기는 어떤 경로로도 실행하지 않는다
      // 버튼이 보였더라도 누른 순간에 다시 확인한다
      withLock(scope, function () {
        if (genNow(scope) !== gen) { toast('되돌릴 수 없어요', '그 뒤에 다른 탭에서 같은 범위를 다시 초기화했어요.'); return; }
        fn(op.data); purgeUndo(scope, gen);
      });
    } });
  }
  $('#cReset').addEventListener('click', function () { var cid = state.courseId; withLock('course:' + cid, function () { resetCourse(cid); }); });
  function resetCourse(id) {
    var scope = 'course:' + id, seen = genNow(scope), removed = { c: {}, v: {} }, cur = readAll(), cc = kv.all('c');
    (cur.courses[id] || []).forEach(function (step, n) { var k = id + SEP + step; removed.c[k] = cc[k] != null ? cc[k] : n + 1; kv.del('c', k); });
    Object.keys(cur.copyLog).forEach(function (k) { if (k.indexOf(id + ':') === 0) { removed.v[k] = cur.copyLog[k]; kv.del('v', k); } });
    legacyDrop('courses', function (c) { delete c[id]; });
    legacyDrop('copylog2', function (l) { Object.keys(l).forEach(function (k) { if (k.indexOf(id + ':') === 0) delete l[k]; }); });
    // 실제로 지운 것이 없으면(다른 탭이 방금 먼저 지움) 표식을 바꾸지 않는다. 그래야 실제로 지운 탭의 되돌리기가 유효하게 남는다
    if (!Object.keys(removed.c).length && !Object.keys(removed.v).length) { pullState(); renderCourse(); renderCourses(); toast('지울 진행 기록이 없어요', '다른 탭에서 이미 지웠다면 그 탭에서 되돌릴 수 있어요.'); return; }
    var op = bumpGen(scope, seen, removed);
    pullState(); renderCourse(); renderCourses();
    undoToast('진행 기록을 지웠어요', scope, op, function (removed) {
      // 내가 지운 단계만 되살린다. 그 사이 다른 탭이 같은 단계를 다시 복사했다면 그 기록이 더 새것이라 그대로 둔다
      Object.keys(removed.c || {}).forEach(function (k) { if (kv.raw('c', k) == null) kv.set('c', k, removed.c[k]); });
      Object.keys(removed.v || {}).forEach(function (k) { if (kv.raw('v', k) == null) kv.set('v', k, removed.v[k]); });
      pullState(); renderCourse(); renderCourses();
    });
  }

  // 저장 공간 알림
  $('#saveRetry').addEventListener('click', function () {
    // 순서: 저장하지 못한 초안을 먼저 저장하고(가장 최근 입력), 그다음 이관을 다시 시도한다
    var a = retryDrafts(), b = absorbLegacy();
    pullState(); renderBriefBar(); renderCourses(); renderLibCount(); if (isOpen('courseSheet')) renderCourse(); if (state.openId && isOpen('drawer')) { syncFields(); renderPreview(); }
    if (a && b) toast('저장했어요', '이제 새로고침하거나 다른 탭에서 열어도 그대로예요.');
    else toast('아직 공간이 부족해요', '저장하지 못한 내용은 이 탭과 백업에 그대로 있어요.');
    renderSaveWarn();
  });
  $('#saveBackup').addEventListener('click', downloadBackup);
  $('#saveWarnClose').addEventListener('click', function () { warnClosed = true; renderSaveWarn(); });

  // 빈칸 확인
  $('#cfFill').addEventListener('click', function () { var pd = pending; if (!pd) return; hideConfirm(function () { fillFirst(pd); }); });
  // 클립보드는 누른 순간에만 쓸 수 있으므로 복사를 먼저 하고 확인창 기록을 지운다
  $('#cfBlank').addEventListener('click', function () { var pd = pending; if (!pd) return; doCopy(pd.id, pd.o); hideConfirm(); });
  $('#cfCancel').addEventListener('click', function () { hideConfirm(); });
  $('#confirmScrim').addEventListener('click', function () { hideConfirm(); });
  // 확인창을 띄운 채 다른 주소로 옮겨 가면 보류한 복사는 실행될 수 없다
  window.addEventListener('hashchange', function () { if (!$('#confirm').hidden) { confirmPushed = false; confirmNext = null; closeConfirmUI(); } });

  // 상세
  $('#dCopy').addEventListener('click', function () {
    var btn = this;
    requestCopy(state.openId, { course: state.drawerCourse, after: function (ok) {
      if (!ok) return;
      btn.textContent = '복사했어요'; btn.classList.add('is-done');
      setTimeout(function () { btn.textContent = '프롬프트 복사'; btn.classList.remove('is-done'); }, 1600);
    } });
  });
  $('#dShare').addEventListener('click', function () {
    var url = location.origin + location.pathname + '#' + state.openId;
    copyText(url).then(function (ok) { toast(ok ? '링크를 복사했어요' : '복사하지 못했어요', ok ? '받는 사람이 열면 이 프롬프트가 바로 보여요.' : url); });
  });
  $('#dFav').addEventListener('click', function () { toggleFav(state.openId); });
  $('#dFoldBtn').addEventListener('click', function () { setFold(this.getAttribute('aria-expanded') !== 'true'); });
  // 접힌 고급 설정은 높이만 0이 아니라 키보드 포커스와 접근성 트리에서도 빠진다 (inert). 숨은 스위치가 복사 원문을 바꾸지 못하게 한다
  function setDisc(open) {
    var panel = $('#dDiscPanel');
    $('#dDisc').setAttribute('aria-expanded', open); panel.classList.toggle('is-open', open);
    panel.inert = !open; if (open) panel.removeAttribute('aria-hidden'); else panel.setAttribute('aria-hidden', 'true');
    if (!open && panel.contains(document.activeElement)) $('#dDisc').focus();
  }
  $('#dDisc').addEventListener('click', function () { setDisc(this.getAttribute('aria-expanded') !== 'true'); });
  $('#dNext').addEventListener('click', function (e) {
    var b = e.target.closest('[data-next]'); if (!b) return;
    copyText(byId[state.openId].next[+b.dataset.next]).then(function (ok) {
      if (ok) { haptic(); b.classList.remove('is-done'); void b.offsetWidth; b.classList.add('is-done'); setTimeout(function () { b.classList.remove('is-done'); }, 1600); }
      toast(ok ? '다음 단계 프롬프트를 복사했어요' : '복사하지 못했어요', ok ? '첫 결과가 나온 같은 대화에 붙여넣으세요.' : '문장을 길게 눌러 직접 복사해 주세요.');
    });
  });
  $('#dInputs').addEventListener('input', function (e) {
    var k = e.target.dataset.k; if (!k) return;
    saveInput(state.openId, k, e.target.value); renderPreview();
    var exb = $('#dInputs [data-ex="' + k + '"]'); if (exb) exb.hidden = !!val(e.target.value);
  });
  $('#dReuse').addEventListener('click', function (e) {
    var b = e.target.closest('[data-reuse]'); if (!b) return;
    var id = state.openId, key = b.dataset.reuse;
    saveInput(id, '@reuse:' + key, b.getAttribute('aria-pressed') !== 'true');
    renderReuse(byId[id]); renderPreview(); haptic();
    var nb = $('#dReuse [data-reuse="' + key + '"]'); if (nb) nb.focus({ preventScroll: true });
  });
  $('#dDecs').addEventListener('click', function (e) {
    if (!e.target.closest('[data-legacy-tone]')) return;
    var tone = state.brief.tone || '';
    saveBrief('visual', tone); renderDecs(byId[state.openId]); renderPreview(); renderBriefBar();
    var t = $('#dec-visual'); if (t) { t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length); }
    toast('시각 기준 칸에 옮겼어요', '확정한 색·크기만 남기고 나머지는 지우세요.');
  });
  $('#dDecs').addEventListener('input', function (e) {
    var k = e.target.dataset.dec; if (!k) return;
    saveBrief(k, e.target.value);
    renderPreview(); renderBriefBar();
    if (isOpen('courseSheet')) renderCourse();
  });
  $('#dInputs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ex]'); if (!b) return;
    var k = b.dataset.ex, id = state.openId, t = $('#in-' + id + '-' + k), ex = EX[id + '.' + k];
    if (!t || !ex) return;
    t.value = ex; t.classList.remove('is-filled-anim'); void t.offsetWidth; t.classList.add('is-filled-anim');
    saveInput(id, k, ex);
    b.hidden = true; renderPreview(); haptic();
    toast('예시를 넣었어요', '내 상황에 맞게 고쳐서 쓰세요.');
  });
  $('#dBody').addEventListener('click', function (e) {
    if (!e.target.closest('#dEditBrief')) return;
    var p = byId[state.openId];
    openBrief(p.ctx.filter(function (k) { return !ctxByKey[k].optional && !val(state.brief[k]); })[0] || null);
  });

  // 브리프
  var bInput = $('#bInput');
  bInput.addEventListener('input', function () { saveBrief(DB.ctx[state.bIdx].k, bInput.value); autoGrow(bInput); });
  bInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); stepNext(); } });
  $('#bNext').addEventListener('click', stepNext);
  $('#bSkip').addEventListener('click', stepNext);
  $('#bBack').addEventListener('click', function () { var pos = STEP_IDX.indexOf(state.bIdx); if (pos > 0) showStep(STEP_IDX[pos - 1]); });
  $('#bList').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) showStep(+b.dataset.i); });
  $('#briefClear').addEventListener('click', function () { withLock('brief', clearBrief); });
  function clearBrief() {
    var seen = genNow('brief'), removed = readAll().brief;
    Object.keys(removed).forEach(function (k) { kv.del('b', k); });
    legacyDrop('brief', function () { return {}; });
    if (!Object.keys(removed).length) { pullState(); showSum(); renderBriefBar(); toast('비울 브리프가 없어요', '다른 탭에서 이미 비웠다면 그 탭에서 되돌릴 수 있어요.'); return; }
    var op = bumpGen('brief', seen, removed);
    pullState(); showSum(); renderBriefBar();
    undoToast('브리프를 비웠어요', 'brief', op, function (removed) {
      // 지운 뒤 아무도 다시 적지 않은 칸만 되살린다. 그 사이 다른 탭(또는 이 탭)에서 새로 적은 칸은 그 값이 우선이다
      Object.keys(removed).forEach(function (k) { if (kv.raw('b', k) == null) kv.set('b', k, removed[k]); });
      pullState(); showSum(); renderBriefBar();
      if (state.openId && isOpen('drawer')) renderDrawer(true);
    });
  }
  $$('.seg [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { state.mode = b.dataset.mode; store.set('mode', state.mode); syncOpts(); renderPreview(); });
  });
  $('#dRefs').addEventListener('change', function () { state.refs = this.checked; store.set('refs', state.refs); syncOpts(); renderPreview(); });
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
    if (!$('#confirm').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hideConfirm(); return; }
      if (e.key === 'Tab') {
        var cf = $$('#confirm button'), a = cf[0], z = cf[cf.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      return;
    }
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

  /* ---------- 다른 탭에서 저장한 값 받기 ---------- */
  function syncFields() {
    var notTyping = function (el) { return el.dataset.dirty !== '1'; };
    $$('#dDecs [data-dec]').forEach(function (t) { if (notTyping(t)) t.value = state.brief[t.dataset.dec] || ''; });
    var inp = state.inputs[state.openId] || {};
    $$('#dInputs [data-k]').forEach(function (t) { if (notTyping(t) && 'value' in t) t.value = inp[t.dataset.k] || ''; });
    var b = $('#bInput'); if (isOpen('briefDrawer') && !$('#bStep').hidden && notTyping(b)) b.value = state.brief[DB.ctx[state.bIdx].k] || '';
  }
  window.addEventListener('storage', function (e) {
    if (e.key !== null && String(e.key).indexOf('db.') !== 0) return;
    if (/^db\.(brief|inputs|courses|copylog2|fav|copied)$/.test(e.key || '') && e.newValue != null) absorbLegacy();
    if (liveUndo && genNow(liveUndo.scope) !== liveUndo.gen) { liveUndo = null; hideToast(); }
    renderSaveWarn();
    pullState(); syncFields();
    renderBriefBar(); renderCourses(); renderLibCount(); syncOpts();
    if (isOpen('courseSheet')) renderCourse();
    if (state.openId && isOpen('drawer')) { renderBriefRow(byId[state.openId]); renderReuse(byId[state.openId]); renderPreview(); $('#dFav').setAttribute('aria-pressed', state.fav.has(state.openId)); }
    if (isOpen('libSheet')) renderLib();
    if (isOpen('briefDrawer') && !$('#bSum').hidden) showSum();
  });

  /* ---------- 시작 ---------- */
  purgeUndo();
  renderSaveWarn();
  function fromHash() {
    var h = (location.hash || '').replace('#', '');
    var hs = history.state || {};
    if (/^\d{3}$/.test(h) && byId[h] && state.openId !== h) openPrompt(h, false, hs.sheet === 'drawer' ? hs.from : null);
    else if (/^c-/.test(h) && courseById[h.slice(2)] && state.courseId !== h.slice(2)) openCourse(h.slice(2), false);
  }
  renderGoals(); renderCourses(); renderRail(); renderList(false);
  renderBriefBar(); renderLibCount(); renderPrinciples(); renderRuler();
  if (history.state && history.state.sheet) {
    // 같은 탭에서 새로고침: 이 방문 기록 칸이 뜻하는 화면(배경 목록, 부모 코스, 필터·보관함 포함)을 그대로 다시 쌓는다
    var hs0 = stripConfirm(history.state), wasConfirm = !!(history.state.confirm || history.state.dup);
    body.classList.remove('is-intro'); syncView(hs0, true);
    if (wasConfirm) {
      // 확인창이 떠 있던 칸: 보류한 복사는 실행하지 않는다. 이 칸은 바로 앞 칸과 같은 화면이므로 별칭 칸으로 표시하고
      // 조용히 앞 칸으로 돌아간다. 그래야 닫기 한 번에 이전 화면으로 간다
      hs0.dup = 1; history.replaceState(hs0, '', location.href); applyEntry(hs0); skipPop = true; history.back();
    } else applyEntry(hs0);
  }
  else if (/^#list/.test(location.hash)) { body.classList.remove('is-intro'); useF(history.state && history.state.f); route(true); history.replaceState({ view: 'list', f: fState() }, '', location.href); }
  else fromHash();
  window.addEventListener('load', function () {
    body.classList.remove('is-loading'); moveInd(true);
    // 첫 등장 애니메이션은 한 번만: 홈으로 돌아올 때 다시 재생되지 않게
    setTimeout(function () { body.classList.remove('is-intro'); }, 1400);
  });

  window.DirectorsBrief = { compose: function (id) { return plain(compose(byId[id])); }, saved: function () { var r = readAll(); return { brief: r.brief, inputs: r.inputs, courses: r.courses, copyLog: r.copyLog, fav: Array.from(r.fav), copied: Array.from(r.copied) }; }, search: function (q) { return searchPrompts(q).map(function (r) { return r.p.id; }); }, state: state, go: go };
})();
