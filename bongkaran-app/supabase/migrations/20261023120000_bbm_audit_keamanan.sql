-- Perbaikan audit keamanan FLOQ (Okt 2026).
-- 1. BA yang sudah ditutup (selesai/anomali) dikunci di database, bukan hanya di layar.
-- 2. Laporan berstatus selesai tidak dapat dihapus siapa pun.
-- 3. Foto bukti hanya dapat dihapus ABH/pengawas atau pengunggahnya, dan tidak untuk laporan selesai.
-- 4. Absensi: token QR dipindah ke tabel privat (tidak terbaca anggota), personil hanya boleh absen untuk
--    dirinya sendiri (akun tertaut) kecuali ABH/pengawas.
-- 8. Fungsi lama dihapus; bbm_claim_first tidak lagi menjadikan pemanggil ABH.

-- 1. Kunci laporan bongkaran yang sudah ditutup ----------------------------------------------------------
-- Laporan draft bebas diubah (termasuk menutup). Setelah ditutup hanya boleh:
--   a) ABH/pengawas membuka kembali laporan anomali menjadi draft (tombol "Buka kembali"), tanpa mengubah isi;
--   b) menambah uji kualitas pasca penerimaan (data.sample2Jam) sekali;
--   c) ABH/pengawas mengoreksi nomor SO (Edit SO & LO), nomor di ringkasan ikut sama.
-- Selain itu (angka, TTD, foto, status) ditolak.
create or replace function bbm_private.bbm_reports_kunci() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_lama jsonb := old.data -> 'sample2Jam';
begin
  if old.status = 'draft' then
    return new;
  end if;
  if old.status = 'anomali' and new.status = 'draft' and bbm_private.bbm_has_role('abh', 'pengawas')
     and new.data = old.data and new.photos is not distinct from old.photos then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.photos is distinct from old.photos
     or new.finished_at is distinct from old.finished_at
     or (new.data - 'noSO' - 'sample2Jam') is distinct from (old.data - 'noSO' - 'sample2Jam')
     or (coalesce(new.summary, '{}'::jsonb) - 'noSO' - 'sample2Jam' - 'updatedAt') is distinct from (coalesce(old.summary, '{}'::jsonb) - 'noSO' - 'sample2Jam' - 'updatedAt') then
    raise exception 'Laporan sudah ditutup (%) dan terkunci', old.status;
  end if;
  if v_lama is not null and jsonb_typeof(v_lama) <> 'null' and new.data -> 'sample2Jam' is distinct from v_lama then
    raise exception 'Uji pasca penerimaan sudah tercatat dan terkunci';
  end if;
  if new.data -> 'noSO' is distinct from old.data -> 'noSO' then
    if not bbm_private.bbm_has_role('abh', 'pengawas') then
      raise exception 'Nomor SO laporan yang sudah ditutup hanya dapat diubah pengawas atau ABH';
    end if;
    if new.summary -> 'noSO' is distinct from new.data -> 'noSO' then
      raise exception 'Nomor SO ringkasan tidak sesuai laporan';
    end if;
  end if;
  return new;
end $$;
create or replace trigger bbm_reports_kunci before update on public.bbm_reports
  for each row execute function bbm_private.bbm_reports_kunci();

-- 2. Laporan selesai tidak dapat dihapus --------------------------------------------------------------------
alter policy "hapus laporan" on public.bbm_reports using (
  spbu_id in (select bbm_private.bbm_spbu_saya())
  and status <> 'selesai'
  and (bbm_private.bbm_has_role('abh', 'pengawas') or (created_by = auth.uid() and status = 'draft')));

-- 3. Hapus foto bukti --------------------------------------------------------------------------------------
-- Path: '<spbu>/<id laporan/catatan>/<file>' (lama: '<id>/<file>').
create or replace function bbm_private.bbm_foto_laporan_selesai(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bbm_reports r
    where r.status = 'selesai'
      and r.id = case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then split_part(p_name, '/', 2) else split_part(p_name, '/', 1) end);
$$;
revoke execute on function bbm_private.bbm_foto_laporan_selesai(text) from public, anon;
grant execute on function bbm_private.bbm_foto_laporan_selesai(text) to authenticated;

alter policy "bbm evidence hapus" on storage.objects using (
  bucket_id = 'bbm-evidence'
  and bbm_private.bbm_foto_boleh(name)
  and (split_part(name, '/', 2) not like 'wbs-%' or bbm_private.bbm_has_role('abh'))
  and (bbm_private.bbm_has_role('abh', 'pengawas') or owner_id = (select auth.uid())::text)
  and not bbm_private.bbm_foto_laporan_selesai(name));

-- 4. Absensi -----------------------------------------------------------------------------------------------
create table if not exists bbm_private.bbm_absen_token (
  spbu_id uuid primary key references public.bbm_spbu (id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
revoke all on bbm_private.bbm_absen_token from public, anon, authenticated;

-- Token lama di pengaturan (bila ada) dipindah lalu dihapus dari pengaturan.
insert into bbm_private.bbm_absen_token (spbu_id, token)
  select spbu_id, value -> 'absensi' ->> 'token' from public.bbm_settings
  where spbu_id is not null and coalesce(value -> 'absensi' ->> 'token', '') <> ''
on conflict (spbu_id) do nothing;
update public.bbm_settings set value = jsonb_set(value, '{absensi}', (value -> 'absensi') - 'token')
  where value -> 'absensi' ? 'token';

-- Pengaturan tidak pernah menyimpan token QR (juga simpan langsung oleh ABH).
create or replace function bbm_private.bbm_settings_tanpa_token() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.value -> 'absensi') = 'object' and new.value -> 'absensi' ? 'token' then
    new.value := jsonb_set(new.value, '{absensi}', (new.value -> 'absensi') - 'token');
  end if;
  return new;
end $$;
create or replace trigger bbm_settings_tanpa_token before insert or update on public.bbm_settings
  for each row execute function bbm_private.bbm_settings_tanpa_token();

-- Teks QR absensi SPBU (ABH/pengawas); token dibuat bila belum ada, p_baru = true mengganti token.
create or replace function public.bbm_absen_qr(p_spbu uuid, p_baru boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
begin
  if p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) or not bbm_private.bbm_has_role('abh', 'pengawas') then
    raise exception 'Hanya ABH atau pengawas SPBU ini yang dapat melihat QR absensi';
  end if;
  select token into v_token from bbm_private.bbm_absen_token where spbu_id = p_spbu;
  if v_token is null or p_baru then
    v_token := encode(extensions.gen_random_bytes(12), 'hex');
    insert into bbm_private.bbm_absen_token (spbu_id, token) values (p_spbu, v_token)
      on conflict (spbu_id) do update set token = excluded.token, updated_at = now(), updated_by = auth.uid();
  end if;
  return 'FLOQ-ABSEN|' || p_spbu::text || '|' || v_token;
end $$;
revoke execute on function public.bbm_absen_qr(uuid, boolean) from public, anon;
grant execute on function public.bbm_absen_qr(uuid, boolean) to authenticated;

create or replace function public.bbm_absen(p_spbu uuid, p_personil text, p_jenis text, p_tanggal date, p_lat double precision, p_lng double precision, p_akurasi double precision, p_kode text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_set jsonb;
  v_abs jsonb;
  v_token text;
  v_p jsonb;
  v_radius double precision;
  v_jarak double precision;
  v_titik jsonb;
  v_rec public.bbm_absen%rowtype;
  v_data jsonb;
  v_n int;
  v_sedang boolean;
  v_nama text;
begin
  if p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Anda bukan anggota SPBU ini';
  end if;
  if p_jenis not in ('masuk', 'istirahat', 'kembali', 'keluar') then
    raise exception 'Jenis absen tidak valid';
  end if;
  select value into v_set from public.bbm_settings where spbu_id = p_spbu;
  v_abs := v_set -> 'absensi';
  select token into v_token from bbm_private.bbm_absen_token where spbu_id = p_spbu;
  if v_abs is null or v_token is null or jsonb_typeof(v_abs -> 'lat') <> 'number' or jsonb_typeof(v_abs -> 'lng') <> 'number' then
    raise exception 'Titik lokasi & QR absensi SPBU belum diatur. Hubungi pengawas.';
  end if;
  if p_kode is distinct from 'FLOQ-ABSEN|' || p_spbu::text || '|' || v_token then
    raise exception 'QR bukan QR absensi SPBU ini atau sudah diganti. Pindai QR absensi yang terpasang di SPBU.';
  end if;
  select x into v_p from jsonb_array_elements(coalesce(v_set -> 'personil', '[]'::jsonb)) x
    where x ->> 'id' = p_personil and coalesce((x ->> 'aktif')::boolean, true) limit 1;
  if v_p is null then
    raise exception 'Personil tidak ditemukan atau tidak aktif';
  end if;
  -- Hanya untuk diri sendiri (personil tertaut ke akun pemanggil), kecuali ABH/pengawas.
  if not bbm_private.bbm_has_role('abh', 'pengawas') and (v_p ->> 'akunId') is distinct from auth.uid()::text then
    raise exception 'Anda hanya dapat absen untuk diri sendiri. Minta pengawas menautkan akun Anda ke data personil.';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Lokasi GPS wajib untuk absen';
  end if;
  v_radius := coalesce((v_abs ->> 'radius')::double precision, 100);
  v_jarak := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - (v_abs ->> 'lat')::double precision) / 2), 2)
    + cos(radians((v_abs ->> 'lat')::double precision)) * cos(radians(p_lat)) * power(sin(radians(p_lng - (v_abs ->> 'lng')::double precision) / 2), 2)));
  if v_jarak - least(coalesce(p_akurasi, 0), 50) > v_radius then
    raise exception 'Di luar area SPBU: % m dari titik absensi (batas % m)', round(v_jarak), round(v_radius);
  end if;
  if p_tanggal is null or abs(p_tanggal - (v_now at time zone 'Asia/Jakarta')::date) > 1 then
    raise exception 'Tanggal perangkat tidak sesuai. Periksa tanggal & jam HP.';
  end if;
  select nama into v_nama from public.bbm_members where user_id = auth.uid();
  v_titik := jsonb_build_object('at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'lat', p_lat, 'lng', p_lng,
    'akurasi', round(coalesce(p_akurasi, 0)), 'jarak', round(v_jarak), 'oleh', auth.uid(), 'olehNama', coalesce(v_nama, ''));

  select * into v_rec from public.bbm_absen
    where spbu_id = p_spbu and data ->> 'personilId' = p_personil and not (data ? 'keluar')
      and (data -> 'masuk' ->> 'at')::timestamptz > v_now - interval '20 hours'
    order by tanggal desc limit 1 for update;

  if p_jenis = 'masuk' then
    if found then
      raise exception '% sudah absen masuk dan belum absen keluar.', v_p ->> 'nama';
    end if;
    if exists (select 1 from public.bbm_absen where spbu_id = p_spbu and id = p_tanggal::text || '_' || p_personil) then
      raise exception '% sudah absen masuk & keluar pada tanggal ini.', v_p ->> 'nama';
    end if;
    v_data := jsonb_build_object('personilId', p_personil, 'nama', v_p ->> 'nama', 'jabatan', coalesce(v_p ->> 'jabatan', ''), 'masuk', v_titik, 'istirahat', '[]'::jsonb);
    insert into public.bbm_absen (spbu_id, id, tanggal, data) values (p_spbu, p_tanggal::text || '_' || p_personil, p_tanggal, v_data);
    return v_data;
  end if;

  if not found then
    raise exception '% belum absen masuk.', v_p ->> 'nama';
  end if;
  v_data := v_rec.data;
  v_n := jsonb_array_length(coalesce(v_data -> 'istirahat', '[]'::jsonb));
  v_sedang := v_n > 0 and not ((v_data -> 'istirahat' -> (v_n - 1)) ? 'selesai');
  if p_jenis = 'istirahat' then
    if v_sedang then
      raise exception '% sedang istirahat.', v_p ->> 'nama';
    end if;
    v_data := jsonb_set(v_data, '{istirahat}', coalesce(v_data -> 'istirahat', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('mulai', v_titik)));
  elsif p_jenis = 'kembali' then
    if not v_sedang then
      raise exception '% belum mulai istirahat.', v_p ->> 'nama';
    end if;
    v_data := jsonb_set(v_data, array['istirahat', (v_n - 1)::text, 'selesai'], v_titik);
  else
    if v_sedang then
      v_data := jsonb_set(v_data, array['istirahat', (v_n - 1)::text, 'selesai'], v_titik);
    end if;
    v_data := v_data || jsonb_build_object('keluar', v_titik);
  end if;
  update public.bbm_absen set data = v_data, updated_by = auth.uid() where spbu_id = p_spbu and id = v_rec.id;
  return v_data;
end;
$$;

-- 8. Fungsi lama & klaim ABH pertama ----------------------------------------------------------------------
-- Fungsi lama (tidak dipakai aplikasi) tidak dapat dipanggil siapa pun; boleh di-drop kemudian.
revoke execute on function public.bbm_add_member(text, text, text) from public, anon, authenticated;
revoke execute on function public.bbm_save_apar(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.bbm_save_settings_terbatas(jsonb) from public, anon, authenticated;

-- Hanya membaca peran pemanggil (RLS bbm_members mengizinkan baris sendiri); tidak pernah membuat ABH.
create or replace function public.bbm_claim_first() returns text
language sql stable security invoker set search_path = '' as $$
  select role from public.bbm_members where user_id = auth.uid();
$$;
