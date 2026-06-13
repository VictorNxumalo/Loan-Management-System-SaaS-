import { cn } from '@/lib/utils';

interface LenderAvatarProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
}

export function LenderAvatar({ name, logoUrl, className }: LenderAvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(
          'size-12 shrink-0 rounded-lg border border-border bg-background object-contain p-1',
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-semibold text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      {initials || '?'}
    </div>
  );
}
