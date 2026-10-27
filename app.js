/* =====================================================================
   설정: Supabase 프로젝트 값을 넣으면 실제 DB 로 동작합니다.
   비워두면 브라우저에만 저장되는 데모 모드로 동작합니다.
   (Supabase 대시보드 > Project Settings > API)
   anon key 는 공개용 키입니다. 데이터 보호는 Supabase RLS 정책이 담당합니다.
   ===================================================================== */
const CONFIG = {
  SUPABASE_URL: 'https://kqgxhfdwngmxyrkceprm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ3hoZmR3bmdteHlya2NlcHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MzA5NTYsImV4cCI6MjEwODMwNjk1Nn0.wcYYm2DjuXVUHm1knGYjZmOjlfMI0obbzx8lxWAZLfA',
  BUCKET: 'designs',
  DEMO_ADMIN_CODE: 'admin',   // 데모 모드 전용 관리자 코드 (Supabase 모드에서는 쓰지 않음)
};
const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

// 예전 주소(Netlify)로 들어온 사람에게 새 주소를 알린다. Vercel 미리보기와 로컬에서는 띄우지 않는다.
const NEW_SITE = 'https://haru-design-nine.vercel.app';
const MOVED = !/(\.vercel\.app|^localhost|^127\.0\.0\.1)$/.test(location.hostname);

// 상단 공지: 매일 문제 이메일 구독. 닫거나 구독하면 이 브라우저에서는 다시 띄우지 않는다.
const NOTICE_KEY = 'harusolgye-notice-subscribe';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// 구독자가 이보다 적으면 숫자를 보여주지 않는다 (적은 숫자는 오히려 망설이게 한다)
const SUB_COUNT_MIN = 10;
let noticeClosed = false;
try { noticeClosed = localStorage.getItem(NOTICE_KEY) === '1'; } catch { /* 저장소를 못 쓰면 매번 보여준다 */ }

const TEMPLATE = `## 요구사항 가정\n\n\n## 핵심 구성 요소\n\n\n## 선택한 방식과 이유\n\n\n## 포기한 것\n`;

/* ---------------- small utils ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kstDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayOfYear = (dateStr) => { const d = new Date(dateStr + 'T00:00:00Z'); const start = Date.UTC(d.getUTCFullYear(), 0, 1); return Math.floor((d - start) / 86400000) + 1; };
const fmtDate = (dateStr) => dateStr.replaceAll('-', '.');
const weekday = (dateStr) => '일월화수목금토'[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return fmtDate(kstDate(new Date(iso)));
}
const initial = (name) => esc((name || '?').trim().slice(0, 1).toUpperCase());
const meaningful = (text) => text.split('\n').filter((l) => !/^#{1,3}\s/.test(l)).join('').trim();

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function friendlyError(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/already registered|already exists/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 해요.';
  if (/Email not confirmed/i.test(m)) return '관리자 계정의 이메일 인증이 아직 안 됐어요. Supabase 대시보드에서 확인해 주세요.';
  if (/Anonymous sign-ins are disabled/i.test(m)) return '익명 로그인이 꺼져 있어요. Supabase > Authentication 설정에서 Anonymous sign-ins를 켜주세요.';
  if (/rate limit/i.test(m)) return '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.';
  if (e && e.code === '23505') return e.message.includes('publish_date') ? '그 날짜에는 이미 문제가 있어요. 다른 날짜를 골라주세요.' : '이미 이 문제에 설계를 올렸어요.';
  if (/row-level security/i.test(m)) return '권한이 없어요. 로그인 상태나 관리자 권한을 확인해 주세요.';
  if (/storage|quota/i.test(m)) return '이미지를 저장하지 못했어요. 더 작은 이미지로 다시 시도해 주세요.';
  return m;
}

/* 이미지: 긴 변 기준으로 줄이고, 작은 PNG(다이어그램)는 원본 유지 */
function loadImage(src) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
}
async function prepareImage(file, { max = 1600, forceCompress = false } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    if (!forceCompress && big <= max && file.size <= 1.5 * 1024 * 1024) return { blob: file, ext: file.type.split('/')[1].replace('jpeg', 'jpg') };
    const scale = Math.min(1, max / big);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    return { blob, ext: 'jpg' };
  } finally { URL.revokeObjectURL(url); }
}
const blobToDataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

/* =====================================================================
   API: Supabase 구현
   ===================================================================== */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Supabase 라이브러리를 불러오지 못했어요.')); document.head.appendChild(s); });
}

async function createSupabaseApi(onAuthChange) {
  // index.html 에서 미리 불러오지만, 실패했을 때를 대비해 한 번 더 시도
  if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
  const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  let session = (await sb.auth.getSession()).data.session;
  sb.auth.onAuthStateChange((_event, s) => {
    const changed = (s?.user?.id || null) !== (session?.user?.id || null);
    session = s;
    if (changed) onAuthChange();
  });
  const uid = () => session?.user?.id || null;
  const isExternal = (path) => /^(data:|https?:)/.test(path || '');
  const publicUrl = (path) => (!path ? null : isExternal(path) ? path : sb.storage.from(CONFIG.BUCKET).getPublicUrl(path).data.publicUrl);
  const must = ({ data, error }) => { if (error) throw error; return data; };

  return {
    async me() {
      if (!uid()) return null;
      const p = must(await sb.from('profiles').select('id,nickname').eq('id', uid()).maybeSingle());
      const admin = must(await sb.rpc('is_admin'));
      return { id: uid(), nickname: p?.nickname || session.user.email || '익명', isAdmin: !!admin, isAnonymous: !!session.user.is_anonymous };
    },
    // 일반 사용자: 가입 없이 익명 계정을 만들고 닉네임만 저장
    async ensureUser(nickname) {
      if (!uid()) {
        const data = must(await sb.auth.signInAnonymously({ options: { data: { nickname } } }));
        session = data.session;
      }
    },
    async setNickname(nickname) {
      must(await sb.from('profiles').update({ nickname }).eq('id', uid()));
    },
    // 관리자: 대시보드에서 만든 이메일 계정으로만 로그인 (가입 화면 없음)
    async adminSignIn({ email, password }) {
      const data = must(await sb.auth.signInWithPassword({ email, password }));
      session = data.session;
      const admin = must(await sb.rpc('is_admin'));
      if (!admin) { await sb.auth.signOut(); session = null; throw new Error('관리자로 등록된 계정이 아니에요.'); }
    },
    async signOut() { await sb.auth.signOut(); session = null; },

    async listTopics() {
      const rows = must(await sb.from('topics').select('id,title,description,publish_date,posts(count)').order('publish_date', { ascending: false }));
      return rows.map((t) => ({ id: t.id, title: t.title, description: t.description, publish_date: t.publish_date, post_count: t.posts?.[0]?.count ?? 0 }));
    },
    async saveTopic({ id, title, description, publish_date }) {
      const row = { title, description, publish_date };
      if (id) must(await sb.from('topics').update(row).eq('id', id));
      else must(await sb.from('topics').insert(row));
    },
    async deleteTopic(id) { must(await sb.from('topics').delete().eq('id', id)); },

    async listPosts(topicId) {
      const rows = must(await sb.from('posts')
        .select('*,author:profiles!posts_user_id_fkey(id,nickname),likes(count),comments(count)')
        .eq('topic_id', topicId).order('created_at', { ascending: false }));
      let liked = new Set();
      if (uid() && rows.length) {
        const mine = must(await sb.from('likes').select('post_id').eq('user_id', uid()).in('post_id', rows.map((r) => r.id)));
        liked = new Set(mine.map((l) => l.post_id));
      }
      return rows.map((r) => ({
        id: r.id, user_id: r.user_id, content: r.content, image_path: r.image_path, image_url: publicUrl(r.image_path), is_sample: !!r.is_sample,
        ai_diagram: r.ai_diagram || null, ai_diagram_status: r.ai_diagram_status || null,
        ai_score: r.ai_score ?? null, ai_review: r.ai_review || null, ai_review_status: r.ai_review_status || null,
        created_at: r.created_at, author: r.author || { id: r.user_id, nickname: '알 수 없음' },
        like_count: r.likes?.[0]?.count ?? 0, comment_count: r.comments?.[0]?.count ?? 0, liked: liked.has(r.id),
      }));
    },
    async createPost(topicId, content, file) {
      let image_path = null;
      if (file) {
        const { blob, ext } = await prepareImage(file);
        image_path = `${uid()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        must(await sb.storage.from(CONFIG.BUCKET).upload(image_path, blob, { contentType: blob.type || file.type, upsert: false }));
      }
      const { error } = await sb.from('posts').insert({ topic_id: topicId, content, image_path });
      if (error) {
        if (image_path) await sb.storage.from(CONFIG.BUCKET).remove([image_path]);
        throw error;
      }
    },
    async deletePost(post) {
      must(await sb.from('posts').delete().eq('id', post.id));
      if (post.image_path && !isExternal(post.image_path)) await sb.storage.from(CONFIG.BUCKET).remove([post.image_path]);
    },
    async setLike(postId, on) {
      if (on) must(await sb.from('likes').insert({ post_id: postId }));
      else must(await sb.from('likes').delete().eq('post_id', postId).eq('user_id', uid()));
    },
    async listComments(postId) {
      // '*' 로 가져와서 parent_id 컬럼이 아직 없는 DB 에서도 댓글은 그대로 보이게 한다
      const rows = must(await sb.from('comments').select('*,author:profiles!comments_user_id_fkey(id,nickname)').eq('post_id', postId).order('created_at'));
      return rows.map((c) => ({ ...c, parent_id: c.parent_id ?? null, author: c.author || { id: c.user_id, nickname: '알 수 없음' } }));
    },
    async addComment(postId, content, parentId = null) {
      must(await sb.from('comments').insert({ post_id: postId, content, ...(parentId ? { parent_id: parentId } : {}) }));
    },
    async deleteComment(id) { must(await sb.from('comments').delete().eq('id', id)); },

    // AI 평가는 Vercel 서버 함수(/api/review)가 처리한다. 만료된 토큰은 getSession 이 갱신해 준다.
    async review(payload) {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const r = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(data.error || 'AI 평가를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.'), { status: r.status });
      return data;
    },
    // 올라온 글을 AI 가 채점한다 (/api/review 에 postId). 결과는 서버가 저장하므로 로그인이 필요 없다.
    // 돌려주는 값: { status: 'done', score, review } | { status: 'pending' | 'failed' }
    async scorePost(postId) {
      const r = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId }) });
      const data = await r.json().catch(() => ({}));
      if (r.status === 202) return data;
      if (!r.ok) throw Object.assign(new Error(data.error || '점수를 매기지 못했어요.'), { status: r.status });
      return data;
    },
    // 다이어그램 없는 글에 AI 가 그림을 그린다 (/api/diagram). 결과는 서버가 저장하므로 로그인이 필요 없다.
    // 돌려주는 값: { status: 'done', diagram } | { status: 'pending' | 'failed' | 'skip' }
    async drawDiagram(postId) {
      const r = await fetch('/api/diagram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId }) });
      const data = await r.json().catch(() => ({}));
      if (r.status === 202 || r.status === 409) return data;
      if (!r.ok) throw Object.assign(new Error(data.error || '그림을 만들지 못했어요.'), { status: r.status });
      return data;
    },

    // 이메일 구독 (supabase/2026-10-25-subscribers.sql). 남기기는 누구나, 보기·삭제는 관리자만.
    async subscribe(email) {
      const { error } = await sb.from('subscribers').insert({ email });
      if (error?.code === '23505') return { already: true };
      if (error) throw error;
      return { already: false };
    },
    // 이메일은 감추고 숫자만 (supabase/2026-10-28-subscriber-count.sql). 함수가 아직 없으면 null.
    async subscriberCount() {
      const { data, error } = await sb.rpc('subscriber_count');
      return error ? null : data;
    },
    async listSubscribers() { return must(await sb.from('subscribers').select('*').order('created_at', { ascending: false })); },
    async deleteSubscriber(id) { must(await sb.from('subscribers').delete().eq('id', id)); },
    // 매일 문제 메일 (api/newsletter.js, supabase/2026-10-28-newsletter.sql)
    async lastNewsletter() {
      const { data, error } = await sb.from('newsletter_sends').select('*').order('started_at', { ascending: false }).limit(1);
      return error ? null : data[0] || null;
    },
    async sendTestMail() {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const r = await fetch('/api/newsletter', { method: 'POST', headers: { Authorization: `Bearer ${token || ''}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(data.error || '테스트 메일을 보내지 못했어요.'), { status: r.status });
      return data;
    },

    // 스폰서 칸 (supabase/2026-10-25-sponsors.sql). 켜진 것은 누구나, 전체와 등록·수정은 관리자만.
    async listSponsors() {
      const rows = must(await sb.from('sponsors').select('*'));
      return rows.map((r) => ({ ...r, image_url: publicUrl(r.image_path) }));
    },
    async saveSponsor({ id, title, body, link_url, active, image_style, sort_order, file, removeImage }, prev = null) {
      const row = { title, body, link_url, active, image_style, ...(sort_order != null ? { sort_order } : {}) };
      let uploaded = null;
      if (file) {
        const { blob, ext } = await prepareImage(file, { max: 800 });
        uploaded = `${uid()}/sponsor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        must(await sb.storage.from(CONFIG.BUCKET).upload(uploaded, blob, { contentType: blob.type || file.type, upsert: false }));
        row.image_path = uploaded;
      } else if (removeImage) row.image_path = null;
      const { error } = id ? await sb.from('sponsors').update(row).eq('id', id) : await sb.from('sponsors').insert(row);
      if (error) { if (uploaded) await sb.storage.from(CONFIG.BUCKET).remove([uploaded]); throw error; }
      // 바뀐 이미지의 예전 파일은 지운다
      if ((uploaded || removeImage) && prev?.image_path && !isExternal(prev.image_path)) await sb.storage.from(CONFIG.BUCKET).remove([prev.image_path]);
    },
    async setSponsorActive(id, active) { must(await sb.from('sponsors').update({ active }).eq('id', id)); },
    async reorderSponsors(changes) {
      for (const { id, sort_order } of changes) must(await sb.from('sponsors').update({ sort_order }).eq('id', id));
    },
    async deleteSponsor(s) {
      must(await sb.from('sponsors').delete().eq('id', s.id));
      if (s.image_path && !isExternal(s.image_path)) await sb.storage.from(CONFIG.BUCKET).remove([s.image_path]);
    },

    // 관리자 지표 (supabase/2026-10-25-admin-metrics.sql). 기록 실패는 조용히 넘긴다.
    async track(row) { await sb.from('events').insert(row); },
    async adminMetrics(days) { return must(await sb.rpc('admin_metrics', { days })); },
    async adminTimeline(hours) { return must(await sb.rpc('admin_timeline', { hours })); },
  };
}

/* =====================================================================
   API: 데모 구현 (브라우저 메모리 + localStorage)
   ===================================================================== */
const DEMO_KEY = 'harusolgye-demo-v2';

function diagram(nodes, edges, w = 640, h = 300) {
  const n = Object.fromEntries(nodes.map((x) => [x.id, x]));
  const mid = (a) => ({ x: a.x + a.w / 2, y: a.y + a.h / 2 });
  const edgePoint = (a, b) => {
    const c = mid(a), d = mid(b), dx = d.x - c.x, dy = d.y - c.y;
    const t = Math.min(Math.abs((a.w / 2) / (dx || 1e-9)), Math.abs((a.h / 2) / (dy || 1e-9)));
    return { x: c.x + dx * t, y: c.y + dy * t };
  };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="IBM Plex Sans KR, Apple SD Gothic Neo, sans-serif">`;
  s += `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2747c9"/></marker>`;
  s += `<pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d6dce8"/></pattern></defs>`;
  s += `<rect width="${w}" height="${h}" fill="#fbfcfd"/><rect width="${w}" height="${h}" fill="url(#g)"/>`;
  for (const [from, to, label, dashed] of edges) {
    const p = edgePoint(n[from], n[to]), q = edgePoint(n[to], n[from]);
    s += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#2747c9" stroke-width="2" ${dashed ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#a)"/>`;
    if (label) {
      const lx = (p.x + q.x) / 2, ly = (p.y + q.y) / 2 - 8;
      s += `<rect x="${lx - label.length * 6 - 6}" y="${ly - 13}" width="${label.length * 12 + 12}" height="20" rx="4" fill="#fbfcfd"/>`;
      s += `<text x="${lx}" y="${ly + 2}" text-anchor="middle" font-size="12" fill="#5d6779">${label}</text>`;
    }
  }
  for (const x of nodes) {
    const fill = x.tone === 'store' ? '#eef2fd' : x.tone === 'queue' ? '#fdf3e4' : '#ffffff';
    s += `<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" rx="${x.tone === 'store' ? 14 : 8}" fill="${fill}" stroke="#1b2230" stroke-width="1.6"/>`;
    const lines = x.label.split('|');
    lines.forEach((ln, i) => {
      s += `<text x="${x.x + x.w / 2}" y="${x.y + x.h / 2 + (i - (lines.length - 1) / 2) * 17 + 5}" text-anchor="middle" font-size="${i ? 12 : 14}" font-weight="${i ? 400 : 600}" fill="${i ? '#5d6779' : '#1b2230'}">${ln}</text>`;
    });
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s + '</svg>');
}

function demoSeed() {
  const today = kstDate();
  const t = (min) => new Date(Date.now() - min * 60000).toISOString();
  const users = [
    { id: 'u-mocha', nickname: '모카' }, { id: 'u-jun', nickname: '준' }, { id: 'u-haru', nickname: '하루' },
    { id: 'u-4', nickname: '라온' }, { id: 'u-5', nickname: '도토리' }, { id: 'u-6', nickname: '키위' },
    { id: 'u-7', nickname: '솔' }, { id: 'u-8', nickname: '바다' }, { id: 'u-9', nickname: '토끼' },
  ];
  const topics = [
    { id: 4, publish_date: addDays(today, 1), title: '알림 발송이 10배로 늘면 어디가 먼저 터질까?',
      description: '지금은 하루 10만 건의 푸시 알림을 API 서버가 직접 보냅니다. 다음 달 이벤트로 하루 100만 건이 예상돼요.\n가장 먼저 병목이 될 곳과, 최소한으로 바꿔서 버틸 방법을 적어주세요.' },
    { id: 3, publish_date: today, title: '좋아요 수, 정확하게 세야 할까?',
      description: '인기 게시글에 좋아요가 몰려서 피크 때 초당 5,000번 눌립니다. DB는 MySQL 한 대예요.\n화면에 보이는 좋아요 수는 얼마나 정확해야 할까요? 저장 방식, 그리고 정확도와 성능 사이에서 무엇을 포기할지 적어주세요.' },
    { id: 2, publish_date: addDays(today, -1), title: '피드는 쓸 때 만들까, 읽을 때 만들까?',
      description: '팔로우 기반 피드를 만듭니다. 사용자 대부분은 팔로워가 수백 명이지만, 몇몇 계정은 팔로워가 100만 명이 넘어요.\n글을 쓸 때 팔로워 피드에 미리 넣을지(push), 읽을 때 모아올지(pull) 골라주세요.' },
    { id: 1, publish_date: addDays(today, -2), title: 'URL 단축기의 키는 어떻게 만들까?',
      description: '하루 100만 개의 단축 URL이 생성됩니다. 키 길이는 7자 이내로 하고 싶어요.\n키 생성 방식(해시, 자동 증가 ID, 미리 만들어둔 키 풀 등)과 충돌 처리를 설명해 주세요.' },
  ];
  const posts = [
    { id: 101, topic_id: 3, user_id: 'u-mocha', created_at: t(48),
      image_url: diagram(
        [
          { id: 'c', x: 24, y: 40, w: 120, h: 52, label: '클라이언트' },
          { id: 'api', x: 250, y: 40, w: 140, h: 52, label: 'API 서버' },
          { id: 'r', x: 480, y: 34, w: 136, h: 64, label: 'Redis|INCR like:{id}', tone: 'store' },
          { id: 'b', x: 250, y: 200, w: 140, h: 56, label: '배치 워커|5초마다', tone: 'queue' },
          { id: 'db', x: 480, y: 196, w: 136, h: 64, label: 'MySQL|posts.like_count', tone: 'store' },
        ],
        [['c', 'api', '좋아요'], ['api', 'r', 'INCR'], ['r', 'b', '변경분 읽기', true], ['b', 'db', 'UPDATE']]),
      content: `## 요구사항 가정\n좋아요 수는 몇 초 늦어도 괜찮다. 단, 내가 누른 좋아요는 바로 반영돼야 한다.\n\n## 핵심 구성 요소\nRedis 카운터, 5초 주기 배치 워커, MySQL의 posts.like_count 컬럼\n\n## 선택한 방식과 이유\n좋아요가 오면 Redis에서 INCR만 하고 바로 응답한다. 배치 워커가 5초마다 변경된 글만 모아서 MySQL에 한 번에 UPDATE 한다.\n초당 5,000건을 MySQL 한 대가 행 잠금으로 받으면 인기 글 한 행에 경합이 몰리기 때문에, 쓰기를 메모리에서 흡수하는 쪽을 골랐다.\n\n## 포기한 것\nRedis가 죽으면 마지막 5초분 카운트가 사라질 수 있다. 좋아요 수는 돈이 아니니까 이 정도 유실은 감수한다.` },
    { id: 102, topic_id: 3, user_id: 'u-jun', created_at: t(95), image_url: null,
      content: `## 요구사항 가정\n좋아요 취소까지 정확해야 한다. 같은 사람이 두 번 누르면 안 된다.\n\n## 핵심 구성 요소\nlikes 테이블 (post_id, user_id 복합 PK), 집계용 like_count 컬럼\n\n## 선택한 방식과 이유\n중복 방지는 결국 DB 제약이 제일 확실하다고 봤다. likes 테이블 INSERT는 행이 다르니 경합이 없다.\n문제는 like_count 갱신인데, 매번 UPDATE 하지 않고 1분마다 COUNT(*)로 다시 계산한다. 인기 글만 대상으로 하면 부담이 크지 않다.\n\n## 포기한 것\n화면 숫자는 최대 1분 늦다. 대신 Redis 같은 추가 인프라 없이 MySQL 하나로 끝난다.` },
    { id: 103, topic_id: 3, user_id: 'u-haru', created_at: t(160),
      image_url: diagram(
        [
          { id: 'api', x: 24, y: 120, w: 130, h: 52, label: 'API 서버' },
          { id: 'k', x: 240, y: 112, w: 150, h: 68, label: 'Kafka|like-events', tone: 'queue' },
          { id: 'cons', x: 470, y: 40, w: 150, h: 52, label: '집계 컨슈머' },
          { id: 'db', x: 470, y: 200, w: 150, h: 64, label: 'MySQL|likes + 카운트', tone: 'store' },
        ],
        [['api', 'k', '이벤트 발행'], ['k', 'cons', '구독'], ['cons', 'db', '묶어서 반영']]),
      content: `## 요구사항 가정\n나중에 "누가 언제 좋아요를 눌렀는지"로 추천에도 쓸 것 같다.\n\n## 핵심 구성 요소\nKafka 토픽 like-events, 집계 컨슈머, MySQL\n\n## 선택한 방식과 이유\n좋아요를 이벤트로 남겨두면 집계도 하고, 나중에 추천 쪽에서 같은 이벤트를 다시 읽을 수 있다.\n\n## 포기한 것\n지금 규모에 Kafka는 과하다는 걸 안다. 운영 부담을 미래 확장성과 바꾼 선택이다.` },
    { id: 104, topic_id: 2, user_id: 'u-jun', created_at: t(60 * 26), image_url: null,
      content: `## 선택한 방식과 이유\n기본은 push, 팔로워 10만 명 이상 계정만 pull로 섞는다.\n일반 계정은 쓰기 비용이 작고 읽기가 빨라지는 이점이 크다. 대형 계정까지 push 하면 글 하나에 100만 번 쓰기가 생겨서 따로 뺐다.\n\n## 포기한 것\n두 방식을 같이 운영하는 복잡도. 피드 조회 때 두 결과를 합치는 로직이 필요하다.` },
  ];
  const likes = [];
  const like = (postId, userIds) => userIds.forEach((u) => likes.push({ post_id: postId, user_id: u }));
  like(101, ['u-jun', 'u-haru', 'u-4', 'u-5', 'u-6', 'u-7', 'u-8']);
  like(102, ['u-mocha', 'u-4', 'u-9']);
  like(103, ['u-5', 'u-7']);
  like(104, ['u-mocha', 'u-haru', 'u-6', 'u-8']);
  const comments = [
    { id: 201, post_id: 101, user_id: 'u-jun', created_at: t(40), content: '5초 동안은 내가 누른 좋아요도 숫자에 안 보이지 않나요?' },
    { id: 202, post_id: 101, user_id: 'u-mocha', created_at: t(33), content: '내가 눌렀는지는 likes 쪽을 따로 보고, 화면에서 +1 해서 보여주는 식으로 처리하려고 했어요.' },
    { id: 203, post_id: 103, user_id: 'u-4', created_at: t(120), content: '추천까지 생각한 건 좋은데, 그 전까지 Kafka 운영은 누가 하나요?' },
  ];
  const sponsors = [
    { id: 301, created_at: t(60 * 24), active: true, image_url: null, link_url: 'https://example.com',
      title: '시스템 설계 면접 스터디 모집', body: '매주 토요일 오전, 하루설계 문제로 모의 면접을 해요. 4명 남았어요.' },
  ];
  return { users, topics, posts, likes, comments, sponsors, events: demoEvents(), me: null, seq: 1000 };
}

// 데모용 지난 3주 이용 기록 (매번 같은 값이 나오도록 간단한 의사 난수 사용)
function demoEvents() {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const events = [];
  const paths = ['/today', '/today', '/today', '/archive', '/topic'];
  for (let d = 20; d >= 0; d--) {
    const day = new Date(Date.now() - d * 86400000);
    const visitors = Math.round(14 + d % 7 * 2 + rand() * 10);
    for (let v = 0; v < visitors; v++) {
      const vid = `demo-${d}-${v}`.padEnd(8, '0');
      const at = (min) => new Date(day.getTime() - min * 60000).toISOString();
      const views = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < views; i++) events.push({ visitor_id: vid, type: 'view', path: paths[Math.floor(rand() * paths.length)], created_at: at(rand() * 600) });
      if (rand() < 0.3) events.push({ visitor_id: vid, type: 'like', path: 'on', created_at: at(rand() * 600) });
      if (rand() < 0.15) events.push({ visitor_id: vid, type: 'comment_create', path: rand() < 0.3 ? 'reply' : 'comment', created_at: at(rand() * 600) });
      if (rand() < 0.1) events.push({ visitor_id: vid, type: 'post_create', path: null, created_at: at(rand() * 600) });
      if (rand() < 0.08) events.push({ visitor_id: vid, type: 'ai_review', path: null, status: rand() < 0.1 ? 502 : 200, duration_ms: Math.round(18000 + rand() * 20000), created_at: at(rand() * 600) });
    }
  }
  return events;
}

// admin_metrics() SQL 과 같은 모양으로 집계한다 (데모 모드용)
function aggregateMetrics(events, days) {
  const today = kstDate();
  const first = addDays(today, -(days - 1));
  const ev = events.map((e) => ({ ...e, day: kstDate(new Date(e.created_at)) })).filter((e) => e.day >= first && e.day <= today);
  const daily = [];
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const views = ev.filter((e) => e.day === d && e.type === 'view');
    daily.push({ day: d, visitors: new Set(views.map((e) => e.visitor_id)).size, views: views.length });
  }
  const groups = new Map();
  for (const e of ev) {
    const key = e.type + ' ' + (e.path || '');
    const g = groups.get(key) || { type: e.type, path: e.path || '', count: 0, today: 0, errors: 0, ms: [] };
    g.count++; if (e.day === today) g.today++;
    if (e.status >= 400) g.errors++;
    if (e.duration_ms != null) g.ms.push(e.duration_ms);
    groups.set(key, g);
  }
  const endpoints = [...groups.values()]
    .map(({ ms, ...g }) => ({ ...g, avg_ms: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null }))
    .sort((a, b) => b.count - a.count);
  const views = ev.filter((e) => e.type === 'view');
  return { days, today, daily, endpoints, range: { visitors: new Set(views.map((e) => e.visitor_id)).size, views: views.length } };
}

// 데모용 AI 점수: 적은 단락과 분량으로 점수를 정한다 (api/review.js 와 같은 모양)
function demoReview(p) {
  const has = (re) => re.test(p.content);
  const base = Math.min(3, Math.floor(meaningful(p.content).length / 120));
  const c = (name, bonus, comment) => ({ name, score: Math.min(10, 4 + base + bonus), comment });
  const criteria = [
    c('요구사항 이해', has(/요구사항|가정/) ? 2 : 0, '데모 점수예요. 문제의 조건을 얼마나 짚었는지 봐요.'),
    c('구성 요소 선택', has(/구성 요소|Redis|MySQL|Kafka/i) ? 2 : 0, '데모 점수예요. 규모에 맞는 구성인지 봐요.'),
    c('트레이드오프 판단', has(/포기/) ? 3 : 0, '데모 점수예요. 포기한 것을 적었는지 봐요.'),
    c('병목과 확장성', has(/병목|경합|피크|확장/) ? 2 : 0, '데모 점수예요. 먼저 터질 곳을 봤는지 봐요.'),
    c('설명의 명확성', p.image_url ? 2 : 1, '데모 점수예요. 글과 그림만으로 이해되는지 봐요.'),
  ];
  const score = Math.round(criteria.reduce((a, x) => a + x.score, 0) * 2);
  return { score, summary: '데모 모드라 실제 AI 대신 글의 단락과 분량으로 매긴 점수예요.', criteria, strengths: [], improvements: [] };
}

// 데모용 AI 아키텍처: 글에 나온 구성 요소를 찾아 종류별 열에 놓고 흐름대로 잇는다
const DEMO_WORDS = {
  client: /클라이언트|사용자|앱/, cdn: /CDN/i, lb: /로드 ?밸런서|LB\b/i, gateway: /게이트웨이/, api: /API|서버/i,
  worker: /워커|컨슈머/, batch: /배치|스케줄러/, redis: /Redis/i, cache: /캐시/, kafka: /Kafka/i, queue: /큐|Queue|Stream/i,
  mysql: /MySQL/i, sql: /Postgre|SQL DB|RDB/i, nosql: /NoSQL|Mongo|Dynamo|Cassandra/i, search: /검색|Elastic/i, push: /푸시|FCM|APNs/i,
};
function demoDiagram(content) {
  const found = Object.keys(DEMO_WORDS).filter((t) => DEMO_WORDS[t].test(content));
  const types = [...new Set(['client', 'api', ...found])];
  if (types.length < 3) return null;
  const COL = { edge: 0, compute: 1, memory: 2, queue: 2, external: 3, store: 3 };
  const rows = {};
  const nodes = types.map((type, i) => {
    const t = DG_TYPES.find((x) => x.type === type);
    let col = COL[t.kind];
    if (type === 'worker' || type === 'batch') col = 3;
    if (t.kind === 'store' && (types.includes('worker') || types.includes('batch'))) col = 4;
    const row = (rows[col] = (rows[col] ?? -1) + 1);
    return { id: 'n' + (i + 1), type, label: t.name, x: 24 + col * 250, y: 24 + row * 100, dup: false };
  });
  const id = (type) => nodes.find((n) => n.type === type)?.id;
  const by = (kind) => nodes.filter((n) => DG_TYPES.find((x) => x.type === n.type).kind === kind && !['client', 'api'].includes(n.type));
  const edges = [];
  const link = (from, to, async = false) => { if (from && to && from !== to) edges.push({ id: 'e' + (edges.length + 1), from, to, async, label: '' }); };
  const edge = by('edge'), workers = nodes.filter((n) => n.type === 'worker' || n.type === 'batch');
  let prev = id('client');
  for (const n of edge) { link(prev, n.id); prev = n.id; }
  link(prev, id('api'));
  for (const n of [...by('memory'), ...by('external')]) link(id('api'), n.id);
  for (const n of by('queue')) { link(id('api'), n.id, true); for (const w of workers) link(n.id, w.id, true); }
  for (const n of by('store')) link(workers[0]?.id || id('api'), n.id);
  return { nodes, edges, seq: nodes.length + edges.length };
}

// supabase/2026-10-25-admin-timeline.sql 의 admin_timeline() 과 같은 모양으로 모은다
function aggregateTimeline(events, hours) {
  hours = hours <= 24 ? 24 : hours <= 168 ? 168 : 720;
  const bucket = { 24: 3600, 168: 21600, 720: 86400 }[hours] * 1000, KST = 9 * 3600000;
  const floor = (ms) => Math.floor((ms + KST) / bucket) * bucket - KST;
  const since = floor(Date.now()) - bucket * (hours * 3600000 / bucket - 1);
  const ev = events.filter((e) => Date.parse(e.created_at) >= since);
  const map = new Map();
  for (const e of ev) {
    const ts = floor(Date.parse(e.created_at)), key = `${ts} ${e.type}`;
    const r = map.get(key) || { ts, type: e.type, count: 0, errors: 0 };
    r.count++; if (e.status >= 400) r.errors++;
    map.set(key, r);
  }
  const recent = [...ev].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200)
    .map((e) => ({ created_at: e.created_at, type: e.type, path: e.path || '', status: e.status ?? null, duration_ms: e.duration_ms ?? null, visitor: (e.visitor_id || '').slice(0, 6), signed_in: false }));
  return { hours, bucket_ms: bucket, since, series: [...map.values()].sort((a, b) => a.ts - b.ts), recent };
}

function createDemoApi() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { db = null; }
  if (!db) db = demoSeed();
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch { /* 저장 공간이 없으면 이번 방문 동안만 유지 */ } };
  const nextId = () => ++db.seq;
  const user = (id) => db.users.find((u) => u.id === id) || { id, nickname: '알 수 없음' };
  const today = () => kstDate();
  const need = () => { if (!db.me) throw new Error('닉네임을 먼저 정해주세요.'); return db.me; };
  const needAdmin = () => { if (!db.admin) throw new Error('관리자만 할 수 있어요.'); };
  const wait = () => new Promise((r) => setTimeout(r, 120));

  return {
    reset() { db = demoSeed(); save(); },
    async me() { return db.me ? { ...user(db.me), isAdmin: !!db.admin, isAnonymous: !db.admin } : null; },
    async ensureUser(nickname) {
      if (db.me) return;
      const u = { id: 'u-' + nextId(), nickname };
      db.users.push(u); db.me = u.id; db.admin = false; save();
    },
    async setNickname(nickname) { user(db.me).nickname = nickname; save(); },
    async adminSignIn({ code }) {
      if (code !== CONFIG.DEMO_ADMIN_CODE) throw new Error('관리자 코드가 맞지 않아요.');
      if (!db.users.some((u) => u.id === 'u-admin')) db.users.push({ id: 'u-admin', nickname: '관리자' });
      db.me = 'u-admin'; db.admin = true; save();
    },
    async signOut() { db.me = null; db.admin = false; save(); },

    async listTopics() {
      await wait();
      return db.topics
        .filter((t) => t.publish_date <= today() || db.admin)
        .map((t) => ({ ...t, post_count: db.posts.filter((p) => p.topic_id === t.id).length }))
        .sort((a, b) => b.publish_date.localeCompare(a.publish_date));
    },
    async saveTopic({ id, title, description, publish_date }) {
      needAdmin();
      if (db.topics.some((t) => t.publish_date === publish_date && t.id !== id)) {
        throw Object.assign(new Error('duplicate publish_date'), { code: '23505', message: 'publish_date' });
      }
      if (id) Object.assign(db.topics.find((t) => t.id === id), { title, description, publish_date });
      else db.topics.push({ id: nextId(), title, description, publish_date });
      save();
    },
    async deleteTopic(id) {
      needAdmin();
      const postIds = db.posts.filter((p) => p.topic_id === id).map((p) => p.id);
      db.topics = db.topics.filter((t) => t.id !== id);
      db.posts = db.posts.filter((p) => p.topic_id !== id);
      db.likes = db.likes.filter((l) => !postIds.includes(l.post_id));
      db.comments = db.comments.filter((c) => !postIds.includes(c.post_id));
      save();
    },

    async listPosts(topicId) {
      await wait();
      return db.posts.filter((p) => p.topic_id === topicId).map((p) => ({
        ...p, author: user(p.user_id),
        like_count: db.likes.filter((l) => l.post_id === p.id).length,
        comment_count: db.comments.filter((c) => c.post_id === p.id).length,
        liked: !!db.me && db.likes.some((l) => l.post_id === p.id && l.user_id === db.me),
      })).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createPost(topicId, content, file) {
      const me = need();
      if (db.posts.some((p) => p.topic_id === topicId && p.user_id === me)) throw Object.assign(new Error('dup'), { code: '23505', message: 'post' });
      let image_url = null;
      if (file) { const { blob } = await prepareImage(file, { max: 1200, forceCompress: true }); image_url = await blobToDataURL(blob); }
      db.posts.push({ id: nextId(), topic_id: topicId, user_id: me, content, image_url, created_at: new Date().toISOString() });
      save();
    },
    async deletePost(post) {
      db.posts = db.posts.filter((p) => p.id !== post.id);
      db.likes = db.likes.filter((l) => l.post_id !== post.id);
      db.comments = db.comments.filter((c) => c.post_id !== post.id);
      save();
    },
    async setLike(postId, on) {
      const me = need();
      db.likes = db.likes.filter((l) => !(l.post_id === postId && l.user_id === me));
      if (on) db.likes.push({ post_id: postId, user_id: me });
      save();
    },
    async listComments(postId) {
      await wait();
      return db.comments.filter((c) => c.post_id === postId).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => ({ ...c, author: user(c.user_id) }));
    },
    async addComment(postId, content, parentId = null) {
      const me = need();
      db.comments.push({ id: nextId(), post_id: postId, user_id: me, content, parent_id: parentId, created_at: new Date().toISOString() });
      save();
    },
    // 댓글을 지우면 달린 답글도 함께 지운다 (Supabase 의 on delete cascade 와 같게)
    async deleteComment(id) { db.comments = db.comments.filter((c) => c.id !== id && c.parent_id !== id); save(); },
    async review() { throw new Error('AI 평가는 데모 모드에서는 쓸 수 없어요.'); },
    // 데모에서는 Claude 대신 글 길이와 단락으로 그럴듯한 점수를 만든다
    async scorePost(postId) {
      await new Promise((r) => setTimeout(r, 2000));
      const p = db.posts.find((x) => x.id === postId);
      if (!p) throw new Error('글을 찾지 못했어요.');
      if (!p.ai_review) {
        p.ai_review = demoReview(p);
        p.ai_score = p.ai_review.score;
        p.ai_review_status = 'done';
        save();
      }
      return { status: 'done', score: p.ai_score, review: p.ai_review };
    },
    // 데모에서는 Claude 대신 글에 나온 구성 요소 이름으로 간단히 그린다
    async drawDiagram(postId) {
      await new Promise((r) => setTimeout(r, 1500));
      const p = db.posts.find((x) => x.id === postId);
      if (!p) throw new Error('글을 찾지 못했어요.');
      if (p.image_url) return { status: 'skip' };
      if (!p.ai_diagram) {
        p.ai_diagram = demoDiagram(p.content);
        p.ai_diagram_status = p.ai_diagram ? 'done' : 'failed';
        save();
      }
      return p.ai_diagram ? { status: 'done', diagram: p.ai_diagram } : { status: 'failed' };
    },

    async listSponsors() {
      await wait();
      return (db.sponsors || []).filter((s) => s.active || db.admin).map((s) => ({ ...s }));
    },
    async saveSponsor({ id, title, body, link_url, active, image_style, sort_order, file, removeImage }) {
      needAdmin();
      db.sponsors = db.sponsors || [];
      const row = { title, body, link_url, active, image_style, ...(sort_order != null ? { sort_order } : {}) };
      if (file) { const { blob } = await prepareImage(file, { max: 600, forceCompress: true }); row.image_url = await blobToDataURL(blob); }
      else if (removeImage) row.image_url = null;
      if (id) Object.assign(db.sponsors.find((s) => s.id === id), row);
      else db.sponsors.push({ image_url: null, ...row, id: nextId(), created_at: new Date().toISOString() });
      save();
    },
    async setSponsorActive(id, active) { needAdmin(); db.sponsors.find((s) => s.id === id).active = active; save(); },
    async reorderSponsors(changes) { needAdmin(); for (const { id, sort_order } of changes) db.sponsors.find((s) => s.id === id).sort_order = sort_order; save(); },
    async deleteSponsor(s) { needAdmin(); db.sponsors = db.sponsors.filter((x) => x.id !== s.id); save(); },

    async subscribe(email) {
      await wait();
      db.subscribers = db.subscribers || [];
      if (db.subscribers.some((s) => s.email.toLowerCase() === email.toLowerCase())) return { already: true };
      db.subscribers.push({ id: nextId(), email, created_at: new Date().toISOString() });
      save();
      return { already: false };
    },
    async subscriberCount() { return 128 + (db.subscribers || []).length; },
    async listSubscribers() { needAdmin(); await wait(); return [...(db.subscribers || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async deleteSubscriber(id) { needAdmin(); db.subscribers = (db.subscribers || []).filter((s) => s.id !== id); save(); },
    async lastNewsletter() { return null; },
    async sendTestMail() { throw new Error('메일 발송은 데모 모드에서는 쓸 수 없어요.'); },

    async track(row) {
      db.events = (db.events || []).concat({ ...row, created_at: new Date().toISOString() }).slice(-3000);
      save();
    },
    async adminMetrics(days) { needAdmin(); await wait(); return aggregateMetrics(db.events || [], days); },
    async adminTimeline(hours) { needAdmin(); await wait(); return aggregateTimeline(db.events || [], hours); },
  };
}

/* =====================================================================
   앱 상태와 화면
   ===================================================================== */
let api;
const state = {
  view: 'today',          // today | archive | topic | admin
  me: null,
  topics: [],
  topicId: null,
  posts: [],
  sort: 'top',            // top | new
  expanded: new Set(),    // 펼친 본문
  openScores: new Set(),  // 세부 점수를 펼친 글
  openComments: new Set(),
  comments: {},           // postId -> comment[]
  replyTo: null,          // 답글 입력 중인 자리: { postId, rootId, nick }
  commentDrafts: {},      // 입력 칸 id -> 쓰던 댓글 (다시 그려도 남도록)
  draft: TEMPLATE,
  draftFile: null,
  draftPreview: null,
  diagram: null,          // 캔버스 그림 (dgNew())
  dgMode: 'canvas',       // canvas | image
  editingTopic: null,
  composing: false,       // 작성 폼 열림 여부
  busy: false,
  review: null,           // AI 평가: { loading } | { result } | { error }
  metrics: null,          // 관리자 지표: { days, data, loading, error }
  timeline: null,         // 관리자 요청 모니터링: { hours, data, loading, error, only, failOnly }
  subEmail: '',           // 상단 공지에 쓰던 이메일
  subDone: false,         // 방금 구독함 (이번 방문 동안 고마움 표시)
  subCount: null,         // 구독자 수 (상단 공지에 표시)
  subscribers: null,      // 관리자: { list, loading, error }
  sponsors: [],           // 켜진 스폰서 (관리자는 전부), sort_order 순
  editingSponsor: null,   // 관리자: 수정 중인 스폰서
  sponsorFile: null,      // 관리자: 새로 고른 이미지 { file, url }
};

/* ---------- 이용 기록 (관리자 지표용) ---------- */
// 브라우저마다 임의의 id 하나만 둔다. IP 나 기기 정보는 남기지 않는다.
const VISITOR_KEY = 'harusolgye-visitor';
// randomUUID 는 https 에서만 있으므로 없으면 난수 문자열로 대신한다
const randomId = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const visitorId = (() => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) { id = randomId(); localStorage.setItem(VISITOR_KEY, id); }
    return id;
  } catch { return randomId(); }
})();
// 관리자 본인의 사용은 지표에서 뺀다. 기록이 실패해도 화면에는 영향이 없다.
function track(type, path = null, extra = {}) {
  if (!api || state.me?.isAdmin) return;
  api.track({ visitor_id: visitorId, type, path, ...extra }).catch(() => {});
}

const publishedTopics = () => state.topics.filter((t) => t.publish_date <= kstDate());
const currentTopic = () => state.topics.find((t) => t.id === state.topicId) || null;

function go(view, topicId = null) {
  state.view = view;
  if (topicId != null) state.topicId = topicId;
  try { history.replaceState(null, '', view === 'today' ? location.pathname + location.search : '#' + (view === 'topic' ? 'archive' : view)); } catch { /* frame may refuse */ }
  window.scrollTo({ top: 0 });
  render();
  track('view', '/' + view);
  if (view === 'admin' && state.me?.isAdmin) { loadMetrics(); loadTimeline(); loadSubscribers(); refreshSponsors().then(() => { const w = $('.sponsor-rows-wrap'); if (w) w.outerHTML = sponsorRowsHtml(); }); }
}

async function refreshMe() { state.me = await api.me(); }
async function refreshTopics() { state.topics = await api.listTopics(); }
async function refreshPosts() {
  if (state.topicId == null) { state.posts = []; return; }
  state.posts = await api.listPosts(state.topicId);
  for (const id of state.openComments) state.comments[id] = await api.listComments(id);
  drawMissingDiagrams();
  aiScore.fill();
}

/* ---------- AI 백그라운드 작업 (그림, 점수) ---------- */
// 글마다 한 번 서버에서 만들어 저장하는 AI 결과를 동시 MAX 개씩 부탁하고, 오는 대로 그 글만 다시 그린다.
// 결과는 서버에 저장되므로 글마다 처음 본 한 사람만 기다리고, 그다음부터는 바로 보인다.
// needs(p): 아직 결과가 없는 글인지 / status(p): 서버 상태 / call(id): api 호출 / apply(p, r): 'done' 결과 반영
function aiJob({ needs, status, call, apply, fail }) {
  const job = { running: new Set(), queue: [], tries: {}, off: false, MAX: 2, RETRY_MS: 15000, TRIES: 5 };
  job.busy = (p) => needs(p) && !job.off && (job.running.has(p.id) || job.queue.includes(p.id) || status(p) === 'pending');
  job.fill = () => {
    if (job.off) return;
    for (const p of state.posts) {
      if (needs(p) && !job.running.has(p.id) && !job.queue.includes(p.id) && (job.tries[p.id] || 0) < job.TRIES) job.queue.push(p.id);
    }
    pump();
  };
  const pump = () => { while (!job.off && job.running.size < job.MAX && job.queue.length) run(job.queue.shift()); };
  async function run(id) {
    job.running.add(id);
    job.tries[id] = (job.tries[id] || 0) + 1;
    let retry = false;
    try {
      const r = await call(id);
      const p = state.posts.find((x) => x.id === id);
      if (p && r.status === 'done') apply(p, r);
      else if (p && r.status === 'failed') fail(p);
      retry = r.status === 'pending';  // 다른 사람이 맡아 하는 중이면 잠시 뒤 결과를 받으러 다시 온다
    } catch (e) {
      // 서버 설정 전(503)이나 DB 변경 전이면 이번 방문 동안은 더 부르지 않는다
      if (e.status === 503 || e.status === 500 || e.status === 400) job.off = true;
      else retry = true;
    }
    job.running.delete(id);
    if (retry && job.tries[id] < job.TRIES) setTimeout(() => { if (state.posts.some((p) => p.id === id)) job.fill(); }, job.RETRY_MS);
    else if (retry) { const p = state.posts.find((x) => x.id === id); if (p) fail(p); }
    rerenderPost(id);
    pump();
  }
  return job;
}

// 다이어그램 없이 글만 있는 답안은 AI 에게 그림을 부탁한다
const aiDraw = aiJob({
  needs: (p) => !p.image_url && !p.ai_diagram && p.ai_diagram_status !== 'failed' && !!meaningful(p.content || ''),
  status: (p) => p.ai_diagram_status,
  call: (id) => api.drawDiagram(id),
  apply: (p, r) => { p.ai_diagram = r.diagram; p.ai_diagram_status = 'done'; },
  fail: (p) => { p.ai_diagram_status = 'failed'; },
});
const isDrawing = aiDraw.busy;
const drawMissingDiagrams = aiDraw.fill;

// 올라온 글마다 AI 가 한 번 채점한다. 예시 답안은 채점하지 않는다.
const aiScore = aiJob({
  needs: (p) => !p.is_sample && p.ai_score == null && p.ai_review_status !== 'failed' && !!meaningful(p.content || ''),
  status: (p) => p.ai_review_status,
  call: (id) => api.scorePost(id),
  apply: (p, r) => { p.ai_score = r.score; p.ai_review = r.review; p.ai_review_status = 'done'; },
  fail: (p) => { p.ai_review_status = 'failed'; },
});

// 입력 중인 글이나 스크롤이 날아가지 않게 해당 글의 그림 자리만 바꾼다
function rerenderPost(id) {
  const box = document.getElementById(`post-${id}`);
  const p = state.posts.find((x) => x.id === id);
  if (!box || !p) return;
  box.querySelector('.post-fig')?.replaceWith(htmlNode(postFigHtml(p)));
  box.querySelector('.post-score')?.replaceWith(htmlNode(postScoreHtml(p)));
  box.querySelector('.score-detail')?.replaceWith(htmlNode(scoreDetailHtml(p)));
}
const htmlNode = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

/* ---------- header ---------- */
function renderChrome() {
  const items = [['today', '오늘의 문제'], ['archive', '지난 문제']];
  if (state.me?.isAdmin) items.push(['admin', '관리자']);
  const active = state.view === 'topic' ? 'archive' : state.view;
  $('#nav').innerHTML = items.map(([v, label]) => `<button type="button" data-nav="${v}" ${active === v ? 'aria-current="page"' : ''}>${label}</button>`).join('');
  $('#who').innerHTML = !state.me
    ? `<button class="btn ghost small" type="button" data-act="nickname">닉네임 정하기</button>`
    : state.me.isAdmin
      ? `<span class="chip">관리자</span><span class="name">${esc(state.me.nickname)}</span><button class="btn ghost small" type="button" data-act="logout">로그아웃</button>`
      : `<button class="btn ghost small" type="button" data-act="nickname" aria-label="닉네임 바꾸기"><span class="avatar" aria-hidden="true">${initial(state.me.nickname)}</span><span class="name">${esc(state.me.nickname)}</span></button>`;
  const moved = MOVED
    ? `<div class="move-banner" role="status"><strong>사이트 주소가 바뀌었어요</strong><span>문제와 올린 설계는 그대로예요. 닉네임만 새 주소에서 다시 정해 주세요.</span><a class="btn small primary" href="${NEW_SITE}/${location.hash}">새 주소로 가기</a></div>`
    : '';
  const notice = state.subDone
    ? `<div class="notice" role="status"><span class="chip">구독</span><div class="notice-body"><strong>이메일을 남겼어요</strong><span>매일 올라오는 설계 문제를 ${esc(state.subDone)}(으)로 보내 드릴게요.</span></div><button class="btn ghost small" type="button" data-act="dismiss-notice" aria-label="공지 닫기">✕</button></div>`
    : noticeClosed || state.me?.isAdmin ? ''
    : `<div class="notice subscribe" role="region" aria-label="이메일 구독"><span class="chip">NEW</span><div class="notice-body"><strong>매일 올라오는 설계 문제를 이메일로 받고 싶다면 이메일을 남겨주세요!</strong>
        <form class="sub-form" id="sub-form"><input type="email" id="sub-email" required maxlength="254" placeholder="name@example.com" autocomplete="email" aria-label="이메일" value="${esc(state.subEmail)}"><button class="btn small primary" type="submit">받아보기</button></form>
        <span class="sub-note">${state.subCount >= SUB_COUNT_MIN ? `지금 <b>${fmtNum(state.subCount)}명</b>이 매일 아침 이메일로 설계 문제를 받고 있어요 · ` : ''}문제 발송에만 써요.</span></div><button class="btn ghost small" type="button" data-act="dismiss-notice" aria-label="공지 닫기">✕</button></div>`;
  // 이메일을 쓰는 중에 화면이 다시 그려져도 입력 위치를 지킨다
  const typingEmail = document.activeElement?.id === 'sub-email';
  $('#banner').innerHTML = moved + notice + (DEMO
    ? `<div class="demo-banner"><strong>데모 모드</strong><span>데이터는 이 브라우저에만 저장돼요. 관리자 페이지는 맨 아래 링크에서 코드 <b class="mono">${esc(CONFIG.DEMO_ADMIN_CODE)}</b>로 들어갈 수 있어요.</span><button class="btn small" type="button" data-act="reset-demo">예시 데이터로 되돌리기</button></div>`
    : '');
  if (typingEmail) $('#sub-email')?.focus();
}

/* ---------- topic sheet ---------- */
const myPost = () => state.me && state.posts.find((p) => p.user_id === state.me.id && !p.is_sample);

function sheetHtml(topic, { isToday }) {
  const d = topic.publish_date;
  const action = myPost() ? `<span class="mine-note">이미 설계를 올렸어요 · 다시 쓰려면 내 글을 삭제해 주세요</span>` : '';
  const chip = isToday ? '<span class="chip">오늘의 문제</span>' : '<span class="chip past">지난 문제</span>';
  return `
  <section class="sheet" aria-labelledby="topic-title">
    <div class="sheet-meta">${chip}<span class="mono">${fmtDate(d)} (${weekday(d)}) · DAY ${dayOfYear(d)}</span></div>
    <h1 id="topic-title">${esc(topic.title)}</h1>
    <p class="desc">${esc(topic.description)}</p>
    <div class="foot"><span class="count">지금까지 <b class="mono">${state.posts.filter((p) => !p.is_sample).length}</b>명이 설계를 올렸어요</span>${action}</div>
  </section>`;
}

/* ---------- composer ---------- */
const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

/* 화면을 밀어내지 않도록 떠 있는 버튼 → 떠 있는 작성 시트로 연다 */
function composerHtml(topic) {
  if (myPost()) return '';
  if (!state.composing) return `<button class="btn primary fab" type="button" data-act="compose" aria-label="설계 작성하기">${PENCIL}<span>설계 작성하기</span></button>`;
  return `
  <div class="overlay compose-overlay" data-act="backdrop-compose">
  <section class="panel compose-sheet" role="dialog" aria-modal="true" aria-labelledby="composer-title">
    <div class="compose-head">
      <h2 id="composer-title">내 설계 올리기</h2>
      <button class="btn ghost small" type="button" data-act="cancel-compose" aria-label="닫기" ${state.busy ? 'disabled' : ''}>✕</button>
    </div>
    <details class="compose-ref"><summary>문제 다시 보기 · ${esc(topic.title)}</summary><p>${esc(topic.description)}</p></details>
    <p class="hint">정답은 없어요. 무엇을 고르고 무엇을 포기했는지가 핵심이에요. 빈 칸은 지워도 됩니다.</p>
    <form class="composer-grid" id="composer">
      ${state.me
        ? `<p class="mine-note">작성자 <b>${esc(state.me.nickname)}</b>${state.me.isAdmin ? '' : ' <button class="btn ghost small" type="button" data-act="nickname">바꾸기</button>'}</p>`
        : `<div class="field"><label for="post-nick">닉네임 <span class="sub">가입 없이 이 브라우저에서 계속 쓰여요</span></label><input type="text" id="post-nick" maxlength="20" placeholder="예: 누누" autocomplete="nickname" value="${esc(state.draftNick || '')}"></div>`}
      <div class="field">
        <label for="post-content">설계 설명</label>
        <textarea id="post-content" name="content" spellcheck="false">${esc(state.draft)}</textarea>
      </div>
      ${dgShellHtml()}
      ${reviewHtml()}
      <div class="actions">
        <span class="note">한 문제에 한 번 올릴 수 있어요</span>
        <button class="btn ghost" type="button" data-act="cancel-compose" ${state.busy ? 'disabled' : ''}>닫기</button>
        <button class="btn primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '올리는 중…' : '설계 올리기'}</button>
      </div>
    </form>
  </section>
  </div>`;
}

/* ---------- AI 평가 ---------- */
function reviewHtml() {
  const r = state.review;
  const loading = !!r?.loading;
  const head = `
    <div class="ai-head">
      <div class="ai-title"><b>AI 평가</b><span>올리기 전에 점수와 피드백을 받아볼 수 있어요. 이 결과는 나에게만 보이고, 올린 글에는 AI 점수가 따로 매겨져요.</span></div>
      <button class="btn small" type="button" data-act="ai-review" ${loading || state.busy ? 'disabled' : ''}>${loading ? '평가하는 중…' : r?.result ? '다시 평가받기' : 'AI 평가 받기'}</button>
    </div>`;
  let body = '';
  if (loading) body = '<p class="ai-wait">글과 다이어그램을 읽고 있어요. 보통 20~40초 걸려요.</p>';
  else if (r?.error) body = `<p class="err" role="alert">${esc(r.error)}</p>`;
  else if (r?.result) {
    const x = r.result;
    const list = (items) => `<ul>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
    body = `
      <div class="ai-score"><b class="mono">${x.score}</b><span>/ 100</span><p>${esc(x.summary)}</p></div>
      <div class="ai-criteria">${x.criteria.map((c) => `
        <div class="ai-crit">
          <div class="ai-crit-head"><span>${esc(c.name)}</span><b class="mono">${c.score}<small>/10</small></b></div>
          <div class="ai-bar" aria-hidden="true"><i style="width:${c.score * 10}%"></i></div>
          <p>${esc(c.comment)}</p>
        </div>`).join('')}</div>
      ${x.strengths.length ? `<div class="ai-list good"><h4>잘한 점</h4>${list(x.strengths)}</div>` : ''}
      ${x.improvements.length ? `<div class="ai-list fix"><h4>더 좋아질 수 있는 점</h4>${list(x.improvements)}</div>` : ''}`;
  }
  return `<section class="ai-review" aria-live="polite">${head}${body}</section>`;
}

async function runReview() {
  const topic = currentTopic();
  if (!topic || state.review?.loading) return;
  state.draft = $('#post-content')?.value ?? state.draft;
  const content = state.draft.trim();
  if (!meaningful(content)) return toast('설계 내용을 한 줄 이상 적은 뒤 평가받을 수 있어요.');
  const nickname = $('#post-nick')?.value.trim().slice(0, 20);
  if (!state.me && !nickname) { $('#post-nick')?.focus(); return toast('닉네임을 먼저 입력해 주세요.'); }
  state.review = { loading: true }; render();
  let started = 0;
  try {
    if (!state.me) { await api.ensureUser(nickname); await refreshMe(); }
    const file = state.dgMode === 'image' ? state.draftFile : await dgExportPng();
    let image = null;
    if (file) { const { blob } = await prepareImage(file, { max: 1400 }); image = await blobToDataURL(blob); }
    started = performance.now();
    const result = await api.review({ topic: { title: topic.title, description: topic.description }, content, image });
    track('ai_review', null, { status: 200, duration_ms: Math.round(performance.now() - started) });
    state.review = { result };
  } catch (e) {
    if (started) track('ai_review', null, { status: e.status || 500, duration_ms: Math.round(performance.now() - started) });
    state.review = { error: friendlyError(e) };
  }
  render();
}

/* =====================================================================
   설계 캔버스: 컴포넌트 카드를 추가하고, 끌어 옮기고, 화살표로 잇는다.
   다 그린 그림은 올릴 때 PNG로 바뀌어 기존 이미지 첨부 자리에 들어간다.
   ===================================================================== */
const DG_TYPES = [
  { type: 'client', name: '클라이언트', kind: 'edge' },
  { type: 'dns', name: 'DNS', kind: 'edge' },
  { type: 'cdn', name: 'CDN', kind: 'edge' },
  { type: 'lb', name: '로드 밸런서', kind: 'edge' },
  { type: 'gateway', name: 'API 게이트웨이', kind: 'edge' },
  { type: 'api', name: 'API 서버', kind: 'compute' },
  { type: 'auth', name: '인증 서버', kind: 'compute' },
  { type: 'ws', name: 'WebSocket 서버', kind: 'compute' },
  { type: 'worker', name: '워커', kind: 'compute' },
  { type: 'batch', name: '배치/스케줄러', kind: 'compute' },
  { type: 'redis', name: 'Redis', kind: 'memory' },
  { type: 'cache', name: '분산 캐시', kind: 'memory' },
  { type: 'local', name: '로컬 캐시', kind: 'memory' },
  { type: 'mysql', name: 'MySQL', kind: 'store' },
  { type: 'sql', name: 'SQL DB', kind: 'store' },
  { type: 'replica', name: '읽기 복제본', kind: 'store' },
  { type: 'nosql', name: 'NoSQL', kind: 'store' },
  { type: 'blob', name: 'Blob Store', kind: 'store' },
  { type: 'search', name: '검색 엔진', kind: 'store' },
  { type: 'dw', name: '데이터 웨어하우스', kind: 'store' },
  { type: 'kafka', name: 'Kafka', kind: 'queue' },
  { type: 'queue', name: '메시지 큐', kind: 'queue' },
  { type: 'ext', name: '외부 API', kind: 'external' },
  { type: 'push', name: '푸시 알림', kind: 'external' },
  { type: 'monitor', name: '모니터링', kind: 'external' },
];
// 직접 추가한 카드는 type 'custom' 에 종류(kind)를 따로 들고 있다
const DG_KIND_LABEL = { edge: '진입점', compute: '서버', memory: '캐시', store: '저장소', queue: '큐', external: '외부' };
const DG_KIND = {
  edge:     { fill: '#e8f8f0', stroke: '#03965a', chip: '#03b26c' },
  compute:  { fill: '#ffffff', stroke: '#333d4b', chip: '#4e5968' },
  memory:   { fill: '#fff0f1', stroke: '#e0323f', chip: '#f04452' },
  store:    { fill: '#e8f3ff', stroke: '#1b64da', chip: '#3182f6' },
  queue:    { fill: '#fff3e0', stroke: '#d97a00', chip: '#fe9800' },
  external: { fill: '#f2f4f6', stroke: '#8b95a1', chip: '#8b95a1', dashed: true },
};
const DG = { NODE_H: 58, MIN_W: 124, MAX_W: 220, GRID: 8, H_WIDE: 440, H_NARROW: 380, BLUE: '#3182f6', INK: '#191f28', MUTED: '#6b7684' };
const DG_FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const dgType = (t) => DG_TYPES.find((x) => x.type === t) || DG_TYPES.find((x) => x.type === 'api');
const dgNodeType = (n) => (n.type === 'custom'
  ? { type: 'custom', name: DG_KIND_LABEL[n.kind] || DG_KIND_LABEL.compute, kind: DG_KIND[n.kind] ? n.kind : 'compute' }
  : dgType(n.type));
const dgNew = () => ({ nodes: [], edges: [], seq: 0 });
const dgView = { w: 600, h: DG.H_WIDE, sel: null, connectFrom: null, drag: null, ro: null, customOpen: false, customKind: 'compute', customName: '', typing: null };

/* ---------- 되돌리기 / 다시 하기 ---------- */
const dgHist = { past: [], future: [] };
const dgSnapshot = () => JSON.stringify(state.diagram);
function dgRecord(snap = dgSnapshot()) {
  dgHist.past.push(snap);
  if (dgHist.past.length > 100) dgHist.past.shift();
  dgHist.future = [];
}
// 그림을 바꾸는 동작을 감싸서, 실제로 바뀌었을 때만 되돌리기 한 단계로 남긴다
function dgMutate(fn) {
  const before = dgSnapshot();
  const out = fn();
  if (dgSnapshot() !== before) dgRecord(before);
  return out;
}
function dgStep(from, to) {
  if (!from.length) return;
  to.push(dgSnapshot());
  state.diagram = JSON.parse(from.pop());
  dgView.sel = null; dgView.connectFrom = null;
  dgRender();
}
const dgUndo = () => dgStep(dgHist.past, dgHist.future);
const dgRedo = () => dgStep(dgHist.future, dgHist.past);
function dgResetHistory() { dgHist.past = []; dgHist.future = []; }
function dgRenderHistory() {
  const u = $('[data-dg-act="undo"]'), r = $('[data-dg-act="redo"]');
  if (u) u.disabled = !dgHist.past.length;
  if (r) r.disabled = !dgHist.future.length;
}

function dgTextWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 255 ? size * 1.02 : size * 0.6;
  return w;
}
function dgNodeW(n) {
  const t = dgNodeType(n);
  const w = Math.max(dgTextWidth(n.label, 14), n.label !== t.name ? dgTextWidth(t.name, 11) : 0) + 36;
  return Math.round(Math.min(DG.MAX_W, Math.max(DG.MIN_W, w)));
}
function dgClip(s, maxW, size) {
  if (dgTextWidth(s, size) <= maxW) return s;
  let out = '';
  for (const ch of s) { if (dgTextWidth(out + ch + '…', size) > maxW) break; out += ch; }
  return out + '…';
}
const dgSnap = (v) => Math.round(v / DG.GRID) * DG.GRID;
const dgFind = (id) => state.diagram.nodes.find((n) => n.id === id);

function dgBorderPoint(n, toward) {
  const w = dgNodeW(n), h = DG.NODE_H;
  const cx = n.x + w / 2, cy = n.y + h / 2, dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const t = Math.min(Math.abs((w / 2 + 4) / (dx || 1e-9)), Math.abs((h / 2 + 4) / (dy || 1e-9)));
  return { x: cx + dx * t, y: cy + dy * t };
}
const dgCenter = (n) => ({ x: n.x + dgNodeW(n) / 2, y: n.y + DG.NODE_H / 2 });

/* ---------- SVG markup (편집 화면과 내보내기에서 같이 씀) ---------- */
function dgEdgeGeom(e, d) {
  const a = d.nodes.find((n) => n.id === e.from), b = d.nodes.find((n) => n.id === e.to);
  if (!a || !b) return null;
  let p = dgBorderPoint(a, dgCenter(b)), q = dgBorderPoint(b, dgCenter(a));
  if (d.edges.some((o) => o.from === e.to && o.to === e.from)) {
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1, ox = -(q.y - p.y) / len * 7, oy = (q.x - p.x) / len * 7;
    p = { x: p.x + ox, y: p.y + oy }; q = { x: q.x + ox, y: q.y + oy };
  }
  return { p, q, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
}

function dgSvgBody(d, { sel = null, connectFrom = null, forExport = false } = {}) {
  let s = '', labels = '';
  for (const e of d.edges) {
    const g = dgEdgeGeom(e, d);
    if (!g) continue;
    const on = sel && sel.kind === 'edge' && sel.id === e.id;
    const color = on ? DG.BLUE : '#4e5968';
    s += `<g class="dg-edge" data-id="${e.id}">`;
    if (!forExport) s += `<line x1="${g.p.x}" y1="${g.p.y}" x2="${g.q.x}" y2="${g.q.y}" stroke="transparent" stroke-width="16"/>`;
    s += `<line x1="${g.p.x}" y1="${g.p.y}" x2="${g.q.x}" y2="${g.q.y}" stroke="${color}" stroke-width="${on ? 2.5 : 1.8}" ${e.async ? 'stroke-dasharray="7 5"' : ''} marker-end="url(#${on ? 'dg-arrow-on' : 'dg-arrow'})"/>`;
    if (e.label) {
      const lw = dgTextWidth(e.label, 12) + 14;
      labels += `<g class="dg-edge" data-id="${e.id}"><rect x="${g.mx - lw / 2}" y="${g.my - 11}" width="${lw}" height="22" rx="11" fill="#ffffff" stroke="${on ? DG.BLUE : '#d1d6db'}"/>`;
      labels += `<text x="${g.mx}" y="${g.my + 4}" text-anchor="middle" font-size="12" font-weight="500" fill="${on ? DG.BLUE : '#4e5968'}">${esc(e.label)}</text></g>`;
    }
    s += '</g>';
  }
  for (const n of d.nodes) {
    const t = dgNodeType(n), k = DG_KIND[t.kind], w = dgNodeW(n), h = DG.NODE_H;
    const on = sel && sel.kind === 'node' && sel.id === n.id;
    const from = connectFrom === n.id;
    const stroke = on || from ? DG.BLUE : k.stroke;
    const dash = k.dashed ? 'stroke-dasharray="5 4"' : '';
    s += `<g class="dg-node" data-id="${n.id}" transform="translate(${n.x} ${n.y})">`;
    if (n.dup) s += `<rect x="6" y="6" width="${w}" height="${h}" rx="12" fill="${k.fill}" stroke="${k.stroke}" stroke-width="1.4" opacity=".7" ${dash}/>`;
    s += `<rect width="${w}" height="${h}" rx="12" fill="${k.fill}" stroke="${stroke}" stroke-width="${on || from ? 2.5 : 1.6}" ${dash}/>`;
    s += `<rect x="10" y="${h / 2 - 9}" width="4" height="18" rx="2" fill="${k.chip}"/>`;
    const two = n.label !== t.name;
    const label = dgClip(n.label, w - 30, 14);
    s += `<text x="${w / 2 + 4}" y="${two ? h / 2 - 3 : h / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${DG.INK}">${esc(label)}</text>`;
    if (two) s += `<text x="${w / 2 + 4}" y="${h / 2 + 15}" text-anchor="middle" font-size="11" fill="${DG.MUTED}">${esc(t.name)}</text>`;
    if (n.dup) s += `<g transform="translate(${w - 4} -6)"><rect x="-18" y="-1" width="30" height="18" rx="9" fill="${DG.INK}"/><text x="-3" y="12" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">×2</text></g>`;
    if (!forExport) s += `<circle class="dg-port" cx="${w}" cy="${h / 2}" r="7" fill="#ffffff" stroke="${DG.BLUE}" stroke-width="2"/>`;
    s += '</g>';
  }
  return s + labels;
}

const dgDefs = () => `<defs>
  <marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#4e5968"/></marker>
  <marker id="dg-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${DG.BLUE}"/></marker>
</defs>`;

/* ---------- 편집 화면 ---------- */
const UNDO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function dgShellHtml() {
  const mode = state.dgMode || 'canvas';
  const tabs = `<div class="seg dg-tabs" role="group" aria-label="다이어그램 방식">
      <button type="button" data-dg-act="mode" data-mode="canvas" aria-pressed="${mode === 'canvas'}">캔버스로 그리기</button>
      <button type="button" data-dg-act="mode" data-mode="image" aria-pressed="${mode === 'image'}">이미지 올리기</button>
    </div>`;
  if (mode === 'image') {
    return `<div class="field"><div class="dg-label-row"><label for="post-image">다이어그램 <span class="sub">선택</span></label>${tabs}</div>
      ${state.draftPreview
        ? `<div class="preview"><img src="${state.draftPreview}" alt="첨부한 다이어그램 미리보기"><button class="btn small" type="button" data-act="remove-image">이미지 빼기</button></div>`
        : `<label class="drop" id="drop" for="post-image">클릭하거나 이미지를 끌어다 놓으세요 · PNG, JPG, WEBP<input id="post-image" type="file" accept="image/*"></label>`}
    </div>`;
  }
  return `<div class="field"><div class="dg-label-row"><span class="dg-title" id="dg-title">다이어그램 <span class="sub">선택</span></span>${tabs}</div>
    <div class="dg" id="dg">
      <div class="dg-palette" role="toolbar" aria-label="컴포넌트 추가">
        <button type="button" class="dg-chip dg-chip-custom" data-dg-act="custom-open">+ 직접 추가</button>
        ${DG_TYPES.map((t) => `<button type="button" class="dg-chip" data-dg-add="${t.type}"><i style="background:${DG_KIND[t.kind].chip}"></i>${t.name}</button>`).join('')}
      </div>
      <div class="dg-stage" id="dg-stage">
        <svg id="dg-svg" role="img" aria-labelledby="dg-title" xmlns="http://www.w3.org/2000/svg">${dgDefs()}<g id="dg-layer"></g><line id="dg-temp" stroke="${DG.BLUE}" stroke-width="2" stroke-dasharray="4 4" visibility="hidden"/></svg>
        <div class="dg-empty" id="dg-empty" hidden>
          <p>위에서 컴포넌트를 눌러 추가하고,<br>카드 오른쪽 점을 끌어 다른 카드에 연결하세요.</p>
          <button class="btn small" type="button" data-dg-act="starter">클라이언트 → API 서버 → DB로 시작</button>
        </div>
      </div>
      <div class="dg-bar" id="dg-bar"></div>
      <div class="dg-foot">
        <p class="dg-legend"><span><b class="ln"></b>동기 호출</span><span><b class="ln dash"></b>비동기</span><span><b class="x2">×2</b>2중화 (같은 역할 두 대)</span></p>
        <div class="dg-history">
          <button class="btn small ghost" type="button" data-dg-act="undo" title="되돌리기 (Ctrl+Z)" aria-label="되돌리기" disabled>${UNDO_ICON}되돌리기</button>
          <button class="btn small ghost" type="button" data-dg-act="redo" title="다시 하기 (Ctrl+Shift+Z)" aria-label="다시 하기" disabled><span class="flip">${UNDO_ICON}</span></button>
        </div>
      </div>
    </div>
  </div>`;
}

function dgRender() {
  const svg = $('#dg-svg');
  if (!svg) return;
  const stage = $('#dg-stage');
  dgView.w = Math.max(320, Math.round(stage.clientWidth));
  dgView.h = dgView.w < 560 ? DG.H_NARROW : DG.H_WIDE;
  svg.setAttribute('viewBox', `0 0 ${dgView.w} ${dgView.h}`);
  svg.setAttribute('width', dgView.w); svg.setAttribute('height', dgView.h);
  for (const n of state.diagram.nodes) dgClamp(n);
  $('#dg-layer').innerHTML = dgSvgBody(state.diagram, { sel: dgView.sel, connectFrom: dgView.connectFrom });
  $('#dg-empty').hidden = state.diagram.nodes.length > 0;
  svg.classList.toggle('connecting', !!dgView.connectFrom);
  if (!dgView.ro) {
    dgView.ro = new ResizeObserver(() => { if ($('#dg-svg')) dgRenderSvg(); });
  }
  dgView.ro.disconnect(); dgView.ro.observe(stage);
  dgRenderBar();
  dgRenderHistory();
}
function dgRenderSvg() {
  const stage = $('#dg-stage'), svg = $('#dg-svg');
  if (!stage || !svg) return;
  const w = Math.max(320, Math.round(stage.clientWidth));
  if (w !== dgView.w) { dgView.w = w; dgView.h = w < 560 ? DG.H_NARROW : DG.H_WIDE; svg.setAttribute('viewBox', `0 0 ${w} ${dgView.h}`); svg.setAttribute('width', w); svg.setAttribute('height', dgView.h); for (const n of state.diagram.nodes) dgClamp(n); }
  $('#dg-layer').innerHTML = dgSvgBody(state.diagram, { sel: dgView.sel, connectFrom: dgView.connectFrom });
  $('#dg-empty').hidden = state.diagram.nodes.length > 0;
  svg.classList.toggle('connecting', !!dgView.connectFrom);
  dgRenderHistory();
}

function dgRenderBar() {
  const bar = $('#dg-bar');
  if (!bar) return;
  const sel = dgView.sel;
  dgView.typing = null;
  if (dgView.connectFrom) {
    bar.innerHTML = `<span class="dg-tip on">연결할 카드를 눌러주세요</span><button class="btn small" type="button" data-dg-act="cancel-connect">취소</button>`;
    return;
  }
  if (dgView.customOpen) {
    bar.innerHTML = `
      <input type="text" id="dg-custom-name" maxlength="20" value="${esc(dgView.customName)}" aria-label="새 카드 이름" placeholder="이름 (예: Elasticsearch)">
      <div class="seg" role="group" aria-label="카드 종류">
        ${Object.entries(DG_KIND_LABEL).map(([k, label]) => `<button type="button" data-dg-act="custom-kind" data-kind="${k}" aria-pressed="${dgView.customKind === k}">${label}</button>`).join('')}
      </div>
      <button class="btn small primary" type="button" data-dg-act="custom-add">추가</button>
      <button class="btn small ghost" type="button" data-dg-act="custom-cancel">취소</button>`;
    return;
  }
  if (sel?.kind === 'node') {
    const n = dgFind(sel.id);
    if (!n) { dgView.sel = null; return dgRenderBar(); }
    bar.innerHTML = `
      <input type="text" id="dg-name" maxlength="20" value="${esc(n.label)}" aria-label="카드 이름" placeholder="${esc(dgNodeType(n).name)}">
      <button class="btn small ${n.dup ? 'on' : ''}" type="button" data-dg-act="dup" aria-pressed="${!!n.dup}">×2 2중화</button>
      <button class="btn small" type="button" data-dg-act="connect">연결하기</button>
      <button class="btn small danger" type="button" data-dg-act="del">삭제</button>`;
    return;
  }
  if (sel?.kind === 'edge') {
    const e = state.diagram.edges.find((x) => x.id === sel.id);
    if (!e) { dgView.sel = null; return dgRenderBar(); }
    bar.innerHTML = `
      <div class="seg" role="group" aria-label="호출 방식">
        <button type="button" data-dg-act="sync" aria-pressed="${!e.async}">동기</button>
        <button type="button" data-dg-act="async" aria-pressed="${!!e.async}">비동기</button>
      </div>
      <input type="text" id="dg-elabel" maxlength="16" value="${esc(e.label || '')}" aria-label="화살표 이름" placeholder="화살표 이름 (예: 조회)">
      <button class="btn small" type="button" data-dg-act="flip">방향 바꾸기</button>
      <button class="btn small danger" type="button" data-dg-act="del">삭제</button>`;
    return;
  }
  bar.innerHTML = state.diagram.nodes.length
    ? `<span class="dg-tip">카드를 누르면 이름을 바꾸거나 2중화할 수 있고, 화살표를 누르면 동기/비동기를 고를 수 있어요.</span><button class="btn small ghost" type="button" data-dg-act="clear">전체 지우기</button>`
    : `<span class="dg-tip">그림 없이 글만 올려도 괜찮아요.</span>`;
}

function dgClamp(n) {
  n.x = Math.max(4, Math.min(dgView.w - dgNodeW(n) - (n.dup ? 12 : 6), n.x));
  n.y = Math.max(10, Math.min(dgView.h - DG.NODE_H - (n.dup ? 12 : 6), n.y));
}

function dgAdd(type, at, custom) {
  const d = state.diagram, t = dgType(type);
  const n = { id: 'n' + (++d.seq), type, label: t.name, x: 0, y: 0, dup: false };
  if (custom) { n.kind = custom.kind; n.label = custom.label; }
  if (at) { n.x = at.x; n.y = at.y; }
  else {
    // 비어 있는 자리를 왼쪽 위부터 격자로 찾는다
    const colW = 168, rowH = 96, cols = Math.max(1, Math.floor((dgView.w - 16) / colW));
    for (let i = 0; i < 60; i++) {
      const x = 16 + (i % cols) * colW, y = 24 + Math.floor(i / cols) * rowH;
      const hit = d.nodes.some((o) => Math.abs(o.x - x) < 120 && Math.abs(o.y - y) < 64);
      if (!hit) { n.x = x; n.y = y; break; }
      n.x = 24 + (i % 5) * 12; n.y = 24 + (i % 5) * 12;
    }
  }
  dgClamp(n);
  d.nodes.push(n);
  return n;
}

function dgConnect(from, to) {
  const d = state.diagram;
  if (!from || !to || from === to) return null;
  if (d.edges.some((e) => e.from === from && e.to === to)) return null;
  const e = { id: 'e' + (++d.seq), from, to, async: false, label: '' };
  d.edges.push(e);
  return e;
}

function dgDeleteSelected() {
  const d = state.diagram, sel = dgView.sel;
  if (!sel) return;
  dgMutate(() => {
    if (sel.kind === 'node') {
      d.nodes = d.nodes.filter((n) => n.id !== sel.id);
      d.edges = d.edges.filter((e) => e.from !== sel.id && e.to !== sel.id);
    } else {
      d.edges = d.edges.filter((e) => e.id !== sel.id);
    }
  });
  dgView.sel = null;
  dgRender();
}

function dgAddCustom() {
  const label = ($('#dg-custom-name')?.value ?? dgView.customName).trim();
  if (!label) { $('#dg-custom-name')?.focus(); return toast('카드 이름을 입력해 주세요.'); }
  const n = dgMutate(() => dgAdd('custom', null, { label, kind: dgView.customKind }));
  dgView.customOpen = false; dgView.customName = '';
  dgView.sel = { kind: 'node', id: n.id };
  dgRender();
}

function dgPoint(ev) {
  const svg = $('#dg-svg'), m = svg.getScreenCTM();
  const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
  return p.matrixTransform(m.inverse());
}
function dgNodeAt(pt) {
  const list = [...state.diagram.nodes].reverse();
  return list.find((n) => pt.x >= n.x - 4 && pt.x <= n.x + dgNodeW(n) + 8 && pt.y >= n.y - 4 && pt.y <= n.y + DG.NODE_H + 8);
}

/* ---------- 입력 ---------- */
document.addEventListener('pointerdown', (ev) => {
  const svg = ev.target.closest('#dg-svg');
  if (!svg) return;
  ev.preventDefault();
  // 글 입력칸에 포커스가 남아 있으면 Ctrl+Z 가 글 되돌리기로 가버리므로 풀어준다
  const focused = document.activeElement;
  if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) focused.blur();
  const pt = dgPoint(ev);
  const port = ev.target.closest('.dg-port');
  const nodeEl = ev.target.closest('.dg-node');
  const edgeEl = ev.target.closest('.dg-edge');

  if (dgView.connectFrom) {
    const target = nodeEl ? nodeEl.dataset.id : null;
    if (target && target !== dgView.connectFrom) {
      const e = dgMutate(() => dgConnect(dgView.connectFrom, target));
      dgView.sel = e ? { kind: 'edge', id: e.id } : { kind: 'node', id: target };
      dgView.connectFrom = null;
    } else if (!target) dgView.connectFrom = null;
    return dgRender();
  }
  if (nodeEl || edgeEl) dgView.customOpen = false;
  if (port && nodeEl) {
    const n = dgFind(nodeEl.dataset.id);
    dgView.drag = { mode: 'link', from: n.id };
    const c = { x: n.x + dgNodeW(n), y: n.y + DG.NODE_H / 2 };
    const tmp = $('#dg-temp');
    tmp.setAttribute('x1', c.x); tmp.setAttribute('y1', c.y); tmp.setAttribute('x2', pt.x); tmp.setAttribute('y2', pt.y);
    tmp.setAttribute('visibility', 'visible');
    svg.setPointerCapture(ev.pointerId);
    return;
  }
  if (nodeEl) {
    const n = dgFind(nodeEl.dataset.id);
    const snap = dgSnapshot();
    // 맨 앞으로 가져오기
    state.diagram.nodes = state.diagram.nodes.filter((x) => x !== n).concat(n);
    dgView.sel = { kind: 'node', id: n.id };
    dgView.drag = { mode: 'move', id: n.id, dx: pt.x - n.x, dy: pt.y - n.y, moved: false, snap, from: { x: n.x, y: n.y } };
    svg.setPointerCapture(ev.pointerId);
    return dgRender();
  }
  if (edgeEl) { dgView.sel = { kind: 'edge', id: edgeEl.dataset.id }; return dgRender(); }
  if (dgView.sel) { dgView.sel = null; dgRender(); }
});

document.addEventListener('pointermove', (ev) => {
  const drag = dgView.drag;
  if (!drag || !$('#dg-svg')) return;
  const pt = dgPoint(ev);
  if (drag.mode === 'move') {
    const n = dgFind(drag.id);
    if (!n) return;
    n.x = dgSnap(pt.x - drag.dx); n.y = dgSnap(pt.y - drag.dy);
    dgClamp(n);
    drag.moved = true;
    dgRenderSvg();
  } else if (drag.mode === 'link') {
    const tmp = $('#dg-temp');
    tmp.setAttribute('x2', pt.x); tmp.setAttribute('y2', pt.y);
  }
});

function dgEndDrag(ev) {
  const drag = dgView.drag;
  if (!drag) return;
  dgView.drag = null;
  if (!$('#dg-svg')) return;
  if (drag.mode === 'move') {
    const n = dgFind(drag.id);
    // 실제로 자리를 옮겼을 때만 되돌리기 한 단계로 남긴다 (클릭만 한 경우 제외)
    if (n && (n.x !== drag.from.x || n.y !== drag.from.y)) { dgRecord(drag.snap); dgRenderHistory(); }
  }
  if (drag.mode === 'link') {
    $('#dg-temp').setAttribute('visibility', 'hidden');
    const target = dgNodeAt(dgPoint(ev));
    if (target && target.id !== drag.from) {
      const e = dgMutate(() => dgConnect(drag.from, target.id));
      if (e) dgView.sel = { kind: 'edge', id: e.id };
    } else {
      dgView.sel = { kind: 'node', id: drag.from };
    }
    dgRender();
  }
}
document.addEventListener('pointerup', dgEndDrag);
document.addEventListener('pointercancel', dgEndDrag);

document.addEventListener('click', (ev) => {
  const add = ev.target.closest('[data-dg-add]');
  if (add) {
    const n = dgMutate(() => dgAdd(add.dataset.dgAdd));
    dgView.sel = { kind: 'node', id: n.id }; dgView.customOpen = false;
    return dgRender();
  }
  const b = ev.target.closest('[data-dg-act]');
  if (!b) return;
  const act = b.dataset.dgAct, d = state.diagram, sel = dgView.sel;
  const node = sel?.kind === 'node' ? dgFind(sel.id) : null;
  const edge = sel?.kind === 'edge' ? d.edges.find((e) => e.id === sel.id) : null;
  switch (act) {
    case 'mode':
      state.draft = $('#post-content')?.value ?? state.draft;
      state.dgMode = b.dataset.mode; dgView.sel = null; dgView.connectFrom = null;
      return render();
    case 'starter': {
      const narrow = dgView.w < 560;
      const pos = narrow
        ? [{ x: 16, y: 40 }, { x: dgSnap((dgView.w - DG.MIN_W) / 2), y: 160 }, { x: dgView.w - DG.MIN_W - 20, y: 280 }]
        : (() => { const gap = Math.min(240, (dgView.w - 32 - DG.MIN_W) / 2); const y = dgSnap(dgView.h / 2 - DG.NODE_H / 2); return [0, 1, 2].map((i) => ({ x: dgSnap(16 + gap * i), y })); })();
      dgMutate(() => {
        const a = dgAdd('client', pos[0]);
        const s = dgAdd('api', pos[1]);
        const db = dgAdd('sql', pos[2]);
        dgConnect(a.id, s.id); dgConnect(s.id, db.id);
      });
      dgView.sel = null;
      return dgRender();
    }
    case 'dup': if (node) dgMutate(() => { node.dup = !node.dup; }); return dgRender();
    case 'connect': if (node) { dgView.connectFrom = node.id; } return dgRender();
    case 'cancel-connect': dgView.connectFrom = null; return dgRender();
    case 'sync': if (edge) dgMutate(() => { edge.async = false; }); return dgRender();
    case 'async': if (edge) dgMutate(() => { edge.async = true; }); return dgRender();
    case 'flip': if (edge) dgMutate(() => { [edge.from, edge.to] = [edge.to, edge.from]; }); return dgRender();
    case 'del': return dgDeleteSelected();
    case 'clear':
      if (!confirmed(b)) return;
      dgMutate(() => { state.diagram = dgNew(); });
      dgView.sel = null;
      return dgRender();
    case 'undo': return dgUndo();
    case 'redo': return dgRedo();
    case 'custom-open':
      dgView.customOpen = true; dgView.sel = null; dgView.connectFrom = null;
      dgRender(); $('#dg-custom-name')?.focus();
      return;
    case 'custom-kind':
      dgView.customName = $('#dg-custom-name')?.value ?? dgView.customName;
      dgView.customKind = b.dataset.kind;
      dgRenderBar(); $('#dg-custom-name')?.focus();
      return;
    case 'custom-add': return dgAddCustom();
    case 'custom-cancel': dgView.customOpen = false; dgView.customName = ''; return dgRenderBar();
  }
});

// 이름을 바꾸는 동안은 글자마다가 아니라 한 번의 편집을 되돌리기 한 단계로 남긴다
function dgRecordTyping(key) {
  if (dgView.typing === key) return;
  dgView.typing = key;
  dgRecord();
  dgRenderHistory();
}

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'dg-name') {
    const n = dgView.sel && dgFind(dgView.sel.id);
    if (n) { dgRecordTyping('n:' + n.id); n.label = ev.target.value.trim() || dgNodeType(n).name; dgRenderSvg(); }
  }
  if (ev.target.id === 'dg-elabel') {
    const e = dgView.sel && state.diagram.edges.find((x) => x.id === dgView.sel.id);
    if (e) { dgRecordTyping('e:' + e.id); e.label = ev.target.value.trim(); dgRenderSvg(); }
  }
  if (ev.target.id === 'dg-custom-name') dgView.customName = ev.target.value;
});

document.addEventListener('keydown', (ev) => {
  if (!$('#dg-svg')) return;
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';
  // 글을 쓰는 중이 아니면 Ctrl/Cmd+Z 는 그림 되돌리기, Ctrl/Cmd+Shift+Z 와 Ctrl+Y 는 다시 하기
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !typing) {
    const k = ev.key.toLowerCase();
    if (k === 'z') { ev.preventDefault(); return ev.shiftKey ? dgRedo() : dgUndo(); }
    if (k === 'y') { ev.preventDefault(); return dgRedo(); }
  }
  if (ev.key === 'Escape' && (dgView.connectFrom || dgView.sel || dgView.customOpen)) {
    // 연결 중이거나 선택된 게 있으면 작성 창을 닫지 않고 그것만 푼다
    ev.stopPropagation(); dgView.connectFrom = null; dgView.sel = null; dgView.customOpen = false; dgRender(); return;
  }
  if (typing) {
    if (ev.key === 'Enter' && ev.target.id === 'dg-custom-name' && !ev.isComposing) { ev.preventDefault(); dgAddCustom(); }
    else if (ev.key === 'Enter' && (ev.target.id === 'dg-name' || ev.target.id === 'dg-elabel')) { ev.preventDefault(); ev.target.blur(); }
    return;
  }
  if (!dgView.sel) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); dgDeleteSelected(); }
}, true);

/* ---------- PNG로 내보내기 ---------- */
function dgExportSvg(d) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of d.nodes) {
    x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y - 8);
    x1 = Math.max(x1, n.x + dgNodeW(n) + (n.dup ? 8 : 0)); y1 = Math.max(y1, n.y + DG.NODE_H + (n.dup ? 8 : 0));
  }
  for (const e of d.edges) {
    const g = dgEdgeGeom(e, d);
    if (g && e.label) { const lw = dgTextWidth(e.label, 12) / 2 + 10; x0 = Math.min(x0, g.mx - lw); x1 = Math.max(x1, g.mx + lw); }
  }
  const pad = 28;
  const legend = d.edges.some((e) => e.async) || d.nodes.some((n) => n.dup);
  const w = Math.ceil(x1 - x0 + pad * 2), h = Math.ceil(y1 - y0 + pad * 2 + (legend ? 30 : 0));
  let lg = '';
  if (legend) {
    const ly = h - 22;
    lg = `<g font-size="12" fill="${DG.MUTED}">
      <line x1="${pad}" y1="${ly}" x2="${pad + 24}" y2="${ly}" stroke="#4e5968" stroke-width="1.8"/><text x="${pad + 30}" y="${ly + 4}">동기</text>
      <line x1="${pad + 72}" y1="${ly}" x2="${pad + 96}" y2="${ly}" stroke="#4e5968" stroke-width="1.8" stroke-dasharray="7 5"/><text x="${pad + 102}" y="${ly + 4}">비동기</text>
      <text x="${pad + 156}" y="${ly + 4}">×2 = 2중화</text></g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family='${DG_FONT}'>
    ${dgDefs()}<rect width="${w}" height="${h}" fill="#ffffff"/>
    <g transform="translate(${pad - x0} ${pad - y0})">${dgSvgBody(d, { forExport: true })}</g>${lg}</svg>`;
  return { svg, w, h };
}

async function dgExportPng() {
  const d = state.diagram;
  if (!d.nodes.length) return null;
  const { svg, w, h } = dgExportSvg(d);
  const scale = Math.min(2, 1600 / Math.max(w, h));
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new File([blob], 'diagram.png', { type: 'image/png' });
}

state.diagram = dgNew();

// 서버에서 온 AI 그림을 캔버스 형식으로 다시 맞춘다 (id·좌표·종류를 믿지 않고 새로 만든다)
const aiSvgCache = new WeakMap();
function aiDiagramUrl(raw) {
  if (aiSvgCache.has(raw)) return aiSvgCache.get(raw);
  let url = null;
  const ids = new Map();
  const nodes = (Array.isArray(raw?.nodes) ? raw.nodes : []).slice(0, 20).map((n, i) => {
    ids.set(n.id, 'n' + i);
    const x = { id: 'n' + i, type: DG_TYPES.some((t) => t.type === n.type) ? n.type : 'custom', label: String(n.label ?? '').slice(0, 30), x: Number(n.x) || 0, y: Number(n.y) || 0, dup: !!n.dup };
    if (x.type === 'custom') x.kind = DG_KIND[n.kind] ? n.kind : 'compute';
    return x;
  });
  const edges = (Array.isArray(raw?.edges) ? raw.edges : []).slice(0, 30)
    .map((e, i) => ({ id: 'e' + i, from: ids.get(e.from), to: ids.get(e.to), async: !!e.async, label: String(e.label ?? '').slice(0, 30) }))
    .filter((e) => e.from && e.to);
  if (nodes.length) url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dgExportSvg({ nodes, edges }).svg);
  if (raw && typeof raw === 'object') aiSvgCache.set(raw, url);
  return url;
}

/* ---------- posts ---------- */
function contentHtml(text) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', lines: para }); para = []; } };
  for (const line of text.split('\n')) {
    if (/^#{1,3}\s+/.test(line)) { flush(); blocks.push({ type: 'h', text: line.replace(/^#{1,3}\s+/, '') }); }
    else if (!line.trim()) flush();
    else para.push(line);
  }
  flush();
  return blocks
    .filter((b, i) => b.type !== 'h' || (blocks[i + 1] && blocks[i + 1].type === 'p'))
    .map((b) => (b.type === 'h' ? `<h4>${esc(b.text)}</h4>` : `<p>${b.lines.map(esc).join('<br>')}</p>`))
    .join('');
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.8 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.7 1.3-1.6 2.7-2.7 4.7-2.7 3.5 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" fill="currentColor"/></svg>';
const HEART_O = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.8 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.7 1.3-1.6 2.7-2.7 4.7-2.7 3.5 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

function sortedPosts() {
  const list = [...state.posts];
  if (state.sort === 'top') list.sort((a, b) => b.like_count - a.like_count || b.comment_count - a.comment_count || a.created_at.localeCompare(b.created_at));
  return list;
}

function likeBtn(p) {
  return `<button class="react ${p.liked ? 'liked' : ''}" type="button" data-act="like" data-id="${p.id}" aria-pressed="${p.liked}" aria-label="좋아요 ${p.like_count}개">${p.liked ? HEART : HEART_O}<span class="n">${p.like_count}</span></button>`;
}

// 답글 맨 앞의 @닉네임 은 강조해서 보여준다
const commentText = (s) => esc(s).replace(/^@(\S+)/, '<span class="mention">@$1</span>');

// 댓글 입력 칸: Enter 는 줄바꿈, Ctrl/Cmd+Enter 로 등록. 쓰던 내용은 다시 그려도 남는다.
const SUBMIT_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
function commentFormHtml({ id, postId, parentId = null, placeholder, label, initial = '' }) {
  const value = state.commentDrafts[id] ?? initial;
  return `
    <form class="c-form ${parentId ? 'reply-form' : ''}" data-post="${postId}"${parentId ? ` data-parent="${parentId}"` : ''}>
      <div class="c-box">
        <textarea id="${id}" name="c" rows="1" maxlength="1000" placeholder="${esc(placeholder)}" aria-label="${label}" data-c-input>${esc(value)}</textarea>
        <div class="c-actions">
          <span class="c-hint">Enter 줄바꿈 · ${SUBMIT_KEY}+Enter 등록</span>
          <span class="c-count mono" ${value.length < 800 ? 'hidden' : ''}>${value.length}/1000</span>
          ${parentId ? '<button class="btn small ghost" type="button" data-act="cancel-reply">취소</button>' : ''}
          <button class="btn small" type="submit">등록</button>
        </div>
      </div>
    </form>`;
}
// 내용에 맞춰 높이를 늘린다 (최대 높이를 넘으면 스크롤)
function fitTextarea(el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }

function commentHtml(p, c, rootId) {
  const reply = c.id !== rootId;
  const canDelete = state.me && (state.me.id === c.user_id || state.me.isAdmin);
  return `
      <div class="comment ${reply ? 'reply' : ''}">
        <span class="avatar" aria-hidden="true">${initial(c.author.nickname)}</span>
        <div class="c-body"><b>${esc(c.author.nickname)}</b><time datetime="${c.created_at}">${ago(c.created_at)}</time>${
          canDelete ? `<button class="del" type="button" data-act="del-comment" data-id="${c.id}" data-post="${p.id}">삭제</button>` : ''
        }<p>${commentText(c.content)}</p>
        <button class="c-reply" type="button" data-act="reply" data-post="${p.id}" data-root="${rootId}" data-nick="${reply ? esc(c.author.nickname) : ''}">답글</button></div>
      </div>`;
}

function commentsHtml(p) {
  if (!state.openComments.has(p.id)) return '';
  const list = state.comments[p.id];
  let body;
  if (!list) body = '<p class="c-empty">불러오는 중…</p>';
  else if (!list.length) body = '<p class="c-empty">아직 댓글이 없어요. 궁금한 점이나 다른 관점을 남겨보세요.</p>';
  else {
    // 답글은 한 단계까지만: 최상위 댓글 아래에 시간순으로 모은다
    const ids = new Set(list.map((c) => c.id));
    const roots = list.filter((c) => !c.parent_id || !ids.has(c.parent_id));
    const r = state.replyTo;
    body = roots.map((root) => {
      const replies = list.filter((c) => c.parent_id === root.id);
      const open = r && r.postId === p.id && r.rootId === root.id;
      const form = open ? commentFormHtml({
        id: `r-input-${root.id}`, postId: p.id, parentId: root.id, label: '답글',
        placeholder: `${root.author.nickname}님에게 답글 남기기`, initial: r.nick ? `@${r.nick} ` : '',
      }) : '';
      return `<div class="thread">${commentHtml(p, root, root.id)}${replies.length || open ? `<div class="replies">${replies.map((c) => commentHtml(p, c, root.id)).join('')}${form}</div>` : ''}</div>`;
    }).join('');
  }
  const form = commentFormHtml({ id: `c-input-${p.id}`, postId: p.id, label: '댓글', placeholder: '댓글 남기기' });
  return `<div class="comments">${body}${form}</div>`;
}

// 그림 자리: 직접 올린 그림 > AI 가 그린 그림 > 그리는 중 표시
function postFigHtml(p) {
  if (p.image_url) return `<div class="post-fig"><button class="post-img" type="button" data-act="zoom" data-src="${esc(p.image_url)}" aria-label="다이어그램 크게 보기"><img src="${esc(p.image_url)}" alt="${esc(p.author.nickname)}님의 설계 다이어그램" loading="lazy"></button></div>`;
  const ai = p.ai_diagram && aiDiagramUrl(p.ai_diagram);
  if (ai) {
    return `<div class="post-fig"><button class="post-img" type="button" data-act="zoom" data-src="${esc(ai)}" aria-label="AI가 그린 다이어그램 크게 보기"><img src="${esc(ai)}" alt="AI가 글을 보고 그린 설계 다이어그램"></button>
      <p class="ai-fig-note"><span class="chip ai">AI</span>글을 읽고 AI가 그린 그림이에요. 실제 설계와 다를 수 있어요.</p></div>`;
  }
  if (isDrawing(p)) return `<div class="post-fig"><div class="ai-fig-wait" role="status"><span class="spinner" aria-hidden="true"></span>AI가 글을 읽고 아키텍처를 그리고 있어요</div></div>`;
  return '<div class="post-fig"></div>';
}

// AI 점수 배지와 펼친 세부 점수. rerenderPost 가 바꿔 끼울 수 있게 비어 있어도 자리는 남긴다.
function postScoreHtml(p) {
  if (p.ai_score != null) {
    return `<button class="post-score" type="button" data-act="toggle-score" data-id="${p.id}" aria-expanded="${state.openScores.has(p.id)}" aria-label="AI 점수 ${p.ai_score}점, 세부 점수 보기">AI <b class="mono">${p.ai_score}</b>점</button>`;
  }
  if (aiScore.busy(p)) return '<span class="post-score wait" role="status"><span class="spinner" aria-hidden="true"></span>AI 채점 중</span>';
  return '<span class="post-score" hidden></span>';
}
function scoreDetailHtml(p) {
  const x = p.ai_review;
  if (!x || p.ai_score == null || !state.openScores.has(p.id)) return '<div class="score-detail" hidden></div>';
  return `<div class="score-detail">
    <p class="score-sum">${esc(x.summary || '')}</p>
    <div class="ai-criteria">${(x.criteria || []).map((c) => `
      <div class="ai-crit">
        <div class="ai-crit-head"><span>${esc(c.name)}</span><b class="mono">${Number(c.score) || 0}<small>/10</small></b></div>
        <div class="ai-bar" aria-hidden="true"><i style="width:${(Number(c.score) || 0) * 10}%"></i></div>
        <p>${esc(c.comment || '')}</p>
      </div>`).join('')}</div>
    <p class="ai-fig-note"><span class="chip ai">AI</span>AI가 매긴 참고용 점수예요. 정답은 하나가 아니에요.</p>
  </div>`;
}

function postHtml(p, rank) {
  const mine = state.me && state.me.id === p.user_id && !p.is_sample;
  const canDelete = state.me && (mine || state.me.isAdmin);
  const long = p.content.length > 520 && !state.expanded.has(p.id);
  return `
  <article class="post ${mine ? 'is-mine' : ''}" id="post-${p.id}">
    <div class="post-head">
      <span class="avatar" aria-hidden="true">${p.is_sample ? '하' : initial(p.author.nickname)}</span>
      <div class="meta"><b>${p.is_sample ? '하루설계 운영진 <span class="chip sample">예시 답안</span>' : esc(p.author.nickname) + (mine ? ' (나)' : '')}</b><span>${ago(p.created_at)}</span></div>
      <div class="tools">
        ${state.sort === 'top' && rank <= 3 && p.like_count > 0 ? `<span class="rank">#${rank}</span>` : ''}
        ${postScoreHtml(p)}
        ${canDelete ? `<button class="btn ghost small danger" type="button" data-act="del-post" data-id="${p.id}">삭제</button>` : ''}
      </div>
    </div>
    ${scoreDetailHtml(p)}
    ${postFigHtml(p)}
    <div class="post-body ${long ? 'clamped' : ''}">${contentHtml(p.content)}</div>
    ${long ? `<button class="more" type="button" data-act="expand" data-id="${p.id}">더 보기</button>` : ''}
    <div class="post-foot">
      ${likeBtn(p)}
      <button class="react" type="button" data-act="toggle-comments" data-id="${p.id}" aria-expanded="${state.openComments.has(p.id)}">${BUBBLE}<span>댓글</span><span class="n">${p.comment_count}</span></button>
    </div>
    ${commentsHtml(p)}
  </article>`;
}

function answersHtml() {
  const list = sortedPosts();
  return `
  <section aria-labelledby="answers-title" style="display:grid;gap:14px">
    <div class="answers-head">
      <h2 id="answers-title">다른 사람들의 설계 <span class="mono" style="color:var(--faint);font-weight:400">${list.length}</span></h2>
      <div class="seg" role="group" aria-label="정렬">
        <button type="button" data-sort="top" aria-pressed="${state.sort === 'top'}">인기순</button>
        <button type="button" data-sort="new" aria-pressed="${state.sort === 'new'}">최신순</button>
      </div>
    </div>
    ${list.length
      ? `<div class="posts">${list.map((p, i) => postHtml(p, i + 1)).join('')}</div>`
      : `<div class="panel empty"><h2>아직 올라온 설계가 없어요</h2><p>첫 번째로 올리면 다른 사람들이 가장 먼저 보게 돼요.</p></div>`}
  </section>`;
}

/* ---------- views ---------- */
function viewTopic(isToday) {
  const topic = currentTopic();
  if (!topic) {
    return `<section class="panel empty"><h2>오늘 공개된 문제가 아직 없어요</h2><p>${state.me?.isAdmin ? '관리자 페이지에서 오늘 날짜로 문제를 등록해 주세요.' : '지난 문제를 먼저 풀어보세요.'}</p>
      <button class="btn primary" type="button" data-nav="${state.me?.isAdmin ? 'admin' : 'archive'}">${state.me?.isAdmin ? '문제 등록하기' : '지난 문제 보기'}</button></section>`;
  }
  return sheetHtml(topic, { isToday }) + answersHtml() + composerHtml(topic);
}

function viewArchive() {
  const list = publishedTopics();
  return `
  <div><h1 class="page-title">지난 문제</h1><p class="page-sub">예전 문제도 지금 풀어볼 수 있어요. 다른 사람들의 답을 비교해 보세요.</p></div>
  ${list.length ? `<div class="list">${list.map((t) => `
    <button class="row" type="button" data-topic="${t.id}">
      <span class="date">${fmtDate(t.publish_date)} (${weekday(t.publish_date)})</span>
      <span class="title">${esc(t.title)}</span>
      <span class="n">설계 ${t.post_count}개</span>
    </button>`).join('')}</div>` : `<div class="panel empty"><h2>아직 문제가 없어요</h2></div>`}`;
}

function nextFreeDate() {
  const taken = new Set(state.topics.map((t) => t.publish_date));
  let d = kstDate();
  while (taken.has(d)) d = addDays(d, 1);
  return d;
}

/* ---------- 관리자 지표 ---------- */
const ENDPOINTS = {
  'view /today': ['GET', '오늘의 문제'],
  'view /archive': ['GET', '지난 문제'],
  'view /topic': ['GET', '문제 상세'],
  'view /admin': ['GET', '관리자 로그인'],
  'post_create ': ['POST', '설계 올리기'],
  'comment_create comment': ['POST', '댓글'],
  'comment_create reply': ['POST', '답글'],
  'like on': ['POST', '좋아요'],
  'like off': ['DELETE', '좋아요 취소'],
  'ai_review ': ['POST', '/api/review · AI 평가'],
  'subscribe ': ['POST', '이메일 구독'],
};
const fmtNum = (n) => Number(n || 0).toLocaleString('ko-KR');
const fmtSec = (ms) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)}초`);
// 축 눈금이 깔끔하게 떨어지도록 최댓값을 1·2·5 단위로 올린다
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= v);
}

// 지표 영역만 다시 그린다 (아래 문제 등록 폼에 입력 중인 내용이 지워지지 않게)
function renderMetrics() {
  const el = $('.metrics');
  if (el) el.outerHTML = metricsHtml();
}

async function loadMetrics(days = state.metrics?.days || 14) {
  state.metrics = { ...(state.metrics || {}), days, loading: true, error: null };
  renderMetrics();
  try { state.metrics = { days, data: await api.adminMetrics(days) }; }
  catch (e) {
    const m = (e && e.message) || '';
    state.metrics = { days, error: /admin_metrics|function|schema cache/i.test(m)
      ? '지표용 DB 설정이 아직 없어요. supabase/2026-10-25-admin-metrics.sql 을 SQL Editor 에서 실행해 주세요.'
      : friendlyError(e) };
  }
  renderMetrics();
}

function statTile(label, value, sub) {
  return `<div class="tile"><span class="tile-label">${label}</span><b class="tile-value mono">${value}</b>${sub ? `<span class="tile-sub">${sub}</span>` : ''}</div>`;
}

function dailyChartHtml(daily) {
  const max = niceMax(Math.max(...daily.map((x) => x.visitors)));
  const step = Math.ceil(daily.length / 7);
  const label = (d) => `${d.slice(5).replace('-', '.')} (${weekday(d)})`;
  return `
  <div class="chart" role="img" aria-label="최근 ${daily.length}일 일별 방문자 수">
    <div class="chart-y mono" aria-hidden="true"><span>${fmtNum(max)}</span><span>${fmtNum(max / 2)}</span><span>0</span></div>
    <div class="chart-plot">
      <i class="grid" style="top:0"></i><i class="grid" style="top:50%"></i><i class="grid base" style="top:100%"></i>
      ${daily.map((d) => `
        <div class="col" tabindex="0" data-tip="${label(d.day)}|방문자 ${fmtNum(d.visitors)}명|페이지뷰 ${fmtNum(d.views)}회">
          <i style="height:${(d.visitors / max) * 100}%"></i>
        </div>`).join('')}
      <div class="chart-tip" hidden></div>
    </div>
    <div class="chart-x mono" aria-hidden="true">${daily.map((d, i) => `<span>${(daily.length - 1 - i) % step === 0 ? d.day.slice(5).replace('-', '.') : ''}</span>`).join('')}</div>
  </div>
  <details class="chart-table"><summary>표로 보기</summary>
    <table><thead><tr><th>날짜</th><th>방문자</th><th>페이지뷰</th></tr></thead>
    <tbody>${[...daily].reverse().map((d) => `<tr><td>${label(d.day)}</td><td class="mono">${fmtNum(d.visitors)}</td><td class="mono">${fmtNum(d.views)}</td></tr>`).join('')}</tbody></table>
  </details>`;
}

function endpointsHtml(endpoints, days) {
  if (!endpoints.length) return '<p class="hint">아직 기록된 요청이 없어요.</p>';
  const max = Math.max(...endpoints.map((e) => e.count));
  return `
  <table class="ep-table">
    <thead><tr><th>요청</th><th>오늘</th><th>${days}일</th><th>실패</th><th>평균 응답</th></tr></thead>
    <tbody>${endpoints.map((e) => {
      // 스폰서 클릭은 path 에 스폰서 id 가 들어 있어서 제목으로 바꿔 보여준다
      const [method, name] = endpointLabel(e.type, e.path);
      return `<tr>
        <td><span class="method">${method}</span>${esc(name)}</td>
        <td class="mono">${fmtNum(e.today)}</td>
        <td><div class="ep-count"><span class="ep-bar" aria-hidden="true"><i style="width:${(e.count / max) * 100}%"></i></span><span class="mono">${fmtNum(e.count)}</span></div></td>
        <td class="mono">${e.errors ? `<span class="ep-err">⚠ ${fmtNum(e.errors)}</span>` : '0'}</td>
        <td class="mono">${fmtSec(e.avg_ms)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function metricsHtml() {
  const m = state.metrics || { days: 14, loading: true };
  const seg = `<div class="seg" role="group" aria-label="기간">${[7, 14, 30].map((d) => `<button type="button" data-act="metrics-days" data-days="${d}" aria-pressed="${m.days === d}">${d}일</button>`).join('')}</div>`;
  const head = `<div class="metrics-head"><h2>운영 지표</h2>${seg}<button class="btn ghost small" type="button" data-act="metrics-refresh" ${m.loading ? 'disabled' : ''}>${m.loading ? '불러오는 중…' : '새로고침'}</button></div>`;
  if (m.error) return `<section class="panel metrics">${head}<p class="err" role="alert">${esc(m.error)}</p></section>`;
  if (!m.data) return `<section class="panel metrics">${head}<p class="loading">불러오는 중…</p></section>`;
  const d = m.data;
  const today = d.daily[d.daily.length - 1] || { visitors: 0, views: 0 };
  const yesterday = d.daily[d.daily.length - 2];
  const ai = d.endpoints.find((e) => e.type === 'ai_review') || { count: 0, today: 0, errors: 0, avg_ms: null };
  return `
  <section class="panel metrics ${m.loading ? 'is-loading' : ''}">
    ${head}
    <div class="tiles">
      ${statTile('오늘 방문자', fmtNum(today.visitors), yesterday ? `어제 ${fmtNum(yesterday.visitors)}명` : '')}
      ${statTile('오늘 페이지뷰', fmtNum(today.views), yesterday ? `어제 ${fmtNum(yesterday.views)}회` : '')}
      ${statTile(`${d.days}일 방문자`, fmtNum(d.range.visitors), `페이지뷰 ${fmtNum(d.range.views)}회`)}
      ${statTile(`${d.days}일 AI 평가`, fmtNum(ai.count), `실패 ${fmtNum(ai.errors)}건 · 평균 ${fmtSec(ai.avg_ms)}`)}
    </div>
    <h3>일별 방문자</h3>
    ${dailyChartHtml(d.daily)}
    <h3>요청별 횟수</h3>
    ${endpointsHtml(d.endpoints, d.days)}
    <p class="metrics-note">방문자는 브라우저 기준이에요. 관리자 본인의 사용은 빠져 있고, 날짜는 한국 시간 기준이에요.</p>
  </section>`;
}

/* ---------- 스폰서 칸 ---------- */
// 넓은 화면에서는 본문 오른쪽에 붙어 따라오고, 좁은 화면에서는 본문 아래에 놓인다.
// 켜진 광고를 관리자가 정한 순서대로 모두 보여주고, 하나도 없으면 광고 문의 안내를 띄운다.
const CONTACT_EMAIL = 'hazardous10@naver.com';
const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('하루설계 스폰서 문의')}`;
const safeLink = (url) => (/^https?:\/\//i.test(url || '') ? url : '#');
// 이미지 비율: 원본 비율이 기본이라 잘리지 않는다. 비율을 고르면 꽉 채우기(보일 위치 선택) 또는 전체 보이기.
const SP_RATIOS = [['auto', '원본 비율'], ['1.91', '가로형'], ['4/3', '4:3'], ['1', '정사각']];
const SP_FITS = [['cover', '꽉 채우기'], ['contain', '전체 보이기']];
function spStyle(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pct = (v) => Math.max(0, Math.min(100, Math.round(Number(v ?? 50)))) || 0;
  return {
    ratio: SP_RATIOS.some(([k]) => k === r.ratio) ? r.ratio : 'auto',
    fit: r.fit === 'contain' ? 'contain' : 'cover',
    x: pct(r.x), y: pct(r.y),
  };
}
function spImgStyle(raw) {
  const st = spStyle(raw);
  if (st.ratio === 'auto') return '';
  return `aspect-ratio:${st.ratio};object-fit:${st.fit};object-position:${st.x}% ${st.y}%`;
}
const bySponsorOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || b.created_at.localeCompare(a.created_at);
async function refreshSponsors() {
  try { state.sponsors = (await api.listSponsors()).sort(bySponsorOrder); } catch { state.sponsors = []; }
}
function sponsorCardHtml(s, { preview = false } = {}) {
  if (!s) {
    return `<div class="sponsor house"><span class="sponsor-label">스폰서</span>
      <strong>이 자리에 광고를 걸어보세요</strong><p>매일 설계 문제를 푸는 개발자들에게 보여요.</p>
      <a class="btn small" href="${CONTACT_HREF}">광고 문의</a></div>`;
  }
  const st = spStyle(s.image_style);
  return `<a class="sponsor" href="${esc(safeLink(s.link_url))}" target="_blank" rel="sponsored noopener" ${preview ? 'tabindex="-1"' : `data-act="sponsor-click" data-id="${s.id}"`}>
    <span class="sponsor-label">스폰서</span>
    ${s.image_url ? `<img class="${st.ratio === 'auto' ? 'natural' : st.fit}" src="${esc(s.image_url)}" alt="" loading="lazy" style="${spImgStyle(st)}">` : ''}
    <strong>${esc(s.title)}</strong>${s.body ? `<p>${esc(s.body)}</p>` : ''}
    <span class="sponsor-link">${esc((s.link_url || '').replace(/^https?:\/\/(www\.)?/i, '').split('/')[0])} ↗</span></a>`;
}
function renderRail() {
  const rail = $('#rail');
  if (!rail) return;
  const show = state.view !== 'admin' && !state.composing;
  rail.hidden = !show;
  const live = state.sponsors.filter((s) => s.active);
  rail.innerHTML = !show ? ''
    : live.length ? `${live.map((s) => sponsorCardHtml(s)).join('')}<a class="sponsor-ask" href="${CONTACT_HREF}">광고 문의</a>`
    : sponsorCardHtml(null);
}

/* ---------- 관리자: 스폰서 ---------- */
// 수정 중인 광고는 state.editingSponsor 에 두고, 글자 입력은 미리 보기만 다시 그린다
const spBlank = () => ({ id: null, title: '', body: '', link_url: 'https://', active: true, image_url: null, image_style: spStyle(null) });
const spEditing = () => state.editingSponsor || (state.editingSponsor = spBlank());
const spImage = (e) => (state.sponsorFile ? state.sponsorFile.url : e.removeImage ? null : e.image_url);
function spReadForm() {
  const e = spEditing();
  if ($('#sp-title')) Object.assign(e, { title: $('#sp-title').value, body: $('#sp-body').value, link_url: $('#sp-link').value, active: $('#sp-active').checked });
  return e;
}
function spImageCtrlHtml() {
  const e = spEditing(), img = spImage(e), st = spStyle(e.image_style);
  const seg = (name, items, cur) => `<div class="seg" role="group">${items.map(([k, label]) => `<button type="button" data-act="sp-style" data-k="${name}" data-v="${k}" aria-pressed="${cur === k}">${label}</button>`).join('')}</div>`;
  return `<div class="sp-image-ctrl">
    <div class="sp-image-row">
      <label class="btn small" for="sp-image">${img ? '이미지 바꾸기' : '이미지 고르기'}</label>
      <input type="file" id="sp-image" accept="image/*" hidden>
      ${img ? '<button class="btn ghost small danger" type="button" data-act="sponsor-remove-image">이미지 빼기</button>' : ''}
    </div>
    ${img ? `
      <div class="sp-opt"><span>비율</span>${seg('ratio', SP_RATIOS, st.ratio)}</div>
      <div class="sp-opt ${st.ratio === 'auto' ? 'is-idle' : ''}"><span>맞춤</span>${seg('fit', SP_FITS, st.ratio === 'auto' ? '' : st.fit)}</div>
      <div class="sp-opt sp-focus-opt ${st.ratio === 'auto' || st.fit === 'contain' ? 'is-idle' : ''}"><span>보일 위치</span>
        <div class="sp-focus" id="sp-focus" title="보이게 할 부분을 누르거나 끌어 주세요"><img src="${esc(img)}" alt="" draggable="false"><i style="left:${st.x}%;top:${st.y}%"></i></div>
        <small>${st.ratio === 'auto' ? '지금은 원본 비율이라 잘리지 않아요. 위치를 누르면 가로형으로 바꾸고 그 부분이 보이게 잘라요.'
          : st.fit === 'contain' ? '지금은 전체 보이기라 잘리지 않고 남는 곳은 여백이에요. 위치를 누르면 꽉 채우기로 바꿔요.'
          : '사진에서 꼭 보여야 할 부분을 누르거나 끌어 주세요.'}</small></div>` : ''}
  </div>`;
}
function sponsorsAdminHtml() {
  const e = spEditing();
  return `
  <section class="panel sponsors-admin">
    <h2>스폰서 광고</h2>
    <p class="hint">켜 둔 광고가 아래 순서대로 모두 보여요. 켜진 광고가 없으면 광고 문의 안내가 떠요.</p>
    <div class="sponsor-edit">
      <form class="form-grid" id="sponsor-form">
        <div class="field"><label for="sp-title">제목</label><input type="text" id="sp-title" required maxlength="60" placeholder="예: 시스템 설계 면접 스터디 모집" value="${esc(e.title)}"></div>
        <div class="field"><label for="sp-body">설명 <span class="sub">선택, 200자까지</span></label><textarea id="sp-body" maxlength="200" placeholder="한두 줄로 짧게">${esc(e.body || '')}</textarea></div>
        <div class="field"><label for="sp-link">링크</label><input type="text" id="sp-link" required maxlength="500" inputmode="url" placeholder="https://" value="${esc(e.link_url)}"></div>
        <div class="field"><label>이미지 <span class="sub">선택</span></label>${spImageCtrlHtml()}</div>
        <label class="sp-active"><input type="checkbox" id="sp-active" ${e.active ? 'checked' : ''}> 바로 보이기</label>
        <div class="actions">
          ${e.id ? '<button class="btn ghost" type="button" data-act="sponsor-cancel">취소</button>' : ''}
          <button class="btn primary" type="submit">${e.id ? '수정 저장' : '광고 등록'}</button>
        </div>
      </form>
      <div class="sponsor-preview">${sponsorPreviewHtml()}</div>
    </div>
    ${sponsorRowsHtml()}
  </section>`;
}
function sponsorPreviewHtml() {
  const e = spEditing();
  return `<span class="sub">미리 보기 · 실제 칸 너비(240px)</span>${sponsorCardHtml({ ...e, title: e.title || '제목', image_url: spImage(e) }, { preview: true })}`;
}
function sponsorRowsHtml() {
  const rows = state.sponsors;
  return `<div class="sponsor-rows-wrap">${rows.length ? `<div class="list sponsor-rows">${rows.map((s, i) => `
      <div class="row admin-row sponsor-row">
        <span class="sp-order">
          <button class="btn ghost small" type="button" data-act="sponsor-move" data-id="${s.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="위로">↑</button>
          <button class="btn ghost small" type="button" data-act="sponsor-move" data-id="${s.id}" data-dir="1" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="아래로">↓</button>
        </span>
        <span class="title">${s.active ? '<span class="chip">보이는 중</span>' : '<span class="chip past">꺼짐</span>'} ${esc(s.title)}<small>${esc(s.link_url)}</small></span>
        <span class="ops">
          <button class="btn small" type="button" data-act="sponsor-toggle" data-id="${s.id}">${s.active ? '끄기' : '켜기'}</button>
          <button class="btn small" type="button" data-act="sponsor-edit" data-id="${s.id}">수정</button>
          <button class="btn small danger" type="button" data-act="sponsor-del" data-id="${s.id}">삭제</button>
        </span>
      </div>`).join('')}</div>` : ''}</div>`;
}
// 입력 중인 글자를 지키려고 이미지 조절 칸과 미리 보기만 다시 그린다
function renderSponsorPreview() {
  spReadForm();
  const box = $('.sponsor-preview');
  if (box) box.innerHTML = sponsorPreviewHtml();
}
function renderSponsorImageCtrl() {
  const c = $('.sp-image-ctrl');
  if (c) c.outerHTML = spImageCtrlHtml();
  renderSponsorPreview();
}
function resetSponsorForm() {
  if (state.sponsorFile) URL.revokeObjectURL(state.sponsorFile.url);
  state.sponsorFile = null; state.editingSponsor = null;
}
// 보일 위치: 원본 썸네일에서 누른 곳을 object-position 으로 쓴다
const spFocus = { dragging: false };
function spSetFocus(ev) {
  const box = $('#sp-focus img');
  if (!box) return;
  const r = box.getBoundingClientRect();
  const e = spEditing();
  e.image_style = { ...spStyle(e.image_style), x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 };
  const st = spStyle(e.image_style);
  e.image_style = st;
  const dot = $('#sp-focus i');
  if (dot) { dot.style.left = `${st.x}%`; dot.style.top = `${st.y}%`; }
  const img = $('.sponsor-preview .sponsor img');
  if (img) img.style.objectPosition = `${st.x}% ${st.y}%`;
}
document.addEventListener('pointerdown', (ev) => {
  if (!ev.target.closest('#sp-focus')) return;
  ev.preventDefault();
  spFocus.dragging = true;
  // 잘리지 않는 상태에서 위치를 고르면 자르는 모드(가로형 · 꽉 채우기)로 바꾼 뒤 위치를 정한다
  const e = spEditing(), st = spStyle(e.image_style);
  if (st.ratio === 'auto' || st.fit === 'contain') {
    e.image_style = { ...st, ratio: st.ratio === 'auto' ? '1.91' : st.ratio, fit: 'cover' };
    renderSponsorImageCtrl();
  }
  spSetFocus(ev);
});
document.addEventListener('pointermove', (ev) => { if (spFocus.dragging) spSetFocus(ev); });
document.addEventListener('pointerup', () => { spFocus.dragging = false; });

/* ---------- 관리자: 이메일 구독자 ---------- */
function renderSubscribers() {
  const el = $('.subscribers');
  if (el) el.outerHTML = subscribersHtml();
}
async function loadSubscribers() {
  state.subscribers = { ...(state.subscribers || {}), loading: true, error: null };
  renderSubscribers();
  try { const [list, last] = await Promise.all([api.listSubscribers(), api.lastNewsletter()]); state.subscribers = { list, last }; }
  catch (e) {
    const m = (e && e.message) || '';
    state.subscribers = { error: /subscribers|schema cache|does not exist/i.test(m)
      ? '구독용 DB 설정이 아직 없어요. supabase/2026-10-25-subscribers.sql 을 SQL Editor 에서 실행해 주세요.'
      : friendlyError(e) };
  }
  renderSubscribers();
}
// 매일 오전 9시 문제 메일의 마지막 발송 결과
function newsletterHtml(last) {
  const base = '매일 오전 9시에 그날 문제를 구독자에게 메일로 보내요.';
  if (!last) return `<p class="hint">${base}</p>`;
  const when = `${fmtDate(kstDate(new Date(last.started_at)))} ${new Date(last.started_at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' })}`;
  const result = !last.finished_at ? '보내는 중이에요' : `${fmtNum(last.sent)}명에게 보냈어요${last.failed ? ` · 실패 ${fmtNum(last.failed)}명` : ''}`;
  return `<p class="hint">${base} 마지막 발송: ${esc(when)}, ${result}</p>${last.error ? `<p class="err">${esc(last.error)}</p>` : ''}`;
}
function subscribersHtml() {
  const s = state.subscribers || { loading: true };
  const list = s.list || [];
  const head = `<div class="metrics-head"><h2>이메일 구독자 ${s.list ? `<span class="mono sub-count">${fmtNum(list.length)}명</span>` : ''}</h2>
    <button class="btn ghost small" type="button" data-act="test-mail" ${state.busy ? 'disabled' : ''}>테스트 메일 받기</button>
    ${list.length ? '<button class="btn ghost small" type="button" data-act="copy-subscribers">주소 모두 복사</button>' : ''}
    <button class="btn ghost small" type="button" data-act="subscribers-refresh" ${s.loading ? 'disabled' : ''}>${s.loading ? '불러오는 중…' : '새로고침'}</button></div>`;
  let body;
  if (s.error) body = `<p class="err" role="alert">${esc(s.error)}</p>`;
  else if (!s.list) body = '<p class="loading">불러오는 중…</p>';
  else if (!list.length) body = '<p class="hint">아직 남긴 이메일이 없어요. 상단 공지에서 이메일을 남기면 여기에 보여요.</p>';
  else body = `<ul class="sub-list">${list.map((x) => `
      <li><span class="sub-email">${esc(x.email)}</span><time datetime="${esc(x.created_at)}">${fmtDate(kstDate(new Date(x.created_at)))}</time>
        <button class="btn ghost small danger" type="button" data-act="del-subscriber" data-id="${x.id}">삭제</button></li>`).join('')}</ul>`;
  return `<section class="panel subscribers">${head}${newsletterHtml(s.last)}${body}</section>`;
}

/* ---------- 관리자: 요청 모니터링 (시간대별) ---------- */
// 요청 종류마다 색이 하나씩 고정이다 (걸러도 다시 칠하지 않는다). 색만으로 구분하지 않도록 범례·툴팁·표에 이름을 함께 쓴다.
const TL_SERIES = [
  ['view', '페이지 보기', '#2a78d6'],
  ['post_create', '설계 올리기', '#eb6834'],
  ['comment_create', '댓글·답글', '#1baf7a'],
  ['like', '좋아요', '#eda100'],
  ['ai_review', 'AI 평가', '#e87ba4'],
  ['subscribe', '이메일 구독', '#008300'],
  ['sponsor_click', '스폰서 클릭', '#6250d6'],
];
const TL_RANGES = [[24, '24시간'], [168, '7일'], [720, '30일']];
const kstParts = (ms) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
function tlBucketLabel(ms, bucketMs, { long = false } = {}) {
  const p = kstParts(ms);
  if (bucketMs >= 86400000) return `${p.month}.${p.day}`;
  if (bucketMs > 3600000) return long ? `${p.month}.${p.day} ${p.hour}~${String((Number(p.hour) + bucketMs / 3600000) % 24).padStart(2, '0')}시` : `${p.month}.${p.day} ${p.hour}시`;
  return long ? `${p.month}.${p.day} ${p.hour}:00~${p.hour}:59` : `${p.hour}시`;
}
function endpointLabel(type, path) {
  if (type === 'sponsor_click') {
    const s = state.sponsors.find((x) => String(x.id) === String(path));
    return ['CLICK', `스폰서 · ${s ? s.title : `삭제된 광고 #${path}`}`];
  }
  return ENDPOINTS[`${type} ${path || ''}`] || ['', `${type} ${path || ''}`.trim()];
}
// 서버는 요청이 있던 칸만 주므로 빈 시간대를 0 으로 채운다
function tlBuckets(d) {
  const n = Math.round((d.hours * 3600000) / d.bucket_ms);
  const rows = Array.from({ length: n }, (_, i) => ({ ts: d.since + i * d.bucket_ms, counts: {}, errs: {} }));
  for (const r of d.series) {
    const row = rows[Math.round((r.ts - d.since) / d.bucket_ms)];
    if (!row) continue;
    row.counts[r.type] = (row.counts[r.type] || 0) + r.count;
    row.errs[r.type] = (row.errs[r.type] || 0) + r.errors;
  }
  return rows;
}
function renderTimeline() {
  const el = $('.timeline');
  if (el) el.outerHTML = timelineHtml();
}
async function loadTimeline(hours = state.timeline?.hours || 24) {
  state.timeline = { only: null, failOnly: false, ...(state.timeline || {}), hours, loading: true, error: null };
  renderTimeline();
  try { state.timeline = { ...state.timeline, data: await api.adminTimeline(hours), loading: false }; }
  catch (e) {
    const m = (e && e.message) || '';
    state.timeline = { ...state.timeline, loading: false, error: /admin_timeline|function|schema cache/i.test(m)
      ? '요청 모니터링용 DB 설정이 아직 없어요. supabase/2026-10-25-admin-timeline.sql 을 SQL Editor 에서 실행해 주세요.'
      : friendlyError(e) };
  }
  renderTimeline();
}
function timelineHtml() {
  const t = state.timeline || { hours: 24, loading: true };
  const seg = `<div class="seg" role="group" aria-label="기간">${TL_RANGES.map(([h, label]) => `<button type="button" data-act="tl-hours" data-hours="${h}" aria-pressed="${t.hours === h}">${label}</button>`).join('')}</div>`;
  const head = `<div class="metrics-head"><h2>요청 모니터링</h2>${seg}<button class="btn ghost small" type="button" data-act="tl-refresh" ${t.loading ? 'disabled' : ''}>${t.loading ? '불러오는 중…' : '새로고침'}</button></div>`;
  if (t.error) return `<section class="panel timeline">${head}<p class="err" role="alert">${esc(t.error)}</p></section>`;
  if (!t.data) return `<section class="panel timeline">${head}<p class="loading">불러오는 중…</p></section>`;
  const d = t.data, rows = tlBuckets(d);
  const shown = TL_SERIES.filter(([k]) => !t.only || t.only === k);
  const value = (r) => shown.reduce((sum, [k]) => sum + (r.counts[k] || 0), 0);
  const fails = (r) => shown.reduce((sum, [k]) => sum + (r.errs[k] || 0), 0);
  const totals = Object.fromEntries(TL_SERIES.map(([k]) => [k, rows.reduce((sum, r) => sum + (r.counts[k] || 0), 0)]));
  const total = shown.reduce((sum, [k]) => sum + totals[k], 0);
  const errors = rows.reduce((sum, r) => sum + fails(r), 0);
  const peak = rows.reduce((a, r) => (value(r) > value(a) ? r : a), rows[0]);
  const max = niceMax(Math.max(1, ...rows.map(value)));
  const H = 180;
  const step = Math.ceil(rows.length / 8);
  const legend = `<div class="tl-legend" role="group" aria-label="요청 종류 거르기">${TL_SERIES.map(([k, label, color]) => `
      <button type="button" class="tl-chip" data-act="tl-only" data-type="${k}" aria-pressed="${t.only === k}" ${t.only && t.only !== k ? 'data-dim' : ''}>
        <i style="background:${color}"></i>${label}<b class="mono">${fmtNum(totals[k])}</b></button>`).join('')}
      ${t.only ? '<button type="button" class="btn ghost small" data-act="tl-only" data-type="">전체 보기</button>' : ''}</div>`;
  const cols = rows.map((r, i) => {
    let segs = '';
    for (const [k, , color] of shown) {
      const n = r.counts[k] || 0;
      if (n) segs += `<i style="height:${Math.max(3, (n / max) * H)}px;background:${color}"></i>`;
    }
    return `<div class="tl-col" tabindex="0" data-i="${i}"><div class="tl-stack">${segs}</div></div>`;
  }).join('');
  const logs = d.recent.filter((r) => (!t.only || r.type === t.only) && (!t.failOnly || r.status >= 400)).slice(0, 100);
  return `
  <section class="panel timeline ${t.loading ? 'is-loading' : ''}">
    ${head}
    <div class="tiles">
      ${statTile(`${TL_RANGES.find(([h]) => h === d.hours)[1]} 요청`, fmtNum(total), t.only ? TL_SERIES.find(([k]) => k === t.only)[1] : '전체 종류')}
      ${statTile('실패', fmtNum(errors), total ? `실패율 ${((errors / total) * 100).toFixed(1)}%` : '')}
      ${statTile('가장 많은 시간대', value(peak) ? tlBucketLabel(peak.ts, d.bucket_ms) : '-', value(peak) ? `${fmtNum(value(peak))}건` : '')}
    </div>
    ${legend}
    <div class="chart tl-chart" role="img" aria-label="${esc(TL_RANGES.find(([h]) => h === d.hours)[1])} 동안 시간대별 요청 수">
      <div class="chart-y mono" aria-hidden="true"><span>${fmtNum(max)}</span><span>${fmtNum(max / 2)}</span><span>0</span></div>
      <div class="chart-plot tl-plot" style="height:${H}px">
        <i class="grid" style="top:0"></i><i class="grid" style="top:50%"></i><i class="grid base" style="top:100%"></i>
        ${cols}
        <div class="chart-tip tl-tip" hidden></div>
      </div>
      <div class="chart-x mono" aria-hidden="true">${rows.map((r, i) => `<span>${(rows.length - 1 - i) % step === 0 ? tlBucketLabel(r.ts, d.bucket_ms) : ''}</span>`).join('')}</div>
    </div>
    <details class="chart-table"><summary>표로 보기</summary>
      <div class="tl-table-wrap"><table><thead><tr><th>시간대</th>${shown.map(([, label]) => `<th>${label}</th>`).join('')}<th>실패</th></tr></thead>
      <tbody>${[...rows].reverse().filter((r) => value(r)).map((r) => `<tr><td>${tlBucketLabel(r.ts, d.bucket_ms, { long: true })}</td>${shown.map(([k]) => `<td class="mono">${fmtNum(r.counts[k] || 0)}</td>`).join('')}<td class="mono">${fmtNum(fails(r))}</td></tr>`).join('') || `<tr><td colspan="${shown.length + 2}">이 기간에는 요청이 없어요.</td></tr>`}</tbody></table></div>
    </details>
    <div class="tl-log-head"><h3>최근 요청</h3>
      <label class="tl-fail"><input type="checkbox" data-act="tl-fail" ${t.failOnly ? 'checked' : ''}> 실패만</label></div>
    ${logs.length ? `<div class="tl-log"><table>
      <thead><tr><th>시간</th><th>요청</th><th>상태</th><th>응답</th><th>방문자</th></tr></thead>
      <tbody>${logs.map((r) => {
        const [method, name] = endpointLabel(r.type, r.path);
        const p = kstParts(new Date(r.created_at).getTime());
        const color = (TL_SERIES.find(([k]) => k === r.type) || [])[2] || 'var(--faint)';
        return `<tr>
          <td class="mono">${p.month}.${p.day} ${p.hour}:${p.minute}:${p.second}</td>
          <td><i class="tl-dot" style="background:${color}"></i><span class="method">${method}</span>${esc(name)}</td>
          <td class="mono">${r.status == null ? '<span class="tl-ok">OK</span>' : r.status >= 400 ? `<span class="ep-err">⚠ ${r.status}</span>` : `<span class="tl-ok">${r.status}</span>`}</td>
          <td class="mono">${r.duration_ms == null ? '-' : fmtSec(r.duration_ms)}</td>
          <td class="mono tl-visitor">${esc(r.visitor || '')}${r.signed_in ? ' · 로그인' : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="hint">조건에 맞는 요청이 없어요.</p>'}
    <p class="metrics-note">시간은 한국 시간이에요. 최근 요청은 최대 200건 중 조건에 맞는 100건까지 보여요. 상태 OK 는 응답 코드를 따로 남기지 않는 요청이에요.</p>
  </section>`;
}
function showTlTip(col) {
  const t = state.timeline, d = t?.data;
  if (!d) return;
  const r = tlBuckets(d)[Number(col.dataset.i)];
  const plot = col.parentElement, tip = plot.querySelector('.tl-tip');
  const shown = TL_SERIES.filter(([k]) => !t.only || t.only === k);
  const lines = shown.filter(([k]) => r.counts[k]).map(([k, label, color]) => `<span class="tl-tip-row"><i style="background:${color}"></i>${label}<b class="mono">${fmtNum(r.counts[k])}</b></span>`).join('');
  const sum = shown.reduce((s, [k]) => s + (r.counts[k] || 0), 0);
  const err = shown.reduce((s, [k]) => s + (r.errs[k] || 0), 0);
  tip.innerHTML = `<b>${tlBucketLabel(r.ts, d.bucket_ms, { long: true })}</b><span>요청 ${fmtNum(sum)}건${err ? ` · 실패 ${fmtNum(err)}건` : ''}</span>${lines}`;
  tip.hidden = false;
  const pr = plot.getBoundingClientRect(), cr = col.getBoundingClientRect(), stack = col.querySelector('.tl-stack').getBoundingClientRect();
  const x = cr.left - pr.left + cr.width / 2;
  tip.style.left = `${Math.min(Math.max(x, tip.offsetWidth / 2), pr.width - tip.offsetWidth / 2)}px`;
  tip.style.top = `${Math.max(tip.offsetHeight, stack.top - pr.top - 8)}px`;
  plot.querySelectorAll('.tl-col.on').forEach((o) => o.classList.remove('on'));
  col.classList.add('on');
}
function hideTlTip(plot) {
  plot.querySelector('.tl-tip').hidden = true;
  plot.querySelectorAll('.tl-col.on').forEach((o) => o.classList.remove('on'));
}

function viewAdmin() {
  if (!state.me?.isAdmin) {
    return `
    <section class="panel" style="max-width:420px;width:100%;justify-self:center">
      <h2>관리자 로그인</h2>
      <p class="hint">${DEMO ? `데모 관리자 코드는 <b class="mono">${esc(CONFIG.DEMO_ADMIN_CODE)}</b>예요.` : '관리자로 등록된 계정만 들어올 수 있어요.'}</p>
      <form class="form-grid" id="admin-login">
        ${DEMO
          ? '<div class="field"><label for="ad-code">관리자 코드</label><input type="password" id="ad-code" required autocomplete="off"></div>'
          : `<div class="field"><label for="ad-email">이메일</label><input type="email" id="ad-email" required autocomplete="username"></div>
             <div class="field"><label for="ad-pw">비밀번호</label><input type="password" id="ad-pw" required autocomplete="current-password"></div>`}
        <p class="err" id="ad-err" role="alert" hidden></p>
        <div class="actions"><button class="btn primary" type="submit">관리자로 들어가기</button></div>
      </form>
    </section>`;
  }
  const e = state.editingTopic || { id: null, title: '', description: '', publish_date: nextFreeDate() };
  const today = kstDate();
  const rows = [...state.topics].sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  return `
  ${metricsHtml()}
  ${timelineHtml()}
  ${subscribersHtml()}
  ${sponsorsAdminHtml()}
  <div><h1 class="page-title">문제 관리</h1><p class="page-sub">날짜마다 문제 하나가 그날 0시(한국 시간)에 공개돼요. 미래 날짜로 미리 예약해 둘 수 있어요.</p></div>
  <section class="panel">
    <h2>${e.id ? '문제 수정' : '새 문제 등록'}</h2>
    <p class="hint">${e.id ? '수정한 내용은 바로 반영돼요.' : `비어 있는 가장 가까운 날짜(${fmtDate(e.publish_date)})로 채워 두었어요.`}</p>
    <form class="form-grid" id="topic-form">
      <div class="two">
        <div class="field"><label for="t-date">공개 날짜</label><input type="date" id="t-date" required value="${e.publish_date}"></div>
        <div class="field"><label for="t-title">제목</label><input type="text" id="t-title" required maxlength="120" placeholder="예: 좋아요 수, 정확하게 세야 할까?" value="${esc(e.title)}"></div>
      </div>
      <div class="field"><label for="t-desc">상황과 조건 <span class="sub">트래픽, 제약, 무엇을 답해야 하는지</span></label>
        <textarea id="t-desc" placeholder="예: 피크 때 초당 5,000번 좋아요가 눌립니다. DB는 MySQL 한 대예요.">${esc(e.description)}</textarea></div>
      <div class="actions">
        ${e.id ? '<button class="btn ghost" type="button" data-act="cancel-edit">취소</button>' : ''}
        <button class="btn primary" type="submit">${e.id ? '수정 저장' : '문제 등록'}</button>
      </div>
    </form>
  </section>
  <div class="list">${rows.length ? rows.map((t) => {
    const status = t.publish_date === today ? '<span class="chip">오늘</span>' : t.publish_date > today ? '<span class="chip future">예약</span>' : '<span class="chip past">공개됨</span>';
    return `
    <div class="row admin-row">
      <span class="date">${fmtDate(t.publish_date)} (${weekday(t.publish_date)}) ${status}</span>
      <span class="title">${esc(t.title)}<small>설계 ${t.post_count}개</small></span>
      <span class="ops">
        <button class="btn small" type="button" data-act="edit-topic" data-id="${t.id}">수정</button>
        <button class="btn small danger" type="button" data-act="del-topic" data-id="${t.id}">삭제</button>
      </span>
    </div>`;
  }).join('') : '<div class="row"><span class="title">등록된 문제가 없어요.</span></div>'}</div>`;
}

function render() {
  renderChrome();
  const main = $('#main');
  // 작성 창을 다시 그려도 보던 위치를 유지한다
  const sheetTop = $('.compose-sheet')?.scrollTop;
  if (state.view === 'archive') main.innerHTML = viewArchive();
  else if (state.view === 'admin') main.innerHTML = viewAdmin();
  else main.innerHTML = viewTopic(state.view === 'today');
  document.body.classList.toggle('composing', !!$('#composer'));
  document.body.classList.toggle('has-fab', !!$('.fab'));
  renderRail();
  if ($('#dg-svg')) dgRender();
  for (const el of main.querySelectorAll('[data-c-input]')) if (el.value.includes('\n') || el.value.length > 40) fitTextarea(el);
  const sheet = $('.compose-sheet');
  if (sheet && sheetTop) sheet.scrollTop = sheetTop;
}

/* ---------- loading per view ---------- */
async function openToday() {
  await refreshTopics();
  const today = kstDate();
  const t = state.topics.find((x) => x.publish_date === today);
  if (state.topicId !== (t ? t.id : null)) state.composing = false;
  state.topicId = t ? t.id : null;
  state.openComments.clear(); state.expanded.clear();
  await refreshPosts();
  go('today');
}
async function openTopic(id) {
  if (id === state.topicId && state.view !== 'today') return go('topic');
  state.topicId = id; state.composing = false; state.review = null;
  state.openComments.clear(); state.expanded.clear();
  state.draft = TEMPLATE; state.draftFile = null; state.draftPreview = null;
  $('#main').innerHTML = '<p class="loading">불러오는 중…</p>';
  await refreshPosts();
  go(id === state.topics.find((x) => x.publish_date === kstDate())?.id ? 'today' : 'topic');
}

/* ---------- inline confirm (브라우저 confirm 대신) ---------- */
function confirmed(btn) {
  if (btn.dataset.armed === '1') return true;
  const label = btn.textContent;
  btn.dataset.armed = '1'; btn.textContent = '한 번 더 눌러 삭제';
  setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = label; } }, 3000);
  return false;
}

/* ---------- modal ---------- */
/* 닉네임 정하기/바꾸기. 처음이면 가입 없이 익명 계정을 만들고, 이어서 하려던 동작(onDone)을 실행 */
function openNickname(onDone) {
  const layer = $('#layer');
  const changing = !!state.me;
  const draw = (err = '') => {
    layer.innerHTML = `
    <div class="overlay" data-act="close-layer">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="nick-title">
        <h2 id="nick-title">${changing ? '닉네임 바꾸기' : '닉네임 정하기'}</h2>
        <p class="info">${changing ? '바꾼 닉네임은 지금까지 쓴 글과 댓글에도 함께 반영돼요.' : '가입은 필요 없어요. 정한 닉네임은 이 브라우저에서 계속 쓰여요.'}</p>
        <form class="form-grid" id="nick-form">
          <div class="field"><label for="a-nick">닉네임</label><input type="text" id="a-nick" maxlength="20" required autocomplete="nickname" placeholder="예: 누누" value="${esc(state.me?.nickname || '')}"></div>
          ${err ? `<p class="err" role="alert">${esc(err)}</p>` : ''}
          <div class="actions"><button class="btn ghost" type="button" data-act="close-layer">닫기</button><button class="btn primary" type="submit">${changing ? '바꾸기' : '시작하기'}</button></div>
        </form>
      </div>
    </div>`;
    $('#a-nick', layer).focus();
    $('#nick-form', layer).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const nickname = $('#a-nick', layer).value.trim().slice(0, 20);
      if (!nickname) return draw('닉네임을 입력해 주세요.');
      try {
        if (changing) await api.setNickname(nickname); else await api.ensureUser(nickname);
        closeLayer();
        await afterAuthChange();
        if (onDone) await onDone();
        else toast(changing ? '닉네임을 바꿨어요' : `${nickname}님, 반가워요`);
      } catch (e) { draw(friendlyError(e)); }
    });
  };
  draw();
}

/* 닉네임이 있어야 하는 동작 앞에 붙이는 헬퍼 */
function requireUser(action) { return state.me ? action() : openNickname(action); }

async function toggleLike(id) {
  const p = state.posts.find((x) => x.id === id);
  if (!p) return;
  const on = !p.liked;
  p.liked = on; p.like_count += on ? 1 : -1;
  const btn = document.querySelector(`[data-act="like"][data-id="${id}"]`);
  if (btn) btn.outerHTML = likeBtn(p);
  try { await api.setLike(id, on); track('like', on ? 'on' : 'off'); }
  catch (e) { p.liked = !on; p.like_count += on ? -1 : 1; render(); toast(friendlyError(e)); }
}

async function submitComment(postId, text, parentId = null, inputId = null) {
  try {
    await api.addComment(postId, text, parentId);
    if (inputId) delete state.commentDrafts[inputId];
    track('comment_create', parentId ? 'reply' : 'comment');
    state.comments[postId] = await api.listComments(postId);
    const p = state.posts.find((x) => x.id === postId); if (p) p.comment_count = state.comments[postId].length;
    if (parentId) state.replyTo = null;
    render();
    if (!parentId) $(`#c-input-${postId}`)?.focus();
  } catch (e) { render(); toast(friendlyError(e)); }
}

function openReply(postId, rootId, nick) {
  if (state.replyTo) delete state.commentDrafts[`r-input-${state.replyTo.rootId}`];
  state.replyTo = { postId, rootId, nick };
  render();
  const input = $(`#r-input-${rootId}`);
  if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}
function closeLayer() { $('#layer').innerHTML = ''; }
function openLightbox(src) {
  $('#layer').innerHTML = `<div class="overlay lightbox" data-act="close-layer" role="dialog" aria-label="다이어그램 크게 보기"><img src="${esc(src)}" alt="설계 다이어그램 원본"></div>`;
}

async function afterAuthChange() {
  await refreshMe();
  await refreshTopics();
  if (state.view === 'today') {
    const t = state.topics.find((x) => x.publish_date === kstDate());
    state.topicId = t ? t.id : null;
  }
  await refreshPosts();
  render();
}

/* ---------- events ---------- */
document.addEventListener('click', async (ev) => {
  const nav = ev.target.closest('[data-nav]');
  if (nav) {
    const v = nav.dataset.nav;
    if (v === 'today') return openToday();
    state.editingTopic = null;
    if (v === 'archive' || v === 'admin') { await refreshTopics(); return go(v); }
  }
  const topicBtn = ev.target.closest('[data-topic]');
  if (topicBtn) return openTopic(Number(topicBtn.dataset.topic) || topicBtn.dataset.topic);

  const sortBtn = ev.target.closest('[data-sort]');
  if (sortBtn) { state.sort = sortBtn.dataset.sort; return render(); }

  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'close-layer') { if (ev.target === el || el.tagName === 'BUTTON' || el.classList.contains('lightbox')) closeLayer(); return; }
  if (act === 'nickname') return openNickname();
  if (act === 'dismiss-notice') {
    noticeClosed = true; state.subDone = false;
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* 이번 방문 동안만 닫힘 */ }
    return renderChrome();
  }
  if (act === 'logout') { await api.signOut(); state.editingTopic = null; await refreshMe(); await openToday(); return toast('관리자에서 로그아웃했어요'); }
  if (act === 'reset-demo') { api.reset(); state.composing = false; state.diagram = dgNew(); dgResetHistory(); state.review = null; state.draft = TEMPLATE; state.draftFile = null; state.draftPreview = null; await refreshMe(); return openToday(); }
  if (act === 'compose') { state.composing = true; render(); $('#post-content')?.focus(); return; }
  if (act === 'ai-review') return runReview();
  if (act === 'reply') return openReply(Number(el.dataset.post) || el.dataset.post, Number(el.dataset.root) || el.dataset.root, el.dataset.nick);
  if (act === 'cancel-reply') { delete state.commentDrafts[`r-input-${state.replyTo?.rootId}`]; state.replyTo = null; return render(); }
  if (act === 'metrics-days') return loadMetrics(Number(el.dataset.days));
  if (act === 'metrics-refresh') return loadMetrics();
  if (act === 'tl-hours') return loadTimeline(Number(el.dataset.hours));
  if (act === 'tl-refresh') return loadTimeline();
  if (act === 'tl-only') { state.timeline.only = el.dataset.type && state.timeline.only !== el.dataset.type ? el.dataset.type : null; return renderTimeline(); }
  if (act === 'tl-fail') { state.timeline.failOnly = el.checked; return renderTimeline(); }
  if (act === 'subscribers-refresh') return loadSubscribers();
  if (act === 'sponsor-click') { track('sponsor_click', String(el.dataset.id)); return; }
  if (act === 'sponsor-edit') {
    resetSponsorForm();
    const s = state.sponsors.find((x) => String(x.id) === el.dataset.id);
    state.editingSponsor = { ...s, image_style: spStyle(s.image_style) };
    render(); $('#sp-title')?.focus(); return;
  }
  if (act === 'sponsor-cancel') { resetSponsorForm(); return render(); }
  if (act === 'sponsor-remove-image') {
    if (state.sponsorFile) { URL.revokeObjectURL(state.sponsorFile.url); state.sponsorFile = null; }
    spReadForm().removeImage = true;
    return renderSponsorImageCtrl();
  }
  if (act === 'sp-style') {
    const e = spEditing();
    const next = { ...spStyle(e.image_style), [el.dataset.k]: el.dataset.v };
    // 원본 비율에서 맞춤을 고르면 자를 비율이 필요하니 가로형으로 바꾼다
    if (el.dataset.k === 'fit' && next.ratio === 'auto') next.ratio = '1.91';
    e.image_style = spStyle(next);
    return renderSponsorImageCtrl();
  }
  if (act === 'sponsor-move') {
    const list = [...state.sponsors];
    const i = list.findIndex((x) => String(x.id) === el.dataset.id), j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const changes = list.map((x, k) => ({ id: x.id, sort_order: k })).filter((c, k) => (list[k].sort_order ?? 0) !== c.sort_order);
    try {
      await api.reorderSponsors(changes);
      await refreshSponsors();
      const w = $('.sponsor-rows-wrap'); if (w) w.outerHTML = sponsorRowsHtml();
    } catch (e) { toast(/sort_order|schema cache/i.test(e?.message || '') ? '순서용 DB 설정이 아직 없어요. supabase/2026-10-25-sponsors-layout.sql 을 실행해 주세요.' : friendlyError(e)); }
    return;
  }
  if (act === 'sponsor-toggle') {
    const s = state.sponsors.find((x) => String(x.id) === el.dataset.id);
    try { await api.setSponsorActive(s.id, !s.active); await refreshSponsors(); render(); toast(s.active ? '광고를 껐어요' : '광고를 켰어요'); }
    catch (e) { toast(friendlyError(e)); }
    return;
  }
  if (act === 'sponsor-del') {
    if (!confirmed(el)) return;
    const s = state.sponsors.find((x) => String(x.id) === el.dataset.id);
    try { await api.deleteSponsor(s); if (state.editingSponsor?.id === s.id) resetSponsorForm(); await refreshSponsors(); render(); toast('광고를 삭제했어요'); }
    catch (e) { toast(friendlyError(e)); }
    return;
  }
  if (act === 'test-mail') {
    state.busy = true; renderSubscribers();
    try { const r = await api.sendTestMail(); toast(`${r.to}(으)로 오늘 문제 메일을 보냈어요`); }
    catch (e) { toast(friendlyError(e)); }
    state.busy = false; renderSubscribers();
    return;
  }
  if (act === 'copy-subscribers') {
    const text = (state.subscribers?.list || []).map((x) => x.email).join(', ');
    try { await navigator.clipboard.writeText(text); toast('이메일 주소를 모두 복사했어요'); }
    catch { toast('복사하지 못했어요. 목록에서 직접 선택해 주세요.'); }
    return;
  }
  if (act === 'del-subscriber') {
    if (!confirmed(el)) return;
    try { await api.deleteSubscriber(Number(el.dataset.id) || el.dataset.id); await loadSubscribers(); toast('구독자를 삭제했어요'); }
    catch (e) { toast(friendlyError(e)); }
    return;
  }
  if (act === 'cancel-compose' || (act === 'backdrop-compose' && ev.target === el)) { if (state.busy) return; state.composing = false; return render(); }
  if (act === 'backdrop-compose') return;
  if (act === 'zoom') return openLightbox(el.dataset.src);
  if (act === 'toggle-score') {
    const id = Number(el.dataset.id) || el.dataset.id;
    if (!state.openScores.delete(id)) state.openScores.add(id);
    return rerenderPost(id);
  }
  if (act === 'expand') { state.expanded.add(Number(el.dataset.id) || el.dataset.id); return render(); }
  if (act === 'remove-image') {
    state.draft = $('#post-content')?.value ?? state.draft;
    if (state.draftPreview?.startsWith('blob:')) URL.revokeObjectURL(state.draftPreview);
    state.draftFile = null; state.draftPreview = null; return render();
  }

  const id = Number(el.dataset.id) || el.dataset.id;
  try {
    if (act === 'like') return requireUser(() => toggleLike(id));
    if (act === 'toggle-comments') {
      if (state.openComments.has(id)) { state.openComments.delete(id); return render(); }
      state.openComments.add(id); render();
      state.comments[id] = await api.listComments(id);
      render();
      $(`#c-input-${id}`)?.focus();
      return;
    }
    if (act === 'del-comment') {
      if (!confirmed(el)) return;
      const postId = Number(el.dataset.post) || el.dataset.post;
      await api.deleteComment(id);
      state.comments[postId] = await api.listComments(postId);
      const p = state.posts.find((x) => x.id === postId); if (p) p.comment_count = state.comments[postId].length;
      return render();
    }
    if (act === 'del-post') {
      if (!confirmed(el)) return;
      await api.deletePost(state.posts.find((x) => x.id === id));
      await refreshPosts(); await refreshTopics(); render(); return toast('설계를 삭제했어요');
    }
    if (act === 'edit-topic') { state.editingTopic = state.topics.find((t) => t.id === id); render(); $('#t-title')?.focus(); return; }
    if (act === 'cancel-edit') { state.editingTopic = null; return render(); }
    if (act === 'del-topic') {
      if (!confirmed(el)) return;
      await api.deleteTopic(id);
      if (state.editingTopic?.id === id) state.editingTopic = null;
      await refreshTopics(); render(); return toast('문제를 삭제했어요');
    }
  } catch (e) { toast(friendlyError(e)); }
});

document.addEventListener('keydown', (ev) => {
  // 댓글 칸: Ctrl/Cmd+Enter 로 등록 (한글 조합 중에는 무시)
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && !ev.isComposing && ev.target.matches?.('[data-c-input]')) {
    ev.preventDefault();
    return ev.target.form.requestSubmit();
  }
  if (ev.key !== 'Escape') return;
  if ($('#layer').innerHTML) closeLayer();
  else if (state.composing && !state.busy && $('#composer')) { state.composing = false; render(); }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'post-content') state.draft = ev.target.value;
  if (ev.target.id === 'post-nick') state.draftNick = ev.target.value;
  if (ev.target.id === 'sub-email') state.subEmail = ev.target.value;
  if (['sp-title', 'sp-body', 'sp-link'].includes(ev.target.id)) renderSponsorPreview();
  if (ev.target.matches?.('[data-c-input]')) {
    const el = ev.target;
    state.commentDrafts[el.id] = el.value;
    fitTextarea(el);
    const count = el.form.querySelector('.c-count');
    count.textContent = `${el.value.length}/1000`;
    count.hidden = el.value.length < 800;
  }
});

async function attachFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast('이미지 파일만 올릴 수 있어요.');
  if (file.size > 10 * 1024 * 1024) return toast('10MB 이하 이미지만 올릴 수 있어요.');
  state.draft = $('#post-content')?.value ?? state.draft;
  state.draftFile = file; state.draftPreview = URL.createObjectURL(file);
  state.dgMode = 'image';
  render();
}
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'post-image') attachFile(ev.target.files[0]);
  if (ev.target.id === 'sp-image') {
    const file = ev.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('이미지 파일만 올릴 수 있어요.');
    if (state.sponsorFile) URL.revokeObjectURL(state.sponsorFile.url);
    state.sponsorFile = { file, url: URL.createObjectURL(file) };
    spReadForm().removeImage = false;
    renderSponsorImageCtrl();
  }
});
document.addEventListener('dragover', (ev) => { const d = ev.target.closest('#drop'); if (d) { ev.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', (ev) => { const d = ev.target.closest('#drop'); if (d) d.classList.remove('over'); });
document.addEventListener('drop', (ev) => { const d = ev.target.closest('#drop'); if (d) { ev.preventDefault(); attachFile(ev.dataTransfer.files[0]); } });
document.addEventListener('paste', (ev) => {
  if (!$('#composer')) return;
  const item = [...(ev.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { ev.preventDefault(); attachFile(item.getAsFile()); }
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target;
  if (form.id === 'composer') {
    ev.preventDefault();
    const content = $('#post-content').value.trim();
    const nickname = $('#post-nick')?.value.trim().slice(0, 20);
    if (!state.me && !nickname) { $('#post-nick').focus(); return toast('닉네임을 입력해 주세요.'); }
    if (!meaningful(content)) return toast('설계 내용을 한 줄 이상 적어주세요.');
    state.busy = true; state.draft = content; render();
    try {
      if (!state.me) { await api.ensureUser(nickname); await refreshMe(); }
      const file = state.dgMode === 'image' ? state.draftFile : await dgExportPng();
      await api.createPost(state.topicId, content, file);
      track('post_create');
      if (state.draftPreview?.startsWith('blob:')) URL.revokeObjectURL(state.draftPreview);
      state.draft = TEMPLATE; state.draftFile = null; state.draftPreview = null; state.composing = false;
      state.diagram = dgNew(); dgResetHistory(); state.dgMode = 'canvas'; state.review = null;
      await refreshPosts(); await refreshTopics();
      state.sort = 'new';
      toast('설계를 올렸어요. 다른 사람들의 답도 둘러보세요');
    } catch (e) { toast(friendlyError(e)); }
    state.busy = false; render();
    return;
  }
  if (form.id === 'topic-form') {
    ev.preventDefault();
    const payload = {
      id: state.editingTopic?.id || null,
      publish_date: $('#t-date').value,
      title: $('#t-title').value.trim(),
      description: $('#t-desc').value.trim(),
    };
    if (!payload.title || !payload.publish_date) return toast('날짜와 제목을 입력해 주세요.');
    try {
      await api.saveTopic(payload);
      const wasEdit = !!payload.id;
      state.editingTopic = null;
      await refreshTopics(); render();
      toast(wasEdit ? '문제를 수정했어요' : `${fmtDate(payload.publish_date)} 문제를 등록했어요`);
    } catch (e) { toast(friendlyError(e)); }
    return;
  }
  if (form.id === 'sponsor-form') {
    ev.preventDefault();
    const e = spReadForm();
    const payload = {
      id: e.id || null,
      image_style: spStyle(e.image_style),
      // 새 광고는 맨 위에 놓는다
      sort_order: e.id ? null : Math.min(0, ...state.sponsors.map((s) => s.sort_order ?? 0)) - 1,
      title: $('#sp-title').value.trim(),
      body: $('#sp-body').value.trim(),
      link_url: $('#sp-link').value.trim(),
      active: $('#sp-active').checked,
      file: state.sponsorFile?.file || null,
      removeImage: !!e.removeImage,
    };
    if (!payload.title) return toast('제목을 입력해 주세요.');
    if (!/^https?:\/\/[^\s.]+\.\S+$/i.test(payload.link_url)) return toast('링크는 https:// 로 시작하는 주소로 넣어 주세요.');
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await api.saveSponsor(payload, e.id ? state.sponsors.find((s) => s.id === e.id) : null);
      resetSponsorForm();
      await refreshSponsors(); render();
      toast(payload.id ? '광고를 수정했어요' : '광고를 등록했어요');
    } catch (err) {
      btn.disabled = false;
      const m = (err && err.message) || '';
      toast(/image_style|sort_order/i.test(m) ? '스폰서용 DB 설정이 아직 없어요. supabase/2026-10-25-sponsors-layout.sql 을 실행해 주세요.'
        : /sponsors|schema cache|does not exist/i.test(m) ? '스폰서용 DB 설정이 아직 없어요. supabase/2026-10-25-sponsors.sql 을 실행해 주세요.' : friendlyError(err));
    }
    return;
  }
  if (form.id === 'sub-form') {
    ev.preventDefault();
    const email = $('#sub-email').value.trim();
    if (!EMAIL_RE.test(email)) return toast('이메일 주소를 확인해 주세요.');
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      const { already } = await api.subscribe(email);
      if (!already) track('subscribe');
      noticeClosed = true; state.subDone = email; state.subEmail = '';
      try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* 이번 방문 동안만 닫힘 */ }
      renderChrome();
      if (already) toast('이미 남겨 주신 이메일이에요');
    } catch (e) { btn.disabled = false; toast(friendlyError(e)); }
    return;
  }
  if (form.classList.contains('c-form')) {
    ev.preventDefault();
    const postId = Number(form.dataset.post) || form.dataset.post;
    const parentId = form.dataset.parent ? Number(form.dataset.parent) || form.dataset.parent : null;
    const input = form.querySelector('textarea');
    // 앞뒤 공백과 세 줄 이상 연달아 빈 줄은 정리한다
    const text = input.value.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text || (parentId && /^@\S+$/.test(text))) return;
    input.disabled = true;
    requireUser(() => submitComment(postId, text, parentId, input.id));
    if (!state.me) input.disabled = false;
    return;
  }
  if (form.id === 'admin-login') {
    ev.preventDefault();
    const err = $('#ad-err');
    try {
      await api.adminSignIn({ code: $('#ad-code')?.value, email: $('#ad-email')?.value.trim(), password: $('#ad-pw')?.value });
      await refreshMe(); await refreshTopics();
      go('admin');
      toast('관리자로 들어왔어요');
    } catch (e) { err.textContent = friendlyError(e); err.hidden = false; }
  }
});

/* ---------- 지표 차트 툴팁 ---------- */
function showChartTip(col) {
  const tip = col.parentElement.querySelector('.chart-tip');
  const [title, ...rows] = col.dataset.tip.split('|');
  tip.innerHTML = `<b>${esc(title)}</b>${rows.map((r) => `<span>${esc(r)}</span>`).join('')}`;
  tip.hidden = false;
  const plot = col.parentElement.getBoundingClientRect(), bar = col.querySelector('i').getBoundingClientRect();
  const x = bar.left - plot.left + bar.width / 2;
  tip.style.left = `${Math.min(Math.max(x, tip.offsetWidth / 2), plot.width - tip.offsetWidth / 2)}px`;
  tip.style.top = `${bar.top - plot.top - 8}px`;
  col.parentElement.querySelectorAll('.col.on').forEach((o) => o.classList.remove('on'));
  col.classList.add('on');
}
function hideChartTip(plot) {
  plot.querySelector('.chart-tip').hidden = true;
  plot.querySelectorAll('.col.on').forEach((o) => o.classList.remove('on'));
}
document.addEventListener('pointerover', (ev) => { const col = ev.target.closest('.chart .col'); if (col) showChartTip(col); const tc = ev.target.closest('.tl-col'); if (tc) showTlTip(tc); });
document.addEventListener('pointerout', (ev) => {
  const plot = ev.target.closest('.chart-plot');
  if (plot && !plot.contains(ev.relatedTarget)) (plot.classList.contains('tl-plot') ? hideTlTip : hideChartTip)(plot);
});
document.addEventListener('focusin', (ev) => { if (ev.target.matches?.('.chart .col')) showChartTip(ev.target); if (ev.target.matches?.('.tl-col')) showTlTip(ev.target); });
document.addEventListener('focusout', (ev) => { if (ev.target.matches?.('.chart .col')) hideChartTip(ev.target.parentElement); if (ev.target.matches?.('.tl-col')) hideTlTip(ev.target.parentElement); });

/* ---------- boot ---------- */
(async function boot() {
  try {
    api = DEMO ? createDemoApi() : await createSupabaseApi(() => afterAuthChange());
    await refreshMe();
    refreshSponsors().then(renderRail);
    if (!noticeClosed) api.subscriberCount().then((n) => { state.subCount = n; renderChrome(); }).catch(() => {});
    const hash = location.hash.replace('#', '');
    if (hash === 'admin' || hash === 'archive') { await refreshTopics(); go(hash); }
    else await openToday();
  } catch (e) {
    $('#main').innerHTML = `<section class="panel"><h2>앱을 시작하지 못했어요</h2><p class="hint">${esc(friendlyError(e))}</p><p class="hint">app.js 의 CONFIG(Supabase URL, anon key)와 schema.sql 실행 여부를 확인해 주세요.</p></section>`;
  }
})();
