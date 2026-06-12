/** Canonical LMS brand asset paths (served from /public/brand). */
export const BRAND_ASSETS = {
  /** Squircle mark — navy→green gradient. Use on light backgrounds. */
  iconColored: '/brand/lms-icon-colored.png',
  /** Squircle mark — light on dark. Use on navy panels, dark hero blocks. */
  iconMonochrome: '/brand/lms-icon-monochrome.png',
  /** Full horizontal lockup with tagline — marketing / large hero only. */
  logoFull: '/brand/lms-logo.png',
} as const;

export type BrandIconVariant = 'colored' | 'monochrome';
