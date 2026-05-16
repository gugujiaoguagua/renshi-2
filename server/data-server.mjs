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

function getOnboardedEmployees() {
  return getStoredRows('onboardedEmployees') || [];
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
  return getOnboardedEmployees().map(normalizeOnboardedEmployee);
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
  return (getStoredRows('employeeSchedules') || [])
    .filter((row) => asRawText(row.employeeNo) === asRawText(employee.employeeNo)
      && asText(row.date, '').startsWith(periodPrefix));
}

function getEmployeeSchedule(employee, dateText = currentDateText()) {
  return (getStoredRows('employeeSchedules') || [])
    .find((row) => asRawText(row.employeeNo) === asRawText(employee.employeeNo)
      && asText(row.date, '') === dateText) || null;
}

function currentMonthWorkdayCount() {
  const parts = currentDateText().split('-').map(Number);
  const [year, month, day] = parts;
  if (![year, month, day].every(Number.isFinite)) return 0;
  let count = 0;
  for (let cursorDay = 1; cursorDay <= day; cursorDay += 1) {
    const date = new Date(Date.UTC(year, month - 1, cursorDay, 4, 0, 0));
    const weekday = date.getUTCDay();
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
}

function employeeBase(employee) {
  return {
    name: employee.name,
    empId: employee.employeeNo,
    dept: employee.department,
    deptPath: employee.deptFullPath,
    position: employee.position,
    attendGroup: employee.attendanceGroupName,
    shiftName: employee.shiftName,
  };
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
    const todayRows = clockRowsForEmployeeDate(employee);
    const hasClock = todayRows.length > 0;
    const hasAnomaly = clockRowsHaveAnomaly(todayRows);
    const clockIn = clockInText(employee, todayRows);
    const clockOut = clockOutText(employee, todayRows);
    const shift = getEmployeeShift(employee);
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
      dateType: '工作日',
      weekday: currentWeekdayText().replace('星期', ''),
      attendResult: !hasClock ? '未打卡' : (hasAnomaly ? '异常' : '正常'),
      anomalyDesc: hasClock ? clockAnomalyText(todayRows) : '未打卡',
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
  const shouldWorkDays = currentMonthWorkdayCount();
  return linkedDemoEmployees().map((employee, index) => {
    const base = employeeBase(employee);
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
  return new Set(getOnboardedEmployees().map((employee) => asRawText(employee.employeeNo)).filter(Boolean));
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dataDir: DATA_DIR, files: listExcelFiles().map((f) => f.name) });
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

app.get('/api/field-trip-records', (_req, res) => {
  return sendLinkedRows(res, 'fieldTripRecords', buildLinkedFieldTripRows());
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
  const onboardedRows = getOnboardedEmployees().map(onboardedEmployeeToFaceRow);
  return sendLinkedRows(res, 'onboardedEmployees', onboardedRows);
});

app.get('/api/settings-people', (_req, res) => {
  const onboardedRows = getOnboardedEmployees().map(onboardedEmployeeToPeopleRow);
  return sendLinkedRows(res, 'onboardedEmployees', onboardedRows);
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

app.get('/api/stat-items', (_req, res) => {
  const storedRows = getStoredRows('statItems');
  const rows = storedRows && storedRows.length ? storedRows : DEFAULT_STAT_ITEMS;
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
  setStoredRows('statItems', rows);
  return res.json({ ok: true, sourceFile: '本地持久化数据 data-store.json', total: rows.length, rows });
});


app.get('/api/external-records', (_req, res) => {
  return sendLinkedRows(res, 'externalRecords', buildLinkedExternalRows());
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
    shiftName: schedule?.shiftName || employee.shiftName,
  });
}

function getEmployeeOffice(employee) {
  return employee.office || MOBILE_OFFICE;
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
    source: '企业微信小程序',
    device: '企业微信小程序',
    location: `${asText(row.address, MOBILE_OFFICE.name)} · 距离${Math.round(Number(row.distance || 0))}m · 精度${Math.round(Number(row.accuracy || 0))}m`,
    workLocation: asText(row.workLocation, MOBILE_OFFICE.name),
    freeWork: row.type === 'clockOut' ? '下班' : '上班',
    note: row.result === 'normal' ? '移动端打卡，人脸核验通过' : asText(row.message, '移动端异常打卡'),
    hasPhoto: Boolean(row.photoUrl),
    photoUrl: asText(row.photoUrl, ''),
    photoTakenAt: asText(row.photoTakenAt || row.serverTime, ''),
    creator: '移动端',
    createTime: asText(row.serverTime, ''),
    modifier: '',
    modifyTime: '',
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
    initiator: asText(row.employeeName, DEFAULT_MOBILE_EMPLOYEE.name),
    initiatorId: asText(row.employeeNo, DEFAULT_MOBILE_EMPLOYEE.employeeNo),
    initiateTime: asText(row.createTime, ''),
    completeTime: '',
    hasPhoto: Boolean(row.attachmentName),
    archiveStatus: '未归档',
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
  res.json({
    employee,
    attendanceGroup: {
      id: employee.attendanceGroupId,
      name: employee.attendanceGroupName,
      location: getEmployeeOffice(employee),
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
