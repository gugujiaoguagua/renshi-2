import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { monthEndISO, monthStartISO } from '../utils/date';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  HelpCircle,
  Search,
  Settings2,
  Users,
} from 'lucide-react';

type MainView = 'table' | 'adjust';
type AdjustView = 'change' | 'swap' | 'switch' | 'leave';

type AdjustTabConfig = {
  key: AdjustView;
  label: string;
  columns: string[];
};

const CALENDAR_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CALENDAR_WEEK_DAYS = ['五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日', '一', '二', '三', '四', '五', '六', '日'];

const ADJUST_TABS: AdjustTabConfig[] = [
  {
    key: 'change',
    label: '更改班次记录',
    columns: ['申请人', '员工号', '部门', '部门全路径', '更改日期', '原班次', '新班次', '班次更改原因', '发起时间', '完成时间', '审批状态'],
  },
  {
    key: 'swap',
    label: '班次对调记录',
    columns: ['申请人', '员工号', '部门', '部门全路径', '调班日期', '调班班次', '还班日期', '还班班次', '发起时间', '完成时间', '审批状态'],
  },
  {
    key: 'switch',
    label: '与他人切换记录',
    columns: ['申请人', '申请人员工号', '申请人部门', '申请人部门全路径', '替班人', '替班人员工号', '替班人部门', '替班人部门全路径', '换班日期', '换班结果', '是否还班', '还班日期', '还班结果', '发起时间', '完成时间', '审批状态'],
  },
  {
    key: 'leave',
    label: '排休申请',
    columns: ['申请人', '员工号', '部门', '部门全路径', '排休日期', '排休天数', '备注', '发起时间', '完成时间', '审批状态'],
  },
];

export default function ScheduleManagement() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [adjustTab, setAdjustTab] = useState<AdjustView>('change');
  const [showTableMore, setShowTableMore] = useState(false);
  const [showAdjustMore, setShowAdjustMore] = useState(false);

  const mainView: MainView = location.pathname === '/attendance/schedule-adjust' || location.pathname === '/attendance/schedule-history'
    ? 'adjust'
    : 'table';
  const currentAdjustTab = useMemo(
    () => ADJUST_TABS.find(tab => tab.key === adjustTab) ?? ADJUST_TABS[0],
    [adjustTab],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4, minHeight: 40, flexShrink: 0 }}>
        <TopTab label="首页" active={false} onClick={() => navigate('/attendance/home')} colors={colors} />
        <TopTab label="排班表" active={mainView === 'table'} onClick={() => navigate('/attendance/schedule')} colors={colors} />
        <TopTab label="班次调整记录" active={mainView === 'adjust'} onClick={() => navigate('/attendance/schedule-adjust')} colors={colors} />
        <button
          style={{
            marginLeft: 4,
            padding: '2px 10px',
            fontSize: '12px',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 4,
            cursor: 'default',
            background: 'transparent',
            color: colors.textMuted,
          }}
        >
          ×
        </button>
      </div>

      {mainView === 'table' ? (
        <ScheduleTableView colors={colors} showMore={showTableMore} onToggleMore={() => setShowTableMore(prev => !prev)} />
      ) : (
        <ScheduleAdjustView
          colors={colors}
          currentTab={currentAdjustTab}
          activeKey={adjustTab}
          onChangeTab={setAdjustTab}
          showMore={showAdjustMore}
          onToggleMore={() => setShowAdjustMore(prev => !prev)}
        />
      )}
    </div>
  );
}

function ScheduleTableView({
  colors,
  showMore,
  onToggleMore,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  return (
    <>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={ghostIconBtn(colors)}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>2026年5月</span>
          <ChevronDown size={12} style={{ color: colors.textMuted }} />
          <button style={ghostIconBtn(colors)}><ChevronRight size={14} /></button>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>考勤周期 5月1日 至 5月31日</span>
        </div>
        <button style={{ border: 'none', background: 'transparent', color: colors.primary, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '12px' }}>
          <HelpCircle size={12} />
          使用指引
        </button>
      </div>

      <div style={{ padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectField label="考勤组" placeholder="请选择考勤组" colors={colors} width={148} />
          <SearchField label="员工" placeholder="请输入或选择人员" colors={colors} width={178} showUserIcon />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={136} />
          <SelectField label="岗位" placeholder="请选择" colors={colors} width={136} />
          <SelectField label="员工类型" placeholder="请选择" colors={colors} width={144} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button style={iconBtn(colors)}><Settings2 size={12} /></button>
          </div>
        </div>
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` }}>
            <SelectField label="排班状态" placeholder="全部" colors={colors} width={128} />
            <SelectField label="班次类型" placeholder="全部班次" colors={colors} width={138} />
            <SelectField label="显示范围" placeholder="仅在岗员工" colors={colors} width={144} />
            <SelectField label="编制岗位" placeholder="请选择" colors={colors} width={136} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.tableBorder}` }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 3 }}>
              <th style={{ ...th(colors), width: 92, position: 'sticky', left: 0, zIndex: 4, backgroundColor: colors.tableHeaderBg }}>姓名</th>
              <th style={{ ...th(colors), width: 98, position: 'sticky', left: 92, zIndex: 4, backgroundColor: colors.tableHeaderBg }}>员工号</th>
              {CALENDAR_DAYS.map((day, index) => (
                <th key={day} style={{ ...th(colors), width: 42, textAlign: 'center', padding: '6px 2px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15 }}>
                    <span style={{ fontSize: '10px', color: index % 7 === 1 || index % 7 === 2 ? '#D97706' : colors.textMuted }}>{CALENDAR_WEEK_DAYS[index]}</span>
                    <span style={{ fontSize: '11px', color: colors.text }}>{day}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={33} style={{ padding: '112px 0 128px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                <EmptyState colors={colors} description="请先在上方选择考勤组或组织范围" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function ScheduleAdjustView({
  colors,
  currentTab,
  activeKey,
  onChangeTab,
  showMore,
  onToggleMore,
}: {
  colors: any;
  currentTab: AdjustTabConfig;
  activeKey: AdjustView;
  onChangeTab: (tab: AdjustView) => void;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  return (
    <>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 20, minHeight: 40, flexShrink: 0 }}>
        {ADJUST_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onChangeTab(tab.key)}
            style={{
              padding: '10px 0 9px',
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: activeKey === tab.key ? colors.primary : colors.textMuted,
              borderBottom: activeKey === tab.key ? `2px solid ${colors.primary}` : '2px solid transparent',
              fontWeight: activeKey === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SearchField label="姓名/员工号" placeholder="请输入或选择人员" colors={colors} width={176} showUserIcon />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={148} />
          <SelectField label="审批状态" placeholder="请选择" colors={colors} width={148} />
          {renderAdjustPrimaryFilters(currentTab.key, colors)}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button style={iconBtn(colors)}><Settings2 size={12} /></button>
          </div>
        </div>
        {showMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` }}>
            {renderAdjustMoreFilters(currentTab.key, colors)}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
              {currentTab.columns.map(column => (
                <th key={column} style={{ ...th(colors), minWidth: column.length >= 7 ? 132 : 112 }}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={currentTab.columns.length} style={{ padding: '136px 0 150px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
                <EmptyState colors={colors} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderAdjustPrimaryFilters(tab: AdjustView, colors: any) {
  switch (tab) {
    case 'change':
      return (
        <>
          <DateRangeField label="更改时间" colors={colors} width={240} />
          <DateRangeField label="发起时间" colors={colors} width={240} />
        </>
      );
    case 'swap':
      return (
        <>
          <DateRangeField label="调班日期" colors={colors} width={240} />
          <DateRangeField label="还班日期" colors={colors} width={240} />
        </>
      );
    case 'switch':
      return (
        <>
          <DateRangeField label="换班日期" colors={colors} width={240} />
          <SelectField label="是否还班" placeholder="请选择" colors={colors} width={136} />
        </>
      );
    case 'leave':
      return (
        <>
          <DateRangeField label="排休日期范围" colors={colors} width={250} />
          <DateRangeField label="发起时间" colors={colors} width={240} />
        </>
      );
    default:
      return null;
  }
}

function renderAdjustMoreFilters(tab: AdjustView, colors: any) {
  switch (tab) {
    case 'change':
      return (
        <>
          <SelectField label="原班次" placeholder="全部" colors={colors} width={136} />
          <SelectField label="新班次" placeholder="全部" colors={colors} width={136} />
          <SearchField label="发起人" placeholder="请输入" colors={colors} width={166} />
        </>
      );
    case 'swap':
      return (
        <>
          <SelectField label="调班班次" placeholder="全部" colors={colors} width={136} />
          <SelectField label="还班班次" placeholder="全部" colors={colors} width={136} />
          <SearchField label="发起人" placeholder="请输入" colors={colors} width={166} />
        </>
      );
    case 'switch':
      return (
        <>
          <SearchField label="替班人" placeholder="请输入" colors={colors} width={166} />
          <SelectField label="换班结果" placeholder="全部" colors={colors} width={136} />
          <DateRangeField label="还班日期" colors={colors} width={240} />
        </>
      );
    case 'leave':
      return (
        <>
          <SelectField label="排休时段" placeholder="全部" colors={colors} width={136} />
          <SearchField label="发起人" placeholder="请输入" colors={colors} width={166} />
          <SelectField label="记录来源" placeholder="全部" colors={colors} width={136} />
        </>
      );
    default:
      return null;
  }
}

function TopTab({
  label,
  active,
  onClick,
  colors,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colors: any;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px 9px',
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
  width = 236,
}: {
  label: string;
  colors: any;
  width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input defaultValue={monthStartISO()} type="date" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input defaultValue={monthEndISO()} type="date" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SearchField({
  label,
  placeholder,
  colors,
  width = 170,
  showUserIcon = false,
}: {
  label: string;
  placeholder: string;
  colors: any;
  width?: number;
  showUserIcon?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input placeholder={placeholder} style={textInput(colors)} />
        {showUserIcon ? <Users size={12} style={{ color: colors.textMuted }} /> : null}
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  colors,
  width = 140,
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
        <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeholder}</span>
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function EmptyState({ colors, description = '暂无内容' }: { colors: any; description?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 16,
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
            borderRadius: 9,
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
      {description !== '暂无内容' ? <span style={{ fontSize: '12px', color: colors.textMuted }}>{description}</span> : null}
    </div>
  );
}

function fieldShell(colors: any, width: number): React.CSSProperties {
  return {
    width,
    minHeight: 30,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 9px',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
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
    width: 96,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '12px',
    color: colors.text,
  };
}

function primaryBtn(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: 'none',
    borderRadius: 4,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  };
}

function outlineBtn(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.text,
    fontSize: '12px',
    cursor: 'pointer',
  };
}

function toggleBtn(colors: any, active: boolean): React.CSSProperties {
  return {
    ...outlineBtn(colors),
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: active ? colors.primary : colors.text,
    borderColor: active ? colors.primary : colors.inputBorder,
    backgroundColor: active ? colors.badgeBlueBg : 'transparent',
  };
}

function iconBtn(colors: any): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
  };
}

function ghostIconBtn(colors: any): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
  };
}

function th(colors: any): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: '12px',
    color: colors.textMuted,
    fontWeight: 500,
    textAlign: 'left',
    borderBottom: `1px solid ${colors.tableBorder}`,
    whiteSpace: 'nowrap',
    backgroundColor: colors.tableHeaderBg,
  };
}
