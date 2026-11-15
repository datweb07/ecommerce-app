import type { ComponentProps } from 'react';
import Link from 'next/link';
import { ChevronRight, Construction } from 'lucide-react';
import { t } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { Card } from '../ui/panels';

export function PageContainer({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-7xl px-5 py-9 sm:px-7 sm:py-12',
        className,
      )}
      {...props}
    />
  );
}
export function Section({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('space-y-4', className)} {...props} />;
}
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="space-y-2">
      <h1 className="text-section font-medium tracking-tight sm:text-title">
        {title}
      </h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </header>
  );
}
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Đường dẫn"
      className="text-caption tracking-wide text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map(({ label, href }, index) => (
          <li key={label} className="flex items-center gap-2">
            {index > 0 && <ChevronRight aria-hidden="true" size={14} />}
            {href ? (
              <Link href={href} className="hover:underline">
                {label}
              </Link>
            ) : (
              <span aria-current="page">{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function Placeholder({
  title,
  parent,
  embedded,
}: {
  title: string;
  parent?: { label: string; href: string };
  embedded?: boolean;
}) {
  const content = (
    <Section>
      <Breadcrumb
        items={[
          { label: t('nav', 'home'), href: '/' },
          ...(parent ? [parent] : []),
          { label: title },
        ]}
      />
      <PageHeader title={title} />
      <Card className="mt-6 flex min-h-32 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center text-muted-foreground">
          <Construction size={21} />
        </span>
        <p className="text-muted-foreground">{t('common', 'preview')}</p>
      </Card>
    </Section>
  );
  return embedded ? content : <PageContainer>{content}</PageContainer>;
}
