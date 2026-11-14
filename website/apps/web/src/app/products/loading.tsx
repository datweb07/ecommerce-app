import { PageContainer } from '../../components/common/page';
import { LoadingSkeleton } from '../../components/common/states';
export default function Loading() {
  return (
    <PageContainer>
      <LoadingSkeleton variant="card" />
    </PageContainer>
  );
}
