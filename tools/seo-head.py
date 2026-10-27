#!/usr/bin/env python3
"""
Put each page's search metadata where a crawler reads it: the real <head>.

The export keeps <title>, the description, the canonical and the Open Graph
tags inside <helmet>, which sits in <body> until x-dc moves it into <head>
with JavaScript. Google ignores a canonical in <body>, and anything that only
exists after rendering waits for Google's second, slower rendering pass.

So, per page:

  1. MOVE out of <helmet> into a marked block in the static <head>:
     the canonical, <title>, meta description, og:* tags and the favicon.
     They are moved, not copied: the helmet manager appends every tag it
     holds to <head> without checking what is already there, so a copy
     would leave two titles and two canonicals after render.
  2. ADD og:url (= the canonical) and og:site_name, and lang="en" on <html>.
  3. HOME PAGE ONLY: a JSON-LD graph (Person + WebSite) carrying the name in
     both scripts, so a search for either one can be tied to this site.

Then it writes sitemap.xml from the canonicals, with each page's last commit
date as <lastmod>.

RE-RUNNING IS SAFE. The block is rebuilt from what it already holds plus
anything still in <helmet>, so running it twice changes nothing. Run it after
a Claude Design re-export (which puts the tags back in <helmet>).

  python3 tools/seo-head.py           # write
  python3 tools/seo-head.py --check   # list what would change

2026-10-27
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://farhadshariatmadari.github.io"
SITE_NAME = "Farhad Shariatmadari"
NAME_FA = "فرهاد شریعتمداری"

PAGES = [
    "index.html", "Work.html", "About.html", "How-I-Work.html", "Contact.html",
    "Trio.html", "Behinto.html", "Agrino.html", "Medio.html", "Vendora.html",
    "Sharif-AICT.html", "DigiKala-Mehr.html", "Zeero.html", "Safes.html",
]

START, END = "<!-- seo:start -->", "<!-- seo:end -->"

# Tags that belong in the static head. Order here is the order they're written.
MOVABLE = [
    ("canonical", re.compile(r'[ \t]*<link rel="canonical"[^>]*>\n?')),
    ("title", re.compile(r"[ \t]*<title>.*?</title>\n?", re.S)),
    ("description", re.compile(r'[ \t]*<meta name="description"[^>]*>\n?')),
    ("og", re.compile(r'[ \t]*<meta property="og:[^"]*"[^>]*>\n?')),
    ("icon", re.compile(r'[ \t]*<link rel="icon"[^>]*>\n?')),
    # Search Console ownership. Google reads it from the raw HTML, so it has
    # to be here. Removing it un-verifies the site.
    ("verify", re.compile(r'[ \t]*<meta name="google-site-verification"[^>]*>\n?')),
]

PERSON = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Person",
            "@id": SITE + "/#person",
            "name": "Farhad Shariatmadari",
            "alternateName": [NAME_FA, "فرهاد شریعت‌مداری"],
            "url": SITE + "/",
            "image": SITE + "/assets/farhad-sketch.png",
            "jobTitle": "Lead Product & Experience Designer",
            "description": "Lead Product & Experience Designer based in Tehran, "
                           "designing enterprise, healthcare, AI and commerce products "
                           "across Iran and the UAE.",
            "email": "mailto:farhadshariatmadari@gmail.com",
            "address": {"@type": "PostalAddress", "addressLocality": "Tehran",
                        "addressCountry": "IR"},
            "knowsAbout": ["Product design", "UX design", "UI design",
                           "Design systems", "طراحی محصول",
                           "طراحی تجربه کاربری", "طراحی رابط کاربری"],
            "sameAs": [
                "https://www.linkedin.com/in/farhadshariatmadari/",
                "https://github.com/farhadshariatmadari",
            ],
        },
        {
            "@type": "WebSite",
            "@id": SITE + "/#website",
            "url": SITE + "/",
            "name": SITE_NAME,
            "alternateName": NAME_FA,
            "inLanguage": "en",
            "publisher": {"@id": SITE + "/#person"},
        },
    ],
}


def helmet_span(html):
    m = re.search(r"<helmet>(.*?)</helmet>", html, re.S)
    if not m:
        raise SystemExit("no <helmet> found")
    return m.start(1), m.end(1)


def existing_block(html):
    m = re.search(re.escape(START) + r"(.*?)" + re.escape(END) + r"\n?", html, re.S)
    return m


def collect(text):
    """Pull every movable tag out of text. Returns (found, rest)."""
    found = {k: [] for k, _ in MOVABLE}
    for key, rx in MOVABLE:
        for m in rx.finditer(text):
            found[key].append(m.group(0).strip())
        text = rx.sub("", text)
    return found, text


def build_block(found, page):
    canon = found["canonical"][0] if found["canonical"] else None
    if not canon:
        raise SystemExit(f"{page}: no canonical")
    url = re.search(r'href="([^"]+)"', canon).group(1)

    og = [t for t in found["og"]
          if 'og:url"' not in t and 'og:site_name"' not in t]
    og.append(f'<meta property="og:url" content="{url}">')
    og.append(f'<meta property="og:site_name" content="{SITE_NAME}">')

    lines = [START, canon]
    lines += found["title"][:1] + found["description"][:1] + og + found["icon"][:1]
    lines += found["verify"][:1]
    if page == "index.html":
        lines.append('<script type="application/ld+json">')
        lines.append(json.dumps(PERSON, ensure_ascii=False, indent=2))
        lines.append("</script>")
    lines.append(END)
    return "\n".join(lines) + "\n", url


def process(page):
    path = ROOT / page
    html = path.read_text(encoding="utf-8")
    original = html

    # Start from what the block already holds, then add what's in <helmet>.
    old = existing_block(html)
    found_old, _ = collect(old.group(1)) if old else ({k: [] for k, _ in MOVABLE}, "")
    if old:
        html = html[:old.start()] + html[old.end():]

    a, b = helmet_span(html)
    found_new, helmet_rest = collect(html[a:b])
    html = html[:a] + helmet_rest + html[b:]

    # A fresh export wins over the old block, tag type by tag type.
    found = {k: (found_new[k] or found_old[k]) for k, _ in MOVABLE}
    block, url = build_block(found, page)

    anchor = '<script src="./support.js"></script>'
    if anchor not in html:
        raise SystemExit(f"{page}: support.js tag not found in <head>")
    html = html.replace(anchor, block + anchor, 1)

    html = re.sub(r"<html>", '<html lang="en">', html, count=1)

    if html != original:
        if "--check" in sys.argv:
            print(f"would update {page}")
        else:
            path.write_text(html, encoding="utf-8")
            print(f"updated {page}")
    return url


def lastmod(page):
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", page],
                         cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or None


def write_sitemap(urls):
    rows = []
    for page, url in urls:
        mod = lastmod(page)
        rows.append("  <url>\n    <loc>%s</loc>%s\n  </url>" % (
            url, f"\n    <lastmod>{mod}</lastmod>" if mod else ""))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(rows) + "\n</urlset>\n")
    path = ROOT / "sitemap.xml"
    if path.exists() and path.read_text(encoding="utf-8") == xml:
        return
    if "--check" in sys.argv:
        print("would update sitemap.xml")
    else:
        path.write_text(xml, encoding="utf-8")
        print("updated sitemap.xml")


if __name__ == "__main__":
    urls = [(p, process(p)) for p in PAGES]
    write_sitemap(urls)
