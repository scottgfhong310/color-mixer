/**
 * color-mixer — 獨立執行的 Express 伺服器
 *
 * 零後端：調色與比對全在前端（五個家族色彩 registry 是靜態複製件、校準資料是
 * db_artcolor 的匯出產物）。因此**沒有任何 API**——只負責靜態檔、根路徑轉址、
 * JSON 404。比照 faber-castell-color 等五支色彩 app，連 routes/ 與
 * public/upload/ 都省。
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/color-mixer/
 */

const express = require('express');
const path = require('path');
const logger = require('morgan');

const app = express();

app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/color-mixer/'));

// 404（API 回 JSON，其餘回純文字）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).type('text/plain').send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`color-mixer →  http://localhost:${PORT}/apps/color-mixer/`);
});
