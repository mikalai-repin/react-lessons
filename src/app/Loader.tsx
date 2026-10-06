// Логотип-атом React и загрузчик платформы. Та же разметка — в index.html (виден до запуска JavaScript):
// при изменении правьте оба места.

const ORBIT = 'M 11 0 A 11 4.2 0 1 1 -11 0 A 11 4.2 0 1 1 11 0';

/** Атом React. animated — электроны бегут по орбитам (только для загрузчика) */
export function ReactLogo({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      className={animated ? 'react-logo react-logo-animated' : 'react-logo'}
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      aria-hidden="true"
    >
      <circle r="2.05" className="react-logo-nucleus" />
      {[0, 60, 120].map((angle, index) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d={ORBIT} className="react-logo-orbit" />
          {animated && (
            <circle r="1.1" className="react-logo-electron">
              <animateMotion dur="1.8s" begin={`${-index * 0.6}s`} repeatCount="indefinite" path={ORBIT} />
            </circle>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Загрузчик: атом и подпись. compact — для небольших областей (превью) */
export function Loader({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? 'loader loader-compact' : 'loader'} role="status">
      <ReactLogo size={compact ? 40 : 64} animated />
      <span className="loader-label">{label}</span>
    </div>
  );
}
