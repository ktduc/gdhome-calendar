const reviewToken = location.pathname.split('/').at(-1);
const reviewApi = '/api/review/' + reviewToken;
let customerView, tick;
const publicCall = (suffix = '',body) => request(reviewApi+suffix, body ? { method:'POST', body:JSON.stringify(body) } : {},false);

function renderCustomer() {
  clearInterval(tick);
  const root = byId('review');
  const view = customerView;
  const { sheet,customer,company,changes } = view;
  root.dataset.imageFit = sheet.imageFit === 'fill' ? 'fill' : 'fit';
  const committed = customer?.choices || {};
  clearPrintImages(root);
  root.innerHTML = '<h2>' + html(sheet.title) + '</h2><p>' + html([sheet.meta.project,sheet.meta.customer].filter(Boolean).join(' · ')) +
    '</p><button id="customer-print">Xem biên bản A4</button><form id="customer-form">' +
    sheet.groups.map(group => '<section class="panel"><h3>' + html(group.name) + '</h3>' + group.rows.map(row =>
      '<fieldset><legend>' + html(row.name) + (row.room ? ' · '+html(row.room) : '') + '</legend>' +
      '<div class="cards">' + (row.render.length ? '<div class="review-option"><label>Phối cảnh 3D</label><div class="print-squares">' +
        printImages(row.render,reviewApi+'/assets/',false,true) + '</div></div>' : '') + row.options.map((pa,i) =>
        (pa.code || pa.brand || pa.finish || pa.size || pa.color || pa.images.length) ? '<div class="review-option"><label><input type="radio" name="' + row.id +
          '" value="' + i + '" required ' + (customer?'disabled ':'') + ((committed[row.id] ?? row.chosen) === i ? 'checked' : '') +
          '> PA' + (i+1) + ' · ' + html([pa.brand,pa.code,pa.color,pa.size,pa.finish].filter(Boolean).join(' · ')) +
          '</label><div class="print-squares">' + printImages(pa.images,reviewApi+'/assets/',false,true) + '</div></div>' : ''
      ).join('') + '</div></fieldset>').join('') + '</section>').join('') +
    (customer ? '' : '<section class="panel">' + signatureForm('customer') + '<p><label><input type="checkbox" id="accepted" required> Tôi đồng ý với các lựa chọn và nội dung biên bản.</label></p><button class="primary">Đồng ý và ký</button></section>') +
    '</form>' + (customer ? '<section class="panel"><h3>Đã nhận xác nhận</h3><div class="print-signatures"><div>Bên A<br>' +
      signatureMark(customer) + '</div><div>Bên B<br>' + signatureMark(company) + '</div></div><p>Hạn yêu cầu đổi ' + html(vnDate(customer.expiresAt)) +
      '</p><p id="change-clock"></p><form id="change-form"><label>Lý do đổi mã <textarea id="change-reason" required maxlength="1500"></textarea></label><button>Gửi yêu cầu đổi</button></form>' +
      changes.map(change => '<p>' + html(vnDate(change.at) + ' · ' + change.reason) + '</p>').join('') + '</section>' : '');
  loadPrintImages(root);
  root.onclick = event => {
    const button = event.target.closest('[data-review-image]');
    if (!button) return;
    const images = [...button.closest('.print-squares').querySelectorAll('[data-review-image]')];
    const dialog = GDHomeShell.lightbox({
      title:button.closest('fieldset').querySelector('legend').textContent,
      count:() => images.length,
      initialIndex:images.indexOf(button),
      render(index,figure) {
        clearPrintImages(figure);
        const img = document.createElement('img');
        img.alt = 'Ảnh vật liệu';
        img.dataset.printImg = images[index].dataset.reviewImage;
        figure.replaceChildren(img);
        queueMicrotask(() => loadPrintImages(figure));
      },
      onClose:() => { clearPrintImages(dialog); button.focus({preventScroll:true}); }
    });
  };
  const choices = () => Object.fromEntries([...root.querySelectorAll('input[type=radio]:checked')].map(input => [input.name,Number(input.value)]));
  byId('customer-print').onclick = () => showPrint(customer ? view : { ...view,customer:{ choices:choices(),at:view.publishedAt,strokes:[],name:'Chờ ký' } },reviewApi+'/assets/',{}).catch(showError);
  if (!customer) {
    const readSignature = setupSignature('customer');
    byId('customer-form').onsubmit = event => {
      event.preventDefault();
      submitCustomer(event.submitter,'/sign',{ ...readSignature(),accepted:byId('accepted').checked,choices:choices() });
    };
    return;
  }
  const serverOffset = view.serverNow - Date.now();
  const update = () => {
    const left = Math.max(0,Math.ceil((customer.expiresAt-Date.now()-serverOffset)/1000));
    byId('change-form').hidden = !left;
    byId('change-clock').textContent = left ? 'Còn ' + Math.floor(left/3600) + ' giờ ' + Math.floor(left%3600/60) + ' phút ' + left%60 + ' giây' : 'Đã hết hạn yêu cầu đổi.';
  };
  tick = setInterval(update,1000);
  update();
  byId('change-form').onsubmit = event => {
    event.preventDefault();
    submitCustomer(event.submitter,'/change',{ reason:byId('change-reason').value });
  };
}
async function submitCustomer(button,path,body) {
  button.disabled = true;
  try { customerView = await publicCall(path,body); byId('notice').textContent = ''; renderCustomer(); }
  catch (error) { showError(error); byId('notice').scrollIntoView(); }
  finally { button.disabled = false; }
}
publicCall().then(data => { customerView = data; renderCustomer(); }).catch(showError);
