const poses = [
  { angle: -6, drop: 12, className: '[--fan-angle:-6deg] [--fan-drop:12px]' },
  { angle: 0, drop: 0, className: '[--fan-angle:0deg] [--fan-drop:0px]' },
  { angle: 6, drop: 12, className: '[--fan-angle:6deg] [--fan-drop:12px]' },
] as const;

export function fanCardPose(index: number, count: number) {
  return count === 3 ? (poses[index] ?? poses[1]) : poses[1];
}
