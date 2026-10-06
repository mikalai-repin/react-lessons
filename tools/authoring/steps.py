# Запись кода шагов главы на диск — общая для всех генераторов chNN-gen.py.
#
# steps = {'01-slug': {'start': {...}, 'solution': {...}}, ...} — в порядке шагов. Значение 'start'/'solution' —
# ПОЛНЫЙ снимок кода: словарь «путь файла → код» или строка — путь папки с полным кодом (например, из step_dir).
# У шага без решения (noSolution) 'solution' нет.
#
# На диск write_steps пишет только изменения (так же собирает шаги shared/step-chain.js):
# - start/ — файлы, которые отличаются от результата предыдущего шага. У первого шага главы предыдущий шаг —
#   base: шаг прошлой главы, write_steps(root, steps, base='07-directives-pipes/07-practice'). Тогда в lesson.md
#   первого шага write_steps сам пишет base и baseHash (хеш полного кода базы; его сверяет npm run validate).
#   Без base (глава 1) start/ первого шага — полный снимок. Если отличий нет, папки start/ нет —
#   это шаг startFrom: previous; иначе во frontmatter шага нужен startFrom: custom (проверит npm run validate);
# - solution/ — файлы, которые отличаются от старта шага;
# - файлы, которые пропали, во frontmatter перечисляются вручную: removedInStart / removedInSolution.
#   write_steps сверяет их с lesson.md и печатает, чего не хватает.
import hashlib, json, os, re, shutil, subprocess

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def read_dir(path):
    files = {}
    for dirpath, _, names in os.walk(path):
        for name in names:
            full = os.path.join(dirpath, name)
            with open(full) as f:
                files[os.path.relpath(full, path)] = f.read()
    return files


def frontmatter_list(stepdir, key):
    lesson = os.path.join(stepdir, 'lesson.md')
    if not os.path.exists(lesson):
        return None
    with open(lesson) as f:
        match = re.match(r'---\n(.*?)\n---', f.read(), re.S)
    found = re.search(rf'^{key}: \[(.*)\]$', match.group(1) if match else '', re.M)
    return sorted(s.strip() for s in found.group(1).split(',')) if found else []


def format_snapshots(snapshots):
    """Форматирует полные снимки шагов (список словарей «путь → код») так же, как кнопка «Формат» в редакторе
    платформы: настройки — shared/lesson-prettier.json (.ts, .tsx, .css). Файл, который Prettier не
    разобрал (намеренно сломанный старт), остаётся как есть."""
    tmp = os.path.join(PROJECT, 'tools', 'e2e', 'out', 'fmt')
    shutil.rmtree(tmp, ignore_errors=True)
    for i, files in enumerate(snapshots):
        for name, code in files.items():
            path = os.path.join(tmp, str(i), name)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write(code)
    with open(os.path.join(PROJECT, 'shared', 'lesson-prettier.json')) as f:
        options = json.load(f)
    flags = ['--no-config', '--ignore-path', os.devnull, '--log-level', 'silent',
             '--print-width', str(options['printWidth']), '--tab-width', str(options['tabWidth']),
             '--trailing-comma', options['trailingComma']]
    flags += ['--single-quote'] if options['singleQuote'] else []
    flags += [] if options['semi'] else ['--no-semi']
    prettier = os.path.join(PROJECT, 'node_modules', '.bin', 'prettier')
    subprocess.run([prettier, *flags, '--write', f'{tmp}/**/*.{{ts,tsx,css}}'], cwd=PROJECT)
    return [read_dir(os.path.join(tmp, str(i))) if files else files for i, files in enumerate(snapshots)]


def files_hash(files):
    """Хеш набора файлов — тот же алгоритм, что filesHash в scripts/step-files.mjs."""
    h = hashlib.sha1()
    for name in sorted(files):
        h.update(f'{name}\0{files[name]}\0'.encode())
    return h.hexdigest()[:12]


def set_frontmatter(stepdir, values):
    """Записать поля во frontmatter lesson.md (после startFrom); нет lesson.md — пропустить."""
    lesson = os.path.join(stepdir, 'lesson.md')
    if not os.path.exists(lesson):
        return
    with open(lesson) as f:
        text = f.read()
    match = re.match(r'---\n(.*?)\n---', text, re.S)
    lines = [l for l in match.group(1).split('\n') if not any(l.startswith(f'{k}:') for k in values)]
    at = next((i + 1 for i, l in enumerate(lines) if l.startswith('startFrom:')), len(lines))
    lines[at:at] = [f'{k}: {v}' for k, v in values.items()]
    with open(lesson, 'w') as f:
        f.write('---\n' + '\n'.join(lines) + '\n---' + text[match.end():])


def write_steps(root, steps, base=None):
    previous = read_dir(step_dir(f'{PROJECT}/content/{base}/result')) if base else {}
    first = True
    # Все снимки сразу — в формат кнопки «Формат»: так файл на диске совпадает с тем, что увидит ученик
    snapshots = []
    for spec in steps.values():
        for kind in ('start', 'solution'):
            value = spec.get(kind)
            snapshots.append(read_dir(value) if isinstance(value, str) else value)
    formatted = iter(format_snapshots([s if s is not None else {} for s in snapshots]))
    for step, spec in steps.items():
        stepdir = os.path.join(root, step)
        os.makedirs(stepdir, exist_ok=True)
        start, solution = next(formatted), next(formatted)
        if spec.get('solution') is None:
            solution = None
        if first and base:
            set_frontmatter(stepdir, {'base': base, 'baseHash': f"'{files_hash(previous)}'"})
        first = False
        own = {
            'start': {n: c for n, c in start.items() if previous.get(n) != c},
            'solution': {n: c for n, c in solution.items() if start.get(n) != c} if solution is not None else {},
        }
        removed = {
            'removedInStart': sorted(set(previous) - set(start)),
            'removedInSolution': sorted(set(start) - set(solution)) if solution is not None else [],
        }
        for key, names in removed.items():
            declared = frontmatter_list(stepdir, key)
            if declared is not None and declared != names:
                print(f'⚠ {step}: во frontmatter нужно {key}: [{", ".join(names)}]')
        for kind, files in own.items():
            path = os.path.join(stepdir, kind)
            if os.path.isdir(path):
                shutil.rmtree(path)
            for name, code in files.items():
                target = os.path.join(path, name)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, 'w') as f:
                    f.write(code)
        previous = solution if solution is not None else start


def step_dir(path):
    """Папка с ПОЛНЫМ кодом шага по пути …/<шаг>/start, …/<шаг>/solution или …/<шаг>/result (результат шага:
    решение, а у шага без решения — старт).

    В content/ шаг хранит только изменения, поэтому полный код выгружается (scripts/step-files.mjs)
    в tools/e2e/out/steps/<глава>/<шаг>/<start|solution>. Генераторы читают через неё код прошлой главы:
    CH05 = step_dir(f'{PROJECT}/content/05-components/09-practice/solution').
    """
    path = os.path.abspath(path)
    rel = os.path.relpath(path, os.path.join(PROJECT, 'content'))
    out = os.path.join(PROJECT, 'tools', 'e2e', 'out', 'steps', rel)
    subprocess.run(['node', 'scripts/step-files.mjs', path, out], cwd=PROJECT, check=True, stdout=subprocess.DEVNULL)
    return out

