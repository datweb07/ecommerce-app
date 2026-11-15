import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { SceneLoader } from './scene-loader';

export type SceneKind = 'hero' | 'package' | 'empty';

function ScenePoster({ kind }: { kind: SceneKind }) {
  return (
    <svg
      viewBox="0 0 144 108"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
      focusable="false"
    >
      {kind === 'hero' ? (
        <g>
          <path
            d="M72 16 109 44 94 81 53 90 32 52 72 16Z"
            fill="var(--muted)"
          />
          <path d="M72 16 68 53 109 44M68 53 94 81M68 53 53 90M32 52 68 53" />
        </g>
      ) : kind === 'package' ? (
        <g>
          <path d="M35 39 72 24 109 39V70L72 87 35 70Z" fill="var(--muted)" />
          <path d="m35 39 37 17 37-17M72 56v31M54 31l37 17" />
        </g>
      ) : (
        <g>
          <path d="M42 54 72 40 102 54 72 68Z" fill="var(--muted)" />
          <path d="M42 54v21l30 14 30-14V54M72 68v21M72 19v12M57 26l6 8m24-8-6 8" />
        </g>
      )}
    </svg>
  );
}

function Scene3D({
  kind,
  className,
  poster,
  staticOnly = false,
}: {
  kind: SceneKind;
  className?: string;
  poster?: ReactNode;
  staticOnly?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none relative aspect-[4/3]', className)}
      data-scene={kind}
    >
      <div className="absolute inset-0">
        {poster ?? <ScenePoster kind={kind} />}
      </div>
      {!staticOnly && <SceneLoader kind={kind} />}
    </div>
  );
}

type ObjectProps = { className?: string; staticOnly?: boolean };

export function HeroObject(props: ObjectProps) {
  return <Scene3D kind="hero" {...props} />;
}

export function PackageScene(props: ObjectProps & { poster?: ReactNode }) {
  return <Scene3D kind="package" {...props} />;
}

export function EmptyObject3D(props: ObjectProps) {
  return <Scene3D kind="empty" {...props} />;
}
