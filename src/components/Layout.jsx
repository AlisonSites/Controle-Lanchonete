import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { PAGES } from '../pagesConfig'
import Icon from './Icon'
import './Layout.css'

export default function Layout({ children }) {
  const { usuario, logout, podeAcessar, isAdmin } = useAuth()
  const { naoLidas } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const itensMenu = PAGES.filter((p) => isAdmin || podeAcessar(p.chave))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__mark mono">C+</span>
          <span className="sidebar__name">Comanda<b>+</b></span>
          <button className="sidebar__close" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/" end className="sidebar__link" onClick={() => setOpen(false)}>
            <Icon name="home" size={18} /> <span>Início</span>
          </NavLink>
          {itensMenu.map((p) => (
            <NavLink key={p.chave} to={p.rota} className="sidebar__link" onClick={() => setOpen(false)}>
              <Icon name={p.icone} size={18} /> <span>{p.titulo}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar mono">{usuario?.nome?.[0]?.toUpperCase() || '?'}</div>
            <div>
              <div className="sidebar__user-name">{usuario?.nome}</div>
              <div className="sidebar__user-role">{usuario?.perfil_nome}</div>
            </div>
          </div>
          <button className="sidebar__logout" onClick={handleLogout}>
            <Icon name="logout" size={17} /> Sair
          </button>
        </div>
      </aside>

      {open && <div className="sidebar__scrim" onClick={() => setOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="topbar__menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar__spacer" />
          <div className="topbar__notif">
            <button
              className="topbar__bell"
              onClick={() => navigate('/notificacoes')}
              aria-label="Notificações"
            >
              <Icon name="bell" size={19} />
              {naoLidas > 0 && <span className="topbar__bell-badge">{naoLidas > 9 ? '9+' : naoLidas}</span>}
            </button>
          </div>
          <div className="topbar__user mono">PIN de {usuario?.nome?.split(' ')[0]}</div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
