export function productImageUrl(value: string | undefined) {
  if (!value) return undefined;
  const url = URL.canParse(value) ? new URL(value) : null;
  if (
    url?.protocol === 'https:' &&
    !url.port &&
    !url.username &&
    !url.password &&
    ['res.cloudinary.com', 'images.unsplash.com'].includes(url.hostname)
  )
    return url.href;
}
