import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Beaker, LoaderCircle, MapPin, Ruler, Send, Truck, TriangleAlert } from 'lucide-react'
import { PhotoField } from '@/components/bongkaran/photo-field'
import { StatusBanner, type BannerTone } from '@/components/bongkaran/status-banner'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SpringValue } from '@/components/ui/spring-value'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import {
  cariProduk,
  currentUser,
  pengawasList,
  produkList,
  TOLERANSI_BONGKAR_PERSEN,
  TOLERANSI_TERA_PERSEN,
} from '@/data/mock'
import { createBongkaran, isLive, updateBongkaran, uploadBukti } from '@/lib/api'
import { toDatetimeLocal } from '@/lib/date'
import { formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { nilaiQQ } from '@/lib/qq'

const TABS = ['bongkaran', 'quality', 'quantity'] as const
type Tab = (typeof TABS)[number]

function isTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab)
}

const pesanGalat = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan')

export function FormInput() {
  const [params] = useSearchParams()
  const initial = params.get('tab')
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : 'bongkaran')
  const toast = useToast()

  // The record being filled. Created on the first save, then updated per step.
  const [recordId, setRecordId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  const [waktu, setWaktu] = useState(() => toDatetimeLocal(new Date()))
  const [plat, setPlat] = useState('')
  const [produkId, setProdukId] = useState(produkList[0].id)
  const [volDo, setVolDo] = useState('')
  const [volReal, setVolReal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [fotoDo, setFotoDo] = useState<File | null>(null)

  const [suhu, setSuhu] = useState('')
  const [densityObs, setDensityObs] = useState('')
  const [densityCorr, setDensityCorr] = useState('')
  const [pengawas, setPengawas] = useState(pengawasList[0].id)

  const [tera, setTera] = useState('')
  const [meterAwal, setMeterAwal] = useState('')
  const [meterAkhir, setMeterAkhir] = useState('')
  const [fotoTera, setFotoTera] = useState<File | null>(null)

  const produk = cariProduk(produkId)
  const nDo = parseAngka(volDo)
  const nReal = parseAngka(volReal)
  const nDensity = parseAngka(densityCorr)
  const nTera = parseAngka(tera)
  const nAwal = parseAngka(meterAwal)
  const nAkhir = parseAngka(meterAkhir)

  const bongkar = hitungBongkar(nDo, nReal)
  const density = hitungDensity(nDensity, produk.densityMin, produk.densityMax)
  const kuantitas = hitungTera(nTera, nAwal, nAkhir)

  const pindah = (to: Tab) => {
    setTab(to)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const run = async (task: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(pesanGalat(e))
    } finally {
      setSaving(false)
    }
  }

  const simpanBongkaran = () => {
    if (!plat.trim()) return setError('Isi nomor polisi mobil tangki.')
    if (nDo === null || nDo <= 0 || nReal === null || nReal < 0) return setError('Isi volume DO dan volume realisasi.')
    if (!isLive) {
      toast('Mode contoh: data tidak disimpan')
      return pindah('quality')
    }
    return run(async () => {
      const foto_do_path = fotoDo ? await uploadBukti(fotoDo, 'segel-do') : null
      const row = {
        spbu: currentUser.spbu,
        waktu_bongkar: new Date(waktu).toISOString(),
        no_polisi: plat.trim().toUpperCase(),
        produk: produk.name,
        volume_do: nDo,
        volume_realisasi: nReal,
        catatan: catatan.trim() || null,
      }
      if (recordId) {
        await updateBongkaran(recordId, foto_do_path ? { ...row, foto_do_path } : row)
      } else {
        setRecordId(await createBongkaran({ ...row, foto_do_path }))
      }
      toast('Data bongkaran tersimpan')
      pindah('quality')
    })
  }

  const simpanQuality = () => {
    if (!recordId && isLive) return setError('Simpan tahap Bongkaran lebih dulu.')
    if (nDensity === null) return setError('Isi density terkoreksi.')
    if (!isLive) {
      toast('Mode contoh: data tidak disimpan')
      return pindah('quantity')
    }
    return run(async () => {
      const p = pengawasList.find((x) => x.id === pengawas)
      await updateBongkaran(recordId!, {
        suhu_observasi: parseAngka(suhu),
        density_observasi: parseAngka(densityObs),
        density_koreksi: nDensity,
        pengawas: p ? `${p.name} – ${p.shift}` : null,
        tahap: 'quality',
      })
      toast('Data quality tersimpan')
      pindah('quantity')
    })
  }

  const kirim = () => {
    if (!recordId && isLive) return setError('Simpan tahap Bongkaran dan Quality lebih dulu.')
    if (nTera === null || nAwal === null || nAkhir === null || nAkhir <= nAwal) {
      return setError('Isi hasil tera dan angka meter (akhir harus lebih besar dari awal).')
    }
    if (!isLive) return toast('Mode contoh: data tidak disimpan')
    return run(async () => {
      const foto_tera_path = fotoTera ? await uploadBukti(fotoTera, 'tera') : null
      const qq = nilaiQQ({
        produk: produk.name,
        volume_do: nDo ?? 0,
        volume_realisasi: nReal ?? 0,
        density_koreksi: nDensity,
        tera_bejana: nTera,
        meter_awal: nAwal,
        meter_akhir: nAkhir,
      })
      await updateBongkaran(recordId!, {
        tera_bejana: nTera,
        meter_awal: nAwal,
        meter_akhir: nAkhir,
        ...(foto_tera_path ? { foto_tera_path } : {}),
        tahap: 'selesai',
        qq_status: qq.status,
        qq_catatan: qq.catatan,
      })
      toast(qq.status === 'sesuai' ? 'Laporan Q&Q terkirim · Sesuai' : `Laporan Q&Q terkirim · ${qq.catatan}`)
      reset()
    })
  }

  const reset = () => {
    setRecordId(null)
    setWaktu(toDatetimeLocal(new Date()))
    setPlat('')
    setVolDo('')
    setVolReal('')
    setCatatan('')
    setFotoDo(null)
    setSuhu('')
    setDensityObs('')
    setDensityCorr('')
    setTera('')
    setMeterAwal('')
    setMeterAkhir('')
    setFotoTera(null)
    setFormKey((k) => k + 1)
    pindah('bongkaran')
  }

  const errorBox = error ? (
    <GlassCard level={1} role="alert" className="flex items-start gap-space-sm bg-error-container/70 p-space-sm">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
      <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
    </GlassCard>
  ) : null

  const spinner = saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null

  return (
    <Tabs key={formKey} value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col">
      <TabsList count={TABS.length} index={TABS.indexOf(tab)} aria-label="Bagian formulir" className="animate-entrance-1">
        <TabsTrigger value="bongkaran">
          <Truck aria-hidden="true" />
          Bongkaran
        </TabsTrigger>
        <TabsTrigger value="quality">
          <Beaker aria-hidden="true" />
          Quality
        </TabsTrigger>
        <TabsTrigger value="quantity">
          <Ruler aria-hidden="true" />
          Quantity
        </TabsTrigger>
      </TabsList>

      {!isLive ? (
        <Pill tone="neutral" className="mx-auto mt-space-sm">
          Mode contoh · Supabase belum tersambung
        </Pill>
      ) : recordId ? (
        <Pill tone="cyan" className="mx-auto mt-space-sm">
          Draf tersimpan · {plat.toUpperCase()}
        </Pill>
      ) : null}

      <TabsContent value="bongkaran" className="flex flex-col gap-space-md">
        <GlassCard level={2} className="animate-entrance-2 flex items-center gap-space-sm p-space-md">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm"
          >
            <MapPin className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">SPBU tujuan</span>
            <span className="truncate text-headline-md font-bold text-on-surface">{currentUser.spbu}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{currentUser.spbuAddress}</span>
          </div>
        </GlassCard>

        <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-md p-space-md">
          <Field label="Tanggal & waktu bongkar" htmlFor="tanggal">
            <Input id="tanggal" type="datetime-local" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
          </Field>

          <Field label="No. polisi mobil tangki" htmlFor="plat">
            <Input
              id="plat"
              placeholder="Contoh: L 9021 XZ"
              autoCapitalize="characters"
              autoComplete="off"
              value={plat}
              onChange={(e) => setPlat(e.target.value)}
            />
          </Field>

          <Field label="Produk" htmlFor="produk">
            <Select value={produkId} onValueChange={setProdukId}>
              <SelectTrigger id="produk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {produkList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Volume DO" htmlFor="volDo">
              <Input
                id="volDo"
                numeric
                inputMode="decimal"
                suffix="L"
                placeholder="8000"
                value={volDo}
                onChange={(e) => setVolDo(e.target.value)}
              />
            </Field>
            <Field label="Volume realisasi" htmlFor="volReal">
              <Input
                id="volReal"
                numeric
                inputMode="decimal"
                suffix="L"
                placeholder="7992"
                value={volReal}
                onChange={(e) => setVolReal(e.target.value)}
              />
            </Field>
          </div>

          <Ladder
            rows={[
              ['Volume DO', bongkar ? formatLiter(bongkar.do) : '—'],
              ['Volume realisasi', bongkar ? formatLiter(bongkar.real) : '—'],
            ]}
            total={['Selisih', bongkar ? `${formatSigned(bongkar.selisih, 0, ' L')} (${formatSigned(bongkar.persen, 2, '%')})` : '—']}
          />
          <StatusBanner {...(bongkar?.banner ?? IDLE)} />
        </GlassCard>

        <GlassCard level={2} className="animate-entrance-4 flex flex-col gap-space-md p-space-md">
          <PhotoField label="Foto segel & surat jalan (DO)" onFileChange={setFotoDo} />
          <Field label="Catatan" htmlFor="catatan">
            <Textarea
              id="catatan"
              placeholder="Catatan tambahan (opsional)"
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </Field>
        </GlassCard>

        {errorBox}
        <Button size="lg" className="animate-entrance-5 w-full" disabled={saving} onClick={simpanBongkaran}>
          {spinner}
          Simpan & lanjut ke Quality
          {!saving && <ArrowRight aria-hidden="true" />}
        </Button>
      </TabsContent>

      <TabsContent value="quality" className="flex flex-col gap-space-md">
        <ProductContext name={produk.name} hint={`Standar density ${produk.densityMin}–${produk.densityMax} kg/m³ @15°C`} />

        <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-md p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Suhu observasi" htmlFor="suhu">
              <Input id="suhu" numeric inputMode="decimal" suffix="°C" placeholder="28,5" value={suhu} onChange={(e) => setSuhu(e.target.value)} />
            </Field>
            <Field label="Density observasi" htmlFor="densityObs">
              <Input
                id="densityObs"
                numeric
                inputMode="decimal"
                suffix="kg/m³"
                placeholder="742"
                value={densityObs}
                onChange={(e) => setDensityObs(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Density terkoreksi ASTM @15°C" htmlFor="densityCorr">
            <Input
              id="densityCorr"
              numeric
              inputMode="decimal"
              suffix="kg/m³"
              placeholder="748"
              value={densityCorr}
              onChange={(e) => setDensityCorr(e.target.value)}
            />
          </Field>

          <StatusBanner {...(density ?? IDLE)} />

          <Field label="Petugas pengawas" htmlFor="pengawas">
            <Select value={pengawas} onValueChange={setPengawas}>
              <SelectTrigger id="pengawas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pengawasList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} – {p.shift}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </GlassCard>

        {errorBox}
        <Button size="lg" className="animate-entrance-4 w-full" disabled={saving} onClick={simpanQuality}>
          {spinner}
          Simpan & lanjut ke Quantity
          {!saving && <ArrowRight aria-hidden="true" />}
        </Button>
      </TabsContent>

      <TabsContent value="quantity" className="flex flex-col gap-space-md">
        <ProductContext name={produk.name} hint={`Toleransi tera bejana 20 L: ±${formatNumber(TOLERANSI_TERA_PERSEN, 1)}%`} />

        <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-md p-space-md">
          <Field label="Hasil tera bejana 20 L" htmlFor="tera">
            <Input id="tera" numeric inputMode="decimal" suffix="L" placeholder="19,92" value={tera} onChange={(e) => setTera(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Meter pompa awal" htmlFor="meterAwal">
              <Input
                id="meterAwal"
                numeric
                inputMode="decimal"
                placeholder="184220,50"
                value={meterAwal}
                onChange={(e) => setMeterAwal(e.target.value)}
              />
            </Field>
            <Field label="Meter pompa akhir" htmlFor="meterAkhir">
              <Input
                id="meterAkhir"
                numeric
                inputMode="decimal"
                placeholder="184240,50"
                value={meterAkhir}
                onChange={(e) => setMeterAkhir(e.target.value)}
              />
            </Field>
          </div>

          <Ladder
            rows={[
              ['Keluar menurut meter', kuantitas ? formatLiter(kuantitas.meter, 2) : '—'],
              ['Terukur di bejana', kuantitas ? formatLiter(kuantitas.bejana, 2) : '—'],
            ]}
            total={['Selisih', kuantitas ? formatSigned(kuantitas.persen, 2, '%') : '—']}
          />
          <StatusBanner {...(kuantitas?.banner ?? IDLE)} />
        </GlassCard>

        <GlassCard level={2} className="animate-entrance-4 p-space-md">
          <PhotoField label="Foto hasil tera" onFileChange={setFotoTera} />
        </GlassCard>

        {errorBox}
        <Button size="lg" className="animate-entrance-5 w-full" disabled={saving} onClick={kirim}>
          {spinner ?? <Send aria-hidden="true" />}
          Kirim laporan Q&Q
        </Button>
      </TabsContent>
    </Tabs>
  )
}

const IDLE = { tone: 'idle' as BannerTone, title: 'Lengkapi angka untuk melihat hasil' }

function hitungBongkar(vDo: number | null, vReal: number | null) {
  if (vDo === null || vReal === null || vDo <= 0) return null
  const selisih = vReal - vDo
  const persen = (selisih / vDo) * 100
  const dalam = Math.abs(persen) <= TOLERANSI_BONGKAR_PERSEN
  return {
    do: vDo,
    real: vReal,
    selisih,
    persen,
    banner: {
      tone: (dalam ? 'success' : 'error') as BannerTone,
      title: dalam ? 'Selisih dalam toleransi' : 'Selisih melebihi toleransi',
      detail: `Batas ±${formatNumber(TOLERANSI_BONGKAR_PERSEN, 1)}% • ${formatSigned(persen, 2, '%')}`,
    },
  }
}

function hitungDensity(value: number | null, min: number, max: number) {
  if (value === null) return null
  const sesuai = value >= min && value <= max
  return {
    tone: (sesuai ? 'success' : 'error') as BannerTone,
    title: sesuai ? 'Density sesuai standar' : 'Density di luar standar',
    detail: `${formatNumber(value, 1)} kg/m³ • standar ${min}–${max}`,
  }
}

function hitungTera(bejana: number | null, awal: number | null, akhir: number | null) {
  if (bejana === null || awal === null || akhir === null || akhir <= awal) return null
  const meter = akhir - awal
  const persen = ((bejana - meter) / meter) * 100
  const dalam = Math.abs(persen) <= TOLERANSI_TERA_PERSEN
  return {
    meter,
    bejana,
    persen,
    banner: {
      tone: (dalam ? 'success' : 'error') as BannerTone,
      title: dalam ? 'Dalam toleransi tera' : 'Di luar toleransi tera',
      detail: `Selisih ${formatSigned(persen, 2, '%')} • batas ±${formatNumber(TOLERANSI_TERA_PERSEN, 1)}%`,
    },
  }
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function ProductContext({ name, hint }: { name: string; hint: string }) {
  return (
    <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-xs p-space-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-tag uppercase text-primary">Produk</span>
        <Pill tone="cyan">Dari data bongkaran</Pill>
      </div>
      <span className="text-headline-md font-bold text-on-surface">{name}</span>
      <span className="text-body-sm text-on-surface-variant">{hint}</span>
    </GlassCard>
  )
}

/** Calculation ladder like the live rekonsiliasi in Tepat Setoran. */
function Ladder({ rows, total }: { rows: [string, string][]; total: [string, string] }) {
  return (
    <dl className="inset-field flex flex-col gap-1 rounded-md p-space-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <dt className="text-body-sm text-on-surface-variant">{label}</dt>
          <dd className="tabular text-numeric-sm text-on-surface">{value}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-outline-variant/50 pt-space-xs">
        <dt className="text-body-sm font-bold text-on-surface">{total[0]}</dt>
        <dd>
          <SpringValue className="tabular inline-block text-numeric-md font-bold text-primary">{total[1]}</SpringValue>
        </dd>
      </div>
    </dl>
  )
}
