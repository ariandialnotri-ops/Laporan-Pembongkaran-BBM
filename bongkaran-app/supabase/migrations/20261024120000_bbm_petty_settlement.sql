-- Pengajuan Anggaran (petty cash): Create Settlement oleh pengaju setelah pengajuan disetujui, berisi
-- foto struk pembelian dan foto barang yang dibeli (data.settlement), sebelum realisasi Admin/Cashier.
-- Hanya mengganti fungsi trigger bbm_petty_alur (create or replace); tabel & policy tidak berubah.
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
    new.data := (new.data - 'review' - 'keputusan' - 'realisasi' - 'settlement' - 'peran') || jsonb_build_object('peran', bbm_private.bbm_my_role());
    new.status := case when v_admin then 'Menunggu ABH' else 'Menunggu Admin' end;
    return new;
  end if;
  -- Peran pengaju tidak dapat diubah.
  new.data := (new.data - 'peran') || jsonb_strip_nulls(jsonb_build_object('peran', old.data -> 'peran'));
  if (new.data - 'review' - 'keputusan' - 'realisasi' - 'settlement') is distinct from (old.data - 'review' - 'keputusan' - 'realisasi' - 'settlement')
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
  -- Create Settlement: pengaju (atau Admin/Cashier/ABH) melampirkan struk & foto barang setelah disetujui,
  -- sebelum direalisasi Admin/Cashier.
  if (new.data -> 'settlement') is distinct from (old.data -> 'settlement') then
    if new.status <> 'Disetujui' then
      raise exception 'Settlement hanya untuk pengajuan yang disetujui';
    end if;
    if old.data ? 'realisasi' and not (v_admin or v_abh) then
      raise exception 'Pengajuan sudah direalisasi; settlement tidak dapat diubah';
    end if;
    if not (v_admin or v_abh or old.created_by = auth.uid()) then
      raise exception 'Settlement dibuat oleh pengaju';
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
