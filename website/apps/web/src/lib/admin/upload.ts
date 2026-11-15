import {
  maxProductImageBytes,
  uploadSignatureInput,
  type uploadSignatureDto,
} from '@storefront/shared';
import { z } from 'zod';
import { ApiError } from '../api/transport';
import { t } from '../i18n';

export type UploadSignature = z.infer<typeof uploadSignatureDto>;
type UploadInput = z.input<typeof uploadSignatureInput>;
type Sign = (body: UploadInput) => Promise<UploadSignature>;
export type UploadPurpose = NonNullable<UploadInput['purpose']>;
export type Placement = 'desktop' | 'mobile';
export const imageAccept =
  uploadSignatureInput.shape.contentType.options.join(',');
export const maxProductImages = 5;

function uploadError(
  code: 'unsupportedImage' | 'largeImage' | 'invalidImage' | 'uploadFailed',
) {
  return new ApiError(400, code, t('admin', code));
}
export function imageFileInput(
  file: File,
  purpose: UploadPurpose,
): UploadInput {
  const mime = uploadSignatureInput.shape.contentType.safeParse(file.type);
  if (!mime.success) throw uploadError('unsupportedImage');
  if (file.size > maxProductImageBytes) throw uploadError('largeImage');
  if (!file.size) throw uploadError('invalidImage');
  return { sizeBytes: file.size, contentType: mime.data, purpose };
}
export function bannerImageFits(
  placement: Placement,
  width: number,
  height: number,
) {
  const [minimumWidth, minimumHeight] =
    placement === 'desktop' ? [1200, 500] : [540, 675];
  return (
    width >= minimumWidth &&
    height >= minimumHeight &&
    Math.abs(width / height / (minimumWidth / minimumHeight) - 1) <= 0.03
  );
}
const cloudinaryImage = z.object({
  secure_url: z
    .url()
    .refine((value) => new URL(value).origin === 'https://res.cloudinary.com'),
  public_id: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type UploadedAsset = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};

function transfer(
  signature: UploadSignature,
  file: File,
  progress: (percent: number) => void,
) {
  return new Promise<UploadedAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', signature.uploadUrl);
    xhr.responseType = 'json';
    xhr.timeout = 90_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    const fail = () => reject(uploadError('uploadFailed'));
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.onabort = fail;
    xhr.onload = () => {
      const result = cloudinaryImage.safeParse(xhr.response);
      if (
        xhr.status < 200 ||
        xhr.status >= 300 ||
        !result.success ||
        result.data.public_id !== signature.params.public_id
      )
        return fail();
      const {
        secure_url: url,
        public_id: publicId,
        width,
        height,
      } = result.data;
      progress(100);
      resolve({ url, publicId, width, height });
    };
    const payload = new FormData();
    payload.set('file', file);
    payload.set('api_key', signature.apiKey);
    payload.set('signature', signature.signature);
    for (const [name, value] of Object.entries(signature.params))
      payload.set(name, String(value));
    xhr.send(payload);
  });
}

export async function uploadAdminImage({
  file,
  sign,
  purpose,
  placement,
  progress,
}: {
  file: File;
  sign: Sign;
  purpose: UploadPurpose;
  placement?: Placement;
  progress: (percent: number) => void;
}) {
  const params = imageFileInput(file, purpose);
  if (placement) {
    const image = await createImageBitmap(file).catch(() => {
      throw uploadError('invalidImage');
    });
    const fits = bannerImageFits(placement, image.width, image.height);
    image.close();
    if (!fits) throw uploadError('invalidImage');
  }
  const signature = await sign(params);
  if (file.size > signature.maxBytes) throw uploadError('largeImage');
  return transfer(signature, file, progress);
}
export function uploadErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return t('admin', 'uploadFailed');
  const keys = [
    'unsupportedImage',
    'largeImage',
    'invalidImage',
    'uploadFailed',
  ] as const;
  const key = keys.find((value) => error.code === value);
  return key ? t('admin', key) : undefined;
}
