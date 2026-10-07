import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { allSteps, course, quizPath, stepPath } from '../content/course';
import { progress } from '../progress/storage';
import { Loader, ReactLogo } from './Loader';
import { Appearance } from './Appearance';
// Страница шага тянет Monaco, TypeScript-воркер и Prettier — грузим её отдельным чанком: шапка и оглавление
// появляются сразу
const StepPage = lazy(() => import('./StepPage').then((module) => ({ default: module.StepPage })));
const QuizPage = lazy(() => import('../quiz/QuizPage').then((module) => ({ default: module.QuizPage })));

function Home() {
  const last = allSteps.find((step) => step.id === progress.getLastStep()) ?? allSteps[0];
  if (!last) return <p className="empty-course">В курсе пока нет глав.</p>;
  return <Navigate to={stepPath(last)} replace />;
}

function TableOfContents() {
  const location = useLocation();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  // Отметки ✓ читаются из progress при рендере; квиз сдают без перехода по адресу — перечитываем при открытии
  const [, setOpenedAt] = useState(0);

  // Закрываем оглавление после перехода
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [location.pathname]);

  return (
    <details className="toc" ref={detailsRef} onToggle={(event) => event.currentTarget.open && setOpenedAt(Date.now())}>
      <summary>Оглавление</summary>
      <nav className="toc-panel">
        {course.chapters.map((chapter) => (
          <section key={chapter.slug}>
            <h3>
              {progress.isChapterDone(chapter.slug) && <span className="done-mark">✓</span>}
              {`${chapter.index + 1}. ${chapter.title}`}
            </h3>
            <ol>
              {chapter.steps.map((step) => (
                <li key={step.id}>
                  <Link to={stepPath(step)} className={location.pathname === stepPath(step) ? 'current' : undefined}>
                    {progress.isDone(step.id) && <span className="done-mark">✓</span>}
                    {step.meta.title}
                  </Link>
                </li>
              ))}
              {chapter.quiz && (
                <li className="toc-quiz">
                  <Link
                    to={quizPath(chapter)}
                    className={location.pathname === quizPath(chapter) ? 'current' : undefined}
                  >
                    {progress.isChapterDone(chapter.slug) && <span className="done-mark">✓</span>}
                    Квиз по главе
                  </Link>
                </li>
              )}
            </ol>
          </section>
        ))}
      </nav>
    </details>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="topbar">
          <Link to="/" className="brand">
            <ReactLogo size={26} />
            {course.title}
          </Link>
          <TableOfContents />
          <span className="topbar-version">React v{course.reactVersion}</span>
          <Appearance />
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Статический сегмент quiz сильнее :step — шаг с папкой NN-quiz сюда не попадёт */}
            <Route
              path="/:chapter/quiz"
              element={
                <Suspense fallback={<Loader label="Загружаем квиз…" />}>
                  <QuizPage />
                </Suspense>
              }
            />
            <Route
              path="/:chapter/:step"
              element={
                <Suspense fallback={<Loader label="Загружаем редактор…" />}>
                  <StepPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
