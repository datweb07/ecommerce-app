'use client';
import { SignIn, SignUp } from '@clerk/nextjs';
import { publicEnv } from '../../config/public-env';
import { Card } from '../ui/panels';

export function AuthScreen({ register = false }: { register?: boolean }) {
  if (!publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    return (
      <Card>
        <h1 className="text-2xl font-bold">
          {register ? 'Đăng ký' : 'Đăng nhập'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Xác thực cần được cấu hình trước khi sử dụng.
        </p>
      </Card>
    );
  return register ? (
    <SignUp
      path={publicEnv.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInUrl={publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      fallbackRedirectUrl={
        publicEnv.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
      }
    />
  ) : (
    <SignIn
      path={publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={publicEnv.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      fallbackRedirectUrl={
        publicEnv.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
      }
    />
  );
}
