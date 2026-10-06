# Переформатирует код всех шагов курса так, как его форматирует кнопка «Формат» в редакторе
# (настройки — shared/lesson-prettier.json), не трогая содержание.
# Запуск: python3 tools/authoring/format-content.py — после изменения shared/lesson-prettier.json.
# Главы идут по порядку content/course.json: полные снимки шагов берутся с диска, write_steps форматирует их
# и записывает только изменения (у первого шага главы — заново base и baseHash, ведь база тоже переформатирована).
# Тексты уроков (lesson.md) и код в них не меняются. После запуска: npm run validate.
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from steps import PROJECT, step_dir, write_steps

CONTENT = os.path.join(PROJECT, 'content')


def frontmatter(stepdir):
    with open(os.path.join(stepdir, 'lesson.md')) as f:
        return re.match(r'---\n(.*?)\n---', f.read(), re.S).group(1)


with open(os.path.join(CONTENT, 'course.json')) as f:
    chapters = json.load(f)['chapters']

for chapter in chapters:
    root = os.path.join(CONTENT, chapter)
    names = sorted(n for n in os.listdir(root) if os.path.isdir(os.path.join(root, n)))
    steps, base = {}, None
    for index, name in enumerate(names):
        meta = frontmatter(os.path.join(root, name))
        if index == 0:
            found = re.search(r'^base: (\S+)$', meta, re.M)
            base = found.group(1) if found else None
        spec = {'start': step_dir(f'{root}/{name}/start')}
        if not re.search(r'^noSolution: true$', meta, re.M):
            spec['solution'] = step_dir(f'{root}/{name}/solution')
        steps[name] = spec
    write_steps(root, steps, base=base)
    print(f'{chapter}: {len(steps)} шагов')
