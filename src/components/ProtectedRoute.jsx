import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from './Layout'

export default function ProtectedRoute({ children, pageKey }) {
  const { usuario, loading, podeAcessar, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="full-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (pageKey && !isAdmin && !podeAcessar(pageKey)) {
    return (
      <Layout>
        <div className="empty-state">
          <h2>Acesso não liberado</h2>
          <p>Seu perfil ({usuario.perfil_nome}) não tem permissão para acessar esta página. Fale com o administrador.</p>
        </div>
      </Layout>
    )
  }

  return <Layout>{children}</Layout>
}
