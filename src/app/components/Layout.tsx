import React from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { ChevronRight } from 'lucide-react';

const breadcrumbMap: Record<string, string[]> = {
  '/attendance/stats': ['首页', '实时统计'],
  '/attendance/daily-stats': ['考勤统计', '日考勤统计'],
  '/attendance/monthly-stats': ['考勤统计', '月考勤统计'],
  '/attendance/monthly-detail': ['考勤统计', '月考勤明细'],
  '/attendance/monthly-summary': ['考勤统计', '月考勤汇总'],
  '/attendance/anomaly': ['异常管理', '考勤异常'],
  '/attendance/clock-field': ['打卡记录', '外勤记录'],
  '/attendance/field-out': ['外勤管理', '外出记录'],
  '/attendance/field-trip': ['外勤管理', '出差记录'],
  '/attendance/schedule': ['排班管理', '排班表'],
  '/attendance/leave-type': ['假期管理', '假期类型设置'],
  '/attendance/settings/groups': ['考勤设置', '考勤组管理'],
  '/attendance/settings/shifts': ['考勤设置', '班次管理'],
  '/attendance/settings/rules': ['考勤设置', '班次管理'],
  '/attendance/settings/people': ['考勤设置', '考勤人员'],
  '/attendance/settings/card-rules': ['考勤设置', '打卡规则'],
  '/attendance/settings/card': ['考勤设置', '打卡规则'],
  '/attendance/settings/face': ['考勤设置', '人脸管理'],
  '/attendance/settings/calendar': ['考勤设置', '司历管理'],
  '/attendance/settings/overtime-rules': ['考勤设置', '加班规则'],
  '/attendance/settings/field-rules': ['考勤设置', '外勤规则'],
  '/attendance/settings/stat-schemes': ['考勤设置', '统计方案'],
  '/attendance/home': ['首页'],
};

export const Layout: React.FC = () => {
  const { colors } = useTheme();
  const location = useLocation();

  const isAttendance = location.pathname.startsWith('/attendance');
  const isEmployeeBackend = location.pathname.startsWith('/employee');
  const crumbs = breadcrumbMap[location.pathname] || (isAttendance ? ['首页'] : []);

  if (isEmployeeBackend) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.appBg,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: '13px',
        }}
      >
        <TopNav />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.appBg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: '13px',
      }}
    >
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — only shown in attendance module */}
        {isAttendance && <Sidebar />}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Breadcrumb bar — only shown in attendance module */}
          {isAttendance && crumbs.length > 0 && (
            <div
              style={{
                backgroundColor: colors.cardBg,
                borderBottom: `1px solid ${colors.cardBorder}`,
                padding: '0 16px',
                minHeight: '36px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {crumbs.map((crumb, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {i > 0 && <ChevronRight size={12} style={{ color: colors.textMuted }} />}
                  <span
                    style={{
                      fontSize: '12px',
                      color: i === crumbs.length - 1 ? colors.text : colors.textMuted,
                      fontWeight: i === crumbs.length - 1 ? 500 : 400,
                    }}
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Main content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              backgroundColor: colors.appBg,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
