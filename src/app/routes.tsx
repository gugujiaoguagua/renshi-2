import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import AttendanceStats from './pages/AttendanceStats';
import DailyAttendanceStats from './pages/DailyAttendanceStats';
import MonthlyAttendanceStats from './pages/MonthlyAttendanceStats';
import MonthlyAttendanceSummary from './pages/MonthlyAttendanceSummary';
import AnomalyManagement from './pages/AnomalyManagement';
import ClockInRecords from './pages/ClockInRecords';
import FieldWork from './pages/FieldWork';
import ScheduleManagement from './pages/ScheduleManagement';
import LeaveManagement from './pages/LeaveManagement';
import AttendanceSettings from './pages/AttendanceSettings';
import Home from './pages/Home';
import UnderDevelopment from './pages/UnderDevelopment';
import StatItemsManagement from './pages/StatItemsManagement';
import OrganizationManagementPage from './pages/OrganizationManagement';
import SalaryCalculation from './pages/SalaryCalculation';
import {
  EmployeeManagementPage,
  PayrollPage,
  RecruitManagementPage,
} from './pages/BusinessModules';
import {
  ATTENDANCE_ROUTE_REDIRECTS,
  REMOVED_ORGANIZATION_SECTIONS,
} from './shared/navigation/visibilityPolicy';

const organizationRedirectRoutes = REMOVED_ORGANIZATION_SECTIONS.map((section) => ({
  path: `organization/${section}`,
  element: <Navigate to="/organization" replace />,
}));

const attendanceRedirectRoutes = Object.entries(ATTENDANCE_ROUTE_REDIRECTS).map(([path, target]) => ({
  path,
  element: <Navigate to={target} replace />,
}));

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <Navigate to="/attendance/home" replace /> },
      { path: 'tender', Component: UnderDevelopment },
      { path: 'organization', Component: OrganizationManagementPage },
      ...organizationRedirectRoutes,
      { path: 'organization/:section', Component: OrganizationManagementPage },
      { path: 'recruit', Component: RecruitManagementPage },
      { path: 'employee', Component: EmployeeManagementPage },
      { path: 'employee/:section', Component: EmployeeManagementPage },
      { path: 'payroll', Component: PayrollPage },
      { path: 'salary-calculation', Component: SalaryCalculation },
      { path: 'apps', Component: UnderDevelopment },
      { path: 'attendance', element: <Navigate to="/attendance/home" replace /> },
      { path: 'attendance/home', Component: Home },
      { path: 'attendance/stats', Component: AttendanceStats },
      { path: 'attendance/daily-stats', Component: DailyAttendanceStats },
      { path: 'attendance/monthly-stats',   Component: MonthlyAttendanceStats },
      { path: 'attendance/monthly-detail',  Component: MonthlyAttendanceStats },
      { path: 'attendance/monthly-summary', Component: MonthlyAttendanceSummary },
      { path: 'attendance/stat-items',      Component: StatItemsManagement },
      { path: 'attendance/anomaly', Component: AnomalyManagement },
      { path: 'attendance/clock-records', Component: ClockInRecords },
      { path: 'attendance/clock-makeup', Component: ClockInRecords },
      { path: 'attendance/clock-field', Component: ClockInRecords },
      { path: 'attendance/clock-photo', Component: ClockInRecords },
      { path: 'attendance/clock-move', element: <Navigate to="/attendance/clock-photo" replace /> },
      { path: 'attendance/field-out', Component: FieldWork },
      { path: 'attendance/field-trip', Component: FieldWork },
      { path: 'attendance/schedule', Component: ScheduleManagement },
      { path: 'attendance/leave-type', Component: LeaveManagement },
      ...attendanceRedirectRoutes,
      { path: 'attendance/settings/:sub', Component: AttendanceSettings },
    ],
  },
]);
