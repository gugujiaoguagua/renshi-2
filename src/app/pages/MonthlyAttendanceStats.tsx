import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchMonthlyAttendanceEmployees, type MonthlyAttendanceEmployee as RealMonthlyEmployee } from '../api/realData';
import { useAttendanceFilterDirectory } from '../shared/domain/attendanceFilters';
import { downloadAttendanceXlsx } from '../shared/export/attendanceExport';
import { todayISO } from '../utils/date';
import {
  ChevronDown, ChevronLeft, ChevronRight, Search, X,
  Info, Settings2, Download, Calendar,
} from 'lucide-react';

// ─── Types & Constants ───────────────────────
type ViewMode = 'result' | 'clock';

type Employee = RealMonthlyEmployee;

const LEFT_COLS = [
  { key: 'name',         label: '姓名',       defaultVis: true  },
  { key: 'empId',        label: '员工号',     defaultVis: true  },
  { key: 'dept',         label: '部门',       defaultVis: true  },
  { key: 'position',     label: '岗位',       defaultVis: false },
  { key: 'attendGroup',  label: '考勤组',     defaultVis: true  },
  { key: 'deptFullPath', label: '部门全路径', defaultVis: false },
  { key: 'bizGroup',     label: '业务分组',   defaultVis: false },
];

const DEPT_OPTIONS = ['产品研发中心', '产品运营部', '研发设计一部', '研发设计二部', '直营建连店', '工艺开发部', '技术支持部', '直营样品组', '技术服务组'];
const ATTEND_GROUPS = ['华托大厦考勤组', '综合考勤组', '研发中心考勤组', '工艺部考勤组'];
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const NOW = new Date();
const TODAY = { year: NOW.getFullYear(), month: NOW.getMonth(), day: NOW.getDate() };

const EMPLOYEES: Employee[] = [];

// ─── Helpers ─────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

function generateDays(year: number, month: number) {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const wd = d.getDay();
    return { day: i + 1, weekday: WEEKDAY_NAMES[wd], isWeekend: wd === 0 || wd === 6 };
  });
}

function getPastFuture(year: number, month: number, day: number) {
  if (year < TODAY.year) return 'past';
  if (year > TODAY.year) return 'future';
  if (month < TODAY.month) return 'past';
  if (month > TODAY.month) return 'future';
  return day < TODAY.day ? 'past' : day === TODAY.day ? 'today' : 'future';
}

// ─── Month Picker ─────────────────────────────
function MonthPicker({ year, month, onChange, onClose, colors }: {
  year: number; month: number;
  onChange: (y: number, m: number) => void; onClose: () => void; colors: any;
}) {
  const [y, setY] = useState(year);
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 300, marginTop: 4,
      backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
      borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 16, width: 220,
    }}>
      {/* Year nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setY(v => v - 1)} style={navBtnSt(colors)}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{y}年</span>
        <button onClick={() => setY(v => v + 1)} style={navBtnSt(colors)}><ChevronRight size={14} /></button>
      </div>
      {/* Months grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MONTH_LABELS.map((label, i) => {
          const active = y === year && i === month;
          return (
            <button key={i}
              onClick={() => { onChange(y, i); onClose(); }}
              style={{
                padding: '6px 0', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`,
                borderRadius: 4, cursor: 'pointer',
                backgroundColor: active ? colors.primary : 'transparent',
                color: active ? '#fff' : colors.text,
              }}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Column settings panel ────────────────────
function ColPanel({ colors, visible, onToggle, onToggleAll, onCancel, onApply }: {
  colors: any; visible: string[];
  onToggle: (k: string) => void; onToggleAll: () => void;
  onCancel: () => void; onApply: () => void;
}) {
  const allChecked = LEFT_COLS.every(c => visible.includes(c.key));
  const someChecked = LEFT_COLS.some(c => visible.includes(c.key));
  const indeterminate = someChecked && !allChecked;

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 300, marginTop: 4,
      backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
      borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      width: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${colors.divider}` }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>表头设置</span>
      </div>
      {/* All-select row */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.divider}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
          <input
            type="checkbox"
            ref={el => { if (el) el.indeterminate = indeterminate; }}
            checked={allChecked}
            onChange={onToggleAll}
            style={{ accentColor: colors.primary, width: 14, height: 14 }}
          />
          全选
        </label>
      </div>
      {/* Column list */}
      <div style={{ padding: '4px 0', maxHeight: 260, overflowY: 'auto' }}>
        {LEFT_COLS.map(col => (
          <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '12px', color: colors.text }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <input
              type="checkbox"
              checked={visible.includes(col.key)}
              onChange={() => onToggle(col.key)}
              style={{ accentColor: colors.primary, width: 14, height: 14 }}
            />
            {col.label}
          </label>
        ))}
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: `1px solid ${colors.divider}` }}>
        <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
        <button onClick={onApply} style={primaryBtn(colors)}>确定</button>
      </div>
    </div>
  );
}

// ─── 考勤结果显示设置 Panel ────────────────────
function ResultSettings({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [displayMode, setDisplayMode] = useState<'text' | 'abbr'>('text');
  const [colorMode, setColorMode] = useState<'all' | 'abnormal'>('all');
  const [showWeekend, setShowWeekend] = useState(true);
  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 300, marginTop: 4,
      backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
      borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      width: 260, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${colors.divider}` }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>考勤结果显示设置</span>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={13} /></button>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 显示方式 */}
        <div>
          <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 8 }}>考勤结果显示方式</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'text', label: '文字显示' }, { v: 'abbr', label: '简写显示' }].map(opt => (
              <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
                <input type="radio" value={opt.v} checked={displayMode === opt.v} onChange={() => setDisplayMode(opt.v as any)} style={{ accentColor: colors.primary }} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {/* 高亮颜色 */}
        <div>
          <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 8 }}>结果高亮颜色</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'all', label: '全部显示' }, { v: 'abnormal', label: '仅异常高亮' }].map(opt => (
              <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
                <input type="radio" value={opt.v} checked={colorMode === opt.v} onChange={() => setColorMode(opt.v as any)} style={{ accentColor: colors.primary }} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {/* 显示周末 */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
            <input type="checkbox" checked={showWeekend} onChange={e => setShowWeekend(e.target.checked)} style={{ accentColor: colors.primary }} />
            显示周末列背景
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: `1px solid ${colors.divider}` }}>
        <button onClick={onClose} style={outlineBtn(colors)}>取消</button>
        <button onClick={onClose} style={primaryBtn(colors)}>保存</button>
      </div>
    </div>
  );
}

// ─── Filter dropdown ──────────────────────────
function FilterSel({
  label,
  options,
  colors,
  value,
  onChange,
  placeholder = '请选择',
}: {
  label: string;
  options: string[];
  colors: any;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [innerVal, setInnerVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const controlled = typeof value === 'string' && typeof onChange === 'function';
  const currentVal = controlled ? value : innerVal;
  const setValue = (next: string) => {
    if (controlled && onChange) {
      onChange(next);
      return;
    }
    setInnerVal(next);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${open ? colors.primary : colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, cursor: 'pointer', minWidth: 120 }}>
        {label && <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>}
        <span style={{ flex: 1, fontSize: '12px', color: currentVal ? colors.text : colors.textMuted, marginLeft: label ? 4 : 0 }}>{currentVal || placeholder}</span>
        {currentVal ? <X size={11} style={{ color: colors.textMuted }} onClick={e => { e.stopPropagation(); setValue(''); }} /> : <ChevronDown size={11} style={{ color: colors.textMuted }} />}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 140, overflow: 'hidden' }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { setValue(opt); setOpen(false); }}
              style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', color: currentVal === opt ? colors.primary : colors.text }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────
export default function MonthlyAttendanceStats() {
  const { colors } = useTheme();
  const attendanceFilters = useAttendanceFilterDirectory();
  const [year, setYear] = useState(TODAY.year);
  const [month, setMonth] = useState(TODAY.month);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('result');
  const [hideResigned, setHideResigned] = useState(false);
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [draftEmpSearch, setDraftEmpSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [draftDeptFilter, setDraftDeptFilter] = useState('');
  const [attendGroupFilter, setAttendGroupFilter] = useState('');
  const [draftAttendGroupFilter, setDraftAttendGroupFilter] = useState('');
  const [visibleCols, setVisibleCols] = useState<string[]>(LEFT_COLS.filter(c => c.defaultVis).map(c => c.key));
  const [pendingCols, setPendingCols] = useState<string[]>(LEFT_COLS.filter(c => c.defaultVis).map(c => c.key));
  const [showColPanel, setShowColPanel] = useState(false);
  const [showResultSettings, setShowResultSettings] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [showDataInfo, setShowDataInfo] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadMonthlyAttendance = useCallback(async () => {
    try {
      const res = await fetchMonthlyAttendanceEmployees();
      setEmployees(res.rows || []);
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadMonthlyAttendance();
  }, [loadMonthlyAttendance]);

  const monthPickerRef = useRef<HTMLDivElement>(null);
  const colPanelRef = useRef<HTMLDivElement>(null);
  const resultSettingsRef = useRef<HTMLDivElement>(null);
  useClickOutside(monthPickerRef, () => setShowMonthPicker(false));

  const days = generateDays(year, month);

  const isAbnormalEmployee = (emp: Employee) => Object.values(emp.dayResults || {}).some(value => value && !value.includes('正常') && !value.includes('休'));

  const applyFilters = () => {
    setEmpSearch(draftEmpSearch.trim());
    setDeptFilter(draftDeptFilter);
    setAttendGroupFilter(draftAttendGroupFilter);
    setCurrentPage(1);
    setJumpPage('');
  };

  const updateDraftEmpSearch = (value: string) => {
    setDraftEmpSearch(value);
    setEmpSearch(value.trim());
    setCurrentPage(1);
    setJumpPage('');
  };

  const updateDraftDeptFilter = (value: string) => {
    setDraftDeptFilter(value);
    setDeptFilter(value);
    setCurrentPage(1);
    setJumpPage('');
  };

  const updateDraftAttendGroupFilter = (value: string) => {
    setDraftAttendGroupFilter(value);
    setAttendGroupFilter(value);
    setCurrentPage(1);
    setJumpPage('');
  };

  const resetFilters = () => {
    setDraftEmpSearch('');
    setDraftDeptFilter('');
    setDraftAttendGroupFilter('');
    setEmpSearch('');
    setDeptFilter('');
    setAttendGroupFilter('');
    setCurrentPage(1);
    setJumpPage('');
  };

  const filteredEmployees = employees.filter(emp => {
    const matchLinked = attendanceFilters.matchesLinkedFilters(emp, {
      dept: deptFilter,
      attendGroup: attendGroupFilter,
      keyword: empSearch,
    });
    const matchAbnormal = !onlyAbnormal || isAbnormalEmployee(emp);
    const matchResigned = !hideResigned || Boolean(emp.empId);
    return matchLinked && matchAbnormal && matchResigned;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (!sortCol) return 0;
    const av = `${(a as any)[sortCol] ?? ''}`;
    const bv = `${(b as any)[sortCol] ?? ''}`;
    return av.localeCompare(bv, 'zh-CN', { numeric: true, sensitivity: 'base' });
  });

  const totalCount = sortedEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const exportDisabled = sortedEmployees.length === 0;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedEmployees = sortedEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Formatted month string
  const monthStr = `${year}年${String(month + 1).padStart(2, '0')}月`;
  const dateStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const dateEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(days.length).padStart(2, '0')}`;

  // Column panel handlers
  const openColPanel = () => { setPendingCols([...visibleCols]); setShowColPanel(true); };
  const applyColPanel = () => { setVisibleCols([...pendingCols]); setShowColPanel(false); };
  const togglePending = (key: string) => setPendingCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const toggleAllPending = () => {
    const all = LEFT_COLS.every(c => pendingCols.includes(c.key));
    setPendingCols(all ? [] : LEFT_COLS.map(c => c.key));
  };

  const visibleColDefs = LEFT_COLS.filter(c => visibleCols.includes(c.key));

  // Get cell value for a specific employee + day
  const getCellResult = (emp: Employee, day: number, isWeekend: boolean): React.ReactNode => {
    const realValue = emp.dayResults?.[String(day)]?.trim();
    if (realValue) {
      const clean = realValue.replace(/\n/g, ' / ');
      const isNormal = clean.includes('正常');
      const isRest = clean.includes('休');
      return <span style={{ fontSize: '11px', color: isNormal ? '#059669' : isRest ? colors.textMuted : '#D97706', fontWeight: isNormal || !isRest ? 500 : 400 }}>{clean}</span>;
    }
    if (isWeekend) {
      return <span style={{ fontSize: '11px', color: colors.textMuted }}>休</span>;
    }
    const state = getPastFuture(year, month, day);
    if (state === 'future') {
      return <span style={{ fontSize: '11px', color: colors.textMuted }}>未核算</span>;
    }
    return <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 500 }}>未排班</span>;
  };

  const getCellClock = (emp: Employee, day: number, isWeekend: boolean): React.ReactNode => {
    const realClock = emp.dayClocks?.[String(day)]?.trim();
    if (realClock) {
      const clean = realClock.replace(/\n/g, ' / ');
      return <span style={{ fontSize: '11px', color: clean.includes('异常') ? '#D97706' : colors.text, fontWeight: 500 }}>{clean}</span>;
    }
    if (isWeekend) return <span style={{ fontSize: '11px', color: colors.textMuted }}>—</span>;
    const state = getPastFuture(year, month, day);
    if (state === 'future') return <span style={{ fontSize: '11px', color: colors.textMuted }}>—</span>;
    return <span style={{ fontSize: '11px', color: colors.textMuted }}>未打卡</span>;
  };

  const getPages = (): (number | '...')[] => totalPages <= 7
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, 5, '...', totalPages]
      : currentPage >= totalPages - 3
        ? [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];

  const handleExport = () => {
    if (exportDisabled) return;
    const headers = [
      ...visibleColDefs.map(col => col.label),
      ...days.map(day => `${String(month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`),
    ];

    const rows = sortedEmployees.map(emp => {
      const left = visibleColDefs.map(col => `${(emp as any)[col.key] ?? '-'}`);
      const right = days.map(day => {
        if (viewMode === 'result') {
          const realValue = emp.dayResults?.[String(day.day)]?.trim();
          if (realValue) return realValue.replace(/\n/g, ' / ');
          if (day.isWeekend) return '休';
          const state = getPastFuture(year, month, day.day);
          if (state === 'future') return '未核算';
          return '未排班';
        }

        const realClock = emp.dayClocks?.[String(day.day)]?.trim();
        if (realClock) return realClock.replace(/\n/g, ' / ');
        if (day.isWeekend) return '—';
        const state = getPastFuture(year, month, day.day);
        if (state === 'future') return '—';
        return '未打卡';
      });
      return [...left, ...right];
    });

    void downloadAttendanceXlsx({
      fileName: `月考勤明细-${year}-${String(month + 1).padStart(2, '0')}-${viewMode === 'result' ? '考勤结果' : '打卡记录'}.xlsx`,
      sheetName: viewMode === 'result' ? '考勤结果' : '打卡记录',
      headers,
      rows,
      saveAs: true,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>

      {/* ── Filter bar ───────────────────── */}
      <div style={{ padding: '10px 16px 0', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        {/* Row 1: Month picker + date range + filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          {/* Month picker */}
          <div ref={monthPickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMonthPicker(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                fontSize: '14px', fontWeight: 600, border: `1px solid ${showMonthPicker ? colors.primary : colors.inputBorder}`,
                borderRadius: 6, cursor: 'pointer', backgroundColor: colors.inputBg, color: colors.text,
              }}>
              {monthStr} <ChevronDown size={13} style={{ color: colors.textMuted }} />
            </button>
            {showMonthPicker && (
              <MonthPicker year={year} month={month}
                onChange={(y, m) => { setYear(y); setMonth(m); setShowMonthPicker(false); }}
                onClose={() => setShowMonthPicker(false)} colors={colors} />
            )}
          </div>

          {/* Date range (readonly, derived from month) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>考勤日期</span>
            <Calendar size={12} style={{ color: colors.textMuted, marginLeft: 4 }} />
            <span style={{ fontSize: '12px', color: colors.text }}>{dateStartStr}</span>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
            <span style={{ fontSize: '12px', color: colors.text }}>{dateEndStr}</span>
          </div>

          <FilterSel label="部门" options={attendanceFilters.departmentOptions.length ? attendanceFilters.departmentOptions : DEPT_OPTIONS} value={draftDeptFilter} onChange={updateDraftDeptFilter} colors={colors} />

          {/* Employee search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth: 180 }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>员工</span>
            <Search size={12} style={{ color: colors.textMuted }} />
            <input value={draftEmpSearch} onChange={e => updateDraftEmpSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
              placeholder="输入姓名或工号"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, minWidth: 0 }} />
          </div>

          <FilterSel label="考勤组" options={attendanceFilters.attendanceGroupOptions.length ? attendanceFilters.attendanceGroupOptions : ATTEND_GROUPS} value={draftAttendGroupFilter} onChange={updateDraftAttendGroupFilter} colors={colors} />
          <button
            onClick={handleExport}
            disabled={exportDisabled}
            style={{
              height: 32,
              border: 'none',
              borderRadius: 4,
              background: exportDisabled ? colors.inputBorder : colors.primary,
              color: exportDisabled ? colors.textMuted : colors.primaryText,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              cursor: exportDisabled ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={14}/>导出Excel
          </button>

        </div>

        {/* Row 2: View toggle + options + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8, flexWrap: 'wrap' }}>
          {/* 考勤结果 / 打卡记录 toggle */}
          <div style={{ display: 'flex', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, overflow: 'hidden' }}>
            {[
              { v: 'result', label: '考勤结果' },
              { v: 'clock',  label: '打卡记录' },
            ].map(tab => (
              <button key={tab.v}
                onClick={() => setViewMode(tab.v as ViewMode)}
                style={{
                  padding: '5px 14px', fontSize: '12px', border: 'none', cursor: 'pointer',
                  backgroundColor: viewMode === tab.v ? colors.primary : 'transparent',
                  color: viewMode === tab.v ? '#fff' : colors.text,
                  fontWeight: viewMode === tab.v ? 600 : 400,
                }}>
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Calendar table ───────────────── */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}` }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 20 }}>
              {/* Fixed left info columns */}
              {visibleColDefs.map((col, ci) => (
                <th key={col.key}
                  style={{
                    ...thSt(colors),
                    width: col.key === 'name' ? 64 : col.key === 'empId' ? 80 : col.key === 'deptFullPath' ? 150 : 90,
                    position: 'sticky',
                    left: ci === 0 ? 0 : undefined,
                    zIndex: ci === 0 ? 25 : 20,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSortCol(col.key)}>
                  {col.label}
                </th>
              ))}
              {/* Date columns */}
              {days.map(day => (
                <th key={day.day}
                  style={{
                    ...thSt(colors),
                    width: 82, minWidth: 82,
                    backgroundColor: day.isWeekend ? (colors.tableStripe || '#f8f4f0') : colors.tableHeaderBg,
                    borderLeft: `1px solid ${colors.tableBorder}`,
                    whiteSpace: 'nowrap',
                    color: day.isWeekend ? colors.primary : colors.textMuted,
                    textAlign: 'center',
                  }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>
                    {String(month + 1).padStart(2, '0')}月{String(day.day).padStart(2, '0')}日
                  </div>
                  <div style={{ fontSize: '10px', color: day.isWeekend ? colors.primary : colors.textMuted, opacity: 0.8 }}>
                    （星期{day.weekday}）
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedEmployees.map((emp, ei) => (
              <tr key={emp.empId}
                style={{ backgroundColor: ei % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}`, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = ei % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                {/* Fixed info cells */}
                {visibleColDefs.map((col, ci) => (
                  <td key={col.key}
                    style={{
                      ...tdSt(colors),
                      position: ci === 0 ? 'sticky' : undefined,
                      left: ci === 0 ? 0 : undefined,
                      zIndex: ci === 0 ? 15 : undefined,
                      backgroundColor: ci === 0 ? (ei % 2 === 0 ? colors.cardBg : colors.tableStripe) : undefined,
                      color: col.key === 'name' ? colors.primary : col.key === 'empId' ? colors.textMuted : colors.text,
                      fontSize: col.key === 'empId' ? '11px' : '12px',
                      fontWeight: col.key === 'name' ? 500 : 400,
                      cursor: col.key === 'name' ? 'pointer' : undefined,
                      maxWidth: col.key === 'deptFullPath' ? 150 : undefined,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                    {(emp as any)[col.key] || '-'}
                  </td>
                ))}
                {/* Date cells */}
                {days.map(day => (
                  <td key={day.day}
                    style={{
                      ...tdSt(colors),
                      textAlign: 'center',
                      backgroundColor: day.isWeekend ? `${colors.tableStripe}` : undefined,
                      borderLeft: `1px solid ${colors.tableBorder}`,
                      padding: '6px 4px',
                    }}>
                    {viewMode === 'result'
                      ? getCellResult(emp, day.day, day.isWeekend)
                      : getCellClock(emp, day.day, day.isWeekend)
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Bottom bar ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        {/* 数据更新说明 */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => setShowDataInfo(true)}
            onMouseLeave={() => setShowDataInfo(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: colors.textMuted }}>
            数据更新说明
            <Info size={13} style={{ color: colors.textMuted }} />
          </button>
          {showDataInfo && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, zIndex: 200, marginBottom: 6,
              backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
              borderRadius: 6, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              width: 280, fontSize: '12px', color: colors.text,
            }}>
              <p style={{ marginBottom: 4, fontWeight: 500 }}>数据说明</p>
              <p style={{ color: colors.textMuted, lineHeight: 1.5 }}>
                月考勤数据每日凌晨 02:00 自动更新，如有疑问请联系 HR 管理员。
                最近更新时间：{todayISO()} 02:00
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{totalCount}笔</span>
        <button style={pagBtnSt(colors, false)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={12} /></button>
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
            : <button key={p} style={pagBtnSt(colors, currentPage === p)} onClick={() => setCurrentPage(p as number)}>{p}</button>
        )}
        <button style={pagBtnSt(colors, false)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={12} /></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setCurrentPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); } }}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>
    </div>
  );
}

// ─── Style helpers ───────────────────────────
function primaryBtn(colors: any): React.CSSProperties { return { padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: colors.primary, color: '#fff', whiteSpace: 'nowrap' }; }
function outlineBtn(colors: any): React.CSSProperties { return { padding: '5px 12px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent', color: colors.text, whiteSpace: 'nowrap' }; }
function navBtnSt(colors: any): React.CSSProperties { return { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textMuted }; }
function thSt(colors: any): React.CSSProperties { return { padding: '8px 10px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, backgroundColor: colors.tableHeaderBg, whiteSpace: 'nowrap' }; }
function tdSt(colors: any): React.CSSProperties { return { padding: '7px 10px', fontSize: '12px', color: colors.text }; }
function pagBtnSt(colors: any, active: boolean): React.CSSProperties {
  return {
    minWidth: 24,
    height: 24,
    padding: '0 5px',
    fontSize: '12px',
    border: `1px solid ${active ? colors.primary : colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: active ? colors.primary : 'transparent',
    color: active ? '#fff' : colors.text,
    cursor: 'pointer',
  };
}
