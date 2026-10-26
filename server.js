const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Khởi tạo dữ liệu mặc định nếu chưa có file data.json
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      startMonth: '2026-06',
      endMonth: '2026-09',
      tasks: [
        {
          id: 'task-1',
          title: '3D - A DŨNG VŨ YÊN - HẢI PHÒNG',
          startDate: '2026-06-22',
          endDate: '2026-07-23',
          color: '#cc0000',
          note: ''
        },
        {
          id: 'task-2',
          title: '3D CHỈNH SỬA - A DŨNG VŨ YÊN - HẢI PHÒNG',
          startDate: '2026-07-24',
          endDate: '2026-08-08',
          color: '#f57c00',
          note: ''
        },
        {
          id: 'task-3',
          title: 'HSKT - A DŨNG VŨ YÊN - HẢI PHÒNG',
          startDate: '2026-08-10',
          endDate: '2026-08-29',
          color: '#d4a017',
          note: ''
        },
        {
          id: 'task-4',
          title: 'Ngày làm việc',
          startDate: '2026-08-21',
          endDate: '2026-08-22',
          color: '#2e7d32',
          note: ''
        },
        {
          id: 'task-5',
          title: 'Quốc khánh (ngày lễ)',
          startDate: '2026-08-31',
          endDate: '2026-09-02',
          color: '#2e7d32',
          note: ''
        },
        {
          id: 'task-6',
          title: 'HSKT - A DŨNG VŨ YÊN - HẢI PHÒNG',
          startDate: '2026-09-03',
          endDate: '2026-09-04',
          color: '#d4a017',
          note: ''
        }
      ],
      companyName: 'GD HOME',
      companyLogo: null,
      footerNote: 'Bảng tiến độ chưa bao gồm thời gian phản hồi và trao đổi thiết kế'
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

initDatabase();

// Đọc dữ liệu từ DB
function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// Lưu dữ liệu vào DB
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 1. API Lấy toàn bộ dữ liệu dự án
app.get('/api/schedule', (req, res) => {
  const data = readDb();
  res.json({ success: true, data });
});

// 2. API Lưu cập nhật toàn bộ trạng thái lịch
app.post('/api/schedule', (req, res) => {
  const current = readDb();
  const updated = { ...current, ...req.body };
  writeDb(updated);
  res.json({ success: true, message: 'Đã lưu tiến độ thành công!', data: updated });
});

// 3. API Thêm công việc
app.post('/api/tasks', (req, res) => {
  const data = readDb();
  const newTask = {
    id: 'task_' + Date.now(),
    title: req.body.title || 'Công việc mới',
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    color: req.body.color || '#cc0000',
    note: req.body.note || ''
  };
  data.tasks.push(newTask);
  writeDb(data);
  res.json({ success: true, task: newTask });
});

// 4. API Sửa công việc
app.put('/api/tasks/:id', (req, res) => {
  const data = readDb();
  const idx = data.tasks.findIndex(t => t.id === req.params.id);
  if (idx !== -1) {
    data.tasks[idx] = { ...data.tasks[idx], ...req.body };
    writeDb(data);
    res.json({ success: true, task: data.tasks[idx] });
  } else {
    res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
  }
});

// 5. API Xóa công việc
app.delete('/api/tasks/:id', (req, res) => {
  const data = readDb();
  data.tasks = data.tasks.filter(t => t.id !== req.params.id);
  writeDb(data);
  res.json({ success: true, message: 'Đã xóa công việc' });
});

// Khởi động server lắng nghe trên tất cả địa chỉ mạng (0.0.0.0) để máy khác cùng mạng Wi-Fi/LAN truy cập được
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Server Lịch Tiến Độ đang chạy tại:`);
  console.log(`- Trực tiếp trên máy này: http://localhost:${PORT}`);
  
  // In ra IP LAN để các máy khác hoặc điện thoại cùng Wi-Fi truy cập
  const interfaces = os.networkInterfaces();
  for (let iface in interfaces) {
    for (let alias of interfaces[iface]) {
      if (alias.family === 'IPv4' && !alias.internal) {
        console.log(`- Máy khác trong cùng Wi-Fi/LAN truy cập: http://${alias.address}:${PORT}`);
      }
    }
  }
  console.log(`=======================================================`);
});
