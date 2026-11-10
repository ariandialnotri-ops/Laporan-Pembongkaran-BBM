-- Finance > Petty Cash: pengajuan pengadaan barang/jasa (wajib akun COA, daftar COA dari aplikasi One Touch
-- Solution) dan realisasi anggaran (nota wajib).
-- Alur: pengaju (kepala shift/pengawas) -> pemeriksaan pengawas -> nominal <= batas: disetujui pengawas;
-- di atas batas (pengaturan pettyBatasAbh, bawaan Rp 500.000) -> persetujuan ABH. Pengajuan pengawas langsung
-- ke ABH (tidak menyetujui pengajuannya sendiri). ABH dapat menyetujui di tahap mana pun.
-- data = {coa{accountNo,activity,sapAccount,coaId}, uraian, qty, satuan, harga, total, vendor, alasan, lampiran[],
--         diajukanNama, review{by,nama,at,catatan}, keputusan{...}, realisasi{tanggal,nominal,catatan,nota[],by,nama,at}}
create table public.bbm_petty (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{4,60}$'),
  no text not null,
  tanggal date not null,
  status text not null check (status in ('Menunggu Pengawas', 'Menunggu ABH', 'Disetujui', 'Ditolak')),
  total numeric(14, 2) not null check (total > 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id),
  unique (spbu_id, no)
);
create index bbm_petty_spbu_tanggal_idx on public.bbm_petty (spbu_id, tanggal desc);
create trigger bbm_petty_touch before update on public.bbm_petty for each row execute function public.bbm_touch();

create function bbm_private.bbm_petty_batas(p_spbu uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(value ->> 'pettyBatasAbh', '')::numeric from public.bbm_settings where spbu_id = p_spbu), 500000);
$$;

-- Penjaga alur status (berlaku juga untuk klien yang memanggil API langsung).
create function bbm_private.bbm_petty_alur() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_abh boolean := bbm_private.bbm_has_role('abh');
  v_pengawas boolean := bbm_private.bbm_has_role('pengawas');
  v_batas numeric := bbm_private.bbm_petty_batas(new.spbu_id);
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.data := new.data - 'review' - 'keputusan' - 'realisasi';
    -- Status awal: ABH langsung disetujui; pengawas langsung ke ABH; kepala shift ke pengawas.
    new.status := case when v_abh then 'Disetujui' when v_pengawas then 'Menunggu ABH' else 'Menunggu Pengawas' end;
    return new;
  end if;
  -- Isi pengajuan (selain review/keputusan/realisasi) hanya dapat diubah ABH, atau pengaju selagi menunggu pengawas.
  if (new.data - 'review' - 'keputusan' - 'realisasi') is distinct from (old.data - 'review' - 'keputusan' - 'realisasi')
     or new.total <> old.total or new.tanggal <> old.tanggal or new.no <> old.no then
    if not (v_abh or (old.status = 'Menunggu Pengawas' and old.created_by = auth.uid())) then
      raise exception 'Pengajuan yang sudah diperiksa tidak dapat diubah';
    end if;
  end if;
  -- Catatan pemeriksaan & keputusan hanya dari pengawas/ABH.
  if ((new.data -> 'review') is distinct from (old.data -> 'review') or (new.data -> 'keputusan') is distinct from (old.data -> 'keputusan'))
     and not (v_abh or v_pengawas) then
    raise exception 'Hanya pengawas atau ABH yang memeriksa pengajuan';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'Menunggu Pengawas' then
      if not (v_abh or v_pengawas) then raise exception 'Hanya pengawas atau ABH yang memeriksa pengajuan'; end if;
      if new.status = 'Disetujui' and not v_abh and new.total > v_batas then
        raise exception 'Di atas batas, pengajuan harus diteruskan ke ABH';
      end if;
    elsif old.status = 'Menunggu ABH' then
      if not v_abh then raise exception 'Hanya ABH yang menyetujui pengajuan ini'; end if;
      if new.status not in ('Disetujui', 'Ditolak') then raise exception 'Status tidak valid'; end if;
    else
      if not v_abh then raise exception 'Pengajuan yang sudah diputuskan tidak dapat diubah'; end if;
    end if;
  end if;
  -- Realisasi hanya untuk pengajuan yang disetujui.
  if (new.data -> 'realisasi') is distinct from (old.data -> 'realisasi') and new.status <> 'Disetujui' then
    raise exception 'Realisasi hanya untuk pengajuan yang disetujui';
  end if;
  return new;
end;
$$;
create trigger bbm_petty_alur before insert or update on public.bbm_petty for each row execute function bbm_private.bbm_petty_alur();

alter table public.bbm_petty enable row level security;
create policy "finance baca" on public.bbm_petty for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "finance ajukan" on public.bbm_petty for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "finance ubah" on public.bbm_petty for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'kashift'));
create policy "finance hapus" on public.bbm_petty for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya())
         and (bbm_private.bbm_has_role('abh') or (status = 'Menunggu Pengawas' and created_by = auth.uid())));

-- Batas persetujuan & plafon petty cash diatur ABH (pengaturan penuh). Bukti keuangan (folder petty-*) tidak
-- ikut cut-off foto tanggal 5 dan arsip ZIP.
create or replace function public.bbm_foto_arsip(p_spbu uuid)
returns table (name text, ukuran bigint, dibuat timestamptz, batas timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_batas timestamptz;
begin
  if not bbm_private.bbm_has_role('abh', 'pengawas') or p_spbu is null or p_spbu not in (select bbm_private.bbm_spbu_saya()) then
    raise exception 'Hanya ABH atau pengawas SPBU ini';
  end if;
  v_batas := bbm_private.bbm_batas_foto(p_spbu);
  return query
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at, v_batas
    from storage.objects o
    where o.bucket_id = 'bbm-evidence' and o.created_at < v_batas and bbm_private.bbm_foto_spbu(o.name) = p_spbu
      and split_part(o.name, '/', 2) not like 'wbs-%' and split_part(o.name, '/', 2) not like 'petty-%'
    order by o.created_at;
end;
$$;

create or replace function public.bbm_cutoff_kandidat(p_limit int default 1000)
returns table (name text, spbu_id uuid, ukuran bigint, batas timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.name, x.spbu_id, coalesce((o.metadata ->> 'size')::bigint, 0), x.batas
  from storage.objects o
  cross join lateral (select bbm_private.bbm_foto_spbu(o.name) as spbu_id) s
  cross join lateral (select s.spbu_id, bbm_private.bbm_batas_foto(s.spbu_id) as batas) x
  where o.bucket_id = 'bbm-evidence' and o.created_at < x.batas
    and split_part(o.name, '/', 2) not like 'wbs-%' and split_part(o.name, '/', 2) not like 'petty-%'
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;
