/* Đọc catalogue PDF (An Cường, Phảo, bảng giá…): tìm mã, nhãn, giá và cắt ô mẫu vật liệu.
   Tách từ asset-library.js; phải nạp TRƯỚC asset-library.js. */
window.GDHomeCataloguePdf = (() => {
  const clampView = (...args) => window.GDHomeAssets.clampView(...args);
  const attributeCatalog = () => window.GDHomeLibraryAttributes;
  const duplicateCode = code => String(code || '').normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/đ/gi,'d').toLowerCase().replace(/[\s\p{Pd}]+/gu,'');

  const woodPatterns = [
    '\\b\\d{3,4}\\s?[A-Z]{1,3}\\b', '\\bMS\\s?\\d{3,4}\\b',
    '\\b[A-Z]{1,3}\\s?\\d{3,4}(\\s?[A-Z]{1,3})?\\b', '\\b\\d{9}\\b'
  ];
  const catalogueKey = item => (item.brand || 'An Cường').trim().toLowerCase() + ':' + item.code.toUpperCase().replace(/\s+/g,'');
  const bounded = (value,min,max) => Math.max(min,Math.min(max,value));
  const anCuongCode = /^(MFC|MDF|HDF|LAM(?:INATE)?|ACR(?:YLIC)?|VENEER)\s*[-–]?\s*((?:[A-Z]{1,4}\s*)?\d{2,5}(?:[.-]\d+)?)\s+([A-Z][A-Z0-9]{0,7})\b/i;
  // A finder has a dark/light/dark/light/dark sequence of 1:1:3:1:1
  // through its center. Require a vertical crossing and two matching neighbors.
  function qrFinderBoxes({data,width,height}) {
    const dark = new Uint8Array(width*height);
    for (let i=0; i<dark.length; i++) dark[i] = Number(data[i*4]+data[i*4+1]+data[i*4+2] < 270);
    const finders = [];
    function scan(length,pixel,onFinder) {
      const runs = [];
      let start = 0, color = pixel(0);
      for (let i=1; i<=length; i++) {
        const next = i < length ? pixel(i) : -1;
        if (next === color) continue;
        runs.push(i-start);
        if (runs.length > 5) runs.shift();
        if (color && runs.length === 5) {
          const module = runs.reduce((sum,n) => sum+n,0)/7;
          if (module >= 1 && runs.every((n,j) => Math.abs(n/module-(j === 2 ? 3 : 1)) <= .65)) {
            onFinder(i-runs[4]-runs[3]-runs[2]/2,module);
          }
        }
        color = next;
        start = i;
      }
    }
    for (let y=0; y<height; y++) scan(width,x => dark[y*width+x],(x,module) => {
      const known = finders.find(p => Math.abs(p.x-x) < module && Math.abs(p.y-y) < module*2);
      if (known) return;
      const column = Math.floor(x), top = Math.max(0,y-Math.ceil(module*6));
      scan(Math.min(height-top,Math.ceil(module*12)),j => dark[(top+j)*width+column],(middle,vertical) => {
        if (Math.abs(top+middle-y) <= module*1.5 && Math.abs(vertical/module-1) <= .35) {
          finders.push({x,y:top+middle,module:(module+vertical)/2});
        }
      });
    });
    const boxes = [];
    for (const corner of finders) {
      const {x,y,module} = corner;
      const same = p => Math.abs(p.module/module-1) <= .25;
      const across = finders.filter(p => same(p) && p.x-x >= module*12 && p.x-x <= module*175 &&
        Math.abs(p.y-y) <= module*1.5).sort((a,b) => a.x-b.x);
      for (const right of across) {
        const span = right.x-x;
        const down = finders.find(p => same(p) && Math.abs(p.x-x) <= module*1.5 && Math.abs(p.y-y-span) <= module*2);
        if (!down) continue;
        const version = (span/module-14)/4;
        if (Math.abs(version-Math.round(version)) > .45) continue;
        boxes.push({x:x-module*3.5,y:y-module*3.5,w:span+module*7,h:down.y-y+module*7});
        break;
      }
    }
    return boxes;
  }

  async function catalogueQrBoxes(context,width,height) {
    const boxes = [];
    if (window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector({formats:['qr_code']});
        for (const {boundingBox:{x,y,width:w,height:h}} of await detector.detect(context.canvas)) boxes.push({x,y,w,h});
      } catch {
        // Some platforms expose the API without a working QR detector.
      }
    }
    for (const box of qrFinderBoxes(context.getImageData(0,0,width,height))) {
      if (boxes.some(other => Math.abs(other.x-box.x) < box.w*.35 && Math.abs(other.y-box.y) < box.h*.35)) continue;
      boxes.push(box);
    }
    return boxes;
  }
  function anCuongCrop(context,left,top,right,bottom) {
    left = Math.max(0,Math.floor(left)); top = Math.max(0,Math.floor(top));
    const width = Math.max(1,Math.floor(right)-left), height = Math.max(1,Math.floor(bottom)-top);
    const pixels = context.getImageData(left,top,width,height).data;
    const visible = index => pixels[index+3] > 0 && Math.min(pixels[index],pixels[index+1],pixels[index+2]) < 244;
    let start = 0, best = [0,0];
    for (let y=0; y<=height; y++) {
      let count = 0;
      if (y < height) for (let x=0; x<width; x+=2) if (visible((y*width+x)*4)) count++;
      if (count >= width*.17) continue;
      if (y-start > best[1]-best[0]) best = [start,y];
      start = y+1;
    }
    if (best[1]-best[0] < 3) return null;
    let minX = width, maxX = 0, brightness = 0, count = 0;
    for (let y=best[0]; y<best[1]; y++) for (let x=0; x<width; x++) {
      const index = (y*width+x)*4;
      if (!visible(index)) continue;
      minX = Math.min(minX,x); maxX = Math.max(maxX,x);
      brightness += .2126*pixels[index]+.7152*pixels[index+1]+.0722*pixels[index+2];
      count++;
    }
    const light = brightness/count;
    return {x:left+minX,y:top+best[0],w:maxX-minX+1,h:best[1]-best[0],tone:light >= 170 ? 'Sáng' : light < 95 ? 'Tối' : 'Trung tính'};
  }

  function anCuongLabel(text,name = '') {
    const parsed = text.match(anCuongCode);
    return parsed ? {code:parsed[2].toUpperCase(),name,material:parsed[1].toUpperCase(),finish:parsed[3].toUpperCase(),
      confidence:.9,needsReview:false} : {code:text,name,confidence:.35,needsReview:true};
  }

  async function anCuongSwatches(context,canvas,labels,includeCode) {
    const {width,height} = canvas;
    const boxes = (await catalogueQrBoxes(context,width,height)).sort((a,b) => a.y-b.y || a.x-b.x);
    const candidates = boxes.flatMap(qr => {
      const right = Math.min(width,qr.x+qr.w*1.08), left = Math.max(0,right-qr.w*3.8);
      const band = labels.filter(label => label.x >= left && label.x < qr.x &&
        label.y >= qr.y-qr.h*.45 && label.y <= qr.y+qr.h);
      const labelTop = band.reduce((top,label) => Math.min(top,label.y-label.height),qr.y);
      const previous = boxes.filter(box => box.y < qr.y-qr.h && Math.abs(box.x-qr.x) < qr.w)
        .reduce((top,box) => Math.max(top,box.y+box.h),0);
      const box = anCuongCrop(context,left,Math.max(previous,labelTop-qr.w*6.5),right,labelTop);
      if (!box || box.h/box.w < 1.15 || box.h/box.w > 2.3 || box.w < qr.w*1.7 ||
          Math.abs(box.x+box.w-(qr.x+qr.w)) > qr.w*.45 ||
          qr.y-box.y-box.h > qr.h*.75) return [];
      const lines = [];
      for (const part of band.filter(label => label.x >= box.x-qr.w*.15 && label.y > box.y+box.h)
        .sort((a,b) => a.y-b.y || a.x-b.x)) {
        const line = lines.find(row => Math.abs(row.y-part.y) < part.height*.45);
        if (line) line.parts.push(part);
        else lines.push({y:part.y,parts:[part]});
      }
      const [text='',name=''] = lines.map(line => line.parts.sort((a,b) => a.x-b.x).map(part => part.text).join(' '));
      const bottom = Math.min(height,qr.y+qr.h+box.h*.02);
      return [{box,bottom,label:anCuongLabel(text,name)}];
    });
    const ratios = candidates.map(({box,bottom}) => (bottom-box.y)/box.w).sort((a,b) => a-b);
    const ratio = (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.floor(ratios.length/2)])/2;
    return candidates.map(({box,bottom,label}) => {
      const w = box.w, h = includeCode ? Math.min(height-box.y,Math.max(bottom-box.y,Math.round(w*ratio))) : box.h;
      return {...label,qr:true,tone:box.tone,grain:'Gỗ',...(includeCode ? {view:clampView({x:.5,y:box.h/(2*h),z:1},w/h)} : {}),
        crop:{x:box.x/width,y:box.y/height,w:w/width,h:h/height}};
    });
  }

  const kitchenSubgroups = ['Giá bát đĩa nâng hạ','Giá bát đĩa','Giá xoong nồi','Giá dao thớt gia vị','Thùng gạo','Thùng rác',
    'Tủ đồ khô','Góc liên hoàn','Ray / bản lề','Tay nâng'];
  function catalogueGuideRatio(guide) {
    const ratios = (guide?.examples || []).filter(example => example.crop).map(({aspect,crop}) => aspect*crop.w/crop.h).sort((a,b) => a-b);
    return ratios.length ? (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.floor(ratios.length/2)])/2 : 0;
  }
  function fitCatalogueCrop(box,ratio) {
    if (!ratio) return box;
    const w = Math.min(1,ratio,Math.sqrt(box.w*box.h*ratio)), h = w/ratio;
    return {x:bounded(box.x+(box.w-w)/2,0,1-w),y:bounded(box.y+(box.h-h)/2,0,1-h),w,h};
  }
  function includeCatalogueCode(crop,codeBox) {
    if (!codeBox) return crop;
    const x = bounded(Math.min(crop.x,codeBox.x),0,1), y = bounded(Math.min(crop.y,codeBox.y),0,1);
    const right = bounded(Math.max(crop.x+crop.w,codeBox.x+codeBox.w),x,1);
    const bottom = bounded(Math.max(crop.y+crop.h,codeBox.y+codeBox.h),y,1);
    return {x,y,w:right-x,h:bottom-y};
  }
  function pdfLabelCrop(label,canvas) {
    const pad = label.height*.25;
    return {x:(label.x-pad)/canvas.width,y:(label.y-label.height-pad)/canvas.height,
      w:(label.width+2*pad)/canvas.width,h:(label.height+2*pad)/canvas.height};
  }

  const middleValue = values => {
    const sorted = [...values].sort((a,b) => a-b);
    return sorted.length ? (sorted[(sorted.length-1)>>1]+sorted[sorted.length>>1])/2 : 0;
  };
  function catalogueImageBounds(left,top,right,bottom,width,height,phao = false) {
    const x = Math.max(0,left), y = Math.max(0,top);
    const w = Math.min(right,width)-x, h = Math.min(bottom,height)-y;
    const ratio = w/h, fraction = w*h/(width*height);
    const inRange = phao ? ratio >= .15 && ratio <= 22 && fraction >= .00015 : ratio >= .3 && ratio <= 3 && fraction >= .005;
    return w > 0 && h > 0 && inRange && fraction < .85 ? {x,y,w,h} : null;
  }
  async function embeddedCatalogueImages(page,viewport,pdfjs,phao = false,acceptImage = () => true) {
    const {fnArray,argsArray} = await page.getOperatorList();
    const {OPS,Util} = pdfjs;
    const stack = [], images = [];
    let transform = [1,0,0,1,0,0];
    function add(matrix) {
      const [a,b,c,d,x,y] = Util.transform(viewport.transform,matrix);
      const xs = [x,x+a,x+c,x+a+c], ys = [y,y+b,y+d,y+b+d];
      const box = catalogueImageBounds(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys),viewport.width,viewport.height,phao);
      if (box) images.push(box);
    }
    for (const [i,op] of fnArray.entries()) {
      const args = argsArray[i];
      if (op === OPS.save || op === OPS.paintFormXObjectBegin) {
        stack.push(transform);
        if (op === OPS.paintFormXObjectBegin && args?.[0]?.length === 6) transform = Util.transform(transform,args[0]);
      } else if (op === OPS.restore || op === OPS.paintFormXObjectEnd) {
        transform = stack.pop() || transform;
      } else if (op === OPS.transform) {
        transform = Util.transform(transform,args);
      } else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) {
        let image;
        try { image = op === OPS.paintInlineImageXObject ? args[0] : page.objs.get(args[0]); } catch { /* Some shared images live in commonObjs. */ }
        if (acceptImage(image,args[0])) add(transform);
      } else if (op === OPS.paintImageXObjectRepeat) {
        const [,sx,sy,positions] = args;
        for (let j=0;j<positions.length;j+=2) add(Util.transform(transform,[sx,0,0,sy,positions[j],positions[j+1]]));
      }
    }
    return images;
  }
  function rasterCatalogueImages(context,canvas,phao = false) {
    const {width,height} = canvas;
    const pixels = context.getImageData(0,0,width,height).data;
    const channels = [[],[],[]];
    function sample(x,y) {
      const p = (y*width+x)*4;
      for (let i=0;i<3;i++) channels[i].push(pixels[p+i]);
    }
    for (let i=0;i<64;i++) {
      const x = Math.floor(i*(width-1)/63), y = Math.floor(i*(height-1)/63);
      sample(x,0); sample(x,height-1); sample(0,y); sample(width-1,y);
    }
    const [r,g,b] = channels.map(middleValue);
    const lightOnDark = phao && (r+g+b)/3 < 150;
    const foreground = new Uint8Array(width*height);
    for (let i=0,p=0;i<foreground.length;i++,p+=4) {
      const different = lightOnDark ? Math.min(pixels[p],pixels[p+1],pixels[p+2]) > 120 &&
        Math.max(pixels[p],pixels[p+1],pixels[p+2])-Math.min(pixels[p],pixels[p+1],pixels[p+2]) < 80 :
        Math.max(Math.abs(pixels[p]-r),Math.abs(pixels[p+1]-g),Math.abs(pixels[p+2]-b)) > 30;
      if (pixels[p+3] > 0 && different) foreground[i] = 1;
    }
    const queue = new Int32Array(foreground.length), images = [];
    function push(pixel,index) {
      if (!foreground[pixel]) return index;
      foreground[pixel] = 0;
      queue[index] = pixel;
      return index+1;
    }
    for (let i=0;i<foreground.length;i++) {
      if (!foreground[i]) continue;
      let end = push(i,0), left = width, right = 0, top = height, bottom = 0, sum = 0, squares = 0;
      for (let next=0;next<end;next++) {
        const p = queue[next], x = p%width, y = Math.floor(p/width), offset = p*4;
        left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y);
        const value = (pixels[offset]+pixels[offset+1]+pixels[offset+2])/3;
        sum += value; squares += value*value;
        if (x > 0) end = push(p-1,end);
        if (x+1 < width) end = push(p+1,end);
        if (y > 0) end = push(p-width,end);
        if (y+1 < height) end = push(p+width,end);
      }
      const box = catalogueImageBounds(left,top,right+1,bottom+1,width,height,phao);
      if (!box) continue;
      const density = end/(box.w*box.h), variance = squares/end-(sum/end)**2;
      // A vector swatch can be a single flat colour. Require an almost solid rectangle in that case.
      if (phao ? density >= .35 : density >= .85 && (variance >= 16 || density >= .97)) images.push(box);
    }
    return images;
  }
  const intersection = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) *
    Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const relativeCrop = ({x,y,w,h},canvas) => ({x:x/canvas.width,y:y/canvas.height,w:w/canvas.width,h:h/canvas.height});
  function catalogueTextBounds(item,viewport,pdfjs,width,height) {
    const [a,b,c,d,x,y] = pdfjs.Util.transform(viewport.transform,item.transform);
    const along = Math.hypot(a,b) || 1, up = Math.hypot(c,d) || 1;
    const dx = a/along*width, dy = b/along*width, ux = c/up*height, uy = d/up*height;
    const xs = [x-ux*.22,x+ux,x+dx-ux*.22,x+dx+ux], ys = [y-uy*.22,y+uy,y+dy-uy*.22,y+dy+uy];
    const left = Math.min(...xs), top = Math.min(...ys);
    return {x:left,y:top,w:Math.max(...xs)-left,h:Math.max(...ys)-top};
  }
  const cataloguePricePattern = /(?:\b(?:đơn\s+)?giá\s*[:=]?\s*)([\d][\d.,\u00a0 ]*)(?:\s*(?:₫|VNĐ|VND))?|([\d][\d.,\u00a0 ]*)\s*(?:₫|VNĐ|VND)(?=$|[\s/;,])/i;
  function cataloguePrice(label,labels) {
    const match = label.text.match(cataloguePricePattern) || labels.find(other => other !== label && other.x > label.x &&
      other.x-label.x-label.width < label.height*4 && Math.abs(other.y-label.y) <= label.height*.5 &&
      cataloguePricePattern.test(other.text))?.text.match(cataloguePricePattern);
    if (!match) return {};
    const price = attributeCatalog().parsePrice(match[1] || match[2]);
    const priceUnit = match.input.slice(match.index+match[0].length).match(/^\s*\/\s*(m²|m2|viên|bộ|md|tấm|cái)(?=$|[\s;,])/i)?.[1];
    return price === undefined ? {} : {price,priceUnit};
  }
  async function matchCatalogueCrops(page,viewport,pdfjs,context,canvas,matches,labels) {
    const embedded = await embeddedCatalogueImages(page,viewport,pdfjs);
    const images = [...embedded,...rasterCatalogueImages(context,canvas).filter(box =>
      !embedded.some(image => intersection(image,box) >= .6*Math.min(image.w*image.h,box.w*box.h)))];
    const pairs = [];
    for (const label of matches) {
      const text = label.box;
      for (const image of images) {
        const xOverlap = Math.min(text.x+text.w,image.x+image.w)-Math.max(text.x,image.x);
        const yOverlap = Math.min(text.y+text.h,image.y+image.h)-Math.max(text.y,image.y);
        const gaps = [text.y-image.y-image.h,image.y-text.y-text.h,text.x-image.x-image.w];
        const aligned = [xOverlap >= Math.min(text.w,image.w)*.2,xOverlap >= Math.min(text.w,image.w)*.2,
          yOverlap >= Math.min(text.h,image.h)*.4];
        const side = gaps.findIndex((gap,i) => aligned[i] && gap >= -text.h*.4 && gap <= Math.max(text.h*3,(i === 2 ? image.w : image.h)*.35));
        if (side < 0) continue;
        const centerDistance = side === 2 ? Math.abs(text.y+text.h/2-image.y-image.h/2) :
          Math.abs(text.x+text.w/2-image.x-image.w/2);
        pairs.push({label,image,side,gap:Math.max(0,gaps[side]),centerDistance});
      }
    }
    const offsets = [0,1,2].map(side => middleValue(matches.flatMap(label => {
      const gaps = pairs.filter(pair => pair.label === label && pair.side === side).map(pair => pair.gap);
      return gaps.length ? [Math.min(...gaps)] : [];
    })));
    const score = pair => pair.gap+Math.abs(pair.gap-offsets[pair.side])*.25+pair.centerDistance*.12;
    pairs.sort((a,b) => a.side-b.side || score(a)-score(b));
    const chosen = new Map(), used = new Set();
    for (const {label,image} of pairs) {
      if (!chosen.has(label) && !used.has(image)) { chosen.set(label,image); used.add(image); }
    }
    return matches.map(label => {
      const image = chosen.get(label);
      const size = label.text.match(/\b\d{2,4}\s*[x×*]\s*\d{2,4}(?:\s*(?:cm|mm))?\b/i)?.[0] || '';
      const name = label.name.replace(cataloguePricePattern,'').replace(/\s*\/\s*(?:m²|m2|viên|bộ|md|tấm|cái)\s*$/i,'').trim();
      const metadata = {code:label.code,name,size,...cataloguePrice(label,labels)};
      if (!image) return {...metadata,crop:{x:0,y:0,w:1,h:1},confidence:0,needsReview:true,unmatched:true};
      const inset = {x:image.x+1,y:image.y+1,w:image.w-2,h:image.h-2};
      const needsReview = inset.w*inset.h < image.w*image.h*.97 || labels.some(text => intersection(inset,text.box) > 0);
      return {...metadata,crop:relativeCrop(needsReview ? image : inset,canvas),confidence:needsReview ? .45 : .95,needsReview};
    });
  }

  function phaoCode(text) {
    const found = String(text).match(/(?<![A-Z0-9])[A-Z]{1,4}[\s.\-_]{0,2}\d{3,8}[A-Z0-9]{0,3}(?![A-Z0-9])/i)?.[0];
    return found?.replace(/[\s.\-_]/g,'').toUpperCase();
  }

  // Mã bị tách thành nhiều mảnh chữ (vd "PC" + "1234") được gộp lại khi cùng dòng và sát nhau.
  function mergePhaoLabels(labels) {
    for (let i=0;i<labels.length;i++) {
      const a = labels[i];
      if (phaoCode(a.text)) continue;
      const b = labels.find((other,j) => j !== i && Math.abs(other.y-a.y) <= a.height*.5 &&
        other.x >= a.x+a.width-2 && other.x-a.x-a.width <= a.height*1.2);
      const text = b && (a.text + ' ' + b.text);
      if (!b || !phaoCode(text) || phaoCode(b.text)) continue;
      const x = Math.min(a.box.x,b.box.x), y = Math.min(a.box.y,b.box.y);
      a.text = text;
      a.width = b.x+b.width-a.x;
      a.box = {x,y,w:Math.max(a.box.x+a.box.w,b.box.x+b.box.w)-x,h:Math.max(a.box.y+a.box.h,b.box.y+b.box.h)-y};
      labels.splice(labels.indexOf(b),1);
      i = -1;
    }
  }

  async function matchPhaoCrops(page,viewport,pdfjs,context,canvas,matches,labels,includeCode) {
    const embedded = await embeddedCatalogueImages(page,viewport,pdfjs,true);
    const components = rasterCatalogueImages(context,canvas,true);
    const endX = box => box.x+box.w;
    const endY = box => box.y+box.h;
    const centerX = box => box.x+box.w/2;
    const horizontal = box => box.w/box.h >= 2.7 && box.w >= canvas.width*.14;
    const bars = components.filter(horizontal);
    const imageBoxes = [...bars,...embedded.filter(image => horizontal(image) && !bars.some(box => intersection(image,box) >= box.w*box.h*.5))];
    const byColumn = [...matches].sort((a,b) => centerX(a.box)-centerX(b.box));
    const columns = [];
    for (const label of byColumn) {
      const column = columns.at(-1);
      if (column && centerX(label.box)-centerX(column[0].box) < canvas.width*.11) column.push(label);
      else columns.push([label]);
    }
    const rowFor = new Map();
    for (const column of columns) {
      column.sort((a,b) => a.y-b.y);
      for (const [index,label] of column.entries()) {
        const previous = column[index-1];
        const top = previous ? previous.y+previous.height*.08 : 0;
        rowFor.set(label,{top,bottom:Math.min(canvas.height,endY(label.box)+label.height*.35)});
      }
    }
    let pixels;
    function rowBar(label) {
      if (!pixels) return;
      const row = rowFor.get(label), cx = Math.round(centerX(label.box));
      const left = Math.max(0,cx-Math.round(canvas.width*.23)), right = Math.min(canvas.width,cx+Math.round(canvas.width*.23));
      const top = Math.max(Math.ceil(row.top),Math.floor(label.box.y-canvas.height*.12));
      const bottom = Math.min(canvas.height,Math.ceil(label.box.y+label.height*.25));
      const minRun = canvas.width*.13;
      const runs = [];
      for (let y=top;y<bottom;y++) {
        let start = left, last = left-10;
        for (let x=left;x<right;x++) {
          const p = (y*canvas.width+x)*4;
          const low = Math.min(pixels[p],pixels[p+1],pixels[p+2]);
          if (low < 125 || Math.max(pixels[p],pixels[p+1],pixels[p+2])-low > 80) continue;
          if (x-last > 3) start = x;
          last = x;
          if (last-start >= minRun && start <= cx && last >= cx) {
            const run = runs.at(-1);
            if (run && y <= run.last+2) {
              run.last = y;
              run.left = Math.min(run.left,start);
              run.right = Math.max(run.right,last+1);
            } else runs.push({first:y,last:y,left:start,right:last+1});
          }
        }
      }
      const run = runs.filter(run => run.last-run.first >= label.height*.3).at(-1);
      if (run) return {x:run.left,y:run.first,w:run.right-run.left,h:run.last-run.first+1};
    }
    const candidates = [];
    for (const label of matches) for (const image of imageBoxes) {
      const gap = label.box.y-endY(image), x = centerX(label.box);
      if (image.y < rowFor.get(label).top-1 || x < image.x || x > endX(image) || gap < -label.height*.35 ||
          gap > Math.max(2.5*label.height,image.h*1.5)) continue;
      candidates.push({label,image,score:Math.abs(gap)+Math.abs(x-centerX(image))*.25});
    }
    candidates.sort((a,b) => a.score-b.score);
    const paired = new Map(), used = new Set();
    for (const {label,image} of candidates) {
      if (paired.has(label) || used.has(image)) continue;
      paired.set(label,image);
      used.add(image);
    }
    if (paired.size < matches.length) pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
    const ordered = columns.flat();
    const records = ordered.flatMap(label => {
      const codeBox = pdfLabelCrop(label,canvas);
      const image = paired.get(label) || rowBar(label);
      const record = {code:label.code,name:label.name,codeBox};
      if (!image) return [];
      const row = rowFor.get(label);
      const previousImage = bars.filter(other => centerX(image) >= other.x && centerX(image) <= endX(other) && endY(other) <= image.y)
        .reduce((bottom,other) => Math.max(bottom,endY(other)),0);
      const profileTop = Math.max(previousImage,image.y-Math.max(label.height*2,image.h*.55));
      const topLimit = Math.min(image.y,Math.max(row.top,profileTop));
      const bottomLimit = includeCode ? Math.max(endY(image),row.bottom) :
        Math.max(endY(image),label.box.y);
      const nextColumn = imageBoxes.filter(other => other.x > endX(image) && other.y < bottomLimit && endY(other) > topLimit)
        .reduce((left,other) => Math.min(left,other.x),canvas.width);
      const rightLimit = Math.min(nextColumn,endX(image)+image.w*.35);
      const inProfile = (box,top = topLimit) => box.x >= endX(image) && endX(box) <= rightLimit &&
        box.y >= top && endY(box) <= bottomLimit;
      const numbers = labels.filter(other => inProfile(other.box,profileTop) && /^\d{1,4}(?:\s*[x×*]\s*\d{1,4})?$/i.test(other.text))
        .sort((a,b) => a.y-b.y || a.x-b.x);
      const combined = numbers.find(other => /[x×*]/i.test(other.text));
      const size = combined ? combined.text.replace(/\s/g,'').replace(/[×*X]/,'x') :
        numbers.length >= 2 ? numbers.slice(0,2).map(other => other.text).join('x') : '';
      const profile = [...components,...embedded].filter(box => inProfile(box) && box.h >= image.h*.25 && box.w <= box.h*1.4);
      const boxes = [image,...profile,...numbers.map(other => other.box),...(includeCode ? [label.box] : [])];
      const pad = Math.max(1,label.height*.14);
      const x = Math.max(0,Math.min(...boxes.map(box => box.x))-pad);
      const y = Math.max(topLimit,Math.min(...boxes.map(box => box.y))-pad);
      const right = Math.min(rightLimit,Math.max(...boxes.map(endX))+pad);
      const bottom = Math.min(bottomLimit,Math.max(...boxes.map(endY))+pad);
      return [{...record,size,materialCrop:relativeCrop(image,canvas),
        crop:relativeCrop({x,y,w:right-x,h:bottom-y},canvas),confidence:.95}];
    });
    // Thanh chưa ghép được mã: lấy dòng chữ gần nhất bên dưới làm mã gợi ý, không có thì để trống cho người dùng nhập.
    const placed = records.map(record => record.materialCrop).map(crop => ({x:crop.x*canvas.width,y:crop.y*canvas.height,
      w:crop.w*canvas.width,h:crop.h*canvas.height}));
    const taken = new Set(matches);
    const leftovers = imageBoxes.filter(box => !placed.some(item => intersection(item,box) >= box.w*box.h*.5))
      .sort((a,b) => a.y-b.y || a.x-b.x).map(image => {
        const text = labels.filter(label => !taken.has(label) && label.text.length <= 40 && !/^\d{1,4}(?:\s*[x×*]\s*\d{1,4})?$/i.test(label.text) &&
          centerX(label.box) >= image.x-image.w*.1 && centerX(label.box) <= endX(image)+image.w*.1 &&
          label.box.y >= image.y+image.h*.5 && label.box.y-endY(image) <= Math.max(label.height*3,image.h*1.2))
          .sort((a,b) => a.box.y-b.box.y || a.x-b.x)[0];
        const code = text?.text.replace(/\s+/g,' ').trim().toUpperCase() || '';
        const crop = text ? {x:Math.min(image.x,text.box.x),y:image.y,w:Math.max(endX(image),endX(text.box))-Math.min(image.x,text.box.x),
          h:endY(text.box)-image.y} : image;
        return {code,name:code || 'Cần nhập mã',codeBox:text && pdfLabelCrop(text,canvas),materialCrop:relativeCrop(image,canvas),
          crop:relativeCrop(crop,canvas),confidence:code ? .6 : .55,needsReview:true};
      });
    return [...records,...leftovers.filter(item => !item.code || !records.some(record => duplicateCode(record.code) === duplicateCode(item.code)))];
  }

  return {woodPatterns,catalogueKey,bounded,anCuongLabel,anCuongSwatches,kitchenSubgroups,catalogueGuideRatio,fitCatalogueCrop,includeCatalogueCode,embeddedCatalogueImages,catalogueTextBounds,matchCatalogueCrops,phaoCode,mergePhaoLabels,matchPhaoCrops,duplicateCode};
})();
