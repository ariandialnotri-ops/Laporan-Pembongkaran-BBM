-- Skema database aplikasi Evidence Pembongkaran BBM.
-- Semua objek memakai awalan bbm_ agar tidak bentrok dengan tabel lain di proyek yang sama.
--
-- Akses: hanya pengguna login yang terdaftar di bbm_members.
--   pengawas : semua akses (plan pengiriman, pengaturan, anggota, hapus laporan)
--   petugas  : baca semua, buat/ubah laporan pembongkaran, hapus draft miliknya sendiri
-- Pengguna pertama yang login otomatis menjadi pengawas (bbm_claim_first).

create table public.bbm_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nama text,
  role text not null default 'petugas' check (role in ('pengawas', 'petugas')),
  created_at timestamptz not null default now()
);

create table public.bbm_settings (
  id text primary key default 'default',
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table public.bbm_plans (
  id text primary key,
  tanggal date,
  no_so text not null,
  produk text not null,
  sold_to text,
  los jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.bbm_reports (
  id text primary key,
  status text not null default 'draft' check (status in ('draft', 'selesai', 'anomali')),
  data jsonb not null,
  photos jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid()
);

create index bbm_reports_created_at_idx on public.bbm_reports (created_at desc);
create index bbm_plans_tanggal_idx on public.bbm_plans (tanggal desc);

-- updated_at & updated_by otomatis
create function public.bbm_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger bbm_reports_touch before update on public.bbm_reports
  for each row execute function public.bbm_touch();
create trigger bbm_settings_touch before update on public.bbm_settings
  for each row execute function public.bbm_touch();

-- Helper peran (security definer supaya tidak rekursif terhadap RLS bbm_members)
create function public.bbm_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.bbm_members where user_id = auth.uid();
$$;

create function public.bbm_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bbm_members where user_id = auth.uid());
$$;

create function public.bbm_is_pengawas() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bbm_members where user_id = auth.uid() and role = 'pengawas');
$$;

-- Pengguna pertama yang login menjadi pengawas. Mengembalikan peran pemanggil.
create function public.bbm_claim_first() returns text
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
    insert into public.bbm_members (user_id, email, role) values (auth.uid(), v_email, 'pengawas');
  end if;
  return (select role from public.bbm_members where user_id = auth.uid());
end;
$$;

-- Pengawas menambahkan anggota berdasarkan email akun yang sudah dibuat di Supabase Auth.
create function public.bbm_add_member(p_email text, p_nama text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text;
begin
  if not public.bbm_is_pengawas() then
    raise exception 'Hanya pengawas yang dapat menambah anggota';
  end if;
  if p_role not in ('pengawas', 'petugas') then
    raise exception 'Peran tidak valid';
  end if;
  select id, email into v_id, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Akun dengan email % belum dibuat di Supabase Auth', p_email;
  end if;
  insert into public.bbm_members (user_id, email, nama, role)
  values (v_id, v_email, nullif(trim(p_nama), ''), p_role)
  on conflict (user_id) do update set nama = excluded.nama, role = excluded.role;
end;
$$;

revoke execute on function public.bbm_role(), public.bbm_is_member(), public.bbm_is_pengawas(),
  public.bbm_claim_first(), public.bbm_add_member(text, text, text) from public, anon;
grant execute on function public.bbm_role(), public.bbm_is_member(), public.bbm_is_pengawas(),
  public.bbm_claim_first(), public.bbm_add_member(text, text, text) to authenticated;

-- Row Level Security
alter table public.bbm_members enable row level security;
alter table public.bbm_settings enable row level security;
alter table public.bbm_plans enable row level security;
alter table public.bbm_reports enable row level security;

create policy "anggota baca" on public.bbm_members for select to authenticated using (public.bbm_is_member());
create policy "pengawas ubah anggota" on public.bbm_members for update to authenticated
  using (public.bbm_is_pengawas()) with check (public.bbm_is_pengawas());
create policy "pengawas hapus anggota" on public.bbm_members for delete to authenticated
  using (public.bbm_is_pengawas() and user_id <> auth.uid());

create policy "anggota baca" on public.bbm_settings for select to authenticated using (public.bbm_is_member());
create policy "pengawas tambah" on public.bbm_settings for insert to authenticated with check (public.bbm_is_pengawas());
create policy "pengawas ubah" on public.bbm_settings for update to authenticated
  using (public.bbm_is_pengawas()) with check (public.bbm_is_pengawas());

create policy "anggota baca" on public.bbm_plans for select to authenticated using (public.bbm_is_member());
create policy "pengawas tambah" on public.bbm_plans for insert to authenticated with check (public.bbm_is_pengawas());
create policy "pengawas ubah" on public.bbm_plans for update to authenticated
  using (public.bbm_is_pengawas()) with check (public.bbm_is_pengawas());
create policy "pengawas hapus" on public.bbm_plans for delete to authenticated using (public.bbm_is_pengawas());

create policy "anggota baca" on public.bbm_reports for select to authenticated using (public.bbm_is_member());
create policy "anggota tambah" on public.bbm_reports for insert to authenticated with check (public.bbm_is_member());
create policy "anggota ubah" on public.bbm_reports for update to authenticated
  using (public.bbm_is_member()) with check (public.bbm_is_member());
create policy "hapus laporan" on public.bbm_reports for delete to authenticated
  using (public.bbm_is_pengawas() or (created_by = auth.uid() and status = 'draft'));

-- Foto evidence (bucket privat, hanya anggota)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bbm-evidence', 'bbm-evidence', false, 5242880, array['image/jpeg', 'image/png']);

create policy "bbm evidence baca" on storage.objects for select to authenticated
  using (bucket_id = 'bbm-evidence' and public.bbm_is_member());
create policy "bbm evidence unggah" on storage.objects for insert to authenticated
  with check (bucket_id = 'bbm-evidence' and public.bbm_is_member());
create policy "bbm evidence hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'bbm-evidence' and public.bbm_is_member());
