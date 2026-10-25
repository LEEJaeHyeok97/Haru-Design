# 하루설계

하루 10분, 설계 판단 연습. 매일 0시(KST)에 시스템 설계 문제 하나가 공개되고, 각자 설계를 올린 뒤 다른 사람들의 답과 비교해 볼 수 있습니다.

빌드 과정이 없는 정적 사이트입니다. 백엔드는 Supabase(DB, 익명 로그인, Storage)를 씁니다.

## 구조

```
index.html   마크업
styles.css   스타일
app.js       앱 로직 (Supabase API, 데모 모드, 설계 캔버스, 화면 렌더링)
vercel.json  Vercel 설정 (헤더, cleanUrls)
```

## 로컬에서 실행

```bash
npx serve .
# 또는
python3 -m http.server 3000
```

## 설정

`app.js` 맨 위의 `CONFIG`에 Supabase 프로젝트 URL과 anon key가 들어 있습니다. 둘 중 하나를 비우면 브라우저에만 저장되는 데모 모드로 동작합니다.

anon key는 공개되어도 되는 키이며, 데이터 접근은 Supabase RLS 정책으로 제한합니다.

## Vercel 배포

1. 이 레포를 GitHub에 push
2. Vercel > Add New Project > 레포 선택
3. Framework Preset: **Other**, Build Command / Output Directory는 비워둠
4. Deploy

### Netlify에서 옮길 때 확인할 것

- Supabase 대시보드 > Authentication > URL Configuration의 **Site URL**과 **Redirect URLs**에 새 Vercel 도메인을 추가 (익명 로그인과 이메일/비밀번호 로그인은 리다이렉트를 쓰지 않지만, 이메일 링크 등을 대비)
- 커스텀 도메인을 쓰고 있었다면 Vercel > Project > Domains에서 연결하고 DNS를 Vercel로 변경
