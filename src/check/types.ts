// Типы проверки шага (content/<глава>/<шаг>/check.ts). В check.ts они импортируются как модуль '@course/check'
// (paths в tsconfig.checks.json и tsconfig.json): import type { CheckContext, CheckResult } from '@course/check'.
// Проверка смотрит на РЕЗУЛЬТАТ — DOM приложения, адрес, запросы, консоль, — а не на текст кода.

/** Запрос к учебному бэкенду — как во вкладке «Сеть» */
export interface CheckRequest {
  method: string;
  url: string;
  status: number | 'pending' | 'canceled';
}

export interface CheckContext {
  /** document приложения в превью. После restart — документ нового запуска */
  readonly document: Document;
  /** window приложения (localStorage, location, getComputedStyle) */
  readonly window: Window;
  /**
   * Перезапуск приложения с адреса (как ввод в адресную строку) и ожидание первого рендера.
   * clearStorage — ключи localStorage, которые убрать до запуска (корзина, избранное: хранилище общее с платформой).
   * Перед check() платформа уже перезапустила приложение с начального адреса шага
   */
  restart(url?: string, options?: { clearStorage?: string[] }): Promise<void>;
  /** Переход внутри приложения без перезапуска (pushState + popstate — так переходит Link роутера) */
  navigate(url: string): Promise<void>;
  /** Текущий адрес приложения: '/games/1?tab=reviews' */
  url(): string;
  wait(ms: number): Promise<void>;
  /** Ждать, пока условие станет истинным (по умолчанию до 2000 мс); false — не дождались */
  waitFor(condition: () => unknown, timeout?: number): Promise<boolean>;
  /** Все элементы по селектору (по умолчанию — во всём документе) */
  all<E extends Element = HTMLElement>(selector: string, scope?: ParentNode): E[];
  /** Кнопка с таким текстом или aria-label (текст — без лишних пробелов); null — такой нет */
  button(name: string | RegExp, scope?: ParentNode): HTMLButtonElement | null;
  /** Щелчок и пауза, за которую React успевает отрисовать результат */
  click(target: Element | null | undefined): Promise<void>;
  /** Ввод в поле как с клавиатуры: значение и событие input (управляемые поля React видят его в onChange) */
  type(field: Element | null | undefined, text: string): Promise<void>;
  /** Выбор значения в <select> и событие change */
  select(field: Element | null | undefined, value: string): Promise<void>;
  /** Видимый текст элемента (без аргумента — страницы, null — ''): пробелы схлопнуты, неразрывные заменены обычными */
  text(target?: Element | null): string;
  /** Ошибки консоли с последнего запуска: console.error, необработанные исключения, ошибки сборки */
  errors(): string[];
  /** Ошибки TypeScript в коде ученика — как с меткой «TS» в консоли: «App.tsx:5:3 — …» */
  typeErrors(): string[];
  /** Запросы к учебному бэкенду с последнего запуска */
  requests(): CheckRequest[];
}

/** pass: false — подсказка ученику: что не так и куда смотреть, без готового ответа */
export type CheckResult = { pass: true } | { pass: false; hint: string };

export type CheckFunction = (context: CheckContext) => Promise<CheckResult>;
