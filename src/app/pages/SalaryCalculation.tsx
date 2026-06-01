import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  Download,
  GripVertical,
  Layers3,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import {
  fetchMonthlySummaryEmployees,
  fetchEmployeeRoster,
  fetchOrganizationPositions,
  fetchOrganizations,
  fetchPayrollFoundation,
  fetchSalaryCalculationState,
  saveSalaryCalculationState,
  type MonthlySummaryEmployee,
  type EmployeeRosterRecord,
  type OrganizationPositionRecord,
  type OrganizationRecord,
type SalaryCalculationState,
} from '../api/realData';

type PayrollRow = {
  id: number;
  employeeNo?: string;
  employeeName?: string;
  displayEmployeeName?: string;
  dept?: string;
  department?: string;
  deptFullPath?: string;
  group?: '管理岗' | '销售设计岗';
  sourceType?: 'management' | 'consultant' | 'designer';
  month: number;
  position: string;
  should: number;
  actual: number;
  annual: number;
  monthly: number;
  fixed: number;
  base: number;
  overtime: number;
  perfStd: number;
  paymentPerf?: number | null;
  orderPerf?: number | null;
  refundPerf?: number | null;
  supportPerf?: number | null;
  orderSuccessPerf?: number | null;
  installSuccessPerf?: number | null;
  dailyPerf?: number | null;
  samplePerf?: number | null;
  developmentPerf?: number | null;
  communityPerf?: number | null;
  otherPerformance?: number | null;
  perfActual: number;
  quarterPerf?: number | null;
  other?: number | null;
  sick?: number | null;
  late?: number | null;
  annualBonus?: number | null;
  gross: number;
  social: number;
  fund: number;
  tax?: number | null;
  net: number;
  sickDays?: number | null;
  annualLeaveDays?: number | null;
  arrangedAnnualLeaveDays?: number | null;
  paidLeaveDays?: number | null;
  salesCommission?: number | null;
  otherCommission?: number | null;
  salaryBase?: number | null;
  phoneSubsidy?: number | null;
  housingSubsidy?: number | null;
  trafficSubsidy?: number | null;
  guaranteeSalary?: number | null;
  afterSaleDeduction?: number | null;
  orderDeduction?: number | null;
  lateDeduction?: number | null;
  otherDeduction?: number | null;
  fixedOtherAmount?: number | null;
  retroAmount?: number | null;
  holidaySubsidy?: number | null;
  designCommission?: number | null;
  renderAmount?: number | null;
  specialFee?: number | null;
  orderAuditDeduction?: number | null;
  productBonus?: number | null;
  customDeduction?: number | null;
};

type CalculatedRow = PayrollRow & {
  calcMonthly: number;
  calcBase: number;
  calcOvertime: number;
  calcPerfStd: number;
  calcPerfActual: number;
  calcGross: number;
  calcNet: number;
  grossDiff: number;
  netDiff: number;
  passed: boolean;
};

type SheetColumn = {
  key: string;
  label: string;
  topLabel?: string;
  bottomLabel?: string;
  formula?: string;
  width?: number;
  get: (row: CalculatedRow) => React.ReactNode;
};

type RuleFieldConfig = {
  key: string;
  label: string;
  groupTop?: string;
  groupSub?: string;
  groupId?: string;
  source: string;
  formula: string;
  op1: '' | '+' | '-' | '*' | '/';
  value1: string;
  op2: '' | '+' | '-' | '*' | '/';
  value2: string;
  order?: number;
  custom?: boolean;
  deleted?: boolean;
};

type RuleFieldRow = RuleFieldConfig & {
  baseColumn?: SheetColumn;
};

type RuleTemplate = {
  id: string;
  name: string;
  group: '管理岗' | '销售设计岗';
  position: string;
  fieldCount: number;
  dept?: string;
  custom?: boolean;
};

type TemplateAssignment = {
  templateId: string;
  position: string;
  employeeKeys: string[];
  categoryId?: string;
};

type AssignmentEmployeeOption = {
  key: string;
  employeeName: string;
  position: string;
  dept?: string;
  department?: string;
  deptFullPath?: string;
};

type TemplatePreviewView = {
  templateId: string;
  position: string;
} | null;

type DepartmentCategory = {
  id: string;
  name: string;
};

type PeopleDataRow = EmployeeRosterRecord & {
  peopleKey: string;
  actualWorkDaysForSalary: number;
  squareForSalary: number;
};

type PeopleDataOverride = {
  square?: number;
};

const SOURCE_SHEET = '管理店长+设计总监+区域督导+小区运营';
const PAYROLL_GROUP = '管理岗' as const;
const PAYROLL_GROUP_LABEL = '全部岗位';
const UNCATEGORIZED_CATEGORY_ID = '__uncategorized__';
const TEMPLATE_PAGE_SIZE = 20;
const PEOPLE_DATA_PAGE_SIZE = 20;
const CONFIG_ITEM_OPTIONS = ['月份', '门店', '部门', '岗位', '应出勤天数', '实际出勤天数', '平方', '薪资'] as const;
const SALARY_STATE_SCHEMA_VERSION = 'real-flow-v2';
const LEGACY_LOCAL_STORAGE_KEYS = [
  'salary-calculation-formula-rules-v1',
  'salary-calculation-field-config-v1',
  'salary-calculation-rule-templates-v1',
  'salary-calculation-template-assignments-v1',
];

function payrollGroupLabel(group: PayrollRow['group']) {
  return group === PAYROLL_GROUP ? PAYROLL_GROUP_LABEL : group;
}

const performanceKeys: (keyof PayrollRow)[] = [
  'paymentPerf',
  'orderPerf',
  'refundPerf',
  'supportPerf',
  'orderSuccessPerf',
  'installSuccessPerf',
  'dailyPerf',
  'samplePerf',
  'developmentPerf',
  'communityPerf',
  'otherPerformance',
];

function val(value: number | null | undefined) {
  return Number(value ?? 0);
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function deptForPosition(position: string) {
  if (position === '家居顾问' || position === '队长') return '销售设计部';
  if (position === '全屋设计师' || position === '产品设计师') return '设计部';
  if (position === '管理型店长' || position === '设计总监') return '门店管理部';
  if (position === '区域督导') return '运营督导部';
  return '小区运营部';
}

function normalizeDeptFullPath(value: string | undefined) {
  return String(value || '').replace(/^上海拉迷家具有限公司\//, '');
}

function departmentForSummary(row: Pick<MonthlySummaryEmployee, 'dept' | 'deptFullPath'>) {
  const path = normalizeDeptFullPath(row.deptFullPath);
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return row.dept || '';
}

function periodToPayrollMonth(period?: unknown) {
  const text = String(period || '').replace(/-/g, '');
  if (/^\d{6}$/.test(text)) return Number(text);
  const now = new Date();
  return Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
}

function monthlySummaryToPayrollRow(row: MonthlySummaryEmployee, index: number, month: number): PayrollRow {
  return {
    id: index + 1,
    employeeNo: row.empId,
    employeeName: row.name,
    displayEmployeeName: row.name,
    dept: row.dept,
    department: departmentForSummary(row),
    deptFullPath: normalizeDeptFullPath(row.deptFullPath),
    group: PAYROLL_GROUP,
    sourceType: 'management',
    month,
    position: row.position || '未配置岗位',
    should: Number(row.shouldWorkDays || 0),
    actual: Number(row.actualWorkDays || 0),
    annual: 0,
    monthly: 0,
    fixed: 0,
    base: 0,
    overtime: 0,
    perfStd: 0,
    perfActual: 0,
    gross: 0,
    social: 0,
    fund: 0,
    tax: 0,
    net: 0,
  };
}

function enrichPayrollRows(rows: PayrollRow[]) {
  return rows.map((row, index) => {
    return {
      ...row,
      group: row.group || '管理岗',
      sourceType: row.sourceType || 'management',
      id: row.id || index + 1,
      employeeName: row.employeeName?.trim() || undefined,
      dept: row.dept || deptForPosition(row.position),
      department: row.department || row.dept || deptForPosition(row.position),
      deptFullPath: row.deptFullPath || row.dept || '',
    };
  });
}

function formatMonthValue(month: number) {
  const text = String(month);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
}

function todayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateInputValue(value: unknown) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return '';
}

function rowMonthDateValue(row: Pick<PayrollRow, 'month'>) {
  const text = String(row.month);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-01`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function excelCellValue(value: React.ReactNode) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(excelCellValue).filter(Boolean).join('');
  return '';
}

function normalizeXlsxFileName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim() || '导出数据';
  return /\.xlsx$/i.test(cleaned) ? cleaned : `${cleaned}.xlsx`;
}

function normalizeXlsxSheetName(name: string) {
  return (name.replace(/[\\/?*\[\]:]/g, '').trim() || '数据').slice(0, 31);
}

function xlsxColumnWidth(values: unknown[]) {
  const maxLength = values.reduce((max, value) => {
    const text = String(value ?? '').replace(/\n/g, ' ');
    const units = Array.from(text).reduce((sum, char) => sum + (/[ -~]/.test(char) ? 0.6 : 1), 0);
    return Math.max(max, units);
  }, 8);
  return { wch: Math.min(Math.max(Math.ceil(maxLength) + 3, 10), 32) };
}

function xlsxHorizontalMerges(headerRows: unknown[][]) {
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  headerRows.forEach((row, rowIndex) => {
    let start = 0;
    while (start < row.length) {
      const value = String(row[start] ?? '').trim();
      let end = start;
      while (end + 1 < row.length && String(row[end + 1] ?? '').trim() === value) end += 1;
      if (value && end > start) merges.push({ s: { r: rowIndex, c: start }, e: { r: rowIndex, c: end } });
      start = end + 1;
    }
  });
  return merges;
}

async function downloadXlsxWorkbook({
  fileName,
  sheets,
  saveAs = false,
}: {
  fileName: string;
  sheets: Array<{ name: string; rows: unknown[][]; merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> }>;
  saveAs?: boolean;
}) {
  const safeFileName = normalizeXlsxFileName(fileName);
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    const columnCount = Math.max(0, ...sheet.rows.map((row) => row.length));
    worksheet['!cols'] = Array.from({ length: columnCount }, (_, index) => xlsxColumnWidth(sheet.rows.map((row) => row[index])));
    if (sheet.merges?.length) worksheet['!merges'] = sheet.merges;
    XLSX.utils.book_append_sheet(workbook, worksheet, normalizeXlsxSheetName(sheet.name));
  });
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer | Uint8Array;
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  if (!bytes.byteLength) {
    throw new Error('生成的 Excel 内容为空');
  }
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (saveAs) {
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker !== 'function') {
      throw new Error('当前浏览器不支持选择保存位置');
    }
    let saveHandle: any = null;
    try {
      saveHandle = await picker({
        suggestedName: safeFileName,
        types: [{
          description: 'Excel 工作簿',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        }],
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') return 'cancelled' as const;
      throw error;
    }
    let writable: any = null;
    try {
      writable = await saveHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return 'saved' as const;
    } catch (error) {
      try {
        await writable?.abort?.();
      } catch {
        // Ignore abort failures; caller will report the save failure.
      }
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded' as const;
}

function excelRound(value: number) {
  return Math.round(value);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function calcAttendancePart(row: PayrollRow, rate: number) {
  const fixedPart = row.fixed * rate;
  if (row.month === 202602 && (row.position === '管理型店长' || row.position === '设计总监')) {
    return fixedPart + (fixedPart / 26) * (row.actual - row.should);
  }
  if (row.position === '管理型店长' || row.position === '设计总监') {
    return (fixedPart / row.should) * row.actual;
  }
  return Math.min(fixedPart, (fixedPart / row.should) * row.actual);
}

function calculateRow(row: PayrollRow): CalculatedRow {
  if (row.sourceType === 'consultant') {
    const attendanceDays = val(row.actual) + val(row.sickDays) + val(row.annualLeaveDays) + val(row.arrangedAnnualLeaveDays) + val(row.paidLeaveDays) - row.should;
    const adjustedDays = Math.abs(attendanceDays) < 0.0001 ? 0 : attendanceDays;
    const attendanceAmount = excelRound((adjustedDays - val(row.sickDays)) * 100 + (2740 / 26) * val(row.sickDays) * 0.6);
    const commissionTotal = excelRound(val(row.salesCommission) + val(row.otherCommission));
    const guaranteeGap = val(row.salaryBase) + val(row.phoneSubsidy) + commissionTotal < val(row.guaranteeSalary)
      ? val(row.guaranteeSalary) - val(row.salaryBase) - val(row.phoneSubsidy) - commissionTotal
      : 0;
    const deductions = val(row.afterSaleDeduction) + val(row.orderDeduction) + val(row.lateDeduction) + val(row.otherDeduction);
    const otherItems = val(row.fixedOtherAmount) + val(row.retroAmount) + val(row.holidaySubsidy);
    const calcGross = round2(attendanceAmount + commissionTotal + val(row.salaryBase) + val(row.phoneSubsidy) + guaranteeGap - deductions + otherItems);
    const calcNet = round2(calcGross - val(row.social) - val(row.fund) - val(row.tax));
    const grossDiff = round2(calcGross - row.gross);
    const netDiff = round2(calcNet - row.net);

    return {
      ...row,
      calcMonthly: 0,
      calcBase: attendanceAmount,
      calcOvertime: 0,
      calcPerfStd: val(row.guaranteeSalary),
      calcPerfActual: commissionTotal,
      calcGross,
      calcNet,
      grossDiff,
      netDiff,
      passed: Math.abs(grossDiff) <= 1 && Math.abs(netDiff) <= 1,
    };
  }

  if (row.sourceType === 'designer') {
    const attendanceDays = val(row.actual) + val(row.sickDays) + val(row.annualLeaveDays) + val(row.arrangedAnnualLeaveDays) + val(row.paidLeaveDays) - row.should;
    const adjustedDays = Math.abs(attendanceDays) < 0.0001 ? 0 : attendanceDays;
    const attendanceAmount = excelRound((adjustedDays - val(row.sickDays)) * 100 + (2740 / 26) * val(row.sickDays) * 0.6);
    const guaranteeGap = val(row.designCommission) + val(row.salaryBase) + val(row.housingSubsidy) + val(row.trafficSubsidy) < val(row.guaranteeSalary)
      ? val(row.guaranteeSalary) - val(row.designCommission) - val(row.salaryBase) - val(row.housingSubsidy) - val(row.trafficSubsidy)
      : 0;
    const otherTotal = -val(row.lateDeduction) + val(row.holidaySubsidy) + val(row.otherDeduction) - val(row.afterSaleDeduction) + val(row.customDeduction);
    const bonusTotal = val(row.renderAmount) * 0.004 + val(row.specialFee) * 0.2 - val(row.orderAuditDeduction) + val(row.productBonus);
    const calcGross = round2(attendanceAmount + val(row.designCommission) + val(row.salaryBase) + val(row.housingSubsidy) + val(row.trafficSubsidy) + guaranteeGap + otherTotal + bonusTotal);
    const calcNet = round2(calcGross - val(row.social) - val(row.fund) - val(row.tax));
    const grossDiff = round2(calcGross - row.gross);
    const netDiff = round2(calcNet - row.net);

    return {
      ...row,
      calcMonthly: 0,
      calcBase: attendanceAmount,
      calcOvertime: 0,
      calcPerfStd: val(row.guaranteeSalary),
      calcPerfActual: round2(bonusTotal),
      calcGross,
      calcNet,
      grossDiff,
      netDiff,
      passed: Math.abs(grossDiff) <= 1 && Math.abs(netDiff) <= 1,
    };
  }

  const calcMonthly = excelRound(row.annual / 12);
  const calcBase = excelRound(calcAttendancePart(row, 0.2));
  const calcOvertime = excelRound(calcAttendancePart(row, 0.8));
  const calcPerfStd = calcMonthly - row.fixed;
  const calcPerfActual = performanceKeys.reduce((sum, key) => sum + val(row[key] as number | null | undefined), 0);
  const calcGross = excelRound(
    calcBase +
    calcOvertime +
    calcPerfActual +
    val(row.quarterPerf) +
    val(row.other) +
    val(row.annualBonus) -
    val(row.late) +
    val(row.sick),
  );
  const calcNet = excelRound(calcGross - val(row.social) - val(row.fund) - val(row.tax));
  const grossDiff = calcGross - row.gross;
  const netDiff = calcNet - row.net;

  return {
    ...row,
    calcMonthly,
    calcBase,
    calcOvertime,
    calcPerfStd,
    calcPerfActual,
    calcGross,
    calcNet,
    grossDiff,
    netDiff,
    passed: Math.abs(grossDiff) <= 1 && Math.abs(netDiff) <= 1,
  };
}

function money(value: number | null | undefined) {
  return val(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function rowKey(row: PayrollRow) {
  return `${row.group || '管理岗'}-${row.sourceType || 'management'}-${row.id}`;
}

function assignmentPersonKey(row: PayrollRow) {
  if (row.employeeNo) return row.employeeNo;
  const employeeName = row.employeeName?.trim();
  return employeeName ? `${employeeName}::${row.position}::${row.dept || ''}` : rowKey(row);
}

function peopleDataKey(row: Pick<EmployeeRosterRecord, 'employeeNo' | 'name' | 'position' | 'dept'>) {
  const employeeNo = String(row.employeeNo || '').trim();
  if (employeeNo) return employeeNo;
  return `${String(row.name || '').trim()}::${String(row.position || '').trim()}::${String(row.dept || '').trim()}`;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number(value.toFixed(2));
  return value;
}

const emptyFormula = '该字段目前为输入项或空列，暂无系统公式。';

function columnTitle(column: SheetColumn) {
  return column.bottomLabel || column.topLabel || column.label || '空表头';
}

function withHeaderRows(columns: SheetColumn[], topHeaders: string[], bottomHeaders: string[]) {
  return columns.map((column, index) => ({
    ...column,
    topLabel: topHeaders[index] ?? '',
    bottomLabel: bottomHeaders[index] ?? '',
    label: bottomHeaders[index] || topHeaders[index] || column.label,
  }));
}

const managementSheetColumns: SheetColumn[] = [
  { key: 'month', label: '月份', get: row => row.month },
  { key: 'employeeName', label: '姓名', get: row => row.employeeName || row.displayEmployeeName || '' },
  { key: 'position', label: '岗位', get: row => row.position },
  { key: 'dept', label: '门店', get: row => row.dept || '' },
  { key: 'department', label: '部门', get: row => row.department || row.dept || '' },
  { key: 'account', label: '账号', get: () => '' },
  { key: 'should', label: '应出勤天数', get: row => row.should },
  { key: 'actual', label: '实际出勤天数', get: row => row.actual },
  { key: 'annual', label: '年薪标准', get: row => row.annual },
  { key: 'monthly', label: '月薪资标准', formula: '=ROUND(年薪标准/12,0)', get: row => row.calcMonthly },
  { key: 'fixed', label: '月固定薪资标准', get: row => row.fixed },
  { key: 'base', label: '基本工资', formula: '固定薪资*20%按出勤折算，区域/运营岗封顶。', get: row => row.calcBase },
  { key: 'overtime', label: '加班工资', formula: '固定薪资*80%按出勤折算，区域/运营岗封顶。', get: row => row.calcOvertime },
  { key: 'perfStd', label: '月度绩效考核金额标准', formula: '月薪资标准-月固定薪资标准', get: row => row.calcPerfStd },
  { key: 'paymentTarget', label: '回款目标', get: row => displayValue((row as any).paymentTarget) },
  { key: 'paymentActual', label: '回款完成', get: row => displayValue((row as any).paymentActual) },
  { key: 'paymentRate', label: '回款目标完成率', formula: '回款完成/回款目标', get: row => displayValue((row as any).paymentRate) },
  { key: 'paymentPerf', label: '回款目标完成率绩效', formula: '按岗位绩效权重和完成率分档计算。', get: row => displayValue(row.paymentPerf) },
  { key: 'orderTarget', label: '目标订单数', get: row => displayValue((row as any).orderTarget) },
  { key: 'orderActual', label: '实际订单数', get: row => displayValue((row as any).orderActual) },
  { key: 'orderRate', label: '订单目标完成率', formula: '实际订单数/目标订单数', get: row => displayValue((row as any).orderRate) },
  { key: 'orderPerf', label: '订单目标完成率绩效', formula: '按岗位绩效权重和完成率分档计算。', get: row => displayValue(row.orderPerf) },
  { key: 'refundCount', label: '实际退单单数', get: row => displayValue((row as any).refundCount) },
  { key: 'refundRate', label: '退单率（基准线：27%）', formula: '实际退单单数/实际订单数', get: row => displayValue((row as any).refundRate) },
  { key: 'refundPerf', label: '退单率绩效', formula: '按退单率阶梯计算。', get: row => displayValue(row.refundPerf) },
  { key: 'supportRate', label: '局改配套率\n（基准线：10%）', get: row => displayValue((row as any).supportRate) },
  { key: 'supportPerf', label: '局改配套率绩效', formula: '按局改配套率阶梯计算。', get: row => displayValue(row.supportPerf) },
  { key: 'orderSuccessRate', label: '下单成功率\n（基准线：90%）', get: () => '' },
  { key: 'orderSuccessPerf', label: '下单成功率绩效', get: row => displayValue(row.orderSuccessPerf) },
  { key: 'installSuccessRate', label: '一次安装成功率\n（基准线：90%）', get: () => '' },
  { key: 'installSuccessPerf', label: '一次安装成功率绩效', get: row => displayValue(row.installSuccessPerf) },
  { key: 'dailyScore', label: '日常重要事项安排得分', get: () => '' },
  { key: 'dailyPerf', label: '日常重要事项安排绩效', get: row => displayValue(row.dailyPerf) },
  { key: 'sampleScore', label: '样板间交付及管理\n（标准交付时间：10天）', get: () => '' },
  { key: 'samplePerf', label: '样板间交付及管理绩效', get: row => displayValue(row.samplePerf) },
  { key: 'developmentCount', label: '实际月度开拓数量', get: () => '' },
  { key: 'developmentPerf', label: '开拓目标完成\n绩效', get: row => displayValue(row.developmentPerf) },
  { key: 'communityScore', label: '社群运营完成评分', get: () => '' },
  { key: 'communityPerf', label: '社群运营完成评价\n绩效', get: row => displayValue(row.communityPerf) },
  { key: 'perfActual', label: '实得月度绩效考核金额', formula: '各绩效项求和。', get: row => displayValue(row.calcPerfActual) },
  { key: 'quarterPerf', label: '季度绩效', get: row => displayValue(row.quarterPerf) },
  { key: 'other', label: '全民营销/其他', get: row => displayValue(row.other) },
  { key: 'sick', label: '病假工资', get: row => displayValue(row.sick) },
  { key: 'late', label: '迟到早退扣款', get: row => displayValue(row.late) },
  { key: 'annualBonus', label: '年终奖励/年度绩效', get: row => displayValue(row.annualBonus) },
  { key: 'gross', label: '应发工资', formula: '基本工资+加班工资+实得绩效+季度绩效+全民营销/其他+年终奖励-迟到早退扣款+病假工资。', get: row => displayValue(row.calcGross) },
  { key: 'social', label: '代扣个人社保', get: row => displayValue(row.social) },
  { key: 'fund', label: '代扣个人公积金', get: row => displayValue(row.fund) },
  { key: 'tax', label: '代扣个税', get: row => displayValue(row.tax) },
  { key: 'net', label: '实发工资', formula: '应发工资-代扣个人社保-代扣个人公积金-代扣个税。', get: row => displayValue(row.calcNet) },
  { key: 'paymentQuarterFill', label: '回款目标完成率绩效(若季度拉通≥100%，有季度通补）', get: () => '' },
  { key: 'orderQuarterFill', label: '订单目标完成率绩效(若季度拉通≥100%，有季度通补）', get: () => '' },
  { key: 'refundQuarterFill', label: '退单率绩效(若季度拉通<27%，有季度通补）', get: () => '' },
  { key: 'supportQuarterFill', label: '局改配套率绩效(若季度拉通≥10%，有季度通补）', get: () => '' },
  { key: 'orderSuccessQuarterFill', label: '下单成功率绩效(若季度拉通≥90%，有季度通补）', get: () => '' },
  { key: 'installSuccessQuarterFill', label: '一次安装成功率绩效(若季度拉通≥90%，有季度通补）', get: () => '' },
  { key: 'blankBD', label: '', get: () => '' },
  { key: 'perfRatio', label: '', formula: '实得月度绩效考核金额/月度绩效考核金额标准', get: row => row.calcPerfStd ? displayValue(row.calcPerfActual / row.calcPerfStd) : '' },
  { key: 'blankBF', label: '', get: () => '' },
];

const consultantSheetColumnBase: SheetColumn[] = [
  { key: 'seq', label: '序号', get: row => row.id },
  { key: 'employeeName', label: '姓名', get: row => row.employeeName || row.displayEmployeeName || '' },
  { key: 'dept', label: '门店', get: row => row.dept || '' },
  { key: 'position', label: '职位', get: row => row.position },
  { key: 'workAge', label: '工龄', get: () => '' },
  { key: 'hireDate', label: '登记入职日期', get: () => '' },
  { key: 'resignDate', label: '离职时间', get: () => '' },
  { key: 'fixedRest', label: '考勤明细/固休', get: () => '' },
  { key: 'should', label: '应出勤天数', get: row => row.should },
  { key: 'restDays', label: '应休息天数', get: () => '' },
  { key: 'actual', label: '实出勤天数', get: row => row.actual },
  { key: 'actualRest', label: '实休息天数', get: () => '' },
  { key: 'sickDays', label: '病假天数', get: row => displayValue(row.sickDays) },
  { key: 'personalLeaveDays', label: '事假天数', get: () => '' },
  { key: 'annualLeaveDays', label: '年假天数', get: row => displayValue(row.annualLeaveDays) },
  { key: 'arrangedAnnualLeaveDays', label: '安排年假天数', get: row => displayValue(row.arrangedAnnualLeaveDays) },
  { key: 'paidLeaveDays', label: '带薪假天数', get: row => displayValue(row.paidLeaveDays) },
  { key: 'attendanceCheck', label: '核对加班/缺勤天数', formula: '=IF(实出勤+病假+年假+安排年假+带薪假=应出勤,0,实出勤+病假+年假+安排年假+带薪假-应出勤)', get: row => displayValue(row.actual + val(row.sickDays) + val(row.annualLeaveDays) + val(row.arrangedAnnualLeaveDays) + val(row.paidLeaveDays) - row.should) },
  { key: 'attendanceAmount', label: '考勤金额', formula: '=ROUND((核对加班/缺勤天数-病假天数)*100+2740/26*病假天数*0.6,0)', get: row => row.calcBase },
  { key: 'salesAmount', label: '提成情况/销售额', get: () => '' },
  { key: 'salesCommission', label: '销售提成', get: row => displayValue(row.salesCommission) },
  { key: 'otherCommission', label: '其他提成', get: row => displayValue(row.otherCommission) },
  { key: 'otherCommissionRemark', label: '其他提成备注', get: () => '' },
  { key: 'commissionTotal', label: '总提成', formula: '=ROUND(销售提成+其他提成,0)', get: row => row.calcPerfActual },
  { key: 'salaryBase', label: '月保底工资/底薪', get: row => displayValue(row.salaryBase) },
  { key: 'phoneSubsidy', label: '话费补贴', get: row => displayValue(row.phoneSubsidy) },
  { key: 'guaranteeGap', label: '低于保障性工资', get: row => Math.max(0, val(row.guaranteeSalary) - val(row.salaryBase) - val(row.phoneSubsidy) - row.calcPerfActual) },
  { key: 'guaranteeSalary', label: '保底薪资', get: row => displayValue(row.guaranteeSalary) },
  { key: 'afterSaleDeduction', label: '扣款项目/售后扣款', get: row => displayValue(row.afterSaleDeduction) },
  { key: 'orderDeduction', label: '订单规范扣款', get: row => displayValue(row.orderDeduction) },
  { key: 'lateDeduction', label: '迟到扣款', get: row => displayValue(row.lateDeduction) },
  { key: 'otherDeduction', label: '其他', get: row => displayValue(row.otherDeduction) },
  { key: 'otherDeductionRemark', label: '其他扣款说明', get: () => '' },
  { key: 'deductionTotal', label: '扣款合计', formula: '=SUM(售后扣款:其他)', get: row => val(row.afterSaleDeduction) + val(row.orderDeduction) + val(row.lateDeduction) + val(row.otherDeduction) },
  { key: 'fixedOtherAmount', label: '其他项目/其他金额-固定', get: row => displayValue(row.fixedOtherAmount) },
  { key: 'fixedOtherRemark', label: '其他金额说明', get: () => '' },
  { key: 'retroAmount', label: '补发金额', get: row => displayValue(row.retroAmount) },
  { key: 'retroRemark', label: '补发金额说明', get: () => '' },
  { key: 'holidaySubsidy', label: '法定假日出勤补贴', get: row => displayValue(row.holidaySubsidy) },
  { key: 'otherItemTotal', label: '其他项目合计', formula: '=其他金额固定+补发金额+法定假日出勤补贴', get: row => val(row.fixedOtherAmount) + val(row.retroAmount) + val(row.holidaySubsidy) },
  { key: 'gross', label: '总计/应发工资', formula: '=ROUND(考勤金额+总提成+底薪+话补+保障差额-扣款合计+其他项目合计,2)', get: row => row.calcGross },
  { key: 'social', label: 'D1', get: row => displayValue(row.social) },
  { key: 'fund', label: 'D2', get: row => displayValue(row.fund) },
  { key: 'tax', label: 'D3', get: row => displayValue(row.tax) },
  { key: 'net', label: '实发工资', formula: '=应发工资-D1-D2-D3', get: row => row.calcNet },
];

const consultantTopHeaders = [
  '序号', '姓名', '门店', '职位', '工龄', '登记入职日期', '离职时间', '考勤明细', '', '', '', '', '', '', '', '', '', '', '',
  '提成情况', '', '', '', '', '月保底工资', '', '', '', '扣款项目', '', '', '', '', '', '其他项目', '', '', '', '', '', '总计', '', '', '', '',
];

const consultantBottomHeaders = [
  '', '', '', '', '', '', '', '固休', '应出勤天数', '应休息天数', '实出勤天数', '实休息天数', '病假天数', '事假天数', '年假天数',
  '安排年假天数', '带薪假天数', '核对加班/缺勤天数', '考勤金额', '销售额  ', '销售提成', '其他提成', '其他提成备注', '总提成',
  '底薪', '话费补贴', '低于保障性工资', '保底薪资', '售后扣款', '订单规范扣款', '迟到扣款', '其他', '其他扣款说明',
  '扣款合计', '其他金额-固定', '其他金额说明', '补发金额', '补发金额说明', '法定假日出勤补贴', '其他项目合计',
  '应发工资', 'D1', 'D2', 'D3', '实发工资',
];

const consultantSheetColumns = withHeaderRows(consultantSheetColumnBase, consultantTopHeaders, consultantBottomHeaders);

const designerSheetColumnBase: SheetColumn[] = [
  ...consultantSheetColumns.slice(0, 19).map((col) => col.key === 'position' ? { ...col, label: '岗位类别' } : col),
  { key: 'wardrobeAmount', label: '提成情况/衣柜下单金额', get: () => '' },
  { key: 'cabinetAmount', label: '橱柜下单金额', get: () => '' },
  { key: 'designCommission', label: '提成', get: row => displayValue(row.designCommission) },
  { key: 'salaryBase', label: '月保底工资/底薪', get: row => displayValue(row.salaryBase) },
  { key: 'housingSubsidy', label: '住房补贴', get: row => displayValue(row.housingSubsidy) },
  { key: 'trafficSubsidy', label: '交通补贴', get: row => displayValue(row.trafficSubsidy) },
  { key: 'guaranteeGap', label: '补足工资差额', get: row => Math.max(0, val(row.guaranteeSalary) - val(row.designCommission) - val(row.salaryBase) - val(row.housingSubsidy) - val(row.trafficSubsidy)) },
  { key: 'guaranteeSalary', label: '月保底工资', get: row => displayValue(row.guaranteeSalary) },
  { key: 'lateDeduction', label: '其他项目/迟到扣款', get: row => displayValue(row.lateDeduction) },
  { key: 'holidaySubsidy', label: '法定假出勤补贴', get: row => displayValue(row.holidaySubsidy) },
  { key: 'otherAmount', label: '其它加减项', get: row => displayValue(row.otherDeduction) },
  { key: 'otherRemark', label: '其它加减项说明', get: () => '' },
  { key: 'afterSaleDeduction', label: '售后扣款', get: row => displayValue(row.afterSaleDeduction) },
  { key: 'customDeduction', label: '定制少收扣款', get: row => displayValue(row.customDeduction) },
  { key: 'otherTotal', label: '其他项目合计', formula: '=-迟到扣款+法定假出勤补贴+其它加减项-售后扣款+定制少收扣款', get: row => -val(row.lateDeduction) + val(row.holidaySubsidy) + val(row.otherDeduction) - val(row.afterSaleDeduction) + val(row.customDeduction) },
  { key: 'renderAmount', label: '奖金明细/衣/橱柜效果图', get: row => displayValue(row.renderAmount) },
  { key: 'renderCommission', label: '效果图提成*0.4%', formula: '=衣/橱柜效果图*0.4%', get: row => displayValue(val(row.renderAmount) * 0.004) },
  { key: 'specialFee', label: '衣/橱异形费', get: row => displayValue(row.specialFee) },
  { key: 'specialCommission', label: '异形费提成*20%', formula: '=衣/橱异形费*20%', get: row => displayValue(val(row.specialFee) * 0.2) },
  { key: 'orderAuditDeduction', label: '订单规范扣款（审单扣款小计）', get: row => displayValue(row.orderAuditDeduction) },
  { key: 'productBonus', label: '成品奖金/扣款', get: row => displayValue(row.productBonus) },
  { key: 'bonusTotal', label: '奖金合计', formula: '=效果图提成+异形费提成-订单规范扣款+成品奖金/扣款', get: row => displayValue(row.calcPerfActual) },
  { key: 'gross', label: '总计/应发工资', formula: '=ROUND(考勤金额+提成+底薪+住房补贴+交通补贴+补足工资差额+其他项目合计+奖金合计,2)', get: row => row.calcGross },
  { key: 'social', label: 'D1', get: row => displayValue(row.social) },
  { key: 'fund', label: 'D2', get: row => displayValue(row.fund) },
  { key: 'tax', label: 'D3', get: row => displayValue(row.tax) },
  { key: 'net', label: '实发工资', formula: '=应发工资-D1-D2-D3', get: row => row.calcNet },
];

const designerTopHeaders = [
  '序号', '姓名', '门店', '岗位类别', '工龄', '登记入职日期', '离职时间', '考勤明细', '', '', '', '', '', '', '', '', '', '', '',
  '提成情况', '', '', '月保底工资', '', '', '', '', '其他项目', '', '', '', '', '', '', '奖金明细', '', '', '', '', '', '', '总计', '', '', '', '',
];

const designerBottomHeaders = [
  '', '', '', '', '', '', '', '固休', '应出勤天数', '应休息天数', '实出勤天数', '实休息天数', '病假天数', '事假天数', '年假天数',
  '安排年假天数', '带薪假天数', '核对加班/缺勤天数', '考勤金额', '衣柜下单金额', '橱柜下单金额', '提成', '底薪', '住房补贴',
  '交通补贴', '补足工资差额', '月保底工资', '迟到扣款', '法定假出勤补贴', '其它加减项', '其它加减项说明', '售后扣款',
  '定制少收扣款', '其他项目合计', '衣/橱柜效果图', '效果图提成*0.4%', '衣/橱异形费', '异形费提成*20%',
  '订单规范扣款（审单扣款小计）', '成品奖金/扣款', '奖金合计', '应发工资', 'D1', 'D2', 'D3', '实发工资',
];

const designerSheetColumns = withHeaderRows(designerSheetColumnBase, designerTopHeaders, designerBottomHeaders);

const OPERATOR_OPTIONS = ['', '+', '-', '*', '/'] as const;
const FIELD_GROUP_COLORS = ['#B42318', '#1D4ED8', '#047857', '#B45309', '#7C3AED', '#0F766E', '#BE185D'];

function loadStoredFormulaRules() {
  return {};
}

function loadStoredFieldConfigs() {
  return {};
}

function loadStoredRuleTemplates() {
  return [];
}

function loadStoredTemplateAssignments() {
  return {};
}

function defaultDepartmentCategories(): DepartmentCategory[] {
  return [
    { id: 'category-after-sale', name: '售后部门' },
    { id: 'category-cleaning', name: '保洁部门' },
    { id: 'category-rendering', name: '效果图部门' },
  ];
}

function clearLegacySalaryCache() {
  if (typeof window === 'undefined') return;
  LEGACY_LOCAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

function ruleScopeKey(group: string, position: string, employeeKey: string, templateId = '') {
  const base = `${group}::${position || '全部'}::${employeeKey || '*'}`;
  return templateId ? `${base}::template:${templateId}` : base;
}

function formulaRuleKey(group: string, position: string, employeeKey: string, columnKey: string, templateId = '') {
  return `${ruleScopeKey(group, position, employeeKey, templateId)}::${columnKey}`;
}

function fieldConfigKey(group: string, position: string, employeeKey: string, fieldKey: string, templateId = '') {
  return `${ruleScopeKey(group, position, employeeKey, templateId)}::${fieldKey}`;
}

function buildOperationText(field: Pick<RuleFieldConfig, 'op1' | 'value1'>) {
  const value = String(field.value1 || '').trim();
  const operator = String(field.op1 || '').trim();
  if (!value && !operator) return '';
  return [value, operator].filter(Boolean).join(' ');
}

function baseColumnsForPosition(group: '管理岗' | '销售设计岗', position: string) {
  if (group === '管理岗') return managementSheetColumns;
  if (position === '全屋设计师' || position === '产品设计师') return designerSheetColumns;
  return consultantSheetColumns;
}

function ruleFieldsForScope(
  group: '管理岗' | '销售设计岗',
  position: string,
  employeeKey: string,
  configs: Record<string, RuleFieldConfig>,
  templateId = '',
) {
  const baseColumns = baseColumnsForPosition(group, position);
  const scope = ruleScopeKey(group, position, employeeKey, templateId);
  const legacyScope = ruleScopeKey(group, position, employeeKey);
  const baseRows = baseColumns
    .map((column) => {
      const scopedConfig = configs[fieldConfigKey(group, position, employeeKey, column.key, templateId)];
      const legacyConfig = configs[fieldConfigKey(group, position, employeeKey, column.key)];
      const config = scopedConfig || legacyConfig || defaultFieldConfig(column);
      return { ...config, baseColumn: column };
    })
    .filter((field) => !field.deleted);
  const scopedCustomRows = Object.entries(configs)
    .filter(([key, config]) => key.startsWith(`${scope}::`) && config.custom)
    .map(([, config]) => ({ ...config }));
  const legacyCustomRows = templateId
    ? Object.entries(configs)
      .filter(([key, config]) => key.startsWith(`${legacyScope}::`) && !key.includes('::template:') && config.custom)
      .map(([, config]) => ({ ...config }))
    : [];
  const customRowsByKey = new Map<string, RuleFieldConfig>();
  legacyCustomRows.forEach((field) => customRowsByKey.set(field.key, field));
  scopedCustomRows.forEach((field) => customRowsByKey.set(field.key, field));
  const customRows = Array.from(customRowsByKey.values()).filter((field) => !field.deleted);
  const customKeys = new Set(baseRows.map((field) => field.key));
  return [...baseRows, ...customRows.filter((field) => !customKeys.has(field.key))]
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (a.field.order ?? a.index) - (b.field.order ?? b.index))
    .map(({ field }) => field);
}

function splitTrailingOperator(value: string) {
  const text = value.trim();
  if (text.length > 1 && /[+\-*/]$/.test(text)) {
    return { body: text.slice(0, -1).trim(), operator: text.slice(-1) };
  }
  return { body: text, operator: '' };
}

function normalizeArithmeticFragment(value: unknown) {
  const text = String(value ?? '')
    .replace(/，/g, ',')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!text) return '';
  const normalized = text.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  return /^[0-9+\-*/().]+$/.test(normalized) ? normalized : '';
}

function stripTrailingOperators(value: string) {
  return value.replace(/[+\-*/]+$/g, '');
}

function joinFormulaSegments(segments: string[]) {
  return segments.filter(Boolean).reduce((expression, segment) => {
    if (!expression) return segment;
    const previousEndsWithOperator = /[+\-*/]$/.test(expression);
    const nextStartsWithOperator = /^[+\-*/]/.test(segment);
    return `${expression}${previousEndsWithOperator || nextStartsWithOperator ? '' : '+'}${segment}`;
  }, '');
}

function fieldUsesLinkedNumericValue(field: Pick<RuleFieldConfig, 'label' | 'source'>) {
  if (field.label === '应出勤天数' || field.label === '实际出勤天数' || field.label === '平方') return true;
  return field.source !== '输入项';
}

function fieldParticipatesInSalaryFormula(field: Pick<RuleFieldConfig, 'label'>) {
  return !['月份', '门店', '部门', '岗位', '应出勤天数', '薪资'].includes(field.label);
}

function buildFormulaDisplaySegment(field: Pick<RuleFieldConfig, 'label' | 'op1' | 'value1' | 'source'>, index: number) {
  const raw = String(field.value1 || '').trim();
  if (!raw) return '';
  const label = String(field.label || `表头${index + 1}`).trim();
  const { body, operator } = splitTrailingOperator(raw);
  const value = fieldUsesLinkedNumericValue(field) ? `${label}*(${body})` : body;
  return `${value}${operator || field.op1 || ''}`;
}

function buildTemplateFormulaText(fields: Pick<RuleFieldConfig, 'label' | 'op1' | 'value1' | 'source'>[]) {
  const formulaFields = fields.filter(fieldParticipatesInSalaryFormula);
  const text = stripTrailingOperators(joinFormulaSegments(formulaFields.map((field, index) => buildFormulaDisplaySegment(field, index))));
  if (!text) return emptyFormula;
  return fields.some((field) => field.label === '薪资') ? `薪资 = ${text}` : text;
}

function applyTemplateOperation(baseValue: React.ReactNode, field: Pick<RuleFieldConfig, 'value1'>) {
  const manualValue = String(field.value1 ?? '').trim();
  return baseValue === '' || baseValue === null || baseValue === undefined ? manualValue : baseValue;
}

function configItemValue(row: CalculatedRow, label: string) {
  if (label === '月份') return formatMonthValue(row.month);
  if (label === '门店') return row.dept || '';
  if (label === '部门') return row.department || row.dept || '';
  if (label === '岗位') return row.position || '';
  if (label === '应出勤天数') return row.should;
  if (label === '实际出勤天数') return row.actual;
  if (label === '平方') return row.renderAmount ?? (row as any).square ?? (row as any)['平方'] ?? (row as any).area ?? (row as any)['面积'] ?? 0;
  return undefined;
}

function parseOperationInput(value: unknown) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const isPercent = text.includes('%');
  const parsed = Number(text.replace(/%/g, '').trim());
  if (!Number.isFinite(parsed)) return null;
  return isPercent ? parsed / 100 : parsed;
}

function numericCellValue(value: React.ReactNode) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = parseOperationInput(value);
  return parsed;
}

function fieldDataValue(row: CalculatedRow, field: RuleFieldRow) {
  const configValue = configItemValue(row, field.label);
  if (configValue !== undefined) return configValue;
  return field.baseColumn?.get(row) ?? '';
}

function formulaOperandValue(row: CalculatedRow, field: RuleFieldRow) {
  if (field.label === '薪资') return null;
  const sourceValue = numericCellValue(fieldDataValue(row, field));
  const manualValue = parseOperationInput(field.value1);
  if (sourceValue !== null && manualValue !== null) return sourceValue * manualValue;
  if (sourceValue !== null) return sourceValue;
  if (manualValue !== null) return manualValue;
  return null;
}

function buildCalculationSegment(row: CalculatedRow, field: RuleFieldRow) {
  if (!fieldParticipatesInSalaryFormula(field)) return '';
  const sourceValue = numericCellValue(fieldDataValue(row, field));
  const inputFormula = normalizeArithmeticFragment(field.value1);
  if (inputFormula) {
    const { body, operator } = splitTrailingOperator(inputFormula);
    if (!body) return '';
    const expression = sourceValue !== null && fieldUsesLinkedNumericValue(field)
      ? `${sourceValue}*(${body})`
      : body;
    return `${expression}${operator || field.op1 || ''}`;
  }
  if (sourceValue !== null) return `${sourceValue}${field.op1 || ''}`;
  return '';
}

function calculateFieldOperationResult(row: CalculatedRow | null, field: RuleFieldRow) {
  if (field.label === '月份') {
    const dateValue = normalizeDateInputValue(field.value1) || (row ? rowMonthDateValue(row) : '');
    if (!dateValue) return '';
    return dateValue;
  }
  const inputFormula = normalizeArithmeticFragment(field.value1);
  if (inputFormula) {
    const { body } = splitTrailingOperator(inputFormula);
    if (!body) return '';
    const sourceValue = row ? numericCellValue(fieldDataValue(row, field)) : null;
    if (fieldUsesLinkedNumericValue(field) && row && sourceValue !== null) {
      const result = evaluateArithmeticExpression(`${sourceValue}*(${body})`);
      return result === null ? '' : round2(result);
    }
    if (fieldUsesLinkedNumericValue(field) && !row) return '按人员计算';
    const result = evaluateArithmeticExpression(body);
    return result === null ? '' : round2(result);
  }
  if (!row) return '';
  return fieldDataValue(row, field);
}

function evaluateArithmeticExpression(expression: string) {
  const safeExpression = stripTrailingOperators(expression);
  if (!safeExpression || !/^[0-9+\-*/().]+$/.test(safeExpression)) return null;
  try {
    const result = Function(`"use strict"; return (${safeExpression});`)();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function calculateTemplateSalary(row: CalculatedRow, fields: RuleFieldRow[]) {
  const expression = joinFormulaSegments(fields.map((field) => buildCalculationSegment(row, field)));
  const result = evaluateArithmeticExpression(expression);
  if (result === null) return '';
  return round2(result);
}

function columnDisplayWidth(column: SheetColumn) {
  return column.label ? (column.width || 96) : 60;
}

function buildHeaderGroups(columns: SheetColumn[], labelForColumn: (column: SheetColumn) => string | undefined) {
  return columns.reduce<Array<{ key: string; label: string; colSpan: number; width: number; column: SheetColumn; color: string; background: string }>>((groups, column, index) => {
    const label = String(labelForColumn(column) || '').trim();
    const last = groups[groups.length - 1];
    if (label && last?.label === label) {
      last.colSpan += 1;
      last.width += columnDisplayWidth(column);
      return groups;
    }
    const color = label ? FIELD_GROUP_COLORS[groups.filter((group) => group.label).length % FIELD_GROUP_COLORS.length] : '';
    groups.push({ key: `${label || column.key}-${index}`, label, colSpan: 1, width: columnDisplayWidth(column), column, color, background: color ? `${color}12` : '' });
    return groups;
  }, []);
}

function normalizeOperator(value: unknown): RuleFieldConfig['op1'] {
  return OPERATOR_OPTIONS.includes(value as RuleFieldConfig['op1']) ? value as RuleFieldConfig['op1'] : '';
}

function normalizeFieldAfterPatch(field: RuleFieldConfig, patch: Partial<RuleFieldConfig>) {
  const next = { ...field, ...patch };
  const expression = buildOperationText(next);
  return {
    ...next,
    op1: normalizeOperator(next.op1),
    formula: patch.formula ?? (expression || next.formula || emptyFormula),
  };
}

function containsLegacySalaryTestValue(value: unknown) {
  return /2222|333|效果图阶段三|管理岗-management-\d+/.test(JSON.stringify(value ?? ''));
}

function sanitizeFieldConfigs(configs: Record<string, RuleFieldConfig>) {
  return Object.fromEntries(
    Object.entries(configs)
      .filter(([key, config]) => !containsLegacySalaryTestValue(key) && !containsLegacySalaryTestValue(config))
      .map(([key, config]) => [key, { ...config, op1: normalizeOperator(config.op1), deleted: Boolean(config.deleted) || undefined }]),
  ) as Record<string, RuleFieldConfig>;
}

function sanitizeDeletedRuleTemplateIds(ids: unknown[]) {
  return Array.from(new Set(
    ids
      .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()) && !containsLegacySalaryTestValue(id))
      .map((id) => id.trim()),
  ));
}

function sanitizeFormulaDrafts(drafts: Record<string, string>, blockedKeys = new Set<string>()) {
  return Object.fromEntries(
    Object.entries(drafts).filter(([key, value]) => !blockedKeys.has(key) && !containsLegacySalaryTestValue(key) && !containsLegacySalaryTestValue(value)),
  ) as Record<string, string>;
}

function sanitizeDepartmentCategories(categories: unknown[]) {
  const seen = new Set<string>();
  return categories
    .filter((category): category is DepartmentCategory => {
      if (!category || typeof category !== 'object') return false;
      const item = category as DepartmentCategory;
      return typeof item.id === 'string' && typeof item.name === 'string' && Boolean(item.name.trim()) && !containsLegacySalaryTestValue(item);
    })
    .map((category) => ({ id: category.id, name: category.name.trim() }))
    .filter((category) => {
      if (seen.has(category.id)) return false;
      seen.add(category.id);
      return true;
    });
}

function sanitizeManualRuleTemplates(templates: unknown[]) {
  const seen = new Set<string>();
  return templates
    .filter((template): template is RuleTemplate => {
      if (!template || typeof template !== 'object') return false;
      const item = template as RuleTemplate;
      return typeof item.id === 'string'
        && item.id.startsWith('manual-')
        && typeof item.name === 'string'
        && typeof item.position === 'string'
        && (item.group === '管理岗' || item.group === '销售设计岗')
        && !containsLegacySalaryTestValue(item);
    })
    .map((template) => ({
      ...template,
      name: template.name.trim() || '未命名模板',
      position: template.position.trim(),
      fieldCount: Number.isFinite(Number(template.fieldCount)) ? Number(template.fieldCount) : 0,
    }))
    .filter((template) => {
      if (seen.has(template.id)) return false;
      seen.add(template.id);
      return true;
    });
}

function sanitizeTemplateAssignments(
  assignments: Record<string, TemplateAssignment>,
  validTemplateIds?: Set<string>,
  validEmployeeKeys?: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(assignments)
      .filter(([templateId, assignment]) => {
        if (!assignment || typeof assignment !== 'object') return false;
        if (containsLegacySalaryTestValue(templateId) || containsLegacySalaryTestValue(assignment)) return false;
        if (validTemplateIds && !validTemplateIds.has(templateId)) return false;
        return true;
      })
      .map(([templateId, assignment]) => {
        const employeeKeys = Array.isArray(assignment.employeeKeys) ? assignment.employeeKeys : [];
        return [
          templateId,
          {
            templateId,
            position: assignment.position || '',
            categoryId: assignment.categoryId,
            employeeKeys: employeeKeys.filter((key) => {
              if (containsLegacySalaryTestValue(key)) return false;
              return validEmployeeKeys ? Boolean(validEmployeeKeys[key]) : Boolean(key);
            }),
          },
        ];
      })
      .filter(([, assignment]) => assignment.employeeKeys.length > 0),
  ) as Record<string, TemplateAssignment>;
}

function sanitizeTemplateNameOverrides(overrides: Record<string, string>, validManualTemplateIds?: Set<string>) {
  return Object.fromEntries(
    Object.entries(overrides).filter(([key, value]) => {
      if (containsLegacySalaryTestValue(key) || containsLegacySalaryTestValue(value)) return false;
      if (!key.startsWith('manual-')) return true;
      return validManualTemplateIds ? validManualTemplateIds.has(key) : true;
    }),
  ) as Record<string, string>;
}

function sanitizeSalaryCalculationState(state: SalaryCalculationState) {
  const manualRuleTemplates = Array.isArray(state.manualRuleTemplates) ? sanitizeManualRuleTemplates(state.manualRuleTemplates) : [];
  const validManualTemplateIds = new Set(manualRuleTemplates.map((template) => template.id));
  const rawFieldConfigs = state.fieldConfigs && typeof state.fieldConfigs === 'object' ? state.fieldConfigs as Record<string, RuleFieldConfig> : {};
  const deletedFieldConfigKeys = new Set(Object.entries(rawFieldConfigs).filter(([, config]) => config.deleted).map(([key]) => key));
  return {
    ...state,
    manualRuleTemplates,
    departmentCategories: Array.isArray(state.departmentCategories) ? sanitizeDepartmentCategories(state.departmentCategories) : [],
    templateNameOverrides: state.templateNameOverrides && typeof state.templateNameOverrides === 'object'
      ? sanitizeTemplateNameOverrides(state.templateNameOverrides, validManualTemplateIds)
      : {},
    deletedRuleTemplateIds: Array.isArray(state.deletedRuleTemplateIds) ? sanitizeDeletedRuleTemplateIds(state.deletedRuleTemplateIds) : [],
    templateAssignments: state.templateAssignments && typeof state.templateAssignments === 'object'
      ? sanitizeTemplateAssignments(state.templateAssignments as Record<string, TemplateAssignment>)
      : {},
    peopleDataOverrides: state.peopleDataOverrides && typeof state.peopleDataOverrides === 'object'
      ? Object.fromEntries(Object.entries(state.peopleDataOverrides).filter(([key, value]) => !containsLegacySalaryTestValue(key) && !containsLegacySalaryTestValue(value)))
      : {},
    formulaDrafts: state.formulaDrafts && typeof state.formulaDrafts === 'object' ? sanitizeFormulaDrafts(state.formulaDrafts, deletedFieldConfigKeys) : {},
    fieldConfigs: sanitizeFieldConfigs(rawFieldConfigs),
  } as SalaryCalculationState;
}

function defaultFieldConfig(column: SheetColumn): RuleFieldConfig {
  return {
    key: column.key,
    label: columnTitle(column),
    groupTop: '',
    groupSub: '',
    groupId: '',
    source: column.formula ? '系统默认' : '输入项',
    formula: column.formula || emptyFormula,
    op1: '',
    value1: '',
    op2: '',
    value2: '',
  };
}

export default function SalaryCalculation() {
  const { colors } = useTheme();
  const templateImportInputRef = useRef<HTMLInputElement | null>(null);
  const peopleDataImportInputRef = useRef<HTMLInputElement | null>(null);
  const salarySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [employeeRosterRows, setEmployeeRosterRows] = useState<EmployeeRosterRecord[]>([]);
  const [organizationRows, setOrganizationRows] = useState<OrganizationRecord[]>([]);
  const [organizationPositions, setOrganizationPositions] = useState<OrganizationPositionRecord[]>([]);
  const [activeView, setActiveView] = useState<'categories' | 'calculation' | 'rules'>('rules');
  const [activeGroup, setActiveGroup] = useState<'管理岗' | '销售设计岗'>(PAYROLL_GROUP);
  const [activePosition, setActivePosition] = useState('全部');
  const [ruleMode] = useState<'position' | 'person'>('position');
  const [ruleSection, setRuleSection] = useState<'templates' | 'assignments' | 'peopleData'>('templates');
  const [rulePanelMode, setRulePanelMode] = useState<'templates' | 'detail'>('templates');
  const [ruleModal, setRuleModal] = useState<'export' | null>(null);
  const [ruleGroup, setRuleGroup] = useState<'管理岗' | '销售设计岗'>(PAYROLL_GROUP);
  const [rulePosition, setRulePosition] = useState('');
  const [ruleEmployeeKey, setRuleEmployeeKey] = useState('*');
  const [activeRuleTemplateId, setActiveRuleTemplateId] = useState('');
  const [expandedSections, setExpandedSections] = useState({ calculation: true, rules: true, payrollGroup: true });
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});
  const [ruleStatus, setRuleStatus] = useState('');
  const [exportFieldKeys, setExportFieldKeys] = useState<Set<string>>(new Set());
  const [editingRuleField, setEditingRuleField] = useState<RuleFieldRow | null>(null);
  const [ruleFieldDraft, setRuleFieldDraft] = useState<RuleFieldConfig | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'month', direction: 'asc' });
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('全部');
  const [monthFilter, setMonthFilter] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [activeFormulaColumn, setActiveFormulaColumn] = useState<SheetColumn | null>(null);
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>(() => loadStoredFormulaRules());
  const [fieldConfigs, setFieldConfigs] = useState<Record<string, RuleFieldConfig>>(() => loadStoredFieldConfigs());
  const [manualRuleTemplates, setManualRuleTemplates] = useState<RuleTemplate[]>(() => loadStoredRuleTemplates());
  const [departmentCategories, setDepartmentCategories] = useState<DepartmentCategory[]>(() => defaultDepartmentCategories());
  const [renamingCategoryId, setRenamingCategoryId] = useState('');
  const [renameCategoryValue, setRenameCategoryValue] = useState('');
  const [templateNameOverrides, setTemplateNameOverrides] = useState<Record<string, string>>({});
  const [deletedRuleTemplateIds, setDeletedRuleTemplateIds] = useState<Set<string>>(new Set());
  const [templateFilters, setTemplateFilters] = useState({ dept: '全部', group: '全部', position: '全部' });
  const [openTemplateFilterKey, setOpenTemplateFilterKey] = useState('');
  const [templateAssignments, setTemplateAssignments] = useState<Record<string, TemplateAssignment>>(() => loadStoredTemplateAssignments());
  const [peopleDataOverrides, setPeopleDataOverrides] = useState<Record<string, PeopleDataOverride>>({});
  const [assignmentTemplateId, setAssignmentTemplateId] = useState('');
  const [assignmentPosition, setAssignmentPosition] = useState('');
  const [assignmentCategoryId, setAssignmentCategoryId] = useState('');
  const [assignmentEmployeeSearch, setAssignmentEmployeeSearch] = useState('');
  const [pendingAssignmentEmployeeKeys, setPendingAssignmentEmployeeKeys] = useState<Set<string>>(new Set());
  const [activeAssignmentTemplateId, setActiveAssignmentTemplateId] = useState('');
  const [templatePreviewView, setTemplatePreviewView] = useState<TemplatePreviewView>(null);
  const [renamingTemplateId, setRenamingTemplateId] = useState('');
  const [renameTemplateValue, setRenameTemplateValue] = useState('');
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<RuleTemplate | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageDraft, setTemplatePageDraft] = useState('1');
  const [peopleNameQuery, setPeopleNameQuery] = useState('');
  const [peopleEmployeeNoQuery, setPeopleEmployeeNoQuery] = useState('');
  const [peopleDeptFilter, setPeopleDeptFilter] = useState('全部');
  const [peoplePositionFilter, setPeoplePositionFilter] = useState('全部');
  const [peoplePage, setPeoplePage] = useState(1);
  const [peoplePageDraft, setPeoplePageDraft] = useState('1');
  const [draggingRuleFieldKey, setDraggingRuleFieldKey] = useState('');
  const [selectedGroupFieldKeys, setSelectedGroupFieldKeys] = useState<Set<string>>(new Set());
  const [groupAnchorFieldKey, setGroupAnchorFieldKey] = useState('');
  const [salaryStateLoaded, setSalaryStateLoaded] = useState(false);
  const [salaryPersistenceStatus, setSalaryPersistenceStatus] = useState('');
  const [payrollInputStatus, setPayrollInputStatus] = useState('正在读取员工主数据和考勤月汇总');
  const [payrollInputsLoaded, setPayrollInputsLoaded] = useState(false);
  const calculatedRows = useMemo(() => {
    const fallbackCounts: Record<string, number> = {};
    return rows.map(calculateRow).map((row) => {
      const explicitName = row.employeeName?.trim();
      if (explicitName) return { ...row, displayEmployeeName: explicitName };
      const fallbackCount = (fallbackCounts[row.position] ?? 0) + 1;
      fallbackCounts[row.position] = fallbackCount;
      return { ...row, displayEmployeeName: `${row.position}${String(fallbackCount).padStart(2, '0')}` };
    });
  }, [rows]);
  const deptOptions = useMemo(() => ['全部', ...Array.from(new Set(rows.map((row) => row.dept || '未分配部门')))], [rows]);
  const activeAssignmentView = activeAssignmentTemplateId ? templateAssignments[activeAssignmentTemplateId] || null : null;
  const confirmedAssignmentKeySet = useMemo(() => new Set(activeAssignmentView?.employeeKeys || []), [activeAssignmentView]);
  const filteredRows = calculatedRows.filter((row) => {
    const matchGroup = row.group === activeGroup;
    const matchPosition = activePosition === '全部' || row.position === activePosition;
    const matchDept = deptFilter === '全部' || (row.dept || '未分配部门') === deptFilter;
    const matchMonth = !monthFilter || formatMonthValue(row.month) === monthFilter;
    const keyword = employeeQuery.trim().toLowerCase();
    const matchEmployee = !keyword
      || String(row.employeeName || row.displayEmployeeName || '').toLowerCase().includes(keyword)
      || row.position.toLowerCase().includes(keyword);
    const matchConfirmedAssignment = templatePreviewView
      ? true
      : activeAssignmentView
        ? confirmedAssignmentKeySet.has(assignmentPersonKey(row))
        : true;
    return matchGroup && matchPosition && matchDept && matchMonth && matchEmployee && matchConfirmedAssignment;
  });
  const rulePositions = useMemo(() => {
    return Array.from(new Set(rows.filter((row) => row.group === ruleGroup).map((row) => row.position)));
  }, [rows, ruleGroup]);
  const ruleTemplates = useMemo((): RuleTemplate[] => {
    const groups = [PAYROLL_GROUP] as ('管理岗' | '销售设计岗')[];
    const baseTemplates = groups.flatMap((group) => {
      const positions = Array.from(new Set(rows.filter((row) => row.group === group).map((row) => row.position)));
      return positions.map((position) => {
        const columns = group === '管理岗'
          ? managementSheetColumns
          : position === '全屋设计师' || position === '产品设计师'
            ? designerSheetColumns
            : consultantSheetColumns;
        return {
          id: `${group}-${position}`,
          name: `${position}模板`,
          group,
          position,
          dept: rows.find((row) => row.group === group && row.position === position)?.dept || deptForPosition(position),
          fieldCount: columns.length,
        };
      });
    });
    return [...baseTemplates, ...manualRuleTemplates]
      .filter((template) => !deletedRuleTemplateIds.has(template.id))
      .map((template) => ({
        ...template,
        name: templateNameOverrides[template.id] || template.name,
      }));
  }, [deletedRuleTemplateIds, manualRuleTemplates, rows, templateNameOverrides]);
  const filteredRuleTemplates = useMemo(() => {
    return ruleTemplates.filter((template) => {
      const matchDept = templateFilters.dept === '全部' || (template.dept || deptForPosition(template.position)) === templateFilters.dept;
      const matchPosition = templateFilters.position === '全部' || template.position === templateFilters.position;
      return matchDept && matchPosition;
    });
  }, [ruleTemplates, templateFilters]);
  const templateTotalPages = Math.max(1, Math.ceil(filteredRuleTemplates.length / TEMPLATE_PAGE_SIZE));
  const normalizedTemplatePage = Math.min(Math.max(templatePage, 1), templateTotalPages);
  const paginatedRuleTemplates = useMemo(() => {
    const start = (normalizedTemplatePage - 1) * TEMPLATE_PAGE_SIZE;
    return filteredRuleTemplates.slice(start, start + TEMPLATE_PAGE_SIZE);
  }, [filteredRuleTemplates, normalizedTemplatePage]);
  const paginatedRuleTemplateIds = useMemo(() => paginatedRuleTemplates.map((template) => template.id), [paginatedRuleTemplates]);
  const allFilteredTemplatesSelected = paginatedRuleTemplateIds.length > 0 && paginatedRuleTemplateIds.every((templateId) => selectedTemplateIds.has(templateId));
  const selectedTemplateCount = selectedTemplateIds.size;
  const organizationStoreOptions = useMemo(() => {
    const values = organizationRows
      .filter((row) => row.status !== '已停用')
      .filter((row) => String(row.orgType || row.name || '').includes('门店') || String(row.fullPath || '').includes('门店'))
      .map((row) => row.fullPath || row.name)
      .filter(Boolean);
    return Array.from(new Set(values.length ? values : rows.map((row) => row.dept || '').filter(Boolean)));
  }, [organizationRows, rows]);
  const organizationDepartmentOptions = useMemo(() => {
    const values = organizationRows
      .filter((row) => row.status !== '已停用')
      .map((row) => row.fullPath || row.name)
      .filter(Boolean);
    return Array.from(new Set(values.length ? values : rows.map((row) => row.department || row.dept || '').filter(Boolean)));
  }, [organizationRows, rows]);
  const organizationPositionOptions = useMemo(() => {
    const values = organizationPositions
      .filter((row) => row.status !== '已停用')
      .map((row) => row.name)
      .filter(Boolean);
    return Array.from(new Set(values.length ? values : rows.map((row) => row.position).filter(Boolean)));
  }, [organizationPositions, rows]);
  const templateDeptOptions = useMemo(() => ['全部', ...Array.from(new Set([
    ...ruleTemplates.map((template) => template.dept || deptForPosition(template.position)),
    ...organizationDepartmentOptions,
    ...rows.map((row) => row.department || row.dept || '').filter(Boolean),
  ].filter(Boolean)))], [organizationDepartmentOptions, ruleTemplates, rows]);
  const templatePositionOptions = useMemo(() => ['全部', ...Array.from(new Set([
    ...ruleTemplates.map((template) => template.position),
    ...organizationPositionOptions,
    ...rows.map((row) => row.position).filter(Boolean),
  ].filter(Boolean)))], [organizationPositionOptions, ruleTemplates, rows]);
  const activePreviewTemplate = useMemo(() => templatePreviewView ? ruleTemplates.find((template) => template.id === templatePreviewView.templateId) || null : null, [ruleTemplates, templatePreviewView]);
  const editingAssignmentTemplate = useMemo(() => assignmentTemplateId ? ruleTemplates.find((template) => template.id === assignmentTemplateId) || null : null, [assignmentTemplateId, ruleTemplates]);
  const assignmentEmployeeOptions = useMemo(() => {
    const employees = new Map<string, AssignmentEmployeeOption>();
    const fallbackCounts: Record<string, number> = {};
    calculatedRows.forEach((row) => {
      const key = assignmentPersonKey(row);
      if (employees.has(key)) return;
      const fallbackCount = (fallbackCounts[row.position] ?? 0) + 1;
      fallbackCounts[row.position] = fallbackCount;
      employees.set(key, {
        key,
        employeeName: row.employeeName?.trim() || row.displayEmployeeName || `${row.position}${String(fallbackCount).padStart(2, '0')}`,
        position: row.position,
        dept: row.dept,
        department: row.department,
        deptFullPath: row.deptFullPath,
      });
    });
    return Array.from(employees.values());
  }, [calculatedRows]);
  const assignmentEmployees = assignmentEmployeeOptions;
  const assignedEmployeeTemplateByKey = useMemo(() => {
    const assigned: Record<string, string> = {};
    Object.values(templateAssignments).forEach((assignment) => {
      assignment.employeeKeys.forEach((employeeKey) => {
        assigned[employeeKey] = assignment.templateId;
      });
    });
    return assigned;
  }, [templateAssignments]);
  const assignmentEmployeeByKey = useMemo(() => {
    const employees: Record<string, AssignmentEmployeeOption> = {};
    assignmentEmployeeOptions.forEach((employee) => {
      employees[employee.key] = employee;
    });
    return employees;
  }, [assignmentEmployeeOptions]);
  const assignmentResultViews = useMemo(() => {
    return ruleTemplates
      .map((template) => {
        const assignment = templateAssignments[template.id];
        const employeeKeys = (assignment?.employeeKeys || []).filter((key) => assignmentEmployeeByKey[key]);
        if (!employeeKeys.length) return null;
        return {
          template,
          assignment: {
            templateId: template.id,
            position: assignment?.position || template.position,
            categoryId: assignment?.categoryId,
            employeeKeys,
          },
        };
      })
      .filter(Boolean) as Array<{ template: RuleTemplate; assignment: TemplateAssignment }>;
  }, [assignmentEmployeeByKey, ruleTemplates, templateAssignments]);
  const departmentCategoryById = useMemo(() => {
    const map: Record<string, DepartmentCategory> = {};
    departmentCategories.forEach((category) => {
      map[category.id] = category;
    });
    return map;
  }, [departmentCategories]);
  const assignmentViewsByCategory = useMemo(() => {
    const groups: Record<string, Array<{ template: RuleTemplate; assignment: TemplateAssignment }>> = {};
    assignmentResultViews.forEach((item) => {
      const categoryId = item.assignment.categoryId && departmentCategoryById[item.assignment.categoryId]
        ? item.assignment.categoryId
        : UNCATEGORIZED_CATEGORY_ID;
      if (!groups[categoryId]) groups[categoryId] = [];
      groups[categoryId].push(item);
    });
    return groups;
  }, [assignmentResultViews, departmentCategoryById]);
  const navDepartmentCategories = useMemo(() => {
    if (assignmentViewsByCategory[UNCATEGORIZED_CATEGORY_ID]?.length) {
      return [...departmentCategories, { id: UNCATEGORIZED_CATEGORY_ID, name: '未分类' }];
    }
    return departmentCategories;
  }, [assignmentViewsByCategory, departmentCategories]);
  const activeAssignmentTemplate = useMemo(
    () => assignmentResultViews.find((item) => item.template.id === activeAssignmentTemplateId)?.template || null,
    [activeAssignmentTemplateId, assignmentResultViews],
  );
  const assignmentSlotCount = useMemo(() => {
    const maxBound = Math.max(0, ...Object.values(templateAssignments).map((assignment) => assignment.employeeKeys.filter((key) => assignmentEmployeeByKey[key]).length));
    return Math.max(1, maxBound);
  }, [assignmentEmployeeByKey, templateAssignments]);
  const filteredAssignmentEmployees = useMemo(() => {
    const keyword = assignmentEmployeeSearch.trim().toLowerCase();
    return assignmentEmployees.filter((employee) => {
      if (!keyword) return true;
      return String(employee.employeeName || '').toLowerCase().includes(keyword)
        || String(employee.position || '').toLowerCase().includes(keyword)
        || String(employee.dept || '').toLowerCase().includes(keyword);
    });
  }, [assignmentEmployeeSearch, assignmentEmployees]);
  const ruleEmployees = useMemo(() => {
    return calculatedRows.filter((row) => row.group === ruleGroup && row.position === rulePosition);
  }, [calculatedRows, ruleGroup, rulePosition]);
  const rulePreviewRow = ruleEmployees[0] || null;
  const selectedRuleEmployeeKey = ruleMode === 'person' ? ruleEmployeeKey : '*';
  const ruleFields = useMemo((): RuleFieldRow[] => {
    return ruleFieldsForScope(ruleGroup, rulePosition, selectedRuleEmployeeKey, fieldConfigs, activeRuleTemplateId);
  }, [activeRuleTemplateId, fieldConfigs, ruleGroup, rulePosition, selectedRuleEmployeeKey]);
  const ruleFieldGroupVisuals = useMemo(() => {
    const groupColorIndex = new Map<string, number>();
    let nextColorIndex = 0;
    const visuals: Record<string, { color: string; background: string; isFirst: boolean; isLast: boolean }> = {};
    ruleFields.forEach((field, index) => {
      if (!field.groupId) return;
      if (!groupColorIndex.has(field.groupId)) {
        groupColorIndex.set(field.groupId, nextColorIndex);
        nextColorIndex += 1;
      }
      const color = FIELD_GROUP_COLORS[(groupColorIndex.get(field.groupId) || 0) % FIELD_GROUP_COLORS.length];
      const previous = ruleFields[index - 1];
      const next = ruleFields[index + 1];
      visuals[field.key] = {
        color,
        background: `${color}12`,
        isFirst: previous?.groupId !== field.groupId,
        isLast: next?.groupId !== field.groupId,
      };
    });
    return visuals;
  }, [ruleFields]);
  const templateFieldCountById = useMemo(() => {
    return Object.fromEntries(ruleTemplates.map((template) => [
      template.id,
      ruleFieldsForScope(template.group, template.position, '*', fieldConfigs, template.id).length,
    ]));
  }, [fieldConfigs, ruleTemplates]);
  const activeTemplatePosition = templatePreviewView?.position || activeAssignmentView?.position || activePosition;
  const activeFormulaTemplateId = templatePreviewView?.templateId || activeAssignmentTemplateId || '';
  const activeFormulaKey = activeFormulaColumn ? formulaRuleKey(activeGroup, activeTemplatePosition, '*', activeFormulaColumn.key, activeFormulaTemplateId) : '';
  const activeFormulaText = activeFormulaColumn
    ? formulaDrafts[activeFormulaKey] ?? activeFormulaColumn.formula ?? emptyFormula
    : '';
  const headerTextColor = colors.sidebarMuted || colors.textMuted;
  const peopleSourceRows = useMemo((): PeopleDataRow[] => {
    const salaryRowByEmployeeNo = new Map(calculatedRows.filter((row) => row.employeeNo).map((row) => [row.employeeNo, row]));
    const salaryRowByNamePosition = new Map(calculatedRows.map((row) => [`${row.employeeName || row.displayEmployeeName || ''}::${row.position || ''}`, row]));
    const payrollValues = (peopleKey: string, row?: CalculatedRow | null) => ({
      actualWorkDaysForSalary: row?.actual ?? 0,
      squareForSalary: peopleDataOverrides[peopleKey]?.square ?? (row ? (numericCellValue(configItemValue(row, '平方')) ?? 0) : 0),
    });
    if (employeeRosterRows.length) {
      return employeeRosterRows.map((row) => ({
        ...row,
        peopleKey: peopleDataKey(row),
        ...payrollValues(
          peopleDataKey(row),
          salaryRowByEmployeeNo.get(row.employeeNo) || salaryRowByNamePosition.get(`${row.name || ''}::${row.position || ''}`),
        ),
      }));
    }
    return calculatedRows.map((row, index) => ({
      id: index + 1,
      name: row.employeeName || row.displayEmployeeName || '',
      phone: '',
      employeeNo: row.employeeNo || '',
      dept: row.dept || '',
      deptFullPath: row.deptFullPath || row.department || row.dept || '',
      position: row.position || '',
      hireDate: '',
      employeeType: '全职',
      employeeStatus: row.employeeNo ? '已入职' : '未填写',
      identityVerify: '未校验',
      source: '薪酬核算联动数据',
      peopleKey: peopleDataKey({
        employeeNo: row.employeeNo || '',
        name: row.employeeName || row.displayEmployeeName || '',
        position: row.position || '',
        dept: row.dept || '',
      }),
      ...payrollValues(peopleDataKey({
        employeeNo: row.employeeNo || '',
        name: row.employeeName || row.displayEmployeeName || '',
        position: row.position || '',
        dept: row.dept || '',
      }), row),
    }));
  }, [calculatedRows, employeeRosterRows, peopleDataOverrides]);
  const peopleDataByKey = useMemo(() => {
    return new Map(peopleSourceRows.map((row) => [row.peopleKey, row]));
  }, [peopleSourceRows]);
  const peopleDataForPayrollRow = (row: CalculatedRow) => peopleDataByKey.get(peopleDataKey({
    employeeNo: row.employeeNo || '',
    name: row.employeeName || row.displayEmployeeName || '',
    position: row.position || '',
    dept: row.dept || '',
  }));
  const templateFieldDataValue = (row: CalculatedRow, field: RuleFieldRow) => {
    if (field.label === '实际出勤天数') return peopleDataForPayrollRow(row)?.actualWorkDaysForSalary ?? row.actual;
    if (field.label === '平方') return peopleDataForPayrollRow(row)?.squareForSalary ?? 0;
    return fieldDataValue(row, field);
  };
  const templateBuildCalculationSegment = (row: CalculatedRow, field: RuleFieldRow) => {
    if (!fieldParticipatesInSalaryFormula(field)) return '';
    const sourceValue = numericCellValue(templateFieldDataValue(row, field));
    const inputFormula = normalizeArithmeticFragment(field.value1);
    if (inputFormula) {
      const { body, operator } = splitTrailingOperator(inputFormula);
      if (!body) return '';
      const expression = sourceValue !== null && fieldUsesLinkedNumericValue(field)
        ? `${sourceValue}*(${body})`
        : body;
      return `${expression}${operator || field.op1 || ''}`;
    }
    if (sourceValue !== null) return `${sourceValue}${field.op1 || ''}`;
    return '';
  };
  const templateCalculateFieldOperationResult = (row: CalculatedRow | null, field: RuleFieldRow) => {
    if (field.label === '月份') {
      const dateValue = normalizeDateInputValue(field.value1) || (row ? rowMonthDateValue(row) : '');
      if (!dateValue) return '';
      return dateValue;
    }
    const inputFormula = normalizeArithmeticFragment(field.value1);
    if (inputFormula) {
      const { body } = splitTrailingOperator(inputFormula);
      if (!body) return '';
      const sourceValue = row ? numericCellValue(templateFieldDataValue(row, field)) : null;
      if (fieldUsesLinkedNumericValue(field) && row && sourceValue !== null) {
        const result = evaluateArithmeticExpression(`${sourceValue}*(${body})`);
        return result === null ? '' : round2(result);
      }
      if (fieldUsesLinkedNumericValue(field) && !row) return '按人员计算';
      const result = evaluateArithmeticExpression(body);
      return result === null ? '' : round2(result);
    }
    if (!row) return '';
    return templateFieldDataValue(row, field);
  };
  const templateCalculateSalary = (row: CalculatedRow, fields: RuleFieldRow[]) => {
    const expression = joinFormulaSegments(fields.map((field) => templateBuildCalculationSegment(row, field)));
    const result = evaluateArithmeticExpression(expression);
    return result === null ? '' : round2(result);
  };
  const activeSheetColumns = useMemo((): SheetColumn[] => {
    const activeTemplateId = templatePreviewView?.templateId || activeAssignmentTemplateId || '';
    const fields = ruleFieldsForScope(activeGroup, activeTemplatePosition, '*', fieldConfigs, activeTemplateId);
    return fields.map((field) => ({
      key: field.key,
      label: field.label,
      topLabel: field.groupTop?.trim() || undefined,
      bottomLabel: field.groupSub?.trim() || undefined,
      formula: field.formula || field.baseColumn?.formula || emptyFormula,
      width: field.label === '月份' ? 132 : field.baseColumn?.width,
      get: (row) => field.label === '薪资'
        ? templateCalculateSalary(row, fields)
        : templateCalculateFieldOperationResult(row, field),
    }));
  }, [activeAssignmentTemplateId, activeGroup, activeTemplatePosition, fieldConfigs, peopleDataByKey, templatePreviewView?.templateId]);
  const hasTieredHeader = activeSheetColumns.some((column) => Boolean(column.topLabel || column.bottomLabel));
  const topHeaderGroups = useMemo(() => buildHeaderGroups(activeSheetColumns, (column) => column.topLabel), [activeSheetColumns]);
  const subHeaderGroups = useMemo(() => buildHeaderGroups(activeSheetColumns, (column) => column.bottomLabel), [activeSheetColumns]);
  const visibleRows = [...filteredRows].sort((a, b) => {
    const sortColumn = activeSheetColumns.find((column) => column.key === sortConfig.key);
    const aValue = sortColumn ? sortColumn.get(a) : (a as any)[sortConfig.key];
    const bValue = sortColumn ? sortColumn.get(b) : (b as any)[sortConfig.key];
    const normalizedA = typeof aValue === 'string' ? aValue : val(aValue);
    const normalizedB = typeof bValue === 'string' ? bValue : val(bValue);
    if (normalizedA > normalizedB) return sortConfig.direction === 'asc' ? 1 : -1;
    if (normalizedA < normalizedB) return sortConfig.direction === 'asc' ? -1 : 1;
    return 0;
  });
  const visibleRowKeys = visibleRows.map((row) => rowKey(row));
  const selectedVisibleRows = visibleRows.filter((row) => selectedRowKeys.has(rowKey(row)));
  const allVisibleSelected = visibleRows.length > 0 && visibleRowKeys.every((key) => selectedRowKeys.has(key));
  const exportDisabled = !payrollInputsLoaded || visibleRows.length === 0;
  const peopleDeptOptions = useMemo(() => ['全部', ...Array.from(new Set(peopleSourceRows.map((row) => row.dept || '未分配部门')))], [peopleSourceRows]);
  const peoplePositionOptions = useMemo(() => ['全部', ...Array.from(new Set(peopleSourceRows.map((row) => row.position || '未配置岗位')))], [peopleSourceRows]);
  const peopleQueryMatches = (value: string, query: string) => {
    const keywords = query.split(/[;；,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (!keywords.length) return true;
    const text = value.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  };
  const filteredPeopleRows = useMemo(() => {
    return peopleSourceRows.filter((row) => {
      const matchName = peopleQueryMatches(row.name || '', peopleNameQuery);
      const matchEmployeeNo = peopleQueryMatches(row.employeeNo || '', peopleEmployeeNoQuery);
      const matchDept = peopleDeptFilter === '全部' || (row.dept || '未分配部门') === peopleDeptFilter;
      const matchPosition = peoplePositionFilter === '全部' || (row.position || '未配置岗位') === peoplePositionFilter;
      return matchName && matchEmployeeNo && matchDept && matchPosition;
    });
  }, [peopleDeptFilter, peopleEmployeeNoQuery, peopleNameQuery, peoplePositionFilter, peopleSourceRows]);
  const peopleTotalPages = Math.max(1, Math.ceil(filteredPeopleRows.length / PEOPLE_DATA_PAGE_SIZE));
  const normalizedPeoplePage = Math.min(Math.max(peoplePage, 1), peopleTotalPages);
  const paginatedPeopleRows = useMemo(() => {
    const start = (normalizedPeoplePage - 1) * PEOPLE_DATA_PAGE_SIZE;
    return filteredPeopleRows.slice(start, start + PEOPLE_DATA_PAGE_SIZE);
  }, [filteredPeopleRows, normalizedPeoplePage]);

  useEffect(() => {
    clearLegacySalaryCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPayrollInputs() {
      setPayrollInputsLoaded(false);
      try {
        const [foundationResult, monthlyResult, organizationsResult, positionsResult, rosterResult] = await Promise.allSettled([
          fetchPayrollFoundation(),
          fetchMonthlySummaryEmployees(),
          fetchOrganizations(),
          fetchOrganizationPositions(),
          fetchEmployeeRoster(),
        ]);
        if (cancelled) return;
        const period = foundationResult.status === 'fulfilled'
          ? foundationResult.value.summary?.currentPeriod
          : undefined;
        if (organizationsResult.status === 'fulfilled') {
          setOrganizationRows(organizationsResult.value.rows || []);
        }
        if (positionsResult.status === 'fulfilled') {
          setOrganizationPositions(positionsResult.value.rows || []);
        }
        if (rosterResult.status === 'fulfilled') {
          setEmployeeRosterRows(rosterResult.value.rows || []);
        }
        if (monthlyResult.status !== 'fulfilled') {
          setPayrollInputStatus('员工和考勤联动数据读取失败');
          setPayrollInputsLoaded(false);
          return;
        }
        const month = periodToPayrollMonth(period);
        const nextRows = monthlyResult.value.rows
          .map((row, index) => monthlySummaryToPayrollRow(row, index, month))
          .filter((row) => row.employeeNo && row.position && row.position !== '-');
        setRows(enrichPayrollRows(nextRows));
        setPayrollInputStatus(`已联通员工 ${nextRows.length} 人，考勤月汇总 ${monthlyResult.value.total} 条`);
        setPayrollInputsLoaded(true);
      } catch {
        if (!cancelled) {
          setPayrollInputStatus('员工和考勤联动数据读取失败');
          setPayrollInputsLoaded(false);
        }
      }
    }
    loadPayrollInputs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSalaryCalculationState()
      .then(({ state }) => {
        if (cancelled || !state) return;
        if (state.schemaVersion !== SALARY_STATE_SCHEMA_VERSION) {
          setSalaryPersistenceStatus('已清理旧薪酬测试记录');
          return;
        }
        const sanitizedState = sanitizeSalaryCalculationState(state);
        if (Array.isArray(sanitizedState.manualRuleTemplates)) setManualRuleTemplates(sanitizedState.manualRuleTemplates as RuleTemplate[]);
        if (Array.isArray(sanitizedState.departmentCategories) && sanitizedState.departmentCategories.length) {
          setDepartmentCategories(sanitizedState.departmentCategories as DepartmentCategory[]);
        }
        if (sanitizedState.templateNameOverrides && typeof sanitizedState.templateNameOverrides === 'object') {
          setTemplateNameOverrides(sanitizedState.templateNameOverrides as Record<string, string>);
        }
        setDeletedRuleTemplateIds(new Set(Array.isArray(sanitizedState.deletedRuleTemplateIds) ? sanitizedState.deletedRuleTemplateIds : []));
        if (sanitizedState.templateAssignments && typeof sanitizedState.templateAssignments === 'object') setTemplateAssignments(sanitizedState.templateAssignments as Record<string, TemplateAssignment>);
        if (sanitizedState.peopleDataOverrides && typeof sanitizedState.peopleDataOverrides === 'object') setPeopleDataOverrides(sanitizedState.peopleDataOverrides as Record<string, PeopleDataOverride>);
        if (sanitizedState.formulaDrafts && typeof sanitizedState.formulaDrafts === 'object') setFormulaDrafts(sanitizeFormulaDrafts(sanitizedState.formulaDrafts));
        if (sanitizedState.fieldConfigs && typeof sanitizedState.fieldConfigs === 'object') setFieldConfigs(sanitizeFieldConfigs(sanitizedState.fieldConfigs as Record<string, RuleFieldConfig>));
        setActivePosition('全部');
        setActiveAssignmentTemplateId('');
        setTemplatePreviewView(null);
        setSelectedRowKeys(new Set());
        setSalaryPersistenceStatus(state.updatedAt ? '已读取后端薪酬记录' : '已连接薪酬记录');
      })
      .catch(() => {
        if (!cancelled) setSalaryPersistenceStatus('薪酬记录服务连接失败，暂用本机缓存');
      })
      .finally(() => {
        if (!cancelled) setSalaryStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!salaryStateLoaded) return;
    if (salarySaveTimerRef.current) clearTimeout(salarySaveTimerRef.current);
    const ruleTemplateIdSet = new Set(ruleTemplates.map((template) => template.id));
    const validManualTemplateIds = new Set(manualRuleTemplates.map((template) => template.id));
    const sanitizedTemplateAssignments = sanitizeTemplateAssignments(templateAssignments, ruleTemplateIdSet, assignmentEmployeeByKey);
    const deletedFieldConfigKeys = new Set(Object.entries(fieldConfigs).filter(([, config]) => config.deleted).map(([key]) => key));
    const state: SalaryCalculationState = {
      schemaVersion: SALARY_STATE_SCHEMA_VERSION,
      manualRuleTemplates: sanitizeManualRuleTemplates(manualRuleTemplates),
      departmentCategories,
      deletedRuleTemplateIds: sanitizeDeletedRuleTemplateIds(Array.from(deletedRuleTemplateIds)),
      templateNameOverrides: sanitizeTemplateNameOverrides(templateNameOverrides, validManualTemplateIds),
      templateAssignments: sanitizedTemplateAssignments,
      peopleDataOverrides: Object.fromEntries(
        Object.entries(peopleDataOverrides).filter(([key, value]) => !containsLegacySalaryTestValue(key) && !containsLegacySalaryTestValue(value)),
      ),
      formulaDrafts: sanitizeFormulaDrafts(formulaDrafts, deletedFieldConfigKeys),
      fieldConfigs: sanitizeFieldConfigs(fieldConfigs),
    };
    salarySaveTimerRef.current = setTimeout(() => {
      saveSalaryCalculationState(state)
        .then(() => setSalaryPersistenceStatus('薪酬记录已保存'))
        .catch(() => setSalaryPersistenceStatus('薪酬记录保存失败'));
    }, 500);
    return () => {
      if (salarySaveTimerRef.current) clearTimeout(salarySaveTimerRef.current);
    };
  }, [
    assignmentEmployeeByKey,
    departmentCategories,
    fieldConfigs,
    formulaDrafts,
    manualRuleTemplates,
    peopleDataOverrides,
    deletedRuleTemplateIds,
    ruleTemplates,
    salaryStateLoaded,
    templateAssignments,
    templateNameOverrides,
  ]);

  useEffect(() => {
    if (assignmentTemplateId && !ruleTemplates.some((template) => template.id === assignmentTemplateId)) {
      setAssignmentTemplateId('');
      setAssignmentPosition('');
      setAssignmentCategoryId('');
      setAssignmentEmployeeSearch('');
      setPendingAssignmentEmployeeKeys(new Set());
    }
  }, [assignmentTemplateId, ruleTemplates]);

  useEffect(() => {
    if (activeAssignmentTemplateId && !assignmentResultViews.some((item) => item.template.id === activeAssignmentTemplateId)) {
      setActiveAssignmentTemplateId('');
      setImportStatus('');
    }
  }, [activeAssignmentTemplateId, assignmentResultViews]);

  useEffect(() => {
    setSelectedTemplateIds((current) => {
      const validIds = new Set(ruleTemplates.map((template) => template.id));
      const next = new Set(Array.from(current).filter((templateId) => validIds.has(templateId)));
      return next.size === current.size ? current : next;
    });
  }, [ruleTemplates]);

  useEffect(() => {
    setTemplatePage(1);
    setTemplatePageDraft('1');
  }, [templateFilters.dept, templateFilters.group, templateFilters.position]);

  useEffect(() => {
    if (templatePage > templateTotalPages) setTemplatePage(templateTotalPages);
    if (templatePage < 1) setTemplatePage(1);
  }, [templatePage, templateTotalPages]);

  useEffect(() => {
    setTemplatePageDraft(String(normalizedTemplatePage));
  }, [normalizedTemplatePage]);

  useEffect(() => {
    setPeoplePage(1);
    setPeoplePageDraft('1');
  }, [peopleDeptFilter, peopleEmployeeNoQuery, peopleNameQuery, peoplePositionFilter]);

  useEffect(() => {
    if (peoplePage > peopleTotalPages) setPeoplePage(peopleTotalPages);
    if (peoplePage < 1) setPeoplePage(1);
  }, [peoplePage, peopleTotalPages]);

  useEffect(() => {
    setPeoplePageDraft(String(normalizedPeoplePage));
  }, [normalizedPeoplePage]);

  useEffect(() => {
    if (!rulePositions.includes(rulePosition)) {
      setRulePosition(rulePositions[0] || '全部');
      setRuleEmployeeKey('*');
    }
  }, [rulePosition, rulePositions]);

  useEffect(() => {
    if (ruleMode === 'person' && ruleEmployeeKey !== '*' && !ruleEmployees.some((row) => rowKey(row) === ruleEmployeeKey)) {
      setRuleEmployeeKey('*');
    }
  }, [ruleEmployeeKey, ruleEmployees, ruleMode]);

  useEffect(() => {
    const clearCurrentGroupSession = () => {
      setGroupAnchorFieldKey('');
      setSelectedGroupFieldKeys(new Set());
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control' && !event.repeat) clearCurrentGroupSession();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') clearCurrentGroupSession();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearCurrentGroupSession);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearCurrentGroupSession);
    };
  }, []);

  const handleExport = async () => {
    if (!payrollInputsLoaded) {
      setImportStatus('正在读取员工主数据和考勤月汇总，稍后再导出');
      return;
    }
    if (!visibleRows.length) {
      setImportStatus('暂无可导出的薪酬数据');
      return;
    }
    if (!activeSheetColumns.length) {
      setImportStatus('暂无可导出的表头');
      return;
    }
    const exportRows = selectedVisibleRows.length ? selectedVisibleRows : visibleRows;
    const headerRows = hasTieredHeader
      ? [
        activeSheetColumns.map((column) => column.topLabel ?? ''),
        activeSheetColumns.map((column) => column.bottomLabel ?? ''),
        activeSheetColumns.map((column) => column.label),
      ]
      : [activeSheetColumns.map((column) => column.label)];
    const body = exportRows.map((row) => activeSheetColumns.map((column) => excelCellValue(column.get(row))));
    const hasBodyContent = body.some((row) => row.some((value) => String(value ?? '').trim() !== ''));
    if (!hasBodyContent) {
      setImportStatus('当前选择的数据没有可导出的内容');
      return;
    }
    try {
      const exportResult = await downloadXlsxWorkbook({
        fileName: `薪酬核算对账_${monthFilter || '全部'}_${payrollGroupLabel(activeGroup)}_${activePosition}`,
        sheets: [{
          name: '薪酬核算',
          rows: [...headerRows, ...body],
          merges: hasTieredHeader ? xlsxHorizontalMerges(headerRows.slice(0, -1)) : [],
        }],
        saveAs: true,
      });
      setImportStatus(exportResult === 'cancelled' ? '已取消导出' : `已保存 ${exportRows.length} 条 ${activeSheetColumns.length} 列 Excel`);
    } catch (error: any) {
      setImportStatus(error?.message || '导出失败');
    }
  };

  const exportPeopleData = async () => {
    const headers = ['姓名', '部门', '岗位', '实际出勤天数', '平方'];
    if (!filteredPeopleRows.length) {
      setRuleStatus('暂无可导出的人员数据');
      return;
    }
    const body = filteredPeopleRows.map((row) => [
      row.name,
      row.dept,
      row.position,
      row.actualWorkDaysForSalary,
      row.squareForSalary,
    ]);
    const hasBodyContent = body.some((row) => row.some((value) => String(value ?? '').trim() !== ''));
    if (!hasBodyContent) {
      setRuleStatus('当前筛选的人员数据没有可导出的内容');
      return;
    }
    try {
      const exportResult = await downloadXlsxWorkbook({
        fileName: `薪酬人员数据_${new Date().toISOString().slice(0, 10)}`,
        sheets: [{ name: '人员数据', rows: [headers, ...body] }],
        saveAs: true,
      });
      setRuleStatus(exportResult === 'cancelled' ? '已取消导出人员数据' : `已保存 ${filteredPeopleRows.length} 条 ${headers.length} 列 Excel`);
    } catch (error: any) {
      setRuleStatus(error?.message || '人员数据导出失败');
    }
  };

  const handlePeopleDataImport = async (files: File[]) => {
    if (!files.length) return;
    const textValue = (value: unknown) => String(value ?? '').trim();
    const headerText = (value: unknown) => textValue(value).replace(/\s/g, '').toLowerCase();
    const columnIndex = (headers: unknown[], aliases: string[]) => {
      const normalizedAliases = aliases.map((alias) => headerText(alias));
      return headers.findIndex((header) => normalizedAliases.some((alias) => headerText(header).includes(alias)));
    };
    const peopleByEmployeeNo = new Map<string, PeopleDataRow>();
    const peopleByNamePosition = new Map<string, PeopleDataRow>();
    const peopleByNameDept = new Map<string, PeopleDataRow>();
    const peopleByUniqueName = new Map<string, PeopleDataRow | null>();
    peopleSourceRows.forEach((row) => {
      const employeeNo = textValue(row.employeeNo).toLowerCase();
      const name = textValue(row.name).toLowerCase();
      const position = textValue(row.position).toLowerCase();
      const dept = textValue(row.dept).toLowerCase();
      if (employeeNo) peopleByEmployeeNo.set(employeeNo, row);
      if (name && position) peopleByNamePosition.set(`${name}::${position}`, row);
      if (name && dept) peopleByNameDept.set(`${name}::${dept}`, row);
      if (name) peopleByUniqueName.set(name, peopleByUniqueName.has(name) ? null : row);
    });

    let matched = 0;
    let importedRows = 0;
    let scannedSheets = 0;
    const nextOverrides: Record<string, PeopleDataOverride> = {};
    try {
      const XLSX = await import('xlsx');
      for (const file of files) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const table = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];
          if (!table.length) continue;
          scannedSheets += 1;
          const headerRowIndex = table.findIndex((row) => {
            const squareIndex = columnIndex(row, ['平方', '平米', '面积', '平方数']);
            const nameIndex = columnIndex(row, ['姓名', '员工姓名', '人员', '名字']);
            const employeeNoIndex = columnIndex(row, ['员工号', '工号', '员工编号', '人员编号']);
            return squareIndex >= 0 && (nameIndex >= 0 || employeeNoIndex >= 0);
          });
          if (headerRowIndex < 0) continue;
          const headers = table[headerRowIndex];
          const squareIndex = columnIndex(headers, ['平方', '平米', '面积', '平方数']);
          const nameIndex = columnIndex(headers, ['姓名', '员工姓名', '人员', '名字']);
          const employeeNoIndex = columnIndex(headers, ['员工号', '工号', '员工编号', '人员编号']);
          const positionIndex = columnIndex(headers, ['岗位', '职位']);
          const deptIndex = columnIndex(headers, ['部门', '所属部门', '门店']);
          table.slice(headerRowIndex + 1).forEach((row) => {
            const square = normalizeNumber(row[squareIndex]);
            if (square === null) return;
            importedRows += 1;
            const employeeNo = employeeNoIndex >= 0 ? textValue(row[employeeNoIndex]).toLowerCase() : '';
            const name = nameIndex >= 0 ? textValue(row[nameIndex]).toLowerCase() : '';
            const position = positionIndex >= 0 ? textValue(row[positionIndex]).toLowerCase() : '';
            const dept = deptIndex >= 0 ? textValue(row[deptIndex]).toLowerCase() : '';
            const matchedPerson = (employeeNo && peopleByEmployeeNo.get(employeeNo))
              || (name && position && peopleByNamePosition.get(`${name}::${position}`))
              || (name && dept && peopleByNameDept.get(`${name}::${dept}`))
              || (name && peopleByUniqueName.get(name))
              || null;
            if (!matchedPerson) return;
            matched += 1;
            nextOverrides[matchedPerson.peopleKey] = {
              ...peopleDataOverrides[matchedPerson.peopleKey],
              ...nextOverrides[matchedPerson.peopleKey],
              square,
            };
          });
        }
      }
      if (!matched) {
        setRuleStatus(`已读取 ${files.length} 个文件、${scannedSheets} 个sheet，未匹配到人员平方数据`);
        return;
      }
      setPeopleDataOverrides((current) => ({ ...current, ...nextOverrides }));
      setRuleStatus(`已导入 ${files.length} 个文件、${scannedSheets} 个sheet，识别平方 ${importedRows} 条，匹配 ${matched} 人`);
    } catch {
      setRuleStatus('人员数据导入失败');
    } finally {
      if (peopleDataImportInputRef.current) peopleDataImportInputRef.current.value = '';
    }
  };

  const jumpPeoplePage = () => {
    const page = Number(peoplePageDraft);
    if (!Number.isFinite(page)) {
      setPeoplePageDraft(String(normalizedPeoplePage));
      return;
    }
    setPeoplePage(Math.min(Math.max(Math.floor(page), 1), peopleTotalPages));
  };

  const createRuleTemplate = () => {
    const position = templateFilters.position !== '全部'
      ? templateFilters.position
      : rulePosition && rulePosition !== '全部'
        ? rulePosition
        : rulePositions[0] || rows[0]?.position || '未设置岗位';
    const dept = templateFilters.dept !== '全部'
      ? templateFilters.dept
      : rows.find((row) => row.position === position)?.dept || deptForPosition(position);
    const template: RuleTemplate = {
      id: `manual-${Date.now()}`,
      name: '新建模板',
      group: PAYROLL_GROUP,
      position,
      dept,
      fieldCount: managementSheetColumns.length,
      custom: true,
    };
    setManualRuleTemplates((current) => [...current, template]);
    setTemplateFilters((current) => ({ ...current, dept, group: PAYROLL_GROUP_LABEL, position }));
    setActiveRuleTemplateId(template.id);
    setRenamingTemplateId(template.id);
    setRenameTemplateValue(template.name);
    setRuleStatus('已新增模板');
  };

  const startRenamingTemplate = (template: RuleTemplate) => {
    setRenamingTemplateId(template.id);
    setRenameTemplateValue(template.name);
  };

  const commitTemplateRename = () => {
    if (!renamingTemplateId) return;
    const nextName = renameTemplateValue.trim() || '新建模板';
    setManualRuleTemplates((current) => current.map((template) => (
      template.id === renamingTemplateId ? { ...template, name: nextName } : template
    )));
    setTemplateNameOverrides((current) => ({
      ...current,
      [renamingTemplateId]: nextName,
    }));
    setRenamingTemplateId('');
    setRenameTemplateValue('');
    setRuleStatus('模板名称已更新');
  };

  const cancelTemplateRename = () => {
    setRenamingTemplateId('');
    setRenameTemplateValue('');
  };

  const handleTemplateImport = async (file: File | null) => {
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const table = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];
      const headerRow = table.find((row) => row.some((cell) => String(cell ?? '').trim()));
      const headerNames = (headerRow || []).map((cell, index) => String(cell || `表头${index + 1}`).trim()).filter(Boolean);
      const position = templateFilters.position !== '全部' ? templateFilters.position : rulePosition;
      const dept = templateFilters.dept !== '全部'
        ? templateFilters.dept
        : rows.find((row) => row.position === position)?.dept || deptForPosition(position);
      const stamp = Date.now();
      const template: RuleTemplate = {
        id: `import-${stamp}`,
        name: `${file.name.replace(/\.[^.]+$/, '') || position}模板`,
        group: PAYROLL_GROUP,
        position,
        dept,
        fieldCount: headerNames.length || managementSheetColumns.length,
        custom: true,
      };
      if (headerNames.length) {
        const nextConfigs: Record<string, RuleFieldConfig> = {};
        headerNames.forEach((label, index) => {
          const key = `import_${stamp}_${index}`;
          nextConfigs[fieldConfigKey(PAYROLL_GROUP, position, selectedRuleEmployeeKey, key, template.id)] = {
            key,
            label,
            source: '输入项',
            formula: emptyFormula,
            groupTop: '',
            groupSub: '',
            groupId: '',
            op1: '',
            value1: '',
            op2: '',
            value2: '',
            custom: true,
          };
        });
        setFieldConfigs((current) => ({ ...current, ...nextConfigs }));
      }
      setManualRuleTemplates((current) => [...current, template]);
      setTemplateFilters((current) => ({ ...current, dept, group: PAYROLL_GROUP_LABEL, position }));
      setRuleStatus(`已导入模板：${template.name}`);
    } catch {
      setRuleStatus('导入模板失败');
    } finally {
      if (templateImportInputRef.current) templateImportInputRef.current.value = '';
    }
  };

  const openAssignmentEditor = (template: RuleTemplate) => {
    const current = templateAssignments[template.id];
    const position = current?.position || template.position;
    setRuleSection('assignments');
    setRulePanelMode('templates');
    setAssignmentTemplateId(template.id);
    setAssignmentPosition(position);
    setAssignmentCategoryId(current?.categoryId || '');
    setAssignmentEmployeeSearch('');
    setPendingAssignmentEmployeeKeys(new Set((current?.employeeKeys || []).filter((employeeKey) => {
      const employee = assignmentEmployeeByKey[employeeKey];
      return Boolean(employee);
    })));
    setTemplateAssignments((assignments) => ({
      ...assignments,
      [template.id]: {
        templateId: template.id,
        position,
        categoryId: assignments[template.id]?.categoryId,
        employeeKeys: (assignments[template.id]?.employeeKeys || []).filter((employeeKey) => {
          const employee = assignmentEmployeeByKey[employeeKey];
          return Boolean(employee);
        }),
      },
    }));
    setRuleStatus(`正在编辑${template.name}人员`);
  };

  const togglePendingAssignmentEmployee = (employeeKey: string) => {
    const assignedTemplateId = assignedEmployeeTemplateByKey[employeeKey];
    if (assignedTemplateId && assignedTemplateId !== assignmentTemplateId) return;
    setPendingAssignmentEmployeeKeys((current) => {
      const next = new Set(current);
      if (next.has(employeeKey)) next.delete(employeeKey);
      else next.add(employeeKey);
      return next;
    });
  };

  const updateAssignmentCategory = (categoryId: string) => {
    setAssignmentCategoryId(categoryId);
  };

  const confirmAssignment = () => {
    const template = ruleTemplates.find((item) => item.id === assignmentTemplateId);
    const targetPosition = assignmentPosition || template?.position || '设计总监';
    const boundEmployeeKeys = Array.from(pendingAssignmentEmployeeKeys).filter((key) => {
      const assignedTemplateId = assignedEmployeeTemplateByKey[key];
      const employee = assignmentEmployeeByKey[key];
      return employee
        && (!assignedTemplateId || assignedTemplateId === assignmentTemplateId);
    });
    if (!assignmentTemplateId || boundEmployeeKeys.length === 0) return;

    setTemplateAssignments((current) => ({
      ...current,
      [assignmentTemplateId]: {
        templateId: assignmentTemplateId,
        position: targetPosition,
        categoryId: assignmentCategoryId || undefined,
        employeeKeys: boundEmployeeKeys,
      },
    }));
    setActiveView('calculation');
    setExpandedSections((current) => ({ ...current, calculation: true, payrollGroup: true }));
    setExpandedCategoryIds((current) => ({ ...current, [assignmentCategoryId || UNCATEGORIZED_CATEGORY_ID]: true }));
    setActiveGroup(template?.group || PAYROLL_GROUP);
    setActivePosition('全部');
    setDeptFilter('全部');
    setMonthFilter('');
    setEmployeeQuery('');
    setSelectedRowKeys(new Set());
    setActiveAssignmentTemplateId(assignmentTemplateId);
    setTemplatePreviewView(null);
    setAssignmentTemplateId('');
    setAssignmentPosition('');
    setAssignmentCategoryId('');
    setAssignmentEmployeeSearch('');
    setPendingAssignmentEmployeeKeys(new Set());
    setImportStatus(`已按人员分配展示 ${boundEmployeeKeys.length} 人`);
    setRuleStatus(`人员分配已确认，已跳转到全部岗位 / ${targetPosition}`);
  };

  const unbindAssignmentEmployee = (templateId: string, employeeKey: string) => {
    setTemplateAssignments((current) => {
      const existing = current[templateId];
      if (!existing) return current;
      return {
        ...current,
        [templateId]: {
          ...existing,
          employeeKeys: existing.employeeKeys.filter((key) => key !== employeeKey),
        },
      };
    });
    if (templateId === assignmentTemplateId) {
      setPendingAssignmentEmployeeKeys((current) => {
        const next = new Set(current);
        next.delete(employeeKey);
        return next;
      });
    }
    setRuleStatus('已取消绑定');
  };

  const toggleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleRowSelection = (key: string) => {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleRowKeys.forEach((key) => next.delete(key));
      } else {
        visibleRowKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const openRuleEditor = (field: RuleFieldRow) => {
    setEditingRuleField(field);
    setRuleFieldDraft({ ...field });
    setRuleStatus('');
  };

  const openTemplateDetail = (template: RuleTemplate) => {
    setRuleGroup(template.group);
    setRulePosition(template.position);
    setRuleEmployeeKey('*');
    setActiveRuleTemplateId(template.id);
    setRulePanelMode('detail');
    setRuleStatus('');
  };

  const openTemplateModal = (template: RuleTemplate, modal: 'export') => {
    openTemplateDetail(template);
    const columns = baseColumnsForPosition(template.group, template.position);
    setExportFieldKeys(new Set(columns.map((column) => column.key)));
    setRuleModal(modal);
  };

  const requestDeleteSelectedTemplates = () => {
    if (!selectedTemplateIds.size) return;
    setDeleteTemplateTarget({ id: '__batch__', name: `${selectedTemplateIds.size} 个模板`, group: PAYROLL_GROUP, position: '', fieldCount: selectedTemplateIds.size });
  };

  const deleteRuleTemplates = (templateIds: string[]) => {
    const idSet = new Set(templateIds);
    setManualRuleTemplates((current) => current.filter((item) => !idSet.has(item.id)));
    setTemplateNameOverrides((current) => {
      const next = { ...current };
      idSet.forEach((templateId) => delete next[templateId]);
      return next;
    });
    setDeletedRuleTemplateIds((current) => {
      const next = new Set(current);
      idSet.forEach((templateId) => next.add(templateId));
      return next;
    });
    setTemplateAssignments((current) => {
      const next = { ...current };
      idSet.forEach((templateId) => delete next[templateId]);
      return next;
    });
    setFieldConfigs((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !Array.from(idSet).some((templateId) => key.includes(`::template:${templateId}::`))),
    ) as Record<string, RuleFieldConfig>);
    setFormulaDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !Array.from(idSet).some((templateId) => key.includes(`::template:${templateId}::`))),
    ));
    if (idSet.has(activeRuleTemplateId)) {
      setActiveRuleTemplateId('');
      setRulePanelMode('templates');
    }
    if (idSet.has(assignmentTemplateId)) {
      setAssignmentTemplateId('');
      setAssignmentPosition('');
      setAssignmentCategoryId('');
      setAssignmentEmployeeSearch('');
      setPendingAssignmentEmployeeKeys(new Set());
    }
    if (templatePreviewView?.templateId && idSet.has(templatePreviewView.templateId)) {
      setTemplatePreviewView(null);
      setImportStatus('');
    }
    if (idSet.has(activeAssignmentTemplateId)) {
      setActiveAssignmentTemplateId('');
      setImportStatus('');
    }
    if (idSet.has(renamingTemplateId)) {
      cancelTemplateRename();
    }
    setSelectedTemplateIds((current) => new Set(Array.from(current).filter((templateId) => !idSet.has(templateId))));
    setDeleteTemplateTarget(null);
    setRuleStatus(`已删除 ${templateIds.length} 个模板`);
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  };

  const toggleSelectAllFilteredTemplates = () => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (allFilteredTemplatesSelected) paginatedRuleTemplateIds.forEach((templateId) => next.delete(templateId));
      else paginatedRuleTemplateIds.forEach((templateId) => next.add(templateId));
      return next;
    });
  };

  const jumpToTemplatePage = () => {
    const parsed = Number(templatePageDraft);
    const nextPage = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), 1), templateTotalPages)
      : normalizedTemplatePage;
    setTemplatePage(nextPage);
    setTemplatePageDraft(String(nextPage));
  };

  const currentRuleTemplate = () => {
    return ruleTemplates.find((template) => template.id === activeRuleTemplateId)
      || ruleTemplates.find((template) => template.group === ruleGroup && template.position === rulePosition)
      || null;
  };

  const confirmTemplateToAssignments = () => {
    const template = currentRuleTemplate();
    if (!template) return;
    openAssignmentEditor(template);
    setRuleStatus('模板已确认，请分配人员');
  };

  const previewCurrentTemplate = () => {
    const template = currentRuleTemplate();
    if (!template) return;
    setActiveView('calculation');
    setExpandedSections((current) => ({ ...current, calculation: true, payrollGroup: true }));
    setActiveGroup(template.group);
    setActivePosition(template.position);
    setTemplatePreviewView({ templateId: template.id, position: template.position });
    setActiveAssignmentTemplateId('');
    setDeptFilter('全部');
    setMonthFilter('');
    setEmployeeQuery('');
    setSelectedRowKeys(new Set());
    setImportStatus(`${template.name}预览中`);
  };

  const exitTemplatePreview = () => {
    setTemplatePreviewView(null);
    setImportStatus('');
    setActiveView('rules');
    setRuleSection('templates');
    setRulePanelMode('detail');
  };

  const exitAssignmentResult = () => {
    setActiveAssignmentTemplateId('');
    setImportStatus('');
  };

  const exportTemplateFields = async (template: RuleTemplate | null, fields: RuleFieldRow[]) => {
    const headers = ['序号', '一级表头', '二级表头', '表头名称', '来源', '运算输入', '运算符', '公式算法', '是否薪资列'];
    const rows = fields.map((field, index) => [
      index + 1,
      field.groupTop || '',
      field.groupSub || '',
      field.label || '空表头',
      field.source || '',
      field.value1 || '',
      field.op1 || '',
      field.formula || buildOperationText(field) || '',
      field.label === '薪资' ? '是' : '否',
    ]);
    try {
      const exportResult = await downloadXlsxWorkbook({
        fileName: `岗位模板导出项_${template?.name || rulePosition || '模板'}`,
        sheets: [
          { name: '导出项', rows: [headers, ...rows] },
          { name: '公式摘要', rows: [['模板', template?.name || rulePosition || ''], ['公式算法', buildTemplateFormulaText(fields)]] },
        ],
      });
      setRuleStatus(exportResult === 'cancelled' ? '已取消导出项' : `${exportResult === 'saved' ? '已保存' : '已下载'}${template?.name || rulePosition || '模板'}导出项 ${fields.length} 个`);
    } catch (error) {
      setRuleStatus('导出项导出失败');
    }
  };

  const openCurrentTemplateExport = async () => {
    await exportTemplateFields(currentRuleTemplate(), ruleFields);
  };

  const exportTemplateFromList = async (template: RuleTemplate) => {
    const fields = ruleFieldsForScope(template.group, template.position, '*', fieldConfigs, template.id);
    await exportTemplateFields(template, fields);
  };

  const saveRuleEditor = () => {
    if (!editingRuleField || !ruleFieldDraft) return;
    if (ruleMode === 'person' && selectedRuleEmployeeKey === '*') {
      setRuleStatus('请选择人员');
      return;
    }
    const finalFormula = ruleFieldDraft.formula || buildOperationText(ruleFieldDraft) || emptyFormula;
    const nextConfig = { ...ruleFieldDraft, formula: finalFormula };
    const key = fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, editingRuleField.key, activeRuleTemplateId);
    const formulaKey = formulaRuleKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, editingRuleField.key, activeRuleTemplateId);
    setFieldConfigs((current) => ({ ...current, [key]: nextConfig }));
    setFormulaDrafts((current) => ({ ...current, [formulaKey]: finalFormula }));
    setEditingRuleField(null);
    setRuleFieldDraft(null);
    setRuleStatus('已保存');
  };

  const addRuleField = () => {
    if (ruleMode === 'person' && selectedRuleEmployeeKey === '*') {
      setRuleStatus('请选择人员');
      return;
    }
    const key = `custom_${Date.now()}`;
    const draft: RuleFieldConfig = {
      key,
      label: '新增字段',
      source: '岗位模板',
      formula: '',
      groupTop: '',
      groupSub: '',
      groupId: '',
      op1: '+',
      value1: '',
      op2: '',
      value2: '',
      custom: true,
    };
    setFieldConfigs((current) => ({
      ...current,
      [fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, key, activeRuleTemplateId)]: draft,
    }));
    setRuleStatus('已新增字段');
  };

  const deleteRuleField = (field: RuleFieldRow) => {
    const key = fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key, activeRuleTemplateId);
    const { baseColumn, ...fieldConfig } = field;
    setFieldConfigs((current) => ({
      ...current,
      [key]: { ...fieldConfig, deleted: true },
    }));
    setRuleStatus('已删除字段');
  };

  const updateRuleFieldGroup = (field: RuleFieldRow, patch: Pick<Partial<RuleFieldConfig>, 'groupTop' | 'groupSub'>) => {
    const targetKeys = field.groupId
      ? new Set(ruleFields.filter((item) => item.groupId === field.groupId).map((item) => item.key))
      : selectedGroupFieldKeys.has(field.key) ? selectedGroupFieldKeys : new Set([field.key]);
    setFieldConfigs((current) => {
      const next = { ...current };
      ruleFields
        .filter((item) => targetKeys.has(item.key))
        .forEach((item) => {
          const { baseColumn, ...fieldConfig } = item;
          next[fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, item.key, activeRuleTemplateId)] = {
            ...fieldConfig,
            ...patch,
          };
        });
      return next;
    });
    setRuleStatus(targetKeys.size > 1 ? `已更新 ${targetKeys.size} 个表头分组` : '已更新表头分组');
  };

  const addFieldToGroupSelection = (field: RuleFieldRow) => {
    const anchor = ruleFields.find((item) => item.key === groupAnchorFieldKey);
    if (!anchor) {
      setGroupAnchorFieldKey(field.key);
      setSelectedGroupFieldKeys(new Set([field.key]));
      setRuleStatus('已选中分组起点');
      return;
    }
    const nextGroupId = anchor.groupId || `group-${Date.now()}`;
    const selectedKeys = new Set([anchor.key, field.key]);
    setSelectedGroupFieldKeys(selectedKeys);
    setFieldConfigs((current) => {
      const next = { ...current };
      ruleFields
        .filter((item) => selectedKeys.has(item.key) || item.groupId === nextGroupId)
        .forEach((item) => {
          const { baseColumn, ...fieldConfig } = item;
          next[fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, item.key, activeRuleTemplateId)] = {
            ...fieldConfig,
            groupId: nextGroupId,
            groupTop: anchor.groupTop || item.groupTop || '',
            groupSub: anchor.groupSub || item.groupSub || '',
          };
        });
      return next;
    });
    setRuleStatus('已加入表头分组');
  };

  const removeFieldFromGroup = (field: RuleFieldRow) => {
    const { baseColumn, ...fieldConfig } = field;
    setFieldConfigs((current) => ({
      ...current,
      [fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key, activeRuleTemplateId)]: {
        ...fieldConfig,
        groupTop: '',
        groupSub: '',
        groupId: '',
      },
    }));
    setSelectedGroupFieldKeys((current) => {
      const next = new Set(current);
      next.delete(field.key);
      return next;
    });
    if (groupAnchorFieldKey === field.key) setGroupAnchorFieldKey('');
    setRuleStatus('已移出表头分组');
  };

  const reorderRuleField = (sourceKey: string, targetKey: string) => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    const sourceField = ruleFields.find((field) => field.key === sourceKey);
    if (!sourceField) return;
    const sourceGroupTop = String(sourceField.groupTop || '').trim();
    const sourceGroupSub = String(sourceField.groupSub || '').trim();
    const movingKeySet = sourceField.groupId
      ? new Set(ruleFields.filter((field) => field.groupId === sourceField.groupId).map((field) => field.key))
      : sourceGroupTop || sourceGroupSub
      ? new Set(ruleFields.filter((field) => String(field.groupTop || '').trim() === sourceGroupTop && String(field.groupSub || '').trim() === sourceGroupSub).map((field) => field.key))
      : new Set([sourceKey]);
    if (movingKeySet.has(targetKey)) {
      setDraggingRuleFieldKey('');
      return;
    }
    const movingFields = ruleFields.filter((field) => movingKeySet.has(field.key));
    const remainingFields = ruleFields.filter((field) => !movingKeySet.has(field.key));
    const targetIndex = remainingFields.findIndex((field) => field.key === targetKey);
    if (targetIndex < 0 || !movingFields.length) return;
    const nextFields = [...remainingFields];
    nextFields.splice(targetIndex, 0, ...movingFields);
    setFieldConfigs((current) => {
      const next = { ...current };
      nextFields.forEach((field, index) => {
        const { baseColumn, ...fieldConfig } = field;
        next[fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key, activeRuleTemplateId)] = {
          ...fieldConfig,
          order: index,
        };
      });
      return next;
    });
    setDraggingRuleFieldKey('');
    setRuleStatus(movingFields.length > 1 ? `已移动 ${movingFields.length} 个表头` : '已调整表头顺序');
  };

  const saveExportFields = () => {
    setRuleModal(null);
    setRuleStatus(`导出项已保存 ${exportFieldKeys.size} 个字段`);
  };

  const createDepartmentCategory = () => {
    const nextCategory = { id: `category-${Date.now()}`, name: '新建部门' };
    setDepartmentCategories((current) => [...current, nextCategory]);
    setRenamingCategoryId(nextCategory.id);
    setRenameCategoryValue(nextCategory.name);
    setRuleStatus('已新增部门分类');
  };

  const startRenamingCategory = (category: DepartmentCategory) => {
    setRenamingCategoryId(category.id);
    setRenameCategoryValue(category.name);
  };

  const commitCategoryRename = () => {
    if (!renamingCategoryId) return;
    const nextName = renameCategoryValue.trim() || '未命名部门';
    setDepartmentCategories((current) => current.map((category) => (
      category.id === renamingCategoryId ? { ...category, name: nextName } : category
    )));
    setRenamingCategoryId('');
    setRenameCategoryValue('');
    setRuleStatus('部门分类已更新');
  };

  const deleteDepartmentCategory = (categoryId: string) => {
    setDepartmentCategories((current) => current.filter((category) => category.id !== categoryId));
    setTemplateAssignments((current) => Object.fromEntries(
      Object.entries(current).map(([templateId, assignment]) => [
        templateId,
        assignment.categoryId === categoryId ? { ...assignment, categoryId: undefined } : assignment,
      ]),
    ) as Record<string, TemplateAssignment>);
    if (assignmentCategoryId === categoryId) setAssignmentCategoryId('');
    if (renamingCategoryId === categoryId) {
      setRenamingCategoryId('');
      setRenameCategoryValue('');
    }
    setRuleStatus('部门分类已删除，相关模板已转入未分类');
  };

  const closeAssignmentEditor = () => {
    setAssignmentTemplateId('');
    setAssignmentPosition('');
    setAssignmentCategoryId('');
    setAssignmentEmployeeSearch('');
    setPendingAssignmentEmployeeKeys(new Set());
  };

  const renderHeaderCell = (col: SheetColumn, text: string) => (
      <button
        onClick={() => setActiveFormulaColumn(col)}
        style={{
          border: 'none',
          background: 'transparent',
          color: headerTextColor,
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          minHeight: 18,
        }}
      >
        {text || '\u00A0'}
      </button>
  );

  const sourceOptionsForField = (field: RuleFieldRow) => {
    if (field.label === '月份') return ['月份日期', '年份', '月份'];
    if (field.label === '门店') return ['组织管理-门店数据', ...organizationStoreOptions];
    if (field.label === '部门') return ['组织管理-部门数据', ...organizationDepartmentOptions];
    if (field.label === '岗位') return ['组织管理-岗位数据', ...organizationPositionOptions];
    if (field.label === '应出勤天数') return ['考勤管理-应出勤天数自动联动'];
    if (field.label === '实际出勤天数') return ['人员数据-实际出勤天数'];
    if (field.label === '平方') return ['人员数据-平方'];
    if (field.label === '薪资') return ['运算插件-薪资结果'];
    return ['输入项', '系统默认', '岗位模板'];
  };

  const updateRuleFieldLabel = (field: RuleFieldRow, label: string) => {
    const sourceOptions = label === '月份'
      ? ['月份日期', '年份', '月份']
      : label === '门店'
      ? ['组织管理-门店数据', ...organizationStoreOptions]
      : label === '部门'
        ? ['组织管理-部门数据', ...organizationDepartmentOptions]
        : label === '岗位'
          ? ['组织管理-岗位数据', ...organizationPositionOptions]
          : label === '应出勤天数'
            ? ['考勤管理-应出勤天数自动联动']
            : label === '实际出勤天数'
              ? ['人员数据-实际出勤天数']
              : label === '平方'
                ? ['人员数据-平方']
                : label === '薪资'
                  ? ['运算插件-薪资结果']
                  : ['输入项'];
    updateRuleFieldConfig(field, { label, source: sourceOptions[0] });
  };

  const updateRuleFieldConfig = (field: RuleFieldRow, patch: Partial<RuleFieldConfig>) => {
    const nextConfig = normalizeFieldAfterPatch(field, patch);
    const { baseColumn, ...config } = nextConfig;
    const finalFormula = config.formula || buildOperationText(config) || emptyFormula;
    const key = fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key, activeRuleTemplateId);
    const formulaKey = formulaRuleKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key, activeRuleTemplateId);
    setFieldConfigs((current) => ({ ...current, [key]: { ...config, formula: finalFormula } }));
    setFormulaDrafts((current) => ({ ...current, [formulaKey]: finalFormula }));
    setRuleStatus('已更新');
  };

  const renderTemplateSearchFilter = (
    label: string,
    key: 'dept' | 'position',
    options: string[],
    dropdownId: string,
    minWidth = 150,
  ) => {
    const value = templateFilters[key] === '全部' ? '' : templateFilters[key];
    const query = value.trim().toLowerCase();
    const visibleOptions = options
      .filter((option) => option !== '全部')
      .filter((option) => !query || option.toLowerCase().includes(query))
      .slice(0, 80);
    const open = openTemplateFilterKey === dropdownId;
    const chooseOption = (option: string) => {
      setTemplateFilters((current) => ({
        ...current,
        [key]: option || '全部',
      }));
      setOpenTemplateFilterKey('');
    };

    return (
      <div
        key={dropdownId}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, padding: '0 8px', color: colors.textMuted, fontSize: 12, boxSizing: 'border-box' }}
      >
        <span style={{ flexShrink: 0 }}>{label}</span>
        <input
          value={value}
          onFocus={() => setOpenTemplateFilterKey(dropdownId)}
          onBlur={() => window.setTimeout(() => setOpenTemplateFilterKey((current) => (current === dropdownId ? '' : current)), 120)}
          onChange={(event) => {
            setTemplateFilters((current) => ({
              ...current,
              [key]: event.target.value || '全部',
            }));
            setOpenTemplateFilterKey(dropdownId);
          }}
          placeholder="请选择或搜索"
          style={{ height: 28, minWidth, border: 'none', outline: 'none', background: 'transparent', color: colors.inputText, fontSize: 12, colorScheme: 'light' }}
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpenTemplateFilterKey((current) => (current === dropdownId ? '' : dropdownId))}
          aria-label={`展开${label}筛选`}
          style={{ width: 18, height: 28, border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ▾
        </button>
        {open && (
          <div
            style={{ position: 'absolute', top: 36, left: 0, zIndex: 30, width: Math.max(minWidth + 86, 240), maxHeight: 260, overflowY: 'auto', border: `1px solid ${colors.cardBorder}`, borderRadius: 5, background: colors.cardBg, boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)', padding: 4, color: colors.text }}
          >
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseOption('')}
              style={{ width: '100%', minHeight: 28, border: 'none', borderRadius: 4, background: templateFilters[key] === '全部' ? colors.tableRowHover : 'transparent', color: colors.textMuted, padding: '5px 8px', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}
            >
              全部
            </button>
            {visibleOptions.map((option) => (
              <button
                key={`${dropdownId}-${option}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                style={{ width: '100%', minHeight: 28, border: 'none', borderRadius: 4, background: option === value ? colors.tableRowHover : 'transparent', color: colors.text, padding: '5px 8px', textAlign: 'left', cursor: 'pointer', fontSize: 12, lineHeight: 1.35, overflowWrap: 'anywhere' }}
              >
                {option}
              </button>
            ))}
            {!visibleOptions.length && (
              <div style={{ padding: '8px', color: colors.textMuted, fontSize: 12 }}>无匹配选项</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="salary-calculation-page" style={{ height: '100%', display: 'flex', background: colors.appBg, color: colors.text, position: 'relative' }}>
      <style>
        {`.salary-calculation-page select,
.salary-calculation-page option,
.salary-calculation-page input,
.salary-calculation-page textarea {
  color-scheme: light;
}
.salary-calculation-page option {
  background: #ffffff;
  color: #14213d;
}`}
      </style>
      <aside
        style={{
          width: 180,
          minWidth: 180,
          background: colors.sidebarBg,
          borderRight: `1px solid ${colors.sidebarBorder}`,
          color: colors.sidebarText,
          height: '100%',
          overflowY: 'auto',
        }}
      >
        <div>
          <div
            onClick={() => {
              setActiveView('categories');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: activeView === 'categories' ? '#FFFFFF' : colors.sidebarText,
              backgroundColor: activeView === 'categories' ? 'rgba(170, 43, 58, 0.15)' : 'transparent',
              borderLeft: activeView === 'categories' ? `3px solid ${colors.sidebarActiveBg}` : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            <ShieldCheck size={14} />
            <span style={{ flex: 1, fontWeight: activeView === 'categories' ? 600 : 400 }}>部门分类</span>
          </div>
          <div
            onClick={() => {
              setActiveView('calculation');
              setExpandedSections((current) => ({ ...current, calculation: activeView === 'calculation' ? !current.calculation : true, payrollGroup: true }));
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: activeView === 'calculation' ? '#FFFFFF' : colors.sidebarText,
              backgroundColor: activeView === 'calculation' ? 'rgba(170, 43, 58, 0.15)' : 'transparent',
              borderLeft: activeView === 'calculation' ? `3px solid ${colors.sidebarActiveBg}` : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Layers3 size={14} />
            <span style={{ flex: 1, fontWeight: activeView === 'calculation' ? 600 : 400 }}>全部岗位</span>
            <ChevronRight size={12} style={{ opacity: 0.65, transform: activeView === 'calculation' && expandedSections.calculation ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </div>
          {activeView === 'calculation' && expandedSections.calculation && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
              {navDepartmentCategories.length ? navDepartmentCategories.map((category) => {
                const categoryAssignments = assignmentViewsByCategory[category.id] || [];
                const categoryActive = categoryAssignments.some(({ template }) => template.id === activeAssignmentTemplateId);
                const expanded = expandedCategoryIds[category.id] ?? categoryActive;
                return (
                  <div key={`nav-category-${category.id}`}>
                    <div
                      onClick={() => setExpandedCategoryIds((current) => ({ ...current, [category.id]: !expanded }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px 8px 28px',
                        fontSize: 12,
                        color: categoryActive ? '#FFFFFF' : colors.sidebarText,
                        backgroundColor: categoryActive ? 'rgba(170, 43, 58, 0.15)' : 'transparent',
                        cursor: 'pointer',
                        borderLeft: categoryActive ? `3px solid ${colors.sidebarActiveBg}` : '3px solid transparent',
                      }}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</span>
                      <ChevronRight size={11} style={{ opacity: 0.65, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                    </div>
                    {expanded && categoryAssignments.length === 0 && (
                      <div style={{ padding: '8px 14px 8px 46px', fontSize: 12, color: colors.sidebarMuted }}>
                        暂无模板
                      </div>
                    )}
                    {expanded && categoryAssignments.map(({ template }) => {
                      const active = activeAssignmentTemplateId === template.id;
                      return (
                        <div
                          key={`nav-template-${template.id}`}
                          onClick={() => {
                            setActiveView('calculation');
                            setActiveGroup(template.group);
                            setActivePosition('全部');
                            setActiveAssignmentTemplateId(template.id);
                            setTemplatePreviewView(null);
                            setDeptFilter('全部');
                            setMonthFilter('');
                            setEmployeeQuery('');
                            setSelectedRowKeys(new Set());
                            setImportStatus(`已切换到${template.name}分配结果`);
                          }}
                          style={{
                            padding: '8px 14px 8px 46px',
                            fontSize: 12,
                            color: active ? colors.sidebarActiveText : colors.sidebarMuted,
                            backgroundColor: active ? colors.sidebarActiveBg : 'transparent',
                            cursor: 'pointer',
                            borderLeft: active ? '3px solid rgba(255,255,255,0.4)' : '3px solid transparent',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {template.name}
                        </div>
                      );
                    })}
                  </div>
                );
              }) : (
                <div style={{ padding: '8px 14px 8px 36px', fontSize: 12, color: colors.sidebarMuted }}>
                  暂无已确认模板
                </div>
              )}
            </div>
          )}
          <div
            onClick={() => {
              setActiveView('rules');
              setExpandedSections((current) => ({ ...current, rules: activeView === 'rules' ? !current.rules : true }));
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: activeView === 'rules' ? '#FFFFFF' : colors.sidebarText,
              backgroundColor: activeView === 'rules' ? 'rgba(170, 43, 58, 0.15)' : 'transparent',
              borderLeft: activeView === 'rules' ? `3px solid ${colors.sidebarActiveBg}` : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Settings2 size={14} />
            <span style={{ flex: 1, fontWeight: activeView === 'rules' ? 600 : 400 }}>规则配置</span>
            <ChevronRight size={12} style={{ opacity: 0.65, transform: activeView === 'rules' && expandedSections.rules ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </div>
          {activeView === 'rules' && expandedSections.rules && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
              {[
                ['templates', '岗位模板'],
                ['assignments', '人员分配'],
                ['peopleData', '人员数据'],
              ].map(([section, label]) => {
                const active = ruleSection === section;
                return (
                  <div
                    key={section}
                    onClick={() => {
                      setRuleSection(section as 'templates' | 'assignments' | 'peopleData');
                      setRulePanelMode('templates');
                    }}
                    style={{
                      padding: '8px 14px 8px 36px',
                      fontSize: 12,
                      color: active ? colors.sidebarActiveText : colors.sidebarMuted,
                      backgroundColor: active ? colors.sidebarActiveBg : 'transparent',
                      borderLeft: active ? '3px solid rgba(255,255,255,0.4)' : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 16 }}>
        {activeView === 'categories' ? (
          <>
            <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
                  <ShieldCheck size={19} color={colors.primary} />
                  部门分类
                </div>
                <button onClick={createDepartmentCategory} style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', cursor: 'pointer' }}>
                  <Plus size={14} />
                  新增部门
                </button>
              </div>
            </section>
            <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>部门分类列表</span>
                <span style={{ color: colors.textMuted, fontSize: 12 }}>{departmentCategories.length} 个部门</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: colors.tableHeaderBg }}>
                      {['部门分类', '已挂模板', '操作'].map((header) => (
                        <th key={header} style={{ padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}` }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departmentCategories.map((category) => {
                      const assignmentCount = assignmentViewsByCategory[category.id]?.length || 0;
                      return (
                        <tr key={category.id} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                          <td style={{ padding: 12, color: colors.text, fontWeight: 600 }}>
                            {renamingCategoryId === category.id ? (
                              <input
                                value={renameCategoryValue}
                                autoFocus
                                onChange={(event) => setRenameCategoryValue(event.target.value)}
                                onBlur={commitCategoryRename}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') commitCategoryRename();
                                  if (event.key === 'Escape') {
                                    setRenamingCategoryId('');
                                    setRenameCategoryValue('');
                                  }
                                }}
                                style={{ width: 'min(240px, 100%)', height: 30, border: `1px solid ${colors.primary}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', outline: 'none', fontWeight: 600 }}
                              />
                            ) : (
                              <button
                                onClick={() => startRenamingCategory(category)}
                                style={{ border: 'none', background: 'transparent', color: colors.text, cursor: 'text', padding: 0, font: 'inherit', fontWeight: 600 }}
                              >
                                {category.name}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: 12, color: colors.textMuted }}>{assignmentCount} 个模板</td>
                          <td style={{ padding: 12, display: 'flex', gap: 12 }}>
                            <button onClick={() => startRenamingCategory(category)} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>编辑</button>
                            <button onClick={() => deleteDepartmentCategory(category.id)} style={{ border: 'none', background: 'transparent', color: colors.badgeRedText || '#B42318', cursor: 'pointer' }}>删除</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : activeView === 'rules' ? (
          <>
            {ruleSection !== 'peopleData' && (
              <section
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 6,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <input
                  ref={templateImportInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(event) => handleTemplateImport(event.target.files?.[0] || null)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
                    <Settings2 size={19} color={colors.primary} />
                    {ruleSection === 'assignments' ? '人员分配' : rulePanelMode === 'templates' ? '规则配置' : `${rulePosition}模板`}
                  </div>
                  {ruleStatus && <span style={{ color: colors.textMuted, fontSize: 12 }}>{ruleStatus}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  {ruleSection === 'templates' && rulePanelMode === 'templates' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {renderTemplateSearchFilter('部门', 'dept', templateDeptOptions, 'salary-template-dept-options', 150)}
                        {renderTemplateSearchFilter('关联岗位', 'position', templatePositionOptions, 'salary-template-position-options', 150)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <button onClick={createRuleTemplate} style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', cursor: 'pointer' }}>
                          <Plus size={14} />
                          新增模板
                        </button>
                        <button
                          onClick={requestDeleteSelectedTemplates}
                          disabled={!selectedTemplateCount}
                          style={{ height: 32, border: `1px solid ${selectedTemplateCount ? (colors.badgeRedText || '#B42318') : colors.inputBorder}`, borderRadius: 4, background: selectedTemplateCount ? (colors.badgeRedBg || '#FEE4E2') : colors.cardBg, color: selectedTemplateCount ? (colors.badgeRedText || '#B42318') : colors.textMuted, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', cursor: selectedTemplateCount ? 'pointer' : 'not-allowed' }}
                        >
                          <Trash2 size={14} />
                          删除{selectedTemplateCount ? `(${selectedTemplateCount})` : ''}
                        </button>
                        <button onClick={() => templateImportInputRef.current?.click()} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', cursor: 'pointer' }}>
                          <Upload size={14} />
                          导入模板
                        </button>
                      </div>
                    </>
                  )}
                  {ruleSection === 'templates' && rulePanelMode === 'detail' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <button onClick={() => setRulePanelMode('templates')} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                        返回模板
                      </button>
                      <button onClick={confirmTemplateToAssignments} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                        确认
                      </button>
                      <button onClick={previewCurrentTemplate} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                        预览
                      </button>
                      <button onClick={openCurrentTemplateExport} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                        导出项
                      </button>
                      <button onClick={addRuleField} style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', cursor: 'pointer' }}>
                        <Plus size={14} />
                        新增表头
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {ruleSection === 'peopleData' ? (
              <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: 16, borderBottom: `1px solid ${colors.cardBorder}` }}>
                  <input
                    ref={peopleDataImportInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(event) => handlePeopleDataImport(Array.from(event.target.files || []))}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 210px 180px 210px', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                    <label style={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: colors.text, fontSize: 13 }}>姓名</span>
                      <input
                        value={peopleNameQuery}
                        onChange={(event) => setPeopleNameQuery(event.target.value)}
                        placeholder="多个用；号隔开，支持Excel复制"
                        style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none', fontSize: 12 }}
                      />
                    </label>
                    <label style={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: colors.text, fontSize: 13 }}>部门</span>
                      <select
                        value={peopleDeptFilter}
                        onChange={(event) => setPeopleDeptFilter(event.target.value)}
                        style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none', fontSize: 12 }}
                      >
                        {peopleDeptOptions.map((option) => <option key={option} value={option}>{option === '全部' ? '请选择' : option}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gridTemplateColumns: '50px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: colors.text, fontSize: 13 }}>员工号</span>
                      <input
                        value={peopleEmployeeNoQuery}
                        onChange={(event) => setPeopleEmployeeNoQuery(event.target.value)}
                        placeholder="多个用；号隔开，支持Excel复制"
                        style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none', fontSize: 12 }}
                      />
                    </label>
                    <label style={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: colors.text, fontSize: 13 }}>岗位</span>
                      <select
                        value={peoplePositionFilter}
                        onChange={(event) => setPeoplePositionFilter(event.target.value)}
                        style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none', fontSize: 12 }}
                      >
                        {peoplePositionOptions.map((option) => <option key={option} value={option}>{option === '全部' ? '请选择' : option}</option>)}
                      </select>
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => peopleDataImportInputRef.current?.click()} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', cursor: 'pointer' }}>
                        <Upload size={14} />
                        导入
                      </button>
                      <button
                        onClick={exportPeopleData}
                        disabled={!filteredPeopleRows.length}
                        style={{
                          height: 32,
                          border: `1px solid ${colors.inputBorder}`,
                          borderRadius: 4,
                          background: filteredPeopleRows.length ? colors.cardBg : colors.inputBorder,
                          color: filteredPeopleRows.length ? colors.text : colors.textMuted,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '0 10px',
                          cursor: filteredPeopleRows.length ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Download size={14} />
                        导出Excel
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead>
                      <tr style={{ background: colors.tableHeaderBg }}>
                        {['姓名', '部门', '岗位', '实际出勤天数', '平方', '操作'].map((header) => (
                          <th key={header} style={{ padding: '11px 12px', borderBottom: `1px solid ${colors.tableBorder}`, borderRight: `1px solid ${colors.tableBorder}`, color: colors.text, fontSize: 13, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPeopleRows.map((row) => (
                        <tr key={`${row.employeeNo || row.name}-${row.id}`} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: colors.primary, whiteSpace: 'nowrap' }}>{row.name || '-'}</td>
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: colors.text, whiteSpace: 'nowrap' }}>{row.dept || '-'}</td>
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: colors.text, whiteSpace: 'nowrap' }}>{row.position || '-'}</td>
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: colors.text, whiteSpace: 'nowrap' }}>{displayValue(row.actualWorkDaysForSalary)}</td>
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: colors.text, whiteSpace: 'nowrap' }}>{displayValue(row.squareForSalary)}</td>
                          <td style={{ padding: '10px 12px', borderRight: `1px solid ${colors.tableBorder}`, color: colors.text, whiteSpace: 'nowrap' }} />
                        </tr>
                      ))}
                      {!paginatedPeopleRows.length && (
                        <tr>
                          <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: colors.textMuted }}>
                            暂无人员数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ minHeight: 42, padding: '8px 12px', borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, color: colors.textMuted, fontSize: 12 }}>
                  <span>共 {filteredPeopleRows.length} 条</span>
                  <button onClick={() => setPeoplePage((page) => Math.max(1, page - 1))} disabled={normalizedPeoplePage <= 1} style={{ border: 'none', background: 'transparent', color: normalizedPeoplePage <= 1 ? colors.textMuted : colors.text, cursor: normalizedPeoplePage <= 1 ? 'not-allowed' : 'pointer' }}>{'<'}</button>
                  <button style={{ minWidth: 28, height: 28, border: `1px solid ${colors.primary}`, borderRadius: 4, background: colors.cardBg, color: colors.primary }}>{normalizedPeoplePage}</button>
                  <button onClick={() => setPeoplePage((page) => Math.min(peopleTotalPages, page + 1))} disabled={normalizedPeoplePage >= peopleTotalPages} style={{ border: 'none', background: 'transparent', color: normalizedPeoplePage >= peopleTotalPages ? colors.textMuted : colors.text, cursor: normalizedPeoplePage >= peopleTotalPages ? 'not-allowed' : 'pointer' }}>{'>'}</button>
                  <select value={PEOPLE_DATA_PAGE_SIZE} disabled style={{ height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px' }}>
                    <option value={PEOPLE_DATA_PAGE_SIZE}>{PEOPLE_DATA_PAGE_SIZE} 条/页</option>
                  </select>
                  <span>跳至</span>
                  <input
                    value={peoplePageDraft}
                    onChange={(event) => setPeoplePageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') jumpPeoplePage();
                    }}
                    onBlur={jumpPeoplePage}
                    style={{ width: 54, height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', outline: 'none' }}
                  />
                  <span>页</span>
                </div>
              </section>
            ) : ruleSection === 'assignments' ? (
              <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>模板人员分配</span>
                    {renderTemplateSearchFilter('部门', 'dept', templateDeptOptions, 'salary-assignment-dept-options', 150)}
                    {renderTemplateSearchFilter('关联岗位', 'position', templatePositionOptions, 'salary-assignment-position-options', 150)}
                  </div>
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(860, assignmentSlotCount * 160 + 330) }}>
                    <thead>
                      <tr style={{ background: colors.tableHeaderBg }}>
                        <th style={{ position: 'sticky', left: 0, zIndex: 2, width: 220, padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, background: colors.tableHeaderBg }}>模板 / 部门 / 岗位</th>
                        {Array.from({ length: assignmentSlotCount }, (_, index) => (
                          <th key={`slot-head-${index}`} style={{ minWidth: 150, padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}`, background: colors.tableHeaderBg }}>
                            <div>人员{index + 1}</div>
                          </th>
                        ))}
                        <th style={{ width: 110, padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, background: colors.tableHeaderBg }}>
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRuleTemplates.map((template) => {
                        const assignment = templateAssignments[template.id];
                        const employeeKeys = (assignment?.employeeKeys || []).filter((key) => assignmentEmployeeByKey[key]);
                        const isEditing = assignmentTemplateId === template.id;
                        return (
                          <tr key={`assignment-${template.id}`} style={{ borderBottom: `1px solid ${colors.tableBorder}`, background: isEditing ? 'rgba(180, 45, 58, 0.05)' : 'transparent' }}>
                            <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '10px 12px', background: isEditing ? 'rgba(180, 45, 58, 0.05)' : colors.cardBg, color: colors.text, fontWeight: 600 }}>
                              <div>{template.name}</div>
                              <div style={{ marginTop: 3, color: colors.textMuted, fontSize: 12 }}>{template.dept || deptForPosition(template.position)}</div>
                              <div style={{ marginTop: 2, color: colors.primary, fontSize: 12 }}>{assignment?.position || template.position}</div>
                            </td>
                            {Array.from({ length: assignmentSlotCount }, (_, index) => {
                              const employeeKey = employeeKeys[index];
                              const employee = employeeKey ? assignmentEmployeeByKey[employeeKey] : null;
                              return (
                                <td
                                  key={`${template.id}-slot-${index}`}
                                  style={{
                                    padding: '8px 10px',
                                    textAlign: 'center',
                                    color: employee ? colors.text : colors.textMuted,
                                    background: employee ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                                  }}
                                >
                                  {employee ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                      <span>{employee.employeeName}</span>
                                      <button
                                        onClick={() => unbindAssignmentEmployee(template.id, employeeKey)}
                                        style={{ height: 24, border: `1px solid ${colors.badgeRedText || '#B42318'}`, borderRadius: 4, background: colors.badgeRedBg || '#FEE4E2', color: colors.badgeRedText || '#B42318', padding: '0 8px', cursor: 'pointer', fontSize: 12 }}
                                      >
                                        解绑
                                      </button>
                                    </div>
                                  ) : '-'}
                                </td>
                              );
                            })}
                            <td style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => openAssignmentEditor(template)}
                                style={{ height: 28, border: `1px solid ${isEditing ? colors.primary : colors.inputBorder}`, borderRadius: 4, background: isEditing ? colors.primary : colors.cardBg, color: isEditing ? colors.primaryText : colors.primary, padding: '0 10px', cursor: 'pointer', fontSize: 12 }}
                              >
                                编辑
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : rulePanelMode === 'templates' ? (
              <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>核算模板</span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    {filteredRuleTemplates.length} / {ruleTemplates.length} 个模板，每页 {TEMPLATE_PAGE_SIZE} 个{selectedTemplateCount ? `，已选 ${selectedTemplateCount}` : ''}
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                    <thead>
                      <tr style={{ background: colors.tableHeaderBg }}>
                        <th style={{ width: 44, padding: '10px 12px', borderBottom: `1px solid ${colors.tableBorder}`, background: colors.tableHeaderBg }}>
                          <input
                            type="checkbox"
                            checked={allFilteredTemplatesSelected}
                            onChange={toggleSelectAllFilteredTemplates}
                            aria-label="全选当前页模板"
                          />
                        </th>
                        {['模板名称', '部门', '关联岗位', '表头数量', '操作'].map((header) => (
                          <th key={header} style={{ padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap' }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRuleTemplates.map((template) => (
                        <tr key={template.id} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                          <td style={{ width: 44, padding: '12px', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={selectedTemplateIds.has(template.id)}
                              onChange={() => toggleTemplateSelection(template.id)}
                              aria-label={`选择${template.name}`}
                            />
                          </td>
                          <td style={{ padding: '12px', color: colors.text, fontWeight: 600 }}>
                            {renamingTemplateId === template.id ? (
                              <input
                                value={renameTemplateValue}
                                autoFocus
                                onChange={(event) => setRenameTemplateValue(event.target.value)}
                                onBlur={commitTemplateRename}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') commitTemplateRename();
                                  if (event.key === 'Escape') cancelTemplateRename();
                                }}
                                style={{ width: 'min(220px, 100%)', height: 30, border: `1px solid ${colors.primary}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', outline: 'none', fontWeight: 600 }}
                              />
                            ) : (
                              <button
                                onClick={() => startRenamingTemplate(template)}
                                title="重命名模板"
                                style={{ border: 'none', background: 'transparent', color: colors.text, cursor: 'text', padding: 0, font: 'inherit', fontWeight: 600, textAlign: 'left' }}
                              >
                                {template.name}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '12px', color: colors.textMuted }}>{template.dept || deptForPosition(template.position)}</td>
                          <td style={{ padding: '12px', color: colors.textMuted }}>{template.position}</td>
                          <td style={{ padding: '12px', color: colors.textMuted }}>{templateFieldCountById[template.id] ?? template.fieldCount}</td>
                          <td style={{ padding: '12px', display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>
                            <button onClick={() => openTemplateDetail(template)} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>编辑</button>
                            <button onClick={() => exportTemplateFromList(template)} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>导出项</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '10px 12px', borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    第 {normalizedTemplatePage} / {templateTotalPages} 页，共 {filteredRuleTemplates.length} 条
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setTemplatePage((page) => Math.max(1, page - 1))}
                      disabled={normalizedTemplatePage <= 1}
                      style={{ height: 30, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: normalizedTemplatePage <= 1 ? colors.textMuted : colors.text, padding: '0 10px', cursor: normalizedTemplatePage <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => setTemplatePage((page) => Math.min(templateTotalPages, page + 1))}
                      disabled={normalizedTemplatePage >= templateTotalPages}
                      style={{ height: 30, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: normalizedTemplatePage >= templateTotalPages ? colors.textMuted : colors.text, padding: '0 10px', cursor: normalizedTemplatePage >= templateTotalPages ? 'not-allowed' : 'pointer' }}
                    >
                      下一页
                    </button>
                    <span style={{ color: colors.textMuted, fontSize: 12 }}>跳到</span>
                    <input
                      type="number"
                      min={1}
                      max={templateTotalPages}
                      value={templatePageDraft}
                      onChange={(event) => setTemplatePageDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') jumpToTemplatePage();
                      }}
                      style={{ width: 64, height: 30, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', outline: 'none', colorScheme: 'light' }}
                    />
                    <span style={{ color: colors.textMuted, fontSize: 12 }}>页</span>
                    <button
                      onClick={jumpToTemplatePage}
                      style={{ height: 30, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}
                    >
                      跳转
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700 }}>岗位模板 / {rulePosition}</span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>{ruleFields.length} 个表头</span>
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(1180, ruleFields.length * 168 + 120) }}>
                    <thead>
                      <tr style={{ background: colors.tableHeaderBg }}>
                        <th style={{ position: 'sticky', left: 0, zIndex: 2, width: 108, padding: '8px 10px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, background: colors.tableHeaderBg }}>
                          配置项
                        </th>
                        {ruleFields.map((field) => {
                          const groupVisual = ruleFieldGroupVisuals[field.key];
                          const isGroupedFollower = Boolean(groupVisual && !groupVisual.isFirst);
                          return (
                          <React.Fragment key={`header-${field.key}`}>
                            <th
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                reorderRuleField(event.dataTransfer.getData('text/plain') || draggingRuleFieldKey, field.key);
                              }}
                              onDragEnd={() => setDraggingRuleFieldKey('')}
                              onMouseDown={(event) => {
                                if (event.ctrlKey && event.button === 0) {
                                  event.preventDefault();
                                  addFieldToGroupSelection(field);
                                }
                              }}
                              onContextMenu={(event) => {
                                if (event.ctrlKey) {
                                  event.preventDefault();
                                  removeFieldFromGroup(field);
                                }
                              }}
                              style={{
                                minWidth: 168,
                                padding: '6px 8px',
                                borderTop: groupVisual ? `2px solid ${groupVisual.color}` : undefined,
                                borderBottom: groupVisual ? `2px solid ${groupVisual.color}` : `1px solid ${colors.tableBorder}`,
                                borderLeft: groupVisual ? (groupVisual.isFirst ? `2px solid ${groupVisual.color}` : 'none') : undefined,
                                borderRight: groupVisual ? (groupVisual.isLast ? `2px solid ${groupVisual.color}` : 'none') : undefined,
                                boxShadow: groupVisual && !groupVisual.isLast ? `inset -1px 0 0 ${groupVisual.color}22` : undefined,
                                background: selectedGroupFieldKeys.has(field.key)
                                  ? 'rgba(180, 45, 58, 0.08)'
                                  : draggingRuleFieldKey === field.key
                                    ? 'rgba(180, 45, 58, 0.08)'
                                    : groupVisual ? groupVisual.background : colors.tableHeaderBg,
                                outline: selectedGroupFieldKeys.has(field.key)
                                  ? `2px solid ${colors.primary}`
                                  : draggingRuleFieldKey && draggingRuleFieldKey !== field.key ? `1px dashed ${colors.primary}` : 'none',
                              }}
                            >
                              <div style={{ display: 'grid', gap: 5 }}>
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={(event) => {
                                    setDraggingRuleFieldKey(field.key);
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', field.key);
                                  }}
                                  onDragEnd={() => setDraggingRuleFieldKey('')}
                                  title="按住拖动表头换位置"
                                  style={{
                                    width: '100%',
                                    height: 22,
                                    border: `1px dashed ${colors.inputBorder}`,
                                    borderRadius: 4,
                                    background: colors.cardBg,
                                    color: colors.textMuted,
                                    cursor: 'grab',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                  }}
                                >
                                  <GripVertical size={14} />
                                </button>
                                {isGroupedFollower ? (
                                  <>
                                    <div style={{ height: 26, borderRadius: 4, background: groupVisual?.background, color: groupVisual?.color || colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                                      同组
                                    </div>
                                    <div style={{ height: 26, borderRadius: 4, background: groupVisual?.background }} />
                                  </>
                                ) : (
                                  <>
                                    <input
                                      value={field.groupTop || ''}
                                      onChange={(event) => updateRuleFieldGroup(field, { groupTop: event.target.value })}
                                      placeholder="如 三维家/SU"
                                      title="一级分组。Ctrl+左键多选成组，Ctrl+右键移出分组"
                                      style={{ width: '100%', height: 26, border: `1px solid ${groupVisual?.color || colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 6px', outline: 'none', boxSizing: 'border-box', fontSize: 12 }}
                                    />
                                    <input
                                      value={field.groupSub || ''}
                                      onChange={(event) => updateRuleFieldGroup(field, { groupSub: event.target.value })}
                                      placeholder="如 小区营销"
                                      title="二级分组。Ctrl+左键多选成组，Ctrl+右键移出分组"
                                      style={{ width: '100%', height: 26, border: `1px solid ${groupVisual?.color || colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 6px', outline: 'none', boxSizing: 'border-box', fontSize: 12 }}
                                    />
                                  </>
                                )}
                                <select
                                  value={CONFIG_ITEM_OPTIONS.includes(field.label as any) ? field.label : '自定义表头'}
                                  onChange={(event) => {
                                    updateRuleFieldLabel(field, event.target.value === '自定义表头' ? '自定义表头' : event.target.value);
                                  }}
                                  style={{ width: '100%', height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 6px', outline: 'none', boxSizing: 'border-box', fontSize: 12 }}
                                >
                                  {CONFIG_ITEM_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                  <option value="自定义表头">自定义表头</option>
                                </select>
                                <textarea
                                  value={field.label}
                                  onChange={(event) => updateRuleFieldLabel(field, event.target.value)}
                                  rows={field.label.length > 20 ? 2 : 1}
                                  style={{ width: '100%', minHeight: field.label.length > 20 ? 48 : 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '5px 8px', outline: 'none', boxSizing: 'border-box', fontSize: 12, fontWeight: 600, lineHeight: 1.45, resize: 'vertical', overflowWrap: 'anywhere', whiteSpace: 'normal' }}
                                />
                              </div>
                            </th>
                          </React.Fragment>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '8px 10px', color: colors.textMuted, background: colors.cardBg, fontSize: 12 }}>来源</td>
                        {ruleFields.map((field) => (
                          <React.Fragment key={`source-${field.key}`}>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={sourceOptionsForField(field).includes(field.source) ? field.source : sourceOptionsForField(field)[0]}
                                onChange={(event) => updateRuleFieldConfig(field, { source: event.target.value as RuleFieldConfig['source'] })}
                                disabled={field.label === '应出勤天数' || field.label === '实际出勤天数' || field.label === '平方' || field.label === '薪资'}
                                style={{ width: '100%', height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 6px', outline: 'none', boxSizing: 'border-box', fontSize: 12 }}
                              >
                                {sourceOptionsForField(field).map((source) => (
                                  <option key={source} value={source}>{source}</option>
                                ))}
                              </select>
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '8px 10px', color: colors.textMuted, background: colors.cardBg, fontSize: 12 }}>运算一</td>
                        {ruleFields.map((field) => (
                          <React.Fragment key={`operation-${field.key}`}>
                            <td style={{ padding: '6px 8px' }}>
                              {field.label === '月份' ? (
                                <div style={{ display: 'grid' }}>
                                  <input
                                    type="date"
                                    value={normalizeDateInputValue(field.value1)}
                                    onFocus={() => {
                                      if (!normalizeDateInputValue(field.value1)) updateRuleFieldConfig(field, { value1: todayDateInputValue(), op1: '' });
                                    }}
                                    onChange={(event) => updateRuleFieldConfig(field, { value1: event.target.value, op1: '' })}
                                    style={{ width: '100%', height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 6px', outline: 'none', boxSizing: 'border-box', fontSize: 12, colorScheme: 'light' }}
                                  />
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(72px, 0.72fr)', gap: 6 }}>
                                  <input
                                    value={field.value1 || ''}
                                    onChange={(event) => updateRuleFieldConfig(field, { value1: event.target.value, op1: '' })}
                                    placeholder="如 2000*5%+"
                                    style={{ width: '100%', height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 6px', outline: 'none', boxSizing: 'border-box', fontSize: 12 }}
                                  />
                                  <div
                                    title="当前表头运算结果"
                                    style={{ height: 28, border: `1px solid ${colors.tableBorder}`, borderRadius: 4, background: colors.tableHeaderBg, color: colors.text, padding: '0 6px', display: 'flex', alignItems: 'center', boxSizing: 'border-box', fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                                  >
                                    {String(field.label === '薪资' ? (rulePreviewRow ? templateCalculateSalary(rulePreviewRow, ruleFields) : '按人员计算') : templateCalculateFieldOperationResult(rulePreviewRow, field)) || '-'}
                                  </div>
                                </div>
                              )}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '8px 10px', color: colors.textMuted, background: colors.cardBg, fontSize: 12 }}>公式算法</td>
                        <td colSpan={Math.max(1, ruleFields.length)} style={{ padding: '6px 8px' }}>
                          <div style={{ minHeight: 28, border: `1px solid ${colors.tableBorder}`, borderRadius: 4, background: colors.tableHeaderBg, color: colors.textMuted, padding: '5px 8px', boxSizing: 'border-box', fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                            {buildTemplateFormulaText(ruleFields)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '8px 10px', color: colors.textMuted, background: colors.cardBg, fontSize: 12 }}>操作</td>
                        {ruleFields.map((field) => (
                          <React.Fragment key={`action-${field.key}`}>
                            <td style={{ padding: '6px 8px' }}>
                              <button onClick={() => deleteRuleField(field)} style={{ width: '100%', height: 28, border: `1px solid ${colors.badgeRedText || '#B42318'}`, borderRadius: 4, background: colors.badgeRedBg || '#FEE4E2', color: colors.badgeRedText || '#B42318', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
                                <Trash2 size={13} />
                                删除
                              </button>
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : (
          <>
        <section
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 6,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
              <ShieldCheck size={19} color={colors.primary} />
              薪酬核算
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '0 8px', height: 32 }}>
              <Calendar size={14} color={colors.textMuted} />
              <input
                type="month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', color: colors.inputText, fontSize: 13, width: 128 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '0 8px', height: 32 }}>
              <Search size={14} color={colors.textMuted} />
              <input
                value={employeeQuery}
                onChange={(event) => setEmployeeQuery(event.target.value)}
                placeholder="查询人员"
                style={{ border: 'none', outline: 'none', background: 'transparent', color: colors.inputText, fontSize: 13, width: 150 }}
              />
            </div>
            <select
              value={deptFilter}
              onChange={(event) => setDeptFilter(event.target.value)}
              style={{
                height: 32,
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 4,
                background: colors.inputBg,
                color: colors.inputText,
                padding: '0 8px',
                fontSize: 13,
              }}
            >
              {deptOptions.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <button
              onClick={handleExport}
              disabled={exportDisabled}
              style={{
                height: 32,
                border: 'none',
                borderRadius: 4,
                background: exportDisabled ? colors.inputBorder : colors.primary,
                color: exportDisabled ? colors.textMuted : colors.primaryText,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                cursor: exportDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={14} />
              {!payrollInputsLoaded ? '加载中' : `导出Excel${selectedVisibleRows.length ? `(${selectedVisibleRows.length})` : ''}`}
            </button>
            {(importStatus || payrollInputStatus || salaryPersistenceStatus) && <span style={{ color: colors.textMuted, fontSize: 12 }}>{importStatus || payrollInputStatus || salaryPersistenceStatus}</span>}
            {activePreviewTemplate && (
              <button onClick={exitTemplatePreview} style={{ height: 32, border: `1px solid ${colors.primary}`, borderRadius: 4, background: colors.cardBg, color: colors.primary, padding: '0 10px', cursor: 'pointer' }}>
                退出预览
              </button>
            )}
            {activeAssignmentTemplate && (
              <button onClick={exitAssignmentResult} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                退出分配结果
              </button>
            )}
          </div>
        </section>

        <section
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 6,
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700 }}>
              {activePreviewTemplate ? `${activePreviewTemplate.name}预览` : activeAssignmentTemplate ? `${activeAssignmentTemplate.name}分配结果` : activePosition === '全部' ? payrollGroupLabel(activeGroup) : activePosition}
            </span>
            <span style={{ color: colors.textMuted, fontSize: 12 }}>
              已选 {selectedVisibleRows.length} / {visibleRows.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 44, minWidth: 44 }} />
                {activeSheetColumns.map((column, index) => (
                  <col key={`col-${column.key}-${index}`} style={{ width: columnDisplayWidth(column), minWidth: columnDisplayWidth(column) }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ background: colors.tableHeaderBg, color: headerTextColor }}>
                  <th rowSpan={hasTieredHeader ? 3 : 1} style={{ width: 44, padding: '10px 12px', borderBottom: `1px solid ${colors.tableBorder}` }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="全选人员"
                    />
                  </th>
                  {(hasTieredHeader ? topHeaderGroups : activeSheetColumns.map((column, index) => ({ key: `${column.key}-${index}`, label: column.label, colSpan: 1, width: columnDisplayWidth(column), column, color: '', background: '' }))).map((group) => (
                    <th key={group.key} colSpan={group.colSpan} style={{ textAlign: 'center', padding: '10px 12px', borderTop: group.color ? `2px solid ${group.color}` : undefined, borderLeft: group.color ? `2px solid ${group.color}` : undefined, borderRight: group.color ? `2px solid ${group.color}` : undefined, borderBottom: group.color ? `2px solid ${group.color}` : `1px solid ${colors.tableBorder}`, background: group.background || undefined, color: '#111827', fontSize: 14, fontWeight: 700, whiteSpace: 'pre-line', overflowWrap: 'anywhere', width: group.width, minWidth: group.width, lineHeight: 1.35 }}>
                      {renderHeaderCell(group.column, hasTieredHeader ? group.label : group.column.label)}
                    </th>
                  ))}
                </tr>
                {hasTieredHeader && (
                  <tr style={{ background: colors.tableHeaderBg, color: headerTextColor }}>
                    {subHeaderGroups.map((group) => (
                      <th key={`sub-${group.key}`} colSpan={group.colSpan} style={{ textAlign: 'center', padding: '10px 12px', borderLeft: group.color ? `2px solid ${group.color}` : undefined, borderRight: group.color ? `2px solid ${group.color}` : undefined, borderBottom: group.color ? `2px solid ${group.color}` : `1px solid ${colors.tableBorder}`, background: group.background || undefined, color: '#111827', fontSize: 14, fontWeight: 700, whiteSpace: 'pre-line', overflowWrap: 'anywhere', width: group.width, minWidth: group.width, lineHeight: 1.35 }}>
                        {renderHeaderCell(group.column, group.label)}
                      </th>
                    ))}
                  </tr>
                )}
                {hasTieredHeader && (
                  <tr style={{ background: colors.tableHeaderBg, color: headerTextColor }}>
                    {activeSheetColumns.map((col, index) => (
                      <th key={`field-${col.key}-${index}`} style={{ textAlign: 'center', padding: '10px 12px', borderBottom: `1px solid ${colors.tableBorder}`, color: '#111827', fontSize: 14, fontWeight: 700, whiteSpace: 'pre-line', overflowWrap: 'anywhere', width: columnDisplayWidth(col), minWidth: columnDisplayWidth(col), lineHeight: 1.35 }}>
                        {renderHeaderCell(col, col.label)}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {!visibleRows.length && (
                  <tr>
                    <td colSpan={activeSheetColumns.length + 1} style={{ padding: '28px 12px', textAlign: 'center', color: colors.textMuted, borderBottom: `1px solid ${colors.tableBorder}` }}>
                      {templatePreviewView ? '当前模板暂无可预览人员' : '请先完成岗位模板和人员分配'}
                    </td>
                  </tr>
                )}
                {visibleRows.map((row) => (
                  <tr key={rowKey(row)} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={selectedRowKeys.has(rowKey(row))}
                        onChange={() => toggleRowSelection(rowKey(row))}
                        aria-label={`选择${row.employeeName || row.position}`}
                      />
                    </td>
                    {activeSheetColumns.map((col, index) => (
                      <td key={`${rowKey(row)}-${col.key}-${index}`} style={{ padding: '10px 12px', width: columnDisplayWidth(col), minWidth: columnDisplayWidth(col), textAlign: 'center', whiteSpace: 'nowrap', color: col.key === 'gross' || col.key === 'net' ? colors.text : undefined }}>
                        {col.get(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

          </>
        )}
      </main>
      {assignmentTemplateId && assignmentPosition && editingAssignmentTemplate && (
        <div
          onClick={closeAssignmentEditor}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            height: '100%',
            background: 'rgba(20, 29, 48, 0.28)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 760,
              maxWidth: 'calc(100vw - 48px)',
              maxHeight: 'calc(100vh - 64px)',
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              boxShadow: '0 20px 58px rgba(15, 23, 42, 0.28)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: '58px auto minmax(0, 1fr) 58px',
            }}
          >
            <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.cardBorder}`, boxSizing: 'border-box' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>选择人员</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingAssignmentTemplate.name} / {editingAssignmentTemplate.dept || deptForPosition(editingAssignmentTemplate.position)} / {assignmentPosition}
                </div>
              </div>
              <button
                onClick={closeAssignmentEditor}
                style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                aria-label="关闭人员选择"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <select
                value={assignmentCategoryId}
                onChange={(event) => updateAssignmentCategory(event.target.value)}
                style={{ height: 34, minWidth: 170, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: assignmentCategoryId ? colors.inputText : colors.textMuted, padding: '0 10px', outline: 'none', fontSize: 12 }}
              >
                <option value="">选择部门分类</option>
                {departmentCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, padding: '0 10px', color: colors.textMuted, fontSize: 12, minWidth: 320, flex: '1 1 320px' }}>
                <Search size={14} />
                <input
                  value={assignmentEmployeeSearch}
                  onChange={(event) => setAssignmentEmployeeSearch(event.target.value)}
                  placeholder="搜索姓名、岗位或部门"
                  autoFocus
                  style={{ flex: 1, minWidth: 160, height: 30, border: 'none', outline: 'none', background: 'transparent', color: colors.inputText, fontSize: 12 }}
                />
              </label>
              <span style={{ color: colors.textMuted, fontSize: 12 }}>
                已选 {pendingAssignmentEmployeeKeys.size} 人
              </span>
            </div>
            <div style={{ padding: 14, overflow: 'auto', background: colors.tableHeaderBg }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
                {filteredAssignmentEmployees.map((employee) => {
                  const key = employee.key;
                  const assignedTemplateId = assignedEmployeeTemplateByKey[key];
                  const assignedTemplate = assignedTemplateId ? ruleTemplates.find((template) => template.id === assignedTemplateId) : null;
                  const assignedElsewhere = !!assignedTemplateId && assignedTemplateId !== assignmentTemplateId;
                  const selected = pendingAssignmentEmployeeKeys.has(key);
                  return (
                    <label
                      key={`assignment-card-${key}`}
                      style={{
                        minHeight: 56,
                        border: `1px solid ${selected ? colors.primary : colors.tableBorder}`,
                        borderRadius: 6,
                        padding: '9px 10px',
                        display: 'grid',
                        gridTemplateColumns: '20px minmax(0, 1fr)',
                        alignItems: 'center',
                        gap: 8,
                        color: assignedElsewhere ? colors.textMuted : colors.text,
                        background: selected ? 'rgba(180, 45, 58, 0.08)' : colors.cardBg,
                        cursor: assignedElsewhere ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={assignedElsewhere}
                        onChange={() => togglePendingAssignmentEmployee(key)}
                      />
                      <span style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{employee.employeeName}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textMuted, fontSize: 12 }}>
                          {employee.dept || '-'} / {employee.position || '-'}
                        </span>
                        {assignedElsewhere && assignedTemplate && (
                          <span style={{ color: colors.badgeRedText || '#B42318', fontSize: 12 }}>
                            已绑定：{assignedTemplate.name}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
                {!filteredAssignmentEmployees.length && (
                  <div style={{ minHeight: 56, border: `1px dashed ${colors.tableBorder}`, borderRadius: 6, padding: 12, color: colors.textMuted, background: colors.cardBg }}>
                    当前岗位暂无可绑定人员
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '10px 18px', borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, background: colors.cardBg }}>
              <button
                onClick={closeAssignmentEditor}
                style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 12px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={confirmAssignment}
                disabled={pendingAssignmentEmployeeKeys.size === 0}
                style={{ height: 32, border: 'none', borderRadius: 4, background: pendingAssignmentEmployeeKeys.size ? colors.primary : colors.inputBorder, color: pendingAssignmentEmployeeKeys.size ? colors.primaryText : colors.textMuted, padding: '0 12px', cursor: pendingAssignmentEmployeeKeys.size ? 'pointer' : 'not-allowed' }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteTemplateTarget && (
        <ConfirmDialog
          colors={colors}
          title="删除模板"
          message={
            <span>
              确认删除「{deleteTemplateTarget.name}」吗？删除后会同步清理该模板的人员分配记录。
            </span>
          }
          confirmLabel="删除"
          cancelLabel="取消"
          danger
          onCancel={() => setDeleteTemplateTarget(null)}
          onConfirm={() => deleteRuleTemplates(Array.from(selectedTemplateIds))}
        />
      )}
      {ruleModal === 'export' && (
        <div
          onClick={() => setRuleModal(null)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(20, 29, 48, 0.28)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 620,
              maxWidth: '100%',
              maxHeight: '88%',
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ minHeight: 52, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.cardBorder}` }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>导出项配置</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{rulePosition}模板 / 选择导出表头</div>
              </div>
              <button onClick={() => setRuleModal(null)} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 4 }} aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 14, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {ruleFields.map((field) => (
                <label key={field.key} style={{ minHeight: 34, border: `1px solid ${colors.tableBorder}`, borderRadius: 4, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, color: colors.text }}>
                  <input
                    type="checkbox"
                    checked={exportFieldKeys.has(field.key)}
                    onChange={(event) => setExportFieldKeys((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(field.key);
                      else next.delete(field.key);
                      return next;
                    })}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label || '空表头'}</span>
                </label>
              ))}
            </div>
            <div style={{ height: 1, background: colors.divider }} />
            <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: colors.cardBg }}>
              <button onClick={() => setRuleModal(null)} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 12px', cursor: 'pointer' }}>
                关闭
              </button>
              <button onClick={saveExportFields} style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, padding: '0 12px', cursor: 'pointer' }}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {activeFormulaColumn && (
        <div
          onClick={() => setActiveFormulaColumn(null)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            height: '100%',
            background: 'rgba(20, 29, 48, 0.28)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 560,
              maxWidth: '100%',
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
              overflow: 'hidden',
            }}
          >
            <div style={{ minHeight: 52, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.cardBorder}`, boxSizing: 'border-box' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>公式算法</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{columnTitle(activeFormulaColumn)}</div>
              </div>
              <button
                onClick={() => setActiveFormulaColumn(null)}
                style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '14px 18px 16px' }}>
              <textarea
                value={activeFormulaText}
                onChange={(event) => setFormulaDrafts((current) => ({ ...current, [activeFormulaKey]: event.target.value }))}
                style={{
                  width: '100%',
                  minHeight: 220,
                  resize: 'vertical',
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: 4,
                  background: colors.inputBg,
                  color: colors.inputText,
                  padding: 10,
                  outline: 'none',
                  lineHeight: 1.6,
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ height: 1, background: colors.divider }} />
            <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: colors.cardBg }}>
              <button
                onClick={() => setActiveFormulaColumn(null)}
                style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 12px', cursor: 'pointer' }}
              >
                关闭
              </button>
              <button
                onClick={() => setActiveFormulaColumn(null)}
                style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, padding: '0 12px', cursor: 'pointer' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {editingRuleField && ruleFieldDraft && (
        <div
          onClick={() => {
            setEditingRuleField(null);
            setRuleFieldDraft(null);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            height: '100%',
            background: 'rgba(20, 29, 48, 0.28)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 560,
              maxWidth: '100%',
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
              overflow: 'hidden',
            }}
          >
            <div style={{ minHeight: 52, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.cardBorder}`, boxSizing: 'border-box' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{editingRuleField.custom ? '新增字段' : '编辑字段'}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  岗位模板 / {rulePosition}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingRuleField(null);
                  setRuleFieldDraft(null);
                }}
                style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '14px 18px 16px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.text }}>字段名称</span>
                <input
                  value={ruleFieldDraft.label}
                  onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, label: event.target.value } : current)}
                  style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.text }}>来源</span>
                <select
                  value={ruleFieldDraft.source}
                  onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, source: event.target.value as RuleFieldConfig['source'] } : current)}
                  style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none' }}
                >
                  {['输入项', '系统默认', '岗位模板'].map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.text }}>运算</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                  <input
                    value={ruleFieldDraft.value1}
                    onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, value1: event.target.value, op1: '' } : current)}
                    placeholder="例如：2000*5%+"
                    style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.text }}>预览</span>
                <div style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 10px', border: `1px solid ${colors.tableBorder}`, borderRadius: 4, background: colors.tableHeaderBg, color: colors.textMuted }}>
                  {ruleFieldDraft.value1 || '-'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'start' }}>
                <span style={{ fontSize: 13, color: colors.text, paddingTop: 8 }}>公式算法</span>
              <textarea
                value={ruleFieldDraft.formula}
                onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, formula: event.target.value } : current)}
                placeholder="例如：基本工资+100*10%"
                style={{
                  width: '100%',
                  minHeight: 120,
                  resize: 'vertical',
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: 4,
                  background: colors.inputBg,
                  color: colors.inputText,
                  padding: 10,
                  outline: 'none',
                  lineHeight: 1.6,
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
              </div>
            </div>
            <div style={{ height: 1, background: colors.divider }} />
            <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: colors.cardBg }}>
              <button
                onClick={() => {
                  setEditingRuleField(null);
                  setRuleFieldDraft(null);
                }}
                style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 12px', cursor: 'pointer' }}
              >
                关闭
              </button>
              <button
                onClick={saveRuleEditor}
                style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, padding: '0 12px', cursor: 'pointer' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
