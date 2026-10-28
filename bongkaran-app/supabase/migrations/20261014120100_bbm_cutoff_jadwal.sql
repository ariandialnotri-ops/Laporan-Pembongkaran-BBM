-- Jadwal cut-off foto: tanggal 5 pukul 01.00 WIB (= tanggal 4 pukul 18.00 UTC) memanggil
-- edge function bbm-cutoff. Kunci pemanggil dibuat acak di Vault; nilainya tidak pernah keluar dari database.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'bbm_cutoff_key') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'bbm_cutoff_key',
      'Kunci pemanggil edge function bbm-cutoff dari pg_cron'
    );
  end if;
end;
$$;

select cron.schedule(
  'bbm-cutoff-foto',
  '0 18 4 * *',
  $cron$
  select net.http_post(
    url := 'https://tpkxekmcrzavcyazkuzn.supabase.co/functions/v1/bbm-cutoff',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cutoff-key', (select decrypted_secret from vault.decrypted_secrets where name = 'bbm_cutoff_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
