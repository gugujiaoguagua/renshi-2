import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchAttendanceAnomalies, saveAttendanceAnomalies, type AttendanceAnomalyRecord as RealAnomalyRecord } from '../api/realData';

import { useLocation } from 'react-router';
import {
  Search, X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Download, Settings2, Bell, AlertTriangle, RotateCcw,
  Clock, UserX, Eye, Trash2, GripVertical, Plus, Minus,
} from 'lucide-react';

// ─── Types ───────────────────────────────────
type AnomalyRecord = RealAnomalyRecord;

type BizRecord = {
  id: number; name: string; empId: string; dept: string;
  leaveType: string; startTime: string; endTime: string;
  origDuration: string; recalcDuration: string; updatedShift: string;
  reason: string; source: string; approvalStatus: string; cancelStatus: string;
};

type ColDef = { key: string; label: string; width: number; visible: boolean };

// ─── Constants ───────────────────────────────
const DEPT_OPTIONS = ['产品研发中心', '产品运营部', '研发设计一部', '研发设计二部', '工艺开发部', '技术支持部', '直营建连店'];
const ATTEND_GROUPS = ['华托大厦考勤组', '综合考勤组', '研发中心考勤组', '工艺部考勤组'];
const ANOMALY_TYPES = ['全部', '迟到', '旷工', '早退', '未打卡', '未排班'];
const REMARK_MAX_LEN = 300;
const ATTEND_GROUP_BY_DEPT: Record<string, string> = {
  '产品研发中心': '研发中心考勤组',
  '产品运营部': '综合考勤组',
  '研发设计一部': '研发中心考勤组',
  '研发设计二部': '研发中心考勤组',
  '工艺开发部': '工艺部考勤组',
  '技术支持部': '工艺部考勤组',
  '直营建连店': '华托大厦考勤组',
};
const SHIFTS = [


  '早七点半到五点半', '早八点到五点半', '早八点半到五点半', '早九点到六点',
  '早九点到五点半', '早九点半到六点半', '早十点到七点', '早十点半到七点半',
  '早十二点到八点半', '中班十二到九', '晚班六到次日零点', '夜班十到次日六',
  '弹性工作制（9小时）', '弹性工作制（8小时）', '轮班A', '轮班B', '轮班C', '全天排班',
  '早班', '中班', '晚班', '夜班', '无固定班次',
];

const BIZ_COLS_DEFAULT: ColDef[] = [
  { key: 'name',           label: '申请人姓名',   width: 80,  visible: true },
  { key: 'empId',          label: '申请人员工号', width: 105, visible: true },
  { key: 'dept',           label: '部门',         width: 110, visible: true },
  { key: 'leaveType',      label: '申请类型',     width: 80,  visible: true },
  { key: 'startTime',      label: '开始时间',     width: 145, visible: true },
  { key: 'endTime',        label: '结束时间',     width: 145, visible: true },
  { key: 'origDuration',   label: '时长（原始）', width: 100, visible: true },
  { key: 'recalcDuration', label: '时长（重算）', width: 100, visible: true },
  { key: 'updatedShift',   label: '更新班次',     width: 130, visible: true },
  { key: 'reason',         label: '异常原因',     width: 160, visible: true },
  { key: 'source',         label: '数据来源',     width: 90,  visible: true },
  { key: 'approvalStatus', label: '审批流程状态', width: 105, visible: true },
  { key: 'cancelStatus',   label: '取消流程状态', width: 105, visible: true },
];

// ─── Mock Data ────────────────────────────────
const ANOMALY_RECORDS: AnomalyRecord[] = [
  { id:1, name:'曹文瑶', empId:'CP25004', dept:'产品运营部',   date:'2026-05-06', weekday:'三', shift:'早九点到六点',    type:'迟到',  desc:'上班迟到32分钟',     clock:'09:32 / 18:08', reminder:'已提醒', handled:false, writeOff:'未核销' },
  { id:2, name:'孟佳玫', empId:'CP25006', dept:'产品运营部',   date:'2026-05-06', weekday:'三', shift:'早九点到六点',    type:'旷工',  desc:'全天缺勤未请假',     clock:'— / —',         reminder:'未提醒', handled:false, writeOff:'未核销' },
  { id:3, name:'吴洛富', empId:'CP25011', dept:'直营建连店',   date:'2026-05-06', weekday:'三', shift:'早七点半到五点半', type:'迟到', desc:'上班迟到18分钟',     clock:'07:48 / 17:30', reminder:'未提醒', handled:false, writeOff:'未核销' },
  { id:4, name:'荣誉',   empId:'CP25015', dept:'工艺开发部',   date:'2026-05-06', weekday:'三', shift:'早九点到六点',    type:'早退',  desc:'下班提前离岗25分钟', clock:'09:02 / 17:35', reminder:'未提醒', handled:false, writeOff:'未核销' },
  { id:5, name:'邹智旭', empId:'CP25014', dept:'工艺开发部',   date:'2026-05-07', weekday:'四', shift:'早九点到六点',    type:'旷工',  desc:'全天缺勤，未提交请假',clock:'— / —',        reminder:'未提醒', handled:false, writeOff:'未核销' },
  { id:6, name:'尤国强', empId:'CP25019', dept:'技术支持部',   date:'2026-05-05', weekday:'二', shift:'早九点到六点',    type:'迟到',  desc:'上班迟到45分钟',     clock:'09:45 / 18:00', reminder:'已提醒', handled:false, writeOff:'未核销' },
  { id:7, name:'朱苗建', empId:'CP25020', dept:'直营建连店',   date:'2026-05-05', weekday:'二', shift:'早七点半到五点半', type:'未打卡',desc:'上班未打卡',         clock:'— / 17:30',     reminder:'已提醒', handled:true,  writeOff:'已核销' },
  { id:8, name:'曹文瑶', empId:'CP25004', dept:'产品运营部',   date:'2026-05-05', weekday:'二', shift:'早九点到六点',    type:'迟到',  desc:'上班迟到12分钟',     clock:'09:12 / 18:05', reminder:'已提醒', handled:true,  writeOff:'已核销' },
  { id:9, name:'劲善达', empId:'CP25017', dept:'工艺开发部',   date:'2026-05-04', weekday:'一', shift:'早九点到六点',    type:'迟到',  desc:'上班迟到8分钟',      clock:'09:08 / 18:02', reminder:'未提醒', handled:false, writeOff:'未核销' },
].slice(0, 5);

const BIZ_RECORDS_LEAVE: BizRecord[] = [
  { id:1, name:'孟佳玫', empId:'CP25006', dept:'产品运营部',   leaveType:'年假', startTime:'2026-05-02 09:00', endTime:'2026-05-02 18:00', origDuration:'8小时', recalcDuration:'8小时', updatedShift:'早九点到六点', reason:'假期期间有加班记录与请假时段重叠', source:'假期管理', approvalStatus:'已通过', cancelStatus:'未申请取消' },
  { id:2, name:'张林乐', empId:'CP25008', dept:'研发设计一部', leaveType:'事假', startTime:'2026-05-06 13:00', endTime:'2026-05-06 18:00', origDuration:'4小时', recalcDuration:'3.5小时', updatedShift:'早八点半到五点半', reason:'班次变更导致请假时长不匹配',         source:'假期管理', approvalStatus:'已通过', cancelStatus:'未申请取消' },
  { id:3, name:'荣誉',   empId:'CP25015', dept:'工艺开发部',   leaveType:'病假', startTime:'2026-05-07 09:00', endTime:'2026-05-07 18:00', origDuration:'8小时', recalcDuration:'',       updatedShift:'',             reason:'病假单时长与实际排班天数不符',     source:'假期管理', approvalStatus:'审批中',  cancelStatus:'未申请取消' },
];

const BIZ_RECORDS_FIELDOUT: BizRecord[] = [
  { id:4, name:'孟佳玫', empId:'CP25006', dept:'产品运营部',   leaveType:'外勤', startTime:'2026-05-04 14:00', endTime:'2026-05-04 17:30', origDuration:'3.5小时', recalcDuration:'3.5小时', updatedShift:'早九点到六点', reason:'外勤时段与排班变更存在交叉',       source:'勤务数据', approvalStatus:'已通过', cancelStatus:'未申请取消' },
  { id:5, name:'林娜',   empId:'CP25003', dept:'产品研发中心', leaveType:'外勤', startTime:'2026-05-03 09:00', endTime:'2026-05-03 12:00', origDuration:'3小时',   recalcDuration:'',        updatedShift:'',             reason:'外勤时间段对应人员已离职，数据待审核', source:'勤务数据', approvalStatus:'审批中',  cancelStatus:'未申请取消' },
];

// ─── Helpers ─────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}
const pBtn = (c: any): React.CSSProperties => ({ padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: c.primary, color: '#fff', whiteSpace: 'nowrap' });
const oBtn = (c: any, a?: boolean, d?: boolean): React.CSSProperties => ({ padding: '5px 12px', fontSize: '12px', borderRadius: 4, cursor: a === false ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', whiteSpace: 'nowrap', border: `1px solid ${d ? '#FCA5A5' : a ? c.primary : c.inputBorder}`, color: d ? '#DC2626' : a ? c.primary : c.text, opacity: a === false ? 0.45 : 1 });

function matchDateRange(date: string, start: string, end: string) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

const thS = (c: any): React.CSSProperties => ({ padding: '8px 10px', fontSize: '12px', color: c.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${c.tableBorder}`, backgroundColor: c.tableHeaderBg, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 20 });
const tdS = (c: any): React.CSSProperties => ({ padding: '7px 10px', fontSize: '12px', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const pgS = (c: any, active: boolean): React.CSSProperties => ({ minWidth: 24, height: 24, padding: '0 5px', fontSize: '12px', border: `1px solid ${active ? c.primary : c.inputBorder}`, borderRadius: 4, backgroundColor: active ? c.primary : 'transparent', color: active ? '#fff' : c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });

// ─── Reminder Settings Modal ──────────────────
function ReminderModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [autoRemind, setAutoRemind]   = useState(true);
  const [maxCount, setMaxCount]       = useState(3);
  const [remindSelf, setRemindSelf]   = useState(true);
  const [remindMgr, setRemindMgr]     = useState(false);
  const [methods, setMethods]         = useState({ app: true, feishu: false });
  const preview = '您好，您在 {日期} 存在考勤异常（{异常类型}），请及时处理。如有疑问请联系HR。';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 12, width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>提醒设置</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={15}/></button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 自动提醒开关 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: colors.text }}>自动提醒</span>
            <div onClick={() => setAutoRemind(v => !v)} style={{ width: 34, height: 18, borderRadius: 9, backgroundColor: autoRemind ? colors.primary : colors.inputBorder, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 2, left: autoRemind ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}/>
            </div>
          </div>
          {/* 提醒方式 */}
          <div>
            <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 8 }}>提醒方式</p>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ key: 'app', label: 'App 通知' }, { key: 'feishu', label: '飞书通知' }].map(m => (
                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
                  <input type="checkbox" checked={(methods as any)[m.key]} onChange={() => setMethods(p => ({ ...p, [m.key]: !(p as any)[m.key] }))} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>{m.label}
                </label>
              ))}
            </div>
          </div>
          {/* 最大提醒次数 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '12px', color: colors.text, flex: 1 }}>最大提醒次数</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setMaxCount(v => Math.max(1, v - 1))} style={{ width: 24, height: 24, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Minus size={10}/></button>
              <span style={{ fontSize: '14px', fontWeight: 600, color: colors.primary, minWidth: 20, textAlign: 'center' }}>{maxCount}</span>
              <button onClick={() => setMaxCount(v => Math.min(10, v + 1))} style={{ width: 24, height: 24, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Plus size={10}/></button>
            </div>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>次</span>
          </div>
          {/* 提醒对象 */}
          <div>
            <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 8 }}>提醒对象</p>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
                <input type="checkbox" checked={remindSelf} onChange={() => setRemindSelf(v => !v)} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>提醒员工本人</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
                <input type="checkbox" checked={remindMgr} onChange={() => setRemindMgr(v => !v)} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>提醒上级领导</label>
            </div>
          </div>
          {/* 预览文案 */}
          <div>
            <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 6 }}>提醒文案预览</p>
            <div style={{ padding: '10px 12px', backgroundColor: colors.statCardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, fontSize: '12px', color: colors.textMuted, lineHeight: 1.6 }}>{preview}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={oBtn(colors)}>取消</button>
          <button onClick={onClose} style={pBtn(colors)}>确定</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shift Picker Modal ───────────────────────
function ShiftPickerModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const filtered = SHIFTS.filter(s => s.includes(search));
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 10, width: 360, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>选择班次</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={14}/></button>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${colors.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
            <Search size={12} style={{ color: colors.textMuted }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索班次"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }}/>
          </div>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {filtered.map(s => (
            <div key={s} onClick={() => setSelected(s)}
              style={{ padding: '9px 16px', fontSize: '12px', cursor: 'pointer', color: selected === s ? colors.primary : colors.text, backgroundColor: selected === s ? `${colors.primary}10` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => selected !== s && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
              onMouseLeave={e => selected !== s && (e.currentTarget.style.backgroundColor = 'transparent')}>
              {s}
              {selected === s && <span style={{ fontSize: '11px', color: colors.primary }}>✓</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '10px 16px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={oBtn(colors)}>取消</button>
          <button onClick={onClose} style={{ ...pBtn(colors), opacity: selected ? 1 : 0.5 }}>确定</button>
        </div>
      </div>
    </div>
  );
}

// ─── Column Settings Modal ────────────────────
function ColSettingsModal({ cols, onClose, onApply, colors }: {
  cols: ColDef[]; onClose: () => void; onApply: (c: ColDef[]) => void; colors: any;
}) {
  const [localCols, setLocalCols] = useState<ColDef[]>(cols.map(c => ({ ...c })));
  const [freeze, setFreeze] = useState(2);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const onDragEnd = () => {
    if (dragIdx !== null && dragOver !== null && dragIdx !== dragOver) {
      const next = [...localCols]; const [m] = next.splice(dragIdx, 1); next.splice(dragOver, 0, m); setLocalCols(next);
    }
    setDragIdx(null); setDragOver(null);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 12, width: 360, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>表头设置</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setLocalCols(BIZ_COLS_DEFAULT.map(c => ({ ...c })))} style={{ fontSize: '12px', color: colors.primary, border: 'none', background: 'transparent', cursor: 'pointer' }}>恢复默认</button>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={15}/></button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: `1px solid ${colors.divider}`, gap: 10 }}>
          <span style={{ fontSize: '12px', color: colors.text, flex: 1 }}>冻结前</span>
          <button onClick={() => setFreeze(v => Math.max(0, v - 1))} style={{ width: 24, height: 24, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Minus size={10}/></button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.primary, minWidth: 20, textAlign: 'center' }}>{freeze}</span>
          <button onClick={() => setFreeze(v => Math.min(5, v + 1))} style={{ width: 24, height: 24, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textMuted }}><Plus size={10}/></button>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>列</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          <div style={{ padding: '4px 18px 6px', fontSize: '11px', color: colors.textMuted }}>显示字段 · 拖拽调整顺序</div>
          {localCols.map((col, idx) => {
            const isDrag = dragIdx === idx; const isOver = dragOver === idx;
            return (
              <div key={col.key} draggable onDragStart={() => setDragIdx(idx)} onDragEnter={() => setDragOver(idx)} onDragOver={e => e.preventDefault()} onDragEnd={onDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 18px', cursor: 'grab', opacity: isDrag ? 0.4 : 1, borderTop: isOver && !isDrag ? `2px solid ${colors.primary}` : '2px solid transparent' }}
                onMouseEnter={e => !isDrag && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => !isDrag && (e.currentTarget.style.backgroundColor = 'transparent')}>
                <GripVertical size={12} style={{ color: colors.textMuted, flexShrink: 0 }}/>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={col.visible} onChange={() => setLocalCols(p => p.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>
                  <span style={{ fontSize: '12px', color: colors.text }}>{col.label}</span>
                </label>
                {idx < freeze && <span style={{ fontSize: '10px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>冻结</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '11px 18px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={oBtn(colors)}>取消</button>
          <button onClick={() => { onApply(localCols); onClose(); }} style={pBtn(colors)}>确定</button>
        </div>
      </div>
    </div>
  );
}

// ─── 考勤异常 View ─────────────────────────────
function AnomalyAttendance({ colors }: { colors: any }) {
  const [empSearch, setEmpSearch] = useState('');
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showShiftPicker, setShowShiftPicker] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [rows, setRows] = useState<AnomalyRecord[]>(ANOMALY_RECORDS);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  const [remarkTargetIds, setRemarkTargetIds] = useState<number[]>([]);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [attendGroupFilter, setAttendGroupFilter] = useState('');
  const [anomalyTypeFilter, setAnomalyTypeFilter] = useState('全部');

  const [appliedDateStart, setAppliedDateStart] = useState('');
  const [appliedDateEnd, setAppliedDateEnd] = useState('');
  const [appliedDeptFilter, setAppliedDeptFilter] = useState('');
  const [appliedAttendGroupFilter, setAppliedAttendGroupFilter] = useState('');
  const [appliedAnomalyTypeFilter, setAppliedAnomalyTypeFilter] = useState('全部');

  const [sortKey, setSortKey] = useState<keyof AnomalyRecord>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const TABLE_COLS: Array<{ k: keyof AnomalyRecord; l: string; w: number }> = [
    { k: 'name', l: '姓名', w: 70 },
    { k: 'empId', l: '工号', w: 85 },
    { k: 'dept', l: '部门', w: 110 },
    { k: 'date', l: '日期', w: 90 },
    { k: 'shift', l: '班次', w: 140 },
    { k: 'type', l: '异常类型', w: 80 },
    { k: 'desc', l: '异常说明', w: 150 },
    { k: 'clock', l: '打卡时间', w: 120 },
    { k: 'reminder', l: '提醒状态', w: 85 },
    { k: 'writeOff', l: '核销状态', w: 85 },
    { k: 'remark', l: '备注', w: 170 },
  ];

  const loadAnomalies = useCallback(async () => {

    try {
      const res = await fetchAttendanceAnomalies();
      if (res.rows?.length) {
        setRows(res.rows);
      }
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前展示静态数据');
    }
  }, []);

  useEffect(() => {
    loadAnomalies();
  }, [loadAnomalies]);

  const persistRows = useCallback(async (nextRows: AnomalyRecord[]) => {
    setSaving(true);
    try {
      const saved = await saveAttendanceAnomalies(nextRows);
      setSourceFile(saved.sourceFile || '本地持久化数据 data-store.json');
      setLoadError('');
    } catch (_error) {
      setLoadError('保存失败，请检查后端服务');
      throw _error;
    } finally {
      setSaving(false);
    }
  }, []);

  const STAT_CARDS = [
    { key: 'all', label: '异常', count: rows.length, color: colors.primary },
    { key: '迟到', label: '迟到', count: rows.filter(row => row.type === '迟到').length, color: '#D97706' },
    { key: '旷工', label: '旷工', count: rows.filter(row => row.type === '旷工').length, color: '#DC2626' },
    { key: '已提醒', label: '已提醒', count: rows.filter(row => row.reminder === '已提醒').length, color: '#16A34A' },
    { key: '未提醒', label: '未提醒', count: rows.filter(row => row.reminder === '未提醒').length, color: '#6366F1' },
    { key: '未核销', label: '未核销', count: rows.filter(row => row.writeOff === '未核销').length, color: '#0891B2' },
  ];

  const filteredRows = rows.filter(r => {
    const keyword = empSearch.trim().toLowerCase();
    const matchKeyword = !keyword || r.name.toLowerCase().includes(keyword) || r.empId.toLowerCase().includes(keyword);
    if (!matchKeyword) return false;

    if (!matchDateRange(r.date, appliedDateStart, appliedDateEnd)) return false;
    if (appliedDeptFilter && r.dept !== appliedDeptFilter) return false;

    const rowAttendGroup = ATTEND_GROUP_BY_DEPT[r.dept] || '';
    if (appliedAttendGroupFilter && rowAttendGroup !== appliedAttendGroupFilter) return false;

    if (appliedAnomalyTypeFilter && appliedAnomalyTypeFilter !== '全部' && r.type !== appliedAnomalyTypeFilter) return false;

    if (!activeCard || activeCard === 'all') return true;
    if (activeCard === '已提醒') return r.reminder === '已提醒';
    if (activeCard === '未提醒') return r.reminder === '未提醒';
    if (activeCard === '未核销') return r.writeOff === '未核销';
    return r.type === activeCard;
  });

  const normalizeSortValue = (value: unknown): string | number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === null || value === undefined) return '';

    const text = String(value).trim();
    if (!text) return '';

    const timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) return timestamp;

    return text;
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    const left = normalizeSortValue(a[sortKey]);
    const right = normalizeSortValue(b[sortKey]);

    if (typeof left === 'number' && typeof right === 'number') {
      return sortDir === 'asc' ? left - right : right - left;
    }

    const result = String(left).localeCompare(String(right), 'zh-CN', { numeric: true, sensitivity: 'base' });
    return sortDir === 'asc' ? result : -result;
  });

  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const allSelected = selected.size === filteredRows.length && filteredRows.length > 0;

  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredRows.map(r => r.id)));
  const toggleRow = (id: number) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const targetIds = selected.size > 0 ? Array.from(selected) : filteredRows.map(row => row.id);

  const applyAndSaveRows = useCallback(async (updater: (row: AnomalyRecord) => AnomalyRecord) => {
    const idSet = new Set(targetIds);
    if (idSet.size === 0) {
      window.alert('暂无可操作记录');
      return;
    }

    const nextRows = rows.map(row => (idSet.has(row.id) ? updater(row) : row));
    setRows(nextRows);
    try {
      await persistRows(nextRows);
      setSelected(new Set());
    } catch (_error) {
      window.alert('保存失败，请检查后端服务');
    }
  }, [persistRows, rows, targetIds]);

  const handleSendReminder = useCallback(async () => {
    await applyAndSaveRows(row => ({ ...row, reminder: '已提醒' }));
  }, [applyAndSaveRows]);

  const handleWriteOff = useCallback(async () => {
    await applyAndSaveRows(row => ({ ...row, writeOff: '已核销', handled: true }));
  }, [applyAndSaveRows]);

  const openRemarkModal = useCallback((ids: number[]) => {
    if (ids.length === 0) {
      window.alert('请先选择需要备注的记录');
      return;
    }

    const first = rows.find(row => row.id === ids[0]);
    setRemarkTargetIds(ids);
    setRemarkText(first?.remark || '');
    setShowRemarkModal(true);
  }, [rows]);

  const saveRemark = useCallback(async () => {
    const content = remarkText.trim();
    const idSet = new Set(remarkTargetIds);
    const now = content ? new Date().toLocaleString('zh-CN') : '';

    const nextRows = rows.map(row => (
      idSet.has(row.id)
        ? {
          ...row,
          remark: content,
          remarkUpdatedAt: now,
          handled: content ? true : row.writeOff === '已核销',
        }
        : row
    ));

    setRows(nextRows);
    try {
      await persistRows(nextRows);
      setShowRemarkModal(false);
      setRemarkTargetIds([]);
      setSelected(new Set());
    } catch (_error) {
      window.alert(content ? '备注保存失败，请检查后端服务' : '备注删除失败，请检查后端服务');
    }
  }, [persistRows, remarkTargetIds, remarkText, rows]);

  const clearRemark = useCallback(async () => {
    setRemarkText('');
    const idSet = new Set(remarkTargetIds);
    const nextRows = rows.map(row => (
      idSet.has(row.id)
        ? { ...row, remark: '', remarkUpdatedAt: '', handled: row.writeOff === '已核销' }
        : row
    ));

    setRows(nextRows);
    try {
      await persistRows(nextRows);
      setShowRemarkModal(false);
      setRemarkTargetIds([]);
      setSelected(new Set());
    } catch (_error) {
      window.alert('备注删除失败，请检查后端服务');
    }
  }, [persistRows, remarkTargetIds, rows]);


  const handleExport = useCallback(() => {
    const exportRows = selected.size > 0
      ? filteredRows.filter(row => selected.has(row.id))
      : filteredRows;

    if (exportRows.length === 0) {
      window.alert('暂无可导出的异常记录');
      return;
    }

    const headers = ['姓名', '工号', '部门', '日期', '异常类型', '异常说明', '提醒状态', '核销状态', '备注', '备注时间'];
    const escapeCsv = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const csvRows = exportRows.map(row => [
      row.name,
      row.empId,
      row.dept,
      row.date,
      row.type,
      row.desc,
      row.reminder,
      row.writeOff,
      row.remark || '',
      row.remarkUpdatedAt || '',
    ]);

    const csv = [headers, ...csvRows].map(line => line.map(cell => escapeCsv(String(cell))).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `考勤异常-${new Date().toISOString().slice(0, 10)}-${selected.size > 0 ? '选中记录' : '筛选结果'}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, [filteredRows, selected]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const getPages = (): (number | '...')[] =>
    totalPages <= 7 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [1, 2, '...', totalPages];

  const handleSort = (key: keyof AnomalyRecord) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const getSortMark = (key: keyof AnomalyRecord) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const handleQuery = () => {

    setAppliedDateStart(dateStart);
    setAppliedDateEnd(dateEnd);
    setAppliedDeptFilter(deptFilter);
    setAppliedAttendGroupFilter(attendGroupFilter);
    setAppliedAnomalyTypeFilter(anomalyTypeFilter || '全部');
    setSelected(new Set());
    setPage(1);
  };

  const handleReset = () => {
    setDateStart('');
    setDateEnd('');
    setDeptFilter('');
    setAttendGroupFilter('');
    setAnomalyTypeFilter('全部');

    setAppliedDateStart('');
    setAppliedDateEnd('');
    setAppliedDeptFilter('');
    setAppliedAttendGroupFilter('');
    setAppliedAnomalyTypeFilter('全部');

    setEmpSearch('');
    setShowMore(false);
    setActiveCard(null);
    setSelected(new Set());
    setPage(1);
  };

  return (

    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filter bar */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>考勤日期:</span>
            <input value={dateStart} onChange={e => setDateStart(e.target.value)} type="date" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: 108 }}/>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
            <input value={dateEnd} onChange={e => setDateEnd(e.target.value)} type="date" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: 108 }}/>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth: 150 }}>
            <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>员工:</span>
            <Search size={11} style={{ color: colors.textMuted }}/>
            <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="输入姓名或工号"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1, minWidth: 60 }}/>
          </div>
          <button onClick={() => setShowMore(v => !v)} style={{ ...oBtn(colors, showMore), display: 'flex', alignItems: 'center', gap: 4 }}>
            更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={oBtn(colors)}>重置</button>
            <button onClick={handleQuery} style={pBtn(colors)}>查询</button>
          </div>

        </div>
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
              <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>部门:</span>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text }}>
                <option value="">全部</option>
                {DEPT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
              <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>考勤组:</span>
              <select value={attendGroupFilter} onChange={e => setAttendGroupFilter(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text }}>
                <option value="">全部</option>
                {ATTEND_GROUPS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
              <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>异常类型:</span>
              <select value={anomalyTypeFilter} onChange={e => setAnomalyTypeFilter(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text }}>
                {ANOMALY_TYPES.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
        )}

      </div>
      {(sourceFile || loadError) && (
        <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 6, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', flexShrink: 0 }}>
          {sourceFile ? `已连接真实数据源：${sourceFile}` : ''}
          {loadError ? ` ${loadError}` : ''}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', flexShrink: 0, flexWrap: 'wrap' }}>
        {STAT_CARDS.map(card => (
          <div key={card.key}
            onClick={() => { if (card.count !== null) { setActiveCard(activeCard === card.key ? null : card.key); setSelected(new Set()); setPage(1); } }}
            style={{ flex: 1, minWidth: 90, padding: '10px 14px', backgroundColor: activeCard === card.key ? `${card.color}14` : colors.statCardBg, border: `1px solid ${activeCard === card.key ? card.color : colors.cardBorder}`, borderRadius: 8, cursor: card.count !== null ? 'pointer' : 'default', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: 4 }}>{card.label}</div>
            {card.count !== null
              ? <div style={{ fontSize: '22px', fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.count}</div>
              : <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: 6 }}>点击下方筛选</div>}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px', flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={handleSendReminder} disabled={saving || filteredRows.length === 0} style={{ ...oBtn(colors), ...(saving || filteredRows.length === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Bell size={12}/>发送提醒
        </button>
        <button onClick={() => openRemarkModal(targetIds)} disabled={saving || filteredRows.length === 0} style={{ ...oBtn(colors), ...(saving || filteredRows.length === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}), display: 'flex', alignItems: 'center', gap: 4 }}>
          备注
        </button>
        <button onClick={handleWriteOff} disabled={saving || filteredRows.length === 0} style={{ ...oBtn(colors), ...(saving || filteredRows.length === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}), display: 'flex', alignItems: 'center', gap: 4 }}>
          核销异常
        </button>
        <button onClick={() => setShowReminder(true)} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Settings2 size={12}/>提醒设置
        </button>
        <button onClick={handleExport} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12}/>导出</button>
        {selected.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selected.size} 条</span>}
      </div>


      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}` }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', left: 0, position: 'sticky', zIndex: 25 }}>
                <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {TABLE_COLS.map(col => (
                <th
                  key={col.k}
                  onClick={() => handleSort(col.k)}
                  style={{ ...thS(colors), width: col.w, minWidth: col.w, borderLeft: `1px solid ${colors.tableBorder}`, cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.l}
                    <span style={{ fontSize: '11px', color: sortKey === col.k ? colors.primary : colors.textMuted }}>{getSortMark(col.k)}</span>
                  </span>
                </th>
              ))}

              <th style={{ ...thS(colors), width: 72, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>备注</th>

            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: '60px 0', color: colors.textMuted, fontSize: '13px' }}>暂无异常记录</td></tr>

            ) : pagedRows.map((row, ri) => {
              const isSel = selected.has(row.id);
              const typeColor: Record<string, string> = { '迟到': '#D97706', '旷工': '#DC2626', '早退': '#D97706', '未打卡': '#6366F1', '未排班': colors.textMuted };
              return (
                <tr key={row.id}
                  style={{ backgroundColor: isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}` }}><span onClick={() => window.alert(`异常员工详情\n姓名：${row.name}\n员工号：${row.empId}\n部门：${row.dept}\n异常类型：${row.type}\n异常日期：${row.date}`)} style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{row.name}</span></td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, fontSize: '11px', color: colors.textMuted }}>{row.empId}</td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.dept}</td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}` }}>{row.date} <span style={{ fontSize: '10px', color: colors.textMuted }}>周{row.weekday}</span></td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: colors.textMuted }}>{row.shift}</td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}` }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: `${typeColor[row.type] ?? colors.textMuted}18`, color: typeColor[row.type] ?? colors.textMuted }}>{row.type}</span>
                  </td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: colors.textMuted }}>{row.desc}</td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, fontSize: '11px' }}>{row.clock}</td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}` }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: row.reminder === '已提醒' ? colors.badgeGreenBg : colors.badgeGrayBg, color: row.reminder === '已提醒' ? colors.badgeGreenText : colors.badgeGrayText }}>{row.reminder}</span>
                  </td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}` }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: row.writeOff === '已核销' ? colors.badgeGreenBg : colors.badgeGrayBg, color: row.writeOff === '已核销' ? colors.badgeGreenText : colors.badgeGrayText }}>{row.writeOff}</span>
                  </td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, fontSize: '11px', color: row.remark ? colors.text : colors.textMuted }} title={row.remark || ''}>
                    {row.remark || '—'}
                  </td>
                  <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, textAlign: 'center' }}>
                    <button onClick={() => openRemarkModal([row.id])} style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>备注</button>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{filteredRows.length}笔</span>
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={12}/></button>
        {getPages().map((p, i) => p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span> : <button key={p} style={pgS(colors, page === p)} onClick={() => setPage(p as number)}>{p}</button>)}
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={12}/></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); }}}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}/>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      {showRemarkModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 620, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: colors.cardBg, borderRadius: 10, width: 420, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${colors.divider}` }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>异常备注（{remarkTargetIds.length} 条）</span>
              <button onClick={() => setShowRemarkModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted }}><X size={14}/></button>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <textarea
                value={remarkText}
                onChange={event => setRemarkText(event.target.value.slice(0, REMARK_MAX_LEN))}
                placeholder="请输入备注内容（如：员工已补卡，待主管审批）"
                rows={4}
                style={{ width: '100%', border: `1px solid ${colors.inputBorder}`, outline: 'none', fontSize: '12px', background: colors.inputBg, color: colors.text, borderRadius: 6, padding: '10px 12px', lineHeight: 1.6, resize: 'vertical' }}
              />
              <div style={{ marginTop: 6, textAlign: 'right', fontSize: '11px', color: colors.textMuted }}>{remarkText.length}/{REMARK_MAX_LEN}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 16px', borderTop: `1px solid ${colors.divider}` }}>
              <button onClick={clearRemark} disabled={saving} style={{ ...oBtn(colors, false, true), opacity: saving ? 0.55 : 1 }}>
                删除备注
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowRemarkModal(false)} style={oBtn(colors)}>取消</button>
                <button onClick={saveRemark} disabled={saving} style={{ ...pBtn(colors), opacity: saving ? 0.6 : 1 }}>
                  {saving ? '保存中...' : '保存备注'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {showReminder && <ReminderModal colors={colors} onClose={() => setShowReminder(false)}/>}
      {showShiftPicker && <ShiftPickerModal colors={colors} onClose={() => setShowShiftPicker(false)}/>}
    </div>
  );
}


// ─── 业务异常 View ─────────────────────────────
function AnomalyBusiness({ colors }: { colors: any }) {
  const [bizTab, setBizTab] = useState<'leave' | 'fieldout'>('leave');
  const [statusTab, setStatusTab] = useState<'pending' | 'processing' | 'done'>('pending');
  const [showMore, setShowMore] = useState(false);
  const [showColSettings, setShowColSettings] = useState(false);
  const [bizCols, setBizCols] = useState<ColDef[]>(BIZ_COLS_DEFAULT);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [bizRowsByTab, setBizRowsByTab] = useState<{ leave: BizRecord[]; fieldout: BizRecord[] }>({
    leave: BIZ_RECORDS_LEAVE,
    fieldout: BIZ_RECORDS_FIELDOUT,
  });

  const rows = bizRowsByTab[bizTab];
  const filteredRows = rows.filter(row => {

    if (statusTab === 'done') return row.approvalStatus === '已通过';
    if (statusTab === 'processing') return row.approvalStatus === '审批中';
    return row.approvalStatus !== '已通过';
  });
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const visCols = bizCols.filter(c => c.visible);
  const allSel = pagedRows.length > 0 && pagedRows.every(row => selected.has(row.id));
  const someSel = pagedRows.some(row => selected.has(row.id)) && !allSel;
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allSel) pagedRows.forEach(row => next.delete(row.id));
    else pagedRows.forEach(row => next.add(row.id));
    return next;
  });
  const toggleRow = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const getPages = (): (number | '...')[] => totalPages <= 5 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [1, 2, '...', totalPages];

  const bizTabItems = [
    { v: 'leave', l: '请假', n: bizRowsByTab.leave.length },
    { v: 'fieldout', l: '外出', n: bizRowsByTab.fieldout.length },
  ] as const;

  const statusItems = [
    { v: 'pending', l: '待处理', n: rows.filter(row => row.approvalStatus !== '已通过').length },
    { v: 'processing', l: '处理中', n: rows.filter(row => row.approvalStatus === '审批中').length },
    { v: 'done', l: '已完成', n: rows.filter(row => row.approvalStatus === '已通过').length },
  ] as const;

  const approvalColor: Record<string, [string, string]> = {
    '已通过': [colors.badgeGreenBg, colors.badgeGreenText],
    '审批中': [colors.badgeBlueBg, colors.badgeBlueText],
    '已拒绝': [colors.badgeRedBg, colors.badgeRedText],
  };

  const handleRecalculate = () => {
    if (selected.size === 0) return;

    setBizRowsByTab(prev => {
      const currentRows = prev[bizTab];
      const nextRows = currentRows.map(row => {
        if (!selected.has(row.id)) return row;
        return {
          ...row,
          recalcDuration: row.recalcDuration || row.origDuration || '0小时',
          updatedShift: row.updatedShift || '早九点到六点',
          approvalStatus: row.approvalStatus === '已通过' ? '已通过' : '审批中',
        };
      });
      return { ...prev, [bizTab]: nextRows };
    });

    setSelected(new Set());
  };

  const handleDelete = () => {
    if (selected.size === 0) return;

    setBizRowsByTab(prev => {
      const currentRows = prev[bizTab];
      const nextRows = currentRows.filter(row => !selected.has(row.id));
      return { ...prev, [bizTab]: nextRows };
    });

    setSelected(new Set());
    setPage(1);
  };

  return (

    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Biz type tabs */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', padding: '0 16px', flexShrink: 0 }}>
        {bizTabItems.map(t => (
          <button key={t.v} onClick={() => { setBizTab(t.v as any); setSelected(new Set()); setPage(1); }}
            style={{ padding: '12px 16px', fontSize: '13px', fontWeight: bizTab === t.v ? 600 : 400, border: 'none', background: 'transparent', cursor: 'pointer', color: bizTab === t.v ? colors.primary : colors.textMuted, borderBottom: `2px solid ${bizTab === t.v ? colors.primary : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.l}
            <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 10, backgroundColor: bizTab === t.v ? colors.primary : colors.badgeGrayBg, color: bizTab === t.v ? '#fff' : colors.badgeGrayText }}>{t.n}</span>
          </button>
        ))}
      </div>
      {/* Filter + status tabs */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, overflow: 'hidden' }}>
            {statusItems.map(s => (
              <button key={s.v} onClick={() => { setStatusTab(s.v); setSelected(new Set()); setPage(1); }}
                style={{ padding: '5px 12px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: statusTab === s.v ? colors.primary : 'transparent', color: statusTab === s.v ? '#fff' : colors.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                {s.l}<span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: 9, backgroundColor: statusTab === s.v ? '#fff' : colors.badgeGrayBg, color: statusTab === s.v ? colors.primary : colors.badgeGrayText }}>{s.n}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowMore(v => !v)} style={{ ...oBtn(colors, showMore), display: 'flex', alignItems: 'center', gap: 4 }}>
            更多筛选 {showMore ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => { setStatusTab('pending'); setSelected(new Set()); setPage(1); }} style={oBtn(colors)}>重置</button>
            <button style={pBtn(colors)}>查询</button>
          </div>
        </div>
        {showMore && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg }}>
              <span style={{ fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>业务日期:</span>
              <input type="date" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: 108 }}/>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
              <input type="date" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, width: 108 }}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth: 140 }}>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>员工:</span>
              <Search size={11} style={{ color: colors.textMuted }}/>
              <input placeholder="姓名或工号" style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }}/>
            </div>
          </div>
        )}
      </div>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={handleRecalculate} disabled={selected.size === 0} style={{ ...oBtn(colors), ...(selected.size === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}), display: 'flex', alignItems: 'center', gap: 4 }}>
          <RotateCcw size={12}/>重算
        </button>
        <button onClick={handleDelete} disabled={selected.size === 0} style={{ ...(selected.size === 0 ? { ...oBtn(colors), opacity: 0.45, cursor: 'not-allowed' } : oBtn(colors, false, true)), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={12}/>删除
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selected.size} 条</span>}
          <button onClick={() => setShowColSettings(true)} style={{ ...oBtn(colors, showColSettings), display: 'flex', alignItems: 'center', gap: 4 }}>
            <Settings2 size={12}/>表头设置
          </button>
        </div>
      </div>
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1320, width: 'max-content' }}>
          <thead>
            <tr>
              <th style={{ ...thS(colors), width: 36, textAlign: 'center', padding: '8px 0', position: 'sticky', left: 0, zIndex: 25 }}>
                <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = someSel; }} onChange={toggleAll} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
              </th>
              {visCols.map(col => <th key={col.key} style={{ ...thS(colors), width: col.width, minWidth: col.width, borderLeft: `1px solid ${colors.tableBorder}` }}>{col.label}</th>)}
              <th style={{ ...thS(colors), width: 60, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={visCols.length + 2} style={{ textAlign: 'center', padding: '60px 0', color: colors.textMuted, fontSize: '13px' }}>暂无业务异常数据</td></tr>
            ) : pagedRows.map((row, ri) => {
              const isSel = selected.has(row.id);
              return (
                <tr key={row.id}
                  style={{ backgroundColor: isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                  <td style={{ ...tdS(colors), width: 36, textAlign: 'center', padding: '7px 0', position: 'sticky', left: 0, backgroundColor: isSel ? `${colors.primary}0D` : ri % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }}/>
                  </td>
                  {visCols.map(col => {
                    const v = (row as any)[col.key];
                    let content: React.ReactNode = v || <span style={{ color: colors.textMuted }}>—</span>;
                    if (col.key === 'name') content = <span style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{v}</span>;
                    else if (col.key === 'leaveType') content = <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: colors.badgeBlueBg, color: colors.badgeBlueText }}>{v}</span>;
                    else if (col.key === 'approvalStatus') { const [bg, txt] = approvalColor[v] ?? [colors.badgeGrayBg, colors.badgeGrayText]; content = <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: bg, color: txt }}>{v}</span>; }
                    else if (col.key === 'cancelStatus') content = <span style={{ fontSize: '11px', color: colors.textMuted }}>{v}</span>;
                    else if (col.key === 'reason') content = <span style={{ fontSize: '11px', color: '#D97706' }}>{v}</span>;
                    return <td key={col.key} style={{ ...tdS(colors), width: col.width, minWidth: col.width, borderLeft: `1px solid ${colors.tableBorder}` }}>{content}</td>;
                  })}
                  <td style={{ ...tdS(colors), textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>
                    <button style={{ fontSize: '11px', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', backgroundColor: 'transparent' }}>查看</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Bottom bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{filteredRows.length}笔</span>
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={12}/></button>
        {getPages().map((p, i) => p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span> : <button key={p} style={pgS(colors, page === p)} onClick={() => setPage(p as number)}>{p}</button>)}
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={12}/></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); }}}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}/>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>
      {showColSettings && <ColSettingsModal cols={bizCols} onClose={() => setShowColSettings(false)} onApply={setBizCols} colors={colors}/>}
    </div>
  );
}

// ─── Main (route-based switch) ────────────────
export default function AnomalyManagement() {
  const { colors } = useTheme();
  const location = useLocation();
  const isBiz = location.pathname.includes('anomaly-biz');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      {isBiz ? <AnomalyBusiness colors={colors}/> : <AnomalyAttendance colors={colors}/>}
    </div>
  );
}
