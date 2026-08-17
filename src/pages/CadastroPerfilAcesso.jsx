import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { StatusAtivoBadge } from '../components/StatusBadge'

const emptyForm = { id: null, nome: '', status: true }

export default function CadastroPerfilAcesso() {
  const { rows, loading, insert, update, remove } = useSupabaseTable('perfis_acesso', { orderBy: 'nome', ascending: true })
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm(emptyForm); setErro(''); setModalAberto(true) }
  const abrirEdicao = (p) => { setForm(p); setErro(''); setModalAberto(true) }

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Informe o nome do perfil.'); return }
    setSalvando(true)
    setErro('')
    try {
      const payload = { nome: form.nome.trim(), status: form.status }
      if (form.id) await update(form.id, payload)
      else await insert(payload)
      setModalAberto(false)
    } catch (err) {
      setErro(err.message.includes('duplicate') ? 'Já existe um perfil com esse nome.' : err.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (p) => {
    if (!confirm(`Excluir o perfil "${p.nome}"? Usuários vinculados a ele podem ficar sem acesso.`)) return
    try { await remove(p.id) } catch (err) { alert('Erro: ' + err.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Perfil de Acesso</div>
          <div className="page-header__subtitle">Ex: Administrador, Garçom, Cozinha</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--accent" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo perfil</button>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Nome do perfil</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4}>Carregando...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={4}>Nenhum perfil cadastrado.</td></tr>}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="cell-id">{p.id.slice(0, 8)}</td>
                  <td>{p.nome}</td>
                  <td><StatusAtivoBadge ativo={p.status} /></td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn--ghost btn--icon btn--sm" onClick={() => abrirEdicao(p)}><Icon name="edit" size={15} /></button>
                      <button className="btn btn--danger btn--icon btn--sm" onClick={() => excluir(p)}><Icon name="trash" size={15} /></button>
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
        title={form.id ? 'Editar perfil' : 'Novo perfil'}
        footer={<>
          <button className="btn btn--ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>}
      >
        <form className="form-grid form-grid--single" onSubmit={salvar}>
          {erro && <div className="alert alert--danger">{erro}</div>}
          <div className="field">
            <label>Nome do perfil</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Caixa" />
          </div>
          <div className="field toggle-row">
            <label className="switch">
              <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} />
              <span className="switch-track" />
            </label>
            <span>{form.status ? 'Ativo' : 'Inativo'}</span>
          </div>
        </form>
      </Modal>
    </div>
  )
}
