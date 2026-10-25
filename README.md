# 하루설계

하루 10분, 설계 판단 연습. 매일 0시(KST)에 시스템 설계 문제 하나가 공개되고, 각자 설계를 올린 뒤 다른 사람들의 답과 비교해 볼 수 있습니다.

- 운영 주소: https://haru-design-nine.vercel.app (예전 Netlify 주소에서는 이전 안내 배너가 뜹니다)
- 빌드 과정이 없는 정적 사이트 + Vercel 서버 함수 1개
- 백엔드: Supabase (DB, 익명 로그인, Storage), AI 평가: Claude API

## 주요 기능

- **오늘의 문제 / 지난 문제**: 날짜별로 문제 하나. 관리자가 미래 날짜로 예약 등록
- **설계 올리기**: 템플릿 글 + 다이어그램 (캔버스로 그리기 또는 이미지 첨부). 한 문제에 한 번
- **설계 캔버스**: 컴포넌트 25종 + 직접 추가, 드래그·연결, 동기/비동기, 2중화, Ctrl/Cmd+Z 되돌리기 · Ctrl/Cmd+Shift+Z 다시 하기. 올릴 때 PNG로 변환
- **AI 평가**: 올리기 전에 점수(100점)와 기준별 피드백. 저장하지 않고 작성자에게만 표시
- **좋아요, 댓글, 대댓글**(한 단계), 인기순/최신순 정렬
- **닉네임만으로 참여**: 가입 없이 Supabase 익명 로그인. 관리자는 이메일/비밀번호
- **관리자 페이지**: 문제 등록·예약, 운영 지표 (일간 방문자, 페이지뷰, 요청별 횟수·실패·평균 응답 시간, 7/14/30일)

## 구조

```
index.html     마크업
styles.css     스타일
app.js         앱 로직 전부 (Supabase API, 데모 모드, 캔버스, 렌더링, 이벤트)
api/review.js  AI 평가 서버 함수 (Vercel Function, @anthropic-ai/sdk)
supabase/      DB 변경 SQL (Supabase SQL Editor에서 직접 실행)
vercel.json    헤더, cleanUrls, 함수 실행 시간(60초)
```

## 로컬에서 실행

```bash
npx serve .
```

정적 파일만 뜨므로 `/api/review`(AI 평가)는 동작하지 않습니다. 함수까지 돌리려면 `npx vercel dev`를 쓰세요.

`app.js`의 `CONFIG.SUPABASE_URL`을 비우면 **데모 모드**(브라우저 localStorage, 예시 데이터, 관리자 코드 `admin`)로 동작해 운영 DB를 건드리지 않고 테스트할 수 있습니다.

## 설정

| 항목 | 위치 |
|---|---|
| Supabase URL, anon key | `app.js` 맨 위 `CONFIG` (공개 키, 접근 제어는 RLS) |
| `ANTHROPIC_API_KEY` | Vercel > Project > Settings > Environment Variables. 바꾼 뒤에는 Redeploy |
| AI 사용 한도 | [Anthropic Console](https://console.anthropic.com) > Limits |

## DB 변경

`supabase/` 안의 SQL은 자동 적용되지 않습니다. Supabase 대시보드 > SQL Editor에서 직접 실행하세요.

- `2026-10-25-comment-replies.sql`: 대댓글용 `comments.parent_id` 컬럼과 검사 트리거
- `2026-10-25-admin-metrics.sql`: 이용 기록 `events` 테이블(쓰기만 공개, 읽기 정책 없음)과 관리자 전용 집계 함수 `admin_metrics(days)`

## 운영 지표

화면 이동과 주요 동작(설계 올리기, 댓글·답글, 좋아요, AI 평가)을 `events`에 기록합니다. 브라우저마다 만든 임의의 id만 저장하고 IP·기기 정보는 남기지 않으며, 관리자 본인의 사용은 기록하지 않습니다. Supabase로 직접 가는 요청이라 서버 로그 수준의 지표는 아니며, 더 자세한 요청 로그는 Supabase 대시보드 > Logs, Vercel > Logs에서 볼 수 있습니다.

## 배포

`main`에 push하면 Vercel이 자동으로 배포합니다. (Framework Preset: Other, Build Command 없음)
