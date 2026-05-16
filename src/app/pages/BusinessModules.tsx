import React from 'react';
import { todayISO } from '../utils/date';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  CreditCard,
  FileText,
  Folders,
  LayoutGrid,
  Network,
  Sparkles,
  Users,
  UserPlus,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type SidebarItem = {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  arrow?: boolean;
};

type ModuleWorkspaceProps = {
  sidebarTitle: string;
  contentTitle?: string;
  sidebarItems: SidebarItem[];
  sidebarWidth?: number;
  children: React.ReactNode;
};

type Tone = 'primary' | 'soft' | 'warning';

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
        {sidebarItems.map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px',
              cursor: 'default',
              fontSize: '13px',
              color: item.active ? '#FFFFFF' : colors.sidebarText,
              backgroundColor: item.active ? colors.sidebarActiveBg : 'transparent',
              transition: 'background 0.15s',
              borderLeft: item.active ? '3px solid rgba(255,255,255,0.4)' : '3px solid transparent',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ flexShrink: 0, opacity: item.active ? 1 : 0.82, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: item.active ? 600 : 400 }}>
              {item.label}
            </span>
            {item.arrow ? (
              <span style={{ flexShrink: 0, opacity: item.active ? 0.86 : 0.6, display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={12} />
              </span>
            ) : null}
          </div>
        ))}
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

export function EmployeeManagementPage() {
  const { colors } = useTheme();

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
