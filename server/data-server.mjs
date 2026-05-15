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
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(WORKSPACE_DIR, '资料'));
const STORE_FILE = path.join(SERVER_DIR, 'data-store.json');
const MOBILE_TEST_USERS_FILE = path.join(SERVER_DIR, 'mobile-test-users.json');
const TIME_ZONE = 'Asia/Shanghai';
const DEMO_PERSON_LIMIT = 5;


app.use(cors());
app.use(express.json({ limit: '2mb' }));

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

function rowPersonKey(row) {
  if (Array.isArray(row)) return asText(row[1] || row[0], '');
  return asText(
    row?.empId || row?.employeeNo || row?.employeeId || row?.applicantId || row?.initiatorId || row?.name || row?.applicant || row?.employeeName,
    '',
  );
}

function limitDemoPeople(rows, keyGetter = rowPersonKey, limit = DEMO_PERSON_LIMIT) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyGetter(row) || `row-${seen.size}`;
    if (seen.has(key)) return true;
    if (seen.size >= limit) return false;
    seen.add(key);
    return true;
  });
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
    asText(getByAliases(row, ['班次性质']), '通用'),
    asText(getByAliases(row, ['班次标签']), '-'),
    asText(getByAliases(row, ['冬夏令时']), '-'),
    asText(getByAliases(row, ['工作时间', '上班时间']), '-'),
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
    const mapped = mapper(rows);
    const data = options.limitPeople === false ? mapped : limitDemoPeople(mapped);
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dataDir: DATA_DIR, files: listExcelFiles().map((f) => f.name) });
});

app.get('/api/data-sources', (_req, res) => {
  const files = listExcelFiles().map((f) => ({ name: f.name, mtime: f.stat.mtime, size: f.stat.size }));
  res.json({ files, dataDir: DATA_DIR });
});

app.get('/api/attendance-stats', (_req, res) => {
  const mobileRows = mapMobileClockRowsToAttendanceStats(getMobileRows('mobileClockRecords', []));
  const file = pickFile('实时统计', '每日统计表', '考勤明细');
  try {
    const { rows, sheetName } = readMappedRows(file, undefined, mapAttendanceRows);
    const data = limitDemoPeople([...mobileRows, ...rows]);
    if (!data.length) return res.status(404).json({ message: '未找到实时统计数据文件。' });
    return res.json({ sourceFile: mobileRows.length ? '小程序移动端 mock API + 实时统计' : file.name, sheetName, total: data.length, rows: data });
  } catch (error) {
    if (mobileRows.length) {
      const rows = limitDemoPeople(mobileRows);
      return res.json({ sourceFile: '小程序移动端 mock API', sheetName: 'mobileClockRecords', total: rows.length, rows });
    }
    return res.status(500).json({ message: '读取实时统计失败', detail: String(error?.message || error) });
  }
});

app.get('/api/daily-attendance', (_req, res) => {
  const persisted = getStoredRows('dailyAttendance');
  if (persisted) {
    const rows = limitDemoPeople(persisted);
    return res.json({ sourceFile: '本地持久化数据 data-store.json', sheetName: 'dailyAttendance', total: rows.length, rows, persisted: true });
  }
  sendMappedRows(res, pickFile('每日统计表'), undefined, mapDailyRows, '未找到每日统计表。');
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
  sendMappedRows(res, pickFile('考勤明细', '月考勤统计'), undefined, mapMonthlyRows, '未找到月考勤明细。');
});

app.get('/api/monthly-summary', (_req, res) => {
  const persisted = getStoredRows('monthlySummary');
  if (persisted) {
    const rows = limitDemoPeople(persisted);
    return res.json({ sourceFile: '本地持久化数据 data-store.json', sheetName: 'monthlySummary', total: rows.length, rows, persisted: true });
  }
  sendMappedRows(res, pickFile('月考勤统计'), undefined, mapMonthlySummaryRows, '未找到月考勤统计汇总表。');
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
  const mobileRows = mapMobileClockRowsToAdmin(getMobileRows('mobileClockRecords', []));
  const file = pickFile('原始打卡记录');
  try {
    const { rows, sheetName } = readMappedRows(file, (name) => name.includes('明细'), mapClockRows);
    const data = limitDemoPeople([...mobileRows, ...rows]);
    if (!data.length) return res.status(404).json({ message: '未找到原始打卡记录。' });
    return res.json({ sourceFile: mobileRows.length ? '小程序移动端 mock API + 原始打卡记录' : file.name, sheetName, total: data.length, rows: data });
  } catch (error) {
    if (mobileRows.length) {
      const rows = limitDemoPeople(mobileRows);
      return res.json({ sourceFile: '小程序移动端 mock API', sheetName: 'mobileClockRecords', total: rows.length, rows });
    }
    return res.status(500).json({ message: '读取原始打卡记录失败', detail: String(error?.message || error) });
  }
});

app.get('/api/attendance-anomalies', (_req, res) => {
  const mobileRows = mapMobileAnomalyRowsToAdmin(getMobileRows('mobileAnomalies', []));
  const persisted = getStoredRows('attendanceAnomalies');
  if (persisted) {
    const rows = limitDemoPeople([...mobileRows, ...persisted]);
    return res.json({ sourceFile: mobileRows.length ? '小程序移动端 mock API + 本地持久化数据 data-store.json' : '本地持久化数据 data-store.json', sheetName: 'attendanceAnomalies', total: rows.length, rows, persisted: true });
  }
  const file = pickFile('考勤异常');
  try {
    const { rows, sheetName } = readMappedRows(file, undefined, mapAnomalyRows);
    const data = limitDemoPeople([...mobileRows, ...rows]);
    if (!data.length) return res.status(404).json({ message: '未找到考勤异常数据。' });
    return res.json({ sourceFile: mobileRows.length ? '小程序移动端 mock API + 考勤异常' : file.name, sheetName, total: data.length, rows: data });
  } catch (error) {
    if (mobileRows.length) {
      return res.json({ sourceFile: '小程序移动端 mock API', sheetName: 'mobileAnomalies', total: mobileRows.length, rows: mobileRows });
    }
    return res.status(500).json({ message: '读取考勤异常失败', detail: String(error?.message || error) });
  }
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
  sendMappedRows(res, pickFile('月考勤统计'), undefined, mapWorkDataRows, '未找到可派生勤务数据的月考勤统计表。');
});

app.get('/api/settings-shifts', (_req, res) => {
  sendMappedRows(res, pickFile('班次管理'), undefined, mapShiftSettingRows, '未找到班次管理表。', { limitPeople: false });
});

app.get('/api/settings-face', (_req, res) => {
  sendMappedRows(res, pickFile('人脸管理'), undefined, mapFaceSettingRows, '未找到人脸管理表。');
});

app.get('/api/settings-people', (_req, res) => {
  sendMappedRows(res, pickFile('月考勤统计', '人脸管理'), undefined, mapPeopleSettingRows, '未找到考勤人员数据表。');
});

app.get('/api/stat-items', (_req, res) => {
  const persisted = getStoredRows('statItems');
  if (persisted) {
    return res.json({ sourceFile: '本地持久化数据 data-store.json', sheetName: 'statItems', total: persisted.length, rows: persisted, persisted: true });
  }
  sendMappedRows(res, pickFile('月考勤统计'), undefined, mapStatItemRows, '未找到可生成统计项的月考勤统计表。', { limitPeople: false });
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
  const file = pickFile('月考勤统计', '每日统计表', '原始打卡记录');
  try {
    if (!file) return res.status(404).json({ message: '未找到外部统计文件，请检查资料目录。' });
    const { rows, sheetName } = readSheetRows(file.fullPath);
    const data = mapExternalRows(rows, file.name);
    return res.json({ sourceFile: file.name, sheetName, total: data.length, rows: data });
  } catch (error) {
    return res.status(500).json({ message: '读取外部统计失败', detail: String(error?.message || error) });
  }
});

const MOBILE_OFFICE = {
  id: 'loc_huatuo',
  name: '华托大厦',
  latitude: 31.2304,
  longitude: 121.4737,
  radius: 300,
};

const MOBILE_SHIFT = {
  id: 'shift_0900_1800',
  name: '早九晚六',
  clockInTime: '09:00',
  clockOutTime: '18:00',
};

const DEFAULT_MOBILE_EMPLOYEE = {
  id: 'emp_cp25003',
  userId: 'wecom_demo_001',
  name: '林娜',
  employeeNo: 'CP25003',
  department: '产品研发中心',
  position: '产品研发中心总监',
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
    shiftId: asText(input.shiftId, MOBILE_SHIFT.id),
    shiftName: asText(input.shiftName || input.shift, MOBILE_SHIFT.name),
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
  const configured = readJsonFile(MOBILE_TEST_USERS_FILE, null);
  const users = Array.isArray(configured) && configured.length ? configured : [DEFAULT_MOBILE_EMPLOYEE];
  return users.map(normalizeMobileEmployee);
}

function getDefaultMobileEmployee() {
  const preferredNo = asRawText(process.env.MOBILE_TEST_EMPLOYEE_NO);
  const users = readMobileUsers();
  return users.find((user) => preferredNo && user.employeeNo === preferredNo) || users[0] || DEFAULT_MOBILE_EMPLOYEE;
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
  return employeeFromToken(token) || getDefaultMobileEmployee();
}

function getEmployeeShift(employee) {
  return {
    ...MOBILE_SHIFT,
    id: asText(employee.shiftId, MOBILE_SHIFT.id),
    name: asText(employee.shiftName, MOBILE_SHIFT.name),
  };
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
  return [
    { id: 1, date: '2026-05-10', type: 'clock', desc: '下班缺卡', status: 'pending', handled: false },
    { id: 2, date: '2026-05-05', type: 'clock', desc: '上班迟到8分钟', status: 'pending', handled: false },
    { id: 3, date: '2026-05-04', type: 'clock', desc: '未排班', status: 'pending', handled: false },
    { id: 4, date: '2026-05-03', type: 'clock', desc: '下班缺卡', status: 'pending', handled: false },
    { id: 5, date: '2026-05-02', type: 'clock', desc: '定位异常', status: 'pending', handled: false },
  ];
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
    hasPhoto: Boolean(row.photoFileId || row.faceVerifyId),
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
      hasPhoto: true,
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

app.post('/api/wecom/login', (req, res) => {
  const code = asRawText(req.body?.code);
  if (!code) {
    return res.status(400).json({ message: '缺少企业微信登录code' });
  }
  const employee = getDefaultMobileEmployee();
  return res.json({
    token: tokenForEmployee(employee),
    employee,
  });
});

app.get('/api/mobile/me', (req, res) => {
  const employee = getRequestEmployee(req);
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
  const employee = getRequestEmployee(req);
  const date = currentDateText();
  const records = getMobileRows('mobileClockRecords', []);
  const status = todayRecordSummary(records, employee, date);
  const pendingAnomalies = getMobileRows('mobileAnomalies', mobileAnomalyDefaults())
    .filter((item) => (!item.employeeId || item.employeeId === employee.id) && !item.handled).length;
  res.json({
    date,
    weekday: currentWeekdayText(date),
    employee,
    shift: getEmployeeShift(employee),
    location: getEmployeeOffice(employee),
    status,
    pendingAnomalies,
  });
});

app.post('/api/mobile/face-verify', (_req, res) => {
  const id = `face_${Date.now()}`;
  res.json({
    faceVerifyId: id,
    photoFileId: `photo_${Date.now()}`,
    passed: true,
    message: '人脸核验通过',
  });
});

app.post('/api/mobile/clock', (req, res) => {
  const employee = getRequestEmployee(req);
  const office = getEmployeeOffice(employee);
  const shift = getEmployeeShift(employee);
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
  const locationAccepted = inRange || MOBILE_ALLOW_OUT_OF_RANGE;
  const records = getMobileRows('mobileClockRecords', []);
  const serverTime = nowText();
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
    result: locationAccepted && preciseEnough ? 'normal' : 'abnormal',
    message: locationAccepted && preciseEnough
      ? (inRange ? '打卡成功' : '打卡成功（联调模式已放行定位范围）')
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
  const employee = getRequestEmployee(req);
  const records = getMobileRows('mobileClockRecords', []).filter((record) => record.employeeId === employee.id);
  res.json({ total: records.length, rows: records });
});

app.get('/api/clock-makeup-records', (_req, res) => {
  const rows = mapMobileMakeupRowsToAdmin(getMobileRows('mobileMakeupRequests', []));
  res.json({
    sourceFile: '小程序移动端 mock API',
    sheetName: 'mobileMakeupRequests',
    total: rows.length,
    rows,
  });
});

app.get('/api/photo-clock-records', (_req, res) => {
  const rows = mapMobileClockRowsToPhoto(getMobileRows('mobileClockRecords', []));
  res.json({
    sourceFile: '小程序移动端 mock API',
    sheetName: 'mobileClockRecords',
    total: rows.length,
    rows,
  });
});

app.get('/api/mobile/anomalies', (req, res) => {
  const employee = getRequestEmployee(req);
  const type = asRawText(req.query?.type);
  const rows = getMobileRows('mobileAnomalies', mobileAnomalyDefaults())
    .filter((item) => (!item.employeeId || item.employeeId === employee.id) && (!type || item.type === type));
  res.json({ total: rows.length, rows });
});

app.post('/api/mobile/makeup-request', (req, res) => {
  const employee = getRequestEmployee(req);
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
