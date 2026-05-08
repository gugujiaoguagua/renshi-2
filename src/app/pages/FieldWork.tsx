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

function showActionFeedback(action: string) {
  window.alert(`外勤管理：${action}（交互已接通）`);
}

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
}: {
  label: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>
        <span style={{ color: colors.primary, marginRight: 2 }}>*</span>
        {label}
      </span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input defaultValue="2026-05-01" type="date" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input defaultValue="2026-05-31" type="date" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SearchField({
  label,
  placeholder,
  colors,
  width = 176,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input placeholder={placeholder} style={textInput(colors)} />
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
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1 }}>{placeholder}</span>
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

  const activeView: ViewType = location.pathname.includes('field-trip') ? 'trip' : 'out';

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
          <DateRangeField label={pageConfig.dateLabel} colors={colors} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={146} />
          <SearchField label="申请人" placeholder="请输入人员姓名" colors={colors} width={182} />
          {activeView === 'out' ? (
            <>
              <DateRangeField label="发起时间" colors={colors} width={286} />
              <DateRangeField label="完成时间" colors={colors} width={286} />
            </>
          ) : (
            <>
              <SelectField label="记录状态" placeholder="请选择" colors={colors} width={146} />
              <SelectField label="当前流程状态" placeholder="请选择" colors={colors} width={168} />
            </>
          )}
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
            {activeView === 'out' ? (
              <>
                <SelectField label="记录状态" placeholder="请选择" colors={colors} width={146} />
                <SelectField label="生效状态" placeholder="请选择" colors={colors} width={146} />
                <SelectField label="数据来源" placeholder="请选择" colors={colors} width={146} />
              </>
            ) : (
              <>
                <SelectField label="数据来源" placeholder="请选择" colors={colors} width={146} />
                <SelectField label="单程/往返" placeholder="请选择" colors={colors} width={146} />
                <SearchField label="出差行程" placeholder="请输入城市或地点" colors={colors} width={188} />
              </>
            )}
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
          label={pageConfig.addLabel}
          items={pageConfig.addItems}
          open={showAddMenu}
          onToggle={() => {
            setShowAddMenu(v => !v);
            setShowFlowMenu(false);
          }}
          onClose={closeMenus}
          onSelect={(item) => showActionFeedback(`${pageConfig.title}-${item.label}`)}
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
          onSelect={(item) => showActionFeedback(`${pageConfig.title}-${item.label}`)}
          colors={colors}
        />
        <button onClick={() => showActionFeedback(`${pageConfig.title}-导出`)} style={outlineBtn(colors)}>导出</button>
        <button style={disabledBtn(colors)} disabled>删除</button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => showActionFeedback(`${pageConfig.title}-筛选设置`)} style={iconBtn(colors)}>
            <SlidersHorizontal size={13} />
          </button>
          <button onClick={() => showActionFeedback(`${pageConfig.title}-表头设置`)} style={iconBtn(colors)}>
            <Settings2 size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: activeView === 'out' ? 1640 : 1600 }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ ...th(colors), width: 38, textAlign: 'center' }}>
                <input type="checkbox" style={{ accentColor: colors.primary }} />
              </th>
              {pageConfig.columns.map(column => (
                <th key={column} style={th(colors)}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={pageConfig.columns.length + 1} style={{ padding: '84px 0 110px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
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
