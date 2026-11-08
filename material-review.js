const crypto = require('node:crypto');
const { MaterialAssets,imageName } = require('./material-assets');

const HOUR = 3600000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const text = (value, length = 500) => typeof value === 'string' ? value.trim().slice(0,length) : '';
const pick = (source, keys) => Object.fromEntries(keys.map(key => [key,text(source?.[key],key === 'note' ? 2000 : 500)]));
const { cleanView } = require('./shared-library');
// Ô màu sơn trong PA: chỉ giữ hãng, mã, tên và mã màu hợp lệ.
function cleanPaint(paint) {
  if (!paint || typeof paint !== 'object' || !/^#[0-9a-f]{6}$/i.test(paint.hex || '')) return undefined;
  const code = text(paint.code,80);
  if (!code) return undefined;
  return { kind:'paint', brand:text(paint.brand,40), code, name:text(paint.name,120), hex:paint.hex.toLowerCase() };
}
const withPaint = pa => { const paint = cleanPaint(pa?.paint); return paint ? { paint } : {}; };
const assetsOnly = list => (Array.isArray(list) ? list : []).slice(0,8).flatMap(image => {
  if (imageName(image)) return [{ full:image, thumb:image }];
  if (!imageName(image?.full) || !imageName(image?.thumb)) return [];
  const view = cleanView(image.view);
  return [{ full:image.full, thumb:image.thumb, ...(view ? { view } : {}) }];
});
function error(status,message) { throw Object.assign(new Error(message),{ status }); }

function cleanSheet(sheet) {
  if (!Array.isArray(sheet.groups) || sheet.groups.length > 100) error(400,'Tối đa 100 nhóm.');
  const seen = new Set();
  let count = 0;
  function unique(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value) || seen.has(value)) error(400,'ID dòng/nhóm bị thiếu hoặc trùng.');
    seen.add(value);
    return value;
  }
  return {
    meta:pick(sheet.meta,['customer','address','project','phone','email','date','number','contract']),
    groups:sheet.groups.map(group => {
      if (!group || !Array.isArray(group.rows)) error(400,'Nhóm không hợp lệ.');
      const groupId = unique(group.id);
      const taskLinkMode = ['auto','manual'].includes(group.taskLinkMode) ? group.taskLinkMode : undefined;
      const taskLinkScore = taskLinkMode === 'auto' && Number.isFinite(group.taskLinkScore) ?
        Math.min(100,Math.max(0,Math.round(group.taskLinkScore))) : undefined;
      return { id:groupId, ...pick(group,['name','due','taskId','calendarId','dayMode']),
        ...(taskLinkMode ? {taskLinkMode} : {}),...(taskLinkScore !== undefined ? {taskLinkScore} : {}),leadDays: Math.min(365,Math.max(0,Math.floor(Number(group.leadDays) || 0))),
        rows:group.rows.map(row => {
          if (++count > 1000 || !row || !Array.isArray(row.options) || row.options.length !== 3) error(400,'Tối đa 1000 dòng và đúng ba ô phương án mỗi dòng.');
          const chosen = Number.isInteger(row.chosen) && row.chosen >= 0 && row.chosen < 3 ? row.chosen : null;
          const decision = ['draft','sent','chosen','changed'].includes(row.decision) ? row.decision : 'draft';
          return { id:unique(row.id), ...pick(row,['name','room','qty','unit','supplier','note','spec']), render:assetsOnly(row.render),
            ...(Array.isArray(row.noteSuggestions) ? { noteSuggestions:row.noteSuggestions.slice(0,12).map(value => text(value,2000)).filter(Boolean) } : {}),
            options:row.options.map(pa => ({ ...pick(pa,['brand','code','finish','color','size','supplier','price']), ...withPaint(pa), ...(typeof pa?.autoName === 'boolean' ? {autoName:pa.autoName} : {}), images:assetsOnly(pa?.images) })),
            paCount:Math.min(3,Math.max(1,Number.isInteger(row.paCount) ? row.paCount : 1)),
            chosen, decision, ordered:!!row.ordered && chosen !== null };
        })
      };
    })
  };
}

function publicSheet(sheet) {
  const { meta,groups } = sheet;
  return {
    id:sheet.id, title:sheet.title, meta:pick(meta,['customer','address','project','phone','email','date','number','contract']),
    groups:groups.map(group => ({
      id:group.id, name:group.name,
      rows:group.rows.filter(row => row.options.some(hasOption)).map(row => ({
        id:row.id, ...pick(row,['name','room','qty','unit','note','spec']), chosen:row.chosen, render:assetsOnly(row.render),
        options:row.options.map(pa => ({ ...pick(pa,['brand','code','finish','color','size']), ...withPaint(pa), images:assetsOnly(pa.images) }))
      }))
    })).filter(group => group.rows.length)
  };
}
function hasOption(pa) {
  return !!(pa.code || pa.brand || pa.finish || pa.color || pa.size || pa.images?.length);
}

const terms = require('./material-terms');
const defaultSettings = {
  representative:'', position:'', address:'Văn phòng CTCP GD Home - Số 35 ngõ 1 Nguyễn Thị Định - Trung Hoà - Cầu Giấy - Hà Nội', terms
};
function settingsFor(data) { return { ...defaultSettings,...data.settings }; }

function encryptToken(key, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm',Buffer.from(digest(secret + '|material-review'),'hex'),iv);
  const body = Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');
}
function decryptToken(token, secret) {
  if (!/^[a-zA-Z0-9_-]{100,180}$/.test(token)) error(404,'Link không hợp lệ.');
  try {
    const bytes = Buffer.from(token,'base64url');
    const cipher = crypto.createDecipheriv('aes-256-gcm',Buffer.from(digest(secret + '|material-review'),'hex'),bytes.subarray(0,12));
    cipher.setAuthTag(bytes.subarray(12,28));
    const key = Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString();
    if (!/^mat-v1-[a-f0-9]{64}$/.test(key)) throw new Error();
    return key;
  } catch { error(404,'Link không hợp lệ.'); }
}

function revisionState(data, revision) {
  const records = data.approvals.filter(entry => entry.revisionId === revision.id);
  return {
    customer:records.find(entry => entry.kind === 'customer') || null,
    company:records.find(entry => entry.kind === 'company') || null,
    changes:records.filter(entry => entry.kind === 'change')
  };
}
function audit(data, revision, event, actor, extra = {}) {
  data.audit.push({ revisionId:revision.id, sheetId:revision.sheet.id, at:Date.now(), event, actor,...extra });
}
function findPublicRevision(data, token) {
  const revision = data.revisions.find(entry => entry.tokenHash === digest(token));
  if (!revision) error(404,'Không tìm thấy bản phát hành.');
  if (data.audit.some(entry => entry.revisionId === revision.id && entry.event === 'revoked')) error(410,'Link đã bị thu hồi.');
  const state = revisionState(data,revision);
  if (!state.customer && Date.now() >= revision.expiresAt) error(410,'Link đã hết hạn.');
  return { revision,state };
}
function view(revision,state) {
  return { id:revision.id, sheet:revision.sheet, settings:revision.settings, publishedAt:revision.publishedAt,...state, serverNow:Date.now() };
}
function signature(body) {
  const name = text(body.name,150);
  const points = body.strokes;
  if (!name || !Array.isArray(points) || !points.length || points.length > 50 ||
      points.flat().length > 3000 || !points.some(stroke => Array.isArray(stroke) && stroke.length >= 2) ||
      !points.every(stroke => Array.isArray(stroke) && stroke.every(p => Array.isArray(p) && p.length === 2 &&
        p.every(n => typeof n === 'number' && n >= 0 && n <= 1000)))) error(400,'Nhập họ tên và vẽ chữ ký hợp lệ.');
  return { name, strokes:points };
}
function assetNames(sheet) {
  const names = new Set();
  for (const group of sheet.groups || []) for (const row of group.rows) {
    const images = [...(row.render || []),...row.options.flatMap(pa => pa.images || [])];
    for (const image of images) {
      for (const name of typeof image === 'string' ? [image] : [image?.full,image?.thumb]) {
        if (imageName(name)) names.add(name);
      }
    }
  }
  return names;
}
function findStoredSheet(data,id) {
  return data.sheets.find(sheet => sheet.id === id) || data.archivedSheets?.find(sheet => sheet.id === id);
}


async function handlePublicReview(req,url,{ res, store, MaterialStore, dataDir, readJsonBody, sendJson, secret }) {
  const match = /^\/api\/review\/([^/]+)(?:\/(sign|change|assets)(?:\/([^/]+))?)?$/.exec(url);
  if (!match) error(404,'Không tìm thấy.');
  const [,token,action,asset] = match;
  const accountKey = decryptToken(token,secret);
  const repo = new MaterialStore(store,null,accountKey);
  const current = await repo.get();
  const {revision,state} = findPublicRevision(current,token);
  if (req.method === 'GET') {
    if (!action) return sendJson(res,200,view(revision,state));
    if (action === 'assets' && assetNames(revision.sheet).has(asset)) return new MaterialAssets(dataDir,accountKey).send(res,asset);
  }
  if (req.method === 'POST' && !asset && (action === 'sign' || action === 'change')) {
    const body = await readJsonBody(req);
    const result = await repo.update(undefined,data => {
      const { revision,state } = findPublicRevision(data,token);
      if (action === 'sign') {
        if (state.customer) error(409,'Bản này đã được khách ký.');
        if (body.accepted !== true) error(400,'Cần đồng ý với biên bản.');
        const signed = signature(body);
        const choices = Object.fromEntries(revision.sheet.groups.flatMap(g => g.rows).map(row => {
          const choice = body.choices?.[row.id];
          if (!Number.isInteger(choice) || !row.options[choice] || !hasOption(row.options[choice])) error(400,'Chọn đủ phương án trước khi ký.');
          return [row.id,choice];
        }));
        const at = Date.now();
        const customer = { kind:'customer', revisionId:revision.id,...signed,at,expiresAt:at+48*HOUR, choices };
        data.approvals.push(customer);
        const draft = findStoredSheet(data,revision.sheet.id);
        if (draft) {
          const savedRows = new Map(revision.sheet.groups.flatMap(g => g.rows).map(row => [row.id,row]));
          for (const row of draft.groups.flatMap(g => g.rows)) {
            if (!Object.hasOwn(choices,row.id)) continue;
            const published = savedRows.get(row.id);
            const chosen = choices[row.id];
            const pa = row.options[chosen];
            const old = published.options[chosen];
            if (JSON.stringify({ ...pick(pa,['brand','code','finish','color','size']),images:assetsOnly(pa.images) }) !== JSON.stringify(old)) continue;
            if (row.chosen !== chosen) row.ordered = false;
            row.chosen = chosen;
            row.decision = 'chosen';
          }
        }
        audit(data,revision,'customer-signed',signed.name,{ choices });
      } else {
        const reason = text(body.reason,1500);
        if (!state.customer || Date.now() >= state.customer.expiresAt) error(410,'Đã hết hạn 48 giờ yêu cầu đổi.');
        if (!reason) error(400,'Nhập lý do yêu cầu đổi.');
        if (state.changes.length >= 20) error(429,'Đã đạt giới hạn yêu cầu đổi cho bản này.');
        data.approvals.push({ kind:'change', revisionId:revision.id,reason,at:Date.now() });
        const draft = findStoredSheet(data,revision.sheet.id);
        const latest = data.revisions.filter(entry => entry.sheet.id === revision.sheet.id).at(-1);
        if (draft && latest?.id === revision.id) for (const row of draft.groups.flatMap(g => g.rows)) {
          if (Object.hasOwn(state.customer.choices,row.id) && row.decision === 'chosen') row.decision = 'changed';
        }
        audit(data,revision,'change-requested',state.customer.name,{ reason });
      }
      return view(revision,revisionState(data,revision));
    });
    return sendJson(res,200,result);
  }
  error(404,'Không tìm thấy.');
}

async function handleInternalReview(req,url,{ res, repo, account, readJsonBody, sendJson, secret, resolveProfile }) {
  if (url === '/api/materials/settings' && req.method === 'GET') {
    const data = await repo.get();
    return sendJson(res,200,{ _version:data._version, settings:settingsFor(data) });
  }
  if (url === '/api/materials/settings' && req.method === 'POST') {
    const body = await readJsonBody(req);
    requireVersion(body);
    const saved = await repo.update(body._version,data => {
      data.settings = { ...pick(body.settings,['representative','position','address']),terms:text(body.settings?.terms,15000) };
      return { settings:settingsFor(data) };
    });
    return sendJson(res,200,saved);
  }
  const match = /^\/api\/materials\/sheets\/([a-zA-Z0-9_-]+)\/review$/.exec(url);
  if (!match) return false;
  const sheetId = match[1];
  if (req.method === 'GET') {
    const data = await repo.get();
    if (!findStoredSheet(data,sheetId)) error(404,'Không tìm thấy bảng.');
    return sendJson(res,200,{
      _version:data._version,
      revisions:data.revisions.filter(r => r.sheet.id === sheetId).map(r => ({
        ...view(r,revisionState(data,r)), revoked:data.audit.some(a => a.revisionId === r.id && a.event === 'revoked')
      })),
      audit:data.audit.filter(event => event.sheetId === sheetId)
    });
  }
  if (req.method !== 'POST') return false;
  const body = await readJsonBody(req);
  requireVersion(body);
  const saved = await repo.update(body._version,async data => {
    const sheet = findStoredSheet(data,sheetId);
    if (!sheet) error(404,'Không tìm thấy bảng.');
    if (body.action === 'publish') {
      if (sheet.archivedAt) error(409,'Khôi phục bảng trước khi phát hành.');
      const snapshot = publicSheet({ ...sheet,meta:{ ...sheet.meta,...await resolveProfile(sheet,data) } });
      snapshot.imageFit = (['fill','fit'].includes(body.imageFit) ? body.imageFit : data.viewSettings?.imageFit) === 'fit' ? 'fit' : 'fill';
      if (!snapshot.groups.length) error(400,'Điền ít nhất một phương án trước khi phát hành.');
      const token = encryptToken(repo.key,secret);
      const publishedAt = Date.now();
      const revision = { id:crypto.randomUUID(), tokenHash:digest(token), publishedAt, expiresAt:publishedAt+14*24*HOUR,
        sheet:snapshot, settings:settingsFor(data) };
      for (const old of data.revisions.filter(entry => entry.sheet.id === sheetId)) {
        if (!revisionState(data,old).customer && !data.audit.some(entry => entry.revisionId === old.id && entry.event === 'revoked')) {
          audit(data,old,'revoked',account);
        }
      }
      data.revisions.push(revision);
      audit(data,revision,'published',account);
      const ids = new Set(snapshot.groups.flatMap(g => g.rows.map(r => r.id)));
      for (const row of sheet.groups.flatMap(g => g.rows)) {
        if (ids.has(row.id) && (row.decision === 'draft' || row.decision === 'changed')) row.decision = 'sent';
      }
      return { path:'/duyet/'+token, sheet };
    }
    const revision = data.revisions.find(entry => entry.id === body.revisionId && entry.sheet.id === sheetId);
    if (!revision) error(404,'Không tìm thấy bản phát hành.');
    const state = revisionState(data,revision);
    if (body.action === 'company') {
      if (!state.customer || state.company) error(409,'Bên A phải ký trước và Bên B chỉ ký một lần.');
      data.approvals.push({ kind:'company', revisionId:revision.id,...signature(body),at:Date.now() });
      audit(data,revision,'company-signed',account);
    } else if (body.action === 'revoke') {
      if (data.audit.some(entry => entry.revisionId === revision.id && entry.event === 'revoked')) error(409,'Link đã được thu hồi.');
      audit(data,revision,'revoked',account);
    } else error(400,'Hành động không hợp lệ.');
    return {};
  });
  return sendJson(res,200,saved);
}

function requireVersion(body) {
  if (!Number.isSafeInteger(body?._version)) error(400,'Thiếu phiên bản dữ liệu.');
}
module.exports = { cleanSheet, handlePublicReview, handleInternalReview, publicSheet, hasOption, assetNames };
