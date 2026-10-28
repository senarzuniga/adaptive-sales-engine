# -*- coding: utf-8 -*-
"""
INGECART · ESQUELETO DE OFERTA GENÉRICA (Word)
Replica la ESTRUCTURA y FORMATOS de la oferta real de referencia
(NewCorr ... re3.docx), dejando SOLO estructura con PLACEHOLDERS
listos para rellenar. Sin contenido comercial real.

Formatos garantizados (extraídos de la oferta real):
  Normal    : Arial 9.5pt  #171717  (cuerpo)
  Heading1  : Arial 18pt   #F36B21  bold
  Heading2  : Arial 13pt   bold #171717
  Heading3  : Arial 10.5pt #F36B21  bold
  ListBullet: Arial 9pt
  Cabecera  : logo + "INGECART" + referencia, filete naranja #F36B21
  Pie       : CONFIDENTIAL | Cliente | Proyecto ... Page X / Y
  Tablas    : cabecera oscura #171717 texto blanco; filas alternas #F7F7F7;
              meta con etiquetas sombreadas; acento naranja.
"""
import os
from docx import Document
from docx.shared import Pt, Mm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = r"C:\Users\isena\Desktop\Pruebas Formato"
LOGO = os.path.join(OUT, "logo_ingecart.png")
DEST = os.path.join(OUT, "Oferta_ESQUELETO_GENERICO_INGECART.docx")
STATUS = os.path.join(OUT, "_status_esqueleto.txt")

ORANGE = RGBColor(0xF3, 0x6B, 0x21); ORANGE_HEX = "F36B21"
DARK = RGBColor(0x17, 0x17, 0x17);   DARK_HEX = "171717"
MID = RGBColor(0x5C, 0x5C, 0x5C)
LIGHT_HEX = "F7F7F7"; ALT_HEX = "F7F7F7"; WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PH = "‹‹{0}››"  # placeholder visible

try:
    doc = Document()
    n = doc.styles["Normal"]; n.font.name = "Arial"; n.font.size = Pt(9.5); n.font.color.rgb = DARK
    n.paragraph_format.space_after = Pt(5); n.paragraph_format.line_spacing = 1.08

    sec = doc.sections[0]
    sec.page_width, sec.page_height = Mm(210), Mm(297)
    # márgenes de la oferta real: top 964tw≈17mm, lados 1191tw≈21mm
    sec.top_margin, sec.bottom_margin = Mm(24), Mm(16)
    sec.left_margin, sec.right_margin = Mm(21), Mm(21)
    sec.header_distance, sec.footer_distance = Mm(7), Mm(7)

    def shade(cell, hexcolor):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), hexcolor)
        tcPr.append(shd)
    def no_borders(tbl):
        tblPr = tbl._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for edge in ("top","left","bottom","right","insideH","insideV"):
            e = OxmlElement("w:"+edge); e.set(qn("w:val"),"none"); e.set(qn("w:sz"),"0")
            borders.append(e)
        tblPr.append(borders)
    def field(par, instr):
        run = par.add_run()
        b=OxmlElement("w:fldChar"); b.set(qn("w:fldCharType"),"begin")
        i=OxmlElement("w:instrText"); i.set(qn("xml:space"),"preserve"); i.text=instr
        e=OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"),"end")
        run._r.append(b); run._r.append(i); run._r.append(e)
        run.font.name, run.font.size = "Arial", Pt(7); run.font.color.rgb = MID

    # ================= CABECERA =================
    hdr = sec.header
    hdr.paragraphs[0].text = ""
    htab = hdr.add_table(rows=1, cols=2, width=Mm(168)); no_borders(htab)
    htab.columns[0].width = Mm(120); htab.columns[1].width = Mm(48)
    lp = htab.cell(0,0).paragraphs[0]
    if os.path.exists(LOGO):
        lp.add_run().add_picture(LOGO, height=Mm(11))
    lr = lp.add_run("  INGECART"); lr.font.name, lr.font.size, lr.font.bold = "Arial", Pt(11), True; lr.font.color.rgb = DARK
    rp = htab.cell(0,1).paragraphs[0]; rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    rref = rp.add_run(PH.format("REFERENCIA-OFERTA")); rref.font.name, rref.font.size, rref.font.bold = "Arial", Pt(8), True; rref.font.color.rgb = MID
    hb = hdr.add_paragraph(); hb.text = ""
    pPr = hb._p.get_or_add_pPr(); pbdr = OxmlElement("w:pBdr")
    bt = OxmlElement("w:bottom"); bt.set(qn("w:val"),"single"); bt.set(qn("w:sz"),"12"); bt.set(qn("w:color"),ORANGE_HEX); bt.set(qn("w:space"),"1")
    pbdr.append(bt); pPr.append(pbdr)

    # ================= PIE =================
    ftr = sec.footer
    ftr.paragraphs[0].text = ""
    ftab = ftr.add_table(rows=1, cols=2, width=Mm(168)); no_borders(ftab)
    ftab.columns[0].width = Mm(134); ftab.columns[1].width = Mm(34)
    fp = ftab.cell(0,0).paragraphs[0]
    fr = fp.add_run("CONFIDENTIAL | " + PH.format("Cliente") + " | " + PH.format("Proyecto"))
    fr.font.name, fr.font.size = "Arial", Pt(7); fr.font.color.rgb = MID
    fpg = ftab.cell(0,1).paragraphs[0]; fpg.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r1 = fpg.add_run("Page "); r1.font.size=Pt(7); r1.font.name="Arial"; r1.font.color.rgb=MID
    field(fpg, "PAGE")
    r2 = fpg.add_run(" / "); r2.font.size=Pt(7); r2.font.name="Arial"; r2.font.color.rgb=MID
    field(fpg, "NUMPAGES")

    # ================= helpers de estilo =================
    def h1(txt):
        p = doc.add_paragraph(); r = p.add_run(txt)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(18), True; r.font.color.rgb = ORANGE
        p.paragraph_format.space_before = Pt(9); p.paragraph_format.space_after = Pt(4); return p
    def h2(txt):
        p = doc.add_paragraph(); r = p.add_run(txt)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(13), True; r.font.color.rgb = DARK
        p.paragraph_format.space_before = Pt(9); p.paragraph_format.space_after = Pt(4); return p
    def h3(txt):
        p = doc.add_paragraph(); r = p.add_run(txt)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(10.5), True; r.font.color.rgb = ORANGE
        p.paragraph_format.space_before = Pt(7); p.paragraph_format.space_after = Pt(3); return p
    def body(txt=None):
        p = doc.add_paragraph(); r = p.add_run(txt if txt else PH.format("párrafo de texto"))
        r.font.name, r.font.size = "Arial", Pt(9.5); r.font.color.rgb = DARK; return p
    def bullet(txt=None):
        p = doc.add_paragraph(style="List Bullet"); r = p.add_run(txt if txt else PH.format("punto de lista"))
        r.font.name, r.font.size = "Arial", Pt(9); r.font.color.rgb = DARK; return p

    def dark_header_table(headers, rows, widths=None):
        """Tabla con cabecera oscura #171717 y filas alternas #F7F7F7."""
        t = doc.add_table(rows=len(rows)+1, cols=len(headers)); t.style = "Table Grid"
        for j, htxt in enumerate(headers):
            c = t.rows[0].cells[j]; c.text = ""; shade(c, DARK_HEX)
            r = c.paragraphs[0].add_run(htxt); r.font.name, r.font.size, r.font.bold = "Arial", Pt(8.5), True; r.font.color.rgb = WHITE
        for i, rowvals in enumerate(rows, start=1):
            for j, val in enumerate(rowvals):
                c = t.cell(i, j); c.text = ""
                if i % 2 == 0: shade(c, ALT_HEX)
                r = c.paragraphs[0].add_run(val); r.font.name, r.font.size = "Arial", Pt(8.5); r.font.color.rgb = DARK
        if widths:
            for j, w in enumerate(widths):
                for row in t.rows: row.cells[j].width = Mm(w)
        return t

    # ================= PORTADA =================
    p = doc.add_paragraph(); rk = p.add_run(PH.format("TIPO DE DOCUMENTO — EJ. PROPUESTA TÉCNICO-COMERCIAL"))
    rk.font.name, rk.font.size, rk.font.bold = "Arial", Pt(9), True; rk.font.color.rgb = ORANGE; rk.font.all_caps = True
    p = doc.add_paragraph(); rt = p.add_run(PH.format("TÍTULO DE LA OFERTA"))
    rt.font.name, rt.font.size, rt.font.bold = "Arial", Pt(24), True; rt.font.color.rgb = DARK
    p = doc.add_paragraph(); rtag = p.add_run(PH.format("TAG1  |  TAG2  |  TAG3  |  TAG4"))
    rtag.font.name, rtag.font.size, rtag.font.bold = "Arial", Pt(10), True; rtag.font.color.rgb = MID

    tr = doc.add_table(rows=1, cols=1); no_borders(tr)
    tr.columns[0].width = Mm(42); cc = tr.cell(0,0); cc.width = Mm(42); shade(cc, ORANGE_HEX)
    rr0 = cc.paragraphs[0].add_run(" "); rr0.font.size = Pt(2)

    body(PH.format("Párrafo de presentación / resumen de la propuesta"))
    # Imagen de portada placeholder
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ri = p.add_run(PH.format("IMAGEN DE PORTADA — referencia de la solución")); ri.font.name, ri.font.size, ri.font.italic = "Arial", Pt(9), True; ri.font.color.rgb = MID

    meta = [("Customer", PH.format("Cliente")),
            ("Project", PH.format("Proyecto")),
            ("Proposal reference", PH.format("Referencia")),
            ("Date", PH.format("Fecha")),
            ("Commercial basis", PH.format("EUR | Incoterm | Lugar"))]
    t = doc.add_table(rows=len(meta), cols=2); t.style = "Table Grid"
    for i,(k,v) in enumerate(meta):
        ck, cv = t.cell(i,0), t.cell(i,1); ck.text=""; cv.text=""
        rA = ck.paragraphs[0].add_run(k); rA.font.name, rA.font.size, rA.font.bold = "Arial", Pt(9), True; rA.font.color.rgb = DARK
        rB = cv.paragraphs[0].add_run(v); rB.font.name, rB.font.size = "Arial", Pt(9); rB.font.color.rgb = DARK
        shade(ck, LIGHT_HEX)
    doc.add_page_break()

    # ================= 1 OFFER LETTER =================
    h1("1  OFFER LETTER")
    body(PH.format("Saludo: Dear ‹cliente› team,"))
    body(); body()

    # ================= 2 EXECUTIVE SUMMARY =================
    h1("2  EXECUTIVE SUMMARY")
    for _ in range(5): bullet()
    h3("DESIGN PRINCIPLE")
    body()

    # ================= 3 OPERATING CONCEPT =================
    h1("3  INTEGRATED OPERATING CONCEPT")
    dark_header_table(
        ["Process stage", "Target operating logic"],
        [[PH.format("1. Etapa"), PH.format("Lógica objetivo")],
         [PH.format("2. Etapa"), PH.format("Lógica objetivo")],
         [PH.format("3. Etapa"), PH.format("Lógica objetivo")]],
        widths=[50, 118])

    # ================= 4 SCOPE OVERVIEW =================
    h1("4  SCOPE OVERVIEW")
    body()

    # ================= 5 BLOCK A (ejemplo de bloque) =================
    h1("5  BLOCK A — " + PH.format("NOMBRE DEL BLOQUE / SISTEMA"))
    h2("5.1 Functional scope")
    for _ in range(4): bullet()
    h2("5.2 Technical basis")
    body()
    h2("5.3 Operational value")
    for _ in range(3): bullet()

    # ================= 6 BLOCK B (placeholder) =================
    h1("6  BLOCK B — " + PH.format("NOMBRE DEL BLOQUE / SISTEMA"))
    h2("6.1 Mechanical and performance basis")
    body()
    h2("6.2 Included functions")
    for _ in range(3): bullet()

    # ================= PRICE OVERVIEW =================
    h1("7  PRICE OVERVIEW")
    dark_header_table(
        ["Block", "Description", "Qty", "Unit price", "Total"],
        [[PH.format("A"), PH.format("…"), PH.format("1"), PH.format("0,00 €"), PH.format("0,00 €")],
         [PH.format("B"), PH.format("…"), PH.format("1"), PH.format("0,00 €"), PH.format("0,00 €")],
         [PH.format("—"), "TOTAL", "", "", PH.format("0,00 €")]],
        widths=[18, 78, 16, 28, 28])
    p = doc.add_paragraph(); rtot = p.add_run(PH.format("Recommended total: 0,00 € (VAT not included)"))
    rtot.font.name, rtot.font.size, rtot.font.bold = "Arial", Pt(10.5), True; rtot.font.color.rgb = ORANGE

    # ================= INSTALLATION =================
    h1("8  INSTALLATION, COMMISSIONING AND TRAINING")
    h2("8.1 Service deliverables")
    for _ in range(3): bullet()

    # ================= EXECUTION & ACCEPTANCE =================
    h1("9  PROJECT EXECUTION AND ACCEPTANCE")
    body()

    # ================= COMMERCIAL CONDITIONS =================
    h1("10  COMMERCIAL CONDITIONS")
    dark_header_table(
        ["Commercial item", "Condition"],
        [["Currency", PH.format("EUR")],
         ["Incoterm", PH.format("EXW Barcelona")],
         ["Payment", PH.format("…")],
         ["Delivery", PH.format("…")],
         ["Validity", PH.format("30 días")]],
        widths=[50, 118])
    h2("10.1 Exclusions")
    for _ in range(2): bullet()
    h2("10.2 Customer responsibilities")
    for _ in range(2): bullet()

    # ================= WARRANTY =================
    h1("11  WARRANTY AND GENERAL SALES CONDITIONS")
    body()

    # ================= OFFER ACCEPTANCE =================
    h1("12  OFFER ACCEPTANCE")
    body()
    dark_header_table(
        ["Accepted by customer", "Date"],
        [["\n\n", "\n\n"]],
        widths=[84, 84])

    # Firma
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(24)
    r1 = p.add_run("For INGECART · Engineering & Auditing"); r1.font.name, r1.font.size, r1.font.bold = "Arial", Pt(9.5), True; r1.font.color.rgb = DARK
    p = doc.add_paragraph(); r2 = p.add_run("Gerard González — Electrical & Automation Director"); r2.font.name, r2.font.size = "Arial", Pt(9.5); r2.font.color.rgb = DARK
    p = doc.add_paragraph(); r3 = p.add_run("INGECART S.L. · +34 938 183 316 · www.ingecart.eu"); r3.font.name, r3.font.size = "Arial", Pt(7.5); r3.font.color.rgb = MID

    doc.save(DEST)
    msg = "ESQUELETO OK -> %s (%d bytes)" % (DEST, os.path.getsize(DEST))
except Exception as e:
    import traceback
    msg = "ESQUELETO FAIL: %s: %s\n%s" % (type(e).__name__, e, traceback.format_exc()[:900])

open(STATUS, "w", encoding="utf-8").write(msg)
print(msg)
