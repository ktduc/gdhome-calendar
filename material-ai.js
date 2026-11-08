const aiJob = { files:[],running:false,plan:null,error:'' };
const materialAiFields = { group:'Nhóm',name:'Hạng mục',room:'Vị trí',qty:'KL',unit:'Đơn vị',spec:'Quy cách',note:'Ghi chú' };

function installMaterialsAi() {
  const target = byId('ai-actions');
  target.innerHTML = '<button id="material-ai" class="btn btn-outline" data-header-command="ai">' + headerIcon('sparkles') + '<span class="btn-label">AI</span></button>';
  byId('material-ai').onclick = () => {
    if (aiJob.plan) return reviewMaterialsAi();
    if (aiJob.running) return renderMaterialsAiNotice();
    openMaterialsAi().catch(showError);
  };
}

function renderMaterialsAiNotice() {
  let panel = byId('material-ai-job');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'material-ai-job';
    panel.className = 'material-ai-job';
    panel.setAttribute('aria-live','polite');
    document.body.append(panel);
  }
  panel.innerHTML = '<strong>AI chốt mã</strong><div>' +
    html(aiJob.running ? 'Đang đọc tài liệu và đề xuất hạng mục…' : aiJob.error || 'Đã có đề xuất để duyệt.') + '</div>' +
    (aiJob.running ? '' : '<button id="material-ai-job-open">' + (aiJob.plan ? 'Duyệt đề xuất' : 'Thử lại') +
      '</button> <button id="material-ai-job-hide">Ẩn</button>');
  if (!aiJob.running) {
    byId('material-ai-job-open').onclick = () => aiJob.plan ? reviewMaterialsAi() : openMaterialsAi().catch(showError);
    byId('material-ai-job-hide').onclick = () => panel.remove();
  }
}

async function openMaterialsAi() {
  const settings = await request('/api/integrations/settings');
  const element = dialog('<h2>AI đề xuất hạng mục chốt mã</h2><p>Chọn hợp đồng, báo giá hoặc bảng khối lượng để gửi tới AI của tài khoản.</p>' +
    '<details' + (settings.ai.configured ? '' : ' open') + '><summary>Kết nối AI · ' + html(settings.ai.providerLabel || 'Chưa cấu hình') + '</summary>' +
    '<form id="material-ai-config" class="toolbar"><label>Nhà cung cấp <select name="provider">' +
    settings.providers.map(p => option(p.id,p.label,settings.ai.provider)).join('') + '</select></label>' +
    '<label>API key <input name="key" type="password" autocomplete="off"></label><label>Model <input name="model" value="' + html(settings.ai.model) +
    '" placeholder="Tự chọn"></label><button>Lưu kết nối</button></form></details>' +
    '<form id="material-ai-form" class="stack"><div class="material-ai-drop" tabindex="0">Kéo PDF, Excel, CSV hoặc ảnh vào đây. Có thể dán ảnh bằng Ctrl+V.' +
    '<label>Chọn tệp <input id="material-ai-files" type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" multiple></label></div>' +
    '<div id="material-ai-file-list"></div><label>Ghi chú<textarea id="material-ai-notes" maxlength="4000">' + html(aiJob.notes) + '</textarea></label>' +
    '<p id="material-ai-message" role="status"></p><button class="primary">Gửi AI đề xuất</button></form>');
  const message = byId('material-ai-message');
  const drop = element.querySelector('.material-ai-drop');
  const list = byId('material-ai-file-list');
  const renderFiles = () => {
    list.innerHTML = aiJob.files.map((file,index) => '<button type="button" data-ai-remove="' + index + '" title="Bỏ tệp">' + html(file.name) + ' ×</button>').join(' ');
  };
  function add(files) {
    const valid = [...files].filter(file => file.type.startsWith('image/') || /\.(pdf|xlsx|xls|csv)$/i.test(file.name));
    aiJob.files = [...aiJob.files,...valid].slice(0,8);
    message.textContent = valid.length ? '' : 'Chọn PDF, Excel, CSV hoặc ảnh.';
    renderFiles();
  }
  byId('material-ai-files').onchange = event => { add(event.target.files); event.target.value = ''; };
  drop.ondragover = event => event.preventDefault();
  drop.ondrop = event => { event.preventDefault(); add(event.dataTransfer.files); };
  element.onpaste = event => {
    if (!byId('material-ai-form') || !event.clipboardData.files.length) return;
    event.preventDefault();
    add(event.clipboardData.files);
  };
  list.onclick = event => {
    if (event.target.dataset.aiRemove === undefined) return;
    aiJob.files.splice(Number(event.target.dataset.aiRemove),1);
    renderFiles();
  };
  byId('material-ai-config').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    try {
      const config = await post('/api/integrations/settings',{
        aiProvider:form.elements.provider.value,aiKey:form.elements.key.value,aiModel:form.elements.model.value
      });
      form.elements.key.value = '';
      form.closest('details').querySelector('summary').textContent = 'Kết nối AI · ' + config.ai.providerLabel;
      message.textContent = 'Đã lưu kết nối AI.';
    } catch (error) { message.textContent = error.message; }
  };
  byId('material-ai-form').onsubmit = event => {
    event.preventDefault();
    aiJob.notes = byId('material-ai-notes').value.trim();
    if (!aiJob.files.length && !aiJob.notes) { message.textContent = 'Chọn tài liệu hoặc nhập khối lượng trước.'; return; }
    aiJob.projectId = sheet?.projectId || byId('project-filter')?.value;
    element.close();
    runMaterialsAi();
  };
  renderFiles();
}

async function materialAiPayload(files,notes) {
  const images = [],pdfs = [],sheets = [];
  for (const file of files) {
    if (file.size > 12*1024*1024) throw new Error(file.name + ' vượt 12 MB.');
    if (file.type.startsWith('image/')) {
      if (images.length >= 6) throw new Error('Mỗi lượt gửi tối đa 6 ảnh.');
      images.push({ mediaType:'image/webp',data:await encodeImage(file,1568,220000) });
    } else if (/\.pdf$/i.test(file.name)) {
      if (pdfs.length >= 2) throw new Error('Mỗi lượt gửi tối đa 2 PDF.');
      const data = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Không đọc được ' + file.name));
        reader.readAsDataURL(file);
      });
      pdfs.push({ data });
    } else if (/\.csv$/i.test(file.name)) {
      sheets.push(file.name + '\n' + await file.text());
    } else {
      const XLSX = await loadXlsx();
      const book = XLSX.read(await file.arrayBuffer());
      for (const name of book.SheetNames) sheets.push(file.name + ' / ' + name + '\n' + XLSX.utils.sheet_to_csv(book.Sheets[name],{blankrows:false}));
    }
  }
  const sheetText = sheets.join('\n\n');
  if (sheetText.length > 60000) throw new Error('Bảng tính vượt 60.000 ký tự. Tách theo nhóm rồi gửi từng lượt.');
  const payload = { images,pdfs,sheetText,notes };
  if (new Blob([JSON.stringify(payload)]).size > 9*1024*1024) throw new Error('Tổng tài liệu quá lớn. Chia PDF hoặc gửi từng lượt.');
  return payload;
}

async function runMaterialsAi() {
  if (aiJob.running) return;
  aiJob.running = true;
  aiJob.error = '';
  aiJob.plan = null;
  renderMaterialsAiNotice();
  try {
    const payload = await materialAiPayload(aiJob.files,aiJob.notes);
    aiJob.plan = (await post('/api/ai/materials',payload)).plan;
  } catch (error) { aiJob.error = error.message; }
  finally { aiJob.running = false; renderMaterialsAiNotice(); }
}

function reviewMaterialsAi() {
  const {plan} = aiJob;
  const rows = plan.groups.flatMap(group => group.rows.map(row => ({ group:group.name,...row })));
  const element = dialog('<h2>Duyệt hạng mục do AI đề xuất</h2><p>' + html(plan.model) + '</p>' +
    (plan.questions.length ? '<ul>' + plan.questions.map(q => '<li>' + html(q) + '</li>').join('') + '</ul>' : '') +
    (rows.length ? '' : '<p>AI chưa tìm thấy hạng mục cần chốt trong tài liệu.</p>') +
    '<form id="material-ai-review"><div class="ai-review-scroll"><table class="print-table"><thead><tr><th>Chọn</th>' +
    Object.values(materialAiFields).map(label => '<th>' + label + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((row,index) => '<tr data-ai-row><td><input type="checkbox" aria-label="Chọn dòng ' + (index+1) + '" checked></td>' +
      Object.entries(materialAiFields).map(([key,label]) => '<td><input name="' + key + '" value="' + html(row[key]) + '" aria-label="' + label + '"></td>').join('') +
      '</tr>').join('') + '</tbody></table></div><div class="toolbar">' +
    '<label>Cách thêm <select name="target">' + (sheet ? '<option value="merge">Gộp vào ' + html(sheet.title) + '</option>' : '') +
    '<option value="new">Tạo bảng mới</option></select></label><label>Dự án của bảng mới <select name="project">' +
    materials.projects.map(p => option(p.id,p.name,aiJob.projectId)).join('') + '</select></label><button class="primary">Thêm dòng đã chọn</button>' +
    '<button type="button" id="material-ai-reset">Chọn tài liệu khác</button></div><p id="material-ai-review-message" role="status"></p></form>');
  byId('material-ai-reset').onclick = () => {
    aiJob.plan = null;
    byId('material-ai-job')?.remove();
    element.close();
    openMaterialsAi().catch(showError);
  };
  byId('material-ai-review').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const selected = [...form.querySelectorAll('[data-ai-row]')].filter(row => row.querySelector('input[type=checkbox]').checked)
      .map(row => Object.fromEntries([...row.querySelectorAll('input[name]')].map(field => [field.name,field.value.trim()])))
      .filter(row => row.name);
    const message = byId('material-ai-review-message');
    if (!selected.length) { message.textContent = 'Chọn ít nhất một dòng có tên hạng mục.'; return; }
    try {
      await flushSave();
      if (dirty || saving || conflict) throw new Error('Cần lưu bảng hiện tại trước.');
      const merge = form.elements.target.value === 'merge' && sheet;
      const projectId = form.elements.project.value;
      if (!merge && !projectId) throw new Error('Chọn dự án Tiến độ trước khi tạo bảng.');
      const groups = merge ? structuredClone(sheet.groups) : [];
      const added = mergeAiRows(groups,selected);
      if (!added) { message.textContent = 'Các dòng đã có trong bảng theo hạng mục và vị trí.'; return; }
      if (groups.length > 100 || groups.reduce((total,group) => total+group.rows.length,0) > 1000) throw new Error('Bảng vượt 100 nhóm hoặc 1.000 dòng.');
      aiJob.plan = null;
      aiJob.files = [];
      byId('material-ai-job')?.remove();
      element.close();
      if (merge) modify(() => { sheet.groups = groups; });
      else createSheet(projectId,'Chốt mã từ khối lượng hợp đồng',groups);
      say('Đã thêm ' + added + ' hạng mục.');
    } catch (error) { message.textContent = error.message; }
  };
}

function mergeAiRows(groups,selected) {
  const groupKey = name => normalized(name.split('(')[0]);
  let added = 0;
  for (const {group:name,...values} of selected) {
    const category = name || 'Vật liệu khác';
    const key = groupKey(category);
    let group = groups.find(g => groupKey(g.name) === key);
    if (!group) {
      group = newGroup(materialTemplate.find(([label]) => groupKey(label) === key)?.[0] || category);
      groups.push(group);
    }
    if (group.rows.some(row => normalized(row.name) === normalized(values.name) && normalized(row.room) === normalized(values.room))) continue;
    group.rows.push({ ...newRow(values.name),...values });
    added++;
  }
  return added;
}
