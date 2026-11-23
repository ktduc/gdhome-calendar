const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Trang HTML: ?v= của JS/CSS tự theo nội dung file, bỏ số viết tay; file ngoài / không có thì giữ nguyên', () => {
  const { versionAssets } = require('../server');
  const out = versionAssets('<script src="/shell.js?v=gd25"></script><link href="tools.css" rel="stylesheet">' +
    '<script src="https://cdnjs.cloudflare.com/x.js"></script><script src="/khong-co.js?v=1"></script>');
  assert.match(out, /src="\/shell\.js\?v=[0-9a-f]{10}"/);
  assert.match(out, /href="tools\.css\?v=[0-9a-f]{10}"/);
  assert.ok(out.includes('https://cdnjs.cloudflare.com/x.js"'));
  assert.ok(out.includes('/khong-co.js?v=1"'));
});
