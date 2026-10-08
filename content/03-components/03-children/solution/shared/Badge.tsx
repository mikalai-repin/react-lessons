import type { ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeProps = {
  children: ReactNode;
  tone?: 'accent' | 'dark' | 'warning';
};

// Бейдж: короткая метка на цветной плашке — «−20%», «Хит»
export function Badge({
  children,
  tone = 'accent',
}: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {children}
    </span>
  );
}
