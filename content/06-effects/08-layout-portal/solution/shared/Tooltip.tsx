import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

// Отступ подсказки от элемента и от края окна, px
const GAP = 8;

type TooltipProps = {
  text: string;
  children: ReactNode;
};

type Position = { top: number; left: number };

// Подсказка при наведении и фокусе: не выходит за правый край окна
export function Tooltip({ text, children }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Где показать подсказку; null — ещё не измерили
  const [position, setPosition] = useState<Position | null>(
    null,
  );
  // Уникальный id: связать элемент с подсказкой для экранного диктора
  const tipId = useId();

  // Замер после фиксации, но до отрисовки: подсказка уже в DOM,
  // её размер известен, а браузер её ещё не показал
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current!.getBoundingClientRect();
    const tip = tipRef.current!.getBoundingClientRect();
    // Под элементом, но не правее края окна
    const left = Math.min(
      anchor.left,
      window.innerWidth - tip.width - GAP,
    );
    setPosition({ top: anchor.bottom + GAP, left });
  }, [open]);

  function show() {
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setPosition(null);
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={styles.tooltip}
            style={position ?? undefined}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
