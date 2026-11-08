window.GDHomeConnections = (() => {
  const {escape:html} = GDHomeShell;
  const endpoint = '/api/integrations/settings';
  let dialog;

  async function settings(patch) {
    if (location.protocol === 'file:') throw new Error('Mở GD HOME Tools qua server để dùng Kết nối.');
    if (localStorage.getItem('gdhome_guest') === '1') throw new Error('Đăng nhập Gmail để dùng Kết nối.');
    const headers = {'Content-Type':'application/json'};
    try {
      const token = JSON.parse(localStorage.getItem('gdhome_session'))?.token;
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch { /* Password or shared mode can still be used. */ }
    const password = localStorage.getItem('gdhome_app_key');
    if (password) headers['x-app-key'] = password;
    const response = await fetch(endpoint,patch ? {method:'POST',headers,body:JSON.stringify(patch)} : {headers});
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không đọc được kết nối.');
    if (patch) document.dispatchEvent(new CustomEvent('gdhome:connections',{detail:result}));
    return result;
  }

  function option(value,label,selected) {
    return '<option value="' + html(value) + '"' + (value === selected ? ' selected' : '') + '>' + html(label) + '</option>';
  }

  function render(root,data,focus,message = '') {
    const {ai,notion,providers} = data;
    const tokenHint = notion.tokenMasked ? 'Mã hiện tại: ' + notion.tokenMasked : 'Mã Notion';
    const aiHint = ai.keyMasked ? 'Khoá hiện tại: ' + ai.keyMasked : 'API key';
    root.innerHTML = '<form method="dialog"><button class="close-dialog" aria-label="Đóng">×</button></form>' +
      '<h2>⚙ Kết nối</h2><p role="status" class="connection-message">' + html(message) + '</p>' +
      '<section data-connection-section="notion"><h3>Notion</h3><p>' +
      html(notion.configured ? (notion.dbTitle || 'Đã kết nối Notion') : 'Chưa kết nối lịch Notion') + '</p>' +
      '<form data-connection-form="notion"><label>Mã Notion<input type="password" name="notionToken" autocomplete="off" placeholder="' +
      html(tokenHint) + '"></label><label>Bảng lịch<input name="notionDb" value="' + html(notion.source === 'user' ? notion.db : '') +
      '" placeholder="Link database Notion"></label><div class="connection-actions"><button class="btn btn-primary">Lưu &amp; kiểm tra</button>' +
      '<button type="button" class="btn btn-outline" data-clear-connection="notion">Gỡ kết nối</button></div></form>' +
      (notion.dateProps?.length ? '<label>Cột ngày của bảng lịch<select name="notionDateProp">' +
      notion.dateProps.map(name => option(name,name,notion.dateProp)).join('') + '</select></label>' : '') +
      '<form data-connection-form="customers"><label>Bảng Khách hàng / Dự án<input name="notionCustomerDb" value="' +
      html(data.notionCustomerDb) + '" placeholder="Link database Notion"></label><button class="btn btn-outline">Lưu bảng khách hàng</button></form></section>' +
      '<section data-connection-section="ai"><h3>AI</h3><p>' + html(ai.configured ? 'Đã kết nối ' + ai.providerLabel : 'Chưa kết nối AI') +
      '</p><form data-connection-form="ai"><label>Nhà cung cấp<select name="aiProvider">' +
      providers.map(provider => option(provider.id,provider.label,ai.provider)).join('') + '</select></label>' +
      '<label>API key<input type="password" name="aiKey" autocomplete="off" placeholder="' + html(aiHint) + '"></label>' +
      '<label>Model<input name="aiModel" value="' + html(ai.source === 'user' ? ai.model : '') + '" placeholder="Để trống để tự chọn"></label>' +
      '<div class="connection-actions"><button class="btn btn-primary">Lưu &amp; kiểm tra</button>' +
      '<button type="button" class="btn btn-outline" data-clear-connection="ai">Gỡ kết nối</button></div></form></section>' +
      '<section data-connection-section="google"><h3>Tìm ảnh trực tuyến</h3><p>' +
      (data.imageSearch?.configured ? 'Đã kết nối' : 'Chưa kết nối') + '</p>' +
      '<form data-connection-form="google"><label>Nhà cung cấp<select name="imageSearchProvider">' +
      Object.entries(data.imageSearch?.providers || {serper:'Serper.dev',brave:'Brave Search',google:'Google CSE'}).map(([id,label]) =>
        '<option value="' + html(id) + '"' + (id === data.imageSearch?.provider ? ' selected' : '') + '>' + html(label) + '</option>').join('') +
      '</select></label><label>API key<input type="password" name="imageSearchKey" autocomplete="off" placeholder="Để trống để giữ key đã lưu"></label>' +
      '<label data-image-search-cx>Google Search Engine ID (cx)<input name="imageSearchCx" value="' + html(data.imageSearch?.cx || '') + '"></label>' +
      '<div class="connection-actions"><button class="btn btn-primary">Lưu kết nối</button>' +
      '<button type="button" class="btn btn-outline" data-clear-connection="imageSearch">Gỡ kết nối</button></div></form></section>';
    const provider = root.querySelector('[name=imageSearchProvider]');
    const toggleCx = () => { root.querySelector('[data-image-search-cx]').hidden = provider.value !== 'google'; };
    provider.onchange = toggleCx;
    toggleCx();
    const status = root.querySelector('.connection-message');
    async function save(patch,section) {
      const controls = [...root.querySelectorAll('input,select,button:not(.close-dialog)')];
      controls.forEach(control => { control.disabled = true; });
      status.textContent = 'Đang lưu và kiểm tra…';
      try {
        const updated = await settings(patch);
        if (root.open) render(root,updated,section,patch.clear ? 'Đã gỡ kết nối.' : 'Đã lưu kết nối.');
      } catch (error) {
        status.textContent = error.message;
        controls.forEach(control => { control.disabled = false; });
      }
    }
    root.querySelectorAll('[data-connection-form]').forEach(form => {
      form.onsubmit = event => {
        event.preventDefault();
        save(Object.fromEntries(new FormData(form)),form.dataset.connectionForm);
      };
    });
    root.querySelectorAll('[data-clear-connection]').forEach(button => {
      button.onclick = () => save({clear:button.dataset.clearConnection},button.dataset.clearConnection);
    });
    const date = root.querySelector('[name=notionDateProp]');
    if (date) date.onchange = () => save({notionDateProp:date.value},'notion');
    if (focus) root.querySelector('[data-connection-section="' + focus + '"] :is(input,select)')?.focus();
  }

  async function open(section) {
    if (dialog?.open) return;
    dialog = document.createElement('dialog');
    const root = dialog;
    root.className = 'connection-dialog';
    root.setAttribute('aria-label','Kết nối Notion và AI');
    document.body.append(root);
    GDHomeShell.dialog(root,'<h2>⚙ Kết nối</h2><p role="status">Đang tải cấu hình…</p>');
    root.addEventListener('close',() => root.remove(),{once:true});
    try {
      const data = await settings();
      if (root.open) render(root,data,section);
    } catch (error) {
      root.querySelector('[role=status]').textContent = error.message;
    }
  }

  document.addEventListener('click',event => {
    const button = event.target.closest('[data-open-connections]');
    if (!button) return;
    event.preventDefault();
    const details = button.closest('details');
    if (details) details.open = false;
    open(button.dataset.openConnections);
  });
  return {settings,open};
})();
