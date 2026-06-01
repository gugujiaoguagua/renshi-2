import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const CORE_DIR = path.dirname(__filename);

export const SERVER_DIR = path.resolve(CORE_DIR, '..');
export const APP_DIR = path.resolve(SERVER_DIR, '..');
export const WORKSPACE_DIR = path.resolve(APP_DIR, '..');

export const PORT = Number(process.env.DATA_SERVER_PORT || 3101);
export const HOST = process.env.DATA_SERVER_HOST || '0.0.0.0';
export const MOBILE_ALLOW_OUT_OF_RANGE = process.env.MOBILE_ALLOW_OUT_OF_RANGE === 'true';
export const WECOM_AUTH_MODE = process.env.WECOM_AUTH_MODE || 'test';
export const WECOM_CORP_ID = process.env.WECOM_CORP_ID || '';
export const WECOM_APP_SECRET = process.env.WECOM_APP_SECRET || process.env.WECOM_SECRET || '';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(WORKSPACE_DIR, '资料'));
export const EMPLOYEE_REFERENCE_DIR = path.resolve(
  process.env.EMPLOYEE_REFERENCE_DIR || path.join(WORKSPACE_DIR, '参考图片', '功能', '员工管理'),
);
export const ORGANIZATION_REFERENCE_DIR = path.resolve(
  process.env.ORGANIZATION_REFERENCE_DIR || path.join(WORKSPACE_DIR, '参考图片', '功能', '组织管理'),
);
export const ATTENDANCE_SUPPLEMENT_DIR = path.resolve(
  process.env.ATTENDANCE_SUPPLEMENT_DIR || path.join(WORKSPACE_DIR, '参考图片', '功能', '假期管理补充', '假期管理导出文件'),
);

export const STORE_FILE = path.join(SERVER_DIR, 'data-store.json');
export const MOBILE_TEST_USERS_FILE = path.join(SERVER_DIR, 'mobile-test-users.json');
export const UPLOAD_DIR = path.join(SERVER_DIR, 'uploads');
export const EXPORT_DIR = path.join(SERVER_DIR, 'exports');
export const TIME_ZONE = 'Asia/Shanghai';

export const BACKEND_DOMAIN_FLOW = [
  {
    key: 'organization',
    name: '组织',
    order: 1,
    dependsOn: [],
    storeKeys: ['organizationStructures', 'organizationPositions', 'organizationRanks', 'organizationSettings'],
    apiPrefixes: ['/api/organization-management'],
  },
  {
    key: 'employee',
    name: '员工',
    order: 2,
    dependsOn: ['organization'],
    storeKeys: ['onboardedEmployees'],
    apiPrefixes: ['/api/hr-core/employees', '/api/employee-management', '/api/employees'],
  },
  {
    key: 'attendance',
    name: '考勤',
    order: 3,
    dependsOn: ['organization', 'employee'],
    storeKeys: [
      'settingsGroups',
      'settingsShifts',
      'employeeSchedules',
      'dailyAttendance',
      'monthlySummary',
      'mobileClockRecords',
      'leaveRecords',
      'fieldOutRecords',
      'fieldTripRecords',
      'externalRecords',
    ],
    apiPrefixes: ['/api/attendance', '/api/daily-attendance', '/api/monthly', '/api/clock', '/api/mobile'],
  },
  {
    key: 'payroll',
    name: '薪酬',
    order: 4,
    dependsOn: ['organization', 'employee', 'attendance'],
    storeKeys: ['statItems', 'externalRecords', 'salaryCalculationState'],
    apiPrefixes: ['/api/payroll-management', '/api/salary-calculation', '/api/stat-items', '/api/external-records'],
  },
];

export function getBackendDomain(key) {
  return BACKEND_DOMAIN_FLOW.find((domain) => domain.key === key) || null;
}

let storeCache = null;
let storeCacheMtimeMs = 0;
const writeListeners = new Set();

export function onStoreWrite(listener) {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

export function readStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    const stat = fs.statSync(STORE_FILE);
    if (storeCache && storeCacheMtimeMs === stat.mtimeMs) return storeCache;
    storeCache = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    storeCacheMtimeMs = stat.mtimeMs;
    return storeCache;
  } catch (_error) {
    return {};
  }
}

export function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  const stat = fs.statSync(STORE_FILE);
  storeCache = store;
  storeCacheMtimeMs = stat.mtimeMs;
  for (const listener of writeListeners) {
    listener(store);
  }
}

export function getStoredRows(key) {
  const rows = readStore()[key];
  return Array.isArray(rows) ? rows : null;
}

export function setStoredRows(key, rows) {
  const store = readStore();
  store[key] = rows;
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function upsertStoredRow(key, row, idGetter) {
  const rows = getStoredRows(key) || [];
  const nextId = idGetter(row);
  const existingIndex = rows.findIndex((item) => idGetter(item) === nextId);
  const nextRows = existingIndex >= 0
    ? rows.map((item, index) => (index === existingIndex ? { ...item, ...row } : item))
    : [row, ...rows];
  setStoredRows(key, nextRows);
  return { row, rows: nextRows, created: existingIndex < 0 };
}
