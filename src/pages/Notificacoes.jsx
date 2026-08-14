import { useState } from 'react'
import { useNotifications } from '../context/NotificationContext'
import Icon from '../components/Icon'

export default function Notificacoes() {
  const { notificacoes, marcarComoVista } = useNotifications()
  const [aba, setAba] = useState('novas')

  const novas = notificacoes.filter((n) => !n.lida)
  const arquivadas = notificacoes.filter((n) => n.lida)
  const lista = aba === 'novas' ? novas : arquivadas

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header__title">Notificações</div>
          <div className="page-header__subtitle">Avisos de pedidos novos e pedidos realizados</div>
        </div>
      </div>

      <div className="type-tabs">
        <button className={`type-tab ${aba === 'novas' ? 'active' : ''}`} onClick={() => setAba('novas')}>
          Novas{novas.length > 0 ? ` (${novas.length})` : ''}
        </button>
        <button className={`type-tab ${aba === 'arquivadas' ? 'active' : ''}`} onClick={() => setAba('arquivadas')}>
          Arquivadas
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <h2>{aba === 'novas' ? 'Nenhuma notificação nova' : 'Nada arquivado ainda'}</h2>
          <p>
            {aba === 'novas'
              ? 'Assim que um pedido novo chegar ou for marcado como realizado, aparece aqui.'
              : 'Notificações marcadas como "Visto" ficam guardadas aqui.'}
          </p>
        </div>
      ) : (
        <div className="notif-list">
          {lista.map((n) => (
            <div key={n.id} className={`notif-row notif-row--${n.tipo}`}>
              <span className="notif-row__icon">
                <Icon name={n.tipo === 'novo_pedido' ? 'ticket' : 'check'} size={17} />
              </span>
              <div className="notif-row__body">
                <div className="notif-row__msg">{n.mensagem}</div>
                <div className="notif-row__time">
                  {new Date(n.criado_em).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
              {aba === 'novas' && (
                <button className="btn btn--ghost btn--sm" onClick={() => marcarComoVista(n.id)}>
                  Visto
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
