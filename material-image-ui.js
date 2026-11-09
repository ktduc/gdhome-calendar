async function storeMaterialImage(blob) {
  if (materialGuest) return saveGuestAsset(blob);
  return GDHomeImages.uploadAsset(blob,authHeaders);
}

async function uploadImage(file,crop = null,onCompressed) {
  const {full,thumb} = await GDHomeImages.compress(file,crop);
  const original = await storeMaterialImage(full);
  const small = thumb === full ? original : await storeMaterialImage(thumb);
  onCompressed?.(GDHomeImages.reduction(file,full));
  return {full:original,thumb:small};
}

async function attachImages(row, slot, files, render = false, libraryGroup = '') {
  const source = sheet;
  const pa = slot === 'render' ? null : row.options[Number(slot)];
  const list = pa ? pa.images : row.render;
  const selected = [...files].filter(f => f.type.startsWith('image/')).slice(0, Math.max(0,8-list.length));
  if (!selected.length) return;
  say('Đang nén và lưu ảnh…');
  const uploaded = [];
  let reduction;
  for (const file of selected) uploaded.push(await uploadImage(file,null,message => { reduction = message; }));
  if (sheet !== source || !sheet.groups.some(g => g.rows.includes(row))) return;
  const next = uploaded.slice(0,Math.max(0,8-list.length));
  if (!next.length) return;
  modify(() => {
    if (pa?.imageSource === 'library') list.unshift(...next);
    else list.push(...next);
    if (pa) pa.imageSource = 'manual';
  },render);
  byId('notice').textContent = '';
  let libraryMessage;
  if (pa && libraryGroup) {
    try {
      const library = await GDHomeAssets.loadLibrary();
      const category = GDHomeAssets.categoryFor(library,libraryGroup) || (await GDHomeAssets.saveCategory(libraryGroup)).category;
      await GDHomeAssets.addItems(category.id,next.map((image,index) => ({
        ...image,name:row.name?.trim() || selected[index].name?.replace(/\.[^.]+$/,'') || 'Ảnh vật liệu'
      })));
      libraryMessage = 'Đã lưu vào Dữ liệu dùng chung · ' + category.name;
    } catch (error) {
      showError(new Error('Ảnh đã dán vào bảng. Chưa lưu được vào Dữ liệu dùng chung. ' + error.message));
      return;
    }
  }
  GDHomeShell.toast([reduction,libraryMessage].filter(Boolean).join(' · '),byId('material-toast'));
}

function openMaterialLightbox(row,slot,initialIndex = 0) {
  const list = slot === 'render' ? row.render : row.options[Number(slot)].images;
  GDHomeShell.lightbox({
    title:(row.name || 'Ảnh vật liệu') + ' · ' + (slot === 'render' ? 'Phối cảnh 3D' : 'PA' + (Number(slot)+1)),
    count:() => list.length,
    initialIndex,
    render(index,figure) {
      figure.innerHTML = images([list[index]],true);
      showImages(figure);
    },
    crop:async (index,element,refresh) => {
      const view = await GDHomeAssets.editView(list[index]);
      if (!view) return;
      modify(() => setImageView(list,index,view),false);
      renderEditor();
      refresh();
    },
    remove(index) {
      if (!confirm('Xoá ảnh này khỏi ô?')) return false;
      modify(() => removeMaterialImage(list,index,slot === 'render' ? null : row.options[Number(slot)]),true,true);
      return true;
    },
    onClose() {
      const cell = box().querySelector('[data-row="' + CSS.escape(row.id) + '"] [data-slot="' + slot + '"]');
      (cell?.querySelector('.image-open') || cell)?.focus({preventScroll:true});
    },
    onError:showError,
    extraClass:'material-lightbox',
    cropLabel:'Chỉnh vùng nhìn'
  });
}

async function cropImage(row, slot, i, element, onSaved) {
  const source = sheet;
  const list = slot === 'render' ? row.render : row.options[Number(slot)].images;
  const item = list[i];
  const file = await readMaterialAsset(item.full || item);
  if (!element.open || sheet !== source || list[i] !== item) return;

  const crop = document.createElement('dialog');
  crop.className = 'shell-dialog crop-dialog';
  crop.setAttribute('aria-labelledby','crop-title');
  crop.innerHTML = '<h2 id="crop-title">Cắt ảnh</h2><p>Kéo bốn góc để chọn vùng giữ lại. Kéo trong vùng sáng để di chuyển.</p>' +
    '<div class="crop-stage"><img alt="Ảnh gốc" draggable="false"><div class="crop-selection">' +
    [['lt','trên trái'],['rt','trên phải'],['lb','dưới trái'],['rb','dưới phải']].map(([key,label]) =>
      '<button type="button" class="crop-handle" data-corner="' + key + '" aria-label="Góc ' + label + '"></button>').join('') +
    '</div></div><p class="crop-status" role="status"></p><div class="toolbar">' +
    '<button type="button" data-crop="cancel">Huỷ</button><button type="button" class="primary" data-crop="save">Lưu ảnh cắt</button></div>';
  const image = crop.querySelector('img');
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    await image.decode();
    if (!element.open || sheet !== source || list[i] !== item) {
      URL.revokeObjectURL(url);
      return;
    }
    document.body.append(crop);
    crop.showModal();
  } catch (error) {
    URL.revokeObjectURL(url);
    crop.remove();
    throw error;
  }
  crop.addEventListener('close', () => { URL.revokeObjectURL(url); crop.remove(); }, { once:true });
  const stage = crop.querySelector('.crop-stage');
  const selection = crop.querySelector('.crop-selection');
  const save = crop.querySelector('[data-crop="save"]');
  const cancel = crop.querySelector('[data-crop="cancel"]');
  let bounds = [0.08,0.08,0.92,0.92];
  const minSize = 0.02;
  const clamp = (value, low, high) => Math.min(high,Math.max(low,value));

  function paint() {
    const [left,top,right,bottom] = bounds;
    Object.assign(selection.style,{ left:left*100+'%',top:top*100+'%',width:(right-left)*100+'%',height:(bottom-top)*100+'%' });
  }

  function resize(start, corner, dx, dy) {
    const [left,top,right,bottom] = start;
    if (!corner) {
      const x = clamp(dx,-left,1-right);
      const y = clamp(dy,-top,1-bottom);
      return [left+x,top+y,right+x,bottom+y];
    }
    return [
      corner[0] === 'l' ? clamp(left+dx,0,right-minSize) : left,
      corner[1] === 't' ? clamp(top+dy,0,bottom-minSize) : top,
      corner[0] === 'r' ? clamp(right+dx,left+minSize,1) : right,
      corner[1] === 'b' ? clamp(bottom+dy,top+minSize,1) : bottom
    ];
  }

  let drag;
  selection.onpointerdown = event => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    drag = { id:event.pointerId, corner:event.target.dataset.corner, x:event.clientX, y:event.clientY, rect, start:bounds };
    selection.setPointerCapture(event.pointerId);
  };
  selection.onpointermove = event => {
    if (!drag || drag.id !== event.pointerId) return;
    bounds = resize(drag.start,drag.corner,(event.clientX-drag.x)/drag.rect.width,(event.clientY-drag.y)/drag.rect.height);
    paint();
  };
  selection.onlostpointercapture = () => { drag = null; };
  selection.onkeydown = event => {
    const shift = { ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1] }[event.key];
    const corner = event.target.dataset.corner;
    if (!shift || !corner) return;
    event.preventDefault();
    bounds = resize(bounds,corner,shift[0]*0.01,shift[1]*0.01);
    paint();
  };

  cancel.onclick = () => crop.close();
  crop.oncancel = event => { if (save.disabled) event.preventDefault(); };
  save.onclick = async () => {
    save.disabled = cancel.disabled = true;
    const status = crop.querySelector('.crop-status');
    status.textContent = 'Đang lưu ảnh cắt…';
    try {
      const updated = await uploadImage(file,bounds);
      if (sheet === source && list[i] === item) modify(() => {
        list[i] = {...updated,...(item.display ? {display:item.display} : {})};
        if (slot !== 'render') row.options[Number(slot)].imageSource = 'manual';
      },false);
      crop.close();
      if (element.open && sheet === source) onSaved();

    } catch (error) {
      status.textContent = error.message;
      save.disabled = cancel.disabled = false;
    }
  };
  paint();
}

const imageCellSelector = '.sheet-grid .image-cell[data-slot]';
let selectedImageCell, hoveredImageCell;

function focusMaterialImageCell(cell) {
  if (!cell) return;
  window.GDHomeAssets?.closePicker?.();
  const {row,slot} = context(cell);
  selectedImageCell = { sheetId:sheet.id, rowId:row.id, slot };
  cell.focus({preventScroll:true});
}

document.addEventListener('focusin',event => {
  if (sheet && event.target.matches(imageCellSelector)) focusMaterialImageCell(event.target);
});
document.addEventListener('pointerover',event => {
  hoveredImageCell = event.target.closest(imageCellSelector);
});
document.addEventListener('pointerout',event => {
  if (hoveredImageCell && !hoveredImageCell.contains(event.relatedTarget)) hoveredImageCell = null;
});

function clipboardImageFiles(clipboard) {
  const isImage = file => file?.type.startsWith('image/');
  const files = [...(clipboard?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter(isImage);
  return files.length ? files : [...(clipboard?.files || [])].filter(isImage);
}

function clipboardImageSources(markup) {
  if (!markup) return [];
  const template = document.createElement('template');
  template.innerHTML = markup;
  return [...new Set([...template.content.querySelectorAll('img[src]')].map(img => img.getAttribute('src')))].slice(0,8);
}

async function imageFromClipboardUrl(source) {
  const url = new URL(source,location.href);
  if (!/^data:image\/(png|jpe?g|webp|gif|bmp|tiff);/i.test(url.href) &&
      !['https:','http:'].includes(url.protocol) && !(url.protocol === 'blob:' && url.origin === location.origin)) {
    throw new Error('Liên kết ảnh clipboard không mở được.');
  }
  const response = await fetch(url,{ credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000) });
  if (!response.ok || Number(response.headers.get('content-length')) > 12*1024*1024) throw new Error('Không đọc được ảnh clipboard.');
  const image = await response.blob();
  if (!image.type.startsWith('image/') || image.size > 12*1024*1024) throw new Error('Ảnh clipboard không hợp lệ hoặc vượt 12 MB.');
  return image;
}

async function readClipboardImages(sources) {
  if (sources.length) {
    const results = await Promise.allSettled(sources.map(imageFromClipboardUrl));
    const images = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    if (images.length) return images;
    throw new Error('Trang nguồn chặn đọc ảnh qua liên kết. Chọn Sao chép hình ảnh hoặc kéo tệp ảnh vào ô.');
  }
  if (!navigator.clipboard?.read) return [];
  const images = [];
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find(value => value.startsWith('image/'));
    if (type) images.push(await item.getType(type));
  }
  return images;
}

document.addEventListener('paste', event => {
  if (!sheet || event.target.closest?.('dialog')) return;
  const clipboard = event.clipboardData;
  const files = clipboardImageFiles(clipboard);
  const plainText = clipboard?.getData('text/plain') || '';
  const sources = clipboardImageSources(clipboard?.getData('text/html'));
  const textField = event.target.closest?.('input:not([type=checkbox]),textarea,[contenteditable]');
  let cell = event.target.closest?.(imageCellSelector);
  if (textField) {
    const row = textField.closest('[data-row]');
    const selected = selectedImageCell;
    if (plainText || (!files.length && !sources.length) || !row || selected?.sheetId !== sheet.id || selected?.rowId !== row.dataset.row) return;
    cell = row.querySelector('[data-slot="' + selected.slot + '"]');
  } else if (!cell && hoveredImageCell?.isConnected) cell = hoveredImageCell;
  if (!cell && (files.length || sources.length) && selectedImageCell && selectedImageCell.sheetId === sheet.id) {
    cell = document.querySelector('tr[data-row="' + selectedImageCell.rowId + '"] .image-cell[data-slot="' + selectedImageCell.slot + '"]');
  }
  if (!cell || (plainText && !files.length && !sources.length)) return;
  event.preventDefault();
  window.GDHomeAssets?.closePicker?.();
  const {group,row,slot} = context(cell);
  const libraryGroup = group?.name?.trim();
  if (files.length) attachImages(row,slot,files,true,libraryGroup).catch(showError);
  else {
    const sourceSheet = sheet;
    readClipboardImages(sources).then(images => {
      if (sheet !== sourceSheet || !images.length) return;
      return attachImages(row,slot,images,true,libraryGroup);
    }).catch(showError);
  }
});

let draggedMaterialImage, markedImageCell;
const materialImageDragType = 'application/x-gdhome-image';
const materialImageList = (row,slot) => slot === 'render' ? row?.render : row?.options[Number(slot)]?.images;
function markImageDrop(cell) {
  markedImageCell?.classList.remove('material-image-drop-target');
  markedImageCell = cell;
  cell?.classList.add('material-image-drop-target');
}
function imageDropTarget(cell) {
  if (!cell || !draggedMaterialImage || draggedMaterialImage.sheet !== sheet) return null;
  const target = context(cell);
  const source = draggedMaterialImage;
  if ((target.slot === 'render') !== (source.slot === 'render')) return null;
  const list = materialImageList(target.row,target.slot);
  return list && list !== source.list ? {...target,list} : null;
}
document.addEventListener('dragstart',event => {
  const button = event.target.closest('.sheet-grid [draggable=true][data-action=view-image]');
  if (!button || !sheet) return;
  const {row,slot} = context(button);
  const list = materialImageList(row,slot);
  const image = list?.[Number(button.dataset.index || 0)];
  if (!image) return;
  draggedMaterialImage = {sheet,row,slot,list,image};
  event.dataTransfer.setData(materialImageDragType,'1');
  event.dataTransfer.effectAllowed = 'copyMove';
});
document.addEventListener('dragend',() => {
  draggedMaterialImage = null;
  markImageDrop(null);
});
document.addEventListener('dragover',event => {
  const cell = event.target.closest('.sheet-grid [data-slot]');
  if (imageDropTarget(cell)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = event.shiftKey ? 'move' : 'copy';
    markImageDrop(cell);
  } else {
    markImageDrop(null);
    if (cell && event.dataTransfer.types.includes('Files')) event.preventDefault();
  }
});
document.addEventListener('dragleave',event => {
  if (markedImageCell && !markedImageCell.contains(event.relatedTarget)) markImageDrop(null);
});
document.addEventListener('drop',event => {
  const cell = event.target.closest('.sheet-grid [data-slot]');
  markImageDrop(null);
  if (!cell) return;
  if (event.dataTransfer.types.includes(materialImageDragType)) {
    event.preventDefault();
    const target = imageDropTarget(cell);
    const source = draggedMaterialImage;
    draggedMaterialImage = null;
    const index = source?.list.indexOf(source.image) ?? -1;
    if (!target || index < 0) return;
    const full = image => typeof image === 'string' ? image : image.full;
    const exists = target.list.some(image => full(image) === full(source.image));
    if (exists && !event.shiftKey) return say('Ảnh đã có trong ô.');
    if (!exists && target.list.length >= 8) return say('Mỗi ô tối đa 8 ảnh.');
    modify(() => {
      if (!exists) target.list.push(structuredClone(source.image));
      if (event.shiftKey) removeMaterialImage(source.list,index,source.slot === 'render' ? null : source.row.options[Number(source.slot)]);
    });
    return;
  }
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  window.GDHomeAssets?.closePicker?.();
  const {row,slot} = context(cell);
  attachImages(row,slot,event.dataTransfer.files,true).catch(showError);
});


if (window.GDHomeAssets) GDHomeAssets.configure({
  headers:() => authHeaders(),
  guest:() => materialGuest,
  pickerWidth:() => materialView.pickerWidth,
  savePickerWidth:pickerWidth => setMaterialView({pickerWidth}),
  mergeGuestReferences:(removed,target,undo) => mergeGuestLibraryReferences(removed,target,undo),
  storeAsset:blob => storeMaterialImage(blob),
  readAsset:name => readMaterialAsset(name)
});
