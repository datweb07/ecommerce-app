export type MascotState =
  | 'idle'
  | 'wander'
  | 'curious'
  | 'scared'
  | 'happy'
  | 'chase'
  | 'held'
  | 'fall'
  | 'scratch'
  | 'sleep'
  | 'wake';
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type MascotOptions = {
  size: number;
  margin: number;
  walkSpeed: number;
  runSpeed: number;
  sleepAfterMs: number;
};
export type MascotPose = Point & {
  state: MascotState;
  facing: 'left' | 'right';
  frame: number;
  visible: boolean;
  moving: boolean;
};
type Pointer = Point & { kind: 'mouse' | 'touch'; vx: number; vy: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const stepAngles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];

export class MascotEngine {
  private position: Point = { x: 0, y: 0 };
  private target: Point | undefined;
  private viewport = { width: 0, height: 0 };
  private obstacles: readonly Rect[] = [];
  private pointer:
    (Pointer & { changed: number; still: number; anchor: Point }) | undefined;
  private state: MascotState = 'idle';
  private facing: MascotPose['facing'] = 'right';
  private elapsed = 0;
  private until = 0;
  private chaseUntil = 0;
  private startledAt = -Infinity;
  private lastActivity: number;
  private offset: Point = { x: 0, y: 0 };
  private verticalSpeed = 0;
  private bounced = false;
  private visible = false;

  constructor(
    private readonly options: MascotOptions,
    private readonly now = Date.now,
    private readonly random = Math.random,
  ) {
    this.lastActivity = this.now();
    this.rest();
  }

  private get bounds() {
    const { size, margin } = this.options;
    const left = Math.min(
      margin,
      Math.max(0, (this.viewport.width - size) / 2),
    );
    const top = Math.min(
      margin,
      Math.max(0, (this.viewport.height - size) / 2),
    );
    return {
      left,
      top,
      right: Math.max(left, this.viewport.width - size - left),
      bottom: Math.max(top, this.viewport.height - size - top),
    };
  }

  private fit(p: Point): Point {
    const { left, top, right, bottom } = this.bounds;
    return { x: clamp(p.x, left, right), y: clamp(p.y, top, bottom) };
  }

  private safe(p: Point) {
    const { size } = this.options;
    return !this.obstacles.some(
      ({ x, y, width, height }) =>
        p.x + size > x && p.x < x + width && p.y + size > y && p.y < y + height,
    );
  }

  private get center(): Point {
    const radius = this.options.size / 2;
    return { x: this.position.x + radius, y: this.position.y + radius };
  }

  private clearSpace(preferred: Point = this.position) {
    const p = this.fit(preferred);
    const { left, top, right, bottom } = this.bounds;
    if (
      this.viewport.width < this.options.size ||
      this.viewport.height < this.options.size
    ) {
      this.visible = false;
      this.position = p;
      return;
    }
    const xs = [
      left,
      p.x,
      right,
      ...this.obstacles.flatMap((rect) => [
        rect.x - this.options.size,
        rect.x + rect.width,
      ]),
    ];
    const ys = [
      top,
      p.y,
      bottom,
      ...this.obstacles.flatMap((rect) => [
        rect.y - this.options.size,
        rect.y + rect.height,
      ]),
    ];
    let best: Point | undefined;
    let nearest = Infinity;
    if (this.safe(p)) {
      best = p;
    } else {
      for (const x of xs)
        for (const y of ys) {
          const candidate = this.fit({ x, y });
          const d = distance(candidate, p);
          if (d < nearest && this.safe(candidate)) {
            nearest = d;
            best = candidate;
          }
        }
    }
    this.visible = Boolean(best);
    this.position = best ?? p;
    if (this.target) this.target = this.fit(this.target);
  }

  resize(width: number, height: number) {
    const first = this.viewport.width === 0;
    this.viewport = { width, height };
    this.clearSpace(
      first
        ? {
            x: width * 0.18,
            y: height - this.options.size - this.options.margin,
          }
        : undefined,
    );
  }

  avoid(rects: readonly Rect[]) {
    this.obstacles = rects;
    this.clearSpace();
  }

  activity() {
    this.lastActivity = this.now();
    if (this.state === 'sleep') this.enter('wake', 700);
  }

  point(input: Pointer) {
    const old = this.pointer;
    const now = this.now();
    const stable = old?.kind === input.kind && distance(old.anchor, input) < 4;
    this.pointer = {
      ...input,
      changed: now,
      still: stable ? old.still : now,
      anchor: stable ? old.anchor : input,
    };
    this.activity();
  }

  leave() {
    this.pointer = undefined;
    this.chaseUntil = 0;
    if (this.state === 'curious' || this.state === 'chase') this.wander();
  }

  grab(point: Point) {
    this.activity();
    this.offset = {
      x: point.x - this.position.x,
      y: point.y - this.position.y,
    };
    this.enter('held');
  }

  drag(point: Point) {
    if (this.state !== 'held') return;
    this.activity();
    const next = this.fit({
      x: point.x - this.offset.x,
      y: point.y - this.offset.y,
    });
    if (this.safe(next)) this.position = next;
  }

  release() {
    if (this.state !== 'held') return;
    this.verticalSpeed = 0;
    this.bounced = false;
    this.enter('fall');
  }

  tap() {
    this.activity();
    this.enter('happy', 550);
  }

  toggleChase() {
    if (this.pointer?.kind !== 'mouse') return;
    const now = this.now();
    this.chaseUntil = this.chaseUntil > now ? 0 : now + 15_000;
    if (!this.chaseUntil && this.state === 'chase') this.rest();
  }

  private enter(state: MascotState, duration = 0) {
    this.state = state;
    this.elapsed = 0;
    this.until = this.now() + duration;
  }

  private rest() {
    this.target = undefined;
    this.enter('idle', 2_000 + this.random() * 4_000);
  }

  private wander() {
    const { left, top, right, bottom } = this.bounds;
    let target: Point | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      const onWall = this.random() < 0.25;
      const ratio = this.random();
      const x = onWall
        ? ratio < 0.5
          ? left
          : right
        : left + ratio * (right - left);
      const p = { x, y: top + this.random() * (bottom - top) };
      if (this.safe(p) && distance(this.position, p) > 24) {
        target = p;
        break;
      }
    }
    if (!target) return this.rest();
    this.target = target;
    this.enter('wander');
  }

  private go(to: Point, speed: number, seconds: number) {
    const remaining = distance(this.position, to);
    if (remaining < 2) {
      if (this.safe(to)) this.position = to;
      return 'arrived';
    }
    if (!seconds) return 'moving';
    const angle = Math.atan2(to.y - this.position.y, to.x - this.position.x);
    const step = Math.min(remaining, speed * seconds);
    for (const turn of stepAngles) {
      const p = this.fit({
        x: this.position.x + Math.cos(angle + turn) * step,
        y: this.position.y + Math.sin(angle + turn) * step,
      });
      if (distance(p, this.position) < 0.01 || !this.safe(p)) continue;
      this.face(p.x - this.position.x);
      this.position = p;
      if (distance(p, to) < 2 && this.safe(to)) {
        this.position = to;
        return 'arrived';
      }
      return 'moving';
    }
    return 'blocked';
  }

  private face(dx: number) {
    if (Math.abs(dx) > 0.25) this.facing = dx > 0 ? 'right' : 'left';
  }

  private nearPointer(point: Point): Point | undefined {
    const center = this.center;
    const base = Math.atan2(center.y - point.y, center.x - point.x);
    const radius = this.options.size / 2;
    for (const direction of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const angle = base + (direction * Math.PI) / 4;
      const p = this.fit({
        x: point.x + 60 * Math.cos(angle) - radius,
        y: point.y + 60 * Math.sin(angle) - radius,
      });
      const gap = distance(point, { x: p.x + radius, y: p.y + radius });
      if (gap >= 48 && gap <= 64 && this.safe(p)) return p;
    }
  }

  private falling(seconds: number) {
    this.verticalSpeed += 1200 * seconds;
    const nextY = this.position.y + this.verticalSpeed * seconds;
    let floor = this.bounds.bottom;
    const { x, y } = this.position;
    for (const rect of this.obstacles) {
      const edge = rect.y - this.options.size;
      if (
        edge >= y - 0.01 &&
        x + this.options.size > rect.x &&
        x < rect.x + rect.width
      )
        floor = Math.min(floor, edge);
    }
    this.position.y = clamp(nextY, this.bounds.top, floor);
    if (nextY < floor || this.verticalSpeed < 0) return;
    if (this.bounced) {
      this.rest();
    } else {
      this.verticalSpeed = -128;
      this.bounced = true;
    }
  }

  private move(seconds: number, now: number) {
    if (this.state === 'held' || this.state === 'sleep') return;
    if (this.state === 'fall') return this.falling(seconds);
    const mouse = this.pointer?.kind === 'mouse' ? this.pointer : undefined;
    const { walkSpeed, runSpeed, sleepAfterMs, size } = this.options;
    if (now - this.lastActivity >= sleepAfterMs) {
      const corner = { x: this.bounds.left, y: this.bounds.bottom };
      if (
        this.safe(corner) &&
        this.go(corner, walkSpeed, seconds) === 'moving'
      ) {
        if (this.state !== 'wander') this.enter('wander');
      } else this.enter('sleep');
      return;
    }

    if (this.state === 'scared') {
      if (
        this.target &&
        now < this.until &&
        this.go(this.target, runSpeed, seconds) === 'moving'
      )
        return;
      this.rest();
    }

    if (
      mouse &&
      now - mouse.changed < 100 &&
      now - this.startledAt > 1300 &&
      now - mouse.still < 180 &&
      Math.hypot(mouse.vx, mouse.vy) > 650 &&
      distance(mouse, this.center) < 100
    ) {
      const dx = this.center.x - mouse.x;
      const dy = this.center.y - mouse.y;
      if (dx * mouse.vx + dy * mouse.vy > 0) {
        const angle = Math.atan2(dy, dx);
        this.target = this.fit({
          x: this.position.x + 125 * Math.cos(angle),
          y: this.position.y + 125 * Math.sin(angle),
        });
        this.startledAt = now;
        this.enter('scared', 850);
        return;
      }
    }

    if (this.state === 'scratch' && now >= this.until) {
      const next = {
        x: (this.bounds.left + this.bounds.right) / 2,
        y: this.position.y,
      };
      if (this.safe(next)) {
        this.target = next;
        this.enter('wander');
      } else this.wander();
    }
    if (
      this.state === 'happy' ||
      this.state === 'wake' ||
      this.state === 'scratch'
    ) {
      if (now < this.until) return;
      this.rest();
    }

    const chasing = mouse && now < this.chaseUntil;
    const curious = mouse && now - mouse.still >= 1500;
    if (
      mouse &&
      (chasing || curious) &&
      (chasing ||
        this.state === 'curious' ||
        distance(mouse, this.center) > size + 28)
    ) {
      const point = this.nearPointer(mouse);
      if (point) {
        const state = chasing ? 'chase' : 'curious';
        if (this.state !== state) this.enter(state);
        if (
          this.go(point, chasing ? runSpeed : walkSpeed, seconds) === 'arrived'
        )
          this.face(mouse.x - this.center.x);
        return;
      }
    }
    if (this.state === 'curious' || this.state === 'chase') this.rest();

    if (this.state === 'idle' && now >= this.until) this.wander();
    if (this.state === 'wander' && this.target) {
      const result = this.go(this.target, walkSpeed, seconds);
      if (
        result === 'arrived' &&
        (this.position.x === this.bounds.left ||
          this.position.x === this.bounds.right)
      ) {
        this.face(this.position.x === this.bounds.left ? -1 : 1);
        this.enter('scratch', 2000);
      } else if (result !== 'moving') this.rest();
    }
  }

  update(dtMs: number): MascotPose {
    const step = clamp(dtMs, 0, 50);
    const before = this.position;
    const previous = { x: before.x, y: before.y };
    if (this.visible) this.move(step / 1000, this.now());
    this.elapsed += step;
    const moving = distance(this.position, previous) > 0.01;
    const jumping = this.state === 'happy' || this.state === 'scared';
    const jump = jumping
      ? 12 * Math.sin(Math.PI * Math.min(this.elapsed / 300, 1))
      : 0;
    const lifted = this.fit({ x: this.position.x, y: this.position.y - jump });
    const p = this.safe(lifted) ? lifted : this.position;
    return {
      ...p,
      visible: this.visible,
      state: this.state,
      facing: this.facing,
      moving,
      frame: Math.floor(this.elapsed / (moving ? 135 : 320)),
    };
  }
}
