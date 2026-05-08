import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import AttendanceStats from './pages/AttendanceStats';
import DailyAttendanceStats from './pages/DailyAttendanceStats';
import MonthlyAttendanceStats from './pages/MonthlyAttendanceStats';
import MonthlyAttendanceSummary from './pages/MonthlyAttendanceSummary';
import AnomalyManagement from './pages/AnomalyManagement';
import ClockInRecords from './pages/ClockInRecords';
import OvertimeManagement from './pages/OvertimeManagement';
import FieldWork from './pages/FieldWork';
import ScheduleManagement from './pages/ScheduleManagement';
import LeaveManagement from './pages/LeaveManagement';
import AttendanceSettings from './pages/AttendanceSettings';
import Home from './pages/Home';
import UnderDevelopment from './pages/UnderDevelopment';
import WorkData from './pages/WorkData';
import ExternalDataManagement from './pages/ExternalDataManagement';
import StatItemsManagement from './pages/StatItemsManagement';
import {
  EmployeeManagementPage,
  OrganizationManagementPage,
  PayrollPage,
  RecruitManagementPage,
} from './pages/BusinessModules';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: UnderDevelopment },
      { path: 'tender', Component: UnderDevelopment },
      { path: 'organization', Component: OrganizationManagementPage },
      { path: 'recruit', Component: RecruitManagementPage },
      { path: 'employee', Component: EmployeeManagementPage },
      { path: 'payroll', Component: PayrollPage },
      { path: 'apps', Component: UnderDevelopment },
      { path: 'attendance', element: <Navigate to="/attendance/stats" replace /> },
      { path: 'attendance/home', Component: Home },
      { path: 'attendance/stats', Component: AttendanceStats },
      { path: 'attendance/daily-stats', Component: DailyAttendanceStats },
      { path: 'attendance/monthly-stats',   Component: MonthlyAttendanceStats },
      { path: 'attendance/monthly-detail',  Component: MonthlyAttendanceStats },
      { path: 'attendance/monthly-summary', Component: MonthlyAttendanceSummary },
      { path: 'attendance/work-data',       Component: WorkData },
      { path: 'attendance/reports',         Component: UnderDevelopment },
      { path: 'attendance/stat-items',      Component: StatItemsManagement },
      { path: 'attendance/external-data',   Component: ExternalDataManagement },
      { path: 'attendance/anomaly', Component: AnomalyManagement },
      { path: 'attendance/anomaly-biz', Component: AnomalyManagement },
      { path: 'attendance/clock-records', Component: ClockInRecords },
      { path: 'attendance/clock-makeup', Component: ClockInRecords },
      { path: 'attendance/clock-field', Component: ClockInRecords },
      { path: 'attendance/clock-photo', Component: ClockInRecords },
      { path: 'attendance/clock-move', element: <Navigate to="/attendance/clock-photo" replace /> },
      { path: 'attendance/overtime', Component: OvertimeManagement },
      { path: 'attendance/overtime-flow', element: <Navigate to="/attendance/overtime" replace /> },
      { path: 'attendance/field-out', Component: FieldWork },
      { path: 'attendance/field-trip', Component: FieldWork },
      { path: 'attendance/schedule', Component: ScheduleManagement },
      { path: 'attendance/schedule-adjust', Component: ScheduleManagement },
      { path: 'attendance/schedule-history', element: <Navigate to="/attendance/schedule-adjust" replace /> },
      { path: 'attendance/leave', Component: LeaveManagement },
      { path: 'attendance/leave-balance', Component: LeaveManagement },
      { path: 'attendance/leave-detail', Component: LeaveManagement },
      { path: 'attendance/leave-plan', element: <Navigate to="/attendance/leave-detail" replace /> },
      { path: 'attendance/leave-type', Component: LeaveManagement },
      { path: 'attendance/leave-scheme', Component: LeaveManagement },
      { path: 'attendance/settings', Component: AttendanceSettings },
      { path: 'attendance/settings/:sub', Component: AttendanceSettings },
    ],
  },
]);