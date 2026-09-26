/**
 * Level 0 of the elevation scale: blurred colour orbs drifting behind the
 * glass so the frosted surfaces have something to refract. Purely decorative,
 * so it is inert to pointers and hidden from assistive tech.
 *
 * Semua orb memakai keluarga biru dengan opasitas rendah. Orb mint/cyan
 * (tertiary-fixed, secondary-container) diganti karena warna hijau terangnya
 * melelahkan mata di layar HP.
 *
 * Orb sengaja diam (tanpa animasi): animasi orb besar yang di-blur membuat
 * semua kartu kaca di atasnya dihitung ulang terus dan memberatkan HP.
 */
export function AmbientOrbs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-12 -top-16 size-80 rounded-full bg-primary-fixed opacity-35 blur-3xl" />
      <div className="absolute -right-20 top-96 size-[22rem] rounded-full bg-surface-container-highest opacity-40 blur-3xl" />
      <div className="absolute bottom-20 left-1/4 size-72 rounded-full bg-primary-fixed-dim opacity-20 blur-3xl" />
    </div>
  )
}
