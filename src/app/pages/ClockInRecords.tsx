import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { todayISO } from '../utils/date';
import {
  fetchClockRecords,
  fetchMakeupClockRecords,
  fetchPhotoClockRecords,
  type ClockRecord as RealClockRecord,
  type MakeupClockRecord as RealMakeupClockRecord,
  type PhotoClockRecord as RealPhotoClockRecord,
} from '../api/realData';
import { useLocation, useNavigate } from 'react-router';
import {
  Search, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Plus, Upload, Download, Camera,
} from 'lucide-react';

// ─── Types ───────────────────────────────────
type TabType = 'original' | 'makeup' | 'field' | 'photo';

type ClockRecord = {
  id: number; name: string; empId: string; dept: string;
  date: string; time: string; source: string; device: string;
  location: string; workLocation: string; freeWork: string;
  note: string; hasPhoto: boolean; photoUrl?: string; photoTakenAt?: string;
  creator: string; createTime: string; modifier: string; modifyTime: string;
};
type MakeupRecord = {
  id: number; status: string; applicant: string; applicantId: string;
  applicantDept: string; makeupDate: string; makeupTime: string; reason: string;
  initiator: string; initiatorId: string; initiateTime: string; completeTime: string;
  hasPhoto: boolean; archiveStatus: string;
};
type FieldRecord = {
  id: number; name: string; empId: string; initiator: string; initiatorId: string;
  source: string; dept: string; date: string; time: string;
  initiateTime: string; completeTime: string; location: string;
  note: string; hasPhoto: boolean; reviewStatus: string;
};
type PhotoRecord = {
  id: number; name: string; empId: string; dept: string;
  date: string; clockTime: string; locateTime: string; completeTime: string;
  location: string; note: string; hasPhoto: boolean; photoUrl?: string; photoTakenAt?: string; reviewStatus: string;
};

// ─── Mock Data ────────────────────────────────
const CLOCK_RECORDS: ClockRecord[] = [];

const MAKEUP_RECORDS: MakeupRecord[] = [];

const FIELD_RECORDS: FieldRecord[] = [];

const PHOTO_CLOCK_RECORDS: PhotoRecord[] = [];

const CLOCK_SOURCE_OPTS = ['企业微信打卡', '钉钉打卡', '人脸识别打卡', '蓝牙打卡', 'Wi-Fi打卡', 'HR手动添加'];
const DEPT_OPTS = ['产品研发中心', '产品运营部', '研发设计一部', '研发设计二部', '工艺开发部', '技术支持部', '直营建连店'];
const ATTEND_GROUPS = ['华托大厦考勤组', '综合考勤组', '研发中心考勤组', '工艺部考勤组'];
const STATUS_OPTS_MAKEUP = ['已完成', '审批中', '已拒绝', '待审批'];
const REVIEW_OPTS = ['已通过', '审批中', '已拒绝'];
type DateRangeFilter = { start: string; end: string };
type SortOrder = 'asc' | 'desc';


// ─── Helpers ─────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

function inDateRange(date: string, range: DateRangeFilter) {
  return (!range.start || date >= range.start) && (!range.end || date <= range.end);
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<React.ReactNode>>) {
  const textRows = rows.map(row => row.map(cell => String(cell ?? '').replace(/<[^>]*>/g, '')));
  const csv = [headers, ...textRows]
    .map(row => row.map(cell => /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function showOriginalClockDetail(row: ClockRecord) {
  window.alert(`原始打卡记录详情\n姓名：${row.name} ${row.empId}\n部门：${row.dept}\n日期时间：${row.date} ${row.time}\n来源：${row.source}\n地点：${row.location}\n备注：${row.note || '-'}`);
}

function showMakeupClockDetail(row: MakeupRecord) {
  window.alert(`补卡记录详情\n申请人：${row.applicant} ${row.applicantId}\n部门：${row.applicantDept}\n补卡时间：${row.makeupDate} ${row.makeupTime}\n原因：${row.reason}\n状态：${row.status}\n归档：${row.archiveStatus}`);
}

function showFieldClockDetail(row: FieldRecord) {
  window.alert(`外勤记录详情\n姓名：${row.name} ${row.empId}\n部门：${row.dept}\n日期时间：${row.date} ${row.time}\n地点：${row.location}\n事由：${row.note || '-'}\n审核状态：${row.reviewStatus}`);
}

function showPhotoClockDetail(row: PhotoRecord) {
  window.alert(`拍照打卡记录详情\n姓名：${row.name} ${row.empId}\n部门：${row.dept}\n打卡时间：${row.date} ${row.clockTime}\n定位完成：${row.completeTime}\n地点：${row.location}\n审核状态：${row.reviewStatus}`);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      current = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}


const pBtn = (c: any): React.CSSProperties => ({ padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: c.primary, color: '#fff', whiteSpace: 'nowrap' });
const oBtn = (c: any, a?: boolean): React.CSSProperties => ({ padding: '5px 12px', fontSize: '12px', border: `1px solid ${a ? c.primary : c.inputBorder}`, borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent', color: a ? c.primary : c.text, whiteSpace: 'nowrap' });
const thS = (c: any): React.CSSProperties => ({ padding: '8px 10px', fontSize: '12px', color: c.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${c.tableBorder}`, backgroundColor: c.tableHeaderBg, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 20, borderLeft: `1px solid ${c.tableBorder}` });
const tdS = (c: any): React.CSSProperties => ({ padding: '7px 10px', fontSize: '12px', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `1px solid ${c.tableBorder}` });
const pgS = (c: any, a: boolean): React.CSSProperties => ({ minWidth: 24, height: 24, padding: '0 5px', fontSize: '12px', border: `1px solid ${a ? c.primary : c.inputBorder}`, borderRadius: 4, backgroundColor: a ? c.primary : 'transparent', color: a ? '#fff' : c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const map: Record<string, [string, string]> = {
    '已完成': [colors.badgeGreenBg, colors.badgeGreenText],
    '已通过': [colors.badgeGreenBg, colors.badgeGreenText],
    '已归档': [colors.badgeGreenBg, colors.badgeGreenText],
    '审批中': [colors.badgeBlueBg,  colors.badgeBlueText],
    '已拒绝': [colors.badgeRedBg,   colors.badgeRedText],
    '待审批': [colors.badgeGrayBg,  colors.badgeGrayText],
    '未归档': [colors.badgeGrayBg,  colors.badgeGrayText],
  };
  const [bg, txt] = map[status] ?? [colors.badgeGrayBg, colors.badgeGrayText];
  return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: bg, color: txt, whiteSpace: 'nowrap' }}>{status}</span>;
}

type PhotoPreview = { name?: string; photoUrl?: string; photoTakenAt?: string; note?: string };

function PhotoModal({ title, target, onClose, colors }: { title: string; target?: PhotoPreview | string | null; onClose: () => void; colors: any }) {
  const preview = typeof target === 'string' ? { name: target } : (target || {});
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 10, width: 340, boxShadow: '0 8px 28px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={14}/></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {preview.photoUrl ? (
            <img src={preview.photoUrl} alt="打卡照片" style={{ width: 220, height: 220, objectFit: 'cover', borderRadius: 8, border: `1px solid ${colors.cardBorder}`, backgroundColor: colors.statCardBg }} />
          ) : (
            <div style={{ width: 220, height: 220, borderRadius: 8, backgroundColor: colors.statCardBg, border: `1px solid ${colors.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Camera size={36} style={{ color: colors.textMuted }}/>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>暂无真实照片</span>
            </div>
          )}
          <span style={{ fontSize: '12px', color: colors.text }}>{preview.name || ''}</span>
          <span style={{ fontSize: '11px', color: colors.textMuted }}>拍摄时间：{preview.photoTakenAt || todayISO()}</span>
          {preview.note && <span style={{ fontSize: '11px', color: colors.textMuted }}>{preview.note}</span>}
        </div>
      </div>
    </div>
  );
}

function InlineSelect({ label, opts, colors, minWidth, value, onChange }: { label: string; opts: string[]; colors: any; minWidth?: number; value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth }}>
      <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: value ? colors.text : colors.textMuted, flex: 1 }}>
        <option value="">全部</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function EmpSearch({ label, colors, minWidth, value, onChange, onEnter }: { label: string; colors: any; minWidth?: number; value: string; onChange: (value: string) => void; onEnter?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth }}>
      <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
      <Search size={11} style={{ color: colors.textMuted, flexShrink: 0 }}/>
      <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }} placeholder="输入姓名或工号"
        style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, minWidth: 70 }}/>
    </div>
  );
}

function DateInput({ label, colors, value, onChange }: { label: string; colors: any; value: DateRangeFilter; onChange: (value: DateRangeFilter) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
      <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>{label}:</span>
      <input type="date" value={value.start} onChange={e => onChange({ ...value, start: e.target.value })} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: 108 }}/>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
      <input type="date" value={value.end} onChange={e => onChange({ ...value, end: e.target.value })} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: 108 }}/>
    </div>
  );
}

function StatusFilterBar({ items, activeKey, onChange, colors }: { items: Array<{ key: string; label: string; count: number }>; activeKey: string; onChange: (key: string) => void; colors: any }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
      {items.map(item => {
        const active = activeKey === item.key;
        return (
          <button key={item.key} onClick={() => onChange(item.key)} style={{ padding: '4px 10px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 12, cursor: 'pointer', backgroundColor: active ? `${colors.primary}12` : 'transparent', color: active ? colors.primary : colors.textMuted }}>
            {item.label} <strong>{item.count}</strong>
          </button>
        );
      })}
    </div>
  );
}

function PaginationBar({ total, page, pageSize, totalPages, onPage, onPageSize, colors }: {
  total: number; page: number; pageSize: number; totalPages: number;
  onPage: (p: number) => void; onPageSize: (n: number) => void; colors: any;
}) {
  const [jumpPage, setJumpPage] = useState('');
  const pages: (number | '...')[] = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : page <= 4 ? [1, 2, 3, 4, 5, '...', totalPages]
    : page >= totalPages - 3 ? [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    : [1, '...', page - 1, page, page + 1, '...', totalPages];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
      <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{total}笔</span>
      <button style={pgS(colors, false)} onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft size={12}/></button>
      {pages.map((p, i) => p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
        : <button key={p} style={pgS(colors, page === p)} onClick={() => onPage(p as number)}>{p}</button>)}
      <button style={pgS(colors, false)} onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}><ChevronRight size={12}/></button>
      <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))}
        style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
        {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
      </select>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
      <input value={jumpPage} onChange={e => setJumpPage(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) onPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); }}}
        style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}/>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
    </div>
  );
}

// ─── Tab 1: 原始打卡记录 ──────────────────────
function OriginalClockTab({ colors }: { colors: any }) {
  const [showMore, setShowMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [photoTarget, setPhotoTarget] = useState<PhotoPreview | null>(null);
  const [activeClockFilter, setActiveClockFilter] = useState<string>('all');
  const [rows, setRows] = useState<ClockRecord[]>([]);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortKey, setSortKey] = useState<keyof ClockRecord>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const importInputRef = useRef<HTMLInputElement>(null);


  const loadClockRows = useCallback(async () => {
    try {
      const res = await fetchClockRecords();
      setRows(res.rows || []);
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadClockRows();
  }, [loadClockRows]);

  const filteredRows = rows.filter(row => {
    const keyword = empFilter.trim().toLowerCase();
    const groupKeyword = groupFilter.replace('考勤组', '').replace('综合', '').replace('华托大厦', '华托');
    const matchForm = inDateRange(row.date, dateRange)
      && (!deptFilter || row.dept === deptFilter)
      && (!keyword || row.name.toLowerCase().includes(keyword) || row.empId.toLowerCase().includes(keyword))
      && (!groupFilter || row.workLocation.includes(groupKeyword) || row.dept.includes(groupKeyword))
      && (!sourceFilter || row.source === sourceFilter);
    if (!matchForm) return false;
    if (activeClockFilter === 'all') return true;
    if (activeClockFilter === 'on') return row.note.includes('上班') || row.freeWork === '上班';
    if (activeClockFilter === 'off') return row.note.includes('下班') || row.freeWork === '下班';
    if (activeClockFilter === 'photo') return row.hasPhoto;
    if (activeClockFilter === 'sourceWx') return row.source.includes('企业微信');
    return true;
  });
  const clockFilterItems = [
    { key: 'all', label: '全部', count: rows.length },
    { key: 'on', label: '上班打卡', count: rows.filter(row => row.note.includes('上班') || row.freeWork === '上班').length },
    { key: 'off', label: '下班打卡', count: rows.filter(row => row.note.includes('下班') || row.freeWork === '下班').length },
    { key: 'sourceWx', label: '企业微信', count: rows.filter(row => row.source.includes('企业微信')).length },
    { key: 'photo', label: '有照片', count: rows.filter(row => row.hasPhoto).length },
  ];
  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];

    const normalize = (value: ClockRecord[keyof ClockRecord]) => {
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'number') return value;
      return String(value ?? '').toLowerCase();
    };

    const left = normalize(av);
    const right = normalize(bv);
    if (left === right) return 0;

    const base = left > right ? 1 : -1;
    return sortOrder === 'asc' ? base : -base;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const allSel = pagedRows.length > 0 && pagedRows.every(row => selected.has(row.id));

  const someSel = pagedRows.some(row => selected.has(row.id)) && !allSel;
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allSel) pagedRows.forEach(row => next.delete(row.id));
    else pagedRows.forEach(row => next.add(row.id));
    return next;
  });
  const toggleRow = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const resetFilters = () => {
    setDateRange({ start: '', end: '' });
    setDeptFilter('');
    setEmpFilter('');
    setGroupFilter('');
    setSourceFilter('');
    setActiveClockFilter('all');
    setSelected(new Set());
    setPage(1);
  };
  const COLS: Array<{ k: keyof ClockRecord; l: string; w: number }> = [
    { k: 'name', l: '姓名', w: 70 }, { k: 'empId', l: '员工号', w: 88 }, { k: 'dept', l: '部门', w: 110 },
    { k: 'date', l: '打卡日期', w: 88 }, { k: 'time', l: '打卡时间', w: 78 }, { k: 'source', l: '打卡来源', w: 105 },
    { k: 'device', l: '打卡设备', w: 120 }, { k: 'location', l: '打卡地点', w: 155 }, { k: 'workLocation', l: '上班地点', w: 110 },
    { k: 'freeWork', l: '自由工时上下班', w: 110 }, { k: 'note', l: '备注', w: 90 },
    { k: 'hasPhoto', l: '打卡照片', w: 75 }, { k: 'creator', l: '创建人', w: 70 },
    { k: 'createTime', l: '创建时间', w: 145 }, { k: 'modifier', l: '修改人', w: 70 }, { k: 'modifyTime', l: '修改时间', w: 145 },
  ];

  const toggleSort = (key: keyof ClockRecord) => {
    if (sortKey === key) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const getSortMarker = (key: keyof ClockRecord) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const toClockRecord = (payload: Partial<ClockRecord>, fallbackId: number): ClockRecord => {
    const now = new Date();
    const nowDate = now.toISOString().slice(0, 10);
    const nowTime = now.toTimeString().slice(0, 8);
    const nowDateTime = `${nowDate} ${nowTime.slice(0, 5)}`;

    return {
      id: Number(payload.id) || fallbackId,
      name: payload.name || '新员工',
      empId: payload.empId || `EMP${String(fallbackId).padStart(4, '0')}`,
      dept: payload.dept || '产品运营部',
      date: payload.date || nowDate,
      time: payload.time || nowTime,
      source: payload.source || 'HR手动添加',
      device: payload.device || '后台录入',
      location: payload.location || '总部',
      workLocation: payload.workLocation || '总部',
      freeWork: payload.freeWork === '下班' ? '下班' : '上班',
      note: payload.note || '预制导入',
      hasPhoto: Boolean(payload.hasPhoto),
      creator: payload.creator || 'HR',
      createTime: payload.createTime || nowDateTime,
      modifier: payload.modifier || '',
      modifyTime: payload.modifyTime || '',
    };
  };

  const handleAddPresetRecord = () => {
    const nextId = Math.max(0, ...rows.map(row => row.id)) + 1;
    const keyword = empFilter.trim().toLowerCase();
    const base = rows.find(row => keyword && (row.name.toLowerCase().includes(keyword) || row.empId.toLowerCase().includes(keyword)));

    const preset = toClockRecord({
      ...base,
      id: nextId,
      note: '预制打卡记录',
      source: 'HR手动添加',
      creator: 'HR',
    }, nextId);

    setRows(current => [preset, ...current]);
    setSelected(new Set([nextId]));
    setPage(1);
  };

  const handleImportRecords = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    let importedRows: ClockRecord[] = [];
    const nextStartId = Math.max(0, ...rows.map(row => row.id)) + 1;

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [];
        importedRows = source.map((item: Partial<ClockRecord>, index: number) => toClockRecord(item, nextStartId + index));
      } else {
        const csvRows = parseCsv(text);
        if (csvRows.length > 1) {
          const dataRows = csvRows.slice(1);
          importedRows = dataRows.map((line, index) => toClockRecord({
            name: line[0],
            empId: line[1],
            dept: line[2],
            date: line[3],
            time: line[4],
            source: line[5],
            device: line[6],
            location: line[7],
            workLocation: line[8],
            freeWork: line[9] as '上班' | '下班',
            note: line[10],
            hasPhoto: line[11] === 'true' || line[11] === '有',
            creator: line[12],
            createTime: line[13],
            modifier: line[14],
            modifyTime: line[15],
          }, nextStartId + index));
        }
      }
    } catch (_error) {
      window.alert('导入失败：文件格式不正确，请使用导出的 CSV 或 JSON。');
      return;
    }

    if (importedRows.length === 0) {
      window.alert('导入失败：未识别到有效记录。');
      return;
    }

    setRows(current => [...importedRows, ...current]);
    setSelected(new Set(importedRows.map(row => row.id)));
    setPage(1);
    window.alert(`导入成功：${importedRows.length} 条记录`);
  };

  const exportCurrentRows = () => {
    const exportRows = selected.size > 0
      ? sortedRows.filter(row => selected.has(row.id))
      : sortedRows;

    downloadCsv(
      `原始打卡记录-${selected.size > 0 ? '选中' : '筛选'}-${new Date().toISOString().slice(0, 10)}.csv`,
      COLS.map(col => col.l),
      exportRows.map(row => COLS.map(col => {
        const value = row[col.k];
        if (typeof value === 'boolean') return value ? '有' : '无';
        return String(value ?? '');
      })),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Filter */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <DateInput label="打卡日" colors={colors} value={dateRange} onChange={setDateRange}/>
          <InlineSelect label="部门" opts={DEPT_OPTS} colors={colors} value={deptFilter} onChange={setDeptFilter}/>
          <EmpSearch label="员工" colors={colors} minWidth={160} value={empFilter} onChange={setEmpFilter} onEnter={() => setPage(1)}/>
          <InlineSelect label="考勤组" opts={ATTEND_GROUPS} colors={colors} value={groupFilter} onChange={setGroupFilter}/>
          <InlineSelect label="打卡来源" opts={CLOCK_SOURCE_OPTS} colors={colors} value={sourceFilter} onChange={setSourceFilter}/>
          <button onClick={() => setShowMore(v => !v)} style={{ ...oBtn(colors, showMore), display: 'flex', alignItems: 'center', gap: 4 }}>更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button onClick={resetFilters} style={oBtn(colors)}>重置</button><button onClick={() => { setSelected(new Set()); setPage(1); }} style={pBtn(colors)}>查询</button></div>
        </div>
        {showMore && <div style={{ marginBottom: 10 }}><span style={{ fontSize: '12px', color: colors.textMuted }}>更多筛选条件可在此扩展</span></div>}
      </div>
      {(sourceFile || loadError) && (
        <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 6, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', flexShrink: 0 }}>
          {sourceFile ? `已连接真实数据源：${sourceFile}` : ''}
          {loadError ? ` ${loadError}` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {clockFilterItems.map(item => {
          const active = activeClockFilter === item.key;
          return (
            <button key={item.key} onClick={() => { setActiveClockFilter(item.key); setSelected(new Set()); setPage(1); }} style={{ padding: '4px 10px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 12, cursor: 'pointer', backgroundColor: active ? `${colors.primary}12` : 'transparent', color: active ? colors.primary : colors.textMuted }}>
              {item.label} <strong>{item.count}</strong>
            </button>
          );
        })}
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <button onClick={handleAddPresetRecord} style={{ ...pBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12}/>预制打卡记录</button>
        <button onClick={() => importInputRef.current?.click()} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Upload size={12}/>导入打卡记录</button>
        <button onClick={exportCurrentRows} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12}/>导出</button>
        <input ref={importInputRef} type="file" accept=".csv,.json" onChange={handleImportRecords} style={{ display: 'none' }}/>
        {selected.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selected.size} 条</span>}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1720, width: 'max-content' }}>
          <thead>
            <tr>
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', position: 'sticky', left: 0, zIndex: 25, borderLeft: 'none' }}>
                <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = someSel; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {COLS.map(c => (
                <th key={c.k} onClick={() => toggleSort(c.k)} style={{ ...thS(colors), width: c.w, minWidth: c.w, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.l}
                    <span style={{ fontSize: '11px', color: sortKey === c.k ? colors.primary : colors.textMuted }}>{getSortMarker(c.k)}</span>
                  </span>
                </th>
              ))}

              <th style={{ ...thS(colors), width: 60, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, ri) => {
              const isSel = selected.has(row.id);
              const bg = isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe;
              return (
                <tr key={row.id} style={{ backgroundColor: bg, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.backgroundColor = bg)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: bg, borderLeft: 'none' }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  <td style={{ ...tdS(colors), width: 70 }}><span style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{row.name}</span></td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.textMuted, fontSize: '11px' }}>{row.empId}</td>
                  <td style={{ ...tdS(colors), width: 110 }}>{row.dept}</td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.primary, fontSize: '11px' }}>{row.date}</td>
                  <td style={{ ...tdS(colors), width: 78 }}>{row.time}</td>
                  <td style={{ ...tdS(colors), width: 105, fontSize: '11px' }}>{row.source}</td>
                  <td style={{ ...tdS(colors), width: 120, fontSize: '11px', color: colors.textMuted }}>{row.device}</td>
                  <td style={{ ...tdS(colors), width: 155, fontSize: '11px', color: colors.textMuted }}>{row.location}</td>
                  <td style={{ ...tdS(colors), width: 110, fontSize: '11px', color: colors.textMuted }}>{row.workLocation}</td>
                  <td style={{ ...tdS(colors), width: 110 }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: row.freeWork === '上班' ? colors.badgeBlueBg : colors.badgeGrayBg, color: row.freeWork === '上班' ? colors.badgeBlueText : colors.badgeGrayText }}>{row.freeWork}</span>
                  </td>
                  <td style={{ ...tdS(colors), width: 90, fontSize: '11px', color: colors.textMuted }}>{row.note || <span style={{ color: colors.textMuted }}>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 75, textAlign: 'center' }}>
                    {row.hasPhoto ? <button onClick={() => setPhotoTarget({ name: row.name, photoUrl: row.photoUrl, photoTakenAt: row.photoTakenAt || row.createTime, note: row.note })} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                      : <span style={{ color: colors.textMuted }}>—</span>}
                  </td>
                  <td style={{ ...tdS(colors), width: 70, fontSize: '11px', color: colors.textMuted }}>{row.creator}</td>
                  <td style={{ ...tdS(colors), width: 145, fontSize: '11px', color: colors.textMuted }}>{row.createTime}</td>
                  <td style={{ ...tdS(colors), width: 70, fontSize: '11px', color: colors.textMuted }}>{row.modifier || <span>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 145, fontSize: '11px', color: colors.textMuted }}>{row.modifyTime || <span>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 60, textAlign: 'center' }}>
                    <button onClick={() => showOriginalClockDetail(row)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar total={filteredRows.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} colors={colors}/>
      {photoTarget && <PhotoModal title="打卡照片" target={photoTarget} onClose={() => setPhotoTarget(null)} colors={colors}/>}
    </div>
  );
}

// ─── Tab 2: 补卡记录 ──────────────────────────
function MakeupClockTab({ colors }: { colors: any }) {
  const [showMore, setShowMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [photoTarget, setPhotoTarget] = useState<PhotoPreview | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<keyof MakeupRecord>('makeupDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [rows, setRows] = useState<MakeupRecord[]>([]);
  const [loadError, setLoadError] = useState('');

  const loadMakeupRows = useCallback(async () => {
    try {
      const res = await fetchMakeupClockRecords();
      setRows((res.rows || []) as RealMakeupClockRecord[]);
      setLoadError('');
    } catch (_error) {
      setLoadError('移动端补卡记录连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadMakeupRows();
  }, [loadMakeupRows]);

  const filteredRows = rows.filter(row => {
    const applicantKeyword = applicantFilter.trim().toLowerCase();
    const initiatorKeyword = initiatorFilter.trim().toLowerCase();
    const matchForm = inDateRange(row.makeupDate, dateRange)
      && (!deptFilter || row.applicantDept === deptFilter)
      && (!applicantKeyword || row.applicant.toLowerCase().includes(applicantKeyword) || row.applicantId.toLowerCase().includes(applicantKeyword))
      && (!initiatorKeyword || row.initiator.toLowerCase().includes(initiatorKeyword) || row.initiatorId.toLowerCase().includes(initiatorKeyword))
      && (!recordStatusFilter || row.status === recordStatusFilter);
    return matchForm && (statusFilter === 'all' || row.status === statusFilter || row.archiveStatus === statusFilter);
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];

    const normalize = (value: MakeupRecord[keyof MakeupRecord]) => {
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'number') return value;
      const text = String(value ?? '').trim();
      const parsed = Date.parse(text);
      return Number.isNaN(parsed) ? text.toLowerCase() : parsed;
    };

    const left = normalize(av);
    const right = normalize(bv);
    if (left === right) return 0;

    const base = left > right ? 1 : -1;
    return sortOrder === 'asc' ? base : -base;
  });

  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const statusItems = [
    { key: 'all', label: '全部', count: rows.length },
    { key: '已完成', label: '已完成', count: rows.filter(row => row.status === '已完成').length },
    { key: '审批中', label: '审批中', count: rows.filter(row => row.status === '审批中').length },
    { key: '已拒绝', label: '已拒绝', count: rows.filter(row => row.status === '已拒绝').length },
    { key: '未归档', label: '未归档', count: rows.filter(row => row.archiveStatus === '未归档').length },
  ];
  const allSel = pagedRows.length > 0 && pagedRows.every(row => selected.has(row.id));
  const someSel = pagedRows.some(row => selected.has(row.id)) && !allSel;
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allSel) pagedRows.forEach(row => next.delete(row.id));
    else pagedRows.forEach(row => next.add(row.id));
    return next;
  });
  const toggleRow = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const resetFilters = () => { setDateRange({ start: '', end: '' }); setDeptFilter(''); setApplicantFilter(''); setInitiatorFilter(''); setRecordStatusFilter(''); setStatusFilter('all'); setSelected(new Set()); setPage(1); };

  const COLS: Array<{ k: keyof MakeupRecord; l: string; w: number }> = [
    { k: 'status', l: '记录状态', w: 95 },
    { k: 'applicant', l: '申请人', w: 75 },
    { k: 'applicantId', l: '申请人员工号', w: 105 },
    { k: 'applicantDept', l: '申请人部门', w: 110 },
    { k: 'makeupDate', l: '补卡日期', w: 88 },
    { k: 'makeupTime', l: '补卡时间', w: 78 },
    { k: 'reason', l: '补卡原因', w: 160 },
    { k: 'initiator', l: '发起人', w: 75 },
    { k: 'initiatorId', l: '发起人员工号', w: 105 },
    { k: 'initiateTime', l: '发起时间', w: 145 },
    { k: 'completeTime', l: '完成时间', w: 145 },
    { k: 'hasPhoto', l: '查看图片', w: 75 },
    { k: 'archiveStatus', l: '当前归档状态', w: 105 },
  ];

  const toggleSort = (key: keyof MakeupRecord) => {
    if (sortKey === key) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const getSortMarker = (key: keyof MakeupRecord) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const exportCurrentRows = () => {
    const exportRows = selected.size > 0
      ? sortedRows.filter(row => selected.has(row.id))
      : sortedRows;

    downloadCsv(
      `补卡记录-${selected.size > 0 ? '选中' : '筛选'}-${new Date().toISOString().slice(0, 10)}.csv`,
      COLS.map(col => col.l),
      exportRows.map(row => COLS.map(col => {
        const value = row[col.k];
        if (typeof value === 'boolean') return value ? '有' : '无';
        return String(value ?? '');
      })),
    );
  };
  const startMakeupRecord = () => {
    const nextId = Math.max(0, ...rows.map(row => row.id)) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setRows(current => [{
      id: nextId,
      status: '审批中',
      applicant: '新增补卡人员',
      applicantId: `MK${String(nextId).padStart(4, '0')}`,
      applicantDept: '产品运营部',
      makeupDate: today,
      makeupTime: '09:00',
      reason: '手动发起补卡记录',
      initiator: '当前用户',
      initiatorId: 'CURRENT',
      initiateTime: now,
      completeTime: '',
      hasPhoto: false,
      archiveStatus: '未归档',
    }, ...current]);
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Filter */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        {loadError && <div style={{ marginBottom: 8, fontSize: '12px', color: colors.danger || '#AA2B3A' }}>{loadError}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <DateInput label="补卡日期" colors={colors} value={dateRange} onChange={setDateRange}/>
          <InlineSelect label="申请人部门" opts={DEPT_OPTS} colors={colors} value={deptFilter} onChange={setDeptFilter}/>
          <EmpSearch label="申请人" colors={colors} minWidth={150} value={applicantFilter} onChange={setApplicantFilter} onEnter={() => setPage(1)}/>
          <EmpSearch label="发起人" colors={colors} minWidth={150} value={initiatorFilter} onChange={setInitiatorFilter} onEnter={() => setPage(1)}/>
          <InlineSelect label="记录状态" opts={STATUS_OPTS_MAKEUP} colors={colors} value={recordStatusFilter} onChange={setRecordStatusFilter}/>
          <button onClick={() => setShowMore(v => !v)} style={{ ...oBtn(colors, showMore), display: 'flex', alignItems: 'center', gap: 4 }}>更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button onClick={resetFilters} style={oBtn(colors)}>重置</button><button onClick={() => { setSelected(new Set()); setPage(1); }} style={pBtn(colors)}>查询</button></div>
        </div>
        {showMore && <div style={{ marginBottom: 10 }}><span style={{ fontSize: '12px', color: colors.textMuted }}>更多筛选条件可在此扩展</span></div>}
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <button onClick={startMakeupRecord} style={{ ...pBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12}/>发起补卡记录</button>
        <button onClick={exportCurrentRows} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12}/>导出</button>
        {selected.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selected.size} 条</span>}
      </div>
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', position: 'sticky', left: 0, zIndex: 25, borderLeft: 'none' }}>
                <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = someSel; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {COLS.map(c => (
                <th key={c.k} onClick={() => toggleSort(c.k)} style={{ ...thS(colors), width: c.w, minWidth: c.w, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.l}
                    <span style={{ fontSize: '11px', color: sortKey === c.k ? colors.primary : colors.textMuted }}>{getSortMarker(c.k)}</span>
                  </span>
                </th>
              ))}
              <th style={{ ...thS(colors), width: 60, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, ri) => {
              const isSel = selected.has(row.id);
              const bg = isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe;
              return (
                <tr key={row.id} style={{ backgroundColor: bg, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.backgroundColor = bg)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: bg, borderLeft: 'none' }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  <td style={{ ...tdS(colors), width: 95 }}><StatusBadge status={row.status} colors={colors}/></td>
                  <td style={{ ...tdS(colors), width: 75 }}><span style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{row.applicant}</span></td>
                  <td style={{ ...tdS(colors), width: 105, color: colors.textMuted, fontSize: '11px' }}>{row.applicantId}</td>
                  <td style={{ ...tdS(colors), width: 110 }}>{row.applicantDept}</td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.primary, fontSize: '11px' }}>{row.makeupDate}</td>
                  <td style={{ ...tdS(colors), width: 78 }}>{row.makeupTime}</td>
                  <td style={{ ...tdS(colors), width: 160, fontSize: '11px', color: colors.textMuted }}>{row.reason}</td>
                  <td style={{ ...tdS(colors), width: 75 }}>{row.initiator}</td>
                  <td style={{ ...tdS(colors), width: 105, color: colors.textMuted, fontSize: '11px' }}>{row.initiatorId}</td>
                  <td style={{ ...tdS(colors), width: 145, color: colors.textMuted, fontSize: '11px' }}>{row.initiateTime}</td>
                  <td style={{ ...tdS(colors), width: 145, color: colors.textMuted, fontSize: '11px' }}>{row.completeTime || <span style={{ color: colors.textMuted }}>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 75, textAlign: 'center' }}>
                    {row.hasPhoto ? <button onClick={() => setPhotoTarget(row.applicant)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                      : <span style={{ color: colors.textMuted }}>—</span>}
                  </td>
                  <td style={{ ...tdS(colors), width: 105 }}><StatusBadge status={row.archiveStatus} colors={colors}/></td>
                  <td style={{ ...tdS(colors), width: 60, textAlign: 'center' }}>
                    <button onClick={() => showMakeupClockDetail(row)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar total={filteredRows.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} colors={colors}/>
      {photoTarget && <PhotoModal title="补卡照片" onClose={() => setPhotoTarget(null)} colors={colors}/>}
    </div>
  );
}

// ─── Tab 3: 外勤记录 ──────────────────────────
function FieldWorkTab({ colors }: { colors: any }) {
  const [showMore, setShowMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [sortKey, setSortKey] = useState<keyof FieldRecord>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [rows, setRows] = useState<FieldRecord[]>([]);
  const fieldImportInputRef = useRef<HTMLInputElement>(null);
  const filteredRows = rows.filter(row => {
    const applicantKeyword = applicantFilter.trim().toLowerCase();
    const initiatorKeyword = initiatorFilter.trim().toLowerCase();
    const matchForm = inDateRange(row.date, dateRange)
      && (!deptFilter || row.dept === deptFilter)
      && (!applicantKeyword || row.name.toLowerCase().includes(applicantKeyword) || row.empId.toLowerCase().includes(applicantKeyword))
      && (!initiatorKeyword || row.initiator.toLowerCase().includes(initiatorKeyword) || row.initiatorId.toLowerCase().includes(initiatorKeyword))
      && (!reviewFilter || row.reviewStatus === reviewFilter);
    return matchForm && (statusFilter === 'all' || row.reviewStatus === statusFilter || row.source === statusFilter);
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];

    const normalize = (value: FieldRecord[keyof FieldRecord]) => {
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'number') return value;
      const text = String(value ?? '').trim();
      const parsed = Date.parse(text);
      return Number.isNaN(parsed) ? text.toLowerCase() : parsed;
    };

    const left = normalize(av);
    const right = normalize(bv);
    if (left === right) return 0;

    const base = left > right ? 1 : -1;
    return sortOrder === 'asc' ? base : -base;
  });

  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const statusItems = [
    { key: 'all', label: '全部', count: rows.length },
    { key: '已通过', label: '已通过', count: rows.filter(row => row.reviewStatus === '已通过').length },
    { key: '审批中', label: '审批中', count: rows.filter(row => row.reviewStatus === '审批中').length },
    { key: '移动端申请', label: '移动端', count: rows.filter(row => row.source === '移动端申请').length },
  ];
  const allSel = pagedRows.length > 0 && pagedRows.every(row => selected.has(row.id));
  const someSel = pagedRows.some(row => selected.has(row.id)) && !allSel;
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allSel) pagedRows.forEach(row => next.delete(row.id));
    else pagedRows.forEach(row => next.add(row.id));
    return next;
  });
  const toggleRow = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const resetFilters = () => { setDateRange({ start: '', end: '' }); setDeptFilter(''); setApplicantFilter(''); setInitiatorFilter(''); setReviewFilter(''); setStatusFilter('all'); setSelected(new Set()); setPage(1); };
  const COLS: Array<{ k: keyof FieldRecord; l: string; w: number }> = [
    { k: 'name', l: '姓名', w: 70 },
    { k: 'empId', l: '员工号', w: 88 },
    { k: 'initiator', l: '发起人', w: 75 },
    { k: 'initiatorId', l: '发起人员工号', w: 105 },
    { k: 'source', l: '数据来源', w: 95 },
    { k: 'dept', l: '部门', w: 110 },
    { k: 'date', l: '外勤日期', w: 88 },
    { k: 'time', l: '外勤时间', w: 130 },
    { k: 'initiateTime', l: '发起时间', w: 145 },
    { k: 'completeTime', l: '完成时间', w: 145 },
    { k: 'location', l: '外勤地点', w: 160 },
    { k: 'note', l: '备注', w: 100 },
    { k: 'hasPhoto', l: '查看图片', w: 75 },
    { k: 'reviewStatus', l: '审核状态', w: 85 },
  ];

  const toggleSort = (key: keyof FieldRecord) => {
    if (sortKey === key) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const getSortMarker = (key: keyof FieldRecord) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleAddFieldRecord = () => {
    const nextId = Math.max(0, ...rows.map(row => row.id)) + 1;
    const applicantKeyword = applicantFilter.trim().toLowerCase();
    const initiatorKeyword = initiatorFilter.trim().toLowerCase();
    const base = rows.find(row =>
      applicantKeyword && (row.name.toLowerCase().includes(applicantKeyword) || row.empId.toLowerCase().includes(applicantKeyword)),
    );
    const now = new Date();
    const nowDate = now.toISOString().slice(0, 10);
    const nowTime = now.toTimeString().slice(0, 5);

    const newRow: FieldRecord = {
      id: nextId,
      name: base?.name || applicantFilter.trim() || '新员工',
      empId: base?.empId || `CP${String(25000 + nextId)}`,
      initiator: base?.initiator || initiatorFilter.trim() || 'HR管理员',
      initiatorId: base?.initiatorId || (initiatorKeyword ? 'CP99999' : 'HR001'),
      source: 'PC端申请',
      dept: deptFilter || base?.dept || '产品运营部',
      date: dateRange.start || nowDate,
      time: '09:00 - 18:00',
      initiateTime: `${nowDate} ${nowTime}`,
      completeTime: '',
      location: '待补充',
      note: '新发起外勤记录',
      hasPhoto: false,
      reviewStatus: '审批中',
    };

    setRows(current => [newRow, ...current]);
    setSelected(new Set([newRow.id]));
    setStatusFilter('all');
    setPage(1);
  };

  const handleImportFieldRecords = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    let importedRows: FieldRecord[] = [];
    const nextStartId = Math.max(0, ...rows.map(row => row.id)) + 1;

    const toFieldRecord = (payload: Partial<FieldRecord>, fallbackId: number): FieldRecord => ({
      id: Number(payload.id) || fallbackId,
      name: payload.name || '新员工',
      empId: payload.empId || `CP${String(25000 + fallbackId)}`,
      initiator: payload.initiator || payload.name || 'HR管理员',
      initiatorId: payload.initiatorId || 'HR001',
      source: payload.source || 'PC端申请',
      dept: payload.dept || '产品运营部',
      date: payload.date || new Date().toISOString().slice(0, 10),
      time: payload.time || '09:00 - 18:00',
      initiateTime: payload.initiateTime || `${new Date().toISOString().slice(0, 10)} 09:00`,
      completeTime: payload.completeTime || '',
      location: payload.location || '待补充',
      note: payload.note || '',
      hasPhoto: Boolean(payload.hasPhoto),
      reviewStatus: payload.reviewStatus || '审批中',
    });

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [];
        importedRows = source.map((item: Partial<FieldRecord>, index: number) => toFieldRecord(item, nextStartId + index));
      } else {
        const csvRows = parseCsv(text);
        if (csvRows.length > 1) {
          const dataRows = csvRows.slice(1);
          importedRows = dataRows.map((line, index) => toFieldRecord({
            name: line[0],
            empId: line[1],
            initiator: line[2],
            initiatorId: line[3],
            source: line[4],
            dept: line[5],
            date: line[6],
            time: line[7],
            initiateTime: line[8],
            completeTime: line[9],
            location: line[10],
            note: line[11],
            hasPhoto: line[12] === 'true' || line[12] === '有',
            reviewStatus: line[13],
          }, nextStartId + index));
        }
      }
    } catch (_error) {
      window.alert('导入失败：文件格式不正确，请使用导出的 CSV 或 JSON。');
      return;
    }

    if (importedRows.length === 0) {
      window.alert('导入失败：未识别到有效记录。');
      return;
    }

    setRows(current => [...importedRows, ...current]);
    setSelected(new Set(importedRows.map(row => row.id)));
    setStatusFilter('all');
    setPage(1);
    window.alert(`导入成功：${importedRows.length} 条记录`);
  };

  const exportCurrentRows = () => {
    const exportRows = selected.size > 0
      ? sortedRows.filter(row => selected.has(row.id))
      : sortedRows;

    downloadCsv('外勤记录.csv', ['姓名','员工号','发起人','发起人员工号','数据来源','部门','外勤日期','外勤时间','发起时间','完成时间','外勤地点','备注','查看图片','审核状态'], exportRows.map(row => [row.name, row.empId, row.initiator, row.initiatorId, row.source, row.dept, row.date, row.time, row.initiateTime, row.completeTime, row.location, row.note, row.hasPhoto ? '有' : '无', row.reviewStatus]));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Filter */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <DateInput label="外勤日期" colors={colors} value={dateRange} onChange={setDateRange}/>
          <InlineSelect label="部门" opts={DEPT_OPTS} colors={colors} value={deptFilter} onChange={setDeptFilter}/>
          <EmpSearch label="申请人" colors={colors} minWidth={150} value={applicantFilter} onChange={setApplicantFilter} onEnter={() => setPage(1)}/>
          <EmpSearch label="发起人" colors={colors} minWidth={150} value={initiatorFilter} onChange={setInitiatorFilter} onEnter={() => setPage(1)}/>
          <InlineSelect label="审核状态" opts={REVIEW_OPTS} colors={colors} value={reviewFilter} onChange={setReviewFilter}/>
          <button onClick={() => setShowMore(v => !v)} style={{ ...oBtn(colors, showMore), display: 'flex', alignItems: 'center', gap: 4 }}>更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button onClick={resetFilters} style={oBtn(colors)}>重置</button><button onClick={() => { setSelected(new Set()); setPage(1); }} style={pBtn(colors)}>查询</button></div>
        </div>
        {showMore && <div style={{ marginBottom: 10 }}><span style={{ fontSize: '12px', color: colors.textMuted }}>更多筛选条件可在此扩展</span></div>}
      </div>
      <StatusFilterBar items={statusItems} activeKey={statusFilter} onChange={(key) => { setStatusFilter(key); setSelected(new Set()); setPage(1); }} colors={colors} />
      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <button onClick={handleAddFieldRecord} style={{ ...pBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12}/>发起外勤记录</button>
        <button onClick={() => fieldImportInputRef.current?.click()} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Upload size={12}/>批量导入</button>
        <button onClick={exportCurrentRows} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12}/>导出</button>
        <input ref={fieldImportInputRef} type="file" accept=".csv,.json" onChange={handleImportFieldRecords} style={{ display: 'none' }}/>
        {selected.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selected.size} 条</span>}
      </div>
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, padding: '0 16px', boxSizing: 'border-box' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', position: 'sticky', left: 0, zIndex: 25, borderLeft: 'none' }}>
                <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = someSel; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {COLS.map(c => (
                <th key={c.k} onClick={() => toggleSort(c.k)} style={{ ...thS(colors), width: c.w, minWidth: c.w, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.l}
                    <span style={{ fontSize: '11px', color: sortKey === c.k ? colors.primary : colors.textMuted }}>{getSortMarker(c.k)}</span>
                  </span>
                </th>
              ))}
              <th style={{ ...thS(colors), width: 60, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, ri) => {
              const isSel = selected.has(row.id);
              const bg = isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe;
              return (
                <tr key={row.id} style={{ backgroundColor: bg, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.backgroundColor = bg)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: bg, borderLeft: 'none' }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  <td style={{ ...tdS(colors), width: 70 }}><span style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{row.name}</span></td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.textMuted, fontSize: '11px' }}>{row.empId}</td>
                  <td style={{ ...tdS(colors), width: 75 }}>{row.initiator}</td>
                  <td style={{ ...tdS(colors), width: 105, color: colors.textMuted, fontSize: '11px' }}>{row.initiatorId}</td>
                  <td style={{ ...tdS(colors), width: 95 }}><span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: 9, backgroundColor: colors.badgeGrayBg, color: colors.badgeGrayText }}>{row.source}</span></td>
                  <td style={{ ...tdS(colors), width: 110 }}>{row.dept}</td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.primary, fontSize: '11px' }}>{row.date}</td>
                  <td style={{ ...tdS(colors), width: 130, fontSize: '11px' }}>{row.time}</td>
                  <td style={{ ...tdS(colors), width: 145, color: colors.textMuted, fontSize: '11px' }}>{row.initiateTime}</td>
                  <td style={{ ...tdS(colors), width: 145, color: colors.textMuted, fontSize: '11px' }}>{row.completeTime || <span style={{ color: colors.textMuted }}>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 160, fontSize: '11px', color: colors.textMuted }}>{row.location}</td>
                  <td style={{ ...tdS(colors), width: 100, fontSize: '11px', color: colors.textMuted }}>{row.note || <span style={{ color: colors.textMuted }}>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 75, textAlign: 'center' }}>
                    {row.hasPhoto ? <button onClick={() => setPhotoTarget(row.name)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                      : <span style={{ color: colors.textMuted }}>—</span>}
                  </td>
                  <td style={{ ...tdS(colors), width: 85 }}><StatusBadge status={row.reviewStatus} colors={colors}/></td>
                  <td style={{ ...tdS(colors), width: 60, textAlign: 'center' }}>
                    <button onClick={() => showFieldClockDetail(row)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar total={filteredRows.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} colors={colors}/>
      {photoTarget && <PhotoModal title="外勤照片" onClose={() => setPhotoTarget(null)} colors={colors}/>}
    </div>
  );
}

// ─── Tab 4: 拍照打卡记录 ─────────────────────
function PhotoClockTab({ colors }: { colors: any }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [sortKey, setSortKey] = useState<keyof PhotoRecord>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [rows, setRows] = useState<PhotoRecord[]>([]);
  const [loadError, setLoadError] = useState('');

  const loadPhotoRows = useCallback(async () => {
    try {
      const res = await fetchPhotoClockRecords();
      setRows((res.rows || []) as RealPhotoClockRecord[]);
      setLoadError('');
    } catch (_error) {
      setLoadError('移动端拍照打卡记录连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadPhotoRows();
  }, [loadPhotoRows]);

  const filteredRows = rows.filter(row => {
    const keyword = empFilter.trim().toLowerCase();
    const matchForm = inDateRange(row.date, dateRange)
      && (!deptFilter || row.dept === deptFilter)
      && (!keyword || row.name.toLowerCase().includes(keyword) || row.empId.toLowerCase().includes(keyword))
      && (!reviewFilter || row.reviewStatus === reviewFilter);
    return matchForm && (statusFilter === 'all' || row.reviewStatus === statusFilter || (statusFilter === 'hasPhoto' && row.hasPhoto));
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];

    const normalize = (value: PhotoRecord[keyof PhotoRecord]) => {
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'number') return value;
      const text = String(value ?? '').trim();
      const parsed = Date.parse(text);
      return Number.isNaN(parsed) ? text.toLowerCase() : parsed;
    };

    const left = normalize(av);
    const right = normalize(bv);
    if (left === right) return 0;

    const base = left > right ? 1 : -1;
    return sortOrder === 'asc' ? base : -base;
  });

  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const statusItems = [
    { key: 'all', label: '全部', count: rows.length },
    { key: '已通过', label: '已通过', count: rows.filter(row => row.reviewStatus === '已通过').length },
    { key: '审批中', label: '审批中', count: rows.filter(row => row.reviewStatus === '审批中').length },
    { key: '已拒绝', label: '已拒绝', count: rows.filter(row => row.reviewStatus === '已拒绝').length },
    { key: 'hasPhoto', label: '有照片', count: rows.filter(row => row.hasPhoto).length },
  ];
  const allSel = pagedRows.length > 0 && pagedRows.every(row => selected.has(row.id));
  const someSel = pagedRows.some(row => selected.has(row.id)) && !allSel;
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allSel) pagedRows.forEach(row => next.delete(row.id));
    else pagedRows.forEach(row => next.add(row.id));
    return next;
  });
  const toggleRow = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const resetFilters = () => { setDateRange({ start: '', end: '' }); setDeptFilter(''); setEmpFilter(''); setReviewFilter(''); setStatusFilter('all'); setSelected(new Set()); setPage(1); };
  const COLS: Array<{ k: keyof PhotoRecord; l: string; w: number }> = [
    { k: 'name', l: '姓名', w: 70 },
    { k: 'empId', l: '员工号', w: 88 },
    { k: 'dept', l: '部门', w: 110 },
    { k: 'date', l: '打卡日期', w: 88 },
    { k: 'clockTime', l: '打卡时间', w: 80 },
    { k: 'locateTime', l: '定位时间', w: 80 },
    { k: 'completeTime', l: '完成时间', w: 145 },
    { k: 'location', l: '打卡地点', w: 160 },
    { k: 'note', l: '打卡备注', w: 100 },
    { k: 'hasPhoto', l: '查看图片', w: 75 },
    { k: 'reviewStatus', l: '审核状态', w: 85 },
  ];

  const toggleSort = (key: keyof PhotoRecord) => {
    if (sortKey === key) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const getSortMarker = (key: keyof PhotoRecord) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Filter */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px', flexShrink: 0 }}>
        {loadError && <div style={{ marginBottom: 8, fontSize: '12px', color: colors.danger || '#AA2B3A' }}>{loadError}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DateInput label="打卡日期" colors={colors} value={dateRange} onChange={setDateRange}/>
          <InlineSelect label="部门" opts={DEPT_OPTS} colors={colors} value={deptFilter} onChange={setDeptFilter}/>
          <EmpSearch label="员工" colors={colors} minWidth={150} value={empFilter} onChange={setEmpFilter} onEnter={() => setPage(1)}/>
          <InlineSelect label="审核状态" opts={REVIEW_OPTS} colors={colors} value={reviewFilter} onChange={setReviewFilter}/>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button onClick={resetFilters} style={oBtn(colors)}>重置</button><button onClick={() => { setSelected(new Set()); setPage(1); }} style={pBtn(colors)}>查询</button></div>
        </div>
      </div>
      <StatusFilterBar items={statusItems} activeKey={statusFilter} onChange={(key) => { setStatusFilter(key); setSelected(new Set()); setPage(1); }} colors={colors} />
      {/* Table (no extra action bar per spec – "操作保持现有页面语义，不新增不删减") */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', position: 'sticky', left: 0, zIndex: 25, borderLeft: 'none' }}>
                <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = someSel; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {COLS.map(c => (
                <th key={c.k} onClick={() => toggleSort(c.k)} style={{ ...thS(colors), width: c.w, minWidth: c.w, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.l}
                    <span style={{ fontSize: '11px', color: sortKey === c.k ? colors.primary : colors.textMuted }}>{getSortMarker(c.k)}</span>
                  </span>
                </th>
              ))}
              <th style={{ ...thS(colors), width: 60, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, ri) => {
              const isSel = selected.has(row.id);
              const bg = isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe;
              return (
                <tr key={row.id} style={{ backgroundColor: bg, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.backgroundColor = bg)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: bg, borderLeft: 'none' }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  <td style={{ ...tdS(colors), width: 70 }}><span style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{row.name}</span></td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.textMuted, fontSize: '11px' }}>{row.empId}</td>
                  <td style={{ ...tdS(colors), width: 110 }}>{row.dept}</td>
                  <td style={{ ...tdS(colors), width: 88, color: colors.primary, fontSize: '11px' }}>{row.date}</td>
                  <td style={{ ...tdS(colors), width: 80 }}>{row.clockTime}</td>
                  <td style={{ ...tdS(colors), width: 80, color: colors.textMuted, fontSize: '11px' }}>{row.locateTime}</td>
                  <td style={{ ...tdS(colors), width: 145, color: colors.textMuted, fontSize: '11px' }}>{row.completeTime}</td>
                  <td style={{ ...tdS(colors), width: 160, fontSize: '11px', color: colors.textMuted }}>{row.location}</td>
                  <td style={{ ...tdS(colors), width: 100, fontSize: '11px', color: colors.textMuted }}>{row.note || <span style={{ color: colors.textMuted }}>—</span>}</td>
                  <td style={{ ...tdS(colors), width: 75, textAlign: 'center' }}>
                    {row.hasPhoto ? <button onClick={() => setPhotoTarget({ name: row.name, photoUrl: row.photoUrl, photoTakenAt: row.photoTakenAt || row.completeTime, note: row.note })} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                      : <span style={{ color: colors.textMuted }}>—</span>}
                  </td>
                  <td style={{ ...tdS(colors), width: 85 }}><StatusBadge status={row.reviewStatus} colors={colors}/></td>
                  <td style={{ ...tdS(colors), width: 60, textAlign: 'center' }}>
                    <button onClick={() => showPhotoClockDetail(row)} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar total={filteredRows.length} page={page} pageSize={pageSize} totalPages={totalPages} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} colors={colors}/>
      {photoTarget && <PhotoModal title="拍照打卡照片" target={photoTarget} onClose={() => setPhotoTarget(null)} colors={colors}/>}
    </div>
  );
}

// ─── Main Component ───────────────────────────
export default function ClockInRecords() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const TABS: { v: TabType; label: string; path: string }[] = [
    { v: 'original', label: '原始打卡记录', path: '/attendance/clock-records' },
    { v: 'makeup', label: '补卡记录', path: '/attendance/clock-makeup' },
    { v: 'field', label: '外勤记录', path: '/attendance/clock-field' },
    { v: 'photo', label: '拍照打卡记录', path: '/attendance/clock-photo' },
  ];

  const activeTab = TABS.find(t => t.path === location.pathname)?.v
    ?? (location.pathname.includes('clock-move') ? 'photo' : 'original');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.v}
            onClick={() => navigate(t.path)}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === t.v ? 600 : 400,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: activeTab === t.v ? colors.primary : colors.textMuted,
              borderBottom: `2px solid ${activeTab === t.v ? colors.primary : 'transparent'}`,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      {activeTab === 'original' && <OriginalClockTab colors={colors}/>}
      {activeTab === 'makeup' && <MakeupClockTab colors={colors}/>}
      {activeTab === 'field' && <FieldWorkTab colors={colors}/>}
      {activeTab === 'photo' && <PhotoClockTab colors={colors}/>}
    </div>
  );
}
