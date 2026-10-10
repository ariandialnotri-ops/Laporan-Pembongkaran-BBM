import { useState } from 'react'
import { Cylinder, Thermometer } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { StatusBanner } from '@/components/bongkaran/status-banner'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SpringValue } from '@/components/ui/spring-value'
import { density15, METHOD_LABEL, TABLE53_COVERAGE } from '@/lib/density'
import { formatDensity, formatNumber } from '@/lib/format'
import { useApp } from '@/lib/app-state'
import { getTank, TANKS, volumeFromLevel } from '@/lib/tank'

export function Kalkulator() {
  // Berlangganan state aplikasi agar ikut memperbarui saat database tangki SPBU selesai dimuat / SPBU diganti.
  useApp()
  const [obs, setObs] = useState('')
  const [suhu, setSuhu] = useState('')
  const [pilihan, setTankId] = useState('')
  // Database tangki SPBU dimuat setelah halaman terbuka: pakai tangki pertama sampai dipilih.
  const tankId = getTank(pilihan)?.id ?? TANKS[0]?.id ?? ''
  const [level, setLevel] = useState('')
  const d15 = density15(obs, suhu)
  const vol = volumeFromLevel(tankId, level)
  const tank = getTank(tankId)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex items-center gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Thermometer className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-tag uppercase text-primary">Tabel ASTM 53</span>
            <span className="text-headline-md font-bold text-on-surface">Density at 15°C</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Density observasi" htmlFor="k-obs">
            <Input id="k-obs" numeric inputMode="decimal" placeholder="0,7450" value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
          <Field label="Suhu observasi" htmlFor="k-suhu">
            <Input id="k-suhu" numeric inputMode="decimal" suffix="°C" placeholder="30,0" value={suhu} onChange={(e) => setSuhu(e.target.value)} />
          </Field>
        </div>
        <div className="inset-field flex items-end justify-between gap-2 rounded-md p-space-sm">
          <span className="text-body-sm font-bold text-on-surface">Density @15°C</span>
          <SpringValue className="tabular inline-block text-numeric-lg font-bold text-primary">{d15 ? formatDensity(d15.value) : '-'}</SpringValue>
        </div>
        <StatusBanner
          {...(d15
            ? { tone: d15.method === 'table' ? 'success' : 'idle', title: METHOD_LABEL[d15.method], detail: 'Interpolasi linear antar baris & kolom tabel' }
            : { tone: 'idle', title: obs && suhu ? 'Di luar jangkauan perhitungan' : 'Isi density & suhu (0,7450 atau 745)' })}
        />
        <span className="text-body-sm text-on-surface-variant">Cakupan tabel: {TABLE53_COVERAGE}.</span>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <div className="flex items-center gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Cylinder className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-tag uppercase text-primary">Tabel kalibrasi tangki</span>
            <span className="text-headline-md font-bold text-on-surface">Volume tangki pendam</span>
          </div>
        </div>
        <Field label="Tangki" htmlFor="k-tangki">
          <Select value={tankId} onValueChange={setTankId}>
            <SelectTrigger id="k-tangki">
              <SelectValue />
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
        <Field label="Ketinggian minyak (deepstick / ATG)" htmlFor="k-level">
          <Input id="k-level" numeric inputMode="decimal" suffix="mm" placeholder="1200" value={level} onChange={(e) => setLevel(e.target.value)} />
        </Field>
        <div className="inset-field flex items-end justify-between gap-2 rounded-md p-space-sm">
          <span className="text-body-sm font-bold text-on-surface">Volume</span>
          <SpringValue className="tabular inline-block text-numeric-lg font-bold text-primary">
            {vol?.volume !== undefined ? `${formatNumber(vol.volume, 1)} L` : '-'}
          </SpringValue>
        </div>
        <StatusBanner
          {...(vol?.error !== undefined
            ? { tone: 'error', title: vol.error }
            : vol?.anomaly
              ? { tone: 'error', title: 'Data tabel tidak naik berurutan di sekitar ketinggian ini', detail: 'Cek tabel kalibrasi asli' }
              : tank
                ? { tone: 'idle', title: `Kapasitas ${formatNumber(tank.capacity)} L`, detail: `Tabel ${formatNumber(tank.startMm)}–${formatNumber(tank.maxMm)} mm (${formatNumber(tank.rows)} baris), kalibrasi ${tank.tanggalKalibrasi || '-'}` }
                : { tone: 'idle', title: 'Belum ada tangki di database SPBU ini' })}
        />
      </GlassCard>
    </div>
  )
}
