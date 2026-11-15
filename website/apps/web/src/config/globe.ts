import { z } from 'zod';
import { t } from '../lib/i18n';

const duration = z.number().int().min(100).max(10000);
const marker = z.strictObject({
  id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().trim().min(1),
  address: z.string().trim().min(1).optional(),
  mapZoom: z.number().min(0).max(22).default(14),
});

export const globeSchema = z.strictObject({
  markers: z.array(marker),
  rotationSecondsPerTurn: z.number().min(20).max(180).default(60),
  tiltDeg: z.number().min(-30).max(30).default(15),
  dotCount: z
    .strictObject({
      desktop: z.number().int().min(8000).max(14000),
      mobile: z.number().int().min(4000).max(8000),
    })
    .default({ desktop: 11000, mobile: 6000 }),
  timing: z
    .strictObject({
      orient: duration,
      dolly: duration,
      crossfade: duration,
      fly: duration,
      cancel: duration,
    })
    .default({
      orient: 1400,
      dolly: 3200,
      crossfade: 800,
      fly: 2800,
      cancel: 1200,
    }),
});

export const globeConfig = globeSchema.parse({
  markers: [
    // PLACEHOLDER: city-center coordinates for demonstration only.
    {
      id: 'preview',
      lat: 10.7769,
      lng: 106.7009,
      label: t('globe', 'sampleLocation'),
    },
  ],
});

export type GlobeConfig = z.output<typeof globeSchema>;
export type GlobeMarker = z.output<typeof marker>;
