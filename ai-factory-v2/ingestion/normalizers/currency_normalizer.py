from __future__ import annotations


class CurrencyNormalizer:
    FX_TO_EUR = {
        "EUR": 1.0,
        "USD": 0.92,
        "GBP": 1.15,
    }

    def normalize(self, value: float | None, currency: str | None) -> tuple[float | None, str]:
        if value is None:
            return None, "EUR"
        src = (currency or "EUR").upper()
        return round(value * self.FX_TO_EUR.get(src, 1.0), 2), "EUR"
