import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchDailyAttendanceEmployees, saveDailyAttendanceEmployees, type DailyAttendanceEmployee as RealDailyEmployee } from '../api/realData';
import {
  Calendar, Search, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, X, Settings2, Filter, Upload, Plus, Trash2,
  Info, RotateCcw, Download, Lock, AlertCircle, CheckCircle,
  GripVertical,
} from 'lucide-react';

// ─── Types ───────────────────────────────────
type ViewMode = 'main' | 'import';
type ImportStep = 1 | 2 | 3;
type ModalType = 'clock-patch' | 'field-trip' | 'leave' | 'overtime' | 'field-out' | 'calc-range' | null;

type DailyEmployee = RealDailyEmployee;

type Trip = { id: number; fromCity: string; toCity: string; startDate: string; startTime: string; endDate: string; endTime: string; tripType: '往返' | '单程' };

type DailyFilters = {
  dept: string;
  attendGroup: string;
  shift: string;
  empSearch: string;
  dateType: string;
  attendResult: string;
  lockStatus: string;
  confirmStatus: string;
};

// ─── Constants ───────────────────────────────
const DEPT_OPTIONS = ['产品研发中心', '产品运营部', '研发设计一部', '研发设计二部', '直营建连店', '工艺开发部', '技术支持部', '直营样品组', '技术服务组'];
const ATTEND_GROUPS = ['华托大厦考勤组', '综合考勤组', '研发中心考勤组', '工艺部考勤组'];
const SHIFTS = ['早七点半到五点半', '早八点半到五点半', '早十点半到六点半', '早十二点到八点', '早九点半到八点'];
const CITIES = ['上海', '北京', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '苏州'];
const CLOCK_TYPES = ['上班打卡', '下班打卡', '加班打卡', '外出打卡'];
const LEAVE_TYPES = ['年假', '事假', '病假', '婚假', '产假', '陪产假', '丧假', '调休假'];
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// Calendar event markers
const CAL_EVENTS: Record<string, '请假' | '外务' | '节假'> = {
  '2026-05-01': '节假', '2026-05-04': '节假', '2026-05-05': '节假',
  '2026-05-09': '请假', '2026-05-15': '外务', '2026-05-22': '请假',
  '2026-06-07': '请假', '2026-06-16': '节假', '2026-06-22': '外务',
};
const EVENT_COLORS = { 请假: '#F59E0B', 外务: '#0891B2', 节假: '#DC2626' };

// Configurable columns (shown in ColPanel, all always visible)
const SETTABLE_COLS = [
  { key: 'name',         label: '姓名' },
  { key: 'empId',        label: '员工号' },
  { key: 'date',         label: '日期' },
  { key: 'dept',         label: '部门' },
  { key: 'position',     label: '岗位' },
  { key: 'bizGroup',     label: '业务分组' },
  { key: 'deptFullPath', label: '部门全路径' },
  { key: 'regularDate',  label: '转正日期' },
  { key: 'attendGroup',  label: '考勤组' },
  { key: 'shiftName',    label: '班次名称' },
  { key: 'dateType',     label: '日期类型' },
  { key: 'weekday',      label: '星期' },
  { key: 'attendResult', label: '考勤结果' },
  { key: 'anomalyDesc',  label: '异常说明' },
  { key: 'taskSummary',  label: '勤务概要' },
  { key: 'normalHours',  label: '正班时长(小时)' },
  { key: 'lateMinutes',  label: '迟到时长(分钟)' },
];

const EMPLOYEES: DailyEmployee[] = [];

// ─── Hooks ───────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

// ─── Calendar helpers ────────────────────────
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const total = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();
  const days: { y: number; m: number; d: number; cur: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    days.push({ y: py, m: pm, d: prevTotal - i, cur: false });
  }
  for (let i = 1; i <= total; i++) days.push({ y: year, m: month, d: i, cur: true });
  const rem = 42 - days.length;
  for (let i = 1; i <= rem; i++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    days.push({ y: ny, m: nm, d: i, cur: false });
  }
  return days;
}
function addMonths(year: number, month: number, n: number) {
  let m = month + n; let y = year;
  while (m > 11) { m -= 12; y++; }
  while (m < 0) { m += 12; y--; }
  return { y, m };
}

// ─── Date Range Picker ───────────────────────
function DateRangePicker({ colors, initStart, initEnd, onApply, onClose }: {
  colors: any; initStart: string; initEnd: string;
  onApply: (s: string, e: string) => void; onClose: () => void;
}) {
  const [leftYear, setLeftYear] = useState(2026);
  const [leftMonth, setLeftMonth] = useState(4); // May
  const [selStart, setSelStart] = useState<string>(initStart);
  const [selEnd, setSelEnd] = useState<string>(initEnd);
  const [hoverDate, setHoverDate] = useState<string>('');

  const { y: rightYear, m: rightMonth } = addMonths(leftYear, leftMonth, 1);

  const prevMonth = () => { const r = addMonths(leftYear, leftMonth, -1); setLeftYear(r.y); setLeftMonth(r.m); };
  const nextMonth = () => { const r = addMonths(leftYear, leftMonth, 1); setLeftYear(r.y); setLeftMonth(r.m); };

  const handleDayClick = (ds: string) => {
    if (!selStart || (selStart && selEnd)) { setSelStart(ds); setSelEnd(''); }
    else if (ds < selStart) { setSelEnd(selStart); setSelStart(ds); }
    else { setSelEnd(ds); }
  };

  const inRange = (ds: string) => {
    const end = selEnd || hoverDate;
    if (!selStart || !end) return false;
    const lo = selStart < end ? selStart : end;
    const hi = selStart < end ? end : selStart;
    return ds > lo && ds < hi;
  };

  const isStart = (ds: string) => ds === selStart;
  const isEnd = (ds: string) => ds === (selEnd || (hoverDate > selStart ? hoverDate : ''));

  const applyShortcut = (s: string, e: string) => { setSelStart(s); setSelEnd(e); };

  const today = '2026-05-07';
  const startOfWeek = '2026-05-04'; const endOfWeek = '2026-05-10';
  const startOfMonth = '2026-05-01'; const endOfMonth = '2026-05-31';
  const startLastWeek = '2026-04-27'; const endLastWeek = '2026-05-03';
  const startLastMonth = '2026-04-01'; const endLastMonth = '2026-04-30';

  const renderMonth = (year: number, month: number) => {
    const days = getCalendarDays(year, month);
    return (
      <div style={{ width: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{year}年{MONTH_NAMES[month]}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: 4 }}>
          {WEEKDAYS.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: '11px', color: colors.textMuted, padding: '3px 0', fontWeight: 500 }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
          {days.map((day, i) => {
            const ds = toDateStr(day.y, day.m, day.d);
            const started = isStart(ds);
            const ended = isEnd(ds) && selEnd !== '';
            const ranged = inRange(ds);
            const isSat = i % 7 === 5; const isSun = i % 7 === 6;
            const isWeekend = isSat || isSun;
            const event = CAL_EVENTS[ds];
            return (
              <div key={i}
                onClick={() => handleDayClick(ds)}
                onMouseEnter={() => selStart && !selEnd && setHoverDate(ds)}
                style={{
                  width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRadius: started || ended ? '50%' : ranged ? 0 : 2,
                  backgroundColor: started || ended ? colors.primary : ranged ? `${colors.primary}20` : 'transparent',
                  color: !day.cur ? colors.textMuted : (started || ended) ? '#fff' : isWeekend ? colors.primary : colors.text,
                  cursor: 'pointer', fontSize: '12px', position: 'relative',
                  opacity: !day.cur ? 0.4 : 1,
                  fontWeight: started || ended ? 600 : 400,
                }}>
                {day.d}
                {event && (
                  <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: EVENT_COLORS[event], position: 'absolute', bottom: 1 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 500, marginTop: 4,
      backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
      borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.15)', padding: 16,
    }} onMouseLeave={() => setHoverDate('')}>
      {/* Two calendars */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left nav */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button onClick={prevMonth} style={{ ...iconNavBtn(colors), alignSelf: 'flex-start', marginBottom: 28 }}><ChevronLeft size={14} /></button>
        </div>
        {renderMonth(leftYear, leftMonth)}
        <div style={{ width: 1, backgroundColor: colors.divider, alignSelf: 'stretch', margin: '0 4px' }} />
        {renderMonth(rightYear, rightMonth)}
        {/* Right nav */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button onClick={nextMonth} style={{ ...iconNavBtn(colors), alignSelf: 'flex-end', marginBottom: 28 }}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: colors.divider, margin: '12px -16px' }} />

      {/* Footer: legend + shortcuts + confirm */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 10 }}>
          {Object.entries(EVENT_COLORS).map(([label, color]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '11px', color: colors.textMuted }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
        {/* Shortcuts */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[
            { label: '今天',  s: today, e: today },
            { label: '本周',  s: startOfWeek, e: endOfWeek },
            { label: '本月',  s: startOfMonth, e: endOfMonth },
            { label: '上周',  s: startLastWeek, e: endLastWeek },
            { label: '上月',  s: startLastMonth, e: endLastMonth },
          ].map(sc => (
            <button key={sc.label} onClick={() => applyShortcut(sc.s, sc.e)}
              style={{ padding: '3px 8px', fontSize: '11px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer', color: colors.text }}>
              {sc.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { if (selStart && selEnd) { onApply(selStart, selEnd); onClose(); } }}
          style={{ padding: '4px 16px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: selStart && selEnd ? colors.primary : colors.inputBorder, color: '#fff' }}>
          确定
        </button>
      </div>
    </div>
  );
}

function iconNavBtn(colors: any): React.CSSProperties {
  return { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textMuted };
}

// ─── Column settings panel (drag-to-reorder) ─
function ColPanel({ colors, colOrder, onColOrderChange, freezeCount, onFreezeChange, onCancel, onApply }: {
  colors: any; colOrder: string[];
  onColOrderChange: (o: string[]) => void;
  freezeCount: number; onFreezeChange: (n: number) => void;
  onCancel: () => void; onApply: () => void;
}) {
  const [localOrder, setLocalOrder] = useState<string[]>([...colOrder]);
  const [localFreeze, setLocalFreeze] = useState(freezeCount);
  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (i: number) => { dragIdx.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const newOrder = [...localOrder];
    const [item] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(i, 0, item);
    dragIdx.current = i;
    setLocalOrder(newOrder);
  };
  const handleDrop = () => { dragIdx.current = null; };

  const handleApply = () => { onColOrderChange(localOrder); onFreezeChange(localFreeze); onApply(); };

  return (
    <div style={{
      position: 'absolute', top: 34, right: 0, zIndex: 300, width: 240,
      backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
      borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${colors.divider}` }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>表头设置</span>
        <button onClick={onCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={13} /></button>
      </div>
      {/* Freeze control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${colors.divider}` }}>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>冻结前</span>
        <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, overflow: 'hidden' }}>
          <button onClick={() => setLocalFreeze(Math.max(0, localFreeze - 1))}
            style={{ width: 22, height: 22, border: 'none', backgroundColor: colors.inputBg, cursor: 'pointer', color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>−</button>
          <span style={{ padding: '0 8px', fontSize: '12px', color: colors.text, borderLeft: `1px solid ${colors.inputBorder}`, borderRight: `1px solid ${colors.inputBorder}`, lineHeight: '22px' }}>{localFreeze}</span>
          <button onClick={() => setLocalFreeze(Math.min(localOrder.length, localFreeze + 1))}
            style={{ width: 22, height: 22, border: 'none', backgroundColor: colors.inputBg, cursor: 'pointer', color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>+</button>
        </div>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>列</span>
      </div>
      {/* Column list with drag handles */}
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
        {localOrder.map((key, i) => {
          const col = SETTABLE_COLS.find(c => c.key === key);
          if (!col) return null;
          const isFrozen = i < localFreeze;
          return (
            <div key={key} draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={handleDrop}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 14px', cursor: 'grab', fontSize: '12px', color: colors.text,
                borderLeft: isFrozen ? `3px solid ${colors.primary}` : '3px solid transparent',
                userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              <span>{col.label}</span>
              <GripVertical size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: `1px solid ${colors.divider}` }}>
        <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
        <button onClick={handleApply} style={primaryBtn(colors)}>确定</button>
      </div>
    </div>
  );
}

// ─── Shared filter select ─────────────────────
function FilterSelect({ label, options, colors, value, onChange }: { label: string; options: string[]; colors: any; value?: string; onChange?: (value: string) => void }) {
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
      <div onClick={() => setOpen(v => !v)} style={inputBox(colors, open)}>
        {label && <span style={{ color: colors.text, fontSize: '12px', whiteSpace: 'nowrap' }}>{label}</span>}
        <span style={{ flex: 1, color: val ? colors.text : colors.textMuted, marginLeft: label ? 4 : 0, fontSize: '12px' }}>{val || '请选择'}</span>
        {val ? <X size={11} style={{ color: colors.textMuted }} onClick={e => { e.stopPropagation(); setValue(''); }} />
          : <ChevronDown size={11} style={{ color: colors.textMuted }} />}
      </div>
      {open && (
        <div style={ddBox(colors)}>
          {options.map(opt => (
            <div key={opt} onClick={() => { setValue(opt); setOpen(false); }} style={ddItem(colors, val === opt)}
              onMouseEnter={e => { if (val !== opt) (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover; }}
              onMouseLeave={e => { if (val !== opt) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Flat dropdown button
function FlatDropdown({ label, items, colors, primary }: { label: string; items: { label: string; action?: () => void }[]; colors: any; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={primary ? primaryBtn(colors) : outlineBtn(colors)}>
        {label} <ChevronDown size={11} style={{ marginLeft: 3 }} />
      </button>
      {open && (
        <div style={{ ...ddBox(colors), minWidth: 130, zIndex: 300 }}>
          {items.map((item, i) => (
            <div key={i} onClick={() => { item.action?.(); setOpen(false); }}
              style={{ ...ddItem(colors, false), padding: '8px 14px' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Nested dropdown
type NestedItem = { label: string; children?: { label: string; action?: () => void }[]; action?: () => void };
function NestedDropdown({ label, items, colors, tooltip }: { label: string; items: NestedItem[]; colors: any; tooltip?: string }) {
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => { setOpen(false); setHoveredIdx(null); });
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div title={tooltip}>
        <button onClick={() => setOpen(v => !v)} style={primaryBtn(colors)}>
          {label} <ChevronDown size={11} style={{ marginLeft: 3 }} />
        </button>
      </div>
      {open && (
        <div style={{ ...ddBox(colors), minWidth: 140, zIndex: 300 }}>
          {items.map((item, i) => (
            <div key={i} style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
              <div onClick={() => { if (!item.children) { item.action?.(); setOpen(false); } }}
                style={{ ...ddItem(colors, false), padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: hoveredIdx === i ? colors.tableRowHover : 'transparent' }}>
                {item.label}
                {item.children && <ChevronRight size={12} style={{ color: colors.textMuted }} />}
              </div>
              {item.children && hoveredIdx === i && (
                <div style={{ position: 'absolute', left: '100%', top: 0, zIndex: 400, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 120, overflow: 'hidden' }}>
                  {item.children.map((sub, si) => (
                    <div key={si} onClick={() => { sub.action?.(); setOpen(false); setHoveredIdx(null); }}
                      style={{ ...ddItem(colors, false), padding: '8px 14px' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                      {sub.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modals ──────────────────────────────────
function LeaveModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [applicant, setApplicant] = useState(''); const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState(''); const [reason, setReason] = useState('');
  const [typeOpen, setTypeOpen] = useState(false); const typeRef = useRef<HTMLDivElement>(null);
  useClickOutside(typeRef, () => setTypeOpen(false));
  return (
    <div style={overlay}>
      <div style={{ ...mbox(colors), width: 520 }}>
        <div style={mhead(colors)}><span style={{ fontWeight: 600, fontSize: '14px', color: colors.text }}>添加请假记录</span><button onClick={onClose} style={iconBtn(colors)}><X size={15} /></button></div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={frow}><label style={flabel(colors)}><span style={star}>*</span>申请人</label><div style={{ ...srchBox(colors), flex: 1 }}><input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="姓名/员工工号模糊搜索" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /><Search size={12} style={{ color: colors.textMuted }} /></div></div>
          <div style={frow}><label style={flabel(colors)}>部门</label><div style={{ flex: 1 }}><FilterSelect label="" options={DEPT_OPTIONS} colors={colors} /></div></div>
          <div style={frow}>
            <label style={flabel(colors)}><span style={star}>*</span>假期类型</label>
            <div ref={typeRef} style={{ position: 'relative', flex: 1 }}>
              <div onClick={() => setTypeOpen(v => !v)} style={{ ...inputBox(colors, typeOpen), cursor: 'pointer' }}>
                <span style={{ flex: 1, fontSize: '12px', color: leaveType ? colors.text : colors.textMuted }}>{leaveType || '请选择'}</span><ChevronDown size={11} style={{ color: colors.textMuted }} />
              </div>
              {typeOpen && <div style={{ ...ddBox(colors), left: 0, right: 0, zIndex: 400 }}>{LEAVE_TYPES.map(t => <div key={t} onClick={() => { setLeaveType(t); setTypeOpen(false); }} style={{ ...ddItem(colors, leaveType === t), padding: '8px 12px' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>{t}</div>)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...frow, flex: 1 }}><label style={flabel(colors)}><span style={star}>*</span>开始时间</label><div style={{ ...srchBox(colors), flex: 1 }}><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /></div></div>
            <div style={{ ...frow, flex: 1 }}><label style={flabel(colors)}><span style={star}>*</span>结束时间</label><div style={{ ...srchBox(colors), flex: 1 }}><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /></div></div>
          </div>
          <div style={frow}><label style={flabel(colors)}>请假时长</label><div style={{ ...srchBox(colors), flex: 1 }}><input value={duration} onChange={e => setDuration(e.target.value)} placeholder="自动计算" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /><span style={{ fontSize: '12px', color: colors.textMuted }}>天</span></div></div>
          <div style={frow}><label style={flabel(colors)}>考勤时次</label><span style={{ fontSize: '12px', color: colors.textMuted }}>-</span></div>
          <div style={frow}>
            <label style={{ ...flabel(colors), alignSelf: 'flex-start', paddingTop: 4 }}>请假事由</label>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 256))} rows={4} style={{ width: '100%', resize: 'vertical', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '6px 8px', fontSize: '12px', backgroundColor: colors.inputBg, color: colors.text, outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', bottom: 4, right: 8, fontSize: '11px', color: colors.textMuted }}>{reason.length}/256</span>
            </div>
          </div>
          <div style={frow}><label style={flabel(colors)}>附件</label><button style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Upload size={12} />上传</button></div>
        </div>
        <div style={mfoot(colors)}><button onClick={onClose} style={outlineBtn(colors)}>取消</button><button style={primaryBtn(colors)}>提交</button></div>
      </div>
    </div>
  );
}

function ClockPatchModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [applicant, setApplicant] = useState(''); const [clockDate, setClockDate] = useState('');
  const [clockType, setClockType] = useState(''); const [reason, setReason] = useState('');
  const [typeOpen, setTypeOpen] = useState(false); const typeRef = useRef<HTMLDivElement>(null);
  useClickOutside(typeRef, () => setTypeOpen(false));
  return (
    <div style={overlay}>
      <div style={{ ...mbox(colors), width: 480 }}>
        <div style={mhead(colors)}><span style={{ fontWeight: 600, fontSize: '14px', color: colors.text }}>添加补卡记录</span><button onClick={onClose} style={iconBtn(colors)}><X size={15} /></button></div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={frow}><label style={flabel(colors)}><span style={star}>*</span>申请人</label><div style={{ ...srchBox(colors), flex: 1 }}><input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="姓名/员工工号搜索" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /><Search size={12} style={{ color: colors.textMuted }} /></div></div>
          <div style={frow}><label style={flabel(colors)}><span style={star}>*</span>打卡日期</label><div style={{ ...srchBox(colors), flex: 1 }}><input type="date" value={clockDate} onChange={e => setClockDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /></div></div>
          <div style={frow}>
            <label style={flabel(colors)}><span style={star}>*</span>补卡卡类型</label>
            <div ref={typeRef} style={{ position: 'relative', flex: 1 }}>
              <div onClick={() => setTypeOpen(v => !v)} style={{ ...inputBox(colors, typeOpen), cursor: 'pointer' }}><span style={{ flex: 1, fontSize: '12px', color: clockType ? colors.text : colors.textMuted }}>{clockType || '请选择'}</span><ChevronDown size={11} style={{ color: colors.textMuted }} /></div>
              {typeOpen && <div style={{ ...ddBox(colors), left: 0, right: 0, zIndex: 400 }}>{CLOCK_TYPES.map(t => <div key={t} onClick={() => { setClockType(t); setTypeOpen(false); }} style={{ ...ddItem(colors, clockType === t), padding: '8px 12px' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>{t}</div>)}</div>}
            </div>
          </div>
          <div style={frow}><label style={flabel(colors)}><span style={star}>*</span>补卡原因</label><input value={reason} onChange={e => setReason(e.target.value)} placeholder="请输入补卡原因" style={{ ...srchBox(colors), flex: 1 }} /></div>
          <div style={frow}><label style={flabel(colors)}>上传图片</label><div style={{ flex: 1, border: `1px dashed ${colors.inputBorder}`, borderRadius: 4, minHeight: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: colors.textMuted, fontSize: '12px', backgroundColor: colors.inputBg }}><Upload size={20} style={{ opacity: 0.5 }} /><span>上传</span></div></div>
        </div>
        <div style={mfoot(colors)}><button onClick={onClose} style={outlineBtn(colors)}>取消</button><button style={primaryBtn(colors)}>确定</button></div>
      </div>
    </div>
  );
}

function CitySelect({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ ...miniInput(colors), width: 88, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
        <span style={{ fontSize: '12px', color: value ? colors.text : colors.textMuted }}>{value || '请选择'}</span><ChevronDown size={10} style={{ color: colors.textMuted, flexShrink: 0 }} />
      </div>
      {open && <div style={{ ...ddBox(colors), left: 0, zIndex: 500, minWidth: 90, maxHeight: 160, overflowY: 'auto' }}>{CITIES.map(c => <div key={c} onClick={() => { onChange(c); setOpen(false); }} style={{ ...ddItem(colors, value === c), padding: '6px 10px', fontSize: '12px' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>{c}</div>)}</div>}
    </div>
  );
}

function FieldTripModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [applicant, setApplicant] = useState(''); const [reason, setReason] = useState(''); const [note, setNote] = useState('');
  const [trips, setTrips] = useState<Trip[]>([{ id: 1, fromCity: '', toCity: '', startDate: '', startTime: '', endDate: '', endTime: '', tripType: '往返' }]);
  const addTrip = () => setTrips(p => [...p, { id: Date.now(), fromCity: '', toCity: '', startDate: '', startTime: '', endDate: '', endTime: '', tripType: '往返' }]);
  const removeTrip = (id: number) => setTrips(p => p.filter(t => t.id !== id));
  const updateTrip = (id: number, f: keyof Trip, v: string) => setTrips(p => p.map(t => t.id === id ? { ...t, [f]: v } : t));
  return (
    <div style={overlay}>
      <div style={{ ...mbox(colors), width: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={mhead(colors)}><span style={{ fontWeight: 600, fontSize: '14px', color: colors.text }}>添加出差记录</span><button onClick={onClose} style={iconBtn(colors)}><X size={15} /></button></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={frow}><label style={flabel(colors)}><span style={star}>*</span>申请人</label><div style={{ ...srchBox(colors), flex: 1 }}><input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="姓名/员工工号模糊搜索" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /><Search size={12} style={{ color: colors.textMuted }} /></div></div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}><label style={{ display: 'block', ...flabel(colors), marginBottom: 6 }}><span style={star}>*</span>出差事由</label><div style={{ position: 'relative' }}><textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 256))} rows={3} style={{ width: '100%', resize: 'none', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '6px 8px', fontSize: '12px', backgroundColor: colors.inputBg, color: colors.text, outline: 'none', boxSizing: 'border-box' }} /><span style={{ position: 'absolute', bottom: 4, right: 8, fontSize: '11px', color: colors.textMuted }}>{reason.length}/256</span></div></div>
            <div style={{ flex: 1 }}><label style={{ display: 'block', ...flabel(colors), marginBottom: 6 }}>备注</label><div style={{ position: 'relative' }}><textarea value={note} onChange={e => setNote(e.target.value.slice(0, 256))} placeholder="请输入" rows={3} style={{ width: '100%', resize: 'none', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '6px 8px', fontSize: '12px', backgroundColor: colors.inputBg, color: colors.text, outline: 'none', boxSizing: 'border-box' }} /><span style={{ position: 'absolute', bottom: 4, right: 8, fontSize: '11px', color: colors.textMuted }}>{note.length}/256</span></div></div>
          </div>
          <div style={frow}><label style={flabel(colors)}>上传附件</label><button style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} />上传</button></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><div style={{ width: 3, height: 14, backgroundColor: colors.primary, borderRadius: 2 }} /><span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>行程信息</span></div>
            <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                  <thead><tr style={{ backgroundColor: colors.tableHeaderBg }}>{['行程', '出发城市', '到达城市', '开始时间', '结束时间', '单程往返', '操作'].map(h => <th key={h} style={{ ...th(colors), padding: '7px 10px', fontSize: '12px' }}>{h}</th>)}</tr></thead>
                  <tbody>{trips.map((trip, idx) => (
                    <tr key={trip.id} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                      <td style={{ ...td(colors), padding: '7px 10px', whiteSpace: 'nowrap' }}>行程{idx + 1}</td>
                      <td style={{ ...td(colors), padding: '5px 8px' }}><CitySelect value={trip.fromCity} onChange={v => updateTrip(trip.id, 'fromCity', v)} colors={colors} /></td>
                      <td style={{ ...td(colors), padding: '5px 8px' }}><CitySelect value={trip.toCity} onChange={v => updateTrip(trip.id, 'toCity', v)} colors={colors} /></td>
                      <td style={{ ...td(colors), padding: '5px 8px' }}><div style={{ display: 'flex', gap: 3 }}><input type="date" value={trip.startDate} onChange={e => updateTrip(trip.id, 'startDate', e.target.value)} style={miniInput(colors)} /><input type="time" value={trip.startTime} onChange={e => updateTrip(trip.id, 'startTime', e.target.value)} style={{ ...miniInput(colors), width: 65 }} /></div></td>
                      <td style={{ ...td(colors), padding: '5px 8px' }}><div style={{ display: 'flex', gap: 3 }}><input type="date" value={trip.endDate} onChange={e => updateTrip(trip.id, 'endDate', e.target.value)} style={miniInput(colors)} /><input type="time" value={trip.endTime} onChange={e => updateTrip(trip.id, 'endTime', e.target.value)} style={{ ...miniInput(colors), width: 65 }} /></div></td>
                      <td style={{ ...td(colors), padding: '5px 8px' }}><div style={{ display: 'flex', gap: 8 }}>{(['往返', '单程'] as const).map(t => <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: '12px', color: colors.text }}><input type="radio" checked={trip.tripType === t} onChange={() => updateTrip(trip.id, 'tripType', t)} style={{ accentColor: colors.primary }} />{t}</label>)}</div></td>
                      <td style={{ ...td(colors), padding: '5px 8px' }}>{trips.length > 1 && <button onClick={() => removeTrip(trip.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.badgeRedText }}><Trash2 size={13} /></button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <button onClick={addTrip} style={{ width: '100%', padding: '8px', fontSize: '12px', border: 'none', borderTop: `1px dashed ${colors.inputBorder}`, cursor: 'pointer', backgroundColor: colors.inputBg, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Plus size={13} />添加行程</button>
            </div>
          </div>
        </div>
        <div style={mfoot(colors)}><button onClick={onClose} style={outlineBtn(colors)}>取消</button><button style={primaryBtn(colors)}>提交</button></div>
      </div>
    </div>
  );
}

function CalcRangeModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [empSearch, setEmpSearch] = useState('');
  return (
    <div style={overlay}>
      <div style={{ ...mbox(colors), width: 460 }}>
        <div style={mhead(colors)}><span style={{ fontWeight: 600, fontSize: '14px', color: colors.text }}>选择核算范围</span><button onClick={onClose} style={iconBtn(colors)}><X size={15} /></button></div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={frow}><label style={flabel(colors)}>考勤日期</label><div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ ...srchBox(colors), flex: 1 }}><input type="date" defaultValue="2026-05-06" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /></div><span style={{ color: colors.textMuted, fontSize: '12px' }}>→</span><div style={{ ...srchBox(colors), flex: 1 }}><input type="date" defaultValue="2026-05-06" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /></div></div></div>
          <div style={frow}><label style={flabel(colors)}>员工</label><div style={{ ...srchBox(colors), flex: 1 }}><input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="输入姓名或选择人员" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }} /><Search size={12} style={{ color: colors.textMuted }} /></div></div>
          <div style={frow}><label style={flabel(colors)}>部门</label><div style={{ flex: 1 }}><FilterSelect label="" options={DEPT_OPTIONS} colors={colors} /></div></div>
          <div style={frow}><label style={flabel(colors)}>考勤组</label><div style={{ flex: 1 }}><FilterSelect label="" options={ATTEND_GROUPS} colors={colors} /></div></div>
          <div style={frow}><label style={flabel(colors)}>锁定状态</label><div style={{ flex: 1 }}><FilterSelect label="" options={['全部', '已锁定', '未锁定']} colors={colors} /></div></div>
          <div style={frow}><label style={flabel(colors)}>班次类型</label><div style={{ flex: 1 }}><FilterSelect label="" options={['全部', ...SHIFTS]} colors={colors} /></div></div>
          <div style={frow}><label style={flabel(colors)}>所选范围</label><div style={{ flex: 1 }}><FilterSelect label="" options={['全部', '仅当前页', '自定义']} colors={colors} /></div></div>
        </div>
        <div style={mfoot(colors)}><button onClick={onClose} style={outlineBtn(colors)}>取消</button><button style={primaryBtn(colors)}>结算</button></div>
      </div>
    </div>
  );
}

// ─── Import wizard ───────────────────────────
function ImportWizard({ colors, onBack }: { colors: any; onBack: () => void }) {
  const [step, setStep] = useState<ImportStep>(1);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [validateTab, setValidateTab] = useState<'pass' | 'fail'>('fail');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ padding: '10px 20px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: colors.primary, display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={13} />返回</button>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>日考勤导入</span>
      </div>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[{ num: 1, label: '上传文件' }, { num: 2, label: '业务校验' }, { num: 3, label: '导入结果' }].map((s, i) => {
            const done = step > s.num; const active = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, backgroundColor: done || active ? colors.primary : colors.inputBg, color: done || active ? '#fff' : colors.textMuted, border: `2px solid ${done || active ? colors.primary : colors.inputBorder}` }}>
                    {done ? <CheckCircle size={14} /> : s.num}
                  </div>
                  <span style={{ fontSize: '13px', color: active ? colors.primary : done ? colors.text : colors.textMuted, fontWeight: active ? 600 : 400 }}>{s.label}</span>
                </div>
                {i < 2 && <div style={{ width: 80, height: 1, backgroundColor: step > s.num ? colors.primary : colors.divider, margin: '0 16px' }} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {step === 1 && (
          <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: '13px', color: colors.text, marginBottom: 10 }}>1. 下载模板</p>
              <button style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}><Download size={13} />标准模板</button>
            </div>
            <div>
              <p style={{ fontSize: '13px', color: colors.text, marginBottom: 10 }}>2. 上传Excel簿格</p>
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) setUploadedFile(file.name); }}
                onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xls,.xlsx'; i.onchange = (e: any) => { if (e.target.files[0]) setUploadedFile(e.target.files[0].name); }; i.click(); }}
                style={{ border: `2px dashed ${dragOver ? colors.primary : colors.inputBorder}`, borderRadius: 8, minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', backgroundColor: dragOver ? colors.badgeRedBg : colors.inputBg, transition: 'all 0.15s' }}>
                <div style={{ width: 48, height: 48, backgroundColor: colors.cardBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.cardBorder}` }}><Upload size={22} style={{ color: colors.primary }} /></div>
                {uploadedFile ? <span style={{ fontSize: '13px', color: colors.primary }}>{uploadedFile}</span>
                  : <><span style={{ fontSize: '13px', color: colors.textMuted }}><span style={{ color: colors.primary }}>点击</span>或拖拽到此区域上传</span><span style={{ fontSize: '11px', color: colors.textMuted }}>文件最大20M，支持扩展.xls (2003以上版本)</span></>}
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, gap: 8 }}>
              <div style={{ display: 'flex', gap: 0, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, overflow: 'hidden' }}>
                {[{ key: 'pass', label: '校验通过(0)', color: '#059669' }, { key: 'fail', label: `校验不通过(${EMPLOYEES.length})`, color: '#DC2626' }].map(tab => (
                  <button key={tab.key} onClick={() => setValidateTab(tab.key as any)} style={{ padding: '5px 14px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: validateTab === tab.key ? colors.tableHeaderBg : 'transparent', color: tab.color, fontWeight: validateTab === tab.key ? 600 : 400 }}>{tab.label}</button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button style={outlineBtn(colors)}>重新导入</button>
                <button style={outlineBtn(colors)}>导出不通过数据</button>
                <button style={primaryBtn(colors)}>重新校验</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 5 }}>
                    <th style={{ ...th(colors), width: 36 }}>#</th>
                    <th style={{ ...th(colors), minWidth: 200 }}>错误信息</th>
                    {['姓名', '员工号', '日期', '部门', '岗位', '部门全路径', '转正日期', '考勤组'].map(h => <th key={h} style={th(colors)}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(validateTab === 'fail' ? EMPLOYEES : []).map((emp, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}>
                      <td style={{ ...td(colors), color: colors.textMuted, textAlign: 'center' }}>{i + 1}</td>
                      <td style={td(colors)}><span style={{ color: '#DC2626', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} style={{ flexShrink: 0 }} />考勤数据已锁定，不可修改</span></td>
                      <td style={{ ...td(colors), color: colors.primary, cursor: 'pointer' }}>{emp.name}</td>
                      <td style={{ ...td(colors), color: colors.textMuted, fontSize: '11px' }}>{emp.empId}</td>
                      <td style={td(colors)}>{emp.date}</td>
                      <td style={td(colors)}>{emp.dept}</td>
                      <td style={td(colors)}>{emp.position}</td>
                      <td style={{ ...td(colors), maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.deptFullPath}</td>
                      <td style={{ ...td(colors), color: colors.textMuted }}>{emp.regularDate || '-'}</td>
                      <td style={td(colors)}>{emp.attendGroup}</td>
                    </tr>
                  ))}
                  {validateTab === 'pass' && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, fontSize: '13px', color: colors.textMuted }}>暂无通过校验的数据</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 16 }}>
            <CheckCircle size={56} style={{ color: '#059669' }} />
            <p style={{ fontSize: '16px', fontWeight: 600, color: colors.text }}>导入完成</p>
            <p style={{ fontSize: '13px', color: colors.textMuted }}>数据已成功导入，请前往列表查看</p>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: step === 2 ? 'space-between' : 'flex-end', padding: '12px 24px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}` }}>
        {step === 2 && <button onClick={() => setStep(1)} style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={12} />上一步</button>}
        {step === 3 ? <button onClick={onBack} style={primaryBtn(colors)}>完成</button>
          : <div style={{ display: 'flex', gap: 8 }}>
            {step === 2 && <button style={{ ...outlineBtn(colors), color: colors.textMuted }}>仅通过校验继续上传</button>}
            <button onClick={onBack} style={outlineBtn(colors)}>取消</button>
            <button onClick={() => setStep(s => (s < 3 ? s + 1 as ImportStep : s))} style={primaryBtn(colors)}>{step === 1 ? '下一步' : '开始导入'}</button>
          </div>}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────
export default function DailyAttendanceStats() {
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [modal, setModal] = useState<ModalType>(null);
  const [showMoreFilter, setShowMoreFilter] = useState(false);
  const [hideResigned, setHideResigned] = useState(false);
  const [showColPanel, setShowColPanel] = useState(false);
  const [colOrder, setColOrder] = useState<string[]>(SETTABLE_COLS.map(c => c.key));
  const [freezeCount, setFreezeCount] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateStart, setDateStart] = useState('2026-05-06');
  const [dateEnd, setDateEnd] = useState('2026-05-06');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [checkedRows, setCheckedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [jumpPage, setJumpPage] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [employees, setEmployees] = useState<DailyEmployee[]>([]);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');
  const [initialDateRange, setInitialDateRange] = useState({ start: '2026-05-06', end: '2026-05-06' });

  const loadDailyAttendance = useCallback(async (syncDateRange = false) => {
    try {
      const res = await fetchDailyAttendanceEmployees();
      const rows = res.rows || [];
      setEmployees(rows);
      const dates = rows.map(row => row.date).filter(Boolean).sort();
      if (dates.length) {
        const range = { start: dates[0], end: dates[dates.length - 1] };
        setInitialDateRange(range);
        if (syncDateRange) {
          setDateStart(range.start);
          setDateEnd(range.end);
        }
      }
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadDailyAttendance(true);
  }, [loadDailyAttendance]);

  const DEFAULT_FILTERS: DailyFilters = {
    dept: '',
    attendGroup: '',
    shift: '',
    empSearch: '',
    dateType: '',
    attendResult: '',
    lockStatus: '',
    confirmStatus: '',
  };

  const [draftFilters, setDraftFilters] = useState<DailyFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DailyFilters>(DEFAULT_FILTERS);

  const colPanelRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  useClickOutside(datePickerRef, () => setShowDatePicker(false));

  const updateDraftFilter = <K extends keyof DailyFilters>(key: K, value: DailyFilters[K]) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
    setJumpPage('');
    setCheckedRows(new Set());
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setActiveStatFilter(null);
    setDateStart(initialDateRange.start);
    setDateEnd(initialDateRange.end);
    setSortCol(null);
    setSortDir('asc');
    setCurrentPage(1);
    setJumpPage('');
    setCheckedRows(new Set());
  };

  const handleRefresh = async () => {
    await loadDailyAttendance(true);
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setActiveStatFilter(null);
    setSortCol(null);
    setSortDir('asc');
    setCurrentPage(1);
    setJumpPage('');
    setCheckedRows(new Set());
    setShowColPanel(false);
  };

  const baseFilteredEmployees = employees.filter(emp => {
    const keyword = appliedFilters.empSearch.trim().toLowerCase();
    const matchKeyword = !keyword || emp.name.toLowerCase().includes(keyword) || emp.empId.toLowerCase().includes(keyword);
    const matchDept = !appliedFilters.dept || emp.dept === appliedFilters.dept;
    const matchGroup = !appliedFilters.attendGroup || emp.attendGroup === appliedFilters.attendGroup;
    const matchShift = !appliedFilters.shift || emp.shiftName === appliedFilters.shift;
    const matchDateType = !appliedFilters.dateType || emp.dateType === appliedFilters.dateType;
    const matchResult = !appliedFilters.attendResult || appliedFilters.attendResult === '全部' || emp.attendResult === appliedFilters.attendResult;
    const matchLock = !appliedFilters.lockStatus || appliedFilters.lockStatus === '全部' || (appliedFilters.lockStatus === '已锁定' ? emp.confirmStatus === '已确认' : emp.confirmStatus !== '已确认');
    const matchConfirm = !appliedFilters.confirmStatus || appliedFilters.confirmStatus === '全部' || emp.confirmStatus === appliedFilters.confirmStatus;
    const matchDateRange = emp.date >= dateStart && emp.date <= dateEnd;
    const matchResigned = !hideResigned || Boolean(emp.empId);

    return matchKeyword && matchDept && matchGroup && matchShift && matchDateType && matchResult && matchLock && matchConfirm && matchDateRange && matchResigned;
  });

  const matchesStatFilter = (emp: DailyEmployee) => {
    if (!activeStatFilter || activeStatFilter === 'all') return true;
    if (activeStatFilter === 'normal') return emp.attendResult === '正常';
    if (activeStatFilter === 'unplanned') return emp.anomalyDesc.includes('未排班') || emp.shiftName.includes('未排班');
    if (activeStatFilter === 'absent') return emp.anomalyDesc.includes('旷工');
    if (activeStatFilter === 'late') return emp.lateMinutes > 0 || emp.anomalyDesc.includes('迟到');
    return true;
  };
  const filteredEmployees = baseFilteredEmployees.filter(matchesStatFilter);
  const applyStatFilter = (key: string) => {
    setActiveStatFilter(current => current === key ? null : key);
    setCurrentPage(1);
    setJumpPage('');
    setCheckedRows(new Set());
  };

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (!sortCol) return 0;
    const av = `${(a as any)[sortCol] ?? ''}`;
    const bv = `${(b as any)[sortCol] ?? ''}`;
    const result = av.localeCompare(bv, 'zh-CN', { numeric: true, sensitivity: 'base' });
    return sortDir === 'asc' ? result : -result;
  });

  const totalCount = sortedEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedEmployees = sortedEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allChecked = pagedEmployees.length > 0 && pagedEmployees.every(emp => checkedRows.has(emp.empId));

  const toggleAll = () => {
    if (allChecked) {
      setCheckedRows(prev => {
        const next = new Set(prev);
        pagedEmployees.forEach(emp => next.delete(emp.empId));
        return next;
      });
      return;
    }
    setCheckedRows(prev => {
      const next = new Set(prev);
      pagedEmployees.forEach(emp => next.add(emp.empId));
      return next;
    });
  };

  const handleSort = (key: string) => { if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(key); setSortDir('asc'); } };
  const getPages = (): (number | '...')[] => totalPages <= 7 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [1, 2, 3, 4, 5, '...', totalPages];

  const colDefs = colOrder.map(k => SETTABLE_COLS.find(c => c.key === k)!).filter(Boolean);

  const selectedEmpIds = checkedRows.size ? checkedRows : new Set(pagedEmployees.map(emp => emp.empId));
  const persistEmployees = (nextRows: DailyEmployee[]) => {
    saveDailyAttendanceEmployees(nextRows).then(res => {
      setSourceFile(res.sourceFile || '本地持久化数据 data-store.json');
      setLoadError('');
    }).catch(() => setLoadError('保存失败：持久化服务不可用'));
  };
  const updateEmployeesPersistently = (producer: (current: DailyEmployee[]) => DailyEmployee[]) => {
    setEmployees(current => {
      const next = producer(current);
      persistEmployees(next);
      return next;
    });
    setCheckedRows(new Set());
  };
  const mutateTargetRows = (updater: (emp: DailyEmployee) => DailyEmployee) => {
    updateEmployeesPersistently(current => current.map(emp => selectedEmpIds.has(emp.empId) ? updater(emp) : emp));
  };
  const lockRows = (scope: 'page' | 'all') => {
    const ids = new Set((scope === 'all' ? sortedEmployees : pagedEmployees).map(emp => emp.empId));
    updateEmployeesPersistently(current => current.map(emp => ids.has(emp.empId) ? { ...emp, confirmStatus: '已确认' } : emp));
  };
  const unlockRows = () => mutateTargetRows(emp => ({ ...emp, confirmStatus: '未确认' }));
  const clearDeduction = (keyword: string) => mutateTargetRows(emp => ({ ...emp, anomalyDesc: emp.anomalyDesc.replace(keyword, '').trim(), lateMinutes: keyword === '迟到' ? 0 : emp.lateMinutes }));
  const deleteTargetRows = () => {
    updateEmployeesPersistently(current => current.filter(emp => !selectedEmpIds.has(emp.empId)));
  };
  const exportRows = (targetRows: DailyEmployee[]) => {
    const headers = colDefs.map(col => col.label);
    const csv = [headers, ...targetRows.map(emp => colDefs.map(col => String((emp as any)[col.key] ?? '')))]
      .map(row => row.map(cell => /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '日考勤统计.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderCell = (emp: DailyEmployee, key: string): React.ReactNode => {
    if (key === 'name') return <span style={{ color: colors.primary, cursor: 'pointer', fontWeight: 500 }}>{emp.name}</span>;
    if (key === 'attendResult') {
      const map: Record<string, { bg: string; text: string }> = { '正常': { bg: colors.badgeGreenBg, text: colors.badgeGreenText }, '异常': { bg: colors.badgeRedBg, text: colors.badgeRedText }, '休息': { bg: colors.badgeGrayBg, text: colors.badgeGrayText } };
      const s = map[emp.attendResult] || map['休息'];
      return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: s.bg, color: s.text }}>{emp.attendResult}</span>;
    }
    if (key === 'anomalyDesc') return <span style={{ fontSize: '11px', color: emp.anomalyDesc ? colors.badgeRedText : colors.textMuted }}>{emp.anomalyDesc || '-'}</span>;
    if (key === 'empId') return <span style={{ color: colors.textMuted, fontSize: '11px' }}>{emp.empId || '-'}</span>;
    if (key === 'regularDate') return <span style={{ color: colors.textMuted, fontSize: '11px' }}>{emp.regularDate || '-'}</span>;
    if (key === 'normalHours') return <span style={{ color: emp.normalHours > 0 ? colors.text : colors.textMuted }}>{emp.normalHours}</span>;
    if (key === 'lateMinutes') return <span style={{ color: emp.lateMinutes > 0 ? '#DC2626' : colors.textMuted }}>{emp.lateMinutes}</span>;
    return (emp as any)[key] || '-';
  };

  if (viewMode === 'import') return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><ImportWizard colors={colors} onBack={() => setViewMode('main')} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, position: 'relative' }}>

      {/* ── Filter bar ───────────────────── */}
      <div style={{ padding: '10px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Date range picker trigger */}
          <div ref={datePickerRef} style={{ position: 'relative' }}>
            <div onClick={() => setShowDatePicker(v => !v)}
              style={{ ...inputBox(colors, showDatePicker), cursor: 'pointer', gap: 6 }}>
              <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>* 考勤日期</span>
              <Calendar size={13} style={{ color: colors.primary, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: colors.text }}>{dateStart}</span>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>→</span>
              <span style={{ fontSize: '12px', color: colors.text }}>{dateEnd}</span>
            </div>
            {showDatePicker && (
              <DateRangePicker colors={colors} initStart={dateStart} initEnd={dateEnd}
                onApply={(s, e) => { setDateStart(s); setDateEnd(e); }}
                onClose={() => setShowDatePicker(false)} />
            )}
          </div>

          <FilterSelect label="部门" options={DEPT_OPTIONS} value={draftFilters.dept} onChange={value => updateDraftFilter('dept', value)} colors={colors} />
          <div style={{ ...inputBox(colors, false), minWidth: 170 }}>
            <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>员工</span>
            <input value={draftFilters.empSearch} onChange={e => updateDraftFilter('empSearch', e.target.value)} placeholder="请输入姓名或选择人员"
              onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, marginLeft: 4, minWidth: 0 }} />
            <Search size={12} style={{ color: colors.textMuted }} />
            <span style={{ fontSize: '11px', color: colors.textMuted, marginLeft: 2 }}>A</span>
          </div>
          <FilterSelect label="考勤组" options={ATTEND_GROUPS} value={draftFilters.attendGroup} onChange={value => updateDraftFilter('attendGroup', value)} colors={colors} />
          <FilterSelect label="班次" options={SHIFTS} value={draftFilters.shift} onChange={value => updateDraftFilter('shift', value)} colors={colors} />
          <button style={{ ...outlineBtn(colors), padding: '5px 8px' }} title="刷新" onClick={handleRefresh}><RotateCcw size={13} /></button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={outlineBtn(colors)} onClick={resetFilters}>重置</button>
            <button style={primaryBtn(colors)} onClick={applyFilters}>查询</button>
            <button onClick={() => setShowMoreFilter(v => !v)}
              style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: showMoreFilter ? colors.primary : colors.text, borderColor: showMoreFilter ? colors.primary : colors.inputBorder }}>
              更多筛选 <ChevronDown size={11} style={{ transform: showMoreFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          </div>
        </div>
        {showMoreFilter && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` }}>
            <FilterSelect label="日期类型" options={['工作日', '休息日', '节假日']} value={draftFilters.dateType} onChange={value => updateDraftFilter('dateType', value)} colors={colors} />
            <FilterSelect label="考勤结果" options={['全部', '正常', '异常', '休息']} value={draftFilters.attendResult} onChange={value => updateDraftFilter('attendResult', value)} colors={colors} />
            <FilterSelect label="锁定状态" options={['全部', '已锁定', '未锁定']} value={draftFilters.lockStatus} onChange={value => updateDraftFilter('lockStatus', value)} colors={colors} />
            <FilterSelect label="确认状态" options={['全部', '已确认', '未确认']} value={draftFilters.confirmStatus} onChange={value => updateDraftFilter('confirmStatus', value)} colors={colors} />
          </div>
        )}
      </div>

      {(sourceFile || loadError) && (
        <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 6, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', flexShrink: 0 }}>
          {sourceFile ? `已连接真实数据源：${sourceFile}` : ''}
          {loadError ? ` ${loadError}` : ''}
        </div>
      )}

      {/* ── Stats bar ────────────────────── */}
      <div style={{ backgroundColor: colors.statCardBg, borderBottom: `1px solid ${colors.divider}`, padding: '7px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: '总人数(人次)', value: baseFilteredEmployees.length, color: colors.text },
          { key: 'normal', label: '打卡', value: baseFilteredEmployees.filter(emp => emp.attendResult === '正常').length, color: '#059669' },
          { key: 'unplanned', label: '未排班', value: baseFilteredEmployees.filter(emp => emp.anomalyDesc.includes('未排班') || emp.shiftName.includes('未排班')).length, color: colors.textMuted },
          { key: 'absent', label: '旷工', value: baseFilteredEmployees.filter(emp => emp.anomalyDesc.includes('旷工')).length, color: '#DC2626' },
          { key: 'late', label: '迟到', value: baseFilteredEmployees.filter(emp => emp.lateMinutes > 0 || emp.anomalyDesc.includes('迟到')).length, color: colors.primary },
        ].map((s, i, arr) => {
          const active = activeStatFilter === s.key || (!activeStatFilter && s.key === 'all');
          return (
            <div key={i} onClick={() => applyStatFilter(s.key)} style={{ display: 'flex', alignItems: 'baseline', gap: 4, padding: '2px 8px', marginRight: 8, borderRight: i < arr.length - 1 ? `1px solid ${colors.divider}` : 'none', cursor: 'pointer', borderRadius: 4, backgroundColor: active ? `${colors.primary}12` : 'transparent' }}>
              <span style={{ fontSize: '12px', color: active ? colors.primary : colors.textMuted }}>{s.label}</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <NestedDropdown label="核算考勤" tooltip="对当天人员考勤情况进行统计，包含打卡，早退等，敬请期待" colors={colors} items={[
          { label: '补卡',     children: [{ label: '添加记录', action: () => setModal('clock-patch') }, { label: '发起流程', action: () => setModal('clock-patch') }] },
          { label: '请假',     children: [{ label: '添加记录', action: () => setModal('leave') }, { label: '发起流程', action: () => setModal('leave') }] },
          { label: '外出',     children: [{ label: '添加记录', action: () => setModal('field-out') }, { label: '发起流程', action: () => setModal('field-out') }] },
          { label: '出差',     children: [{ label: '添加记录', action: () => setModal('field-trip') }, { label: '发起流程', action: () => setModal('field-trip') }] },
          { label: '变更班次', children: [{ label: '单人变更', action: () => mutateTargetRows(emp => ({ ...emp, shiftName: '已变更班次' })) }, { label: '批量变更', action: () => mutateTargetRows(emp => ({ ...emp, shiftName: '已批量变更班次' })) }] },
          { label: '核销异常', action: () => mutateTargetRows(emp => ({ ...emp, anomalyDesc: '', attendResult: '正常' })) },
        ]} />
        <FlatDropdown label="处理异常" colors={colors} items={[{ label: '加记异常', action: () => mutateTargetRows(emp => ({ ...emp, anomalyDesc: '手动加记异常', attendResult: '异常' })) }, { label: '请假申请', action: () => setModal('leave') }, { label: '出差申请', action: () => setModal('field-trip') }, { label: '加班申请', action: () => setModal('overtime') }, { label: '外出申请', action: () => setModal('field-out') }, { label: '补卡申请', action: () => setModal('clock-patch') }]} />
        <FlatDropdown label="锁定" colors={colors} items={[{ label: '锁定当前页', action: () => lockRows('page') }, { label: '锁定全部', action: () => lockRows('all') }]} />
        <FlatDropdown label="解扣" colors={colors} items={[{ label: '解除迟到扣除', action: () => clearDeduction('迟到') }, { label: '解除早退扣除', action: () => clearDeduction('早退') }, { label: '解除旷工扣除', action: () => clearDeduction('旷工') }]} />
        <button style={outlineBtn(colors)} onClick={() => setViewMode('import')}>导入</button>
        <FlatDropdown label="导出" colors={colors} items={[{ label: '全部导出', action: () => exportRows(sortedEmployees) }, { label: '自定义导出', action: () => exportRows(pagedEmployees) }]} />
        <FlatDropdown label="更多操作" colors={colors} items={[{ label: '批量确认', action: () => mutateTargetRows(emp => ({ ...emp, confirmStatus: '已确认' })) }, { label: '批量撤销确认', action: () => unlockRows() }, { label: '批量删除记录', action: () => deleteTargetRows() }]} />

        {/* Right controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 核算异常清单 */}
          <span style={{ fontSize: '12px', color: colors.primary, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onClick={() => setModal('calc-range')}>
            核算异常清单<span style={{ backgroundColor: colors.primary, color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: '11px' }}>7</span>
          </span>
          {/* 不看离职人员 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={hideResigned} onChange={e => setHideResigned(e.target.checked)} style={{ accentColor: colors.primary }} />
            不看离职人员
          </label>
          {/* Filter list icon */}
          <button onClick={() => setShowMoreFilter(v => !v)} style={{ ...iconBtnSq(colors), color: showMoreFilter ? colors.primary : colors.textMuted, borderColor: showMoreFilter ? colors.primary : colors.inputBorder }} title="筛选设置">
            <Filter size={13} />
          </button>
          {/* Column settings */}
          <div style={{ position: 'relative' }} ref={colPanelRef}>
            <button onClick={() => setShowColPanel(v => !v)}
              style={{ ...iconBtnSq(colors), color: showColPanel ? colors.primary : colors.textMuted, borderColor: showColPanel ? colors.primary : colors.inputBorder }}>
              <Settings2 size={13} />
            </button>
            {showColPanel && (
              <ColPanel colors={colors} colOrder={colOrder} onColOrderChange={setColOrder}
                freezeCount={freezeCount} onFreezeChange={setFreezeCount}
                onCancel={() => setShowColPanel(false)} onApply={() => setShowColPanel(false)} />
            )}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ ...th(colors), width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ accentColor: colors.primary }} />
              </th>
              {/* Fixed column: 确认状态 */}
              <th style={{ ...th(colors), whiteSpace: 'nowrap' }}>确认状态</th>
              {colDefs.map(col => (
                <th key={col.key} style={{ ...th(colors), cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {col.label}
                    {sortCol === col.key
                      ? sortDir === 'asc' ? <ChevronUp size={11} style={{ color: colors.primary }} /> : <ChevronDown size={11} style={{ color: colors.primary }} />
                      : <span style={{ display: 'inline-flex', flexDirection: 'column', opacity: 0.25 }}><ChevronUp size={9} /><ChevronDown size={9} style={{ marginTop: -3 }} /></span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedEmployees.map((emp, i) => (
              <tr key={emp.empId || `${emp.name}-${i}`}
                style={{ backgroundColor: i % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}`, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                <td style={td(colors)}>
                  <input type="checkbox" checked={checkedRows.has(emp.empId)} onChange={() => setCheckedRows(prev => { const s = new Set(prev); s.has(emp.empId) ? s.delete(emp.empId) : s.add(emp.empId); return s; })} style={{ accentColor: colors.primary }} />
                </td>
                {/* Fixed: 确认状态 */}
                <td style={td(colors)}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: emp.confirmStatus === '已确认' ? colors.badgeBlueBg : colors.badgeGrayBg, color: emp.confirmStatus === '已确认' ? colors.badgeBlueText : colors.badgeGrayText }}>
                    {emp.confirmStatus}
                  </span>
                </td>
                {colDefs.map(col => (
                  <td key={col.key} style={td(colors)}>{renderCell(emp, col.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Bottom bar ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <button onClick={() => setModal('calc-range')} style={outlineBtn(colors)}>校算考勤</button>
        <button onClick={() => mutateTargetRows(emp => ({ ...emp, confirmStatus: '已确认' }))} style={outlineBtn(colors)}>告知</button>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{totalCount}人 共{totalCount}条</span>
        <button style={pagBtn(colors, false)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={12} /></button>
        {getPages().map((p, i) =>
          p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
            : <button key={p} style={pagBtn(colors, currentPage === p)} onClick={() => setCurrentPage(p as number)}>{p}</button>
        )}
        <button style={pagBtn(colors, false)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={12} /></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[50, 100, 200].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setCurrentPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); } }}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      {/* ── Modals ───────────────────────── */}
      {modal === 'clock-patch' && <ClockPatchModal colors={colors} onClose={() => setModal(null)} />}
      {modal === 'field-trip' && <FieldTripModal colors={colors} onClose={() => setModal(null)} />}
      {modal === 'leave' && <LeaveModal colors={colors} onClose={() => setModal(null)} />}
      {modal === 'calc-range' && <CalcRangeModal colors={colors} onClose={() => setModal(null)} />}
      {(modal === 'overtime' || modal === 'field-out') && (
        <div style={overlay}><div style={{ ...mbox(colors), width: 380, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: colors.text, marginBottom: 8 }}>{modal === 'overtime' ? '加班申请' : '外出申请'}</div>
          <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 20 }}>该功能模块开发中，敬请期待</p>
          <button onClick={() => setModal(null)} style={primaryBtn(colors)}>关闭</button>
        </div></div>
      )}
    </div>
  );
}

// ─── Style helpers ───────────────────────────
function inputBox(colors: any, focused: boolean): React.CSSProperties { return { display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${focused ? colors.primary : colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', fontSize: '12px', backgroundColor: colors.inputBg }; }
function primaryBtn(colors: any): React.CSSProperties { return { padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: colors.primary, color: '#fff', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }; }
function outlineBtn(colors: any): React.CSSProperties { return { padding: '5px 12px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent', color: colors.text, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }; }
function iconBtn(colors: any): React.CSSProperties { return { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted }; }
function iconBtnSq(colors: any): React.CSSProperties { return { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textMuted }; }
function ddBox(colors: any): React.CSSProperties { return { position: 'absolute', top: '100%', left: 0, zIndex: 250, marginTop: 4, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }; }
function ddItem(colors: any, active: boolean): React.CSSProperties { return { padding: '8px 12px', fontSize: '12px', cursor: 'pointer', color: active ? colors.primary : colors.text, backgroundColor: active ? colors.badgeRedBg : 'transparent', whiteSpace: 'nowrap', transition: 'background 0.1s' }; }
function th(colors: any): React.CSSProperties { return { padding: '8px 10px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', backgroundColor: colors.tableHeaderBg }; }
function td(colors: any): React.CSSProperties { return { padding: '7px 10px', fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }; }
function pagBtn(colors: any, active: boolean): React.CSSProperties { return { minWidth: 24, height: 24, padding: '0 5px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 4, backgroundColor: active ? colors.primary : 'transparent', color: active ? '#fff' : colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }; }
function miniInput(colors: any): React.CSSProperties { return { padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }; }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
function mbox(colors: any): React.CSSProperties { return { backgroundColor: colors.cardBg, borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }; }
function mhead(colors: any): React.CSSProperties { return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${colors.divider}` }; }
function mfoot(colors: any): React.CSSProperties { return { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: `1px solid ${colors.divider}` }; }
const frow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
function flabel(colors: any): React.CSSProperties { return { fontSize: '12px', color: colors.text, whiteSpace: 'nowrap', width: 72, textAlign: 'right', flexShrink: 0 }; }
function srchBox(colors: any): React.CSSProperties { return { display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', fontSize: '12px', backgroundColor: colors.inputBg }; }
const star: React.CSSProperties = { color: '#DC2626', marginRight: 2 };
