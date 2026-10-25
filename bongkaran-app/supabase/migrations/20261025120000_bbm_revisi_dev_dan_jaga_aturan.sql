-- 1) Tanda "Revised by Developer": setiap UPDATE oleh super admin (Admin Aplikasi) yang mengubah isi data riwayat
--    mencap data.revisiDev = { at, oleh: 'Developer', kali }. Peran lain tidak dapat menghapus atau memalsukan tanda
--    (selalu dikembalikan ke nilai lama). Trigger diberi nama "bbm_0_..." agar berjalan sebelum trigger penjaga lain.
create or replace function bbm_private.bbm_revisi_dev()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  kol text := tg_argv[0];
  kol2 text := case when tg_nargs > 1 then tg_argv[1] end;
  baru jsonb := to_jsonb(new) -> kol;
  lama jsonb := to_jsonb(old) -> kol;
  tanda jsonb := case when jsonb_typeof(lama) = 'object' then lama -> 'revisiDev' end;
  patch jsonb;
  lain jsonb;
begin
  if baru is null or jsonb_typeof(baru) <> 'object' then
    return new;
  end if;
  if auth.uid() is not null and bbm_private.bbm_is_superadmin()
     and (baru - 'revisiDev') is distinct from (case when jsonb_typeof(lama) = 'object' then lama - 'revisiDev' end) then
    tanda := jsonb_build_object('at', now(), 'oleh', 'Developer', 'kali', coalesce((tanda ->> 'kali')::int, 0) + 1);
  end if;
  if tanda is not null and jsonb_typeof(tanda) <> 'object' then
    tanda := null;
  end if;
  baru := baru - 'revisiDev';
  if tanda is not null then
    baru := baru || jsonb_build_object('revisiDev', tanda);
  end if;
  patch := jsonb_build_object(kol, baru);
  -- Kolom kedua (ringkasan laporan) membawa tanda yang sama agar terlihat di daftar riwayat.
  if kol2 is not null then
    lain := to_jsonb(new) -> kol2;
    if lain is not null and jsonb_typeof(lain) = 'object' then
      lain := lain - 'revisiDev';
      if tanda is not null then
        lain := lain || jsonb_build_object('revisiDev', tanda);
      end if;
      patch := patch || jsonb_build_object(kol2, lain);
    end if;
  end if;
  new := jsonb_populate_record(new, patch);
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['bbm_absen', 'bbm_air', 'bbm_closing', 'bbm_daily', 'bbm_grounding', 'bbm_gts', 'bbm_jadwal', 'bbm_ops', 'bbm_petty', 'bbm_so', 'bbm_takar', 'bbm_totalizer', 'bbm_wbs'] loop
    execute format('drop trigger if exists bbm_0_revisi_dev on public.%I', t);
    execute format('create trigger bbm_0_revisi_dev before update on public.%I for each row execute function bbm_private.bbm_revisi_dev(%L)', t, 'data');
  end loop;
end $$;

drop trigger if exists bbm_0_revisi_dev on public.bbm_reports;
create trigger bbm_0_revisi_dev before update on public.bbm_reports
  for each row execute function bbm_private.bbm_revisi_dev('data', 'summary');

drop trigger if exists bbm_0_revisi_dev on public.bbm_plans;
create trigger bbm_0_revisi_dev before update on public.bbm_plans
  for each row execute function bbm_private.bbm_revisi_dev('meta');

-- Kunci laporan bongkaran yang sudah ditutup: tanda revisi bukan isi laporan (sama seperti sebelumnya, ditambah - 'revisiDev').
create or replace function bbm_private.bbm_reports_kunci()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_lama jsonb := old.data -> 'sample2Jam';
begin
  if old.status = 'draft' then
    return new;
  end if;
  if old.status = 'anomali' and new.status = 'draft' and bbm_private.bbm_has_role('abh', 'pengawas')
     and (new.data - 'revisiDev') = (old.data - 'revisiDev') and new.photos is not distinct from old.photos then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.photos is distinct from old.photos
     or new.finished_at is distinct from old.finished_at
     or (new.data - 'noSO' - 'sample2Jam' - 'revisiDev') is distinct from (old.data - 'noSO' - 'sample2Jam' - 'revisiDev')
     or (coalesce(new.summary, '{}'::jsonb) - 'noSO' - 'sample2Jam' - 'updatedAt' - 'revisiDev') is distinct from (coalesce(old.summary, '{}'::jsonb) - 'noSO' - 'sample2Jam' - 'updatedAt' - 'revisiDev') then
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
end $function$;

-- 2) Aturan pemeriksaan (value.rules) dan PIN penanggung jawab hanya dapat diubah Admin Aplikasi (super admin).
--    Simpanan dari peran lain tetap berhasil, tetapi kedua bagian itu dikembalikan ke nilai lama.
create or replace function bbm_private.bbm_settings_jaga_aturan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  k text;
begin
  if auth.uid() is null or bbm_private.bbm_is_superadmin() then
    return new;
  end if;
  foreach k in array array['rules', 'pinPenanggungJawab'] loop
    if tg_op = 'UPDATE' and old.value ? k then
      new.value := jsonb_set(new.value, array[k], old.value -> k);
    else
      new.value := new.value - k;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists bbm_settings_jaga_aturan on public.bbm_settings;
create trigger bbm_settings_jaga_aturan
  before insert or update on public.bbm_settings
  for each row execute function bbm_private.bbm_settings_jaga_aturan();
