import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchStatItems, saveStatItems, type StatItemRecord } from '../api/realData';

import {
  Search, X, ChevronLeft, ChevronRight, ChevronDown,
  Plus, Trash2, Edit2, ArrowLeft, Info,
} from 'lucide-react';

// ─── Types ───────────────────────────────────
type StatItem = StatItemRecord;
type Formula = { id: number; name: string; expr: string };
type View = 'list' | 'edit';
type EditMode = 'add' | 'edit';

// ─── Constants ───────────────────────────────
const CATEGORIES = ['全部', '人事基础', '打卡信息', '考勤基础', '请假时长', '加班信息', '其他', '自定义'];
const SCOPES = ['日考勤统计与月汇总', '日考勤统计', '月考勤汇总'];
const MODULES = ['基础考勤', '薪资核算', '考勤报表'];
const DATA_TYPES = ['数值型', '文本型', '日期型', '布尔型'];
const RESULT_TYPES = ['求和', '平均值', '最大值', '最小值', '取值'];
const ROUND_MODES = ['四舍五入', '向上舍入', '向下舍入', '截断'];

const SYSTEM_DESCS: Record<string, string> = {
  '考勤基础': '该统计项由系统根据排班与打卡记录自动计算，结果写入月考勤汇总与日考勤明细。',
  '打卡信息': '该统计项直接来源于员工打卡设备或移动端打卡记录，不参与自动计算。',
  '人事基础': '该统计项从员工档案同步，每次核算时自动更新，不可手动修改。',
  '请假时长': '该统计项统计各类假期经审批通过的时长，数值来源于假期管理模块。',
  '加班信息': '该统计项统计经审批通过的加班时长，分工作日、周末、节假日三类汇总。',
  '其他': '该统计项为补充性统计字段，计算口径以字段说明为准。',
  '自定义': '该统计项为用户自定义字段，支持配置外部数据来源和辅助公式。',
};

// ─── Mock Data ────────────────────────────────
const INIT_ITEMS: StatItem[] = [
  { id:1,  name:'员工姓名',             module:'基础考勤', category:'人事基础', desc:'员工的实际姓名',                           enabled:true,  hasFormula:false, dataType:'文本型', isCustom:false },
  { id:2,  name:'员工工号',             module:'基础考勤', category:'人事基础', desc:'员工唯一标识工号',                         enabled:true,  hasFormula:false, dataType:'文本型', isCustom:false },
  { id:3,  name:'部门',                 module:'基础考勤', category:'人事基础', desc:'员工所属部门名称',                         enabled:true,  hasFormula:false, dataType:'文本型', isCustom:false },
  { id:4,  name:'岗位',                 module:'基础考勤', category:'人事基础', desc:'员工当前岗位信息',                         enabled:true,  hasFormula:false, dataType:'文本型', isCustom:false },
  { id:5,  name:'入职日期',             module:'基础考勤', category:'人事基础', desc:'员工入职日期',                             enabled:true,  hasFormula:false, dataType:'日期型', isCustom:false },
  { id:6,  name:'上班打卡时间',         module:'基础考勤', category:'打卡信息', desc:'当日第一次上班打卡的具体时间',             enabled:true,  hasFormula:false, dataType:'文本型', isCustom:false },
  { id:7,  name:'下班打卡时间',         module:'基础考勤', category:'打卡信息', desc:'当日最后一次下班打卡的具体时间',           enabled:true,  hasFormula:false, dataType:'文本型', isCustom:false },
  { id:8,  name:'打卡地点',             module:'基础考勤', category:'打卡信息', desc:'打卡时的GPS定位或Wi-Fi位置信息',           enabled:false, hasFormula:false, dataType:'文本型', isCustom:false },
  { id:9,  name:'打卡设备',             module:'基础考勤', category:'打卡信息', desc:'打卡所使用的设备类型信息',                 enabled:false, hasFormula:false, dataType:'文本型', isCustom:false },
  { id:10, name:'应出勤天数',           module:'基础考勤', category:'考勤基础', desc:'当月根据排班应出勤的总天数',               enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:11, name:'实际出勤天数',         module:'基础考勤', category:'考勤基础', desc:'当月实际签到出勤的天数',                   enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:12, name:'旷工天数',             module:'薪资核算', category:'考勤基础', desc:'当月无故缺勤的天数',                       enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:13, name:'迟到次数',             module:'基础考勤', category:'考勤基础', desc:'当月迟到的总次数',                         enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:14, name:'迟到时长(分钟)',       module:'薪资核算', category:'考勤基础', desc:'当月迟到累计时长，单位分钟',               enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:15, name:'早退次数',             module:'基础考勤', category:'考勤基础', desc:'当月早退的总次数',                         enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:16, name:'早退时长(分钟)',       module:'薪资核算', category:'考勤基础', desc:'当月早退累计时长，单位分钟',               enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:17, name:'正班时长(小时)',       module:'薪资核算', category:'考勤基础', desc:'当月正常班次累计工时，单位小时',           enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:18, name:'年假天数',             module:'薪资核算', category:'请假时长', desc:'当月年假申请并获批的天数',                 enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:19, name:'事假天数',             module:'薪资核算', category:'请假时长', desc:'当月事假申请并获批的天数',                 enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:20, name:'病假天数',             module:'薪资核算', category:'请假时长', desc:'当月病假申请并获批的天数',                 enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:21, name:'婚假天数',             module:'薪资核算', category:'请假时长', desc:'当月婚假申请并获批的天数',                 enabled:false, hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:22, name:'产假天数',             module:'薪资核算', category:'请假时长', desc:'当月产假申请并获批的天数',                 enabled:false, hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:23, name:'工作日加班时长(小时)', module:'薪资核算', category:'加班信息', desc:'当月工作日加班累计时长，单位小时',         enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:24, name:'周末加班时长(小时)',   module:'薪资核算', category:'加班信息', desc:'当月周末加班累计时长，单位小时',           enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:25, name:'节假日加班时长(小时)', module:'薪资核算', category:'加班信息', desc:'当月节假日加班累计时长，单位小时',         enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:26, name:'出差天数',             module:'基础考勤', category:'其他',     desc:'当月出差申请并获批的天数',                 enabled:true,  hasFormula:true,  dataType:'数值型', isCustom:false },
  { id:27, name:'外勤次数',             module:'基础考勤', category:'其他',     desc:'当月外勤申请并获批的次数',                 enabled:true,  hasFormula:false, dataType:'数值型', isCustom:false },
  { id:28, name:'项目津贴工时',         module:'薪资核算', category:'自定义',   desc:'项目组特殊津贴工时统计（外部数据支持）',   enabled:true,  hasFormula:false, dataType:'数值型', isCustom:true  },
];

// ─── Helpers ─────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

const pBtn = (colors: any): React.CSSProperties => ({ padding: '5px 14px', fontSize: '12px', border: 'none', borderRadius: 4, cursor: 'pointer', backgroundColor: colors.primary, color: '#fff', whiteSpace: 'nowrap' });
const oBtn = (colors: any, active?: boolean): React.CSSProperties => ({ padding: '5px 12px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 4, cursor: 'pointer', backgroundColor: 'transparent', color: active ? colors.primary : colors.text, whiteSpace: 'nowrap' });
const thS  = (colors: any): React.CSSProperties => ({ padding: '8px 10px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, backgroundColor: colors.tableHeaderBg, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 20 });
const tdS  = (colors: any): React.CSSProperties => ({ padding: '7px 10px', fontSize: '12px', color: colors.text });
const pgS  = (colors: any, active: boolean): React.CSSProperties => ({ minWidth: 24, height: 24, padding: '0 5px', fontSize: '12px', border: `1px solid ${active ? colors.primary : colors.inputBorder}`, borderRadius: 4, backgroundColor: active ? colors.primary : 'transparent', color: active ? '#fff' : colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const inS  = (colors: any, full?: boolean): React.CSSProperties => ({ padding: '6px 10px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none', width: full ? '100%' : undefined });
const lbS  = (colors: any): React.CSSProperties => ({ fontSize: '12px', color: colors.text, width: 100, flexShrink: 0, textAlign: 'right' });

// ─── Toggle Switch ────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <div onClick={e => { e.stopPropagation(); onChange(); }}
      style={{ width: 34, height: 18, borderRadius: 9, backgroundColor: checked ? colors.primary : colors.inputBorder, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}/>
    </div>
  );
}

// ─── Inline Select ────────────────────────────
function InlineSelect({ options, value, onChange, colors, width }: { options: string[]; value: string; onChange: (v: string) => void; colors: any; width?: number }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inS(colors), width: width, flex: width ? undefined : 1 }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

// ─── Form Row ─────────────────────────────────
function FormRow({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={lbS(colors)}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────
function SectionCard({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.divider}`, backgroundColor: colors.tableHeaderBg }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{title}</span>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  );
}

// ─── Edit Page ────────────────────────────────
function EditPage({ mode, item, colors, onBack, onSave }: {
  mode: EditMode;
  item: StatItem | null;
  colors: any;
  onBack: () => void;
  onSave: (next: Omit<StatItem, 'id'> & { id?: number }) => Promise<void>;
}) {

  const [name, setName]               = useState(item?.name ?? '');
  const [module, setModule]           = useState(item?.module ?? '基础考勤');
  const [dataType, setDataType]       = useState(item?.dataType ?? '数值型');
  const [defaultVal, setDefaultVal]   = useState('0');
  const [statResult, setStatResult]   = useState('求和');
  const [unit, setUnit]               = useState('');
  const [decimal, setDecimal]         = useState(2);
  const [roundMode, setRoundMode]     = useState('四舍五入');
  const [userDesc, setUserDesc]       = useState(item?.desc ?? '');
  const [enableExt, setEnableExt]     = useState(false);
  const [formulas, setFormulas]       = useState<Formula[]>([]);
  const category = item?.category ?? '自定义';
  const sysDesc = SYSTEM_DESCS[category] ?? SYSTEM_DESCS['自定义'];
  const isNum = dataType === '数值型';

  const addFormula = () => setFormulas(p => [...p, { id: Date.now(), name: '', expr: '' }]);
  const delFormula = (id: number) => setFormulas(p => p.filter(f => f.id !== id));
  const updateFormula = (id: number, field: 'name' | 'expr', val: string) =>
    setFormulas(p => p.map(f => f.id === id ? { ...f, [field]: val } : f));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      window.alert('请先填写统计项名称');
      return;
    }

    const payload: Omit<StatItem, 'id'> & { id?: number } = {
      id: item?.id,
      name: trimmedName,
      module,
      category,
      desc: userDesc.trim() || `自定义统计项：${trimmedName}`,
      enabled: item?.enabled ?? true,
      hasFormula: formulas.some(f => f.name.trim() || f.expr.trim()),
      dataType,
      isCustom: item?.isCustom ?? true,
    };

    try {
      setSaving(true);
      await onSave(payload);
      onBack();
    } catch (_error) {
      window.alert('保存失败，请检查后端服务');
    } finally {
      setSaving(false);
    }
  };

  return (

    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textMuted, fontSize: '12px' }}>
          <ArrowLeft size={14}/> 返回
        </button>
        <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
          {mode === 'add' ? '新增自定义项' : `编辑统计项 · ${item?.name}`}
        </span>
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* 基本信息 */}
        <SectionCard title="基本信息" colors={colors}>
          <FormRow label="统计项名称 *" colors={colors}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="请输入统计项名称" style={{ ...inS(colors, true), maxWidth: 400 }}/>
          </FormRow>
          <FormRow label="应用模块 *" colors={colors}>
            <InlineSelect options={MODULES} value={module} onChange={setModule} colors={colors} width={200}/>
          </FormRow>
          <FormRow label="数据类型 *" colors={colors}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {DATA_TYPES.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.text }}>
                  <input type="radio" name="dataType" value={t} checked={dataType === t} onChange={() => setDataType(t)} style={{ accentColor: colors.primary }}/>{t}
                </label>
              ))}
            </div>
          </FormRow>
          <FormRow label="默认值" colors={colors}>
            <input value={defaultVal} onChange={e => setDefaultVal(e.target.value)} style={{ ...inS(colors), width: 160 }}/>
          </FormRow>
          <FormRow label="统计结果" colors={colors}>
            <InlineSelect options={RESULT_TYPES} value={statResult} onChange={setStatResult} colors={colors} width={160}/>
          </FormRow>
          {isNum && <>
            <FormRow label="单位" colors={colors}>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="如：小时、天、次" style={{ ...inS(colors), width: 160 }}/>
            </FormRow>
            <FormRow label="小数位位数" colors={colors}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={0} max={8} value={decimal} onChange={e => setDecimal(Number(e.target.value))} style={{ ...inS(colors), width: 80 }}/>
                <span style={{ fontSize: '12px', color: colors.textMuted }}>位（0–8）</span>
              </div>
            </FormRow>
            <FormRow label="舍入方式" colors={colors}>
              <InlineSelect options={ROUND_MODES} value={roundMode} onChange={setRoundMode} colors={colors} width={160}/>
            </FormRow>
          </>}
          <FormRow label="统计项说明" colors={colors}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 12px', backgroundColor: colors.statCardBg, borderRadius: 6, border: `1px solid ${colors.cardBorder}` }}>
              <Info size={13} style={{ color: colors.textMuted, flexShrink: 0, marginTop: 1 }}/>
              <span style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6 }}>{sysDesc}</span>
            </div>
          </FormRow>
          <FormRow label="说明" colors={colors}>
            <div style={{ position: 'relative' }}>
              <textarea value={userDesc} onChange={e => setUserDesc(e.target.value.slice(0, 500))} rows={3} placeholder="可补充业务说明（最多500字）"
                style={{ ...inS(colors, true), resize: 'vertical', lineHeight: 1.6, maxWidth: 500, display: 'block' }}/>
              <span style={{ position: 'absolute', bottom: 6, right: 8, fontSize: '11px', color: colors.textMuted }}>{userDesc.length}/500</span>
            </div>
          </FormRow>
          {mode === 'add' && (
            <FormRow label="外部数据" colors={colors}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle checked={enableExt} onChange={() => setEnableExt(v => !v)}/>
                <span style={{ fontSize: '12px', color: colors.textMuted }}>开启后可通过外部数据管理写入该统计项的数值</span>
              </div>
            </FormRow>
          )}
        </SectionCard>

        {/* 计算公式 */}
        <SectionCard title="计算公式" colors={colors}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '10px 14px', backgroundColor: colors.statCardBg, borderRadius: 6, border: `1px solid ${colors.cardBorder}`, marginBottom: 4 }}>
            <Info size={13} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }}/>
            <span style={{ fontSize: '12px', color: colors.textMuted, lineHeight: 1.6 }}>
              辅助公式用于辅助主统计项计算，可添加多条。每条辅助公式可引用其他已启用的统计项，系统将按顺序依次计算，最终结果写入本统计项。
            </span>
          </div>
          {formulas.map((f, i) => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', backgroundColor: colors.statCardBg, borderRadius: 6, border: `1px solid ${colors.cardBorder}` }}>
              <span style={{ fontSize: '12px', color: colors.textMuted, width: 60, flexShrink: 0, paddingTop: 6 }}>辅助公式 {i + 1}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={f.name} onChange={e => updateFormula(f.id, 'name', e.target.value)} placeholder="公式名称" style={{ ...inS(colors, true) }}/>
                <textarea value={f.expr} onChange={e => updateFormula(f.id, 'expr', e.target.value)} placeholder="公式表达式，例：[应出勤天数] - [旷工天数]" rows={2}
                  style={{ ...inS(colors, true), resize: 'vertical', lineHeight: 1.6 }}/>
              </div>
              <button onClick={() => delFormula(f.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', paddingTop: 4 }}><Trash2 size={14}/></button>
            </div>
          ))}
          <button onClick={addFormula} style={{ ...oBtn(colors), display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <Plus size={12}/>添加辅助公式
          </button>
        </SectionCard>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} disabled={saving} style={oBtn(colors)}>取消</button>
        <button onClick={handleSave} disabled={saving} style={{ ...pBtn(colors), opacity: saving ? 0.72 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

    </div>
  );
}

// ─── Delete Confirm ───────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel, colors }: { name: string; onConfirm: () => void; onCancel: () => void; colors: any }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 10, padding: 28, width: 340, boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: 10 }}>删除统计项</p>
        <p style={{ fontSize: '13px', color: colors.textMuted, lineHeight: 1.6, marginBottom: 22 }}>
          确认删除统计项「<strong>{name}</strong>」？删除后该项将从所有引用场景中移除，此操作不可恢复。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={oBtn(colors)}>取消</button>
          <button onClick={onConfirm} style={{ ...pBtn(colors), backgroundColor: '#DC2626' }}>删除</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main List Page ───────────────────────────
export default function StatItemsManagement() {
  const { colors } = useTheme();
  const [view, setView]           = useState<View>('list');
  const [editMode, setEditMode]   = useState<EditMode>('add');
  const [editItem, setEditItem]   = useState<StatItem | null>(null);
  const [items, setItems]         = useState<StatItem[]>(INIT_ITEMS);
  const [scope, setScope]         = useState(SCOPES[0]);
  const [nameSearch, setNameSearch] = useState('');
  const [category, setCategory]   = useState('全部');
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [onlyFormula, setOnlyFormula] = useState(false);
  const [sortKey, setSortKey]     = useState<string | null>(null);
  const [sortDir, setSortDir]     = useState<'asc' | 'desc' | null>(null);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(20);
  const [jumpPage, setJumpPage]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StatItem | null>(null);
  const [sourceFile, setSourceFile] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadStatItems = useCallback(async () => {
    try {
      const res = await fetchStatItems();
      if (res.rows && res.rows.length > 0) {
        setItems(res.rows);
      } else {
        setItems(INIT_ITEMS);
        setLoadError('统计项接口返回空数据，当前保留系统默认配置');
      }
      setSourceFile(res.sourceFile || '');
      if (res.rows && res.rows.length > 0) setLoadError('');
    } catch (_error) {
      setLoadError('真实统计项连接失败，当前展示静态配置');
    }
  }, []);

  useEffect(() => {
    loadStatItems();
  }, [loadStatItems]);

  const openEdit = (item: StatItem) => { setEditItem(item); setEditMode('edit'); setView('edit'); };
  const openAdd = () => { setEditItem(null); setEditMode('add'); setView('edit'); };

  const persistStatItems = useCallback(async (nextItems: StatItem[]) => {
    const saved = await saveStatItems(nextItems);
    setSourceFile(saved.sourceFile || '本地持久化数据 data-store.json');
    setLoadError('');
  }, []);

  const handleEditSave = useCallback(async (next: Omit<StatItem, 'id'> & { id?: number }) => {
    let nextItems: StatItem[] = [];

    setItems(current => {
      nextItems = next.id
        ? current.map(item => item.id === next.id ? { ...item, ...next, id: next.id } : item)
        : [{ ...next, id: Math.max(0, ...current.map(item => item.id)) + 1 }, ...current];
      return nextItems;
    });

    await persistStatItems(nextItems);
  }, [persistStatItems]);


  const toggleEnabled = (id: number) => {
    setItems(current => {
      const nextItems = current.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item);
      persistStatItems(nextItems).catch(() => {
        setLoadError('统计项保存失败，请检查后端服务');
      });
      return nextItems;
    });
  };

  const deleteItem = (id: number) => {
    setItems(current => {
      const nextItems = current.filter(item => item.id !== id);
      persistStatItems(nextItems).catch(() => {
        setLoadError('统计项保存失败，请检查后端服务');
      });
      return nextItems;
    });
    setDeleteTarget(null);
  };


  const filtered = items.filter(i => {
    if (category !== '全部' && i.category !== category) return false;
    if (nameSearch && !i.name.includes(nameSearch)) return false;
    if (onlyEnabled && !i.enabled) return false;
    if (onlyFormula && !i.hasFormula) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = (a as any)[sortKey], bv = (b as any)[sortKey];
    return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
  });

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const getPages = (): (number | '...')[] =>
    totalPages <= 7 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [1, 2, 3, '...', totalPages];

  if (view === 'edit') {
    return (
      <EditPage
        mode={editMode}
        item={editItem}
        colors={colors}
        onSave={handleEditSave}
        onBack={() => setView('list')}
      />
    );
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>

      {/* ── Filter bar ───────────────────── */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* 日/月考勤范围切换 */}
          <div style={{ display: 'flex', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
            {SCOPES.map(s => (
              <button key={s} onClick={() => setScope(s)}
                style={{ padding: '5px 10px', fontSize: '12px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: scope === s ? colors.primary : 'transparent', color: scope === s ? '#fff' : colors.text }}>{s}</button>
            ))}
          </div>
          {/* 统计项名称搜索 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.inputBorder}`, borderRadius: 4, padding: '5px 10px', backgroundColor: colors.inputBg, minWidth: 200 }}>
            <Search size={12} style={{ color: colors.textMuted }}/>
            <input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder="搜索统计项名称"
              style={{ border: 'none', outline: 'none', fontSize: '12px', background: 'transparent', color: colors.text, flex: 1 }}/>
            {nameSearch && <X size={11} style={{ color: colors.textMuted, cursor: 'pointer' }} onClick={() => setNameSearch('')}/>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => { setNameSearch(''); setScope(SCOPES[0]); }} style={oBtn(colors)}>重置</button>
            <button style={pBtn(colors)}>查询</button>
          </div>
        </div>
      </div>

      {(sourceFile || loadError) && (
        <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 6, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', flexShrink: 0 }}>
          {sourceFile ? `已连接真实数据源：${sourceFile}` : ''}
          {loadError ? ` ${loadError}` : ''}
        </div>
      )}

      {/* ── Action bar ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={openAdd} style={{ ...pBtn(colors), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12}/>新增自定义项</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={onlyEnabled} onChange={e => setOnlyEnabled(e.target.checked)} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>仅显示启用统计项
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={onlyFormula} onChange={e => setOnlyFormula(e.target.checked)} style={{ accentColor: colors.primary, width: 13, height: 13 }}/>仅看有业务公式项
          </label>
        </div>
      </div>

      {/* ── Category tabs ────────────────── */}
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', flexShrink: 0, overflowX: 'auto' }}>
        {CATEGORIES.map(cat => {
          const count = cat === '全部' ? items.length : items.filter(i => i.category === cat).length;
          const active = category === cat;
          return (
            <button key={cat} onClick={() => { setCategory(cat); setPage(1); }}
              style={{ padding: '10px 14px', fontSize: '12px', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', color: active ? colors.primary : colors.textMuted, fontWeight: active ? 600 : 400, borderBottom: `2px solid ${active ? colors.primary : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 5 }}>
              {cat}
              <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: 9, backgroundColor: active ? colors.primary : colors.badgeGrayBg, color: active ? '#fff' : colors.badgeGrayText }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Table ─────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              {[
                { key: 'name',       label: '统计项名称', width: 180 },
                { key: 'module',     label: '应用模块',   width: 100 },
                { key: 'category',   label: '分类',       width: 90 },
                { key: 'desc',       label: '说明',       width: 280 },
                { key: 'enabled',    label: '是否启用',   width: 80 },
              ].map(col => (
                <th key={col.key} onClick={() => { setSortKey(col.key); setSortDir(d => sortKey === col.key ? (d === 'asc' ? 'desc' : null) : 'asc'); }}
                  style={{ ...thS(colors), width: col.width, minWidth: col.width, cursor: 'pointer', borderLeft: col.key !== 'name' ? `1px solid ${colors.tableBorder}` : undefined }}>{col.label}</th>
              ))}
              <th style={{ ...thS(colors), width: 100, textAlign: 'center', borderLeft: `1px solid ${colors.tableBorder}` }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '56px 0', color: colors.textMuted, fontSize: '13px' }}>暂无统计项数据</td></tr>
            ) : pageRows.map((item, ri) => (
              <tr key={item.id}
                style={{ backgroundColor: ri % 2 === 0 ? colors.cardBg : colors.tableStripe, borderBottom: `1px solid ${colors.tableBorder}` }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.tableRowHover)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? colors.cardBg : colors.tableStripe)}>
                <td style={{ ...tdS(colors), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: colors.primary, cursor: 'pointer', fontWeight: 500 }} onClick={() => openEdit(item)}>{item.name}</span>
                  {item.isCustom && <span style={{ fontSize: '10px', backgroundColor: colors.badgeBlueBg, color: colors.badgeBlueText, borderRadius: 3, padding: '1px 5px', marginLeft: 6 }}>自定义</span>}
                  {item.hasFormula && <span style={{ fontSize: '10px', backgroundColor: colors.badgeGreenBg, color: colors.badgeGreenText, borderRadius: 3, padding: '1px 5px', marginLeft: 4 }}>有公式</span>}
                </td>
                <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, fontSize: '11px', color: colors.textMuted }}>{item.module}</td>
                <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}` }}>
                  <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: 9, backgroundColor: colors.badgeGrayBg, color: colors.badgeGrayText }}>{item.category}</span>
                </td>
                <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textMuted, fontSize: '11px' }} title={item.desc}>{item.desc}</td>
                <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, textAlign: 'center' }}>
                  <Toggle checked={item.enabled} onChange={() => toggleEnabled(item.id)}/>
                </td>
                <td style={{ ...tdS(colors), borderLeft: `1px solid ${colors.tableBorder}`, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button onClick={() => openEdit(item)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '11px', color: colors.primary, border: 'none', background: 'transparent', cursor: 'pointer' }}><Edit2 size={11}/>编辑</button>
                    {item.isCustom && <button onClick={() => setDeleteTarget(item)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '11px', color: '#DC2626', border: 'none', background: 'transparent', cursor: 'pointer' }}><Trash2 size={11}/>删除</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Bottom bar ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', backgroundColor: colors.cardBg, borderTop: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted }}>共{totalCount}项</span>
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={12}/></button>
        {getPages().map((p, i) =>
          p === '...' ? <span key={`e${i}`} style={{ fontSize: '12px', color: colors.textMuted }}>...</span>
            : <button key={p} style={pgS(colors, page === p)} onClick={() => setPage(p as number)}>{p}</button>
        )}
        <button style={pgS(colors, false)} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={12}/></button>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ padding: '3px 6px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, outline: 'none' }}>
          {[20, 50, 100].map(n => <option key={n} value={n}>{n}条/页</option>)}
        </select>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>跳至</span>
        <input value={jumpPage} onChange={e => setJumpPage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const p = parseInt(jumpPage); if (!isNaN(p)) setPage(Math.max(1, Math.min(totalPages, p))); setJumpPage(''); }}}
          style={{ width: 36, padding: '3px 4px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, color: colors.text, textAlign: 'center', outline: 'none' }}/>
        <span style={{ fontSize: '12px', color: colors.textMuted }}>页</span>
      </div>

      {deleteTarget && <DeleteConfirm name={deleteTarget.name} onConfirm={() => deleteItem(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} colors={colors}/>}
    </div>
  );
}
