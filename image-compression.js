/* Shared by Chốt mã and Quản lý dự án. Do not re-encode PDFs. */
window.GDHomeImages = (() => {
  const extensions = {'image/webp':'webp','image/jpeg':'jpg','image/png':'png'};
  const extension = mime => extensions[mime];
  const mimeFor = name => Object.keys(extensions).find(mime => name.endsWith('.'+extension(mime)));
  const isAssetName = name => typeof name === 'string' && /^[a-f0-9]{64}\.(webp|jpg|png)$/.test(name);
  const toBlob = (canvas,type,quality) => new Promise((resolve,reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('Không nén được ảnh.'));
  },type,quality));

  async function compress(source,crop = null) {
    const bitmap = await createImageBitmap(source);
    try {
      const [left,top,right,bottom] = crop || [0,0,1,1];
      const x = Math.floor(left*bitmap.width), y = Math.floor(top*bitmap.height);
      const w = Math.ceil(right*bitmap.width)-x, h = Math.ceil(bottom*bitmap.height)-y;
      async function encode(maxSide) {
        const scale = Math.min(1,maxSide/Math.max(w,h));
        const canvas = document.createElement('canvas');
        const width = Math.max(1,Math.round(w*scale));
        const height = Math.max(1,Math.round(h*scale));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d',{willReadFrequently:source.type !== 'image/jpeg'});
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap,x,y,w,h,0,0,width,height);
        let transparent = false;
        if (source.type !== 'image/jpeg') {
          const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 255) { transparent = true; break; }
          }
        }
        if (transparent && !crop && scale === 1 && source.type === 'image/png') return source;
        let encoded = await toBlob(canvas,transparent ? 'image/png' : 'image/webp',0.8);
        if (!transparent && encoded.type !== 'image/webp') encoded = await toBlob(canvas,'image/jpeg',0.82);
        if (!crop && scale === 1 && extension(source.type) && encoded.size >= source.size) return source;
        return encoded;
      }
      const full = await encode(1600);
      const thumb = Math.max(w,h) > 480 ? await encode(480) : full;
      return {full,thumb};
    } finally {
      bitmap.close();
    }
  }

  function applyPadding(image) {
    if (image.dataset.display !== 'pad' || !image.naturalWidth || image.naturalWidth === image.naturalHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,16,16);
    ctx.drawImage(image,0,0,16,16);
    const pixels = ctx.getImageData(0,0,16,16).data;
    const edge = [[],[],[]];
    for (let row=0; row<16; row++) for (let col=0; col<16; col++) {
      if (row && col && row<15 && col<15) continue;
      for (let channel=0; channel<3; channel++) edge[channel].push(pixels[(row*16+col)*4+channel]);
    }
    image.parentElement?.style.setProperty('--pad-color','rgb(' + edge.map(values => values.sort((a,b) => a-b)[Math.floor(values.length/2)]).join(',') + ')');
  }

  const sizeFormat = new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1});
  function size(bytes) {
    const [factor,unit] = bytes >= 1048576 ? [1048576,'MB'] : bytes >= 1024 ? [1024,'KB'] : [1,'B'];
    return sizeFormat.format(bytes/factor) + ' ' + unit;
  }
  const reduction = (source,full) => size(source.size) + ' → ' + size(full.size);
  return {compress,reduction,extension,mimeFor,isAssetName,applyPadding};
})();
