import { useState, type FormEvent, type ReactNode } from 'react'
import { LoaderCircle, LogOut, RotateCw, TriangleAlert } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { AmbientOrbs } from '@/components/shell/ambient-orbs'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/app-state'

/** Gelombang biru di bawah layar, mengikuti splash screen brand FLOQ. */
function Waves() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 200" preserveAspectRatio="none" className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[34vh] w-full">
      <defs>
        <linearGradient id="floq-wave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a8cff" />
          <stop offset="1" stopColor="#007aff" />
        </linearGradient>
      </defs>
      <path d="M0 70 C80 30 150 110 240 80 S360 40 400 60 V200 H0 Z" fill="url(#floq-wave)" opacity="0.14" />
      <path d="M0 110 C90 70 170 150 260 115 S370 85 400 100 V200 H0 Z" fill="url(#floq-wave)" opacity="0.2" />
      <path d="M0 150 C100 115 190 185 290 150 S380 130 400 140 V200 H0 Z" fill="url(#floq-wave)" opacity="0.28" />
    </svg>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-margin py-space-xl">
      <AmbientOrbs />
      <Waves />
      <div className="flex w-full max-w-sm flex-col gap-space-lg">
        <h1 className="animate-entrance-1 flex justify-center">
          <img src="/floq-login.webp" alt="FLOQ — Fuel Logistic Quality & Quantity" width={672} height={428} className="h-auto w-60" />
        </h1>
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
      <p className="animate-entrance-3 text-center text-body-sm text-on-surface-variant">&copy; {new Date().getFullYear()} FLOQ · Created by Ariandi Alnotri</p>
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
