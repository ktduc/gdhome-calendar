const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const {
  resolveStorageConfig,
  getStorageKind,
  isConfigured,
  canonicalUri,
  signedUrl,
  putObject,
  getObject,
  headObject,
  deleteObject,
  hash,
  mac
} = require('../object-storage');
const { MaterialAssets } = require('../material-assets');
const { ProjectAssets } = require('../project-hub');

test('Object Storage: Cấu hình Backblaze B2 & Cloudflare R2 và chuẩn hoá URI', async t => {
  const origEnv = { ...process.env };
  try {
    // 1. Kiểm tra fallback khi chưa có biến môi trường
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_REGION;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    delete process.env.B2_ENDPOINT;
    delete process.env.B2_REGION;
    delete process.env.B2_KEY_ID;
    delete process.env.B2_APP_KEY;
    delete process.env.B2_BUCKET;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;

    assert.equal(getStorageKind(), 'temp');
    assert.equal(isConfigured(), false);

    // 2. Kiểm tra Backblaze B2 bộ tên S3_*
    process.env.S3_ENDPOINT = 'https://s3.us-west-004.backblazeb2.com';
    process.env.S3_ACCESS_KEY_ID = '004abc123';
    process.env.S3_SECRET_ACCESS_KEY = 'K004secretKey';
    process.env.S3_BUCKET = 'gdhome-files';
    delete process.env.S3_REGION; // kiểm tra tự động nhận dạng region từ endpoint

    const b2Config = resolveStorageConfig();
    assert.equal(b2Config.kind, 'b2');
    assert.equal(b2Config.host, 's3.us-west-004.backblazeb2.com');
    assert.equal(b2Config.region, 'us-west-004');
    assert.equal(b2Config.bucket, 'gdhome-files');
    assert.equal(getStorageKind(), 'b2');
    assert.equal(isConfigured(), true);

    // 2b. Kiểm tra Backblaze B2 bộ tên B2_* (B2_ENDPOINT không có https://, B2_KEY_ID, B2_APP_KEY, B2_BUCKET)
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;

    process.env.B2_ENDPOINT = 's3.us-west-004.backblazeb2.com';
    process.env.B2_KEY_ID = '004b2keyid';
    process.env.B2_APP_KEY = 'K004b2appkey';
    process.env.B2_BUCKET = 'gdhome-files';
    delete process.env.B2_REGION;

    const b2AltConfig = resolveStorageConfig();
    assert.equal(b2AltConfig.kind, 'b2');
    assert.equal(b2AltConfig.endpoint, 'https://s3.us-west-004.backblazeb2.com');
    assert.equal(b2AltConfig.host, 's3.us-west-004.backblazeb2.com');
    assert.equal(b2AltConfig.region, 'us-west-004');
    assert.equal(b2AltConfig.accessKey, '004b2keyid');
    assert.equal(b2AltConfig.secretKey, 'K004b2appkey');
    assert.equal(b2AltConfig.bucket, 'gdhome-files');
    assert.equal(getStorageKind(), 'b2');
    assert.equal(isConfigured(), true);

    // 3. Kiểm tra tương thích Cloudflare R2 cũ khi không có S3_* và B2_*
    delete process.env.B2_ENDPOINT;
    delete process.env.B2_KEY_ID;
    delete process.env.B2_APP_KEY;
    delete process.env.B2_BUCKET;
    process.env.R2_ACCOUNT_ID = 'acc987';
    process.env.R2_ACCESS_KEY_ID = 'r2key';
    process.env.R2_SECRET_ACCESS_KEY = 'r2secret';
    process.env.R2_BUCKET = 'gdhome-r2';

    const r2Config = resolveStorageConfig();
    assert.equal(r2Config.kind, 'r2');
    assert.equal(r2Config.host, 'acc987.r2.cloudflarestorage.com');
    assert.equal(r2Config.region, 'auto');
    assert.equal(r2Config.bucket, 'gdhome-r2');
    assert.equal(getStorageKind(), 'r2');
    assert.equal(isConfigured(), true);

    // 4. Kiểm tra thứ tự ưu tiên: S3_* > B2_* > R2_*
    process.env.B2_ENDPOINT = 's3.us-west-004.backblazeb2.com';
    process.env.B2_KEY_ID = '004b2keyid';
    process.env.B2_APP_KEY = 'K004b2appkey';
    process.env.B2_BUCKET = 'gdhome-b2';
    // B2_* có quyền ưu tiên hơn R2_*
    assert.equal(resolveStorageConfig().accessKey, '004b2keyid');

    process.env.S3_ENDPOINT = 'https://s3.us-west-004.backblazeb2.com';
    process.env.S3_ACCESS_KEY_ID = '004s3key';
    process.env.S3_SECRET_ACCESS_KEY = 'K004s3secret';
    process.env.S3_BUCKET = 'gdhome-s3';
    // S3_* có quyền ưu tiên hơn B2_*
    assert.equal(resolveStorageConfig().accessKey, '004s3key');

    // 5. Kiểm tra hàm chuẩn hoá path-style URI
    const uri1 = canonicalUri('gdhome-files', 'project-files/a1b2/ban-ve.pdf');
    assert.equal(uri1, '/gdhome-files/project-files/a1b2/ban-ve.pdf');

    const uri2 = canonicalUri('gdhome-files', 'assets/photo with space & tiếng việt.webp');
    assert.equal(uri2, '/gdhome-files/assets/photo%20with%20space%20%26%20ti%E1%BA%BFng%20vi%E1%BB%87t.webp');
  } finally {
    process.env = origEnv;
  }
});

test('Object Storage: Kiểm tra chữ ký AWS SigV4 theo chuẩn S3 Backblaze B2', async t => {
  // Cấu hình cố định để kiểm tra tính toán xác định (deterministic)
  const fixedConfig = {
    kind: 'b2',
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    host: 's3.us-west-004.backblazeb2.com',
    region: 'us-west-004',
    accessKey: 'TEST_ACCESS_KEY',
    secretKey: 'TEST_SECRET_KEY',
    bucket: 'gdhome-files'
  };

  const fixedDate = new Date('2026-11-08T12:00:00.000Z');
  const stamp = '20261108T120000Z';
  const date = '20261108';
  const key = 'project-files/abc1234/drawing.pdf';

  const urlString = signedUrl('PUT', key, {
    config: fixedConfig,
    timestamp: fixedDate,
    expires: 300
  });

  const parsedUrl = new URL(urlString);
  assert.equal(parsedUrl.protocol, 'https:');
  assert.equal(parsedUrl.host, 's3.us-west-004.backblazeb2.com');
  assert.equal(parsedUrl.pathname, '/gdhome-files/project-files/abc1234/drawing.pdf');

  // Kiểm tra các tham số query AWS SigV4
  const query = parsedUrl.searchParams;
  assert.equal(query.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.equal(query.get('X-Amz-Credential'), 'TEST_ACCESS_KEY/20261108/us-west-004/s3/aws4_request');
  assert.equal(query.get('X-Amz-Date'), stamp);
  assert.equal(query.get('X-Amz-Expires'), '300');
  assert.equal(query.get('X-Amz-SignedHeaders'), 'host');

  const signature = query.get('X-Amz-Signature');
  assert.match(signature, /^[a-f0-9]{64}$/i);

  // Tính độc lập chữ ký mong đợi và so sánh
  const expectedScope = `${date}/us-west-004/s3/aws4_request`;
  const canonicalQuery = [
    'X-Amz-Algorithm=AWS4-HMAC-SHA256',
    `X-Amz-Credential=${encodeURIComponent(`TEST_ACCESS_KEY/${expectedScope}`)}`,
    `X-Amz-Date=${stamp}`,
    'X-Amz-Expires=300',
    'X-Amz-SignedHeaders=host'
  ].join('&');

  const canonicalRequest = [
    'PUT',
    '/gdhome-files/project-files/abc1234/drawing.pdf',
    canonicalQuery,
    'host:s3.us-west-004.backblazeb2.com\n',
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    expectedScope,
    hash(canonicalRequest)
  ].join('\n');

  const kDate = mac('AWS4TEST_SECRET_KEY', date);
  const kRegion = mac(kDate, 'us-west-004');
  const kService = mac(kRegion, 's3');
  const kSigning = mac(kService, 'aws4_request');
  const expectedSig = mac(kSigning, stringToSign).toString('hex');

  assert.equal(signature, expectedSig, 'Chữ ký SigV4 phải trùng khớp hoàn toàn với chuẩn AWS HMAC-SHA256');
});

test('Object Storage: Thao tác PUT / GET / HEAD / DELETE với mock fetch', async t => {
  const origFetch = global.fetch;
  const mockCalls = [];

  const mockConfig = {
    kind: 'b2',
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    host: 's3.us-west-004.backblazeb2.com',
    region: 'us-west-004',
    accessKey: 'TEST_ACCESS',
    secretKey: 'TEST_SECRET',
    bucket: 'gdhome-files'
  };

  global.fetch = async (url, opts = {}) => {
    mockCalls.push({ url, opts });
    const method = opts.method || 'GET';

    if (method === 'PUT') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'etag': '"123456"' })
      };
    }
    if (method === 'GET') {
      if (url.includes('missing-file')) {
        return { ok: false, status: 404, headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf', 'content-length': '11' }),
        arrayBuffer: async () => Buffer.from('mock-pdf-data')
      };
    }
    if (method === 'HEAD') {
      if (url.includes('missing-file')) {
        return { ok: false, status: 404, headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/webp', 'content-length': '1024' })
      };
    }
    if (method === 'DELETE') {
      return {
        ok: true,
        status: 204,
        headers: new Headers()
      };
    }
    return { ok: true, status: 200 };
  };

  try {
    const opts = { config: mockConfig };

    // 1. PUT
    const putRes = await putObject('project-files/test.pdf', Buffer.from('mock-pdf-data'), 'application/pdf', opts);
    assert.equal(putRes.key, 'project-files/test.pdf');
    assert.equal(mockCalls[0].opts.method, 'PUT');
    assert.equal(mockCalls[0].opts.headers['Content-Type'], 'application/pdf');

    // 2. GET
    const getRes = await getObject('project-files/test.pdf', opts);
    assert.equal(getRes.buf.toString(), 'mock-pdf-data');
    assert.equal(getRes.mime, 'application/pdf');

    // 3. GET 404
    await assert.rejects(
      async () => getObject('project-files/missing-file.pdf', opts),
      err => err.status === 404
    );

    // 4. HEAD
    const headOk = await headObject('project-files/test.webp', opts);
    assert.equal(headOk.exists, true);
    assert.equal(headOk.size, 1024);

    const headNotFound = await headObject('project-files/missing-file.webp', opts);
    assert.equal(headNotFound.exists, false);

    // 5. DELETE
    const delRes = await deleteObject('project-files/test.pdf', opts);
    assert.equal(delRes.ok, true);
  } finally {
    global.fetch = origFetch;
  }
});

test('Object Storage: /api/health trả objectStorage đúng chuẩn ("b2" | "r2" | "temp") và không lộ khoá', async t => {
  const origEnv = { ...process.env };
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdhome-storage-test-'));

  try {
    // 1. Chế độ B2
    process.env.DATA_DIR = tmpDir;
    process.env.S3_ENDPOINT = 'https://s3.us-west-004.backblazeb2.com';
    process.env.S3_REGION = 'us-west-004';
    process.env.S3_ACCESS_KEY_ID = 'B2_KEY_ID';
    process.env.S3_SECRET_ACCESS_KEY = 'B2_SUPER_SECRET';
    process.env.S3_BUCKET = 'gdhome-files';

    const { server, initStore } = require('../server');
    await initStore();

    const checkHealth = async () => {
      return new Promise((resolve, reject) => {
        const addr = server.address();
        http.get(`http://127.0.0.1:${addr.port}/api/health`, res => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
    };

    const checkConfig = async () => {
      return new Promise((resolve, reject) => {
        const addr = server.address();
        http.get(`http://127.0.0.1:${addr.port}/api/config`, res => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
    };

    // Khởi động server trên cổng ngẫu nhiên 0
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    const health1 = await checkHealth();
    assert.equal(health1.objectStorage, 'b2');
    const healthJsonStr = JSON.stringify(health1);
    assert.equal(healthJsonStr.includes('B2_SUPER_SECRET'), false, 'Không được làm lộ khoá bí mật');

    const config1 = await checkConfig();
    assert.equal(config1.objectStorage, 'b2');

    // 1b. Chế độ B2 với bộ biến B2_*
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    process.env.B2_ENDPOINT = 's3.us-west-004.backblazeb2.com';
    process.env.B2_KEY_ID = 'B2_KEY_ID_VAL';
    process.env.B2_APP_KEY = 'B2_APP_KEY_SECRET';
    process.env.B2_BUCKET = 'gdhome-files';

    const health1b = await checkHealth();
    assert.equal(health1b.objectStorage, 'b2');
    assert.equal(JSON.stringify(health1b).includes('B2_APP_KEY_SECRET'), false, 'Không lộ B2_APP_KEY');

    // 2. Chế độ R2
    delete process.env.B2_ENDPOINT;
    delete process.env.B2_KEY_ID;
    delete process.env.B2_APP_KEY;
    delete process.env.B2_BUCKET;
    process.env.R2_ACCOUNT_ID = 'acc_test';
    process.env.R2_ACCESS_KEY_ID = 'r2_key';
    process.env.R2_SECRET_ACCESS_KEY = 'r2_secret';
    process.env.R2_BUCKET = 'bucket_test';

    const health2 = await checkHealth();
    assert.equal(health2.objectStorage, 'r2');

    // 3. Chế độ temp (không cấu hình)
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;

    const health3 = await checkHealth();
    assert.equal(health3.objectStorage, 'temp');

    await new Promise(resolve => server.close(resolve));
  } finally {
    process.env = origEnv;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('Object Storage: ProjectAssets và MaterialAssets dùng module chung, tắt cảnh báo Lưu tạm khi có B2', async t => {
  const origEnv = { ...process.env };
  const origFetch = global.fetch;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdhome-hub-assets-'));

  try {
    process.env.S3_ENDPOINT = 'https://s3.us-west-004.backblazeb2.com';
    process.env.S3_ACCESS_KEY_ID = 'B2_KEY_ID';
    process.env.S3_SECRET_ACCESS_KEY = 'B2_SECRET';
    process.env.S3_BUCKET = 'gdhome-files';

    let uploadedKey = null;
    const uploadedPaths = new Set();
    let puts = 0;
    global.fetch = async (url, opts = {}) => {
      if (opts.method === 'PUT') {
        uploadedKey = url;
        uploadedPaths.add(new URL(url).pathname);
        puts++;
        return { ok: true, status: 200, headers: new Headers() };
      }
      if (opts.method === 'HEAD') {
        const exists = uploadedPaths.has(new URL(url).pathname);
        return {ok:exists,status:exists ? 200 : 404,headers:new Headers()};
      }
      if (opts.method === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          arrayBuffer: async () => Buffer.from('file-content-from-b2')
        };
      }
      return { ok: true, status: 200 };
    };

    // 1. Kiểm tra ProjectAssets
    const pAssets = new ProjectAssets(tmpDir, 'account-test-key');
    assert.equal(pAssets.configured, true);
    assert.equal(pAssets.r2Configured, true);

    const saved = await pAssets.save(Buffer.from('test-doc-content'), '.pdf', 'application/pdf');
    assert.match(saved.assetKey, /^[a-f0-9]{64}\.pdf$/);
    assert.ok(uploadedKey.includes('s3.us-west-004.backblazeb2.com'));
    assert.ok(uploadedKey.includes('gdhome-files'));

    const read = await pAssets.read(saved.assetKey);
    assert.equal(read.buf.toString(), 'file-content-from-b2');

    // 2. Kiểm tra MaterialAssets với WebP
    // Tạo 1 WebP nhỏ hợp lệ
    const validWebp = Buffer.from(
      '52494646240000005745425056503820180000003001009d012a0a000a0001402200000000000000',
      'hex'
    );
    const mAssets = new MaterialAssets(tmpDir, 'account-test-key');
    assert.equal(mAssets.prefix, 'account-test-key/');

    const webpName = await mAssets.save(validWebp.toString('base64'));
    assert.match(webpName, /^[a-f0-9]{64}\.webp$/);
    const shared = pAssets.renderAssets;
    const before = puts;
    const [render,duplicate] = await Promise.all([pAssets.saveRender(validWebp),shared.saveBuffer(validWebp)]);
    assert.equal(render.assetKey,'render-'+duplicate.name);
    assert.equal(render.thumbAssetKey,render.assetKey);
    assert.equal(puts,before+1,'Hai trang lưu cùng một ảnh chỉ tạo một đối tượng B2');
    await pAssets.saveRender(validWebp);
    assert.equal(puts,before+1,'Ảnh đã có trên B2 không được ghi thêm phiên bản');
  } finally {
    global.fetch = origFetch;
    process.env = origEnv;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});
