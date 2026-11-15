import { z } from 'zod';
import type { MascotState } from '../lib/mascot/engine';

export const hiddenMascotPaths = z
  .array(z.string().regex(/^\/(?!\/)/))
  .parse(['/checkout', '/admin', '/sign-in', '/sign-up', '/_dev']);

const state = z.enum([
  'idle',
  'wander',
  'curious',
  'scared',
  'happy',
  'chase',
  'held',
  'fall',
  'scratch',
  'sleep',
  'wake',
] satisfies MascotState[]);
const animation = z.object({
  frames: z.array(z.number().int().nonnegative()).min(1),
  mirror: z.boolean(),
});
const schema = z
  .object({
    size: z.number().int().min(24).max(96),
    margin: z.number().min(0).max(80),
    walkSpeed: z.number().positive().max(500),
    runSpeed: z.number().positive().max(900),
    sleepAfterMs: z.number().int().min(1000),
    sprite: z.object({
      source: z.string().regex(/^\/mascot\/[\w.-]+$/),
      cellSize: z.number().int().positive(),
      columns: z.number().int().positive(),
      rows: z.number().int().positive(),
      poses: z.record(state, z.object({ left: animation, right: animation })),
    }),
  })
  .refine(
    ({ sprite }) =>
      Object.values(sprite.poses).every(({ left, right }) =>
        [...left.frames, ...right.frames].every(
          (frame) => frame < sprite.columns * sprite.rows,
        ),
      ),
    { path: ['sprite', 'poses'], message: 'Khung hình nằm ngoài sprite.' },
  );

function mirrored(...frames: number[]) {
  return { left: { frames, mirror: true }, right: { frames, mirror: false } };
}

export const mascotConfig = schema.parse({
  size: 48,
  margin: 16,
  walkSpeed: 112,
  runSpeed: 244,
  sleepAfterMs: 45_000,
  sprite: {
    source: '/mascot/shop-cat.svg',
    cellSize: 32,
    columns: 4,
    rows: 3,
    poses: {
      idle: mirrored(0, 0, 0, 0, 0, 1),
      wander: mirrored(2, 3),
      curious: mirrored(4),
      scared: mirrored(5, 3),
      happy: mirrored(6),
      chase: mirrored(2, 3),
      held: mirrored(7),
      fall: mirrored(7),
      scratch: mirrored(9, 11),
      sleep: mirrored(8),
      wake: mirrored(10),
    },
  },
});
