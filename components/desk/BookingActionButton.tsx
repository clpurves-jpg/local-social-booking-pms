'use client';

import { useState, useTransition } from 'react';

type Props = {
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  action: () => Promise<void>;
  tone?: 'green' | 'blue' | 'amber' | 'red';
};

function getButtonStyle(tone: Props['tone']): React.CSSProperties {
  switch (tone) {
    case 'blue':
      return {
        background: '#2563eb',
        color: '#ffffff',
      };
    case 'amber':
      return {
        background: '#b45309',
        color: '#ffffff',
      };
    case 'red':
      return {
        background: '#ffffff',
        color: '#dc2626',
        border: '1px solid #fecaca',
      };
    case 'green':
    default:
      return {
        background: '#059669',
        color: '#ffffff',
      };
  }
}

export default function BookingActionButton({
  label,
  confirmTitle,
  confirmMessage,
  action,
  tone = 'green',
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const buttonStyle = getButtonStyle(tone);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        style={{
          width: '100%',
          borderRadius: '12px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: 600,
          border: buttonStyle.border ?? 'none',
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.7 : 1,
          ...buttonStyle,
        }}
      >
        {isPending ? 'Working...' : label}
      </button>

      {open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
              padding: '24px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {confirmTitle}
            </h3>

            <p
              style={{
                marginTop: '12px',
                marginBottom: 0,
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#475569',
              }}
            >
              {confirmMessage}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '22px',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                style={{
                  borderRadius: '12px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await action();
                  });
                }}
                style={{
                  borderRadius: '12px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: buttonStyle.border ?? 'none',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  ...buttonStyle,
                }}
              >
                {isPending ? 'Working...' : label}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}