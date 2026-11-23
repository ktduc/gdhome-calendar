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
  return profile;
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

module.exports = {projectList,profileFor,writeProjectProfile,withScheduleWrite,cleanProfile,projectFields};
