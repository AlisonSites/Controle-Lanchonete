-- =========================================================
-- COMANDA+ | Sistema de Lanchonete
-- Schema SQL para Supabase (PostgreSQL)
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- =========================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. PERFIS DE ACESSO
-- ---------------------------------------------------------
create table if not exists perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  status boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. PERMISSÕES (Gerenciamento de acesso)
-- Cada linha define se um perfil pode acessar uma página do sistema
-- ---------------------------------------------------------
create table if not exists permissoes_perfil (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis_acesso(id) on delete cascade,
  pagina text not null, -- chave da página: home, produtos, tipos, mesas, usuarios, perfis, acessos, controle_pedido, fazer_pedido, finalizar_pedido, relatorio
  pode_acessar boolean not null default false,
  unique (perfil_id, pagina)
);

-- ---------------------------------------------------------
-- 3. USUÁRIOS
-- ---------------------------------------------------------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pin char(4) not null unique,
  perfil_id uuid not null references perfis_acesso(id),
  status boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. TIPOS DE PRODUTO
-- ---------------------------------------------------------
create table if not exists tipos_produto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 5. PRODUTOS
-- ---------------------------------------------------------
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  foto_url text,
  nome text not null,
  tipo_id uuid references tipos_produto(id),
  valor numeric(10,2) not null default 0,
  status boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 6. MESAS
-- ---------------------------------------------------------
create table if not exists mesas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  qrcode_token uuid not null default gen_random_uuid(),
  status text not null default 'disponivel', -- disponivel | ocupada
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 7. PEDIDOS (comandas)
-- ---------------------------------------------------------
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id),
  usuario_id uuid references usuarios(id), -- garçom responsável (nulo se aberto pelo cliente via QR)
  origem text not null default 'garcom', -- garcom | cliente_qrcode
  status text not null default 'aberto', -- aberto | em_preparo | concluido | cancelado
  forma_pagamento text, -- dinheiro | pix | credito | debito
  valor_total numeric(10,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 8. ITENS DO PEDIDO
-- ---------------------------------------------------------
create table if not exists itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid not null references produtos(id),
  quantidade integer not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  observacao text,
  status text not null default 'pendente', -- pendente | preparo | pronto | cancelado
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TRIGGER: recalcula valor_total do pedido automaticamente
-- ---------------------------------------------------------
create or replace function atualizar_valor_total_pedido()
returns trigger as $$
begin
  update pedidos
  set valor_total = coalesce((
    select sum(quantidade * valor_unitario)
    from itens_pedido
    where pedido_id = coalesce(new.pedido_id, old.pedido_id)
      and status <> 'cancelado'
  ), 0),
  atualizado_em = now()
  where id = coalesce(new.pedido_id, old.pedido_id);
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_itens_pedido_upd on itens_pedido;
create trigger trg_itens_pedido_upd
after insert or update or delete on itens_pedido
for each row execute function atualizar_valor_total_pedido();

-- ---------------------------------------------------------
-- SEED: perfis de acesso padrão
-- ---------------------------------------------------------
insert into perfis_acesso (nome, status) values
  ('Administrador', true),
  ('Garçom', true),
  ('Cozinha', true)
on conflict (nome) do nothing;

-- Permissões padrão
insert into permissoes_perfil (perfil_id, pagina, pode_acessar)
select p.id, pagina, true
from perfis_acesso p
cross join (values
  ('home'),('produtos'),('tipos'),('mesas'),('usuarios'),
  ('perfis'),('acessos'),('controle_pedido'),('fazer_pedido'),
  ('finalizar_pedido'),('relatorio')
) as pages(pagina)
where p.nome = 'Administrador'
on conflict do nothing;

insert into permissoes_perfil (perfil_id, pagina, pode_acessar)
select id, 'fazer_pedido', true from perfis_acesso where nome = 'Garçom'
on conflict do nothing;
insert into permissoes_perfil (perfil_id, pagina, pode_acessar)
select id, 'home', true from perfis_acesso where nome = 'Garçom'
on conflict do nothing;

insert into permissoes_perfil (perfil_id, pagina, pode_acessar)
select id, 'controle_pedido', true from perfis_acesso where nome = 'Cozinha'
on conflict do nothing;
insert into permissoes_perfil (perfil_id, pagina, pode_acessar)
select id, 'home', true from perfis_acesso where nome = 'Cozinha'
on conflict do nothing;

-- Usuário administrador de exemplo (PIN: 1234) -- ALTERE DEPOIS DE TESTAR
insert into usuarios (nome, pin, perfil_id, status)
select 'Administrador', '1234', id, true from perfis_acesso where nome = 'Administrador'
on conflict (pin) do nothing;

-- Tipos de produto de exemplo
insert into tipos_produto (nome, status) values
  ('Lanches', true),
  ('Bebidas', true),
  ('Porções', true),
  ('Sobremesas', true)
on conflict do nothing;

-- Mesas de exemplo
insert into mesas (numero, status)
select n, 'disponivel' from generate_series(1, 10) as n
on conflict (numero) do nothing;

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- Como o login é feito por PIN (autenticação própria da aplicação,
-- não pelo Supabase Auth), liberamos leitura/escrita para a chave
-- "anon"/"authenticated" nestas tabelas. Para produção, recomenda-se
-- mover as validações sensíveis (ex: checagem de PIN) para uma
-- Supabase Edge Function e restringir ainda mais estas policies.
-- ---------------------------------------------------------
alter table perfis_acesso enable row level security;
alter table permissoes_perfil enable row level security;
alter table usuarios enable row level security;
alter table tipos_produto enable row level security;
alter table produtos enable row level security;
alter table mesas enable row level security;
alter table pedidos enable row level security;
alter table itens_pedido enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'perfis_acesso','permissoes_perfil','usuarios','tipos_produto',
    'produtos','mesas','pedidos','itens_pedido'
  ])
  loop
    execute format('drop policy if exists "allow_all_%1$s" on %1$s;', t);
    execute format(
      'create policy "allow_all_%1$s" on %1$s for all using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------
-- STORAGE: bucket para fotos de produtos (execute manualmente
-- se preferir gerenciar pelo painel Storage do Supabase)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

create policy if not exists "leitura_publica_produtos_bucket"
on storage.objects for select
using (bucket_id = 'produtos');

create policy if not exists "upload_produtos_bucket"
on storage.objects for insert
with check (bucket_id = 'produtos');

create policy if not exists "update_produtos_bucket"
on storage.objects for update
using (bucket_id = 'produtos');

create policy if not exists "delete_produtos_bucket"
on storage.objects for delete
using (bucket_id = 'produtos');
