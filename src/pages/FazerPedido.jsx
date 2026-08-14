import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { StatusMesaBadge } from '../components/StatusBadge'

export default function FazerPedido() {
  const { usuario } = useAuth()
  const [mesas, setMesas] = useState([])
  const [mesaSelecionada, setMesaSelecionada] = useState(null)
  const [tipos, setTipos] = useState([])
  const [tipoAtivo, setTipoAtivo] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [pedido, setPedido] = useState(null)
  const [itens, setItens] = useState([])
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [pizzaModalAberto, setPizzaModalAberto] = useState(false)
  const [saborUmId, setSaborUmId] = useState('')
  const [saborDoisId, setSaborDoisId] = useState('')
  const [erroPizza, setErroPizza] = useState('')
  const [salvandoPizza, setSalvandoPizza] = useState(false)

  useEffect(() => {
    carregarMesas()
    carregarCardapio()
  }, [])

  const carregarMesas = async () => {
    const { data } = await supabase.from('mesas').select('*').order('numero')
    setMesas(data || [])
  }

  const carregarCardapio = async () => {
    const { data: tiposData } = await supabase.from('tipos_produto').select('*').eq('status', true).order('nome')
    const { data: produtosData } = await supabase.from('produtos').select('*').eq('status', true).order('nome')
    setTipos(tiposData || [])
    setProdutos(produtosData || [])
    if (tiposData?.length) setTipoAtivo(tiposData[0].id)
  }

  const carregarComanda = async (mesaId) => {
    setCarregando(true)
    // Apenas busca um pedido já existente para a mesa - NÃO cria nada aqui.
    // O pedido só é criado quando o primeiro item é adicionado (ver adicionarItem).
    const { data: pedidoAtual } = await supabase
      .from('pedidos')
      .select('*')
      .eq('mesa_id', mesaId)
      .in('status', ['aberto', 'em_preparo'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    setPedido(pedidoAtual || null)

    if (pedidoAtual) {
      const { data: itensData } = await supabase
        .from('itens_pedido')
        .select('id, quantidade, valor_unitario, observacao, status, produtos(nome)')
        .eq('pedido_id', pedidoAtual.id)
        .neq('status', 'cancelado')
        .order('criado_em')
      setItens(itensData || [])
    } else {
      setItens([])
    }
    setCarregando(false)
  }

  const abrirMesa = async (mesa) => {
    setMesaSelecionada(mesa)
    setCarrinhoAberto(true)
    await carregarComanda(mesa.id)
  }

  const fecharCarrinho = () => {
    setCarrinhoAberto(false)
    setMesaSelecionada(null)
    setPedido(null)
    setItens([])
    carregarMesas()
  }

  // Garante que existe um pedido para a mesa, criando (e "abrindo" a mesa)
  // apenas na primeira vez que algo é adicionado. Reaproveitado tanto para
  // itens normais quanto para a pizza meio a meio.
  const garantirPedido = async () => {
    if (pedido) return pedido
    const { data: novo, error } = await supabase
      .from('pedidos')
      .insert({ mesa_id: mesaSelecionada.id, usuario_id: usuario?.id, origem: 'garcom', status: 'aberto' })
      .select('*')
      .single()
    if (error) throw error
    setPedido(novo)
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaSelecionada.id)
    setMesas((prev) => prev.map((m) => (m.id === mesaSelecionada.id ? { ...m, status: 'ocupada' } : m)))
    return novo
  }

  const adicionarItem = async (produto) => {
    setCarregando(true)
    try {
      const pedidoAtual = await garantirPedido()

      // Verifica direto no banco (não usa o estado local "itens", que pode
      // estar desatualizado logo após reabrir a mesa) e casa pelo produto_id,
      // evitando criar uma linha duplicada para um item que já está na comanda.
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
          pedido_id: pedidoAtual.id,
          produto_id: produto.id,
          quantidade: 1,
          valor_unitario: produto.valor,
          status: 'pendente',
        })
      }
      await carregarComanda(mesaSelecionada.id)
    } finally {
      setCarregando(false)
    }
  }

  const abrirModalPizza = () => {
    setSaborUmId('')
    setSaborDoisId('')
    setErroPizza('')
    setPizzaModalAberto(true)
  }

  const tipoAtivoObj = tipos.find((t) => t.id === tipoAtivo)
  const produtosFiltrados = useMemo(() => produtos.filter((p) => p.tipo_id === tipoAtivo), [produtos, tipoAtivo])

  const saborUm = produtosFiltrados.find((p) => p.id === saborUmId)
  const saborDois = produtosFiltrados.find((p) => p.id === saborDoisId)
  const precoPizzaPreview = saborUm && saborDois ? Math.max(Number(saborUm.valor), Number(saborDois.valor)) : null

  const adicionarPizzaMeioAMeio = async () => {
    if (!saborUm || !saborDois) { setErroPizza('Escolha os dois sabores da pizza.'); return }
    if (saborUm.id === saborDois.id) { setErroPizza('Escolha dois sabores diferentes.'); return }
    setSalvandoPizza(true)
    setErroPizza('')
    try {
      const pedidoAtual = await garantirPedido()
      const maisCaro = Number(saborUm.valor) >= Number(saborDois.valor) ? saborUm : saborDois
      const valor = Math.max(Number(saborUm.valor), Number(saborDois.valor))
      await supabase.from('itens_pedido').insert({
        pedido_id: pedidoAtual.id,
        produto_id: maisCaro.id,
        quantidade: 1,
        valor_unitario: valor,
        observacao: `Meio a meio: ${saborUm.nome} / ${saborDois.nome}`,
        status: 'pendente',
      })
      await carregarComanda(mesaSelecionada.id)
      setPizzaModalAberto(false)
    } catch (err) {
      setErroPizza(err.message)
    } finally {
      setSalvandoPizza(false)
    }
  }

  const alterarQtd = async (item, delta) => {
    const novaQtd = item.quantidade + delta
    if (novaQtd <= 0) {
      await supabase.from('itens_pedido').delete().eq('id', item.id)
    } else {
      await supabase.from('itens_pedido').update({ quantidade: novaQtd }).eq('id', item.id)
    }
    await carregarComanda(mesaSelecionada.id)
  }

  const enviarParaCozinha = async () => {
    if (!pedido || itens.length === 0) return
    setEnviando(true)
    try {
      await supabase.from('pedidos').update({ status: 'em_preparo' }).eq('id', pedido.id)
      await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaSelecionada.id)
      fecharCarrinho()
    } finally {
      setEnviando(false)
    }
  }

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Fazer Pedido</div>
          <div className="page-header__subtitle">Selecione a mesa para montar a comanda</div>
        </div>
      </div>

      <div className="table-grid">
        {mesas.map((m) => (
          <div key={m.id} className={`table-chip table-chip--${m.status}`} onClick={() => abrirMesa(m)}>
            <div className="table-chip__num mono">{m.numero}</div>
            <div className="table-chip__label"><StatusMesaBadge status={m.status} /></div>
          </div>
        ))}
        {mesas.length === 0 && <div className="empty-state">Nenhuma mesa cadastrada ainda.</div>}
      </div>

      {carrinhoAberto && (
        <>
          <div className="sidebar__scrim" style={{ display: 'block' }} onClick={fecharCarrinho} />
          <div className="cart-drawer cart-drawer--open">
            <div className="cart-drawer__header">
              <div>
                <h3>Mesa {mesaSelecionada?.numero}</h3>
                <span className="field-hint">Comanda atual</span>
              </div>
              <button className="modal__close" onClick={fecharCarrinho}><Icon name="close" size={18} /></button>
            </div>

            <div className="type-tabs" style={{ padding: '20px 20px' }}>
              {tipos.map((t) => (
                <button key={t.id} className={`type-tab ${tipoAtivo === t.id ? 'active' : ''}`} onClick={() => setTipoAtivo(t.id)}>
                  {t.nome}
                </button>
              ))}
            </div>

            <div style={{ padding: '12px 20px', overflowY: 'auto' }}>
              {tipoAtivoObj?.permite_meio_a_meio && (
                <button type="button" className="pizza-combo-btn" onClick={abrirModalPizza}>
                  <span className="pizza-combo-btn__icon"><Icon name="plate" size={18} /></span>
                  <span>
                    <span className="pizza-combo-btn__title">Montar pizza meio a meio</span>
                    <span className="pizza-combo-btn__desc">Escolha dois sabores de {tipoAtivoObj.nome}</span>
                  </span>
                </button>
              )}
              <div className="product-grid">
                {produtosFiltrados.map((p) => (
                  <div key={p.id} className="product-card">
                    <div className="product-card__img">
                      {p.foto_url ? <img src={p.foto_url} alt={p.nome} /> : <Icon name="burger" size={26} />}
                    </div>
                    <div className="product-card__body">
                      <div className="product-card__name">{p.nome}</div>
                      <div className="product-card__price mono">R$ {Number(p.valor).toFixed(2)}</div>
                      <button className="btn btn--accent btn--sm btn--block" onClick={() => adicionarItem(p)} disabled={carregando}>
                        <Icon name="plus" size={13} /> Adicionar
                      </button>
                    </div>
                  </div>
                ))}
                {produtosFiltrados.length === 0 && <p className="field-hint">Nenhum produto ativo nesse tipo.</p>}
              </div>
            </div>

            <div className="cart-drawer__list" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto', maxHeight: 200 }}>
              {itens.length === 0 && <p className="field-hint">Nenhum item na comanda ainda.</p>}
              {itens.map((i) => (
                <div key={i.id} className="cart-item">
                  <span>{i.observacao || i.produtos?.nome}</span>
                  <div className="cart-item__qty">
                    <button className="qty-btn" onClick={() => alterarQtd(i, -1)}>−</button>
                    <span className="mono">{i.quantidade}</span>
                    <button className="qty-btn" onClick={() => alterarQtd(i, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-drawer__footer">
              <div className="ticket__total" style={{ marginBottom: 12 }}>
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              <button className="btn btn--primary btn--block" onClick={enviarParaCozinha} disabled={enviando || itens.length === 0}>
                {enviando ? 'Enviando...' : 'Enviar para a cozinha'}
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={pizzaModalAberto}
        onClose={() => setPizzaModalAberto(false)}
        title="Montar pizza meio a meio"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setPizzaModalAberto(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={adicionarPizzaMeioAMeio} disabled={salvandoPizza}>
              {salvandoPizza ? 'Adicionando...' : 'Adicionar à comanda'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid--single">
          {erroPizza && <div className="alert alert--danger">{erroPizza}</div>}
          <div className="field">
            <label>1ª metade</label>
            <select value={saborUmId} onChange={(e) => setSaborUmId(e.target.value)}>
              <option value="">Selecione o sabor</option>
              {produtosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} — R$ {Number(p.valor).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>2ª metade</label>
            <select value={saborDoisId} onChange={(e) => setSaborDoisId(e.target.value)}>
              <option value="">Selecione o sabor</option>
              {produtosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} — R$ {Number(p.valor).toFixed(2)}</option>
              ))}
            </select>
          </div>
          {precoPizzaPreview !== null && (
            <div className="ticket__total">
              <span>Valor da pizza</span>
              <span>R$ {precoPizzaPreview.toFixed(2)}</span>
            </div>
          )}
          <p className="field-hint">É cobrado o valor do sabor mais caro entre os dois escolhidos.</p>
        </div>
      </Modal>
    </div>
  )
}
