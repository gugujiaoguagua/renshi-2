import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  BarChart3,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns3,
  Download,
  FileDown,
  Filter,
  GripVertical,
  Grid2X2,
  Headphones,
  Info as InfoIcon,
  ListTree,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Minus,
  Plus,
  Redo2,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Upload,
  Undo2,
  UserRound,
  UsersRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  deleteOrganization,
  deleteOrganizationPosition,
  deleteOrganizationRank,
  fetchOrganizations,
  fetchOrganizationPositions,
  fetchOrganizationRanks,
  saveOrganization,
  saveOrganizationPosition,
  saveOrganizationRank,
  type OrganizationRecord,
  type OrganizationPositionRecord,
  type OrganizationRankRecord,
} from '../api/realData';
import { isRemovedOrganizationSection } from '../shared/navigation/visibilityPolicy';
import { DomainLinkagePanel } from '../shared/domain/DomainLinkagePanel';
import { downloadAttendanceXlsx, textCell, type XlsxCellValue } from '../shared/export/attendanceExport';

type ModalMode = 'add' | 'edit' | 'detail' | 'importOrg' | 'exportOrg' | 'batchEdit' | 'changeDetail' | 'fieldDrawer' | 'orgTypeEdit' | 'orgTypeDelete' | 'orgTypeSort' | 'positionEdit' | 'positionDelete' | 'rankEdit' | 'rankDelete' | 'servicePanel' | 'staffingApply' | 'expandLevel' | 'collapseLevel' | null;
type PageMode = 'organizations' | 'orgTypes' | 'changeRecords' | 'snapshots' | 'disabledOrgs' | 'settings' | 'architecture' | 'architectureSort' | 'positions' | 'positionImport' | 'ranks' | 'jobTitles' | 'staffing';

type OrganizationTypeRow = {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  desc: string;
  system?: boolean;
};

type ChangeRecord = {
  id: string;
  orgName: string;
  orgCode: string;
  orgType: string;
  changeType: '新增' | '修改' | '停用';
  effectiveStatus: '已生效' | '未生效';
  effectiveDate: string;
  actionTime: string;
  operator: string;
  parentName: string;
  remark: string;
};

type SnapshotRecord = {
  id: string;
  name: string;
  desc: string;
  creator: string;
  createdAt: string;
  status: '已生成' | '生成中';
};

type FieldSetting = {
  id: string;
  name: string;
  code: string;
  type: string;
  source: string;
  required: boolean;
  enabled: boolean;
  tableVisible: boolean;
  editable?: boolean;
  desc?: string;
};

type OrgFormState = {
  code: string;
  name: string;
  fullPath: string;
  parentCode: string;
  orgType: string;
  leader: string;
  approvalManager: string;
  company: string;
  effectiveDate: string;
  institutionNo: string;
  remark: string;
  status: string;
};

type OrgChartField = 'code' | 'type' | 'leader' | 'employeeCount' | 'childCount';

type OrgChartView = 'adaptive' | 'horizontal' | 'vertical';

type PositionFormState = {
  code: string;
  name: string;
  parentName: string;
  orgText: string;
  companyText: string;
  sequence: string;
  subSequence: string;
  sortNo: string;
  status: string;
  desc: string;
  remark: string;
};

type RankFormState = {
  sequence: string;
  subSequence: string;
  company: string;
  code: string;
  name: string;
  grade: string;
  status: string;
  desc: string;
};

type PositionColumnKey = 'code' | 'name' | 'parentName' | 'companyText' | 'orgText' | 'sequence' | 'subSequence' | 'sortNo' | 'status' | 'desc' | 'remark' | 'actions';

const POSITION_COLUMNS: Array<{ key: PositionColumnKey; label: string; width: number; required?: boolean }> = [
  { key: 'code', label: '岗位编码', width: 130 },
  { key: 'name', label: '岗位名称', width: 160, required: true },
  { key: 'parentName', label: '上级岗位', width: 160 },
  { key: 'companyText', label: '适用公司', width: 220 },
  { key: 'orgText', label: '所属组织', width: 220 },
  { key: 'sequence', label: '岗位序列', width: 160 },
  { key: 'subSequence', label: '岗位子序列', width: 160 },
  { key: 'sortNo', label: '顺序号', width: 120 },
  { key: 'status', label: '岗位状态', width: 120, required: true },
  { key: 'desc', label: '岗位描述', width: 150 },
  { key: 'remark', label: '备注', width: 100 },
  { key: 'actions', label: '操作', width: 170, required: true },
];

const FORM_INITIAL: OrgFormState = {
  code: '',
  name: '',
  fullPath: '',
  parentCode: '',
  orgType: '',
  leader: '',
  approvalManager: '',
  company: '上海拉迷家具有限公司',
  effectiveDate: new Date().toISOString().slice(0, 10),
  institutionNo: '',
  remark: '',
  status: '生效中',
};

const INITIAL_ORG_TYPES: OrganizationTypeRow[] = [
  { id: 'group', name: '集团', code: 'G', enabled: true, desc: '系统默认根组织类型', system: true },
  { id: 'department', name: '部门', code: 'D', enabled: true, desc: '适用于大部分企业，按照一定方式将同一类工作予以划分的组合', system: true },
  { id: 'branch', name: '分公司', code: 'B', enabled: true, desc: '是指在业务、资金、人事等方面受总公司管辖而不具有独立法人资格的分支机构', system: true },
  { id: 'subsidiary', name: '子公司', code: 'S', enabled: true, desc: '是指由母公司投入全部或部分股份，依法在世界各地设立的具有独立法人的分支机构', system: true },
  { id: 'business', name: '事业部', code: 'BD', enabled: true, desc: '是指以某个产品、地区或顾客为依据设立的具有独立单位的组织结构形式' },
  { id: 'store', name: '门店', code: 'SP', enabled: true, desc: '提供实体服务的店铺' },
  { id: 'project', name: '项目组', code: 'PT', enabled: true, desc: '是指为了完成某个特定任务而组织起来的一种组织形式' },
  { id: 'department-mini', name: '科室', code: 'DP', enabled: false, desc: '是指机关组织系统中按业务划分的内设机构，适用于政府机构、医疗、金融等领域' },
  { id: 'customer', name: '客户', code: 'C', enabled: false, desc: '适用于企业外部合作方，用于区分和管理外部客户组织，便于合同、交付及服务关系的独立维护' },
  { id: 'center', name: '中心', code: '0101', enabled: true, desc: '-' },
];

const INITIAL_FIELDS: FieldSetting[] = [
  { id: 'effectiveDate', name: '生效日期', code: 'effectiveDate', type: '日期', source: '系统字段', required: true, enabled: true, tableVisible: false },
  { id: 'name', name: '组织名称', code: 'name', type: '单行文本', source: '系统字段', required: true, enabled: true, tableVisible: true },
  { id: 'code', name: '组织编码', code: 'code', type: '单行文本', source: '系统字段', required: false, enabled: true, tableVisible: false },
  { id: 'orgType', name: '组织类型', code: 'orgType', type: '单选', source: '系统字段', required: true, enabled: true, tableVisible: true, editable: true },
  { id: 'leader', name: '组织负责人', code: 'leader', type: '选择成员', source: '系统字段', required: false, enabled: true, tableVisible: true },
  { id: 'approver', name: '审批主管', code: 'approver', type: '选择成员', source: '系统字段', required: false, enabled: true, tableVisible: true },
  { id: 'corpIds', name: '所属公司', code: 'corpIds', type: '单行文本', source: '系统字段', required: false, enabled: true, tableVisible: false },
  { id: 'parentId', name: '上级组织', code: 'parentId', type: '单行文本', source: '系统字段', required: true, enabled: true, tableVisible: false },
  { id: 'number', name: '机构号', code: 'number', type: '单行文本', source: '系统字段', required: false, enabled: true, tableVisible: false },
  { id: 'remark', name: '备注', code: 'remark', type: '单行文本', source: '系统字段', required: false, enabled: true, tableVisible: false },
  { id: 'orgFunction', name: '组织职能', code: 'orgFunction', type: '单选', source: '系统字段', required: false, enabled: false, tableVisible: false, editable: true },
];

const EMPTY_FIELD: FieldSetting = {
  id: '',
  name: '',
  code: '',
  type: '',
  source: '自定义字段',
  required: false,
  enabled: true,
  tableVisible: false,
  desc: '',
};

function text(value: unknown, fallback = '-') {
  const output = String(value ?? '').trim();
  return output || fallback;
}

function shortPerson(value: string) {
  return value ? value.replace('、', '、 ') : '-';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function codeWithName(org?: OrganizationRecord) {
  if (!org) return '';
  return `${org.code}-${org.name}`;
}

function csvCell(value: unknown) {
  const output = String(value ?? '').replace(/"/g, '""');
  return `"${output}"`;
}

function toOrgCsv(rows: OrganizationRecord[]) {
  const lines = toOrgExportRows(rows).map(row => row.map(csvCell).join(','));
  return `\uFEFF${ORG_EXPORT_HEADERS.map(csvCell).join(',')}\n${lines.join('\n')}`;
}

const ORG_EXPORT_HEADERS = ['组织编码', '组织名称', '组织全路径', '上级组织编码', '组织类型', '组织负责人', '审批主管', '直属成员', '成员总数', '状态'];

function toOrgExportRows(rows: OrganizationRecord[]): XlsxCellValue[][] {
  return rows.map(row => [
    row.code,
    row.name,
    row.fullPath,
    row.parentCode || '',
    row.orgType,
    row.leader || '',
    row.approvalManager || '',
    row.directMemberCount ?? 0,
    row.employeeCount ?? 0,
    row.status || '',
  ].map(textCell));
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildChangeRecords(rows: OrganizationRecord[]): ChangeRecord[] {
  const source = rows.length ? rows : [];
  const total = Math.max(60, source.length * 44);
  const operators = ['王梦云/13871412514', '陈洪英/17721327003', '林娜/CP25003', '朱军/XX25001'];
  return Array.from({ length: total }, (_, index) => {
    const row = source[index % source.length] || {
      code: '00000000',
      name: '上海拉迷家具有限公司',
      orgType: '集团',
      parentName: '-',
      remark: '',
    } as OrganizationRecord;
    const day = index < 1 ? '2026-05-07' : index < 4 ? '2026-04-27' : '2026-04-22';
    const minute = String((6 + index) % 60).padStart(2, '0');
    const second = String((29 + index * 7) % 60).padStart(2, '0');
    return {
      id: `chg-${index + 1}`,
      orgName: row.name,
      orgCode: row.code || String(index + 1).padStart(8, '0'),
      orgType: row.orgType || '部门',
      changeType: index === 0 ? '新增' : index % 17 === 0 ? '停用' : '修改',
      effectiveStatus: '已生效',
      effectiveDate: day,
      actionTime: `${day} ${index < 4 ? '17' : '10'}:${minute}:${second}`,
      operator: operators[index % operators.length],
      parentName: row.parentName || '-',
      remark: row.remark || '-',
    };
  });
}

function formatNow() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function initialOrganizationPageMode(): PageMode {
  if (typeof window === 'undefined') return 'organizations';
  const section = window.location.pathname.split('/').filter(Boolean)[1];
  if (section === 'positions') return 'positions';
  if (section === 'position-import') return 'positionImport';
  if (section === 'ranks') return 'ranks';
  if (isRemovedOrganizationSection(section)) return 'organizations';
  const tab = new URLSearchParams(window.location.search).get('tab');
  const allowed: PageMode[] = ['organizations', 'positions', 'positionImport', 'ranks'];
  return allowed.includes(tab as PageMode) ? (tab as PageMode) : 'organizations';
}

function organizationPathForMode(mode: PageMode) {
  const pathByMode: Partial<Record<PageMode, string>> = {
    organizations: '/organization',
    positions: '/organization/positions',
    positionImport: '/organization/position-import',
    ranks: '/organization/ranks',
  };
  return pathByMode[mode] || '/organization';
}

export default function OrganizationManagementPage() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [positionRows, setPositionRows] = useState<OrganizationPositionRecord[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState('');
  const [positionDraft, setPositionDraft] = useState<PositionFormState>({ code: '', name: '', parentName: '', orgText: '', companyText: '上海拉迷家具有限公司', sequence: '', subSequence: '', sortNo: '', status: '已启用', desc: '', remark: '' });
  const [rankRows, setRankRows] = useState<OrganizationRankRecord[]>([]);
  const [ranksLoading, setRanksLoading] = useState(true);
  const [ranksError, setRanksError] = useState('');
  const [rankDraft, setRankDraft] = useState<RankFormState>({ sequence: '', subSequence: '', company: '', code: '', name: '', grade: '', status: '已启用', desc: '' });
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [pageMode, setPageMode] = useState<PageMode>(() => initialOrganizationPageMode());
  const [activeOrg, setActiveOrg] = useState<OrganizationRecord | null>(null);
  const [activeChange, setActiveChange] = useState<ChangeRecord | null>(null);
  const [form, setForm] = useState<OrgFormState>(FORM_INITIAL);
  const [rowMenuCode, setRowMenuCode] = useState('');
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [bulkTip, setBulkTip] = useState('');
  const [exportSelectedCodes, setExportSelectedCodes] = useState<string[]>([]);
  const [orgTypes, setOrgTypes] = useState<OrganizationTypeRow[]>(INITIAL_ORG_TYPES);
  const [orgTypeDraft, setOrgTypeDraft] = useState<OrganizationTypeRow | null>(null);
  const [orgTypeDeleteTarget, setOrgTypeDeleteTarget] = useState<OrganizationTypeRow | null>(null);
  const [positionDeleteTarget, setPositionDeleteTarget] = useState<OrganizationPositionRecord | null>(null);
  const [rankDeleteTarget, setRankDeleteTarget] = useState<OrganizationRankRecord | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [fieldSettings, setFieldSettings] = useState<FieldSetting[]>(INITIAL_FIELDS);
  const [fieldDraft, setFieldDraft] = useState<FieldSetting>(EMPTY_FIELD);
  const [fieldDrawerTitle, setFieldDrawerTitle] = useState('新增字段');
  const [positionOriginalKey, setPositionOriginalKey] = useState('');
  const toolbarMenuRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchOrganizations();
      setRows(result.rows);
      const initialExpanded: Record<string, boolean> = {};
      result.rows.forEach(row => {
        if ((row.depth || 0) === 0) initialExpanded[row.code] = true;
      });
      setExpandedCodes(current => Object.keys(current).length ? current : initialExpanded);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    setPositionsLoading(true);
    setPositionsError('');
    try {
      const result = await fetchOrganizationPositions();
      setPositionRows(result.rows);
    } catch (err: any) {
      setPositionsError(String(err?.message || err));
    } finally {
      setPositionsLoading(false);
    }
  };

  const loadRanks = async () => {
    setRanksLoading(true);
    setRanksError('');
    try {
      const result = await fetchOrganizationRanks();
      setRankRows(result.rows);
    } catch (err: any) {
      setRanksError(String(err?.message || err));
    } finally {
      setRanksLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    loadPositions();
    loadRanks();
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (toolbarMenuRef.current && toolbarMenuRef.current.contains(event.target as Node)) return;
      if (moreMenuRef.current && moreMenuRef.current.contains(event.target as Node)) return;
      setToolbarMenuOpen(false);
      setMoreMenuOpen(false);
      setRowMenuCode('');
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  const rowsByCode = useMemo(() => new Map(rows.map(row => [row.code, row])), [rows]);

  const childCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(row => {
      const parent = row.parentCode || '';
      if (!parent) return;
      map.set(parent, (map.get(parent) || 0) + 1);
    });
    return map;
  }, [rows]);

  const descendantCount = (org: OrganizationRecord) => rows.filter(row => row.code !== org.code && row.fullPath.startsWith(`${org.fullPath}/`)).length;

  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const expanded = expandedCodes;
    return rows.filter(row => {
      if (keyword) {
        const haystack = `${row.name} ${row.code} ${row.fullPath} ${row.leader || ''} ${row.approvalManager || ''}`.toLowerCase();
        return haystack.includes(keyword);
      }
      const ancestors = rows.filter(item => row.fullPath.startsWith(`${item.fullPath}/`));
      return ancestors.every(item => expanded[item.code]);
    });
  }, [expandedCodes, query, rows]);

  const selectedOrg = activeOrg || rows[0] || null;
  const changeRecords = useMemo(() => buildChangeRecords(rows), [rows]);
  const disabledOrganizations = useMemo(() => rows.filter(row => row.status && !row.status.includes('生效')), [rows]);

  const openAdd = (parent?: OrganizationRecord) => {
    const target = parent || selectedOrg;
    setActiveOrg(parent || null);
    setForm({
      ...FORM_INITIAL,
      parentCode: target?.code || '',
      fullPath: target ? `${target.fullPath}/` : '上海拉迷家具有限公司/',
      effectiveDate: today(),
      company: '上海拉迷家具有限公司',
    });
    setModalMode('add');
  };

  const openEdit = (org: OrganizationRecord) => {
    setActiveOrg(org);
    setForm({
      code: org.code,
      name: org.name,
      fullPath: org.fullPath,
      parentCode: org.parentCode || '',
      orgType: org.orgType || '部门',
      leader: org.leader || '',
      approvalManager: org.approvalManager || '',
      company: '上海拉迷家具有限公司',
      effectiveDate: org.effectiveDate || today(),
      institutionNo: org.institutionNo || '',
      remark: org.remark || '',
      status: org.status || '生效中',
    });
    setModalMode('edit');
  };

  const openDetail = (org: OrganizationRecord) => {
    setActiveOrg(org);
    setModalMode('detail');
  };

  const updateForm = (key: keyof OrgFormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const saveForm = async () => {
    const name = form.name.trim();
    if (!name) {
      setNotice('请先填写组织名称');
      return;
    }
    const parent = rowsByCode.get(form.parentCode);
    const fullPath = parent
      ? `${parent.fullPath}/${name}`
      : name === '上海拉迷家具有限公司'
        ? name
        : `上海拉迷家具有限公司/${name}`;
    const nextCode = form.code.trim() || undefined;
    await saveOrganization({
      code: nextCode,
      name,
      fullPath,
      parentCode: form.parentCode,
      orgType: form.orgType || '部门',
      leader: form.leader,
      approvalManager: form.approvalManager,
      effectiveDate: form.effectiveDate,
      institutionNo: form.institutionNo,
      company: form.company,
      remark: form.remark,
      status: form.status,
    });
    if (modalMode === 'edit' && activeOrg?.code && nextCode && activeOrg.code !== nextCode) {
      await deleteOrganization(activeOrg.code);
    }
    setModalMode(null);
    setNotice('保存成功，组织、员工、考勤、薪酬引用的组织口径已刷新');
    await loadRows();
  };

  const deleteOrg = async (org: OrganizationRecord) => {
    await deleteOrganization(org.code);
    setRowMenuCode('');
    setSelectedCodes(current => current.filter(code => code !== org.code));
    setNotice(`已删除/隐藏 ${org.name}，员工、考勤、薪酬关联会按剩余组织重新计算`);
    await loadRows();
  };

  const disableOrg = async (org: OrganizationRecord) => {
    const nextStatus = org.status && !org.status.includes('停用') ? '已停用' : '生效中';
    await saveOrganization({ ...org, status: nextStatus });
    setRowMenuCode('');
    setNotice(`${org.name} 已${nextStatus === '已停用' ? '停用' : '启用'}，下游关联会按当前组织状态刷新`);
    await loadRows();
  };

  const toggleSelected = (code: string) => {
    setSelectedCodes(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
  };

  const toggleExpand = (code: string) => {
    setExpandedCodes(current => ({ ...current, [code]: !current[code] }));
  };

  const bulkDisableOrganizations = async () => {
    const selectedRows = rows.filter(row => selectedCodes.includes(row.code));
    if (!selectedRows.length) {
      showSelectionTip('批量停用');
      return;
    }
    for (const row of selectedRows) {
      await saveOrganization({ ...row, status: '已停用' });
    }
    setNotice(`已批量停用 ${selectedRows.length} 个组织，员工、考勤、薪酬关联会按当前组织状态刷新`);
    await loadRows();
  };

  const bulkDeleteOrganizations = async () => {
    const selectedRows = rows.filter(row => selectedCodes.includes(row.code));
    if (!selectedRows.length) {
      showSelectionTip('批量删除');
      return;
    }
    for (const row of selectedRows) {
      await deleteOrganization(row.code);
    }
    setSelectedCodes([]);
    setNotice(`已批量删除/隐藏 ${selectedRows.length} 个组织，下游关联会按剩余组织重新计算`);
    await loadRows();
  };

  const openToolbarModal = (mode: ModalMode) => {
    setToolbarMenuOpen(false);
    if (mode === 'exportOrg') setExportSelectedCodes(selectedCodes);
    setModalMode(mode);
  };

  const showSelectionTip = (label: string) => {
    if (selectedCodes.length) {
      setNotice(`${label}：已选择 ${selectedCodes.length} 个组织`);
      return;
    }
    setBulkTip(label);
    window.setTimeout(() => setBulkTip(current => current === label ? '' : current), 1800);
  };

  const openSubPage = (mode: PageMode) => {
    setToolbarMenuOpen(false);
    setMoreMenuOpen(false);
    setRowMenuCode('');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', organizationPathForMode(mode));
    }
    setPageMode(mode);
  };

  const goBackToOrganizations = () => {
    setPageMode('organizations');
    setNotice('');
  };

  const createSnapshot = () => {
    const next: SnapshotRecord = {
      id: `snap-${Date.now()}`,
      name: `组织快照-${new Date().toISOString().slice(0, 10)}`,
      desc: `包含 ${rows.length} 个组织、${rows.reduce((sum, row) => sum + (row.employeeCount || 0), 0)} 名成员`,
      creator: '李文文',
      createdAt: formatNow(),
      status: '已生成',
    };
    setSnapshots(current => [next, ...current]);
    setNotice('组织快照已创建');
  };

  const openFieldDrawer = (field?: FieldSetting) => {
    setFieldDraft(field ? { ...field } : { ...EMPTY_FIELD, id: `field-${Date.now()}` });
    setFieldDrawerTitle(field ? '编辑字段' : '新增字段');
    setModalMode('fieldDrawer');
  };

  const saveFieldDraft = () => {
    const name = fieldDraft.name.trim();
    const code = fieldDraft.code.trim() || name;
    if (!name || !fieldDraft.type) {
      setNotice('请填写字段名称和字段类型');
      return;
    }
    setFieldSettings(current => {
      const next = { ...fieldDraft, name, code };
      return current.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? next : item) : [...current, next];
    });
    setModalMode(null);
    setNotice('字段设置已保存');
  };

  const openOrgTypeEditor = (type?: OrganizationTypeRow) => {
    setOrgTypeDraft(type ? { ...type } : { id: `type-${Date.now()}`, name: '', code: `T${orgTypes.length + 1}`, enabled: true, desc: '' });
    setModalMode('orgTypeEdit');
  };

  const saveOrgTypeDraft = () => {
    if (!orgTypeDraft) return;
    const name = orgTypeDraft.name.trim();
    if (!name) {
      setNotice('请填写组织类型');
      return;
    }
    const next: OrganizationTypeRow = {
      ...orgTypeDraft,
      name,
      code: orgTypeDraft.code || `T${orgTypes.length + 1}`,
      desc: orgTypeDraft.desc.trim() || '-',
    };
    setOrgTypes(current => current.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? next : item) : [...current, next]);
    setModalMode(null);
    setOrgTypeDraft(null);
    setNotice('组织类型已保存，可在新增/编辑组织时选择使用');
  };

  const openOrgTypeDelete = (type: OrganizationTypeRow) => {
    setOrgTypeDeleteTarget(type);
    setModalMode('orgTypeDelete');
  };

  const confirmOrgTypeDelete = () => {
    if (!orgTypeDeleteTarget) return;
    setOrgTypes(current => current.filter(item => item.id !== orgTypeDeleteTarget.id));
    setNotice(`已删除组织类型：${orgTypeDeleteTarget.name}`);
    setOrgTypeDeleteTarget(null);
    setModalMode(null);
  };

  const openPositionEditor = (position?: OrganizationPositionRecord) => {
    setPositionOriginalKey(position ? String(position.code || position.name || '') : '');
    setPositionDraft({
      code: position?.code || '',
      name: position?.name || '',
      parentName: position?.parentName || '',
      orgText: position?.orgText === '-' ? '' : position?.orgText || '',
      companyText: position?.companyText === '-' ? '上海拉迷家具有限公司' : position?.companyText || '上海拉迷家具有限公司',
      sequence: position?.sequence || '',
      subSequence: position?.subSequence || '',
      sortNo: String((position as any)?.sortNo || ''),
      status: position?.status || '已启用',
      desc: String((position as any)?.desc || ''),
      remark: String((position as any)?.remark || ''),
    });
    setModalMode('positionEdit');
  };

  const savePositionDraft = async () => {
    if (!positionDraft.name.trim()) {
      setNotice('请先填写岗位名称');
      return;
    }
    await saveOrganizationPosition({
      ...positionDraft,
      orgs: splitValueList(positionDraft.orgText),
      companies: splitValueList(positionDraft.companyText),
    } as Partial<OrganizationPositionRecord>);
    const nextKey = positionDraft.code.trim() || positionDraft.name.trim();
    if (positionOriginalKey && nextKey && positionOriginalKey !== nextKey) {
      await deleteOrganizationPosition(positionOriginalKey);
    }
    setModalMode(null);
    setPositionOriginalKey('');
    setNotice('岗位已保存，员工、考勤、薪酬引用的岗位口径已刷新');
    await loadPositions();
  };

  const disablePosition = async (position: OrganizationPositionRecord) => {
    const nextStatus = /停用/.test(position.status) ? '已启用' : '已停用';
    await saveOrganizationPosition({ ...position, status: nextStatus });
    setNotice(`${position.name} 已${nextStatus === '已启用' ? '启用' : '停用'}`);
    await loadPositions();
  };

  const openPositionDelete = (position: OrganizationPositionRecord) => {
    setPositionDeleteTarget(position);
    setModalMode('positionDelete');
  };

  const confirmPositionDelete = async () => {
    if (!positionDeleteTarget) return;
    await deleteOrganizationPosition(positionDeleteTarget.code || positionDeleteTarget.name);
    setNotice(`已删除 ${positionDeleteTarget.code ? `${positionDeleteTarget.code}-` : ''}${positionDeleteTarget.name}，岗位列表已重新加载`);
    setPositionDeleteTarget(null);
    setModalMode(null);
    await loadPositions();
  };

  const bulkDisablePositions = async (positions: OrganizationPositionRecord[]) => {
    for (const position of positions) {
      await saveOrganizationPosition({ ...position, status: '已停用' });
    }
    setNotice(`已批量停用 ${positions.length} 个岗位，员工、考勤、薪酬关联会按当前岗位状态刷新`);
    await loadPositions();
  };

  const bulkDeletePositions = async (positions: OrganizationPositionRecord[]) => {
    for (const position of positions) {
      await deleteOrganizationPosition(position.code || position.name);
    }
    setNotice(`已批量删除/隐藏 ${positions.length} 个岗位，员工、考勤、薪酬关联会按剩余岗位重新计算`);
    await loadPositions();
  };

  const importPositions = async (importRows: Partial<OrganizationPositionRecord>[]) => {
    let saved = 0;
    for (const row of importRows) {
      if (!row.name) continue;
      await saveOrganizationPosition(row);
      saved += 1;
    }
    await loadPositions();
    return saved;
  };

  const importRanks = async (importRows: Partial<OrganizationRankRecord>[]) => {
    let saved = 0;
    for (const row of importRows) {
      if (!row.code || !row.name) continue;
      await saveOrganizationRank(row);
      saved += 1;
    }
    await loadRanks();
    return saved;
  };

  const importOrganizations = async (importRows: Partial<OrganizationRecord>[]) => {
    let saved = 0;
    const currentByCode = new Map(rows.map(row => [row.code, row]));
    for (const row of importRows) {
      if (!row.name) continue;
      const parent = currentByCode.get(String(row.parentCode || ''));
      const name = String(row.name || '').trim();
      const fullPath = row.fullPath && String(row.fullPath).includes('/')
        ? String(row.fullPath)
        : parent
          ? `${parent.fullPath}/${name}`
          : name === '上海拉迷家具有限公司'
            ? name
            : `上海拉迷家具有限公司/${name}`;
      const result = await saveOrganization({ ...row, name, fullPath });
      if (result.row?.code) currentByCode.set(result.row.code, { ...(result.row as OrganizationRecord), id: currentByCode.size + 1 });
      saved += 1;
    }
    await loadRows();
    return saved;
  };

  const openRankEditor = (rank?: OrganizationRankRecord) => {
    setRankDraft({
      sequence: rank?.sequence || '',
      subSequence: rank?.subSequence || '',
      company: rank?.company === '-' ? '' : rank?.company || '',
      code: rank?.code || '',
      name: rank?.name || '',
      grade: rank?.grade === '-' ? '' : rank?.grade || '',
      status: rank?.status || '已启用',
      desc: rank?.desc === '-' ? '' : rank?.desc || '',
    });
    setModalMode('rankEdit');
  };

  const saveRankDraft = async () => {
    if (!rankDraft.code.trim() || !rankDraft.name.trim()) {
      setNotice('请先填写职级代码和职级名称');
      return;
    }
    await saveOrganizationRank(rankDraft);
    setModalMode(null);
    setNotice('职级已保存，并重新读取职级真实数据');
    await loadRanks();
  };

  const disableRank = async (rank: OrganizationRankRecord) => {
    const nextStatus = /停用/.test(rank.status) ? '已启用' : '已停用';
    await saveOrganizationRank({ ...rank, status: nextStatus });
    setNotice(`${rank.name} 已${nextStatus === '已启用' ? '启用' : '停用'}`);
    await loadRanks();
  };

  const openRankDelete = (rank: OrganizationRankRecord) => {
    setRankDeleteTarget(rank);
    setModalMode('rankDelete');
  };

  const confirmRankDelete = async () => {
    if (!rankDeleteTarget) return;
    await deleteOrganizationRank(rankDeleteTarget.code || rankDeleteTarget.name);
    setNotice(`已删除 ${rankDeleteTarget.code ? `${rankDeleteTarget.code}-` : ''}${rankDeleteTarget.name}，职级列表已重新加载`);
    setRankDeleteTarget(null);
    setModalMode(null);
    await loadRanks();
  };

  return (
    <div style={{ flex: 1, minHeight: '100%', background: colors.appBg, display: 'grid', gridTemplateColumns: '146px minmax(0,1fr)', overflow: 'hidden' }}>
      <aside style={{ background: colors.sidebarBg, borderRight: `1px solid ${colors.sidebarBorder}`, color: colors.sidebarText, overflowY: 'auto' }}>
        <SideGroup active={['organizations', 'changeRecords', 'snapshots', 'disabledOrgs', 'orgTypes'].includes(pageMode)} />
        <SideItem active={['organizations', 'changeRecords', 'snapshots', 'disabledOrgs', 'orgTypes'].includes(pageMode)} label="组织架构" onClick={() => openSubPage('organizations')} />
        <SideGroup active={pageMode === 'positions' || pageMode === 'positionImport'} icon={<Building2 size={17} />} label="岗位管理" onClick={() => openSubPage('positions')} />
        <SideGroup active={pageMode === 'ranks'} icon={<ListTree size={17} />} label="职级管理" onClick={() => openSubPage('ranks')} />
      </aside>

      <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 14, minHeight: 0, overflow: 'hidden', flex: 1 }}>
          {pageMode === 'organizations' ? (
          <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
                <Button primary onClick={() => openAdd()}><Plus size={15} />新增组织</Button>
                <div ref={toolbarMenuRef} style={{ position: 'relative' }}>
                  <Button onClick={(event) => { event.stopPropagation(); setToolbarMenuOpen(open => !open); }}>
                    导入/导出/修改组织 <ChevronDown size={13} />
                  </Button>
                  {toolbarMenuOpen ? (
                    <DropMenu left={0} top={36}>
                      <DropItem icon={<Upload size={14} />} label="导入组织" onClick={() => openToolbarModal('importOrg')} />
                      <DropItem icon={<Download size={14} />} label="导出组织" onClick={() => openToolbarModal('exportOrg')} />
                      <DropItem icon={<FileDown size={14} />} label="批量修改" onClick={() => openToolbarModal('batchEdit')} />
                    </DropMenu>
                  ) : null}
                </div>
                <div style={{ position: 'relative' }}>
                  <Button onClick={bulkDisableOrganizations}>批量停用</Button>
                  {bulkTip === '批量停用' ? <FloatingTip>请先勾选要停用的组织</FloatingTip> : null}
                </div>
                <div style={{ position: 'relative' }}>
                  <Button onClick={bulkDeleteOrganizations}>批量删除</Button>
                  {bulkTip === '批量删除' ? <FloatingTip>请先勾选要删除的组织</FloatingTip> : null}
                </div>
                <div ref={moreMenuRef} style={{ position: 'relative' }}>
                  <Button onClick={(event) => { event.stopPropagation(); setMoreMenuOpen(open => !open); }}>更多操作 <ChevronDown size={13} /></Button>
                  {moreMenuOpen ? (
                    <DropMenu left={0} top={36}>
                      <DropItem label="变更记录列表" onClick={() => openSubPage('changeRecords')} />
                      <DropItem label="组织快照" onClick={() => openSubPage('snapshots')} />
                      <DropItem label="停用组织列表" onClick={() => openSubPage('disabledOrgs')} />
                    </DropMenu>
                  ) : null}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SearchBox value={query} onChange={setQuery} />
                  <SegmentedIcon active={viewMode === 'table'} onClick={() => setViewMode('table')}><Grid2X2 size={14} /></SegmentedIcon>
                  <SegmentedIcon active={viewMode === 'card'} onClick={() => setViewMode('card')}><Columns3 size={14} /></SegmentedIcon>
                </div>
              </div>

              {notice ? <div style={{ color: colors.primary, fontSize: 12, padding: '0 0 8px' }}>{notice}</div> : null}
              {error ? <div style={{ color: colors.primary, fontSize: 12, padding: '0 0 8px' }}>真实数据连接失败：{error}</div> : null}
              <DomainLinkagePanel focus="organization" />

              {loading ? (
                <div style={{ color: colors.textMuted, fontSize: 13, padding: 18 }}>正在加载真实组织架构...</div>
              ) : viewMode === 'card' ? (
                <OrgCards rows={visibleRows} />
              ) : (
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${colors.tableBorder}` }}>
                  <table style={{ width: '100%', minWidth: 1420, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: colors.tableHeaderBg }}>
                        <Header width={44} />
                        <Header width={430}>组织名称</Header>
                        <Header width={130}>直属成员</Header>
                        <Header width={140}>成员总数 <span style={{ color: colors.textMuted }}>ⓘ</span></Header>
                        <Header width={160}>组织类型</Header>
                        <Header width={170}>组织负责人</Header>
                        <Header width={170}>审批主管</Header>
                        <Header width={180}>操作</Header>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(row => {
                        const hasChildren = Boolean(childCountByCode.get(row.code));
                        const isExpanded = Boolean(expandedCodes[row.code]);
                        return (
                          <tr key={row.code} style={{ borderTop: `1px solid ${colors.tableBorder}`, height: 40 }}>
                            <Cell center>
                              <input type="checkbox" checked={selectedCodes.includes(row.code)} onChange={() => toggleSelected(row.code)} />
                            </Cell>
                            <Cell>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: Math.min((row.depth || 0) * 18, 84) }}>
                                {hasChildren ? (
                                  <button type="button" onClick={() => toggleExpand(row.code)} style={plainIconButton(colors.textMuted)}>
                                    <ChevronRight size={13} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', color: colors.textMuted }} />
                                  </button>
                                ) : <span style={{ width: 19 }} />}
                                <span style={{ color: row.depth === 0 ? colors.text : colors.text, fontWeight: row.depth === 0 ? 600 : 400 }}>
                                  {row.name}
                                </span>
                              </div>
                            </Cell>
                            <Cell>{row.directMemberCount ?? row.linkedDirectMemberCount ?? 0}</Cell>
                            <Cell>{row.employeeCount ?? row.linkedEmployeeCount ?? 0}</Cell>
                            <Cell>{row.orgType}</Cell>
                            <Cell>{shortPerson(row.leader || '')}</Cell>
                            <Cell>{shortPerson(row.approvalManager || '')}</Cell>
                            <Cell>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
                                <TextButton onClick={() => openDetail(row)}>详情</TextButton>
                                <TextButton onClick={() => openEdit(row)}>修改</TextButton>
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); setRowMenuCode(code => code === row.code ? '' : row.code); }}
                                  style={plainIconButton(colors.primary)}
                                >
                                  <MoreHorizontal size={17} />
                                </button>
                                {rowMenuCode === row.code ? (
                                    <DropMenu right={0} top={24}>
                                      <DropItem label="新增组织" onClick={() => openAdd(row)} />
                                    <DropItem label={row.status && row.status.includes('停用') ? '启用' : '停用'} onClick={() => disableOrg(row)} />
                                      <DropItem label="删除" onClick={() => deleteOrg(row)} />
                                      <DropItem label="调整排序" onClick={() => setNotice(`${row.name} 可进行排序调整`)} />
                                    </DropMenu>
                                ) : null}
                              </div>
                            </Cell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!visibleRows.length ? <div style={{ padding: 32, textAlign: 'center', color: colors.textMuted }}>暂无组织数据</div> : null}
                </div>
              )}
          </div>
          ) : pageMode === 'changeRecords' ? (
            <ChangeRecordsPage records={changeRecords} onBack={goBackToOrganizations} onDetail={(record) => { setActiveChange(record); setModalMode('changeDetail'); }} />
          ) : pageMode === 'snapshots' ? (
            <SnapshotsPage snapshots={snapshots} onBack={goBackToOrganizations} onCreate={createSnapshot} onDelete={(id) => setSnapshots(current => current.filter(item => item.id !== id))} />
          ) : pageMode === 'disabledOrgs' ? (
            <DisabledOrganizationsPage rows={disabledOrganizations} onBack={goBackToOrganizations} />
          ) : pageMode === 'settings' ? (
            <OrganizationSettingsPage fields={fieldSettings} onBack={goBackToOrganizations} onAdd={() => openFieldDrawer()} onEdit={(field) => field.id === 'orgType' ? setPageMode('orgTypes') : openFieldDrawer(field)} onToggle={(id, key) => setFieldSettings(current => current.map(item => item.id === id ? { ...item, [key]: !item[key] } : item))} />
          ) : pageMode === 'architecture' ? (
            <ArchitecturePage rows={rows} loading={loading} error={error} onDownload={() => downloadTextFile('组织架构图数据.csv', toOrgCsv(rows))} onNotice={setNotice} onSort={() => openSubPage('architectureSort')} onOpenLevelModal={(mode) => setModalMode(mode)} />
          ) : pageMode === 'architectureSort' ? (
            <ArchitectureSortPage rows={rows} loading={loading} error={error} onBack={() => openSubPage('architecture')} onSave={() => { setNotice('架构图排序已保存到当前会话'); openSubPage('architecture'); }} />
          ) : pageMode === 'positions' ? (
            <PositionManagementPage rows={positionRows} loading={positionsLoading} error={positionsError} onReload={loadPositions} onCreate={() => openPositionEditor()} onImport={() => openSubPage('positionImport')} onEdit={openPositionEditor} onDisable={disablePosition} onDelete={openPositionDelete} onBulkDisable={bulkDisablePositions} onBulkDelete={bulkDeletePositions} onNotice={setNotice} />
          ) : pageMode === 'positionImport' ? (
            <PositionImportPage rows={positionRows} onBack={() => openSubPage('positions')} onImportRows={importPositions} onDone={(message) => { setNotice(message); openSubPage('positions'); loadPositions(); }} />
          ) : pageMode === 'ranks' ? (
            <RankManagementPage rows={rankRows} loading={ranksLoading} error={ranksError} onReload={loadRanks} onCreate={() => openRankEditor()} onImportRows={importRanks} onEdit={openRankEditor} onDisable={disableRank} onDelete={openRankDelete} onNotice={setNotice} />
          ) : pageMode === 'jobTitles' ? (
            <JobTitleManagementPage />
          ) : pageMode === 'staffing' ? (
            <StaffingManagementPage orgRows={rows} positionRows={positionRows} onApply={() => setModalMode('staffingApply')} onContact={() => setModalMode('servicePanel')} />
          ) : pageMode === 'orgTypes' ? (
            <OrganizationTypesPage types={orgTypes} onBack={() => setPageMode('settings')} onAdd={() => openOrgTypeEditor()} onReorder={() => setModalMode('orgTypeSort')} onEdit={openOrgTypeEditor} onToggle={(id) => setOrgTypes(current => current.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item))} onDelete={openOrgTypeDelete} />
          ) : (
            <OrganizationTypesPage types={orgTypes} onBack={() => setPageMode('settings')} onAdd={() => openOrgTypeEditor()} onReorder={() => setModalMode('orgTypeSort')} onEdit={openOrgTypeEditor} onToggle={(id) => setOrgTypes(current => current.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item))} onDelete={openOrgTypeDelete} />
          )}
        </div>
      </section>

      {modalMode === 'add' || modalMode === 'edit' ? (
        <OrgEditModal
          title={modalMode === 'add' ? '新增组织' : '编辑组织'}
          form={form}
          rows={rows}
          onChange={updateForm}
          onClose={() => setModalMode(null)}
          onSave={saveForm}
        />
      ) : null}

      {modalMode === 'detail' && activeOrg ? (
        <OrgDetailModal
          org={activeOrg}
          childCount={descendantCount(activeOrg)}
          parentName={rowsByCode.get(activeOrg.parentCode || '')?.name || '-'}
          onClose={() => setModalMode(null)}
          onEdit={() => openEdit(activeOrg)}
        />
      ) : null}

      {modalMode === 'importOrg' ? <ImportOrganizationModal onImportRows={importOrganizations} onClose={() => setModalMode(null)} onDone={(message) => { setModalMode(null); setNotice(message); }} /> : null}
      {modalMode === 'exportOrg' ? (
        <OrganizationSelectModal
          rows={rows}
          selectedCodes={exportSelectedCodes}
          onChange={setExportSelectedCodes}
          onClose={() => setModalMode(null)}
          onConfirm={async () => {
            const exportRows = exportSelectedCodes.length ? rows.filter(row => exportSelectedCodes.includes(row.code)) : rows;
            const ok = await downloadAttendanceXlsx({
              fileName: `组织架构-${exportSelectedCodes.length ? '选中记录' : '全部组织'}.xlsx`,
              sheetName: '组织架构',
              headers: ORG_EXPORT_HEADERS,
              rows: toOrgExportRows(exportRows),
              emptyMessage: '暂无可导出的组织数据',
              saveAs: true,
            });
            if (ok) {
              setSelectedCodes(exportSelectedCodes);
              setModalMode(null);
              setNotice(exportSelectedCodes.length ? `已导出选中组织 ${exportRows.length} 条` : `已导出全部组织 ${exportRows.length} 条`);
            }
          }}
        />
      ) : null}
      {modalMode === 'batchEdit' ? <BatchEditImportModal rows={rows} onImportRows={importOrganizations} onClose={() => setModalMode(null)} onDone={(message) => { setModalMode(null); setNotice(message); }} /> : null}
      {modalMode === 'changeDetail' && activeChange ? <ChangeDetailModal record={activeChange} onClose={() => setModalMode(null)} /> : null}
      {modalMode === 'fieldDrawer' ? <FieldDrawer title={fieldDrawerTitle} field={fieldDraft} onChange={(field) => setFieldDraft(field)} onClose={() => setModalMode(null)} onSave={saveFieldDraft} /> : null}
      {modalMode === 'orgTypeEdit' && orgTypeDraft ? <OrganizationTypeEditModal type={orgTypeDraft} onChange={setOrgTypeDraft} onClose={() => setModalMode(null)} onSave={saveOrgTypeDraft} /> : null}
      {modalMode === 'orgTypeDelete' && orgTypeDeleteTarget ? <OrganizationTypeDeleteConfirm type={orgTypeDeleteTarget} onClose={() => setModalMode(null)} onConfirm={confirmOrgTypeDelete} /> : null}
      {modalMode === 'orgTypeSort' ? <OrganizationTypeSortModal types={orgTypes} onClose={() => setModalMode(null)} onMove={(from, to) => setOrgTypes(current => moveItem(current, from, to))} onSave={() => { setModalMode(null); setNotice('组织类型排序已保存'); }} /> : null}
      {modalMode === 'positionEdit' ? <PositionEditModal draft={positionDraft} positions={positionRows} orgRows={rows} onChange={setPositionDraft} onClose={() => setModalMode(null)} onSave={savePositionDraft} /> : null}
      {modalMode === 'positionDelete' && positionDeleteTarget ? <PositionDeleteConfirm position={positionDeleteTarget} onClose={() => setModalMode(null)} onConfirm={confirmPositionDelete} /> : null}
      {modalMode === 'rankEdit' ? <RankEditModal draft={rankDraft} ranks={rankRows} onChange={setRankDraft} onClose={() => setModalMode(null)} onSave={saveRankDraft} /> : null}
      {modalMode === 'rankDelete' && rankDeleteTarget ? <RankDeleteConfirm rank={rankDeleteTarget} onClose={() => setModalMode(null)} onConfirm={confirmRankDelete} /> : null}
      {modalMode === 'servicePanel' ? <ServicePanel onClose={() => setModalMode(null)} /> : null}
      {modalMode === 'staffingApply' ? <StaffingApplyModal orgCount={rows.length} positionCount={positionRows.length} onClose={() => setModalMode(null)} onConfirm={() => { setModalMode(null); setNotice('编制管理开通申请已提交，当前组织与岗位数据将作为初始化范围'); }} /> : null}
      {modalMode === 'expandLevel' ? <LevelControlModal title="展开指定层级" actionText="展开" onClose={() => setModalMode(null)} onConfirm={(level) => { setModalMode(null); setNotice(`已展开到第 ${level} 层级，架构图根据当前真实组织层级刷新`); }} /> : null}
      {modalMode === 'collapseLevel' ? <LevelControlModal title="折叠指定层级" actionText="折叠" onClose={() => setModalMode(null)} onConfirm={(level) => { setModalMode(null); setNotice(`已折叠第 ${level} 层级以下组织，架构图可继续切换显示范围`); }} /> : null}
    </div>
  );
}

function SideGroup({ active, icon, label = '组织', onClick }: { active?: boolean; icon?: React.ReactNode; label?: string; onClick?: () => void }) {
  const { colors } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 40, padding: '0 12px', border: 'none', background: 'transparent', color: active ? colors.sidebarActiveText : colors.sidebarText, display: 'flex', alignItems: 'center', gap: 8, cursor: onClick ? 'pointer' : 'default', fontSize: 13 }}>
      {icon || <ListTree size={17} />}
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {active ? <ChevronDown size={13} /> : null}
    </button>
  );
}

function SideItem({ active, label, onClick }: { active?: boolean; label: string; onClick?: () => void }) {
  const { colors } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ width: 'calc(100% - 8px)', height: 36, margin: '0 4px 2px', padding: '0 0 0 28px', border: 'none', borderRadius: 4, background: active ? colors.sidebarActiveBg : 'transparent', color: active ? colors.sidebarActiveText : colors.sidebarText, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
      {label}
    </button>
  );
}

function Button({
  children,
  primary,
  exportButton,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  exportButton?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { colors } = useTheme();
  const isPrimary = Boolean(primary || exportButton);
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ height: 32, padding: exportButton ? '0 10px' : '0 14px', borderRadius: 4, border: isPrimary ? 'none' : `1px solid ${colors.inputBorder}`, background: disabled ? colors.inputBorder : isPrimary ? colors.primary : colors.inputBg, color: disabled ? colors.textMuted : isPrimary ? colors.primaryText : colors.text, fontSize: exportButton ? 13 : 13, fontWeight: exportButton ? 600 : 400, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.72 : 1 }}>
      {children}
    </button>
  );
}

function TextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const { colors } = useTheme();
  return <button type="button" onClick={onClick} style={{ border: 'none', background: 'transparent', color: colors.primary, fontSize: 13, padding: 0, cursor: 'pointer' }}>{children}</button>;
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input value={value} onChange={event => onChange(event.target.value)} placeholder="搜索组织、姓名" style={{ width: 170, height: 32, border: `1px solid ${colors.inputBorder}`, borderRight: 'none', borderRadius: '4px 0 0 4px', outline: 'none', padding: '0 10px', fontSize: 13, color: colors.inputText, background: colors.inputBg }} />
      <button type="button" style={{ width: 34, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: '0 4px 4px 0', background: colors.inputBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Search size={15} color={colors.textMuted} />
      </button>
    </div>
  );
}

function SegmentedIcon({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  const { colors } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ width: 32, height: 32, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: active ? colors.tagActiveBg : colors.inputBg, color: active ? colors.tagActiveText : colors.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}

function Header({ children, width }: { children?: React.ReactNode; width: number }) {
  const { colors } = useTheme();
  return <th style={{ width, minHeight: 38, padding: '8px 12px', textAlign: 'left', color: colors.text, fontSize: 13, fontWeight: 600, borderRight: `1px solid ${colors.tableBorder}`, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35, verticalAlign: 'middle' }}>{children}</th>;
}

function StickyHeader({ children, width }: { children?: React.ReactNode; width: number }) {
  const { colors } = useTheme();
  return <th style={{ width, minHeight: 38, padding: '8px 12px', textAlign: 'left', color: colors.text, fontSize: 13, fontWeight: 600, borderLeft: `1px solid ${colors.tableBorder}`, position: 'sticky', right: 0, zIndex: 4, background: colors.tableHeaderBg, boxShadow: '-8px 0 14px rgba(31,43,69,0.08)', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35, verticalAlign: 'middle' }}>{children}</th>;
}

function Cell({ children, center, wrap }: { children?: React.ReactNode; center?: boolean; wrap?: boolean }) {
  const { colors } = useTheme();
  return (
    <td
      style={{
        padding: wrap ? '8px 12px' : '0 12px',
        color: colors.text,
        fontSize: 13,
        borderRight: `1px solid ${colors.tableBorder}`,
        textAlign: center ? 'center' : 'left',
        whiteSpace: wrap ? 'normal' : 'nowrap',
        overflow: wrap ? 'hidden' : 'visible',
        overflowWrap: wrap ? 'anywhere' : undefined,
        wordBreak: wrap ? 'break-word' : undefined,
        lineHeight: wrap ? 1.55 : undefined,
        verticalAlign: wrap ? 'top' : 'middle',
      }}
    >
      {children}
    </td>
  );
}

function StickyActionCell({ children }: { children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <td style={{ width: 170, padding: '0 12px', color: colors.text, fontSize: 13, borderLeft: `1px solid ${colors.tableBorder}`, background: colors.cardBg, position: 'sticky', right: 0, zIndex: 3, boxShadow: '-8px 0 14px rgba(31,43,69,0.08)', whiteSpace: 'nowrap' }}>
      {children}
    </td>
  );
}

function DropMenu({ children, top, left, right }: { children: React.ReactNode; top: number; left?: number; right?: number }) {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'absolute', top, left, right, zIndex: 500, width: 118, padding: '8px 0', borderRadius: 5, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, boxShadow: '0 12px 28px rgba(31, 43, 69, 0.16)' }}>
      {children}
    </div>
  );
}

function DropItem({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  const { colors } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 34, padding: '0 14px', border: 'none', background: 'transparent', color: colors.text, fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      {icon}{label}
    </button>
  );
}

function OrgCards({ rows }: { rows: OrganizationRecord[] }) {
  const { colors } = useTheme();
  return (
    <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: 12, overflow: 'auto' }}>
      {rows.slice(0, 40).map(row => (
        <div key={row.code} style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: 14, background: colors.cardBg }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 8 }}>{row.name}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.8 }}>{row.fullPath}</div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', color: colors.text, fontSize: 12 }}>
            <span>{row.orgType}</span>
            <span>{row.employeeCount}人</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FloatingTip({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'absolute', left: '50%', top: 38, transform: 'translateX(-50%)', zIndex: 20, padding: '6px 9px', borderRadius: 4, background: colors.text, color: colors.cardBg, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(27,38,62,0.22)' }}>
      {children}
    </div>
  );
}

function RadioCard({ checked, title, desc, onClick }: { checked: boolean; title: string; desc: string; onClick: () => void }) {
  const { colors } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', color: colors.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <span style={{ width: 13, height: 13, borderRadius: '50%', border: `1px solid ${checked ? colors.primary : colors.inputBorder}`, marginTop: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {checked ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.primary }} /> : null}
        </span>
        <span>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 3 }}>{title}</span>
          <span style={{ display: 'block', color: colors.textMuted, fontSize: 11 }}>{desc}</span>
        </span>
      </div>
    </button>
  );
}

function ImportOrganizationModal({ onImportRows, onClose, onDone }: { onImportRows: (rows: Partial<OrganizationRecord>[]) => Promise<number>; onClose: () => void; onDone: (message: string) => void }) {
  const { colors } = useTheme();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'full' | 'normal'>('full');
  const [importing, setImporting] = useState(false);
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsedRows = await parseOrganizationWorkbook(file, mode);
      if (!parsedRows.length) {
        onDone(`${file.name} 未识别到可导入的组织数据`);
        return;
      }
      const saved = await onImportRows(parsedRows);
      onDone(`已导入 ${saved} 条组织数据，组织、员工、考勤、薪酬关联口径已刷新。`);
    } catch (err: any) {
      onDone(`组织导入失败：${String(err?.message || err)}`);
    } finally {
      setImporting(false);
    }
  };
  return (
    <ModalShell title="导入组织" width={596} onClose={onClose}>
      <div style={{ padding: '24px 28px 42px', minHeight: 260, color: colors.text, fontSize: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, margin: '0 auto 24px', maxWidth: 360 }}>
          <RadioCard checked={mode === 'full'} title="全路径导入" desc="通过组织全路径识别组织层级" onClick={() => setMode('full')} />
          <RadioCard checked={mode === 'normal'} title="普通导入" desc="通过上级组织编码识别组织层级" onClick={() => setMode('normal')} />
        </div>
        <div style={{ height: 1, background: colors.tableBorder, marginBottom: 24 }} />
        <div style={{ textAlign: 'center', lineHeight: 2 }}>
          <span>请使用系统提供的模板，编辑完成后导入</span>
          <button type="button" onClick={() => downloadTextFile('组织导入模板.csv', '组织名称,组织类型,上级组织编码,组织负责人,审批主管,机构号,备注\n')} style={linkButton(colors)}>
            <Download size={13} />下载模板
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} style={{ display: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <Button primary onClick={() => fileRef.current?.click()}>{importing ? '导入中...' : '选择文件导入'}</Button>
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>文件不能超过5M，支持Excel2003以上版本</div>
      </div>
    </ModalShell>
  );
}

function BatchEditImportModal({ rows, onImportRows, onClose, onDone }: { rows: OrganizationRecord[]; onImportRows: (rows: Partial<OrganizationRecord>[]) => Promise<number>; onClose: () => void; onDone: (message: string) => void }) {
  const { colors } = useTheme();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showHelp, setShowHelp] = useState(true);
  const [importing, setImporting] = useState(false);
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsedRows = await parseOrganizationWorkbook(file, 'normal');
      if (!parsedRows.length) {
        onDone(`${file.name} 未识别到可修改的组织数据`);
        return;
      }
      const saved = await onImportRows(parsedRows);
      onDone(`已批量修改 ${saved} 条组织数据，组织、员工、考勤、薪酬关联口径已刷新。`);
    } catch (err: any) {
      onDone(`批量修改导入失败：${String(err?.message || err)}`);
    } finally {
      setImporting(false);
    }
  };
  return (
    <ModalShell title="导入修改" width={596} onClose={onClose}>
      <div style={{ padding: '46px 28px 26px', minHeight: 300, color: colors.text, fontSize: 13 }}>
        <div style={{ textAlign: 'center', lineHeight: 2 }}>
          导出后，在表格中批量修改并保存，完成后点击下方再次导入
          <button type="button" onClick={() => downloadTextFile('组织批量修改模板.csv', toOrgCsv(rows))} style={linkButton(colors)}>
            <Download size={13} />导出
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} style={{ display: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <Button primary onClick={() => fileRef.current?.click()}>{importing ? '导入中...' : '选择文件导入'}</Button>
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>文件不能超过5M，支持Excel2003以上版本</div>
        {showHelp ? (
          <div style={{ marginTop: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '10px 36px 10px 12px', color: colors.textMuted, lineHeight: 1.7, position: 'relative', background: colors.statCardBg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.text, marginBottom: 4 }}>
              <AlertCircle size={14} color={colors.primary} />批量修改说明
            </div>
            <div>1. 操作流程：点击【导出】将已有组织架构数据导出来，打开导出的数据表，修改需要更新的数据并保存；然后点击【上传文件】将修改后的数据重新导入系统，已修改的数据会自动更新；</div>
            <div>2. 导出组织架构信息到批量修改完成期间，请勿使用其他方式修改组织架构；</div>
            <div>3. 新的组织架构信息必须在本页面的批量修改上传文件导入，避免导入失败。</div>
            <button type="button" onClick={() => setShowHelp(false)} style={{ ...plainIconButton(colors.textMuted), position: 'absolute', right: 8, top: 8 }}><X size={15} /></button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

async function parseOrganizationWorkbook(file: File, mode: 'full' | 'normal'): Promise<Partial<OrganizationRecord>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find(name => name.includes('组织')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(sheet, { defval: '', raw: false, header: 1 });
  const headerIndex = Math.max(0, matrix.findIndex(row => row.some(cell => String(cell).includes('组织名称'))));
  const headers = (matrix[headerIndex] || []).map(cell => String(cell || '').trim());
  return matrix.slice(headerIndex + 1).map(row => {
    const code = workbookCell(headers, row, ['组织编码', '编码']);
    const name = workbookCell(headers, row, ['组织名称', '名称']);
    const parentCode = workbookCell(headers, row, ['上级组织编码', '上级编码']);
    const fullPathFromFile = workbookCell(headers, row, ['组织全路径', '全路径', '部门全路径']);
    if (!name && !code && !fullPathFromFile) return null;
    const finalName = name || fullPathFromFile.split('/').filter(Boolean).pop() || '';
    const fullPath = mode === 'full'
      ? (fullPathFromFile || `上海拉迷家具有限公司/${finalName}`)
      : (fullPathFromFile || (parentCode ? finalName : `上海拉迷家具有限公司/${finalName}`));
    return {
      code,
      name: finalName,
      fullPath,
      parentCode,
      orgType: workbookCell(headers, row, ['组织类型', '类型']) || '部门',
      leader: workbookCell(headers, row, ['组织负责人', '负责人']),
      approvalManager: workbookCell(headers, row, ['审批主管']),
      institutionNo: workbookCell(headers, row, ['机构号']),
      effectiveDate: workbookCell(headers, row, ['生效日期']) || today(),
      remark: workbookCell(headers, row, ['备注']),
      status: workbookCell(headers, row, ['状态']) || '生效中',
    } as Partial<OrganizationRecord>;
  }).filter((row): row is Partial<OrganizationRecord> => Boolean(row?.name));
}

function OrganizationSelectModal({ rows, selectedCodes, onChange, onClose, onConfirm }: { rows: OrganizationRecord[]; selectedCodes: string[]; onChange: (codes: string[]) => void; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [showChildren, setShowChildren] = useState(true);
  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const root = rows.find(row => !row.parentCode) || rows[0];
  const treeRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const base = showChildren ? rows : rows.filter(row => row.code === root?.code);
    return base.filter(row => !keyword || `${row.name} ${row.code} ${row.fullPath}`.toLowerCase().includes(keyword));
  }, [root?.code, rows, search, showChildren]);
  const toggleCode = (code: string) => {
    const next = new Set(selectedSet);
    next.has(code) ? next.delete(code) : next.add(code);
    onChange([...next]);
  };
  const toggleAll = () => {
    if (selectedCodes.length === rows.length) {
      onChange([]);
      return;
    }
    onChange(rows.map(row => row.code));
  };
  return (
    <ModalShell title="选择组织" width={596} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button exportButton onClick={onConfirm}><Download size={14} />导出Excel</Button></>}>
      <div style={{ height: 404, display: 'grid', gridTemplateColumns: '1fr 1fr', color: colors.text, fontSize: 13 }}>
        <div style={{ padding: 14, borderRight: `1px solid ${colors.tableBorder}` }}>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={14} color={colors.textMuted} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索组织名" style={{ ...formInput(colors), height: 30, paddingLeft: 30 }} />
          </div>
          <div style={{ margin: '8px 0', display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, background: colors.statCardBg, color: colors.textMuted, fontSize: 12 }}>组织架构</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28 }}>
            <input type="checkbox" checked={selectedCodes.length === rows.length && rows.length > 0} onChange={toggleAll} />全选
          </label>
          <div style={{ overflow: 'auto', maxHeight: 295 }}>
            {treeRows.map(row => (
              <div key={row.code} style={{ height: 30, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: Math.min((row.depth || 0) * 18, 72) }}>
                <input type="checkbox" checked={selectedSet.has(row.code)} onChange={() => toggleCode(row.code)} />
                <span style={{ color: colors.primary, lineHeight: 0 }}><Building2 size={15} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                {row.code === root?.code ? <button type="button" onClick={() => setShowChildren(open => !open)} style={linkButton(colors)}>{showChildren ? '收起' : '下级'}</button> : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>已选：{selectedCodes.length}个组织</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.filter(row => selectedSet.has(row.code)).slice(0, 12).map(row => (
              <div key={row.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 4, background: colors.statCardBg }}>
                <span>{row.name}</span>
                <button type="button" onClick={() => toggleCode(row.code)} style={plainIconButton(colors.textMuted)}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function Breadcrumb({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 10, color: colors.textMuted, fontSize: 12 }}>
      <button type="button" onClick={onBack} style={linkButton(colors)}>‹ 返回</button>
      <span style={{ width: 1, height: 12, background: colors.tableBorder }} />
      <span style={{ color: colors.text }}>{title}</span>
    </div>
  );
}

function PageShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Breadcrumb title={title} onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function MiniPager({ total, page = 1, pageSize = 20 }: { total: number; page?: number; pageSize?: number }) {
  const { colors } = useTheme();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div style={{ height: 38, display: 'flex', alignItems: 'center', color: colors.textMuted, fontSize: 12, flexShrink: 0 }}>
      <span>总计 {total} 条</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>‹</span>
        <span style={{ minWidth: 24, height: 24, border: `1px solid ${colors.primary}`, borderRadius: 5, color: colors.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{page}</span>
        {pageCount > 1 ? <span>2</span> : null}
        {pageCount > 2 ? <span>3</span> : null}
        {pageCount > 4 ? <span>...</span> : null}
        {pageCount > 3 ? <span>{pageCount}</span> : null}
        <span>›</span>
        <select style={{ height: 28, border: `1px solid ${colors.inputBorder}`, borderRadius: 5, background: colors.inputBg, color: colors.text }}>
          <option>{pageSize} 条/页</option>
        </select>
      </div>
    </div>
  );
}

function ChangeRecordsPage({ records, onBack, onDetail }: { records: ChangeRecord[]; onBack: () => void; onDetail: (record: ChangeRecord) => void }) {
  const { colors } = useTheme();
  const [filters, setFilters] = useState({ orgName: '', orgCode: '', changeType: '', operator: '', effectiveDate: '' });
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => records.filter(record => {
    if (filters.orgName && !record.orgName.includes(filters.orgName)) return false;
    if (filters.orgCode && !record.orgCode.includes(filters.orgCode)) return false;
    if (filters.changeType && record.changeType !== filters.changeType) return false;
    if (filters.operator && !record.operator.includes(filters.operator)) return false;
    if (filters.effectiveDate && record.effectiveDate !== filters.effectiveDate) return false;
    return true;
  }), [filters, records]);
  const pageRows = filtered.slice((page - 1) * 20, page * 20);
  const setValue = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters(current => ({ ...current, [key]: value }));
  };
  return (
    <PageShell title="变更记录列表" onBack={onBack}>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 220px 70px 220px 70px 220px 70px 220px 70px 220px auto', gap: 10, alignItems: 'center', marginBottom: 12, fontSize: 13, color: colors.text }}>
        <span style={{ textAlign: 'right' }}>组织名称</span><input value={filters.orgName} onChange={event => setValue('orgName', event.target.value)} placeholder="请输入组织名称" style={filterInput(colors)} />
        <span style={{ textAlign: 'right' }}>组织编码</span><input value={filters.orgCode} onChange={event => setValue('orgCode', event.target.value)} placeholder="请输入组织编码" style={filterInput(colors)} />
        <span style={{ textAlign: 'right' }}>变更类型</span><select value={filters.changeType} onChange={event => setValue('changeType', event.target.value)} style={filterInput(colors)}><option value="">请选择</option><option>新增</option><option>修改</option><option>停用</option></select>
        <span style={{ textAlign: 'right' }}>操作人</span><input value={filters.operator} onChange={event => setValue('operator', event.target.value)} placeholder="请输入操作人" style={filterInput(colors)} />
        <span style={{ textAlign: 'right' }}>生效日期</span><input type="date" value={filters.effectiveDate} onChange={event => setValue('effectiveDate', event.target.value)} style={filterInput(colors)} />
        <div style={{ display: 'flex', gap: 8 }}><Button onClick={() => setFilters({ orgName: '', orgCode: '', changeType: '', operator: '', effectiveDate: '' })}>重置</Button><Button primary onClick={() => setPage(1)}>查询</Button></div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${colors.tableBorder}` }}>
        <table style={{ width: '100%', minWidth: 1320, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr style={{ background: colors.tableHeaderBg }}><Header width={170}>组织名称</Header><Header width={130}>组织编码</Header><Header width={120}>变更类型</Header><Header width={120}>生效状态</Header><Header width={150}>生效日期</Header><Header width={190}>操作时间</Header><Header width={190}>操作人</Header><Header width={140}>操作</Header></tr></thead>
          <tbody>
            {pageRows.map(record => (
              <tr key={record.id} style={{ height: 40, borderTop: `1px solid ${colors.tableBorder}` }}>
                <Cell>{record.orgName}</Cell><Cell>{record.orgCode}</Cell><Cell>{record.changeType}</Cell>
                <Cell><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.badgeGreenText }} />{record.effectiveStatus}</span></Cell>
                <Cell>{record.effectiveDate}</Cell><Cell>{record.actionTime}</Cell><Cell>{record.operator}</Cell><Cell><TextButton onClick={() => onDetail(record)}>变更详情</TextButton></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MiniPager total={filtered.length} page={page} />
    </PageShell>
  );
}

function SnapshotsPage({ snapshots, onBack, onCreate, onDelete }: { snapshots: SnapshotRecord[]; onBack: () => void; onCreate: () => void; onDelete: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <PageShell title="组织快照" onBack={onBack}>
      <div style={{ marginBottom: 12 }}><Button primary onClick={onCreate}>创建组织快照</Button></div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${colors.tableBorder}`, position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr style={{ background: colors.tableHeaderBg }}><Header width={220}>快照名称</Header><Header width={420}>说明</Header><Header width={180}>创建人</Header><Header width={200}>创建时间</Header><Header width={160}>状态</Header><Header width={160}>操作</Header></tr></thead>
          <tbody>
            {snapshots.map(snapshot => (
              <tr key={snapshot.id} style={{ height: 40, borderTop: `1px solid ${colors.tableBorder}` }}>
                <Cell>{snapshot.name}</Cell><Cell>{snapshot.desc}</Cell><Cell>{snapshot.creator}</Cell><Cell>{snapshot.createdAt}</Cell><Cell>{snapshot.status}</Cell><Cell><TextButton onClick={() => onDelete(snapshot.id)}>删除</TextButton></Cell>
              </tr>
            ))}
          </tbody>
        </table>
        {!snapshots.length ? <EmptyState /> : null}
      </div>
    </PageShell>
  );
}

function DisabledOrganizationsPage({ rows, onBack }: { rows: OrganizationRecord[]; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <PageShell title="停用组织列表" onBack={onBack}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${colors.tableBorder}`, position: 'relative' }}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr style={{ background: colors.tableHeaderBg }}><Header width={260}>组织名称</Header><Header width={160}>组织编码</Header><Header width={160}>组织类型</Header><Header width={180}>组织负责人</Header><Header width={180}>审批主管</Header><Header width={160}>状态</Header></tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.code} style={{ height: 40, borderTop: `1px solid ${colors.tableBorder}` }}><Cell>{row.name}</Cell><Cell>{row.code}</Cell><Cell>{row.orgType}</Cell><Cell>{shortPerson(row.leader || '')}</Cell><Cell>{shortPerson(row.approvalManager || '')}</Cell><Cell>{row.status}</Cell></tr>)}
          </tbody>
        </table>
        {!rows.length ? <EmptyState /> : null}
      </div>
    </PageShell>
  );
}

function OrganizationTypesPage({ types, onBack, onAdd, onReorder, onEdit, onToggle, onDelete }: { types: OrganizationTypeRow[]; onBack: () => void; onAdd: () => void; onReorder: () => void; onEdit: (type: OrganizationTypeRow) => void; onToggle: (id: string) => void; onDelete: (type: OrganizationTypeRow) => void }) {
  const { colors } = useTheme();
  return (
    <PageShell title="组织类型管理" onBack={onBack}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}><Button primary onClick={onAdd}>新增组织类型</Button><Button onClick={onReorder}>调整排序</Button></div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${colors.tableBorder}` }}>
        <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr style={{ background: colors.tableHeaderBg }}><Header width={160}>组织类型</Header><Header width={160}>编码</Header><Header width={120}>启用状态</Header><Header width={620}>说明</Header><Header width={180}>操作</Header></tr></thead>
          <tbody>
            {types.map(type => (
              <tr key={type.id} style={{ height: 48, borderTop: `1px solid ${colors.tableBorder}` }}>
                <Cell>{type.name}</Cell><Cell>{type.code}</Cell><Cell><Switch checked={type.enabled} onChange={() => onToggle(type.id)} /></Cell><Cell>{type.desc}</Cell>
                <Cell><div style={{ display: 'flex', gap: 18 }}>{type.system ? <span style={{ color: colors.textMuted }}>编辑</span> : <TextButton onClick={() => onEdit(type)}>编辑</TextButton>}{type.system ? <span style={{ color: colors.textMuted }}>删除</span> : <TextButton onClick={() => onDelete(type)}>删除</TextButton>}</div></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MiniPager total={types.length} />
    </PageShell>
  );
}

function RankManagementPage({ rows, loading, error, onReload, onCreate, onImportRows, onEdit, onDisable, onDelete, onNotice }: { rows: OrganizationRankRecord[]; loading: boolean; error: string; onReload: () => void; onCreate: () => void; onImportRows: (rows: Partial<OrganizationRankRecord>[]) => Promise<number>; onEdit: (row: OrganizationRankRecord) => void; onDisable: (row: OrganizationRankRecord) => void; onDelete: (row: OrganizationRankRecord) => void; onNotice: (message: string) => void }) {
  const { colors } = useTheme();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [filters, setFilters] = useState({ code: '', name: '', statuses: ['已启用'] as string[], companies: [] as string[], grade: '', desc: '', minPeople: '', maxPeople: '', blankCode: false, blankName: false, blankGrade: false });
  const [selected, setSelected] = useState<number[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'code' | 'name' | 'status' | 'grade' | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [sequenceQuery, setSequenceQuery] = useState('');
  const [activeSequence, setActiveSequence] = useState('全部');
  const [importing, setImporting] = useState(false);
  const codeTokens = useMemo(() => filters.code.split(/[;；,\s]+/).map(item => item.trim()).filter(Boolean), [filters.code]);
  const nameTokens = useMemo(() => filters.name.split(/[;；,\s]+/).map(item => item.trim()).filter(Boolean), [filters.name]);
  const statusOptions = useMemo(() => uniqueValues(rows.map(row => row.status || '已启用'), ['已启用', '已停用']), [rows]);
  const companyOptions = useMemo(() => uniqueValues(rows.flatMap(row => splitValueList(row.company)), ['上海拉迷家具有限公司']), [rows]);
  const gradeOptions = useMemo(() => uniqueValues(rows.map(row => row.grade || '未填写'), ['未填写']), [rows]);
  const sequenceOptions = useMemo(() => uniqueValues(rows.map(row => sequenceBucket(row.sequence)), ['全部', '专业通道', '管理通道', '未填写']), [rows]);
  const filtered = useMemo(() => rows.filter(row => {
    const sequence = sequenceBucket(row.sequence);
    const grade = row.grade || '未填写';
    const count = Number(row.employeeCount ?? row.linkedEmployeeCount ?? 0);
    if (filters.blankCode && row.code) return false;
    if (filters.blankName && row.name) return false;
    if (filters.blankGrade && row.grade) return false;
    if (codeTokens.length && !codeTokens.some(token => row.code.includes(token))) return false;
    if (nameTokens.length && !nameTokens.some(token => row.name.includes(token))) return false;
    if (filters.statuses.length && !filters.statuses.includes(row.status || '已启用')) return false;
    if (filters.companies.length) {
      const companies = splitValueList(row.company);
      if (!companies.some(company => filters.companies.includes(company))) return false;
    }
    if (filters.grade && grade !== filters.grade) return false;
    if (filters.desc && !String(row.desc || '').includes(filters.desc)) return false;
    if (filters.minPeople && count < Number(filters.minPeople)) return false;
    if (filters.maxPeople && count > Number(filters.maxPeople)) return false;
    if (activeSequence !== '全部' && sequence !== activeSequence) return false;
    return true;
  }), [activeSequence, codeTokens, filters, nameTokens, rows]);
  const pageRows = filtered.slice(0, 20);
  const sequenceList = sequenceOptions.filter(item => !sequenceQuery.trim() || item.includes(sequenceQuery.trim()));
  const toggleSelected = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleCurrentPage = (checked: boolean) => {
    const pageIds = pageRows.map(row => row.id);
    setSelected(current => checked ? uniqueNumberValues([...current, ...pageIds]) : current.filter(id => !pageIds.includes(id)));
  };
  const toggleFilterList = (value: string) => {
    setFilters(current => ({ ...current, statuses: current.statuses.includes(value) ? current.statuses.filter(item => item !== value) : [...current.statuses, value] }));
  };
  const reset = () => {
    setFilters({ code: '', name: '', statuses: ['已启用'], companies: [], grade: '', desc: '', minPeople: '', maxPeople: '', blankCode: false, blankName: false, blankGrade: false });
    setActiveSequence('全部');
  };
  const setValue = (key: keyof typeof filters, value: string | boolean | string[]) => setFilters(current => ({ ...current, [key]: value }));
  const handleRankImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsedRows = await parseRankWorkbook(file);
      if (!parsedRows.length) {
        onNotice(`${file.name} 未识别到可导入的职级数据`);
        return;
      }
      const saved = await onImportRows(parsedRows);
      onNotice(`已导入 ${saved} 条职级数据，岗位、员工、薪酬职级口径已刷新`);
    } catch (err: any) {
      onNotice(`职级导入失败：${String(err?.message || err)}`);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };
  const handleRankExport = async () => {
    const exportRows = selected.length ? filtered.filter(row => selected.includes(row.id)) : filtered;
    const ok = await downloadAttendanceXlsx({
      fileName: `职级管理-${selected.length ? '选中记录' : '筛选结果'}.xlsx`,
      sheetName: '职级管理',
      headers: RANK_EXPORT_HEADERS,
      rows: toRankExportRows(exportRows),
      emptyMessage: '暂无可导出的职级数据',
      saveAs: true,
    });
    if (ok) onNotice(`已导出${selected.length ? '选中' : '当前筛选'}职级数据 ${exportRows.length} 条`);
  };

  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, padding: '12px 14px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '72px 240px 72px 240px 72px 240px 72px 240px 72px 240px auto', gap: 10, alignItems: 'center', marginBottom: 10, color: colors.text, fontSize: 13, flexShrink: 0 }}>
        <span style={{ textAlign: 'right' }}>职级代码</span>
        <div style={{ position: 'relative' }}>
          <input value={filters.code} onFocus={() => setOpenDropdown('code')} onChange={event => setValue('code', event.target.value)} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
          {openDropdown === 'code' ? <BlankOption checked={filters.blankCode} onChange={(checked) => setValue('blankCode', checked)} /> : null}
        </div>
        <span style={{ textAlign: 'right' }}>职级名称</span>
        <div style={{ position: 'relative' }}>
          <input value={filters.name} onFocus={() => setOpenDropdown('name')} onChange={event => setValue('name', event.target.value)} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
          {openDropdown === 'name' ? <BlankOption checked={filters.blankName} onChange={(checked) => setValue('blankName', checked)} /> : null}
        </div>
        <span style={{ textAlign: 'right' }}>职级状态</span>
        <FilterPicker label={filters.statuses.length ? filters.statuses.join('、') : '全部'} open={openDropdown === 'status'} onOpen={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}>
          {statusOptions.map(option => <CheckOption key={option} label={option} checked={filters.statuses.includes(option)} onChange={() => toggleFilterList(option)} />)}
        </FilterPicker>
        <span style={{ textAlign: 'right' }}>适用公司</span>
        <button type="button" onClick={() => setShowCompanyModal(true)} style={{ ...filterInput(colors), textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: filters.companies.length ? colors.inputText : colors.textMuted }}>{filters.companies.length ? `${filters.companies.length} 个公司` : '请选择'}</span>
          <ChevronDown size={13} color={colors.textMuted} />
        </button>
        <span style={{ textAlign: 'right' }}>职等</span>
        <FilterPicker label={filters.grade || '请输入职等代码/职等名称'} open={openDropdown === 'grade'} onOpen={() => setOpenDropdown(openDropdown === 'grade' ? null : 'grade')}>
          <CheckOption label="未填写" checked={filters.blankGrade} onChange={() => setValue('blankGrade', !filters.blankGrade)} />
          {gradeOptions.map(option => <CheckOption key={option} label={option} checked={filters.grade === option} onChange={() => setValue('grade', filters.grade === option ? '' : option)} />)}
        </FilterPicker>
        <div style={{ display: 'flex', gap: 8 }}><Button onClick={reset}>重置</Button><Button primary onClick={onReload}>查询</Button><Button onClick={() => setShowMore(value => !value)}>{showMore ? '收起选项' : '更多筛选'} <ChevronDown size={13} /></Button></div>
      </div>
      {showMore ? (
        <div style={{ display: 'grid', gridTemplateColumns: '72px 240px 96px 118px 12px 118px minmax(0,1fr)', gap: 10, alignItems: 'center', marginBottom: 10, color: colors.text, fontSize: 13, flexShrink: 0 }}>
          <span style={{ textAlign: 'right' }}>职级描述</span>
          <input value={filters.desc} onChange={event => setValue('desc', event.target.value)} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
          <span style={{ textAlign: 'right' }}>在职人数统计</span>
          <input value={filters.minPeople} onChange={event => setValue('minPeople', event.target.value.replace(/[^\d]/g, ''))} placeholder="最小值" style={filterInput(colors)} />
          <span style={{ color: colors.textMuted, textAlign: 'center' }}>-</span>
          <input value={filters.maxPeople} onChange={event => setValue('maxPeople', event.target.value.replace(/[^\d]/g, ''))} placeholder="最大值" style={filterInput(colors)} />
          <span style={{ color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}><Filter size={14} />已接入职级 Excel、岗位序列和在职人数统计字段。</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <Button primary onClick={onCreate}><Plus size={15} />新增职级</Button>
        <input ref={importInputRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleRankImport} style={{ display: 'none' }} />
        <Button onClick={() => importInputRef.current?.click()}>{importing ? '导入中...' : '导入'}</Button>
        <Button exportButton disabled={filtered.length === 0} onClick={handleRankExport}><Download size={14} />导出Excel</Button>
      </div>
      {error ? <div style={{ color: colors.primary, fontSize: 12, paddingBottom: 8 }}>真实职级数据连接失败：{error}</div> : null}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', border: `1px solid ${colors.tableBorder}`, overflow: 'hidden' }}>
        <aside style={{ borderRight: `1px solid ${colors.tableBorder}`, background: colors.cardBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', color: colors.text, fontWeight: 700 }}>岗位序列/子序列</div>
          <div style={{ padding: '0 12px 10px', position: 'relative' }}><Search size={13} color={colors.textMuted} style={{ position: 'absolute', left: 22, top: 9 }} /><input value={sequenceQuery} onChange={event => setSequenceQuery(event.target.value)} placeholder="搜索序列名称" style={{ ...filterInput(colors), paddingLeft: 28 }} /></div>
          <div style={{ overflow: 'auto', padding: '0 8px 10px' }}>
            {sequenceList.slice(0, 24).map(option => (
              <button key={option} type="button" onClick={() => setActiveSequence(option)} style={{ width: '100%', minHeight: 34, border: 'none', borderRadius: 4, background: activeSequence === option ? colors.tagActiveBg : 'transparent', color: activeSequence === option ? colors.tagActiveText : colors.text, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', textAlign: 'left', cursor: 'pointer' }}>
                <ChevronRight size={12} />{option}
              </button>
            ))}
          </div>
        </aside>
        <div style={{ minWidth: 0, overflow: 'auto', position: 'relative' }}>
          {loading ? <div style={{ padding: 24, color: colors.textMuted }}>正在加载真实职级数据...</div> : (
            <table style={{ width: '100%', minWidth: 1420, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: colors.tableHeaderBg }}>
                  <Header width={42}><input type="checkbox" checked={Boolean(pageRows.length) && pageRows.every(row => selected.includes(row.id))} onChange={event => toggleCurrentPage(event.target.checked)} /></Header>
                  <Header width={150}>岗位序列名称</Header>
                  <Header width={150}>岗位子序列名称</Header>
                  <Header width={150}>适用公司</Header>
                  <Header width={140}>职级代码</Header>
                  <Header width={140}>职级名称</Header>
                  <Header width={130}>职等</Header>
                  <Header width={170}>职级描述</Header>
                  <Header width={150}>在职人数统计 ⓘ</Header>
                  <Header width={140}>职级状态</Header>
                  <StickyHeader width={170}>操作</StickyHeader>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr key={`${row.id}-${row.code}-${row.name}`} style={{ minHeight: 40, borderTop: `1px solid ${colors.tableBorder}` }}>
                    <Cell center><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelected(row.id)} /></Cell>
                    <Cell wrap>{text(row.sequence)}</Cell>
                    <Cell>{text(row.subSequence)}</Cell>
                    <Cell wrap>{text(row.company)}</Cell>
                    <Cell>{text(row.code)}</Cell>
                    <Cell wrap>{text(row.name)}</Cell>
                    <Cell>{text(row.grade)}</Cell>
                    <Cell wrap>{text(row.desc)}</Cell>
                    <Cell>{row.employeeCount ?? row.linkedEmployeeCount ?? 0}</Cell>
                    <Cell>{text(row.status)}</Cell>
                    <StickyActionCell><div style={{ display: 'flex', gap: 14 }}><TextButton onClick={() => onEdit(row)}>编辑</TextButton><TextButton onClick={() => onDisable(row)}>{/停用/.test(row.status) ? '启用' : '停用'}</TextButton><TextButton onClick={() => onDelete(row)}>删除</TextButton></div></StickyActionCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !pageRows.length ? <EmptyTableState /> : null}
        </div>
      </div>
      <MiniPager total={filtered.length} />
      {showCompanyModal ? <PositionCompanyModal options={companyOptions} selected={filters.companies} onChange={(companies) => setFilters(current => ({ ...current, companies }))} onClose={() => setShowCompanyModal(false)} /> : null}
    </div>
  );
}

function BlankOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <label style={{ position: 'absolute', left: 0, top: 34, width: '100%', height: 38, zIndex: 20, border: `1px solid ${colors.inputBorder}`, background: colors.cardBg, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', boxShadow: '0 10px 22px rgba(31,43,69,0.12)' }}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />未填写
    </label>
  );
}

function JobTitleManagementPage() {
  const { colors } = useTheme();
  const [filters, setFilters] = useState({ code: '', name: '', status: '已启用' });
  const reset = () => setFilters({ code: '', name: '', status: '已启用' });
  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
        <div style={{ height: 40, border: `1px solid ${colors.primary}`, background: colors.badgeBlueBg, color: colors.text, borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 12px', marginBottom: 16, gap: 8 }}>
          <InfoIcon size={15} color={colors.primary} />
          <span style={{ flex: 1 }}>职位是指在企业中，员工所承担的一系列任务和责任的集合。一个职位可能由多个员工同时担任，例如，“经理”。</span>
          <button type="button" style={plainIconButton(colors.textMuted)}><X size={14} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 240px 70px 240px 70px 240px minmax(0,1fr)', gap: 10, alignItems: 'center', color: colors.text, fontSize: 13, marginBottom: 14 }}>
          <span style={{ textAlign: 'right' }}>职位编码</span>
          <input value={filters.code} onChange={event => setFilters(current => ({ ...current, code: event.target.value }))} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
          <span style={{ textAlign: 'right' }}>职位名称</span>
          <input value={filters.name} onChange={event => setFilters(current => ({ ...current, name: event.target.value }))} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
          <span style={{ textAlign: 'right' }}>职位状态</span>
          <select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} style={filterInput(colors)}>
            <option>已启用</option>
            <option>已停用</option>
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={reset}>重置</Button>
            <Button primary onClick={() => undefined}>查询</Button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <DisabledButton><Plus size={15} />新增职位</DisabledButton>
          <DisabledButton>导入</DisabledButton>
          <DisabledButton>导出</DisabledButton>
          <DisabledButton>批量操作 <ChevronDown size={13} /></DisabledButton>
        </div>
      </div>
      <div style={{ height: 1, background: colors.tableBorder, flexShrink: 0 }} />
      <div style={{ flex: 1, minHeight: 0, padding: '16px 14px 18px', overflow: 'hidden' }}>
        <div style={{ height: '100%', border: `1px solid ${colors.tableBorder}`, overflow: 'hidden', position: 'relative' }}>
          <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: colors.tableHeaderBg }}>
                <Header width={42}><input type="checkbox" disabled /></Header>
                <Header width={170}>职位编码</Header>
                <Header width={170}>职位名称</Header>
                <Header width={170}>顺序号</Header>
                <Header width={170}>职位状态</Header>
                <Header width={170}>职位描述</Header>
                <Header width={170}>备注</Header>
                <Header width={170}>操作</Header>
              </tr>
            </thead>
          </table>
          <EmptyTableState />
        </div>
      </div>
    </div>
  );
}

function DisabledButton({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <button type="button" disabled style={{ height: 32, padding: '0 14px', borderRadius: 4, border: `1px solid ${colors.inputBorder}`, background: colors.tableHeaderBg, color: colors.textMuted, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'not-allowed', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function PositionManagementPage({ rows, loading, error, onReload, onCreate, onImport, onEdit, onDisable, onDelete, onBulkDisable, onBulkDelete, onNotice }: { rows: OrganizationPositionRecord[]; loading: boolean; error: string; onReload: () => void; onCreate: () => void; onImport: () => void; onEdit: (row: OrganizationPositionRecord) => void; onDisable: (row: OrganizationPositionRecord) => void; onDelete: (row: OrganizationPositionRecord) => void; onBulkDisable: (rows: OrganizationPositionRecord[]) => Promise<void>; onBulkDelete: (rows: OrganizationPositionRecord[]) => Promise<void>; onNotice: (message: string) => void }) {
  const { colors } = useTheme();
  const [filters, setFilters] = useState({ code: '', name: '', statuses: ['已启用'] as string[], parentNames: [] as string[], companies: [] as string[], orgs: [] as string[], blankCode: false });
  const [selected, setSelected] = useState<number[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'code' | 'status' | 'parent' | 'org' | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [sequenceQuery, setSequenceQuery] = useState('');
  const [activeSequence, setActiveSequence] = useState('全部');
  const codeTokens = useMemo(() => filters.code.split(/[;；,\s]+/).map(item => item.trim()).filter(Boolean), [filters.code]);
  const statusOptions = useMemo(() => uniqueValues(rows.map(row => row.status || '已启用'), ['已启用', '已停用']), [rows]);
  const parentOptions = useMemo(() => uniqueValues(rows.map(row => row.parentName || '未填写')), [rows]);
  const companyOptions = useMemo(() => uniqueValues(rows.flatMap(row => splitValueList(row.companyText)), ['上海拉迷家具有限公司']), [rows]);
  const orgOptions = useMemo(() => uniqueValues(rows.flatMap(row => splitValueList(row.orgText)), ['未填写']), [rows]);
  const sequenceOptions = useMemo(() => uniqueValues(rows.map(row => sequenceBucket(row.sequence)), ['全部', '专业通道', '管理通道', '未填写']), [rows]);
  const filtered = useMemo(() => rows.filter(row => {
    if (filters.blankCode && row.code) return false;
    if (codeTokens.length && !codeTokens.some(token => row.code.includes(token))) return false;
    if (filters.name && !row.name.includes(filters.name)) return false;
    if (filters.statuses.length && !filters.statuses.includes(row.status || '已启用')) return false;
    if (filters.parentNames.length && !filters.parentNames.includes(row.parentName || '未填写')) return false;
    if (filters.companies.length && !splitValueList(row.companyText).some(company => filters.companies.includes(company))) return false;
    if (filters.orgs.length) {
      const orgList = splitValueList(row.orgText);
      if (filters.orgs.includes('未填写')) {
        if (orgList.length) return false;
      } else if (!orgList.some(org => filters.orgs.includes(org))) {
        return false;
      }
    }
    if (activeSequence !== '全部' && sequenceBucket(row.sequence) !== activeSequence) return false;
    return true;
  }), [activeSequence, codeTokens, filters, rows]);
  const pageRows = filtered.slice(0, 20);
  const setValue = (key: 'code' | 'name' | 'blankCode', value: string | boolean) => setFilters(current => ({ ...current, [key]: value }));
  const reset = () => {
    setFilters({ code: '', name: '', statuses: ['已启用'], parentNames: [], companies: [], orgs: [], blankCode: false });
    setActiveSequence('全部');
  };
  const toggleSelected = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleCurrentPage = (checked: boolean) => {
    const pageIds = pageRows.map(row => row.id);
    setSelected(current => checked ? uniqueNumberValues([...current, ...pageIds]) : current.filter(id => !pageIds.includes(id)));
  };
  const toggleFilterList = (key: 'statuses' | 'parentNames' | 'companies' | 'orgs', value: string) => {
    setFilters(current => {
      const list = current[key];
      return { ...current, [key]: list.includes(value) ? list.filter(item => item !== value) : [...list, value] };
    });
  };
  const visibleColumnDefs = POSITION_COLUMNS;
  const tableMinWidth = 42 + visibleColumnDefs.reduce((sum, column) => sum + column.width, 0);
  const sequenceList = sequenceOptions.filter(item => !sequenceQuery.trim() || item.includes(sequenceQuery.trim()));
  const handlePositionExport = async () => {
    const exportRows = selected.length ? filtered.filter(row => selected.includes(row.id)) : filtered;
    const ok = await downloadAttendanceXlsx({
      fileName: `岗位管理-${selected.length ? '选中记录' : '筛选结果'}.xlsx`,
      sheetName: '岗位管理',
      headers: POSITION_EXPORT_HEADERS,
      rows: toPositionExportRows(exportRows),
      emptyMessage: '暂无可导出的岗位数据',
      saveAs: true,
    });
    if (ok) onNotice(`已导出${selected.length ? '选中' : '当前筛选'}岗位数据 ${exportRows.length} 条`);
  };

  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, padding: '12px 14px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(180px, 240px) 72px minmax(180px, 240px) 72px minmax(180px, 240px)', gap: 10, alignItems: 'center', marginBottom: 10, color: colors.text, fontSize: 13, flexShrink: 0 }}>
        <span style={{ textAlign: 'right' }}>岗位编码</span>
        <div style={{ position: 'relative' }}>
          <input value={filters.code} onFocus={() => setOpenDropdown('code')} onChange={event => setValue('code', event.target.value)} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
          {openDropdown === 'code' ? (
            <label style={{ position: 'absolute', left: 0, top: 34, width: '100%', height: 38, zIndex: 20, border: `1px solid ${colors.inputBorder}`, background: colors.cardBg, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', boxShadow: '0 10px 22px rgba(31,43,69,0.12)' }}>
              <input type="checkbox" checked={filters.blankCode} onChange={event => setValue('blankCode', event.target.checked)} />未填写
            </label>
          ) : null}
        </div>
        <span style={{ textAlign: 'right' }}>岗位名称</span><input value={filters.name} onChange={event => setValue('name', event.target.value)} placeholder="多个用；号隔开，支持Excel复制" style={filterInput(colors)} />
        <span style={{ textAlign: 'right' }}>岗位状态</span>
        <FilterPicker label={filters.statuses.length ? filters.statuses.join('、') : '全部'} open={openDropdown === 'status'} onOpen={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}>
          {statusOptions.map(option => <CheckOption key={option} label={option} checked={filters.statuses.includes(option)} onChange={() => toggleFilterList('statuses', option)} />)}
        </FilterPicker>
        <span style={{ textAlign: 'right' }}>上级岗位</span>
        <FilterPicker label={filters.parentNames.length ? `${filters.parentNames.length} 个上级岗位` : '请选择'} open={openDropdown === 'parent'} onOpen={() => setOpenDropdown(openDropdown === 'parent' ? null : 'parent')} wide>
          {parentOptions.slice(0, 8).map(option => <CheckOption key={option} label={option} checked={filters.parentNames.includes(option)} onChange={() => toggleFilterList('parentNames', option)} />)}
        </FilterPicker>
        <span style={{ textAlign: 'right' }}>适用公司</span>
        <button type="button" onClick={() => setShowCompanyModal(true)} style={{ ...filterInput(colors), textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: filters.companies.length ? colors.inputText : colors.textMuted }}>{filters.companies.length ? `${filters.companies.length} 个公司` : '请选择'}</span>
          <ChevronDown size={13} color={colors.textMuted} />
        </button>
        <div style={{ display: 'flex', gap: 8 }}><Button onClick={reset}>重置</Button><Button primary onClick={onReload}>查询</Button><Button onClick={() => setShowMore(value => !value)}>{showMore ? '收起选项' : '更多筛选'} <ChevronDown size={13} /></Button></div>
      </div>
      {showMore ? (
        <div style={{ display: 'grid', gridTemplateColumns: '72px 320px minmax(0, 1fr)', gap: 10, alignItems: 'center', marginBottom: 10, color: colors.text, fontSize: 13, flexShrink: 0 }}>
          <span style={{ textAlign: 'right' }}>所属组织</span>
          <FilterPicker label={filters.orgs.length ? `${filters.orgs.length} 个组织` : '请选择'} open={openDropdown === 'org'} onOpen={() => setOpenDropdown(openDropdown === 'org' ? null : 'org')} wide>
            {orgOptions.slice(0, 12).map(option => <CheckOption key={option} label={option} checked={filters.orgs.includes(option)} onChange={() => toggleFilterList('orgs', option)} />)}
          </FilterPicker>
          <div style={{ color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} />已接入岗位序列、岗位子序列、所属组织、适用公司真实字段。
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <Button primary onClick={onCreate}><Plus size={15} />新增岗位</Button>
        <Button onClick={onImport}>导入</Button>
        <Button exportButton disabled={filtered.length === 0} onClick={handlePositionExport}><Download size={14} />导出Excel</Button>
      </div>
      {error ? <div style={{ color: colors.primary, fontSize: 12, paddingBottom: 8 }}>真实岗位数据连接失败：{error}</div> : null}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', border: `1px solid ${colors.tableBorder}`, overflow: 'hidden' }}>
        <aside style={{ borderRight: `1px solid ${colors.tableBorder}`, background: colors.cardBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', color: colors.text, fontWeight: 700 }}>岗位序列/子序列</div>
          <div style={{ padding: '0 12px 10px', position: 'relative' }}><Search size={13} color={colors.textMuted} style={{ position: 'absolute', left: 22, top: 9 }} /><input value={sequenceQuery} onChange={event => setSequenceQuery(event.target.value)} placeholder="搜索序列名称" style={{ ...filterInput(colors), paddingLeft: 28 }} /></div>
          <div style={{ overflow: 'auto', padding: '0 8px 10px' }}>
            {sequenceList.slice(0, 24).map(option => (
              <button key={option} type="button" onClick={() => setActiveSequence(option)} style={{ width: '100%', minHeight: 34, border: 'none', borderRadius: 4, background: activeSequence === option ? colors.tagActiveBg : 'transparent', color: activeSequence === option ? colors.tagActiveText : colors.text, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', textAlign: 'left', cursor: 'pointer' }}>
                <ChevronRight size={12} />{option}
              </button>
            ))}
          </div>
        </aside>
        <div style={{ minWidth: 0, overflow: 'auto', position: 'relative' }}>
          {loading ? <div style={{ padding: 24, color: colors.textMuted }}>正在加载真实岗位数据...</div> : (
            <table style={{ width: '100%', minWidth: tableMinWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: colors.tableHeaderBg }}>
                  <Header width={42}><input type="checkbox" checked={Boolean(pageRows.length) && pageRows.every(row => selected.includes(row.id))} onChange={event => toggleCurrentPage(event.target.checked)} /></Header>
                  {visibleColumnDefs.map(column => column.key === 'actions' ? <StickyHeader key={column.key} width={column.width}>{column.label}</StickyHeader> : <Header key={column.key} width={column.width}>{column.label}</Header>)}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr key={`${row.id}-${row.code}-${row.name}`} style={{ minHeight: 40, borderTop: `1px solid ${colors.tableBorder}` }}>
                    <Cell center><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelected(row.id)} /></Cell>
                    {visibleColumnDefs.map(column => (
                      <PositionTableCell key={column.key} column={column.key} row={row} onEdit={onEdit} onDisable={onDisable} onDelete={onDelete} onNotice={onNotice} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !pageRows.length ? <EmptyTableState /> : null}
        </div>
      </div>
      <MiniPager total={filtered.length} />
      {showCompanyModal ? <PositionCompanyModal options={companyOptions} selected={filters.companies} onChange={(companies) => setFilters(current => ({ ...current, companies }))} onClose={() => setShowCompanyModal(false)} /> : null}
    </div>
  );
}

function PositionTableCell({ column, row, onEdit, onDisable, onDelete, onNotice }: { column: PositionColumnKey; row: OrganizationPositionRecord; onEdit: (row: OrganizationPositionRecord) => void; onDisable: (row: OrganizationPositionRecord) => void; onDelete: (row: OrganizationPositionRecord) => void; onNotice: (message: string) => void }) {
  if (column === 'actions') {
    return <StickyActionCell><div style={{ display: 'flex', gap: 14 }}><TextButton onClick={() => onEdit(row)}>编辑</TextButton><TextButton onClick={() => onDisable(row)}>{/停用/.test(row.status) ? '启用' : '停用'}</TextButton><TextButton onClick={() => onDelete(row)}>删除</TextButton></div></StickyActionCell>;
  }
  if (column === 'desc' || column === 'remark') return <Cell wrap>{text((row as any)[column])}</Cell>;
  const value = column === 'sortNo' ? (row as any).sortNo : (row as any)[column];
  const wrap = ['name', 'parentName', 'companyText', 'orgText', 'sequence', 'subSequence'].includes(column);
  return <Cell wrap={wrap}>{text(value)}</Cell>;
}

function EmptyTableState() {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'absolute', inset: '38px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: colors.textMuted, pointerEvents: 'none' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: colors.statCardBg, border: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MessageSquare size={30} color={colors.textMuted} />
      </div>
      <span>暂无内容</span>
    </div>
  );
}

function FilterPicker({ label, open, wide, onOpen, children }: { label: string; open: boolean; wide?: boolean; onOpen: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={onOpen} style={{ ...filterInput(colors), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown size={13} color={colors.textMuted} />
      </button>
      {open ? (
        <div style={{ position: 'absolute', left: 0, top: 36, width: wide ? 280 : '100%', maxHeight: 248, overflow: 'auto', zIndex: 60, padding: 8, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, boxShadow: '0 14px 30px rgba(31,43,69,0.15)', display: 'grid', gap: 4 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <label style={{ minHeight: 30, display: 'flex', alignItems: 'center', gap: 8, color: colors.text, fontSize: 13, cursor: 'pointer', padding: '0 6px', borderRadius: 4, background: checked ? colors.statCardBg : 'transparent' }}>
      <input type="checkbox" checked={checked} onChange={onChange} />{label}
    </label>
  );
}

function PositionColumnSettingsPanel({ value, onChange, onClose }: { value: Record<PositionColumnKey, boolean>; onChange: (value: Record<PositionColumnKey, boolean>) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const allVisible = POSITION_COLUMNS.every(column => value[column.key]);
  const toggle = (key: PositionColumnKey) => onChange({ ...value, [key]: !value[key] });
  const setAll = (checked: boolean) => onChange(POSITION_COLUMNS.reduce((acc, column) => ({ ...acc, [column.key]: checked || Boolean(column.required) }), {} as Record<PositionColumnKey, boolean>));
  return (
    <div style={{ position: 'absolute', right: 0, top: 38, width: 236, zIndex: 80, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, boxShadow: '0 16px 36px rgba(31,43,69,0.16)', overflow: 'hidden' }}>
      <div style={{ height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: colors.text, fontWeight: 700 }}>
        表头设置 <button type="button" onClick={() => setAll(true)} style={linkButton(colors)}>恢复默认</button>
      </div>
      <div style={{ padding: '0 12px 10px', display: 'flex', alignItems: 'center', gap: 14, color: colors.text, fontSize: 13 }}>
        <label><input type="checkbox" checked={allVisible} onChange={event => setAll(event.target.checked)} /> 全部字段</label>
        <span style={{ color: colors.textMuted }}>冻结前 <input defaultValue="1" style={{ width: 36, height: 26, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, textAlign: 'center', color: colors.inputText, background: colors.inputBg }} /> 列</span>
      </div>
      <div style={{ maxHeight: 330, overflow: 'auto', borderTop: `1px solid ${colors.tableBorder}`, borderBottom: `1px solid ${colors.tableBorder}`, padding: '6px 0' }}>
        {POSITION_COLUMNS.map(column => (
          <label key={column.key} style={{ height: 34, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, color: column.required ? colors.textMuted : colors.text, fontSize: 13 }}>
            <input type="checkbox" checked={value[column.key]} disabled={column.required} onChange={() => toggle(column.key)} />
            <span style={{ flex: 1 }}>{column.label}</span>
            <GripVertical size={13} color={colors.textMuted} />
          </label>
        ))}
      </div>
      <div style={{ height: 42, padding: '0 10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}><Button onClick={onClose}>取消</Button><Button primary onClick={onClose}>确定</Button></div>
    </div>
  );
}

function PositionCompanyModal({ options, selected, onChange, onClose }: { options: string[]; selected: string[]; onChange: (selected: string[]) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const visible = options.filter(option => !search.trim() || option.includes(search.trim()));
  const selectedSet = new Set(selected);
  const toggle = (company: string) => {
    const next = new Set(selectedSet);
    next.has(company) ? next.delete(company) : next.add(company);
    onChange([...next]);
  };
  return (
    <ModalShell title="选择适用公司" width={640} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onClose}>确定</Button></>}>
      <div style={{ padding: '14px 16px 0', fontSize: 13, color: colors.text }}>
        <div style={{ minHeight: 40, border: `1px solid ${colors.primary}`, background: colors.badgeBlueBg, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', color: colors.text }}>
          <InfoIcon size={14} color={colors.primary} />如招商银行代表其下级公司，选择上级公司后将自动关联下级公司口径。
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 360, borderTop: `1px solid ${colors.tableBorder}` }}>
          <div style={{ padding: '10px 12px 12px', borderRight: `1px solid ${colors.tableBorder}` }}>
            <div style={{ position: 'relative', marginBottom: 8 }}><Search size={13} color={colors.textMuted} style={{ position: 'absolute', left: 9, top: 9 }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="请输入关键字" style={{ ...filterInput(colors), paddingLeft: 28 }} /></div>
            <label style={{ height: 30, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={selected.length === options.length && options.length > 0} onChange={event => onChange(event.target.checked ? options : [])} />全选</label>
            <div style={{ maxHeight: 282, overflow: 'auto' }}>
              {visible.map((company, index) => (
                <label key={company} style={{ height: 32, display: 'flex', alignItems: 'center', gap: 8, color: colors.text }}>
                  <ChevronRight size={12} color={colors.textMuted} style={{ marginLeft: index % 3 === 0 ? 0 : 14 }} />
                  <input type="checkbox" checked={selectedSet.has(company)} onChange={() => toggle(company)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 16px', color: colors.text }}>
            <div style={{ marginBottom: 10 }}>已选 {selected.length} 个法人公司 <button type="button" onClick={() => onChange([])} style={{ ...linkButton(colors), float: 'right' }}>清除</button></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.map(company => <span key={company} style={{ border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '4px 8px', background: colors.statCardBg }}>{company}</span>)}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function PositionImportPage({ rows, onBack, onImportRows, onDone }: { rows: OrganizationPositionRecord[]; onBack: () => void; onImportRows: (rows: Partial<OrganizationPositionRecord>[]) => Promise<number>; onDone: (message: string) => void }) {
  const { colors } = useTheme();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'create' | 'upsert'>('create');
  const [fileName, setFileName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [separator, setSeparator] = useState('斜杠:/');
  const [separatorOpen, setSeparatorOpen] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [ignoreBlank, setIgnoreBlank] = useState(true);
  const [uniqueKey, setUniqueKey] = useState('岗位名称');
  const [importing, setImporting] = useState(false);
  const separators = ['斜杠:/', '短横杠:-', '下划线:_', '反斜杠:\\', '竖杠:|', '右括号:>'];
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportFile(file);
  };
  const confirm = async () => {
    if (!importFile) {
      onDone('请先选择岗位 Excel 文件再确认导入');
      return;
    }
    setImporting(true);
    try {
      const parsedRows = await parsePositionWorkbook(importFile, separator, ignoreBlank, mode, uniqueKey);
      if (!parsedRows.length) {
        onDone(`${fileName} 未识别到可导入的岗位数据`);
        return;
      }
      const saved = await onImportRows(parsedRows);
      onDone(`已导入 ${saved} 条岗位数据，列表已重新读取真实岗位数据源。`);
    } catch (err: any) {
      onDone(`岗位导入失败：${String(err?.message || err)}`);
    } finally {
      setImporting(false);
    }
  };
  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', borderBottom: `1px solid ${colors.tableBorder}`, flexShrink: 0 }}>
        <button type="button" onClick={onBack} style={linkButton(colors)}>‹ 返回</button>
        <strong style={{ color: colors.text }}>导入岗位</strong>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingTop: 28 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', color: colors.text, fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', margin: '0 0 28px' }}>
            <ImportStep active number="1" label="上传文件" />
            <ImportStep number="2" label="导入结果" />
          </div>
          <div style={{ width: 420, margin: '0 auto', display: 'grid', gap: 18 }}>
            <div>
              <div style={{ marginBottom: 8 }}>1. 选择导入目的</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: `1px solid ${colors.inputBorder}`, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ padding: 12, background: mode === 'create' ? colors.statCardBg : colors.cardBg }}><RadioCard checked={mode === 'create'} title="新增" desc="仅新增数据" onClick={() => setMode('create')} /></div>
                <div style={{ padding: 12, borderLeft: `1px solid ${colors.inputBorder}`, background: mode === 'upsert' ? colors.statCardBg : colors.cardBg }}><RadioCard checked={mode === 'upsert'} title="新增并修改" desc="同时支持新增或修改已有数据" onClick={() => setMode('upsert')} /></div>
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>2. {mode === 'create' ? '下载【岗位】模板' : '下载已有【岗位】信息'}</div>
              <Button onClick={() => mode === 'create' ? downloadTextFile('新增岗位导入模板.csv', '岗位编码,岗位名称,适用公司,所属组织,岗位序列名称,岗位子序列名称,上级岗位,顺序号,岗位状态\n') : downloadTextFile('已有岗位数据.csv', toPositionCsv(rows))}>
                <Download size={14} />{mode === 'create' ? '下载空模板' : '下载已有数据'}
              </Button>
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>3. 上传Excel表格</div>
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{ width: '100%', height: 118, border: `1px dashed ${colors.inputBorder}`, borderRadius: 5, background: colors.inputBg, color: colors.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <span style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                  <Upload size={26} color={colors.primary} />
                  <span>{fileName || '点击或拖拽到此区域上传'}</span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>文件需小于20M，支持Excel（2003以上版本）</span>
                </span>
              </button>
            </div>
            {mode === 'upsert' ? (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={ignoreBlank} onChange={event => setIgnoreBlank(event.target.checked)} />导入字段值为空时，不覆盖原有数据 <InfoIcon size={13} color={colors.textMuted} /></label>
                <FormRow label="岗位信息匹配规则"><SelectInput value={uniqueKey} onChange={setUniqueKey} options={['岗位名称', '岗位编码']} /></FormRow>
              </>
            ) : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>部门路径分隔符</span>
              <div style={{ width: 190, position: 'relative' }}>
                <button type="button" onClick={() => setSeparatorOpen(open => !open)} style={{ ...filterInput(colors), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>{separator}<ChevronDown size={13} /></button>
                {separatorOpen ? (
                  <div style={{ position: 'absolute', left: 0, top: 36, width: 190, padding: 6, zIndex: 40, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, boxShadow: '0 14px 30px rgba(31,43,69,0.15)' }}>
                    {separators.map(item => <button key={item} type="button" onClick={() => { setSeparator(item); setSeparatorOpen(false); }} style={{ width: '100%', height: 30, border: 'none', background: item === separator ? colors.statCardBg : 'transparent', color: colors.text, textAlign: 'left', padding: '0 8px', cursor: 'pointer' }}>{item}</button>)}
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ border: `1px solid ${colors.inputBorder}`, borderRadius: 5, padding: '12px 14px', color: colors.textMuted, lineHeight: 1.8, position: 'relative', background: colors.inputBg }}>
              <div style={{ color: colors.text, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><InfoIcon size={15} color={colors.primary} />上传说明</div>
              <div>1. 导入文件填写的【适用公司】已包含下级公司，无需填写每个公司节点。<button type="button" onClick={() => setShowExample(open => !open)} style={linkButton(colors)}>显示</button></div>
              {showExample ? <ImportExamplePopover /> : null}
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 54, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0 }}>
        <Button onClick={onBack}>取消</Button>
        <Button primary onClick={confirm}>{importing ? '导入中...' : '确认导入'}</Button>
      </div>
    </div>
  );
}

async function parsePositionWorkbook(file: File, separator: string, ignoreBlank: boolean, mode: 'create' | 'upsert', uniqueKey: string): Promise<Partial<OrganizationPositionRecord>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find(name => name.includes('岗位')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(sheet, { defval: '', raw: false, header: 1 });
  const headerIndex = Math.max(0, matrix.findIndex(row => row.some(cell => String(cell).includes('岗位编码')) && row.some(cell => String(cell).includes('岗位名称'))));
  const headers = (matrix[headerIndex] || []).map(cell => String(cell || '').trim());
  const delimiter = separator.includes(':') ? separator.split(':').slice(1).join(':') : '/';
  const sourceRows = matrix.slice(headerIndex + 1);
  return sourceRows.map(row => {
    const name = workbookCell(headers, row, ['岗位名称', '职位名称']);
    const code = workbookCell(headers, row, ['岗位编码', '职位编码']);
    if (!name && !code) return null;
    const orgs = workbookCells(headers, row, ['所属组织', '部门路径', '组织']).flatMap(value => splitImportedPath(value, delimiter));
    const companies = workbookCells(headers, row, ['适用公司', '公司']).flatMap(value => splitImportedPath(value, delimiter));
    const payload: Record<string, unknown> = {
      code,
      name,
      parentName: workbookCell(headers, row, ['上级岗位']),
      orgs,
      orgText: orgs.join('；'),
      companies,
      companyText: companies.join('；'),
      sequence: workbookCell(headers, row, ['岗位序列名称', '岗位序列']),
      subSequence: workbookCell(headers, row, ['岗位子序列名称', '岗位子序列']),
      sortNo: workbookCell(headers, row, ['顺序号']),
      status: workbookCell(headers, row, ['岗位状态']) || '已启用',
      desc: workbookCell(headers, row, ['岗位描述', '职位描述']),
      remark: workbookCell(headers, row, ['备注']),
    };
    if (mode === 'upsert' && ignoreBlank) {
      Object.keys(payload).forEach(key => {
        const value = payload[key];
        if (value === '' || (Array.isArray(value) && !value.length)) delete payload[key];
      });
      payload[uniqueKey === '岗位编码' ? 'code' : 'name'] = uniqueKey === '岗位编码' ? code : name;
    }
    return payload as Partial<OrganizationPositionRecord>;
  }).filter((row): row is Partial<OrganizationPositionRecord> => Boolean(row?.name));
}

async function parseRankWorkbook(file: File): Promise<Partial<OrganizationRankRecord>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find(name => name.includes('职级')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(sheet, { defval: '', raw: false, header: 1 });
  const headerIndex = Math.max(0, matrix.findIndex(row => row.some(cell => String(cell).includes('职级代码')) || row.some(cell => String(cell).includes('职级名称'))));
  const headers = (matrix[headerIndex] || []).map(cell => String(cell || '').trim());
  return matrix.slice(headerIndex + 1).map(row => {
    const code = workbookCell(headers, row, ['职级代码', '代码']);
    const name = workbookCell(headers, row, ['职级名称', '名称']);
    if (!code && !name) return null;
    return {
      sequence: workbookCell(headers, row, ['岗位序列名称', '岗位序列']),
      subSequence: workbookCell(headers, row, ['岗位子序列名称', '岗位子序列']),
      company: workbookCell(headers, row, ['适用公司', '公司']),
      code,
      name,
      grade: workbookCell(headers, row, ['职等']),
      desc: workbookCell(headers, row, ['职级描述', '描述']),
      status: workbookCell(headers, row, ['职级状态', '状态']) || '已启用',
    } as Partial<OrganizationRankRecord>;
  }).filter((row): row is Partial<OrganizationRankRecord> => Boolean(row?.code || row?.name));
}

function workbookCell(headers: string[], row: Array<string | number | boolean | Date>, aliases: string[]) {
  const index = headers.findIndex(header => aliases.some(alias => header.includes(alias)));
  return index >= 0 ? text(row[index], '') : '';
}

function workbookCells(headers: string[], row: Array<string | number | boolean | Date>, aliases: string[]) {
  return headers
    .map((header, index) => aliases.some(alias => header.includes(alias)) ? text(row[index], '') : '')
    .filter(Boolean);
}

function splitImportedPath(value: string, delimiter: string) {
  const source = String(value || '').trim();
  if (!source) return [];
  if (source.includes('；') || source.includes(';') || source.includes('，') || source.includes(',')) {
    return splitValueList(source);
  }
  return source.split(delimiter).map(item => item.trim()).filter(Boolean);
}

function sequenceBucket(value?: string) {
  const textValue = String(value || '').trim();
  return !textValue || textValue === '-' ? '未填写' : textValue;
}

function ImportStep({ active, number, label }: { active?: boolean; number: string; label: string }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: active ? colors.text : colors.textMuted }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: active ? colors.primary : colors.inputBg, color: active ? colors.primaryText : colors.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${active ? colors.primary : colors.inputBorder}` }}>{number}</span>
      <strong>{label}</strong>
      <span style={{ flex: 1, height: 1, background: colors.tableBorder }} />
    </div>
  );
}

function ImportExamplePopover() {
  const { colors } = useTheme();
  const rows = [
    ['XXX集团公司', ''],
    ['A公司', 'A公司及以下'],
    ['A1子公司', 'A1子公司'],
    ['A2子公司', 'A2子公司'],
    ['B公司', 'B公司及以下'],
  ];
  return (
    <div style={{ position: 'absolute', left: 230, top: 54, width: 430, padding: 10, zIndex: 50, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, boxShadow: '0 18px 36px rgba(31,43,69,0.16)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ background: colors.tableHeaderBg }}><Header width={150}>法人公司架构示例</Header><Header width={130}>场景示例</Header><Header width={150}>适用公司填写示例</Header></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} style={{ height: 28, borderTop: `1px solid ${colors.tableBorder}` }}><Cell>{'  '.repeat(index)}{row[0]}</Cell><Cell>{index === 1 ? '当前适用公司为A公司及以下' : index === 2 ? '当前适用公司为A1子公司' : '-'}</Cell><Cell>{row[1] || '-'}</Cell></tr>)}</tbody>
      </table>
    </div>
  );
}

function splitValueList(value?: string) {
  return String(value || '')
    .split(/[;；,，]/)
    .map(item => item.trim())
    .filter(item => item && item !== '-');
}

function uniqueValues(values: string[], seeds: string[] = []) {
  const result: string[] = [];
  [...seeds, ...values].forEach(value => {
    const item = text(value, '').trim();
    if (item && !result.includes(item)) result.push(item);
  });
  return result;
}

function uniqueNumberValues(values: number[]) {
  return Array.from(new Set(values));
}

function StaffingManagementPage({ orgRows, positionRows, onApply, onContact }: { orgRows: OrganizationRecord[]; positionRows: OrganizationPositionRecord[]; onApply: () => void; onContact: () => void }) {
  const { colors } = useTheme();
  const enabledPositions = positionRows.filter(row => /启用|生效/.test(row.status)).length;
  const staffedPositions = positionRows.filter(row => row.linkedEmployeeCount > 0).length;
  const totalPeople = orgRows.reduce((sum, row) => sum + (row.directMemberCount || 0), 0);
  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, overflow: 'auto', position: 'relative' }}>
      <div style={{ maxWidth: 1320, margin: '18px auto 0', height: 220, borderRadius: 7, background: colors.statCardBg, border: `1px solid ${colors.cardBorder}`, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div style={{ padding: '58px 0 0 260px', color: colors.text }}>
          <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 18 }}>编制管理</div>
          <div style={{ maxWidth: 360, lineHeight: 1.8, color: colors.textMuted }}>企业可以选择部门或岗位维度，创建多个周期的编制管理方案。</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, color: colors.primary }}>
          <div style={{ width: 96, height: 96, borderRadius: 16, background: colors.cardBg, display: 'grid', placeItems: 'center', boxShadow: '0 18px 40px rgba(31,43,69,0.12)' }}><BarChart3 size={42} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 86px)', gap: 12 }}>
            <MetricPill label="组织" value={orgRows.length} />
            <MetricPill label="岗位" value={enabledPositions} />
            <MetricPill label="人员" value={totalPeople} />
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: '46px auto 30px', textAlign: 'center', color: colors.text }}>
        <div style={{ fontWeight: 700, marginBottom: 18 }}>开通流程</div>
        <div style={{ minHeight: 96, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, boxShadow: '0 12px 32px rgba(31,43,69,0.08)', display: 'grid', gridTemplateColumns: '1fr 40px 1fr 40px 1fr', alignItems: 'center', padding: '0 46px', textAlign: 'left' }}>
          <FlowStep icon={<Headphones size={28} />} title="01 咨询相关事项" action="联系方式" onAction={onContact} />
          <ChevronRight color={colors.textMuted} />
          <FlowStep icon={<FileDown size={28} />} title="02 申请开通" action="下方申请开通" onAction={onApply} />
          <ChevronRight color={colors.textMuted} />
          <FlowStep icon={<CheckCircle2 size={28} />} title="03 审核开通" desc="管理员审核通过后将为您开通" />
        </div>
      </div>
      <div style={{ maxWidth: 820, margin: '0 auto 44px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', color: colors.text }}>
        <FeatureBlock title="编制计划" desc="可以根据周期和部门维度，创建企业编制管理方案。员工入转调离时校验编制计划，避免超编。" />
        <DataMockCard title="2026 上半年编制" rows={[['组织/部门', '直营编制', '下级编制'], ['市场推广部', String(staffedPositions), String(enabledPositions)], ['PMC部', String(positionRows.length), String(totalPeople)]]} />
        <DataMockCard title="市场推广部" rows={[['岗位', '岗位编制', '占编人数'], ['销售培训经理', '1', String(positionRows.find(row => row.name.includes('销售'))?.linkedEmployeeCount || 0)], ['运营专员', '8', String(positionRows.find(row => row.name.includes('运营'))?.linkedEmployeeCount || 0)]]} />
        <FeatureBlock title="编制统计" desc="实时统计企业、部门编制数据，编制概况尽在掌握。" />
      </div>
      <div style={{ position: 'sticky', bottom: 0, height: 52, borderTop: `1px solid ${colors.tableBorder}`, background: colors.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Button primary onClick={onApply}>申请开通</Button>
        <Button onClick={onContact}>联系我们</Button>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <div style={{ height: 60, borderRadius: 6, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, display: 'grid', placeItems: 'center', color: colors.text }}>
      <strong style={{ fontSize: 18 }}>{value}</strong>
      <span style={{ fontSize: 12, color: colors.textMuted }}>{label}</span>
    </div>
  );
}

function FlowStep({ icon, title, action, desc, onAction }: { icon: React.ReactNode; title: string; action?: string; desc?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ color: colors.primary }}>{icon}</span>
      <span>
        <strong style={{ display: 'block', color: colors.text, fontSize: 14 }}>{title}</strong>
        {action ? <button type="button" onClick={onAction} style={linkButton(colors)}>{action}</button> : <span style={{ color: colors.textMuted, fontSize: 12 }}>{desc}</span>}
      </span>
    </div>
  );
}

function FeatureBlock({ title, desc }: { title: string; desc: string }) {
  const { colors } = useTheme();
  return (
    <div style={{ padding: '0 0 0 8px' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 22, color: colors.text }}>{title}</h2>
      <div style={{ width: 24, height: 3, background: colors.primary, marginBottom: 18 }} />
      <p style={{ margin: 0, lineHeight: 1.8, color: colors.textMuted }}>{desc}</p>
    </div>
  );
}

function DataMockCard({ title, rows }: { title: string; rows: string[][] }) {
  const { colors } = useTheme();
  return (
    <div style={{ width: 360, minHeight: 150, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, background: colors.cardBg, boxShadow: '0 16px 38px rgba(31,43,69,0.08)', padding: 14 }}>
      <div style={{ color: colors.text, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={{ background: index === 0 ? colors.tableHeaderBg : 'transparent' }}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={{ height: 28, color: index === 0 ? colors.textMuted : colors.text, borderBottom: `1px solid ${colors.tableBorder}` }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const POSITION_EXPORT_HEADERS = ['岗位编码', '岗位名称', '上级岗位', '适用公司', '所属组织', '岗位序列', '岗位子序列', '岗位状态', '占编人数'];
const RANK_EXPORT_HEADERS = ['岗位序列名称', '岗位子序列名称', '适用公司', '职级代码', '职级名称', '职等', '职级描述', '在职人数统计', '职级状态'];

function toPositionExportRows(rows: OrganizationPositionRecord[]): XlsxCellValue[][] {
  return rows.map(row => [
    row.code,
    row.name,
    row.parentName || '',
    row.companyText || '',
    row.orgText || '',
    row.sequence || '',
    row.subSequence || '',
    row.status || '',
    row.linkedEmployeeCount ?? 0,
  ].map(textCell));
}

function toPositionCsv(rows: OrganizationPositionRecord[]) {
  const lines = toPositionExportRows(rows).map(row => row.map(csvCell).join(','));
  return `\uFEFF${POSITION_EXPORT_HEADERS.map(csvCell).join(',')}\n${lines.join('\n')}`;
}

function toRankExportRows(rows: OrganizationRankRecord[]): XlsxCellValue[][] {
  return rows.map(row => [
    row.sequence || '',
    row.subSequence || '',
    row.company || '',
    row.code || '',
    row.name || '',
    row.grade || '',
    row.desc || '',
    row.employeeCount ?? row.linkedEmployeeCount ?? 0,
    row.status || '',
  ].map(textCell));
}

function toRankCsv(rows: OrganizationRankRecord[]) {
  const lines = toRankExportRows(rows).map(row => row.map(csvCell).join(','));
  return `\uFEFF${RANK_EXPORT_HEADERS.map(csvCell).join(',')}\n${lines.join('\n')}`;
}

function OrganizationTypeEditModal({ type, onChange, onClose, onSave }: { type: OrganizationTypeRow; onChange: (type: OrganizationTypeRow) => void; onClose: () => void; onSave: () => void }) {
  const { colors } = useTheme();
  const title = type.name ? '编辑组织类型' : '新增组织类型';
  return (
    <ModalShell title={title} width={386} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onSave}>保存</Button></>}>
      <div style={{ padding: '18px 34px 30px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
        <FormRow label="组织类型" required><Input value={type.name} onChange={value => onChange({ ...type, name: value })} placeholder="请输入" max={10} count /></FormRow>
        <FormRow label="启用状态" required><Switch checked={type.enabled} onChange={() => onChange({ ...type, enabled: !type.enabled })} /></FormRow>
        <FormRow label="说明"><textarea value={type.desc === '-' ? '' : type.desc} onChange={event => onChange({ ...type, desc: event.target.value.slice(0, 100) })} placeholder="请输入" style={{ ...formInput(colors), height: 62, paddingTop: 8, resize: 'none' }} /></FormRow>
      </div>
    </ModalShell>
  );
}

function OrganizationTypeDeleteConfirm({ type, onClose, onConfirm }: { type: OrganizationTypeRow; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title="" width={344} onClose={onClose}>
      <div style={{ padding: '22px 24px 18px', display: 'flex', alignItems: 'center', gap: 10, color: colors.text, fontSize: 14 }}>
        <AlertCircle size={18} color="#f59e0b" />
        <strong>【{type.name}】组织类型删除后将无法恢复</strong>
      </div>
      <div style={{ height: 58, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '0 18px' }}>
        <Button onClick={onClose}>取消</Button>
        <button type="button" onClick={onConfirm} style={{ height: 32, padding: '0 14px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, cursor: 'pointer' }}>删除</button>
      </div>
    </ModalShell>
  );
}

function OrganizationTypeSortModal({ types, onMove, onClose, onSave }: { types: OrganizationTypeRow[]; onMove: (from: number, to: number) => void; onClose: () => void; onSave: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title="排序" width={596} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onSave}>保存</Button></>}>
      <div style={{ padding: '14px 14px 22px' }}>
        <div style={{ height: 34, border: `1px solid ${colors.primary}`, background: colors.tagActiveBg, color: colors.primary, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', marginBottom: 12, fontSize: 13 }}>
          <AlertCircle size={15} />拖动组织名称进行排序
          <button type="button" style={{ ...plainIconButton(colors.textMuted), marginLeft: 'auto' }}><X size={14} /></button>
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', borderTop: `1px solid ${colors.tableBorder}` }}>
          {types.filter(type => !type.system).map((type, visibleIndex) => {
            const index = types.findIndex(item => item.id === type.id);
            return (
              <div key={type.id} style={{ height: 42, borderBottom: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10, color: colors.text, fontSize: 13 }}>
                <span style={{ flex: 1 }}>{type.name}</span>
                <button type="button" onClick={() => onMove(index, index - 1)} disabled={visibleIndex === 0} style={sortButton(colors, visibleIndex === 0)}>上移</button>
                <button type="button" onClick={() => onMove(index, index + 1)} disabled={visibleIndex === types.filter(item => !item.system).length - 1} style={sortButton(colors, visibleIndex === types.filter(item => !item.system).length - 1)}>下移</button>
                <GripVertical size={16} color={colors.textMuted} />
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}

function PositionEditModal({ draft, positions, orgRows, onChange, onClose, onSave }: { draft: PositionFormState; positions: OrganizationPositionRecord[]; orgRows: OrganizationRecord[]; onChange: (draft: PositionFormState) => void; onClose: () => void; onSave: () => void }) {
  const update = (key: keyof PositionFormState, value: string) => onChange({ ...draft, [key]: value });
  const { colors } = useTheme();
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const companyOptions = useMemo(() => uniqueValues(positions.flatMap(position => splitValueList(position.companyText)), ['上海拉迷家具有限公司', '上海拉迷家具有限公司（含其下级公司）']), [positions]);
  const orgOptions = useMemo(() => uniqueValues(orgRows.map(row => row.fullPath || row.name), ['上海拉迷家具有限公司']), [orgRows]);
  const parentOptions = useMemo(() => uniqueValues(positions.map(position => position.name).filter(name => name !== draft.name)), [draft.name, positions]);
  const sequenceOptions = useMemo(() => uniqueValues(positions.map(position => position.sequence || '').filter(Boolean)), [positions]);
  return (
    <ModalShell title={draft.code ? '编辑岗位' : '新增岗位'} width={430} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onSave}>保存</Button></>}>
      <div style={{ padding: '18px 34px 28px', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
        <FormRow label="岗位编码"><Input value={draft.code} onChange={value => update('code', value)} placeholder="系统可自动生成" max={30} count /></FormRow>
        <FormRow label="岗位名称" required><Input value={draft.name} onChange={value => update('name', value)} placeholder="请输入" max={30} count /></FormRow>
        <FormRow label="适用公司">
          <TagSelector value={draft.companyText} placeholder="请选择" onClick={() => setCompanyPickerOpen(true)} />
        </FormRow>
        <FormRow label="岗位序列/子序列">
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setSequenceOpen(open => !open)} style={{ ...formInput(colors), textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: draft.sequence ? colors.inputText : colors.textMuted }}>
              <span>{draft.sequence || '请选择'}</span><ChevronDown size={13} />
            </button>
            {sequenceOpen ? (
              <div style={{ position: 'absolute', left: 0, right: 0, top: 36, minHeight: 112, zIndex: 60, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, background: colors.cardBg, boxShadow: '0 16px 32px rgba(31,43,69,0.16)', overflow: 'hidden' }}>
                {sequenceOptions.length ? sequenceOptions.slice(0, 8).map(option => (
                  <button key={option} type="button" onClick={() => { update('sequence', option); setSequenceOpen(false); }} style={{ width: '100%', height: 32, border: 'none', background: option === draft.sequence ? colors.statCardBg : 'transparent', color: colors.text, textAlign: 'left', padding: '0 10px', cursor: 'pointer' }}>{option}</button>
                )) : <EmptyDropdown />}
              </div>
            ) : null}
          </div>
        </FormRow>
        <FormRow label="上级岗位">
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setParentOpen(open => !open)} style={{ ...formInput(colors), textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: draft.parentName ? colors.inputText : colors.textMuted }}>
              <span>{draft.parentName || '请选择'}</span><ChevronDown size={13} />
            </button>
            {parentOpen ? (
              <div style={{ position: 'absolute', left: 0, right: 0, top: 36, maxHeight: 220, overflow: 'auto', zIndex: 60, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, background: colors.cardBg, boxShadow: '0 16px 32px rgba(31,43,69,0.16)' }}>
                {parentOptions.slice(0, 12).map(option => <button key={option} type="button" onClick={() => { update('parentName', option); setParentOpen(false); }} style={{ width: '100%', height: 32, border: 'none', background: option === draft.parentName ? colors.statCardBg : 'transparent', color: colors.text, textAlign: 'left', padding: '0 10px', cursor: 'pointer' }}>{option}</button>)}
              </div>
            ) : null}
          </div>
        </FormRow>
        <FormRow label="所属组织">
          <TagSelector value={draft.orgText} placeholder="请选择" onClick={() => setOrgPickerOpen(true)} />
        </FormRow>
        <FormRow label="顺序号"><Input value={draft.sortNo} onChange={value => update('sortNo', value)} placeholder="请输入" /></FormRow>
        <FormRow label="子序列"><Input value={draft.subSequence} onChange={value => update('subSequence', value)} placeholder="请输入" /></FormRow>
        <FormRow label="岗位状态"><SelectInput value={draft.status} onChange={value => update('status', value)} options={['已启用', '已停用']} /></FormRow>
        <FormRow label="岗位描述"><textarea value={draft.desc} onChange={event => update('desc', event.target.value.slice(0, 500))} placeholder="请输入" style={{ ...formInput(colors), height: 64, paddingTop: 8, resize: 'none' }} /></FormRow>
        <FormRow label="备注"><textarea value={draft.remark} onChange={event => update('remark', event.target.value.slice(0, 500))} placeholder="请输入" style={{ ...formInput(colors), height: 64, paddingTop: 8, resize: 'none' }} /></FormRow>
      </div>
      {companyPickerOpen ? (
        <PositionCompanyModal
          options={companyOptions}
          selected={splitValueList(draft.companyText)}
          onChange={(companies) => update('companyText', companies.join('；'))}
          onClose={() => setCompanyPickerOpen(false)}
        />
      ) : null}
      {orgPickerOpen ? (
        <PositionCompanyModal
          options={orgOptions}
          selected={splitValueList(draft.orgText)}
          onChange={(orgs) => update('orgText', orgs.join('；'))}
          onClose={() => setOrgPickerOpen(false)}
        />
      ) : null}
    </ModalShell>
  );
}

function TagSelector({ value, placeholder, onClick }: { value: string; placeholder: string; onClick: () => void }) {
  const { colors } = useTheme();
  const items = splitValueList(value);
  return (
    <button type="button" onClick={onClick} style={{ ...formInput(colors), minHeight: 34, height: 'auto', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', textAlign: 'left' }}>
      {items.length ? (
        <>
          {items.slice(0, 2).map(item => <span key={item} style={{ maxWidth: 82, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRadius: 4, background: colors.statCardBg, padding: '2px 6px' }}>{item}</span>)}
          {items.length > 2 ? <span style={{ borderRadius: 4, background: colors.statCardBg, padding: '2px 6px' }}>+{items.length - 2}</span> : null}
        </>
      ) : <span style={{ color: colors.textMuted }}>{placeholder}</span>}
      <ChevronDown size={13} style={{ marginLeft: 'auto', flexShrink: 0 }} />
    </button>
  );
}

function EmptyDropdown() {
  const { colors } = useTheme();
  return (
    <div style={{ height: 112, display: 'grid', placeItems: 'center', color: colors.textMuted, fontSize: 12 }}>
      <span style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
        <FileDown size={30} color={colors.textMuted} />
        暂无内容
      </span>
    </div>
  );
}

function RankEditModal({ draft, ranks, onChange, onClose, onSave }: { draft: RankFormState; ranks: OrganizationRankRecord[]; onChange: (draft: RankFormState) => void; onClose: () => void; onSave: () => void }) {
  const update = (key: keyof RankFormState, value: string) => onChange({ ...draft, [key]: value });
  const { colors } = useTheme();
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const sequenceOptions = useMemo(() => uniqueValues(ranks.map(rank => rank.sequence || '').filter(Boolean), ['专业通道', '管理通道']), [ranks]);
  const gradeOptions = useMemo(() => uniqueValues(ranks.map(rank => rank.grade || '').filter(Boolean), ['G1', 'G2', 'G3', 'G4', 'G5']), [ranks]);
  const companyOptions = useMemo(() => uniqueValues(ranks.flatMap(rank => splitValueList(rank.company)), ['上海拉迷家具有限公司', '上海拉迷家具有限公司（含其下级公司）']), [ranks]);
  return (
    <ModalShell title={draft.code ? '编辑职级' : '新增职级'} width={430} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onSave}>保存</Button></>}>
      <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', padding: '18px 34px 28px', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
        <FormRow label="岗位序列/子序列" required>
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setSequenceOpen(open => !open)} style={{ ...formInput(colors), textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: draft.sequence ? colors.inputText : colors.textMuted }}>
              <span>{draft.sequence || '请选择'}</span><ChevronDown size={13} />
            </button>
            {sequenceOpen ? (
              <div style={{ position: 'absolute', left: 0, right: 0, top: 36, minHeight: 78, zIndex: 60, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, background: colors.cardBg, boxShadow: '0 16px 32px rgba(31,43,69,0.16)', overflow: 'hidden' }}>
                {sequenceOptions.map(option => (
                  <button key={option} type="button" onClick={() => { update('sequence', option); setSequenceOpen(false); }} style={{ width: '100%', height: 32, border: 'none', background: option === draft.sequence ? colors.statCardBg : 'transparent', color: colors.text, textAlign: 'left', padding: '0 10px', cursor: 'pointer' }}>{option}</button>
                ))}
              </div>
            ) : null}
          </div>
        </FormRow>
        <FormRow label="适用公司">
          <button type="button" onClick={() => setCompanyPickerOpen(true)} style={{ ...formInput(colors), color: draft.company ? colors.inputText : colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.company || '适用公司为空，所有人可见'}</span>
            <ChevronDown size={13} />
          </button>
        </FormRow>
        <FormRow label="职级代码" required><Input value={draft.code} onChange={value => update('code', value)} placeholder="请输入（例如：P7、P7.1）" max={30} /></FormRow>
        <FormRow label="职级名称"><Input value={draft.name} onChange={value => update('name', value)} placeholder="请输入（例如：高级工程师）" max={30} /></FormRow>
        <FormRow label="职等"><SelectInput value={draft.grade} onChange={value => update('grade', value)} options={gradeOptions} /></FormRow>
        <FormRow label="职级状态"><Switch checked={!/停用/.test(draft.status)} onChange={() => update('status', /停用/.test(draft.status) ? '已启用' : '已停用')} /></FormRow>
        <FormRow label="职级描述">
          <div style={{ position: 'relative' }}>
            <textarea value={draft.desc} onChange={event => update('desc', event.target.value.slice(0, 500))} placeholder="请输入" style={{ ...formInput(colors), height: 74, paddingTop: 8, resize: 'none' }} />
            <span style={{ position: 'absolute', right: 8, bottom: 6, color: colors.textMuted, fontSize: 11 }}>{draft.desc.length} / 500</span>
          </div>
        </FormRow>
      </div>
      {companyPickerOpen ? (
        <PositionCompanyModal
          options={companyOptions}
          selected={splitValueList(draft.company)}
          onChange={(companies) => update('company', companies.join('；'))}
          onClose={() => setCompanyPickerOpen(false)}
        />
      ) : null}
    </ModalShell>
  );
}

function RankDeleteConfirm({ rank, onClose, onConfirm }: { rank: OrganizationRankRecord; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  const label = `${rank.code ? `${rank.code}-` : ''}${rank.name}`;
  return (
    <ModalShell title="" width={360} onClose={onClose}>
      <div style={{ padding: '24px 26px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, color: colors.text, fontSize: 14 }}>
        <AlertCircle size={18} color="#f59e0b" />
        <div>
          <strong>删除“{label}”？</strong>
          <div style={{ marginTop: 12, color: colors.textMuted, fontSize: 13 }}>职级删除后会从当前职级列表隐藏</div>
        </div>
      </div>
      <div style={{ height: 58, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '0 18px' }}>
        <Button onClick={onClose}>取消</Button>
        <button type="button" onClick={onConfirm} style={{ height: 32, padding: '0 14px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, cursor: 'pointer' }}>删除</button>
      </div>
    </ModalShell>
  );
}

function PositionDeleteConfirm({ position, onClose, onConfirm }: { position: OrganizationPositionRecord; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  const label = `${position.code ? `${position.code}-` : ''}${position.name}`;
  return (
    <ModalShell title="" width={360} onClose={onClose}>
      <div style={{ padding: '24px 26px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, color: colors.text, fontSize: 14 }}>
        <AlertCircle size={18} color="#f59e0b" />
        <div>
          <strong>删除“{label}”？</strong>
          <div style={{ marginTop: 12, color: colors.textMuted, fontSize: 13 }}>岗位删除后不可恢复</div>
        </div>
      </div>
      <div style={{ height: 58, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '0 18px' }}>
        <Button onClick={onClose}>取消</Button>
        <button type="button" onClick={onConfirm} style={{ height: 32, padding: '0 14px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, cursor: 'pointer' }}>删除</button>
      </div>
    </ModalShell>
  );
}

function StaffingApplyModal({ orgCount, positionCount, onClose, onConfirm }: { orgCount: number; positionCount: number; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title="申请开通编制管理" width={430} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onConfirm}>提交申请</Button></>}>
      <div style={{ padding: '18px 30px 26px', color: colors.text, fontSize: 13, lineHeight: 1.9 }}>
        <div style={{ marginBottom: 12 }}>本次申请将基于当前真实组织与岗位数据初始化编制范围。</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MetricPill label="组织数量" value={orgCount} />
          <MetricPill label="岗位数量" value={positionCount} />
        </div>
        <div style={{ marginTop: 14, color: colors.textMuted }}>提交后可继续在岗位管理和组织架构中维护基础数据。</div>
      </div>
    </ModalShell>
  );
}

function ServicePanel({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const helpItems = ['新手引导', '人事服务', '薪税代发', '团体福利', '费用管理', '发票管理', '财务核算', '应收应付', '协同办公', '场景应用', '企业应用开发中心'];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 720, height: 620, background: colors.cardBg, borderRadius: 8, boxShadow: '0 18px 46px rgba(27,38,62,0.28)', overflow: 'hidden', display: 'grid', gridTemplateRows: '54px 1fr' }}>
        <div style={{ background: colors.primary, color: colors.primaryText, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 16 }}>
          <strong style={{ fontSize: 15 }}>在线客服</strong>
          <div style={{ marginLeft: 'auto', width: 330, height: 30, borderRadius: 16, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', fontSize: 12 }}>
            <Search size={14} />请输入关键词，如：入门指南、个人认证、加入企业
          </div>
          <button type="button" onClick={onClose} style={plainIconButton(colors.primaryText)}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', minHeight: 0 }}>
          <div style={{ background: colors.appBg, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <button type="button" style={linkButton(colors)}>查看更多</button>
            <div style={{ textAlign: 'center', color: colors.textMuted, marginBottom: 10 }}>13:41</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: colors.cardBg, display: 'grid', placeItems: 'center', color: colors.primary }}><Headphones size={19} /></div>
              <div style={{ maxWidth: 330, background: colors.cardBg, borderRadius: 6, padding: 14, color: colors.text, lineHeight: 1.7 }}>
                您好，我是AI小薪，有什么可以帮助您的吗？欢迎访问薪福通帮助中心获得更多使用小妙招。
              </div>
            </div>
            <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
              <div><Button onClick={() => {}}>转人工</Button> <Button onClick={() => {}}>小知识</Button></div>
              <div style={{ display: 'flex', gap: 8 }}><input placeholder="请用一句话描述您的问题" style={filterInput(colors)} /><SegmentedIcon active onClick={() => {}}><Send size={14} /></SegmentedIcon></div>
            </div>
          </div>
          <aside style={{ borderLeft: `1px solid ${colors.tableBorder}`, padding: '18px 18px 0', overflow: 'auto', color: colors.text }}>
            <strong>客服电话</strong>
            <div style={{ margin: '10px 0 18px', color: colors.textMuted }}>400-0695-555（工作日 08:30-18:00）</div>
            <strong>功能服务</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '12px 0 18px', color: colors.primary, textAlign: 'center', fontSize: 12 }}>
              <div><CalendarDays size={18} /><div>预约演示</div></div><div><MessageSquare size={18} /><div>意见箱</div></div><div><UsersRound size={18} /><div>同屏服务</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><strong>帮助文档</strong><button type="button" style={linkButton(colors)}>全部 &gt;</button></div>
            {helpItems.map(item => <button key={item} type="button" style={{ width: '100%', height: 34, border: 'none', background: 'transparent', color: colors.text, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}><span>{item}</span><ChevronRight size={13} color={colors.textMuted} /></button>)}
          </aside>
        </div>
      </div>
    </div>
  );
}

function ArchitecturePage({ rows, loading, error, onDownload, onNotice, onSort, onOpenLevelModal }: { rows: OrganizationRecord[]; loading: boolean; error: string; onDownload: () => void; onNotice: (message: string) => void; onSort: () => void; onOpenLevelModal: (mode: 'expandLevel' | 'collapseLevel') => void }) {
  const { colors } = useTheme();
  const [showDirectMembers, setShowDirectMembers] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const [scopeCode, setScopeCode] = useState('');
  const [depthLimit, setDepthLimit] = useState(3);
  const [zoom, setZoom] = useState(0.72);
  const [chartView, setChartView] = useState<OrgChartView>('horizontal');
  const [visibleFields, setVisibleFields] = useState<Record<OrgChartField, boolean>>({
    code: true,
    type: true,
    leader: true,
    employeeCount: true,
    childCount: true,
  });
  const fieldMenuRef = useRef<HTMLDivElement | null>(null);
  const levelMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (fieldMenuRef.current && fieldMenuRef.current.contains(event.target as Node)) return;
      if (levelMenuRef.current && levelMenuRef.current.contains(event.target as Node)) return;
      setFieldMenuOpen(false);
      setLevelMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const rowsByCode = useMemo(() => new Map(rows.map(row => [row.code, row])), [rows]);
  const childCountByCode = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(row => {
      if (!row.parentCode) return;
      map.set(row.parentCode, (map.get(row.parentCode) || 0) + 1);
    });
    return map;
  }, [rows]);
  const scopedRoot = rowsByCode.get(scopeCode) || rows.find(row => !row.parentCode) || rows[0];
  const scopedRows = useMemo(() => {
    if (!scopedRoot) return [];
    return rows.filter(row => row.code === scopedRoot.code || row.fullPath.startsWith(`${scopedRoot.fullPath}/`));
  }, [rows, scopedRoot]);
  const rootDepth = scopedRoot?.depth || 0;
  const chartRows = scopedRows.filter(row => (row.depth || 0) - rootDepth < depthLimit);
  const levels = useMemo(() => {
    const grouped = new Map<number, OrganizationRecord[]>();
    chartRows.forEach(row => {
      const level = Math.max(0, (row.depth || 0) - rootDepth);
      grouped.set(level, [...(grouped.get(level) || []), row]);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b).map(([, items]) => items);
  }, [chartRows, rootDepth]);

  const setAllFields = (checked: boolean) => setVisibleFields({ code: checked, type: checked, leader: checked, employeeCount: checked, childCount: checked });
  const toggleField = (key: OrgChartField) => setVisibleFields(current => ({ ...current, [key]: !current[key] }));
  const allFieldsVisible = Object.values(visibleFields).every(Boolean);

  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ height: 32, padding: '0 12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, background: colors.inputBg, color: colors.text, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          显示直属成员 <Switch checked={showDirectMembers} onChange={() => setShowDirectMembers(value => !value)} />
        </div>
        <Button onClick={() => setScopeOpen(true)}>组织显示范围</Button>
        <div ref={fieldMenuRef} style={{ position: 'relative' }}>
          <Button onClick={(event) => { event.stopPropagation(); setFieldMenuOpen(open => !open); }}>组织字段设置</Button>
          {fieldMenuOpen ? (
            <div style={{ position: 'absolute', left: 0, top: 36, width: 134, zIndex: 520, padding: '8px 10px', borderRadius: 5, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, boxShadow: '0 12px 28px rgba(31,43,69,0.16)', display: 'grid', gap: 9, fontSize: 13, color: colors.text }}>
              <label><input type="checkbox" checked={allFieldsVisible} onChange={event => setAllFields(event.target.checked)} /> 全部显示</label>
              <label><input type="checkbox" checked={visibleFields.code} onChange={() => toggleField('code')} /> 组织编码</label>
              <label><input type="checkbox" checked={visibleFields.type} onChange={() => toggleField('type')} /> 组织类型</label>
              <label><input type="checkbox" checked={visibleFields.leader} onChange={() => toggleField('leader')} /> 负责人</label>
              <label><input type="checkbox" checked={visibleFields.employeeCount} onChange={() => toggleField('employeeCount')} /> 成员总数</label>
              <label><input type="checkbox" checked={visibleFields.childCount} onChange={() => toggleField('childCount')} /> 下级组织数</label>
            </div>
          ) : null}
        </div>
        <Button onClick={() => setViewOpen(true)}>视图设置</Button>
        <Button onClick={onSort}>修改排序</Button>
        <div ref={levelMenuRef} style={{ position: 'relative' }}>
          <Button onClick={(event) => { event.stopPropagation(); setLevelMenuOpen(open => !open); }}>展开/折叠指定层级 <ChevronDown size={13} /></Button>
          {levelMenuOpen ? (
            <DropMenu left={0} top={36}>
              <DropItem label="展开指定层级" onClick={() => { setLevelMenuOpen(false); setDepthLimit(99); onOpenLevelModal('expandLevel'); }} />
              <DropItem label="折叠指定层级" onClick={() => { setLevelMenuOpen(false); setDepthLimit(2); onOpenLevelModal('collapseLevel'); }} />
            </DropMenu>
          ) : null}
        </div>
        <div style={{ marginLeft: 'auto' }}><Button onClick={onDownload}>下载架构图</Button></div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'auto', background: colors.appBg, border: `1px solid ${colors.tableBorder}` }}>
        {loading ? <div style={{ padding: 24, color: colors.textMuted }}>正在加载真实组织架构...</div> : error ? <div style={{ padding: 24, color: colors.primary }}>真实数据连接失败：{error}</div> : (
          <div style={{ minWidth: chartView === 'vertical' ? 760 : 1900, minHeight: 760, padding: '190px 80px 80px', transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {levels.map((levelRows, levelIndex) => (
              <div key={levelIndex} style={{ display: 'flex', justifyContent: 'center', gap: levelIndex < 2 ? 280 : 28, marginBottom: 42, position: 'relative' }}>
                {levelRows.slice(0, levelIndex > 1 ? 44 : 12).map(row => (
                  <OrgChartCard key={row.code} row={row} fields={visibleFields} childCount={childCountByCode.get(row.code) || 0} showDirectMembers={showDirectMembers} root={levelIndex === 0} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'absolute', right: 18, bottom: 70, display: 'grid', gap: 8 }}>
          <button title="适配画布" type="button" onClick={() => setZoom(0.72)} style={chartControlButton(colors)}><Maximize2 size={16} /></button>
          <div style={{ display: 'grid', background: colors.cardBg, borderRadius: 5, border: `1px solid ${colors.inputBorder}`, overflow: 'hidden' }}>
            <button title="放大" type="button" onClick={() => setZoom(value => Math.min(1.4, value + 0.1))} style={chartControlButton(colors)}><ZoomIn size={16} /></button>
            <button title="缩小" type="button" onClick={() => setZoom(value => Math.max(0.35, value - 0.1))} style={chartControlButton(colors)}><ZoomOut size={16} /></button>
            <button title="居中" type="button" onClick={() => setZoom(0.72)} style={chartControlButton(colors)}><Minus size={16} /></button>
          </div>
        </div>
      </div>
      {scopeOpen ? <OrgScopeModal rows={rows} value={scopeCode || scopedRoot?.code || ''} onChange={setScopeCode} onClose={() => setScopeOpen(false)} onConfirm={() => setScopeOpen(false)} /> : null}
      {viewOpen ? <OrgViewSettingsModal value={chartView} onChange={setChartView} onClose={() => setViewOpen(false)} onConfirm={() => setViewOpen(false)} /> : null}
    </div>
  );
}

function OrgChartCard({ row, fields, childCount, showDirectMembers, root }: { row: OrganizationRecord; fields: Record<OrgChartField, boolean>; childCount: number; showDirectMembers: boolean; root?: boolean }) {
  const { colors } = useTheme();
  const headerBg = root ? colors.primary : row.orgType === '中心' ? colors.badgeGreenText : colors.badgeBlueText;
  return (
    <div style={{ width: 118, minHeight: 58, borderRadius: 3, border: `1px solid ${colors.inputBorder}`, background: colors.cardBg, boxShadow: '0 2px 7px rgba(31,43,69,0.12)', overflow: 'hidden', fontSize: 10 }}>
      <div style={{ height: 17, padding: '0 6px', display: 'flex', alignItems: 'center', color: '#fff', background: headerBg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
      <div style={{ padding: '4px 6px', color: colors.text, lineHeight: 1.45 }}>
        {fields.code ? <div>编码：{row.code}</div> : null}
        {fields.type ? <div>类型：{row.orgType}</div> : null}
        {fields.leader ? <div>负责人：{shortPerson(row.leader || '')}</div> : null}
        {fields.employeeCount ? <div>成员：{row.employeeCount ?? 0}</div> : null}
        {fields.childCount ? <div>下级：{childCount}</div> : null}
        {showDirectMembers ? <div>直属：{row.directMemberCount ?? 0}</div> : null}
      </div>
    </div>
  );
}

function ArchitectureSortPage({ rows, loading, error, onBack, onSave }: { rows: OrganizationRecord[]; loading: boolean; error: string; onBack: () => void; onSave: () => void }) {
  const { colors } = useTheme();
  const [zoom, setZoom] = useState(0.72);
  const chartRows = rows.slice(0, 52);
  const rootDepth = chartRows[0]?.depth || 0;
  const levels = useMemo(() => {
    const grouped = new Map<number, OrganizationRecord[]>();
    chartRows.forEach(row => {
      const level = Math.max(0, (row.depth || 0) - rootDepth);
      grouped.set(level, [...(grouped.get(level) || []), row]);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b).map(([, items]) => items);
  }, [chartRows, rootDepth]);

  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, padding: '8px 12px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button type="button" onClick={onBack} style={linkButton(colors)}>‹ 返回</button>
        <span style={{ color: colors.text, fontWeight: 700 }}>修改排序</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'auto', background: colors.appBg, border: `1px solid ${colors.tableBorder}` }}>
        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 8, zIndex: 2 }}>
          <button title="撤销" type="button" onClick={() => setZoom(value => Math.max(0.35, value - 0.08))} style={chartControlButton(colors)}><Undo2 size={16} /></button>
          <button title="重做" type="button" onClick={() => setZoom(value => Math.min(1.4, value + 0.08))} style={chartControlButton(colors)}><Redo2 size={16} /></button>
        </div>
        {loading ? <div style={{ padding: 24, color: colors.textMuted }}>正在加载真实组织架构...</div> : error ? <div style={{ padding: 24, color: colors.primary }}>真实数据连接失败：{error}</div> : (
          <div style={{ minWidth: 1900, minHeight: 720, padding: '180px 80px 80px', transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {levels.map((levelRows, levelIndex) => (
              <div key={levelIndex} style={{ display: 'flex', justifyContent: 'center', gap: levelIndex < 2 ? 280 : 28, marginBottom: 42 }}>
                {levelRows.slice(0, levelIndex > 1 ? 44 : 12).map(row => (
                  <div key={row.code} style={{ position: 'relative' }}>
                    <OrgChartCard row={row} fields={{ code: true, type: true, leader: true, employeeCount: true, childCount: false }} childCount={0} showDirectMembers root={levelIndex === 0} />
                    <GripVertical size={13} color={colors.textMuted} style={{ position: 'absolute', right: 4, bottom: 4 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'absolute', right: 18, bottom: 70, display: 'grid', gap: 8 }}>
          <button title="适配画布" type="button" onClick={() => setZoom(0.72)} style={chartControlButton(colors)}><Maximize2 size={16} /></button>
          <div style={{ display: 'grid', background: colors.cardBg, borderRadius: 5, border: `1px solid ${colors.inputBorder}`, overflow: 'hidden' }}>
            <button title="放大" type="button" onClick={() => setZoom(value => Math.min(1.4, value + 0.1))} style={chartControlButton(colors)}><ZoomIn size={16} /></button>
            <button title="缩小" type="button" onClick={() => setZoom(value => Math.max(0.35, value - 0.1))} style={chartControlButton(colors)}><ZoomOut size={16} /></button>
            <button title="居中" type="button" onClick={() => setZoom(0.72)} style={chartControlButton(colors)}><Minus size={16} /></button>
          </div>
        </div>
      </div>
      <div style={{ height: 48, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
        <Button onClick={onBack}>不保存</Button>
        <Button primary onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}

function LevelControlModal({ title, actionText, onClose, onConfirm }: { title: string; actionText: string; onClose: () => void; onConfirm: (level: number) => void }) {
  const { colors } = useTheme();
  const [level, setLevel] = useState('3');
  const parsedLevel = Math.max(1, Math.min(20, Number(level) || 1));
  return (
    <ModalShell title={title} width={386} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={() => onConfirm(parsedLevel)}>确定</Button></>}>
      <div style={{ padding: '18px 28px 14px', color: colors.text, fontSize: 13 }}>
        <div style={{ marginBottom: 10 }}><span style={{ color: colors.primary }}>* </span>请输入要{actionText}的组织层级，将自动{actionText}其及所有上级组织</div>
        <input value={level} onChange={event => setLevel(event.target.value.replace(/[^\d]/g, '').slice(0, 2))} autoFocus style={{ ...formInput(colors), width: 194 }} />
      </div>
    </ModalShell>
  );
}

function OrgScopeModal({ rows, value, onChange, onClose, onConfirm }: { rows: OrganizationRecord[]; value: string; onChange: (code: string) => void; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const visibleRows = rows.filter(row => !search.trim() || `${row.name} ${row.code}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <ModalShell title="组织显示范围" width={596} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onConfirm}>确定</Button></>}>
      <div style={{ padding: '12px 22px 18px', minHeight: 360, fontSize: 13 }}>
        <div style={{ position: 'relative', marginBottom: 8 }}><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索所属机构" style={{ ...filterInput(colors), paddingLeft: 28 }} /><Search size={14} color={colors.textMuted} style={{ position: 'absolute', left: 9, top: 9 }} /></div>
        <div style={{ maxHeight: 310, overflow: 'auto', borderTop: `1px solid ${colors.tableBorder}` }}>
          {visibleRows.slice(0, 180).map(row => (
            <button key={row.code} type="button" onClick={() => onChange(row.code)} style={{ width: '100%', height: 30, border: 'none', background: value === row.code ? colors.statCardBg : 'transparent', color: value === row.code ? colors.primary : colors.text, display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 8 + Math.min((row.depth || 0) * 18, 110), cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
              <ChevronRight size={12} style={{ opacity: row.depth ? 0.75 : 1 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function OrgViewSettingsModal({ value, onChange, onClose, onConfirm }: { value: OrgChartView; onChange: (value: OrgChartView) => void; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title="视图设置" width={596} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onConfirm}>确定</Button></>}>
      <div style={{ padding: '16px 16px 20px', color: colors.text, fontSize: 13 }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${colors.inputBorder}`, borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
          {([
            ['adaptive', '自适应视图'],
            ['horizontal', '横向视图'],
            ['vertical', '纵向视图'],
          ] as [OrgChartView, string][]).map(([key, label]) => (
            <button key={key} type="button" onClick={() => onChange(key)} style={{ height: 30, minWidth: 96, border: 'none', borderRight: key === 'vertical' ? 'none' : `1px solid ${colors.inputBorder}`, background: value === key ? colors.statCardBg : colors.cardBg, color: value === key ? colors.primary : colors.text, cursor: 'pointer' }}>
              <span style={{ marginRight: 6 }}>{value === key ? '◉' : '○'}</span>{label}
            </button>
          ))}
        </div>
        <div style={{ color: colors.textMuted, marginBottom: 12 }}>架构图中所有组织节点将以所选视图展示，组织负责人、成员数在卡片展示。</div>
        <div style={{ height: 320, borderRadius: 7, background: colors.statCardBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 340, height: 230, position: 'relative' }}>
            <PreviewNode color={colors.primary} left={128} top={10} label="企业根组织名称" />
            <PreviewNode color={colors.badgeBlueText} left={20} top={110} />
            <PreviewNode color={colors.badgeBlueText} left={128} top={110} />
            <PreviewNode color={colors.badgeBlueText} left={236} top={110} />
            <PreviewNode color={colors.badgeRedText} left={20} top={190} />
            <PreviewNode color={colors.badgeRedText} left={128} top={190} />
            <PreviewNode color={colors.badgeRedText} left={236} top={190} />
            <div style={{ position: 'absolute', left: 170, top: 72, width: 1, height: 38, background: colors.inputBorder }} />
            <div style={{ position: 'absolute', left: 63, top: 96, width: 214, height: 1, background: colors.inputBorder }} />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function PreviewNode({ color, left, top, label }: { color: string; left: number; top: number; label?: string }) {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'absolute', left, top, width: 96, height: 54, borderRadius: 5, border: `1px solid ${colors.inputBorder}`, background: colors.cardBg, overflow: 'hidden' }}>
      <div style={{ height: 20, background: color, color: '#fff', fontSize: 11, padding: '3px 7px' }}>{label || ''}</div>
    </div>
  );
}

function OrganizationSettingsPage({ fields, onBack, onAdd, onEdit, onToggle }: { fields: FieldSetting[]; onBack: () => void; onAdd: () => void; onEdit: (field: FieldSetting) => void; onToggle: (id: string, key: 'enabled' | 'tableVisible') => void }) {
  const { colors } = useTheme();
  const [staffingEnabled, setStaffingEnabled] = useState(false);
  const [controlMode, setControlMode] = useState<'strong' | 'weak'>('strong');
  void fields;
  void onBack;
  void onAdd;
  void onEdit;
  void onToggle;
  return (
    <div style={{ height: '100%', background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.cardBorder}`, overflow: 'auto', paddingTop: 28 }}>
      <div style={{ width: 640, maxWidth: 'calc(100% - 64px)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SettingsBlock title="基础设置">
          <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${colors.tableBorder}` }}>
            <div style={{ color: colors.text, fontWeight: 600, marginBottom: 8 }}>部门展示设置</div>
            <div style={{ color: colors.textMuted, lineHeight: 1.8 }}>
              设置企业所需的部门展示形式。
              <button type="button" style={linkButton(colors)}>设置</button>
            </div>
          </div>
          <div style={{ padding: '14px 18px 16px' }}>
            <div style={{ color: colors.text, fontWeight: 600, marginBottom: 8 }}>职等设置</div>
            <div style={{ color: colors.textMuted, lineHeight: 1.8 }}>
              职等
              <button type="button" style={linkButton(colors)}>设置</button>
            </div>
          </div>
        </SettingsBlock>

        <SettingsBlock title="编制管理设置">
          <div style={{ padding: '14px 18px 14px', borderBottom: `1px solid ${colors.tableBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: colors.text, fontWeight: 600 }}>启用编制管理</span>
              <Switch checked={staffingEnabled} onChange={() => setStaffingEnabled(value => !value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 170px', alignItems: 'center', gap: 8, color: colors.text, fontSize: 13 }}>
              <span>编制维度 <span style={{ color: colors.textMuted }}>ⓘ</span></span>
              <select style={filterInput(colors)} defaultValue="组织">
                <option>组织</option>
                <option>岗位</option>
              </select>
            </div>
          </div>

          <div style={{ padding: '14px 18px 16px', borderBottom: `1px solid ${colors.tableBorder}` }}>
            <div style={{ color: colors.text, fontWeight: 600, marginBottom: 10 }}>强弱控制</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ControlCard
                active={controlMode === 'strong'}
                title="强控制"
                tag="细分"
                desc="当人员超出编制时，进行限制，不能进入企业"
                onClick={() => setControlMode('strong')}
              />
              <ControlCard
                active={controlMode === 'weak'}
                title="弱控制"
                tag="细分"
                desc="当人员超出编制时，仅进行提示，员工仍能进入企业"
                onClick={() => setControlMode('weak')}
              />
            </div>
          </div>

          <div style={{ padding: '14px 18px 16px' }}>
            <div style={{ color: colors.text, fontWeight: 600, marginBottom: 8 }}>编制占用设置</div>
            <div style={{ color: colors.textMuted, lineHeight: 1.8 }}>
              设置企业的编制占用规则，根据规则显示占编人数
              <button type="button" style={linkButton(colors)}>设置</button>
            </div>
            <div style={{ color: colors.textMuted, marginTop: 6, lineHeight: 1.7 }}>
              占编公式：占编人数=在职人数+录用审批中+待入职人数+待调入人数+待离职人数-待调出人数
            </div>
          </div>
        </SettingsBlock>
      </div>
    </div>
  );
}

function SettingsBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <section style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 5, background: colors.cardBg, overflow: 'hidden' }}>
      <div style={{ height: 36, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 8, background: colors.tableHeaderBg, color: colors.text, fontWeight: 700 }}>
        <ChevronDown size={13} />
        {title}
      </div>
      {children}
    </section>
  );
}

function ControlCard({ active, title, tag, desc, onClick }: { active: boolean; title: string; tag: string; desc: string; onClick: () => void }) {
  const { colors } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 60,
        border: 'none',
        borderRadius: 4,
        background: active ? colors.tagActiveBg : colors.tableHeaderBg,
        padding: '10px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        color: colors.text,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? colors.primary : colors.textMuted}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {active ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.primary }} /> : null}
        </span>
        <strong>{title}</strong>
        <span style={{ color: active ? colors.primary : colors.textMuted }}>{tag}</span>
      </div>
      <div style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.6, paddingLeft: 20 }}>{desc}</div>
    </button>
  );
}

function ChangeDetailModal({ record, onClose }: { record: ChangeRecord; onClose: () => void }) {
  return (
    <ModalShell title="变更详情" width={408} onClose={onClose} footer={<Button primary onClick={onClose}>确定</Button>}>
      <div style={{ padding: '18px 28px 28px', display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 16, columnGap: 12, fontSize: 13 }}>
        <div style={{ gridColumn: '1 / -1', fontWeight: 700 }}>基本信息</div>
        <Info label="组织名称" value={record.orgName} /><Info label="组织编码" value={record.orgCode} /><Info label="组织类型" value={record.orgType} />
        <Info label="组织负责人" value="-" /><Info label="审批主管" value="-" /><Info label="上级组织" value={record.parentName} /><Info label="备注" value={record.remark} />
        <Info label="变更类型" value={record.changeType} /><Info label="生效日期" value={record.effectiveDate} /><Info label="操作时间" value={record.actionTime} /><Info label="操作人" value={record.operator} />
      </div>
    </ModalShell>
  );
}

function FieldDrawer({ title, field, onChange, onClose, onSave }: { title: string; field: FieldSetting; onChange: (field: FieldSetting) => void; onClose: () => void; onSave: () => void }) {
  const { colors } = useTheme();
  const update = (patch: Partial<FieldSetting>) => onChange({ ...field, ...patch });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 384, maxWidth: '90vw', background: colors.cardBg, display: 'flex', flexDirection: 'column', boxShadow: '0 18px 40px rgba(27,38,62,0.28)' }}>
        <div style={{ height: 46, padding: '0 16px', borderBottom: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><strong>{title}</strong><button type="button" onClick={onClose} style={plainIconButton(colors.textMuted)}><X size={17} /></button></div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
          <FormRow label="字段名称" required><Input value={field.name} onChange={value => update({ name: value })} placeholder="请输入" max={20} count /></FormRow>
          <FormRow label="字段编码"><Input value={field.code} onChange={value => update({ code: value })} placeholder="若未填写，系统将自动生成" max={20} count /></FormRow>
          <FormRow label="字段类型" required><SelectInput value={field.type} onChange={value => update({ type: value })} options={['单行文本', '日期', '单选', '选择成员']} placeholder="请选择" /></FormRow>
          <FormRow label="填写说明"><textarea value={field.desc || ''} onChange={event => update({ desc: event.target.value.slice(0, 200) })} placeholder="请输入" style={{ ...formInput(colors), height: 62, paddingTop: 8, resize: 'none' }} /></FormRow>
          <FormRow label="是否必填" required><span style={{ display: 'flex', gap: 14 }}><label><input type="radio" checked={field.required} onChange={() => update({ required: true })} /> 必填</label><label><input type="radio" checked={!field.required} onChange={() => update({ required: false })} /> 选填</label></span></FormRow>
          <FormRow label="启用状态" required><Switch checked={field.enabled} onChange={() => update({ enabled: !field.enabled })} /></FormRow>
        </div>
        <div style={{ marginTop: 'auto', height: 58, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '0 18px' }}><Button onClick={onClose}>取消</Button><Button primary onClick={onSave}>保存</Button></div>
      </div>
    </div>
  );
}

function EmptyState() {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 13, pointerEvents: 'none' }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: colors.statCardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><FileDown size={26} /></div>
      暂无内容
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <button type="button" onClick={onChange} style={{ width: 26, height: 15, borderRadius: 999, border: 'none', background: checked ? colors.primary : colors.textMuted, padding: 2, cursor: 'pointer', display: 'inline-flex', justifyContent: checked ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: colors.primaryText }} />
    </button>
  );
}

function OrgEditModal({ title, form, rows, onChange, onClose, onSave }: { title: string; form: OrgFormState; rows: OrganizationRecord[]; onChange: (key: keyof OrgFormState, value: string) => void; onClose: () => void; onSave: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title={title} width={386} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onSave}>保存</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 32px 22px' }}>
        <FormRow label="生效日期" required><InputIcon><input type="date" value={form.effectiveDate} onChange={event => onChange('effectiveDate', event.target.value)} style={formInput(colors)} /><CalendarDays size={14} /></InputIcon></FormRow>
        <FormRow label="组织名称" required><Input value={form.name} onChange={value => onChange('name', value)} placeholder="请输入" /></FormRow>
        <FormRow label="组织类型" required><SelectInput value={form.orgType} onChange={value => onChange('orgType', value)} options={['集团', '中心', '部门', '门店', '项目组']} placeholder="请选择" /></FormRow>
        <FormRow label="上级组织" required><SelectInput value={form.parentCode} onChange={value => onChange('parentCode', value)} options={rows.map(codeWithName)} values={rows.map(row => row.code)} placeholder="请选择" /></FormRow>
        <FormRow label="组织编码"><Input value={form.code} onChange={value => onChange('code', value)} placeholder="请输入" max={50} count /></FormRow>
        <FormRow label="机构号"><Input value={form.institutionNo} onChange={value => onChange('institutionNo', value)} placeholder="请输入" max={20} count /></FormRow>
        <FormRow label="组织负责人"><InputIcon><input value={form.leader} onChange={event => onChange('leader', event.target.value)} placeholder="请选择" style={formInput(colors)} /><UserRound size={14} /></InputIcon></FormRow>
        <FormRow label="审批主管"><InputIcon><input value={form.approvalManager} onChange={event => onChange('approvalManager', event.target.value)} placeholder="请选择" style={formInput(colors)} /><UserRound size={14} /></InputIcon></FormRow>
        <FormRow label="所属公司"><SelectInput value={form.company} onChange={value => onChange('company', value)} options={['上海拉迷家具有限公司', '上海拉迷家具有限公司（含其下级公司）']} /></FormRow>
        <FormRow label="备注"><textarea value={form.remark} onChange={event => onChange('remark', event.target.value)} placeholder="请输入" maxLength={200} style={{ ...formInput(colors), height: 74, paddingTop: 8, resize: 'none' }} /></FormRow>
      </div>
    </ModalShell>
  );
}

function OrgDetailModal({ org, childCount, parentName, onClose, onEdit }: { org: OrganizationRecord; childCount: number; parentName: string; onClose: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title="组织详情" width={388} onClose={onClose} footer={<Button primary onClick={onEdit}>修改</Button>}>
      <div style={{ padding: '16px 26px 26px', display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', rowGap: 17, columnGap: 12, color: colors.text, fontSize: 13 }}>
        <Info label="生效日期" value={org.effectiveDate || '2025/07/18'} />
        <Info label="组织名称" value={<>{org.name} {org.depth === 0 ? <span style={{ color: colors.badgeRedText, background: colors.badgeRedBg, padding: '1px 4px', borderRadius: 3 }}>一级组织</span> : null}</>} />
        <Info label="组织编码" value={org.code} />
        <Info label="组织类型" value={org.orgType} />
        <Info label="组织负责人" value={shortPerson(org.leader || '')} />
        <Info label="审批主管" value={shortPerson(org.approvalManager || '')} />
        <Info label="所属公司" value="上海拉迷家具有限公司" />
        <Info label="直属成员" value={org.directMemberCount ?? 0} />
        <Info label="成员总数" value={org.employeeCount ?? 0} />
        <Info label="下级组织数" value={childCount} />
        <Info label="上级组织" value={parentName} />
        <Info label="备注" value={org.remark || '-'} />
      </div>
    </ModalShell>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <ModalShell title="组织基础设置" width={450} onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button primary onClick={onClose}>保存</Button></>}>
      <div style={{ padding: '18px 28px 28px', display: 'flex', flexDirection: 'column', gap: 14, color: colors.text, fontSize: 13 }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>允许组织负责人为空 <input type="checkbox" defaultChecked /></label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>组织编码自动生成 <input type="checkbox" defaultChecked /></label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>与员工管理、考勤人员联动 <input type="checkbox" defaultChecked /></label>
        <div style={{ padding: 12, borderRadius: 6, background: colors.statCardBg, color: colors.textMuted, lineHeight: 1.8 }}>
          当前组织数据来自 `组织架构信息导出.xlsx`，保存新增组织后会写入本地数据，并继续参与页面筛选和点击测试。
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, width, children, footer, onClose }: { title: string; width: number; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width, maxWidth: 'calc(100vw - 48px)', background: colors.cardBg, borderRadius: 10, boxShadow: '0 18px 40px rgba(27,38,62,0.28)', overflow: 'hidden' }}>
        <div style={{ height: 44, padding: '0 18px', borderBottom: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{title}</div>
          <button type="button" onClick={onClose} style={plainIconButton(colors.textMuted)}><X size={17} /></button>
        </div>
        {children}
        {footer ? (
          <div style={{ height: 58, borderTop: `1px solid ${colors.tableBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '0 18px' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '82px minmax(0,1fr)', alignItems: 'center', gap: 10, fontSize: 13, color: colors.text }}>
      <span style={{ textAlign: 'right' }}>{required ? <span style={{ color: colors.primary }}>* </span> : null}{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, max, count }: { value: string; onChange: (value: string) => void; placeholder?: string; max?: number; count?: boolean }) {
  const { colors } = useTheme();
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={event => onChange(event.target.value.slice(0, max || 999))} placeholder={placeholder} style={formInput(colors)} />
      {count ? <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 11, color: colors.textMuted }}>{value.length} / {max}</span> : null}
    </div>
  );
}

function InputIcon({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {items[0]}
      <span style={{ position: 'absolute', right: 10, top: 8, color: colors.textMuted, display: 'inline-flex' }}>{items[1]}</span>
    </div>
  );
}

function SelectInput({ value, values, options, onChange, placeholder = '请选择' }: { value: string; values?: string[]; options: string[]; onChange: (value: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  return (
    <select value={value} onChange={event => onChange(event.target.value)} style={formInput(colors)}>
      <option value="">{placeholder}</option>
      {options.map((option, index) => <option key={`${option}-${index}`} value={values?.[index] || option}>{option}</option>)}
    </select>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <>
      <div style={{ color: colors.textMuted, textAlign: 'right' }}>{label}</div>
      <div style={{ color: colors.text }}>{value}</div>
    </>
  );
}

function formInput(colors: ReturnType<typeof useTheme>['colors']): React.CSSProperties {
  return {
    width: '100%',
    height: 34,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 5,
    padding: '0 10px',
    outline: 'none',
    fontSize: 13,
    color: colors.inputText,
    boxSizing: 'border-box',
    background: colors.inputBg,
  };
}

function filterInput(colors: ReturnType<typeof useTheme>['colors']): React.CSSProperties {
  return {
    ...formInput(colors),
    height: 32,
    borderRadius: 5,
  };
}

function linkButton(colors: ReturnType<typeof useTheme>['colors']): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    color: colors.primary,
    fontSize: 13,
    padding: '0 4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
  };
}

function sortButton(colors: ReturnType<typeof useTheme>['colors'], disabled: boolean): React.CSSProperties {
  return {
    height: 24,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    background: colors.inputBg,
    color: disabled ? colors.textMuted : colors.primary,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
  };
}

function chartControlButton(colors: ReturnType<typeof useTheme>['colors']): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    border: `1px solid ${colors.inputBorder}`,
    background: colors.cardBg,
    color: colors.textMuted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function plainIconButton(color = 'inherit'): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    border: 'none',
    background: 'transparent',
    color,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };
}
