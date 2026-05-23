import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  Download,
  FileSpreadsheet,
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

type PayrollRow = {
  id: number;
  employeeName?: string;
  dept?: string;
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
  source: '输入项' | '系统默认' | '岗位模板' | '人员微调';
  formula: string;
  op1: '' | '+' | '-' | '*' | '/' | '%';
  value1: string;
  op2: '' | '+' | '-' | '*' | '/' | '%';
  value2: string;
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
};

type ImportDraftField = {
  key: string;
  detectedName: string;
  renamedName: string;
  status: '已识别' | '待确认';
  selected: boolean;
};

const SOURCE_FILE = '资料/考勤真实数据/薪酬系统测试数据to李文.xlsx';
const SOURCE_SHEET = '管理店长+设计总监+区域督导+小区运营';

const payrollRows: PayrollRow[] = [
  { id: 1, month: 202602, position: '管理型店长', should: 18, actual: 14.5, annual: 350000, monthly: 29167, fixed: 12500, base: 2163, overtime: 8654, perfStd: 16667, paymentPerf: 8725.385309, orderPerf: 9047.8, refundPerf: 0, supportPerf: 2083.375, perfActual: 19856.560309, other: -1637, sick: 0, late: 20, gross: 29017, social: 783.3, fund: 318, tax: 0, net: 27916 },
  { id: 2, month: 202602, position: '设计总监', should: 18, actual: 16.5, annual: 400000, monthly: 33333, fixed: 14583, base: 2748, overtime: 10993, perfStd: 18750, paymentPerf: 22085.689849, refundPerf: 0, perfActual: 22085.689849, sick: 0, late: 0, gross: 35827, social: 783.3, fund: 237, tax: 0, net: 34807 },
  { id: 3, month: 202602, position: '区域督导', should: 16, actual: 18.5, annual: 180000, monthly: 15000, fixed: 7083, base: 1417, overtime: 5666, perfStd: 7917, paymentPerf: 5100.658053, orderPerf: 3084.545455, refundPerf: 0, dailyPerf: 712.53, otherPerformance: -0.000001, perfActual: 8897.733507, sick: 0, late: 0, gross: 15981, social: 783.3, fund: 135, tax: 0, net: 15063 },
  { id: 4, month: 202602, position: '运营专员', should: 16, actual: 17, annual: 180000, monthly: 15000, fixed: 7083, base: 1417, overtime: 5666, perfStd: 7917, orderPerf: 3958.5, dailyPerf: 728.364, developmentPerf: 3166.8, perfActual: 7853.664, other: 6292, sick: 0, late: 0, gross: 21229, social: 783.3, fund: 190, tax: 0, net: 20256 },
  { id: 5, month: 202602, position: '运营助理', should: 16, actual: 15.5, annual: 120000, monthly: 10000, fixed: 7000, base: 1356, overtime: 5425, perfStd: 3000, orderPerf: 2266.18705, dailyPerf: 246, communityPerf: 0, perfActual: 2512.18705, sick: 0, late: 0, gross: 9293, social: 783.3, fund: 243, tax: 0, net: 8267 },
  { id: 6, month: 202603, position: '管理型店长', should: 26, actual: 27.5, annual: 350000, monthly: 29167, fixed: 12500, base: 2644, overtime: 10577, perfStd: 16667, paymentPerf: 10376.475902, orderPerf: 8800.176, refundPerf: 2083.375, supportPerf: 0, perfActual: 21260.026902, sick: 0, late: 0, gross: 34481, social: 783.3, fund: 318, tax: 0, net: 33380 },
  { id: 7, month: 202603, position: '设计总监', should: 26, actual: 31, annual: 400000, monthly: 33333, fixed: 14583, base: 3477, overtime: 13910, perfStd: 18750, paymentPerf: 17509.952885, refundPerf: 2343.75, orderSuccessPerf: 1406.25, installSuccessPerf: 0, perfActual: 21259.952885, sick: 0, late: 0, gross: 38647, social: 783.3, fund: 237, tax: 0, net: 37627 },
  { id: 8, month: 202603, position: '区域督导', should: 27, actual: 27, annual: 180000, monthly: 15000, fixed: 7083, base: 1417, overtime: 5666, perfStd: 7917, paymentPerf: 3000.801163, orderPerf: 3084.545455, refundPerf: 989.625, dailyPerf: 712.53, samplePerf: 1543.815, perfActual: 9331.316618, quarterPerf: 953.124545, other: 735.22, sick: 0, late: 0, gross: 18103, social: 783.3, fund: 135, tax: 0, net: 17185 },
  { id: 9, month: 202603, position: '运营专员', should: 27, actual: 27, annual: 180000, monthly: 15000, fixed: 7083, base: 1417, overtime: 5666, perfStd: 7917, orderPerf: 1979.25, dailyPerf: 765.31, developmentPerf: 3166.8, perfActual: 5911.36, other: 751, sick: 0, late: 0, gross: 13745, social: 783.3, fund: 190, tax: 0, net: 12772 },
  { id: 10, month: 202603, position: '运营助理', should: 27, actual: 27, annual: 120000, monthly: 10000, fixed: 7000, base: 1400, overtime: 5600, perfStd: 3000, orderPerf: 2935.846321, dailyPerf: 300, communityPerf: 873, perfActual: 4108.846321, quarterPerf: 98.319328, sick: 0, late: 0, gross: 11207, social: 783.3, fund: 243, tax: 0, net: 10181 },
  { id: 11, month: 202604, position: '管理型店长', should: 26, actual: 22.5, annual: 350000, monthly: 29167, fixed: 12500, base: 2163, overtime: 8654, perfStd: 16667, paymentPerf: 7501.144737, orderPerf: 7988.255, refundPerf: 0, supportPerf: 0, perfActual: 15489.399737, other: 120, gross: 26426, social: 783.3, fund: 318, tax: 348.41, net: 24976 },
  { id: 12, month: 202604, position: '设计总监', should: 26, actual: 30, annual: 400000, monthly: 33333, fixed: 14583, base: 3365, overtime: 13461, perfStd: 18750, paymentPerf: 12657.928585, refundPerf: 0, orderSuccessPerf: 1968.75, installSuccessPerf: 0, perfActual: 14626.678585, other: 20, gross: 31473, social: 783.3, fund: 237, tax: 348.41, net: 30104 },
  { id: 13, month: 202604, position: '区域督导', should: 22, actual: 26, annual: 180000, monthly: 15000, fixed: 7083, base: 1417, overtime: 5666, perfStd: 7917, paymentPerf: 5457.663228, orderPerf: 4229.210323, refundPerf: 633.36, dailyPerf: 752.115, otherPerformance: -0.000001, perfActual: 11072.34855, gross: 18155, social: 783.3, fund: 135, tax: 348.41, net: 16888 },
  { id: 14, month: 202604, position: '运营专员', should: 22, actual: 24, annual: 180000, monthly: 15000, fixed: 7083, base: 1417, overtime: 5666, perfStd: 7917, orderPerf: 4912.6, dailyPerf: 736.281, developmentPerf: 3166.8, perfActual: 8815.681, gross: 15899, social: 783.3, fund: 190, tax: 348.41, net: 14577 },
  { id: 15, month: 202604, position: '运营助理', should: 22, actual: 25, annual: 120000, monthly: 10000, fixed: 7000, base: 1400, overtime: 5600, perfStd: 3000, orderPerf: 2411.162791, dailyPerf: 294, communityPerf: 450, perfActual: 3155.162791, gross: 10155, social: 783.3, fund: 243, tax: 348.41, net: 8780 },
];

const salesDesignRows: PayrollRow[] = [
  { id: 101, group: '销售设计岗', sourceType: 'consultant', month: 202604, position: '队长', should: 25, actual: 25, annual: 0, monthly: 0, fixed: 0, base: 0, overtime: 0, perfStd: 0, sickDays: 0, salesCommission: 34090.012, otherCommission: 0, salaryBase: 1000, phoneSubsidy: 100, guaranteeSalary: 4000, afterSaleDeduction: 0, orderDeduction: 0, lateDeduction: 0, otherDeduction: 0, fixedOtherAmount: 0, retroAmount: 0, holidaySubsidy: 120, perfActual: 34090, gross: 35310, social: 783.3, fund: 273, tax: 0, net: 34253.7 },
  { id: 102, group: '销售设计岗', sourceType: 'consultant', month: 202604, position: '家居顾问', should: 26, actual: 21.5, annual: 0, monthly: 0, fixed: 0, base: 0, overtime: 0, perfStd: 0, sickDays: 4, salesCommission: 4944.054, otherCommission: 0, salaryBase: 1000, phoneSubsidy: 100, guaranteeSalary: 4000, afterSaleDeduction: 0, orderDeduction: 0, lateDeduction: 0, otherDeduction: 0, fixedOtherAmount: 0, retroAmount: 0, holidaySubsidy: 120, perfActual: 4944, gross: 5967, social: 783.3, fund: 232, tax: 0, net: 4951.7 },
  { id: 103, group: '销售设计岗', sourceType: 'consultant', month: 202604, position: '家居顾问', should: 26, actual: 25.5, annual: 0, monthly: 0, fixed: 0, base: 0, overtime: 0, perfStd: 0, sickDays: 0, salesCommission: 9996.672, otherCommission: 0, salaryBase: 1000, phoneSubsidy: 100, guaranteeSalary: 4000, afterSaleDeduction: 0, orderDeduction: 0, lateDeduction: 0, otherDeduction: 0, fixedOtherAmount: 0, retroAmount: 50, holidaySubsidy: 120, perfActual: 9997, gross: 11217, social: 783.3, fund: 258, tax: 0, net: 10175.7 },
  { id: 201, group: '销售设计岗', sourceType: 'designer', month: 202604, position: '全屋设计师', should: 25, actual: 28.5, annual: 0, monthly: 0, fixed: 0, base: 0, overtime: 0, perfStd: 0, sickDays: 0, designCommission: 40306.176, salaryBase: 2000, housingSubsidy: 500, trafficSubsidy: 200, guaranteeSalary: 4500, lateDeduction: 0, holidaySubsidy: 120, afterSaleDeduction: 634, customDeduction: 0, renderAmount: 1027117, specialFee: 7460, orderAuditDeduction: 180, productBonus: 0, perfActual: 5420.468, gross: 48262.64, social: 783.3, fund: 310, tax: 0, net: 47169.34 },
  { id: 202, group: '销售设计岗', sourceType: 'designer', month: 202604, position: '产品设计师', should: 25, actual: 29, annual: 0, monthly: 0, fixed: 0, base: 0, overtime: 0, perfStd: 0, sickDays: 0, designCommission: 3700, salaryBase: 2000, housingSubsidy: 0, trafficSubsidy: 350, guaranteeSalary: 4500, lateDeduction: 0, holidaySubsidy: 120, afterSaleDeduction: 90, customDeduction: 0, renderAmount: 100000, specialFee: 0, orderAuditDeduction: 0, productBonus: 0, perfActual: 400, gross: 6880, social: 783.3, fund: 135, tax: 0, net: 5961.7 },
  { id: 203, group: '销售设计岗', sourceType: 'designer', month: 202604, position: '产品设计师', should: 26, actual: 28, annual: 0, monthly: 0, fixed: 0, base: 0, overtime: 0, perfStd: 0, sickDays: 0, designCommission: 13457.684, salaryBase: 2000, housingSubsidy: 500, trafficSubsidy: 350, guaranteeSalary: 4500, lateDeduction: 0, holidaySubsidy: 120, afterSaleDeduction: 813, customDeduction: 0, renderAmount: 359877, specialFee: 0, orderAuditDeduction: 270, productBonus: 0, perfActual: 1169.508, gross: 16984.19, social: 783.3, fund: 197, tax: 0, net: 16003.89 },
];

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

function enrichPayrollRows(rows: PayrollRow[]) {
  const positionCounts: Record<string, number> = {};
  return rows.map((row, index) => {
    const count = (positionCounts[row.position] ?? 0) + 1;
    positionCounts[row.position] = count;
    return {
      ...row,
      group: row.group || '管理岗',
      sourceType: row.sourceType || 'management',
      id: row.id || index + 1,
      employeeName: row.employeeName || `${row.position}${String(count).padStart(2, '0')}`,
      dept: row.dept || deptForPosition(row.position),
    };
  });
}

function formatMonthValue(month: number) {
  const text = String(month);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

function preciseMoney(value: number | null | undefined) {
  return val(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function diffText(value: number) {
  if (Math.abs(value) < 0.01) return '0';
  return value > 0 ? `+${preciseMoney(value)}` : preciseMoney(value);
}

function pct(pass: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((pass / total) * 100)}%`;
}

function rowKey(row: PayrollRow) {
  return `${row.group || '管理岗'}-${row.sourceType || 'management'}-${row.id}`;
}

async function readPayrollRowsFromFile(file: File) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[SOURCE_SHEET] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const get = (row: unknown[], index: number) => row[index];
  const num = (row: unknown[], index: number) => normalizeNumber(get(row, index));

  return table
    .slice(1)
    .map((row, index): PayrollRow | null => {
      const month = num(row, 0);
      const position = String(get(row, 2) ?? '').trim();
      const gross = num(row, 44);
      const net = num(row, 48);
      if (!month || !position || gross === null || net === null) return null;

      return {
        id: index + 1,
        employeeName: String(get(row, 1) || '').trim() || undefined,
        dept: String(get(row, 3) || '').trim() || undefined,
        month,
        position,
        should: num(row, 5) ?? 0,
        actual: num(row, 6) ?? 0,
        annual: num(row, 7) ?? 0,
        monthly: num(row, 8) ?? 0,
        fixed: num(row, 9) ?? 0,
        base: num(row, 10) ?? 0,
        overtime: num(row, 11) ?? 0,
        perfStd: num(row, 12) ?? 0,
        paymentPerf: num(row, 16),
        orderPerf: num(row, 20),
        refundPerf: num(row, 23),
        supportPerf: num(row, 25),
        orderSuccessPerf: num(row, 27),
        installSuccessPerf: num(row, 29),
        dailyPerf: num(row, 31),
        samplePerf: num(row, 33),
        developmentPerf: num(row, 35),
        communityPerf: num(row, 37),
        perfActual: num(row, 38) ?? 0,
        quarterPerf: num(row, 39),
        other: num(row, 40),
        sick: num(row, 41),
        late: num(row, 42),
        annualBonus: num(row, 43),
        gross,
        social: num(row, 45) ?? 0,
        fund: num(row, 46) ?? 0,
        tax: num(row, 47),
        net,
      };
    })
    .filter((row): row is PayrollRow => Boolean(row));
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
  { key: 'employeeName', label: '姓名', get: row => row.employeeName || '' },
  { key: 'position', label: '岗位', get: row => row.position },
  { key: 'dept', label: '门店', get: row => row.dept || '' },
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
  { key: 'employeeName', label: '姓名', get: row => row.employeeName || '' },
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

const FORMULA_STORAGE_KEY = 'salary-calculation-formula-rules-v1';
const FIELD_CONFIG_STORAGE_KEY = 'salary-calculation-field-config-v1';
const OPERATOR_OPTIONS = ['', '+', '-', '*', '/', '%'] as const;

function loadStoredFormulaRules() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FORMULA_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function loadStoredFieldConfigs() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FIELD_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, RuleFieldConfig> : {};
  } catch {
    return {};
  }
}

function formulaRuleKey(group: string, position: string, employeeKey: string, columnKey: string) {
  return `${group}::${position || '全部'}::${employeeKey || '*'}::${columnKey}`;
}

function ruleScopeKey(group: string, position: string, employeeKey: string) {
  return `${group}::${position || '全部'}::${employeeKey || '*'}`;
}

function fieldConfigKey(group: string, position: string, employeeKey: string, fieldKey: string) {
  return `${ruleScopeKey(group, position, employeeKey)}::${fieldKey}`;
}

function buildOperationText(field: Pick<RuleFieldConfig, 'op1' | 'value1' | 'op2' | 'value2'>) {
  return `${field.op1}${field.value1}${field.op2}${field.value2}`.trim();
}

function defaultFieldConfig(column: SheetColumn): RuleFieldConfig {
  return {
    key: column.key,
    label: columnTitle(column),
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<PayrollRow[]>(() => enrichPayrollRows([...payrollRows, ...salesDesignRows]));
  const [activeView, setActiveView] = useState<'calculation' | 'rules'>('calculation');
  const [activeGroup, setActiveGroup] = useState<'管理岗' | '销售设计岗'>('管理岗');
  const [activePosition, setActivePosition] = useState('全部');
  const [ruleMode, setRuleMode] = useState<'position' | 'person'>('position');
  const [rulePanelMode, setRulePanelMode] = useState<'templates' | 'detail'>('templates');
  const [ruleModal, setRuleModal] = useState<'import' | 'export' | null>(null);
  const [ruleGroup, setRuleGroup] = useState<'管理岗' | '销售设计岗'>('管理岗');
  const [rulePosition, setRulePosition] = useState('管理型店长');
  const [ruleEmployeeKey, setRuleEmployeeKey] = useState('*');
  const [ruleStatus, setRuleStatus] = useState('');
  const [importDraftFields, setImportDraftFields] = useState<ImportDraftField[]>([]);
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
  const calculatedRows = useMemo(() => rows.map(calculateRow), [rows]);
  const deptOptions = useMemo(() => ['全部', ...Array.from(new Set(rows.map((row) => row.dept || '未分配部门')))], [rows]);
  const filteredRows = calculatedRows.filter((row) => {
    const matchGroup = row.group === activeGroup;
    const matchPosition = activePosition === '全部' || row.position === activePosition;
    const matchDept = deptFilter === '全部' || (row.dept || '未分配部门') === deptFilter;
    const matchMonth = !monthFilter || formatMonthValue(row.month) === monthFilter;
    const keyword = employeeQuery.trim().toLowerCase();
    const matchEmployee = !keyword
      || String(row.employeeName || '').toLowerCase().includes(keyword)
      || row.position.toLowerCase().includes(keyword);
    return matchGroup && matchPosition && matchDept && matchMonth && matchEmployee;
  });
  const activeSheetColumns = useMemo(() => {
    if (activeGroup === '管理岗') return managementSheetColumns;
    if (activePosition === '全屋设计师' || activePosition === '产品设计师') return designerSheetColumns;
    return consultantSheetColumns;
  }, [activeGroup, activePosition]);
  const rulePositions = useMemo(() => {
    return Array.from(new Set(rows.filter((row) => row.group === ruleGroup).map((row) => row.position)));
  }, [rows, ruleGroup]);
  const ruleTemplates = useMemo((): RuleTemplate[] => {
    const groups = Array.from(new Set(rows.map((row) => row.group || '管理岗'))) as ('管理岗' | '销售设计岗')[];
    return groups.flatMap((group) => {
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
          fieldCount: columns.length,
        };
      });
    });
  }, [rows]);
  const ruleEmployees = useMemo(() => {
    return calculatedRows.filter((row) => row.group === ruleGroup && row.position === rulePosition);
  }, [calculatedRows, ruleGroup, rulePosition]);
  const baseRuleColumns = useMemo(() => {
    if (ruleGroup === '管理岗') return managementSheetColumns;
    if (rulePosition === '全屋设计师' || rulePosition === '产品设计师') return designerSheetColumns;
    return consultantSheetColumns;
  }, [ruleGroup, rulePosition]);
  const selectedRuleEmployeeKey = ruleMode === 'person' ? ruleEmployeeKey : '*';
  const ruleFields = useMemo((): RuleFieldRow[] => {
    const scope = ruleScopeKey(ruleGroup, rulePosition, selectedRuleEmployeeKey);
    const baseRows = baseRuleColumns
      .map((column) => {
        const config = fieldConfigs[fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, column.key)] || defaultFieldConfig(column);
        return { ...config, baseColumn: column };
      })
      .filter((field) => !field.deleted);
    const customRows = Object.entries(fieldConfigs)
      .filter(([key, config]) => key.startsWith(`${scope}::`) && config.custom && !config.deleted)
      .map(([, config]) => ({ ...config }));
    const customKeys = new Set(baseRows.map((field) => field.key));
    return [...baseRows, ...customRows.filter((field) => !customKeys.has(field.key))];
  }, [baseRuleColumns, fieldConfigs, ruleGroup, rulePosition, selectedRuleEmployeeKey]);
  const hasTieredHeader = activeSheetColumns.some((column) => column.topLabel !== undefined || column.bottomLabel !== undefined);
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
  const selected = visibleRows[0] || calculatedRows[0];
  const passCount = visibleRows.filter((row) => row.passed).length;
  const totalGrossDiff = visibleRows.reduce((sum, row) => sum + Math.abs(row.grossDiff), 0);
  const totalNetDiff = visibleRows.reduce((sum, row) => sum + Math.abs(row.netDiff), 0);
  const activeFormulaKey = activeFormulaColumn ? formulaRuleKey(activeGroup, activePosition, '*', activeFormulaColumn.key) : '';
  const activeFormulaText = activeFormulaColumn
    ? formulaDrafts[activeFormulaKey] ?? activeFormulaColumn.formula ?? emptyFormula
    : '';
  const headerTextColor = colors.sidebarMuted || colors.textMuted;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FORMULA_STORAGE_KEY, JSON.stringify(formulaDrafts));
    }
  }, [formulaDrafts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FIELD_CONFIG_STORAGE_KEY, JSON.stringify(fieldConfigs));
    }
  }, [fieldConfigs]);

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

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const importedRows = await readPayrollRowsFromFile(file);
      if (!importedRows.length) {
        setImportStatus('未识别到可核算数据');
        return;
      }
      setRows(enrichPayrollRows(importedRows));
      setActiveGroup('管理岗');
      setActivePosition('全部');
      setDeptFilter('全部');
      setMonthFilter('');
      setEmployeeQuery('');
      setSelectedRowKeys(new Set());
      setImportStatus(`已导入 ${importedRows.length} 条`);
    } catch (error) {
      setImportStatus('导入失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    const exportRows = selectedVisibleRows.length ? selectedVisibleRows : visibleRows;
    const headerRows = hasTieredHeader
      ? [
        activeSheetColumns.map((column) => column.topLabel ?? column.label),
        activeSheetColumns.map((column) => column.bottomLabel ?? ''),
      ]
      : [activeSheetColumns.map((column) => column.label)];
    const body = exportRows.map((row) => activeSheetColumns.map((column) => column.get(row)));
    const csv = [...headerRows, ...body].map((line) => line.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `薪酬核算对账_${monthFilter || '全部'}_${activeGroup}_${activePosition}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    setRulePanelMode('detail');
    setRuleStatus('');
  };

  const openTemplateModal = (template: RuleTemplate, modal: 'import' | 'export') => {
    openTemplateDetail(template);
    if (modal === 'import') {
      const columns = template.group === '管理岗'
        ? managementSheetColumns
        : template.position === '全屋设计师' || template.position === '产品设计师'
          ? designerSheetColumns
          : consultantSheetColumns;
      setImportDraftFields(columns.map((column, index) => {
        const name = columnTitle(column);
        return {
          key: column.key,
          detectedName: name,
          renamedName: name,
          status: column.formula || index < 8 ? '已识别' : '待确认',
          selected: true,
        };
      }));
    }
    if (modal === 'export') {
      const columns = template.group === '管理岗'
        ? managementSheetColumns
        : template.position === '全屋设计师' || template.position === '产品设计师'
          ? designerSheetColumns
          : consultantSheetColumns;
      setExportFieldKeys(new Set(columns.map((column) => column.key)));
    }
    setRuleModal(modal);
  };

  const openCurrentTemplateImport = () => {
    setImportDraftFields(baseRuleColumns.map((column, index) => {
      const name = columnTitle(column);
      return {
        key: column.key,
        detectedName: name,
        renamedName: name,
        status: column.formula || index < 8 ? '已识别' : '待确认',
        selected: true,
      };
    }));
    setRuleModal('import');
  };

  const openCurrentTemplateExport = () => {
    setExportFieldKeys(new Set(ruleFields.map((field) => field.key)));
    setRuleModal('export');
  };

  const saveRuleEditor = () => {
    if (!editingRuleField || !ruleFieldDraft) return;
    if (ruleMode === 'person' && selectedRuleEmployeeKey === '*') {
      setRuleStatus('请选择人员');
      return;
    }
    const finalFormula = ruleFieldDraft.formula || buildOperationText(ruleFieldDraft) || emptyFormula;
    const nextConfig = { ...ruleFieldDraft, formula: finalFormula };
    const key = fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, editingRuleField.key);
    const formulaKey = formulaRuleKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, editingRuleField.key);
    setFieldConfigs((current) => ({ ...current, [key]: nextConfig }));
    setFormulaDrafts((current) => ({ ...current, [formulaKey]: finalFormula }));
    setEditingRuleField(null);
    setRuleFieldDraft(null);
    setRuleStatus('已保存');
  };

  const copyTemplateToPerson = () => {
    if (selectedRuleEmployeeKey === '*') {
      setRuleStatus('请选择人员');
      return;
    }
    const nextRules: Record<string, string> = {};
    const nextConfigs: Record<string, RuleFieldConfig> = {};
    baseRuleColumns.forEach((column) => {
      const templateConfig = fieldConfigs[fieldConfigKey(ruleGroup, rulePosition, '*', column.key)] || defaultFieldConfig(column);
      const personConfigKey = fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, column.key);
      const personFormulaKey = formulaRuleKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, column.key);
      nextConfigs[personConfigKey] = { ...templateConfig, source: '人员微调' };
      nextRules[personFormulaKey] = templateConfig.formula;
    });
    setFieldConfigs((current) => ({ ...current, ...nextConfigs }));
    setFormulaDrafts((current) => ({ ...current, ...nextRules }));
    setRuleStatus('已复制岗位模板');
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
      source: ruleMode === 'person' ? '人员微调' : '岗位模板',
      formula: '',
      op1: '+',
      value1: '',
      op2: '',
      value2: '',
      custom: true,
    };
    setEditingRuleField(draft);
    setRuleFieldDraft(draft);
    setRuleStatus('');
  };

  const deleteRuleField = (field: RuleFieldRow) => {
    const key = fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key);
    const { baseColumn, ...fieldConfig } = field;
    setFieldConfigs((current) => ({
      ...current,
      [key]: { ...fieldConfig, deleted: true },
    }));
    setRuleStatus('已删除字段');
  };

  const confirmImportFields = () => {
    const nextConfigs: Record<string, RuleFieldConfig> = {};
    importDraftFields.filter((field) => field.selected).forEach((field) => {
      const baseColumn = baseRuleColumns.find((column) => column.key === field.key);
      const baseConfig = baseColumn ? defaultFieldConfig(baseColumn) : {
        key: field.key,
        label: field.detectedName,
        source: '输入项' as const,
        formula: emptyFormula,
        op1: '' as const,
        value1: '',
        op2: '' as const,
        value2: '',
      };
      nextConfigs[fieldConfigKey(ruleGroup, rulePosition, selectedRuleEmployeeKey, field.key)] = {
        ...baseConfig,
        label: field.renamedName || field.detectedName,
        source: ruleMode === 'person' ? '人员微调' : baseConfig.source,
      };
    });
    setFieldConfigs((current) => ({ ...current, ...nextConfigs }));
    setRuleModal(null);
    setRuleStatus('导入项已确认');
  };

  const saveExportFields = () => {
    setRuleModal(null);
    setRuleStatus(`导出项已保存 ${exportFieldKeys.size} 个字段`);
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

  return (
    <div style={{ height: '100%', display: 'flex', background: colors.appBg, color: colors.text, position: 'relative' }}>
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
            onClick={() => setActiveView('calculation')}
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
            <ShieldCheck size={14} />
            <span style={{ flex: 1, fontWeight: activeView === 'calculation' ? 600 : 400 }}>核算表格</span>
            <ChevronRight size={12} style={{ opacity: 0.65, transform: activeView === 'calculation' ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </div>
          {activeView === 'calculation' && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}>
          {(['管理岗', '销售设计岗'] as const).map((group) => {
            const groupActive = activeGroup === group;
            const groupPositions = ['全部', ...Array.from(new Set(rows.filter((row) => row.group === group).map((row) => row.position)))];
            return (
              <div key={group}>
                <div
                  onClick={() => {
                    setActiveView('calculation');
                    setActiveGroup(group);
                    setActivePosition('全部');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 14px',
                    fontSize: 13,
                    color: groupActive ? '#FFFFFF' : colors.sidebarText,
                    backgroundColor: groupActive ? 'rgba(170, 43, 58, 0.15)' : 'transparent',
                    borderLeft: groupActive ? `3px solid ${colors.sidebarActiveBg}` : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <Layers3 size={14} />
                  <span style={{ flex: 1, fontWeight: groupActive ? 600 : 400 }}>{group}</span>
                  <ChevronRight size={12} style={{ opacity: 0.65, transform: groupActive ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                </div>
                {groupActive && (
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
                    {groupPositions.map((position) => {
                      const active = activePosition === position;
                      return (
                        <div
                          key={`${group}-${position}`}
                          onClick={() => setActivePosition(position)}
                          style={{
                            padding: '8px 14px 8px 36px',
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
                          {position}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
            </div>
          )}
          <div
            onClick={() => setActiveView('rules')}
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
            <ChevronRight size={12} style={{ opacity: 0.65, transform: activeView === 'rules' ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </div>
          {activeView === 'rules' && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
              {[
                ['position', '岗位模板'],
                ['person', '人员微调'],
              ].map(([mode, label]) => {
                const active = ruleMode === mode;
                return (
                  <div
                    key={mode}
                    onClick={() => setRuleMode(mode as 'position' | 'person')}
                    style={{
                      padding: '8px 14px 8px 36px',
                      fontSize: 12,
                      color: active ? colors.sidebarActiveText : colors.sidebarMuted,
                      backgroundColor: active ? colors.sidebarActiveBg : 'transparent',
                      cursor: 'pointer',
                      borderLeft: active ? '3px solid rgba(255,255,255,0.4)' : '3px solid transparent',
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
        {activeView === 'rules' ? (
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
                  <Settings2 size={19} color={colors.primary} />
                  {rulePanelMode === 'templates' ? '规则配置' : `${rulePosition}模板`}
                </div>
                {ruleStatus && <span style={{ color: colors.textMuted, fontSize: 12 }}>{ruleStatus}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, overflow: 'hidden', height: 32 }}>
                  {[
                    ['position', '岗位模板'],
                    ['person', '人员微调'],
                  ].map(([mode, label]) => {
                    const active = ruleMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => {
                          setRuleMode(mode as 'position' | 'person');
                          setRuleStatus('');
                        }}
                        style={{
                          border: 'none',
                          borderRight: mode === 'position' ? `1px solid ${colors.inputBorder}` : 'none',
                          background: active ? colors.primary : colors.cardBg,
                          color: active ? colors.primaryText : colors.text,
                          padding: '0 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {ruleMode === 'person' && (
                  <>
                    <select
                      value={ruleGroup}
                      onChange={(event) => {
                        setRuleGroup(event.target.value as '管理岗' | '销售设计岗');
                        setRuleEmployeeKey('*');
                        setRulePanelMode('templates');
                        setRuleStatus('');
                      }}
                      style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', fontSize: 13 }}
                    >
                      {(['管理岗', '销售设计岗'] as const).map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                    <select
                      value={rulePosition}
                      onChange={(event) => {
                        setRulePosition(event.target.value);
                        setRuleEmployeeKey('*');
                        setRuleStatus('');
                      }}
                      style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', fontSize: 13 }}
                    >
                      {rulePositions.map((position) => (
                        <option key={position} value={position}>{position}</option>
                      ))}
                    </select>
                    <select
                      value={ruleEmployeeKey}
                      onChange={(event) => {
                        setRuleEmployeeKey(event.target.value);
                        setRuleStatus('');
                      }}
                      style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', fontSize: 13, minWidth: 160 }}
                    >
                      <option value="*">选择人员</option>
                      {ruleEmployees.map((employee) => (
                        <option key={rowKey(employee)} value={rowKey(employee)}>{employee.employeeName || employee.position}</option>
                      ))}
                    </select>
                    <button
                      onClick={copyTemplateToPerson}
                      style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}
                    >
                      复制岗位模板
                    </button>
                  </>
                )}
                {rulePanelMode === 'detail' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <button onClick={() => setRulePanelMode('templates')} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                      返回模板
                    </button>
                    <button onClick={openCurrentTemplateImport} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 10px', cursor: 'pointer' }}>
                      导入项
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

            {rulePanelMode === 'templates' ? (
              <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>核算模板</span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>{ruleTemplates.length} 个模板</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                    <thead>
                      <tr style={{ background: colors.tableHeaderBg }}>
                        {['模板名称', '岗位分组', '关联岗位', '表头数量', '操作'].map((header) => (
                          <th key={header} style={{ padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap' }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ruleTemplates.map((template) => (
                        <tr key={template.id} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                          <td style={{ padding: '12px', color: colors.text, fontWeight: 600 }}>{template.name}</td>
                          <td style={{ padding: '12px', color: colors.textMuted }}>{template.group}</td>
                          <td style={{ padding: '12px', color: colors.textMuted }}>{template.position}</td>
                          <td style={{ padding: '12px', color: colors.textMuted }}>{template.fieldCount}</td>
                          <td style={{ padding: '12px', display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>
                            <button onClick={() => openTemplateDetail(template)} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>详情</button>
                            <button onClick={() => openTemplateDetail(template)} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>编辑</button>
                            <button onClick={() => openTemplateModal(template, 'import')} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>导入项</button>
                            <button onClick={() => openTemplateModal(template, 'export')} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>导出项</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{ruleMode === 'position' ? '岗位模板' : '人员微调'} / {rulePosition}</span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>{ruleFields.length} 个表头</span>
                </div>
                <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {ruleFields.map((field, index) => (
                    <div key={`${field.key}-${index}`} style={{ minHeight: 58, border: `1px solid ${colors.tableBorder}`, borderRadius: 4, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: colors.cardBg }}>
                      <span style={{ color: colors.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label || '空表头'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <button onClick={() => openRuleEditor(field)} disabled={ruleMode === 'person' && selectedRuleEmployeeKey === '*'} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer' }}>编辑</button>
                        <button onClick={() => deleteRuleField(field)} disabled={ruleMode === 'person' && selectedRuleEmployeeKey === '*'} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer' }}>删除</button>
                      </span>
                    </div>
                  ))}
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(event) => handleImport(event.target.files?.[0] || null)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
              <ShieldCheck size={19} color={colors.primary} />
              薪酬核算
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 4,
                border: `1px solid ${colors.cardBorder}`,
                background: colors.tableHeaderBg,
                color: colors.textMuted,
                maxWidth: 520,
              }}
            >
              <FileSpreadsheet size={15} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SOURCE_FILE} / {SOURCE_SHEET}
              </span>
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
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: 32,
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 4,
                background: colors.cardBg,
                color: colors.text,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                cursor: 'pointer',
              }}
            >
              <Upload size={14} />
              导入
            </button>
            <button
              onClick={handleExport}
              style={{
                height: 32,
                border: 'none',
                borderRadius: 4,
                background: colors.primary,
                color: colors.primaryText,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              导出{selectedVisibleRows.length ? `(${selectedVisibleRows.length})` : ''}
            </button>
            {importStatus && <span style={{ color: colors.textMuted, fontSize: 12 }}>{importStatus}</span>}
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['验证样例', `${visibleRows.length} 条`],
            ['对账通过', `${passCount} 条`],
            ['通过率', pct(passCount, visibleRows.length)],
            ['差异合计', `${preciseMoney(totalGrossDiff + totalNetDiff)} 元`],
          ].map(([label, value]) => (
            <div key={label} style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: 14 }}>
              <div style={{ fontSize: 12, color: colors.textMuted }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{value}</div>
            </div>
          ))}
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
            <span style={{ fontWeight: 700 }}>{activePosition === '全部' ? activeGroup : activePosition}</span>
            <span style={{ color: colors.textMuted, fontSize: 12 }}>
              已选 {selectedVisibleRows.length} / {visibleRows.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(1280, activeSheetColumns.length * 106) }}>
              <thead>
                <tr style={{ background: colors.tableHeaderBg, color: headerTextColor }}>
                  <th rowSpan={hasTieredHeader ? 2 : 1} style={{ width: 44, padding: '10px 12px', borderBottom: `1px solid ${colors.tableBorder}` }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="全选人员"
                    />
                  </th>
                  {activeSheetColumns.map((col, index) => (
                    <th key={`${col.key}-${index}`} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${colors.tableBorder}`, fontWeight: 600, whiteSpace: 'pre-line', minWidth: col.label ? (col.width || 96) : 60, lineHeight: 1.35 }}>
                      {renderHeaderCell(col, hasTieredHeader ? (col.topLabel ?? col.label) : col.label)}
                    </th>
                  ))}
                </tr>
                {hasTieredHeader && (
                  <tr style={{ background: colors.tableHeaderBg, color: headerTextColor }}>
                    {activeSheetColumns.map((col, index) => (
                      <th key={`sub-${col.key}-${index}`} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${colors.tableBorder}`, fontWeight: 600, whiteSpace: 'pre-line', minWidth: col.label ? (col.width || 96) : 60, lineHeight: 1.35 }}>
                        {renderHeaderCell(col, col.bottomLabel ?? '')}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
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
                      <td key={`${rowKey(row)}-${col.key}-${index}`} style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: col.key === 'gross' || col.key === 'net' ? colors.text : undefined }}>
                        {col.get(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>样例拆解：{selected.month} / {selected.position}</div>
            {[
              ['月薪资标准', selected.calcMonthly, selected.monthly],
              ['基本工资', selected.calcBase, selected.base],
              ['加班工资', selected.calcOvertime, selected.overtime],
              ['绩效标准', selected.calcPerfStd, selected.perfStd],
              ['实得绩效', selected.calcPerfActual, selected.perfActual],
              ['应发工资', selected.calcGross, selected.gross],
              ['实发工资', selected.calcNet, selected.net],
            ].map(([label, systemValue, excelValue]) => {
              const diff = val(systemValue as number) - val(excelValue as number);
              return (
                <div key={label as string} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 70px', gap: 8, padding: '8px 0', borderTop: `1px solid ${colors.divider}`, alignItems: 'center' }}>
                  <span style={{ color: colors.textMuted }}>{label}</span>
                  <span>系统 {preciseMoney(systemValue as number)}</span>
                  <span>Excel {preciseMoney(excelValue as number)}</span>
                  <span style={{ color: Math.abs(diff) <= 1 ? colors.badgeGreenText : colors.badgeRedText }}>{diffText(diff)}</span>
                </div>
              );
            })}
        </section>
          </>
        )}
      </main>
      {ruleModal === 'import' && (
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
              width: 760,
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
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>导入项确认</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{rulePosition}模板 / 自动识别表头后确认重命名</div>
              </div>
              <button onClick={() => setRuleModal(null)} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', padding: 4 }} aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr style={{ background: colors.tableHeaderBg }}>
                    {['选择', '识别表头', '状态', '确认名称'].map((header) => (
                      <th key={header} style={{ padding: '10px 12px', fontSize: 12, color: headerTextColor, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importDraftFields.map((field, index) => (
                    <tr key={`${field.key}-${index}`} style={{ borderBottom: `1px solid ${colors.tableBorder}` }}>
                      <td style={{ padding: '9px 12px' }}>
                        <input
                          type="checkbox"
                          checked={field.selected}
                          onChange={(event) => setImportDraftFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))}
                        />
                      </td>
                      <td style={{ padding: '9px 12px', color: colors.text }}>{field.detectedName || '空表头'}</td>
                      <td style={{ padding: '9px 12px', color: field.status === '已识别' ? colors.badgeGreenText : colors.primary }}>{field.status}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <input
                          value={field.renamedName}
                          onChange={(event) => setImportDraftFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, renamedName: event.target.value, status: '已识别' } : item))}
                          style={{ height: 30, width: '100%', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px', outline: 'none' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ height: 1, background: colors.divider }} />
            <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: colors.cardBg }}>
              <button onClick={() => setRuleModal(null)} style={{ height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.cardBg, color: colors.text, padding: '0 12px', cursor: 'pointer' }}>
                关闭
              </button>
              <button onClick={confirmImportFields} style={{ height: 32, border: 'none', borderRadius: 4, background: colors.primary, color: colors.primaryText, padding: '0 12px', cursor: 'pointer' }}>
                确认导入
              </button>
            </div>
          </div>
        </div>
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
                  {ruleMode === 'position' ? '岗位模板' : '人员微调'} / {rulePosition}
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
                  {['输入项', '系统默认', '岗位模板', '人员微调'].map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.text }}>运算</span>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 1fr', gap: 8 }}>
                  <select
                    value={ruleFieldDraft.op1}
                    onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, op1: event.target.value as RuleFieldConfig['op1'] } : current)}
                    style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px' }}
                  >
                    {OPERATOR_OPTIONS.map((operator) => (
                      <option key={operator || 'none1'} value={operator}>{operator || '无'}</option>
                    ))}
                  </select>
                  <input
                    value={ruleFieldDraft.value1}
                    onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, value1: event.target.value } : current)}
                    placeholder="100"
                    style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none' }}
                  />
                  <select
                    value={ruleFieldDraft.op2}
                    onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, op2: event.target.value as RuleFieldConfig['op2'] } : current)}
                    style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 8px' }}
                  >
                    {OPERATOR_OPTIONS.map((operator) => (
                      <option key={operator || 'none2'} value={operator}>{operator || '无'}</option>
                    ))}
                  </select>
                  <input
                    value={ruleFieldDraft.value2}
                    onChange={(event) => setRuleFieldDraft((current) => current ? { ...current, value2: event.target.value } : current)}
                    placeholder="10%"
                    style={{ height: 34, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.inputText, padding: '0 10px', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.text }}>预览</span>
                <div style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 10px', border: `1px solid ${colors.tableBorder}`, borderRadius: 4, background: colors.tableHeaderBg, color: colors.textMuted }}>
                  {buildOperationText(ruleFieldDraft) || '-'}
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
