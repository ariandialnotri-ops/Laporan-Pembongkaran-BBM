import { useState, type FormEvent, type ReactNode } from 'react'
import { Fuel, LoaderCircle, LogOut, RotateCw, TriangleAlert } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { AmbientOrbs } from '@/components/shell/ambient-orbs'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/app-state'

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-margin py-space-xl">
      <AmbientOrbs />
      <div className="flex w-full max-w-sm flex-col gap-space-md">
        <div className="animate-entrance-1 flex flex-col items-center gap-space-sm text-center">
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-lg bg-primary text-on-primary shadow-[0_8px_24px_rgba(0,102,255,0.28)]">
            <Fuel className="size-7" />
          </span>
          <div className="flex flex-col">
            <span className="text-headline-lg font-bold text-on-surface">Bongkaran BBM</span>
            <span className="text-tag uppercase text-primary">Quality & Quantity SPBU</span>
          </div>
        </div>
        {children}
      </div>
    </main>
  )
}

export function Login() {
  const app = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await app.signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk')
      setBusy(false)
    }
  }

  return (
    <Shell>
      <GlassCard level={2} className="animate-entrance-2 p-space-md">
        <form onSubmit={submit} className="flex flex-col gap-space-md">
          <Field label="Email" htmlFor="login-email">
            <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="login-pass">
            <Input id="login-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && (
            <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
              <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Masuk
          </Button>
        </form>
      </GlassCard>
      <p className="animate-entrance-3 text-center text-body-sm text-on-surface-variant">Akun dibuat oleh pengawas SPBU. Hubungi pengawas bila belum punya akun.</p>
    </Shell>
  )
}

export function NotMember() {
  const app = useApp()
  return (
    <Shell>
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md text-center">
        <span className="text-body-md text-on-surface">
          Akun <b>{app.session.user?.email}</b> belum terdaftar sebagai anggota SPBU. Minta pengawas menambahkan email ini di <b>Profil → Anggota SPBU</b>.
        </span>
        <Button variant="glass" size="lg" onClick={() => void app.signOut()}>
          <LogOut aria-hidden="true" />
          Keluar
        </Button>
      </GlassCard>
    </Shell>
  )
}

export function SessionState() {
  const app = useApp()
  return (
    <Shell>
      {app.status === 'error' ? (
        <GlassCard level={2} className="flex flex-col items-center gap-space-sm bg-error-container/60 p-space-lg text-center">
          <TriangleAlert aria-hidden="true" className="size-6 text-error" />
          <span className="text-body-sm font-semibold text-on-error-container">{app.statusMessage}</span>
          <Button variant="glass" size="pill" onClick={app.retrySession}>
            <RotateCw aria-hidden="true" />
            Coba lagi
          </Button>
        </GlassCard>
      ) : (
        <GlassCard level={1} role="status" className="flex items-center justify-center gap-space-sm p-space-lg text-body-sm text-on-surface-variant">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
          Memuat…
        </GlassCard>
      )}
    </Shell>
  )
}
