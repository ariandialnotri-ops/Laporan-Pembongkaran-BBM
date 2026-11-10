-- 1. Housekeeping (form hk-*) hanya diisi Cleaning Service. Pengawas/ABH tetap boleh memaraf (ubah paraf saja).
create or replace function bbm_private.bbm_ops_boleh(p_form text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_form like 'hk-%' then bbm_private.bbm_has_role('cs')
    when p_form in ('sumur-pantau', 'oil-catcher') then bbm_private.bbm_has_role('abh', 'pengawas', 'kashift', 'security')
    else bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')
  end;
$$;

create or replace function bbm_private.bbm_ops_ubah(p_form text) returns boolean
language sql stable security definer set search_path = '' as $$
  select bbm_private.bbm_ops_boleh(p_form) or (p_form like 'hk-%' and bbm_private.bbm_has_role('abh', 'pengawas'));
$$;
revoke execute on function bbm_private.bbm_ops_ubah(text) from public, anon;
grant execute on function bbm_private.bbm_ops_ubah(text) to authenticated;

alter policy "pengisi ubah" on public.bbm_ops
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_ops_ubah(form))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_ops_ubah(form));

create or replace function bbm_private.bbm_ops_jaga() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.spbu_id is distinct from old.spbu_id then
    raise exception 'SPBU catatan tidak dapat diubah';
  end if;
  if (new.data -> 'paraf') is distinct from (case when tg_op = 'UPDATE' then old.data -> 'paraf' end)
     and not bbm_private.bbm_has_role('abh', 'pengawas') then
    raise exception 'Paraf hanya oleh pengawas atau ABH';
  end if;
  -- Pengawas/ABH pada checklist housekeeping hanya memaraf; isian tetap milik Cleaning Service.
  if new.form like 'hk-%' and not bbm_private.bbm_has_role('cs')
     and (tg_op = 'INSERT' or (new.data - 'paraf') is distinct from (old.data - 'paraf')) then
    raise exception 'Checklist housekeeping hanya diisi Cleaning Service';
  end if;
  return new;
end;
$$;

-- 2. Petty cash: ABH tidak mengajukan (pemberi persetujuan akhir); pengaju = kepala shift, pengawas,
--    Admin/Cashier, security, cleaning service. Peran pengaju dicatat (data.peran) untuk laporan per peran.
--    Akun COA dipilih Admin/Cashier saat realisasi; realisasi hanya oleh Admin/Cashier (atau ABH).
create or replace function bbm_private.bbm_petty_alur() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_abh boolean := bbm_private.bbm_has_role('abh');
  v_admin boolean := bbm_private.bbm_has_role('admin');
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if v_abh then
      raise exception 'ABH memberi persetujuan akhir dan tidak dapat mengajukan petty cash';
    end if;
    new.created_by := auth.uid();
    new.data := (new.data - 'review' - 'keputusan' - 'realisasi' - 'peran') || jsonb_build_object('peran', bbm_private.bbm_my_role());
    new.status := case when v_admin then 'Menunggu ABH' else 'Menunggu Admin' end;
    return new;
  end if;
  -- Peran pengaju tidak dapat diubah.
  new.data := (new.data - 'peran') || jsonb_strip_nulls(jsonb_build_object('peran', old.data -> 'peran'));
  if (new.data - 'review' - 'keputusan' - 'realisasi') is distinct from (old.data - 'review' - 'keputusan' - 'realisasi')
     or new.total <> old.total or new.tanggal <> old.tanggal or new.no <> old.no then
    if not (v_abh or (old.status = 'Menunggu Admin' and old.created_by = auth.uid())) then
      raise exception 'Pengajuan yang sudah diperiksa tidak dapat diubah';
    end if;
  end if;
  if (new.data -> 'review') is distinct from (old.data -> 'review') and not (v_abh or v_admin) then
    raise exception 'Persetujuan 1 hanya oleh Admin/Cashier';
  end if;
  if (new.data -> 'keputusan') is distinct from (old.data -> 'keputusan') and not v_abh then
    raise exception 'Persetujuan akhir hanya oleh ABH';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'Menunggu Admin' then
      if v_abh then
        if new.status not in ('Disetujui', 'Ditolak', 'Menunggu ABH') then raise exception 'Status tidak valid'; end if;
      elsif v_admin and old.created_by is distinct from auth.uid() then
        if new.status not in ('Menunggu ABH', 'Ditolak') then raise exception 'Admin/Cashier meneruskan ke ABH atau menolak'; end if;
      else
        raise exception 'Persetujuan 1 hanya oleh Admin/Cashier';
      end if;
    elsif old.status = 'Menunggu ABH' then
      if not v_abh then raise exception 'Persetujuan akhir hanya oleh ABH'; end if;
      if new.status not in ('Disetujui', 'Ditolak') then raise exception 'Status tidak valid'; end if;
    else
      if not v_abh then raise exception 'Pengajuan yang sudah diputuskan tidak dapat diubah'; end if;
    end if;
  end if;
  if (new.data -> 'realisasi') is distinct from (old.data -> 'realisasi') then
    if new.status <> 'Disetujui' then
      raise exception 'Realisasi hanya untuk pengajuan yang disetujui';
    end if;
    if not (v_admin or v_abh) then
      raise exception 'Realisasi petty cash dicatat Admin/Cashier';
    end if;
  end if;
  return new;
end;
$$;

alter policy "finance ajukan" on public.bbm_petty
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('admin', 'pengawas', 'kashift', 'security', 'cs'));
-- Security & cleaning service hanya melihat pengajuan dari perannya sendiri (dan milik sendiri).
alter policy "finance baca" on public.bbm_petty
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and (
    bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift')
    or created_by = auth.uid()
    or (bbm_private.bbm_has_role('security', 'cs') and data ->> 'peran' = bbm_private.bbm_my_role())
  ));
alter policy "finance ubah" on public.bbm_petty
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and (bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift') or created_by = auth.uid()))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and (bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift') or created_by = auth.uid()));

-- 3. Berita acara tindak lanjut insiden boleh berupa PDF.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'application/pdf']
where id = 'bbm-evidence';

-- 4. HSSE > Pengukuran Grounding: satu catatan per tanggal pengukuran (id 'YYYY-MM-DD').
--    data = {titik: {<id>: {area, kelompok, ohm, ket}}, batasOhm, alat, petugas, pelaksana, catatan, foto}.
create table public.bbm_grounding (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}-\d{2}$'),
  tanggal date not null,
  shift smallint not null default 0 check (shift = 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id),
  unique (spbu_id, tanggal)
);
create trigger bbm_grounding_touch before update on public.bbm_grounding for each row execute function public.bbm_touch();
alter table public.bbm_grounding enable row level security;
create policy "anggota baca" on public.bbm_grounding for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "petugas tambah" on public.bbm_grounding for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "petugas ubah" on public.bbm_grounding for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "pengawas hapus" on public.bbm_grounding for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));

-- 5. Personil & Jadwal Shift: jadwal satu catatan per bulan (id 'YYYY-MM'): data.roster[personil][tanggal] = 1|2|3|L|C|I.
--    Daftar personil di bbm_settings.value.personil (diubah ABH, atau pengawas lewat RPC terbatas).
create table public.bbm_jadwal (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}$'),
  tanggal date not null check (extract(day from tanggal) = 1),
  shift smallint not null default 0 check (shift = 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id),
  unique (spbu_id, tanggal)
);
create trigger bbm_jadwal_touch before update on public.bbm_jadwal for each row execute function public.bbm_touch();
alter table public.bbm_jadwal enable row level security;
create policy "anggota baca" on public.bbm_jadwal for select to authenticated using (spbu_id in (select bbm_private.bbm_spbu_saya()));
create policy "pengawas tambah" on public.bbm_jadwal for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
create policy "pengawas ubah" on public.bbm_jadwal for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
create policy "abh hapus" on public.bbm_jadwal for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'));

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
     or (p_patch ? 'hargaProduk' and jsonb_typeof(p_patch -> 'hargaProduk') <> 'object') then
    raise exception 'Data dispenser/nozzle/personil/harga tidak valid';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('namaSpbu', 'kodeSpbu', 'alamatSpbu', 'jumlahPulau', 'jumlahDispenser', 'dispensers', 'nozzles',
                'apar', 'apab', 'aparArea', 'soldTo', 'shipTo', 'fasilitas', 'hargaProduk', 'personil');
  insert into public.bbm_settings (id, spbu_id, value) values (p_spbu::text, p_spbu, v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;
