import React from 'react';
import { X } from 'lucide-react';

type ConfirmDialogProps = {
  colors: any;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  colors,
  title,
  message,
  confirmLabel = '删除',
  cancelLabel = '取消',
  danger = true,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 980,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.38)',
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: 'calc(100vw - 48px)',
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 8,
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.24)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            minHeight: 52,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderBottom: `1px solid ${colors.cardBorder}`,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>
          <button type="button" onClick={onCancel} disabled={loading} style={iconButton(colors)} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '18px 18px 20px', fontSize: 13, lineHeight: 1.7, color: colors.text }}>
          {message}
        </div>
        <div
          style={{
            padding: '12px 18px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            borderTop: `1px solid ${colors.cardBorder}`,
            backgroundColor: colors.cardBg,
          }}
        >
          <button type="button" onClick={onCancel} disabled={loading} style={outlineButton(colors)}>{cancelLabel}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              ...primaryButton(colors),
              backgroundColor: danger ? '#DC2626' : colors.primary,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function iconButton(colors: any): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
  };
}

function outlineButton(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.text,
    fontSize: 12,
    cursor: 'pointer',
  };
}

function primaryButton(colors: any): React.CSSProperties {
  return {
    height: 30,
    padding: '0 14px',
    border: 'none',
    borderRadius: 4,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
  };
}
