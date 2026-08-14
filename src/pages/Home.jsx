import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PAGES } from '../pagesConfig'
import Icon from '../components/Icon'

export default function Home() {
  const { usuario, podeAcessar, isAdmin } = useAuth()
  const navigate = useNavigate()

  const modulos = PAGES.filter((p) => isAdmin || podeAcessar(p.chave))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Olá, {usuario?.nome?.split(' ')[0]} </div>
          <div className="page-header__subtitle">Escolha um módulo para começar — perfil {usuario?.perfil_nome}</div>
        </div>
      </div>

      {modulos.length === 0 ? (
        <div className="empty-state">
          <h2>Nenhum módulo liberado</h2>
          <p>Peça ao administrador para liberar o acesso do seu perfil em Gerenciamento de Acesso.</p>
        </div>
      ) : (
        <div className="card-grid">
          {modulos.map((m) => (
            <div key={m.chave} className="module-card" onClick={() => navigate(m.rota)}>
              <div className="module-card__icon">
                <Icon name={m.icone} size={22} />
              </div>
              <div>
                <div className="module-card__title">{m.titulo}</div>
                <div className="module-card__desc">{m.descricao}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
