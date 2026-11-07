async function encodeImage(source, maxSide, targetBytes, crop = null) {
  const image = await createImageBitmap(source);
  try {
    const [x,y,w,h] = crop ? crop.map((n,i) => Math.round(n * (i%2 ? image.height : image.width))) : [0,0,image.width,image.height];
    const canvas = document.createElement('canvas');
    let scale = Math.min(1,maxSide/Math.max(w,h));
    for (let attempt = 0; attempt < 10; attempt++) {
      canvas.width = Math.max(1,Math.round(w*scale));
      canvas.height = Math.max(1,Math.round(h*scale));
      canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,canvas.width,canvas.height);
      const data = canvas.toDataURL('image/webp',attempt < 2 ? 0.84 : 0.72);
      if (data.startsWith('data:image/webp;base64,') && data.length * .75 < targetBytes) return data.split(',')[1];
      scale *= .82;
    }
    throw new Error('Không nén được ảnh WebP.');
  } finally { image.close(); }
}
async function uploadImage(file, crop = null) {
  const fullData = await encodeImage(file,materials.r2 ? 1600 : 1000,materials.r2 ? 200000 : 150000,crop);
  const thumbData = await encodeImage(file,420,48000,crop);
  const full = await post('/api/materials/assets',{ image:fullData });
  const thumb = await post('/api/materials/assets',{ image:thumbData });
  return { full:full.name, thumb:thumb.name };
}
async function attachImages(row, slot, files, render = false) {
  const source = sheet;
  const list = slot === 'render' ? row.render : row.options[Number(slot)].images;
  const selected = [...files].filter(f => f.type.startsWith('image/')).slice(0, Math.max(0,8-list.length));
  if (!selected.length) return;
  say('Đang nén và lưu ảnh…');
  const uploaded = [];
  for (const file of selected) uploaded.push(await uploadImage(file));
  if (sheet !== source || !sheet.groups.some(g => g.rows.includes(row))) return;
  modify(() => list.push(...uploaded.slice(0,Math.max(0,8-list.length))),render);
  say('');
}

async function cropImage(row, slot, i, element) {
  const list = slot === 'render' ? row.render : row.options[Number(slot)].images;
  const item = list[i];
  const response = await fetch('/api/materials/assets/' + (item.full || item),{ headers:authHeaders() });
  if (!response.ok) throw new Error('Không mở được ảnh để crop.');
  const file = await response.blob();
  const values = prompt('Crop theo %: trái, trên, rộng, cao','10,10,80,80')?.split(',').map(n => Number(n.trim())/100);
  if (!values) return;
  if (values.length !== 4 || values.some(n => !Number.isFinite(n) || n < 0) || values[2] < .01 || values[3] < .01 ||
      values[0] + values[2] > 1 || values[1] + values[3] > 1) throw new Error('Vùng crop nằm ngoài ảnh.');
  const image = await uploadImage(file,values);
  modify(() => { list[i] = image; },false);
  element.close();
  editDetail(row,slot);
}

document.addEventListener('paste', event => {
  const cell = event.target.closest('.sheet-grid [data-slot]');
  if (!sheet || !cell) return;
  const files = [...event.clipboardData.files].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  event.preventDefault();
  const {row,slot} = context(cell);
  attachImages(row,slot,files,true).catch(showError);
});
document.addEventListener('dragover', event => {
  if (event.target.closest('.sheet-grid [data-slot]') && event.dataTransfer.types.includes('Files')) event.preventDefault();
});
document.addEventListener('drop', event => {
  const cell = event.target.closest('.sheet-grid [data-slot]');
  if (!cell || !event.dataTransfer.files.length) return;
  event.preventDefault();
  const {row,slot} = context(cell);
  attachImages(row,slot,event.dataTransfer.files,true).catch(showError);
});
