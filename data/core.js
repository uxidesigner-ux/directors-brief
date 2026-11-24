/*
 * Director's Brief — 분류 체계와 디렉팅 원칙
 * 프롬프트 본문은 data/p1~p6 파일에 있고, 실제로 복사되는 문장은 app.js의 compose()가 조립합니다.
 */
window.DB = {
  purposes: [
    // label: 화면에 보이는 이름(전문 용어 대신 하려는 일), ex: 타일에 보일 대표 결과물
    { id: 'brand',    label: '브랜드 만들기', ex: '포지셔닝, 이름, 로고, 컬러',  desc: '브랜드의 뼈대를 세울 때' },
    { id: 'convert',  label: '판매·마케팅',   ex: '랜딩, 상세페이지, 광고',      desc: '방문자를 고객으로 바꿀 때' },
    { id: 'product',  label: '앱·웹 화면',    ex: '홈 화면, 흐름, 디자인 시스템', desc: '앱과 웹의 화면을 설계할 때' },
    { id: 'content',  label: '콘텐츠·SNS',    ex: '썸네일, 카드뉴스, 일러스트',   desc: '매주 콘텐츠를 만들 때' },
    { id: 'persuade', label: '발표·보고',     ex: '피치덱, 보고서, 차트',        desc: '결정을 끌어내야 할 때' },
    { id: 'review',   label: '점검·개선',     ex: 'UX 감사, 접근성, 출시 점검',   desc: '만든 결과물을 끌어올릴 때' }
  ],

  types: {
    strategy:  '브랜드 전략',
    naming:    '네이밍·말투',
    logo:      '로고',
    identity:  '브랜드 키트',
    icon:      '아이콘',
    color:     '컬러·타이포',
    image:     '이미지·일러스트',
    package:   '패키지',
    landing:   '랜딩·웹페이지',
    detail:    '상세페이지·비교표',
    ad:        '광고·배너',
    crm:       '이메일·알림',
    poster:    '포스터·인쇄',
    app:       '앱 화면',
    writing:   'UX 라이팅',
    dashboard: '대시보드·데이터',
    system:    '디자인 시스템',
    motion:    '인터랙션·모션',
    social:    'SNS·썸네일',
    slide:     '슬라이드',
    doc:       '문서·편집',
    review:    '리뷰·점검'
  },

  // 결과물이 어떤 형태로 나오는지
  outs: {
    text:  '전략·문서',
    image: '이미지 프롬프트',
    code:  'HTML 코드',
    spec:  '디자인 명세'
  },

  // "내 브리프"에서 한 번만 입력하면 모든 프롬프트에 들어가는 공통 정보
  ctx: [
    { k: 'brand',    label: '브랜드/서비스',     ph: '브랜드명',        q: '브랜드나 서비스 이름이 뭔가요?',              hint: '예: 루트다이어리' },
    { k: 'what',     label: '한 줄 정의',        ph: '서비스 한 줄 정의', q: '한 줄로 설명하면 어떤 서비스인가요?',          hint: '예: 여행 동선을 하루 단위로 기록하는 앱' },
    { k: 'audience', label: '핵심 사용자',       ph: '핵심 사용자',      q: '누가 가장 많이 쓰나요?',                     hint: '예: 한국을 처음 여행하는 20~30대 외국인' },
    { k: 'need',     label: '사용자가 겪는 문제', ph: '사용자가 겪는 문제', q: '그 사람들이 겪는 가장 큰 불편은 뭔가요?',       hint: '예: 낯선 도시에서 동선과 안전을 확신하기 어렵다' },
    { k: 'alt',      label: '경쟁사·대안',       ph: '경쟁사·대안',      q: '지금은 무엇으로 그 불편을 해결하고 있나요?',     hint: '예: 구글맵 저장 목록, 트리플, 블로그 검색' },
    { k: 'money',    label: '수익 모델',         ph: '수익 모델',        q: '어떻게 돈을 버나요?',                        hint: '예: 월 구독 6,900원 + 현지 가이드 연결 수수료' },
    { k: 'tone',     label: '톤 키워드',         ph: '톤 키워드 3개',     q: '어떤 느낌으로 보이고 싶나요?',                hint: '예: 차분한, 믿음직한, 위트 있는' },
    { k: 'platform', label: '플랫폼·채널',       ph: '플랫폼·채널',      q: '사용자를 주로 어디에서 만나나요?',             hint: '예: 모바일 웹 우선, 인스타그램' },
    { k: 'core',     label: '브랜드 코어',       ph: '브랜드 코어',      q: '이미 정한 브랜드 핵심이 있나요? (없으면 건너뛰세요)', hint: '001 포지셔닝 결과 맨 끝의 "브랜드 코어" 4줄을 붙여 넣으세요', optional: true }
  ],

  /*
   * 디렉팅 원칙 — 실무 기준을 프롬프트에 그대로 넣을 수 있는 문장으로 정리했습니다.
   * when(p): 이 원칙을 어떤 프롬프트에 넣을지 결정합니다.
   */
  principles: [
    { id: 1,  title: '쓰임새 먼저',
      body: '보기 좋은지보다 사용자가 이것으로 무엇을 끝내는지를 먼저 판단합니다.',
      line: '보기 좋은지보다 사용자가 이것으로 무엇을 끝내는지를 먼저 판단한다.',
      when: function () { return true; } },
    { id: 2,  title: '3초 규칙',
      body: '처음 보는 사람이 3초 안에 무엇인지, 다음에 무엇을 할지 알아야 합니다.',
      line: '처음 보는 사람이 3초 안에 무엇인지, 다음에 무엇을 할지 알 수 있어야 한다.',
      when: function () { return true; } },
    { id: 3,  title: '해석은 시스템이, 선택은 사용자가',
      body: '해석·계산·비교를 사용자에게 떠넘기지 않습니다. 시스템이 정리하고 사용자는 고르기만 합니다.',
      line: '해석·계산·비교를 사용자에게 떠넘기지 않는다. 시스템이 정리하고 사용자는 고르기만 한다.',
      when: function (p) { return ['convert', 'product', 'review'].indexOf(p.p) > -1; } },
    { id: 4,  title: '수익과 연결',
      body: '모든 디자인 결정이 전환·재방문·결제 중 무엇에 기여하는지 설명할 수 있어야 합니다.',
      line: '모든 디자인 결정이 전환·재방문·결제 중 무엇에 기여하는지 설명할 수 있어야 한다.',
      when: function (p) { return p.p !== 'content'; } },
    { id: 5,  title: '완성도는 수치로',
      body: '간격 8px 배수, 타입 1.25 비율, 텍스트 대비 4.5:1 이상, 한글 본문 14px·보조 12px 이상.',
      line: '간격은 8px 배수, 타입은 1.25 비율, 텍스트 대비는 4.5:1 이상, 한글 본문은 14px·보조 텍스트는 12px 이상으로 한다.',
      when: function (p) { return p.out === 'code' || p.out === 'spec' || p.p === 'product'; } },
    { id: 6,  title: '상태까지 디자인',
      body: '기본·로딩·빈 화면·오류·성공 상태를 함께 설계합니다. 스피너만 두지 않고 스켈레톤이나 진행률을 씁니다.',
      line: '기본·로딩·빈 화면·오류·성공 상태를 함께 설계한다. 스피너만 두지 않고 스켈레톤이나 진행률을 쓴다.',
      when: function (p) { return ['convert', 'product', 'review'].indexOf(p.p) > -1 && p.out !== 'image'; } },
    { id: 7,  title: '조작하고 싶은 인터랙션',
      body: '누르면 0.1초 안에 반응하고, 실수는 확인창보다 되돌리기로 막습니다. 움직임은 변화를 설명할 때만 씁니다.',
      line: '누르면 0.1초 안에 반응하고, 실수는 확인창보다 되돌리기로 막는다. 움직임은 상태 변화를 설명할 때만 쓴다.',
      when: function (p) { return p.out === 'code' || p.p === 'product'; } },
    { id: 8,  title: '말은 지시문처럼',
      body: '비유 대신 읽자마자 할 일이 보이는 문장을 씁니다. 오류는 원인과 다음 행동까지 말합니다.',
      line: '비유 대신 읽자마자 할 일이 보이는 문장을 쓴다. 오류 문구는 원인과 다음 행동까지 말한다.',
      when: function () { return true; } },
    { id: 9,  title: '냉정한 근거',
      body: '칭찬과 형용사 대신 근거와 수치로 말합니다. 모든 결정에 "왜"를 한 줄 붙입니다.',
      line: '칭찬과 형용사 대신 근거와 수치로 말한다. 모든 결정에 "왜"를 한 줄 붙인다.',
      when: function () { return true; } },
    { id: 11, title: '하나의 생각에서',
      body: '브랜드의 모든 결정은 하나의 핵심 개념에서 나옵니다. 말투, 모티프, 색, 이미지가 같은 생각을 각자의 방식으로 말해야 합니다.',
      line: '모든 결정은 하나의 핵심 개념에서 출발한다. 말투·모티프·색·이미지가 같은 생각을 각자의 방식으로 말하는지 확인한다.',
      when: function (p) { return p.p === 'brand'; } },
    { id: 10, title: '누구나 이해하는 말',
      body: '전문 용어는 처음 보는 사람도 이해할 수 있게 풀어 씁니다.',
      line: '전문 용어는 처음 보는 사람도 이해할 수 있게 풀어 쓴다.',
      when: function () { return true; } }
  ],

  // 이미지 생성용 프롬프트에만 추가되는 규칙
  imageRule: '이미지 생성 프롬프트는 빛 방향·렌즈·구도·색온도를 구체적으로 쓰고, 실존 인물·다른 브랜드 로고·저작권 캐릭터를 넣지 않는다.',

  // 5대 기준 자체 채점 — 결과물이 서비스로 이어지는 작업에 붙습니다
  scoreLine: '마지막에 쓰임새·니즈 해소·수익화 가능성·시각 완성도·조작하고 싶은 매력 5개 기준으로 10점 만점 자체 채점표를 붙이고, 7점 미만 항목은 무엇을 고치면 오르는지 한 줄씩 쓰세요.',
  scoreWhen: function (p) { return ['convert', 'product', 'review'].indexOf(p.p) > -1; }
};

// 코드형 결과물의 시각 기준: 글 지시보다 정돈된 예시가 시각 완성도를 올렸다 (블라인드 비교 3.67 → 4.0)
window.DB.visualRef = "## 시각 기준\n아래 예시는 모양이 아니라 정돈 수준의 기준입니다. 베끼지 말고, 이 프로젝트의 브랜드 색과 성격으로 이 수준을 만드세요.\n- 간격은 8·16·24·48px 네 단계만 씁니다. 같은 관계의 요소는 같은 간격입니다.\n- 글자는 네 단계 이내이고, 화면 제목은 본문의 2배 이상입니다. 숫자는 고정폭(tabular-nums)입니다.\n- 강조색은 한 화면에서 한 가지 역할(주 행동)만 맡습니다. 나머지는 먹색과 회색 단계로 위계를 만듭니다.\n- 데스크톱에서는 빈 반쪽을 남기지 않습니다. 2열로 채우거나 본문 폭을 줄입니다.\n- 나란한 카드는 높이를 맞춥니다. 버튼과 버튼처럼 보이는 링크에는 밑줄이 없습니다.\n- 그림자는 두 단계까지, 모서리는 요소 크기에 따라 두 단계(작은 요소 8px, 카드 16px)입니다.\n\n```html\n<section class=\"ref\">\n  <div class=\"ref__split\">\n    <div>\n      <h2 class=\"ref__title\">이번 달 부가세, 미리 준비됐어요</h2>\n      <p class=\"ref__lead\">카드·배달 매출을 모아 예상 세액을 계산해 두었어요.</p>\n      <a class=\"ref__btn\" href=\"#\">신고 준비하기</a>\n    </div>\n    <div class=\"ref__cards\">\n      <article class=\"ref__card\"><p class=\"ref__label\">예상 납부액</p><p class=\"ref__num\">1,240,000원</p><p class=\"ref__meta\">지난 분기보다 8% 적어요</p></article>\n      <article class=\"ref__card\"><p class=\"ref__label\">마감까지</p><p class=\"ref__num\">7일</p><p class=\"ref__meta\">1월 25일까지</p></article>\n    </div>\n  </div>\n</section>\n<style>\n.ref { --ink:#191f28; --ink-2:#4e5968; --ink-3:#6b7684; --bg:#f2f4f6; --surface:#fff; --accent:#2f6feb; background:var(--bg); color:var(--ink); padding:48px 16px; font:400 16px/1.6 Pretendard, system-ui, sans-serif; word-break:keep-all; }\n.ref__split { max-width:1040px; margin:0 auto; display:grid; gap:24px; }\n@media (min-width:960px) { .ref__split { grid-template-columns:5fr 6fr; gap:48px; align-items:center; } }\n.ref__title { margin:0; font-size:clamp(28px, 4.4vw, 44px); line-height:1.25; letter-spacing:-0.03em; font-weight:800; }\n.ref__lead { margin:16px 0 24px; font-size:18px; color:var(--ink-2); }\n.ref__btn { display:inline-flex; align-items:center; height:56px; padding:0 24px; border-radius:12px; background:var(--accent); color:#fff; font-weight:700; text-decoration:none; }\n.ref__cards { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:stretch; }\n.ref__card { background:var(--surface); border-radius:16px; padding:24px; box-shadow:0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06); }\n.ref__label { margin:0; font-size:14px; color:var(--ink-3); }\n.ref__num { margin:8px 0; font-size:32px; line-height:1.2; font-weight:700; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }\n.ref__meta { margin:0; font-size:14px; color:var(--ink-2); }\n</style>\n```";
window.PROMPTS = [];
