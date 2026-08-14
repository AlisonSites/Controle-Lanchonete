import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'
import Icon from '../components/Icon'
import './NotificationContext.css'

const NotificationContext = createContext(null)
const MAX_TOASTS = 4
const MAX_HISTORICO = 30
const DURACAO_TOAST_MS = 7000

// Toca um beep curto via Web Audio (sem depender de nenhum arquivo de som).
// Navegadores podem bloquear áudio antes de qualquer interação do usuário
// na página - por isso o try/catch, para falhar em silêncio nesse caso.
function tocarSom() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.16, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // som é um "extra"; se o navegador bloquear, a notificação visual continua
  }
}

export function NotificationProvider({ children }) {
  const { usuario, podeAcessar, isAdmin } = useAuth()
  const [historico, setHistorico] = useState([])
  const [toasts, setToasts] = useState([])
  const [naoLidas, setNaoLidas] = useState(0)

  const relevantePara = useCallback((notif) => {
    if (!usuario) return false
    if (notif.usuario_destino_id) return notif.usuario_destino_id === usuario.id
    if (notif.tipo === 'novo_pedido') return isAdmin || podeAcessar('controle_pedido')
    if (notif.tipo === 'pedido_realizado') return isAdmin || podeAcessar('fazer_pedido')
    return false
  }, [usuario, isAdmin, podeAcessar])

  const dispensarToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const adicionarNotificacao = useCallback((notif) => {
    setHistorico((prev) => [notif, ...prev].slice(0, MAX_HISTORICO))
    setNaoLidas((n) => n + 1)
    setToasts((prev) => [...prev, notif].slice(-MAX_TOASTS))
    tocarSom()
    setTimeout(() => dispensarToast(notif.id), DURACAO_TOAST_MS)
  }, [])

  useEffect(() => {
    if (!usuario) return undefined

    const canal = supabase
      .channel('notificacoes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (payload) => {
        const notif = payload.new
        if (relevantePara(notif)) adicionarNotificacao(notif)
      })
      .subscribe()

    return () => supabase.removeChannel(canal)
  }, [usuario, relevantePara, adicionarNotificacao])

  const marcarTodasLidas = () => setNaoLidas(0)

  return (
    <NotificationContext.Provider value={{ historico, naoLidas, marcarTodasLidas }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tipo}`} onClick={() => dispensarToast(t.id)}>
            <span className="toast__icon"><Icon name={t.tipo === 'novo_pedido' ? 'ticket' : 'check'} size={16} /></span>
            <div>
              <div className="toast__title">{t.tipo === 'novo_pedido' ? 'Novo pedido!' : 'Pedido realizado'}</div>
              <div className="toast__msg">{t.mensagem}</div>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications deve ser usado dentro de NotificationProvider')
  return ctx
}
