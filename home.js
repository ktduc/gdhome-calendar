// Trang chủ GD HOME Tools: ảnh bìa (admin đổi), 2 hàng công cụ theo GDHomeShell.TOOL_ROWS, nền tự chọn (lưu trên máy)
(() => {
  const $ = s => document.querySelector(s), esc = GDHomeShell.escape;
  // Công cụ: 2 hàng, cùng thứ tự với menu GD HOME Tools
  $('#home-tools').innerHTML = GDHomeShell.TOOL_ROWS.map(row => '<div class="home-row">' + row.map(([href, label, glyph, note]) =>
    '<a class="home-tile" href="' + href + '"><span class="home-tile-icon">' + glyph + '</span><strong>' + esc(label) + '</strong><small>' + esc(note) + '</small></a>').join('') + '</div>').join('');

  // Ảnh bìa
  const cover = $('#home-cover'), actions = cover.querySelector('.home-cover-actions');
  let state = {cover: '', position: 50};
  function paintCover() {
    cover.classList.toggle('has-image', !!state.cover);
    cover.style.backgroundImage = state.cover ? 'url("' + state.cover + '")' : '';
    cover.style.backgroundPosition = 'center ' + state.position + '%';
  }
  async function save(patch) {
    try { state = await GDHomeShell.api('/api/home', {method: 'POST', body: patch}); paintCover(); GDHomeShell.toast('Đã lưu ảnh bìa'); }
    catch (error) { GDHomeShell.toast(error.message); }
  }
  async function shrink(file) {
    const bitmap = await createImageBitmap(file), scale = Math.min(1, 2400 / bitmap.width);
    const canvas = Object.assign(document.createElement('canvas'), {width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale)});
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (let q = 0.85; q > 0.3; q -= 0.1) { const url = canvas.toDataURL('image/jpeg', q); if (url.length < 1_400_000) return url; }
    throw new Error('Ảnh quá lớn, chọn ảnh khác.');
  }
  GDHomeShell.api('/api/home').then(data => {
    state = data; paintCover();
    actions.hidden = !data.canEdit;
  }).catch(() => {});
  actions.onclick = async event => {
    if (event.target.closest('[data-cover-clear]')) return save({cover: ''});
    if (event.target.closest('[data-cover-pick]')) {
      const input = Object.assign(document.createElement('input'), {type: 'file', accept: 'image/*'});
      input.onchange = async () => { try { if (input.files[0]) await save({cover: await shrink(input.files[0])}); } catch (error) { GDHomeShell.toast(error.message); } };
      input.click();
    }
    if (event.target.closest('[data-cover-move]')) {
      cover.classList.add('is-moving');
      GDHomeShell.toast('Kéo ảnh lên / xuống, thả chuột để lưu');
    }
  };
  // Căn ảnh: kéo dọc trên ảnh bìa
  cover.addEventListener('pointerdown', event => {
    if (!cover.classList.contains('is-moving') || event.target.closest('button')) return;
    const startY = event.clientY, start = state.position;
    cover.setPointerCapture(event.pointerId);
    const move = e => { state.position = Math.min(100, Math.max(0, start - (e.clientY - startY) / 3)); paintCover(); };
    cover.addEventListener('pointermove', move);
    cover.addEventListener('pointerup', () => {
      cover.removeEventListener('pointermove', move);
      cover.classList.remove('is-moving');
      save({position: Math.round(state.position)});
    }, {once: true});
  });

  // Đăng nhập Gmail từ trang chủ (nút Đăng nhập ở tài khoản gọi window.signIn)
  window.signIn = async () => {
    const config = await fetch('/api/config').then(r => r.json());
    if (config.authMode !== 'google') return;
    const box = $('#login');
    box.className = 'login-overlay active';
    box.innerHTML = GDHomeShell.loginCard('GD HOME Tools');
    box.querySelector('.login-guest-btn').onclick = () => { localStorage.setItem('gdhome_guest', '1'); box.className = ''; box.replaceChildren(); };
    const message = box.querySelector('.login-msg');
    await GDHomeShell.googleSignIn({clientId: config.googleClientId, container: box.querySelector('.google-signin-btn'), onCredential: async ({credential}) => {
      try {
        message.textContent = 'Đang đăng nhập…';
        const {token, user} = await GDHomeShell.api('/api/auth/google', {method: 'POST', body: {credential}});
        localStorage.setItem('gdhome_session', JSON.stringify({token, user}));
        localStorage.removeItem('gdhome_guest');
        location.reload();
      } catch (error) { message.textContent = error.message; }
    }}).catch(error => { message.textContent = error.message; });
  };
  let session; try { session = JSON.parse(localStorage.getItem('gdhome_session')); } catch {}
  if (!session?.token && localStorage.getItem('gdhome_guest') !== '1') window.signIn().catch(() => {});
})();
