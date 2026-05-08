import React from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { BarChart2, AlertTriangle, Clock, Coffee, MapPin, Calendar, Umbrella, Settings, TrendingUp, Users, FileText } from 'lucide-react';

const quickCards = [
  { icon: <BarChart2 size={22} />, title: '实时统计', desc: '查看今日考勤实时数据', path: '/attendance/stats', color: '#AA2B3A' },
  { icon: <AlertTriangle size={22} />, title: '考勤异常', desc: '处理员工考勤异常记录', path: '/attendance/anomaly', color: '#D97706' },
  { icon: <Clock size={22} />, title: '打卡记录', desc: '查看员工打卡明细', path: '/attendance/clock-records', color: '#2563EB' },
  { icon: <Coffee size={22} />, title: '加班管理', desc: '管理员工加班记录', path: '/attendance/overtime', color: '#7C3AED' },
  { icon: <MapPin size={22} />, title: '外勤管理', desc: '外出及出差记录', path: '/attendance/field-out', color: '#059669' },
  { icon: <Calendar size={22} />, title: '排班管理', desc: '员工排班与调班', path: '/attendance/schedule', color: '#0EA5E9' },
  { icon: <Umbrella size={22} />, title: '假期管理', desc: '请假申请与假期余额', path: '/attendance/leave', color: '#EC4899' },
  { icon: <Settings size={22} />, title: '考勤设置', desc: '配置考勤规则与方案', path: '/attendance/settings', color: '#64748B' },
];

const stats = [
  { label: '今日应出勤', value: '1027', unit: '人', change: '+3', positive: true },
  { label: '已出勤', value: '4', unit: '人', change: '+1', positive: true },
  { label: '考勤异常', value: '22', unit: '条', change: '+5', positive: false },
  { label: '未打卡', value: '983', unit: '人', change: '-12', positive: true },
];

export default function Home() {
  const { colors } = useTheme();
  const navigate = useNavigate();

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
          <div style={{ color: '#fff', fontSize: '22px', fontWeight: 600, marginBottom: '4px' }}>上海拉达家具有限公司</div>
          <div style={{ color: '#D0C5B5', fontSize: '13px' }}>今天是 2026年05月08日 星期五 · 考勤管理中心</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ color: '#F1E6D8', fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>当前考勤周期</div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>2026年05月01日 — 2026年05月31日</div>
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
              {s.change} 较昨日
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
        {[
          { name: '李俊', type: '漏打卡', dept: '加盟售后部', time: '2026-05-07 09:05', color: '#F59E0B' },
          { name: '杨绍涵', type: '迟到 15分钟', dept: '加盟售后部', time: '2026-05-07 08:45', color: '#EF4444' },
          { name: '王秀芬', type: '早退', dept: '综合人员', time: '2026-05-06 17:20', color: '#8B5CF6' },
          { name: '张芸通', type: '未打卡', dept: '华旺大厦', time: '2026-05-06 09:00', color: '#6B7280' },
          { name: '郑伟楷', type: '漏打卡', dept: 'PMC部', time: '2026-05-05 18:30', color: '#F59E0B' },
        ].map((item, i) => (
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
