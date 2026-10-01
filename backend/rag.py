"""Hybrid retrieval: LanceDB vectors + BM25, with abbreviation expansion."""
import json
import os
import re
from pathlib import Path

import lancedb
from rank_bm25 import BM25Okapi

from llm import embed

DATA_DIR = Path(os.getenv("RAG_DATA_DIR", Path(__file__).parent / "data"))
TABLE = "sit_chunks"

_abbrev = json.loads((Path(__file__).parent / "abbreviation_cache.json").read_text())
_db = _table = _bm25 = None
_docs: list[dict] = []


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def load() -> bool:
    """Open the index if it exists. Returns True when RAG is available."""
    global _db, _table, _bm25, _docs
    try:
        _db = lancedb.connect(str(DATA_DIR / "lancedb"))
        _table = _db.open_table(TABLE)
        _docs = _table.to_pandas()[["text", "url"]].to_dict("records")
        _bm25 = BM25Okapi([_tokenize(d["text"]) for d in _docs])
        return True
    except Exception:
        return False


def expand(query: str) -> str:
    words = [_abbrev.get(w.upper().strip("?.,!"), w) for w in query.split()]
    return " ".join(words)


def retrieve(query: str, k: int = 6) -> list[dict]:
    """Top-k chunks from merged vector + BM25 results, deduped by text."""
    if _table is None:
        return []
    q = expand(query)
    vec = embed([q])[0]
    vhits = _table.search(vec).limit(k).to_pandas()[["text", "url"]].to_dict("records")
    scores = _bm25.get_scores(_tokenize(q))
    bidx = sorted(range(len(scores)), key=lambda i: -scores[i])[:k]
    bhits = [_docs[i] for i in bidx if scores[i] > 0]
    seen, merged = set(), []
    for h in vhits + bhits:
        key = h["text"][:80]
        if key not in seen:
            seen.add(key)
            merged.append(h)
    return merged[:k]


def context_block(chunks: list[dict]) -> str:
    return "\n\n".join(f"[Source: {c['url']}]\n{c['text']}" for c in chunks)
