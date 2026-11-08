window.GDHomeProjects = (() => {
  const fields = {project:'Tên dự án',customer:'Tên khách hàng',address:'Địa chỉ',phone:'SĐT',email:'Email',contract:'Hợp đồng'};
  const {escape:html} = GDHomeShell;

  async function request(body) {
    const headers = {'Content-Type':'application/json'};
    try {
      const token = JSON.parse(localStorage.getItem('gdhome_session'))?.token;
      if (token) headers.Authorization = 'Bearer '+token;
    } catch { /* Other authentication modes do not require a Google session. */ }
    const key = localStorage.getItem('gdhome_app_key');
    if (key) headers['x-app-key'] = key;
    const response = await fetch('/api/projects',body ? {method:'POST',headers,body:JSON.stringify(body)} : {headers});
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không lưu được hồ sơ dự án.');
    if (body) {
      try { localStorage.setItem('gdhome-project-update',crypto.randomUUID()); } catch { /* Focus refresh still works. */ }
    }
    return result;
  }

  function open(profile,save) {
    const dialog = document.createElement('dialog');
    dialog.className = 'project-profile-dialog';
    dialog.setAttribute('aria-label','Hồ sơ dự án');
    document.body.append(dialog);
    GDHomeShell.dialog(dialog,'<h2>Hồ sơ dự án</h2><form class="project-profile-form">' +
      Object.entries(fields).map(([key,label]) => '<label>' + label + '<input name="' + key +
        '" value="' + html(profile[key]) + '" maxlength="' + (key === 'project' ? 200 : 500) + '"' +
        (key === 'project' ? ' required' : '') + '></label>').join('') +
      '<p role="status"></p><button class="btn btn-primary">Lưu hồ sơ</button></form>');
    const form = dialog.querySelector('.project-profile-form');
    form.onsubmit = async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const patch = Object.fromEntries(Object.entries(values).filter(([key,value]) => value !== (profile[key] || '')));
      if (!Object.keys(patch).length) return dialog.close();
      const button = form.querySelector('button');
      button.disabled = true;
      try { await save(patch); dialog.close(); }
      catch (error) { form.querySelector('[role=status]').textContent = error.message; button.disabled = false; }
    };
    dialog.addEventListener('close',() => dialog.remove(),{once:true});
    return dialog;
  }

  return {list:() => request(),save:body => request(body),open};
})();
