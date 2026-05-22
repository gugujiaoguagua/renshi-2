import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const SERVER_DIR = path.dirname(__filename);
const APP_DIR = path.resolve(SERVER_DIR, '..');
const WORKSPACE_DIR = path.resolve(APP_DIR, '..');

const app = express();
const PORT = Number(process.env.DATA_SERVER_PORT || 3101);
const HOST = process.env.DATA_SERVER_HOST || '0.0.0.0';
const MOBILE_ALLOW_OUT_OF_RANGE = process.env.MOBILE_ALLOW_OUT_OF_RANGE === 'true';
const WECOM_AUTH_MODE = process.env.WECOM_AUTH_MODE || 'test';
const WECOM_CORP_ID = process.env.WECOM_CORP_ID || '';
const WECOM_APP_SECRET = process.env.WECOM_APP_SECRET || process.env.WECOM_SECRET || '';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(WORKSPACE_DIR, '资料'));
const EMPLOYEE_REFERENCE_DIR = path.resolve(process.env.EMPLOYEE_REFERENCE_DIR || path.join(WORKSPACE_DIR, '参考图片', '功能', '员工管理'));
const ORGANIZATION_REFERENCE_DIR = path.resolve(process.env.ORGANIZATION_REFERENCE_DIR || path.join(WORKSPACE_DIR, '参考图片', '功能', '组织管理'));
const STORE_FILE = path.join(SERVER_DIR, 'data-store.json');
const MOBILE_TEST_USERS_FILE = path.join(SERVER_DIR, 'mobile-test-users.json');
const UPLOAD_DIR = path.join(SERVER_DIR, 'uploads');
const TIME_ZONE = 'Asia/Shanghai';


app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

function readStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
  } catch (_error) {
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function publicUrl(req, relativePath) {
  if (!relativePath) return '';
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${protocol}://${host}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

function readRequestBuffer(req, limitBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('上传文件过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipartPhoto(buffer, contentType) {
  const boundaryMatch = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) return null;
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let cursor = buffer.indexOf(boundaryBuffer);
  while (cursor >= 0) {
    let partStart = cursor + boundaryBuffer.length;
    if (buffer.slice(partStart, partStart + 2).toString() === '--') break;
    if (buffer.slice(partStart, partStart + 2).toString() === '\r\n') partStart += 2;
    const nextBoundary = buffer.indexOf(boundaryBuffer, partStart);
    if (nextBoundary < 0) break;
    let part = buffer.slice(partStart, nextBoundary);
    if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > 0) {
      const header = part.slice(0, headerEnd).toString('utf8');
      const body = part.slice(headerEnd + 4);
      if (/name="photo"/i.test(header) && /filename=/i.test(header)) {
        const filename = header.match(/filename="([^"]*)"/i)?.[1] || 'clock-photo.jpg';
        const mimeType = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'image/jpeg';
        return { filename, mimeType, buffer: body };
      }
    }
    cursor = nextBoundary;
  }
  return null;
}

function imageExtension(mimeType, filename) {
  const fromName = path.extname(filename || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(fromName)) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_error) {
    return fallback;
  }
}

function getStoredRows(key) {
  const rows = readStore()[key];
  return Array.isArray(rows) ? rows : null;
}

function setStoredRows(key, rows) {
  const store = readStore();
  store[key] = rows;
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

function upsertStoredRow(key, row, idGetter) {
  const rows = getStoredRows(key) || [];
  const nextId = idGetter(row);
  const existingIndex = rows.findIndex((item) => idGetter(item) === nextId);
  const nextRows = existingIndex >= 0
    ? rows.map((item, index) => (index === existingIndex ? { ...item, ...row } : item))
    : [row, ...rows];
  setStoredRows(key, nextRows);
  return { row, rows: nextRows, created: existingIndex < 0 };
}

function listExcelFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((name) => name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls'))
    .map((name) => {
      const fullPath = path.join(DATA_DIR, name);
      return { name, fullPath, stat: fs.statSync(fullPath) };
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

function pickFile(...keywords) {
  const files = listExcelFiles();
  for (const keyword of keywords) {
    const file = files.find((f) => f.name.includes(keyword));
    if (file) return file;
  }
  return files[0];
}

function readSheetRows(filePath, sheetMatcher) {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = sheetMatcher ? (wb.SheetNames.find(sheetMatcher) || wb.SheetNames[0]) : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return { rows, sheetName };
}

function readSheetRowsByHeader(filePath, sheetMatcher, headerRowIndex = 0) {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = sheetMatcher ? (wb.SheetNames.find(sheetMatcher) || wb.SheetNames[0]) : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false, range: headerRowIndex });
  return { rows, sheetName };
}

function normalizeKey(input) {
  return String(input || '').trim().toLowerCase().replace(/[\s_\-()（）【】\[\]：:]/g, '');
}

function getByAliases(row, aliases) {
  const aliasSet = new Set(aliases.map((a) => normalizeKey(a)));
  for (const [k, v] of Object.entries(row)) {
    if (aliasSet.has(normalizeKey(k))) return v;
  }
  return '';
}

function getReferenceFile(...keywords) {
  if (!fs.existsSync(EMPLOYEE_REFERENCE_DIR)) return null;
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (/\.xlsx?$/i.test(name)) {
        files.push({ name, fullPath, stat });
      }
    }
  };
  walk(EMPLOYEE_REFERENCE_DIR);
  return files
    .filter((file) => keywords.every((keyword) => file.name.includes(keyword)))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0] || null;
}

function asText(value, fallback = '-') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text === '' ? fallback : text;
}

function asRawText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNum(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function extractDate(value) {
  const text = asRawText(value);
  const m = text.match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/);
  return m ? m[0].replace(/[/.]/g, '-') : text;
}

function weekdayFromDate(dateText) {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return '';
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
}

function dateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentDateText(date = new Date()) {
  const parts = dateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDateText(dateText) {
  const match = asText(dateText, '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateText, amount) {
  const date = parseDateText(dateText) || parseDateText(currentDateText());
  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
}

function monthDates(monthText) {
  const match = asText(monthText, currentDateText().slice(0, 7)).match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : Number(currentDateText().slice(0, 4));
  const month = match ? Number(match[2]) : Number(currentDateText().slice(5, 7));
  const total = new Date(year, month, 0).getDate();
  return Array.from({ length: total }, (_, index) => formatLocalDate(new Date(year, month - 1, index + 1)));
}

function currentWeekdayText(dateText = currentDateText()) {
  const weekday = weekdayFromDate(dateText);
  return weekday ? `星期${weekday}` : '';
}

function inferPeriodFromFileName(name) {
  const m = name.match(/(20\d{2})[^\d]?(\d{2})/);
  return m ? `${m[1]}年${m[2]}月` : '未知周期';
}

function classifyAttendResult(value) {
  const text = asRawText(value);
  if (!text || text === '-') return '异常';
  if (text.includes('正常') || text.includes('已出勤')) return '正常';
  if (text.includes('休')) return '休息';
  return '异常';
}

function classifyAnomalyType(desc) {
  const text = asRawText(desc);
  if (text.includes('旷工')) return '旷工';
  if (text.includes('迟到')) return '迟到';
  if (text.includes('早退')) return '早退';
  if (text.includes('未排班')) return '未排班';
  if (text.includes('缺卡') || text.includes('未打卡')) return '未打卡';
  return text || '异常';
}

function mapAttendanceRows(rows) {
  return rows.slice(0, 3000).map((row) => {
    const attendance = asText(getByAliases(row, ['出勤情况', '出勤状态', '考勤状态']), '-');
    const status = asText(getByAliases(row, ['状态', '考勤结果', '异常状态']), attendance);
    return {
      name: asText(getByAliases(row, ['姓名', '员工姓名', 'name']), '-'),
      empId: asText(getByAliases(row, ['员工号', '员工工号', '工号', '员工编号', '员工ID', 'empId']), ''),
      attendGroup: asText(getByAliases(row, ['考勤组', '所属考勤组']), ''),
      dept: asText(getByAliases(row, ['部门', '一级部门', '组织']), '未知部门'),
      deptFull: asText(getByAliases(row, ['部门全路径', '组织全路径']), ''),
      shift: asText(getByAliases(row, ['班次', '班次名称', '排班']), ''),
      type: asText(getByAliases(row, ['考勤日类型', '日期类型', '考勤类型', '班次类型']), ''),
      attendance,
      status,
      anomaly: asText(getByAliases(row, ['异常说明', '异常明细', '异常', '异常状态']), '-'),
      leave: asText(getByAliases(row, ['请假', '请假时长', '请假天数']), '-'),
      fieldTrip: asText(getByAliases(row, ['外出/出差', '外出出差', '出差', '外出']), '-'),
      cin1: asText(getByAliases(row, ['签到1', '上班1打卡时间', '上班打卡', '上班打卡时间', '上班时间']), '-'),
      cout1: asText(getByAliases(row, ['签退1', '下班1打卡时间', '下班打卡', '下班打卡时间', '下班时间']), '-'),
      cin2: asText(getByAliases(row, ['签到2', '上班2打卡时间']), '-'),
      cout2: asText(getByAliases(row, ['签退2', '下班2打卡时间']), '-'),
      cin3: asText(getByAliases(row, ['签到3', '上班3打卡时间']), '-'),
      cout3: asText(getByAliases(row, ['签退3', '下班3打卡时间']), '-'),
    };
  }).filter((row) => row.name !== '-');
}

function mapDailyRows(rows) {
  return rows.slice(0, 3000).map((row) => {
    const date = extractDate(getByAliases(row, ['日期', '考勤日期']));
    const result = classifyAttendResult(getByAliases(row, ['考勤结果', '出勤情况']));
    return {
      name: asText(getByAliases(row, ['姓名']), '-'),
      confirmStatus: '未确认',
      empId: asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
      date,
      dept: asText(getByAliases(row, ['部门']), ''),
      position: asText(getByAliases(row, ['岗位']), ''),
      bizGroup: asText(getByAliases(row, ['业务分组']), ''),
      deptFullPath: asText(getByAliases(row, ['部门全路径']), ''),
      regularDate: asText(getByAliases(row, ['转正日期']), ''),
      attendGroup: asText(getByAliases(row, ['考勤组']), ''),
      shiftName: asText(getByAliases(row, ['班次名称', '班次']), ''),
      dateType: asText(getByAliases(row, ['日期类型', '考勤日类型']), ''),
      weekday: asText(getByAliases(row, ['星期']), weekdayFromDate(date)),
      attendResult: result,
      anomalyDesc: asText(getByAliases(row, ['异常说明']), ''),
      taskSummary: asText(getByAliases(row, ['勤务概要']), ''),
      normalHours: asNum(getByAliases(row, ['正班时长(小时)', '正班时长'])),
      lateMinutes: asNum(getByAliases(row, ['迟到时长(分钟)', '迟到时长'])),
    };
  }).filter((row) => row.name !== '-');
}

function mapMonthlyRows(rows) {
  const dateKeyReg = /(20\d{2}-\d{2}-\d{2})日/;
  const keys = Object.keys(rows[0] || {});
  const dateKeys = keys.filter((key) => dateKeyReg.test(key));
  return rows.slice(0, 3000).map((row) => {
    const dayResults = {};
    for (const key of dateKeys) {
      const m = key.match(dateKeyReg);
      if (!m) continue;
      const day = String(Number(m[1].slice(-2)));
      dayResults[day] = asText(row[key], '');
    }
    return {
      name: asText(getByAliases(row, ['姓名']), '-'),
      empId: asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
      dept: asText(getByAliases(row, ['部门']), ''),
      position: asText(getByAliases(row, ['岗位']), ''),
      attendGroup: asText(getByAliases(row, ['考勤组']), ''),
      deptFullPath: asText(getByAliases(row, ['部门全路径']), ''),
      bizGroup: asText(getByAliases(row, ['业务分组']), ''),
      dayResults,
    };
  }).filter((row) => row.name !== '-');
}

function mapClockRows(rows) {
  let id = 1;
  return rows.slice(0, 5000).map((row) => ({
    id: id++,
    name: asText(getByAliases(row, ['姓名']), '-'),
    empId: asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
    dept: asText(getByAliases(row, ['部门']), ''),
    date: extractDate(getByAliases(row, ['打卡日期', '日期'])),
    time: asText(getByAliases(row, ['打卡时间', '打卡1']), ''),
    source: asText(getByAliases(row, ['打卡来源']), ''),
    device: asText(getByAliases(row, ['打卡设备']), ''),
    location: asText(getByAliases(row, ['打卡地点']), ''),
    workLocation: asText(getByAliases(row, ['上班地点']), ''),
    freeWork: asText(getByAliases(row, ['自由工时上下班']), ''),
    note: asText(getByAliases(row, ['备注']), ''),
    hasPhoto: false,
    creator: asText(getByAliases(row, ['创建人']), '系统'),
    createTime: asText(getByAliases(row, ['创建时间']), ''),
    modifier: asText(getByAliases(row, ['修改人']), ''),
    modifyTime: asText(getByAliases(row, ['修改时间']), ''),
  })).filter((row) => row.name !== '-');
}

function mapAnomalyRows(rows) {
  let id = 1;
  return rows.slice(0, 3000).map((row) => {
    const date = extractDate(getByAliases(row, ['考勤日期', '日期']));
    const desc = asText(getByAliases(row, ['异常说明']), '异常');
    const reminder = asText(getByAliases(row, ['提醒状态']), '未提醒').includes('已') ? '已提醒' : '未提醒';
    const writeOff = asText(getByAliases(row, ['核销状态']), '未核销').includes('已') ? '已核销' : '未核销';
    const remark = asText(getByAliases(row, ['备注', '处理备注', '处理意见']), '');
    return {
      id: id++,
      name: asText(getByAliases(row, ['姓名']), '-'),
      empId: asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
      dept: asText(getByAliases(row, ['部门']), ''),
      date,
      weekday: weekdayFromDate(date),
      shift: asText(getByAliases(row, ['班次名称', '班次']), ''),
      type: classifyAnomalyType(desc),
      desc,
      clock: '—',
      reminder,
      handled: writeOff === '已核销' || Boolean(remark),
      writeOff,
      remark,
      remarkUpdatedAt: '',
    };
  }).filter((row) => row.name !== '-');
}


function mapMonthlySummaryRows(rows) {
  let id = 1;
  return rows.slice(0, 5000).map((row) => {
    const lockStatus = asText(getByAliases(row, ['锁定状态']), '未锁定').includes('已') ? '已锁定' : '未锁定';
    const confirmRaw = asText(getByAliases(row, ['确认状态']), '未发送');
    const confirmStatus = confirmRaw.includes('确认') ? '已确认' : confirmRaw.includes('发送') ? '已发送' : '未发送';
    return {
      id: id++,
      name: asText(getByAliases(row, ['姓名']), '-'),
      lockStatus,
      empId: asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
      dept: asText(getByAliases(row, ['部门']), ''),
      position: asText(getByAliases(row, ['岗位']), ''),
      hireDate: asText(getByAliases(row, ['入职日期']), ''),
      resignDate: asText(getByAliases(row, ['离职日期']), ''),
      deptFullPath: asText(getByAliases(row, ['部门全路径']), ''),
      bizGroup: asText(getByAliases(row, ['业务分组']), ''),
      attendGroup: asText(getByAliases(row, ['考勤组']), ''),
      shouldWorkDays: asNum(getByAliases(row, ['应出勤天数'])),
      actualWorkDays: asNum(getByAliases(row, ['实际出勤天数', '实出勤天数'])),
      absentDays: asNum(getByAliases(row, ['旷工天数'])),
      tripDays: asNum(getByAliases(row, ['出差天数'])),
      scheduleDays: asNum(getByAliases(row, ['排班天数'])),
      normalHours: asNum(getByAliases(row, ['正班时长(小时)', '正班时长'])),
      lateMinutes: asNum(getByAliases(row, ['迟到时长(分钟)', '迟到时长'])),
      earlyLeaveMinutes: asNum(getByAliases(row, ['早退时长(分钟)', '早退时长'])),
      confirmStatus,
    };
  }).filter((row) => row.name !== '-');
}

function mapShiftSettingRows(rows) {
  return rows.slice(0, 1000).map((row) => [
    asText(getByAliases(row, ['班次名称']), '-'),
    asText(getByAliases(row, ['班次简称']), '-'),
    asText(getByAliases(row, ['班次颜色', '颜色']), '#B53A2A'),
    asText(getByAliases(row, ['班次标签']), '-'),
    asText(getByAliases(row, ['冬夏令时']), '-'),
    asText(getByAliases(row, ['出勤时间', '工作时间', '上班时间']), '-'),
    asText(getByAliases(row, ['合计工作时长']), '-'),
    asText(getByAliases(row, ['适用考勤组']), '-'),
    '系统导入',
    new Date().toISOString().slice(0, 19).replace('T', ' '),
    '',
    '',
  ]).filter((row) => row[0] !== '-');
}

function mapFaceSettingRows(rows) {
  return rows.slice(0, 3000).map((row) => [
    asText(getByAliases(row, ['姓名']), '-'),
    asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
    asText(getByAliases(row, ['部门']), ''),
    asText(getByAliases(row, ['部门全路径']), ''),
    asText(getByAliases(row, ['考勤组']), ''),
    asText(getByAliases(row, ['入职日期']), ''),
    asText(getByAliases(row, ['录入状态']), ''),
    asText(getByAliases(row, ['审核状态']), ''),
    asText(getByAliases(row, ['质量评分', '反馈评分']), ''),
    asText(getByAliases(row, ['数据来源']), ''),
  ]).filter((row) => row[0] !== '-');
}

function mapPeopleSettingRows(rows) {
  return rows.slice(0, 3000).map((row) => [
    asText(getByAliases(row, ['姓名']), '-'),
    asText(getByAliases(row, ['员工号', '员工工号', '工号']), ''),
    asText(getByAliases(row, ['部门']), ''),
    asText(getByAliases(row, ['岗位']), ''),
    asText(getByAliases(row, ['入职日期']), ''),
    asText(getByAliases(row, ['班次名称', '班次']), '-'),
    asText(getByAliases(row, ['考勤周期', '日期']), '-'),
    '全职',
    asText(getByAliases(row, ['离职日期']), '') ? '离职' : '在职',
    '-',
    asText(getByAliases(row, ['业务分组']), '-'),
    '-',
    asText(getByAliases(row, ['考勤组']), ''),
    '默认方案',
  ]).filter((row) => row[0] !== '-');
}

const DEFAULT_SHIFT_SETTING_ROWS = [
  ['早七点半晚五点半', '7.5-5.5', '#9A3412', '-', '通用', '07:30-17:30(正常出勤)', '9小时', '-', '常乐', '2026-04-20 14:58:50', '常乐', '2026-04-21 16:00:00'],
  ['早八点半晚五点半', '8.5-5.5', '#3B82F6', '-', '通用', '08:30-17:30(正常出勤)', '8小时', '-', '常乐', '2026-04-20 15:00:36', '常乐', '2026-04-21 16:00:00'],
  ['早十点半晚六点半', '10.5-6.5', '#9A3412', '-', '通用', '10:30-18:30(正常出勤)', '7小时', '昊中店', '何山', '2025-08-28 10:21:18', '常乐', '2026-04-21 16:00:00'],
  ['早十二点晚八', '12-8', '#9A3412', '-', '通用', '12:00-20:00(正常出勤)', '7小时', '昊中店', '何山', '2025-08-28 10:22:03', '常乐', '2026-04-21 16:00:00'],
  ['早九点半晚五点半', '9.5-5.5', '#4DD7A5', '-', '通用', '09:30-17:30(正常出勤)', '7小时', '昊中店,松江月星,真北北馆', '何山', '2025-08-28 10:23:08', '常乐', '2026-04-21 16:00:00'],
  ['早九点半晚六点', '9.5-6', '#A855F7', '-', '通用', '09:30-18:00(正常出勤)', '8小时30分钟', '松江月星,真北北馆', '常乐', '2026-04-21 08:46:10', '常乐', '2026-04-21 16:00:00'],
  ['早九点半晚八点', '9.5-8', '#F43F5E', '-', '通用', '09:30-20:00(正常出勤)', '10小时30分钟', '真北北馆,真北南馆,金桥店,汶水店', '常乐', '2026-04-21 08:41:56', '常乐', '2026-04-21 16:00:00'],
  ['早九晚六点半', '9-6.5', '#FB7185', '-', '通用', '09:00-18:30(正常出勤)', '8小时30分钟', '浦江店', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['早九晚六', '9-6', '#FB6B4B', '-', '通用', '09:00-18:00(正常出勤)', '8小时', '华托大厦', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['早九点半晚七点半', '9.5-7.5', '#FB6B4B', '-', '通用', '09:30-19:30(正常出勤)', '9小时', '-', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['早九点半晚六点半', '9.5-6', '#FB6B4B', '-', '通用', '09:30-18:30(正常出勤)', '8小时', '拉迷YOUNG,建配龙', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['早二晚六', '2-6', '#FB6B4B', '-', '通用', '14:00-18:00(正常出勤)', '3小时', '金桥店', '常乐', '2026-04-21 09:47:02', '常乐', '2026-04-21 16:00:00'],
  ['早十晚二', '10-2', '#FB6B4B', '-', '通用', '10:00-14:00(正常出勤)', '3小时', '金桥店', '常乐', '2026-04-21 09:47:10', '常乐', '2026-04-21 16:00:00'],
  ['早一晚九', '1-9', '#FB6B4B', '-', '通用', '13:00-21:00(正常出勤)', '7小时', '澳门月星', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['早二晚八', '2-8', '#FB6B4B', '-', '通用', '14:00-20:00(正常出勤)', '6小时', '金桥店', '常乐', '2026-04-21 09:49:07', '常乐', '2026-04-21 16:00:00'],
  ['早十点半晚八', '10-8.5', '#FB6B4B', '-', '通用', '10:30-20:00(正常出勤)', '8小时30分钟', '沪南店', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['早十晚六', '10-6', '#FB6B4B', '-', '通用', '10:00-18:00(正常出勤)', '7小时', '真北全案,沪南店,汶水店', '何山', '2025-08-28 10:48:30', '常乐', '2026-04-21 16:00:00'],
  ['家饰佳-早九点四十晚六点半', '家', '#F43F5E', '-', '通用', '09:40-18:30(正常出勤)', '7小时50分钟', '家饰佳', '何山', '2025-08-28 10:12:35', '常乐', '2026-04-21 10:00:00'],
  ['早七点半晚五点半-工厂车间', '工厂车间', '#FB6B4B', '-', '通用', '07:30-17:30(正常出勤)', '10小时', '考勤组D,考勤组E', '何山', '2025-08-28 09:31:06', '常乐', '2026-04-21 10:00:00'],
  ['早八晚五', '8-5', '#60A5FA', '-', '通用', '08:00-17:00(正常出勤)', '8小时', '综合考勤组', '常乐', '2026-04-21 09:50:00', '常乐', '2026-04-21 16:00:00'],
  ['早八晚六', '8-6', '#60A5FA', '-', '通用', '08:00-18:00(正常出勤)', '9小时', '综合考勤组', '常乐', '2026-04-21 09:52:00', '常乐', '2026-04-21 16:00:00'],
  ['早十晚七', '10-7', '#FB6B4B', '-', '通用', '10:00-19:00(正常出勤)', '8小时', '直营门店', '常乐', '2026-04-21 09:54:00', '常乐', '2026-04-21 16:00:00'],
  ['晚班', '13-22', '#7C3AED', '-', '通用', '13:00-22:00(正常出勤)', '8小时', '直营门店', '常乐', '2026-04-21 09:56:00', '常乐', '2026-04-21 16:00:00'],
  ['弹性工作制（8小时）', '弹性8', '#10B981', '弹性', '通用', '09:00-18:00(弹性出勤)', '8小时', '研发中心考勤组', '常乐', '2026-04-21 09:58:00', '常乐', '2026-04-21 16:00:00'],
  ['休息', '休', '#94A3B8', '休息', '通用', '休息', '0小时', '通用', '系统', '2026-05-16 00:00:00', '系统', '2026-05-16 00:00:00'],
];

const DEFAULT_GROUP_SETTING_ROWS = [
  ['冲床组', '排班制', '部门：冲压车间', '早十晚六 / 早十午六', '何山', '2025-08-28 11:10:29', '棠乐', '2026-04-22 14:55:09'],
  ['装配工序', '排班制', '部门：装配工序', '早八晚六', '何山', '2025-08-28 11:15:12', '棠乐', '2026-04-22 14:54:27'],
  ['项目门店', '排班制', '部门：项目门店', '早一晚九', '何山', '2025-08-28 11:18:10', '棠乐', '2026-04-22 14:53:47'],
  ['直营门店', '排班制', '部门：直营门店', '早九晚六 / 早十晚七', '何山', '2025-08-28 11:09:27', '棠乐', '2026-04-22 14:52:54'],
];

const DEFAULT_CARD_RULE_ROWS = [
  ['无规则打卡', '无规则打卡', '无规则打卡', '棠乐', '2026-04-15 09:54:58', '棠乐', '2026-04-15 09:54:58'],
  ['迟到打卡规则', '禁止工出勤在9小时内发起迟到流程', '家和里 / 项目门店 / 冲压车间', '棠乐', '2026-04-15 09:45:40', '棠乐', '2026-04-15 09:45:40'],
];

const DEFAULT_MOBILE_CLOCK_ROWS = [];
const DEFAULT_LOCATION_SETTING_ROWS = [];
const DEFAULT_HOLIDAY_SETTING_ROWS = [];
const DEFAULT_CALENDAR_SETTING_ROWS = [
  ['周连班', '当月1日至当月最后一天为【当月】的考勤周期', '周一、周二、周三、周四、周五、周六、周日', '工作日之和为应出勤天数', '华北大区 / 荥州十月直营中心 / 庐山直营', '棠乐', '2026-04-15 09:47:51', '棠乐', '2026-04-15 09:47:52'],
  ['双休', '当月1日至当月最后一天为【当月】的考勤周期', '周一、周二、周三、周四、周五', '工作日之和为应出勤天数', '华北大区 / 项目门店 / 直营门店', '何山', '2025-08-28 09:37:47', '何山', '2025-08-28 09:37:48'],
];
const DEFAULT_OVERTIME_RULE_ROWS = [
  ['仅计时长', '工作日：仅统计时长 / 休息日：仅统计时长 / 节假日：仅统计时长', '直营门店 / 经济YOUNG', '棠乐', '2026-04-21 10:37:42', '棠乐', '2026-04-21 10:37:42'],
  ['调休', '工作日：折算为调休 / 休息日：折算为调休 / 节假日：折算为调休', '家和里 / 庐山 / 项目门店', '棠乐', '2026-04-15 09:59:04', '棠乐', '2026-04-15 09:59:04'],
];
const DEFAULT_FIELD_RULE_ROWS = [
  ['外勤', '外勤打卡已启用 / 外出申请已启用', '默认考勤组', '棠乐', '2026-04-02 10:26:42', '棠乐', '2026-04-02 10:26:42'],
];
const DEFAULT_STAT_SCHEME_ROWS = [
  ['默认方案', '当月1日至当月最后一天为【当月】的一个考勤统计周期', '部门：上海拉蜜克有限公司', '部门：上海拉蜜克有限公司', '棠乐', '2026-04-15 09:46:15', '棠乐', '2026-04-15 09:46:15'],
];

function getOnboardedEmployees() {
  return getStoredRows('onboardedEmployees') || [];
}

function splitManager(managerText) {
  const text = asRawText(managerText);
  if (!text) return { managerName: '', managerNo: '' };
  const match = text.match(/^(.+?)[-/\s]+([A-Z]{1,4}\d{3,})$/i);
  return {
    managerName: asRawText(match?.[1] || text),
    managerNo: asRawText(match?.[2] || ''),
  };
}

function stableShortHash(value) {
  let hash = 0;
  for (const char of asRawText(value)) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

function normalizeReferenceEmployee(row = {}) {
  const rawEmployeeNo = asRawText(getByAliases(row, ['*员工号', '员工号', '员工工号', '工号']));
  const name = asRawText(getByAliases(row, ['*姓名', '姓名']));
  if (!name) return null;
  const idCardNo = asRawText(getByAliases(row, ['*证件号码', '证件号码']));
  const employeeNo = rawEmployeeNo || `TMP${stableShortHash(`${name}-${idCardNo}`)}`;
  const dept = asText(getByAliases(row, ['部门', '入职末级部门', '离职部门']), '未分配部门');
  const deptFullPath = asText(getByAliases(row, ['部门全路径', '部门全路径 ', '部门完整路径']), `上海拉迷家具有限公司/${dept}`);
  const manager = splitManager(getByAliases(row, ['汇报上级', '直属上级']));
  const hireDate = extractDate(getByAliases(row, ['入职日期', '实际入职日期', '到岗日期'])) || currentDateText();
  const status = asText(getByAliases(row, ['员工状态', '任职状态']), '在职');
  const employeeType = asText(getByAliases(row, ['员工类型']), '全职');
  return {
    id: `ref_${employeeNo}`,
    userId: asRawText(getByAliases(row, ['企微账号'])) || `wecom_${employeeNo}`,
    name,
    employeeNo,
    phone: asRawText(getByAliases(row, ['手机号', '手机号码'])),
    department: dept,
    deptFullPath,
    position: asText(getByAliases(row, ['岗位', '职位']), '-'),
    hireDate,
    employeeType,
    employeeStatus: status,
    managerNo: manager.managerNo,
    managerName: manager.managerName,
    businessGroup: asText(getByAliases(row, ['业务分组', '所属']), '-'),
    workPlace: asText(getByAliases(row, ['工作地点', '办公地点']), '-'),
    attendanceGroupId: 'group_huatuo',
    attendanceGroupName: asText(getByAliases(row, ['考勤组']), '华托大厦'),
    shiftId: 'shift_0900_1800',
    shiftName: asText(getByAliases(row, ['班次名称', '班次']), '早九晚六'),
    statScheme: '默认方案',
    faceStatus: asText(getByAliases(row, ['身份核验']), '未核验'),
    reviewStatus: '已通过',
    faceScore: '参考花名册',
    dataSource: '员工花名册导入',
    office: MOBILE_OFFICE,
    createdAt: hireDate,
    updatedAt: nowText(),
    idCardType: asText(getByAliases(row, ['*证件类型', '证件类型']), ''),
    idCardNo,
    email: asRawText(getByAliases(row, ['邮箱'])),
    rankCode: asText(getByAliases(row, ['职级代码']), ''),
    rankName: asText(getByAliases(row, ['职级名称']), ''),
    nickName: asText(getByAliases(row, ['花名']), ''),
    identityVerify: asText(getByAliases(row, ['身份核验']), '未核验'),
    rehired: asText(getByAliases(row, ['是否重入职']), '否'),
    onboardDate: extractDate(getByAliases(row, ['到岗日期'])) || hireDate,
    probationPlan: asText(getByAliases(row, ['计划试用期']), ''),
    regularDatePlan: extractDate(getByAliases(row, ['计划转正日期'])),
    regularDateActual: extractDate(getByAliases(row, ['实际转正日期'])),
    seniority: asText(getByAliases(row, ['司龄']), ''),
    medicalReport: asText(getByAliases(row, ['体检报告提供情况']), ''),
  };
}

function getReferenceRosterEmployees() {
  const file = getReferenceFile('员工花名册');
  if (!file) return [];
  try {
    const { rows } = readSheetRowsByHeader(file.fullPath, (name) => name.includes('花名册'), 1);
    return rows.map(normalizeReferenceEmployee).filter(Boolean);
  } catch (_error) {
    return [];
  }
}

function normalizeOnboardedEmployee(input = {}) {
  const employeeNo = asRawText(input.employeeNo || input.empId);
  const name = asRawText(input.name);
  const managerNo = asRawText(input.managerNo || input.managerEmployeeNo);
  const managerName = asRawText(input.managerName);
  const shift = resolveShiftOption(input);
  return {
    id: asRawText(input.id || `emp_${employeeNo}`),
    userId: asRawText(input.userId || `wecom_${employeeNo}`),
    name,
    employeeNo,
    department: asText(input.department || input.dept, '未分配部门'),
    deptFullPath: asText(input.deptFullPath || input.department, input.department ? `上海拉达家具有限公司/${input.department}` : '上海拉达家具有限公司/未分配部门'),
    position: asText(input.position, '-'),
    hireDate: asText(input.hireDate, currentDateText()),
    employeeType: asText(input.employeeType, '全职'),
    employeeStatus: asText(input.employeeStatus, '在职'),
    managerNo,
    managerName,
    businessGroup: asText(input.businessGroup, '-'),
    workPlace: asText(input.workPlace, '-'),
    attendanceGroupId: asText(input.attendanceGroupId, 'group_huatuo'),
    attendanceGroupName: asText(input.attendanceGroupName || input.attendGroup, '华托大厦'),
    shiftId: shift.id,
    shiftName: shift.name,
    statScheme: asText(input.statScheme, '默认方案'),
    faceStatus: asText(input.faceStatus, '已录入'),
    reviewStatus: asText(input.reviewStatus, '已通过'),
    faceScore: asText(input.faceScore, '系统录入'),
    dataSource: asText(input.dataSource, '后台录入'),
    office: input.office && typeof input.office === 'object' ? input.office : MOBILE_OFFICE,
    createdAt: asText(input.createdAt, nowText()),
    updatedAt: nowText(),
  };
}

function onboardedEmployeeToPeopleRow(employee) {
  return [
    employee.name,
    employee.employeeNo,
    employee.department,
    employee.position,
    employee.hireDate,
    employee.shiftName,
    currentDateText().slice(0, 7).replace('-', ''),
    employee.employeeType,
    employee.employeeStatus,
    employee.managerName ? `${employee.managerName} ${employee.managerNo}` : '-',
    employee.businessGroup,
    employee.workPlace,
    employee.attendanceGroupName,
    employee.statScheme,
  ];
}

function onboardedEmployeeToFaceRow(employee) {
  return [
    employee.name,
    employee.employeeNo,
    employee.department,
    employee.deptFullPath,
    employee.attendanceGroupName,
    employee.hireDate,
    employee.faceStatus,
    employee.reviewStatus,
    employee.faceScore,
    employee.managerName ? `${employee.dataSource} / 管理者：${employee.managerName}` : employee.dataSource,
  ];
}

function onboardedEmployeeToAttendanceStatsRow(employee) {
  return {
    name: employee.name,
    empId: employee.employeeNo,
    attendGroup: employee.attendanceGroupName,
    dept: employee.department,
    deptFull: employee.deptFullPath,
    shift: employee.shiftName,
    type: '移动端打卡',
    attendance: '未出勤',
    status: '未出勤',
    anomaly: '-',
    leave: '-',
    fieldTrip: '-',
    cin1: '-',
    cout1: '-',
    cin2: '-',
    cout2: '-',
    cin3: '-',
    cout3: '-',
  };
}

function linkedDemoEmployees() {
  const byEmployeeNo = new Map();
  for (const employee of getReferenceRosterEmployees()) {
    byEmployeeNo.set(asRawText(employee.employeeNo), employee);
  }
  for (const employee of getOnboardedEmployees().map(normalizeOnboardedEmployee)) {
    const employeeNo = asRawText(employee.employeeNo);
    byEmployeeNo.set(employeeNo, { ...(byEmployeeNo.get(employeeNo) || {}), ...employee });
  }
  return Array.from(byEmployeeNo.values()).filter((employee) => asRawText(employee.employeeNo));
}

function clockRowsForEmployee(employee) {
  return getMobileRows('mobileClockRecords', [])
    .filter((row) => asRawText(row.employeeNo) === asRawText(employee.employeeNo));
}

function clockRowsForEmployeeDate(employee, dateText = currentDateText()) {
  return clockRowsForEmployee(employee).filter((row) => asText(row.date, '') === dateText);
}

function clockInText(employee, rows = clockRowsForEmployee(employee)) {
  const row = rows.find((item) => item.type === 'clockIn');
  return asText(row?.time, '-');
}

function clockOutText(employee, rows = clockRowsForEmployee(employee)) {
  const row = rows.find((item) => item.type === 'clockOut');
  return asText(row?.time, '-');
}

function clockMessageText(row) {
  return asText(row?.message, row?.result === 'normal' ? '正常' : '移动端异常打卡');
}

function clockRowsHaveAnomaly(rows) {
  return rows.some((row) => asText(row.result, 'normal') !== 'normal');
}

function clockAnomalyText(rows) {
  const messages = rows
    .filter((row) => asText(row.result, 'normal') !== 'normal')
    .map(clockMessageText)
    .filter(Boolean);
  return messages.length ? [...new Set(messages)].join('；') : '-';
}

function minutesAfter(timeText, baseText = '09:00') {
  const [hour, minute] = asText(timeText, '').split(':').map(Number);
  const [baseHour, baseMinute] = asText(baseText, '').split(':').map(Number);
  if (![hour, minute, baseHour, baseMinute].every(Number.isFinite)) return 0;
  return Math.max(0, hour * 60 + minute - (baseHour * 60 + baseMinute));
}

function countUniqueClockDates(employee, periodPrefix = currentDateText().slice(0, 7)) {
  const dates = clockRowsForEmployee(employee)
    .map((row) => asText(row.date, ''))
    .filter((date) => date.startsWith(periodPrefix));
  return new Set(dates).size;
}

function scheduleRowsForEmployee(employee, periodPrefix = currentDateText().slice(0, 7)) {
  const stored = (getStoredRows('employeeSchedules') || [])
    .filter((row) => asRawText(row.employeeNo) === asRawText(employee.employeeNo)
      && asText(row.date, '').startsWith(periodPrefix));
  if (stored.length) return stored;

  const [year, month] = periodPrefix.split('-').map(Number);
  if (![year, month].every(Number.isFinite)) return [];
  const endDay = periodPrefix === currentDateText().slice(0, 7)
    ? Number(currentDateText().slice(8, 10))
    : new Date(Date.UTC(year, month, 0, 4, 0, 0)).getUTCDate();
  const shift = getEmployeeDefaultShift(employee);
  const restShift = { id: 'shift_rest', name: '休息' };
  const rows = [];
  for (let day = 1; day <= endDay; day += 1) {
    const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const workingDay = isConfiguredWorkday(employee, date);
    rows.push({
      id: `auto_${employee.employeeNo}_${date}`,
      employeeNo: employee.employeeNo,
      employeeName: employee.name,
      dept: employee.department,
      date,
      shiftId: workingDay ? shift.id : restShift.id,
      shiftName: workingDay ? shift.name : restShift.name,
      source: '考勤设置自动排班',
    });
  }
  return rows;
}

function getEmployeeSchedule(employee, dateText = currentDateText()) {
  const stored = (getStoredRows('employeeSchedules') || [])
    .find((row) => asRawText(row.employeeNo) === asRawText(employee.employeeNo)
      && asText(row.date, '') === dateText);
  if (stored) return stored;
  return scheduleRowsForEmployee(employee, dateText.slice(0, 7)).find((row) => asText(row.date, '') === dateText) || null;
}

function currentMonthWorkdayCount(employee = null) {
  const parts = currentDateText().split('-').map(Number);
  const [year, month, day] = parts;
  if (![year, month, day].every(Number.isFinite)) return 0;
  let count = 0;
  for (let cursorDay = 1; cursorDay <= day; cursorDay += 1) {
    const dateText = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(cursorDay).padStart(2, '0')}`;
    if (employee ? isConfiguredWorkday(employee, dateText) : isDefaultWeekday(dateText)) count += 1;
  }
  return count;
}

function employeeBase(employee) {
  const shift = getEmployeeDefaultShift(employee);
  return {
    name: employee.name,
    empId: employee.employeeNo,
    dept: employee.department,
    deptPath: employee.deptFullPath,
    position: employee.position,
    attendGroup: employee.attendanceGroupName,
    shiftName: shift.name,
  };
}

function isDefaultWeekday(dateText) {
  const date = new Date(`${dateText}T04:00:00Z`);
  const weekday = date.getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function weekdayNameForDate(dateText) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = new Date(`${dateText}T04:00:00Z`);
  return names[date.getUTCDay()] || '';
}

function rowMatchesAttendGroup(row, employee) {
  const text = Array.isArray(row) ? row.map((cell) => asText(cell, '')).join(' / ') : asText(row, '');
  const groupName = asText(employee?.attendanceGroupName, '');
  if (!groupName) return false;
  return text.includes(groupName) || text.includes('默认考勤组') || text.includes('通用');
}

function groupSettingForEmployee(employee) {
  const groupName = asText(employee?.attendanceGroupName, '');
  return getGroupSettingRows().find((row) => asText(row?.[0], '') === groupName)
    || getGroupSettingRows().find((row) => rowMatchesAttendGroup(row, employee))
    || null;
}

function calendarSettingForEmployee(employee) {
  return getCalendarSettingRows().find((row) => rowMatchesAttendGroup(row, employee))
    || getCalendarSettingRows()[0]
    || null;
}

function isConfiguredHoliday(dateText) {
  return getHolidaySettingRows().some((row) => Array.isArray(row) && row.some((cell) => asText(cell, '').includes(dateText)));
}

function isConfiguredWorkday(employee, dateText = currentDateText()) {
  if (isConfiguredHoliday(dateText)) return false;
  const calendar = calendarSettingForEmployee(employee);
  if (!calendar) return isDefaultWeekday(dateText);
  const weekdayName = weekdayNameForDate(dateText);
  const workdaysText = asText(calendar[2], '');
  return workdaysText ? workdaysText.includes(weekdayName) : isDefaultWeekday(dateText);
}

function getEmployeeDateType(employee, dateText = currentDateText()) {
  if (isConfiguredHoliday(dateText)) return '节假日';
  return isConfiguredWorkday(employee, dateText) ? '工作日' : '休息日';
}

function mobileSchemeForEmployee(employee) {
  const office = getEmployeeOffice(employee);
  const schemeName = asText(office.mobileScheme, '');
  return getMobileClockSettingRows().find((row) => schemeName && asText(row?.[0], '') === schemeName)
    || getMobileClockSettingRows().find((row) => rowMatchesAttendGroup(row, employee))
    || null;
}

function cardRuleForEmployee(employee) {
  return getCardRuleSettingRows().find((row) => rowMatchesAttendGroup(row, employee))
    || getCardRuleSettingRows()[0]
    || null;
}

function fieldRuleForEmployee(employee) {
  return getFieldRuleSettingRows().find((row) => rowMatchesAttendGroup(row, employee))
    || getFieldRuleSettingRows()[0]
    || null;
}

function overtimeRuleForEmployee(employee) {
  return getOvertimeRuleSettingRows().find((row) => rowMatchesAttendGroup(row, employee))
    || getOvertimeRuleSettingRows()[0]
    || null;
}

function mobileSchemeDisabled(employee) {
  const scheme = mobileSchemeForEmployee(employee);
  const content = asText(scheme?.[1], '');
  return /禁用|停用|关闭|不允许/.test(content);
}

function buildLinkedAttendanceStatsRows() {
  return linkedDemoEmployees().map((employee) => {
    const base = onboardedEmployeeToAttendanceStatsRow(employee);
    const todayRows = clockRowsForEmployeeDate(employee);
    const hasClock = todayRows.length > 0;
    const hasAnomaly = clockRowsHaveAnomaly(todayRows);
    return {
      ...base,
      type: '移动端打卡',
      attendance: hasClock ? '已出勤' : '未出勤',
      status: !hasClock ? '未打卡' : (hasAnomaly ? '异常' : '正常'),
      anomaly: hasClock ? clockAnomalyText(todayRows) : '-',
      leave: '-',
      fieldTrip: '-',
      cin1: clockInText(employee, todayRows),
      cout1: clockOutText(employee, todayRows),
    };
  });
}

function buildLinkedDailyRows() {
  return linkedDemoEmployees().map((employee) => {
    const base = employeeBase(employee);
    const dateType = getEmployeeDateType(employee, currentDateText());
    const todayRows = clockRowsForEmployeeDate(employee);
    const hasClock = todayRows.length > 0;
    const hasAnomaly = clockRowsHaveAnomaly(todayRows);
    const clockIn = clockInText(employee, todayRows);
    const clockOut = clockOutText(employee, todayRows);
    const shift = getEmployeeShift(employee);
    const isRestDay = dateType !== '工作日' || shift.name === '休息';
    return {
      name: base.name,
      confirmStatus: hasClock ? '待确认' : '未确认',
      empId: base.empId,
      date: currentDateText(),
      dept: base.dept,
      position: base.position,
      bizGroup: employee.businessGroup,
      deptFullPath: base.deptPath,
      regularDate: '-',
      attendGroup: base.attendGroup,
      shiftName: base.shiftName,
      dateType,
      weekday: currentWeekdayText().replace('星期', ''),
      attendResult: !hasClock ? (isRestDay ? '休息' : '未打卡') : (hasAnomaly ? '异常' : '正常'),
      anomalyDesc: hasClock ? clockAnomalyText(todayRows) : (isRestDay ? '' : '未打卡'),
      taskSummary: hasClock ? `打卡${todayRows.length}次` : '-',
      normalHours: clockIn !== '-' && clockOut !== '-' ? 8 : 0,
      lateMinutes: minutesAfter(clockIn, shift.clockInTime || MOBILE_SHIFT.clockInTime),
    };
  });
}

function buildLinkedMonthlyRows() {
  const period = currentDateText().slice(0, 7);
  return linkedDemoEmployees().map((employee) => {
    const base = employeeBase(employee);
    const dayResults = {};
    for (const row of scheduleRowsForEmployee(employee, period)) {
      const day = String(Number(asText(row.date, '').slice(8, 10)));
      if (!day || day === 'NaN') continue;
      const shiftName = asText(row.shiftName, '');
      dayResults[day] = shiftName === '休息' ? '休' : shiftName || '已排班';
    }
    for (const row of clockRowsForEmployee(employee).filter((item) => asText(item.date, '').startsWith(period))) {
      const day = String(Number(asText(row.date, '').slice(8, 10)));
      if (!day || day === 'NaN') continue;
      const previous = dayResults[day];
      const result = asText(row.result, 'normal') === 'normal' ? '正常' : '异常';
      dayResults[day] = result === '异常' ? result : (previous || result);
    }
    return {
      name: base.name,
      empId: base.empId,
      dept: base.dept,
      position: base.position,
      attendGroup: base.attendGroup,
      deptFullPath: base.deptPath,
      bizGroup: employee.businessGroup,
      dayResults,
    };
  });
}

function buildLinkedMonthlySummaryRows() {
  const period = currentDateText().slice(0, 7);
  const externalValues = externalMetricValuesByEmployee(period);
  return linkedDemoEmployees().map((employee, index) => {
    const base = employeeBase(employee);
    const shouldWorkDays = currentMonthWorkdayCount(employee);
    const monthRows = clockRowsForEmployee(employee).filter((row) => asText(row.date, '').startsWith(period));
    const scheduledRows = scheduleRowsForEmployee(employee, period);
    const scheduleDays = scheduledRows.filter((row) => asText(row.shiftName, '') !== '休息').length;
    const actualWorkDays = countUniqueClockDates(employee, period);
    const lateMinutes = monthRows
      .filter((row) => row.type === 'clockIn')
      .reduce((sum, row) => {
        const shift = getEmployeeShift(employee, asText(row.date, currentDateText()));
        return sum + minutesAfter(row.time, shift.clockInTime || MOBILE_SHIFT.clockInTime);
      }, 0);
    return {
      id: index + 1,
      name: base.name,
      lockStatus: '未锁定',
      empId: base.empId,
      dept: base.dept,
      position: base.position,
      hireDate: employee.hireDate,
      resignDate: '',
      deptFullPath: base.deptPath,
      bizGroup: employee.businessGroup,
      attendGroup: base.attendGroup,
      shouldWorkDays,
      actualWorkDays,
      absentDays: Math.max(0, shouldWorkDays - actualWorkDays),
      tripDays: 0,
      scheduleDays,
      normalHours: actualWorkDays * 8,
      lateMinutes,
      earlyLeaveMinutes: 0,
      confirmStatus: monthRows.length ? '未发送' : '未生成',
      customMetrics: externalValues.get(asRawText(employee.employeeNo)) || {},
    };
  });
}

function buildLinkedAnomalyRows() {
  return mapMobileAnomalyRowsToAdmin(filterRowsToOnboardedEmployees(getMobileRows('mobileAnomalies', [])));
}

function buildLinkedWorkDataRows() {
  return mapMobileMakeupRowsToAdmin(filterRowsToOnboardedEmployees(getMobileRows('mobileMakeupRequests', [])))
    .map((row) => ({
      id: row.id,
      applicant: row.applicant,
      applicantId: row.applicantId,
      applicantDept: row.applicantDept,
      applyType: '补卡',
      initiator: row.initiator,
      initiatorId: row.initiatorId,
      initiateTime: row.initiateTime,
      completeTime: row.completeTime,
      bizDate: row.makeupDate,
      summary: `${row.makeupTime} ${row.reason || '补卡申请'}`,
      approvalStatus: row.status,
      cancelStatus: '未申请取消',
    }));
}

function buildLinkedOvertimeRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('overtimeRecords') || []);
}

function buildLinkedFieldOutRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('fieldOutRecords') || []);
}

function buildLinkedFieldTripRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('fieldTripRecords') || []);
}

function buildLinkedLeaveRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('leaveRecords') || []);
}

function buildLinkedLeaveBalanceRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('leaveBalances') || []);
}

function buildLinkedLeaveDetailRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('leaveDetails') || []);
}

const DEFAULT_LEAVE_TYPE_ROWS = [
  { name: '年假', short: '年', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '否', note: '年假额度可根据员工司龄自动发放，支持跨周期结转。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:17' },
  { name: '病假', short: '病', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '病假需员工上传病历或就诊凭证，系统支持按天或小时折算。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:08' },
  { name: '事假', short: '事', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '个人事务请假，审批通过后进入月度假勤统计。', reason: '是', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:08' },
  { name: '婚假', short: '婚', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '否', note: '婚假按法定或公司规定执行，支持一次性发放。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:22' },
  { name: '产假', short: '产', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '是', note: '产假支持前置请假及分段休假，系统可自动关联哺乳假规则。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:27' },
  { name: '调休假', short: '调', enabled: true, unit: '按小时请假', paid: '否', negative: '否', before: '否', note: '加班转调休产生的额度，优先消耗近期生成的调休额度。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:54' },
];

function getLeaveTypeRows() {
  const storedRows = getStoredRows('leaveTypes');
  return storedRows && storedRows.length ? storedRows : DEFAULT_LEAVE_TYPE_ROWS;
}

function getLeaveSchemeRows() {
  const storedRows = getStoredRows('leaveSchemes');
  return storedRows || [];
}

function saveRowsEndpoint(req, res, key, sheetName, normalizer = (row) => row) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ message: 'rows必须是数组' });
  const normalizedRows = rows.map(normalizer).filter(Boolean);
  setStoredRows(key, normalizedRows);
  return sendLinkedRows(res, sheetName, normalizedRows);
}

function buildLinkedMakeupRows() {
  return mapMobileMakeupRowsToAdmin(filterRowsToOnboardedEmployees(getMobileRows('mobileMakeupRequests', [])));
}

function buildLinkedExternalRows() {
  return filterRowsToOnboardedEmployees(getStoredRows('externalRecords') || []);
}

function statItemAppliesToMonth(item) {
  const scope = asText(item?.scope, '日考勤统计与月汇总');
  return scope === '日考勤统计与月汇总' || scope === '月考勤汇总';
}

function externalMetricValuesByEmployee(period) {
  const enabledItems = getStatItemRows()
    .filter((item) => item.enabled !== false && statItemAppliesToMonth(item) && (item.isCustom || item.externalEnabled))
    .map((item) => asText(item.name, ''))
    .filter(Boolean);
  const enabledSet = new Set(enabledItems);
  const values = new Map();
  for (const row of buildLinkedExternalRows()) {
    const itemName = asText(row.statItem, '');
    if (!enabledSet.has(itemName)) continue;
    const rowPeriod = asText(row.period, '');
    const rowDate = asText(row.attendDate, '');
    if (period && rowPeriod && rowPeriod !== period && !rowDate.startsWith(period)) continue;
    const empId = asRawText(row.empId || row.employeeNo || row.employeeId);
    if (!empId) continue;
    const current = values.get(empId) || {};
    const numeric = Number(String(row.statValue ?? '').replace(/,/g, ''));
    if (!Number.isNaN(numeric) && String(row.statValue ?? '').trim() !== '') {
      current[itemName] = Number(((Number(current[itemName]) || 0) + numeric).toFixed(2));
    } else {
      current[itemName] = asText(row.statValue, current[itemName] || '-');
    }
    values.set(empId, current);
  }
  return values;
}

function approvalStatusText(status) {
  const raw = asRawText(status);
  if (!raw || raw === 'pending') return '审批中';
  if (raw === 'approved') return '已通过';
  if (raw === 'rejected') return '已拒绝';
  return raw;
}

function normalizeApprovalAction(action) {
  const raw = asRawText(action);
  if (['approved', '已通过', '通过'].includes(raw)) return { raw: 'approved', text: '已通过' };
  if (['rejected', '已拒绝', '拒绝'].includes(raw)) return { raw: 'rejected', text: '已拒绝' };
  return null;
}

function managedEmployeeNoSet(managerEmployee) {
  const managerNo = asRawText(managerEmployee?.employeeNo);
  return new Set(linkedDemoEmployees()
    .filter((employee) => managerNo && asRawText(employee.managerNo) === managerNo)
    .map((employee) => asRawText(employee.employeeNo)));
}

function filterRowsToManagerEmployees(rows, managerEmployee) {
  const employeeNos = managedEmployeeNoSet(managerEmployee);
  if (!employeeNos.size) return [];
  return rows.filter((row) => employeeNos.has(asRawText(row.employeeNo || row.empId || row.employeeId || row.applicantId)));
}

function mobileApprovalRows(managerEmployee = null) {
  const makeupRows = filterRowsToOnboardedEmployees(getMobileRows('mobileMakeupRequests', []))
    .map((row) => ({
      id: `makeup:${row.id}`,
      source: 'mobileMakeupRequests',
      sourceId: row.id,
      category: '补卡',
      employeeName: asText(row.employeeName, ''),
      employeeNo: asText(row.employeeNo, ''),
      dept: asText(row.dept, ''),
      date: asText(row.date, currentDateText()),
      time: asText(row.time, ''),
      reason: asText(row.reason, '补卡申请'),
      status: approvalStatusText(row.status),
      createTime: asText(row.createTime, ''),
      detail: `${asText(row.type, '补卡')} ${asText(row.time, '')}`,
    }));

  const anomalyRows = filterRowsToOnboardedEmployees(getMobileRows('mobileAnomalies', []))
    .map((row) => ({
      id: `anomaly:${row.id}`,
      source: 'mobileAnomalies',
      sourceId: row.id,
      category: '异常复核',
      employeeName: asText(row.employeeName, ''),
      employeeNo: asText(row.employeeNo, ''),
      dept: asText(row.dept, ''),
      date: asText(row.date, currentDateText()),
      time: '',
      reason: asText(row.desc, '移动端异常打卡'),
      status: row.handled ? approvalStatusText(row.status) : '审批中',
      createTime: '',
      detail: asText(row.shiftName, ''),
    }));

  const genericRows = filterRowsToOnboardedEmployees(getMobileRows('mobileApprovalRequests', []))
    .map((row) => ({
      id: `approval:${row.id}`,
      source: 'mobileApprovalRequests',
      sourceId: row.id,
      category: asText(row.category, '异常处理'),
      employeeName: asText(row.employeeName, ''),
      employeeNo: asText(row.employeeNo, ''),
      dept: asText(row.dept, ''),
      date: asText(row.date, currentDateText()),
      time: asText(row.time, ''),
      reason: asText(row.reason, ''),
      status: approvalStatusText(row.status),
      createTime: asText(row.createTime, ''),
      detail: asText(row.detail, ''),
    }));

  const rows = [...makeupRows, ...anomalyRows, ...genericRows];
  const scopedRows = managerEmployee ? filterRowsToManagerEmployees(rows, managerEmployee) : rows;
  return scopedRows
    .sort((a, b) => asText(b.createTime || b.date, '').localeCompare(asText(a.createTime || a.date, '')));
}

function updateApprovalRow(approvalId, action) {
  const [source, sourceId] = asRawText(approvalId).split(':');
  const next = normalizeApprovalAction(action);
  if (!source || !sourceId || !next) return null;
  const store = readStore();
  const keyBySource = {
    makeup: 'mobileMakeupRequests',
    anomaly: 'mobileAnomalies',
    approval: 'mobileApprovalRequests',
  };
  const key = keyBySource[source];
  const rows = Array.isArray(store[key]) ? store[key] : [];
  let updated = null;
  store[key] = rows.map((row) => {
    if (asRawText(row.id) !== sourceId) return row;
    updated = {
      ...row,
      status: next.text,
      handled: source === 'anomaly' ? true : row.handled,
      reviewTime: nowText(),
    };
    return updated;
  });
  if (!updated) return null;
  store.updatedAt = new Date().toISOString();
  writeStore(store);
  return updated;
}

function scheduleRowsForDate(dateText = currentDateText(), managerEmployee = null) {
  const schedules = getStoredRows('employeeSchedules') || [];
  const scheduleByEmployee = new Map(
    schedules
      .filter((row) => asText(row.date, '') === dateText)
      .map((row) => [asRawText(row.employeeNo), row]),
  );
  const employees = managerEmployee
    ? linkedDemoEmployees().filter((employee) => asRawText(employee.managerNo) === asRawText(managerEmployee.employeeNo))
    : linkedDemoEmployees();
  return employees.map((employee) => {
    const schedule = scheduleByEmployee.get(asRawText(employee.employeeNo));
    return {
      id: `${dateText}:${employee.employeeNo}`,
      date: dateText,
      employeeName: employee.name,
      employeeNo: employee.employeeNo,
      dept: employee.department,
      position: employee.position,
      managerNo: employee.managerNo,
      managerName: employee.managerName,
      shiftId: asText(schedule?.shiftId, ''),
      shiftName: asText(schedule?.shiftName, ''),
      status: schedule ? '已排班' : '未排班',
      updatedAt: asText(schedule?.updatedAt, ''),
    };
  });
}

function scheduleMonthStatuses(monthText = currentDateText().slice(0, 7), managerEmployee = null) {
  return monthDates(monthText).map((date) => {
    const rows = scheduleRowsForDate(date, managerEmployee);
    const missing = rows.filter((row) => row.status === '未排班').length;
    const scheduled = rows.length - missing;
    return {
      date,
      total: rows.length,
      scheduled,
      missing,
      status: rows.length > 0 && missing === 0 ? 'complete' : 'missing',
    };
  });
}

function upsertSchedule(row) {
  const schedules = getStoredRows('employeeSchedules') || [];
  const dateText = asText(row.date, currentDateText());
  const employeeNo = asRawText(row.employeeNo);
  const shift = resolveShiftOption(row);
  const next = {
    id: `${dateText}:${employeeNo}`,
    date: dateText,
    employeeNo,
    employeeName: asText(row.employeeName, ''),
    dept: asText(row.dept, ''),
    managerNo: asText(row.managerNo, ''),
    managerName: asText(row.managerName, ''),
    shiftId: shift.id,
    shiftName: shift.name,
    updatedAt: nowText(),
  };
  const nextRows = [
    next,
    ...schedules.filter((item) => !(asText(item.date, '') === dateText && asRawText(item.employeeNo) === employeeNo)),
  ];
  setStoredRows('employeeSchedules', nextRows);
  return next;
}

function copyManagerScheduleDay(managerEmployee, sourceDate, targetDate) {
  const sourceRows = scheduleRowsForDate(sourceDate, managerEmployee).filter((row) => row.status === '已排班');
  const copied = sourceRows.map((row) => upsertSchedule({
    date: targetDate,
    employeeNo: row.employeeNo,
    employeeName: row.employeeName,
    dept: row.dept,
    managerNo: managerEmployee.employeeNo,
    managerName: managerEmployee.name,
    shiftId: row.shiftId,
    shiftName: row.shiftName,
  }));
  return { sourceDate, targetDate, copied };
}

function rowMatchesEmployeeNo(row, employeeNoSet) {
  if (!row) return false;
  if (Array.isArray(row)) {
    return employeeNoSet.has(asRawText(row[1] || row[2] || row[0]));
  }
  return employeeNoSet.has(asRawText(
    row.employeeNo
    || row.empId
    || row.employeeId
    || row.applicantId
    || row.initiatorId
    || row.id,
  ));
}

function deleteOnboardedEmployees(employeeNos) {
  const employeeNoSet = new Set(employeeNos.map(asRawText).filter(Boolean));
  const store = readStore();
  const beforeEmployees = Array.isArray(store.onboardedEmployees) ? store.onboardedEmployees : [];
  const removedEmployees = beforeEmployees.filter((row) => employeeNoSet.has(asRawText(row.employeeNo)));
  const removedIds = new Set(removedEmployees.map((row) => asRawText(row.id)).filter(Boolean));
  const matchesEmployee = (row) => rowMatchesEmployeeNo(row, employeeNoSet) || removedIds.has(asRawText(row?.employeeId));

  store.onboardedEmployees = beforeEmployees.filter((row) => !employeeNoSet.has(asRawText(row.employeeNo)));

  [
    'mobileClockRecords',
    'mobileAnomalies',
    'mobileMakeupRequests',
    'mobileApprovalRequests',
    'employeeSchedules',
    'dailyAttendance',
    'monthlyAttendance',
    'monthlySummary',
    'attendanceAnomalies',
    'workData',
    'externalRecords',
  ].forEach((key) => {
    if (Array.isArray(store[key])) {
      store[key] = store[key].filter((row) => !matchesEmployee(row));
    }
  });

  store.updatedAt = new Date().toISOString();
  writeStore(store);
  return {
    removed: removedEmployees.length,
    remaining: store.onboardedEmployees.length,
    removedEmployees,
  };
}

function mapStatItemRows(rows) {
  const sample = rows[0] || {};
  return Object.keys(sample).map((name, index) => {
    const isNumber = rows.slice(0, 20).some((row) => String(row[name] ?? '').trim() !== '' && !Number.isNaN(Number(String(row[name]).replace(/,/g, ''))));
    const category = name.includes('姓名') || name.includes('员工') || name.includes('部门') || name.includes('岗位') || name.includes('入职') ? '人事基础'
      : name.includes('打卡') ? '打卡信息'
      : name.includes('假') ? '请假时长'
      : name.includes('加班') ? '加班信息'
      : '考勤基础';
    return {
      id: index + 1,
      name,
      module: name.includes('薪') || name.includes('加班') || name.includes('时长') ? '薪资核算' : '基础考勤',
      category,
      desc: `来自真实Excel字段：${name}`,
      enabled: true,
      hasFormula: isNumber,
      dataType: isNumber ? '数值型' : name.includes('日期') ? '日期型' : '文本型',
      isCustom: false,
    };
  });
}

function mapWorkDataRows(rows) {
  let id = 1;
  const result = [];
  for (const row of rows.slice(0, 1000)) {
    const applicant = asText(getByAliases(row, ['姓名']), '-');
    if (applicant === '-') continue;
    const empId = asText(getByAliases(row, ['员工号', '员工工号', '工号']), '');
    const dept = asText(getByAliases(row, ['部门']), '');
    const period = asText(getByAliases(row, ['考勤周期']), '202605');
    const bizDate = `${String(period).slice(0, 4)}-${String(period).slice(4, 6) || '05'}`;
    const items = [
      ['出差', asNum(getByAliases(row, ['出差天数']))],
      ['加班', asNum(getByAliases(row, ['加班时长(小时)', '工作日加班(小时)', '休息日加班(小时)', '节假日加班(小时)']))],
      ['年假', asNum(getByAliases(row, ['年假时长(天)']))],
      ['事假', asNum(getByAliases(row, ['事假时长(天)']))],
      ['病假', asNum(getByAliases(row, ['短期病假时长(天)']))],
    ];
    for (const [applyType, amount] of items) {
      if (!amount) continue;
      result.push({
        id: id++,
        applicant,
        applicantId: empId,
        applicantDept: dept,
        applyType,
        initiator: applicant,
        initiatorId: empId,
        initiateTime: `${bizDate}-01 09:00`,
        completeTime: `${bizDate}-01 09:10`,
        bizDate,
        summary: `${applyType}${amount}${applyType === '加班' ? '小时' : '天'}`,
        approvalStatus: '已通过',
        cancelStatus: '未申请取消',
      });
    }
  }
  if (result.length === 0) {
    rows.slice(0, 100).forEach((row) => {
      const applicant = asText(getByAliases(row, ['姓名']), '-');
      if (applicant === '-') return;
      const empId = asText(getByAliases(row, ['员工号', '员工工号', '工号']), '');
      const dept = asText(getByAliases(row, ['部门']), '');
      const period = asText(getByAliases(row, ['考勤周期']), '202605');
      const bizDate = `${String(period).slice(0, 4)}-${String(period).slice(4, 6) || '05'}`;
      result.push({
        id: id++,
        applicant,
        applicantId: empId,
        applicantDept: dept,
        applyType: '月度统计',
        initiator: '系统导入',
        initiatorId: 'system',
        initiateTime: `${bizDate}-01 02:00`,
        completeTime: `${bizDate}-01 02:10`,
        bizDate,
        summary: `应出勤${asNum(getByAliases(row, ['应出勤天数']))}天，实际出勤${asNum(getByAliases(row, ['实际出勤天数']))}天`,
        approvalStatus: '已通过',
        cancelStatus: '未申请取消',
      });
    });
  }
  return result;
}

function mapExternalRows(rows, filename) {
  const period = inferPeriodFromFileName(filename);
  let id = 1;
  return rows.slice(0, 3000).map((row) => ({
    id: id++,
    module: asText(getByAliases(row, ['应用模块', '模块']), '基础考勤'),
    attendDate: asText(getByAliases(row, ['考勤日期', '日期', '统计日期', '打卡日期']), '-'),
    period: asText(getByAliases(row, ['考勤周期']), period),
    statItem: asText(getByAliases(row, ['统计项', '项目', '项', '考勤项', '指标', '类型']), '导入数据'),
    statValue: getByAliases(row, ['统计项值', '值', '数量', '时长', '天数', '工时', '实际出勤天数', '迟到次数', '月缺卡次数']) || '-',
    creator: '系统导入',
    createTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
    modifier: '',
    modifyTime: '',
  }));
}

function sendMappedRows(res, file, sheetMatcher, mapper, emptyMessage, options = {}) {
  try {
    if (!file) return res.status(404).json({ message: emptyMessage });
    const { rows, sheetName } = readSheetRows(file.fullPath, sheetMatcher);
    const data = mapper(rows);
    return res.json({ sourceFile: file.name, sheetName, total: data.length, rows: data });
  } catch (error) {
    return res.status(500).json({ message: '读取真实数据失败', detail: String(error?.message || error) });
  }
}

function readMappedRows(file, sheetMatcher, mapper) {
  if (!file) return { rows: [], sheetName: '' };
  const { rows, sheetName } = readSheetRows(file.fullPath, sheetMatcher);
  return { rows: mapper(rows), sheetName };
}

function sendLinkedRows(res, sheetName, rows, extra = {}) {
  return res.json({
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName,
    total: rows.length,
    rows,
    linkedOnly: true,
    ...extra,
  });
}

function getOnboardedEmployeeNoSet() {
  return new Set(employeeMasterRows().map((employee) => asRawText(employee.employeeNo)).filter(Boolean));
}

function filterRowsToOnboardedEmployees(rows) {
  const employeeNos = getOnboardedEmployeeNoSet();
  if (!employeeNos.size) return [];
  return rows.filter((row) => {
    if (Array.isArray(row)) {
      return row.some((cell) => employeeNos.has(asRawText(cell)));
    }
    return employeeNos.has(asRawText(row.employeeNo || row.empId || row.employeeId));
  });
}

function employeeMasterRows() {
  return linkedDemoEmployees();
}

function employeeRosterRows() {
  return employeeMasterRows().map((employee, index) => ({
    id: index + 1,
    name: employee.name,
    phone: asText(employee.phone, ''),
    employeeNo: employee.employeeNo,
    dept: employee.department,
    deptFullPath: employee.deptFullPath,
    position: employee.position,
    hireDate: employee.hireDate,
    employeeType: employee.employeeType,
    employeeStatus: employee.employeeStatus,
    identityVerify: asText(employee.identityVerify || employee.faceStatus, '未核验'),
    managerName: employee.managerName,
    managerNo: employee.managerNo,
    source: employee.dataSource,
  }));
}

function employeeSummary() {
  const employees = employeeMasterRows();
  const roster = employeeRosterRows();
  const contracts = readEmployeeContractRows('all').rows;
  const onboard = readEmploymentRows('onboarded').rows;
  const resigning = readEmploymentRows('resigning').rows;
  const transferring = readEmploymentRows('transferring').rows;
  const regularized = readEmploymentRows('regularized').rows;
  const inTrial = roster.filter((row) => /试用/.test(row.employeeStatus)).length;
  const active = roster.filter((row) => !/离职/.test(row.employeeStatus)).length;
  return {
    employeeTotal: employees.length,
    active,
    trial: inTrial,
    outsourced: roster.filter((row) => /外包|爱才|科讯/.test(row.employeeType)).length,
    fullTime: roster.filter((row) => /全职/.test(row.employeeType)).length,
    pendingOnboard: readEmploymentRows('pendingOnboard').rows.length,
    onboarded: onboard.length,
    resigning: resigning.length,
    transferring: transferring.length,
    regularized: regularized.length,
    contracts: contracts.length,
    contractPendingSign: contracts.filter((row) => /待|签署中|未签/.test(row.signProgress || row.contractStatus || '')).length,
    contractExpiring: readEmployeeContractRows('renewal').rows.length,
    identityUnverified: roster.filter((row) => /未/.test(row.identityVerify)).length,
    sourceFile: '参考图片/功能/员工管理',
  };
}

function normalizeGenericRow(row, index) {
  return { id: index + 1, ...row };
}

function readReferenceRows(file, sheetMatcher, options = {}) {
  if (!file) return { sourceFile: '', sheetName: '', rows: [] };
  const reader = options.headerRowIndex === undefined ? readSheetRows : readSheetRowsByHeader;
  const { rows, sheetName } = reader(file.fullPath, sheetMatcher, options.headerRowIndex || 0);
  return {
    sourceFile: file.name,
    sheetName,
    rows: rows.map(normalizeGenericRow),
  };
}

function readEducationRows() {
  const file = getReferenceFile('教育经历');
  return readReferenceRows(file, (name) => name.includes('教育经历'));
}

const EMPLOYMENT_FILE_MAP = {
  pendingOnboard: ['已入职'],
  onboarded: ['已入职'],
  abandoned: ['放弃入职'],
  regularized: ['已转正'],
  regularizing: ['全部转正'],
  transferring: ['调动中'],
  transferred: ['已调动'],
  transferAll: ['全部调动'],
  resigning: ['离职中'],
  resigned: ['已离职'],
  resignAll: ['全部离职'],
  concurrent: ['兼任_20260522'],
  concurrentRecords: ['兼任记录'],
  mainJobRecords: ['主岗任职记录'],
};

function readEmploymentRows(type = 'mainJobRecords') {
  const keywords = EMPLOYMENT_FILE_MAP[type] || EMPLOYMENT_FILE_MAP.mainJobRecords;
  const file = getReferenceFile(...keywords);
  return readReferenceRows(file);
}

const CONTRACT_FILE_MAP = {
  all: ['员工合同'],
  newSign: ['入职新签'],
  renewal: ['到期续签'],
  signing: ['签署中'],
  signRecords: ['全部签署记录'],
  releaseRecords: ['全部解除记录'],
};

function normalizeContractRow(row, index) {
  return {
    id: index + 1,
    name: asText(getByAliases(row, ['*姓名', '姓名']), ''),
    employeeNo: asText(getByAliases(row, ['*员工号', '员工号']), ''),
    dept: asText(getByAliases(row, ['部门']), ''),
    deptFullPath: asText(getByAliases(row, ['部门全路径']), ''),
    position: asText(getByAliases(row, ['岗位']), ''),
    company: asText(getByAliases(row, ['合同公司']), ''),
    contractNo: asText(getByAliases(row, ['合同编号']), ''),
    contractType: asText(getByAliases(row, ['合同类型']), ''),
    contractTerm: asText(getByAliases(row, ['合同期限']), ''),
    startDate: extractDate(getByAliases(row, ['合同起始日'])),
    endDate: extractDate(getByAliases(row, ['合同到期日'])),
    contractStatus: asText(getByAliases(row, ['合同状态', '员工状态']), ''),
    signMethod: asText(getByAliases(row, ['签署方式']), ''),
    signProgress: asText(getByAliases(row, ['签署进度', '电子签署进度']), ''),
    employeeAuthStatus: asText(getByAliases(row, ['员工授权状态']), ''),
    dataSource: asText(getByAliases(row, ['数据来源']), ''),
    initiator: asText(getByAliases(row, ['发起人']), ''),
    handler: asText(getByAliases(row, ['经办人']), ''),
    initiateTime: asText(getByAliases(row, ['发起时间']), ''),
  };
}

function readEmployeeContractRows(type = 'all') {
  const keywords = CONTRACT_FILE_MAP[type] || CONTRACT_FILE_MAP.all;
  const file = getReferenceFile(...keywords);
  if (!file) return { sourceFile: '', sheetName: '', rows: [] };
  const { rows, sheetName } = readSheetRows(file.fullPath);
  return { sourceFile: file.name, sheetName, rows: rows.map(normalizeContractRow).filter((row) => row.name) };
}

function employeeArchiveApprovalRows() {
  const employees = employeeRosterRows().filter((row) => /未/.test(row.identityVerify)).slice(0, 80);
  return employees.map((employee, index) => ({
    id: index + 1,
    applicant: employee.name,
    employeeNo: employee.employeeNo,
    dept: employee.dept,
    changeType: '档案信息补全',
    field: '身份核验 / 联系方式 / 合同信息',
    status: index % 3 === 0 ? '审批中' : '待提交',
    initiator: employee.managerName || '系统',
    createTime: nowText(),
  }));
}

function employeeCareRows() {
  return employeeRosterRows().slice(0, 120).map((employee, index) => ({
    id: index + 1,
    name: employee.name,
    employeeNo: employee.employeeNo,
    dept: employee.dept,
    careType: index % 4 === 0 ? '转正提醒' : index % 4 === 1 ? '合同续签提醒' : index % 4 === 2 ? '入职关怀' : '档案补全提醒',
    dueDate: addDays(currentDateText(), index % 21),
    status: index % 5 === 0 ? '已处理' : '待跟进',
    owner: employee.managerName || 'HR',
  }));
}

function employeeReportRows() {
  const deptMap = new Map();
  for (const employee of employeeRosterRows()) {
    const key = employee.dept || '未分配部门';
    const current = deptMap.get(key) || { dept: key, total: 0, active: 0, trial: 0, outsourced: 0 };
    current.total += 1;
    if (!/离职/.test(employee.employeeStatus)) current.active += 1;
    if (/试用/.test(employee.employeeStatus)) current.trial += 1;
    if (/外包|爱才|科讯/.test(employee.employeeType)) current.outsourced += 1;
    deptMap.set(key, current);
  }
  return Array.from(deptMap.values()).sort((a, b) => b.total - a.total).map((row, index) => ({ id: index + 1, ...row }));
}

function employeeServiceRows() {
  return [
    { id: 1, service: '员工自助档案', scope: '移动端', status: '已启用', linkedData: '花名册 / 合同 / 考勤人员' },
    { id: 2, service: '入职材料提交', scope: '移动端', status: '已启用', linkedData: '入职管理 / 员工档案库' },
    { id: 3, service: '合同签署提醒', scope: '移动端 + 管理端', status: '已启用', linkedData: '员工合同 / 人事提醒' },
    { id: 4, service: '考勤人员同步', scope: '考勤管理', status: '已启用', linkedData: '员工主数据 / 考勤人员 / 排班' },
  ];
}

function thirdPartyRows() {
  return [
    { id: 1, platform: '企业微信通讯录', data: '姓名、手机号、部门、工号', status: '已接入', syncMode: '按员工号去重' },
    { id: 2, platform: '电子合同服务', data: '合同状态、签署进度、授权状态', status: '已接入', syncMode: '按合同记录同步' },
    { id: 3, platform: '考勤小程序', data: '员工号、部门、班次、考勤组', status: '已接入', syncMode: '同源读取员工主数据' },
  ];
}

function listOrgReferenceFiles() {
  if (!fs.existsSync(ORGANIZATION_REFERENCE_DIR)) return [];
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (/\.xlsx?$/i.test(name)) {
        files.push({ name, fullPath, stat });
      }
    }
  };
  walk(ORGANIZATION_REFERENCE_DIR);
  return files.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
}

function getOrgReferenceFile(...keywords) {
  return listOrgReferenceFiles()
    .filter((file) => keywords.every((keyword) => file.name.includes(keyword)))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0] || null;
}

function organizationEmployeesFrom(employees, fullPath, name) {
  const pathText = asRawText(fullPath);
  const nameText = asRawText(name);
  return employees.filter((employee) => {
    const employeePath = asRawText(employee.deptFullPath);
    const dept = asRawText(employee.dept);
    return Boolean(pathText && (employeePath === pathText || employeePath.startsWith(`${pathText}/`))) || Boolean(nameText && dept === nameText);
  });
}

function directOrganizationEmployeesFrom(employees, fullPath, name) {
  const pathText = asRawText(fullPath);
  const nameText = asRawText(name);
  return employees.filter((employee) => asRawText(employee.deptFullPath) === pathText || asRawText(employee.dept) === nameText);
}

function normalizeOrganizationRow(row = {}, index = 0, employees = []) {
  const fullPath = asText(row.fullPath || getByAliases(row, ['组织全路径', '组织完整路径']), '');
  const name = asText(row.name || getByAliases(row, ['组织名称']), fullPath.split('/').pop() || '');
  if (!fullPath || !name) return null;
  const code = asText(row.code || getByAliases(row, ['组织编码']), `ORG${String(index + 1).padStart(4, '0')}`);
  const linkedEmployees = organizationEmployeesFrom(employees, fullPath, name);
  const directEmployees = directOrganizationEmployeesFrom(employees, fullPath, name);
  return {
    id: index + 1,
    code,
    name,
    fullPath,
    parentCode: asText(row.parentCode || getByAliases(row, ['上级组织编码']), ''),
    institutionNo: asText(row.institutionNo || getByAliases(row, ['机构号']), ''),
    leader: asText(row.leader || getByAliases(row, ['组织负责人']), ''),
    approvalManager: asText(row.approvalManager || getByAliases(row, ['审批主管']), ''),
    employeeCount: asNum(getByAliases(row, ['员工人数'])),
    linkedEmployeeCount: linkedEmployees.length,
    directMemberCount: asNum(getByAliases(row, ['直属成员人数'])) || directEmployees.length,
    linkedDirectMemberCount: directEmployees.length,
    orgType: asText(row.orgType || getByAliases(row, ['组织类型名称', '组织类型']), '部门'),
    effectiveDate: extractDate(row.effectiveDate || getByAliases(row, ['生效日期'])),
    createdAt: asText(row.createdAt || getByAliases(row, ['创建时间']), ''),
    status: asText(row.status || getByAliases(row, ['状态']), '生效中'),
    remark: asText(row.remark || getByAliases(row, ['备注']), ''),
    source: '组织架构信息导出.xlsx',
  };
}

function organizationRows() {
  const file = getOrgReferenceFile('组织架构信息导出');
  const employees = employeeRosterRows();
  let rows = [];
  let sheetName = '';
  if (file) {
    const data = readSheetRows(file.fullPath, (name) => name.includes('组织架构'));
    sheetName = data.sheetName;
    rows = data.rows.map((row, index) => normalizeOrganizationRow(row, index, employees)).filter(Boolean);
  }

  const customRows = getStoredRows('organizationStructures') || [];
  const byCode = new Map(rows.map((row) => [asRawText(row.code), row]));
  for (const custom of customRows) {
    const normalized = normalizeOrganizationRow(custom, byCode.size, employees);
    if (normalized) {
      byCode.set(asRawText(normalized.code), { ...normalized, ...custom, source: '本地组织管理保存' });
    }
  }

  const merged = Array.from(byCode.values()).map((row, index) => ({ ...row, id: index + 1 }));
  const byOrgCode = new Map(merged.map((row) => [asRawText(row.code), row]));
  return {
    sourceFile: file?.name || '本地组织管理保存',
    sheetName,
    rows: merged
      .map((row) => ({
        ...row,
        parentName: asText(byOrgCode.get(asRawText(row.parentCode))?.name, ''),
        depth: Math.max(0, asRawText(row.fullPath).split('/').length - 1),
      })),
  };
}

function rowCellsByHeader(headers, row, headerName) {
  return headers
    .map((header, index) => (String(header || '').includes(headerName) ? asRawText(row[index]) : ''))
    .filter(Boolean);
}

function positionRows() {
  const file = getOrgReferenceFile('已有岗位数据') || getOrgReferenceFile('岗位');
  const employees = employeeRosterRows();
  let rows = [];
  let sheetName = '';
  if (file) {
    const wb = xlsx.readFile(file.fullPath, { cellDates: true });
    sheetName = wb.SheetNames.find((name) => name.includes('岗位数据')) || wb.SheetNames[0];
    const sheetRows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false, header: 1 });
    const headerIndex = sheetRows.findIndex((row) => normalizeKey(row[0]) === normalizeKey('岗位编码') && normalizeKey(row[1]).includes(normalizeKey('岗位名称')));
    const headers = sheetRows[headerIndex] || [];
    rows = sheetRows.slice(headerIndex + 1).map((row, index) => {
      const code = asText(row[0], '');
      const name = asText(row[1], '');
      if (!name) return null;
      const orgs = rowCellsByHeader(headers, row, '所属组织');
      const companies = rowCellsByHeader(headers, row, '适用公司');
      const statusIndex = headers.findIndex((header) => String(header || '').includes('岗位状态'));
      const sequenceIndex = headers.findIndex((header) => String(header || '').includes('岗位序列名称'));
      const childSequenceIndex = headers.findIndex((header) => String(header || '').includes('岗位子序列名称'));
      const orderIndex = headers.findIndex((header) => String(header || '').includes('顺序号'));
      const linkedEmployees = employees.filter((employee) => asRawText(employee.position) === name);
      return {
        id: index + 1,
        code,
        name,
        parentCode: asText(row[52], ''),
        parentName: asText(row[53], ''),
        orgs,
        orgText: orgs.slice(0, 3).join('；') || '-',
        companies,
        companyText: companies.slice(0, 3).join('；') || '-',
        sequence: sequenceIndex >= 0 ? asText(row[sequenceIndex], '') : '',
        subSequence: childSequenceIndex >= 0 ? asText(row[childSequenceIndex], '') : '',
        sortNo: orderIndex >= 0 ? asText(row[orderIndex], '') : '',
        status: statusIndex >= 0 ? asText(row[statusIndex], '已启用') : '已启用',
        linkedEmployeeCount: linkedEmployees.length,
        linkedEmployees: linkedEmployees.slice(0, 12),
        source: file.name,
      };
    }).filter(Boolean);
  }

  const customRows = getStoredRows('organizationPositions') || [];
  const byCode = new Map(rows.map((row) => [asRawText(row.code || row.name), row]));
  for (const custom of customRows) {
    const key = asRawText(custom.code || custom.name);
    if (key) byCode.set(key, { ...custom, source: '本地岗位管理保存' });
  }

  return { sourceFile: file?.name || '本地岗位管理保存', sheetName, rows: Array.from(byCode.values()).map((row, index) => ({ ...row, id: index + 1 })) };
}

function rankRows() {
  const file = getOrgReferenceFile('职级管理');
  const employees = employeeMasterRows();
  let rows = [];
  let sheetName = '';
  if (file) {
    const { rows: sheetRows, sheetName: usedSheetName } = readSheetRows(file.fullPath, (name) => name.includes('职级已有数据'));
    sheetName = usedSheetName;
    rows = sheetRows.map((row, index) => {
      const code = asText(getByAliases(row, ['职级代码']), '');
      const name = asText(getByAliases(row, ['职级名称']), '');
      if (!code && !name) return null;
      const linkedCount = employees.filter((employee) => asRawText(employee.rankCode) === code || asRawText(employee.rankName) === name).length;
      return {
        id: index + 1,
        sequence: asText(getByAliases(row, ['岗位序列名称']), ''),
        subSequence: asText(getByAliases(row, ['岗位子序列名称']), ''),
        company: asText(getByAliases(row, ['适用公司']), ''),
        code,
        name,
        grade: asText(getByAliases(row, ['职等']), ''),
        desc: asText(getByAliases(row, ['职级描述']), ''),
        employeeCount: asNum(getByAliases(row, ['在职人数统计'])),
        linkedEmployeeCount: linkedCount,
        status: asText(getByAliases(row, ['职级状态']), '已启用'),
        source: file.name,
      };
    }).filter(Boolean);
  }

  const customRows = getStoredRows('organizationRanks') || [];
  const byCode = new Map(rows.map((row) => [asRawText(row.code || row.name), row]));
  for (const custom of customRows) {
    const key = asRawText(custom.code || custom.name);
    if (key) byCode.set(key, { ...custom, source: '本地职级管理保存' });
  }

  return { sourceFile: file?.name || '本地职级管理保存', sheetName, rows: Array.from(byCode.values()).map((row, index) => ({ ...row, id: index + 1 })) };
}

function organizationSettingsRows() {
  const stored = getStoredRows('organizationSettings');
  if (stored) return stored;
  return [
    { id: 1, setting: '组织架构同步', value: '读取组织架构信息导出.xlsx，并与员工花名册部门全路径匹配', status: '已启用', linkedModule: '员工管理 / 考勤人员 / 排班管理' },
    { id: 2, setting: '岗位联动', value: '岗位名称与员工花名册岗位字段同源', status: '已启用', linkedModule: '员工档案 / 职位管理 / 考勤统计' },
    { id: 3, setting: '职级联动', value: '职级代码、职级名称用于员工档案和薪酬口径', status: '已启用', linkedModule: '员工管理 / 电子工资单' },
    { id: 4, setting: '组织管理员', value: '按组织负责人和审批主管字段生成管理范围', status: '已启用', linkedModule: '审批 / 假勤 / 外勤' },
  ];
}

function organizationSummary() {
  const orgs = organizationRows().rows;
  const positions = positionRows().rows;
  const ranks = rankRows().rows;
  const employees = employeeRosterRows();
  return {
    organizationTotal: orgs.length,
    activeOrganizationTotal: orgs.filter((row) => !/停用|失效/.test(row.status)).length,
    positionTotal: positions.length,
    enabledPositionTotal: positions.filter((row) => /启用|生效/.test(row.status)).length,
    rankTotal: ranks.length,
    linkedEmployeeTotal: employees.length,
    sourceFile: '参考图片/功能/组织管理 + 员工主数据',
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dataDir: DATA_DIR, employeeReferenceDir: EMPLOYEE_REFERENCE_DIR, organizationReferenceDir: ORGANIZATION_REFERENCE_DIR, files: listExcelFiles().map((f) => f.name) });
});

app.get('/api/organization-management/summary', (_req, res) => {
  res.json({ ok: true, ...organizationSummary() });
});

app.get('/api/organization-management/organizations', (_req, res) => {
  const data = organizationRows();
  res.json({ sourceFile: data.sourceFile, sheetName: data.sheetName, total: data.rows.length, rows: data.rows });
});

app.post('/api/organization-management/organizations', (req, res) => {
  const name = asRawText(req.body?.name);
  const fullPath = asRawText(req.body?.fullPath);
  if (!name || !fullPath) return res.status(400).json({ message: '组织名称和组织全路径必填' });
  const code = asRawText(req.body?.code) || `LOCAL${Date.now()}`;
  const row = {
    code,
    name,
    fullPath,
    parentCode: asRawText(req.body?.parentCode),
    leader: asRawText(req.body?.leader),
    approvalManager: asRawText(req.body?.approvalManager),
    orgType: asText(req.body?.orgType, '部门'),
    status: asText(req.body?.status, '生效中'),
    effectiveDate: asText(req.body?.effectiveDate, currentDateText()),
    createdAt: asText(req.body?.createdAt, nowText()),
    remark: asText(req.body?.remark, ''),
  };
  const result = upsertStoredRow('organizationStructures', row, (item) => asRawText(item.code));
  res.json({ ok: true, created: result.created, row });
});

app.delete('/api/organization-management/organizations/:code', (req, res) => {
  const code = asRawText(req.params.code);
  const rows = getStoredRows('organizationStructures') || [];
  const nextRows = rows.filter((row) => asRawText(row.code) !== code);
  setStoredRows('organizationStructures', nextRows);
  res.json({ ok: true, removed: rows.length - nextRows.length, remaining: nextRows.length });
});

app.get('/api/organization-management/positions', (_req, res) => {
  const data = positionRows();
  res.json({ sourceFile: data.sourceFile, sheetName: data.sheetName, total: data.rows.length, rows: data.rows });
});

app.post('/api/organization-management/positions', (req, res) => {
  const name = asRawText(req.body?.name);
  if (!name) return res.status(400).json({ message: '岗位名称必填' });
  const row = {
    code: asRawText(req.body?.code) || `P${Date.now().toString().slice(-5)}`,
    name,
    parentName: asRawText(req.body?.parentName),
    orgs: Array.isArray(req.body?.orgs) ? req.body.orgs.map(asRawText).filter(Boolean) : [asRawText(req.body?.orgText)].filter(Boolean),
    orgText: asText(req.body?.orgText, ''),
    companies: Array.isArray(req.body?.companies) ? req.body.companies.map(asRawText).filter(Boolean) : [],
    companyText: asText(req.body?.companyText, ''),
    sequence: asText(req.body?.sequence, '专业通道'),
    subSequence: asText(req.body?.subSequence, ''),
    status: asText(req.body?.status, '已启用'),
  };
  const result = upsertStoredRow('organizationPositions', row, (item) => asRawText(item.code || item.name));
  res.json({ ok: true, created: result.created, row });
});

app.get('/api/organization-management/ranks', (_req, res) => {
  const data = rankRows();
  res.json({ sourceFile: data.sourceFile, sheetName: data.sheetName, total: data.rows.length, rows: data.rows });
});

app.post('/api/organization-management/ranks', (req, res) => {
  const name = asRawText(req.body?.name);
  const code = asRawText(req.body?.code);
  if (!name || !code) return res.status(400).json({ message: '职级代码和职级名称必填' });
  const row = {
    code,
    name,
    sequence: asText(req.body?.sequence, '专业通道'),
    subSequence: asText(req.body?.subSequence, ''),
    company: asText(req.body?.company, ''),
    grade: asText(req.body?.grade, ''),
    desc: asText(req.body?.desc, ''),
    status: asText(req.body?.status, '已启用'),
  };
  const result = upsertStoredRow('organizationRanks', row, (item) => asRawText(item.code || item.name));
  res.json({ ok: true, created: result.created, row });
});

app.get('/api/organization-management/settings', (_req, res) => {
  const rows = organizationSettingsRows();
  res.json({ sourceFile: '系统配置 + 组织管理参考图', sheetName: '组织管理设置', total: rows.length, rows });
});

app.put('/api/organization-management/settings', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  setStoredRows('organizationSettings', rows);
  res.json({ ok: true, sourceFile: '本地组织管理设置', sheetName: '组织管理设置', total: rows.length, rows });
});

app.get('/api/employee-management/summary', (_req, res) => {
  res.json({ ok: true, ...employeeSummary() });
});

app.get('/api/employee-management/roster', (_req, res) => {
  const rows = employeeRosterRows();
  res.json({ sourceFile: '员工花名册 + 本地录入人员', sheetName: '员工花名册', total: rows.length, rows });
});

app.get('/api/employee-management/archive', (_req, res) => {
  const rows = employeeRosterRows();
  res.json({ sourceFile: '员工花名册 + 本地录入人员', sheetName: '员工档案库', total: rows.length, rows });
});

app.get('/api/employee-management/education', (_req, res) => {
  const data = readEducationRows();
  res.json({ sourceFile: data.sourceFile || '教育经历', sheetName: data.sheetName, total: data.rows.length, rows: data.rows });
});

app.get('/api/employee-management/archive-approvals', (_req, res) => {
  const rows = employeeArchiveApprovalRows();
  res.json({ sourceFile: '员工花名册衍生', sheetName: '档案变更审批', total: rows.length, rows });
});

app.get('/api/employee-management/care', (_req, res) => {
  const rows = employeeCareRows();
  res.json({ sourceFile: '员工主数据衍生', sheetName: '员工关怀', total: rows.length, rows });
});

app.get('/api/employee-management/reports', (_req, res) => {
  const rows = employeeReportRows();
  res.json({ sourceFile: '员工花名册汇总', sheetName: '员工统计报表', total: rows.length, rows });
});

app.get('/api/employee-management/employment/:type', (req, res) => {
  const data = readEmploymentRows(req.params.type);
  res.json({ sourceFile: data.sourceFile || '任职管理', sheetName: data.sheetName, total: data.rows.length, rows: data.rows });
});

app.get('/api/employee-management/contracts/:type', (req, res) => {
  const data = readEmployeeContractRows(req.params.type);
  res.json({ sourceFile: data.sourceFile || '员工合同', sheetName: data.sheetName, total: data.rows.length, rows: data.rows });
});

app.get('/api/employee-management/settings', (_req, res) => {
  const rows = [
    { id: 1, setting: '档案字段设置', value: '姓名、工号、手机号、部门、岗位、入职日期、员工状态', status: '已启用' },
    { id: 2, setting: '花名册字段权限', value: '按员工管理权限范围读取', status: '已启用' },
    { id: 3, setting: '入职二维码', value: '默认二维码 / 再次登记', status: '已启用' },
    { id: 4, setting: '考勤人员同步', value: '按员工号与考勤模块自动互通', status: '已启用' },
  ];
  res.json({ sourceFile: '系统配置', sheetName: '员工管理设置', total: rows.length, rows });
});

app.get('/api/employee-management/services', (_req, res) => {
  const rows = employeeServiceRows();
  res.json({ sourceFile: '员工服务配置', sheetName: '员工服务', total: rows.length, rows });
});

app.get('/api/employee-management/third-party', (_req, res) => {
  const rows = thirdPartyRows();
  res.json({ sourceFile: '第三方对接配置', sheetName: '第三方对接', total: rows.length, rows });
});

app.get('/api/settings-linkage-report', (_req, res) => {
  const rows = [
    {
      setting: '考勤人员',
      status: '生效',
      count: getOnboardedEmployees().length,
      adminRoutes: ['/attendance/stats', '/attendance/daily', '/attendance/monthly', '/attendance/monthly-summary', '/attendance/clock-records', '/attendance/leave', '/attendance/field-out'],
      mobileRoutes: ['/api/mobile/login', '/api/mobile/me', '/api/mobile/today', '/api/mobile/clock'],
      effect: '作为所有考勤、打卡、假勤、外勤、排班与小程序员工身份的主数据',
    },
    {
      setting: '考勤组管理',
      status: '生效',
      count: getGroupSettingRows().length,
      adminRoutes: ['/attendance/stats', '/attendance/daily', '/attendance/monthly', '/attendance/monthly-summary', '/attendance/settings/people'],
      mobileRoutes: ['/api/mobile/me', '/api/mobile/today'],
      effect: '用于人员归属、默认班次、司历/地点/规则按考勤组匹配',
    },
    {
      setting: '班次管理',
      status: '生效',
      count: getShiftSettingRows().length,
      adminRoutes: ['/attendance/stats', '/attendance/daily', '/attendance/monthly', '/attendance/monthly-summary', '/attendance/schedules'],
      mobileRoutes: ['/api/mobile/today', '/api/mobile/clock'],
      effect: '用于排班、迟到计算、今日班次和移动端打卡班次',
    },
    {
      setting: '司历管理',
      status: '生效',
      count: getCalendarSettingRows().length,
      adminRoutes: ['/attendance/daily', '/attendance/monthly', '/attendance/monthly-summary', '/attendance/schedules'],
      mobileRoutes: ['/api/mobile/today'],
      effect: '用于判断工作日/休息日并生成未手工排班时的自动排班',
    },
    {
      setting: '节假日管理',
      status: getHolidaySettingRows().length ? '部分生效' : '未配置',
      count: getHolidaySettingRows().length,
      adminRoutes: ['/attendance/daily', '/attendance/monthly-summary'],
      mobileRoutes: ['/api/mobile/today'],
      effect: '配置中包含具体日期时会覆盖司历工作日，标记为节假日',
    },
    {
      setting: '移动打卡方案',
      status: getMobileClockSettingRows().length ? '生效' : '未配置',
      count: getMobileClockSettingRows().length,
      adminRoutes: ['/attendance/settings/location', '/attendance/clock-records'],
      mobileRoutes: ['/api/mobile/me', '/api/mobile/today', '/api/mobile/clock'],
      effect: '由上班地点关联到考勤组，小程序今日接口展示，停用方案会阻止移动打卡',
    },
    {
      setting: '上班地点',
      status: getLocationSettingRows().length ? '生效' : '使用默认地点',
      count: getLocationSettingRows().length,
      adminRoutes: ['/attendance/clock-records', '/attendance/stats'],
      mobileRoutes: ['/api/mobile/me', '/api/mobile/today', '/api/mobile/clock'],
      effect: '用于移动端定位打卡地点、打卡记录地点和实时统计地点',
    },
    {
      setting: '打卡规则',
      status: '生效',
      count: getCardRuleSettingRows().length,
      adminRoutes: ['/attendance/stats', '/attendance/clock-records', '/attendance/anomalies'],
      mobileRoutes: ['/api/mobile/me', '/api/mobile/today'],
      effect: '按考勤组返回当前规则，供今日状态和异常复核展示',
    },
    {
      setting: '加班规则',
      status: '生效',
      count: getOvertimeRuleSettingRows().length,
      adminRoutes: ['/attendance/overtime', '/attendance/monthly-summary'],
      mobileRoutes: ['/api/mobile/me'],
      effect: '按考勤组返回当前规则，供加班记录和月汇总核算口径使用',
    },
    {
      setting: '外勤规则',
      status: '生效',
      count: getFieldRuleSettingRows().length,
      adminRoutes: ['/attendance/field-out', '/attendance/clock-field'],
      mobileRoutes: ['/api/mobile/me'],
      effect: '按考勤组返回当前规则，供外勤/外出记录和移动端规则说明使用',
    },
    {
      setting: '统计方案',
      status: '生效',
      count: getStatSchemeSettingRows().length,
      adminRoutes: ['/attendance/monthly-summary', '/attendance/stat-items', '/attendance/external-data'],
      mobileRoutes: [],
      effect: '用于月汇总统计范围，统计项和外部数据已进入月汇总自定义列',
    },
    {
      setting: '人脸管理',
      status: '生效',
      count: getSettingsFaceRows().length,
      adminRoutes: ['/attendance/clock-records', '/attendance/settings/people'],
      mobileRoutes: ['/api/mobile/face-verify', '/api/mobile/clock'],
      effect: '移动端打卡必须携带人脸核验结果，后台打卡记录会展示照片/核验来源',
    },
    {
      setting: '考勤机管理',
      status: '仅前端选择',
      count: 0,
      adminRoutes: ['/attendance/settings/devices'],
      mobileRoutes: [],
      effect: '当前只在设置页选择机型模板，尚未接入真实设备同步接口',
    },
  ];
  res.json({ ok: true, generatedAt: nowText(), total: rows.length, rows });
});

app.get('/api/data-sources', (_req, res) => {
  const files = listExcelFiles().map((f) => ({ name: f.name, mtime: f.stat.mtime, size: f.stat.size }));
  res.json({ files, dataDir: DATA_DIR });
});

app.get('/api/attendance-stats', (_req, res) => {
  const rows = buildLinkedAttendanceStatsRows();
  return sendLinkedRows(res, 'attendanceStats', rows);
});

app.get('/api/daily-attendance', (_req, res) => {
  return sendLinkedRows(res, 'dailyAttendance', buildLinkedDailyRows());
});

app.put('/api/daily-attendance', (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: 'rows必须是数组' });
  }
  setStoredRows('dailyAttendance', rows);
  return res.json({ ok: true, sourceFile: '本地持久化数据 data-store.json', total: rows.length, rows });
});

app.get('/api/monthly-attendance', (_req, res) => {
  return sendLinkedRows(res, 'monthlyAttendance', buildLinkedMonthlyRows());
});

app.get('/api/monthly-summary', (_req, res) => {
  return sendLinkedRows(res, 'monthlySummary', buildLinkedMonthlySummaryRows());
});

app.put('/api/monthly-summary', (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: 'rows必须是数组' });
  }
  setStoredRows('monthlySummary', rows);
  return res.json({ ok: true, sourceFile: '本地持久化数据 data-store.json', total: rows.length, rows });
});


app.get('/api/clock-records', (_req, res) => {
  const mobileRows = mapMobileClockRowsToAdmin(filterRowsToOnboardedEmployees(getMobileRows('mobileClockRecords', [])));
  return sendLinkedRows(res, 'mobileClockRecords', mobileRows);
});

app.put('/api/clock-records', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是打卡记录数组' });
  }
  const employees = linkedDemoEmployees();
  const byNo = new Map(employees.map((employee) => [asRawText(employee.employeeNo), employee]));
  const normalizedRows = rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) => {
      const employeeNo = asText(row.empId || row.employeeNo, '');
      const employee = byNo.get(asRawText(employeeNo));
      const fallbackName = asText(row.name || row.employeeName, employee?.name || '');
      const date = asText(row.date, currentDateText());
      const time = asText(row.time, nowText().slice(11, 16));
      const createTime = asText(row.createTime || row.serverTime, `${date} ${time}`);
      const typeText = asText(row.freeWork, '上班') === '下班' ? 'clockOut' : 'clockIn';
      const note = asText(row.note, '');
      return {
        id: asText(row.rawId || row.mobileId || row.id, `manual_clock_${Date.now()}_${index}`),
        employeeId: employee?.id || employeeNo,
        employeeName: fallbackName,
        employeeNo,
        dept: asText(row.dept, employee?.department || ''),
        attendanceGroupName: employee?.attendanceGroupName || asText(row.workLocation, ''),
        shiftName: employee?.shiftName || '',
        date,
        type: typeText,
        time,
        serverTime: createTime.length > 10 ? createTime : `${date} ${time}`,
        latitude: Number(row.latitude || 0),
        longitude: Number(row.longitude || 0),
        accuracy: Number(row.accuracy || 0),
        address: asText(row.location, asText(row.workLocation, MOBILE_OFFICE.name)),
        workLocation: asText(row.workLocation, MOBILE_OFFICE.name),
        distance: Number(row.distance || 0),
        faceVerifyId: asText(row.faceVerifyId, row.hasPhoto ? 'manual_face_passed' : ''),
        photoFileId: asText(row.photoFileId, ''),
        photoUrl: asText(row.photoUrl, ''),
        photoTakenAt: asText(row.photoTakenAt, ''),
        result: note.includes('异常') ? 'abnormal' : 'normal',
        message: note || '管理员预制打卡记录',
        source: asText(row.source, 'HR手动添加'),
        device: asText(row.device, '后台录入'),
        creator: asText(row.creator, 'HR'),
        modifier: asText(row.modifier, ''),
        modifyTime: asText(row.modifyTime, ''),
      };
    })
    .filter((row) => asRawText(row.employeeNo));
  setMobileRows('mobileClockRecords', normalizedRows);
  const adminRows = mapMobileClockRowsToAdmin(filterRowsToOnboardedEmployees(normalizedRows));
  return res.json({
    ok: true,
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'mobileClockRecords',
    total: adminRows.length,
    rows: adminRows,
    linkedOnly: true,
  });
});

app.get('/api/attendance-anomalies', (_req, res) => {
  return sendLinkedRows(res, 'mobileAnomalies', buildLinkedAnomalyRows());
});

app.put('/api/attendance-anomalies', (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: 'rows必须是数组' });
  }
  setStoredRows('attendanceAnomalies', rows);
  return res.json({ ok: true, sourceFile: '本地持久化数据 data-store.json', total: rows.length, rows });
});


app.get('/api/work-data', (_req, res) => {
  return sendLinkedRows(res, 'workData', buildLinkedWorkDataRows());
});

app.get('/api/overtime-records', (_req, res) => {
  return sendLinkedRows(res, 'overtimeRecords', buildLinkedOvertimeRows());
});

app.get('/api/field-out-records', (_req, res) => {
  return sendLinkedRows(res, 'fieldOutRecords', buildLinkedFieldOutRows());
});

app.put('/api/field-out-records', (req, res) => {
  return saveRowsEndpoint(req, res, 'fieldOutRecords', 'fieldOutRecords', (row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    return {
      id: Number(row.id) || Date.now(),
      status: asText(row.status, '审批中'),
      name: asText(row.name, ''),
      empId: asText(row.empId, ''),
      dept: asText(row.dept, ''),
      deptPath: asText(row.deptPath, asText(row.dept, '')),
      effect: asText(row.effect, '待生效'),
      source: asText(row.source, 'PC端申请'),
      values: Array.isArray(row.values) ? row.values.map((cell) => asText(cell, '')) : [],
      flowStatus: asText(row.flowStatus, asText(row.status, '审批中')),
    };
  });
});

app.get('/api/field-trip-records', (_req, res) => {
  return sendLinkedRows(res, 'fieldTripRecords', buildLinkedFieldTripRows());
});

app.put('/api/field-trip-records', (req, res) => {
  return saveRowsEndpoint(req, res, 'fieldTripRecords', 'fieldTripRecords', (row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    return {
      id: Number(row.id) || Date.now(),
      status: asText(row.status, '审批中'),
      name: asText(row.name, ''),
      empId: asText(row.empId, ''),
      dept: asText(row.dept, ''),
      deptPath: asText(row.deptPath, asText(row.dept, '')),
      effect: asText(row.effect, '待生效'),
      source: asText(row.source, 'PC端申请'),
      values: Array.isArray(row.values) ? row.values.map((cell) => asText(cell, '')) : [],
      flowStatus: asText(row.flowStatus, asText(row.status, '审批中')),
    };
  });
});

app.get('/api/schedules/month', (req, res) => {
  const monthText = asText(req.query?.month, currentDateText().slice(0, 7));
  const rows = linkedDemoEmployees().map((employee) => {
    const dayResults = {};
    for (const row of scheduleRowsForEmployee(employee, monthText)) {
      const day = String(Number(asText(row.date, '').slice(8, 10)));
      if (!day || day === 'NaN') continue;
      dayResults[day] = asText(row.shiftName, '');
    }
    return {
      name: employee.name,
      employeeNo: employee.employeeNo,
      dept: employee.department,
      position: employee.position,
      dayResults,
    };
  });
  return res.json({
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'employeeSchedules',
    month: monthText,
    total: rows.length,
    rows,
    shifts: getShiftOptions(),
    linkedOnly: true,
  });
});

app.put('/api/schedules', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ message: 'rows必须是排班数组' });
  const saved = rows.map((row) => upsertSchedule(row));
  return res.json({
    ok: true,
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'employeeSchedules',
    total: saved.length,
    rows: saved,
    linkedOnly: true,
  });
});

app.get('/api/leave-records', (_req, res) => {
  return sendLinkedRows(res, 'leaveRecords', buildLinkedLeaveRows());
});

app.put('/api/leave-records', (req, res) => {
  return saveRowsEndpoint(req, res, 'leaveRecords', 'leaveRecords', (row) => Array.isArray(row) ? row.map((cell) => asText(cell, '')) : null);
});

app.get('/api/leave-balances', (_req, res) => {
  return sendLinkedRows(res, 'leaveBalances', buildLinkedLeaveBalanceRows());
});

app.get('/api/leave-details', (_req, res) => {
  return sendLinkedRows(res, 'leaveDetails', buildLinkedLeaveDetailRows());
});

app.put('/api/leave-details', (req, res) => {
  return saveRowsEndpoint(req, res, 'leaveDetails', 'leaveDetails', (row) => Array.isArray(row) ? row.map((cell) => asText(cell, '')) : null);
});

app.get('/api/leave-types', (_req, res) => {
  return sendLinkedRows(res, 'leaveTypes', getLeaveTypeRows());
});

app.put('/api/leave-types', (req, res) => {
  return saveRowsEndpoint(req, res, 'leaveTypes', 'leaveTypes', (row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    return {
      name: asText(row.name, ''),
      short: asText(row.short, asText(row.name, '').slice(0, 1)),
      enabled: Boolean(row.enabled),
      unit: asText(row.unit, '按天请假'),
      paid: asText(row.paid, '否'),
      negative: asText(row.negative, '否'),
      before: asText(row.before, '否'),
      note: asText(row.note, '-'),
      reason: asText(row.reason, '否'),
      attachment: asText(row.attachment, '否'),
      attachmentNote: asText(row.attachmentNote, '-'),
      creator: asText(row.creator, '后台维护'),
      createdAt: asText(row.createdAt, nowText()),
      editor: asText(row.editor, '后台维护'),
      editedAt: asText(row.editedAt, nowText()),
    };
  });
});

app.get('/api/leave-schemes', (_req, res) => {
  return sendLinkedRows(res, 'leaveSchemes', getLeaveSchemeRows());
});

app.put('/api/leave-schemes', (req, res) => {
  return saveRowsEndpoint(req, res, 'leaveSchemes', 'leaveSchemes', (row) => Array.isArray(row) ? row.map((cell) => asText(cell, '')) : null);
});

app.get('/api/settings-shifts', (_req, res) => {
  return sendLinkedRows(res, 'settingsShifts', getShiftSettingRows());
});

app.get('/api/settings-groups', (_req, res) => {
  return sendLinkedRows(res, 'settingsGroups', getGroupSettingRows());
});

app.put('/api/settings-groups', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是考勤组数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '排班制'),
      asText(row[2], '部门：待配置'),
      asText(row[3], '早九晚六'),
      asText(row[4], '后台维护'),
      asText(row[5], nowText()),
      asText(row[6], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsGroups', normalizedRows);
  return sendLinkedRows(res, 'settingsGroups', normalizedRows);
});

app.get('/api/settings-card-rules', (_req, res) => {
  return sendLinkedRows(res, 'settingsCardRules', getCardRuleSettingRows());
});

app.put('/api/settings-card-rules', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是打卡规则数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '-'),
      asText(row[2], '默认考勤组'),
      asText(row[3], '后台维护'),
      asText(row[4], nowText()),
      asText(row[5], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsCardRules', normalizedRows);
  return sendLinkedRows(res, 'settingsCardRules', normalizedRows);
});

app.get('/api/settings-mobile-clock', (_req, res) => {
  return sendLinkedRows(res, 'settingsMobileClock', getMobileClockSettingRows());
});

app.put('/api/settings-mobile-clock', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是移动打卡方案数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], 'GPS/Wi-Fi/蓝牙均可打卡'),
      asText(row[2], '默认考勤组'),
      asText(row[3], '后台维护'),
      asText(row[4], nowText()),
      asText(row[5], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsMobileClock', normalizedRows);
  return sendLinkedRows(res, 'settingsMobileClock', normalizedRows);
});

app.get('/api/settings-location', (_req, res) => {
  return sendLinkedRows(res, 'settingsLocation', getLocationSettingRows());
});

app.put('/api/settings-location', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是上班地点数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '默认考勤组'),
      asText(row[2], '-'),
      asText(row[3], '-'),
      asText(row[4], '-'),
      asText(row[5], '未关联移动打卡方案'),
      asText(row[6], '后台维护'),
      asText(row[7], nowText()),
      asText(row[8], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsLocation', normalizedRows);
  return sendLinkedRows(res, 'settingsLocation', normalizedRows);
});

app.get('/api/settings-holiday', (_req, res) => {
  return sendLinkedRows(res, 'settingsHoliday', getHolidaySettingRows());
});

app.put('/api/settings-holiday', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是节假日方案数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], String(new Date().getFullYear())),
      asText(row[2], '双休'),
      asText(row[3], '后台维护'),
      asText(row[4], nowText()),
      asText(row[5], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsHoliday', normalizedRows);
  return sendLinkedRows(res, 'settingsHoliday', normalizedRows);
});

app.get('/api/settings-calendar', (_req, res) => {
  return sendLinkedRows(res, 'settingsCalendar', getCalendarSettingRows());
});

app.put('/api/settings-calendar', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是司历方案数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '当月1日至当月最后一天为【当月】的考勤周期'),
      asText(row[2], '周一、周二、周三、周四、周五'),
      asText(row[3], '工作日之和为应出勤天数'),
      asText(row[4], '默认考勤组'),
      asText(row[5], '后台维护'),
      asText(row[6], nowText()),
      asText(row[7], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsCalendar', normalizedRows);
  return sendLinkedRows(res, 'settingsCalendar', normalizedRows);
});

app.get('/api/settings-overtime-rules', (_req, res) => {
  return sendLinkedRows(res, 'settingsOvertimeRules', getOvertimeRuleSettingRows());
});

app.put('/api/settings-overtime-rules', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是加班规则数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '工作日/休息日/节假日均按默认口径核算'),
      asText(row[2], '默认考勤组'),
      asText(row[3], '后台维护'),
      asText(row[4], nowText()),
      asText(row[5], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsOvertimeRules', normalizedRows);
  return sendLinkedRows(res, 'settingsOvertimeRules', normalizedRows);
});

app.get('/api/settings-field-rules', (_req, res) => {
  return sendLinkedRows(res, 'settingsFieldRules', getFieldRuleSettingRows());
});

app.put('/api/settings-field-rules', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是外勤规则数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '外勤打卡已启用 / 外出申请已启用'),
      asText(row[2], '默认考勤组'),
      asText(row[3], '后台维护'),
      asText(row[4], nowText()),
      asText(row[5], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsFieldRules', normalizedRows);
  return sendLinkedRows(res, 'settingsFieldRules', normalizedRows);
});

app.get('/api/settings-stat-schemes', (_req, res) => {
  return sendLinkedRows(res, 'settingsStatSchemes', getStatSchemeSettingRows());
});

app.put('/api/settings-stat-schemes', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是统计方案数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '当月1日至当月最后一天为【当月】的一个考勤统计周期'),
      asText(row[2], '部门：待配置'),
      asText(row[3], '默认考勤组'),
      asText(row[4], '后台维护'),
      asText(row[5], nowText()),
      asText(row[6], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsStatSchemes', normalizedRows);
  return sendLinkedRows(res, 'settingsStatSchemes', normalizedRows);
});

app.put('/api/settings-shifts', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是班次数组' });
  }
  const normalizedRows = rows
    .filter((row) => Array.isArray(row) && asRawText(row[0]))
    .map((row) => [
      asText(row[0], '-'),
      asText(row[1], '-'),
      asText(row[2], '#B53A2A'),
      asText(row[3], '-'),
      asText(row[4], '通用'),
      asText(row[5], '09:00-18:00(正常出勤)'),
      asText(row[6], '8小时'),
      asText(row[7], '-'),
      asText(row[8], '后台维护'),
      asText(row[9], nowText()),
      asText(row[10], '后台维护'),
      nowText(),
    ]);
  setStoredRows('settingsShifts', normalizedRows);
  return sendLinkedRows(res, 'settingsShifts', normalizedRows);
});

app.get('/api/settings-face', (_req, res) => {
  return sendLinkedRows(res, 'employeeMaster', getSettingsFaceRows());
});

app.get('/api/settings-people', (_req, res) => {
  const rows = employeeMasterRows().map(onboardedEmployeeToPeopleRow);
  return sendLinkedRows(res, 'employeeMaster', rows);
});

app.post('/api/employees/onboard', (req, res) => {
  const employeeNo = asRawText(req.body?.employeeNo);
  const name = asRawText(req.body?.name);
  if (!employeeNo || !name) {
    return res.status(400).json({ message: '姓名和员工号必填' });
  }
  const employee = normalizeOnboardedEmployee(req.body);
  const result = upsertStoredRow('onboardedEmployees', employee, (row) => asRawText(row.employeeNo));
  return res.json({
    ok: true,
    created: result.created,
    employee,
    peopleRow: onboardedEmployeeToPeopleRow(employee),
    faceRow: onboardedEmployeeToFaceRow(employee),
    attendanceRow: onboardedEmployeeToAttendanceStatsRow(employee),
  });
});

app.delete('/api/employees/:employeeNo', (req, res) => {
  const employeeNo = asRawText(req.params.employeeNo);
  if (!employeeNo) {
    return res.status(400).json({ message: '缺少员工号' });
  }
  const result = deleteOnboardedEmployees([employeeNo]);
  return res.json({
    ok: true,
    employeeNo,
    ...result,
  });
});

app.delete('/api/employees', (req, res) => {
  const employeeNos = Array.isArray(req.body?.employeeNos) ? req.body.employeeNos.map(asRawText).filter(Boolean) : [];
  if (!employeeNos.length) {
    return res.status(400).json({ message: 'employeeNos必须是非空数组' });
  }
  const result = deleteOnboardedEmployees(employeeNos);
  return res.json({
    ok: true,
    employeeNos,
    ...result,
  });
});

app.get('/api/mobile/manager/approvals', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const rows = mobileApprovalRows(employee);
  const pending = rows.filter((row) => row.status === '审批中').length;
  return res.json({ total: rows.length, pending, rows });
});

app.post('/api/mobile/manager/approvals/:approvalId', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const updated = updateApprovalRow(req.params.approvalId, req.body?.action);
  if (!updated) {
    return res.status(404).json({ message: '未找到审批记录或审批动作无效' });
  }
  return res.json({ ok: true, row: updated });
});

app.post('/api/mobile/approval-request', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const category = asText(req.body?.category, '异常处理');
  const reason = asRawText(req.body?.reason);
  if (!reason) {
    return res.status(400).json({ message: '处理说明必填' });
  }
  const rows = getMobileRows('mobileApprovalRequests', []);
  const request = {
    id: `approval_${Date.now()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeNo: employee.employeeNo,
    dept: employee.department,
    category,
    date: asText(req.body?.date, currentDateText()),
    time: asText(req.body?.time, ''),
    reason,
    detail: asText(req.body?.detail, ''),
    status: 'pending',
    createTime: nowText(),
  };
  setMobileRows('mobileApprovalRequests', [request, ...rows]);
  return res.json({ ok: true, request, message: '已提交管理者审批' });
});

app.get('/api/mobile/manager/schedules', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const dateText = asText(req.query?.date, currentDateText());
  const monthText = asText(req.query?.month, dateText.slice(0, 7));
  const rows = scheduleRowsForDate(dateText, employee);
  const missing = rows.filter((row) => row.status === '未排班').length;
  return res.json({
    date: dateText,
    month: monthText,
    total: rows.length,
    missing,
    rows,
    dayStatuses: scheduleMonthStatuses(monthText, employee),
    shifts: getShiftOptions(),
  });
});

app.post('/api/mobile/manager/schedules/import', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const mode = asRawText(req.body?.mode);
  const targetDate = asText(req.body?.date, currentDateText());
  const target = parseDateText(targetDate);
  if (!target) {
    return res.status(400).json({ message: 'date必须是YYYY-MM-DD' });
  }

  if (mode === 'previousDay') {
    const sourceDate = addDays(targetDate, -1);
    const result = copyManagerScheduleDay(employee, sourceDate, targetDate);
    if (!result.copied.length) {
      return res.status(404).json({ message: `${sourceDate} 没有可导入的排班` });
    }
    return res.json({ ok: true, mode, ...result, message: `已从 ${sourceDate} 导入 ${result.copied.length} 人排班` });
  }

  if (mode === 'previousWeek') {
    const weekStart = new Date(target);
    weekStart.setDate(target.getDate() - target.getDay());
    const results = [];
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      const dayText = formatLocalDate(day);
      const sourceDate = addDays(dayText, -7);
      results.push(copyManagerScheduleDay(employee, sourceDate, dayText));
    }
    const copied = results.flatMap((item) => item.copied);
    if (!copied.length) {
      return res.status(404).json({ message: '上一周没有可导入的排班' });
    }
    return res.json({ ok: true, mode, results, copied: copied.length, message: `已从上一周导入 ${copied.length} 条排班` });
  }

  return res.status(400).json({ message: 'mode必须是previousDay或previousWeek' });
});

app.post('/api/mobile/manager/schedules', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const employeeNo = asRawText(req.body?.employeeNo);
  const target = findMobileEmployee({ employeeNo });
  if (!target) {
    return res.status(404).json({ message: `未找到员工号 ${employeeNo}` });
  }
  if (asRawText(target.managerNo) !== asRawText(employee.employeeNo)) {
    return res.status(403).json({ message: '只能为归属自己的员工排班' });
  }
  const row = upsertSchedule({
    date: asText(req.body?.date, currentDateText()),
    employeeNo: target.employeeNo,
    employeeName: target.name,
    dept: target.department,
    managerNo: employee.employeeNo,
    managerName: employee.name,
    shiftId: asText(req.body?.shiftId, MOBILE_SHIFT.id),
    shiftName: asText(req.body?.shiftName, MOBILE_SHIFT.name),
  });
  return res.json({ ok: true, row, message: '排班已保存' });
});

const DEFAULT_STAT_ITEMS = [
  { id: 1, name: '员工姓名', module: '基础考勤', category: '人事基础', desc: '员工的实际姓名', enabled: true, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 2, name: '员工工号', module: '基础考勤', category: '人事基础', desc: '员工唯一标识工号', enabled: true, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 3, name: '部门', module: '基础考勤', category: '人事基础', desc: '员工所属部门名称', enabled: true, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 4, name: '岗位', module: '基础考勤', category: '人事基础', desc: '员工当前岗位信息', enabled: true, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 5, name: '入职日期', module: '基础考勤', category: '人事基础', desc: '员工入职日期', enabled: true, hasFormula: false, dataType: '日期型', isCustom: false },
  { id: 6, name: '上班打卡时间', module: '基础考勤', category: '打卡信息', desc: '当日第一次上班打卡的具体时间', enabled: true, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 7, name: '下班打卡时间', module: '基础考勤', category: '打卡信息', desc: '当日最后一次下班打卡的具体时间', enabled: true, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 8, name: '打卡地点', module: '基础考勤', category: '打卡信息', desc: '打卡时的GPS定位或Wi-Fi位置信息', enabled: false, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 9, name: '打卡设备', module: '基础考勤', category: '打卡信息', desc: '打卡所使用的设备类型信息', enabled: false, hasFormula: false, dataType: '文本型', isCustom: false },
  { id: 10, name: '应出勤天数', module: '基础考勤', category: '考勤基础', desc: '当月根据排班应出勤的总天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 11, name: '实际出勤天数', module: '基础考勤', category: '考勤基础', desc: '当月实际签到出勤的天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 12, name: '旷工天数', module: '薪资核算', category: '考勤基础', desc: '当月无故缺勤的天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 13, name: '迟到次数', module: '基础考勤', category: '考勤基础', desc: '当月迟到的总次数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 14, name: '迟到时长(分钟)', module: '薪资核算', category: '考勤基础', desc: '当月迟到累计时长，单位分钟', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 15, name: '早退次数', module: '基础考勤', category: '考勤基础', desc: '当月早退的总次数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 16, name: '早退时长(分钟)', module: '薪资核算', category: '考勤基础', desc: '当月早退累计时长，单位分钟', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 17, name: '正班时长(小时)', module: '薪资核算', category: '考勤基础', desc: '当月正常班次累计工时，单位小时', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 18, name: '年假天数', module: '薪资核算', category: '请假时长', desc: '当月年假申请并获批的天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 19, name: '事假天数', module: '薪资核算', category: '请假时长', desc: '当月事假申请并获批的天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 20, name: '病假天数', module: '薪资核算', category: '请假时长', desc: '当月病假申请并获批的天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 21, name: '婚假天数', module: '薪资核算', category: '请假时长', desc: '当月婚假申请并获批的天数', enabled: false, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 22, name: '产假天数', module: '薪资核算', category: '请假时长', desc: '当月产假申请并获批的天数', enabled: false, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 23, name: '工作日加班时长(小时)', module: '薪资核算', category: '加班信息', desc: '当月工作日加班累计时长，单位小时', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 24, name: '周末加班时长(小时)', module: '薪资核算', category: '加班信息', desc: '当月周末加班累计时长，单位小时', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 25, name: '节假日加班时长(小时)', module: '薪资核算', category: '加班信息', desc: '当月节假日加班累计时长，单位小时', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 26, name: '出差天数', module: '基础考勤', category: '其他', desc: '当月出差申请并获批的天数', enabled: true, hasFormula: true, dataType: '数值型', isCustom: false },
  { id: 27, name: '外勤次数', module: '基础考勤', category: '其他', desc: '当月外勤申请并获批的次数', enabled: true, hasFormula: false, dataType: '数值型', isCustom: false },
  { id: 28, name: '项目津贴工时', module: '薪资核算', category: '自定义', desc: '项目组特殊津贴工时统计（外部数据支持）', enabled: true, hasFormula: false, dataType: '数值型', isCustom: true },
];

function normalizeStatItemRow(row, index) {
  return {
    id: Number(row?.id) || index + 1,
    name: asText(row?.name, ''),
    module: asText(row?.module, '基础考勤'),
    category: asText(row?.category, row?.isCustom ? '自定义' : '其他'),
    desc: asText(row?.desc, ''),
    enabled: row?.enabled !== false,
    hasFormula: Boolean(row?.hasFormula),
    dataType: asText(row?.dataType, '数值型'),
    isCustom: Boolean(row?.isCustom),
    scope: asText(row?.scope, '日考勤统计与月汇总'),
    externalEnabled: row?.externalEnabled !== undefined ? Boolean(row.externalEnabled) : Boolean(row?.isCustom),
    defaultValue: asText(row?.defaultValue, ''),
    resultType: asText(row?.resultType, '求和'),
    unit: asText(row?.unit, ''),
    decimal: Number.isFinite(Number(row?.decimal)) ? Number(row.decimal) : 2,
    roundMode: asText(row?.roundMode, '四舍五入'),
    formulas: Array.isArray(row?.formulas)
      ? row.formulas.map((formula) => ({
        name: asText(formula?.name, ''),
        expr: asText(formula?.expr, ''),
      })).filter((formula) => formula.name || formula.expr)
      : [],
  };
}

function getStatItemRows() {
  const storedRows = getStoredRows('statItems');
  const sourceRows = storedRows && storedRows.length ? storedRows : DEFAULT_STAT_ITEMS;
  return sourceRows.map(normalizeStatItemRow).filter((row) => row.name);
}

app.get('/api/stat-items', (_req, res) => {
  const storedRows = getStoredRows('statItems');
  const rows = getStatItemRows();
  return res.json({
    sourceFile: storedRows && storedRows.length ? '本地持久化数据 data-store.json' : '系统默认统计项配置',
    sheetName: '统计项管理',
    total: rows.length,
    rows,
  });
});

app.put('/api/stat-items', (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: 'rows必须是数组' });
  }
  const normalizedRows = rows.map(normalizeStatItemRow).filter((row) => row.name);
  setStoredRows('statItems', normalizedRows);
  return res.json({ ok: true, sourceFile: '本地持久化数据 data-store.json', total: normalizedRows.length, rows: normalizedRows });
});


app.get('/api/external-records', (_req, res) => {
  return sendLinkedRows(res, 'externalRecords', buildLinkedExternalRows());
});

app.put('/api/external-records', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ message: 'rows必须是外部数据数组' });
  const employees = linkedDemoEmployees();
  const byNo = new Map(employees.map((employee) => [asRawText(employee.employeeNo), employee]));
  const normalizedRows = rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) => {
      const employeeNo = asText(row.empId || row.employeeNo || row.employeeId, '');
      const employee = byNo.get(asRawText(employeeNo));
      return {
        id: Number(row.id) || Date.now() + index,
        module: asText(row.module, '基础考勤'),
        attendDate: asText(row.attendDate, currentDateText()),
        period: asText(row.period, currentDateText().slice(0, 7)),
        statItem: asText(row.statItem, ''),
        statValue: row.statValue ?? '',
        employeeName: asText(row.employeeName || row.name, employee?.name || ''),
        employeeNo,
        empId: employeeNo,
        employeeId: employee?.id || employeeNo,
        dept: asText(row.dept, employee?.department || ''),
        creator: asText(row.creator, '后台维护'),
        createTime: asText(row.createTime, nowText()),
        modifier: asText(row.modifier, ''),
        modifyTime: asText(row.modifyTime, ''),
      };
    })
    .filter((row) => asRawText(row.empId) && asRawText(row.statItem));
  setStoredRows('externalRecords', normalizedRows);
  return sendLinkedRows(res, 'externalRecords', buildLinkedExternalRows(), { ok: true });
});

const MOBILE_OFFICE = {
  id: 'loc_huatuo',
  name: '华托大厦',
  latitude: 31.25909,
  longitude: 121.3491,
  radius: 300,
};

const MOBILE_SHIFT = {
  id: 'shift_0900_1800',
  name: '早九晚六',
  clockInTime: '09:00',
  clockOutTime: '18:00',
};

function getShiftSettingRows() {
  const storedRows = getStoredRows('settingsShifts');
  return storedRows && storedRows.length ? storedRows : DEFAULT_SHIFT_SETTING_ROWS;
}

function getGroupSettingRows() {
  const storedRows = getStoredRows('settingsGroups');
  return storedRows && storedRows.length ? storedRows : DEFAULT_GROUP_SETTING_ROWS;
}

function getCardRuleSettingRows() {
  const storedRows = getStoredRows('settingsCardRules');
  return storedRows && storedRows.length ? storedRows : DEFAULT_CARD_RULE_ROWS;
}

function getMobileClockSettingRows() {
  const storedRows = getStoredRows('settingsMobileClock');
  return storedRows && storedRows.length ? storedRows : DEFAULT_MOBILE_CLOCK_ROWS;
}

function getLocationSettingRows() {
  const storedRows = getStoredRows('settingsLocation');
  return storedRows && storedRows.length ? storedRows : DEFAULT_LOCATION_SETTING_ROWS;
}

function getHolidaySettingRows() {
  const storedRows = getStoredRows('settingsHoliday');
  return storedRows && storedRows.length ? storedRows : DEFAULT_HOLIDAY_SETTING_ROWS;
}

function getCalendarSettingRows() {
  const storedRows = getStoredRows('settingsCalendar');
  return storedRows && storedRows.length ? storedRows : DEFAULT_CALENDAR_SETTING_ROWS;
}

function getOvertimeRuleSettingRows() {
  const storedRows = getStoredRows('settingsOvertimeRules');
  return storedRows && storedRows.length ? storedRows : DEFAULT_OVERTIME_RULE_ROWS;
}

function getFieldRuleSettingRows() {
  const storedRows = getStoredRows('settingsFieldRules');
  return storedRows && storedRows.length ? storedRows : DEFAULT_FIELD_RULE_ROWS;
}

function getStatSchemeSettingRows() {
  const storedRows = getStoredRows('settingsStatSchemes');
  return storedRows && storedRows.length ? storedRows : DEFAULT_STAT_SCHEME_ROWS;
}

function getSettingsFaceRows() {
  return employeeMasterRows().map(onboardedEmployeeToFaceRow);
}

function parseShiftClockTimes(value) {
  const text = asText(value, '');
  if (!text || text.includes('休息')) return { clockInTime: '', clockOutTime: '' };
  const match = text.match(/(\d{1,2}):(\d{2})\s*[-~—至]\s*(\d{1,2}):(\d{2})/);
  if (!match) return { clockInTime: MOBILE_SHIFT.clockInTime, clockOutTime: MOBILE_SHIFT.clockOutTime };
  const clockInTime = `${match[1].padStart(2, '0')}:${match[2]}`;
  const clockOutTime = `${match[3].padStart(2, '0')}:${match[4]}`;
  return { clockInTime, clockOutTime };
}

function shiftIdFromTimes(clockInTime, clockOutTime, name) {
  if (name === '休息') return 'shift_rest';
  const inPart = asText(clockInTime, MOBILE_SHIFT.clockInTime).replace(':', '');
  const outPart = asText(clockOutTime, MOBILE_SHIFT.clockOutTime).replace(':', '');
  const baseId = `shift_${inPart}_${outPart}`;
  if (name === MOBILE_SHIFT.name) return baseId;
  let hash = 0;
  for (const char of asText(name, '')) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return `${baseId}_${hash.toString(36)}`;
}

function shiftOptionFromRow(row) {
  const name = asText(row?.[0], MOBILE_SHIFT.name);
  const { clockInTime, clockOutTime } = parseShiftClockTimes(row?.[5]);
  const isRest = name === '休息' || asText(row?.[5], '').includes('休息');
  return {
    id: isRest ? 'shift_rest' : shiftIdFromTimes(clockInTime, clockOutTime, name),
    name,
    shortName: asText(row?.[1], name),
    color: asText(row?.[2], '#B53A2A'),
    time: isRest ? '休息' : `${clockInTime}-${clockOutTime}`,
    clockInTime: isRest ? '' : clockInTime,
    clockOutTime: isRest ? '' : clockOutTime,
  };
}

function getShiftOptions() {
  const seen = new Set();
  return getShiftSettingRows()
    .map(shiftOptionFromRow)
    .filter((shift) => {
      if (!shift.name || seen.has(shift.id)) return false;
      seen.add(shift.id);
      return true;
    });
}

function resolveShiftOption(input = {}) {
  const requestedId = asRawText(input.shiftId || input.id);
  const requestedName = asRawText(input.shiftName || input.name || input.shift);
  const options = getShiftOptions();
  return options.find((item) => requestedId && item.id === requestedId)
    || options.find((item) => requestedName && item.name === requestedName)
    || options.find((item) => item.id === MOBILE_SHIFT.id)
    || { ...MOBILE_SHIFT, shortName: MOBILE_SHIFT.name, time: `${MOBILE_SHIFT.clockInTime}-${MOBILE_SHIFT.clockOutTime}`, color: '#B53A2A' };
}

function getEmployeeDefaultShift(employee) {
  const group = groupSettingForEmployee(employee);
  return resolveShiftOption({
    shiftId: employee?.shiftId,
    shiftName: employee?.shiftName || group?.[3],
  });
}

const DEFAULT_MOBILE_EMPLOYEE = {
  id: '',
  userId: '',
  name: '未绑定员工',
  employeeNo: '',
  department: '未分配部门',
  position: '员工',
  attendanceGroupId: 'group_huatuo',
  attendanceGroupName: '华托大厦',
  shiftId: MOBILE_SHIFT.id,
  shiftName: MOBILE_SHIFT.name,
  faceStatus: '已录入',
  office: MOBILE_OFFICE,
};

function normalizeMobileEmployee(input = {}) {
  const employeeNo = asRawText(input.employeeNo || input.empId || DEFAULT_MOBILE_EMPLOYEE.employeeNo);
  const userId = asRawText(input.userId || `wecom_${employeeNo}` || DEFAULT_MOBILE_EMPLOYEE.userId);
  const office = input.office && typeof input.office === 'object' ? input.office : MOBILE_OFFICE;
  const shift = resolveShiftOption(input);
  return {
    ...DEFAULT_MOBILE_EMPLOYEE,
    ...input,
    id: asRawText(input.id || `emp_${employeeNo}`),
    userId,
    name: asText(input.name, DEFAULT_MOBILE_EMPLOYEE.name),
    employeeNo,
    department: asText(input.department || input.dept, DEFAULT_MOBILE_EMPLOYEE.department),
    attendanceGroupId: asText(input.attendanceGroupId, DEFAULT_MOBILE_EMPLOYEE.attendanceGroupId),
    attendanceGroupName: asText(input.attendanceGroupName || input.attendGroup, DEFAULT_MOBILE_EMPLOYEE.attendanceGroupName),
    shiftId: shift.id,
    shiftName: shift.name,
    faceStatus: asText(input.faceStatus, DEFAULT_MOBILE_EMPLOYEE.faceStatus),
    office: {
      ...MOBILE_OFFICE,
      ...office,
      latitude: Number(office.latitude ?? MOBILE_OFFICE.latitude),
      longitude: Number(office.longitude ?? MOBILE_OFFICE.longitude),
      radius: Number(office.radius ?? MOBILE_OFFICE.radius),
    },
  };
}

function readMobileUsers() {
  const configured = process.env.MOBILE_ENABLE_TEST_USERS === 'true'
    ? readJsonFile(MOBILE_TEST_USERS_FILE, null)
    : [];
  const persisted = getOnboardedEmployees();
  const users = [
    ...(Array.isArray(configured) ? configured : []),
    ...persisted,
  ];
  return users.map(normalizeMobileEmployee);
}

function getDefaultMobileEmployee() {
  const preferredNo = asRawText(process.env.MOBILE_TEST_EMPLOYEE_NO);
  const users = readMobileUsers();
  return users.find((user) => preferredNo && user.employeeNo === preferredNo) || users[0] || null;
}

function findMobileEmployee(criteria = {}) {
  const employeeNo = asRawText(criteria.employeeNo || criteria.empNo);
  const userId = asRawText(criteria.userId);
  const users = readMobileUsers();
  return users.find((user) => employeeNo && user.employeeNo === employeeNo)
    || users.find((user) => userId && user.userId === userId)
    || null;
}

function isWecomStrictMode() {
  return WECOM_AUTH_MODE === 'wecom';
}

async function fetchWecomJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.errcode && data.errcode !== 0)) {
    const message = data.errmsg || `企业微信接口调用失败：${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function getWecomAccessToken() {
  if (!WECOM_CORP_ID || !WECOM_APP_SECRET) {
    throw new Error('未配置企业微信 WECOM_CORP_ID 或 WECOM_APP_SECRET');
  }
  const params = new URLSearchParams({
    corpid: WECOM_CORP_ID,
    corpsecret: WECOM_APP_SECRET,
  });
  const data = await fetchWecomJson(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?${params}`);
  if (!data.access_token) {
    throw new Error('企业微信未返回 access_token');
  }
  return data.access_token;
}

async function getWecomLoginUserId(code) {
  const accessToken = await getWecomAccessToken();
  const params = new URLSearchParams({
    access_token: accessToken,
    js_code: code,
    grant_type: 'authorization_code',
  });
  const data = await fetchWecomJson(`https://qyapi.weixin.qq.com/cgi-bin/miniprogram/jscode2session?${params}`);
  const userId = asRawText(data.userid || data.UserId || data.user_id);
  if (!userId) {
    throw new Error('企业微信未返回 UserID，请确认小程序已关联企业微信应用');
  }
  return userId;
}

function tokenForEmployee(employee) {
  return `mock-mobile-token:${encodeURIComponent(employee.userId)}`;
}

function employeeFromToken(token) {
  const prefix = 'mock-mobile-token:';
  if (!token || !token.startsWith(prefix)) return null;
  const userId = decodeURIComponent(token.slice(prefix.length));
  return readMobileUsers().find((user) => user.userId === userId) || null;
}

function getRequestEmployee(req) {
  const auth = asRawText(req.headers?.authorization);
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return employeeFromToken(token);
}

function requireRequestEmployee(req, res) {
  const employee = getRequestEmployee(req);
  if (!employee) {
    res.status(401).json({ message: '未登录或员工不存在，请先在后台人脸管理录入员工后重新登录' });
    return null;
  }
  return employee;
}

function getEmployeeShift(employee, dateText = currentDateText()) {
  const schedule = getEmployeeSchedule(employee, dateText);
  return resolveShiftOption({
    shiftId: schedule?.shiftId || employee.shiftId,
    shiftName: schedule?.shiftName || employee.shiftName || groupSettingForEmployee(employee)?.[3],
  });
}

function getEmployeeOffice(employee) {
  const groupName = asText(employee?.attendanceGroupName, '');
  const locationRow = getLocationSettingRows().find((row) => asText(row?.[1], '') === groupName)
    || getLocationSettingRows().find((row) => asText(row?.[0], '') === asText(employee?.office?.name, ''))
    || getLocationSettingRows()[0];
  if (!locationRow) return employee.office || MOBILE_OFFICE;
  return {
    ...(employee.office || MOBILE_OFFICE),
    name: asText(locationRow[0], employee.office?.name || MOBILE_OFFICE.name),
    address: asText(locationRow[2], employee.office?.address || locationRow[0] || MOBILE_OFFICE.name),
    wifi: asText(locationRow[4], ''),
    bluetooth: asText(locationRow[3], ''),
    mobileScheme: asText(locationRow[5], ''),
  };
}

function getMobileRows(key, fallback = []) {
  return getStoredRows(key) || fallback;
}

function setMobileRows(key, rows) {
  setStoredRows(key, rows);
  return rows;
}

function nowText() {
  const parts = dateTimeParts();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function todayRecordSummary(records, employee, dateText = currentDateText()) {
  const todayRows = records.filter((record) => record.date === dateText && record.employeeId === employee.id);
  const clockIn = todayRows.find((record) => record.type === 'clockIn');
  const clockOut = todayRows.find((record) => record.type === 'clockOut');
  return {
    clockIn: clockIn || null,
    clockOut: clockOut || null,
    canClockIn: !clockIn,
    canClockOut: Boolean(clockIn && !clockOut),
  };
}

function distanceInMeters(a, b) {
  const earthRadius = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function mobileAnomalyDefaults() {
  return [];
}

function mapMobileClockRowsToAdmin(rows) {
  return rows.map((row, index) => ({
    id: 900000 + index + 1,
    name: asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name),
    empId: asText(row.employeeNo, DEFAULT_MOBILE_EMPLOYEE.employeeNo),
    dept: asText(row.dept, DEFAULT_MOBILE_EMPLOYEE.department),
    date: asText(row.date, currentDateText()),
    time: asText(row.time, ''),
    source: asText(row.source, '企业微信小程序'),
    device: asText(row.device, '企业微信小程序'),
    location: `${asText(row.address, MOBILE_OFFICE.name)} · 距离${Math.round(Number(row.distance || 0))}m · 精度${Math.round(Number(row.accuracy || 0))}m`,
    workLocation: asText(row.workLocation, MOBILE_OFFICE.name),
    freeWork: row.type === 'clockOut' ? '下班' : '上班',
    note: row.result === 'normal' ? '移动端打卡，人脸核验通过' : asText(row.message, '移动端异常打卡'),
    hasPhoto: Boolean(row.photoUrl),
    photoUrl: asText(row.photoUrl, ''),
    photoTakenAt: asText(row.photoTakenAt || row.serverTime, ''),
    creator: asText(row.creator, '移动端'),
    createTime: asText(row.serverTime, ''),
    modifier: asText(row.modifier, ''),
    modifyTime: asText(row.modifyTime, ''),
  }));
}

function mapMobileClockRowsToAttendanceStats(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const key = asText(row.employeeNo || row.employeeId, DEFAULT_MOBILE_EMPLOYEE.employeeNo);
    const existing = grouped.get(key) || {
      name: asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name),
      empId: key,
      attendGroup: asText(row.attendanceGroupName || row.workLocation, DEFAULT_MOBILE_EMPLOYEE.attendanceGroupName),
      dept: asText(row.dept, DEFAULT_MOBILE_EMPLOYEE.department),
      deptFull: asText(row.dept, DEFAULT_MOBILE_EMPLOYEE.department),
      shift: asText(row.shiftName, MOBILE_SHIFT.name),
      type: '移动端打卡',
      attendance: '已出勤',
      status: '已出勤',
      anomaly: '-',
      leave: '-',
      fieldTrip: '-',
      cin1: '-',
      cout1: '-',
      cin2: '-',
      cout2: '-',
      cin3: '-',
      cout3: '-',
    };

    const clockField = row.type === 'clockOut' ? 'cout1' : 'cin1';
    const isLatestClock = existing[clockField] === '-';
    if (isLatestClock) {
      existing[clockField] = asText(row.time, '-');
    }

    if (isLatestClock && row.result !== 'normal') {
      existing.status = '异常';
      existing.anomaly = asText(row.message, '移动端异常打卡');
    }

    grouped.set(key, existing);
  }

  return [...grouped.values()];
}

function mapMobileClockRowsToPhoto(rows) {
  return rows
    .filter((row) => row.photoFileId || row.faceVerifyId)
    .map((row, index) => ({
      id: 910000 + index + 1,
      name: asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name),
      empId: asText(row.employeeNo, DEFAULT_MOBILE_EMPLOYEE.employeeNo),
      dept: asText(row.dept, DEFAULT_MOBILE_EMPLOYEE.department),
      date: asText(row.date, currentDateText()),
      clockTime: asText(row.time, ''),
      locateTime: asText(row.time, ''),
      completeTime: asText(row.serverTime, ''),
      location: `${asText(row.address, MOBILE_OFFICE.name)} · 距离${Math.round(Number(row.distance || 0))}m`,
      note: `人脸核验ID：${asText(row.faceVerifyId, '-')}`,
      hasPhoto: Boolean(row.photoUrl),
      photoUrl: asText(row.photoUrl, ''),
      photoTakenAt: asText(row.photoTakenAt || row.serverTime, ''),
      reviewStatus: row.result === 'normal' ? '已通过' : '审批中',
    }));
}

function mapMobileMakeupRowsToAdmin(rows) {
  return rows.map((row, index) => ({
    id: 920000 + index + 1,
    status: row.status === 'pending' ? '审批中' : asText(row.status, '审批中'),
    applicant: asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name),
    applicantId: asText(row.employeeNo, DEFAULT_MOBILE_EMPLOYEE.employeeNo),
    applicantDept: asText(row.dept, DEFAULT_MOBILE_EMPLOYEE.department),
    makeupDate: asText(row.date, ''),
    makeupTime: asText(row.time, ''),
    reason: asText(row.reason, ''),
    initiator: asText(row.initiatorName, asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name)),
    initiatorId: asText(row.initiatorNo, asText(row.employeeNo, DEFAULT_MOBILE_EMPLOYEE.employeeNo)),
    initiateTime: asText(row.createTime, ''),
    completeTime: asText(row.completeTime, ''),
    hasPhoto: Boolean(row.attachmentName),
    archiveStatus: asText(row.archiveStatus, '未归档'),
  }));
}

function mapMobileAnomalyRowsToAdmin(rows) {
  return rows.map((row, index) => {
    const desc = asText(row.desc, '移动端异常打卡');
    const handled = Boolean(row.handled);
    return {
      id: 930000 + index + 1,
      name: asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name),
      empId: asText(row.employeeNo, DEFAULT_MOBILE_EMPLOYEE.employeeNo),
      dept: asText(row.dept, DEFAULT_MOBILE_EMPLOYEE.department),
      date: asText(row.date, currentDateText()),
      weekday: weekdayFromDate(asText(row.date, currentDateText())),
      shift: asText(row.shiftName, MOBILE_SHIFT.name),
      type: classifyAnomalyType(desc),
      desc,
      clock: '移动端打卡',
      reminder: '未提醒',
      handled,
      writeOff: handled ? '已核销' : '未核销',
      remark: row.clockRecordId ? `关联移动端打卡：${row.clockRecordId}` : '',
      remarkUpdatedAt: '',
    };
  });
}

app.post('/api/wecom/login', async (req, res) => {
  const code = asRawText(req.body?.code);
  if (!code) {
    return res.status(400).json({ message: '缺少企业微信登录code' });
  }
  const requestedEmployeeNo = asRawText(req.body?.employeeNo);
  try {
    if (isWecomStrictMode()) {
      const verifiedUserId = await getWecomLoginUserId(code);
      const employee = findMobileEmployee({ userId: verifiedUserId });
      if (!employee) {
        return res.status(403).json({ message: `企业微信 UserID ${verifiedUserId} 未绑定员工，请先在后台人脸管理录入` });
      }
      return res.json({
        token: tokenForEmployee(employee),
        employee,
        authMode: WECOM_AUTH_MODE,
      });
    }

    const requestedUserId = asRawText(req.body?.userId);
    const employee = findMobileEmployee({ employeeNo: requestedEmployeeNo, userId: requestedUserId }) || getDefaultMobileEmployee();
    if (!employee) {
      return res.status(404).json({ message: '当前没有可登录员工，请先在后台人脸管理录入员工' });
    }
    if (requestedEmployeeNo && employee.employeeNo !== requestedEmployeeNo) {
      return res.status(404).json({ message: `未找到员工号 ${requestedEmployeeNo}，请先在后台人脸管理录入员工` });
    }
    return res.json({
      token: tokenForEmployee(employee),
      employee,
      authMode: WECOM_AUTH_MODE,
    });
  } catch (error) {
    console.error('[wecom-login]', error);
    return res.status(502).json({ message: error.message || '企业微信登录失败' });
  }
});

app.get('/api/mobile/me', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const office = getEmployeeOffice(employee);
  res.json({
    employee,
    attendanceGroup: {
      id: employee.attendanceGroupId,
      name: employee.attendanceGroupName,
      location: office,
    },
    settings: {
      shift: getEmployeeShift(employee),
      dateType: getEmployeeDateType(employee),
      mobileScheme: mobileSchemeForEmployee(employee),
      cardRule: cardRuleForEmployee(employee),
      fieldRule: fieldRuleForEmployee(employee),
      overtimeRule: overtimeRuleForEmployee(employee),
    },
    version: '0.1.0',
  });
});

app.get('/api/mobile/today', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const date = currentDateText();
  const records = getMobileRows('mobileClockRecords', []);
  const status = todayRecordSummary(records, employee, date);
  const pendingAnomalies = getMobileRows('mobileAnomalies', mobileAnomalyDefaults())
    .filter((item) => (!item.employeeId || item.employeeId === employee.id) && !item.handled).length;
  res.json({
    date,
    weekday: currentWeekdayText(date),
    employee,
    shift: getEmployeeShift(employee, date),
    location: getEmployeeOffice(employee),
    dateType: getEmployeeDateType(employee, date),
    mobileScheme: mobileSchemeForEmployee(employee),
    cardRule: cardRuleForEmployee(employee),
    status,
    pendingAnomalies,
  });
});

app.post('/api/mobile/face-verify', async (req, res) => {
  const id = `face_${Date.now()}`;
  const photoFileId = `photo_${Date.now()}`;
  try {
    const buffer = await readRequestBuffer(req);
    const photo = parseMultipartPhoto(buffer, req.headers['content-type']);
    let photoUrl = '';
    let storedPath = '';
    let mimeType = '';
    if (photo && photo.buffer.length > 0) {
      const ext = imageExtension(photo.mimeType, photo.filename);
      const fileName = `${photoFileId}${ext}`;
      const photoDir = path.join(UPLOAD_DIR, 'clock-photos');
      fs.mkdirSync(photoDir, { recursive: true });
      storedPath = path.join(photoDir, fileName);
      fs.writeFileSync(storedPath, photo.buffer);
      photoUrl = `/uploads/clock-photos/${fileName}`;
      mimeType = photo.mimeType;
    }

    const photos = getMobileRows('mobileFacePhotos', []);
    setMobileRows('mobileFacePhotos', [{
      id,
      photoFileId,
      photoUrl,
      storedPath,
      mimeType,
      takenAt: nowText(),
    }, ...photos]);

    res.json({
      faceVerifyId: id,
      photoFileId,
      photoUrl: publicUrl(req, photoUrl),
      passed: true,
      message: photoUrl ? '人脸核验通过，照片已保存' : '人脸核验通过，未收到照片文件',
    });
  } catch (error) {
    res.status(400).json({ message: error.message || '人脸照片上传失败' });
  }
});

app.post('/api/mobile/clock', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  if (mobileSchemeDisabled(employee)) {
    return res.status(403).json({ message: '当前考勤组的移动打卡方案已停用，请联系管理员' });
  }
  const office = getEmployeeOffice(employee);
  const shift = getEmployeeShift(employee, currentDateText());
  const type = req.body?.type;
  if (!['clockIn', 'clockOut'].includes(type)) {
    return res.status(400).json({ message: 'type必须是clockIn或clockOut' });
  }
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const accuracy = Number(req.body?.accuracy || 0);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ message: '缺少有效定位坐标' });
  }
  if (!req.body?.faceVerifyId) {
    return res.status(400).json({ message: '缺少人脸核验结果' });
  }

  const distance = distanceInMeters({ latitude, longitude }, office);
  const inRange = distance <= office.radius;
  const preciseEnough = !accuracy || accuracy <= 100;
  const testModeLocationBypass = !isWecomStrictMode();
  const locationAccepted = inRange || MOBILE_ALLOW_OUT_OF_RANGE || testModeLocationBypass;
  const records = getMobileRows('mobileClockRecords', []);
  const serverTime = nowText();
  const photoMeta = getMobileRows('mobileFacePhotos', []).find((item) => asText(item.photoFileId, '') === asText(req.body?.photoFileId, ''));
  const record = {
    id: `clock_${Date.now()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeNo: employee.employeeNo,
    dept: employee.department,
    attendanceGroupName: employee.attendanceGroupName,
    shiftName: shift.name,
    date: currentDateText(),
    type,
    time: serverTime.slice(11, 16),
    serverTime,
    latitude,
    longitude,
    accuracy,
    address: asText(req.body?.address, office.name),
    workLocation: office.name,
    distance: Math.round(distance),
    faceVerifyId: req.body.faceVerifyId,
    photoFileId: req.body?.photoFileId || '',
    photoUrl: photoMeta?.photoUrl ? publicUrl(req, photoMeta.photoUrl) : asText(req.body?.photoUrl, ''),
    photoTakenAt: asText(photoMeta?.takenAt, serverTime),
    result: locationAccepted && preciseEnough ? 'normal' : 'abnormal',
    message: locationAccepted && preciseEnough
      ? (inRange ? '打卡成功' : '打卡成功（测试模式已放行定位范围）')
      : '打卡已记录，需管理员复核',
  };
  setMobileRows('mobileClockRecords', [record, ...records]);

  if (!locationAccepted || !preciseEnough) {
    const anomalies = getMobileRows('mobileAnomalies', mobileAnomalyDefaults());
    const nextId = anomalies.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    setMobileRows('mobileAnomalies', [{
      id: nextId,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeNo: employee.employeeNo,
      dept: employee.department,
      shiftName: shift.name,
      date: currentDateText(),
      type: 'clock',
      desc: !locationAccepted ? '定位范围外打卡' : '定位精度异常',
      status: 'pending',
      handled: false,
      clockRecordId: record.id,
    }, ...anomalies]);
  }

  res.json({
    id: record.id,
    serverTime: record.time,
    result: record.result,
    message: record.message,
    distance: record.distance,
  });
});

app.get('/api/mobile/clock-records', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const records = getMobileRows('mobileClockRecords', []).filter((record) => record.employeeId === employee.id);
  res.json({ total: records.length, rows: records });
});

app.get('/api/clock-makeup-records', (_req, res) => {
  const rows = buildLinkedMakeupRows();
  res.json({
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'mobileMakeupRequests',
    total: rows.length,
    rows,
    linkedOnly: true,
  });
});

app.put('/api/clock-makeup-records', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是补卡记录数组' });
  }
  const employees = linkedDemoEmployees();
  const byNo = new Map(employees.map((employee) => [asRawText(employee.employeeNo), employee]));
  const normalizedRows = rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) => {
      const employeeNo = asText(row.applicantId || row.employeeNo, '');
      const employee = byNo.get(asRawText(employeeNo));
      return {
        id: asText(row.rawId || row.id, `manual_makeup_${Date.now()}_${index}`),
        employeeId: employee?.id || employeeNo,
        employeeName: asText(row.applicant || row.employeeName, employee?.name || ''),
        employeeNo,
        dept: asText(row.applicantDept, employee?.department || ''),
        date: asText(row.makeupDate, currentDateText()),
        time: asText(row.makeupTime, nowText().slice(11, 16)),
        type: asText(row.clockType, '补卡'),
        reason: asText(row.reason, '手动发起补卡记录'),
        attachmentName: row.hasPhoto ? asText(row.attachmentName, '补卡附件') : '',
        status: asText(row.status, '审批中') === '审批中' ? 'pending' : asText(row.status, '审批中'),
        createTime: asText(row.initiateTime, nowText()),
        completeTime: asText(row.completeTime, ''),
        archiveStatus: asText(row.archiveStatus, '未归档'),
        initiatorName: asText(row.initiator, '当前用户'),
        initiatorNo: asText(row.initiatorId, 'CURRENT'),
      };
    })
    .filter((row) => asRawText(row.employeeNo));
  setMobileRows('mobileMakeupRequests', normalizedRows);
  const adminRows = mapMobileMakeupRowsToAdmin(filterRowsToOnboardedEmployees(normalizedRows));
  return res.json({
    ok: true,
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'mobileMakeupRequests',
    total: adminRows.length,
    rows: adminRows,
    linkedOnly: true,
  });
});

app.get('/api/clock-field-records', (_req, res) => {
  return sendLinkedRows(res, 'clockFieldRecords', filterRowsToOnboardedEmployees(getStoredRows('clockFieldRecords') || []));
});

app.put('/api/clock-field-records', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows必须是外勤记录数组' });
  }
  const employees = linkedDemoEmployees();
  const byNo = new Map(employees.map((employee) => [asRawText(employee.employeeNo), employee]));
  const normalizedRows = rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) => {
      const employeeNo = asText(row.empId || row.employeeNo, '');
      const employee = byNo.get(asRawText(employeeNo));
      return {
        id: Number(row.id) || Date.now() + index,
        name: asText(row.name, employee?.name || ''),
        empId: employeeNo,
        initiator: asText(row.initiator, asText(row.name, employee?.name || '当前用户')),
        initiatorId: asText(row.initiatorId, employeeNo || 'CURRENT'),
        source: asText(row.source, 'PC端申请'),
        dept: asText(row.dept, employee?.department || ''),
        date: asText(row.date, currentDateText()),
        time: asText(row.time, '09:00 - 18:00'),
        initiateTime: asText(row.initiateTime, nowText()),
        completeTime: asText(row.completeTime, ''),
        location: asText(row.location, '待补充'),
        note: asText(row.note, ''),
        hasPhoto: Boolean(row.hasPhoto),
        reviewStatus: asText(row.reviewStatus, '审批中'),
      };
    })
    .filter((row) => asRawText(row.empId));
  setStoredRows('clockFieldRecords', normalizedRows);
  const linkedRows = filterRowsToOnboardedEmployees(normalizedRows);
  return res.json({
    ok: true,
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'clockFieldRecords',
    total: linkedRows.length,
    rows: linkedRows,
    linkedOnly: true,
  });
});

app.get('/api/photo-clock-records', (_req, res) => {
  const rows = mapMobileClockRowsToPhoto(filterRowsToOnboardedEmployees(getMobileRows('mobileClockRecords', [])));
  res.json({
    sourceFile: '员工主数据 + 小程序移动端 API',
    sheetName: 'mobileClockRecords',
    total: rows.length,
    rows,
    linkedOnly: true,
  });
});

app.get('/api/mobile/anomalies', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const type = asRawText(req.query?.type);
  const rows = getMobileRows('mobileAnomalies', mobileAnomalyDefaults())
    .filter((item) => (!item.employeeId || item.employeeId === employee.id) && (!type || item.type === type));
  res.json({ total: rows.length, rows });
});

app.post('/api/mobile/makeup-request', (req, res) => {
  const employee = requireRequestEmployee(req, res);
  if (!employee) return;
  const date = asRawText(req.body?.date);
  const time = asRawText(req.body?.time);
  const clockType = asRawText(req.body?.type);
  const reason = asRawText(req.body?.reason);
  if (!date || !time || !clockType || !reason) {
    return res.status(400).json({ message: '补卡日期、时间、班次和事由均为必填' });
  }

  const requests = getMobileRows('mobileMakeupRequests', []);
  const request = {
    id: `makeup_${Date.now()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeNo: employee.employeeNo,
    dept: employee.department,
    date,
    time,
    type: clockType,
    reason,
    attachmentName: asRawText(req.body?.attachmentName),
    status: 'pending',
    createTime: nowText(),
  };
  setMobileRows('mobileMakeupRequests', [request, ...requests]);
  res.json({ ok: true, request, message: '补卡申请已提交' });
});

app.listen(PORT, HOST, () => {
  console.log(`[data-server] running on http://${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`[data-server] local: http://localhost:${PORT}`);
  }
  console.log(`[data-server] data dir: ${DATA_DIR}`);
});
