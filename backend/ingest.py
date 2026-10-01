"""Scrape SIT pages, clean, chunk, embed, write LanceDB index.

Usage: python ingest.py [max_pages]
"""
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import lancedb
from playwright.sync_api import sync_playwright

from llm import embed
from rag import DATA_DIR, TABLE

BASE = "https://www.singaporetech.edu.sg"
SEEDS = [
    "/", "/admissions", "/admissions/undergraduate", "/undergraduate-programmes",
    "/about", "/campus-life", "/admissions/financial-aid-scholarships",
    "/digitaltransformation", "/research-innovation",
]
CHUNK, OVERLAP = 1000, 150
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}


# the SIT site sits behind a JS challenge, so pages are rendered in real Chrome
EXTRACT_JS = """() => {
  document.querySelectorAll('script,style,nav,footer,header,form,noscript').forEach(e => e.remove());
  return {
    text: document.body.innerText,
    links: [...document.querySelectorAll('a[href]')].map(a => a.href),
  };
}"""


def crawl(max_pages: int) -> list[dict]:
    seen, queue, pages = set(), [urljoin(BASE, s) for s in SEEDS], []
    host = urlparse(BASE).netloc
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(user_agent=HEADERS["User-Agent"])
        page = ctx.new_page()
        while queue and len(pages) < max_pages:
            url = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)
            try:
                page.goto(url, timeout=40000, wait_until="domcontentloaded")
                page.wait_for_timeout(4000)
                data = page.evaluate(EXTRACT_JS)
            except Exception as e:
                print(f"skip {url}: {e}")
                continue
            text = re.sub(r"\s{2,}", " ", data["text"]).strip()
            if len(text) > 400:
                pages.append({"url": url, "content": text})
                print(f"[{len(pages)}/{max_pages}] {url} ({len(text)} chars)", flush=True)
            for href in data["links"]:
                nxt = href.split("#")[0].rstrip("/")
                if urlparse(nxt).netloc == host and nxt not in seen and len(queue) < 500:
                    queue.append(nxt)
        browser.close()
    return pages


def chunk_pages(pages: list[dict]) -> list[dict]:
    chunks = []
    for p in pages:
        text = p["content"]
        for i in range(0, len(text), CHUNK - OVERLAP):
            piece = text[i:i + CHUNK]
            if len(piece) > 200:
                chunks.append({"text": piece, "url": p["url"]})
    return chunks


def main(max_pages: int = 40):
    pages = crawl(max_pages)
    chunks = chunk_pages(pages)
    print(f"{len(pages)} pages -> {len(chunks)} chunks; embedding...")
    for i in range(0, len(chunks), 32):
        batch = chunks[i:i + 32]
        for c, v in zip(batch, embed([c["text"] for c in batch])):
            c["vector"] = v
        print(f"embedded {min(i + 32, len(chunks))}/{len(chunks)}")
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(DATA_DIR / "lancedb"))
    db.drop_table(TABLE, ignore_missing=True)
    db.create_table(TABLE, data=chunks)
    print(f"wrote {len(chunks)} chunks to {DATA_DIR / 'lancedb'}:{TABLE}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 40)
