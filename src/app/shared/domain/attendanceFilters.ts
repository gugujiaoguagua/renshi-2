import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAttendanceFilterOptions,
  type AttendanceFilterEmployee,
  type AttendanceFilterOptionsResponse,
} from '../../api/realData';

export type LinkedAttendanceFilters = {
  dept?: string;
  attendGroup?: string;
  shift?: string;
  employeeStatus?: string;
  keyword?: string;
};

export type AttendanceLikeRow = {
  name?: string;
  employeeName?: string;
  applicant?: string;
  empId?: string;
  employeeNo?: string;
  applicantId?: string;
  dept?: string;
  department?: string;
  applicantDept?: string;
  deptFull?: string;
  deptFullPath?: string;
  departmentFullPath?: string;
  attendGroup?: string;
  attendanceGroupName?: string;
  shift?: string;
  shiftName?: string;
  employeeStatus?: string;
  status?: string;
};

export type AttendanceFilterDirectory = {
  loading: boolean;
  error: string;
  generatedAt: string;
  employees: AttendanceFilterEmployee[];
  employeeByNo: Map<string, AttendanceFilterEmployee>;
  departmentOptions: string[];
  attendanceGroupOptions: string[];
  shiftOptions: string[];
  employeeStatusOptions: string[];
  findEmployee: (row: AttendanceLikeRow) => AttendanceFilterEmployee | null;
  matchesDepartment: (row: AttendanceLikeRow, selectedDepartment: string) => boolean;
  matchesEmployeeStatus: (row: AttendanceLikeRow, selectedStatus: string) => boolean;
  matchesLinkedFilters: (row: AttendanceLikeRow, filters: LinkedAttendanceFilters) => boolean;
};

const EMPTY_RESPONSE: AttendanceFilterOptionsResponse = {
  ok: false,
  generatedAt: '',
  domainFlow: '组织 -> 员工 -> 考勤',
  departments: [],
  attendanceGroups: [],
  shifts: [],
  employeeStatuses: [],
  employees: [],
};

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function uniqueTexts(values: unknown[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function rowEmployeeNo(row: AttendanceLikeRow) {
  return cleanText(row.employeeNo || row.empId || row.applicantId);
}

function rowName(row: AttendanceLikeRow) {
  return cleanText(row.name || row.employeeName || row.applicant);
}

function rowDepartment(row: AttendanceLikeRow) {
  return cleanText(row.dept || row.department || row.applicantDept);
}

function rowDepartmentPath(row: AttendanceLikeRow) {
  return cleanText(row.deptFullPath || row.deptFull || row.departmentFullPath || rowDepartment(row));
}

function rowAttendanceGroup(row: AttendanceLikeRow) {
  return cleanText(row.attendanceGroupName || row.attendGroup);
}

function rowShift(row: AttendanceLikeRow) {
  return cleanText(row.shiftName || row.shift);
}

function rowStatus(row: AttendanceLikeRow) {
  return cleanText(row.employeeStatus || row.status);
}

function departmentMatchesValue(rowDept: string, rowPath: string, selected: string) {
  if (!selected) return true;
  if (rowDept === selected || rowPath === selected) return true;
  if (rowPath && selected && rowPath.startsWith(`${selected}/`)) return true;
  if (rowPath.includes(selected)) return true;
  if (rowDept && selected.endsWith(`/${rowDept}`)) return true;
  return false;
}

function employeeStatusMatches(value: string, selected: string) {
  if (!selected) return true;
  if (selected === '已入职') return value === '已入职' || value === '已转正' || value === '在职';
  if (selected === '未入职') return value === '待入职' || value === '未入职' || !value;
  if (selected === '在职') return !/离职|放弃/.test(value);
  return value === selected || value.includes(selected);
}

export function useAttendanceFilterDirectory(): AttendanceFilterDirectory {
  const [data, setData] = useState<AttendanceFilterOptionsResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAttendanceFilterOptions()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setData(EMPTY_RESPONSE);
        setError(String(err?.message || err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const employeeByNo = useMemo(
    () => new Map(data.employees.map(employee => [cleanText(employee.employeeNo), employee])),
    [data.employees],
  );

  const findEmployee = useCallback((row: AttendanceLikeRow) => {
    const employeeNo = rowEmployeeNo(row);
    if (employeeNo && employeeByNo.has(employeeNo)) return employeeByNo.get(employeeNo) || null;
    const name = rowName(row);
    const dept = rowDepartment(row);
    if (!name) return null;
    return data.employees.find(employee => employee.name === name && (!dept || employee.department === dept || employee.deptFullPath.includes(dept))) || null;
  }, [data.employees, employeeByNo]);

  const matchesDepartment = useCallback((row: AttendanceLikeRow, selectedDepartment: string) => {
    if (!selectedDepartment) return true;
    const employee = findEmployee(row);
    const dept = employee?.department || rowDepartment(row);
    const path = employee?.deptFullPath || rowDepartmentPath(row);
    return departmentMatchesValue(dept, path, selectedDepartment);
  }, [findEmployee]);

  const matchesEmployeeStatus = useCallback((row: AttendanceLikeRow, selectedStatus: string) => {
    if (!selectedStatus) return true;
    const employee = findEmployee(row);
    return employeeStatusMatches(employee?.employeeStatus || rowStatus(row), selectedStatus);
  }, [findEmployee]);

  const matchesLinkedFilters = useCallback((row: AttendanceLikeRow, filters: LinkedAttendanceFilters) => {
    const employee = findEmployee(row);
    const keyword = cleanText(filters.keyword).toLowerCase();
    const searchableName = employee?.name || rowName(row);
    const searchableNo = employee?.employeeNo || rowEmployeeNo(row);
    const group = employee?.attendanceGroupName || rowAttendanceGroup(row);
    const shift = employee?.shiftName || rowShift(row);
    return (!keyword || searchableName.toLowerCase().includes(keyword) || searchableNo.toLowerCase().includes(keyword))
      && matchesDepartment(row, cleanText(filters.dept))
      && (!filters.attendGroup || group === filters.attendGroup)
      && (!filters.shift || shift === filters.shift)
      && matchesEmployeeStatus(row, cleanText(filters.employeeStatus));
  }, [findEmployee, matchesDepartment, matchesEmployeeStatus]);

  return {
    loading,
    error,
    generatedAt: data.generatedAt,
    employees: data.employees,
    employeeByNo,
    departmentOptions: uniqueTexts([
      ...data.departments.map(item => item.fullPath || item.name),
      ...data.employees.map(employee => employee.deptFullPath || employee.department),
    ]),
    attendanceGroupOptions: uniqueTexts([
      ...data.attendanceGroups.map(item => item.name),
      ...data.employees.map(employee => employee.attendanceGroupName),
    ]),
    shiftOptions: uniqueTexts([
      ...data.shifts.map(item => item.name),
      ...data.employees.map(employee => employee.shiftName),
    ]),
    employeeStatusOptions: uniqueTexts([...data.employeeStatuses, ...data.employees.map(employee => employee.employeeStatus)]),
    findEmployee,
    matchesDepartment,
    matchesEmployeeStatus,
    matchesLinkedFilters,
  };
}

