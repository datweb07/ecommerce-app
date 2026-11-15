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
import { inboxBadgeFilters, inboxPollMs, queryKeys } from '../../lib/query';
import { Button } from '../ui/button';
import { Input } from '../ui/fields';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
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
      className="flex items-center gap-1"
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
        className="min-w-0"
      />
      <Button type="submit" variant="ghost" size="icon" aria-label="Tìm kiếm">
        <Search size={18} />
      </Button>
    </form>
  );
}

export function SearchControl() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('nav', 'search')}
          className="size-9 sm:size-11"
        >
          <Search size={18} strokeWidth={1.5} />
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById('catalogue-search')?.focus();
        }}
      >
        <DialogTitle className="pr-10 text-heading font-medium">
          {t('nav', 'search')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('catalogue', 'description')}
        </DialogDescription>
        <SearchForm onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
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
          <Button
            size="icon"
            variant="ghost"
            className="size-9 sm:size-11"
            aria-label={t('nav', 'menu')}
          >
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
                className="py-3 text-heading underline-offset-4 hover:underline"
                href="/products"
              >
                {t('nav', 'products')}
              </Link>
            </SheetClose>
            {categories.map((category) => (
              <SheetClose asChild key={category}>
                <Link
                  className="py-3 text-heading underline-offset-4 hover:underline"
                  href={{ pathname: '/products', query: { category } }}
                >
                  {category}
                </Link>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <Link
                className="py-3 text-heading underline-offset-4 hover:underline"
                href="/wishlist"
                prefetch={false}
              >
                {t('nav', 'wishlist')}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                className="py-3 text-heading underline-offset-4 hover:underline"
                href="/account"
                prefetch={false}
              >
                {t('nav', 'account')}
              </Link>
            </SheetClose>
          </nav>
          <div className="mt-4 min-[410px]:hidden">
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
    <Button
      size="icon"
      variant="ghost"
      className="relative size-9 sm:size-11"
      asChild
    >
      <Link
        href={href}
        prefetch={false}
        aria-label={count ? `${label} (${count})` : label}
      >
        {children}
        {Boolean(count) && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 rounded-control bg-primary px-1 text-[10px] leading-4 text-primary-foreground"
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
    <Button asChild variant="ghost" size="small" className="px-1.5 sm:px-3">
      <Link href={publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL}>
        {t('nav', 'signIn')}
      </Link>
    </Button>
  );
}
function Actions({
  account,
  cartCount,
  wishCount,
  unread,
}: {
  account: ReactNode;
  cartCount?: number | undefined;
  wishCount?: number | undefined;
  unread?: number;
}) {
  return (
    <div className="flex items-center sm:gap-1">
      <span
        className={wishCount === undefined ? 'hidden sm:block' : 'contents'}
      >
        <Action href="/wishlist" label={t('nav', 'wishlist')} count={wishCount}>
          <Heart size={19} strokeWidth={1.5} />
        </Action>
      </span>
      <Action href="/cart" label={t('nav', 'cart')} count={cartCount}>
        <ShoppingCart size={19} strokeWidth={1.5} />
      </Action>
      {unread !== undefined && (
        <Action
          href="/account/notifications"
          label={t('nav', 'notifications')}
          count={unread}
        >
          <Bell size={19} strokeWidth={1.5} />
        </Action>
      )}
      <span className="hidden min-[410px]:block">
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
  const wishlist = useQuery({
    queryKey: queryKeys.wishlist(filters),
    queryFn: () => api.wishlist.list(filters),
    enabled: Boolean(isSignedIn),
  });
  const inbox = useQuery({
    queryKey: queryKeys.notifications(inboxBadgeFilters),
    queryFn: () => api.notifications.list(inboxBadgeFilters),
    enabled: Boolean(isSignedIn),
    refetchInterval: inboxPollMs,
    refetchIntervalInBackground: false,
  });
  if (!isSignedIn)
    return <Actions account={isLoaded ? <SignInLink /> : null} />;
  return (
    <Actions
      cartCount={cart.data?.items.reduce((sum, item) => sum + item.quantity, 0)}
      wishCount={wishlist.data?.total}
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
