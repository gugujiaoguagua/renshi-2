const API_BASE = (import.meta as any).env?.VITE_DATA_API_BASE || 'http://localhost:3199';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败: ${response.status}`);
  }
  return response.json();
}

export type DataResponse<T> = {
  sourceFile: string;
  sheetName?: string;
  total: number;
  rows: T[];
};

const DEMO_PERSON_LIMIT = 5;

function getPersonKey(row: unknown): string {
  if (Array.isArray(row)) {
    return String(row[1] || row[0] || '').trim();
  }

  if (!row || typeof row !== 'object') return '';

  const record = row as Record<string, unknown>;
  return String(
    record.empId
      || record.employeeNo
      || record.employeeId
      || record.applicantId
      || record.initiatorId
      || record.name
      || record.applicant
      || record.employeeName
      || '',
  ).trim();
}

function limitDemoPeople<T>(rows: T[], limit = DEMO_PERSON_LIMIT): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getPersonKey(row) || `row-${seen.size}`;
    if (seen.has(key)) return true;
    if (seen.size >= limit) return false;
    seen.add(key);
    return true;
  });
}

function limitDataResponse<T>(response: DataResponse<T>): DataResponse<T> {
  const rows = limitDemoPeople(response.rows || []);
  return { ...response, total: rows.length, rows };
}

export type AttendanceEmployee = {
  name: string;
  empId: string;
  attendGroup: string;
  dept: string;
  deptFull?: string;
  shift: string;
  type: string;
  attendance: string;
  status: string;
  anomaly: string;
  leave: string;
  fieldTrip: string;
  cin1: string;
  cout1: string;
  cin2: string;
  cout2: string;
  cin3: string;
  cout3: string;
};

export type DailyAttendanceEmployee = {
  name: string;
  confirmStatus: '已确认' | '未确认';
  empId: string;
  date: string;
  dept: string;
  position: string;
  bizGroup: string;
  deptFullPath: string;
  regularDate: string;
  attendGroup: string;
  shiftName: string;
  dateType: string;
  weekday: string;
  attendResult: '正常' | '异常' | '休息';
  anomalyDesc: string;
  taskSummary: string;
  normalHours: number;
  lateMinutes: number;
};

export type MonthlyAttendanceEmployee = {
  name: string;
  empId: string;
  dept: string;
  position: string;
  attendGroup: string;
  deptFullPath: string;
  bizGroup: string;
  dayResults?: Record<string, string>;
};

export type MonthlySummaryEmployee = {
  id: number;
  name: string;
  lockStatus: '已锁定' | '未锁定';
  empId: string;
  dept: string;
  position: string;
  hireDate: string;
  resignDate: string;
  deptFullPath: string;
  bizGroup: string;
  attendGroup: string;
  shouldWorkDays: number;
  actualWorkDays: number;
  absentDays: number;
  tripDays: number;
  scheduleDays: number;
  normalHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  confirmStatus: '未发送' | '已发送' | '已确认';
};

export type ClockRecord = {
  id: number;
  name: string;
  empId: string;
  dept: string;
  date: string;
  time: string;
  source: string;
  device: string;
  location: string;
  workLocation: string;
  freeWork: string;
  note: string;
  hasPhoto: boolean;
  creator: string;
  createTime: string;
  modifier: string;
  modifyTime: string;
};

export type MakeupClockRecord = {
  id: number;
  status: string;
  applicant: string;
  applicantId: string;
  applicantDept: string;
  makeupDate: string;
  makeupTime: string;
  reason: string;
  initiator: string;
  initiatorId: string;
  initiateTime: string;
  completeTime: string;
  hasPhoto: boolean;
  archiveStatus: string;
};

export type PhotoClockRecord = {
  id: number;
  name: string;
  empId: string;
  dept: string;
  date: string;
  clockTime: string;
  locateTime: string;
  completeTime: string;
  location: string;
  note: string;
  hasPhoto: boolean;
  reviewStatus: string;
};

export type AttendanceAnomalyRecord = {
  id: number;
  name: string;
  empId: string;
  dept: string;
  date: string;
  weekday: string;
  shift: string;
  type: string;
  desc: string;
  clock: string;
  reminder: '已提醒' | '未提醒';
  handled: boolean;
  writeOff: '已核销' | '未核销';
};

export type SettingTableRow = string[];

export type StatItemRecord = {
  id: number;
  name: string;
  module: string;
  category: string;
  desc: string;
  enabled: boolean;
  hasFormula: boolean;
  dataType: string;
  isCustom: boolean;
};

export type WorkDataRecord = {
  id: number;
  applicant: string;
  applicantId: string;
  applicantDept: string;
  applyType: string;
  initiator: string;
  initiatorId: string;
  initiateTime: string;
  completeTime: string;
  bizDate: string;
  summary: string;
  approvalStatus: '已通过' | '审批中' | '已拒绝' | '已撤销' | '已退回';
  cancelStatus: '未申请取消' | '取消审批中' | '已取消';
};

export type ExternalRecord = {
  id: number;
  module: string;
  attendDate: string;
  period: string;
  statItem: string;
  statValue: string | number;
  creator: string;
  createTime: string;
  modifier: string;
  modifyTime: string;
};

export async function fetchAttendanceEmployees() {
  return limitDataResponse(await requestJson<DataResponse<AttendanceEmployee>>('/api/attendance-stats'));
}

export async function fetchDailyAttendanceEmployees() {
  return limitDataResponse(await requestJson<DataResponse<DailyAttendanceEmployee>>('/api/daily-attendance'));
}

export async function saveDailyAttendanceEmployees(rows: DailyAttendanceEmployee[]) {
  return requestJson<DataResponse<DailyAttendanceEmployee> & { ok: boolean }>('/api/daily-attendance', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchMonthlyAttendanceEmployees() {
  return limitDataResponse(await requestJson<DataResponse<MonthlyAttendanceEmployee>>('/api/monthly-attendance'));
}

export async function fetchMonthlySummaryEmployees() {
  return limitDataResponse(await requestJson<DataResponse<MonthlySummaryEmployee>>('/api/monthly-summary'));
}

export async function saveMonthlySummaryEmployees(rows: MonthlySummaryEmployee[]) {
  return requestJson<DataResponse<MonthlySummaryEmployee> & { ok: boolean }>('/api/monthly-summary', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}


export async function fetchClockRecords() {
  return limitDataResponse(await requestJson<DataResponse<ClockRecord>>('/api/clock-records'));
}

export async function fetchMakeupClockRecords() {
  return limitDataResponse(await requestJson<DataResponse<MakeupClockRecord>>('/api/clock-makeup-records'));
}

export async function fetchPhotoClockRecords() {
  return limitDataResponse(await requestJson<DataResponse<PhotoClockRecord>>('/api/photo-clock-records'));
}

export async function fetchAttendanceAnomalies() {
  return limitDataResponse(await requestJson<DataResponse<AttendanceAnomalyRecord>>('/api/attendance-anomalies'));
}

export async function saveAttendanceAnomalies(rows: AttendanceAnomalyRecord[]) {
  return requestJson<DataResponse<AttendanceAnomalyRecord> & { ok: boolean }>('/api/attendance-anomalies', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}


export async function fetchWorkDataRecords() {
  return limitDataResponse(await requestJson<DataResponse<WorkDataRecord>>('/api/work-data'));
}

export async function fetchSettingsShifts() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-shifts');
}

export async function fetchSettingsFace() {
  return limitDataResponse(await requestJson<DataResponse<SettingTableRow>>('/api/settings-face'));
}

export async function fetchSettingsPeople() {
  return limitDataResponse(await requestJson<DataResponse<SettingTableRow>>('/api/settings-people'));
}

export async function fetchStatItems() {
  return requestJson<DataResponse<StatItemRecord>>('/api/stat-items');
}

export async function saveStatItems(rows: StatItemRecord[]) {
  return requestJson<DataResponse<StatItemRecord> & { ok: boolean }>('/api/stat-items', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}


export async function fetchExternalRecords() {
  return requestJson<DataResponse<ExternalRecord>>('/api/external-records');
}

export async function fetchDataSources() {
  return requestJson<{ dataDir: string; files: Array<{ name: string; mtime: string; size: number }> }>('/api/data-sources');
}
