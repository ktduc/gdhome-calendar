const {randomUUID} = require('node:crypto');

// Hồ sơ dự án = 1 dòng của Bảng thống kê dự án (/thong-ke). Ngày dạng YYYY-MM-DD, số tiền / diện tích ghi số thô.
const projectFields = ['project','address','customer','phone','email','contract','buildingType',
  'representative','customerAddress','taxCode','contractNo','signedAt','area','designPrice','vat','designValue','constructionValue',
  'constructionSignedAt','furnishAt','designer3d','status3d','designerHskt','statusHskt','supervisor','contractor','stage',
  'materialsStatus','checkDo','note'];
const paymentFields = ['label','amount','milestone','paidAt'];

function cleanPayments(list) {
  return list.slice(0,12).filter(item => item && typeof item === 'object')
    .map(item => Object.fromEntries(paymentFields.map(field => [field,String(item[field] ?? '').trim().slice(0,200)])));
}
const scheduleQueues = new Map();

function withScheduleWrite(key,write) {
  const pending = (scheduleQueues.get(key) || Promise.resolve()).catch(() => {}).then(write);
  scheduleQueues.set(key,pending);
  return pending.finally(() => { if (scheduleQueues.get(key) === pending) scheduleQueues.delete(key); });
}

function cleanProfile(value) {
  const profile = Object.fromEntries(projectFields.filter(field => typeof value?.[field] === 'string')
    .map(field => [field,value[field].trim().slice(0,field === 'project' ? 200 : 500)]));
  if (Array.isArray(value?.payments)) profile.payments = cleanPayments(value.payments);
  // Giá trị các cột anh tự thêm ở Bảng thống kê (id cột -> chữ)
  if (value?.custom && typeof value.custom === 'object' && !Array.isArray(value.custom)) {
    profile.custom = Object.fromEntries(Object.entries(value.custom).filter(([id,v]) => /^c_[a-z0-9]{1,24}$/i.test(id) && typeof v === 'string')
      .slice(0,60).map(([id,v]) => [id,v.trim().slice(0,500)]));
  }
  return profile;
}

// Cấu hình cột của Bảng thống kê dự án (dùng chung mọi máy): thứ tự, độ rộng, ẩn/hiện, tên, cột tự thêm
const columnTypes = ['text','number','money','date','select','people','check'];
function cleanTableSchema(value) {
  const str = (v,max) => String(v ?? '').trim().slice(0,max);
  const custom = (Array.isArray(value?.custom) ? value.custom : []).slice(0,40)
    .filter(c => /^c_[a-z0-9]{1,24}$/i.test(c?.id) && columnTypes.includes(c.type) && str(c.label,60))
    .map(c => ({id:c.id,label:str(c.label,60),type:c.type,options:(Array.isArray(c.options) ? c.options : []).map(o => str(o,40)).filter(Boolean).slice(0,50)}));
  const columns = (Array.isArray(value?.columns) ? value.columns : []).slice(0,100)
    .filter(c => /^[a-z0-9_:]{1,40}$/i.test(c?.key))
    .map(c => ({key:c.key,...(str(c.label,60) ? {label:str(c.label,60)} : {}),...(Number(c.width) ? {width:Math.min(800,Math.max(60,Math.round(Number(c.width))))} : {}),hidden:c.hidden === true}));
  // Cột hiển thị riêng từng phần của bảng (THI CÔNG, THIẾT KẾ…): {id: {hidden:[key]}}
  const sections = Object.fromEntries(Object.entries(value?.sections && typeof value.sections === 'object' ? value.sections : {})
    .filter(([id,v]) => /^[a-z]{1,12}$/.test(id) && Array.isArray(v?.hidden)).slice(0,10)
    .map(([id,v]) => [id,{hidden:v.hidden.filter(k => /^[a-z0-9_:]{1,40}$/i.test(k)).slice(0,100)}]));
  // Lựa chọn có màu của cột Chọn 1 / Người (như Notion): {key: [{name, color}]}
  const colors = ['gray','brown','orange','yellow','green','blue','purple','pink','red'].flatMap(c => [c,c+'-d']);   // -d = hàng màu đậm
  const options = Object.fromEntries(Object.entries(value?.options && typeof value.options === 'object' ? value.options : {})
    .filter(([key,list]) => /^[a-z0-9_:]{1,40}$/i.test(key) && Array.isArray(list)).slice(0,60)
    .map(([key,list]) => [key,list.filter(o => str(o?.name,60)).slice(0,200).map(o => ({name:str(o.name,60),color:colors.includes(o.color) ? o.color : 'gray'}))]));
  return {columns,custom,sections,options};
}

// Xoá hẳn 1 dự án: hồ sơ + các lịch (giai đoạn) + công việc của dự án đó
async function deleteProject(store,key,projectId,confirmName,defaultSchedule) {
  return withScheduleWrite(key,async () => {
    const data = await store.get(key) || defaultSchedule();
    const owner = (data.projectOwners || []).find(entry => entry.id === projectId);
    if (!owner) throw Object.assign(new Error('Không tìm thấy dự án.'),{status:404});
    if (String(confirmName || '').trim() !== owner.name) throw Object.assign(new Error('Tên xác nhận không khớp tên dự án.'),{status:400});
    const calendarIds = new Set((data.calendars || []).filter(cal => cal.ownerId === projectId).map(cal => cal.id));
    const taskCount = (data.tasks || []).length;
    data.projectOwners = data.projectOwners.filter(entry => entry !== owner);
    data.calendars = (data.calendars || []).filter(cal => !calendarIds.has(cal.id));
    data.tasks = (data.tasks || []).filter(task => !calendarIds.has(task.calendarId));
    data._version = (data._version || 0)+1;
    data._updatedAt = new Date().toISOString();
    await store.put(key,data);
    return {removedTasks:taskCount-data.tasks.length};
  });
}

// Gộp dự án nguồn vào dự án đích: chuyển giai đoạn + việc trên Lịch, bảng Chốt mã; ô hồ sơ trống của đích lấy từ nguồn; xoá nguồn.
async function mergeProject(store,key,sourceId,targetId,defaultSchedule,materialKey) {
  if (!sourceId || sourceId === targetId) throw Object.assign(new Error('Chọn dự án khác để gộp vào.'),{status:400});
  const result = await withScheduleWrite(key,async () => {
    const data = await store.get(key) || defaultSchedule();
    const owners = data.projectOwners || [];
    const source = owners.find(entry => entry.id === sourceId), target = owners.find(entry => entry.id === targetId);
    if (!source || !target) throw Object.assign(new Error('Không tìm thấy dự án.'),{status:404});
    const from = source.profile || {}, to = target.profile ||= {};
    for (const [field,value] of Object.entries(from)) {
      if (field === 'custom') to.custom = {...value,...Object.fromEntries(Object.entries(to.custom || {}).filter(([,v]) => v))};
      else if (field === 'payments' && Array.isArray(value)) to.payments = [...(to.payments || []),...value];
      else if (to[field] == null || to[field] === '' || (Array.isArray(to[field]) && !to[field].length)) to[field] = value;
    }
    let moved = 0;
    for (const cal of data.calendars || []) if (cal.ownerId === sourceId) { cal.ownerId = targetId; moved++; }
    data.projectOwners = owners.filter(entry => entry !== source);
    data._version = (data._version || 0)+1;
    data._updatedAt = new Date().toISOString();
    await store.put(key,data);
    return {movedCalendars:moved,targetName:target.name};
  });
  if (materialKey) {
    const materials = await store.get(materialKey);
    const sheets = (materials?.sheets || []).filter(sheet => sheet.projectId === sourceId);
    if (sheets.length) {
      sheets.forEach(sheet => { sheet.projectId = targetId; });
      materials._version = (materials._version || 0)+1;
      materials._updatedAt = new Date().toISOString();
      await store.put(materialKey,materials);
    }
    result.movedSheets = sheets.length;
  }
  return result;
}

async function writeTableSchema(store,key,schema,defaultSchedule) {
  return withScheduleWrite(key,async () => {
    const data = await store.get(key) || defaultSchedule();
    data.projectTable = cleanTableSchema(schema);
    data._version = (data._version || 0)+1;
    data._updatedAt = new Date().toISOString();
    await store.put(key,data);
    return data.projectTable;
  });
}

function profileFor(owner,legacy = {}) {
  const oldSheets = (legacy.sheets || []).filter(sheet => sheet.projectId === owner.id);
  const fallback = Object.assign({},...oldSheets.map(sheet =>
    Object.fromEntries(Object.entries(cleanProfile(sheet.meta)).filter(([,value]) => value))));
  return {...fallback,...cleanProfile(legacy.profiles?.[owner.id]),...cleanProfile(owner.profile),project:owner.name};
}

function projectList(schedule,legacy) {
  return (schedule.projectOwners || []).map(owner => ({id:owner.id,name:owner.name,profile:profileFor(owner,legacy)}));
}

async function writeProjectProfile(store,key,body,defaultSchedule,legacy) {
  return withScheduleWrite(key,async () => {
    const data = await store.get(key) || defaultSchedule();
    const owners = data.projectOwners ||= [];
    const patch = cleanProfile(body.profile);
    let owner = owners.find(entry => entry.id === body.projectId);
    if (body.create === true) {
      if (!patch.project) throw Object.assign(new Error('Nhập tên dự án trước khi tạo.'),{status:400});
      owner = owners.find(entry => entry.name.trim().toLocaleLowerCase() === patch.project.toLocaleLowerCase());
      if (!owner) {
        owner = {id:'owner_'+randomUUID(),name:patch.project,collapsed:false};
        owners.push(owner);
        (data.calendars ||= []).push({id:'cal_'+randomUUID(),ownerId:owner.id,name:'GIAI ĐOẠN 1',visible:true,color:'#cc0000'});
      }
    }
    if (!owner) throw Object.assign(new Error('Không tìm thấy dự án Tiến độ.'),{status:404});
    if (Object.hasOwn(patch,'project') && !patch.project) throw Object.assign(new Error('Tên dự án không được trống.'),{status:400});
    const {project:name,...profile} = {...profileFor(owner,legacy),...patch};
    owner.name = name;
    owner.profile = profile;
    const previousVersion = data._version || 0;
    data._version = previousVersion+1;
    data._updatedAt = new Date().toISOString();
    await store.put(key,data);
    return {project:{id:owner.id,name,profile:{...profile,project:name}},profile:{...profile,project:name},previousVersion,version:data._version};
  });
}

module.exports = {projectList,profileFor,writeProjectProfile,withScheduleWrite,cleanProfile,projectFields,cleanTableSchema,writeTableSchema,deleteProject,mergeProject};
