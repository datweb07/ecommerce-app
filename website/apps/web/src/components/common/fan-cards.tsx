import type { ReactNode } from 'react';
import { fanCardPose } from '../../lib/fan-cards';
import { cn } from '../../lib/utils';
import styles from './fan-cards.module.css';

type Item = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
};

export function FanCards({
  items,
  className,
  id,
}: {
  items: readonly Item[];
  className?: string;
  id?: string;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Restore list semantics in Safari when CSS removes markers.
    <ul
      id={id}
      tabIndex={id ? -1 : undefined}
      role="list"
      className={cn(
        styles.fan,
        'scroll-mt-24 border-t border-border',
        className,
      )}
      data-fan-cards
      data-mascot-avoid=""
      data-fan-three={items.length === 3 ? '' : undefined}
    >
      {items.map(({ id: itemId, title, description, icon }, index) => (
        <li
          key={itemId}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Informational cards mirror hover for keyboard users.
          tabIndex={0}
          aria-label={title}
          className={cn(
            styles.slot,
            fanCardPose(index, items.length).className,
          )}
          data-fan-slot
        >
          <div className={styles.face} data-fan-face>
            <div className={styles.copy} data-fan-copy>
              <div className={styles.icon} aria-hidden="true">
                {icon}
              </div>
              <h2 className="text-body font-medium">{title}</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
