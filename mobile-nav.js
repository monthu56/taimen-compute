/* Мобильный слой для лендингов taimen.ai, собранных из Claude Design.
 *
 * Лендинги свёрстаны под десктоп: навигация из пяти-шести ссылок стоит в одну строку
 * с логотипом и на телефоне распирает документ вдвое шире экрана, а списки вида
 * «подпись + описание» держат фиксированную первую колонку и тоже не сжимаются.
 * Скрипт скрывает десктопную навигацию, поднимает вместо неё бургер-меню из тех же
 * ссылок и переводит такие списки в одну колонку.
 *
 * Кнопка и панель живут в <body> вне React-дерева dc-runtime, поэтому перерисовка
 * страницы их не затрагивает; список ссылок пересобирается, если шапка изменилась.
 *
 * Цвета берутся из переменных самой страницы (`--panel`, `--acc`, `--fg`), поэтому
 * меню следует её теме, включая тёмную. Фолбэки — брендовые значения дизайн-системы:
 * teal-900 #093538, salmon-500 #E8604C, ink-900 #1D2829, radius-md 8px,
 * dur-fast 120ms, ease-out cubic-bezier(0.2,0.7,0.3,1).
 */
(function () {
  "use strict";

  var BREAKPOINT = 860;
  var STYLE_ID = "tmn-mnav-style";

  var CSS =
    "@media (max-width:" + BREAKPOINT + "px){" +
    // Десктопную навигацию убираем сразу — атрибут на <html> ставится до первого
    // рендера, иначе на телефоне на мгновение видна строка ссылок шириной пол-экрана.
    // Если меню по какой-то причине не собралось, атрибут снимается и ссылки возвращаются.
    "  html[data-tmn-mnav] nav:not([aria-label='Mobile navigation']){display:none!important}" +
    "  .tmn-mnav-toggle{display:inline-flex!important}" +
    // Внутренняя строка шапки жёстко задаёт высоту 56-72px: на узких экранах
    // содержимое в неё не влезает и наезжает друг на друга.
    "  .tmn-mnav-header>div{height:auto!important;min-height:52px;flex-wrap:wrap;row-gap:6px;" +
    "    padding-top:8px!important;padding-bottom:8px!important}" +
    // Сетки, которые на телефоне не имеют смысла в несколько колонок, помечает
    // stackNarrowGrids() — по факту замера, а не по совпадению строки в style.
    "  [data-tmn-stack]{grid-template-columns:1fr!important}" +
    "  [style*='display: grid']>*,[style*='display:grid']>*{min-width:0}" +
    "  body{overflow-wrap:break-word}" +
    "}" +
    ".tmn-mnav-toggle{display:none;position:fixed;z-index:1000;align-items:center;justify-content:center;" +
    "  width:40px;height:40px;padding:0;border:1px solid currentColor;border-radius:8px;background:transparent;" +
    "  cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".tmn-mnav-toggle span{display:block;position:relative;width:18px;height:2px;background:currentColor;" +
    "  border-radius:2px;transition:background 120ms linear}" +
    ".tmn-mnav-toggle span::before,.tmn-mnav-toggle span::after{content:'';position:absolute;left:0;" +
    "  width:18px;height:2px;background:currentColor;border-radius:2px;" +
    "  transition:transform 120ms cubic-bezier(0.2,0.7,0.3,1)}" +
    ".tmn-mnav-toggle span::before{top:-6px}" +
    ".tmn-mnav-toggle span::after{top:6px}" +
    // Панель всегда тёмная, поэтому раскрытая кнопка-крестик светлая независимо от шапки.
    ".tmn-mnav-toggle[aria-expanded='true']{color:var(--panelfg,#F2F8F8)!important;" +
    "  border-color:rgba(255,255,255,0.35)}" +
    ".tmn-mnav-toggle[aria-expanded='true'] span{background:transparent}" +
    ".tmn-mnav-toggle[aria-expanded='true'] span::before{transform:translateY(6px) rotate(45deg)}" +
    ".tmn-mnav-toggle[aria-expanded='true'] span::after{transform:translateY(-6px) rotate(-45deg)}" +
    ".tmn-mnav-panel{position:fixed;inset:0;z-index:999;display:none;flex-direction:column;" +
    "  padding:88px 24px 28px;background:var(--panel,#093538);overflow-y:auto}" +
    ".tmn-mnav-panel[data-open='true']{display:flex}" +
    ".tmn-mnav-panel a{display:block;padding:15px 4px;font-family:'IBM Plex Sans',-apple-system,'Segoe UI',sans-serif;" +
    "  font-size:19px;font-weight:500;color:var(--panelfg,#F2F8F8);text-decoration:none;" +
    "  border-bottom:1px solid rgba(255,255,255,0.14)}" +
    ".tmn-mnav-panel a:last-child{border-bottom:none}" +
    ".tmn-mnav-panel a[data-cta='true']{margin-top:22px;padding:15px 20px;border:none;border-radius:8px;" +
    "  background:var(--acc,#E8604C);color:#FFFFFF;font-weight:600;text-align:center}" +
    ".tmn-mnav-status{margin-bottom:18px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;" +
    "  font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--panelfg2,#9BC3C6)}" +
    "body[data-tmn-mnav-open='true']{overflow:hidden}";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
    // Прячем шапочную навигацию с первого кадра, а не после того, как рантайм
    // отрисует страницу: иначе на телефоне мелькает строка ссылок шириной пол-экрана.
    document.documentElement.setAttribute("data-tmn-mnav", "");
    // Страховка: если через 4 секунды бургер так и не собрался (не нашлась навигация
    // или упал рантайм), возвращаем ссылки — остаться совсем без навигации хуже.
    setTimeout(function () {
      if (!toggle) document.documentElement.removeAttribute("data-tmn-mnav");
    }, 4000);
  }

  // Шапка страницы — sticky-контейнер в отрендеренном дереве. Нужна и для позиции
  // кнопки, и для её тона: на тёмной шапке кнопка светлая, на светлой — тёмная.
  function findHeader() {
    var candidates = [].slice.call(document.querySelectorAll("div,header"));
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.closest("x-dc") || el.closest(".tmn-mnav-panel")) continue;
      if (getComputedStyle(el).position === "sticky") return el;
    }
    return null;
  }

  function isDark(color) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || "");
    if (!m) return false;
    return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255 < 0.55;
  }

  function backgroundOf(el) {
    while (el && el !== document.documentElement) {
      var bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== "transparent" && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(bg)) return bg;
      el = el.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
  }

  // Навигация страницы: <nav> в отрендеренном дереве, а не в скрытом шаблоне <x-dc>.
  function findNav() {
    var navs = [].slice.call(document.querySelectorAll("nav"));
    for (var i = 0; i < navs.length; i++) {
      var nav = navs[i];
      if (nav.closest("x-dc") || nav.closest(".tmn-mnav-panel")) continue;
      if (nav.querySelector("a")) return nav;
    }
    return null;
  }

  function linksOf(nav) {
    return [].slice.call(nav.querySelectorAll("a")).map(function (a) {
      return { href: a.getAttribute("href") || "#", text: (a.textContent || "").trim() };
    }).filter(function (l) {
      return l.text;
    });
  }

  // Рядом со ссылками в шапке может стоять индикатор (например режим демо) — на
  // мобильном он не влезает в строку, поэтому переносим его текст в само меню.
  function statusOf(nav) {
    return [].slice.call(nav.children).filter(function (el) {
      return el.tagName !== "A";
    }).map(function (el) {
      return (el.textContent || "").trim().replace(/\s+/g, " ");
    }).filter(Boolean).join(" · ");
  }

  var toggle = null;
  var panel = null;
  var signature = "";

  function setOpen(open) {
    if (!panel || !toggle) return;
    panel.setAttribute("data-open", open ? "true" : "false");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) document.body.setAttribute("data-tmn-mnav-open", "true");
    else document.body.removeAttribute("data-tmn-mnav-open");
  }

  function build(nav, header) {
    var links = linksOf(nav);
    if (!links.length) return;
    var status = statusOf(nav);

    var next = links.map(function (l) { return l.href + "|" + l.text; }).join("~") + "#" + status;
    if (next === signature) return;
    signature = next;

    nav.setAttribute("data-tmn-source", "true");

    var headerHeight = header ? Math.round(header.getBoundingClientRect().height) : 60;
    var dark = isDark(backgroundOf(header || nav));

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tmn-mnav-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.appendChild(document.createElement("span"));
      toggle.addEventListener("click", function () {
        setOpen(panel.getAttribute("data-open") !== "true");
      });
      document.body.appendChild(toggle);
    }
    toggle.style.top = Math.max(8, Math.round((Math.min(headerHeight, 72) - 40) / 2)) + "px";
    toggle.style.right = "18px";
    toggle.style.color = dark ? "var(--panelfg,#F2F8F8)" : "var(--fg,#1D2829)";

    if (!panel) {
      panel = document.createElement("div");
      panel.className = "tmn-mnav-panel";
      panel.setAttribute("data-open", "false");
      panel.addEventListener("click", function (e) {
        if (e.target === panel || e.target.tagName === "A") setOpen(false);
      });
      document.body.appendChild(panel);
    }

    panel.textContent = "";
    if (status) {
      var badge = document.createElement("div");
      badge.className = "tmn-mnav-status";
      badge.textContent = status;
      panel.appendChild(badge);
    }
    var inner = document.createElement("nav");
    inner.setAttribute("aria-label", "Mobile navigation");
    links.forEach(function (l, i) {
      var a = document.createElement("a");
      a.href = l.href;
      a.textContent = l.text;
      // Последняя ссылка в шапке — целевое действие («Book Demo», «Discuss your task»).
      if (i === links.length - 1 && links.length > 1) a.setAttribute("data-cta", "true");
      inner.appendChild(a);
    });
    panel.appendChild(inner);
  }

  // Сетки лендингов заданы по-разному: repeat(auto-fit, minmax(<min>px, 1fr)),
  // фиксированный набор дорожек вроде «200px 200px 280px» или просто «1fr 1fr» у
  // формы контактов. Совпадением строки в атрибуте style все три не поймать, поэтому
  // решаем по замеру: сколько колонок фактически получилось, какая из них самая узкая
  // и не шире ли сетка своего контейнера. Помеченные элементы CSS кладёт в одну колонку.
  var MIN_COLUMN = 170; // уже этого на телефоне колонка нечитаема — лучше одна

  function stackNarrowGrids() {
    var nodes = document.querySelectorAll("[style*='grid-template-columns']");
    var wide = window.innerWidth > BREAKPOINT;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest("x-dc") || el.closest(".tmn-mnav-panel")) continue;
      if (wide) {
        el.removeAttribute("data-tmn-stack");
        continue;
      }
      if (el.hasAttribute("data-tmn-stack")) continue;

      var tracks = getComputedStyle(el).gridTemplateColumns.split(/\s+/)
        .map(function (t) { return parseFloat(t); })
        .filter(function (n) { return !isNaN(n); });
      if (!tracks.length) continue;

      // Одна дорожка — это уже одна колонка, но у auto-fit с большим минимумом она
      // сама шире экрана и тянет за собой всё содержимое, поэтому такие тоже правим.
      var narrowest = tracks.length > 1 ? Math.min.apply(null, tracks) : Infinity;
      var width = el.getBoundingClientRect().width;
      var parent = el.parentElement;
      // Сравнивать только с родителем нельзя: у сетки repeat(auto-fit, minmax(400px, 1fr))
      // родитель сам растягивается до 400px, и «шире родителя» не срабатывает, хотя обоим
      // тесно на экране. Поэтому мерим ещё и по окну — с запасом на отступы контейнеров.
      var overflows =
        width > window.innerWidth - 32 ||
        (parent && width > parent.clientWidth + 1);

      // Главный признак: дорожки шире самого контейнера. Так ведёт себя
      // repeat(auto-fit, minmax(400px, 1fr)) в узкой колонке — контейнер остаётся
      // 342px, дорожка получает 400px, и всё содержимое уезжает за край.
      var gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      var needed = tracks.reduce(function (a, b) { return a + b; }, 0) + gap * (tracks.length - 1);
      var tracksOverflow = needed > el.clientWidth + 1;

      if (overflows || tracksOverflow || narrowest < MIN_COLUMN) {
        el.setAttribute("data-tmn-stack", "");
      }
    }
  }

  function sync() {
    // Шапке разрешаем расти на узких экранах даже там, где навигации нет.
    var header = findHeader();
    if (header) header.classList.add("tmn-mnav-header");
    var nav = findNav();
    if (nav) build(nav, header);
    stackNarrowGrids();
  }

  // Страница перерисовывается рантаймом; пересобираем меню не чаще раза в 200 мс,
  // чтобы не отнимать кадры у анимаций.
  var pending = null;
  function syncSoon() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      sync();
    }, 200);
  }

  function start() {
    injectStyle();
    sync();
    new MutationObserver(syncSoon).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", function () {
      if (window.innerWidth > BREAKPOINT) setOpen(false);
      stackNarrowGrids();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
