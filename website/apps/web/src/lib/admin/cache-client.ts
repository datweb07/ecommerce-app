'use client';
import { toast } from 'sonner';
import { t } from '../i18n';
import { revalidateAdminStorefront } from './revalidate';

export function refreshStorefront(tag: 'catalogue' | 'banners') {
  const warn = () => toast.warning(t('admin', 'cacheWarning'));
  void revalidateAdminStorefront(tag).then((ok) => {
    if (!ok) warn();
  }, warn);
}
