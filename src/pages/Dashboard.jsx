import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../components/Icon'
import BarChart from '../components/BarChart'
import { useAuth } from '../context/AuthContext'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const toISODate = (d) => d.toISOString().slice(0, 10)
const hojeISO = () => toISODate(new Date())
const diasAtras = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISODate(d)
}
const brl = (v) => `R$ ${Number(v || 0).toFixed(2)}`

export default function Dashboard() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [pedidos30d, setPedidos30d] = useState([])
  const [mesas, setMesas] = useState([])
  const [filaItens, setFilaItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const desde = diasAtras(30)
      const [pedidosRes, mesasRes, filaRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('id, valor_total, criado_em, forma_pagamento, itens_pedido(quantidade, valor_unitario, observacao, produtos(nome))')
          .eq('status', 'concluido')
          .gte('criado_em', `${desde}T00:00:00`)
          .order('criado_em', { ascending: true }),
        supabase.from('mesas').select('id, numero, status').order('numero'),
        supabase
          .from('itens_pedido')
          .select('id, pedido_id, status, pedidos!inner(status, mesas(numero))')
          .eq('status', 'pendente')
          .neq('pedidos.status', 'concluido')
          .neq('pedidos.status', 'cancelado'),
      ])

      if (pedidosRes.error) throw pedidosRes.error
      if (mesasRes.error) throw mesasRes.error
      if (filaRes.error) throw filaRes.error

      setPedidos30d(pedidosRes.data || [])
      setMesas(mesasRes.data || [])
      setFilaItens(filaRes.data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [carregar])

  const dados = useMemo(() => {
    const hoje = hojeISO()
    const ontem = diasAtras(1)

    const pedidosHoje = pedidos30d.filter((p) => p.criado_em?.slice(0, 10) === hoje)
    const pedidosOntem = pedidos30d.filter((p) => p.criado_em?.slice(0, 10) === ontem)

    const faturamentoHoje = pedidosHoje.reduce((a, p) => a + Number(p.valor_total), 0)
    const faturamentoOntem = pedidosOntem.reduce((a, p) => a + Number(p.valor_total), 0)
    const variacao = faturamentoOntem > 0
      ? ((faturamentoHoje - faturamentoOntem) / faturamentoOntem) * 100
      : (faturamentoHoje > 0 ? 100 : 0)

    const ticketMedioHoje = pedidosHoje.length ? faturamentoHoje / pedidosHoje.length : 0

    // Últimos 7 dias, incluindo hoje
    const ultimos7 = []
    for (let i = 6; i >= 0; i -= 1) {
      const iso = diasAtras(i)
      const dataObj = new Date(`${iso}T00:00:00`)
      const totalDia = pedidos30d
        .filter((p) => p.criado_em?.slice(0, 10) === iso)
        .reduce((a, p) => a + Number(p.valor_total), 0)
      ultimos7.push({ label: DIAS_SEMANA[dataObj.getDay()], value: totalDia, iso })
    }

    // Top produtos últimos 30 dias
    const porProduto = {}
    pedidos30d.forEach((p) => {
      ;(p.itens_pedido || []).forEach((i) => {
        const nome = i.observacao || i.produtos?.nome || 'Produto removido'
        if (!porProduto[nome]) porProduto[nome] = { qtd: 0, valor: 0 }
        porProduto[nome].qtd += i.quantidade
        porProduto[nome].valor += i.quantidade * i.valor_unitario
      })
    })
    const topProdutos = Object.entries(porProduto)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5)

    const mesasOcupadas = mesas.filter((m) => m.status === 'ocupada')
    const mesasNumerosFila = new Set(filaItens.map((i) => i.pedidos?.mesas?.numero).filter(Boolean))

    return {
      faturamentoHoje,
      faturamentoOntem,
      variacao,
      pedidosHojeCount: pedidosHoje.length,
      ticketMedioHoje,
      ultimos7,
      topProdutos,
      mesasOcupadas,
      mesasTotal: mesas.length,
      filaCount: new Set(filaItens.map((i) => i.pedido_id)).size,
      mesasNumerosFila,
    }
  }, [pedidos30d, mesas, filaItens])

  const trendCls = dados.variacao > 0.5 ? 'up' : dados.variacao < -0.5 ? 'down' : 'flat'
  const trendIcon = trendCls === 'up' ? 'trendingUp' : trendCls === 'down' ? 'trendingDown' : 'arrowLeft'

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Dashboard</div>
          <div className="page-header__subtitle">Olá, {usuario?.nome?.split(' ')[0]} — aqui está o resumo de hoje</div>
        </div>
      </div>

      {erro && <div className="alert alert--danger">{erro}</div>}

      {loading ? (
        <p className="field-hint">Carregando dashboard...</p>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Faturamento hoje</span>
                <span className="stat-card__icon"><Icon name="wallet" size={16} /></span>
              </div>
              <div className="stat-card__value">{brl(dados.faturamentoHoje)}</div>
              <span className={`stat-card__trend stat-card__trend--${trendCls}`}>
                <Icon name={trendIcon} size={12} /> {Math.abs(dados.variacao).toFixed(0)}% vs. ontem
              </span>
            </div>

            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Pedidos concluídos</span>
                <span className="stat-card__icon"><Icon name="check" size={16} /></span>
              </div>
              <div className="stat-card__value">{dados.pedidosHojeCount}</div>
              <span className="stat-card__sub">hoje, {new Date().toLocaleDateString('pt-BR')}</span>
            </div>

            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Ticket médio</span>
                <span className="stat-card__icon"><Icon name="chart" size={16} /></span>
              </div>
              <div className="stat-card__value">{brl(dados.ticketMedioHoje)}</div>
              <span className="stat-card__sub">por pedido concluído hoje</span>
            </div>

            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Mesas ocupadas</span>
                <span className="stat-card__icon"><Icon name="table" size={16} /></span>
              </div>
              <div className="stat-card__value">{dados.mesasOcupadas.length}/{dados.mesasTotal}</div>
              <span className="stat-card__sub">{dados.mesasTotal ? Math.round((dados.mesasOcupadas.length / dados.mesasTotal) * 100) : 0}% de ocupação</span>
            </div>

            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Fila da cozinha</span>
                <span className="stat-card__icon"><Icon name="ticket" size={16} /></span>
              </div>
              <div className="stat-card__value">{dados.filaCount}</div>
              <span className="stat-card__sub">{dados.filaCount === 0 ? 'tudo em dia' : 'pedido(s) aguardando preparo'}</span>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel__toolbar"><b>Faturamento — últimos 7 dias</b></div>
              <div style={{ padding: '4px 18px 20px' }}>
                <BarChart data={dados.ultimos7} formatValue={(v) => v > 0 ? `R$${v.toFixed(0)}` : '—'} />
              </div>
            </div>

            <div className="panel">
              <div className="panel__toolbar"><b>Mais vendidos (30 dias)</b></div>
              <div style={{ padding: '6px 18px 18px' }}>
                {dados.topProdutos.length === 0 && <p className="field-hint">Sem vendas registradas ainda.</p>}
                {dados.topProdutos.map((p, i) => (
                  <div key={p.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < dados.topProdutos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span className="badge badge--accent" style={{ minWidth: 22, justifyContent: 'center' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                      <div className="field-hint">{p.qtd} vendidos</div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--primary)' }}>{brl(p.valor)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <div className="panel__toolbar" style={{ justifyContent: 'space-between' }}>
              <b>Atalhos rápidos</b>
            </div>
            <div className="card-grid" style={{ padding: '4px 18px 20px' }}>
              <div className="module-card" onClick={() => navigate('/pedidos/controle')}>
                <div className="module-card__icon"><Icon name="ticket" size={20} /></div>
                <div>
                  <div className="module-card__title">Controle de Pedido</div>
                  <div className="module-card__desc">{dados.filaCount} pedido(s) na fila</div>
                </div>
              </div>
              <div className="module-card" onClick={() => navigate('/pedidos/finalizar')}>
                <div className="module-card__icon"><Icon name="check" size={20} /></div>
                <div>
                  <div className="module-card__title">Finalizar Pedido</div>
                  <div className="module-card__desc">Fechar contas de mesas ocupadas</div>
                </div>
              </div>
              <div className="module-card" onClick={() => navigate('/relatorio')}>
                <div className="module-card__icon"><Icon name="chart" size={20} /></div>
                <div>
                  <div className="module-card__title">Relatório</div>
                  <div className="module-card__desc">Ver relatório detalhado de vendas</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
