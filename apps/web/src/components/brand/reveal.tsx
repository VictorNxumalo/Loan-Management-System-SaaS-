'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Scroll reveal — content is always visible; animation is optional enhancement only. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );

    observer.observe(node);

    const fallback = window.setTimeout(() => {
      setEntered(true);
      observer.disconnect();
    }, 150);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        entered &&
          'motion-safe:animate-fade-up motion-reduce:animate-none',
        className,
      )}
      style={entered ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function StaggerGroup({
  children,
  className,
  staggerMs = 80,
}: {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
}) {
  const items = Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, index) => (
        <Reveal key={index} delay={index * staggerMs}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
