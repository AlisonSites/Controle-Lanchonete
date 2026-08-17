import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../supabaseClient'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { StatusMesaBadge } from '../components/StatusBadge'

const emptyForm = { id: null, numero: '' }

export default function CadastroMesas() {
  const { rows, loading, insert, update, remove, refetch } = useSupabaseTable('mesas', { orderBy: 'numero', ascending: true })
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [qrMesa, setQrMesa] = useState(null)
  const qrRef = useRef(null)

  // Escuta mudanças em tempo real (feitas por outros dispositivos/usuários,
  // como o status virando "ocupada" quando um pedido é enviado) e atualiza
  // a lista automaticamente, sem precisar recarregar a página.
  useEffect(() => {
    const canal = supabase
      .channel('cadastro-mesas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => refetch())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [refetch])

  const linkCliente = (mesa) => `${window.location.origin}/mesa/${mesa.qrcode_token}`

  const abrirNovo = () => { setForm(emptyForm); setErro(''); setModalAberto(true) }
  const abrirEdicao = (m) => { setForm({ id: m.id, numero: m.numero }); setErro(''); setModalAberto(true) }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.numero) { setErro('Informe o número da mesa.'); return }
    setSalvando(true)
    setErro('')
    try {
      if (form.id) {
        await update(form.id, { numero: Number(form.numero) })
      } else {
        await insert({ numero: Number(form.numero), status: 'disponivel' })
      }
      setModalAberto(false)
    } catch (err) {
      setErro(err.message.includes('duplicate') ? 'Já existe uma mesa com esse número.' : err.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (m) => {
    if (!confirm(`Excluir a mesa ${m.numero}?`)) return
    try { await remove(m.id) } catch (err) { alert('Erro: ' + err.message) }
  }

  const baixarQr = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `mesa-${qrMesa.numero}-qrcode.png`
    a.click()
  }

  const imprimirQr = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>QR Code Mesa ${qrMesa.numero}</title></head>
      <body style="font-family: sans-serif; text-align:center; padding-top: 40px;">
        <h2>Mesa ${qrMesa.numero}</h2>
        <img src="${canvas.toDataURL('image/png')}" style="width:260px" />
        <p>Aponte a câmera para acessar o cardápio</p>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Cadastro de Mesas</div>
          <div className="page-header__subtitle">Gerencie as mesas e o QR Code de acesso ao cardápio</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--accent" onClick={abrirNovo}><Icon name="plus" size={16} /> Nova mesa</button>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Número</th><th>QR Code</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}>Carregando...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5}>Nenhuma mesa cadastrada.</td></tr>}
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="cell-id">{m.id.slice(0, 8)}</td>
                  <td><b>Mesa {m.numero}</b></td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={() => setQrMesa(m)}>
                      <Icon name="qrcode" size={15} /> Ver / gerar
                    </button>
                  </td>
                  <td><StatusMesaBadge status={m.status} /></td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn--ghost btn--icon btn--sm" onClick={() => abrirEdicao(m)}><Icon name="edit" size={15} /></button>
                      <button className="btn btn--danger btn--icon btn--sm" onClick={() => excluir(m)}><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={form.id ? 'Editar mesa' : 'Nova mesa'}
        footer={<>
          <button className="btn btn--ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>}
      >
        <form className="form-grid form-grid--single" onSubmit={salvar}>
          {erro && <div className="alert alert--danger">{erro}</div>}
          <div className="field">
            <label>Número da mesa</label>
            <input type="number" min="1" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="Ex: 12" />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!qrMesa}
        onClose={() => setQrMesa(null)}
        title={qrMesa ? `QR Code — Mesa ${qrMesa.numero}` : ''}
        footer={<>
          <button className="btn btn--ghost" onClick={imprimirQr}><Icon name="print" size={15} /> Imprimir</button>
          <button className="btn btn--primary" onClick={baixarQr}><Icon name="download" size={15} /> Baixar PNG</button>
        </>}
      >
        {qrMesa && (
          <div style={{ textAlign: 'center' }} ref={qrRef}>
            <QRCodeCanvas value={linkCliente(qrMesa)} size={220} bgColor="#ffffff" fgColor="#000045" level="M" includeMargin />
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 14, wordBreak: 'break-all' }}>
              {linkCliente(qrMesa)}
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              O cliente escaneia e acessa o cardápio apenas desta mesa, podendo montar o próprio pedido.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
