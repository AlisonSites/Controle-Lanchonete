import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { StatusAtivoBadge } from '../components/StatusBadge'

const SELECT = 'id, nome, pin, status, criado_em, perfil_id, perfis_acesso(nome)'

const gerarPin = () => String(Math.floor(1000 + Math.random() * 9000))

const emptyForm = { id: null, nome: '', pin: gerarPin(), perfil_id: '', status: true }

export default function CadastroUsuarios() {
  const { rows, loading, insert, update, remove } = useSupabaseTable('usuarios', { select: SELECT })
  const { rows: perfis } = useSupabaseTable('perfis_acesso', { orderBy: 'nome', ascending: true })

  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const abrirNovo = () => { setForm({ ...emptyForm, pin: gerarPin() }); setErro(''); setModalAberto(true) }
  const abrirEdicao = (u) => { setForm({ id: u.id, nome: u.nome, pin: u.pin, perfil_id: u.perfil_id, status: u.status }); setErro(''); setModalAberto(true) }

  const regerarPin = () => setForm((f) => ({ ...f, pin: gerarPin() }))

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.perfil_id) { setErro('Preencha nome e perfil de acesso.'); return }
    setSalvando(true)
    setErro('')
    try {
      const payload = { nome: form.nome.trim(), pin: form.pin, perfil_id: form.perfil_id, status: form.status }
      if (form.id) await update(form.id, payload)
      else await insert(payload)
      setModalAberto(false)
    } catch (err) {
      setErro(err.message.includes('duplicate') ? 'Esse PIN já está em uso, gere outro.' : err.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (u) => {
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return
    try { await remove(u.id) } catch (err) { alert('Erro: ' + err.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Cadastro de Usuários</div>
          <div className="page-header__subtitle">Equipe com acesso ao sistema, cada um com um PIN próprio</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--accent" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo usuário</button>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Nome</th><th>PIN</th><th>Perfil de acesso</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6}>Carregando...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6}>Nenhum usuário cadastrado.</td></tr>}
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="cell-id">{u.id.slice(0, 8)}</td>
                  <td>{u.nome}</td>
                  <td className="mono">{u.pin}</td>
                  <td>{u.perfis_acesso?.nome || '—'}</td>
                  <td><StatusAtivoBadge ativo={u.status} /></td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn--ghost btn--icon btn--sm" onClick={() => abrirEdicao(u)}><Icon name="edit" size={15} /></button>
                      <button className="btn btn--danger btn--icon btn--sm" onClick={() => excluir(u)}><Icon name="trash" size={15} /></button>
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
        title={form.id ? 'Editar usuário' : 'Novo usuário'}
        footer={<>
          <button className="btn btn--ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </>}
      >
        <form className="form-grid" onSubmit={salvar}>
          {erro && <div className="alert alert--danger field--full">{erro}</div>}
          <div className="field field--full">
            <label>Nome do usuário</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria Silva" />
          </div>
          <div className="field">
            <label>PIN de acesso (gerado automaticamente)</label>
            <input className="mono" value={form.pin} readOnly />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button type="button" className="btn btn--ghost btn--block" onClick={regerarPin}>Gerar novo PIN</button>
          </div>
          <div className="field field--full">
            <label>Perfil de acesso</label>
            <select value={form.perfil_id} onChange={(e) => setForm((f) => ({ ...f, perfil_id: e.target.value }))}>
              <option value="">Selecione</option>
              {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="field field--full toggle-row">
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
