-- Inspeksi APAR & APAB disimpan di bbm_daily dengan kind 'apar'
-- (data: petugas, jam, units[] berisi checklist per unit, catatan, selesaiAt).
-- Daftar unit APAR/APAB dan jumlah pulau ada di bbm_settings.value (jsonb), tanpa kolom baru.
alter table public.bbm_daily drop constraint if exists bbm_daily_kind_check;
alter table public.bbm_daily add constraint bbm_daily_kind_check check (kind in ('stok', 'qq', 'apar'));
