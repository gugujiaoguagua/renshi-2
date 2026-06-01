import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchWorkDataRecords, type WorkDataRecord } from '../api/realData';
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, Search,
  Settings2, Download, GripVertical, Plus, Minus, RotateCcw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────
type TabType = 'records' | 'uncalculated';
type ApprovalStatus = '已通过' | '审批中' | '已拒绝' | '已撤销' | '已退回';
type CancelStatus = '未申请取消' | '取消审批中' | '已取消';

type DutyRecord = WorkDataRecord;

type UncalcRecord = {
  id: number; applicant: string; empId: string; dept: string;
  applyType: string; bizStartTime: string; bizEndTime: string;
  initiateTime: string; assignPeriod: string; uncalcDates: string; uncalcCount: number;
};

type ColDef = { key: string; label: string; width: number; visible: boolean };

// ─── Column Definitions ───────────────────────
const DUTY_COLS_DEFAULT: ColDef[] = [
  { key: 'applicant',      label: '申请人',       width: 70,  visible: true },
  { key: 'applicantId',    label: '申请人员工号', width: 105, visible: true },
  { key: 'applicantDept',  label: '申请人部门',   width: 115, visible: true },
  { key: 'applyType',      label: '申请类型',     width: 80,  visible: true },
  { key: 'initiator',      label: '发起人',       width: 70,  visible: true },
  { key: 'initiatorId',    label: '发起人员工号', width: 105, visible: true },
  { key: 'initiateTime',   label: '发起时间',     width: 148, visible: true },
  { key: 'completeTime',   label: '完成时间',     width: 148, visible: true },
  { key: 'bizDate',        label: '业务日期',     width: 175, visible: true },
  { key: 'summary',        label: '单据摘要',     width: 200, visible: true },
  { key: 'approvalStatus', label: '审批流程状态', width: 105, visible: true },
  { key: 'cancelStatus',   label: '取消流程状态', width: 105, visible: true },
];

const UNCALC_COLS_DEFAULT: ColDef[] = [
  { key: 'applicant',    label: '申请人',         width: 70,  visible: true },
  { key: 'empId',        label: '员工号',         width: 88,  visible: true },
  { key: 'dept',         label: '部门',           width: 115, visible: true },
  { key: 'applyType',    label: '申请类型',       width: 80,  visible: true },
  { key: 'bizStartTime', label: '业务开始时间',   width: 148, visible: true },
  { key: 'bizEndTime',   label: '业务结束时间',   width: 148, visible: true },
  { key: 'initiateTime', label: '发起时间',       width: 148, visible: true },
  { key: 'assignPeriod', label: '归属专项周期',   width: 110, visible: true },
  { key: 'uncalcDates',  label: '未核算专项日期', width: 160, visible: true },
];

// ─── Constants ───────────────────────────────
const DEPT_OPTIONS = ['产品研发中心','产品运营部','研发设计一部','研发设计二部','直营建连店','工艺开发部','技术支持部'];
const ALL_STATUSES: ApprovalStatus[] = ['已通过','审批中','已拒绝','已撤销','已退回'];

// ─── Mock Data ────────────────────────────────
const DUTY_RECORDS: DutyRecord[] = [];

const UNCALC_RECORDS: UncalcRecord[] = [];

// ─── Helpers ─────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

const p5s14 = (colors: any): React.CSSProperties => ({ padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: colors.primary, color: '#fff', whiteSpace: 'nowrap' });
const p5s12 = (colors: any): React.CSSProperties => ({ padding: '5px 12px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent', color: colors.text, whiteSpace: 'nowrap' });
const thS = (colors: any): React.CSSProperties => ({ padding: '8px 10px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, backgroundColor: colors.tableHeaderBg, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 20 });
const tdS = (colors: any): React.CSSProperties => ({ padding: '7px 10px', fontSize: '12px', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const pgS = (colors: any, active: boolean): React.CSSProperties => ({ minWidth: 24, height: 24, padding: '0 5px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 4, backgroundColor: active ? colors.primary : 'transparent', color: active ? '#fff' : colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const inputS = (colors: any): React.CSSProperties => ({ padding: '5px 10px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' });

// ─── Status Multi-Select ──────────────────────
function StatusMultiSelect({ colors }: { colors: any }) {
  const [selected, setSelected] = useState<ApprovalStatus[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const allSelected = selected.length === ALL_STATUSES.length;
  const toggleAll = () => setSelected(allSelected ? [] : [...ALL_STATUSES]);
  const toggle = (s: ApprovalStatus) => setSelected(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const displayText = selected.length === 0 ? '请选择' : selected.length === ALL_STATUSES.length ? '全部' : selected.slice(0, 2).join('/') + (selected.length > 2 ? `+${selected.length - 2}` : '');
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${open ? colors.primary : colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, cursor: 'pointer', minWidth: 148 }}>
        <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>审批流程状态:</span>
        <span style={{ flex: 1, fontSize: '12px', color: selected.length ? colors.text : colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
        {selected.length > 0
          ? <X size={10} style={{ color: colors.textMuted, flexShrink: 0 }} onClick={e => { e.stopPropagation(); setSelected([]); }}/>
          : <ChevronDown size={10} style={{ color: colors.textMuted, flexShrink: 0 }}/>}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 150, overflow: 'hidden' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: colors.text, borderBottom: `1px solid ${colors.divider}` }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>全选
          </label>
          {ALL_STATUSES.map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: colors.text }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
              <input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>{s}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dept Dropdown ────────────────────────────
function DeptSelect({ colors }: { colors: any }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${open ? colors.primary : colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, cursor: 'pointer', minWidth: 110 }}>
        <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>部门:</span>
        <span style={{ flex: 1, fontSize: '12px', color: val ? colors.text : colors.textMuted }}>{val || '请选择'}</span>
        {val ? <X size={10} style={{ color: colors.textMuted }} onClick={e => { e.stopPropagation(); setVal(''); }}/> : <ChevronDown size={10} style={{ color: colors.textMuted }}/>}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: 140, overflow: 'hidden' }}>
          {DEPT_OPTIONS.map(opt => (
            <div key={opt} onClick={() => { setVal(opt); setOpen(false); }}
              style={{ padding: '7px 12px', fontSize: '12px', cursor: 'pointer', color: val === opt ? colors.primary : colors.text }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column Settings Modal ────────────────────
function ColSettingsModal({ cols, defaultCols, onClose, onApply, colors }: {
  cols: ColDef[]; defaultCols: ColDef[];
  onClose: () => void; onApply: (cols: ColDef[], freeze: number) => void; colors: any;
}) {
  const [localCols, setLocalCols] = useState<ColDef[]>(cols.map(c => ({ ...c })));
  const [freeze, setFreeze] = useState(1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragEnd = () => {
    if (dragIdx !== null && dragOver !== null && dragIdx !== dragOver) {
      const next = [...localCols];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dragOver, 0, moved);
      setLocalCols(next);
    }
    setDragIdx(null); setDragOver(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 12, width: 380, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>表头设置</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setLocalCols(defaultCols.map(c => ({ ...c })))} style={{ fontSize: '12px', color: colors.primary, border: 'none', background: 'transparent', cursor: 'pointer' }}>恢复默认</button>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={15}/></button>
          </div>
        </div>
        {/* Freeze N */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${colors.divider}`, gap: 10 }}>
          <span style={{ fontSize: '12px', color: colors.text, flex: 1 }}>冻结前</span>
          <button onClick={() => setFreeze(v => Math.max(0, v - 1))} style={{ width: 26, height: 26, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Minus size={11}/></button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.primary, minWidth: 22, textAlign: 'center' }}>{freeze}</span>
          <button onClick={() => setFreeze(v => Math.min(5, v + 1))} style={{ width: 26, height: 26, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Plus size={11}/></button>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>列</span>
        </div>
        {/* Field list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '6px 18px 6px', fontSize: '11px', color: colors.textMuted }}>显示字段 · 拖拽调整顺序</div>
          {localCols.map((col, idx) => {
            const isDragging = dragIdx === idx; const isOver = dragOver === idx;
            return (
              <div key={col.key} draggable
                onDragStart={() => setDragIdx(idx)}
                onDragEnter={() => setDragOver(idx)}
                onDragOver={e => e.preventDefault()}
                onDragEnd={onDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px', cursor: 'grab', opacity: isDragging ? 0.4 : 1, borderTop: isOver && !isDragging ? `2px solid ${colors.primary}` : '2px solid transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => !isDragging && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => !isDragging && (e.currentTarget.style.backgroundColor = 'transparent')}>
                <GripVertical size={13} style={{ color: colors.textMuted, flexShrink: 0 }}/>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={col.visible} onChange={() => setLocalCols(prev => prev.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>
                  <span style={{ fontSize: '12px', color: colors.text }}>{col.label}</span>
                </label>
                {idx < freeze && <span style={{ fontSize: '10px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>冻结</span>}
              </div>
            );
          })}
        </div>
        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={p5s12(colors)}>取消</button>
          <button onClick={() => { onApply(localCols, freeze); onClose(); }} style={p5s14(colors)}>确定</button>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Status Badge ────────────────────
function StatusBadge({ status, colors }: { status: ApprovalStatus; colors: any }) {
  const cfg: Record<ApprovalStatus, [string, string]> = {
    '已通过': [colors.badgeGreenBg,  colors.badgeGreenText],
    '审批中': [colors.badgeBlueBg,   colors.badgeBlueText],
    '已拒绝': [colors.badgeRedBg,    colors.badgeRedText],
    '已撤销': [colors.badgeGrayBg,   colors.badgeGrayText],
    '已退回': ['#FEF3C7',            '#92400E'],
  };
  const [bg, txt] = cfg[status] ?? [colors.badgeGrayBg, colors.badgeGrayText];
  return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: bg, color: txt, whiteSpace: 'nowrap' }}>{status}</span>;
}

// ─── Main Component ───────────────────────────
export default function WorkData() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<TabType>('records');
  const [showMore, setShowMore] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [showColSettings, setShowColSettings] = useState(false);
  const [dutyCols, setDutyCols] = useState<ColDef[]>(DUTY_COLS_DEFAULT);
  const [uncalcCols, setUncalcCols] = useState<ColDef[]>(UNCALC_COLS_DEFAULT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dutyRows, setDutyRows] = useState<DutyRecord[]>([]);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadWorkData = useCallback(async () => {
    try {
      const res = await fetchWorkDataRecords();
      setDutyRows(res.rows || []);
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadWorkData();
  }, [loadWorkData]);

  const QUICK_FILTERS = [{ v: 'all', label: '全部' }, { v: 'today', label: '今日' }, { v: 'week', label: '本周' }, { v: 'month', label: '本月' }] as const;

  const rawRows = tab === 'records' ? dutyRows : [];
  const isInQuickRange = (dateText: string) => {
    if (quickFilter === 'all') return true;
    const date = new Date(String(dateText || '').slice(0, 10));
    if (Number.isNaN(date.getTime())) return true;
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
    if (quickFilter === 'today') return diffDays === 0;
    if (quickFilter === 'week') return diffDays >= 0 && diffDays <= 6;
    if (quickFilter === 'month') return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    return true;
  };
  const displayRows = rawRows.filter((row: any) => {
    const keyword = empSearch.trim().toLowerCase();
    const matchKeyword = !keyword || `${row.applicant || ''}${row.applicantId || row.empId || ''}`.toLowerCase().includes(keyword);
    const matchStatus = statusFilter === 'all' || row.approvalStatus === statusFilter || row.applyType === statusFilter;
    const matchQuick = isInQuickRange(row.initiateTime || row.bizDate || row.bizStartTime);
    return matchKeyword && matchStatus && matchQuick;
  });
  const statusItems = tab === 'records'
    ? [
        { key: 'all', label: '全部', count: rawRows.length },
        { key: '已通过', label: '已通过', count: (rawRows as DutyRecord[]).filter(row => row.approvalStatus === '已通过').length },
        { key: '审批中', label: '审批中', count: (rawRows as DutyRecord[]).filter(row => row.approvalStatus === '审批中').length },
        { key: '月度统计', label: '月度统计', count: (rawRows as DutyRecord[]).filter(row => row.applyType === '月度统计').length },
      ]
    : [
        { key: 'all', label: '全部', count: rawRows.length },
        { key: '加班', label: '加班', count: (rawRows as UncalcRecord[]).filter(row => row.applyType === '加班').length },
        { key: '出差', label: '出差', count: (rawRows as UncalcRecord[]).filter(row => row.applyType === '出差').length },
      ];
  const normalizeSortValue = (value: unknown): number | string => {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === null || value === undefined) return '';

    const text = String(value).trim();
    if (!text) return '';

    const timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) return timestamp;

    return text;
  };

  const sortedRows = sortKey
    ? [...displayRows].sort((a, b) => {
        const left = normalizeSortValue((a as Record<string, unknown>)[sortKey]);
        const right = normalizeSortValue((b as Record<string, unknown>)[sortKey]);

        if (typeof left === 'number' && typeof right === 'number') {
          return sortDir === 'asc' ? left - right : right - left;
        }

        const result = String(left).localeCompare(String(right), 'zh-CN', { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? result : -result;
      })
    : displayRows;

  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const currentCols = tab === 'records' ? dutyCols.filter(c => c.visible) : uncalcCols.filter(c => c.visible);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };


  const getPages = (): (number | '...')[] => totalPages <= 7
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : page <= 4 ? [1, 2, 3, 4, 5, '...', totalPages]
    : page >= totalPages - 3 ? [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    : [1, '...', page - 1, page, page + 1, '...', totalPages];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>

      {/* ── Tab bar ───────────────────────── */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          {[
            { v: 'records',      label: '勤务记录', count: dutyRows.length },
            { v: 'uncalculated', label: '未核算',   count: UNCALC_RECORDS.length  },
          ].map(t => {
            const active = tab === t.v;
            return (
              <button key={t.v} onClick={() => { setTab(t.v as TabType); setPage(1); }}
                style={{ padding: '12px 16px', fontSize: '13px', fontWeight: active ? 600 : 400, border: 'none', background: 'transparent', cursor: 'pointer', color: active ? colors.primary : colors.textMuted, borderBottom: `2px solid ${active ? colors.primary : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.label}
                <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 10, backgroundColor: active ? colors.primary : colors.badgeGrayBg, color: active ? '#fff' : colors.badgeGrayText }}>{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar ────────────────────── */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {/* 发起日期 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>发起日期:</span>
            <input type="date" style={{ ...inputS(colors), border: 'none', padding: 0, width: 108 }}/>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
            <input type="date" style={{ ...inputS(colors), border: 'none', padding: 0, width: 108 }}/>
          </div>
          {/* 业务日期 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>业务日期:</span>
            <input type="date" style={{ ...inputS(colors), border: 'none', padding: 0, width: 108 }}/>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
            <input type="date" style={{ ...inputS(colors), border: 'none', padding: 0, width: 108 }}/>
          </div>
          {/* 审批流程状态 multi-select */}
          <StatusMultiSelect colors={colors}/>
          {/* 员工 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth: 160 }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>员工:</span>
            <Search size={12} style={{ color: colors.textMuted }}/>
            <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="输入姓名或工号"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, minWidth: 70 }}/>
          </div>
          {/* 部门 */}
          <DeptSelect colors={colors}/>
          {/* 更多筛选 */}
          <button onClick={() => setShowMore(v => !v)} style={{ ...p5s12(colors), display: 'flex', alignItems: 'center', gap: 4, color: showMore ? colors.primary : colors.text, borderColor: showMore ? colors.primary : colors.inputBorder }}>
            更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => { setEmpSearch(''); setQuickFilter('all'); setStatusFilter('all'); setPage(1); }} style={p5s12(colors)}>重置</button>
            <button onClick={() => setPage(1)} style={p5s14(colors)}>查询</button>
          </div>
        </div>
        {/* Row 2 (expanded: 完成日期 + 快捷筛选) */}
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
              <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>完成日期:</span>
              <input type="date" style={{ ...inputS(colors), border: 'none', padding: 0, width: 108 }}/>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
              <input type="date" style={{ ...inputS(colors), border: 'none', padding: 0, width: 108 }}/>
            </div>
            <span style={{ fontSize: '12px', color: colors.textMuted, marginLeft: 4 }}>快捷筛选</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {QUICK_FILTERS.map(qf => (
                <button key={qf.v} onClick={() => { setQuickFilter(qf.v); setPage(1); }}
                  style={{ padding: '4px 12px', fontSize: '12px', border: `1px solid ${quickFilter === qf.v ? colors.primary : colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', backgroundColor: quickFilter === qf.v ? `${colors.primary}12` : 'transparent', color: quickFilter === qf.v ? colors.primary : colors.text }}>{qf.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {statusItems.map(item => {
          const active = statusFilter === item.key;
          return (
            <button key={item.key} onClick={() => { setStatusFilter(item.key); setPage(1); }} style={{ padding: '4px 10px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 12, cursor: 'pointer', backgroundColor: active ? `${colors.primary}12` : 'transparent', color: active ? colors.primary : colors.textMuted }}>
              {item.label} <strong>{item.count}</strong>
            </button>
          );
        })}
      </div>

      {/* ── Table ─────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}` }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: tab === 'records' ? 1420 : 1100, width: 'max-content' }}>
          <thead>
            <tr>
              {/* No row number or checkbox - align with spec fields only */}
              {currentCols.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  style={{ ...thS(colors), width: col.width, minWidth: col.width, cursor: 'pointer', borderLeft: `1px solid ${colors.tableBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{col.label}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', opacity: sortKey === col.key ? 1 : 0.3 }}>
                      <ChevronRight size={8} style={{ transform: 'rotate(-90deg)', color: sortKey === col.key && sortDir === 'asc' ? colors.primary : colors.textMuted }}/>
                      <ChevronRight size={8} style={{ transform: 'rotate(90deg)', marginTop: -1, color: sortKey === col.key && sortDir === 'desc' ? colors.primary : colors.textMuted }}/>
                    </span>
                  </div>
                </th>
              ))}
              <th style={{ ...thS(colors), width: 60, minWidth: 60, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={row.id}
                style={{ backgroundColor: ri % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                {currentCols.map(col => {
                  const v = (row as any)[col.key];
                  let content: React.ReactNode = v ?? '—';
                  if (col.key === 'applicant') content = <span onClick={() => window.alert(`申请人详情\n姓名：${row.applicant}\n员工号：${row.applicantId}\n部门：${row.applicantDept}\n类型：${row.applyType}`)} style={{ color: colors.primary, cursor: 'pointer', fontWeight: 500 }}>{v}</span>;
                  else if (col.key === 'applyType') content = <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: colors.badgeBlueBg, color: colors.badgeBlueText }}>{v}</span>;
                  else if (col.key === 'approvalStatus') content = <StatusBadge status={v as ApprovalStatus} colors={colors}/>;
                  else if (col.key === 'cancelStatus') content = <span style={{ fontSize: '11px', color: v === '取消审批中' ? colors.badgeBlueText : colors.textMuted }}>{v}</span>;
                  else if (col.key === 'uncalcDates') {
                    const r = row as UncalcRecord;
                    content = <span>{r.uncalcDates} <span style={{ fontSize: '10px', backgroundColor: colors.badgeRedBg, color: colors.badgeRedText, borderRadius: 3, padding: '1px 5px', marginLeft: 4 }}>{r.uncalcCount}天</span></span>;
                  }
                  else if (!v && v !== 0) content = <span style={{ color: colors.textMuted }}>—</span>;
                  return <td key={col.key} style={{ ...tdS(colors), width: col.width, minWidth: col.width, borderLeft: `1px solid ${colors.tableBorder}` }}>{content}</td>;
                })}
                <td style={{ ...tdS(colors), width: 60, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>
                  <button onClick={() => window.alert(`勤务记录详情\n申请人：${row.applicant}\n业务类型：${row.applyType}\n业务日期：${row.bizDate}\n摘要：${row.summary}\n审批状态：${row.approvalStatus}`)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Bottom bar ────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <button onClick={() => setShowColSettings(true)} style={{ ...p5s12(colors), display: 'flex', alignItems: 'center', gap: 4, borderColor: showColSettings ? colors.primary : colors.inputBorder, color: showColSettings ? colors.primary : colors.text }}>
          <Settings2 size={12}/>表头设置
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{totalCount}笔</span>
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={12}/></button>
        {getPages().map((p, i) =>
          p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
            : <button key={p} style={pgS(colors, page === p)} onClick={() => setPage(p as number)}>{p}</button>
        )}
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={12}/></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); }}}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}/>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      {/* ── Modals ────────────────────────── */}
      {showColSettings && (
        <ColSettingsModal
          cols={tab === 'records' ? dutyCols : uncalcCols}
          defaultCols={tab === 'records' ? DUTY_COLS_DEFAULT : UNCALC_COLS_DEFAULT}
          onClose={() => setShowColSettings(false)}
          onApply={(cols) => { tab === 'records' ? setDutyCols(cols) : setUncalcCols(cols); }}
          colors={colors}/>
      )}
    </div>
  );
}
