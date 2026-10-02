import { useMemo, useState } from 'react'
import { Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field, Ladder } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StokGate, useStokShift } from '@/components/bongkaran/stok-gate'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { BEJANA_LIMIT_ML, bejanaStatus, newQqKualitas, newQqKuantitas, qqD15, totalPumpTest, type QqData, type QqRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatNumber } from '@/lib/format'
import { shiftLabel, type Shift } from '@/lib/shift'
import { PRODUK_OPTIONS } from '@/lib/sop'
import { cn } from '@/lib/utils'

const qqId = (tanggal: string, shift: Shift) => `qq_${tanggal}_${shift}`

/** Waktu simpan (di luar render). */
const stamp = () => Date.now()

export function QqHarian() {
  const app = useApp()
  const toast = useToast()
  const { key: now } = useStokShift()
  const [key, setKey] = useState<{ tanggal: string; shift: Shift }>(now)
  const [range, setRange] = useDateRange('7d')
  const records = useMemo(() => app.daily.filter((d): d is QqRecord => d.kind === 'qq'), [app.daily])
  const id = qqId(key.tanggal, key.shift)
  const existing = records.find((r) => r.id === id) ?? null
  const [draft, setDraft] = useState<{ id: string; data: QqData } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // D15 bongkaran terakhir per produk sebagai acuan uji harian.
  const acuan = useMemo(() => {
    const m = new Map<string, { d15: number; tanggal: string }>()
    for (const r of [...app.reports].sort((a, b) => a.createdAt - b.createdAt)) if (r.d15 !== null && r.produk) m.set(r.produk, { d15: r.d15, tanggal: r.tanggal })
    return m
  }, [app.reports])

  if (!app.loaded) return <Loading />

  const fresh = (): QqData => ({
    petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    jam: nowHm(),
    kualitas: [newQqKualitas(PRODUK_OPTIONS[0])],
    kuantitas: app.settings.nozzles.map((n) => newQqKuantitas(n.id, n.nama, n.produk)),
    catatan: '',
  })
  const data: QqData = draft?.id === id ? draft.data : (existing?.data ?? fresh())
  const setData = (patch: Partial<QqData>) => {
    setError(null)
    setDraft({ id, data: { ...data, ...patch } })
  }
  const setK = (i: number, patch: Partial<QqData['kualitas'][number]>) => setData({ kualitas: data.kualitas.map((k, j) => (j === i ? { ...k, ...patch } : k)) })
  const setN = (i: number, patch: Partial<QqData['kuantitas'][number]>) => setData({ kuantitas: data.kuantitas.map((k, j) => (j === i ? { ...k, ...patch } : k)) })

  const simpan = async () => {
    if (!data.kualitas.length && !data.kuantitas.length) return setError('Isi minimal satu uji kualitas atau kuantitas.')
    if (data.kualitas.some((k) => !qqD15(k).d15)) return setError('Lengkapi density dan suhu setiap uji kualitas.')
    if (data.kuantitas.some((n) => bejanaStatus(n.selisihMl) === 'kosong')) return setError('Isi hasil bejana setiap nozzle (0 bila tepat).')
    setSaving(true)
    try {
      const rec: QqRecord = {
        id,
        kind: 'qq',
        tanggal: key.tanggal,
        shift: key.shift,
        data,
        createdAt: existing?.createdAt ?? stamp(),
        updatedAt: stamp(),
        createdBy: existing?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.saveDaily(rec)
      setDraft(null)
      const lewat = data.kuantitas.filter((n) => bejanaStatus(n.selisihMl) === 'lewat').length
      toast(lewat ? `Q&Q tersimpan, ${lewat} nozzle melewati batas` : 'Q&Q harian tersimpan', lewat ? TriangleAlert : undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const pump = totalPumpTest(data)
  const history = records.filter((r) => inRange(r.tanggal, range)).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const isNow = key.tanggal === now.tanggal && key.shift === now.shift

  return (
    <div className="flex flex-col gap-space-md">
      {isNow && <StokGate action="uji Q&Q" />}

      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">Uji Q&Q {shiftLabel(key.shift).split(' (')[0]}</h2>
            <span className="text-body-sm text-on-surface-variant">{formatTanggalIso(key.tanggal)}</span>
          </div>
          {existing ? <Pill tone="success">Tersimpan</Pill> : <Pill>Belum diuji</Pill>}
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
      </GlassCard>

      <section aria-labelledby="uji-kualitas" className="flex flex-col gap-space-sm">
        <SectionHeader id="uji-kualitas" title="Uji kualitas" />
        {data.kualitas.map((k, i) => {
          const { obs, d15 } = qqD15(k)
          const ref = acuan.get(k.produk)
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
                <Button variant="ghost" size="icon" aria-label={`Hapus uji ${k.produk}`} onClick={() => setData({ kualitas: data.kualitas.filter((x) => x.id !== k.id) })}>
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
                  ['Density @15°C (ASTM 53)', d15 ? formatDensity(d15.value) : '-'],
                  [`Acuan D15 bongkaran ${ref ? formatTanggalIso(ref.tanggal) : 'terakhir'}`, ref ? formatDensity(ref.d15) : 'belum ada'],
                ]}
                total={['Selisih', selisih !== null ? formatDensitySigned(selisih) : '-']}
              />
              {ok !== null && (
                <Pill tone={ok ? 'success' : 'error'} className="self-start">
                  {ok ? 'Sesuai toleransi' : `Melebihi toleransi ${String(app.rules.densityTolerance).replace('.', ',')}`}
                </Pill>
              )}
            </GlassCard>
          )
        })}
        <Button variant="glass" size="pill" className="self-center" onClick={() => setData({ kualitas: [...data.kualitas, newQqKualitas(PRODUK_OPTIONS[0])] })}>
          <Plus aria-hidden="true" />
          Uji produk lain
        </Button>
      </section>

      <section aria-labelledby="uji-kuantitas" className="flex flex-col gap-space-sm">
        <SectionHeader id="uji-kuantitas" title="Uji kuantitas (bejana 20 L)" />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <span className="text-body-sm text-on-surface-variant">
            Isi selisih bejana ukur 20 liter dalam ml. Lebih kecil dari {formatNumber(BEJANA_LIMIT_ML)} ml ditandai merah.
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
                  {st === 'lewat' && <Pill tone="error">Lewat batas</Pill>}
                  {st === 'ok' && <Pill tone="success">Sesuai</Pill>}
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-space-xs">
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
                  <Button variant="ghost" size="icon" aria-label={`Hapus ${n.nozzle}`} onClick={() => setData({ kuantitas: data.kuantitas.filter((x) => x.id !== n.id) })}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
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
      </section>

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <Ladder
          rows={[
            ['Pump test uji kualitas', `${formatNumber(pump.kualitas, 1)} L`],
            ['Pump test uji kuantitas', `${formatNumber(pump.kuantitas, 1)} L`],
          ]}
          total={['Total pump test', `${formatNumber(pump.kualitas + pump.kuantitas, 1)} L`]}
        />
        <Field label="Petugas" htmlFor="qq-petugas">
          <Input id="qq-petugas" value={data.petugas} onChange={(e) => setData({ petugas: e.target.value })} />
        </Field>
        {error && (
          <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
            <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
          </div>
        )}
        <Button size="lg" className="w-full" disabled={saving} onClick={simpan}>
          <Save aria-hidden="true" />
          Simpan Q&Q
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
    </div>
  )
}
