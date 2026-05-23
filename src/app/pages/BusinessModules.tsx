import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { todayISO } from '../utils/date';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleHelp,
  CreditCard,
  FileText,
  Folders,
  Home,
  Info,
  LayoutGrid,
  Lock,
  Download,
  Maximize2,
  Network,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
  Users,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  fetchEmployeeArchive,
  fetchEmployeeArchiveApprovals,
  fetchEmployeeCare,
  fetchEmployeeContracts,
  fetchEmployeeEducation,
  fetchEmployeeEmployment,
  fetchEmployeeManagementSummary,
  fetchEmployeeReports,
  fetchEmployeeRoster,
  fetchEmployeeServices,
  fetchEmployeeSettings,
  fetchEmployeeThirdParty,
  fetchHrCoreLookups,
  onboardEmployee,
  type EmployeeGenericRecord,
  type EmployeeManagementSummary,
} from '../api/realData';

type SidebarItem = {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  arrow?: boolean;
  onClick?: () => void;
  depth?: number;
  group?: boolean;
  groupActive?: boolean;
  expanded?: boolean;
};

type ModuleWorkspaceProps = {
  sidebarTitle: string;
  contentTitle?: string;
  sidebarItems: SidebarItem[];
  sidebarWidth?: number;
  children: React.ReactNode;
};

type Tone = 'primary' | 'soft' | 'warning';
type SortDirection = 'asc' | 'desc';
type SortState = { key: string; direction: SortDirection } | null;
type EmployeeRosterFilterKey =
  | 'all'
  | 'fullTime'
  | 'intern'
  | 'retired'
  | 'outsourcedAicai'
  | 'outsourcedKexun'
  | 'agency'
  | 'trial'
  | 'regular'
  | 'leaving'
  | 'blank';

function withAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    const parsed = Number.parseInt(hex, 16);
    const r = (parsed >> 16) & 255;
    const g = (parsed >> 8) & 255;
    const b = parsed & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  return color;
}

function normalizeTableSortValue(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return '';

  const numeric = Number(text.replace(/,/g, ''));
  if (!Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(text.replace(/,/g, ''))) {
    return numeric;
  }

  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) {
    return timestamp;
  }

  return text.toLowerCase();
}

function compareTableValues(left: unknown, right: unknown, direction: SortDirection) {
  const a = normalizeTableSortValue(left);
  const b = normalizeTableSortValue(right);
  const factor = direction === 'asc' ? 1 : -1;

  if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
  return String(a).localeCompare(String(b), 'zh-CN', { numeric: true, sensitivity: 'base' }) * factor;
}

function SortableHeaderLabel({
  label,
  active,
  direction,
}: {
  label: string;
  active: boolean;
  direction?: SortDirection;
}) {
  const { colors } = useTheme();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', flexShrink: 0, opacity: active ? 1 : 0.35 }}>
        <ChevronUp size={9} style={{ color: active && direction === 'asc' ? colors.primary : colors.textMuted }} />
        <ChevronDown size={9} style={{ marginTop: -3, color: active && direction === 'desc' ? colors.primary : colors.textMuted }} />
      </span>
    </span>
  );
}

function getPaginationPages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);

  if (start > 2) pages.push('ellipsis');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  const { colors } = useTheme();
  const [jumpPage, setJumpPage] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const goToPage = (nextPage: number) => onPageChange(Math.min(Math.max(1, nextPage), totalPages));
  const pages = getPaginationPages(safePage, totalPages);

  const pageButton = (active = false, disabled = false): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    padding: '0 8px',
    borderRadius: 5,
    border: active ? `1px solid ${colors.primary}` : '1px solid transparent',
    backgroundColor: active ? '#FFFFFF' : 'transparent',
    color: disabled ? colors.textMuted : active ? colors.primary : colors.text,
    fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '10px 8px',
        borderTop: `1px solid ${colors.tableBorder}`,
        backgroundColor: colors.cardBg,
        color: colors.text,
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      <span style={{ marginRight: 2 }}>共 {total} 条</span>
      <button type="button" disabled={safePage === 1} onClick={() => goToPage(safePage - 1)} style={pageButton(false, safePage === 1)}>
        {'<'}
      </button>
      {pages.map((item, index) => (
        item === 'ellipsis'
          ? <span key={`ellipsis-${index}`} style={{ color: colors.textMuted, padding: '0 2px' }}>...</span>
          : (
            <button key={item} type="button" onClick={() => goToPage(item)} style={pageButton(item === safePage)}>
              {item}
            </button>
          )
      ))}
      <button type="button" disabled={safePage === totalPages} onClick={() => goToPage(safePage + 1)} style={pageButton(false, safePage === totalPages)}>
        {'>'}
      </button>
      <select
        value={pageSize}
        onChange={event => onPageSizeChange(Number(event.target.value))}
        style={{
          height: 30,
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: 5,
          backgroundColor: colors.cardBg,
          color: colors.text,
          fontSize: 12,
          padding: '0 8px',
          outline: 'none',
        }}
      >
        {pageSizeOptions.map(option => <option key={option} value={option}>{option} 条/页</option>)}
      </select>
      <span>跳至</span>
      <input
        value={jumpPage}
        onChange={event => setJumpPage(event.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            goToPage(Number(jumpPage || 1));
            setJumpPage('');
          }
        }}
        onBlur={() => {
          if (!jumpPage) return;
          goToPage(Number(jumpPage));
          setJumpPage('');
        }}
        style={{
          width: 54,
          height: 30,
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: 5,
          backgroundColor: colors.cardBg,
          color: colors.text,
          fontSize: 12,
          padding: '0 8px',
          outline: 'none',
        }}
      />
      <span>页</span>
    </div>
  );
}

function ModuleWorkspace({ sidebarTitle, contentTitle, sidebarItems, sidebarWidth = 180, children }: ModuleWorkspaceProps) {
  const { colors } = useTheme();

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          backgroundColor: colors.sidebarBg,
          height: '100%',
          overflowY: 'auto',
          flexShrink: 0,
          borderRight: `1px solid ${colors.sidebarBorder}`,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 8,
        }}
      >
        {sidebarTitle ? <div style={{ padding: '2px 14px 8px', fontSize: '11px', color: colors.sidebarMuted, fontWeight: 600 }}>{sidebarTitle}</div> : null}
        {sidebarItems.map(item => {
          const isChild = Boolean(item.depth);
          const isActive = Boolean(item.active);
          const isGroupActive = Boolean(item.groupActive);
          const baseColor = isActive || isGroupActive ? '#FFFFFF' : isChild ? colors.sidebarMuted : colors.sidebarText;
          const baseBackground = isActive
            ? colors.sidebarActiveBg
            : isGroupActive
              ? 'rgba(170, 43, 58, 0.15)'
              : isChild
                ? 'rgba(0,0,0,0.15)'
                : 'transparent';

          return (
            <div
              key={item.label}
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: isChild ? '8px 14px 8px 36px' : '9px 14px',
                cursor: item.onClick ? 'pointer' : 'default',
                fontSize: isChild ? '12px' : '13px',
                color: baseColor,
                backgroundColor: baseBackground,
                transition: 'background 0.15s, color 0.15s',
                borderLeft: isActive
                  ? '3px solid rgba(255,255,255,0.4)'
                  : isGroupActive
                    ? `3px solid ${colors.sidebarActiveBg}`
                    : '3px solid transparent',
                boxSizing: 'border-box',
                minHeight: isChild ? 34 : 38,
                fontWeight: item.group ? 600 : 400,
              }}
              title={item.label}
              onMouseEnter={e => {
                if (!isActive && !isGroupActive) {
                  e.currentTarget.style.backgroundColor = colors.sidebarHover;
                  e.currentTarget.style.color = colors.sidebarText;
                }
              }}
              onMouseLeave={e => {
                if (!isActive && !isGroupActive) {
                  e.currentTarget.style.backgroundColor = isChild ? 'rgba(0,0,0,0.15)' : 'transparent';
                  e.currentTarget.style.color = isChild ? colors.sidebarMuted : colors.sidebarText;
                }
              }}
            >
              {isChild ? null : <span style={{ flexShrink: 0, opacity: isActive || isGroupActive ? 1 : 0.82, display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 600 : 400 }}>
                {item.label}
              </span>
              {item.arrow ? (
                <span
                  style={{
                    flexShrink: 0,
                    opacity: isActive || isGroupActive ? 0.86 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'transform 0.2s',
                    transform: item.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <ChevronRight size={12} />
                </span>
              ) : null}
            </div>
          );
        })}
      </aside>

      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '10px 14px 14px' }}>
        {contentTitle ? <div style={{ fontSize: '12px', color: colors.textMuted, margin: '2px 0 10px' }}>{contentTitle}</div> : null}
        {children}
      </div>
    </div>
  );
}

function Surface({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { colors } = useTheme();
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ title, extra }: { title: string; extra?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>{title}</div>
      {extra}
    </div>
  );
}

function MetricStripCard({
  title,
  metrics,
  tone = 'soft',
}: {
  title: string;
  metrics: { label: string; value: string }[];
  tone?: Tone;
}) {
  const { colors } = useTheme();
  const toneMap = {
    primary: {
      strip: colors.primary,
      bg: withAlpha(colors.primary, 0.06),
      border: withAlpha(colors.primary, 0.16),
    },
    soft: {
      strip: '#809BC4',
      bg: withAlpha(colors.primary, 0.04),
      border: colors.cardBorder,
    },
    warning: {
      strip: '#E29A8E',
      bg: '#FFF5F3',
      border: '#F2D8D2',
    },
  } as const;
  const currentTone = toneMap[tone];

  return (
    <div style={{ border: `1px solid ${currentTone.border}`, borderRadius: 10, overflow: 'hidden', backgroundColor: currentTone.bg }}>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${currentTone.strip}, ${withAlpha(currentTone.strip, 0.45)})` }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {metrics.map(metric => (
            <div key={metric.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>{metric.label}</span>
              <span style={{ fontSize: '16px', color: colors.text, fontWeight: 700 }}>{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatOverviewCard({ title, stats }: { title: string; stats: { label: string; value: string; accent?: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <Surface style={{ padding: '14px 16px' }}>
      <SectionTitle title={title} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {stats.map(stat => (
          <div key={stat.label} style={{ minHeight: 56, borderRadius: 8, backgroundColor: colors.tableHeaderBg, border: `1px solid ${colors.tableBorder}`, padding: '10px 12px' }}>
            <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: stat.accent ? colors.primary : colors.text }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function SidePanel({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Surface style={{ padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>{title}</div>
        {extra}
      </div>
      {children}
    </Surface>
  );
}

function SoftFeatureCard({
  icon,
  title,
  desc,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <div style={{ borderRadius: 16, padding: '18px 16px 14px', background: `linear-gradient(180deg, ${withAlpha(accent, 0.18)}, ${withAlpha(accent, 0.08)})`, border: `1px solid ${withAlpha(accent, 0.22)}` }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: withAlpha(accent, 0.18), color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        {icon}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: '12px', lineHeight: 1.8, color: colors.textMuted, minHeight: 40 }}>{desc}</div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function IllustrationCard({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height: 132, borderRadius: 14, overflow: 'hidden', background: `linear-gradient(180deg, ${withAlpha(accent, 0.14)}, rgba(255,255,255,0.85))`, border: `1px solid ${withAlpha(accent, 0.22)}` }}>
      {children}
    </div>
  );
}

export function PayrollPage() {
  const { colors } = useTheme();

  const features = [
    {
      title: '智能识别',
      desc: '一键生成工资单草稿，自动识别发放异常、签收状态与敏感字段变更。',
      accent: '#8E7CF7',
      icon: <Sparkles size={18} />,
      illustration: (
        <>
          <div style={{ position: 'absolute', left: 14, top: 18, width: 74, height: 86, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.8)' }} />
          <div style={{ position: 'absolute', left: 26, top: 32, width: 50, height: 8, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.22) }} />
          <div style={{ position: 'absolute', left: 26, top: 48, width: 36, height: 6, borderRadius: 999, backgroundColor: withAlpha(colors.textMuted, 0.22) }} />
          <div style={{ position: 'absolute', left: 98, top: 54, width: 54, height: 48, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 12px 22px rgba(0,0,0,0.06)' }} />
          <div style={{ position: 'absolute', left: 112, top: 68, width: 26, height: 26, borderRadius: '50%', backgroundColor: withAlpha(colors.primary, 0.18), color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</div>
        </>
      ),
    },
    {
      title: '自定义预警',
      desc: '按签收率、发放节奏、异常波动配置预警阈值，问题发现更及时。',
      accent: colors.primary,
      icon: <Bell size={18} />,
      illustration: (
        <>
          <div style={{ position: 'absolute', left: 18, top: 24, width: 116, height: 74, borderRadius: 14, backgroundColor: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.06)' }} />
          <div style={{ position: 'absolute', left: 32, top: 38, width: 56, height: 10, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.2) }} />
          <div style={{ position: 'absolute', left: 32, top: 58, width: 74, height: 8, borderRadius: 999, backgroundColor: withAlpha(colors.textMuted, 0.16) }} />
          <div style={{ position: 'absolute', right: 18, bottom: 18, width: 44, height: 22, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.14), border: `1px solid ${withAlpha(colors.primary, 0.24)}` }} />
        </>
      ),
    },
    {
      title: '多板块联动',
      desc: '支持与员工档案、考勤结果、社保薪酬模块串联，减少重复维护。',
      accent: '#5AA8B2',
      icon: <Network size={18} />,
      illustration: (
        <>
          <div style={{ position: 'absolute', left: 16, top: 26, width: 58, height: 66, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 18px rgba(0,0,0,0.05)' }} />
          <div style={{ position: 'absolute', right: 18, top: 36, width: 78, height: 54, borderRadius: 14, backgroundColor: '#fff', boxShadow: '0 8px 18px rgba(0,0,0,0.05)' }} />
          <div style={{ position: 'absolute', left: 66, top: 62, width: 44, height: 4, borderRadius: 999, backgroundColor: withAlpha('#5AA8B2', 0.4) }} />
          <div style={{ position: 'absolute', left: 104, top: 44, width: 12, height: 12, borderRadius: 4, backgroundColor: withAlpha(colors.primary, 0.18), border: `1px solid ${withAlpha(colors.primary, 0.28)}` }} />
        </>
      ),
    },
  ];

  return (
    <ModuleWorkspace sidebarTitle="工资单" contentTitle="工资单首页" sidebarItems={[{ label: '工资单首页', active: true }]}>
      <Surface style={{ minHeight: 'calc(100vh - 92px)', padding: '52px 48px 56px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: withAlpha(colors.primary, 0.28) }} />
            <div style={{ fontSize: '28px', fontWeight: 700, color: colors.text }}>欢迎使用电子工资单</div>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: withAlpha(colors.primary, 0.28) }} />
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.9, color: colors.textMuted, maxWidth: 620, margin: '0 auto 28px' }}>
            保持现有系统主配色与组件语言，在同一套后台表达下还原电子工资单首页的欢迎与能力介绍区。
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, marginBottom: 22 }}>
            {features.map(feature => (
              <SoftFeatureCard key={feature.title} icon={feature.icon} title={feature.title} desc={feature.desc} accent={feature.accent}>
                <IllustrationCard accent={feature.accent}>{feature.illustration}</IllustrationCard>
              </SoftFeatureCard>
            ))}
          </div>

          <div style={{ fontSize: '12px', lineHeight: 1.9, color: colors.textMuted }}>
            员工可通过移动端查看工资单、签收结果和发放批次说明；管理员可在同一套系统中继续维护权限、模板与联动规则。
          </div>
          <button style={{ marginTop: 16, height: 34, padding: '0 18px', borderRadius: 999, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
            了解电子工资单能力
          </button>
        </div>
      </Surface>
    </ModuleWorkspace>
  );
}

type EmployeeViewKey =
  | 'home'
  | 'roster'
  | 'archive'
  | 'archiveApprovals'
  | 'care'
  | 'reports'
  | 'reportsNew'
  | 'pendingOnboard'
  | 'onboarded'
  | 'regularized'
  | 'transferring'
  | 'abandoned'
  | 'concurrent'
  | 'borrowed'
  | 'tempStore'
  | 'tempStoreRecords'
  | 'resigning'
  | 'mainJobRecords'
  | 'contracts'
  | 'newSign'
  | 'renewal'
  | 'signing'
  | 'contractApproval'
  | 'contractRelease'
  | 'contractLedger'
  | 'esignSettings'
  | 'settings'
  | 'blacklist'
  | 'services'
  | 'certificates'
  | 'customPrint'
  | 'templates'
  | 'thirdParty';

type EmployeeDataView = {
  key: EmployeeViewKey;
  title: string;
  desc: string;
  columns: { key: string; label: string; width?: number }[];
  fetcher: () => Promise<{ total: number; rows: EmployeeGenericRecord[]; sourceFile?: string; sheetName?: string }>;
};

type EmploymentWorkbenchMode = 'onboard' | 'regularization' | 'transfer';

type EmploymentTabConfig = {
  key: string;
  label: string;
  desc: string;
  fetcher?: () => Promise<{ total: number; rows: EmployeeGenericRecord[]; sourceFile?: string; sheetName?: string }>;
  rows?: EmployeeGenericRecord[];
  columns: Array<{ key: string; label: string; width?: number; link?: boolean; status?: boolean; render?: (row: EmployeeGenericRecord, index: number) => React.ReactNode }>;
  primaryAction?: string;
  importable?: boolean;
  batch?: boolean;
  emptyText?: string;
  summary?: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'danger' | 'muted' }>;
  note?: string;
  pageSize?: number;
};

const employeeViewMap: Record<Exclude<EmployeeViewKey, 'home'>, EmployeeDataView> = {
  roster: {
    key: 'roster',
    title: '员工花名册',
    desc: '来自参考目录员工花名册，并与考勤人员主数据同源。',
    fetcher: fetchEmployeeRoster as EmployeeDataView['fetcher'],
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'phone', label: '手机号', width: 130 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'deptFullPath', label: '部门全路径', width: 280 },
      { key: 'position', label: '岗位', width: 150 },
      { key: 'hireDate', label: '入职日期', width: 120 },
      { key: 'employeeType', label: '员工类型', width: 120 },
      { key: 'employeeStatus', label: '员工状态', width: 110 },
      { key: 'identityVerify', label: '身份核验', width: 120 },
    ],
  },
  archive: {
    key: 'archive',
    title: '员工档案库',
    desc: '档案字段与花名册主数据保持一致，后续可继续展开教育、合同、工作经历详情。',
    fetcher: fetchEmployeeArchive as EmployeeDataView['fetcher'],
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'position', label: '岗位', width: 150 },
      { key: 'managerName', label: '汇报上级', width: 130 },
      { key: 'employeeStatus', label: '员工状态', width: 110 },
      { key: 'source', label: '数据来源', width: 160 },
    ],
  },
  archiveApprovals: {
    key: 'archiveApprovals',
    title: '档案变更审批',
    desc: '按档案缺失和身份核验状态生成待处理审批视图。',
    fetcher: fetchEmployeeArchiveApprovals,
    columns: [
      { key: 'applicant', label: '申请人', width: 110 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'changeType', label: '变更类型', width: 150 },
      { key: 'field', label: '字段', width: 240 },
      { key: 'status', label: '状态', width: 100 },
      { key: 'initiator', label: '发起人', width: 120 },
      { key: 'createTime', label: '发起时间', width: 160 },
    ],
  },
  care: {
    key: 'care',
    title: '员工关怀',
    desc: '入职、转正、续签、档案补全等提醒。',
    fetcher: fetchEmployeeCare,
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'careType', label: '关怀类型', width: 150 },
      { key: 'dueDate', label: '提醒日期', width: 120 },
      { key: 'status', label: '状态', width: 100 },
      { key: 'owner', label: '负责人', width: 120 },
    ],
  },
  reports: {
    key: 'reports',
    title: '员工统计报表',
    desc: '按部门统计人员、在职、试用、外包结构。',
    fetcher: fetchEmployeeReports,
    columns: [
      { key: 'dept', label: '部门', width: 180 },
      { key: 'total', label: '总人数', width: 100 },
      { key: 'active', label: '在职', width: 100 },
      { key: 'trial', label: '试用', width: 100 },
      { key: 'outsourced', label: '外包', width: 100 },
    ],
  },
  reportsNew: {
    key: 'reportsNew',
    title: '员工统计报表（新版）',
    desc: '新版员工统计报表，和实时统计共用员工主数据。',
    fetcher: fetchEmployeeReports,
    columns: [
      { key: 'dept', label: '部门', width: 180 },
      { key: 'total', label: '总人数', width: 100 },
      { key: 'active', label: '在职', width: 100 },
      { key: 'trial', label: '试用', width: 100 },
      { key: 'outsourced', label: '外包', width: 100 },
    ],
  },
  pendingOnboard: {
    key: 'pendingOnboard',
    title: '待入职',
    desc: '任职管理中的入职办理列表。',
    fetcher: () => fetchEmployeeEmployment('pendingOnboard'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '入职末级部门', label: '入职部门', width: 160 },
      { key: '实际入职日期', label: '入职日期', width: 120 },
      { key: '员工类型', label: '员工类型', width: 110 },
      { key: '岗位', label: '岗位', width: 160 },
      { key: '审批状态', label: '审批状态', width: 110 },
      { key: '数据来源', label: '数据来源', width: 140 },
    ],
  },
  onboarded: {
    key: 'onboarded',
    title: '已入职',
    desc: '已入职员工记录。',
    fetcher: () => fetchEmployeeEmployment('onboarded'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '入职末级部门', label: '部门', width: 160 },
      { key: '实际入职日期', label: '入职日期', width: 120 },
      { key: '员工类型', label: '员工类型', width: 110 },
      { key: '岗位', label: '岗位', width: 160 },
      { key: '审批状态', label: '审批状态', width: 110 },
    ],
  },
  regularized: {
    key: 'regularized',
    title: '转正管理',
    desc: '已转正和转正申请记录。',
    fetcher: () => fetchEmployeeEmployment('regularized'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '员工号', label: '员工号', width: 110 },
      { key: '转正部门', label: '部门', width: 160 },
      { key: '转正岗位', label: '岗位', width: 160 },
      { key: '入职日期', label: '入职日期', width: 120 },
      { key: '实际转正日期', label: '转正日期', width: 120 },
      { key: '表单状态', label: '表单状态', width: 110 },
    ],
  },
  transferring: {
    key: 'transferring',
    title: '调动管理',
    desc: '员工调岗、调部门记录。',
    fetcher: () => fetchEmployeeEmployment('transferAll'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '调动申请日期', label: '申请日期', width: 120 },
      { key: '调动类型', label: '调动类型', width: 110 },
      { key: '表单状态', label: '表单状态', width: 110 },
      { key: '原部门', label: '原部门', width: 160 },
      { key: '调动后部门', label: '调动后部门', width: 180 },
      { key: '原岗位', label: '原岗位', width: 150 },
      { key: '调动后岗位', label: '调动后岗位', width: 150 },
    ],
  },
  abandoned: {
    key: 'abandoned',
    title: '弃入管理',
    desc: '放弃入职人员记录。',
    fetcher: () => fetchEmployeeEmployment('abandoned'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '手机号', label: '手机号', width: 130 },
      { key: '预计入职日期', label: '预计入职日期', width: 130 },
      { key: '入职末级部门', label: '入职部门', width: 160 },
      { key: '岗位', label: '岗位', width: 160 },
      { key: '审批状态', label: '审批状态', width: 110 },
      { key: '放弃原因', label: '放弃原因', width: 160 },
      { key: '添加人', label: '添加人', width: 110 },
    ],
  },
  concurrent: {
    key: 'concurrent',
    title: '兼任管理',
    desc: '兼任和跨部门任职记录。',
    fetcher: () => fetchEmployeeEmployment('concurrent'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '申请日期', label: '申请日期', width: 120 },
      { key: '开始日期', label: '开始日期', width: 120 },
      { key: '结束日期', label: '结束日期', width: 120 },
      { key: '部门', label: '部门', width: 160 },
      { key: '兼任部门', label: '兼任部门', width: 160 },
      { key: '兼任岗位', label: '兼任岗位', width: 160 },
      { key: '任职状态', label: '任职状态', width: 120 },
    ],
  },
  borrowed: {
    key: 'borrowed',
    title: '借调管理',
    desc: '借出、借入与临时岗位借调记录。',
    fetcher: () => fetchEmployeeEmployment('borrowed'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '申请日期', label: '申请日期', width: 120 },
      { key: '开始日期', label: '开始日期', width: 120 },
      { key: '结束日期', label: '结束日期', width: 120 },
      { key: '借调类型', label: '借调类型', width: 120 },
      { key: '借出部门', label: '借出部门', width: 160 },
      { key: '借入部门', label: '借入部门', width: 160 },
      { key: '借入岗位', label: '借入岗位', width: 160 },
      { key: '任职状态', label: '任职状态', width: 120 },
    ],
  },
  tempStore: {
    key: 'tempStore',
    title: '临时调店管理',
    desc: '临时调店记录，当前使用调动记录联动展示。',
    fetcher: () => fetchEmployeeEmployment('transferring'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '调动申请日期', label: '申请日期', width: 120 },
      { key: '调动类型', label: '类型', width: 110 },
      { key: '原部门', label: '原部门', width: 160 },
      { key: '调动后部门', label: '调动后部门', width: 180 },
      { key: '表单状态', label: '状态', width: 110 },
      { key: '添加人', label: '添加人', width: 110 },
    ],
  },
  tempStoreRecords: {
    key: 'tempStoreRecords',
    title: '临时调店记录',
    desc: '临时调店历史记录。',
    fetcher: () => fetchEmployeeEmployment('transferring'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '调动申请日期', label: '申请日期', width: 120 },
      { key: '调动生效日期', label: '开始日期', width: 120 },
      { key: '原部门', label: '借出门店', width: 160 },
      { key: '调动后部门', label: '借入门店', width: 160 },
      { key: '调动后岗位', label: '借入岗位', width: 150 },
      { key: '表单状态', label: '任职状态', width: 110 },
      { key: '添加人', label: '添加人', width: 110 },
    ],
  },
  resigning: {
    key: 'resigning',
    title: '离职管理',
    desc: '离职中、已离职、全部离职记录。',
    fetcher: () => fetchEmployeeEmployment('resignAll'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '离职部门', label: '离职部门', width: 160 },
      { key: '计划离职日期', label: '计划离职日期', width: 130 },
      { key: '实际离职日期', label: '实际离职日期', width: 130 },
      { key: '实际离职类型', label: '离职类型', width: 120 },
      { key: '表单状态', label: '表单状态', width: 110 },
      { key: '添加人', label: '添加人', width: 110 },
    ],
  },
  mainJobRecords: {
    key: 'mainJobRecords',
    title: '任职记录',
    desc: '主岗任职历史记录。',
    fetcher: () => fetchEmployeeEmployment('mainJobRecords'),
    columns: [
      { key: '姓名', label: '姓名', width: 110 },
      { key: '生效日期', label: '生效日期', width: 120 },
      { key: '部门', label: '部门', width: 260 },
      { key: '业务分组', label: '业务分组', width: 140 },
      { key: '任职类型', label: '任职类型', width: 110 },
      { key: '数据来源', label: '数据来源', width: 120 },
      { key: '任职状态', label: '任职状态', width: 110 },
    ],
  },
  contracts: {
    key: 'contracts',
    title: '员工合同',
    desc: '员工合同主表。',
    fetcher: () => fetchEmployeeContracts('all').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'position', label: '岗位', width: 150 },
      { key: 'company', label: '合同公司', width: 220 },
      { key: 'contractType', label: '合同类型', width: 160 },
      { key: 'startDate', label: '起始日', width: 120 },
      { key: 'endDate', label: '到期日', width: 120 },
      { key: 'contractStatus', label: '状态', width: 120 },
      { key: 'signMethod', label: '签署方式', width: 120 },
    ],
  },
  newSign: {
    key: 'newSign',
    title: '入职新签',
    desc: '待新签劳动合同或员工手册。',
    fetcher: () => fetchEmployeeContracts('newSign').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'position', label: '岗位', width: 160 },
      { key: 'contractStatus', label: '员工状态', width: 110 },
      { key: 'signProgress', label: '签署进度', width: 140 },
      { key: 'employeeAuthStatus', label: '授权状态', width: 120 },
    ],
  },
  renewal: {
    key: 'renewal',
    title: '到期续签',
    desc: '到期需续签合同。',
    fetcher: () => fetchEmployeeContracts('renewal').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'company', label: '合同公司', width: 220 },
      { key: 'contractType', label: '合同类型', width: 160 },
      { key: 'endDate', label: '合同到期日', width: 130 },
      { key: 'contractStatus', label: '合同状态', width: 120 },
      { key: 'signProgress', label: '签署进度', width: 120 },
    ],
  },
  signing: {
    key: 'signing',
    title: '签署中',
    desc: '当前签署中记录。',
    fetcher: () => fetchEmployeeContracts('signing').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'company', label: '合同公司', width: 220 },
      { key: 'contractType', label: '合同类型', width: 160 },
      { key: 'signProgress', label: '电子签署进度', width: 150 },
      { key: 'dataSource', label: '数据来源', width: 120 },
      { key: 'initiator', label: '发起人', width: 110 },
      { key: 'initiateTime', label: '发起时间', width: 160 },
    ],
  },
  contractApproval: {
    key: 'contractApproval',
    title: '合同审批',
    desc: '合同签署记录和审批流记录。',
    fetcher: () => fetchEmployeeContracts('signRecords').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'company', label: '合同公司', width: 220 },
      { key: 'contractType', label: '合同类型', width: 160 },
      { key: 'signProgress', label: '签署进度', width: 140 },
      { key: 'dataSource', label: '数据来源', width: 120 },
      { key: 'initiator', label: '发起人', width: 110 },
      { key: 'initiateTime', label: '发起时间', width: 160 },
    ],
  },
  contractRelease: {
    key: 'contractRelease',
    title: '合同解除',
    desc: '合同解除记录。',
    fetcher: () => fetchEmployeeContracts('releaseRecords').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'dept', label: '部门', width: 160 },
      { key: 'company', label: '合同公司', width: 220 },
      { key: 'contractType', label: '合同类型', width: 160 },
      { key: 'startDate', label: '合同起始日', width: 130 },
      { key: 'endDate', label: '合同到期日', width: 130 },
      { key: 'contractStatus', label: '合同状态', width: 120 },
      { key: 'signProgress', label: '解除进度', width: 120 },
    ],
  },
  contractLedger: {
    key: 'contractLedger',
    title: '合同台账',
    desc: '合同台账和合同主表数据。',
    fetcher: () => fetchEmployeeContracts('all').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
    columns: [
      { key: 'name', label: '姓名', width: 110 },
      { key: 'employeeNo', label: '员工号', width: 110 },
      { key: 'company', label: '合同公司', width: 220 },
      { key: 'contractNo', label: '合同编号', width: 160 },
      { key: 'contractType', label: '合同类型', width: 160 },
      { key: 'contractTerm', label: '合同期限', width: 120 },
      { key: 'startDate', label: '起始日', width: 120 },
      { key: 'endDate', label: '到期日', width: 120 },
      { key: 'contractStatus', label: '状态', width: 120 },
    ],
  },
  esignSettings: {
    key: 'esignSettings',
    title: '电子签署设置',
    desc: '电子合同签署相关配置。',
    fetcher: fetchEmployeeSettings,
    columns: [
      { key: 'setting', label: '设置项', width: 180 },
      { key: 'value', label: '配置内容', width: 360 },
      { key: 'status', label: '状态', width: 120 },
    ],
  },
  settings: {
    key: 'settings',
    title: '员工管理设置',
    desc: '员工管理相关基础配置。',
    fetcher: fetchEmployeeSettings,
    columns: [
      { key: 'setting', label: '设置项', width: 180 },
      { key: 'value', label: '配置内容', width: 360 },
      { key: 'status', label: '状态', width: 120 },
    ],
  },
  blacklist: {
    key: 'blacklist',
    title: '黑名单管理',
    desc: '员工黑名单管理，联动离职和档案记录。',
    fetcher: () => fetchEmployeeEmployment('resignAll'),
    columns: [
      { key: '姓名', label: '姓名', width: 120 },
      { key: '离职部门', label: '部门', width: 180 },
      { key: '实际离职日期', label: '离职日期', width: 130 },
      { key: '是否加入黑名单', label: '是否加入黑名单', width: 150 },
      { key: '实际离职原因', label: '原因', width: 220 },
      { key: '添加人', label: '添加人', width: 120 },
      { key: '添加时间', label: '添加时间', width: 160 },
    ],
  },
  services: {
    key: 'services',
    title: '员工服务',
    desc: '员工自助服务、材料提交与合同提醒。',
    fetcher: fetchEmployeeServices,
    columns: [
      { key: 'service', label: '服务', width: 180 },
      { key: 'scope', label: '范围', width: 180 },
      { key: 'status', label: '状态', width: 120 },
      { key: 'linkedData', label: '联动数据', width: 320 },
    ],
  },
  certificates: {
    key: 'certificates',
    title: '证明开具',
    desc: '员工证明开具服务。',
    fetcher: fetchEmployeeRoster as EmployeeDataView['fetcher'],
    columns: [
      { key: 'name', label: '姓名', width: 120 },
      { key: 'employeeNo', label: '员工号', width: 120 },
      { key: 'dept', label: '部门', width: 180 },
      { key: 'position', label: '岗位', width: 160 },
      { key: 'hireDate', label: '入职日期', width: 130 },
      { key: 'employeeStatus', label: '员工状态', width: 120 },
      { key: 'source', label: '数据来源', width: 160 },
    ],
  },
  customPrint: {
    key: 'customPrint',
    title: '自定义打印',
    desc: '员工服务自定义打印配置。',
    fetcher: fetchEmployeeServices,
    columns: [
      { key: 'service', label: '服务', width: 180 },
      { key: 'scope', label: '适用范围', width: 180 },
      { key: 'status', label: '状态', width: 120 },
      { key: 'linkedData', label: '联动数据', width: 320 },
    ],
  },
  templates: {
    key: 'templates',
    title: '模板管理',
    desc: '员工证明和打印模板管理。',
    fetcher: fetchEmployeeServices,
    columns: [
      { key: 'service', label: '模板名称', width: 180 },
      { key: 'scope', label: '使用范围', width: 180 },
      { key: 'status', label: '状态', width: 120 },
      { key: 'linkedData', label: '字段来源', width: 320 },
    ],
  },
  thirdParty: {
    key: 'thirdParty',
    title: '员工对接日志',
    desc: '企业微信、电子合同、考勤小程序等员工数据对接状态。',
    fetcher: fetchEmployeeThirdParty,
    columns: [
      { key: 'platform', label: '平台', width: 180 },
      { key: 'data', label: '同步数据', width: 300 },
      { key: 'status', label: '状态', width: 120 },
      { key: 'syncMode', label: '同步方式', width: 260 },
    ],
  },
};

const employeeViewSlugMap: Record<EmployeeViewKey, string> = {
  home: 'home',
  roster: 'roster',
  archive: 'archive',
  archiveApprovals: 'archive-approvals',
  care: 'care',
  reports: 'reports',
  reportsNew: 'reports-new',
  pendingOnboard: 'onboard',
  onboarded: 'onboarded',
  regularized: 'regularization',
  transferring: 'transfer',
  abandoned: 'abandoned',
  concurrent: 'concurrent',
  borrowed: 'borrowed',
  tempStore: 'temp-store',
  tempStoreRecords: 'temp-store-records',
  resigning: 'resignation',
  mainJobRecords: 'employment-records',
  contracts: 'contracts',
  newSign: 'new-sign',
  renewal: 'renewal',
  signing: 'signing',
  contractApproval: 'contract-approval',
  contractRelease: 'contract-release',
  contractLedger: 'contract-ledger',
  esignSettings: 'esign-settings',
  settings: 'settings',
  blacklist: 'blacklist',
  services: 'services',
  certificates: 'certificates',
  customPrint: 'custom-print',
  templates: 'templates',
  thirdParty: 'third-party',
};

const employeeSlugViewMap = Object.fromEntries(
  Object.entries(employeeViewSlugMap).map(([view, slug]) => [slug, view]),
) as Record<string, EmployeeViewKey>;

function getEmployeeViewFromSection(section?: string): EmployeeViewKey {
  return section ? employeeSlugViewMap[section] || 'tempStore' : 'tempStore';
}

function getEmployeeGroupKeyForView(view: EmployeeViewKey) {
  if (['roster', 'archive', 'archiveApprovals', 'care', 'reports', 'reportsNew'].includes(view)) return 'employee';
  if (['pendingOnboard', 'onboarded', 'regularized', 'transferring', 'abandoned', 'concurrent', 'borrowed', 'tempStore', 'tempStoreRecords', 'resigning', 'mainJobRecords'].includes(view)) return 'employment';
  if (['newSign', 'renewal', 'signing', 'contractApproval', 'contractRelease', 'contractLedger', 'esignSettings'].includes(view)) return 'contract';
  if (['settings', 'blacklist'].includes(view)) return 'settings';
  if (['services', 'certificates', 'customPrint', 'templates'].includes(view)) return 'services';
  if (view === 'thirdParty') return 'thirdParty';
  return '';
}

function EmployeeDataTable({ view }: { view: EmployeeDataView }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [query, setQuery] = useState('');
  const [sortState, setSortState] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState({ total: 0, sourceFile: '', sheetName: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    view.fetcher()
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows || []);
        setMeta({ total: res.total || 0, sourceFile: res.sourceFile || '', sheetName: res.sheetName || '' });
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message || err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => {
    setSortState(null);
    setPage(1);
  }, [view.key]);

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filteredRows = keyword
      ? rows.filter(row => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(keyword)))
      : rows;

    const sortedRows = sortState
      ? [...filteredRows].sort((left, right) => compareTableValues(left[sortState.key], right[sortState.key], sortState.direction))
      : filteredRows;

    return sortedRows;
  }, [query, rows, sortState]);
  const pageRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    setSortState(prev => (
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ));
    setPage(1);
  };
  useEffect(() => {
    setPage(1);
  }, [query]);
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [page, pageSize, visibleRows.length]);

  return (
    <Surface style={{ minHeight: 'calc(100vh - 92px)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${colors.tableBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{view.title}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>{view.desc}</div>
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted, textAlign: 'right', lineHeight: 1.7 }}>
            共 {meta.total} 条<br />{meta.sourceFile}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <ToolbarButton primary>+ 新增</ToolbarButton>
          <ToolbarButton>导入</ToolbarButton>
          <ToolbarButton>导出</ToolbarButton>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索姓名、员工号、部门"
            style={{ marginLeft: 'auto', width: 260, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 6, padding: '0 10px', fontSize: 12, outline: 'none', backgroundColor: colors.cardBg, color: colors.text }}
          />
        </div>
      </div>
      {error ? (
        <div style={{ padding: 20, color: colors.primary, fontSize: 13 }}>真实数据连接失败：{error}</div>
      ) : loading ? (
        <div style={{ padding: 20, color: colors.textMuted, fontSize: 13 }}>加载中...</div>
      ) : (
        <div style={{ height: 'calc(100vh - 196px)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ minWidth: view.columns.reduce((sum, col) => sum + (col.width || 140), 0), width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {view.columns.map(column => (
                  <th
                    key={column.key}
                    onClick={() => toggleSort(column.key)}
                    style={{
                      width: column.width || 140,
                      padding: '10px 12px',
                      textAlign: 'left',
                      backgroundColor: colors.tableHeaderBg,
                      borderBottom: `1px solid ${colors.tableBorder}`,
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <SortableHeaderLabel label={column.label} active={sortState?.key === column.key} direction={sortState?.direction} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => (
                <tr key={String(row.id ?? index)} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                  {view.columns.map(column => (
                    <td key={column.key} style={{ padding: '10px 12px', color: colors.text, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(row[column.key] ?? '')}>
                      {String(row[column.key] ?? '') || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {visibleRows.length === 0 ? <div style={{ padding: 20, color: colors.textMuted, fontSize: 13 }}>暂无内容</div> : null}
          <PaginationBar total={visibleRows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }} />
        </div>
      )}
    </Surface>
  );
}

type SettingsRow = {
  title: string;
  desc?: React.ReactNode;
  switchKey?: string;
  defaultOn?: boolean;
  locked?: boolean;
  link?: string;
  navigable?: boolean;
};

type SettingsSection = {
  title: string;
  rows: SettingsRow[];
};

function EmployeeSettingsSwitch({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  const { colors } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        backgroundColor: checked ? colors.primary : withAlpha(colors.textMuted, 0.34),
        transition: 'background 0.18s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
          display: 'block',
        }}
      />
    </button>
  );
}

function EmployeeSettingsSectionCard({
  section,
  values,
  onToggle,
}: {
  section: SettingsSection;
  values: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <section
      style={{
        backgroundColor: colors.cardBg,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: `0 8px 24px ${withAlpha(colors.textMuted, 0.08)}`,
      }}
    >
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 18px',
          backgroundColor: colors.tableHeaderBg,
          borderBottom: `1px solid ${colors.tableBorder}`,
        }}
      >
        <ChevronUp size={13} style={{ color: colors.textMuted, flexShrink: 0 }} />
        <strong style={{ fontSize: 16, color: colors.text }}>{section.title}</strong>
      </div>

      <div style={{ padding: '0 14px' }}>
        {section.rows.map((row, index) => {
          const hasSwitch = Boolean(row.switchKey);
          const checked = row.switchKey ? values[row.switchKey] : Boolean(row.defaultOn);
          return (
            <div
              key={row.title}
              style={{
                minHeight: row.desc ? 76 : 62,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20,
                padding: '13px 0',
                borderTop: index === 0 ? 'none' : `1px solid ${colors.tableBorder}`,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: row.desc ? 6 : 0 }}>
                  {row.locked ? <Lock size={14} style={{ color: colors.text, flexShrink: 0 }} /> : null}
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{row.title}</span>
                  {row.title.includes('校验') || row.title.includes('设置') ? (
                    <CircleHelp size={13} style={{ color: colors.textMuted, flexShrink: 0 }} />
                  ) : null}
                </div>
                {row.desc ? (
                  <div style={{ fontSize: 12, lineHeight: 1.72, color: colors.textMuted }}>
                    {row.desc}
                  </div>
                ) : null}
              </div>

              {hasSwitch && row.switchKey ? (
                <EmployeeSettingsSwitch checked={checked} onClick={() => onToggle(row.switchKey!)} />
              ) : row.navigable ? (
                <ChevronRight size={18} style={{ color: colors.textMuted, flexShrink: 0 }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmployeeManagementSettingsView() {
  const { colors } = useTheme();
  const sections: SettingsSection[] = [
    {
      title: '基础设置',
      rows: [
        {
          title: '字段设置',
          desc: <>设置花名册中各字段的启用/停用，以及各字段在「员工档案、入职」等场景是否可见/可改/必填/审批等属性。</>,
          navigable: true,
        },
        {
          title: '按业务启用档案和字段',
          desc: <>按业务场景启用档案字段 <CircleHelp size={13} style={{ verticalAlign: -2, color: colors.textMuted }} /> <ChevronRight size={13} style={{ verticalAlign: -2, color: colors.textMuted }} /></>,
        },
      ],
    },
    {
      title: '规则设置',
      rows: [
        {
          title: '工号设置',
          desc: '设置工号生成规则，如前缀/后缀、位数、适用范围等属性。',
          navigable: true,
        },
        {
          title: '人事提醒设置',
          desc: '针对员工生日、合同到期等不同场景，设置提醒内容、触发时间等专属提醒规则。',
          navigable: true,
        },
        {
          title: '证件读卡器设置',
          desc: '配置后，在新增员工或新增待入职时，可使用读卡器一键读取员工证件信息。',
          navigable: true,
        },
        {
          title: '员工离职强校验（部分校验不受该设置影响）',
          desc: <>开启后，如员工存在费控/资产/福利等业务数据未处理，将无法办理离职；<br />关闭后，校验将改为提示，可以选择继续办理离职</>,
          switchKey: 'resignCheck',
          defaultOn: true,
        },
        {
          title: '删除员工强校验（部分校验不受该设置影响）',
          desc: <>开启后，如员工存在考勤/薪酬/费控等业务数据未处理，将无法删除该员工，需处理后删除。<br />关闭后，在删除员工后，系统会自动删除这些业务数据。</>,
          switchKey: 'deleteCheck',
          defaultOn: false,
        },
        {
          title: '入职年龄设置',
          desc: <>入职年龄　允许入职的最小年龄14岁　<TextAction>修改</TextAction></>,
        },
        {
          title: '采集高质量员工头像',
          switchKey: 'avatarQuality',
          defaultOn: false,
          locked: true,
        },
      ],
    },
    {
      title: '员工档案管理',
      rows: [
        {
          title: '档案变更设置',
          desc: '设置员工花名册、员工档案库等页面「员工档案变更」流程',
          navigable: true,
        },
        {
          title: '任职信息轻管理模式',
          desc: <>开启后，可在花名册直接修改部门、岗位等关键信息，但不适用需精准分段算考勤、算薪场景。<br />关闭后，将限制仅通过任职管理修改以上关键信息，确保任职信息的规范性和一致性。</>,
          switchKey: 'lightEmployment',
          defaultOn: true,
        },
        {
          title: '兼任/借调/调店人员应用设置',
          desc: <>人员权限　兼任人员仅可见，借调人员仅可见，调店人员不可见　<TextAction>修改</TextAction></>,
        },
      ],
    },
    {
      title: '任职管理',
      rows: [
        { title: '任职管理设置', navigable: true },
        { title: '协同事项设置', locked: true, navigable: true },
      ],
    },
    {
      title: '员工合同',
      rows: [
        { title: '合同设置', navigable: true },
      ],
    },
  ];
  const defaults = sections.reduce<Record<string, boolean>>((result, section) => {
    section.rows.forEach(row => {
      if (row.switchKey) result[row.switchKey] = Boolean(row.defaultOn);
    });
    return result;
  }, {});
  const [values, setValues] = useState(defaults);
  const onToggle = (key: string) => setValues(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 20px)',
        padding: '18px 0 34px',
        backgroundColor: colors.appBg,
        overflow: 'auto',
      }}
    >
      <div style={{ width: 'min(820px, calc(100vw - 250px))', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map(section => (
          <EmployeeSettingsSectionCard key={section.title} section={section} values={values} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

function EmployeeBlacklistEmptyState() {
  const { colors } = useTheme();
  return (
    <div style={{ height: '100%', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: colors.textMuted }}>
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: '50%',
            margin: '0 auto 12px',
            backgroundColor: withAlpha(colors.textMuted, 0.1),
            border: `1px solid ${withAlpha(colors.textMuted, 0.12)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <FileText size={30} style={{ color: withAlpha(colors.textMuted, 0.45) }} />
          <span
            style={{
              position: 'absolute',
              right: 13,
              top: 14,
              width: 26,
              height: 12,
              borderRadius: 999,
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#fff' }} />
            <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#fff' }} />
            <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#fff' }} />
          </span>
        </div>
        <div style={{ fontSize: 13 }}>暂无内容</div>
      </div>
    </div>
  );
}

function BlacklistField({
  label,
  placeholder,
  width = 260,
  dateRange = false,
}: {
  label: string;
  placeholder: string;
  width?: number;
  dateRange?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text, whiteSpace: 'nowrap' }}>
      <span>{label}</span>
      <div
        style={{
          width,
          height: 32,
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: 5,
          backgroundColor: colors.cardBg,
          color: colors.textMuted,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
        }}
      >
        {dateRange ? (
          <>
            <span style={{ flex: 1 }}>{placeholder}</span>
            <span style={{ color: colors.textMuted }}>→</span>
            <span style={{ flex: 1 }}>结束日期</span>
            <CalendarDays size={14} style={{ flexShrink: 0 }} />
          </>
        ) : (
          <span>{placeholder}</span>
        )}
      </div>
    </label>
  );
}

function EmployeeBlacklistManagementView() {
  const { colors } = useTheme();
  const columns = [
    { key: 'name', label: '姓名', width: 230 },
    { key: 'type', label: '证件类型', width: 270 },
    { key: 'idNo', label: '证件号码', width: 270 },
    { key: 'time', label: '添加时间', width: 270 },
    { key: 'reason', label: '添加原因', width: 270 },
    { key: 'action', label: '操作', width: 96 },
  ];

  return (
    <Surface style={{ minHeight: 'calc(100vh - 20px)', overflow: 'hidden', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          minHeight: 74,
          padding: '16px 14px 10px',
          borderBottom: `1px solid ${colors.tableBorder}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <BlacklistField label="姓名" placeholder="请输入" />
          <BlacklistField label="证件号码" placeholder="请输入" />
          <BlacklistField label="添加时间" placeholder="开始日期" width={300} dateRange />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ToolbarButton>重置</ToolbarButton>
          <ToolbarButton primary>查询</ToolbarButton>
        </div>
      </div>

      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToolbarButton primary><Plus size={13} />新增黑名单</ToolbarButton>
          <ToolbarButton>导入</ToolbarButton>
        </div>
        <ToolbarButton title="下载"><Download size={14} /></ToolbarButton>
      </div>

      <div style={{ margin: '0 14px', border: `1px solid ${colors.tableBorder}`, borderRadius: 4, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', minWidth: columns.reduce((sum, column) => sum + column.width, 0), borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    style={{
                      width: column.width,
                      height: 40,
                      padding: '0 12px',
                      textAlign: 'left',
                      backgroundColor: colors.tableHeaderBg,
                      borderRight: `1px solid ${colors.tableBorder}`,
                      borderBottom: `1px solid ${colors.tableBorder}`,
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
          <EmployeeBlacklistEmptyState />
        </div>
      </div>

      <div style={{ height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, color: colors.text, fontSize: 12 }}>
        <span>共 0 条</span>
        <button type="button" disabled style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'not-allowed' }}>{'<'}</button>
        <span style={{ color: colors.primary }}>1</span>
        <button type="button" disabled style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'not-allowed' }}>{'>'}</button>
        <select
          value={100}
          style={{
            height: 30,
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 5,
            backgroundColor: colors.cardBg,
            color: colors.text,
            fontSize: 12,
            padding: '0 8px',
            outline: 'none',
          }}
        >
          <option value={100}>100 条/页</option>
        </select>
      </div>
    </Surface>
  );
}

function statusDotColor(value: string) {
  if (/拒绝|驳回|失败|未通过/.test(value)) return '#E43D55';
  if (/撤销|取消|已撤销/.test(value)) return '#9AA5B7';
  if (/审批中|处理中|待/.test(value)) return '#3B82F6';
  if (/通过|已入职|已转正|已调动|生效/.test(value)) return '#1CBF7A';
  return '#9AA5B7';
}

function StatusText({ value }: { value: unknown }) {
  const text = String(value ?? '') || '-';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusDotColor(text), flexShrink: 0 }} />
      {text}
    </span>
  );
}

function ActionLinks({ items }: { items: string[] }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap', minWidth: 'max-content' }}>
      {items.map(item => <TextAction key={item}>{item}</TextAction>)}
    </span>
  );
}

function EmployeeCheckboxCell() {
  const { colors } = useTheme();
  return <input type="checkbox" aria-label="选择行" style={{ width: 14, height: 14, accentColor: colors.primary, margin: 0 }} />;
}

function normalizeQrRows(rows: EmployeeGenericRecord[]) {
  if (rows.length > 0) return rows.slice(0, 1);
  return [{
    id: 'default-qr',
    二维码名称: '默认二维码',
    员工扫码方式: '招商银行App、薪福通App、微信或浏览器',
    适用部门范围: '上海拉迷家具有限公司(含其下级组织)',
    入职部门: '允许员工选择“上海拉迷家具有限公司”及其子部门',
    入职登记表: '默认登记表',
    通知接收人: '',
    二维码说明: '',
    关联法人公司: '',
    启用状态: '已启用',
  }];
}

function getEmploymentColumns(mode: EmploymentWorkbenchMode, tabKey: string): EmploymentTabConfig['columns'] {
  const selector = { key: '__select', label: '', width: 38, render: () => <EmployeeCheckboxCell /> };
  const onboardAction = { key: '__action', label: '操作', width: 130, render: () => <ActionLinks items={['查看入职事项']} /> };
  const flowAction = { key: '__action', label: '操作', width: 150, render: () => <ActionLinks items={['取消转正', '查看表单']} /> };
  const transferAction = { key: '__action', label: '操作', width: 150, render: () => <ActionLinks items={['取消调动', '查看表单']} /> };
  const viewOnlyAction = { key: '__action', label: '操作', width: 86, render: () => <ActionLinks items={['查看']} /> };

  if (mode === 'onboard' && tabKey === 'qr') {
    return [
      { key: '二维码名称', label: '二维码名称', width: 140 },
      { key: '员工扫码方式', label: '员工扫码方式', width: 260 },
      { key: '适用部门范围', label: '适用部门范围', width: 240 },
      { key: '入职部门', label: '入职部门', width: 260 },
      { key: '入职登记表', label: '入职登记表', width: 140 },
      { key: '通知接收人', label: '通知接收人', width: 130 },
      { key: '二维码说明', label: '二维码说明', width: 180 },
      { key: '关联法人公司', label: '关联法人公司', width: 180 },
      { key: '启用状态', label: '启用状态', width: 110, render: row => <StatusText value={row.启用状态} /> },
      { key: '__action', label: '操作', width: 170, render: () => <ActionLinks items={['查看二维码', '修改', '删除']} /> },
    ];
  }

  if (mode === 'onboard') {
    return [
      selector,
      { key: '姓名', label: '姓名', width: 120, link: true },
      ...(tabKey === 'pending' || tabKey === 'abandoned' ? [{ key: '手机号', label: '手机号', width: 140 }] : []),
      { key: tabKey === 'pending' || tabKey === 'abandoned' ? '预计入职日期' : '入职末级部门', label: tabKey === 'pending' || tabKey === 'abandoned' ? '预计入职日期' : '入职末级部门', width: tabKey === 'pending' || tabKey === 'abandoned' ? 130 : 180 },
      { key: tabKey === 'pending' || tabKey === 'abandoned' ? '入职末级部门' : '实际入职日期', label: tabKey === 'pending' || tabKey === 'abandoned' ? '入职末级部门' : '实际入职日期', width: tabKey === 'pending' || tabKey === 'abandoned' ? 180 : 130 },
      { key: '员工类型', label: '员工类型', width: 110 },
      { key: '岗位', label: '岗位', width: 170 },
      { key: '员工扫码登记', label: '员工扫码登记', width: 170 },
      { key: '审批状态', label: '审批状态', width: 110, render: row => <StatusText value={row.审批状态} /> },
      { key: '数据来源', label: '数据来源', width: 120 },
      { key: '添加人', label: '添加人', width: 110 },
      { key: '添加时间', label: '添加时间', width: 150 },
      onboardAction,
    ];
  }

  if (mode === 'regularization') {
    return [
      selector,
      { key: '姓名', label: '姓名', width: 120, link: true },
      { key: '员工号', label: '员工号', width: 120 },
      { key: '转正申请日期', label: '转正申请日期', width: 130 },
      { key: '转正部门', label: '转正末级部门', width: 170 },
      { key: '转正岗位', label: '转正岗位', width: 160 },
      { key: '员工类型', label: '员工类型', width: 110 },
      { key: '入职日期', label: '入职日期', width: 120 },
      { key: '计划试用期', label: '计划试用期', width: 120 },
      { key: '计划转正日期', label: '计划转正日期', width: 130 },
      { key: '实际试用期', label: '实际试用期', width: 120 },
      { key: '实际转正日期', label: '实际转正日期', width: 130 },
      { key: '转正类型', label: '转正类型', width: 120 },
      { key: '转正述职信息', label: '转正述职信息', width: 150 },
      { key: '转正评价信息', label: '转正评价信息', width: 150 },
      { key: '转正备注', label: '转正备注', width: 130 },
      { key: '表单状态', label: '表单状态', width: 120, render: row => <StatusText value={row.表单状态} /> },
      { key: '添加人', label: '添加人', width: 110 },
      tabKey === 'all' ? viewOnlyAction : flowAction,
    ];
  }

  return [
    selector,
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '调动申请日期', label: '调动申请日期', width: 130 },
    { key: '调动类型', label: '调动类型', width: 110 },
    { key: '调动原因', label: '调动原因', width: 130 },
    { key: '调动生效日期', label: '调动生效日期', width: 130 },
    { key: '表单状态', label: '表单状态', width: 120, render: row => <StatusText value={row.表单状态} /> },
    { key: '原部门', label: '原部门', width: 170 },
    { key: '调动后部门', label: '调动后部门', width: 170 },
    { key: '原岗位', label: '原岗位', width: 150 },
    { key: '调动后岗位', label: '调动后岗位', width: 150 },
    { key: '原职位', label: '原职位', width: 130 },
    { key: '调动后职位', label: '调动后职位', width: 150 },
    { key: '原职级', label: '原职级', width: 110 },
    { key: '调动后职级', label: '调动后职级', width: 120 },
    { key: '原汇报上级', label: '原汇报上级', width: 130 },
    { key: '添加人', label: '添加人', width: 110 },
    tabKey === 'all' ? viewOnlyAction : transferAction,
  ];
}

function getEmploymentTabs(mode: EmploymentWorkbenchMode): EmploymentTabConfig[] {
  if (mode === 'onboard') {
    return [
      {
        key: 'qr',
        label: '入职二维码',
        desc: '用于员工扫码提交入职登记信息。',
        rows: normalizeQrRows([]),
        columns: getEmploymentColumns(mode, 'qr'),
        primaryAction: '+ 新增二维码',
        emptyText: '暂无二维码',
        pageSize: 20,
      },
      {
        key: 'pending',
        label: '待入职',
        desc: '预计入职但尚未确认到岗的人员。',
        rows: [],
        columns: getEmploymentColumns(mode, 'pending'),
        primaryAction: '+ 新增待入职',
        importable: true,
        batch: true,
        emptyText: '暂无内容',
      },
      {
        key: 'onboarded',
        label: '已入职',
        desc: '已完成入职确认的员工记录。',
        fetcher: () => fetchEmployeeEmployment('onboarded'),
        columns: getEmploymentColumns(mode, 'onboarded'),
        summary: [{ label: '总数据', value: '103' }],
        note: '此列表页展示的是【入职管理】中已确认入职的员工记录。',
        pageSize: 50,
      },
      {
        key: 'abandoned',
        label: '放弃入职',
        desc: '放弃入职人员记录。',
        fetcher: () => fetchEmployeeEmployment('abandoned'),
        columns: getEmploymentColumns(mode, 'abandoned'),
        note: '此列表页展示的是已放弃入职的员工记录，可在详情内查看放弃原因。',
        pageSize: 50,
      },
    ];
  }

  if (mode === 'regularization') {
    return [
      {
        key: 'progress',
        label: '转正中',
        desc: '转正流程中或流程结束未到生效日的转正信息。',
        rows: [],
        columns: getEmploymentColumns(mode, 'progress'),
        primaryAction: '办理转正',
        importable: true,
        batch: true,
        emptyText: '暂无内容',
        note: '此列表页展示的是转正流程中，或者流程结束还未到生效日期的转正信息。',
      },
      {
        key: 'done',
        label: '已转正',
        desc: '已通过并生效的转正记录。',
        fetcher: () => fetchEmployeeEmployment('regularized'),
        columns: getEmploymentColumns(mode, 'done'),
        batch: true,
        note: '此列表页展示的是已经通过并生效的转正记录。',
        pageSize: 50,
      },
      {
        key: 'all',
        label: '全部转正记录',
        desc: '转正管理中发起过的所有转正记录。',
        fetcher: () => fetchEmployeeEmployment('regularizing'),
        columns: getEmploymentColumns(mode, 'all'),
        summary: [
          { label: '总数据', value: '11' },
          { label: '已通过', value: '7', tone: 'success' },
          { label: '已拒绝', value: '4', tone: 'danger' },
        ],
        note: '此列表页展示的是在【转正管理】中发起的所有转正记录，其中已撤销、已否决和取消转正的记录可在详情页重新发起。',
        pageSize: 50,
      },
    ];
  }

  return [
    {
      key: 'progress',
      label: '调动中',
      desc: '调动流程中或流程结束未到生效日期的调动信息。',
      fetcher: () => fetchEmployeeEmployment('transferring'),
      columns: getEmploymentColumns(mode, 'progress'),
      primaryAction: '+ 新增调动',
      importable: true,
      batch: true,
      note: '此列表页展示的是调动流程中，或者流程结束还未到生效日期的调动信息。',
      pageSize: 50,
    },
    {
      key: 'done',
      label: '已调动',
      desc: '调动已办理且生效的调动记录。',
      fetcher: () => fetchEmployeeEmployment('transferred'),
      columns: getEmploymentColumns(mode, 'done'),
      batch: true,
      note: '此列表页展示的是在【调动管理】中办理调动、且生效的调动记录。',
      pageSize: 50,
    },
    {
      key: 'all',
      label: '全部调动记录',
      desc: '调动管理中发起的所有调动记录。',
      fetcher: () => fetchEmployeeEmployment('transferAll'),
      columns: getEmploymentColumns(mode, 'all'),
      summary: [
        { label: '总数据', value: '34' },
        { label: '已取消', value: '1', tone: 'muted' },
        { label: '审批中', value: '2' },
        { label: '已通过', value: '16', tone: 'success' },
        { label: '已拒绝', value: '5', tone: 'danger' },
        { label: '已撤销', value: '10', tone: 'muted' },
      ],
      note: '此列表页展示的是在【调动管理】中发起的所有调动记录，其中已撤销、已否决和取消调动的记录可在详情页重新发起。',
      pageSize: 50,
    },
  ];
}

function getInitialEmploymentTab(mode: EmploymentWorkbenchMode, activeView: EmployeeViewKey) {
  if (mode === 'onboard') {
    if (activeView === 'onboarded') return 'onboarded';
    if (activeView === 'abandoned') return 'abandoned';
    return 'qr';
  }
  if (mode === 'regularization') return 'progress';
  return 'progress';
}

function EmploymentSummaryTabs({ items }: { items: NonNullable<EmploymentTabConfig['summary']> }) {
  const { colors } = useTheme();
  const toneColor = (tone?: 'default' | 'success' | 'danger' | 'muted') => {
    if (tone === 'success') return '#1CBF7A';
    if (tone === 'danger') return '#E43D55';
    if (tone === 'muted') return colors.textMuted;
    return colors.text;
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.tableBorder}`, borderRadius: 5, overflow: 'hidden' }}>
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          style={{
            height: 34,
            padding: '0 14px',
            border: 'none',
            borderRight: index === items.length - 1 ? 'none' : `1px solid ${colors.tableBorder}`,
            backgroundColor: index === 0 ? withAlpha(colors.primary, 0.1) : colors.cardBg,
            color: colors.text,
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: colors.textMuted, marginRight: 6 }}>{item.label}</span>
          <b style={{ color: toneColor(item.tone) }}>{item.value}</b>
        </button>
      ))}
    </div>
  );
}

function EmploymentFilters({ mode, tabKey }: { mode: EmploymentWorkbenchMode; tabKey: string }) {
  const isOnboardQr = mode === 'onboard' && tabKey === 'qr';
  const isOnboard = mode === 'onboard';
  const dateLabel = mode === 'regularization'
    ? tabKey === 'done' ? '实际转正日期' : '计划转正日期'
    : mode === 'transfer'
      ? '调动生效日期'
      : tabKey === 'onboarded'
        ? '实际入职日期'
        : '预计入职日期';

  if (isOnboardQr) {
    return (
      <>
        <FilterInput label="二维码名称" placeholder="请输入" />
        <SelectBox label="入职登记表" />
        <SelectBox label="关联法人公司" />
      </>
    );
  }

  return (
    <>
      <FilterInput label="姓名" placeholder="请选择人员" />
      <SelectBox label={isOnboard ? '入职部门' : mode === 'regularization' ? '转正部门' : '调动后部门'} />
      {mode === 'transfer' ? <SelectBox label="调动后的岗位" /> : null}
      <FilterInput label={dateLabel} placeholder="开始日期    →    结束日期" wide />
      {mode === 'onboard' ? <SelectBox label="员工类型" /> : null}
      {mode === 'onboard' ? <SelectBox label="岗位" /> : <SelectBox label={mode === 'regularization' ? '转正类型' : '调动类型'} />}
      <SelectBox label="表单状态" />
    </>
  );
}

function EmploymentWorkbench({ mode, activeView }: { mode: EmploymentWorkbenchMode; activeView: EmployeeViewKey }) {
  const { colors } = useTheme();
  const tabs = useMemo(() => getEmploymentTabs(mode), [mode]);
  const [activeTabKey, setActiveTabKey] = useState(getInitialEmploymentTab(mode, activeView));
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeTab = tabs.find(tab => tab.key === activeTabKey) || tabs[0];

  useEffect(() => {
    setActiveTabKey(getInitialEmploymentTab(mode, activeView));
  }, [activeView, mode]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (activeTab.rows) {
      setRows(activeTab.rows);
      setLoading(false);
      return () => { cancelled = true; };
    }
    if (!activeTab.fetcher) {
      setRows([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    activeTab.fetcher()
      .then(res => {
        if (!cancelled) setRows(res.rows || []);
      })
      .catch(err => {
        if (!cancelled) {
          setError(String(err?.message || err));
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  return (
    <Surface style={{ minHeight: 'calc(100vh - 88px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 16px', borderBottom: `1px solid ${colors.tableBorder}` }}>
        <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 26 }}>
          {tabs.map(tab => {
            const active = tab.key === activeTab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTabKey(tab.key)}
                style={{
                  height: '100%',
                  border: 'none',
                  borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
                  background: 'transparent',
                  color: active ? colors.primary : colors.textMuted,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <EmployeeFilterBar
        right={(
          <>
            <ToolbarButton title="列表设置"><Settings size={14} /></ToolbarButton>
            <ToolbarButton>重置</ToolbarButton>
            <ToolbarButton primary>查询</ToolbarButton>
            <TextAction>更多筛选 <ChevronDown size={12} /></TextAction>
          </>
        )}
      >
        <EmploymentFilters mode={mode} tabKey={activeTab.key} />
      </EmployeeFilterBar>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeTab.primaryAction ? <ToolbarButton primary>{activeTab.primaryAction}</ToolbarButton> : null}
          {activeTab.importable ? <ToolbarButton>导入</ToolbarButton> : null}
          {activeTab.batch ? <ToolbarButton>批量操作 <ChevronDown size={12} /></ToolbarButton> : null}
          {activeTab.summary ? <EmploymentSummaryTabs items={activeTab.summary} /> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToolbarButton title="下载"><Download size={14} /></ToolbarButton>
          <ToolbarButton title="字段密度"><LayoutGrid size={14} /></ToolbarButton>
          <ToolbarButton title="表格设置"><Settings size={14} /></ToolbarButton>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 18, color: colors.primary, fontSize: 13 }}>真实数据连接失败：{error}</div>
      ) : loading ? (
        <div style={{ padding: 18, color: colors.textMuted, fontSize: 13 }}>加载中...</div>
      ) : (
        <div style={{ padding: '0 16px 0', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <EmployeeTable
            columns={activeTab.columns}
            rows={rows}
            maxHeight="calc(100vh - 248px)"
            emptyText={activeTab.emptyText || '暂无内容'}
            pageSize={activeTab.pageSize || 20}
            pagination={activeTab.key !== 'qr'}
          />
          {activeTab.note ? <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.8, padding: '8px 0 10px' }}>{activeTab.note}</div> : null}
        </div>
      )}
    </Surface>
  );
}

type AssignmentMode = 'concurrent' | 'borrowed';
type AssignmentTabKey = 'all' | 'pending' | 'active' | 'ended';

type AssignmentTabConfig = {
  key: AssignmentTabKey;
  label: string;
  note: string;
  fetcher?: () => Promise<{ rows: EmployeeGenericRecord[] }>;
  rows?: EmployeeGenericRecord[];
};

function getAssignmentTabs(mode: AssignmentMode): AssignmentTabConfig[] {
  if (mode === 'concurrent') {
    return [
      { key: 'all', label: '全部', note: '此列表展示在【兼任管理】中办理的所有兼任记录。', fetcher: () => fetchEmployeeEmployment('concurrent') },
      { key: 'pending', label: '未开始', note: '此列表展示还未到兼任开始时间的兼任信息。', rows: [] },
      { key: 'active', label: '兼任中', note: '此列表展示已到兼任开始时间但还未到兼任结束日期的兼任信息。', fetcher: () => fetchEmployeeEmployment('concurrentCurrent') },
      { key: 'ended', label: '兼任结束', note: '此列表展示已到兼任结束日期的兼任信息。', fetcher: () => fetchEmployeeEmployment('concurrentEnded') },
    ];
  }

  return [
    { key: 'all', label: '全部', note: '此列表展示在【借调管理】中办理的所有借调记录。', fetcher: () => fetchEmployeeEmployment('borrowed') },
    { key: 'pending', label: '未开始', note: '此列表展示未到借调开始时间的借调信息。', fetcher: () => fetchEmployeeEmployment('borrowedPending') },
    { key: 'active', label: '借调中', note: '此列表展示到借调开始时间但还未到借调结束日期的借调信息。', fetcher: () => fetchEmployeeEmployment('borrowedActive') },
    { key: 'ended', label: '借调结束', note: '此列表展示已到借调结束日期的借调信息。', fetcher: () => fetchEmployeeEmployment('borrowedEnded') },
  ];
}

function AssignmentStatusPill({ value }: { value: unknown }) {
  const { colors } = useTheme();
  const text = String(value ?? '') || '-';
  if (text === '-') return <span>-</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 4, backgroundColor: /结束/.test(text) ? colors.badgeGrayBg : colors.badgeBlueBg, color: /结束/.test(text) ? colors.badgeGrayText : colors.badgeBlueText, fontSize: 12 }}>
      {text}
    </span>
  );
}

function AssignmentActionLinks({ mode, row }: { mode: AssignmentMode; row: EmployeeGenericRecord }) {
  const status = String(row.任职状态 ?? '');
  if (mode === 'borrowed') return <ActionLinks items={['查看']} />;
  if (/兼任中/.test(status)) return <ActionLinks items={['结束兼任', '取消兼任', '查看']} />;
  if (/兼任结束/.test(status)) return <ActionLinks items={['取消兼任', '查看']} />;
  return <ActionLinks items={['查看']} />;
}

function getAssignmentColumns(mode: AssignmentMode): EmploymentTabConfig['columns'] {
  const selector = { key: '__select', label: '', width: 40, render: () => <EmployeeCheckboxCell /> };
  if (mode === 'concurrent') {
    return [
      selector,
      { key: '姓名', label: '姓名', width: 120, link: true },
      { key: '申请日期', label: '申请日期', width: 124 },
      { key: '开始日期', label: '开始日期', width: 124 },
      { key: '结束日期', label: '结束日期', width: 124 },
      { key: '部门', label: '部门', width: 150 },
      { key: '兼任部门', label: '兼任部门', width: 160 },
      { key: '兼任岗位', label: '兼任岗位', width: 168 },
      { key: '新增兼任审批状态', label: '新增兼任审批状态', width: 154 },
      { key: '结束兼任审批状态', label: '结束兼任审批状态', width: 154 },
      { key: '任职状态', label: '任职状态', width: 120, render: row => <AssignmentStatusPill value={row.任职状态} /> },
      { key: '备注', label: '备注', width: 142 },
      { key: '添加人', label: '添加人', width: 122 },
      { key: '__action', label: '操作', width: 220, render: row => <AssignmentActionLinks mode={mode} row={row} /> },
    ];
  }

  return [
    selector,
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '申请日期', label: '申请日期', width: 124 },
    { key: '开始日期', label: '开始日期', width: 124 },
    { key: '结束日期', label: '结束日期', width: 124 },
    { key: '借调类型', label: '借调类型', width: 130 },
    { key: '借出部门', label: '借出部门', width: 160 },
    { key: '借入部门', label: '借入部门', width: 160 },
    { key: '借入岗位', label: '借入岗位', width: 160 },
    { key: '借入职位', label: '借入职位', width: 150 },
    { key: '表单状态', label: '表单状态', width: 130 },
    { key: '任职状态', label: '任职状态', width: 120, render: row => <AssignmentStatusPill value={row.任职状态} /> },
    { key: '备注', label: '备注', width: 142 },
    { key: '添加人', label: '添加人', width: 122 },
    { key: '__action', label: '操作', width: 120, render: row => <AssignmentActionLinks mode={mode} row={row} /> },
  ];
}

function AssignmentFilters({ mode }: { mode: AssignmentMode }) {
  if (mode === 'concurrent') {
    return (
      <>
        <FilterInput label="姓名" placeholder="请选择人员" withUserIcon />
        <SelectBox label="兼任部门" />
        <SelectBox label="兼任岗位" />
        <FilterInput label="开始日期" placeholder="开始日期    →    结束日期" wide withCalendarIcon />
      </>
    );
  }

  return (
    <>
      <FilterInput label="开始日期" placeholder="开始日期    →    结束日期" wide withCalendarIcon />
      <FilterInput label="姓名" placeholder="请选择人员" withUserIcon />
      <SelectBox label="借入部门" />
      <SelectBox label="借入岗位" />
    </>
  );
}

function AssignmentEmptyState() {
  const { colors } = useTheme();
  return (
    <div style={{ height: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: colors.textMuted, fontSize: 13 }}>
      <div style={{ width: 66, height: 66, borderRadius: '50%', backgroundColor: withAlpha(colors.textMuted, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' }}>
        <FileText size={32} strokeWidth={1.4} style={{ color: withAlpha(colors.textMuted, 0.55) }} />
        <span style={{ position: 'absolute', right: 9, top: 17, width: 28, height: 14, borderRadius: 999, backgroundColor: colors.primary, color: '#fff', fontSize: 12, lineHeight: '14px', textAlign: 'center', fontWeight: 700 }}>...</span>
      </div>
      暂无内容
    </div>
  );
}

function AssignmentWorkbench({ mode }: { mode: AssignmentMode }) {
  const { colors } = useTheme();
  const tabs = useMemo(() => getAssignmentTabs(mode), [mode]);
  const [activeTabKey, setActiveTabKey] = useState<AssignmentTabKey>(mode === 'concurrent' ? 'active' : 'all');
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeTab = tabs.find(tab => tab.key === activeTabKey) || tabs[0];
  const columns = useMemo(() => getAssignmentColumns(mode), [mode]);
  const title = mode === 'concurrent' ? '兼任管理' : '借调管理';
  const primaryAction = mode === 'concurrent' ? '+ 新增兼任' : '+ 新增借调';

  useEffect(() => {
    setActiveTabKey(mode === 'concurrent' ? 'active' : 'all');
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (activeTab.rows) {
      setRows(activeTab.rows);
      setLoading(false);
      return () => { cancelled = true; };
    }
    if (!activeTab.fetcher) {
      setRows([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    activeTab.fetcher()
      .then(res => {
        if (!cancelled) setRows(res.rows || []);
      })
      .catch(err => {
        if (!cancelled) {
          setError(String(err?.message || err));
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  return (
    <Surface style={{ minHeight: 'calc(100vh - 88px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <EmployeeFilterBar
        right={(
          <>
            <ToolbarButton title="列表设置"><Settings size={14} /></ToolbarButton>
            <ToolbarButton>重置</ToolbarButton>
            <ToolbarButton primary>查询</ToolbarButton>
          </>
        )}
      >
        <AssignmentFilters mode={mode} />
      </EmployeeFilterBar>

      <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const active = tab.key === activeTab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTabKey(tab.key)}
              style={{
                height: 30,
                padding: '0 12px',
                border: `1px solid ${active ? withAlpha(colors.primary, 0.25) : 'transparent'}`,
                borderRadius: 5,
                backgroundColor: active ? withAlpha(colors.primary, 0.1) : colors.tableHeaderBg,
                color: active ? colors.primary : colors.text,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: active ? 700 : 400,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px 12px' }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToolbarButton primary><Plus size={13} />{primaryAction.replace('+ ', '')}</ToolbarButton>
          <ToolbarButton>批量操作 <ChevronDown size={12} /></ToolbarButton>
          <ToolbarButton>更多操作 <ChevronDown size={12} /></ToolbarButton>
          <ToolbarButton title="下载"><Download size={14} /></ToolbarButton>
          <ToolbarButton title="字段密度"><LayoutGrid size={14} /></ToolbarButton>
          <ToolbarButton title="表格设置"><Settings size={14} /></ToolbarButton>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 18, color: colors.primary, fontSize: 13 }}>真实数据连接失败：{error}</div>
      ) : loading ? (
        <div style={{ padding: 18, color: colors.textMuted, fontSize: 13 }}>加载中...</div>
      ) : (
        <div style={{ padding: '0 16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <EmployeeTable
            columns={columns}
            rows={rows}
            maxHeight="calc(100vh - 238px)"
            emptyText="暂无内容"
            emptyState={<AssignmentEmptyState />}
            pageSize={mode === 'concurrent' && activeTab.key === 'all' ? 20 : 20}
          />
          <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.8, padding: '8px 0 10px' }}>{activeTab.note}</div>
        </div>
      )}
    </Surface>
  );
}

type BackendTabConfig = {
  key: string;
  label: string;
  note: string;
  fetcher?: () => Promise<{ total: number; rows: EmployeeGenericRecord[]; sourceFile?: string; sheetName?: string }>;
  rows?: EmployeeGenericRecord[];
  columns: EmploymentTabConfig['columns'];
  primaryAction?: string;
  importable?: boolean;
  batch?: boolean;
  summary?: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'danger' | 'muted' }>;
  pageSize?: number;
  notice?: string;
};

function BackendNotice({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ minHeight: 34, margin: '0 16px 12px', padding: '0 12px', border: `1px solid ${withAlpha(colors.primary, 0.32)}`, backgroundColor: withAlpha(colors.primary, 0.08), color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, borderRadius: 4 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Info size={14} style={{ color: colors.primary, flexShrink: 0 }} />
        {children}
      </span>
      <X size={13} style={{ color: colors.textMuted }} />
    </div>
  );
}

function BackendEmptyState() {
  const { colors } = useTheme();
  return (
    <div style={{ height: '100%', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: colors.textMuted, fontSize: 13 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: withAlpha(colors.textMuted, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
        <FileText size={36} strokeWidth={1.35} style={{ color: withAlpha(colors.textMuted, 0.5) }} />
        <span style={{ position: 'absolute', right: 8, top: 18, width: 30, height: 15, borderRadius: 999, backgroundColor: colors.primary, color: '#fff', fontSize: 12, lineHeight: '15px', textAlign: 'center', fontWeight: 700 }}>...</span>
      </div>
      暂无内容
    </div>
  );
}

function BackendFilterToolbar({ children, moreFilter = true }: { children: React.ReactNode; moreFilter?: boolean }) {
  return (
    <EmployeeFilterBar
      right={(
        <>
          <ToolbarButton title="列表设置"><Settings size={14} /></ToolbarButton>
          <ToolbarButton>重置</ToolbarButton>
          <ToolbarButton primary>查询</ToolbarButton>
          {moreFilter ? <TextAction>更多筛选 <ChevronDown size={12} /></TextAction> : null}
        </>
      )}
    >
      {children}
    </EmployeeFilterBar>
  );
}

function BackendTableActions({ tab }: { tab: BackendTabConfig }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {tab.primaryAction ? <ToolbarButton primary>{tab.primaryAction}</ToolbarButton> : null}
        {tab.importable ? <ToolbarButton>导入</ToolbarButton> : null}
        {tab.batch ? <ToolbarButton>批量操作 <ChevronDown size={12} /></ToolbarButton> : null}
        {tab.summary ? <EmploymentSummaryTabs items={tab.summary} /> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ToolbarButton title="下载"><Download size={14} /></ToolbarButton>
        <ToolbarButton title="字段密度"><LayoutGrid size={14} /></ToolbarButton>
        <ToolbarButton title="表格设置"><Settings size={14} /></ToolbarButton>
      </div>
    </div>
  );
}

function BackendTabStrip({ tabs, activeKey, onChange }: { tabs: BackendTabConfig[]; activeKey: string; onChange: (key: string) => void }) {
  const { colors } = useTheme();
  return (
    <div style={{ padding: '0 16px', borderBottom: `1px solid ${colors.tableBorder}` }}>
      <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 26 }}>
        {tabs.map(tab => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              style={{ height: '100%', border: 'none', borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent', background: 'transparent', color: active ? colors.primary : colors.textMuted, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', padding: '0 2px' }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useBackendRows(activeTab: BackendTabConfig) {
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (activeTab.rows) {
      setRows(activeTab.rows);
      setLoading(false);
      return () => { cancelled = true; };
    }
    if (!activeTab.fetcher) {
      setRows([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    activeTab.fetcher()
      .then(res => {
        if (!cancelled) setRows(res.rows || []);
      })
      .catch(err => {
        if (!cancelled) {
          setError(String(err?.message || err));
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  return { rows, loading, error };
}

function BackendTabbedTable({
  tabs,
  initialKey,
  filters,
  tableHeight = 'calc(100vh - 246px)',
}: {
  tabs: BackendTabConfig[];
  initialKey: string;
  filters: (activeTab: BackendTabConfig) => React.ReactNode;
  tableHeight?: string;
}) {
  const { colors } = useTheme();
  const [activeKey, setActiveKey] = useState(initialKey);
  const activeTab = tabs.find(tab => tab.key === activeKey) || tabs[0];
  const { rows, loading, error } = useBackendRows(activeTab);

  useEffect(() => setActiveKey(initialKey), [initialKey]);

  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 8 }}>
      <BackendTabStrip tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />
      {activeTab.notice ? <BackendNotice>{activeTab.notice}</BackendNotice> : null}
      <BackendFilterToolbar>{filters(activeTab)}</BackendFilterToolbar>
      <BackendTableActions tab={activeTab} />
      {error ? (
        <div style={{ padding: 18, color: colors.primary, fontSize: 13 }}>真实数据连接失败：{error}</div>
      ) : loading ? (
        <div style={{ padding: 18, color: colors.textMuted, fontSize: 13 }}>加载中...</div>
      ) : (
        <div style={{ padding: '0 16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <EmployeeTable
            columns={activeTab.columns}
            rows={rows}
            maxHeight={tableHeight}
            emptyState={<BackendEmptyState />}
            pageSize={activeTab.pageSize || 50}
            pagination={rows.length > 0}
          />
          <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.8, padding: '8px 0 10px' }}>{activeTab.note}</div>
        </div>
      )}
    </Surface>
  );
}

function EmployeeServiceInlineTabs({
  tabs,
  activeKey,
  onChange,
}: {
  tabs: Array<{ key: string; label: string }>;
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <div style={{ padding: '0 16px', borderBottom: `1px solid ${colors.tableBorder}` }}>
      <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 28 }}>
        {tabs.map(tab => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              style={{
                height: '100%',
                border: 'none',
                borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
                background: 'transparent',
                color: active ? colors.primary : colors.textMuted,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                padding: '0 2px',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ServiceFlagStat({ label = '全部', value = '0' }: { label?: string; value?: string }) {
  const { colors } = useTheme();
  return (
    <button
      type="button"
      style={{
        height: 36,
        minWidth: 74,
        border: `1px solid ${withAlpha(colors.primary, 0.18)}`,
        borderRadius: 6,
        backgroundColor: withAlpha(colors.primary, 0.09),
        color: colors.text,
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <strong style={{ color: colors.primary }}>{value}</strong>
      <span
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderTop: `12px solid ${colors.primary}`,
          borderLeft: '12px solid transparent',
        }}
      />
    </button>
  );
}

function ServiceCheckboxLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.textMuted, whiteSpace: 'nowrap' }}>
      <input type="checkbox" style={{ width: 14, height: 14, margin: 0, accentColor: colors.primary }} />
      {children}
    </label>
  );
}

function ServiceToggle({ checked = true }: { checked?: boolean }) {
  const { colors } = useTheme();
  return (
    <span
      style={{
        width: 30,
        height: 16,
        borderRadius: 999,
        backgroundColor: checked ? colors.primary : colors.inputBorder,
        display: 'inline-flex',
        alignItems: 'center',
        padding: 2,
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transform: checked ? 'translateX(14px)' : 'translateX(0)',
          transition: 'transform 0.16s',
        }}
      />
    </span>
  );
}

function WordTemplateName({ name, pinned = false }: { name: string; pinned?: boolean }) {
  const { colors } = useTheme();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: withAlpha('#2DB7C7', 0.9), color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>W</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {pinned ? <span style={{ color: colors.primary, fontSize: 11, fontWeight: 800 }}>固</span> : null}
    </span>
  );
}

function DefaultTemplateTag() {
  const { colors } = useTheme();
  return (
    <span style={{ height: 22, padding: '0 8px', borderRadius: 4, backgroundColor: colors.badgeGreenBg, color: colors.badgeGreenText, display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
      默认
    </span>
  );
}

function CertificateIssueWorkbench() {
  const { colors } = useTheme();
  const [activeKey, setActiveKey] = useState('issue');
  const certificateTabs = [
    { key: 'issue', label: '开具管理' },
    { key: 'requests', label: '申请记录' },
    { key: 'template', label: '模板管理' },
  ];
  const templateRows: EmployeeGenericRecord[] = [
    { id: 1, name: '收入证明', type: '默认', business: '智能薪薪', certType: '收入证明', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:09:43', pinned: true },
    { id: 2, name: '在职证明', type: '默认', business: '员工管理', certType: '在职证明', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:08:01', pinned: true },
    { id: 3, name: '转正通知', type: '默认', business: '员工管理', certType: '转正通知', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:05:03' },
    { id: 4, name: '终止劳动合同证明', type: '默认', business: '员工管理', certType: '终止劳动合同证明', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:05:03' },
    { id: 5, name: '劳动合同续签通知书', type: '默认', business: '员工管理', certType: '劳动合同续签通知书', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:05:03' },
    { id: 6, name: '离职证明', type: '默认', business: '员工管理', certType: '离职证明', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:05:03' },
    { id: 7, name: '旅游签证证明', type: '默认', business: '智能薪薪', certType: '旅游签证证明', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:05:03' },
    { id: 8, name: '银行业务证明', type: '默认', business: '智能薪薪', certType: '银行业务证明', enabled: true, creator: '范敏敏', createdAt: '2025-10-14 11:05:03', updater: '范敏敏', updatedAt: '2025-10-14 11:05:03' },
  ];
  const issueColumns: EmploymentTabConfig['columns'] = [
    { key: '__select', label: '', width: 38, render: () => <EmployeeCheckboxCell /> },
    { key: 'name', label: '姓名', width: 110 },
    { key: 'employeeNo', label: '员工号', width: 110 },
    { key: 'dept', label: '部门', width: 150 },
    { key: 'position', label: '岗位', width: 130 },
    { key: 'templateName', label: '模板名称', width: 180 },
    { key: 'certType', label: '证明类型', width: 130 },
    { key: 'business', label: '业务归属', width: 120 },
    { key: 'reason', label: '申请事由', width: 220 },
    { key: 'issuer', label: '开具人', width: 120 },
    { key: 'progress', label: '开具进度', width: 120 },
    { key: 'issuedAt', label: '开具时间', width: 160 },
    { key: 'approvalNo', label: '审批编号', width: 150 },
    { key: '__action', label: '操作', width: 120 },
  ];
  const requestColumns: EmploymentTabConfig['columns'] = [
    { key: 'approvalNo', label: '审批编号', width: 160 },
    { key: 'applicant', label: '申请人', width: 120 },
    { key: 'employeeNo', label: '申请人员工号', width: 140 },
    { key: 'dept', label: '申请人部门', width: 150 },
    { key: 'position', label: '申请人岗位', width: 140 },
    { key: 'certType', label: '证明类型', width: 130 },
    { key: 'reason', label: '申请事由', width: 220 },
    { key: 'newInfo', label: '新发信息', width: 160 },
    { key: 'approvalStatus', label: '审批状态', width: 120 },
    { key: 'processStatus', label: '处理状态', width: 120 },
    { key: 'startedAt', label: '发起时间', width: 160 },
    { key: 'completedAt', label: '完成时间', width: 160 },
  ];
  const templateColumns: EmploymentTabConfig['columns'] = [
    { key: 'name', label: '模板名称', width: 300, render: row => <WordTemplateName name={String(row.name)} pinned={Boolean(row.pinned)} /> },
    { key: 'type', label: '模板类型', width: 120, render: () => <DefaultTemplateTag /> },
    { key: 'business', label: '业务归属', width: 140 },
    { key: 'certType', label: '证明类型', width: 160 },
    { key: 'enabled', label: '启用/停用', width: 130, render: row => <ServiceToggle checked={Boolean(row.enabled)} /> },
    { key: 'creator', label: '创建人', width: 130 },
    { key: 'createdAt', label: '创建时间', width: 160 },
    { key: 'updater', label: '更新人', width: 130 },
    { key: 'updatedAt', label: '更新时间', width: 160 },
    { key: '__action', label: '操作', width: 154, render: () => <ActionLinks items={['编辑', '预览', '置顶']} /> },
  ];

  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 8 }}>
      <EmployeeServiceInlineTabs tabs={certificateTabs} activeKey={activeKey} onChange={setActiveKey} />
      {activeKey === 'issue' ? (
        <>
          <BackendFilterToolbar>
            <FilterInput label="姓名" />
            <SelectBox label="业务归属" />
            <SelectBox label="证明类型" />
            <SelectBox label="是否电子签" />
            <FilterInput label="开具人" />
          </BackendFilterToolbar>
          <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <ServiceFlagStat />
          </div>
          <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ToolbarButton primary><Plus size={13} />发起开具</ToolbarButton>
            <ToolbarButton>导出</ToolbarButton>
            <ToolbarButton>批量操作 <ChevronDown size={12} /></ToolbarButton>
            <div style={{ marginLeft: 'auto' }}><TextAction>用印审批</TextAction></div>
          </div>
          <div style={{ padding: '0 16px', flex: 1, minHeight: 0 }}>
            <EmployeeTable columns={issueColumns} rows={[]} maxHeight="calc(100vh - 252px)" pagination={false} emptyState={<BackendEmptyState />} />
          </div>
        </>
      ) : activeKey === 'requests' ? (
        <>
          <BackendFilterToolbar moreFilter={false}>
            <FilterInput label="申请人" />
            <SelectBox label="证明类型" />
            <FilterInput label="发起时间" placeholder="开始日期      →      结束日期" wide withCalendarIcon />
          </BackendFilterToolbar>
          <div style={{ padding: '0 16px 12px' }}><ServiceFlagStat /></div>
          <div style={{ padding: '0 16px 12px' }}><ToolbarButton>导出</ToolbarButton></div>
          <div style={{ padding: '0 16px', flex: 1, minHeight: 0 }}>
            <EmployeeTable columns={requestColumns} rows={[]} maxHeight="calc(100vh - 230px)" pagination={false} emptyState={<BackendEmptyState />} />
          </div>
        </>
      ) : (
        <>
          <BackendFilterToolbar moreFilter={false}>
            <FilterInput label="模板名称" placeholder="请输入" />
            <SelectBox label="证明类型" />
            <SelectBox label="模板类型" />
          </BackendFilterToolbar>
          <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ToolbarButton primary><Plus size={13} />新增</ToolbarButton>
            <ToolbarButton>证明类型管理</ToolbarButton>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
              <ServiceCheckboxLabel>仅查看置顶模板</ServiceCheckboxLabel>
              <ServiceCheckboxLabel>仅查看已启用模板</ServiceCheckboxLabel>
            </div>
          </div>
          <div style={{ padding: '0 16px', flex: 1, minHeight: 0 }}>
            <EmployeeTable columns={templateColumns} rows={templateRows} maxHeight="calc(100vh - 218px)" pageSize={50} />
          </div>
        </>
      )}
    </Surface>
  );
}

function CustomPrintWorkbench() {
  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 8 }}>
      <BackendFilterToolbar moreFilter={false}>
        <FilterInput label="模板名称" placeholder="请输入" />
        <FilterInput label="创建人" placeholder="请选择" withUserIcon />
        <FilterInput label="更新人" placeholder="请选择" withUserIcon />
        <SelectBox label="模板类型" />
      </BackendFilterToolbar>
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ServiceCheckboxLabel>仅查看置顶模板</ServiceCheckboxLabel>
          <ServiceCheckboxLabel>仅查看已启用模板</ServiceCheckboxLabel>
          <ToolbarButton title="全屏"><Maximize2 size={14} /></ToolbarButton>
        </div>
      </div>
      <div style={{ padding: '0 16px', flex: 1, minHeight: 0 }}>
        <EmployeeTable
          columns={[
            { key: 'templateName', label: '模板名称', width: 340 },
            { key: 'creator', label: '创建人', width: 210 },
            { key: 'createdAt', label: '创建时间', width: 210 },
            { key: 'updater', label: '更新人', width: 210 },
            { key: 'updatedAt', label: '更新时间', width: 210 },
            { key: '__action', label: '操作', width: 130 },
          ]}
          rows={[]}
          maxHeight="calc(100vh - 178px)"
          pagination={false}
          emptyState={<BackendEmptyState />}
        />
      </div>
    </Surface>
  );
}

function PrintTemplateManagementWorkbench() {
  const [activeKey, setActiveKey] = useState('archive');
  const tabs = [
    { key: 'archive', label: '员工档案信息表' },
    { key: 'custom', label: '自定义打印' },
  ];
  const columns = activeKey === 'archive'
    ? [
      { key: 'templateName', label: '模板名称', width: 300 },
      { key: 'enabled', label: '启用/停用', width: 210 },
      { key: 'creator', label: '创建人', width: 210 },
      { key: 'createdAt', label: '创建时间', width: 210 },
      { key: 'updater', label: '更新人', width: 210 },
      { key: 'updatedAt', label: '更新时间', width: 210 },
      { key: '__action', label: '操作', width: 130 },
    ]
    : [
      { key: 'templateName', label: '模板名称', width: 340 },
      { key: 'creator', label: '创建人', width: 230 },
      { key: 'createdAt', label: '创建时间', width: 230 },
      { key: 'updater', label: '更新人', width: 230 },
      { key: 'updatedAt', label: '更新时间', width: 230 },
      { key: '__action', label: '操作', width: 130 },
    ];

  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 8 }}>
      <EmployeeServiceInlineTabs tabs={tabs} activeKey={activeKey} onChange={setActiveKey} />
      <BackendFilterToolbar moreFilter={false}>
        <FilterInput label="模板名称" placeholder="请输入" />
        <FilterInput label="创建人" placeholder="请选择" withUserIcon />
        <FilterInput label="更新人" placeholder="请选择" withUserIcon />
        <SelectBox label="模板类型" />
      </BackendFilterToolbar>
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ToolbarButton primary><Plus size={13} />新增</ToolbarButton>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <ServiceCheckboxLabel>仅查看置顶模板</ServiceCheckboxLabel>
          <ServiceCheckboxLabel>仅查看已启用模板</ServiceCheckboxLabel>
          <ToolbarButton title="全屏"><Maximize2 size={14} /></ToolbarButton>
        </div>
      </div>
      <div style={{ padding: '0 16px', flex: 1, minHeight: 0 }}>
        <EmployeeTable columns={columns} rows={[]} maxHeight="calc(100vh - 220px)" pagination={false} emptyState={<BackendEmptyState />} />
      </div>
    </Surface>
  );
}

function ThirdPartyDockingWorkbench() {
  const { colors } = useTheme();
  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.appBg }}>
      <div style={{ width: 560, textAlign: 'center', color: colors.textMuted, fontSize: 13, lineHeight: 1.8 }}>
        <div style={{ width: 74, height: 74, borderRadius: '50%', backgroundColor: colors.cardBg, border: `1px solid ${colors.tableBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
          <Folders size={36} strokeWidth={1.35} style={{ color: withAlpha(colors.textMuted, 0.55) }} />
          <span style={{ position: 'absolute', right: 12, bottom: 15, width: 22, height: 22, borderRadius: 6, backgroundColor: colors.primary, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={13} />
          </span>
        </div>
        <div>暂未启用组织员工同步的第三方平台维护数据功能，当前页面无法使用</div>
        <div>如需开启请前往「薪福通开放平台 - 连接器」设置</div>
      </div>
    </Surface>
  );
}

function ContractStatusPill({ value, tone }: { value: unknown; tone?: 'warning' | 'success' | 'muted' | 'danger' }) {
  const { colors } = useTheme();
  const text = String(value ?? '').trim() || '-';
  if (text === '-') return <span>-</span>;
  const resolvedTone = tone
    || (/解除|已签署|执行中|正式|已授权/.test(text) ? 'success'
      : /撤回|过期|撤销|未授权|已到期/.test(text) ? 'muted'
        : /拒绝|失败/.test(text) ? 'danger'
          : 'warning');
  const palette = {
    warning: { bg: '#FFF4D8', fg: '#9A5A00' },
    success: { bg: colors.badgeGreenBg, fg: colors.badgeGreenText },
    muted: { bg: colors.badgeGrayBg, fg: colors.badgeGrayText },
    danger: { bg: colors.badgeRedBg, fg: colors.badgeRedText },
  }[resolvedTone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 4, backgroundColor: palette.bg, color: palette.fg, fontSize: 12, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function ContractActionLinks({ row, mode }: { row: EmployeeGenericRecord; mode: 'new' | 'renewal' | 'signing' | 'signRecords' | 'release' | 'releaseRecords' | 'ledger' }) {
  const progress = String(row.signProgress || row.releaseProgress || '');
  if (mode === 'new') return <ActionLinks items={['发起新签']} />;
  if (mode === 'renewal') return <ActionLinks items={['发起续签', '忽略提醒']} />;
  if (mode === 'signing') return <ActionLinks items={['催办', '撤回', '查看']} />;
  if (mode === 'signRecords') return <ActionLinks items={progress.includes('已过期') ? ['查看', '延期'] : ['查看']} />;
  if (mode === 'release') return <ActionLinks items={['查看表单']} />;
  if (mode === 'releaseRecords') return <ActionLinks items={progress.includes('已解除') ? ['取消解除', '查看'] : ['查看']} />;
  return <ActionLinks items={['查看', '编辑']} />;
}

const contractSelectColumn = { key: '__select', label: '', width: 38, render: () => <EmployeeCheckboxCell /> };

function contractSummary(rows: EmployeeGenericRecord[], specs: Array<{ label: string; match?: (row: EmployeeGenericRecord) => boolean; tone?: 'default' | 'success' | 'danger' | 'muted' }>) {
  return specs.map(spec => ({
    label: spec.label,
    value: String(spec.match ? rows.filter(spec.match).length : rows.length),
    tone: spec.tone,
  }));
}

function ContractStartFilters({ activeTab }: { activeTab: BackendTabConfig }) {
  if (activeTab.key === 'custom') {
    return (
      <>
        <FilterInput label="姓名" />
        <SelectBox label="部门" />
        <FilterInput label="入职日期" placeholder="开始日期    →    结束日期" wide withCalendarIcon />
        <FilterInput label="员工号" />
        <SelectBox label="岗位" />
      </>
    );
  }

  if (activeTab.key === 'renewal') {
    return (
      <>
        <FilterInput label="姓名" />
        <SelectBox label="部门" />
        <FilterInput label="员工号" />
        <SelectBox label="岗位" />
        <SelectBox label="员工类型" />
      </>
    );
  }

  return (
    <>
      <FilterInput label="姓名" />
      <SelectBox label="部门" />
      <FilterInput label="入职日期" placeholder="开始日期    →    结束日期" wide withCalendarIcon />
      <FilterInput label="员工号" />
      <SelectBox label="岗位" />
    </>
  );
}

function ContractStartWorkbench({ initial }: { initial: 'new' | 'renewal' | 'custom' }) {
  const tabs = useMemo<BackendTabConfig[]>(() => [
    {
      key: 'new',
      label: '入职新签',
      note: '此列表展示未签署劳动合同或员工手册的入职员工，可批量发起新签。',
      fetcher: () => fetchEmployeeContracts('newSign').then(res => {
        const rows = res.rows as unknown as EmployeeGenericRecord[];
        return { ...res, rows };
      }),
      columns: [
        contractSelectColumn,
        { key: 'name', label: '姓名', width: 118, link: true },
        { key: 'dept', label: '部门', width: 170 },
        { key: 'deptFullPath', label: '部门全路径', width: 230 },
        { key: 'startDate', label: '入职日期', width: 120 },
        { key: 'employeeNo', label: '员工号', width: 120 },
        { key: 'position', label: '岗位', width: 150 },
        { key: 'employeeType', label: '员工类型', width: 120 },
        { key: 'contractStatus', label: '员工状态', width: 120, render: row => <StatusText value={row.contractStatus} /> },
        { key: 'signProgress', label: '签署进度', width: 120, render: row => <ContractStatusPill value={row.signProgress} /> },
        { key: 'employeeAuthStatus', label: '员工授权状态', width: 150, render: row => <ContractStatusPill value={row.employeeAuthStatus} /> },
        { key: '__action', label: '操作', width: 112, render: row => <ContractActionLinks row={row} mode="new" /> },
      ],
      summary: [{ label: '全部', value: '80' }, { label: '待新签', value: '78' }, { label: '签署中', value: '2' }],
      batch: true,
      pageSize: 50,
      notice: '共 80 名员工未签署劳动合同或员工协议，近30天入职 28 名，超30天有 51 名，请及时新签。',
    },
    {
      key: 'renewal',
      label: '到期续签',
      note: '此列表展示已到期或即将到期的合同记录，可发起续签或忽略提醒。',
      fetcher: () => fetchEmployeeContracts('renewal').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
      columns: [
        contractSelectColumn,
        { key: 'name', label: '姓名', width: 118, link: true },
        { key: 'employeeNo', label: '员工号', width: 120 },
        { key: 'dept', label: '部门', width: 150 },
        { key: 'deptFullPath', label: '部门全路径', width: 230 },
        { key: 'position', label: '岗位', width: 150 },
        { key: 'employeeType', label: '员工类型', width: 120 },
        { key: 'company', label: '合同公司', width: 220 },
        { key: 'contractNo', label: '合同编号', width: 140 },
        { key: 'contractType', label: '合同类型', width: 170 },
        { key: 'contractTerm', label: '合同期限', width: 110 },
        { key: 'startDate', label: '合同起始日', width: 120 },
        { key: 'endDate', label: '合同到期日', width: 120 },
        { key: 'contractStatus', label: '合同状态', width: 118, render: row => <ContractStatusPill value={row.contractStatus} tone="muted" /> },
        { key: 'contractAttachment', label: '合同信息附件', width: 130 },
        { key: '__action', label: '操作', width: 160, render: row => <ContractActionLinks row={row} mode="renewal" /> },
      ],
      summary: [{ label: '全部', value: '77' }, { label: '待续签', value: '77' }],
      batch: true,
      pageSize: 50,
      notice: '共 77 份在职员工的到期合同，30天内到期有 8 份，已到期有 69 份，请及时续签。',
    },
    {
      key: 'custom',
      label: '自定义发起',
      note: '自定义发起用于入职新签、到期续签之外的补充签署场景。',
      rows: [],
      columns: [
        contractSelectColumn,
        { key: 'name', label: '姓名', width: 120 },
        { key: 'dept', label: '部门', width: 170 },
        { key: 'deptFullPath', label: '部门全路径', width: 230 },
        { key: 'startDate', label: '入职日期', width: 120 },
        { key: 'employeeNo', label: '员工号', width: 120 },
        { key: 'position', label: '岗位', width: 150 },
        { key: 'employeeType', label: '员工类型', width: 120 },
        { key: 'contractStatus', label: '员工状态', width: 120 },
        { key: 'signProgress', label: '签署进度', width: 120 },
        { key: 'employeeAuthStatus', label: '员工授权状态', width: 150 },
        { key: '__action', label: '操作', width: 100 },
      ],
      summary: [{ label: '全部', value: '0' }],
      primaryAction: '+ 新增',
      batch: true,
      pageSize: 50,
      notice: '企业可通过“自定义发起”自由为员工发起签署，用作入职新签、到期续签之外的场景补充。',
    },
  ], []);

  return (
    <BackendTabbedTable
      tabs={tabs}
      initialKey={initial}
      filters={(activeTab) => <ContractStartFilters activeTab={activeTab} />}
      tableHeight="calc(100vh - 270px)"
    />
  );
}

function ContractApprovalDisabled() {
  const { colors } = useTheme();
  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '0 16px', borderBottom: `1px solid ${colors.tableBorder}` }}>
        <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 26 }}>
          <button type="button" style={{ height: '100%', border: 'none', borderBottom: `2px solid ${colors.primary}`, background: 'transparent', color: colors.primary, fontSize: 13, fontWeight: 700, padding: '0 2px' }}>合同审批</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
        <div style={{ width: 560, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: colors.text, marginBottom: 22 }}>合同审批功能未开启</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 34 }}>请前往「员工管理-基础设置-合同设置」开启合同审批</div>
          <div style={{ height: 150, border: `1px solid ${colors.cardBorder}`, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 160px', textAlign: 'left', overflow: 'hidden', marginBottom: 34, backgroundColor: colors.cardBg }}>
            <div style={{ padding: '28px 32px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, marginBottom: 14 }}>开启此功能后</div>
              {['员工合同签订对接 OA 审批', '针对合同新增的场景设置是否审批', '先审批后签署，符合企业规范'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.text, lineHeight: 1.9 }}>
                  <FileText size={14} style={{ color: colors.textMuted }} />
                  {item}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: withAlpha(colors.primary, 0.055) }}>
              <div style={{ width: 94, height: 94, borderRadius: '50%', backgroundColor: withAlpha(colors.primary, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={48} strokeWidth={1.3} style={{ color: colors.primary }} />
              </div>
            </div>
          </div>
          <button type="button" style={{ width: 240, height: 36, border: 'none', borderRadius: 5, backgroundColor: colors.primary, color: '#fff', fontSize: 13, cursor: 'pointer' }}>去开启</button>
        </div>
      </div>
    </Surface>
  );
}

function ContractSigningFilters() {
  return (
    <>
      <FilterInput label="姓名" />
      <SelectBox label="部门" />
      <SelectBox label="合同公司" />
      <FilterInput label="合同编号" />
      <SelectBox label="合同类型" />
    </>
  );
}

function ContractSigningWorkbench() {
  const tabs = useMemo<BackendTabConfig[]>(() => [
    {
      key: 'signing',
      label: '签署中',
      note: '此列表展示当前签署中的合同记录，可催办、撤回或查看详情。',
      fetcher: () => fetchEmployeeContracts('signing').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
      columns: [
        contractSelectColumn,
        { key: 'name', label: '姓名', width: 118, link: true },
        { key: 'dept', label: '部门', width: 170 },
        { key: 'deptFullPath', label: '部门全路径', width: 220 },
        { key: 'company', label: '合同公司', width: 220 },
        { key: 'contractNo', label: '合同编号', width: 140 },
        { key: 'contractType', label: '合同类型', width: 150 },
        { key: 'contractTerm', label: '合同期限', width: 120 },
        { key: 'startDate', label: '合同起始日', width: 120 },
        { key: 'endDate', label: '合同到期日', width: 120 },
        { key: 'signProgress', label: '电子签署进度', width: 140, render: row => <ContractStatusPill value={row.signProgress} /> },
        { key: 'dataSource', label: '数据来源', width: 120 },
        { key: 'initiator', label: '发起人', width: 120 },
        { key: 'handler', label: '经办人', width: 120 },
        { key: 'initiateTime', label: '发起时间', width: 160 },
        { key: '__action', label: '操作', width: 180, render: row => <ContractActionLinks row={row} mode="signing" /> },
      ],
      summary: [{ label: '全部', value: '12' }, { label: '待员工填', value: '12' }],
      pageSize: 50,
    },
    {
      key: 'records',
      label: '全部签署记录',
      note: '此列表展示所有电子签署发起记录及当前流转状态。',
      fetcher: () => fetchEmployeeContracts('signRecords').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
      columns: [
        { key: 'name', label: '姓名', width: 118, link: true },
        { key: 'dept', label: '部门', width: 170 },
        { key: 'deptFullPath', label: '部门全路径', width: 220 },
        { key: 'company', label: '合同公司', width: 220 },
        { key: 'contractNo', label: '合同编号', width: 140 },
        { key: 'contractType', label: '合同类型', width: 150 },
        { key: 'contractTerm', label: '合同期限', width: 120 },
        { key: 'startDate', label: '合同起始日', width: 120 },
        { key: 'endDate', label: '合同到期日', width: 120 },
        { key: 'signProgress', label: '电子签署进度', width: 140, render: row => <ContractStatusPill value={row.signProgress} /> },
        { key: 'dataSource', label: '数据来源', width: 120 },
        { key: 'initiator', label: '发起人', width: 120 },
        { key: 'handler', label: '经办人', width: 120 },
        { key: 'initiateTime', label: '发起时间', width: 160 },
        { key: '__action', label: '操作', width: 120, render: row => <ContractActionLinks row={row} mode="signRecords" /> },
      ],
      summary: [{ label: '全部', value: '42' }, { label: '待员工填', value: '12' }, { label: '企业撤回', value: '19', tone: 'muted' }, { label: '已过期', value: '6', tone: 'muted' }, { label: '已签署', value: '5', tone: 'success' }],
      pageSize: 50,
    },
  ], []);

  return (
    <BackendTabbedTable
      tabs={tabs}
      initialKey="signing"
      filters={() => <ContractSigningFilters />}
      tableHeight="calc(100vh - 240px)"
    />
  );
}

function ContractReleaseFilters() {
  return (
    <>
      <FilterInput label="姓名" />
      <SelectBox label="部门" />
      <SelectBox label="合同公司" />
      <SelectBox label="合同类型" />
      <SelectBox label="合同状态" />
    </>
  );
}

function ContractReleaseWorkbench() {
  const tabs = useMemo<BackendTabConfig[]>(() => [
    {
      key: 'active',
      label: '解除中',
      note: '此列表展示合同解除流程中的记录。',
      rows: [],
      columns: [
        contractSelectColumn,
        { key: 'name', label: '姓名', width: 118 },
        { key: 'dept', label: '部门', width: 150 },
        { key: 'company', label: '合同公司', width: 220 },
        { key: 'contractType', label: '合同类型', width: 160 },
        { key: 'startDate', label: '合同起始日', width: 130 },
        { key: 'endDate', label: '合同到期日', width: 130 },
        { key: 'contractStatus', label: '合同状态', width: 120 },
        { key: 'releaseMethod', label: '解除方式', width: 130 },
        { key: 'releaseProgress', label: '解除进度', width: 120 },
        { key: 'releaseReason', label: '解除原因', width: 160 },
        { key: 'initiator', label: '发起人', width: 120 },
        { key: 'initiateTime', label: '发起时间', width: 160 },
        { key: 'handler', label: '经办人', width: 120 },
        { key: '__action', label: '操作', width: 110 },
      ],
      primaryAction: '发起解除',
      batch: true,
      summary: [{ label: '全部', value: '0' }],
      pageSize: 50,
      notice: '支持离职解除或者合同条款内容、印章、签署人信息错误等场景的合同解除。',
    },
    {
      key: 'records',
      label: '全部解除记录',
      note: '此列表展示所有合同解除记录，其中已撤销、已解除记录可查看详情。',
      fetcher: () => fetchEmployeeContracts('releaseRecords').then(res => ({ ...res, rows: res.rows as unknown as EmployeeGenericRecord[] })),
      columns: [
        contractSelectColumn,
        { key: 'name', label: '姓名', width: 118, link: true },
        { key: 'dept', label: '部门', width: 150 },
        { key: 'company', label: '合同公司', width: 220 },
        { key: 'contractType', label: '合同类型', width: 160 },
        { key: 'startDate', label: '合同起始日', width: 130 },
        { key: 'endDate', label: '合同到期日', width: 130 },
        { key: 'contractStatus', label: '合同状态', width: 120, render: row => <ContractStatusPill value={row.contractStatus} /> },
        { key: 'releaseMethod', label: '解除方式', width: 130 },
        { key: 'releaseProgress', label: '解除进度', width: 120, render: row => <ContractStatusPill value={row.releaseProgress || row.signProgress} /> },
        { key: 'releaseReason', label: '解除原因', width: 160 },
        { key: 'initiator', label: '发起人', width: 120 },
        { key: 'initiateTime', label: '发起时间', width: 160 },
        { key: 'releaseDate', label: '解除日期', width: 130 },
        { key: '__action', label: '操作', width: 130, render: row => <ContractActionLinks row={row} mode="releaseRecords" /> },
      ],
      summary: [{ label: '全部', value: '6' }, { label: '已撤销', value: '1', tone: 'muted' }, { label: '已解除', value: '5', tone: 'success' }],
      batch: true,
      pageSize: 20,
    },
  ], []);

  return (
    <BackendTabbedTable
      tabs={tabs}
      initialKey="active"
      filters={() => <ContractReleaseFilters />}
      tableHeight="calc(100vh - 250px)"
    />
  );
}

function ContractLedgerWorkbench() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState({ active: true, resigned: false, blank: true });
  const columns: EmploymentTabConfig['columns'] = [
    contractSelectColumn,
    { key: 'name', label: '姓名', width: 118, link: true },
    { key: 'employeeNo', label: '员工号', width: 120 },
    { key: 'dept', label: '部门', width: 150 },
    { key: 'deptFullPath', label: '部门全路径', width: 220 },
    { key: 'position', label: '岗位', width: 150 },
    { key: 'isCurrentContract', label: '是否当前合同', width: 128 },
    { key: 'company', label: '合同公司', width: 220 },
    { key: 'contractNo', label: '合同编号', width: 140 },
    { key: 'contractType', label: '合同类型', width: 170 },
    { key: 'contractTerm', label: '合同期限', width: 120 },
    { key: 'startDate', label: '合同起始日', width: 120 },
    { key: 'endDate', label: '合同到期日', width: 120 },
    { key: 'contractStatus', label: '合同状态', width: 120, render: row => <ContractStatusPill value={row.contractStatus} /> },
    { key: 'contractAttachment', label: '合同信息附件', width: 130 },
    { key: 'signMethod', label: '签署方式', width: 110 },
    { key: '__action', label: '操作', width: 150, render: row => <ContractActionLinks row={row} mode="ledger" /> },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchEmployeeContracts('all')
      .then(res => {
        if (!cancelled) setRows(res.rows as unknown as EmployeeGenericRecord[]);
      })
      .catch(err => {
        if (!cancelled) {
          setError(String(err?.message || err));
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter(row => {
      const status = String(row.contractStatus || '');
      const isBlank = !status || status === '-';
      const isResigned = /离职|解除|终止/.test(status);
      const statusMatched = (statusFilters.blank && isBlank)
        || (statusFilters.resigned && isResigned)
        || (statusFilters.active && !isBlank && !isResigned);
      if (!statusMatched) return false;
      if (!keyword) return true;
      return Object.values(row).some(value => String(value ?? '').toLowerCase().includes(keyword));
    });
  }, [query, rows, statusFilters]);

  const toggleStatus = (key: keyof typeof statusFilters) => {
    setStatusFilters(current => ({ ...current, [key]: !current[key] }));
  };

  return (
    <Surface style={{ minHeight: 'calc(100vh - 24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 8 }}>
      <EmployeeFilterBar
        right={(
          <>
            <ToolbarButton title="列表设置"><Settings size={14} /></ToolbarButton>
            <ToolbarButton>重置</ToolbarButton>
            <ToolbarButton primary>查询</ToolbarButton>
            <TextAction>更多筛选 <ChevronDown size={12} /></TextAction>
          </>
        )}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>
          <span>员工状态</span>
          {[
            ['active', '在职'],
            ['resigned', '离职'],
            ['blank', '未填写'],
          ].map(([key, label]) => (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={statusFilters[key as keyof typeof statusFilters]} onChange={() => toggleStatus(key as keyof typeof statusFilters)} style={{ accentColor: colors.primary }} />
              {label}
            </span>
          ))}
        </label>
        <SelectBox label="是否当前合同" />
        <FilterInput label="姓名" />
        <FilterInput label="员工号" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="搜索合同公司、员工、部门"
          style={{ width: 230, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 10px', fontSize: 12, outline: 'none', backgroundColor: colors.cardBg, color: colors.text }}
        />
      </EmployeeFilterBar>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ToolbarButton primary><Plus size={14} />新增</ToolbarButton>
          <ToolbarButton><Sparkles size={14} />智能识别</ToolbarButton>
          <ToolbarButton>导入</ToolbarButton>
          <ToolbarButton>合同附件 <ChevronDown size={12} /></ToolbarButton>
          <ToolbarButton>批量操作 <ChevronDown size={12} /></ToolbarButton>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TextAction>历史任职周期合同</TextAction>
          <ToolbarButton title="下载"><Download size={14} /></ToolbarButton>
          <ToolbarButton title="字段密度"><LayoutGrid size={14} /></ToolbarButton>
          <ToolbarButton title="表格设置"><Settings size={14} /></ToolbarButton>
        </div>
      </div>
      {error ? (
        <div style={{ padding: 18, color: colors.primary, fontSize: 13 }}>真实数据连接失败：{error}</div>
      ) : loading ? (
        <div style={{ padding: 18, color: colors.textMuted, fontSize: 13 }}>加载中...</div>
      ) : (
        <div style={{ padding: '0 16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <EmployeeTable columns={columns} rows={filteredRows} maxHeight="calc(100vh - 178px)" pageSize={50} />
        </div>
      )}
    </Surface>
  );
}

function ContractWorkbench({ view }: { view: EmployeeViewKey }) {
  if (view === 'contractApproval') return <ContractApprovalDisabled />;
  if (view === 'signing') return <ContractSigningWorkbench />;
  if (view === 'contractRelease') return <ContractReleaseWorkbench />;
  if (view === 'contractLedger') return <ContractLedgerWorkbench />;
  if (view === 'renewal') return <ContractStartWorkbench initial="renewal" />;
  return <ContractStartWorkbench initial="new" />;
}

function TempStoreWorkbench({ records = false }: { records?: boolean }) {
  const selector = { key: '__select', label: '', width: 38, render: () => <EmployeeCheckboxCell /> };
  const action = { key: '__action', label: '操作', width: records ? 110 : 130, render: () => <ActionLinks items={records ? ['查看'] : ['查看表单']} /> };
  const managementColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '申请日期', label: '申请日期', width: 124 },
    { key: '开始日期', label: '开始日期', width: 124 },
    { key: '结束日期', label: '结束日期', width: 124 },
    { key: '借出门店', label: '借出门店', width: 160 },
    { key: '借入门店', label: '借入门店', width: 160 },
    { key: '借入岗位', label: '借入岗位', width: 150 },
    { key: '借入职位', label: '借入职位', width: 150 },
    { key: '表单状态', label: '表单状态', width: 120, render: row => <StatusText value={row.表单状态} /> },
    { key: '任职状态', label: '任职状态', width: 120 },
    { key: '备注', label: '备注', width: 140 },
    { key: '添加人', label: '添加人', width: 116 },
    action,
  ];
  const recordColumns: EmploymentTabConfig['columns'] = [
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '开始日期', label: '开始日期', width: 130 },
    { key: '结束日期', label: '结束日期', width: 130 },
    { key: '借出门店', label: '借出门店', width: 170 },
    { key: '借入门店', label: '借入门店', width: 170 },
    { key: '借入岗位', label: '借入岗位', width: 160 },
    { key: '借入职位', label: '借入职位', width: 160 },
    { key: '任职状态', label: '任职状态', width: 120 },
    { key: '备注', label: '备注', width: 150 },
    { key: '添加人', label: '添加人', width: 120 },
  ];
  const tabs: BackendTabConfig[] = records
    ? [{ key: 'records', label: '临时调店记录', fetcher: () => fetchEmployeeEmployment('tempStoreRecords'), columns: recordColumns, note: '此列表页展示的是员工调店未开始、调店中、调店结束的临时调店记录。' }]
    : [
      { key: 'all', label: '全部', fetcher: () => fetchEmployeeEmployment('tempStore'), columns: managementColumns, primaryAction: '+ 新增调店', batch: true, note: '展示在【临时调店管理】中办理的所有临时调店记录。' },
      { key: 'pending', label: '未开始', fetcher: () => fetchEmployeeEmployment('tempStorePending'), columns: managementColumns, primaryAction: '+ 新增调店', batch: true, note: '展示还未到开始时间的调店信息。' },
      { key: 'active', label: '调店中', fetcher: () => fetchEmployeeEmployment('tempStoreActive'), columns: managementColumns, primaryAction: '+ 新增调店', batch: true, note: '展示已到开始日期但还未到结束日期的调店信息。' },
      { key: 'ended', label: '调店结束', fetcher: () => fetchEmployeeEmployment('tempStoreEnded'), columns: managementColumns, primaryAction: '+ 新增调店', batch: true, note: '展示已到结束日期的调店信息。' },
    ];

  return (
    <BackendTabbedTable
      tabs={tabs}
      initialKey={records ? 'records' : 'ended'}
      filters={() => (
        <>
          <FilterInput label="开始日期" placeholder="开始日期    →    结束日期" wide withCalendarIcon />
          <FilterInput label="姓名" placeholder="请选择人员" withUserIcon />
          <SelectBox label="借入门店" />
          <SelectBox label="借入岗位" />
        </>
      )}
      tableHeight="calc(100vh - 224px)"
    />
  );
}

function ResignationWorkbench() {
  const selector = { key: '__select', label: '', width: 38, render: () => <EmployeeCheckboxCell /> };
  const action = { key: '__action', label: '操作', width: 130, render: () => <ActionLinks items={['取消离职', '查看']} /> };
  const progressColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 105, link: true },
    { key: '员工号', label: '员工号', width: 100 },
    { key: '入职日期', label: '入职日期', width: 110 },
    { key: '离职部门', label: '离职末级部门', width: 148 },
    { key: '计划离职日期', label: '计划离职日期', width: 118 },
    { key: '计划离职类型', label: '计划离职类型', width: 112 },
    { key: '计划离职原因', label: '计划离职原因', width: 130 },
    { key: '是否试用期离职', label: '是否试用期离职', width: 124 },
    { key: '是否加入黑名单', label: '是否加入黑名单', width: 126 },
    { key: '表单状态', label: '表单状态', width: 106, render: row => <StatusText value={row.表单状态} /> },
    { key: '添加人', label: '添加人', width: 100 },
    { key: '添加时间', label: '添加时间', width: 134 },
    action,
  ];
  const doneColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 115, link: true },
    { key: '离职部门', label: '离职末级部门', width: 170 },
    { key: '实际离职日期', label: '实际离职日期', width: 126 },
    { key: '实际离职类型', label: '实际离职类型', width: 126 },
    { key: '实际离职原因', label: '实际离职原因', width: 150 },
    { key: '是否试用期离职', label: '是否试用期离职', width: 134 },
    { key: '是否加入黑名单', label: '是否加入黑名单', width: 134 },
    { key: '添加人', label: '添加人', width: 112 },
    { key: '添加时间', label: '添加时间', width: 142 },
    action,
  ];
  const allColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 110, link: true },
    { key: '离职部门', label: '离职末级部门', width: 142 },
    { key: '计划离职日期', label: '计划离职日期', width: 118 },
    { key: '计划离职类型', label: '计划离职类型', width: 112 },
    { key: '计划离职原因', label: '计划离职原因', width: 128 },
    { key: '实际离职日期', label: '实际离职日期', width: 118 },
    { key: '实际离职类型', label: '实际离职类型', width: 112 },
    { key: '实际离职原因', label: '实际离职原因', width: 128 },
    { key: '是否试用期离职', label: '是否试用期离职', width: 122 },
    { key: '是否加入黑名单', label: '是否加入黑名单', width: 124 },
    { key: '表单状态', label: '表单状态', width: 106, render: row => <StatusText value={row.表单状态} /> },
    { key: '添加人', label: '添加人', width: 100 },
    { key: '添加时间', label: '添加时间', width: 134 },
    { key: '__action', label: '操作', width: 92, render: () => <ActionLinks items={['查看']} /> },
  ];
  const tabs: BackendTabConfig[] = [
    { key: 'progress', label: '离职中', fetcher: () => fetchEmployeeEmployment('resigning'), columns: progressColumns, primaryAction: '+ 新增离职', importable: true, batch: true, note: '此列表页展示的是离职流程中，或者确认离职还未到实际离职日期的离职信息。', pageSize: 50 },
    { key: 'done', label: '已离职', fetcher: () => fetchEmployeeEmployment('resigned'), columns: doneColumns, batch: true, notice: '如需办理重新入职，请前往入职管理新增待入职或在花名册新增人员。查看流程说明', note: '此列表页展示的是在【离职管理】中办理离职、确认离职且已生效的离职记录。', pageSize: 50 },
    { key: 'all', label: '全部离职记录', fetcher: () => fetchEmployeeEmployment('resignAll'), columns: allColumns, summary: [
      { label: '总数据', value: '23' },
      { label: '已取消', value: '3', tone: 'muted' },
      { label: '审批中', value: '3' },
      { label: '已通过', value: '12', tone: 'success' },
      { label: '已拒绝', value: '1', tone: 'danger' },
      { label: '已撤销', value: '4', tone: 'muted' },
    ], notice: '', note: '此列表页展示的是在【离职管理】中发起的所有离职记录，其中，已撤销、已否决和取消离职的记录可在详情页重新发起。', pageSize: 50 },
  ];

  return (
    <BackendTabbedTable
      tabs={tabs}
      initialKey="progress"
      filters={(activeTab) => (
        <>
          <FilterInput label="姓名" placeholder="请选择人员" withUserIcon />
          <SelectBox label="离职部门" />
          <FilterInput label={activeTab.key === 'done' ? '实际离职日期' : activeTab.key === 'all' ? '离职申请日期' : '计划离职日期'} placeholder="开始日期    →    结束日期" wide withCalendarIcon />
          {activeTab.key !== 'all' ? <FilterInput label="实际离职日期" placeholder="开始日期    →    结束日期" wide withCalendarIcon /> : <SelectBox label="离职部门" />}
          <SelectBox label="计划离职类型" />
        </>
      )}
      tableHeight="calc(100vh - 260px)"
    />
  );
}

function EmploymentRecordWorkbench() {
  const selector = { key: '__select', label: '', width: 38, render: () => <EmployeeCheckboxCell /> };
  const viewAction = { key: '__action', label: '操作', width: 96, render: () => <ActionLinks items={['查看快照']} /> };
  const mainColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '生效日期', label: '生效日期', width: 132 },
    { key: '部门', label: '末级部门', width: 260 },
    { key: '业务分组', label: '业务分组', width: 150 },
    { key: '任职类型', label: '任职类型', width: 126 },
    { key: '数据来源', label: '数据来源', width: 150 },
    { key: '备注', label: '备注', width: 180 },
    { key: '任职状态', label: '任职状态', width: 120 },
    viewAction,
  ];
  const concurrentColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '申请日期', label: '申请日期', width: 132 },
    { key: '开始日期', label: '开始日期', width: 132 },
    { key: '结束日期', label: '结束日期', width: 132 },
    { key: '部门', label: '部门', width: 200 },
    { key: '兼任部门', label: '兼任部门', width: 180 },
    { key: '任职状态', label: '任职状态', width: 130 },
    { key: '备注', label: '备注', width: 160 },
    { key: '添加人', label: '添加人', width: 120 },
    { key: '数据来源', label: '数据来源', width: 130 },
    { key: '__action', label: '操作', width: 92, render: () => <ActionLinks items={['查看']} /> },
  ];
  const borrowedColumns: EmploymentTabConfig['columns'] = [
    selector,
    { key: '姓名', label: '姓名', width: 120, link: true },
    { key: '申请日期', label: '申请日期', width: 124 },
    { key: '开始日期', label: '开始日期', width: 124 },
    { key: '结束日期', label: '结束日期', width: 124 },
    { key: '借调类型', label: '借调类型', width: 124 },
    { key: '借出部门', label: '借出部门', width: 160 },
    { key: '借入部门', label: '借入部门', width: 160 },
    { key: '借入岗位', label: '借入岗位', width: 150 },
    { key: '借入职位', label: '借入职位', width: 150 },
    { key: '任职状态', label: '任职状态', width: 120 },
    { key: '数据来源', label: '数据来源', width: 130 },
    { key: '备注', label: '备注', width: 140 },
    { key: '添加人', label: '添加人', width: 116 },
    { key: '__action', label: '操作', width: 92, render: () => <ActionLinks items={['查看']} /> },
  ];
  const tabs: BackendTabConfig[] = [
    { key: 'main', label: '主岗任职记录', fetcher: () => fetchEmployeeEmployment('mainJobRecords'), columns: mainColumns, notice: '如需查看任职明细信息，请前往入职管理、转正管理等页面。', note: '此列表页展示的是员工主岗任职生效后的快照信息。', pageSize: 50 },
    { key: 'concurrent', label: '兼任任职记录', fetcher: () => fetchEmployeeEmployment('concurrentRecords'), columns: concurrentColumns, notice: '如需查看兼任详细信息，请前往【兼任管理】。', note: '此列表展示的是员工兼任未开始、兼任中、兼任结束的兼任任职记录。', pageSize: 20 },
    { key: 'borrowed', label: '借调任职记录', fetcher: () => fetchEmployeeEmployment('borrowed'), columns: borrowedColumns, notice: '如需查看借调详细信息，请前往【借调管理】。', note: '此列表展示的是员工借调未开始、借调中、借调结束的借调任职记录。', pageSize: 20 },
  ];

  return (
    <BackendTabbedTable
      tabs={tabs}
      initialKey="main"
      filters={(activeTab) => (
        <>
          <FilterInput label="姓名" placeholder="请选择人员" withUserIcon />
          <SelectBox label={activeTab.key === 'main' ? '部门' : activeTab.key === 'concurrent' ? '兼任部门' : '借入部门'} />
          <SelectBox label={activeTab.key === 'main' ? '业务分组' : activeTab.key === 'concurrent' ? '兼任岗位' : '借入岗位'} />
          <FilterInput label={activeTab.key === 'main' ? '生效日期' : '开始日期'} placeholder="开始日期    →    结束日期" wide withCalendarIcon />
          <SelectBox label={activeTab.key === 'main' ? '任职类型' : '数据来源'} />
        </>
      )}
      tableHeight="calc(100vh - 268px)"
    />
  );
}

function EmployeeFilterBar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 16px 10px', flexWrap: 'wrap' }}>
      {children}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );
}

function FilterInput({
  label,
  placeholder = '多个用；号隔开，支持Excel复制',
  wide = false,
  withUserIcon = false,
  withCalendarIcon = false,
}: {
  label: string;
  placeholder?: string;
  wide?: boolean;
  withUserIcon?: boolean;
  withCalendarIcon?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ width: wide ? 274 : 180, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 8px 0 10px', fontSize: 12, color: colors.text, backgroundColor: colors.cardBg, display: 'inline-flex', alignItems: 'center', gap: 6, boxSizing: 'border-box' }}>
        <input placeholder={placeholder} style={{ minWidth: 0, flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 12 }} />
        {withUserIcon ? <><Search size={13} style={{ color: colors.textMuted }} /><UserRound size={13} style={{ color: colors.textMuted }} /></> : null}
        {withCalendarIcon ? <CalendarDays size={13} style={{ color: colors.textMuted }} /> : null}
      </span>
    </label>
  );
}

type SelectOption = string | { value: string; label: string };

function getSelectOptionValue(option: SelectOption) {
  return typeof option === 'string' ? option : option.value;
}

function getSelectOptionLabel(option: SelectOption) {
  return typeof option === 'string' ? option : option.label;
}

function SelectBox({
  label,
  placeholder = '请选择',
  width = 210,
  options = [],
  value = '',
  onChange,
}: {
  label: string;
  placeholder?: string;
  width?: number;
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  const { colors } = useTheme();
  const optionValues = new Set(options.map(getSelectOptionValue));
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      {onChange ? (
        <select value={value} onChange={event => onChange(event.target.value)} style={{ width, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 10px', color: value ? colors.text : colors.textMuted, backgroundColor: colors.cardBg, fontSize: 12, outline: 'none' }}>
          <option value="">{placeholder}</option>
          {value && !optionValues.has(value) ? <option value={value}>{value}</option> : null}
          {options.map(option => {
            const optionValue = getSelectOptionValue(option);
            return <option key={optionValue} value={optionValue}>{getSelectOptionLabel(option)}</option>;
          })}
        </select>
      ) : (
        <div style={{ width, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: colors.textMuted, backgroundColor: colors.cardBg }}>
          <span>{placeholder}</span>
          <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} />
        </div>
      )}
    </label>
  );
}

function ToolbarButton({
  children,
  primary = false,
  disabled = false,
  title,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const { colors } = useTheme();
  const buttonStyle: React.CSSProperties = primary
    ? {
      padding: '5px 14px',
      fontSize: 12,
      border: 'none',
      borderRadius: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      backgroundColor: disabled ? colors.inputBorder : colors.primary,
      color: '#fff',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      opacity: disabled ? 0.7 : 1,
    }
    : {
      padding: '5px 12px',
      fontSize: 12,
      border: `1px solid ${colors.inputBorder}`,
      borderRadius: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      backgroundColor: disabled ? colors.tableHeaderBg : 'transparent',
      color: disabled ? colors.textMuted : colors.text,
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      opacity: disabled ? 0.72 : 1,
    };
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} style={buttonStyle}>
      {children}
    </button>
  );
}

function TextAction({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  const { colors } = useTheme();
  return <button type="button" title={title} onClick={onClick} style={{ border: 'none', background: 'transparent', color: colors.primary, fontSize: 12, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', lineHeight: 1.5 }}>{children}</button>;
}

function EmployeeTable({
  columns,
  rows,
  maxHeight = 'calc(100vh - 276px)',
  emptyText = '暂无内容',
  pagination = true,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyState,
}: {
  columns: { key: string; label: string; width?: number; link?: boolean; status?: boolean; render?: (row: EmployeeGenericRecord, index: number) => React.ReactNode }[];
  rows: EmployeeGenericRecord[];
  maxHeight?: number | string;
  emptyText?: string;
  pagination?: boolean;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  emptyState?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [sortState, setSortState] = useState<SortState>(null);
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(20);
  const minWidth = columns.reduce((sum, col) => sum + (col.width || 140), 0);
  const effectivePage = page ?? internalPage;
  const effectivePageSize = pageSize ?? internalPageSize;
  const sortedRows = useMemo(() => {
    if (!sortState) return rows;
    return [...rows].sort((left, right) => compareTableValues(left[sortState.key], right[sortState.key], sortState.direction));
  }, [rows, sortState]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / effectivePageSize));
  const safePage = Math.min(Math.max(1, effectivePage), totalPages);
  const displayRows = pagination
    ? sortedRows.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize)
    : sortedRows;
  useEffect(() => {
    if (effectivePage <= totalPages) return;
    if (onPageChange) onPageChange(totalPages);
    else setInternalPage(totalPages);
  }, [effectivePage, onPageChange, totalPages]);
  const toggleSort = (key: string) => {
    setSortState(prev => (
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ));
    if (onPageChange) onPageChange(1);
    else setInternalPage(1);
  };
  const handlePageChange = (nextPage: number) => {
    if (onPageChange) onPageChange(nextPage);
    else setInternalPage(nextPage);
  };
  const handlePageSizeChange = (nextPageSize: number) => {
    if (onPageSizeChange) onPageSizeChange(nextPageSize);
    else setInternalPageSize(nextPageSize);
    if (onPageChange) onPageChange(1);
    else setInternalPage(1);
  };

  return (
    <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.cardBg, display: 'flex', flexDirection: 'column', height: maxHeight }}>
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  onClick={() => toggleSort(column.key)}
                  style={{
                    width: column.width || 140,
                    position: column.key === '__action' ? 'sticky' : undefined,
                    right: column.key === '__action' ? 0 : undefined,
                    zIndex: column.key === '__action' ? 2 : undefined,
                    padding: '11px 12px',
                    textAlign: 'left',
                    backgroundColor: colors.tableHeaderBg,
                    boxShadow: column.key === '__action' ? `-8px 0 14px ${withAlpha(colors.textMuted, 0.12)}` : undefined,
                    borderBottom: `1px solid ${colors.tableBorder}`,
                    borderRight: `1px solid ${colors.tableBorder}`,
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <SortableHeaderLabel label={column.label} active={sortState?.key === column.key} direction={sortState?.direction} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => (
              <tr key={String(row.id ?? index)} style={{ backgroundColor: index % 2 === 1 ? withAlpha(colors.textMuted, 0.055) : colors.cardBg, borderBottom: `1px solid ${colors.tableBorder}` }}>
                {columns.map(column => {
                  const rendered = column.render?.(row, index);
                  const value = String(row[column.key] ?? '') || '-';
                  const isStatus = column.status || ['试用', '正式', '待离职', '在职'].includes(value);
                  const rowBg = index % 2 === 1 ? withAlpha(colors.textMuted, 0.055) : colors.cardBg;
                  return (
                    <td key={column.key} style={{ width: column.width || 140, position: column.key === '__action' ? 'sticky' : undefined, right: column.key === '__action' ? 0 : undefined, zIndex: column.key === '__action' ? 1 : undefined, backgroundColor: column.key === '__action' ? rowBg : undefined, boxShadow: column.key === '__action' ? `-8px 0 14px ${withAlpha(colors.textMuted, 0.08)}` : undefined, padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: column.link ? colors.primary : colors.text, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rendered ? undefined : value}>
                      {rendered ?? (isStatus && value !== '-' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: value.includes('正式') || value.includes('在职') ? '#1CBF7A' : '#F3BE32' }} />{value}</span> : value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {sortedRows.length === 0 ? (emptyState ?? <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 13 }}>{emptyText}</div>) : null}
      </div>
      {pagination ? (
        <PaginationBar
          total={sortedRows.length}
          page={safePage}
          pageSize={effectivePageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}
    </div>
  );
}

function StatStrip({
  stats,
  activeKey,
  onSelect,
}: {
  stats: Array<{ key: EmployeeRosterFilterKey; label: string; value: string }>;
  activeKey: EmployeeRosterFilterKey;
  onSelect: (key: EmployeeRosterFilterKey) => void;
}) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, border: `1px solid ${colors.tableBorder}`, borderRadius: 5, overflow: 'hidden', margin: '6px 16px 14px' }}>
      {stats.map((stat, index) => {
        const active = activeKey === stat.key;
        return (
          <button
            key={stat.key}
            type="button"
            onClick={() => onSelect(stat.key)}
            style={{
              minHeight: 62,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 5,
              backgroundColor: active ? withAlpha(colors.primary, 0.1) : colors.cardBg,
              border: 'none',
              borderRight: index === stats.length - 1 ? 'none' : `1px solid ${colors.tableBorder}`,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <div style={{ fontSize: 12, color: active ? colors.primary : colors.textMuted }}>{stat.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: active ? colors.primary : colors.text }}>{stat.value}</div>
          </button>
        );
      })}
    </div>
  );
}

type EmployeeFormState = {
  name: string;
  phone: string;
  employeeNo: string;
  department: string;
  deptFullPath: string;
  position: string;
  managerName: string;
  managerNo: string;
  userId: string;
  email: string;
  rosterName: string;
  hireDate: string;
  employeeType: string;
  employeeStatus: string;
  plannedProbation: string;
  actualProbation: string;
  plannedRegularDate: string;
  actualRegularDate: string;
  seniorityStartDate: string;
  probationReduction: string;
  probationReportStatus: string;
  probationTeacher: string;
  probationCycle: string;
  probationFollowup: string;
  selfReview1: string;
  selfScore1: string;
  selfReview2: string;
  selfScore2: string;
  supervisorReview1: string;
  supervisorScore1: string;
  supervisorReview2: string;
  supervisorScore2: string;
  idType: string;
  idNo: string;
  gender: string;
  birthday: string;
  idAddress: string;
  idIssueDate: string;
  idExpireDate: string;
  nationality: string;
  ethnic: string;
  politicalStatus: string;
  currentAddressRegion: string;
  currentAddress: string;
  maritalStatus: string;
  pregnant: string;
  emergencyContact: string;
  emergencyRelation: string;
  emergencyPhone: string;
  socialSecurityNo: string;
  fundNo: string;
  socialSecurityTransferDate: string;
  socialSecuritySubject: string;
  socialSecurityBase: string;
  fundBase: string;
  bankCard: string;
  bankName: string;
  bankBranch: string;
  salaryLevel: string;
  salaryStructure: string;
  salaryCalculationDate: string;
  leaveEstimateDate: string;
  actualLeaveTime: string;
  accountRetainDate: string;
  wecomEnabled: string;
  vacationReturnDate: string;
  dormStatus: string;
  dormNo: string;
  dormAddress: string;
  schoolStayDuration: string;
  clubStayDuration: string;
  contractStartDate: string;
  contractEndDate: string;
  checkInDate: string;
  moveOutDate: string;
  stayDuration: string;
  checkInNote: string;
  moveOutReason: string;
  moveOutNote: string;
};

const employeeFormInitialState = (): EmployeeFormState => ({
  name: '',
  phone: '',
  employeeNo: '',
  department: '',
  deptFullPath: '',
  position: '',
  managerName: '',
  managerNo: '',
  userId: '',
  email: '',
  rosterName: '',
  hireDate: todayISO(),
  employeeType: '全职',
  employeeStatus: '正式',
  plannedProbation: '',
  actualProbation: '',
  plannedRegularDate: '',
  actualRegularDate: '',
  seniorityStartDate: todayISO(),
  probationReduction: '',
  probationReportStatus: '',
  probationTeacher: '',
  probationCycle: '',
  probationFollowup: '',
  selfReview1: '',
  selfScore1: '',
  selfReview2: '',
  selfScore2: '',
  supervisorReview1: '',
  supervisorScore1: '',
  supervisorReview2: '',
  supervisorScore2: '',
  idType: '居民身份证',
  idNo: '',
  gender: '',
  birthday: '',
  idAddress: '',
  idIssueDate: '',
  idExpireDate: '',
  nationality: '中国',
  ethnic: '',
  politicalStatus: '',
  currentAddressRegion: '',
  currentAddress: '',
  maritalStatus: '',
  pregnant: '',
  emergencyContact: '',
  emergencyRelation: '',
  emergencyPhone: '',
  socialSecurityNo: '',
  fundNo: '',
  socialSecurityTransferDate: '',
  socialSecuritySubject: '',
  socialSecurityBase: '',
  fundBase: '',
  bankCard: '',
  bankName: '',
  bankBranch: '',
  salaryLevel: '',
  salaryStructure: '',
  salaryCalculationDate: '',
  leaveEstimateDate: '',
  actualLeaveTime: '',
  accountRetainDate: '',
  wecomEnabled: '',
  vacationReturnDate: '',
  dormStatus: '',
  dormNo: '',
  dormAddress: '',
  schoolStayDuration: '',
  clubStayDuration: '',
  contractStartDate: '',
  contractEndDate: '',
  checkInDate: '',
  moveOutDate: '',
  stayDuration: '',
  checkInNote: '',
  moveOutReason: '',
  moveOutNote: '',
});

function generateEmployeeNo() {
  return `ZZ${String(Date.now()).slice(-6)}`;
}

type HrLookupOrganization = {
  code?: string;
  name: string;
  fullPath: string;
  status?: string;
};

type HrLookupPosition = {
  code?: string;
  name: string;
  sequence?: string;
  subSequence?: string;
  status?: string;
};

function isActiveLookupStatus(status?: string) {
  return !/停用|失效|删除/.test(status || '');
}

function uniqueSelectOptions(options: SelectOption[]) {
  const seen = new Set<string>();
  return options.filter(option => {
    const value = getSelectOptionValue(option);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function departmentSelectOptions(organizations: HrLookupOrganization[]) {
  return uniqueSelectOptions(organizations
    .filter(row => row.name && isActiveLookupStatus(row.status))
    .map(row => {
      const value = row.fullPath || row.name;
      return { value, label: row.fullPath || row.name };
    }));
}

function positionSelectOptions(positions: HrLookupPosition[]) {
  return uniqueSelectOptions(positions
    .filter(row => row.name && isActiveLookupStatus(row.status))
    .map(row => {
      const labelMeta = [row.sequence, row.subSequence].filter(Boolean).join(' / ');
      return { value: row.name, label: labelMeta ? `${row.name}｜${labelMeta}` : row.name };
    }));
}

function useHrCoreLookupOptions() {
  const [organizations, setOrganizations] = useState<HrLookupOrganization[]>([]);
  const [positions, setPositions] = useState<HrLookupPosition[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchHrCoreLookups()
      .then(res => {
        if (cancelled) return;
        setOrganizations((res.organizations || []).filter(row => row.name && isActiveLookupStatus(row.status)));
        setPositions((res.positions || []).filter(row => row.name && isActiveLookupStatus(row.status)));
      })
      .catch(() => {
        if (!cancelled) {
          setOrganizations([]);
          setPositions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { organizations, positions };
}

function EmployeeAddPage({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const [form, setForm] = useState<EmployeeFormState>(() => employeeFormInitialState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('basic');
  const { organizations, positions } = useHrCoreLookupOptions();
  const departmentOptions = useMemo(() => departmentSelectOptions(organizations), [organizations]);
  const positionOptions = useMemo(() => positionSelectOptions(positions), [positions]);
  const update = (key: keyof EmployeeFormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const selectDepartment = (value: string) => {
    const selected = organizations.find(row => (row.fullPath || row.name) === value || row.name === value);
    setForm(prev => ({
      ...prev,
      department: selected?.name || value.split('/').filter(Boolean).pop() || value,
      deptFullPath: selected?.fullPath || value,
    }));
  };
  const selectDeptFullPath = (value: string) => {
    const selected = organizations.find(row => (row.fullPath || row.name) === value || row.name === value);
    setForm(prev => ({
      ...prev,
      department: selected?.name || prev.department || value.split('/').filter(Boolean).pop() || value,
      deptFullPath: selected?.fullPath || value,
    }));
  };
  const sectionRefs = useMemo(() => [
    { key: 'basic', label: '基本信息' },
    { key: 'employment', label: '在职信息' },
    { key: 'probation', label: '试用期信息' },
    { key: 'personal', label: '个人信息' },
    { key: 'education', label: '教育经历' },
    { key: 'work', label: '工作经历' },
    { key: 'family', label: '家庭成员' },
    { key: 'emergency', label: '紧急联系人' },
    { key: 'payroll', label: '工资社保' },
    { key: 'materials', label: '个人材料' },
    { key: 'custom', label: '自定义字段' },
    { key: 'housing', label: '住宿信息' },
  ], []);

  const goSection = (key: string) => {
    setActiveSection(key);
    document.getElementById(`employee-add-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (mode: 'save' | 'continue' | 'archive') => {
    if (!form.name.trim()) {
      setError('请填写姓名');
      goSection('basic');
      return;
    }
    if (!form.department.trim()) {
      setError('请选择部门');
      goSection('basic');
      return;
    }

    setSaving(true);
    setError('');
    const employeeNo = form.employeeNo.trim() || generateEmployeeNo();
    const selectedOrg = organizations.find(row => row.name === form.department.trim() || row.fullPath === form.deptFullPath.trim());
    const departmentName = selectedOrg?.name || form.department.trim();
    const departmentFullPath = selectedOrg?.fullPath || form.deptFullPath.trim() || `上海拉迷家具有限公司/${departmentName}`;
    try {
      await onboardEmployee({
        ...(form as unknown as Record<string, string>),
        employeeNo,
        name: form.name.trim(),
        phone: form.phone.trim(),
        department: departmentName,
        deptFullPath: departmentFullPath,
        position: form.position.trim(),
        hireDate: form.hireDate,
        employeeType: form.employeeType,
        employeeStatus: form.employeeStatus,
        managerName: form.managerName,
        managerNo: form.managerNo,
        userId: form.userId || `wecom_${employeeNo}`,
        dataSource: mode === 'archive' ? '后台录入并补充档案' : '后台录入',
      } as any);
      if (mode === 'continue') {
        setForm(employeeFormInitialState());
        goSection('basic');
        onSaved();
      } else {
        onSaved();
        onBack();
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, backgroundColor: colors.appBg, overflow: 'auto' }}>
      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', color: colors.text, fontSize: 12 }}>
        <button type="button" onClick={onBack} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 0 }}>{'< 返回'}</button>
        <span style={{ color: colors.textMuted }}>|</span>
        <span>新增员工</span>
      </div>
      <div style={{ margin: '0 18px 18px', borderRadius: 8, backgroundColor: colors.cardBg, minHeight: 'calc(100vh - 88px)', display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ padding: '24px 0 80px', borderRight: `1px solid ${colors.tableBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {sectionRefs.map(section => {
            const active = activeSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => goSection(section.key)}
                style={{
                  width: 132,
                  height: 28,
                  border: 'none',
                  borderRight: active ? `3px solid ${colors.primary}` : '3px solid transparent',
                  background: 'transparent',
                  color: active ? colors.primary : colors.text,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  textAlign: 'right',
                  paddingRight: 14,
                  cursor: 'pointer',
                }}
              >
                {section.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: '22px 110px 86px 42px', overflow: 'auto', maxHeight: 'calc(100vh - 88px)' }}>
          {error ? <div style={{ marginBottom: 14, color: colors.primary, fontSize: 12 }}>{error}</div> : null}
          <EmployeeFormSection id="basic" title="基本信息" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeInput label="姓名" required value={form.name} onChange={value => update('name', value)} />
              <EmployeeInput label="企微账号" value={form.userId} onChange={value => update('userId', value)} />
              <EmployeeInput label="手机号" value={form.phone} onChange={value => update('phone', value)} />
              <EmployeeInput label="邮箱" value={form.email} onChange={value => update('email', value)} />
              <EmployeeInput label="员工号" value={form.employeeNo} onChange={value => update('employeeNo', value)} placeholder="系统自动生成" />
              <EmployeeSelect label="部门" required value={form.deptFullPath || form.department} onChange={selectDepartment} options={departmentOptions} />
              <EmployeeSelect label="岗位" value={form.position} onChange={value => update('position', value)} options={positionOptions} />
              <EmployeeInput label="花名" value={form.rosterName} onChange={value => update('rosterName', value)} />
              <EmployeeSelect label="职级" value={form.salaryLevel} onChange={value => update('salaryLevel', value)} options={['P1', 'P2', 'P3', '主管', '经理']} />
              <EmployeeInput label="汇报上级" value={form.managerName} onChange={value => update('managerName', value)} />
              <EmployeeSelect label="所属" value={form.deptFullPath} onChange={selectDeptFullPath} options={departmentOptions} />
              <div />
              <EmployeeTextArea label="备注" value={form.deptFullPath} onChange={value => update('deptFullPath', value)} maxLength={256} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="employment" title="在职信息" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeInput label="入职日期" type="date" value={form.hireDate} onChange={value => update('hireDate', value)} />
              <EmployeeInput label="到岗日期" type="date" value={form.hireDate} onChange={value => update('hireDate', value)} />
              <EmployeeSelect label="员工类型" value={form.employeeType} onChange={value => update('employeeType', value)} options={['全职', '实习', '退休返聘', '外包-爱才', '外包-科讯', '总部-代缴']} />
              <EmployeeSelect label="员工状态" value={form.employeeStatus} onChange={value => update('employeeStatus', value)} options={['正式', '试用', '待离职', '在职']} />
              <EmployeeSelect label="计划试用期" value={form.plannedProbation} onChange={value => update('plannedProbation', value)} options={['无', '1个月', '2个月', '3个月', '6个月']} />
              <EmployeeSelect label="实际试用期" value={form.actualProbation} onChange={value => update('actualProbation', value)} options={['无', '1个月', '2个月', '3个月', '6个月']} />
              <EmployeeInput label="计划转正日期" type="date" value={form.plannedRegularDate} onChange={value => update('plannedRegularDate', value)} />
              <EmployeeInput label="实际转正日期" type="date" value={form.actualRegularDate} onChange={value => update('actualRegularDate', value)} />
              <EmployeeInput label="司龄开始日期" type="date" value={form.seniorityStartDate} onChange={value => update('seniorityStartDate', value)} />
              <EmployeeInput label="司龄扣减期" value={form.probationReduction} onChange={value => update('probationReduction', value)} />
              <EmployeeInput label="司龄" value="0天" readOnly onChange={() => {}} />
              <EmployeeSelect label="体检报告提供情况" value={form.probationReportStatus} onChange={value => update('probationReportStatus', value)} options={['未提供', '已提供', '无需提供']} />
              <EmployeeInput label="报销体检金额" type="number" value={form.socialSecurityBase} onChange={value => update('socialSecurityBase', value)} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="probation" title="试用期信息" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeInput label="带教老师" value={form.probationTeacher} onChange={value => update('probationTeacher', value)} />
              <EmployeeInput label="带教周期" value={form.probationCycle} onChange={value => update('probationCycle', value)} />
              <EmployeeInput label="试用期跟进情况" value={form.probationFollowup} onChange={value => update('probationFollowup', value)} />
              <div />
              <EmployeeTextArea label="第一次自我鉴定" value={form.selfReview1} onChange={value => update('selfReview1', value)} maxLength={500} />
              <EmployeeInput label="第一次自我评分" type="number" value={form.selfScore1} onChange={value => update('selfScore1', value)} />
              <EmployeeTextArea label="第二次自我鉴定" value={form.selfReview2} onChange={value => update('selfReview2', value)} maxLength={500} />
              <EmployeeInput label="第二次自我评分" type="number" value={form.selfScore2} onChange={value => update('selfScore2', value)} />
              <EmployeeTextArea label="第一次主管评价" value={form.supervisorReview1} onChange={value => update('supervisorReview1', value)} maxLength={500} />
              <EmployeeInput label="第一次主管评分" type="number" value={form.supervisorScore1} onChange={value => update('supervisorScore1', value)} />
              <EmployeeTextArea label="第二次主管评价" value={form.supervisorReview2} onChange={value => update('supervisorReview2', value)} maxLength={500} />
              <EmployeeInput label="第二次主管评分" type="number" value={form.supervisorScore2} onChange={value => update('supervisorScore2', value)} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="personal" title="个人信息" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeSelect label="证件类型" required value={form.idType} onChange={value => update('idType', value)} options={['居民身份证', '护照', '港澳台通行证']} />
              <EmployeeInput label="证件号码" required value={form.idNo} onChange={value => update('idNo', value)} />
              <EmployeeRadio label="性别" value={form.gender} onChange={value => update('gender', value)} options={['男', '女']} />
              <EmployeeInput label="出生日期" type="date" value={form.birthday} onChange={value => update('birthday', value)} />
              <EmployeeInput label="年龄" type="number" value="" placeholder="系统自动计算" readOnly onChange={() => {}} />
              <EmployeeInput label="身份证地址" value={form.idAddress} onChange={value => update('idAddress', value)} />
              <EmployeeRadio label="证件有效期" value="具体日期" onChange={() => {}} options={['具体日期', '长期']} />
              <EmployeeInput label="证件签发日期" type="date" value={form.idIssueDate} onChange={value => update('idIssueDate', value)} />
              <EmployeeInput label="证件到期日期" type="date" value={form.idExpireDate} onChange={value => update('idExpireDate', value)} />
              <EmployeeSelect label="国籍/地区" value={form.nationality} onChange={value => update('nationality', value)} options={['中国', '中国香港', '中国澳门', '中国台湾', '其他']} />
              <EmployeeSelect label="民族" value={form.ethnic} onChange={value => update('ethnic', value)} options={['汉族', '回族', '满族', '壮族', '其他']} />
              <EmployeeSelect label="政治面貌" value={form.politicalStatus} onChange={value => update('politicalStatus', value)} options={['群众', '共青团员', '中共党员']} />
              <EmployeeSelect label="现住址" value={form.currentAddressRegion} onChange={value => update('currentAddressRegion', value)} options={['上海', '江苏', '浙江', '安徽', '云南']} />
              <EmployeeInput label="" value={form.currentAddress} onChange={value => update('currentAddress', value)} />
              <EmployeeSelect label="婚姻状态" value={form.maritalStatus} onChange={value => update('maritalStatus', value)} options={['未婚', '已婚', '离异']} />
              <EmployeeRadio label="是否已育" value={form.pregnant} onChange={value => update('pregnant', value)} options={['是', '否']} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="education" title="教育经历" setActive={setActiveSection}>
            <EmployeeAddLine label="添加教育经历" />
          </EmployeeFormSection>
          <EmployeeFormSection id="work" title="工作经历" setActive={setActiveSection}>
            <EmployeeAddLine label="添加工作经历" />
          </EmployeeFormSection>
          <EmployeeFormSection id="family" title="家庭成员" setActive={setActiveSection}>
            <EmployeeAddLine label="添加家庭成员" />
          </EmployeeFormSection>

          <EmployeeFormSection id="emergency" title="紧急联系人" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeInput label="紧急联系人" value={form.emergencyContact} onChange={value => update('emergencyContact', value)} />
              <EmployeeSelect label="紧急联系人关系" value={form.emergencyRelation} onChange={value => update('emergencyRelation', value)} options={['父母', '配偶', '子女', '朋友', '其他']} />
              <EmployeeInput label="紧急联系人电话" value={form.emergencyPhone} onChange={value => update('emergencyPhone', value)} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="payroll" title="工资社保" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeInput label="个人社保账号" value={form.socialSecurityNo} onChange={value => update('socialSecurityNo', value)} />
              <EmployeeInput label="个人公积金账号" value={form.fundNo} onChange={value => update('fundNo', value)} />
              <EmployeeInput label="社保公积金转入时间" type="date" value={form.socialSecurityTransferDate} onChange={value => update('socialSecurityTransferDate', value)} />
              <EmployeeSelect label="社保缴纳主体" value={form.socialSecuritySubject} onChange={value => update('socialSecuritySubject', value)} options={['上海拉迷家具有限公司', '外包主体', '代缴主体']} />
              <EmployeeInput label="社保基数" type="number" value={form.socialSecurityBase} onChange={value => update('socialSecurityBase', value)} />
              <EmployeeInput label="公积金基数" type="number" value={form.fundBase} onChange={value => update('fundBase', value)} />
              <EmployeeInput label="工资卡号" value={form.bankCard} onChange={value => update('bankCard', value)} />
              <EmployeeSelect label="开户银行" value={form.bankName} onChange={value => update('bankName', value)} options={['中国银行', '工商银行', '农业银行', '建设银行', '招商银行']} />
              <EmployeeInput label="开户支行" value={form.bankBranch} onChange={value => update('bankBranch', value)} />
              <EmployeeInput label="薪级" value={form.salaryLevel} onChange={value => update('salaryLevel', value)} />
              <EmployeeInput label="薪资结构" value={form.salaryStructure} onChange={value => update('salaryStructure', value)} />
              <EmployeeInput label="工资结算日" value={form.salaryCalculationDate} onChange={value => update('salaryCalculationDate', value)} />
              <EmployeeInput label="预计退休时间" type="date" value={form.leaveEstimateDate} onChange={value => update('leaveEstimateDate', value)} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="materials" title="个人材料" setActive={setActiveSection}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 220px 220px', gap: 24, alignItems: 'start', marginBottom: 24 }}>
              <div style={{ textAlign: 'right', fontSize: 13, color: colors.text }}>身份证</div>
              <EmployeeUploadCard label="身份证人像面" />
              <EmployeeUploadCard label="身份证国徽面" />
              <div style={{ textAlign: 'right', fontSize: 13, color: colors.text }}>其他</div>
              <EmployeeUploadCard label="银行卡" />
            </div>
            {['学历证书', '学位证书', '体检报告', '前公司离职证明', '征信报告', '无犯罪证明', '入职承诺书'].map(label => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0 0 90px' }}>
                <span style={{ width: 110, textAlign: 'right', fontSize: 13 }}>{label}</span>
                <button type="button" style={{ height: 28, padding: '0 14px', borderRadius: 5, border: `1px solid ${colors.inputBorder}`, backgroundColor: colors.cardBg, color: colors.text, cursor: 'pointer' }}>上传</button>
              </div>
            ))}
          </EmployeeFormSection>

          <EmployeeFormSection id="custom" title="自定义字段" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeInput label="实际离职时间" type="date" value={form.actualLeaveTime} onChange={value => update('actualLeaveTime', value)} />
              <EmployeeInput label="账号保留日期" type="date" value={form.accountRetainDate} onChange={value => update('accountRetainDate', value)} />
              <EmployeeSelect label="是否使用企业微信" required value={form.wecomEnabled} onChange={value => update('wecomEnabled', value)} options={['是', '否']} />
              <EmployeeInput label="休假返岗日期" type="date" value={form.vacationReturnDate} onChange={value => update('vacationReturnDate', value)} />
            </EmployeeFormGrid>
          </EmployeeFormSection>

          <EmployeeFormSection id="housing" title="住宿信息" setActive={setActiveSection}>
            <EmployeeFormGrid>
              <EmployeeSelect label="住宿情况" value={form.dormStatus} onChange={value => update('dormStatus', value)} options={['住宿', '不住宿']} />
              <EmployeeSelect label="宿舍号" value={form.dormNo} onChange={value => update('dormNo', value)} options={['A101', 'A102', 'B201', 'B202']} />
              <EmployeeSelect label="校招/社招" value={form.schoolStayDuration} onChange={value => update('schoolStayDuration', value)} options={['校招', '社招']} />
              <EmployeeInput label="宿舍地址" value={form.dormAddress} onChange={value => update('dormAddress', value)} />
              <EmployeeInput label="预计入住时长（校招）" type="number" value={form.schoolStayDuration} onChange={value => update('schoolStayDuration', value)} />
              <EmployeeInput label="预计入住时长（社招）" type="number" value={form.clubStayDuration} onChange={value => update('clubStayDuration', value)} />
              <EmployeeInput label="合同开始日期" type="date" value={form.contractStartDate} onChange={value => update('contractStartDate', value)} />
              <EmployeeInput label="合同结束日期" type="date" value={form.contractEndDate} onChange={value => update('contractEndDate', value)} />
              <EmployeeInput label="入住时间" type="date" value={form.checkInDate} onChange={value => update('checkInDate', value)} />
              <EmployeeInput label="撤离时间" type="date" value={form.moveOutDate} onChange={value => update('moveOutDate', value)} />
              <EmployeeInput label="实际住宿时长" type="number" value={form.stayDuration} onChange={value => update('stayDuration', value)} />
              <EmployeeInput label="入住备注" value={form.checkInNote} onChange={value => update('checkInNote', value)} />
              <EmployeeInput label="搬出原因" value={form.moveOutReason} onChange={value => update('moveOutReason', value)} />
              <EmployeeInput label="搬离备注" value={form.moveOutNote} onChange={value => update('moveOutNote', value)} />
            </EmployeeFormGrid>
          </EmployeeFormSection>
        </div>
        <div style={{ position: 'absolute', left: 220, right: 0, bottom: 0, minHeight: 56, borderTop: `1px solid ${colors.tableBorder}`, backgroundColor: colors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button type="button" disabled={saving} onClick={() => submit('save')} style={{ height: 32, padding: '0 20px', borderRadius: 5, border: `1px solid ${colors.inputBorder}`, backgroundColor: colors.cardBg, color: colors.text, cursor: 'pointer' }}>提交</button>
          <button type="button" disabled={saving} onClick={() => submit('archive')} style={{ height: 32, padding: '0 20px', borderRadius: 5, border: `1px solid ${colors.inputBorder}`, backgroundColor: colors.cardBg, color: colors.text, cursor: 'pointer' }}>提交并补充其他档案</button>
          <button type="button" disabled={saving} onClick={() => submit('continue')} style={{ height: 32, padding: '0 20px', borderRadius: 5, border: 'none', backgroundColor: colors.primary, color: '#fff', cursor: 'pointer' }}>{saving ? '提交中...' : '提交并新增下一个员工'}</button>
        </div>
      </div>
    </div>
  );
}

function EmployeeFormSection({ id, title, setActive, children }: { id: string; title: string; setActive: (id: string) => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <section id={`employee-add-${id}`} onMouseEnter={() => setActive(id)} style={{ scrollMarginTop: 18, marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#001B44', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
        <span style={{ width: 3, height: 16, backgroundColor: colors.primary, borderRadius: 2 }} />
        {title}
      </div>
      {children}
    </section>
  );
}

function EmployeeFormGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 84, rowGap: 14 }}>{children}</div>;
}

function EmployeeFieldShell({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', alignItems: 'center', gap: 8, fontSize: 13, color: colors.text }}>
      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{required ? <span style={{ color: '#D93026' }}>* </span> : null}{label}</span>
      {children}
    </label>
  );
}

function employeeInputStyle(colors: any): React.CSSProperties {
  return {
    height: 32,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 5,
    padding: '0 10px',
    color: colors.text,
    backgroundColor: colors.cardBg,
    outline: 'none',
    fontSize: 13,
    boxSizing: 'border-box',
    minWidth: 0,
    width: '100%',
  };
}

function EmployeeInput({ label, value, onChange, placeholder = '请输入', type = 'text', required = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; readOnly?: boolean }) {
  const { colors } = useTheme();
  return (
    <EmployeeFieldShell label={label} required={required}>
      <input type={type} value={value} readOnly={readOnly} placeholder={placeholder} onChange={event => onChange(event.target.value)} style={{ ...employeeInputStyle(colors), backgroundColor: readOnly ? colors.tableHeaderBg : colors.cardBg }} />
    </EmployeeFieldShell>
  );
}

function EmployeeSelect({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (value: string) => void; options: SelectOption[]; required?: boolean }) {
  const { colors } = useTheme();
  const optionValues = new Set(options.map(getSelectOptionValue));
  return (
    <EmployeeFieldShell label={label} required={required}>
      <select value={value} onChange={event => onChange(event.target.value)} style={employeeInputStyle(colors)}>
        <option value="">请选择</option>
        {value && !optionValues.has(value) ? <option value={value}>{value}</option> : null}
        {options.map(option => {
          const optionValue = getSelectOptionValue(option);
          return <option key={optionValue} value={optionValue}>{getSelectOptionLabel(option)}</option>;
        })}
      </select>
    </EmployeeFieldShell>
  );
}

function EmployeeRadio({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  const { colors } = useTheme();
  return (
    <EmployeeFieldShell label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: colors.text, minHeight: 32 }}>
        {options.map(option => (
          <label key={option} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={value === option} onChange={() => onChange(option)} style={{ accentColor: colors.primary }} />
            {option}
          </label>
        ))}
      </div>
    </EmployeeFieldShell>
  );
}

function EmployeeTextArea({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  const { colors } = useTheme();
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <EmployeeFieldShell label={label}>
        <div>
          <textarea value={value} maxLength={maxLength} placeholder="请输入" onChange={event => onChange(event.target.value)} style={{ ...employeeInputStyle(colors), height: 54, paddingTop: 8, resize: 'vertical' }} />
          <div style={{ textAlign: 'right', fontSize: 11, color: colors.textMuted }}>{value.length} / {maxLength}</div>
        </div>
      </EmployeeFieldShell>
    </div>
  );
}

function EmployeeAddLine({ label }: { label: string }) {
  const { colors } = useTheme();
  return <button type="button" style={{ width: '100%', height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, backgroundColor: colors.cardBg, color: colors.text, cursor: 'pointer' }}>+ {label}</button>;
}

function EmployeeUploadCard({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <div>
      <button type="button" style={{ width: 180, height: 112, border: `1px dashed ${colors.inputBorder}`, borderRadius: 5, backgroundColor: colors.tableHeaderBg, color: colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${colors.textMuted}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>+</span>
        上传
      </button>
      <div style={{ marginTop: 8, textAlign: 'center', color: colors.text, fontSize: 12 }}>{label}</div>
    </div>
  );
}

function EmployeeImportPage({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [purpose, setPurpose] = useState<'add' | 'modify' | 'upsert'>('add');

  return (
    <div style={{ flex: 1, minHeight: '100%', backgroundColor: colors.appBg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', color: colors.text, fontSize: 12, flexShrink: 0 }}>
        <button type="button" onClick={onBack} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 0 }}>{'< 返回'}</button>
        <span style={{ color: colors.textMuted }}>|</span>
        <span>导入花名册</span>
      </div>
      <Surface style={{ margin: '0 18px 18px', borderRadius: 8, minHeight: 'calc(100vh - 88px)', padding: '32px 0 86px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: 720, maxWidth: 'calc(100vw - 320px)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ fontSize: 13, color: colors.text, marginBottom: 10 }}>1. 选择导入目的</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: `1px solid ${colors.tableBorder}`, borderRadius: 6, overflow: 'hidden' }}>
              {[
                ['add', '新增', '新增员工或多条信息分组数据'],
                ['modify', '修改', '修改已有员工信息'],
                ['upsert', '无则新增，有则修改', '同时支持新增员工/修改已有信息'],
              ].map(item => {
                const active = purpose === item[0];
                return (
                  <button
                    key={item[0]}
                    type="button"
                    onClick={() => setPurpose(item[0] as typeof purpose)}
                    style={{
                      minHeight: 62,
                      border: 'none',
                      borderRight: item[0] === 'upsert' ? 'none' : `1px solid ${colors.tableBorder}`,
                      backgroundColor: active ? withAlpha(colors.primary, 0.1) : colors.cardBg,
                      color: colors.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {active ? <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.primary }} /> : null}
                      </span>
                      {item[1]}
                    </div>
                    <div style={{ marginLeft: 22, marginTop: 6, fontSize: 12, color: colors.textMuted }}>{item[2]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: colors.text, marginBottom: 10 }}>2. 下载导入模板</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <ToolbarButton><Download size={13} /> 极简模板</ToolbarButton>
              <ToolbarButton><Download size={13} /> 标准模板</ToolbarButton>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: colors.text, marginBottom: 8 }}>3. 上传Excel表格</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: colors.textMuted, marginBottom: 12 }}>
              可上传编辑后的花名册模板，也可直接上传企业自己的Excel员工信息表，系统将自动匹配字段和导入任务。Excel支持批量导入多条信息分组的多行数据。
            </div>
            <button type="button" style={{ width: '100%', height: 148, border: `1px dashed ${colors.inputBorder}`, borderRadius: 6, backgroundColor: colors.tableHeaderBg, color: colors.primary, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Upload size={28} />
                <span>点击或拖拽到此区域上传</span>
                <span style={{ color: colors.textMuted, fontSize: 12 }}>文件需小于20M，支持Excel（2003以上版本）</span>
              </span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '150px 250px', alignItems: 'center', gap: 10, color: colors.text, fontSize: 12 }}>
            <span style={{ textAlign: 'right' }}>基本信息(集验重规则)</span>
            <select style={employeeInputStyle(colors)} defaultValue="证件类型+证件号码">
              <option>证件类型+证件号码</option>
              <option>员工号</option>
              <option>手机号</option>
            </select>
            <span style={{ textAlign: 'right' }}>部门路径分割符</span>
            <select style={employeeInputStyle(colors)} defaultValue="斜杠/">
              <option>斜杠/</option>
              <option>反斜杠\</option>
              <option>竖线|</option>
            </select>
          </div>

          <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 6, padding: '14px 18px', color: colors.text, fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ color: colors.primary, fontWeight: 700, marginBottom: 8 }}>上传说明</div>
            <div>1、数据将以新增的方式进行导入，所有选择的导入内容将根据人员唯一标识判断。</div>
            <div>2、若导入员工与已录入员工重复，支持导入预留信息或按表格内容新增员工。</div>
            <div>3、若存在重名部门，请填入组织编码或部门全路径。</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, borderTop: `1px solid ${colors.tableBorder}`, backgroundColor: colors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ToolbarButton onClick={onBack}>取消</ToolbarButton>
          <ToolbarButton primary>下一步</ToolbarButton>
        </div>
      </Surface>
    </div>
  );
}

const rosterFieldGroups = [
  {
    title: '基本信息',
    fields: ['姓名', '企业账号', '手机号', '邮箱', '员工号', '部门', '岗位', '花名', '职级', '汇报上级', '所属', '备注', '身份核验', '是否重入职'],
  },
  {
    title: '在职信息',
    fields: ['入职日期', '到岗日期', '计划试用期', '实际试用期', '计划转正日期', '实际转正日期', '司龄开始日期', '司龄扣减期', '司龄(年)', '体检报告提供情况', '报销体检金额'],
  },
  {
    title: '试用期信息',
    fields: ['带教老师', '带教周期', '试用期跟进情况', '第一次自我鉴定', '第一次自我评分', '第二次自我鉴定', '第二次自我评分', '第一次主管评价', '第一次主管评分', '第二次主管评价', '第二次主管评分'],
  },
  {
    title: '个人信息',
    fields: ['证件类型', '证件号码', '性别', '出生日期', '年龄(年)', '身份证地址', '证件签发日期', '证件到期日期', '国籍/地区', '民族', '政治面貌', '现住址', '婚姻状态', '是否已育'],
  },
  {
    title: '最高教育经历',
    fields: ['学历类型', '学历', '毕业院校', '专业', '入学时间', '毕业时间', '学习形式', '是否最高学历'],
  },
];

function RosterFieldSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const defaultSelected = ['姓名', '部门', '员工号', '手机号', '岗位', '入职日期', '身份核验'];
  const [selected, setSelected] = useState<string[]>(defaultSelected);

  useEffect(() => {
    if (open) setSelected(defaultSelected);
  }, [open]);

  if (!open) return null;

  const toggleField = (field: string) => {
    setSelected(prev => prev.includes(field) ? prev.filter(item => item !== field) : [...prev, field]);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 320, display: 'grid', placeItems: 'center', backgroundColor: 'rgba(15, 22, 38, 0.55)' }}>
      <div style={{ width: 1060, maxWidth: 'calc(100vw - 80px)', height: 690, maxHeight: 'calc(100vh - 70px)', borderRadius: 10, overflow: 'hidden', backgroundColor: colors.cardBg, boxShadow: '0 22px 68px rgba(0,0,0,0.28)', display: 'grid', gridTemplateRows: '54px minmax(0,1fr) 58px' }}>
        <div style={{ padding: '0 20px', borderBottom: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>筛选项配置</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 286px', minHeight: 0 }}>
          <div style={{ padding: 22, overflow: 'auto', borderRight: `1px solid ${colors.tableBorder}` }}>
            <div style={{ border: `1px solid ${withAlpha(colors.primary, 0.45)}`, borderRadius: 5, backgroundColor: withAlpha(colors.primary, 0.08), color: colors.text, padding: '11px 14px', fontSize: 12, marginBottom: 14 }}>
              教育经历等多条信息，请在「员工档案库」中查询
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button type="button" style={{ border: 'none', background: 'transparent', color: colors.text, fontSize: 12, cursor: 'pointer' }}>默认筛选项 ▾</button>
              <input placeholder="搜索字段" style={{ ...employeeInputStyle(colors), width: 238 }} />
            </div>
            {rosterFieldGroups.map(group => (
              <div key={group.title} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 12 }}>{group.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))', gap: '12px 18px' }}>
                  {group.fields.map(field => (
                    <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: colors.text, minWidth: 0 }}>
                      <input type="checkbox" checked={selected.includes(field)} onChange={() => toggleField(field)} style={{ accentColor: colors.primary }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '18px 18px', overflow: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 14 }}>已选择({selected.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selected.map(field => (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 18px', alignItems: 'center', gap: 10, color: colors.text, fontSize: 12 }}>
                  <span style={{ color: colors.textMuted }}>⋮</span>
                  <span>{field}</span>
                  <button type="button" onClick={() => toggleField(field)} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${colors.tableBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <ToolbarButton onClick={onClose}>取消</ToolbarButton>
          <ToolbarButton>保存为常用筛选项</ToolbarButton>
          <ToolbarButton primary onClick={onClose}>确定</ToolbarButton>
        </div>
      </div>
    </div>
  );
}

function EmployeeRosterView() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [activeStatFilter, setActiveStatFilter] = useState<EmployeeRosterFilterKey>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showImportPage, setShowImportPage] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const { organizations, positions } = useHrCoreLookupOptions();
  const departmentOptions = useMemo(() => departmentSelectOptions(organizations), [organizations]);
  const positionOptions = useMemo(() => positionSelectOptions(positions), [positions]);

  const loadRoster = () => {
    fetchEmployeeRoster().then(res => {
      setTotal(res.total);
      setRows(res.rows as unknown as EmployeeGenericRecord[]);
    }).catch(() => {
      setRows([]);
      setTotal(0);
    });
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const matchesStatFilter = (row: EmployeeGenericRecord, filter: EmployeeRosterFilterKey) => {
    const employeeType = String(row.employeeType || '');
    const employeeStatus = String(row.employeeStatus || '').trim();

    if (filter === 'all') return true;
    if (filter === 'fullTime') return employeeType.includes('全职');
    if (filter === 'intern') return employeeType.includes('实习');
    if (filter === 'retired') return employeeType.includes('退休');
    if (filter === 'outsourcedAicai') return employeeType.includes('爱才');
    if (filter === 'outsourcedKexun') return employeeType.includes('科讯');
    if (filter === 'agency') return employeeType.includes('代缴');
    if (filter === 'trial') return employeeStatus.includes('试用');
    if (filter === 'regular') return employeeStatus.includes('正式');
    if (filter === 'leaving') return employeeStatus.includes('待离职') || employeeStatus.includes('离职');
    if (filter === 'blank') return !employeeStatus;
    return true;
  };
  const filteredRows = useMemo(
    () => rows.filter(row => {
      const rowDept = String(row.dept || '');
      const rowDeptPath = String(row.deptFullPath || '');
      const rowPosition = String(row.position || '');
      const matchesDepartment = !departmentFilter
        || rowDeptPath === departmentFilter
        || rowDept === departmentFilter
        || rowDeptPath.includes(departmentFilter)
        || (rowDept && departmentFilter.endsWith(`/${rowDept}`));
      const matchesPosition = !positionFilter || rowPosition === positionFilter;
      return matchesStatFilter(row, activeStatFilter) && matchesDepartment && matchesPosition;
    }),
    [activeStatFilter, departmentFilter, positionFilter, rows],
  );
  const stats = useMemo(() => {
    const count = (tester: (row: EmployeeGenericRecord) => boolean) => rows.filter(tester).length;
    return [
      { key: 'all' as const, label: `共${total || rows.length}人`, value: '' },
      { key: 'fullTime' as const, label: '全职', value: String(count(row => String(row.employeeType || '').includes('全职'))) },
      { key: 'intern' as const, label: '实习', value: String(count(row => String(row.employeeType || '').includes('实习'))) },
      { key: 'retired' as const, label: '退休返聘', value: String(count(row => String(row.employeeType || '').includes('退休'))) },
      { key: 'outsourcedAicai' as const, label: '外包-爱才', value: String(count(row => String(row.employeeType || '').includes('爱才'))) },
      { key: 'outsourcedKexun' as const, label: '外包-科讯', value: String(count(row => String(row.employeeType || '').includes('科讯'))) },
      { key: 'agency' as const, label: '总部-代缴', value: String(count(row => String(row.employeeType || '').includes('代缴'))) },
      { key: 'trial' as const, label: '试用', value: String(count(row => String(row.employeeStatus || '').includes('试用'))) },
      { key: 'regular' as const, label: '正式', value: String(count(row => String(row.employeeStatus || '').includes('正式'))) },
      { key: 'leaving' as const, label: '待离职', value: String(count(row => String(row.employeeStatus || '').includes('待离职') || String(row.employeeStatus || '').includes('离职'))) },
      { key: 'blank' as const, label: '未填写', value: String(count(row => !String(row.employeeStatus || '').trim())) },
    ];
  }, [rows, total]);
  const handleStatSelect = (key: EmployeeRosterFilterKey) => {
    setActiveStatFilter(key);
    setPage(1);
  };
  const resetFilters = () => {
    setActiveStatFilter('all');
    setDepartmentFilter('');
    setPositionFilter('');
    setPage(1);
  };

  if (showAddEmployee) {
    return <EmployeeAddPage onBack={() => setShowAddEmployee(false)} onSaved={loadRoster} />;
  }

  if (showImportPage) {
    return <EmployeeImportPage onBack={() => setShowImportPage(false)} />;
  }

  return (
    <Surface style={{ minHeight: 'calc(100vh - 92px)', padding: 0, overflow: 'hidden' }}>
      <EmployeeFilterBar right={<><ToolbarButton><Settings size={13} /></ToolbarButton><ToolbarButton onClick={resetFilters}>重置</ToolbarButton><ToolbarButton primary>查询</ToolbarButton><ToolbarButton onClick={() => setShowMoreFilters(prev => !prev)}>{showMoreFilters ? '收起选项' : '更多筛选'} {showMoreFilters ? '▴' : '▾'}</ToolbarButton></>}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>
          员工状态
          <input type="checkbox" defaultChecked /> 在职
          <input type="checkbox" /> 离职
          <input type="checkbox" defaultChecked /> 未填写
        </label>
        <FilterInput label="姓名" />
        <SelectBox label="部门" value={departmentFilter} onChange={value => { setDepartmentFilter(value); setPage(1); }} options={departmentOptions} />
        <FilterInput label="员工号" />
        <FilterInput label="手机号" />
        {showMoreFilters ? (
          <>
            <SelectBox label="岗位" value={positionFilter} onChange={value => { setPositionFilter(value); setPage(1); }} options={positionOptions} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>
              入职日期
              <input value="开始日期      →      结束日期" readOnly style={{ width: 260, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 10px', color: colors.textMuted, backgroundColor: colors.cardBg }} />
            </label>
            <SelectBox label="身份核验" />
          </>
        ) : null}
      </EmployeeFilterBar>
      <StatStrip stats={stats} activeKey={activeStatFilter} onSelect={handleStatSelect} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', position: 'relative' }}>
        <ToolbarButton primary onClick={() => setShowAddEmployee(true)}>+ 新增员工</ToolbarButton>
        <ToolbarButton onClick={() => setShowImportMenu(prev => !prev)}>导入⌄</ToolbarButton>
        {showImportMenu ? (
          <div style={{ position: 'absolute', top: 34, left: 96, zIndex: 30, minWidth: 142, padding: '8px 0', border: `1px solid ${colors.tableBorder}`, borderRadius: 6, backgroundColor: colors.cardBg, boxShadow: '0 14px 32px rgba(44,53,80,0.14)' }}>
            <button type="button" onClick={() => { setShowImportMenu(false); setShowImportPage(true); }} style={{ width: '100%', border: 'none', background: 'transparent', color: colors.text, padding: '10px 18px', textAlign: 'left', fontSize: 12, cursor: 'pointer' }}>导入花名册</button>
            <button type="button" onClick={() => setShowImportMenu(false)} style={{ width: '100%', border: 'none', background: 'transparent', color: colors.text, padding: '10px 18px', textAlign: 'left', fontSize: 12, cursor: 'pointer' }}>导入员工材料</button>
          </div>
        ) : null}
        <ToolbarButton>导出⌄</ToolbarButton>
        <ToolbarButton>开具证明</ToolbarButton>
        <ToolbarButton>更多操作⌄</ToolbarButton>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
          <TextAction onClick={() => setShowFieldSettings(true)}>字段设置</TextAction>
          <TextAction>排序</TextAction>
          <TextAction>表头设置</TextAction>
          <TextAction>全屏</TextAction>
        </div>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <EmployeeTable
          columns={[
            { key: 'name', label: '姓名', width: 140, link: true },
            { key: 'phone', label: '手机号', width: 150 },
            { key: 'employeeNo', label: '员工号', width: 140 },
            { key: 'dept', label: '部门', width: 160 },
            { key: 'deptFullPath', label: '部门全路径', width: 280 },
            { key: 'position', label: '岗位', width: 170 },
            { key: 'hireDate', label: '入职日期', width: 140 },
            { key: 'employeeType', label: '员工类型', width: 140 },
            { key: 'employeeStatus', label: '员工状态', width: 140, status: true },
            { key: 'identityVerify', label: '身份核验', width: 140 },
          ]}
          rows={filteredRows}
          maxHeight="calc(100vh - 252px)"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
      <RosterFieldSettingsModal open={showFieldSettings} onClose={() => setShowFieldSettings(false)} />
    </Surface>
  );
}

function ProgressBarRow({ label, percent, count }: { label: string; percent: number; count: string }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr 86px', alignItems: 'center', gap: 12, fontSize: 12 }}>
      <span>{label}</span>
      <div style={{ height: 12, backgroundColor: colors.tableHeaderBg, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 999 }} />
      </div>
      <span>{percent.toFixed(1)}%　{count}</span>
    </div>
  );
}

function RingProgress({ value }: { value: string }) {
  const { colors } = useTheme();
  const numericValue = Number.parseFloat(value) || 0;
  const degrees = Math.max(1, Math.min(360, numericValue * 3.6));
  return (
    <div style={{ width: 170, height: 170, borderRadius: '50%', background: `conic-gradient(${colors.primary} ${degrees}deg, ${colors.tableHeaderBg} ${degrees}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 116, height: 116, borderRadius: '50%', backgroundColor: colors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.textMuted }}>完整率</div>
        <div style={{ fontSize: 32, color: colors.text }}>{value}</div>
      </div>
    </div>
  );
}

function ArchiveOverviewPanel({ title, centerText, rows }: { title: string; centerText: string; rows: Array<{ label: string; percent: number; count: string }> }) {
  const { colors } = useTheme();
  return (
    <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 5, overflow: 'hidden', marginTop: 14 }}>
      <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 20px', backgroundColor: colors.tableHeaderBg, fontWeight: 700, color: colors.text }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '42% 1fr', alignItems: 'center', minHeight: 300, padding: '26px 36px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, color: colors.text }}>{centerText} <ToolbarButton>去上传</ToolbarButton></div>
          <RingProgress value={title.includes('材料') ? '0.0%' : '0.1%'} />
        </div>
        <div style={{ borderLeft: `1px solid ${colors.tableBorder}`, paddingLeft: 34, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {rows.map(row => <ProgressBarRow key={row.label} {...row} />)}
        </div>
      </div>
    </div>
  );
}

type EducationFormState = {
  employeeName: string;
  employeeNo: string;
  dept: string;
  position: string;
  degreeType: string;
  education: string;
  school: string;
  major: string;
  enrollmentDate: string;
  graduationDate: string;
  educationCategory: string;
  studyMode: string;
  schoolingYears: string;
  graduationStatus: string;
  certificateNo: string;
  highestEducation: string;
  degreeName: string;
  degreeDate: string;
  degreeCertificateNo: string;
  highestDegree: string;
  project211: string;
  project985: string;
  doubleFirstClass: string;
  overseas: string;
};

const emptyEducationForm = (): EducationFormState => ({
  employeeName: '',
  employeeNo: '',
  dept: '',
  position: '',
  degreeType: '',
  education: '',
  school: '',
  major: '',
  enrollmentDate: '',
  graduationDate: '',
  educationCategory: '',
  studyMode: '',
  schoolingYears: '',
  graduationStatus: '',
  certificateNo: '',
  highestEducation: '',
  degreeName: '',
  degreeDate: '',
  degreeCertificateNo: '',
  highestDegree: '',
  project211: '',
  project985: '',
  doubleFirstClass: '',
  overseas: '',
});

function EducationDrawer({
  open,
  employees,
  onClose,
  onSave,
}: {
  open: boolean;
  employees: EmployeeGenericRecord[];
  onClose: () => void;
  onSave: (record: EmployeeGenericRecord) => void;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<EducationFormState>(() => emptyEducationForm());

  useEffect(() => {
    if (open) setForm(emptyEducationForm());
  }, [open]);

  if (!open) return null;

  const update = (key: keyof EducationFormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const employeeOptions = employees.slice(0, 80).map(row => String(row.name || row['姓名'] || '')).filter(Boolean);
  const selectEmployee = (name: string) => {
    const employee = employees.find(row => String(row.name || row['姓名'] || '') === name);
    setForm(prev => ({
      ...prev,
      employeeName: name,
      employeeNo: String(employee?.employeeNo || employee?.['员工号'] || prev.employeeNo || ''),
      dept: String(employee?.dept || employee?.['部门'] || prev.dept || ''),
      position: String(employee?.position || employee?.['岗位'] || prev.position || ''),
    }));
  };

  const submit = () => {
    onSave({
      id: `education-${Date.now()}`,
      '姓名': form.employeeName || '未选择员工',
      '员工号': form.employeeNo || '-',
      '部门': form.dept || '-',
      '岗位': form.position || '-',
      '学历': form.education || '-',
      '毕业院校': form.school || '-',
      '专业': form.major || '-',
      '毕业时间': form.graduationDate || '-',
      学历类型: form.degreeType,
      入学时间: form.enrollmentDate,
      学习形式: form.studyMode,
      是否最高学历: form.highestEducation,
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" aria-label="关闭新增教育经历" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 'none', backgroundColor: 'rgba(15, 22, 38, 0.58)', cursor: 'default' }} />
      <div style={{ position: 'relative', width: 690, maxWidth: 'calc(100vw - 220px)', height: '100%', backgroundColor: colors.cardBg, boxShadow: '-18px 0 42px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 54, padding: '0 20px', borderBottom: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, color: colors.text, fontWeight: 700 }}>新增教育经历</div>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '22px 28px 86px', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px 40px', marginBottom: 18 }}>
            <EmployeeSelect label="选择员工" required value={form.employeeName} onChange={selectEmployee} options={employeeOptions.length ? employeeOptions : ['李江梅', '邓成秀', '马玲']} />
            <EmployeeInput label="员工号" value={form.employeeNo} onChange={value => update('employeeNo', value)} placeholder="选择员工后带出" />
          </div>

          <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 6, backgroundColor: colors.tableHeaderBg, overflow: 'hidden' }}>
            <div style={{ height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: colors.text, fontWeight: 700 }}>
              <span>教育经历 1</span>
              <button type="button" title="删除该教育经历" style={{ width: 28, height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.cardBg, color: colors.textMuted, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '18px 20px 22px', backgroundColor: colors.tableHeaderBg, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px 40px' }}>
              <EmployeeSelect label="学历类型" value={form.degreeType} onChange={value => update('degreeType', value)} options={['全日制', '非全日制', '继续教育', '海外学历']} />
              <EmployeeSelect label="学历" value={form.education} onChange={value => update('education', value)} options={['小学', '初中', '高中', '中专', '大专', '本科', '硕士', '博士', '无']} />
              <EmployeeInput label="毕业院校" value={form.school} onChange={value => update('school', value)} />
              <EmployeeInput label="专业" value={form.major} onChange={value => update('major', value)} />
              <EmployeeInput label="入学时间" type="date" value={form.enrollmentDate} onChange={value => update('enrollmentDate', value)} />
              <EmployeeInput label="毕业时间" type="date" value={form.graduationDate} onChange={value => update('graduationDate', value)} />
              <EmployeeFieldShell label="教育经历附件">
                <ToolbarButton><Upload size={13} /> 上传</ToolbarButton>
              </EmployeeFieldShell>
              <EmployeeInput label="入学日期" type="date" value={form.enrollmentDate} onChange={value => update('enrollmentDate', value)} />
              <EmployeeSelect label="学历类别" value={form.educationCategory} onChange={value => update('educationCategory', value)} options={['普通高等教育', '成人教育', '职业教育', '网络教育']} />
              <EmployeeSelect label="学习形式" value={form.studyMode} onChange={value => update('studyMode', value)} options={['全日制', '非全日制', '函授', '业余', '自考']} />
              <EmployeeSelect label="学制" value={form.schoolingYears} onChange={value => update('schoolingYears', value)} options={['1年', '2年', '3年', '4年', '5年']} />
              <EmployeeSelect label="毕（结）业" value={form.graduationStatus} onChange={value => update('graduationStatus', value)} options={['毕业', '结业', '肄业']} />
              <EmployeeInput label="学历证书编号" value={form.certificateNo} onChange={value => update('certificateNo', value)} />
              <EmployeeSelect label="是否最高学历" value={form.highestEducation} onChange={value => update('highestEducation', value)} options={['系统自动计算', '是', '否']} />
              <EmployeeInput label="学位" value={form.degreeName} onChange={value => update('degreeName', value)} />
              <EmployeeInput label="获学位日期" type="date" value={form.degreeDate} onChange={value => update('degreeDate', value)} />
              <EmployeeInput label="学位证书编号" value={form.degreeCertificateNo} onChange={value => update('degreeCertificateNo', value)} />
              <EmployeeSelect label="是否最高学位" value={form.highestDegree} onChange={value => update('highestDegree', value)} options={['是', '否']} />
              <EmployeeSelect label="是否211" value={form.project211} onChange={value => update('project211', value)} options={['是', '否']} />
              <EmployeeSelect label="是否985" value={form.project985} onChange={value => update('project985', value)} options={['是', '否']} />
              <EmployeeSelect label="是否双一流" value={form.doubleFirstClass} onChange={value => update('doubleFirstClass', value)} options={['是', '否']} />
              <EmployeeSelect label="是否海外留学" value={form.overseas} onChange={value => update('overseas', value)} options={['是', '否']} />
              <EmployeeFieldShell label="学位在线验证报告">
                <ToolbarButton><Upload size={13} /> 上传</ToolbarButton>
              </EmployeeFieldShell>
              <EmployeeFieldShell label="学历证书电子注册备案表">
                <ToolbarButton><Upload size={13} /> 上传</ToolbarButton>
              </EmployeeFieldShell>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <EmployeeAddLine label="添加教育经历" />
          </div>
        </div>
        <div style={{ height: 58, borderTop: `1px solid ${colors.tableBorder}`, backgroundColor: colors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 20px', flexShrink: 0 }}>
          <ToolbarButton onClick={onClose}>取消</ToolbarButton>
          <ToolbarButton primary onClick={submit}>保存</ToolbarButton>
        </div>
      </div>
    </div>
  );
}

function EmployeeArchiveView() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'overview' | 'education' | 'work' | 'family'>('overview');
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [educationRows, setEducationRows] = useState<EmployeeGenericRecord[]>([]);
  const [showEducationDrawer, setShowEducationDrawer] = useState(false);

  useEffect(() => {
    fetchEmployeeArchive().then(res => setRows(res.rows as unknown as EmployeeGenericRecord[]));
    fetchEmployeeEducation().then(res => setEducationRows(res.rows));
  }, []);

  const tabs = [
    ['overview', '员工档案概况'],
    ['education', '教育经历'],
    ['work', '工作经历'],
    ['family', '家庭成员'],
  ] as const;

  return (
    <Surface style={{ minHeight: 'calc(100vh - 92px)', padding: '0 20px 20px', overflow: 'auto' }}>
      <div style={{ display: 'flex', height: 46, borderBottom: `1px solid ${colors.tableBorder}`, gap: 28 }}>
        {tabs.map(item => (
          <button key={item[0]} onClick={() => setTab(item[0])} style={{ border: 'none', background: 'transparent', borderBottom: tab === item[0] ? `2px solid ${colors.primary}` : '2px solid transparent', color: tab === item[0] ? colors.primary : colors.text, fontSize: 13, cursor: 'pointer' }}>{item[1]}</button>
        ))}
      </div>
      {tab === 'overview' ? (
        <>
          <EmployeeFilterBar right={<div style={{ fontSize: 12, color: colors.text }}>数据获取时间：2026-05-22 10:22:54</div>}>
            <SelectBox label="" placeholder="选择部门" width={200} />
            <SelectBox label="" placeholder="选择在职员工状态" width={200} />
          </EmployeeFilterBar>
          <div style={{ fontSize: 12, color: colors.text, padding: '0 0 6px' }}>统计范围：全部在职员工{rows.length || 1035}人　 <span style={{ color: colors.primary }}>●</span> 提升员工档案完整率，有利于降低用工风险</div>
          <ArchiveOverviewPanel
            title="材料概况"
            centerText={`0人已上传完整，${rows.length || 1035}人未上传完整`}
            rows={[
              { label: '身份证(正反面)', percent: 7.5, count: '78份' },
              { label: '学历证书', percent: 3.9, count: '40份' },
              { label: '体检报告', percent: 4.1, count: '42份' },
              { label: '当前合同附件', percent: 25.1, count: '260份' },
              { label: '头像', percent: 1.8, count: '19份' },
            ]}
          />
          <ArchiveOverviewPanel
            title="重要信息概况"
            centerText={`1人已补充完整，${Math.max(0, (rows.length || 1035) - 1)}人未补充完整`}
            rows={[
              { label: '当前合同起始日', percent: 86.2, count: '892份' },
              { label: '公积金账号', percent: 8.8, count: '91份' },
              { label: '现住址', percent: 36.1, count: '374份' },
              { label: '紧急联系人', percent: 70.6, count: '731份' },
              { label: '社保账号', percent: 0.1, count: '1份' },
              { label: '工资卡号', percent: 5.8, count: '60份' },
            ]}
          />
        </>
      ) : (
        <div style={{ paddingTop: 10 }}>
          {tab === 'education' ? (
            <>
              <EmployeeFilterBar right={<><ToolbarButton>重置</ToolbarButton><ToolbarButton primary>查询</ToolbarButton><TextAction>更多筛选 ▾</TextAction></>}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>
                  员工状态
                  <input type="checkbox" defaultChecked style={{ accentColor: colors.primary }} /> 在职
                  <input type="checkbox" /> 离职
                  <input type="checkbox" defaultChecked style={{ accentColor: colors.primary }} /> 未填写
                </label>
                <FilterInput label="姓名" />
                <FilterInput label="员工号" />
                <SelectBox label="部门" />
                <SelectBox label="岗位" />
              </EmployeeFilterBar>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 16px 12px' }}>
                <ToolbarButton primary onClick={() => setShowEducationDrawer(true)}><Plus size={13} /> 新增</ToolbarButton>
                <ToolbarButton>导入</ToolbarButton>
                <ToolbarButton disabled>批量操作⌄</ToolbarButton>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ToolbarButton>学历学位验证</ToolbarButton>
                  <ToolbarButton title="导出"><Download size={13} /></ToolbarButton>
                  <ToolbarButton title="字段设置"><Settings size={13} /></ToolbarButton>
                  <ToolbarButton title="全屏"><Maximize2 size={13} /></ToolbarButton>
                </div>
              </div>
            </>
          ) : null}
          <EmployeeTable
            rows={tab === 'education' ? educationRows : rows}
            columns={tab === 'education' ? [
              { key: '__select', label: '', width: 40, render: () => <input type="checkbox" style={{ accentColor: colors.primary }} /> },
              { key: '姓名', label: '姓名', width: 120 },
              { key: '员工号', label: '员工号', width: 120 },
              { key: '部门', label: '部门', width: 180 },
              { key: '岗位', label: '岗位', width: 160 },
              { key: '学历', label: '学历', width: 120 },
              { key: '毕业院校', label: '毕业院校', width: 220 },
              { key: '专业', label: '专业', width: 160 },
              { key: '毕业时间', label: '毕业时间', width: 140 },
              { key: '__action', label: '操作', width: 100, render: () => <TextAction>编辑</TextAction> },
            ] : [
              { key: 'name', label: '姓名', width: 120 },
              { key: 'employeeNo', label: '员工号', width: 120 },
              { key: 'dept', label: '部门', width: 180 },
              { key: 'position', label: '岗位', width: 160 },
              { key: 'source', label: '数据来源', width: 180 },
            ]}
            maxHeight={tab === 'education' ? 'calc(100vh - 276px)' : 'calc(100vh - 190px)'}
          />
          <EducationDrawer
            open={showEducationDrawer}
            employees={rows}
            onClose={() => setShowEducationDrawer(false)}
            onSave={(record) => setEducationRows(prev => [record, ...prev])}
          />
        </div>
      )}
    </Surface>
  );
}

function ArchiveApprovalView() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);

  useEffect(() => {
    fetchEmployeeArchiveApprovals().then(res => setRows(res.rows));
  }, []);

  return (
    <Surface style={{ minHeight: 'calc(100vh - 92px)', padding: '0 16px 16px', overflow: 'hidden' }}>
      <EmployeeFilterBar right={<><ToolbarButton>重置</ToolbarButton><ToolbarButton primary>查询</ToolbarButton></>}>
        <FilterInput label="变更前姓名" />
        <FilterInput label="变更前员工号" />
        <SelectBox label="变更前部门" />
        <FilterInput label="表单名称" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>发起日期 <input value="2025-05-22    →    2026-05-22" readOnly style={{ width: 220, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 10px', color: colors.text, backgroundColor: colors.cardBg }} /></label>
      </EmployeeFilterBar>
      <div style={{ padding: '6px 0 16px' }}>
        <button style={{ height: 40, minWidth: 78, border: 'none', borderRadius: 6, backgroundColor: withAlpha(colors.primary, 0.1), color: colors.text, fontSize: 13 }}>全部 <b>{rows.length}</b></button>
      </div>
      <ToolbarButton>+ 申请变更</ToolbarButton>
      <div style={{ marginTop: 16 }}>
        <EmployeeTable
          rows={rows.length ? rows : []}
          emptyText="暂无内容"
          columns={[
            { key: 'applicant', label: '姓名', width: 130 },
            { key: 'oldName', label: '变更前姓名', width: 140 },
            { key: 'newName', label: '变更后姓名', width: 140 },
            { key: 'employeeNo', label: '变更前员工号', width: 150 },
            { key: 'newEmployeeNo', label: '变更后员工号', width: 150 },
            { key: 'dept', label: '变更前部门', width: 160 },
            { key: 'newDept', label: '变更后部门', width: 160 },
            { key: 'status', label: '审批状态', width: 130 },
            { key: 'changeType', label: '表单名称', width: 160 },
            { key: 'initiator', label: '当前处理人', width: 140 },
            { key: 'createTime', label: '发起时间', width: 160 },
          ]}
        />
      </div>
    </Surface>
  );
}

function EmployeeCareView() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [tab, setTab] = useState<'birthday' | 'anniversary'>('birthday');

  useEffect(() => {
    fetchEmployeeCare().then(res => setRows(res.rows));
  }, []);

  return (
    <Surface style={{ minHeight: 'calc(100vh - 92px)', padding: '0 20px 16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: 46, borderBottom: `1px solid ${colors.tableBorder}`, gap: 28 }}>
        <button onClick={() => setTab('birthday')} style={{ border: 'none', background: 'transparent', borderBottom: tab === 'birthday' ? `2px solid ${colors.primary}` : '2px solid transparent', color: tab === 'birthday' ? colors.primary : colors.text, fontSize: 13, cursor: 'pointer' }}>生日提醒</button>
        <button onClick={() => setTab('anniversary')} style={{ border: 'none', background: 'transparent', borderBottom: tab === 'anniversary' ? `2px solid ${colors.primary}` : '2px solid transparent', color: tab === 'anniversary' ? colors.primary : colors.text, fontSize: 13, cursor: 'pointer' }}>入职周年提醒</button>
        <div style={{ marginLeft: 'auto', alignSelf: 'center' }}><TextAction>智能祝福配置</TextAction></div>
      </div>
      <EmployeeFilterBar right={<><ToolbarButton>重置</ToolbarButton><ToolbarButton primary>查询</ToolbarButton><TextAction>更多筛选 ▾</TextAction></>}>
        <SelectBox label="部门" />
        <FilterInput label="姓名/员工号" placeholder="请输入" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text }}>{tab === 'birthday' ? '生日日期' : '入职日期'} <input value="2026-05-01    →    2026-05-31" readOnly style={{ width: 220, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '0 10px', color: colors.text, backgroundColor: colors.cardBg }} /></label>
      </EmployeeFilterBar>
      <ToolbarButton>发送生日红包</ToolbarButton>
      <div style={{ marginTop: 16 }}>
        <EmployeeTable
          rows={rows}
          columns={[
            { key: 'name', label: '姓名', width: 140 },
            { key: 'employeeNo', label: '员工号', width: 160 },
            { key: 'phone', label: '手机号', width: 180 },
            { key: 'dept', label: '部门', width: 220 },
            { key: 'dueDate', label: tab === 'birthday' ? '生日日期' : '入职周年', width: 160 },
            { key: 'careType', label: '提醒类型', width: 180 },
            { key: 'status', label: '红包活动', width: 160 },
          ]}
        />
      </div>
    </Surface>
  );
}

function SimpleBarChart({ rows }: { rows: EmployeeGenericRecord[] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rows.map(row => Number(row.total || row.active || 0)));
  const showRows = rows.slice(0, 14);
  return (
    <div style={{ height: 330, display: 'grid', gridTemplateColumns: `repeat(${showRows.length || 1}, minmax(48px, 1fr))`, alignItems: 'end', gap: 18, padding: '30px 50px 20px', borderTop: `1px solid ${colors.tableBorder}` }}>
      {showRows.map(row => {
        const value = Number(row.total || row.active || 0);
        return (
          <div key={String(row.dept)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 10, height: '100%' }}>
            <div title={`${row.dept}: ${value}`} style={{ width: 24, height: `${Math.max(4, value / max * 220)}px`, backgroundColor: withAlpha(colors.primary, 0.58), borderRadius: '3px 3px 0 0' }} />
            <div style={{ height: 62, fontSize: 11, color: colors.textMuted, writingMode: 'vertical-rl', transform: 'rotate(35deg)', whiteSpace: 'nowrap' }}>{String(row.dept || '')}</div>
          </div>
        );
      })}
    </div>
  );
}

function DistributionBarList({ rows }: { rows: Array<{ label: string; value: number; total: number; suffix?: string }> }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {rows.map(row => {
        const percent = row.total ? row.value / row.total * 100 : 0;
        return (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr) 94px', alignItems: 'center', gap: 12, color: colors.text, fontSize: 12 }}>
            <span style={{ textAlign: 'right', color: colors.textMuted }}>{row.label}</span>
            <div style={{ height: 12, backgroundColor: colors.tableHeaderBg, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', borderRadius: 999, backgroundColor: colors.primary }} />
            </div>
            <span style={{ color: colors.textMuted }}>{row.value}{row.suffix || '人'}　{percent.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniDonut({
  title,
  segments,
  rightLink,
}: {
  title: string;
  segments: Array<{ label: string; value: number; color: string }>;
  rightLink?: string;
}) {
  const { colors } = useTheme();
  const total = Math.max(1, segments.reduce((sum, item) => sum + item.value, 0));
  let start = 0;
  const gradient = segments.map(item => {
    const from = start;
    start += item.value / total * 360;
    return `${item.color} ${from}deg ${start}deg`;
  }).join(', ');

  return (
    <ReportPanel title={title} extra={rightLink ? <TextAction>{rightLink}</TextAction> : null}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 30 }}>
        <div style={{ width: 148, height: 148, borderRadius: '50%', background: `conic-gradient(${gradient})`, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 86, height: 86, borderRadius: '50%', backgroundColor: colors.cardBg }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
          {segments.map(item => {
            const percent = item.value / total * 100;
            return (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.text }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
                {item.label} {item.value}人 {percent.toFixed(1)}%
              </div>
            );
          })}
        </div>
      </div>
    </ReportPanel>
  );
}

function ReportPanel({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.cardBg }}>
      <div style={{ minHeight: 48, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: colors.text }}>
        <span>{title}</span>
        {extra}
      </div>
      <div style={{ padding: '18px 28px 28px' }}>{children}</div>
    </div>
  );
}

function EmployeeDistributionReport({ rows }: { rows: EmployeeGenericRecord[] }) {
  const { colors } = useTheme();
  const total = rows.reduce((sum, row) => sum + Number(row.active || row.total || 0), 0) || 1035;
  const primary = colors.primary;
  const secondary = '#C48A5A';
  const muted = colors.textMuted;

  return (
    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
      <ReportPanel title="员工类型分布">
        <DistributionBarList rows={[
          { label: '全职', value: 679, total },
          { label: '实习', value: 12, total },
          { label: '退休返聘', value: 36, total },
          { label: '外包-爱才', value: 12, total },
          { label: '外包-科讯', value: 287, total },
          { label: '总部-代缴', value: 9, total },
        ]} />
      </ReportPanel>
      <MiniDonut title="性别分布" segments={[
        { label: '女', value: 395, color: secondary },
        { label: '男', value: 640, color: primary },
        { label: '未填写', value: 0, color: muted },
      ]} />
      <ReportPanel title="年龄分布">
        <DistributionBarList rows={[
          { label: '17岁及以下', value: 1, total },
          { label: '18-25岁', value: 130, total },
          { label: '26-30岁', value: 195, total },
          { label: '31-35岁', value: 223, total },
          { label: '36-40岁', value: 207, total },
          { label: '41-45岁', value: 103, total },
          { label: '46-50岁', value: 77, total },
          { label: '51岁及以上', value: 99, total },
        ]} />
      </ReportPanel>
      <MiniDonut title="高龄分布" rightLink="高龄规则设置 | 人员详情" segments={[
        { label: '女', value: 8, color: secondary },
        { label: '男', value: 22, color: primary },
      ]} />
      <ReportPanel title="司龄分布">
        <DistributionBarList rows={[
          { label: '1-3个月(含)', value: 69, total },
          { label: '3-6个月(含)', value: 89, total },
          { label: '6个月-1年(含)', value: 121, total },
          { label: '1-3年(含)', value: 338, total },
          { label: '3年以上', value: 418, total },
        ]} />
      </ReportPanel>
      <ReportPanel title="学历分布">
        <DistributionBarList rows={[
          { label: '其他学历', value: 524, total },
          { label: '高中/中专', value: 241, total },
          { label: '大专', value: 181, total },
          { label: '本科及以上', value: 89, total },
        ]} />
      </ReportPanel>
    </div>
  );
}

function EmployeeReportsView({ initialTab = 'realtime' }: { initialTab?: 'realtime' | 'distribution' | 'archive' }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<EmployeeGenericRecord[]>([]);
  const [tab, setTab] = useState<'realtime' | 'distribution' | 'archive'>(initialTab);
  const total = rows.reduce((sum, row) => sum + Number(row.active || row.total || 0), 0);

  useEffect(() => {
    fetchEmployeeReports().then(res => setRows(res.rows));
  }, []);
  useEffect(() => setTab(initialTab), [initialTab]);

  const tabs: Array<{ key: 'realtime' | 'distribution' | 'archive'; label: string }> = [
    { key: 'realtime', label: '实时统计' },
    { key: 'distribution', label: '实时员工分布' },
    { key: 'archive', label: '员工档案概况' },
  ];

  return (
    <Surface style={{ minHeight: 'calc(100vh - 92px)', padding: '0 20px 16px', overflow: 'auto' }}>
      <div style={{ display: 'flex', height: 46, borderBottom: `1px solid ${colors.tableBorder}`, gap: 28 }}>
        {tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} style={{ border: 'none', background: 'transparent', borderBottom: tab === item.key ? `2px solid ${colors.primary}` : '2px solid transparent', color: tab === item.key ? colors.primary : colors.text, fontSize: 13, cursor: 'pointer' }}>{item.label}</button>)}
      </div>
      {tab === 'realtime' ? <div style={{ border: `1px solid ${withAlpha(colors.primary, 0.32)}`, backgroundColor: withAlpha(colors.primary, 0.08), color: colors.text, fontSize: 13, padding: '10px 14px', borderRadius: 4, marginTop: 16 }}>
        旧版报表即将下架，新报表全面升级！深度对接智数报表，支持自定义配置；多维分析人员结构，权限控制精准到部门及业务分组。
      </div> : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 12, color: colors.text }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SelectBox label="" placeholder="选择部门" width={220} />
          {tab === 'distribution' ? <><SelectBox label="" placeholder="选择在职员工状态" width={220} /><SelectBox label="" placeholder="选择员工类型" width={220} /></> : null}
        </div>
        <span>数据获取时间：2026-05-22 10:32:24</span>
      </div>
      {tab === 'distribution' ? (
        <>
          <div style={{ fontSize: 12, color: colors.text, marginTop: 14 }}>统计范围：全部在职员工<b>{total || 1035}</b>人</div>
          <EmployeeDistributionReport rows={rows} />
        </>
      ) : tab === 'archive' ? (
        <div style={{ marginTop: 16 }}>
          <ArchiveOverviewPanel
            title="材料概况"
            centerText={`0人已上传完整，${total || 1035}人未上传完整`}
            rows={[
              { label: '身份证(正反面)', percent: 7.5, count: '78份' },
              { label: '学历证书', percent: 3.9, count: '40份' },
              { label: '体检报告', percent: 4.1, count: '42份' },
              { label: '当前合同附件', percent: 25.1, count: '260份' },
              { label: '头像', percent: 1.8, count: '19份' },
            ]}
          />
        </div>
      ) : (
        <>
          <div style={{ marginTop: 16, border: `1px solid ${colors.tableBorder}`, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ padding: 20, fontWeight: 700 }}>各部门在职人数</div>
            <div style={{ padding: '0 20px 8px', fontSize: 12 }}>统计范围：全部在职员工<b>{total || 1035}</b>人，离职员工<b>15</b>人</div>
            <SimpleBarChart rows={rows} />
          </div>
          <div style={{ marginTop: 20, border: `1px solid ${colors.tableBorder}`, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b>当月部门入/离职人数</b>
              <div style={{ display: 'flex', gap: 16 }}><TextAction>已入职明细</TextAction><TextAction>已离职明细</TextAction></div>
            </div>
            <SimpleBarChart rows={rows.filter(row => Number(row.total || 0) < 50)} />
          </div>
        </>
      )}
    </Surface>
  );
}

function FirstEmployeeManagementView({ view }: { view: EmployeeViewKey }) {
  if (view === 'roster') return <EmployeeRosterView />;
  if (view === 'archive') return <EmployeeArchiveView />;
  if (view === 'archiveApprovals') return <ArchiveApprovalView />;
  if (view === 'care') return <EmployeeCareView />;
  if (view === 'reports') return <EmployeeReportsView initialTab="distribution" />;
  if (view === 'reportsNew') return <EmployeeReportsView initialTab="realtime" />;
  return null;
}

function EmployeeHomeDashboard({ summary }: { summary: EmployeeManagementSummary | null }) {
  const { colors } = useTheme();
  const employeeTotal = summary?.employeeTotal ?? 1027;
  const active = summary?.active ?? 104;
  const trial = summary?.trial ?? 5;
  const contractExpiring = summary?.contractExpiring ?? 7;
  const contractPendingSign = summary?.contractPendingSign ?? 12;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 252px', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Surface style={{ padding: '14px 14px 16px' }}>
          <SectionTitle title="入职助手" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <MetricStripCard title="流程待办" metrics={[{ label: '审批中', value: '0 人' }]} tone="soft" />
            <MetricStripCard title="待入职" metrics={[{ label: '入职审批中', value: `${summary?.pendingOnboard ?? 0} 人` }, { label: '今日待确认入职', value: '0 人' }]} tone="soft" />
            <MetricStripCard title="合同签订" metrics={[{ label: '已确认入职，合同未签订', value: `${contractPendingSign} 人` }]} tone="primary" />
            <MetricStripCard title="员工信息补齐" metrics={[{ label: '档案信息待补', value: `${summary?.identityUnverified ?? 1025} 人` }, { label: '材料待补', value: '1026 人' }]} tone="soft" />
          </div>
        </Surface>

        <Surface style={{ padding: '14px 14px 16px' }}>
          <SectionTitle title="离职助手" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <MetricStripCard title="流程待办" metrics={[{ label: '审批中', value: `${summary?.resigning ?? 4} 人` }]} tone="warning" />
            <MetricStripCard title="待办提醒" metrics={[{ label: '今日待确认离职', value: '0 人' }]} tone="warning" />
            <MetricStripCard title="合同解除" metrics={[{ label: '合同未解约', value: '90 人' }]} tone="warning" />
          </div>
        </Surface>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <StatOverviewCard
            title="任职管理"
            stats={[
              { label: '总人数', value: `${employeeTotal} 人`, accent: true },
              { label: '在职', value: `${active} 人` },
              { label: '试用中', value: `${trial} 人` },
              { label: '离职中', value: `${summary?.resigning ?? 4} 人` },
              { label: '已离职', value: '0 人' },
              { label: '调岗中', value: `${summary?.transferring ?? 0} 人` },
            ]}
          />
          <StatOverviewCard
            title="合同签署"
            stats={[
              { label: '待发起续签', value: `${contractExpiring} 单`, accent: true },
              { label: '即将到期', value: '69 单', accent: true },
              { label: '签署中', value: `${contractPendingSign} 单` },
              { label: '近期未签', value: '6 单' },
              { label: '补签待处理', value: '0 单' },
              { label: '转签待处理', value: '0 单' },
            ]}
          />
        </div>

        <Surface style={{ padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>人事提醒</div>
            <div style={{ fontSize: '11px', color: colors.textMuted }}>更新时间：{todayISO()} 14:29　切换　刷新</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, paddingTop: 4 }}>
            {[
              ['合同到期提醒', '0 条'],
              ['转正提醒', '0 人'],
              ['进群提醒', '48 人'],
              ['身份证过期提醒', '0 人'],
              ['账号停用提醒', '0 人'],
              ['内推状态提醒', '0 人'],
              ['花名册字段缺失', '0 项'],
              ['档案信息缺失', '0 项'],
              ['电子签章异常', '0 项'],
              ['证照到期提醒', '0 项'],
            ].map(item => (
              <div key={item[0]} style={{ minHeight: 58, borderTop: `1px solid ${colors.tableBorder}`, paddingTop: 10 }}>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: 8 }}>{item[0]}</div>
                <div style={{ fontSize: '18px', color: colors.text, fontWeight: 700 }}>{item[1]}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SidePanel title="异常处理" extra={<CircleHelp size={14} style={{ color: colors.textMuted }} />}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0 2px' }}>
            <CircleAlert size={16} style={{ color: colors.primary, marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '12px', color: colors.text }}>权限范围内有 2 人的工号与手机号未补全</div>
              <button style={{ marginTop: 8, border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer', padding: 0 }}>去处理 &gt;</button>
            </div>
          </div>
        </SidePanel>

        <SidePanel title="产品动态" extra={<button style={{ border: 'none', background: 'transparent', color: colors.textMuted, fontSize: '12px', cursor: 'pointer' }}>更多 &gt;</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['产品迭代更新说明（员工管理 2026 年 1 月）', '2026-03-19'],
              ['产品迭代更新说明（员工管理 2025 年 12 月）', '2026-01-19'],
              ['入职材料新增附件指引', '2025-11-25'],
            ].map(item => (
              <div key={item[0]} style={{ paddingBottom: 10, borderBottom: `1px solid ${colors.tableBorder}` }}>
                <div style={{ fontSize: '12px', lineHeight: 1.6, color: colors.text }}>{item[0]}</div>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: 6 }}>{item[1]}</div>
              </div>
            ))}
          </div>
        </SidePanel>

        <Surface style={{ padding: '16px', background: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.14)}, ${withAlpha('#6EC0D0', 0.18)})`, overflow: 'hidden', position: 'relative' }}>
          <div style={{ maxWidth: 148, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: colors.primary, marginBottom: 6 }}>电子合同全面升级啦！</div>
            <div style={{ fontSize: '12px', lineHeight: 1.7, color: colors.textMuted, marginBottom: 10 }}>支持批量签署、签章提醒与材料归档，继续沿用当前系统的配色与后台表达。</div>
            <button style={{ height: 28, padding: '0 12px', borderRadius: 999, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' }}>了解更多</button>
          </div>
          <div style={{ position: 'absolute', right: 10, bottom: 6, width: 118, height: 70, borderRadius: 18, background: withAlpha('#6EC0D0', 0.2), transform: 'skewX(-18deg)' }} />
          <div style={{ position: 'absolute', right: 30, bottom: 18, width: 86, height: 52, borderRadius: 14, backgroundColor: '#fff', border: `1px solid ${withAlpha(colors.primary, 0.18)}` }} />
        </Surface>
      </div>
    </div>
  );
}

export function EmployeeManagementPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [activeView, setActiveView] = useState<EmployeeViewKey>(() => getEmployeeViewFromSection(params.section));
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initialView = getEmployeeViewFromSection(params.section);
    const initialGroup = getEmployeeGroupKeyForView(initialView);
    return { employment: true, ...(initialGroup ? { [initialGroup]: true } : {}) };
  });
  const [summary, setSummary] = useState<EmployeeManagementSummary | null>(null);

  useEffect(() => {
    const nextView = getEmployeeViewFromSection(params.section);
    setActiveView(nextView);
    const nextGroup = getEmployeeGroupKeyForView(nextView);
    if (nextGroup) {
      setExpandedGroups(prev => ({ ...prev, [nextGroup]: true }));
    }
  }, [params.section]);

  const switchView = (view: EmployeeViewKey) => {
    setActiveView(view);
    navigate(`/employee/${employeeViewSlugMap[view]}`, { replace: false });
  };

  useEffect(() => {
    let cancelled = false;
    fetchEmployeeManagementSummary()
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => { cancelled = true; };
  }, []);

  const navGroups: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    defaultView: EmployeeViewKey;
    children: Array<{ label: string; view: EmployeeViewKey }>;
  }> = [
    {
      key: 'employee',
      label: '员工管理',
      icon: <UserPlus size={14} />,
      defaultView: 'roster',
      children: [
        { label: '员工花名册', view: 'roster' },
        { label: '员工档案库', view: 'archive' },
        { label: '档案变更审批', view: 'archiveApprovals' },
        { label: '员工关怀', view: 'care' },
        { label: '员工统计报表', view: 'reports' },
        { label: '员工统计报表（新版）', view: 'reportsNew' },
      ],
    },
    {
      key: 'employment',
      label: '任职管理',
      icon: <Briefcase size={14} />,
      defaultView: 'pendingOnboard',
      children: [
        { label: '入职管理', view: 'pendingOnboard' },
        { label: '转正管理', view: 'regularized' },
        { label: '调动管理', view: 'transferring' },
        { label: '兼任管理', view: 'concurrent' },
        { label: '借调管理', view: 'borrowed' },
        { label: '临时调店管理', view: 'tempStore' },
        { label: '离职管理', view: 'resigning' },
        { label: '任职记录', view: 'mainJobRecords' },
        { label: '临时调店记录', view: 'tempStoreRecords' },
      ],
    },
    {
      key: 'contract',
      label: '员工合同',
      icon: <FileText size={14} />,
      defaultView: 'newSign',
      children: [
        { label: '合同发起', view: 'newSign' },
        { label: '合同审批', view: 'contractApproval' },
        { label: '电子合同签署', view: 'signing' },
        { label: '合同解除', view: 'contractRelease' },
        { label: '合同台账', view: 'contractLedger' },
        { label: '电子签署设置', view: 'esignSettings' },
      ],
    },
    {
      key: 'settings',
      label: '员工管理设置',
      icon: <CircleHelp size={14} />,
      defaultView: 'settings',
      children: [
        { label: '基础设置', view: 'settings' },
        { label: '黑名单管理', view: 'blacklist' },
      ],
    },
    {
      key: 'services',
      label: '员工服务',
      icon: <Network size={14} />,
      defaultView: 'certificates',
      children: [
        { label: '证明开具', view: 'certificates' },
        { label: '自定义打印', view: 'customPrint' },
        { label: '模板管理', view: 'templates' },
      ],
    },
    {
      key: 'thirdParty',
      label: '第三方对接',
      icon: <Folders size={14} />,
      defaultView: 'thirdParty',
      children: [
        { label: '员工对接日志', view: 'thirdParty' },
      ],
    },
  ];

  const employeeSidebarItems: SidebarItem[] = navGroups.flatMap((group) => {
    const groupActive = group.children.some(child => child.view === activeView);
    const isExpanded = Boolean(expandedGroups[group.key]);
    const groupItem: SidebarItem = {
      label: group.label,
      icon: group.icon,
      group: true,
      groupActive,
      arrow: true,
      expanded: isExpanded,
      onClick: () => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] })),
    };
    const childItems: SidebarItem[] = isExpanded
      ? group.children.map(child => ({
        label: child.label,
        depth: 1,
        active: activeView === child.view,
        onClick: () => switchView(child.view),
      }))
      : [];
    return [groupItem, ...childItems];
  });

  const firstEmployeeView = ['roster', 'archive', 'archiveApprovals', 'care', 'reports', 'reportsNew'].includes(activeView)
    ? activeView
    : null;
  const employmentWorkbenchMode: EmploymentWorkbenchMode | null = ['pendingOnboard', 'onboarded', 'abandoned'].includes(activeView)
    ? 'onboard'
    : activeView === 'regularized'
      ? 'regularization'
      : activeView === 'transferring'
        ? 'transfer'
        : null;
  const dataView = activeView === 'home' || firstEmployeeView ? null : employeeViewMap[activeView as Exclude<EmployeeViewKey, 'home'>];
  const contractWorkbenchViews: EmployeeViewKey[] = ['newSign', 'renewal', 'contractApproval', 'signing', 'contractRelease', 'contractLedger'];
  const contractWorkbenchView = contractWorkbenchViews.includes(activeView) ? activeView : null;

  return (
    <ModuleWorkspace
      sidebarTitle=""
      sidebarItems={[
        { label: '首页', icon: <Home size={14} />, active: activeView === 'home', onClick: () => switchView('home') },
        ...employeeSidebarItems,
      ]}
    >
      {firstEmployeeView
        ? <FirstEmployeeManagementView view={firstEmployeeView} />
        : employmentWorkbenchMode
          ? <EmploymentWorkbench mode={employmentWorkbenchMode} activeView={activeView} />
          : activeView === 'concurrent' || activeView === 'borrowed'
            ? <AssignmentWorkbench mode={activeView === 'concurrent' ? 'concurrent' : 'borrowed'} />
          : activeView === 'tempStore'
            ? <TempStoreWorkbench />
          : activeView === 'tempStoreRecords'
            ? <TempStoreWorkbench records />
          : activeView === 'resigning'
            ? <ResignationWorkbench />
          : activeView === 'mainJobRecords'
            ? <EmploymentRecordWorkbench />
          : contractWorkbenchView
            ? <ContractWorkbench view={contractWorkbenchView} />
          : activeView === 'settings'
            ? <EmployeeManagementSettingsView />
          : activeView === 'blacklist'
            ? <EmployeeBlacklistManagementView />
          : activeView === 'certificates'
            ? <CertificateIssueWorkbench />
          : activeView === 'customPrint'
            ? <CustomPrintWorkbench />
          : activeView === 'templates'
            ? <PrintTemplateManagementWorkbench />
          : activeView === 'thirdParty'
            ? <ThirdPartyDockingWorkbench />
          : dataView
            ? <EmployeeDataTable view={dataView} />
            : <EmployeeHomeDashboard summary={summary} />}
    </ModuleWorkspace>
  );

  return (
    <ModuleWorkspace
      sidebarTitle="员工管理"
      sidebarItems={[
        { label: '入职助手', icon: <UserPlus size={14} />, active: true, arrow: true },
        { label: '任职管理', icon: <Briefcase size={14} />, arrow: true },
        { label: '员工合同', icon: <FileText size={14} />, arrow: true },
        { label: '员工花名册', icon: <Users size={14} />, arrow: true },
        { label: '第三方档案', icon: <Folders size={14} />, arrow: true },
      ]}

    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 252px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Surface style={{ padding: '14px 14px 16px' }}>
            <SectionTitle title="入职助手" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              <MetricStripCard title="流程待办" metrics={[{ label: '审批中', value: '0 人' }]} tone="soft" />
              <MetricStripCard title="待入职" metrics={[{ label: '入职审批中', value: '0 人' }, { label: '今日待确认入职', value: '0 人' }]} tone="soft" />
              <MetricStripCard title="合同签订" metrics={[{ label: '已确认入职，合同未签订', value: '68 人' }]} tone="primary" />
              <MetricStripCard title="员工信息补齐" metrics={[{ label: '档案信息待补', value: '1025 人' }, { label: '材料待补', value: '1026 人' }]} tone="soft" />
            </div>
          </Surface>

          <Surface style={{ padding: '14px 14px 16px' }}>
            <SectionTitle title="离职助手" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <MetricStripCard title="流程待办" metrics={[{ label: '审批中', value: '4 人' }]} tone="warning" />
              <MetricStripCard title="待办提醒" metrics={[{ label: '今日待确认离职', value: '0 人' }]} tone="warning" />
              <MetricStripCard title="合同解除" metrics={[{ label: '合同未解约', value: '90 人' }]} tone="warning" />
            </div>
          </Surface>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <StatOverviewCard
              title="任职管理"
              stats={[
                { label: '待入职', value: '0 人' },
                { label: '在职', value: '104 人' },
                { label: '试用中', value: '5 人' },
                { label: '离职中', value: '4 人' },
                { label: '已离职', value: '0 人' },
                { label: '调岗中', value: '0 人' },
              ]}
            />
            <StatOverviewCard
              title="合同签署"
              stats={[
                { label: '待发起续签', value: '7 单', accent: true },
                { label: '即将到期', value: '69 单', accent: true },
                { label: '签署中', value: '12 单' },
                { label: '近期未签', value: '6 单' },
                { label: '补签待处理', value: '0 单' },
                { label: '转签待处理', value: '0 单' },
              ]}
            />
          </div>

          <Surface style={{ padding: '14px 14px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>人事提醒</div>
              <div style={{ fontSize: '11px', color: colors.textMuted }}>更新时间：{todayISO()} 14:29　切换　刷新</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, paddingTop: 4 }}>
              {[
                ['合同到期提醒', '0 条'],
                ['转正提醒', '0 人'],
                ['进群提醒', '48 人'],
                ['身份证过期提醒', '0 人'],
                ['账号停用提醒', '0 人'],
                ['内推状态提醒', '0 人'],
                ['花名册字段缺失', '0 项'],
                ['档案信息缺失', '0 项'],
                ['电子签章异常', '0 项'],
                ['证照到期提醒', '0 项'],
              ].map(item => (
                <div key={item[0]} style={{ minHeight: 58, borderTop: `1px solid ${colors.tableBorder}`, paddingTop: 10 }}>
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: 8 }}>{item[0]}</div>
                  <div style={{ fontSize: '18px', color: colors.text, fontWeight: 700 }}>{item[1]}</div>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SidePanel title="异常处理" extra={<CircleHelp size={14} style={{ color: colors.textMuted }} />}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0 2px' }}>
              <CircleAlert size={16} style={{ color: colors.primary, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', color: colors.text }}>权限范围内有 2 人的工号与手机号未补全</div>
                <button style={{ marginTop: 8, border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer', padding: 0 }}>去处理 &gt;</button>
              </div>
            </div>
          </SidePanel>

          <SidePanel title="产品动态" extra={<button style={{ border: 'none', background: 'transparent', color: colors.textMuted, fontSize: '12px', cursor: 'pointer' }}>更多 &gt;</button>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['产品迭代更新说明（员工管理 2026 年 1 月）', '2026-03-19'],
                ['产品迭代更新说明（员工管理 2025 年 12 月）', '2026-01-19'],
                ['入职材料新增附件指引', '2025-11-25'],
              ].map(item => (
                <div key={item[0]} style={{ paddingBottom: 10, borderBottom: `1px solid ${colors.tableBorder}` }}>
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: colors.text }}>{item[0]}</div>
                  <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: 6 }}>{item[1]}</div>
                </div>
              ))}
            </div>
          </SidePanel>

          <Surface style={{ padding: '16px', background: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.14)}, ${withAlpha('#6EC0D0', 0.18)})`, overflow: 'hidden', position: 'relative' }}>
            <div style={{ maxWidth: 148, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: colors.primary, marginBottom: 6 }}>电子合同全面升级啦！</div>
              <div style={{ fontSize: '12px', lineHeight: 1.7, color: colors.textMuted, marginBottom: 10 }}>支持批量签署、签章提醒与材料归档，继续沿用当前系统的配色与后台表达。</div>
              <button style={{ height: 28, padding: '0 12px', borderRadius: 999, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' }}>了解更多</button>
            </div>
            <div style={{ position: 'absolute', right: 10, bottom: 6, width: 118, height: 70, borderRadius: 18, background: withAlpha('#6EC0D0', 0.2), transform: 'skewX(-18deg)' }} />
            <div style={{ position: 'absolute', right: 30, bottom: 18, width: 86, height: 52, borderRadius: 14, backgroundColor: '#fff', border: `1px solid ${withAlpha(colors.primary, 0.18)}` }} />
          </Surface>
        </div>
      </div>
    </ModuleWorkspace>
  );
}

export function RecruitManagementPage() {
  const { colors } = useTheme();

  return (
    <ModuleWorkspace sidebarTitle="招聘管理" contentTitle="招聘概览" sidebarItems={[{ label: '招聘概览', active: true }]}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 292px', gap: 16 }}>
        <Surface style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.16)}, ${withAlpha(colors.primary, 0.06)})`, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={24} />
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>Moka 招聘</div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: 4 }}>开通后，将标准化平台能力接入当前人事薪税后台，统一管理。</div>
              </div>
            </div>
            <button style={{ height: 30, padding: '0 14px', borderRadius: 6, border: `1px solid ${colors.inputBorder}`, backgroundColor: 'transparent', fontSize: '12px', color: colors.textMuted, cursor: 'pointer' }}>开通 Moka</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { icon: <Building2 size={16} />, title: '企业授权', desc: '授权公司主体用于开通招聘模块' },
              { icon: <UserPlus size={16} />, title: '注册企业用户', desc: '建立招聘账户并同步管理员信息' },
              { icon: <LayoutGrid size={16} />, title: '进入 Moka', desc: '将企业招聘主页快捷接入到当前系统' },
            ].map(item => (
              <div key={item.title} style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 10, padding: '14px 14px 12px', backgroundColor: colors.tableHeaderBg }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: withAlpha(colors.primary, 0.12), color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                title: '高效流程协作',
                desc: '从职位发布到面试推进，围绕当前系统的管理表达，统一沉淀招聘协作流程。',
                accent: colors.primary,
              },
              {
                title: '定制化人才库',
                desc: '个性化人才管理库、简历筛选流、沉淀候选人资产，助力形成招聘复用能力。',
                accent: '#C38C62',
              },
            ].map(block => (
              <div key={block.title} style={{ border: `1px solid ${colors.tableBorder}`, borderRadius: 12, padding: '18px 18px 16px', display: 'grid', gridTemplateColumns: '1fr 180px', gap: 18, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: colors.text, marginBottom: 8 }}>{block.title}</div>
                  <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.8 }}>{block.desc}</div>
                </div>
                <IllustrationCard accent={block.accent}>
                  <div style={{ position: 'absolute', left: 20, top: 18, width: 86, height: 58, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.06)' }} />
                  <div style={{ position: 'absolute', right: 18, bottom: 18, width: 72, height: 40, borderRadius: 10, backgroundColor: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                  <div style={{ position: 'absolute', left: 34, top: 32, width: 44, height: 7, borderRadius: 999, backgroundColor: withAlpha(block.accent, 0.35) }} />
                  <div style={{ position: 'absolute', left: 34, top: 48, width: 62, height: 6, borderRadius: 999, backgroundColor: withAlpha(colors.textMuted, 0.18) }} />
                </IllustrationCard>
              </div>
            ))}
          </div>
        </Surface>

        <SidePanel title="常见问题" extra={<button style={{ border: 'none', background: 'transparent', color: colors.textMuted, fontSize: '12px', cursor: 'pointer' }}>更多 &gt;</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              '如何创建招聘职位或发布电子化卡片？',
              '交互式手机邀约怎么开启？',
              'Moka 简历导入如何授权？',
              '如何开启组织架构同步？',
              '如何管理招聘人员？',
            ].map(question => (
              <div key={question} style={{ display: 'flex', gap: 8, paddingBottom: 10, borderBottom: `1px solid ${colors.tableBorder}` }}>
                <CircleHelp size={14} style={{ color: colors.primary, marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '12px', lineHeight: 1.7, color: colors.text }}>{question}</div>
              </div>
            ))}
          </div>
        </SidePanel>
      </div>
    </ModuleWorkspace>
  );
}

export function OrganizationManagementPage() {
  const { colors } = useTheme();

  return (
    <ModuleWorkspace
      sidebarTitle="组织管理"
      sidebarItems={[
        { label: '组织架构', active: true },
        { label: '班组管理' },
        { label: '岗位管理' },
        { label: '职位管理' },
        { label: '汇报管理' },
        { label: '组织管理员设置' },
      ]}
    >
      <Surface style={{ minHeight: 'calc(100vh - 92px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 48%, ${withAlpha(colors.primary, 0.08)}, transparent 38%)` }} />
        <div style={{ position: 'relative', width: 420, height: 320 }}>
          <div style={{ position: 'absolute', left: 76, bottom: 30, width: 270, height: 160, borderRadius: 120, backgroundColor: withAlpha(colors.primary, 0.08) }} />
          <div style={{ position: 'absolute', left: 136, top: 52, width: 12, height: 40, borderRadius: 12, backgroundColor: withAlpha(colors.primary, 0.24) }} />
          <div style={{ position: 'absolute', left: 122, top: 72, width: 40, height: 28, backgroundColor: withAlpha(colors.primary, 0.22), clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', left: 118, top: 110, width: 176, height: 116, borderRadius: 18, backgroundColor: '#fff', border: `2px solid ${withAlpha(colors.primary, 0.28)}`, boxShadow: '0 16px 34px rgba(0,0,0,0.05)' }} />
          <div style={{ position: 'absolute', left: 136, top: 128, width: 140, height: 18, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.12) }} />
          <div style={{ position: 'absolute', left: 136, top: 158, width: 62, height: 54, borderRadius: 10, backgroundColor: withAlpha(colors.primary, 0.1) }} />
          <div style={{ position: 'absolute', left: 208, top: 158, width: 56, height: 24, borderRadius: 8, backgroundColor: withAlpha(colors.textMuted, 0.12) }} />
          <div style={{ position: 'absolute', left: 208, top: 190, width: 56, height: 22, borderRadius: 8, backgroundColor: withAlpha(colors.textMuted, 0.12) }} />
          <div style={{ position: 'absolute', left: 190, top: 226, width: 34, height: 10, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.2) }} />
          <div style={{ position: 'absolute', left: 108, bottom: 20, width: 196, height: 8, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.18) }} />
          <div style={{ position: 'absolute', left: 92, bottom: 46, width: 18, height: 28, borderRadius: '0 0 10px 10px', border: `2px solid ${withAlpha(colors.primary, 0.22)}`, borderTop: 'none' }} />
          <div style={{ position: 'absolute', left: 88, bottom: 38, width: 26, height: 8, borderRadius: 999, backgroundColor: withAlpha(colors.primary, 0.12) }} />
          <div style={{ position: 'absolute', right: 68, bottom: 36, width: 42, height: 52, borderRadius: 10, backgroundColor: '#fff', border: `1px solid ${withAlpha(colors.primary, 0.18)}`, transform: 'rotate(8deg)' }} />
          <div style={{ position: 'absolute', right: 56, bottom: 28, width: 42, height: 52, borderRadius: 10, backgroundColor: '#fff', border: `1px solid ${withAlpha(colors.primary, 0.14)}`, transform: 'rotate(-5deg)' }} />
        </div>
      </Surface>
    </ModuleWorkspace>
  );
}

export function EmployeeModuleHomePage() {
  return <EmployeeManagementPage />;
}
