'use client';

import { UserButton, useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { Bell, Heart, Menu, Search, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { publicEnv } from '../../config/public-env';
import { useApiClient } from '../../lib/api/browser';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { Button } from '../ui/button';
import { Input } from '../ui/fields';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../ui/overlays';
import { ThemeToggle } from './theme-toggle';

export function SearchForm({
  onNavigate,
  id = 'catalogue-search',
}: {
  onNavigate?: () => void;
  id?: string;
}) {
  const router = useRouter();
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) {
      const value = String(
        new FormData(event.currentTarget).get('q') ?? '',
      ).trim();
      router.push(
        value ? '/products?q=' + encodeURIComponent(value) : '/products',
      );
      onNavigate?.();
    }
  };
  return (
    <form
      role="search"
      action="/products"
      onSubmit={search}
      className="flex items-center gap-1 rounded-control bg-muted p-1"
    >
      <label htmlFor={id} className="sr-only">
        {t('nav', 'search')}
      </label>
      <Input
        type="search"
        id={id}
        name="q"
        maxLength={80}
        placeholder={t('nav', 'search')}
        className="min-w-0 border-transparent bg-transparent"
      />
      <Button type="submit" variant="ghost" size="icon" aria-label="Tìm kiếm">
        <Search size={18} />
      </Button>
    </form>
  );
}

export function MobileMenu({ categories }: { categories: string[] }) {
  const pathname = usePathname();
  return <MobileSheet key={pathname} categories={categories} />;
}
function MobileSheet({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={t('nav', 'menu')}>
            <Menu size={21} />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="pr-12 text-lg font-bold">
            Danh mục mua sắm
          </SheetTitle>
          <SheetDescription className="mt-1 mb-5 text-sm text-muted-foreground">
            Tìm và duyệt theo danh mục.
          </SheetDescription>
          <SearchForm
            id="mobile-catalogue-search"
            onNavigate={() => setOpen(false)}
          />
          <nav className="mt-5 grid gap-1" aria-label="Điều hướng di động">
            <SheetClose asChild>
              <Link
                className="rounded-control p-3 hover:bg-muted"
                href="/products"
              >
                {t('nav', 'products')}
              </Link>
            </SheetClose>
            {categories.map((category) => (
              <SheetClose asChild key={category}>
                <Link
                  className="rounded-control p-3 hover:bg-muted"
                  href={{ pathname: '/products', query: { category } }}
                >
                  {category}
                </Link>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <Link
                className="rounded-control p-3 hover:bg-muted"
                href="/wishlist"
                prefetch={false}
              >
                {t('nav', 'wishlist')}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                className="rounded-control p-3 hover:bg-muted"
                href="/account"
                prefetch={false}
              >
                {t('nav', 'account')}
              </Link>
            </SheetClose>
          </nav>
          <div className="mt-4 min-[370px]:hidden">
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Action({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count?: number | undefined;
  children: ReactNode;
}) {
  return (
    <Button size="icon" variant="ghost" className="relative" asChild>
      <Link
        href={href}
        prefetch={false}
        aria-label={count ? `${label} (${count})` : label}
      >
        {children}
        {Boolean(count) && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 rounded-full bg-primary px-1 text-[11px] leading-4 text-primary-foreground"
          >
            {count && count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </Button>
  );
}

function SignInLink() {
  return (
    <Button asChild size="small">
      <Link href={publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL}>
        {t('nav', 'signIn')}
      </Link>
    </Button>
  );
}
function Actions({
  account,
  cartCount,
  unread,
}: {
  account: ReactNode;
  cartCount?: number | undefined;
  unread?: number;
}) {
  return (
    <div className="flex items-center sm:gap-1">
      <span className="hidden sm:block">
        <Action href="/wishlist" label={t('nav', 'wishlist')}>
          <Heart size={19} />
        </Action>
      </span>
      <Action href="/cart" label={t('nav', 'cart')} count={cartCount}>
        <ShoppingCart size={19} />
      </Action>
      {unread !== undefined && (
        <Action
          href="/account/notifications"
          label={t('nav', 'notifications')}
          count={unread}
        >
          <Bell size={19} />
        </Action>
      )}
      <span className="hidden min-[370px]:block">
        <ThemeToggle />
      </span>
      {account}
    </div>
  );
}
export function GuestActions() {
  return <Actions account={<SignInLink />} />;
}
export function HeaderActions() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApiClient();
  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: api.cart.get,
    enabled: Boolean(isSignedIn),
  });
  const filters = { limit: '1' };
  const inbox = useQuery({
    queryKey: queryKeys.notifications(filters),
    queryFn: () => api.notifications.list(filters),
    enabled: Boolean(isSignedIn),
    refetchInterval: 60_000,
  });
  if (!isSignedIn)
    return <Actions account={isLoaded ? <SignInLink /> : null} />;
  return (
    <Actions
      cartCount={cart.data?.items.reduce((sum, item) => sum + item.quantity, 0)}
      unread={inbox.data?.unreadCount ?? 0}
      account={
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link
              label={t('nav', 'account')}
              href="/account"
              labelIcon={<ShoppingCart size={15} />}
            />
          </UserButton.MenuItems>
        </UserButton>
      }
    />
  );
}
