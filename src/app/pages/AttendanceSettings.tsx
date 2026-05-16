import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { deleteOnboardedEmployees, fetchSettingsFace, fetchSettingsPeople, fetchSettingsShifts, onboardEmployee, saveSettingsShifts } from '../api/realData';
import { monthEndISO, monthStartISO, todayISO } from '../utils/date';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
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

type ShiftOption = {
  id: string;
  name: string;
  time: string;
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
  { key: 'overview', label: '配置总览', path: '/attendance/settings' },
  { key: 'groups', label: '考勤组管理', path: '/attendance/settings/groups' },
  { key: 'shifts', label: '班次管理', path: '/attendance/settings/shifts' },
  { key: 'people', label: '考勤人员', path: '/attendance/settings/people' },
  { key: 'card-rules', label: '打卡规则', path: '/attendance/settings/card-rules' },
  { key: 'mobile-clock', label: '移动打卡方案', path: '/attendance/settings/mobile-clock' },
  { key: 'location', label: '上班地点', path: '/attendance/settings/location' },
  { key: 'face', label: '人脸管理', path: '/attendance/settings/face' },
  { key: 'devices', label: '考勤机管理', path: '/attendance/settings/devices' },
  { key: 'holiday', label: '节假日管理', path: '/attendance/settings/holiday' },
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
    title: '假期方案',
    desc: '通过假期方案配置各类假期的发放、申请、优先级和额度计算规则。',
    extra: '共0个方案',
    path: '/attendance/leave-scheme',
    badge: '3',
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
  const [peopleRows, setPeopleRows] = useState<string[][]>([]);
  const [faceRows, setFaceRows] = useState<string[][]>([]);
  const [sourceInfo, setSourceInfo] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadSettingsData = useCallback(async () => {
    try {
      const [shifts, people, face] = await Promise.all([
        fetchSettingsShifts(),
        fetchSettingsPeople(),
        fetchSettingsFace(),
      ]);
      setShiftRows(shifts.rows || []);
      setPeopleRows(people.rows || []);
      setFaceRows(face.rows || []);
      setSourceInfo(`班次：${shifts.sourceFile}；人员：${people.sourceFile}；人脸：${face.sourceFile}`);
      setLoadError('');
    } catch (_error) {
      setLoadError('真实设置数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const activeView = useMemo<SettingView>(() => {
    if (location.pathname === '/attendance/settings') return 'overview';
    const sub = location.pathname.split('/').pop() ?? '';
    return LEGACY_ALIAS[sub] ?? (ROUTE_TABS.find(tab => tab.path === location.pathname)?.key ?? 'overview');
  }, [location.pathname]);
  const shiftOptions = useMemo(() => shiftOptionsFromRows(shiftRows), [shiftRows]);

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
        <button onClick={() => navigate('/attendance/settings')} title="返回配置总览" style={{ marginLeft: 4, padding: '2px 10px', fontSize: '12px', border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: 'pointer', background: 'transparent', color: colors.textMuted, flexShrink: 0 }}>×</button>
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
      {activeView === 'groups' && <GroupsView colors={colors} showMore={!!showMore.groups} onToggleMore={() => toggleMore('groups')} />}
      {activeView === 'shifts' && <ShiftsView colors={colors} showMore={!!showMore.shifts} onToggleMore={() => toggleMore('shifts')} shiftRows={shiftRows} onShiftRowsChange={setShiftRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'people' && <PeopleView colors={colors} showMore={!!showMore.people} onToggleMore={() => toggleMore('people')} peopleRows={peopleRows} sourceInfo={sourceInfo} loadError={loadError} />}
      {activeView === 'card-rules' && <CardRulesView colors={colors} />}
      {activeView === 'mobile-clock' && <MobileClockView colors={colors} />}
      {activeView === 'location' && <LocationView colors={colors} showMore={!!showMore.location} onToggleMore={() => toggleMore('location')} />}
      {activeView === 'face' && <FaceView
        colors={colors}
        showMore={!!showMore.face}
        onToggleMore={() => toggleMore('face')}
        faceRows={faceRows}
        shiftOptions={shiftOptions}
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
      {activeView === 'holiday' && <HolidayView colors={colors} />}
      {activeView === 'calendar' && <CalendarView colors={colors} />}
      {activeView === 'overtime-rules' && <OvertimeRulesView colors={colors} />}
      {activeView === 'field-rules' && <FieldRulesView colors={colors} />}
      {activeView === 'stat-schemes' && <StatSchemesView colors={colors} />}
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
    if (!window.confirm('确认删除该考勤周期？')) return;
    setPeriodRows(rows => rows.filter((_, rowIndex) => rowIndex !== index));
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
    </div>
  );
}

function GroupsView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const [rowsData, setRowsData] = useState<string[][]>(GROUP_ROWS);
  const [draftFilters, setDraftFilters] = useState({ name: '', types: ['排班制'] });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [peopleMode, setPeopleMode] = useState<'schedule' | 'shift'>('schedule');

  const filteredRows = useMemo(() => {
    const nameKeyword = appliedFilters.name.trim().toLowerCase();
    return rowsData.filter(row => {
      const matchName = !nameKeyword || String(row[0] ?? '').toLowerCase().includes(nameKeyword);
      const matchType = !appliedFilters.types.length || appliedFilters.types.includes(String(row[1] ?? ''));
      const matchMode = peopleMode === 'schedule' || String(row[3] ?? '').includes('/');
      return matchName && matchType && matchMode;
    });
  }, [appliedFilters, peopleMode, rowsData]);

  const resetFilters = () => {
    const next = { name: '', types: ['排班制'] };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const addGroup = (source = '手动创建') => {
    const name = window.prompt('请输入考勤组名称', `新建考勤组${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '排班制', '部门：待配置', '早九晚六', source, nowText(), source, nowText()], ...current]);
  };

  const importGroups = () => {
    setRowsData(current => [
      [`导入考勤组${current.length + 1}`, '排班制', '部门：导入组织', '早十晚七', '导入', nowText(), '导入', nowText()],
      ...current,
    ]);
  };

  const handleAction = (label: string, row: string[]) => {
    const rowId = createRowId(row);
    if (label === '修改') {
      const nextName = window.prompt('请输入考勤组名称', row[0] ?? '');
      if (nextName === null) return;
      const trimmed = nextName.trim();
      if (!trimmed) return;
      setRowsData(current => current.map(item => createRowId(item) === rowId ? setRowCell(item, 0, trimmed) : item));
      return;
    }
    if (label === '排班') {
      setRowsData(current => current.map(item => createRowId(item) === rowId ? setRowCell(item, 3, '已更新排班') : item));
      return;
    }
    window.alert(`考勤组：${row[0] ?? '-'}`);
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '排班', '...'], label => handleAction(label, row))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="考勤组名称" placeholder="请输入" colors={colors} width={180} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <CheckboxGroup label="考勤类型" items={['固定班制', '排班制', '自由工时']} colors={colors} value={draftFilters.types} onChange={types => setDraftFilters(current => ({ ...current, types }))} />
        <div style={rightActionRow}>
          <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={() => addGroup()} style={primaryBtn(colors)}>新建考勤组</button>
        <button onClick={importGroups} style={outlineBtn(colors)}>重新导入</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TagPill colors={colors} label="排班人员" count={String(rowsData.length)} active={peopleMode === 'schedule'} onClick={() => setPeopleMode('schedule')} />
          <TagPill colors={colors} label="班次人员" count={String(rowsData.filter(row => String(row[3] ?? '').includes('/')).length)} active={peopleMode === 'shift'} onClick={() => setPeopleMode('shift')} />
        </div>
      </Toolbar>
      <DataTable columns={GROUP_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}条 / 总${rowsData.length}条`} />
    </ListPage>
  );
}

function SourceNotice({ sourceInfo, loadError }: { sourceInfo?: string; loadError?: string }) {
  if (!sourceInfo && !loadError) return null;
  return <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 6, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', flexShrink: 0 }}>{sourceInfo ? `已连接真实数据源：${sourceInfo}` : ''}{loadError ? ` ${loadError}` : ''}</div>;
}

function ShiftsView({ colors, showMore, onToggleMore, shiftRows, onShiftRowsChange, sourceInfo, loadError }: { colors: any; showMore: boolean; onToggleMore: () => void; shiftRows: string[][]; onShiftRowsChange: (rows: string[][]) => void; sourceInfo?: string; loadError?: string }) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [rowsData, setRowsData] = useState<string[][]>(shiftRows);
  const [draftFilters, setDraftFilters] = useState({ name: '', tag: '' });
  const [appliedFilters, setAppliedFilters] = useState({ name: '', tag: '' });
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [sortConfig, setSortConfig] = useState<TableSortConfig | null>(null);

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
    shiftActionLinks(colors, row, {
      onDetail: () => window.alert(`班次详情\n名称：${row[0] ?? '-'}\n出勤时间：${row[5] ?? '-'}\n适用考勤组：${row[7] ?? '-'}`),
      onEdit: () => {
        const nextName = window.prompt('请输入新的班次名称', String(row[0] ?? ''));
        if (nextName === null) return;
        const trimmedName = nextName.trim();
        if (!trimmedName) {
          window.alert('班次名称不能为空');
          return;
        }
        commitRows(current => current.map(item => getShiftRowId(item) === getShiftRowId(row) ? [trimmedName, ...item.slice(1)] : item));
      },
      onMore: () => window.alert(`更多操作\n可对「${row[0] ?? '-'}」执行复制、停用或查看引用。`),
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
    if (!window.confirm(`确认删除选中的 ${visibleSelectedIds.length} 个班次？`)) return;
    commitRows(current => current.filter(row => !selectedRowIds.has(getShiftRowId(row))));
    setSelectedRowIds(new Set());
  };

  const addShift = () => {
    const name = window.prompt('请输入班次名称', `新建班次${rowsData.length + 1}`);
    if (name === null) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      window.alert('班次名称不能为空');
      return;
    }
    const shortName = window.prompt('请输入班次简称', trimmedName.slice(0, 8))?.trim() || trimmedName.slice(0, 8);
    commitRows(current => [[trimmedName, shortName, '#B53A2A', '-', '通用', '09:00-18:00(正常出勤)', '8小时', '通用', '后台维护', nowText(), '后台维护', nowText()], ...current]);
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

  const exportRows = () => {
    const selectedRows = sortedRows.filter(row => selectedRowIds.has(getShiftRowId(row)));
    const exportData = selectedRows.length ? selectedRows : sortedRows;
    if (!exportData.length) {
      window.alert('没有可导出的班次数据');
      return;
    }
    const csv = toCsv([SHIFT_COLUMNS.slice(0, -1), ...exportData]);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedRows.length ? '班次管理-选中数据.csv' : '班次管理-筛选结果.csv';
    link.click();
    window.URL.revokeObjectURL(url);
    window.alert(`已导出${selectedRows.length ? '选中' : '当前筛选'}数据：${exportData.length} 条`);
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
      <InfoBanner colors={colors} messages={['设置每天上下班时间，打卡时间范围和弹性打卡规则，完成后可在考勤组、新增员工和管理员排班中使用。']} />
      <FilterBar colors={colors}>
        <SearchField label="班次名称" placeholder="请输入" colors={colors} width={180} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SelectField label="标签名称" placeholder="请选择标签" colors={colors} width={160} options={tagOptions} value={draftFilters.tag} onChange={value => setDraftFilters(current => ({ ...current, tag: value }))} />
        <div style={rightActionRow}>
          <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
          <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
            标签管理
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
        {showMore && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>标签</span>
            {tagOptions.length ? tagOptions.map(tag => (
              <button key={tag} onClick={() => removeTag(tag)} title="点击删除未使用标签" style={{ ...toggleBtn(colors, appliedFilters.tag === tag), height: 26 }}>
                {tag} ×
              </button>
            )) : <span style={{ fontSize: '12px', color: colors.textMuted }}>暂无标签</span>}
            <input value={newTagName} onChange={event => setNewTagName(event.target.value)} placeholder="新增标签" style={{ ...textInput(colors), flex: '0 0 140px', height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '0 8px' }} />
            <button onClick={addTag} style={outlineBtn(colors)}>新增标签</button>
          </div>
        )}
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addShift} style={primaryBtn(colors)}>新建班次</button>
        <button onClick={() => importInputRef.current?.click()} style={outlineBtn(colors)}>导入班次</button>
        <button onClick={exportRows} style={outlineBtn(colors)}>导出</button>
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
    </ListPage>
  );
}

function PeopleView({ colors, showMore, onToggleMore, peopleRows, sourceInfo, loadError }: { colors: any; showMore: boolean; onToggleMore: () => void; peopleRows: string[][]; sourceInfo?: string; loadError?: string }) {
  const [rowsData, setRowsData] = useState<string[][]>(peopleRows);
  const [draftFilters, setDraftFilters] = useState({ keyword: '', dept: '', group: '', scheme: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [peopleMode, setPeopleMode] = useState<'all' | 'scheduled'>('all');
  const [hideDeparted, setHideDeparted] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);

  useEffect(() => {
    setRowsData(peopleRows);
  }, [peopleRows]);

  const filteredRows = useMemo(() => {
    const keyword = appliedFilters.keyword.trim().toLowerCase();
    return rowsData.filter(row => {
      const matchKeyword = !keyword || [row[0], row[1]].some(value => String(value ?? '').toLowerCase().includes(keyword));
      const matchDept = !appliedFilters.dept || row[2] === appliedFilters.dept;
      const matchGroup = !appliedFilters.group || row[12] === appliedFilters.group;
      const matchScheme = !appliedFilters.scheme || row[13] === appliedFilters.scheme;
      const matchMode = peopleMode === 'all' || Boolean(row[5] && row[5] !== '-');
      const matchStatus = !hideDeparted || row[8] !== '离职';
      return matchKeyword && matchDept && matchGroup && matchScheme && matchMode && matchStatus;
    });
  }, [appliedFilters, hideDeparted, peopleMode, rowsData]);

  const resetFilters = () => {
    const next = { keyword: '', dept: '', group: '', scheme: '' };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['详情', '...'], label => window.alert(`${label}\n姓名：${row[0] ?? '-'}\n考勤组：${row[12] ?? '-'}`))]);
  const deptOptions = uniqueOptions(rowsData, 2);
  const groupOptions = uniqueOptions(rowsData, 12);
  const schemeOptions = uniqueOptions(rowsData, 13);

  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <FilterBar colors={colors}>
        <SearchField label="姓名/员工工号" placeholder="请输入姓名/员工工号" colors={colors} width={210} showUserIcon value={draftFilters.keyword} onChange={value => setDraftFilters(current => ({ ...current, keyword: value }))} />
        <SelectField label="部门" placeholder="请选择" colors={colors} width={150} options={deptOptions} value={draftFilters.dept} onChange={value => setDraftFilters(current => ({ ...current, dept: value }))} />
        <SelectField label="考勤组" placeholder="请选择" colors={colors} width={150} options={groupOptions} value={draftFilters.group} onChange={value => setDraftFilters(current => ({ ...current, group: value }))} />
        <SelectField label="统计方案" placeholder="请选择" colors={colors} width={150} options={schemeOptions} value={draftFilters.scheme} onChange={value => setDraftFilters(current => ({ ...current, scheme: value }))} />
        <div style={rightActionRow}>
          <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <TagPill colors={colors} label="全部人员" count={String(rowsData.length)} active={peopleMode === 'all'} onClick={() => setPeopleMode('all')} />
        <TagPill colors={colors} label="排班人员" count={String(rowsData.filter(row => row[5] && row[5] !== '-').length)} active={peopleMode === 'scheduled'} onClick={() => setPeopleMode('scheduled')} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
            <input type="checkbox" checked={hideDeparted} onChange={event => setHideDeparted(event.target.checked)} style={{ accentColor: colors.primary }} />
            不显示离职员工
          </label>
          <button onClick={() => setSyncVisible(current => !current)} style={textLink(colors)}>CRM同步记录</button>
          <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
            更多筛选
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </Toolbar>
      {syncVisible ? <InlineNotice colors={colors} text={`最近同步：${nowText()}，新增0人，更新${rowsData.length}人，失败0人。`} /> : null}
      <DataTable columns={PEOPLE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔 / 总${rowsData.length}笔`} />
    </ListPage>
  );
}

function CardRulesView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(CARD_RULE_ROWS);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);
  const addRule = () => {
    const name = window.prompt('请输入打卡规则名称', `新增打卡规则${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '允许移动端与考勤机打卡', '默认考勤组', '手动创建', nowText(), '手动创建', nowText()], ...current]);
  };
  const handleAction = (label: string, row: string[]) => mutateNamedRow(label, row, rowsData, setRowsData, 0);
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => handleAction(label, row))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="规则名称" placeholder="请输入规则名称" colors={colors} width={200} value={draftName} onChange={setDraftName} />
        <div style={rightActionRow}>
          <button onClick={() => { setDraftName(''); setAppliedName(''); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedName(draftName)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addRule} style={primaryBtn(colors)}>新增打卡规则</button>
      </Toolbar>
      <DataTable columns={CARD_RULE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
    </ListPage>
  );
}

function MobileClockView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(MOBILE_ROWS);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);
  const addScheme = () => {
    const name = window.prompt('请输入移动打卡方案名称', `移动打卡方案${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, 'GPS/Wi-Fi/蓝牙均可打卡', '默认考勤组', '手动创建', nowText(), '手动创建', nowText()], ...current]);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => mutateNamedRow(label, row, rowsData, setRowsData, 0))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
        <div style={rightActionRow}>
          <button onClick={() => { setDraftName(''); setAppliedName(''); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedName(draftName)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addScheme} style={primaryBtn(colors)}>新建方案</button>
      </Toolbar>
      <DataTable columns={MOBILE_COLUMNS} rows={rows} colors={colors} emptyText="暂无内容" footerText={`共${filteredRows.length}笔`} />
    </ListPage>
  );
}

function LocationView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const [rowsData, setRowsData] = useState<string[][]>(LOCATION_ROWS);
  const [draftFilters, setDraftFilters] = useState({ name: '', gps: '', wifi: '', bluetooth: '', mobile: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

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

  const addLocation = (source = '手动创建') => {
    const name = window.prompt('请输入上班地点名称', `上班地点${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '默认考勤组', '上海市静安区南京西路', '蓝牙-A1', 'Office-WiFi', '默认移动打卡方案', source, nowText(), source, nowText()], ...current]);
  };

  const importLocation = () => {
    setRowsData(current => [[`导入地点${current.length + 1}`, '华北大区', '杭州市西湖区', '蓝牙-IMPORT', 'Guest-WiFi', '导入移动方案', '导入', nowText(), '导入', nowText()], ...current]);
  };

  const deleteSelected = () => {
    const visibleSelectedIds = rowIds.filter(rowId => selectedRowIds.has(rowId));
    if (!visibleSelectedIds.length) {
      window.alert('请先选择要删除的上班地点');
      return;
    }
    if (!window.confirm(`确认删除选中的 ${visibleSelectedIds.length} 个上班地点？`)) return;
    setRowsData(current => current.filter(row => !visibleSelectedIds.includes(createRowId(row))));
    setSelectedRowIds(new Set());
  };

  const exportRows = () => {
    const selectedRows = filteredRows.filter(row => selectedRowIds.has(createRowId(row)));
    downloadCsv(LOCATION_COLUMNS.slice(0, -1), selectedRows.length ? selectedRows : filteredRows, selectedRows.length ? '上班地点-选中数据.csv' : '上班地点-筛选结果.csv');
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => mutateNamedRow(label, row, rowsData, setRowsData, 0))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="上班地点" placeholder="请输入" colors={colors} width={180} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SearchField label="GPS打卡地址" placeholder="请输入" colors={colors} width={180} value={draftFilters.gps} onChange={value => setDraftFilters(current => ({ ...current, gps: value }))} />
        <SearchField label="打卡Wi-Fi" placeholder="请输入" colors={colors} width={160} value={draftFilters.wifi} onChange={value => setDraftFilters(current => ({ ...current, wifi: value }))} />
        <SearchField label="打卡蓝牙" placeholder="请输入" colors={colors} width={160} value={draftFilters.bluetooth} onChange={value => setDraftFilters(current => ({ ...current, bluetooth: value }))} />
        <SearchField label="移动打卡方案" placeholder="请输入" colors={colors} width={180} value={draftFilters.mobile} onChange={value => setDraftFilters(current => ({ ...current, mobile: value }))} />
        <div style={rightActionRow}>
          <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
          <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
            更多筛选
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={() => addLocation()} style={primaryBtn(colors)}>新建上班地点</button>
        <button onClick={importLocation} style={outlineBtn(colors)}>导入</button>
        <button onClick={exportRows} style={outlineBtn(colors)}>导出</button>
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
    </ListPage>
  );
}

function FaceView({
  colors,
  showMore,
  onToggleMore,
  faceRows,
  shiftOptions,
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
  sourceInfo?: string;
  loadError?: string;
  onEmployeeCreated: (peopleRow: string[], faceRow: string[]) => void;
  onEmployeeDeleted: (employeeNos: string[]) => void;
}) {
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

  useEffect(() => {
    setRowsData(faceRows);
    setSelectedRowIds(new Set());
  }, [faceRows]);

  const filteredRows = useMemo(() => rowsData.filter(row => {
    const employeeKeyword = appliedFilters.employee.trim().toLowerCase();
    const matchEmployee = !employeeKeyword || [row[0], row[1]].some(value => String(value ?? '').toLowerCase().includes(employeeKeyword));
    const matchDept = !appliedFilters.dept || row[2] === appliedFilters.dept;
    const matchGroup = !appliedFilters.group || row[4] === appliedFilters.group;
    const matchStatus = !appliedFilters.status || row[6] === appliedFilters.status;
    const matchDate = inDateRange(row[5], appliedFilters.start, appliedFilters.end);
    const matchDeparted = !hideDeparted || !String(row[7] ?? '').includes('离职');
    return matchEmployee && matchDept && matchGroup && matchStatus && matchDate && matchDeparted;
  }), [appliedFilters, hideDeparted, rowsData]);
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
      const managerNo = employeeDraft.managerNo.trim();
      const managerRow = rowsData.find(row => String(row[1] ?? '').trim() === managerNo);
      const managerName = managerNo ? String(managerRow?.[0] ?? employeeDraft.managerName).trim() : '';
      const result = await onboardEmployee({
        name: trimmedName,
        employeeNo: trimmedNo,
        department,
        deptFullPath: DEPT_FULL_PATH_BY_NAME[department] || `上海拉迷家具有限公司/${department}`,
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
    if (!window.confirm(`确认删除选中的 ${selectedEmployeeNos.length} 名员工？删除后将同步移除考勤人员、人脸、小程序打卡记录和所有联动统计。`)) return;
    try {
      setDeletingEmployee(true);
      await deleteOnboardedEmployees(selectedEmployeeNos);
      const employeeNoSet = new Set(selectedEmployeeNos);
      setRowsData(current => current.filter(row => !employeeNoSet.has(String(row[1] ?? '').trim())));
      onEmployeeDeleted(selectedEmployeeNos);
      setSelectedRowIds(new Set());
      setReminderRecords(current => [`${nowText()} 已同步删除员工：${selectedEmployeeNos.join('、')}`, ...current]);
      setShowReminderRecords(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除员工失败');
    } finally {
      setDeletingEmployee(false);
    }
  };

  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['详情', '发送录入提醒'], label => {
    if (label === '发送录入提醒') {
      addReminderRecord(`已向${row[0] ?? '-'}发送录入提醒`);
      return;
    }
    window.alert(`人脸详情\n姓名：${row[0] ?? '-'}\n录入状态：${row[6] ?? '-'}`);
  })]);
  const deptOptions = uniqueOptions(rowsData, 2);
  const managerOptions = rowsData
    .map(row => ({ employeeNo: String(row[1] ?? '').trim(), name: String(row[0] ?? '').trim() }))
    .filter(item => item.employeeNo && item.employeeNo !== employeeDraft.employeeNo.trim());
  const groupOptions = uniqueOptions(rowsData, 4);
  const statusOptions = uniqueOptions(rowsData, 6);

  return (
    <ListPage colors={colors}>
      <SourceNotice sourceInfo={sourceInfo} loadError={loadError} />
      <InfoBanner colors={colors} messages={['员工打卡进件时，若【打卡】或【设置】-【人脸管理】未录入人脸，则看开启人脸识别打卡。若开启人脸识别打卡，首班打卡前须录入人脸。']} />
      <FilterBar colors={colors}>
        <SearchField label="员工" placeholder="请输入姓名或员工号" colors={colors} width={200} showUserIcon value={draftFilters.employee} onChange={value => setDraftFilters(current => ({ ...current, employee: value }))} />
        <SelectField label="部门" placeholder="请选择" colors={colors} width={150} options={deptOptions} value={draftFilters.dept} onChange={value => setDraftFilters(current => ({ ...current, dept: value }))} />
        <SelectField label="考勤组" placeholder="请选择" colors={colors} width={150} options={groupOptions} value={draftFilters.group} onChange={value => setDraftFilters(current => ({ ...current, group: value }))} />
        <DateRangeField label="入职日期" colors={colors} width={240} start={draftFilters.start} end={draftFilters.end} onChange={(start, end) => setDraftFilters(current => ({ ...current, start, end }))} />
        <SelectField label="录入状态" placeholder="请选择" colors={colors} width={150} options={statusOptions} value={draftFilters.status} onChange={value => setDraftFilters(current => ({ ...current, status: value }))} />
        <div style={rightActionRow}>
          <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={openCreateEmployeeModal} style={primaryBtn(colors)}>新增员工并录入人脸</button>
        <button onClick={importFaces} style={primaryBtn(colors)}>批量导入人脸</button>
        <button onClick={() => addReminderRecord(`已配置录入提醒：覆盖${targetRows.length}人`)} style={outlineBtn(colors)}>配置录入提醒</button>
        <button onClick={refreshFaces} style={outlineBtn(colors)}>批量重刷</button>
        <button onClick={deleteSelected} disabled={!selectedRowIds.size || deletingEmployee} style={selectedRowIds.size && !deletingEmployee ? outlineBtn(colors) : disabledBtn(colors)}>{deletingEmployee ? '删除中...' : '批量删除'}</button>
        <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
          管理组织分组
          {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowReminderRecords(current => !current)} style={textLink(colors)}>录入提醒记录</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
            <input type="checkbox" checked={hideDeparted} onChange={event => setHideDeparted(event.target.checked)} style={{ accentColor: colors.primary }} />
            不显示离职员工
          </label>
        </div>
      </Toolbar>
      {showReminderRecords ? <InlineNotice colors={colors} text={reminderRecords.length ? reminderRecords.join('；') : '暂无录入提醒记录'} /> : null}
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
                  {ONBOARD_DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
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
                <input value={employeeDraft.position} onChange={event => updateEmployeeDraft('position', event.target.value)} placeholder="员工" style={modalInput(colors)} />
              </FormField>
              <FormField label="入职日期" colors={colors}>
                <input type="date" value={employeeDraft.hireDate} onChange={event => updateEmployeeDraft('hireDate', event.target.value)} style={modalInput(colors)} />
              </FormField>
              <FormField label="考勤组" colors={colors}>
                <select value={employeeDraft.attendanceGroupName} onChange={event => updateEmployeeDraft('attendanceGroupName', event.target.value)} style={modalInput(colors)}>
                  {ONBOARD_ATTEND_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
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

function HolidayView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(HOLIDAY_ROWS);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 2]), [appliedName, rowsData]);
  const addHoliday = () => {
    const name = window.prompt('请输入节假日方案名称', `节假日方案${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '2026', '双休', '手动创建', nowText(), '手动创建', nowText()], ...current]);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['编辑', '删除'], label => mutateNamedRow(label, row, rowsData, setRowsData, 0))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
        <div style={rightActionRow}>
          <button onClick={() => { setDraftName(''); setAppliedName(''); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedName(draftName)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addHoliday} style={primaryBtn(colors)}>新增节假日方案</button>
      </Toolbar>
      <DataTable columns={HOLIDAY_COLUMNS} rows={rows} colors={colors} emptyText="暂无内容" footerText={`共${filteredRows.length}笔`} />
    </ListPage>
  );
}

function CalendarView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(CALENDAR_ROWS);
  const [draftFilters, setDraftFilters] = useState({ name: '', period: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const filteredRows = useMemo(() => rowsData.filter(row => textIncludes(row[0], appliedFilters.name) && textIncludes(row[1], appliedFilters.period)), [appliedFilters, rowsData]);
  const addCalendar = () => {
    const name = window.prompt('请输入司历方案名称', `司历方案${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '当月1日至当月最后一天为【当月】的考勤周期', '周一、周二、周三、周四、周五', '工作日之和为应出勤天数', '默认考勤组', '手动创建', nowText(), '手动创建', nowText()], ...current]);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['编辑', '删除'], label => mutateNamedRow(label, row, rowsData, setRowsData, 0))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SelectField label="考勤周期" placeholder="请选择考勤周期" colors={colors} width={180} options={uniqueOptions(rowsData, 1)} value={draftFilters.period} onChange={value => setDraftFilters(current => ({ ...current, period: value }))} />
        <div style={rightActionRow}>
          <button onClick={() => { const next = { name: '', period: '' }; setDraftFilters(next); setAppliedFilters(next); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addCalendar} style={primaryBtn(colors)}>新建司历方案</button>
      </Toolbar>
      <DataTable columns={CALENDAR_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
    </ListPage>
  );
}

function OvertimeRulesView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(OVERTIME_RULE_ROWS);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [useDefault, setUseDefault] = useState(true);
  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);
  const importDefault = () => {
    setRowsData(current => [[`默认加班规则${current.length + 1}`, '工作日/休息日/节假日均按默认口径核算', '默认考勤组', '系统默认', nowText(), '系统默认', nowText()], ...current]);
    setUseDefault(true);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['查看', '修改', '删除'], label => {
    if (label === '查看') {
      window.alert(`加班规则\n${row[0] ?? '-'}\n${row[1] ?? '-'}`);
      return;
    }
    mutateNamedRow(label, row, rowsData, setRowsData, 0);
  })]);
  return (
    <ListPage colors={colors}>
      <InfoBanner colors={colors} messages={['设置加班补偿方式、核算方式，完成后可在考勤管理中使用。']} />
      <FilterBar colors={colors}>
        <SearchField label="规则名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
        <div style={rightActionRow}>
          <button onClick={() => { setDraftName(''); setAppliedName(''); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedName(draftName)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={importDefault} style={primaryBtn(colors)}>导入默认加班规则</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: colors.textMuted }}>
            <ToggleSwitch checked={useDefault} onClick={() => setUseDefault(current => !current)} colors={colors} />
            使用默认规则
          </label>
        </div>
      </Toolbar>
      <DataTable columns={OVERTIME_RULE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
    </ListPage>
  );
}

function FieldRulesView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(FIELD_RULE_ROWS);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const filteredRows = useMemo(() => filterRowsByText(rowsData, appliedName, [0, 1, 2]), [appliedName, rowsData]);
  const addRule = () => {
    const name = window.prompt('请输入外勤规则名称', `外勤规则${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '外勤打卡已启用 / 外出申请已启用', '默认考勤组', '手动创建', nowText(), '手动创建', nowText()], ...current]);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['修改', '删除'], label => mutateNamedRow(label, row, rowsData, setRowsData, 0))]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="外勤规则" placeholder="请输入外勤规则名称" colors={colors} width={210} value={draftName} onChange={setDraftName} />
        <div style={rightActionRow}>
          <button onClick={() => { setDraftName(''); setAppliedName(''); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedName(draftName)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addRule} style={primaryBtn(colors)}>新增外勤规则</button>
      </Toolbar>
      <DataTable columns={FIELD_RULE_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
    </ListPage>
  );
}

function StatSchemesView({ colors }: { colors: any }) {
  const [rowsData, setRowsData] = useState<string[][]>(STAT_SCHEME_ROWS);
  const [draftFilters, setDraftFilters] = useState({ name: '', employee: '' });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const filteredRows = useMemo(() => rowsData.filter(row => textIncludes(row[0], appliedFilters.name) && textIncludes(row.join(' '), appliedFilters.employee)), [appliedFilters, rowsData]);
  const addScheme = () => {
    const name = window.prompt('请输入统计方案名称', `统计方案${rowsData.length + 1}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setRowsData(current => [[trimmed, '当月1日至当月最后一天为【当月】的一个考勤统计周期', '部门：待配置', '部门：待配置', '手动创建', nowText(), '手动创建', nowText()], ...current]);
  };
  const rows = filteredRows.map(row => [...row, rowActionLinks(colors, ['编辑', '复制', '删除'], label => mutateNamedRow(label, row, rowsData, setRowsData, 0))]);
  return (
    <ListPage colors={colors}>
      <InfoBanner colors={colors} messages={['什么是统计方案？统计方案用于在业务停止计算时配置业务截止周期、出勤统计周期以及考勤汇总统计项。']} />
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} value={draftFilters.name} onChange={value => setDraftFilters(current => ({ ...current, name: value }))} />
        <SearchField label="员工" placeholder="请输入姓名或员工号" colors={colors} width={210} showUserIcon value={draftFilters.employee} onChange={value => setDraftFilters(current => ({ ...current, employee: value }))} />
        <div style={rightActionRow}>
          <button onClick={() => { const next = { name: '', employee: '' }; setDraftFilters(next); setAppliedFilters(next); }} style={outlineBtn(colors)}>重置</button>
          <button onClick={() => setAppliedFilters(draftFilters)} style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button onClick={addScheme} style={primaryBtn(colors)}>新增方案</button>
      </Toolbar>
      <DataTable columns={STAT_SCHEME_COLUMNS} rows={rows} colors={colors} footerText={`共${filteredRows.length}笔`} />
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
            sortedEntries.map(({ row, rowId }, index) => (
              <tr key={rowId} style={{ backgroundColor: index % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                {withSelection ? <td style={td(colors)}><input type="checkbox" checked={onToggleRow ? (selectedRowIds?.has(rowId) ?? false) : undefined} onChange={() => onToggleRow?.(rowId)} style={{ accentColor: colors.primary }} /></td> : null}
                {row.map((cell, cellIndex) => <td key={cellIndex} style={td(colors)}>{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderTop: `1px solid ${colors.cardBorder}`, fontSize: '12px', color: colors.textMuted }}>
        <span>{footerText ?? `共${rows.length}笔`}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>1</span>
          <span>2</span>
          <span>20条/页</span>
        </div>
      </div>
    </div>
  );
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

function shiftActionLinks(colors: any, row: string[], handlers: { onDetail: () => void; onEdit: () => void; onMore: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={handlers.onDetail} style={textLink(colors)}>详情</button>
      <button onClick={handlers.onEdit} style={textLink(colors)}>修改</button>
      <button onClick={handlers.onMore} style={textLink(colors)} title={`更多操作：${row[0] ?? ''}`}>...</button>
    </div>
  );
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

function createRowId(row: string[]) {
  return row.map(value => String(value ?? '')).join('|');
}

function setRowCell(row: string[], index: number, value: string) {
  const next = [...row];
  while (next.length <= index) next.push('-');
  next[index] = value;
  return next;
}

function mutateNamedRow(
  label: string,
  row: string[],
  _rowsData: string[][],
  setRowsData: React.Dispatch<React.SetStateAction<string[][]>>,
  nameIndex: number,
) {
  const rowId = createRowId(row);
  if (label === '删除') {
    if (!window.confirm(`确认删除「${row[nameIndex] ?? '当前记录'}」？`)) return;
    setRowsData(current => current.filter(item => createRowId(item) !== rowId));
    return;
  }

  if (label === '复制') {
    setRowsData(current => {
      const source = current.find(item => createRowId(item) === rowId) ?? row;
      const copy = [...source];
      copy[nameIndex] = `${source[nameIndex] ?? '复制记录'}-副本`;
      return [copy, ...current];
    });
    return;
  }

  if (label === '修改' || label === '编辑') {
    const nextName = window.prompt(`请输入${label === '编辑' ? '方案' : '记录'}名称`, String(row[nameIndex] ?? ''));
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setRowsData(current => current.map(item => createRowId(item) === rowId ? setRowCell(item, nameIndex, trimmed) : item));
    return;
  }

  window.alert(`${label}\n${row[nameIndex] ?? '当前记录'}`);
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
  const csv = toCsv([columns, ...rows]);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
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

