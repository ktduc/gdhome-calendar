// GD HOME Quản lý dự án - Client Script
(() => {
  let projects = [];
  let currentProjectId = null;
  let currentProject = null;
  let annotatedAssetKey = null;

  const byId = id => document.getElementById(id);
  const escape = s => window.GDHomeShell ? GDHomeShell.escape(s) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(msg) {
    if (window.GDHomeShell?.toast) GDHomeShell.toast(msg, byId('hub-toast'));
    else alert(msg);
  }

  function getAuthToken() {
    try {
      const sess = JSON.parse(localStorage.getItem('gdhome_session'));
      return sess?.token || '';
    } catch (e) {
      return '';
    }
  }

  function authHeaders(isJson = true) {
    const headers = {};
    if (isJson) headers['Content-Type'] = 'application/json';
    const token = getAuthToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const appKey = localStorage.getItem('gdhome_app_key');
    if (appKey) headers['x-app-key'] = appKey;
    return headers;
  }

  async function api(path, body, method = 'POST') {
    const res = await fetch(path, {
      method: body ? method : 'GET',
      headers: authHeaders(true),
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Lỗi xử lý yêu cầu.');
    return data;
  }

  async function fetchAssetBlobUrl(assetKey) {
    const res = await fetch(`/api/project-hub/assets/${encodeURIComponent(assetKey)}`, {
      headers: authHeaders(false)
    });
    if (!res.ok) throw new Error(`Không tải được tệp (${res.status})`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  window.downloadAsset = async (assetKey, downloadName) => {
    try {
      toast('Đang chuẩn bị tải tệp...');
      const blobUrl = await fetchAssetBlobUrl(assetKey);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadName || assetKey;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      toast('Lỗi tải tệp: ' + err.message);
    }
  };

  function getQueryProjectId() {
    const u = new URL(window.location.href);
    return u.searchParams.get('project') || u.searchParams.get('id');
  }

  function updateStorageWarning(storageInfo) {
    const warnEl = byId('storage-warning');
    if (!warnEl) return;
    if (storageInfo && !storageInfo.r2) {
      warnEl.style.display = 'block';
      warnEl.textContent = '⚠️ ' + (storageInfo.warning || 'Lưu tạm – sẽ mất khi server khởi động lại (chưa cấu hình Cloudflare R2)');
    } else {
      warnEl.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Khởi tạo & nạp danh sách dự án
  // ---------------------------------------------------------------------------
  async function init() {
    initTabs();
    initDropzone();
    initProfileModal();
    initReviewActions();
    initPushActions();
    initQuoteActions();
    initHeaderActions();

    byId('btn-refresh').onclick = () => loadProjects(currentProjectId);

    const queryProj = getQueryProjectId();
    await loadProjects(queryProj);
  }

  function initHeaderActions() {
    const btnNew = byId('btn-file-new-project');
    if (btnNew) btnNew.onclick = () => byId('btn-create-project').click();

    const btnUpload = byId('btn-file-upload');
    if (btnUpload) btnUpload.onclick = () => byId('file-input').click();

    const btnExport = byId('btn-file-export-pdf');
    if (btnExport) btnExport.onclick = () => byId('btn-download-annotated-pdf').click();

    const btnAiRev = byId('btn-ai-review');
    if (btnAiRev) btnAiRev.onclick = () => runReview();

    const btnMainRev = byId('btn-main-review');
    if (btnMainRev) btnMainRev.onclick = () => runReview();

    const btnCopyMatrix = byId('btn-copy-matrix');
    if (btnCopyMatrix) {
      btnCopyMatrix.onclick = () => {
        const findings = currentProject?.hub?.reviewFindings || [];
        if (!findings.length) return toast('Chưa có kết quả soát để sao chép.');
        const lines = [
          `KẾT QUẢ SOÁT BẢN VẼ HSKT & PHỐI CẢNH 3D - ${currentProject?.name || 'Dự án'}`,
          `Ngày soát: ${new Date().toLocaleDateString('vi-VN')}`,
          `Tổng số điểm lưu ý: ${findings.length}`,
          '----------------------------------------',
          ...findings.map((f, i) => `${i + 1}. [${f.severity === 'high' ? 'CAO' : 'TB'}] [${f.room}] ${f.title}\n   ${f.detail}`)
        ];
        navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Đã sao chép kết quả soát vào bộ nhớ tạm!'));
      };
    }

    const btnCopyQuote = byId('btn-copy-quote');
    if (btnCopyQuote) {
      btnCopyQuote.onclick = () => {
        const items = currentProject?.hub?.quoteItems || [];
        if (!items.length) return toast('Chưa có báo giá để sao chép.');
        const total = items.reduce((s, it) => s + (it.amount || 0), 0);
        const lines = [
          `TỔNG HỢP BÁO GIÁ - ${currentProject?.name || 'Dự án'}`,
          `Số hạng mục: ${items.length} | Tổng tiền: ${total.toLocaleString('vi-VN')} đ`,
          '----------------------------------------',
          ...items.map((it, i) => `${i + 1}. ${it.name} (${it.room}) - SL: ${it.qty} ${it.unit} - TT: ${(it.amount || 0).toLocaleString('vi-VN')} đ`)
        ];
        navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Đã sao chép tóm tắt báo giá vào bộ nhớ tạm!'));
      };
    }
  }

  async function loadProjects(preferredId) {
    try {
      const res = await api('/api/project-hub/overview', null, 'GET');
      projects = res.projects || [];
      updateStorageWarning(res.storageInfo);

      const sel = byId('project-select');
      sel.innerHTML = '';

      if (projects.length === 0) {
        sel.innerHTML = '<option value="">-- Chưa có dự án (Bấm + Tạo mới) --</option>';
        currentProjectId = null;
        renderEmptyState();
        return;
      }

      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name || 'Dự án không tên';
        sel.appendChild(opt);
      });

      const targetId = preferredId && projects.some(p => p.id === preferredId)
        ? preferredId
        : projects[0].id;

      sel.value = targetId;
      sel.onchange = () => selectProject(sel.value);
      await selectProject(targetId);
    } catch (err) {
      toast('Lỗi tải danh sách dự án: ' + err.message);
    }
  }

  async function selectProject(projectId) {
    if (!projectId) return;
    currentProjectId = projectId;
    history.replaceState(null, '', `/du-an?project=${encodeURIComponent(projectId)}`);

    try {
      const res = await api(`/api/project-hub/project?id=${encodeURIComponent(projectId)}`, null, 'GET');
      currentProject = res.project;
      updateStorageWarning(res.storageInfo);

      renderOverview(currentProject);
      renderDocuments(currentProject.hub?.documents || []);
      renderQuoteItems(currentProject.hub?.quoteItems || []);
      renderFindings(currentProject.hub?.reviewFindings || [], currentProject.hub?.reviewSummary);
      resetProposals();
    } catch (err) {
      toast('Lỗi tải chi tiết dự án: ' + err.message);
    }
  }

  function renderEmptyState() {
    byId('view-project-name').textContent = 'Chưa chọn dự án';
    byId('view-customer').textContent = '-';
    byId('view-phone').textContent = '-';
    byId('view-address').textContent = '-';
    byId('view-contract').textContent = '-';
    byId('documents-tbody').innerHTML = '<tr><td colspan="7" class="empty-cell">Chưa có dự án nào.</td></tr>';
    byId('quote-tbody').innerHTML = '<tr><td colspan="11" class="empty-cell">Chưa có dự án nào.</td></tr>';
    byId('findings-tbody').innerHTML = '<tr><td colspan="7" class="empty-cell">Chưa có dự án nào.</td></tr>';
    updateSidebarDocs([]);
  }

  function renderOverview(proj) {
    byId('view-project-name').textContent = proj.name || 'Dự án không tên';
    const prof = proj.profile || {};
    byId('view-customer').textContent = prof.customer || '-';
    byId('view-phone').textContent = prof.phone || '-';
    byId('view-address').textContent = prof.address || '-';
    byId('view-contract').textContent = prof.contract || '-';

    byId('link-to-schedule').href = `/?project=${encodeURIComponent(proj.id)}`;
    byId('link-to-materials').href = `/chot-ma?project=${encodeURIComponent(proj.id)}`;

    const stats = proj.stats || {};
    const sch = stats.schedule || {};
    byId('stat-schedule-pct').textContent = (sch.percentComplete || 0) + '%';
    byId('stat-schedule-bar').style.width = (sch.percentComplete || 0) + '%';
    byId('stat-schedule-tasks').textContent = `${sch.taskCount || 0} công việc`;
    byId('stat-schedule-end').textContent = sch.endDate ? `HT: ${sch.endDate}` : 'Chưa có lịch';

    const mat = stats.materials || {};
    byId('stat-materials-badge').textContent = `${mat.confirmedCount || 0}/${mat.totalRows || 0}`;
    byId('stat-materials-detail').textContent = `Đã chốt ${mat.confirmedCount || 0} mục`;
    byId('stat-materials-overdue').textContent = `${mat.overdueCount || 0} mục quá hạn`;
    byId('stat-materials-overdue').style.display = mat.overdueCount > 0 ? 'inline-block' : 'none';

    const hub = stats.hub || {};
    byId('stat-docs-badge').textContent = (hub.totalDocuments || 0) + ' tệp';
    byId('stat-docs-summary').textContent = `${hub.quoteDocuments || 0} báo giá · ${hub.drawingDocuments || 0} bản vẽ · ${hub.renderDocuments || 0} 3D`;
    byId('stat-docs-issues').textContent = `${hub.openIssueCount || 0} vấn đề cần xử lý`;
  }

  // ---------------------------------------------------------------------------
  // Tabs Navigation
  // ---------------------------------------------------------------------------
  function initTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = byId(tab.dataset.tab);
        if (target) target.classList.add('active');
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Hồ sơ: Upload nhị phân thô tới 60MB & Quản lý file (11.2 & Claude Review 3)
  // ---------------------------------------------------------------------------
  function initDropzone() {
    const dropzone = byId('upload-dropzone');
    const input = byId('file-input');

    dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('drag-over'); };
    dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
    dropzone.ondrop = e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    };

    input.onchange = () => {
      if (input.files?.length) handleFiles(input.files);
      input.value = '';
    };

    // Hỗ trợ Ctrl+V dán ảnh trực tiếp
    window.addEventListener('paste', e => {
      if (!currentProjectId) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            toast('Đang tải ảnh dán từ Clipboard...');
            uploadSingleFile(file, 'render');
          }
        }
      }
    });
  }

  async function handleFiles(files) {
    if (!currentProjectId) {
      toast('Vui lòng chọn hoặc tạo dự án trước khi tải hồ sơ.');
      return;
    }
    for (const file of files) {
      const type = detectDocType(file.name);
      await uploadSingleFile(file, type);
    }
    await selectProject(currentProjectId);
  }

  function detectDocType(name) {
    const lower = name.toLowerCase();
    if (/\.(xlsx|xls|csv)$/.test(lower)) return 'quote';
    if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return 'render';
    if (/\.pdf$/.test(lower)) {
      if (/bao[-_ ]?gia|quote|du[-_ ]?toan/i.test(lower)) return 'quote';
      return 'drawing';
    }
    return 'drawing';
  }

  async function uploadSingleFile(file, type) {
    try {
      const uploadUrl = `/api/project-hub/documents/upload?projectId=${encodeURIComponent(currentProjectId)}&name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(type)}&room=${encodeURIComponent('Cả nhà')}`;
      const headers = authHeaders(false);
      headers['Content-Type'] = file.type || 'application/octet-stream';

      // Gửi body thô nhị phân trực tiếp (không base64), hỗ trợ tới 60MB
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: file
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Lỗi tải tệp (${res.status})`);
      toast(`Đã tải lên: ${file.name}`);
    } catch (err) {
      toast(`Lỗi tải tệp ${file.name}: ${err.message}`);
    }
  }

  function updateSidebarDocs(docs) {
    const sumEl = byId('sidebar-doc-summary');
    if (sumEl) sumEl.textContent = `${docs.length} tài liệu`;
    const listEl = byId('sidebar-docs-list');
    if (!listEl) return;
    if (!docs.length) {
      listEl.innerHTML = '<div style="font-size: 11px; color: #94a3b8;">Chưa có tài liệu</div>';
      return;
    }
    listEl.innerHTML = docs.map(d => `
      <div class="sidebar-doc-pill" title="${escape(d.name)}">
        <span>${d.type === 'quote' ? '📋' : d.type === 'render' ? '🎨' : '📐'}</span>
        <span style="overflow: hidden; text-overflow: ellipsis;">${escape(d.name)}</span>
      </div>
    `).join('');
  }

  function renderDocuments(docs) {
    const tbody = byId('documents-tbody');
    byId('docs-count-label').textContent = `${docs.length} tài liệu`;
    updateSidebarDocs(docs);

    if (!docs.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Chưa có tài liệu nào được tải lên.</td></tr>';
      return;
    }

    const typeBadges = {
      quote: '<span class="badge badge-quote">📋 Báo giá</span>',
      drawing: '<span class="badge badge-drawing">📐 Bản vẽ HSKT</span>',
      render: '<span class="badge badge-render">🎨 Phối cảnh 3D</span>'
    };

    tbody.innerHTML = docs.map(d => {
      const sizeStr = (d.size / (1024 * 1024) >= 1)
        ? (d.size / (1024 * 1024)).toFixed(2) + ' MB'
        : (d.size / 1024).toFixed(1) + ' KB';
      const timeStr = new Date(d.uploadedAt).toLocaleString('vi-VN');
      const verBadge = `<span class="badge badge-version" title="Xem lịch sử phiên bản">v${d.version || 1}</span>`;
      return `
        <tr>
          <td>${typeBadges[d.type] || d.type}</td>
          <td><strong>${escape(d.name)}</strong></td>
          <td>${escape(d.room || 'Cả nhà')}</td>
          <td>${sizeStr}</td>
          <td>${verBadge}</td>
          <td>${timeStr}</td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.viewDoc('${d.assetKey}', '${escape(d.name)}', '${d.type}')">Xem</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.downloadAsset('${d.assetKey}', '${escape(d.name)}')">Tải</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteDoc('${d.id}')">Xoá</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.viewDoc = async (assetKey, name, type) => {
    const dialog = byId('preview-dialog');
    byId('preview-title').textContent = name;
    const body = byId('preview-body');
    body.innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b;">Đang mở tệp...</p>';
    dialog.showModal();

    try {
      const blobUrl = await fetchAssetBlobUrl(assetKey);
      if (type === 'render' || /\.(jpg|jpeg|png|webp)$/i.test(name)) {
        body.innerHTML = `<img src="${blobUrl}" alt="${escape(name)}" style="max-width: 100%; max-height: 75vh; display: block; margin: auto; object-fit: contain;">`;
      } else if (type === 'drawing' || /\.pdf$/i.test(name)) {
        body.innerHTML = `<iframe src="${blobUrl}" frameborder="0" style="width: 100%; height: 75vh;"></iframe>`;
      } else {
        body.innerHTML = `<div style="padding: 20px; text-align: center;"><p>Tệp bảng tính / báo giá.</p><button type="button" class="btn btn-primary" onclick="window.downloadAsset('${assetKey}', '${escape(name)}')">📥 Tải xuống ${escape(name)}</button></div>`;
      }
    } catch (err) {
      body.innerHTML = `<p style="padding: 20px; text-align: center; color: #b91c1c;">Lỗi: ${escape(err.message)}</p>`;
    }
  };

  window.deleteDoc = async docId => {
    if (!confirm('Bạn chắc chắn muốn xoá tài liệu này?')) return;
    try {
      await api('/api/project-hub/documents/delete', { projectId: currentProjectId, documentId: docId });
      toast('Đã xoá tài liệu.');
      await selectProject(currentProjectId);
    } catch (err) {
      toast('Lỗi xoá tài liệu: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Báo giá: Danh sách hạng mục chuẩn hoá (11.3)
  // ---------------------------------------------------------------------------
  function initQuoteActions() {
    byId('btn-parse-from-doc').onclick = async () => {
      const docs = currentProject?.hub?.documents || [];
      const quoteDoc = docs.find(d => d.type === 'quote');
      if (!quoteDoc) {
        toast('Chưa có tệp Báo giá nào trong Hồ sơ. Hãy tải lên file Excel hoặc CSV ở bước 1.');
        return;
      }
      toast('Đang đọc tệp báo giá...');
      try {
        const res = await fetch(`/api/project-hub/assets/${quoteDoc.assetKey}`, { headers: authHeaders(false) });
        const buf = await res.arrayBuffer();

        let rows = [];
        if (window.XLSX) {
          const book = window.XLSX.read(buf, { type: 'array' });
          const firstSheet = book.Sheets[book.SheetNames[0]];
          rows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        } else {
          const txt = new TextDecoder().decode(buf);
          rows = txt.split(/\r?\n/).map(l => l.split(/[,\t;]/));
        }

        const parsed = await api('/api/project-hub/quote/parse', { rows });
        renderQuoteItems(parsed.items || []);
        toast(`Đã đọc được ${parsed.items?.length || 0} hạng mục từ báo giá! Nhớ bấm Lưu để đồng bộ.`);
      } catch (err) {
        toast('Lỗi đọc file báo giá: ' + err.message);
      }
    };

    byId('btn-add-quote-item').onclick = () => {
      const tbody = byId('quote-tbody');
      const emptyRow = tbody.querySelector('.empty-row');
      if (emptyRow) tbody.innerHTML = '';

      const count = tbody.querySelectorAll('tr').length + 1;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" value="${count}" style="width: 40px;"></td>
        <td><input type="text" value="" style="width: 80px;" placeholder="Mã"></td>
        <td><input type="text" value="" style="width: 100%; min-width: 140px;" placeholder="Tên hạng mục"></td>
        <td><input type="text" value="Phòng khách" style="width: 100px;"></td>
        <td>
          <select style="width: 130px;">
            <option value="Đồ gỗ nội thất">Đồ gỗ nội thất</option>
            <option value="Phần thô & Xây trát">Phần thô & Xây trát</option>
            <option value="Điện nước (MEP)">Điện nước (MEP)</option>
            <option value="Trần & Sơn bả">Trần & Sơn bả</option>
            <option value="Ốp lát đá & gạch">Ốp lát đá & gạch</option>
            <option value="Đồ rời & Sofa/Rèm">Đồ rời & Sofa/Rèm</option>
            <option value="Thiết bị & Phụ kiện">Thiết bị & Phụ kiện</option>
            <option value="Nhôm kính & Cửa">Nhôm kính & Cửa</option>
          </select>
        </td>
        <td><input type="text" value="" style="width: 100%; min-width: 120px;" placeholder="Quy cách"></td>
        <td><input type="number" step="any" value="1" style="width: 60px;"></td>
        <td><input type="text" value="bộ" style="width: 50px;"></td>
        <td><input type="number" step="any" value="0" style="width: 80px;"></td>
        <td><input type="number" step="any" value="0" style="width: 90px;"></td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">×</button>
        </td>
      `;
      tbody.appendChild(tr);
    };

    byId('btn-save-quote-items').onclick = async () => {
      if (!currentProjectId) return;
      const trs = byId('quote-tbody').querySelectorAll('tr');
      const items = [];
      trs.forEach(tr => {
        const inputs = tr.querySelectorAll('input, select');
        if (inputs.length < 10) return;
        const name = inputs[2].value.trim();
        if (!name) return;
        items.push({
          id: tr.dataset.id || undefined,
          stt: inputs[0].value.trim(),
          code: inputs[1].value.trim(),
          name,
          room: inputs[3].value.trim() || 'Cả nhà',
          category: inputs[4].value,
          spec: inputs[5].value.trim(),
          qty: parseFloat(inputs[6].value) || 1,
          unit: inputs[7].value.trim() || 'bộ',
          unitPrice: parseFloat(inputs[8].value) || 0,
          amount: parseFloat(inputs[9].value) || 0
        });
      });

      try {
        await api('/api/project-hub/quote/save', { projectId: currentProjectId, items });
        toast('Đã lưu bảng báo giá thành công!');
        await selectProject(currentProjectId);
      } catch (err) {
        toast('Lỗi lưu báo giá: ' + err.message);
      }
    };
  }

  function renderQuoteItems(items) {
    const tbody = byId('quote-tbody');
    if (!items.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="11" class="empty-cell">Chưa có danh sách hạng mục. Bấm "Đọc từ Báo giá đã tải" hoặc "+ Thêm dòng mới".</td></tr>';
      return;
    }

    tbody.innerHTML = items.map((it, idx) => `
      <tr data-id="${it.id}">
        <td><input type="text" value="${escape(it.stt || idx + 1)}" style="width: 40px;"></td>
        <td><input type="text" value="${escape(it.code || '')}" style="width: 80px;"></td>
        <td><input type="text" value="${escape(it.name || '')}" style="width: 100%; min-width: 140px;"></td>
        <td><input type="text" value="${escape(it.room || 'Cả nhà')}" style="width: 100px;"></td>
        <td>
          <select style="width: 130px;">
            <option value="Đồ gỗ nội thất" ${it.category === 'Đồ gỗ nội thất' ? 'selected' : ''}>Đồ gỗ nội thất</option>
            <option value="Phần thô & Xây trát" ${it.category === 'Phần thô & Xây trát' ? 'selected' : ''}>Phần thô & Xây trát</option>
            <option value="Điện nước (MEP)" ${it.category === 'Điện nước (MEP)' ? 'selected' : ''}>Điện nước (MEP)</option>
            <option value="Trần & Sơn bả" ${it.category === 'Trần & Sơn bả' ? 'selected' : ''}>Trần & Sơn bả</option>
            <option value="Ốp lát đá & gạch" ${it.category === 'Ốp lát đá & gạch' ? 'selected' : ''}>Ốp lát đá & gạch</option>
            <option value="Đồ rời & Sofa/Rèm" ${it.category === 'Đồ rời & Sofa/Rèm' ? 'selected' : ''}>Đồ rời & Sofa/Rèm</option>
            <option value="Thiết bị & Phụ kiện" ${it.category === 'Thiết bị & Phụ kiện' ? 'selected' : ''}>Thiết bị & Phụ kiện</option>
            <option value="Nhôm kính & Cửa" ${it.category === 'Nhôm kính & Cửa' ? 'selected' : ''}>Nhôm kính & Cửa</option>
          </select>
        </td>
        <td><input type="text" value="${escape(it.spec || '')}" style="width: 100%; min-width: 120px;"></td>
        <td><input type="number" step="any" value="${it.qty || 1}" style="width: 60px;"></td>
        <td><input type="text" value="${escape(it.unit || 'bộ')}" style="width: 50px;"></td>
        <td><input type="number" step="any" value="${it.unitPrice || 0}" style="width: 80px;"></td>
        <td><input type="number" step="any" value="${it.amount || 0}" style="width: 90px;"></td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">×</button>
        </td>
      </tr>
    `).join('');
  }

  // ---------------------------------------------------------------------------
  // Soát HSKT & Phối cảnh 3D qua AI thật (11.4 & Claude Review 1)
  // ---------------------------------------------------------------------------
  async function runReview() {
    if (!currentProjectId) {
      toast('Vui lòng chọn hoặc tạo dự án trước.');
      return;
    }
    const noticeId = 'ai-review-notice';
    if (window.GDHomeShell?.aiNotice) {
      GDHomeShell.aiNotice(noticeId, {
        state: 'running',
        body: 'Đang gửi hồ sơ bản vẽ HSKT & phối cảnh 3D cho AI phân tích...',
        label: 'Soát bản vẽ'
      });
    }
    toast('Đang gửi hồ sơ cho AI phân tích...');

    try {
      const res = await api('/api/project-hub/review/run', { projectId: currentProjectId });
      renderFindings(res.findings || [], res.summary);
      if (res.summary?.annotatedAssetKey) {
        annotatedAssetKey = res.summary.annotatedAssetKey;
        const btnFile = byId('btn-file-export-pdf');
        if (btnFile) btnFile.disabled = false;
        const btnTab = byId('btn-download-annotated-pdf');
        if (btnTab) btnTab.disabled = false;
      }
      toast(`Đã soát xong! Phát hiện ${res.findings?.length || 0} điểm lưu ý.`);
      if (window.GDHomeShell?.aiNotice) {
        GDHomeShell.aiNotice(noticeId, {
          state: 'done',
          body: `Đã hoàn tất soát bản vẽ: ${res.findings?.length || 0} điểm lưu ý.`,
          label: 'Xem kết quả',
          onAction: () => {
            const tabBtn = document.querySelector('[data-tab="tab-review"]');
            if (tabBtn) tabBtn.click();
          }
        });
      }
      await selectProject(currentProjectId);
    } catch (err) {
      toast('Lỗi khi soát bản vẽ: ' + err.message);
      if (window.GDHomeShell?.aiNotice) {
        GDHomeShell.aiNotice(noticeId, {
          state: 'error',
          body: err.message,
          label: 'Thử lại',
          onAction: () => runReview()
        });
      }
    }
  }

  function initReviewActions() {
    byId('btn-run-review').onclick = () => runReview();

    byId('btn-download-annotated-pdf').onclick = () => {
      if (!annotatedAssetKey) return;
      const projName = currentProject?.name || 'du-an';
      window.downloadAsset(annotatedAssetKey, `GDHOME-Bao-Cao-Soat-${projName}.pdf`);
    };
  }

  function renderFindings(findings, summary) {
    const tbody = byId('findings-tbody');
    annotatedAssetKey = summary?.annotatedAssetKey || null;
    byId('btn-download-annotated-pdf').disabled = !annotatedAssetKey;
    const btnFileExport = byId('btn-file-export-pdf');
    if (btnFileExport) btnFileExport.disabled = !annotatedAssetKey;

    const highCount = findings.filter(f => f.severity === 'high').length;
    const medCount = findings.filter(f => f.severity === 'medium').length;
    const okCount = (currentProject?.hub?.quoteItems?.length || 0) - highCount - medCount;

    byId('badge-count-high').textContent = `${highCount} thiếu bản vẽ / sai lệch`;
    byId('badge-count-med').textContent = `${medCount} thiếu phối cảnh 3D`;
    byId('badge-count-ok').textContent = `${Math.max(0, okCount)} hợp lệ`;

    if (!findings.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Chưa có phát hiện nào. Hãy bấm "🚀 Chạy Soát Bằng AI" để đối chiếu bản vẽ & 3D.</td></tr>';
      return;
    }

    const sevLabels = {
      high: '<span class="badge badge-high">⚠️ Cao</span>',
      medium: '<span class="badge badge-med">⚡ Trung bình</span>',
      low: '<span class="badge">ℹ Thấp</span>'
    };

    tbody.innerHTML = findings.map(f => `
      <tr data-finding-id="${f.id}">
        <td>${sevLabels[f.severity] || f.severity}</td>
        <td><strong>${escape(f.room || 'Cả nhà')}</strong></td>
        <td>${escape(f.title)}</td>
        <td style="font-size: 13px; color: #334155;">${escape(f.detail)}</td>
        <td style="text-align: center;">Trang ${f.pageNumber || 1}</td>
        <td>
          <select class="form-select form-select-sm" onchange="window.updateFindingStatus('${f.id}', this.value)">
            <option value="open" ${f.status === 'open' ? 'selected' : ''}>Chưa xử lý</option>
            <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>Đã xử lý</option>
            <option value="ignored" ${f.status === 'ignored' ? 'selected' : ''}>Bỏ qua</option>
          </select>
        </td>
        <td>
          <input type="text" value="${escape(f.note || '')}" placeholder="Ghi chú phản hồi..." style="width: 100%; font-size: 12px;" onblur="window.updateFindingNote('${f.id}', this.value)">
        </td>
      </tr>
    `).join('');
  }

  window.updateFindingStatus = async (id, status) => {
    try {
      await api('/api/project-hub/review/update', { projectId: currentProjectId, findingId: id, status });
      toast('Đã cập nhật trạng thái.');
    } catch (err) {
      toast('Lỗi cập nhật: ' + err.message);
    }
  };

  window.updateFindingNote = async (id, note) => {
    try {
      await api('/api/project-hub/review/update', { projectId: currentProjectId, findingId: id, note });
    } catch (err) {
      toast('Lỗi lưu ghi chú: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Đề xuất 2 chiều: Tiến độ & Chốt mã (11.5)
  // ---------------------------------------------------------------------------
  function initPushActions() {
    byId('btn-preview-schedule').onclick = async () => {
      if (!currentProjectId) return;
      try {
        const res = await api('/api/project-hub/push/schedule', { projectId: currentProjectId, apply: false });
        renderScheduleProposal(res.proposal);
        byId('btn-apply-schedule').disabled = false;
      } catch (err) {
        toast('Lỗi tạo đề xuất tiến độ: ' + err.message);
      }
    };

    byId('btn-apply-schedule').onclick = async () => {
      if (!currentProjectId) return;
      if (!confirm('Đẩy danh sách công việc này vào Lịch Tiến Độ của dự án?')) return;
      try {
        await api('/api/project-hub/push/schedule', { projectId: currentProjectId, apply: true });
        toast('Đã đẩy thành công sang Tiến độ thi công!');
        byId('btn-apply-schedule').disabled = true;
        await selectProject(currentProjectId);
      } catch (err) {
        toast('Lỗi đẩy sang tiến độ: ' + err.message);
      }
    };

    byId('btn-preview-materials').onclick = async () => {
      if (!currentProjectId) return;
      try {
        const res = await api('/api/project-hub/push/materials', { projectId: currentProjectId, apply: false });
        renderMaterialsProposal(res.proposal);
        byId('btn-apply-materials').disabled = false;
      } catch (err) {
        toast('Lỗi tạo đề xuất vật liệu: ' + err.message);
      }
    };

    byId('btn-apply-materials').onclick = async () => {
      if (!currentProjectId) return;
      if (!confirm('Tạo bảng Chốt mã vật liệu mới cho dự án này từ các nhóm đã đề xuất?')) return;
      try {
        await api('/api/project-hub/push/materials', { projectId: currentProjectId, apply: true });
        toast('Đã đẩy thành công sang Chốt mã vật liệu!');
        byId('btn-apply-materials').disabled = true;
        await selectProject(currentProjectId);
      } catch (err) {
        toast('Lỗi đẩy sang chốt mã: ' + err.message);
      }
    };
  }

  function resetProposals() {
    byId('schedule-proposal-list').innerHTML = '<p class="empty-cell">Bấm "Xem trước đề xuất tiến độ" để tạo danh sách công việc.</p>';
    byId('btn-apply-schedule').disabled = true;
    byId('materials-proposal-list').innerHTML = '<p class="empty-cell">Bấm "Xem trước đề xuất vật liệu" để lọc và nhóm danh mục.</p>';
    byId('btn-apply-materials').disabled = true;
  }

  function renderScheduleProposal(proposal) {
    const list = byId('schedule-proposal-list');
    const tasks = proposal?.tasks || [];
    if (!tasks.length) {
      list.innerHTML = '<p class="empty-cell">Không có công việc nào được tạo.</p>';
      return;
    }

    list.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: 600; color: #1e3a8a;">Giai đoạn: ${escape(proposal.calendar?.name)}</div>
      <table class="data-table" style="font-size: 13px;">
        <thead>
          <tr>
            <th style="width: 40px;">STT</th>
            <th>Tên công việc</th>
            <th style="width: 90px;">Bắt đầu</th>
            <th style="width: 90px;">Kết thúc</th>
            <th style="width: 80px;">Liên kết</th>
            <th style="width: 90px;">Hạng mục gắn</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map((t, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${escape(t.title)}</strong></td>
              <td>${t.startDate}</td>
              <td>${t.endDate}</td>
              <td>${t.linkType ? `<span class="badge">${t.linkType}</span>` : '-'}</td>
              <td>${(t.sourceQuoteItemIds || []).length} mục</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderMaterialsProposal(proposal) {
    const list = byId('materials-proposal-list');
    const groups = proposal?.groups || [];
    if (!groups.length) {
      list.innerHTML = '<p class="empty-cell">Không có nhóm vật liệu nào được tạo.</p>';
      return;
    }

    list.innerHTML = groups.map(g => `
      <div class="proposal-group-box">
        <h4>🏷 ${escape(g.name)} (${g.rows.length} dòng)</h4>
        <ul class="proposal-items-list">
          ${g.rows.map(r => `<li><strong>${escape(r.name)}</strong> (${escape(r.room)}) - KL: ${r.qty} ${escape(r.unit)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }

  // ---------------------------------------------------------------------------
  // Profile modal: Tạo & Sửa dự án
  // ---------------------------------------------------------------------------
  function initProfileModal() {
    const dialog = byId('profile-dialog');
    const form = byId('profile-form');

    byId('btn-create-project').onclick = () => {
      byId('profile-dialog-title').textContent = 'Tạo dự án mới';
      form.reset();
      form.dataset.mode = 'create';
      dialog.showModal();
    };

    byId('btn-edit-profile').onclick = () => {
      if (!currentProject) return;
      byId('profile-dialog-title').textContent = 'Sửa hồ sơ dự án';
      const prof = currentProject.profile || {};
      form.elements.project.value = currentProject.name || prof.project || '';
      form.elements.customer.value = prof.customer || '';
      form.elements.phone.value = prof.phone || '';
      form.elements.address.value = prof.address || '';
      form.elements.contract.value = prof.contract || '';
      form.dataset.mode = 'edit';
      dialog.showModal();
    };

    form.onsubmit = async e => {
      e.preventDefault();
      const isCreate = form.dataset.mode === 'create';
      const values = {
        project: form.elements.project.value.trim(),
        customer: form.elements.customer.value.trim(),
        phone: form.elements.phone.value.trim(),
        address: form.elements.address.value.trim(),
        contract: form.elements.contract.value.trim()
      };

      try {
        const payload = {
          create: isCreate,
          projectId: isCreate ? undefined : currentProjectId,
          profile: values
        };
        const res = await api('/api/project-hub/project', payload);
        dialog.close();
        toast(isCreate ? 'Đã tạo dự án thành công!' : 'Đã cập nhật hồ sơ!');
        await loadProjects(res.project?.id);
      } catch (err) {
        toast('Lỗi lưu dự án: ' + err.message);
      }
    };
  }

  // Chạy khi trang sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
