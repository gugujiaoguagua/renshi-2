const API_BASE = (import.meta as any).env?.VITE_DATA_API_BASE || 'https://api.shayugua.dpdns.org';

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

function limitDataResponse<T>(response: DataResponse<T>): DataResponse<T> {
  const rows = response.rows || [];
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
  photoUrl?: string;
  photoTakenAt?: string;
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

export type FieldClockRecord = {
  id: number;
  name: string;
  empId: string;
  initiator: string;
  initiatorId: string;
  source: string;
  dept: string;
  date: string;
  time: string;
  initiateTime: string;
  completeTime: string;
  location: string;
  note: string;
  hasPhoto: boolean;
  reviewStatus: string;
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
  photoUrl?: string;
  photoTakenAt?: string;
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

export type OnboardEmployeePayload = {
  name: string;
  employeeNo: string;
  department?: string;
  deptFullPath?: string;
  managerNo?: string;
  managerName?: string;
  position?: string;
  hireDate?: string;
  userId?: string;
  attendanceGroupName?: string;
  shiftId?: string;
  shiftName?: string;
  faceStatus?: string;
};

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
  scope?: string;
  externalEnabled?: boolean;
  defaultValue?: string;
  resultType?: string;
  unit?: string;
  decimal?: number;
  roundMode?: string;
  formulas?: Array<{ name: string; expr: string }>;
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

export type OvertimeRecord = {
  id: number;
  status: string;
  name: string;
  empId: string;
  dept: string;
  deptPath: string;
  date: string;
  start: string;
  end: string;
  applyHours: string;
  finalHours: string;
  type: string;
  compensate: string;
  toLeave: string;
  convert: string;
  rule: string;
  flowStatus: string;
};

export type FieldWorkRecord = {
  id: number;
  status: string;
  name: string;
  empId: string;
  dept: string;
  deptPath: string;
  effect: string;
  source: string;
  values: string[];
  flowStatus: string;
};

export type ScheduleShiftOption = {
  id: string;
  name: string;
  time?: string;
};

export type ScheduleMonthEmployee = {
  name: string;
  employeeNo: string;
  dept: string;
  position: string;
  dayResults: Record<string, string>;
};

export type LeaveRecordRow = Array<string | number | boolean>;

export type ExternalRecord = {
  id: number;
  module: string;
  attendDate: string;
  period: string;
  statItem: string;
  statValue: string | number;
  employeeName?: string;
  employeeNo?: string;
  empId?: string;
  dept?: string;
  creator: string;
  createTime: string;
  modifier: string;
  modifyTime: string;
};

export type EmployeeManagementSummary = {
  employeeTotal: number;
  active: number;
  trial: number;
  outsourced: number;
  fullTime: number;
  pendingOnboard: number;
  onboarded: number;
  resigning: number;
  transferring: number;
  regularized: number;
  contracts: number;
  contractPendingSign: number;
  contractExpiring: number;
  identityUnverified: number;
  sourceFile: string;
};

export type EmployeeRosterRecord = {
  id: number;
  name: string;
  phone: string;
  employeeNo: string;
  dept: string;
  deptFullPath: string;
  position: string;
  hireDate: string;
  employeeType: string;
  employeeStatus: string;
  identityVerify: string;
  managerName?: string;
  managerNo?: string;
  source: string;
};

export type EmployeeContractRecord = {
  id: number;
  name: string;
  employeeNo: string;
  dept: string;
  deptFullPath: string;
  position: string;
  company: string;
  contractNo: string;
  contractType: string;
  contractTerm: string;
  startDate: string;
  endDate: string;
  contractStatus: string;
  signMethod: string;
  signProgress: string;
  employeeAuthStatus: string;
  dataSource: string;
  initiator: string;
  handler: string;
  initiateTime: string;
};

export type EmployeeGenericRecord = Record<string, string | number | boolean | null | undefined>;

export type OrganizationSummary = {
  organizationTotal: number;
  activeOrganizationTotal: number;
  positionTotal: number;
  enabledPositionTotal: number;
  rankTotal: number;
  linkedEmployeeTotal: number;
  sourceFile: string;
};

export type OrganizationRecord = {
  id: number;
  code: string;
  name: string;
  fullPath: string;
  parentCode?: string;
  parentName?: string;
  institutionNo?: string;
  leader?: string;
  approvalManager?: string;
  employeeCount: number;
  linkedEmployeeCount: number;
  directMemberCount: number;
  linkedDirectMemberCount: number;
  orgType: string;
  effectiveDate: string;
  status: string;
  remark?: string;
  depth?: number;
  source?: string;
};

export type OrganizationPositionRecord = {
  id: number;
  code: string;
  name: string;
  parentName?: string;
  orgText: string;
  companyText: string;
  sequence?: string;
  subSequence?: string;
  status: string;
  linkedEmployeeCount: number;
  linkedEmployees?: EmployeeRosterRecord[];
  source?: string;
};

export type OrganizationRankRecord = {
  id: number;
  sequence: string;
  subSequence?: string;
  company?: string;
  code: string;
  name: string;
  grade?: string;
  desc?: string;
  employeeCount: number;
  linkedEmployeeCount: number;
  status: string;
  source?: string;
};

export type OrganizationSettingRecord = {
  id: number;
  setting: string;
  value: string;
  status: string;
  linkedModule: string;
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

export async function saveClockRecords(rows: ClockRecord[]) {
  return requestJson<DataResponse<ClockRecord> & { ok: boolean }>('/api/clock-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchMakeupClockRecords() {
  return limitDataResponse(await requestJson<DataResponse<MakeupClockRecord>>('/api/clock-makeup-records'));
}

export async function saveMakeupClockRecords(rows: MakeupClockRecord[]) {
  return requestJson<DataResponse<MakeupClockRecord> & { ok: boolean }>('/api/clock-makeup-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchFieldClockRecords() {
  return limitDataResponse(await requestJson<DataResponse<FieldClockRecord>>('/api/clock-field-records'));
}

export async function saveFieldClockRecords(rows: FieldClockRecord[]) {
  return requestJson<DataResponse<FieldClockRecord> & { ok: boolean }>('/api/clock-field-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
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

export async function fetchOvertimeRecords() {
  return limitDataResponse(await requestJson<DataResponse<OvertimeRecord>>('/api/overtime-records'));
}

export async function fetchFieldOutRecords() {
  return limitDataResponse(await requestJson<DataResponse<FieldWorkRecord>>('/api/field-out-records'));
}

export async function saveFieldOutRecords(rows: FieldWorkRecord[]) {
  return requestJson<DataResponse<FieldWorkRecord>>('/api/field-out-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchFieldTripRecords() {
  return limitDataResponse(await requestJson<DataResponse<FieldWorkRecord>>('/api/field-trip-records'));
}

export async function saveFieldTripRecords(rows: FieldWorkRecord[]) {
  return requestJson<DataResponse<FieldWorkRecord>>('/api/field-trip-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchScheduleMonth(month: string) {
  return requestJson<DataResponse<ScheduleMonthEmployee> & { shifts: ScheduleShiftOption[]; month: string }>(`/api/schedules/month?month=${encodeURIComponent(month)}`);
}

export async function saveScheduleAssignments(rows: Array<{ date: string; employeeNo: string; employeeName: string; dept: string; shiftId?: string; shiftName: string }>) {
  return requestJson<DataResponse<ScheduleMonthEmployee> & { ok: boolean }>('/api/schedules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchLeaveRecords() {
  return limitDataResponse(await requestJson<DataResponse<LeaveRecordRow>>('/api/leave-records'));
}

export async function saveLeaveRecords(rows: LeaveRecordRow[]) {
  return requestJson<DataResponse<LeaveRecordRow>>('/api/leave-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchLeaveBalances() {
  return limitDataResponse(await requestJson<DataResponse<LeaveRecordRow>>('/api/leave-balances'));
}

export async function fetchLeaveDetails() {
  return limitDataResponse(await requestJson<DataResponse<LeaveRecordRow>>('/api/leave-details'));
}

export async function saveLeaveDetails(rows: LeaveRecordRow[]) {
  return requestJson<DataResponse<LeaveRecordRow>>('/api/leave-details', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchLeaveTypes() {
  return requestJson<DataResponse<Record<string, unknown>>>('/api/leave-types');
}

export async function saveLeaveTypes(rows: Array<Record<string, unknown>>) {
  return requestJson<DataResponse<Record<string, unknown>>>('/api/leave-types', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchLeaveSchemes() {
  return requestJson<DataResponse<LeaveRecordRow>>('/api/leave-schemes');
}

export async function saveLeaveSchemes(rows: LeaveRecordRow[]) {
  return requestJson<DataResponse<LeaveRecordRow>>('/api/leave-schemes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsShifts() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-shifts');
}

export async function fetchSettingsGroups() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-groups');
}

export async function saveSettingsGroups(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-groups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsCardRules() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-card-rules');
}

export async function saveSettingsCardRules(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-card-rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsMobileClock() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-mobile-clock');
}

export async function saveSettingsMobileClock(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-mobile-clock', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsLocation() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-location');
}

export async function saveSettingsLocation(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-location', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsHoliday() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-holiday');
}

export async function saveSettingsHoliday(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-holiday', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsCalendar() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-calendar');
}

export async function saveSettingsCalendar(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-calendar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsOvertimeRules() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-overtime-rules');
}

export async function saveSettingsOvertimeRules(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-overtime-rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsFieldRules() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-field-rules');
}

export async function saveSettingsFieldRules(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-field-rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsStatSchemes() {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-stat-schemes');
}

export async function saveSettingsStatSchemes(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-stat-schemes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function saveSettingsShifts(rows: SettingTableRow[]) {
  return requestJson<DataResponse<SettingTableRow>>('/api/settings-shifts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchSettingsFace() {
  return limitDataResponse(await requestJson<DataResponse<SettingTableRow>>('/api/settings-face'));
}

export async function fetchSettingsPeople() {
  return limitDataResponse(await requestJson<DataResponse<SettingTableRow>>('/api/settings-people'));
}

export async function onboardEmployee(payload: OnboardEmployeePayload) {
  return requestJson<{
    ok: boolean;
    created: boolean;
    employee: Record<string, unknown>;
    peopleRow: SettingTableRow;
    faceRow: SettingTableRow;
    attendanceRow: AttendanceEmployee;
  }>('/api/employees/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteOnboardedEmployees(employeeNos: string[]) {
  return requestJson<{ ok: boolean; removed: number; remaining: number; employeeNos?: string[] }>('/api/employees', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeNos }),
  });
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

export async function saveExternalRecords(rows: ExternalRecord[]) {
  return requestJson<DataResponse<ExternalRecord> & { ok: boolean }>('/api/external-records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function fetchDataSources() {
  return requestJson<{ dataDir: string; files: Array<{ name: string; mtime: string; size: number }> }>('/api/data-sources');
}

export async function fetchEmployeeManagementSummary() {
  return requestJson<EmployeeManagementSummary & { ok: boolean }>('/api/employee-management/summary');
}

export async function fetchEmployeeRoster() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeRosterRecord>>('/api/employee-management/roster'));
}

export async function fetchEmployeeArchive() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeRosterRecord>>('/api/employee-management/archive'));
}

export async function fetchEmployeeEducation() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/education'));
}

export async function fetchEmployeeArchiveApprovals() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/archive-approvals'));
}

export async function fetchEmployeeCare() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/care'));
}

export async function fetchEmployeeReports() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/reports'));
}

export async function fetchEmployeeEmployment(type: string) {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>(`/api/employee-management/employment/${encodeURIComponent(type)}`));
}

export async function fetchEmployeeContracts(type: string) {
  return limitDataResponse(await requestJson<DataResponse<EmployeeContractRecord>>(`/api/employee-management/contracts/${encodeURIComponent(type)}`));
}

export async function fetchEmployeeSettings() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/settings'));
}

export async function fetchEmployeeServices() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/services'));
}

export async function fetchEmployeeThirdParty() {
  return limitDataResponse(await requestJson<DataResponse<EmployeeGenericRecord>>('/api/employee-management/third-party'));
}

export async function fetchOrganizationSummary() {
  return requestJson<OrganizationSummary & { ok: boolean }>('/api/organization-management/summary');
}

export async function fetchOrganizations() {
  return limitDataResponse(await requestJson<DataResponse<OrganizationRecord>>('/api/organization-management/organizations'));
}

export async function saveOrganization(row: Partial<OrganizationRecord>) {
  return requestJson<{ ok: boolean; created: boolean; row: OrganizationRecord }>('/api/organization-management/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
}

export async function deleteOrganization(code: string) {
  return requestJson<{ ok: boolean; removed: number; remaining: number }>(`/api/organization-management/organizations/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

export async function fetchOrganizationPositions() {
  return limitDataResponse(await requestJson<DataResponse<OrganizationPositionRecord>>('/api/organization-management/positions'));
}

export async function saveOrganizationPosition(row: Partial<OrganizationPositionRecord>) {
  return requestJson<{ ok: boolean; created: boolean; row: OrganizationPositionRecord }>('/api/organization-management/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
}

export async function fetchOrganizationRanks() {
  return limitDataResponse(await requestJson<DataResponse<OrganizationRankRecord>>('/api/organization-management/ranks'));
}

export async function saveOrganizationRank(row: Partial<OrganizationRankRecord>) {
  return requestJson<{ ok: boolean; created: boolean; row: OrganizationRankRecord }>('/api/organization-management/ranks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
}

export async function fetchOrganizationSettings() {
  return limitDataResponse(await requestJson<DataResponse<OrganizationSettingRecord>>('/api/organization-management/settings'));
}

export async function saveOrganizationSettings(rows: OrganizationSettingRecord[]) {
  return requestJson<DataResponse<OrganizationSettingRecord> & { ok: boolean }>('/api/organization-management/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}
