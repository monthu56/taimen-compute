#!/usr/bin/env python3
"""Сборка страниц taimen.ai из экспорта Claude Design.

Исходники — `src/pages/*.dc.html` ровно в том виде, в котором они выгружены из
проекта Claude Design (22029dc6-3f72-446e-9073-c438378a918f). Скрипт переписывает
относительные пути в абсолютные (страница лежит в подкаталоге, ассеты — в корне),
проставляет метатеги и раскладывает результат по `<slug>/index.html`.

Запуск: python3 build-pages.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src" / "pages"

DS = "_ds/taimen-compute-design-system-27a98f89-01a7-49c6-8406-4261d0be7022"

REACT = "https://unpkg.com/react@18.3.1/umd/react.production.min.js"
REACT_DOM = "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"

# dc-runtime тянет React с unpkg; window.__resources — его же хук подмены URL,
# чтобы сайт не зависел от внешнего CDN. Копии в vendor/ сверены по SRI-хешам
# из support.js.
RUNTIME_HEAD = f"""<script>window.__resources={{
  "{REACT}": "/vendor/react.production.min.js",
  "{REACT_DOM}": "/vendor/react-dom.production.min.js"
}};</script>
<script src="/support.js"></script>"""

# Лендинги свёрстаны только под десктоп: навигация из шапки распирает документ на
# телефоне, а списки «подпись + описание» не сжимаются. mobile-nav.js прячет шапочную
# навигацию за бургер и кладёт такие списки в одну колонку. Демо-страницам он не нужен —
# у них есть собственный мобильный режим-приложение, сделанный в Design.
MOBILE_NAV = '<script src="/mobile-nav.js" defer></script>'

PAGES = [
    {
        "src": "Taimen Landing.dc.html",
        "slug": "taimen-landing",
        "mobile_nav": True,
        "title": "Taimen Compute — fine-tuning open AI models for your task",
        "description": (
            "We fine-tune open LLM and ASR models on your data: a fixed price per "
            "project, our own GPU hardware and a quality metric agreed before we start."
        ),
    },
    {
        "src": "Memory Landing v3.dc.html",
        "slug": "memory-landing",
        "mobile_nav": True,
        "title": "Taimen Memory — company memory you can verify",
        "description": (
            "A knowledge graph and search over your company's documents: people, "
            "decisions, processes and how they connect. Every answer carries its source."
        ),
    },
    {
        "src": "Memory Demo.dc.html",
        "slug": "memory-demo",
        "title": "Taimen Memory — demo: verifiable search over company memory",
        "description": (
            "Ask the demo knowledge base a question: the engine returns passages with a "
            "score and opens the stored original with its provenance."
        ),
    },
    {
        "src": "CRM Demo.dc.html",
        "slug": "crm-demo",
        "title": "Taimen Memory — CRM assistant preview",
        "description": (
            "The assistant reads an incoming client email, pulls context from company "
            "memory and drafts a next-steps plan for a human to review."
        ),
    },
]

# Кросс-ссылки между страницами: имя файла в Design → путь на сайте. Прежние версии
# лендинга памяти остаются в проекте Design, и соседние страницы ссылаются на них по
# старым именам — ведём их на тот же адрес, чтобы ссылки не оборвались.
LINKS = {p["src"]: "/" + p["slug"] + "/" for p in PAGES}
LINKS["Memory Landing.dc.html"] = "/memory-landing/"
LINKS["Memory Landing v2.dc.html"] = "/memory-landing/"

# Всё, что страница подгружает: атрибуты src/href и CSS-url().
REF_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*['"]?([^)'"]+)""")
# Шаблонные подстановки `{{ … }}` рантайм заполняет сам — проверять их как пути нельзя.
ABSOLUTE_RE = re.compile(r"^(?:/|#|https?:|mailto:|tel:|data:|\{\{)")


# dc-runtime добавляет для отдельной страницы `html,body{height:100%}` (FULL_PAGE_CSS
# в support.js). Из-за этого sticky-шапка держится только первый экран, а дальше уезжает
# вверх: прилипание ограничено высотой body. Странице нужна высота по содержимому.
PAGE_CSS = """<style>html,body{height:auto!important;min-height:100%}</style>"""


def meta_head(page):
    url = f"https://taimen.ai/{page['slug']}/"
    return f"""{PAGE_CSS}
<title>{page['title']}</title>
<meta name="description" content="{page['description']}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0C2F36">
<link rel="canonical" href="{url}">
<link rel="icon" href="/assets/logo/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/logo/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/logo/favicon-32.png">
<link rel="icon" type="image/svg+xml" href="/assets/logo/taimen-mark-dark.svg">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Taimen Compute">
<meta property="og:title" content="{page['title']}">
<meta property="og:description" content="{page['description']}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://taimen.ai/assets/og-datacenter.jpeg">
<meta name="twitter:card" content="summary_large_image">"""


# Патчи к исходникам из Design. Каждый обязан примениться: если исходник обновили
# и патч больше не подходит, сборка падает — значит надо перепроверить фикс.
PATCHES = {
    # dc-runtime вызывает componentDidUpdate только с prevProps (support.js), поэтому
    # обращение к prevState бросало TypeError на каждое обновление и автоскролл чата
    # в сценарии «Tender assistant» не работал никогда.
    "Memory Demo.dc.html": [
        (
            """  componentDidUpdate(prevProps, prevState) {""",
            """  componentDidUpdate(prevProps) {""",
        ),
        (
            """    var grew = (prevState.tdMsgs || []).length !== (this.state.tdMsgs || []).length
      || (!!prevState.td && !!this.state.td && prevState.td.stage !== this.state.td.stage);
    if (grew) el.scrollTop = el.scrollHeight;""",
            """    var len = (s.tdMsgs || []).length;
    var stage = s.td ? s.td.stage : null;
    if (len !== this._tdLen || stage !== this._tdStage) {
      this._tdLen = len;
      this._tdStage = stage;
      el.scrollTop = el.scrollHeight;
    }""",
        ),
    ],
}


def build(page):
    src_path = SRC / page["src"]
    html = src_path.read_text(encoding="utf-8")
    before = html

    for old, new in PATCHES.get(page["src"], []):
        if old not in html:
            sys.exit(f"build-pages: {page['src']} — патч не подошёл, исходник изменился")
        html = html.replace(old, new, 1)

    # Страницы написаны по-английски — объявляем язык документа.
    html = html.replace("<html>", '<html lang="en">', 1)

    # Рантайм: локальные React/ReactDOM вместо unpkg, support.js из корня сайта.
    runtime = RUNTIME_HEAD
    if page.get("mobile_nav"):
        runtime += "\n" + MOBILE_NAV
    html = html.replace('<script src="./support.js"></script>', runtime, 1)

    # Метатеги в сам <head>, а не в <helmet>: они должны быть в HTML до того, как
    # отработает JS, иначе краулеры и превью ссылок их не увидят.
    html = html.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + meta_head(page),
        1,
    )

    # tokens/fonts.css грузит те же IBM Plex в .ttf (~5 МБ) — страницы уже
    # объявляют свои @font-face на .woff2, так что подключаем только colors.css.
    html = re.sub(
        r'[ \t]*<link rel="stylesheet" href="' + re.escape(DS) + r'/tokens/fonts\.css">\n',
        "",
        html,
    )

    # Относительные пути → абсолютные: страница живёт в /<slug>/, ассеты — в корне.
    html = html.replace(f'href="{DS}/', f'href="/{DS}/')
    html = html.replace(f'src="{DS}/', f'src="/{DS}/')
    html = html.replace("url('assets/", "url('/assets/")
    html = html.replace('src="assets/', 'src="/assets/')
    html = html.replace('fetch("data/corpus.json"', 'fetch("/data/corpus.json"')

    # Кросс-ссылки встречаются и как href, и внутри логики (window.location.href),
    # причём с якорем или строкой запроса («CRM Demo.dc.html#app»), поэтому заменяем
    # имя файла в любых кавычках, сохраняя хвост.
    for name, href in LINKS.items():
        html = re.sub(
            r"(['\"])" + re.escape(name) + r"([#?][^'\"]*)?\1",
            lambda m: m.group(1) + href + (m.group(2) or "") + m.group(1),
            html,
        )

    # forceMode остаётся auto: на стенде страница находит memory-service по
    # /demo/api/* и работает на живой памяти, без него — откатывается на корпус
    # в data/corpus.json.

    if html == before:
        sys.exit(f"build-pages: {page['src']} — ни одна замена не применилась")

    refs = (m.group(1) or m.group(2) for m in REF_RE.finditer(html))
    leftovers = sorted({r for r in refs if not ABSOLUTE_RE.match(r.strip())})
    if leftovers:
        sys.exit(f"build-pages: {page['src']} — остались относительные пути: {leftovers}")
    if ".dc.html" in html:
        sys.exit(f"build-pages: {page['src']} — осталась ссылка на .dc.html")

    out_dir = ROOT / page["slug"]
    out_dir.mkdir(exist_ok=True)
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    return out_dir / "index.html"


def main():
    if not SRC.is_dir():
        sys.exit(f"build-pages: нет каталога с исходниками {SRC}")
    for page in PAGES:
        out = build(page)
        print(f"{page['src']:<26} → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
