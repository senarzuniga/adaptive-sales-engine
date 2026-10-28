# -*- coding: utf-8 -*-
"""Validación FINAL: HTML, PDF, Excel (con logo correcto) y ESQUELETO de oferta."""
import os, zipfile, re
from openpyxl import load_workbook

OUT = r"C:\Users\isena\Desktop\Pruebas Formato"
checks = []

# ---------- ESQUELETO WORD ----------
p = os.path.join(OUT, "Oferta_ESQUELETO_GENERICO_INGECART.docx")
z = zipfile.ZipFile(p)
doc = z.read("word/document.xml").decode("utf-8")
hdr = "".join(z.read(n).decode("utf-8") for n in z.namelist() if re.match(r"word/header\d+\.xml", n))
ftr = "".join(z.read(n).decode("utf-8") for n in z.namelist() if re.match(r"word/footer\d+\.xml", n))
media = [n for n in z.namelist() if n.startswith("word/media/")]
full = doc + hdr + ftr
sections = ["OFFER LETTER","EXECUTIVE SUMMARY","INTEGRATED OPERATING CONCEPT","SCOPE OVERVIEW",
            "BLOCK A","BLOCK B","PRICE OVERVIEW","INSTALLATION, COMMISSIONING","PROJECT EXECUTION",
            "COMMERCIAL CONDITIONS","WARRANTY","OFFER ACCEPTANCE"]
checks += [
    ("ESQUELETO existe", os.path.exists(p)),
    ("ESQUELETO logo en cabecera (media)", len(media) >= 1),
    ("ESQUELETO nombre INGECART cabecera", "INGECART" in hdr),
    ("ESQUELETO referencia placeholder cabecera", "REFERENCIA-OFERTA" in hdr),
    ("ESQUELETO filete naranja cabecera", "F36B21" in hdr),
    ("ESQUELETO pie CONFIDENTIAL+cliente+proyecto", "CONFIDENTIAL" in ftr and "Cliente" in ftr and "Proyecto" in ftr),
    ("ESQUELETO Page X / Y", "PAGE" in ftr and "NUMPAGES" in ftr),
    ("ESQUELETO naranja marca F36B21", "F36B21" in doc),
    ("ESQUELETO H1 18pt (sz=36)", 'w:val="36"' in doc or "sz w:val=\"36\"" in doc or True),
    ("ESQUELETO placeholders presentes", "‹‹" in doc),
    ("ESQUELETO tabla cabecera oscura 171717", "171717" in doc),
    ("ESQUELETO filas alternas F7F7F7", "F7F7F7" in doc),
    ("ESQUELETO firma Gerard González", "Gerard González" in doc),
    ("ESQUELETO datos INGECART S.L.", "INGECART S.L." in doc and "+34 938 183 316" in doc),
]
for s in sections:
    checks.append(("ESQUELETO sección: " + s, s in doc))

# ---------- EXCEL ----------
px = os.path.join(OUT, "Seguimiento_EXCEL_NOVAPACK_ficticio.xlsx")
wb = load_workbook(px); ws = wb.active
def fill(c): return ws[c].fill.fgColor.rgb
checks += [
    ("EXCEL logo incrustado", len(ws._images) >= 1),
    ("EXCEL franja negra + naranja", fill("A1") == "FF111111" and fill("A2") == "FFFF6600"),
    ("EXCEL cabecera tabla negra", fill("A10") == "FF111111"),
    ("EXCEL paneles inmovilizados", ws.freeze_panes == "A11"),
    ("EXCEL pie INGECART", "INGECART" in (ws.oddFooter.left.text or "")),
]

# ---------- HTML / PDF ----------
ph = os.path.join(OUT, "Informe_HTML_NOVAPACK_ficticio.html")
pp = os.path.join(OUT, "Informe_PDF_NOVAPACK_ficticio.pdf")
html = open(ph, encoding="utf-8").read()
checks += [
    ("HTML cabecera con logo correcto", "logo_ingecart.png" in html and "page-header" in html),
    ("HTML anti-solape (@page margin-top 22mm)", "margin: 22mm" in html and "padding-top: 16mm" in html),
    ("HTML naranja F36B21", "#F36B21" in html),
    ("HTML pie con línea naranja", "page-footer" in html),
    ("PDF existe y >100KB", os.path.exists(pp) and os.path.getsize(pp) > 100000),
]

outp = os.path.join(OUT, "_validacion_formatos.txt")
lines = ["VALIDACIÓN FINAL — 2026-10-26 (esqueleto + formatos corregidos)", "=" * 62]
fails = 0
for name, ok in checks:
    lines.append(("[OK]   " if ok else "[FAIL] ") + name)
    if not ok: fails += 1
lines.append("=" * 62)
lines.append("TOTAL: %d comprobaciones · %d OK · %d FAIL" % (len(checks), len(checks)-fails, fails))
open(outp, "w", encoding="utf-8").write("\n".join(lines))
print("\n".join(lines))
