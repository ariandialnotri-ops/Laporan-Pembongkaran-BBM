import { useEffect, useState } from 'react'
import { Archive, Download, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ekspor } from '@/lib/ekspor'
import { useApp } from '@/lib/app-state'
import type { FotoArsip } from '@/lib/backend'
import { formatTanggalIso } from '@/lib/date'
import { cn } from '@/lib/utils'

const mb = (n: number) => `${(n / 1048576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`

/**
 * Pengingat cut-off foto (ABH/pengawas): foto bukti yang diunggah sebelum batas simpan dihapus
 * otomatis tanggal 5. Tanggal 1-4 (atau selama masih ada) foto itu dapat diunduh sebagai ZIP.
 */
export function ArsipFotoBanner({ className }: { className?: string }) {
  const app = useApp()
  const [daftar, setDaftar] = useState<FotoArsip[] | null>(null)
  const [proses, setProses] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const boleh = app.canManage && app.backend.mode === 'supabase'

  useEffect(() => {
    if (!boleh) return
    let hidup = true
    app.backend
      .fotoArsip()
      .then((d) => hidup && setDaftar(d))
      .catch(() => hidup && setDaftar([]))
    return () => {
      hidup = false
    }
  }, [boleh, app.backend, app.spbuId])

  if (!boleh || !daftar?.length) return null
  const total = daftar.reduce((n, f) => n + f.ukuran, 0)
  const batas = daftar[0].batas.slice(0, 10)
  const hari = new Date().getDate()
  const kapan = hari < 5 ? `tanggal 5 bulan ini pukul 01.00 WIB` : 'pada cut-off berikutnya'

  const unduh = async () => {
    setError(null)
    setProses('Menyiapkan…')
    try {
      await ekspor('Membuat arsip ZIP foto', async (lapor) => {
        lapor(4, 'Memuat modul ZIP')
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        let selesai = 0
        let hilang = 0
        const antre = [...daftar]
        // Empat unduhan sekaligus.
        await Promise.all(
          Array.from({ length: 4 }, async () => {
            for (let f = antre.shift(); f; f = antre.shift()) {
              const blob = await app.backend.unduhFoto(f.path)
              if (blob) zip.file(f.path, blob)
              else hilang++
              selesai++
              setProses(`Mengunduh ${selesai}/${daftar.length} foto`)
              lapor(5 + (80 * selesai) / Math.max(1, daftar.length), `Mengunduh foto ${selesai}/${daftar.length}`)
            }
          }),
        )
        setProses('Membuat ZIP…')
        const isi = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => lapor(85 + m.percent * 0.12, 'Menyusun file ZIP'))
        const url = URL.createObjectURL(isi)
        const a = document.createElement('a')
        a.href = url
        a.download = `Arsip_Foto_${(app.spbu?.kode || app.spbu?.nama || 'SPBU').replace(/[^a-zA-Z0-9]/g, '')}_sebelum_${batas}.zip`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        if (hilang) setError(`${hilang} foto sudah tidak ada di server dan tidak ikut diarsipkan.`)
      })
    } catch (e) {
      setError(`Gagal membuat arsip: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProses(null)
    }
  }

  return (
    <div className={cn('flex flex-col gap-space-sm rounded-lg border border-error/30 bg-error-container/60 p-space-md', className)} role="status">
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error text-on-error">
          <Archive className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-body-md font-bold text-on-error-container">
            {daftar.length.toLocaleString('id-ID')} foto ({mb(total)}) akan dihapus {kapan}
          </span>
          <span className="text-body-sm text-on-error-container">
            Foto bukti yang diunggah sebelum {formatTanggalIso(batas)}. Data laporan tetap tersimpan; unduh arsipnya bila foto masih diperlukan.
          </span>
        </div>
      </div>
      <Button variant="danger" size="pill" className="self-start" disabled={!!proses} onClick={() => void unduh()}>
        {proses ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
        {proses ?? 'Unduh arsip ZIP'}
      </Button>
      {error && <span className="text-body-sm text-on-error-container">{error}</span>}
    </div>
  )
}
