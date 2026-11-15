import Link from 'next/link';
import { PageContainer } from '../components/common/page';
import { ErrorState } from '../components/common/states';
import { Button } from '../components/ui/button';
import { EmptyObject3D } from '../components/scene/scene-3d';
export default function NotFound() {
  return (
    <PageContainer id="content" tabIndex={-1}>
      <EmptyObject3D className="mx-auto w-36" />
      <ErrorState
        title="Không tìm thấy trang"
        description="Kiểm tra đường dẫn hoặc quay về trang chủ."
        action={
          <Button asChild>
            <Link href="/">Về trang chủ</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
