// Đọc Hợp đồng thiết kế (HĐTK) theo mẫu GD HOME: file Word (.docx) hoặc đoạn chữ dán vào -> các cột của hồ sơ dự án,
// các đợt thanh toán và các mốc tiến độ (số ngày làm việc). Chạy trên trình duyệt (window.GDHomeContract) và Node (kiểm thử).
(function (root) {
  const clean = value => String(value || '').replace(/[ \t ]+/g, ' ').trim();
  const money = value => {
    const digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? String(Number(digits)) : '';
  };
  const decimal = value => {
    const text = String(value || '').trim();
    if (!text) return '';
    // "466", "1.250" (nghìn), "85,5" (thập phân)
    const normal = /,\d{1,2}$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(/[.,](?=\d{3}\b)/g, '');
    const number = Number(normal.replace(/[^\d.]/g, ''));
    return Number.isFinite(number) && number > 0 ? String(number) : '';
  };
  const pick = (text, pattern) => clean(text.match(pattern)?.[1]);
  const pad = n => String(n).padStart(2, '0');

  function signedDate(text, contractNo) {
    const m = text.match(/Hôm nay,?\s*ngày\s*(\d{0,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
    const fromNo = String(contractNo || '').match(/(\d{2})(\d{2})(\d{4})\s*$/);   // số HĐ dạng …/08072026 = ngày ký
    if (m && m[1]) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    if (fromNo && (!m || Number(fromNo[2]) === Number(m[2]))) return fromNo[3] + '-' + fromNo[2] + '-' + fromNo[1];
    return m ? m[3] + '-' + pad(m[2]) + '-01' : '';
  }

  // Khối thông tin Bên A: từ "BÊN A" tới "BÊN B"
  function partyA(text) {
    const start = text.search(/(ĐẠI DIỆN\s+)?BÊN A\b/i);
    if (start < 0) return {block: '', name: ''};
    const rest = text.slice(start);
    const end = rest.slice(5).search(/(ĐẠI DIỆN\s+)?BÊN B\b/i);
    const block = end < 0 ? rest.slice(0, 1500) : rest.slice(0, end + 5);
    return {block, name: pick(block, /BÊN A[^:\n]*:\s*([^\n]+)/i)};
  }

  function paymentLabel(trigger) {
    if (/3D/i.test(trigger)) return 'Chốt 3D';
    if (/kỹ thuật|kĩ thuật|HSKT|bàn giao/i.test(trigger)) return 'Giao HSKT';
    if (/ký|kí|đặt cọc/i.test(trigger)) return 'Ký hợp đồng';
    return clean(trigger).slice(0, 60);
  }

  function parseContract(raw) {
    const text = String(raw || '').replace(/\r/g, '');
    const {block, name} = partyA(text);
    const contractNo = pick(text, /HỢP ĐỒNG[^\n]*\n(?:[^\n]*\n){0,2}?\s*Số\s*:\s*([^\n]+)/i) || pick(text, /\bSố\s*:\s*([^\n]+)/i);
    const representative = pick(block, /Đại diện\s*:\s*(.+?)(?:\s{2,}|\t|Chức vụ|$)/im);
    const site = pick(text, /có địa chỉ tại\s*:?\s*([^\n]+)/i).replace(/[.;]+$/, '');
    const area = decimal(pick(text, /(?:Diện tích|Khối lượng thiết kế)[^:\n]*:\s*([\d.,]+)\s*m/i));
    const designPrice = money(pick(text, /Đơn giá thiết kế\s*:\s*([\d.,]+)/i));
    const vat = pick(text, /VAT\s*(\d{1,2})\s*%/i);
    const designValue = money(pick(text, /Giá trị hợp đồng[^:\n]*:\s*([\d.,]+)/i))
      || (area && designPrice ? String(Math.round(Number(area) * Number(designPrice) * (1 + (Number(vat) || 0) / 100))) : '');
    const profile = {
      // Khách cá nhân: "BÊN A : CHỦ ĐẦU TƯ" + "Đại diện : Ông X" -> "Anh X" (cách gọi trong bảng dự án)
      customer: name && !/CHỦ ĐẦU TƯ/i.test(name) ? name : representative.replace(/^Ông\s+/i, 'Anh ').replace(/^Bà\s+/i, 'Chị '),
      representative: /^(CÔNG TY|CTY)/i.test(name) ? representative : '',
      customerAddress: pick(block, /Địa chỉ\s*:\s*([^\n]+)/i),
      phone: pick(block, /Điện thoại\s*:\s*([\d .+]+?)(?:\s{2,}|\t|Fax|$)/im).replace(/\s+/g, ''),
      email: pick(block, /Email\s*:\s*(\S+@\S+)/i),
      taxCode: pick(block, /Mã số thuế\s*:\s*([\d-]+)/i),
      contractNo,
      signedAt: signedDate(text, contractNo),
      address: site || pick(block, /Địa chỉ\s*:\s*([^\n]+)/i),
      area, designPrice, vat, designValue,
    };
    profile.contract = contractNo;
    const payments = [...text.matchAll(/Đợt\s*(\d+)\s*:\s*([^\n]*?)số tiền(?: còn lại)?(?: là)?\s*:?\s*([\d.,]+)\s*(?:VNĐ|VND|đ)/gi)]
      .map(m => ({label: 'Đợt ' + m[1] + ' · ' + paymentLabel(m[2]), amount: money(m[3]), milestone: paymentLabel(m[2]), paidAt: ''}));
    // Các mốc trong Điều 4, nối tiếp nhau: layout (từ ngày ký) -> 3D lần 1 (sau khi chốt layout) -> chỉnh sửa -> HSKT
    const days = pattern => Number(text.match(pattern)?.[1]) || 0;
    const milestones = [
      {kind: 'layout', prefix: 'LAYOUT', days: days(/sau\s*(\d+)\s*ngày làm việc[^\n]*?trình[^\n]*?layout/i)},
      {kind: '3d', prefix: '3D', days: days(/Sau\s*(\d+)\s*ngày làm việc[^\n]*?3D\s*lần/i)},
      {kind: 'edit3d', prefix: 'CHỈNH SỬA 3D', days: days(/Trong\s*(\d+)\s*ngày tiếp theo[^\n]*?(?:chỉnh sửa|thống nhất)/i)},
      {kind: 'hskt', prefix: 'HSKT', days: days(/hồ sơ k[ỹĩ] thuật[^\n:]*:\s*(\d+)\s*ngày/i)},
    ].filter(item => item.days > 0);
    const items = [...text.matchAll(/^\s*([A-ZÀ-Ỹa-zà-ỹ][^:\n]{1,40}):\s*([\d.,]+)\s*m2/gim)]
      .filter(m => !/diện tích/i.test(m[1])).map(m => clean(m[1]) + ': ' + m[2] + ' m²');
    if (items.length) profile.note = 'Hạng mục thiết kế: ' + items.join('; ');
    for (const key of Object.keys(profile)) if (!profile[key]) delete profile[key];
    return {profile, payments, milestones};
  }

  // Chữ trong word/document.xml: mỗi đoạn (w:p) một dòng, tab giữ nguyên
  function docxXmlText(xml) {
    return String(xml).replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  // Đọc word/document.xml trong file .docx (zip) bằng DecompressionStream của trình duyệt, không cần thư viện
  async function docxText(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Không đọc được file Word (.docx).');
    let at = view.getUint32(eocd + 16, true);
    const count = view.getUint16(eocd + 10, true);
    for (let n = 0; n < count; n++) {
      const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true);
      const nameLen = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
      const local = view.getUint32(at + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
      if (name === 'word/document.xml') {
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = bytes.subarray(start, start + size);
        const xml = method === 0 ? data : new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        return docxXmlText(new TextDecoder().decode(xml));
      }
      at += 46 + nameLen + extra + comment;
    }
    throw new Error('File Word không có nội dung văn bản.');
  }

  const api = {parseContract, docxText, docxXmlText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GDHomeContract = api;
})(typeof window !== 'undefined' ? window : globalThis);
