/**
 * Level 0 of the elevation scale: blurred colour orbs drifting behind the
 * glass so the frosted surfaces have something to refract. Purely decorative,
 * so it is inert to pointers and hidden from assistive tech.
 */
export function AmbientOrbs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="orb-float-1 absolute -left-12 -top-16 size-80 rounded-full bg-primary-fixed opacity-40 blur-3xl" />
      <div className="orb-float-2 absolute -right-20 top-96 size-[22rem] rounded-full bg-secondary-container opacity-35 blur-3xl" />
      <div className="orb-float-3 absolute bottom-20 left-1/4 size-72 rounded-full bg-tertiary-fixed opacity-30 blur-3xl" />
    </div>
  )
}
