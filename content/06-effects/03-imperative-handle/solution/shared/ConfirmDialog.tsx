import { useImperativeHandle, useRef } from 'react';
import type { ReactNode, Ref } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

/** Что окно открывает наружу через ref: только open() */
export type ConfirmDialogHandle = {
  open: () => void;
};

type ConfirmDialogProps = {
  ref?: Ref<ConfirmDialogHandle>;
  title: string;
  // Текст кнопки подтверждения: «Очистить», «Удалить»
  confirmText: string;
  children: ReactNode;
  // Покупатель подтвердил
  onConfirm: () => void;
};

// Окно подтверждения на <dialog>: модальное, закрывается по Esc и «Отмене»
export function ConfirmDialog({
  ref,
  title,
  confirmText,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Вместо <dialog> родитель получит объект с одним методом
  useImperativeHandle(ref, () => ({
    open() {
      dialogRef.current?.showModal();
    },
  }));

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={(e) => {
        // returnValue — value кнопки, которая закрыла окно
        if (e.currentTarget.returnValue === 'confirm')
          onConfirm();
      }}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{children}</p>
      {/* method="dialog": отправка формы закрывает окно */}
      <form method="dialog" className={styles.actions}>
        <button className={styles.cancel} value="cancel">
          Отмена
        </button>
        <Button type="submit" value="confirm">
          {confirmText}
        </Button>
      </form>
    </dialog>
  );
}
