-- Uji takaran nozzle dengan bejana 20 L (Input > Uji Takaran). Satu baris = satu hasil:
-- data = {nozzle, produk, opsi 'P'|'M', hasilMl, jam, petugas, catatan, foto {dudukan[], hasil[]}}.
-- Tabel sendiri (bukan kind di bbm_daily) dan dibaca aplikasi sebagai catatan harian kind 'takar'.
-- Tulis: ABH, pengawas, kepala shift. Hapus: ABH/pengawas, atau pengirimnya sendiri.
create table public.bbm_takar (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null,
  tanggal date not null,
  shift smallint not null check (shift between 1 and 3),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id)
);
create index bbm_takar_spbu_tanggal_idx on public.bbm_takar (spbu_id, tanggal desc);
create trigger bbm_takar_touch before update on public.bbm_takar for each row execute function public.bbm_touch();

alter table public.bbm_takar enable row level security;
create policy "anggota baca" on public.bbm_takar for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "anggota tambah" on public.bbm_takar for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "anggota ubah" on public.bbm_takar for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "hapus hasil" on public.bbm_takar for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and (bbm_private.bbm_has_role('abh', 'pengawas') or created_by = auth.uid()));
