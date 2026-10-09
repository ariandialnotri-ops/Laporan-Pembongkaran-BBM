-- Pelaporan insiden, near miss, dan kerusakan disimpan di bbm_daily dengan kind 'insiden'.
-- Semua peran (termasuk security) boleh melapor dan menambah tindak lanjut.
alter table public.bbm_daily drop constraint if exists bbm_daily_kind_check;
alter table public.bbm_daily add constraint bbm_daily_kind_check check (kind in ('stok', 'qq', 'apar', 'insiden'));

alter policy "anggota tambah" on public.bbm_daily
  with check (bbm_private.bbm_is_member() and (kind in ('apar', 'insiden') or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')));
alter policy "anggota ubah" on public.bbm_daily
  using (bbm_private.bbm_is_member() and (kind in ('apar', 'insiden') or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')))
  with check (bbm_private.bbm_is_member() and (kind in ('apar', 'insiden') or bbm_private.bbm_has_role('abh', 'pengawas', 'kashift')));
