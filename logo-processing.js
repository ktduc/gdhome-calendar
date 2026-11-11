(function(root,factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GDHomeLogoProcessing = api;
})(typeof window === 'object' ? window : globalThis,() => {
  function backgroundColor({data}) {
    for (let i=0;i<data.length;i+=4) if (data[i+3] > 240) return [data[i],data[i+1],data[i+2]];
    return [255,255,255];
  }
  function process(image,{removeBackground = false,color = backgroundColor(image),threshold = 35,sharpness = 0} = {}) {
    const {width,height} = image, data = new Uint8ClampedArray(image.data);
    if (removeBackground) {
      const visited = new Uint8Array(width*height), queue = new Int32Array(width*height);
      let count = 0, head = 0;
      function visit(index) {
        if (visited[index]) return;
        visited[index] = 1;
        const p = index*4;
        const distance = Math.sqrt(color.reduce((sum,value,channel) => sum+(data[p+channel]-value)**2,0));
        if (data[p+3] && distance > threshold) return;
        data[p+3] = Math.round(data[p+3]*Math.max(0,Math.min(1,(distance/Math.max(1,threshold)-.6)/.4)));
        queue[count++] = index;
      }
      for (let x=0;x<width;x++) { visit(x); visit((height-1)*width+x); }
      for (let y=0;y<height;y++) { visit(y*width); visit(y*width+width-1); }
      while (head < count) {
        const index = queue[head++], x = index%width;
        if (x) visit(index-1);
        if (x < width-1) visit(index+1);
        if (index >= width) visit(index-width);
        if (index+width < width*height) visit(index+width);
      }
    }
    if (sharpness > 0) {
      const source = new Uint8ClampedArray(data), amount = Math.min(2,sharpness);
      for (let y=1;y<height-1;y++) for (let x=1;x<width-1;x++) {
        const index = y*width+x, p = index*4;
        if (!source[p+3]) continue;
        for (let channel=0;channel<3;channel++) {
          const center = source[p+channel];
          const neighbors = [index-1,index+1,index-width,index+width].reduce((sum,index) => sum+(source[index*4+3] ? source[index*4+channel] : center),0);
          data[p+channel] = center+amount*(4*center-neighbors);
        }
      }
    }
    return {data,width,height};
  }
  return {backgroundColor,process};
});
