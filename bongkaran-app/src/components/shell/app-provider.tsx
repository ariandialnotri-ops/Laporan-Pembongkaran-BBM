import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppContext, type AppState, type SessionStatus } from '@/lib/app-state'
import { backend, type SessionInfo } from '@/lib/backend'
import { DEFAULT_RULES, effectiveRules, type Plan, type ReportSummary, type Settings } from '@/lib/sop'
import { TANK_SPBU } from '@/lib/tank'

const DEFAULT_SETTINGS: Settings = {
  namaSpbu: TANK_SPBU,
  kodeSpbu: '',
  alamatSpbu: '',
  logoDataUrl: '',
  namaPetugasDefault: '',
  namaPengawasDefault: '',
  pinPenanggungJawab: '',
  rules: DEFAULT_RULES,
}

const NO_SESSION: SessionInfo = { user: null, role: null, nama: null }

function upsertById<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]
}

function initialsOf(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [statusMessage, setStatusMessage] = useState('')
  const [session, setSession] = useState<SessionInfo>(NO_SESSION)
  const [loaded, setLoaded] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [plans, setPlans] = useState<Plan[]>([])
  const [reports, setReports] = useState<ReportSummary[]>([])
  const settingsDirty = useRef(false)

  const initSession = useCallback(
    () =>
      backend.getSession().then(
        (s) => {
          setSession(s)
          setStatus(backend.mode === 'supabase' && !s.user ? 'login' : !s.role ? 'nomember' : 'ready')
        },
        (e: unknown) => {
          setStatusMessage(`Gagal terhubung ke server: ${e instanceof Error ? e.message : String(e)}`)
          setStatus('error')
        },
      ),
    [],
  )

  // Sesi awal dimuat sekali; login/logout berikutnya datang lewat onAuthChange.
  useEffect(() => {
    void initSession()
    return backend.onAuthChange(() => void initSession())
  }, [initSession])

  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([backend.listPlans(), backend.listReports()])
    setPlans(p)
    setReports(r.sort((a, b) => b.createdAt - a.createdAt))
  }, [])

  const userId = session.user?.id ?? null
  useEffect(() => {
    if (status !== 'ready') return
    let alive = true
    ;(async () => {
      try {
        const s = await backend.getSettings()
        if (alive && s) setSettings({ ...DEFAULT_SETTINGS, ...s, rules: { ...DEFAULT_RULES, ...(s.rules ?? {}) } })
        await refresh()
      } catch (e) {
        setStatusMessage(`Gagal memuat data: ${e instanceof Error ? e.message : String(e)}`)
      }
      if (alive) setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [status, userId, refresh])

  // Data dari perangkat lain: muat ulang saat aplikasi kembali dibuka.
  useEffect(() => {
    if (backend.mode !== 'supabase' || !loaded) return
    const onFocus = () => void refresh().catch(() => {})
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loaded, refresh])

  // Pengaturan disimpan dengan jeda agar tidak setiap ketikan.
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    settingsDirty.current = true
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])
  useEffect(() => {
    if (!settingsDirty.current) return
    const t = setTimeout(() => {
      settingsDirty.current = false
      backend.saveSettings(settings).catch((e: Error) => setStatusMessage(`Gagal menyimpan pengaturan: ${e.message}`))
    }, 700)
    return () => clearTimeout(t)
  }, [settings])

  const savePlan = useCallback(
    async (plan: Plan) => {
      setPlans((prev) => upsertById(prev, plan))
      try {
        await backend.savePlan(plan)
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    },
    [refresh],
  )
  const deletePlan = useCallback(
    async (plan: Plan) => {
      setPlans((prev) => prev.filter((p) => p.id !== plan.id))
      try {
        await backend.deletePlan(plan.id)
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    },
    [refresh],
  )

  const upsertSummary = useCallback((summary: ReportSummary) => setReports((prev) => upsertById(prev, summary)), [])
  const removeSummary = useCallback((id: string) => setReports((prev) => prev.filter((r) => r.id !== id)), [])

  const signIn = useCallback((email: string, password: string) => backend.signIn(email, password), [])
  const signOut = useCallback(async () => {
    await backend.signOut()
    setLoaded(false)
    setPlans([])
    setReports([])
  }, [])

  const value = useMemo<AppState>(() => {
    const canManage = backend.mode === 'local' || session.role === 'pengawas'
    const displayName = session.nama || session.user?.email || 'Mode lokal'
    const usedLoIds = new Map<string, ReportSummary>()
    reports.forEach((r) => r.loIds?.forEach((id) => usedLoIds.set(id, r)))
    return {
      backend,
      status,
      statusMessage,
      session,
      canManage,
      displayName,
      initials: initialsOf(displayName),
      loaded,
      settings,
      rules: effectiveRules(settings.rules),
      updateSettings,
      plans,
      savePlan,
      deletePlan,
      reports,
      upsertSummary,
      removeSummary,
      usedLoIds,
      refresh,
      retrySession: () => void initSession(),
      signIn,
      signOut,
      canDeleteReport: (r) => canManage || (r.status === 'draft' && !!userId && r.createdBy === userId),
    }
  }, [status, statusMessage, session, loaded, settings, updateSettings, plans, savePlan, deletePlan, reports, upsertSummary, removeSummary, refresh, initSession, signIn, signOut, userId])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
