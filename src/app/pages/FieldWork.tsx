import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  Search,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';

type ViewType = 'out' | 'trip';

type MenuItem = {
  label: string;
  hint?: string;
};

const OUT_COLUMNS = [
  '记录状态',
  '申请人',
  '申请人员工号',
  '申请人部门',
  '部门全路径',
  '生效状态',
  '发起人',
  '发起人员工号',
  '数据来源',
  '外出开始时间',
  '外出结束时间',
  '外出时长',
  '外勤打卡记录',
  '外出原因',
  '发起时间',
  '当前流程状态',
  '操作',
];

const TRIP_COLUMNS = [
  '记录状态',
  '申请人',
  '申请人员工号',
  '申请人部门',
  '部门全路径',
  '生效状态',
  '数据来源',
  '单程/往返',
  '出差行程',
  '出差日期',
  '外勤打卡记录',
  '出差天数',
  '出差理由',
  '发起时间',
  '完成时间',
  '当前流程状态',
  '操作',
];

type FieldRow = { id: number; status: string; name: string; empId: string; dept: string; deptPath: string; effect: string; source: string; values: string[]; flowStatus: string };

const OUT_ROWS: FieldRow[] = [
  { id: 1, status: '已通过', name: '孟佳玫', empId: 'CP25006', dept: '产品运营部', deptPath: '产品研发中心/产品运营部', effect: '已生效', source: '移动端申请', values: ['孟佳玫', 'CP25006', '移动端申请', '2026-05-06 09:00', '2026-05-06 17:00', '8小时', '有', '客户现场技术支持', '2026-05-05 17:30'], flowStatus: '已通过' },
  { id: 2, status: '审批中', name: '林娜', empId: 'CP25003', dept: '产品研发中心', deptPath: '产品研发中心', effect: '待生效', source: 'PC端申请', values: ['林娜', 'CP25003', 'PC端申请', '2026-05-07 09:00', '2026-05-07 12:00', '3小时', '无', '产品调研', '2026-05-06 16:00'], flowStatus: '审批中' },
];

const TRIP_ROWS: FieldRow[] = [
  { id: 11, status: '已通过', name: '程会娟', empId: 'CP25012', dept: '工艺开发部', deptPath: '产品研发中心/工艺开发部', effect: '已生效', source: '移动端申请', values: ['移动端申请', '往返', '上海-苏州', '2026-05-04 ~ 2026-05-05', '有', '2', '工艺培训', '2026-05-03 09:30', '2026-05-03 11:00'], flowStatus: '已通过' },
  { id: 12, status: '审批中', name: '张林乐', empId: 'CP25008', dept: '研发设计一部', deptPath: '产品研发中心/研发设计一部', effect: '待生效', source: 'PC端申请', values: ['PC端申请', '单程', '上海-深圳', '2026-05-10 ~ 2026-05-11', '无', '2', '供应商拜访', '2026-05-07 10:00', ''], flowStatus: '审批中' },
];

const OUT_ADD_ITEMS: MenuItem[] = [
  { label: '添加单条' },
  { label: '批量导入' },
];

const OUT_FLOW_ITEMS: MenuItem[] = [
  { label: '发起单条' },
  { label: '批量导入发起' },
];

const TRIP_ADD_ITEMS: MenuItem[] = [
  { label: '添加单条' },
  { label: '批量导入' },
  { label: '添加无规则出差', hint: '适用于临时补录' },
];

const TRIP_FLOW_ITEMS: MenuItem[] = [
  { label: '发起单条' },
  { label: '批量导入发起' },
  { label: '批量填写' },
];

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

function EmptyState({ colors }: { colors: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 14,
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
            borderRadius: 8,
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
    </div>
  );
}

function RouteTab({ label, active, onClick, colors }: { label: string; active: boolean; onClick: () => void; colors: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '11px 16px 10px',
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
  width = 274,
  value,
  onChange,
}: {
  label: string;
  colors: any;
  width?: number;
  value: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>
        <span style={{ color: colors.primary, marginRight: 2 }}>*</span>
        {label}
      </span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input value={value.start} onChange={e => onChange({ ...value, start: e.target.value })} type="date" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input value={value.end} onChange={e => onChange({ ...value, end: e.target.value })} type="date" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SearchField({
  label,
  placeholder,
  colors,
  width = 176,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={textInput(colors)} />
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  colors,
  width = 144,
  options = [],
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
  options?: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...textInput(colors), color: value ? colors.text : colors.textMuted }}>
          <option value="">{placeholder}</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function DropdownAction({
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
  const ref = useRef<HTMLDivElement | null>(null);
  useClickOutside(ref, onClose);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          ...outlineBtn(colors),
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderColor: open ? colors.primary : colors.inputBorder,
          color: open ? colors.primary : colors.text,
          backgroundColor: open ? colors.badgeBlueBg : 'transparent',
        }}
      >
        {label}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 138,
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            boxShadow: '0 10px 28px rgba(25, 35, 64, 0.14)',
            padding: '6px 0',
            zIndex: 60,
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: '10px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                color: colors.text,
                fontSize: '12px',
                borderTop: index === 0 ? 'none' : `1px solid ${colors.divider}33`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = colors.tableRowHover;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.label}
                {item.hint ? <HelpCircle size={12} style={{ color: colors.textMuted }} /> : null}
              </span>
              {item.hint ? <span style={{ fontSize: '11px', color: colors.textMuted }}>{item.hint}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FieldWork() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMoreFilter, setShowMoreFilter] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFlowMenu, setShowFlowMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [outRows, setOutRows] = useState<FieldRow[]>(OUT_ROWS);
  const [tripRows, setTripRows] = useState<FieldRow[]>(TRIP_ROWS);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [startTimeRange, setStartTimeRange] = useState({ start: '', end: '' });
  const [finishTimeRange, setFinishTimeRange] = useState({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState('');
  const [flowStatusFilter, setFlowStatusFilter] = useState('');
  const [effectFilter, setEffectFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tripTypeFilter, setTripTypeFilter] = useState('');
  const [tripRouteFilter, setTripRouteFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ index: number; direction: 'asc' | 'desc' } | null>(null);

  const activeView: ViewType = location.pathname.includes('field-trip') ? 'trip' : 'out';

  const baseRows = activeView === 'trip' ? tripRows : outRows;
  const baseFilteredRows = baseRows.filter(row => {
    const keyword = applicantFilter.trim().toLowerCase();
    const routeKeyword = tripRouteFilter.trim().toLowerCase();
    const dateText = row.values.join(' ');
    const rowDate = dateText.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
    const matchForm = (!deptFilter || row.dept === deptFilter)
      && (!keyword || row.name.toLowerCase().includes(keyword) || row.empId.toLowerCase().includes(keyword))
      && (!recordStatusFilter || row.status === recordStatusFilter)
      && (!flowStatusFilter || row.flowStatus === flowStatusFilter)
      && (!effectFilter || row.effect === effectFilter)
      && (!sourceFilter || row.source === sourceFilter)
      && (!tripTypeFilter || row.values.includes(tripTypeFilter))
      && (!routeKeyword || dateText.toLowerCase().includes(routeKeyword))
      && (!dateRange.start || rowDate >= dateRange.start)
      && (!dateRange.end || rowDate <= dateRange.end)
      && (!startTimeRange.start || rowDate >= startTimeRange.start)
      && (!startTimeRange.end || rowDate <= startTimeRange.end)
      && (!finishTimeRange.start || rowDate >= finishTimeRange.start)
      && (!finishTimeRange.end || rowDate <= finishTimeRange.end);
    return matchForm && (statusFilter === 'all' || row.status === statusFilter || row.source === statusFilter || row.effect === statusFilter);
  });

  const getRowCells = (row: FieldRow) => [row.status, row.name, row.empId, row.dept, row.deptPath, row.effect, ...row.values, row.flowStatus];

  const tryParseSimpleNumber = (value: string) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (!/^-?\d+(\.\d+)?(小时|天)?$/.test(text)) return null;
    const n = Number(text.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };


  const filteredRows = !sortConfig
    ? baseFilteredRows
    : [...baseFilteredRows].sort((a, b) => {
      const aValue = getRowCells(a)[sortConfig.index] ?? '';
      const bValue = getRowCells(b)[sortConfig.index] ?? '';
      const factor = sortConfig.direction === 'asc' ? 1 : -1;
      const numA = tryParseSimpleNumber(String(aValue));
      const numB = tryParseSimpleNumber(String(bValue));

      if (numA !== null && numB !== null) {
        return (numA - numB) * factor;
      }

      return String(aValue).localeCompare(String(bValue), 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
    });

  const statusItems = [
    { key: 'all', label: '全部', count: baseRows.length },
    { key: '已通过', label: '已通过', count: baseRows.filter(row => row.status === '已通过').length },
    { key: '审批中', label: '审批中', count: baseRows.filter(row => row.status === '审批中').length },
    { key: '已生效', label: '已生效', count: baseRows.filter(row => row.effect === '已生效').length },
    { key: '移动端申请', label: '移动端', count: baseRows.filter(row => row.source === '移动端申请').length },
  ];
  const allSelected = filteredRows.length > 0 && filteredRows.every(row => selected.has(row.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredRows.map(row => row.id)));
  const toggleRow = (id: number) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setStartTimeRange({ start: '', end: '' });
    setFinishTimeRange({ start: '', end: '' });
    setDeptFilter('');
    setApplicantFilter('');
    setRecordStatusFilter('');
    setFlowStatusFilter('');
    setEffectFilter('');
    setSourceFilter('');
    setTripTypeFilter('');
    setTripRouteFilter('');
    setStatusFilter('all');
    setSortConfig(null);
    setSelected(new Set());
  };

  const exportRows = (columns: string[]) => {
    const csv = [columns, ...filteredRows.map(row => [row.status, row.name, row.empId, row.dept, row.deptPath, row.effect, ...row.values, row.flowStatus, '查看'].slice(0, columns.length))]
      .map(row => row.map(cell => /[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : String(cell)).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeView === 'trip' ? '出差记录' : '外出记录'}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
  const deleteRows = () => {
    if (!selected.size) return;
    if (activeView === 'trip') setTripRows(current => current.filter(row => !selected.has(row.id)));
    else setOutRows(current => current.filter(row => !selected.has(row.id)));
    setSelected(new Set());
  };
  const addFieldAction = (label: string) => {
    const baseId = Math.max(0, ...outRows.map(row => row.id), ...tripRows.map(row => row.id)) + 1;
    const count = label.includes('批量') ? 3 : 1;
    const nextRows = Array.from({ length: count }, (_, index): FieldRow => {
      const id = baseId + index;
      if (activeView === 'trip') {
        return {
          id,
          status: label.includes('发起') ? '审批中' : '已通过',
          name: '新增出差人员',
          empId: `TR${String(id).padStart(4, '0')}`,
          dept: '产品运营部',
          deptPath: '产品研发中心/产品运营部',
          effect: label.includes('发起') ? '待生效' : '已生效',
          source: label.includes('导入') ? '导入' : 'PC端申请',
          values: ['PC端申请', '往返', '上海-杭州', `${new Date().toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`, '无', '1', label, new Date().toISOString().slice(0, 16).replace('T', ' '), ''],
          flowStatus: label.includes('发起') ? '审批中' : '已通过',
        };
      }
      return {
        id,
        status: label.includes('发起') ? '审批中' : '已通过',
        name: '新增外出人员',
        empId: `FW${String(id).padStart(4, '0')}`,
        dept: '产品运营部',
        deptPath: '产品研发中心/产品运营部',
        effect: label.includes('发起') ? '待生效' : '已生效',
        source: label.includes('导入') ? '导入' : 'PC端申请',
        values: ['新增外出人员', `FW${String(id).padStart(4, '0')}`, 'PC端申请', `${new Date().toISOString().slice(0, 10)} 09:00`, `${new Date().toISOString().slice(0, 10)} 18:00`, '8小时', '无', label, new Date().toISOString().slice(0, 16).replace('T', ' ')],
        flowStatus: label.includes('发起') ? '审批中' : '已通过',
      };
    });
    if (activeView === 'trip') setTripRows(current => [...nextRows, ...current]);
    else setOutRows(current => [...nextRows, ...current]);
    closeMenus();
  };
  const showFieldDetail = (row: FieldRow) => {
    window.alert(`${pageConfig.title}详情\n申请人：${row.name} ${row.empId}\n部门：${row.dept}\n生效状态：${row.effect}\n数据来源：${row.source}\n流程状态：${row.flowStatus}`);
  };

  const handleSortColumn = (index: number) => {
    if (index >= pageConfig.columns.length - 1) return;
    setSortConfig(current => {
      if (!current || current.index !== index) {
        return { index, direction: 'asc' };
      }
      return { index, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };


  const pageConfig = useMemo(() => {
    if (activeView === 'trip') {
      return {
        title: '出差记录',
        path: '/attendance/field-trip',
        dateLabel: '出差日期',
        columns: TRIP_COLUMNS,
        addLabel: '添加出差记录',
        flowLabel: '发起出差流程',
        addItems: TRIP_ADD_ITEMS,
        flowItems: TRIP_FLOW_ITEMS,
      };
    }

    return {
      title: '外出记录',
      path: '/attendance/field-out',
      dateLabel: '外出日期',
      columns: OUT_COLUMNS,
      addLabel: '添加外出记录',
      flowLabel: '发起外出流程',
      addItems: OUT_ADD_ITEMS,
      flowItems: OUT_FLOW_ITEMS,
    };
  }, [activeView]);

  const closeMenus = () => {
    setShowAddMenu(false);
    setShowFlowMenu(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div
        style={{
          backgroundColor: colors.cardBg,
          borderBottom: `1px solid ${colors.cardBorder}`,
          padding: '0 16px',
          minHeight: 42,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/attendance/home')}
          style={{
            padding: '11px 16px 10px',
            fontSize: '13px',
            border: 'none',
            background: 'transparent',
            color: colors.textMuted,
            cursor: 'pointer',
          }}
        >
          首页
        </button>
        <RouteTab label="外出记录" active={activeView === 'out'} onClick={() => navigate('/attendance/field-out')} colors={colors} />
        <RouteTab label="出差记录" active={activeView === 'trip'} onClick={() => navigate('/attendance/field-trip')} colors={colors} />
        <button
          style={{
            marginBottom: 8,
            width: 22,
            height: 22,
            borderRadius: 4,
            border: `1px solid ${colors.cardBorder}`,
            background: 'transparent',
            color: colors.textMuted,
            fontSize: '12px',
            cursor: 'default',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '12px 16px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <DateRangeField label={pageConfig.dateLabel} colors={colors} value={dateRange} onChange={setDateRange} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={146} options={['产品运营部','产品研发中心','研发设计一部','工艺开发部']} value={deptFilter} onChange={setDeptFilter} />
          <SearchField label="申请人" placeholder="请输入人员姓名" colors={colors} width={182} value={applicantFilter} onChange={setApplicantFilter} />
          {activeView === 'out' ? (
            <>
              <DateRangeField label="发起时间" colors={colors} width={286} value={startTimeRange} onChange={setStartTimeRange} />
              <DateRangeField label="完成时间" colors={colors} width={286} value={finishTimeRange} onChange={setFinishTimeRange} />
            </>
          ) : (
            <>
              <SelectField label="记录状态" placeholder="请选择" colors={colors} width={146} options={['已通过','审批中','已拒绝']} value={recordStatusFilter} onChange={setRecordStatusFilter} />
              <SelectField label="当前流程状态" placeholder="请选择" colors={colors} width={168} options={['已通过','审批中','已拒绝']} value={flowStatusFilter} onChange={setFlowStatusFilter} />
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
            <button onClick={() => setSelected(new Set())} style={primaryBtn(colors)}>查询</button>
            <button
              onClick={() => setShowMoreFilter(v => !v)}
              style={{
                ...outlineBtn(colors),
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderColor: showMoreFilter ? colors.primary : colors.inputBorder,
                color: showMoreFilter ? colors.primary : colors.text,
              }}
            >
              更多筛选
              {showMoreFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {showMoreFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            {activeView === 'out' ? (
              <>
                <DateRangeField label="完成时间" colors={colors} width={286} value={finishTimeRange} onChange={setFinishTimeRange} />
                <SelectField label="记录状态" placeholder="请选择" colors={colors} width={146} options={['已通过','审批中','已拒绝']} value={recordStatusFilter} onChange={setRecordStatusFilter} />
                <SelectField label="生效状态" placeholder="请选择" colors={colors} width={146} options={['已生效','待生效']} value={effectFilter} onChange={setEffectFilter} />
                <SelectField label="数据来源" placeholder="请选择" colors={colors} width={146} options={['移动端申请','PC端申请','HR手动添加']} value={sourceFilter} onChange={setSourceFilter} />
              </>
            ) : (

              <>
                <SelectField label="数据来源" placeholder="请选择" colors={colors} width={146} options={['移动端申请','PC端申请','HR手动添加']} value={sourceFilter} onChange={setSourceFilter} />
                <SelectField label="单程/往返" placeholder="请选择" colors={colors} width={146} options={['单程','往返']} value={tripTypeFilter} onChange={setTripTypeFilter} />
                <SearchField label="出差行程" placeholder="请输入城市或地点" colors={colors} width={188} value={tripRouteFilter} onChange={setTripRouteFilter} />
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {statusItems.map(item => {
          const active = statusFilter === item.key;
          return <button key={item.key} onClick={() => { setStatusFilter(item.key); setSelected(new Set()); }} style={{ padding: '4px 10px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 12, cursor: 'pointer', backgroundColor: active ? `${colors.primary}12` : 'transparent', color: active ? colors.primary : colors.textMuted }}>{item.label} <strong>{item.count}</strong></button>;
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          backgroundColor: colors.cardBg,
          borderBottom: `1px solid ${colors.cardBorder}`,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <DropdownAction
          label={pageConfig.addLabel}
          items={pageConfig.addItems}
          open={showAddMenu}
          onToggle={() => {
            setShowAddMenu(v => !v);
            setShowFlowMenu(false);
          }}
          onClose={closeMenus}
          onSelect={(item) => addFieldAction(item.label)}
          colors={colors}
        />
        <DropdownAction
          label={pageConfig.flowLabel}
          items={pageConfig.flowItems}
          open={showFlowMenu}
          onToggle={() => {
            setShowFlowMenu(v => !v);
            setShowAddMenu(false);
          }}
          onClose={closeMenus}
          onSelect={(item) => addFieldAction(`发起-${item.label}`)}
          colors={colors}
        />
        <button onClick={() => exportRows(pageConfig.columns)} style={outlineBtn(colors)}>导出</button>
        <button onClick={deleteRows} style={selected.size ? outlineBtn(colors) : disabledBtn(colors)} disabled={!selected.size}>删除</button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowMoreFilter(current => !current)} style={iconBtn(colors)}>
            <SlidersHorizontal size={13} />
          </button>
          <button onClick={() => setSortConfig(null)} style={iconBtn(colors)} title="恢复默认表头排序">
            <Settings2 size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: activeView === 'out' ? 1640 : 1600 }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ ...th(colors), width: 38, textAlign: 'center' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: colors.primary }} />
              </th>
              {pageConfig.columns.map((column, columnIndex) => {
                const sortable = columnIndex < pageConfig.columns.length - 1;
                const active = sortConfig?.index === columnIndex;
                return (
                  <th key={column} style={th(colors)}>
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortColumn(columnIndex)}
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
                        {column}
                        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 0.7 }}>
                          <ChevronUp size={10} style={{ color: active && sortConfig?.direction === 'asc' ? colors.primary : colors.textMuted }} />
                          <ChevronDown size={10} style={{ color: active && sortConfig?.direction === 'desc' ? colors.primary : colors.textMuted }} />
                        </span>
                      </button>
                    ) : (
                      column
                    )}
                  </th>
                );
              })}

            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={pageConfig.columns.length + 1} style={{ padding: '84px 0 110px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                  <EmptyState colors={colors} />
                </td>
              </tr>
            ) : filteredRows.map((row, index) => {
              const checked = selected.has(row.id);
              const common = [row.status, row.name, row.empId, row.dept, row.deptPath, row.effect, ...row.values, row.flowStatus];
              return (
                <tr key={row.id} style={{ backgroundColor: checked ? `${colors.primary}0D` : index % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}>
                  <td style={{ ...td(colors), textAlign: 'center' }}><input type="checkbox" checked={checked} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary }} /></td>
                  {common.slice(0, pageConfig.columns.length - 1).map((cell, i) => <td key={i} style={td(colors)}>{i === 0 || i === pageConfig.columns.length - 2 ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: cell === '已通过' || cell === '已生效' ? colors.badgeGreenBg : cell === '审批中' || cell === '待生效' ? colors.badgeBlueBg : colors.badgeGrayBg, color: cell === '已通过' || cell === '已生效' ? colors.badgeGreenText : cell === '审批中' || cell === '待生效' ? colors.badgeBlueText : colors.badgeGrayText }}>{cell}</span> : cell}</td>)}
                  <td style={td(colors)}><button onClick={() => showFieldDetail(row)} style={linkBtn(colors)}>查看</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fieldShell(colors: any, width: number): React.CSSProperties {
  return {
    minWidth: width,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    borderRadius: 4,
    border: `1px solid ${colors.inputBorder}`,
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
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '12px',
    color: colors.text,
    width: 108,
  };
}

function primaryBtn(c: any): React.CSSProperties {
  return {
    padding: '5px 14px',
    fontSize: '12px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    backgroundColor: c.primary,
    color: '#fff',
    whiteSpace: 'nowrap',
  };
}

function outlineBtn(c: any): React.CSSProperties {
  return {
    padding: '5px 14px',
    fontSize: '12px',
    border: `1px solid ${c.inputBorder}`,
    borderRadius: 4,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: c.text,
    whiteSpace: 'nowrap',
  };
}

function disabledBtn(c: any): React.CSSProperties {
  return {
    ...outlineBtn(c),
    color: c.textMuted,
    opacity: 0.72,
    cursor: 'not-allowed',
    backgroundColor: c.statCardBg,
  };
}

function linkBtn(c: any): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    border: 'none',
    background: 'transparent',
    color: '#3A78FF',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    whiteSpace: 'nowrap',
  };
}

function iconBtn(c: any): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${c.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: c.textMuted,
    cursor: 'pointer',
  };
}

function th(c: any): React.CSSProperties {

  return {
    padding: '9px 12px',
    fontSize: '12px',
    color: c.textMuted,
    fontWeight: 500,
    textAlign: 'left',
    borderBottom: `1px solid ${c.tableBorder}`,
    whiteSpace: 'nowrap',
    backgroundColor: c.tableHeaderBg,
  };
}

function td(c: any): React.CSSProperties {
  return {
    padding: '8px 12px',
    fontSize: '12px',
    color: c.text,
    borderBottom: `1px solid ${c.tableBorder}`,
    whiteSpace: 'nowrap',
  };
}

