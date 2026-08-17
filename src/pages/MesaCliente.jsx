import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../components/Icon'
import './MesaCliente.css'

export default function MesaCliente() {
  const { token } = useParams()
  const [mesa, setMesa] = useState(null)
  const [statusBusca, setStatusBusca] = useState('carregando') // carregando | ok | nao-encontrada
  const [tipos, setTipos] = useState([])
  const [tipoAtivo, setTipoAtivo] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [pedido, setPedido] = useState(null)
  const [itens, setItens] = useState([])
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: mesaData } = await supabase.from('mesas').select('*').eq('qrcode_token', token).maybeSingle()
      if (!mesaData) { setStatusBusca('nao-encontrada'); return }
      setMesa(mesaData)
      setStatusBusca('ok')

      const { data: tiposData } = await supabase.from('tipos_produto').select('*').eq('status', true).order('nome')
      const { data: produtosData } = await supabase.from('produtos').select('*').eq('status', true).order('nome')
      setTipos(tiposData || [])
      setProdutos(produtosData || [])
      if (tiposData?.length) setTipoAtivo(tiposData[0].id)

      // Apenas busca um pedido já existente para a mesa - NÃO cria nada aqui.
      // O pedido só é criado quando o cliente adiciona o primeiro item (ver adicionar()).
      const { data: pedidoAtual } = await supabase
        .from('pedidos')
        .select('*')
        .eq('mesa_id', mesaData.id)
        .in('status', ['aberto', 'em_preparo'])
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      setPedido(pedidoAtual || null)
      if (pedidoAtual) await carregarItens(pedidoAtual.id)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const carregarItens = async (pedidoId) => {
    if (!pedidoId) return
    const { data } = await supabase
      .from('itens_pedido')
      .select('id, quantidade, valor_unitario, status, produtos(nome)')
      .eq('pedido_id', pedidoId)
      .neq('status', 'cancelado')
      .order('criado_em')
    setItens(data || [])
  }

  const adicionar = async (produto) => {
    let pedidoAtual = pedido

    // Primeiro item do cliente: cria o pedido e só agora a mesa "abre" (fica ocupada).
    if (!pedidoAtual) {
      const { data: novo, error } = await supabase
        .from('pedidos')
        .insert({ mesa_id: mesa.id, origem: 'cliente_qrcode', status: 'aberto' })
        .select('*')
        .single()
      if (error) return
      pedidoAtual = novo
      setPedido(novo)
      await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesa.id)
    }

    // Verifica direto no banco (não usa o estado local "itens") e casa pelo
    // produto_id, evitando duplicar uma linha para um item que já está na comanda.
    const { data: existente } = await supabase
      .from('itens_pedido')
      .select('id, quantidade')
      .eq('pedido_id', pedidoAtual.id)
      .eq('produto_id', produto.id)
      .eq('status', 'pendente')
      .maybeSingle()

    if (existente) {
      await supabase.from('itens_pedido').update({ quantidade: existente.quantidade + 1 }).eq('id', existente.id)
    } else {
      await supabase.from('itens_pedido').insert({
        pedido_id: pedidoAtual.id, produto_id: produto.id, quantidade: 1, valor_unitario: produto.valor, status: 'pendente',
      })
    }
    await carregarItens(pedidoAtual.id)
  }

  const alterarQtd = async (item, delta) => {
    const nova = item.quantidade + delta
    if (nova <= 0) await supabase.from('itens_pedido').delete().eq('id', item.id)
    else await supabase.from('itens_pedido').update({ quantidade: nova }).eq('id', item.id)
    await carregarItens(pedido.id)
  }

  const enviarPedido = async () => {
    if (!pedido || itens.length === 0) return
    setEnviando(true)
    try {
      await supabase.from('pedidos').update({ status: 'em_preparo' }).eq('id', pedido.id)
      await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesa.id)
      setEnviado(true)
    } finally {
      setEnviando(false)
    }
  }

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)
  const produtosFiltrados = produtos.filter((p) => p.tipo_id === tipoAtivo)

  if (statusBusca === 'carregando') {
    return <div className="full-loading"><div className="spinner" /></div>
  }

  if (statusBusca === 'nao-encontrada') {
    return (
      <div className="cliente-screen">
        <div className="empty-state">
          <h2>Mesa não encontrada</h2>
          <p>Este QR Code não corresponde a nenhuma mesa ativa. Chame um atendente.</p>
        </div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="cliente-screen">
        <div className="cliente-header">
          <span className="mono cliente-header__mark">C+</span>
          <h1>Pedido enviado!</h1>
        </div>
        <div className="empty-state">
          <h2>Mesa {mesa.numero}</h2>
          <p>Seu pedido já está com a cozinha. Total: <b>R$ {total.toFixed(2)}</b></p>
        </div>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 16 }} onClick={() => { setEnviado(false); }}>
          Fazer novo pedido nessa mesa
        </button>
      </div>
    )
  }

  return (
    <div className="cliente-screen">
      <div className="cliente-header">
        <span className="mono cliente-header__mark">C+</span>
        <div>
          <h1>Mesa {mesa.numero}</h1>
          <p className="field-hint">Monte seu pedido e envie para a cozinha</p>
        </div>
      </div>

      <div className="type-tabs">
        {tipos.map((t) => (
          <button key={t.id} className={`type-tab ${tipoAtivo === t.id ? 'active' : ''}`} onClick={() => setTipoAtivo(t.id)}>
            {t.nome}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {produtosFiltrados.map((p) => (
          <div key={p.id} className="product-card">
            <div className="product-card__img">
              {p.foto_url ? <img src={p.foto_url} alt={p.nome} /> : <Icon name="burger" size={26} />}
            </div>
            <div className="product-card__body">
              <div className="product-card__name">{p.nome}</div>
              <div className="product-card__price mono">R$ {Number(p.valor).toFixed(2)}</div>
              <button className="btn btn--accent btn--sm btn--block" onClick={() => adicionar(p)}>
                <Icon name="plus" size={13} /> Adicionar
              </button>
            </div>
          </div>
        ))}
        {produtosFiltrados.length === 0 && <p className="field-hint">Nenhum produto disponível nessa categoria.</p>}
      </div>

      {itens.length > 0 && (
        <div className="cliente-resumo">
          <div className="cliente-resumo__itens">
            {itens.map((i) => (
              <div key={i.id} className="cart-item">
                <span>{i.produtos?.nome}</span>
                <div className="cart-item__qty">
                  <button className="qty-btn" onClick={() => alterarQtd(i, -1)}>−</button>
                  <span className="mono">{i.quantidade}</span>
                  <button className="qty-btn" onClick={() => alterarQtd(i, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="ticket__total"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
          <button className="btn btn--primary btn--block" onClick={enviarPedido} disabled={enviando} style={{ marginTop: 10 }}>
            {enviando ? 'Enviando...' : 'Enviar pedido para a cozinha'}
          </button>
        </div>
      )}
    </div>
  )
}
