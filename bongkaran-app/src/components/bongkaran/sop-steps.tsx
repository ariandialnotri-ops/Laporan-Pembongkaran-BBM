import { useEffect, useState, type ReactNode } from 'react'
import { CircleCheck, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { CheckRow, Field, Ladder } from '@/components/bongkaran/form-bits'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { SignaturePad } from '@/components/bongkaran/signature-pad'
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
import { genId } from '@/lib/image'
import { loPickable, loStatus, loStatusMeta } from '@/lib/plan'
import { shiftLabel } from '@/lib/shift'
import {
  SIGNERS,
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
  type SignerKey,
  type StepDef,
  type Totalisator,
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
      .join(', ') || undefined,
  }
}

/** Isi layar untuk satu langkah SOP. */
export function StepContent(props: StepProps) {
  const { step, report, evaluation, setData, rules } = props
  const d = report.data
  const x = evaluation.derived

  switch (step.id) {
    case 'mt':
      return (
        <>
          <StepPhotos {...props} />
          <Section>
            <Field label="No. polisi mobil tangki" htmlFor="nopol">
              <Input id="nopol" autoCapitalize="characters" autoComplete="off" placeholder="Contoh: AG 8123 UK" value={d.nopol} onChange={(e) => setData({ nopol: e.target.value.toUpperCase() })} />
            </Field>
          </Section>
        </>
      )

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
                  <Field label="Kapasitas kompartemen" htmlFor={`kap-${c.id}`}>
                    <Num id={`kap-${c.id}`} suffix="L" placeholder="8000" value={c.kapasitas} onChange={(v) => setComp(c.id, { kapasitas: v })} />
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
                <Select value={d.tankId} onValueChange={(v) => setData({ tankId: v })}>
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
            {step.id === 'atg_after' && !d.totalisator.length && (
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
          <TotalisatorSection {...props} fase={step.id === 'atg_before' ? 'awal' : 'akhir'} />
          {step.id === 'atg_after' && (
            <Section>
              <Ladder
                rows={[
                  ['Stok awal (ATG)', formatLiter(x.stokAwal ?? 0)],
                  ['Volume DO diterima', formatLiter(x.volumeDO ?? 0)],
                  ['Penjualan selama bongkar', formatLiter(x.penjualan)],
                  ['Stok akhir teoritis', formatLiter(x.stokTeoritis ?? 0)],
                  ['Real stok (ATG)', x.realStok !== null ? formatLiter(x.realStok) : '-'],
                ]}
                total={['Gain / loss', x.gainLoss !== null ? `${formatSigned(x.gainLoss, 0, ' L')} (${formatSigned(x.gainLossPct ?? 0, 2, '%')})` : '-']}
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
      return <SegelStep {...props} />

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
                  ['Penerimaan menurut deepstick', x.diterimaDip !== null ? formatLiter(x.diterimaDip, 1) : '-'],
                  ['Volume DO', formatLiter(x.volumeDO ?? 0)],
                ]}
                total={['Gain / loss (deepstick)', x.gainLossDip !== null ? formatSigned(x.gainLossDip, 1, ' L') : '-']}
              />
            )}
          </Section>
          {step.id === 'dip_after' && <SignersSection report={report} setData={setData} readOnly={props.readOnly} keys={['penerima', 'security', 'supir', 'pengawas', 'abh']} />}
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
              Hose MT terpasang baik pada fillport yang sesuai produk ({d.produk || '-'} ke {x.tank ? x.tank.label : 'tangki belum dipilih'})
            </CheckRow>
          </Section>
        </>
      )

    default:
      return <StepPhotos {...props} />
  }
}

function LoStep(props: StepProps) {
  const { report, evaluation, setData, plans, usedLoIds, settings } = props
  const d = report.data
  const x = evaluation.derived
  const plan = plans.find((p) => p.id === d.planId) ?? null
  // LO milik laporan ini tetap dapat dipilih walau statusnya sudah Delivered.
  const own = (lo: PlanLo) => usedLoIds.get(lo.id)?.id === report.id
  const selectable = plans
    .filter((p) => p.id === d.planId || (p.noSO.trim() && p.los.some((lo) => loPickable(lo, usedLoIds))))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))

  const selectPlan = (planId: string) => {
    const p = plans.find((pl) => pl.id === planId)
    setData({ planId, noSO: p?.noSO ?? '', shipTo: p?.shipTo || d.shipTo, loIds: [], noLOs: [], produk: '', volumeDO: '', segelLO: [], tankId: '' })
  }
  const toggleLo = (lo: PlanLo, checked: boolean) => {
    const loIds = checked ? [...d.loIds, lo.id] : d.loIds.filter((id) => id !== lo.id)
    const picked = plan!.los.filter((l) => loIds.includes(l.id))
    const produk = picked[0]?.produk ?? ''
    const nozzles = settings.nozzles.filter((n) => n.produk === produk)
    setData({
      loIds,
      noLOs: picked.map((l) => l.noLO),
      produk,
      volumeDO: picked.length ? String(picked.reduce((s, l) => s + l.volume, 0)) : '',
      segelLO: [...new Set(picked.flatMap((l) => l.segel))],
      tankId: produk !== d.produk ? (tankForProduk(produk)?.id ?? '') : d.tankId,
      totalisator: produk !== d.produk ? nozzles.map((n) => ({ nozzleId: n.id, nozzle: n.nama, awal: '', akhir: '' })) : d.totalisator,
    })
  }
  const setComp = (id: string, no: string) => setData({ compartments: d.compartments.map((c) => (c.id === id ? { ...c, no } : c)) })
  const removeComp = (id: string) =>
    setData({ compartments: d.compartments.filter((c) => c.id !== id), densityTests: d.densityTests.filter((t) => t.kompartemenId !== id) })

  const depotBanner = x.depotCalc
    ? x.d15Depot !== null && Math.abs(x.d15Depot - x.depotCalc.value) > 0.0005
      ? { tone: 'error' as BannerTone, title: 'Density 15°C dokumen berbeda dari hitungan', detail: `Hitungan ${formatDensity(x.depotCalc.value)}, dokumen ${formatDensity(x.d15Depot)}` }
      : { tone: 'success' as BannerTone, title: `Hitungan D15 depot ${formatDensity(x.depotCalc.value)}`, detail: METHOD_LABEL[x.depotCalc.method] }
    : { tone: 'idle' as BannerTone, title: 'Isi density & suhu OBS depot untuk cek D15' }

  return (
    <>
      <StepPhotos {...props} />
      <Section>
        <span className="text-tag uppercase text-primary">SO & LO dari Plan</span>
        {plans.length === 0 ? (
          <StatusBanner tone="error" title="Belum ada SO siap dibongkar" detail="SO/LO tidak bisa diketik manual. Isi di menu Bongkar, tab Plan SO & LO." />
        ) : (
          <Field label="Nomor SO" htmlFor="so">
            <Select value={d.planId} onValueChange={selectPlan}>
              <SelectTrigger id="so">
                <SelectValue placeholder="Pilih SO yang datang" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    SO {p.noSO}, {p.supplyPoint || '-'}, kirim {formatTanggalIso(p.tanggal)}
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
              const checked = d.loIds.includes(lo.id)
              const mine = own(lo)
              const st = loStatus(lo, usedLoIds)
              const blocked = !checked && !mine && !loPickable(lo, usedLoIds)
              const lainProduk = !checked && !!d.produk && d.loIds.length > 0 && lo.produk !== d.produk
              return (
                <CheckRow key={lo.id} checked={checked} disabled={blocked || lainProduk} onChange={(v) => toggleLo(lo, v)}>
                  <span className="tabular font-semibold">{lo.noLO ? `LO ${lo.noLO}` : 'LO belum terbit'}</span>, {lo.produk} {formatLiter(lo.volume)}
                  {lo.noLOLama && <span className="tabular text-on-surface-variant"> (alih supply dari LO {lo.noLOLama})</span>}
                  {blocked && <span className="text-on-surface-variant">. Status {loStatusMeta(st).label}</span>}
                  {lainProduk && <span className="text-on-surface-variant">. Produk berbeda, bongkar terpisah</span>}
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
        <span className="text-body-sm text-on-surface-variant">
          Tercatat sebagai bongkaran <b className="text-on-surface">{shiftLabel(x.shift)}</b>
        </span>
      </Section>

      <Section>
        <span className="text-tag uppercase text-primary">Data LO mobil tangki</span>
        <div className="inset-field tabular rounded-md px-3.5 py-3 text-body-md text-on-surface">MT {d.nopol || '-'}</div>
        <Field label="Nama lengkap driver" htmlFor="driver">
          <Input id="driver" autoComplete="off" value={d.namaDriver} onChange={(e) => setData({ namaDriver: e.target.value })} />
        </Field>
        <Field label="Perusahaan pengangkut" htmlFor="pengangkut">
          <Input id="pengangkut" autoComplete="off" value={d.perusahaanPengangkut} onChange={(e) => setData({ perusahaanPengangkut: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="No. Ship To" htmlFor="shipto">
            <Input id="shipto" autoComplete="off" inputMode="numeric" value={d.shipTo} onChange={(e) => setData({ shipTo: e.target.value })} />
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
        <Field label="Volume DO" htmlFor="volumedo" hint={d.loIds.length ? 'Terisi dari volume LO di Plan.' : undefined}>
          <Num id="volumedo" suffix="L" value={d.volumeDO} onChange={(v) => setData({ volumeDO: v })} />
        </Field>
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
          {d.produk || 'Produk'}. Selisih di atas toleransi menghentikan pembongkaran.
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
            <Select value={r.kompartemenId} onValueChange={(v) => setTest(r.id, { kompartemenId: v })}>
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
              ['Density @15°C (ASTM 53)', r.d15 ? formatDensity(r.d15.value) : '-'],
              ['D15 dokumen depot', formatDensity(x.d15Depot)],
            ]}
            total={['Selisih', r.selisih !== null ? formatDensitySigned(r.selisih) : '-']}
          />
          <StatusBanner
            {...(r.ok === null
              ? IDLE
              : {
                  tone: (r.ok ? 'success' : 'error') as BannerTone,
                  title: r.ok ? 'Density sesuai' : 'Anomali density, bongkar dihentikan',
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
        : { tone: 'error', title: `Baru ${settle} menit, minimal ${rules.atgSettleMinutes} menit` }
  else if (elapsed !== null)
    banner =
      elapsed < rules.atgSettleMinutes
        ? { tone: 'idle', title: `Minyak distabilkan: ${elapsed} menit`, detail: `Tunggu ${rules.atgSettleMinutes - elapsed} menit lagi` }
        : { tone: 'success', title: `Sudah ${elapsed} menit, ATG boleh dibaca` }
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
        <StatusBanner tone="success" title={`Diizinkan: ${d.teraApproval.nama}`} detail={`${d.teraApproval.jabatan}, ${new Date(d.teraApproval.waktu).toLocaleString('id-ID')}`} />
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

/** Totalisator nozzle produk ini: awal di tahap ATG sebelum, akhir di tahap ATG setelah. */
function TotalisatorSection({ report, setData, settings, evaluation, readOnly, fase }: StepProps & { fase: 'awal' | 'akhir' }) {
  const d = report.data
  const rows = d.totalisator
  const configured = settings.nozzles.filter((n) => n.produk === d.produk)
  const setRow = (i: number, patch: Partial<Totalisator>) => setData({ totalisator: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const results = evaluation.derived.totalisator
  return (
    <Section>
      <div className="flex flex-col">
        <span className="text-tag uppercase text-primary">Penjualan selama pembongkaran</span>
        <span className="text-body-sm text-on-surface-variant">
          {fase === 'awal' ? 'Catat totalisator awal setiap nozzle ' : 'Catat totalisator akhir setiap nozzle '}
          {d.produk || 'produk ini'}.
        </span>
      </div>
      {rows.length === 0 && (
        <span className="text-body-sm text-on-surface-variant">
          {configured.length ? 'Nozzle belum dimuat untuk bongkaran ini.' : 'Belum ada nozzle untuk produk ini di Pengaturan. Tambahkan manual bila ada penjualan saat bongkar.'}
        </span>
      )}
      {rows.map((r, i) => (
        <div key={r.nozzleId} className="grid grid-cols-[1fr_1fr] items-end gap-space-sm">
          {r.nozzleId.startsWith('manual') && !readOnly ? (
            <Field label="Nozzle" htmlFor={`nz-${r.nozzleId}`}>
              <Input id={`nz-${r.nozzleId}`} value={r.nozzle} placeholder="Nozzle 1" onChange={(e) => setRow(i, { nozzle: e.target.value })} />
            </Field>
          ) : (
            <div className="flex min-h-12 flex-col justify-center">
              <span className="text-body-md font-semibold text-on-surface">{r.nozzle}</span>
              {fase === 'akhir' && results[i]?.jual !== null && (
                <span className="tabular text-body-sm text-on-surface-variant">Terjual {formatLiter(results[i].jual ?? 0, 2)}</span>
              )}
            </div>
          )}
          <Field label={fase === 'awal' ? 'Totalisator awal' : 'Totalisator akhir'} htmlFor={`tot-${fase}-${r.nozzleId}`}>
            <Num id={`tot-${fase}-${r.nozzleId}`} value={fase === 'awal' ? r.awal : r.akhir} onChange={(v) => setRow(i, fase === 'awal' ? { awal: v } : { akhir: v })} />
          </Field>
        </div>
      ))}
      {!readOnly && (
        <div className="flex flex-wrap gap-space-xs">
          {configured.length > 0 && rows.length === 0 && (
            <Button variant="soft" size="sm" onClick={() => setData({ totalisator: configured.map((n) => ({ nozzleId: n.id, nozzle: n.nama, awal: '', akhir: '' })) })}>
              Muat nozzle {d.produk}
            </Button>
          )}
          {fase === 'awal' && (
            <Button variant="soft" size="sm" onClick={() => setData({ totalisator: [...rows, { nozzleId: genId('manual'), nozzle: `Nozzle ${rows.length + 1}`, awal: '', akhir: '' }] })}>
              <Plus aria-hidden="true" />
              Nozzle
            </Button>
          )}
          {fase === 'awal' && rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setData({ totalisator: rows.slice(0, -1) })}>
              <Trash2 aria-hidden="true" />
              Hapus terakhir
            </Button>
          )}
        </div>
      )}
      {fase === 'akhir' && rows.length > 0 && (
        <Ladder rows={[]} total={['Total penjualan', formatLiter(evaluation.derived.penjualan, 2)]} />
      )}
    </Section>
  )
}

/** Tahap segel: satu foto atas & bawah, nomor segel tiap kompartemen dicocokkan dengan data LO. */
function SegelStep(props: StepProps) {
  const { report, setData } = props
  const d = report.data
  const daftar = d.segelLO
  const setSegel = (id: string, noSegel: string) => setData({ compartments: d.compartments.map((c) => (c.id === id ? { ...c, noSegel } : c)) })
  const asing = d.compartments.filter((c) => c.noSegel.trim() && daftar.length > 0 && !daftar.includes(c.noSegel.trim()))
  return (
    <>
      <div role="note" className="flex flex-col gap-space-xs rounded-lg border border-error/40 bg-error-container/60 p-space-md">
        <span className="flex items-center gap-space-xs text-body-md font-bold text-on-error-container">
          <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-error" />
          Cocokkan nomor segel dengan dokumen LO
        </span>
        {daftar.length ? (
          <span className="tabular text-body-md font-semibold text-on-error-container">{daftar.join(', ')}</span>
        ) : (
          <span className="text-body-sm text-on-error-container">Nomor segel belum diisi di data LO (tab Plan SO & LO). Cocokkan langsung dengan dokumen LO fisik.</span>
        )}
        <span className="text-body-sm text-on-error-container">Segel rusak atau nomor berbeda: hentikan bongkar dan hubungi pengawas.</span>
      </div>
      <StepPhotos {...props} />
      <Section>
        <span className="text-tag uppercase text-primary">Nomor segel per kompartemen</span>
        <datalist id="segel-lo">
          {daftar.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-space-sm">
          {d.compartments.map((c, i) => (
            <Field key={c.id} label={`Kompartemen ${c.no || '-'}`} htmlFor={`segel-${c.id}`}>
              <Input
                id={`segel-${c.id}`}
                list="segel-lo"
                autoComplete="off"
                inputMode="numeric"
                placeholder={daftar[i] ?? 'Nomor segel'}
                value={c.noSegel}
                onChange={(e) => setSegel(c.id, e.target.value)}
              />
            </Field>
          ))}
        </div>
        {daftar.length > 0 && d.compartments.some((c) => !c.noSegel) && (
          <Button
            variant="soft"
            size="sm"
            className="self-start"
            onClick={() => setData({ compartments: d.compartments.map((c, i) => ({ ...c, noSegel: c.noSegel || daftar[i] || '' })) })}
          >
            Isi sesuai urutan data LO
          </Button>
        )}
        {asing.length > 0 && (
          <StatusBanner tone="error" title="Nomor segel tidak ada di data LO" detail={asing.map((c) => `Kompartemen ${c.no}: ${c.noSegel}`).join(', ')} />
        )}
        <CheckRow checked={d.segelSesuai} onChange={(v) => setData({ segelSesuai: v })}>
          Segel kompartemen atas & bawah utuh dan nomornya sesuai data LO
        </CheckRow>
      </Section>
    </>
  )
}

/** Nama dan tanda tangan digital penerima, security, supir tangki, pengawas, dan ABH. */
export function SignersSection({
  report,
  setData,
  readOnly,
  keys,
  title = 'Tanda tangan',
}: {
  report: Report
  setData: (patch: Partial<ReportData>) => void
  readOnly: boolean
  keys: SignerKey[]
  title?: string
}) {
  const d = report.data
  const ttd = d.ttd ?? {}
  const set = (k: SignerKey, patch: { nama?: string; img?: string }) => {
    const cur = ttd[k] ?? { nama: k === 'supir' ? d.namaDriver : '', img: '', at: '' }
    setData({ ttd: { ...ttd, [k]: { ...cur, ...patch, at: patch.img ? new Date().toISOString() : cur.at } } })
  }
  return (
    <Section>
      <div className="flex flex-col">
        <span className="text-tag uppercase text-primary">{title}</span>
        <span className="text-body-sm text-on-surface-variant">Penerima, security, dan supir tangki wajib. Pengawas dan ABH dapat menandatangani nanti dari laporan.</span>
      </div>
      {SIGNERS.filter((s) => keys.includes(s.key)).map((s) => {
        const t = ttd[s.key]
        const nama = t?.nama || (s.key === 'supir' ? d.namaDriver : '')
        return (
          <div key={s.key} className="flex flex-col gap-space-xs border-t border-outline-variant/50 pt-space-sm first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-md font-semibold text-on-surface">{s.label}</span>
              {t?.img ? <Pill tone="success">Sudah tanda tangan</Pill> : <Pill tone={s.wajib ? 'error' : 'neutral'}>{s.wajib ? 'Wajib' : 'Bisa nanti'}</Pill>}
            </div>
            <Field label={`Nama ${s.label.toLowerCase()}`} htmlFor={`ttd-nama-${s.key}`}>
              <Input id={`ttd-nama-${s.key}`} autoComplete="off" disabled={readOnly && !!t?.img} value={nama} onChange={(e) => set(s.key, { nama: e.target.value })} />
            </Field>
            <SignaturePad label={s.label} value={t?.img ?? ''} disabled={readOnly && !!t?.img} onChange={(img) => set(s.key, { img, nama })} />
          </div>
        )
      })}
    </Section>
  )
}
