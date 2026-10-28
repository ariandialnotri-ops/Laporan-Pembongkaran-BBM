-- Peran baru Admin / Cashier: persetujuan 1 petty cash (alur di 20261016150100_bbm_admin_petty_alur.sql).

-- 1. Peran Admin / Cashier
alter table public.bbm_members drop constraint if exists bbm_members_role_check;
alter table public.bbm_members add constraint bbm_members_role_check check (role in ('abh', 'pengawas', 'kashift', 'security', 'cs', 'admin'));

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
  if p_role not in ('abh', 'pengawas', 'kashift', 'security', 'cs', 'admin') then
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
