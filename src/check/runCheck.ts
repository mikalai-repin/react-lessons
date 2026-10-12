import type { CheckContext, CheckFunction, CheckRequest, CheckResult } from './types';

/** Что проверке нужно от превью — его отдаёт компонент Preview через ref */
export interface PreviewDriver {
  /** Перезапуск приложения с адреса; промис выполняется, когда приложение отрисовалось (или не запустилось) */
  restart(url: string): Promise<void>;
  /** window приложения текущего запуска; null — приложение не запущено */
  frameWindow(): Window | null;
  /** Сборка не прошла — приложение не запускалось */
  buildFailed(): boolean;
  errors(): string[];
  typeErrors(): string[];
  requests(): CheckRequest[];
}

// Проверки шагов: content/<глава>/<шаг>/check.ts. Vite компилирует их как модули платформы и грузит при первом «Проверить»
const loaders = import.meta.glob<{ default: CheckFunction }>('/content/**/check.ts');

/** Есть ли у шага проверка (dir — «08-context/08-practice») */
export function hasCheck(stepDir: string): boolean {
  return `/content/${stepDir}/check.ts` in loaders;
}

// Сколько ждать проверку целиком, мс: зависла (ждёт элемент, которого нет) — считаем не пройденной
const CHECK_TIMEOUT = 20_000;
// Пауза после щелчка и ввода: React фиксирует обновление после события в микрозадаче, эффекты — чуть позже
const SETTLE_MS = 80;
const WAIT_FOR_MS = 2000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const normalize = (text: string) => text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Запускает проверку шага: приложение перезапускается с начального адреса шага, затем check(context).
 * Исключение в проверке (элемента нет, приложение упало) — тоже «не пройдено», с текстом ошибки
 */
export async function runCheck(stepDir: string, driver: PreviewDriver, startUrl: string): Promise<CheckResult> {
  const load = loaders[`/content/${stepDir}/check.ts`];
  if (!load) return { pass: false, hint: 'У этого шага нет автоматической проверки.' };
  const { default: check } = await load();
  await driver.restart(startUrl);
  if (driver.buildFailed()) {
    return {
      pass: false,
      hint: 'Сборка не прошла — приложение не запустилось. Исправьте ошибку из консоли (метка «Сборка»).',
    };
  }
  const context = createContext(driver, startUrl);
  let timer = 0;
  try {
    const timeout = new Promise<CheckResult>((resolve) => {
      timer = window.setTimeout(
        () =>
          resolve({
            pass: false,
            hint: 'Проверка не дождалась нужного результата на странице. Посмотрите консоль превью.',
          }),
        CHECK_TIMEOUT,
      );
    });
    return await Promise.race([check(context), timeout]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      pass: false,
      hint: `Проверка не смогла пройти по приложению (${message}). Посмотрите консоль превью: возможно, часть страницы не отрисовалась.`,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

function createContext(driver: PreviewDriver, startUrl: string): CheckContext {
  const win = () => {
    const frame = driver.frameWindow();
    if (!frame) throw new Error('приложение не запущено');
    return frame;
  };
  const doc = () => win().document;

  // Значение поля через сеттер DOM, а не element.value =: React следит за value и иначе не заметит изменения
  function setValue(field: Element, value: string, event: 'input' | 'change') {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
    if (!setter) throw new Error(`у элемента <${field.tagName.toLowerCase()}> нет value`);
    setter.call(field, value);
    const { Event } = win() as Window & typeof globalThis;
    field.dispatchEvent(new Event(event, { bubbles: true }));
  }

  return {
    get document() {
      return doc();
    },
    get window() {
      return win();
    },
    async restart(url = startUrl, options = {}) {
      for (const key of options.clearStorage ?? []) localStorage.removeItem(key);
      await driver.restart(url);
    },
    async navigate(url) {
      const frame = win() as Window & typeof globalThis;
      frame.history.pushState(null, '', url);
      frame.dispatchEvent(new frame.PopStateEvent('popstate', { state: null }));
      await wait(SETTLE_MS * 2);
    },
    url() {
      const { pathname, search, hash } = win().location;
      return pathname + search + hash;
    },
    wait,
    async waitFor(condition, timeout = WAIT_FOR_MS) {
      const until = Date.now() + timeout;
      for (;;) {
        try {
          if (condition()) return true;
        } catch {
          // Условие читает то, чего ещё нет на странице, — ждём дальше
        }
        if (Date.now() > until) return false;
        await wait(50);
      }
    },
    all<E extends Element = HTMLElement>(selector: string, scope?: ParentNode) {
      return Array.from((scope ?? doc()).querySelectorAll<E>(selector));
    },
    button(name, scope) {
      const matches = (text: string | null) =>
        text !== null && (typeof name === 'string' ? normalize(text) === name : name.test(normalize(text)));
      const buttons = Array.from((scope ?? doc()).querySelectorAll('button'));
      return buttons.find((b) => matches(b.textContent) || matches(b.getAttribute('aria-label'))) ?? null;
    },
    async click(target) {
      if (!target) throw new Error('нет элемента, по которому нужно щёлкнуть');
      (target as HTMLElement).click();
      await wait(SETTLE_MS);
    },
    async type(field, text) {
      if (!field) throw new Error('нет поля для ввода');
      (field as HTMLElement).focus();
      setValue(field, text, 'input');
      await wait(SETTLE_MS);
    },
    async select(field, value) {
      if (!field) throw new Error('нет списка для выбора');
      setValue(field, value, 'change');
      await wait(SETTLE_MS);
    },
    text(target) {
      // null — элемента нет (querySelector ничего не нашёл): пустая строка, а не текст всей страницы
      if (target === null) return '';
      const element = (target ?? doc().body) as HTMLElement;
      return normalize(element.innerText ?? element.textContent ?? '');
    },
    errors: () => driver.errors(),
    typeErrors: () => driver.typeErrors(),
    requests: () => driver.requests(),
  };
}
