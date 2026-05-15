import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';

type MenuItem = {
  label: string;
  hint?: string;
  danger?: boolean;
};

const ADD_RECORD_ITEMS: MenuItem[] = [
  { label: '添加单条' },
  { label: '批量导入' },
  { label: '添加无规则加班', hint: '适用于临时加班补录' },
];

const START_FLOW_ITEMS: MenuItem[] = [
  { label: '发起单条' },
  { label: '批量导入发起' },
  { label: '批量填写' },
];

const STATUS_OPTIONS = ['审批中', '已通过', '已拒绝', '已撤销'];
const OVERTIME_TYPE_OPTIONS = ['工作日加班', '休息日加班', '节假日加班'];
const COMPENSATE_OPTIONS = ['加班费', '调休假', '加班费+调休'];
const CONVERT_OPTIONS = ['按规则折算', '按实际时长', '按审批时长'];

const TABLE_COLUMNS = [
  '记录状态',
  '申请人',
  '申请人员工号',
  '申请人部门',
  '部门全路径',
  '加班日期',
  '加班开始时间',
  '加班结束时间',
  '申请时长',
  '最终核算时长',
  '加班类型',
  '补偿方式',
  '是否转调休假',
  '折算方式',
  '加班规则',
  '当前流程状态',
  '操作',
];

type OvertimeRow = {
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

const OVERTIME_ROWS: OvertimeRow[] = [
  { id: 1, status: '已通过', name: '曹文瑶', empId: 'CP25004', dept: '产品运营部', deptPath: '产品研发中心/产品运营部', date: '2026-05-06', start: '18:00', end: '21:00', applyHours: '3小时', finalHours: '3小时', type: '工作日加班', compensate: '加班费', toLeave: '否', convert: '按实际时长', rule: '仅计时长', flowStatus: '已通过' },
  { id: 2, status: '审批中', name: '戴琳玲', empId: 'CP25013', dept: '工艺开发部', deptPath: '产品研发中心/工艺开发部', date: '2026-05-06', start: '20:00', end: '22:10', applyHours: '2.1小时', finalHours: '待核算', type: '工作日加班', compensate: '调休假', toLeave: '是', convert: '按审批时长', rule: '调休', flowStatus: '审批中' },
  { id: 3, status: '已通过', name: '李荣成', empId: 'CP25009', dept: '研发设计一部', deptPath: '产品研发中心/研发设计一部', date: '2026-05-08', start: '18:30', end: '20:30', applyHours: '2小时', finalHours: '2小时', type: '工作日加班', compensate: '加班费', toLeave: '否', convert: '按规则折算', rule: '仅计时长', flowStatus: '已通过' },
  { id: 4, status: '已拒绝', name: '邹智旭', empId: 'CP25014', dept: '工艺开发部', deptPath: '产品研发中心/工艺开发部', date: '2026-05-05', start: '19:00', end: '21:30', applyHours: '2.5小时', finalHours: '0', type: '休息日加班', compensate: '加班费+调休', toLeave: '否', convert: '按实际时长', rule: '调休', flowStatus: '已拒绝' },
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
            minWidth: 136,
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
                color: item.danger ? colors.primary : colors.text,
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

function DateRangeField({ colors, value, onChange }: { colors: any; value: { start: string; end: string }; onChange: (value: { start: string; end: string }) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>
        <span style={{ color: colors.primary, marginRight: 2 }}>*</span>
        加班日期
      </span>
      <div style={fieldShell(colors, 274)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input value={value.start} onChange={e => onChange({ ...value, start: e.target.value })} type="date" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input value={value.end} onChange={e => onChange({ ...value, end: e.target.value })} type="date" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  colors,
  width,
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
      <div style={fieldShell(colors, width ?? 144)}>
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...textInput(colors), color: value ? colors.text : colors.textMuted }}>
          <option value="">{placeholder}</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SearchField({
  label,
  placeholder,
  colors,
  width,
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
      <div style={fieldShell(colors, width ?? 174)}>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={textInput(colors)} />
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
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

export default function OvertimeManagement() {
  const { colors } = useTheme();
  const [showMoreFilter, setShowMoreFilter] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFlowMenu, setShowFlowMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<OvertimeRow[]>(OVERTIME_ROWS);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [compensateFilter, setCompensateFilter] = useState('');
  const [convertFilter, setConvertFilter] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ index: number; direction: 'asc' | 'desc' } | null>(null);


  const baseFilteredRows = rows.filter(row => {
    const applicantKeyword = applicantFilter.trim().toLowerCase();
    const initiatorKeyword = initiatorFilter.trim().toLowerCase();
    const ruleKeyword = ruleFilter.trim().toLowerCase();
    const matchForm = (!dateRange.start || row.date >= dateRange.start)
      && (!dateRange.end || row.date <= dateRange.end)
      && (!deptFilter || row.dept === deptFilter)
      && (!applicantKeyword || row.name.toLowerCase().includes(applicantKeyword) || row.empId.toLowerCase().includes(applicantKeyword))
      && (!initiatorKeyword || row.name.toLowerCase().includes(initiatorKeyword) || row.empId.toLowerCase().includes(initiatorKeyword))
      && (!recordStatusFilter || row.status === recordStatusFilter)
      && (!typeFilter || row.type === typeFilter)
      && (!compensateFilter || row.compensate === compensateFilter)
      && (!convertFilter || row.convert === convertFilter)
      && (!ruleKeyword || row.rule.toLowerCase().includes(ruleKeyword));
    return matchForm && (statusFilter === 'all' || row.status === statusFilter || row.type === statusFilter || row.compensate === statusFilter);
  });

  const parseHours = (value: string) => {
    const n = Number(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : -1;
  };

  const getSortValue = (row: OvertimeRow, index: number): string | number => {
    switch (index) {
      case 0: return row.status;
      case 1: return row.name;
      case 2: return row.empId;
      case 3: return row.dept;
      case 4: return row.deptPath;
      case 5: return row.date;
      case 6: return row.start;
      case 7: return row.end;
      case 8: return parseHours(row.applyHours);
      case 9: return parseHours(row.finalHours);
      case 10: return row.type;
      case 11: return row.compensate;
      case 12: return row.toLeave;
      case 13: return row.convert;
      case 14: return row.rule;
      case 15: return row.flowStatus;
      default: return '';
    }
  };

  const filteredRows = !sortConfig
    ? baseFilteredRows
    : [...baseFilteredRows].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.index);
      const bValue = getSortValue(b, sortConfig.index);
      const factor = sortConfig.direction === 'asc' ? 1 : -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * factor;
      }

      return String(aValue).localeCompare(String(bValue), 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
    });

  const statusItems = [
    { key: 'all', label: '全部', count: rows.length },
    { key: '已通过', label: '已通过', count: rows.filter(row => row.status === '已通过').length },
    { key: '审批中', label: '审批中', count: rows.filter(row => row.status === '审批中').length },
    { key: '工作日加班', label: '工作日加班', count: rows.filter(row => row.type === '工作日加班').length },
    { key: '调休假', label: '调休假', count: rows.filter(row => row.compensate === '调休假').length },
  ];
  const allSelected = filteredRows.length > 0 && filteredRows.every(row => selected.has(row.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredRows.map(row => row.id)));
  const toggleRow = (id: number) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setDeptFilter('');
    setApplicantFilter('');
    setInitiatorFilter('');
    setRecordStatusFilter('');
    setTypeFilter('');
    setCompensateFilter('');
    setConvertFilter('');
    setRuleFilter('');
    setStatusFilter('all');
    setSelected(new Set());
  };
  const exportRows = () => {
    const csvRows = filteredRows.map(row => [row.status, row.name, row.empId, row.dept, row.deptPath, row.date, row.start, row.end, row.applyHours, row.finalHours, row.type, row.compensate, row.toLeave, row.convert, row.rule, row.flowStatus]);
    const csv = [TABLE_COLUMNS.slice(0, -1), ...csvRows]
      .map(row => row.map(cell => /[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : String(cell)).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '加班记录.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };
  const deleteRows = () => {
    if (!selected.size) return;
    setRows(current => current.filter(row => !selected.has(row.id)));
    setSelected(new Set());
  };
  const createOvertimeRow = (source: string, flowStatus: string): OvertimeRow => {
    const nextId = Math.max(0, ...rows.map(row => row.id)) + 1;
    return {
      id: nextId,
      status: flowStatus,
      name: '新增加班人员',
      empId: `OT${String(nextId).padStart(4, '0')}`,
      dept: '产品运营部',
      deptPath: '产品研发中心/产品运营部',
      date: new Date().toISOString().slice(0, 10),
      start: '18:00',
      end: '21:00',
      applyHours: '3小时',
      finalHours: flowStatus === '审批中' ? '待核算' : '3小时',
      type: source.includes('无规则') ? '无规则加班' : '工作日加班',
      compensate: '调休假',
      toLeave: '是',
      convert: '按实际时长',
      rule: source,
      flowStatus,
    };
  };
  const addOvertimeAction = (label: string) => {
    const count = label.includes('批量') ? 3 : 1;
    setRows(current => [...Array.from({ length: count }, (_, index) => {
      const nextId = Math.max(0, ...current.map(row => row.id)) + index + 1;
      return { ...createOvertimeRow(label, label.includes('发起') ? '审批中' : '已通过'), id: nextId, empId: `OT${String(nextId).padStart(4, '0')}` };
    }), ...current]);
    setShowAddMenu(false);
    setShowFlowMenu(false);
  };
  const showOvertimeDetail = (row: OvertimeRow) => {
    window.alert(`加班记录详情\n申请人：${row.name} ${row.empId}\n部门：${row.dept}\n日期：${row.date}\n时间：${row.start}-${row.end}\n补偿方式：${row.compensate}\n流程状态：${row.flowStatus}`);
  };

  const handleSortColumn = (index: number) => {
    if (index >= TABLE_COLUMNS.length - 1) return;
    setSortConfig(current => {
      if (!current || current.index !== index) {
        return { index, direction: 'asc' };
      }
      return { index, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
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
          style={{
            padding: '11px 16px 10px',
            fontSize: '13px',
            border: 'none',
            background: 'transparent',
            cursor: 'default',
            color: colors.primary,
            borderBottom: `2px solid ${colors.primary}`,
            fontWeight: 600,
          }}
        >
          加班记录
        </button>
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
          <DateRangeField colors={colors} value={dateRange} onChange={setDateRange} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={144} options={['产品运营部','工艺开发部','研发设计一部']} value={deptFilter} onChange={setDeptFilter} />
          <SearchField label="申请人姓名/员工号" placeholder="请输入人员或员工号" colors={colors} width={182} value={applicantFilter} onChange={setApplicantFilter} />
          <SearchField label="发起人姓名/员工号" placeholder="请输入人员或员工号" colors={colors} width={182} value={initiatorFilter} onChange={setInitiatorFilter} />
          <SelectField label="记录状态" placeholder="请选择" colors={colors} width={138} options={STATUS_OPTIONS} value={recordStatusFilter} onChange={setRecordStatusFilter} />
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
            <SelectField label="记录状态" placeholder="请选择" colors={colors} width={138} options={STATUS_OPTIONS} value={recordStatusFilter} onChange={setRecordStatusFilter} />
            <SelectField label="加班类型" placeholder="请选择" colors={colors} width={144} options={OVERTIME_TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
            <SelectField label="补偿方式" placeholder="请选择" colors={colors} width={144} options={COMPENSATE_OPTIONS} value={compensateFilter} onChange={setCompensateFilter} />
            <SelectField label="折算方式" placeholder="请选择" colors={colors} width={144} options={CONVERT_OPTIONS} value={convertFilter} onChange={setConvertFilter} />
            <SearchField label="加班规则" placeholder="请输入规则名称" colors={colors} width={176} value={ruleFilter} onChange={setRuleFilter} />
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
          label="添加加班记录"
          items={ADD_RECORD_ITEMS}
          open={showAddMenu}
          onToggle={() => {
            setShowAddMenu(v => !v);
            setShowFlowMenu(false);
          }}
          onClose={() => setShowAddMenu(false)}
          onSelect={(item) => addOvertimeAction(item.label)}
          colors={colors}
        />
        <DropdownAction
          label="发起加班流程"
          items={START_FLOW_ITEMS}
          open={showFlowMenu}
          onToggle={() => {
            setShowFlowMenu(v => !v);
            setShowAddMenu(false);
          }}
          onClose={() => setShowFlowMenu(false)}
          onSelect={(item) => addOvertimeAction(`发起-${item.label}`)}
          colors={colors}
        />
        <button onClick={() => setRows(current => current.map(row => selected.has(row.id) ? { ...row, compensate: '调休假', toLeave: '是' } : row))} style={outlineBtn(colors)}>转为调休假</button>
        <button onClick={exportRows} style={outlineBtn(colors)}>导出</button>
        <button onClick={deleteRows} style={selected.size ? outlineBtn(colors) : disabledBtn(colors)} disabled={!selected.size}>删除</button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => addOvertimeAction('集体加班')} style={linkBtn(colors)}>
            <Users size={12} />
            集体加班
          </button>
          <button onClick={() => addOvertimeAction('批量导加班记录')} style={linkBtn(colors)}>
            <Upload size={12} />
            批量导加班记录
          </button>
          <button onClick={() => setShowMoreFilter(current => !current)} style={iconBtn(colors)}>
            <SlidersHorizontal size={13} />
          </button>
          <button onClick={() => setSortConfig(null)} style={iconBtn(colors)} title="恢复默认表头排序">
            <Settings2 size={13} />
          </button>
          <button onClick={resetFilters} style={iconBtn(colors)} title="刷新并恢复初始筛选">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1620 }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ ...th(colors), width: 38, textAlign: 'center' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: colors.primary }} />
              </th>
              {TABLE_COLUMNS.map((column, columnIndex) => {
                const sortable = columnIndex < TABLE_COLUMNS.length - 1;
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
                <td colSpan={TABLE_COLUMNS.length + 1} style={{ padding: '84px 0 110px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                  <EmptyState colors={colors} />
                </td>
              </tr>
            ) : filteredRows.map((row, index) => {
              const checked = selected.has(row.id);
              const cells = [row.status, row.name, row.empId, row.dept, row.deptPath, row.date, row.start, row.end, row.applyHours, row.finalHours, row.type, row.compensate, row.toLeave, row.convert, row.rule, row.flowStatus];
              return (
                <tr key={row.id} style={{ backgroundColor: checked ? `${colors.primary}0D` : index % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}>
                  <td style={{ ...td(colors), textAlign: 'center' }}><input type="checkbox" checked={checked} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary }} /></td>
                  {cells.map((cell, i) => <td key={i} style={td(colors)}>{i === 0 || i === 15 ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: cell === '已通过' ? colors.badgeGreenBg : cell === '审批中' ? colors.badgeBlueBg : colors.badgeRedBg, color: cell === '已通过' ? colors.badgeGreenText : cell === '审批中' ? colors.badgeBlueText : colors.badgeRedText }}>{cell}</span> : cell}</td>)}
                  <td style={td(colors)}><button onClick={() => showOvertimeDetail(row)} style={linkBtn(colors)}>查看</button></td>
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

