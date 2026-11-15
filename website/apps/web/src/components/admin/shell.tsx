'use client';

import { UserButton } from '@clerk/nextjs';
import {
  ArrowUpRight,
  ChartNoAxesColumn,
  ImageIcon,
  Menu,
  Package,
  ShoppingBag,
  Star,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ThemeToggle } from '../layout/theme-toggle';
import { Button } from '../ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../ui/overlays';
import { t } from '../../lib/i18n';

const links = [
  ['/admin', 'dashboard', ChartNoAxesColumn],
  ['/admin/products', 'products', Package],
  ['/admin/orders', 'orders', ShoppingBag],
  ['/admin/customers', 'customers', Users],
  ['/admin/reviews', 'reviews', Star],
  ['/admin/banners', 'banners', ImageIcon],
] as const;

function AdminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t('admin', 'navigation')} className="grid gap-1">
      {links.map(([href, label, Icon]) => {
        const active =
          pathname === href ||
          (href !== '/admin' && pathname.startsWith(href + '/'));
        const link = (
          <Link
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted-foreground underline-offset-4 hover:bg-muted hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline"
          >
            <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
            {t('admin', label)}
          </Link>
        );
        return mobile ? (
          <SheetClose key={href} asChild>
            {link}
          </SheetClose>
        ) : (
          <div key={href}>{link}</div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-8">
          <div className="flex items-center gap-2 lg:gap-5">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    aria-label={t('admin', 'navigation')}
                    variant="ghost"
                    size="icon"
                  >
                    <Menu size={20} />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetTitle className="mb-4 pr-8 text-lg font-medium">
                    {t('admin', 'navigation')}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    {t('admin', 'workspace')}
                  </SheetDescription>
                  <AdminNav mobile />
                  <div className="mt-4">
                    <ThemeToggle />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <Link
              href="/admin"
              prefetch={false}
              className="font-medium tracking-tight"
            >
              ShopEase
            </Link>
            <span className="hidden border-l border-border pl-5 text-sm text-muted-foreground sm:inline">
              {t('admin', 'workspace')}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="flex items-center gap-1 py-2 text-sm underline-offset-4 hover:underline"
            >
              {t('admin', 'store')}{' '}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border px-5 py-7 lg:block">
          <AdminNav />
        </aside>
        <main
          id="content"
          tabIndex={-1}
          className="min-w-0 space-y-7 px-4 py-7 sm:px-8 sm:py-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
