import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchAttendanceEmployees, type AttendanceEmployee } from '../api/realData';
import {
  Calendar, Search, RefreshCw, ChevronDown, Settings2,
  ChevronLeft, ChevronRight, X, ChevronUp, RotateCcw,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────
const DEPT_TREE = [
  { id: 'd1', label: '沪电商' },
  { id: 'd2', label: '美工库' },
  { id: 'd3', label: '流门月量' },
  { id: 'd4', label: '其实情' },
  { id: 'd5', label: '高实化里' },
  { id: 'd6', label: '花花YOUNG' },
  { id: 'd7', label: '真元全黑' },
];

const ATTEND_GROUPS = ['综合考勤组', '华旺大厦考勤组', '研发中心考勤组', '工艺部考勤组'];

const SHIFTS = [
  '早七点半到五点半',
  '早八点半到五点半',
  '早十点半到六点半',
  '早十二点到八点',
  '早八点半到六点',
  '早九点半到八点',
];

const ALL_COLUMNS = [
  { key: 'name',       label: '姓名',       required: true },
  { key: 'empId',      label: '员工工号',   required: false },
  { key: 'attendGroup',label: '考勤组',     required: false },
  { key: 'dept',       label: '部门',       required: false },
  { key: 'deptFull',   label: '部门全路径', required: false },
  { key: 'shift',      label: '班次',       required: false },
  { key: 'type',       label: '考勤类型',   required: false },
  { key: 'attendance', label: '出勤情况',   required: false },
  { key: 'status',     label: '状态',       required: false },
  { key: 'anomaly',    label: '异常明细',   required: false },
  { key: 'leave',      label: '请假',       required: false },
  { key: 'fieldTrip',  label: '外出/出差',  required: false },
  { key: 'cin1',       label: '签到1',      required: false },
  { key: 'cout1',      label: '签退1',      required: false },
  { key: 'cin2',       label: '签到2',      required: false },
  { key: 'cout2',      label: '签退2',      required: false },
  { key: 'cin3',       label: '签到3',      required: false },
  { key: 'cout3',      label: '签退3',      required: false },
];

const DEFAULT_VISIBLE = ALL_COLUMNS
  .filter(c => c.key !== 'deptFull')
  .map(c => c.key);

type Employee = {
  name: string; empId: string; attendGroup: string; dept: string;
  shift: string; type: string; attendance: string; status: string;
  anomaly: string; leave: string; fieldTrip: string;
  cin1: string; cout1: string; cin2: string; cout2: string;
  cin3: string; cout3: string;
};

const EMPLOYEES: Employee[] = [
  { name: '李碧芳', empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '林姐',   empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '王秀芬', empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '唐秀华', empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '张旭',   empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '卢文恒', empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '杨洁',   empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '张海平', empId: '', attendGroup: '', dept: '综合人员', shift: '', type: '休息', attendance: '休息', status: '休息', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '林鑫',   empId: 'CP25003', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '产品研发中心', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '曹文部', empId: 'CP25004', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '产品运营部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '徐徐明', empId: 'CP25005', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '产品运营部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '连接仪', empId: 'CP25006', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '产品运营部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '张芸通', empId: 'CP25007', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '研发设计一部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '张持乃', empId: 'CP25008', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '研发设计一部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '李新成', empId: 'CP25009', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '研发设计一部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '林建勋', empId: 'CP25010', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '研发设计二部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '吴洪富', empId: 'CP25011', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '直营渠道组', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '程秀薇', empId: 'CP25012', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '工艺开发部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '姚钦均', empId: 'CP25013', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '工艺开发部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '崔晴洁', empId: 'CP25014', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '工艺开发部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '谢梅',   empId: 'CP25015', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '工艺开发部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
  { name: '方责',   empId: 'CP25016', attendGroup: '华旺大厦', dept: '华旺大厦', shift: '工艺开发部', type: '未排班', attendance: '未出勤', status: '未出勤', anomaly: '-', leave: '-', fieldTrip: '-', cin1: '-', cout1: '-', cin2: '-', cout2: '-', cin3: '-', cout3: '-' },
].slice(0, 5);

const FILTER_DEPTS = Array.from(new Set(EMPLOYEES.map(emp => emp.dept).filter(Boolean))).map((label, index) => ({
  id: `dept-${index + 1}`,
  label,
}));
const FILTER_ATTEND_GROUPS = Array.from(new Set(EMPLOYEES.map(emp => (emp.attendGroup || emp.dept)).filter(Boolean)));
const FILTER_SHIFTS = Array.from(new Set(EMPLOYEES.map(emp => emp.shift).filter(Boolean)));

type Filters = {
  startDate: string;
  endDate: string;
  dept: string;
  attendGroup: string;
  shift: string;
  employmentStatus: string;
  empSearch: string;
};

const DEFAULT_FILTERS: Filters = {
  startDate: '2026-05-06',
  endDate: '2026-05-07',
  dept: '',
  attendGroup: '',
  shift: '',
  employmentStatus: '',
  empSearch: '',
};

// ─────────────────────────────────────────────
// Stat config
// ─────────────────────────────────────────────
const STAT_ROW1_COLORS = {
  text: 'text',
  pending: '#7C3AED',
  present: '#059669',
  absent: '#2563EB',
  late: '#D97706',
  absentWork: '#DC2626',
  muted: 'muted',
  card: '#0891B2',
} as const;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value || '请选择日期';
  return `${year}年${month}月${day}日`;
}

function DateField({ value, onChange, colors, active }: { value: string; onChange: (value: string) => void; colors: any; active?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const input = inputRef.current;
    if (!input) return;

    if ('showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <label
      style={{ ...inputBox(colors), position: 'relative', borderColor: active ? colors.primary : colors.inputBorder }}
      onMouseDown={e => {
        e.preventDefault();
        openDatePicker();
      }}
      onClick={e => e.preventDefault()}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDatePicker();
        }
      }}
    >
      <Calendar size={13} style={{ color: active ? colors.primary : colors.textMuted }} />
      <span style={{ color: active ? colors.primary : colors.text }}>{formatDateLabel(value)}</span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </label>
  );
}

function DeptDropdown({ colors, value, onChange, options }: { colors: any; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const filtered = options.filter(d => d.label.includes(search));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          border: `1px solid ${open ? colors.primary : colors.inputBorder}`,
          borderRadius: '4px', padding: '5px 10px', fontSize: '12px',
          color: value ? colors.text : colors.textMuted,
          backgroundColor: colors.inputBg, cursor: 'pointer', minWidth: '120px',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ color: colors.text, fontWeight: 400, fontSize: '12px', whiteSpace: 'nowrap' }}>部门</span>
        <span style={{ flex: 1, color: value ? colors.text : colors.textMuted, marginLeft: '4px' }}>
          {value || '请选择'}
        </span>
        {value
          ? <X size={11} style={{ color: colors.textMuted, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onChange(''); }} />
          : <ChevronDown size={12} style={{ color: colors.textMuted, flexShrink: 0 }} />
        }
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px',
          backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
          borderRadius: '6px', minWidth: '180px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px', borderBottom: `1px solid ${colors.divider}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
              borderRadius: '4px', padding: '4px 8px',
            }}>
              <Search size={12} style={{ color: colors.textMuted }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索部门"
                style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: '100%' }}
                autoFocus
              />
            </div>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.map(d => (
              <div
                key={d.id}
                onClick={() => { onChange(d.label); setOpen(false); setSearch(''); }}
                style={{
                  padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                  color: value === d.label ? colors.primary : colors.text,
                  backgroundColor: value === d.label ? colors.badgeRedBg : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (value !== d.label) (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover; }}
                onMouseLeave={e => { if (value !== d.label) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {d.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: colors.textMuted }}>无匹配结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleDropdown({ label, options, value, onChange, colors }: { label: string; options: string[]; value: string; onChange: (value: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          border: `1px solid ${open ? colors.primary : colors.inputBorder}`,
          borderRadius: '4px', padding: '5px 10px', fontSize: '12px',
          backgroundColor: colors.inputBg, cursor: 'pointer', minWidth: '120px',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ color: colors.text, fontWeight: 400, fontSize: '12px', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ flex: 1, color: value ? colors.text : colors.textMuted, marginLeft: '4px' }}>
          {value || '请选择'}
        </span>
        {value
          ? <X size={11} style={{ color: colors.textMuted, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onChange(''); }} />
          : <ChevronDown size={12} style={{ color: colors.textMuted, flexShrink: 0 }} />
        }
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px',
          backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
          borderRadius: '6px', minWidth: '180px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {options.map((opt, i) => (
              <div
                key={i}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                  color: value === opt ? colors.primary : colors.text,
                  backgroundColor: value === opt ? colors.badgeRedBg : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (value !== opt) (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover; }}
                onMouseLeave={e => { if (value !== opt) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function AttendanceStats() {
  const { colors } = useTheme();
  const [employees, setEmployees] = useState<Employee[]>(EMPLOYEES);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [showColPanel, setShowColPanel] = useState(false);
  const [pendingCols, setPendingCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const colPanelRef = useRef<HTMLDivElement>(null);

  const loadAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAttendanceEmployees();
      setEmployees(res.rows || []);
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前展示静态数据');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const filterDepts = useMemo(
    () => Array.from(new Set(employees.map(emp => emp.dept).filter(Boolean))).map((label, index) => ({ id: `dept-${index + 1}`, label })),
    [employees]
  );
  const filterAttendGroups = useMemo(
    () => Array.from(new Set(employees.map(emp => (emp.attendGroup || emp.dept)).filter(Boolean))),
    [employees]
  );
  const filterShifts = useMemo(
    () => Array.from(new Set(employees.map(emp => emp.shift).filter(Boolean))),
    [employees]
  );

  // Column settings panel
  const openColPanel = () => {
    setPendingCols([...visibleCols]);
    setShowColPanel(true);
  };
  const closeColPanel = () => setShowColPanel(false);
  const applyColPanel = () => { setVisibleCols([...pendingCols]); setShowColPanel(false); };

  const togglePendingCol = (key: string) => {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.required) return;
    setPendingCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };
  const allPendingSelected = ALL_COLUMNS.every(c => pendingCols.includes(c.key));
  const toggleAllPending = () => {
    if (allPendingSelected) {
      setPendingCols(ALL_COLUMNS.filter(c => c.required).map(c => c.key));
    } else {
      setPendingCols(ALL_COLUMNS.map(c => c.key));
    }
  };

  const updateDraftFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
    setJumpPage('');
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setActiveStatFilter(null);
    setCurrentPage(1);
    setJumpPage('');
  };

  const handleRefresh = () => {
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
    setJumpPage('');
    setShowColPanel(false);
    loadAttendance();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      '休息':   { bg: colors.badgeGrayBg, text: colors.badgeGrayText },
      '未出勤': { bg: colors.badgeGrayBg, text: colors.badgeGrayText },
      '已出勤': { bg: colors.badgeGreenBg, text: colors.badgeGreenText },
      '迟到':   { bg: colors.badgeRedBg, text: colors.badgeRedText },
      '旷工':   { bg: colors.badgeRedBg, text: colors.badgeRedText },
    };
    const s = map[status] || { bg: colors.badgeGrayBg, text: colors.badgeGrayText };
    return (
      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', backgroundColor: s.bg, color: s.text, whiteSpace: 'nowrap' }}>
        {status}
      </span>
    );
  };

  // Sorting
  const handleSort = (key: string) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  const baseFilteredEmployees = employees.filter(emp => {
    const keyword = appliedFilters.empSearch.trim().toLowerCase();
    const matchesKeyword = !keyword || emp.name.toLowerCase().includes(keyword) || emp.empId.toLowerCase().includes(keyword);
    const matchesDept = !appliedFilters.dept || emp.dept === appliedFilters.dept;
    const matchesAttendGroup = !appliedFilters.attendGroup || (emp.attendGroup || emp.dept) === appliedFilters.attendGroup;
    const matchesShift = !appliedFilters.shift || emp.shift === appliedFilters.shift;
    const matchesEmploymentStatus = !appliedFilters.employmentStatus
      || (appliedFilters.employmentStatus === '已入职' ? Boolean(emp.empId) : !emp.empId);
    return matchesKeyword && matchesDept && matchesAttendGroup && matchesShift && matchesEmploymentStatus;
  });

  const matchesStatFilter = (emp: Employee) => {
    if (!activeStatFilter || activeStatFilter === 'all') return true;
    if (activeStatFilter === 'pending') return !['已出勤', '未出勤', '迟到', '旷工', '休息'].includes(emp.status);
    if (activeStatFilter === 'present') return emp.status === '已出勤';
    if (activeStatFilter === 'absent') return emp.status === '未出勤';
    if (activeStatFilter === 'late') return emp.status === '迟到' || emp.anomaly.includes('迟到');
    if (activeStatFilter === 'absentWork') return emp.status === '旷工' || emp.anomaly.includes('旷工');
    if (activeStatFilter === 'rest') return emp.status === '休息' || emp.attendance === '休息';
    if (activeStatFilter === 'unplanned') return emp.type === '未排班' || emp.anomaly.includes('未排班');
    if (activeStatFilter === 'card') return (emp.cin1 && emp.cin1 !== '-') || (emp.cout1 && emp.cout1 !== '-');
    if (activeStatFilter === 'worked') return emp.attendance === '已出勤';
    if (activeStatFilter === 'leave') return emp.leave && emp.leave !== '-';
    if (activeStatFilter === 'trip') return emp.fieldTrip.includes('出差');
    if (activeStatFilter === 'outing') return emp.fieldTrip.includes('外出');
    if (activeStatFilter === 'early') return emp.anomaly.includes('早退');
    if (activeStatFilter === 'missing') return emp.anomaly.includes('缺卡');
    if (activeStatFilter === 'overtime') return emp.anomaly.includes('加班');
    if (activeStatFilter === 'overtimeAnomaly') return emp.anomaly.includes('加班异常');
    return true;
  };

  const filteredEmployees = baseFilteredEmployees.filter(matchesStatFilter);
  const applyStatFilter = (key: string) => {
    setActiveStatFilter(current => current === key ? null : key);
    setCurrentPage(1);
    setJumpPage('');
  };

  const countWhere = (predicate: (emp: Employee) => boolean) => baseFilteredEmployees.filter(predicate).length;
  const countStatus = (status: string) => countWhere(emp => emp.status === status);

  const presentCount = countStatus('已出勤');
  const absentCount = countStatus('未出勤');
  const lateCount = countStatus('迟到');
  const absentWorkCount = countStatus('旷工');
  const restCount = countStatus('休息');
  const unplannedCount = countWhere(emp => emp.type === '未排班');
  const cardCount = countWhere(emp => (emp.cin1 && emp.cin1 !== '-') || (emp.cout1 && emp.cout1 !== '-'));
  const workedCount = countWhere(emp => emp.attendance === '已出勤');
  const pendingCount = countWhere(emp => !['已出勤', '未出勤', '迟到', '旷工', '休息'].includes(emp.status));

  const statRow1 = [
    { key: 'all', label: '在勤人数', value: baseFilteredEmployees.length, color: STAT_ROW1_COLORS.text },
    { key: 'pending', label: '待统计人数', value: pendingCount, color: STAT_ROW1_COLORS.pending },
    { key: 'present', label: '已出勤', value: presentCount, color: STAT_ROW1_COLORS.present },
    { key: 'absent', label: '未出勤', value: absentCount, color: STAT_ROW1_COLORS.absent },
    { key: 'late', label: '迟到', value: lateCount, color: STAT_ROW1_COLORS.late },
    { key: 'absentWork', label: '旷工', value: absentWorkCount, color: STAT_ROW1_COLORS.absentWork },
    { key: 'rest', label: '休息', value: restCount, color: STAT_ROW1_COLORS.muted },
    { key: 'unplanned', label: '未排班', value: unplannedCount, color: STAT_ROW1_COLORS.muted },
    { key: 'card', label: '自助工卡', value: cardCount, color: STAT_ROW1_COLORS.card },
    { key: 'worked', label: '已出工', value: workedCount, color: STAT_ROW1_COLORS.present },
    { key: 'rest', label: '休息(弹)', value: restCount, color: STAT_ROW1_COLORS.muted },
  ] as const;

  const leaveCount = countWhere(emp => emp.leave && emp.leave !== '-');
  const tripCount = countWhere(emp => emp.fieldTrip.includes('出差'));
  const outingCount = countWhere(emp => emp.fieldTrip.includes('外出'));
  const earlyLeaveCount = countWhere(emp => emp.anomaly.includes('早退'));
  const missingCardCount = countWhere(emp => emp.anomaly.includes('缺卡'));
  const overtimeCount = countWhere(emp => emp.anomaly.includes('加班'));
  const overtimeAnomalyCount = countWhere(emp => emp.anomaly.includes('加班异常'));

  const statRow2Groups = [
    {
      label: '勤务统计(人数)',
      items: [
        { key: 'leave', label: '请假', value: leaveCount },
        { key: 'trip', label: '出差', value: tripCount },
        { key: 'outing', label: '外出', value: outingCount },
      ],
    },
    {
      label: '异常统计(人数)',
      items: [
        { key: 'late', label: '迟到', value: lateCount },
        { key: 'early', label: '早退', value: earlyLeaveCount },
        { key: 'missing', label: '缺卡', value: missingCardCount, highlight: true },
        { key: 'overtime', label: '加班统计', value: overtimeCount },
      ],
    },
    {
      label: `加班异常(${overtimeAnomalyCount})`,
      items: [
        { key: 'overtime', label: '加班', value: overtimeCount },
      ],
    },
  ];

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (!sortCol) return 0;
    const aValue = `${(a as any)[sortCol] ?? ''}`;
    const bValue = `${(b as any)[sortCol] ?? ''}`;
    const result = aValue.localeCompare(bValue, 'zh-CN', { numeric: true, sensitivity: 'base' });
    return sortDir === 'asc' ? result : -result;
  });

  const totalCount = sortedEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Pagination pages
  const getPages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages] as (number | '...')[];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as (number | '...')[];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages] as (number | '...')[];
  };

  const visibleColDefs = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));

  const pagedEmployees = sortedEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleJump = () => {
    const targetPage = Number.parseInt(jumpPage, 10);
    if (Number.isNaN(targetPage)) {
      setJumpPage('');
      return;
    }
    setCurrentPage(Math.max(1, Math.min(totalPages, targetPage)));
    setJumpPage('');
  };

  const exportValue = (value: string) => {
    const escapedValue = value.replace(/"/g, '""');
    return /[",\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
  };

  const handleExport = () => {
    const headers = visibleColDefs.map(col => col.label);
    const rows = sortedEmployees.map(emp => visibleColDefs.map(col => `${(emp as any)[col.key] ?? '-'}`));
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => exportValue(cell)).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '考勤统计.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const getCellValue = (emp: Employee, key: string): React.ReactNode => {
    if (key === 'status') return statusBadge(emp.status);
    if (key === 'attendance') {
      const colorMap: Record<string, string> = { '休息': colors.textMuted, '未出勤': colors.textMuted, '已出勤': '#059669' };
      return <span style={{ color: colorMap[emp.attendance] || colors.text }}>{emp.attendance}</span>;
    }
    return (emp as any)[key] || '-';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, position: 'relative' }}>

      {/* ── Filter bar ─────────────────────────── */}
      <div style={{
        padding: '10px 16px', backgroundColor: colors.cardBg,
        borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0,
      }}>
        {/* Date row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <DateField value={draftFilters.startDate} onChange={value => updateDraftFilter('startDate', value)} colors={colors} />
          <span style={{ color: colors.textMuted, fontSize: '12px' }}>—</span>
          <DateField value={draftFilters.endDate} onChange={value => updateDraftFilter('endDate', value)} colors={colors} active />

          <DeptDropdown colors={colors} value={draftFilters.dept} onChange={value => updateDraftFilter('dept', value)} options={filterDepts.length ? filterDepts : FILTER_DEPTS} />
          <SimpleDropdown label="考勤组" options={filterAttendGroups.length ? filterAttendGroups : FILTER_ATTEND_GROUPS} value={draftFilters.attendGroup} onChange={value => updateDraftFilter('attendGroup', value)} colors={colors} />
          <SimpleDropdown label="班次" options={filterShifts.length ? filterShifts : FILTER_SHIFTS} value={draftFilters.shift} onChange={value => updateDraftFilter('shift', value)} colors={colors} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            border: `1px solid ${colors.inputBorder}`, borderRadius: '4px',
            padding: '5px 10px', fontSize: '12px', backgroundColor: colors.inputBg,
            minWidth: '180px',
          }}>
            <span style={{ color: colors.text, whiteSpace: 'nowrap', fontSize: '12px' }}>员工</span>
            <input
              value={draftFilters.empSearch}
              onChange={e => updateDraftFilter('empSearch', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
              placeholder="输入姓名或员工工号"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, minWidth: 0 }}
            />
            <Search size={12} style={{ color: colors.textMuted, flexShrink: 0 }} />
          </div>

          <SimpleDropdown label="已入" options={['已入职', '未入职']} value={draftFilters.employmentStatus} onChange={value => updateDraftFilter('employmentStatus', value)} colors={colors} />

          <button
            onClick={handleRefresh}
            style={{
              width: '30px', height: '30px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: `1px solid ${colors.inputBorder}`,
              borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer', color: colors.textMuted,
            }}
            title="刷新"
          >
            <RotateCcw size={13} />
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
            <button onClick={applyFilters} style={primaryBtn(colors)}>查询</button>
          </div>
        </div>
      </div>

      {(sourceFile || loadError || isLoading) && (
        <div style={{
          margin: '8px 16px 0',
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: '#FFFBEB',
          border: '1px solid #FCD34D',
          fontSize: '12px',
          color: '#92400E',
          flexShrink: 0,
        }}>
          {isLoading ? '正在加载真实数据… ' : ''}
          {sourceFile ? `已连接真实数据源：${sourceFile}` : ''}
          {loadError ? ` ${loadError}` : ''}
        </div>
      )}

      {/* ── Stats row 1 ────────────────────────── */}
      <div style={{
        backgroundColor: colors.statCardBg,
        borderBottom: `1px solid ${colors.divider}`,
        padding: '8px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0',
      }}>
        {statRow1.map((item, i) => {
          const color = item.color === 'text' ? colors.text : item.color === 'muted' ? colors.textMuted : item.color;
          return (
            <React.Fragment key={i}>
              <div onClick={() => applyStatFilter(item.key)} style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: '2px 8px', marginRight: '6px', borderRight: i < statRow1.length - 1 ? `1px solid ${colors.divider}` : 'none', cursor: 'pointer', borderRadius: 4, backgroundColor: activeStatFilter === item.key || (!activeStatFilter && item.key === 'all') ? `${colors.primary}12` : 'transparent' }}>
                <span style={{ fontSize: '12px', color: activeStatFilter === item.key || (!activeStatFilter && item.key === 'all') ? colors.primary : colors.textMuted, whiteSpace: 'nowrap' }}>{item.label}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color, lineHeight: 1 }}>{item.value}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Stats row 2 (勤务 / 异常 / 加班) ─── */}
      <div style={{
        backgroundColor: colors.cardBg,
        borderBottom: `1px solid ${colors.cardBorder}`,
        padding: '6px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap',
      }}>
        {statRow2Groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && (
              <div style={{ width: '1px', height: '20px', backgroundColor: colors.divider, margin: '0 16px' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: colors.textMuted, whiteSpace: 'nowrap' }}>{group.label}:</span>
              {group.items.map((item, ii) => {
                const active = activeStatFilter === item.key;
                return (
                  <div key={ii} onClick={() => applyStatFilter(item.key)} style={{ display: 'flex', alignItems: 'baseline', gap: '3px', cursor: 'pointer', padding: '2px 5px', borderRadius: 4, backgroundColor: active ? `${colors.primary}12` : 'transparent' }}>
                    <span style={{ fontSize: '11px', color: active ? colors.primary : colors.textMuted }}>{item.label}(</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: active || (item as any).highlight ? colors.primary : colors.text }}>
                      {item.value}
                    </span>
                    <span style={{ fontSize: '11px', color: active ? colors.primary : colors.textMuted }}>)</span>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 16px', backgroundColor: colors.cardBg,
        borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0,
      }}>
        <button style={primaryBtn(colors)} onClick={handleExport}>导出</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Refresh */}
          <button style={iconBtn(colors)} title="刷新" onClick={handleRefresh}><RefreshCw size={13} /></button>
          {/* Column settings */}
          <button
            style={{ ...iconBtn(colors), borderColor: showColPanel ? colors.primary : colors.inputBorder, color: showColPanel ? colors.primary : colors.textMuted }}
            title="表头设置"
            onClick={openColPanel}
          >
            <Settings2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Table area ─────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={th(colors)}>
                <input type="checkbox" style={{ accentColor: colors.primary }} />
              </th>
              {visibleColDefs.map(col => (
                <th
                  key={col.key}
                  style={{ ...th(colors), cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort(col.key)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    {col.label}
                    {sortCol === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp size={11} style={{ color: colors.primary }} />
                        : <ChevronDown size={11} style={{ color: colors.primary }} />
                      : <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0px', opacity: 0.3 }}>
                          <ChevronUp size={9} />
                          <ChevronDown size={9} style={{ marginTop: '-3px' }} />
                        </span>
                    }
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedEmployees.map((emp, i) => (
              <tr
                key={i}
                style={{
                  backgroundColor: i % 2 === 0 ? colors.cardBg : colors.tableStripe,
                  borderBottom: `1px solid ${colors.tableBorder}`,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? colors.cardBg : colors.tableStripe)}
              >
                <td style={td(colors)}>
                  <input type="checkbox" style={{ accentColor: colors.primary }} />
                </td>
                {visibleColDefs.map(col => (
                  <td key={col.key} style={{
                    ...td(colors),
                    fontWeight: col.key === 'name' ? 500 : 400,
                    color: col.key === 'empId' ? colors.textMuted : colors.text,
                    fontSize: col.key === 'empId' ? '11px' : '12px',
                  }}>
                    {getCellValue(emp, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '7px 16px', backgroundColor: colors.cardBg,
        borderTop: `1px solid ${colors.cardBorder}`, gap: '6px', flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', color: colors.textMuted, marginRight: '4px' }}>共{totalCount}条</span>
        <button style={pageBtn(colors, false)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
          <ChevronLeft size={13} />
        </button>
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted, padding: '0 2px' }}>...</span>
            : <button key={p} style={pageBtn(colors, currentPage === p)} onClick={() => setCurrentPage(p as number)}>{p}</button>
        )}
        <button style={pageBtn(colors, false)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
          <ChevronRight size={13} />
        </button>
        <select
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: '4px', backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}
        >
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input
          value={jumpPage}
          onChange={e => setJumpPage(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
          onBlur={handleJump}
          inputMode="numeric"
          style={{ width: '40px', padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: '4px', backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}
        />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      {/* ── Column settings panel ──────────────── */}
      {showColPanel && (
        <>
          {/* Backdrop */}
          <div onClick={closeColPanel} style={{ position: 'absolute', inset: 0, zIndex: 150 }} />
          {/* Panel */}
          <div
            ref={colPanelRef}
            style={{
              position: 'absolute', top: '46px', right: '16px', zIndex: 200,
              width: '240px', backgroundColor: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`, borderRadius: '6px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.14)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderBottom: `1px solid ${colors.divider}`,
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>表头设置</span>
              <button onClick={closeColPanel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted, display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            </div>

            {/* Sub-header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 12px', borderBottom: `1px solid ${colors.divider}`,
              fontSize: '11px', color: colors.textMuted,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={allPendingSelected} onChange={toggleAllPending}
                  style={{ accentColor: colors.primary }}
                />
                <span>全部选中</span>
              </label>
              <span style={{ marginLeft: 'auto' }}>活动字段 {pendingCols.length} | 列 {ALL_COLUMNS.length}</span>
            </div>

            {/* Column list */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '4px 0' }}>
              {ALL_COLUMNS.map(col => (
                <label
                  key={col.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 12px', cursor: col.required ? 'default' : 'pointer', fontSize: '12px',
                    color: col.required ? colors.textMuted : colors.text,
                  }}
                  onMouseEnter={e => { if (!col.required) (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover; }}
                  onMouseLeave={e => { if (!col.required) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={pendingCols.includes(col.key)}
                    onChange={() => togglePendingCol(col.key)}
                    disabled={col.required}
                    style={{ accentColor: colors.primary, flexShrink: 0 }}
                  />
                  {col.label}
                  {col.required && <span style={{ fontSize: '10px', color: colors.textMuted, marginLeft: 'auto' }}>必选</span>}
                </label>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '8px',
              padding: '10px 12px', borderTop: `1px solid ${colors.divider}`,
            }}>
              <button onClick={closeColPanel} style={outlineBtn(colors)}>取消</button>
              <button onClick={applyColPanel} style={primaryBtn(colors)}>确定</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────
function inputBox(colors: any): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '6px',
    border: `1px solid ${colors.inputBorder}`, borderRadius: '4px',
    padding: '5px 10px', fontSize: '12px', color: colors.text,
    backgroundColor: colors.inputBg, cursor: 'pointer',
  };
}
function primaryBtn(colors: any): React.CSSProperties {
  return {
    padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: '4px',
    cursor: 'pointer', backgroundColor: colors.primary, color: '#fff', whiteSpace: 'nowrap',
  };
}
function outlineBtn(colors: any): React.CSSProperties {
  return {
    padding: '5px 14px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`,
    borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', color: colors.text, whiteSpace: 'nowrap',
  };
}
function iconBtn(colors: any): React.CSSProperties {
  return {
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${colors.inputBorder}`, borderRadius: '4px',
    backgroundColor: 'transparent', color: colors.textMuted, cursor: 'pointer',
  };
}
function th(colors: any): React.CSSProperties {
  return {
    padding: '8px 12px', fontSize: '12px', color: colors.textMuted, fontWeight: 500,
    textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`,
    whiteSpace: 'nowrap', backgroundColor: colors.tableHeaderBg,
  };
}
function td(colors: any): React.CSSProperties {
  return {
    padding: '8px 12px', fontSize: '12px', color: colors.text, whiteSpace: 'nowrap',
  };
}
function pageBtn(colors: any, active: boolean): React.CSSProperties {
  return {
    minWidth: '26px', height: '26px', padding: '0 6px', fontSize: '12px',
    border: `1px solid ${active ? colors.primary : colors.inputBorder}`,
    borderRadius: '4px', backgroundColor: active ? colors.primary : 'transparent',
    color: active ? '#fff' : colors.text, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
