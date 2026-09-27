import { useEffect, useState, type ReactNode } from 'react'
import { CircleCheck, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { CheckRow, Field, Ladder } from '@/components/bongkaran/form-bits'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { StatusBanner, type BannerTone } from '@/components/bongkaran/status-banner'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { METHOD_LABEL } from '@/lib/density'
import { formatTanggalIso, minutesBetween, nowHm } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import {
  newCompartment,
  newDensityTest,
  type AtgReading,
  type Evaluation,
  type Photo,
  type Plan,
  type PlanLo,
  type Report,
  type ReportData,
  type ReportSummary,
  type Rules,
  type Settings,
  type StepDef,
} from '@/lib/sop'
import { TANKS, tankForProduk, type VolumeResult } from '@/lib/tank'
import { cn } from '@/lib/utils'

export interface StepProps {
  step: StepDef
  report: Report
  evaluation: Evaluation
  settings: Settings
  rules: Rules
  plans: Plan[]
  usedLoIds: Map<string, ReportSummary>
  readOnly: boolean
  setData: (patch: Partial<ReportData>) => void
  addPhotos: (slot: string, files: File[]) => void
  removePhoto: (slot: string, index: number) => void
  photoBusy: string | null
  srcOf: (p: Photo) => string | undefined
  beforePick: () => void
}

const IDLE = { tone: 'idle' as BannerTone, title: 'Lengkapi angka untuk melihat hasil' }

/** Satu kartu kaca per kelompok isian, seperti bagian-bagian form PANTAS. */
function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-md p-space-md', className)}>
      {children}
    </GlassCard>
  )
}

function Num({ id, value, onChange, placeholder, suffix }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string }) {
  return <Input id={id} numeric inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder} suffix={suffix} onChange={(e) => onChange(e.target.value)} />
}

function Fixed({ id, value, placeholder }: { id?: string; value: string; placeholder?: string }) {
  return <Input id={id} value={value} placeholder={placeholder} readOnly tabIndex={-1} className="opacity-80" />
}

function StepPhotos({ step, report, addPhotos, removePhoto, photoBusy, srcOf, beforePick, readOnly, only }: StepProps & { only?: string[] }) {
  const slots = step.photos.filter((p) => (only ? only.includes(p.key) : !p.optional || step.id === 'density'))
  if (!slots.length) return null
  return (
    <Section>
      {slots.map((slot) => (
        <PhotoSlot
          key={slot.key}
          label={slot.label}
          required={!slot.optional}
          photos={report.photos[slot.key] ?? []}
          busy={photoBusy === slot.key}
          disabled={readOnly}
          srcOf={srcOf}
          onAdd={(files) => addPhotos(slot.key, files)}
          onRemove={(i) => removePhoto(slot.key, i)}
          onBeforePick={beforePick}
        />
      ))}
    </Section>
  )
}

function volumeBanner(result: VolumeResult | null, label: string, compareTo?: number | null, compareLabel?: string) {
  if (!result) return IDLE
  if (result.error !== undefined) return { tone: 'error' as BannerTone, title: result.error }
  const diff = compareTo !== null && compareTo !== undefined ? compareTo - result.volume : null
  return {
    tone: 'success' as BannerTone,
    title: `${label}: ${formatLiter(result.volume, 1)}`,
    detail: [diff !== null ? `Selisih ${compareLabel} ${formatSigned(diff, 0, ' L')}` : null, result.anomaly ? 'cek tabel asli di sekitar ketinggian ini' : null]
      .filter(Boolean)
      .join(' • ') || undefined,
  }
}

/** Isi layar untuk satu langkah SOP. */
export function StepContent(props: StepProps) {
  const { step, report, evaluation, setData, rules } = props
  const d = report.data
  const x = evaluation.derived

  switch (step.id) {
    case 'lo':
      return <LoStep {...props} />

    case 'tera': {
      const setComp = (id: string, patch: Partial<ReportData['compartments'][number]>) =>
        setData({ compartments: d.compartments.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            {d.compartments.map((c) => (
              <div key={c.id} className="flex flex-col gap-space-xs">
                <span className="text-tag uppercase text-primary">Kompartemen {c.no || '-'}</span>
                <div className="grid grid-cols-2 gap-space-sm">
                  <Field label="Tinggi tera" htmlFor={`tera-${c.id}`}>
                    <Num id={`tera-${c.id}`} suffix="mm" placeholder="1250" value={c.tinggiTera} onChange={(v) => setComp(c.id, { tinggiTera: v })} />
                  </Field>
                  <Field label="Kepekaan" htmlFor={`kep-${c.id}`}>
                    <Num id={`kep-${c.id}`} suffix="L/mm" placeholder="6,5" value={c.kepekaan} onChange={(v) => setComp(c.id, { kepekaan: v })} />
                  </Field>
                </div>
              </div>
            ))}
          </Section>
        </>
      )
    }

    case 'atg_before':
    case 'atg_after': {
      const key = step.id === 'atg_before' ? 'atgBefore' : 'atgAfter'
      const reading = d[key]
      const setReading = (patch: Partial<AtgReading>) => setData({ [key]: { ...reading, ...patch } })
      const tableResult = step.id === 'atg_before' ? x.atgBeforeTable : x.atgAfterTable
      const mismatch = x.tank && d.produk && x.tank.produk.toLowerCase() !== d.produk.toLowerCase()
      return (
        <>
          {step.id === 'atg_after' && <SettleTimer d={d} setData={setData} rules={rules} />}
          <StepPhotos {...props} />
          <Section>
            {step.id === 'atg_before' && (
              <Field label="Tangki pendam" htmlFor="tangki">
                <Select value={d.tankId || undefined} onValueChange={(v) => setData({ tankId: v })}>
                  <SelectTrigger id="tangki">
                    <SelectValue placeholder="Pilih tangki" />
                  </SelectTrigger>
                  <SelectContent>
                    {TANKS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-3 gap-space-sm">
              <Field label="Tinggi" htmlFor={`${key}-t`}>
                <Num id={`${key}-t`} suffix="mm" value={reading.tinggi} onChange={(v) => setReading({ tinggi: v })} />
              </Field>
              <Field label="Volume" htmlFor={`${key}-v`}>
                <Num id={`${key}-v`} suffix="L" value={reading.volume} onChange={(v) => setReading({ volume: v })} />
              </Field>
              <Field label="Suhu" htmlFor={`${key}-s`}>
                <Num id={`${key}-s`} suffix="°C" value={reading.suhu} onChange={(v) => setReading({ suhu: v })} />
              </Field>
            </div>
            {step.id === 'atg_after' && (
              <Field label="Penjualan selama bongkar (opsional)" htmlFor="jual">
                <Num id="jual" suffix="L" placeholder="0" value={d.penjualanSelamaBongkar} onChange={(v) => setData({ penjualanSelamaBongkar: v })} />
              </Field>
            )}
            {mismatch && step.id === 'atg_before' ? (
              <StatusBanner tone="error" title="Tangki tidak sesuai produk" detail={`${x.tank!.produk} ≠ ${d.produk}`} />
            ) : (
              <StatusBanner {...volumeBanner(tableResult, 'Volume dari tabel kalibrasi', parseAngka(reading.volume), 'ATG vs tabel')} />
            )}
          </Section>
          {step.id === 'atg_after' && (
            <Section>
              <Ladder
                rows={[
                  ['Stok awal (ATG)', formatLiter(x.stokAwal ?? 0)],
                  ['Volume DO diterima', formatLiter(x.volumeDO ?? 0)],
                  ['Penjualan selama bongkar', formatLiter(x.penjualan)],
                  ['Stok akhir teoritis', formatLiter(x.stokTeoritis ?? 0)],
                  ['Real stok (ATG)', x.realStok !== null ? formatLiter(x.realStok) : '—'],
                ]}
                total={['Gain / loss', x.gainLoss !== null ? `${formatSigned(x.gainLoss, 0, ' L')} (${formatSigned(x.gainLossPct ?? 0, 2, '%')})` : '—']}
              />
            </Section>
          )}
        </>
      )
    }

    case 'safety':
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            <CheckRow checked={d.safetyApar} onChange={(v) => setData({ safetyApar: v })}>
              APAR DCP minimal 9 kg tersedia di area bongkar
            </CheckRow>
            <CheckRow checked={d.safetyArde} onChange={(v) => setData({ safetyArde: v })}>
              Kabel arde (grounding) terpasang
            </CheckRow>
            <CheckRow checked={d.safetyAtribut} onChange={(v) => setData({ safetyAtribut: v })}>
              Petugas menggunakan atribut safety
            </CheckRow>
          </Section>
        </>
      )

    case 'segel':
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            <CheckRow checked={d.segelSesuai} onChange={(v) => setData({ segelSesuai: v })}>
              Segel kompartemen atas & bawah utuh dan sesuai list DO/LO
            </CheckRow>
          </Section>
        </>
      )

    case 'dip_before':
    case 'dip_after': {
      const key = step.id === 'dip_before' ? 'dipBeforeMm' : 'dipAfterMm'
      const result = step.id === 'dip_before' ? x.dipBefore : x.dipAfter
      const atgVol = step.id === 'dip_before' ? x.stokAwal : x.realStok
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            <Field label={`Ketinggian deepstick · ${x.tank ? x.tank.label : 'tangki belum dipilih'}`} htmlFor={key}>
              <Num id={key} suffix="mm" value={d[key]} onChange={(v) => setData({ [key]: v })} />
            </Field>
            <StatusBanner {...volumeBanner(result, 'Volume dari tabel kalibrasi', atgVol, 'dengan ATG')} />
            {step.id === 'dip_after' && (
              <Ladder
                rows={[
                  ['Penerimaan menurut deepstick', x.diterimaDip !== null ? formatLiter(x.diterimaDip, 1) : '—'],
                  ['Volume DO', formatLiter(x.volumeDO ?? 0)],
                ]}
                total={['Gain / loss (deepstick)', x.gainLossDip !== null ? formatSigned(x.gainLossDip, 1, ' L') : '—']}
              />
            )}
          </Section>
        </>
      )
    }

    case 'water':
      return (
        <>
          <StepPhotos {...props} only={['water']} />
          <Section>
            <span className="text-tag uppercase text-on-surface-variant">Hasil pasta air</span>
            <div className="grid grid-cols-2 gap-space-sm">
              <Button size="lg" variant={d.airNihil === true ? 'primary' : 'glass'} onClick={() => setData({ airNihil: true })}>
                <CircleCheck aria-hidden="true" />
                Nihil
              </Button>
              <Button size="lg" variant={d.airNihil === false ? 'danger' : 'glass'} onClick={() => setData({ airNihil: false })}>
                <TriangleAlert aria-hidden="true" />
                Ada air
              </Button>
            </div>
            {d.airNihil === true && <StatusBanner tone="success" title="Water content nihil" detail="Pasta tidak berubah warna" />}
            {d.airNihil === false && (
              <>
                <StatusBanner tone="error" title="Terdapat air di kompartemen" detail="Lakukan draining dulu, lalu lampirkan fotonya" />
                <PhotoSlot
                  label="Foto proses draining"
                  photos={report.photos.draining ?? []}
                  busy={props.photoBusy === 'draining'}
                  disabled={props.readOnly}
                  srcOf={props.srcOf}
                  onAdd={(files) => props.addPhotos('draining', files)}
                  onRemove={(i) => props.removePhoto('draining', i)}
                  onBeforePick={props.beforePick}
                />
              </>
            )}
          </Section>
        </>
      )

    case 'dip_mt': {
      const setDip = (id: string, dipAktual: string) => setData({ compartments: d.compartments.map((c) => (c.id === id ? { ...c, dipAktual } : c)) })
      return (
        <>
          <StepPhotos {...props} />
          {x.compartments.map((c) => (
            <Section key={c.id}>
              <span className="text-tag uppercase text-primary">Kompartemen {c.no}</span>
              <div className="grid grid-cols-2 gap-space-sm">
                <Field label="Tinggi tera" htmlFor={`tera-fix-${c.id}`}>
                  <Fixed id={`tera-fix-${c.id}`} value={c.tinggiTera ? `${c.tinggiTera} mm` : ''} placeholder="dari buku tera" />
                </Field>
                <Field label="Hasil deepstick" htmlFor={`dip-${c.id}`}>
                  <Num id={`dip-${c.id}`} suffix="mm" value={c.dipAktual} onChange={(v) => setDip(c.id, v)} />
                </Field>
              </div>
              <StatusBanner
                {...(c.selisihMm === null
                  ? IDLE
                  : {
                      tone: (c.outOfLimit ? 'error' : 'success') as BannerTone,
                      title: c.outOfLimit ? `Kurang lebih dari ${rules.teraToleranceMm} mm` : 'Sesuai buku tera',
                      detail: `Selisih ${formatSigned(c.selisihMm, 0, ' mm')}${c.estLiter !== null ? ` ≈ ${formatSigned(c.estLiter, 1, ' L')}` : ''}`,
                    })}
              />
            </Section>
          ))}
          {x.teraOutOfLimit && <ApprovalCard {...props} />}
        </>
      )
    }

    case 'sampel':
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            <CheckRow checked={d.sampelSesuai} onChange={(v) => setData({ sampelSesuai: v })}>
              Sampel minyak kompartemen atas & bawah sesuai (warna & kejernihan sama)
            </CheckRow>
          </Section>
        </>
      )

    case 'density':
      return <DensityStep {...props} />

    case 'hose':
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            <CheckRow checked={d.fillportSesuai} onChange={(v) => setData({ fillportSesuai: v })}>
              Hose terpasang baik dan fillport sesuai produk ({d.produk || '-'} → {x.tank ? x.tank.label : 'tangki belum dipilih'})
            </CheckRow>
          </Section>
        </>
      )

    default:
      return <StepPhotos {...props} />
  }
}

function LoStep(props: StepProps) {
  const { report, evaluation, setData, rules, plans, usedLoIds } = props
  const d = report.data
  const x = evaluation.derived
  const plan = plans.find((p) => p.id === d.planId) ?? null
  const selectable = plans
    .filter((p) => p.id === d.planId || p.los.some((lo) => !usedLoIds.has(lo.id)))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))

  const selectPlan = (planId: string) => {
    const p = plans.find((pl) => pl.id === planId)
    setData({
      planId,
      noSO: p?.noSO ?? '',
      produk: p?.produk ?? '',
      soldTo: p?.soldTo || d.soldTo,
      loIds: [],
      noLOs: [],
      jumlahDO: '',
      tankId: tankForProduk(p?.produk)?.id ?? '',
    })
  }
  const toggleLo = (lo: PlanLo, checked: boolean) => {
    const loIds = checked ? [...d.loIds, lo.id] : d.loIds.filter((id) => id !== lo.id)
    const picked = plan!.los.filter((l) => loIds.includes(l.id))
    setData({ loIds, noLOs: picked.map((l) => l.noLO), jumlahDO: picked.length ? String(picked.reduce((s, l) => s + (Number(l.jumlahDO) || 0), 0)) : '' })
  }
  const setComp = (id: string, no: string) => setData({ compartments: d.compartments.map((c) => (c.id === id ? { ...c, no } : c)) })
  const removeComp = (id: string) =>
    setData({ compartments: d.compartments.filter((c) => c.id !== id), densityTests: d.densityTests.filter((t) => t.kompartemenId !== id) })

  const depotBanner = x.depotCalc
    ? x.d15Depot !== null && Math.abs(x.d15Depot - x.depotCalc.value) > 0.0005
      ? { tone: 'error' as BannerTone, title: 'Density 15°C dokumen berbeda dari hitungan', detail: `Hitungan ${formatDensity(x.depotCalc.value)} • dokumen ${formatDensity(x.d15Depot)}` }
      : { tone: 'success' as BannerTone, title: `Hitungan D15 depot ${formatDensity(x.depotCalc.value)}`, detail: METHOD_LABEL[x.depotCalc.method] }
    : { tone: 'idle' as BannerTone, title: 'Isi density & suhu OBS depot untuk cek D15' }

  return (
    <>
      <StepPhotos {...props} />
      <Section>
        <span className="text-tag uppercase text-primary">SO & LO dari Plan Kirim</span>
        {plans.length === 0 ? (
          <StatusBanner tone="error" title="Plan Kirim masih kosong" detail="SO/LO tidak bisa diketik manual — minta pengawas mengisi Plan Kirim" />
        ) : (
          <Field label="Nomor SO" htmlFor="so">
            <Select value={d.planId || undefined} onValueChange={selectPlan}>
              <SelectTrigger id="so">
                <SelectValue placeholder="Pilih SO yang datang" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.noSO} · {p.produk} · {formatTanggalIso(p.tanggal)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {plan && (
          <div className="flex flex-col gap-space-xs">
            <span className="text-tag uppercase text-on-surface-variant">Nomor LO yang datang</span>
            {plan.los.map((lo) => {
              const usedBy = usedLoIds.get(lo.id)
              const elsewhere = usedBy && usedBy.id !== report.id
              return (
                <CheckRow key={lo.id} checked={d.loIds.includes(lo.id)} disabled={!!elsewhere} onChange={(v) => toggleLo(lo, v)}>
                  <span className="tabular">LO {lo.noLO}</span> — {lo.jumlahDO} DO ({formatLiter(lo.jumlahDO * rules.literPerDO)})
                  {elsewhere && <span className="text-on-surface-variant"> · sudah dibongkar {usedBy.nopol}</span>}
                </CheckRow>
              )
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal datang" htmlFor="tgl-datang">
            <Input id="tgl-datang" type="date" value={d.tanggalDatang} onChange={(e) => setData({ tanggalDatang: e.target.value })} />
          </Field>
          <Field label="Jam datang" htmlFor="jam-datang">
            <Input id="jam-datang" type="time" value={d.jamDatang} onChange={(e) => setData({ jamDatang: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section>
        <span className="text-tag uppercase text-primary">Data LO mobil tangki</span>
        <Field label="No. polisi mobil tangki" htmlFor="nopol">
          <Input id="nopol" autoCapitalize="characters" autoComplete="off" placeholder="Contoh: AG 8123 UK" value={d.nopol} onChange={(e) => setData({ nopol: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Nama lengkap driver" htmlFor="driver">
          <Input id="driver" autoComplete="off" value={d.namaDriver} onChange={(e) => setData({ namaDriver: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="No. Sold To" htmlFor="soldto">
            <Input id="soldto" autoComplete="off" value={d.soldTo} onChange={(e) => setData({ soldTo: e.target.value })} />
          </Field>
          <Field label="Produk" htmlFor="lo-produk">
            <Fixed id="lo-produk" value={d.produk} placeholder="dari SO" />
          </Field>
          <Field label="Nomor SO" htmlFor="lo-so">
            <Fixed id="lo-so" value={d.noSO} placeholder="dari Plan" />
          </Field>
          <Field label="Nomor LO" htmlFor="lo-lo">
            <Fixed id="lo-lo" value={d.noLOs.join(', ')} placeholder="dari Plan" />
          </Field>
        </div>
        <Field label="Jumlah DO" htmlFor="jdo">
          <Num id="jdo" suffix="DO" value={d.jumlahDO} onChange={(v) => setData({ jumlahDO: v })} />
        </Field>
        <Ladder rows={[['Per DO', formatLiter(rules.literPerDO)]]} total={['Volume DO', formatLiter(x.volumeDO ?? 0)]} />
      </Section>

      <Section>
        <span className="text-tag uppercase text-primary">Density depot & keberangkatan</span>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Density OBS depot" htmlFor="dobs-depot">
            <Num id="dobs-depot" placeholder="0,7450" value={d.densityObsDepot} onChange={(v) => setData({ densityObsDepot: v })} />
          </Field>
          <Field label="Suhu OBS depot" htmlFor="suhu-depot">
            <Num id="suhu-depot" suffix="°C" placeholder="30,0" value={d.suhuObsDepot} onChange={(v) => setData({ suhuObsDepot: v })} />
          </Field>
        </div>
        <Field label="Density at 15°C (dokumen DO)" htmlFor="d15-depot">
          <Num id="d15-depot" placeholder="0,7567" value={d.density15Depot} onChange={(v) => setData({ density15Depot: v })} />
        </Field>
        <StatusBanner {...depotBanner} />
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal keluar depot" htmlFor="tgl-keluar">
            <Input id="tgl-keluar" type="date" value={d.tanggalKeluar} onChange={(e) => setData({ tanggalKeluar: e.target.value })} />
          </Field>
          <Field label="Jam keluar depot" htmlFor="jam-keluar">
            <Input id="jam-keluar" type="time" value={d.jamKeluar} onChange={(e) => setData({ jamKeluar: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section>
        <span className="text-tag uppercase text-primary">Kompartemen</span>
        <div className="flex flex-wrap items-center gap-space-xs">
          {d.compartments.map((c) => (
            <div key={c.id} className="flex items-center gap-1">
              <Input aria-label="Nomor kompartemen" className="w-20" numeric value={c.no} onChange={(e) => setComp(c.id, e.target.value)} />
              {d.compartments.length > 1 && (
                <Button variant="ghost" size="icon" aria-label={`Hapus kompartemen ${c.no}`} onClick={() => removeComp(c.id)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="soft" size="sm" onClick={() => setData({ compartments: [...d.compartments, newCompartment(String(d.compartments.length + 1))] })}>
            <Plus aria-hidden="true" />
            Kompartemen
          </Button>
        </div>
      </Section>
    </>
  )
}

function DensityStep(props: StepProps) {
  const { report, evaluation, setData, rules } = props
  const d = report.data
  const x = evaluation.derived
  const setTest = (id: string, patch: Partial<ReportData['densityTests'][number]>) =>
    setData({ densityTests: d.densityTests.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const addTest = () => {
    const untested = d.compartments.find((c) => !d.densityTests.some((t) => t.kompartemenId === c.id))
    setData({ densityTests: [...d.densityTests, newDensityTest((untested ?? d.compartments[0])?.id ?? '')] })
  }
  return (
    <>
      <GlassCard level={2} className="flex flex-col gap-space-xs p-space-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-tag uppercase text-primary">D15 dokumen DO depot</span>
          <Pill tone="cyan">Toleransi ±{String(rules.densityTolerance).replace('.', ',')}</Pill>
        </div>
        <span className="tabular text-numeric-lg font-bold text-on-surface">{formatDensity(x.d15Depot)}</span>
        <span className="text-body-sm text-on-surface-variant">
          {d.produk || 'Produk'} · selisih di atas toleransi menghentikan pembongkaran
        </span>
      </GlassCard>
      <StepPhotos {...props} />
      {x.densityResults.map((r, i) => (
        <Section key={r.id}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-tag uppercase text-primary">Pengukuran {i + 1}</span>
            <Button variant="ghost" size="icon" aria-label="Hapus pengukuran" onClick={() => setData({ densityTests: d.densityTests.filter((t) => t.id !== r.id) })}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <Field label="Kompartemen">
            <Select value={r.kompartemenId || undefined} onValueChange={(v) => setTest(r.id, { kompartemenId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kompartemen" />
              </SelectTrigger>
              <SelectContent>
                {d.compartments.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Kompartemen {c.no || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Density observasi" htmlFor={`dobs-${r.id}`}>
              <Num id={`dobs-${r.id}`} placeholder="0,7452" value={r.densityObs} onChange={(v) => setTest(r.id, { densityObs: v })} />
            </Field>
            <Field label="Suhu observasi" htmlFor={`dsuhu-${r.id}`}>
              <Num id={`dsuhu-${r.id}`} suffix="°C" placeholder="30,5" value={r.suhu} onChange={(v) => setTest(r.id, { suhu: v })} />
            </Field>
          </div>
          <Ladder
            rows={[
              ['Density @15°C (ASTM 53)', r.d15 ? formatDensity(r.d15.value) : '—'],
              ['D15 dokumen depot', formatDensity(x.d15Depot)],
            ]}
            total={['Selisih', r.selisih !== null ? formatDensitySigned(r.selisih) : '—']}
          />
          <StatusBanner
            {...(r.ok === null
              ? IDLE
              : {
                  tone: (r.ok ? 'success' : 'error') as BannerTone,
                  title: r.ok ? 'Density sesuai' : 'Anomali density — bongkar dihentikan',
                  detail: r.d15 ? METHOD_LABEL[r.d15.method] : undefined,
                })}
          />
        </Section>
      ))}
      <Button variant="glass" size="pill" className="self-center" onClick={addTest}>
        <Plus aria-hidden="true" />
        Tambah pengukuran
      </Button>
    </>
  )
}

function SettleTimer({ d, setData, rules }: { d: ReportData; setData: StepProps['setData']; rules: Rules }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20_000)
    return () => clearInterval(t)
  }, [])
  const elapsed = d.jamSelesaiBongkar ? minutesBetween(d.jamSelesaiBongkar, nowHm()) : null
  const settle = minutesBetween(d.jamSelesaiBongkar, d.jamBacaAtg)
  let banner: { tone: BannerTone; title: string; detail?: string } = { tone: 'idle', title: `Diamkan minimal ${rules.atgSettleMinutes} menit setelah bongkar` }
  if (settle !== null)
    banner =
      settle >= rules.atgSettleMinutes
        ? { tone: 'success', title: `ATG dibaca ${settle} menit setelah bongkar` }
        : { tone: 'error', title: `Baru ${settle} menit — minimal ${rules.atgSettleMinutes} menit` }
  else if (elapsed !== null)
    banner =
      elapsed < rules.atgSettleMinutes
        ? { tone: 'idle', title: `Minyak distabilkan: ${elapsed} menit`, detail: `Tunggu ${rules.atgSettleMinutes - elapsed} menit lagi` }
        : { tone: 'success', title: `Sudah ${elapsed} menit — ATG boleh dibaca` }
  return (
    <Section>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Jam selesai bongkar" htmlFor="jam-selesai">
          <Input id="jam-selesai" type="time" value={d.jamSelesaiBongkar} onChange={(e) => setData({ jamSelesaiBongkar: e.target.value })} />
        </Field>
        <Field label="Jam baca ATG" htmlFor="jam-atg">
          <Input id="jam-atg" type="time" value={d.jamBacaAtg} onChange={(e) => setData({ jamBacaAtg: e.target.value })} />
        </Field>
        <Button variant="soft" size="sm" onClick={() => setData({ jamSelesaiBongkar: nowHm() })}>
          Selesai sekarang
        </Button>
        <Button variant="soft" size="sm" onClick={() => setData({ jamBacaAtg: nowHm() })}>
          Baca sekarang
        </Button>
      </div>
      <StatusBanner {...banner} />
    </Section>
  )
}

function ApprovalCard({ report, setData, settings, rules, evaluation }: StepProps) {
  const d = report.data
  const [form, setForm] = useState({ nama: '', jabatan: '', alasan: '', pin: '' })
  const [error, setError] = useState('')
  if (d.teraApproval) {
    return (
      <Section>
        <StatusBanner tone="success" title={`Diizinkan: ${d.teraApproval.nama}`} detail={`${d.teraApproval.jabatan} • ${new Date(d.teraApproval.waktu).toLocaleString('id-ID')}`} />
        <span className="text-body-sm text-on-surface-variant">Alasan: {d.teraApproval.alasan}</span>
        <Button variant="glass" size="pill" className="self-start" onClick={() => setData({ teraApproval: null })}>
          Batalkan izin
        </Button>
      </Section>
    )
  }
  const approve = () => {
    if (!form.nama.trim() || !form.jabatan.trim() || !form.alasan.trim()) return setError('Isi nama, jabatan, dan alasan.')
    if (settings.pinPenanggungJawab && form.pin !== settings.pinPenanggungJawab) return setError('PIN penanggung jawab salah.')
    setData({
      teraApproval: {
        nama: form.nama.trim(),
        jabatan: form.jabatan.trim(),
        alasan: form.alasan.trim(),
        waktu: new Date().toISOString(),
        snapshot: evaluation.derived.compartments.map((c) => ({ no: c.no, selisihMm: c.selisihMm })),
      },
    })
  }
  return (
    <GlassCard level={3} className="flex flex-col gap-space-md p-space-md">
      <div className="flex flex-col gap-0.5">
        <span className="text-tag uppercase text-error">Butuh izin penanggung jawab</span>
        <span className="text-body-sm text-on-surface-variant">Kekurangan melebihi {formatNumber(rules.teraToleranceMm)} mm. Proses lanjut hanya atas izin atasan petugas.</span>
      </div>
      <Field label="Nama penanggung jawab" htmlFor="izin-nama">
        <Input id="izin-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
      </Field>
      <Field label="Jabatan" htmlFor="izin-jabatan">
        <Input id="izin-jabatan" placeholder="Pengawas / Manager SPBU" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} />
      </Field>
      {settings.pinPenanggungJawab && (
        <Field label="PIN" htmlFor="izin-pin">
          <Input id="izin-pin" type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
        </Field>
      )}
      <Field label="Alasan" htmlFor="izin-alasan">
        <Textarea id="izin-alasan" rows={2} value={form.alasan} onChange={(e) => setForm({ ...form, alasan: e.target.value })} />
      </Field>
      {error && <span className="text-body-sm font-semibold text-error">{error}</span>}
      <Button size="pill" onClick={approve}>
        Beri izin lanjut
      </Button>
    </GlassCard>
  )
}
