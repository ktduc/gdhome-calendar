const guestMaterialKey = 'gdhome_materials::guest';
const guestFlagKey = 'gdhome_guest';
let materialGuest = false;

function guestMaterialState() {
  try { return JSON.parse(localStorage.getItem(guestMaterialKey)) || {}; }
  catch { return {}; }
}

function readGuestSchedule() {
  try { return JSON.parse(localStorage.getItem('timeline_calendar_state::guest')); }
  catch { return null; }
}

function guestMaterialProjects() {
  const projects = readGuestSchedule()?.projectOwners;
  return projects?.length ? projects : [{id:'owner-1',name:'DỰ ÁN MỚI'}];
}

function guestMaterialSchedule() {
  const schedule = readGuestSchedule() || {};
  const calendars = new Map((schedule.calendars || []).map(calendar => [calendar.id,calendar]));
  const tasks = (schedule.tasks || []).filter(task => calendars.has(task.calendarId) && task.visibleOnBoard !== false)
    .map(task => ({id:task.id,title:task.title,start:task.startDate,calendarId:task.calendarId,
      projectId:calendars.get(task.calendarId).ownerId,stage:calendars.get(task.calendarId).name}));
  const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
  return {tasks,daysOffConfig:schedule.daysOffConfig,today:date.format(new Date()),soonDate:date.format(Date.now()+3*86400000)};
}

function saveGuestProjectOwners(projectOwners) {
  const schedule = readGuestSchedule() || {
    tasks:[],calendars:[{id:'cal-1',ownerId:'owner-1',name:'GIAI ĐOẠN 1',visible:true,color:'#cc0000'}],activeCalendarId:'cal-1'
  };
  localStorage.setItem('timeline_calendar_state::guest',JSON.stringify({...schedule,projectOwners}));
}

function openGuestMaterials() {
  materialGuest = true;
  localStorage.setItem(guestFlagKey,'1');
  const projects = guestMaterialProjects();
  const state = guestMaterialState();
  const profiles = {...state.profiles,...Object.fromEntries(projects.map(project => [project.id,{...project.profile,project:project.name}]))};
  return { _version:0,sheets:[],presets:{},library:[],columnWidths:{},viewSettings:{},
    ...state,projects,profiles,r2:false,schedule:guestMaterialSchedule(),signedRows:{} };
}

function saveGuestView(settings) {
  localStorage.setItem(guestMaterialKey,JSON.stringify({...guestMaterialState(),viewSettings:settings}));
}

function saveGuestMaterial(sheet,profilePatch) {
  const previous = guestMaterialState();
  const saved = structuredClone(sheet);
  saved.id ||= crypto.randomUUID();
  const sheets = [...(previous.sheets || []).filter(entry => entry.id !== saved.id),saved];
  const profiles = {...previous.profiles};
  if (profilePatch) profiles[saved.projectId] = {...profiles[saved.projectId],...profilePatch};
  const version = (previous._version || 0)+1;
  localStorage.setItem(guestMaterialKey,JSON.stringify({...previous,_version:version,sheets,profiles}));
  return { _version:version,sheet:saved,profiles };
}

function deleteGuestMaterial(id) {
  const previous = guestMaterialState();
  if (!previous.sheets?.some(item => item.id === id)) throw new Error('Không tìm thấy bản nháp trên máy.');
  const _version = (previous._version || 0)+1;
  const sheets = previous.sheets.filter(item => item.id !== id);
  localStorage.setItem(guestMaterialKey,JSON.stringify({...previous,_version,sheets}));
  return {_version,outcome:'deleted'};
}

async function saveGuestAsset(blob) {
  const bytes = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256',bytes);
  const name = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2,'0')).join('') +
    '.' + GDHomeImages.extension(blob.type);
  const key = 'gdhome-guest-material-asset:'+name;
  if (!localStorage.getItem(key)) {
    const encoded = await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    localStorage.setItem(key,encoded);
  }
  return name;
}

function guestMaterialAsset(name) {
  const encoded = localStorage.getItem('gdhome-guest-material-asset:'+name);
  if (!encoded) throw new Error('Không tìm thấy ảnh khách trên máy này.');
  return new Blob([Uint8Array.from(atob(encoded),char => char.charCodeAt(0))],{type:GDHomeImages.mimeFor(name)});
}


async function importGuestMaterials() {
  const previous = guestMaterialState();
  if (!previous.sheets?.length || !confirm('Chép các bảng Chốt mã đang làm ở chế độ khách vào tài khoản?')) return;
  const assets = new Map();
  async function upload(name) {
    if (!assets.has(name)) assets.set(name,await storeMaterialImage(guestMaterialAsset(name)));
    return assets.get(name);
  }
  for (const entry of [...previous.sheets]) {
    const draft = structuredClone(entry);
    const profile = { ...draft.meta,...previous.profiles?.[draft.projectId] };
    const name = guestMaterialProjects().find(project => project.id === draft.projectId)?.name || profile.project || draft.title;
    let project = materials.projects.find(item => item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (!project) {
      const created = await GDHomeProjects.save({create:true,profile:{...profile,project:name}});
      project = created.project;
      materials.projects.push(project);
    }
    delete draft.id;
    draft.projectId = project.id;
    for (const group of draft.groups) {
      delete group.taskId;
      delete group.calendarId;
      delete group.taskLinkMode;
      delete group.taskLinkScore;
      for (const row of group.rows) for (const list of [row.render,...row.options.map(option => option.images)]) {
        for (const image of list) {
          image.full = await upload(image.full);
          image.thumb = await upload(image.thumb);
        }
      }
    }
    const saved = await post('/api/materials',{_version:materials._version,sheet:draft});
    materials._version = saved._version;
    materials.sheets.push(saved.sheet);
    previous.sheets = previous.sheets.filter(item => item.id !== entry.id);
    localStorage.setItem(guestMaterialKey,JSON.stringify(previous));
  }
}
