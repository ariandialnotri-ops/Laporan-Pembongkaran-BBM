import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge only knows Tailwind's stock scales. Left alone it reads a
 * custom `text-numeric-md` as a text *colour* and drops it the moment a real
 * colour like `text-on-surface` follows in the same class list — which silently
 * wipes the type scale. Registering the scale from DESIGN.md fixes that.
 */
const TEXT_SCALE = [
  'headline-xl',
  'headline-lg',
  'headline-md',
  'body-lg',
  'body-md',
  'body-sm',
  'numeric-lg',
  'numeric-md',
  'numeric-sm',
  'tag',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TEXT_SCALE }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
