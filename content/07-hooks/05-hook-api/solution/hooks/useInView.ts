import { useEffect, useEffectEvent } from 'react';
import type { RefObject } from 'react';

// Вызывает onEnter, когда элемент из ref появился на экране.
// onEnter может быть новой функцией при каждом рендере —
// наблюдение от этого не перезапускается
export function useInView(
  ref: RefObject<Element | null>,
  onEnter: () => void,
) {
  const onVisible = useEffectEvent(onEnter);

  // Синхронизация с IntersectionObserver: следим, виден ли элемент
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onVisible();
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [ref]);
}
