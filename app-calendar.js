// Bảng Lịch: thanh dự án bên trái, vẽ lịch, kéo thả, tạo việc nhanh, chi tiết việc, xuất ảnh lịch.
// Tách từ app.js: các file app-*.js chạy nối tiếp nhau (chung phạm vi toàn cục), giữ đúng thứ tự nạp trong index.html.
// =========================================================================
// SIDEBAR DANH SÁCH "DỰ ÁN CỦA ..." (NHIỀU NGƯỜI DÙNG, SỔ RA & THU GỌN)
// =========================================================================
function openDeleteScheduleProject(owner) {
  const others = AppState.projectOwners.filter(project => project.id !== owner.id);
  const stages = new Set(AppState.calendars.filter(cal => cal.ownerId === owner.id).map(cal => cal.id));
  const jobs = AppState.tasks.filter(task => stages.has(task.calendarId));
  const dialog = document.createElement('dialog');
  dialog.id = 'delete-schedule-project';
  dialog.setAttribute('aria-labelledby','delete-schedule-title');
  document.body.append(dialog);
  dialog.addEventListener('close',() => dialog.remove(),{once:true});
  const escape = GDHomeShell.escape;
  GDHomeShell.dialog(dialog,`<h2 id="delete-schedule-title">Xoá dự án ${escape(owner.name)}</h2>
    <p>${stages.size} giai đoạn · ${jobs.length} công việc</p>
    <p>Bảng chốt mã của dự án này vẫn giữ, xoá riêng ở Chốt mã. Hồ sơ Quản lý dự án vẫn giữ.</p>
    <p><label>Dự án đích <select id="delete-project-target"><option value="">Chọn dự án…</option>
    ${others.map(project => `<option value="${escape(project.id)}">${escape(project.name)}</option>`).join('')}</select></label>
    <button type="button" id="move-project-stages" disabled>Chuyển giai đoạn sang dự án…</button></p>
    <p><label>Gõ tên dự án để xác nhận <input id="delete-project-confirm" autocomplete="off"></label>
    <button type="button" id="delete-project-all" style="background:#b91c1c;color:#fff" disabled>Xoá hết (dự án + giai đoạn + công việc)</button></p>
    <button type="button" id="cancel-delete-project">Huỷ</button>`);
  const target = dialog.querySelector('#delete-project-target');
  const confirmName = dialog.querySelector('#delete-project-confirm');
  const move = dialog.querySelector('#move-project-stages');
  const remove = dialog.querySelector('#delete-project-all');
  const apply = destination => {
    snapshotState();
    if (destination) {
      AppState.calendars.forEach(cal => { if (stages.has(cal.id)) cal.ownerId = destination; });
    } else {
      AppState.calendars = AppState.calendars.filter(cal => !stages.has(cal.id));
      AppState.tasks = AppState.tasks.filter(task => !stages.has(task.calendarId));
      if (stages.has(AppState.activeCalendarId)) AppState.activeCalendarId = AppState.calendars[0]?.id || '';
    }
    AppState.projectOwners = AppState.projectOwners.filter(project => project.id !== owner.id);
    dialog.close();
    syncAllFromMSProject();
    const deletion = _undoStack.at(-1);
    const toast = document.createElement('div');
    toast.className = 'toast-notification show';
    toast.setAttribute('role','status');
    toast.append('Đã xoá dự án. ');
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.textContent = 'Hoàn tác';
    undo.onclick = () => {
      if (_undoStack.at(-1) === deletion) undoLastAction();
      toast.remove();
    };
    toast.append(undo);
    document.body.append(toast);
    setTimeout(() => toast.remove(),10000);
  };
  target.onchange = () => { move.disabled = !target.value; };
  confirmName.oninput = () => { remove.disabled = confirmName.value.trim() !== owner.name; };
  move.onclick = () => { if (others.some(project => project.id === target.value)) apply(target.value); };
  remove.onclick = () => { if (confirmName.value.trim() === owner.name) apply(null); };
  dialog.querySelector('#cancel-delete-project').onclick = () => dialog.close();
}

function renderCalendarSidebar() {
  normalizeAppState();
  const container = document.getElementById('calendar-list-container');
  if (!container) return;
  container.innerHTML = '';

  const activeCal = getActiveCalendar();
  const activeNameEl = document.getElementById('active-cal-name');
  const activeDotEl = document.getElementById('active-cal-dot');
  if (activeNameEl) activeNameEl.textContent = activeCal.name;
  if (activeDotEl) activeDotEl.style.backgroundColor = activeCal.color;

  AppState.projectOwners.forEach(owner => {
    const ownerCalendars = AppState.calendars.filter(c => c.ownerId === owner.id);
    const groupEl = document.createElement('div');
    groupEl.className = `project-owner-group ${owner.collapsed ? 'is-collapsed' : ''}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'project-owner-header';
    headerEl.title = `Dự án "${owner.name}" • Bấm để sổ ra / thu gọn các giai đoạn`;

    const leftHeader = document.createElement('div');
    leftHeader.className = 'project-owner-left';

    const ownerCheck = document.createElement('input');
    ownerCheck.type = 'checkbox';
    ownerCheck.checked = ownerCalendars.length > 0 && ownerCalendars.some(c => c.visible !== false);
    ownerCheck.style.cssText = 'width:13px; height:13px; accent-color:#b91c1c; cursor:pointer; flex-shrink:0;';
    ownerCheck.title = `Bật / Tắt toàn bộ các giai đoạn của dự án "${owner.name}"`;
    ownerCheck.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetVis = ownerCheck.checked;
      ownerCalendars.forEach(c => { c.visible = targetVis; });
      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
    });

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'project-owner-arrow';
    arrowSpan.textContent = owner.collapsed ? '▶' : '▼';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'project-owner-title';
    titleSpan.innerHTML = `<em>${escapeHtml(owner.name)}</em>`;

    const countSpan = document.createElement('span');
    countSpan.className = 'project-owner-count';
    countSpan.textContent = String(ownerCalendars.length);

    leftHeader.appendChild(ownerCheck);
    leftHeader.appendChild(arrowSpan);
    leftHeader.appendChild(titleSpan);
    leftHeader.appendChild(countSpan);

    const actionsHeader = document.createElement('div');
    actionsHeader.className = 'project-owner-actions';

    const addCalBtn = document.createElement('button');
    addCalBtn.type = 'button';
    addCalBtn.className = 'owner-mini-btn';
    addCalBtn.title = `Thêm giai đoạn mới vào dự án "${owner.name}"`;
    addCalBtn.textContent = '+';
    addCalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      owner.collapsed = false;
      openCalendarCategoryModal(null, owner.id);
    });
    actionsHeader.appendChild(addCalBtn);

    const renameOwnerBtn = document.createElement('button');
    renameOwnerBtn.type = 'button';
    renameOwnerBtn.className = 'owner-mini-btn';
    renameOwnerBtn.title = `Đổi tên dự án "${owner.name}"`;
    renameOwnerBtn.textContent = '✎';
    renameOwnerBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newOwnerName = await GDHomeShell.prompt('Tên dự án (VD: VĂN PHÒNG B4 PHẠM NGỌC THẠCH, NHÀ A DŨNG - HẢI PHÒNG...):', owner.name);
      if (newOwnerName && newOwnerName.trim()) {
        renameProjectAndSync(owner, newOwnerName.trim());
        syncCustomerInputWithActiveCalendar();
        saveToBackend();
        renderCalendarSidebar();
        renderCalendar();
        showToast(`Đã đổi tên dự án thành "${owner.name}"!`);
      }
    });
    actionsHeader.appendChild(renameOwnerBtn);

    const hubOwnerBtn = document.createElement('a');
    hubOwnerBtn.className = 'owner-mini-btn';
    hubOwnerBtn.href = `/du-an?project=${encodeURIComponent(owner.id)}`;
    hubOwnerBtn.target = '_blank';
    hubOwnerBtn.title = `Mở Hồ sơ dự án & Soát bản vẽ của "${owner.name}"`;
    hubOwnerBtn.textContent = '📁';
    hubOwnerBtn.addEventListener('click', (e) => { e.stopPropagation(); });
    actionsHeader.appendChild(hubOwnerBtn);

    if (AppState.projectOwners.length > 1) {
      const delOwnerBtn = document.createElement('button');
      delOwnerBtn.type = 'button';
      delOwnerBtn.className = 'owner-mini-btn del';
      delOwnerBtn.title = `Xóa dự án "${owner.name}"`;
      delOwnerBtn.textContent = '×';
      delOwnerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteScheduleProject(owner);
      });
      actionsHeader.appendChild(delOwnerBtn);
    }

    headerEl.addEventListener('click', () => {
      owner.collapsed = !owner.collapsed;
      saveToBackend();
      renderCalendarSidebar();
    });

    // Hỗ trợ kéo thả giai đoạn hoặc công việc vào tiêu đề Dự án bên thanh trái
    headerEl.addEventListener('dragover', (e) => {
      if (!_mspDragPayload) return;
      e.preventDefault();
      headerEl.style.outline = '2px dashed #b91c1c';
    });
    headerEl.addEventListener('dragleave', () => {
      headerEl.style.outline = '';
    });
    headerEl.addEventListener('drop', (e) => {
      e.preventDefault();
      headerEl.style.outline = '';
      if (!_mspDragPayload) return;
      if (_mspDragPayload.type === 'project') {
        const cal = AppState.calendars.find(c => c.id === _mspDragPayload.calId);
        if (cal && cal.ownerId !== owner.id) {
          cal.ownerId = owner.id;
          owner.collapsed = false;
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã chuyển giai đoạn "${cal.name}" sang dự án "${owner.name}"!`);
        }
      } else if (_mspDragPayload.type === 'task') {
        let targetCal = AppState.calendars.find(c => c.ownerId === owner.id);
        if (!targetCal) {
          const pal = getActivePaletteColors();
          targetCal = {
            id: 'cal_' + Date.now(),
            ownerId: owner.id,
            name: 'GIAI ĐOẠN 1',
            customerName: 'GIAI ĐOẠN 1',
            color: pal[AppState.calendars.length % pal.length],
            visible: true
          };
          AppState.calendars.push(targetCal);
        }
        const idsToMove = Array.isArray(_mspDragPayload.taskIds) && _mspDragPayload.taskIds.length > 0
          ? _mspDragPayload.taskIds
          : [_mspDragPayload.taskId];
        let movedCount = 0;
        AppState.tasks.forEach(t => {
          if (idsToMove.includes(t.id)) {
            t.calendarId = targetCal.id;
            movedCount++;
          }
        });
        if (movedCount > 0) {
          targetCal.hasManualTaskOrder = true;
          owner.collapsed = false;
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã chuyển ${movedCount} công việc sang dự án "${owner.name}" (${targetCal.name})!`);
        }
      }
    });

    headerEl.appendChild(leftHeader);
    headerEl.appendChild(actionsHeader);
    groupEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'project-owner-body';

    if (ownerCalendars.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.style.cssText = 'font-size:10.5px; color:#94a3b8; padding:4px 6px;';
      emptyNote.textContent = 'Chưa có dự án nào (Bấm + để thêm)';
      bodyEl.appendChild(emptyNote);
    }

    ownerCalendars.forEach(cal => {
      const item = document.createElement('div');
      item.className = `calendar-list-item ${cal.id === AppState.activeCalendarId ? 'active-selected' : ''}`;
      item.title = `Bấm để chọn giai đoạn "${cal.name}" (dự án ${owner.name})`;

      const leftDiv = document.createElement('div');
      leftDiv.className = 'cal-item-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'cal-visibility-check';
      checkbox.checked = cal.visible !== false;
      checkbox.style.accentColor = cal.color;
      checkbox.title = 'Ẩn / Hiện các công việc của lịch này';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        cal.visible = checkbox.checked;
        saveToBackend();
        renderCalendar();
      });

      const colorBox = document.createElement('span');
      colorBox.className = 'cal-color-box';
      colorBox.style.backgroundColor = cal.color;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cal-item-name';
      const taskCount = AppState.tasks.filter(t => t.calendarId === cal.id).length;
      nameSpan.textContent = `${cal.name} (${taskCount})`;

      leftDiv.appendChild(checkbox);
      leftDiv.appendChild(colorBox);
      leftDiv.appendChild(nameSpan);

      item.addEventListener('click', () => {
        AppState.activeCalendarId = cal.id;
        cal.visible = true;
        popoverColor = cal.color;
        syncCustomerInputWithActiveCalendar();
        saveToBackend();
        renderCalendarSidebar();
        renderCalendar();
      });

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'cal-item-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cal-action-btn';
      editBtn.title = 'Đổi tên khách hàng, người phụ trách hoặc màu lịch';
      editBtn.innerHTML = '<i data-lucide="edit-2"></i>';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCalendarCategoryModal(cal, cal.ownerId);
      });
      actionsDiv.appendChild(editBtn);

      if (AppState.calendars.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'cal-action-btn';
        delBtn.title = 'Xóa danh mục lịch này';
        delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const inside = AppState.tasks.filter(t => t.calendarId === cal.id);
          if (await GDHomeShell.confirm({
            title: `Xoá danh mục "${cal.name}"?`,
            message: inside.length ? `Xoá hẳn danh mục lịch và ${inside.length} công việc bên trong:` : 'Danh mục đang trống.',
            groups: inside.length ? [{ items: inside.slice(0, 200).map(t => t.title) }] : [],
            okText: 'Xoá danh mục', danger: true
          })) {
            AppState.tasks = AppState.tasks.filter(t => t.calendarId !== cal.id);
            AppState.calendars = AppState.calendars.filter(c => c.id !== cal.id);
            normalizeAppState();
            syncCustomerInputWithActiveCalendar();
            saveToBackend();
            renderCalendarSidebar();
            renderCalendar();
          }
        });
        actionsDiv.appendChild(delBtn);
      }

      item.appendChild(leftDiv);
      item.appendChild(actionsDiv);
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        _mspDragPayload = { type: 'project', calId: cal.id };
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `project:${cal.id}`);
        }
      });
      item.addEventListener('dragover', (e) => {
        if (!_mspDragPayload) return;
        e.preventDefault();
        item.style.outline = '1.5px dashed #b91c1c';
      });
      item.addEventListener('dragleave', () => {
        item.style.outline = '';
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.style.outline = '';
        if (!_mspDragPayload) return;
        if (_mspDragPayload.type === 'project' && _mspDragPayload.calId !== cal.id) {
          const fromIdx = AppState.calendars.findIndex(c => c.id === _mspDragPayload.calId);
          if (fromIdx !== -1) {
            const [movedCal] = AppState.calendars.splice(fromIdx, 1);
            movedCal.ownerId = cal.ownerId;
            const toIdx = AppState.calendars.findIndex(c => c.id === cal.id);
            AppState.calendars.splice(toIdx !== -1 ? toIdx : AppState.calendars.length, 0, movedCal);
            _mspDragPayload = null;
            syncAllFromMSProject(`Đã chuyển giai đoạn "${movedCal.name}" vào dự án "${owner.name}"!`);
          }
        } else if (_mspDragPayload.type === 'task') {
          const idsToMove = Array.isArray(_mspDragPayload.taskIds) && _mspDragPayload.taskIds.length > 0
            ? _mspDragPayload.taskIds
            : [_mspDragPayload.taskId];
          let movedCount = 0;
          AppState.tasks.forEach(t => {
            if (idsToMove.includes(t.id)) {
              t.calendarId = cal.id;
              movedCount++;
            }
          });
          if (movedCount > 0) {
            cal.hasManualTaskOrder = true;
            _mspDragPayload = null;
            syncAllFromMSProject(`Đã chuyển ${movedCount} công việc sang giai đoạn "${cal.name}"!`);
          }
        }
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openProjectContextMenu === 'function') {
          openProjectContextMenu(e, cal);
        }
      });
      bodyEl.appendChild(item);
    });

    groupEl.appendChild(bodyEl);
    container.appendChild(groupEl);
  });

  if (typeof renderDemucSidebar === 'function') {
    renderDemucSidebar();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

let selectedCalCatColor = '#cc0000';

function openCalendarCategoryModal(cal = null, presetOwnerId = null) {
  normalizeAppState();
  const modal = document.getElementById('calendar-category-modal');
  const titleEl = document.getElementById('modal-cal-cat-title');
  const idInput = document.getElementById('cal-cat-id');
  const nameInput = document.getElementById('cal-cat-name');
  const ownerSelect = document.getElementById('cal-cat-owner');

  const targetOwnerId = (cal && cal.ownerId) || presetOwnerId || AppState.projectOwners[0].id;
  if (ownerSelect) {
    ownerSelect.innerHTML = AppState.projectOwners.map(o =>
      `<option value="${o.id}" ${o.id === targetOwnerId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`
    ).join('');
  }

  if (cal) {
    titleEl.textContent = 'Sửa giai đoạn';
    idInput.value = cal.id;
    nameInput.value = cal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : cal.name;
    selectedCalCatColor = cal.color || getActivePaletteColors()[0];
  } else {
    titleEl.textContent = 'Thêm giai đoạn mới';
    idInput.value = '';
    nameInput.value = '';
    const pal = getActivePaletteColors();
    selectedCalCatColor = pal[AppState.calendars.length % pal.length];
  }

  renderPaletteSwatchesUI();

  modal.classList.add('active');
  setTimeout(() => nameInput.focus(), 40);
}

function closeCalendarCategoryModal() {
  document.getElementById('calendar-category-modal').classList.remove('active');
}

function setupSidebarEvents() {
  // Nút ẩn/hiện thanh bên do shell.js xử lý (nhớ trạng thái từng trang).

  // Chọn giao diện Palette màu ở Sidebar -> Tự nhảy màu theo thứ tự Palette
  const sidebarPaletteSelect = document.getElementById('sidebar-palette-select');
  if (sidebarPaletteSelect) {
    sidebarPaletteSelect.addEventListener('change', (e) => {
      AppState.colorPaletteTheme = e.target.value || 'default';
      applyPaletteSequenceToTasks(null, false);
    });
  }

  const btnApplyPaletteSeq = document.getElementById('btn-apply-palette-sequence');
  if (btnApplyPaletteSeq) {
    btnApplyPaletteSeq.addEventListener('click', () => {
      applyPaletteSequenceToTasks(null, false);
    });
  }

  const toggleCascadeShift = document.getElementById('toggle-cascade-shift');
  if (toggleCascadeShift) {
    toggleCascadeShift.addEventListener('change', (e) => {
      AppState.autoCascadeShift = e.target.checked;
      saveToBackend();
      showToast(AppState.autoCascadeShift
        ? '🔄 Đã BẬT tự động dịch các mục sau khi chỉnh ngày (giữ nguyên số ngày làm việc)!'
        : 'Đã TẮT tự động dịch các mục sau khi chỉnh ngày.');
    });
  }

  const addOwnerBtn = document.getElementById('btn-add-project-owner');
  if (addOwnerBtn) {
    addOwnerBtn.addEventListener('click', async () => {
      const ownerName = await GDHomeShell.prompt('Tên DỰ ÁN mới (VD: VĂN PHÒNG B4 PHẠM NGỌC THẠCH, NHÀ A DŨNG - HẢI PHÒNG...):', '', { okText: 'Tạo dự án' });
      if (ownerName && ownerName.trim()) {
        const newOwner = {
          id: 'owner_' + Date.now(),
          name: ownerName.trim().toUpperCase(),
          collapsed: false
        };
        AppState.projectOwners.push(newOwner);
        // Tạo sẵn 1 giai đoạn đầu tiên cho dự án mới & chọn luôn
        const pal = getActivePaletteColors();
        const firstStage = {
          id: 'cal_' + Date.now(),
          ownerId: newOwner.id,
          name: 'GIAI ĐOẠN 1',
          customerName: 'GIAI ĐOẠN 1',
          color: pal[AppState.calendars.length % pal.length],
          visible: true
        };
        AppState.calendars.push(firstStage);
        AppState.activeCalendarId = firstStage.id;
        syncCustomerInputWithActiveCalendar();
        saveToBackend();
        renderCalendarSidebar();
        renderCalendar();
        showToast(`Đã tạo dự án "${newOwner.name}" (kèm "GIAI ĐOẠN 1" - bấm ✎ để đổi tên)`);
      }
    });
  }

  // Ô nhập tên DỰ ÁN trên tiêu đề trên cùng: luôn đồng bộ 2 chiều với Dự án đang chọn bên trái + tiêu đề Timeline
  const custInput = document.getElementById('customer-name-input');
  if (custInput) {
    custInput.addEventListener('input', () => {
      const activeProj = getTitleProject('calendar') || getActiveProject();
      if (activeProj) {
        renameProjectAndSync(activeProj, custInput.value);
      } else {
        const activeCal = getActiveCalendar();
        renameCalendarAndSyncTasks(activeCal, custInput.value);
      }
      const mspCustInput = document.getElementById('msp-customer-input');
      if (mspCustInput && document.activeElement !== mspCustInput) {
        mspCustInput.value = custInput.value;
      }
      renderCalendarSidebar();
      renderCalendar();
      saveToBackend();
    });
  }

  // Ô chỉnh sửa tháng đang lập bảng bên trái tiêu đề
  const monthInput = document.getElementById('schedule-month-input');
  if (monthInput) {
    monthInput.addEventListener('input', () => {
      setManualScheduleMonth(monthInput.value);
      saveToBackend();
    });
  }

  const createBtnSidebar = document.getElementById('btn-sidebar-create-task');
  if (createBtnSidebar) {
    createBtnSidebar.addEventListener('click', () => {
      openTaskModal();
    });
  }

  document.getElementById('btn-open-new-calendar-modal').addEventListener('click', () => {
    openCalendarCategoryModal(null);
  });

  document.getElementById('btn-close-cal-cat-modal').addEventListener('click', closeCalendarCategoryModal);
  document.getElementById('btn-cancel-cal-cat').addEventListener('click', closeCalendarCategoryModal);

  document.querySelectorAll('#cal-cat-color-palette .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#cal-cat-color-palette .color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      selectedCalCatColor = sw.dataset.color;
    });
  });

  document.getElementById('calendar-category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('cal-cat-id').value;
    const name = document.getElementById('cal-cat-name').value.trim().toUpperCase();
    const ownerSelect = document.getElementById('cal-cat-owner');
    const chosenOwnerId = (ownerSelect && ownerSelect.value) || AppState.projectOwners[0].id;
    if (!name) return;

    if (id) {
      const cal = AppState.calendars.find(c => c.id === id);
      if (cal) {
        renameCalendarAndSyncTasks(cal, name);
        cal.color = selectedCalCatColor;
        cal.ownerId = chosenOwnerId;
      }
    } else {
      const newCal = {
        id: 'cal_' + Date.now(),
        ownerId: chosenOwnerId,
        name,
        customerName: name,
        color: selectedCalCatColor,
        visible: true
      };
      AppState.calendars.push(newCal);
      AppState.activeCalendarId = newCal.id;
      popoverColor = newCal.color;
    }

    syncCustomerInputWithActiveCalendar();
    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeCalendarCategoryModal();
  });

  document.getElementById('btn-clear-active-calendar').addEventListener('click', async () => {
    const activeCal = getActiveCalendar();
    const inside = AppState.tasks.filter(t => t.calendarId === activeCal.id);
    const count = inside.length;
    if (count === 0) {
      GDHomeShell.alert(`Danh mục lịch "${activeCal.name}" hiện đang trống, không có công việc nào để xóa.`);
      return;
    }
    if (await GDHomeShell.confirm({
      title: `Xoá toàn bộ ${count} công việc?`,
      message: `Thuộc lịch "${activeCal.name}". Các danh mục lịch khác vẫn được giữ nguyên.`,
      groups: [{ items: inside.slice(0, 200).map(t => t.title) }],
      okText: `Xoá ${count} việc`, danger: true
    })) {
      AppState.tasks = AppState.tasks.filter(t => t.calendarId !== activeCal.id);
      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
    }
  });
}

// Helpers


// Kiểm tra 1 ngày có nằm trong các tùy chọn Ngày nghỉ (Ngày lễ ở Việt Nam, Thứ 7, Nghỉ chiều Thứ 7, Chủ nhật) hay không


function getVisibleTasks() {
  const visibleCalIds = new Set(
    (AppState.calendars || []).filter(c => c.visible !== false).map(c => c.id)
  );
  return (AppState.tasks || []).filter(t => visibleCalIds.has(t.calendarId) && t.visibleOnBoard !== false);
}

function getMaxTaskEndDateStr() {
  let maxStr = null;
  getVisibleTasks().forEach(t => {
    if (t.endDate && (!maxStr || t.endDate > maxStr)) {
      maxStr = t.endDate;
    }
  });
  return maxStr;
}

function getMinTaskStartDateStr() {
  let minStr = null;
  getVisibleTasks().forEach(t => {
    if (t.startDate && (!minStr || t.startDate < minStr)) {
      minStr = t.startDate;
    }
  });
  return minStr;
}

// Tạo danh sách các tuần
function generateCalendarWeeks(startMonthStr, endMonthStr, ignoreExtra = false) {
  const [sYear, sMonth] = startMonthStr.split('-').map(Number);
  const [eYear, eMonth] = endMonthStr.split('-').map(Number);

  let startDate = new Date(sYear, sMonth - 1, 1);
  let endDate = new Date(eYear, eMonth, 0);

  if (!ignoreExtra) {
    const minTaskStr = getMinTaskStartDateStr();
    if (minTaskStr) {
      const minTaskDate = parseDateStr(minTaskStr);
      if (minTaskDate < startDate) startDate = new Date(minTaskDate);
    }

    const maxTaskStr = getMaxTaskEndDateStr();
    if (maxTaskStr) {
      const maxTaskDate = parseDateStr(maxTaskStr);
      const requiredEndWithEmptyRow = new Date(maxTaskDate);
      requiredEndWithEmptyRow.setDate(requiredEndWithEmptyRow.getDate() + 7);
      if (requiredEndWithEmptyRow > endDate) {
        endDate = requiredEndWithEmptyRow;
      }
    }
  }

  let current = new Date(startDate);
  let dayOfWeek = current.getDay();
  let diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  current.setDate(current.getDate() + diffToMonday);

  if (!ignoreExtra && AppState.extraWeeksTop) {
    current.setDate(current.getDate() - AppState.extraWeeksTop * 7);
  }

  let endSunday = new Date(endDate);
  let endDayOfWeek = endSunday.getDay();
  if (endDayOfWeek !== 0) {
    endSunday.setDate(endSunday.getDate() + (7 - endDayOfWeek));
  }

  if (!ignoreExtra && AppState.extraWeeksBottom) {
    endSunday.setDate(endSunday.getDate() + AppState.extraWeeksBottom * 7);
  }

  if (endSunday <= current) {
    endSunday = new Date(current);
    endSunday.setDate(endSunday.getDate() + 13);
  }

  const weeks = [];
  while (current <= endSunday) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  // Luôn đảm bảo hàng cuối cùng bên dưới timeline là hàng lịch trống
  if (!ignoreExtra && weeks.length > 0) {
    const visibleTasks = getVisibleTasks();
    const lastWeek = weeks[weeks.length - 1];
    const lastWeekStartStr = formatDateStr(lastWeek[0]);
    const lastWeekEndStr = formatDateStr(lastWeek[6]);
    const hasTaskInLastWeek = visibleTasks.some(t => !(t.endDate < lastWeekStartStr || t.startDate > lastWeekEndStr));
    if (hasTaskInLastWeek) {
      const emptyWeek = [];
      for (let i = 0; i < 7; i++) {
        emptyWeek.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(emptyWeek);
    }
  }

  return weeks;
}

function generateWeeksBetweenDates(startDateStr, endDateStr) {
  let startDate = parseDateStr(startDateStr);
  let endDate = parseDateStr(endDateStr);

  let current = new Date(startDate);
  let dayOfWeek = current.getDay();
  let diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  current.setDate(current.getDate() + diffToMonday);

  let endSunday = new Date(endDate);
  let endDayOfWeek = endSunday.getDay();
  if (endDayOfWeek !== 0) {
    endSunday.setDate(endSunday.getDate() + (7 - endDayOfWeek));
  }

  const weeks = [];
  while (current <= endSunday) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}


// Trạng thái Tương tác
let isSelecting = false;
let selectionStartStr = null;
let selectionEndStr = null;

let isResizing = false;
let resizeTask = null;
let resizeType = null;
let resizePreviewStart = null;
let resizePreviewEnd = null;

let isCropMode = false;
let isDraggingCrop = false;
let cropStartWeekIdx = null;
let cropEndWeekIdx = null;
let currentRenderedWeeks = [];

function showFloatingTooltip(text, x, y) {
  const tip = document.getElementById('floating-action-tooltip');
  if (!tip) return;
  tip.textContent = text;
  tip.style.display = 'block';
  tip.style.left = `${Math.min(x + 14, window.innerWidth - 220)}px`;
  tip.style.top = `${Math.max(y - 34, 10)}px`;
}

function hideFloatingTooltip() {
  const tip = document.getElementById('floating-action-tooltip');
  if (tip) tip.style.display = 'none';
}

// Tìm ngày hiển thị thực tế đầu tiên & cuối cùng của 1 công việc trên Bảng Lịch
// (Khắc phục triệt để lỗi công việc kết thúc vào ngày nghỉ Chủ nhật / Thứ 7 / Lễ bị mất nút kéo đầu mút cuối)
function getTaskEffectiveRenderBounds(task) {
  if (!task || !task.startDate || !task.endDate) {
    return { firstDateStr: '', lastDateStr: '', allOff: false };
  }
  if (task.skipSundays === false) {
    return { firstDateStr: task.startDate, lastDateStr: task.endDate, allOff: false };
  }
  let firstDateStr = null;
  let lastDateStr = null;
  const curr = parseDateStr(task.startDate);
  const end = parseDateStr(task.endDate);
  while (curr <= end) {
    if (!isDateDayOff(curr, true).isOff) {
      const dStr = formatDateStr(curr);
      if (!firstDateStr) firstDateStr = dStr;
      lastDateStr = dStr;
    }
    curr.setDate(curr.getDate() + 1);
  }
  if (!firstDateStr || !lastDateStr) {
    return { firstDateStr: task.startDate, lastDateStr: task.endDate, allOff: true };
  }
  return { firstDateStr, lastDateStr, allOff: false };
}

// Render Calendar
function renderCalendar(targetWeeks = null, customContainer = null) {
  renderScheduleText();
  const gridContainer = customContainer || document.getElementById('calendar-grid');
  gridContainer.innerHTML = '';

  const weeks = targetWeeks || generateCalendarWeeks(AppState.startMonth, AppState.endMonth);
  if (!customContainer) {
    currentRenderedWeeks = weeks;
  }

  const visibleTasks = getVisibleTasks();
  const todayStr = formatDateStr(new Date());

  if (!customContainer && weeks.length > 0) {
    syncHeaderRangeButtonLabel();
    const firstDay = weeks[0][0];
    const lastDay = weeks[weeks.length - 1][6];
    document.getElementById('display-range-title').textContent = 
      `Tháng ${firstDay.getMonth() + 1}, ${firstDay.getFullYear()} - Tháng ${lastDay.getMonth() + 1}, ${lastDay.getFullYear()}`;
    
    const exportLabel = document.getElementById('export-all-label');
    if (exportLabel) {
      exportLabel.textContent = `${firstDay.getDate()}/${firstDay.getMonth() + 1}/${firstDay.getFullYear()} - ${lastDay.getDate()}/${lastDay.getMonth() + 1}/${lastDay.getFullYear()}`;
    }
  }

  weeks.forEach((week, weekIndex) => {
    const weekRow = document.createElement('div');
    weekRow.className = `calendar-week-row ${weekIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    weekRow.dataset.weekIndex = weekIndex;
    weekRow.dataset.weekStart = formatDateStr(week[0]);
    weekRow.dataset.weekEnd = formatDateStr(week[6]);

    // Background ngày
    const bgRow = document.createElement('div');
    bgRow.className = 'week-days-background';

    week.forEach((dayDate, dayIdx) => {
      const dayCell = document.createElement('div');
      const dayStr = formatDateStr(dayDate);
      dayCell.className = 'day-cell';
      dayCell.dataset.date = dayStr;
      dayCell.dataset.weekIndex = weekIndex;

      const dayOffInfo = isDateDayOff(dayDate, true);
      if (dayOffInfo.type === 'sunday' || dayOffInfo.type === 'saturday') {
        dayCell.classList.add('sunday-cell');
      }
      if (dayOffInfo.isCustom && dayOffInfo.isOff) dayCell.classList.add('is-custom-off');
      if (dayOffInfo.type === 'makeup-work' || dayOffInfo.type === 'custom-work') {
        dayCell.classList.add('is-workday-forced');
        dayCell.title = dayOffInfo.reason;
      }
      dayCell.addEventListener('contextmenu', (e) => {
        if (e.target.closest && e.target.closest('.task-bar-segment')) return;
        e.preventDefault();
        openDayOverrideContextMenu(e, dayStr);
      });

      const dayNum = dayDate.getDate();
      const monthNum = dayDate.getMonth() + 1;

      if (dayStr === todayStr) {
        dayCell.classList.add('today');
      }

      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header';

      if (dayNum === 1) {
        const monthLabel = document.createElement('span');
        monthLabel.className = 'day-month-label is-month-first';
        monthLabel.textContent = `1 thg ${monthNum}`;
        dayHeader.appendChild(monthLabel);
      } else {
        const numCircle = document.createElement('span');
        numCircle.className = 'day-number-circle';
        numCircle.textContent = dayNum;
        dayHeader.appendChild(numCircle);
      }

      // Hiển thị Ngày Âm lịch bên phải ngày Dương (60% kích thước, nét cực mảnh)
      if (AppState.showLunarDates !== false) {
        const lunarInfo = getLunarDateDisplay(dayDate);
        if (lunarInfo.text) {
          const lunarSpan = document.createElement('span');
          lunarSpan.className = `lunar-date-label ${lunarInfo.isFirst ? 'lunar-first-day' : ''}`;
          lunarSpan.textContent = lunarInfo.text;
          lunarSpan.title = `Âm lịch: ${lunarInfo.text}`;
          dayHeader.appendChild(lunarSpan);
        }
      }

      dayCell.appendChild(dayHeader);
      bgRow.appendChild(dayCell);
    });

    weekRow.appendChild(bgRow);

    // Lớp chứa các thanh tiến độ
    const weekStartStr = formatDateStr(week[0]);
    const weekEndStr = formatDateStr(week[6]);

    const activeTasksInWeek = visibleTasks.filter(task => {
      return !(task.endDate < weekStartStr || task.startDate > weekEndStr);
    });

    const eventsLayer = document.createElement('div');
    eventsLayer.className = 'week-events-layer';

    const weekSegments = [];

    activeTasksInWeek.forEach(task => {
      const bounds = getTaskEffectiveRenderBounds(task);
      const shouldSkipSunday = task.skipSundays !== false && !bounds.allOff;
      const rawSegStart = task.startDate < weekStartStr ? 0 : week.findIndex(d => formatDateStr(d) === task.startDate);
      const rawSegEnd = task.endDate > weekEndStr ? 6 : week.findIndex(d => formatDateStr(d) === task.endDate);

      if (!shouldSkipSunday) {
        weekSegments.push({
          task,
          colStart: rawSegStart,
          colEnd: rawSegEnd,
          isOverallStart: formatDateStr(week[rawSegStart]) === bounds.firstDateStr,
          isOverallEnd: formatDateStr(week[rawSegEnd]) === bounds.lastDateStr
        });
      } else {
        let c = rawSegStart;
        while (c <= rawSegEnd) {
          while (c <= rawSegEnd && isDateDayOff(week[c], true).isOff) c++;
          if (c > rawSegEnd) break;
          const partStart = c;
          while (c <= rawSegEnd && !isDateDayOff(week[c], true).isOff) c++;
          const partEnd = c - 1;
          weekSegments.push({
            task,
            colStart: partStart,
            colEnd: partEnd,
            isOverallStart: formatDateStr(week[partStart]) === bounds.firstDateStr,
            isOverallEnd: formatDateStr(week[partEnd]) === bounds.lastDateStr
          });
        }
      }
    });

    const tracks = [];
    weekSegments.forEach(item => {
      let trackIndex = -1;
      for (let t = 0; t < tracks.length; t++) {
        let isFree = true;
        for (let col = item.colStart; col <= item.colEnd; col++) {
          if (tracks[t][col]) {
            isFree = false;
            break;
          }
        }
        if (isFree) {
          trackIndex = t;
          break;
        }
      }

      if (trackIndex === -1) {
        tracks.push(new Array(7).fill(false));
        trackIndex = tracks.length - 1;
      }

      for (let col = item.colStart; col <= item.colEnd; col++) {
        tracks[trackIndex][col] = true;
      }

      item.trackIndex = trackIndex;
    });

    tracks.forEach((_, tIdx) => {
      const trackRow = document.createElement('div');
      trackRow.className = 'event-track-row';

      const segmentsOnTrack = weekSegments.filter(s => s.trackIndex === tIdx);
      segmentsOnTrack.forEach(item => {
        const task = item.task;
        const seg = document.createElement('div');
        seg.className = 'task-bar-segment';
        seg.dataset.taskId = task.id;
        const barColor = task.color || '#cc0000';
        seg.style.backgroundColor = barColor;
        seg.style.color = getContrastTextColor(barColor);
        seg.style.gridColumn = `${item.colStart + 1} / ${item.colEnd + 2}`;

        if (item.isOverallStart) seg.classList.add('is-start');
        else seg.classList.add('not-start');

        if (item.isOverallEnd) seg.classList.add('is-end');
        else seg.classList.add('not-end');

        if (!customContainer && item.isOverallStart) {
          const handleStart = document.createElement('div');
          handleStart.className = 'resize-handle handle-start';
          handleStart.title = 'Kéo để đổi ngày bắt đầu';
          handleStart.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResizing(task, 'start', e.clientX, e.clientY);
          });
          seg.appendChild(handleStart);
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-text';
        titleSpan.textContent = task.title;
        seg.appendChild(titleSpan);

        const calc = calculateTaskDays(task.startDate, task.endDate, task.skipSundays !== false);
        if (task.showCount !== false) {
          const badge = document.createElement('span');
          badge.className = 'task-day-badge';
          badge.textContent = `${calc.workDays} ngày`;
          seg.appendChild(badge);
        }

        if (!customContainer && item.isOverallEnd) {
          const handleEnd = document.createElement('div');
          handleEnd.className = 'resize-handle handle-end';
          handleEnd.title = 'Kéo để đổi ngày kết thúc';
          handleEnd.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResizing(task, 'end', e.clientX, e.clientY);
          });
          seg.appendChild(handleEnd);
        }

        const calObj = AppState.calendars.find(c => c.id === task.calendarId);
        const calLabel = calObj ? `[${calObj.name}] ` : '';
        seg.title = `${calLabel}${task.title} (${task.startDate} -> ${task.endDate}) | ${calc.workDays} ngày làm việc`;

        if (!customContainer) {
          seg.addEventListener('click', (e) => {
            if (isResizing || isCropMode) return;
            e.stopPropagation();
            closeQuickPopover();
            openTaskModal(task);
          });
          seg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeQuickPopover();
            if (typeof openTaskContextMenu === 'function') {
              openTaskContextMenu(e, task);
            }
          });
        }

        trackRow.appendChild(seg);
      });

      eventsLayer.appendChild(trackRow);
    });

    // LỊCH RIÊNG CHO NGÀY LỄ VIỆT NAM
    {
      const weekHolidays = [];
      week.forEach((d, cIdx) => {
        const dStr = formatDateStr(d);
        const label = getDayLabelInfo(dStr);
        if (label) {
          weekHolidays.push({ col: cIdx, dateStr: dStr, name: label.name, type: label.type });
        }
      });

      if (weekHolidays.length > 0) {
        const holTrackRow = document.createElement('div');
        holTrackRow.className = 'event-track-row';
        holTrackRow.style.marginTop = '4px';

        let i = 0;
        while (i < weekHolidays.length) {
          const startHol = weekHolidays[i];
          let endCol = startHol.col;
          let j = i + 1;
          while (j < weekHolidays.length && weekHolidays[j].col === endCol + 1 && weekHolidays[j].name === startHol.name && weekHolidays[j].type === startHol.type) {
            endCol = weekHolidays[j].col;
            j++;
          }

          const holSeg = document.createElement('div');
          holSeg.className = `holiday-bar-segment is-start is-end is-${startHol.type}`;
          holSeg.style.gridColumn = `${startHol.col + 1} / ${endCol + 2}`;
          holSeg.textContent = startHol.name;
          holSeg.title = {
            'off': `Ngày nghỉ lễ: ${startHol.name}`,
            'makeup-work': `Ngày ĐI LÀM (làm bù): ${startHol.name}`,
            'observance': `${startHol.name} - chỉ để biết, KHÔNG tính là ngày nghỉ`,
            'custom-off': 'Ngày nghỉ riêng do bạn tự đánh dấu (chuột phải vào ô ngày để bỏ)'
          }[startHol.type] || startHol.name;
          holTrackRow.appendChild(holSeg);

          i = j;
        }

        eventsLayer.appendChild(holTrackRow);
      }
    }

    weekRow.appendChild(eventsLayer);
    gridContainer.appendChild(weekRow);
  });

  if (!customContainer && typeof renderMSProjectView === 'function') {
    renderMSProjectView();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// =========================================================================
// HỆ THỐNG KÉO THẢ & QUÉT NGÀY ỔN ĐỊNH
// =========================================================================
function findDayCellFromPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const directCell = el.closest('.day-cell');
  if (directCell) return directCell;

  const weekRow = el.closest('.calendar-week-row');
  if (weekRow) {
    const cells = weekRow.querySelectorAll('.day-cell');
    for (const c of cells) {
      const rect = c.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return c;
      }
    }
  }
  return null;
}

function highlightSelection(startStr, endStr) {
  const [minD, maxD] = startStr < endStr ? [startStr, endStr] : [endStr, startStr];
  document.querySelectorAll('#calendar-grid .day-cell').forEach(cell => {
    const d = cell.dataset.date;
    if (d >= minD && d <= maxD) {
      cell.classList.add('drag-selected');
    } else {
      cell.classList.remove('drag-selected');
    }
  });
}

function clearSelectionHighlight() {
  document.querySelectorAll('#calendar-grid .day-cell').forEach(cell => {
    cell.classList.remove('drag-selected');
  });
}

function startResizing(task, type, clientX, clientY) {
  closeQuickPopover();
  isResizing = true;
  resizeTask = task;
  resizeType = type;
  resizePreviewStart = task.startDate;
  resizePreviewEnd = task.endDate;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';

  highlightSelection(resizePreviewStart, resizePreviewEnd);
  const calc = calculateTaskDays(resizePreviewStart, resizePreviewEnd, task.skipSundays !== false);
  showFloatingTooltip(`${task.title}: ${resizePreviewStart} → ${resizePreviewEnd} (${calc.workDays} ngày)`, clientX, clientY);
}

function updateResizePreview(dayStr, clientX, clientY) {
  if (!isResizing || !resizeTask) return;
  if (resizeType === 'start') {
    if (dayStr <= resizeTask.endDate) {
      resizePreviewStart = dayStr;
    }
  } else if (resizeType === 'end') {
    if (dayStr >= resizeTask.startDate) {
      resizePreviewEnd = dayStr;
    }
  }
  highlightSelection(resizePreviewStart, resizePreviewEnd);
  const calc = calculateTaskDays(resizePreviewStart, resizePreviewEnd, resizeTask.skipSundays !== false);
  showFloatingTooltip(`${resizePreviewStart} → ${resizePreviewEnd} (${calc.workDays} ngày làm việc)`, clientX, clientY);
}

function stopResizing() {
  if (!isResizing) return;
  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  hideFloatingTooltip();
  clearSelectionHighlight();

  if (resizeTask) {
    const oldStart = resizeTask.startDate;
    const oldEnd = resizeTask.endDate;
    resizeTask.startDate = resizePreviewStart;
    resizeTask.endDate = resizePreviewEnd;
    if (AppState.autoCascadeShift !== false && (oldStart !== resizeTask.startDate || oldEnd !== resizeTask.endDate)) {
      if (typeof cascadeShiftSubsequentTasks === 'function') {
        cascadeShiftSubsequentTasks(resizeTask, oldStart, oldEnd);
      }
    }
    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
  }
  resizeTask = null;
  resizeType = null;
}

// =========================================================================
// CHẾ ĐỘ QUÉT CHỌN VÙNG NHÌN ĐỂ XUẤT ẢNH & COPY CLIPBOARD
// =========================================================================
function enterInteractiveCropMode() {
  closeQuickPopover();
  isCropMode = true;
  cropStartWeekIdx = null;
  cropEndWeekIdx = null;
  document.getElementById('crop-mode-banner').classList.add('active');
  document.getElementById('btn-capture-cropped').style.display = 'none';
  document.getElementById('btn-copy-cropped').style.display = 'none';
  document.getElementById('crop-banner-instruction').innerHTML = 
    '<strong>Chế độ tạo vùng nhìn xuất ảnh:</strong> Hãy nhấn giữ chuột và quét từ <em>Hàng tuần bắt đầu</em> đến <em>Hàng tuần kết thúc</em> trên lịch...';
}

function exitInteractiveCropMode() {
  isCropMode = false;
  isDraggingCrop = false;
  cropStartWeekIdx = null;
  cropEndWeekIdx = null;
  document.getElementById('crop-mode-banner').classList.remove('active');
  document.querySelectorAll('#calendar-grid .calendar-week-row').forEach(r => {
    r.classList.remove('crop-selected-row', 'crop-dimmed-row');
  });
}

function highlightCropWeeks(sIdx, eIdx) {
  const [minW, maxW] = sIdx < eIdx ? [sIdx, eIdx] : [eIdx, sIdx];
  document.querySelectorAll('#calendar-grid .calendar-week-row').forEach(row => {
    const idx = parseInt(row.dataset.weekIndex, 10);
    if (idx >= minW && idx <= maxW) {
      row.classList.add('crop-selected-row');
      row.classList.remove('crop-dimmed-row');
    } else {
      row.classList.remove('crop-selected-row');
      row.classList.add('crop-dimmed-row');
    }
  });

  if (currentRenderedWeeks[minW] && currentRenderedWeeks[maxW]) {
    const d1 = formatDateStr(currentRenderedWeeks[minW][0]);
    const d2 = formatDateStr(currentRenderedWeeks[maxW][6]);
    document.getElementById('crop-banner-instruction').innerHTML = 
      `Đã chọn vùng nhìn: <strong>Từ ${d1} đến ${d2}</strong> (${maxW - minW + 1} hàng tuần). Chọn <strong>Copy</strong> hoặc <strong>Tải ảnh</strong> bên phải!`;
    document.getElementById('btn-capture-cropped').style.display = 'inline-flex';
    document.getElementById('btn-copy-cropped').style.display = 'inline-flex';
  }
}

function setupGridMouseInteractions() {
  const grid = document.getElementById('calendar-grid');

  grid.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.resize-handle') || e.target.closest('.task-bar-segment')) return;

    const cell = findDayCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    if (isCropMode) {
      e.preventDefault();
      isDraggingCrop = true;
      cropStartWeekIdx = parseInt(cell.dataset.weekIndex, 10);
      cropEndWeekIdx = cropStartWeekIdx;
      highlightCropWeeks(cropStartWeekIdx, cropEndWeekIdx);
      return;
    }

    e.preventDefault();
    closeQuickPopover();
    isSelecting = true;
    selectionStartStr = cell.dataset.date;
    selectionEndStr = cell.dataset.date;
    highlightSelection(selectionStartStr, selectionEndStr);

    const calc = calculateTaskDays(selectionStartStr, selectionEndStr, true);
    showFloatingTooltip(`Đang chọn: ${selectionStartStr} (${calc.workDays} ngày)`, e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isSelecting && !isResizing && !isDraggingCrop) return;

    const cell = findDayCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    const dayStr = cell.dataset.date;

    if (isDraggingCrop) {
      const wIdx = parseInt(cell.dataset.weekIndex, 10);
      if (!isNaN(wIdx) && wIdx !== cropEndWeekIdx) {
        cropEndWeekIdx = wIdx;
        highlightCropWeeks(cropStartWeekIdx, cropEndWeekIdx);
      }
      return;
    }

    if (isSelecting) {
      if (dayStr && dayStr !== selectionEndStr) {
        selectionEndStr = dayStr;
        highlightSelection(selectionStartStr, selectionEndStr);
      }
      const [minD, maxD] = selectionStartStr < selectionEndStr ? [selectionStartStr, selectionEndStr] : [selectionEndStr, selectionStartStr];
      const calc = calculateTaskDays(minD, maxD, true);
      showFloatingTooltip(`Quét chọn: ${minD} → ${maxD} (${calc.workDays} ngày làm việc)`, e.clientX, e.clientY);
      return;
    }

    if (isResizing) {
      if (dayStr) {
        updateResizePreview(dayStr, e.clientX, e.clientY);
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (isDraggingCrop) {
      isDraggingCrop = false;
      return;
    }

    if (isSelecting) {
      isSelecting = false;
      hideFloatingTooltip();
      if (selectionStartStr && selectionEndStr) {
        showQuickPopover(selectionStartStr, selectionEndStr, e.clientX, e.clientY);
      }
      return;
    }

    if (isResizing) {
      stopResizing();
    }
  });
}

// =========================================================================
// QUICK CREATE POPOVER (Có sẵn Tag 1-Click: "3D", "CHỈNH SỬA 3D", "HSKT")
// =========================================================================
let popoverColor = '#cc0000';
let currentPopoverRange = { start: '', end: '' };

function showQuickPopover(startStr, endStr, clientX, clientY) {
  const [minD, maxD] = startStr < endStr ? [startStr, endStr] : [endStr, startStr];
  currentPopoverRange = { start: minD, end: maxD };

  const activeCal = getActiveCalendar();
  popoverColor = getNextSequentialPaletteColor(activeCal.id) || activeCal.color || '#cc0000';
  renderPaletteSwatchesUI();

  const popover = document.getElementById('quick-create-popover');
  const titleInput = document.getElementById('popover-task-title');
  const dateText = document.getElementById('popover-date-range-text');
  const countSummary = document.getElementById('popover-count-summary');
  const targetCalName = document.getElementById('popover-target-cal-name');

  titleInput.value = '';
  const custName = getCurrentCustomerName() || activeCal.name;
  if (targetCalName) {
    targetCalName.textContent = custName;
    targetCalName.style.color = activeCal.color;
  }

  document.querySelectorAll('#popover-swatches .p-swatch').forEach(sw => {
    if (sw.dataset.color.toLowerCase() === popoverColor.toLowerCase()) {
      sw.classList.add('active');
    } else {
      sw.classList.remove('active');
    }
  });

  const sDate = parseDateStr(minD);
  const eDate = parseDateStr(maxD);
  dateText.textContent = `${sDate.getDate()} thg ${sDate.getMonth() + 1} - ${eDate.getDate()} thg ${eDate.getMonth() + 1}, ${eDate.getFullYear()}`;

  const calc = calculateTaskDays(minD, maxD, true);
  countSummary.textContent = `${calc.workDays} ngày làm việc (đã trừ ngày nghỉ) • ${calc.totalDays} ngày thực tế`;

  // Tự động chọn tab thư viện hoặc ẩn/hiện 3 nút thiết kế (3D / Chỉnh sửa 3D / HSKT) theo loại giai đoạn
  const normStage = normalizeVN(activeCal.name || '');
  if (AppState.hideDesignQuickTags === undefined) {
    const isConstructionStage = /thi cong|phan tho|hoan thien|noi that|ban giao/.test(normStage);
    syncPopoverDesignTagsVisibility(isConstructionStage);
  } else {
    syncPopoverDesignTagsVisibility(!!AppState.hideDesignQuickTags);
  }
  if (/phan tho|dien|nuoc|pccc/.test(normStage)) _titleLibTab = 'rough';
  else if (/hoan thien|son|tran|san/.test(normStage)) _titleLibTab = 'finish';
  else if (/noi that|xuong|do roi/.test(normStage)) _titleLibTab = 'furniture';

  if (typeof window.__renderPopoverTitleLib === 'function') window.__renderPopoverTitleLib();

  popover.style.visibility = 'hidden';
  popover.classList.add('active');
  const popWidth = popover.offsetWidth || 380;
  const popHeight = Math.min(popover.offsetHeight || 520, window.innerHeight - 24);
  let left = clientX + 12;
  let top = clientY - 80;
  if (left + popWidth > window.innerWidth - 12) left = Math.max(12, clientX - popWidth - 12);
  if (top + popHeight > window.innerHeight - 12) top = window.innerHeight - popHeight - 12;
  if (top < 12) top = 12;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.visibility = '';

  setTimeout(() => titleInput.focus(), 30);
}

// =========================================================================
// QUÉT CHỌN VÙNG NGÀY TRÊN TIMELINE (GANTT) ĐỂ TẠO CÔNG VIỆC
// Giữ chuột trái & kéo ngang trên vùng trống của 1 dòng -> chọn khoảng ngày
// -> hiện bảng tạo nhanh, việc mới thuộc dự án của dòng đó.
// Nháy đúp vào vùng trống = tạo việc 1 ngày.
// =========================================================================
let _mspTimelineInfo = null;
let _mspExportRendering = false; // Khi xuất ảnh: không kéo dài trục ngày theo màn hình, không giới hạn cột tên

function mspDateIndexFromClientX(layerEl, clientX) {
  if (!_mspTimelineInfo) return null;
  const rect = layerEl.getBoundingClientRect();
  const idx = Math.floor((clientX - rect.left) / _mspTimelineInfo.colWidth);
  return Math.max(0, Math.min(_mspTimelineInfo.count - 1, idx));
}

function mspDateFromIndex(idx) {
  const d = parseDateStr(_mspTimelineInfo.startDate);
  d.setDate(d.getDate() + idx);
  return formatDateStr(d);
}

function openGanttRangeCreate(calId, startStr, endStr, clientX, clientY) {
  if (calId && AppState.calendars.some(c => c.id === calId)) {
    AppState.activeCalendarId = calId;
    syncCustomerInputWithActiveCalendar();
  }
  showQuickPopover(startStr, endStr, clientX, clientY);
}

function setupGanttRangeSelection() {
  const layer = document.getElementById('msp-gantt-rows-layer');
  if (!layer || layer.dataset.rangeSelectReady === '1') return;
  layer.dataset.rangeSelectReady = '1';

  const isEmptyArea = (target) =>
    !target.closest('.msp-task-bar, .msp-summary-bar, .msp-bar-handle, button, input, select');

  let sel = null;

  const clearHighlight = () => {
    layer.querySelectorAll('.msp-range-select-highlight').forEach(el => el.remove());
  };

  const drawHighlight = () => {
    if (!sel) return;
    let hl = sel.rowEl.querySelector('.msp-range-select-highlight');
    if (!hl) {
      hl = document.createElement('div');
      hl.className = 'msp-range-select-highlight';
      sel.rowEl.appendChild(hl);
    }
    const a = Math.min(sel.startIdx, sel.endIdx);
    const b = Math.max(sel.startIdx, sel.endIdx);
    const cw = _mspTimelineInfo.colWidth;
    hl.style.left = `${a * cw}px`;
    hl.style.width = `${(b - a + 1) * cw}px`;
    const s = mspDateFromIndex(a);
    const e = mspDateFromIndex(b);
    const calc = calculateTaskDays(s, e, true);
    hl.textContent = cw * (b - a + 1) > 70 ? `${calc.workDays} ngày LV` : '';
    showFloatingTooltip(`${formatShortVNDate(s)} → ${formatShortVNDate(e)} • ${calc.workDays} ngày làm việc • ${calc.totalDays} ngày thực tế`, sel.lastX, sel.lastY);
  };

  layer.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !_mspTimelineInfo) return;
    const rowEl = e.target.closest('.msp-gantt-row');
    if (!rowEl || !isEmptyArea(e.target)) return;
    const idx = mspDateIndexFromClientX(layer, e.clientX);
    if (idx === null) return;
    e.preventDefault();
    clearHighlight();
    sel = { rowEl, calId: rowEl.dataset.calId, startIdx: idx, endIdx: idx, downX: e.clientX, lastX: e.clientX, lastY: e.clientY, moved: false };
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!sel) return;
      sel.lastX = ev.clientX;
      sel.lastY = ev.clientY;
      if (Math.abs(ev.clientX - sel.downX) > 4) sel.moved = true;
      if (!sel.moved) return;
      sel.endIdx = mspDateIndexFromClientX(layer, ev.clientX);
      drawHighlight();
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      hideFloatingTooltip();
      const done = sel;
      sel = null;
      if (!done || !done.moved) {
        clearHighlight();
        return;
      }
      const a = Math.min(done.startIdx, done.endIdx);
      const b = Math.max(done.startIdx, done.endIdx);
      openGanttRangeCreate(done.calId, mspDateFromIndex(a), mspDateFromIndex(b), ev.clientX, ev.clientY);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  layer.addEventListener('dblclick', (e) => {
    const rowEl = e.target.closest('.msp-gantt-row');
    if (!rowEl || !isEmptyArea(e.target) || !_mspTimelineInfo) return;
    const idx = mspDateIndexFromClientX(layer, e.clientX);
    const d = mspDateFromIndex(idx);
    openGanttRangeCreate(rowEl.dataset.calId, d, d, e.clientX, e.clientY);
  });
}

function closeQuickPopover() {
  document.querySelectorAll('.msp-range-select-highlight').forEach(el => el.remove());
  const pop = document.getElementById('quick-create-popover');
  if (pop) pop.classList.remove('active');
  clearSelectionHighlight();
}

// =========================================================================
// THƯ VIỆN TIÊU ĐỀ CÔNG VIỆC (chọn nhanh trong bảng tạo việc)
// Nhóm "Của tôi" do người dùng tự thêm, lưu cùng dữ liệu (customTaskTitles)
// =========================================================================
const TASK_TITLE_LIBRARY = [
  { key: 'design', label: 'Thiết kế', items: [
    'Khảo sát & đo đạc hiện trạng', 'Lên phương án mặt bằng bố trí', 'Concept / moodboard', 'Dựng 3D', 'Chỉnh sửa 3D',
    'Hồ sơ kỹ thuật (HSKT)', 'Dự toán - báo giá', 'Chốt vật liệu & mẫu', 'Ký hợp đồng thi công', 'Thủ tục với ban quản lý tòa nhà'
  ] },
  { key: 'prep', label: 'Chuẩn bị', items: [
    'Bàn giao mặt bằng', 'Che chắn bảo vệ công trình', 'Tháo dỡ - phá dỡ', 'Vận chuyển phế thải', 'Định vị - lấy dấu tim mốc'
  ] },
  { key: 'rough', label: 'Phần thô & M&E', items: [
    'Xây tường - chèn tường', 'Đục tường - cắt rãnh', 'Thi công điện (đi dây âm tường)', 'Thi công điện nhẹ (mạng, camera, âm thanh)',
    'Thi công cấp thoát nước', 'Thi công điều hòa (ống đồng, thoát nước)', 'Thi công PCCC (sprinkler, báo cháy)',
    'Chống thấm WC / ban công / mái', 'Trát tường', 'Cán nền', 'Nghiệm thu phần thô'
  ] },
  { key: 'finish', label: 'Hoàn thiện', items: [
    'Thi công trần thạch cao', 'Thi công vách thạch cao', 'Ốp lát gạch', 'Lát sàn gỗ / sàn nhựa', 'Bả matit - sơn lót', 'Sơn hoàn thiện',
    'Giấy dán tường', 'Phào chỉ trần / chân tường', 'Ốp đá (bếp, lavabo, cầu thang)', 'Lắp cửa gỗ / cửa nhôm kính',
    'Lắp vách kính - kính tắm', 'Lắp thiết bị vệ sinh', 'Lắp thiết bị điện (công tắc, ổ cắm, đèn)', 'Lắp điều hòa & thiết bị'
  ] },
  { key: 'furniture', label: 'Nội thất', items: [
    'Đo đạc sản xuất đồ nội thất', 'Sản xuất đồ nội thất tại xưởng', 'Kiểm tra đồ tại xưởng', 'Vận chuyển & lắp đặt nội thất',
    'Đặt hàng đồ rời (sofa, bàn ghế, rèm)', 'Lắp rèm cửa', 'Lắp đặt đồ rời & decor', 'Thi công biển - logo'
  ] },
  { key: 'handover', label: 'Bàn giao', items: [
    'Vệ sinh công nghiệp', 'Kiểm tra - chạy thử thiết bị', 'Sửa lỗi tồn đọng (defect)', 'Nghiệm thu tổng thể', 'Bàn giao', 'Bảo hành'
  ] }
];
let _titleLibTab = 'design';

function normalizeVN(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function getTitleLibraryGroups() {
  const custom = Array.isArray(AppState.customTaskTitles) ? AppState.customTaskTitles : [];
  return [{ key: 'mine', label: '⭐ Của tôi', items: custom }, ...TASK_TITLE_LIBRARY];
}

function renderTitleLibrary(onPick) {
  const tabsEl = document.getElementById('title-lib-tabs');
  const listEl = document.getElementById('title-lib-list');
  const input = document.getElementById('popover-task-title');
  if (!tabsEl || !listEl) return;
  const groups = getTitleLibraryGroups();
  const q = normalizeVN(input ? input.value : '');

  tabsEl.innerHTML = '';
  groups.forEach(g => {
    if (g.key === 'mine' && g.items.length === 0) return;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `title-lib-tab ${!q && _titleLibTab === g.key ? 'active' : ''}`;
    tab.textContent = g.label;
    tab.addEventListener('click', () => {
      _titleLibTab = g.key;
      if (input) input.value = '';
      renderTitleLibrary(onPick);
    });
    tabsEl.appendChild(tab);
  });
  tabsEl.style.display = q ? 'none' : '';

  let items = [];
  if (q) {
    groups.forEach(g => g.items.forEach(t => {
      if (normalizeVN(t).includes(q) && !items.some(x => x.title === t)) items.push({ title: t, mine: g.key === 'mine' });
    }));
    items = items.slice(0, 40);
  } else {
    let g = groups.find(x => x.key === _titleLibTab);
    if (!g || g.items.length === 0) { g = groups.find(x => x.key === 'design'); _titleLibTab = 'design'; }
    items = g.items.map(t => ({ title: t, mine: g.key === 'mine' }));
  }

  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'title-lib-empty';
    empty.textContent = 'Không có mẫu khớp. Bấm Enter để tạo việc với tên vừa gõ, hoặc lưu vào "Của tôi".';
    listEl.appendChild(empty);
    return;
  }
  items.forEach(it => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `title-lib-chip ${it.mine ? 'is-mine' : ''}`;
    chip.textContent = it.title;
    chip.title = it.mine ? 'Bấm để tạo việc ngay • Chuột phải để xoá khỏi "Của tôi"' : 'Bấm để tạo việc ngay với tiêu đề này';
    chip.addEventListener('click', () => onPick(it.title));
    if (it.mine) {
      chip.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (await GDHomeShell.confirm({ message: `Xoá "${it.title}" khỏi danh sách "Của tôi"?`, okText: 'Xoá', danger: true })) {
          AppState.customTaskTitles = (AppState.customTaskTitles || []).filter(t => t !== it.title);
          saveToBackend();
          renderTitleLibrary(onPick);
        }
      });
    }
    listEl.appendChild(chip);
  });
}

function addCustomTaskTitle(title) {
  const t = String(title || '').trim();
  if (!t) return false;
  if (!Array.isArray(AppState.customTaskTitles)) AppState.customTaskTitles = [];
  if (AppState.customTaskTitles.some(x => normalizeVN(x) === normalizeVN(t))) return false;
  AppState.customTaskTitles.unshift(t);
  AppState.customTaskTitles = AppState.customTaskTitles.slice(0, 80);
  return true;
}

function syncPopoverDesignTagsVisibility(hideTags) {
  const tagsBox = document.getElementById('popover-instant-tags');
  const toggleBtn = document.getElementById('btn-toggle-design-tags');
  if (tagsBox) tagsBox.style.display = hideTags ? 'none' : '';
  if (toggleBtn) {
    toggleBtn.textContent = hideTags ? 'Hiện nút 3D/HSKT' : 'Ẩn nút TK';
  }
}

function setupQuickPopoverEvents() {
  document.getElementById('btn-close-popover').addEventListener('click', closeQuickPopover);
  const btnToggleDesignTags = document.getElementById('btn-toggle-design-tags');
  if (btnToggleDesignTags) {
    btnToggleDesignTags.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagsBox = document.getElementById('popover-instant-tags');
      const currentlyHidden = tagsBox && tagsBox.style.display === 'none';
      AppState.hideDesignQuickTags = !currentlyHidden;
      syncPopoverDesignTagsVisibility(AppState.hideDesignQuickTags);
    });
  }

  // 1-Click Tag ("3D" -> Đỏ, "CHỈNH SỬA 3D" -> Cam, "HSKT" -> Xanh):
  // Bấm vào là tự ghép với tên khách hàng + màu chuẩn và hoàn tất luôn!
  document.querySelectorAll('.instant-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const tagColor = btn.dataset.color;
      const fullTitle = formatStageTitleWithCustomer(prefix);
      const activeCal = getActiveCalendar();
      activeCal.visible = true;

      snapshotState();
      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: activeCal.id,
        title: fullTitle,
        startDate: currentPopoverRange.start,
        endDate: currentPopoverRange.end,
        color: tagColor,
        skipSundays: true,
        showCount: true,
        note: '',
        predecessors: []
      });

      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
      closeQuickPopover();
      showToast(`Đã tạo: ${fullTitle}`);
    });
  });

  // Nút thêm giai đoạn mới không liền nhau vào chính dự án đang chọn
  const btnAppendSame = document.getElementById('btn-popover-append-same-project');
  if (btnAppendSame) {
    btnAppendSame.addEventListener('click', () => {
      const activeCal = getActiveCalendar();
      activeCal.visible = true;
      const rawTitle = document.getElementById('popover-task-title').value.trim();
      const title = rawTitle || formatStageTitleWithCustomer('Giai đoạn bổ sung');

      snapshotState();
      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: activeCal.id,
        title,
        startDate: currentPopoverRange.start,
        endDate: currentPopoverRange.end,
        color: popoverColor,
        skipSundays: true,
        showCount: true,
        note: '',
        predecessors: []
      });

      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
      closeQuickPopover();
      showToast(`Đã thêm giai đoạn (${currentPopoverRange.start} → ${currentPopoverRange.end}) vào dự án "${activeCal.name}"!`);
    });
  }

  const pSwatches = document.querySelectorAll('.p-swatch');
  pSwatches.forEach(sw => {
    sw.addEventListener('click', () => {
      pSwatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      popoverColor = sw.dataset.color;
    });
  });

  const saveQuickTask = () => {
    const activeCal = getActiveCalendar();
    activeCal.visible = true;
    const rawTitle = document.getElementById('popover-task-title').value.trim();
    const title = rawTitle || formatStageTitleWithCustomer('3D');
    AppState.tasks.push({
      id: 'task_' + Date.now(),
      calendarId: activeCal.id,
      title,
      startDate: currentPopoverRange.start,
      endDate: currentPopoverRange.end,
      color: popoverColor,
      skipSundays: true,
      showCount: true,
      note: '',
      predecessors: []
    });

    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeQuickPopover();
  };

  document.getElementById('btn-popover-save').addEventListener('click', saveQuickTask);

  // Thư viện tiêu đề: bấm 1 lần là tạo việc với tiêu đề đó
  const pickTitle = (title) => {
    document.getElementById('popover-task-title').value = title;
    saveQuickTask();
    showToast(`Đã tạo: ${title}`);
  };
  window.__renderPopoverTitleLib = () => renderTitleLibrary(pickTitle);
  document.getElementById('popover-task-title').addEventListener('input', () => renderTitleLibrary(pickTitle));
  const btnLibAdd = document.getElementById('btn-title-lib-add');
  if (btnLibAdd) {
    btnLibAdd.addEventListener('click', () => {
      const v = document.getElementById('popover-task-title').value.trim();
      if (!v) {
        showToast('Gõ tên việc vào ô phía trên trước, rồi bấm lưu.');
        return;
      }
      if (addCustomTaskTitle(v)) {
        saveToBackend();
        _titleLibTab = 'mine';
        document.getElementById('popover-task-title').value = '';
        renderTitleLibrary(pickTitle);
        showToast(`Đã lưu "${v}" vào nhóm "Của tôi"`);
      } else {
        showToast('Tiêu đề này đã có trong "Của tôi".');
      }
    });
  }
  document.getElementById('popover-task-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveQuickTask();
    } else if (e.key === 'Escape') {
      closeQuickPopover();
    }
  });

  document.getElementById('btn-popover-more').addEventListener('click', () => {
    const preTitle = document.getElementById('popover-task-title').value.trim();
    const range = { ...currentPopoverRange };
    closeQuickPopover();
    openTaskModal(null, range.start);
    document.getElementById('task-start-date').value = range.start;
    document.getElementById('task-end-date').value = range.end;
    if (preTitle) document.getElementById('task-title').value = preTitle;
    updateModalDaysCount();
  });
}

// =========================================================================
// MODAL CHI TIẾT CÔNG VIỆC
// =========================================================================
let selectedColor = '#cc0000';

function updateModalDaysCount() {
  const s = document.getElementById('task-start-date').value;
  const e = document.getElementById('task-end-date').value;
  const skip = document.getElementById('task-skip-sundays').checked;
  const calc = calculateTaskDays(s, e, skip);

  document.getElementById('calculated-days-count').textContent = `${calc.workDays} ngày`;
  document.getElementById('calculated-total-span').textContent = `(Tổng cả ngày nghỉ: ${calc.totalDays} ngày)`;
}

function selectSwatchColorInModal(colorHex) {
  selectedColor = colorHex;
  const customPicker = document.getElementById('custom-color-picker');
  if (customPicker) customPicker.value = selectedColor;
  document.querySelectorAll('#color-palette .color-swatch').forEach(s => {
    if (s.dataset.color.toLowerCase() === selectedColor.toLowerCase()) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });
}

function setupColorPalette() {
  const customPicker = document.getElementById('custom-color-picker');
  const modalPaletteSelect = document.getElementById('modal-palette-select');

  renderPaletteSwatchesUI();

  if (modalPaletteSelect) {
    modalPaletteSelect.addEventListener('change', (e) => {
      AppState.colorPaletteTheme = e.target.value || 'default';
      saveToStorage();
      renderPaletteSwatchesUI();
      const nextCol = getNextSequentialPaletteColor(document.getElementById('task-calendar-select')?.value || AppState.activeCalendarId);
      selectSwatchColorInModal(nextCol);
    });
  }

  customPicker.addEventListener('input', (e) => {
    document.querySelectorAll('#color-palette .color-swatch').forEach(s => s.classList.remove('active'));
    selectedColor = e.target.value;
  });

  // Các nút Tag trong Modal (3D, CHỈNH SỬA 3D, HSKT)
  document.querySelectorAll('#modal-stage-tags .stage-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const color = btn.dataset.color;
      document.getElementById('task-title').value = formatStageTitleWithCustomer(prefix);
      selectSwatchColorInModal(color);
    });
  });

  document.getElementById('task-start-date').addEventListener('change', updateModalDaysCount);
  document.getElementById('task-end-date').addEventListener('change', updateModalDaysCount);
  document.getElementById('task-skip-sundays').addEventListener('change', updateModalDaysCount);
}

function populateCalendarSelectDropdown(selectedCalId) {
  const selectEl = document.getElementById('task-calendar-select');
  if (!selectEl) return;
  selectEl.innerHTML = '';
  // Chỉ hiện các dự án thuộc cùng nhóm "Dự án của ..." với dự án đang chọn -> tránh lẫn lộn
  const refCal = AppState.calendars.find(c => c.id === selectedCalId) || getActiveCalendar();
  const ownerId = refCal ? refCal.ownerId : null;
  const list = AppState.calendars.filter(c => !ownerId || c.ownerId === ownerId || c.id === selectedCalId);
  list.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.id;
    opt.textContent = cal.name;
    if (cal.id === selectedCalId) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function openTaskModal(task = null, defaultStartDate = null, presetCalendarId = null) {
  const modal = document.getElementById('task-modal');
  const modalTitle = document.getElementById('modal-task-title');
  const taskIdInput = document.getElementById('task-id');
  const titleInput = document.getElementById('task-title');
  const startInput = document.getElementById('task-start-date');
  const endInput = document.getElementById('task-end-date');
  const noteInput = document.getElementById('task-note');
  const assigneeInput = document.getElementById('task-assignee');
  // Gợi ý tên người đã dùng ở các việc khác
  document.getElementById('task-assignee-list').innerHTML = [...new Set(AppState.tasks.flatMap(t => String(t.assignee || '').split(',').map(n => n.trim()).filter(Boolean)))]
    .sort().map(name => '<option value="' + escapeHtml(name) + '">').join('');
  const progressSelect = document.getElementById('task-progress');
  const deleteBtn = document.getElementById('btn-delete-task');
  const skipSundaysCheckbox = document.getElementById('task-skip-sundays');
  const showCountCheckbox = document.getElementById('task-show-count');

  const activeCal = getActiveCalendar();
  const targetCalId = presetCalendarId || activeCal.id;
  const targetCal = AppState.calendars.find(c => c.id === targetCalId) || activeCal;

  if (task) {
    modalTitle.textContent = 'Chỉnh sửa tiến độ công việc';
    taskIdInput.value = task.id;
    populateCalendarSelectDropdown(task.calendarId || targetCal.id);
    titleInput.value = task.title;
    startInput.value = task.startDate;
    endInput.value = task.endDate;
    noteInput.value = task.note || '';
    assigneeInput.value = task.assignee || '';
    if (progressSelect) progressSelect.value = String(task.progress || 0);
    selectSwatchColorInModal(task.color || targetCal.color || '#cc0000');
    skipSundaysCheckbox.checked = task.skipSundays !== false;
    showCountCheckbox.checked = task.showCount !== false;
    deleteBtn.style.display = 'block';
  } else {
    modalTitle.textContent = 'Thêm công việc tiến độ mới';
    taskIdInput.value = '';
    populateCalendarSelectDropdown(targetCal.id);
    const custSuffix = targetCal.name && targetCal.name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? ` - ${targetCal.name}` : '';
    titleInput.value = `3D${custSuffix}`;
    const defStart = defaultStartDate || formatDateStr(new Date());
    startInput.value = defStart;
    
    const defEnd = parseDateStr(defStart);
    defEnd.setDate(defEnd.getDate() + 3);
    endInput.value = formatDateStr(defEnd);

    noteInput.value = '';
    assigneeInput.value = '';
    if (progressSelect) progressSelect.value = '0';
    renderPaletteSwatchesUI();
    selectSwatchColorInModal(getNextSequentialPaletteColor(targetCal.id));
    skipSundaysCheckbox.checked = true;
    showCountCheckbox.checked = true;
    deleteBtn.style.display = 'none';
  }

  updateModalDaysCount();
  modal.classList.add('active');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('active');
}

// =========================================================================
// CÀI ĐẶT BRANDING & LOGO CHUẨN ĐỎ ĐEN GD HOME
// =========================================================================
function updateCompanyBranding() {
  renderScheduleText();
  document.getElementById('footer-note-text').textContent = AppState.footerNote || '';
  const mspNote = document.getElementById('msp-footer-note-text');
  if (mspNote) mspNote.textContent = AppState.footerNote || '';

  const logoContainer = document.getElementById('footer-logo-container');
  const mspLogoContainer = document.getElementById('msp-footer-logo-container');
  let logoHtml = `<img src="gdhome-logo.png" alt="GD HOME" class="gdhome-full-logo-img">`;
  if (AppState.companyLogo) {
    logoHtml = `<img src="${AppState.companyLogo}" alt="Logo" class="gdhome-full-logo-img">`;
  } else if (AppState.companyName && AppState.companyName.toUpperCase() !== 'GD HOME') {
    logoHtml = `<img src="gdhome-icon.png" alt="Icon" style="height:56px; object-fit:contain;"> <span class="brand-text">${AppState.companyName}</span>`;
  }
  if (logoContainer) logoContainer.innerHTML = logoHtml;
  if (mspLogoContainer) mspLogoContainer.innerHTML = logoHtml;
  for (const container of [logoContainer,mspLogoContainer]) {
    const logo = container?.querySelector('img');
    if (!logo) continue;
    logo.tabIndex = 0;
    logo.setAttribute('role','button');
    logo.setAttribute('aria-label','Xem logo lớn');
    logo.classList.add('shell-image-trigger');
    const show = () => GDHomeShell.lightbox({
      title:'Logo GD HOME',count:() => 1,
      render(_index,figure) {
        const image = document.createElement('img');
        image.src = logo.src;
        image.alt = logo.alt;
        figure.append(image);
      }
    });
    logo.onclick = show;
    logo.onkeydown = event => {
      if (!['Enter',' '].includes(event.key)) return;
      event.preventDefault();
      show();
    };
  }
}

// =========================================================================
// XUẤT ẢNH & COPY VÀO CLIPBOARD (DÁN TRỰC TIẾP SANG PHẦN MỀM KHÁC)
// =========================================================================
function setupExportModal() {
  const exportModal = document.getElementById('export-modal');
  const btnOpen = document.getElementById('btn-open-export-modal');
  const btnClose = document.getElementById('btn-close-export-modal');
  const btnCancel = document.getElementById('btn-cancel-export');
  const btnConfirmDownload = document.getElementById('btn-confirm-export');
  const btnCopyModal = document.getElementById('btn-copy-export-clipboard');
  const btnQuickCopyHeader = document.getElementById('btn-quick-copy-clipboard');
  const btnStartCropHeader = document.getElementById('btn-start-crop-export');

  const customRangeRow = document.getElementById('export-custom-range-row');
  const scopeRadios = document.querySelectorAll('input[name="export-scope"]');

  btnOpen.addEventListener('click', () => {
    if (currentRenderedWeeks.length > 0) {
      document.getElementById('export-start-date').value = formatDateStr(currentRenderedWeeks[0][0]);
      document.getElementById('export-end-date').value = formatDateStr(currentRenderedWeeks[currentRenderedWeeks.length - 1][6]);
    }
    exportModal.classList.add('active');
  });

  btnClose.addEventListener('click', () => exportModal.classList.remove('active'));
  btnCancel.addEventListener('click', () => exportModal.classList.remove('active'));

  // Nút Copy nhanh trên thanh công cụ Header
  if (btnQuickCopyHeader) {
    btnQuickCopyHeader.addEventListener('click', () => {
      if (AppState.viewMode === 'msproject') {
        exportMSProjectSheet(2, 'clipboard');
      } else {
        executeExportWeeksSlice(getWeeksWithTasks(currentRenderedWeeks), true, 2, 'clipboard');
      }
    });
  }

  if (btnStartCropHeader) {
    btnStartCropHeader.addEventListener('click', () => {
      if (AppState.viewMode === 'msproject') {
        switchViewMode('calendar');
      }
      enterInteractiveCropMode();
    });
  }

  document.getElementById('btn-cancel-crop').addEventListener('click', () => {
    exitInteractiveCropMode();
  });

  document.getElementById('btn-capture-cropped').addEventListener('click', () => {
    if (cropStartWeekIdx === null || cropEndWeekIdx === null) return;
    const [minW, maxW] = cropStartWeekIdx < cropEndWeekIdx ? [cropStartWeekIdx, cropEndWeekIdx] : [cropEndWeekIdx, cropStartWeekIdx];
    const selectedWeeksSlice = currentRenderedWeeks.slice(minW, maxW + 1);
    exitInteractiveCropMode();
    executeExportWeeksSlice(selectedWeeksSlice, true, 2, 'download');
  });

  document.getElementById('btn-copy-cropped').addEventListener('click', () => {
    if (cropStartWeekIdx === null || cropEndWeekIdx === null) return;
    const [minW, maxW] = cropStartWeekIdx < cropEndWeekIdx ? [cropStartWeekIdx, cropEndWeekIdx] : [cropEndWeekIdx, cropStartWeekIdx];
    const selectedWeeksSlice = currentRenderedWeeks.slice(minW, maxW + 1);
    exitInteractiveCropMode();
    executeExportWeeksSlice(selectedWeeksSlice, true, 2, 'clipboard');
  });

  scopeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'custom-date') {
        customRangeRow.style.opacity = '1';
        customRangeRow.style.pointerEvents = 'auto';
      } else {
        customRangeRow.style.opacity = '0.5';
        customRangeRow.style.pointerEvents = 'none';
      }
    });
  });

  const handleModalExportAction = (mode) => {
    const scope = document.querySelector('input[name="export-scope"]:checked').value;
    const incFooter = document.getElementById('export-include-footer').checked;
    const scale = document.getElementById('export-high-res').checked ? 2 : 1;

    exportModal.classList.remove('active');

    if (AppState.viewMode === 'msproject') {
      exportMSProjectSheet(scale, mode);
      return;
    }

    if (scope === 'interactive-crop') {
      enterInteractiveCropMode();
      return;
    }

    if (scope === 'all') {
      executeExportWeeksSlice(getWeeksWithTasks(currentRenderedWeeks), incFooter, scale, mode);
    } else if (scope === 'custom-date') {
      const sD = document.getElementById('export-start-date').value;
      const eD = document.getElementById('export-end-date').value;
      if (!sD || !eD || sD > eD) {
        GDHomeShell.alert('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc!');
        return;
      }
      const customWeeks = generateWeeksBetweenDates(sD, eD);
      executeExportWeeksSlice(customWeeks, incFooter, scale, mode);
    }
  };

  btnConfirmDownload.addEventListener('click', () => handleModalExportAction('download'));
  document.getElementById('btn-print-export').onclick = () => handleModalExportAction('print');
  if (btnCopyModal) {
    btnCopyModal.addEventListener('click', () => handleModalExportAction('clipboard'));
  }
}

// Copy / xuất ảnh Bảng Lịch: chỉ giữ các tuần có công việc, bỏ qua các tuần trống (cả đầu, cuối và ở giữa)
function getWeeksWithTasks(weeks) {
  if (!Array.isArray(weeks) || weeks.length === 0) return weeks;
  const tasks = getVisibleTasks();
  if (tasks.length === 0) return weeks;
  const kept = weeks.filter(week => {
    const wStart = formatDateStr(week[0]);
    const wEnd = formatDateStr(week[week.length - 1]);
    return tasks.some(t => t.startDate <= wEnd && t.endDate >= wStart);
  });
  return kept.length > 0 ? kept : weeks;
}

function executeExportWeeksSlice(weeksSlice, includeBranding = true, scale = 2, mode = 'download') {
  const activeBtn = mode === 'clipboard' ? document.getElementById('btn-quick-copy-clipboard') : document.getElementById('btn-open-export-modal');
  const originalText = activeBtn ? activeBtn.innerHTML : '';
  if (activeBtn) {
    activeBtn.innerHTML = mode === 'clipboard' ? 'Đang copy...' : 'Đang tạo ảnh...';
    activeBtn.disabled = true;
  }

  const cloneSheet = document.createElement('div');
  cloneSheet.className = 'schedule-sheet';
  cloneSheet.style.width = '1200px';
  cloneSheet.style.position = 'fixed';
  cloneSheet.style.left = '-9999px';
  cloneSheet.style.top = '0';
  cloneSheet.style.background = '#ffffff';

  // Tiêu đề trên cùng: TIẾN ĐỘ THIẾT KẾ DỰ KIẾN - TÊN KHÁCH HÀNG + Tháng lập bảng bên trái
  if (includeBranding) {
    const topBannerClone = document.createElement('div');
    topBannerClone.className = 'sheet-top-banner';
    const custName = getTitleProjectName('calendar') || '';
    const monthText = getScheduleMonthText();
    topBannerClone.innerHTML = `
      <div class="sheet-banner-left">
        <span class="schedule-month-display">${escapeHtml(monthText)}</span>
      </div>
      <div class="sheet-banner-title">
        <span class="banner-prefix">${escapeHtml(scheduleTextValue('designCustomTitlePrefix'))} </span>
        ${custName ? `<span style="font-size:22px; font-weight:800; color:#b91d14; letter-spacing:0.5px; text-transform:uppercase;">${escapeHtml(custName)}</span>` : ''}
      </div>
    `;
    const contact = projectContactText('calendar');
    if (contact) {
      const summary = document.createElement('small');
      summary.className = 'project-summary';
      summary.textContent = contact;
      topBannerClone.append(summary);
    }
    cloneSheet.appendChild(topBannerClone);
  }

  const headerClone = document.querySelector('.calendar-week-header').cloneNode(true);
  headerClone.style.position = 'static';
  cloneSheet.appendChild(headerClone);

  const weeksGridClone = document.createElement('div');
  weeksGridClone.className = 'calendar-weeks-container';
  cloneSheet.appendChild(weeksGridClone);

  if (includeBranding) {
    const footerClone = document.querySelector('.schedule-footer').cloneNode(true);
    cloneSheet.appendChild(footerClone);
  }

  document.body.appendChild(cloneSheet);
  renderCalendar(weeksSlice, weeksGridClone);

  const firstD = weeksSlice.length > 0 ? formatDateStr(weeksSlice[0][0]) : 'start';
  const lastD = weeksSlice.length > 0 ? formatDateStr(weeksSlice[weeksSlice.length - 1][6]) : 'end';

  setTimeout(() => {
    html2canvas(cloneSheet, {
      scale: scale,
      useCORS: true,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }

      if (mode === 'print') {
        printExportCanvas(canvas,AppState.exportWatermark !== false);
      } else if (mode === 'clipboard') {
        copyCanvasToClipboard(canvas, { watermark: AppState.exportWatermark !== false, notify: showToast });
      } else {
        downloadCanvas(canvas, `Bang_Tien_Do_${firstD}_den_${lastD}.png`, AppState.exportWatermark !== false);
        showToast('Đã tải xuống file ảnh PNG thành công!');
      }
    }).catch(err => {
      document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }
      GDHomeShell.alert('Lỗi kết xuất ảnh: ' + err.message);
    });
  }, 150);
}

// Sọc chéo chìm mờ phủ toàn bộ ảnh (chống chỉnh sửa / cắt ghép)
// =========================================================================
// ĐIỀU KHIỂN VÙNG NHÌN LỊCH & EVENTS
// =========================================================================
function setupEvents() {
  // Đóng/mở các menu thả xuống trên thanh Header (Chọn tháng, File ▾, Copy ảnh ▾)
  const closeAllHeaderDropdowns = (exceptEl = null) => {
    document.querySelectorAll('.hdr-dropdown.open').forEach(dd => {
      if (dd !== exceptEl) dd.classList.remove('open');
    });
  };
  document.querySelectorAll('.hdr-dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentDd = btn.closest('.hdr-dropdown');
      if (!parentDd) return;
      const willOpen = !parentDd.classList.contains('open');
      closeAllHeaderDropdowns(parentDd);
      parentDd.classList.toggle('open', willOpen);
    });
  });
  document.querySelectorAll('.hdr-dropdown-menu .hdr-menu-item').forEach(item => {
    item.addEventListener('click', () => closeAllHeaderDropdowns());
  });
  document.querySelectorAll('.range-selector-popover').forEach(pop => {
    pop.addEventListener('click', (e) => e.stopPropagation());
  });
  document.addEventListener('click', () => closeAllHeaderDropdowns());

  document.getElementById('btn-apply-range').addEventListener('click', () => {
    const s = document.getElementById('start-month-input').value;
    const e = document.getElementById('end-month-input').value;
    if (!s || !e) return;
    if (s > e) {
      GDHomeShell.alert('Tháng bắt đầu phải trước tháng kết thúc!');
      return;
    }
    AppState.startMonth = s;
    AppState.endMonth = e;
    AppState.extraWeeksTop = 0;
    AppState.extraWeeksBottom = 1;

    // Tháng lập bảng luôn theo lịch hiện tại (không đổi theo khoảng tháng đang xem)

    closeAllHeaderDropdowns();
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-week-top').addEventListener('click', () => {
    AppState.extraWeeksTop = (AppState.extraWeeksTop || 0) + 1;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-sub-week-top').addEventListener('click', () => {
    AppState.extraWeeksTop = (AppState.extraWeeksTop || 0) - 1;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-month-top').addEventListener('click', () => {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const prevM = new Date(sy, sm - 2, 1);
    AppState.startMonth = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('start-month-input').value = AppState.startMonth;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-week-bottom').addEventListener('click', () => {
    AppState.extraWeeksBottom = (AppState.extraWeeksBottom || 0) + 1;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-sub-week-bottom').addEventListener('click', () => {
    AppState.extraWeeksBottom = Math.max(0, (AppState.extraWeeksBottom || 0) - 1);
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-month-bottom').addEventListener('click', () => {
    const [ey, em] = AppState.endMonth.split('-').map(Number);
    const nextM = new Date(ey, em, 1);
    AppState.endMonth = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  const toggleHolidays = document.getElementById('toggle-vn-holidays');
  if (toggleHolidays) {
    toggleHolidays.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, sunday: true };
      AppState.daysOffConfig.holidays = e.target.checked;
      AppState.showVnHolidays = e.target.checked;
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleOffSat = document.getElementById('toggle-off-saturday');
  const toggleOffSatHalf = document.getElementById('toggle-off-saturday-half');

  if (toggleOffSat) {
    toggleOffSat.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, saturdayHalf: false, sunday: true };
      AppState.daysOffConfig.saturday = e.target.checked;
      if (e.target.checked) {
        AppState.daysOffConfig.saturdayHalf = false;
        if (toggleOffSatHalf) toggleOffSatHalf.checked = false;
      }
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  if (toggleOffSatHalf) {
    toggleOffSatHalf.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, saturdayHalf: false, sunday: true };
      AppState.daysOffConfig.saturdayHalf = e.target.checked;
      if (e.target.checked) {
        AppState.daysOffConfig.saturday = false;
        if (toggleOffSat) toggleOffSat.checked = false;
      }
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleOffSun = document.getElementById('toggle-off-sunday');
  if (toggleOffSun) {
    toggleOffSun.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, saturdayHalf: false, sunday: true };
      AppState.daysOffConfig.sunday = e.target.checked;
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleLunar = document.getElementById('toggle-lunar-dates');
  if (toggleLunar) {
    toggleLunar.addEventListener('change', (e) => {
      AppState.showLunarDates = e.target.checked;
      saveToBackend();
      renderCalendar();
    });
  }

  document.getElementById('btn-add-task').addEventListener('click', () => {
    openTaskModal();
  });

  document.getElementById('btn-close-task-modal').addEventListener('click', closeTaskModal);
  document.getElementById('btn-cancel-task').addEventListener('click', closeTaskModal);

  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const calId = document.getElementById('task-calendar-select').value || AppState.activeCalendarId;
    const title = document.getElementById('task-title').value.trim();
    const startDate = document.getElementById('task-start-date').value;
    const endDate = document.getElementById('task-end-date').value;
    const note = document.getElementById('task-note').value.trim();
    const assignee = document.getElementById('task-assignee').value.split(',').map(n => n.trim()).filter(Boolean).join(', ');
    const skipSundays = document.getElementById('task-skip-sundays').checked;
    const showCount = document.getElementById('task-show-count').checked;
    const progressEl = document.getElementById('task-progress');
    const progress = progressEl ? parseInt(progressEl.value || '0', 10) : 0;

    if (startDate > endDate) {
      GDHomeShell.alert('Ngày bắt đầu không được sau ngày kết thúc!');
      return;
    }

    if (id) {
      const task = AppState.tasks.find(t => t.id === id);
      if (task) {
        const oldStart = task.startDate;
        const oldEnd = task.endDate;
        const oldWorkDays = Math.max(1, countWorkingDays(oldStart, oldEnd, task.skipSundays !== false));
        task.calendarId = calId;
        task.title = title;
        task.startDate = startDate;
        // Nếu người dùng chỉ đổi ngày bắt đầu mà chưa đổi ngày kết thúc (hoặc giữ nguyên số ngày làm việc khi dịch chuyển):
        if (startDate !== oldStart && endDate === oldEnd && AppState.autoCascadeShift !== false) {
          task.endDate = computeEndDateByWorkingDays(startDate, oldWorkDays, skipSundays);
        } else {
          task.endDate = endDate;
        }
        task.color = selectedColor;
        task.skipSundays = skipSundays;
        task.showCount = showCount;
        task.progress = progress;
        task.note = note;
        task.assignee = assignee;
        if (AppState.autoCascadeShift !== false && (oldStart !== task.startDate || oldEnd !== task.endDate)) {
          if (typeof cascadeShiftSubsequentTasks === 'function') {
            cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          }
        }
      }
    } else {
      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: calId,
        title,
        startDate,
        endDate,
        color: selectedColor,
        skipSundays,
        showCount,
        progress,
        note,
        assignee
      });
    }

    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeTaskModal();
  });

  document.getElementById('btn-delete-task').addEventListener('click', async () => {
    const id = document.getElementById('task-id').value;
    const task = id && AppState.tasks.find(t => t.id === id);
    if (task && await confirmAndDeleteTasks([task])) closeTaskModal();
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    AppState.startMonth = `${y}-${m}`;
    const next3Months = new Date(y, now.getMonth() + 3, 1);
    const ey = next3Months.getFullYear();
    const em = String(next3Months.getMonth() + 1).padStart(2, '0');
    AppState.endMonth = `${ey}-${em}`;
    AppState.extraWeeksTop = 0;
    AppState.extraWeeksBottom = 1;
    document.getElementById('start-month-input').value = AppState.startMonth;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const [ey, em] = AppState.endMonth.split('-').map(Number);
    const newStart = new Date(sy, sm - 2, 1);
    const newEnd = new Date(ey, em - 2, 1);
    AppState.startMonth = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}`;
    AppState.endMonth = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('start-month-input').value = AppState.startMonth;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const [ey, em] = AppState.endMonth.split('-').map(Number);
    const newStart = new Date(sy, sm, 1);
    const newEnd = new Date(ey, em, 1);
    AppState.startMonth = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}`;
    AppState.endMonth = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('start-month-input').value = AppState.startMonth;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  const settingsModal = document.getElementById('settings-modal');
  document.getElementById('btn-project-settings').addEventListener('click', () => {
    document.getElementById('setting-company-name').value = AppState.companyName;
    document.getElementById('setting-note-text').value = AppState.footerNote;
    for (const field of Object.keys(scheduleTextDefaults)) document.getElementById('setting-'+field).value = scheduleTextValue(field);
    settingsModal.classList.add('active');
  });

  document.getElementById('btn-close-settings-modal').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });
  document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  const resetLogoBtn = document.getElementById('btn-reset-default-logo');
  if (resetLogoBtn) {
    resetLogoBtn.addEventListener('click', () => {
      AppState.companyLogo = null;
      AppState.companyName = 'GD HOME';
      document.getElementById('setting-company-name').value = 'GD HOME';
      saveToBackend();
      updateCompanyBranding();
      showToast('Đã khôi phục về Logo GD HOME chuẩn đỏ đen!');
    });
  }

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    AppState.companyName = document.getElementById('setting-company-name').value.trim() || 'GD HOME';
    AppState.footerNote = document.getElementById('setting-note-text').value.trim();
    for (const field of Object.keys(scheduleTextDefaults)) setScheduleText(field,document.getElementById('setting-'+field).value.trim());

    const logoFile = document.getElementById('setting-logo-file').files[0];
    if (logoFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        AppState.companyLogo = event.target.result;
        saveToBackend();
        updateCompanyBranding();
        settingsModal.classList.remove('active');
      };
      reader.readAsDataURL(logoFile);
    } else {
      saveToBackend();
      updateCompanyBranding();
      settingsModal.classList.remove('active');
    }
  });

  document.getElementById('footer-note-text').addEventListener('blur', (e) => {
    AppState.footerNote = e.target.textContent.trim();
    const mspNote = document.getElementById('msp-footer-note-text');
    if (mspNote) mspNote.textContent = AppState.footerNote;
    saveToBackend();
  });

  for (const [id,field] of [['design-title-prefix','designCustomTitlePrefix'],['msp-title-prefix-input','mspCustomTitlePrefix'],
    ['design-note-text','designNote'],['construction-note-text','constructionNote']]) {
    const element = document.getElementById(id);
    element.addEventListener('input',() => { setScheduleText(field,element.textContent); saveToBackend(); });
    element.addEventListener('blur',() => { setScheduleText(field,element.textContent.trim()); saveToBackend(); renderScheduleText(); });
    if (field.endsWith('TitlePrefix')) element.addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); element.blur(); } });
  }
  setupExportModal();
}
