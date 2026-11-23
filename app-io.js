// Mở/xuất file MS Project (XML, CSV, JSON), xuất ảnh Timeline, khởi tạo trang.
// Tách từ app.js: các file app-*.js chạy nối tiếp nhau (chung phạm vi toàn cục), giữ đúng thứ tự nạp trong index.html.
// =========================================================================
// MỞ VÀ XUẤT FILE ĐỊNH DẠNG CHUẨN MICROSOFT PROJECT (.XML MSPDI, .CSV, .JSON)
// =========================================================================

// Chống chèn mã HTML khi đưa tên việc / tên khách hàng vào innerHTML
function escapeHtml(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Xuất ra file chuẩn Microsoft Project XML (.xml) mở trực tiếp được trên phần mềm MS Project
function exportMSProjectXMLFile() {
  normalizeAppState();
  // Xuất đúng phạm vi đang xem trên Timeline, xếp theo Dự án -> Giai đoạn
  const scopeCals = getMspTargetCalendars();
  const targetCals = [];
  AppState.projectOwners.forEach(o => scopeCals.filter(c => c.ownerId === o.id).forEach(c => targetCals.push(c)));
  scopeCals.forEach(c => { if (!targetCals.includes(c)) targetCals.push(c); });
  const activeProj = getActiveProject();
  const custName = (activeProj && activeProj.name) || getCurrentCustomerName() || 'GD_HOME_PROJECT';

  let allTasks = [];
  targetCals.forEach(c => {
    AppState.tasks.filter(t => t.calendarId === c.id && t.visibleOnBoard !== false).forEach(t => allTasks.push(t));
  });

  let projStart = allTasks.length > 0 ? allTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), allTasks[0].startDate) : formatDateStr(new Date());
  let projEnd = allTasks.length > 0 ? allTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), allTasks[0].endDate) : formatDateStr(new Date());

  let uidCounter = 1;
  let idCounter = 1;
  let tasksXml = `
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${escapeXml(custName)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>0</WBS>
      <OutlineNumber>0</OutlineNumber>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
      <Start>${projStart}T08:00:00</Start>
      <Finish>${projEnd}T17:00:00</Finish>
    </Task>`;

  // Cấp UID trước cho mọi việc để xuất liên kết đúng (kể cả liên kết tới việc nằm phía dưới)
  const taskUidMap = new Map();
  {
    let preUid = 1;
    let preOwner = null;
    targetCals.forEach(cal => {
      if (cal.ownerId !== preOwner) { preOwner = cal.ownerId; preUid++; } // dòng Dự án
      preUid++; // dòng Giai đoạn
      AppState.tasks
        .filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false)
        .slice()
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))
        .forEach(t => taskUidMap.set(t.id, preUid++));
    });
  }

  let lastOwnerId = null;
  let ownerIdx = 0;
  let stageIdx = 0;
  targetCals.forEach((cal, cIdx) => {
    if (cal.ownerId !== lastOwnerId) {
      lastOwnerId = cal.ownerId;
      ownerIdx++;
      stageIdx = 0;
      const owner = getProjectOfCalendar(cal) || { name: 'DỰ ÁN' };
      const oTasks = AppState.tasks.filter(t => t.visibleOnBoard !== false && targetCals.some(c => c.ownerId === cal.ownerId && c.id === t.calendarId));
      const oStart = oTasks.length ? oTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), oTasks[0].startDate) : projStart;
      const oEnd = oTasks.length ? oTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), oTasks[0].endDate) : projEnd;
      tasksXml += `
    <Task>
      <UID>${uidCounter++}</UID>
      <ID>${idCounter++}</ID>
      <Name>${escapeXml(owner.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>${ownerIdx}</WBS>
      <OutlineNumber>${ownerIdx}</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
      <Start>${oStart}T08:00:00</Start>
      <Finish>${oEnd}T17:00:00</Finish>
    </Task>`;
    }
    stageIdx++;
    const calUid = uidCounter++;
    const calIdNum = idCounter++;
    const wbsParent = `${ownerIdx}.${stageIdx}`;
    const calTasks = AppState.tasks
      .filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));

    const cStart = calTasks.length > 0 ? calTasks[0].startDate : projStart;
    const cEnd = calTasks.length > 0 ? calTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), calTasks[0].endDate) : projEnd;
    const cWorkDays = calTasks.length > 0 ? countWorkingDays(cStart, cEnd, true) : 1;

    tasksXml += `
    <Task>
      <UID>${calUid}</UID>
      <ID>${calIdNum}</ID>
      <Name>${escapeXml(cal.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>${wbsParent}</WBS>
      <OutlineNumber>${wbsParent}</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Summary>1</Summary>
      <Start>${cStart}T08:00:00</Start>
      <Finish>${cEnd}T17:00:00</Finish>
      <Duration>PT${cWorkDays * 8}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>${escapeXml(cal.color || '#cc0000')}</Value>
      </ExtendedAttribute>
    </Task>`;

    calTasks.forEach((t, tIdx) => {
      const tUid = uidCounter++;
      const tIdNum = idCounter++;
      const wbsCode = `${wbsParent}.${tIdx + 1}`;
      const wDays = Math.max(1, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
      const prog = typeof t.progress === 'number' ? t.progress : 0;

      // MS Project: Type 1 = FS; LinkLag tính bằng 1/10 phút (1 ngày làm việc = 8h = 4800); LagFormat 7 = ngày
      const predXml = (t.predecessors || [])
        .filter(l => taskUidMap.has(l.id))
        .map(l => `
      <PredecessorLink>
        <PredecessorUID>${taskUidMap.get(l.id)}</PredecessorUID>
        <Type>${l.type === 'SS' ? 3 : 1}</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>${Math.round((Number(l.lag) || 0) * 4800)}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`).join('');

      tasksXml += `
    <Task>
      <UID>${tUid}</UID>
      <ID>${tIdNum}</ID>
      <Name>${escapeXml(t.title)}</Name>
      <Type>0</Type>
      <IsNull>0</IsNull>
      <WBS>${wbsCode}</WBS>
      <OutlineNumber>${wbsCode}</OutlineNumber>
      <OutlineLevel>3</OutlineLevel>
      <Summary>0</Summary>
      <Start>${t.startDate}T08:00:00</Start>
      <Finish>${t.endDate}T17:00:00</Finish>
      <Duration>PT${wDays * 8}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <PercentComplete>${prog}</PercentComplete>
      <Notes>${escapeXml(t.note || '')}</Notes>${predXml}
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>${escapeXml(t.color || '#cc0000')}</Value>
      </ExtendedAttribute>
    </Task>`;

    });
  });

  const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${escapeXml(custName)}.xml</Name>
  <Title>${escapeXml(custName)}</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${projStart}T08:00:00</StartDate>
  <FinishDate>${projEnd}T17:00:00</FinishDate>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2880</MinutesPerWeek>
  <DaysPerMonth>26</DaysPerMonth>
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>188743731</FieldID>
      <FieldName>Text1</FieldName>
      <Alias>GDHomeColor</Alias>
    </ExtendedAttribute>
  </ExtendedAttributes>
  <Tasks>${tasksXml}
  </Tasks>
</Project>`;

  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = custName.replace(/[^\w\d_-]+/g, '_');
  a.href = url;
  a.download = `Tien_Do_MSProject_${safeName}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('✅ Đã xuất file định dạng Microsoft Project (.xml) thành công!');
}

// Mở và đọc file định dạng Microsoft Project (.xml, .csv, .json)
function importMSProjectFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    try {
      if (ext === 'json') {
        const parsed = JSON.parse(content);
        if (parsed.calendars && parsed.tasks) {
          AppState.calendars = parsed.calendars;
          AppState.tasks = parsed.tasks;
          normalizeAppState();
          autoFitMspColumns(true);
          syncAllFromMSProject(`Đã nạp dữ liệu dự án từ file "${file.name}"!`);
          return;
        }
      }

      if (ext === 'csv') {
        importFromCSVContent(content, file.name);
        return;
      }

      // Mặc định đọc chuẩn XML của Microsoft Project (MSPDI .xml)
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      const taskNodes = Array.from(xmlDoc.getElementsByTagName('Task'));

      if (taskNodes.length === 0) {
        GDHomeShell.alert('Không tìm thấy dữ liệu công việc (<Task>) hợp lệ trong file MS Project này!');
        return;
      }

      const rainbowPalette = ['#cc0000', '#e65100', '#f57c00', '#d4a017', '#2e7d32', '#00897b', '#0288d1', '#3949ab', '#7b1fa2'];
      const importedCalendars = [];
      const importedTasks = [];

      const projectTitleNode = xmlDoc.querySelector('Project > Title') || xmlDoc.querySelector('Project > Name');
      const defaultProjName = (projectTitleNode ? projectTitleNode.textContent : file.name.replace(/\.[^.]+$/, '')).trim().toUpperCase();

      let currentCal = null;
      let colorIdx = 0;
      // File 3 cấp (Dự án -> Giai đoạn -> Việc) hay 2 cấp (Giai đoạn -> Việc)?
      const isThreeLevel = taskNodes.some(n => {
        const sEl = n.getElementsByTagName('Summary')[0];
        const lEl = n.getElementsByTagName('OutlineLevel')[0];
        return sEl && sEl.textContent.trim() === '1' && lEl && lEl.textContent.trim() === '2';
      });
      const importedOwners = [];
      let currentOwner = null;
      const ensureOwner = (name) => {
        currentOwner = { id: 'owner_imp_' + Date.now() + '_' + importedOwners.length, name: (name || defaultProjName || 'DỰ ÁN').toUpperCase(), collapsed: false };
        importedOwners.push(currentOwner);
        return currentOwner;
      };

      const getTagText = (parent, tag) => {
        const el = parent.getElementsByTagName(tag)[0];
        return el ? el.textContent.trim() : '';
      };

      const extractIsoDate = (rawStr) => {
        if (!rawStr) return null;
        const m = rawStr.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const d = new Date(rawStr);
        if (!isNaN(d.getTime())) return formatDateStr(d);
        return null;
      };

      taskNodes.forEach(tNode => {
        const uid = getTagText(tNode, 'UID');
        const name = getTagText(tNode, 'Name');
        const isNull = getTagText(tNode, 'IsNull');
        const outlineLevel = parseInt(getTagText(tNode, 'OutlineLevel') || '1', 10);
        const isSummary = getTagText(tNode, 'Summary') === '1';

        if (!name || isNull === '1' || uid === '0' || outlineLevel === 0) return;

        // Lấy màu từ ExtendedAttribute nếu có
        let customColor = '';
        const extAttrs = Array.from(tNode.getElementsByTagName('ExtendedAttribute'));
        extAttrs.forEach(ea => {
          const val = getTagText(ea, 'Value');
          if (/^#[0-9a-fA-F]{6}$/.test(val)) customColor = val;
        });

        if (isThreeLevel && isSummary && outlineLevel === 1) {
          // Dòng DỰ ÁN (cấp 1)
          ensureOwner(name);
          currentCal = null;
        } else if (isSummary && outlineLevel === (isThreeLevel ? 2 : 1)) {
          // Dòng GIAI ĐOẠN
          if (!currentOwner) ensureOwner(defaultProjName);
          currentCal = {
            ownerId: currentOwner.id,
            id: 'cal_imp_' + Date.now() + '_' + importedCalendars.length,
            name: name.toUpperCase(),
            customerName: name.toUpperCase(),
            color: customColor || rainbowPalette[importedCalendars.length % rainbowPalette.length],
            visible: true
          };
          importedCalendars.push(currentCal);
        } else if (!isSummary) {
          if (!currentCal) {
            if (!currentOwner) ensureOwner(defaultProjName);
            currentCal = {
              ownerId: currentOwner.id,
              id: 'cal_imp_' + Date.now() + '_0',
              name: defaultProjName || 'DỰ ÁN MS PROJECT',
              customerName: defaultProjName || 'DỰ ÁN MS PROJECT',
              color: '#cc0000',
              visible: true
            };
            importedCalendars.push(currentCal);
          }

          const startStr = extractIsoDate(getTagText(tNode, 'Start')) || formatDateStr(new Date());
          let endStr = extractIsoDate(getTagText(tNode, 'Finish')) || startStr;
          if (endStr < startStr) endStr = startStr;

          const pct = parseInt(getTagText(tNode, 'PercentComplete') || '0', 10) || 0;
          const note = getTagText(tNode, 'Notes') || '';

          let taskColor = customColor;
          if (!taskColor) {
            if (/^3D\b/i.test(name)) taskColor = '#cc0000';
            else if (/^CHỈNH SỬA 3D\b/i.test(name)) taskColor = '#f57c00';
            else if (/^HSKT\b/i.test(name)) taskColor = '#2e7d32';
            else taskColor = rainbowPalette[colorIdx++ % rainbowPalette.length];
          }

          const predLinks = Array.from(tNode.getElementsByTagName('PredecessorLink')).map(pl => ({
            uid: getTagText(pl, 'PredecessorUID'),
            type: getTagText(pl, 'Type') || '1',
            lag: Math.round((parseInt(getTagText(pl, 'LinkLag') || '0', 10) || 0) / 4800)
          })).filter(pl => pl.uid && (pl.type === '1' || pl.type === '3')); // 1 = FS, 3 = SS
          importedTasks.push({
            _uid: uid,
            _predLinks: predLinks,
            id: 'task_imp_' + Date.now() + '_' + importedTasks.length,
            calendarId: currentCal.id,
            title: name,
            startDate: startStr,
            endDate: endStr,
            color: taskColor,
            skipSundays: true,
            showCount: true,
            visibleOnBoard: true,
            progress: Math.min(100, Math.max(0, pct)),
            note
          });
        }
      });

      if (importedTasks.length === 0) {
        GDHomeShell.alert('File không có hạng mục công việc con nào để hiển thị!');
        return;
      }

      // Chuyển liên kết theo UID của MS Project sang ID nội bộ
      const uidToId = new Map(importedTasks.map(t => [t._uid, t.id]));
      importedTasks.forEach(t => {
        t.predecessors = (t._predLinks || [])
          .filter(pl => uidToId.has(pl.uid))
          .map(pl => ({ id: uidToId.get(pl.uid), type: pl.type === '3' ? 'SS' : 'FS', lag: pl.lag }));
        delete t._uid;
        delete t._predLinks;
      });

      // Hỏi người dùng muốn Gộp thêm vào dự án hiện tại hay Thay thế bằng dự án vừa mở
      const replaceMode = await GDHomeShell.confirm({
        title: 'Mở file MS Project',
        message: `Đã đọc được ${importedCalendars.length} dự án và ${importedTasks.length} hạng mục từ file "${file.name}".\n\n` +
          '• Mở đè: thay thế bảng hiện tại bằng file vừa mở\n• Gộp thêm: thêm vào danh sách dự án hiện tại',
        okText: 'Mở đè', cancelText: 'Gộp thêm'
      });

      if (replaceMode) {
        AppState.projectOwners = importedOwners.length ? importedOwners : AppState.projectOwners;
        AppState.calendars = importedCalendars;
        AppState.tasks = importedTasks;
      } else {
        AppState.projectOwners.push(...importedOwners);
        AppState.calendars.push(...importedCalendars);
        AppState.tasks.push(...importedTasks);
      }

      AppState.activeCalendarId = importedCalendars[0].id;

      // Tự động cập nhật khoảng tháng hiển thị theo dữ liệu file vừa mở
      const minD = importedTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), importedTasks[0].startDate);
      const maxD = importedTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), importedTasks[0].endDate);
      AppState.startMonth = minD.slice(0, 7);
      AppState.endMonth = maxD.slice(0, 7);
      document.getElementById('start-month-input').value = AppState.startMonth;
      document.getElementById('end-month-input').value = AppState.endMonth;

      normalizeAppState();
      autoFitMspColumns(true);
      syncAllFromMSProject(`✅ Đã mở thành công ${importedTasks.length} hạng mục từ file MS Project "${file.name}"!`);
    } catch (err) {
      console.error(err);
      GDHomeShell.alert('Lỗi khi đọc file MS Project: ' + err.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function importFromCSVContent(csvText, fileName) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    GDHomeShell.alert('File CSV trống hoặc không đúng định dạng!');
    return;
  }
  const rainbowPalette = ['#cc0000', '#e65100', '#f57c00', '#d4a017', '#2e7d32', '#00897b', '#0288d1', '#3949ab', '#7b1fa2'];
  const calName = fileName.replace(/\.[^.]+$/, '').toUpperCase();
  const newCal = {
    id: 'cal_csv_' + Date.now(),
    name: calName,
    customerName: calName,
    color: '#cc0000',
    visible: true
  };
  const newTasks = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length >= 3) {
      const title = cols[1] || cols[0];
      const startStr = cols[2];
      const endStr = cols[3] || startStr;
      if (/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
        newTasks.push({
          id: 'task_csv_' + Date.now() + '_' + i,
          calendarId: newCal.id,
          title,
          startDate: startStr,
          endDate: /^\d{4}-\d{2}-\d{2}$/.test(endStr) ? endStr : startStr,
          color: rainbowPalette[(i - 1) % rainbowPalette.length],
          skipSundays: true,
          showCount: true,
          visibleOnBoard: true,
          progress: 0,
          note: ''
        });
      }
    }
  }
  if (newTasks.length === 0) {
    GDHomeShell.alert('Không tìm thấy dòng ngày tháng hợp lệ (YYYY-MM-DD) trong file CSV!');
    return;
  }
  AppState.calendars.push(newCal);
  AppState.tasks.push(...newTasks);
  AppState.activeCalendarId = newCal.id;
  autoFitMspColumns(true);
  syncAllFromMSProject(`✅ Đã nhập ${newTasks.length} công việc từ file "${fileName}"!`);
}

// =========================================================================
// XUẤT ẢNH PNG & COPY CLIPBOARD (KHÔNG BAO GIỜ BỊ CẮT CHỮ HAY LỖI Ô INPUT)
// =========================================================================
function exportMSProjectSheet(scale = 2, mode = 'download') {
  const mspSheet = document.getElementById('msp-sheet');
  const ganttBody = document.getElementById('msp-gantt-body');
  if (!mspSheet || !ganttBody) return;

  const activeBtn = mode === 'clipboard' ? document.getElementById('btn-quick-copy-clipboard') : document.getElementById('btn-open-export-modal');
  const originalText = activeBtn ? activeBtn.innerHTML : '';
  if (activeBtn) {
    activeBtn.innerHTML = mode === 'clipboard' ? 'Đang copy...' : 'Đang tạo ảnh...';
    activeBtn.disabled = true;
  }

  // Vẽ lại bảng ở chế độ xuất ảnh (trục ngày vừa khít công việc, cột tên đủ dài)
  _mspExportRendering = true;
  renderMSProjectView();

  // 1. Tính độ rộng vừa khít chính xác (pixel) cho cột "Hạng mục / Công việc" để không dư khoảng trống và không mất chữ
  const exportNameColWidth = computeTightMspNameColWidth();

  // 2. Tạo bản sao (Clone) chuyên biệt để chụp ảnh sắc nét, không làm giật màn hình
  const cloneSheet = mspSheet.cloneNode(true);
  cloneSheet.classList.add('msp-export-clone');
  cloneSheet.querySelectorAll('.msp-table-header, .msp-gantt-header').forEach(h => { h.style.transform = ''; h.classList.remove('is-stuck'); });
  cloneSheet.style.position = 'fixed';
  cloneSheet.style.left = '-19999px';
  cloneSheet.style.top = '0';
  cloneSheet.style.background = '#ffffff';
  cloneSheet.style.zIndex = '-1';

  // Ẩn thanh công cụ thêm nhanh, thanh chọn nhiều việc và thanh kéo splitter trong ảnh xuất
  const cloneQuickToolbar = cloneSheet.querySelector('#msp-quick-toolbar');
  if (cloneQuickToolbar) cloneQuickToolbar.style.display = 'none';
  const cloneMultiBar = cloneSheet.querySelector('#msp-multisel-bar');
  if (cloneMultiBar) cloneMultiBar.style.display = 'none';
  const cloneSortBtn = cloneSheet.querySelector('#btn-msp-sort-by-date');
  if (cloneSortBtn) cloneSortBtn.style.display = 'none';
  const cloneSplitter = cloneSheet.querySelector('#msp-pane-splitter');
  if (cloneSplitter) cloneSplitter.style.display = 'none';

  // Áp dụng độ rộng cột đã mở rộng toàn bộ tên việc cho bản sao
  const cloneTablePane = cloneSheet.querySelector('#msp-table-pane');
  applyMspGridColumnWidths(cloneTablePane, true, exportNameColWidth);

  // 3. Chuyển tất cả các thẻ <input> và <select> trong bản sao thành chữ hiển thị tĩnh (<span>)
  // để tránh hoàn toàn lỗi html2canvas cắt chữ bên trong thẻ <input>!
  const origInputs = mspSheet.querySelectorAll('input, select');
  const cloneInputs = cloneSheet.querySelectorAll('input, select');

  cloneInputs.forEach((cEl, idx) => {
    const oEl = origInputs[idx];
    if (!oEl) return;

    if (
      cEl.classList.contains('msp-clean-date-picker') ||
      cEl.classList.contains('msp-row-select-chk') ||
      cEl.id === 'msp-select-all-tasks'
    ) {
      cEl.remove();
      return;
    }

    const span = document.createElement('span');
    span.className = 'msp-export-static-text';

    if (cEl.tagName.toLowerCase() === 'select') {
      const selOpt = oEl.options && oEl.options[oEl.selectedIndex];
      span.textContent = selOpt ? selOpt.text : (oEl.value + '%');
      span.style.fontSize = '11.5px';
      span.style.color = oEl.value === '100' ? '#15803d' : '#1e293b';
    } else if (cEl.id === 'msp-title-prefix-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ffffff';
      span.style.fontSize = '18px';
      span.style.fontWeight = '800';
      span.style.textTransform = 'uppercase';
      span.style.marginRight = '6px';
    } else if (cEl.id === 'msp-customer-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ff4d4f';
      span.style.fontSize = '18px';
      span.style.fontWeight = '800';
      span.style.textTransform = 'uppercase';
    } else if (cEl.type === 'hidden') {
      cEl.remove();
      return;
    } else if (cEl.id === 'msp-month-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ffffff';
      span.style.fontSize = '13.5px';
      span.style.fontWeight = '700';
    } else if (cEl.classList.contains('msp-inline-owner-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '13px';
      span.style.fontWeight = '800';
      span.style.color = '#ffffff'; // Tên dự án: chữ trắng trên nền xám xanh (không dùng đỏ cho dễ đọc)
    } else if (cEl.classList.contains('msp-inline-project-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '12.5px';
      span.style.fontWeight = '800';
      span.style.color = '#0f172a';
    } else if (cEl.classList.contains('msp-inline-title-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '12px';
      span.style.fontWeight = '600';
      span.style.color = '#1e293b';
    } else if (cEl.classList.contains('msp-inline-dur-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '12px';
      span.style.fontWeight = '700';
      span.style.color = '#0f5132';
      span.style.marginRight = '2px';
    } else {
      span.textContent = oEl.value || '';
    }

    cEl.replaceWith(span);
  });

  // 4. Mở rộng toàn bộ khung Gantt để chụp trọn vẹn cả bảng WBS lẫn biểu đồ Gantt
  const cloneGanttPane = cloneSheet.querySelector('#msp-gantt-pane');
  if (cloneGanttPane) {
    cloneGanttPane.style.overflow = 'visible';
  }
  const fullGanttWidth = ganttBody.scrollWidth || 900;
  const fullTableWidth = parseFloat(cloneTablePane.style.width) || 680;
  const targetTotalWidth = fullTableWidth + fullGanttWidth + 2;

  // Trả màn hình về chế độ xem bình thường
  _mspExportRendering = false;
  renderMSProjectView();

  cloneSheet.style.width = `${targetTotalWidth}px`;
  document.body.appendChild(cloneSheet);

  setTimeout(() => {
    html2canvas(cloneSheet, {
      scale: scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: targetTotalWidth,
      windowWidth: targetTotalWidth + 120
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
        const custName = getCurrentCustomerName().replace(/\s+/g, '_') || 'DuAn';
        downloadCanvas(canvas, `Timeline_MSProject_${custName}.png`, AppState.exportWatermark !== false);
        showToast('✅ Đã xuất file ảnh PNG Timeline (MS Project) đầy đủ không mất chữ!');
      }
    }).catch(err => {
      if (cloneSheet.parentNode) document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }
      GDHomeShell.alert('Lỗi kết xuất ảnh Timeline: ' + err.message);
    });
  }, 150);
}

// Khởi tạo
window.addEventListener('DOMContentLoaded', () => {
  setupColorPalette();
  setupSidebarEvents();
  setupQuickPopoverEvents();
  setupGridMouseInteractions();
  setupMSProjectEvents();
  setupGanttRangeSelection();
  setupEvents();
  setupCollapsibleSidebar();
  const wmChk = document.getElementById('export-watermark');
  if (wmChk) {
    wmChk.checked = AppState.exportWatermark !== false;
    wmChk.addEventListener('change', () => {
      AppState.exportWatermark = wmChk.checked;
      saveToBackend();
    });
  }
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (AppState.viewMode === 'msproject') renderMSProjectView();
    }, 250);
  });
  const saveStatusEl = document.getElementById('save-status-indicator');
  if (saveStatusEl) {
    saveStatusEl.addEventListener('click', () => {
      if (!_scheduleReady) bootstrapAuthAndData();
      else if (!isOfflineFileMode()) flushSaveToBackend();
    });
  }
  bootstrapAuthAndData().finally(() => { if (typeof refreshMaterialBadges === 'function') refreshMaterialBadges(); });
});
