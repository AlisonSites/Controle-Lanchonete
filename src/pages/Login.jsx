import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const addDigit = (d) => {
    if (pin.length >= 4) return
    setErro('')
    setPin((prev) => prev + d)
  }

  const removeDigit = () => setPin((prev) => prev.slice(0, -1))

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (pin.length !== 4) {
      setErro('Digite os 4 números do seu PIN.')
      return
    }
    setCarregando(true)
    setErro('')
    try {
      await login(pin)
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err) {
      setErro(err.message)
      setPin('')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__brand">
          <span className="login-card__mark mono">C+</span>
          <h1>Comanda<b>+</b></h1>
        </div>
        <p className="login-card__subtitle">Acesse com o PIN de 4 dígitos cadastrado</p>

        <form onSubmit={handleSubmit} className="login-card__form">
          <div className="pin-display">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`pin-dot ${pin.length > i ? 'pin-dot--filled' : ''}`} />
            ))}
          </div>

          {erro && <div className="alert alert--danger">{erro}</div>}

          <div className="pin-pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button type="button" key={d} className="pin-key" onClick={() => addDigit(d)}>
                {d}
              </button>
            ))}
            <button type="button" className="pin-key pin-key--muted" onClick={removeDigit}>
              ⌫
            </button>
            <button type="button" className="pin-key" onClick={() => addDigit('0')}>
              0
            </button>
            <button type="submit" className="pin-key pin-key--accent" disabled={carregando}>
              {carregando ? '...' : 'OK'}
            </button>
          </div>
        </form>

        <p className="login-card__hint">PIN de demonstração do administrador: <span className="mono">1234</span></p>
      </div>
    </div>
  )
}
