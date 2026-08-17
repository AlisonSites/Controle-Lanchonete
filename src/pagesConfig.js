// Registro central das páginas do sistema.
// "chave" precisa bater com a coluna `pagina` da tabela permissoes_perfil.

export const PAGES = [
  {
    chave: 'dashboard',
    titulo: 'Dashboard',
    descricao: 'Visão geral do dia: vendas, mesas e fila da cozinha',
    rota: '/dashboard',
    icone: 'grid',
    categoria: 'Visão Geral',
  },
  {
    chave: 'fazer_pedido',
    titulo: 'Fazer Pedido',
    descricao: 'Selecione a mesa e monte a comanda',
    rota: '/pedidos/novo',
    icone: 'plate',
    categoria: 'Atendimento',
  },
  {
    chave: 'controle_pedido',
    titulo: 'Controle de Pedido',
    descricao: 'Acompanhe e gerencie as comandas abertas',
    rota: '/pedidos/controle',
    icone: 'ticket',
    categoria: 'Atendimento',
  },
  {
    chave: 'finalizar_pedido',
    titulo: 'Finalizar Pedido',
    descricao: 'Feche a conta e registre o pagamento',
    rota: '/pedidos/finalizar',
    icone: 'check',
    categoria: 'Atendimento',
  },
  {
    chave: 'produtos',
    titulo: 'Cadastro de Produtos',
    descricao: 'Gerencie o cardápio da lanchonete',
    rota: '/cadastros/produtos',
    icone: 'burger',
    categoria: 'Cadastros',
  },
  {
    chave: 'tipos',
    titulo: 'Tipo de Produto',
    descricao: 'Categorias do cardápio',
    rota: '/cadastros/tipos',
    icone: 'tag',
    categoria: 'Cadastros',
  },
  {
    chave: 'mesas',
    titulo: 'Cadastro de Mesas',
    descricao: 'Mesas, status e QR Code do cardápio',
    rota: '/cadastros/mesas',
    icone: 'table',
    categoria: 'Cadastros',
  },
  {
    chave: 'usuarios',
    titulo: 'Cadastro de Usuários',
    descricao: 'Equipe com acesso ao sistema',
    rota: '/cadastros/usuarios',
    icone: 'user',
    categoria: 'Administração',
  },
  {
    chave: 'perfis',
    titulo: 'Perfil de Acesso',
    descricao: 'Perfis: Administrador, Garçom, Cozinha...',
    rota: '/cadastros/perfis',
    icone: 'shield',
    categoria: 'Administração',
  },
  {
    chave: 'acessos',
    titulo: 'Gerenciamento de Acesso',
    descricao: 'Defina o que cada perfil pode acessar',
    rota: '/cadastros/acessos',
    icone: 'lock',
    categoria: 'Administração',
  },
  {
    chave: 'relatorio',
    titulo: 'Relatório',
    descricao: 'Relatórios gerais com exportação',
    rota: '/relatorio',
    icone: 'chart',
    categoria: 'Administração',
  },
]

export const findPageByRoute = (pathname) =>
  PAGES.find((p) => pathname.startsWith(p.rota))
