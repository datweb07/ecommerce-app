'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../ui/button';
import {
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '../ui/fields';
import { Form, useZodForm } from '../ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/menus';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../ui/overlays';
import { Badge, Card, Separator } from '../ui/panels';
import { Pagination } from '../ui/pagination';
import { ConfirmDialog } from './confirm-dialog';
import { PageContainer, PageHeader, Section } from './page';
import { QuantityInput } from './quantity-input';
import { RatingStars } from './rating-stars';
import { EmptyState, ErrorState, LoadingSkeleton } from './states';
import { Price, ProductCard, StatusBadge } from './storefront';

const exampleForm = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên.'),
});

export function Showcase({
  currency,
  page,
  search,
}: {
  currency: 'usd';
  page: number;
  search: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(3);
  const form = useZodForm(exampleForm, { defaultValues: { name: '' } });
  const message = form.formState.errors.name?.message;
  return (
    <PageContainer className="space-y-section lg:space-y-section-lg">
      <PageHeader
        title="Thư viện thành phần"
        description="Bản xem thử dành cho phát triển."
      />
      <Section>
        <h2 className="text-section font-medium">Điều khiển và biểu mẫu</h2>
        <Card className="grid gap-6 sm:grid-cols-2">
          <Form {...form}>
            <form
              noValidate
              className="grid gap-3"
              onSubmit={form.handleSubmit(() =>
                toast.success('Biểu mẫu hợp lệ'),
              )}
            >
              <Label htmlFor="sample-name">Tên</Label>
              <Input
                id="sample-name"
                aria-invalid={Boolean(message)}
                aria-describedby={message ? 'sample-error' : undefined}
                {...form.register('name')}
              />
              {message && (
                <p id="sample-error" role="alert" className="text-destructive">
                  {message}
                </p>
              )}
              <Label htmlFor="sample-message">Ghi chú</Label>
              <Textarea id="sample-message" />
              <Button type="submit" className="justify-self-start">
                Thử xác thực
              </Button>
            </form>
          </Form>
          <div className="grid content-start gap-4">
            <div className="flex items-center gap-3">
              <Checkbox id="sample-check" />
              <Label htmlFor="sample-check">Đồng ý</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sample-switch" />
              <Label htmlFor="sample-switch">Bật thông báo</Label>
            </div>
            <RadioGroup
              aria-label="Lựa chọn giao hàng"
              defaultValue="standard"
              className="flex flex-wrap gap-3"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="standard" id="sample-standard" />
                <Label htmlFor="sample-standard">Tiêu chuẩn</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fast" id="sample-fast" />
                <Label htmlFor="sample-fast">Nhanh</Label>
              </div>
            </RadioGroup>
            <Select defaultValue="new">
              <SelectTrigger aria-label="Sắp xếp mẫu">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mới nhất</SelectItem>
                <SelectItem value="price">Theo giá</SelectItem>
              </SelectContent>
            </Select>
            <QuantityInput value={quantity} onChange={setQuantity} />
            <RatingStars value={rating} onChange={setRating} />
          </div>
        </Card>
      </Section>
      <Section>
        <h2 className="text-section font-medium">Điều hướng và hộp thoại</h2>
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Hộp thoại</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="pr-10 font-medium">
                  Hộp thoại mẫu
                </DialogTitle>
                <DialogDescription>Thử phím Escape để đóng.</DialogDescription>
                <DialogClose asChild>
                  <Button variant="outline">Xong</Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
            <ConfirmDialog
              trigger={<Button variant="outline">Xác nhận</Button>}
              title="Xác nhận thao tác"
              description="Đây là bản xem thử."
              onConfirm={() => toast.success('Đã xác nhận')}
            />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Ngăn kéo</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="font-medium">Ngăn kéo mẫu</SheetTitle>
                <SheetDescription>Nội dung của ngăn kéo.</SheetDescription>
              </SheetContent>
            </Sheet>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => toast.info('Đã chọn mục')}>
                  Mục mẫu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Thông tin</Button>
              </PopoverTrigger>
              <PopoverContent>Nội dung thông tin mẫu.</PopoverContent>
            </Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Gợi ý</Button>
                </TooltipTrigger>
                <TooltipContent>Gợi ý mẫu</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Separator />
          <Tabs defaultValue="one">
            <TabsList aria-label="Tab mẫu">
              <TabsTrigger value="one">Mục 1</TabsTrigger>
              <TabsTrigger value="two">Mục 2</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="mt-2">
              Nội dung thứ nhất.
            </TabsContent>
            <TabsContent value="two" className="mt-2">
              Nội dung thứ hai.
            </TabsContent>
          </Tabs>
          <Pagination
            page={page}
            totalPages={3}
            pathname="/_dev/components"
            search={search}
          />
        </Card>
      </Section>
      <Section>
        <h2 className="text-section font-medium">Trạng thái cửa hàng</h2>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <ProductCard
            name="Sản phẩm mẫu"
            id="preview"
            price={49.95}
            stock={0}
            rating={4}
          />
          <Card className="grid justify-items-start gap-4">
            <Badge>Nhãn mẫu</Badge>
            <StatusBadge kind="order" status="shipped" />
            <StatusBadge kind="checkout" status="paid" />
            <Price
              amount={4995}
              previous={6000}
              unit="cents"
              currency={currency}
            />
            <Button
              variant="outline"
              onClick={() => toast.info('Thông báo mẫu')}
            >
              Hiện thông báo
            </Button>
          </Card>
        </div>
        <EmptyState />
        <ErrorState retry={() => toast.info('Đã thử lại')} />
        <LoadingSkeleton variant="card" />
      </Section>
    </PageContainer>
  );
}
