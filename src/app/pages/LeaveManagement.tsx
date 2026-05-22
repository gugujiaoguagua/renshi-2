import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { fetchLeaveBalances, fetchLeaveDetails, fetchLeaveRecords, fetchLeaveSchemes, fetchLeaveTypes, fetchSettingsPeople, saveLeaveDetails, saveLeaveRecords, saveLeaveSchemes, saveLeaveTypes } from '../api/realData';
import { monthRange } from '../utils/date';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  Search,
  Settings2,
  Users,
} from 'lucide-react';

type LeaveView = 'record' | 'balance' | 'detail' | 'type' | 'scheme';
type MenuItem = { label: string; hint?: string };
type TabConfig = { key: LeaveView; label: string; path: string };
type SortConfig = { index: number; direction: 'asc' | 'desc' };
type PlainRow = Array<string | number | boolean>;
type EmployeeOption = { name: string; employeeNo: string; department: string; deptFullPath: string };
type LeaveRecordDraft = {
  recordStatus: string;
  applicantKey: string;
  initiatorKey: string;
  startType: string;
  leaveType: string;
  startTime: string;
  endTime: string;
  duration: string;
  reason: string;
  flowStatus: string;
};
type LeaveDetailDraft = {
  employeeKey: string;
  hireDate: string;
  cycle: string;
  leaveType: string;
  totalQuota: string;
  issuedQuota: string;
  activeQuota: string;
  adjustQuota: string;
  frozenQuota: string;
  usedQuota: string;
  remainQuota: string;
  cycleStart: string;
  cycleEnd: string;
  validStart: string;
};
type LeaveTypeDraft = {
  name: string;
  short: string;
  enabled: boolean;
  unit: string;
  paid: string;
  negative: string;
  before: string;
  note: string;
  reason: string;
  attachment: string;
  attachmentNote: string;
};
type LeaveSchemeDraft = {
  name: string;
  leaveType: string;
  leaveControl: string;
  quotaControl: string;
  scope: string;
  priority: string;
};

const ROUTE_TABS: TabConfig[] = [
  { key: 'record', label: '请假记录', path: '/attendance/leave' },
  { key: 'balance', label: '假期余额', path: '/attendance/leave-balance' },
  { key: 'detail', label: '假期额度明细', path: '/attendance/leave-detail' },
  { key: 'type', label: '假期类型设置', path: '/attendance/leave-type' },
  { key: 'scheme', label: '假期方案设置', path: '/attendance/leave-scheme' },
];

const LEAVE_RECORD_COLUMNS = ['记录状态', '申请人', '申请人员工号', '申请人部门', '部门全路径', '发起人', '发起人员工号', '发起类型', '假期类型', '开始时间', '结束时间', '请假时长', '请假事由', '发起时间', '完成时间', '当前流程状态', '操作'];
const LEAVE_BALANCE_COLUMNS = ['姓名', '员工号', '部门', '部门全路径', '入职日期', '剩余年假（天）', '剩余病假（天）', '剩余婚假（天）', '剩余陪产假（天）', '剩余产假（天）', '剩余丧假（天）', '剩余事假（天）'];
const LEAVE_DETAIL_COLUMNS = ['姓名', '员工号', '部门', '部门全路径', '入职日期', '周期', '假期类型', '应休额度', '已发额度', '已激活额度', '调整额度', '冻结额度', '已用额度', '剩余额度', '周期开始日期', '周期截止日期', '有效期开启日期', '操作'];
const LEAVE_TYPE_COLUMNS = ['排序', '假期类型名称', '假期类型简称', '假期启用', '请假单位', '是否带薪', '余额可为负', '休假前额说明', '显示假期说明', '每假事由必填', '附件必传', '附件说明', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const LEAVE_SCHEME_COLUMNS = ['方案名称', '假期类型', '请假控制规则', '额度控制', '适用范围', '假期优先级', '创建人', '创建时间', '修改人', '修改时间', '操作'];

const START_LEAVE_ITEMS: MenuItem[] = [
  { label: '发起单条' },
  { label: '发起多条' },
  { label: '批量请假', hint: '适用于多人连续请假' },
];

const BALANCE_GRANT_ITEMS: MenuItem[] = [
  { label: '按规则发放' },
  { label: '手动补发' },
  { label: '批量导入发放' },
];

const DETAIL_MORE_ITEMS: MenuItem[] = [
  { label: '批量启用额度' },
  { label: '批量冻结额度' },
  { label: '导出本页数据' },
];

const LEAVE_RECORD_ROWS: Array<Array<React.ReactNode>> = [];

const LEAVE_BALANCE_ROWS: Array<Array<React.ReactNode>> = [];

function plainRows(rows: Array<Array<React.ReactNode>>): PlainRow[] {
  return rows.map(row => row.map(cell => typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' ? cell : String(cell ?? '')));
}

function currentDateText() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentDateTimeText() {
  const date = new Date();
  return `${currentDateText()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toInputDateTime(value: unknown) {
  const text = String(value ?? '');
  if (!text) return `${currentDateText()}T09:00`;
  return text.replace(' ', 'T').slice(0, 16);
}

function displayDateTime(value: string) {
  return value ? value.replace('T', ' ') : '';
}

function employeeKey(employee: EmployeeOption) {
  return `${employee.employeeNo}|${employee.name}`;
}

function employeeFromKey(employees: EmployeeOption[], key: string) {
  return employees.find(employee => employeeKey(employee) === key) || employees[0] || {
    name: '新增员工',
    employeeNo: 'LV0001',
    department: '产品运营部',
    deptFullPath: '产品研发中心/产品运营部',
  };
}

function employeeMatches(employee: EmployeeOption, keyword: string) {
  const query = keyword.trim().toLowerCase();
  if (!query) return true;
  const searchable = `${employee.name} ${employee.employeeNo} ${employee.name} / ${employee.employeeNo} ${employee.department} ${employee.deptFullPath}`.toLowerCase();
  return searchable.includes(query);
}

function peopleRowsToOptions(rows: Array<Array<unknown>>): EmployeeOption[] {
  return rows
    .map(row => ({
      name: String(row[0] ?? '').trim(),
      employeeNo: String(row[1] ?? '').trim(),
      department: String(row[2] ?? '').trim() || '-',
      deptFullPath: String(row[2] ?? '').trim() || '-',
    }))
    .filter(employee => employee.name && employee.employeeNo);
}

function leaveTypeNames(rows: Array<Record<string, unknown>>) {
  const names = rows
    .filter(row => row.enabled !== false)
    .map(row => String(row.name ?? '').trim())
    .filter(Boolean);
  return names.length ? names : TYPE_ROWS.filter(row => row.enabled).map(row => row.name);
}

function calculateLeaveDuration(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return '1天';
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const days = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
  return `${days}天`;
}

function defaultLeaveRecordDraft(employees: EmployeeOption[], leaveTypes: string[], startType = '管理员发起'): LeaveRecordDraft {
  const employee = employees[0];
  const today = currentDateText();
  return {
    recordStatus: startType === '员工发起' ? '审批中' : '已通过',
    applicantKey: employee ? employeeKey(employee) : '',
    initiatorKey: employee ? employeeKey(employee) : '',
    startType,
    leaveType: leaveTypes[0] || '年假',
    startTime: `${today}T09:00`,
    endTime: `${today}T18:00`,
    duration: '1天',
    reason: startType === '员工发起' ? '前端发起请假流程' : '后台添加请假记录',
    flowStatus: startType === '员工发起' ? '审批中' : '已通过',
  };
}

function leaveDraftFromRow(row: Array<React.ReactNode>, employees: EmployeeOption[], leaveTypes: string[]): LeaveRecordDraft {
  const applicantNo = String(row[2] ?? '');
  const initiatorNo = String(row[6] ?? applicantNo);
  const applicant = employees.find(employee => employee.employeeNo === applicantNo);
  const initiator = employees.find(employee => employee.employeeNo === initiatorNo) || applicant;
  return {
    recordStatus: String(row[0] ?? '审批中'),
    applicantKey: applicant ? employeeKey(applicant) : '',
    initiatorKey: initiator ? employeeKey(initiator) : '',
    startType: String(row[7] ?? '管理员发起') || '管理员发起',
    leaveType: String(row[8] ?? leaveTypes[0] ?? '年假') || leaveTypes[0] || '年假',
    startTime: toInputDateTime(row[9]),
    endTime: toInputDateTime(row[10]),
    duration: String(row[11] ?? '1天') || '1天',
    reason: String(row[12] ?? ''),
    flowStatus: String(row[15] ?? '审批中') || '审批中',
  };
}

function leaveRowFromDraft(draft: LeaveRecordDraft, employees: EmployeeOption[], previousRow?: Array<React.ReactNode>) {
  const applicant = employeeFromKey(employees, draft.applicantKey);
  const initiator = employeeFromKey(employees, draft.initiatorKey || draft.applicantKey);
  const now = currentDateTimeText();
  const flowStatus = draft.flowStatus || draft.recordStatus || '审批中';
  return [
    draft.recordStatus || flowStatus,
    applicant.name,
    applicant.employeeNo,
    applicant.department,
    applicant.deptFullPath,
    initiator.name,
    initiator.employeeNo,
    draft.startType || '管理员发起',
    draft.leaveType || '年假',
    displayDateTime(draft.startTime),
    displayDateTime(draft.endTime),
    draft.duration || calculateLeaveDuration(draft.startTime, draft.endTime),
    draft.reason || '-',
    String(previousRow?.[13] ?? now),
    flowStatus === '审批中' ? '' : now,
    flowStatus,
    '查看',
  ];
}

function defaultLeaveDetailDraft(employees: EmployeeOption[], leaveTypes: string[], source = '新增额度记录'): LeaveDetailDraft {
  const employee = employees[0];
  const today = currentDateText();
  return {
    employeeKey: employee ? employeeKey(employee) : '',
    hireDate: today,
    cycle: String(new Date().getFullYear()),
    leaveType: leaveTypes[0] || '年假',
    totalQuota: '1',
    issuedQuota: '1',
    activeQuota: '1',
    adjustQuota: '0',
    frozenQuota: source.includes('冻结') ? '1' : '0',
    usedQuota: '0',
    remainQuota: source.includes('冻结') ? '0' : '1',
    cycleStart: today,
    cycleEnd: `${new Date().getFullYear()}-12-31`,
    validStart: today,
  };
}

function leaveDetailDraftFromRow(row: Array<React.ReactNode>, employees: EmployeeOption[], leaveTypes: string[]): LeaveDetailDraft {
  const employeeNo = String(row[1] ?? '');
  const employee = employees.find(item => item.employeeNo === employeeNo);
  const fallback = defaultLeaveDetailDraft(employees, leaveTypes);
  return {
    employeeKey: employee ? employeeKey(employee) : fallback.employeeKey,
    hireDate: String(row[4] ?? fallback.hireDate),
    cycle: String(row[5] ?? fallback.cycle),
    leaveType: String(row[6] ?? fallback.leaveType),
    totalQuota: String(row[7] ?? fallback.totalQuota),
    issuedQuota: String(row[8] ?? fallback.issuedQuota),
    activeQuota: String(row[9] ?? fallback.activeQuota),
    adjustQuota: String(row[10] ?? fallback.adjustQuota),
    frozenQuota: String(row[11] ?? fallback.frozenQuota),
    usedQuota: String(row[12] ?? fallback.usedQuota),
    remainQuota: String(row[13] ?? fallback.remainQuota),
    cycleStart: String(row[14] ?? fallback.cycleStart),
    cycleEnd: String(row[15] ?? fallback.cycleEnd),
    validStart: String(row[16] ?? fallback.validStart),
  };
}

function leaveDetailRowFromDraft(draft: LeaveDetailDraft, employees: EmployeeOption[]) {
  const employee = employeeFromKey(employees, draft.employeeKey);
  return [
    employee.name,
    employee.employeeNo,
    employee.department,
    employee.deptFullPath,
    draft.hireDate,
    draft.cycle,
    draft.leaveType,
    draft.totalQuota || '0',
    draft.issuedQuota || '0',
    draft.activeQuota || '0',
    draft.adjustQuota || '0',
    draft.frozenQuota || '0',
    draft.usedQuota || '0',
    draft.remainQuota || '0',
    draft.cycleStart,
    draft.cycleEnd,
    draft.validStart,
    '查看',
  ];
}

function defaultLeaveTypeDraft(): LeaveTypeDraft {
  return {
    name: '',
    short: '',
    enabled: true,
    unit: '按天请假',
    paid: '否',
    negative: '否',
    before: '否',
    note: '',
    reason: '否',
    attachment: '否',
    attachmentNote: '-',
  };
}

function leaveTypeDraftFromRow(row: LeaveTypeRow): LeaveTypeDraft {
  return {
    name: row.name,
    short: row.short,
    enabled: row.enabled,
    unit: row.unit,
    paid: row.paid,
    negative: row.negative,
    before: row.before,
    note: row.note,
    reason: row.reason,
    attachment: row.attachment,
    attachmentNote: row.attachmentNote,
  };
}

function leaveTypeRowFromDraft(draft: LeaveTypeDraft, previous?: LeaveTypeRow): LeaveTypeRow {
  const now = currentDateTimeText();
  const name = draft.name.trim();
  return {
    name,
    short: draft.short.trim() || name.slice(0, 1),
    enabled: draft.enabled,
    unit: draft.unit || '按天请假',
    paid: draft.paid || '否',
    negative: draft.negative || '否',
    before: draft.before || '否',
    note: draft.note.trim() || '-',
    reason: draft.reason || '否',
    attachment: draft.attachment || '否',
    attachmentNote: draft.attachmentNote.trim() || '-',
    creator: previous?.creator || '后台维护',
    createdAt: previous?.createdAt || now,
    editor: '后台维护',
    editedAt: now,
  };
}

function defaultLeaveSchemeDraft(leaveTypes: string[], nextPriority = 1): LeaveSchemeDraft {
  return {
    name: '',
    leaveType: leaveTypes[0] || '年假',
    leaveControl: '按规则控制',
    quotaControl: '启用额度控制',
    scope: '全部员工',
    priority: String(nextPriority),
  };
}

function leaveSchemeDraftFromRow(row: Array<React.ReactNode>): LeaveSchemeDraft {
  return {
    name: String(row[0] ?? ''),
    leaveType: String(row[1] ?? '年假'),
    leaveControl: String(row[2] ?? '按规则控制'),
    quotaControl: String(row[3] ?? '启用额度控制'),
    scope: String(row[4] ?? '全部员工'),
    priority: String(row[5] ?? '1'),
  };
}

function leaveSchemeRowFromDraft(draft: LeaveSchemeDraft, previous?: Array<React.ReactNode>) {
  const now = currentDateTimeText();
  return [
    draft.name.trim(),
    draft.leaveType,
    draft.leaveControl || '按规则控制',
    draft.quotaControl || '启用额度控制',
    draft.scope.trim() || '全部员工',
    draft.priority || '1',
    String(previous?.[6] ?? '后台维护'),
    String(previous?.[7] ?? now),
    '后台维护',
    now,
    '查看',
  ];
}

const TYPE_ROWS = [
  { name: '年假', short: '年', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '否', note: '年假额度可根据员工司龄自动发放，支持跨周期结转。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:17' },
  { name: '病假', short: '病', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '病假需员工上传病历或就诊凭证，系统支持按天或小时折算。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:08' },
  { name: '短期病假', short: '病', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '是', note: '用于短时病假审批，计算时自动计入累计病假时长。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:28' },
  { name: '婚假', short: '婚', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '否', note: '婚假按法定或公司规定执行，支持一次性发放。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:22' },
  { name: '产假', short: '产', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '是', note: '产假支持前置请假及分段休假，系统可自动关联哺乳假规则。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:27' },
  { name: '陪产假', short: '陪', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '男员工生育相关陪护假，审批时需同步提交证明材料。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:32' },
  { name: '调休假', short: '调', enabled: true, unit: '按小时请假', paid: '否', negative: '否', before: '否', note: '加班转调休产生的额度，优先消耗近期生成的调休额度。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:54' },
  { name: '补偿假', short: '补', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '特殊奖励或项目补贴类假期，默认关闭，由管理员按需启用。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:43' },
  { name: '流产假', short: '流', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '女性员工特殊医疗假期，需上传证明后方可申请。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:49' },
  { name: '亲友假', short: '亲', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '适用于家属重大事项处理的延伸假期，按公司制度执行。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:05' },
  { name: '非出勤日假', short: '非', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '如涉及非排班日请假需单独配置，请假计算将跳过非排班时段。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:11' },
  { name: '哺乳时间假', short: '哺', enabled: false, unit: '需审批假', paid: '否', negative: '否', before: '否', note: '哺乳期女性员工使用的按次假期，单次时长由规则控制。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:17' },
  { name: '合并哺乳时间', short: '哺', enabled: false, unit: '需审批假', paid: '否', negative: '否', before: '否', note: '支持合并使用多次哺乳时间，系统自动校验每日最大使用量。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:22' },
  { name: '育儿假', short: '育', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '子女三周岁以内员工可享受的地区政策假，支持按次或按年配置。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:59' },
  { name: '加班调休', short: '补', enabled: false, unit: '按小时请假', paid: '否', negative: '否', before: '否', note: '无法单独控制的日度过账类调休生成申请。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2025-08-26 15:59:58' },
];

type LeaveTypeRow = typeof TYPE_ROWS[number];

export default function LeaveManagement() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRecordMore, setShowRecordMore] = useState(false);
  const [showBalanceMore, setShowBalanceMore] = useState(false);
  const [showDetailMore, setShowDetailMore] = useState(false);
  const [showTypeMore, setShowTypeMore] = useState(false);
  const [showSchemeMore, setShowSchemeMore] = useState(false);
  const [recordMenuOpen, setRecordMenuOpen] = useState(false);
  const [balanceMenuOpen, setBalanceMenuOpen] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);

  const activeTab = useMemo(
    () => ROUTE_TABS.find(tab => tab.path === location.pathname) ?? ROUTE_TABS[0],
    [location.pathname],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4, minHeight: 40, flexShrink: 0 }}>
        <TopTab label="首页" active={false} onClick={() => navigate('/attendance/home')} colors={colors} />
        {ROUTE_TABS.map(tab => (
          <TopTab key={tab.key} label={tab.label} active={activeTab.key === tab.key} onClick={() => navigate(tab.path)} colors={colors} />
        ))}
        <button style={{ marginLeft: 4, padding: '2px 10px', fontSize: '12px', border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: 'default', background: 'transparent', color: colors.textMuted }}>×</button>
      </div>

      {activeTab.key === 'record' && (
        <LeaveRecordView
          colors={colors}
          showMore={showRecordMore}
          onToggleMore={() => setShowRecordMore(prev => !prev)}
          menuOpen={recordMenuOpen}
          onToggleMenu={() => setRecordMenuOpen(prev => !prev)}
          onCloseMenu={() => setRecordMenuOpen(false)}
        />
      )}
      {activeTab.key === 'balance' && (
        <LeaveBalanceView
          colors={colors}
          showMore={showBalanceMore}
          onToggleMore={() => setShowBalanceMore(prev => !prev)}
          menuOpen={balanceMenuOpen}
          onToggleMenu={() => setBalanceMenuOpen(prev => !prev)}
          onCloseMenu={() => setBalanceMenuOpen(false)}
        />
      )}
      {activeTab.key === 'detail' && (
        <LeaveDetailView
          colors={colors}
          showMore={showDetailMore}
          onToggleMore={() => setShowDetailMore(prev => !prev)}
          menuOpen={detailMenuOpen}
          onToggleMenu={() => setDetailMenuOpen(prev => !prev)}
          onCloseMenu={() => setDetailMenuOpen(false)}
        />
      )}
      {activeTab.key === 'type' && (
        <LeaveTypeView
          colors={colors}
          showMore={showTypeMore}
          onToggleMore={() => setShowTypeMore(prev => !prev)}
        />
      )}
      {activeTab.key === 'scheme' && (
        <LeaveSchemeView
          colors={colors}
          showMore={showSchemeMore}
          onToggleMore={() => setShowSchemeMore(prev => !prev)}
        />
      )}
    </div>
  );
}

function LeaveRecordView({
  colors,
  showMore,
  onToggleMore,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableRows, setTableRows] = useState<Array<Array<React.ReactNode>>>(LEAVE_RECORD_ROWS);
  const [dateRange, setDateRange] = useState(monthRange());
  const [deptFilter, setDeptFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [startTypeFilter, setStartTypeFilter] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState('');
  const [flowStatusFilter, setFlowStatusFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ index: number; direction: 'asc' | 'desc' } | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<string[]>(TYPE_ROWS.filter(row => row.enabled).map(row => row.name));
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRow, setEditingRow] = useState<Array<React.ReactNode> | null>(null);
  const [recordDraft, setRecordDraft] = useState<LeaveRecordDraft>(() => defaultLeaveRecordDraft([], TYPE_ROWS.filter(row => row.enabled).map(row => row.name)));

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLeaveRecords(), fetchSettingsPeople(), fetchLeaveTypes()])
      .then(([records, people, types]) => {
        if (cancelled) return;
        setTableRows(records.rows as Array<Array<React.ReactNode>>);
        const employees = peopleRowsToOptions(people.rows as Array<Array<unknown>>);
        const nextTypes = leaveTypeNames(types.rows as Array<Record<string, unknown>>);
        setEmployeeOptions(employees);
        setLeaveTypeOptions(nextTypes);
        setRecordDraft(current => current.applicantKey ? current : defaultLeaveRecordDraft(employees, nextTypes));
      })
      .catch(() => {
        if (!cancelled) {
          setTableRows([]);
          setEmployeeOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commitLeaveRecords = (updater: (rows: Array<Array<React.ReactNode>>) => Array<Array<React.ReactNode>>) => {
    setTableRows(current => {
      const next = updater(current);
      void saveLeaveRecords(plainRows(next)).catch(() => window.alert('请假记录已在页面更新，但保存到后端失败'));
      return next;
    });
  };

  const rows = tableRows.filter(row => {

    const applicantKeyword = applicantFilter.trim().toLowerCase();
    const initiatorKeyword = initiatorFilter.trim().toLowerCase();
    const startDate = String(row[9] || '').slice(0, 10);
    const matchForm = (!dateRange.start || startDate >= dateRange.start)
      && (!dateRange.end || startDate <= dateRange.end)
      && (!deptFilter || row[3] === deptFilter)
      && (!applicantKeyword || String(row[1]).toLowerCase().includes(applicantKeyword) || String(row[2]).toLowerCase().includes(applicantKeyword))
      && (!initiatorKeyword || String(row[5]).toLowerCase().includes(initiatorKeyword) || String(row[6]).toLowerCase().includes(initiatorKeyword))
      && (!leaveTypeFilter || row[8] === leaveTypeFilter)
      && (!startTypeFilter || row[7] === startTypeFilter)
      && (!recordStatusFilter || row[0] === recordStatusFilter)
      && (!flowStatusFilter || row[15] === flowStatusFilter);
    return matchForm && (statusFilter === 'all' || row[0] === statusFilter || row[15] === statusFilter);
  });
  const sortedRows = !sortConfig
    ? rows
    : [...rows].sort((a, b) => {
      const aValue = String(a[sortConfig.index] ?? '');
      const bValue = String(b[sortConfig.index] ?? '');
      const factor = sortConfig.direction === 'asc' ? 1 : -1;
      const parseNum = (text: string) => {
        const n = Number(text.replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) && text !== '' ? n : null;
      };
      const numA = parseNum(aValue);
      const numB = parseNum(bValue);
      if (numA !== null && numB !== null) return (numA - numB) * factor;
      return aValue.localeCompare(bValue, 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
    });
  const statusItems = [
    { key: 'all', label: '全部', count: tableRows.length },
    { key: '已通过', label: '已通过', count: tableRows.filter(row => row[0] === '已通过').length },
    { key: '审批中', label: '审批中', count: tableRows.filter(row => row[0] === '审批中').length },
    { key: '已拒绝', label: '已拒绝', count: tableRows.filter(row => row[0] === '已拒绝').length },
  ];
  const resetFilters = () => { setDateRange(monthRange()); setDeptFilter(''); setApplicantFilter(''); setInitiatorFilter(''); setLeaveTypeFilter(''); setStartTypeFilter(''); setRecordStatusFilter(''); setFlowStatusFilter(''); setStatusFilter('all'); setSortConfig(null); };

  const exportRows = () => {
    const csv = [LEAVE_RECORD_COLUMNS, ...rows].map(row => row.map(cell => String(cell ?? '')).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '请假记录.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };
  const deleteRows = () => commitLeaveRecords(current => current.filter(row => !rows.includes(row)));
  const openAddLeaveRecord = (label = '添加请假记录') => {
    const startType = label.includes('发起') || label.includes('批量') ? '员工发起' : '管理员发起';
    setEditingRow(null);
    setRecordDraft({
      ...defaultLeaveRecordDraft(employeeOptions, leaveTypeOptions, startType),
      reason: label,
      recordStatus: startType === '员工发起' ? '审批中' : '已通过',
      flowStatus: startType === '员工发起' ? '审批中' : '已通过',
    });
    setShowRecordModal(true);
  };
  const clearLeaveRecords = () => {
    if (!window.confirm('确认清空当前筛选出的请假记录？')) return;
    commitLeaveRecords(current => current.filter(row => !rows.includes(row)));
  };
  const editLeaveRecord = (row: Array<React.ReactNode>) => {
    setEditingRow(row);
    setRecordDraft(leaveDraftFromRow(row, employeeOptions, leaveTypeOptions));
    setShowRecordModal(true);
  };
  const updateRecordDraft = (key: keyof LeaveRecordDraft, value: string) => {
    setRecordDraft(current => {
      const next = { ...current, [key]: value };
      if (key === 'startTime' || key === 'endTime') {
        next.duration = calculateLeaveDuration(key === 'startTime' ? value : current.startTime, key === 'endTime' ? value : current.endTime);
      }
      if (key === 'flowStatus') next.recordStatus = value;
      return next;
    });
  };
  const saveRecordDraft = () => {
    if (!recordDraft.applicantKey || !recordDraft.leaveType || !recordDraft.startTime || !recordDraft.endTime) {
      window.alert('请选择申请人、假期类型、开始时间和结束时间');
      return;
    }
    commitLeaveRecords(current => {
      const nextRow = leaveRowFromDraft(recordDraft, employeeOptions, editingRow || undefined);
      if (!editingRow) return [nextRow, ...current];
      return current.map(row => row === editingRow ? nextRow : row);
    });
    setShowRecordModal(false);
    setEditingRow(null);
  };
  const viewLeaveRecord = (row: Array<React.ReactNode>) => {
    window.alert(`请假记录详情\n申请人：${row[1]}\n员工号：${row[2]}\n假期类型：${row[8]}\n开始时间：${row[9]}\n结束时间：${row[10]}\n请假时长：${row[11]}\n流程状态：${row[15]}`);
  };
  const displayRows = sortedRows.map(row => [
    ...row.slice(0, LEAVE_RECORD_COLUMNS.length - 1),
    <RowActions key={`actions-${String(row[2])}-${String(row[13])}`} colors={colors} actions={[
      { label: '查看', onClick: () => viewLeaveRecord(row) },
      { label: '编辑', onClick: () => editLeaveRecord(row) },
    ]} />,
  ]);
  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '如果需要调整请假模版，可到 假期管理-假期类型设置 中修改。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <DateRangeField label="请假日期" colors={colors} required width={248} value={dateRange} onChange={setDateRange} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={154} options={['产品运营部','工艺开发部','研发设计一部']} value={deptFilter} onChange={setDeptFilter} />
          <SearchField label="申请人" placeholder="请输入或选择人员" colors={colors} width={182} showUserIcon value={applicantFilter} onChange={setApplicantFilter} />
          <SearchField label="发起人" placeholder="请输入或选择员工号" colors={colors} width={182} showUserIcon value={initiatorFilter} onChange={setInitiatorFilter} />
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={154} options={['年假','病假','事假']} value={leaveTypeFilter} onChange={setLeaveTypeFilter} />
          <div style={actionRightStyle}>
            <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
            <button onClick={() => setStatusFilter(statusFilter)} style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="发起类型" placeholder="全部" colors={colors} width={148} options={['员工发起','管理员发起']} value={startTypeFilter} onChange={setStartTypeFilter} />
            <SelectField label="记录状态" placeholder="全部" colors={colors} width={148} options={['已通过','审批中','已拒绝']} value={recordStatusFilter} onChange={setRecordStatusFilter} />
            <SelectField label="当前流程状态" placeholder="全部" colors={colors} width={148} options={['已通过','审批中','已拒绝']} value={flowStatusFilter} onChange={setFlowStatusFilter} />
            <DateRangeField label="发起时间" colors={colors} width={248} />
          </div>
        )}
      </div>

      <StatusFilterBar items={statusItems} activeKey={statusFilter} onChange={setStatusFilter} colors={colors} />

      <div style={toolbarStyle(colors)}>
        <button onClick={() => openAddLeaveRecord()} style={primaryBtn(colors)}>添加请假记录</button>
        <DropdownButton label="发起请假流程" items={START_LEAVE_ITEMS} open={menuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onSelect={(item) => openAddLeaveRecord(item.label)} colors={colors} />
        <button onClick={exportRows} style={outlineBtn(colors)}>导出</button>
        <button onClick={deleteRows} style={outlineBtn(colors)}>删除</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={clearLeaveRecords} style={linkBtn(colors)}>批量清除记录</button>
          <button onClick={() => setSortConfig(null)} style={iconBtn(colors)} title="恢复默认表头排序"><Settings2 size={12} /></button>
        </div>
      </div>

      <TableShell
        columns={LEAVE_RECORD_COLUMNS}
        rows={displayRows}
        colors={colors}
        emptyText="暂无内容"
        sortConfig={sortConfig}
        nonSortableColumnIndices={[LEAVE_RECORD_COLUMNS.length - 1]}
        onSortChange={(index) => {
          if (index >= LEAVE_RECORD_COLUMNS.length - 1) return;
          setSortConfig(current => {
            if (!current || current.index !== index) return { index, direction: 'asc' };
            return { index, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          });
        }}
      />

      {showRecordModal ? (
        <LeaveRecordModal
          colors={colors}
          title={editingRow ? '编辑请假记录' : '添加请假记录'}
          draft={recordDraft}
          employees={employeeOptions}
          leaveTypes={leaveTypeOptions}
          onChange={updateRecordDraft}
          onCancel={() => setShowRecordModal(false)}
          onSave={saveRecordDraft}
        />
      ) : null}

    </>
  );
}

function LeaveRecordModal({
  colors,
  title,
  draft,
  employees,
  leaveTypes,
  onChange,
  onCancel,
  onSave,
}: {
  colors: any;
  title: string;
  draft: LeaveRecordDraft;
  employees: EmployeeOption[];
  leaveTypes: string[];
  onChange: (key: keyof LeaveRecordDraft, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const selectedApplicant = employeeFromKey(employees, draft.applicantKey);
  const deptOptions = Array.from(new Set(employees.map(employee => employee.department).filter(Boolean)));
  return (
    <div style={modalOverlay}>
      <div style={modalPanel(colors, 760)}>
        <div style={modalHeader(colors)}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>请按表头字段选择人员、假期类型和请假时间，保存后写入请假记录接口</div>
          </div>
          <button onClick={onCancel} style={iconBtn(colors)}>×</button>
        </div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
          <ModalField label="申请人" required colors={colors}>
            <EmployeeSearchSelect value={draft.applicantKey} employees={employees} colors={colors} onChange={value => onChange('applicantKey', value)} />
          </ModalField>
          <ModalField label="申请人部门" colors={colors}>
            <select value={selectedApplicant.department} onChange={() => undefined} style={{ ...modalInput(colors), color: colors.textMuted }}>
              {deptOptions.includes(selectedApplicant.department) ? null : <option value={selectedApplicant.department}>{selectedApplicant.department}</option>}
              {deptOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </ModalField>
          <ModalField label="发起人" required colors={colors}>
            <EmployeeSearchSelect value={draft.initiatorKey || draft.applicantKey} employees={employees} colors={colors} placeholder="输入发起人姓名或工号" onChange={value => onChange('initiatorKey', value)} />
          </ModalField>
          <ModalField label="发起类型" required colors={colors}>
            <select value={draft.startType} onChange={event => onChange('startType', event.target.value)} style={modalInput(colors)}>
              {['员工发起', '管理员发起'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="假期类型" required colors={colors}>
            <select value={draft.leaveType} onChange={event => onChange('leaveType', event.target.value)} style={modalInput(colors)}>
              {leaveTypes.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="当前流程状态" required colors={colors}>
            <select value={draft.flowStatus} onChange={event => onChange('flowStatus', event.target.value)} style={modalInput(colors)}>
              {['已通过', '审批中', '已拒绝'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="开始时间" required colors={colors}>
            <input type="datetime-local" value={draft.startTime} onChange={event => onChange('startTime', event.target.value)} style={modalInput(colors)} />
          </ModalField>
          <ModalField label="结束时间" required colors={colors}>
            <input type="datetime-local" value={draft.endTime} onChange={event => onChange('endTime', event.target.value)} style={modalInput(colors)} />
          </ModalField>
          <ModalField label="请假时长" required colors={colors}>
            <input value={draft.duration} onChange={event => onChange('duration', event.target.value)} placeholder="例如：1天" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="记录状态" required colors={colors}>
            <select value={draft.recordStatus} onChange={event => onChange('recordStatus', event.target.value)} style={modalInput(colors)}>
              {['已通过', '审批中', '已拒绝'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="请假事由" colors={colors} full>
            <textarea value={draft.reason} onChange={event => onChange('reason', event.target.value)} placeholder="请输入请假事由" style={{ ...modalInput(colors), height: 82, resize: 'vertical', paddingTop: 8 }} />
          </ModalField>
        </div>
        <div style={modalFooter(colors)}>
          <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
          <button onClick={onSave} disabled={!draft.applicantKey || !draft.leaveType || !draft.startTime || !draft.endTime} style={!draft.applicantKey || !draft.leaveType || !draft.startTime || !draft.endTime ? disabledBtn(colors) : primaryBtn(colors)}>
            保存记录
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeSearchSelect({
  value,
  employees,
  colors,
  placeholder = '输入姓名或工号选择人员',
  onChange,
}: {
  value: string;
  employees: EmployeeOption[];
  colors: any;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const selected = employees.find(employee => employeeKey(employee) === value);
  const [query, setQuery] = useState(selected ? `${selected.name} / ${selected.employeeNo}` : '');
  const [open, setOpen] = useState(false);
  const filtered = employees.filter(employee => employeeMatches(employee, query)).slice(0, 8);

  useEffect(() => {
    const nextSelected = employees.find(employee => employeeKey(employee) === value);
    setQuery(nextSelected ? `${nextSelected.name} / ${nextSelected.employeeNo}` : '');
  }, [employees, value]);

  const selectEmployee = (employee: EmployeeOption) => {
    onChange(employeeKey(employee));
    setQuery(`${employee.name} / ${employee.employeeNo}`);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...modalInput(colors), display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={event => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            const exact = employees.find(employee => employee.name === nextQuery || employee.employeeNo === nextQuery || `${employee.name} / ${employee.employeeNo}` === nextQuery);
            onChange(exact ? employeeKey(exact) : '');
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && filtered[0]) selectEmployee(filtered[0]);
            if (event.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 13 }}
        />
        <Search size={13} style={{ color: colors.textMuted, flexShrink: 0 }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 940, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 12px 28px rgba(34, 48, 78, 0.16)', overflow: 'hidden', maxHeight: 230, overflowY: 'auto' }}>
          {filtered.length ? filtered.map(employee => (
            <button
              key={employeeKey(employee)}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectEmployee(employee)}
              style={{ width: '100%', border: 'none', background: employeeKey(employee) === value ? colors.badgeBlueBg : 'transparent', color: colors.text, cursor: 'pointer', padding: '8px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <span style={{ fontSize: 13 }}>{employee.name} / {employee.employeeNo}</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>{employee.department}</span>
            </button>
          )) : (
            <div style={{ padding: '10px 12px', fontSize: 12, color: colors.textMuted }}>未找到匹配人员</div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaveBalanceView({
  colors,
  showMore,
  onToggleMore,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  const [sortConfig, setSortConfig] = useState<{ index: number; direction: 'asc' | 'desc' } | null>(null);
  const [balanceRows, setBalanceRows] = useState<Array<Array<React.ReactNode>>>(LEAVE_BALANCE_ROWS);

  useEffect(() => {
    let cancelled = false;
    fetchLeaveBalances()
      .then((res) => {
        if (!cancelled) setBalanceRows(res.rows as Array<Array<React.ReactNode>>);
      })
      .catch(() => {
        if (!cancelled) setBalanceRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedRows = !sortConfig
    ? balanceRows
    : [...balanceRows].sort((a, b) => {
      const aValue = String(a[sortConfig.index] ?? '');
      const bValue = String(b[sortConfig.index] ?? '');
      const factor = sortConfig.direction === 'asc' ? 1 : -1;
      const parseNum = (text: string) => {
        const n = Number(text.replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) && text !== '' ? n : null;
      };
      const numA = parseNum(aValue);
      const numB = parseNum(bValue);
      if (numA !== null && numB !== null) return (numA - numB) * factor;
      return aValue.localeCompare(bValue, 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
    });
  const exportBalanceRows = () => {
    const csv = [LEAVE_BALANCE_COLUMNS, ...sortedRows].map(row => row.map(cell => String(cell ?? '')).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '假期余额.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>

      <InfoBanner
        colors={colors}
        messages={[
          '新入职员工自假期生效日第二天起，按授权周期规则计算员工应休假次数。',
          '如需修改【入职日期】请至 员工信息 进行设置。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SelectField label="部门" placeholder="请选择" colors={colors} width={154} />
          <SearchField label="员工" placeholder="请输入或选择人员" colors={colors} width={182} showUserIcon />
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={154} />
          <DateRangeField label="入职日期" colors={colors} width={248} />
          <SelectField label="授权周期" placeholder="自然年" colors={colors} width={140} />
          <div style={actionRightStyle}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="员工状态" placeholder="在职" colors={colors} width={138} />
            <SelectField label="发放状态" placeholder="全部" colors={colors} width={138} />
            <DateRangeField label="额度生效日期" colors={colors} width={250} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <DropdownButton label="发放假期额度" items={BALANCE_GRANT_ITEMS} open={menuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onSelect={(item) => window.alert(`已按「${item.label}」生成假期额度发放任务`)} colors={colors} />
        <button onClick={exportBalanceRows} style={outlineBtn(colors)}>导出</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => window.alert('使用指引\n可通过筛选定位人员，点击导出下载当前余额。')} style={linkBtn(colors)}>使用指引</button>
          <button onClick={() => setSortConfig(null)} style={iconBtn(colors)} title="恢复默认表头排序"><Settings2 size={12} /></button>
        </div>
      </div>

      <TableShell
        columns={LEAVE_BALANCE_COLUMNS}
        rows={sortedRows}
        colors={colors}
        emptyText="暂无内容"
        sortConfig={sortConfig}
        onSortChange={(index) => {
          setSortConfig(current => {
            if (!current || current.index !== index) return { index, direction: 'asc' };
            return { index, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          });
        }}
      />

    </>
  );
}

function LeaveDetailView({
  colors,
  showMore,
  onToggleMore,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [detailRows, setDetailRows] = useState<Array<Array<React.ReactNode>>>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<string[]>(TYPE_ROWS.filter(row => row.enabled).map(row => row.name));
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingDetailRow, setEditingDetailRow] = useState<Array<React.ReactNode> | null>(null);
  const [detailDraft, setDetailDraft] = useState<LeaveDetailDraft>(() => defaultLeaveDetailDraft([], TYPE_ROWS.filter(row => row.enabled).map(row => row.name)));
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLeaveDetails(), fetchSettingsPeople(), fetchLeaveTypes()])
      .then(([details, people, types]) => {
        if (cancelled) return;
        const employees = peopleRowsToOptions(people.rows as Array<Array<unknown>>);
        const nextTypes = leaveTypeNames(types.rows as Array<Record<string, unknown>>);
        setDetailRows(details.rows as Array<Array<React.ReactNode>>);
        setEmployeeOptions(employees);
        setLeaveTypeOptions(nextTypes);
        setDetailDraft(current => current.employeeKey ? current : defaultLeaveDetailDraft(employees, nextTypes));
      })
      .catch(() => {
        if (!cancelled) {
          setDetailRows([]);
          setEmployeeOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const commitLeaveDetails = (updater: (rows: Array<Array<React.ReactNode>>) => Array<Array<React.ReactNode>>) => {
    setDetailRows(current => {
      const next = updater(current);
      void saveLeaveDetails(plainRows(next)).catch(() => window.alert('假期额度明细已在页面更新，但保存到后端失败'));
      return next;
    });
  };
  const addDetailRow = (source = '新增额度记录') => {
    setEditingDetailRow(null);
    setDetailDraft(defaultLeaveDetailDraft(employeeOptions, leaveTypeOptions, source));
    setShowDetailModal(true);
  };
  const filteredDetailRows = detailRows.filter(row => {
    const keyword = employeeQuery.trim().toLowerCase();
    return (!keyword || String(row[0] ?? '').toLowerCase().includes(keyword) || String(row[1] ?? '').toLowerCase().includes(keyword))
      && (!leaveTypeFilter || row[6] === leaveTypeFilter)
      && (!cycleFilter || row[5] === cycleFilter)
      && (!deptFilter || row[2] === deptFilter);
  });
  const sortedDetailRows = !sortConfig
    ? filteredDetailRows
    : [...filteredDetailRows].sort((left, right) => compareSortableValues(left[sortConfig.index], right[sortConfig.index], sortConfig.direction));
  const exportDetailRows = () => {
    const csv = [LEAVE_DETAIL_COLUMNS, ...filteredDetailRows].map(row => row.map(cell => String(cell ?? '')).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '假期额度明细.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };
  const handleDetailMore = (item: MenuItem) => {
    if (item.label.includes('导出')) {
      exportDetailRows();
      return;
    }
    addDetailRow(item.label);
  };
  const editDetailRow = (row: Array<React.ReactNode>) => {
    setEditingDetailRow(row);
    setDetailDraft(leaveDetailDraftFromRow(row, employeeOptions, leaveTypeOptions));
    setShowDetailModal(true);
  };
  const updateDetailDraft = (key: keyof LeaveDetailDraft, value: string) => {
    setDetailDraft(current => {
      const next = { ...current, [key]: value };
      if (['totalQuota', 'adjustQuota', 'frozenQuota', 'usedQuota'].includes(key)) {
        const total = Number(key === 'totalQuota' ? value : current.totalQuota) || 0;
        const adjust = Number(key === 'adjustQuota' ? value : current.adjustQuota) || 0;
        const frozen = Number(key === 'frozenQuota' ? value : current.frozenQuota) || 0;
        const used = Number(key === 'usedQuota' ? value : current.usedQuota) || 0;
        next.issuedQuota = String(total + adjust);
        next.activeQuota = String(Math.max(0, total + adjust - frozen));
        next.remainQuota = String(Math.max(0, total + adjust - frozen - used));
      }
      return next;
    });
  };
  const saveDetailDraft = () => {
    if (!detailDraft.employeeKey || !detailDraft.leaveType || !detailDraft.cycle) {
      window.alert('请选择人员、周期和假期类型');
      return;
    }
    commitLeaveDetails(current => {
      const nextRow = leaveDetailRowFromDraft(detailDraft, employeeOptions);
      if (!editingDetailRow) return [nextRow, ...current];
      return current.map(row => row === editingDetailRow ? nextRow : row);
    });
    setShowDetailModal(false);
    setEditingDetailRow(null);
  };
  const resetDetailFilters = () => {
    setEmployeeQuery('');
    setLeaveTypeFilter('');
    setCycleFilter('');
    setDeptFilter('');
    setSortConfig(null);
  };
  const displayDetailRows = sortedDetailRows.map(row => [
    ...row.slice(0, LEAVE_DETAIL_COLUMNS.length - 1),
    <RowActions key={`detail-${String(row[1])}-${String(row[6])}-${String(row[14])}`} colors={colors} actions={[
      { label: '查看', onClick: () => window.alert(`额度明细\n姓名：${row[0]}\n员工号：${row[1]}\n假期类型：${row[6]}\n剩余额度：${row[13]}`) },
      { label: '编辑', onClick: () => editDetailRow(row) },
    ]} />,
  ]);

  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '暂存至假期视图影响假期结转，请谨慎进行历史额度维护。',
          '入职日期、假期开始日期、首次工作日请确保配置准确，请到 员工信息 中修改。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={154} options={leaveTypeOptions} value={leaveTypeFilter} onChange={setLeaveTypeFilter} />
          <SelectField label="周期" placeholder="请选择周期" colors={colors} width={154} options={Array.from(new Set(detailRows.map(row => String(row[5] ?? '')).filter(Boolean)))} value={cycleFilter} onChange={setCycleFilter} />
          <SearchField label="员工" placeholder="请输入姓名或工号" colors={colors} width={182} showUserIcon value={employeeQuery} onChange={setEmployeeQuery} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={154} options={Array.from(new Set(employeeOptions.map(employee => employee.department).filter(Boolean)))} value={deptFilter} onChange={setDeptFilter} />
          <CheckboxGroup label="员工状态" items={['在职', '离职', '冻结员工']} colors={colors} />
          <div style={actionRightStyle}>
            <button onClick={resetDetailFilters} style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <DateRangeField label="有效期开启日期" colors={colors} width={250} />
            <DateRangeField label="周期截止日期" colors={colors} width={250} />
            <SelectField label="额度状态" placeholder="全部" colors={colors} width={148} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={() => addDetailRow()} style={primaryBtn(colors)}>新增额度记录</button>
        <button onClick={() => addDetailRow('导入额度记录')} style={outlineBtn(colors)}>导入</button>
        <button onClick={exportDetailRows} style={outlineBtn(colors)}>导出</button>
        <DropdownButton label="更多操作" items={DETAIL_MORE_ITEMS} open={menuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onSelect={handleDetailMore} colors={colors} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <TogglePill enabled />
          <span style={{ fontSize: '12px', color: colors.text }}>只看有效数据</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => window.alert(`休假过账记录\n当前筛选下共有 ${filteredDetailRows.length} 条额度记录参与过账。`)} style={linkBtn(colors)}>休假过账记录</button>
          <button onClick={() => window.alert(`额度调整记录\n已记录 ${filteredDetailRows.filter(row => String(row[10] ?? '') !== '0').length} 条调整额度。`)} style={linkBtn(colors)}>额度调整记录</button>
          <button onClick={() => setSortConfig(null)} style={iconBtn(colors)} title="恢复默认表头排序"><Settings2 size={12} /></button>
        </div>
      </div>

      <TableShell
        columns={LEAVE_DETAIL_COLUMNS}
        rows={displayDetailRows}
        colors={colors}
        emptyText="暂无内容"
        sortConfig={sortConfig}
        nonSortableColumnIndices={[LEAVE_DETAIL_COLUMNS.length - 1]}
        onSortChange={(index) => setSortConfig(current => getNextSortConfig(current, index))}
      />
      {showDetailModal ? (
        <LeaveDetailModal
          colors={colors}
          title={editingDetailRow ? '编辑额度记录' : '新增额度记录'}
          draft={detailDraft}
          employees={employeeOptions}
          leaveTypes={leaveTypeOptions}
          onChange={updateDetailDraft}
          onCancel={() => setShowDetailModal(false)}
          onSave={saveDetailDraft}
        />
      ) : null}
    </>
  );
}

function LeaveDetailModal({
  colors,
  title,
  draft,
  employees,
  leaveTypes,
  onChange,
  onCancel,
  onSave,
}: {
  colors: any;
  title: string;
  draft: LeaveDetailDraft;
  employees: EmployeeOption[];
  leaveTypes: string[];
  onChange: (key: keyof LeaveDetailDraft, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const selectedEmployee = employeeFromKey(employees, draft.employeeKey);
  const quotaInput = (key: keyof LeaveDetailDraft, placeholder = '0') => (
    <input value={String(draft[key] ?? '')} onChange={event => onChange(key, event.target.value.replace(/[^\d.-]/g, ''))} placeholder={placeholder} style={modalInput(colors)} />
  );

  return (
    <div style={modalOverlay}>
      <div style={modalPanel(colors, 820)}>
        <div style={modalHeader(colors)}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>可输入姓名或工号选择真实员工，保存后写入假期额度明细接口</div>
          </div>
          <button onClick={onCancel} style={iconBtn(colors)}>×</button>
        </div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 16px' }}>
          <ModalField label="员工" required colors={colors}>
            <EmployeeSearchSelect value={draft.employeeKey} employees={employees} colors={colors} onChange={value => onChange('employeeKey', value)} />
          </ModalField>
          <ModalField label="员工号" colors={colors}>
            <input value={selectedEmployee.employeeNo} readOnly style={{ ...modalInput(colors), color: colors.textMuted }} />
          </ModalField>
          <ModalField label="部门" colors={colors}>
            <input value={selectedEmployee.department} readOnly style={{ ...modalInput(colors), color: colors.textMuted }} />
          </ModalField>
          <ModalField label="入职日期" required colors={colors}>
            <input type="date" value={draft.hireDate} onChange={event => onChange('hireDate', event.target.value)} style={modalInput(colors)} />
          </ModalField>
          <ModalField label="周期" required colors={colors}>
            <input value={draft.cycle} onChange={event => onChange('cycle', event.target.value)} placeholder="例如：2026" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="假期类型" required colors={colors}>
            <select value={draft.leaveType} onChange={event => onChange('leaveType', event.target.value)} style={modalInput(colors)}>
              {leaveTypes.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="应休额度" required colors={colors}>{quotaInput('totalQuota', '1')}</ModalField>
          <ModalField label="已发额度" colors={colors}>{quotaInput('issuedQuota', '1')}</ModalField>
          <ModalField label="已激活额度" colors={colors}>{quotaInput('activeQuota', '1')}</ModalField>
          <ModalField label="调整额度" colors={colors}>{quotaInput('adjustQuota')}</ModalField>
          <ModalField label="冻结额度" colors={colors}>{quotaInput('frozenQuota')}</ModalField>
          <ModalField label="已用额度" colors={colors}>{quotaInput('usedQuota')}</ModalField>
          <ModalField label="剩余额度" required colors={colors}>{quotaInput('remainQuota', '1')}</ModalField>
          <ModalField label="周期开始日期" required colors={colors}>
            <input type="date" value={draft.cycleStart} onChange={event => onChange('cycleStart', event.target.value)} style={modalInput(colors)} />
          </ModalField>
          <ModalField label="周期截止日期" required colors={colors}>
            <input type="date" value={draft.cycleEnd} onChange={event => onChange('cycleEnd', event.target.value)} style={modalInput(colors)} />
          </ModalField>
          <ModalField label="有效期开启日期" required colors={colors}>
            <input type="date" value={draft.validStart} onChange={event => onChange('validStart', event.target.value)} style={modalInput(colors)} />
          </ModalField>
        </div>
        <div style={modalFooter(colors)}>
          <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
          <button onClick={onSave} disabled={!draft.employeeKey || !draft.leaveType || !draft.cycle} style={!draft.employeeKey || !draft.leaveType || !draft.cycle ? disabledBtn(colors) : primaryBtn(colors)}>
            保存记录
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaveTypeView({
  colors,
  showMore,
  onToggleMore,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [typeRows, setTypeRows] = useState<Array<LeaveTypeRow>>(TYPE_ROWS);
  const [typeNameFilter, setTypeNameFilter] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [paidFilter, setPaidFilter] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingTypeRow, setEditingTypeRow] = useState<LeaveTypeRow | null>(null);
  const [typeDraft, setTypeDraft] = useState<LeaveTypeDraft>(() => defaultLeaveTypeDraft());
  useEffect(() => {
    let cancelled = false;
    fetchLeaveTypes()
      .then((res) => {
        if (!cancelled && Array.isArray(res.rows)) setTypeRows(res.rows as Array<LeaveTypeRow>);
      })
      .catch(() => {
        if (!cancelled) setTypeRows(TYPE_ROWS);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const commitLeaveTypes = (updater: (rows: Array<LeaveTypeRow>) => Array<LeaveTypeRow>) => {
    setTypeRows(current => {
      const next = updater(current);
      void saveLeaveTypes(next).catch(() => window.alert('假期类型已在页面更新，但保存到后端失败'));
      return next;
    });
  };
  const filteredTypeRows = typeRows.filter(row => {
    const keyword = typeNameFilter.trim().toLowerCase();
    return (!keyword || row.name.toLowerCase().includes(keyword) || row.short.toLowerCase().includes(keyword))
      && (!enabledFilter || (enabledFilter === '是' ? row.enabled : !row.enabled))
      && (!unitFilter || row.unit === unitFilter)
      && (!paidFilter || row.paid === paidFilter);
  });
  const sortedTypeRows = useMemo(() => {
    const rows = filteredTypeRows.map((row, order) => ({ row, order }));
    if (!sortConfig) return rows;

    return [...rows].sort((left, right) => compareSortableValues(
      getTypeSortValue(left.row, left.order, sortConfig.index),
      getTypeSortValue(right.row, right.order, sortConfig.index),
      sortConfig.direction,
    ));
  }, [filteredTypeRows, sortConfig]);
  const addLeaveType = () => {
    setEditingTypeRow(null);
    setTypeDraft(defaultLeaveTypeDraft());
    setShowTypeModal(true);
  };
  const editLeaveType = (row: LeaveTypeRow) => {
    setEditingTypeRow(row);
    setTypeDraft(leaveTypeDraftFromRow(row));
    setShowTypeModal(true);
  };
  const deleteLeaveType = (row: LeaveTypeRow) => {
    if (!window.confirm(`确认删除假期类型「${row.name}」？`)) return;
    commitLeaveTypes(current => current.filter(item => item.name !== row.name));
  };
  const updateTypeDraft = (key: keyof LeaveTypeDraft, value: string | boolean) => {
    setTypeDraft(current => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !current.short.trim() && typeof value === 'string') next.short = value.trim().slice(0, 1);
      return next;
    });
  };
  const saveTypeDraft = () => {
    const name = typeDraft.name.trim();
    if (!name) {
      window.alert('假期类型名称不能为空');
      return;
    }
    if (!editingTypeRow && typeRows.some(row => row.name === name)) {
      window.alert('假期类型名称已存在');
      return;
    }
    commitLeaveTypes(current => {
      const nextRow = leaveTypeRowFromDraft(typeDraft, editingTypeRow || undefined);
      if (!editingTypeRow) return [nextRow, ...current];
      return current.map(row => row === editingTypeRow ? nextRow : row);
    });
    setShowTypeModal(false);
    setEditingTypeRow(null);
  };
  const resetTypeFilters = () => {
    setTypeNameFilter('');
    setEnabledFilter('');
    setUnitFilter('');
    setPaidFilter('');
    setSortConfig(null);
  };

  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '设置假期单位、带薪和累计方式后，员工在申请假期前需按配置发放余额。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SearchField label="假期类型名称" placeholder="请输入" colors={colors} width={200} value={typeNameFilter} onChange={setTypeNameFilter} />
          <SelectField label="是否启用" placeholder="请选择" colors={colors} width={138} options={['是', '否']} value={enabledFilter} onChange={setEnabledFilter} />
          <SelectField label="计假单位" placeholder="请选择" colors={colors} width={138} options={['按天请假', '按小时请假']} value={unitFilter} onChange={setUnitFilter} />
          <SelectField label="是否带薪" placeholder="请选择" colors={colors} width={138} options={['是', '否']} value={paidFilter} onChange={setPaidFilter} />
          <div style={actionRightStyle}>
            <button onClick={resetTypeFilters} style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="余额可为负" placeholder="请选择" colors={colors} width={138} />
            <SelectField label="事前可申请" placeholder="请选择" colors={colors} width={138} />
            <SelectField label="附件必传" placeholder="请选择" colors={colors} width={138} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={addLeaveType} style={primaryBtn(colors)}>新增假期类型</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => window.alert('使用指引\n1. 新增假期类型后会立即加入列表。\n2. 修改可调整假期类型名称。\n3. 删除前会二次确认。')} style={linkBtn(colors)}>
            <HelpCircle size={12} />
            使用指引
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
              {LEAVE_TYPE_COLUMNS.map((column, columnIndex) => {
                const sortable = columnIndex < LEAVE_TYPE_COLUMNS.length - 1;
                const active = sortConfig?.index === columnIndex;

                return (
                  <th key={column} style={{ ...th(colors), minWidth: column.length >= 6 ? 136 : 100 }}>
                    {sortable ? (
                      <SortableHeaderButton
                        label={column}
                        active={active}
                        direction={active ? sortConfig?.direction : undefined}
                        colors={colors}
                        onClick={() => setSortConfig(current => getNextSortConfig(current, columnIndex))}
                      />
                    ) : (
                      column
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedTypeRows.map(({ row }, index) => (
              <tr key={row.name} style={{ backgroundColor: index % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                <td style={td(colors)}>☰</td>
                <td style={td(colors)}>{row.name}</td>
                <td style={td(colors)}>{row.short}</td>
                <td style={td(colors)}><TogglePill enabled={row.enabled} /></td>
                <td style={td(colors)}>{row.unit}</td>
                <td style={td(colors)}>{row.paid}</td>
                <td style={td(colors)}>{row.negative}</td>
                <td style={{ ...td(colors), minWidth: 280 }}>{row.note}</td>
                <td style={td(colors)}>{row.before}</td>
                <td style={td(colors)}>{row.reason}</td>
                <td style={td(colors)}>{row.attachment}</td>
                <td style={td(colors)}>{row.attachmentNote}</td>
                <td style={td(colors)}>{row.creator}</td>
                <td style={td(colors)}>{row.createdAt}</td>
                <td style={td(colors)}>{row.editor}</td>
                <td style={td(colors)}>{row.editedAt}</td>
                <td style={td(colors)}>
                  <button onClick={() => editLeaveType(row)} style={textActionBtn(colors)}>修改</button>
                  <button onClick={() => deleteLeaveType(row)} style={textActionBtn(colors)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showTypeModal ? (
        <LeaveTypeModal
          colors={colors}
          title={editingTypeRow ? '编辑假期类型' : '新增假期类型'}
          draft={typeDraft}
          onChange={updateTypeDraft}
          onCancel={() => setShowTypeModal(false)}
          onSave={saveTypeDraft}
        />
      ) : null}
    </>
  );
}

function LeaveTypeModal({
  colors,
  title,
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  colors: any;
  title: string;
  draft: LeaveTypeDraft;
  onChange: (key: keyof LeaveTypeDraft, value: string | boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modalPanel(colors, 780)}>
        <div style={modalHeader(colors)}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>按表头字段维护假期类型，保存后写入假期类型接口并可被假期方案选择</div>
          </div>
          <button onClick={onCancel} style={iconBtn(colors)}>×</button>
        </div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
          <ModalField label="假期类型名称" required colors={colors}>
            <input value={draft.name} onChange={event => onChange('name', event.target.value)} placeholder="例如：年假" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="假期类型简称" required colors={colors}>
            <input value={draft.short} onChange={event => onChange('short', event.target.value)} placeholder="例如：年" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="假期启用" colors={colors}>
            <select value={draft.enabled ? '是' : '否'} onChange={event => onChange('enabled', event.target.value === '是')} style={modalInput(colors)}>
              {['是', '否'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="请假单位" colors={colors}>
            <select value={draft.unit} onChange={event => onChange('unit', event.target.value)} style={modalInput(colors)}>
              {['按天请假', '按小时请假'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="是否带薪" colors={colors}>
            <select value={draft.paid} onChange={event => onChange('paid', event.target.value)} style={modalInput(colors)}>
              {['是', '否'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="余额可为负" colors={colors}>
            <select value={draft.negative} onChange={event => onChange('negative', event.target.value)} style={modalInput(colors)}>
              {['是', '否'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="显示假期说明" colors={colors}>
            <select value={draft.before} onChange={event => onChange('before', event.target.value)} style={modalInput(colors)}>
              {['是', '否'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="每假事由必填" colors={colors}>
            <select value={draft.reason} onChange={event => onChange('reason', event.target.value)} style={modalInput(colors)}>
              {['是', '否'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="附件必传" colors={colors}>
            <select value={draft.attachment} onChange={event => onChange('attachment', event.target.value)} style={modalInput(colors)}>
              {['是', '否'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="附件说明" colors={colors}>
            <input value={draft.attachmentNote} onChange={event => onChange('attachmentNote', event.target.value)} placeholder="例如：需上传证明材料" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="休假前额说明" colors={colors} full>
            <textarea value={draft.note} onChange={event => onChange('note', event.target.value)} placeholder="请输入假期说明" style={{ ...modalInput(colors), height: 82, resize: 'vertical', paddingTop: 8 }} />
          </ModalField>
        </div>
        <div style={modalFooter(colors)}>
          <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
          <button onClick={onSave} disabled={!draft.name.trim() || !draft.short.trim()} style={!draft.name.trim() || !draft.short.trim() ? disabledBtn(colors) : primaryBtn(colors)}>保存记录</button>
        </div>
      </div>
    </div>
  );
}

function LeaveSchemeView({
  colors,
  showMore,
  onToggleMore,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [schemeRows, setSchemeRows] = useState<Array<Array<React.ReactNode>>>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<string[]>(TYPE_ROWS.filter(row => row.enabled).map(row => row.name));
  const [schemeNameFilter, setSchemeNameFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [editingSchemeRow, setEditingSchemeRow] = useState<Array<React.ReactNode> | null>(null);
  const [schemeDraft, setSchemeDraft] = useState<LeaveSchemeDraft>(() => defaultLeaveSchemeDraft(TYPE_ROWS.filter(row => row.enabled).map(row => row.name)));
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLeaveSchemes(), fetchLeaveTypes()])
      .then(([schemes, types]) => {
        if (cancelled) return;
        const nextTypes = leaveTypeNames(types.rows as Array<Record<string, unknown>>);
        setSchemeRows(schemes.rows as Array<Array<React.ReactNode>>);
        setLeaveTypeOptions(nextTypes);
        setSchemeDraft(current => current.leaveType ? current : defaultLeaveSchemeDraft(nextTypes));
      })
      .catch(() => {
        if (!cancelled) setSchemeRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const commitLeaveSchemes = (updater: (rows: Array<Array<React.ReactNode>>) => Array<Array<React.ReactNode>>) => {
    setSchemeRows(current => {
      const next = updater(current);
      void saveLeaveSchemes(plainRows(next)).catch(() => window.alert('假期方案已在页面更新，但保存到后端失败'));
      return next;
    });
  };
  const addScheme = () => {
    setEditingSchemeRow(null);
    setSchemeDraft(defaultLeaveSchemeDraft(leaveTypeOptions, schemeRows.length + 1));
    setShowSchemeModal(true);
  };
  const editScheme = (row: Array<React.ReactNode>) => {
    setEditingSchemeRow(row);
    setSchemeDraft(leaveSchemeDraftFromRow(row));
    setShowSchemeModal(true);
  };
  const deleteScheme = (row: Array<React.ReactNode>) => {
    if (!window.confirm(`确认删除假期方案「${row[0]}」？`)) return;
    commitLeaveSchemes(current => current.filter(item => item !== row));
  };
  const filteredSchemeRows = schemeRows.filter(row => {
    const keyword = schemeNameFilter.trim().toLowerCase();
    return (!keyword || String(row[0] ?? '').toLowerCase().includes(keyword))
      && (!leaveTypeFilter || row[1] === leaveTypeFilter)
      && (!scopeFilter || String(row[4] ?? '').includes(scopeFilter));
  });
  const sortedSchemeRows = !sortConfig
    ? filteredSchemeRows
    : [...filteredSchemeRows].sort((left, right) => compareSortableValues(left[sortConfig.index], right[sortConfig.index], sortConfig.direction));
  const updateSchemeDraft = (key: keyof LeaveSchemeDraft, value: string) => {
    setSchemeDraft(current => ({ ...current, [key]: value }));
  };
  const saveSchemeDraft = () => {
    if (!schemeDraft.name.trim() || !schemeDraft.leaveType) {
      window.alert('请填写方案名称并选择假期类型');
      return;
    }
    commitLeaveSchemes(current => {
      const nextRow = leaveSchemeRowFromDraft(schemeDraft, editingSchemeRow || undefined);
      if (!editingSchemeRow) return [nextRow, ...current];
      return current.map(row => row === editingSchemeRow ? nextRow : row);
    });
    setShowSchemeModal(false);
    setEditingSchemeRow(null);
  };
  const resetSchemeFilters = () => {
    setSchemeNameFilter('');
    setLeaveTypeFilter('');
    setScopeFilter('');
    setSortConfig(null);
  };
  const displaySchemeRows = sortedSchemeRows.map(row => [
    ...row.slice(0, LEAVE_SCHEME_COLUMNS.length - 1),
    <RowActions key={`scheme-${String(row[0])}`} colors={colors} actions={[
      { label: '查看', onClick: () => window.alert(`假期方案\n方案名称：${row[0]}\n假期类型：${row[1]}\n适用范围：${row[4]}`) },
      { label: '编辑', onClick: () => editScheme(row) },
      { label: '删除', onClick: () => deleteScheme(row) },
    ]} />,
  ]);

  return (
    <>
      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SearchField label="方案名称" placeholder="请输入" colors={colors} width={200} value={schemeNameFilter} onChange={setSchemeNameFilter} />
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={160} options={leaveTypeOptions} value={leaveTypeFilter} onChange={setLeaveTypeFilter} />
          <div style={actionRightStyle}>
            <button onClick={resetSchemeFilters} style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="适用范围" placeholder="全部" colors={colors} width={148} options={['全部员工', '在职员工', '指定部门']} value={scopeFilter} onChange={setScopeFilter} />
            <SelectField label="优先级" placeholder="全部" colors={colors} width={148} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={addScheme} style={primaryBtn(colors)}>新增假期方案</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => window.alert('使用指引\n新增假期方案后会立即加入列表，可继续通过表头排序查看优先级。')} style={linkBtn(colors)}>
            <HelpCircle size={12} />
            使用指引
          </button>
        </div>
      </div>

      <TableShell
        columns={LEAVE_SCHEME_COLUMNS}
        rows={displaySchemeRows}
        colors={colors}
        emptyText="暂无内容"
        sortConfig={sortConfig}
        nonSortableColumnIndices={[LEAVE_SCHEME_COLUMNS.length - 1]}
        onSortChange={(index) => setSortConfig(current => getNextSortConfig(current, index))}
      />
      {showSchemeModal ? (
        <LeaveSchemeModal
          colors={colors}
          title={editingSchemeRow ? '编辑假期方案' : '新增假期方案'}
          draft={schemeDraft}
          leaveTypes={leaveTypeOptions}
          onChange={updateSchemeDraft}
          onCancel={() => setShowSchemeModal(false)}
          onSave={saveSchemeDraft}
        />
      ) : null}
    </>
  );
}

function LeaveSchemeModal({
  colors,
  title,
  draft,
  leaveTypes,
  onChange,
  onCancel,
  onSave,
}: {
  colors: any;
  title: string;
  draft: LeaveSchemeDraft;
  leaveTypes: string[];
  onChange: (key: keyof LeaveSchemeDraft, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modalPanel(colors, 720)}>
        <div style={modalHeader(colors)}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>方案会关联假期类型设置中的真实假期类型，保存后写入假期方案接口</div>
          </div>
          <button onClick={onCancel} style={iconBtn(colors)}>×</button>
        </div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
          <ModalField label="方案名称" required colors={colors}>
            <input value={draft.name} onChange={event => onChange('name', event.target.value)} placeholder="请输入方案名称" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="假期类型" required colors={colors}>
            <select value={draft.leaveType} onChange={event => onChange('leaveType', event.target.value)} style={modalInput(colors)}>
              {leaveTypes.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="请假控制规则" colors={colors}>
            <select value={draft.leaveControl} onChange={event => onChange('leaveControl', event.target.value)} style={modalInput(colors)}>
              {['按规则控制', '无需审批', '仅工作日可申请', '限制提前申请'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="额度控制" colors={colors}>
            <select value={draft.quotaControl} onChange={event => onChange('quotaControl', event.target.value)} style={modalInput(colors)}>
              {['启用额度控制', '不限制额度', '允许负额度', '仅发放后可用'].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </ModalField>
          <ModalField label="适用范围" colors={colors}>
            <input value={draft.scope} onChange={event => onChange('scope', event.target.value)} placeholder="例如：全部员工 / 产品运营部" style={modalInput(colors)} />
          </ModalField>
          <ModalField label="假期优先级" colors={colors}>
            <input value={draft.priority} onChange={event => onChange('priority', event.target.value.replace(/[^\d]/g, ''))} placeholder="数字越小优先级越高" style={modalInput(colors)} />
          </ModalField>
        </div>
        <div style={modalFooter(colors)}>
          <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
          <button onClick={onSave} disabled={!draft.name.trim() || !draft.leaveType} style={!draft.name.trim() || !draft.leaveType ? disabledBtn(colors) : primaryBtn(colors)}>保存记录</button>
        </div>
      </div>
    </div>
  );
}

function RowActions({ colors, actions }: { colors: any; actions: Array<{ label: string; onClick: () => void }> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {actions.map(action => (
        <button key={action.label} onClick={action.onClick} style={textActionBtn(colors)}>{action.label}</button>
      ))}
    </div>
  );
}

function InfoBanner({ colors, messages }: { colors: any; messages: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 16px', backgroundColor: '#EEF4FF', borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
      <AlertCircle size={14} style={{ color: '#4677D6', marginTop: 1, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.map((message, index) => (
          <span key={index} style={{ fontSize: '12px', color: '#4E6488' }}>
            {messages.length > 1 ? `${index + 1}. ` : ''}{message}
          </span>
        ))}
      </div>
      <button style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8AA1C0' }}>×</button>
    </div>
  );
}

function StatusFilterBar({ items, activeKey, onChange, colors }: { items: Array<{ key: string; label: string; count: number }>; activeKey: string; onChange: (key: string) => void; colors: any }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
      {items.map(item => {
        const active = activeKey === item.key;
        return <button key={item.key} onClick={() => onChange(item.key)} style={{ padding: '4px 10px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 12, cursor: 'pointer', backgroundColor: active ? `${colors.primary}12` : 'transparent', color: active ? colors.primary : colors.textMuted }}>{item.label} <strong>{item.count}</strong></button>;
      })}
    </div>
  );
}

function getNextSortConfig(current: SortConfig | null, index: number): SortConfig {
  if (!current || current.index !== index) return { index, direction: 'asc' };
  return { index, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

function compareSortableValues(left: unknown, right: unknown, direction: SortConfig['direction']) {
  const factor = direction === 'asc' ? 1 : -1;
  const aValue = String(left ?? '');
  const bValue = String(right ?? '');
  const aNumber = Number(aValue.replace(/[^\d.-]/g, ''));
  const bNumber = Number(bValue.replace(/[^\d.-]/g, ''));

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aValue !== '' && bValue !== '') {
    return (aNumber - bNumber) * factor;
  }

  return aValue.localeCompare(bValue, 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
}

function getTypeSortValue(row: LeaveTypeRow, order: number, columnIndex: number): string | number {
  const values = [
    order + 1,
    row.name,
    row.short,
    row.enabled ? 1 : 0,
    row.unit,
    row.paid,
    row.negative,
    row.note,
    row.before,
    row.reason,
    row.attachment,
    row.attachmentNote,
    row.creator,
    row.createdAt,
    row.editor,
    row.editedAt,
    '',
  ];

  return values[columnIndex] ?? '';
}

function SortableHeaderButton({
  label,
  active,
  direction,
  colors,
  onClick,
}: {
  label: string;
  active: boolean;
  direction?: SortConfig['direction'];
  colors: any;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        margin: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: active ? colors.primary : colors.textMuted,
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {label}
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 0.7 }}>
        <ChevronUp size={10} style={{ color: active && direction === 'asc' ? colors.primary : colors.textMuted }} />
        <ChevronDown size={10} style={{ color: active && direction === 'desc' ? colors.primary : colors.textMuted }} />
      </span>
    </button>
  );
}

function TableShell({
  columns,
  rows = [],
  colors,
  emptyText,
  sortConfig,
  onSortChange,
  nonSortableColumnIndices = [],
}: {
  columns: string[];
  rows?: Array<Array<React.ReactNode>>;
  colors: any;
  emptyText: string;
  sortConfig?: SortConfig | null;
  onSortChange?: (index: number) => void;
  nonSortableColumnIndices?: number[];
}) {

  return (
    <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
            <th style={{ ...th(colors), width: 42 }}><input type="checkbox" style={{ accentColor: colors.primary }} /></th>
            {columns.map((column, columnIndex) => {
              const sortable = Boolean(onSortChange) && !nonSortableColumnIndices.includes(columnIndex);
              const active = sortConfig?.index === columnIndex;

              return (
                <th key={column} style={{ ...th(colors), minWidth: column.length >= 6 ? 132 : 108 }}>
                  {sortable ? (
                    <SortableHeaderButton
                      label={column}
                      active={active}
                      direction={active ? sortConfig?.direction : undefined}
                      colors={colors}
                      onClick={() => onSortChange?.(columnIndex)}
                    />
                  ) : (
                    column
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} style={{ padding: '96px 0 120px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                <EmptyState colors={colors} text={emptyText} />
              </td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}>
              <td style={{ ...td(colors), textAlign: 'center' }}><input type="checkbox" style={{ accentColor: colors.primary }} /></td>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={td(colors)}>{cellIndex === 0 || cellIndex === row.length - 2 ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: cell === '已通过' ? colors.badgeGreenBg : cell === '审批中' ? colors.badgeBlueBg : cell === '已拒绝' ? colors.badgeRedBg : colors.badgeGrayBg, color: cell === '已通过' ? colors.badgeGreenText : cell === '审批中' ? colors.badgeBlueText : cell === '已拒绝' ? colors.badgeRedText : colors.badgeGrayText }}>{cell}</span> : cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopTab({ label, active, onClick, colors }: { label: string; active: boolean; onClick: () => void; colors: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px 9px',
        fontSize: '13px',
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: active ? colors.primary : colors.text,
        borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function DropdownButton({
  label,
  items,
  open,
  onToggle,
  onClose,
  onSelect,
  colors,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
  colors: any;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onToggle} style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: open ? colors.primary : colors.text, borderColor: open ? colors.primary : colors.inputBorder, backgroundColor: open ? colors.badgeBlueBg : 'transparent' }}>
        {label}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 164, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 8, boxShadow: '0 12px 28px rgba(34, 48, 78, 0.14)', padding: '6px 0', zIndex: 20 }}>
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '9px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '12px', color: colors.text, borderTop: index === 0 ? 'none' : `1px solid ${colors.divider}33` }}
            >
              <span>{item.label}</span>
              {item.hint ? <span style={{ fontSize: '11px', color: colors.textMuted }}>{item.hint}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DateRangeField({ label, colors, width = 236, required = false, value, onChange }: { label: string; colors: any; width?: number; required?: boolean; value?: { start: string; end: string }; onChange?: (value: { start: string; end: string }) => void }) {
  const [innerValue, setInnerValue] = useState(monthRange());
  const current = value ?? innerValue;
  const setCurrent = (next: { start: string; end: string }) => onChange ? onChange(next) : setInnerValue(next);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>
        {required ? <span style={{ color: colors.primary, marginRight: 2 }}>*</span> : null}
        {label}
      </span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input type="date" value={current.start} onChange={e => setCurrent({ ...current, start: e.target.value })} style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input type="date" value={current.end} onChange={e => setCurrent({ ...current, end: e.target.value })} style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SearchField({ label, placeholder, colors, width = 170, showUserIcon = false, value, onChange }: { label: string; placeholder: string; colors: any; width?: number; showUserIcon?: boolean; value?: string; onChange?: (value: string) => void }) {
  const [innerValue, setInnerValue] = useState('');
  const current = value ?? innerValue;
  const setCurrent = (next: string) => onChange ? onChange(next) : setInnerValue(next);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input value={current} onChange={e => setCurrent(e.target.value)} placeholder={placeholder} style={textInput(colors)} />
        {showUserIcon ? <Users size={12} style={{ color: colors.textMuted }} /> : null}
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({ label, placeholder, colors, width = 140, options = [], value, onChange }: { label: string; placeholder: string; colors: any; width?: number; options?: string[]; value?: string; onChange?: (value: string) => void }) {
  const [innerValue, setInnerValue] = useState('');
  const current = value ?? innerValue;
  const setCurrent = (next: string) => onChange ? onChange(next) : setInnerValue(next);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <select value={current} onChange={e => setCurrent(e.target.value)} style={{ ...textInput(colors), color: current ? colors.text : colors.textMuted }}>
          <option value="">{placeholder}</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function CheckboxGroup({ label, items, colors }: { label: string; items: string[]; colors: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '12px', color: colors.text }}>{label}</span>
      {items.map((item, index) => (
        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
          <input type="checkbox" defaultChecked={index !== 1} style={{ accentColor: colors.primary }} />
          {item}
        </label>
      ))}
    </div>
  );
}

function TogglePill({ enabled }: { enabled?: boolean }) {
  return (
    <span style={{ width: 24, height: 14, borderRadius: 999, backgroundColor: enabled ? '#3A78FF' : '#C7CEDA', position: 'relative', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', left: enabled ? 12 : 2, top: 2, transition: 'all 0.2s' }} />
    </span>
  );
}

function EmptyState({ colors, text }: { colors: any; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: colors.statCardBg, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <FileText size={24} style={{ color: colors.textMuted }} />
        <span style={{ position: 'absolute', top: -7, right: -6, backgroundColor: '#3A78FF', color: '#fff', borderRadius: 9, fontSize: '10px', lineHeight: 1, padding: '4px 5px', fontWeight: 600 }}>...</span>
      </div>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>{text}</span>
    </div>
  );
}

const filterRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const actionRightStyle: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 };

function moreRowStyle(colors: any): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` };
}

function filterBar(colors: any): React.CSSProperties {
  return { padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 };
}

function toolbarStyle(colors: any): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, position: 'relative' };
}

function fieldShell(colors: any, width: number): React.CSSProperties {
  return { width, minHeight: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, boxSizing: 'border-box' };
}

function textInput(colors: any): React.CSSProperties {
  return { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: colors.text };
}

function dateInput(colors: any): React.CSSProperties {
  return { width: 96, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: colors.text };
}

function primaryBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: 'none', borderRadius: 4, backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' };
}

function outlineBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.text, fontSize: '12px', cursor: 'pointer' };
}

function disabledBtn(colors: any): React.CSSProperties {
  return { ...outlineBtn(colors), color: colors.textMuted, cursor: 'not-allowed', opacity: 0.55 };
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  backgroundColor: 'rgba(15, 23, 42, 0.38)',
};

function modalPanel(colors: any, width = 720): React.CSSProperties {
  return {
    width,
    maxWidth: 'calc(100vw - 48px)',
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 8,
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
    overflow: 'hidden',
  };
}

function modalHeader(colors: any): React.CSSProperties {
  return {
    minHeight: 52,
    padding: '10px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${colors.cardBorder}`,
    boxSizing: 'border-box',
  };
}

function modalFooter(colors: any): React.CSSProperties {
  return {
    padding: '12px 18px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    borderTop: `1px solid ${colors.cardBorder}`,
  };
}

function modalInput(colors: any): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 34,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    outline: 'none',
    padding: '0 10px',
    boxSizing: 'border-box',
  };
}

function ModalField({
  label,
  required,
  colors,
  children,
  full = false,
}: {
  label: string;
  required?: boolean;
  colors: any;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, color: colors.textMuted }}>
        {required ? <span style={{ color: colors.primary, marginRight: 2 }}>*</span> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

function toggleBtn(colors: any, active: boolean): React.CSSProperties {
  return { ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: active ? colors.primary : colors.text, borderColor: active ? colors.primary : colors.inputBorder, backgroundColor: active ? colors.badgeBlueBg : 'transparent' };
}

function iconBtn(colors: any): React.CSSProperties {
  return { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.textMuted, cursor: 'pointer' };
}

function linkBtn(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
}

function textActionBtn(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer', padding: 0, marginRight: 8 };
}

function th(colors: any): React.CSSProperties {
  return { padding: '10px 12px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', backgroundColor: colors.tableHeaderBg };
}

function td(colors: any): React.CSSProperties {
  return { padding: '9px 12px', fontSize: '12px', color: colors.text, borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', verticalAlign: 'top' };
}
