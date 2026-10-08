-- Peran pengguna FLOQ:
--   abh      : Area Business Head, semua akses + kelola anggota, pengaturan SPBU, data utama APAR
--   pengawas : bongkaran & TTD BA, stok awal, uji pasca penerimaan, dashboard monitoring, laporan
--   kashift  : kepala shift; stok awal, bongkaran, kualitas harian, tracking SO & LO, inspeksi APAR
--   security : inspeksi APAR/APAB saja
-- Peran lama: pengawas (admin) -> abh, petugas -> kashift.

alter table public.bbm_members drop constraint if exists bbm_members_role_check;
update public.bbm_members set role = 'abh' where role = 'pengawas';
update public.bbm_members set role = 'kashift' where role = 'petugas';
alter table public.bbm_members add constraint bbm_members_role_check check (role in ('abh', 'pengawas', 'kashift', 'security'));
alter table public.bbm_members alter column role set default 'kashift';

-- Peran pemanggil (security definer agar tidak rekursif terhadap RLS bbm_members).
create or replace function bbm_private.bbm_my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.bbm_members where user_id = auth.uid();
$$;

-- Admin = ABH. Nama fungsi lama dipertahankan karena dipakai policy berdasarkan OID.
create or replace function bbm_private.bbm_is_pengawas() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bbm_members where user_id = auth.uid() and role = 'abh');
$$;

create or replace function bbm_private.bbm_has_role(variadic p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.bbm_members where user_id = auth.uid()) = any (p_roles), false);
$$;

revoke execute on function bbm_private.bbm_my_role(), bbm_private.bbm_has_role(text[]) from public, anon;
grant execute on function bbm_private.bbm_my_role(), bbm_private.bbm_has_role(text[]) to authenticated;

-- Pengguna pertama yang login menjadi ABH.
create or replace function public.bbm_claim_first() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return null;
  end if;
  lock table public.bbm_members in exclusive mode;
  if not exists (select 1 from public.bbm_members) then
    select email into v_email from auth.users where id = auth.uid();
    insert into public.bbm_members (user_id, email, role) values (auth.uid(), v_email, 'abh');
  end if;
  return (select role from public.bbm_members where user_id = auth.uid());
end;
$$;

create or replace function public.bbm_add_member(p_email text, p_nama text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text;
begin
  if not bbm_private.bbm_is_pengawas() then
    raise exception 'Hanya ABH yang dapat menambah anggota';
  end if;
  if p_role not in ('abh', 'pengawas', 'kashift', 'security') then
    raise exception 'Peran tidak valid';
  end if;
  select id, email into v_id, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Akun dengan email % belum dibuat', p_email;
  end if;
  insert into public.bbm_members (user_id, email, nama, role)
  values (v_id, v_email, nullif(trim(p_nama), ''), p_role)
  on conflict (user_id) do update set nama = excluded.nama, role = excluded.role;
end;
$$;

-- Aturan tulis per peran. Policy lama diubah di tempat (ALTER POLICY), bukan dihapus.
-- Policy "pengawas tambah/ubah" lama pada bbm_plans kini berarti ABH (bagian dari aturan di bawah).

-- Plan (SO & LO): semua kecuali security. Pengawas ikut mengubah LO dari form bongkaran.
alter policy "anggota tambah" on public.bbm_plans with check (bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "anggota ubah" on public.bbm_plans
  using (bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')) with check (bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "pengawas hapus" on public.bbm_plans using (bbm_private.bbm_has_role('abh', 'pengawas'));

-- Laporan bongkaran & uji pasca penerimaan: semua kecuali security.
alter policy "anggota tambah" on public.bbm_reports with check (bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "anggota ubah" on public.bbm_reports
  using (bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')) with check (bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
alter policy "hapus laporan" on public.bbm_reports using (bbm_private.bbm_has_role('abh', 'pengawas') or (created_by = auth.uid() and status = 'draft'));

-- Catatan harian: security hanya inspeksi APAR (kind 'apar', satu record per unit per tanggal).
alter policy "anggota tambah" on public.bbm_daily
  with check (bbm_private.bbm_is_member() and (kind = 'apar' or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')));
alter policy "anggota ubah" on public.bbm_daily
  using (bbm_private.bbm_is_member() and (kind = 'apar' or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')))
  with check (bbm_private.bbm_is_member() and (kind = 'apar' or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')));
alter policy "hapus catatan" on public.bbm_daily using (bbm_private.bbm_has_role('abh', 'pengawas') or created_by = auth.uid());
