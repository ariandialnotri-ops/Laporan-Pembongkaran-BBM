import { useCallback, useEffect, useState } from 'react'
import { Trash2, TriangleAlert, UserPlus } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { LoadError, Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import type { Member, Role } from '@/lib/backend'

export function Anggota() {
  const app = useApp()
  const toast = useToast()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [form, setForm] = useState({ email: '', nama: '', role: 'petugas' as Role })
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
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal', TriangleAlert)
    } finally {
      setBusy(false)
    }
  }

  if (!app.canManage || app.backend.mode !== 'supabase') {
    return (
      <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
        Anggota hanya dapat dikelola pengawas saat aplikasi tersambung ke Supabase.
      </GlassCard>
    )
  }
  if (loadError) return <LoadError error={loadError} onRetry={() => (setLoadError(null), load())} />
  if (!members) return <Loading />

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <span className="text-body-sm text-on-surface-variant">
          Buat akun dulu di dashboard Supabase → Authentication → Users → Add user (centang Auto Confirm User), lalu daftarkan emailnya di sini.
        </span>
        <Field label="Email akun" htmlFor="ang-email">
          <Input id="ang-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Nama" htmlFor="ang-nama">
            <Input id="ang-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </Field>
          <Field label="Peran" htmlFor="ang-role">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger id="ang-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="petugas">Petugas</SelectItem>
                <SelectItem value="pengawas">Pengawas</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled={busy || !form.email.trim()}
          onClick={() =>
            run(async () => {
              await app.backend.addMember(form.email, form.nama, form.role)
              setForm({ email: '', nama: '', role: 'petugas' })
            }, 'Anggota ditambahkan')
          }
        >
          <UserPlus aria-hidden="true" />
          Tambah anggota
        </Button>
      </GlassCard>

      <section aria-labelledby="daftar-anggota" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="daftar-anggota" title={`Anggota (${members.length})`} />
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          {members.map((m) => {
            const me = m.user_id === app.session.user?.id
            return (
              <div key={m.user_id} className="flex min-h-14 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-md font-semibold text-on-surface">{m.nama || m.email}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">{m.email}</span>
                </div>
                {me ? (
                  <Pill tone="primary">{m.role} · Anda</Pill>
                ) : (
                  <>
                    <Select value={m.role} disabled={busy} onValueChange={(v) => run(() => app.backend.setMemberRole(m.user_id, v as Role), 'Peran diperbarui')}>
                      <SelectTrigger aria-label={`Peran ${m.email}`} className="h-11 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petugas">Petugas</SelectItem>
                        <SelectItem value="pengawas">Pengawas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${m.email}`}
                      disabled={busy}
                      onClick={() => window.confirm(`Hapus ${m.email} dari anggota?`) && void run(() => app.backend.removeMember(m.user_id), 'Anggota dihapus')}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </GlassCard>
      </section>
    </div>
  )
}
