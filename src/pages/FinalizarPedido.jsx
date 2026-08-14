import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { StatusMesaBadge } from '../components/StatusBadge'

const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'pix', label: 'Pix' },
  { valor: 'credito', label: 'Cartão de crédito' },
  { valor: 'debito', label: 'Cartão de débito' },
]

export default function FinalizarPedido() {
  const [mesas, setMesas] = useState([])
  const [mesaSelecionada, setMesaSelecionada] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [itens, setItens] = useState([])
  const [formaPagamento, setFormaPagamento] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [erro, setErro] = useState('')

  const carregarMesas = async () => {
    const { data } = await supabase.from('mesas').select('*').order('numero')
    setMesas(data || [])
  }

  const mesaSelecionadaRef = useRef(null)
  useEffect(() => {
    mesaSelecionadaRef.current = mesaSelecionada
  }, [mesaSelecionada])

  const carregarConta = async (mesaId) => {
    const { data: pedidoAtual } = await supabase
      .from('pedidos')
      .select('*')
      .eq('mesa_id', mesaId)
      .in('status', ['aberto', 'em_preparo'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    setPedido(pedidoAtual)

    if (pedidoAtual) {
      const { data: itensData } = await supabase
        .from('itens_pedido')
        .select('id, quantidade, valor_unitario, observacao, produtos(nome)')
        .eq('pedido_id', pedidoAtual.id)
        .neq('status', 'cancelado')
      setItens(itensData || [])
    } else {
      setItens([])
    }
  }

  useEffect(() => {
    carregarMesas()

    // Escuta mudanças em tempo real (feitas por outros dispositivos/usuários)
    // e atualiza a tela automaticamente, sem precisar recarregar a página.
    const canal = supabase
      .channel('finalizar-pedido-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        carregarMesas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        if (mesaSelecionadaRef.current) carregarConta(mesaSelecionadaRef.current.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        if (mesaSelecionadaRef.current) carregarConta(mesaSelecionadaRef.current.id)
      })
      .subscribe()

    return () => supabase.removeChannel(canal)
  }, [])

  const abrirConta = async (mesa) => {
    setErro('')
    setFormaPagamento('')
    setMesaSelecionada(mesa)
    await carregarConta(mesa.id)
  }

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)

  const finalizar = async () => {
    if (!formaPagamento) { setErro('Selecione a forma de pagamento.'); return }
    if (!pedido) { setErro('Não há comanda aberta para essa mesa.'); return }
    setFinalizando(true)
    setErro('')
    try {
      await supabase.from('pedidos').update({ status: 'concluido', forma_pagamento: formaPagamento }).eq('id', pedido.id)
      await supabase.from('mesas').update({ status: 'disponivel' }).eq('id', mesaSelecionada.id)
      setMesaSelecionada(null)
      setPedido(null)
      setItens([])
      carregarMesas()
    } catch (err) {
      setErro(err.message)
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Finalizar Pedido</div>
          <div className="page-header__subtitle">Feche a conta da mesa e registre a forma de pagamento</div>
        </div>
      </div>

      <div className="table-grid">
        {mesas.map((m) => (
          <div key={m.id} className={`table-chip table-chip--${m.status}`} onClick={() => abrirConta(m)}>
            <div className="table-chip__num mono">{m.numero}</div>
            <div className="table-chip__label"><StatusMesaBadge status={m.status} /></div>
          </div>
        ))}
        {mesas.length === 0 && <div className="empty-state">Nenhuma mesa cadastrada ainda.</div>}
      </div>

      <Modal
        open={!!mesaSelecionada}
        onClose={() => setMesaSelecionada(null)}
        title={mesaSelecionada ? `Fechar conta — Mesa ${mesaSelecionada.numero}` : ''}
        footer={mesaSelecionada && pedido && (
          <button className="btn btn--primary btn--block" onClick={finalizar} disabled={finalizando}>
            {finalizando ? 'Finalizando...' : 'Finalizar e liberar mesa'}
          </button>
        )}
      >
        {mesaSelecionada && !pedido && (
          <div className="empty-state"><h2>Sem comanda aberta</h2><p>Essa mesa não possui pedidos em aberto no momento.</p></div>
        )}
        {pedido && (
          <div>
            <div className="ticket__items">
              {itens.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{i.quantidade}x {i.observacao || i.produtos?.nome}</span>
                  <span className="mono">R$ {(i.quantidade * i.valor_unitario).toFixed(2)}</span>
                </div>
              ))}
              {itens.length === 0 && <p className="field-hint">Nenhum item na comanda.</p>}
            </div>
            <div className="ticket__total" style={{ marginBottom: 16 }}>
              <span>Total a pagar</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>

            {erro && <div className="alert alert--danger">{erro}</div>}

            <div className="field">
              <label>Forma de pagamento</label>
              <div className="form-grid" style={{ marginTop: 4 }}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <button
                    type="button"
                    key={f.valor}
                    className={`btn ${formaPagamento === f.valor ? 'btn--accent' : 'btn--ghost'}`}
                    onClick={() => setFormaPagamento(f.valor)}
                  >
                    <Icon name="cart" size={14} /> {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
