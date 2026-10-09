-- Pengawas (dan ABH) mengubah sebagian pengaturan saja: data utama APAR/APAB & area,
-- serta Sold To / Ship To. Kunci lain dalam patch diabaikan.
create or replace function public.bbm_save_settings_terbatas(p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_patch jsonb;
begin
  if not bbm_private.bbm_has_role('abh', 'pengawas') then
    raise exception 'Hanya ABH atau pengawas yang dapat mengubah data ini';
  end if;
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Data tidak valid';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
  from jsonb_each(p_patch)
  where key in ('apar', 'apab', 'aparArea', 'soldTo', 'shipTo');
  insert into public.bbm_settings (id, value) values ('default', v_patch)
  on conflict (id) do update set value = public.bbm_settings.value || v_patch;
end;
$$;

revoke execute on function public.bbm_save_settings_terbatas(jsonb) from public, anon;
grant execute on function public.bbm_save_settings_terbatas(jsonb) to authenticated;
