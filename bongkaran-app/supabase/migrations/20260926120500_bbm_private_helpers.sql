-- Pindahkan fungsi pembantu RLS ke skema privat yang tidak diekspos lewat API.
-- Policy mereferensikan fungsi berdasarkan OID, jadi tetap berlaku setelah dipindah.
-- bbm_claim_first & bbm_add_member tetap di public karena dipanggil aplikasi (RPC)
-- dan sudah memeriksa hak akses di dalam fungsinya.

create schema if not exists bbm_private;
grant usage on schema bbm_private to authenticated;

alter function public.bbm_is_member() set schema bbm_private;
alter function public.bbm_is_pengawas() set schema bbm_private;
drop function public.bbm_role();

create or replace function public.bbm_add_member(p_email text, p_nama text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text;
begin
  if not bbm_private.bbm_is_pengawas() then
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
