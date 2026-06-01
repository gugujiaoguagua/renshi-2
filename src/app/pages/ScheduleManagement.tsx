import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { assignEmployeesToAttendanceGroup, fetchScheduleMonth, saveScheduleAssignments, type ScheduleMonthEmployee, type ScheduleShiftOption } from '../api/realData';
import { downloadAttendanceXlsx } from '../shared/export/attendanceExport';
import { monthEndISO, monthStartISO, todayISO } from '../utils/date';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  HelpCircle,
  Download,
  Search,
  Settings2,
  Users,
} from 'lucide-react';

type MainView = 'table' | 'adjust';
type AdjustView = 'change' | 'swap' | 'switch' | 'leave';

type AdjustTabConfig = {
  key: AdjustView;
  label: string;
  columns: string[];
};
type ScheduleRow = ScheduleMonthEmployee;
type ActiveCell = { row: ScheduleRow; day: number } | null;

const CALENDAR_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CALENDAR_WEEK_DAYS = ['五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日'];
const SCHEDULE_TABLE_PAGE_SIZE = 80;

const ADJUST_TABS: AdjustTabConfig[] = [
  {
    key: 'change',
    label: '更改班次记录',
    columns: ['申请人', '员工号', '部门', '部门全路径', '更改日期', '原班次', '新班次', '班次更改原因', '发起时间', '完成时间', '审批状态'],
  },
  {
    key: 'swap',
    label: '班次对调记录',
    columns: ['申请人', '员工号', '部门', '部门全路径', '调班日期', '调班班次', '还班日期', '还班班次', '发起时间', '完成时间', '审批状态'],
  },
  {
    key: 'switch',
    label: '与他人切换记录',
    columns: ['申请人', '申请人员工号', '申请人部门', '申请人部门全路径', '替班人', '替班人员工号', '替班人部门', '替班人部门全路径', '换班日期', '换班结果', '是否还班', '还班日期', '还班结果', '发起时间', '完成时间', '审批状态'],
  },
  {
    key: 'leave',
    label: '排休申请',
    columns: ['申请人', '员工号', '部门', '部门全路径', '排休日期', '排休天数', '备注', '发起时间', '完成时间', '审批状态'],
  },
];

function scheduleRowMatchesGroup(row: ScheduleRow, groupName: string, scopeText: string) {
  if (!groupName) return true;
  if (row.attendGroup === groupName) return true;
  const normalizedScope = scopeText.replace(/[，、]/g, ',');
  const deptTokens = normalizedScope
    .split(',')
    .map(token => token.replace(/^部门[:：]/, '').trim())
    .filter(Boolean);
  return deptTokens.some(token => row.dept.includes(token) || token.includes(row.dept));
}

export default function ScheduleManagement() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [adjustTab, setAdjustTab] = useState<AdjustView>('change');
  const [showTableMore, setShowTableMore] = useState(false);
  const [showAdjustMore, setShowAdjustMore] = useState(false);

  const mainView: MainView = location.pathname === '/attendance/schedule-adjust' || location.pathname === '/attendance/schedule-history'
    ? 'adjust'
    : 'table';
  const currentAdjustTab = useMemo(
    () => ADJUST_TABS.find(tab => tab.key === adjustTab) ?? ADJUST_TABS[0],
    [adjustTab],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4, minHeight: 40, flexShrink: 0 }}>
        <TopTab label="首页" active={false} onClick={() => navigate('/attendance/home')} colors={colors} />
        <TopTab label="排班表" active={mainView === 'table'} onClick={() => navigate('/attendance/schedule')} colors={colors} />
        <button
          style={{
            marginLeft: 4,
            padding: '2px 10px',
            fontSize: '12px',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 4,
            cursor: 'default',
            background: 'transparent',
            color: colors.textMuted,
          }}
        >
          ×
        </button>
      </div>

      {mainView === 'table' ? (
        <ScheduleTableView colors={colors} showMore={showTableMore} onToggleMore={() => setShowTableMore(prev => !prev)} />
      ) : (
        <ScheduleAdjustView
          colors={colors}
          currentTab={currentAdjustTab}
          activeKey={adjustTab}
          onChangeTab={setAdjustTab}
          showMore={showAdjustMore}
          onToggleMore={() => setShowAdjustMore(prev => !prev)}
        />
      )}
    </div>
  );
}

function ScheduleTableView({
  colors,
  showMore,
  onToggleMore,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  const location = useLocation();
  const linkedParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const linkedGroup = linkedParams.get('attendanceGroup') || '';
  const linkedShift = linkedParams.get('shift') || '';
  const linkedScope = linkedParams.get('scope') || '';
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [shifts, setShifts] = useState<ScheduleShiftOption[]>([]);
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState(linkedGroup);
  const [deptFilter, setDeptFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinSelected, setJoinSelected] = useState<Set<string>>(new Set());
  const [joinFilters, setJoinFilters] = useState({ employee: '', dept: '', position: '', employeeType: '' });
  const [activeCell, setActiveCell] = useState<ActiveCell>(null);

  useEffect(() => {
    setGroupFilter(linkedGroup);
  }, [linkedGroup]);

  useEffect(() => {
    setTablePage(1);
  }, [employeeFilter, groupFilter, deptFilter, positionFilter, employeeTypeFilter, statusFilter, month]);

  useEffect(() => {
    let cancelled = false;
    fetchScheduleMonth(month)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows || []);
        setShifts(res.shifts || []);
        setAllGroups(res.groups || []);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setShifts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const filteredRows = rows.filter(row => {
    const keyword = employeeFilter.trim().toLowerCase();
    const scheduledCount = Object.values(row.dayResults || {}).filter(Boolean).length;
    return (!keyword || row.name.toLowerCase().includes(keyword) || row.employeeNo.toLowerCase().includes(keyword))
      && (!groupFilter || scheduleRowMatchesGroup(row, groupFilter, groupFilter === linkedGroup ? linkedScope : ''))
      && (!deptFilter || row.dept === deptFilter)
      && (!positionFilter || row.position === positionFilter)
      && (!employeeTypeFilter || row.employeeType === employeeTypeFilter)
      && (!statusFilter || (statusFilter === '已排班' ? scheduledCount > 0 : scheduledCount === 0));
  });
  const groupOptions = Array.from(new Set([...allGroups, ...rows.map(row => row.attendGroup).filter(Boolean), linkedGroup].filter(Boolean)));
  const deptOptions = Array.from(new Set(rows.map(row => row.dept).filter(Boolean)));
  const positionOptions = Array.from(new Set(rows.map(row => row.position).filter(Boolean)));
  const employeeTypeOptions = Array.from(new Set(rows.map(row => row.employeeType).filter(Boolean))) as string[];
  const tableTotalPages = Math.max(1, Math.ceil(filteredRows.length / SCHEDULE_TABLE_PAGE_SIZE));
  const currentTablePage = Math.min(tablePage, tableTotalPages);
  const visibleScheduleRows = filteredRows.slice(
    (currentTablePage - 1) * SCHEDULE_TABLE_PAGE_SIZE,
    currentTablePage * SCHEDULE_TABLE_PAGE_SIZE,
  );
  const shiftOptions = shifts.length ? shifts : [{ id: 'shift_0900_1800', name: '早九晚六', time: '09:00-18:00' }];
  const monthLabel = `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
  const cycleStart = `${month}-01`;
  const cycleEnd = monthEndISO(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  const applySchedule = (row: ScheduleRow, day: number, nextShift: ScheduleShiftOption) => {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const nextRows = rows.map(item => item.employeeNo === row.employeeNo
      ? { ...item, dayResults: { ...(item.dayResults || {}), [String(day)]: nextShift.name } }
      : item);
    setRows(nextRows);
    setActiveCell(null);
    void saveScheduleAssignments([{
      date,
      employeeNo: row.employeeNo,
      employeeName: row.name,
      dept: row.dept,
      shiftId: nextShift.id,
      shiftName: nextShift.name,
    }]).catch(() => window.alert('排班已在页面更新，但保存到后端失败'));
  };
  const openJoinModal = () => {
    if (!groupFilter) {
      window.alert('请先选择要加入的考勤组');
      return;
    }
    setJoinFilters({ employee: employeeFilter, dept: deptFilter, position: positionFilter, employeeType: employeeTypeFilter });
    setJoinSelected(new Set());
    setShowJoinModal(true);
  };
  const joinCandidates = rows.filter(row => {
    const keyword = joinFilters.employee.trim().toLowerCase();
    return row.attendGroup !== groupFilter
      && (!keyword || row.name.toLowerCase().includes(keyword) || row.employeeNo.toLowerCase().includes(keyword))
      && (!joinFilters.dept || row.dept === joinFilters.dept)
      && (!joinFilters.position || row.position === joinFilters.position)
      && (!joinFilters.employeeType || row.employeeType === joinFilters.employeeType);
  });
  const toggleJoinEmployee = (employeeNo: string) => {
    setJoinSelected(current => {
      const next = new Set(current);
      if (next.has(employeeNo)) next.delete(employeeNo);
      else next.add(employeeNo);
      return next;
    });
  };
  const joinEmployees = async () => {
    if (!groupFilter || !joinSelected.size || joining) return;
    setJoining(true);
    try {
      await assignEmployeesToAttendanceGroup({
        employeeNos: Array.from(joinSelected),
        attendanceGroupName: groupFilter,
        shiftName: linkedShift || undefined,
      });
      const res = await fetchScheduleMonth(month);
      setRows(res.rows || []);
      setShifts(res.shifts || []);
      setAllGroups(res.groups || []);
      setShowJoinModal(false);
      setJoinSelected(new Set());
    } catch (_error) {
      window.alert('加入人员失败，请检查后端服务');
    } finally {
      setJoining(false);
    }
  };
  const resetFilters = () => {
    setEmployeeFilter('');
    setGroupFilter('');
    setDeptFilter('');
    setPositionFilter('');
    setEmployeeTypeFilter('');
    setStatusFilter('');
  };
  const exportSchedule = () => {
    void downloadAttendanceXlsx({
      fileName: `排班表-${monthLabel}.xlsx`,
      sheetName: '排班表',
      headers: ['姓名', '员工号', ...CALENDAR_DAYS.map(day => `${month}-${String(day).padStart(2, '0')}`)],
      rows: filteredRows.map(row => [
        row.name,
        row.employeeNo,
        ...CALENDAR_DAYS.map(day => row.dayResults?.[String(day)] || '未排班'),
      ]),
      emptyMessage: '暂无可导出的排班表',
      saveAs: true,
    });
  };
  const exportDisabled = filteredRows.length === 0;

  return (
    <>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMonth(prev => {
            const date = new Date(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)) - 2, 1);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          })} style={ghostIconBtn(colors)}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>{monthLabel}</span>
          <ChevronDown size={12} style={{ color: colors.textMuted }} />
          <button onClick={() => setMonth(prev => {
            const date = new Date(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)), 1);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          })} style={ghostIconBtn(colors)}><ChevronRight size={14} /></button>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>考勤周期 {cycleStart} 至 {cycleEnd}</span>
        </div>
        <button onClick={exportSchedule} disabled={exportDisabled} style={exportBtn(colors, exportDisabled)}>
          <Download size={14}/>导出Excel
        </button>
      </div>

      <div style={{ padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        {linkedGroup ? (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, border: `1px solid ${colors.primary}`, backgroundColor: colors.badgeBlueBg, color: colors.primary, fontSize: 12 }}>
            已从考勤组管理联动：{linkedGroup}{linkedShift ? `，默认班次：${linkedShift}` : ''}{linkedScope ? `，适用范围：${linkedScope}` : ''}。当前排班表已按该考勤组筛选。
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectField label="考勤组" placeholder="请选择考勤组" colors={colors} width={148} options={groupOptions} value={groupFilter} onChange={setGroupFilter} />
          <SearchField label="员工" placeholder="请输入姓名或工号" colors={colors} width={178} showUserIcon value={employeeFilter} onChange={setEmployeeFilter} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={136} options={deptOptions} value={deptFilter} onChange={setDeptFilter} />
          <SelectField label="岗位" placeholder="请选择" colors={colors} width={136} options={positionOptions} value={positionFilter} onChange={setPositionFilter} />
          <SelectField label="员工类型" placeholder="请选择" colors={colors} width={144} options={employeeTypeOptions} value={employeeTypeFilter} onChange={setEmployeeTypeFilter} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.tableBorder}` }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 3 }}>
              <th style={{ ...th(colors), width: 92, position: 'sticky', left: 0, zIndex: 4, backgroundColor: colors.tableHeaderBg }}>姓名</th>
              <th style={{ ...th(colors), width: 98, position: 'sticky', left: 92, zIndex: 4, backgroundColor: colors.tableHeaderBg }}>员工号</th>
              {CALENDAR_DAYS.map((day, index) => (
                <th key={day} style={{ ...th(colors), width: 42, textAlign: 'center', padding: '6px 2px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15 }}>
                    <span style={{ fontSize: '10px', color: index % 7 === 1 || index % 7 === 2 ? '#D97706' : colors.textMuted }}>{CALENDAR_WEEK_DAYS[index]}</span>
                    <span style={{ fontSize: '11px', color: colors.text }}>{day}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? visibleScheduleRows.map(row => (
              <tr key={row.employeeNo} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                <td style={{ ...td(colors), width: 92, position: 'sticky', left: 0, zIndex: 2, backgroundColor: colors.cardBg }}>{row.name}</td>
                <td style={{ ...td(colors), width: 98, position: 'sticky', left: 92, zIndex: 2, backgroundColor: colors.cardBg }}>{row.employeeNo}</td>
                {CALENDAR_DAYS.map(day => {
                  const value = row.dayResults?.[String(day)] || '未排班';
                  return (
                    <td key={day} style={{ ...td(colors), width: 42, padding: '4px 2px', textAlign: 'center' }}>
                      <button onClick={() => setActiveCell({ row, day })} title="点击选择班次并同步到移动端排班" style={{ width: 34, minHeight: 24, border: `1px solid ${value === '未排班' ? colors.inputBorder : colors.primary}`, borderRadius: 4, background: value === '未排班' ? 'transparent' : colors.badgeBlueBg, color: value === '未排班' ? colors.textMuted : colors.primary, fontSize: 11, cursor: 'pointer', padding: '2px 0' }}>
                        {value === '未排班' ? '-' : value.slice(0, 2)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            )) : (
              <tr>
                <td colSpan={33} style={{ padding: '112px 0 128px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                  <EmptyState colors={colors} description="暂无排班人员" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ minHeight: 40, padding: '7px 16px', borderTop: `1px solid ${colors.cardBorder}`, backgroundColor: colors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: colors.textMuted }}>
          共 {filteredRows.length} 人，当前显示 {visibleScheduleRows.length} 人
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setTablePage(page => Math.max(1, page - 1))}
            disabled={currentTablePage <= 1}
            style={currentTablePage <= 1 ? disabledBtn(colors) : outlineBtn(colors)}
          >
            上一页
          </button>
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            {currentTablePage} / {tableTotalPages}
          </span>
          <button
            onClick={() => setTablePage(page => Math.min(tableTotalPages, page + 1))}
            disabled={currentTablePage >= tableTotalPages}
            style={currentTablePage >= tableTotalPages ? disabledBtn(colors) : outlineBtn(colors)}
          >
            下一页
          </button>
        </div>
      </div>
      {showJoinModal ? (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalPanelStyle(colors), width: 760 }}>
            <div style={modalHeaderStyle(colors)}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>加入人员到 {groupFilter}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>按员工、部门、岗位筛选后勾选人员，加入后会立即进入当前考勤组的排班表。</div>
              </div>
              <button onClick={() => setShowJoinModal(false)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 14, borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SearchField label="员工" placeholder="姓名或工号" colors={colors} width={174} value={joinFilters.employee} onChange={value => setJoinFilters(current => ({ ...current, employee: value }))} showUserIcon />
              <SelectField label="部门" placeholder="请选择" colors={colors} width={142} options={deptOptions} value={joinFilters.dept} onChange={value => setJoinFilters(current => ({ ...current, dept: value }))} />
              <SelectField label="岗位" placeholder="请选择" colors={colors} width={142} options={positionOptions} value={joinFilters.position} onChange={value => setJoinFilters(current => ({ ...current, position: value }))} />
              <SelectField label="员工类型" placeholder="请选择" colors={colors} width={142} options={employeeTypeOptions} value={joinFilters.employeeType} onChange={value => setJoinFilters(current => ({ ...current, employeeType: value }))} />
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0 }}>
                    <th style={{ ...th(colors), width: 46 }}><input type="checkbox" checked={joinCandidates.length > 0 && joinCandidates.every(row => joinSelected.has(row.employeeNo))} onChange={event => setJoinSelected(event.target.checked ? new Set(joinCandidates.map(row => row.employeeNo)) : new Set())} /></th>
                    {['姓名', '员工号', '部门', '岗位', '原考勤组'].map(column => <th key={column} style={th(colors)}>{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {joinCandidates.length ? joinCandidates.slice(0, 300).map(row => (
                    <tr key={row.employeeNo} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                      <td style={{ ...td(colors), textAlign: 'center' }}><input type="checkbox" checked={joinSelected.has(row.employeeNo)} onChange={() => toggleJoinEmployee(row.employeeNo)} /></td>
                      <td style={td(colors)}>{row.name}</td>
                      <td style={td(colors)}>{row.employeeNo}</td>
                      <td style={td(colors)}>{row.dept}</td>
                      <td style={td(colors)}>{row.position || '-'}</td>
                      <td style={td(colors)}>{row.attendGroup || '-'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ padding: '54px 0', textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>暂无可加入人员</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={modalFooterStyle(colors)}>
              <span style={{ marginRight: 'auto', fontSize: 12, color: colors.textMuted }}>已选 {joinSelected.size} 人，可选 {joinCandidates.length} 人</span>
              <button onClick={() => setShowJoinModal(false)} style={outlineBtn(colors)}>取消</button>
              <button onClick={joinEmployees} disabled={!joinSelected.size || joining} style={joinSelected.size && !joining ? primaryBtn(colors) : disabledBtn(colors)}>{joining ? '加入中...' : '加入当前考勤组'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {activeCell ? (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalPanelStyle(colors), width: 420 }}>
            <div style={modalHeaderStyle(colors)}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>选择班次</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{activeCell.row.name} / {month}-{String(activeCell.day).padStart(2, '0')}</div>
              </div>
              <button onClick={() => setActiveCell(null)} style={iconBtn(colors)}>×</button>
            </div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 360, overflow: 'auto' }}>
              {shiftOptions.map(shift => (
                <button key={shift.id} onClick={() => applySchedule(activeCell.row, activeCell.day, shift)} style={{ ...outlineBtn(colors), height: 'auto', minHeight: 42, justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 10px' }}>
                  <span style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>{shift.name}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted }}>{shift.time || '-'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ScheduleAdjustView({
  colors,
  currentTab,
  activeKey,
  onChangeTab,
  showMore,
  onToggleMore,
}: {
  colors: any;
  currentTab: AdjustTabConfig;
  activeKey: AdjustView;
  onChangeTab: (tab: AdjustView) => void;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  const exportAdjustRecords = () => {
    void downloadAttendanceXlsx({
      fileName: `${currentTab.label}.xlsx`,
      sheetName: currentTab.label,
      headers: currentTab.columns,
      rows: [],
      allowEmpty: true,
    });
  };

  return (
    <>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 20, minHeight: 40, flexShrink: 0 }}>
        {ADJUST_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onChangeTab(tab.key)}
            style={{
              padding: '10px 0 9px',
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: activeKey === tab.key ? colors.primary : colors.textMuted,
              borderBottom: activeKey === tab.key ? `2px solid ${colors.primary}` : '2px solid transparent',
              fontWeight: activeKey === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SearchField label="姓名/员工号" placeholder="请输入或选择人员" colors={colors} width={176} showUserIcon />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={148} />
          <SelectField label="审批状态" placeholder="请选择" colors={colors} width={148} />
          {renderAdjustPrimaryFilters(currentTab.key, colors)}
          <button onClick={exportAdjustRecords} style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12}/>导出Excel
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
              {currentTab.columns.map(column => (
                <th key={column} style={{ ...th(colors), minWidth: column.length >= 7 ? 132 : 112 }}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={currentTab.columns.length} style={{ padding: '136px 0 150px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                <EmptyState colors={colors} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderAdjustPrimaryFilters(tab: AdjustView, colors: any) {
  switch (tab) {
    case 'change':
      return (
        <>
          <DateRangeField label="更改时间" colors={colors} width={240} />
          <DateRangeField label="发起时间" colors={colors} width={240} />
        </>
      );
    case 'swap':
      return (
        <>
          <DateRangeField label="调班日期" colors={colors} width={240} />
          <DateRangeField label="还班日期" colors={colors} width={240} />
        </>
      );
    case 'switch':
      return (
        <>
          <DateRangeField label="换班日期" colors={colors} width={240} />
          <SelectField label="是否还班" placeholder="请选择" colors={colors} width={136} />
        </>
      );
    case 'leave':
      return (
        <>
          <DateRangeField label="排休日期范围" colors={colors} width={250} />
          <DateRangeField label="发起时间" colors={colors} width={240} />
        </>
      );
    default:
      return null;
  }
}

function renderAdjustMoreFilters(tab: AdjustView, colors: any) {
  switch (tab) {
    case 'change':
      return (
        <>
          <SelectField label="原班次" placeholder="全部" colors={colors} width={136} />
          <SelectField label="新班次" placeholder="全部" colors={colors} width={136} />
          <SearchField label="发起人" placeholder="请输入" colors={colors} width={166} />
        </>
      );
    case 'swap':
      return (
        <>
          <SelectField label="调班班次" placeholder="全部" colors={colors} width={136} />
          <SelectField label="还班班次" placeholder="全部" colors={colors} width={136} />
          <SearchField label="发起人" placeholder="请输入" colors={colors} width={166} />
        </>
      );
    case 'switch':
      return (
        <>
          <SearchField label="替班人" placeholder="请输入" colors={colors} width={166} />
          <SelectField label="换班结果" placeholder="全部" colors={colors} width={136} />
          <DateRangeField label="还班日期" colors={colors} width={240} />
        </>
      );
    case 'leave':
      return (
        <>
          <SelectField label="排休时段" placeholder="全部" colors={colors} width={136} />
          <SearchField label="发起人" placeholder="请输入" colors={colors} width={166} />
          <SelectField label="记录来源" placeholder="全部" colors={colors} width={136} />
        </>
      );
    default:
      return null;
  }
}

function TopTab({
  label,
  active,
  onClick,
  colors,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colors: any;
}) {
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

function DateRangeField({
  label,
  colors,
  width = 236,
}: {
  label: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input defaultValue={monthStartISO()} type="date" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input defaultValue={monthEndISO()} type="date" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SearchField({
  label,
  placeholder,
  colors,
  width = 170,
  showUserIcon = false,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
  showUserIcon?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input value={value ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} style={textInput(colors)} />
        {showUserIcon ? <Users size={12} style={{ color: colors.textMuted }} /> : null}
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  colors,
  width = 140,
  options = [],
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
  options?: string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        {onChange ? (
          <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ ...textInput(colors), color: value ? colors.text : colors.textMuted }}>
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

function EmptyState({ colors, description = '暂无内容' }: { colors: any; description?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 16,
          backgroundColor: colors.statCardBg,
          border: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <FileText size={24} style={{ color: colors.textMuted }} />
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -6,
            backgroundColor: '#3A78FF',
            color: '#fff',
            borderRadius: 9,
            fontSize: '10px',
            lineHeight: 1,
            padding: '4px 5px',
            fontWeight: 600,
          }}
        >
          ...
        </span>
      </div>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>暂无内容</span>
      {description !== '暂无内容' ? <span style={{ fontSize: '12px', color: colors.textMuted }}>{description}</span> : null}
    </div>
  );
}

function fieldShell(colors: any, width: number): React.CSSProperties {
  return {
    width,
    minHeight: 30,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 9px',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    boxSizing: 'border-box',
  };
}

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 900,
  backgroundColor: 'rgba(15, 23, 42, 0.38)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

function modalPanelStyle(colors: any): React.CSSProperties {
  return {
    maxWidth: 'calc(100vw - 48px)',
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 8,
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
    overflow: 'hidden',
  };
}

function modalHeaderStyle(colors: any): React.CSSProperties {
  return {
    minHeight: 52,
    padding: '0 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${colors.cardBorder}`,
  };
}

function modalFooterStyle(colors: any): React.CSSProperties {
  return {
    padding: '12px 18px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    borderTop: `1px solid ${colors.cardBorder}`,
  };
}

function textInput(colors: any): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '12px',
    color: colors.text,
  };
}

function dateInput(colors: any): React.CSSProperties {
  return {
    width: 96,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '12px',
    color: colors.text,
  };
}

function primaryBtn(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: 'none',
    borderRadius: 4,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  };
}

function disabledBtn(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: colors.tableHeaderBg,
    color: colors.textMuted,
    fontSize: '12px',
    cursor: 'not-allowed',
  };
}

function outlineBtn(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.text,
    fontSize: '12px',
    cursor: 'pointer',
  };
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

function toggleBtn(colors: any, active: boolean): React.CSSProperties {
  return {
    ...outlineBtn(colors),
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: active ? colors.primary : colors.text,
    borderColor: active ? colors.primary : colors.inputBorder,
    backgroundColor: active ? colors.badgeBlueBg : 'transparent',
  };
}

function iconBtn(colors: any): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
  };
}

function ghostIconBtn(colors: any): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
  };
}

function th(colors: any): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: '12px',
    color: colors.textMuted,
    fontWeight: 500,
    textAlign: 'left',
    borderBottom: `1px solid ${colors.tableBorder}`,
    whiteSpace: 'nowrap',
    backgroundColor: colors.tableHeaderBg,
  };
}

function td(colors: any): React.CSSProperties {
  return {
    padding: '8px 10px',
    fontSize: '12px',
    color: colors.text,
    borderBottom: `1px solid ${colors.tableBorder}`,
    whiteSpace: 'nowrap',
    backgroundColor: colors.cardBg,
  };
}
