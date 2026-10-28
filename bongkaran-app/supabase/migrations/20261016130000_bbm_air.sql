-- Water content tangki pendam (Operation > Water Content Tangki): pengecekan air dengan pasta air
-- pada setiap tangki pendam, satu catatan per tanggal & shift untuk semua tangki:
-- data = {tangki: {<tank id>: {airMm, liter, foto[], tindakan}}, petugas, jam, catatan}.
-- Tulis: ABH, pengawas, kepala shift. Hapus: ABH/pengawas. Baca: anggota SPBU.
create table public.bbm_air (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}-\d{2}_[1-3]$'),
  tanggal date not null,
  shift smallint not null check (shift between 1 and 3),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id),
  unique (spbu_id, tanggal, shift)
);
create index bbm_air_spbu_tanggal_idx on public.bbm_air (spbu_id, tanggal desc);
create trigger bbm_air_touch before update on public.bbm_air for each row execute function public.bbm_touch();

alter table public.bbm_air enable row level security;
create policy "anggota baca" on public.bbm_air for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "petugas tambah" on public.bbm_air for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "petugas ubah" on public.bbm_air for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "pengawas hapus" on public.bbm_air for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
