-- Multi SPBU (pola sama dengan aplikasi Monitoring JBT):
--   bbm_spbu       : satu baris per SPBU (unit bisnis). Nama & kode disalin otomatis dari Identitas SPBU.
--   bbm_members    : spbu_id = SPBU tempat pengawas / kepala shift / security bertugas.
--   bbm_abh_spbu   : SPBU yang dikendalikan tiap ABH (satu ABH banyak SPBU).
--   bbm_tanks      : database tangki & tabel kalibrasi per SPBU.
-- Semua data (pengaturan, plan, laporan, catatan harian, foto) kini milik satu SPBU dan hanya
-- terbaca oleh anggota SPBU itu atau ABH yang mengendalikannya.
-- Data & akun yang sudah ada dipindahkan ke SPBU pertama: SPBU COCO Kediri.

create table public.bbm_spbu (
  id uuid primary key default gen_random_uuid(),
  kode text unique,
  nama text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.bbm_abh_spbu (
  user_id uuid not null references public.bbm_members (user_id) on delete cascade,
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, spbu_id)
);
create index bbm_abh_spbu_spbu_idx on public.bbm_abh_spbu (spbu_id);

insert into public.bbm_spbu (nama, created_by) values ('SPBU COCO SAHARJO KEDIRI', null);

-- Anggota yang ada: ABH mengendalikan Kediri, peran lain bertugas di Kediri.
alter table public.bbm_members add column spbu_id uuid references public.bbm_spbu (id) on delete set null;
update public.bbm_members set spbu_id = (select id from public.bbm_spbu) where role <> 'abh';
insert into public.bbm_abh_spbu (user_id, spbu_id) select user_id, (select id from public.bbm_spbu) from public.bbm_members where role = 'abh';
create index bbm_members_spbu_idx on public.bbm_members (spbu_id);

-- Kolom spbu_id pada semua data.
alter table public.bbm_settings add column spbu_id uuid unique references public.bbm_spbu (id) on delete cascade;
alter table public.bbm_plans add column spbu_id uuid references public.bbm_spbu (id) on delete cascade;
alter table public.bbm_reports add column spbu_id uuid references public.bbm_spbu (id) on delete cascade;
alter table public.bbm_daily add column spbu_id uuid references public.bbm_spbu (id) on delete cascade;

update public.bbm_settings set spbu_id = (select id from public.bbm_spbu), id = (select id from public.bbm_spbu)::text;
update public.bbm_plans set spbu_id = (select id from public.bbm_spbu);
update public.bbm_reports set spbu_id = (select id from public.bbm_spbu);
update public.bbm_daily set spbu_id = (select id from public.bbm_spbu);

alter table public.bbm_settings alter column spbu_id set not null;
alter table public.bbm_plans alter column spbu_id set not null;
alter table public.bbm_reports alter column spbu_id set not null;
alter table public.bbm_daily alter column spbu_id set not null;

-- Id catatan harian dibentuk dari tanggal & shift (mis. qq_2026-10-10_1), jadi unik per SPBU.
alter table public.bbm_daily drop constraint bbm_daily_pkey;
alter table public.bbm_daily add primary key (spbu_id, id);
drop index public.bbm_daily_stok_shift_idx;
create unique index bbm_daily_stok_shift_idx on public.bbm_daily (spbu_id, tanggal, shift) where kind = 'stok';

create index bbm_daily_spbu_tanggal_idx on public.bbm_daily (spbu_id, tanggal desc);
create index bbm_plans_spbu_tanggal_idx on public.bbm_plans (spbu_id, tanggal desc);
create index bbm_reports_spbu_created_idx on public.bbm_reports (spbu_id, created_at desc);

-- Database tangki per SPBU. tabel = {startMm, stepMm, volumes[]} untuk interval tetap,
-- atau {levels[], volumes[]} untuk tinggi tidak berinterval tetap (mm, liter).
create table public.bbm_tanks (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null,
  produk text not null,
  tank_no text not null default '',
  tanggal_kalibrasi text,
  catatan text,
  tabel jsonb not null,
  urut smallint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id)
);
create trigger bbm_tanks_touch before update on public.bbm_tanks for each row execute function public.bbm_touch();

-- ============================================================================
-- Akses
-- ============================================================================

-- SPBU yang boleh diakses pemanggil: tempat bertugas + SPBU yang dikendalikan (ABH).
create function bbm_private.bbm_spbu_saya() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.spbu_id from public.bbm_members m where m.user_id = auth.uid() and m.spbu_id is not null
  union
  select a.spbu_id from public.bbm_abh_spbu a
  join public.bbm_members m on m.user_id = a.user_id and m.role = 'abh'
  where a.user_id = auth.uid();
$$;

-- Anggota yang terlihat: rekan di SPBU yang sama, ABH pengendalinya, dan diri sendiri.
create function bbm_private.bbm_anggota_terlihat() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.bbm_members m where m.spbu_id in (select bbm_private.bbm_spbu_saya())
  union
  select a.user_id from public.bbm_abh_spbu a where a.spbu_id in (select bbm_private.bbm_spbu_saya())
  union
  select auth.uid();
$$;

-- Foto: folder pertama = id SPBU. Foto lama (sebelum multi SPBU) milik SPBU pertama.
create function bbm_private.bbm_foto_boleh(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid in (select bbm_private.bbm_spbu_saya())
    else (select s.id from public.bbm_spbu s order by s.created_at limit 1) in (select bbm_private.bbm_spbu_saya())
  end;
$$;

revoke execute on function bbm_private.bbm_spbu_saya(), bbm_private.bbm_anggota_terlihat(), bbm_private.bbm_foto_boleh(text) from public, anon;
grant execute on function bbm_private.bbm_spbu_saya(), bbm_private.bbm_anggota_terlihat(), bbm_private.bbm_foto_boleh(text) to authenticated;

alter table public.bbm_spbu enable row level security;
alter table public.bbm_abh_spbu enable row level security;
alter table public.bbm_tanks enable row level security;

-- SPBU & tautan ABH hanya dibaca; dibuat lewat bbm_buat_spbu / akun ABH.
create policy "spbu saya" on public.bbm_spbu for select to authenticated using (id in (select bbm_private.bbm_spbu_saya()));
create policy "tautan abh" on public.bbm_abh_spbu for select to authenticated
  using (user_id = auth.uid() or spbu_id in (select bbm_private.bbm_spbu_saya()));

create policy "anggota baca" on public.bbm_tanks for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "pengawas tambah" on public.bbm_tanks for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
create policy "pengawas ubah" on public.bbm_tanks for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
create policy "pengawas hapus" on public.bbm_tanks for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));

-- Anggota: rekan satu SPBU; ABH mengubah/menghapus anggota SPBU yang dikendalikannya.
alter policy "anggota baca" on public.bbm_members using (user_id in (select bbm_private.bbm_anggota_terlihat()));
alter policy "pengawas ubah anggota" on public.bbm_members
  using (bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya()))
  with check (bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya()));
alter policy "pengawas hapus anggota" on public.bbm_members
  using (bbm_private.bbm_is_pengawas() and user_id <> auth.uid() and spbu_id in (select bbm_private.bbm_spbu_saya()));

-- Pengaturan SPBU.
alter policy "anggota baca" on public.bbm_settings using (spbu_id in (select bbm_private.bbm_spbu_saya()));
alter policy "pengawas tambah" on public.bbm_settings with check (bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya()));
alter policy "pengawas ubah" on public.bbm_settings
  using (bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya()))
  with check (bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya()));

-- Plan pengiriman.
alter policy "anggota baca" on public.bbm_plans using (spbu_id in (select bbm_private.bbm_spbu_saya()));
alter policy "anggota tambah" on public.bbm_plans
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "anggota ubah" on public.bbm_plans
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "pengawas tambah" on public.bbm_plans with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_is_pengawas());
alter policy "pengawas ubah" on public.bbm_plans
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_is_pengawas())
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_is_pengawas());
alter policy "pengawas hapus" on public.bbm_plans
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));

-- Laporan bongkaran & uji pasca penerimaan.
alter policy "anggota baca" on public.bbm_reports using (spbu_id in (select bbm_private.bbm_spbu_saya()));
alter policy "anggota tambah" on public.bbm_reports
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "anggota ubah" on public.bbm_reports
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "hapus laporan" on public.bbm_reports
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and (bbm_private.bbm_has_role('abh', 'pengawas') or (created_by = auth.uid() and status = 'draft')));

-- Catatan harian (stok, Q&Q, APAR, insiden).
alter policy "anggota baca" on public.bbm_daily using (spbu_id in (select bbm_private.bbm_spbu_saya()));
alter policy "anggota tambah" on public.bbm_daily
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and (kind in ('apar', 'insiden') or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')));
alter policy "anggota ubah" on public.bbm_daily
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and (kind in ('apar', 'insiden') or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and (kind in ('apar', 'insiden') or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')));
alter policy "hapus catatan" on public.bbm_daily
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and (bbm_private.bbm_has_role('abh', 'pengawas') or created_by = auth.uid()));

-- Foto evidence per SPBU.
alter policy "bbm evidence baca" on storage.objects using (bucket_id = 'bbm-evidence' and bbm_private.bbm_foto_boleh(name));
alter policy "bbm evidence unggah" on storage.objects with check (bucket_id = 'bbm-evidence' and bbm_private.bbm_foto_boleh(name));
alter policy "bbm evidence hapus" on storage.objects using (bucket_id = 'bbm-evidence' and bbm_private.bbm_foto_boleh(name));

-- Plan & laporan tidak pernah berpindah SPBU (mis. tersimpan saat ABH berganti SPBU).
create function bbm_private.bbm_spbu_tetap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.spbu_id is distinct from old.spbu_id then
    raise exception 'Data ini milik SPBU lain';
  end if;
  return new;
end;
$$;
create trigger bbm_plans_spbu_tetap before update on public.bbm_plans for each row execute function bbm_private.bbm_spbu_tetap();
create trigger bbm_reports_spbu_tetap before update on public.bbm_reports for each row execute function bbm_private.bbm_spbu_tetap();

-- ============================================================================
-- Nama & kode di daftar SPBU mengikuti Identitas SPBU.
-- ============================================================================
create function bbm_private.bbm_settings_ke_spbu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.bbm_spbu set
    nama = coalesce(nullif(trim(new.value ->> 'namaSpbu'), ''), nama),
    kode = coalesce(nullif(trim(new.value ->> 'kodeSpbu'), ''), kode)
  where id = new.spbu_id;
  return new;
exception when unique_violation then
  raise exception 'Kode SPBU % sudah dipakai SPBU lain', trim(new.value ->> 'kodeSpbu');
end;
$$;
create trigger bbm_settings_ke_spbu after insert or update on public.bbm_settings
  for each row execute function bbm_private.bbm_settings_ke_spbu();

-- ============================================================================
-- RPC
-- ============================================================================

-- ABH menambah unit bisnis (SPBU) yang dikendalikannya.
create function public.bbm_buat_spbu(p_nama text, p_kode text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not bbm_private.bbm_is_pengawas() then
    raise exception 'Hanya ABH yang dapat menambah SPBU';
  end if;
  if coalesce(trim(p_nama), '') = '' then
    raise exception 'Isi nama SPBU';
  end if;
  if exists (select 1 from public.bbm_spbu where kode = nullif(trim(p_kode), '')) then
    raise exception 'Kode SPBU % sudah terdaftar', trim(p_kode);
  end if;
  insert into public.bbm_spbu (nama, kode) values (trim(p_nama), nullif(trim(p_kode), '')) returning id into v_id;
  insert into public.bbm_abh_spbu (user_id, spbu_id) values (auth.uid(), v_id);
  insert into public.bbm_settings (id, spbu_id, value)
  values (v_id::text, v_id, jsonb_build_object('namaSpbu', trim(p_nama), 'kodeSpbu', coalesce(trim(p_kode), '')));
  return v_id;
end;
$$;

-- Pengawas (dan ABH) mengubah sebagian pengaturan: identitas SPBU, data utama APAR/APAB & area,
-- Sold To / Ship To. Kunci lain dalam patch diabaikan.
create function public.bbm_save_settings_terbatas(p_spbu uuid, p_patch jsonb) returns void
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
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('namaSpbu', 'kodeSpbu', 'alamatSpbu', 'jumlahPulau', 'jumlahDispenser', 'apar', 'apab', 'aparArea', 'soldTo', 'shipTo');
  insert into public.bbm_settings (id, spbu_id, value) values (p_spbu::text, p_spbu, v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;

-- Versi lama tanpa SPBU tidak dipakai lagi.
create or replace function public.bbm_save_settings_terbatas(p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Muat ulang aplikasi: versi ini sudah tidak didukung';
end;
$$;
create or replace function public.bbm_save_apar(p_apar jsonb, p_apab jsonb, p_area jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Muat ulang aplikasi: versi ini sudah tidak didukung';
end;
$$;

-- ABH mendaftarkan akun yang sudah ada ke SPBU yang dikendalikannya.
create function public.bbm_add_member(p_email text, p_nama text, p_role text, p_spbu uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text;
  v_lama uuid;
begin
  if not bbm_private.bbm_is_pengawas() or p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Hanya ABH SPBU ini yang dapat menambah anggota';
  end if;
  if p_role not in ('abh', 'pengawas', 'kashift', 'security') then
    raise exception 'Peran tidak valid';
  end if;
  select id, email into v_id, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Akun dengan email % belum dibuat', p_email;
  end if;
  select spbu_id into v_lama from public.bbm_members where user_id = v_id;
  if v_lama is not null and v_lama <> p_spbu and v_lama not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Akun % sudah terdaftar di SPBU lain', v_email;
  end if;
  insert into public.bbm_members (user_id, email, nama, role, spbu_id)
  values (v_id, v_email, nullif(trim(p_nama), ''), p_role, case when p_role = 'abh' then null else p_spbu end)
  on conflict (user_id) do update set nama = excluded.nama, role = excluded.role, spbu_id = excluded.spbu_id;
  if p_role = 'abh' then
    insert into public.bbm_abh_spbu (user_id, spbu_id) values (v_id, p_spbu) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.bbm_add_member(p_email text, p_nama text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Muat ulang aplikasi: versi ini sudah tidak didukung';
end;
$$;

-- Ringkasan per SPBU untuk dashboard Unit Bisnis ABH. p_hari = tanggal hari ini di perangkat.
create function public.bbm_ringkasan_unit(p_hari date) returns table (
  spbu_id uuid,
  kode text,
  nama text,
  identitas_lengkap boolean,
  tangki int,
  anggota int,
  pengawas int,
  bongkaran_bulan int,
  anomali_bulan int,
  draft int,
  qq_7hari int[],
  stok_hari_ini int,
  apar_unit int,
  apar_cek_bulan int,
  insiden_terbuka int,
  terakhir_aktif timestamptz
)
language sql stable security definer set search_path = '' as $$
  with saya as (select bbm_private.bbm_spbu_saya() as id),
  awal as (select date_trunc('month', p_hari)::date as bulan)
  select
    s.id,
    s.kode,
    s.nama,
    coalesce(nullif(trim(st.value ->> 'namaSpbu'), '') is not null
      and nullif(trim(st.value ->> 'kodeSpbu'), '') is not null
      and coalesce(st.value ->> 'jumlahPulau', '') ~ '^0*[1-9][0-9]*$', false),
    (select count(*)::int from public.bbm_tanks t where t.spbu_id = s.id),
    (select count(*)::int from public.bbm_members m where m.spbu_id = s.id),
    (select count(*)::int from public.bbm_members m where m.spbu_id = s.id and m.role = 'pengawas'),
    (select count(*)::int from public.bbm_reports r where r.spbu_id = s.id and r.created_at >= (select bulan from awal)),
    (select count(*)::int from public.bbm_reports r where r.spbu_id = s.id and r.status = 'anomali' and r.created_at >= (select bulan from awal)),
    (select count(*)::int from public.bbm_reports r where r.spbu_id = s.id and r.status = 'draft'),
    array(
      select (select count(distinct d.shift)::int from public.bbm_daily d where d.spbu_id = s.id and d.kind = 'qq' and d.tanggal = g::date)
      from generate_series(p_hari - 6, p_hari, interval '1 day') g order by g
    ),
    (select count(distinct d.shift)::int from public.bbm_daily d where d.spbu_id = s.id and d.kind = 'stok' and d.tanggal = p_hari),
    coalesce(jsonb_array_length(case when jsonb_typeof(st.value -> 'apar') = 'array' then st.value -> 'apar' end), 0)
      + coalesce(jsonb_array_length(case when jsonb_typeof(st.value -> 'apab') = 'array' then st.value -> 'apab' end), 0),
    (select count(distinct substr(d.id, 17))::int from public.bbm_daily d
      where d.spbu_id = s.id and d.kind = 'apar' and length(d.id) > 16 and d.tanggal >= (select bulan from awal)),
    (select count(*)::int from public.bbm_daily d where d.spbu_id = s.id and d.kind = 'insiden' and coalesce(d.data ->> 'status', 'terbuka') <> 'selesai'),
    greatest(
      (select max(d.updated_at) from public.bbm_daily d where d.spbu_id = s.id),
      (select max(r.updated_at) from public.bbm_reports r where r.spbu_id = s.id)
    )
  from public.bbm_spbu s
  left join public.bbm_settings st on st.spbu_id = s.id
  where s.id in (select id from saya)
  order by s.nama;
$$;

revoke execute on function public.bbm_buat_spbu(text, text), public.bbm_save_settings_terbatas(uuid, jsonb),
  public.bbm_add_member(text, text, text, uuid), public.bbm_ringkasan_unit(date) from public, anon;
grant execute on function public.bbm_buat_spbu(text, text), public.bbm_save_settings_terbatas(uuid, jsonb),
  public.bbm_add_member(text, text, text, uuid), public.bbm_ringkasan_unit(date) to authenticated;
