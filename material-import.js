const importColumns = {
  group:['nhom','danh muc'], name:['hang muc','ten vat lieu','ten','danh muc'], room:['phong','vi tri'],
  render:['phoi canh 3d','phoi canh'], p1:['phuong an 1','pa1','pa 1','mau vat lieu'],
  p2:['phuong an 2','pa2','pa 2'], p3:['phuong an 3','pa3','pa 3'],
  spec:['chat lieu quy cach','chat lieu','quy cach','be mat'], qty:['khoi luong du kien','khoi luong','so luong'],
  unit:['don vi','dvt'], note:['ghi chu'], supplier:['nha thau thi cong don vi cung cap','ncc','nha cung cap','nha thau']
};
const importLabels = { group:'Nhóm', name:'Hạng mục', room:'Vị trí',render:'Phối cảnh 3D', p1:'PA1',p2:'PA2',p3:'PA3',spec:'Chất liệu / Quy cách',qty:'Khối lượng',unit:'Đơn vị',note:'Ghi chú',supplier:'NCC / Nhà thầu' };
const normalized = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
let xlsxPromise;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => { xlsxPromise = null; reject(new Error('Không tải được bộ đọc Excel. Kiểm tra kết nối.')); };
    document.head.append(script);
  });
  return xlsxPromise;
}
function parseCsv(text) {
  const first = text.split(/\r?\n/,1)[0];
  const sep = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i+1] === '"') { value += '"'; i++; }
    else if (c === '"' && (quoted || value === '')) quoted = !quoted;
    else if (!quoted && c === sep) { row.push(value); value = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i+1] === '\n') i++;
      rows.push([...row,value]); row = []; value = '';
    } else value += c;
  }
  if (quoted) throw new Error('CSV có dấu ngoặc kép chưa đóng.');
  if (row.length || value) rows.push([...row,value]);
  return rows;
}
function installImport() {
  byId('import-action').innerHTML = '<label class="button">Nhập Excel / CSV <input type="file" id="import-file" accept=".csv,.xlsx" hidden></label><span id="import-preview"></span>';
  byId('import-file').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 12*1024*1024) throw new Error('Chọn file ≤ 12 MB.');
      const tabs = new Map();
      if (/\.csv$/i.test(file.name)) tabs.set('CSV',parseCsv((await file.text()).replace(/^\uFEFF/,'')));
      else {
        const XLSX = await loadXlsx();
        const book = XLSX.read(await file.arrayBuffer());
        for (const tab of book.SheetNames) tabs.set(tab,XLSX.utils.sheet_to_json(book.Sheets[tab],{header:1,raw:false,defval:''}));
      }
      renderImport(tabs,file.name);
    } catch (error) { showError(error); }
    finally { event.target.value = ''; }
  };
}

function headerMap(rows,index) {
  const head = rows[index] || [];
  const below = rows[index+1] || [];
  const multi = below.some(value => ['phuong an 1','pa1','pa 1','phuong an 2','pa2','pa 2','phuong an 3','pa3','pa 3'].includes(normalized(value)));
  const labels = Array.from({length:Math.max(head.length,multi ? below.length : 0)},(_,i) => multi && below[i] ? below[i] : head[i]);
  return { labels, first:index+(multi?2:1) };
}
function renderImport(tabs, filename) {
  const root = byId('import-preview');
  const tab = [...tabs.keys()].find(name => normalized(name) !== 'du lieu dien san') || [...tabs.keys()][0];
  root.innerHTML = '<article><h3>Xem trước nhập ' + html(filename) + '</h3><label>Tab <select id="import-tab">' +
    [...tabs.keys()].map(name => option(name,name,tab)).join('') + '</select></label> <label>Dòng tiêu đề <input id="import-header" type="number" min="1" style="width:65px"></label><div id="import-mapping"></div><div id="import-sample"></div></article>';
  const tabSelect = byId('import-tab');
  const header = byId('import-header');
  function guess() {
    const rows = tabs.get(tabSelect.value);
    const index = rows.slice(0,30).findIndex(row => row.some(cell => importColumns.name.includes(normalized(cell))));
    header.value = Math.max(0,index)+1;
    mapping();
  }
  function mapping() {
    const rows = tabs.get(tabSelect.value);
    const { labels,first } = headerMap(rows,Math.max(0,Number(header.value)-1));
    byId('import-mapping').innerHTML = '<div class="toolbar">' + Object.entries(importLabels).map(([key,label]) => {
      const found = labels.findIndex(v => importColumns[key].includes(normalized(v)));
      return '<label>' + label + ' <select data-map="' + key + '"><option value="">Bỏ qua</option>' +
        labels.map((v,i) => option(String(i),(i+1)+' · '+(v || '(trống)'),String(found))).join('') + '</select></label>';
    }).join('') + '</div><button id="confirm-import" class="primary">Tạo bảng từ bản xem trước</button>';
    function convert() {
      const map = Object.fromEntries([...root.querySelectorAll('[data-map]')].map(select => [select.dataset.map,select.value]));
      const groups = [];
      let group;
      let skipped = 0, imageRefs = 0, count = 0;
      for (const cells of rows.slice(first)) {
        const val = key => map[key] === '' ? '' : String(cells[Number(map[key])] ?? '').trim();
        if (!cells.some(v => String(v).trim())) continue;
        const category = val('group');
        const name = val('name') || category;
        if (!name) { skipped++; continue; }
        const templateHeading = materialTemplate.some(([heading]) => normalized(heading) === normalized(name));
        const heading = category && map.name !== map.group ? category : templateHeading ? name : group?.name || 'DANH MỤC NHẬP';
        if (!group || group.name !== heading) { group = newGroup(heading); groups.push(group); }
        if (templateHeading && !['p1','p2','p3','qty','spec'].some(key => val(key))) continue;
        const row = newRow(name);
        for (const key of ['room','spec','qty','unit','note','supplier']) row[key] = val(key);
        for (const [i,key] of ['p1','p2','p3'].entries()) row.options[i].code = val(key);
        if (val('render') || row.options.some(pa => /^(https?:|=IMAGE)/i.test(pa.code))) imageRefs++;
        if (val('render')) row.note = [row.note,'Phối cảnh nguồn: '+val('render')].filter(Boolean).join(' · ');
        group.rows.push(row);
        count++;
        if (count > 500) throw new Error('Mỗi lần nhập tối đa 500 dòng.');
      }
      return { groups,count,skipped,imageRefs };
    }
    function preview() {
      try {
        const {groups,count,skipped,imageRefs} = convert();
        byId('import-sample').innerHTML = '<p>' + count + ' dòng · Bỏ qua ' + skipped + ' dòng thiếu tên · ' + imageRefs +
          ' dòng có tham chiếu ảnh. Ảnh nhúng/ảnh công thức cần kiểm tra và dán lại.</p><ol>' + groups.flatMap(g => g.rows.map(r => '<li>' +
          html([g.name,r.name,r.options[0].code,r.qty,r.unit].filter(Boolean).join(' · ')) + '</li>')).slice(0,6).join('') + '</ol>';
      } catch (error) { byId('import-sample').textContent = error.message; }
    }
    byId('import-mapping').onchange = preview;
    byId('confirm-import').onclick = () => {
      try {
        const {groups,count} = convert();
        if (!count) throw new Error('Không có dòng hợp lệ. Kiểm tra ánh xạ.');
        createSheet(byId('project-filter').value,filename.replace(/\.[^.]+$/,''),groups);
        if (!sheet) return;
        const presetTab = [...tabs.keys()].find(name => normalized(name) === 'du lieu dien san');
        if (!presetTab) return;
        const [head,...values] = tabs.get(presetTab);
        for (const [i,label] of (head || []).entries()) {
          const key = Object.keys(initialPresets).find(k => normalized(labelsForPreset(k)) === normalized(label) || importColumns[k]?.includes(normalized(label)));
          if (key) for (const row of values) learnPreset(key,String(row[i] ?? ''));
        }
      } catch (error) { showError(error); }
    };
    preview();
  }
  tabSelect.onchange = guess;
  header.onchange = mapping;
  guess();
}
function labelsForPreset(key) { return ({size:'Kích thước',finish:'Bề mặt',color:'Màu',supplier:'NCC',room:'Phòng',unit:'Đơn vị'})[key]; }

function librarySuggestions(key,q,pa) {
  if (!pa || !['brand','code','color','finish','size'].includes(key) || !q) return [];
  return materials.library.filter(item => normalized([item.name,item.brand,item.code,item.color,item.finish,item.size,item.supplier].join(' ')).includes(normalized(q)))
    .slice(0,6).map(item => ({ label:[item.code,item.brand,item.color,item.name].filter(Boolean).join(' · '),
      apply:field => {
        modify(() => Object.assign(pa,structuredClone(Object.fromEntries([...fields,'images'].map(name => [name,item[name]])))),false);
        if (field.closest('dialog')) {
          const {row,slot} = activeDetail;
          byId('material-dialog').close();
          editDetail(row,slot);
        } else {
          const {row,slot} = context(field);
          renderEditor();
          box().querySelector('[data-row="' + row.id + '"] [data-slot="' + slot + '"] input')?.focus({ preventScroll:true });
        }
      }
    }));
}
