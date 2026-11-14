'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  FormProvider,
  useForm,
  type FieldValues,
  type UseFormProps,
} from 'react-hook-form';
import type { z } from 'zod';

export const Form = FormProvider;
export function useZodForm<
  Input extends FieldValues,
  Output extends FieldValues,
>(
  schema: z.ZodType<Output, Input>,
  options?: Omit<UseFormProps<Input, unknown, Output>, 'resolver'>,
) {
  return useForm<Input, unknown, Output>({
    ...options,
    resolver: zodResolver(schema),
  });
}
