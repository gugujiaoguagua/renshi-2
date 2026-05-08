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

function showActionFeedback(action: string) {
  window.alert(`加班管理：${action}（交互已接通）`);
}

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

function DateRangeField({ colors }: { colors: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>
        <span style={{ color: colors.primary, marginRight: 2 }}>*</span>
        加班日期
      </span>
      <div style={fieldShell(colors, 274)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input defaultValue="2026-05-01" type="date" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input defaultValue="2026-05-31" type="date" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  colors,
  width,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width ?? 144)}>
        <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1 }}>{placeholder}</span>
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
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width ?? 174)}>
        <input placeholder={placeholder} style={textInput(colors)} />
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
          <DateRangeField colors={colors} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={144} />
          <SearchField label="申请人姓名/员工号" placeholder="请输入人员或员工号" colors={colors} width={182} />
          <SearchField label="发起人姓名/员工号" placeholder="请输入人员或员工号" colors={colors} width={182} />
          <SelectField label="记录状态" placeholder="请选择" colors={colors} width={138} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => showActionFeedback('重置筛选')} style={outlineBtn(colors)}>重置</button>
            <button onClick={() => showActionFeedback('查询记录')} style={primaryBtn(colors)}>查询</button>
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
            <SelectField label="加班类型" placeholder={OVERTIME_TYPE_OPTIONS[0]} colors={colors} width={144} />
            <SelectField label="补偿方式" placeholder={COMPENSATE_OPTIONS[0]} colors={colors} width={144} />
            <SelectField label="折算方式" placeholder={CONVERT_OPTIONS[0]} colors={colors} width={144} />
            <SearchField label="加班规则" placeholder="请输入规则名称" colors={colors} width={176} />
          </div>
        )}
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
          onSelect={(item) => showActionFeedback(item.label)}
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
          onSelect={(item) => showActionFeedback(item.label)}
          colors={colors}
        />
        <button onClick={() => showActionFeedback('转为调休假')} style={outlineBtn(colors)}>转为调休假</button>
        <button onClick={() => showActionFeedback('导出加班记录')} style={outlineBtn(colors)}>导出</button>
        <button style={disabledBtn(colors)} disabled>删除</button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => showActionFeedback('集体加班')} style={linkBtn(colors)}>
            <Users size={12} />
            集体加班
          </button>
          <button onClick={() => showActionFeedback('批量导加班记录')} style={linkBtn(colors)}>
            <Upload size={12} />
            批量导加班记录
          </button>
          <button onClick={() => showActionFeedback('筛选设置')} style={iconBtn(colors)}>
            <SlidersHorizontal size={13} />
          </button>
          <button onClick={() => showActionFeedback('表头设置')} style={iconBtn(colors)}>
            <Settings2 size={13} />
          </button>
          <button onClick={() => showActionFeedback('刷新数据')} style={iconBtn(colors)}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1620 }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ ...th(colors), width: 38, textAlign: 'center' }}>
                <input type="checkbox" style={{ accentColor: colors.primary }} />
              </th>
              {TABLE_COLUMNS.map(column => (
                <th key={column} style={th(colors)}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={TABLE_COLUMNS.length + 1} style={{ padding: '84px 0 110px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                <EmptyState colors={colors} />
              </td>
            </tr>
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
