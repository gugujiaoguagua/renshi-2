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
  '/attendance/anomaly-biz': ['异常管理', '业务异常'],
  '/attendance/clock-records': ['打卡记录', '原始打卡记录'],
  '/attendance/clock-makeup': ['打卡记录', '补卡记录'],
  '/attendance/clock-field': ['打卡记录', '外勤记录'],
  '/attendance/clock-photo': ['打卡记录', '拍照打卡记录'],
  '/attendance/clock-move': ['打卡记录', '拍照打卡记录'],
  '/attendance/overtime': ['加班管理', '加班记录'],
  '/attendance/overtime-flow': ['加班管理', '加班记录'],
  '/attendance/field-out': ['外勤管理', '外出记录'],
  '/attendance/field-trip': ['外勤管理', '出差记录'],
  '/attendance/schedule': ['排班管理', '排班表'],
  '/attendance/schedule-adjust': ['排班管理', '班次调整记录'],
  '/attendance/schedule-history': ['排班管理', '班次调整记录'],
  '/attendance/leave': ['假期管理', '请假记录'],
  '/attendance/leave-balance': ['假期管理', '假期余额'],
  '/attendance/leave-detail': ['假期管理', '假期额度明细'],
  '/attendance/leave-plan': ['假期管理', '假期额度明细'],
  '/attendance/leave-type': ['假期管理', '假期类型设置'],
  '/attendance/leave-scheme': ['假期管理', '假期方案设置'],
  '/attendance/settings': ['考勤设置', '配置总览'],
  '/attendance/settings/groups': ['考勤设置', '考勤组管理'],
  '/attendance/settings/shifts': ['考勤设置', '班次管理'],
  '/attendance/settings/rules': ['考勤设置', '班次管理'],
  '/attendance/settings/people': ['考勤设置', '考勤人员'],
  '/attendance/settings/card-rules': ['考勤设置', '打卡规则'],
  '/attendance/settings/card': ['考勤设置', '打卡规则'],
  '/attendance/settings/mobile-clock': ['考勤设置', '移动打卡方案'],
  '/attendance/settings/location': ['考勤设置', '上班地点'],
  '/attendance/settings/face': ['考勤设置', '人脸管理'],
  '/attendance/settings/devices': ['考勤设置', '考勤机管理'],
  '/attendance/settings/review': ['考勤设置', '考勤机管理'],
  '/attendance/settings/holiday': ['考勤设置', '节假日管理'],
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
