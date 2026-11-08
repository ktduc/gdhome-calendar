// GD HOME Quản lý dự án - Client Script
(() => {
  let projects = [];
  let currentProjectId = null;
  let currentProject = null;
  let annotatedAssetKey = null;

  const byId = id => document.getElementById(id);
  const escape = s => GDHomeShell ? GDHomeShell.escape(s) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(msg) {
    if (window.GDHomeShell?.toast) GDHomeShell.toast(msg, byId('hub-toast'));
    else alert(msg);
  }

  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const sess = JSON.parse(localStorage.getItem('gdhome_session'));
      if (sess?.token) headers.Authorization = 'Bearer ' + sess.token;
    } catch (e) {}
    const appKey = localStorage.getItem('gdhome_app_key');
    if (appKey) headers['x-app-key'] = appKey;
    return headers;
  }

  async function api(path, body, method = 'POST') {
    const res = await fetch(path, {
      method: body ? method : 'GET',
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Lỗi xử lý yêu cầu.');
    return data;
  }

  function getQueryProjectId() {
    const u = new URL(window.location.href);
    return u.searchParams.get('project') || u.searchParams.get('id');
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

    byId('btn-refresh').onclick = () => loadProjects(currentProjectId);

    const queryProj = getQueryProjectId();
    await loadProjects(queryProj);
  }

  async function loadProjects(preferredId) {
    try {
      const res = await api('/api/project-hub/overview', null, 'GET');
      projects = res.projects || [];
      const sel = byId('project-select');
      sel.innerHTML = '';

      if (projects.length === 0) {
        sel.innerHTML = '<option value="">-- Chưa có dự án nào (Bấm + Tạo dự án mới) --</option>';
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
  }

  function renderOverview(p) {
    const prof = p.profile || {};
    const stats = p.stats || {};
    byId('view-project-name').textContent = p.name || prof.project || 'Dự án';
    byId('view-customer').textContent = prof.customer || '-';
    byId('view-phone').textContent = prof.phone || '-';
    byId('view-address').textContent = prof.address || '-';
    byId('view-contract').textContent = prof.contract || '-';

    // Quick links
    byId('link-to-schedule').href = `/?project=${encodeURIComponent(p.id)}`;
    byId('link-to-materials').href = `/chot-ma?project=${encodeURIComponent(p.id)}`;

    // Tiến độ stats
    const sch = stats.schedule || {};
    byId('stat-schedule-pct').textContent = (sch.percentComplete || 0) + '%';
    byId('stat-schedule-bar').style.width = (sch.percentComplete || 0) + '%';
    byId('stat-schedule-tasks').textContent = (sch.taskCount || 0) + ' công việc';
    byId('stat-schedule-end').textContent = sch.endDate ? 'Xong: ' + sch.endDate : 'Chưa có lịch';

    // Chốt mã stats
    const mat = stats.materials || {};
    byId('stat-materials-badge').textContent = `${mat.confirmedRows || 0}/${mat.totalRows || 0}`;
    byId('stat-materials-detail').textContent = `Đã chốt ${mat.confirmedRows || 0} mục`;
    byId('stat-materials-overdue').textContent = `${mat.overdueCount || 0} mục quá hạn`;

    // Hồ sơ stats
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
  // Hồ sơ: Upload & Quản lý file (11.2)
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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          await api('/api/project-hub/documents/upload', {
            projectId: currentProjectId,
            name: file.name,
            type,
            mime: file.type,
            dataBase64: base64,
            room: 'Cả nhà'
          });
          toast(`Đã tải lên: ${file.name}`);
          resolve();
        } catch (err) {
          toast(`Lỗi tải tệp ${file.name}: ${err.message}`);
          resolve();
        }
      };
      reader.onerror = () => {
        toast(`Lỗi đọc tệp ${file.name}`);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderDocuments(docs) {
    const tbody = byId('documents-tbody');
    byId('docs-count-label').textContent = `${docs.length} tài liệu`;
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
      const sizeStr = (d.size / 1024).toFixed(1) + ' KB';
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
            <button class="btn btn-outline btn-sm" onclick="window.viewDoc('${d.assetKey}', '${escape(d.name)}', '${d.type}')">Xem</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteDoc('${d.id}')">Xoá</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.viewDoc = (assetKey, name, type) => {
    const dialog = byId('preview-dialog');
    byId('preview-title').textContent = name;
    const body = byId('preview-body');
    body.innerHTML = '';

    const assetUrl = `/api/project-hub/assets/${assetKey}`;
    if (type === 'render' || /\.(jpg|jpeg|png|webp)$/i.test(name)) {
      body.innerHTML = `<img src="${assetUrl}" alt="${escape(name)}">`;
    } else if (type === 'drawing' || /\.pdf$/i.test(name)) {
      body.innerHTML = `<iframe src="${assetUrl}" frameborder="0"></iframe>`;
    } else {
      body.innerHTML = `<p>Tệp báo giá: <a href="${assetUrl}?download=${encodeURIComponent(name)}" class="btn btn-primary">Tải xuống ${escape(name)}</a></p>`;
    }
    dialog.showModal();
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
        const res = await fetch(`/api/project-hub/assets/${quoteDoc.assetKey}`);
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
        toast(`Đã trích xuất thành công ${parsed.items?.length || 0} hạng mục! Hãy bấm "Lưu Bảng Báo Giá".`);
      } catch (err) {
        toast('Lỗi đọc báo giá: ' + err.message);
      }
    };

    byId('btn-add-quote-item').onclick = () => {
      const items = collectQuoteItemsFromTable();
      items.push({
        id: 'qi_' + Date.now(),
        stt: String(items.length + 1),
        code: '',
        name: 'Hạng mục mới',
        room: 'Phòng khách',
        category: 'Đồ gỗ nội thất',
        spec: '',
        qty: 1,
        unit: 'bộ',
        unitPrice: 0,
        amount: 0
      });
      renderQuoteItems(items);
    };

    byId('btn-save-quote-items').onclick = async () => {
      const items = collectQuoteItemsFromTable();
      try {
        await api('/api/project-hub/quote/save', { projectId: currentProjectId, items });
        toast('Đã lưu bảng báo giá thành công!');
        await selectProject(currentProjectId);
      } catch (err) {
        toast('Lỗi lưu báo giá: ' + err.message);
      }
    };
  }

  function collectQuoteItemsFromTable() {
    const rows = document.querySelectorAll('#quote-tbody tr:not(.empty-row)');
    const items = [];
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input, select');
      if (inputs.length) {
        items.push({
          id: tr.dataset.id || 'qi_' + Math.random(),
          stt: inputs[0].value,
          code: inputs[1].value,
          name: inputs[2].value,
          room: inputs[3].value,
          category: inputs[4].value,
          spec: inputs[5].value,
          qty: parseFloat(inputs[6].value) || 1,
          unit: inputs[7].value,
          unitPrice: parseFloat(inputs[8].value) || 0,
          amount: parseFloat(inputs[9].value) || 0
        });
      }
    });
    return items;
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
  // Soát HSKT & Phối cảnh 3D + Ghi chú PDF (11.4)
  // ---------------------------------------------------------------------------
  function initReviewActions() {
    byId('btn-run-review').onclick = async () => {
      if (!currentProjectId) return;
      toast('Đang đối chiếu hạng mục báo giá với bản vẽ HSKT & phối cảnh 3D...');
      try {
        const res = await api('/api/project-hub/review/run', { projectId: currentProjectId });
        renderFindings(res.findings || [], res.summary);
        toast(`Đã soát xong! Phát hiện ${res.findings?.length || 0} điểm lưu ý.`);
      } catch (err) {
        toast('Lỗi khi soát bản vẽ: ' + err.message);
      }
    };

    byId('btn-download-annotated-pdf').onclick = () => {
      if (!annotatedAssetKey) return;
      const projName = currentProject?.name || 'du-an';
      window.open(`/api/project-hub/assets/${annotatedAssetKey}?download=${encodeURIComponent(projName + '-soat-hskt.pdf')}`);
    };
  }

  function renderFindings(findings, summary) {
    const tbody = byId('findings-tbody');
    annotatedAssetKey = summary?.annotatedAssetKey || null;
    byId('btn-download-annotated-pdf').disabled = !annotatedAssetKey;

    const highCount = findings.filter(f => f.severity === 'high').length;
    const medCount = findings.filter(f => f.severity === 'medium').length;
    const okCount = (currentProject?.hub?.quoteItems?.length || 0) - highCount - medCount;

    byId('badge-count-high').textContent = `${highCount} thiếu bản vẽ / sai lệch`;
    byId('badge-count-med').textContent = `${medCount} thiếu phối cảnh 3D`;
    byId('badge-count-ok').textContent = `${Math.max(0, okCount)} hạng mục đạt`;

    if (!findings.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Chưa phát hiện sai sót nào hoặc chưa chạy soát.</td></tr>';
      return;
    }

    const sevBadges = {
      high: '<span class="badge badge-high">Cao</span>',
      medium: '<span class="badge badge-med">Trung bình</span>',
      low: '<span class="badge badge-low">Thấp</span>'
    };

    tbody.innerHTML = findings.map(f => `
      <tr data-finding-id="${f.id}">
        <td>${sevBadges[f.severity] || f.severity}</td>
        <td><strong>${escape(f.room)}</strong></td>
        <td><strong>${escape(f.title)}</strong></td>
        <td>${escape(f.detail)}</td>
        <td style="text-align: center;">Trang ${f.pageNumber || 1}</td>
        <td>
          <select onchange="window.updateFindingStatus('${f.id}', this.value)">
            <option value="open" ${f.status === 'open' ? 'selected' : ''}>Chưa xử lý</option>
            <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>Đã xử lý</option>
            <option value="ignored" ${f.status === 'ignored' ? 'selected' : ''}>Bỏ qua</option>
          </select>
        </td>
        <td>
          <input type="text" value="${escape(f.note || '')}" placeholder="Nhập ghi chú KTS..."
                 onblur="window.updateFindingNote('${f.id}', this.value)" style="width: 100%;">
        </td>
      </tr>
    `).join('');
  }

  window.updateFindingStatus = async (findingId, status) => {
    try {
      await api('/api/project-hub/review/update', { projectId: currentProjectId, findingId, status });
      toast('Đã cập nhật trạng thái.');
    } catch (err) {
      toast('Lỗi cập nhật: ' + err.message);
    }
  };

  window.updateFindingNote = async (findingId, note) => {
    try {
      await api('/api/project-hub/review/update', { projectId: currentProjectId, findingId, note });
    } catch (err) {
      toast('Lỗi lưu ghi chú: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Đề xuất sang Tiến độ & Chốt mã (11.5)
  // ---------------------------------------------------------------------------
  let currentScheduleProposal = null;
  let currentMaterialsProposal = null;

  function resetProposals() {
    currentScheduleProposal = null;
    currentMaterialsProposal = null;
    byId('schedule-proposal-list').innerHTML = '<p class="empty-cell">Bấm "Xem trước đề xuất tiến độ" để tạo danh sách công việc.</p>';
    byId('materials-proposal-list').innerHTML = '<p class="empty-cell">Bấm "Xem trước đề xuất vật liệu" để lọc và nhóm danh mục.</p>';
    byId('btn-apply-schedule').disabled = true;
    byId('btn-apply-materials').disabled = true;
  }

  function initPushActions() {
    byId('btn-preview-schedule').onclick = async () => {
      try {
        const res = await api('/api/project-hub/push/schedule', { projectId: currentProjectId, apply: false });
        currentScheduleProposal = res.proposal;
        renderScheduleProposal(res.proposal);
        byId('btn-apply-schedule').disabled = false;
        toast(`Đã tạo đề xuất ${res.proposal?.tasks?.length || 0} công việc thi công!`);
      } catch (err) {
        toast('Lỗi tạo đề xuất tiến độ: ' + err.message);
      }
    };

    byId('btn-apply-schedule').onclick = async () => {
      if (!confirm('Bạn có muốn đẩy các công việc này vào bảng Lập Tiến Độ?')) return;
      try {
        await api('/api/project-hub/push/schedule', { projectId: currentProjectId, apply: true });
        toast('Đã đẩy thành công sang bảng Lập Tiến Độ!');
        await selectProject(currentProjectId);
      } catch (err) {
        toast('Lỗi đẩy tiến độ: ' + err.message);
      }
    };

    byId('btn-preview-materials').onclick = async () => {
      try {
        const res = await api('/api/project-hub/push/materials', { projectId: currentProjectId, apply: false });
        currentMaterialsProposal = res.proposal;
        renderMaterialsProposal(res.proposal);
        byId('btn-apply-materials').disabled = false;
        toast(`Đã gom thành công vào các nhóm mẫu Chốt mã!`);
      } catch (err) {
        toast('Lỗi tạo đề xuất vật liệu: ' + err.message);
      }
    };

    byId('btn-apply-materials').onclick = async () => {
      if (!confirm('Bạn có muốn tạo bảng chốt mã cho dự án từ các hạng mục này?')) return;
      try {
        await api('/api/project-hub/push/materials', { projectId: currentProjectId, apply: true });
        toast('Đã đẩy thành công sang bảng Chốt Mã Vật Liệu!');
        await selectProject(currentProjectId);
      } catch (err) {
        toast('Lỗi đẩy chốt mã: ' + err.message);
      }
    };
  }

  function renderScheduleProposal(proposal) {
    const list = byId('schedule-proposal-list');
    const tasks = proposal?.tasks || [];
    if (!tasks.length) {
      list.innerHTML = '<p class="empty-cell">Không có công việc nào được sinh ra.</p>';
      return;
    }

    list.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #0066cc;">
        Giai đoạn: ${escape(proposal.calendar?.name)} (${tasks.length} công việc có liên kết FS)
      </div>
      ${tasks.map(t => `
        <div class="proposal-item">
          <div>
            <strong>${escape(t.title)}</strong>
            <div style="font-size: 11px; color: #64748b;">${t.startDate} ➔ ${t.endDate} ${t.linkType ? `(Liên kết: ${t.linkType})` : ''}</div>
          </div>
          <span class="badge badge-quote">${t.sourceQuoteItemIds?.length || 0} mục báo giá</span>
        </div>
      `).join('')}
    `;
  }

  function renderMaterialsProposal(proposal) {
    const list = byId('materials-proposal-list');
    const groups = proposal?.groups || [];
    if (!groups.length) {
      list.innerHTML = '<p class="empty-cell">Không có hạng mục vật liệu nào.</p>';
      return;
    }

    list.innerHTML = groups.map(g => `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 600; color: #cc0000; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">
          ${escape(g.name)} (${g.rows?.length || 0} mục)
        </div>
        ${g.rows.map(r => `
          <div class="proposal-item">
            <div><strong>${escape(r.name)}</strong> (${escape(r.room)}) - <em>${escape(r.spec || 'Tiêu chuẩn')}</em></div>
            <span>${r.qty} ${escape(r.unit)}</span>
          </div>
        `).join('')}
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
