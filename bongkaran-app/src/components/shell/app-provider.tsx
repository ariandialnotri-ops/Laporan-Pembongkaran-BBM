import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppContext, type AppState, type SessionStatus } from '@/lib/app-state'
import { backend, type SessionInfo } from '@/lib/backend'
import type { DailyRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { DEFAULT_RULES, effectiveRules, type Plan, type ReportSummary, type Settings } from '@/lib/sop'
import { TANK_SPBU } from '@/lib/tank'
import { DEFAULT_AREAS } from '@/lib/apar'

const DEFAULT_SETTINGS: Settings = {
  namaSpbu: TANK_SPBU,
  kodeSpbu: '',
  alamatSpbu: '',
  logoDataUrl: '',
  namaPetugasDefault: '',
  namaPengawasDefault: '',
  pinPenanggungJawab: '',
  namaAbhDefault: '',
  namaSecurityDefault: '',
  perusahaanPengangkut: 'PERTAMINA PATRA NIAGA',
  nozzles: [],
  jumlahPulau: 0,
  aparArea: DEFAULT_AREAS,
  apar: [],
  apab: [],
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
  const [daily, setDaily] = useState<DailyRecord[]>([])
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

  // Penulisan yang sedang berjalan / nomor urut penulisan: sinkron otomatis tidak boleh
  // menimpa perubahan lokal dengan data server yang diambil sebelum perubahan itu tersimpan.
  const inflight = useRef(0)
  const writeSeq = useRef(0)
  const tulis = useCallback(async <T,>(job: () => Promise<T>) => {
    inflight.current++
    writeSeq.current++
    try {
      return await job()
    } finally {
      inflight.current--
      writeSeq.current++
    }
  }, [])
  const ambil = () => Promise.all([backend.listPlans(), backend.listReports(), backend.listDaily(todayIso(addDays(new Date(), -120)))])
  const terapkan = ([p, r, d]: Awaited<ReturnType<typeof ambil>>) => {
    setPlans(p)
    setReports(r.sort((a, b) => b.createdAt - a.createdAt))
    setDaily(d)
  }
  const refresh = useCallback(async () => {
    terapkan(await ambil())
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Data dari perangkat lain (akun sama, HP/PC berbeda): muat ulang saat aplikasi
  // kembali tampil, saat online lagi, saat halaman plan/LO dibuka, dan tiap 60 detik
  // selama aplikasi terlihat. Jeda minimal 10 detik agar hemat kuota & baterai.
  const lastSync = useRef(0)
  const sync = useCallback(() => {
    if (backend.mode !== 'supabase' || inflight.current > 0 || Date.now() - lastSync.current < 10_000) return
    lastSync.current = Date.now()
    const seq = writeSeq.current
    ambil()
      .then((hasil) => {
        // Ada penulisan selama pengambilan: lewati, sinkron berikutnya membawa data terbaru.
        if (writeSeq.current === seq && inflight.current === 0) terapkan(hasil)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (backend.mode !== 'supabase' || !loaded) return
    lastSync.current = Date.now()
    const onShow = () => document.visibilityState === 'visible' && sync()
    window.addEventListener('focus', onShow)
    window.addEventListener('online', onShow)
    document.addEventListener('visibilitychange', onShow)
    const t = setInterval(onShow, 60_000)
    return () => {
      window.removeEventListener('focus', onShow)
      window.removeEventListener('online', onShow)
      document.removeEventListener('visibilitychange', onShow)
      clearInterval(t)
    }
  }, [loaded, sync])

  // Pengaturan disimpan dengan jeda agar tidak setiap ketikan.
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    settingsDirty.current = true
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])
  useEffect(() => {
    if (!settingsDirty.current) return
    const flush = () => {
      if (!settingsDirty.current) return
      settingsDirty.current = false
      backend.saveSettings(settings).catch((e: Error) => setStatusMessage(`Gagal menyimpan pengaturan: ${e.message}`))
    }
    const t = setTimeout(flush, 700)
    // Muat ulang/tutup tab sebelum jeda habis: simpan saat itu juga.
    const onHide = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [settings])

  const savePlan = useCallback(
    async (plan: Plan) => {
      setPlans((prev) => upsertById(prev, plan))
      try {
        await tulis(() => backend.savePlan(plan))
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    },
    [refresh, tulis],
  )
  const deletePlan = useCallback(
    async (plan: Plan) => {
      setPlans((prev) => prev.filter((p) => p.id !== plan.id))
      try {
        await tulis(() => backend.deletePlan(plan.id))
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    },
    [refresh, tulis],
  )

  const saveDaily = useCallback(
    async (rec: DailyRecord) => {
      setDaily((prev) => upsertById(prev, rec))
      try {
        await tulis(() => backend.saveDaily(rec))
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    },
    [refresh, tulis],
  )
  const deleteDaily = useCallback(
    async (rec: DailyRecord) => {
      setDaily((prev) => prev.filter((x) => x.id !== rec.id))
      try {
        await tulis(() => backend.deleteDaily(rec.id))
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    },
    [refresh, tulis],
  )

  const upsertSummary = useCallback((summary: ReportSummary) => {
    writeSeq.current++
    setReports((prev) => upsertById(prev, summary))
  }, [])
  const removeSummary = useCallback((id: string) => {
    writeSeq.current++
    setReports((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const signIn = useCallback((email: string, password: string) => backend.signIn(email, password), [])
  const signOut = useCallback(async () => {
    await backend.signOut()
    setLoaded(false)
    setPlans([])
    setReports([])
    setDaily([])
  }, [])

  const rules = useMemo(() => effectiveRules(settings.rules), [settings.rules])

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
      rules,
      updateSettings,
      plans,
      savePlan,
      deletePlan,
      reports,
      upsertSummary,
      removeSummary,
      daily,
      saveDaily,
      deleteDaily,
      usedLoIds,
      refresh,
      sync,
      retrySession: () => void initSession(),
      signIn,
      signOut,
      // Bongkaran selesai (closed) tidak dapat dihapus siapa pun.
      canDeleteReport: (r) => r.status !== 'selesai' && (canManage || (r.status === 'draft' && !!userId && r.createdBy === userId)),
    }
  }, [status, statusMessage, session, loaded, settings, rules, updateSettings, plans, savePlan, deletePlan, reports, upsertSummary, removeSummary, daily, saveDaily, deleteDaily, refresh, sync, initSession, signIn, signOut, userId])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
