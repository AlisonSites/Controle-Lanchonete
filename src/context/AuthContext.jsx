import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)
const STORAGE_KEY = 'comandaplus_session'

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [permissoes, setPermissoes] = useState([])
  const [loading, setLoading] = useState(true)

  const loadPermissoes = useCallback(async (perfilId) => {
    if (!perfilId) return []
    const { data, error } = await supabase
      .from('permissoes_perfil')
      .select('pagina, pode_acessar')
      .eq('perfil_id', perfilId)
      .eq('pode_acessar', true)
    if (error) {
      console.error('Erro ao carregar permissões', error)
      return []
    }
    return data.map((p) => p.pagina)
  }, [])

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setUsuario(parsed)
          const perms = await loadPermissoes(parsed.perfil_id)
          setPermissoes(perms)
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
      setLoading(false)
    }
    restore()
  }, [loadPermissoes])

  const login = useCallback(async (pin) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, pin, status, perfil_id, perfis_acesso(id, nome, status)')
      .eq('pin', pin)
      .eq('status', true)
      .maybeSingle()

    if (error) throw new Error('Erro ao consultar usuário: ' + error.message)
    if (!data) throw new Error('PIN inválido ou usuário inativo.')
    if (data.perfis_acesso && data.perfis_acesso.status === false) {
      throw new Error('Perfil de acesso inativo. Fale com o administrador.')
    }

    const sessionUser = {
      id: data.id,
      nome: data.nome,
      perfil_id: data.perfil_id,
      perfil_nome: data.perfis_acesso?.nome || '—',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
    setUsuario(sessionUser)
    const perms = await loadPermissoes(sessionUser.perfil_id)
    setPermissoes(perms)
    return sessionUser
  }, [loadPermissoes])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUsuario(null)
    setPermissoes([])
  }, [])

  const podeAcessar = useCallback((pagina) => {
    if (!pagina) return true
    if (permissoes.includes(pagina)) return true
    return false
  }, [permissoes])

  const value = useMemo(() => ({
    usuario,
    permissoes,
    loading,
    login,
    logout,
    podeAcessar,
    isAdmin: usuario?.perfil_nome === 'Administrador',
  }), [usuario, permissoes, loading, login, logout, podeAcessar])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
