import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'
import Icon from '../components/Icon'

const hoje = () => new Date().toISOString().slice(0, 10)
const primeiroDiaMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const FORMAS_LABEL = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito' }

export default function Relatorio() {
  const [inicio, setInicio] = useState(primeiroDiaMes())
  const [fim, setFim] = useState(hoje())
  const [pedidos, setPedidos] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const buscar = async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, status, forma_pagamento, valor_total, criado_em, mesas(numero), itens_pedido(quantidade, valor_unitario, observacao, produtos(nome))')
        .eq('status', 'concluido')
        .gte('criado_em', `${inicio}T00:00:00`)
        .lte('criado_em', `${fim}T23:59:59`)
        .order('criado_em', { ascending: false })
      if (error) throw error
      setPedidos(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const resumo = useMemo(() => {
    if (!pedidos) return null
    const totalGeral = pedidos.reduce((a, p) => a + Number(p.valor_total), 0)
    const porForma = {}
    const porProduto = {}
    pedidos.forEach((p) => {
      const f = p.forma_pagamento || 'não informado'
      porForma[f] = (porForma[f] || 0) + Number(p.valor_total)
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
    return { totalGeral, porForma, rankingProdutos, totalPedidos: pedidos.length }
  }, [pedidos])

  const exportarExcel = () => {
    if (!pedidos) return
    const linhas = pedidos.map((p) => ({
      Pedido: p.id.slice(0, 8),
      Mesa: p.mesas?.numero,
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
        ...Object.entries(resumo.porForma).map(([k, v]) => ({ Métrica: `Total em ${FORMAS_LABEL[k] || k}`, Valor: v.toFixed(2) })),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoLinhas), 'Resumo')

      const produtosLinhas = resumo.rankingProdutos.map((p) => ({ Produto: p.nome, Quantidade: p.qtd, 'Total (R$)': p.valor.toFixed(2) }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(produtosLinhas), 'Produtos')
    }

    XLSX.writeFile(wb, `relatorio_${inicio}_a_${fim}.xlsx`)
  }

  const exportarPdf = () => {
    if (!pedidos || !resumo) return
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Comanda+ — Relatório de vendas', 14, 16)
    doc.setFontSize(10)
    doc.text(`Período: ${inicio} a ${fim}`, 14, 23)
    doc.text(`Total geral: R$ ${resumo.totalGeral.toFixed(2)}  |  Pedidos: ${resumo.totalPedidos}`, 14, 29)

    autoTable(doc, {
      startY: 36,
      head: [['Pedido', 'Mesa', 'Data', 'Pagamento', 'Total (R$)']],
      body: pedidos.map((p) => [
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

    doc.save(`relatorio_${inicio}_a_${fim}.pdf`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Relatório</div>
          <div className="page-header__subtitle">Relatórios gerais e detalhados de vendas, com exportação</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__toolbar" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>De</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Até</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn--primary" onClick={buscar} disabled={carregando}>
              {carregando ? 'Buscando...' : 'Gerar relatório'}
            </button>
          </div>
          {pedidos && pedidos.length > 0 && (
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
          <div className="card-grid" style={{ marginBottom: 20 }}>
            <div className="module-card" style={{ cursor: 'default' }}>
              <div className="module-card__title">Total no período</div>
              <div className="module-card__desc mono" style={{ fontSize: 22, color: 'var(--primary)' }}>R$ {resumo.totalGeral.toFixed(2)}</div>
            </div>
            <div className="module-card" style={{ cursor: 'default' }}>
              <div className="module-card__title">Pedidos concluídos</div>
              <div className="module-card__desc mono" style={{ fontSize: 22, color: 'var(--primary)' }}>{resumo.totalPedidos}</div>
            </div>
            {Object.entries(resumo.porForma).map(([forma, valor]) => (
              <div className="module-card" key={forma} style={{ cursor: 'default' }}>
                <div className="module-card__title">{FORMAS_LABEL[forma] || forma}</div>
                <div className="module-card__desc mono" style={{ fontSize: 18, color: 'var(--accent-dark)' }}>R$ {valor.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
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
            <div className="panel__toolbar"><b>Pedidos detalhados</b></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Pedido</th><th>Mesa</th><th>Data</th><th>Pagamento</th><th>Total</th></tr></thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id}>
                      <td className="cell-id">{p.id.slice(0, 8)}</td>
                      <td>Mesa {p.mesas?.numero}</td>
                      <td>{new Date(p.criado_em).toLocaleString('pt-BR')}</td>
                      <td>{FORMAS_LABEL[p.forma_pagamento] || p.forma_pagamento || '-'}</td>
                      <td className="mono">R$ {Number(p.valor_total).toFixed(2)}</td>
                    </tr>
                  ))}
                  {pedidos.length === 0 && <tr><td colSpan={5}>Nenhum pedido concluído no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!resumo && !carregando && (
        <div className="empty-state"><h2>Escolha um período</h2><p>Selecione as datas e clique em "Gerar relatório".</p></div>
      )}
    </div>
  )
}
