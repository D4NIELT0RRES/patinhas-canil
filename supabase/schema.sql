-- =====================================================================
-- Canil ONG - estrutura do banco (Supabase / PostgreSQL)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- Pode ser executado mais de uma vez sem causar erros.
-- =====================================================================

-- ---------- Tabelas ---------------------------------------------------

create table if not exists public.canis (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vacinas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  especie        text not null check (especie in ('cachorro', 'gato', 'ambos')),
  intervalo_dias integer not null check (intervalo_dias > 0),
  created_at     timestamptz not null default now()
);

create table if not exists public.animais (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  especie         text not null check (especie in ('cachorro', 'gato')),
  sexo            text not null check (sexo in ('macho', 'femea')),
  raca            text,
  cor             text,
  data_nascimento date,
  porte           text check (porte in ('pequeno', 'medio', 'grande')),
  castrado        boolean not null default false,
  data_entrada    date,
  canil_id        uuid references public.canis (id) on delete set null,
  status          text not null default 'disponivel'
                  check (status in ('disponivel', 'tratamento', 'quarentena', 'lar_temporario', 'adotado')),
  foto_url        text,
  foto_path       text,
  observacoes     text,
  doencas         text,
  limitacoes      text,
  created_at      timestamptz not null default now()
);

-- Uma linha por animal + vacina: guarda a data da dose mais recente.
create table if not exists public.vacinas_aplicadas (
  id             uuid primary key default gen_random_uuid(),
  animal_id      uuid not null references public.animais (id) on delete cascade,
  vacina_id      uuid not null references public.vacinas (id) on delete cascade,
  data_aplicacao date not null,
  created_at     timestamptz not null default now(),
  unique (animal_id, vacina_id)
);

create index if not exists animais_canil_idx on public.animais (canil_id);
create index if not exists vacinas_aplicadas_animal_idx on public.vacinas_aplicadas (animal_id);

-- ---------- Vacinas de exemplo ---------------------------------------

insert into public.vacinas (nome, especie, intervalo_dias) values
  ('V10',            'cachorro', 365),
  ('Antirrábica',    'ambos',    365),
  ('Gripe canina',   'cachorro', 365),
  ('Giárdia',        'cachorro', 365),
  ('Leishmaniose',   'cachorro', 365),
  ('V4/V5 felina',   'gato',     365)
on conflict (nome) do nothing;

-- ---------- Segurança (Row Level Security) ---------------------------
-- O app não tem login: o cliente "anon" precisa ler e escrever.
-- ATENÇÃO: quem tiver o link do app consegue alterar os dados.

alter table public.canis             enable row level security;
alter table public.vacinas           enable row level security;
alter table public.animais           enable row level security;
alter table public.vacinas_aplicadas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['canis', 'vacinas', 'animais', 'vacinas_aplicadas'] loop
    execute format('drop policy if exists "acesso_anonimo" on public.%I', t);
    execute format(
      'create policy "acesso_anonimo" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------- Fotos (Supabase Storage) ----------------------------------
-- Bucket público "fotos", até 5 MB por arquivo, apenas imagens.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos_leitura"    on storage.objects;
drop policy if exists "fotos_envio"      on storage.objects;
drop policy if exists "fotos_alteracao"  on storage.objects;
drop policy if exists "fotos_exclusao"   on storage.objects;

create policy "fotos_leitura"   on storage.objects for select to anon, authenticated
  using (bucket_id = 'fotos');
create policy "fotos_envio"     on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fotos');
create policy "fotos_alteracao" on storage.objects for update to anon, authenticated
  using (bucket_id = 'fotos') with check (bucket_id = 'fotos');
create policy "fotos_exclusao"  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'fotos');

-- =====================================================================
-- Versão 1.1: assistente de IA e atualização em tempo real
-- =====================================================================

-- Controle de uso do assistente (limita abusos e gastos com a IA).
-- Guarda só um código embaralhado (hash) de quem usou, nunca o IP.
create table if not exists public.assistente_uso (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  modo       text not null default 'chat' check (modo in ('chat', 'adocao', 'foto')),
  created_at timestamptz not null default now()
);
create index if not exists assistente_uso_pessoa_idx on public.assistente_uso (ip_hash, created_at desc);
create index if not exists assistente_uso_data_idx   on public.assistente_uso (created_at desc);

alter table public.assistente_uso enable row level security;
drop policy if exists "uso_leitura"  on public.assistente_uso;
drop policy if exists "uso_registro" on public.assistente_uso;
drop policy if exists "uso_limpeza"  on public.assistente_uso;
create policy "uso_leitura"  on public.assistente_uso for select to anon, authenticated using (true);
create policy "uso_registro" on public.assistente_uso for insert to anon, authenticated with check (modo in ('chat', 'adocao', 'foto'));
-- só permite apagar registros com mais de 2 dias (limpeza automática)
create policy "uso_limpeza"  on public.assistente_uso for delete to anon, authenticated using (created_at < now() - interval '2 days');

-- Tempo real: as telas atualizam sozinhas quando outro voluntário altera algo.
do $$
declare t text;
begin
  foreach t in array array['animais', 'canis', 'vacinas', 'vacinas_aplicadas'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
