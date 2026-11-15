import { Schema, type Connection, type Types } from 'mongoose';

export type BannerImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};
export interface Banner {
  _id: Types.ObjectId;
  imageDesktop: BannerImage;
  imageMobile: BannerImage;
  alt: string;
  href: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
export function bannerModels(db: Connection) {
  const image = new Schema<BannerImage>(
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    { _id: false },
  );
  const banner = new Schema<Banner>(
    {
      imageDesktop: { type: image, required: true },
      imageMobile: { type: image, required: true },
      alt: { type: String, required: true },
      href: { type: String, required: true },
      title: String,
      subtitle: String,
      ctaLabel: String,
      startsAt: Date,
      endsAt: Date,
      isActive: { type: Boolean, required: true },
      sortOrder: { type: Number, required: true },
    },
    { timestamps: true },
  );
  banner.index({ isActive: 1, sortOrder: 1 });
  const guard = new Schema<{ _id: string; revision: number }>(
    { _id: String, revision: Number },
    { versionKey: false },
  );
  return {
    banners: db.model('StorefrontBanner', banner, 'web_banners'),
    guard: db.model('StorefrontBannerGuard', guard, 'web_banner_guard'),
  };
}
