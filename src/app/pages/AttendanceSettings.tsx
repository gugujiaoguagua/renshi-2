import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
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

function showActionFeedback(action: string) {
  window.alert(`考勤设置：${action}（交互已接通）`);
}

type TableProps = {
  columns: string[];
  rows: React.ReactNode[][];
  colors: any;
  withSelection?: boolean;
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
const SHIFT_COLUMNS = ['班次名称', '班次简称', '班次角色', '标签', '冬夏令时', '出勤时间', '出勤时长', '适用考勤组', '创建人', '创建时间', '修改人', '修改时间', '操作'];
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

const PEOPLE_ROWS = [
  ['魏晓丽', 'ZY26609', '新人培训组', '新品培训组', '2026-05-07', '-', '-', '全职', '试用', '-', '生产组', '-', '华北大区', '默认方案'],
  ['林万', 'ZY26600', '新人培训组', '营运设计师', '2026-05-06', '-', '-', '全职', '试用', '-', '生产组', '-', '华北大区', '默认方案'],
  ['李梓宁', 'ZY26601', '新人培训组', '产品设计师', '2026-05-06', '-', '-', '全职', '试用', '-', '生产组', '-', '华北大区', '默认方案'],
  ['牛润颖', 'ZY26602', '新人培训组', '销售运营', '2026-05-06', '-', '-', '全职', '试用', '-', '生产组', '-', '华北大区', '默认方案'],
  ['张子七', 'CP26057', '饮酒运营中心', '餐厅运营', '2026-04-28', '-', '-', '全职', '试用', '-', '中控运营设计', '-', '华北大区', '默认方案'],
  ['王海', 'ZY26599', '新人培训组', '生产组专员', '2026-04-25', '-', '-', '全职', '试用', '-', '生产组', '-', '华北大区', '默认方案'],
];

const CARD_RULE_ROWS = [
  ['无规则打卡', '无规则打卡', '无规则打卡', '棠乐', '2026-04-15 09:54:58', '棠乐', '2026-04-15 09:54:58'],
  ['迟到打卡规则', '禁止工出勤在9小时内发起迟到流程', '家和里 / 项目门店 / 冲压车间', '棠乐', '2026-04-15 09:45:40', '棠乐', '2026-04-15 09:45:40'],
];

const LOCATION_ROWS: string[][] = [];
const MOBILE_ROWS: string[][] = [];

const FACE_ROWS = [
  ['魏晓丽', 'ZY26609', '新人培训组', '上海拉蜜克家具有限公司 / 上与直营管理', '华北大区', '2026-05-07', '未录入', '-', '-', '拉蜜克'],
  ['林万', 'ZY26600', '新人培训组', '上海拉蜜克家具有限公司 / 上与直营管理', '华北大区', '2026-05-06', '未录入', '-', '-', '拉蜜克'],
  ['李梓宁', 'ZY26601', '新人培训组', '上海拉蜜克家具有限公司 / 上与直营管理', '华北大区', '2026-05-06', '未录入', '-', '-', '拉蜜克'],
  ['牛润颖', 'ZY26602', '新人培训组', '上海拉蜜克家具有限公司 / 上与直营管理', '华北大区', '2026-05-06', '未录入', '-', '-', '拉蜜克'],
  ['张子七', 'CP26057', '饮酒运营中心', '上海拉蜜克家具有限公司 / 九方商务部', '华北大区', '2026-04-28', '未录入', '-', '-', '导入'],
];

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

  const activeView = useMemo<SettingView>(() => {
    if (location.pathname === '/attendance/settings') return 'overview';
    const sub = location.pathname.split('/').pop() ?? '';
    return LEGACY_ALIAS[sub] ?? (ROUTE_TABS.find(tab => tab.path === location.pathname)?.key ?? 'overview');
  }, [location.pathname]);

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
        <button style={{ marginLeft: 4, padding: '2px 10px', fontSize: '12px', border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: 'default', background: 'transparent', color: colors.textMuted, flexShrink: 0 }}>×</button>
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
      {activeView === 'shifts' && <ShiftsView colors={colors} showMore={!!showMore.shifts} onToggleMore={() => toggleMore('shifts')} />}
      {activeView === 'people' && <PeopleView colors={colors} showMore={!!showMore.people} onToggleMore={() => toggleMore('people')} />}
      {activeView === 'card-rules' && <CardRulesView colors={colors} />}
      {activeView === 'mobile-clock' && <MobileClockView colors={colors} />}
      {activeView === 'location' && <LocationView colors={colors} showMore={!!showMore.location} onToggleMore={() => toggleMore('location')} />}
      {activeView === 'face' && <FaceView colors={colors} showMore={!!showMore.face} onToggleMore={() => toggleMore('face')} />}
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
                  <tr>
                    <td style={td(colors)}>当月1日至当月最后一天为【当月】的考勤统计周期</td>
                    <td style={td(colors)}><button style={textLink(colors)}>双休、两连班</button></td>
                    <td style={td(colors)}><button style={textLink(colors)}>默认方案</button></td>
                    <td style={td(colors)}>{actionLinks(colors, ['修改', '删除'])}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ paddingTop: 10 }}>
              <button style={linkBtn(colors)}>
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
          <input type="checkbox" style={{ accentColor: colors.primary }} />
          我已完成配置，下次不再默认进入本页面
        </label>
      </SectionCard>
    </div>
  );
}

function GroupsView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const rows = GROUP_ROWS.map(row => [...row, actionLinks(colors, ['修改', '排班', '...'])]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="考勤组名称" placeholder="请输入" colors={colors} width={180} />
        <CheckboxGroup label="考勤类型" items={['固定班制', '排班制', '自由工时']} colors={colors} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新建考勤组</button>
        <button style={outlineBtn(colors)}>重新导入</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TagPill colors={colors} label="排班人员" count="24" active />
          <TagPill colors={colors} label="班次人员" count="0" />
        </div>
      </Toolbar>
      <DataTable columns={GROUP_COLUMNS} rows={rows} colors={colors} footerText="共24条" />
    </ListPage>
  );
}

function ShiftsView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const rows = SHIFT_ROWS.map(row => [...row, actionLinks(colors, ['详情', '修改', '...'])]);
  return (
    <ListPage colors={colors}>
      <InfoBanner colors={colors} messages={['设置每天上下班时间、打卡时间和出勤班次将有助于考勤统计。']} />
      <FilterBar colors={colors}>
        <SearchField label="班次名称" placeholder="请输入" colors={colors} width={180} />
        <SelectField label="标签名称" placeholder="请选择标签" colors={colors} width={160} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
          <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
            标签管理
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新建班次</button>
        <button style={outlineBtn(colors)}>导入排入</button>
        <button style={outlineBtn(colors)}>导出</button>
        <button style={outlineBtn(colors)}>删除</button>
      </Toolbar>
      <DataTable columns={SHIFT_COLUMNS} rows={rows} colors={colors} withSelection footerText="共25条" />
    </ListPage>
  );
}

function PeopleView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const rows = PEOPLE_ROWS.map(row => [...row, actionLinks(colors, ['详情', '...'])]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="姓名/员工工号" placeholder="请输入姓名/员工工号" colors={colors} width={210} showUserIcon />
        <SelectField label="部门" placeholder="请选择" colors={colors} width={150} />
        <SelectField label="考勤组" placeholder="请选择" colors={colors} width={150} />
        <SelectField label="统计方案" placeholder="请选择" colors={colors} width={150} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <TagPill colors={colors} label="全部人员" count="1165" active />
        <TagPill colors={colors} label="排班人员" count="635" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
            <input type="checkbox" style={{ accentColor: colors.primary }} />
            不显示离职员工
          </label>
          <button style={textLink(colors)}>CRM同步记录</button>
          <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
            更多筛选
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </Toolbar>
      <DataTable columns={PEOPLE_COLUMNS} rows={rows} colors={colors} footerText="共1165笔" />
    </ListPage>
  );
}

function CardRulesView({ colors }: { colors: any }) {
  const rows = CARD_RULE_ROWS.map(row => [...row, actionLinks(colors, ['修改', '删除'])]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="规则名称" placeholder="请输入规则名称" colors={colors} width={200} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新增打卡规则</button>
      </Toolbar>
      <DataTable columns={CARD_RULE_COLUMNS} rows={rows} colors={colors} footerText="共2笔" />
    </ListPage>
  );
}

function MobileClockView({ colors }: { colors: any }) {
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新建方案</button>
      </Toolbar>
      <DataTable columns={MOBILE_COLUMNS} rows={[]} colors={colors} emptyText="暂无内容" footerText="共0笔" />
    </ListPage>
  );
}

function LocationView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const rows = LOCATION_ROWS.map(row => [...row, actionLinks(colors, ['修改', '删除'])]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="上班地点" placeholder="请输入" colors={colors} width={180} />
        <SearchField label="GPS打卡地址" placeholder="请输入" colors={colors} width={180} />
        <SearchField label="打卡Wi-Fi" placeholder="请输入" colors={colors} width={160} />
        <SearchField label="打卡蓝牙" placeholder="请输入" colors={colors} width={160} />
        <SearchField label="移动打卡方案" placeholder="请输入" colors={colors} width={180} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
          <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
            更多筛选
            {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新建上班地点</button>
        <button style={outlineBtn(colors)}>导入</button>
        <button style={outlineBtn(colors)}>导出</button>
        <button style={outlineBtn(colors)}>批量删除</button>
      </Toolbar>
      <DataTable columns={LOCATION_COLUMNS} rows={rows} colors={colors} withSelection emptyText="暂无内容" footerText="共0笔" />
    </ListPage>
  );
}

function FaceView({ colors, showMore, onToggleMore }: { colors: any; showMore: boolean; onToggleMore: () => void }) {
  const rows = FACE_ROWS.map(row => [...row, actionLinks(colors, ['详情', '发送录入提醒'])]);
  return (
    <ListPage colors={colors}>
      <InfoBanner colors={colors} messages={['员工打卡进件时，若【打卡】或【设置】-【人脸管理】未录入人脸，则看开启人脸识别打卡。若开启人脸识别打卡，首班打卡前须录入人脸。']} />
      <FilterBar colors={colors}>
        <SearchField label="员工" placeholder="请输入姓名或员工号" colors={colors} width={200} showUserIcon />
        <SelectField label="部门" placeholder="请选择" colors={colors} width={150} />
        <SelectField label="考勤组" placeholder="请选择" colors={colors} width={150} />
        <DateRangeField label="入职日期" colors={colors} width={240} />
        <SelectField label="录入状态" placeholder="请选择" colors={colors} width={150} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>批量导入人脸</button>
        <button style={outlineBtn(colors)}>配置录入提醒</button>
        <button style={outlineBtn(colors)}>批量重刷</button>
        <button style={outlineBtn(colors)}>批量删除</button>
        <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
          管理组织分组
          {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={textLink(colors)}>录入提醒记录</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
            <input type="checkbox" style={{ accentColor: colors.primary }} />
            仅看待审核
          </label>
        </div>
      </Toolbar>
      <DataTable columns={FACE_COLUMNS} rows={rows} colors={colors} withSelection footerText="共1027笔" />
    </ListPage>
  );
}

function DevicesView({ colors }: { colors: any }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 20px' }}>
      <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '6px 0 16px' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#FFF3DA', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>!</div>
          <div style={{ fontSize: '14px', color: colors.text, fontWeight: 600 }}>暂未选择考勤机</div>
          <div style={{ fontSize: '12px', color: colors.textMuted }}>可添加以下4个品牌的考勤机</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12 }}>
          {DEVICE_BRANDS.map(brand => (
            <div key={brand.name} style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 10, padding: '12px 14px', backgroundColor: colors.cardBg }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.tableHeaderBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: colors.text, marginBottom: 10 }}>{brand.name.slice(0, 2)}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: 6 }}>{brand.name}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: colors.textMuted, minHeight: 48 }}>{brand.desc}</div>
              <button style={{ ...outlineBtn(colors), marginTop: 10, height: 28, padding: '0 10px' }}>添加</button>
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
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新增节假日方案</button>
      </Toolbar>
      <DataTable columns={HOLIDAY_COLUMNS} rows={[]} colors={colors} emptyText="暂无内容" footerText="共0笔" />
    </ListPage>
  );
}

function CalendarView({ colors }: { colors: any }) {
  const rows = CALENDAR_ROWS.map(row => [...row, actionLinks(colors, ['编辑', '删除'])]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} />
        <SelectField label="考勤周期" placeholder="请选择考勤周期" colors={colors} width={180} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新建司历方案</button>
      </Toolbar>
      <DataTable columns={CALENDAR_COLUMNS} rows={rows} colors={colors} footerText="共2笔" />
    </ListPage>
  );
}

function OvertimeRulesView({ colors }: { colors: any }) {
  const rows = OVERTIME_RULE_ROWS.map(row => [...row, actionLinks(colors, ['查看', '修改', '删除'])]);
  return (
    <ListPage colors={colors}>
      <InfoBanner colors={colors} messages={['设置加班补偿方式、核算方式，完成后可在考勤管理中使用。']} />
      <FilterBar colors={colors}>
        <SearchField label="规则名称" placeholder="请输入方案名称" colors={colors} width={210} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>导入默认加班规则</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: colors.textMuted }}>
            <ToggleSwitch checked colors={colors} />
            使用默认规则
          </label>
        </div>
      </Toolbar>
      <DataTable columns={OVERTIME_RULE_COLUMNS} rows={rows} colors={colors} footerText="共2笔" />
    </ListPage>
  );
}

function FieldRulesView({ colors }: { colors: any }) {
  const rows = FIELD_RULE_ROWS.map(row => [...row, actionLinks(colors, ['修改', '删除'])]);
  return (
    <ListPage colors={colors}>
      <FilterBar colors={colors}>
        <SearchField label="外勤规则" placeholder="请输入外勤规则名称" colors={colors} width={210} />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新增外勤规则</button>
      </Toolbar>
      <DataTable columns={FIELD_RULE_COLUMNS} rows={rows} colors={colors} footerText="共1笔" />
    </ListPage>
  );
}

function StatSchemesView({ colors }: { colors: any }) {
  const rows = STAT_SCHEME_ROWS.map(row => [...row, actionLinks(colors, ['编辑', '复制', '删除'])]);
  return (
    <ListPage colors={colors}>
      <InfoBanner colors={colors} messages={['什么是统计方案？统计方案用于在业务停止计算时配置业务截止周期、出勤统计周期以及考勤汇总统计项。']} />
      <FilterBar colors={colors}>
        <SearchField label="方案名称" placeholder="请输入方案名称" colors={colors} width={210} />
        <SearchField label="员工" placeholder="请输入姓名或员工号" colors={colors} width={210} showUserIcon />
        <div style={rightActionRow}>
          <button style={outlineBtn(colors)}>重置</button>
          <button style={primaryBtn(colors)}>查询</button>
        </div>
      </FilterBar>
      <Toolbar colors={colors}>
        <button style={primaryBtn(colors)}>新增方案</button>
      </Toolbar>
      <DataTable columns={STAT_SCHEME_COLUMNS} rows={rows} colors={colors} footerText="共1笔" />
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

function DataTable({ columns, rows, colors, withSelection = false, emptyText = '暂无内容', footerText }: TableProps) {
  const colSpan = columns.length + (withSelection ? 1 : 0);
  return (
    <div style={{ backgroundColor: colors.cardBg, overflow: 'auto' }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
            {withSelection ? <th style={{ ...th(colors), width: 42 }}><input type="checkbox" style={{ accentColor: colors.primary }} /></th> : null}
            {columns.map(column => (
              <th key={column} style={{ ...th(colors), minWidth: column.length >= 6 ? 132 : 108 }}>{column}</th>
            ))}
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
            rows.map((row, index) => (
              <tr key={index} style={{ backgroundColor: index % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                {withSelection ? <td style={td(colors)}><input type="checkbox" style={{ accentColor: colors.primary }} /></td> : null}
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
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 16px', backgroundColor: withAlpha(colors.primary, 0.08), borderBottom: `1px solid ${withAlpha(colors.primary, 0.14)}` }}>
      <AlertCircle size={14} style={{ color: colors.primary, marginTop: 1, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.map((message, index) => (
          <span key={index} style={{ fontSize: '12px', color: colors.text }}>{messages.length > 1 ? `${index + 1}. ` : ''}{message}</span>
        ))}
      </div>
      <button style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer' }}>×</button>
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

function SearchField({ label, placeholder, colors, width = 170, showUserIcon = false }: { label: string; placeholder: string; colors: any; width?: number; showUserIcon?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input placeholder={placeholder} style={textInput(colors)} />
        {showUserIcon ? <Users size={12} style={{ color: colors.textMuted }} /> : null}
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({ label, placeholder, colors, width = 148 }: { label: string; placeholder: string; colors: any; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeholder}</span>
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function DateRangeField({ label, colors, width = 236 }: { label: string; colors: any; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input type="date" defaultValue="2026-05-01" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input type="date" defaultValue="2026-05-31" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function CheckboxGroup({ label, items, colors }: { label: string; items: string[]; colors: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      {items.map((item, index) => (
        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
          <input type="checkbox" defaultChecked={index !== 1} style={{ accentColor: colors.primary }} />
          {item}
        </label>
      ))}
    </div>
  );
}

function ToggleSwitch({ checked, onClick, colors }: { checked?: boolean; onClick?: () => void; colors: any }) {
  return (
    <button onClick={onClick} style={{ width: 30, height: 16, borderRadius: 999, border: 'none', backgroundColor: checked ? colors.primary : withAlpha(colors.textMuted, 0.32), position: 'relative', cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', left: checked ? 16 : 2, top: 2, transition: 'all 0.2s' }} />
    </button>
  );
}

function TagPill({ colors, label, count, active = false }: { colors: any; label: string; count: string; active?: boolean }) {
  return <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '12px', color: active ? '#fff' : colors.textMuted, backgroundColor: active ? colors.primary : colors.tableHeaderBg }}>{label}({count})</span>;
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

function primaryBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: 'none', borderRadius: 4, backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' };
}

function outlineBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.text, fontSize: '12px', cursor: 'pointer' };
}

function toggleBtn(colors: any, active: boolean): React.CSSProperties {
  return { ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: active ? colors.primary : colors.text, borderColor: active ? colors.primary : colors.inputBorder, backgroundColor: active ? colors.badgeBlueBg : 'transparent' };
}

function linkBtn(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
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

function actionLinks(colors: any, labels: string[]) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {labels.map(label => (
        <button key={label} onClick={() => showActionFeedback(label)} style={textLink(colors)}>{label}</button>
      ))}
    </div>
  );
}
