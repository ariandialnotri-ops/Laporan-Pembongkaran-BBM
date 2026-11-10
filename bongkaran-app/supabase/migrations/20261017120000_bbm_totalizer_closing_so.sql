-- 1. Database nozzle SPBU COCO Kediri (51.641.16): 9 nozzle di 2 dispenser / 2 pulau pompa
--    (Data base nomor nozzle.xlsx). Hanya diisi bila daftar nozzle SPBU itu masih kosong; dispenser
--    dicari dari nama "Dispenser N" di Data Dispenser. Selanjutnya diubah ABH/pengawas di Pengaturan.
with spbu as (
  select s.id, st.value from public.bbm_spbu s join public.bbm_settings st on st.spbu_id = s.id
  where regexp_replace(coalesce(s.kode, ''), '\D', '', 'g') = '5164116'
    and coalesce(jsonb_array_length(st.value -> 'nozzles'), 0) = 0
), data (no, produk, disp) as (
  values (1, 'Pertamax', 1), (2, 'Pertamax', 1), (3, 'Pertamax Turbo', 1), (4, 'Pertamax Turbo', 1), (5, 'Pertamina Dex', 1),
         (6, 'Pertamina Dex', 1), (7, 'Biosolar', 2), (8, 'Pertalite', 2), (9, 'Pertalite', 2)
), nz as (
  select spbu.id as spbu_id, jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', 'nz_kediri_' || d.no,
      'nama', d.no::text,
      'produk', d.produk,
      'dispenserId', (select x ->> 'id' from jsonb_array_elements(coalesce(spbu.value -> 'dispensers', '[]'::jsonb)) x
                      where lower(x ->> 'nama') = 'dispenser ' || d.disp limit 1)
    )) order by d.no) as arr
  from spbu cross join data d group by spbu.id
)
update public.bbm_settings st set value = st.value || jsonb_build_object('nozzles', nz.arr)
from nz where st.spbu_id = nz.spbu_id;

-- Harga jual per produk (closing shift) boleh diubah pengawas lewat RPC terbatas.
create or replace function public.bbm_save_settings_terbatas(p_spbu uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_patch jsonb;
begin
  if not bbm_private.bbm_has_role('abh', 'pengawas') or p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Hanya ABH atau pengawas SPBU ini yang dapat mengubah data ini';
  end if;
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Data tidak valid';
  end if;
  if (p_patch ? 'dispensers' and jsonb_typeof(p_patch -> 'dispensers') <> 'array')
     or (p_patch ? 'nozzles' and jsonb_typeof(p_patch -> 'nozzles') <> 'array')
     or (p_patch ? 'hargaProduk' and jsonb_typeof(p_patch -> 'hargaProduk') <> 'object') then
    raise exception 'Data dispenser/nozzle/harga tidak valid';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('namaSpbu', 'kodeSpbu', 'alamatSpbu', 'jumlahPulau', 'jumlahDispenser', 'dispensers', 'nozzles',
                'apar', 'apab', 'aparArea', 'soldTo', 'shipTo', 'fasilitas', 'hargaProduk');
  insert into public.bbm_settings (id, spbu_id, value) values (p_spbu::text, p_spbu, v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;

-- 2. Operation > Totalizer: totalisator digital awal & akhir shift per nozzle, satu catatan per tanggal & shift.
--    data = {nozzle: {<nozzle id>: {nama, produk, awal, akhir}}, petugas, jamAwal, jamAkhir, catatan}.
--    Tulis: ABH, pengawas, kepala shift, security. Hapus: ABH/pengawas.
create table public.bbm_totalizer (
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
create index bbm_totalizer_spbu_tanggal_idx on public.bbm_totalizer (spbu_id, tanggal desc);
create trigger bbm_totalizer_touch before update on public.bbm_totalizer for each row execute function public.bbm_touch();
alter table public.bbm_totalizer enable row level security;
create policy "anggota baca" on public.bbm_totalizer for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "petugas tambah" on public.bbm_totalizer for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift', 'security'));
create policy "petugas ubah" on public.bbm_totalizer for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift', 'security'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift', 'security'));
create policy "pengawas hapus" on public.bbm_totalizer for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));

-- 3. Finance > Closing Shift (kepala shift, hitung buta): kolom mengikuti tabel spbu.evidence_closing aplikasi
--    One Touch Solution (cash, edc_bca, edc_bri, edc_mandiri, edc_bni, myp_linkaja, rfid, e_voucher, p_voucher,
--    pecahan) di kolom data, ditambah penjualan dari totalizer & harga. Foto struk tidak disimpan (dikirim ke WA).
--    Sekali terkirim terkunci: hanya ABH yang dapat mengubah/menghapus.
create table public.bbm_closing (
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
create index bbm_closing_spbu_tanggal_idx on public.bbm_closing (spbu_id, tanggal desc);
create trigger bbm_closing_touch before update on public.bbm_closing for each row execute function public.bbm_touch();
alter table public.bbm_closing enable row level security;
create policy "finance baca" on public.bbm_closing for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift'));
create policy "kashift closing" on public.bbm_closing for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'kashift'));
create policy "abh ubah" on public.bbm_closing for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'));
create policy "abh hapus" on public.bbm_closing for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'));

-- 4. Report > Laporan Stock Opname (BA Laporan Bulanan): satu catatan per bulan (id 'YYYY-MM', tanggal = tgl 1).
--    Isian manual (dipping/ATG, meter listrik, totalisator manual, cash opname, justifikasi, pekerja) di data;
--    totalisator digital, penerimaan, penjualan & tera ditarik aplikasi dari modul lain.
--    Tulis: ABH, pengawas, admin. Baca: ABH, pengawas, admin, kepala shift.
create table public.bbm_so (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}$'),
  tanggal date not null check (extract(day from tanggal) = 1),
  shift smallint not null default 0 check (shift = 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id),
  unique (spbu_id, tanggal)
);
create trigger bbm_so_touch before update on public.bbm_so for each row execute function public.bbm_touch();
alter table public.bbm_so enable row level security;
create policy "so baca" on public.bbm_so for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift'));
create policy "so tambah" on public.bbm_so for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas'));
create policy "so ubah" on public.bbm_so for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas'));
create policy "so hapus" on public.bbm_so for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'));
