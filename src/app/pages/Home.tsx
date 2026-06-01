import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { downloadAttendanceXlsx } from '../shared/export/attendanceExport';
import { currentDateLabel, currentWeekdayLabel, monthEndISO, monthStartISO } from '../utils/date';
import { BarChart2, AlertTriangle, MapPin, Calendar, Umbrella, Settings, Download } from 'lucide-react';
import { fetchAttendanceEmployees, type AttendanceEmployee } from '../api/realData';

const quickCards = [
  { icon: <BarChart2 size={22} />, title: '实时统计', desc: '查看今日考勤实时数据', path: '/attendance/stats', color: '#AA2B3A' },
  { icon: <AlertTriangle size={22} />, title: '考勤异常', desc: '处理员工考勤异常记录', path: '/attendance/anomaly', color: '#D97706' },
  { icon: <MapPin size={22} />, title: '外勤管理', desc: '外出及出差记录', path: '/attendance/field-out', color: '#059669' },
  { icon: <Calendar size={22} />, title: '排班管理', desc: '员工排班与调班', path: '/attendance/schedule', color: '#0EA5E9' },
  { icon: <Umbrella size={22} />, title: '假期类型设置', desc: '维护假期类型与规则', path: '/attendance/leave-type', color: '#EC4899' },
  { icon: <Settings size={22} />, title: '考勤组管理', desc: '配置考勤规则与方案', path: '/attendance/settings/groups', color: '#64748B' },
];

function hasClockValue(value: string) {
  return Boolean(value && value !== '-');
}

function isActiveEmployee(emp: AttendanceEmployee) {
  return !['待入职', '未入职', '已离职', '离职'].includes(String(emp.employeeStatus || ''));
}

function isRestEmployee(emp: AttendanceEmployee) {
  return emp.status === '休息' || emp.attendance === '休息';
}

function isPresentEmployee(emp: AttendanceEmployee) {
  return emp.attendance === '已出勤'
    || emp.status === '已出勤'
    || emp.status === '正常'
    || hasClockValue(emp.cin1)
    || hasClockValue(emp.cout1)
    || hasClockValue(emp.cin2)
    || hasClockValue(emp.cout2)
    || hasClockValue(emp.cin3)
    || hasClockValue(emp.cout3);
}

function isMissingClockEmployee(emp: AttendanceEmployee) {
  return emp.status === '未打卡'
    || emp.attendance === '未出勤'
    || String(emp.anomaly || '').includes('未打卡')
    || String(emp.anomaly || '').includes('缺卡');
}

function isAnomalyEmployee(emp: AttendanceEmployee) {
  const status = String(emp.status || '');
  const anomaly = String(emp.anomaly || '');
  return ['迟到', '旷工', '早退', '异常', '未打卡', '未排班'].some((keyword) => status.includes(keyword) || anomaly.includes(keyword))
    || (anomaly && anomaly !== '-');
}

export default function Home() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [attendanceRows, setAttendanceRows] = useState<AttendanceEmployee[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');
  const monthStartLabel = monthStartISO().replace(/-/g, '年').replace(/年(\d{2})年/, '年$1月') + '日';
  const monthEndLabel = monthEndISO().replace(/-/g, '年').replace(/年(\d{2})年/, '年$1月') + '日';

  useEffect(() => {
    let cancelled = false;
    setIsLoadingStats(true);
    fetchAttendanceEmployees()
      .then((res) => {
        if (cancelled) return;
        setAttendanceRows(res.rows || []);
        setStatsError('');
      })
      .catch(() => {
        if (cancelled) return;
        setAttendanceRows([]);
        setStatsError('真实数据连接失败');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStats(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const activeRows = attendanceRows.filter(isActiveEmployee);
    const shouldRows = activeRows.filter((emp) => !isRestEmployee(emp));
    const presentCount = shouldRows.filter(isPresentEmployee).length;
    const anomalyCount = shouldRows.filter(isAnomalyEmployee).length;
    const missingClockCount = shouldRows.filter(isMissingClockEmployee).length;
    return [
      { label: '今日应出勤', value: String(shouldRows.length), unit: '人', note: statsError || (isLoadingStats ? '读取中' : '实时数据'), positive: !statsError },
      { label: '已出勤', value: String(presentCount), unit: '人', note: statsError || (isLoadingStats ? '读取中' : '实时数据'), positive: !statsError },
      { label: '考勤异常', value: String(anomalyCount), unit: '条', note: statsError || (isLoadingStats ? '读取中' : '实时数据'), positive: !statsError },
      { label: '未打卡', value: String(missingClockCount), unit: '人', note: statsError || (isLoadingStats ? '读取中' : '实时数据'), positive: !statsError },
    ];
  }, [attendanceRows, isLoadingStats, statsError]);
  const handleExport = () => {
    void downloadAttendanceXlsx({
      fileName: `考勤首页统计-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: '首页统计',
      headers: ['指标', '数值', '单位', '说明'],
      rows: stats.map(item => [item.label, item.value, item.unit, item.note]),
      allowEmpty: true,
    });
  };

  return (
    <div style={{ padding: '20px 24px', overflow: 'auto' }}>
      {/* Welcome */}
      <div
        style={{
          background: `linear-gradient(135deg, #28314E 0%, #3D4F6E 100%)`,
          borderRadius: '12px',
          padding: '24px 32px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '300px', opacity: 0.1 }}>
          <div style={{ width: '250px', height: '250px', borderRadius: '50%', border: '50px solid #AA2B3A', position: 'absolute', right: '-80px', top: '-80px' }} />
          <div style={{ width: '150px', height: '150px', borderRadius: '50%', border: '30px solid #F1E6D8', position: 'absolute', right: '100px', bottom: '-60px' }} />
        </div>
        <div>
          <div style={{ color: '#F1E6D8', fontSize: '12px', marginBottom: '6px', opacity: 0.8 }}>欢迎使用 · 人事薪税</div>
          <div style={{ color: '#fff', fontSize: '22px', fontWeight: 600, marginBottom: '4px' }}>上海拉迷家具有限公司</div>
          <div style={{ color: '#D0C5B5', fontSize: '13px' }}>今天是 {currentDateLabel()} {currentWeekdayLabel()} · 考勤管理中心</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ color: '#F1E6D8', fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>当前考勤周期</div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{monthStartLabel} — {monthEndLabel}</div>
          <button
            onClick={handleExport}
            style={{ marginTop: 12, padding: '6px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <Download size={13}/>导出Excel
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: '8px',
              border: `1px solid ${colors.cardBorder}`,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px' }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: colors.text }}>{s.value}</span>
              <span style={{ fontSize: '12px', color: colors.textMuted }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: '11px', color: s.positive ? '#059669' : '#EF4444', marginTop: '4px' }}>
              {s.note}
            </div>
          </div>
        ))}
      </div>

      {/* Quick access */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '12px' }}>快捷入口</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {quickCards.map((card, i) => (
            <div
              key={i}
              onClick={() => navigate(card.path)}
              style={{
                backgroundColor: colors.cardBg,
                borderRadius: '8px',
                border: `1px solid ${colors.cardBorder}`,
                padding: '16px',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: card.color + '18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '4px' }}>{card.title}</div>
                <div style={{ fontSize: '11px', color: colors.textMuted }}>{card.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ backgroundColor: colors.cardBg, borderRadius: '8px', border: `1px solid ${colors.cardBorder}`, padding: '16px 20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '12px' }}>最近异常记录</div>
        {[].map((item: { name: string; type: string; dept: string; time: string; color: string }, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 0',
              borderBottom: i < 4 ? `1px solid ${colors.tableBorder}` : 'none',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: colors.primary + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                color: colors.primary,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {item.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: colors.text }}>{item.name}</span>
                <span
                  style={{
                    padding: '1px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    backgroundColor: item.color + '20',
                    color: item.color,
                  }}
                >
                  {item.type}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>{item.dept}</div>
            </div>
            <div style={{ fontSize: '11px', color: colors.textMuted, flexShrink: 0 }}>{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
