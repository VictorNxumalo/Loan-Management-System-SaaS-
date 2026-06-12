import Image from 'next/image';
import Link from 'next/link';
import { BRAND_ASSETS, type BrandIconVariant } from '@/components/brand/assets';
import { cn } from '@/lib/utils';

const ICON_SIZES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
  hero: 'h-24 w-24 sm:h-28 sm:w-28',
} as const;

const WORDMARK_SIZES = {
  sm: { title: 'text-sm', subtitle: 'text-[0.55rem]' },
  md: { title: 'text-base', subtitle: 'text-[0.6rem]' },
  lg: { title: 'text-xl', subtitle: 'text-[0.65rem]' },
  hero: { title: 'text-2xl sm:text-3xl', subtitle: 'text-xs' },
} as const;

function resolveVariant(
  variant: BrandIconVariant | 'auto',
  inverted?: boolean,
): BrandIconVariant {
  if (variant !== 'auto') return variant;
  return inverted ? 'monochrome' : 'colored';
}

/** Square app icon — colored on light UI, monochrome on dark surfaces. */
export function LmsIcon({
  variant = 'colored',
  size = 'md',
  className,
  priority = false,
}: {
  variant?: BrandIconVariant;
  size?: keyof typeof ICON_SIZES;
  className?: string;
  priority?: boolean;
}) {
  const src =
    variant === 'monochrome' ? BRAND_ASSETS.iconMonochrome : BRAND_ASSETS.iconColored;

  return (
    <Image
      src={src}
      alt=""
      width={512}
      height={512}
      aria-hidden="true"
      priority={priority}
      className={cn('shrink-0 object-contain', ICON_SIZES[size], className)}
    />
  );
}

/** Icon + LMS wordmark lockup for headers, auth, and marketing. */
export function LmsLogo({
  href,
  size = 'md',
  showWordmark = true,
  showTagline = false,
  showSubtitle = false,
  className,
  inverted = false,
  variant = 'auto',
}: {
  href?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showWordmark?: boolean;
  showTagline?: boolean;
  showSubtitle?: boolean;
  className?: string;
  inverted?: boolean;
  variant?: BrandIconVariant | 'auto';
}) {
  const iconVariant = resolveVariant(variant, inverted);
  const iconSize =
    size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'hero' ? 'hero' : 'md';
  const wordmark = WORDMARK_SIZES[size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'hero' ? 'hero' : 'md'];

  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LmsIcon
        variant={iconVariant}
        size={iconSize}
        priority={size === 'hero'}
        className={cn(
          'rounded-xl shadow-sm',
          iconVariant === 'colored' && 'shadow-brand-navy/10',
        )}
      />
      {showWordmark && (
        <div className="min-w-0 leading-none">
          <p
            className={cn(
              'font-bold tracking-tight',
              wordmark.title,
              inverted ? 'text-white' : 'text-brand-navy',
            )}
          >
            LMS
          </p>
          {(showSubtitle || size === 'lg' || size === 'hero') && (
            <p
              className={cn(
                'mt-0.5 font-medium uppercase tracking-[0.14em]',
                wordmark.subtitle,
                inverted ? 'text-white/60' : 'text-muted-foreground',
              )}
            >
              Loan Management System
            </p>
          )}
        </div>
      )}
      {showTagline && (
        <p
          className={cn(
            'hidden text-sm font-medium sm:block',
            inverted ? 'text-white/80' : 'text-brand-green',
          )}
        >
          Connect lenders and borrowers in one place.
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 focus-visible:ring-offset-2 rounded-lg"
        aria-label="LMS home"
      >
        {content}
      </Link>
    );
  }

  return content;
}

/** Animated bar-chart mark used in loaders — mirrors the logo growth bars */
export function LmsLoaderMark({
  size = 'md',
  className,
  showIcon = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}) {
  const barHeights = {
    sm: ['h-2', 'h-3', 'h-4', 'h-5'],
    md: ['h-3', 'h-4', 'h-5', 'h-6'],
    lg: ['h-4', 'h-5', 'h-6', 'h-8'],
  };
  const widths = { sm: 'w-1', md: 'w-1.5', lg: 'w-2' };
  const iconSizes = { sm: 'xs' as const, md: 'sm' as const, lg: 'md' as const };
  const heights = barHeights[size];
  const width = widths[size];

  return (
    <div
      className={cn('flex flex-col items-center gap-3', className)}
      role="status"
      aria-label="Loading"
    >
      {showIcon && (
        <LmsIcon
          variant="colored"
          size={iconSizes[size]}
          className="motion-safe:animate-pulse rounded-xl shadow-md shadow-brand-green/15"
        />
      )}
      <div className="flex items-end gap-1">
        {heights.map((height, index) => (
          <span
            key={index}
            className={cn(
              width,
              height,
              'origin-bottom rounded-sm bg-brand-green motion-safe:animate-bar-rise',
              index === 1 && 'animation-delay-100',
              index === 2 && 'animation-delay-200',
              index === 3 && 'animation-delay-300',
            )}
          />
        ))}
      </div>
    </div>
  );
}
