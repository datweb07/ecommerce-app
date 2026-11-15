import { describe, expect, it } from 'vitest';
import { MascotEngine, type MascotPose } from '../src/lib/mascot/engine';

const settings = {
  size: 48,
  margin: 16,
  walkSpeed: 120,
  runSpeed: 260,
  sleepAfterMs: 45_000,
};
function fixture(random = () => 0.62) {
  let now = 0;
  const engine = new MascotEngine(settings, () => now, random);
  engine.resize(420, 360);
  function tick(ms = 16) {
    now += ms;
    return engine.update(ms);
  }
  function advance(ms: number) {
    let pose = engine.update(0);
    for (let elapsed = 0; elapsed < ms; elapsed += 16)
      pose = tick(Math.min(16, ms - elapsed));
    return pose;
  }
  return { engine, tick, advance };
}
const centerDistance = (pose: MascotPose, x: number, y: number) =>
  Math.hypot(pose.x + 24 - x, pose.y + 24 - y);
describe('mascot engine', () => {
  it('rests, travels to a random point and sits again', () => {
    const { tick, advance } = fixture();
    const start = tick(0);
    expect(start.state).toBe('idle');
    expect(advance(4500).state).toBe('wander');
    const end = advance(2200);
    expect(end.state).toBe('idle');
    expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeGreaterThan(40);
  });
  it('approaches a still mouse and sits 48–64px from it', () => {
    const { engine, advance } = fixture();
    const point = { x: 348, y: 108, vx: 0, vy: 0, kind: 'mouse' as const };
    engine.point(point);
    expect(advance(1490).state).toBe('idle');
    expect(advance(20).state).toBe('curious');
    const near = advance(3900);
    expect(near.state).toBe('curious');
    expect(centerDistance(near, point.x, point.y)).toBeGreaterThanOrEqual(48);
    expect(centerDistance(near, point.x, point.y)).toBeLessThanOrEqual(64);
    expect(near.facing).toBe('right');
    engine.leave();
    expect(engine.update(0).state).toBe('wander');
  });
  it('jumps and runs away when a mouse rushes toward it', () => {
    const { engine, tick } = fixture();
    const start = tick(0);
    engine.point({
      x: start.x - 32,
      y: start.y + 24,
      vx: 1400,
      vy: 0,
      kind: 'mouse',
    });
    expect(tick().state).toBe('scared');
    const moving = tick(45);
    expect(moving.x).toBeGreaterThan(start.x);
    expect(moving.y).toBeLessThan(start.y);
  });
  it('sleeps after inactivity and stretches when there is input', () => {
    const { engine, advance } = fixture();
    expect(advance(51_000).state).toBe('sleep');
    engine.activity();
    expect(engine.update(16).state).toBe('wake');
    expect(advance(750).state).toBe('idle');
  });
  it('holds the pointer offset, drops with one bounce and lands at the bottom', () => {
    const { engine, advance, tick } = fixture();
    const p = tick(0);
    engine.grab({ x: p.x + 24, y: p.y + 18 });
    engine.drag({ x: 242, y: 90 });
    expect(tick()).toMatchObject({ x: 218, y: 72, state: 'held' });
    engine.release();
    expect(advance(110)).toMatchObject({ state: 'fall' });
    let firstLand = false;
    let bounced = false;
    for (let i = 0; i < 80; i++) {
      const pose = tick();
      if (pose.y === 296) firstLand = true;
      if (firstLand && pose.y < 296) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(engine.update(0)).toMatchObject({ state: 'idle', y: 296 });
  });
  it('avoids a protected region and clamps resized or obstructed viewports', () => {
    const { engine, tick } = fixture();
    const zone = { x: 125, y: 160, width: 95, height: 200 };
    engine.avoid([zone]);
    for (let i = 0; i < 400; i++) {
      const { x, y } = tick();
      expect(
        x < zone.x + zone.width &&
          x + settings.size > zone.x &&
          y < zone.y + zone.height &&
          y + settings.size > zone.y,
      ).toBe(false);
    }
    engine.resize(120, 114);
    const pose = tick(0);
    expect(pose.x + settings.size).toBeLessThanOrEqual(120);
    expect(pose.y + settings.size).toBeLessThanOrEqual(114);
    engine.avoid([{ x: 0, y: 0, width: 120, height: 114 }]);
    expect(tick(0).visible).toBe(false);
    engine.avoid([]);
    expect(tick(0).visible).toBe(true);
  });
  it('caps a suspended frame and ignores touch for cursor behavior', () => {
    const { engine, tick } = fixture();
    const start = tick(0);
    engine.point({
      x: start.x - 12,
      y: start.y + 24,
      vx: 1800,
      vy: 0,
      kind: 'touch',
    });
    engine.toggleChase();
    expect(tick().state).toBe('idle');
    const after = tick(10_000);
    expect(after.state).toBe('wander');
    expect(
      Math.hypot(after.x - start.x, after.y - start.y),
    ).toBeLessThanOrEqual(6.01);
  });
  it('bounds chase mode to 15 seconds and reacts to a tap', () => {
    const { engine, advance, tick } = fixture();
    engine.point({ x: 296, y: 120, vx: 0, vy: 0, kind: 'mouse' });
    engine.tap();
    expect(tick().state).toBe('happy');
    engine.toggleChase();
    expect(advance(680).state).toBe('chase');
    expect(advance(14_500).state).not.toBe('chase');
  });
  it('scratches a wall before departing', () => {
    const { engine, advance } = fixture(() => 0.1);
    expect(advance(3000).state).toBe('wander');
    expect(advance(2000).state).toBe('scratch');
    expect(advance(2000).state).toBe('wander');
    expect(engine.update(0).facing).toBe('right');
  });
});
