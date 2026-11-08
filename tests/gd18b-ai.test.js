'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { PDFDocument } = require('pdf-lib');

const {
  AI_TIMING,
  setAiTiming,
  callWithFallback,
  callGemini,
  testAiConnection,
  handleIntegrations
} = require('../integrations');
const {
  ProjectHubStore,
  ProjectAssets,
  executeProjectReview,
  globalJobManager
} = require('../project-hub');

async function makeMultiPagePdf(pageCount = 12) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([200, 200]);
    page.drawText('Trang ' + (i + 1), { x: 20, y: 100, size: 12 });
  }
  return Buffer.from(await pdf.save());
}

test('GĐ18B.4: Mặc định timeout AI là 120s và thử lại 2 lần', () => {
  assert.equal(AI_TIMING.callTimeoutMs, 120000);
  assert.equal(AI_TIMING.retries, 2);
});

test('GĐ18B.4: Giả lập Gemini chậm 90s (trong ngưỡng 120s) vẫn hoàn tất bình thường', async t => {
  const origFetch = global.fetch;
  // Kiểm tra callGemini truyền signal có timeout >= 120000ms và chịu được phản hồi trễ
  let capturedSignal = null;
  global.fetch = async (url, opts = {}) => {
    capturedSignal = opts.signal;
    // Giả lập phản hồi chậm (dùng 60ms đại diện luồng 90s dưới ngưỡng 120s; đồng thời kiểm tra timeout cấu hình 120s)
    await new Promise(r => setTimeout(r, 60));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"ok":true,"simulatedDelaySec":90}' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { global.fetch = origFetch; });

  assert.equal(AI_TIMING.callTimeoutMs, 120000, 'Timeout mỗi lần gọi Gemini phải là 120s (> 90s)');
  const ai = { provider: 'gemini', key: 'test-key', model: 'gemini-2.5-flash' };
  const res = await callWithFallback(ai, 'gemini-2.5-flash', callGemini, [], [], 'Kiểm tra 90s');
  assert.ok(capturedSignal, 'Phải gắn AbortSignal cho fetch');
  assert.equal(capturedSignal.aborted, false);
  assert.match(res.raw, /"simulatedDelaySec":90/);
});

test('GĐ18B.4: Giả lập lỗi 429 (hết hạn mức tạm thời) -> tự thử lại 2 lần và thành công hoặc báo tiếng Việt rõ ràng', async t => {
  const origFetch = global.fetch;
  const origTiming = setAiTiming({ retryDelaysMs: [10, 20] });
  t.after(() => {
    global.fetch = origFetch;
    setAiTiming(origTiming);
  });

  // Trường hợp 1: 2 lần đầu 429, lần thứ 3 (retry 2) thành công
  let calls = 0;
  const retriesObserved = [];
  global.fetch = async () => {
    calls++;
    if (calls <= 2) {
      return new Response(JSON.stringify({
        error: { message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"pages":[{"pageNumber":1,"title":"OK"}]}' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const ai = { provider: 'gemini', key: 'test-key', model: 'gemini-2.5-flash' };
  const okRes = await callWithFallback(ai, 'gemini-2.5-flash', callGemini, [], [], 'Test 429 recover', 'sys', {
    onRetry: info => retriesObserved.push(info.attempt)
  });
  assert.equal(calls, 3, 'Phải gọi tổng cộng 3 lần (1 lần đầu + 2 lần thử lại)');
  assert.deepEqual(retriesObserved, [1, 2]);
  assert.match(okRes.raw, /"pageNumber":1/);

  // Trường hợp 2: 429 cả 3 lần -> báo lỗi tiếng Việt rõ nguyên nhân hết hạn mức
  calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' }
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  };

  await assert.rejects(
    () => callWithFallback(ai, 'gemini-2.5-flash', callGemini, [], [], 'Test 429 fail'),
    err => {
      assert.equal(err.aiCode, 'quota');
      assert.match(err.message, /hết hạn mức/i);
      assert.match(err.message, /Thử lại/i);
      return true;
    }
  );
  assert.equal(calls, 3);
});

test('GĐ18B.4: Giả lập lỗi 400 (key sai / tệp quá lớn / yêu cầu không hợp lệ) -> không thử lại vô ích, báo rõ tiếng Việt', async t => {
  const origFetch = global.fetch;
  t.after(() => { global.fetch = origFetch; });

  const ai = { provider: 'gemini', key: 'bad-key', model: 'gemini-2.5-flash' };

  // 400 API key not valid
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  };
  await assert.rejects(
    () => callWithFallback(ai, 'gemini-2.5-flash', callGemini, [], [], 'Test bad key'),
    err => {
      assert.equal(err.aiCode, 'bad_key');
      assert.equal(err.retryable, false);
      assert.match(err.message, /API key AI không đúng/i);
      return true;
    }
  );
  assert.equal(calls, 1, 'Key sai không được retry');

  // 400 Request payload size exceeds the limit
  calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      error: { message: 'Request payload size exceeds the limit: 20971520 bytes.' }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  };
  await assert.rejects(
    () => callWithFallback(ai, 'gemini-2.5-flash', callGemini, [], [], 'Test too large'),
    err => {
      assert.equal(err.aiCode, 'too_large');
      assert.equal(err.retryable, false);
      assert.match(err.message, /Tệp quá lớn/i);
      return true;
    }
  );
  assert.equal(calls, 1);

  // 400 Bad request chung
  calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      error: { message: 'Unsupported MIME type' }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  };
  await assert.rejects(
    () => callWithFallback(ai, 'gemini-2.5-flash', callGemini, [], [], 'Test 400'),
    err => {
      assert.equal(err.aiCode, 'bad_request');
      assert.equal(err.retryable, false);
      assert.match(err.message, /AI từ chối yêu cầu.*Unsupported MIME type/);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test('GĐ18B.4: PDF lớn (>10 trang) được chia nhỏ ≤10 trang/lần, cập nhật % + trang đang đọc trong HubJobManager', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gd18b4-pdf-'));
  const origFetch = global.fetch;
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  t.after(async () => {
    global.fetch = origFetch;
    if (origKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origKey;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const mem = new Map();
  const store = {
    async get(k) { return mem.get(k) || null; },
    async put(k, v) { mem.set(k, v); }
  };
  const dataKey = 'user-test';
  const hubStore = new ProjectHubStore(store, dataKey);
  const assets = new ProjectAssets(dir, dataKey);

  const pdf15 = await makeMultiPagePdf(15);
  const saved = await assets.save(pdf15, '.pdf', 'application/pdf');
  await hubStore.saveProject('proj-1', rec => {
    rec.documents = [{
      id: 'doc-15p',
      type: 'drawing',
      name: 'HSKT-15-trang.pdf',
      mime: 'application/pdf',
      size: pdf15.length,
      assetKey: saved.assetKey,
      pages: 15
    }];
    return rec;
  });

  const promptsSeen = [];
  global.fetch = async (url, opts = {}) => {
    const s = String(url);
    if (s.includes(':generateContent')) {
      const body = JSON.parse(opts.body || '{}');
      const textPart = body.contents?.[0]?.parts?.find(p => p.text)?.text || '';
      promptsSeen.push(textPart);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                pages: [{ pageNumber: 1, drawingType: 'mat_bang', room: 'Phòng khách', title: 'Mặt bằng', items: ['Sofa'] }]
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
  };

  const stepsSeen = [];
  const pagesSeen = [];
  const job = globalJobManager.createJob({
    projectId: 'proj-1',
    projectName: 'Cô TẠ THỊ YẾN - Ch VÂN',
    dataKey,
    kind: 'review',
    runFn: (j, signal) => executeProjectReview({
      projectId: 'proj-1',
      hubStore,
      assets,
      store,
      dataKey,
      onProgress: ({ step, percent, page }) => {
        j.step = step;
        j.progress = percent;
        if (page) { j.page = page; pagesSeen.push(page); }
        stepsSeen.push({ step, percent });
      },
      signal
    })
  });

  while (job.status === 'running') {
    await new Promise(r => setTimeout(r, 20));
  }
  assert.equal(job.status, 'done');
  assert.equal(promptsSeen.length, 2, 'PDF 15 trang phải chia thành 2 lượt (1–10 và 11–15)');
  assert.ok(pagesSeen.some(p => p.from === 1 && p.to === 10 && p.total === 15));
  assert.ok(pagesSeen.some(p => p.from === 11 && p.to === 15 && p.total === 15));
  assert.ok(stepsSeen.some(s => /trang 1–10\/15/.test(s.step)));
  assert.ok(stepsSeen.some(s => /trang 11–15\/15/.test(s.step)));

  const updated = await hubStore.getProject('proj-1');
  const extracted = updated.documents[0].extractedPages;
  assert.equal(extracted.length, 2);
  assert.deepEqual(extracted.map(p => p.pageNumber), [1, 11], 'Trang ở lượt 2 phải được quy đổi về số trang gốc (11)');
});

test('GĐ18B.4: Nút Kiểm tra kết nối AI (/api/ai/test) trả về model và thời gian phản hồi', async t => {
  const origFetch = global.fetch;
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  t.after(() => {
    global.fetch = origFetch;
    if (origKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origKey;
  });

  global.fetch = async url => {
    if (String(url).includes(':generateContent')) {
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"ok":true,"reply":"Xin chào GD HOME"}' }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const info = await testAiConnection({ provider: 'gemini', key: 'test-gemini-key', model: '' });
  assert.equal(info.ok, true);
  assert.equal(info.model, 'gemini-2.5-flash');
  assert.equal(typeof info.ms, 'number');

  // Kiểm tra qua route /api/ai/test
  let statusOut = 0;
  let jsonOut = null;
  const handled = await handleIntegrations(
    { method: 'POST', url: '/api/ai/test' },
    {},
    '/api/ai/test',
    {
      sendJson: (_res, st, body) => { statusOut = st; jsonOut = body; },
      readJsonBody: async () => ({}),
      dataKey: 'u1',
      store: { async get() { return null; }, async put() {} }
    }
  );
  assert.equal(handled, true);
  assert.equal(statusOut, 200);
  assert.equal(jsonOut.ok, true);
  assert.equal(jsonOut.model, 'gemini-2.5-flash');
});
