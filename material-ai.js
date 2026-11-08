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
  const state = aiJob.running ? 'running' : aiJob.error ? 'error' : 'done';
  GDHomeShell.aiNotice('material-ai-job',{
    state,
    body:'<strong>AI chốt mã</strong><div>' + html(aiJob.running ? 'Đang đọc tài liệu và đề xuất hạng mục…' :
      aiJob.error || 'Đã có đề xuất để duyệt.') + '</div>',
    label:aiJob.running ? '' : aiJob.plan ? 'Duyệt đề xuất' : 'Thử lại',
    onAction:() => aiJob.plan ? reviewMaterialsAi() : openMaterialsAi().catch(showError)
  });
}

async function openMaterialsAi() {
  const projectId = sheet?.projectId || byId('project-filter')?.value || '';
  const [settings,project] = await Promise.all([
    request('/api/integrations/settings'),
    projectId && !materialGuest ? request('/api/project-hub/project?id=' + encodeURIComponent(projectId)).catch(error => ({error:error.message})) : null
  ]);
  const docs = (project?.project?.hub?.documents || []).filter(doc => doc.assetKey);
  const labels = {contract:'Hợp đồng',quote:'Báo giá',quantity:'Bảng khối lượng',boq:'Bảng khối lượng',drawing:'Bản vẽ',render:'Phối cảnh'};
  const docList = project?.error ? '<p>' + html(project.error) + '</p>' : docs.length ? docs.map(doc => {
    const name = String(doc.name || '');
    const inferred = doc.type !== 'render' && /hợp đồng|hop[ _-]?dong/i.test(name) ? 'contract' :
      doc.type !== 'render' && /khối lượng|khoi[ _-]?luong|\bboq\b/i.test(name) ? 'boq' : doc.type;
    return '<label><input type="checkbox" name="documentId" value="' + html(doc.id) + '"' +
      (['contract','quote','quantity','boq'].includes(inferred) ? ' checked' : '') + '> ' + html(name) + ' · ' +
      html(labels[inferred] || 'Tài liệu') + ' · ' + Math.ceil((doc.size || 0)/1024) + ' KB</label>';
  }).join('') : '<p>Dự án chưa có tài liệu – tải lên ở <a href="/du-an?id=' + encodeURIComponent(projectId) + '">Quản lý dự án</a></p>';
  const element = dialog('<h2>AI đề xuất hạng mục chốt mã</h2><p>Chọn hợp đồng, báo giá hoặc bảng khối lượng để gửi tới AI của tài khoản.</p>' +
    '<p><button type="button" class="btn btn-outline btn-sm" data-open-connections="ai">⚙ Kết nối AI</button> ' +
    html(settings.ai.providerLabel || 'Chưa cấu hình') + '</p>' +
    '<form id="material-ai-form" class="stack"><fieldset><legend>Tài liệu của dự án</legend>' + docList + '</fieldset><div class="material-ai-drop" tabindex="0">Kéo PDF, Excel, CSV hoặc ảnh vào đây. Có thể dán ảnh bằng Ctrl+V.' +
    '<label>Chọn tệp <input id="material-ai-files" type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" multiple></label></div>' +
    '<div id="material-ai-file-list"></div><label>Ghi chú<textarea id="material-ai-notes" maxlength="4000">' + html(aiJob.notes) + '</textarea></label>' +
    '<p id="material-ai-message" role="status"></p><button type="submit" class="primary">Gửi AI đề xuất</button></form>');
  const message = byId('material-ai-message');
  const form = byId('material-ai-form');
  const notes = byId('material-ai-notes');
  const selectedDocs = () => [...form.querySelectorAll('input[name=documentId]:checked')].map(input => input.value);
  const sync = () => { form.querySelector('button[type=submit]').disabled = !(aiJob.files.length || notes.value.trim() || selectedDocs().length); };
  form.onchange = sync;
  notes.oninput = sync;
  GDHomeAI.attachments({
    state:aiJob,input:byId('material-ai-files'),drop:element.querySelector('.material-ai-drop'),
    list:byId('material-ai-file-list'),root:element,
    onChange:sync
  });
  byId('material-ai-form').onsubmit = event => {
    event.preventDefault();
    aiJob.notes = byId('material-ai-notes').value.trim();
    aiJob.documentIds = selectedDocs();
    if (!aiJob.files.length && !aiJob.notes && !aiJob.documentIds.length) { message.textContent = 'Chọn tài liệu hoặc nhập khối lượng trước.'; return; }
    aiJob.projectId = projectId;
    element.close();
    runMaterialsAi();
  };
}
function runMaterialsAi() {
  return GDHomeAI.run(aiJob,{
    onStart() { aiJob.error = ''; aiJob.plan = null; renderMaterialsAiNotice(); },
    async request() {
      const payload = await GDHomeAI.prepare(aiJob.files,aiJob.notes);
      const {plan,aiSkipped} = await post('/api/ai/materials',{...payload,projectId:aiJob.projectId,documentIds:aiJob.documentIds});
      return {...plan,aiSkipped};
    },
    onDone(plan) { aiJob.plan = plan; },
    onError(error) { aiJob.error = error.message; },
    onFinish:renderMaterialsAiNotice
  });
}

function reviewMaterialsAi() {
  const {plan} = aiJob;
  const rows = plan.groups.flatMap(group => group.rows.map(row => ({ group:group.name,...row })));
  const element = dialog('<h2>Duyệt hạng mục do AI đề xuất</h2><p>' + html(plan.model) + '</p>' +
    (plan.aiSkipped?.length ? '<p>Tài liệu bỏ qua:</p><ul>' + plan.aiSkipped.map(doc => '<li>' + html(doc.name + ': ' + doc.reason) + '</li>').join('') + '</ul>' : '') +
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
      if (merge) modify(() => {
        sheet.groups = groups;
        applyMaterialTaskLinks(materialTaskUpdates(sheet));
      });
      else createSheet(projectId,'Chốt mã từ khối lượng hợp đồng',groups);
      say('Đã thêm ' + added + ' hạng mục.');
    } catch (error) { message.textContent = error.message; }
  };
}

function mergeAiRows(groups,selected) {
  const groupKey = name => normalized(name.split('(')[0]);
  let added = 0;
  for (const {group:name,note,...values} of selected) {
    const category = name || 'Vật liệu khác';
    const key = groupKey(category);
    let group = groups.find(g => groupKey(g.name) === key);
    if (!group) {
      group = newGroup(materialTemplate.find(([label]) => groupKey(label) === key)?.[0] || category);
      groups.push(group);
    }
    if (group.rows.some(row => normalized(row.name) === normalized(values.name) && normalized(row.room) === normalized(values.room))) continue;
    group.rows.push({ ...newRow(values.name),...values,...(note ? {noteSuggestions:[note]} : {}) });
    added++;
  }
  return added;
}
