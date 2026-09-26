-- Bongkaran BBM & Q&Q — skema awal.
-- Satu baris `bongkaran` memuat ketiga tahap form (Bongkaran, Quality,
-- Quantity); kolom Q&Q terisi saat tahap berikutnya disimpan.

create table if not exists public.bongkaran (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  spbu text not null,
  waktu_bongkar timestamptz not null,
  no_polisi text not null,
  produk text not null,
  volume_do numeric(12, 2) not null check (volume_do > 0),
  volume_realisasi numeric(12, 2) not null check (volume_realisasi >= 0),
  catatan text,
  foto_do_path text,
  -- Quality
  suhu_observasi numeric(5, 2),
  density_observasi numeric(7, 2),
  density_koreksi numeric(7, 2),
  pengawas text,
  -- Quantity
  tera_bejana numeric(8, 3),
  meter_awal numeric(14, 3),
  meter_akhir numeric(14, 3),
  foto_tera_path text,
  -- Ringkasan
  tahap text not null default 'bongkaran' check (tahap in ('bongkaran', 'quality', 'selesai')),
  qq_status text not null default 'belum' check (qq_status in ('sesuai', 'perhatian', 'belum')),
  qq_catatan text
);

create index if not exists bongkaran_waktu_idx on public.bongkaran (waktu_bongkar desc);

create table if not exists public.laporan (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  judul text not null,
  jenis text not null check (jenis in ('berita_acara', 'harian')),
  spbu text not null,
  status text not null default 'draft' check (status in ('terkirim', 'menunggu', 'draft')),
  bongkaran_id uuid references public.bongkaran (id) on delete set null
);

create index if not exists laporan_created_idx on public.laporan (created_at desc);
create index if not exists laporan_bongkaran_idx on public.laporan (bongkaran_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bongkaran_updated_at on public.bongkaran;
create trigger bongkaran_updated_at
  before update on public.bongkaran
  for each row execute function public.set_updated_at();

-- Akses: aplikasi belum punya login, jadi peran anon boleh membaca, menambah,
-- dan memperbarui. Tidak ada kebijakan DELETE. Ganti ke `authenticated`
-- begitu Supabase Auth dipasang.
alter table public.bongkaran enable row level security;
alter table public.laporan enable row level security;

create policy "bongkaran baca" on public.bongkaran for select to anon, authenticated using (true);
create policy "bongkaran tambah" on public.bongkaran for insert to anon, authenticated with check (true);
create policy "bongkaran ubah" on public.bongkaran for update to anon, authenticated using (true) with check (true);

create policy "laporan baca" on public.laporan for select to anon, authenticated using (true);
create policy "laporan tambah" on public.laporan for insert to anon, authenticated with check (true);
create policy "laporan ubah" on public.laporan for update to anon, authenticated using (true) with check (true);

-- Foto segel/DO dan hasil tera. Bucket privat; unggah boleh, baca lewat URL bertanda tangan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bukti-bongkaran', 'bukti-bongkaran', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "bukti unggah" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'bukti-bongkaran');
create policy "bukti baca" on storage.objects for select to anon, authenticated
  using (bucket_id = 'bukti-bongkaran');
