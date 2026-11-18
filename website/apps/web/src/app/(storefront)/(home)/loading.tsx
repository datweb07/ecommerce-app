import { PageContainer } from '@/components/common/page';
import { LoadingSkeleton } from '@/components/common/states';
import { PinnedScroll } from '@/components/common/pinned-scroll';
import { shoppingSteps } from '@/config/site';
import { t } from '@/lib/i18n';

export default function Loading() {
  return (
    <PageContainer className="space-y-section lg:space-y-section-lg">
      <PinnedScroll
        id="home-shopping-guide-loading"
        title={t('shoppingGuide', 'heading')}
        skipTarget="home-benefits-loading"
        skipLabel={t('shoppingGuide', 'skip')}
        steps={shoppingSteps}
      />
      <div id="home-benefits-loading" tabIndex={-1} />
      <LoadingSkeleton variant="list" />
    </PageContainer>
  );
}
