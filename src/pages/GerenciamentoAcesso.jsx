import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { PAGES } from '../pagesConfig'
import Icon from '../components/Icon'

export default function GerenciamentoAcesso() {
  const { rows: perfis, loading: loadingPerfis } = useSupabaseTable('perfis_acesso', { orderBy: 'nome', ascending: true })
  const [permissoes, setPermissoes] = useState([]) // { perfil_id, pagina, pode_acessar }
  const [loading, setLoading] = useState(true)
  const [perfilAtivoId, setPerfilAtivoId] = useState(null)
  const [salvandoChave, setSalvandoChave] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      const { data } = await supabase.from('permissoes_perfil').select('perfil_id, pagina, pode_acessar')
      setPermissoes(data || [])
      setLoading(false)
    }
    carregar()
  }, [])

  useEffect(() => {
    if (!perfilAtivoId && perfis.length > 0) setPerfilAtivoId(perfis[0].id)
  }, [perfis, perfilAtivoId])

  const perfilAtivo = perfis.find((p) => p.id === perfilAtivoId)
  const isAdministrador = perfilAtivo?.nome === 'Administrador'

  const mapaPerfilAtivo = useMemo(() => {
    const m = {}
    permissoes
      .filter((p) => p.perfil_id === perfilAtivoId)
      .forEach((p) => { m[p.pagina] = p.pode_acessar })
    return m
  }, [permissoes, perfilAtivoId])

  const categorias = useMemo(() => {
    const grupos = {}
    PAGES.forEach((p) => {
      const cat = p.categoria || 'Outros'
      if (!grupos[cat]) grupos[cat] = []
      grupos[cat].push(p)
    })
    return grupos
  }, [])

  const totalLiberado = PAGES.filter((p) => isAdministrador || mapaPerfilAtivo[p.chave]).length

  const salvarPermissao = async (pagina, valor) => {
    const chave = `${perfilAtivoId}__${pagina}`
    setSalvandoChave(chave)
    setMsg('')
    try {
      const { error } = await supabase
        .from('permissoes_perfil')
        .upsert({ perfil_id: perfilAtivoId, pagina, pode_acessar: valor }, { onConflict: 'perfil_id,pagina' })
      if (error) throw error
      setPermissoes((prev) => {
        const semEssa = prev.filter((p) => !(p.perfil_id === perfilAtivoId && p.pagina === pagina))
        return [...semEssa, { perfil_id: perfilAtivoId, pagina, pode_acessar: valor }]
      })
    } catch (err) {
      setMsg('Erro ao salvar: ' + err.message)
    } finally {
      setSalvandoChave('')
    }
  }

  const alternar = (pagina) => salvarPermissao(pagina, !mapaPerfilAtivo[pagina])

  const marcarTodos = async (valor) => {
    if (isAdministrador) return
    for (const page of PAGES) {
      // eslint-disable-next-line no-await-in-loop
      await salvarPermissao(page.chave, valor)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Gerenciamento de Acesso</div>
          <div className="page-header__subtitle">Escolha um perfil e defina quais páginas ele pode acessar</div>
        </div>
      </div>

      {msg && <div className="alert alert--danger">{msg}</div>}

      {loadingPerfis ? (
        <p className="field-hint">Carregando perfis...</p>
      ) : perfis.length === 0 ? (
        <div className="empty-state"><h2>Nenhum perfil cadastrado</h2><p>Crie um perfil em "Perfil de Acesso" primeiro.</p></div>
      ) : (
        <>
          <div className="type-tabs">
            {perfis.map((p) => (
              <button
                key={p.id}
                className={`type-tab ${perfilAtivoId === p.id ? 'active' : ''}`}
                onClick={() => setPerfilAtivoId(p.id)}
              >
                <Icon name="shield" size={13} /> {p.nome}
              </button>
            ))}
          </div>

          <div className="panel">
            <div className="panel__toolbar" style={{ justifyContent: 'space-between' }}>
              <div>
                <b>{perfilAtivo?.nome}</b>
                <span className="field-hint" style={{ marginLeft: 8 }}>
                  {isAdministrador ? 'Acesso total (não editável)' : `${totalLiberado} de ${PAGES.length} páginas liberadas`}
                </span>
              </div>
              {!isAdministrador && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => marcarTodos(true)}>Liberar tudo</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => marcarTodos(false)}>Bloquear tudo</button>
                </div>
              )}
            </div>

            {isAdministrador && (
              <div className="alert alert--info" style={{ margin: '16px 18px 0' }}>
                O perfil Administrador sempre tem acesso a todas as páginas do sistema e não pode ser restringido.
              </div>
            )}

            <div style={{ padding: '8px 18px 20px' }}>
              {loading ? (
                <p className="field-hint">Carregando permissões...</p>
              ) : (
                Object.entries(categorias).map(([categoria, paginas]) => (
                  <div key={categoria} style={{ marginTop: 18 }}>
                    <div className="permission-group__title">{categoria}</div>
                    <div className="permission-list">
                      {paginas.map((page) => {
                        const chave = `${perfilAtivoId}__${page.chave}`
                        const marcado = isAdministrador || !!mapaPerfilAtivo[page.chave]
                        const salvandoEssa = salvandoChave === chave
                        return (
                          <label key={page.chave} className={`permission-row ${marcado ? 'permission-row--on' : ''}`}>
                            <div className="permission-row__icon">
                              <Icon name={page.icone} size={17} />
                            </div>
                            <div className="permission-row__text">
                              <div className="permission-row__title">{page.titulo}</div>
                              <div className="permission-row__desc">{page.descricao}</div>
                            </div>
                            <span className="switch">
                              <input
                                type="checkbox"
                                checked={marcado}
                                disabled={isAdministrador || salvandoEssa}
                                onChange={() => alternar(page.chave)}
                              />
                              <span className="switch-track" />
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
