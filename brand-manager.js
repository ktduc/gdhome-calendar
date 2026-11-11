window.GDHomeBrandManager = (() => {
  const esc = value => GDHomeShell.escape(value ?? '');
  const logoHeaders = () => (typeof authHeaders === 'function' ? authHeaders() : GDHomeShell.authHeaders?.() || {});
  async function logoFile(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas');
      const scale = 512/Math.max(image.naturalWidth,image.naturalHeight);
      canvas.width = canvas.height = 512;
      canvas.getContext('2d').drawImage(image,(512-image.naturalWidth*scale)/2,(512-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
      const png = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
      if (!png) throw new Error('Không chuyển được logo sang PNG.');
      return GDHomeAssets.storeAsset(png);
    } finally { URL.revokeObjectURL(url); }
  }
  function modal(title) {
    const element = document.createElement('dialog'); document.body.append(element);
    GDHomeShell.dialog(element,'<h2>'+esc(title)+'</h2><div data-brand-body></div>');
    element.addEventListener('close',() => element.remove(),{once:true});
    return {element,body:element.querySelector('[data-brand-body]')};
  }
  async function render(root,data,call,repaint) {
    const brands = GDHomeBrands.normalize(data.brands,data.items);
    let filter = '';
    const save = patch => call('brands',patch,guest => {
      guest.brands = GDHomeBrands.normalize(guest.brands,guest.items);
      const previous = guest.brands.find(brand => brand.id === patch.id);
      if (patch.order) { guest.brands.forEach(brand => { brand.order = patch.order.indexOf(brand.id); }); return {}; }
      if (patch.mergeInto) {
        const target = guest.brands.find(brand => brand.id === patch.mergeInto);
        target.aliases.push(previous.name,...previous.aliases);
        for (const item of guest.items) if (GDHomeBrands.find([previous],item.brand)) item.brand = target.name;
        guest.brands = guest.brands.filter(brand => brand !== previous); return {};
      }
      const record = {...previous,...patch,id:previous?.id || crypto.randomUUID()};
      if (previous) {
        record.aliases = [...(record.aliases || []),previous.name];
        for (const item of guest.items) if (GDHomeBrands.find([previous],item.brand)) item.brand = record.name;
        guest.brands.splice(guest.brands.indexOf(previous),1,record);
      } else guest.brands.push(record);
      return {};
    });
    async function chooseLogo(brand) {
      const view = modal('Tìm logo · '+brand.name);
      view.body.innerHTML = '<p role="status">Đang tìm logo…</p><div class="brand-logo-candidates"></div>' +
        '<form class="brand-logo-google"><label>Tìm ảnh trên mạng <input name="q" value="'+esc(brand.name+' logo')+'"></label><button>Tìm</button></form>' +
        '<p class="brand-logo-google-status asset-hint"></p><div class="brand-logo-candidates brand-logo-google-grid"></div>';
      // Tìm logo bằng ảnh Google (cùng nhà cung cấp tìm ảnh với ô tìm mã); bấm ảnh là lưu làm logo luôn.
      const googleForm = view.body.querySelector('.brand-logo-google');
      const googleStatus = view.body.querySelector('.brand-logo-google-status');
      const googleGrid = view.body.querySelector('.brand-logo-google-grid');
      async function searchGoogle(query) {
        googleGrid.innerHTML = ''; googleStatus.textContent = 'Đang tìm ảnh…';
        try {
          const response = await fetch('/api/google/search?q='+encodeURIComponent(query),{headers:logoHeaders()});
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'Không tìm được ảnh.');
          if (!data.configured) { googleStatus.textContent = 'Chưa cấu hình nhà cung cấp tìm ảnh trong ⚙ Kết nối.'; return; }
          const items = (data.items || []).slice(0,12);
          googleStatus.textContent = items.length ? 'Bấm một ảnh để dùng làm logo.' : 'Không tìm thấy ảnh.';
          for (const item of items) {
            const button = document.createElement('button'); button.type = 'button'; button.title = item.title || brand.name;
            const image = document.createElement('img'); image.alt = item.title || brand.name; image.src = item.thumbnail || item.link; image.referrerPolicy = 'no-referrer';
            button.append(image); googleGrid.append(button);
            button.onclick = async () => {
              button.disabled = true; googleStatus.textContent = 'Đang tải logo…';
              try {
                const res = await fetch('/api/google/proxy-image',{method:'POST',headers:{...logoHeaders(),'Content-Type':'application/json'},body:JSON.stringify({url:item.link})});
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Không tải được ảnh.');
                await save({...brand,logo:await logoFile(await res.blob())}); view.element.close(); repaint();
              } catch (error) { button.disabled = false; googleStatus.textContent = error.message; }
            };
          }
        } catch (error) { googleStatus.textContent = error.message; }
      }
      googleForm.onsubmit = event => { event.preventDefault(); const query = googleForm.elements.q.value.trim(); if (query) searchGoogle(query); };
      searchGoogle(brand.name+' logo');
      try {
        const result = await post('/api/catalogue/logo-search',{name:brand.name,website:brand.website});
        view.body.querySelector('[role=status]').textContent = result.items.length ? 'Chọn logo của hãng.' : 'Chưa tìm được logo. Điền website hoặc cấu hình tìm ảnh trong Kết nối.';
        const list = view.body.querySelector('div');
        for (const candidate of result.items) {
          const button = document.createElement('button'); button.type = 'button'; button.title = candidate.title || brand.name;
          const image = document.createElement('img'); image.alt = candidate.title || brand.name; button.append(image); list.append(button);
          try {
            const response = await fetch('/api/catalogue/logo-image',{method:'POST',headers:authHeaders(),body:JSON.stringify({url:candidate.url})});
            if (!response.ok) throw new Error('Không tải được logo.');
            const blob = await response.blob(), url = URL.createObjectURL(blob); image.src = url;
            view.element.addEventListener('close',() => URL.revokeObjectURL(url),{once:true});
            button.onclick = async () => {
              button.disabled = true;
              try { await save({...brand,logo:await logoFile(blob)}); view.element.close(); repaint(); }
              catch (error) { button.disabled = false; view.body.querySelector('[role=status]').textContent = error.message; }
            };
          } catch { button.remove(); }
        }
      } catch (error) { view.body.querySelector('[role=status]').textContent = error.message; }
    }
    function edit(brand = {}) {
      const view = modal(brand.id ? 'Sửa thương hiệu' : 'Thêm thương hiệu');
      view.body.innerHTML = '<form>' + [['name','Tên'],['aliases','Tên khác (cách nhau dấu phẩy)'],['website','Website'],['note','Ghi chú']].map(([key,label]) => '<label>'+label+'<input name="'+key+'" value="'+esc(Array.isArray(brand[key]) ? brand[key].join(', ') : brand[key])+'"'+(key === 'name' ? ' required' : '')+'></label>').join('') +
        '<fieldset><legend>Hạng mục vật liệu</legend>'+data.categories.map(category => '<label><input type="checkbox" name="category" value="'+esc(category.id)+'"'+(brand.categories?.includes(category.id) ? ' checked' : '')+'>'+esc(category.name)+'</label>').join('')+'</fieldset><button>Lưu</button><p role="status"></p></form>';
      view.body.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        const fields = new FormData(event.target);
        const patch = {...brand,name:fields.get('name'),aliases:fields.get('aliases').split(',').map(value => value.trim()).filter(Boolean),website:fields.get('website'),note:fields.get('note'),categories:fields.getAll('category')};
        try {
          const result = await save(patch); view.element.close(); await repaint();
          if (!brand.id) await chooseLogo(GDHomeBrands.find(result.brands,patch.name) || patch);
        } catch (error) { view.body.querySelector('[role=status]').textContent = error.message; }
      };
    }
    function paint() {
      root.innerHTML = '<div class="asset-library-head"><h3>Thương hiệu</h3><button type="button" data-brand-add>Thêm thương hiệu</button><label>Hạng mục <select data-brand-filter><option value="">Tất cả</option>'+data.categories.map(category => '<option value="'+esc(category.id)+'"'+(filter === category.id ? ' selected' : '')+'>'+esc(category.name)+'</option>').join('')+'</select></label></div><div class="brand-grid">'+
        brands.filter(brand => !filter || brand.categories.includes(filter)).map(brand => '<article draggable="true" data-brand-id="'+esc(brand.id)+'">'+(brand.logo ? '<img data-lib-asset="'+esc(brand.logo)+'" alt="'+esc(brand.name)+'">' : '<div class="brand-placeholder">'+esc(brand.name)+'</div>')+'<strong>'+esc(brand.name)+'</strong><small>'+data.items.filter(item => GDHomeBrands.find([brand],item.brand)).length+' mẫu</small><p>'+brand.categories.map(id => data.categories.find(category => category.id === id)?.name).filter(Boolean).map(esc).join(' · ')+'</p><button type="button" data-brand-edit>Sửa</button><button type="button" data-brand-logo>Tìm logo</button><button type="button" data-brand-upload>Đổi logo</button><button type="button" data-brand-merge>Gộp hãng</button></article>').join('')+'</div>';
      GDHomeAssets.hydrate(root);
      root.querySelector('[data-brand-add]').onclick = () => edit();
      root.querySelector('[data-brand-filter]').onchange = event => { filter = event.target.value; paint(); };
      let dragged;
      for (const card of root.querySelectorAll('[data-brand-id]')) {
        const brand = brands.find(brand => brand.id === card.dataset.brandId);
        card.querySelector('[data-brand-edit]').onclick = () => edit(brand);
        card.querySelector('[data-brand-logo]').onclick = () => chooseLogo(brand);
        const upload = async files => {
          if (!files[0]) return;
          try { await save({...brand,logo:await logoFile(files[0])}); repaint(); } catch (error) { GDHomeShell.toast(error.message); }
        };
        card.tabIndex = 0;
        card.onpaste = event => { const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/')); if (files.length) { event.preventDefault(); upload(files); } };
        card.querySelector('[data-brand-upload]').onclick = async () => upload(await GDHomeAssets.filePicker('image/*',false));
        card.querySelector('[data-brand-merge]').onclick = () => {
          const view = modal('Gộp '+brand.name);
          view.body.innerHTML = '<label>Gộp vào <select>'+brands.filter(other => other.id !== brand.id).map(other => '<option value="'+esc(other.id)+'">'+esc(other.name)+'</option>').join('')+'</select></label><button type="button">Gộp hãng</button>';
          view.body.querySelector('button').onclick = async () => { try { await save({id:brand.id,mergeInto:view.body.querySelector('select').value}); view.element.close(); repaint(); } catch (error) { GDHomeShell.toast(error.message); } };
        };
        card.ondragstart = event => { dragged = brand.id; event.dataTransfer.setData('text/plain',brand.id); };
        card.ondragover = event => { if (dragged) event.preventDefault(); };
        card.ondrop = async event => {
          event.preventDefault(); if (!dragged || dragged === brand.id) return;
          const order = brands.map(brand => brand.id).filter(id => id !== dragged); order.splice(order.indexOf(brand.id),0,dragged);
          try { await save({order}); repaint(); } catch (error) { GDHomeShell.toast(error.message); }
        };
      }
    }
    paint();
  }
  return {render};
})();
