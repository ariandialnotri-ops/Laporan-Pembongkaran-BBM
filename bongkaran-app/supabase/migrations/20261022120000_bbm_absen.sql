-- Absensi personil SPBU: masuk, istirahat (mulai/selesai), keluar. Satu catatan per personil per tanggal masuk
-- (id '<YYYY-MM-DD>_<id personil>'). Ditulis hanya lewat RPC bbm_absen: jam dari server, QR absensi
-- (settings.absensi.token) dan jarak GPS ke titik absensi (settings.absensi lat/lng/radius) diperiksa di server.
create table public.bbm_absen (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}-\d{2}_.+$'),
  tanggal date not null,
  shift smallint not null default 0 check (shift = 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id)
);
create index bbm_absen_tanggal on public.bbm_absen (spbu_id, tanggal);
create trigger bbm_absen_touch before update on public.bbm_absen for each row execute function public.bbm_touch();
alter table public.bbm_absen enable row level security;
create policy "anggota baca" on public.bbm_absen for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
-- Koreksi: ABH / pengawas dapat menghapus catatan yang salah (personil lalu absen ulang).
create policy "pengawas hapus" on public.bbm_absen for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));

create or replace function public.bbm_absen(p_spbu uuid, p_personil text, p_jenis text, p_tanggal date, p_lat double precision, p_lng double precision, p_akurasi double precision, p_kode text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_set jsonb;
  v_abs jsonb;
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
  if v_abs is null or coalesce(v_abs ->> 'token', '') = '' or jsonb_typeof(v_abs -> 'lat') <> 'number' or jsonb_typeof(v_abs -> 'lng') <> 'number' then
    raise exception 'Titik lokasi & QR absensi SPBU belum diatur. Hubungi pengawas.';
  end if;
  if p_kode is distinct from 'FLOQ-ABSEN|' || p_spbu::text || '|' || (v_abs ->> 'token') then
    raise exception 'QR bukan QR absensi SPBU ini atau sudah diganti. Pindai QR absensi yang terpasang di SPBU.';
  end if;
  select x into v_p from jsonb_array_elements(coalesce(v_set -> 'personil', '[]'::jsonb)) x
    where x ->> 'id' = p_personil and coalesce((x ->> 'aktif')::boolean, true) limit 1;
  if v_p is null then
    raise exception 'Personil tidak ditemukan atau tidak aktif';
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
revoke execute on function public.bbm_absen(uuid, text, text, date, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.bbm_absen(uuid, text, text, date, double precision, double precision, double precision, text) to authenticated;

-- Pengawas boleh mengatur titik lokasi, radius, dan QR absensi (settings.absensi).
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
     or (p_patch ? 'personil' and jsonb_typeof(p_patch -> 'personil') <> 'array')
     or (p_patch ? 'absensi' and jsonb_typeof(p_patch -> 'absensi') <> 'object')
     or (p_patch ? 'hargaProduk' and jsonb_typeof(p_patch -> 'hargaProduk') <> 'object') then
    raise exception 'Data dispenser/nozzle/personil/absensi/harga tidak valid';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('namaSpbu', 'kodeSpbu', 'alamatSpbu', 'jumlahPulau', 'jumlahDispenser', 'dispensers', 'nozzles',
                'apar', 'apab', 'aparArea', 'soldTo', 'shipTo', 'fasilitas', 'hargaProduk', 'personil', 'absensi');
  insert into public.bbm_settings (id, spbu_id, value) values (p_spbu::text, p_spbu, v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;
