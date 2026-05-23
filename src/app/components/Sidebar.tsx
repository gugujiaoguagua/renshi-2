import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Home, BarChart2, AlertTriangle, Clock, Coffee, MapPin,
  Calendar, Umbrella, Settings, ChevronRight, ChevronDown,
  ClipboardList, TrendingUp, FileText, Database, ExternalLink,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { key: 'home', label: '首页', icon: <Home size={14} />, path: '/attendance/home' },
  {
    key: 'stats', label: '考勤统计', icon: <BarChart2 size={14} />,
    children: [
      { key: 'stats-realtime', label: '实时统计',     path: '/attendance/stats' },
      { key: 'stats-daily',    label: '日考勤统计',   path: '/attendance/daily-stats' },
      { key: 'stats-detail',   label: '月考勤明细',   path: '/attendance/monthly-detail' },
      { key: 'stats-summary',  label: '月考勤汇总',   path: '/attendance/monthly-summary' },
      { key: 'stats-work',     label: '勤务数据',     path: '/attendance/work-data' },
      { key: 'stats-report',   label: '考勤报表',     path: '/attendance/reports' },
      { key: 'stats-items',    label: '统计项管理',   path: '/attendance/stat-items' },
      { key: 'stats-external', label: '外部数据管理', path: '/attendance/external-data' },
    ],
  },
  {
    key: 'anomaly', label: '异常管理', icon: <AlertTriangle size={14} />,
    children: [
      { key: 'anomaly-list', label: '考勤异常', path: '/attendance/anomaly' },
      { key: 'anomaly-biz', label: '业务异常', path: '/attendance/anomaly-biz' },
    ],
  },
  {
    key: 'clock', label: '打卡记录', icon: <Clock size={14} />,
    children: [
      { key: 'clock-records', label: '原始打卡记录', path: '/attendance/clock-records' },
      { key: 'clock-makeup', label: '补卡记录', path: '/attendance/clock-makeup' },
      { key: 'clock-field', label: '外勤记录', path: '/attendance/clock-field' },
      { key: 'clock-photo', label: '拍照打卡记录', path: '/attendance/clock-photo' },
    ],
  },
  {
    key: 'overtime', label: '加班管理', icon: <Coffee size={14} />,
    children: [
      { key: 'overtime-records', label: '加班记录', path: '/attendance/overtime' },
    ],
  },
  {
    key: 'field', label: '外勤管理', icon: <MapPin size={14} />,
    children: [
      { key: 'field-out', label: '外出记录', path: '/attendance/field-out' },
      { key: 'field-trip', label: '出差记录', path: '/attendance/field-trip' },
    ],
  },
  {
    key: 'schedule', label: '排班管理', icon: <Calendar size={14} />,
    children: [
      { key: 'schedule-table', label: '排班表', path: '/attendance/schedule' },
      { key: 'schedule-records', label: '班次调整记录', path: '/attendance/schedule-adjust' },
    ],
  },
  {
    key: 'leave', label: '假期管理', icon: <Umbrella size={14} />,
    children: [
      { key: 'leave-records', label: '请假记录', path: '/attendance/leave' },
      { key: 'leave-balance', label: '假期余额', path: '/attendance/leave-balance' },
      { key: 'leave-detail', label: '假期额度明细', path: '/attendance/leave-detail' },
      { key: 'leave-type', label: '假期类型设置', path: '/attendance/leave-type' },
      { key: 'leave-scheme', label: '假期方案设置', path: '/attendance/leave-scheme' },
    ],
  },
  {
    key: 'setting', label: '考勤设置', icon: <Settings size={14} />,
    children: [
      { key: 'setting-config', label: '配置总览', path: '/attendance/settings' },
      { key: 'setting-group', label: '考勤组管理', path: '/attendance/settings/groups' },
      { key: 'setting-shifts', label: '班次管理', path: '/attendance/settings/shifts' },
      { key: 'setting-people', label: '考勤人员', path: '/attendance/settings/people' },
      { key: 'setting-card', label: '打卡规则', path: '/attendance/settings/card-rules' },
      { key: 'setting-mobile', label: '移动打卡方案', path: '/attendance/settings/mobile-clock' },
      { key: 'setting-location', label: '上班地点', path: '/attendance/settings/location' },
      { key: 'setting-face', label: '人脸管理', path: '/attendance/settings/face' },
      { key: 'setting-device', label: '考勤机管理', path: '/attendance/settings/devices' },
      { key: 'setting-holiday', label: '节假日管理', path: '/attendance/settings/holiday' },
      { key: 'setting-calendar', label: '司历管理', path: '/attendance/settings/calendar' },
      { key: 'setting-overtime', label: '加班规则', path: '/attendance/settings/overtime-rules' },
      { key: 'setting-field', label: '外勤规则', path: '/attendance/settings/field-rules' },
      { key: 'setting-stats', label: '统计方案', path: '/attendance/settings/stat-schemes' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const getDefaultExpanded = () => {
    const expanded: Record<string, boolean> = {};
    menuItems.forEach(item => {
      if (item.children) {
        const hasActive = item.children.some(c => c.path && location.pathname.startsWith(c.path));
        if (hasActive) expanded[item.key] = true;
      }
    });
    return expanded;
  };

  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>(getDefaultExpanded);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div
      style={{
        width: '180px',
        minWidth: '180px',
        backgroundColor: colors.sidebarBg,
        height: '100%',
        overflowY: 'auto',
        flexShrink: 0,
        borderRight: `1px solid ${colors.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {menuItems.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedKeys[item.key];
        const groupHasActive = hasChildren && item.children!.some(c => isActive(c.path));

        return (
          <div key={item.key}>
            {/* Parent Item */}
            <div
              onClick={() => {
                if (hasChildren) {
                  toggleExpand(item.key);
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                color: groupHasActive ? '#FFFFFF' : colors.sidebarText,
                backgroundColor: groupHasActive && !hasChildren
                  ? colors.sidebarActiveBg
                  : groupHasActive ? 'rgba(170, 43, 58, 0.15)' : 'transparent',
                transition: 'background 0.15s',
                borderLeft: groupHasActive ? `3px solid ${colors.sidebarActiveBg}` : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!groupHasActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.sidebarHover;
              }}
              onMouseLeave={e => {
                if (!groupHasActive) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ flexShrink: 0, opacity: 0.8 }}>{item.icon}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
              {hasChildren && (
                <span style={{ flexShrink: 0, opacity: 0.6, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <ChevronRight size={12} />
                </span>
              )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
              <div
                style={{
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                }}
              >
                {item.children!.map((child) => {
                  const active = isActive(child.path);
                  return (
                    <div
                      key={child.key}
                      onClick={() => child.path && navigate(child.path)}
                      style={{
                        padding: '8px 14px 8px 36px',
                        fontSize: '12px',
                        color: active ? colors.sidebarActiveText : colors.sidebarMuted,
                        backgroundColor: active ? colors.sidebarActiveBg : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        borderLeft: active ? `3px solid rgba(255,255,255,0.4)` : '3px solid transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.sidebarHover;
                          (e.currentTarget as HTMLDivElement).style.color = colors.sidebarText;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLDivElement).style.color = colors.sidebarMuted;
                        }
                      }}
                    >
                      {child.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
