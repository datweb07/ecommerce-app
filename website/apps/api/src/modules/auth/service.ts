import { Types, type ClientSession, type Connection } from 'mongoose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Webhook } from 'svix';
import type { z } from 'zod';
import type { profilePatch, svixHeaders } from '@storefront/shared';
import type { ClerkAdapter, Identity } from '../../plugins/clerk.js';
import { ApiError } from '../../plugins/errors.js';
import { userModels, type User } from '../../models/user.js';
import {
  duplicateKey,
  receiptExpiry,
  webhookEvents,
} from '../../models/webhook-event.js';
import { clerkIdentityPayload, eventEnvelope, userEvent } from './schemas.js';

declare module 'fastify' {
  interface FastifyRequest {
    storefrontUser: User;
  }
}

export function authService(
  db: Connection,
  clerk?: ClerkAdapter,
  adminEmail?: string,
  signingSecret?: string,
) {
  const { users, identities } = userModels(db);
  const receipts = webhookEvents(db);
  const verifier = signingSecret ? new Webhook(signingSecret) : undefined;
  const unauthorized = () =>
    new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập.');

  async function upsert(
    clerkId: string,
    identity: Identity,
    session: ClientSession,
  ) {
    return users
      .findOneAndUpdate(
        { clerkId },
        {
          $set: {
            name: identity.name,
            email: identity.email,
            imageUrl: identity.imageUrl,
          },
          $setOnInsert: {
            _id: new Types.ObjectId(),
            bio: '',
            expoPushToken: '',
            addresses: [],
            wishlist: [],
          },
        },
        { upsert: true, new: true, session },
      )
      .lean()
      .orFail();
  }

  async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    reply.header('cache-control', 'private, no-store');
    const authorization = request.headers.authorization;
    if (
      !authorization ||
      !/^Bearer [A-Za-z0-9_.-]{1,8192}$/i.test(authorization)
    )
      throw unauthorized();
    if (!clerk)
      throw new ApiError(
        503,
        'CLERK_UNCONFIGURED',
        'Dịch vụ đăng nhập chưa được cấu hình.',
      );
    const clerkId = await clerk.authenticate(authorization);
    if (!clerkId) throw unauthorized();
    const state = await identities.findById(clerkId).lean();
    if (state?.deleted) throw unauthorized();
    let user = await users.findOne({ clerkId }).lean();
    if (!user) {
      const identity = await clerk.identity(clerkId);
      if (!identity) throw unauthorized();
      for (let attempt = 0; ; attempt++) {
        try {
          user = await db.transaction(async (session) => {
            const locked = await identities
              .findOneAndUpdate(
                { _id: clerkId },
                {
                  $inc: { fence: 1 },
                  $setOnInsert: { timestamp: 0, deleted: false },
                },
                { new: true, upsert: true, session },
              )
              .lean()
              .orFail();
            if (locked.deleted) throw unauthorized();
            return (
              (await users.findOne({ clerkId }).session(session).lean()) ??
              (await upsert(clerkId, identity, session))
            );
          });
          break;
        } catch (error) {
          if (!duplicateKey(error) || attempt >= 2) throw error;
          if ((await identities.findById(clerkId).lean())?.deleted)
            throw unauthorized();
          user = await users.findOne({ clerkId }).lean();
          if (user) break;
        }
      }
    }
    request.storefrontUser = user;
  }

  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    await requireAuth(request, reply);
    const identity = adminEmail
      ? await clerk?.identity(request.storefrontUser.clerkId)
      : undefined;
    if (
      !identity?.verified ||
      identity.email.toLowerCase() !== adminEmail?.toLowerCase()
    ) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền quản trị.');
    }
  }

  function profile(user: User) {
    return {
      id: user._id.toString(),
      name: user.name,
      imageUrl: user.imageUrl ?? '',
      bio: user.bio ?? '',
      userName: user.userName || null,
    };
  }

  async function patch(user: User, changes: z.infer<typeof profilePatch>) {
    try {
      const updated = await users
        .findOneAndUpdate(
          { _id: user._id, clerkId: user.clerkId },
          { $set: changes },
          { new: true, runValidators: true },
        )
        .lean();
      if (!updated) throw unauthorized();
      return profile(updated);
    } catch (error) {
      if (duplicateKey(error))
        throw new ApiError(
          409,
          'USERNAME_TAKEN',
          'Tên người dùng đã được sử dụng.',
        );
      throw error;
    }
  }

  async function receive(raw: string, headers: z.infer<typeof svixHeaders>) {
    if (!verifier)
      throw new ApiError(
        503,
        'CLERK_WEBHOOK_UNCONFIGURED',
        'Webhook chưa được cấu hình.',
      );
    let payload: unknown;
    try {
      verifier.verify(raw, headers);
      payload = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'INVALID_WEBHOOK', 'Webhook không hợp lệ.');
    }
    const envelope = eventEnvelope.safeParse(payload);
    if (!envelope.success)
      throw new ApiError(400, 'INVALID_WEBHOOK', 'Webhook không hợp lệ.');
    if (
      !['user.created', 'user.updated', 'user.deleted'].includes(
        envelope.data.type,
      )
    )
      return;
    const parsed = userEvent.safeParse(payload);
    if (!parsed.success)
      throw new ApiError(400, 'INVALID_WEBHOOK', 'Webhook không hợp lệ.');
    const event = parsed.data;
    const receipt = 'clerk:' + headers['svix-id'];
    const clerkId = event.data.id;
    const deleted = event.type === 'user.deleted';
    const timestamp = deleted
      ? event.timestamp
      : (event.data.updated_at ?? event.timestamp);
    for (let attempt = 0; ; attempt++) {
      try {
        await db.transaction(async (session) => {
          if (await receipts.exists({ _id: receipt }).session(session)) return;
          await receipts.create(
            [{ _id: receipt, expiresAt: receiptExpiry() }],
            { session },
          );
          const state = await identities
            .findById(clerkId)
            .session(session)
            .lean();
          if (
            state?.deleted ||
            (state &&
              (state.timestamp > timestamp ||
                (!deleted && state.timestamp === timestamp)))
          )
            return;
          if (deleted) {
            await users.deleteOne({ clerkId }, { session });
            await db.collection('carts').deleteOne({ clerkId }, { session });
          } else {
            const data = clerkIdentityPayload.safeParse(
              (payload as { data: unknown }).data,
            );
            if (!data.success)
              throw new ApiError(
                400,
                'INVALID_WEBHOOK',
                'Dữ liệu tài khoản không hợp lệ.',
              );
            const details = data.data;
            const email = details.email_addresses.find(
              (entry) => entry.id === details.primary_email_address_id,
            );
            if (email) {
              await upsert(
                clerkId,
                {
                  email: email.email_address,
                  verified: email.verification?.status === 'verified',
                  name:
                    [details.first_name, details.last_name]
                      .filter(Boolean)
                      .join(' ') || 'Khách hàng',
                  imageUrl:
                    details.image_url ?? details.profile_image_url ?? '',
                },
                session,
              );
            }
          }
          await identities.updateOne(
            { _id: clerkId },
            { $set: { timestamp, deleted }, $inc: { fence: 1 } },
            { upsert: true, session },
          );
        });
        return;
      } catch (error) {
        if (!duplicateKey(error)) throw error;
        if (await receipts.exists({ _id: receipt })) return;
        if (attempt >= 2) throw error;
      }
    }
  }
  return {
    users,
    receipts,
    identities,
    requireAuth,
    requireAdmin,
    profile,
    patch,
    receive,
  };
}

export type AuthService = ReturnType<typeof authService>;
