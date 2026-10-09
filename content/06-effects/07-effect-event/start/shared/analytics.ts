// Аналитика магазина. В настоящем проекте событие уходит на сервер
// (navigator.sendBeacon или SDK сервиса аналитики), здесь — в консоль
export function track(
  event: string,
  data: Record<string, unknown>,
) {
  console.log(`[аналитика] ${event}`, data);
}
