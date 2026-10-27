/* =====================================================================
   문제 메일: 매일 오전 9시(KST) 그날 공개된 문제를 구독자에게 Gmail 로 보낸다.
   - Vercel Cron 이 GET 으로 부른다 (vercel.json 의 crons, Authorization: Bearer CRON_SECRET).
     문제마다 newsletter_sends 에 한 줄을 먼저 넣은 요청만 보내므로 두 번 불려도 한 번만 간다
     (supabase/2026-10-28-newsletter.sql).
   - POST 는 관리자 테스트 발송: 관리자 본인 이메일로 오늘 문제 메일을 한 통 보낸다.
   - GET ?preview 는 오늘 문제 메일을 HTML 로 보여준다 (오늘 문제는 이미 공개돼 있으므로 누구나).
   Vercel 환경 변수 GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY 가 필요하다.
   의존성을 늘리지 않으려고 SMTP 는 node:tls 로 직접 주고받는다.
   ===================================================================== */
import tls from 'node:tls';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kqgxhfdwngmxyrkceprm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ3hoZmR3bmdteHlya2NlcHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MzA5NTYsImV4cCI6MjEwODMwNjk1Nn0.wcYYm2DjuXVUHm1knGYjZmOjlfMI0obbzx8lxWAZLfA';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://haru-design-nine.vercel.app';
const { GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET } = process.env;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
// '2026-10-27' → '10월 27일 화요일'
const koDate = (ymd) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${ymd}T00:00:00Z`));

// 구독 취소 링크 서명. api/unsubscribe.js 와 같은 방식이어야 한다.
const unsubToken = (email) => crypto.createHmac('sha256', SERVICE_KEY).update(`unsub:${email.toLowerCase()}`).digest('base64url').slice(0, 32);
const unsubUrl = (email) => `${SITE}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;

async function db(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`supabase ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/* ---------- 메일 본문 ---------- */
// 문제 설명(일반 텍스트)을 단락으로 나눈다. 따옴표로 감싼 한 줄은 흰 인용 상자로 보여준다.
function problemHtml(description) {
  const parts = [];
  for (const block of description.trim().split(/\n\s*\n/)) {
    let para = [];
    const flush = () => { if (para.length) parts.push({ p: para.map(esc).join('<br>') }); para = []; };
    for (const line of block.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (/^["“].+["”]$/.test(line)) { flush(); parts.push({ quote: esc(line) }); } else para.push(line);
    }
    flush();
  }
  return parts.map((x, i) => {
    const gap = i < parts.length - 1 ? 14 : 0;
    if (x.p) return `<p style="margin:0 0 ${gap}px 0;">${x.p}</p>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px; font-size:16px; line-height:1.6; font-weight:700; color:#191f28;">${x.quote}</td>
                    </tr>
                  </table>${gap ? `<div style="height:${gap}px; line-height:${gap}px; font-size:0;">&nbsp;</div>` : ''}`;
  }).join('\n                  ');
}

function mailHtml(topic, unsubscribe) {
  const date = koDate(topic.publish_date);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>하루설계 · ${esc(date)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f2f4f6;">

<div style="display:none; max-height:0; overflow:hidden;">오늘의 설계 문제: ${esc(topic.title)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f6;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:560px; background-color:#ffffff; border-radius:24px; font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">

        <!-- 브랜드 -->
        <tr>
          <td style="padding:36px 32px 0 32px; font-size:15px; font-weight:700; color:#3182f6; letter-spacing:-0.3px;">
            하루설계
          </td>
        </tr>

        <!-- 제목 -->
        <tr>
          <td style="padding:20px 32px 0 32px;">
            <p style="margin:0; font-size:15px; font-weight:500; color:#8b95a1; letter-spacing:-0.3px;">${esc(date)}</p>
            <h1 style="margin:6px 0 0 0; font-size:26px; line-height:1.4; font-weight:700; color:#191f28; letter-spacing:-0.6px;">오늘의 설계 문제가<br>도착했어요</h1>
          </td>
        </tr>

        <!-- 문제 -->
        <tr>
          <td style="padding:28px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f6; border-radius:16px;">
              <tr>
                <td style="padding:24px 24px 26px 24px; font-size:16px; line-height:1.75; font-weight:400; color:#4e5968; letter-spacing:-0.3px;">

                  <p style="margin:0 0 6px 0; font-size:13px; font-weight:700; color:#3182f6;">상황</p>

                  ${problemHtml(topic.description || '')}

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- 버튼 -->
        <tr>
          <td style="padding:32px 32px 36px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background-color:#3182f6; border-radius:16px;">
                  <a href="${SITE}/" target="_blank" style="display:block; padding:18px 0; font-size:17px; font-weight:700; color:#ffffff; text-decoration:none; letter-spacing:-0.3px;">설계하러 가기</a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0 0; text-align:center;">
              <a href="${SITE}/#archive" target="_blank" style="font-size:14px; font-weight:500; color:#6b7684; text-decoration:none; letter-spacing:-0.3px;">지난 문제 모아보기 ›</a>
            </p>
          </td>
        </tr>

      </table>

      <!-- 구독 안내 -->
      <p style="margin:20px 0 0 0; font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif; font-size:12px; line-height:1.6; color:#8b95a1; text-align:center;">
        하루설계 문제 메일을 구독하셔서 보내드렸어요.<br>
        <a href="${esc(unsubscribe)}" target="_blank" style="color:#8b95a1; text-decoration:underline;">구독 취소</a>
      </p>

    </td>
  </tr>
</table>

</body>
</html>`;
}

function mailText(topic, unsubscribe) {
  return `하루설계 · ${koDate(topic.publish_date)}\n오늘의 설계 문제가 도착했어요\n\n[${topic.title}]\n\n${(topic.description || '').trim()}\n\n설계하러 가기: ${SITE}/\n지난 문제 모아보기: ${SITE}/#archive\n\n구독 취소: ${unsubscribe}\n`;
}

/* ---------- SMTP (Gmail, 465 포트 TLS) ---------- */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const encWord = (s) => `=?UTF-8?B?${b64(s)}?=`;

function buildMessage({ to, subject, html, text, unsubscribe }) {
  const boundary = `haru-${crypto.randomUUID()}`;
  return [
    `From: ${encWord('하루설계')} <${GMAIL_USER}>`,
    `To: <${to}>`,
    `Subject: ${encWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@haru-design>`,
    'MIME-Version: 1.0',
    `List-Unsubscribe: <${unsubscribe}>`,
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

// 한 번 연결해서 여러 통을 보낸다. 응답은 "250-..." 줄이 이어지다 "250 ..." 줄에서 끝난다.
async function smtpConnect() {
  const sock = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
  sock.setEncoding('utf8');
  sock.setTimeout(20000, () => sock.destroy(new Error('SMTP 응답 시간 초과')));
  let buf = '', lines = [], dead = null;
  const replies = [], waiters = [];
  sock.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) {
        const r = { code: Number(line.slice(0, 3)), text: lines.join('\n') };
        lines = [];
        if (waiters.length) waiters.shift().resolve(r); else replies.push(r);
      }
    }
  });
  const die = (e) => { dead = e || new Error('SMTP 연결이 끊겼어요'); while (waiters.length) waiters.shift().reject(dead); };
  sock.on('error', die);
  sock.on('close', () => die());
  const read = () => (replies.length ? Promise.resolve(replies.shift()) : dead ? Promise.reject(dead) : new Promise((resolve, reject) => waiters.push({ resolve, reject })));
  const cmd = async (line, ok) => {
    if (line != null) sock.write(line + '\r\n');
    const r = await read();
    if (!ok.includes(r.code)) throw Object.assign(new Error(`SMTP ${r.code}: ${r.text}`), { code: r.code });
    return r;
  };

  await cmd(null, [220]);
  await cmd('EHLO haru-design', [250]);
  await cmd(`AUTH PLAIN ${b64(`\0${GMAIL_USER}\0${GMAIL_APP_PASSWORD}`)}`, [235]);

  return {
    async send(to, message) {
      try {
        await cmd(`MAIL FROM:<${GMAIL_USER}>`, [250]);
        await cmd(`RCPT TO:<${to}>`, [250, 251]);
        await cmd('DATA', [354]);
        // 본문은 base64 라 줄이 '.' 으로 시작하지 않는다
        await cmd(`${message}\r\n.`, [250]);
      } catch (e) {
        if (dead) throw e;
        await cmd('RSET', [250]).catch(() => {});  // 이 받는 사람만 실패: 다음 통을 위해 상태를 되돌린다
        throw e;
      }
    },
    async close() { await cmd('QUIT', [221]).catch(() => {}); sock.end(); },
  };
}

function mailFor(topic, to) {
  const unsubscribe = unsubUrl(to);
  return buildMessage({ to, subject: `[하루설계] ${topic.title}`, html: mailHtml(topic, unsubscribe), text: mailText(topic, unsubscribe), unsubscribe });
}

async function todayTopic() {
  const [topic] = await db(`topics?publish_date=eq.${kstToday()}&select=id,title,description,publish_date&limit=1`);
  return topic || null;
}

/* ---------- 요청 ---------- */
async function sendDaily(res) {
  const topic = await todayTopic();
  if (!topic) return res.status(200).json({ status: 'no-topic' });

  // 이 문제를 처음 맡은 요청만 보낸다
  const claimed = await db('newsletter_sends?on_conflict=topic_id', { method: 'POST', body: { topic_id: topic.id }, prefer: 'resolution=ignore-duplicates,return=representation' });
  if (!claimed.length) return res.status(200).json({ status: 'already-sent' });

  const subscribers = await db('subscribers?select=email&order=id');
  let sent = 0, failed = 0, error = null, smtp = null;
  try {
    smtp = await smtpConnect();
    for (const { email } of subscribers) {
      try { await smtp.send(email, mailFor(topic, email)); sent++; }
      catch (e) {
        failed++;
        error = e.message.slice(0, 500);
        console.error('newsletter', email, e.message);
        if (e.code === 421 || e.code === 454 || /끊겼|시간 초과/.test(e.message)) { smtp = await smtpConnect(); }  // 연결이 끊기면 다시 붙는다
      }
    }
  } catch (e) {
    error = e.message.slice(0, 500);
    failed = subscribers.length - sent;
    console.error('newsletter', e);
  } finally {
    await smtp?.close();
  }
  await db(`newsletter_sends?topic_id=eq.${topic.id}`, { method: 'PATCH', body: { sent, failed, error, finished_at: new Date().toISOString() } });
  return res.status(200).json({ status: 'done', sent, failed });
}

async function adminEmail(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const [u, a] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, { method: 'POST', headers, body: '{}' }),
  ]);
  if (!u.ok || !a.ok || (await a.json()) !== true) return null;
  return (await u.json())?.email || null;
}

export default async function handler(req, res) {
  if (!SERVICE_KEY) return res.status(503).json({ error: '메일 발송이 아직 설정되지 않았어요.' });
  try {
    if (req.method === 'GET' && 'preview' in (req.query || {})) {
      const topic = await todayTopic();
      if (!topic) return res.status(404).send('오늘 공개된 문제가 없어요.');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(mailHtml(topic, '#'));
    }

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(503).json({ error: 'Gmail 설정(GMAIL_USER, GMAIL_APP_PASSWORD)이 아직 없어요.' });

    if (req.method === 'GET') {
      if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: '권한이 없어요.' });
      return await sendDaily(res);
    }

    if (req.method === 'POST') {
      const to = await adminEmail(req);
      if (!to) return res.status(403).json({ error: '관리자만 테스트 메일을 보낼 수 있어요.' });
      const topic = await todayTopic();
      if (!topic) return res.status(404).json({ error: '오늘 공개된 문제가 없어요.' });
      const smtp = await smtpConnect();
      try { await smtp.send(to, mailFor(topic, to)); } finally { await smtp.close(); }
      return res.status(200).json({ status: 'sent', to });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'GET, POST 요청만 받아요.' });
  } catch (e) {
    console.error(e);
    if (e.code === 535) return res.status(502).json({ error: 'Gmail 로그인에 실패했어요. GMAIL_USER 와 앱 비밀번호를 확인해 주세요.' });
    return res.status(500).json({ error: '메일을 보내지 못했어요.' });
  }
}
