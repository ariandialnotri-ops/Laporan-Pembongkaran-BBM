-- Pengawas boleh menambah & mengubah data dispenser (termasuk pulau pompa tempat dispenser dipasang)
-- dan nozzle & tera metrologi, selain identitas SPBU, data utama APAR/APAB, Sold To & Ship To.
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
     or (p_patch ? 'nozzles' and jsonb_typeof(p_patch -> 'nozzles') <> 'array') then
    raise exception 'Data dispenser/nozzle tidak valid';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('namaSpbu', 'kodeSpbu', 'alamatSpbu', 'jumlahPulau', 'jumlahDispenser', 'dispensers', 'nozzles',
                'apar', 'apab', 'aparArea', 'soldTo', 'shipTo', 'fasilitas');
  insert into public.bbm_settings (id, spbu_id, value) values (p_spbu::text, p_spbu, v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;
