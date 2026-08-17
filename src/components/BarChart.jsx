// Gráfico de barras simples em SVG puro — sem dependências externas.
// Recebe `data` como [{ label, value }] e desenha barras proporcionais.
export default function BarChart({ data, height = 180, formatValue, color = 'var(--accent)', emptyText = 'Sem dados no período' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const barGap = 10
  const width = 100 // percentual, viewBox flexível

  if (!data || data.length === 0) {
    return <div className="empty-state" style={{ padding: '30px 10px' }}><p>{emptyText}</p></div>
  }

  return (
    <div className="bar-chart">
      <div className="bar-chart__bars" style={{ height }}>
        {data.map((d, i) => {
          const pct = Math.max(2, (d.value / max) * 100)
          return (
            <div className="bar-chart__col" key={i} title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}>
              <div className="bar-chart__value">{formatValue ? formatValue(d.value) : d.value}</div>
              <div className="bar-chart__bar" style={{ height: `${pct}%`, background: color }} />
              <div className="bar-chart__label">{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
