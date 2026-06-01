import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Building2, CalendarCheck2, RefreshCw, UserRoundCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchAttendanceFoundation,
  fetchEmployeeFoundation,
  fetchOrganizationFoundation,
  type DomainFoundationSnapshot,
} from '../../api/realData';

type DomainKey = 'organization' | 'employee' | 'attendance';

type DomainState = Record<DomainKey, DomainFoundationSnapshot | null>;

type DomainConfig = {
  key: DomainKey;
  label: string;
  path: string;
  icon: React.ReactNode;
  metricKeys: Array<{ label: string; keys: string[] }>;
  warningKeys: string[];
};

const EMPTY_STATE: DomainState = {
  organization: null,
  employee: null,
  attendance: null,
};

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith('#')) return color;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function numberFrom(snapshot: DomainFoundationSnapshot | null, keys: string[]) {
  for (const key of keys) {
    const value = snapshot?.summary?.[key];
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return 0;
}

function warningTotal(snapshot: DomainFoundationSnapshot | null, keys: string[]) {
  return keys.reduce((total, key) => {
    const value = snapshot?.quality?.[key];
    if (Array.isArray(value)) return total + value.length;
    const numberValue = typeof value === 'number' ? value : Number(value);
    return total + (Number.isFinite(numberValue) ? numberValue : 0);
  }, 0);
}

export function DomainLinkagePanel({ focus }: { focus: DomainKey }) {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [state, setState] = useState<DomainState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [organization, employee, attendance] = await Promise.all([
        fetchOrganizationFoundation(),
        fetchEmployeeFoundation(),
        fetchAttendanceFoundation(),
      ]);
      setState({ organization, employee, attendance });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const configs = useMemo<DomainConfig[]>(() => [
    {
      key: 'organization',
      label: '组织',
      path: '/organization',
      icon: <Building2 size={15} />,
      metricKeys: [
        { label: '组织', keys: ['organizationTotal'] },
        { label: '岗位', keys: ['positionTotal'] },
        { label: '挂员工', keys: ['linkedEmployeeTotal'] },
      ],
      warningKeys: ['orphanOrganizations', 'unlinkedPositionTotal', 'unlinkedRankTotal'],
    },
    {
      key: 'employee',
      label: '员工',
      path: '/employee/roster',
      icon: <UserRoundCheck size={15} />,
      metricKeys: [
        { label: '员工', keys: ['employeeTotal'] },
        { label: '在职', keys: ['active'] },
        { label: '入职', keys: ['onboarded'] },
      ],
      warningKeys: ['organizationUnlinkedTotal', 'positionUnlinkedTotal', 'rankUnlinkedTotal', 'managerUnlinkedTotal'],
    },
    {
      key: 'attendance',
      label: '考勤',
      path: '/attendance/settings/people',
      icon: <CalendarCheck2 size={15} />,
      metricKeys: [
        { label: '人员', keys: ['attendancePeopleTotal', 'employeeTotal'] },
        { label: '考勤组', keys: ['attendanceGroupTotal'] },
        { label: '月汇总', keys: ['monthlySummaryTotal'] },
      ],
      warningKeys: ['storedScheduleUnlinkedTotal', 'storedClockUnlinkedTotal', 'storedDailyUnlinkedTotal', 'storedMonthlySummaryUnlinkedTotal'],
    },
  ], []);

  const flowText = state.organization?.domainFlow || state.employee?.domainFlow || state.attendance?.domainFlow || '组织 -> 员工 -> 考勤';

  return (
    <div
      data-testid="domain-linkage-panel"
      style={{
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 8,
        background: colors.cardBg,
        marginBottom: 10,
        padding: '10px 12px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>业务主线</div>
        <div style={{ fontSize: 12, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flowText.replace(' -> 薪酬', '')}</div>
        <button
          type="button"
          onClick={load}
          title="刷新关联数据"
          style={{ marginLeft: 'auto', width: 26, height: 24, borderRadius: 5, border: `1px solid ${colors.cardBorder}`, background: 'transparent', color: colors.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, alignItems: 'stretch' }}>
        {configs.map((item) => {
          const snapshot = state[item.key];
          const warnTotal = warningTotal(snapshot, item.warningKeys);
          const active = focus === item.key;
          return (
            <button
              key={item.key}
              data-testid={`domain-linkage-${item.key}`}
              type="button"
              onClick={() => navigate(item.path)}
              style={{
                minWidth: 0,
                minHeight: 70,
                border: `1px solid ${active ? colors.primary : colors.cardBorder}`,
                borderRadius: 7,
                background: active ? withAlpha(colors.primary, 0.06) : colors.appBg,
                color: colors.text,
                textAlign: 'left',
                padding: '8px 9px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ color: active ? colors.primary : colors.textMuted, display: 'flex' }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? colors.primary : colors.text }}>{item.label}</span>
                {warnTotal ? (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, color: colors.primary, fontSize: 11 }}>
                    <AlertTriangle size={12} />{warnTotal}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 5 }}>
                {item.metricKeys.map(metric => (
                  <div key={metric.label} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, lineHeight: '18px', fontWeight: 700, color: colors.text }}>{loading ? '-' : numberFrom(snapshot, metric.keys)}</div>
                    <div style={{ fontSize: 11, lineHeight: '16px', color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{metric.label}</div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {error ? <div style={{ marginTop: 8, fontSize: 12, color: colors.primary }}>关联数据加载失败：{error}</div> : null}
    </div>
  );
}
