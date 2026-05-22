import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Bell, HelpCircle, Grid3X3, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const topTabs = [
  { label: '组织管理', path: '/organization' },
  { label: '招聘管理', path: '/recruit' },
  { label: '员工管理', path: '/employee' },
  { label: '考勤管理', path: '/attendance' },
  { label: '电子工资单', path: '/payroll' },
];

export const TopNav: React.FC = () => {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isAttendance = location.pathname.startsWith('/attendance') || location.pathname === '/';

  return (
    <div
      style={{
        backgroundColor: colors.topNavBg,
        borderBottom: `1px solid rgba(255,255,255,0.08)`,
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        zIndex: 100,
        position: 'relative',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: '200px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px',
          gap: '8px',
          flexShrink: 0,
          borderRight: `1px solid rgba(255,255,255,0.08)`,
          height: '100%',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #AA2B3A, #C94D5A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          人
        </div>
        <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          人事薪税
        </span>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: '100%', overflowX: 'auto' }}>
        {topTabs.map((tab) => {
          const isActive = tab.path === '/attendance'
            ? location.pathname.startsWith('/attendance')
            : tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path === '/attendance' ? '/attendance/stats' : tab.path)}
              style={{
                height: '100%',
                padding: '0 14px',
                fontSize: '13px',
                color: isActive ? colors.topNavActiveTab : colors.topNavText,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${colors.topNavActiveBorder}` : '2px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '16px', flexShrink: 0 }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            color: colors.topNavText,
            cursor: 'pointer',
            marginRight: '8px',
          }}
        >
          <Search size={12} />
          <span>输入关键字、问题</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: 'none',
            background: 'rgba(255,255,255,0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.topNavText,
            transition: 'background 0.2s',
          }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        <button
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.topNavText,
          }}
        >
          <Bell size={14} />
        </button>
        <button
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.topNavText,
          }}
        >
          <HelpCircle size={14} />
        </button>
        <button
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.topNavText,
          }}
        >
          <Grid3X3 size={14} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: '8px',
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.1)',
          }}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#AA2B3A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            李
          </div>
          <span style={{ fontSize: '12px', color: colors.topNavText }}>李文文</span>
        </div>
      </div>
    </div>
  );
};
