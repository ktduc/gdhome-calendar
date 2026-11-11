// =========================================================================
// GD HOME - WORK MANAGER (GIAO VIỆC · TỔNG HỢP NHÀ THẦU - GĐ23B)
// =========================================================================
const crypto = require('crypto');
const path = require('path');

function workStoreKey(dataKey) {
  const hash = crypto.createHash('sha256').update(String(dataKey)).digest('hex').slice(0, 16);
  return `work-v1-${hash}`;
}

function removeAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function todayStr() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

const DEFAULT_CATEGORIES = [
  'Điện nước (MEP)',
  'Sơn bả',
  'Gỗ nội thất',
  'Đá ốp lát & gạch',
  'Nhôm kính & Cửa',
  'Trần thạch cao',
  'Phần thô & Xây trát',
  'Sắt & Cơ khí',
  'Rèm & Thảm & Sofa',
  'Thiết bị & Phụ kiện',
  'Vệ sinh công nghiệp',
  'Khác'
];

const DEFAULT_STATUSES = ['Nháp', 'Đã gửi', 'Đang làm', 'Nghiệm thu', 'Xong'];

class WorkManager {
  constructor(store, dataKey) {
    this.store = store;
    this.dataKey = dataKey;
    this.key = workStoreKey(dataKey);
  }

  async getRaw() {
    const data = await this.store.get(this.key);
    if (!data || typeof data !== 'object') {
      return { _version: 1, contractors: [], assignments: [], updatedAt: new Date().toISOString() };
    }
    data.contractors ||= [];
    data.assignments ||= [];
    return data;
  }

  async saveRaw(data) {
    data._version = (data._version || 0) + 1;
    data.updatedAt = new Date().toISOString();
    await this.store.put(this.key, data);
    return data;
  }

  async listContractors({ category = '', search = '' } = {}) {
    const raw = await this.getRaw();
    let list = raw.contractors;
    if (category) {
      list = list.filter(c => (c.categories || []).includes(category));
    }
    if (search) {
      const q = removeAccents(search);
      list = list.filter(c => {
        const fullText = [
          c.name,
          c.contactPerson,
          c.phone,
          c.zalo,
          c.email,
          c.area,
          c.notes,
          (c.categories || []).join(' ')
        ].join(' ');
        return removeAccents(fullText).includes(q);
      });
    }
    return list;
  }

  async getContractor(id) {
    const raw = await this.getRaw();
    return raw.contractors.find(c => c.id === id) || null;
  }

  async saveContractor(patch) {
    const raw = await this.getRaw();
    let record;
    if (patch.id) {
      record = raw.contractors.find(c => c.id === patch.id);
    }
    if (!record) {
      record = {
        id: patch.id || crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      raw.contractors.unshift(record);
    }

    record.name = (patch.name || '').trim();
    record.categories = Array.isArray(patch.categories)
      ? patch.categories
      : (patch.categories ? [patch.categories] : (patch.category ? [patch.category] : []));
    record.contactPerson = (patch.contactPerson || '').trim();
    record.phone = (patch.phone || '').trim();
    record.zalo = (patch.zalo || '').trim();
    record.email = (patch.email || '').trim();
    record.area = (patch.area || '').trim();
    record.rating = Number(patch.rating) || 5;
    record.notes = (patch.notes || '').trim();
    record.portfolioFile = patch.portfolioFile || null;
    record.updatedAt = new Date().toISOString();

    await this.saveRaw(raw);
    return record;
  }

  async deleteContractor(id) {
    const raw = await this.getRaw();
    const idx = raw.contractors.findIndex(c => c.id === id);
    if (idx === -1) return false;
    raw.contractors.splice(idx, 1);
    await this.saveRaw(raw);
    return true;
  }

  async listAssignments({ projectId = '', contractorId = '', status = '', search = '' } = {}) {
    const raw = await this.getRaw();
    let list = raw.assignments;
    const today = todayStr();

    if (projectId) {
      list = list.filter(a => a.projectId === projectId);
    }
    if (contractorId) {
      list = list.filter(a => a.contractorId === contractorId);
    }
    if (status) {
      list = list.filter(a => a.status === status);
    }
    if (search) {
      const q = removeAccents(search);
      list = list.filter(a => {
        const fullText = [
          a.projectName,
          a.taskTitle,
          a.contractorName,
          a.category,
          a.scope,
          a.notes,
          a.status
        ].join(' ');
        return removeAccents(fullText).includes(q);
      });
    }

    return list.map(a => ({
      ...a,
      isOverdue: a.status !== 'Xong' && Boolean(a.endDate) && a.endDate < today
    }));
  }

  async getAssignment(id) {
    const raw = await this.getRaw();
    const a = raw.assignments.find(item => item.id === id);
    if (!a) return null;
    const today = todayStr();
    return {
      ...a,
      isOverdue: a.status !== 'Xong' && Boolean(a.endDate) && a.endDate < today
    };
  }

  async saveAssignment(patch) {
    const raw = await this.getRaw();
    let record;
    if (patch.id) {
      record = raw.assignments.find(a => a.id === patch.id);
    }
    if (!record) {
      record = {
        id: patch.id || crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      raw.assignments.unshift(record);
    }

    record.projectId = patch.projectId || '';
    record.projectName = (patch.projectName || '').trim();
    record.taskId = patch.taskId || '';
    record.taskTitle = (patch.taskTitle || '').trim();
    record.contractorId = patch.contractorId || '';
    record.contractorName = (patch.contractorName || '').trim();
    record.category = (patch.category || '').trim();
    record.scope = (patch.scope || '').trim();
    record.quantity = (patch.quantity || '').trim();
    record.startDate = patch.startDate || '';
    record.endDate = patch.endDate || '';
    record.status = patch.status || 'Nháp';
    record.notes = (patch.notes || '').trim();
    if (patch.pdfFile) record.pdfFile = patch.pdfFile;
    if (patch.pdfDocumentId) record.pdfDocumentId = patch.pdfDocumentId;
    if (Array.isArray(patch.documents)) record.documents = patch.documents;
    record.updatedAt = new Date().toISOString();

    await this.saveRaw(raw);

    const today = todayStr();
    return {
      ...record,
      isOverdue: record.status !== 'Xong' && Boolean(record.endDate) && record.endDate < today
    };
  }

  async deleteAssignment(id) {
    const raw = await this.getRaw();
    const idx = raw.assignments.findIndex(a => a.id === id);
    if (idx === -1) return false;
    raw.assignments.splice(idx, 1);
    await this.saveRaw(raw);
    return true;
  }
}

async function handleWorkApi(req, res, urlPath, { sendJson, readJsonBody, dataKey, store, defaultSchedule }) {
  if (!dataKey) {
    return sendJson(res, 401, { success: false, message: 'Cần đăng nhập' });
  }

  const manager = new WorkManager(store, dataKey);
  const parsedUrl = new URL(req.url, 'http://localhost');
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // 1. Overview: GET /api/work/overview
  if (urlPath === '/api/work/overview' && req.method === 'GET') {
    const contractors = await manager.listContractors();
    const assignments = await manager.listAssignments();

    // Lấy danh sách dự án và công việc từ lịch tiến độ của tài khoản này
    let schedule = {};
    try {
      schedule = (await store.get(dataKey)) || (typeof defaultSchedule === 'function' ? defaultSchedule() : {});
    } catch {}

    const projectOwners = schedule.projectOwners || [];
    const calendars = schedule.calendars || [];
    const tasks = (schedule.tasks || []).map(t => {
      const cal = calendars.find(c => c.id === t.calendarId);
      return {
        id: t.id,
        title: t.title,
        startDate: t.startDate,
        endDate: t.endDate,
        calendarId: t.calendarId,
        projectId: cal ? cal.ownerId : null,
        stage: cal ? cal.name : ''
      };
    });

    return sendJson(res, 200, {
      success: true,
      contractors,
      assignments,
      projects: projectOwners,
      tasks,
      categories: DEFAULT_CATEGORIES,
      statuses: DEFAULT_STATUSES
    });
  }

  // 2. Contractors: GET /api/work/contractors
  if (urlPath === '/api/work/contractors' && req.method === 'GET') {
    const contractors = await manager.listContractors(query);
    return sendJson(res, 200, { success: true, contractors });
  }

  // 3. Save Contractor: POST /api/work/contractors
  if (urlPath === '/api/work/contractors' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || !body.name || !body.name.trim()) {
      return sendJson(res, 400, { success: false, message: 'Tên nhà thầu là bắt buộc' });
    }
    const contractor = await manager.saveContractor(body);
    return sendJson(res, 200, { success: true, contractor });
  }

  // 4. Delete Contractor: POST /api/work/contractors/delete hoặc DELETE
  if ((urlPath === '/api/work/contractors/delete' && req.method === 'POST') ||
      (urlPath.startsWith('/api/work/contractors/') && req.method === 'DELETE')) {
    let id = query.id;
    if (!id && urlPath.startsWith('/api/work/contractors/')) {
      id = urlPath.slice('/api/work/contractors/'.length);
    }
    if (!id && req.method === 'POST') {
      const body = await readJsonBody(req);
      id = body?.id;
    }
    if (!id) return sendJson(res, 400, { success: false, message: 'Thiếu ID nhà thầu' });
    const ok = await manager.deleteContractor(id);
    return sendJson(res, 200, { success: ok });
  }

  // 5. Assignments: GET /api/work/assignments
  if (urlPath === '/api/work/assignments' && req.method === 'GET') {
    const assignments = await manager.listAssignments(query);
    return sendJson(res, 200, { success: true, assignments });
  }

  // 6. Save Assignment: POST /api/work/assignments
  if (urlPath === '/api/work/assignments' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body) return sendJson(res, 400, { success: false, message: 'Dữ liệu không hợp lệ' });
    const assignment = await manager.saveAssignment(body);
    return sendJson(res, 200, { success: true, assignment });
  }

  // 7. Delete Assignment: POST /api/work/assignments/delete hoặc DELETE
  if ((urlPath === '/api/work/assignments/delete' && req.method === 'POST') ||
      (urlPath.startsWith('/api/work/assignments/') && req.method === 'DELETE')) {
    let id = query.id;
    if (!id && urlPath.startsWith('/api/work/assignments/')) {
      id = urlPath.slice('/api/work/assignments/'.length);
    }
    if (!id && req.method === 'POST') {
      const body = await readJsonBody(req);
      id = body?.id;
    }
    if (!id) return sendJson(res, 400, { success: false, message: 'Thiếu ID phiếu giao việc' });
    const ok = await manager.deleteAssignment(id);
    return sendJson(res, 200, { success: ok });
  }

  sendJson(res, 404, { success: false, message: 'Work API endpoint not found' });
}

module.exports = {
  WorkManager,
  handleWorkApi,
  workStoreKey,
  removeAccents,
  DEFAULT_CATEGORIES,
  DEFAULT_STATUSES
};
