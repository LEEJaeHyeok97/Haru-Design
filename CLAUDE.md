# CLAUDE.md

하루설계: 매일 시스템 설계 문제 하나에 답하고 서로 비교하는 사이트. 기능 목록과 설정은 README.md 참고.

## 구조와 원칙

- 빌드 없는 정적 사이트. 프레임워크·번들러를 들이지 말 것. 의존성은 서버 함수용 `@anthropic-ai/sdk`뿐.
- `app.js` 하나에 전부 있다. 순서: CONFIG → 유틸 → Supabase API → 데모 API → state → 화면(`*Html()` 문자열 템플릿) → 캔버스(`dg*`) → 이벤트(document 위임) → boot.
- 화면은 `state`를 바꾸고 `render()`로 `#main`을 통째로 다시 그린다. 이벤트는 `data-act` / `data-dg-act` / `data-nav` 속성으로 위임 처리.
- 백엔드 기능을 더할 때는 Supabase API와 데모 API 양쪽에 같은 메서드를 만든다.
- 사용자 입력은 반드시 `esc()`를 거쳐 HTML에 넣는다.
- 캔버스 그림을 바꾸는 코드는 `dgMutate(() => ...)`로 감싸야 되돌리기에 기록된다.
- 문구는 한국어 존댓말 "~요" 체, 짧게. 스타일은 토스풍 (styles.css의 `:root` 토큰 사용).

## 백엔드

- Supabase 프로젝트 `kqgxhfdwngmxyrkceprm`. 테이블: `topics`, `posts`, `likes`, `comments`(`parent_id`로 대댓글 한 단계), `profiles`, `events`(이용 기록, insert만 공개), `subscribers`(이메일 구독, insert만 공개·select/delete는 `is_admin()`). RPC `is_admin`, `admin_metrics(days)`. Storage 버킷 `designs`.
- 새 사용자 동작을 지표에 넣으려면 `track(type, path)`를 부르고, `events.type` check 제약(SQL)과 `ENDPOINTS` 라벨(app.js)을 같이 늘린다.
- 스키마 SQL은 레포에 없다. DB 변경은 `supabase/날짜-이름.sql`로 만들고 사용자에게 SQL Editor에서 실행해 달라고 한다 (Claude가 직접 실행할 수 없음). 컬럼이 아직 없어도 깨지지 않게 조회는 `select('*')` 쪽을 선호.
- 읽기 확인은 anon key로 REST 조회 가능: `curl "$URL/rest/v1/comments?select=*&limit=1" -H "apikey: $KEY"`. 운영 DB에 쓰기 요청은 보내지 말 것.
- `api/diagram.js`: 그림 없는 글을 Claude(effort low)로 캔버스 형식 그림(`{nodes, edges}`)으로 바꿔 `posts.ai_diagram`에 저장. service_role 키(`SUPABASE_SERVICE_ROLE_KEY`)로 쓰며, `ai_diagram_status`를 `pending`으로 먼저 바꾼 요청만 Claude를 부른다. 프런트는 `refreshPosts()` 뒤 `drawMissingDiagrams()`가 동시 2개씩 요청하고 `rerenderPost()`로 그림 자리만 바꾼다. 서버의 `TYPES`는 `DG_TYPES`와 맞춰 둘 것.
- `api/review.js`: Supabase 토큰 확인 후 Claude(`claude-opus-5-5`, effort medium, json_schema 구조화 출력, `fallbacks: "default"`)로 평가. 키는 Vercel 환경 변수 `ANTHROPIC_API_KEY`.

## 확인 방법

- 문법: `node --check app.js && node --check api/review.js`
- 화면 동작: 운영 DB를 건드리지 않도록 `app.js`의 `SUPABASE_URL`을 비운 데모 모드로 띄워서 확인한다. playwright-core + 설치된 Chrome(`/Applications/Google Chrome.app`)으로 headless 테스트가 가능하다 (scratchpad에 설치해서 사용).
- 배포 확인: push 후 `curl https://haru-design-nine.vercel.app/app.js`에 변경이 들어갔는지, `/api/review`가 GET에 405를 주는지.

## 배포와 작업 방식

- `main`에 push하면 Vercel이 자동 배포 (https://haru-design-nine.vercel.app). 예전 Netlify 사이트는 자동 배포되지 않으며 `*.vercel.app`이 아닌 주소에서는 이전 안내 배너가 뜬다.
- 사용자는 커밋·푸시를 직접 요청한다. 요청 전에는 커밋하지 말 것.
- 사용자에게 Vercel·Supabase·Anthropic 콘솔 작업이 필요하면 메뉴 경로까지 구체적으로 안내한다.
