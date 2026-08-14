export function StatusAtivoBadge({ ativo }) {
  return (
    <span className={`badge ${ativo ? 'badge--success' : 'badge--danger'}`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

const PEDIDO_MAP = {
  aberto: { label: 'Aberto', cls: 'badge--info' },
  em_preparo: { label: 'Em preparo', cls: 'badge--warning' },
  pronto: { label: 'Pedido realizado', cls: 'badge--accent' },
  concluido: { label: 'Concluído', cls: 'badge--success' },
  cancelado: { label: 'Cancelado', cls: 'badge--danger' },
}

export function StatusPedidoBadge({ status }) {
  const cfg = PEDIDO_MAP[status] || { label: status, cls: 'badge--neutral' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

const MESA_MAP = {
  disponivel: { label: 'Disponível', cls: 'badge--success' },
  ocupada: { label: 'Ocupada', cls: 'badge--info' },
}

export function StatusMesaBadge({ status }) {
  const cfg = MESA_MAP[status] || { label: status, cls: 'badge--neutral' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}
