import Link from 'next/link';
import { withPage } from '../../lib/url-state';
import { Button } from './button';

export function Pagination({
  page,
  totalPages,
  pathname,
  search = '',
}: {
  page: number;
  totalPages: number;
  pathname: string;
  search?: string;
}) {
  if (totalPages < 2) return null;
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Phân trang">
      {page > 1 && (
        <Button asChild variant="outline">
          <Link rel="prev" href={withPage(pathname, search, page - 1)}>
            Trang trước
          </Link>
        </Button>
      )}
      <span aria-current="page" className="px-2 text-sm">
        Trang {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Button asChild variant="outline">
          <Link rel="next" href={withPage(pathname, search, page + 1)}>
            Trang sau
          </Link>
        </Button>
      )}
    </nav>
  );
}
