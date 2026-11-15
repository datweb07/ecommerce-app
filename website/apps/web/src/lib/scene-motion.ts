type PackagePose = {
  yaw: number;
  lid: number;
  offset: number;
  tracking: number;
};

const packageKeyframes = [
  { yaw: -0.65, lid: 0, offset: -0.15, tracking: 0 },
  { yaw: -0.15, lid: -1.35, offset: 0, tracking: 0 },
  { yaw: 0.45, lid: 0, offset: 0.05, tracking: 0 },
  { yaw: 0.85, lid: 0, offset: 0.22, tracking: 1 },
] as const satisfies readonly PackagePose[];

export function packagePose(progress: number): PackagePose {
  const last = packageKeyframes.length - 1;
  const position =
    (Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0) * last;
  const index = Math.min(Math.floor(position), last - 1);
  const from = packageKeyframes[index] ?? packageKeyframes[0];
  const to = packageKeyframes[index + 1] ?? from;
  const part = position - index;
  const eased = part * part * (3 - 2 * part);
  const mix = (start: number, end: number) => start + (end - start) * eased;
  return {
    yaw: mix(from.yaw, to.yaw),
    lid: mix(from.lid, to.lid),
    offset: mix(from.offset, to.offset),
    tracking: mix(from.tracking, to.tracking),
  };
}

let webGLAvailable: boolean | undefined;

export function detectCapabilities(
  motion: MediaQueryList,
  hardware: Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  },
  probe = () => {
    if (webGLAvailable !== undefined) return webGLAvailable;
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      return (webGLAvailable = Boolean(context));
    } catch {
      return (webGLAvailable = false);
    }
  },
) {
  return (
    !motion.matches &&
    !hardware.connection?.saveData &&
    (hardware.hardwareConcurrency || Infinity) > 2 &&
    (hardware.deviceMemory || Infinity) > 2 &&
    probe()
  );
}
