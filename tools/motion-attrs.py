#!/usr/bin/env python3
"""
Put motion.js presets on the pages, deterministically.

index.html was choreographed by hand. This applies the same treatment to the
other 13 pages by reading what each element *is* off the export's own markup,
the way responsive-classes.py derives its grid classes:

  1. LOAD gsap + ScrollTrigger + SplitText + motion.js inside <helmet>.

  2. MARK, in document order:

       h2                      -> split-words, or split-lines when it is a
                                  large heading (font-size reaching 40px+)
       .r-gN / .r-strip grid   -> fade-up, children staggered (90 / 70 ms)
       .r-num step row         -> fade-up (rows trigger one by one as they scroll in)
       screenshot <img>        -> fade-up on its frame (the img's parent), so
                                  the border and the picture arrive together
       big number              -> count (Space Grotesk 700, 34px+, plain text,
                                  exactly one number, not a year, no arrow)
       dark CTA box            -> its h2 split-lines, then the <p> (250 ms),
                                  then the button row (400 ms, staggered);
                                  a dark box with no h2 (the case studies'
                                  "next project" link) fades up as a whole

  3. LEAVE ALONE: the nav, the hero (the <section> holding the <h1> — it
     already has its own entrance, a pointer highlight, or Contact's scramble),
     the footer, anything inside <sc-if> (it mounts later, on a state change),
     any heading holding a pointer highlight (SplitText would tear out the
     injected .ph-fx), any element with data-speed (smooth-scroll.js's
     parallax; GSAP would fold its translate into a transform), and anything
     whose ancestor already animates — one
     element never moves inside another that is moving. `count` is the one
     exception: it changes text, not position.

RE-RUNNING IS SAFE. An element that already carries data-gsap, and every
element inside it, is skipped, so running this twice changes nothing. Run it
after a Claude Design re-export, after responsive-classes.py (it reads the
.r-* classes that script adds).

    python3 tools/motion-attrs.py            # rewrite in place
    python3 tools/motion-attrs.py --check    # report, write nothing
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    'Work', 'About', 'How-I-Work', 'Contact',
    'Trio', 'Behinto', 'DigiKala-Mehr', 'Safes', 'Medio',
    'Zeero', 'Vendora', 'Agrino', 'Sharif-AICT',
]
SCRIPTS = (
    '<script src="./vendor/gsap/gsap.min.js"></script>\n'
    '<script src="./vendor/gsap/ScrollTrigger.min.js"></script>\n'
    '<script src="./vendor/gsap/SplitText.min.js"></script>\n'
    '<script src="./motion.js"></script>\n'
)
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'source', 'track', 'wbr'}
DARK = re.compile(r'background:\s*#14171c')
NUMBER = re.compile(r'-?[\d,]*\.?\d+')


class Node:
    def __init__(self, tag, attrs, start, text, parent):
        self.tag, self.attrs, self.start, self.starttag = tag, dict(attrs), start, text
        self.parent, self.children, self.text = parent, [], ''
        self.mark = self.attrs.get('data-gsap')
        self.extra = ''

    @property
    def classes(self):
        return (self.attrs.get('class') or '').split()

    @property
    def style(self):
        return self.attrs.get('style') or ''

    def ancestors(self):
        n = self.parent
        while n:
            yield n
            n = n.parent

    def walk(self):
        for c in self.children:
            yield c
            yield from c.walk()


class Tree(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.line_starts = [0]
        for m in re.finditer('\n', src):
            self.line_starts.append(m.end())
        self.root = Node('#root', [], 0, '', None)
        self.cur = self.root
        self.feed(src)

    def at(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.at(), self.get_starttag_text(), self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        n = Node(tag, attrs, self.at(), self.get_starttag_text(), self.cur)
        self.cur.children.append(n)

    def handle_endtag(self, tag):
        # pop to the matching open tag; the exports are well-formed, this is
        # only a guard against a stray close
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.text += data


def px(style):
    """Largest px the element's font-size can reach (clamp max, or plain px)."""
    m = re.search(r'font-size:\s*([^;]+)', style)
    if not m:
        return 0
    nums = [float(x) for x in re.findall(r'([\d.]+)px', m.group(1))]
    return max(nums) if nums else 0


def is_dark_box(n):
    return bool(DARK.search(n.style)) and 'border-radius: 14px' in n.style


def plan(tree):
    xdc = next((n for n in tree.root.walk() if n.tag == 'x-dc'), None)
    if not xdc:
        return []

    def skipped(n):
        for a in [n, *n.ancestors()]:
            if a.tag in ('nav', 'footer', 'script', 'helmet', 'sc-if', 'style'):
                return True
            if a.tag == 'section' and any(d.tag == 'h1' for d in a.walk()):
                return True
        return False

    def moving(n):
        return any(a.mark and a.mark != 'count' for a in [n, *n.ancestors()])

    def mark(n, name, extra=''):
        # data-speed is smooth-scroll.js's parallax, written as `translate`.
        # GSAP folds that into its own transform and restore() snaps it back,
        # so the two never share an element: wrap one inside the other.
        if n.mark or moving(n) or skipped(n) or 'data-speed' in n.attrs:
            return False
        n.mark, n.extra = name, extra
        return True

    for n in xdc.walk():
        if skipped(n):
            continue
        cls = n.classes

        if is_dark_box(n):
            h2 = next((d for d in n.walk() if d.tag == 'h2'), None)
            if not h2:
                mark(n, 'fade-up')
                continue
            mark(h2, 'split-lines')
            sibs = h2.parent.children
            after = sibs[sibs.index(h2) + 1:]
            p = next((s for s in after if s.tag == 'p'), None)
            if p:
                mark(p, 'fade-up', ' data-gsap-delay="250"')
            row = next((s for s in after if s.tag == 'div'
                        and any(d.tag == 'a' for d in s.children)), None)
            if row:
                mark(row, 'fade-up', ' data-gsap-delay="400" data-gsap-stagger="90"')
            else:
                # a single button sits straight under the copy, no row around it
                a = next((s for s in after if s.tag == 'a'), None)
                if a:
                    mark(a, 'fade-up', ' data-gsap-delay="400"')
            continue

        if n.tag == 'h2':
            if any('data-pointer-highlight' in d.attrs for d in n.walk()):
                continue
            mark(n, 'split-lines' if px(n.style) >= 40 else 'split-words')
        elif 'r-strip' in cls:
            mark(n, 'fade-up', ' data-gsap-stagger="70"')
        elif any(re.fullmatch(r'r-g\d', c) for c in cls):
            mark(n, 'fade-up', ' data-gsap-stagger="90"')
        elif 'r-num' in cls:
            mark(n, 'fade-up')
        elif n.tag == 'img' and 'logo-mark' not in (n.attrs.get('src') or ''):
            mark(n.parent, 'fade-up')
        elif (not n.children and px(n.style) >= 34 and 'font-weight: 700' in n.style
              and 'Space Grotesk' in n.style):
            t = n.text.strip()
            nums = NUMBER.findall(t)
            sibs = [c.text for c in n.parent.children if c is not n] + [n.parent.text]
            if (len(nums) == 1 and len(t) <= 10
                    # one side of a before → after pair: counting the "before"
                    # up from 0 says the opposite of what the pair means
                    and not any('→' in x for x in [t] + sibs)
                    # a year, or a step number like "01" (the zero would be
                    # lost), or too small to be worth counting
                    and not re.fullmatch(r'(19|20)\d\d|0\d+', nums[0])
                    and float(nums[0].replace(',', '')) >= 3):
                if not n.mark and not skipped(n):
                    n.mark = 'count'

    return [n for n in xdc.walk() if n.mark and 'data-gsap' not in n.attrs]


def apply(path, check):
    src = path.read_text()
    changes = []

    if 'motion.js' not in src:
        src = src.replace('</helmet>', SCRIPTS + '</helmet>', 1)
        changes.append('scripts')

    tree = Tree(src)
    marked = plan(tree)
    # insert right after the tag name, last first so offsets stay valid
    for n in sorted(marked, key=lambda n: n.start, reverse=True):
        at = n.start + 1 + len(n.tag)
        assert src[n.start:at].lower() == '<' + n.tag, (path.name, n.tag, src[n.start:at])
        src = src[:at] + ' data-gsap="%s"%s' % (n.mark, n.extra) + src[at:]

    counts = {}
    for n in marked:
        counts[n.mark] = counts.get(n.mark, 0) + 1
    summary = ', '.join('%s %d' % kv for kv in sorted(counts.items()))
    if changes or marked:
        print('%-18s %s%s' % (path.name, 'scripts + ' if changes else '', summary or 'nothing to mark'))
        if not check:
            path.write_text(src)
    else:
        print('%-18s already done' % path.name)


if __name__ == '__main__':
    check = '--check' in sys.argv
    for name in PAGES:
        apply(ROOT / (name + '.html'), check)
