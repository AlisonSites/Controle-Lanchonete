import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'
import Icon from '../components/Icon'
import './NotificationContext.css'

const NotificationContext = createContext(null)
const MAX_TOASTS = 4
const MAX_NOTIFICACOES = 200
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
  const [notificacoes, setNotificacoes] = useState([])
  const [toasts, setToasts] = useState([])

  const relevantePara = useCallback((notif) => {
    if (!usuario) return false
    if (notif.usuario_destino_id) return notif.usuario_destino_id === usuario.id
    if (notif.tipo === 'novo_pedido') return isAdmin || podeAcessar('controle_pedido')
    if (notif.tipo === 'pedido_realizado') return isAdmin || podeAcessar('fazer_pedido')
    return false
  }, [usuario, isAdmin, podeAcessar])

  // Carrega o histórico já salvo no banco (funciona mesmo depois de recarregar
  // a página ou trocar de dispositivo, já que o status "vista/arquivada" é
  // gravado no banco através da coluna "lida").
  const carregarNotificacoes = useCallback(async () => {
    if (!usuario) {
      setNotificacoes([])
      return
    }
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .or(`usuario_destino_id.eq.${usuario.id},usuario_destino_id.is.null`)
      .order('criado_em', { ascending: false })
      .limit(MAX_NOTIFICACOES)
    setNotificacoes((data || []).filter(relevantePara))
  }, [usuario, relevantePara])

  useEffect(() => {
    carregarNotificacoes()
  }, [carregarNotificacoes])

  const dispensarToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const dispararToast = useCallback((notif) => {
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
        if (!relevantePara(notif)) return
        setNotificacoes((prev) => [notif, ...prev].slice(0, MAX_NOTIFICACOES))
        dispararToast(notif)
      })
      .subscribe()

    return () => supabase.removeChannel(canal)
  }, [usuario, relevantePara, dispararToast])

  // Marca como "vista": some da aba Novas e passa para Arquivadas.
  // Atualiza a tela na hora e grava no banco (persiste entre sessões).
  const marcarComoVista = useCallback(async (id) => {
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
  }, [])

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  return (
    <NotificationContext.Provider value={{ notificacoes, naoLidas, marcarComoVista }}>
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
