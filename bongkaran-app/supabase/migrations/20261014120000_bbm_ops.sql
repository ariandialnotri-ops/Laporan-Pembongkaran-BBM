-- Modul Operasional SPBU (14 format laporan operasional): kartu perawatan, housekeeping,
-- sumur pantau, oil catcher. Satu baris = satu form pada satu tanggal (form bulanan: tanggal 1).
-- data = {hasil: {indeks aktivitas: 'OK'|'X'|'-'}, temuan: {indeks: {catatan, foto[]}}, petugas, jam,
--         paraf: {nama, at}} untuk checklist; {sumur[4]|kondisi, hasil, keterangan, ...} untuk pantauan.
-- Peran baru Cleaning Service (cs) mengisi housekeeping.

-- 1. Peran Cleaning Service
alter table public.bbm_members drop constraint if exists bbm_members_role_check;
alter table public.bbm_members add constraint bbm_members_role_check check (role in ('abh', 'pengawas', 'kashift', 'security', 'cs'));

create or replace function public.bbm_add_member(p_email text, p_nama text, p_role text, p_spbu uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text;
  v_lama uuid;
begin
  if not bbm_private.bbm_is_pengawas() or p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Hanya ABH SPBU ini yang dapat menambah anggota';
  end if;
  if p_role not in ('abh', 'pengawas', 'kashift', 'security', 'cs') then
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

-- 2. Fasilitas SPBU (form yang tampil) boleh diatur pengawas lewat Identitas SPBU.
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
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('namaSpbu', 'kodeSpbu', 'alamatSpbu', 'jumlahPulau', 'jumlahDispenser', 'apar', 'apab', 'aparArea', 'soldTo', 'shipTo', 'fasilitas');
  insert into public.bbm_settings (id, spbu_id, value) values (p_spbu::text, p_spbu, v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;

-- 3. Tabel operasional
create table public.bbm_ops (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null,
  form text not null check (form ~ '^[a-z0-9-]{2,40}$'),
  tanggal date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id),
  unique (spbu_id, form, tanggal)
);
create index bbm_ops_spbu_tanggal_idx on public.bbm_ops (spbu_id, tanggal desc);
create trigger bbm_ops_touch before update on public.bbm_ops for each row execute function public.bbm_touch();

-- Siapa mengisi form apa: housekeeping (hk-*) Cleaning Service; sumur pantau & oil catcher
-- kepala shift / security; kartu perawatan kepala shift. ABH & pengawas semua form.
create function bbm_private.bbm_ops_boleh(p_form text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_form like 'hk-%' then bbm_private.bbm_has_role('abh', 'pengawas', 'cs')
    when p_form in ('sumur-pantau', 'oil-catcher') then bbm_private.bbm_has_role('abh', 'pengawas', 'kashift', 'security')
    else bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')
  end;
$$;
revoke execute on function bbm_private.bbm_ops_boleh(text) from public, anon;
grant execute on function bbm_private.bbm_ops_boleh(text) to authenticated;

-- Paraf "Mengetahui Pengawas" hanya boleh diubah ABH/pengawas; SPBU tidak berpindah.
create function bbm_private.bbm_ops_jaga() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.spbu_id is distinct from old.spbu_id then
    raise exception 'SPBU catatan tidak dapat diubah';
  end if;
  if (new.data -> 'paraf') is distinct from (case when tg_op = 'UPDATE' then old.data -> 'paraf' end)
     and not bbm_private.bbm_has_role('abh', 'pengawas') then
    raise exception 'Paraf hanya oleh pengawas atau ABH';
  end if;
  return new;
end;
$$;
create trigger bbm_ops_jaga before insert or update on public.bbm_ops for each row execute function bbm_private.bbm_ops_jaga();

alter table public.bbm_ops enable row level security;
create policy "anggota baca" on public.bbm_ops for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "pengisi tambah" on public.bbm_ops for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_ops_boleh(form));
create policy "pengisi ubah" on public.bbm_ops for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_ops_boleh(form))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_ops_boleh(form));
create policy "pengawas hapus" on public.bbm_ops for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));

-- 4. Cut-off foto: setiap tanggal 5 foto yang diunggah sebelum tanggal 1 (bulan ini - fotoSimpanBulan)
-- dihapus dari bucket bbm-evidence oleh edge function bbm-cutoff. Tanggal 1-4 ABH/pengawas
-- dapat mengunduh arsip ZIP foto yang akan dihapus.
create function bbm_private.bbm_foto_spbu(p_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_name, '/', 1)::uuid
    else (select s.id from public.bbm_spbu s order by s.created_at limit 1)
  end;
$$;

-- Batas cut-off SPBU (awal bulan WIB). Lama simpan 1-24 bulan, bawaan 3.
create function bbm_private.bbm_batas_foto(p_spbu uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select (date_trunc('month', now() at time zone 'Asia/Jakarta')
    - make_interval(months => least(24, greatest(1, coalesce((
        select case when s.value ->> 'fotoSimpanBulan' ~ '^[0-9]{1,2}$' then (s.value ->> 'fotoSimpanBulan')::int end
        from public.bbm_settings s where s.spbu_id = p_spbu limit 1), 3)))))
    at time zone 'Asia/Jakarta';
$$;
revoke execute on function bbm_private.bbm_foto_spbu(text), bbm_private.bbm_batas_foto(uuid) from public, anon, authenticated;

-- Foto SPBU yang akan dihapus pada cut-off berikutnya (untuk arsip ZIP).
create function public.bbm_foto_arsip(p_spbu uuid)
returns table (name text, ukuran bigint, dibuat timestamptz, batas timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_batas timestamptz;
begin
  if not bbm_private.bbm_has_role('abh', 'pengawas') or p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Hanya ABH atau pengawas SPBU ini';
  end if;
  v_batas := bbm_private.bbm_batas_foto(p_spbu);
  return query
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at, v_batas
    from storage.objects o
    where o.bucket_id = 'bbm-evidence' and o.created_at < v_batas and bbm_private.bbm_foto_spbu(o.name) = p_spbu
    order by o.created_at;
end;
$$;
revoke execute on function public.bbm_foto_arsip(uuid) from public, anon;
grant execute on function public.bbm_foto_arsip(uuid) to authenticated;

-- Kandidat hapus semua SPBU (hanya service role / edge function).
create function public.bbm_cutoff_kandidat(p_limit int default 1000)
returns table (name text, spbu_id uuid, ukuran bigint, batas timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.name, x.spbu_id, coalesce((o.metadata ->> 'size')::bigint, 0), x.batas
  from storage.objects o
  cross join lateral (select bbm_private.bbm_foto_spbu(o.name) as spbu_id) s
  cross join lateral (select s.spbu_id, bbm_private.bbm_batas_foto(s.spbu_id) as batas) x
  where o.bucket_id = 'bbm-evidence' and o.created_at < x.batas
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;
revoke execute on function public.bbm_cutoff_kandidat(int) from public, anon, authenticated;
grant execute on function public.bbm_cutoff_kandidat(int) to service_role;

-- Kunci pemanggil jadwal disimpan di Vault (nama 'bbm_cutoff_key'), tidak pernah di repo.
create function public.bbm_cutoff_kunci_cocok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_key) >= 32 and exists (
    select 1 from vault.decrypted_secrets where name = 'bbm_cutoff_key' and decrypted_secret = p_key), false);
$$;
revoke execute on function public.bbm_cutoff_kunci_cocok(text) from public, anon, authenticated;
grant execute on function public.bbm_cutoff_kunci_cocok(text) to service_role;

create table public.bbm_cutoff_log (
  id bigint generated always as identity primary key,
  spbu_id uuid references public.bbm_spbu (id) on delete cascade,
  dijalankan_at timestamptz not null default now(),
  batas timestamptz,
  jumlah int not null default 0,
  ukuran bigint not null default 0,
  pesan text
);
create index bbm_cutoff_log_spbu_idx on public.bbm_cutoff_log (spbu_id, dijalankan_at desc);
alter table public.bbm_cutoff_log enable row level security;
create policy "pengawas baca" on public.bbm_cutoff_log for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
