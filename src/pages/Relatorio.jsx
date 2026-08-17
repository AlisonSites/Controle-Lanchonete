import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'
import Icon from '../components/Icon'
import BarChart from '../components/BarChart'

const toISO = (d) => d.toISOString().slice(0, 10)
const hoje = () => toISO(new Date())
const somaDias = (isoData, n) => {
  const d = new Date(`${isoData}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
const primeiroDiaMes = (offsetMeses = 0) => {
  const d = new Date()
  return toISO(new Date(d.getFullYear(), d.getMonth() + offsetMeses, 1))
}
const ultimoDiaMes = (offsetMeses = 0) => {
  const d = new Date()
  return toISO(new Date(d.getFullYear(), d.getMonth() + offsetMeses + 1, 0))
}
const diffDias = (ini, fim) => Math.round((new Date(`${fim}T00:00:00`) - new Date(`${ini}T00:00:00`)) / 86400000) + 1

const FORMAS_LABEL = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito' }
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const PRESETS = [
  { label: 'Hoje', get: () => [hoje(), hoje()] },
  { label: 'Ontem', get: () => [somaDias(hoje(), -1), somaDias(hoje(), -1)] },
  { label: '7 dias', get: () => [somaDias(hoje(), -6), hoje()] },
  { label: '30 dias', get: () => [somaDias(hoje(), -29), hoje()] },
  { label: 'Este mês', get: () => [primeiroDiaMes(), hoje()] },
  { label: 'Mês passado', get: () => [primeiroDiaMes(-1), ultimoDiaMes(-1)] },
]

export default function Relatorio() {
  const [inicio, setInicio] = useState(primeiroDiaMes())
  const [fim, setFim] = useState(hoje())
  const [formaFiltro, setFormaFiltro] = useState('todas')
  const [presetAtivo, setPresetAtivo] = useState('Este mês')
  const [pedidos, setPedidos] = useState(null)
  const [pedidosAnteriores, setPedidosAnteriores] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const aplicarPreset = (preset) => {
    const [i, f] = preset.get()
    setInicio(i)
    setFim(f)
    setPresetAtivo(preset.label)
  }

  const buscar = async () => {
    setCarregando(true)
    setErro('')
    try {
      const dias = diffDias(inicio, fim)
      const inicioAnterior = somaDias(inicio, -dias)
      const fimAnterior = somaDias(inicio, -1)

      const [atualRes, anteriorRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('id, status, forma_pagamento, valor_total, criado_em, mesas(numero), usuarios(nome), itens_pedido(quantidade, valor_unitario, observacao, produtos(nome))')
          .eq('status', 'concluido')
          .gte('criado_em', `${inicio}T00:00:00`)
          .lte('criado_em', `${fim}T23:59:59`)
          .order('criado_em', { ascending: false }),
        supabase
          .from('pedidos')
          .select('id, valor_total, criado_em')
          .eq('status', 'concluido')
          .gte('criado_em', `${inicioAnterior}T00:00:00`)
          .lte('criado_em', `${fimAnterior}T23:59:59`),
      ])

      if (atualRes.error) throw atualRes.error
      if (anteriorRes.error) throw anteriorRes.error

      setPedidos(atualRes.data || [])
      setPedidosAnteriores(anteriorRes.data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const pedidosFiltrados = useMemo(() => {
    if (!pedidos) return null
    if (formaFiltro === 'todas') return pedidos
    return pedidos.filter((p) => (p.forma_pagamento || 'não informado') === formaFiltro)
  }, [pedidos, formaFiltro])

  const resumo = useMemo(() => {
    if (!pedidosFiltrados) return null
    const totalGeral = pedidosFiltrados.reduce((a, p) => a + Number(p.valor_total), 0)
    const totalPedidos = pedidosFiltrados.length
    const ticketMedio = totalPedidos ? totalGeral / totalPedidos : 0

    const porForma = {}
    const porProduto = {}
    const porMesa = {}
    const porDia = {}

    pedidosFiltrados.forEach((p) => {
      const f = p.forma_pagamento || 'não informado'
      porForma[f] = (porForma[f] || 0) + Number(p.valor_total)

      const mesaNum = p.mesas?.numero ?? '—'
      if (!porMesa[mesaNum]) porMesa[mesaNum] = { pedidos: 0, valor: 0 }
      porMesa[mesaNum].pedidos += 1
      porMesa[mesaNum].valor += Number(p.valor_total)

      const diaIso = p.criado_em.slice(0, 10)
      porDia[diaIso] = (porDia[diaIso] || 0) + Number(p.valor_total)

      ;(p.itens_pedido || []).forEach((i) => {
        const nome = i.observacao || i.produtos?.nome || 'Produto removido'
        if (!porProduto[nome]) porProduto[nome] = { qtd: 0, valor: 0 }
        porProduto[nome].qtd += i.quantidade
        porProduto[nome].valor += i.quantidade * i.valor_unitario
      })
    })

    const rankingProdutos = Object.entries(porProduto)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.qtd - a.qtd)

    const rankingMesas = Object.entries(porMesa)
      .map(([numero, v]) => ({ numero, ...v }))
      .sort((a, b) => b.valor - a.valor)

    const vendasPorDia = Object.entries(porDia)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([iso, valor]) => {
        const dt = new Date(`${iso}T00:00:00`)
        const curto = diffDias(inicio, fim) <= 31
          ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : DIAS_SEMANA[dt.getDay()]
        return { label: curto, value: valor, iso }
      })

    const totalAnterior = pedidosAnteriores.reduce((a, p) => a + Number(p.valor_total), 0)
    const variacao = totalAnterior > 0
      ? ((totalGeral - totalAnterior) / totalAnterior) * 100
      : (totalGeral > 0 ? 100 : 0)

    return { totalGeral, porForma, rankingProdutos, rankingMesas, vendasPorDia, totalPedidos, ticketMedio, totalAnterior, variacao }
  }, [pedidosFiltrados, pedidosAnteriores, inicio, fim])

  const exportarExcel = () => {
    if (!pedidosFiltrados) return
    const linhas = pedidosFiltrados.map((p) => ({
      Pedido: p.id.slice(0, 8),
      Mesa: p.mesas?.numero,
      Atendente: p.usuarios?.nome || '-',
      Data: new Date(p.criado_em).toLocaleString('pt-BR'),
      'Forma de pagamento': FORMAS_LABEL[p.forma_pagamento] || p.forma_pagamento || '-',
      'Total (R$)': Number(p.valor_total).toFixed(2),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Pedidos')

    if (resumo) {
      const resumoLinhas = [
        { Métrica: 'Total geral', Valor: resumo.totalGeral.toFixed(2) },
        { Métrica: 'Total de pedidos', Valor: resumo.totalPedidos },
        { Métrica: 'Ticket médio', Valor: resumo.ticketMedio.toFixed(2) },
        { Métrica: 'Total período anterior (mesma duração)', Valor: resumo.totalAnterior.toFixed(2) },
        { Métrica: 'Variação (%)', Valor: resumo.variacao.toFixed(1) },
        ...Object.entries(resumo.porForma).map(([k, v]) => ({ Métrica: `Total em ${FORMAS_LABEL[k] || k}`, Valor: v.toFixed(2) })),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoLinhas), 'Resumo')

      const produtosLinhas = resumo.rankingProdutos.map((p) => ({ Produto: p.nome, Quantidade: p.qtd, 'Total (R$)': p.valor.toFixed(2) }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(produtosLinhas), 'Produtos')

      const mesasLinhas = resumo.rankingMesas.map((m) => ({ Mesa: m.numero, Pedidos: m.pedidos, 'Total (R$)': m.valor.toFixed(2) }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mesasLinhas), 'Por mesa')

      const diaLinhas = resumo.vendasPorDia.map((d) => ({ Data: d.iso, 'Total (R$)': d.value.toFixed(2) }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diaLinhas), 'Vendas por dia')
    }

    XLSX.writeFile(wb, `relatorio_${inicio}_a_${fim}.xlsx`)
  }

  const exportarPdf = () => {
    if (!pedidosFiltrados || !resumo) return
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Comanda+ — Relatório de vendas', 14, 16)
    doc.setFontSize(10)
    doc.text(`Período: ${inicio} a ${fim}${formaFiltro !== 'todas' ? `  |  Forma: ${FORMAS_LABEL[formaFiltro] || formaFiltro}` : ''}`, 14, 23)
    doc.text(
      `Total: R$ ${resumo.totalGeral.toFixed(2)}  |  Pedidos: ${resumo.totalPedidos}  |  Ticket médio: R$ ${resumo.ticketMedio.toFixed(2)}  |  Variação vs. período anterior: ${resumo.variacao >= 0 ? '+' : ''}${resumo.variacao.toFixed(1)}%`,
      14, 29
    )

    autoTable(doc, {
      startY: 36,
      head: [['Pedido', 'Mesa', 'Data', 'Pagamento', 'Total (R$)']],
      body: pedidosFiltrados.map((p) => [
        p.id.slice(0, 8),
        p.mesas?.numero ?? '-',
        new Date(p.criado_em).toLocaleString('pt-BR'),
        FORMAS_LABEL[p.forma_pagamento] || p.forma_pagamento || '-',
        Number(p.valor_total).toFixed(2),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 69] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Produto', 'Qtd. vendida', 'Total (R$)']],
      body: resumo.rankingProdutos.map((p) => [p.nome, p.qtd, p.valor.toFixed(2)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 167, 251], textColor: [0, 0, 69] },
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Mesa', 'Pedidos', 'Total (R$)']],
      body: resumo.rankingMesas.map((m) => [m.numero, m.pedidos, m.valor.toFixed(2)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 167, 251], textColor: [0, 0, 69] },
    })

    doc.save(`relatorio_${inicio}_a_${fim}.pdf`)
  }

  const trendCls = resumo && resumo.variacao > 0.5 ? 'up' : resumo && resumo.variacao < -0.5 ? 'down' : 'flat'
  const trendIcon = trendCls === 'up' ? 'trendingUp' : trendCls === 'down' ? 'trendingDown' : 'arrowLeft'

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Relatório</div>
          <div className="page-header__subtitle">Relatórios gerais e detalhados de vendas, com exportação</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 18px 0' }}>
          <div className="date-presets" style={{ marginBottom: 14 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`date-preset ${presetAtivo === p.label ? 'date-preset--active' : ''}`}
                onClick={() => aplicarPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel__toolbar" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 150 }}>
            <label>De</label>
            <input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPresetAtivo('') }} />
          </div>
          <div className="field" style={{ minWidth: 150 }}>
            <label>Até</label>
            <input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setPresetAtivo('') }} />
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Forma de pagamento</label>
            <select value={formaFiltro} onChange={(e) => setFormaFiltro(e.target.value)}>
              <option value="todas">Todas</option>
              {Object.entries(FORMAS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn--primary" onClick={buscar} disabled={carregando}>
              {carregando ? 'Buscando...' : 'Gerar relatório'}
            </button>
          </div>
          {pedidosFiltrados && pedidosFiltrados.length > 0 && (
            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
              <button className="btn btn--ghost" onClick={exportarExcel}><Icon name="download" size={15} /> Excel</button>
              <button className="btn btn--ghost" onClick={exportarPdf}><Icon name="download" size={15} /> PDF</button>
            </div>
          )}
        </div>
      </div>

      {erro && <div className="alert alert--danger">{erro}</div>}

      {resumo && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Total no período</span>
                <span className="stat-card__icon"><Icon name="wallet" size={16} /></span>
              </div>
              <div className="stat-card__value">R$ {resumo.totalGeral.toFixed(2)}</div>
              <span className={`stat-card__trend stat-card__trend--${trendCls}`}>
                <Icon name={trendIcon} size={12} /> {Math.abs(resumo.variacao).toFixed(0)}% vs. período anterior
              </span>
            </div>
            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Pedidos concluídos</span>
                <span className="stat-card__icon"><Icon name="check" size={16} /></span>
              </div>
              <div className="stat-card__value">{resumo.totalPedidos}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__top">
                <span className="stat-card__label">Ticket médio</span>
                <span className="stat-card__icon"><Icon name="chart" size={16} /></span>
              </div>
              <div className="stat-card__value">R$ {resumo.ticketMedio.toFixed(2)}</div>
            </div>
            {Object.entries(resumo.porForma).map(([forma, valor]) => (
              <div className="stat-card" key={forma}>
                <div className="stat-card__top">
                  <span className="stat-card__label">{FORMAS_LABEL[forma] || forma}</span>
                </div>
                <div className="stat-card__value" style={{ fontSize: 19 }}>R$ {valor.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__toolbar"><b>Vendas por dia</b></div>
            <div style={{ padding: '4px 18px 20px' }}>
              <BarChart data={resumo.vendasPorDia} formatValue={(v) => v > 0 ? `R$${v.toFixed(0)}` : '—'} />
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: 20 }}>
            <div className="panel">
              <div className="panel__toolbar"><b>Produtos mais vendidos</b></div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Produto</th><th>Qtd. vendida</th><th>Total (R$)</th></tr></thead>
                  <tbody>
                    {resumo.rankingProdutos.map((p) => (
                      <tr key={p.nome}><td>{p.nome}</td><td className="mono">{p.qtd}</td><td className="mono">R$ {p.valor.toFixed(2)}</td></tr>
                    ))}
                    {resumo.rankingProdutos.length === 0 && <tr><td colSpan={3}>Nenhum item vendido no período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel__toolbar"><b>Ranking por mesa</b></div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Mesa</th><th>Pedidos</th><th>Total (R$)</th></tr></thead>
                  <tbody>
                    {resumo.rankingMesas.map((m) => (
                      <tr key={m.numero}><td>Mesa {m.numero}</td><td className="mono">{m.pedidos}</td><td className="mono">R$ {m.valor.toFixed(2)}</td></tr>
                    ))}
                    {resumo.rankingMesas.length === 0 && <tr><td colSpan={3}>Nenhuma venda no período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__toolbar"><b>Pedidos detalhados</b></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Pedido</th><th>Mesa</th><th>Atendente</th><th>Data</th><th>Pagamento</th><th>Total</th></tr></thead>
                <tbody>
                  {pedidosFiltrados.map((p) => (
                    <tr key={p.id}>
                      <td className="cell-id">{p.id.slice(0, 8)}</td>
                      <td>Mesa {p.mesas?.numero}</td>
                      <td>{p.usuarios?.nome || '-'}</td>
                      <td>{new Date(p.criado_em).toLocaleString('pt-BR')}</td>
                      <td>{FORMAS_LABEL[p.forma_pagamento] || p.forma_pagamento || '-'}</td>
                      <td className="mono">R$ {Number(p.valor_total).toFixed(2)}</td>
                    </tr>
                  ))}
                  {pedidosFiltrados.length === 0 && <tr><td colSpan={6}>Nenhum pedido concluído no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!resumo && !carregando && (
        <div className="empty-state"><h2>Escolha um período</h2><p>Selecione as datas (ou um atalho acima) e clique em "Gerar relatório".</p></div>
      )}
    </div>
  )
}