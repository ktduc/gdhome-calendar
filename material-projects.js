const notionFieldLabels = { project:'Dự án',address:'Địa chỉ',customer:'Tên khách',phone:'SĐT',email:'Email',contract:'Số hợp đồng' };

async function openNotionCustomers() {
  const selectedProject = sheet?.projectId || byId('project-filter')?.value;
  const settings = await request('/api/integrations/settings');
  const element = dialog('<h2>Lấy từ Notion</h2><form id="notion-customer-config" class="toolbar">' +
    '<label>Link database Khách hàng / Dự án <input name="db" value="' + html(settings.notionCustomerDb) + '"></label><button>Lưu link</button></form>' +
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
          !confirm('Dùng tên từ Notion trong hồ sơ và biên bản? Tên bên Lịch giữ nguyên.')) return;
      button.disabled = true;
      try {
        await flushSave();
        if (dirty || saving) throw new Error('Cần lưu bảng hiện tại trước.');
        const result = await post('/api/materials/profile',{
          _version:materials._version,projectId:selectedProject,profile,create
        });
        materials._version = result._version;
        materials.profiles ||= {};
        materials.profiles[result.project.id] = result.profile;
        if (!materials.projects.some(p => p.id === result.project.id)) materials.projects.push(result.project);
        element.close();
        if (sheet?.projectId === result.project.id) {
          sheet.meta = { ...sheet.meta,...result.profile };
          renderEditor();
        } else {
          sheet = null;
          renderMaterialApp(result.project.id);
        }
        say('Đã cập nhật hồ sơ ' + result.project.name + '.');
      } catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  byId('notion-customer-config').onsubmit = async event => {
    event.preventDefault();
    try {
      const config = await post('/api/integrations/settings',{ notionCustomerDb:event.target.elements.db.value });
      mapping = config.notionCustomerMap;
      await load();
    } catch (error) { message.textContent = error.message; }
  };
  search.onsubmit = event => { event.preventDefault(); load(); };
  if (settings.notionCustomerDb) await load();
  else message.textContent = 'Lưu link database để đọc danh sách bằng kết nối Notion của tài khoản.';
}
