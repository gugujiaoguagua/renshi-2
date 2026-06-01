import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchExternalRecords, fetchSettingsPeople, fetchStatItems, saveExternalRecords, type ExternalRecord as RealExternalRecord, type StatItemRecord } from '../api/realData';
import { currentMonthLabel } from '../utils/date';
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, Search,
  Plus, Upload, Download, Trash2, Info, Settings2, GripVertical, Minus,
} from 'lucide-react';

// ─── Types ───────────────────────────────────
type ExternalRecord = RealExternalRecord;
type EmployeeOption = { name: string; employeeNo: string; department: string };

type ColDef = { key: string; label: string; width: number; visible: boolean };

const ALL_COLS_DEFAULT: ColDef[] = [
  { key: 'module',     label: '应用模块', width: 100, visible: true },
  { key: 'employeeName', label: '员工姓名', width: 90, visible: true },
  { key: 'employeeNo', label: '员工号', width: 90, visible: true },
  { key: 'dept', label: '部门', width: 110, visible: true },
  { key: 'attendDate', label: '考勤日期', width: 100, visible: true },
  { key: 'period',     label: '考勤周期', width: 100, visible: true },
  { key: 'statItem',   label: '统计项',   width: 120, visible: true },
  { key: 'statValue',  label: '统计项值', width: 90,  visible: true },
  { key: 'creator',    label: '创建人',   width: 80,  visible: true },
  { key: 'createTime', label: '创建时间', width: 145, visible: true },
  { key: 'modifier',   label: '修改人',   width: 80,  visible: true },
  { key: 'modifyTime', label: '修改时间', width: 145, visible: true },
];

// ─── Constants ───────────────────────────────
const MODULE_OPTIONS = ['基础考勤', '薪资核算', '假期管理', '绩效管理'];
const BIZ_TYPE_OPTIONS = ['工时', '天数', '金额', '次数'];
const PERIOD_OPTIONS = Array.from({ length: 4 }, (_, index) => {
  const date = new Date();
  date.setMonth(date.getMonth() - index);
  return currentMonthLabel(date);
});
const STAT_ITEMS = ['正班工时', '加班工时', '餐补工时', '外部加班工时', '津贴工时', '请假天数', '出差天数'];
const DEPT_OPTIONS = ['产品研发中心', '产品运营部', '研发设计一部', '研发设计二部', '工艺开发部', '技术支持部'];

// ─── Mock Data ────────────────────────────────
const RECORDS: ExternalRecord[] = [];

function peopleRowsToExternalOptions(rows: Array<Array<unknown>>): EmployeeOption[] {
  return rows
    .map(row => ({
      name: String(row[0] ?? '').trim(),
      employeeNo: String(row[1] ?? '').trim(),
      department: String(row[2] ?? '').trim(),
    }))
    .filter(row => row.name && row.employeeNo);
}

function statItemsForExternal(items: StatItemRecord[]) {
  const enabled = items
    .filter(item => item.enabled !== false && (item.externalEnabled || item.isCustom || item.category === '自定义'))
    .map(item => item.name)
    .filter(Boolean);
  return enabled.length ? enabled : STAT_ITEMS;
}

// ─── Helpers ─────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

function downloadExternalCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
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

const pBtn = (colors: any): React.CSSProperties => ({ padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: colors.primary, color: '#fff', whiteSpace: 'nowrap' });
const oBtn = (colors: any, active?: boolean, danger?: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: '12px', borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent', whiteSpace: 'nowrap',
  border: `1px solid ${danger ? '#FCA5A5' : active ? colors.primary : colors.inputBorder}`,
  color: danger ? '#DC2626' : active ? colors.primary : colors.text,
});
const thS = (colors: any): React.CSSProperties => ({ padding: '8px 10px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, backgroundColor: colors.tableHeaderBg, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 20 });
const tdS = (colors: any): React.CSSProperties => ({ padding: '7px 10px', fontSize: '12px', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const pgS = (colors: any, active: boolean): React.CSSProperties => ({ minWidth: 24, height: 24, padding: '0 5px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 4, backgroundColor: active ? colors.primary : 'transparent', color: active ? '#fff' : colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const inS = (colors: any): React.CSSProperties => ({ padding: '5px 10px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' });

// ─── Simple Dropdown ──────────────────────────
function SimpleSelect({ label, options, colors, value, onChange }: { label: string; options: string[]; colors: any; value?: string; onChange?: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [innerValue, setInnerValue] = useState('');
  const val = value ?? innerValue;
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const setValue = (next: string) => {
    if (onChange) onChange(next);
    else setInnerValue(next);
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${open ? colors.primary : colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, cursor: 'pointer', minWidth: 110 }}>
        <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
        <span style={{ flex: 1, fontSize: '12px', color: val ? colors.text : colors.textMuted }}>{val || '请选择'}</span>
        {val ? <X size={10} onClick={e => { e.stopPropagation(); setValue(''); }} style={{ color: colors.textMuted, flexShrink: 0 }}/> : <ChevronDown size={10} style={{ color: colors.textMuted, flexShrink: 0 }}/>}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 130, overflow: 'hidden' }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { setValue(opt); setOpen(false); }}
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
function ColSettingsModal({ cols, onClose, onApply, colors }: {
  cols: ColDef[]; onClose: () => void; onApply: (cols: ColDef[], freeze: number) => void; colors: any;
}) {
  const [localCols, setLocalCols] = useState<ColDef[]>(cols.map(c => ({ ...c })));
  const [freeze, setFreeze] = useState(1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragEnd = () => {
    if (dragIdx !== null && dragOver !== null && dragIdx !== dragOver) {
      const next = [...localCols]; const [moved] = next.splice(dragIdx, 1); next.splice(dragOver, 0, moved); setLocalCols(next);
    }
    setDragIdx(null); setDragOver(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 12, width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>表头设置</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setLocalCols(ALL_COLS_DEFAULT.map(c => ({ ...c })))} style={{ fontSize: '12px', color: colors.primary, border: 'none', background: 'transparent', cursor: 'pointer' }}>恢复默认</button>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={15}/></button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: `1px solid ${colors.divider}`, gap: 10 }}>
          <span style={{ fontSize: '12px', color: colors.text, flex: 1 }}>冻结前</span>
          <button onClick={() => setFreeze(v => Math.max(0, v - 1))} style={{ width: 26, height: 26, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Minus size={11}/></button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.primary, minWidth: 22, textAlign: 'center' }}>{freeze}</span>
          <button onClick={() => setFreeze(v => Math.min(4, v + 1))} style={{ width: 26, height: 26, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Plus size={11}/></button>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>列</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '6px 18px', fontSize: '11px', color: colors.textMuted }}>显示字段 · 拖拽调整顺序</div>
          {localCols.map((col, idx) => {
            const isDragging = dragIdx === idx; const isOver = dragOver === idx;
            return (
              <div key={col.key} draggable
                onDragStart={() => setDragIdx(idx)} onDragEnter={() => setDragOver(idx)}
                onDragOver={e => e.preventDefault()} onDragEnd={onDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px', cursor: 'grab', opacity: isDragging ? 0.4 : 1, borderTop: isOver && !isDragging ? `2px solid ${colors.primary}` : '2px solid transparent' }}
                onMouseEnter={e => !isDragging && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => !isDragging && (e.currentTarget.style.backgroundColor = 'transparent')}>
                <GripVertical size={13} style={{ color: colors.textMuted, flexShrink: 0 }}/>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={col.visible} onChange={() => setLocalCols(p => p.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>
                  <span style={{ fontSize: '12px', color: colors.text }}>{col.label}</span>
                </label>
                {idx < freeze && <span style={{ fontSize: '10px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>冻结</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={oBtn(colors)}>取消</button>
          <button onClick={() => { onApply(localCols, freeze); onClose(); }} style={pBtn(colors)}>确定</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Data Modal ───────────────────────────
function AddDataModal({
  colors,
  statItems,
  employees,
  onClose,
  onSave,
}: {
  colors: any;
  statItems: string[];
  employees: EmployeeOption[];
  onClose: () => void;
  onSave: (record: ExternalRecord) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [module, setModule] = useState(MODULE_OPTIONS[0]);
  const [attendDate, setAttendDate] = useState(today);
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0]);
  const [statItem, setStatItem] = useState(statItems[0] || '');
  const [statValue, setStatValue] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const matchedEmployee = employees.find(employee => `${employee.name} / ${employee.employeeNo}` === employeeQuery || employee.employeeNo === employeeQuery || employee.name === employeeQuery);

  useEffect(() => {
    if (!statItem && statItems[0]) setStatItem(statItems[0]);
  }, [statItem, statItems]);

  const save = async () => {
    if (!matchedEmployee) {
      window.alert('请先通过姓名或工号选择员工');
      return;
    }
    if (!statItem || !statValue) {
      window.alert('请填写统计项和统计项值');
      return;
    }
    const nowText = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const record: ExternalRecord = {
      id: Date.now(),
      module,
      attendDate,
      period,
      statItem,
      statValue,
      employeeName: matchedEmployee.name,
      employeeNo: matchedEmployee.employeeNo,
      empId: matchedEmployee.employeeNo,
      dept: matchedEmployee.department,
      creator: '后台维护',
      createTime: nowText,
      modifier: '',
      modifyTime: '',
    };
    try {
      setSaving(true);
      await onSave(record);
      onClose();
    } catch (_error) {
      window.alert('保存失败：外部数据接口未连接成功');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 12, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>新增外部数据</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={15}/></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: '应用模块', el: <select value={module} onChange={e => setModule(e.target.value)} style={{ ...inS(colors), flex: 1 }}>{MODULE_OPTIONS.map(o => <option key={o}>{o}</option>)}</select> },
            { label: '考勤日期', el: <input type="date" value={attendDate} onChange={e => setAttendDate(e.target.value)} style={{ ...inS(colors), flex: 1 }}/> },
            { label: '考勤周期', el: <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...inS(colors), flex: 1 }}>{PERIOD_OPTIONS.map(o => <option key={o}>{o}</option>)}</select> },
            { label: '统计项',   el: <select value={statItem} onChange={e => setStatItem(e.target.value)} style={{ ...inS(colors), flex: 1 }}>{statItems.map(o => <option key={o}>{o}</option>)}</select> },
            { label: '统计项值', el: <input value={statValue} onChange={e => setStatValue(e.target.value)} placeholder="请输入数值或文本" style={{ ...inS(colors), flex: 1 }}/> },
            { label: '员工',     el: <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}><Search size={12} style={{ color: colors.textMuted }}/><input list="external-employee-options" value={employeeQuery} onChange={e => setEmployeeQuery(e.target.value)} placeholder="搜索员工姓名或工号" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }}/><datalist id="external-employee-options">{employees.map(employee => <option key={employee.employeeNo} value={`${employee.name} / ${employee.employeeNo}`}>{employee.department}</option>)}</datalist></div> },
          ].map(({ label, el }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '12px', color: colors.text, width: 65, flexShrink: 0, textAlign: 'right' }}>{label}</span>
              {el}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={oBtn(colors)}>取消</button>
          <button onClick={save} disabled={saving} style={{ ...pBtn(colors), opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Modal ─────────────────────────────
function ImportModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 12, width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>导入外部数据</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={15}/></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${colors.divider}`, gap: 0 }}>
          {[['1', '上传文件'], ['2', '数据预览'], ['3', '完成']].map(([n, lbl], i) => {
            const active = step === i + 1; const done = step > i + 1;
            return (
              <React.Fragment key={n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, backgroundColor: done || active ? colors.primary : colors.inputBorder, color: done || active ? '#fff' : colors.textMuted }}>{done ? '✓' : n}</div>
                  <span style={{ fontSize: '12px', color: active ? colors.text : colors.textMuted, whiteSpace: 'nowrap' }}>{lbl}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, backgroundColor: colors.divider, margin: '0 10px' }}/>}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ padding: '24px 20px' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '12px', color: colors.textMuted, backgroundColor: colors.statCardBg, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Info size={13} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }}/>
                <span>导入的外部数据需在月考勤汇总页执行"核算考勤"后方可生效。</span>
              </div>
              <div style={{ border: `2px dashed ${colors.inputBorder}`, borderRadius: 8, padding: '28px 0', textAlign: 'center', cursor: 'pointer' }} onClick={() => document.getElementById('ext-file')?.click()}>
                <Upload size={26} style={{ color: colors.textMuted, marginBottom: 8 }}/>
                <p style={{ fontSize: '13px', color: colors.text, marginBottom: 4 }}>{file ? file.name : '点击或拖拽文件至此区域'}</p>
                <p style={{ fontSize: '11px', color: colors.textMuted }}>支持 .xlsx / .csv 格式，文件大小不超过 10MB</p>
                <input id="ext-file" type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}/>
              </div>
              <a href="#" style={{ fontSize: '12px', color: colors.primary, textDecoration: 'underline' }}>下载导入模板</a>
            </div>
          )}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '13px', color: colors.text, marginBottom: 4 }}>文件解析成功，共读取 <strong>4</strong> 条记录</p>
              <p style={{ fontSize: '12px', color: colors.textMuted }}>错误 0 条，请确认后提交导入</p>
            </div>
          )}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '13px', color: colors.text, marginBottom: 4 }}>导入完成！成功写入 4 条记录</p>
              <p style={{ fontSize: '12px', color: colors.textMuted }}>请返回月考勤汇总执行"核算考勤"使数据生效。</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={oBtn(colors)}>取消</button>
          {step < 3 && <button onClick={() => setStep(s => (s + 1) as any)} disabled={step === 1 && !file} style={{ ...pBtn(colors), opacity: step === 1 && !file ? 0.5 : 1 }}>{step === 1 ? '下一步' : '确认导入'}</button>}
          {step === 3 && <button onClick={onClose} style={pBtn(colors)}>完成</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────
export default function ExternalDataManagement() {
  const { colors } = useTheme();
  const [empSearch, setEmpSearch] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [cols, setCols] = useState<ColDef[]>(ALL_COLS_DEFAULT);
  const [showColSettings, setShowColSettings] = useState(false);
  const [showAddData, setShowAddData] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [rows, setRows] = useState<ExternalRecord[]>([]);
  const [statItems, setStatItems] = useState<string[]>(STAT_ITEMS);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [bizTypeFilter, setBizTypeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [statItemFilter, setStatItemFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const loadExternalRows = useCallback(async () => {
    try {
      const res = await fetchExternalRecords();
      setRows(res.rows || []);
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadExternalRows();
  }, [loadExternalRows]);

  useEffect(() => {
    fetchStatItems()
      .then(res => setStatItems(statItemsForExternal(res.rows || [])))
      .catch(() => setStatItems(STAT_ITEMS));
    fetchSettingsPeople()
      .then(res => setEmployees(peopleRowsToExternalOptions(res.rows || [])))
      .catch(() => setEmployees([]));
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = empSearch.trim().toLowerCase();
    return rows.filter(row => {
      const bizMatched = !bizTypeFilter || String(row.statItem || '').includes(bizTypeFilter) || String(row.statValue || '').includes(bizTypeFilter);
      const deptMatched = !deptFilter || String(row.dept || '').includes(deptFilter) || row.creator.includes(deptFilter) || row.module.includes(deptFilter);
      const keywordMatched = !keyword
        || row.creator.toLowerCase().includes(keyword)
        || row.module.toLowerCase().includes(keyword)
        || String(row.employeeName || '').toLowerCase().includes(keyword)
        || String(row.employeeNo || row.empId || '').toLowerCase().includes(keyword)
        || String(row.statItem || '').toLowerCase().includes(keyword)
        || String(row.statValue || '').toLowerCase().includes(keyword);
      return keywordMatched
        && (!moduleFilter || row.module === moduleFilter)
        && bizMatched
        && (!periodFilter || row.period === periodFilter)
        && (!statItemFilter || row.statItem === statItemFilter)
        && deptMatched
        && (!dateStart || row.attendDate >= dateStart)
        && (!dateEnd || row.attendDate <= dateEnd);
    });
  }, [rows, empSearch, moduleFilter, bizTypeFilter, periodFilter, statItemFilter, deptFilter, dateStart, dateEnd]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const visibleCols = cols.filter(c => c.visible);
  const allSelected = filteredRows.length > 0 && selected.size === filteredRows.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredRows.map(r => r.id)));
  const toggleRow = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : null); if (sortDir === 'desc') setSortKey(null); }
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = (a as any)[sortKey], bv = (b as any)[sortKey];
    if (!av) return 1; if (!bv) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const pagedRows = useMemo(() => sortedRows.slice((page - 1) * pageSize, page * pageSize), [sortedRows, page, pageSize]);

  const getPages = (): (number | '...')[] => totalPages <= 7
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [1, 2, 3, '...', totalPages];

  const resetFilters = () => {
    setModuleFilter('');
    setBizTypeFilter('');
    setPeriodFilter('');
    setStatItemFilter('');
    setDeptFilter('');
    setDateStart('');
    setDateEnd('');
    setEmpSearch('');
    setSelected(new Set());
    setPage(1);
  };
  const exportRows = () => downloadExternalCsv('外部数据.csv', visibleCols.map(col => col.label), filteredRows.map(row => visibleCols.map(col => String((row as any)[col.key] ?? ''))));
  const saveRows = async (nextRows: ExternalRecord[]) => {
    const saved = await saveExternalRecords(nextRows);
    setRows(saved.rows || nextRows);
    setSourceFile(saved.sourceFile || '员工主数据 + 小程序移动端 API');
    setLoadError('');
  };
  const addExternalRecord = async (record: ExternalRecord) => {
    await saveRows([record, ...rows]);
    setSelected(new Set([record.id]));
    setPage(1);
  };
  const deleteRows = () => {
    if (!selected.size) return;
    const nextRows = rows.filter(row => !selected.has(row.id));
    saveRows(nextRows).catch(() => setLoadError('外部数据删除保存失败，请检查后端服务'));
    setSelected(new Set());
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>

      {/* ── Info bar ──────────────────────── */}
      <div style={{ margin: '12px 16px 0', backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '9px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
        <Info size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }}/>
        <span style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
          外部数据导入后，需在<strong>月考勤汇总</strong>页面执行"核算考勤"操作，数据方可参与统计计算并更新汇总结果。
        </span>
      </div>

      {/* ── Filter bar ────────────────────── */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', marginTop: 10, flexShrink: 0 }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <SimpleSelect label="应用模块" options={MODULE_OPTIONS} colors={colors} value={moduleFilter} onChange={setModuleFilter}/>
          <SimpleSelect label="业务类型" options={BIZ_TYPE_OPTIONS} colors={colors} value={bizTypeFilter} onChange={setBizTypeFilter}/>
          {/* 考勤日期 range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>考勤日期:</span>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ ...inS(colors), border: 'none', padding: 0, width: 108 }}/>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ ...inS(colors), border: 'none', padding: 0, width: 108 }}/>
          </div>
          <SimpleSelect label="考勤周期" options={PERIOD_OPTIONS} colors={colors} value={periodFilter} onChange={setPeriodFilter}/>
          {/* 员工 search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth: 150 }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>员工:</span>
            <Search size={11} style={{ color: colors.textMuted }}/>
            <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="输入姓名或工号"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, minWidth: 70 }}/>
          </div>
          {/* 更多筛选 */}
          <button onClick={() => setShowMore(v => !v)} style={{ ...oBtn(colors, showMore), display: 'flex', alignItems: 'center', gap: 4 }}>
            更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={resetFilters} style={oBtn(colors)}>重置</button>
            <button onClick={() => { setSelected(new Set()); setPage(1); }} style={pBtn(colors)}>查询</button>
          </div>
        </div>
        {/* Row 2 (expanded) */}
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <SimpleSelect label="统计项" options={statItems} colors={colors} value={statItemFilter} onChange={setStatItemFilter}/>
            <SimpleSelect label="部门" options={DEPT_OPTIONS} colors={colors} value={deptFilter} onChange={setDeptFilter}/>
          </div>
        )}
      </div>

      {/* ── Action buttons ────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', flexShrink: 0, flexWrap: 'wrap', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}` }}>
        <button onClick={() => setShowAddData(true)} style={{ ...pBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={12}/>新增数据
        </button>
        <button onClick={() => setShowImport(true)} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Upload size={12}/>导入
        </button>
        <button onClick={exportRows} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Download size={12}/>导出
        </button>
        <button
          onClick={deleteRows}
          disabled={selected.size === 0}
          style={{ ...oBtn(colors, false, true), display: 'flex', alignItems: 'center', gap: 4, opacity: selected.size === 0 ? 0.45 : 1, cursor: selected.size === 0 ? 'not-allowed' : 'pointer' }}>
          <Trash2 size={12}/>删除
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {selected.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selected.size} 条</span>}
          <button onClick={() => setShowColSettings(true)} style={{ ...oBtn(colors, showColSettings), display: 'flex', alignItems: 'center', gap: 4 }}>
            <Settings2 size={12}/>表头设置
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              {/* Checkbox */}
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', position: 'sticky', top: 0, left: 0, zIndex: 25 }}>
                <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {visibleCols.map(col => (
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
              <th style={{ ...thS(colors), width: 60, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 2} style={{ textAlign: 'center', padding: '64px 0', color: colors.textMuted, fontSize: '13px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: colors.statCardBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Info size={20} style={{ color: colors.textMuted }}/>
                    </div>
                    <span>暂无外部数据</span>
                    <span style={{ fontSize: '12px' }}>可通过"新增数据"或"导入"添加记录</span>
                  </div>
                </td>
              </tr>
            ) : sortedRows.map((row, ri) => {
              const isSelected = selected.has(row.id);
              return (
                <tr key={row.id}
                  style={{ backgroundColor: isSelected ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => !isSelected && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSelected && (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: isSelected ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  {visibleCols.map(col => {
                    const v = (row as any)[col.key];
                    let content: React.ReactNode = v ?? '—';
                    if (col.key === 'module') content = <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: colors.badgeBlueBg, color: colors.badgeBlueText }}>{v}</span>;
                    else if (col.key === 'statValue') content = <span style={{ fontWeight: 500 }}>{v}</span>;
                    else if (!v) content = <span style={{ color: colors.textMuted }}>—</span>;
                    return <td key={col.key} style={{ ...tdS(colors), width: col.width, minWidth: col.width, borderLeft: `1px solid ${colors.tableBorder}` }}>{content}</td>;
                  })}
                  <td style={{ ...tdS(colors), width: 60, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>
                    <button style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>编辑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Bottom bar ────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{totalCount}笔</span>
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={12}/></button>
        {getPages().map((p, i) =>
          p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
            : <button key={p} style={pgS(colors, page === p)} onClick={() => setPage(p as number)}>{p}</button>
        )}
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={12}/></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); }}}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}/>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      {/* ── Modals ────────────────────────── */}
      {showColSettings && <ColSettingsModal cols={cols} onClose={() => setShowColSettings(false)} onApply={(newCols) => setCols(newCols)} colors={colors}/>}
      {showAddData && <AddDataModal colors={colors} statItems={statItems} employees={employees} onClose={() => setShowAddData(false)} onSave={addExternalRecord}/>}
      {showImport && <ImportModal colors={colors} onClose={() => setShowImport(false)}/>}
    </div>
  );
}
