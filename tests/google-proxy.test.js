'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { proxyDownloadImage, checkSsrfUrl, isPrivateIp } = require('../google-search');

test('Google Proxy: Chặn SSRF với IP nội bộ và localhost', async () => {
  // Test isPrivateIp directly
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.1.2.3'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('192.168.1.100'), true);
  assert.equal(isPrivateIp('172.20.0.1'), true);
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('142.250.190.46'), false);

  // Test URL checks
  assert.throws(() => checkSsrfUrl('ftp://example.com/img.png'), /Chỉ hỗ trợ giao thức HTTP và HTTPS/);
  assert.throws(() => checkSsrfUrl('http://localhost/secret.png'), /bị chặn/);
  assert.throws(() => checkSsrfUrl('http://my-service.local/image.jpg'), /bị chặn/);
  assert.throws(() => checkSsrfUrl('http://127.0.0.1:8080/image.jpg'), /bị chặn/);
  assert.throws(() => checkSsrfUrl('http://10.0.0.5/photo.png'), /bị chặn/);
  assert.throws(() => checkSsrfUrl('http://169.254.169.254/latest/meta-data'), /bị chặn/);
  assert.throws(() => checkSsrfUrl('http://192.168.0.1/admin.png'), /bị chặn/);

  // Test proxyDownloadImage blocking localhost with mock dns
  await assert.rejects(
    async () => proxyDownloadImage('http://localhost:3000/test.png'),
    /bị chặn/
  );
  await assert.rejects(
    async () => proxyDownloadImage('http://10.0.0.1/test.png'),
    /bị chặn/
  );
  await assert.rejects(
    async () => proxyDownloadImage('http://169.254.169.254/test.png'),
    /bị chặn/
  );

  // Test DNS lookup resolving to private IP
  const fakeDnsResolver = async () => [{ address: '10.20.30.40', family: 4 }];
  await assert.rejects(
    async () => proxyDownloadImage('https://evil-domain.com/photo.png', { dnsResolver: fakeDnsResolver }),
    /bị chặn/
  );
});

test('Google Proxy: Chặn file quá lớn (> 8 MB) và sai Content-Type', async () => {
  const fakePublicDns = async () => [{ address: '93.184.216.34', family: 4 }];

  // 1. Sai content-type (vd text/html)
  const mockFetchHtml = async () => ({
    ok: true,
    status: 200,
    headers: new Map([
      ['content-type', 'text/html; charset=utf-8'],
      ['content-length', '1024']
    ]),
    arrayBuffer: async () => new Uint8Array(1024).buffer
  });
  // Wrap headers in Map-like interface for get()
  const wrapFetch = fn => async (url, opts) => {
    const res = await fn(url, opts);
    return {
      ...res,
      headers: { get: k => res.headers.get(k.toLowerCase()) }
    };
  };

  await assert.rejects(
    async () => proxyDownloadImage('https://example.com/not-an-image', {
      dnsResolver: fakePublicDns,
      fetchFn: wrapFetch(mockFetchHtml)
    }),
    /không phải là ảnh hợp lệ/
  );

  // 2. File quá lớn theo header (> 8MB)
  const mockFetchOversizedHeader = async () => ({
    ok: true,
    status: 200,
    headers: new Map([
      ['content-type', 'image/jpeg'],
      ['content-length', String(9 * 1024 * 1024)]
    ]),
    arrayBuffer: async () => new Uint8Array(100).buffer
  });
  await assert.rejects(
    async () => proxyDownloadImage('https://example.com/huge.jpg', {
      dnsResolver: fakePublicDns,
      fetchFn: wrapFetch(mockFetchOversizedHeader)
    }),
    /vượt quá giới hạn 8 MB/
  );

  // 3. File quá lớn theo body thực tế (> 8MB)
  const mockFetchOversizedBody = async () => ({
    ok: true,
    status: 200,
    headers: new Map([
      ['content-type', 'image/png'],
      ['content-length', '100']
    ]),
    arrayBuffer: async () => new Uint8Array(8.5 * 1024 * 1024).buffer
  });
  await assert.rejects(
    async () => proxyDownloadImage('https://example.com/huge-body.png', {
      dnsResolver: fakePublicDns,
      fetchFn: wrapFetch(mockFetchOversizedBody)
    }),
    /vượt quá giới hạn 8 MB/
  );

  // 4. File ảnh hợp lệ <= 8MB
  const validBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const mockFetchValid = async () => ({
    ok: true,
    status: 200,
    headers: new Map([
      ['content-type', 'image/png'],
      ['content-length', String(validBuffer.length)]
    ]),
    arrayBuffer: async () => validBuffer.buffer
  });
  const result = await proxyDownloadImage('https://example.com/valid.png', {
    dnsResolver: fakePublicDns,
    fetchFn: wrapFetch(mockFetchValid)
  });
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.buffer.length, 8);
});
