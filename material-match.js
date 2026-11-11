// Suggestions are reviewed before assigning a library item to an option.
let materialMatchRunning = false;
function materialMatchKey() { return materialViewKey() + ':match:' + sheet.id; }
function materialMatchJob() {
  try { return JSON.parse(localStorage.getItem(materialMatchKey())) || {pending:[],results:{}}; }
  catch { return {pending:[],results:{}}; }
}
function saveMaterialMatchJob(job) { localStorage.setItem(materialMatchKey(),JSON.stringify(job)); }
async function materialMatchImage(row,bounds = {x:0,y:0,w:1,h:1}) {
  const source = row.render?.[0];
  const full = typeof source === 'string' ? source : source?.full;
  if (!full) throw new Error('Dòng này chưa có ảnh phối cảnh 3D.');
  const image = new Image();
  image.src = await GDHomeAssets.assetUrl(full);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image,image.naturalWidth*bounds.x,image.naturalHeight*bounds.y,
    image.naturalWidth*bounds.w,image.naturalHeight*bounds.h,0,0,384,384);
  return {data:canvas.toDataURL('image/jpeg',.85).split(',')[1],
    traits:GDHomeLibraryAttributes.estimatePhoto(ctx.getImageData(0,0,384,384).data,384,384)};
}
function rankMaterialMatches(items,traits,group,row) {
  const category = GDHomeAssets.categoryFor({categories:items.categories},group.name)?.id;
  const words = normalized([row.name,traits.material,traits.color,traits.tone,traits.grain,traits.size].join(' ')).split(/\s+/).filter(word => word.length > 1);
  return items.items.filter(item => !item.hidden && (!category || item.categoryId === category)).map(item => {
    const label = normalized([item.code,item.name,item.material,item.tone,item.grain,item.size,...(item.tags || []),...(item.sourceFacets || []).flatMap(group => group.values)].join(' '));
    const colors = (item.sourceFacets || []).filter(group => /mau|color/i.test(group.key)).flatMap(group => group.values);
    const colorMatch = traits.color && colors.some(color => normalized(color) === normalized(traits.color));
    const score = (colorMatch ? 6 : 0) + words.reduce((sum,word) => sum + (label.includes(word) ? 1 : 0),0) + (traits.tone && item.tone === traits.tone ? 3 : 0);
    return {id:item.id,score};
  }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id)).slice(0,6);
}
async function runMaterialMatches(targets,bounds) {
  if (materialMatchRunning) return say('Đang chạy đề xuất vật liệu.');
  const currentSheet = sheet;
  const key = materialMatchKey();
  const job = materialMatchJob();
  if (targets) job.pending = [...new Set([...job.pending,...targets.map(row => row.id)])];
  job.bounds ||= {};
  if (targets && bounds) for (const row of targets) job.bounds[row.id] = bounds;
  saveMaterialMatchJob(job);
  materialMatchRunning = true;
  const notice = message => GDHomeShell.aiNotice('material-match-job',{state:'running',body:html(message)});
  try {
    const library = await GDHomeAssets.loadLibrary();
    while (job.pending.length) {
      const id = job.pending[0];
      const group = currentSheet.groups.find(group => group.rows.some(row => row.id === id));
      const row = group?.rows.find(row => row.id === id);
      if (!row?.render?.length) { job.pending.shift(); localStorage.setItem(key,JSON.stringify(job)); continue; }
      notice('Đang tìm mẫu cho ' + (row.name || 'hạng mục') + ' · Còn ' + job.pending.length + ' dòng');
      const image = await materialMatchImage(row,job.bounds[id]);
      const result = await post('/api/ai/material-match',{name:row.name,group:group.name,images:[{mediaType:'image/jpeg',data:image.data}]});
      const traits = result.configured ? result.traits : image.traits;
      job.results[id] = {traits,matches:rankMaterialMatches(library,traits,group,row),method:result.configured ? 'AI' : 'Màu chủ đạo'};
      job.pending.shift();
      localStorage.setItem(key,JSON.stringify(job));
    }
    GDHomeShell.aiNotice('material-match-job',{state:'done',body:'Đã có đề xuất vật liệu.',label:'Duyệt đề xuất',onAction:async () => {
      if (sheet?.id !== currentSheet.id) { await flushSave(); if (dirty || saving || conflict) return; openSheet(materials.sheets.find(item => item.id === currentSheet.id)); }
      reviewMaterialMatches();
    }});
  } catch (error) {
    GDHomeShell.aiNotice('material-match-job',{state:'error',body:html(error.message),label:'Tiếp tục',onAction:async () => {
      if (sheet?.id !== currentSheet.id) { await flushSave(); if (dirty || saving || conflict) return; openSheet(materials.sheets.find(item => item.id === currentSheet.id)); }
      runMaterialMatches();
    }});
  } finally { materialMatchRunning = false; }
}
async function reviewMaterialMatches() {
  const library = await GDHomeAssets.loadLibrary();
  const job = materialMatchJob();
  const element = dialog('<h2>Đề xuất mẫu vật liệu</h2>' + Object.entries(job.results).map(([id,result]) => {
    const row = sheet.groups.flatMap(group => group.rows).find(row => row.id === id);
    if (!row) return '';
    return '<section data-match-row="' + html(id) + '"><h3>' + html(row.name) + '</h3><p>' + html(result.method + ' · ' + Object.values(result.traits).filter(Boolean).join(' · ')) + '</p><div class="material-match-grid">' +
      result.matches.map(({id}) => library.items.find(item => item.id === id)).filter(Boolean).map(item =>
        '<article>' + (item.thumb ? '<img data-lib-asset="' + html(item.thumb) + '" alt="">' : '') + '<strong>' + html(item.code || item.name) + '</strong><p>' +
        [0,1,2].map(slot => '<button type="button" data-match-item="' + html(item.id) + '" data-match-slot="' + slot + '">Gán PA' + (slot+1) + '</button>').join(' ') + '</p></article>').join('') + '</div></section>';
  }).join('') + (job.pending.length ? '<button type="button" data-match-resume>Tiếp tục ' + job.pending.length + ' dòng</button>' : ''));
  element.addEventListener('close',() => { if (sheet) renderEditor(); },{once:true});
  GDHomeAssets.hydrate(element);
  element.querySelectorAll('[data-match-item]').forEach(button => button.onclick = () => {
    const id = button.closest('[data-match-row]').dataset.matchRow;
    const row = sheet.groups.flatMap(group => group.rows).find(row => row.id === id);
    const item = library.items.find(item => item.id === button.dataset.matchItem);
    if (!row || !item) return;
    applyLibraryMaterial(row,button.dataset.matchSlot,item,false);
    button.textContent = 'Đã gán PA' + (Number(button.dataset.matchSlot)+1);
  });
  const resume = element.querySelector('[data-match-resume]');
  if (resume) resume.onclick = () => { element.close(); runMaterialMatches(); };
}
function openMaterialMatch(row) {
  const element = dialog('<h2>Tìm mẫu từ ảnh 3D</h2><p>' + html(row.name) + '</p><p>Chọn vùng vật liệu theo phần trăm ảnh. Mặc định dùng toàn ảnh.</p>' +
    '<form data-match-crop>' + [['x','Trái',0],['y','Trên',0],['w','Rộng',100],['h','Cao',100]].map(([key,label,value]) =>
      '<label>' + label + ' (%) <input name="' + key + '" type="number" min="' + (key === 'w' || key === 'h' ? 1 : 0) + '" max="100" value="' + value + '" required></label>').join('') +
    '<button class="primary">Tìm 3–6 mẫu</button><button type="button" data-match-review>Duyệt kết quả đã có</button></form>');
  element.querySelector('[data-match-review]').onclick = () => { element.close(); reviewMaterialMatches().catch(showError); };
  element.querySelector('[data-match-crop]').onsubmit = event => {
    event.preventDefault();
    const bounds = Object.fromEntries([...new FormData(event.target)].map(([key,value]) => [key,Number(value)/100]));
    bounds.w = Math.min(bounds.w,1-bounds.x); bounds.h = Math.min(bounds.h,1-bounds.y);
    if (!bounds.w || !bounds.h) return;
    element.close(); runMaterialMatches([row],bounds);
  };
}
document.addEventListener('click',event => {
  const button = event.target.closest('[data-material-match]');
  if (!button || !sheet) return;
  event.preventDefault(); event.stopPropagation();
  const {row,group} = context(button);
  if (row) openMaterialMatch(row);
  else if (button.dataset.materialMatch === 'review') reviewMaterialMatches().catch(showError);
  else runMaterialMatches(group ? group.rows : sheet.groups.flatMap(group => group.rows));
});
