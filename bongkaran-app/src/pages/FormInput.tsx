import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Beaker, MapPin, Ruler, Send, Truck } from 'lucide-react'
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
import { formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'

const TABS = ['bongkaran', 'quality', 'quantity'] as const
type Tab = (typeof TABS)[number]

function isTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab)
}

export function FormInput() {
  const [params] = useSearchParams()
  const initial = params.get('tab')
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : 'bongkaran')
  const toast = useToast()

  const [produkId, setProdukId] = useState(produkList[0].id)
  const [volDo, setVolDo] = useState('8000')
  const [volReal, setVolReal] = useState('7992')
  const [densityCorr, setDensityCorr] = useState('748')
  const [tera, setTera] = useState('19,92')
  const [meterAwal, setMeterAwal] = useState('184220,50')
  const [meterAkhir, setMeterAkhir] = useState('184240,50')

  const produk = cariProduk(produkId)
  const bongkar = hitungBongkar(parseAngka(volDo), parseAngka(volReal))
  const density = hitungDensity(parseAngka(densityCorr), produk.densityMin, produk.densityMax)
  const kuantitas = hitungTera(parseAngka(tera), parseAngka(meterAwal), parseAngka(meterAkhir))

  const next = (to: Tab, message: string) => {
    toast(message)
    setTab(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col">
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
            <Input id="tanggal" type="datetime-local" defaultValue="2026-09-26T07:40" />
          </Field>

          <Field label="No. polisi mobil tangki" htmlFor="plat">
            <Input id="plat" placeholder="Contoh: L 9021 XZ" autoCapitalize="characters" autoComplete="off" />
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
              <Input id="volDo" numeric inputMode="decimal" suffix="L" value={volDo} onChange={(e) => setVolDo(e.target.value)} />
            </Field>
            <Field label="Volume realisasi" htmlFor="volReal">
              <Input
                id="volReal"
                numeric
                inputMode="decimal"
                suffix="L"
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
          <StatusBanner {...bongkar?.banner ?? IDLE} />
        </GlassCard>

        <GlassCard level={2} className="animate-entrance-4 flex flex-col gap-space-md p-space-md">
          <PhotoField label="Foto segel & surat jalan (DO)" />
          <Field label="Catatan" htmlFor="catatan">
            <Textarea id="catatan" placeholder="Catatan tambahan (opsional)" rows={3} />
          </Field>
        </GlassCard>

        <Button size="lg" className="animate-entrance-5 w-full" onClick={() => next('quality', 'Data bongkaran tersimpan')}>
          Simpan & lanjut ke Quality
          <ArrowRight aria-hidden="true" />
        </Button>
      </TabsContent>

      <TabsContent value="quality" className="flex flex-col gap-space-md">
        <ProductContext name={produk.name} hint={`Standar density ${produk.densityMin}–${produk.densityMax} kg/m³ @15°C`} />

        <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-md p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Suhu observasi" htmlFor="suhu">
              <Input id="suhu" numeric inputMode="decimal" suffix="°C" placeholder="28,5" />
            </Field>
            <Field label="Density observasi" htmlFor="densityObs">
              <Input id="densityObs" numeric inputMode="decimal" suffix="kg/m³" placeholder="742" />
            </Field>
          </div>

          <Field label="Density terkoreksi ASTM @15°C" htmlFor="densityCorr">
            <Input
              id="densityCorr"
              numeric
              inputMode="decimal"
              suffix="kg/m³"
              value={densityCorr}
              onChange={(e) => setDensityCorr(e.target.value)}
            />
          </Field>

          <StatusBanner {...density ?? IDLE} />

          <Field label="Petugas pengawas" htmlFor="pengawas">
            <Select defaultValue={pengawasList[0].id}>
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

        <Button size="lg" className="animate-entrance-4 w-full" onClick={() => next('quantity', 'Data quality tersimpan')}>
          Simpan & lanjut ke Quantity
          <ArrowRight aria-hidden="true" />
        </Button>
      </TabsContent>

      <TabsContent value="quantity" className="flex flex-col gap-space-md">
        <ProductContext name={produk.name} hint={`Toleransi tera bejana 20 L: ±${formatNumber(TOLERANSI_TERA_PERSEN, 1)}%`} />

        <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-md p-space-md">
          <Field label="Hasil tera bejana 20 L" htmlFor="tera">
            <Input id="tera" numeric inputMode="decimal" suffix="L" value={tera} onChange={(e) => setTera(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Meter pompa awal" htmlFor="meterAwal">
              <Input id="meterAwal" numeric inputMode="decimal" value={meterAwal} onChange={(e) => setMeterAwal(e.target.value)} />
            </Field>
            <Field label="Meter pompa akhir" htmlFor="meterAkhir">
              <Input id="meterAkhir" numeric inputMode="decimal" value={meterAkhir} onChange={(e) => setMeterAkhir(e.target.value)} />
            </Field>
          </div>

          <Ladder
            rows={[
              ['Keluar menurut meter', kuantitas ? formatLiter(kuantitas.meter, 2) : '—'],
              ['Terukur di bejana', kuantitas ? formatLiter(kuantitas.bejana, 2) : '—'],
            ]}
            total={['Selisih', kuantitas ? formatSigned(kuantitas.persen, 2, '%') : '—']}
          />
          <StatusBanner {...kuantitas?.banner ?? IDLE} />
        </GlassCard>

        <GlassCard level={2} className="animate-entrance-4 p-space-md">
          <PhotoField label="Foto hasil tera" />
        </GlassCard>

        <Button size="lg" className="animate-entrance-5 w-full" onClick={() => toast('Laporan Q&Q terkirim')}>
          <Send aria-hidden="true" />
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
