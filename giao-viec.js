// =========================================================================
// GD HOME - GIAO VIỆC · TỔNG HỢP NHÀ THẦU (CLIENT - GĐ23B)
// =========================================================================
(() => {
  let state = {
    contractors: [],
    assignments: [],
    projects: [],
    tasks: [],
    categories: [],
    statuses: [],
    filterProject: '',
    filterCategory: '',
    filterStatus: '',
    searchAssignments: '',
    searchContractors: '',
    activeTab: 'assignments',
    // PDF Builder state
    pdfSourceBytes: null,
    pdfPages: [], // array of { pageIndex, selected, thumbUrl }
    currentAssignmentForPdf: null
  };

  const byId = id => document.getElementById(id);
  const escape = str => GDHomeShell?.escape ? GDHomeShell.escape(str) : String(str ?? '');
  const toast = msg => GDHomeShell?.toast ? GDHomeShell.toast(msg, byId('work-toast')) : alert(msg);

  function getHeaders() {
    return GDHomeShell?.authHeaders ? GDHomeShell.authHeaders() : { 'Content-Type': 'application/json' };
  }

  function todayStr() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  }

  function toAscii(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^\x00-\x7F]/g, ' ')
      .trim();
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

  // -------------------------------------------------------------------------
  // 1. TẢI DỮ LIỆU TỪ SERVER
  // -------------------------------------------------------------------------
  async function loadData() {
    try {
      GDHomeShell?.saveStatus(byId('save-status'), 'saving');
      const res = await fetch('/api/work/overview', { headers: getHeaders() });
      if (!res.ok) {
        if (res.status === 401) {
          GDHomeShell?.saveStatus(byId('save-status'), 'offline', 'Chế độ khách');
          return;
        }
        throw new Error('Không tải được dữ liệu máy chủ');
      }
      const data = await res.json();
      state.contractors = data.contractors || [];
      state.assignments = data.assignments || [];
      state.projects = data.projects || [];
      state.tasks = data.tasks || [];
      state.categories = data.categories || [];
      state.statuses = data.statuses || [];

      // Kiểm tra URL query params
      const urlParams = new URLSearchParams(location.search);
      if (urlParams.get('project')) {
        state.filterProject = urlParams.get('project');
      }

      renderSidebar();
      renderAssignments();
      renderContractors();
      GDHomeShell?.saveStatus(byId('save-status'), 'saved');
    } catch (err) {
      console.error(err);
      GDHomeShell?.saveStatus(byId('save-status'), 'error', err.message);
      toast('Lỗi kết nối máy chủ: ' + err.message);
    }
  }

  // -------------------------------------------------------------------------
  // 2. RENDER SIDEBAR & FILTERS
  // -------------------------------------------------------------------------
  function renderSidebar() {
    // Dropdown chọn dự án ở sidebar
    const projSelect = byId('work-project-select');
    if (projSelect) {
      projSelect.innerHTML = '<option value="">-- Tất cả dự án (' + state.projects.length + ') --</option>' +
        state.projects.map(p => '<option value="' + escape(p.id) + '"' + (state.filterProject === p.id ? ' selected' : '') + '>' +
          escape(p.name) + '</option>').join('');
    }

    // Danh sách bộ lọc hạng mục
    const catContainer = byId('category-filter-list');
    if (catContainer) {
      const counts = {};
      for (const a of state.assignments) {
        if (a.category) counts[a.category] = (counts[a.category] || 0) + 1;
      }
      catContainer.innerHTML = '<div class="sidebar-compact"><div class="sb-chip-grid">' +
        '<label class="sb-chip"><input type="radio" name="filter-cat" value=""' + (!state.filterCategory ? ' checked' : '') + '><span>Tất cả</span></label>' +
        state.categories.map(c => '<label class="sb-chip"><input type="radio" name="filter-cat" value="' + escape(c) + '"' + (state.filterCategory === c ? ' checked' : '') + '><span>' + escape(c) + (counts[c] ? ' (' + counts[c] + ')' : '') + '</span></label>').join('') +
        '</div></div>';

      catContainer.querySelectorAll('input[name="filter-cat"]').forEach(radio => {
        radio.onchange = () => {
          state.filterCategory = radio.value;
          renderAssignments();
          renderContractors();
        };
      });
    }

    // Danh sách bộ lọc trạng thái
    const statusContainer = byId('status-filter-list');
    if (statusContainer) {
      const counts = {};
      for (const a of state.assignments) {
        counts[a.status] = (counts[a.status] || 0) + 1;
      }
      statusContainer.innerHTML = '<div class="sidebar-compact"><div class="sb-chip-grid">' +
        '<label class="sb-chip"><input type="radio" name="filter-status" value=""' + (!state.filterStatus ? ' checked' : '') + '><span>Tất cả</span></label>' +
        state.statuses.map(s => '<label class="sb-chip"><input type="radio" name="filter-status" value="' + escape(s) + '"' + (state.filterStatus === s ? ' checked' : '') + '><span>' + escape(s) + (counts[s] ? ' (' + counts[s] + ')' : '') + '</span></label>').join('') +
        '</div></div>';

      statusContainer.querySelectorAll('input[name="filter-status"]').forEach(radio => {
        radio.onchange = () => {
          state.filterStatus = radio.value;
          renderAssignments();
        };
      });
    }

    // Datalist hạng mục cho form
    const datalist = byId('datalist-categories');
    if (datalist) {
      datalist.innerHTML = state.categories.map(c => '<option value="' + escape(c) + '"></option>').join('');
    }
    const catSelect = byId('filter-contractor-category');
    if (catSelect) {
      catSelect.innerHTML = '<option value="">Tất cả hạng mục</option>' +
        state.categories.map(c => '<option value="' + escape(c) + '">' + escape(c) + '</option>').join('');
    }
  }

  // -------------------------------------------------------------------------
  // 3. RENDER PHIẾU GIAO VIỆC & CẢNH BÁO QUÁ HẠN
  // -------------------------------------------------------------------------
  function renderAssignments() {
    const tbody = byId('tbody-assignments');
    if (!tbody) return;

    let list = state.assignments;
    if (state.filterProject) {
      list = list.filter(a => a.projectId === state.filterProject);
    }
    if (state.filterCategory) {
      list = list.filter(a => a.category === state.filterCategory);
    }
    if (state.filterStatus) {
      list = list.filter(a => a.status === state.filterStatus);
    }
    if (state.searchAssignments) {
      const q = removeAccents(state.searchAssignments);
      list = list.filter(a => {
        const full = [a.projectName, a.taskTitle, a.contractorName, a.category, a.scope, a.notes, a.status].join(' ');
        return removeAccents(full).includes(q);
      });
    }

    byId('count-assignments').textContent = list.length;

    // Đếm quá hạn
    const overdueList = list.filter(a => a.isOverdue);
    const alertWrap = byId('overdue-alerts');
    if (alertWrap) {
      if (overdueList.length > 0) {
        alertWrap.innerHTML = '<span class="status-badge overdue" title="Các việc có ngày kết thúc đã qua nhưng chưa hoàn thành">⚠ ' + overdueList.length + ' việc quá hạn</span>';
      } else {
        alertWrap.innerHTML = '';
      }
    }

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 32px;">Không tìm thấy phiếu giao việc nào phù hợp.</td></tr>';
      return;
    }

    const statusClasses = {
      'Nháp': 'nhap',
      'Đã gửi': 'da_gui',
      'Đang làm': 'dang_lam',
      'Nghiệm thu': 'nghiem_thu',
      'Xong': 'xong'
    };

    tbody.innerHTML = list.map((a, idx) => {
      const isOverdue = a.isOverdue;
      const statusBadge = '<span class="status-badge ' + (statusClasses[a.status] || 'nhap') + '">' + escape(a.status) + '</span>' +
        (isOverdue ? ' <span class="status-badge overdue">Quá hạn</span>' : '');

      const dateRange = (a.startDate || '...') + ' → ' + (a.endDate || '...');
      const pdfLink = a.pdfFile
        ? '<a href="#" class="btn btn-outline btn-sm" data-action="download-pdf" data-id="' + escape(a.id) + '">📄 PDF</a>'
        : '<button type="button" class="btn btn-outline btn-sm" data-action="build-pdf" data-id="' + escape(a.id) + '">+ Ghép PDF</button>';

      return '<tr data-assignment-id="' + escape(a.id) + '">' +
        '<td style="text-align: center; color: #64748b;">' + (idx + 1) + '</td>' +
        '<td><strong>' + escape(a.projectName || 'Chưa chọn dự án') + '</strong></td>' +
        '<td><span class="contractor-category-badge">' + escape(a.category || 'Chung') + '</span></td>' +
        '<td>' + (a.taskTitle ? '📅 ' + escape(a.taskTitle) : '<em style="color:#94a3b8">Chưa gắn Lịch</em>') + '</td>' +
        '<td><strong>👷 ' + escape(a.contractorName || 'Chưa chỉ định') + '</strong></td>' +
        '<td>' + escape(a.quantity || a.scope || '-') + '</td>' +
        '<td style="font-size: 12px; color: #475569;">' + escape(dateRange) + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + pdfLink + '</td>' +
        '<td style="text-align: center;">' +
          '<div style="display: flex; gap: 4px; justify-content: center;">' +
            '<button type="button" class="btn btn-outline btn-sm" data-action="edit-assign" data-id="' + escape(a.id) + '" title="Sửa">✏</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-action="del-assign" data-id="' + escape(a.id) + '" title="Xoá" style="color:red">🗑</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  // -------------------------------------------------------------------------
  // 4. RENDER DANH BẠ NHÀ THẦU
  // -------------------------------------------------------------------------
  function renderContractors() {
    const grid = byId('contractor-grid');
    if (!grid) return;

    let list = state.contractors;
    if (state.filterCategory) {
      list = list.filter(c => (c.categories || []).includes(state.filterCategory));
    }
    if (state.searchContractors) {
      const q = removeAccents(state.searchContractors);
      list = list.filter(c => {
        const full = [c.name, c.contactPerson, c.phone, c.zalo, c.email, c.area, c.notes, (c.categories || []).join(' ')].join(' ');
        return removeAccents(full).includes(q);
      });
    }

    byId('count-contractors').textContent = list.length;

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">' +
        'Chưa có nhà thầu nào. Bấm <strong>+ Nhà thầu</strong> để thêm mới.</div>';
      return;
    }

    grid.innerHTML = list.map(c => {
      const stars = '★'.repeat(c.rating || 5) + '☆'.repeat(5 - (c.rating || 5));
      const cats = (c.categories || []).map(cat => '<span class="contractor-category-badge">' + escape(cat) + '</span>').join(' ');

      return '<div class="contractor-card" data-contractor-id="' + escape(c.id) + '">' +
        '<div class="contractor-card-head">' +
          '<div>' +
            '<h4>' + escape(c.name) + '</h4>' +
            (c.contactPerson ? '<div style="font-size: 13px; color: #475569;">👤 ' + escape(c.contactPerson) + '</div>' : '') +
          '</div>' +
          '<div style="color: #f59e0b; font-size: 14px;" title="' + (c.rating || 5) + '/5 sao">' + stars + '</div>' +
        '</div>' +
        '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0;">' + cats + '</div>' +
        '<div style="font-size: 13px; color: #334155; display: flex; flex-direction: column; gap: 2px;">' +
          (c.phone ? '<div>📞 SĐT: <strong>' + escape(c.phone) + '</strong>' + (c.zalo ? ' (Zalo: ' + escape(c.zalo) + ')' : '') + '</div>' : '') +
          (c.email ? '<div>✉ ' + escape(c.email) + '</div>' : '') +
          (c.area ? '<div>📍 ' + escape(c.area) + '</div>' : '') +
        '</div>' +
        (c.notes ? '<p style="margin: 4px 0 0; font-size: 12.5px; color: #64748b; font-style: italic;">' + escape(c.notes) + '</p>' : '') +
        '<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: auto; padding-top: 8px; border-top: 1px solid #f1f5f9;">' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="new-assign-contractor" data-id="' + escape(c.id) + '">+ Giao việc</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="edit-contractor" data-id="' + escape(c.id) + '">✏ Sửa</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="del-contractor" data-id="' + escape(c.id) + '" style="color:red">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // -------------------------------------------------------------------------
  // 5. MODAL NHÀ THẦU (THÊM / SỬA / XOÁ)
  // -------------------------------------------------------------------------
  function openContractorDialog(contractor = null) {
    const dialog = byId('dialog-contractor');
    if (!dialog) return;
    byId('contractor-dialog-title').textContent = contractor ? 'Sửa thông tin nhà thầu' : 'Thêm nhà thầu / Đội thợ';
    byId('contractor-id').value = contractor?.id || '';
    byId('contractor-name').value = contractor?.name || '';
    byId('contractor-contact').value = contractor?.contactPerson || '';
    byId('contractor-phone').value = contractor?.phone || '';
    byId('contractor-zalo').value = contractor?.zalo || '';
    byId('contractor-email').value = contractor?.email || '';
    byId('contractor-area').value = contractor?.area || '';
    byId('contractor-rating').value = String(contractor?.rating || 5);
    byId('contractor-notes').value = contractor?.notes || '';

    // Checkboxes chọn hạng mục
    const picker = byId('contractor-categories-picker');
    if (picker) {
      const activeCats = new Set(contractor?.categories || []);
      picker.innerHTML = state.categories.map(cat => {
        const checked = activeCats.has(cat) ? ' checked' : '';
        return '<label class="sb-chip" style="display:inline-flex;margin:2px;"><input type="checkbox" name="contractor-cat-item" value="' + escape(cat) + '"' + checked + '><span>' + escape(cat) + '</span></label>';
      }).join('');
    }

    dialog.showModal();
  }

  async function saveContractorSubmit(event) {
    event.preventDefault();
    const form = byId('form-contractor');
    const checkedCats = Array.from(form.querySelectorAll('input[name="contractor-cat-item"]:checked')).map(i => i.value);

    const payload = {
      id: byId('contractor-id').value || undefined,
      name: byId('contractor-name').value.trim(),
      categories: checkedCats,
      contactPerson: byId('contractor-contact').value.trim(),
      phone: byId('contractor-phone').value.trim(),
      zalo: byId('contractor-zalo').value.trim(),
      email: byId('contractor-email').value.trim(),
      area: byId('contractor-area').value.trim(),
      rating: Number(byId('contractor-rating').value) || 5,
      notes: byId('contractor-notes').value.trim()
    };

    try {
      GDHomeShell?.saveStatus(byId('save-status'), 'saving');
      const res = await fetch('/api/work/contractors', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Lỗi lưu nhà thầu');
      const result = await res.json();
      byId('dialog-contractor').close();

      // Cập nhật local
      const idx = state.contractors.findIndex(c => c.id === result.contractor.id);
      if (idx >= 0) state.contractors[idx] = result.contractor;
      else state.contractors.unshift(result.contractor);

      renderContractors();
      GDHomeShell?.saveStatus(byId('save-status'), 'saved');
      toast('Đã lưu thông tin nhà thầu: ' + result.contractor.name);
    } catch (err) {
      alert(err.message);
      GDHomeShell?.saveStatus(byId('save-status'), 'error');
    }
  }

  async function deleteContractor(id) {
    const c = state.contractors.find(item => item.id === id);
    if (!c || !confirm(`Bạn chắc chắn muốn xoá nhà thầu "${c.name}"?`)) return;

    try {
      GDHomeShell?.saveStatus(byId('save-status'), 'saving');
      const res = await fetch('/api/work/contractors/delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error('Không xoá được nhà thầu');
      state.contractors = state.contractors.filter(item => item.id !== id);
      renderContractors();
      GDHomeShell?.saveStatus(byId('save-status'), 'saved');
      toast(`Đã xoá nhà thầu ${c.name}`);
    } catch (err) {
      alert(err.message);
    }
  }

  // -------------------------------------------------------------------------
  // 6. MODAL PHIẾU GIAO VIỆC (THÊM / SỬA / XOÁ)
  // -------------------------------------------------------------------------
  function openAssignmentDialog(assignment = null, defaultContractorId = null) {
    const dialog = byId('dialog-assignment');
    if (!dialog) return;

    byId('assignment-dialog-title').textContent = assignment ? 'Sửa phiếu giao việc' : 'Tạo phiếu giao việc mới';
    byId('assignment-id').value = assignment?.id || '';

    // Dự án select
    const pSelect = byId('assign-project');
    pSelect.innerHTML = '<option value="">-- Chọn dự án --</option>' +
      state.projects.map(p => '<option value="' + escape(p.id) + '">' + escape(p.name) + '</option>').join('');
    pSelect.value = assignment?.projectId || state.filterProject || (state.projects[0]?.id || '');

    // Nhà thầu select
    const cSelect = byId('assign-contractor');
    cSelect.innerHTML = '<option value="">-- Chọn nhà thầu --</option>' +
      state.contractors.map(c => '<option value="' + escape(c.id) + '">' + escape(c.name) + ' (' + (c.categories || []).join(', ') + ')</option>').join('');
    cSelect.value = assignment?.contractorId || defaultContractorId || '';

    // Update danh sách công việc Lịch tương ứng dự án
    updateAssignTasksDropdown(pSelect.value, assignment?.taskId);

    byId('assign-category').value = assignment?.category || '';
    byId('assign-scope').value = assignment?.scope || '';
    byId('assign-quantity').value = assignment?.quantity || '';
    byId('assign-start-date').value = assignment?.startDate || '';
    byId('assign-end-date').value = assignment?.endDate || '';
    byId('assign-status').value = assignment?.status || 'Nháp';
    byId('assign-notes').value = assignment?.notes || '';

    pSelect.onchange = () => updateAssignTasksDropdown(pSelect.value);
    cSelect.onchange = () => {
      const cont = state.contractors.find(c => c.id === cSelect.value);
      if (cont && cont.categories?.length && !byId('assign-category').value) {
        byId('assign-category').value = cont.categories[0];
      }
    };

    byId('btn-attach-pdf-from-assign').onclick = () => {
      dialog.close();
      openPdfBuilderDialog(assignment || {
        projectId: pSelect.value,
        contractorId: cSelect.value,
        category: byId('assign-category').value,
        taskTitle: byId('assign-task').selectedOptions[0]?.text
      });
    };

    dialog.showModal();
  }

  function updateAssignTasksDropdown(projectId, selectedTaskId = '') {
    const tSelect = byId('assign-task');
    if (!tSelect) return;
    const projectTasks = state.tasks.filter(t => t.projectId === projectId);
    tSelect.innerHTML = '<option value="">-- Không gắn công việc Lịch --</option>' +
      projectTasks.map(t => '<option value="' + escape(t.id) + '"' + (selectedTaskId === t.id ? ' selected' : '') + '>' +
        escape(t.title) + ' (' + (t.startDate || '?') + ' → ' + (t.endDate || '?') + ')' +
      '</option>').join('');

    tSelect.onchange = () => {
      const task = projectTasks.find(t => t.id === tSelect.value);
      if (task) {
        if (task.startDate) byId('assign-start-date').value = task.startDate;
        if (task.endDate) byId('assign-end-date').value = task.endDate;
      }
    };
  }

  async function saveAssignmentSubmit(event) {
    event.preventDefault();
    const pSelect = byId('assign-project');
    const cSelect = byId('assign-contractor');
    const tSelect = byId('assign-task');

    const proj = state.projects.find(p => p.id === pSelect.value);
    const cont = state.contractors.find(c => c.id === cSelect.value);
    const task = state.tasks.find(t => t.id === tSelect.value);

    const payload = {
      id: byId('assignment-id').value || undefined,
      projectId: pSelect.value,
      projectName: proj?.name || '',
      taskId: tSelect.value || '',
      taskTitle: task?.title || '',
      contractorId: cSelect.value,
      contractorName: cont?.name || '',
      category: byId('assign-category').value.trim(),
      scope: byId('assign-scope').value.trim(),
      quantity: byId('assign-quantity').value.trim(),
      startDate: byId('assign-start-date').value,
      endDate: byId('assign-end-date').value,
      status: byId('assign-status').value,
      notes: byId('assign-notes').value.trim()
    };

    try {
      GDHomeShell?.saveStatus(byId('save-status'), 'saving');
      const res = await fetch('/api/work/assignments', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Lỗi lưu phiếu');
      const result = await res.json();
      byId('dialog-assignment').close();

      const idx = state.assignments.findIndex(a => a.id === result.assignment.id);
      if (idx >= 0) state.assignments[idx] = result.assignment;
      else state.assignments.unshift(result.assignment);

      renderAssignments();
      GDHomeShell?.saveStatus(byId('save-status'), 'saved');
      toast('Đã lưu phiếu giao việc thành công');
    } catch (err) {
      alert(err.message);
      GDHomeShell?.saveStatus(byId('save-status'), 'error');
    }
  }

  async function deleteAssignment(id) {
    const a = state.assignments.find(item => item.id === id);
    if (!a || !confirm(`Bạn chắc chắn muốn xoá phiếu giao việc cho "${a.contractorName}"?`)) return;

    try {
      GDHomeShell?.saveStatus(byId('save-status'), 'saving');
      const res = await fetch('/api/work/assignments/delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error('Không xoá được phiếu giao việc');
      state.assignments = state.assignments.filter(item => item.id !== id);
      renderAssignments();
      GDHomeShell?.saveStatus(byId('save-status'), 'saved');
      toast('Đã xoá phiếu giao việc.');
    } catch (err) {
      alert(err.message);
    }
  }

  // -------------------------------------------------------------------------
  // 7. BỘ TẠO PDF & GHÉP TRANG (pdf.js + pdf-lib)
  // -------------------------------------------------------------------------
  async function openPdfBuilderDialog(assignment = null) {
    state.currentAssignmentForPdf = assignment;
    const dialog = byId('dialog-pdf-builder');
    if (!dialog) return;

    // Dự án select
    const pSelect = byId('pdf-project-select');
    pSelect.innerHTML = '<option value="">-- Chọn dự án --</option>' +
      state.projects.map(p => '<option value="' + escape(p.id) + '">' + escape(p.name) + '</option>').join('');

    const activePid = assignment?.projectId || state.filterProject || state.projects[0]?.id || '';
    pSelect.value = activePid;

    await loadProjectDocumentsForPdf(activePid);
    updatePdfOutputName();

    pSelect.onchange = async () => {
      await loadProjectDocumentsForPdf(pSelect.value);
      updatePdfOutputName();
    };

    dialog.showModal();
  }

  function updatePdfOutputName() {
    const pSelect = byId('pdf-project-select');
    const projName = pSelect.selectedOptions[0]?.text?.replace(/-- Chọn.*?--/, '').trim() || 'Dự án';
    const cat = state.currentAssignmentForPdf?.category || 'Thi công';
    const cont = state.currentAssignmentForPdf?.contractorName || 'Nhà thầu';
    const date = todayStr();
    const filename = `${projName} - ${cat} - ${cont} - ${date}.pdf`;
    byId('pdf-output-filename').textContent = filename;
  }

  async function loadProjectDocumentsForPdf(projectId) {
    const docSelect = byId('pdf-document-select');
    const container = byId('pdf-thumbnails-container');
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#64748b">Đang tìm tài liệu PDF của dự án...</div>';

    if (!projectId) {
      docSelect.innerHTML = '<option value="">-- Chọn dự án trước --</option>';
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#64748b">Vui lòng chọn dự án.</div>';
      return;
    }

    try {
      const res = await fetch(`/api/project-hub/project?id=${encodeURIComponent(projectId)}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Không tải được danh mục tài liệu dự án');
      const data = await res.json();
      const allDocs = data.project?.hub?.documents || data.documents || [];
      const docs = allDocs.filter(d => (d.name || '').toLowerCase().endsWith('.pdf') || d.mime === 'application/pdf');

      if (!docs.length) {
        docSelect.innerHTML = '<option value="">(Dự án chưa có file PDF nào)</option>';
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#64748b">Dự án này chưa có tài liệu PDF trong Quản lý dự án. Vui lòng tải bản vẽ vào Quản lý dự án trước.</div>';
        return;
      }

      docSelect.innerHTML = '<option value="">-- Chọn tài liệu bản vẽ / PDF (' + docs.length + ') --</option>' +
        docs.map(d => `<option value="${escape(d.assetKey || d.id)}" data-doc-name="${escape(d.name)}">${escape(d.name)} (${d.pages || 1} trang)</option>`).join('');

      docSelect.onchange = async () => {
        if (!docSelect.value) return;
        await loadPdfPagesThumbnails(projectId, docSelect.value);
      };

      if (docs.length > 0) {
        docSelect.value = docs[0].assetKey || docs[0].id;
        await loadPdfPagesThumbnails(projectId, docSelect.value);
      }
    } catch (err) {
      container.innerHTML = `<div style="grid-column:1/-1;color:red;padding:16px;">Lỗi: ${escape(err.message)}</div>`;
    }
  }

  async function loadPdfPagesThumbnails(projectId, assetKeyOrId) {
    const container = byId('pdf-thumbnails-container');
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#64748b"><span class="ai-spinner"></span> Đang nạp từng trang PDF và tạo thumbnail...</div>';

    try {
      const res = await fetch('/api/project-hub/assets/' + encodeURIComponent(assetKeyOrId), { headers: getHeaders() });
      if (!res.ok) throw new Error('Không tải được nội dung file PDF');
      const arrayBuffer = await res.arrayBuffer();
      state.pdfSourceBytes = arrayBuffer.slice(0);
      state.pdfPages = [];

      let renderedWithPdfJs = false;
      if (typeof pdfjsLib !== 'undefined') {
        try {
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
          const pdf = await Promise.race([
            loadingTask.promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('pdf.js worker timeout')), 4000))
          ]);
          const numPages = pdf.numPages;
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.35 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            state.pdfPages.push({
              pageIndex: i - 1,
              pageNumber: i,
              selected: true,
              thumbUrl: canvas.toDataURL('image/jpeg', 0.8)
            });
          }
          renderedWithPdfJs = true;
        } catch (workerErr) {
          console.warn('pdf.js worker fallback to PDFLib:', workerErr);
        }
      }

      if (!renderedWithPdfJs) {
        let numPages = 1;
        if (typeof PDFLib !== 'undefined') {
          const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
          numPages = pdfDoc.getPageCount();
        }
        for (let i = 1; i <= numPages; i++) {
          const canvas = document.createElement('canvas');
          canvas.width = 180;
          canvas.height = 250;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, 180, 250);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(3, 3, 174, 244);
          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Trang ' + i, 90, 120);
          ctx.fillStyle = '#64748b';
          ctx.font = '13px system-ui, sans-serif';
          ctx.fillText('Bản vẽ PDF', 90, 145);
          state.pdfPages.push({
            pageIndex: i - 1,
            pageNumber: i,
            selected: true,
            thumbUrl: canvas.toDataURL('image/png')
          });
        }
      }

      renderPdfThumbnails();
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div style="grid-column:1/-1;color:red;padding:16px;">Lỗi đọc PDF: ' + escape(err.message) + '</div>';
    }
  }

  function renderPdfThumbnails() {
    const container = byId('pdf-thumbnails-container');
    if (!container) return;

    byId('selected-pages-count').textContent = state.pdfPages.filter(p => p.selected).length;

    container.innerHTML = state.pdfPages.map((item, visualIdx) => {
      return `
        <div class="pdf-thumb-item ${item.selected ? 'selected' : ''}" data-visual-idx="${visualIdx}" draggable="true">
          <input type="checkbox" class="pdf-thumb-checkbox" data-page-idx="${item.pageIndex}" ${item.selected ? 'checked' : ''}>
          <img src="${item.thumbUrl}" alt="Trang ${item.pageNumber}">
          <div class="pdf-thumb-label">Trang ${item.pageNumber}</div>
          <div style="display:flex;justify-content:center;gap:4px;margin-top:4px;">
            <button type="button" class="btn btn-outline btn-sm" data-move-page="-1" data-idx="${visualIdx}" style="padding:2px 6px;" title="Chuyển sang trái">←</button>
            <button type="button" class="btn btn-outline btn-sm" data-move-page="1" data-idx="${visualIdx}" style="padding:2px 6px;" title="Chuyển sang phải">→</button>
          </div>
        </div>
      `;
    }).join('');

    // Sự kiện checkbox
    container.querySelectorAll('.pdf-thumb-checkbox').forEach(cb => {
      cb.onchange = () => {
        const pIdx = Number(cb.dataset.pageIdx);
        const target = state.pdfPages.find(p => p.pageIndex === pIdx);
        if (target) target.selected = cb.checked;
        cb.closest('.pdf-thumb-item').classList.toggle('selected', cb.checked);
        byId('selected-pages-count').textContent = state.pdfPages.filter(p => p.selected).length;
      };
    });

    // Sự kiện di chuyển thứ tự trang
    container.querySelectorAll('[data-move-page]').forEach(btn => {
      btn.onclick = () => {
        const step = Number(btn.dataset.movePage);
        const idx = Number(btn.dataset.idx);
        const newIdx = idx + step;
        if (newIdx >= 0 && newIdx < state.pdfPages.length) {
          const temp = state.pdfPages[idx];
          state.pdfPages[idx] = state.pdfPages[newIdx];
          state.pdfPages[newIdx] = temp;
          renderPdfThumbnails();
        }
      };
    });
  }

  // -------------------------------------------------------------------------
  // 8. TẠO FILE PDF BẰNG PDF-LIB & LƯU VÀO DỰ ÁN
  // -------------------------------------------------------------------------
  async function executePdfBuild() {
    const selectedPages = state.pdfPages.filter(p => p.selected);
    if (!selectedPages.length) {
      alert('Vui lòng chọn ít nhất 1 trang PDF để ghép.');
      return;
    }
    if (!state.pdfSourceBytes) {
      alert('Chưa có dữ liệu PDF nguồn.');
      return;
    }

    const buildBtn = byId('btn-execute-pdf-build');
    buildBtn.disabled = true;
    buildBtn.innerHTML = '<span class="ai-spinner"></span> Đang tạo PDF...';

    try {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const newPdf = await PDFDocument.create();
      const helvetica = await newPdf.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await newPdf.embedFont(StandardFonts.HelveticaBold);

      const pSelect = byId('pdf-project-select');
      const projectId = pSelect.value;
      const proj = state.projects.find(p => p.id === projectId);
      const projName = proj?.name || 'DU AN GD HOME';
      const cat = state.currentAssignmentForPdf?.category || 'GIAO VIEC THI CONG';
      const contractorName = state.currentAssignmentForPdf?.contractorName || 'NHA THAU';
      const quantity = state.currentAssignmentForPdf?.quantity || 'Theo thiet ke';
      const scope = state.currentAssignmentForPdf?.scope || 'Theo ho so ky thuat';
      const dateText = todayStr();

      // 1. Thêm trang bìa tự sinh (nếu bật)
      if (byId('pdf-opt-cover').checked) {
        const coverPage = newPdf.addPage([595.28, 841.89]); // Khổ A4 đứng (pt)
        const { width, height } = coverPage.getSize();

        // Banner trên cùng màu xanh GD HOME
        coverPage.drawRectangle({
          x: 0,
          y: height - 100,
          width,
          height: 100,
          color: rgb(0.1, 0.45, 0.91)
        });

        // Logo / Title trên banner
        coverPage.drawText('GD HOME ARCHITECTURE & CONSTRUCTION', {
          x: 40,
          y: height - 50,
          size: 14,
          font: helveticaBold,
          color: rgb(1, 1, 1)
        });
        coverPage.drawText('HO SO GIAO VIEC & BAN VE THI CONG NHA THAU', {
          x: 40,
          y: height - 75,
          size: 16,
          font: helveticaBold,
          color: rgb(1, 1, 1)
        });

        // Khung thông tin chính
        let y = height - 160;
        const lineH = 32;

        const infoFields = [
          ['DU AN:', toAscii(projName)],
          ['HANG MUC CHUYEN:', toAscii(cat)],
          ['NHA THAU / DOI THO:', toAscii(contractorName)],
          ['KHOI LUONG / PHAM VI:', toAscii(quantity + ' - ' + scope)],
          ['NGAY PHAT HANH:', toAscii(dateText)],
          ['SO TRANG BAN VE:', selectedPages.length + ' trang chi tiet']
        ];

        for (const [label, val] of infoFields) {
          coverPage.drawText(label, {
            x: 50,
            y,
            size: 12,
            font: helveticaBold,
            color: rgb(0.2, 0.25, 0.3)
          });
          coverPage.drawText(toAscii(String(val || '-')), {
            x: 210,
            y,
            size: 12,
            font: helvetica,
            color: rgb(0.1, 0.1, 0.1)
          });
          y -= lineH;
        }

        // Chân trang bìa
        coverPage.drawRectangle({
          x: 40,
          y: 60,
          width: width - 80,
          height: 1,
          color: rgb(0.8, 0.85, 0.9)
        });
        coverPage.drawText('Ho so thi cong chinh thuc phat hanh tu GD HOME Tools.', {
          x: 40,
          y: 40,
          size: 10,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5)
        });
      }

      // 2. Ghép từng trang PDF đã chọn theo thứ tự đã sắp xếp
      const srcDoc = await PDFDocument.load(state.pdfSourceBytes.slice(0));
      const pageIndicesToCopy = selectedPages.map(p => p.pageIndex);
      const copiedPages = await newPdf.copyPages(srcDoc, pageIndicesToCopy);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      // 3. Xuất file PDF dạng Uint8Array
      const finalPdfBytes = await newPdf.save();
      const outputFilename = byId('pdf-output-filename').textContent.trim() || 'GDHOME-Giao-Viec.pdf';

      // 4. Kích hoạt tải về máy người dùng
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = outputFilename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);

      // 5. Lưu vào tài liệu dự án (loại "Hồ sơ giao việc" qua /api/project-hub/documents/upload)
      try {
        let binaryStr = '';
        const len = finalPdfBytes.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const chunk = finalPdfBytes.subarray(i, Math.min(i + chunkSize, len));
          binaryStr += String.fromCharCode.apply(null, chunk);
        }
        const base64Data = btoa(binaryStr);

        await fetch('/api/project-hub/documents/upload', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            projectId,
            name: outputFilename,
            type: 'work',
            dataBase64: base64Data,
            mime: 'application/pdf'
          })
        });
      } catch (uploadErr) {
        console.warn('Không tự động đẩy PDF vào Quản lý dự án:', uploadErr);
      }

      byId('dialog-pdf-builder').close();
      toast('Đã tạo thành công file PDF: ' + outputFilename);
    } catch (err) {
      console.error(err);
      alert('Lỗi tạo PDF: ' + err.message);
    } finally {
      buildBtn.disabled = false;
      buildBtn.innerHTML = '<i data-lucide="file-check"></i> Tạo PDF';
    }
  }

  // -------------------------------------------------------------------------
  // 9. XUẤT EXCEL DANH SÁCH GIAO VIỆC
  // -------------------------------------------------------------------------
  function exportAssignmentsExcel() {
    if (typeof XLSX === 'undefined') {
      alert('Thư viện Excel chưa được nạp.');
      return;
    }
    const list = state.assignments;
    if (!list.length) {
      alert('Không có phiếu giao việc nào để xuất.');
      return;
    }

    const rows = list.map((a, i) => ({
      'STT': i + 1,
      'Dự án': a.projectName || '',
      'Hạng mục': a.category || '',
      'Công việc Lịch': a.taskTitle || '',
      'Nhà thầu / Đội thợ': a.contractorName || '',
      'Phạm vi': a.scope || '',
      'Khối lượng': a.quantity || '',
      'Bắt đầu': a.startDate || '',
      'Kết thúc': a.endDate || '',
      'Trạng thái': a.status || 'Nháp',
      'Quá hạn': a.isOverdue ? 'Quá hạn' : 'Đúng hạn',
      'Ghi chú': a.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Giao việc');

    const filename = `GDHOME - Danh sach giao viec - ${todayStr()}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast('Đã xuất file Excel: ' + filename);
  }

  // -------------------------------------------------------------------------
  // 10. GẮN SỰ KIỆN GIAO DIỆN
  // -------------------------------------------------------------------------
  function initEvents() {
    // Tab switching
    document.querySelectorAll('.work-tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.work-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        state.activeTab = tab;
        byId('tab-assignments-panel').style.display = tab === 'assignments' ? 'block' : 'none';
        byId('tab-contractors-panel').style.display = tab === 'contractors' ? 'block' : 'none';
      };
    });

    // Toolbar buttons
    byId('btn-add-contractor')?.addEventListener('click', () => openContractorDialog());
    byId('btn-add-assignment')?.addEventListener('click', () => openAssignmentDialog());
    byId('btn-open-pdf-builder')?.addEventListener('click', () => openPdfBuilderDialog());
    byId('btn-export-excel')?.addEventListener('click', exportAssignmentsExcel);

    // Form submits
    byId('form-contractor')?.addEventListener('submit', saveContractorSubmit);
    byId('form-assignment')?.addEventListener('submit', saveAssignmentSubmit);

    // Search inputs
    byId('search-assignments')?.addEventListener('input', e => {
      state.searchAssignments = e.target.value;
      renderAssignments();
    });
    byId('search-contractors')?.addEventListener('input', e => {
      state.searchContractors = e.target.value;
      renderContractors();
    });
    byId('filter-contractor-category')?.addEventListener('change', e => {
      state.filterCategory = e.target.value;
      renderContractors();
    });

    // Filter project dropdown at sidebar
    byId('work-project-select')?.addEventListener('change', e => {
      state.filterProject = e.target.value;
      renderAssignments();
    });

    // Delegated actions for assignments table
    byId('tbody-assignments')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit-assign') {
        const a = state.assignments.find(item => item.id === id);
        if (a) openAssignmentDialog(a);
      } else if (action === 'del-assign') {
        deleteAssignment(id);
      } else if (action === 'build-pdf') {
        const a = state.assignments.find(item => item.id === id);
        if (a) openPdfBuilderDialog(a);
      } else if (action === 'download-pdf') {
        e.preventDefault();
        const a = state.assignments.find(item => item.id === id);
        if (a) openPdfBuilderDialog(a);
      }
    });

    // Delegated actions for contractor grid
    byId('contractor-grid')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit-contractor') {
        const c = state.contractors.find(item => item.id === id);
        if (c) openContractorDialog(c);
      } else if (action === 'del-contractor') {
        deleteContractor(id);
      } else if (action === 'new-assign-contractor') {
        openAssignmentDialog(null, id);
      }
    });

    // PDF Builder buttons
    byId('btn-pdf-select-all')?.addEventListener('click', () => {
      state.pdfPages.forEach(p => p.selected = true);
      renderPdfThumbnails();
    });
    byId('btn-pdf-deselect-all')?.addEventListener('click', () => {
      state.pdfPages.forEach(p => p.selected = false);
      renderPdfThumbnails();
    });
    byId('btn-execute-pdf-build')?.addEventListener('click', executePdfBuild);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.GDHomeShell?.layout) {
      GDHomeShell.layout();
    }
    initEvents();
    loadData();
  });
})();
