import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { deleteOnboardedEmployees, fetchHrCoreLookups, fetchSettingsCalendar, fetchSettingsCardRules, fetchSettingsFace, fetchSettingsFieldRules, fetchSettingsGroups, fetchSettingsHoliday, fetchSettingsLocation, fetchSettingsMobileClock, fetchSettingsOvertimeRules, fetchSettingsPeople, fetchSettingsShifts, fetchSettingsStatSchemes, onboardEmployee, saveSettingsCalendar, saveSettingsCardRules, saveSettingsFieldRules, saveSettingsGroups, saveSettingsHoliday, saveSettingsLocation, saveSettingsMobileClock, saveSettingsOvertimeRules, saveSettingsShifts, saveSettingsStatSchemes } from '../api/realData';
import { monthEndISO, monthStartISO, todayISO } from '../utils/date';
import { isRemovedSettingView } from '../shared/navigation/visibilityPolicy';
import { DomainLinkagePanel } from '../shared/domain/DomainLinkagePanel';
import { useAttendanceFilterDirectory } from '../shared/domain/attendanceFilters';
import { downloadAttendanceXlsx, textCell } from '../shared/export/attendanceExport';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  HelpCircle,
  Info,
  Plus,
  Search,
  Users,
} from 'lucide-react';

type SettingView =
  | 'overview'
  | 'groups'
  | 'shifts'
  | 'people'
  | 'card-rules'
  | 'mobile-clock'
  | 'location'
  | 'face'
  | 'devices'
  | 'holiday'
  | 'calendar'
  | 'overtime-rules'
  | 'field-rules'
  | 'stat-schemes';

type RouteTab = { key: SettingView; label: string; path: string };
type OverviewCard = { title: string; desc: string; extra: string; path: string; badge: string };
type TableSortConfig = { index: number; direction: 'asc' | 'desc' };
type ConfirmConfig = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

type ShiftOption = {
  id: string;
  name: string;
  time: string;
};

type ShiftDraft = {
  name: string;
  shortName: string;
  color: string;
  tag: string;
  season: string;
  clockInTime: string;
  clockOutTime: string;
  duration: string;
  attendGroup: string;
  creator: string;
  createdAt: string;
};

type GroupDraft = {
  name: string;
  type: string;
  scope: string;
  shiftName: string;
  creator: string;
  createdAt: string;
};

type CardRuleDraft = {
  name: string;
  content: string;
  attendGroup: string;
  creator: string;
  createdAt: string;
};

type MobileClockDraft = {
  name: string;
  content: string;
  attendGroup: string;
  creator: string;
  createdAt: string;
};

type LocationDraft = {
  name: string;
  attendGroup: string;
  gpsAddress: string;
  bluetooth: string;
  wifi: string;
  mobileScheme: string;
  creator: string;
  createdAt: string;
};

type HolidayDraft = {
  name: string;
  years: string;
  calendarName: string;
  creator: string;
  createdAt: string;
};

type CalendarDraft = {
  name: string;
  period: string;
  workdays: string;
  maxRule: string;
  attendGroup: string;
  creator: string;
  createdAt: string;
};

type OvertimeRuleDraft = {
  name: string;
  content: string;
  attendGroup: string;
  creator: string;
  createdAt: string;
};

type FieldRuleDraft = {
  name: string;
  content: string;
  attendGroup: string;
  creator: string;
  createdAt: string;
};

type StatSchemeDraft = {
  name: string;
  period: string;
  stopRule: string;
  scope: string;
  creator: string;
  createdAt: string;
};

type TableProps = {
  columns: string[];
  rows: React.ReactNode[][];
  colors: any;
  withSelection?: boolean;
  rowIds?: string[];
  selectedRowIds?: Set<string>;
  onToggleRow?: (rowId: string) => void;
  onToggleAll?: () => void;
  sortConfig?: TableSortConfig | null;
  onSortChange?: (index: number) => void;
  nonSortableColumnIndices?: number[];
  emptyText?: string;
  footerText?: string;
};

const ROUTE_TABS: RouteTab[] = [
  { key: 'groups', label: '考勤组管理', path: '/attendance/settings/groups' },
  { key: 'shifts', label: '班次管理', path: '/attendance/settings/shifts' },
  { key: 'people', label: '考勤人员', path: '/attendance/settings/people' },
  { key: 'card-rules', label: '打卡规则', path: '/attendance/settings/card-rules' },
  { key: 'face', label: '人脸管理', path: '/attendance/settings/face' },
  { key: 'calendar', label: '司历管理', path: '/attendance/settings/calendar' },
  { key: 'overtime-rules', label: '加班规则', path: '/attendance/settings/overtime-rules' },
  { key: 'field-rules', label: '外勤规则', path: '/attendance/settings/field-rules' },
  { key: 'stat-schemes', label: '统计方案', path: '/attendance/settings/stat-schemes' },
];

const OVERVIEW_CARDS: OverviewCard[] = [
  {
    title: '考勤组',
    desc: '考勤组用于设置打卡、加班、外勤、补卡、移动打卡和统计规则，不同人员可配置不同考勤方案。',
    extra: '共24个组',
    path: '/attendance/settings/groups',
    badge: '1',
  },
  {
    title: '假期类型',
    desc: '配置企业可使用的各类假期、请假单位、带薪规则和余额控制方式。',
    extra: '共16个类型',
    path: '/attendance/leave-type',
    badge: '2',
  },
  {
    title: '统计方案',
    desc: '可针对不同主体设置考勤统计的业务停止规则、统计周期和汇总口径。',
    extra: '共1个方案',
    path: '/attendance/settings/stat-schemes',
    badge: '4',
  },
];

const GROUP_COLUMNS = ['考勤组名称', '考勤类型', '适用范围', '出勤时间', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const SHIFT_COLUMNS = ['班次名称', '班次简称', '班次颜色', '标签', '冬夏令时', '出勤时间', '出勤时长', '适用考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const PEOPLE_COLUMNS = ['姓名', '员工号', '部门', '岗位', '入职日期', '班次', '考勤日期', '员工类型', '员工状态', '排休', '业务分组', '工作地', '考勤组', '统计方案', '操作'];
const CARD_RULE_COLUMNS = ['规则名称', '规则内容', '关联考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const MOBILE_COLUMNS = ['方案名称', '方案内容', '关联考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const LOCATION_COLUMNS = ['上班地点名称', '考勤组名称', 'GPS打卡地址', '打卡蓝牙', '打卡Wi-Fi', '关联移动打卡方案', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const FACE_COLUMNS = ['姓名', '员工号', '部门', '部门全路径', '考勤组', '入职日期', '录入状态', '审核状态', '反馈评分', '数据来源', '操作'];
const HOLIDAY_COLUMNS = ['方案名称', '已设置年份', '关联司历', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const CALENDAR_COLUMNS = ['方案名称', '考勤周期', '每周工作日', '包含最大天数规则', '适用考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const OVERTIME_RULE_COLUMNS = ['加班规则名称', '规则内容', '关联考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const FIELD_RULE_COLUMNS = ['规则名称', '规则内容', '关联考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const STAT_SCHEME_COLUMNS = ['方案名称', '考勤周期', '业务停止规则', '适用范围', '创建人', '创建时间', '修改人', '修改时间', '操作'];

function parseShiftTimeRange(value: unknown) {
  const text = String(value ?? '');
  if (text.includes('休息')) return { clockInTime: '', clockOutTime: '', time: '休息' };
  const match = text.match(/(\d{1,2}):(\d{2})\s*[-~—至]\s*(\d{1,2}):(\d{2})/);
  if (!match) return { clockInTime: '09:00', clockOutTime: '18:00', time: '09:00-18:00' };
  const clockInTime = `${match[1].padStart(2, '0')}:${match[2]}`;
  const clockOutTime = `${match[3].padStart(2, '0')}:${match[4]}`;
  return { clockInTime, clockOutTime, time: `${clockInTime}-${clockOutTime}` };
}

function shiftIdFromRow(row: string[]) {
  const name = String(row[0] ?? '');
  const { clockInTime, clockOutTime } = parseShiftTimeRange(row[5]);
  if (name === '休息') return 'shift_rest';
  const baseId = `shift_${clockInTime.replace(':', '')}_${clockOutTime.replace(':', '')}`;
  if (name === '早九晚六') return baseId;
  let hash = 0;
  for (const char of name) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return `${baseId}_${hash.toString(36)}`;
}

function shiftOptionsFromRows(rows: string[][]): ShiftOption[] {
  const seen = new Set<string>();
  return rows
    .filter(row => row[0])
    .map(row => {
      const id = shiftIdFromRow(row);
      return { id, name: String(row[0]), time: parseShiftTimeRange(row[5]).time };
    })
    .filter(option => {
      if (seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    });
}

function groupOptionsFromRows(rows: string[][]) {
  return uniqueOptions(rows, 0);
}

function emptyGroupDraft(sequence = 1, defaultShift = '早九晚六'): GroupDraft {
  return {
    name: `新建考勤组${sequence}`,
    type: '排班制',
    scope: '部门：待配置',
    shiftName: defaultShift,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function groupDraftFromRow(row: string[]): GroupDraft {
  return {
    name: String(row[0] ?? ''),
    type: String(row[1] ?? '排班制') || '排班制',
    scope: String(row[2] ?? '部门：待配置') || '部门：待配置',
    shiftName: String(row[3] ?? '早九晚六') || '早九晚六',
    creator: String(row[4] ?? '后台维护') || '后台维护',
    createdAt: String(row[5] ?? nowText()) || nowText(),
  };
}

function groupRowFromDraft(draft: GroupDraft, previousRow?: string[]) {
  const name = draft.name.trim();
  return [
    name,
    draft.type.trim() || '排班制',
    draft.scope.trim() || '部门：待配置',
    draft.shiftName.trim() || '早九晚六',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[5] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyCardRuleDraft(sequence = 1, defaultGroup = '默认考勤组'): CardRuleDraft {
  return {
    name: `新增打卡规则${sequence}`,
    content: '允许移动端与考勤机打卡',
    attendGroup: defaultGroup,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function cardRuleDraftFromRow(row: string[]): CardRuleDraft {
  return {
    name: String(row[0] ?? ''),
    content: String(row[1] ?? ''),
    attendGroup: String(row[2] ?? '默认考勤组') || '默认考勤组',
    creator: String(row[3] ?? '后台维护') || '后台维护',
    createdAt: String(row[4] ?? nowText()) || nowText(),
  };
}

function cardRuleRowFromDraft(draft: CardRuleDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.content.trim() || '-',
    draft.attendGroup.trim() || '默认考勤组',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[4] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function mobileSchemeOptionsFromRows(rows: string[][]) {
  return uniqueOptions(rows, 0);
}

function emptyMobileClockDraft(sequence = 1, defaultGroup = '默认考勤组'): MobileClockDraft {
  return {
    name: `移动打卡方案${sequence}`,
    content: 'GPS/Wi-Fi/蓝牙均可打卡',
    attendGroup: defaultGroup,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function mobileClockDraftFromRow(row: string[]): MobileClockDraft {
  return {
    name: String(row[0] ?? ''),
    content: String(row[1] ?? ''),
    attendGroup: String(row[2] ?? '默认考勤组') || '默认考勤组',
    creator: String(row[3] ?? '后台维护') || '后台维护',
    createdAt: String(row[4] ?? nowText()) || nowText(),
  };
}

function mobileClockRowFromDraft(draft: MobileClockDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.content.trim() || '-',
    draft.attendGroup.trim() || '默认考勤组',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[4] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyLocationDraft(sequence = 1, defaultGroup = '默认考勤组', defaultMobileScheme = '未关联移动打卡方案'): LocationDraft {
  return {
    name: `上班地点${sequence}`,
    attendGroup: defaultGroup,
    gpsAddress: '上海市静安区南京西路',
    bluetooth: '蓝牙-A1',
    wifi: 'Office-WiFi',
    mobileScheme: defaultMobileScheme,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function locationDraftFromRow(row: string[]): LocationDraft {
  return {
    name: String(row[0] ?? ''),
    attendGroup: String(row[1] ?? '默认考勤组') || '默认考勤组',
    gpsAddress: String(row[2] ?? ''),
    bluetooth: String(row[3] ?? ''),
    wifi: String(row[4] ?? ''),
    mobileScheme: String(row[5] ?? '未关联移动打卡方案') || '未关联移动打卡方案',
    creator: String(row[6] ?? '后台维护') || '后台维护',
    createdAt: String(row[7] ?? nowText()) || nowText(),
  };
}

function locationRowFromDraft(draft: LocationDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.attendGroup.trim() || '默认考勤组',
    draft.gpsAddress.trim() || '-',
    draft.bluetooth.trim() || '-',
    draft.wifi.trim() || '-',
    draft.mobileScheme.trim() || '未关联移动打卡方案',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[7] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function calendarOptionsFromRows(rows: string[][]) {
  return uniqueOptions(rows, 0);
}

function emptyHolidayDraft(sequence = 1, defaultCalendar = '双休'): HolidayDraft {
  return {
    name: `节假日方案${sequence}`,
    years: String(new Date().getFullYear()),
    calendarName: defaultCalendar,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function holidayDraftFromRow(row: string[]): HolidayDraft {
  return {
    name: String(row[0] ?? ''),
    years: String(row[1] ?? String(new Date().getFullYear())) || String(new Date().getFullYear()),
    calendarName: String(row[2] ?? '双休') || '双休',
    creator: String(row[3] ?? '后台维护') || '后台维护',
    createdAt: String(row[4] ?? nowText()) || nowText(),
  };
}

function holidayRowFromDraft(draft: HolidayDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.years.trim() || String(new Date().getFullYear()),
    draft.calendarName.trim() || '双休',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[4] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyCalendarDraft(sequence = 1, defaultGroup = '默认考勤组'): CalendarDraft {
  return {
    name: `司历方案${sequence}`,
    period: '当月1日至当月最后一天为【当月】的考勤周期',
    workdays: '周一、周二、周三、周四、周五',
    maxRule: '工作日之和为应出勤天数',
    attendGroup: defaultGroup,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function calendarDraftFromRow(row: string[]): CalendarDraft {
  return {
    name: String(row[0] ?? ''),
    period: String(row[1] ?? '当月1日至当月最后一天为【当月】的考勤周期') || '当月1日至当月最后一天为【当月】的考勤周期',
    workdays: String(row[2] ?? '周一、周二、周三、周四、周五') || '周一、周二、周三、周四、周五',
    maxRule: String(row[3] ?? '工作日之和为应出勤天数') || '工作日之和为应出勤天数',
    attendGroup: String(row[4] ?? '默认考勤组') || '默认考勤组',
    creator: String(row[5] ?? '后台维护') || '后台维护',
    createdAt: String(row[6] ?? nowText()) || nowText(),
  };
}

function calendarRowFromDraft(draft: CalendarDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.period.trim() || '当月1日至当月最后一天为【当月】的考勤周期',
    draft.workdays.trim() || '周一、周二、周三、周四、周五',
    draft.maxRule.trim() || '工作日之和为应出勤天数',
    draft.attendGroup.trim() || '默认考勤组',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[6] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyOvertimeRuleDraft(sequence = 1, defaultGroup = '默认考勤组'): OvertimeRuleDraft {
  return {
    name: `加班规则${sequence}`,
    content: '工作日：仅统计时长 / 休息日：折算为调休 / 节假日：按节假日加班核算',
    attendGroup: defaultGroup,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function overtimeRuleDraftFromRow(row: string[]): OvertimeRuleDraft {
  return {
    name: String(row[0] ?? ''),
    content: String(row[1] ?? '工作日/休息日/节假日均按默认口径核算') || '工作日/休息日/节假日均按默认口径核算',
    attendGroup: String(row[2] ?? '默认考勤组') || '默认考勤组',
    creator: String(row[3] ?? '后台维护') || '后台维护',
    createdAt: String(row[4] ?? nowText()) || nowText(),
  };
}

function overtimeRuleRowFromDraft(draft: OvertimeRuleDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.content.trim() || '工作日/休息日/节假日均按默认口径核算',
    draft.attendGroup.trim() || '默认考勤组',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[4] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyFieldRuleDraft(sequence = 1, defaultGroup = '默认考勤组'): FieldRuleDraft {
  return {
    name: `外勤规则${sequence}`,
    content: '外勤打卡已启用 / 外出申请已启用',
    attendGroup: defaultGroup,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function fieldRuleDraftFromRow(row: string[]): FieldRuleDraft {
  return {
    name: String(row[0] ?? ''),
    content: String(row[1] ?? '外勤打卡已启用 / 外出申请已启用') || '外勤打卡已启用 / 外出申请已启用',
    attendGroup: String(row[2] ?? '默认考勤组') || '默认考勤组',
    creator: String(row[3] ?? '后台维护') || '后台维护',
    createdAt: String(row[4] ?? nowText()) || nowText(),
  };
}

function fieldRuleRowFromDraft(draft: FieldRuleDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.content.trim() || '外勤打卡已启用 / 外出申请已启用',
    draft.attendGroup.trim() || '默认考勤组',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[4] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyStatSchemeDraft(sequence = 1, defaultScope = '默认考勤组'): StatSchemeDraft {
  return {
    name: `统计方案${sequence}`,
    period: '当月1日至当月最后一天为【当月】的一个考勤统计周期',
    stopRule: '部门：待配置',
    scope: defaultScope,
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function statSchemeDraftFromRow(row: string[]): StatSchemeDraft {
  return {
    name: String(row[0] ?? ''),
    period: String(row[1] ?? '当月1日至当月最后一天为【当月】的一个考勤统计周期') || '当月1日至当月最后一天为【当月】的一个考勤统计周期',
    stopRule: String(row[2] ?? '部门：待配置') || '部门：待配置',
    scope: String(row[3] ?? '默认考勤组') || '默认考勤组',
    creator: String(row[4] ?? '后台维护') || '后台维护',
    createdAt: String(row[5] ?? nowText()) || nowText(),
  };
}

function statSchemeRowFromDraft(draft: StatSchemeDraft, previousRow?: string[]) {
  return [
    draft.name.trim(),
    draft.period.trim() || '当月1日至当月最后一天为【当月】的一个考勤统计周期',
    draft.stopRule.trim() || '部门：待配置',
    draft.scope.trim() || '默认考勤组',
    draft.creator.trim() || '后台维护',
    draft.createdAt.trim() || previousRow?.[5] || nowText(),
    '后台维护',
    nowText(),
  ];
}

function emptyShiftDraft(sequence = 1): ShiftDraft {
  return {
    name: `新建班次${sequence}`,
    shortName: `新建班次${sequence}`,
    color: '#B53A2A',
    tag: '-',
    season: '通用',
    clockInTime: '09:00',
    clockOutTime: '18:00',
    duration: '8小时',
    attendGroup: '通用',
    creator: '后台维护',
    createdAt: nowText(),
  };
}

function shiftDraftFromRow(row: string[]): ShiftDraft {
  const parsedTime = parseShiftTimeRange(row[5]);
  return {
    name: String(row[0] ?? ''),
    shortName: String(row[1] ?? ''),
    color: /^#[0-9a-f]{6}$/i.test(String(row[2] ?? '')) ? String(row[2]) : '#B53A2A',
    tag: String(row[3] ?? '-') || '-',
    season: String(row[4] ?? '通用') || '通用',
    clockInTime: parsedTime.clockInTime || '09:00',
    clockOutTime: parsedTime.clockOutTime || '18:00',
    duration: String(row[6] ?? '8小时') || '8小时',
    attendGroup: String(row[7] ?? '通用') || '通用',
    creator: String(row[8] ?? '后台维护') || '后台维护',
    createdAt: String(row[9] ?? nowText()) || nowText(),
  };
}

function shiftRowFromDraft(draft: ShiftDraft, previousRow?: string[]) {
  const name = draft.name.trim();
  const shortName = draft.shortName.trim() || name.slice(0, 8);
  const color = /^#[0-9a-f]{6}$/i.test(draft.color.trim()) ? draft.color.trim() : '#B53A2A';
  const tag = draft.tag.trim() || '-';
  const season = draft.season.trim() || '通用';
  const clockInTime = draft.clockInTime.trim() || '09:00';
  const clockOutTime = draft.clockOutTime.trim() || '18:00';
  const duration = draft.duration.trim() || inferShiftDuration(clockInTime, clockOutTime);
  const attendGroup = draft.attendGroup.trim() || '通用';
  const creator = draft.creator.trim() || '后台维护';
  const createdAt = draft.createdAt.trim() || previousRow?.[9] || nowText();
  return [
    name,
    shortName,
    color,
    tag,
    season,
    `${clockInTime}-${clockOutTime}(正常出勤)`,
    duration,
    attendGroup,
    creator,
    createdAt,
    '后台维护',
    nowText(),
  ];
}

function inferShiftDuration(clockInTime: string, clockOutTime: string) {
  const [inHour, inMinute] = clockInTime.split(':').map(Number);
  const [outHour, outMinute] = clockOutTime.split(':').map(Number);
  if (![inHour, inMinute, outHour, outMinute].every(Number.isFinite)) return '8小时';
  let minutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
  if (minutes <= 0) minutes += 24 * 60;
  if (minutes >= 60 * 6) minutes -= 60;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}小时${restMinutes}分钟` : `${hours}小时`;
}

const GROUP_ROWS = [
  ['冲床组', '排班制', '部门：冲压车间', '早十晚六 / 早十午六', '何山', '2025-08-28 11:10:29', '棠乐', '2026-04-22 14:55:09'],
  ['装配工序', '排班制', '部门：装配工序', '早八晚六', '何山', '2025-08-28 11:15:12', '棠乐', '2026-04-22 14:54:27'],
  ['项目门店', '排班制', '部门：项目门店', '早一晚九', '何山', '2025-08-28 11:18:10', '棠乐', '2026-04-22 14:53:47'],
  ['直营门店', '排班制', '部门：直营门店', '早九晚六 / 早十晚七', '何山', '2025-08-28 11:09:27', '棠乐', '2026-04-22 14:52:54'],
];

const SHIFT_ROWS = [
  ['早七点半到五点半', '7.5-5.5', '通用', '●', '通用', '07:30-17:30(正常出勤)', '9小时', '棠乐', '2026-04-20 14:55:50', '棠乐', '2026-04-21 16:11'],
  ['早八点半到五点半', '8.5-5.5', '通用', '●', '通用', '08:30-17:30(正常出勤)', '8小时', '棠乐', '2026-04-20 15:00:36', '棠乐', '2026-04-21 16:20'],
  ['早十点半到六点半', '10.5-6.5', '通用', '●', '通用', '10:30-18:30(正常出勤)', '8小时', '棠乐', '2025-08-28 10:21:18', '棠乐', '2026-04-21 16:28'],
  ['早九点半到六点', '9.5-6', '通用', '●', '通用', '09:30-18:00(正常出勤)', '8小时30分钟', '何山', '2025-08-28 10:22:03', '何山', '2026-04-21 16:36'],
  ['早九点到五点', '9-5', '通用', '●', '通用', '09:00-17:00(正常出勤)', '8小时', '何山', '2025-08-28 10:23:08', '何山', '2026-04-21 16:46'],
];

const PEOPLE_ROWS = [];

const CARD_RULE_ROWS = [
  ['无规则打卡', '无规则打卡', '无规则打卡', '棠乐', '2026-04-15 09:54:58', '棠乐', '2026-04-15 09:54:58'],
  ['迟到打卡规则', '禁止工出勤在9小时内发起迟到流程', '家和里 / 项目门店 / 冲压车间', '棠乐', '2026-04-15 09:45:40', '棠乐', '2026-04-15 09:45:40'],
];

const LOCATION_ROWS: string[][] = [];
const MOBILE_ROWS: string[][] = [];

const FACE_ROWS = [];

const HOLIDAY_ROWS: string[][] = [];

const CALENDAR_ROWS = [
  ['周连班', '当月1日至当月最后一天为【当月】的考勤周期', '周一、周二、周三、周四、周五、周六、周日', '工作日之和为应出勤天数', '华北大区 / 荥州十月直营中心 / 庐山直营', '棠乐', '2026-04-15 09:47:51', '棠乐', '2026-04-15 09:47:52'],
  ['双休', '当月1日至当月最后一天为【当月】的考勤周期', '周一、周二、周三、周四、周五', '工作日之和为应出勤天数', '华北大区 / 项目门店 / 直营门店', '何山', '2025-08-28 09:37:47', '何山', '2025-08-28 09:37:48'],
];

const OVERTIME_RULE_ROWS = [
  ['仅计时长', '工作日：仅统计时长 / 休息日：仅统计时长 / 节假日：仅统计时长', '直营门店 / 经济YOUNG', '棠乐', '2026-04-21 10:37:42', '棠乐', '2026-04-21 10:37:42'],
  ['调休', '工作日：折算为调休 / 休息日：折算为调休 / 节假日：折算为调休', '家和里 / 庐山 / 项目门店', '棠乐', '2026-04-15 09:59:04', '棠乐', '2026-04-15 09:59:04'],
];

const FIELD_RULE_ROWS = [
  ['外勤', '外勤打卡已启用 / 外出申请已启用', '默认考勤组', '棠乐', '2026-04-02 10:26:42', '棠乐', '2026-04-02 10:26:42'],
];

const STAT_SCHEME_ROWS = [
  ['默认方案', '当月1日至当月最后一天为【当月】的一个考勤统计周期', '部门：上海拉蜜克有限公司', '部门：上海拉蜜克有限公司', '棠乐', '2026-04-15 09:46:15', '棠乐', '2026-04-15 09:46:15'],
];

const DEVICE_BRANDS = [
  { name: 'ZKTeco中控', desc: '支持多种常见机型品牌，可通过考勤机连接器完成设备接入与管理。' },
  { name: '海康威视', desc: '支持海康品牌设备的统一接入，可通过考勤机管理同步设备信息。' },
  { name: '得力', desc: '得力设备支持基础打卡管理，员工可通过统一入口完成打卡同步。' },
  { name: '恩点科技', desc: '支持其它第三方品牌设备的管理，适用于门禁或配套设备接入。' },
];

const DEVICE_MODELS = {
  'ZKTeco中控': ['Xface50/50P机型模板', 'Xface60P机型模板', 'iFace1020P机型模板', 'ZF500机型模板', 'iClock500机型模板'],
  '海康威视': ['Xface100P机型模板', 'UF100PLUS考勤机模板', 'iClock660考勤机模板'],
  '得力': ['Xface30P机型模板', 'iFace702考勤机模板', 'UIO考勤机模板'],
  '恩点科技': ['Xface600P机型模板', 'Vista810考勤机模板', 'UI60考勤机模板'],
};

const ONBOARD_DEPARTMENTS = [
  '新人培训组',
  '产品研发中心',
  '产品运营部',
  '研发设计一部',
  '研发设计二部',
  '工艺开发部',
  '技术支持部',
  '直营样品组',
  '综合人员',
];

const ONBOARD_ATTEND_GROUPS = ['华托大厦', '综合考勤组', '研发中心考勤组', '工艺部考勤组'];
const ONBOARD_FACE_STATUSES = ['已录入', '未录入'];

const DEPT_FULL_PATH_BY_NAME: Record<string, string> = {
  新人培训组: '上海拉迷家具有限公司/上海直营管理中心/运营管理部/运营赋能组/新人培训组',
  产品研发中心: '上海拉迷家具有限公司/产品研发中心',
  产品运营部: '上海拉迷家具有限公司/产品研发中心/产品运营部',
  研发设计一部: '上海拉迷家具有限公司/产品研发中心/研发设计一部',
  研发设计二部: '上海拉迷家具有限公司/产品研发中心/研发设计二部',
  工艺开发部: '上海拉迷家具有限公司/产品研发中心/工艺开发部',
  技术支持部: '上海拉迷家具有限公司/产品研发中心/技术支持部',
  直营样品组: '上海拉迷家具有限公司/产品研发中心/直营样品组',
  综合人员: '上海拉迷家具有限公司/综合人员',
};

type HrLookupOption = {
  code: string;
  name: string;
  fullPath?: string;
  status?: string;
  sequence?: string;
  subSequence?: string;
};

const LEGACY_ALIAS: Record<string, SettingView> = {
  rules: 'shifts',
  card: 'card-rules',
  review: 'devices',
};

export default function AttendanceSettings() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState<Record<string, boolean>>({});
  const [enterpriseSwitches, setEnterpriseSwitches] = useState({
    attendancePublish: false,
    globalRule: true,
    fixedOvertime: false,
  });
  const [shiftRows, setShiftRows] = useState<string[][]>([]);
  const [groupRows, setGroupRows] = useState<string[][]>([]);
  const [cardRuleRows, setCardRuleRows] = useState<string[][]>([]);
  const [mobileClockRows, setMobileClockRows] = useState<string[][]>([]);
  const [locationRows, setLocationRows] = useState<string[][]>([]);
  const [holidayRows, setHolidayRows] = useState<string[][]>([]);
  const [calendarRows, setCalendarRows] = useState<string[][]>([]);
  const [overtimeRuleRows, setOvertimeRuleRows] = useState<string[][]>([]);
  const [fieldRuleRows, setFieldRuleRows] = useState<string[][]>([]);
  const [statSchemeRows, setStatSchemeRows] = useState<string[][]>([]);
  const [peopleRows, setPeopleRows] = useState<string[][]>([]);
  const [faceRows, setFaceRows] = useState<string[][]>([]);
  const [sourceInfo, setSourceInfo] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadSettingsData = useCallback(async () => {
    try {
      const [shifts, groups, cardRules, mobileClock, settingsLocation, holiday, settingsCalendar, overtimeRules, fieldRules, statSchemes, people, face] = await Promise.all([
        fetchSettingsShifts(),
        fetchSettingsGroups(),
        fetchSettingsCardRules(),
        fetchSettingsMobileClock(),
        fetchSettingsLocation(),
        fetchSettingsHoliday(),
        fetchSettingsCalendar(),
        fetchSettingsOvertimeRules(),
        fetchSettingsFieldRules(),
        fetchSettingsStatSchemes(),
        fetchSettingsPeople(),
        fetchSettingsFace(),
      ]);
      setShiftRows(shifts.rows || []);
      setGroupRows(groups.rows || []);
      setCardRuleRows(cardRules.rows || []);
      setMobileClockRows(mobileClock.rows || []);
      setLocationRows(settingsLocation.rows || []);
      setHolidayRows(holiday.rows || []);
      setCalendarRows(settingsCalendar.rows || []);
      setOvertimeRuleRows(overtimeRules.rows || []);
      setFieldRuleRows(fieldRules.rows || []);
      setStatSchemeRows(statSchemes.rows || []);
      setPeopleRows(people.rows || []);
      setFaceRows(face.rows || []);
      setSourceInfo(`考勤组：${groups.sourceFile}；班次：${shifts.sourceFile}；打卡规则：${cardRules.sourceFile}；移动打卡：${mobileClock.sourceFile}；上班地点：${settingsLocation.sourceFile}；节假日：${holiday.sourceFile}；司历：${settingsCalendar.sourceFile}；加班规则：${overtimeRules.sourceFile}；外勤规则：${fieldRules.sourceFile}；统计方案：${statSchemes.sourceFile}；人员：${people.sourceFile}；人脸：${face.sourceFile}`);
      setLoadError('');
    } catch (_error) {
      setLoadError('真实设置数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const activeView = useMemo<SettingView>(() => {
    if (location.pathname === '/attendance/settings') return 'groups';
    const sub = location.pathname.split('/').pop() ?? '';
    const view = LEGACY_ALIAS[sub] ?? ROUTE_TABS.find(tab => tab.path === location.pathname)?.key;
    return view && !isRemovedSettingView(view) ? view : 'groups';
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/attendance/settings/groups' && activeView === 'groups') {
      navigate('/attendance/settings/groups', { replace: true });
    }
  }, [activeView, location.pathname, navigate]);
  const shiftOptions = useMemo(() => shiftOptionsFromRows(shiftRows), [shiftRows]);
  const groupOptions = useMemo(() => groupOptionsFromRows(groupRows), [groupRows]);
  const mobileSchemeOptions = useMemo(() => mobileSchemeOptionsFromRows(mobileClockRows), [mobileClockRows]);
  const calendarOptions = useMemo(() => calendarOptionsFromRows(calendarRows), [calendarRows]);

  const toggleMore = (key: string) => setShowMore(prev => ({ ...prev, [key]: !prev[key] }));
  const openTab = (view: SettingView) => {
    const tab = ROUTE_TABS.find(item => item.key === view);
    if (tab) navigate(tab.path);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', minHeight: 40, overflowX: 'auto', flexShrink: 0 }}>
        <TopTab label="首页" active={false} onClick={() => navigate('/attendance/home')} colors={colors} />
        {ROUTE_TABS.map(tab => (
          <TopTab key={tab.key} label={tab.label} active={activeView === tab.key} onClick={() => navigate(tab.path)} colors={colors} />
        ))}
        <button onClick={() => navigate('/attendance/settings/groups')} title="返回考勤组管理" style={{ marginLeft: 4, padding: '2px 10px', fontSize: '12px', border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: 'pointer', background: 'transparent', color: colors.textMuted, flexShrink: 0 }}>×</button>
      </div>

      <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
        <DomainLinkagePanel focus="attendance" />
      </div>

      {activeView === 'overview' && (
        <OverviewView
          colors={colors}
          switches={enterpriseSwitches}
          onToggle={key => setEnterpriseSwitches(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
          onOpen={openTab}
          onOpenPath={path => navigate(path)}
        />
      )}
      {activeView === 'groups' && <GroupsView
        colors={colors}
        showMore={!!showMore.groups}
        onToggleMore={() => toggleMore('groups')}
        groupRows={groupRows}
        shiftOptions={shiftOptions}
        peopleRows={peopleRows}
        onGroupRowsChange={setGroupRows}
        sourceInfo={sourceInfo}
        loadError={loadError}
      />}
      {activeView === 'shifts' && <ShiftsView colors={colors} showMore={!!showMore.shifts} onToggleMore={() => toggleMore('shifts')} shiftRows={shiftRows} groupOptions={groupOptions} onShiftRowsChange={setShiftRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'people' && <PeopleView colors={colors} showMore={!!showMore.people} onToggleMore={() => toggleMore('people')} peopleRows={peopleRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'card-rules' && <CardRulesView colors={colors} cardRuleRows={cardRuleRows} groupOptions={groupOptions} onCardRuleRowsChange={setCardRuleRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'mobile-clock' && <MobileClockView colors={colors} mobileClockRows={mobileClockRows} groupOptions={groupOptions} onMobileClockRowsChange={setMobileClockRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'location' && <LocationView colors={colors} showMore={!!showMore.location} onToggleMore={() => toggleMore('location')} locationRows={locationRows} groupOptions={groupOptions} mobileSchemeOptions={mobileSchemeOptions} onLocationRowsChange={setLocationRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'face' && <FaceView
        colors={colors}
        showMore={!!showMore.face}
        onToggleMore={() => toggleMore('face')}
        faceRows={faceRows}
        shiftOptions={shiftOptions}
        groupOptions={groupOptions}
        sourceInfo={sourceInfo}
        loadError={loadError}
        onEmployeeCreated={(peopleRow, faceRow) => {
          setPeopleRows(current => [peopleRow, ...current.filter(row => row[1] !== peopleRow[1])]);
          setFaceRows(current => [faceRow, ...current.filter(row => row[1] !== faceRow[1])]);
          setSourceInfo('员工主数据 + 人脸管理 + 考勤人员');
        }}
        onEmployeeDeleted={(employeeNos) => {
          const employeeNoSet = new Set(employeeNos);
          setPeopleRows(current => current.filter(row => !employeeNoSet.has(String(row[1] ?? ''))));
          setFaceRows(current => current.filter(row => !employeeNoSet.has(String(row[1] ?? ''))));
          setSourceInfo('员工主数据 + 人脸管理 + 考勤人员已同步删除');
        }}
      />}
      {activeView === 'devices' && <DevicesView colors={colors} />}
      {activeView === 'holiday' && <HolidayView colors={colors} holidayRows={holidayRows} calendarOptions={calendarOptions} onHolidayRowsChange={setHolidayRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'calendar' && <CalendarView colors={colors} calendarRows={calendarRows} groupOptions={groupOptions} onCalendarRowsChange={setCalendarRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'overtime-rules' && <OvertimeRulesView colors={colors} overtimeRuleRows={overtimeRuleRows} groupOptions={groupOptions} onOvertimeRuleRowsChange={setOvertimeRuleRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'field-rules' && <FieldRulesView colors={colors} fieldRuleRows={fieldRuleRows} groupOptions={groupOptions} onFieldRuleRowsChange={setFieldRuleRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'stat-schemes' && <StatSchemesView colors={colors} statSchemeRows={statSchemeRows} groupOptions={groupOptions} onStatSchemeRowsChange={setStatSchemeRows} sourceInfo={sourceInfo} loadError={loadError} />}
    </div>
  );
}

function OverviewView({
  colors,
  switches,
  onToggle,
  onOpen,
  onOpenPath,
}: {
  colors: any;
  switches: { attendancePublish: boolean; globalRule: boolean; fixedOvertime: boolean };
  onToggle: (key: string) => void;
  onOpen: (view: SettingView) => void;
  onOpenPath: (path: string) => void;
}) {
  const [periodRows, setPeriodRows] = useState([
    {
      period: '当月1日至当月最后一天为【当月】的考勤统计周期',
      calendars: '双休、两连班',
      scheme: '默认方案',
    },
  ]);
  const [skipOverview, setSkipOverview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  const addPeriod = () => {
    setPeriodRows(current => [
      ...current,
      {
        period: `新增考勤周期${current.length + 1}：每月1日至月末`,
        calendars: '双休',
        scheme: '默认方案',
      },
    ]);
  };

  const editPeriod = (index: number) => {
    const current = periodRows[index];
    const nextName = window.prompt('请输入考勤周期名称', current?.period ?? '');
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setPeriodRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, period: trimmed } : row));
  };

  const deletePeriod = (index: number) => {
    setConfirmDelete({
      title: '删除考勤周期',
      message: '确认删除该考勤周期？删除后当前总览中的周期配置会移除。',
      onConfirm: () => {
        setPeriodRows(rows => rows.filter((_, rowIndex) => rowIndex !== index));
        setConfirmDelete(null);
      },
    });
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 24px' }}>
      <div style={{ background: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.16)} 0%, ${withAlpha(colors.primary, 0.08)} 66%, ${withAlpha(colors.primary, 0.12)} 100%)`, border: `1px solid ${withAlpha(colors.primary, 0.16)}`, borderRadius: 12, padding: '18px 20px 22px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, top: -10, width: 160, height: 120, background: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.24)}, ${withAlpha(colors.primary, 0.04)})`, transform: 'skewX(-24deg)', borderRadius: 18 }} />
        <div style={{ position: 'absolute', right: 36, top: 4, width: 86, height: 86, borderRadius: 18, background: withAlpha(colors.primary, 0.14), transform: 'rotate(45deg)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: colors.text, marginBottom: 18 }}>假勤配置总览</div>
          <SectionCard title="统计周期" colors={colors}>
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: 8, border: `1px solid ${colors.tableBorder}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.tableHeaderBg }}>
                    {['考勤周期', '已关联司历', '已关联统计方案', '操作'].map(head => (
                      <th key={head} style={th(colors)}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodRows.map((row, index) => (
                    <tr key={`${row.period}-${index}`}>
                      <td style={td(colors)}>{row.period}</td>
                      <td style={td(colors)}><button onClick={() => onOpen('calendar')} style={textLink(colors)}>{row.calendars}</button></td>
                      <td style={td(colors)}><button onClick={() => onOpen('stat-schemes')} style={textLink(colors)}>{row.scheme}</button></td>
                      <td style={td(colors)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => editPeriod(index)} style={textLink(colors)}>修改</button>
                          <button onClick={() => deletePeriod(index)} style={textLink(colors)}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ paddingTop: 10 }}>
              <button onClick={addPeriod} style={linkBtn(colors)}>
                <Plus size={13} />
                添加考勤周期
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="考勤组、假期和统计管理" colors={colors}>
        {OVERVIEW_CARDS.map(card => (
          <div key={card.title} onClick={() => onOpenPath(card.path)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: `1px solid ${colors.tableBorder}`, cursor: 'pointer' }}>
            <div style={{ width: 18, color: colors.primary, fontWeight: 700, flexShrink: 0 }}>{card.badge}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: colors.text, fontWeight: 600, marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: '12px', color: colors.textMuted }}>{card.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.textMuted, fontSize: '12px', flexShrink: 0 }}>
              <span>{card.extra}</span>
              <ChevronRight size={13} />
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="企业设置" colors={colors}>
        <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', backgroundColor: colors.tableHeaderBg, fontSize: '12px', fontWeight: 600, color: colors.text }}>企业基础规则</div>
          {[
            { key: 'attendancePublish', label: '考勤发布', desc: '' },
            { key: 'globalRule', label: '全局规则', desc: '若出现以下情况不允许补卡：迟到、早退或未下班打卡。' },
            { key: 'fixedOvertime', label: '固定加班规则', desc: '' },
          ].map((item, index) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', borderTop: index === 0 ? 'none' : `1px solid ${colors.tableBorder}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', color: colors.text, fontWeight: 500 }}>
                  {item.label}
                  <Info size={13} style={{ color: colors.textMuted }} />
                </div>
                {item.desc ? <div style={{ marginTop: 4, fontSize: '12px', color: colors.textMuted }}>{item.desc} <button onClick={() => onOpen(item.key === 'fixedOvertime' ? 'overtime-rules' : 'card-rules')} style={textLink(colors)}>去设置</button></div> : null}
              </div>
              <ToggleSwitch checked={switches[item.key as keyof typeof switches]} onClick={() => onToggle(item.key)} colors={colors} />
            </div>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '12px', color: colors.textMuted }}>
          <input type="checkbox" checked={skipOverview} onChange={event => setSkipOverview(event.target.checked)} style={{ accentColor: colors.primary }} />
          我已完成配置，下次不再默认进入本页面
        </label>
      </SectionCard>
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </div>
  );
}

function GroupsView({
  colors,
  showMore,
  onToggleMore,
  groupRows,
  shiftOptions,
  peopleRows,
  onGroupRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  groupRows: string[][];
  shiftOptions: ShiftOption[];
  peopleRows: string[][];
  onGroupRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const navigate = useNavigate();
  const [rowsData, setRowsData] = useState<string[][]>(groupRows);
  const [draftFilters, setDraftFilters] = useState({ name: '', types: ['排班制'] });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [peopleMode, setPeopleMode] = useState<'schedule' | 'shift'>('schedule');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft>(() => emptyGroupDraft(groupRows.length + 1, shiftOptions[0]?.name || '早九晚六'));
  const effectiveShiftOptions = shiftOptions.length ? shiftOptions : [{ id: 'shift_0900_1800', name: '早九晚六', time: '09:00-18:00' }];

  useEffect(() => {
    setRowsData(groupRows);
  }, [groupRows]);

  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onGroupRowsChange(next);
      void saveSettingsGroups(next).catch(() => window.alert('考勤组已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    const nameKeyword = draftFilters.name.trim().toLowerCase();
    return rowsData.filter(row => {
      const matchName = !nameKeyword || String(row[0] ?? '').toLowerCase().includes(nameKeyword);
      const matchType = !draftFilters.types.length || draftFilters.types.includes(String(row[1] ?? ''));
      const matchMode = peopleMode === 'schedule' || peopleRows.some(person => String(person[12] ?? '') === String(row[0] ?? ''));
      return matchName && matchType && matchMode;
    });
  }, [draftFilters, peopleMode, peopleRows, rowsData]);

  const resetFilters = () => {
    const next = { name: '', types: ['排班制'] };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupDraft(emptyGroupDraft(rowsData.length + 1, effectiveShiftOptions[0]?.name || '早九晚六'));
    setShowGroupModal(true);
  };

  const updateGroupDraft = (key: keyof GroupDraft, value: string) => {
    setGroupDraft(current => ({ ...current, [key]: value }));
  };

  const saveGroupDraft = () => {
    if (!groupDraft.name.trim()) {
      window.alert('考勤组名称不能为空');
      return;
    }
    commitRows(current => {
      if (!editingGroupId) return [groupRowFromDraft(groupDraft), ...current];
      return current.map(row => createRowId(row) === editingGroupId ? groupRowFromDraft(groupDraft, row) : row);
    });
    setShowGroupModal(false);
    setEditingGroupId(null);
  };

  const importGroups = () => {
    commitRows(current => [
      [`导入考勤组${current.length + 1}`, '排班制', '部门：导入组织', '早十晚七', '导入', nowText(), '导入', nowText()],
      ...current,
    ]);
  };

  const handleAction = (label: string, row: string[]) => {
    const rowId = createRowId(row);
    if (label === '修改') {
      setEditingGroupId(rowId);
      setGroupDraft(groupDraftFromRow(row));
      setShowGroupModal(true);
      return;
    }
    if (label === '排班') {
      const groupName = String(row[0] ?? '').trim();
      const shiftName = String(row[3] ?? '').trim();
      const scopeText = String(row[2] ?? '').trim();
      const params = new URLSearchParams();
      if (groupName) params.set('attendanceGroup', groupName);
      if (shiftName) params.set('shift', shiftName);
      if (scopeText) params.set('scope', scopeText);
      navigate(`/attendance/schedule${params.toString() ? `?${params.toString()}` : ''}`);
      return;
    }
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '排班'], label => handleAction(label, row))]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="考勤组名称" placeholder="请输入" colors={colors} width={180} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateGroupModal} style={primaryBtn(colors)}>新建考勤组</button>
        <button onClick={() => exportSettingsRows('考勤组管理', GROUP_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TagPill colors={colors} label="排班人员" count={String(peopleRows.filter(row => row[12]).length)} active={peopleMode === 'schedule'} onClick={() => setPeopleMode('schedule')} />
          <TagPill colors={colors} label="班次人员" count={String(rowsData.filter(row => peopleRows.some(person => String(person[12] ?? '') === String(row[0] ?? ''))).length)} active={peopleMode === 'shift'} onClick={() => setPeopleMode('shift')} />
        </div>
      </Toolbar>
      <DataTable columns={GROUP_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}条 / 总${rowsData.length}条`} />
      {showGroupModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 640,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingGroupId ? '修改考勤组' : '新建考勤组'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到考勤组表格，并可在班次、新增员工和人脸录入中使用</div>
              </div>
              <button onClick={() => setShowGroupModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="考勤组名称" required colors={colors}>
                <input value={groupDraft.name} onChange={event => updateGroupDraft('name', event.target.value)} placeholder="例如：华托大厦" style={modalInput(colors)} />
              </FormField>
              <FormField label="考勤类型" colors={colors}>
                <select value={groupDraft.type} onChange={event => updateGroupDraft('type', event.target.value)} style={modalInput(colors)}>
                  {['固定班制', '排班制', '自由工时'].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="适用范围" colors={colors} full>
                <input value={groupDraft.scope} onChange={event => updateGroupDraft('scope', event.target.value)} placeholder="例如：部门：新人培训组 / 员工：张青" style={modalInput(colors)} />
              </FormField>
              <FormField label="默认班次" colors={colors}>
                <select value={groupDraft.shiftName} onChange={event => updateGroupDraft('shiftName', event.target.value)} style={modalInput(colors)}>
                  {effectiveShiftOptions.map(shift => <option key={shift.id} value={shift.name}>{shift.name} {shift.time !== '休息' ? `（${shift.time}）` : ''}</option>)}
                </select>
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={groupDraft.creator} onChange={event => updateGroupDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors} full>
                <input value={groupDraft.createdAt} onChange={event => updateGroupDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowGroupModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveGroupDraft} disabled={!groupDraft.name.trim()} style={!groupDraft.name.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存考勤组
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ListPage>
  );
}

function SourceNotice({ sourceInfo, loadError }: { sourceInfo?: string; loadError?: string }) {
  return null;
}

function ShiftsView({ colors, showMore, onToggleMore, shiftRows, groupOptions, onShiftRowsChange, sourceInfo, loadError }: { colors: any; showMore: boolean; onToggleMore: () => void; shiftRows: string[][]; groupOptions: string[]; onShiftRowsChange: (rows: string[][]) => void; sourceInfo?: string; loadError?: string }) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [rowsData, setRowsData] = useState<string[][]>(shiftRows);
  const [draftFilters, setDraftFilters] = useState({ name: '', tag: '' });
  const [appliedFilters, setAppliedFilters] = useState({ name: '', tag: '' });
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [sortConfig, setSortConfig] = useState<TableSortConfig | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft>(() => emptyShiftDraft(shiftRows.length + 1));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(shiftRows);
    setSelectedRowIds(new Set());
  }, [shiftRows]);

  useEffect(() => {
    setTagOptions(current => {
      const next = uniqueShiftTags(rowsData);
      return Array.from(new Set([...current, ...next]));
    });
  }, [rowsData]);

  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onShiftRowsChange(next);
      void saveSettingsShifts(next).catch(() => window.alert('班次已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    const nameKeyword = appliedFilters.name.trim().toLowerCase();
    return rowsData.filter(row => {
      const matchName = !nameKeyword || String(row[0] ?? '').toLowerCase().includes(nameKeyword);
      const matchTag = !appliedFilters.tag || String(row[3] ?? '') === appliedFilters.tag;
      return matchName && matchTag;
    });
  }, [appliedFilters, rowsData]);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    return [...filteredRows].sort((left, right) => compareTableValues(left[sortConfig.index], right[sortConfig.index], sortConfig.direction));
  }, [filteredRows, sortConfig]);

  const rowIds = sortedRows.map(getShiftRowId);
  const rows = sortedRows.map(row => [
    row[0],
    row[1],
    shiftColorCell(colors, row[2]),
    ...row.slice(3),
    rowActionLinks(colors, ['修改'], label => {
      if (label === '修改') {
        setEditingShiftId(getShiftRowId(row));
        setShiftDraft(shiftDraftFromRow(row));
        setShowShiftModal(true);
      }
    }),
  ]);

  const resetFilters = () => {
    setDraftFilters({ name: '', tag: '' });
    setAppliedFilters({ name: '', tag: '' });
  };

  const toggleRow = (rowId: string) => {
    setSelectedRowIds(current => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedRowIds(current => {
      const allSelected = rowIds.length > 0 && rowIds.every(rowId => current.has(rowId));
      if (allSelected) return new Set([...current].filter(rowId => !rowIds.includes(rowId)));
      return new Set([...current, ...rowIds]);
    });
  };

  const deleteSelected = () => {
    const visibleSelectedIds = rowIds.filter(rowId => selectedRowIds.has(rowId));
    if (!visibleSelectedIds.length) {
      window.alert('请先选择要删除的班次');
      return;
    }
    setConfirmDelete({
      title: '删除班次',
      message: `确认删除选中的 ${visibleSelectedIds.length} 个班次？删除后班次列表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(row => !selectedRowIds.has(getShiftRowId(row))));
        setSelectedRowIds(new Set());
        setConfirmDelete(null);
      },
    });
  };

  const openCreateShiftModal = () => {
    setEditingShiftId(null);
    setShiftDraft(emptyShiftDraft(rowsData.length + 1));
    setShowShiftModal(true);
  };

  const updateShiftDraft = (key: keyof ShiftDraft, value: string) => {
    setShiftDraft(current => {
      const next = { ...current, [key]: value };
      if ((key === 'clockInTime' || key === 'clockOutTime') && current.duration === inferShiftDuration(current.clockInTime, current.clockOutTime)) {
        return { ...next, duration: inferShiftDuration(next.clockInTime, next.clockOutTime) };
      }
      if (key === 'name' && (!current.shortName || current.shortName === current.name.slice(0, 8))) {
        return { ...next, shortName: value.trim().slice(0, 8) };
      }
      return next;
    });
  };

  const saveShiftDraft = () => {
    const trimmedName = shiftDraft.name.trim();
    if (!trimmedName) {
      window.alert('班次名称不能为空');
      return;
    }
    commitRows(current => {
      if (!editingShiftId) return [shiftRowFromDraft(shiftDraft), ...current];
      return current.map(row => getShiftRowId(row) === editingShiftId ? shiftRowFromDraft(shiftDraft, row) : row);
    });
    setShowShiftModal(false);
    setEditingShiftId(null);
  };

  const addTag = () => {
    const trimmedTag = newTagName.trim();
    if (!trimmedTag) {
      window.alert('请输入标签名称');
      return;
    }
    setTagOptions(current => current.includes(trimmedTag) ? current : [...current, trimmedTag]);
    const targetIds = rowIds.filter(rowId => selectedRowIds.has(rowId));
    const effectiveTargetIds = targetIds.length ? targetIds : rowIds;
    if (effectiveTargetIds.length) {
      commitRows(current => current.map(row => effectiveTargetIds.includes(getShiftRowId(row)) ? setShiftRowCell(row, 3, trimmedTag) : row));
      window.alert(`已将标签「${trimmedTag}」添加到 ${effectiveTargetIds.length} 个班次`);
    } else {
      window.alert(`已新增标签「${trimmedTag}」`);
    }
    setNewTagName('');
  };

  const removeTag = (tag: string) => {
    if (rowsData.some(row => row[3] === tag)) {
      window.alert('该标签正在被班次使用，不能删除');
      return;
    }
    setTagOptions(current => current.filter(item => item !== tag));
    if (draftFilters.tag === tag) setDraftFilters(current => ({ ...current, tag: '' }));
    if (appliedFilters.tag === tag) setAppliedFilters(current => ({ ...current, tag: '' }));
  };

  const exportRows = async () => {
    const selectedRows = sortedRows.filter(row => selectedRowIds.has(getShiftRowId(row)));
    const exportData = selectedRows.length ? selectedRows : sortedRows;
    if (!exportData.length) {
      window.alert('没有可导出的班次数据');
      return;
    }
    const ok = await downloadAttendanceXlsx({
      fileName: selectedRows.length ? '班次管理-选中数据.xlsx' : '班次管理-筛选结果.xlsx',
      sheetName: '班次管理',
      headers: SHIFT_COLUMNS.slice(0, -1),
      rows: exportData,
      emptyMessage: '没有可导出的班次数据',
      saveAs: true,
    });
    if (ok) window.alert(`已导出${selectedRows.length ? '选中' : '当前筛选'}数据：${exportData.length} 条`);
  };

  const importRows = async (file: File) => {
    try {
      const importedRows = await readShiftImportFile(file);
      if (!importedRows.length) {
        window.alert('未识别到可导入的班次数据');
        return;
      }
      commitRows(current => [...importedRows, ...current]);
      window.alert(`导入成功：${importedRows.length} 条班次`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '导入失败，请检查文件格式');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="班次名称" placeholder="请输入" colors={colors} width={180} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SelectField label="标签名称" placeholder="请选择标签" colors={colors} width={160} options={tagOptions} value={draftFilters.tag} onChange={value => setDraftFilters(current => ({ ...current, tag: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateShiftModal} style={primaryBtn(colors)}>新建班次</button>
        <button onClick={exportRows} disabled={sortedRows.length === 0} style={exportBtn(colors, sortedRows.length === 0)}><Download size={14}/>导出Excel</button>
        <button
          onClick={deleteSelected}
          style={selectedRowIds.size ? outlineBtn(colors) : { ...outlineBtn(colors), color: colors.textMuted, cursor: 'not-allowed', opacity: 0.55 }}
          disabled={!selectedRowIds.size}
        >
          删除
        </button>
        <input ref={importInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={event => {
          const file = event.target.files?.[0];
          if (file) void importRows(file);
        }} />
      </Toolbar>
      <DataTable
        columns={SHIFT_COLUMNS}
        rows={rows}
        colors={colors}
        withSelection
        rowIds={rowIds}
        selectedRowIds={selectedRowIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        sortConfig={sortConfig}
        onSortChange={index => setSortConfig(current => getNextTableSortConfig(current, index))}
        nonSortableColumnIndices={[SHIFT_COLUMNS.length - 1]}
        footerText={`共${sortedRows.length}条 / 总${rowsData.length}条`}
      />
      {showShiftModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 720,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingShiftId ? '修改班次' : '新建班次'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到班次管理表格，并可在新增员工、考勤组和排班中使用</div>
              </div>
              <button onClick={() => setShowShiftModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="班次名称" required colors={colors}>
                <input value={shiftDraft.name} onChange={event => updateShiftDraft('name', event.target.value)} placeholder="例如：早九晚六" style={modalInput(colors)} />
              </FormField>
              <FormField label="班次简称" required colors={colors}>
                <input value={shiftDraft.shortName} onChange={event => updateShiftDraft('shortName', event.target.value)} placeholder="例如：早9晚6" style={modalInput(colors)} />
              </FormField>
              <FormField label="班次颜色" colors={colors}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(shiftDraft.color) ? shiftDraft.color : '#B53A2A'} onChange={event => updateShiftDraft('color', event.target.value)} style={{ width: 44, height: 34, padding: 2, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg }} />
                  <input value={shiftDraft.color} onChange={event => updateShiftDraft('color', event.target.value)} placeholder="#B53A2A" style={modalInput(colors)} />
                </div>
              </FormField>
              <FormField label="标签" colors={colors}>
                <input value={shiftDraft.tag} onChange={event => updateShiftDraft('tag', event.target.value)} placeholder="例如：门店班 / 通用 / -" style={modalInput(colors)} />
              </FormField>
              <FormField label="冬夏令时" colors={colors}>
                <select value={shiftDraft.season} onChange={event => updateShiftDraft('season', event.target.value)} style={modalInput(colors)}>
                  {['通用', '冬令时', '夏令时'].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="适用考勤组" colors={colors}>
                <select value={shiftDraft.attendGroup} onChange={event => updateShiftDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {Array.from(new Set(['通用', ...groupOptions, shiftDraft.attendGroup].filter(Boolean))).map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </FormField>
              <FormField label="上班时间" colors={colors}>
                <input type="time" value={shiftDraft.clockInTime} onChange={event => updateShiftDraft('clockInTime', event.target.value)} style={modalInput(colors)} />
              </FormField>
              <FormField label="下班时间" colors={colors}>
                <input type="time" value={shiftDraft.clockOutTime} onChange={event => updateShiftDraft('clockOutTime', event.target.value)} style={modalInput(colors)} />
              </FormField>
              <FormField label="出勤时长" colors={colors}>
                <input value={shiftDraft.duration} onChange={event => updateShiftDraft('duration', event.target.value)} placeholder="例如：8小时" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={shiftDraft.creator} onChange={event => updateShiftDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors} full>
                <input value={shiftDraft.createdAt} onChange={event => updateShiftDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowShiftModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveShiftDraft} disabled={!shiftDraft.name.trim() || !shiftDraft.shortName.trim()} style={!shiftDraft.name.trim() || !shiftDraft.shortName.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存班次
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function PeopleView({ colors, showMore, onToggleMore, peopleRows, sourceInfo, loadError }: { colors: any; showMore: boolean; onToggleMore: () => void; peopleRows: string[][]; sourceInfo?: string; loadError?: string }) {
  const attendanceFilters = useAttendanceFilterDirectory();
  const [rowsData, setRowsData] = useState<string[][]>(peopleRows);
  const [draftFilters, setDraftFilters] = useState({ keyword: '', dept: '', group: '', scheme: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [peopleMode, setPeopleMode] = useState<'all' | 'scheduled'>('all');
  const [hideDeparted, setHideDeparted] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [lookupOrganizations, setLookupOrganizations] = useState<HrLookupOption[]>([]);

  useEffect(() => {
    setRowsData(peopleRows);
  }, [peopleRows]);

  useEffect(() => {
    let cancelled = false;
    fetchHrCoreLookups()
      .then((res) => {
        if (cancelled) return;
        setLookupOrganizations((res.organizations || []).filter(row => row.name && !/停用|失效|删除/.test(row.status || '')));
      })
      .catch(() => {
        if (!cancelled) setLookupOrganizations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deptOptions = useMemo(() => Array.from(new Set([
    ...attendanceFilters.departmentOptions,
    ...lookupOrganizations.map(row => row.name),
    ...uniqueOptions(rowsData, 2),
  ].filter(Boolean))), [attendanceFilters.departmentOptions, lookupOrganizations, rowsData]);
  const groupOptions = useMemo(() => Array.from(new Set([...attendanceFilters.attendanceGroupOptions, ...uniqueOptions(rowsData, 12)].filter(Boolean))), [attendanceFilters.attendanceGroupOptions, rowsData]);
  const schemeOptions = useMemo(() => uniqueOptions(rowsData, 13), [rowsData]);

  const filteredRows = useMemo(() => {
    const keyword = draftFilters.keyword.trim().toLowerCase();
    return rowsData.filter(row => {
      const matchKeyword = !keyword || [row[0], row[1]].some(value => String(value ?? '').toLowerCase().includes(keyword));
      const matchDept = attendanceFilters.matchesDepartment({ name: String(row[0] ?? ''), employeeNo: String(row[1] ?? ''), dept: String(row[2] ?? ''), attendGroup: String(row[12] ?? '') }, draftFilters.dept);
      const matchGroup = !draftFilters.group || attendanceFilters.matchesLinkedFilters({ name: String(row[0] ?? ''), employeeNo: String(row[1] ?? ''), dept: String(row[2] ?? ''), attendGroup: String(row[12] ?? '') }, { attendGroup: draftFilters.group });
      const matchScheme = !draftFilters.scheme || row[13] === draftFilters.scheme;
      const matchMode = peopleMode === 'all' || Boolean(row[5] && row[5] !== '-');
      const matchStatus = !hideDeparted || row[8] !== '离职';
      return matchKeyword && matchDept && matchGroup && matchScheme && matchMode && matchStatus;
    });
  }, [attendanceFilters, draftFilters, hideDeparted, peopleMode, rowsData]);

  const resetFilters = () => {
    const next = { keyword: '', dept: '', group: '', scheme: '' };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const rows = filteredRows.map(row => [...row, emptyActionCell(colors)]);

  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="姓名/员工工号" placeholder="请输入姓名/员工工号" colors={colors} width={210} showUserIcon value={draftFilters.keyword} onChange={value => setDraftFilters(current => ({ ...current, keyword: value }))} />
        <SelectField label="部门" placeholder="请选择" colors={colors} width={150} options={deptOptions} value={draftFilters.dept} onChange={value => setDraftFilters(current => ({ ...current, dept: value }))} />
        <SelectField label="考勤组" placeholder="请选择" colors={colors} width={150} options={groupOptions} value={draftFilters.group} onChange={value => setDraftFilters(current => ({ ...current, group: value }))} />
        <SelectField label="统计方案" placeholder="请选择" colors={colors} width={150} options={schemeOptions} value={draftFilters.scheme} onChange={value => setDraftFilters(current => ({ ...current, scheme: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <TagPill colors={colors} label="全部人员" count={String(rowsData.length)} active={peopleMode === 'all'} onClick={() => setPeopleMode('all')} />
        <TagPill colors={colors} label="排班人员" count={String(rowsData.filter(row => row[5] && row[5] !== '-').length)} active={peopleMode === 'scheduled'} onClick={() => setPeopleMode('scheduled')} />
        <button onClick={() => exportSettingsRows('考勤人员', PEOPLE_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable columns={PEOPLE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔 / 总${rowsData.length}笔`} />
    </ListPage>
  );
}

function CardRulesView({
  colors,
  cardRuleRows,
  groupOptions,
  onCardRuleRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  cardRuleRows: string[][];
  groupOptions: string[];
  onCardRuleRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(cardRuleRows);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<CardRuleDraft>(() => emptyCardRuleDraft(cardRuleRows.length + 1, groupOptions[0] || '默认考勤组'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(cardRuleRows);
  }, [cardRuleRows]);

  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onCardRuleRowsChange(next);
      void saveSettingsCardRules(next).catch(() => window.alert('打卡规则已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);
  const effectiveGroupOptions = Array.from(new Set([...groupOptions, '默认考勤组', ruleDraft.attendGroup].filter(Boolean)));

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyCardRuleDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组'));
    setShowRuleModal(true);
  };

  const updateRuleDraft = (key: keyof CardRuleDraft, value: string) => {
    setRuleDraft(current => ({ ...current, [key]: value }));
  };

  const saveRuleDraft = () => {
    if (!ruleDraft.name.trim()) {
      window.alert('规则名称不能为空');
      return;
    }
    commitRows(current => {
      if (!editingRuleId) return [cardRuleRowFromDraft(ruleDraft), ...current];
      return current.map(row => createRowId(row) === editingRuleId ? cardRuleRowFromDraft(ruleDraft, row) : row);
    });
    setShowRuleModal(false);
    setEditingRuleId(null);
  };

  const handleAction = (label: string, row: string[]) => {
    const rowId = createRowId(row);
    if (label === '修改') {
      setEditingRuleId(rowId);
      setRuleDraft(cardRuleDraftFromRow(row));
      setShowRuleModal(true);
      return;
    }
    if (label === '删除') {
      setConfirmDelete({
        title: '删除打卡规则',
        message: `确认删除打卡规则「${row[0] ?? '-'}」？删除后该规则将从打卡规则表移除。`,
        onConfirm: () => {
          commitRows(current => current.filter(item => createRowId(item) !== rowId));
          setConfirmDelete(null);
        },
      });
    }
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => handleAction(label, row))]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="规则名称" placeholder="请输入规则名称" colors={colors} width={200} value={draftName} onChange={setDraftName} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateRuleModal} style={primaryBtn(colors)}>新增打卡规则</button>
        <button onClick={() => exportSettingsRows('打卡规则', CARD_RULE_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable columns={CARD_RULE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
      {showRuleModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 640,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingRuleId ? '修改打卡规则' : '新增打卡规则'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到打卡规则表格，并关联到已维护的考勤组</div>
              </div>
              <button onClick={() => setShowRuleModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="规则名称" required colors={colors}>
                <input value={ruleDraft.name} onChange={event => updateRuleDraft('name', event.target.value)} placeholder="例如：迟到打卡规则" style={modalInput(colors)} />
              </FormField>
              <FormField label="关联考勤组" colors={colors}>
                <select value={ruleDraft.attendGroup} onChange={event => updateRuleDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </FormField>
              <FormField label="规则内容" required colors={colors} full>
                <textarea value={ruleDraft.content} onChange={event => updateRuleDraft('content', event.target.value)} placeholder="例如：禁止工出勤在9小时内发起迟到流程" style={{ ...modalInput(colors), height: 82, resize: 'vertical', paddingTop: 8 }} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={ruleDraft.creator} onChange={event => updateRuleDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={ruleDraft.createdAt} onChange={event => updateRuleDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowRuleModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveRuleDraft} disabled={!ruleDraft.name.trim() || !ruleDraft.content.trim()} style={!ruleDraft.name.trim() || !ruleDraft.content.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存打卡规则
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function MobileClockView({
  colors,
  mobileClockRows,
  groupOptions,
  onMobileClockRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  mobileClockRows: string[][];
  groupOptions: string[];
  onMobileClockRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(mobileClockRows);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [schemeDraft, setSchemeDraft] = useState<MobileClockDraft>(() => emptyMobileClockDraft(mobileClockRows.length + 1, groupOptions[0] || '默认考勤组'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(mobileClockRows);
  }, [mobileClockRows]);

  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onMobileClockRowsChange(next);
      void saveSettingsMobileClock(next).catch(() => window.alert('移动打卡方案已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);
  const effectiveGroupOptions = Array.from(new Set([...groupOptions, '默认考勤组', schemeDraft.attendGroup].filter(Boolean)));

  const openCreateSchemeModal = () => {
    setEditingSchemeId(null);
    setSchemeDraft(emptyMobileClockDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组'));
    setShowSchemeModal(true);
  };

  const updateSchemeDraft = (key: keyof MobileClockDraft, value: string) => {
    setSchemeDraft(current => ({ ...current, [key]: value }));
  };

  const saveSchemeDraft = () => {
    if (!schemeDraft.name.trim()) {
      window.alert('方案名称不能为空');
      return;
    }
    commitRows(current => {
      if (!editingSchemeId) return [mobileClockRowFromDraft(schemeDraft), ...current];
      return current.map(row => createRowId(row) === editingSchemeId ? mobileClockRowFromDraft(schemeDraft, row) : row);
    });
    setShowSchemeModal(false);
    setEditingSchemeId(null);
  };

  const handleAction = (label: string, row: string[]) => {
    const rowId = createRowId(row);
    if (label === '修改') {
      setEditingSchemeId(rowId);
      setSchemeDraft(mobileClockDraftFromRow(row));
      setShowSchemeModal(true);
      return;
    }
    if (label === '删除') {
      setConfirmDelete({
        title: '删除移动打卡方案',
        message: `确认删除移动打卡方案「${row[0] ?? '-'}」？删除后该方案会从移动打卡表移除。`,
        onConfirm: () => {
          commitRows(current => current.filter(item => createRowId(item) !== rowId));
          setConfirmDelete(null);
        },
      });
    }
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => handleAction(label, row))]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateSchemeModal} style={primaryBtn(colors)}>新建方案</button>
      </Toolbar>
      <DataTable columns={MOBILE_COLUMNS} rows={rows} colors={colors} emptyText="暂无内容" footerText={`共${filteredRows.length}笔`} />
      {showSchemeModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 640,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingSchemeId ? '修改移动打卡方案' : '新建移动打卡方案'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到移动打卡方案表格，并可在上班地点中引用</div>
              </div>
              <button onClick={() => setShowSchemeModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="方案名称" required colors={colors}>
                <input value={schemeDraft.name} onChange={event => updateSchemeDraft('name', event.target.value)} placeholder="例如：华托大厦移动打卡" style={modalInput(colors)} />
              </FormField>
              <FormField label="关联考勤组" colors={colors}>
                <select value={schemeDraft.attendGroup} onChange={event => updateSchemeDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </FormField>
              <FormField label="方案内容" required colors={colors} full>
                <textarea value={schemeDraft.content} onChange={event => updateSchemeDraft('content', event.target.value)} placeholder="例如：GPS/Wi-Fi/蓝牙均可打卡，超出范围需拍照说明" style={{ ...modalInput(colors), height: 82, resize: 'vertical', paddingTop: 8 }} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={schemeDraft.creator} onChange={event => updateSchemeDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={schemeDraft.createdAt} onChange={event => updateSchemeDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowSchemeModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveSchemeDraft} disabled={!schemeDraft.name.trim() || !schemeDraft.content.trim()} style={!schemeDraft.name.trim() || !schemeDraft.content.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存方案
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function LocationView({
  colors,
  showMore,
  onToggleMore,
  locationRows,
  groupOptions,
  mobileSchemeOptions,
  onLocationRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  locationRows: string[][];
  groupOptions: string[];
  mobileSchemeOptions: string[];
  onLocationRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(locationRows);
  const [draftFilters, setDraftFilters] = useState({ name: '', gps: '', wifi: '', bluetooth: '', mobile: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(() => emptyLocationDraft(locationRows.length + 1, groupOptions[0] || '默认考勤组', mobileSchemeOptions[0] || '未关联移动打卡方案'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(locationRows);
    setSelectedRowIds(new Set());
  }, [locationRows]);

  const effectiveGroupOptions = Array.from(new Set([...groupOptions, locationDraft.attendGroup || '默认考勤组'].filter(Boolean)));
  const effectiveMobileSchemeOptions = Array.from(new Set([...mobileSchemeOptions, locationDraft.mobileScheme || '未关联移动打卡方案'].filter(Boolean)));

  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onLocationRowsChange(next);
      void saveSettingsLocation(next).catch(() => window.alert('上班地点已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => rowsData.filter(row => {
    return textIncludes(row[0], appliedFilters.name)
      && textIncludes(row[2], appliedFilters.gps)
      && textIncludes(row[4], appliedFilters.wifi)
      && textIncludes(row[3], appliedFilters.bluetooth)
      && textIncludes(row[5], appliedFilters.mobile);
  }), [appliedFilters, rowsData]);
  const rowIds = filteredRows.map(createRowId);

  const resetFilters = () => {
    const next = { name: '', gps: '', wifi: '', bluetooth: '', mobile: '' };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const openCreateLocationModal = () => {
    setEditingLocationId(null);
    setLocationDraft(emptyLocationDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组', mobileSchemeOptions[0] || '未关联移动打卡方案'));
    setShowLocationModal(true);
  };

  const openEditLocationModal = (row: string[]) => {
    setEditingLocationId(createRowId(row));
    setLocationDraft(locationDraftFromRow(row));
    setShowLocationModal(true);
  };

  const updateLocationDraft = (key: keyof LocationDraft, value: string) => {
    setLocationDraft(current => ({ ...current, [key]: value }));
  };

  const saveLocationDraft = () => {
    if (!locationDraft.name.trim()) return;
    commitRows(current => {
      if (!editingLocationId) return [locationRowFromDraft(locationDraft), ...current];
      return current.map(row => createRowId(row) === editingLocationId ? locationRowFromDraft(locationDraft, row) : row);
    });
    setShowLocationModal(false);
  };

  const importLocation = () => {
    commitRows(current => [[
      `导入地点${current.length + 1}`,
      groupOptions[0] || '默认考勤组',
      '杭州市西湖区',
      '蓝牙-IMPORT',
      'Guest-WiFi',
      mobileSchemeOptions[0] || '未关联移动打卡方案',
      '导入',
      nowText(),
      '导入',
      nowText(),
    ], ...current]);
  };

  const deleteSelected = () => {
    const visibleSelectedIds = rowIds.filter(rowId => selectedRowIds.has(rowId));
    if (!visibleSelectedIds.length) {
      window.alert('请先选择要删除的上班地点');
      return;
    }
    setConfirmDelete({
      title: '删除上班地点',
      message: `确认删除选中的 ${visibleSelectedIds.length} 个上班地点？删除后上班地点表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(row => !visibleSelectedIds.includes(createRowId(row))));
        setSelectedRowIds(new Set());
        setConfirmDelete(null);
      },
    });
  };

  const deleteLocation = (row: string[]) => {
    const rowId = createRowId(row);
    setConfirmDelete({
      title: '删除上班地点',
      message: `确认删除「${row[0] ?? '当前地点'}」？删除后上班地点表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(item => createRowId(item) !== rowId));
        setConfirmDelete(null);
      },
    });
  };

  const exportRows = async () => {
    const selectedRows = filteredRows.filter(row => selectedRowIds.has(createRowId(row)));
    downloadCsv(LOCATION_COLUMNS.slice(0, -1), selectedRows.length ? selectedRows : filteredRows, selectedRows.length ? '上班地点-选中数据.csv' : '上班地点-筛选结果.csv');
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => {
    if (label === '修改') openEditLocationModal(row);
    if (label === '删除') deleteLocation(row);
  })]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="上班地点" placeholder="请输入" colors={colors} width={180} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SearchField label="GPS打卡地址" placeholder="请输入" colors={colors} width={180} value={draftFilters.gps} onChange={value => setDraftFilters(current => ({ ...current, gps: value }))} />
        <SearchField label="打卡Wi-Fi" placeholder="请输入" colors={colors} width={160} value={draftFilters.wifi} onChange={value => setDraftFilters(current => ({ ...current, wifi: value }))} />
        <SearchField label="打卡蓝牙" placeholder="请输入" colors={colors} width={160} value={draftFilters.bluetooth} onChange={value => setDraftFilters(current => ({ ...current, bluetooth: value }))} />
        <SearchField label="移动打卡方案" placeholder="请输入" colors={colors} width={180} value={draftFilters.mobile} onChange={value => setDraftFilters(current => ({ ...current, mobile: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateLocationModal} style={primaryBtn(colors)}>新建上班地点</button>
        <button onClick={importLocation} style={outlineBtn(colors)}>导入</button>
        <button onClick={exportRows} style={outlineBtn(colors)}><Download size={12}/>导出Excel</button>
        <button onClick={deleteSelected} disabled={!selectedRowIds.size} style={selectedRowIds.size ? outlineBtn(colors) : disabledBtn(colors)}>批量删除</button>
      </Toolbar>
      <DataTable
        columns={LOCATION_COLUMNS}
        rows={rows}
        colors={colors}
        withSelection
        rowIds={rowIds}
        selectedRowIds={selectedRowIds}
        onToggleRow={rowId => toggleSelectedRow(setSelectedRowIds, rowId)}
        onToggleAll={() => toggleAllVisibleRows(setSelectedRowIds, rowIds)}
        emptyText="暂无内容"
        footerText={`共${filteredRows.length}笔`}
      />
      {showLocationModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 720,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingLocationId ? '修改上班地点' : '新建上班地点'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到上班地点表格，并关联真实考勤组和移动打卡方案</div>
              </div>
              <button onClick={() => setShowLocationModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="上班地点名称" required colors={colors}>
                <input value={locationDraft.name} onChange={event => updateLocationDraft('name', event.target.value)} placeholder="例如：华托大厦" style={modalInput(colors)} />
              </FormField>
              <FormField label="考勤组名称" required colors={colors}>
                <select value={locationDraft.attendGroup} onChange={event => updateLocationDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="GPS打卡地址" colors={colors} full>
                <input value={locationDraft.gpsAddress} onChange={event => updateLocationDraft('gpsAddress', event.target.value)} placeholder="例如：上海市静安区南京西路" style={modalInput(colors)} />
              </FormField>
              <FormField label="打卡蓝牙" colors={colors}>
                <input value={locationDraft.bluetooth} onChange={event => updateLocationDraft('bluetooth', event.target.value)} placeholder="例如：蓝牙-A1" style={modalInput(colors)} />
              </FormField>
              <FormField label="打卡Wi-Fi" colors={colors}>
                <input value={locationDraft.wifi} onChange={event => updateLocationDraft('wifi', event.target.value)} placeholder="例如：Office-WiFi" style={modalInput(colors)} />
              </FormField>
              <FormField label="关联移动打卡方案" colors={colors} full>
                <select value={locationDraft.mobileScheme} onChange={event => updateLocationDraft('mobileScheme', event.target.value)} style={modalInput(colors)}>
                  {effectiveMobileSchemeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={locationDraft.creator} onChange={event => updateLocationDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={locationDraft.createdAt} onChange={event => updateLocationDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowLocationModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveLocationDraft} disabled={!locationDraft.name.trim()} style={!locationDraft.name.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存地点
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function FaceView({
  colors,
  showMore,
  onToggleMore,
  faceRows,
  shiftOptions,
  groupOptions,
  sourceInfo,
  loadError,
  onEmployeeCreated,
  onEmployeeDeleted,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  faceRows: string[][];
  shiftOptions: ShiftOption[];
  groupOptions: string[];
  sourceInfo?: string;
  loadError?: string;
  onEmployeeCreated: (peopleRow: string[], faceRow: string[]) => void;
  onEmployeeDeleted: (employeeNos: string[]) => void;
}) {
  const attendanceFilters = useAttendanceFilterDirectory();
  const [rowsData, setRowsData] = useState<string[][]>(faceRows);
  const [draftFilters, setDraftFilters] = useState({ employee: '', dept: '', group: '', status: '', start: '', end: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [hideDeparted, setHideDeparted] = useState(false);
  const [reminderRecords, setReminderRecords] = useState<string[]>([]);
  const [showReminderRecords, setShowReminderRecords] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);
  const [lookupOrganizations, setLookupOrganizations] = useState<HrLookupOption[]>([]);
  const [lookupPositions, setLookupPositions] = useState<HrLookupOption[]>([]);
  const [employeeDraft, setEmployeeDraft] = useState({
    name: '',
    employeeNo: '',
    department: '新人培训组',
    managerNo: '',
    managerName: '',
    position: '员工',
    hireDate: todayISO(),
    attendanceGroupName: '华托大厦',
    shiftName: '早九晚六',
    faceStatus: '已录入',
    userId: '',
  });
  const effectiveShiftOptions = shiftOptions.length ? shiftOptions : [{ id: 'shift_0900_1800', name: '早九晚六', time: '09:00-18:00' }];
  const effectiveGroupOptions = Array.from(new Set([...groupOptions, ...ONBOARD_ATTEND_GROUPS, employeeDraft.attendanceGroupName].filter(Boolean)));

  useEffect(() => {
    let cancelled = false;
    fetchHrCoreLookups()
      .then((res) => {
        if (cancelled) return;
        setLookupOrganizations((res.organizations || []).filter(row => row.name && !/停用|失效|删除/.test(row.status || '')));
        setLookupPositions((res.positions || []).filter(row => row.name && !/停用|失效|删除/.test(row.status || '')));
      })
      .catch(() => {
        if (!cancelled) {
          setLookupOrganizations([]);
          setLookupPositions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRowsData(faceRows);
    setSelectedRowIds(new Set());
  }, [faceRows]);

  const filteredRows = useMemo(() => rowsData.filter(row => {
    const employeeKeyword = draftFilters.employee.trim().toLowerCase();
    const matchEmployee = !employeeKeyword || [row[0], row[1]].some(value => String(value ?? '').toLowerCase().includes(employeeKeyword));
    const matchDept = attendanceFilters.matchesDepartment({ name: String(row[0] ?? ''), employeeNo: String(row[1] ?? ''), dept: String(row[2] ?? ''), attendGroup: String(row[4] ?? '') }, draftFilters.dept);
    const matchGroup = !draftFilters.group || attendanceFilters.matchesLinkedFilters({ name: String(row[0] ?? ''), employeeNo: String(row[1] ?? ''), dept: String(row[2] ?? ''), attendGroup: String(row[4] ?? '') }, { attendGroup: draftFilters.group });
    const matchStatus = !draftFilters.status || row[6] === draftFilters.status;
    const matchDate = inDateRange(row[5], draftFilters.start, draftFilters.end);
    const matchDeparted = !hideDeparted || !String(row[7] ?? '').includes('离职');
    return matchEmployee && matchDept && matchGroup && matchStatus && matchDate && matchDeparted;
  }), [attendanceFilters, draftFilters, hideDeparted, rowsData]);
  const rowIds = filteredRows.map(createRowId);
  const selectedVisibleRows = filteredRows.filter(row => selectedRowIds.has(createRowId(row)));
  const targetRows = selectedVisibleRows.length ? selectedVisibleRows : filteredRows;

  const resetFilters = () => {
    const next = { employee: '', dept: '', group: '', status: '', start: '', end: '' };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const importFaces = () => {
    const targetIds = new Set(targetRows.map(createRowId));
    setRowsData(current => current.map(row => targetIds.has(createRowId(row)) ? setRowCell(setRowCell(row, 6, '已录入'), 9, '批量导入') : row));
  };

  const openCreateEmployeeModal = () => {
    setEmployeeDraft(current => ({
      ...current,
      name: '',
      employeeNo: '',
      managerNo: '',
      managerName: '',
      userId: '',
      hireDate: todayISO(),
    }));
    setShowCreateModal(true);
  };

  const updateEmployeeDraft = (key: keyof typeof employeeDraft, value: string) => {
    setEmployeeDraft(current => ({
      ...current,
      [key]: value,
      ...(key === 'employeeNo' && (!current.userId || current.userId === `wecom_${current.employeeNo.trim()}`) ? { userId: value ? `wecom_${value.trim()}` : '' } : {}),
    }));
  };

  const createEmployeeWithFace = async () => {
    const trimmedName = employeeDraft.name.trim();
    const trimmedNo = employeeDraft.employeeNo.trim();
    if (!trimmedName || !trimmedNo) {
      window.alert('姓名和员工号必填');
      return;
    }

    try {
      setSavingEmployee(true);
      const department = employeeDraft.department.trim() || '未分配部门';
      const selectedOrg = lookupOrganizations.find(row => row.name === department);
      const managerNo = employeeDraft.managerNo.trim();
      const managerRow = rowsData.find(row => String(row[1] ?? '').trim() === managerNo);
      const managerName = managerNo ? String(managerRow?.[0] ?? employeeDraft.managerName).trim() : '';
      const result = await onboardEmployee({
        name: trimmedName,
        employeeNo: trimmedNo,
        department,
        deptFullPath: selectedOrg?.fullPath || DEPT_FULL_PATH_BY_NAME[department] || `上海拉迷家具有限公司/${department}`,
        managerNo,
        managerName,
        position: employeeDraft.position.trim() || '员工',
        attendanceGroupName: employeeDraft.attendanceGroupName.trim() || '华托大厦',
        shiftId: effectiveShiftOptions.find(shift => shift.name === employeeDraft.shiftName)?.id || 'shift_0900_1800',
        shiftName: employeeDraft.shiftName.trim() || effectiveShiftOptions[0]?.name || '早九晚六',
        hireDate: employeeDraft.hireDate.trim() || todayISO(),
        userId: employeeDraft.userId.trim() || `wecom_${trimmedNo}`,
        faceStatus: employeeDraft.faceStatus,
      });
      onEmployeeCreated(result.peopleRow, result.faceRow);
      setRowsData(current => [result.faceRow, ...current.filter(row => row[1] !== result.faceRow[1])]);
      setShowCreateModal(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '新增员工失败');
    } finally {
      setSavingEmployee(false);
    }
  };

  const addReminderRecord = (message: string) => {
    setReminderRecords(current => [`${nowText()} ${message}`, ...current]);
    setShowReminderRecords(true);
  };

  const refreshFaces = () => {
    const targetIds = new Set(targetRows.map(createRowId));
    setRowsData(current => current.map(row => targetIds.has(createRowId(row)) ? setRowCell(row, 8, '已重刷') : row));
  };

  const deleteSelected = async () => {
    const visibleSelectedIds = rowIds.filter(rowId => selectedRowIds.has(rowId));
    if (!visibleSelectedIds.length) {
      window.alert('请先选择要删除的人脸记录');
      return;
    }
    const selectedEmployeeNos = Array.from(new Set(
      filteredRows
        .filter(row => visibleSelectedIds.includes(createRowId(row)))
        .map(row => String(row[1] ?? '').trim())
        .filter(Boolean),
    ));
    if (!selectedEmployeeNos.length) {
      window.alert('选中记录缺少员工号，无法同步删除员工主数据');
      return;
    }
    setConfirmDelete({
      title: '删除人脸记录',
      message: `确认删除选中的 ${selectedEmployeeNos.length} 名员工？删除后将同步移除考勤人员、人脸、小程序打卡记录和所有联动统计。`,
      onConfirm: async () => {
        try {
          setDeletingEmployee(true);
          await deleteOnboardedEmployees(selectedEmployeeNos);
          const employeeNoSet = new Set(selectedEmployeeNos);
          setRowsData(current => current.filter(row => !employeeNoSet.has(String(row[1] ?? '').trim())));
          onEmployeeDeleted(selectedEmployeeNos);
          setSelectedRowIds(new Set());
          setReminderRecords(current => [`${nowText()} 已同步删除员工：${selectedEmployeeNos.join('、')}`, ...current]);
          setShowReminderRecords(true);
          setConfirmDelete(null);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : '删除员工失败');
        } finally {
          setDeletingEmployee(false);
        }
      },
    });
  };

  const rows = filteredRows.map(row => [...row, emptyActionCell(colors)]);
  const deptOptions = Array.from(new Set([...attendanceFilters.departmentOptions, ...uniqueOptions(rowsData, 2)].filter(Boolean)));
  const managedDeptOptions = Array.from(new Set([
    ...lookupOrganizations.map(row => row.name),
    ...deptOptions,
    ...ONBOARD_DEPARTMENTS,
    employeeDraft.department,
  ].filter(Boolean)));
  const managedPositionOptions = Array.from(new Set([
    ...lookupPositions.map(row => row.name),
    employeeDraft.position,
    '员工',
  ].filter(Boolean)));
  const managerOptions = rowsData
    .map(row => ({ employeeNo: String(row[1] ?? '').trim(), name: String(row[0] ?? '').trim() }))
    .filter(item => item.employeeNo && item.employeeNo !== employeeDraft.employeeNo.trim());
  const faceGroupOptions = Array.from(new Set([...attendanceFilters.attendanceGroupOptions, ...uniqueOptions(rowsData, 4)].filter(Boolean)));
  const statusOptions = uniqueOptions(rowsData, 6);

  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="员工" placeholder="请输入姓名或员工号" colors={colors} width={200} showUserIcon value={draftFilters.employee} onChange={value => setDraftFilters(current => ({ ...current, employee: value }))} />
        <SelectField label="部门" placeholder="请选择" colors={colors} width={150} options={deptOptions} value={draftFilters.dept} onChange={value => setDraftFilters(current => ({ ...current, dept: value }))} />
        <SelectField label="考勤组" placeholder="请选择" colors={colors} width={150} options={faceGroupOptions} value={draftFilters.group} onChange={value => setDraftFilters(current => ({ ...current, group: value }))} />
        <SelectField label="录入状态" placeholder="请选择" colors={colors} width={150} options={statusOptions} value={draftFilters.status} onChange={value => setDraftFilters(current => ({ ...current, status: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateEmployeeModal} style={primaryBtn(colors)}>新增员工并录入人脸</button>
        <button onClick={() => exportSettingsRows('人脸管理', FACE_COLUMNS, targetRows, selectedVisibleRows.length > 0)} disabled={targetRows.length === 0} style={exportBtn(colors, targetRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable
        columns={FACE_COLUMNS}
        rows={rows}
        colors={colors}
        withSelection
        rowIds={rowIds}
        selectedRowIds={selectedRowIds}
        onToggleRow={rowId => toggleSelectedRow(setSelectedRowIds, rowId)}
        onToggleAll={() => toggleAllVisibleRows(setSelectedRowIds, rowIds)}
        footerText={`共${filteredRows.length}笔 / 总${rowsData.length}笔`}
      />
      {showCreateModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 620,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 48,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>新增员工并录入人脸</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到考勤人员、人脸管理、小程序登录和联动统计</div>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={iconBtn(colors)} disabled={savingEmployee}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="姓名" required colors={colors}>
                <input value={employeeDraft.name} onChange={event => updateEmployeeDraft('name', event.target.value)} placeholder="例如：张青" style={modalInput(colors)} />
              </FormField>
              <FormField label="员工号" required colors={colors}>
                <input value={employeeDraft.employeeNo} onChange={event => updateEmployeeDraft('employeeNo', event.target.value)} placeholder="例如：ZY26612" style={modalInput(colors)} />
              </FormField>
              <FormField label="部门" required colors={colors}>
                <select value={employeeDraft.department} onChange={event => updateEmployeeDraft('department', event.target.value)} style={modalInput(colors)}>
                  {managedDeptOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </FormField>
              <FormField label="归属管理者" colors={colors}>
                <select value={employeeDraft.managerNo} onChange={event => {
                  const managerNo = event.target.value;
                  const manager = managerOptions.find(item => item.employeeNo === managerNo);
                  setEmployeeDraft(current => ({ ...current, managerNo, managerName: manager?.name || '' }));
                }} style={modalInput(colors)}>
                  <option value="">请选择管理者</option>
                  {managerOptions.map(manager => <option key={manager.employeeNo} value={manager.employeeNo}>{manager.name} {manager.employeeNo}</option>)}
                </select>
              </FormField>
              <FormField label="岗位" colors={colors}>
                <select value={employeeDraft.position} onChange={event => updateEmployeeDraft('position', event.target.value)} style={modalInput(colors)}>
                  {managedPositionOptions.map(position => <option key={position} value={position}>{position}</option>)}
                </select>
              </FormField>
              <FormField label="入职日期" colors={colors}>
                <input type="date" value={employeeDraft.hireDate} onChange={event => updateEmployeeDraft('hireDate', event.target.value)} style={modalInput(colors)} />
              </FormField>
              <FormField label="考勤组" colors={colors}>
                <select value={employeeDraft.attendanceGroupName} onChange={event => updateEmployeeDraft('attendanceGroupName', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </FormField>
              <FormField label="班次" colors={colors}>
                <select value={employeeDraft.shiftName} onChange={event => updateEmployeeDraft('shiftName', event.target.value)} style={modalInput(colors)}>
                  {effectiveShiftOptions.map(shift => <option key={shift.id} value={shift.name}>{shift.name} {shift.time !== '休息' ? `（${shift.time}）` : ''}</option>)}
                </select>
              </FormField>
              <FormField label="人脸状态" colors={colors}>
                <select value={employeeDraft.faceStatus} onChange={event => updateEmployeeDraft('faceStatus', event.target.value)} style={modalInput(colors)}>
                  {ONBOARD_FACE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </FormField>
              <FormField label="企业微信 UserID" colors={colors} full>
                <input value={employeeDraft.userId} onChange={event => updateEmployeeDraft('userId', event.target.value)} placeholder={employeeDraft.employeeNo ? `wecom_${employeeDraft.employeeNo}` : '测试阶段可留空'} style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowCreateModal(false)} disabled={savingEmployee} style={outlineBtn(colors)}>取消</button>
              <button onClick={createEmployeeWithFace} disabled={savingEmployee || !employeeDraft.name.trim() || !employeeDraft.employeeNo.trim()} style={savingEmployee || !employeeDraft.name.trim() || !employeeDraft.employeeNo.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                {savingEmployee ? '保存中...' : '保存并录入'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          loading={deletingEmployee}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function DevicesView({ colors }: { colors: any }) {
  const [selectedDevices, setSelectedDevices] = useState<Array<{ brand: string; model: string; addedAt: string }>>([]);
  const addDevice = (brand: string) => {
    const model = DEVICE_MODELS[brand as keyof typeof DEVICE_MODELS]?.[0] ?? `${brand}默认模板`;
    setSelectedDevices(current => current.some(item => item.brand === brand && item.model === model) ? current : [{ brand, model, addedAt: nowText() }, ...current]);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 20px' }}>
      <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
        {selectedDevices.length ? (
          <div style={{ padding: '4px 0 16px' }}>
            <div style={{ fontSize: '14px', color: colors.text, fontWeight: 600, marginBottom: 10 }}>已选择考勤机</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedDevices.map(device => (
                <span key={`${device.brand}-${device.model}`} style={{ padding: '6px 10px', borderRadius: 6, backgroundColor: colors.tableHeaderBg, color: colors.text, fontSize: '12px' }}>
                  {device.brand} / {device.model} / {device.addedAt}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '6px 0 16px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#FFF3DA', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>!</div>
            <div style={{ fontSize: '14px', color: colors.text, fontWeight: 600 }}>暂未选择考勤机</div>
            <div style={{ fontSize: '12px', color: colors.textMuted }}>可添加以下4个品牌的考勤机</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12 }}>
          {DEVICE_BRANDS.map(brand => (
            <div key={brand.name} style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 10, padding: '12px 14px', backgroundColor: colors.cardBg }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.tableHeaderBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: colors.text, marginBottom: 10 }}>{brand.name.slice(0, 2)}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: 6 }}>{brand.name}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: colors.textMuted, minHeight: 48 }}>{brand.desc}</div>
              <button onClick={() => addDevice(brand.name)} style={{ ...outlineBtn(colors), marginTop: 10, height: 28, padding: '0 10px' }}>添加</button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '12px 16px 16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: 12 }}>支持添加的考勤机型号</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12 }}>
          {Object.entries(DEVICE_MODELS).map(([brand, models]) => (
            <div key={brand} style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: colors.primary, fontWeight: 600, marginBottom: 10 }}>{brand}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {models.map(model => (
                  <div key={model} style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: colors.tableHeaderBg, fontSize: '12px', color: colors.text }}>{model}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HolidayView({
  colors,
  holidayRows,
  calendarOptions,
  onHolidayRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  holidayRows: string[][];
  calendarOptions: string[];
  onHolidayRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(holidayRows);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayDraft, setHolidayDraft] = useState<HolidayDraft>(() => emptyHolidayDraft(holidayRows.length + 1, calendarOptions[0] || '双休'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(holidayRows);
  }, [holidayRows]);

  const effectiveCalendarOptions = Array.from(new Set([...calendarOptions, holidayDraft.calendarName || '双休'].filter(Boolean)));

  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onHolidayRowsChange(next);
      void saveSettingsHoliday(next).catch(() => window.alert('节假日方案已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 2]), [appliedName, rowsData]);

  const openCreateHolidayModal = () => {
    setEditingHolidayId(null);
    setHolidayDraft(emptyHolidayDraft(rowsData.length + 1, calendarOptions[0] || '双休'));
    setShowHolidayModal(true);
  };

  const openEditHolidayModal = (row: string[]) => {
    setEditingHolidayId(createRowId(row));
    setHolidayDraft(holidayDraftFromRow(row));
    setShowHolidayModal(true);
  };

  const updateHolidayDraft = (key: keyof HolidayDraft, value: string) => {
    setHolidayDraft(current => ({ ...current, [key]: value }));
  };

  const saveHolidayDraft = () => {
    if (!holidayDraft.name.trim()) return;
    commitRows(current => {
      if (!editingHolidayId) return [holidayRowFromDraft(holidayDraft), ...current];
      return current.map(row => createRowId(row) === editingHolidayId ? holidayRowFromDraft(holidayDraft, row) : row);
    });
    setShowHolidayModal(false);
  };

  const deleteHoliday = (row: string[]) => {
    const rowId = createRowId(row);
    setConfirmDelete({
      title: '删除节假日方案',
      message: `确认删除「${row[0] ?? '当前方案'}」？删除后节假日方案表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(item => createRowId(item) !== rowId));
        setConfirmDelete(null);
      },
    });
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['编辑', '删除'], label => {
    if (label === '编辑') openEditHolidayModal(row);
    if (label === '删除') deleteHoliday(row);
  })]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateHolidayModal} style={primaryBtn(colors)}>新增节假日方案</button>
      </Toolbar>
      <DataTable columns={HOLIDAY_COLUMNS} rows={rows} colors={colors} emptyText="暂无内容" footerText={`共${filteredRows.length}笔`} />
      {showHolidayModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 640,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingHolidayId ? '编辑节假日方案' : '新增节假日方案'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到节假日管理表格，并关联司历方案</div>
              </div>
              <button onClick={() => setShowHolidayModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="方案名称" required colors={colors}>
                <input value={holidayDraft.name} onChange={event => updateHolidayDraft('name', event.target.value)} placeholder="例如：2026法定节假日" style={modalInput(colors)} />
              </FormField>
              <FormField label="已设置年份" required colors={colors}>
                <input value={holidayDraft.years} onChange={event => updateHolidayDraft('years', event.target.value)} placeholder="例如：2026" style={modalInput(colors)} />
              </FormField>
              <FormField label="关联司历" required colors={colors} full>
                <select value={holidayDraft.calendarName} onChange={event => updateHolidayDraft('calendarName', event.target.value)} style={modalInput(colors)}>
                  {effectiveCalendarOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={holidayDraft.creator} onChange={event => updateHolidayDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={holidayDraft.createdAt} onChange={event => updateHolidayDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowHolidayModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveHolidayDraft} disabled={!holidayDraft.name.trim() || !holidayDraft.years.trim()} style={!holidayDraft.name.trim() || !holidayDraft.years.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存方案
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function CalendarView({
  colors,
  calendarRows,
  groupOptions,
  onCalendarRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  calendarRows: string[][];
  groupOptions: string[];
  onCalendarRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(calendarRows);
  const [draftFilters, setDraftFilters] = useState({ name: '', period: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft>(() => emptyCalendarDraft(calendarRows.length + 1, groupOptions[0] || '默认考勤组'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);
  useEffect(() => {
    setRowsData(calendarRows);
  }, [calendarRows]);
  const effectiveGroupOptions = Array.from(new Set([...groupOptions, '默认考勤组', calendarDraft.attendGroup].filter(Boolean)));
  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onCalendarRowsChange(next);
      void saveSettingsCalendar(next).catch(() => window.alert('司历方案已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };
  const filteredRows = useMemo(() => rowsData.filter(row => textIncludes(row[0], appliedFilters.name) && textIncludes(row[1], appliedFilters.period)), [appliedFilters, rowsData]);

  const openCreateCalendarModal = () => {
    setEditingCalendarId(null);
    setCalendarDraft(emptyCalendarDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组'));
    setShowCalendarModal(true);
  };

  const openEditCalendarModal = (row: string[]) => {
    setEditingCalendarId(createRowId(row));
    setCalendarDraft(calendarDraftFromRow(row));
    setShowCalendarModal(true);
  };

  const updateCalendarDraft = (key: keyof CalendarDraft, value: string) => {
    setCalendarDraft(current => ({ ...current, [key]: value }));
  };

  const saveCalendarDraft = () => {
    if (!calendarDraft.name.trim()) return;
    commitRows(current => {
      if (!editingCalendarId) return [calendarRowFromDraft(calendarDraft), ...current];
      return current.map(row => createRowId(row) === editingCalendarId ? calendarRowFromDraft(calendarDraft, row) : row);
    });
    setShowCalendarModal(false);
  };

  const deleteCalendar = (row: string[]) => {
    const rowId = createRowId(row);
    setConfirmDelete({
      title: '删除司历方案',
      message: `确认删除「${row[0] ?? '当前方案'}」？删除后司历方案表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(item => createRowId(item) !== rowId));
        setConfirmDelete(null);
      },
    });
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['编辑', '删除'], label => {
    if (label === '编辑') openEditCalendarModal(row);
    if (label === '删除') deleteCalendar(row);
  })]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SelectField label="考勤周期" placeholder="请选择考勤周期" colors={colors} width={180} options={uniqueOptions(rowsData, 1)} value={draftFilters.period} onChange={value => setDraftFilters(current => ({ ...current, period: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateCalendarModal} style={primaryBtn(colors)}>新建司历方案</button>
        <button onClick={() => exportSettingsRows('司历管理', CALENDAR_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable columns={CALENDAR_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
      {showCalendarModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 760,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingCalendarId ? '编辑司历方案' : '新建司历方案'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到司历管理表格，并可被节假日方案关联</div>
              </div>
              <button onClick={() => setShowCalendarModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="方案名称" required colors={colors}>
                <input value={calendarDraft.name} onChange={event => updateCalendarDraft('name', event.target.value)} placeholder="例如：双休" style={modalInput(colors)} />
              </FormField>
              <FormField label="适用考勤组" required colors={colors}>
                <select value={calendarDraft.attendGroup} onChange={event => updateCalendarDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="考勤周期" required colors={colors} full>
                <input value={calendarDraft.period} onChange={event => updateCalendarDraft('period', event.target.value)} placeholder="例如：当月1日至当月最后一天为【当月】的考勤周期" style={modalInput(colors)} />
              </FormField>
              <FormField label="每周工作日" required colors={colors} full>
                <input value={calendarDraft.workdays} onChange={event => updateCalendarDraft('workdays', event.target.value)} placeholder="例如：周一、周二、周三、周四、周五" style={modalInput(colors)} />
              </FormField>
              <FormField label="包含最大天数规则" required colors={colors} full>
                <input value={calendarDraft.maxRule} onChange={event => updateCalendarDraft('maxRule', event.target.value)} placeholder="例如：工作日之和为应出勤天数" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={calendarDraft.creator} onChange={event => updateCalendarDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={calendarDraft.createdAt} onChange={event => updateCalendarDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowCalendarModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveCalendarDraft} disabled={!calendarDraft.name.trim() || !calendarDraft.period.trim()} style={!calendarDraft.name.trim() || !calendarDraft.period.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存方案
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function OvertimeRulesView({
  colors,
  overtimeRuleRows,
  groupOptions,
  onOvertimeRuleRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  overtimeRuleRows: string[][];
  groupOptions: string[];
  onOvertimeRuleRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(overtimeRuleRows);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [useDefault, setUseDefault] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<OvertimeRuleDraft>(() => emptyOvertimeRuleDraft(overtimeRuleRows.length + 1, groupOptions[0] || '默认考勤组'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(overtimeRuleRows);
  }, [overtimeRuleRows]);

  const effectiveGroupOptions = Array.from(new Set([...groupOptions, '默认考勤组', ruleDraft.attendGroup].filter(Boolean)));
  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onOvertimeRuleRowsChange(next);
      void saveSettingsOvertimeRules(next).catch(() => window.alert('加班规则已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyOvertimeRuleDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组'));
    setShowRuleModal(true);
  };

  const openEditRuleModal = (row: string[]) => {
    setEditingRuleId(createRowId(row));
    setRuleDraft(overtimeRuleDraftFromRow(row));
    setShowRuleModal(true);
  };

  const updateRuleDraft = (key: keyof OvertimeRuleDraft, value: string) => {
    setRuleDraft(current => ({ ...current, [key]: value }));
  };

  const saveRuleDraft = () => {
    if (!ruleDraft.name.trim()) return;
    commitRows(current => {
      if (!editingRuleId) return [overtimeRuleRowFromDraft(ruleDraft), ...current];
      return current.map(row => createRowId(row) === editingRuleId ? overtimeRuleRowFromDraft(ruleDraft, row) : row);
    });
    setShowRuleModal(false);
  };

  const importDefault = () => {
    commitRows(current => [[`默认加班规则${current.length + 1}`, '工作日/休息日/节假日均按默认口径核算', '默认考勤组', '系统默认', nowText(), '系统默认', nowText()], ...current]);
    setUseDefault(true);
  };
  const deleteRule = (row: string[]) => {
    const rowId = createRowId(row);
    setConfirmDelete({
      title: '删除加班规则',
      message: `确认删除「${row[0] ?? '当前规则'}」？删除后加班规则表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(item => createRowId(item) !== rowId));
        setConfirmDelete(null);
      },
    });
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => {
    if (label === '修改') openEditRuleModal(row);
    if (label === '删除') deleteRule(row);
  })]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="规则名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateRuleModal} style={primaryBtn(colors)}>新建加班规则</button>
        <button onClick={() => exportSettingsRows('加班规则', OVERTIME_RULE_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable columns={OVERTIME_RULE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
      {showRuleModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 720,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingRuleId ? '修改加班规则' : '新建加班规则'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到加班规则表格，并关联真实考勤组</div>
              </div>
              <button onClick={() => setShowRuleModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="加班规则名称" required colors={colors}>
                <input value={ruleDraft.name} onChange={event => updateRuleDraft('name', event.target.value)} placeholder="例如：调休" style={modalInput(colors)} />
              </FormField>
              <FormField label="关联考勤组" required colors={colors}>
                <select value={ruleDraft.attendGroup} onChange={event => updateRuleDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="规则内容" required colors={colors} full>
                <textarea value={ruleDraft.content} onChange={event => updateRuleDraft('content', event.target.value)} placeholder="例如：工作日：仅统计时长 / 休息日：折算为调休 / 节假日：按节假日加班核算" style={{ ...modalInput(colors), height: 82, resize: 'vertical', paddingTop: 8 }} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={ruleDraft.creator} onChange={event => updateRuleDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={ruleDraft.createdAt} onChange={event => updateRuleDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowRuleModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveRuleDraft} disabled={!ruleDraft.name.trim() || !ruleDraft.content.trim()} style={!ruleDraft.name.trim() || !ruleDraft.content.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存规则
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function FieldRulesView({
  colors,
  fieldRuleRows,
  groupOptions,
  onFieldRuleRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  fieldRuleRows: string[][];
  groupOptions: string[];
  onFieldRuleRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(fieldRuleRows);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<FieldRuleDraft>(() => emptyFieldRuleDraft(fieldRuleRows.length + 1, groupOptions[0] || '默认考勤组'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(fieldRuleRows);
  }, [fieldRuleRows]);

  const effectiveGroupOptions = Array.from(new Set([...groupOptions, '默认考勤组', ruleDraft.attendGroup].filter(Boolean)));
  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onFieldRuleRowsChange(next);
      void saveSettingsFieldRules(next).catch(() => window.alert('外勤规则已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyFieldRuleDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组'));
    setShowRuleModal(true);
  };

  const openEditRuleModal = (row: string[]) => {
    setEditingRuleId(createRowId(row));
    setRuleDraft(fieldRuleDraftFromRow(row));
    setShowRuleModal(true);
  };

  const updateRuleDraft = (key: keyof FieldRuleDraft, value: string) => {
    setRuleDraft(current => ({ ...current, [key]: value }));
  };

  const saveRuleDraft = () => {
    if (!ruleDraft.name.trim()) return;
    commitRows(current => {
      if (!editingRuleId) return [fieldRuleRowFromDraft(ruleDraft), ...current];
      return current.map(row => createRowId(row) === editingRuleId ? fieldRuleRowFromDraft(ruleDraft, row) : row);
    });
    setShowRuleModal(false);
  };

  const deleteRule = (row: string[]) => {
    const rowId = createRowId(row);
    setConfirmDelete({
      title: '删除外勤规则',
      message: `确认删除「${row[0] ?? '当前规则'}」？删除后外勤规则表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(item => createRowId(item) !== rowId));
        setConfirmDelete(null);
      },
    });
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => {
    if (label === '修改') openEditRuleModal(row);
    if (label === '删除') deleteRule(row);
  })]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="外勤规则" placeholder="请输入外勤规则名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateRuleModal} style={primaryBtn(colors)}>新增外勤规则</button>
        <button onClick={() => exportSettingsRows('外勤规则', FIELD_RULE_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable columns={FIELD_RULE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
      {showRuleModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 720,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingRuleId ? '修改外勤规则' : '新增外勤规则'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到外勤规则表格，并关联真实考勤组</div>
              </div>
              <button onClick={() => setShowRuleModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="规则名称" required colors={colors}>
                <input value={ruleDraft.name} onChange={event => updateRuleDraft('name', event.target.value)} placeholder="例如：外勤" style={modalInput(colors)} />
              </FormField>
              <FormField label="关联考勤组" required colors={colors}>
                <select value={ruleDraft.attendGroup} onChange={event => updateRuleDraft('attendGroup', event.target.value)} style={modalInput(colors)}>
                  {effectiveGroupOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="规则内容" required colors={colors} full>
                <textarea value={ruleDraft.content} onChange={event => updateRuleDraft('content', event.target.value)} placeholder="例如：外勤打卡已启用 / 外出申请已启用" style={{ ...modalInput(colors), height: 82, resize: 'vertical', paddingTop: 8 }} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={ruleDraft.creator} onChange={event => updateRuleDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={ruleDraft.createdAt} onChange={event => updateRuleDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowRuleModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveRuleDraft} disabled={!ruleDraft.name.trim() || !ruleDraft.content.trim()} style={!ruleDraft.name.trim() || !ruleDraft.content.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存规则
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function StatSchemesView({
  colors,
  statSchemeRows,
  groupOptions,
  onStatSchemeRowsChange,
  sourceInfo,
  loadError,
}: {
  colors: any;
  statSchemeRows: string[][];
  groupOptions: string[];
  onStatSchemeRowsChange: (rows: string[][]) => void;
  sourceInfo?: string;
  loadError?: string;
}) {
  const [rowsData, setRowsData] = useState<string[][]>(statSchemeRows);
  const [draftFilters, setDraftFilters] = useState({ name: '', employee: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [schemeDraft, setSchemeDraft] = useState<StatSchemeDraft>(() => emptyStatSchemeDraft(statSchemeRows.length + 1, groupOptions[0] || '默认考勤组'));
  const [confirmDelete, setConfirmDelete] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    setRowsData(statSchemeRows);
  }, [statSchemeRows]);

  const effectiveScopeOptions = Array.from(new Set([...groupOptions, '默认考勤组', schemeDraft.scope].filter(Boolean)));
  const commitRows = (updater: (rows: string[][]) => string[][]) => {
    setRowsData(current => {
      const next = updater(current);
      onStatSchemeRowsChange(next);
      void saveSettingsStatSchemes(next).catch(() => window.alert('统计方案已在页面更新，但保存到后端失败，请稍后重试'));
      return next;
    });
  };

  const filteredRows = useMemo(() => rowsData.filter(row => textIncludes(row[0], appliedFilters.name) && textIncludes(row.join(' '), appliedFilters.employee)), [appliedFilters, rowsData]);

  const openCreateSchemeModal = () => {
    setEditingSchemeId(null);
    setSchemeDraft(emptyStatSchemeDraft(rowsData.length + 1, groupOptions[0] || '默认考勤组'));
    setShowSchemeModal(true);
  };

  const openEditSchemeModal = (row: string[]) => {
    setEditingSchemeId(createRowId(row));
    setSchemeDraft(statSchemeDraftFromRow(row));
    setShowSchemeModal(true);
  };

  const updateSchemeDraft = (key: keyof StatSchemeDraft, value: string) => {
    setSchemeDraft(current => ({ ...current, [key]: value }));
  };

  const saveSchemeDraft = () => {
    if (!schemeDraft.name.trim()) return;
    commitRows(current => {
      if (!editingSchemeId) return [statSchemeRowFromDraft(schemeDraft), ...current];
      return current.map(row => createRowId(row) === editingSchemeId ? statSchemeRowFromDraft(schemeDraft, row) : row);
    });
    setShowSchemeModal(false);
  };

  const deleteScheme = (row: string[]) => {
    const rowId = createRowId(row);
    setConfirmDelete({
      title: '删除统计方案',
      message: `确认删除「${row[0] ?? '当前方案'}」？删除后统计方案表会立即更新。`,
      onConfirm: () => {
        commitRows(current => current.filter(item => createRowId(item) !== rowId));
        setConfirmDelete(null);
      },
    });
  };

  const copyScheme = (row: string[]) => {
    const draft = statSchemeDraftFromRow(row);
    commitRows(current => [statSchemeRowFromDraft({ ...draft, name: `${draft.name || '统计方案'}-副本`, creator: '后台维护', createdAt: nowText() }), ...current]);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['编辑', '复制', '删除'], label => {
    if (label === '编辑') openEditSchemeModal(row);
    if (label === '复制') copyScheme(row);
    if (label === '删除') deleteScheme(row);
  })]);
  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SearchField label="员工" placeholder="请输入姓名或员工号" colors={colors} width={210} showUserIcon value={draftFilters.employee} onChange={value => setDraftFilters(current => ({ ...current, employee: value }))} />
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateSchemeModal} style={primaryBtn(colors)}>新增方案</button>
        <button onClick={() => exportSettingsRows('统计方案', STAT_SCHEME_COLUMNS, filteredRows)} disabled={filteredRows.length === 0} style={exportBtn(colors, filteredRows.length === 0)}><Download size={14}/>导出Excel</button>
      </Toolbar>
      <DataTable columns={STAT_SCHEME_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
      {showSchemeModal ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.38)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: 760,
            maxWidth: 'calc(100vw - 48px)',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 52,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.cardBorder}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingSchemeId ? '编辑统计方案' : '新增统计方案'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>保存后会同步到统计方案表格，并可被考勤人员与统计汇总使用</div>
              </div>
              <button onClick={() => setShowSchemeModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <FormField label="方案名称" required colors={colors}>
                <input value={schemeDraft.name} onChange={event => updateSchemeDraft('name', event.target.value)} placeholder="例如：默认方案" style={modalInput(colors)} />
              </FormField>
              <FormField label="适用范围" required colors={colors}>
                <select value={schemeDraft.scope} onChange={event => updateSchemeDraft('scope', event.target.value)} style={modalInput(colors)}>
                  {effectiveScopeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </FormField>
              <FormField label="考勤周期" required colors={colors} full>
                <input value={schemeDraft.period} onChange={event => updateSchemeDraft('period', event.target.value)} placeholder="例如：当月1日至当月最后一天为【当月】的一个考勤统计周期" style={modalInput(colors)} />
              </FormField>
              <FormField label="业务停止规则" required colors={colors} full>
                <input value={schemeDraft.stopRule} onChange={event => updateSchemeDraft('stopRule', event.target.value)} placeholder="例如：部门：上海拉蜜克有限公司" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建人" colors={colors}>
                <input value={schemeDraft.creator} onChange={event => updateSchemeDraft('creator', event.target.value)} placeholder="后台维护" style={modalInput(colors)} />
              </FormField>
              <FormField label="创建时间" colors={colors}>
                <input value={schemeDraft.createdAt} onChange={event => updateSchemeDraft('createdAt', event.target.value)} placeholder="例如：2026-05-21 09:00" style={modalInput(colors)} />
              </FormField>
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.cardBorder}` }}>
              <button onClick={() => setShowSchemeModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={saveSchemeDraft} disabled={!schemeDraft.name.trim() || !schemeDraft.period.trim()} style={!schemeDraft.name.trim() || !schemeDraft.period.trim() ? disabledBtn(colors) : primaryBtn(colors)}>
                保存方案
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          colors={colors}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel={confirmDelete.confirmLabel}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
        />
      ) : null}
    </ListPage>
  );
}

function ListPage({ colors, children }: { colors: any; children: React.ReactNode }) {
  return <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.appBg }}>{children}</div>;
}

function SectionCard({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function FilterBar({ colors, children }: { colors: any; children: React.ReactNode }) {
  return <div style={{ padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>;
}

function Toolbar({ colors, children }: { colors: any; children: React.ReactNode }) {
  return <div style={{ padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>;
}

function DataTable({
  columns,
  rows,
  colors,
  withSelection = false,
  rowIds = [],
  selectedRowIds,
  onToggleRow,
  onToggleAll,
  sortConfig,
  onSortChange,
  nonSortableColumnIndices = [],
  emptyText = '暂无内容',
  footerText,
}: TableProps) {
  const [internalSortConfig, setInternalSortConfig] = useState<TableSortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const effectiveSortConfig = sortConfig ?? internalSortConfig;
  const sortableBlocked = new Set([
    ...nonSortableColumnIndices,
    ...columns.map((column, index) => column === '操作' ? index : -1).filter(index => index >= 0),
  ]);
  const sortedEntries = useMemo(() => {
    const entries = rows.map((row, index) => ({ row, rowId: rowIds[index] ?? String(index), originalIndex: index }));
    if (!effectiveSortConfig) return entries;
    return [...entries].sort((left, right) => {
      const compared = compareTableValues(left.row[effectiveSortConfig.index], right.row[effectiveSortConfig.index], effectiveSortConfig.direction);
      return compared || left.originalIndex - right.originalIndex;
    });
  }, [effectiveSortConfig, rowIds, rows]);
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedEntries = sortedEntries.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageButtons = getPaginationPages(safePage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, effectiveSortConfig?.index, effectiveSortConfig?.direction]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const changeSort = (index: number) => {
    if (onSortChange) onSortChange(index);
    else setInternalSortConfig(current => getNextTableSortConfig(current, index));
  };
  const colSpan = columns.length + (withSelection ? 1 : 0);
  const visibleRowIds = sortedEntries.map(entry => entry.rowId);
  const allSelected = sortedEntries.length > 0 && visibleRowIds.every(rowId => selectedRowIds?.has(rowId));
  return (
    <div style={{ backgroundColor: colors.cardBg, overflow: 'auto' }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
            {withSelection ? <th style={{ ...th(colors), width: 42 }}><input type="checkbox" checked={onToggleAll ? allSelected : undefined} onChange={onToggleAll} style={{ accentColor: colors.primary }} /></th> : null}
            {columns.map((column, columnIndex) => {
              const sortable = !sortableBlocked.has(columnIndex);
              const active = effectiveSortConfig?.index === columnIndex;
              return (
                <th key={column} style={{ ...th(colors), minWidth: column.length >= 6 ? 132 : 108 }}>
                  {sortable ? (
                    <SortHeaderButton
                      label={column}
                      active={active}
                      direction={active ? effectiveSortConfig?.direction : undefined}
                      colors={colors}
                      onClick={() => changeSort(columnIndex)}
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
              <td colSpan={colSpan} style={{ padding: '96px 0 120px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                <EmptyState colors={colors} text={emptyText} />
              </td>
            </tr>
          ) : (
            pagedEntries.map(({ row, rowId }, index) => (
              <tr key={rowId} style={{ backgroundColor: index % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                {withSelection ? <td style={td(colors)}><input type="checkbox" checked={onToggleRow ? (selectedRowIds?.has(rowId) ?? false) : undefined} onChange={() => onToggleRow?.(rowId)} style={{ accentColor: colors.primary }} /></td> : null}
                {row.map((cell, cellIndex) => <td key={cellIndex} style={td(colors)}>{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderTop: `1px solid ${colors.cardBorder}`, fontSize: '12px', color: colors.textMuted }}>
        <span>{footerText ?? `共${rows.length}笔`}{rows.length ? `，当前 ${((safePage - 1) * pageSize) + 1}-${Math.min(safePage * pageSize, rows.length)} 条` : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safePage <= 1} style={pagerBtn(colors, safePage <= 1)}>上一页</button>
          {pageButtons.map((page, index) => page === '...'
            ? <span key={`ellipsis-${index}`}>...</span>
            : <button key={page} onClick={() => setCurrentPage(page)} style={pagerBtn(colors, false, page === safePage)}>{page}</button>)}
          <button onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safePage >= totalPages} style={pagerBtn(colors, safePage >= totalPages)}>下一页</button>
          <span>20条/页</span>
        </div>
      </div>
    </div>
  );
}

function getPaginationPages(currentPage: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages).filter(page => page >= 1 && page <= totalPages).sort((left, right) => left - right);
  const result: Array<number | '...'> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('...');
    result.push(page);
  });
  return result;
}

function InfoBanner({ colors, messages }: { colors: any; messages: string[] }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 16px', backgroundColor: withAlpha(colors.primary, 0.08), borderBottom: `1px solid ${withAlpha(colors.primary, 0.14)}` }}>
      <AlertCircle size={14} style={{ color: colors.primary, marginTop: 1, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.map((message, index) => (
          <span key={index} style={{ fontSize: '12px', color: colors.text }}>{messages.length > 1 ? `${index + 1}. ` : ''}{message}</span>
        ))}
      </div>
      <button onClick={() => setVisible(false)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer' }}>×</button>
    </div>
  );
}

function TopTab({ label, active, onClick, colors }: { label: string; active: boolean; onClick: () => void; colors: any }) {
  return (
    <button onClick={onClick} style={{ padding: '10px 16px 9px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: active ? colors.primary : colors.text, fontWeight: active ? 600 : 400, borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </button>
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
        <input value={current} onChange={event => setCurrent(event.target.value)} placeholder={placeholder} style={textInput(colors)} />
        {showUserIcon ? <Users size={12} style={{ color: colors.textMuted }} /> : null}
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({ label, placeholder, colors, width = 148, options = [], value, onChange }: { label: string; placeholder: string; colors: any; width?: number; options?: string[]; value?: string; onChange?: (value: string) => void }) {
  const [innerValue, setInnerValue] = useState('');
  const current = value ?? innerValue;
  const setCurrent = (next: string) => onChange ? onChange(next) : setInnerValue(next);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        {options.length || onChange ? (
          <select value={current} onChange={event => setCurrent(event.target.value)} style={{ ...textInput(colors), color: current ? colors.text : colors.textMuted }}>
            <option value="">{placeholder}</option>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeholder}</span>
        )}
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function DateRangeField({ label, colors, width = 236, start, end, onChange }: { label: string; colors: any; width?: number; start?: string; end?: string; onChange?: (start: string, end: string) => void }) {
  const [innerStart, setInnerStart] = useState(monthStartISO());
  const [innerEnd, setInnerEnd] = useState(monthEndISO());
  const currentStart = start ?? innerStart;
  const currentEnd = end ?? innerEnd;
  const setStart = (value: string) => onChange ? onChange(value, currentEnd) : setInnerStart(value);
  const setEnd = (value: string) => onChange ? onChange(currentStart, value) : setInnerEnd(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input type="date" value={currentStart} onChange={event => setStart(event.target.value)} style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input type="date" value={currentEnd} onChange={event => setEnd(event.target.value)} style={dateInput(colors)} />
      </div>
    </div>
  );
}

function CheckboxGroup({ label, items, colors, value, onChange }: { label: string; items: string[]; colors: any; value?: string[]; onChange?: (value: string[]) => void }) {
  const [innerValue, setInnerValue] = useState(items.filter((_, index) => index !== 1));
  const current = value ?? innerValue;
  const toggleItem = (item: string) => {
    const next = current.includes(item) ? current.filter(valueItem => valueItem !== item) : [...current, item];
    if (onChange) onChange(next);
    else setInnerValue(next);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      {items.map(item => (
        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
          <input type="checkbox" checked={current.includes(item)} onChange={() => toggleItem(item)} style={{ accentColor: colors.primary }} />
          {item}
        </label>
      ))}
    </div>
  );
}

function FormField({ label, required = false, full = false, colors, children }: { label: string; required?: boolean; full?: boolean; colors: any; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, color: colors.textMuted }}>
        {required ? <span style={{ color: colors.primary, marginRight: 3 }}>*</span> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleSwitch({ checked, onClick, colors }: { checked?: boolean; onClick?: () => void; colors: any }) {
  return (
    <button onClick={onClick} style={{ width: 30, height: 16, borderRadius: 999, border: 'none', backgroundColor: checked ? colors.primary : withAlpha(colors.textMuted, 0.32), position: 'relative', cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', left: checked ? 16 : 2, top: 2, transition: 'all 0.2s' }} />
    </button>
  );
}

function TagPill({ colors, label, count, active = false, onClick }: { colors: any; label: string; count: string; active?: boolean; onClick?: () => void }) {
  return <button onClick={onClick} style={{ border: 'none', padding: '4px 10px', borderRadius: 999, fontSize: '12px', color: active ? '#fff' : colors.textMuted, backgroundColor: active ? colors.primary : colors.tableHeaderBg, cursor: onClick ? 'pointer' : 'default' }}>{label}({count})</button>;
}

function pagerBtn(colors: any, disabled = false, active = false): React.CSSProperties {
  return {
    minWidth: 28,
    height: 26,
    padding: '0 8px',
    border: `1px solid ${active ? colors.primary : colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: active ? colors.primary : 'transparent',
    color: active ? '#fff' : disabled ? colors.textMuted : colors.text,
    fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}

function EmptyState({ colors, text }: { colors: any; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: colors.statCardBg, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <FileText size={24} style={{ color: colors.textMuted }} />
        <span style={{ position: 'absolute', top: -7, right: -6, backgroundColor: colors.primary, color: '#fff', borderRadius: 9, fontSize: '10px', lineHeight: 1, padding: '4px 5px', fontWeight: 600 }}>...</span>
      </div>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>{text}</span>
    </div>
  );
}

function getShiftRowId(row: string[]) {
  return [row[0], row[1], row[5], row[7], row[8]].map(value => String(value ?? '')).join('|');
}

function setShiftRowCell(row: string[], index: number, value: string) {
  const next = [...row];
  while (next.length < SHIFT_COLUMNS.length - 1) next.push('-');
  next[index] = value;
  return next;
}

function getNextTableSortConfig(current: TableSortConfig | null, index: number): TableSortConfig {
  if (!current || current.index !== index) return { index, direction: 'asc' };
  return { index, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

function compareTableValues(left: unknown, right: unknown, direction: TableSortConfig['direction']) {
  const factor = direction === 'asc' ? 1 : -1;
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');
  const leftNumber = Number(leftText.replace(/[^\d.-]/g, ''));
  const rightNumber = Number(rightText.replace(/[^\d.-]/g, ''));

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftText !== '' && rightText !== '') {
    return (leftNumber - rightNumber) * factor;
  }

  return leftText.localeCompare(rightText, 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
}

function uniqueShiftTags(rows: string[][]) {
  return Array.from(new Set(
    rows
      .map(row => String(row[3] ?? '').trim())
      .filter(tag => tag && tag !== '-' && tag !== '●'),
  ));
}

function shiftColorCell(colors: any, value: React.ReactNode) {
  const color = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#B53A2A';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: color, border: `1px solid ${colors.cardBorder}` }} />
      <span style={{ color: colors.textMuted }}>{color}</span>
    </span>
  );
}

function normalizeShiftImportRows(rows: unknown[][]) {
  return rows
    .map(row => row.map(cell => String(cell ?? '').trim()))
    .filter(row => row.some(Boolean))
    .filter(row => row[0] && row[0] !== SHIFT_COLUMNS[0])
    .map(row => {
      const next = row.slice(0, SHIFT_COLUMNS.length - 1);
      while (next.length < SHIFT_COLUMNS.length - 1) next.push('-');
      if (!/^#[0-9a-f]{6}$/i.test(next[2] || '')) next[2] = '#B53A2A';
      return next;
    });
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

async function readShiftImportFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer());
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], { header: 1 });
    return normalizeShiftImportRows(sheetRows);
  }

  if (name.endsWith('.csv')) {
    return normalizeShiftImportRows(parseCsv(await file.text()));
  }

  throw new Error('导入失败：仅支持 CSV、XLSX 或 XLS 文件');
}

function toCsv(rows: Array<Array<React.ReactNode>>) {
  return rows.map(row => row.map(cell => {
    const value = String(cell ?? '');
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',')).join('\n');
}

function rowActionLinks(colors: any, labels: string[], onAction: (label: string) => void) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {labels.map(label => (
        <button key={label} onClick={() => onAction(label)} style={textLink(colors)}>{label}</button>
      ))}
    </div>
  );
}

function emptyActionCell(colors: any) {
  return <span style={{ color: colors.textMuted }}>-</span>;
}

function createRowId(row: string[]) {
  return row.map(value => String(value ?? '')).join('|');
}

function setRowCell(row: string[], index: number, value: string) {
  const next = [...row];
  while (next.length <= index) next.push('-');
  next[index] = value;
  return next;
}

function filterRowsByText(rows: string[][], keyword: string, indices: number[]) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter(row => indices.some(index => String(row[index] ?? '').toLowerCase().includes(normalized)));
}

function textIncludes(value: unknown, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  return !normalized || String(value ?? '').toLowerCase().includes(normalized);
}

function uniqueOptions(rows: string[][], index: number) {
  return Array.from(new Set(rows.map(row => String(row[index] ?? '').trim()).filter(value => value && value !== '-')));
}

function nowText() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toggleSelectedRow(setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>, rowId: string) {
  setSelectedRowIds(current => {
    const next = new Set(current);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    return next;
  });
}

function toggleAllVisibleRows(setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>, rowIds: string[]) {
  setSelectedRowIds(current => {
    const allSelected = rowIds.length > 0 && rowIds.every(rowId => current.has(rowId));
    if (allSelected) return new Set([...current].filter(rowId => !rowIds.includes(rowId)));
    return new Set([...current, ...rowIds]);
  });
}

function downloadCsv(columns: string[], rows: string[][], filename: string) {
  if (!rows.length) {
    window.alert('没有可导出的数据');
    return;
  }
  void downloadAttendanceXlsx({
    fileName: filename,
    sheetName: filename.replace(/\.[^.]+$/, ''),
    headers: columns,
    rows,
    saveAs: true,
  });
}

function exportSettingsRows(title: string, columns: string[], rows: unknown[][], selected = false) {
  const exportColumns = columns.filter(column => column !== '操作');
  void downloadAttendanceXlsx({
    fileName: `${title}${selected ? '-选中数据' : '-筛选结果'}.xlsx`,
    sheetName: title,
    headers: exportColumns,
    rows: rows.map(row => exportColumns.map((_, index) => textCell(row[index]))),
    emptyMessage: `暂无可导出的${title}数据`,
    saveAs: true,
  });
}

function inDateRange(value: string | undefined, start: string, end: string) {
  const date = String(value ?? '').slice(0, 10);
  if (!date || date === '-') return true;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function InlineNotice({ colors, text }: { colors: any; text: string }) {
  return <div style={{ margin: '8px 16px', padding: '8px 12px', borderRadius: 6, backgroundColor: colors.tableHeaderBg, border: `1px solid ${colors.tableBorder}`, fontSize: '12px', color: colors.text }}>{text}</div>;
}

function SortHeaderButton({
  label,
  active,
  direction,
  colors,
  onClick,
}: {
  label: string;
  active: boolean;
  direction?: TableSortConfig['direction'];
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

const rightActionRow: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 };

function withAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const parsed = Number.parseInt(hex, 16);
    const r = (parsed >> 16) & 255;
    const g = (parsed >> 8) & 255;
    const b = parsed & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  return color;
}

function fieldShell(colors: any, width: number): React.CSSProperties {
  return { width, minHeight: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, boxSizing: 'border-box' };
}

function textInput(colors: any): React.CSSProperties {
  return { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: colors.text };
}

function dateInput(colors: any): React.CSSProperties {
  return { width: 92, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: colors.text };
}

function modalInput(colors: any): React.CSSProperties {
  return {
    width: '100%',
    height: 34,
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

function primaryBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: 'none', borderRadius: 4, backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' };
}

function outlineBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.text, fontSize: '12px', cursor: 'pointer' };
}

function exportBtn(colors: any, disabled = false): React.CSSProperties {
  return {
    height: 32,
    border: 'none',
    borderRadius: 4,
    background: disabled ? colors.inputBorder : colors.primary,
    color: disabled ? colors.textMuted : (colors.primaryText || '#fff'),
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

function disabledBtn(colors: any): React.CSSProperties {
  return { ...outlineBtn(colors), color: colors.textMuted, cursor: 'not-allowed', opacity: 0.55 };
}

function toggleBtn(colors: any, active: boolean): React.CSSProperties {
  return { ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: active ? colors.primary : colors.text, borderColor: active ? colors.primary : colors.inputBorder, backgroundColor: active ? colors.badgeBlueBg : 'transparent' };
}

function linkBtn(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
}

function iconBtn(colors: any): React.CSSProperties {
  return { width: 28, height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
}

function textLink(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', padding: 0, cursor: 'pointer' };
}

function th(colors: any): React.CSSProperties {
  return { padding: '10px 12px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', backgroundColor: colors.tableHeaderBg };
}

function td(colors: any): React.CSSProperties {
  return { padding: '9px 12px', fontSize: '12px', color: colors.text, borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', verticalAlign: 'top' };
}

