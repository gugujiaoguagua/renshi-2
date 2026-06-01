export const REMOVED_ORGANIZATION_SECTIONS = [
  'architecture',
  'staffing',
  'job-titles',
  'settings',
] as const;

export const REMOVED_EMPLOYEE_VIEWS = [
  'care',
  'reports',
  'reportsNew',
  'borrowed',
  'tempStore',
  'tempStoreRecords',
  'contractApproval',
  'esignSettings',
  'blacklist',
  'customPrint',
  'templates',
  'thirdParty',
] as const;

export const REMOVED_SETTING_VIEWS = [
  'overview',
  'mobile-clock',
  'location',
  'devices',
  'holiday',
] as const;

export const ATTENDANCE_ROUTE_REDIRECTS: Record<string, string> = {
  'attendance/work-data': '/attendance/home',
  'attendance/reports': '/attendance/home',
  'attendance/external-data': '/attendance/home',
  'external-data-management': '/attendance/home',
  'attendance/anomaly-biz': '/attendance/home',
  'attendance/overtime': '/attendance/home',
  'attendance/overtime-flow': '/attendance/home',
  'attendance/schedule-adjust': '/attendance/home',
  'attendance/schedule-history': '/attendance/home',
  'attendance/leave': '/attendance/home',
  'attendance/leave-balance': '/attendance/home',
  'attendance/leave-detail': '/attendance/home',
  'attendance/leave-plan': '/attendance/home',
  'attendance/leave-scheme': '/attendance/home',
  'attendance/settings': '/attendance/settings/groups',
  'attendance/settings/mobile-clock': '/attendance/settings/groups',
  'attendance/settings/location': '/attendance/settings/groups',
  'attendance/settings/devices': '/attendance/settings/groups',
  'attendance/settings/review': '/attendance/settings/groups',
  'attendance/settings/holiday': '/attendance/settings/groups',
};

export function isRemovedOrganizationSection(section?: string) {
  return REMOVED_ORGANIZATION_SECTIONS.includes(section as any);
}

export function isRemovedEmployeeView(view?: string) {
  return REMOVED_EMPLOYEE_VIEWS.includes(view as any);
}

export function isRemovedSettingView(view?: string) {
  return REMOVED_SETTING_VIEWS.includes(view as any);
}
