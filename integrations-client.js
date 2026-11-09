window.GDHomeConnections = (() => {
  const {escape:html} = GDHomeShell;
  const endpoint = '/api/integrations/settings';
  let dialog;

  async function settings(patch,url = endpoint) {
    if (location.protocol === 'file:') throw new Error('Mở GD HOME Tools qua server để dùng Kết nối.');
    if (localStorage.getItem('gdhome_guest') === '1') throw new Error('Đăng nhập Gmail để dùng Kết nối.');
    const headers = {'Content-Type':'application/json'};
    try {
      const token = JSON.parse(localStorage.getItem('gdhome_session'))?.token;
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch { /* Password or shared mode can still be used. */ }
    const password = localStorage.getItem('gdhome_app_key');
    if (password) headers['x-app-key'] = password;
    const response = await fetch(url,patch ? {method:'POST',headers,body:JSON.stringify(patch)} : {headers});
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
      html(data.notionCustomerDb) + '" placeholder="Link database Notion"></label><button class="btn btn-outline">Lưu bảng khách hàng</button></form>' +
      '<button type="button" data-profile-map>Mở ánh xạ trường hồ sơ</button><div data-profile-map-panel></div></section>' +
      '<section data-connection-section="ai"><h3>AI</h3><p>' + html(ai.configured ? 'Đã kết nối ' + ai.providerLabel : 'Chưa kết nối AI') +
      '</p><form data-connection-form="ai"><label>Nhà cung cấp<select name="aiProvider">' +
      providers.map(provider => option(provider.id,provider.label,ai.provider)).join('') + '</select></label>' +
      '<label>API key<input type="password" name="aiKey" autocomplete="off" placeholder="' + html(aiHint) + '"></label>' +
      '<label>Model<input name="aiModel" value="' + html(ai.source === 'user' ? ai.model : '') + '" placeholder="Để trống để tự chọn"></label>' +
      '<div class="connection-actions"><button class="btn btn-primary">Lưu &amp; kiểm tra</button>' +
      '<button type="button" class="btn btn-outline" data-clear-connection="ai">Gỡ kết nối</button>' +
      '<button type="button" class="btn btn-outline" data-test-ai>Kiểm tra kết nối AI</button></div>' +
      '<p class="ai-test-result" data-ai-test-result role="status"></p></form></section>' +
      '<section data-connection-section="google"><h3>Tìm ảnh trực tuyến</h3><p>' +
      (data.imageSearch?.configured ? 'Đã kết nối' : 'Chưa kết nối') + '</p>' +
      '<form data-connection-form="google"><label>Nhà cung cấp<select name="imageSearchProvider">' +
      Object.entries(data.imageSearch?.providers || {serper:'Serper.dev',brave:'Brave Search',google:'Google CSE'}).map(([id,label]) =>
        '<option value="' + html(id) + '"' + (id === data.imageSearch?.provider ? ' selected' : '') + '>' + html(label) + '</option>').join('') +
      '</select></label><label>API key<input type="password" name="imageSearchKey" autocomplete="off" placeholder="Để trống để giữ key đã lưu"></label>' +
      '<label data-image-search-cx>Google Search Engine ID (cx)<input name="imageSearchCx" value="' + html(data.imageSearch?.cx || '') + '"></label>' +
      '<div class="connection-actions"><button class="btn btn-primary">Lưu kết nối</button>' +
      '<button type="button" class="btn btn-outline" data-clear-connection="imageSearch">Gỡ kết nối</button></div></form></section>';
    const mapButton = root.querySelector('[data-profile-map]');
    mapButton.onclick = async () => {
      const panel = root.querySelector('[data-profile-map-panel]');
      panel.textContent = 'Đang đọc cột Notion…';
      try {
        const {columns,items,map} = await settings(undefined,'/api/notion/customers?preview=1');
        const labels = {project:'Tên dự án',customer:'Tên khách hàng',address:'Địa chỉ',phone:'SĐT',email:'Email',contract:'Hợp đồng'};
        panel.innerHTML = '<form data-profile-map-form><h4>Ánh xạ trường hồ sơ</h4>' + Object.entries(labels).map(([key,label]) =>
          '<label>' + label + '<select name="' + key + '"><option value="">Tự đoán</option>' +
          columns.map(col => option(col.name,col.name + ' (' + col.type + ')',map[key])).join('') +
          '</select><small data-profile-examples></small></label>').join('') + '<button class="btn btn-primary">Lưu ánh xạ</button></form>';
        const form = panel.querySelector('form');
        for (const select of form.querySelectorAll('select')) {
          const refresh = () => { select.nextElementSibling.textContent = items.slice(0,3).map(item => item.values[select.value] || '—').join(' · '); };
          select.onchange = refresh;
          refresh();
        }
        form.onsubmit = async event => {
          event.preventDefault();
          try {
            await settings({notionCustomerMap:Object.fromEntries(new FormData(form))});
            root.querySelector('.connection-message').textContent = 'Đã lưu ánh xạ hồ sơ.';
          } catch (error) { root.querySelector('.connection-message').textContent = error.message; }
        };
      } catch (error) { panel.textContent = error.message; }
    };
    if (focus === 'notion-profile') mapButton.click();
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
    const testButton = root.querySelector('[data-test-ai]');
    if (testButton) testButton.onclick = async () => {
      const out = root.querySelector('[data-ai-test-result]');
      testButton.disabled = true;
      out.className = 'ai-test-result';
      out.textContent = 'Đang gọi thử AI…';
      try {
        const result = await testAi();
        out.classList.add(result.ok ? 'is-ok' : 'is-error');
        out.textContent = result.ok
          ? '✓ AI hoạt động · ' + result.providerLabel + ' · model ' + result.model + ' · phản hồi sau ' + (result.ms / 1000).toFixed(1) + ' giây'
          : '⚠ ' + result.message;
      } catch (error) {
        out.classList.add('is-error');
        out.textContent = '⚠ ' + error.message;
      } finally { testButton.disabled = false; }
    };
    const date = root.querySelector('[name=notionDateProp]');
    if (date) date.onchange = () => save({notionDateProp:date.value},'notion');
    if (focus) root.querySelector('[data-connection-section="' + focus + '"] :is(input,select)')?.focus();
  }

  // Gọi thử 1 câu ngắn để biết AI có chạy không, model nào và mất bao lâu.
  async function testAi() {
    const headers = {'Content-Type':'application/json'};
    try {
      const token = JSON.parse(localStorage.getItem('gdhome_session'))?.token;
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch { /* Password or shared mode can still be used. */ }
    const password = localStorage.getItem('gdhome_app_key');
    if (password) headers['x-app-key'] = password;
    const response = await fetch('/api/ai/test',{method:'POST',headers,body:'{}'});
    const result = await response.json().catch(() => ({}));
    if (!response.ok && !result.message) throw new Error('Máy chủ lỗi ' + response.status);
    return result;
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
  return {settings,open,testAi};
})();
