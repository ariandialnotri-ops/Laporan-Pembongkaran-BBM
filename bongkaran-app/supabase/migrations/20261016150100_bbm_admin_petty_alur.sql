-- Alur petty cash dua tahap: pengajuan (kepala shift / pengawas / admin) -> persetujuan 1 Admin/Cashier ->
-- persetujuan akhir ABH. Pengajuan admin langsung ke ABH (tidak menyetujui pengajuannya sendiri); pengajuan ABH
-- langsung disetujui.

-- 2. Petty cash: status 'Menunggu Admin' menggantikan 'Menunggu Pengawas'; tanpa batas nominal (akhir selalu ABH).
alter table public.bbm_petty drop constraint if exists bbm_petty_status_check;
update public.bbm_petty set status = 'Menunggu Admin' where status = 'Menunggu Pengawas';
alter table public.bbm_petty add constraint bbm_petty_status_check check (status in ('Menunggu Admin', 'Menunggu ABH', 'Disetujui', 'Ditolak'));

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
    new.created_by := auth.uid();
    new.data := new.data - 'review' - 'keputusan' - 'realisasi';
    new.status := case when v_abh then 'Disetujui' when v_admin then 'Menunggu ABH' else 'Menunggu Admin' end;
    return new;
  end if;
  -- Isi pengajuan hanya dapat diubah ABH, atau pengaju selagi menunggu admin.
  if (new.data - 'review' - 'keputusan' - 'realisasi') is distinct from (old.data - 'review' - 'keputusan' - 'realisasi')
     or new.total <> old.total or new.tanggal <> old.tanggal or new.no <> old.no then
    if not (v_abh or (old.status = 'Menunggu Admin' and old.created_by = auth.uid())) then
      raise exception 'Pengajuan yang sudah diperiksa tidak dapat diubah';
    end if;
  end if;
  -- Persetujuan 1 (review) dari admin/ABH; keputusan akhir hanya ABH.
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
  if (new.data -> 'realisasi') is distinct from (old.data -> 'realisasi') and new.status <> 'Disetujui' then
    raise exception 'Realisasi hanya untuk pengajuan yang disetujui';
  end if;
  return new;
end;
$$;
drop function if exists bbm_private.bbm_petty_batas(uuid);

drop policy "finance baca" on public.bbm_petty;
drop policy "finance ajukan" on public.bbm_petty;
drop policy "finance ubah" on public.bbm_petty;
drop policy "finance hapus" on public.bbm_petty;
create policy "finance baca" on public.bbm_petty for select to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift'));
create policy "finance ajukan" on public.bbm_petty for insert to authenticated
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift'));
create policy "finance ubah" on public.bbm_petty for update to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift'))
  with check (spbu_id in (select bbm_private.bbm_spbu_saya()) and bbm_private.bbm_has_role('abh', 'admin', 'pengawas', 'kashift'));
create policy "finance hapus" on public.bbm_petty for delete to authenticated
  using (spbu_id in (select bbm_private.bbm_spbu_saya())
         and (bbm_private.bbm_has_role('abh') or (status = 'Menunggu Admin' and created_by = auth.uid())));
