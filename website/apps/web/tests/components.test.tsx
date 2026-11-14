// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuantityInput } from '../src/components/common/quantity-input';
import { RatingStars } from '../src/components/common/rating-stars';
import { Pagination } from '../src/components/ui/pagination';
import { StatusBadge } from '../src/components/common/storefront';
import { ErrorState } from '../src/components/common/states';
import { MobileMenu } from '../src/components/layout/header-client';

vi.mock('@clerk/nextjs', () => ({ useAuth: vi.fn(), UserButton: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
afterEach(cleanup);

describe('storefront UI foundation', () => {
  it('only emits integer quantities within limits', async () => {
    function Demo() {
      const [value, setValue] = useState(1);
      return (
        <QuantityInput min={1} max={2} value={value} onChange={setValue} />
      );
    }
    render(<Demo />);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Giảm số lượng' })
        .disabled,
    ).toBe(true);
    const field = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Số lượng',
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Tăng số lượng' }),
    );
    expect(field.value).toBe('2');
    fireEvent.change(field, { target: { value: '1.5' } });
    expect(field.value).toBe('2');
    fireEvent.change(field, { target: { value: '8' } });
    expect(field.value).toBe('2');
  });
  it('exposes a Vietnamese rating and allows a keyboard-selected value', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <>
        <RatingStars value={4.5} />
        <RatingStars value={3} onChange={change} />
      </>,
    );
    expect(screen.getByRole('img', { name: '4,5 trên 5 sao' })).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('radio', { name: '3 sao' }),
    );
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(change).toHaveBeenCalledWith(4));
  });
  it('retains filters in pagination and labels order and payment states', () => {
    render(
      <>
        <Pagination
          page={2}
          totalPages={3}
          pathname="/products"
          search="category=Home&page=2"
        />
        <StatusBadge kind="order" status="delivered" />
        <StatusBadge kind="checkout" status="expired" />
      </>,
    );
    expect(
      screen.getByRole('link', { name: 'Trang sau' }).getAttribute('href'),
    ).toBe('/products?category=Home&page=3');
    expect(
      screen.getByRole('link', { name: 'Trang trước' }).getAttribute('href'),
    ).toBe('/products?category=Home');
    expect(screen.getByText('Đã giao')).toBeTruthy();
    expect(screen.getByText('Đã hết hạn')).toBeTruthy();
  });
  it('calls the retry action', async () => {
    const retry = vi.fn();
    render(<ErrorState retry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('traps focus in the drawer and restores focus when Escape closes it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <MobileMenu categories={['Home']} />
        <button type="button">Bên ngoài</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Mở menu' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Danh mục mua sắm' });
    expect(within(dialog).getByRole('link', { name: 'Home' })).toBeTruthy();
    for (let index = 0; index < 9; index++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
