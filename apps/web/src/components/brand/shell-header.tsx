'use client';

import { ChevronDown, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { LmsLogo } from '@/components/brand/logo';
import { NotificationBell } from '@/components/notification-bell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ShellNavItem = {
  href: string;
  label: string;
  /** Shorter label for compact desktop nav */
  shortLabel?: string;
  match?: 'exact' | 'prefix';
  /** Placed in the "More" menu on desktop; still listed in the mobile drawer */
  secondary?: boolean;
};

function navLinkClass(active: boolean, variant: 'desktop' | 'mobile' | 'overflow') {
  if (variant === 'desktop') {
    return cn(
      'shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors lg:px-2.5 lg:text-sm',
      active
        ? 'bg-accent/70 font-semibold text-brand-green shadow-sm'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );
  }

  if (variant === 'overflow') {
    return cn(
      'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-accent/80 font-semibold text-brand-green'
        : 'text-foreground hover:bg-muted',
    );
  }

  return cn(
    'block rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
    active
      ? 'bg-accent/80 font-semibold text-brand-green'
      : 'text-foreground hover:bg-muted',
  );
}

function NavLinks({
  items,
  isActive,
  variant,
  onNavigate,
}: {
  items: ShellNavItem[];
  isActive: (item: ShellNavItem) => boolean;
  variant: 'desktop' | 'mobile' | 'overflow';
  onNavigate?: () => void;
}) {
  const displayLabel = (item: ShellNavItem) => {
    if (variant === 'desktop' && item.shortLabel) {
      return item.shortLabel;
    }
    return item.label;
  };

  return items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={navLinkClass(isActive(item), variant)}
      onClick={onNavigate}
    >
      {displayLabel(item)}
    </Link>
  ));
}

function NavMoreMenu({
  items,
  isActive,
}: {
  items: ShellNavItem[];
  isActive: (item: ShellNavItem) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasActiveChild = items.some(isActive);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 176;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));

    setMenuStyle({
      top: rect.bottom + 6,
      left,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, updatePosition]);

  if (items.length === 0) {
    return null;
  }

  const menu =
    open && menuStyle && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        style={{ top: menuStyle.top, left: menuStyle.left }}
        className="fixed z-[150] min-w-[11rem] rounded-lg border border-border bg-background p-1.5 shadow-lg motion-safe:animate-scale-in"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={navLinkClass(isActive(item), 'overflow')}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          navLinkClass(hasActiveChild, 'desktop'),
          'inline-flex shrink-0 items-center gap-1',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        More
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}

function MobileNavDrawer({
  open,
  onClose,
  primaryItems,
  secondaryItems,
  isActive,
  userMeta,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  primaryItems: ShellNavItem[];
  secondaryItems: ShellNavItem[];
  isActive: (item: ShellNavItem) => boolean;
  userMeta?: ReactNode;
  actions?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[200] bg-black/40 lg:hidden"
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <aside
        id="shell-mobile-nav"
        className="fixed inset-y-0 right-0 z-[201] flex h-dvh w-[min(100vw-3rem,20rem)] flex-col bg-background shadow-2xl motion-safe:animate-slide-in-right lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-brand-navy">Menu</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label="Close navigation menu"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          aria-label="Mobile"
        >
          <div className="space-y-1">
            <NavLinks
              items={primaryItems}
              isActive={isActive}
              variant="mobile"
              onNavigate={onClose}
            />
          </div>
          {secondaryItems.length > 0 && (
            <>
              <p className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                More
              </p>
              <div className="space-y-1">
                <NavLinks
                  items={secondaryItems}
                  isActive={isActive}
                  variant="mobile"
                  onNavigate={onClose}
                />
              </div>
            </>
          )}
        </nav>

        {(userMeta || actions) && (
          <div className="shrink-0 space-y-3 border-t bg-muted/30 px-4 py-4">
            {userMeta}
            {actions && (
            <div className="flex flex-col gap-2 [&_button]:w-full">{actions}</div>
          )}
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}

export function ShellHeader({
  navItems,
  userMeta,
  drawerUserMeta,
  actions,
  banner,
}: {
  navItems: ShellNavItem[];
  userMeta?: ReactNode;
  /** Richer user block for the mobile drawer footer (name, org, badges) */
  drawerUserMeta?: ReactNode;
  actions?: ReactNode;
  banner?: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryItems = navItems.filter((item) => !item.secondary);
  const secondaryItems = navItems.filter((item) => item.secondary);

  const isActive = useCallback(
    (item: ShellNavItem) => {
      if (item.match === 'exact') {
        return pathname === item.href;
      }
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    },
    [pathname],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [menuOpen, closeMenu]);

  return (
    <>
      {banner}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <LmsLogo
            href={navItems[0]?.href ?? '/'}
            size="sm"
            showSubtitle={false}
            compact
          />

          <nav
            className="hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-0.5 lg:flex"
            aria-label="Main"
          >
            <NavLinks items={primaryItems} isActive={isActive} variant="desktop" />
            <NavMoreMenu items={secondaryItems} isActive={isActive} />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ShellNotifications />
            {userMeta && (
              <div className="hidden min-w-0 md:block">{userMeta}</div>
            )}
            {actions && (
              <div className="hidden shrink-0 md:flex md:items-center">{actions}</div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 px-2 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="shell-mobile-nav"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="size-4" aria-hidden />
              ) : (
                <Menu className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </header>

      <MobileNavDrawer
        open={menuOpen}
        onClose={closeMenu}
        primaryItems={primaryItems}
        secondaryItems={secondaryItems}
        isActive={isActive}
        userMeta={drawerUserMeta ?? userMeta}
        actions={actions}
      />
    </>
  );
}

function ShellUserMetaDrawer({ children }: { children: ReactNode }) {
  return <div className="space-y-2 text-left">{children}</div>;
}

export function ShellDrawerUser({
  name,
  subtitle,
  badges,
}: {
  name?: string | null;
  subtitle?: string | null;
  badges?: ReactNode;
}) {
  return (
    <ShellUserMetaDrawer>
      <p className="text-sm font-medium">{name}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {badges && <div className="flex flex-wrap gap-1.5 pt-1">{badges}</div>}
    </ShellUserMetaDrawer>
  );
}

export function ShellUserMeta({
  name,
  subtitle,
}: {
  name?: string | null;
  subtitle?: string | null;
  badges?: ReactNode;
}) {
  return (
    <div className="hidden min-w-0 max-w-[7rem] text-right md:block lg:max-w-[8.5rem] xl:max-w-[10rem]">
      <p className="truncate text-sm font-medium leading-tight">{name}</p>
      {subtitle && (
        <p
          className="mt-0.5 hidden truncate text-xs text-muted-foreground xl:block"
          title={subtitle}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function ShellNotifications() {
  return <NotificationBell />;
}

export function ShellLogoutButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'shrink-0 border-brand-navy/15 px-2.5 text-xs hover:border-brand-green/40 hover:bg-accent sm:px-3 sm:text-sm',
        className,
      )}
      onClick={onClick}
    >
      Log out
    </Button>
  );
}
