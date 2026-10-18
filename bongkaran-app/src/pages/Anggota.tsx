import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KeyRound, RefreshCw, Trash2, TriangleAlert, UserCheck, UserPlus } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { LoadError, Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import type { Member, Role } from '@/lib/backend'
import { roleLabel, ROLES } from '@/lib/roles'
import { useKeTerkirim } from '@/lib/terkirim'
import { cn } from '@/lib/utils'

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

/** Anggota SPBU aktif (dimuat ulang saat ABH berpindah SPBU). */
function useAnggota() {
  const app = useApp()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const { backend, loaded, spbuId } = app
  const load = useCallback(() => {
    if (!loaded || !spbuId) return
    backend.listMembers().then(setMembers, (e: unknown) => setLoadError(e instanceof Error ? e : new Error(String(e))))
  }, [backend, loaded, spbuId])
  useEffect(load, [load])
  return { members, loadError, load, retry: () => (setLoadError(null), load()) }
}

function KhususAbh() {
  return (
    <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
      Anggota hanya dapat dikelola ABH saat aplikasi tersambung ke Supabase.
    </GlassCard>
  )
}

/** Profil > Anggota (khusus ABH): daftar anggota, ubah peran, hapus; form akun di halaman tersendiri. */
export function Anggota() {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const { members, loadError, load, retry } = useAnggota()
  const [busy, setBusy] = useState(false)

  const run = async (task: () => Promise<void>, ok?: string) => {
    setBusy(true)
    try {
      await task()
      if (ok) toast(ok)
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal', TriangleAlert)
    } finally {
      setBusy(false)
    }
  }

  if (!app.isAdmin || app.backend.mode !== 'supabase') return <KhususAbh />
  if (loadError) return <LoadError error={loadError} onRetry={retry} />
  if (!members) return <Loading />

  return (
    <div className="flex flex-col gap-space-md">
      <div className="animate-entrance-1 grid grid-cols-1 gap-space-xs sm:grid-cols-2">
        <Link to="/anggota/baru" className={buttonVariants({ size: 'lg' })}>
          <UserPlus aria-hidden="true" />
          Buat akun baru
        </Link>
        <Link to="/anggota/daftar" className={cn(buttonVariants({ variant: 'glass', size: 'lg' }))}>
          <UserCheck aria-hidden="true" />
          Daftarkan akun yang sudah ada
        </Link>
      </div>

      <section aria-labelledby="daftar-anggota" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="daftar-anggota" title={`Anggota ${app.spbu?.nama || 'SPBU'} (${members.length})`} />
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
                ) : m.role === 'abh' ? (
                  // ABH lain dapat mengendalikan SPBU lain: peran, sandi, dan keanggotaannya hanya diatur oleh ABH itu sendiri.
                  <Pill tone="primary">{roleLabel(m.role)}</Pill>
                ) : (
                  <div className="flex items-center gap-1">
                    <PeranSelect label={`Peran ${m.email}`} value={m.role} disabled={busy} onChange={(r) => void run(() => app.backend.setMemberRole(m.user_id, r), 'Peran diperbarui')} />
                    <Button variant="ghost" size="icon" aria-label={`Atur ulang kata sandi ${m.email}`} disabled={busy} onClick={() => navigate(`/anggota/sandi/${encodeURIComponent(m.user_id)}`)}>
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
    </div>
  )
}

/** Anggota > Buat akun baru (halaman tersendiri). */
export function AnggotaBaru() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const [form, setForm] = useState({ email: '', nama: '', role: 'kashift' as Role, password: sandiAcak() })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari buat akun?', detail: 'Akun belum dibuat.' })
  if (!app.isAdmin || app.backend.mode !== 'supabase') return <KhususAbh />
  const set = (p: Partial<typeof form>) => (setError(null), setForm({ ...form, ...p }))
  const buat = async () => {
    if (!form.email.trim()) return setError('Isi email akun.')
    if (form.password.length < 8) return setError('Kata sandi minimal 8 karakter.')
    setBusy(true)
    try {
      await app.backend.createAccount(form.email.trim(), form.password, form.nama.trim(), form.role)
      guard.bypass()
      keTerkirim({
        judul: `Akun ${roleLabel(form.role)} dibuat`,
        detail: 'Akun langsung aktif. Berikan email & kata sandi sementara ini ke pemiliknya, lalu minta ganti kata sandi di menu Profil.',
        baris: [
          ['Nama', form.nama.trim() || '-'],
          ['Email', form.email.trim().toLowerCase()],
          ['Kata sandi sementara', form.password],
          ['SPBU', app.spbu?.nama || '-'],
        ],
        aksi: [
          { to: '/anggota', label: 'Kembali ke Anggota' },
          { to: '/anggota/baru', label: 'Buat akun lain' },
        ],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
      <div className="flex flex-col">
        <span className="text-tag uppercase text-primary">Buat akun baru di {app.spbu?.nama || 'SPBU ini'}</span>
        <span className="text-body-sm text-on-surface-variant">Akun langsung aktif setelah dibuat.</span>
      </div>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Nama" htmlFor="ang-nama" className="col-span-2 sm:col-span-1">
          <Input id="ang-nama" autoComplete="off" value={form.nama} onChange={(e) => set({ nama: e.target.value })} />
        </Field>
        <Field label="Peran" htmlFor="ang-role" className="col-span-2 sm:col-span-1">
          <PeranSelect id="ang-role" value={form.role} onChange={(role) => set({ role })} />
        </Field>
        <Field label="Email" htmlFor="ang-email" className="col-span-2">
          <Input id="ang-email" type="email" autoComplete="off" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Kata sandi sementara" htmlFor="ang-pass" className="col-span-2">
          <div className="grid grid-cols-[1fr_auto] gap-space-xs">
            <Input id="ang-pass" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
            <Button variant="glass" size="icon" aria-label="Buat kata sandi acak" onClick={() => set({ password: sandiAcak() })}>
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </Field>
      </div>
      <span className="text-body-sm text-on-surface-variant">{ROLES.find((r) => r.key === form.role)?.desc}</span>
      <ErrorBox text={error} />
      <Button size="lg" className="w-full" disabled={busy || !form.email.trim()} onClick={() => void buat()}>
        <UserPlus aria-hidden="true" />
        Buat akun {roleLabel(form.role)}
      </Button>
      {guard.dialog}
    </GlassCard>
  )
}

/** Anggota > Daftarkan akun yang sudah ada (halaman tersendiri). */
export function AnggotaDaftar() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const [lama, setLama] = useState({ email: '', nama: '', role: 'kashift' as Role })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari daftarkan akun?', detail: 'Akun belum didaftarkan.' })
  if (!app.isAdmin || app.backend.mode !== 'supabase') return <KhususAbh />
  const set = (p: Partial<typeof lama>) => (setError(null), setLama({ ...lama, ...p }))
  const daftar = async () => {
    setBusy(true)
    try {
      await app.backend.addMember(lama.email, lama.nama, lama.role)
      guard.bypass()
      keTerkirim({
        judul: 'Anggota didaftarkan',
        detail: `${lama.email.trim()} sekarang anggota ${app.spbu?.nama || 'SPBU ini'}.`,
        baris: [
          ['Nama', lama.nama.trim() || '-'],
          ['Peran', roleLabel(lama.role)],
        ],
        aksi: [{ to: '/anggota', label: 'Kembali ke Anggota' }],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
      <span className="text-body-sm text-on-surface-variant">Untuk akun yang sudah dibuat sebelumnya (mis. pindah dari SPBU lain yang Anda kendalikan).</span>
      <Field label="Email akun" htmlFor="ang-lama-email">
        <Input id="ang-lama-email" type="email" autoComplete="off" value={lama.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Nama" htmlFor="ang-lama-nama">
          <Input id="ang-lama-nama" value={lama.nama} onChange={(e) => set({ nama: e.target.value })} />
        </Field>
        <Field label="Peran" htmlFor="ang-lama-role">
          <PeranSelect id="ang-lama-role" value={lama.role} onChange={(role) => set({ role })} />
        </Field>
      </div>
      <ErrorBox text={error} />
      <Button size="lg" disabled={busy || !lama.email.trim()} onClick={() => void daftar()}>
        <UserCheck aria-hidden="true" />
        Daftarkan
      </Button>
      {guard.dialog}
    </GlassCard>
  )
}

/** Anggota > Atur ulang kata sandi satu anggota (halaman tersendiri). */
export function AnggotaSandi() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { userId = '' } = useParams()
  const { members, loadError, retry } = useAnggota()
  const [password, setPassword] = useState(sandiAcak)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari atur ulang kata sandi?', detail: 'Kata sandi belum diubah.' })
  if (!app.isAdmin || app.backend.mode !== 'supabase') return <KhususAbh />
  if (loadError) return <LoadError error={loadError} onRetry={retry} />
  if (!members) return <Loading />
  const m = members.find((x) => x.user_id === userId)
  if (!m) return <GlassCard className="p-space-md">Anggota tidak ditemukan.</GlassCard>
  const simpan = async () => {
    if (password.length < 8) return setError('Kata sandi minimal 8 karakter.')
    setBusy(true)
    try {
      await app.backend.resetPassword(m.user_id, password)
      guard.bypass()
      keTerkirim({
        judul: 'Kata sandi diatur ulang',
        detail: 'Berikan kata sandi baru ini ke pemilik akun, lalu minta ganti di menu Profil.',
        baris: [
          ['Akun', m.email],
          ['Kata sandi baru', password],
        ],
        aksi: [{ to: '/anggota', label: 'Kembali ke Anggota' }],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
      <div className="flex flex-col">
        <span className="text-body-md font-semibold text-on-surface">{m.nama || m.email}</span>
        <span className="text-body-sm text-on-surface-variant">
          {m.email} ({roleLabel(m.role)})
        </span>
      </div>
      <Field label="Kata sandi baru" htmlFor="ang-reset">
        <div className="grid grid-cols-[1fr_auto] gap-space-xs">
          <Input id="ang-reset" autoComplete="new-password" value={password} onChange={(e) => (setError(null), setPassword(e.target.value))} />
          <Button variant="glass" size="icon" aria-label="Buat kata sandi acak" onClick={() => setPassword(sandiAcak())}>
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </Field>
      <ErrorBox text={error} />
      <Button size="lg" disabled={busy || password.length < 8} onClick={() => void simpan()}>
        <KeyRound aria-hidden="true" />
        Simpan kata sandi baru
      </Button>
      {guard.dialog}
    </GlassCard>
  )
}
