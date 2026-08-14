import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Home from './pages/Home'
import MesaCliente from './pages/MesaCliente'
import CadastroProdutos from './pages/CadastroProdutos'
import TipoProduto from './pages/TipoProduto'
import CadastroMesas from './pages/CadastroMesas'
import CadastroUsuarios from './pages/CadastroUsuarios'
import CadastroPerfilAcesso from './pages/CadastroPerfilAcesso'
import GerenciamentoAcesso from './pages/GerenciamentoAcesso'
import ControlePedido from './pages/ControlePedido'
import FazerPedido from './pages/FazerPedido'
import FinalizarPedido from './pages/FinalizarPedido'
import Relatorio from './pages/Relatorio'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/mesa/:token" element={<MesaCliente />} />

          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

          <Route path="/cadastros/produtos" element={<ProtectedRoute pageKey="produtos"><CadastroProdutos /></ProtectedRoute>} />
          <Route path="/cadastros/tipos" element={<ProtectedRoute pageKey="tipos"><TipoProduto /></ProtectedRoute>} />
          <Route path="/cadastros/mesas" element={<ProtectedRoute pageKey="mesas"><CadastroMesas /></ProtectedRoute>} />
          <Route path="/cadastros/usuarios" element={<ProtectedRoute pageKey="usuarios"><CadastroUsuarios /></ProtectedRoute>} />
          <Route path="/cadastros/perfis" element={<ProtectedRoute pageKey="perfis"><CadastroPerfilAcesso /></ProtectedRoute>} />
          <Route path="/cadastros/acessos" element={<ProtectedRoute pageKey="acessos"><GerenciamentoAcesso /></ProtectedRoute>} />

          <Route path="/pedidos/controle" element={<ProtectedRoute pageKey="controle_pedido"><ControlePedido /></ProtectedRoute>} />
          <Route path="/pedidos/novo" element={<ProtectedRoute pageKey="fazer_pedido"><FazerPedido /></ProtectedRoute>} />
          <Route path="/pedidos/finalizar" element={<ProtectedRoute pageKey="finalizar_pedido"><FinalizarPedido /></ProtectedRoute>} />

          <Route path="/relatorio" element={<ProtectedRoute pageKey="relatorio"><Relatorio /></ProtectedRoute>} />

          <Route path="*" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
