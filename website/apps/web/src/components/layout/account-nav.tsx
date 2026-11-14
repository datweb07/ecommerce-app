'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, MapPin, Package, Shield, User } from 'lucide-react';
import { cn } from '../../lib/utils';

const links = [
  ['profile', 'Hồ sơ', User],
  ['addresses', 'Địa chỉ', MapPin],
  ['orders', 'Đơn hàng', Package],
  ['notifications', 'Thông báo', Bell],
  ['security', 'Bảo mật', Shield],
] as const;
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Tài khoản"
      className="flex flex-wrap gap-1 rounded-panel border border-border bg-card p-2 lg:grid"
    >
      {links.map(([slug, label, Icon]) => {
        const href = `/account/${slug}`;
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold hover:bg-muted',
              active && 'bg-muted text-primary',
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
