import * as React from 'react'

/**
 * Replays the spring-pop keyframe whenever the rendered value changes, the way
 * the reference re-triggers its animation by forcing a reflow. Skips the first
 * paint so nothing pops on page load.
 */
export function SpringValue({
  children,
  className,
  as: Tag = 'span',
}: {
  children: React.ReactNode
  className?: string
  as?: 'span' | 'div'
}) {
  const ref = React.useRef<HTMLElement>(null)
  const pertama = React.useRef(true)
  const key = String(children)

  React.useEffect(() => {
    if (pertama.current) {
      pertama.current = false
      return
    }
    const el = ref.current
    if (!el) return
    el.classList.remove('animate-spring-pop')
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('animate-spring-pop')
  }, [key])

  return (
    <Tag
      ref={ref as React.Ref<HTMLSpanElement & HTMLDivElement>}
      className={className}
    >
      {children}
    </Tag>
  )
}
