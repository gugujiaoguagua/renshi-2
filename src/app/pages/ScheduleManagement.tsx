import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { fetchScheduleMonth, saveScheduleAssignments, type ScheduleMonthEmployee, type ScheduleShiftOption } from '../api/realData';
import { monthEndISO, monthStartISO, todayISO } from '../utils/date';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  HelpCircle,
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

const CALENDAR_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CALENDAR_WEEK_DAYS = ['五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日'];

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
        <TopTab label="班次调整记录" active={mainView === 'adjust'} onClick={() => navigate('/attendance/schedule-adjust')} colors={colors} />
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
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [shifts, setShifts] = useState<ScheduleShiftOption[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchScheduleMonth(month)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows || []);
        setShifts(res.shifts || []);
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
      && (!deptFilter || row.dept === deptFilter)
      && (!statusFilter || (statusFilter === '已排班' ? scheduledCount > 0 : scheduledCount === 0));
  });
  const deptOptions = Array.from(new Set(rows.map(row => row.dept).filter(Boolean)));
  const shiftOptions = shifts.length ? shifts : [{ id: 'shift_0900_1800', name: '早九晚六', time: '09:00-18:00' }];
  const monthLabel = `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
  const cycleStart = `${month}-01`;
  const cycleEnd = monthEndISO(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  const applySchedule = (row: ScheduleRow, day: number) => {
    const current = row.dayResults?.[String(day)] || '';
    const currentIndex = shiftOptions.findIndex(shift => shift.name === current);
    const nextShift = shiftOptions[(currentIndex + 1) % shiftOptions.length] || shiftOptions[0];
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const nextRows = rows.map(item => item.employeeNo === row.employeeNo
      ? { ...item, dayResults: { ...(item.dayResults || {}), [String(day)]: nextShift.name } }
      : item);
    setRows(nextRows);
    void saveScheduleAssignments([{
      date,
      employeeNo: row.employeeNo,
      employeeName: row.name,
      dept: row.dept,
      shiftId: nextShift.id,
      shiftName: nextShift.name,
    }]).catch(() => window.alert('排班已在页面更新，但保存到后端失败'));
  };
  const resetFilters = () => {
    setEmployeeFilter('');
    setDeptFilter('');
    setStatusFilter('');
  };

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
        <button style={{ border: 'none', background: 'transparent', color: colors.primary, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '12px' }}>
          <HelpCircle size={12} />
          使用指引
        </button>
      </div>

      <div style={{ padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectField label="考勤组" placeholder="请选择考勤组" colors={colors} width={148} />
          <SearchField label="员工" placeholder="请输入姓名或工号" colors={colors} width={178} showUserIcon value={employeeFilter} onChange={setEmployeeFilter} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={136} options={deptOptions} value={deptFilter} onChange={setDeptFilter} />
          <SelectField label="岗位" placeholder="请选择" colors={colors} width={136} />
          <SelectField label="员工类型" placeholder="请选择" colors={colors} width={144} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button style={iconBtn(colors)}><Settings2 size={12} /></button>
          </div>
        </div>
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` }}>
            <SelectField label="排班状态" placeholder="全部" colors={colors} width={128} options={['已排班', '未排班']} value={statusFilter} onChange={setStatusFilter} />
            <SelectField label="班次类型" placeholder="全部班次" colors={colors} width={138} />
            <SelectField label="显示范围" placeholder="仅在岗员工" colors={colors} width={144} />
            <SelectField label="编制岗位" placeholder="请选择" colors={colors} width={136} />
          </div>
        )}
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
            {filteredRows.length ? filteredRows.map(row => (
              <tr key={row.employeeNo} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                <td style={{ ...td(colors), width: 92, position: 'sticky', left: 0, zIndex: 2, backgroundColor: colors.cardBg }}>{row.name}</td>
                <td style={{ ...td(colors), width: 98, position: 'sticky', left: 92, zIndex: 2, backgroundColor: colors.cardBg }}>{row.employeeNo}</td>
                {CALENDAR_DAYS.map(day => {
                  const value = row.dayResults?.[String(day)] || '未排班';
                  return (
                    <td key={day} style={{ ...td(colors), width: 42, padding: '4px 2px', textAlign: 'center' }}>
                      <button onClick={() => applySchedule(row, day)} title="点击切换班次并同步到移动端排班" style={{ width: 34, minHeight: 24, border: `1px solid ${value === '未排班' ? colors.inputBorder : colors.primary}`, borderRadius: 4, background: value === '未排班' ? 'transparent' : colors.badgeBlueBg, color: value === '未排班' ? colors.textMuted : colors.primary, fontSize: 11, cursor: 'pointer', padding: '2px 0' }}>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button style={iconBtn(colors)}><Settings2 size={12} /></button>
          </div>
        </div>
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` }}>
            {renderAdjustMoreFilters(currentTab.key, colors)}
          </div>
        )}
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
