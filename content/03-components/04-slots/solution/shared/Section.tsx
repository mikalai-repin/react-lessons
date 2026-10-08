import type { ReactNode } from 'react';
import styles from './Section.module.css';

type SectionProps = {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
};

// Раздел страницы: заголовок, дополнение рядом с ним и содержимое
export function Section({
  title,
  extra,
  children,
}: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
