/* Shared browser UI for GD HOME Tools. Load before the page script. */
window.GDHomeShell = (() => {
  const toastTimers = new WeakMap();
  let googleLoader;

  async function googleSignIn({clientId,container,onCredential,autoSelect = false}) {
    if (!window.google?.accounts?.id) {
      googleLoader ||= new Promise((resolve,reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => { googleLoader = null; script.remove(); reject(new Error('Không tải được đăng nhập Google.')); };
        document.head.append(script);
      });
      await googleLoader;
    }
    if (!container.isConnected) return;
    const google = window.google.accounts.id;
    google.initialize({client_id:clientId,callback:onCredential,auto_select:autoSelect,cancel_on_tap_outside:false});
    container.replaceChildren();
    google.renderButton(container,{theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:'vi',width:280});
    if (autoSelect) google.prompt();
  }

  function loginCard(title) {
    return '<div class="login-card"><img src="gdhome-logo.png" class="login-logo" alt="GD HOME"><h2>' + escape(title) +
      '</h2><p>Đăng nhập bằng Gmail để xem và lưu dự án của bạn trên mọi máy.</p>' +
      '<div class="google-signin-btn"></div><div class="login-guest-divider"><span>hoặc</span></div>' +
      '<button type="button" class="btn btn-outline login-guest-btn">👤 Dùng thử – chế độ khách (không cần đăng nhập)</button>' +
      '<div class="login-msg" role="status"></div></div>';
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const icon = (name,fallback = '') => '<i data-lucide="' + escape(name) + '" aria-hidden="true">' + escape(fallback) + '</i>';
  const icons = () => window.lucide?.createIcons();

  function menu(element) {
    if (!element) return;
    const links = [['/','Lập tiến độ'],['/chot-ma','Chốt mã vật liệu'],['/du-an','Quản lý dự án'],['/tools','Trang chủ']];
    element.onkeydown = event => {
      if (event.key === 'Escape' && element.open) { element.open = false; element.querySelector('summary').focus(); event.stopPropagation(); }
    };
    element.innerHTML = '<summary>GD HOME Tools</summary><nav aria-label="GD HOME Tools">' +
      links.map(([href,label]) => '<a href="' + href + '">' + label + '</a>').join('') +
      (element.dataset.shellMenu === 'public' ? '' : '<button type="button" data-open-library>📚 Dữ liệu dùng chung</button>' +
        '<button type="button" data-open-connections>⚙ Kết nối</button>') + '</nav>';
  }

  function dropdown(command,label,glyph,body,variant = 'outline') {
    return '<details class="hdr-dropdown"><summary class="btn btn-' + escape(variant) + '" data-header-command="' +
      escape(command) + '">' + icon(glyph) + '<span class="btn-label">' + escape(label) +
      '</span><span class="hdr-caret">▾</span></summary><div class="hdr-dropdown-menu">' + body + '</div></details>';
  }

  function closeMenus() {
    const open = [...document.querySelectorAll('.hdr-dropdown.open, .hdr-dropdown[open], .gd-tools-menu[open]')]
      .filter(element => element.getClientRects().length);
    const top = open.findLast(element => element.contains(document.activeElement)) || open.at(-1);
    if (!top) return false;
    top.classList.remove('open');
    top.removeAttribute('open');
    top.querySelector('summary, .hdr-dropdown-toggle')?.focus({preventScroll:true});
    return true;
  }

  function toast(message,element) {
    if (!element) {
      element = document.querySelector('[data-shell-toast]') || document.createElement('div');
      element.dataset.shellToast = '';
    }
    element.classList.add('toast-notification');
    element.setAttribute('role','status');
    const layer = [...document.querySelectorAll('dialog[open]')].at(-1) || document.body;
    layer.append(element);
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimers.get(element));
    toastTimers.set(element,setTimeout(() => element.classList.remove('show'),3200));
  }

  const statuses = {
    saved:['✓ Đã lưu','saved','Dữ liệu đã được lưu lên server'],
    connecting:['Đang kết nối máy chủ…','offline','Hiển thị bản lưu gần nhất trên máy. Bấm để thử kết nối lại.'],
    pending:['● Chưa lưu…','pending','Đang chờ gửi thay đổi lên server'],
    saving:['⟳ Đang lưu…','saving','Đang gửi thay đổi lên server'],
    error:['⚠ Lỗi lưu server','error','Không gửi được lên server. Bấm để thử lại ngay.'],
    offline:['💾 Chỉ lưu trên máy này','offline','Dữ liệu chỉ lưu trong trình duyệt này'],
    guest:['💾 Chế độ khách – chỉ lưu trên máy này','offline','Dữ liệu khách chỉ lưu trong trình duyệt này'],
    conflict:['⚠ Xung đột dữ liệu','error','Dữ liệu trên server đã bị sửa từ máy khác']
  };

  function saveStatus(element,state,detail,shortLabel) {
    if (!element) return;
    const [label,style,title] = statuses[state] || statuses.saved;
    element.textContent = shortLabel || label;
    element.classList.add('save-status');
    for (const name of ['saved','pending','saving','error','offline']) element.classList.toggle('is-' + name,name === style);
    element.title = detail || title;
    element.dataset.saveState = state;
  }

  function dialog(element,markup) {
    element.classList.add('shell-dialog');
    element.innerHTML = '<form method="dialog"><button class="close-dialog" aria-label="Đóng">×</button></form>' + markup;
    element.showModal();
    return element;
  }

  function aiNotice(id,{state,body,label,onAction,onClose}) {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = id;
      panel.setAttribute('aria-live','polite');
      document.body.append(panel);
    }
    panel.className = 'ai-bg-panel is-' + state;
    panel.innerHTML = '<div class="ai-bg-icon" aria-hidden="true">' +
      (state === 'running' ? '<span class="ai-spinner"></span>' : state === 'done' ? '✅' : '⚠') +
      '</div><div class="ai-bg-body"><div>' + body + '</div></div><button type="button" class="ai-bg-close" aria-label="Ẩn">×</button>';
    panel.querySelector('.ai-bg-close').onclick = () => { panel.style.display = 'none'; onClose?.(); };
    if (label) {
      const button = document.createElement('button');
      button.className = 'btn btn-primary btn-sm';
      button.textContent = label;
      button.onclick = onAction;
      panel.querySelector('.ai-bg-body').append(button);
    }
    panel.style.display = 'flex';
    return panel;
  }

  function lightbox({title,count,render,crop,remove,onClose,onError,extraClass = '',initialIndex = 0,cropLabel = 'Cắt ảnh'}) {
    if (!count()) return;
    const element = document.createElement('dialog');
    element.className = 'shell-dialog shell-lightbox ' + extraClass;
    element.setAttribute('aria-label',title);
    element.innerHTML = '<h2>' + escape(title) + '</h2><button class="lightbox-close" aria-label="Đóng" autofocus>×</button>' +
      '<div class="lightbox-stage"><button data-lightbox="prev" aria-label="Ảnh trước">←</button>' +
      '<figure></figure><button data-lightbox="next" aria-label="Ảnh tiếp theo">→</button></div>' +
      '<div class="lightbox-actions"><output aria-live="polite"></output>' +
      (crop ? '<button data-lightbox="crop">' + escape(cropLabel) + '</button>' : '') +
      (remove ? '<button data-lightbox="remove">Xoá ảnh</button>' : '') + '</div>';
    const figure = element.querySelector('figure');
    let index = Math.min(count()-1,Math.max(0,initialIndex));
    function show() {
      render(index,figure);
      element.querySelector('output').value = (index+1) + ' / ' + count();
      element.querySelectorAll('[data-lightbox="prev"],[data-lightbox="next"]').forEach(button => {
        button.disabled = count() < 2;
      });
    }
    function move(step) {
      if (count() < 2) return;
      index = (index+step+count()) % count();
      show();
    }
    element.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    };
    element.onclick = async event => {
      if (event.target === element || event.target.closest('.lightbox-close')) return element.close();
      const command = event.target.closest('[data-lightbox]')?.dataset.lightbox;
      if (command === 'prev' || command === 'next') move(command === 'prev' ? -1 : 1);
      if (command === 'crop') {
        try { await crop(index,element,show); } catch (error) { onError?.(error); }
      }
      if (command === 'remove' && remove(index)) {
        if (!count()) return element.close();
        index = Math.min(index,count()-1);
        show();
      }
    };
    element.onclose = () => { element.remove(); onClose?.(); };
    show();
    document.body.append(element);
    element.showModal();
    return element;
  }

  // ---------------------------------------------------------------------------
  // B3: Theo dõi Background Job AI ở mọi trang và báo tiến trình qua aiNotice
  // ---------------------------------------------------------------------------
  let hubJobPollTimer = null;
  function getShellAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      let token = localStorage.getItem('gdhome_token');
      if (!token) {
        const sess = JSON.parse(localStorage.getItem('gdhome_session'));
        token = sess?.token;
      }
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const appKey = localStorage.getItem('gdhome_app_key');
      if (appKey) headers['x-app-key'] = appKey;
    } catch {}
    return headers;
  }

  async function checkHubActiveJob() {
    try {
      const res = await fetch('/api/project-hub/jobs/active', {
        headers: getShellAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      const job = data.job;
      const noticeId = 'shell-hub-active-job';

      if (!job) {
        if (hubJobPollTimer) {
          clearInterval(hubJobPollTimer);
          hubJobPollTimer = null;
        }
        return;
      }

      if (job.status === 'running') {
        aiNotice(noticeId, {
          state: 'running',
          body: `<strong>${escape(job.projectName || 'Dự án')}</strong>: ${escape(job.step || 'Đang xử lý...')} (${job.progress || 0}%)`,
          label: 'Huỷ',
          onAction: async () => {
            if (!confirm('Bạn muốn huỷ tiến trình phân tích AI đang chạy?')) return;
            await fetch('/api/project-hub/jobs/cancel', {
              method: 'POST',
              headers: getShellAuthHeaders(),
              body: JSON.stringify({ jobId: job.id })
            });
            const p = document.getElementById(noticeId);
            if (p) p.style.display = 'none';
          }
        });
        if (!hubJobPollTimer) {
          hubJobPollTimer = setInterval(checkHubActiveJob, 2500);
        }
      } else if (job.status === 'done') {
        if (hubJobPollTimer) {
          clearInterval(hubJobPollTimer);
          hubJobPollTimer = null;
        }
        // Chỉ hiện nếu vừa xong trong vòng 2 phút
        const finishedMs = job.finishedAt ? Date.now() - new Date(job.finishedAt).getTime() : 0;
        if (finishedMs < 120000) {
          aiNotice(noticeId, {
            state: 'done',
            body: `<strong>${escape(job.projectName || 'Dự án')}</strong>: AI đã hoàn thành soát bản vẽ & tự động tạo đề xuất!`,
            label: 'Xem kết quả',
            onAction: () => {
              window.location.href = `/du-an?project=${encodeURIComponent(job.projectId)}`;
            }
          });
        }
      } else if (job.status === 'error') {
        if (hubJobPollTimer) {
          clearInterval(hubJobPollTimer);
          hubJobPollTimer = null;
        }
        const finishedMs = job.finishedAt ? Date.now() - new Date(job.finishedAt).getTime() : 0;
        if (finishedMs < 60000) {
          aiNotice(noticeId, {
            state: 'error',
            body: `<strong>${escape(job.projectName || 'Dự án')}</strong>: ${escape(job.error || 'Lỗi khi chạy AI.')}`,
            label: 'Đóng',
            onAction: () => {
              const p = document.getElementById(noticeId);
              if (p) p.style.display = 'none';
            }
          });
        }
      }
    } catch {}
  }

  function initHubJobTracker() {
    setTimeout(checkHubActiveJob, 1000);
  }

  document.querySelectorAll('[data-shell-menu]').forEach(menu);

  // Mọi menu thả xuống (File ▾, GD HOME Tools, Copy ảnh ▾…) tự đóng khi bấm ra ngoài hoặc nhấn Esc.
  const popupSelector = 'details.hdr-dropdown[open],details.gd-tools-menu[open],details.export-print-columns[open],details[data-popup][open],.hdr-dropdown.open,[data-popup-open]';
  function closeOutside(target) {
    let closed = false;
    document.querySelectorAll(popupSelector).forEach(element => {
      if (element.contains(target)) return;
      if (target?.closest?.('dialog[open]') && !element.closest('dialog')) return;
      element.removeAttribute('open');
      element.classList.remove('open');
      element.removeAttribute('data-popup-open');
      closed = true;
    });
    return closed;
  }
  // Đóng khi bấm (click) chứ không phải lúc nhấn chuột xuống, để bố cục không dịch chuyển giữa chừng làm trượt cú bấm.
  document.addEventListener('click',event => closeOutside(event.target),true);
  // Rời menu bằng phím Tab cũng đóng; chuột thì đã xử lý ở sự kiện click.
  let pointerFocus = false;
  document.addEventListener('pointerdown',() => { pointerFocus = true; setTimeout(() => { pointerFocus = false; },0); },true);
  document.addEventListener('keydown',event => { if (event.key === 'Tab') pointerFocus = false; },true);
  document.addEventListener('focusin',event => {
    if (!pointerFocus && event.target !== document.body && event.target.ownerDocument?.hasFocus()) {
      if (event.target.matches?.(':focus-visible')) closeOutside(event.target);
    }
  });
  document.addEventListener('keydown',event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (closeMenus()) { event.preventDefault(); event.stopPropagation(); }
  });
  // Bấm vùng tối ngoài hộp thoại thì đóng (hộp có thao tác dở dang đặt data-no-backdrop-close).
  let backdropDown = null;
  document.addEventListener('pointerdown',event => {
    const dialog = event.target;
    backdropDown = dialog?.tagName === 'DIALOG' && dialog.open && !dialog.matches('[data-no-backdrop-close],.crop-dialog') ? dialog : null;
  },true);
  document.addEventListener('click',event => {
    const dialog = event.target;
    if (dialog !== backdropDown || dialog.tagName !== 'DIALOG' || !dialog.open) return;
    backdropDown = null;
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dialog.close();
  });
  document.addEventListener('click',event => {
    const button = event.target.closest?.('[data-open-library]');
    if (!button) return;
    button.closest('details')?.removeAttribute('open');
    if (window.GDHomeAssets) window.GDHomeAssets.openLibrary();
    else location.href = '/tools#library';
  });
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initHubJobTracker);
    } else {
      initHubJobTracker();
    }
  }

  return { escape,icon,icons,googleSignIn,loginCard,menu,dropdown,closeMenus,toast,saveStatus,dialog,aiNotice,lightbox,initHubJobTracker,checkHubActiveJob };
})();
