let projectSave = Promise.resolve();

function applyMaterialProjects(projects) {
  materials.projects = projects;
  for (const project of projects) if (project.profile) materials.profiles[project.id] = project.profile;
  if (!sheet) return;
  const profile = materials.profiles[sheet.projectId];
  if (!profile || projectFields.every(key => sheet.meta?.[key] === profile[key])) return;
  sheet.meta = {...sheet.meta,...profile};
  renderEditor();
}

function saveMaterialProfile(profile,{projectId = sheet?.projectId,create = false} = {}) {
  const pending = projectSave.catch(() => {}).then(async () => {
    let result;
    if (materialGuest) {
      const projects = guestMaterialProjects();
      const owner = projects.find(entry => entry.id === projectId);
      if (!owner) throw new Error('Chọn dự án trước khi lưu hồ sơ.');
      const {project:name = owner.name,...contact} = profile;
      if (!name.trim()) throw new Error('Tên dự án không được trống.');
      owner.name = name.trim();
      owner.profile = {...owner.profile,...contact};
      saveGuestProjectOwners(projects);
      result = {project:{id:owner.id,name:owner.name,profile:{...owner.profile,project:owner.name}}};
    } else {
      result = await GDHomeProjects.save({projectId,profile,create});
    }
    const projects = materials.projects.filter(project => project.id !== result.project.id);
    const index = materials.projects.findIndex(project => project.id === result.project.id);
    projects.splice(index < 0 ? projects.length : index,0,result.project);
    applyMaterialProjects(projects);
    return result;
  });
  projectSave = pending;
  return pending;
}

function refreshMaterialProjects() {
  if (!materials || materialGuest || document.querySelector('dialog[open]')) return;
  GDHomeProjects.list().then(({projects}) => {
    if (materials && !materialGuest) applyMaterialProjects(projects);
  }).catch(() => {});
}
window.addEventListener('focus',refreshMaterialProjects);
window.addEventListener('storage',event => { if (event.key === 'gdhome-project-update') refreshMaterialProjects(); });

const notionFieldLabels = { project:'Dự án',address:'Địa chỉ',customer:'Tên khách',phone:'SĐT',email:'Email',contract:'Số hợp đồng' };

async function openNotionCustomers() {
  const selectedProject = sheet?.projectId || byId('project-filter')?.value;
  const settings = await request('/api/integrations/settings');
  const element = dialog('<h2>Lấy từ Notion</h2><p><button type="button" data-open-connections="notion">⚙ Kết nối Notion</button></p>' +
    '<form id="notion-customer-search" class="toolbar"><label>Tên, địa chỉ hoặc SĐT <input name="q" type="search"></label><button>Tìm</button></form>' +
    '<p id="notion-customer-message" role="status"></p><div id="notion-customer-map"></div><div id="notion-customer-results"></div>');
  const message = byId('notion-customer-message');
  const search = byId('notion-customer-search');
  let cursor, page, sequence = 0;
  let rows = [], mapping = settings.notionCustomerMap || {};
  async function load(more = false) {
    const current = ++sequence;
    const params = new URLSearchParams({ q:search.elements.q.value });
    if (more && cursor) params.set('cursor',cursor);
    message.textContent = 'Đang lấy danh sách…';
    try {
      const result = await request('/api/notion/customers?' + params);
      if (!element.open || current !== sequence) return;
      page = result;
      cursor = result.nextCursor;
      rows = more ? [...rows,...result.items] : result.items;
      if (!more) renderMapping();
      renderResults();
      message.textContent = '';
    } catch (error) {
      if (current === sequence) message.textContent = error.message;
    }
  }
  function renderMapping() {
    const available = page.columns.map(col => col.name);
    const title = page.columns.find(col => col.type === 'title')?.name;
    const defaults = { project:title,phone:page.columns.find(col => col.type === 'phone_number')?.name,
      email:page.columns.find(col => col.type === 'email')?.name };
    mapping = Object.fromEntries(Object.keys(notionFieldLabels).map(key => [
      key,available.includes(mapping[key]) || mapping[key] === '' ? mapping[key] : defaults[key] || ''
    ]));
    const root = byId('notion-customer-map');
    root.innerHTML = '<form class="toolbar">' + Object.entries(notionFieldLabels).map(([key,label]) => '<label>' + label +
      ' <select name="' + key + '">' + option('','Bỏ qua',mapping[key]) + available.map(name => option(name,name,mapping[key])).join('') +
      '</select></label>').join('') + '<button>Lưu ghép cột</button></form>';
    root.onchange = event => { mapping[event.target.name] = event.target.value; renderResults(); };
    root.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      try {
        await post('/api/integrations/settings',{ notionCustomerMap:mapping });
        message.textContent = 'Đã lưu ghép cột.';
      } catch (error) { message.textContent = error.message; }
    };
  }
  function toProfile(row) {
    return Object.fromEntries(Object.entries(mapping).filter(([,name]) => name).map(([key,name]) => [key,row.values[name] || '']));
  }
  function renderResults() {
    const root = byId('notion-customer-results');
    root.innerHTML = rows.map((row,index) => {
      const profile = toProfile(row);
      return '<article><strong>' + html(profile.project || profile.customer || 'Dòng ' + (index+1)) + '</strong><p>' +
        html([profile.customer,profile.address,profile.phone,profile.email].filter(Boolean).join(' · ')) +
        '</p><button data-use-notion="' + index + '"' + (selectedProject ? '' : ' disabled') +
        '>Điền dự án đang chọn</button> <button data-use-notion="' + index + '" data-create-notion>Tạo dự án bên Lịch</button></article>';
    }).join('') + (rows.length ? '' : '<p>Chưa có dòng phù hợp.</p>') + (cursor ? '<button id="notion-customer-more">Tải thêm</button>' : '');
    const more = byId('notion-customer-more');
    if (more) more.onclick = () => load(true);
    root.onclick = async event => {
      const button = event.target.closest('[data-use-notion]');
      if (!button) return;
      const profile = toProfile(rows[Number(button.dataset.useNotion)]);
      const create = Object.hasOwn(button.dataset,'createNotion');
      if (!Object.keys(profile).length) { message.textContent = 'Ghép ít nhất một cột trước.'; return; }
      const calendarName = materials.projects.find(p => p.id === selectedProject)?.name;
      if (create && !profile.project?.trim()) { message.textContent = 'Ghép cột Dự án và chọn dòng có tên.'; return; }
      if (!create && profile.project && profile.project !== calendarName &&
          !confirm('Đổi tên dự án dùng chung theo tên trong Notion?')) return;
      button.disabled = true;
      try {
        await flushSave();
        if (dirty || saving) throw new Error('Cần lưu bảng hiện tại trước.');
        const result = await saveMaterialProfile(profile,{projectId:selectedProject,create});
        if (element.open) element.close();
        if (sheet?.projectId !== result.project.id) {
          sheet = null;
          setMaterialView({projectId:result.project.id,sheetId:null});
          renderMaterialApp(result.project.id);
        }
        say('Đã cập nhật hồ sơ ' + result.project.name + '.');
      } catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  const onSettings = event => {
    if (!element.open) return;
    mapping = event.detail.notionCustomerMap || {};
    if (event.detail.notionCustomerDb) load();
  };
  document.addEventListener('gdhome:connections',onSettings);
  element.addEventListener('close',() => document.removeEventListener('gdhome:connections',onSettings),{once:true});
  search.onsubmit = event => { event.preventDefault(); load(); };
  if (settings.notionCustomerDb) await load();
  else message.textContent = 'Mở Kết nối Notion để chọn bảng Khách hàng / Dự án.';
}
