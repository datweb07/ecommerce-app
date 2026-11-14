'use client';
import { UserProfile, useUser } from '@clerk/nextjs';
import { profilePatch } from '@storefront/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { useApiClient } from '../../lib/api/browser';
import { t } from '../../lib/i18n';
import { queryKeys } from '../../lib/query';
import { Input, Label, Textarea } from '../ui/fields';
import { useZodForm } from '../ui/form';
import { Button } from '../ui/button';
import { Card } from '../ui/panels';
import { toastApiError } from '../ui/sonner';
import { LoadingSkeleton } from '../common/states';
import { CustomerError } from './states';
import { ProductImage } from '../catalogue/product-image';

const clerkAvatarHosts = ['img.clerk.com', 'images.clerk.dev'];
export function Identity() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <LoadingSkeleton variant="form" />;
  if (!user) return null;
  const image = URL.canParse(user.imageUrl) ? new URL(user.imageUrl) : null;
  const avatar =
    image &&
    image.protocol === 'https:' &&
    clerkAvatarHosts.includes(image.hostname)
      ? image.href
      : undefined;
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="relative size-16 overflow-hidden rounded-full">
        <ProductImage
          source={avatar}
          allowClerk
          alt={user.fullName ?? t('account', 'profile')}
          sizes="64px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 wrap-anywhere">
        <p className="font-bold">{user.fullName}</p>
        <p className="text-muted-foreground">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/account/security">{t('account', 'manageIdentity')}</Link>
      </Button>
    </Card>
  );
}

function ProfileForm({
  bio,
  userName,
}: {
  bio: string;
  userName: string | null;
}) {
  const api = useApiClient();
  const client = useQueryClient();
  const form = useZodForm(profilePatch, {
    defaultValues: { bio, userName: userName ?? '' },
  });
  const mutation = useMutation({
    mutationFn: api.me.update,
    onSuccess: (data) => {
      client.setQueryData(queryKeys.me, data);
      form.reset({ bio: data.bio, userName: data.userName ?? '' });
      toast.success(t('account', 'saved'));
    },
    onError: toastApiError,
  });
  return (
    <Card>
      <form
        noValidate
        className="grid gap-3"
        onSubmit={form.handleSubmit((value) => {
          mutation.mutate({
            bio: value.bio ?? '',
            ...(value.userName ? { userName: value.userName } : {}),
          });
        })}
      >
        <Label htmlFor="profile-username">{t('account', 'userName')}</Label>
        <Input
          id="profile-username"
          aria-invalid={Boolean(form.formState.errors.userName)}
          maxLength={32}
          {...form.register('userName', {
            setValueAs: (value: string) => value.trim() || undefined,
          })}
        />
        {form.formState.errors.userName && (
          <p role="alert" className="text-sm text-destructive">
            {t('account', 'userNameHint')}
          </p>
        )}
        <Label htmlFor="profile-bio">{t('account', 'bio')}</Label>
        <Textarea id="profile-bio" maxLength={500} {...form.register('bio')} />
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="justify-self-start"
        >
          {t('account', 'save')}
        </Button>
      </form>
    </Card>
  );
}
export function Profile() {
  const api = useApiClient();
  const query = useQuery({ queryKey: queryKeys.me, queryFn: api.me.get });
  return (
    <div className="grid gap-4">
      <Identity />
      {query.isPending ? (
        <LoadingSkeleton variant="form" />
      ) : query.isError ? (
        <CustomerError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ProfileForm bio={query.data.bio} userName={query.data.userName} />
      )}
    </div>
  );
}
export function AccountSecurity() {
  return (
    <div className="min-w-0 overflow-x-auto">
      <UserProfile routing="hash" />
    </div>
  );
}
