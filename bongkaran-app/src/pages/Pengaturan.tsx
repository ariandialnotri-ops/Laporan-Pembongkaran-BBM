import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { TABLE53_CORRECTIONS, TABLE53_COVERAGE } from '@/lib/density'
import { formatNumber, parseAngka } from '@/lib/format'
import { blobToDataUrl, compressImage } from '@/lib/image'
import type { Rules } from '@/lib/sop'
import { TANKS } from '@/lib/tank'

export function Pengaturan() {
  const app = useApp()
  const { hash } = useLocation()
  const logoRef = useRef<HTMLInputElement>(null)
  const s = app.settings
  const readOnly = !app.canManage

  useEffect(() => {
    if (hash && app.loaded) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash, app.loaded])

  const setRule = (key: keyof Rules, n: number) => app.updateSettings({ rules: { ...s.rules, [key]: n } })
  const onLogo = async (file?: File) => {
    if (file) app.updateSettings({ logoDataUrl: await blobToDataUrl(await compressImage(file, { maxSize: 400, quality: 0.9 })) })
  }

  if (!app.loaded) return <Loading />

  return (
    <div className="flex flex-col gap-space-md">
      {readOnly && (
        <GlassCard level={1} className="animate-entrance-1 p-space-md text-center text-body-sm text-on-surface-variant">
          Pengaturan hanya dapat diubah oleh pengawas.
        </GlassCard>
      )}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-space-md">
        <section aria-labelledby="identitas" className="animate-entrance-1 flex flex-col gap-space-sm">
          <SectionHeader id="identitas" title="Identitas SPBU" />
          <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
            <Field label="Nama SPBU" htmlFor="set-nama">
              <Input id="set-nama" value={s.namaSpbu} onChange={(e) => app.updateSettings({ namaSpbu: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-space-sm">
              <Field label="Kode / nomor SPBU" htmlFor="set-kode">
                <Input id="set-kode" value={s.kodeSpbu} onChange={(e) => app.updateSettings({ kodeSpbu: e.target.value })} />
              </Field>
              <Field label="Alamat" htmlFor="set-alamat">
                <Input id="set-alamat" value={s.alamatSpbu} onChange={(e) => app.updateSettings({ alamatSpbu: e.target.value })} />
              </Field>
              <Field label="Petugas penerima (default)" htmlFor="set-petugas">
                <Input id="set-petugas" value={s.namaPetugasDefault} onChange={(e) => app.updateSettings({ namaPetugasDefault: e.target.value })} />
              </Field>
              <Field label="Pengawas (default)" htmlFor="set-pengawas">
                <Input id="set-pengawas" value={s.namaPengawasDefault} onChange={(e) => app.updateSettings({ namaPengawasDefault: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-center gap-space-sm">
              {s.logoDataUrl ? (
                <span className="glass-1 flex h-12 items-center rounded-md px-space-sm">
                  <img src={s.logoDataUrl} alt="Logo Berita Acara" className="h-8" />
                </span>
              ) : null}
              <Button variant="glass" size="pill" onClick={() => logoRef.current?.click()}>
                <ImagePlus aria-hidden="true" />
                Logo Berita Acara
              </Button>
              {s.logoDataUrl && (
                <Button variant="ghost" size="icon" aria-label="Hapus logo" onClick={() => app.updateSettings({ logoDataUrl: '' })}>
                  <X aria-hidden="true" />
                </Button>
              )}
              <input ref={logoRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onLogo(e.target.files?.[0])} />
            </div>
          </GlassCard>
        </section>

        <section aria-labelledby="aturan" className="animate-entrance-2 flex flex-col gap-space-sm">
          <SectionHeader id="aturan" title="Aturan Pemeriksaan" />
          <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
            <div className="grid grid-cols-2 gap-space-sm">
              <Field label="Toleransi density 15°C" htmlFor="set-dens" hint="Di atasnya bongkar dihentikan">
                <RuleInput id="set-dens" value={s.rules.densityTolerance} onChange={(n) => setRule('densityTolerance', n)} />
              </Field>
              <Field label="Batas kurang vs tera" htmlFor="set-tera" hint="Di atasnya butuh izin">
                <RuleInput id="set-tera" suffix="mm" value={s.rules.teraToleranceMm} onChange={(n) => setRule('teraToleranceMm', n)} />
              </Field>
              <Field label="Tunggu sebelum baca ATG" htmlFor="set-atg">
                <RuleInput id="set-atg" suffix="menit" value={s.rules.atgSettleMinutes} onChange={(n) => setRule('atgSettleMinutes', n)} />
              </Field>
              <Field label="Liter per 1 DO" htmlFor="set-do">
                <RuleInput id="set-do" suffix="L" value={s.rules.literPerDO} onChange={(n) => setRule('literPerDO', n)} />
              </Field>
            </div>
            <Field label="PIN penanggung jawab (opsional)" htmlFor="set-pin" hint="Bila diisi, izin lanjut saat selisih tera di luar batas wajib memasukkan PIN ini.">
              <Input id="set-pin" type="password" inputMode="numeric" value={s.pinPenanggungJawab} onChange={(e) => app.updateSettings({ pinPenanggungJawab: e.target.value })} />
            </Field>
          </GlassCard>
        </section>
      </fieldset>

      <section aria-labelledby="data-acuan" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="data-acuan" title="Data Acuan" />
        <GlassCard level={2} className="flex flex-col gap-space-xs p-space-md">
          <span className="text-tag uppercase text-primary">Tabel ASTM 53 · Density reduction to 15°C</span>
          <span className="text-body-sm text-on-surface">Cakupan densitas observasi {TABLE53_COVERAGE}. Di luar cakupan dipakai rumus ASTM D1250 Tabel 53B.</span>
          {TABLE53_CORRECTIONS.length > 0 && (
            <span className="text-body-sm text-on-surface-variant">
              {TABLE53_CORRECTIONS.length} sel salah ketik pada file acuan telah dikoreksi ({[...new Set(TABLE53_CORRECTIONS.map((c) => c.sheet))].join(', ')}).
            </span>
          )}
        </GlassCard>
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          {TANKS.map((t) => (
            <div key={t.id} className="flex min-h-14 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-semibold text-on-surface">{t.label}</span>
                <span className="tabular text-numeric-sm text-on-surface-variant">
                  {t.startMm}–{formatNumber(t.maxMm)} mm • {formatNumber(t.capacity)} L • kalibrasi {t.tanggalKalibrasi || '-'}
                </span>
              </div>
              {t.anomalyLevels.length > 0 ? <Pill tone="error">{t.anomalyLevels.length} titik janggal</Pill> : <Pill tone="primary">OK</Pill>}
            </div>
          ))}
        </GlassCard>
      </section>
    </div>
  )
}

/** Angka aturan: teks disimpan lokal agar ketikan setengah jadi ("0,00") tidak terpotong. */
function RuleInput({ id, value, suffix, onChange }: { id: string; value: number; suffix?: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => String(value).replace('.', ','))
  return (
    <Input
      id={id}
      numeric
      inputMode="decimal"
      suffix={suffix}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseAngka(e.target.value)
        if (n !== null && n > 0) onChange(n)
      }}
    />
  )
}
