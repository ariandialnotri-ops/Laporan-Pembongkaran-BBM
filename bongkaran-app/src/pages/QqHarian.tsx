import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, CircleDot, Flag, Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field, Ladder } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StokGate, useStokShift } from '@/components/bongkaran/stok-gate'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import {
  BEJANA_LIMIT_ML,
  bejanaStatus,
  newQqKualitas,
  newQqKuantitas,
  QQ_FOTO,
  qqD15,
  qqRecordId,
  totalPumpTest,
  type QqData,
  type QqFotoKey,
  type QqKualitas,
  type QqKuantitas,
  type QqRecord,
} from '@/lib/daily'
import { formatTanggalIso, nowHm } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatNumber } from '@/lib/format'
import { compressImage } from '@/lib/image'
import { acuanD15 } from '@/lib/ringkasan'
import { shiftLabel, type Shift } from '@/lib/shift'
import { PRODUK_OPTIONS, type Photo } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Waktu (di luar render). */
const stamp = () => Date.now()
const isoNow = () => new Date().toISOString()
const jamDari = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')
const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

const kualitasValid = (k: QqKualitas) => (!qqD15(k).d15 ? 'Lengkapi density dan suhu.' : null)
const kuantitasValid = (n: QqKuantitas) => (bejanaStatus(n.selisihMl) === 'kosong' ? 'Isi hasil bejana (0 bila tepat).' : null)

function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

/** URL tampilan foto: dataURL (mode lokal / baru diambil) atau signed URL Supabase. */
function usePhotoSrc(photos: Photo[]) {
  const app = useApp()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const kunci = photos.map((p) => p.id).join(',')
  useEffect(() => {
    const butuh = photos.filter((p) => !p.dataUrl && p.path && !urls[p.id])
    if (!butuh.length) return
    let alive = true
    app.backend
      .signedUrls(butuh)
      .then((u) => alive && setUrls((cur) => ({ ...cur, ...u })))
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, app.backend])
  return (p: Photo) => p.dataUrl || urls[p.id]
}

/** Input > Kualitas Harian: uji density per produk dan tera bejana 20 L per nozzle, disimpan per baris. */
export function QqHarian() {
  const app = useApp()
  const toast = useToast()
  const { key: now } = useStokShift()
  const [key, setKey] = useState<{ tanggal: string; shift: Shift }>(now)
  const [range, setRange] = useDateRange('7d')
  const records = useMemo(() => app.daily.filter((d): d is QqRecord => d.kind === 'qq'), [app.daily])
  const id = qqRecordId(key.tanggal, key.shift)
  const existing = records.find((r) => r.id === id) ?? null
  const [draft, setDraft] = useState<{ id: string; data: QqData } | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const fresh = (): QqData => ({
    petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    jam: nowHm(),
    kualitas: [newQqKualitas(PRODUK_OPTIONS[0])],
    kuantitas: app.settings.nozzles.map((n) => newQqKuantitas(n.id, n.nama, n.produk)),
    catatan: '',
  })
  const data: QqData = draft?.id === id ? draft.data : (existing?.data ?? fresh())
  const allPhotos = Object.values(data.foto ?? {}).flat()
  const srcOf = usePhotoSrc(allPhotos)
  const belumSimpan = draft?.id === id && !data.selesaiAt ? data.kualitas.filter((k) => !k.savedAt).length + data.kuantitas.filter((n) => !n.savedAt).length : 0
  const guard = useLeaveGuard({
    active: belumSimpan > 0,
    title: 'Keluar dari kualitas harian?',
    detail: `${belumSimpan} baris uji belum disimpan dan akan hilang. Simpan tiap baris dengan tombol Simpan sebelum keluar.`,
  })

  if (!app.loaded) return <Loading />

  const setData = (patch: Partial<QqData>) => {
    setError(null)
    setDraft({ id, data: { ...data, ...patch } })
  }
  // Mengubah baris membatalkan tanda "tersimpan" sampai disimpan lagi.
  const setK = (i: number, patch: Partial<QqKualitas>) => setData({ kualitas: data.kualitas.map((k, j) => (j === i ? { ...k, ...patch, savedAt: undefined } : k)) })
  const setN = (i: number, patch: Partial<QqKuantitas>) => setData({ kuantitas: data.kuantitas.map((k, j) => (j === i ? { ...k, ...patch, savedAt: undefined } : k)) })

  /** Simpan ke server berdasar data yang sudah tersimpan (baris lain yang belum disimpan tidak ikut). */
  const persist = async (mutate: (base: QqData) => QqData) => {
    const base: QqData = existing?.data ?? { ...data, kualitas: [], kuantitas: [], foto: {}, selesaiAt: undefined }
    const next = mutate({ ...base, petugas: data.petugas, jam: data.jam })
    const rec: QqRecord = {
      id,
      kind: 'qq',
      tanggal: key.tanggal,
      shift: key.shift,
      data: next,
      createdAt: existing?.createdAt ?? stamp(),
      updatedAt: stamp(),
      createdBy: existing?.createdBy ?? app.session.user?.id ?? null,
    }
    await app.saveDaily(rec)
  }

  const simpanKualitas = async (i: number) => {
    const row = data.kualitas[i]
    const err = kualitasValid(row)
    if (err) return setRowError({ ...rowError, [row.id]: err })
    const saved = { ...row, savedAt: isoNow() }
    setBusy(row.id)
    try {
      await persist((b) => ({ ...b, kualitas: upsert(b.kualitas, saved) }))
      setDraft({ id, data: { ...data, kualitas: data.kualitas.map((k) => (k.id === row.id ? saved : k)) } })
      setRowError({ ...rowError, [row.id]: '' })
      toast(`Uji ${row.produk} tersimpan`)
    } catch (e) {
      setRowError({ ...rowError, [row.id]: pesan(e) })
    } finally {
      setBusy(null)
    }
  }

  const simpanKuantitas = async (i: number) => {
    const row = data.kuantitas[i]
    const err = kuantitasValid(row)
    if (err) return setRowError({ ...rowError, [row.id]: err })
    const saved = { ...row, savedAt: isoNow() }
    setBusy(row.id)
    try {
      await persist((b) => ({ ...b, kuantitas: upsert(b.kuantitas, saved) }))
      setDraft({ id, data: { ...data, kuantitas: data.kuantitas.map((k) => (k.id === row.id ? saved : k)) } })
      setRowError({ ...rowError, [row.id]: '' })
      const lewat = bejanaStatus(row.selisihMl) === 'lewat'
      toast(lewat ? `${row.nozzle} tersimpan, di bawah batas ${BEJANA_LIMIT_ML} ml` : `${row.nozzle} tersimpan`, lewat ? TriangleAlert : undefined)
    } catch (e) {
      setRowError({ ...rowError, [row.id]: pesan(e) })
    } finally {
      setBusy(null)
    }
  }

  const hapusBaris = async (kind: 'kualitas' | 'kuantitas', rowId: string) => {
    const tersimpan = (existing?.data[kind] as { id: string }[] | undefined)?.some((x) => x.id === rowId)
    if (kind === 'kualitas') setData({ kualitas: data.kualitas.filter((x) => x.id !== rowId) })
    else setData({ kuantitas: data.kuantitas.filter((x) => x.id !== rowId) })
    if (tersimpan) {
      try {
        await persist((b) => ({ ...b, [kind]: (b[kind] as { id: string }[]).filter((x) => x.id !== rowId) }) as QqData)
      } catch (e) {
        setError(pesan(e))
      }
    }
  }

  // Foto langsung diunggah & disimpan, supaya tidak hilang bila HP menutup aplikasi.
  const tambahFoto = async (k: QqFotoKey, files: File[]) => {
    setBusy(k)
    try {
      const baru: Photo[] = []
      for (const f of files) {
        const blob = await compressImage(f)
        baru.push(await app.backend.uploadPhoto(`daily-${id}`, blob, `${k}.jpg`))
      }
      const foto = { ...(data.foto ?? {}), [k]: [...(data.foto?.[k] ?? []), ...baru] }
      await persist((b) => ({ ...b, foto: { ...(b.foto ?? {}), [k]: [...(b.foto?.[k] ?? []), ...baru] } }))
      setDraft({ id, data: { ...data, foto } })
    } catch (e) {
      setError(`Gagal menyimpan foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }
  const hapusFoto = async (k: QqFotoKey, index: number) => {
    const target = data.foto?.[k]?.[index]
    if (!target) return
    const foto = { ...(data.foto ?? {}), [k]: (data.foto?.[k] ?? []).filter((_, j) => j !== index) }
    setDraft({ id, data: { ...data, foto } })
    try {
      await persist((b) => ({ ...b, foto: { ...(b.foto ?? {}), [k]: (b.foto?.[k] ?? []).filter((p) => p.id !== target.id) } }))
      await app.backend.deletePhoto(target)
    } catch (e) {
      setError(pesan(e))
    }
  }

  const fotoKurang = (keys: QqFotoKey[]) => keys.filter((k) => !(data.foto?.[k]?.length))
  const selesaikan = async () => {
    if (!data.kualitas.length && !data.kuantitas.length) return setError('Isi minimal satu uji kualitas atau tera.')
    if (data.kualitas.some((k) => !k.savedAt) || data.kuantitas.some((n) => !n.savedAt)) return setError('Simpan dulu setiap baris uji (tombol Simpan di tiap produk/nozzle).')
    const kurang = [...(data.kualitas.length ? fotoKurang(['kualitasStruk', 'kualitasKembali']) : []), ...(data.kuantitas.length ? fotoKurang(['kuantitasStruk', 'kuantitasKembali']) : [])]
    if (kurang.length) return setError(`Foto wajib belum ada: ${[...new Set(kurang.map((k) => `${QQ_FOTO[k]} (${k.startsWith('kualitas') ? 'kualitas' : 'tera'})`))].join(', ')}.`)
    if (!data.petugas.trim()) return setError('Isi nama petugas.')
    setBusy('selesai')
    try {
      await persist(() => ({ ...data, selesaiAt: isoNow() }))
      setDraft(null)
      toast('Uji Q&Q harian selesai')
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }

  const pump = totalPumpTest(data)
  const history = records.filter((r) => inRange(r.tanggal, range)).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const isNow = key.tanggal === now.tanggal && key.shift === now.shift
  const selesai = !!existing?.data.selesaiAt && !draft

  const fotoSlot = (k: QqFotoKey) => (
    <PhotoSlot key={k} label={QQ_FOTO[k]} photos={data.foto?.[k] ?? []} busy={busy === k} srcOf={srcOf} onAdd={(f) => void tambahFoto(k, f)} onRemove={(i) => void hapusFoto(k, i)} />
  )

  return (
    <div className="flex flex-col gap-space-md">
      {isNow && <StokGate action="uji Q&Q" />}

      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">Uji Q&Q {shiftLabel(key.shift).split(' (')[0]}</h2>
            <span className="text-body-sm text-on-surface-variant">{formatTanggalIso(key.tanggal)}</span>
          </div>
          {existing?.data.selesaiAt ? <Pill tone="success">Selesai</Pill> : existing ? <Pill tone="cyan">Sebagian tersimpan</Pill> : <Pill>Belum diuji</Pill>}
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal" htmlFor="qq-tgl">
            <Input id="qq-tgl" type="date" value={key.tanggal} onChange={(e) => e.target.value && setKey({ ...key, tanggal: e.target.value })} />
          </Field>
          <Field label="Jam uji" htmlFor="qq-jam">
            <Input id="qq-jam" type="time" value={data.jam} onChange={(e) => setData({ jam: e.target.value })} />
          </Field>
        </div>
        <Choice
          label="Shift"
          value={String(key.shift) as '1' | '2' | '3'}
          onChange={(v) => setKey({ ...key, shift: Number(v) as Shift })}
          options={[
            { value: '1', label: 'Shift 1' },
            { value: '2', label: 'Shift 2' },
            { value: '3', label: 'Shift 3' },
          ]}
        />
        <Field label="Petugas" htmlFor="qq-petugas">
          <Input id="qq-petugas" value={data.petugas} onChange={(e) => setData({ petugas: e.target.value })} />
        </Field>
      </GlassCard>

      <section aria-labelledby="uji-kualitas" className="flex flex-col gap-space-sm">
        <SectionHeader id="uji-kualitas" title="Uji kualitas (density)" />
        {data.kualitas.map((k, i) => {
          const { obs, d15 } = qqD15(k)
          const ref = acuanD15(app.reports, k.produk, key.tanggal)
          const selisih = d15 && ref ? Math.round((d15.value - ref.d15) * 10000) / 10000 : null
          const ok = selisih === null ? null : Math.abs(selisih) <= app.rules.densityTolerance + 1e-9
          return (
            <GlassCard key={k.id} level={2} className="flex flex-col gap-space-sm p-space-md">
              <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
                <Field label="Produk" htmlFor={`qk-p-${k.id}`}>
                  <Select value={k.produk} onValueChange={(v) => setK(i, { produk: v })}>
                    <SelectTrigger id={`qk-p-${k.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUK_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button variant="ghost" size="icon" aria-label={`Hapus uji ${k.produk}`} onClick={() => void hapusBaris('kualitas', k.id)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-space-sm">
                <Field label="Density" htmlFor={`qk-d-${k.id}`}>
                  <Input id={`qk-d-${k.id}`} numeric inputMode="decimal" placeholder="0,7450" value={k.densityObs} onChange={(e) => setK(i, { densityObs: e.target.value })} />
                </Field>
                <Field label="Suhu" htmlFor={`qk-s-${k.id}`}>
                  <Input id={`qk-s-${k.id}`} numeric inputMode="decimal" suffix="°C" value={k.suhu} onChange={(e) => setK(i, { suhu: e.target.value })} />
                </Field>
                <Field label="Pump test" htmlFor={`qk-v-${k.id}`}>
                  <Input id={`qk-v-${k.id}`} numeric inputMode="decimal" suffix="L" value={k.pumpTest} onChange={(e) => setK(i, { pumpTest: e.target.value })} />
                </Field>
              </div>
              <Ladder
                rows={[
                  ['Density observasi', formatDensity(obs)],
                  ['Density @15°C', d15 ? formatDensity(d15.value) : '-'],
                  [`Acuan D15 bongkaran ${ref ? formatTanggalIso(ref.tanggal) : 'terakhir'}`, ref ? formatDensity(ref.d15) : 'belum ada'],
                ]}
                total={['Selisih', selisih !== null ? formatDensitySigned(selisih) : '-']}
              />
              <SimpanBaris
                ok={ok}
                okText={ok ? 'Sesuai toleransi' : `Melebihi toleransi ${formatDensity(app.rules.densityTolerance)}`}
                savedAt={k.savedAt}
                busy={busy === k.id}
                error={rowError[k.id]}
                onSave={() => void simpanKualitas(i)}
                label={`Simpan uji ${k.produk}`}
              />
            </GlassCard>
          )
        })}
        <Button variant="glass" size="pill" className="self-center" onClick={() => setData({ kualitas: [...data.kualitas, newQqKualitas(PRODUK_OPTIONS[0])] })}>
          <Plus aria-hidden="true" />
          Uji produk lain
        </Button>
        {data.kualitas.length > 0 && (
          <GlassCard level={1} className="flex flex-col gap-space-sm p-space-md">
            <span className="flex items-center gap-space-xs text-body-sm font-bold text-on-surface">
              <Flag aria-hidden="true" className="size-4 text-primary" />
              Langkah terakhir uji kualitas
            </span>
            {fotoSlot('kualitasStruk')}
            {fotoSlot('kualitasKembali')}
          </GlassCard>
        )}
      </section>

      <section aria-labelledby="uji-kuantitas" className="flex flex-col gap-space-sm">
        <SectionHeader id="uji-kuantitas" title="Tera takaran (bejana 20 L)" />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <span className="text-body-sm text-on-surface-variant">
            Isi selisih bejana ukur 20 liter dalam ml, lalu simpan tiap nozzle. Lebih kecil dari {formatNumber(BEJANA_LIMIT_ML)} ml ditandai merah.
          </span>
          {data.kuantitas.length === 0 && <span className="text-body-sm text-on-surface-variant">Belum ada nozzle. Tambahkan di Pengaturan atau langsung di bawah.</span>}
          {data.kuantitas.map((n, i) => {
            const st = bejanaStatus(n.selisihMl)
            return (
              <div key={n.id} className={cn('flex flex-col gap-space-xs rounded-md p-space-sm', st === 'lewat' ? 'bg-error-container/70' : 'bg-surface-container-low/60')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-md font-semibold text-on-surface">
                    {n.nozzle || `Nozzle ${i + 1}`}
                    <span className="font-normal text-on-surface-variant">, {n.produk}</span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Hapus ${n.nozzle}`} onClick={() => void hapusBaris('kuantitas', n.id)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-space-xs">
                  <Field label="Selisih bejana" htmlFor={`qn-ml-${n.id}`}>
                    <Input
                      id={`qn-ml-${n.id}`}
                      numeric
                      inputMode="text"
                      suffix="ml"
                      placeholder="-20"
                      value={n.selisihMl}
                      onChange={(e) => setN(i, { selisihMl: e.target.value })}
                      aria-invalid={st === 'lewat'}
                    />
                  </Field>
                  <Field label="Pump test" htmlFor={`qn-v-${n.id}`}>
                    <Input id={`qn-v-${n.id}`} numeric inputMode="decimal" suffix="L" value={n.pumpTest} onChange={(e) => setN(i, { pumpTest: e.target.value })} />
                  </Field>
                </div>
                <SimpanBaris
                  ok={st === 'kosong' ? null : st === 'ok'}
                  okText={st === 'lewat' ? 'Di bawah batas' : 'Sesuai'}
                  savedAt={n.savedAt}
                  busy={busy === n.id}
                  error={rowError[n.id]}
                  onSave={() => void simpanKuantitas(i)}
                  label={`Simpan ${n.nozzle}`}
                />
              </div>
            )
          })}
          <div className="flex flex-wrap gap-space-xs">
            {app.settings.nozzles.length > 0 && data.kuantitas.length < app.settings.nozzles.length && (
              <Button
                variant="soft"
                size="sm"
                onClick={() =>
                  setData({
                    kuantitas: [
                      ...data.kuantitas,
                      ...app.settings.nozzles.filter((nz) => !data.kuantitas.some((k) => k.nozzleId === nz.id)).map((nz) => newQqKuantitas(nz.id, nz.nama, nz.produk)),
                    ],
                  })
                }
              >
                Muat semua nozzle
              </Button>
            )}
            <Button variant="soft" size="sm" onClick={() => setData({ kuantitas: [...data.kuantitas, newQqKuantitas('', `Nozzle ${data.kuantitas.length + 1}`, PRODUK_OPTIONS[0])] })}>
              <Plus aria-hidden="true" />
              Nozzle
            </Button>
          </div>
        </GlassCard>
        {data.kuantitas.length > 0 && (
          <GlassCard level={1} className="flex flex-col gap-space-sm p-space-md">
            <span className="flex items-center gap-space-xs text-body-sm font-bold text-on-surface">
              <Flag aria-hidden="true" className="size-4 text-primary" />
              Langkah terakhir tera takaran
            </span>
            {fotoSlot('kuantitasStruk')}
            {fotoSlot('kuantitasKembali')}
          </GlassCard>
        )}
      </section>

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <Ladder
          rows={[
            ['Pump test uji kualitas', `${formatNumber(pump.kualitas, 1)} L`],
            ['Pump test tera takaran', `${formatNumber(pump.kuantitas, 1)} L`],
          ]}
          total={['Total pump test', `${formatNumber(pump.kualitas + pump.kuantitas, 1)} L`]}
        />
        {error && (
          <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
            <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
          </div>
        )}
        <Button size="lg" className="w-full" disabled={busy !== null || selesai} onClick={selesaikan}>
          {selesai ? <CircleCheck aria-hidden="true" /> : <Save aria-hidden="true" />}
          {selesai ? `Uji selesai ${jamDari(existing?.data.selesaiAt)}` : 'Selesaikan uji'}
        </Button>
      </GlassCard>

      <section aria-labelledby="riwayat-qq" className="flex flex-col gap-space-sm">
        <SectionHeader id="riwayat-qq" title="Riwayat Q&Q harian" />
        <DateFilter id="qq-range" value={range} onChange={setRange} />
        {history.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada uji Q&Q pada rentang ini.
          </GlassCard>
        ) : (
          history.map((r) => {
            const lewat = r.data.kuantitas.filter((n) => bejanaStatus(n.selisihMl) === 'lewat')
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setKey({ tanggal: r.tanggal, shift: r.shift })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="glass-1 flex min-h-14 items-center gap-space-sm rounded-lg p-space-sm text-left active:scale-[0.99]"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-md font-semibold text-on-surface">
                    {formatTanggalIso(r.tanggal)}, shift {r.shift}
                    {!r.data.selesaiAt && <span className="font-normal text-on-surface-variant"> (belum selesai)</span>}
                  </span>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {r.data.kualitas.map((k) => `${k.produk} ${qqD15(k).d15 ? formatDensity(qqD15(k).d15!.value) : '-'}`).join(', ') || 'Tanpa uji kualitas'}
                  </span>
                </div>
                {lewat.length ? <Pill tone="error">{lewat.length} nozzle lewat</Pill> : <Pill tone="success">{r.data.kuantitas.length} nozzle OK</Pill>}
              </button>
            )
          })
        )}
      </section>
      {guard.dialog}
    </div>
  )
}

/** Status hasil + tombol simpan untuk satu baris uji. */
function SimpanBaris({
  ok,
  okText,
  savedAt,
  busy,
  error,
  onSave,
  label,
}: {
  ok: boolean | null
  okText: string
  savedAt?: string
  busy: boolean
  error?: string
  onSave: () => void
  label: string
}) {
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="flex flex-wrap items-center gap-space-xs">
          {ok !== null && <Pill tone={ok ? 'success' : 'error'}>{okText}</Pill>}
          {savedAt ? (
            <span className="flex items-center gap-1 text-body-sm text-primary">
              <CircleCheck aria-hidden="true" className="size-4" />
              Tersimpan {jamDari(savedAt)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
              <CircleDot aria-hidden="true" className="size-4" />
              Belum disimpan
            </span>
          )}
        </span>
        <Button size="sm" variant={savedAt ? 'glass' : 'primary'} disabled={busy} onClick={onSave} aria-label={label}>
          <Save aria-hidden="true" />
          Simpan
        </Button>
      </div>
      {error && <span className="text-body-sm font-semibold text-error">{error}</span>}
    </div>
  )
}
