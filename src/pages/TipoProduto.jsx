import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { StatusAtivoBadge } from '../components/StatusBadge'

const emptyForm = { id: null, nome: '', status: true, permite_meio_a_meio: false }

export default function TipoProduto() {
  const { rows, loading, insert, update, remove } = useSupabaseTable('tipos_produto', { orderBy: 'nome', ascending: true })
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm(emptyForm); setErro(''); setModalAberto(true) }
  const abrirEdicao = (t) => { setForm(t); setErro(''); setModalAberto(true) }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Informe o nome do tipo.'); return }
    setSalvando(true)
    setErro('')
    try {
      const payload = { nome: form.nome.trim(), status: form.status, permite_meio_a_meio: form.permite_meio_a_meio }
      if (form.id) await update(form.id, payload)
      else await insert(payload)
      setModalAberto(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (t) => {
    if (!confirm(`Excluir o tipo "${t.nome}"? Produtos vinculados podem ficar sem categoria.`)) return
    try { await remove(t.id) } catch (err) { alert('Erro: ' + err.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Tipo de Produto</div>
          <div className="page-header__subtitle">Categorias usadas no cardápio</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--accent" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo tipo</button>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Nome do tipo</th><th>Meio a meio</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}>Carregando...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5}>Nenhum tipo cadastrado.</td></tr>}
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="cell-id">{t.id.slice(0, 8)}</td>
                  <td>{t.nome}</td>
                  <td>{t.permite_meio_a_meio ? <span className="badge badge--info">Habilitado</span> : <span className="badge badge--neutral">—</span>}</td>
                  <td><StatusAtivoBadge ativo={t.status} /></td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn--ghost btn--icon btn--sm" onClick={() => abrirEdicao(t)}><Icon name="edit" size={15} /></button>
                      <button className="btn btn--danger btn--icon btn--sm" onClick={() => excluir(t)}><Icon name="trash" size={15} /></button>
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
        title={form.id ? 'Editar tipo' : 'Novo tipo'}
        footer={<>
          <button className="btn btn--ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>}
      >
        <form className="form-grid form-grid--single" onSubmit={salvar}>
          {erro && <div className="alert alert--danger">{erro}</div>}
          <div className="field">
            <label>Nome do tipo</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Bebidas" />
          </div>

          <div className="buttons-edit">
            <div className="field toggle-row">
              <span>{form.status ? 'Ativo' : 'Inativo'}</span>
              <label className="switch">
                <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} />
                <span className="switch-track" />
              </label>
              
            </div>
            <div className="field toggle-row">
              <span>Permite montar "meio a meio"</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!form.permite_meio_a_meio}
                  onChange={(e) => setForm((f) => ({ ...f, permite_meio_a_meio: e.target.checked }))}
                />
                <span className="switch-track" />
              </label>
              
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
