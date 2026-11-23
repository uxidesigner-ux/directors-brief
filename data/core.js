/*
 * Director's Brief — 분류 체계와 디렉팅 원칙
 * 프롬프트 본문은 data/p1~p6 파일에 있고, 실제로 복사되는 문장은 app.js의 compose()가 조립합니다.
 */
window.DB = {
  purposes: [
    { id: 'brand',    label: '브랜드 구축',  desc: '포지셔닝, 이름, 로고, 컬러처럼 브랜드의 뼈대를 세울 때' },
    { id: 'convert',  label: '전환·매출',    desc: '랜딩, 상세페이지, 광고처럼 방문자를 고객으로 바꿀 때' },
    { id: 'product',  label: '제품 UX·UI',   desc: '앱·웹 화면, 흐름, 디자인 시스템을 설계할 때' },
    { id: 'content',  label: '콘텐츠·소셜',  desc: '썸네일, 카드뉴스, 일러스트처럼 매주 만드는 콘텐츠' },
    { id: 'persuade', label: '설득·보고',    desc: '피치덱, 보고서, 데이터 시각화로 결정을 끌어낼 때' },
    { id: 'review',   label: '검수·고도화',  desc: '이미 만든 결과물을 디렉터 눈으로 점검하고 끌어올릴 때' }
  ],

  types: {
    strategy:  '브랜드 전략',
    naming:    '네이밍·말투',
    logo:      '로고',
    identity:  '아이덴티티',
    icon:      '아이콘',
    color:     '컬러·타이포',
    image:     '이미지·일러스트',
    package:   '패키지',
    landing:   '랜딩·웹페이지',
    detail:    '상세·비교',
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
    review:    '리뷰·감사'
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
    { k: 'brand',    label: '브랜드/서비스',     ph: '브랜드명',        hint: '예: 루트다이어리' },
    { k: 'what',     label: '한 줄 정의',        ph: '서비스 한 줄 정의', hint: '예: 여행 동선을 하루 단위로 기록하는 앱' },
    { k: 'audience', label: '핵심 사용자',       ph: '핵심 사용자',      hint: '예: 한국을 처음 여행하는 20~30대 외국인' },
    { k: 'need',     label: '사용자가 겪는 문제', ph: '사용자가 겪는 문제', hint: '예: 낯선 도시에서 동선과 안전을 확신하기 어렵다' },
    { k: 'alt',      label: '경쟁사·대안',       ph: '경쟁사·대안',      hint: '예: 구글맵 저장 목록, 트리플, 블로그 검색' },
    { k: 'money',    label: '수익 모델',         ph: '수익 모델',        hint: '예: 월 구독 6,900원 + 현지 가이드 연결 수수료' },
    { k: 'tone',     label: '톤 키워드',         ph: '톤 키워드 3개',     hint: '예: 차분한, 믿음직한, 위트 있는' },
    { k: 'platform', label: '플랫폼·채널',       ph: '플랫폼·채널',      hint: '예: 모바일 웹 우선, 인스타그램' }
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

window.PROMPTS = [];
