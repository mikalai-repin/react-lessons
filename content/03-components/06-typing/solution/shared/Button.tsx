import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'>;

// Кнопка магазина: всё, что умеет <button>, и оформление .button из styles.css
export function Button({
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `button ${className}` : 'button'}
      {...rest}
    />
  );
}
