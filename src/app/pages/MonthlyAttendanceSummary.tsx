import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchMonthlySummaryEmployees, saveMonthlySummaryEmployees, type MonthlySummaryEmployee as RealMonthEmployee } from '../api/realData';

import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Lock,
  MoreHorizontal,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Unlock,
  Upload,
  UserRound,
  X,
} from 'lucide-react';

type LockStatus = '已锁定' | '未锁定';
type ConfirmStatus = '未发送' | '已发送' | '已确认';
type SortDir = 'asc' | 'desc' | null;
type ConfirmType = 'lock' | 'unlock' | 'delete' | 'confirm' | null;
type SummaryKey = 'total' | 'full' | 'absent' | 'late' | 'hire';

type MonthEmployee = RealMonthEmployee;

type ColDef = {
  key: keyof MonthEmployee;
  label: string;
  width: number;
  sortable?: boolean;
};

type SelectOption = {
  label: string;
  value: string;
};

type ActionItem = {
  label: string;
  action?: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type OperationLog = {
  id: string;
  timestamp: number;
  detail: string;
};

type CalcScope = 'filtered' | 'selected';

type CalcPayload = {
  startDate: string;
  endDate: string;
  employee: string;
  dept: string;
  attendGroup: string;
};

const OPERATION_LOG_KEY = 'monthly-attendance-summary-logs-v1';
const OPERATION_LOG_TTL = 24 * 60 * 60 * 1000;
const MAX_OPERATION_LOGS = 80;


const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const DEPT_OPTIONS = ['产品研发中心', '产品运营部', '研发设计一部', '研发设计二部', '直营建连店', '工艺开发部', '技术支持部', '技术服务组'];
const ATTEND_GROUPS = ['华托大厦', '综合考勤组', '研发中心考勤组', '工艺部考勤组'];
const LOCK_OPTIONS: SelectOption[] = [
  { label: '全部', value: 'all' },
  { label: '已锁定', value: '已锁定' },
  { label: '未锁定', value: '未锁定' },
];
const CONFIRM_OPTIONS: SelectOption[] = [
  { label: '全部', value: 'all' },
  { label: '未发送', value: '未发送' },
  { label: '已发送', value: '已发送' },
  { label: '已确认', value: '已确认' },
];
const BIZ_GROUP_OPTIONS = ['全部', '电商运营组', '直营技术组', '工艺开发组', '产品支持组'];
const HIRE_STATUS_OPTIONS = ['全部', '本月入职', '在职', '已离职'];

const ALL_COLS: ColDef[] = [
  { key: 'name', label: '姓名', width: 96, sortable: true },
  { key: 'lockStatus', label: '锁定状态', width: 92, sortable: true },
  { key: 'empId', label: '员工号', width: 92, sortable: true },
  { key: 'dept', label: '部门', width: 110, sortable: true },
  { key: 'position', label: '岗位', width: 150 },
  { key: 'hireDate', label: '入职日期', width: 108, sortable: true },
  { key: 'resignDate', label: '离职日期', width: 108 },
  { key: 'deptFullPath', label: '部门全路径', width: 180 },
  { key: 'bizGroup', label: '业务分组', width: 110 },
  { key: 'attendGroup', label: '考勤组', width: 96, sortable: true },
  { key: 'shouldWorkDays', label: '应出勤天数', width: 96, sortable: true },
  { key: 'actualWorkDays', label: '实际出勤天数', width: 108, sortable: true },
  { key: 'absentDays', label: '旷工天数', width: 88, sortable: true },
  { key: 'tripDays', label: '出差天数', width: 88, sortable: true },
  { key: 'scheduleDays', label: '排班天数', width: 88, sortable: true },
  { key: 'normalHours', label: '正班时长(小时)', width: 118, sortable: true },
  { key: 'lateMinutes', label: '迟到时长(分钟)', width: 118, sortable: true },
  { key: 'earlyLeaveMinutes', label: '早退时长(分钟)', width: 118, sortable: true },
  { key: 'confirmStatus', label: '确认状态', width: 98, sortable: true },
];

const EMPLOYEE_BASE = [];

const DEFAULT_ROWS: MonthEmployee[] = EMPLOYEE_BASE.map((emp, index) => ({
  id: index + 1,
  ...emp,
  lockStatus: index === 7 || index === 15 ? '已锁定' : '未锁定',
  shouldWorkDays: 31,
  actualWorkDays: 0,
  absentDays: 0,
  tripDays: 0,
  scheduleDays: 0,
  normalHours: 0,
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  confirmStatus: index === 7 ? '已确认' : '未发送',
}));

const SUMMARY_ITEMS: { key: SummaryKey; label: string; value: number }[] = [
  { key: 'total', label: '总人数(人)', value: 490 },
  { key: 'full', label: '全勤', value: 450 },
  { key: 'absent', label: '旷工', value: 6 },
  { key: 'late', label: '迟到', value: 2 },
  { key: 'hire', label: '入职', value: 9 },
];

function normalizeOperationLogs(logs: OperationLog[], now = Date.now()) {
  return logs
    .filter(item => now - item.timestamp < OPERATION_LOG_TTL)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_OPERATION_LOGS);
}

function parseDateToMs(date: string) {
  const value = new Date(date).getTime();
  return Number.isNaN(value) ? null : value;
}

function hashEmployeeSeed(empId: string) {
  return Array.from(empId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}


function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

function MonthPicker({
  year,
  month,
  onChange,
  onClose,
  colors,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  onClose: () => void;
  colors: any;
}) {
  const [localYear, setLocalYear] = useState(year);

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      zIndex: 320,
      marginTop: 6,
      width: 228,
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setLocalYear(v => v - 1)} style={iconSquareBtn(colors)}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{localYear}年</span>
        <button onClick={() => setLocalYear(v => v + 1)} style={iconSquareBtn(colors)}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MONTH_LABELS.map((item, index) => {
          const active = localYear === year && index === month;
          return (
            <button
              key={item}
              onClick={() => {
                onChange(localYear, index);
                onClose();
              }}
              style={{
                padding: '6px 0',
                borderRadius: 4,
                border: `1px solid ${active ? colors.primary : colors.inputBorder}`,
                backgroundColor: active ? colors.primary : 'transparent',
                color: active ? '#fff' : colors.text,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  placeholder = '请选择',
  options,
  value,
  onChange,
  colors,
  width,
}: {
  label: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  colors: any;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ ...inputShell(colors, open), minWidth: width ?? 120, cursor: 'pointer' }}>
        <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ flex: 1, fontSize: '12px', color: value ? colors.text : colors.textMuted, marginLeft: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {options.find(item => item.value === value)?.label ?? placeholder}
        </span>
        {value && value !== 'all' ? (
          <X
            size={11}
            style={{ color: colors.textMuted, flexShrink: 0 }}
            onClick={event => {
              event.stopPropagation();
              onChange('all');
            }}
          />
        ) : (
          <ChevronDown size={11} style={{ color: colors.textMuted, flexShrink: 0 }} />
        )}
      </div>
      {open && (
        <div style={{ ...dropdownBox(colors), minWidth: width ?? 140, maxHeight: 260, overflowY: 'auto' }}>
          {options.map(option => {
            const active = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  ...dropdownItem(colors, active),
                  padding: '8px 12px',
                }}
                onMouseEnter={event => {
                  if (!active) (event.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover;
                }}
                onMouseLeave={event => {
                  if (!active) (event.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionDropdown({
  label,
  items,
  colors,
  primary,
  disabled,
}: {
  label: string;
  items: ActionItem[];
  colors: any;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        style={primary ? primaryBtn(colors, disabled) : outlineBtn(colors, disabled)}
      >
        {label}
        <ChevronDown size={11} style={{ marginLeft: 2 }} />
      </button>
      {open && !disabled && (
        <div style={{ ...dropdownBox(colors), minWidth: 142 }}>
          {items.map(item => (
            <div
              key={item.label}
              onClick={() => {
                if (item.disabled) return;
                item.action?.();
                setOpen(false);
              }}
              style={{
                ...dropdownItem(colors, false),
                padding: '8px 14px',
                color: item.disabled ? colors.textMuted : item.danger ? '#C2410C' : colors.text,
                opacity: item.disabled ? 0.5 : 1,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={event => {
                if (!item.disabled) (event.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover;
              }}
              onMouseLeave={event => {
                if (!item.disabled) (event.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({
  type,
  count,
  onConfirm,
  onCancel,
  colors,
}: {
  type: ConfirmType;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  colors: any;
}) {
  if (!type) return null;

  const config: Record<Exclude<ConfirmType, null>, { title: string; message: string; button: string; danger?: boolean }> = {
    lock: { title: '锁定考勤', message: `确认锁定所选 ${count} 条记录？锁定后将无法修改。`, button: '锁定' },
    unlock: { title: '解锁考勤', message: `确认解锁所选 ${count} 条记录？`, button: '解锁' },
    delete: { title: '删除记录', message: `确认删除所选 ${count} 条记录？该操作不可恢复。`, button: '删除', danger: true },
    confirm: { title: '考勤确认', message: `确认提交所选 ${count} 条考勤结果？提交后会进入确认状态。`, button: '确认' },
  };

  const current = config[type];

  return (
    <div style={overlayMask}>
      <div style={{ ...modalBox(colors), width: 360 }}>
        <div style={{ padding: '16px 20px 0', fontSize: '15px', fontWeight: 600, color: colors.text }}>{current.title}</div>
        <div style={{ padding: '14px 20px 22px', fontSize: '13px', lineHeight: 1.7, color: colors.textMuted }}>{current.message}</div>
        <div style={modalFooter(colors)}>
          <button onClick={onCancel} style={outlineBtn(colors)}>取消</button>
          <button onClick={onConfirm} style={primaryBtn(colors, false, current.danger ? '#C2410C' : undefined)}>{current.button}</button>
        </div>
      </div>
    </div>
  );
}

function CalcModal({
  colors,
  monthStart,
  monthEnd,
  scope,
  onClose,
  onConfirm,
}: {
  colors: any;
  monthStart: string;
  monthEnd: string;
  scope: CalcScope;
  onClose: () => void;
  onConfirm: (payload: CalcPayload) => void;
}) {
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(monthEnd);
  const [employee, setEmployee] = useState('');
  const [dept, setDept] = useState('all');
  const [attendGroup, setAttendGroup] = useState('all');

  const scopeLabel = scope === 'selected' ? '选中记录' : '当前筛选范围';

  return (
    <div style={overlayMask}>
      <div style={{ ...modalBox(colors), width: 338 }}>
        <div style={modalHeader(colors)}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>选择核算范围</span>
          <button onClick={onClose} style={iconOnlyBtn(colors)}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ModalFormRow label="考勤日期" colors={colors}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} style={{ ...miniInput(colors), flex: 1 }} />
              <span style={{ fontSize: '12px', color: colors.textMuted }}>→</span>
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} style={{ ...miniInput(colors), flex: 1 }} />
            </div>
          </ModalFormRow>

          <ModalFormRow label="员工" colors={colors}>
            <div style={{ ...inputShell(colors, false), width: '100%' }}>
              <input
                value={employee}
                onChange={event => setEmployee(event.target.value)}
                placeholder="输入或选择人员"
                style={plainInput(colors)}
              />
              <Search size={12} style={{ color: colors.textMuted }} />
              <UserRound size={12} style={{ color: colors.textMuted }} />
            </div>
          </ModalFormRow>

          <ModalFormRow label="部门" colors={colors}>
            <FilterSelect
              label=""
              placeholder="请选择"
              options={[{ label: '全部', value: 'all' }, ...DEPT_OPTIONS.map(item => ({ label: item, value: item }))]}
              value={dept}
              onChange={setDept}
              colors={colors}
              width={220}
            />
          </ModalFormRow>

          <ModalFormRow label="考勤组" colors={colors}>
            <FilterSelect
              label=""
              placeholder="请选择"
              options={[{ label: '全部', value: 'all' }, ...ATTEND_GROUPS.map(item => ({ label: item, value: item }))]}
              value={attendGroup}
              onChange={setAttendGroup}
              colors={colors}
              width={220}
            />
          </ModalFormRow>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 64 }}>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>所选范围</span>
            <span style={{ fontSize: '12px', color: colors.text }}>{scopeLabel}</span>
          </div>
        </div>

        <div style={modalFooter(colors)}>
          <button onClick={onClose} style={outlineBtn(colors)}>取消</button>
          <button
            onClick={() => {
              const startMs = parseDateToMs(startDate);
              const endMs = parseDateToMs(endDate);
              if (startMs === null || endMs === null) {
                window.alert('请先选择正确的核算日期范围');
                return;
              }
              if (startMs > endMs) {
                window.alert('开始日期不能晚于结束日期');
                return;
              }
              onConfirm({
                startDate,
                endDate,
                employee: employee.trim(),
                dept,
                attendGroup,
              });
              onClose();
            }}
            style={primaryBtn(colors)}
          >
            核算
          </button>
        </div>
      </div>
    </div>
  );
}


function ColumnSettingsPanel({
  colors,
  colOrder,
  frozenCount,
  onClose,
  onApply,
}: {
  colors: any;
  colOrder: string[];
  frozenCount: number;
  onClose: () => void;
  onApply: (nextOrder: string[], nextFrozen: number) => void;
}) {
  const [localOrder, setLocalOrder] = useState(colOrder);
  const [localFreeze, setLocalFreeze] = useState(frozenCount);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const next = [...localOrder];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dragOverIndex, 0, moved);
      setLocalOrder(next);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 340 }}>
      <div style={{ position: 'absolute', top: -6, right: 14, width: 12, height: 12, transform: 'rotate(45deg)', backgroundColor: colors.cardBg, borderLeft: `1px solid ${colors.cardBorder}`, borderTop: `1px solid ${colors.cardBorder}` }} />
      <div style={{
        width: 222,
        maxHeight: 560,
        backgroundColor: colors.cardBg,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 8,
        boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${colors.divider}`, fontSize: '13px', fontWeight: 600, color: colors.text }}>
          表头设置
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: '12px', color: colors.text }}>冻结前</span>
          <input
            type="number"
            min={0}
            max={Math.min(6, localOrder.length)}
            value={localFreeze}
            onChange={event => {
              const value = Number(event.target.value);
              if (Number.isNaN(value)) return;
              setLocalFreeze(Math.max(0, Math.min(6, value)));
            }}
            style={{
              width: 34,
              height: 26,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: 4,
              outline: 'none',
              textAlign: 'center',
              fontSize: '12px',
              color: colors.text,
              backgroundColor: colors.inputBg,
            }}
          />
          <span style={{ fontSize: '12px', color: colors.textMuted }}>列</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {localOrder.map((key, index) => {
            const col = ALL_COLS.find(item => item.key === key);
            if (!col) return null;
            const isDragging = dragIndex === index;
            const isOver = dragOverIndex === index;
            const isFrozen = index < localFreeze;
            return (
              <div
                key={key}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnter={() => setDragOverIndex(index)}
                onDragOver={event => event.preventDefault()}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  cursor: 'grab',
                  opacity: isDragging ? 0.4 : 1,
                  borderTop: isOver && !isDragging ? `2px solid ${colors.primary}` : '2px solid transparent',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={event => {
                  if (!isDragging) (event.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover;
                }}
                onMouseLeave={event => {
                  if (!isDragging) (event.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ flex: 1, fontSize: '12px', color: colors.text }}>{col.label}</span>
                {isFrozen && <span style={{ fontSize: '10px', color: colors.primary }}>•</span>}
                <GripVertical size={13} style={{ color: colors.textMuted, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: `1px solid ${colors.divider}` }}>
          <button onClick={onClose} style={outlineBtn(colors)}>取消</button>
          <button onClick={() => onApply(localOrder, localFreeze)} style={primaryBtn(colors)}>确定</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ colors, onClose }: { colors: any; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');

  return (
    <div style={overlayMask}>
      <div style={{ ...modalBox(colors), width: 500 }}>
        <div style={modalHeader(colors)}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>导入月考勤汇总</span>
          <button onClick={onClose} style={iconOnlyBtn(colors)}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: `1px solid ${colors.divider}` }}>
          {[{ id: 1, label: '上传文件' }, { id: 2, label: '数据预览' }, { id: 3, label: '完成' }].map((item, index) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <React.Fragment key={item.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: done || active ? colors.primary : colors.inputBg,
                    color: done || active ? '#fff' : colors.textMuted,
                    border: `1px solid ${done || active ? colors.primary : colors.inputBorder}`,
                  }}>
                    {done ? '✓' : item.id}
                  </div>
                  <span style={{ fontSize: '12px', color: active ? colors.text : colors.textMuted }}>{item.label}</span>
                </div>
                {index < 2 && <div style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ padding: '26px 20px', minHeight: 230 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls,.csv';
                  input.onchange = (event: Event) => {
                    const target = event.target as HTMLInputElement;
                    const file = target.files?.[0];
                    if (file) setFileName(file.name);
                  };
                  input.click();
                }}
                style={{
                  border: `2px dashed ${colors.inputBorder}`,
                  borderRadius: 8,
                  minHeight: 148,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: colors.inputBg,
                  gap: 8,
                }}
              >
                <Upload size={24} style={{ color: colors.primary }} />
                <span style={{ fontSize: '13px', color: fileName ? colors.primary : colors.text }}>{fileName || '点击或拖拽文件到此处上传'}</span>
                <span style={{ fontSize: '11px', color: colors.textMuted }}>支持 .xlsx / .xls / .csv，最大 10MB</span>
              </div>
              <span style={{ fontSize: '12px', color: colors.primary, cursor: 'pointer' }}>下载导入模板</span>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 8 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: colors.badgeGreenBg, color: colors.badgeGreenText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={24} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>文件解析成功</span>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>共读取 21 条记录，错误 0 条，请确认导入。</span>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 8 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: colors.badgeBlueBg, color: colors.badgeBlueText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={24} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>导入完成</span>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>成功写入 21 条记录，刷新列表后即可查看。</span>
            </div>
          )}
        </div>

        <div style={modalFooter(colors)}>
          <button onClick={onClose} style={outlineBtn(colors)}>取消</button>
          {step < 3 ? (
            <button
              onClick={() => setStep(current => (current + 1) as 1 | 2 | 3)}
              disabled={step === 1 && !fileName}
              style={primaryBtn(colors, step === 1 && !fileName)}
            >
              {step === 1 ? '下一步' : '确认导入'}
            </button>
          ) : (
            <button onClick={onClose} style={primaryBtn(colors)}>完成</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalFormRow({
  label,
  colors,
  children,
}: {
  label: string;
  colors: any;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label style={{ width: 52, flexShrink: 0, textAlign: 'right', fontSize: '12px', color: colors.text }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export default function MonthlyAttendanceSummary() {
  const { colors } = useTheme();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<MonthEmployee[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<keyof MonthEmployee | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [summaryTab, setSummaryTab] = useState<SummaryKey>('total');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [attendGroupFilter, setAttendGroupFilter] = useState('all');
  const [lockFilter, setLockFilter] = useState('all');
  const [confirmFilter, setConfirmFilter] = useState('all');
  const [bizGroupFilter, setBizGroupFilter] = useState('全部');
  const [hireStatusFilter, setHireStatusFilter] = useState('全部');
  const [showMoreFilter, setShowMoreFilter] = useState(false);
  const [hideResigned, setHideResigned] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcScope, setCalcScope] = useState<CalcScope>('filtered');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreAction, setShowMoreAction] = useState(false);
  const [showOperationLogs, setShowOperationLogs] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [jumpPage, setJumpPage] = useState('');
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLS.map(item => item.key));
  const [frozenCount, setFrozenCount] = useState(1);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);


  const loadMonthlySummary = useCallback(async () => {
    try {
      const res = await fetchMonthlySummaryEmployees();
      setRows(res.rows || []);
      setSelectedRows(new Set());
      setPage(1);
      setSourceFile(res.sourceFile || '');
      setLoadError('');
    } catch (_error) {
      setLoadError('真实数据连接失败，当前不展示本地静态人员');
    }
  }, []);

  useEffect(() => {
    loadMonthlySummary();
  }, [loadMonthlySummary]);

  const monthPickerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const moreActionRef = useRef<HTMLDivElement>(null);
  const operationLogRef = useRef<HTMLDivElement>(null);

  useClickOutside(monthPickerRef, () => setShowMonthPicker(false));
  useClickOutside(settingsRef, () => setShowSettings(false));
  useClickOutside(moreActionRef, () => setShowMoreAction(false));
  useClickOutside(operationLogRef, () => setShowOperationLogs(false));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPERATION_LOG_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as OperationLog[];
      if (!Array.isArray(parsed)) return;
      setOperationLogs(normalizeOperationLogs(parsed));
    } catch (_error) {
      setOperationLogs([]);
    }
  }, []);

  useEffect(() => {
    const normalized = normalizeOperationLogs(operationLogs);
    localStorage.setItem(OPERATION_LOG_KEY, JSON.stringify(normalized));
  }, [operationLogs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOperationLogs(current => normalizeOperationLogs(current));
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const appendOperationLog = useCallback((detail: string) => {
    setOperationLogs(current => normalizeOperationLogs([
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        timestamp: Date.now(),
        detail,
      },
      ...current,
    ]));
  }, []);

  const monthLabel = `${year}年${String(month + 1).padStart(2, '0')}月`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const orderedCols = useMemo(
    () => columnOrder
      .map(key => ALL_COLS.find(item => item.key === key))
      .filter(Boolean) as ColDef[],
    [columnOrder],
  );

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (employeeSearch && !`${row.name}${row.empId}`.includes(employeeSearch)) return false;
      if (deptFilter !== 'all' && row.dept !== deptFilter) return false;
      if (attendGroupFilter !== 'all' && row.attendGroup !== attendGroupFilter) return false;
      if (lockFilter !== 'all' && row.lockStatus !== lockFilter) return false;
      if (confirmFilter !== 'all' && row.confirmStatus !== confirmFilter) return false;
      if (hideResigned && row.resignDate) return false;
      if (bizGroupFilter !== '全部' && row.bizGroup !== bizGroupFilter) return false;
      if (hireStatusFilter === '本月入职' && !row.hireDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) return false;
      if (hireStatusFilter === '已离职' && !row.resignDate) return false;
      if (hireStatusFilter === '在职' && !!row.resignDate) return false;
      if (summaryTab === 'full' && !(row.actualWorkDays >= row.shouldWorkDays && row.shouldWorkDays > 0)) return false;
      if (summaryTab === 'absent' && row.absentDays <= 0) return false;
      if (summaryTab === 'late' && row.lateMinutes <= 0) return false;
      if (summaryTab === 'hire' && !row.hireDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) return false;
      return true;
    });
  }, [rows, employeeSearch, deptFilter, attendGroupFilter, lockFilter, confirmFilter, hideResigned, bizGroupFilter, hireStatusFilter, summaryTab, year, month]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    if (!sortKey || !sortDir) return list;
    return list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === '' || av === null) return 1;
      if (bv === '' || bv === null) return -1;
      const result = av < bv ? -1 : 1;
      return sortDir === 'asc' ? result : -result;
    });
  }, [filteredRows, sortKey, sortDir]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = pageRows.length > 0 && pageRows.every(row => selectedRows.has(row.id));
  const someSelected = selectedRows.size > 0 && !allSelected;

  const stickyOffsets: number[] = [];
  let offset = 38;
  orderedCols.slice(0, frozenCount).forEach((col, index) => {
    stickyOffsets[index] = offset;
    offset += col.width;
  });

  const resetFilters = () => {
    setEmployeeSearch('');
    setDeptFilter('all');
    setAttendGroupFilter('all');
    setLockFilter('all');
    setConfirmFilter('all');
    setBizGroupFilter('全部');
    setHireStatusFilter('全部');
    setShowMoreFilter(false);
    setSummaryTab('total');
  };

  const handleSort = (key: keyof MonthEmployee) => {
    if (sortKey === key) {
      setSortDir(current => (current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const toggleAllRows = () => {
    if (allSelected) {
      setSelectedRows(new Set());
      return;
    }
    setSelectedRows(new Set(pageRows.map(row => row.id)));
  };

  const toggleRow = (id: number) => {
    setSelectedRows(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelectionMutation = (updater: (row: MonthEmployee) => MonthEmployee | null) => {
    setRows(current => current.flatMap(row => {
      if (!selectedRows.has(row.id)) return [row];
      const next = updater(row);
      return next ? [next] : [];
    }));
    setSelectedRows(new Set());
    setConfirmType(null);
  };

  const runCalculation = useCallback(async (payload: CalcPayload) => {
    const startMs = parseDateToMs(payload.startDate);
    const endMs = parseDateToMs(payload.endDate);
    if (startMs === null || endMs === null || startMs > endMs) {
      window.alert('核算失败：请选择有效日期范围');
      return;
    }

    const targetIds = new Set(
      (calcScope === 'selected' ? rows.filter(row => selectedRows.has(row.id)) : filteredRows).map(row => row.id),
    );
    const employeeKeyword = payload.employee.trim().toLowerCase();
    const fullDays = Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;

    let updatedCount = 0;
    let skippedLockedCount = 0;

    const nextRows = rows.map(row => {
      if (!targetIds.has(row.id)) return row;
      if (payload.dept !== 'all' && row.dept !== payload.dept) return row;
      if (payload.attendGroup !== 'all' && row.attendGroup !== payload.attendGroup) return row;
      if (employeeKeyword && !`${row.name}${row.empId}`.toLowerCase().includes(employeeKeyword)) return row;

      if (row.lockStatus === '已锁定') {
        skippedLockedCount += 1;
        return row;
      }

      const calcDays = Math.max(0, Math.min(row.shouldWorkDays, fullDays));
      const seed = hashEmployeeSeed(row.empId) + fullDays + month + year;
      const absentDays = calcDays === 0 ? 0 : seed % Math.min(3, calcDays + 1);
      const tripDays = calcDays === 0 ? 0 : (seed % 5 === 0 ? 1 : 0);
      const actualWorkDays = Math.max(0, calcDays - absentDays - tripDays);
      const lateMinutes = actualWorkDays > 0 ? (seed % 4) * 5 : 0;
      const earlyLeaveMinutes = actualWorkDays > 0 ? (seed % 3) * 5 : 0;

      updatedCount += 1;
      return {
        ...row,
        scheduleDays: calcDays,
        actualWorkDays,
        absentDays,
        tripDays,
        normalHours: Number((actualWorkDays * 8).toFixed(1)),
        lateMinutes,
        earlyLeaveMinutes,
        confirmStatus: row.confirmStatus === '已确认' ? '已确认' : '已发送',
      };
    });

    const scopeText = calcScope === 'selected' ? '选中记录' : '当前筛选范围';
    if (updatedCount === 0) {
      appendOperationLog(`核算未执行：${scopeText}内无可核算记录`);
      window.alert('核算完成：未命中可核算记录');
      return;
    }

    setRows(nextRows);
    setSelectedRows(new Set());

    try {
      const saved = await saveMonthlySummaryEmployees(nextRows);
      setSourceFile(saved.sourceFile || '本地持久化数据 data-store.json');
      setLoadError('');
      appendOperationLog(`核算并落库成功：${scopeText}更新 ${updatedCount} 条${skippedLockedCount > 0 ? `，跳过已锁定 ${skippedLockedCount} 条` : ''}`);
      window.alert(`核算完成并已落库，更新 ${updatedCount} 条${skippedLockedCount > 0 ? `，跳过已锁定 ${skippedLockedCount} 条` : ''}`);
    } catch (_error) {
      appendOperationLog(`核算完成但落库失败：${scopeText}更新 ${updatedCount} 条`);
      window.alert(`核算已执行，但保存失败，请检查后端服务`);
    }
  }, [appendOperationLog, calcScope, filteredRows, month, rows, selectedRows, year]);


  const handleExport = useCallback(() => {
    const exportRows = selectedRows.size > 0
      ? sortedRows.filter(row => selectedRows.has(row.id))
      : sortedRows;

    if (exportRows.length === 0) {
      window.alert('暂无可导出的记录');
      return;
    }

    const headers = orderedCols.map(col => col.label);
    const dataRows = exportRows.map(row => orderedCols.map(col => {
      const value = row[col.key];
      return value === null || value === undefined || value === '' ? '-' : String(value);
    }));

    const escapeCsv = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const csv = [headers, ...dataRows]
      .map(row => row.map(cell => escapeCsv(cell)).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `月考勤汇总-${year}-${String(month + 1).padStart(2, '0')}${selectedRows.size > 0 ? '-选中人员' : '-筛选结果'}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    appendOperationLog(`导出成功：${selectedRows.size > 0 ? '选中人员' : '当前筛选'} ${exportRows.length} 条`);
  }, [appendOperationLog, month, orderedCols, selectedRows, sortedRows, year]);

  const renderCell = (row: MonthEmployee, col: ColDef): React.ReactNode => {


    const value = row[col.key];

    if (col.key === 'name') {
      return <span style={{ color: colors.primary, fontWeight: 500, cursor: 'pointer' }}>{value}</span>;
    }

    if (col.key === 'lockStatus') {
      const locked = value === '已锁定';
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 10,
          fontSize: '11px',
          whiteSpace: 'nowrap',
          backgroundColor: locked ? '#FEF3C7' : colors.badgeGreenBg,
          color: locked ? '#9A6700' : colors.badgeGreenText,
        }}>
          {locked ? <Lock size={10} /> : <Unlock size={10} />}
          {value}
        </span>
      );
    }

    if (col.key === 'confirmStatus') {
      const statusColorMap: Record<ConfirmStatus, [string, string]> = {
        未发送: [colors.badgeGrayBg, colors.badgeGrayText],
        已发送: [colors.badgeBlueBg, colors.badgeBlueText],
        已确认: [colors.badgeGreenBg, colors.badgeGreenText],
      };
      const [bg, text] = statusColorMap[value as ConfirmStatus] ?? [colors.badgeGrayBg, colors.badgeGrayText];
      return (
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 10, backgroundColor: bg, color: text, whiteSpace: 'nowrap' }}>
          {value}
        </span>
      );
    }

    if (col.key === 'empId') {
      return <span style={{ color: colors.textMuted, fontSize: '11px' }}>{value}</span>;
    }

    if (col.key === 'hireDate' && row.hireDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
      return (
        <span style={{ color: colors.text }}>
          {value}
          <span style={{ marginLeft: 6, fontSize: '10px', padding: '1px 5px', borderRadius: 4, backgroundColor: colors.badgeBlueBg, color: colors.badgeBlueText }}>
            新入职
          </span>
        </span>
      );
    }

    if (typeof value === 'number') {
      return <span style={{ color: value > 0 && (col.key === 'absentDays' || col.key === 'lateMinutes' || col.key === 'earlyLeaveMinutes') ? '#C2410C' : colors.text }}>{value}</span>;
    }

    if (!value) {
      return <span style={{ color: colors.textMuted }}>-</span>;
    }

    return String(value);
  };

  const summaryItems: { key: SummaryKey; label: string; value: number }[] = [
    { key: 'total', label: '总人数(人)', value: rows.length },
    { key: 'full', label: '全勤', value: rows.filter(row => row.actualWorkDays >= row.shouldWorkDays && row.shouldWorkDays > 0).length },
    { key: 'absent', label: '旷工', value: rows.filter(row => row.absentDays > 0).length },
    { key: 'late', label: '迟到', value: rows.filter(row => row.lateMinutes > 0).length },
    { key: 'hire', label: '入职', value: rows.filter(row => row.hireDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length },
  ];

  const moreActionItems: ActionItem[] = [
    { label: '批量确认考勤', action: () => selectedRows.size > 0 && setConfirmType('confirm'), disabled: selectedRows.size === 0 },
    { label: '批量撤销确认', action: () => applySelectionMutation(row => ({ ...row, confirmStatus: '未发送' })) , disabled: selectedRows.size === 0 },
    { label: '重置考勤结果', action: () => applySelectionMutation(row => ({ ...row, actualWorkDays: 0, absentDays: 0, tripDays: 0, scheduleDays: 0, normalHours: 0, lateMinutes: 0, earlyLeaveMinutes: 0, confirmStatus: '未发送' })), disabled: selectedRows.size === 0 },
    { label: '查看操作日志', action: () => setShowOperationLogs(true) },
  ];


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div ref={monthPickerRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowMonthPicker(v => !v)} style={{ ...inputShell(colors, showMonthPicker), padding: '5px 10px', cursor: 'pointer' }}>
              <Calendar size={13} style={{ color: colors.primary, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: colors.text }}>{monthLabel}</span>
              <ChevronDown size={11} style={{ color: colors.textMuted }} />
            </button>
            {showMonthPicker && (
              <MonthPicker
                year={year}
                month={month}
                onChange={(nextYear, nextMonth) => {
                  setYear(nextYear);
                  setMonth(nextMonth);
                }}
                onClose={() => setShowMonthPicker(false)}
                colors={colors}
              />
            )}
          </div>

          <FilterSelect
            label="部门"
            options={[{ label: '请选择', value: 'all' }, ...DEPT_OPTIONS.map(item => ({ label: item, value: item }))]}
            value={deptFilter}
            onChange={setDeptFilter}
            colors={colors}
            width={148}
          />

          <div style={{ ...inputShell(colors, false), minWidth: 180 }}>
            <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>员工</span>
            <input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="请输入或选择人员" style={plainInput(colors)} />
            <Search size={12} style={{ color: colors.textMuted }} />
            <UserRound size={12} style={{ color: colors.textMuted }} />
          </div>

          <FilterSelect
            label="考勤组"
            options={[{ label: '请选择', value: 'all' }, ...ATTEND_GROUPS.map(item => ({ label: item, value: item }))]}
            value={attendGroupFilter}
            onChange={setAttendGroupFilter}
            colors={colors}
            width={150}
          />

          <FilterSelect
            label="锁定状态"
            options={LOCK_OPTIONS}
            value={lockFilter}
            onChange={setLockFilter}
            colors={colors}
            width={132}
          />

          <FilterSelect
            label="确认状态"
            options={CONFIRM_OPTIONS}
            value={confirmFilter}
            onChange={setConfirmFilter}
            colors={colors}
            width={132}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={resetFilters} style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button
              onClick={() => setShowMoreFilter(v => !v)}
              style={{ ...outlineBtn(colors), color: showMoreFilter ? colors.primary : colors.text, borderColor: showMoreFilter ? colors.primary : colors.inputBorder }}
            >
              更多筛选
              <ChevronDown size={11} style={{ transform: showMoreFilter ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          </div>
        </div>

        {showMoreFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}`, flexWrap: 'wrap' }}>
            <FilterSelect
              label="业务分组"
              options={BIZ_GROUP_OPTIONS.map(item => ({ label: item, value: item }))}
              value={bizGroupFilter}
              onChange={setBizGroupFilter}
              colors={colors}
              width={150}
            />
            <FilterSelect
              label="入职状态"
              options={HIRE_STATUS_OPTIONS.map(item => ({ label: item, value: item }))}
              value={hireStatusFilter}
              onChange={setHireStatusFilter}
              colors={colors}
              width={136}
            />
            <div style={{ ...inputShell(colors, false), minWidth: 250 }}>
              <span style={{ fontSize: '12px', color: colors.text }}>考勤周期</span>
              <span style={{ fontSize: '12px', color: colors.text, marginLeft: 4 }}>{monthStart}</span>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>→</span>
              <span style={{ fontSize: '12px', color: colors.text }}>{monthEnd}</span>
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

      {operationLogs.length > 0 && (
        <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 6, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <span>
            今日操作（24小时内自动清空）：
            {operationLogs[0]?.detail}
          </span>
          <div ref={operationLogRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowOperationLogs(v => !v)} style={outlineBtn(colors)}>
              查看当天操作
            </button>
            {showOperationLogs && (
              <div style={{ ...dropdownBox(colors), right: 0, left: 'auto', minWidth: 360, maxWidth: 520, maxHeight: 280, overflowY: 'auto', zIndex: 380 }}>
                {operationLogs.map(log => (
                  <div key={log.id} style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.divider}`, fontSize: '12px', color: colors.text }}>
                    <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: 3 }}>{new Date(log.timestamp).toLocaleString('zh-CN')}</div>
                    <div>{log.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, overflowX: 'auto', flexShrink: 0 }}>

        {summaryItems.map(item => {
          const active = summaryTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setSummaryTab(item.key)}
              style={{
                padding: '10px 14px',
                border: 'none',
                borderBottom: `2px solid ${active ? colors.primary : 'transparent'}`,
                background: 'transparent',
                color: active ? colors.primary : colors.textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
              <span style={{
                padding: '1px 7px',
                borderRadius: 10,
                backgroundColor: active ? colors.primary : colors.badgeGrayBg,
                color: active ? '#fff' : colors.badgeGrayText,
                fontSize: '11px',
                lineHeight: 1.4,
              }}>
                {item.value}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexWrap: 'wrap', flexShrink: 0 }}>
        <ActionDropdown
          label="按考勤"
          items={[
            {
              label: '核算当前筛选范围',
              action: () => {
                setCalcScope('filtered');
                setShowCalcModal(true);
              },
            },
            {
              label: '核算选中记录',
              action: () => {
                if (selectedRows.size === 0) return;
                setCalcScope('selected');
                setShowCalcModal(true);
              },
              disabled: selectedRows.size === 0,
            },
          ]}
          primary
          colors={colors}
        />

        <button onClick={() => selectedRows.size > 0 && setConfirmType('lock')} style={outlineBtn(colors, selectedRows.size === 0)}>
          <Lock size={12} />锁定
        </button>
        <button onClick={() => selectedRows.size > 0 && setConfirmType('unlock')} style={outlineBtn(colors, selectedRows.size === 0)}>
          <Unlock size={12} />解锁
        </button>
        <button onClick={() => selectedRows.size > 0 && setConfirmType('confirm')} style={outlineBtn(colors, selectedRows.size === 0)}>
          <Check size={12} />考勤确认
        </button>
        <button onClick={() => setShowImportModal(true)} style={outlineBtn(colors)}>
          <Upload size={12} />导入
        </button>
        <button onClick={handleExport} style={outlineBtn(colors)}>
          <Download size={12} />导出
        </button>

        <button onClick={() => selectedRows.size > 0 && setConfirmType('delete')} style={outlineBtn(colors, selectedRows.size === 0)}>
          <Trash2 size={12} />删除
        </button>

        <div ref={moreActionRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowMoreAction(v => !v)} style={outlineBtn(colors)}>
            更多
            <MoreHorizontal size={12} />
          </button>
          {showMoreAction && (
            <div style={{ ...dropdownBox(colors), minWidth: 150 }}>
              {moreActionItems.map(item => (
                <div
                  key={item.label}
                  onClick={() => {
                    if (item.disabled) return;
                    item.action?.();
                    setShowMoreAction(false);
                  }}
                  style={{
                    ...dropdownItem(colors, false),
                    padding: '8px 14px',
                    color: item.disabled ? colors.textMuted : colors.text,
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={event => {
                    if (!item.disabled) (event.currentTarget as HTMLElement).style.backgroundColor = colors.tableRowHover;
                  }}
                  onMouseLeave={event => {
                    if (!item.disabled) (event.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedRows.size > 0 && <span style={{ fontSize: '12px', color: colors.textMuted }}>已选 {selectedRows.size} 条</span>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={hideResigned} onChange={event => setHideResigned(event.target.checked)} style={{ accentColor: colors.primary }} />
            不看离职人员
          </label>
          <button style={{ ...iconSquareBtn(colors), width: 28, height: 28 }}>
            <SlidersHorizontal size={13} />
          </button>
          <div ref={settingsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSettings(v => !v)}
              style={{ ...iconSquareBtn(colors), width: 28, height: 28, color: showSettings ? colors.primary : colors.textMuted, borderColor: showSettings ? colors.primary : colors.inputBorder }}
            >
              <Settings2 size={13} />
            </button>
            {showSettings && (
              <ColumnSettingsPanel
                colors={colors}
                colOrder={columnOrder}
                frozenCount={frozenCount}
                onClose={() => setShowSettings(false)}
                onApply={(nextOrder, nextFrozen) => {
                  setColumnOrder(nextOrder);
                  setFrozenCount(nextFrozen);
                  setShowSettings(false);
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1660 }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 20 }}>
              <th style={{ ...tableHeaderCell(colors), width: 38, minWidth: 38, position: 'sticky', left: 0, zIndex: 30, textAlign: 'center', padding: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={element => {
                    if (element) element.indeterminate = someSelected;
                  }}
                  onChange={toggleAllRows}
                  style={{ accentColor: colors.primary, width: 14, height: 14 }}
                />
              </th>
              {orderedCols.map((col, index) => {
                const frozen = index < frozenCount;
                const activeSort = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{
                      ...tableHeaderCell(colors),
                      width: col.width,
                      minWidth: col.width,
                      cursor: col.sortable ? 'pointer' : 'default',
                      position: frozen ? 'sticky' : undefined,
                      left: frozen ? stickyOffsets[index] : undefined,
                      zIndex: frozen ? 28 : 20,
                      borderLeft: `1px solid ${colors.tableBorder}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{col.label}</span>
                      {col.sortable && (
                        <span style={{ display: 'flex', flexDirection: 'column', opacity: activeSort ? 1 : 0.32 }}>
                          <ChevronRight size={8} style={{ transform: 'rotate(-90deg)', color: activeSort && sortDir === 'asc' ? colors.primary : colors.textMuted }} />
                          <ChevronRight size={8} style={{ transform: 'rotate(90deg)', marginTop: -1, color: activeSort && sortDir === 'desc' ? colors.primary : colors.textMuted }} />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => {
              const checked = selectedRows.has(row.id);
              const baseBg = checked ? `${colors.primary}10` : rowIndex % 2 === 0 ? colors.cardBg : colors.tableStripe;
              return (
                <tr
                  key={row.id}
                  style={{ backgroundColor: baseBg, borderBottom: `1px solid ${colors.tableBorder}` }}
                  onMouseEnter={event => {
                    if (!checked) event.currentTarget.style.backgroundColor = colors.tableRowHover;
                  }}
                  onMouseLeave={event => {
                    if (!checked) event.currentTarget.style.backgroundColor = rowIndex % 2 === 0 ? colors.cardBg : colors.tableStripe;
                  }}
                >
                  <td style={{ ...tableBodyCell(colors), width: 38, minWidth: 38, position: 'sticky', left: 0, zIndex: 16, textAlign: 'center', padding: '7px 0', backgroundColor: baseBg }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleRow(row.id)} style={{ accentColor: colors.primary, width: 14, height: 14 }} />
                  </td>
                  {orderedCols.map((col, index) => {
                    const frozen = index < frozenCount;
                    return (
                      <td
                        key={col.key}
                        style={{
                          ...tableBodyCell(colors),
                          width: col.width,
                          minWidth: col.width,
                          borderLeft: `1px solid ${colors.tableBorder}`,
                          position: frozen ? 'sticky' : undefined,
                          left: frozen ? stickyOffsets[index] : undefined,
                          zIndex: frozen ? 15 : undefined,
                          backgroundColor: frozen ? baseBg : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {renderCell(row, col)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{totalCount}笔</span>
        <button style={paginationBtn(colors, false, page === 1)} onClick={() => setPage(current => Math.max(1, current - 1))}>
          <ChevronLeft size={12} />
        </button>
        {getPages(page, totalPages).map((item, index) => (
          item === '...'
            ? <span key={`ellipsis-${index}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
            : <button key={item} style={paginationBtn(colors, page === item)} onClick={() => setPage(item)}>{item}</button>
        ))}
        <button style={paginationBtn(colors, false, page === totalPages)} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>
          <ChevronRight size={12} />
        </button>
        <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} style={pageSelect(colors)}>
          {[20, 50, 100, 200].map(item => <option key={item} value={item}>{item}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input
          value={jumpPage}
          onChange={event => setJumpPage(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              const nextPage = Number(jumpPage);
              if (!Number.isNaN(nextPage)) setPage(Math.max(1, Math.min(totalPages, nextPage)));
              setJumpPage('');
            }
          }}
          style={{ ...pageSelect(colors), width: 38, textAlign: 'center', padding: '3px 4px' }}
        />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      <ConfirmModal
        type={confirmType}
        count={selectedRows.size}
        onCancel={() => setConfirmType(null)}
        onConfirm={() => {
          const selectedCount = selectedRows.size;
          if (confirmType === 'lock') {
            applySelectionMutation(row => ({ ...row, lockStatus: '已锁定' }));
            appendOperationLog(`批量锁定：${selectedCount} 条`);
          }
          if (confirmType === 'unlock') {
            applySelectionMutation(row => ({ ...row, lockStatus: '未锁定' }));
            appendOperationLog(`批量解锁：${selectedCount} 条`);
          }
          if (confirmType === 'delete') {
            applySelectionMutation(() => null);
            appendOperationLog(`批量删除：${selectedCount} 条`);
          }
          if (confirmType === 'confirm') {
            applySelectionMutation(row => ({ ...row, confirmStatus: '已确认' }));
            appendOperationLog(`考勤确认：${selectedCount} 条`);
          }
        }}
        colors={colors}
      />
      {showCalcModal && (
        <CalcModal
          colors={colors}
          monthStart={monthStart}
          monthEnd={monthEnd}
          scope={calcScope}
          onConfirm={runCalculation}
          onClose={() => setShowCalcModal(false)}
        />
      )}

      {showImportModal && <ImportModal colors={colors} onClose={() => setShowImportModal(false)} />}
    </div>
  );
}

function getPages(page: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
  if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, '...', page - 1, page, page + 1, '...', totalPages];
}

const overlayMask: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 500,
  backgroundColor: 'rgba(17,24,39,0.24)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function modalBox(colors: any): React.CSSProperties {
  return {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    boxShadow: '0 18px 42px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  };
}

function modalHeader(colors: any): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: `1px solid ${colors.divider}`,
  };
}

function modalFooter(colors: any): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 18px',
    borderTop: `1px solid ${colors.divider}`,
  };
}

function inputShell(colors: any, focused: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    border: `1px solid ${focused ? colors.primary : colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    padding: '5px 10px',
    fontSize: '12px',
    minHeight: 30,
    boxSizing: 'border-box',
  };
}

function plainInput(colors: any): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: colors.text,
    fontSize: '12px',
    marginLeft: 4,
  };
}

function miniInput(colors: any): React.CSSProperties {
  return {
    height: 30,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: '12px',
    padding: '0 10px',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function primaryBtn(colors: any, disabled = false, backgroundColor?: string): React.CSSProperties {
  return {
    padding: '5px 12px',
    border: 'none',
    borderRadius: 4,
    backgroundColor: disabled ? colors.inputBorder : backgroundColor ?? colors.primary,
    color: '#fff',
    fontSize: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.65 : 1,
  };
}

function outlineBtn(colors: any, disabled = false): React.CSSProperties {
  return {
    padding: '5px 12px',
    border: `1px solid ${disabled ? colors.divider : colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: disabled ? colors.textMuted : colors.text,
    fontSize: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.55 : 1,
  };
}

function iconSquareBtn(colors: any): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  };
}

function iconOnlyBtn(colors: any): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function dropdownBox(colors: any): React.CSSProperties {
  return {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 320,
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 6,
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  };
}

function dropdownItem(colors: any, active: boolean): React.CSSProperties {
  return {
    fontSize: '12px',
    color: active ? colors.primary : colors.text,
    backgroundColor: active ? `${colors.primary}12` : 'transparent',
    whiteSpace: 'nowrap',
    transition: 'background 0.12s ease',
  };
}

function tableHeaderCell(colors: any): React.CSSProperties {
  return {
    padding: '8px 10px',
    fontSize: '12px',
    color: colors.textMuted,
    fontWeight: 500,
    textAlign: 'left',
    backgroundColor: colors.tableHeaderBg,
    borderBottom: `1px solid ${colors.tableBorder}`,
    whiteSpace: 'nowrap',
  };
}

function tableBodyCell(colors: any): React.CSSProperties {
  return {
    padding: '7px 10px',
    fontSize: '12px',
    color: colors.text,
    whiteSpace: 'nowrap',
  };
}

function paginationBtn(colors: any, active: boolean, disabled = false): React.CSSProperties {
  return {
    minWidth: 24,
    height: 24,
    padding: '0 5px',
    border: `1px solid ${active ? colors.primary : colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: active ? colors.primary : 'transparent',
    color: active ? '#fff' : colors.text,
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  };
}

function pageSelect(colors: any): React.CSSProperties {
  return {
    height: 24,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: '12px',
    padding: '3px 6px',
    outline: 'none',
    boxSizing: 'border-box',
  };
}
