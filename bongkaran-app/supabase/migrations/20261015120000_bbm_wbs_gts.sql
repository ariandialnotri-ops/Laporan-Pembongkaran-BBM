-- 1. Whistle Blowing System (WBS): semua anggota SPBU boleh melapor; hanya ABH pengendali SPBU yang
--    dapat membaca dan menindaklanjuti. Laporan dikirim lewat edge function bbm-wbs (service role):
--    laporan & foto bukti tidak menyimpan akun pelapor bila anonim (termasuk pemilik objek foto).
--    data = {kategori, tanggal, jam, lokasi, terlibat, uraian, anonim, kontak, foto[], riwayat[]}
create table public.bbm_wbs (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{4,60}$'),
  status text not null default 'baru' check (status in ('baru', 'ditinjau', 'selesai')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id)
);
create index bbm_wbs_spbu_created_idx on public.bbm_wbs (spbu_id, created_at desc);
create trigger bbm_wbs_touch before update on public.bbm_wbs for each row execute function public.bbm_touch();

-- Pelapor tidak dapat memalsukan identitas: anonim = tanpa akun. Lewat edge function (service role) akun
-- pelapor non-anonim diisi fungsi; dari klien langsung selalu akun pengirim. Laporan baru selalu 'baru'.
create function bbm_private.bbm_wbs_pelapor() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce((new.data ->> 'anonim')::boolean, true) then
    new.created_by := null;
  elsif current_user <> 'service_role' then
    new.created_by := auth.uid();
  end if;
  new.status := 'baru';
  new.created_at := now();
  return new;
end;
$$;
create trigger bbm_wbs_pelapor before insert on public.bbm_wbs for each row execute function bbm_private.bbm_wbs_pelapor();

alter table public.bbm_wbs enable row level security;
-- Tidak ada izin tambah langsung dari klien: laporan masuk lewat edge function bbm-wbs.
create policy "abh baca" on public.bbm_wbs for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'));
create policy "abh tindak lanjut" on public.bbm_wbs for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh'));

-- Foto bukti WBS (folder <spbu>/wbs-<id>/, diunggah edge function): hanya ABH yang dapat melihat/menghapus.
alter policy "bbm evidence baca" on storage.objects
  using (bucket_id = 'bbm-evidence' and bbm_private.bbm_foto_boleh(name)
         and (split_part(name, '/', 2) not like 'wbs-%' or bbm_private.bbm_has_role('abh')));
alter policy "bbm evidence hapus" on storage.objects
  using (bucket_id = 'bbm-evidence' and bbm_private.bbm_foto_boleh(name)
         and (split_part(name, '/', 2) not like 'wbs-%' or bbm_private.bbm_has_role('abh')));

-- Bukti WBS tidak ikut cut-off foto dan tidak masuk arsip ZIP pengawas.
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
      and split_part(o.name, '/', 2) not like 'wbs-%'
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
  where o.bucket_id = 'bbm-evidence' and o.created_at < x.batas and split_part(o.name, '/', 2) not like 'wbs-%'
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;

-- 2. Guard Tour System (sampling subsidi tepat): security memotret EDC, struk, dan kendaraan (nopol terlihat)
--    minimal 1 transaksi JBT dan 1 JBKP per slot 2 jam. tanggal = tanggal operasional (06:00-05:59),
--    slot 0 = 06:00-07:59 ... slot 11 = 04:00-05:59.
--    data = {nopol, produk, liter, jam, petugas, catatan, foto: {edc[], struk[], kendaraan[]}}
create table public.bbm_gts (
  spbu_id uuid not null references public.bbm_spbu (id) on delete cascade,
  id text not null,
  tanggal date not null,
  slot smallint not null check (slot between 0 and 11),
  jenis text not null check (jenis in ('JBT', 'JBKP')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  primary key (spbu_id, id)
);
create index bbm_gts_spbu_tanggal_idx on public.bbm_gts (spbu_id, tanggal desc, slot);
create trigger bbm_gts_touch before update on public.bbm_gts for each row execute function public.bbm_touch();

alter table public.bbm_gts enable row level security;
create policy "pengawasan baca" on public.bbm_gts for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas', 'security'));
-- Sampling diisi security (ABH untuk uji/pengganti); tidak dapat diubah setelah terkirim.
create policy "security sampling" on public.bbm_gts for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'security'));
create policy "pengawas hapus" on public.bbm_gts for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'pengawas'));
