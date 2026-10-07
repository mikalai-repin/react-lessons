import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import {
  course,
  findChapter,
  findStepByDir,
  quizPassScore,
  stepPath,
  QUIZ_PASS_RATE,
  type Chapter,
  type Quiz,
} from '../content/course';
import { renderMarkdown, renderMarkdownInline } from '../lesson/markdown';
import { progress, type QuizResult } from '../progress/storage';
import { Loader } from '../app/Loader';

export function QuizPage() {
  const params = useParams();
  const chapter = findChapter(params.chapter);
  if (!chapter?.quiz) return <Navigate to="/" replace />;
  // key: при смене главы попытка начинается заново
  return <ChapterQuiz key={chapter.slug} chapter={chapter} quiz={chapter.quiz} />;
}

/** Вопрос, переведённый в HTML; options[0] — правильный вариант, как в quiz.yaml */
interface RenderedQuestion {
  question: string;
  options: string[];
  explanation: string;
  step: string;
}

/** Вопрос попытки: номер в quiz.yaml и порядок вариантов на экране (номера вариантов из quiz.yaml) */
interface AttemptQuestion {
  source: number;
  order: number[];
}

/** Перемешивание Фишера — Йетса */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Каждая попытка — свой порядок вопросов и вариантов */
function newAttempt(quiz: Quiz): AttemptQuestion[] {
  return shuffle(quiz.questions.map((_, index) => index)).map((source) => ({
    source,
    order: shuffle(quiz.questions[source].options.map((_, index) => index)),
  }));
}

function useRenderedQuiz(quiz: Quiz) {
  const [rendered, setRendered] = useState<RenderedQuestion[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      quiz.questions.map(async (q) => ({
        question: await renderMarkdown(q.question),
        options: await Promise.all(q.options.map((option) => renderMarkdownInline(String(option)))),
        explanation: await renderMarkdown(q.explanation),
        step: q.step,
      })),
    ).then((result) => {
      if (!cancelled) setRendered(result);
    });
    return () => {
      cancelled = true;
    };
  }, [quiz]);
  return rendered;
}

type Phase = 'intro' | 'question' | 'result';

function ChapterQuiz({ chapter, quiz }: { chapter: Chapter; quiz: Quiz }) {
  const navigate = useNavigate();
  const rendered = useRenderedQuiz(quiz);
  const [phase, setPhase] = useState<Phase>('intro');
  const [attempt, setAttempt] = useState<AttemptQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  /** Выбранный вариант текущего вопроса — номер из quiz.yaml */
  const [selected, setSelected] = useState<number | null>(null);
  /** Ответы попытки — номера вариантов из quiz.yaml; 0 — правильный */
  const [answers, setAnswers] = useState<number[]>([]);
  const [best, setBest] = useState<QuizResult | undefined>(() => progress.getQuiz(chapter.slug));
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const total = quiz.questions.length;
  const passScore = quizPassScore(total);
  const revealed = answers.length > current;
  const correctCount = answers.filter((answer) => answer === 0).length;
  const nextChapter = course.chapters[chapter.index + 1];
  const lastStep = chapter.steps.at(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [phase, current]);

  // После ответа фокус — на кнопке «Дальше»: Enter ведёт к следующему вопросу
  useEffect(() => {
    if (revealed) nextButtonRef.current?.focus();
  }, [revealed]);

  function start() {
    setAttempt(newAttempt(quiz));
    setAnswers([]);
    setCurrent(0);
    setSelected(null);
    setPhase('question');
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (revealed || selected === null) return;
    setAnswers([...answers, selected]);
  }

  function onNext() {
    if (current + 1 < total) {
      setCurrent(current + 1);
      setSelected(null);
      return;
    }
    const result: QuizResult = { correct: correctCount, total, passed: correctCount >= passScore };
    progress.saveQuiz(chapter.slug, result);
    setBest(progress.getQuiz(chapter.slug));
    setPhase('result');
  }

  // Внутренние ссылки (step:...) в тексте вопросов переходят без перезагрузки страницы
  function onContentClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest('a[data-internal]');
    if (!link) return;
    event.preventDefault();
    navigate(link.getAttribute('href')!);
  }

  if (!rendered) return <Loader label="Загружаем квиз…" />;

  const header = (
    <div className="quiz-chapter">
      Глава {chapter.index + 1}. {chapter.title} · квиз
    </div>
  );

  if (phase === 'intro') {
    return (
      <div className="quiz-page" ref={scrollRef}>
        <div className="quiz-card">
          {header}
          <h1>Проверьте себя</h1>
          <p>
            {total} вопросов по главе, в каждом один правильный ответ. Глава пройдена, если правильно ответить хотя бы
            на {passScore} из {total} ({Math.round(QUIZ_PASS_RATE * 100)}&nbsp;%). Вопросы и варианты перемешиваются при
            каждой попытке, пересдавать можно сколько угодно.
          </p>
          {best && <BestResult best={best} />}
          <div className="quiz-actions">
            {lastStep && (
              <Link className="button" to={stepPath(lastStep)}>
                ← К главе
              </Link>
            )}
            <button className="button primary" onClick={start} autoFocus>
              {best ? 'Пройти ещё раз' : 'Начать'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const passed = correctCount >= passScore;
    const mistakes = attempt.filter((_, index) => answers[index] !== 0).map((q) => ({ q, index: attempt.indexOf(q) }));
    return (
      <div className="quiz-page" ref={scrollRef} onClick={onContentClick}>
        <div className="quiz-card">
          {header}
          <h1>{passed ? 'Глава пройдена' : 'Пока не сдано'}</h1>
          <div className={passed ? 'quiz-score passed' : 'quiz-score failed'}>
            <strong>
              {correctCount} из {total}
            </strong>
            <span>{Math.round((correctCount / total) * 100)}&nbsp;%</span>
          </div>
          <p>
            {passed
              ? mistakes.length
                ? 'Зачёт. Посмотрите разбор ошибок ниже — он короткий.'
                : 'Зачёт, без единой ошибки.'
              : `Для зачёта нужно ${passScore} правильных ответов. Перечитайте шаги из разбора ниже и попробуйте ещё раз.`}
          </p>
          {best && <BestResult best={best} />}
          <div className="quiz-actions">
            <button className={passed ? 'button' : 'button primary'} onClick={start}>
              Пройти ещё раз
            </button>
            {nextChapter && (
              <button
                className={passed ? 'button primary' : 'button'}
                onClick={() => navigate(stepPath(nextChapter.steps[0]))}
              >
                Глава {nextChapter.index + 1} →
              </button>
            )}
          </div>
        </div>

        {mistakes.length > 0 && (
          <div className="quiz-card">
            <h2>Разбор ошибок</h2>
            {mistakes.map(({ q, index }) => {
              const source = rendered[q.source];
              const step = findStepByDir(`${chapter.dir}/${source.step}`);
              return (
                <section key={q.source} className="quiz-mistake">
                  <div className="lesson-content" dangerouslySetInnerHTML={{ __html: source.question }} />
                  <p className="quiz-answer wrong">
                    <span>Ваш ответ:</span>{' '}
                    <span dangerouslySetInnerHTML={{ __html: source.options[answers[index]] }} />
                  </p>
                  <p className="quiz-answer correct">
                    <span>Правильно:</span> <span dangerouslySetInnerHTML={{ __html: source.options[0] }} />
                  </p>
                  <div className="lesson-content" dangerouslySetInnerHTML={{ __html: source.explanation }} />
                  {step && (
                    <Link className="quiz-step-link" to={stepPath(step)}>
                      Повторить шаг «{step.meta.title}» →
                    </Link>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const question = attempt[current];
  const source = rendered[question.source];
  const answer = answers[current];

  return (
    <div className="quiz-page" ref={scrollRef} onClick={onContentClick}>
      <form className="quiz-card" onSubmit={onSubmit}>
        {header}
        <div className="quiz-progress">
          <span>
            Вопрос {current + 1} из {total}
          </span>
          <span>Правильных: {correctCount}</span>
        </div>
        <div
          className="quiz-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answers.length}
        >
          <div style={{ width: `${(answers.length / total) * 100}%` }} />
        </div>

        <div className="lesson-content quiz-question" dangerouslySetInnerHTML={{ __html: source.question }} />

        <fieldset className="quiz-options" disabled={revealed}>
          <legend className="visually-hidden">Варианты ответа</legend>
          {question.order.map((option) => {
            const state = !revealed ? '' : option === 0 ? ' correct' : option === answer ? ' wrong' : ' dimmed';
            return (
              <label key={option} className={`quiz-option${state}`}>
                <input
                  type="radio"
                  name="answer"
                  checked={(revealed ? answer : selected) === option}
                  onChange={() => setSelected(option)}
                />
                <span dangerouslySetInnerHTML={{ __html: source.options[option] }} />
              </label>
            );
          })}
        </fieldset>

        {revealed && (
          <div className={answer === 0 ? 'quiz-feedback correct' : 'quiz-feedback wrong'}>
            <div className="quiz-feedback-title">{answer === 0 ? 'Верно' : 'Неверно'}</div>
            <div className="lesson-content" dangerouslySetInnerHTML={{ __html: source.explanation }} />
          </div>
        )}

        <div className="quiz-actions">
          {revealed ? (
            <button type="button" className="button primary" ref={nextButtonRef} onClick={onNext}>
              {current + 1 < total ? 'Следующий вопрос →' : 'Результат →'}
            </button>
          ) : (
            <button type="submit" className="button primary" disabled={selected === null}>
              Ответить
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function BestResult({ best }: { best: QuizResult }) {
  return (
    <p className="quiz-best">
      Лучший результат: {best.correct} из {best.total} ({Math.round((best.correct / best.total) * 100)}&nbsp;%)
      {best.passed ? ' — сдано ✓' : ' — пока не сдано'}
    </p>
  );
}
