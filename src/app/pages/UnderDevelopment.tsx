import React from 'react';
import { useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Wrench, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

const moduleLabels: Record<string, string> = {
  '/': '首页',
  '/tender': '招标管理',
  '/organization': '组织管理',
  '/recruit': '招聘管理',
  '/employee': '员工管理',
  '/payroll': '电子工资单',
  '/apps': '全部应用',
};

const UnderDevelopment: React.FC = () => {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const moduleName = moduleLabels[location.pathname] || '该模块';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.appBg,
        minHeight: '100%',
        padding: '40px 24px',
      }}
    >
      {/* Decorative circle */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        {/* Outer ring */}
        <div
          style={{
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            border: `2px dashed ${colors.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Inner circle */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 24px rgba(0,0,0,0.08)`,
            }}
          >
            <Wrench size={40} color={colors.primary} strokeWidth={1.5} />
          </div>

          {/* Clock badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(170,43,58,0.4)',
            }}
          >
            <Clock size={16} color="#fff" />
          </div>
        </div>
      </div>

      {/* Text content */}
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: colors.badgeRedBg,
            color: colors.primary,
            fontSize: '12px',
            fontWeight: 500,
            padding: '4px 12px',
            borderRadius: '20px',
            marginBottom: '16px',
            border: `1px solid ${colors.primary}22`,
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.primary, display: 'inline-block' }} />
          功能开发中
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: colors.text,
            marginBottom: '12px',
            letterSpacing: '0.02em',
          }}
        >
          {moduleName}
        </h2>

        <p
          style={{
            fontSize: '13px',
            color: colors.textMuted,
            lineHeight: '1.8',
            marginBottom: '32px',
          }}
        >
          该模块正在紧张开发中，即将上线。<br />
          感谢您的耐心等待，敬请期待！
        </p>

        {/* Progress bar decoration */}
        <div
          style={{
            width: '280px',
            margin: '0 auto 32px',
            backgroundColor: colors.cardBorder,
            borderRadius: '4px',
            height: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '60%',
              height: '100%',
              background: `linear-gradient(90deg, ${colors.primary}, #C94D5A)`,
              borderRadius: '4px',
            }}
          />
        </div>

        <button
          onClick={() => navigate('/attendance/stats')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 20px',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '6px',
            fontSize: '13px',
            color: colors.textMuted,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary;
            (e.currentTarget as HTMLButtonElement).style.color = colors.primary;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = colors.cardBorder;
            (e.currentTarget as HTMLButtonElement).style.color = colors.textMuted;
          }}
        >
          <ArrowLeft size={14} />
          返回考勤管理
        </button>
      </div>

      {/* Bottom decoration dots */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '48px' }}>
        {[colors.primary, colors.textMuted, colors.divider].map((color, i) => (
          <div
            key={i}
            style={{
              width: i === 0 ? '24px' : '8px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: color,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default UnderDevelopment;
