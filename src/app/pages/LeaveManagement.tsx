import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  Search,
  Settings2,
  Users,
} from 'lucide-react';

type LeaveView = 'record' | 'balance' | 'detail' | 'type' | 'scheme';
type MenuItem = { label: string; hint?: string };
type TabConfig = { key: LeaveView; label: string; path: string };

function showActionFeedback(action: string) {
  window.alert(`假期管理：${action}（交互已接通）`);
}

const ROUTE_TABS: TabConfig[] = [
  { key: 'record', label: '请假记录', path: '/attendance/leave' },
  { key: 'balance', label: '假期余额', path: '/attendance/leave-balance' },
  { key: 'detail', label: '假期额度明细', path: '/attendance/leave-detail' },
  { key: 'type', label: '假期类型设置', path: '/attendance/leave-type' },
  { key: 'scheme', label: '假期方案设置', path: '/attendance/leave-scheme' },
];

const LEAVE_RECORD_COLUMNS = ['记录状态', '申请人', '申请人员工号', '申请人部门', '部门全路径', '发起人', '发起人员工号', '发起类型', '假期类型', '开始时间', '结束时间', '请假时长', '请假事由', '发起时间', '完成时间', '当前流程状态', '操作'];
const LEAVE_BALANCE_COLUMNS = ['姓名', '员工号', '部门', '部门全路径', '入职日期', '剩余年假（天）', '剩余病假（天）', '剩余婚假（天）', '剩余陪产假（天）', '剩余产假（天）', '剩余丧假（天）', '剩余事假（天）'];
const LEAVE_DETAIL_COLUMNS = ['姓名', '员工号', '部门', '部门全路径', '入职日期', '周期', '假期类型', '应休额度', '已发额度', '已激活额度', '调整额度', '冻结额度', '已用额度', '剩余额度', '周期开始日期', '周期截止日期', '有效期开启日期', '操作'];
const LEAVE_TYPE_COLUMNS = ['排序', '假期类型名称', '假期类型简称', '假期启用', '请假单位', '是否带薪', '余额可为负', '休假前额说明', '显示假期说明', '每假事由必填', '附件必传', '附件说明', '创建人', '创建时间', '修改人', '修改时间', '操作'];
const LEAVE_SCHEME_COLUMNS = ['方案名称', '假期类型', '请假控制规则', '额度控制', '适用范围', '假期优先级', '创建人', '创建时间', '修改人', '修改时间', '操作'];

const START_LEAVE_ITEMS: MenuItem[] = [
  { label: '发起单条' },
  { label: '发起多条' },
  { label: '批量请假', hint: '适用于多人连续请假' },
];

const BALANCE_GRANT_ITEMS: MenuItem[] = [
  { label: '按规则发放' },
  { label: '手动补发' },
  { label: '批量导入发放' },
];

const DETAIL_MORE_ITEMS: MenuItem[] = [
  { label: '批量启用额度' },
  { label: '批量冻结额度' },
  { label: '导出本页数据' },
];

const TYPE_ROWS = [
  { name: '年假', short: '年', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '否', note: '年假额度可根据员工司龄自动发放，支持跨周期结转。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:17' },
  { name: '病假', short: '病', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '病假需员工上传病历或就诊凭证，系统支持按天或小时折算。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:08' },
  { name: '短期病假', short: '病', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '是', note: '用于短时病假审批，计算时自动计入累计病假时长。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:28' },
  { name: '婚假', short: '婚', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '否', note: '婚假按法定或公司规定执行，支持一次性发放。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:22' },
  { name: '产假', short: '产', enabled: true, unit: '按天请假', paid: '是', negative: '否', before: '是', note: '产假支持前置请假及分段休假，系统可自动关联哺乳假规则。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:27' },
  { name: '陪产假', short: '陪', enabled: true, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '男员工生育相关陪护假，审批时需同步提交证明材料。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:32' },
  { name: '调休假', short: '调', enabled: true, unit: '按小时请假', paid: '否', negative: '否', before: '否', note: '加班转调休产生的额度，优先消耗近期生成的调休额度。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:54' },
  { name: '补偿假', short: '补', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '特殊奖励或项目补贴类假期，默认关闭，由管理员按需启用。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:43' },
  { name: '流产假', short: '流', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '女性员工特殊医疗假期，需上传证明后方可申请。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:09:49' },
  { name: '亲友假', short: '亲', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '适用于家属重大事项处理的延伸假期，按公司制度执行。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:05' },
  { name: '非出勤日假', short: '非', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '如涉及非排班日请假需单独配置，请假计算将跳过非排班时段。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:11' },
  { name: '哺乳时间假', short: '哺', enabled: false, unit: '需审批假', paid: '否', negative: '否', before: '否', note: '哺乳期女性员工使用的按次假期，单次时长由规则控制。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:17' },
  { name: '合并哺乳时间', short: '哺', enabled: false, unit: '需审批假', paid: '否', negative: '否', before: '否', note: '支持合并使用多次哺乳时间，系统自动校验每日最大使用量。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:22' },
  { name: '育儿假', short: '育', enabled: false, unit: '按天请假', paid: '否', negative: '否', before: '否', note: '子女三周岁以内员工可享受的地区政策假，支持按次或按年配置。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2026-01-29 19:10:59' },
  { name: '加班调休', short: '补', enabled: false, unit: '按小时请假', paid: '否', negative: '否', before: '否', note: '无法单独控制的日度过账类调休生成申请。', reason: '否', attachment: '否', attachmentNote: '-', creator: '系统', createdAt: '2025-08-26 15:59:58', editor: '系统', editedAt: '2025-08-26 15:59:58' },
];

export default function LeaveManagement() {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRecordMore, setShowRecordMore] = useState(false);
  const [showBalanceMore, setShowBalanceMore] = useState(false);
  const [showDetailMore, setShowDetailMore] = useState(false);
  const [showTypeMore, setShowTypeMore] = useState(false);
  const [showSchemeMore, setShowSchemeMore] = useState(false);
  const [recordMenuOpen, setRecordMenuOpen] = useState(false);
  const [balanceMenuOpen, setBalanceMenuOpen] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);

  const activeTab = useMemo(
    () => ROUTE_TABS.find(tab => tab.path === location.pathname) ?? ROUTE_TABS[0],
    [location.pathname],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.appBg, overflow: 'hidden' }}>
      <div style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4, minHeight: 40, flexShrink: 0 }}>
        <TopTab label="首页" active={false} onClick={() => navigate('/attendance/home')} colors={colors} />
        {ROUTE_TABS.map(tab => (
          <TopTab key={tab.key} label={tab.label} active={activeTab.key === tab.key} onClick={() => navigate(tab.path)} colors={colors} />
        ))}
        <button style={{ marginLeft: 4, padding: '2px 10px', fontSize: '12px', border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: 'default', background: 'transparent', color: colors.textMuted }}>×</button>
      </div>

      {activeTab.key === 'record' && (
        <LeaveRecordView
          colors={colors}
          showMore={showRecordMore}
          onToggleMore={() => setShowRecordMore(prev => !prev)}
          menuOpen={recordMenuOpen}
          onToggleMenu={() => setRecordMenuOpen(prev => !prev)}
          onCloseMenu={() => setRecordMenuOpen(false)}
        />
      )}
      {activeTab.key === 'balance' && (
        <LeaveBalanceView
          colors={colors}
          showMore={showBalanceMore}
          onToggleMore={() => setShowBalanceMore(prev => !prev)}
          menuOpen={balanceMenuOpen}
          onToggleMenu={() => setBalanceMenuOpen(prev => !prev)}
          onCloseMenu={() => setBalanceMenuOpen(false)}
        />
      )}
      {activeTab.key === 'detail' && (
        <LeaveDetailView
          colors={colors}
          showMore={showDetailMore}
          onToggleMore={() => setShowDetailMore(prev => !prev)}
          menuOpen={detailMenuOpen}
          onToggleMenu={() => setDetailMenuOpen(prev => !prev)}
          onCloseMenu={() => setDetailMenuOpen(false)}
        />
      )}
      {activeTab.key === 'type' && (
        <LeaveTypeView
          colors={colors}
          showMore={showTypeMore}
          onToggleMore={() => setShowTypeMore(prev => !prev)}
        />
      )}
      {activeTab.key === 'scheme' && (
        <LeaveSchemeView
          colors={colors}
          showMore={showSchemeMore}
          onToggleMore={() => setShowSchemeMore(prev => !prev)}
        />
      )}
    </div>
  );
}

function LeaveRecordView({
  colors,
  showMore,
  onToggleMore,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '如果需要调整请假模版，可到 假期管理-假期类型设置 中修改。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <DateRangeField label="请假日期" colors={colors} required width={248} />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={154} />
          <SearchField label="申请人" placeholder="请输入或选择人员" colors={colors} width={182} showUserIcon />
          <SearchField label="发起人" placeholder="请输入或选择员工号" colors={colors} width={182} showUserIcon />
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={154} />
          <div style={actionRightStyle}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="发起类型" placeholder="全部" colors={colors} width={148} />
            <SelectField label="记录状态" placeholder="全部" colors={colors} width={148} />
            <SelectField label="当前流程状态" placeholder="全部" colors={colors} width={148} />
            <DateRangeField label="发起时间" colors={colors} width={248} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={() => showActionFeedback('添加请假记录')} style={primaryBtn(colors)}>添加请假记录</button>
        <DropdownButton label="发起请假流程" items={START_LEAVE_ITEMS} open={menuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onSelect={(item) => showActionFeedback(item.label)} colors={colors} />
        <button onClick={() => showActionFeedback('导出请假记录')} style={outlineBtn(colors)}>导出</button>
        <button onClick={() => showActionFeedback('删除请假记录')} style={outlineBtn(colors)}>删除</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => showActionFeedback('批量清除记录')} style={linkBtn(colors)}>批量清除记录</button>
          <button onClick={() => showActionFeedback('表头设置')} style={iconBtn(colors)}><Settings2 size={12} /></button>
        </div>
      </div>

      <TableShell columns={LEAVE_RECORD_COLUMNS} colors={colors} emptyText="暂无内容" />
    </>
  );
}

function LeaveBalanceView({
  colors,
  showMore,
  onToggleMore,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '新入职员工自假期生效日第二天起，按授权周期规则计算员工应休假次数。',
          '如需修改【入职日期】请至 员工信息 进行设置。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SelectField label="部门" placeholder="请选择" colors={colors} width={154} />
          <SearchField label="员工" placeholder="请输入或选择人员" colors={colors} width={182} showUserIcon />
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={154} />
          <DateRangeField label="入职日期" colors={colors} width={248} />
          <SelectField label="授权周期" placeholder="自然年" colors={colors} width={140} />
          <div style={actionRightStyle}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="员工状态" placeholder="在职" colors={colors} width={138} />
            <SelectField label="发放状态" placeholder="全部" colors={colors} width={138} />
            <DateRangeField label="额度生效日期" colors={colors} width={250} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <DropdownButton label="发放假期额度" items={BALANCE_GRANT_ITEMS} open={menuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onSelect={(item) => showActionFeedback(item.label)} colors={colors} />
        <button onClick={() => showActionFeedback('导出假期余额')} style={outlineBtn(colors)}>导出</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => showActionFeedback('使用指引')} style={linkBtn(colors)}>使用指引</button>
          <button onClick={() => showActionFeedback('表头设置')} style={iconBtn(colors)}><Settings2 size={12} /></button>
        </div>
      </div>

      <TableShell columns={LEAVE_BALANCE_COLUMNS} colors={colors} emptyText="暂无内容" />
    </>
  );
}

function LeaveDetailView({
  colors,
  showMore,
  onToggleMore,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '暂存至假期视图影响假期结转，请谨慎进行历史额度维护。',
          '入职日期、假期开始日期、首次工作日请确保配置准确，请到 员工信息 中修改。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={154} />
          <SelectField label="周期" placeholder="请选择周期" colors={colors} width={154} />
          <SearchField label="员工" placeholder="请输入或选择人员" colors={colors} width={182} showUserIcon />
          <SelectField label="部门" placeholder="请选择" colors={colors} width={154} />
          <CheckboxGroup label="员工状态" items={['在职', '离职', '冻结员工']} colors={colors} />
          <div style={actionRightStyle}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <DateRangeField label="有效期开启日期" colors={colors} width={250} />
            <DateRangeField label="周期截止日期" colors={colors} width={250} />
            <SelectField label="额度状态" placeholder="全部" colors={colors} width={148} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={() => showActionFeedback('新增额度记录')} style={primaryBtn(colors)}>新增额度记录</button>
        <button onClick={() => showActionFeedback('导入额度记录')} style={outlineBtn(colors)}>导入</button>
        <button onClick={() => showActionFeedback('导出额度记录')} style={outlineBtn(colors)}>导出</button>
        <DropdownButton label="更多操作" items={DETAIL_MORE_ITEMS} open={menuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onSelect={(item) => showActionFeedback(item.label)} colors={colors} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <TogglePill enabled />
          <span style={{ fontSize: '12px', color: colors.text }}>只看有效数据</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => showActionFeedback('休假过账记录')} style={linkBtn(colors)}>休假过账记录</button>
          <button onClick={() => showActionFeedback('额度调整记录')} style={linkBtn(colors)}>额度调整记录</button>
          <button onClick={() => showActionFeedback('表头设置')} style={iconBtn(colors)}><Settings2 size={12} /></button>
        </div>
      </div>

      <TableShell columns={LEAVE_DETAIL_COLUMNS} colors={colors} emptyText="暂无内容" />
    </>
  );
}

function LeaveTypeView({
  colors,
  showMore,
  onToggleMore,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  return (
    <>
      <InfoBanner
        colors={colors}
        messages={[
          '设置假期单位、带薪和累计方式后，员工在申请假期前需按配置发放余额。',
        ]}
      />

      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SearchField label="假期类型名称" placeholder="请输入" colors={colors} width={200} />
          <SelectField label="是否启用" placeholder="请选择" colors={colors} width={138} />
          <SelectField label="计假单位" placeholder="请选择" colors={colors} width={138} />
          <SelectField label="是否带薪" placeholder="请选择" colors={colors} width={138} />
          <div style={actionRightStyle}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="余额可为负" placeholder="请选择" colors={colors} width={138} />
            <SelectField label="事前可申请" placeholder="请选择" colors={colors} width={138} />
            <SelectField label="附件必传" placeholder="请选择" colors={colors} width={138} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={() => showActionFeedback('新增假期类型')} style={primaryBtn(colors)}>新增假期类型</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => showActionFeedback('使用指引')} style={linkBtn(colors)}>
            <HelpCircle size={12} />
            使用指引
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
              {LEAVE_TYPE_COLUMNS.map(column => (
                <th key={column} style={{ ...th(colors), minWidth: column.length >= 6 ? 136 : 100 }}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPE_ROWS.map((row, index) => (
              <tr key={row.name} style={{ backgroundColor: index % 2 === 0 ? colors.cardBg : colors.tableStripe }}>
                <td style={td(colors)}>☰</td>
                <td style={td(colors)}>{row.name}</td>
                <td style={td(colors)}>{row.short}</td>
                <td style={td(colors)}><TogglePill enabled={row.enabled} /></td>
                <td style={td(colors)}>{row.unit}</td>
                <td style={td(colors)}>{row.paid}</td>
                <td style={td(colors)}>{row.negative}</td>
                <td style={{ ...td(colors), minWidth: 280 }}>{row.note}</td>
                <td style={td(colors)}>{row.before}</td>
                <td style={td(colors)}>{row.reason}</td>
                <td style={td(colors)}>{row.attachment}</td>
                <td style={td(colors)}>{row.attachmentNote}</td>
                <td style={td(colors)}>{row.creator}</td>
                <td style={td(colors)}>{row.createdAt}</td>
                <td style={td(colors)}>{row.editor}</td>
                <td style={td(colors)}>{row.editedAt}</td>
                <td style={td(colors)}>
                  <button onClick={() => showActionFeedback(`修改假期类型：${row.name}`)} style={textActionBtn(colors)}>修改</button>
                  <button onClick={() => showActionFeedback(`删除假期类型：${row.name}`)} style={textActionBtn(colors)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LeaveSchemeView({
  colors,
  showMore,
  onToggleMore,
}: {
  colors: any;
  showMore: boolean;
  onToggleMore: () => void;
}) {
  return (
    <>
      <div style={filterBar(colors)}>
        <div style={filterRowStyle}>
          <SearchField label="方案名称" placeholder="请输入" colors={colors} width={200} />
          <SelectField label="假期类型" placeholder="请选择" colors={colors} width={160} />
          <div style={actionRightStyle}>
            <button style={outlineBtn(colors)}>重置</button>
            <button style={primaryBtn(colors)}>查询</button>
            <button onClick={onToggleMore} style={toggleBtn(colors, showMore)}>
              更多筛选
              {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
        {showMore && (
          <div style={moreRowStyle(colors)}>
            <SelectField label="适用范围" placeholder="全部" colors={colors} width={148} />
            <SelectField label="优先级" placeholder="全部" colors={colors} width={148} />
          </div>
        )}
      </div>

      <div style={toolbarStyle(colors)}>
        <button onClick={() => showActionFeedback('新增假期方案')} style={primaryBtn(colors)}>新增假期方案</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => showActionFeedback('使用指引')} style={linkBtn(colors)}>
            <HelpCircle size={12} />
            使用指引
          </button>
        </div>
      </div>

      <TableShell columns={LEAVE_SCHEME_COLUMNS} colors={colors} emptyText="暂无内容" />
    </>
  );
}

function InfoBanner({ colors, messages }: { colors: any; messages: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 16px', backgroundColor: '#EEF4FF', borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 }}>
      <AlertCircle size={14} style={{ color: '#4677D6', marginTop: 1, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.map((message, index) => (
          <span key={index} style={{ fontSize: '12px', color: '#4E6488' }}>
            {messages.length > 1 ? `${index + 1}. ` : ''}{message}
          </span>
        ))}
      </div>
      <button style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#8AA1C0' }}>×</button>
    </div>
  );
}

function TableShell({ columns, colors, emptyText }: { columns: string[]; colors: any; emptyText: string }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', backgroundColor: colors.cardBg }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: colors.tableHeaderBg, position: 'sticky', top: 0, zIndex: 2 }}>
            <th style={{ ...th(colors), width: 42 }}><input type="checkbox" style={{ accentColor: colors.primary }} /></th>
            {columns.map(column => (
              <th key={column} style={{ ...th(colors), minWidth: column.length >= 6 ? 132 : 108 }}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length + 1} style={{ padding: '96px 0 120px', textAlign: 'center', borderBottom: `1px solid ${colors.tableBorder}` }}>
              <EmptyState colors={colors} text={emptyText} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TopTab({ label, active, onClick, colors }: { label: string; active: boolean; onClick: () => void; colors: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px 9px',
        fontSize: '13px',
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: active ? colors.primary : colors.text,
        borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function DropdownButton({
  label,
  items,
  open,
  onToggle,
  onClose,
  onSelect,
  colors,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
  colors: any;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onToggle} style={{ ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: open ? colors.primary : colors.text, borderColor: open ? colors.primary : colors.inputBorder, backgroundColor: open ? colors.badgeBlueBg : 'transparent' }}>
        {label}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 164, backgroundColor: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 8, boxShadow: '0 12px 28px rgba(34, 48, 78, 0.14)', padding: '6px 0', zIndex: 20 }}>
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '9px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '12px', color: colors.text, borderTop: index === 0 ? 'none' : `1px solid ${colors.divider}33` }}
            >
              <span>{item.label}</span>
              {item.hint ? <span style={{ fontSize: '11px', color: colors.textMuted }}>{item.hint}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DateRangeField({ label, colors, width = 236, required = false }: { label: string; colors: any; width?: number; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>
        {required ? <span style={{ color: colors.primary, marginRight: 2 }}>*</span> : null}
        {label}
      </span>
      <div style={fieldShell(colors, width)}>
        <Calendar size={12} style={{ color: colors.textMuted }} />
        <input type="date" defaultValue="2026-05-01" style={dateInput(colors)} />
        <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
        <input type="date" defaultValue="2026-05-31" style={dateInput(colors)} />
      </div>
    </div>
  );
}

function SearchField({ label, placeholder, colors, width = 170, showUserIcon = false }: { label: string; placeholder: string; colors: any; width?: number; showUserIcon?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <input placeholder={placeholder} style={textInput(colors)} />
        {showUserIcon ? <Users size={12} style={{ color: colors.textMuted }} /> : null}
        <Search size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function SelectField({ label, placeholder, colors, width = 140 }: { label: string; placeholder: string; colors: any; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '12px', color: colors.text, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={fieldShell(colors, width)}>
        <span style={{ fontSize: '12px', color: colors.textMuted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeholder}</span>
        <ChevronDown size={12} style={{ color: colors.textMuted }} />
      </div>
    </div>
  );
}

function CheckboxGroup({ label, items, colors }: { label: string; items: string[]; colors: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '12px', color: colors.text }}>{label}</span>
      {items.map((item, index) => (
        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: colors.textMuted }}>
          <input type="checkbox" defaultChecked={index !== 1} style={{ accentColor: colors.primary }} />
          {item}
        </label>
      ))}
    </div>
  );
}

function TogglePill({ enabled }: { enabled?: boolean }) {
  return (
    <span style={{ width: 24, height: 14, borderRadius: 999, backgroundColor: enabled ? '#3A78FF' : '#C7CEDA', position: 'relative', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', left: enabled ? 12 : 2, top: 2, transition: 'all 0.2s' }} />
    </span>
  );
}

function EmptyState({ colors, text }: { colors: any; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: colors.statCardBg, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <FileText size={24} style={{ color: colors.textMuted }} />
        <span style={{ position: 'absolute', top: -7, right: -6, backgroundColor: '#3A78FF', color: '#fff', borderRadius: 9, fontSize: '10px', lineHeight: 1, padding: '4px 5px', fontWeight: 600 }}>...</span>
      </div>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>{text}</span>
    </div>
  );
}

const filterRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const actionRightStyle: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 };

function moreRowStyle(colors: any): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.divider}` };
}

function filterBar(colors: any): React.CSSProperties {
  return { padding: '12px 16px 10px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0 };
}

function toolbarStyle(colors: any): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.cardBorder}`, flexShrink: 0, position: 'relative' };
}

function fieldShell(colors: any, width: number): React.CSSProperties {
  return { width, minHeight: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: colors.inputBg, boxSizing: 'border-box' };
}

function textInput(colors: any): React.CSSProperties {
  return { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: colors.text };
}

function dateInput(colors: any): React.CSSProperties {
  return { width: 96, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: colors.text };
}

function primaryBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: 'none', borderRadius: 4, backgroundColor: colors.primary, color: '#fff', fontSize: '12px', cursor: 'pointer' };
}

function outlineBtn(colors: any): React.CSSProperties {
  return { height: 30, padding: '0 14px', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.text, fontSize: '12px', cursor: 'pointer' };
}

function toggleBtn(colors: any, active: boolean): React.CSSProperties {
  return { ...outlineBtn(colors), display: 'flex', alignItems: 'center', gap: 4, color: active ? colors.primary : colors.text, borderColor: active ? colors.primary : colors.inputBorder, backgroundColor: active ? colors.badgeBlueBg : 'transparent' };
}

function iconBtn(colors: any): React.CSSProperties {
  return { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.inputBorder}`, borderRadius: 4, backgroundColor: 'transparent', color: colors.textMuted, cursor: 'pointer' };
}

function linkBtn(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
}

function textActionBtn(colors: any): React.CSSProperties {
  return { border: 'none', background: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer', padding: 0, marginRight: 8 };
}

function th(colors: any): React.CSSProperties {
  return { padding: '10px 12px', fontSize: '12px', color: colors.textMuted, fontWeight: 500, textAlign: 'left', borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', backgroundColor: colors.tableHeaderBg };
}

function td(colors: any): React.CSSProperties {
  return { padding: '9px 12px', fontSize: '12px', color: colors.text, borderBottom: `1px solid ${colors.tableBorder}`, whiteSpace: 'nowrap', verticalAlign: 'top' };
}
