'use client';

export default function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        borderRadius: '999px',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: 600,
        background: '#0f172a',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Print Receipt
    </button>
  );
}