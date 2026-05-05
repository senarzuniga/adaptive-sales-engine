from __future__ import annotations


class UnitNormalizer:
    def normalize_speed(self, value: float | None, unit: str | None) -> tuple[float | None, str]:
        if value is None:
            return None, "m/min"
        src = (unit or "m/min").lower()
        if src in {"m/h", "mph"}:
            return round(value / 60, 3), "m/min"
        return value, "m/min"

    def normalize_width(self, value: float | None, unit: str | None) -> tuple[float | None, str]:
        if value is None:
            return None, "mm"
        src = (unit or "mm").lower()
        if src == "cm":
            return value * 10, "mm"
        if src == "m":
            return value * 1000, "mm"
        return value, "mm"
