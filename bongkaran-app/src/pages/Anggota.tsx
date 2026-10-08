import { useCallback, useEffect, useState } from 'react'
import { KeyRound, RefreshCw, Trash2, TriangleAlert, UserPlus } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { LoadError, Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import type { Member, Role } from '@/lib/backend'
import { roleLabel, ROLES } from '@/lib/roles'

/** Kata sandi sementara: 10 karakter tanpa huruf/angka yang mirip (O/0, l/1). */
function sandiAcak() {
  const huruf = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const buf = new Uint32Array(10)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => huruf[n % huruf.length]).join('')
}

function PeranSelect({ id, value, onChange, disabled, label }: { id?: string; value: Role; onChange: (r: Role) => void; disabled?: boolean; label?: string }) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger id={id} aria-label={label} className={label ? 'h-11 w-36' : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.key} value={r.key}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Profil > Anggota (khusus ABH): buat akun login per peran, ubah peran, atur ulang kata sandi. */
export function Anggota() {
  const app = useApp()
  const toast = useToast()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [form, setForm] = useState({ email: '', nama: '', role: 'kashift' as Role, password: sandiAcak() })
  const [lama, setLama] = useState({ email: '', nama: '', role: 'kashift' as Role })
  const [dibuat, setDibuat] = useState<{ email: string; password: string; role: Role } | null>(null)
  const [reset, setReset] = useState<{ m: Member; password: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    app.backend.listMembers().then(setMembers, (e: unknown) => setLoadError(e instanceof Error ? e : new Error(String(e))))
  }, [app.backend])
  useEffect(load, [load])

  const run = async (task: () => Promise<void>, ok?: string) => {
    setBusy(true)
    try {
      await task()
      if (ok) toast(ok)
      load()
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal', TriangleAlert)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!app.isAdmin || app.backend.mode !== 'supabase') {
    return (
      <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
        Anggota hanya dapat dikelola ABH saat aplikasi tersambung ke Supabase.
      </GlassCard>
    )
  }
  if (loadError) return <LoadError error={loadError} onRetry={() => (setLoadError(null), load())} />
  if (!members) return <Loading />

  const buat = () =>
    run(async () => {
      if (!form.email.trim()) throw new Error('Isi email akun.')
      if (form.password.length < 8) throw new Error('Kata sandi minimal 8 karakter.')
      await app.backend.createAccount(form.email.trim(), form.password, form.nama.trim(), form.role)
      setDibuat({ email: form.email.trim().toLowerCase(), password: form.password, role: form.role })
      setForm({ email: '', nama: '', role: form.role, password: sandiAcak() })
    }, 'Akun dibuat')

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex flex-col">
          <span className="text-tag uppercase text-primary">Buat akun baru</span>
          <span className="text-body-sm text-on-surface-variant">Akun langsung aktif. Berikan email & kata sandi sementara ke pemiliknya, lalu minta ganti kata sandi di menu Profil.</span>
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Nama" htmlFor="ang-nama" className="col-span-2 sm:col-span-1">
            <Input id="ang-nama" autoComplete="off" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </Field>
          <Field label="Peran" htmlFor="ang-role" className="col-span-2 sm:col-span-1">
            <PeranSelect id="ang-role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
          </Field>
          <Field label="Email" htmlFor="ang-email" className="col-span-2">
            <Input id="ang-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Kata sandi sementara" htmlFor="ang-pass" className="col-span-2">
            <div className="grid grid-cols-[1fr_auto] gap-space-xs">
              <Input id="ang-pass" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Button variant="glass" size="icon" aria-label="Buat kata sandi acak" onClick={() => setForm({ ...form, password: sandiAcak() })}>
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
          </Field>
        </div>
        <span className="text-body-sm text-on-surface-variant">{ROLES.find((r) => r.key === form.role)?.desc}</span>
        <Button size="lg" className="w-full" disabled={busy || !form.email.trim()} onClick={buat}>
          <UserPlus aria-hidden="true" />
          Buat akun {roleLabel(form.role)}
        </Button>
        {dibuat && (
          <div role="status" className="flex flex-col gap-0.5 rounded-md bg-emerald-50 p-space-sm text-body-sm text-on-surface">
            <span className="font-semibold">Akun {roleLabel(dibuat.role)} siap dipakai</span>
            <span className="tabular">Email: {dibuat.email}</span>
            <span className="tabular">Kata sandi: {dibuat.password}</span>
          </div>
        )}
      </GlassCard>

      <section aria-labelledby="daftar-anggota" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="daftar-anggota" title={`Anggota (${members.length})`} />
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 p-space-2xs">
          {members.map((m) => {
            const me = m.user_id === app.session.user?.id
            return (
              <div key={m.user_id} className="flex flex-wrap items-center gap-space-sm px-space-sm py-space-xs">
                <div className="flex min-w-0 flex-1 basis-40 flex-col">
                  <span className="truncate text-body-md font-semibold text-on-surface">{m.nama || m.email}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">{m.email}</span>
                </div>
                {me ? (
                  <Pill tone="primary">{roleLabel(m.role)} · Anda</Pill>
                ) : (
                  <div className="flex items-center gap-1">
                    <PeranSelect label={`Peran ${m.email}`} value={m.role} disabled={busy} onChange={(r) => void run(() => app.backend.setMemberRole(m.user_id, r), 'Peran diperbarui')} />
                    <Button variant="ghost" size="icon" aria-label={`Atur ulang kata sandi ${m.email}`} disabled={busy} onClick={() => setReset({ m, password: sandiAcak() })}>
                      <KeyRound aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${m.email}`}
                      disabled={busy}
                      onClick={() => window.confirm(`Hapus ${m.email} dari anggota? Akunnya tidak dapat membuka data SPBU lagi.`) && void run(() => app.backend.removeMember(m.user_id), 'Anggota dihapus')}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </GlassCard>
      </section>

      <section aria-labelledby="hak-akses" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="hak-akses" title="Hak akses per peran" />
        <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
          {ROLES.map((r) => (
            <div key={r.key} className="flex flex-col px-space-sm py-space-xs text-body-sm">
              <span className="font-semibold text-on-surface">{r.label}</span>
              <span className="text-on-surface-variant">{r.desc}</span>
            </div>
          ))}
        </GlassCard>
      </section>

      <details className="animate-entrance-3 rounded-lg bg-surface-container-low/60 p-space-sm">
        <summary className="touch-44 cursor-pointer text-body-sm font-semibold text-on-surface">Daftarkan akun yang sudah ada</summary>
        <div className="mt-space-sm flex flex-col gap-space-sm">
          <Field label="Email akun" htmlFor="ang-lama-email">
            <Input id="ang-lama-email" type="email" autoComplete="off" value={lama.email} onChange={(e) => setLama({ ...lama, email: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Nama" htmlFor="ang-lama-nama">
              <Input id="ang-lama-nama" value={lama.nama} onChange={(e) => setLama({ ...lama, nama: e.target.value })} />
            </Field>
            <Field label="Peran" htmlFor="ang-lama-role">
              <PeranSelect id="ang-lama-role" value={lama.role} onChange={(role) => setLama({ ...lama, role })} />
            </Field>
          </div>
          <Button
            variant="soft"
            disabled={busy || !lama.email.trim()}
            onClick={() =>
              void run(async () => {
                await app.backend.addMember(lama.email, lama.nama, lama.role)
                setLama({ email: '', nama: '', role: 'kashift' })
              }, 'Anggota ditambahkan')
            }
          >
            Daftarkan
          </Button>
        </div>
      </details>

      <Sheet open={!!reset} onOpenChange={(o) => !o && setReset(null)} title="Atur ulang kata sandi" description={reset ? `${reset.m.nama || reset.m.email} (${roleLabel(reset.m.role)})` : undefined}>
        {reset && (
          <>
            <Field label="Kata sandi baru" htmlFor="ang-reset">
              <div className="grid grid-cols-[1fr_auto] gap-space-xs">
                <Input id="ang-reset" autoComplete="new-password" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
                <Button variant="glass" size="icon" aria-label="Buat kata sandi acak" onClick={() => setReset({ ...reset, password: sandiAcak() })}>
                  <RefreshCw aria-hidden="true" />
                </Button>
              </div>
            </Field>
            <Button
              size="lg"
              disabled={busy || reset.password.length < 8}
              onClick={async () => {
                const ok = await run(() => app.backend.resetPassword(reset.m.user_id, reset.password), `Kata sandi ${reset.m.email}: ${reset.password}`)
                if (ok) setReset(null)
              }}
            >
              <KeyRound aria-hidden="true" />
              Simpan kata sandi baru
            </Button>
          </>
        )}
      </Sheet>
    </div>
  )
}
