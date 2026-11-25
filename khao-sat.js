/* Trang khách điền khảo sát (/khao-sat/<token>): từng bước theo nhóm, câu hỏi đổi theo loại công trình, tự lưu nháp. */
(() => {
  const D = window.GDHomeSurveyData;
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const token = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const DRAFT = 'gdhome_survey_' + token;
  const state = {answers: {}, step: 0, done: false, submittedAt: 0, busy: false, error: ''};

  const store = {
    read() { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } },
    write() { try { localStorage.setItem(DRAFT, JSON.stringify({at: Date.now(), answers: state.answers})); } catch { /* không có localStorage thì bỏ qua */ } }
  };
  // /khao-sat/mau: phiếu mẫu cho GD HOME xem thử và góp ý R&D – không đọc/ghi server
  const preview = token === 'mau';
  // Phiếu mẫu: thêm thanh trên giống các trang công cụ (tài khoản, menu R&D) để góp ý trực tiếp
  if (preview) {
    document.body.classList.add('ks-preview');
    document.body.insertAdjacentHTML('afterbegin', '<header class="app-header"><div class="header-left"><a class="app-logo" href="/tools"><img class="header-logo-img" src="/gdhome-icon.png" alt="GD HOME"><span>Phiếu mẫu</span></a><details class="gd-tools-menu" data-shell-menu></details></div>' +
      '<div class="header-right"><div class="shell-toolbar"></div><div class="shell-account"><strong id="identity"></strong></div></div></header>');
    document.head.append(Object.assign(document.createElement('link'), {rel: 'stylesheet', href: '/shell.css'}));
    document.head.append(Object.assign(document.createElement('script'), {src: '/shell.js'}));
  }
  const api = async (method, body) => {
    if (preview) return method === 'GET' ? {name: 'Phiếu mẫu · xem thử (không lưu)', answers: {}} : {submittedAt: Date.now()};
    const res = await fetch('/api/survey/' + encodeURIComponent(token), {method, headers: {'Content-Type': 'application/json'}, body: body && JSON.stringify(body)});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Không kết nối được máy chủ');
    return data;
  };
  const saveDraft = () => api('POST', {answers: state.answers, submit: false}).catch(() => {});

  const has = (id, v) => [].concat(state.answers[id] ?? []).includes(v);
  const time = ms => new Date(ms).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'});

  // Icon giúp khách hình dung nhanh: nhóm, câu hỏi, lựa chọn ('câu.giá trị' trước, rồi giá trị chung)
  const GROUP_ICON = {chung: '🏠', gia_dinh: '👨‍👩‍👧', nha_pho: '🏘️', chung_cu: '🏢', van_phong: '💼', khach: '🛋️', bep: '🍳', ngu: '🛏️', wc: '🛁',
    lam_viec: '💻', tho: '🕯️', luu_tru: '🗄️', thong_minh: '📱', phong_cach: '🎨', ngan_sach: '💰'};
  const Q_ICON = {loai_nha: '🏠', tinh_trang: '🧱', dien_tich: '📐', muc_dich: '🎯', so_nguoi: '👥', thanh_vien: '👨‍👩‍👧', thu_cung: '🐾', thoi_quen: '⏰',
    gio_o_nha: '🕖', van_dong: '♿', so_tang: '🏢', thang_may: '🔼', cau_thang: '👣', gieng_troi: '☀️', tho_tang_tren: '🕯️', san_gara: '🚗', chong_nong_am: '🌡️',
    huong_nha: '🧭', ban_cong_san_thuong: '🌿', be_boi_gym: '🏊', quy_dinh_bql: '📋', cai_tao_tho: '🔨', logia: '🧺', dieu_hoa: '❄️', view_nang: '🌅',
    nhan_su: '👥', khu_vuc: '🗺️', thuong_hieu: '🏷️', thiet_bi_vp: '🖥️', khach_den: '🚶', pk_khach: '👥', pk_sofa: '🛋️', pk_tv: '📺', pk_chuc_nang: '📚',
    pk_cam_giac: '✨', bep_nau: '🍳', bep_kieu: '📏', bep_kin: '🚪', bep_dao: '🏝️', bep_thiet_bi: '🔌', bep_luu_tru: '🥫', ban_an: '🍽️', ban_an_vi_tri: '📍',
    pn_so: '🛏️', pn_master: '👑', pn_giuong: '🛏️', pn_con: '🧸', pn_ong_ba: '👴', pn_khach: '🧳', pn_rem_sang: '🌙', wc_so: '🚻', wc_kho_uot: '🚿',
    wc_thiet_bi: '🛁', wc_thong_gio: '💨', wc_an_toan: '⚠️', lv_ai: '💻', lv_kieu: '💺', lv_thiet_bi: '🖨️', tho_co: '🕯️', tho_loai: '🙏', tho_vi_tri: '📍',
    lt_quan_ao: '👗', lt_giay: '👟', lt_sach: '📚', lt_the_thao: '🚲', lt_khac: '🧳', lt_kho: '📦', tb_muc: '📱', tb_loai: '🤖', ps_phong_cach: '🎨',
    ps_mau: '🎨', ps_vat_lieu: '🌲', ps_anh_sang: '💡', ps_tham_khao: '🖼️', ps_khong_thich: '🙅', ns_noi_that: '💰', ns_gom: '🧾', ns_vao_o: '📅',
    ns_moc: '⏳', ns_uu_tien: '⭐', ns_quyet_dinh: '🤝', cuoi_ghi_chu: '📝',
    ps_tong_the: '✨', ps_rem: '🔲', kt_dien: '🔌', kt_nuoc_nong: '🔥', kt_nuoc: '🚰', kt_dan_nong: '❄️', kt_tran: '🏗️', kt_den: '💡', kt_tuong: '🧱',
    kt_mang: '🌐', sanh: '🚪', pk_ghi_chu: '📝', bep_nguoi_nau: '📏', bep_ghi_chu: '📝', pn_phan_bo: '👥', pn_con_dem: '🛏️', pn_ghi_chu: '📝',
    wc_doi: '🔨', lv_ghe: '💺', tho_ghi_chu: '📝'};
  const OPT_ICON = {
    'loai_nha.chung_cu': '🏢', 'loai_nha.nha_pho': '🏘️', 'loai_nha.biet_thu': '🏡', 'loai_nha.van_phong': '💼', 'loai_nha.cua_hang': '🏪', 'loai_nha.khac': '🏗️',
    'tinh_trang.tho': '🧱', 'tinh_trang.co_ban': '🏠', 'tinh_trang.dang_o': '🛠️', 'tinh_trang.xay_moi': '🏗️',
    'muc_dich.o_chinh': '🏠', 'muc_dich.nghi_duong': '🏖️', 'muc_dich.cho_thue': '🔑', 'muc_dich.kinh_doanh': '💼',
    'thanh_vien.vo_chong': '💑', 'thanh_vien.tre_nho': '👶', 'thanh_vien.tre_hoc': '🎒', 'thanh_vien.thanh_thieu': '🧑', 'thanh_vien.ong_ba': '👵', 'thanh_vien.giup_viec': '🧹', 'thanh_vien.khach_o_lai': '🧳',
    'thu_cung.cho': '🐕', 'thu_cung.meo': '🐈', 'thu_cung.chim_ca': '🐟',
    'thoi_quen.nau_an': '🍳', 'thoi_quen.tiep_khach': '🥂', 'thoi_quen.lam_viec': '💻', 'thoi_quen.xem_phim': '🎬', 'thoi_quen.the_thao': '🧘', 'thoi_quen.doc_sach': '📖', 'thoi_quen.cay_canh': '🌱', 'thoi_quen.nhac': '🎤',
    'gio_o_nha.toi': '🌙', 'gio_o_nha.ca_ngay': '☀️', 'gio_o_nha.thay_doi': '🔄',
    'san_gara.xe_may': '🛵', 'san_gara.o_to_1': '🚗', 'san_gara.o_to_2': '🚙', 'san_gara.san_vuon': '🌳', 'san_gara.tieu_canh': '🌱', 'san_gara.khu_giat': '🧺',
    'chong_nong_am.tang_nong': '🔥', 'chong_nong_am.tay': '🌇', 'chong_nong_am.nom_am': '💧', 'chong_nong_am.tham': '🌧️', 'chong_nong_am.gio_lua': '🌬️', 'chong_nong_am.toi': '🌑',
    'ban_cong_san_thuong.giat_phoi': '🧺', 'ban_cong_san_thuong.cay_canh': '🥬', 'ban_cong_san_thuong.tra_ca_phe': '☕', 'ban_cong_san_thuong.bbq': '🍖',
    'be_boi_gym.be_boi': '🏊', 'be_boi_gym.vuon': '🌳', 'be_boi_gym.gym': '🏋️', 'be_boi_gym.giai_tri': '🎬', 'be_boi_gym.ham_ruou': '🍷', 'be_boi_gym.bbq': '🍖',
    'dieu_hoa.treo': '❄️', 'dieu_hoa.am_tran': '🌀', 'view_nang.nang_tay': '🌇', 'view_nang.toi': '🌑', 'view_nang.view_dep': '🌆',
    'khu_vuc.le_tan': '🛎️', 'khu_vuc.lam_viec': '💻', 'khu_vuc.giam_doc': '👔', 'khu_vuc.hop': '🗣️', 'khu_vuc.tiep_khach': '🤝', 'khu_vuc.pantry': '☕', 'khu_vuc.kho': '📦', 'khu_vuc.server': '🖧', 'khu_vuc.nghi': '😴', 'khu_vuc.trung_bay': '🛍️',
    'thiet_bi_vp.mang': '🌐', 'thiet_bi_vp.man_hinh': '📽️', 'thiet_bi_vp.camera': '📹', 'thiet_bi_vp.in_an': '🖨️', 'thiet_bi_vp.dieu_hoa': '❄️',
    'pk_sofa.goc_l': '🛋️', 'pk_tv.tv_treo': '📺', 'pk_tv.tv_ke': '📺', 'pk_tv.may_chieu': '📽️',
    'pk_chuc_nang.ke_sach': '📚', 'pk_chuc_nang.trung_bay': '🏺', 'pk_chuc_nang.ruou': '🍷', 'pk_chuc_nang.doc_sach': '📖', 'pk_chuc_nang.piano': '🎹', 'pk_chuc_nang.giay': '👟', 'pk_chuc_nang.goc_tre': '🧸',
    'pk_cam_giac.thoang': '🌬️', 'pk_cam_giac.am_cung': '🕯️', 'pk_cam_giac.sang_trong': '💎',
    'bep_dao.dao': '🏝️', 'bep_dao.bar': '🍸',
    'bep_thiet_bi.tu': '🔥', 'bep_thiet_bi.gas': '🔥', 'bep_thiet_bi.hut_mui': '💨', 'bep_thiet_bi.lo_nuong': '🍞', 'bep_thiet_bi.lo_vi_song': '📟', 'bep_thiet_bi.rua_bat': '🍽️', 'bep_thiet_bi.tu_lanh_lon': '🧊', 'bep_thiet_bi.loc_nuoc': '🚰', 'bep_thiet_bi.tu_ruou': '🍷', 'bep_thiet_bi.may_xay': '🥤',
    'bep_luu_tru.do_kho': '🥫', 'bep_luu_tru.gia_vi': '🧂', 'bep_luu_tru.noi_chao': '🍳', 'bep_luu_tru.bat_dia': '🍽️', 'bep_luu_tru.thung_rac': '🗑️',
    'pn_master.wc_rieng': '🚿', 'pn_master.wic': '👗', 'pn_master.trang_diem': '💄', 'pn_master.lam_viec': '💻', 'pn_master.doc_sach': '📖', 'pn_master.tv': '📺', 'pn_master.ban_cong': '🌿',
    'pn_con.giuong_tang': '🛏️', 'pn_con.ban_hoc': '✏️', 'pn_con.choi': '🧩', 'pn_con.do_choi': '🧸',
    'pn_rem_sang.toi': '🌑', 'pn_rem_sang.tu_nhien': '🌤️', 'pn_rem_sang.chong_on': '🔇',
    'wc_kho_uot.kinh': '🚿', 'wc_kho_uot.bon': '🛁',
    'wc_thiet_bi.bon_tam': '🛁', 'wc_thiet_bi.bon_cau_tt': '🚽', 'wc_thiet_bi.sen_cay': '🚿', 'wc_thiet_bi.lavabo_doi': '🚰', 'wc_thiet_bi.tu_guong': '🔲', 'wc_thiet_bi.may_giat': '🧺', 'wc_thiet_bi.xong_hoi': '♨️', 'wc_thiet_bi.ban_dung': '🧴',
    'lv_thiet_bi.hai_man': '🖥️', 'lv_thiet_bi.pc': '💻', 'lv_thiet_bi.in': '🖨️', 'lv_thiet_bi.quay': '🎥', 'lv_thiet_bi.sach': '📚',
    'tho_loai.gia_tien': '🕯️', 'tho_loai.phat': '🙏', 'tho_loai.than_tai': '💰',
    'lt_the_thao.xe_dap': '🚲', 'lt_the_thao.golf': '⛳', 'lt_the_thao.vot': '🎾', 'lt_the_thao.cam_trai': '⛺', 'lt_the_thao.gym': '🏋️',
    'lt_khac.vali': '🧳', 'lt_khac.tet': '🧧', 'lt_khac.tre_em': '🧸', 'lt_khac.dung_cu': '🧰', 'lt_khac.hut_bui': '🧹', 'lt_khac.thuc_pham': '🥫',
    'tb_loai.den': '💡', 'tb_loai.rem': '🔲', 'tb_loai.khoa': '🔐', 'tb_loai.camera': '📹', 'tb_loai.dieu_hoa': '❄️', 'tb_loai.am_thanh': '🔊', 'tb_loai.cam_bien': '📡', 'tb_loai.robot': '🤖',
    'ps_mau.trang_kem': '🤍', 'ps_mau.go_sang': '🟫', 'ps_mau.go_toi': '🟤', 'ps_mau.xam': '🌫️', 'ps_mau.den': '🖤', 'ps_mau.xanh_la': '💚', 'ps_mau.xanh_navy': '💙', 'ps_mau.vang_dong': '💛', 'ps_mau.pastel': '💗', 'ps_mau.mau_dat': '🧡',
    'ps_vat_lieu.go_tn': '🌲', 'ps_vat_lieu.da': '⛰️', 'ps_vat_lieu.kim_loai': '🔩', 'ps_vat_lieu.kinh': '🔲', 'ps_vat_lieu.vai': '🧶', 'ps_vat_lieu.may_tre': '🎋', 'ps_vat_lieu.be_tong': '🧱',
    'ps_anh_sang.trang': '⚪', 'ps_anh_sang.vang': '🟡', 'ps_anh_sang.ket_hop': '🌗',
    'ns_uu_tien.ben': '🛡️', 'ns_uu_tien.dep': '✨', 'ns_uu_tien.re': '💸', 'ns_uu_tien.de_ve_sinh': '🧽', 'ns_uu_tien.tien_do': '⏱️', 'ns_uu_tien.thong_minh': '📱', 'ns_uu_tien.luu_tru': '🗄️', 'ns_uu_tien.suc_khoe': '🌱',
    'ns_quyet_dinh.mot': '🙋', 'ns_quyet_dinh.vo_chong': '💑', 'ns_quyet_dinh.gia_dinh': '👨‍👩‍👧',
    'pk_tv.tv_frame': '🖼️', 'pk_tv.game': '🎬', 'pk_tv.am_thanh': '🔊', 'pk_tv.khong': '🚫', 'lv_thiet_bi.laptop': '💻',
    'wc_thiet_bi.quat_4in1': '🌀', 'ps_vat_lieu.da_that': '🛋️', 'ps_vat_lieu.gach_bong': '🔲', 'ps_vat_lieu.giay_dan_tuong': '🖼️',
    'sanh.tu_giay': '👟', 'sanh.ghe': '💺', 'sanh.guong': '🔲', 'sanh.moc': '👗',
    'kt_dien.ba_pha': '🔌', 'kt_dien.mat_troi': '☀️', 'kt_dien.du_phong': '🔌', 'kt_dien.sac_xe': '🚗', 'kt_nuoc_nong.nl_mat_troi': '☀️',
    'dieu_hoa.trung_tam': '🌀', 'kt_tran.quat_tran': '🌀', 'kt_tran.quat_dh': '🌀', 'kt_tran.thoat_mui': '💨', 'kt_den.downlight': '💡', 'kt_den.tha': '💡',
    'kt_mang.wifi': '🌐', 'kt_mang.camera': '📹', 'ps_tong_the.robot': '🤖', 'ps_tong_the.van_go': '🌲', 'lv_ghe.cong_thai_hoc': '💺',
    khong: '🚫', chua_biet: '❓', co: '✅', da_biet: '✅'
  };
  const I = emoji => window.GDHomeSurveyIcons ? GDHomeSurveyIcons.svg(emoji) : emoji;   // icon nét đơn sắc (khao-sat-icons.js)
  const optIcon = (q, o) => OPT_ICON[q.id + '.' + o.v] || OPT_ICON[o.v] || '';

  function questionHtml(q, n) {
    const head = '<span class="ks-num">' + n + '</span><span class="ks-qi" aria-hidden="true">' + I(Q_ICON[q.id] || '•') + '</span><span class="ks-qtext">' + esc(q.text) +
      (q.type === 'many' ? ' <span class="ks-hint">chọn nhiều</span>' : '') + '</span>';
    if (q.type === 'text') {
      return '<div class="ks-q"><label class="ks-qhead" for="q-' + q.id + '">' + head + '</label><textarea id="q-' + q.id + '" data-q="' + q.id + '" maxlength="1000">' + esc(state.answers[q.id] || '') + '</textarea></div>';
    }
    const kind = q.type === 'many' ? 'checkbox' : 'radio';
    const opts = q.options.map(o => {
      const icon = optIcon(q, o);
      const opt = '<label class="ks-opt"><input type="' + kind + '" name="' + q.id + '" data-q="' + q.id + '" value="' + esc(o.v) + '"' +
        (has(q.id, o.v) ? ' checked' : '') + '><span>' + (icon ? '<i aria-hidden="true">' + I(icon) + '</i>' : '') + '<b>' + esc(o.l) + '</b></span></label>';
      // Tích nhỏ ngay dưới ô (vd Lò nướng → Âm tủ); tích vào thì ô chính tự được chọn
      const subs = q.sub?.[o.v];
      return subs ? '<div class="ks-optbox">' + opt + '<div class="ks-subs">' + subs.map(s => '<label class="ks-sub"><input type="checkbox" data-sub="' + q.id + '.' + esc(o.v) + '" value="' + esc(s.v) + '"' +
        ([].concat(state.answers[q.id + '.' + o.v] ?? []).includes(s.v) ? ' checked' : '') + '>' + esc(s.l) + '</label>').join('') + '</div></div>' : opt;
    }).join('');
    const other = q.other ? '<input type="text" data-other="' + q.id + '" maxlength="300" placeholder="Khác… (ghi rõ)" value="' + esc(state.answers[q.id + '.khac'] || '') + '">' : '';
    const answered = [].concat(state.answers[q.id] ?? []).length > 0;
    return '<fieldset class="ks-q ks-' + q.type + (answered ? ' is-done' : '') + '"><legend class="ks-qhead">' + head + '</legend><div class="ks-opts">' + opts + '</div>' + other + '</fieldset>';
  }

  function render() {
    const groups = D.visibleGroups(state.answers);
    state.step = Math.min(state.step, groups.length - 1);
    const group = groups[state.step], main = byId('ks-main'), nav = byId('ks-nav');
    byId('ks-bar').style.width = (state.done ? 100 : (state.step + 1) / groups.length * 100) + '%';
    nav.hidden = state.done;
    if (state.done) {
      main.innerHTML = '<div class="ks-thanks"><h2>Cảm ơn mình đã điền khảo sát!</h2><p>GD HOME đã nhận được câu trả lời và sẽ dựa vào đó để lên phương án thiết kế phù hợp nhất. ' +
        'Nếu cần bổ sung, mình có thể mở lại link này để sửa và gửi lại bất cứ lúc nào.</p><button type="button" class="ks-btn ks-ghost" id="ks-edit">Sửa lại câu trả lời</button></div>';
      return;
    }
    main.innerHTML = (state.step === 0 && state.submittedAt ? '<p class="ks-notice">Mình đã gửi khảo sát lúc ' + time(state.submittedAt) + '. Có thể chỉnh sửa rồi gửi lại.</p>' : '') +
      '<header class="ks-ghead"><span class="ks-gicon" aria-hidden="true">' + I(GROUP_ICON[group.id] || '📋') + '</span><div><h2 class="ks-title">' + esc(group.title) + '</h2><p class="ks-intro">' + esc(group.intro || '') + '</p></div></header>' +
      (group.note ? '<p class="ks-tip">' + I('⚠️') + '<span>' + esc(group.note) + '</span></p>' : '') +
      group.questions.map((q, i) => questionHtml(q, i + 1)).join('') +
      (state.error ? '<p class="ks-notice" role="alert">' + esc(state.error) + '</p>' : '');
    const last = state.step === groups.length - 1;
    byId('ks-step').textContent = 'Bước ' + (state.step + 1) + '/' + groups.length;
    byId('ks-back').disabled = state.step === 0 || state.busy;
    const next = byId('ks-next');
    next.textContent = last ? 'Gửi cho GD HOME' : 'Tiếp tục';
    next.disabled = state.busy || (state.step === 0 && !state.answers.loai_nha);
  }

  const signature = () => D.visibleQuestions(state.answers).map(q => q.id + ':' + q.options.length).join();

  function onSub(el) {
    const key = el.dataset.sub, [id, v] = key.split('.'), q = D.QUESTION_BY_ID[id];
    const list = new Set([].concat(state.answers[key] ?? []));
    el.checked ? list.add(el.value) : list.delete(el.value);
    if (list.size) state.answers[key] = [...list]; else delete state.answers[key];
    if (el.checked && !has(id, v)) {   // tích "Âm tủ" mà chưa chọn ô chính thì chọn luôn
      state.answers[id] = q.type === 'many' ? [...new Set([].concat(state.answers[id] ?? []).concat(v))] : v;
      const y = scrollY; render(); scrollTo(0, y);
    }
    store.write();
  }

  function onAnswer(el) {
    const before = signature();
    const id = el.dataset.q;
    if (el.type === 'checkbox') {
      const list = new Set([].concat(state.answers[id] ?? []));
      el.checked ? list.add(el.value) : list.delete(el.value);
      if (list.size) state.answers[id] = [...list]; else delete state.answers[id];
    } else if (el.type === 'radio') state.answers[id] = el.value;
    else if (el.value.trim()) state.answers[id] = el.value; else delete state.answers[id];
    // Bỏ chọn ô chính thì bỏ luôn tích nhỏ của nó
    let subGone = false;
    for (const v of Object.keys(D.QUESTION_BY_ID[id]?.sub || {})) if (!has(id, v) && state.answers[id + '.' + v]) { delete state.answers[id + '.' + v]; subGone = true; }
    store.write();
    if (subGone) el.closest('.ks-q')?.querySelectorAll('[data-sub]').forEach(box => { if (!has(id, box.dataset.sub.split('.')[1])) box.checked = false; });
    el.closest('.ks-q')?.classList.toggle('is-done', state.answers[id] != null);
    if (signature() !== before || (id === 'loai_nha')) { const y = scrollY; render(); scrollTo(0, y); }
  }

  async function move(delta) {
    const groups = D.visibleGroups(state.answers);
    state.error = '';
    if (delta > 0 && state.step === groups.length - 1) {
      state.busy = true; render();
      try {
        const saved = await api('POST', {answers: state.answers, submit: true});
        state.submittedAt = saved.submittedAt; state.done = true;
      } catch (error) { state.error = 'Chưa gửi được: ' + error.message + '. Câu trả lời vẫn được lưu trên máy, mình thử lại giúp nhé.'; }
      state.busy = false; render(); scrollTo(0, 0);
      return;
    }
    state.step = Math.max(0, state.step + delta);
    saveDraft(); render(); scrollTo(0, 0);
  }

  function bind() {
    const main = byId('ks-main');
    main.addEventListener('change', event => {
      if (event.target.dataset.sub) onSub(event.target);
      else if (event.target.dataset.q && event.target.type !== 'text') onAnswer(event.target);
    });
    main.addEventListener('input', event => {
      const el = event.target;
      if (el.tagName === 'TEXTAREA') onAnswer(el);
      else if (el.dataset.other) {
        if (el.value.trim()) state.answers[el.dataset.other + '.khac'] = el.value; else delete state.answers[el.dataset.other + '.khac'];
        store.write();
      }
    });
    main.addEventListener('click', event => { if (event.target.id === 'ks-edit') { state.done = false; state.step = 0; render(); scrollTo(0, 0); } });
    byId('ks-back').addEventListener('click', () => move(-1));
    byId('ks-next').addEventListener('click', () => move(1));
  }

  async function init() {
    bind();
    try {
      const data = await api('GET');
      byId('ks-project').textContent = data.name || 'GD HOME';
      state.answers = data.answers || {}; state.submittedAt = data.submittedAt || 0;
      const draft = store.read();
      if (draft && draft.at > (data.updatedAt || 0) && draft.answers) state.answers = draft.answers;
      render();
    } catch (error) {
      byId('ks-main').innerHTML = '<p class="ks-error">' + esc(error.message) + '</p>';
    }
  }
  init();
})();
