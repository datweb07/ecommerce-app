import { Schema, type Connection, type Types } from 'mongoose';

export interface Address {
  _id: Types.ObjectId;
  label: string;
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  isDefault: boolean;
}
export interface User {
  _id: Types.ObjectId;
  clerkId: string;
  name: string;
  email: string;
  imageUrl?: string;
  bio?: string;
  userName?: string;
  expoPushToken?: string;
  wishlist: Types.ObjectId[];
  addresses: Address[];
}
const address = new Schema<Address>({
  label: { type: String, required: true },
  fullName: { type: String, required: true },
  streetAddress: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});
export function userModels(db: Connection) {
  const users = new Schema<User>(
    {
      clerkId: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      imageUrl: { type: String, default: '' },
      bio: { type: String, default: '', maxlength: 500 },
      userName: { type: String, unique: true, sparse: true },
      expoPushToken: { type: String, default: '' },
      wishlist: [Schema.Types.ObjectId],
      addresses: [address],
    },
    { timestamps: true },
  );
  const identities = new Schema<{
    _id: string;
    timestamp: number;
    deleted: boolean;
    fence: number;
  }>(
    {
      _id: String,
      timestamp: Number,
      deleted: Boolean,
      fence: Number,
    },
    { versionKey: false },
  );
  return {
    users: db.model('StorefrontUser', users, 'users'),
    identities: db.model(
      'StorefrontIdentity',
      identities,
      'web_clerk_identities',
    ),
  };
}
