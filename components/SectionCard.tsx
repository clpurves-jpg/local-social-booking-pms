export function SectionCard({ title, subtitle, children, right }: { title?: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode; }) {
  return (
    <section className="card section-gap">
      {(title || subtitle || right) && (
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <div>
            {title ? <h2 className="heading-md">{title}</h2> : null}
            {subtitle ? <div className="text-muted">{subtitle}</div> : null}
          </div>
          {right}
        </div>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}
