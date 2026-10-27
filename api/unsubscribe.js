/* =====================================================================
   문제 메일 구독 취소. 메일의 링크(?e=이메일&t=서명)로 들어온다.
   - GET: 확인 버튼만 보여준다 (메일 보안 검사기가 링크를 미리 열어도 취소되지 않게)
   - POST: 실제로 지운다. Gmail 의 원클릭 구독 취소(List-Unsubscribe-Post)도 이쪽으로 온다.
   서명은 api/newsletter.js 의 unsubToken 과 같은 방식이다. SUPABASE_SERVICE_ROLE_KEY 가 필요하다.
   ===================================================================== */
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kqgxhfdwngmxyrkceprm.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://haru-design-nine.vercel.app';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unsubToken = (email) => crypto.createHmac('sha256', SERVICE_KEY).update(`unsub:${email.toLowerCase()}`).digest('base64url').slice(0, 32);
const validToken = (email, t) => {
  const a = Buffer.from(unsubToken(email)), b = Buffer.from(String(t || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

async function db(path, { method = 'GET' } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  if (!r.ok) throw new Error(`supabase ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// 대소문자만 다른 주소도 같은 구독으로 본다 (subscribers 의 lower(email) 유일 인덱스와 같게)
async function removeSubscriber(email) {
  const rows = await db(`subscribers?select=id,email&email=ilike.${encodeURIComponent(email.replace(/[\\*%_]/g, '\\$&'))}`);
  const ids = rows.filter((r) => r.email.toLowerCase() === email.toLowerCase()).map((r) => r.id);
  if (ids.length) await db(`subscribers?id=in.(${ids.join(',')})`, { method: 'DELETE' });
}

const page = (title, body) => `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(title)} · 하루설계</title></head>
<body style="margin:0; padding:40px 16px; background-color:#f2f4f6; font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:420px; margin:0 auto; background:#ffffff; border-radius:24px; padding:32px; text-align:center;">
<p style="margin:0 0 16px; font-size:15px; font-weight:700; color:#3182f6;">하루설계</p>
<h1 style="margin:0 0 10px; font-size:22px; line-height:1.4; color:#191f28;">${esc(title)}</h1>
${body}
</div></body></html>`;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!SERVICE_KEY) return res.status(503).send(page('잠시 뒤 다시 시도해 주세요', ''));

  const email = String(req.query?.e || '').trim();
  const t = req.query?.t;
  if (!email || !validToken(email, t)) {
    return res.status(400).send(page('링크가 올바르지 않아요', `<p style="margin:0; font-size:15px; line-height:1.6; color:#4e5968;">메일에 있는 구독 취소 링크를 그대로 눌러 주세요.</p>`));
  }

  if (req.method === 'GET') {
    return res.status(200).send(page('구독을 취소할까요?', `
<p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4e5968;">${esc(email)}(으)로 가는<br>매일 문제 메일을 더 보내지 않아요.</p>
<form method="post" action="/api/unsubscribe?e=${encodeURIComponent(email)}&amp;t=${encodeURIComponent(t)}">
<button type="submit" style="width:100%; padding:16px 0; border:0; border-radius:16px; background:#3182f6; color:#ffffff; font:inherit; font-size:16px; font-weight:700; cursor:pointer;">구독 취소하기</button>
</form>`));
  }

  if (req.method === 'POST') {
    try { await removeSubscriber(email); }
    catch (e) { console.error(e); return res.status(500).send(page('취소하지 못했어요', '<p style="margin:0; font-size:15px; color:#4e5968;">잠시 뒤 다시 시도해 주세요.</p>')); }
    return res.status(200).send(page('구독을 취소했어요', `
<p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4e5968;">이제 문제 메일이 가지 않아요.<br>문제는 사이트에서 언제든 볼 수 있어요.</p>
<a href="${SITE}/" style="display:block; padding:16px 0; border-radius:16px; background:#f2f4f6; color:#4e5968; font-size:15px; font-weight:600; text-decoration:none;">하루설계로 가기</a>`));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).send(page('지원하지 않는 요청이에요', ''));
}
