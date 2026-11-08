const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { PDFDocument, rgb } = require('pdf-lib');

const {
  parseQuoteSheetRows,
  computeReviewCoverage,
  annotateDrawingPdf,
  generateScheduleProposal,
  generateMaterialsProposal,
  ProjectAssets
} = require('../project-hub');

test('Quản lý dự án: Đọc báo giá, ma trận soát HSKT & phối cảnh 3D, đóng dấu PDF và đề xuất', async t => {
  // 1. Kiểm tra thuần: Đọc báo giá từ mảng dòng bảng tính
  const sampleQuoteRows = [
    ['BẢNG DỰ TOÁN NỘI THẤT CĂN HỘ MASTERI'],
    ['STT', 'Mã hiệu', 'Tên hạng mục / Công việc', 'Khu vực / Phòng', 'Quy cách / Chất liệu', 'Khối lượng', 'ĐVT', 'Đơn giá', 'Thành tiền', 'Ghi chú'],
    ['I. PHÒNG KHÁCH'],
    ['1', 'NT-PK-01', 'Sofa văng nỉ cao cấp', 'Phòng khách', 'Khung sồi, đệm bọc nỉ Hàn Quốc 2400x900', '1', 'bộ', '18000000', '18000000', 'PA1'],
    ['2', 'NT-PK-02', 'Bàn trà mặt đá', 'Phòng khách', 'Mặt đá Ceramic chống xước', '1', 'cái', '4500000', '4500000', ''],
    ['3', 'NT-PK-03', 'Hệ tủ tivi kết hợp đợt trang trí', 'Phòng khách', 'MDF lõi xanh chống ẩm An Cường', '4.2', 'md', '2800000', '11760000', ''],
    ['II. PHÒNG BẾP'],
    ['4', 'NT-BP-01', 'Tủ bếp trên thùng MDF phủ Melamine', 'Bếp', 'MDF chống ẩm, cánh Acrylic noline', '3.5', 'md', '3200000', '11200000', ''],
    ['5', 'NT-BP-02', 'Đá mặt bàn bếp', 'Bếp', 'Đá nhân tạo gốc thạch anh Vicostone', '3.5', 'md', '2500000', '8750000', ''],
    ['III. PHẦN THÔ & MEP'],
    ['6', 'XD-01', 'Tháo dỡ tường ngăn & vận chuyển phế thải', 'Cả nhà', 'Nhân công tháo dỡ', '1', 'gói', '5000000', '5000000', '']
  ];

  const parsedItems = parseQuoteSheetRows(sampleQuoteRows);
  assert.equal(parsedItems.length, 6);
  assert.equal(parsedItems[0].name, 'Sofa văng nỉ cao cấp');
  assert.equal(parsedItems[0].room, 'Phòng khách');
  assert.equal(parsedItems[0].category, 'Đồ rời & Sofa/Rèm');
  assert.equal(parsedItems[2].category, 'Đồ gỗ nội thất');
  assert.equal(parsedItems[4].category, 'Ốp lát đá & gạch');
  assert.equal(parsedItems[5].category, 'Phần thô & Xây trát');

  // 2. Kiểm tra thuần: Ma trận soát HSKT & phối cảnh 3D
  const drawings = [
    {
      id: 'doc_draw_1',
      name: 'HSKT-Mat-Bang.pdf',
      type: 'drawing',
      pages: 2,
      extractedPages: [
        {
          pageNumber: 1,
          room: 'Phòng khách',
          title: 'Mặt bằng bố trí nội thất',
          items: ['Sofa', 'Bàn trà'],
          quantities: [{ name: 'Sofa', qty: 1 }]
        },
        {
          pageNumber: 2,
          room: 'Phòng khách',
          title: 'Chi tiết kệ tivi',
          items: ['Hệ tủ tivi'],
          quantities: [{ name: 'Hệ tủ tivi', qty: 3.5, unit: 'md' }] // Lệch với báo giá 4.2 md
        }
      ]
    }
  ];

  const renders = [
    {
      id: 'doc_3d_1',
      name: 'PC-Phong-Khach-01.jpg',
      type: 'render',
      room: 'Phòng khách',
      detectedItems: ['Sofa', 'Bàn trà']
    }
  ];

  const { findings } = computeReviewCoverage(parsedItems, drawings, renders);
  assert.ok(findings.length > 0);

  // Phát hiện thiếu bản vẽ HSKT cho Tủ bếp (vì chỉ có bản vẽ phòng khách)
  const missingDraw = findings.find(f => f.type === 'missing_drawing');
  assert.ok(missingDraw, 'Phải phát hiện thiếu bản vẽ HSKT');

  // Phát hiện lệch khối lượng hệ tủ tivi
  const mismatchQty = findings.find(f => f.type === 'qty_mismatch');
  assert.ok(mismatchQty, 'Phải phát hiện lệch khối lượng giữa HSKT và Báo giá');
  assert.equal(mismatchQty.pageNumber, 2);

  // 3. Kiểm tra thuần: Đóng dấu & ghi chú PDF bằng Roboto Unicode fontkit
  const samplePdf = await PDFDocument.create();
  const page1 = samplePdf.addPage([595.28, 841.89]);
  page1.drawText('Trang 1: Ban ve mat bang phong khach', { x: 50, y: 800, size: 14 });
  const page2 = samplePdf.addPage([595.28, 841.89]);
  page2.drawText('Trang 2: Chi tiet ke tivi phong khach', { x: 50, y: 800, size: 14 });
  const originalBytes = await samplePdf.save();

  // Đóng dấu với tên dự án và tiêu đề tiếng Việt có dấu
  const annotatedBytes = await annotateDrawingPdf(Buffer.from(originalBytes), findings, 'Căn hộ Masteri Thảo Điền');
  assert.ok(annotatedBytes.length > originalBytes.length);

  const reloaded = await PDFDocument.load(annotatedBytes);
  // Có thêm trang bìa tổng hợp phát hiện chèn vào đầu -> tổng số trang = 3
  assert.equal(reloaded.getPageCount(), 3);

  // 4. Kiểm tra thuần: Đề xuất tiến độ thi công & Đề xuất bảng chốt mã
  const scheduleProposal = generateScheduleProposal('owner_test_1', parsedItems, []);
  assert.ok(scheduleProposal.tasks.length >= 3);
  assert.ok(scheduleProposal.tasks.some(t => t.linkType === 'FS'), 'Phải có liên kết FS giữa các bước');
  assert.ok(scheduleProposal.tasks.every(t => Array.isArray(t.sourceQuoteItemIds)));

  const materialsProposal = generateMaterialsProposal(parsedItems);
  assert.ok(materialsProposal.groups.length >= 2);
  const sofaGroup = materialsProposal.groups.find(g => g.name.includes('NỈ BỌC') || g.name.includes('MÃ GỖ'));
  assert.ok(sofaGroup, 'Phải phân loại vật liệu vào nhóm mẫu chuẩn');
});

test('Server & Quản lý dự án: API /api/project-hub, tải file, lưu báo giá và đồng bộ dữ liệu', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdhome-project-hub-'));
  Object.assign(process.env, {
    DATA_DIR: dir,
    GIST_TOKEN: '',
    GOOGLE_CLIENT_ID: 'test-client',
    SESSION_SECRET: 'test-session'
  });

  const { server, initStore, signSession } = require('../server');
  await initStore();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const origin = 'http://127.0.0.1:' + server.address().port;
  const email = 'kientrucsu@gdhome.vn';
  function token(user) {
    return signSession({ email: user, exp: Date.now() + 3600000 });
  }

  async function call(route, body, method) {
    const res = await fetch(origin + route, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        Authorization: 'Bearer ' + token(email),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }

  // 1. Khung trang /du-an và kiểm tra giao diện GĐ10
  const pageRes = await fetch(origin + '/du-an');
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.ok(html.includes('Quản lý dự án'));
  assert.ok(html.includes('data-shell-slot="file"'), 'Phải có slot file');
  assert.ok(html.includes('data-shell-slot="ai"'), 'Phải có slot ai');
  assert.ok(html.includes('data-shell-slot="copy"'), 'Phải có slot copy');
  assert.ok(html.includes('data-shell-slot="undo"'), 'Phải có slot undo');
  assert.ok(html.includes('data-shell-slot="primary"'), 'Phải có slot primary');
  assert.ok(html.includes('shell-sidebar sidebar-compact'), 'Phải dùng shell-sidebar compact');
  assert.ok(html.includes('sb-collapsible'), 'Phải dùng sb-collapsible');

  // Static assets
  assert.equal((await fetch(origin + '/project-hub.css')).status, 200);
  assert.equal((await fetch(origin + '/project-hub-client.js')).status, 200);

  // 2. Bảo mật: Thử gửi token qua query param ?token= mà không có header -> Phải trả 401
  const insecureRes = await fetch(origin + `/api/project-hub/overview?token=${token(email)}`);
  assert.equal(insecureRes.status, 401, 'Không cho phép xác thực qua ?token= trong URL');

  // 3. Tạo dự án mới qua /api/project-hub/project
  const createRes = await call('/api/project-hub/project', {
    create: true,
    profile: {
      project: 'Biệt thự Ecopark Vườn Mai',
      customer: 'Chị Mai',
      phone: '0988776655',
      address: 'Khu Vườn Mai, Ecopark',
      contract: 'HĐ-2026/ECO/01'
    }
  });
  assert.equal(createRes.status, 200);
  assert.ok(createRes.data.project.id);
  const projectId = createRes.data.project.id;

  // 4. Lấy tổng quan dự án & kiểm tra cảnh báo R2
  const overviewRes = await call('/api/project-hub/overview');
  assert.equal(overviewRes.status, 200);
  const projectInList = overviewRes.data.projects.find(p => p.id === projectId);
  assert.ok(projectInList);
  assert.equal(projectInList.name, 'Biệt thự Ecopark Vườn Mai');
  assert.ok(projectInList.stats);
  // Kiểm tra cảnh báo đĩa tạm khi chưa có R2
  assert.equal(overviewRes.data.storageInfo.r2, false);
  assert.ok(overviewRes.data.storageInfo.warning.includes('Lưu tạm'));

  // 5. Tải tệp hồ sơ (Bản vẽ PDF) qua JSON base64
  const dummyPdf = await PDFDocument.create();
  dummyPdf.addPage([500, 700]);
  const pdfBytes = await dummyPdf.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

  const uploadRes = await call('/api/project-hub/documents/upload', {
    projectId,
    name: 'HSKT-Kien-Truc.pdf',
    type: 'drawing',
    mime: 'application/pdf',
    dataBase64: pdfBase64,
    room: 'Phòng khách',
    extractedPages: [
      { pageNumber: 1, room: 'Phòng khách', title: 'Mặt bằng phòng khách', items: ['Sofa', 'Kệ tivi'] }
    ]
  });
  assert.equal(uploadRes.status, 200);
  assert.equal(uploadRes.data.documents.length, 1);
  assert.equal(uploadRes.data.documents[0].version, 1);

  // 6. Tải tệp hồ sơ nhị phân thô (Raw binary body) hỗ trợ tới 60MB
  const binaryPdfBuffer = Buffer.from(pdfBytes);
  const rawUploadRes = await fetch(origin + `/api/project-hub/documents/upload?projectId=${encodeURIComponent(projectId)}&name=${encodeURIComponent('HSKT-Nhi-Phan.pdf')}&type=drawing&room=${encodeURIComponent('Phòng khách')}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token(email),
      'Content-Type': 'application/pdf',
      'Content-Length': String(binaryPdfBuffer.length)
    },
    body: binaryPdfBuffer
  });
  assert.equal(rawUploadRes.status, 200);
  const rawUploadData = await rawUploadRes.json();
  assert.ok(rawUploadData.documents.some(d => d.name === 'HSKT-Nhi-Phan.pdf'));

  // 7. Thử tải tệp vượt quá 60MB -> Phải trả về 413
  const hugeBuffer = Buffer.alloc(61 * 1024 * 1024);
  const hugeHeaderRes = await fetch(origin + `/api/project-hub/documents/upload?projectId=${encodeURIComponent(projectId)}&name=QuaTai.pdf&type=drawing`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token(email),
      'Content-Type': 'application/pdf',
      'Content-Length': String(hugeBuffer.length)
    },
    body: hugeBuffer
  });
  assert.equal(hugeHeaderRes.status, 413);

  // 8. Lưu bảng hạng mục báo giá
  const saveQuoteRes = await call('/api/project-hub/quote/save', {
    projectId,
    items: [
      {
        stt: '1',
        code: 'SOFA-01',
        name: 'Sofa góc nỉ cao cấp',
        room: 'Phòng khách',
        category: 'Đồ rời & Sofa/Rèm',
        spec: 'Khung gỗ tự nhiên, đệm bọc nỉ Hàn Quốc',
        qty: 1,
        unit: 'bộ',
        unitPrice: 22000000,
        amount: 22000000
      },
      {
        stt: '2',
        code: 'TUBEP-01',
        name: 'Tủ bếp Acrylic chữ L',
        room: 'Bếp',
        category: 'Đồ gỗ nội thất',
        spec: 'Thùng MDF chống ẩm phủ Melamine, cánh phủ Acrylic',
        qty: 4,
        unit: 'md',
        unitPrice: 4000000,
        amount: 16000000
      }
    ]
  });
  assert.equal(saveQuoteRes.status, 200);
  assert.equal(saveQuoteRes.data.quoteItems.length, 2);

  // 9. Soát HSKT: Thử chạy khi chưa có key AI -> Phải trả 400 báo rõ ràng (không sinh kết quả giả)
  const noAiReviewRes = await call('/api/project-hub/review/run', { projectId });
  assert.equal(noAiReviewRes.status, 400);
  assert.ok(noAiReviewRes.data.message.includes('Chưa kết nối AI'));

  // 10. Chạy soát với cờ skipAi: true (để kiểm tra ma trận phủ & đóng dấu PDF)
  const reviewRes = await call('/api/project-hub/review/run', { projectId, skipAi: true });
  assert.equal(reviewRes.status, 200);
  assert.ok(reviewRes.data.findings.length > 0);
  assert.ok(reviewRes.data.annotatedAssetKey, 'Phải sinh ra bản PDF có ghi chú đánh dấu');

  // Kiểm tra tải file PDF đã đánh dấu qua asset key bằng Authorization header
  const assetUrl = origin + `/api/project-hub/assets/${reviewRes.data.annotatedAssetKey}`;
  const downloadRes = await fetch(assetUrl, {
    headers: { Authorization: 'Bearer ' + token(email) }
  });
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'application/pdf');

  // 11. Cập nhật ghi chú và trạng thái phát hiện
  const firstFinding = reviewRes.data.findings[0];
  const updateFindingRes = await call('/api/project-hub/review/update', {
    projectId,
    findingId: firstFinding.id,
    status: 'resolved',
    note: 'Đã bổ sung bản vẽ chi tiết bổ sung'
  });
  assert.equal(updateFindingRes.status, 200);
  const updatedItem = updateFindingRes.data.findings.find(f => f.id === firstFinding.id);
  assert.equal(updatedItem.status, 'resolved');
  assert.equal(updatedItem.note, 'Đã bổ sung bản vẽ chi tiết bổ sung');

  // 12. Đẩy đề xuất sang Lịch Tiến Độ
  const pushScheduleRes = await call('/api/project-hub/push/schedule', { projectId, apply: true });
  assert.equal(pushScheduleRes.status, 200);
  assert.equal(pushScheduleRes.data.applied, true);
  assert.ok(pushScheduleRes.data.proposal.tasks.length > 0);

  // 13. Đẩy đề xuất sang Chốt Mã Vật Liệu
  const pushMaterialsRes = await call('/api/project-hub/push/materials', { projectId, apply: true });
  assert.equal(pushMaterialsRes.status, 200);
  assert.equal(pushMaterialsRes.data.applied, true);

  // 14. Kiểm tra lại /api/project-hub/project chi tiết
  const detailRes = await call(`/api/project-hub/project?id=${projectId}`);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.data.project.name, 'Biệt thự Ecopark Vườn Mai');
  assert.ok(detailRes.data.project.stats.schedule.taskCount > 0);
  assert.ok(detailRes.data.project.stats.materials.sheetCount > 0);
  assert.equal(detailRes.data.project.stats.hub.quoteItemCount, 2);
  assert.equal(detailRes.data.storageInfo.r2, false);
});

test('GĐ11.7 E2E: Tạo dự án -> tải báo giá CSV + PDF mẫu + 2 ảnh 3D -> soát hồ sơ bằng AI thật (mock) -> tải PDF ghi chú -> đẩy sang Lịch & Chốt mã', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdhome-e2e-'));
  Object.assign(process.env, {
    DATA_DIR: dir,
    GIST_TOKEN: '',
    GOOGLE_CLIENT_ID: 'test-client',
    SESSION_SECRET: 'test-session',
    GEMINI_API_KEY: 'test-gemini-key' // Cấu hình key AI chung qua biến môi trường
  });

  const { server, initStore, signSession } = require('../server');
  await initStore();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  // Mock global fetch để giả lập phản hồi của Gemini khi AI phân tích bản vẽ và ảnh 3D
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      if (urlStr.includes(':generateContent')) {
        const bodyStr = options?.body || '';
        if (bodyStr.includes('HSKT') || bodyStr.includes('bản vẽ')) {
          // AI phân tích bản vẽ HSKT
          const drawingResult = {
            pages: [
              {
                pageNumber: 1,
                drawingType: 'mat_bang',
                room: 'Phòng khách',
                title: 'Mặt bằng bố trí nội thất phòng khách',
                items: ['Sofa văng da Ý', 'Vách ốp trang trí'],
                quantities: []
              },
              {
                pageNumber: 2,
                drawingType: 'chi_tiet',
                room: 'Bếp',
                title: 'Chi tiết tủ bếp Acrylic',
                items: ['Tủ bếp Acrylic'],
                quantities: [{ name: 'Tủ bếp Acrylic', qty: 5.2, unit: 'md' }]
              }
            ]
          };
          return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(drawingResult) }] } }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } else {
          // AI phân tích ảnh 3D
          const renderResult = {
            room: 'Phòng khách',
            detectedItems: ['Sofa văng da Ý', 'Vách ốp trang trí']
          };
          return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(renderResult) }] } }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({
        models: [{ name: 'models/gemini-2.5-flash' }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, options);
  };

  t.after(async () => {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const origin = 'http://127.0.0.1:' + server.address().port;
  const email = 'kts.duc@gdhome.vn';
  const token = signSession({ email, exp: Date.now() + 3600000 });

  async function post(route, body) {
    const res = await originalFetch(origin + route, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() };
  }

  // Bước 1: Tạo dự án mới
  const { data: created } = await post('/api/project-hub/project', {
    create: true,
    profile: {
      project: 'Nhà phố Ciputra KĐT Nam Thăng Long',
      customer: 'Anh Đức GD HOME',
      phone: '0901234567',
      address: 'Lô C7 Ciputra, Tây Hồ, Hà Nội',
      contract: 'HĐ-2026/CPT/11'
    }
  });
  const projId = created.project.id;
  assert.ok(projId);

  // Bước 2: Tải báo giá CSV mẫu
  const csvContent = [
    'STT,Mã,Tên hạng mục,Phòng,Quy cách,Khối lượng,ĐVT,Đơn giá,Thành tiền',
    '1,PK-01,Sofa văng da Ý,Phòng khách,Khung gỗ sồi bọc da Ý cao cấp,1,bộ,35000000,35000000',
    '2,PK-02,Vách ốp trang trí sau sofa,Phòng khách,MDF chống ẩm ốp lam sóng than tre,15.5,m2,1600000,24800000',
    '3,BP-01,Tủ bếp Acrylic chữ U,Bếp,MDF An Cường cánh Acrylic bóng gương,5.2,md,4200000,21840000',
    '4,NM-01,Giường ngủ bọc nỉ Master,Ngủ master,Gỗ sồi bọc nỉ cỏ may,1,bộ,16000000,16000000'
  ].join('\n');

  const { data: parsedQuote } = await post('/api/project-hub/quote/parse', { rawText: csvContent });
  assert.equal(parsedQuote.items.length, 4);
  await post('/api/project-hub/quote/save', { projectId: projId, items: parsedQuote.items });

  // Bước 3: Tải PDF bản vẽ mẫu
  const drawPdf = await PDFDocument.create();
  const p1 = drawPdf.addPage([595, 842]);
  p1.drawText('Trang 1: Mat bang bo tri noi that tong the Ciputra', { x: 50, y: 800, size: 14 });
  const p2 = drawPdf.addPage([595, 842]);
  p2.drawText('Trang 2: Chi tiet tu bep chu U phong bep', { x: 50, y: 800, size: 14 });
  const drawBytes = await drawPdf.save();

  await post('/api/project-hub/documents/upload', {
    projectId: projId,
    name: 'HSKT-Ciputra-NoiThat.pdf',
    type: 'drawing',
    mime: 'application/pdf',
    dataBase64: Buffer.from(drawBytes).toString('base64'),
    room: 'Cả nhà'
  });

  // Bước 4: Tải 2 ảnh phối cảnh 3D
  const dummyImgBase64 = Buffer.from('fake-3d-image-data-1').toString('base64');
  await post('/api/project-hub/documents/upload', {
    projectId: projId,
    name: 'PC-PhongKhach-01.jpg',
    type: 'render',
    mime: 'image/jpeg',
    dataBase64: dummyImgBase64,
    room: 'Phòng khách'
  });

  const dummyImg2Base64 = Buffer.from('fake-3d-image-data-2').toString('base64');
  await post('/api/project-hub/documents/upload', {
    projectId: projId,
    name: 'PC-PhongBep-01.jpg',
    type: 'render',
    mime: 'image/jpeg',
    dataBase64: dummyImg2Base64,
    room: 'Bếp'
  });

  // Bước 5: Chạy soát HSKT & Phối cảnh 3D qua AI thật (gọi Gemini mock)
  const { data: reviewResult } = await post('/api/project-hub/review/run', { projectId: projId });
  assert.ok(reviewResult.findings.length > 0);
  assert.ok(reviewResult.annotatedAssetKey, 'Phải sinh file PDF đã ghi chú cảnh báo');

  // Kiểm tra AI trích xuất trang bản vẽ: Giường ngủ Master thiếu bản vẽ HSKT
  const missingBed = reviewResult.findings.find(f => f.title.includes('Giường ngủ') || f.title.includes('NM-01'));
  assert.ok(missingBed, 'Hệ thống phải phát hiện thiếu bản vẽ Giường ngủ Master qua AI trích xuất');

  // Bước 6: Tải PDF đã ghi chú về và kiểm tra
  const pdfDownloadRes = await originalFetch(origin + `/api/project-hub/assets/${reviewResult.annotatedAssetKey}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  assert.equal(pdfDownloadRes.status, 200);
  const annotatedPdfBytes = await pdfDownloadRes.arrayBuffer();
  const loadedAnnotatedPdf = await PDFDocument.load(annotatedPdfBytes);
  // Ban đầu 2 trang + 1 trang bìa cảnh báo tổng hợp chèn vào đầu = 3 trang
  assert.equal(loadedAnnotatedPdf.getPageCount(), 3);

  // Bước 7: Đẩy sang Lịch Tiến Độ
  const { data: pushedSchedule } = await post('/api/project-hub/push/schedule', { projectId: projId, apply: true });
  assert.equal(pushedSchedule.applied, true);
  assert.ok(pushedSchedule.proposal.tasks.length >= 2);

  // Bước 8: Đẩy sang Chốt Mã Vật Liệu
  const { data: pushedMaterials } = await post('/api/project-hub/push/materials', { projectId: projId, apply: true });
  assert.equal(pushedMaterials.applied, true);
  assert.ok(pushedMaterials.proposal.groups.length >= 2);
});

test('Claude Review GĐ11: Kiểm thử 7 mục sửa (AI soát bản vẽ, R2, Upload 60MB nhị phân, Bảo mật bỏ token trong URL, Font Unicode PDF, Giao diện GĐ10, Batch deploy)', async t => {
  // Mục 5: Font Unicode PDF tiếng Việt có dấu
  const testPdf = await PDFDocument.create();
  testPdf.addPage([500, 700]);
  const baseBytes = await testPdf.save();
  const findingsWithAccents = [
    {
      id: 'rf_test_accents',
      type: 'missing_drawing',
      severity: 'high',
      room: 'Phòng ngủ Master',
      title: 'Thiếu bản vẽ HSKT: Tủ áo cánh kính lùa & Giường ngủ',
      detail: 'Hạng mục "Tủ áo cánh kính lùa" có trong báo giá nhưng chưa thấy trong bản vẽ thi công.',
      pageNumber: 1
    }
  ];
  const annotatedBytes = await annotateDrawingPdf(Buffer.from(baseBytes), findingsWithAccents, 'Biệt thự Đảo Ecopark Grand');
  assert.ok(annotatedBytes.length > baseBytes.length);
  const loadedPdf = await PDFDocument.load(annotatedBytes);
  assert.equal(loadedPdf.getPageCount(), 2);

  // Mục 7: Kiểm tra Cap-Nhat-Web-Len-Mang.bat chứa package-lock.json
  const batContent = await fs.readFile(path.join(__dirname, '..', 'Cap-Nhat-Web-Len-Mang.bat'), 'utf8');
  assert.ok(batContent.includes('package-lock.json'), 'Cap-Nhat-Web-Len-Mang.bat phải có package-lock.json');
  assert.ok(batContent.includes('fonts'), 'Cap-Nhat-Web-Len-Mang.bat phải có thư mục fonts');

  // Mục 2 & 3: Kiểm tra ProjectAssets
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdhome-assets-test-'));
  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const assets = new ProjectAssets(tmpDir, 'test-account-key');
  const saved = await assets.save(Buffer.from('hello-world-project-hub'), '.txt', 'text/plain');
  assert.ok(saved.assetKey);
  const readBack = await assets.read(saved.assetKey);
  assert.equal(readBack.buf.toString('utf8'), 'hello-world-project-hub');
});
