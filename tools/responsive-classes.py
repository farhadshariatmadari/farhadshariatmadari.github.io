#!/usr/bin/env python3
"""
Make the Claude Design exports responsive, deterministically.

The pages keep their layout in inline `style="…"` attributes, which no
stylesheet can override without !important and which no media query can reach
at all. Rather than hand-edit ~150 elements across 14 files (and re-do it after
every re-export), this derives everything from the inline styles themselves:

  1. LINK  responsive.css into each <helmet>.

  2. CLASS every grid so responsive.css can collapse it. The class says what
     the grid *is*, read off its own declaration:

       200px 1fr              -> .r-side            label column beside content
       60px 1fr               -> .r-num             numbered step rows
       any spec with gap: 0   -> .r-strip .r-cN     one bordered box, N cells
       any spec with a gap    -> .r-gN              N cards floating apart

     `repeat(auto-fit, …)` is skipped — it is already fluid.

  3. CLAMP large inline padding and gap values, so gutters and card padding
     shrink continuously rather than stepping at a breakpoint:

       40px  ->  clamp(22px, 3.2vw, 40px)

     The vw coefficient is value/12.5, so the original value is reached at a
     1250px viewport — just past the 1240px page container — and the floor is
     55% of it. Values under the thresholds (28px padding, 32px gap) are left
     alone: they are detail spacing, not layout, and shrinking them only makes
     text touch borders.

  4. CLASS the nav's five moving parts, which responsive.css sheds one at a
     time as the header runs out of room.

RE-RUNNING IS SAFE. Every step checks for its own output first, so running
this twice changes nothing. That is the point: after Claude Design re-exports
a page, run it again.

    python3 tools/responsive-classes.py            # rewrite in place
    python3 tools/responsive-classes.py --check    # report, touch nothing
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# The 14 live pages. legacy-portfolio.html and Style Directions.dc.html are
# gitignored internal artefacts and are deliberately not touched.
PAGES = [
    "index.html", "Work.html", "About.html", "How-I-Work.html", "Contact.html",
    "Trio.html", "Zeero.html", "Behinto.html", "Safes.html", "Medio.html",
    "Agrino.html", "Vendora.html", "DigiKala-Mehr.html", "Sharif-AICT.html",
]

STYLESHEET_LINK = '<link rel="stylesheet" href="responsive.css">'

PAD_MIN_PX = 28   # below this, padding is detail spacing — leave it
GAP_MIN_PX = 32
VW_DIVISOR = 12.5  # value is reached at a 1250px viewport
FLOOR_RATIO = 0.55


# --------------------------------------------------------------- clamping ---

def clamped(px_value: float, minimum: int) -> str:
    """`40` -> `clamp(22px, 3.2vw, 40px)`."""
    if px_value < minimum:
        return None
    floor = max(16, round(px_value * FLOOR_RATIO))
    coefficient = round(px_value / VW_DIVISOR, 2)
    top = int(px_value) if px_value == int(px_value) else px_value
    return f"clamp({floor}px, {coefficient}vw, {top}px)"


LENGTH_LIST = re.compile(r"^(?:0|\d+(?:\.\d+)?px)(?:\s+(?:0|\d+(?:\.\d+)?px))*$")


def clamp_shorthand(value: str, minimum: int) -> str:
    """Clamp each length in a `20px 40px 84px`-style value. Returns None if the
    value is anything other than a plain list of px/0 lengths — a clamp() that
    is already there, a percentage, a var() — so re-runs are no-ops."""
    value = value.strip()
    if not LENGTH_LIST.match(value):
        return None
    out, changed = [], False
    for part in value.split():
        if part == "0":
            out.append(part)
            continue
        c = clamped(float(part[:-2]), minimum)
        if c:
            out.append(c)
            changed = True
        else:
            out.append(part)
    return " ".join(out) if changed else None


PAD_DECL = re.compile(r"\b(padding(?:-top|-right|-bottom|-left)?)\s*:\s*([^;]+)")
GAP_DECL = re.compile(r"(?<![\w-])(gap|row-gap|column-gap)\s*:\s*([^;]+)")

# `repeat(auto-fit, minmax(300px, 1fr))` looks self-responsive and mostly is —
# but 300px is a hard floor, so at any viewport under ~340px the single
# remaining column is wider than the screen and the page scrolls sideways.
# `min(300px, 100%)` keeps the intent (300px is the smallest a card should get)
# and lets the track give way when the screen is smaller than that.
MINMAX_FLOOR = re.compile(
    r"(repeat\(\s*auto-(?:fit|fill)\s*,\s*minmax\(\s*)(\d+(?:\.\d+)?px)(\s*,)"
)


def fluidify(style: str) -> str:
    """Rewrite the padding, gap and auto-fit declarations of one style attribute."""
    def pad(m):
        new = clamp_shorthand(m.group(2), PAD_MIN_PX)
        return f"{m.group(1)}: {new}" if new else m.group(0)

    def gap(m):
        new = clamp_shorthand(m.group(2), GAP_MIN_PX)
        return f"{m.group(1)}: {new}" if new else m.group(0)

    style = GAP_DECL.sub(gap, PAD_DECL.sub(pad, style))
    return MINMAX_FLOOR.sub(r"\1min(\2, 100%)\3", style)


# ------------------------------------------------------------ grid classes ---

GTC = re.compile(r"grid-template-columns\s*:\s*([^;]+)")
GAP_ANY = re.compile(r"(?<![\w-])gap\s*:\s*([^;]+)")
REPEAT = re.compile(r"^repeat\(\s*(\d+)\s*,")


def column_count(spec: str) -> int:
    m = REPEAT.match(spec)
    if m:
        return int(m.group(1))
    # `1fr 1fr 2fr`, `200px 1fr`, `1.1fr 1fr` — depth-0 whitespace groups
    return len(spec.split())


def grid_classes(style: str) -> list:
    m = GTC.search(style)
    if not m:
        return []
    spec = m.group(1).strip().rstrip(";")
    if "auto-fit" in spec or "auto-fill" in spec:
        return []          # already fluid by construction

    if spec.startswith("200px"):
        return ["r-side"]
    if spec.startswith("60px"):
        return ["r-num"]

    gap = GAP_ANY.search(style)
    is_strip = (gap is None) or gap.group(1).strip().rstrip(";") == "0"
    n = column_count(spec)
    return ["r-strip", f"r-c{n}"] if is_strip else [f"r-g{n}"]


# ------------------------------------------------- tag rewriting machinery ---

# A tag from `<` through `>`, with attribute values (which never contain `>`)
# consumed as units. Matches opening tags only; `</…>` fails the name pattern.
TAG = re.compile(r"<([a-zA-Z][\w:-]*)((?:[^>\"']|\"[^\"]*\"|'[^']*')*)>")
STYLE_ATTR = re.compile(r"(?<![\w-])style\s*=\s*\"([^\"]*)\"")
CLASS_ATTR = re.compile(r"(?<![\w-])class\s*=\s*\"([^\"]*)\"")


def add_classes(attrs: str, new: list) -> str:
    """Merge classes into a tag's attribute string, skipping ones already there."""
    m = CLASS_ATTR.search(attrs)
    if m:
        have = m.group(1).split()
        add = [c for c in new if c not in have]
        if not add:
            return attrs
        merged = " ".join(have + add)
        return attrs[:m.start()] + f'class="{merged}"' + attrs[m.end():]
    return f' class="{" ".join(new)}"' + attrs


def transform_tags(html: str) -> str:
    """Add grid classes and clamp paddings, one opening tag at a time.

    Working tag-by-tag rather than with a global regex keeps the rewrite out of
    <style> blocks and the x-dc <script> block, where the same property names
    appear but must not be touched.
    """
    def one(m):
        attrs = m.group(2)
        sm = STYLE_ATTR.search(attrs)
        if not sm:
            return m.group(0)

        style = sm.group(1)
        classes = grid_classes(style)
        fluid = fluidify(style)

        if fluid != style:
            attrs = attrs[:sm.start()] + f'style="{fluid}"' + attrs[sm.end():]
        if classes:
            attrs = add_classes(attrs, classes)
        return f"<{m.group(1)}{attrs}>"

    return TAG.sub(one, html)


# ------------------------------------------------------------ nav plumbing ---
# The header markup is byte-identical across all 14 pages, so these are exact
# matches on purpose: if a re-export changes the nav, they stop matching and
# --check reports it rather than silently classing the wrong element.

NAV_PARTS = [
    ('<nav style="display: flex; align-items: center; justify-content: space-between;'
     ' padding: 18px 40px;">', "r-nav"),
    ('<a href="./" style="display: flex; align-items: center; gap: 11px;'
     ' color: #14171c;">', "r-brand"),
    ('<span style="display: flex; align-items: baseline; gap: 10px;">', "r-brand-txt"),
    ('<span style="font-family: \'Space Grotesk\', sans-serif; font-weight: 700;'
     ' font-size: 17px; letter-spacing: -0.01em;">Farhad Shariatmadari</span>',
     "r-brand-name"),
    ('<span style="font-family: \'JetBrains Mono\', monospace; font-size: 11px;'
     ' color: #97a0ad;">/ design</span>', "r-brand-tag"),
    ('<div style="display: flex; align-items: center; gap: 32px;'
     ' font-family: \'JetBrains Mono\', monospace; font-size: 13px;">', "r-navlinks"),
]


def tag_nav(html: str, page: str, problems: list) -> str:
    for needle, cls in NAV_PARTS:
        if f'class="{cls}"' in html:
            continue                                   # already done
        if html.count(needle) != 1:
            problems.append(
                f"{page}: expected exactly 1 nav element for .{cls}, "
                f"found {html.count(needle)} — nav markup changed, class not applied"
            )
            continue
        head, _, rest = needle.partition(" ")
        html = html.replace(needle, f'{head} class="{cls}" {rest.lstrip()}', 1)
    return html


# ------------------------------------------------------------ stylesheet ---

FONTS_LINK = re.compile(r'<link href="https://fonts\.googleapis\.com/css2[^>]*>')


def link_stylesheet(html: str, page: str, problems: list) -> str:
    if STYLESHEET_LINK in html:
        return html
    m = FONTS_LINK.search(html)
    if not m:
        problems.append(f"{page}: no Google Fonts <link> to anchor responsive.css to")
        return html
    return html[:m.end()] + "\n" + STYLESHEET_LINK + html[m.end():]


# ------------------------------------------------------------------- main ---

def main() -> int:
    check = "--check" in sys.argv
    problems, changed = [], []

    for page in PAGES:
        path = ROOT / page
        if not path.exists():
            problems.append(f"{page}: missing")
            continue
        original = path.read_text(encoding="utf-8")
        html = link_stylesheet(original, page, problems)
        html = tag_nav(html, page, problems)
        html = transform_tags(html)

        if html != original:
            changed.append(page)
            if not check:
                path.write_text(html, encoding="utf-8")

    verb = "would change" if check else "rewrote"
    print(f"{verb} {len(changed)} of {len(PAGES)} pages"
          + (f": {', '.join(changed)}" if changed else ""))
    for p in problems:
        print(f"  ! {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
