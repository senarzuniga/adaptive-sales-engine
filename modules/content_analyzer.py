"""
Content Analyzer – Adaptive Sales Engine
Keyword extraction, basic sentiment scoring, and trend detection for
plain text and tabular data.

No heavy ML dependencies required – works with the stdlib + pandas.
"""

from __future__ import annotations

import string
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

# ---------------------------------------------------------------------------
# Sentiment lexicons (minimal, domain-neutral)
# ---------------------------------------------------------------------------

_POSITIVE_WORDS = frozenset(
    {
        "good", "great", "excellent", "outstanding", "positive", "strong",
        "growth", "increase", "profit", "win", "success", "opportunity",
        "improve", "efficient", "innovative", "reliable", "trusted",
        "recommend", "satisfied", "happy", "approved", "confirmed", "deal",
        "agreement", "advance", "benefit", "gain", "expand", "award",
        "renew", "upgrade", "partnership", "collaboration", "achieve",
        "deliver", "solution", "value", "quality", "premium", "fast",
    }
)

_NEGATIVE_WORDS = frozenset(
    {
        "bad", "poor", "terrible", "negative", "weak", "decline", "loss",
        "fail", "problem", "risk", "issue", "delay", "reject", "cancel",
        "dispute", "complaint", "defect", "error", "miss", "overdue",
        "costly", "expensive", "penalty", "block", "uncertain",
        "concern", "dissatisfied", "unhappy", "denied", "withdrawn",
        "withdraw", "critical", "severe", "damage", "claim", "lawsuit",
    }
)

# Spanish equivalents
_POSITIVE_WORDS_ES = frozenset(
    {
        "bien", "excelente", "bueno", "positivo", "crecimiento", "éxito",
        "oportunidad", "mejorar", "eficiente", "confiable", "acuerdo",
        "beneficio", "ganancia", "expandir", "logro", "solución", "calidad",
        "premium", "rápido", "innovador", "satisfecho", "feliz", "aprobado",
        "confirmado", "trato", "avance", "asociación", "colaboración",
    }
)

_NEGATIVE_WORDS_ES = frozenset(
    {
        "mal", "pésimo", "malo", "negativo", "débil", "pérdida", "fracaso",
        "problema", "riesgo", "retraso", "rechazar", "cancelar", "disputa",
        "queja", "defecto", "error", "costoso", "caro", "penalidad",
        "bloqueo", "incierto", "preocupación", "insatisfecho", "retirado",
        "critico", "daño", "reclamación", "demanda",
    }
)

_ALL_POSITIVE = _POSITIVE_WORDS | _POSITIVE_WORDS_ES
_ALL_NEGATIVE = _NEGATIVE_WORDS | _NEGATIVE_WORDS_ES

# ---------------------------------------------------------------------------
# Stop-words (minimal; avoids heavy NLP deps)
# ---------------------------------------------------------------------------

_STOP_WORDS = frozenset(
    {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
        "for", "of", "with", "by", "from", "is", "it", "its", "this",
        "that", "are", "was", "be", "been", "have", "has", "had", "do",
        "does", "did", "will", "would", "can", "could", "may", "might",
        "shall", "should", "not", "as", "if", "up", "out", "more",
        # Spanish
        "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o",
        "de", "del", "al", "en", "con", "por", "para", "que", "se", "su",
        "es", "son", "fue", "ser", "ha", "han", "no", "si", "le", "lo",
    }
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> List[str]:
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    return [w for w in text.split() if len(w) > 2 and w not in _STOP_WORDS]


def _score_text(tokens: List[str]) -> Tuple[int, int, float]:
    """Return (positive_hits, negative_hits, compound_score ∈ [-1, 1])."""
    pos = sum(1 for t in tokens if t in _ALL_POSITIVE)
    neg = sum(1 for t in tokens if t in _ALL_NEGATIVE)
    total = pos + neg
    compound = (pos - neg) / total if total else 0.0
    return pos, neg, compound


def _label(compound: float) -> str:
    if compound > 0.1:
        return "positive"
    if compound < -0.1:
        return "negative"
    return "neutral"


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class ContentAnalyzer:
    """
    Lightweight content analysis: sentiment, keyword extraction, trends.

    Parameters
    ----------
    top_n:
        Number of top keywords to return per analysis.
    """

    def __init__(self, top_n: int = 20) -> None:
        self.top_n = top_n
        self.history: List[Dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Text analysis
    # ------------------------------------------------------------------

    def analyze_text(self, text: str, label: str = "") -> Dict[str, Any]:
        """
        Analyse a block of text.

        Returns a dict with keys:
        ``label``, ``word_count``, ``top_keywords``,
        ``positive_hits``, ``negative_hits``, ``compound``,
        ``sentiment``, ``analyzed_at``.
        """
        tokens = _tokenize(text)
        pos, neg, compound = _score_text(tokens)
        freq = Counter(tokens)
        top_kw = [w for w, _ in freq.most_common(self.top_n)]

        result: Dict[str, Any] = {
            "label": label,
            "word_count": len(tokens),
            "top_keywords": top_kw,
            "positive_hits": pos,
            "negative_hits": neg,
            "compound": round(compound, 4),
            "sentiment": _label(compound),
            "analyzed_at": datetime.utcnow().isoformat(),
        }
        self.history.append(result)
        return result

    def analyze_texts(
        self, texts: List[str], labels: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Analyse multiple texts in sequence."""
        if labels is None:
            labels = [f"text_{i}" for i in range(len(texts))]
        return [
            self.analyze_text(t, l) for t, l in zip(texts, labels)
        ]

    # ------------------------------------------------------------------
    # DataFrame column analysis
    # ------------------------------------------------------------------

    def analyze_dataframe_column(
        self, df: pd.DataFrame, column: str
    ) -> pd.DataFrame:
        """
        Apply sentiment analysis to a text column of *df*.

        Adds columns: ``sentiment``, ``compound``, ``top_keyword``.
        Returns the augmented DataFrame.
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in DataFrame")

        results = df[column].fillna("").apply(
            lambda t: self.analyze_text(str(t))
        )
        df = df.copy()
        df["sentiment"] = results.apply(lambda r: r["sentiment"])
        df["compound"] = results.apply(lambda r: r["compound"])
        df["top_keyword"] = results.apply(
            lambda r: r["top_keywords"][0] if r["top_keywords"] else ""
        )
        return df

    # ------------------------------------------------------------------
    # Trend detection
    # ------------------------------------------------------------------

    def detect_trends(
        self,
        texts: List[str],
        top_n: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Identify the most frequent keywords across a corpus and compute
        an aggregate sentiment.

        Returns a dict with:
        ``top_keywords`` (list of {word, count}), ``overall_sentiment``,
        ``overall_compound``, ``corpus_size``.
        """
        n = top_n or self.top_n
        all_tokens: List[str] = []
        compounds: List[float] = []

        for text in texts:
            tokens = _tokenize(text)
            all_tokens.extend(tokens)
            _, _, compound = _score_text(tokens)
            compounds.append(compound)

        freq = Counter(all_tokens)
        top_keywords = [
            {"word": w, "count": c} for w, c in freq.most_common(n)
        ]
        overall_compound = (
            sum(compounds) / len(compounds) if compounds else 0.0
        )

        return {
            "top_keywords": top_keywords,
            "overall_sentiment": _label(overall_compound),
            "overall_compound": round(overall_compound, 4),
            "corpus_size": len(texts),
        }

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def get_summary(self) -> Dict[str, Any]:
        """Return a summary of all analyses performed in this session."""
        if not self.history:
            return {"analyses": 0}

        sentiments = Counter(r["sentiment"] for r in self.history)
        avg_compound = sum(r["compound"] for r in self.history) / len(
            self.history
        )
        all_kw: List[str] = []
        for r in self.history:
            all_kw.extend(r.get("top_keywords", []))
        top_global = [w for w, _ in Counter(all_kw).most_common(10)]

        return {
            "analyses": len(self.history),
            "sentiment_distribution": dict(sentiments),
            "average_compound": round(avg_compound, 4),
            "top_global_keywords": top_global,
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_analyzer: Optional[ContentAnalyzer] = None


def get_content_analyzer() -> ContentAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = ContentAnalyzer()
    return _analyzer
