-- Pengawas & ABH boleh mengubah data utama APAR/APAB (unit & area) tanpa akses tulis
-- ke pengaturan SPBU lain: hanya kunci apar, apab, dan aparArea yang diganti.
create or replace function public.bbm_save_apar(p_apar jsonb, p_apab jsonb, p_area jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not bbm_private.bbm_has_role('abh', 'pengawas') then
    raise exception 'Hanya ABH atau pengawas yang dapat mengubah data utama APAR/APAB';
  end if;
  if jsonb_typeof(p_apar) <> 'array' or jsonb_typeof(p_apab) <> 'array' or jsonb_typeof(p_area) <> 'array' then
    raise exception 'Data APAR/APAB tidak valid';
  end if;
  insert into public.bbm_settings (id, value)
  values ('default', jsonb_build_object('apar', p_apar, 'apab', p_apab, 'aparArea', p_area))
  on conflict (id) do update
    set value = public.bbm_settings.value || jsonb_build_object('apar', p_apar, 'apab', p_apab, 'aparArea', p_area);
end;
$$;

revoke execute on function public.bbm_save_apar(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.bbm_save_apar(jsonb, jsonb, jsonb) to authenticated;
