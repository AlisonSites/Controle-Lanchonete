import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from '../components/Modal'
import Icon from '../components/Icon'

export default function ControlePedido() {
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalhe, setDetalhe] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    // Busca apenas os ITENS ainda pendentes (aguardando preparo), já com o
    // pedido/mesa relacionados. Assim, itens que já foram marcados como
    // "Pedido realizado" não reaparecem quando um item novo é adicionado
    // depois - só o que realmente é novo entra na fila da cozinha.
    const { data } = await supabase
      .from('itens_pedido')
      .select('id, pedido_id, quantidade, valor_unitario, observacao, criado_em, produtos(nome), pedidos!inner(id, criado_em, origem, usuario_id, mesas(numero), usuarios(nome))')
      .eq('status', 'pendente')
      .neq('pedidos.status', 'concluido')
      .neq('pedidos.status', 'cancelado')
      .order('criado_em', { ascending: true })

    const mapa = {}
    ;(data || []).forEach((item) => {
      const pid = item.pedido_id
      if (!mapa[pid]) {
        mapa[pid] = {
          pedidoId: pid,
          mesaNumero: item.pedidos?.mesas?.numero,
          origem: item.pedidos?.origem,
          usuarioId: item.pedidos?.usuario_id,
          usuarioNome: item.pedidos?.usuarios?.nome,
          criadoEm: item.pedidos?.criado_em,
          itens: [],
        }
      }
      mapa[pid].itens.push(item)
    })
    const lista = Object.values(mapa).sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
    setGrupos(lista)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('pedidos-controle')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [carregar])

  const totalGrupo = (grupo) => grupo.itens.reduce((a, i) => a + i.quantidade * i.valor_unitario, 0)

  const marcarPedidoRealizado = async (grupo) => {
    // Marca como "pronto" só os itens que estavam pendentes neste momento.
    // A mesa continua ocupada - ela só é liberada em "Finalizar Pedido".
    const ids = grupo.itens.map((i) => i.id)
    await supabase.from('itens_pedido').update({ status: 'pronto' }).in('id', ids)

    // Avisa quem precisa saber: se foi o cliente que pediu pelo QR Code,
    // manda para todo mundo com acesso a Fazer Pedido; se foi um garçom,
    // manda só para ele.
    const mensagem = `Pedido da Mesa ${grupo.mesaNumero} foi realizado!`
    if (grupo.origem === 'cliente_qrcode') {
      await supabase.from('notificacoes').insert({
        tipo: 'pedido_realizado',
        mensagem,
        mesa_numero: grupo.mesaNumero,
        usuario_destino_id: null,
      })
    } else if (grupo.usuarioId) {
      await supabase.from('notificacoes').insert({
        tipo: 'pedido_realizado',
        mensagem,
        mesa_numero: grupo.mesaNumero,
        usuario_destino_id: grupo.usuarioId,
      })
    }

    setDetalhe(null)
    carregar()
  }

  const cancelarPedido = async (grupo) => {
    if (!confirm('Cancelar este pedido? Essa ação não pode ser desfeita.')) return
    await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', grupo.pedidoId)
    await supabase.from('itens_pedido').update({ status: 'cancelado' }).eq('pedido_id', grupo.pedidoId).eq('status', 'pendente')
    const { data: mesaData } = await supabase.from('pedidos').select('mesa_id').eq('id', grupo.pedidoId).single()
    if (mesaData) await supabase.from('mesas').update({ status: 'disponivel' }).eq('id', mesaData.mesa_id)
    setDetalhe(null)
    carregar()
  }

  const imprimir = (grupo) => {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Comanda Mesa ${grupo.mesaNumero}</title></head>
      <body style="font-family: monospace; padding: 20px; width: 280px;">
        <h2 style="text-align:center">COMANDA+</h2>
        <p style="text-align:center">Mesa ${grupo.mesaNumero}</p>
        <hr />
        ${grupo.itens.map((i) => `<p>${i.quantidade}x ${i.observacao || i.produtos?.nome} .... R$ ${(i.quantidade * i.valor_unitario).toFixed(2)}</p>`).join('')}
        <hr />
        <p><b>Total: R$ ${totalGrupo(grupo).toFixed(2)}</b></p>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Controle de Pedido</div>
          <div className="page-header__subtitle">Itens novos aguardando preparo, por mesa</div>
        </div>
      </div>

      {loading && <p className="field-hint">Carregando...</p>}
      {!loading && grupos.length === 0 && (
        <div className="empty-state"><h2>Nenhum item pendente</h2><p>Assim que uma mesa enviar um item, ele aparece aqui.</p></div>
      )}

      <div className="card-grid">
        {grupos.map((g) => (
          <div key={g.pedidoId} className="ticket" onClick={() => setDetalhe(g)}>
            <div className="ticket__head">
              <div>
                <div className="ticket__table">Mesa {g.mesaNumero}</div>
                <div className="ticket__meta"><Icon name="clock" size={13} /> {new Date(g.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <span className="badge badge--warning">{g.itens.length} {g.itens.length === 1 ? 'item novo' : 'itens novos'}</span>
            </div>
            <div className="ticket__num">{g.origem === 'cliente_qrcode' ? 'via QR Code' : (g.usuarioNome || 'Garçom')}</div>
            <div className="ticket__total"><span>Total dos itens novos</span><span>R$ {totalGrupo(g).toFixed(2)}</span></div>
          </div>
        ))}
      </div>

      <Modal
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `Itens pendentes — Mesa ${detalhe.mesaNumero}` : ''}
        footer={detalhe && (
          <>
            <button className="btn btn--danger" onClick={() => cancelarPedido(detalhe)}>Cancelar pedido</button>
            <button className="btn btn--ghost" onClick={() => imprimir(detalhe)}><Icon name="print" size={15} /> Imprimir comanda</button>
            <button className="btn btn--success" onClick={() => marcarPedidoRealizado(detalhe)}><Icon name="check" size={15} /> Pedido realizado</button>
          </>
        )}
      >
        {detalhe && (
          <div>
            <p className="field-hint" style={{ marginBottom: 10 }}>
              Somente os itens ainda não preparados aparecem aqui. Itens já marcados como "Pedido realizado" anteriormente não voltam a esta lista.
            </p>
            <div className="ticket__items">
              {detalhe.itens.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{i.quantidade}x {i.observacao || i.produtos?.nome}</span>
                  <span className="mono">R$ {(i.quantidade * i.valor_unitario).toFixed(2)}</span>
                </div>
              ))}
              {detalhe.itens.length === 0 && <p className="field-hint">Sem itens pendentes.</p>}
            </div>
            <div className="ticket__total">
              <span>Total</span>
              <span>R$ {totalGrupo(detalhe).toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
