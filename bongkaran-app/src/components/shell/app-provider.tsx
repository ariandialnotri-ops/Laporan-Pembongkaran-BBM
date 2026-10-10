import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppContext, type AppState, type SessionStatus } from '@/lib/app-state'
import { backend, type SessionInfo, type Spbu } from '@/lib/backend'
import type { DailyRecord } from '@/lib/daily'
import { addDays, todayIso } from '@/lib/date'
import { bolehBuka, type Role } from '@/lib/roles'
import { DEFAULT_RULES, effectiveRules, type Plan, type ReportSummary, type Settings } from '@/lib/sop'
import { setTanks, urutTangki, type TankDef } from '@/lib/tank'
import { DEFAULT_AREAS } from '@/lib/apar'

const DEFAULT_SETTINGS: Settings = {
  namaSpbu: '',
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
  jumlahDispenser: 0,
  dispensers: [],
  soldTo: '',
  shipTo: {},
  aparArea: DEFAULT_AREAS,
  apar: [],
  apab: [],
  rules: DEFAULT_RULES,
}

const NO_SESSION: SessionInfo = { user: null, role: null, nama: null }

function upsertById<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]
}

const KUNCI_SPBU = 'floq-spbu'
function spbuTersimpan() {
  try {
    return localStorage.getItem(KUNCI_SPBU)
  } catch {
    return null
  }
}

function initialsOf(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [statusMessage, setStatusMessage] = useState('')
  const [session, setSession] = useState<SessionInfo>(NO_SESSION)
  // Peran terbaru untuk simpan pengaturan (dibaca di dalam efek tunda).
  const roleRef = useRef<string | null>(null)
  roleRef.current = backend.mode === 'local' ? null : session.role
  const [loaded, setLoaded] = useState(false)
  const [spbuList, setSpbuList] = useState<Spbu[]>([])
  const [spbuId, setSpbuId] = useState<string | null>(null)
  const [tanks, setTankState] = useState<TankDef[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const spbuIdRef = useRef(spbuId)
  spbuIdRef.current = spbuId
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

  // Daftar SPBU yang boleh diakses; SPBU aktif = pilihan terakhir ABH di perangkat ini, atau yang pertama.
  useEffect(() => {
    if (status !== 'ready') return
    let alive = true
    backend.listSpbu().then(
      (list) => {
        if (!alive) return
        setSpbuList(list)
        const simpan = spbuTersimpan()
        const id = list.find((x) => x.id === simpan)?.id ?? list[0]?.id ?? null
        setSpbuId(id)
        if (!id) setLoaded(true)
      },
      (e: unknown) => {
        setStatusMessage(`Gagal memuat daftar SPBU: ${e instanceof Error ? e.message : String(e)}`)
        if (alive) setLoaded(true)
      },
    )
    return () => {
      alive = false
    }
  }, [status, userId])

  // Data SPBU aktif: pengaturan, database tangki, plan, laporan, catatan harian.
  useEffect(() => {
    if (status !== 'ready' || !spbuId) return
    let alive = true
    backend.pilihSpbu(spbuId)
    setLoaded(false)
    ;(async () => {
      try {
        const [s, t] = await Promise.all([backend.getSettings(), backend.listTanks()])
        if (!alive) return
        setSettings(s ? { ...DEFAULT_SETTINGS, ...s, rules: { ...DEFAULT_RULES, ...(s.rules ?? {}) } } : DEFAULT_SETTINGS)
        setTanks(t)
        setTankState(urutTangki(t))
        await refresh()
      } catch (e) {
        setStatusMessage(`Gagal memuat data: ${e instanceof Error ? e.message : String(e)}`)
      }
      if (alive) setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [status, userId, spbuId, refresh])

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
  // Pengawas hanya boleh mengubah identitas SPBU, data utama APAR/APAB, Sold To & Ship To; ABH menyimpan seluruh pengaturan.
  const flushSettings = useCallback(() => {
    if (!settingsDirty.current) return
    settingsDirty.current = false
    const st = settingsRef.current
    const id = spbuIdRef.current
    const simpan =
      roleRef.current === 'pengawas'
        ? backend.saveSettingsTerbatas({
            namaSpbu: st.namaSpbu,
            kodeSpbu: st.kodeSpbu,
            alamatSpbu: st.alamatSpbu,
            jumlahPulau: st.jumlahPulau,
            jumlahDispenser: st.jumlahDispenser,
            apar: st.apar,
            apab: st.apab,
            aparArea: st.aparArea,
            soldTo: st.soldTo,
            shipTo: st.shipTo,
          })
        : backend.saveSettings(st)
    simpan.then(
      // Nama & kode di daftar SPBU mengikuti identitas.
      () => setSpbuList((l) => l.map((x) => (x.id === id ? { ...x, nama: st.namaSpbu.trim() || x.nama, kode: st.kodeSpbu.trim() || x.kode } : x))),
      (e: Error) => setStatusMessage(`Gagal menyimpan pengaturan: ${e.message}`),
    )
  }, [])
  useEffect(() => {
    if (!settingsDirty.current) return
    const flush = flushSettings
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
  }, [settings, flushSettings])

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

  const pilihSpbu = useCallback(
    (id: string) => {
      if (id === spbuIdRef.current) return
      // Perubahan pengaturan yang belum tersimpan masuk ke SPBU lama dulu.
      flushSettings()
      try {
        localStorage.setItem(KUNCI_SPBU, id)
      } catch {
        // Penyimpanan diblokir: ganti di tempat.
        setPlans([])
        setReports([])
        setDaily([])
        setSpbuId(id)
        return
      }
      // Muat ulang dari Dashboard: form yang sedang terbuka (draft bongkaran, Q&Q, dll.) menyimpan
      // ke SPBU lama saat halaman ditutup, tidak pernah ke SPBU baru.
      window.location.assign('/')
    },
    [flushSettings],
  )
  const buatSpbu = useCallback(
    async (nama: string, kode: string) => {
      const id = await backend.buatSpbu(nama, kode)
      setSpbuList(await backend.listSpbu())
      pilihSpbu(id)
    },
    [pilihSpbu],
  )
  const saveTank = useCallback(async (tank: TankDef) => {
    await backend.saveTank(tank)
    setTankState((prev) => {
      const next = urutTangki(upsertById(prev, tank))
      setTanks(next)
      return next
    })
  }, [])
  const deleteTank = useCallback(async (id: string) => {
    await backend.deleteTank(id)
    setTankState((prev) => {
      const next = prev.filter((t) => t.id !== id)
      setTanks(next)
      return next
    })
  }, [])

  const signIn = useCallback((email: string, password: string) => backend.signIn(email, password), [])
  const signOut = useCallback(async () => {
    await backend.signOut()
    setLoaded(false)
    setSpbuList([])
    setSpbuId(null)
    setPlans([])
    setReports([])
    setDaily([])
  }, [])

  const rules = useMemo(() => effectiveRules(settings.rules), [settings.rules])

  const value = useMemo<AppState>(() => {
    // Mode lokal = ABH; saat pengembangan peran lain bisa dicoba lewat localStorage "floq-peran".
    const role: Role = backend.mode === 'local' ? peranUjiLokal() : (session.role ?? 'security')
    const isAdmin = role === 'abh'
    const canManage = isAdmin || role === 'pengawas'
    const displayName = session.nama || session.user?.email || 'Mode lokal'
    const identitasLengkap = !!settings.namaSpbu.trim() && !!settings.kodeSpbu.trim() && (settings.jumlahPulau ?? 0) > 0
    const usedLoIds = new Map<string, ReportSummary>()
    reports.forEach((r) => r.loIds?.forEach((id) => usedLoIds.set(id, r)))
    return {
      backend,
      status,
      statusMessage,
      session,
      role,
      isAdmin,
      canManage,
      can: (path) => bolehBuka(role, path),
      displayName,
      initials: initialsOf(displayName),
      spbuList,
      spbuId,
      spbu: spbuList.find((x) => x.id === spbuId) ?? null,
      pilihSpbu,
      buatSpbu,
      tanks,
      saveTank,
      deleteTank,
      identitasLengkap,
      spbuSiap: identitasLengkap && tanks.length > 0,
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
  }, [status, statusMessage, session, spbuList, spbuId, pilihSpbu, buatSpbu, tanks, saveTank, deleteTank, loaded, settings, rules, updateSettings, plans, savePlan, deletePlan, reports, upsertSummary, removeSummary, daily, saveDaily, deleteDaily, refresh, sync, initSession, signIn, signOut, userId])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

function peranUjiLokal(): Role {
  if (!import.meta.env.DEV) return 'abh'
  try {
    const r = localStorage.getItem('floq-peran')
    return r === 'pengawas' || r === 'kashift' || r === 'security' ? r : 'abh'
  } catch {
    return 'abh'
  }
}
