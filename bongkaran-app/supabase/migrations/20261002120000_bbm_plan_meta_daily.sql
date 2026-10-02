-- Plan pengiriman: data permintaan MS2, PO SAP, Ship To, supply point.
-- SO dan LO diisi belakangan dari daftar plan, jadi petugas juga boleh
-- menambah/mengubah plan. Menghapus plan tetap khusus pengawas.
-- Policy "pengawas tambah/ubah" lama dibiarkan: policy permisif digabung
-- dengan OR, jadi policy anggota di bawah sudah mencakupnya.
alter table public.bbm_plans add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.bbm_plans alter column no_so set default '';
alter table public.bbm_plans alter column produk set default '';

create policy "anggota tambah" on public.bbm_plans for insert to authenticated with check (bbm_private.bbm_is_member());
create policy "anggota ubah" on public.bbm_plans for update to authenticated
  using (bbm_private.bbm_is_member()) with check (bbm_private.bbm_is_member());

-- Catatan harian per shift: stok awal tiap produk dan uji Q&Q harian.
create table if not exists public.bbm_daily (
  id text primary key,
  kind text not null check (kind in ('stok', 'qq')),
  tanggal date not null,
  shift smallint not null check (shift between 1 and 3),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid()
);

create index bbm_daily_tanggal_idx on public.bbm_daily (tanggal desc);
create unique index bbm_daily_stok_shift_idx on public.bbm_daily (tanggal, shift) where kind = 'stok';

create trigger bbm_daily_touch before update on public.bbm_daily
  for each row execute function public.bbm_touch();

alter table public.bbm_daily enable row level security;

create policy "anggota baca" on public.bbm_daily for select to authenticated using (bbm_private.bbm_is_member());
create policy "anggota tambah" on public.bbm_daily for insert to authenticated with check (bbm_private.bbm_is_member());
create policy "anggota ubah" on public.bbm_daily for update to authenticated
  using (bbm_private.bbm_is_member()) with check (bbm_private.bbm_is_member());
create policy "hapus catatan" on public.bbm_daily for delete to authenticated
  using (bbm_private.bbm_is_pengawas() or created_by = auth.uid());
