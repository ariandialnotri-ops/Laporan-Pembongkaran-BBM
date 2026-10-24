-- Perbaikan keamanan hasil audit.
-- 1. Tabel & bucket generasi pertama (bongkaran, laporan, bukti-bongkaran) tidak lagi dipakai aplikasi, tetapi
--    kebijakannya masih mengizinkan anon membaca/menulis. Kebijakan diubah menjadi selalu menolak dan hak API
--    dicabut; data lama tetap tersimpan (tidak dihapus) agar bisa dicadangkan.
-- 4. ABH tidak dapat menurunkan peran / memindahkan akun ABH lain lewat bbm_add_member (akun ABH tidak punya
--    spbu_id sehingga pemeriksaan "sudah terdaftar di SPBU lain" terlewati).

alter policy "bongkaran baca" on public.bongkaran to authenticated using (false);
alter policy "bongkaran tambah" on public.bongkaran to authenticated with check (false);
alter policy "bongkaran ubah" on public.bongkaran to authenticated using (false) with check (false);
alter policy "laporan baca" on public.laporan to authenticated using (false);
alter policy "laporan tambah" on public.laporan to authenticated with check (false);
alter policy "laporan ubah" on public.laporan to authenticated using (false) with check (false);
revoke all on public.bongkaran, public.laporan from anon, authenticated;

alter policy "bukti baca" on storage.objects to authenticated using (false);
alter policy "bukti unggah" on storage.objects to authenticated with check (false);

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
  -- Akun ABH lain hanya boleh ditautkan sebagai ABH; peran & SPBU-nya yang lain tidak boleh diubah.
  if v_peran = 'abh' and v_id <> auth.uid() and p_role <> 'abh' then
    raise exception 'Akun % adalah ABH; perannya tidak dapat diubah dari sini', v_email;
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
