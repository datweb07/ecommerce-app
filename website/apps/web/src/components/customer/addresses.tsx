'use client';
import { addressCreate, type addressDto } from '@storefront/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { z } from 'zod';
import { useApiClient } from '../../lib/api/browser';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { ConfirmDialog } from '../common/confirm-dialog';
import { EmptyState, LoadingSkeleton } from '../common/states';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/fields';
import { useZodForm } from '../ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/overlays';
import { Badge, Card } from '../ui/panels';
import { toastApiError } from '../ui/sonner';
import { CustomerError } from './states';

export type Address = z.infer<typeof addressDto>;
type AddressInput = z.output<typeof addressCreate>;
const fields = [
  'label',
  'fullName',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'phoneNumber',
] as const;
const blank = {
  label: '',
  fullName: '',
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  phoneNumber: '',
  isDefault: false,
};
export function AddressLines({
  value,
}: {
  value: Pick<
    Address,
    'fullName' | 'streetAddress' | 'city' | 'state' | 'zipCode' | 'phoneNumber'
  >;
}) {
  return (
    <address className="space-y-1 text-sm not-italic">
      <p className="font-semibold">{value.fullName}</p>
      <p>{value.streetAddress}</p>
      <p>
        {value.city}, {value.state} {value.zipCode}
      </p>
      <p>{value.phoneNumber}</p>
    </address>
  );
}
export function AddressForm({
  initial,
  busy,
  save,
}: {
  initial?: Address | undefined;
  busy: boolean;
  save: (value: AddressInput) => void;
}) {
  const id = useId();
  const form = useZodForm(addressCreate, {
    defaultValues: initial
      ? {
          ...Object.fromEntries(fields.map((field) => [field, initial[field]])),
          isDefault: initial.isDefault,
        }
      : blank,
  });
  return (
    <form onSubmit={form.handleSubmit(save)} className="grid gap-3" noValidate>
      <fieldset disabled={busy} className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div
            key={field}
            className={field === 'streetAddress' ? 'col-span-2' : ''}
          >
            <Label htmlFor={id + field}>{t('account', field)}</Label>
            <Input
              id={id + field}
              aria-invalid={Boolean(form.formState.errors[field])}
              aria-describedby={
                form.formState.errors[field] ? id + field + '-error' : undefined
              }
              type={field === 'phoneNumber' ? 'tel' : 'text'}
              {...form.register(field)}
            />
            {form.formState.errors[field] && (
              <p
                id={id + field + '-error'}
                className="text-sm text-destructive"
              >
                {t('account', 'invalidField')}
              </p>
            )}
          </div>
        ))}
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('isDefault')} />
          {t('account', 'setDefault')}
        </label>
        <Button type="submit" className="col-span-2">
          {t('account', 'save')}
        </Button>
      </fieldset>
    </form>
  );
}
export function AddressDialog({
  initial,
  onCreated,
}: {
  initial?: Address;
  onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const api = useApiClient();
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: async (value: AddressInput) => {
      if (initial)
        return { result: await api.addresses.update(initial.id, value) };
      const previous = await api.addresses.list();
      const result = await api.addresses.add(value);
      return {
        result,
        id: result.items.find(
          (row) => !previous.items.some((address) => row.id === address.id),
        )?.id,
      };
    },
    onSuccess: ({ result, id }) => {
      client.setQueryData(queryKeys.addresses, result);
      if (id) onCreated?.(id);
      setOpen(false);
    },
    onError: toastApiError,
  });
  const title = t('account', initial ? 'editAddress' : 'addAddress');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!update.isPending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={initial ? 'outline' : 'primary'}>{title}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-auto">
        <DialogTitle className="pr-10 text-xl font-bold">{title}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t('account', 'addressHint')}
        </DialogDescription>
        <AddressForm
          initial={initial}
          busy={update.isPending}
          save={(value) => update.mutate(value)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function Addresses() {
  const api = useApiClient();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: api.addresses.list,
  });
  const change = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove?: boolean }) =>
      remove
        ? api.addresses.remove(id)
        : api.addresses.update(id, { isDefault: true }),
    onSuccess: (data) => client.setQueryData(queryKeys.addresses, data),
    onError: toastApiError,
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <CustomerError error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <div className="space-y-4">
      <AddressDialog />
      {!query.data.items.length && (
        <EmptyState title={t('account', 'noAddress')} />
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {query.data.items.map((address) => (
          <li key={address.id}>
            <Card className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{address.label}</h2>
                {address.isDefault && (
                  <Badge>{t('account', 'defaultAddress')}</Badge>
                )}
              </div>
              <AddressLines value={address} />
              <div className="flex flex-wrap gap-2">
                <AddressDialog initial={address} />
                {!address.isDefault && (
                  <Button
                    variant="outline"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ id: address.id })}
                  >
                    {t('account', 'setDefault')}
                  </Button>
                )}
                <ConfirmDialog
                  title={t('account', 'deleteAddress')}
                  description={t('account', 'deleteAddressHint')}
                  trigger={
                    <Button variant="ghost" disabled={change.isPending}>
                      {t('account', 'deleteAddress')}
                    </Button>
                  }
                  onConfirm={() =>
                    change.mutate({ id: address.id, remove: true })
                  }
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
