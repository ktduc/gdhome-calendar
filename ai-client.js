window.GDHomeAI = (() => {
  let xlsxLoader;
  function loadWorkbook() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxLoader ||= new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => { script.remove(); xlsxLoader = null; reject(new Error('Không tải được thư viện Excel.')); };
      document.head.append(script);
    });
    return xlsxLoader;
  }

  function attachments({state,input,drop,list,root,onChange}) {
    function render() {
      list.replaceChildren();
      state.files.forEach((file,index) => {
        const chip = document.createElement('span');
        chip.className = 'ai-file-chip';
        if (file.type.startsWith('image/')) {
          const preview = document.createElement('button');
          preview.type = 'button';
          preview.textContent = file.name;
          preview.title = 'Xem ảnh lớn';
          preview.onclick = () => {
            const url = URL.createObjectURL(file);
            GDHomeShell.lightbox({title:file.name,count:() => 1,render(_index,figure) {
              const image = document.createElement('img');
              image.src = url;
              image.alt = file.name;
              figure.append(image);
            },onClose:() => URL.revokeObjectURL(url)});
          };
          chip.append(preview);
        } else chip.textContent = file.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label','Bỏ tệp ' + file.name);
        remove.onclick = () => { state.files.splice(index,1); render(); };
        chip.append(remove);
        list.append(chip);
      });
      onChange?.(state.files.length);
    }
    function add(files) {
      const valid = [...files].filter(file => file.type.startsWith('image/') || /\.(xlsx|xls|csv|pdf)$/i.test(file.name));
      state.files = [...state.files,...valid].slice(0,8);
      render();
    }
    input.onchange = () => { add(input.files); input.value = ''; };
    drop.ondragover = event => { event.preventDefault(); drop.classList.add('is-over'); };
    drop.ondragleave = () => drop.classList.remove('is-over');
    drop.ondrop = event => {
      event.preventDefault();
      drop.classList.remove('is-over');
      add(event.dataTransfer.files);
    };
    root.onpaste = event => {
      if (!root.contains(input)) return;
      const items = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file')
        .map(item => item.getAsFile()).filter(Boolean);
      const files = items.length ? items : [...(event.clipboardData?.files || [])];
      if (!files.length) return;
      event.preventDefault();
      add(files);
    };
    render();
    return render;
  }

  async function encode(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1,1568/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width*scale));
      canvas.height = Math.max(1,Math.round(bitmap.height*scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return {mediaType:'image/jpeg',data:canvas.toDataURL('image/jpeg',.8).split(',')[1]};
    } finally { bitmap.close(); }
  }

  async function prepare(files,notes) {
    const images = [],pdfs = [],tables = [];
    for (const file of files) {
      if (file.size > 12*1024*1024) throw new Error(file.name + ' vượt 12 MB.');
      if (file.type.startsWith('image/')) {
        if (images.length >= 6) throw new Error('Mỗi lượt gửi tối đa 6 ảnh.');
        images.push(await encode(file));
      } else if (/\.pdf$/i.test(file.name)) {
        if (pdfs.length >= 2 || file.size > 7*1024*1024) throw new Error('Mỗi lượt tối đa 2 PDF, mỗi PDF không quá 7 MB.');
        const data = await new Promise((resolve,reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = () => reject(new Error('Không đọc được ' + file.name));
          reader.readAsDataURL(file);
        });
        pdfs.push({data});
      } else if (/\.csv$/i.test(file.name)) {
        tables.push(file.name + '\n' + await file.text());
      } else {
        const xlsx = await loadWorkbook();
        const book = xlsx.read(await file.arrayBuffer());
        for (const name of book.SheetNames) tables.push(file.name + ' / ' + name + '\n' +
          xlsx.utils.sheet_to_csv(book.Sheets[name],{blankrows:false}));
      }
    }
    const sheetText = tables.join('\n\n');
    if (sheetText.length > 60000) throw new Error('Bảng tính vượt 60.000 ký tự. Hãy tách thành từng lượt.');
    const payload = {images,pdfs,sheetText,notes};
    if (new Blob([JSON.stringify(payload)]).size > 9*1024*1024) throw new Error('Tổng tài liệu quá lớn. Hãy chia thành từng lượt.');
    return payload;
  }

  async function run(state,{request,onStart,onDone,onError,onFinish}) {
    if (state.running) return;
    state.running = true;
    try {
      onStart?.();
      const result = await request();
      onDone(result);
    } catch (error) { onError(error); }
    finally { state.running = false; onFinish?.(); }
  }

  return {attachments,prepare,run,loadWorkbook};
})();
