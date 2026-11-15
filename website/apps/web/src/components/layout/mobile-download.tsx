import 'server-only';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { toDataURL } from 'qrcode';
import { t } from '../../lib/i18n';

export async function MobileDownload({
  releaseUrl,
}: {
  releaseUrl?: string | undefined;
}) {
  const qr = releaseUrl
    ? await toDataURL(releaseUrl, {
        width: 256,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#111111', light: '#FFFFFF' },
      })
    : null;

  return (
    <section
      aria-labelledby="mobile-download-title"
      className="border-t border-border"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-12 gap-y-5 px-5 py-8 sm:px-7 sm:py-10">
        <div className="max-w-md space-y-2">
          <h2 id="mobile-download-title" className="text-heading font-medium">
            {t('mobileDownload', 'title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('mobileDownload', releaseUrl ? 'description' : 'pending')}
          </p>
          {releaseUrl && (
            <a
              href={releaseUrl}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              {t('mobileDownload', 'link')}
              <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.5} />
            </a>
          )}
        </div>
        {qr && (
          <Image
            unoptimized
            src={qr}
            alt={t('mobileDownload', 'qrLabel')}
            width={160}
            height={160}
            className="shrink-0"
          />
        )}
      </div>
    </section>
  );
}
