# -*- coding: utf-8 -*-
"""
Generador de documentos de prueba de formato INGECART.
Crea:
  1) Oferta Word ficticia (contrato de marca ASE corregido)
  2) Excel de seguimiento ficticio (plantilla Decision Log)
Destino: C:\\Users\\isena\\Desktop\\Pruebas Formato
"""
import os
from datetime import date

OUT = r"C:\Users\isena\Desktop\Pruebas Formato"
STATUS = os.path.join(OUT, "_status_generacion.txt")
log = []

# ============================================================
# 1) OFERTA WORD — contrato: Arial, naranja FF6600, cabecera con
#    línea naranja + "INGECART · Engineering & Auditing", pie con
#    identidad + CONFIDENTIAL + Page X/Y, firma Gerard González.
# ============================================================
try:
    from docx import Document
    from docx.shared import Pt, Mm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    ORANGE = RGBColor(0xFF, 0x66, 0x00)
    ORANGE_HEX = "FF6600"
    DARK_HEX = "171717"
    MID = RGBColor(0x5C, 0x5C, 0x5C)
    DARK = RGBColor(0x17, 0x17, 0x17)
    LIGHT_HEX = "F7F7F7"

    doc = Document()

    # Estilo base Arial
    st = doc.styles["Normal"]
    st.font.name = "Arial"
    st.font.size = Pt(10)
    st.font.color.rgb = RGBColor(0x22, 0x22, 0x22)

    sec = doc.sections[0]
    sec.page_width, sec.page_height = Mm(210), Mm(297)
    sec.top_margin, sec.bottom_margin = Mm(25), Mm(20)
    sec.left_margin, sec.right_margin = Mm(18), Mm(18)

    def shade(cell, hexcolor):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:fill"), hexcolor)
        tcPr.append(shd)

    # ---- CABECERA: logo-texto + referencia + línea naranja de marca
    hdr = sec.header
    hp = hdr.paragraphs[0]
    hp.text = ""
    r1 = hp.add_run("INGECART")
    r1.font.name, r1.font.size, r1.font.bold = "Arial", Pt(11), True
    r1.font.color.rgb = DARK
    r2 = hp.add_run("    OF-PRUEBA-0001")
    r2.font.name, r2.font.size = "Arial", Pt(8)
    r2.font.color.rgb = MID
    hp2 = hdr.add_paragraph()
    rb = hp2.add_run("INGECART · Engineering & Auditing")
    rb.font.name, rb.font.size = "Arial", Pt(8)
    rb.font.color.rgb = MID
    pPr = hp2._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:color"), ORANGE_HEX)
    bottom.set(qn("w:space"), "1")
    pbdr.append(bottom)
    pPr.append(pbdr)

    # ---- PIE: identidad + CONFIDENTIAL + Page X / Y
    ftr = sec.footer
    fp = ftr.paragraphs[0]
    fp.text = ""
    fr = fp.add_run("INGECART · Engineering & Auditing — CONFIDENTIAL | NOVAPACK ATLANTIC S.L. | Puesto de encolado NP-220")
    fr.font.name, fr.font.size = "Arial", Pt(7)
    fr.font.color.rgb = MID
    fp2 = ftr.add_paragraph()
    fp2.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    def add_field(par, instr):
        run = par.add_run()
        fldChar1 = OxmlElement("w:fldChar"); fldChar1.set(qn("w:fldCharType"), "begin")
        instrText = OxmlElement("w:instrText"); instrText.set(qn("xml:space"), "preserve"); instrText.text = instr
        fldChar2 = OxmlElement("w:fldChar"); fldChar2.set(qn("w:fldCharType"), "end")
        run._r.append(fldChar1); run._r.append(instrText); run._r.append(fldChar2)
        run.font.name, run.font.size = "Arial", Pt(7)
        run.font.color.rgb = MID

    rp = fp2.add_run("Page ")
    rp.font.name, rp.font.size = "Arial", Pt(7); rp.font.color.rgb = MID
    add_field(fp2, "PAGE")
    rp2 = fp2.add_run(" / ")
    rp2.font.name, rp2.font.size = "Arial", Pt(7); rp2.font.color.rgb = MID
    add_field(fp2, "NUMPAGES")

    # ---- PORTADA (kicker naranja, título, regla naranja)
    p = doc.add_paragraph()
    rk = p.add_run("PROPUESTA TÉCNICO-COMERCIAL · DOCUMENTO DE PRUEBA")
    rk.font.name, rk.font.size, rk.font.bold = "Arial", Pt(9), True
    rk.font.color.rgb = ORANGE
    rk.font.all_caps = True

    p = doc.add_paragraph()
    rt = p.add_run("Puesto de encolado semiautomático NP-220")
    rt.font.name, rt.font.size, rt.font.bold = "Arial", Pt(22), True
    rt.font.color.rgb = DARK

    # Regla naranja (tabla de una celda sombreada)
    tr = doc.add_table(rows=1, cols=1)
    tr.alignment = WD_TABLE_ALIGNMENT.LEFT
    tr.columns[0].width = Mm(42)
    c = tr.cell(0, 0)
    c.width = Mm(42)
    shade(c, ORANGE_HEX)
    c.paragraphs[0].paragraph_format.space_before = Pt(0)
    c.paragraphs[0].paragraph_format.space_after = Pt(0)
    rc = c.paragraphs[0].add_run(" ")
    rc.font.size = Pt(2)

    p = doc.add_paragraph()
    rs = p.add_run("Suministro e integración de un puesto de encolado semiautomático con control térmico por recetas y trazabilidad de lote para la línea 2 de conversión.")
    rs.font.name, rs.font.size = "Arial", Pt(10.5)
    rs.font.color.rgb = RGBColor(0x4A, 0x4A, 0x4A)

    # Tabla meta con borde izquierdo naranja
    meta = [
        ("Cliente", "NOVAPACK ATLANTIC S.L. (ficticio)", "Nº oferta", "OF-PRUEBA-0001 · Rev. 0"),
        ("Aplicación", "Encolado semiautomático NP-220", "Fecha", "26 de octubre de 2026"),
        ("Alcance", "Suministro + integración + SAT", "Validez", "30 días naturales"),
        ("Contacto", "Gerard González — Electrical & Automation Director", "Teléfono", "+34 938 183 316"),
    ]
    t = doc.add_table(rows=len(meta), cols=4)
    t.style = "Table Grid"
    for i, row in enumerate(meta):
        for j, val in enumerate(row):
            cell = t.cell(i, j)
            cell.text = ""
            run = cell.paragraphs[0].add_run(val)
            run.font.name, run.font.size = "Arial", Pt(8.5)
            if j in (0, 2):
                run.font.bold = True
                run.font.color.rgb = DARK

    doc.add_paragraph()

    def h1(txt):
        p = doc.add_paragraph()
        r = p.add_run(txt)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(14), True
        r.font.color.rgb = ORANGE
        return p

    def h2(txt):
        p = doc.add_paragraph()
        r = p.add_run(txt)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(11), True
        r.font.color.rgb = DARK
        return p

    def body(txt):
        p = doc.add_paragraph(txt)
        for r in p.runs:
            r.font.name, r.font.size = "Arial", Pt(9.5)
            r.font.color.rgb = DARK
        return p

    # ---- SECCIONES
    h1("1  RESUMEN EJECUTIVO")
    body("La presente propuesta cubre el suministro, la integración y la puesta en marcha de un puesto de encolado semiautomático NP-220, con lazo térmico por recetas, registro de trazabilidad por bobina y enclavamientos de seguridad conforme a la directiva de máquinas vigente. (Contenido ficticio para validación de formato.)")

    h1("2  ALCANCE Y ARQUITECTURA")
    body("Arquitectura de control basada en PLC compacto con HMI de 7\", comunicación PROFINET con el maestro de línea y volcado OPC UA al MES de planta. Incluye armario de maniobra reutilizado, cableado, neumática de apoyo y documentación CE.")

    h2("2.1  Partidas principales")
    items = [
        ("Puesto NP-220 completo (mecánica + control)", "1 ud", "38.400,00 €"),
        ("Integración MES y trazabilidad de lote", "1 lote", "6.850,00 €"),
        ("Puesta en marcha y SAT en planta", "1 lote", "4.200,00 €"),
        ("Formación de operarios (2 turnos)", "1 lote", "1.150,00 €"),
    ]
    t = doc.add_table(rows=len(items) + 1, cols=3)
    t.style = "Table Grid"
    hdr_cells = t.rows[0].cells
    for j, htxt in enumerate(["Partida", "Cantidad", "Importe"]):
        hdr_cells[j].text = ""
        shade(hdr_cells[j], DARK_HEX)
        r = hdr_cells[j].paragraphs[0].add_run(htxt)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(8.5), True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    for i, row in enumerate(items, start=1):
        for j, val in enumerate(row):
            cell = t.cell(i, j)
            cell.text = ""
            if i % 2 == 0:
                shade(cell, LIGHT_HEX)
            r = cell.paragraphs[0].add_run(val)
            r.font.name, r.font.size = "Arial", Pt(8.5)
            r.font.color.rgb = DARK
    p = doc.add_paragraph()
    rt2 = p.add_run("Total recomendado: 50.600,00 € (sin IVA)")
    rt2.font.name, rt2.font.size, rt2.font.bold = "Arial", Pt(10.5), True
    rt2.font.color.rgb = ORANGE

    h1("3  CONDICIONES COMERCIALES")
    body("Plazo de entrega estimado: 10 semanas desde pedido firme. Pago: 40 % a la aceptación, 50 % a la entrega, 10 % tras SAT. Garantía: 12 meses desde la aceptación. (Condiciones ficticias.)")

    h1("4  ACEPTACIÓN DE OFERTA")
    t = doc.add_table(rows=2, cols=2)
    t.style = "Table Grid"
    a = t.cell(0, 0); shade(a, LIGHT_HEX)
    ra = a.paragraphs[0].add_run("Aceptado por el cliente"); ra.font.bold = True; ra.font.name = "Arial"; ra.font.size = Pt(8.5)
    b = t.cell(0, 1); shade(b, LIGHT_HEX)
    rb2 = b.paragraphs[0].add_run("Fecha"); rb2.font.bold = True; rb2.font.name = "Arial"; rb2.font.size = Pt(8.5)

    # ---- FIRMA CORPORATIVA (bloque añadido en la corrección)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(24)
    rf1 = p.add_run("Por INGECART · Engineering & Auditing")
    rf1.font.name, rf1.font.size, rf1.font.bold = "Arial", Pt(9.5), True
    rf1.font.color.rgb = DARK
    p = doc.add_paragraph()
    rf2 = p.add_run("Gerard González — Electrical & Automation Director")
    rf2.font.name, rf2.font.size = "Arial", Pt(9.5)
    rf2.font.color.rgb = DARK
    p = doc.add_paragraph()
    rf3 = p.add_run("INGECART S.L. · +34 938 183 316 · www.ingecart.eu")
    rf3.font.name, rf3.font.size = "Arial", Pt(7.5)
    rf3.font.color.rgb = MID

    path_docx = os.path.join(OUT, "Oferta_WORD_NOVAPACK_ficticia.docx")
    doc.save(path_docx)
    log.append("WORD OK -> " + path_docx + " (" + str(os.path.getsize(path_docx)) + " bytes)")
except Exception as e:
    import traceback
    log.append("WORD FAIL: " + type(e).__name__ + ": " + str(e))
    log.append(traceback.format_exc()[:800])

# ============================================================
# 2) EXCEL DE SEGUIMIENTO — plantilla Decision Log INGECART
# ============================================================
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.formatting.rule import CellIsRule, FormulaRule

    BLACK = "FF111111"
    XORANGE = "FFFF6600"
    GREY_BG = "FFF2F2F2"
    BORDER_GREY = "FFD0D0D0"
    TXT = "FF222222"
    WHITE_TXT = "FFFFFFFF"
    RED = "FFC00000"
    GREEN = "FF2E7D32"
    BLUE = "FF1F4E78"
    GREY_TXT = "FF595959"

    wb = Workbook()
    ws = wb.active
    ws.title = "Registro"
    ws.sheet_view.showGridLines = False

    widths = {"A": 6, "B": 38, "C": 62, "D": 20, "E": 18, "F": 15, "G": 13, "H": 44}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    thin = Side(style="thin", color=BORDER_GREY)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # Franja negra fila 1 / naranja fila 2
    for col in range(1, 9):
        ws.cell(row=1, column=col).fill = PatternFill("solid", fgColor=BLACK)
        ws.cell(row=2, column=col).fill = PatternFill("solid", fgColor=XORANGE)
    ws.row_dimensions[1].height = 22
    ws.row_dimensions[2].height = 4

    # Logo + título
    ws["A1"] = "ingecart · Engineering & Auditing"
    ws["A1"].font = Font(name="Arial", size=12, bold=True, color=WHITE_TXT)
    ws["F1"] = "Registro de Decisiones — PRUEBA"
    ws["F1"].font = Font(name="Arial", size=18, bold=True, color=WHITE_TXT)
    ws.merge_cells("F1:H1")
    ws["F1"].alignment = Alignment(horizontal="right")
    ws["F3"] = "NOVAPACK ATLANTIC S.L. · Puesto NP-220 · 400 V · prueba de formato"
    ws["F3"].font = Font(name="Arial", size=11, bold=True, color=XORANGE)
    ws.merge_cells("F3:H3")
    ws["F3"].alignment = Alignment(horizontal="right")

    # Tabla de datos del proyecto (filas 5-8)
    meta = [
        ("Proyecto", "NP-220 puesto de encolado", "Cliente", "NOVAPACK ATLANTIC S.L. (ficticio)"),
        ("Documento", "Registro de decisiones del proyecto", "Fecha", date(2026, 10, 26)),
        ("Responsable", "Gerard González (prueba)", "Rev.", 0),
        ("Resumen", '="X confirmados · Y pendientes · Z bloqueados (ilustrativo)"', "Abiertos", '="N abiertos · M críticos (ilustrativo)"'),
    ]
    r0 = 5
    for i, (k1, v1, k2, v2) in enumerate(meta):
        r = r0 + i
        for j, (k, v) in enumerate(((k1, v1), (k2, v2))):
            ck = ws.cell(row=r, column=1 + j * 4, value=k)
            cv = ws.cell(row=r, column=2 + j * 4, value=v)
            for cc in (ck, cv):
                cc.fill = PatternFill("solid", fgColor=GREY_BG)
                cc.font = Font(name="Arial", size=10, bold=(cc is ck), color=TXT)
                cc.border = Border(left=Side(style="thick", color=XORANGE) if cc is ck else None)
    # Cabecera tabla (fila 10)
    headers = ["#", "Punto de decisión", "Descripción", "Responsable", "Fecha límite / confirmación", "Estado", "Prioridad", "Acción realizada"]
    HR = 10
    for j, htxt in enumerate(headers, start=1):
        c = ws.cell(row=HR, column=j, value=htxt)
        c.fill = PatternFill("solid", fgColor=BLACK)
        c.font = Font(name="Arial", size=10, bold=True, color=WHITE_TXT)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = border
    ws.freeze_panes = "A11"

    # Desplegables
    dv_estado = DataValidation(type="list", formula1='"PENDIENTE,EN CURSO,CONFIRMADO,BLOQUEADO,CERRADO"', allow_blank=True)
    dv_prio = DataValidation(type="list", formula1='"CRÍTICA,ALTA,MEDIA,BAJA,N/A"', allow_blank=True)
    ws.add_data_validation(dv_estado)
    ws.add_data_validation(dv_prio)
    dv_estado.add("F11:F60")
    dv_prio.add("G11:G60")

    # Bloques y puntos ficticios
    blocks = [
        ("CONFIRMADAS", [
            ("Alcance eléctrico NP-220", "Se confirma que el alcance incluye control, neumática de apoyo y SAT. Excluida obra civil.", "Gerard González", date(2026, 10, 20), "CONFIRMADO", "N/A", "CONFIRMADO EN REUNIÓN (FECHA APROX.)"),
            ("Interfaz MES vía OPC UA", "El MES de planta acepta servidor OPC UA; queda definido el namespace de lote.", "IT cliente", date(2026, 10, 22), "CONFIRMADO", "N/A", "CONFIRMADO SOBRE LAYOUT (FECHA APROX.)"),
        ]),
        ("PENDIENTES · PRIORIDAD CRÍTICA", [
            ("Validación térmica de recetas", "Falta validar la deriva térmica real con las tres recetas principales antes del SAT.", "Oficina técnica", date(2026, 11, 6), "PENDIENTE", "CRÍTICA", "A ESPERA DE ENSAYO EN PLANTA"),
            ("Certificado CE del puesto", "Pendiente de cerrar el anexo de enclavamientos con el organismo notificado.", "Gerard González", date(2026, 11, 13), "BLOQUEADO", "CRÍTICA", "A ESPERA DE RESPUESTA DE ORGANISMO"),
        ]),
        ("PENDIENTES · PRIORIDAD ALTA / MEDIA", [
            ("Formación en dos turnos", "Coordinar calendario de formación con producción para no solapar campaña alta.", "RRHH cliente", date(2026, 11, 20), "EN CURSO", "ALTA", "E-MAIL RRHH PARA CONFIRMACIÓN"),
            ("Repuesto inicial de resistencias", "Definir si el lote inicial incluye repuesto de resistencias de cartucho.", "Compras", None, "PENDIENTE", "MEDIA", "A DEFINIR CON EL CLIENTE"),
        ]),
    ]

    row = HR + 1
    num = 1
    for block_title, points in blocks:
        bc = ws.cell(row=row, column=1, value=block_title)
        for col in range(1, 9):
            cc = ws.cell(row=row, column=col)
            cc.fill = PatternFill("solid", fgColor=XORANGE)
            cc.font = Font(name="Arial", size=10, bold=True, color=WHITE_TXT)
            cc.border = border
        bc.value = block_title
        row += 1
        for i, (punto, desc, resp, fecha, estado, prio, accion) in enumerate(points):
            vals = [num, punto, desc, resp, fecha if fecha else "Por definir", estado, prio, accion]
            for j, v in enumerate(vals, start=1):
                c = ws.cell(row=row, column=j, value=v)
                c.font = Font(name="Arial", size=10, color=TXT)
                c.border = border
                if (i % 2) == 1:
                    c.fill = PatternFill("solid", fgColor=GREY_BG)
                if j == 1:
                    c.alignment = Alignment(horizontal="center")
                if j in (5, 6, 7):
                    c.alignment = Alignment(horizontal="center")
                if j in (3, 8):
                    c.alignment = Alignment(wrap_text=True, vertical="top")
                if j == 5 and fecha:
                    c.number_format = "DD/MM/YYYY"
            num += 1
            row += 1

    # Formato condicional
    rng_estado = "F11:F60"
    ws.conditional_formatting.add(rng_estado, CellIsRule(operator="equal", formula=['"CONFIRMADO"'], font=Font(name="Arial", size=10, bold=True, color=GREEN)))
    ws.conditional_formatting.add(rng_estado, CellIsRule(operator="equal", formula=['"CERRADO"'], font=Font(name="Arial", size=10, bold=True, color=GREEN)))
    ws.conditional_formatting.add(rng_estado, CellIsRule(operator="equal", formula=['"PENDIENTE"'], font=Font(name="Arial", size=10, bold=True, color=XORANGE)))
    ws.conditional_formatting.add(rng_estado, CellIsRule(operator="equal", formula=['"EN CURSO"'], font=Font(name="Arial", size=10, bold=True, color=BLUE)))
    ws.conditional_formatting.add(rng_estado, CellIsRule(operator="equal", formula=['"BLOQUEADO"'], font=Font(name="Arial", size=10, bold=True, color=WHITE_TXT), fill=PatternFill("solid", fgColor=RED)))
    rng_prio = "G11:G60"
    ws.conditional_formatting.add(rng_prio, CellIsRule(operator="equal", formula=['"CRÍTICA"'], font=Font(name="Arial", size=10, bold=True, color=RED)))
    ws.conditional_formatting.add(rng_prio, CellIsRule(operator="equal", formula=['"ALTA"'], font=Font(name="Arial", size=10, bold=True, color=XORANGE)))
    ws.conditional_formatting.add(rng_prio, CellIsRule(operator="equal", formula=['"MEDIA"'], font=Font(name="Arial", size=10, bold=True, color=GREY_TXT)))

    # Pie e impresión
    pr = row + 1
    pc = ws.cell(row=pr, column=1, value="INGECART · Engineering & Auditing — Registro de decisiones del proyecto. (PRUEBA DE FORMATO — contenido ficticio)")
    pc.font = Font(name="Arial", size=9, color=XORANGE)
    ws.merge_cells(start_row=pr, start_column=1, end_row=pr, end_column=8)

    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = 9  # A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = "10:10"
    ws.oddFooter.left.text = "INGECART · Engineering && Auditing"
    ws.oddFooter.right.text = "Página &P de &N"

    path_xlsx = os.path.join(OUT, "Seguimiento_EXCEL_NOVAPACK_ficticio.xlsx")
    wb.save(path_xlsx)
    log.append("EXCEL OK -> " + path_xlsx + " (" + str(os.path.getsize(path_xlsx)) + " bytes)")
except Exception as e:
    import traceback
    log.append("EXCEL FAIL: " + type(e).__name__ + ": " + str(e))
    log.append(traceback.format_exc()[:800])

with open(STATUS, "w", encoding="utf-8") as f:
    f.write("\n".join(log))
print("\n".join(log))
