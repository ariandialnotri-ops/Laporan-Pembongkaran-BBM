import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, CloudCheck, FireExtinguisher, Flag, LoaderCircle, Pencil, Settings2, TriangleAlert } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { aparRecordId, cekDari, hasilCek, statusKedaluwarsa, type AparCek, type AparData, type CekKey, type CekNilai } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { compressImage } from '@/lib/image'
import { currentShift } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stamp = () => Date.now()
const isoNow = () => new Date().toISOString()

/** Input > Inspeksi APAR & APAB: checklist per unit, tersimpan otomatis, diselesaikan bila lengkap. */
export function InspeksiApar() {
  const app = useApp()
  const toast = useToast()
  useSyncOnOpen()
  const [params] = useSearchParams()
  const [tanggal, setTanggal] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get('tanggal') ?? '') ? params.get('tanggal')! : todayIso()))
  const id = aparRecordId(tanggal)
  const records = useMemo(() => app.daily.filter((d): d is AparRecord => d.kind === 'apar'), [app.daily])
  const existing = records.find((r) => r.id === id) ?? null
  const [draft, setDraft] = useState<{ id: string; data: AparData } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const s = app.settings
  const unitsSetting = useMemo(() => [...(s.apar ?? []).map((u) => cekDari(u, 'apar')), ...(s.apab ?? []).map((u) => cekDari(u, 'apab'))], [s.apar, s.apab])

  // Inspeksi belum selesai mengikuti daftar unit terbaru di Pengaturan (isian unit lama dipertahankan).
  const base: AparData = useMemo(() => {
    const d = existing?.data
    if (d?.selesaiAt) return d
    const lama = new Map((d?.units ?? []).map((u) => [u.unitId, u]))
    return {
      petugas: d?.petugas ?? (app.displayName === 'Mode lokal' ? s.namaPetugasDefault : app.displayName),
      jam: d?.jam ?? nowHm(),
      catatan: d?.catatan ?? '',
      units: unitsSetting.map((u) => {
        const old = lama.get(u.unitId)
        return old ? { ...u, cek: old.cek, catatan: old.catatan, foto: old.foto } : u
      }),
    }
  }, [existing, unitsSetting, app.displayName, s.namaPetugasDefault])
  const data = draft?.id === id ? draft.data : base
  const selesai = !!data.selesaiAt
  const srcOf = usePhotoSrc(data.units.flatMap((u) => u.foto))

  // Simpan otomatis 700 ms setelah perubahan terakhir.
  const latest = useRef({ existing, id, tanggal })
  latest.current = { existing, id, tanggal }
  const persist = async (next: AparData) => {
    const { existing: ex, id: rid, tanggal: tgl } = latest.current
    const rec: AparRecord = {
      id: rid,
      kind: 'apar',
      tanggal: tgl,
      shift: currentShift().shift,
      data: next,
      createdAt: ex?.createdAt ?? stamp(),
      updatedAt: stamp(),
      createdBy: ex?.createdBy ?? app.session.user?.id ?? null,
    }
    await app.saveDaily(rec)
  }
  useEffect(() => {
    if (!draft || draft.id !== id || draft.data.selesaiAt) return
    const t = setTimeout(() => {
      setSave('saving')
      persist(draft.data)
        .then(() => setSave('saved'))
        .catch((e) => {
          setSave('error')
          setError(`Gagal menyimpan: ${pesan(e)}`)
        })
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!app.loaded) return <Loading />

  const setData = (patch: Partial<AparData>) => {
    setError(null)
    setDraft({ id, data: { ...data, ...patch } })
  }
  const setUnit = (unitId: string, patch: Partial<AparCek>) => setData({ units: data.units.map((u) => (u.unitId === unitId ? { ...u, ...patch } : u)) })
  const setCek = (u: AparCek, key: CekKey, v: CekNilai) => setUnit(u.unitId, { cek: { ...u.cek, [key]: v } })
  const semuaBaik = (u: AparCek) => setUnit(u.unitId, { cek: Object.fromEntries(hasilCek(u).items.map((i) => [i.key, 'ok'])) })

  const tambahFoto = async (u: AparCek, files: File[]) => {
    setBusy(u.unitId)
    try {
      const baru: Photo[] = []
      for (const f of files) baru.push(await app.backend.uploadPhoto(`daily-${id}`, await compressImage(f), `${u.kode || 'apar'}.jpg`))
      setUnit(u.unitId, { foto: [...u.foto, ...baru] })
    } catch (e) {
      setError(`Gagal menyimpan foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }
  const hapusFoto = (u: AparCek, i: number) => {
    const target = u.foto[i]
    setUnit(u.unitId, { foto: u.foto.filter((_, j) => j !== i) })
    if (target) void app.backend.deletePhoto(target).catch(() => {})
  }

  const selesaikan = async () => {
    if (!data.units.length) return setError('Belum ada unit APAR/APAB. Atur dulu di Pengaturan, Proteksi Kebakaran.')
    if (!data.petugas.trim()) return setError('Isi nama petugas inspeksi.')
    for (const u of data.units) {
      const h = hasilCek(u)
      if (h.kosong.length) return setError(`${u.kode || 'Unit'}: ${h.kosong.length} butir belum diperiksa.`)
      if (h.temuan.length && !u.catatan.trim()) return setError(`${u.kode || 'Unit'}: tulis catatan tindak lanjut temuan.`)
      if (h.temuan.length && !u.foto.length) return setError(`${u.kode || 'Unit'}: foto bukti temuan wajib.`)
    }
    setBusy('selesai')
    try {
      const next = { ...data, selesaiAt: isoNow() }
      await persist(next)
      setDraft(null)
      toast('Inspeksi APAR & APAB selesai')
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }

  const bulan = todayIso().slice(0, 7)
  const bulanIni = records.filter((r) => r.data.selesaiAt && r.tanggal.startsWith(bulan)).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0]
  const temuanTotal = data.units.reduce((n, u) => n + hasilCek(u).temuan.length, 0)
  const lengkap = data.units.filter((u) => !hasilCek(u).kosong.length).length
  const riwayat = records.filter((r) => r.data.selesaiAt).sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 6)
  const hariIni = todayIso()

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-error-container text-error">
            <FireExtinguisher className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-md font-bold text-on-surface">{bulanIni ? `Bulan ini sudah diinspeksi (${formatTanggalIso(bulanIni.tanggal)})` : 'Bulan ini belum diinspeksi'}</span>
            <span className="tabular text-body-sm text-on-surface-variant">
              {s.jumlahPulau || 0} pulau pompa, {(s.apar ?? []).filter((u) => !u.cadangan).length} APAR terpasang, {(s.apar ?? []).filter((u) => u.cadangan).length} cadangan, {(s.apab ?? []).length} APAB
            </span>
          </div>
          <Link to="/pengaturan#proteksi" aria-label="Atur unit APAR & APAB" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
            <Settings2 aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal inspeksi" htmlFor="apar-tgl">
            <Input id="apar-tgl" type="date" max={hariIni} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
          </Field>
          <Field label="Petugas" htmlFor="apar-petugas">
            <Input id="apar-petugas" disabled={selesai} value={data.petugas} onChange={(e) => setData({ petugas: e.target.value })} />
          </Field>
        </div>
        {!selesai && data.units.length > 0 && (
          <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            {save === 'saving' ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <CloudCheck aria-hidden="true" className="size-4" />}
            {save === 'saving' ? 'Menyimpan…' : save === 'error' ? 'Gagal tersimpan' : 'Tersimpan otomatis'}, {lengkap} dari {data.units.length} unit lengkap
            {temuanTotal ? `, ${temuanTotal} temuan` : ''}
          </span>
        )}
      </GlassCard>

      {data.units.length === 0 ? (
        <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
          <span className="text-body-sm text-on-surface-variant">Belum ada unit APAR/APAB. Isi jumlah pulau dan daftar APAR, APAR cadangan, dan APAB di profil SPBU.</span>
          <Link to="/pengaturan#proteksi" className={buttonVariants({ size: 'pill' })}>
            <Settings2 aria-hidden="true" />
            Atur proteksi kebakaran
          </Link>
        </GlassCard>
      ) : (
        <section aria-labelledby="apar-unit" className="animate-entrance-2 flex flex-col gap-space-sm">
          <SectionHeader id="apar-unit" title="Checklist per unit" action={selesai ? <Pill tone="success">Selesai</Pill> : undefined} />
          {data.units.map((u) => (
            <UnitCard
              key={u.unitId}
              u={u}
              hariIni={hariIni}
              readOnly={selesai}
              busy={busy === u.unitId}
              srcOf={srcOf}
              onCek={(k, v) => setCek(u, k, v)}
              onSemuaBaik={() => semuaBaik(u)}
              onCatatan={(v) => setUnit(u.unitId, { catatan: v })}
              onFoto={(f) => void tambahFoto(u, f)}
              onHapusFoto={(i) => hapusFoto(u, i)}
            />
          ))}
          <Field label="Catatan umum (opsional)" htmlFor="apar-catatan">
            <Input id="apar-catatan" disabled={selesai} value={data.catatan} onChange={(e) => setData({ catatan: e.target.value })} />
          </Field>
          {error && (
            <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
              <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
            </div>
          )}
          {selesai ? (
            <Button variant="glass" size="lg" onClick={() => setDraft({ id, data: { ...data, selesaiAt: undefined } })}>
              <Pencil aria-hidden="true" />
              Buka untuk koreksi
            </Button>
          ) : (
            <Button size="lg" disabled={busy !== null} onClick={selesaikan}>
              {busy === 'selesai' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Flag aria-hidden="true" />}
              Selesaikan inspeksi
            </Button>
          )}
        </section>
      )}

      {riwayat.length > 0 && (
        <section aria-labelledby="apar-riwayat" className="animate-entrance-3 flex flex-col gap-space-xs">
          <SectionHeader id="apar-riwayat" title="Inspeksi terakhir" action={<Link to="/laporan/apar" className="text-body-sm font-semibold text-primary">Riwayat</Link>} />
          <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
            {riwayat.map((r) => {
              const t = r.data.units.reduce((n, u) => n + hasilCek(u).temuan.length, 0)
              return (
                <button key={r.id} type="button" onClick={() => setTanggal(r.tanggal)} className="flex min-h-14 items-center gap-space-sm px-space-sm py-space-xs text-left">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="tabular text-body-sm font-semibold text-on-surface">{formatTanggalIso(r.tanggal)}</span>
                    <span className="truncate text-body-sm text-on-surface-variant">
                      {r.data.units.length} unit, petugas {r.data.petugas || '-'}
                    </span>
                  </span>
                  {t ? <Pill tone="error">{t} temuan</Pill> : <Pill tone="success">Semua baik</Pill>}
                </button>
              )
            })}
          </GlassCard>
        </section>
      )}
    </div>
  )
}

function UnitCard({
  u,
  hariIni,
  readOnly,
  busy,
  srcOf,
  onCek,
  onSemuaBaik,
  onCatatan,
  onFoto,
  onHapusFoto,
}: {
  u: AparCek
  hariIni: string
  readOnly: boolean
  busy: boolean
  srcOf: (p: Photo) => string | undefined
  onCek: (k: CekKey, v: CekNilai) => void
  onSemuaBaik: () => void
  onCatatan: (v: string) => void
  onFoto: (f: File[]) => void
  onHapusFoto: (i: number) => void
}) {
  const h = hasilCek(u)
  const exp = statusKedaluwarsa(u.kedaluwarsa, hariIni)
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-sm p-space-md', h.temuan.length > 0 && 'ring-1 ring-error/40')}>
      <div className="flex items-start gap-space-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular text-body-lg font-bold text-on-surface">{u.kode || '-'}</span>
            <Pill tone={u.tipe === 'apab' ? 'primary' : 'neutral'}>{u.tipe === 'apab' ? 'APAB' : u.cadangan ? 'Cadangan' : 'APAR'}</Pill>
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {u.jenis}, {u.kapasitasKg || '-'} kg, {u.lokasi || 'lokasi belum diatur'}
          </span>
          {exp && (
            <span className={cn('tabular text-body-sm font-semibold', exp === 'lewat' ? 'text-error' : exp === 'segera' ? 'text-amber-700' : 'text-on-surface-variant')}>
              Isi ulang {formatTanggalIso(u.kedaluwarsa)}
              {exp === 'lewat' ? ' (sudah lewat)' : exp === 'segera' ? ' (kurang dari 30 hari)' : ''}
            </span>
          )}
        </div>
        {h.kosong.length === 0 ? (
          h.temuan.length ? (
            <Pill tone="error">{h.temuan.length} temuan</Pill>
          ) : (
            <Pill tone="success">
              <CircleCheck aria-hidden="true" />
              Baik
            </Pill>
          )
        ) : (
          <Pill>{h.kosong.length} belum</Pill>
        )}
      </div>
      {!readOnly && h.kosong.length > 0 && (
        <Button variant="soft" size="sm" className="self-start" onClick={onSemuaBaik}>
          <CircleCheck aria-hidden="true" />
          Semua butir baik
        </Button>
      )}
      <ul className="flex flex-col gap-1">
        {h.items.map((it) => {
          const v = u.cek[it.key]
          return (
            <li key={it.key} className="flex items-center gap-space-sm rounded-md bg-surface-container-low/70 px-space-sm py-1.5">
              <span className="flex min-w-0 flex-1 flex-col text-body-sm">
                <span className="text-on-surface">{it.label}</span>
                {it.hint && <span className="text-on-surface-variant">{it.hint}</span>}
              </span>
              <div role="radiogroup" aria-label={`${it.label}, ${u.kode}`} className="flex shrink-0 gap-1">
                {(['ok', 'tidak'] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={v === n}
                    disabled={readOnly}
                    onClick={() => onCek(it.key, n)}
                    className={cn(
                      'min-h-9 min-w-14 rounded-full px-2.5 text-body-sm font-semibold transition-colors disabled:cursor-default',
                      v === n ? (n === 'ok' ? 'bg-primary text-on-primary' : 'bg-error text-on-error') : 'bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant',
                    )}
                  >
                    {n === 'ok' ? 'Baik' : 'Tidak'}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <Field label={h.temuan.length ? 'Tindak lanjut temuan (wajib)' : 'Catatan (opsional)'} htmlFor={`apar-cat-${u.unitId}`}>
        <Input id={`apar-cat-${u.unitId}`} disabled={readOnly} placeholder={h.temuan.length ? 'Mis. diganti pin baru, isi ulang dijadwalkan' : ''} value={u.catatan} onChange={(e) => onCatatan(e.target.value)} />
      </Field>
      {(h.temuan.length > 0 || u.foto.length > 0) && (
        <PhotoSlot label="Foto bukti temuan" photos={u.foto} required={h.temuan.length > 0} busy={busy} disabled={readOnly} srcOf={srcOf} onAdd={onFoto} onRemove={onHapusFoto} />
      )}
    </GlassCard>
  )
}
