import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { BadgeCheck, CloudUpload, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { eksporStore } from '@/lib/ekspor'
import { prosesStore, type KeadaanProses } from '@/lib/proses'
import { cn } from '@/lib/utils'

/** Lembar bawah global: "Memproses…" selama data dikirim / diunggah / dihapus, lalu "Berhasil!". */
export function LembarProses() {
  const k = useSyncExternalStore(prosesStore.subscribe, prosesStore.get)
  // Saat lembar ekspor tampil, simpan otomatis sebelum ekspor tidak memunculkan lembar kedua.
  const sedangEkspor = useSyncExternalStore(eksporStore.subscribe, () => eksporStore.get().fase !== 'diam')
  const { pathname } = useLocation()
  // Halaman Terkirim sudah menjadi tanda berhasil; jangan tumpuk dengan lembar sukses.
  const keTerkirim = k.fase === 'sukses' && pathname === '/terkirim'
  useEffect(() => {
    if (keTerkirim) prosesStore.tutup()
  }, [keTerkirim])

  // Sukses tertutup sendiri: unggah foto saja lebih cepat, aksi lain menunggu tombol atau 2,5 detik.
  const hanyaUnggah = k.jenis.size === 1 && k.jenis.has('unggah')
  useEffect(() => {
    if (k.fase !== 'sukses') return
    const t = setTimeout(prosesStore.tutup, hanyaUnggah ? 1300 : 2500)
    return () => clearTimeout(t)
  }, [k.fase, hanyaUnggah])

  // Proses singkat (<0,4 detik) tidak perlu menampilkan animasi pesawat: langsung sukses.
  const buka = !sedangEkspor && ((k.fase === 'proses' && k.tampil) || (k.fase === 'sukses' && !keTerkirim))
  const teks = teksProses(k)

  return (
    <Dialog.Root open={buka} onOpenChange={(o) => !o && k.fase === 'sukses' && prosesStore.tutup()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[85] bg-on-surface/30" />
        <Dialog.Content
          onEscapeKeyDown={(e) => k.fase === 'proses' && e.preventDefault()}
          onPointerDownOutside={(e) => k.fase === 'proses' && e.preventDefault()}
          className="sheet-content fixed inset-x-0 bottom-0 z-[86] mx-auto flex w-full max-w-xl flex-col items-center rounded-t-3xl px-space-lg pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-2 text-center focus:outline-none"
        >
          <div aria-hidden="true" className="mb-space-lg h-1.5 w-10 rounded-full bg-outline-variant" />
          {k.fase === 'proses' ? (
            <span aria-hidden="true" className={cn('ikon-proses mb-space-md flex size-24 items-center justify-center', k.aktif === 'hapus' ? 'text-red-500' : 'text-emerald-500')}>
              {k.aktif === 'unggah' ? <CloudUpload className="size-20" strokeWidth={1.6} /> : k.aktif === 'hapus' ? <Trash2 className="size-16" strokeWidth={1.6} /> : <Send className="size-20 -rotate-12" strokeWidth={1.6} fill="currentColor" fillOpacity={0.2} />}
            </span>
          ) : (
            <span aria-hidden="true" className="ikon-sukses mb-space-md flex size-24 items-center justify-center text-emerald-500">
              <BadgeCheck className="size-24" strokeWidth={1.5} fill="currentColor" stroke="white" />
            </span>
          )}
          <Dialog.Title className="text-headline-md font-bold text-on-surface">{teks.judul}</Dialog.Title>
          <Dialog.Description className="mt-1 text-body-md text-on-surface-variant">{teks.detail}</Dialog.Description>
          {k.fase === 'proses' ? (
            <div aria-hidden="true" className="mt-space-md h-1.5 w-40 overflow-hidden rounded-full bg-surface-container-high">
              <div className="garis-proses h-full w-1/3 rounded-full bg-emerald-500" />
            </div>
          ) : (
            <Button className="mt-space-md min-w-36 rounded-full bg-on-surface text-surface hover:bg-on-surface/90" onClick={prosesStore.tutup} autoFocus>
              Oke, mengerti
            </Button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function teksProses(k: KeadaanProses) {
  if (k.fase === 'proses') {
    if (k.aktif === 'unggah') return { judul: 'Mengunggah…', detail: k.unggah ? `${k.unggah} file terunggah, melanjutkan file berikutnya` : 'Foto/video sedang diunggah ke server' }
    if (k.aktif === 'hapus') return { judul: 'Menghapus…', detail: 'Data sedang dihapus dari server' }
    return { judul: 'Memproses…', detail: 'Data sedang dikirim, jangan tutup aplikasi' }
  }
  if (k.jenis.has('hapus') && !k.jenis.has('simpan')) return { judul: 'Berhasil dihapus', detail: 'Data sudah dihapus dari riwayat' }
  if (k.jenis.has('simpan')) return { judul: 'Berhasil!', detail: k.unggah ? `Data dan ${k.unggah} file lampiran tersimpan` : 'Data berhasil disimpan' }
  return { judul: 'Unggahan berhasil', detail: `${k.unggah} file berhasil diunggah` }
}

