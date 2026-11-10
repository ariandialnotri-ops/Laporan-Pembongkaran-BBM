-- Super Admin aplikasi: akun ABH yang otomatis mengendalikan SEMUA SPBU (termasuk yang dibuat kemudian)
-- dan boleh mengelola akun ABH lain. Daftarnya disimpan di skema privat sehingga tidak dapat diubah lewat API;
-- tambah/cabut hanya lewat SQL (Dashboard Supabase atau migrasi).

create table if not exists bbm_private.bbm_superadmin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on bbm_private.bbm_superadmin from public, anon, authenticated;

-- Hanya berlaku selama akunnya masih berperan ABH.
create or replace function bbm_private.bbm_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from bbm_private.bbm_superadmin s
    join public.bbm_members m on m.user_id = s.user_id and m.role = 'abh'
    where s.user_id = auth.uid()
  );
$$;

create or replace function bbm_private.bbm_spbu_saya()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.spbu_id from public.bbm_members m where m.user_id = auth.uid() and m.spbu_id is not null
  union
  select a.spbu_id from public.bbm_abh_spbu a
  join public.bbm_members m on m.user_id = a.user_id and m.role = 'abh'
  where a.user_id = auth.uid()
  union
  select s.id from public.bbm_spbu s where bbm_private.bbm_is_superadmin();
$$;

-- Aplikasi menanyakan status Super Admin akun yang sedang masuk.
create or replace function public.bbm_saya_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select bbm_private.bbm_is_superadmin();
$$;
revoke execute on function public.bbm_saya_superadmin() from public, anon;
grant execute on function public.bbm_saya_superadmin() to authenticated;

-- Edge function bbm-akun (service role) memeriksa status Super Admin pemanggil.
create or replace function public.bbm_cek_superadmin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from bbm_private.bbm_superadmin s
    join public.bbm_members m on m.user_id = s.user_id and m.role = 'abh'
    where s.user_id = p_user
  );
$$;
revoke execute on function public.bbm_cek_superadmin(uuid) from public, anon, authenticated;
grant execute on function public.bbm_cek_superadmin(uuid) to service_role;

-- Super Admin boleh mengubah peran / menghapus akun ABH lain (baris ABH tidak punya spbu_id).
alter policy "pengawas ubah anggota" on public.bbm_members
  using ((bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya())) or bbm_private.bbm_is_superadmin())
  with check ((bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya())) or bbm_private.bbm_is_superadmin());
alter policy "pengawas hapus anggota" on public.bbm_members
  using (user_id <> auth.uid() and ((bbm_private.bbm_is_pengawas() and spbu_id in (select bbm_private.bbm_spbu_saya())) or bbm_private.bbm_is_superadmin()));

create or replace function public.bbm_add_member(p_email text, p_nama text, p_role text, p_spbu uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email text;
  v_lama uuid;
  v_peran text;
begin
  if not bbm_private.bbm_is_pengawas() or p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Hanya ABH SPBU ini yang dapat menambah anggota';
  end if;
  if p_role not in ('abh', 'pengawas', 'kashift', 'security', 'cs', 'admin') then
    raise exception 'Peran tidak valid';
  end if;
  select id, email into v_id, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Akun dengan email % belum dibuat', p_email;
  end if;
  select spbu_id, role into v_lama, v_peran from public.bbm_members where user_id = v_id;
  -- Akun ABH lain hanya boleh ditautkan sebagai ABH; peran & SPBU-nya yang lain hanya diubah Super Admin.
  if v_peran = 'abh' and v_id <> auth.uid() and p_role <> 'abh' and not bbm_private.bbm_is_superadmin() then
    raise exception 'Akun % adalah ABH; perannya tidak dapat diubah dari sini', v_email;
  end if;
  if exists (select 1 from bbm_private.bbm_superadmin where user_id = v_id) and v_id <> auth.uid() and p_role <> 'abh' then
    raise exception 'Akun % adalah Super Admin; perannya tidak dapat diubah', v_email;
  end if;
  if v_lama is not null and v_lama <> p_spbu and v_lama not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Akun % sudah terdaftar di SPBU lain', v_email;
  end if;
  if v_peran = 'abh' and p_role = 'abh' then
    insert into public.bbm_abh_spbu (user_id, spbu_id) values (v_id, p_spbu) on conflict do nothing;
    return;
  end if;
  insert into public.bbm_members (user_id, email, nama, role, spbu_id)
  values (v_id, v_email, nullif(trim(p_nama), ''), p_role, case when p_role = 'abh' then null else p_spbu end)
  on conflict (user_id) do update set nama = excluded.nama, role = excluded.role, spbu_id = excluded.spbu_id;
  if p_role = 'abh' then
    insert into public.bbm_abh_spbu (user_id, spbu_id) values (v_id, p_spbu) on conflict do nothing;
  end if;
end;
$$;

-- Menetapkan Super Admin (dijalankan terpisah di SQL Editor, bukan bagian migrasi):
--   insert into bbm_private.bbm_superadmin (user_id) select id from auth.users where lower(email) = '<email>';
-- Mencabut:
--   delete from bbm_private.bbm_superadmin where user_id = (select id from auth.users where lower(email) = '<email>');
