"""
PDF downloads (plan R8). The page sends the section the person is looking at (a muhurta's detail,
the results list, the day panchang, the shraddha calendar, the special-yogas list); the server
cleans it, wraps it in an A4 document (header, footer, page numbers, disclaimer) and prints it with
WeasyPrint, which joins Telugu letters correctly (pdfmake in the browser cannot).

Safety: the HTML comes from the browser, so
  - only a short list of tags and attributes survives (no scripts, images, links, forms);
  - WeasyPrint may load ONLY our own fonts and stylesheets: every other URL (http, file, data)
    is refused, so a crafted page can't read server files or reach other machines;
  - size is capped by the caller (router).
"""
import html
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import get_settings

FONT_DIR = Path(__file__).resolve().parent / "fonts"
CSS_DIR = get_settings().WEBAPP_DIR / "css"
_ALLOWED_DIRS = (FONT_DIR.resolve(), CSS_DIR.resolve())

# Stylesheets per document kind (the same ones the page uses, so the PDF looks like the screen).
_BASE_CSS = ["variables.css", "base.css", "components.css"]
KIND_CSS: Dict[str, List[str]] = {
    "muhurta": _BASE_CSS + ["muhurta-finder.css"],
    "results": _BASE_CSS + ["muhurta-finder.css"],
    "pitru": _BASE_CSS + ["muhurta-finder.css"],
    "yogas": _BASE_CSS + ["muhurta-finder.css"],
    "panchang": _BASE_CSS + ["panchang.css", "dashboard.css"],
}
KINDS = tuple(KIND_CSS)

# ── HTML cleaning ─────────────────────────────────────────────────────────────

_KEEP_TAGS = {
    "div", "span", "p", "br", "hr", "strong", "b", "em", "i", "u", "small", "sup", "sub", "code",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "section", "article", "header", "footer", "figure", "figcaption", "blockquote", "label", "mark",
}
_DROP_WITH_CONTENT = {"script", "style", "noscript", "template", "iframe", "object", "embed", "svg",
                      "button", "select", "option", "textarea", "input", "form", "img", "picture",
                      "video", "audio", "canvas", "link", "meta", "head", "title"}
_VOID = {"br", "hr", "col", "img", "input", "meta", "link"}
_KEEP_ATTRS = {"class", "colspan", "rowspan", "lang", "dir", "style"}
_HIDDEN_STYLE = re.compile(r"display\s*:\s*none", re.I)
# Emoji have no glyph in the bundled fonts and would print as empty boxes.
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-✒✔✖✙-➿⬀-⯿"
                    "⏩-⏺⌚⌛️‍]")


class _Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: List[str] = []
        self.skip_depth = 0          # > 0 while inside a dropped element
        self.stack: List[str] = []   # open tags we kept or are skipping, to match end tags

    def _skip_this(self, tag: str, attrs: Dict[str, Optional[str]]) -> bool:
        if tag in _DROP_WITH_CONTENT or "hidden" in attrs or attrs.get("aria-hidden") == "true":
            return True
        if "no-print" in (attrs.get("class") or "").split():
            return True
        return bool(_HIDDEN_STYLE.search(attrs.get("style") or ""))

    def handle_starttag(self, tag, attrs_list):
        tag = tag.lower()
        attrs = {k.lower(): v for k, v in attrs_list}
        if tag in _VOID:
            if not self.skip_depth and tag in _KEEP_TAGS:
                self.out.append(f"<{tag}>")
            return
        if self.skip_depth or self._skip_this(tag, attrs):
            self.skip_depth += 1
            self.stack.append("\0skip")
            return
        if tag not in _KEEP_TAGS:            # unknown wrapper: keep its text, drop the tag
            self.stack.append("\0bare")
            return
        kept = []
        for k, v in attrs.items():
            if k in _KEEP_ATTRS and v is not None:
                if k == "style":
                    v = re.sub(r"url\s*\(|expression\s*\(|@import", "", v, flags=re.I)
                kept.append(f' {k}="{html.escape(v, quote=True)}"')
        self.out.append(f"<{tag}{''.join(kept)}>")
        self.stack.append(tag)

    def handle_startendtag(self, tag, attrs_list):
        self.handle_starttag(tag, attrs_list)
        if tag.lower() not in _VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _VOID or not self.stack:
            return
        top = self.stack.pop()
        if top == "\0skip":
            self.skip_depth -= 1
        elif top != "\0bare":
            self.out.append(f"</{top}>")

    def handle_data(self, data):
        if not self.skip_depth:
            self.out.append(html.escape(_EMOJI.sub("", data), quote=False))

    def result(self) -> str:
        while self.stack:                    # close anything the page left open
            top = self.stack.pop()
            if top not in ("\0skip", "\0bare"):
                self.out.append(f"</{top}>")
        return "".join(self.out)


def clean_html(fragment: str) -> str:
    c = _Cleaner()
    c.feed(fragment)
    c.close()
    return c.result()


# ── Rendering ─────────────────────────────────────────────────────────────────

def _fetcher():
    """Only our bundled fonts and the webapp stylesheets may be loaded; every other URL is refused."""
    from urllib.parse import unquote, urlparse
    from weasyprint.urls import URLFetcher

    class LocalOnly(URLFetcher):
        def fetch(self, url, headers=None):
            if url.lower().startswith("file:"):
                path = Path(unquote(urlparse(url.split("?")[0]).path)).resolve()
                if any(path.is_relative_to(d) for d in _ALLOWED_DIRS) and path.is_file():
                    return super().fetch(url, headers)
            raise ValueError("blocked resource")

    return LocalOnly(allowed_protocols=("file",), allow_redirects=False, timeout=5)


_LABELS = {
    "en": {"generated": "Generated", "page": "Page", "of": "of",
           "disclaimer": "Calculated by Muhurtham from Dr. Nemani's Muhurta Shastra rules for the place and "
                         "details given. Please confirm important muhurtas with your family purohit."},
    "te": {"generated": "తయారైన తేదీ", "page": "పేజీ", "of": "/",
           "disclaimer": "ఇచ్చిన ప్రదేశం, వివరాల ఆధారంగా డా. నేమాని గారి ముహూర్త శాస్త్ర నియమాలతో ముహూర్తం యాప్ లెక్కించింది. "
                         "ముఖ్యమైన ముహూర్తాలను మీ కుటుంబ పురోహితుల వద్ద నిర్ధారించుకోండి."},
}


def _pdf_css(lang: str, generated: str) -> str:
    f = {n: (FONT_DIR / n).as_uri() for n in ("NotoSans-Regular.ttf", "NotoSans-Bold.ttf",
                                              "NotoSansTelugu-Regular.ttf", "NotoSansTelugu-Bold.ttf")}
    L = _LABELS[lang]
    q = lambda s: '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'   # noqa: E731
    return f"""
@font-face {{ font-family: "PdfLatin"; src: url("{f['NotoSans-Regular.ttf']}"); font-weight: 400; }}
@font-face {{ font-family: "PdfLatin"; src: url("{f['NotoSans-Bold.ttf']}"); font-weight: 600 900; }}
@font-face {{ font-family: "PdfTelugu"; src: url("{f['NotoSansTelugu-Regular.ttf']}"); font-weight: 400; }}
@font-face {{ font-family: "PdfTelugu"; src: url("{f['NotoSansTelugu-Bold.ttf']}"); font-weight: 600 900; }}
@page {{
  size: A4; margin: 18mm 14mm 20mm;
  @top-left {{ content: string(doctitle); font: 600 8.5pt "PdfLatin", "PdfTelugu"; color: #7a2a2a; }}
  @top-right {{ content: {q("Muhurtham · ముహూర్తం")}; font: 8.5pt "PdfLatin", "PdfTelugu"; color: #6b6b6b; }}
  @bottom-left {{ content: {q(L["generated"] + " " + generated)}; font: 8pt "PdfLatin", "PdfTelugu"; color: #6b6b6b; }}
  @bottom-right {{ content: {q(L["page"] + " ")} counter(page) {q(" " + L["of"] + " ")} counter(pages);
                   font: 8pt "PdfLatin", "PdfTelugu"; color: #6b6b6b; }}
}}
html, body {{ background: #fff !important; }}
body, * {{ font-family: "PdfLatin", "PdfTelugu", sans-serif !important; }}
body {{ font-size: 9.5pt; line-height: 1.45; color: #1f1f1f; margin: 0; padding: 0; }}
.pdf-head {{ border-bottom: 2px solid #7a2a2a; padding-bottom: 6pt; margin-bottom: 10pt; }}
.pdf-head h1 {{ string-set: doctitle content(); font-size: 16pt; margin: 0; color: #7a2a2a; }}
.pdf-head p {{ margin: 3pt 0 0; color: #444; font-size: 9.5pt; }}
.pdf-body {{ display: block; }}
.pdf-body > * {{ max-width: 100%; }}
.pdf-body div, .pdf-body section, .pdf-body table, .pdf-body li {{ box-shadow: none !important; }}
.pdf-body table {{ width: 100%; border-collapse: collapse; }}
.pdf-body th, .pdf-body td {{ border-bottom: 0.5pt solid #ccc; padding: 3pt 4pt; text-align: left; vertical-align: top; }}
.pdf-body h4, .pdf-body h3 {{ break-after: avoid; }}
.pdf-body [class*="card"], .pdf-body [class*="box"], .pdf-body [class*="strip"], .pdf-body tr,
.pdf-body li, .pdf-body .yoga-row {{ break-inside: avoid; }}
.pdf-foot {{ margin-top: 14pt; padding-top: 6pt; border-top: 0.5pt solid #bbb; font-size: 8pt; color: #555; }}
"""


def render_pdf(kind: str, title: str, subtitle: Optional[str], body_html: str, lang: str,
               tz_hours: float = 5.5) -> bytes:
    from weasyprint import CSS, HTML
    from weasyprint.text.fonts import FontConfiguration

    lang = lang if lang in _LABELS else "en"
    now = datetime.now(timezone.utc) + timedelta(hours=tz_hours)
    generated = now.strftime("%d %b %Y, %H:%M")
    doc = (f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"></head><body>'
           f'<div class="pdf-head"><h1>{html.escape(title)}</h1>'
           + (f"<p>{html.escape(subtitle)}</p>" if subtitle else "")
           + f'</div><div class="pdf-body">{clean_html(body_html)}</div>'
           f'<div class="pdf-foot">{html.escape(_LABELS[lang]["disclaimer"])}</div></body></html>')
    fonts = FontConfiguration()
    fetch = _fetcher()
    sheets = [CSS(filename=str(CSS_DIR / n), url_fetcher=fetch, font_config=fonts)
              for n in KIND_CSS[kind] if (CSS_DIR / n).is_file()]
    sheets.append(CSS(string=_pdf_css(lang, generated), url_fetcher=fetch, font_config=fonts))
    return HTML(string=doc, url_fetcher=fetch).write_pdf(stylesheets=sheets, font_config=fonts)
