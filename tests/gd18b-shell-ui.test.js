const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('GĐ18B.1: shell.css định nghĩa đầy đủ biến màu, viền, bo góc và kích thước nút 32px', () => {
  const css = fs.readFileSync(path.join(__dirname, '../shell.css'), 'utf8');

  // Kiểm tra bộ biến màu chung
  assert.match(css, /--gd-btn-height:\s*32px/, 'Phải có biến --gd-btn-height: 32px');
  assert.match(css, /--gd-overlay-bg:\s*#f4f1ec/, 'Phải có biến nền be ghi nhạt #f4f1ec');
  assert.match(css, /--gd-overlay-border:\s*#d8d2c8/, 'Phải có biến viền #d8d2c8');
  assert.match(css, /--gd-overlay-radius:\s*10px/, 'Phải có biến bo góc 10px');
  assert.match(css, /--gd-overlay-shadow:\s*0 10px 28px rgba\(15, 23, 42, 0\.16\)/, 'Phải có biến đổ bóng overlay');

  // Kiểm tra lớp hộp thoại & menu & toast dùng chung màu & bo góc
  assert.ok(css.includes('dialog:not(.shell-lightbox)'), 'Có quy tắc cho dialog');
  assert.ok(css.includes('.hdr-dropdown-menu'), 'Có quy tắc cho dropdown menu');
  assert.ok(css.includes('.toast-notification'), 'Có quy tắc cho toast');
  assert.ok(css.includes('.ai-bg-panel'), 'Có quy tắc cho AI panel');
  assert.ok(css.includes('.shell-sidebar-toggle'), 'Có quy tắc cho nút ẩn/hiện thanh bên trái');
  assert.ok(css.includes('is-sidebar-collapsed'), 'Có quy tắc cho trạng thái thu gọn thanh bên trái');
});

test('GĐ18B.1: Header 4 trang (Lịch, Chốt mã, Quản lý dự án, Tools) đồng bộ cấu trúc', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const chotMaHtml = fs.readFileSync(path.join(__dirname, '../chot-ma.html'), 'utf8');
  const duAnHtml = fs.readFileSync(path.join(__dirname, '../du-an.html'), 'utf8');
  const toolsHtml = fs.readFileSync(path.join(__dirname, '../tools.html'), 'utf8');

  const pages = [
    { name: 'index.html (Lịch)', html: indexHtml },
    { name: 'chot-ma.html (Chốt mã)', html: chotMaHtml },
    { name: 'du-an.html (Quản lý dự án)', html: duAnHtml },
    { name: 'tools.html (Tools)', html: toolsHtml }
  ];

  for (const page of pages) {
    assert.ok(page.html.includes('class="app-header'), `${page.name} phải có class app-header`);
    assert.ok(page.html.includes('class="header-left"'), `${page.name} phải có header-left`);
    assert.ok(page.html.includes('class="header-right"'), `${page.name} phải có header-right`);
    assert.ok(page.html.includes('data-shell-menu'), `${page.name} phải có data-shell-menu`);
    assert.ok(page.html.includes('class="app-logo"'), `${page.name} phải có app-logo`);
    assert.ok(page.html.includes('class="shell-account"'), `${page.name} phải có shell-account`);
    assert.ok(
      page.html.includes('id="identity"') || page.html.includes('id="btn-user-account"'),
      `${page.name} phải có phần tử nhận diện tài khoản (identity/btn-user-account)`
    );
  }
});

test('GĐ18B.1: shell.js hỗ trợ toggleSidebar và lưu trạng thái per-page', () => {
  const js = fs.readFileSync(path.join(__dirname, '../shell.js'), 'utf8');
  assert.ok(js.includes('function initSidebarToggle'), 'Phải có hàm initSidebarToggle');
  assert.ok(js.includes('function toggleSidebar'), 'Phải có hàm toggleSidebar');
  assert.ok(js.includes('gdhome_sidebar_hidden:'), 'Phải lưu localStorage theo key per-page gdhome_sidebar_hidden:');
  assert.ok(js.includes('is-sidebar-collapsed'), 'Phải toggle class is-sidebar-collapsed trên body');
});
