const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { projectList, writeProjectProfile } = require('./project-profiles');
const {
  resolveAi,
  loadUserCfg,
  callWithFallback,
  callGemini,
  callOpenAI,
  callAnthropic,
  resolveModel,
  extractJson
} = require('./integrations');

const {
  isConfigured,
  putObject,
  getObject,
  getStorageKind,
  signedUrl
} = require('./object-storage');

const { MaterialAssets,maxImageBytes } = require('./material-assets');

const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function defaultProjectRecord(projectId) {
  return {
    projectId,
    updatedAt: new Date().toISOString(),
    documents: [],
    quoteItems: [],
    reviewFindings: [],
    reviewSummary: {
      lastRunAt: null,
      annotatedAssetKey: null,
      sourceDrawingDocId: null,
      pageTags: [],
      renderTags: []
    },
    pushLinks: {
      schedule: { lastPushedAt: null, calendarId: null, items: {} },
      materials: { lastPushedAt: null, sheetId: null, items: {} }
    }
  };
}

class ProjectHubStore {
  constructor(store, dataKey) {
    this.store = store;
    this.dataKey = dataKey;
    this.key = 'proj-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
  }

  async load() {
    const data = await this.store.get(this.key);
    return data || { _version: 0, projects: {} };
  }

  async save(data) {
    data._version = (data._version || 0) + 1;
    data._updatedAt = new Date().toISOString();
    await this.store.put(this.key, data);
    return data;
  }

  async getProject(projectId) {
    const hub = await this.load();
    return hub.projects?.[projectId] || defaultProjectRecord(projectId);
  }

  async saveProject(projectId, updater) {
    const hub = await this.load();
    hub.projects ||= {};
    const current = hub.projects[projectId] || defaultProjectRecord(projectId);
    const updated = typeof updater === 'function' ? updater(current) : Object.assign(current, updater);
    updated.projectId = projectId;
    updated.updatedAt = new Date().toISOString();
    hub.projects[projectId] = updated;
    await this.save(hub);
    return updated;
  }
}

class ProjectAssets {
  constructor(dataDir, dataKey) {
    this.accountHash = crypto.createHash('sha256').update(dataKey).digest('hex').slice(0, 16);
    this.dir = path.join(dataDir, 'project-files', this.accountHash);
    this.prefix = 'project-files/' + this.accountHash + '/';
    this.configured = isConfigured();
    this.r2Configured = this.configured;
    this.renderAssets = new MaterialAssets(dataDir,'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex'));
  }

  async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(buf, ext, mime) {
    const cleanExt = (ext.startsWith('.') ? ext : '.' + ext).toLowerCase();
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const assetKey = `${sha}${cleanExt}`;
    const cleanMime = mime || MIME_MAP[cleanExt] || 'application/octet-stream';

    if (this.configured) {
      await putObject(this.prefix + assetKey, buf, cleanMime, { timeout: 30000 });
    } else {
      await this.ensureDir();
      const filePath = path.join(this.dir, assetKey);
      await fs.writeFile(filePath, buf);
    }

    return { assetKey, size: buf.length, mime: cleanMime };
  }

  async saveRender(full,thumb) {
    const saved = await this.renderAssets.saveBuffer(full);
    const small = thumb ? await this.renderAssets.saveBuffer(thumb,480) : saved;
    return {...saved,assetKey:'render-'+saved.name,thumbAssetKey:'render-'+small.name};
  }

  async read(assetKey) {
    if (typeof assetKey === 'string' && assetKey.startsWith('render-')) return this.renderAssets.read(assetKey.slice(7));
    if (!/^[a-f0-9]{64}\.[a-z0-9]+$/i.test(assetKey)) {
      throw Object.assign(new Error('Tên file không hợp lệ.'), { status: 400 });
    }
    const cleanExt = path.extname(assetKey).toLowerCase();
    const mime = MIME_MAP[cleanExt] || 'application/octet-stream';

    if (this.configured) {
      const res = await getObject(this.prefix + assetKey, { timeout: 30000 });
      return { buf: res.buffer, mime: res.mime || mime };
    }

    const filePath = path.join(this.dir, assetKey);
    try {
      const buf = await fs.readFile(filePath);
      return { buf, mime };
    } catch (err) {
      if (err.code === 'ENOENT') throw Object.assign(new Error('Không tìm thấy tài liệu.'), { status: 404 });
      throw err;
    }
  }

  async send(res, assetKey, downloadName) {
    const { buf, mime } = await this.read(assetKey);
    const headers = {
      'Content-Type': mime,
      'Content-Length': buf.length,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    };
    if (downloadName) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(downloadName)}"`;
    }
    res.writeHead(200, headers);
    res.end(buf);
  }
}

function calculateProjectStats(projectId, scheduleData, materialsData, hubRecord) {
  // 1. Tiến độ
  const tasks = (scheduleData?.tasks || []).filter(t => t.ownerId === projectId);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => (t.progress || 0) >= 100).length;
  const percentComplete = totalTasks > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks)
    : 0;
  const endDate = tasks.reduce((max, t) => (t.endDate && t.endDate > max ? t.endDate : max), '');
  const startDate = tasks.reduce((min, t) => (!min || (t.startDate && t.startDate < min) ? t.startDate : min), '');

  // 2. Chốt mã
  const sheets = (materialsData?.sheets || []).filter(s => s.projectId === projectId);
  const allRows = sheets.flatMap(s => (s.groups || []).flatMap(g => g.rows || []));
  const totalMaterialRows = allRows.length;
  const confirmedRows = allRows.filter(r => r.chosen !== null && r.chosen !== undefined && r.chosen !== '').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueCount = allRows.filter(r => r.deadline && r.deadline < todayStr && !r.chosen).length;

  // 3. Hồ sơ & Soát HSKT
  const docs = hubRecord?.documents || [];
  const quoteItems = hubRecord?.quoteItems || [];
  const findings = hubRecord?.reviewFindings || [];
  const openIssues = findings.filter(f => f.status === 'open').length;

  return {
    schedule: {
      taskCount: totalTasks,
      completedCount: completedTasks,
      percentComplete,
      startDate: startDate || null,
      endDate: endDate || null
    },
    materials: {
      sheetCount: sheets.length,
      totalRows: totalMaterialRows,
      confirmedRows,
      overdueCount
    },
    hub: {
      totalDocuments: docs.length,
      quoteDocuments: docs.filter(d => d.type === 'quote').length,
      drawingDocuments: docs.filter(d => d.type === 'drawing').length,
      renderDocuments: docs.filter(d => d.type === 'render').length,
      quoteItemCount: quoteItems.length,
      openIssueCount: openIssues,
      totalFindings: findings.length,
      lastReviewedAt: hubRecord?.reviewSummary?.lastRunAt || null
    }
  };
}

// -----------------------------------------------------------------------------
// 11.3: Đọc báo giá & chuẩn hoá hạng mục (SheetJS rows -> QuoteItem[])
// -----------------------------------------------------------------------------
const QUOTE_COLUMN_PATTERNS = {
  stt: ['stt', 'tt', 'no', 'order'],
  code: ['mã', 'ma', 'mã hiệu', 'ma hieu', 'mã vt', 'code', 'item code'],
  name: ['hạng mục', 'hang muc', 'nội dung', 'noi dung', 'tên công việc', 'ten cong viec', 'mô tả', 'tên hạng mục', 'ten vat lieu', 'diễn giải'],
  room: ['phòng', 'phong', 'khu vực', 'khu vuc', 'vị trí', 'vi tri', 'tầng', 'tang'],
  spec: ['quy cách', 'quy cach', 'chất liệu', 'chat lieu', 'kích thước', 'kich thuoc', 'tiêu chuẩn', 'thông số'],
  unit: ['đvt', 'dvt', 'đơn vị', 'don vi', 'đơn vị tính', 'unit'],
  qty: ['khối lượng', 'khoi luong', 'số lượng', 'so luong', 'kl', 'sl', 'qty', 'quantity'],
  unitPrice: ['đơn giá', 'don gia', 'giá', 'gia', 'price', 'unit price'],
  amount: ['thành tiền', 'thanh tien', 'tiền', 'tien', 'tổng cộng', 'amount', 'total'],
  note: ['ghi chú', 'ghi chu', 'note', 'lưu ý']
};

function normalizeText(val) {
  return String(val ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

function detectQuoteHeader(rows) {
  let bestRowIdx = -1;
  let bestScore = 0;
  let bestColMap = {};

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const colMap = {};
    let matched = 0;

    row.forEach((cell, c) => {
      const norm = normalizeText(cell);
      if (!norm) return;
      for (const [field, patterns] of Object.entries(QUOTE_COLUMN_PATTERNS)) {
        if (!colMap[field] && patterns.some(p => norm === p || (p.length > 2 && norm.includes(p)))) {
          colMap[field] = c;
          matched++;
          break;
        }
      }
    });

    if (matched > bestScore) {
      bestScore = matched;
      bestRowIdx = r;
      bestColMap = colMap;
    }
  }

  return { headerRowIdx: bestRowIdx, colMap: bestColMap, confidence: bestScore };
}

function parseQuoteSheetRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const { headerRowIdx, colMap } = detectQuoteHeader(rows);
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

  let currentRoom = 'Cả nhà';
  let currentCategory = 'Đồ gỗ nội thất';
  const items = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.every(cell => !cell || !String(cell).trim())) continue;

    const rawName = colMap.name !== undefined ? String(row[colMap.name] || '').trim() : '';
    const rawStt = colMap.stt !== undefined ? String(row[colMap.stt] || '').trim() : '';
    const rawRoom = colMap.room !== undefined ? String(row[colMap.room] || '').trim() : '';
    const rawSpec = colMap.spec !== undefined ? String(row[colMap.spec] || '').trim() : '';
    const rawUnit = colMap.unit !== undefined ? String(row[colMap.unit] || '').trim() : '';
    const rawQty = colMap.qty !== undefined ? String(row[colMap.qty] || '').trim() : '';
    const rawPrice = colMap.unitPrice !== undefined ? String(row[colMap.unitPrice] || '').trim() : '';
    const rawAmount = colMap.amount !== undefined ? String(row[colMap.amount] || '').trim() : '';
    const rawNote = colMap.note !== undefined ? String(row[colMap.note] || '').trim() : '';
    const rawCode = colMap.code !== undefined ? String(row[colMap.code] || '').trim() : '';

    // Kiểm tra dòng tiêu đề nhóm / phòng (Ví dụ: "I. PHÒNG KHÁCH", "PHẦN THÔ", "A. BẾP")
    const fullRowText = row.filter(Boolean).map(c => String(c).trim()).join(' ');
    const normFull = normalizeText(fullRowText);

    if (
      (!rawUnit && !rawQty && !rawPrice && rawName && rawName.length > 2) ||
      /^(phong|khu vuc|tang|phan|hang muc lon|i\.|ii\.|iii\.|iv\.|v\.|vi\.|a\.|b\.|c\.)/i.test(normFull)
    ) {
      if (/phong|khach|bep|ngu|master|wc|ve sinh|ban cong|logia|sanh/i.test(normFull)) {
        currentRoom = rawName || fullRowText;
      }
      if (/tho|xay|mep|dien nuoc|tran|son|op lat|go|do roi|sofa|rem|thiet bi|nhom kinh/i.test(normFull)) {
        currentCategory = categorizeItem(fullRowText);
      }
      continue;
    }

    if (!rawName && !rawSpec) continue;

    const cleanQty = parseFloat(rawQty.replace(/[^\d.-]/g, '')) || 1;
    const cleanPrice = parseFloat(rawPrice.replace(/[^\d.-]/g, '')) || 0;
    const cleanAmount = parseFloat(rawAmount.replace(/[^\d.-]/g, '')) || (cleanQty * cleanPrice);

    const itemRoom = rawRoom || currentRoom;
    const itemCat = categorizeItem(rawName + ' ' + rawSpec) || currentCategory;

    items.push({
      id: 'qi_' + crypto.randomUUID().slice(0, 12),
      stt: rawStt || String(items.length + 1),
      code: rawCode || '',
      name: rawName || rawSpec,
      room: itemRoom,
      category: itemCat,
      spec: rawSpec,
      qty: cleanQty,
      unit: rawUnit || 'bộ',
      unitPrice: cleanPrice,
      amount: cleanAmount,
      note: rawNote,
      sourceDocId: null,
      updatedAt: new Date().toISOString()
    });
  }

  return items;
}

function categorizeItem(text) {
  const norm = ' ' + normalizeText(text) + ' ';
  if (/\b(xay|pha do|thao do|phan tho|be tong|can nen)\b/.test(norm)) return 'Phần thô & Xây trát';
  if (/\b(dien|nuoc|mep|ong nuoc|day dien|chieu sang)\b/.test(norm)) return 'Điện nước (MEP)';
  if (/\b(tran thach cao|dong tran|tran chim|son tuong|phao chi)\b/.test(norm) || (/\b(son|ba)\b/.test(norm) && !/\b(son go)\b/.test(norm))) return 'Trần & Sơn bả';
  if (/\b(da|gach|op lat|granite|marble|lavabo|lat san)\b/.test(norm)) return 'Ốp lát đá & gạch';
  if (/\b(tu ao|giuong|tu bep|ke tivi|ban lam viec|tab|vach op|go|mdf|melamine|acrylic|an cuong)\b/.test(norm)) return 'Đồ gỗ nội thất';
  if (/\b(sofa|ban tra|ban an|ghe an|rem|dem|tham)\b/.test(norm)) return 'Đồ rời & Sofa/Rèm';
  if (/\b(bep tu|hut mui|chau rua|bon cau|sen|phu kien bep|tay nam)\b/.test(norm)) return 'Thiết bị & Phụ kiện';
  if (/\b(nhom kinh|cua nhom|cua di|vach kinh|kinh|guong)\b/.test(norm)) return 'Nhôm kính & Cửa';
  return 'Đồ gỗ nội thất';
}

// -----------------------------------------------------------------------------
// 11.4: Soát bản vẽ HSKT & phối cảnh theo báo giá + Ghi chú vào PDF bằng pdf-lib
// -----------------------------------------------------------------------------
function computeReviewCoverage(quoteItems, drawings = [], renders = []) {
  const findings = [];
  const pageTags = [];
  const renderTags = [];

  // Tạo tags cho từng trang bản vẽ
  drawings.forEach(doc => {
    const pageCount = doc.pages || 1;
    for (let p = 1; p <= pageCount; p++) {
      const pageInfo = (doc.extractedPages || []).find(ep => ep.pageNumber === p) || {};
      const detectedItems = pageInfo.items || [];
      const room = pageInfo.room || doc.room || 'Phòng khách';
      const drawingType = pageInfo.drawingType || (p === 1 ? 'mat_bang' : 'chi_tiet');

      pageTags.push({
        docId: doc.id,
        docName: doc.name,
        pageNumber: p,
        drawingType,
        room,
        title: pageInfo.title || `Bản vẽ trang ${p}: ${room}`,
        detectedItems,
        quantities: pageInfo.quantities || []
      });
    }
  });

  // Tạo tags cho phối cảnh 3D
  renders.forEach(doc => {
    const room = doc.room || 'Phòng khách';
    const detectedItems = doc.detectedItems || [];
    renderTags.push({
      docId: doc.id,
      docName: doc.name,
      room,
      detectedItems
    });
  });

  // Đối chiếu từng QuoteItem
  quoteItems.forEach(item => {
    const normName = normalizeText(item.name);
    const normRoom = normalizeText(item.room);

    // 1. Tìm bản vẽ HSKT phù hợp
    const matchedPages = pageTags.filter(pt => {
      const roomMatch = !normRoom || normRoom === 'ca nha' || normalizeText(pt.room).includes(normRoom) || normRoom.includes(normalizeText(pt.room));
      const nameMatch = pt.detectedItems.some(di => {
        const normDi = normalizeText(di);
        return normName.includes(normDi) || normDi.includes(normName);
      }) || normalizeText(pt.title).includes(normName);
      return roomMatch && nameMatch;
    });

    if (matchedPages.length === 0 && drawings.length > 0) {
      // Thiếu bản vẽ HSKT
      findings.push({
        id: 'rf_' + crypto.randomUUID().slice(0, 12),
        quoteItemId: item.id,
        type: 'missing_drawing',
        severity: 'high',
        status: 'open',
        room: item.room,
        title: `Thiếu bản vẽ HSKT: ${item.name}`,
        detail: `Hạng mục "${item.name}" thuộc "${item.room}" có trong báo giá (SL: ${item.qty} ${item.unit}) nhưng chưa tìm thấy bản vẽ chi tiết trong hồ sơ HSKT.`,
        drawingDocId: drawings[0]?.id || null,
        pageNumber: 1,
        bbox: [0.1, 0.2, 0.8, 0.15],
        renderDocId: null,
        note: ''
      });
    } else if (matchedPages.length > 0) {
      // Kiểm tra lệch khối lượng (nếu trang bản vẽ có đếm)
      const targetPage = matchedPages[0];
      const detectedQtyObj = (targetPage.quantities || []).find(q => {
        const nq = normalizeText(q.name);
        return nq && (nq.includes(normName) || normName.includes(nq));
      });
      if (detectedQtyObj && detectedQtyObj.qty !== item.qty) {
        findings.push({
          id: 'rf_' + crypto.randomUUID().slice(0, 12),
          quoteItemId: item.id,
          type: 'qty_mismatch',
          severity: 'medium',
          status: 'open',
          room: item.room,
          title: `Lệch khối lượng: ${item.name}`,
          detail: `Báo giá ghi ${item.qty} ${item.unit}, nhưng bản vẽ ${targetPage.docName} (Trang ${targetPage.pageNumber}) ghi nhận ${detectedQtyObj.qty} ${detectedQtyObj.unit || item.unit}.`,
          drawingDocId: targetPage.docId,
          pageNumber: targetPage.pageNumber,
          bbox: [0.15, 0.35, 0.7, 0.12],
          renderDocId: null,
          note: ''
        });
      }
    }

    // 2. Tìm phối cảnh 3D (với đồ nội thất, đồ rời, thiết bị chính)
    if (['Đồ gỗ nội thất', 'Đồ rời & Sofa/Rèm', 'Thiết bị & Phụ kiện'].includes(item.category)) {
      const matchedRenders = renderTags.filter(rt => {
        const roomMatch = !normRoom || normRoom === 'ca nha' || normalizeText(rt.room).includes(normRoom) || normRoom.includes(normalizeText(rt.room));
        const itemMatch = rt.detectedItems.some(di => normalizeText(di).includes(normName) || normName.includes(normalizeText(di)));
        return roomMatch && (itemMatch || rt.detectedItems.length === 0);
      });

      if (matchedRenders.length === 0 && renders.length > 0) {
        findings.push({
          id: 'rf_' + crypto.randomUUID().slice(0, 12),
          quoteItemId: item.id,
          type: 'missing_3d',
          severity: 'medium',
          status: 'open',
          room: item.room,
          title: `Chưa có phối cảnh 3D: ${item.name}`,
          detail: `Hạng mục nội thất chính "${item.name}" tại "${item.room}" chưa thấy xuất hiện rõ trên các góc render phối cảnh 3D đã tải lên.`,
          drawingDocId: matchedPages[0]?.docId || drawings[0]?.id || null,
          pageNumber: matchedPages[0]?.pageNumber || 1,
          bbox: [0.1, 0.5, 0.8, 0.1],
          renderDocId: null,
          note: ''
        });
      }
    }
  });

  return { findings, pageTags, renderTags };
}

function toAsciiSafe(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, d => (d === 'đ' ? 'd' : 'D'))
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

async function annotateDrawingPdf(pdfBuffer, findings = [], projectName = 'Dự án') {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  let regularFontBytes, boldFontBytes;
  try {
    const fontDir = path.join(__dirname, 'fonts');
    regularFontBytes = await fs.readFile(path.join(fontDir, 'Roboto-Regular.ttf'));
    boldFontBytes = await fs.readFile(path.join(fontDir, 'Roboto-Bold.ttf'));
  } catch (err) {
    // dự phòng nếu không đọc được font
  }

  const font = regularFontBytes ? await pdfDoc.embedFont(regularFontBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = boldFontBytes ? await pdfDoc.embedFont(boldFontBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 1. Chèn Trang 0 (Trang Tổng Hợp Đánh Giá & Phát Hiện)
  const coverPage = pdfDoc.insertPage(0, [595.28, 841.89]); // A4 chuẩn
  const { width, height } = coverPage.getSize();

  // Header GD HOME
  coverPage.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.8, 0.05, 0.05) // Đỏ thương hiệu GD HOME
  });

  coverPage.drawText('GD HOME – BÁO CÁO SOÁT HỒ SƠ BẢN VẼ HSKT', {
    x: 40,
    y: height - 45,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  coverPage.drawText(`Dự án: ${projectName}  |  Ngày soát: ${new Date().toISOString().slice(0, 10)}`, {
    x: 40,
    y: height - 65,
    size: 11,
    font: font,
    color: rgb(0.95, 0.95, 0.95)
  });

  // Summary counts
  const highCount = findings.filter(f => f.severity === 'high').length;
  const medCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;

  coverPage.drawRectangle({
    x: 40,
    y: height - 145,
    width: width - 80,
    height: 50,
    color: rgb(0.96, 0.96, 0.97),
    borderColor: rgb(0.85, 0.85, 0.88),
    borderWidth: 1
  });

  coverPage.drawText(`Tổng số vấn đề: ${findings.length}     [Cao: ${highCount}]     [Trung bình: ${medCount}]     [Thấp: ${lowCount}]`, {
    x: 55,
    y: height - 125,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15)
  });

  coverPage.drawText('Danh sách chi tiết các điểm cần bổ sung & đối chiếu dưới đây:', {
    x: 40,
    y: height - 170,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2)
  });

  // Table of findings
  let currentY = height - 200;
  findings.slice(0, 18).forEach((f, idx) => {
    const sevColor = f.severity === 'high' ? rgb(0.85, 0.1, 0.1) : f.severity === 'medium' ? rgb(0.85, 0.55, 0) : rgb(0.2, 0.5, 0.8);
    coverPage.drawCircle({ x: 50, y: currentY + 4, size: 4, color: sevColor });

    const targetPageText = `[Trang ${f.pageNumber}]`;
    const cleanTitle = String(f.title || '').slice(0, 65);
    coverPage.drawText(`${idx + 1}. ${targetPageText} ${cleanTitle}`, {
      x: 65,
      y: currentY,
      size: 10,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15)
    });

    currentY -= 28;
  });

  // 2. Đánh dấu / highlight & vẽ note box trên từng trang liên quan (trang gốc nay đã dời sau cover page: pageNumber = original + 1)
  const totalPages = pdfDoc.getPageCount();
  for (const f of findings) {
    const targetIdx = (f.pageNumber || 1); // Đã tính trang 0 chèn vào
    if (targetIdx < totalPages) {
      const page = pdfDoc.getPage(targetIdx);
      const pSize = page.getSize();
      const bbox = f.bbox || [0.1, 0.2, 0.8, 0.12];
      const boxX = bbox[0] * pSize.width;
      const boxY = pSize.height - (bbox[1] + bbox[3]) * pSize.height;
      const boxW = bbox[2] * pSize.width;
      const boxH = bbox[3] * pSize.height;

      // Hộp viền đỏ cảnh báo
      page.drawRectangle({
        x: Math.max(10, boxX),
        y: Math.max(10, boxY),
        width: Math.min(pSize.width - 20, boxW),
        height: Math.min(pSize.height - 20, boxH),
        borderColor: rgb(0.9, 0.1, 0.1),
        borderWidth: 2,
        color: rgb(1, 0.92, 0.92),
        opacity: 0.35
      });

      // Nhãn ghi chú sticky note
      const badgeW = Math.min(320, pSize.width - 40);
      page.drawRectangle({
        x: Math.max(10, boxX),
        y: Math.min(pSize.height - 35, boxY + boxH),
        width: badgeW,
        height: 22,
        color: rgb(0.85, 0.05, 0.05)
      });

      const noteTitle = String(f.title || 'GD HOME CẢNH BÁO').slice(0, 48);
      page.drawText(`[GD HOME] ${noteTitle}`, {
        x: Math.max(15, boxX + 6),
        y: Math.min(pSize.height - 21, boxY + boxH + 6),
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1)
      });
    }
  }

  return await pdfDoc.save();
}

// -----------------------------------------------------------------------------
// 11.5: Đề xuất sang Tiến độ & Chốt mã + Liên kết ngược sourceQuoteItemId
// -----------------------------------------------------------------------------
const WORK_SEQUENCES = [
  { name: 'Tháo dỡ & Phần thô xây trát', category: 'Phần thô & Xây trát', days: 5 },
  { name: 'Thi công Điện nước (MEP ngầm)', category: 'Điện nước (MEP)', days: 6 },
  { name: 'Đóng trần thạch cao & Sơn bả', category: 'Trần & Sơn bả', days: 7 },
  { name: 'Ốp lát gạch & Đá hoàn thiện', category: 'Ốp lát đá & gạch', days: 5 },
  { name: 'Lắp ráp đồ gỗ nội thất & Phụ kiện', category: 'Đồ gỗ nội thất', days: 8 },
  { name: 'Lắp đặt Nhôm kính, Cửa & Gương', category: 'Nhôm kính & Cửa', days: 3 },
  { name: 'Lắp Đồ rời, Sofa, Bàn ăn & Rèm', category: 'Đồ rời & Sofa/Rèm', days: 4 },
  { name: 'Lắp Thiết bị bếp & Thiết bị vệ sinh', category: 'Thiết bị & Phụ kiện', days: 3 },
  { name: 'Vệ sinh công nghiệp & Nghiệm thu bàn giao', category: 'Nghiệm thu', days: 2 }
];

function generateScheduleProposal(projectId, quoteItems, existingCalendars = [], buildingType = 'Chung cư') {
  const stageName = 'THI CÔNG TỔNG THỂ (TỪ BÁO GIÁ)';
  let targetCal = existingCalendars.find(c => c.ownerId === projectId && c.name.includes('BÁO GIÁ'));
  const calId = targetCal?.id || 'cal_' + crypto.randomUUID().slice(0, 8);

  const newCalendar = targetCal || {
    id: calId,
    ownerId: projectId,
    name: stageName,
    visible: true,
    color: '#0066cc'
  };

  // Gom các quote item theo từng nhóm công việc
  const tasks = [];
  let startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Bắt đầu từ ngày mai

  let previousTaskId = null;

  let sequences = [...WORK_SEQUENCES];
  if (buildingType === 'Nhà phố') {
    sequences.splice(1, 0, { name: 'Kết cấu móng/cột/dầm & Chống thấm mái/ban công', category: 'Phần thô & Xây trát', days: 8 });
  } else if (buildingType === 'Văn phòng nhỏ') {
    sequences = sequences.filter(s => !s.name.includes('Sofa, Bàn ăn'));
    sequences.splice(4, 0, { name: 'Thi công sàn nâng / thảm & vách ngăn kính', category: 'Nhôm kính & Cửa', days: 5 });
  }

  sequences.forEach(seq => {
    const matchedItems = quoteItems.filter(item => item.category === seq.category);
    const hasItems = matchedItems.length > 0 || seq.category === 'Nghiệm thu';
    if (!hasItems) return;

    const taskId = 'task_' + crypto.randomUUID().slice(0, 10);
    const startStr = startDate.toISOString().slice(0, 10);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.max(1, seq.days));
    const endStr = endDate.toISOString().slice(0, 10);

    const taskTitle = matchedItems.length > 0 && matchedItems.length <= 2
      ? `${seq.name}: ${matchedItems.map(i => i.name).join(', ')}`
      : seq.name;

    const task = {
      id: taskId,
      title: taskTitle,
      ownerId: projectId,
      calendarId: calId,
      startDate: startStr,
      endDate: endStr,
      progress: 0,
      linkType: previousTaskId ? 'FS' : null,
      linkTargetId: previousTaskId || null,
      sourceQuoteItemIds: matchedItems.map(i => i.id)
    };

    tasks.push(task);
    previousTaskId = taskId;
    // Ngày tiếp theo bắt đầu sau khi việc trước xong
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() + 1);
  });

  return { calendar: newCalendar, tasks };
}

// Map sang 18 nhóm mẫu Chốt mã của GD HOME
const MATERIAL_GROUP_MAP = [
  { group: 'MÃ GỖ (Melamine, PVC…)', pattern: /go|mdf|melamine|pvc|acrylic|veneer|tu ao|tu bep|giuong/i },
  { group: 'SƠN GỖ', pattern: /son go|son pu|son inchem/i },
  { group: 'SƠN TƯỜNG + TRẦN', pattern: /son tuong|son tran|dulux|jotun|maxilite/i },
  { group: 'PHÀO CHỈ', pattern: /phao chi|phao co tran|phao chan tuong/i },
  { group: 'ĐÁ ỐP LÁT (sảnh, bếp, lavabo, bậu cửa)', pattern: /da bep|da lavabo|da ban|granite|marble|da nhan tao/i },
  { group: 'GẠCH ỐP LÁT (sảnh, WC, logia)', pattern: /gach lat|gach op|gach men|gach wc|gach ban cong/i },
  { group: 'KÍNH (bếp, cánh, vách tắm)', pattern: /kinh bep|kinh canh|vach kinh|vach tam/i },
  { group: 'GIẤY DÁN TƯỜNG', pattern: /giay dan tuong|tranh dan tuong/i },
  { group: 'NỈ BỌC (sofa, giường, đôn, ghế, đệm đi giày)', pattern: /ni boc|sofa|dem|da boc/i },
  { group: 'RÈM (thả, cầu vồng, sáo, roman)', pattern: /rem|man cua/i },
  { group: 'SÀN GỖ', pattern: /san go|san nhua spc|nep san/i },
  { group: 'SÀN NHỰA LOGIA', pattern: /vi nhua|san nhua logia/i },
  { group: 'ĐÈN', pattern: /den|den led|den chieu sang|den trang tri/i },
  { group: 'CÔNG TẮC – Ổ CẮM', pattern: /cong tac|o cam|schneider|panasonic/i },
  { group: 'BẾP', pattern: /bep tu|hut mui|chau rua bep|gia bat|tay nang/i },
  { group: 'THIẾT BỊ VỆ SINH', pattern: /bon cau|lavabo|sen tam|voi sen|toto|inax/i },
  { group: 'TAY NẮM', pattern: /tay nam|num canh/i }
];

function generateMaterialsProposal(quoteItems, buildingType = 'Chung cư') {
  const groupsMap = new Map();

  quoteItems.forEach(item => {
    const text = `${item.name} ${item.spec} ${item.category}`;
    let matchedGroupName = 'Vật tư khác';

    for (const entry of MATERIAL_GROUP_MAP) {
      if (entry.pattern.test(text)) {
        matchedGroupName = entry.group;
        break;
      }
    }

    if (!groupsMap.has(matchedGroupName)) {
      groupsMap.set(matchedGroupName, []);
    }

    groupsMap.get(matchedGroupName).push({
      id: 'mr_' + crypto.randomUUID().slice(0, 10),
      name: item.name,
      room: item.room,
      spec: item.spec || '',
      qty: item.qty ? String(item.qty) : '1',
      unit: item.unit || 'bộ',
      supplier: '',
      note: item.note || '',
      sourceQuoteItemId: item.id,
      chosen: null,
      options: [
        { code: item.code || 'PA1', spec: item.spec || 'Phương án chuẩn báo giá', supplier: '', images: [] },
        { code: 'PA2', spec: '', supplier: '', images: [] }
      ]
    });
  });

  const groups = Array.from(groupsMap.entries()).map(([name, rows], idx) => ({
    id: 'grp_' + (idx + 1),
    name,
    rows
  }));

  return { groups };
}

// -----------------------------------------------------------------------------
// B2: Loại công trình trong ngữ cảnh AI
// -----------------------------------------------------------------------------
const BUILDING_TYPES = ['Chung cư', 'Nhà phố', 'Văn phòng nhỏ', 'Khác'];

function guessBuildingType(name = '', address = '') {
  const text = (String(name || '') + ' ' + String(address || '')).toLowerCase();
  if (/văn\s*phòng|office|co-working|trụ\s*sở/i.test(text)) {
    return 'Văn phòng nhỏ';
  }
  if (/chung\s*cư|căn\s*hộ|apartment|condo|masteri|vinhomes|smart\s*city|ocean\s*park|tòa|toà|tầng|block|tower/i.test(text)) {
    return 'Chung cư';
  }
  if (/nhà\s*phố|liền\s*kề|shophouse|biệt\s*thự|villa|ngõ|ngách|hẻm|phố|số\s*nhà|thổ\s*cư/i.test(text)) {
    return 'Nhà phố';
  }
  return 'Khác';
}

function getBuildingContextPrompt(buildingType = 'Chung cư') {
  switch (buildingType) {
    case 'Chung cư':
      return `\n[NGỮ CẢNH CÔNG TRÌNH: CHUNG CƯ]\n- Không có phần móng, kết cấu ngầm, sàn mái ngoài trời.\n- Chú ý hộp kỹ thuật MEP toà nhà, ban quản lý toà nhà, quy định tiếng ồn và giờ giấc thi công nghiêm ngặt, vận chuyển thang máy hàng.\n- Các không gian điển hình: Phòng khách, Bếp & Ăn, Phòng ngủ master, Phòng ngủ con, Logia/Ban công, WC.`;
    case 'Nhà phố':
      return `\n[NGỮ CẢNH CÔNG TRÌNH: NHÀ PHỐ]\n- Công trình nhiều tầng, có kết cấu móng/cột/dầm, cầu thang bộ, chống thấm sàn mái và ban công, mặt tiền ngoài trời.\n- Lưu ý ranh giới đất, an toàn nhà liền kề, hệ thống cấp thoát nước tổng thể.\n- Các không gian điển hình: Tầng 1 (Khách/Gara/Bếp), Tầng lửng/Tầng 2-3 (Ngủ, Sinh hoạt chung), Tầng tum/Sân phơi, Phòng thờ.`;
    case 'Văn phòng nhỏ':
      return `\n[NGỮ CẢNH CÔNG TRÌNH: VĂN PHÒNG NHỎ]\n- Đặc thù trần thả / thạch cao khung xương nổi, sàn nâng kỹ thuật hoặc thảm trải sàn, vách kính / thạch cao ngăn phòng.\n- Hệ thống mạng LAN, điện nhẹ, camera, kiểm soát ra vào, PCCC theo tiêu chuẩn toà nhà.\n- Các không gian điển hình: Khu làm việc chung, Phòng họp, Phòng giám đốc, Khu tiếp khách/Pantry, Lễ tân.`;
    default:
      return `\n[NGỮ CẢNH CÔNG TRÌNH: KHÁC]\n- Phân tích bám sát thiết kế bản vẽ và bảng dự toán khối lượng thực tế.`;
  }
}

// -----------------------------------------------------------------------------
// AI Soát bản vẽ HSKT & Phối cảnh 3D qua integrations.js
// -----------------------------------------------------------------------------
const DRAWING_AI_SYSTEM = `Bạn là chuyên gia kiến trúc và nội thất GD HOME. Hãy phân tích hồ sơ bản vẽ thiết kế kỹ thuật (HSKT) đính kèm.
Với mỗi trang bản vẽ trong tài liệu, hãy xác định:
- pageNumber: số thứ tự trang (1, 2, 3...)
- drawingType: loại bản vẽ ('mat_bang', 'bo_tri', 'chi_tiet', 'dien_nuoc', 'mat_dung', 'mat_cat')
- room: tên phòng/không gian tương ứng (ví dụ: 'Phòng khách', 'Bếp & Ăn', 'Phòng ngủ master', 'Phòng ngủ con', 'WC', 'Cả nhà'...)
- title: tiêu đề bản vẽ
- items: mảng tên các hạng mục nội thất, cấu kiện hoặc thiết bị xuất hiện trong bản vẽ đó (ví dụ: ['Sofa', 'Bàn trà', 'Kệ tivi', 'Tủ áo', 'Tủ bếp', 'Giường', 'Vách ốp...'])
- quantities: mảng khối lượng/số lượng nếu có ghi chú trên bản vẽ: [{"name":"Tên","qty":1,"unit":"bộ"}]
Chỉ trả về JSON theo mẫu:
{"pages":[{"pageNumber":1,"drawingType":"mat_bang","room":"Cả nhà","title":"Mặt bằng bố trí nội thất","items":["Sofa","Bàn trà","Kệ tivi","Tủ bếp"],"quantities":[]}]}`;

const RENDER_AI_SYSTEM = `Bạn là chuyên gia thiết kế nội thất GD HOME. Hãy phân tích ảnh phối cảnh 3D đính kèm:
- room: tên không gian/phòng tương ứng (ví dụ: 'Phòng khách', 'Bếp & Ăn', 'Phòng ngủ master', 'Phòng ngủ con', 'Phòng tắm'...)
- detectedItems: mảng tên các món đồ nội thất, trang thiết bị chính thấy rõ trong bức ảnh (ví dụ: ['Sofa', 'Bàn trà', 'Kệ tivi', 'Đèn chùm'])
Chỉ trả về JSON theo mẫu:
{"room":"Phòng khách","detectedItems":["Sofa","Bàn trà","Kệ tivi"]}`;

async function runAiAnalysis(ai, drawings, renders, assets, buildingType = 'Chung cư', onProgress = null) {
  const model = await resolveModel(ai);
  const call = ai.provider === 'openai' ? callOpenAI : ai.provider === 'gemini' ? callGemini : callAnthropic;
  const contextPrompt = getBuildingContextPrompt(buildingType);
  const drawingSystem = DRAWING_AI_SYSTEM + contextPrompt;
  const renderSystem = RENDER_AI_SYSTEM + contextPrompt;

  const total = drawings.length + renders.length;
  let doneCount = 0;

  // 1. Phân tích các bản vẽ HSKT
  for (let i = 0; i < drawings.length; i++) {
    const doc = drawings[i];
    if (onProgress) onProgress({ step: `AI đang đọc bản vẽ ${i + 1}/${drawings.length}: ${doc.name}`, percent: Math.round(20 + (doneCount / Math.max(1, total)) * 50) });
    if (!doc.assetKey) { doneCount++; continue; }
    try {
      const { buf, mime } = await assets.read(doc.assetKey);
      let rawJson = '';
      // Các dịch vụ AI nhận tối đa ~20 MB mỗi lần (base64 to thêm 1/3): bỏ qua file quá lớn thay vì làm hỏng cả lượt soát.
      if (buf.length > 14 * 1024 * 1024) {
        doc.aiSkipped = 'Bản vẽ ' + Math.round(buf.length / 1048576) + ' MB vượt giới hạn AI (14 MB). Hãy tách file theo tầng hoặc in PDF nhẹ hơn.';
        doneCount++;
        continue;
      }
      delete doc.aiSkipped;
      if (mime === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf')) {
        const res = await callWithFallback(ai, model, call, [], [{ data: buf.toString('base64') }], 'Phân tích bản vẽ HSKT này.', drawingSystem);
        rawJson = res.raw;
      } else if (mime.startsWith('image/')) {
        const res = await callWithFallback(ai, model, call, [{ mediaType: mime, data: buf.toString('base64') }], [], 'Phân tích bản vẽ HSKT này.', drawingSystem);
        rawJson = res.raw;
      }
      if (rawJson) {
        const parsed = extractJson(rawJson);
        if (Array.isArray(parsed?.pages) && parsed.pages.length > 0) {
          doc.extractedPages = parsed.pages;
          doc.pages = Math.max(doc.pages || 1, parsed.pages.length);
        }
      }
    } catch (e) {
      console.error(`[AI Drawing Analysis Error for ${doc.name}]:`, e.message);
      throw e;
    }
    doneCount++;
  }

  // 2. Phân tích các ảnh phối cảnh 3D
  for (let j = 0; j < renders.length; j++) {
    const doc = renders[j];
    if (onProgress) onProgress({ step: `AI đang phân tích phối cảnh 3D ${j + 1}/${renders.length}: ${doc.name}`, percent: Math.round(20 + (doneCount / Math.max(1, total)) * 50) });
    if (!doc.assetKey) { doneCount++; continue; }
    try {
      const { buf, mime } = await assets.read(doc.assetKey);
      if (mime.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(doc.name)) {
        const cleanMime = mime.startsWith('image/') ? mime : 'image/jpeg';
        const res = await callWithFallback(ai, model, call, [{ mediaType: cleanMime, data: buf.toString('base64') }], [], 'Phân tích phối cảnh 3D này.', renderSystem);
        const parsed = extractJson(res.raw);
        if (parsed) {
          if (parsed.room) doc.room = parsed.room;
          if (Array.isArray(parsed.detectedItems)) doc.detectedItems = parsed.detectedItems;
        }
      }
    } catch (e) {
      console.error(`[AI Render Analysis Error for ${doc.name}]:`, e.message);
      throw e;
    }
    doneCount++;
  }
}

// -----------------------------------------------------------------------------
// B3: Quản lý Background Job phân tích AI
// -----------------------------------------------------------------------------
class HubJobManager {
  constructor() {
    this.jobs = new Map();
  }

  createJob({ projectId, projectName, dataKey, runFn }) {
    this.prune();
    const jobId = 'job_' + crypto.randomUUID();
    const controller = new AbortController();
    const job = {
      id: jobId,
      projectId,
      projectName: projectName || 'Dự án',
      dataKey,
      status: 'running',
      progress: 5,
      step: 'Khởi tạo tiến trình...',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      result: null,
      controller
    };

    this.jobs.set(jobId, job);

    (async () => {
      try {
        const result = await runFn(job, controller.signal);
        if (job.status !== 'cancelled') {
          job.status = 'done';
          job.progress = 100;
          job.step = 'Hoàn tất phân tích!';
          job.finishedAt = new Date().toISOString();
          job.result = result;
        }
      } catch (err) {
        if (job.status !== 'cancelled') {
          job.status = 'error';
          job.error = err.message || 'Lỗi không xác định khi chạy phân tích AI.';
          job.step = `Lỗi: ${job.error}`;
          job.finishedAt = new Date().toISOString();
        }
      }
    })();

    return job;
  }

  getJob(jobId, dataKey) {
    const job = this.jobs.get(jobId) || null;
    // Chỉ chủ tài khoản mới xem / huỷ được tiến trình của mình.
    return job && (dataKey === undefined || job.dataKey === dataKey) ? job : null;
  }

  prune() {
    // Bỏ các tiến trình đã xong quá 2 giờ để không giữ kết quả cũ trong bộ nhớ mãi.
    const limit = Date.now() - 2 * 3600 * 1000;
    for (const [id, job] of this.jobs) {
      if (job.status !== 'running' && job.finishedAt && Date.parse(job.finishedAt) < limit) this.jobs.delete(id);
    }
  }

  getActiveJob(dataKey, projectId = null) {
    for (const job of this.jobs.values()) {
      if (job.dataKey === dataKey) {
        if (!projectId || job.projectId === projectId) {
          if (job.status === 'running') return job;
        }
      }
    }
    const userJobs = [...this.jobs.values()].filter(j => j.dataKey === dataKey && (!projectId || j.projectId === projectId));
    return userJobs.at(-1) || null;
  }

  cancelJob(jobId, dataKey) {
    const job = this.getJob(jobId, dataKey);
    if (!job || job.status !== 'running') return false;
    job.status = 'cancelled';
    job.step = 'Đã huỷ tiến trình.';
    job.finishedAt = new Date().toISOString();
    try { job.controller.abort(); } catch {}
    return true;
  }

  serialize(job) {
    if (!job) return null;
    const { controller, ...safe } = job;
    return safe;
  }
}

const globalJobManager = new HubJobManager();

async function executeProjectReview({
  projectId,
  drawingDocId,
  skipAi,
  autoPush,
  hubStore,
  assets,
  store,
  dataKey,
  defaultSchedule,
  onProgress,
  signal
}) {
  if (onProgress) onProgress({ step: 'Đang tải hồ sơ dự án...', percent: 10 });
  const record = await hubStore.getProject(projectId);
  const buildingType = record.buildingType || record.profile?.buildingType || 'Chung cư';
  const drawings = (record.documents || []).filter(d => d.type === 'drawing');
  const renders = (record.documents || []).filter(d => d.type === 'render');

  if (!skipAi) {
    if (signal?.aborted) throw Object.assign(new Error('Tiến trình đã bị huỷ.'), { name: 'AbortError' });
    if (onProgress) onProgress({ step: 'Đang kết nối AI...', percent: 15 });
    const userCfg = await loadUserCfg(store, dataKey);
    const ai = resolveAi(userCfg);
    if (!ai) {
      throw Object.assign(new Error('Chưa kết nối AI. Hãy vào ⚙ Kết nối để dán API key (Gemini / ChatGPT / Claude).'), { status: 400 });
    }
    await runAiAnalysis(ai, drawings, renders, assets, buildingType, onProgress);
  }

  if (signal?.aborted) throw Object.assign(new Error('Tiến trình đã bị huỷ.'), { name: 'AbortError' });
  if (onProgress) onProgress({ step: 'Đang tính toán ma trận soát hồ sơ...', percent: 75 });
  const { findings, pageTags, renderTags } = computeReviewCoverage(record.quoteItems || [], drawings, renders);

  const targetDrawing = (drawingDocId ? drawings.find(d => d.id === drawingDocId) : null) || drawings[0];
  let annotatedAssetKey = null;

  if (targetDrawing && targetDrawing.assetKey) {
    if (onProgress) onProgress({ step: 'Đang đóng dấu và ghi chú bản vẽ PDF...', percent: 85 });
    try {
      const { buf } = await assets.read(targetDrawing.assetKey);
      const annotatedBytes = await annotateDrawingPdf(buf, findings, record.projectId);
      const saveRes = await assets.save(Buffer.from(annotatedBytes), '.pdf', 'application/pdf');
      annotatedAssetKey = saveRes.assetKey;
    } catch (err) {
      console.error('[Review PDF Annotation Error]:', err);
    }
  }

  if (onProgress) onProgress({ step: 'Đang lưu kết quả soát hồ sơ...', percent: 90 });
  const updatedRecord = await hubStore.saveProject(projectId, current => {
    current.documents = record.documents;
    current.reviewFindings = findings;
    current.reviewSummary = {
      lastRunAt: new Date().toISOString(),
      annotatedAssetKey,
      sourceDrawingDocId: targetDrawing?.id || null,
      pageTags,
      renderTags
    };
    return current;
  });

  let scheduleProposed = false;
  let materialsProposed = false;

  if (autoPush) {
    if (onProgress) onProgress({ step: 'Đang tự động đẩy đề xuất sang Tiến độ & Chốt mã...', percent: 95 });
    try {
      const schedule = (await store.get(dataKey)) || (defaultSchedule ? defaultSchedule() : { calendars: [], tasks: [] });
      const schedProposal = generateScheduleProposal(projectId, record.quoteItems || [], schedule.calendars || [], buildingType);
      schedule.calendars ||= [];
      if (!schedule.calendars.some(c => c.id === schedProposal.calendar.id)) {
        schedule.calendars.push(schedProposal.calendar);
      }
      schedule.tasks ||= [];
      schedule.tasks.push(...schedProposal.tasks);
      schedule._version = (schedule._version || 0) + 1;
      schedule._updatedAt = new Date().toISOString();
      await store.put(dataKey, schedule);

      await hubStore.saveProject(projectId, rec => {
        rec.pushLinks ||= {};
        rec.pushLinks.schedule = {
          lastPushedAt: new Date().toISOString(),
          calendarId: schedProposal.calendar.id,
          tasksCount: schedProposal.tasks.length
        };
        return rec;
      });
      scheduleProposed = true;
    } catch (e) {
      console.error('[AutoPush Schedule Error]:', e.message);
    }

    try {
      const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
      const matData = (await store.get(matKey)) || { _version: 0, sheets: [] };
      matData.sheets ||= [];
      const matProposal = generateMaterialsProposal(record.quoteItems || [], buildingType);
      const newSheet = {
        id: 'sheet_' + crypto.randomUUID().slice(0, 10),
        title: `Chốt mã vật liệu - Tự động từ AI`,
        projectId,
        createdAt: new Date().toISOString(),
        groups: matProposal.groups
      };
      matData.sheets.push(newSheet);
      matData._version = (matData._version || 0) + 1;
      matData._updatedAt = new Date().toISOString();
      await store.put(matKey, matData);

      await hubStore.saveProject(projectId, rec => {
        rec.pushLinks ||= {};
        rec.pushLinks.materials = {
          lastPushedAt: new Date().toISOString(),
          sheetId: newSheet.id,
          itemsCount: matProposal.groups.reduce((sum, g) => sum + g.rows.length, 0)
        };
        return rec;
      });
      materialsProposed = true;
    } catch (e) {
      console.error('[AutoPush Materials Error]:', e.message);
    }
  }

  if (onProgress) onProgress({ step: 'Hoàn tất phân tích!', percent: 100 });

  return {
    findings: updatedRecord.reviewFindings,
    summary: updatedRecord.reviewSummary,
    annotatedAssetKey,
    findingsCount: updatedRecord.reviewFindings.length,
    scheduleProposed,
    materialsProposed
  };
}

// -----------------------------------------------------------------------------
// Router chính: handleProjectHub
// -----------------------------------------------------------------------------
async function handleProjectHub(req, urlPath, { res, store, dataKey, readJsonBody, readRawBody, sendJson, dataDir, defaultSchedule }) {
  const hubStore = new ProjectHubStore(store, dataKey);
  const assets = new ProjectAssets(dataDir, dataKey);

  // 1. Phục vụ assets / tải file
  if (urlPath.startsWith('/api/project-hub/assets/')) {
    const assetKey = urlPath.slice('/api/project-hub/assets/'.length).split('?')[0];
    const urlObj = new URL(req.url, 'http://localhost');
    const download = urlObj.searchParams.get('download');
    try {
      await assets.send(res, assetKey, download);
      return;
    } catch (err) {
      return sendJson(res, err.status || 404, { success: false, message: err.message });
    }
  }

  // 2. Tổng quan dự án: GET /api/project-hub/overview
  if (urlPath === '/api/project-hub/overview' && req.method === 'GET') {
    const schedule = (await store.get(dataKey)) || defaultSchedule();
    const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
    const materials = (await store.get(matKey)) || { sheets: [] };
    const hub = await hubStore.load();

    const rawProjects = projectList(schedule, materials);
    const projects = rawProjects.map(p => {
      const hubRecord = hub.projects?.[p.id] || defaultProjectRecord(p.id);
      const stats = calculateProjectStats(p.id, schedule, materials, hubRecord);
      return {
        id: p.id,
        name: p.name,
        profile: p.profile,
        stats,
        updatedAt: hubRecord.updatedAt
      };
    });

    return sendJson(res, 200, {
      success: true,
      projects,
      storageInfo: {
        configured: assets.configured,
        r2: assets.configured,
        kind: getStorageKind(),
        warning: assets.configured ? null : 'Lưu tạm – sẽ mất khi server khởi động lại (chưa cấu hình kho lưu trữ B2 / R2)'
      }
    });
  }

  // 3. Chi tiết dự án: GET /api/project-hub/project?id=:id
  if (urlPath === '/api/project-hub/project' && req.method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const projectId = urlObj.searchParams.get('id');
    if (!projectId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId.' });

    const schedule = (await store.get(dataKey)) || defaultSchedule();
    const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
    const materials = (await store.get(matKey)) || { sheets: [] };

    const rawProjects = projectList(schedule, materials);
    const project = rawProjects.find(p => p.id === projectId);
    if (!project) return sendJson(res, 404, { success: false, message: 'Không tìm thấy dự án.' });

    const hubRecord = await hubStore.getProject(projectId);
    const stats = calculateProjectStats(projectId, schedule, materials, hubRecord);

    return sendJson(res, 200, {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        profile: project.profile,
        stats,
        hub: hubRecord
      },
      materialsSheets: (materials.sheets || []).filter(s => s.projectId === projectId || !s.projectId),
      storageInfo: {
        configured: assets.configured,
        r2: assets.configured,
        kind: getStorageKind(),
        warning: assets.configured ? null : 'Lưu tạm – sẽ mất khi server khởi động lại (chưa cấu hình kho lưu trữ B2 / R2)'
      }
    });
  }

  // 4. Tạo hoặc sửa dự án: POST /api/project-hub/project
  if (urlPath === '/api/project-hub/project' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || typeof body.profile !== 'object' || !body.profile) {
      return sendJson(res, 400, { success: false, message: 'Thiếu thông tin profile.' });
    }
    if (!body.profile.buildingType) {
      body.profile.buildingType = guessBuildingType(body.project || body.profile.project, body.profile.address);
    }
    const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
    const legacy = (await store.get(matKey)) || {};
    const result = await writeProjectProfile(store, dataKey, body, defaultSchedule, legacy);

    // Đồng bộ vào hubRecord
    const record = await hubStore.getProject(result.project.id);
    record.buildingType = body.profile.buildingType;
    await hubStore.saveProject(result.project.id, record);

    return sendJson(res, 200, { success: true, project: result.project });
  }

  // 5. Tải file tài liệu: POST /api/project-hub/documents/upload
  if (urlPath === '/api/project-hub/documents/upload' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    const isJson = contentType.includes('application/json');
    const isRenderForm = contentType.startsWith('multipart/form-data;');
    let projectId, name, type, room, cleanMime, buf, thumb, extractedPages, detectedItems, pageNumber = 1, sourcePdf = null;

    if (isRenderForm) {
      const url = new URL(req.url,'http://localhost');
      projectId = url.searchParams.get('projectId');
      name = url.searchParams.get('name');
      type = 'render';
      room = url.searchParams.get('room');
      pageNumber = parseInt(url.searchParams.get('pageNumber') || '1', 10);
      sourcePdf = url.searchParams.get('sourcePdf') ? decodeURIComponent(url.searchParams.get('sourcePdf')) : null;
      const bytes = await readRawBody(req,maxImageBytes + 1024*1024);
      try {
        const form = await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();
        const fullFile = form.get('full'), thumbFile = form.get('thumb');
        if (fullFile instanceof Blob) buf = Buffer.from(await fullFile.arrayBuffer());
        if (thumbFile instanceof Blob) thumb = Buffer.from(await thumbFile.arrayBuffer());
      } catch {
        return sendJson(res,400,{success:false,message:'Gói tải ảnh không hợp lệ.'});
      }
    } else if (isJson) {
      const body = await readJsonBody(req);
      projectId = body.projectId;
      name = body.name;
      type = body.type;
      room = body.room;
      extractedPages = body.extractedPages;
      detectedItems = body.detectedItems;
      cleanMime = body.mime;
      if (!projectId || !name || !type || !body.dataBase64) {
        return sendJson(res, 400, { success: false, message: 'Thiếu thông tin file tải lên.' });
      }
      buf = Buffer.from(body.dataBase64, 'base64');
    } else {
      // Binary upload trực tiếp (hỗ trợ tới 60MB)
      const urlObj = new URL(req.url, 'http://localhost');
      projectId = urlObj.searchParams.get('projectId') || req.headers['x-project-id'];
      const rawName = urlObj.searchParams.get('name') || req.headers['x-file-name'] || 'file';
      name = decodeURIComponent(rawName);
      type = urlObj.searchParams.get('type') || req.headers['x-doc-type'] || 'drawing';
      const rawRoom = urlObj.searchParams.get('room') || req.headers['x-room'] || 'Cả nhà';
      room = decodeURIComponent(rawRoom);
      cleanMime = contentType || MIME_MAP[path.extname(name).toLowerCase()] || 'application/octet-stream';
      if (!readRawBody) {
        return sendJson(res, 500, { success: false, message: 'Server chưa hỗ trợ đọc binary stream.' });
      }
      buf = await readRawBody(req, 60 * 1024 * 1024);
    }

    if (!projectId || !name || !type || !buf || buf.length === 0) {
      return sendJson(res, 400, { success: false, message: 'Thiếu thông tin file tải lên.' });
    }

    const ext = path.extname(name).toLowerCase() || '.bin';
    const {assetKey,thumbAssetKey,size,mime:finalMime} = isRenderForm ? await assets.saveRender(buf,thumb) : await assets.save(buf,ext,cleanMime);

    // Tính số trang nếu là PDF
    let pages = 1;
    if (!isRenderForm && ext === '.pdf') {
      try {
        const loadedPdf = await PDFDocument.load(buf);
        pages = loadedPdf.getPageCount();
      } catch (e) {
        pages = 1;
      }
    }

    const updatedRecord = await hubStore.saveProject(projectId, record => {
      record.documents ||= [];
      const existing = record.documents.find(d => d.name === name && d.type === type);

      if (existing) {
        // Cập nhật phiên bản
        existing.history ||= [];
        existing.history.push({
          version: existing.version,
          assetKey: existing.assetKey,
          thumbAssetKey: existing.thumbAssetKey,
          size: existing.size,
          uploadedAt: existing.uploadedAt,
          note: `Thay thế bởi phiên bản ${existing.version + 1}`
        });
        existing.version = (existing.version || 1) + 1;
        existing.assetKey = assetKey;
        existing.thumbAssetKey = thumbAssetKey;
        existing.size = size;
        existing.mime = finalMime;
        existing.pages = pages;
        existing.room = room || existing.room;
        if (typeof pageNumber === 'number') existing.pageNumber = pageNumber;
        if (sourcePdf) existing.sourcePdf = sourcePdf;
        if (extractedPages) existing.extractedPages = extractedPages;
        if (detectedItems) existing.detectedItems = detectedItems;
        existing.uploadedAt = new Date().toISOString();
      } else {
        // Tài liệu mới
        const newDoc = {
          id: 'doc_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
          type,
          name,
          room: room || 'Cả nhà',
          mime: finalMime,
          size,
          assetKey,
          thumbAssetKey,
          pages,
          pageNumber: typeof pageNumber === 'number' ? pageNumber : 1,
          sourcePdf: sourcePdf || null,
          version: 1,
          history: [],
          extractedPages: extractedPages || [],
          detectedItems: detectedItems || [],
          uploadedAt: new Date().toISOString()
        };
        record.documents.push(newDoc);
      }
      return record;
    });

    return sendJson(res, 200, { success: true, documents: updatedRecord.documents });
  }

  // 6. Xoá tài liệu: POST /api/project-hub/documents/delete
  if (urlPath === '/api/project-hub/documents/delete' && req.method === 'POST') {
    const { projectId, documentId } = await readJsonBody(req);
    if (!projectId || !documentId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId hoặc documentId.' });

    const updated = await hubStore.saveProject(projectId, record => {
      record.documents = (record.documents || []).filter(d => d.id !== documentId);
      return record;
    });

    return sendJson(res, 200, { success: true, documents: updated.documents });
  }

  // 7. Parse Báo giá: POST /api/project-hub/quote/parse
  if (urlPath === '/api/project-hub/quote/parse' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const { rows, rawText } = body;
    let items = [];
    if (Array.isArray(rows)) {
      items = parseQuoteSheetRows(rows);
    } else if (rawText) {
      // CSV format
      const csvRows = rawText.split(/\r?\n/).map(line => line.split(/[,\t;]/));
      items = parseQuoteSheetRows(csvRows);
    }
    return sendJson(res, 200, { success: true, items });
  }

  // 8. Lưu Báo giá: POST /api/project-hub/quote/save
  if (urlPath === '/api/project-hub/quote/save' && req.method === 'POST') {
    const { projectId, items } = await readJsonBody(req);
    if (!projectId || !Array.isArray(items)) return sendJson(res, 400, { success: false, message: 'Thiếu projectId hoặc danh sách items.' });

    const updated = await hubStore.saveProject(projectId, record => {
      record.quoteItems = items.map(item => ({
        ...item,
        id: item.id || 'qi_' + crypto.randomUUID().slice(0, 10),
        updatedAt: new Date().toISOString()
      }));
      return record;
    });

    return sendJson(res, 200, { success: true, quoteItems: updated.quoteItems });
  }

  // 9. Soát HSKT & Phối cảnh + Ghi chú PDF: POST /api/project-hub/review/run (Đồng bộ)
  if (urlPath === '/api/project-hub/review/run' && req.method === 'POST') {
    const { projectId, drawingDocId, skipAi, autoPush } = await readJsonBody(req);
    if (!projectId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId.' });

    const result = await executeProjectReview({
      projectId,
      drawingDocId,
      skipAi,
      autoPush,
      hubStore,
      assets,
      store,
      dataKey,
      defaultSchedule
    });

    return sendJson(res, 200, {
      success: true,
      findings: result.findings,
      summary: result.summary,
      annotatedAssetKey: result.annotatedAssetKey
    });
  }

  // B3.1: Khởi động Background Job: POST /api/project-hub/jobs/start
  if (urlPath === '/api/project-hub/jobs/start' && req.method === 'POST') {
    const { projectId, drawingDocId, skipAi, autoPush } = await readJsonBody(req);
    if (!projectId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId.' });

    const rec = await hubStore.getProject(projectId);
    const schedule = (await store.get(dataKey)) || defaultSchedule();
    const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
    const materials = (await store.get(matKey)) || { sheets: [] };
    const p = projectList(schedule, materials).find(proj => proj.id === projectId);
    const projectName = p?.name || rec.name || 'Dự án';

    const job = globalJobManager.createJob({
      projectId,
      projectName,
      dataKey,
      runFn: async (j, signal) => {
        return await executeProjectReview({
          projectId,
          drawingDocId,
          skipAi,
          autoPush,
          hubStore,
          assets,
          store,
          dataKey,
          defaultSchedule,
          onProgress: ({ step, percent }) => {
            j.step = step;
            if (typeof percent === 'number') j.progress = percent;
          },
          signal
        });
      }
    });

    return sendJson(res, 200, { success: true, job: globalJobManager.serialize(job) });
  }

  // B3.2: Thăm dò trạng thái Job: GET /api/project-hub/jobs/status?jobId=...
  if (urlPath === '/api/project-hub/jobs/status' && req.method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const jobId = urlObj.searchParams.get('jobId');
    if (!jobId) return sendJson(res, 400, { success: false, message: 'Thiếu jobId.' });
    const job = globalJobManager.getJob(jobId, dataKey);
    if (!job) return sendJson(res, 404, { success: false, message: 'Tiến trình không còn (máy chủ có thể vừa khởi động lại). Hãy chạy soát lại.' });
    return sendJson(res, 200, { success: true, job: globalJobManager.serialize(job) });
  }

  // B3.3: Lấy Job đang chạy gần nhất: GET /api/project-hub/jobs/active
  if (urlPath === '/api/project-hub/jobs/active' && req.method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const projectId = urlObj.searchParams.get('projectId');
    const job = globalJobManager.getActiveJob(dataKey, projectId);
    return sendJson(res, 200, { success: true, job: globalJobManager.serialize(job) });
  }

  // B3.4: Huỷ Job: POST /api/project-hub/jobs/cancel
  if (urlPath === '/api/project-hub/jobs/cancel' && req.method === 'POST') {
    const { jobId } = await readJsonBody(req);
    if (!jobId) return sendJson(res, 400, { success: false, message: 'Thiếu jobId.' });
    const cancelled = globalJobManager.cancelJob(jobId, dataKey);
    return sendJson(res, 200, { success: true, cancelled });
  }

  // B1.4: Gắn ảnh phối cảnh 3D vào Chốt mã: POST /api/project-hub/renders/assign-to-materials
  if (urlPath === '/api/project-hub/renders/assign-to-materials' && req.method === 'POST') {
    const { projectId, assetKey, sheetId, rowId, groupName } = await readJsonBody(req);
    if (!projectId || !assetKey) {
      return sendJson(res, 400, { success: false, message: 'Thiếu projectId hoặc assetKey.' });
    }

    const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
    const matData = (await store.get(matKey)) || { _version: 0, sheets: [] };
    matData.sheets ||= [];

    let sheet = sheetId ? matData.sheets.find(s => s.id === sheetId) : null;
    if (!sheet) {
      sheet = matData.sheets.find(s => s.projectId === projectId) || matData.sheets[0];
    }

    if (!sheet) {
      sheet = {
        id: 'sheet_' + crypto.randomUUID().slice(0, 10),
        title: `Chốt mã vật liệu - Dự án`,
        projectId,
        createdAt: new Date().toISOString(),
        groups: []
      };
      matData.sheets.push(sheet);
    }

    sheet.groups ||= [];
    const cleanImgName = assetKey.replace(/^render-/, '');
    let assignedCount = 0;

    if (rowId) {
      for (const grp of sheet.groups) {
        const r = (grp.rows || []).find(row => row.id === rowId);
        if (r) {
          r.render = Array.isArray(r.render) ? r.render : (r.render ? [r.render] : []);
          if (!r.render.includes(cleanImgName)) {
            r.render.push(cleanImgName);
            assignedCount++;
          }
          break;
        }
      }
    } else if (groupName) {
      let grp = sheet.groups.find(g => g.name === groupName);
      if (!grp) {
        grp = { id: 'grp_' + crypto.randomUUID().slice(0, 8), name: groupName, rows: [] };
        sheet.groups.push(grp);
      }
      grp.rows ||= [];
      if (grp.rows.length === 0) {
        grp.rows.push({
          id: 'row_' + crypto.randomUUID().slice(0, 8),
          name: groupName,
          render: [cleanImgName],
          options: [{ images: [] }, { images: [] }, { images: [] }]
        });
        assignedCount++;
      } else {
        for (const r of grp.rows) {
          r.render = Array.isArray(r.render) ? r.render : (r.render ? [r.render] : []);
          if (!r.render.includes(cleanImgName)) {
            r.render.push(cleanImgName);
            assignedCount++;
          }
        }
      }
    } else {
      if (sheet.groups.length === 0) {
        sheet.groups.push({
          id: 'grp_1',
          name: 'Phối cảnh 3D',
          rows: [{
            id: 'row_1',
            name: 'Phối cảnh 3D tổng thể',
            render: [cleanImgName],
            options: [{ images: [] }]
          }]
        });
        assignedCount++;
      } else {
        const firstRow = sheet.groups[0].rows?.[0];
        if (firstRow) {
          firstRow.render = Array.isArray(firstRow.render) ? firstRow.render : [];
          if (!firstRow.render.includes(cleanImgName)) {
            firstRow.render.push(cleanImgName);
            assignedCount++;
          }
        }
      }
    }

    matData._version = (matData._version || 0) + 1;
    matData._updatedAt = new Date().toISOString();
    await store.put(matKey, matData);

    return sendJson(res, 200, {
      success: true,
      message: 'Đã gắn ảnh 3D vào Chốt mã.',
      sheetId: sheet.id,
      assignedImage: cleanImgName,
      assignedCount
    });
  }

  // 10. Cập nhật kết quả soát: POST /api/project-hub/review/update
  if (urlPath === '/api/project-hub/review/update' && req.method === 'POST') {
    const { projectId, findingId, status, note } = await readJsonBody(req);
    if (!projectId || !findingId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId hoặc findingId.' });

    const updated = await hubStore.saveProject(projectId, record => {
      const f = (record.reviewFindings || []).find(rf => rf.id === findingId);
      if (f) {
        if (status) f.status = status;
        if (note !== undefined) f.note = note;
      }
      return record;
    });

    return sendJson(res, 200, { success: true, findings: updated.reviewFindings });
  }

  // 11. Đề xuất sang Tiến độ: POST /api/project-hub/push/schedule
  if (urlPath === '/api/project-hub/push/schedule' && req.method === 'POST') {
    const { projectId, apply } = await readJsonBody(req);
    if (!projectId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId.' });

    const record = await hubStore.getProject(projectId);
    const schedule = (await store.get(dataKey)) || defaultSchedule();
    const proposal = generateScheduleProposal(projectId, record.quoteItems || [], schedule.calendars || []);

    if (apply) {
      schedule.calendars ||= [];
      if (!schedule.calendars.some(c => c.id === proposal.calendar.id)) {
        schedule.calendars.push(proposal.calendar);
      }
      schedule.tasks ||= [];
      // Thêm các tasks mới
      schedule.tasks.push(...proposal.tasks);
      schedule._version = (schedule._version || 0) + 1;
      schedule._updatedAt = new Date().toISOString();
      await store.put(dataKey, schedule);

      await hubStore.saveProject(projectId, rec => {
        rec.pushLinks ||= {};
        rec.pushLinks.schedule = {
          lastPushedAt: new Date().toISOString(),
          calendarId: proposal.calendar.id,
          tasksCount: proposal.tasks.length
        };
        return rec;
      });
    }

    return sendJson(res, 200, { success: true, proposal, applied: !!apply });
  }

  // 12. Đề xuất sang Chốt mã: POST /api/project-hub/push/materials
  if (urlPath === '/api/project-hub/push/materials' && req.method === 'POST') {
    const { projectId, apply, sheetTitle } = await readJsonBody(req);
    if (!projectId) return sendJson(res, 400, { success: false, message: 'Thiếu projectId.' });

    const record = await hubStore.getProject(projectId);
    const proposal = generateMaterialsProposal(record.quoteItems || []);

    if (apply) {
      const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
      const matData = (await store.get(matKey)) || { _version: 0, sheets: [] };
      matData.sheets ||= [];

      const newSheet = {
        id: 'sheet_' + crypto.randomUUID().slice(0, 10),
        title: sheetTitle || `Chốt mã vật liệu - Từ Báo giá`,
        projectId,
        createdAt: new Date().toISOString(),
        groups: proposal.groups
      };

      matData.sheets.push(newSheet);
      matData._version = (matData._version || 0) + 1;
      matData._updatedAt = new Date().toISOString();
      await store.put(matKey, matData);

      await hubStore.saveProject(projectId, rec => {
        rec.pushLinks ||= {};
        rec.pushLinks.materials = {
          lastPushedAt: new Date().toISOString(),
          sheetId: newSheet.id,
          itemsCount: proposal.groups.reduce((sum, g) => sum + g.rows.length, 0)
        };
        return rec;
      });
    }

    return sendJson(res, 200, { success: true, proposal, applied: !!apply });
  }

  return sendJson(res, 404, { success: false, message: 'API project-hub không tồn tại.' });
}

async function attachProjectAiDocuments({store,dataKey,dataDir},body) {
  if (body.documentIds == null) return {body,aiSkipped:[]};
  const {projectId,documentIds} = body;
  const invalid = (message,status = 400) => Object.assign(new Error(message),{status});
  if (!Array.isArray(documentIds) || documentIds.length > 40 || documentIds.some(id => typeof id !== 'string')) throw invalid('Danh sách tài liệu không hợp lệ.');
  if (!documentIds.length) return {body,aiSkipped:[]};
  const hub = await new ProjectHubStore(store,dataKey).load();
  const record = typeof projectId === 'string' && Object.hasOwn(hub.projects || {},projectId) && hub.projects[projectId];
  if (!record) throw invalid('Không tìm thấy dự án.',404);
  const documents = [...new Set(documentIds)].map(id => record.documents?.find(doc => doc.id === id));
  if (documents.some(doc => !doc?.assetKey)) throw invalid('Không tìm thấy tài liệu trong dự án.',404);
  const assets = new ProjectAssets(dataDir,dataKey);
  const prepared = {
    images:Array.isArray(body.images) ? body.images.slice(0,6) : [],
    pdfs:Array.isArray(body.pdfs) ? body.pdfs.slice(0,2) : [],
    sheetText:String(body.sheetText || ''),notes:body.notes
  };
  const aiSkipped = [];
  const max = 9 * 1024 * 1024;
  for (const doc of documents) {
    const skip = reason => aiSkipped.push({id:doc.id,name:doc.name,reason});
    try {
      if (doc.size > 14 * 1024 * 1024) { skip('Vượt 14 MB'); continue; }
      const {buf,mime} = await assets.read(doc.assetKey);
      if (buf.length > 14 * 1024 * 1024) { skip('Vượt 14 MB'); continue; }
      const next = {...prepared};
      if (mime === 'application/pdf') {
        if (prepared.pdfs.length >= 2) { skip('Tối đa 2 PDF mỗi lượt'); continue; }
        next.pdfs = [...prepared.pdfs,{data:buf.toString('base64')}];
      } else if (/^image\/(png|jpeg|webp|gif)$/.test(mime)) {
        if (prepared.images.length >= 6) { skip('Tối đa 6 ảnh mỗi lượt'); continue; }
        next.images = [...prepared.images,{mediaType:mime,data:buf.toString('base64')}];
      } else if (/\.csv$/i.test(doc.name)) {
        next.sheetText += '\n' + doc.name + '\n' + buf.toString('utf8');
      } else if (/\.xlsx?$/i.test(doc.name)) {
        const xlsx = require('xlsx');
        const book = xlsx.read(buf,{sheetRows:2000});
        for (const name of book.SheetNames) {
          next.sheetText += '\n' + doc.name + ' / ' + name + '\n' + xlsx.utils.sheet_to_csv(book.Sheets[name],{blankrows:false});
          if (next.sheetText.length > 60000) break;
        }
      } else { skip('Định dạng chưa hỗ trợ'); continue; }
      if (next.sheetText.length > 60000 || Buffer.byteLength(JSON.stringify(next)) > max) { skip('Vượt giới hạn tổng tài liệu mỗi lượt'); continue; }
      Object.assign(prepared,next);
    } catch { skip('Không đọc được tệp'); }
  }
  return {body:prepared,aiSkipped};
}

module.exports = {
  attachProjectAiDocuments,
  ProjectHubStore,
  ProjectAssets,
  calculateProjectStats,
  parseQuoteSheetRows,
  computeReviewCoverage,
  annotateDrawingPdf,
  generateScheduleProposal,
  generateMaterialsProposal,
  handleProjectHub,
  DRAWING_AI_SYSTEM,
  RENDER_AI_SYSTEM,
  BUILDING_TYPES,
  guessBuildingType,
  getBuildingContextPrompt,
  executeProjectReview,
  globalJobManager,
  runAiAnalysis
};
