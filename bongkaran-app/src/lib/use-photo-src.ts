import { useEffect, useState } from 'react'
import { useApp } from '@/lib/app-state'
import type { Photo } from '@/lib/sop'

/** URL tampilan foto: dataURL (mode lokal / baru diambil) atau signed URL Supabase. */
export function usePhotoSrc(photos: Photo[]) {
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
