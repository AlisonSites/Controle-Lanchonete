import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { StatusAtivoBadge } from '../components/StatusBadge'

const SELECT = 'id, foto_url, nome, valor, status, criado_em, tipo_id, tipos_produto(nome)'

const emptyForm = { id: null, nome: '', tipo_id: '', valor: '', status: true, foto_url: '', foto_file: null }

export default function CadastroProdutos() {
  const { rows: produtos, loading, insert, update, remove } = useSupabaseTable('produtos', { select: SELECT })
  const { rows: tipos } = useSupabaseTable('tipos_produto', { orderBy: 'nome', ascending: true })

  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [ficha, setFicha] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo))
  }, [produtos, busca])

  const abrirNovo = () => {
    setForm(emptyForm)
    setErro('')
    setModalAberto(true)
  }

  const abrirEdicao = (p) => {
    setForm({
      id: p.id,
      nome: p.nome,
      tipo_id: p.tipo_id || '',
      valor: p.valor,
      status: p.status,
      foto_url: p.foto_url || '',
      foto_file: null,
    })
    setErro('')
    setModalAberto(true)
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.tipo_id || form.valor === '') {
      setErro('Preencha nome, tipo e valor do produto.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      let foto_url = form.foto_url
      if (form.foto_file) {
        const ext = form.foto_file.name.split('.').pop()
        const path = `produto-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('produtos').upload(path, form.foto_file, { upsert: true })
        if (upErr) throw new Error('Falha no upload da foto: ' + upErr.message)
        const { data: pub } = supabase.storage.from('produtos').getPublicUrl(path)
        foto_url = pub.publicUrl
      }

      const payload = {
        nome: form.nome.trim(),
        tipo_id: form.tipo_id,
        valor: Number(form.valor),
        status: form.status,
        foto_url,
      }

      if (form.id) {
        await update(form.id, payload)
      } else {
        await insert(payload)
      }
      setModalAberto(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (p) => {
    if (!confirm(`Excluir o produto "${p.nome}"?`)) return
    try {
      await remove(p.id)
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Cadastro de Produtos</div>
          <div className="page-header__subtitle">Gerencie os itens do cardápio da lanchonete</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--accent" onClick={abrirNovo}>
            <Icon name="plus" size={16} /> Novo produto
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel__toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input placeholder="Buscar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}>Carregando...</td></tr>}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan={7}>Nenhum produto encontrado.</td></tr>
              )}
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.foto_url
                      ? <img className="thumb" src={p.foto_url} alt={p.nome} />
                      : <div className="thumb" />}
                  </td>
                  <td className="cell-id">{p.id.slice(0, 8)}</td>
                  <td>{p.nome}</td>
                  <td>{p.tipos_produto?.nome || '—'}</td>
                  <td className="mono">R$ {Number(p.valor).toFixed(2)}</td>
                  <td><StatusAtivoBadge ativo={p.status} /></td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn--ghost btn--sm" onClick={() => setFicha(p)}>Ver ficha</button>
                      <button className="btn btn--ghost btn--icon btn--sm" onClick={() => abrirEdicao(p)} aria-label="Editar">
                        <Icon name="edit" size={15} />
                      </button>
                      <button className="btn btn--danger btn--icon btn--sm" onClick={() => excluir(p)} aria-label="Excluir">
                        <Icon name="trash" size={15} />
                      </button>
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
        title={form.id ? 'Editar produto' : 'Novo produto'}
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={salvar}>
          {erro && <div className="alert alert--danger field--full">{erro}</div>}
          <div className="field field--full">
            <label>Foto do produto</label>
            <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, foto_file: e.target.files[0] }))} />
          </div>
          <div className="field field--full">
            <label>Nome do produto</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: X-Salada" />
          </div>
          <div className="field">
            <label>Tipo de produto</label>
            <select value={form.tipo_id} onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))}>
              <option value="">Selecione</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Valor (R$)</label>
            <input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="field field--full toggle-row">
            <label className="switch">
              <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} />
              <span className="switch-track" />
            </label>
            <span>{form.status ? 'Produto ativo' : 'Produto inativo'}</span>
          </div>
        </form>
      </Modal>

      <Modal open={!!ficha} onClose={() => setFicha(null)} title="Ficha do produto">
        {ficha && (
          <div>
            {ficha.foto_url && <img src={ficha.foto_url} alt={ficha.nome} style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />}
            <p><b>ID:</b> <span className="mono">{ficha.id}</span></p>
            <p><b>Nome:</b> {ficha.nome}</p>
            <p><b>Tipo:</b> {ficha.tipos_produto?.nome || '—'}</p>
            <p><b>Valor:</b> R$ {Number(ficha.valor).toFixed(2)}</p>
            <p><b>Status:</b> <StatusAtivoBadge ativo={ficha.status} /></p>
          </div>
        )}
      </Modal>
    </div>
  )
}
