from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

Language = Literal["es", "en"]
Status = Literal["pending", "in_progress", "confirmed", "blocked", "closed"]
Priority = Literal["critical", "high", "medium", "low", "na"]


@dataclass
class Point:
    title_es: str
    title_en: str
    desc_es: str
    desc_en: str
    owner_es: str
    owner_en: str
    due: str
    status: Status
    priority: Priority
    action_es: str
    action_en: str


PROJECT_FOLDER = Path(r"C:\Users\isena\Documents\INGECART\PM\IP SR1400")

BLACK = "111111"
ORANGE = "FF6600"
LIGHT_GRAY = "F2F2F2"
DARK_TEXT = "222222"
GRAY_TEXT = "595959"
GREEN = "2E7D32"
BLUE = "1F4E78"
RED = "C00000"
WHITE = "FFFFFF"
BORDER_GRAY = "D0D0D0"


def labels(language: Language):
    if language == "es":
        return {
            "sheet": "Registro de decisiones",
            "title": "Registro de Decisiones",
            "subtitle": "International Paper · IP SR1400 · estado de instalación y puesta en marcha",
            "project": "Proyecto",
            "customer": "Cliente",
            "document": "Documento",
            "date": "Fecha",
            "owner": "Responsable",
            "revision": "Rev.",
            "summary": "Resumen",
            "open": "Abiertos",
            "doc_value": "Registro de decisiones del proyecto",
            "footer": "INGECART · Engineering & Auditing — Registro de decisiones del proyecto.",
            "note": "Nota: las fechas marcadas como \"Por definir\" siguen pendientes de confirmación formal.",
            "section_confirmed": "CONFIRMADAS",
            "section_critical": "PENDIENTES · PRIORIDAD CRÍTICA",
            "section_normal": "PENDIENTES · PRIORIDAD ALTA / MEDIA",
            "headers": ["#", "Punto de decisión", "Descripción", "Responsable", "Fecha límite / confirmación", "Estado", "Prioridad", "Acción realizada"],
            "status": {"pending": "PENDIENTE", "in_progress": "EN CURSO", "confirmed": "CONFIRMADO", "blocked": "BLOQUEADO", "closed": "CERRADO"},
            "priority": {"critical": "CRÍTICA", "high": "ALTA", "medium": "MEDIA", "low": "BAJA", "na": "N/A"},
            "summary_words": ("confirmados", "pendientes", "bloqueados", "abiertos", "críticos"),
            "tbd": "Por definir",
        }
    return {
        "sheet": "Decision Log",
        "title": "Decision Log",
        "subtitle": "International Paper · IP SR1400 · installation and commissioning status",
        "project": "Project",
        "customer": "Customer",
        "document": "Document",
        "date": "Date",
        "owner": "Owner",
        "revision": "Rev.",
        "summary": "Summary",
        "open": "Open",
        "doc_value": "Project decision log",
        "footer": "INGECART · Engineering & Auditing — Project decision log.",
        "note": "Note: dates marked as \"TBD\" are still pending formal confirmation.",
        "section_confirmed": "CONFIRMED",
        "section_critical": "PENDING · CRITICAL PRIORITY",
        "section_normal": "PENDING · HIGH / MEDIUM PRIORITY",
        "headers": ["#", "Decision point", "Description", "Owner", "Due / confirmation date", "Status", "Priority", "Action taken"],
        "status": {"pending": "PENDING", "in_progress": "IN PROGRESS", "confirmed": "CONFIRMED", "blocked": "BLOCKED", "closed": "CLOSED"},
        "priority": {"critical": "CRITICAL", "high": "HIGH", "medium": "MEDIUM", "low": "LOW", "na": "N/A"},
        "summary_words": ("confirmed", "pending", "blocked", "open", "critical"),
        "tbd": "TBD",
    }


POINTS = [
    Point(
        "Cadena adicional para el transportador",
        "Additional conveyor chain",
        "Los metros de cadena faltantes se enviaron por avión, llegaron y pasaron aduanas. Debe verificarse la recepción física en planta y el montaje efectivo.",
        "The missing chain length was sent by air, arrived, and cleared customs. Physical receipt at the plant and effective installation must still be verified.",
        "INGECART / IP",
        "INGECART / IP",
        "2026-10-10",
        "in_progress",
        "high",
        "VERIFICAR RECEPCIÓN EN PLANTA Y MONTAJE FINAL",
        "VERIFY PLANT RECEIPT AND FINAL INSTALLATION",
    ),
    Point(
        "Restricción de energía y aire comprimido",
        "Power and compressed-air restriction",
        "Scott Smith confirmó que no habría alimentación temporal hasta inicios de la semana siguiente.",
        "Scott Smith confirmed there would be no temporary utilities until early the following week.",
        "International Paper",
        "International Paper",
        "2026-10-08",
        "confirmed",
        "na",
        "CONFIRMADO POR CLIENTE EN CADENA DE CORREOS",
        "CONFIRMED BY CUSTOMER IN EMAIL THREAD",
    ),
    Point(
        "Conexiones eléctricas y neumáticas permanentes",
        "Permanent electrical and pneumatic connections",
        "Pendiente de confirmar ejecución y disponibilidad real para pruebas funcionales del sistema.",
        "Execution and actual readiness for functional tests are still pending confirmation.",
        "International Paper / contratistas",
        "International Paper / contractors",
        "2026-10-14",
        "pending",
        "critical",
        "SOLICITAR CONFIRMACIÓN DE CONEXIONES Y DISPONIBILIDAD",
        "REQUEST CONFIRMATION OF CONNECTIONS AND READINESS",
    ),
    Point(
        "Finalización de instalación mecánica",
        "Mechanical installation completion",
        "Se acordó avanzar sin energía ni aire en lo posible. Debe cerrarse montaje, inspección mecánica y lista de pendientes.",
        "The team agreed to progress as far as possible without utilities. Installation, mechanical inspection, and punch-list closure are pending confirmation.",
        "Equipo Ingecart",
        "Ingecart team",
        "2026-10-14",
        "pending",
        "high",
        "CONFIRMAR CIERRE DE MONTAJE E INSPECCIÓN MECÁNICA",
        "CONFIRM INSTALLATION CLOSURE AND MECHANICAL INSPECTION",
    ),
    Point(
        "Visita de retorno a Waterloo",
        "Return visit to Waterloo",
        "La visita está planificada cuando estén terminadas las conexiones permanentes. Fecha y agenda pendientes.",
        "The return visit is planned after permanent utilities are completed. Date and agenda are still pending.",
        "Ingecart / Michael Kocherga / IP",
        "Ingecart / Michael Kocherga / IP",
        "",
        "pending",
        "medium",
        "DEFINIR FECHA, PARTICIPANTES, ACCESOS Y AGENDA",
        "DEFINE DATE, PARTICIPANTS, ACCESS, AND AGENDA",
    ),
    Point(
        "Pruebas funcionales y puesta en marcha",
        "Functional tests and commissioning",
        "Pendiente ejecutar pruebas de funcionamiento, producción inicial, ajustes de velocidad y formación de operadores.",
        "Pending execution of operation tests, early production runs, speed adjustments, and operator training.",
        "Ingecart / IP",
        "Ingecart / IP",
        "",
        "pending",
        "critical",
        "PREPARAR PROTOCOLO DE PRUEBAS Y CRITERIOS DE CIERRE",
        "PREPARE TEST PROTOCOL AND CLOSURE CRITERIA",
    ),
    Point(
        "Enclavamiento con la alarma contra incendios",
        "Fire-alarm interlock",
        "Pendiente validar solución técnica con relé de contacto seco, lógica de parada y evidencia de cumplimiento de seguridad.",
        "Technical solution with dry-contact relay, stop logic, and safety compliance evidence still require validation.",
        "Scott Smith / José María / Ingecart",
        "Scott Smith / Jose Maria / Ingecart",
        "",
        "blocked",
        "critical",
        "VALIDAR SOLUCIÓN TÉCNICA ANTES DE DARLA POR APROBADA",
        "VALIDATE TECHNICAL SOLUTION BEFORE APPROVAL",
    ),
    Point(
        "Facturación de la fase de instalación",
        "Installation-phase invoicing",
        "Michael indicó que la factura se emitirá al cierre satisfactorio de la fase. Pendiente comprobar cierre formal y emisión.",
        "Michael indicated the invoice will be issued after satisfactory phase closure. Formal closure and issuance are pending verification.",
        "Michael / Ingecart",
        "Michael / Ingecart",
        "",
        "pending",
        "medium",
        "CONFIRMAR CIERRE FORMAL Y EMISIÓN DE FACTURA",
        "CONFIRM FORMAL CLOSURE AND INVOICE ISSUANCE",
    ),
]


def section(point: Point):
    if point.status in {"confirmed", "closed"}:
        return "confirmed"
    if point.status == "blocked" or point.priority == "critical":
        return "critical"
    return "normal"


def apply_base_layout(ws):
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 38
    ws.column_dimensions["C"].width = 62
    ws.column_dimensions["D"].width = 20
    ws.column_dimensions["E"].width = 19
    ws.column_dimensions["F"].width = 15
    ws.column_dimensions["G"].width = 13
    ws.column_dimensions["H"].width = 44

    ws.merge_cells("A1:H1")
    ws["A1"].fill = PatternFill("solid", fgColor=BLACK)
    ws.merge_cells("A2:H2")
    ws["A2"].fill = PatternFill("solid", fgColor=ORANGE)
    ws.row_dimensions[2].height = 5


def data_row_style(ws, row: int, blocked: bool):
    fill = PatternFill("solid", fgColor=WHITE if row % 2 == 0 else LIGHT_GRAY)
    border = Border(
        left=Side(style="thin", color=BORDER_GRAY),
        right=Side(style="thin", color=BORDER_GRAY),
        top=Side(style="thin", color=BORDER_GRAY),
        bottom=Side(style="thin", color=BORDER_GRAY),
    )
    for col in "ABCDEFGH":
        c = ws[f"{col}{row}"]
        c.fill = fill
        c.border = border
        c.font = Font(name="Arial", size=10, color=DARK_TEXT)
        c.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True)
    for col in ("A", "E", "F", "G"):
        ws[f"{col}{row}"].alignment = Alignment(vertical="top", horizontal="center", wrap_text=True)
    if blocked:
        ws[f"F{row}"].fill = PatternFill("solid", fgColor=RED)
        ws[f"F{row}"].font = Font(name="Arial", size=10, bold=True, color=WHITE)


def build_workbook(language: Language) -> Workbook:
    l = labels(language)
    wb = Workbook()
    ws = wb.active
    ws.title = l["sheet"]
    apply_base_layout(ws)

    ws.merge_cells("A4:C4")
    ws["A4"] = "ingecart · Engineering & Auditing"
    ws["A4"].font = Font(name="Arial", size=12, bold=True, color=DARK_TEXT)

    ws.merge_cells("E4:H4")
    ws["E4"] = l["title"]
    ws["E4"].font = Font(name="Arial", size=18, bold=True, color=DARK_TEXT)
    ws["E4"].alignment = Alignment(horizontal="right")

    ws.merge_cells("E5:H5")
    ws["E5"] = l["subtitle"]
    ws["E5"].font = Font(name="Arial", size=11, bold=True, color=ORANGE)
    ws["E5"].alignment = Alignment(horizontal="right")

    for r in range(12, 16):
        for c in ("B", "C", "E", "F"):
            cell = ws[f"{c}{r}"]
            cell.fill = PatternFill("solid", fgColor=LIGHT_GRAY)
            cell.font = Font(name="Arial", size=10, color=DARK_TEXT, bold=c in {"B", "E"})
            cell.border = Border(
                left=Side(style="thin", color=ORANGE if c in {"B", "E"} else BORDER_GRAY),
                bottom=Side(style="thin", color=BORDER_GRAY),
            )

    ws["B12"] = l["project"]
    ws["C12"] = "IP SR1400"
    ws["E12"] = l["customer"]
    ws["F12"] = "International Paper"
    ws["B13"] = l["document"]
    ws["C13"] = l["doc_value"]
    ws["E13"] = l["date"]
    ws["F13"] = date.today()
    ws["F13"].number_format = "DD/MM/YYYY" if language == "es" else "DD-MMM-YYYY"
    ws["B14"] = l["owner"]
    ws["C14"] = "INGECART TEAM / José María"
    ws["E14"] = l["revision"]
    ws["F14"] = "1"

    confirmed = len([p for p in POINTS if p.status in {"confirmed", "closed"}])
    blocked = len([p for p in POINTS if p.status == "blocked"])
    open_count = len([p for p in POINTS if p.status not in {"confirmed", "closed"}])
    critical = len([p for p in POINTS if p.status not in {"confirmed", "closed"} and p.priority == "critical"])
    c1, c2, c3, c4, c5 = l["summary_words"]

    ws["B15"] = l["summary"]
    ws["C15"] = f"{confirmed} {c1} · {open_count} {c2} · {blocked} {c3}"
    ws["E15"] = l["open"]
    ws["F15"] = f"{open_count} {c4} · {critical} {c5}"

    header_row = 17
    for i, text in enumerate(l["headers"], start=1):
        cell = ws.cell(header_row, i, text)
        cell.font = Font(name="Arial", size=10, bold=True, color=WHITE)
        cell.fill = PatternFill("solid", fgColor=BLACK)
        cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[header_row].height = 22

    grouped = {
        "confirmed": [p for p in POINTS if section(p) == "confirmed"],
        "critical": [p for p in POINTS if section(p) == "critical"],
        "normal": [p for p in POINTS if section(p) == "normal"],
    }

    r = 18
    number = 1
    for key, title in (("confirmed", l["section_confirmed"]), ("critical", l["section_critical"]), ("normal", l["section_normal"])):
        ws.merge_cells(f"A{r}:H{r}")
        ws[f"A{r}"] = title
        ws[f"A{r}"].font = Font(name="Arial", size=10, bold=True, color=WHITE)
        ws[f"A{r}"].fill = PatternFill("solid", fgColor=ORANGE)
        r += 1
        for p in grouped[key]:
            data_row_style(ws, r, p.status == "blocked")
            ws[f"A{r}"] = number
            ws[f"B{r}"] = p.title_es if language == "es" else p.title_en
            ws[f"C{r}"] = p.desc_es if language == "es" else p.desc_en
            ws[f"D{r}"] = p.owner_es if language == "es" else p.owner_en
            ws[f"E{r}"] = p.due if p.due else l["tbd"]
            ws[f"F{r}"] = l["status"][p.status]
            ws[f"G{r}"] = l["priority"][p.priority]
            ws[f"H{r}"] = (p.action_es if language == "es" else p.action_en).upper()
            if p.status in {"confirmed", "closed"}:
                ws[f"F{r}"].font = Font(name="Arial", size=10, bold=True, color=GREEN)
            elif p.status == "in_progress":
                ws[f"F{r}"].font = Font(name="Arial", size=10, bold=True, color=BLUE)
            elif p.status == "pending":
                ws[f"F{r}"].font = Font(name="Arial", size=10, bold=True, color=ORANGE)
            if p.priority == "critical":
                ws[f"G{r}"].font = Font(name="Arial", size=10, bold=True, color=RED)
            elif p.priority == "high":
                ws[f"G{r}"].font = Font(name="Arial", size=10, bold=True, color=ORANGE)
            elif p.priority == "medium":
                ws[f"G{r}"].font = Font(name="Arial", size=10, bold=True, color=GRAY_TEXT)
            number += 1
            r += 1

    reserve_start = r
    reserve_end = r + 29
    for rr in range(reserve_start, reserve_end + 1):
        data_row_style(ws, rr, False)

    status_values = ",".join(l["status"].values())
    priority_values = ",".join(l["priority"].values())
    dv_status = DataValidation(type="list", formula1=f"\"{status_values}\"", allow_blank=True)
    dv_priority = DataValidation(type="list", formula1=f"\"{priority_values}\"", allow_blank=True)
    ws.add_data_validation(dv_status)
    ws.add_data_validation(dv_priority)
    dv_status.add(f"F18:F{reserve_end}")
    dv_priority.add(f"G18:G{reserve_end}")

    ws.conditional_formatting.add(
        f"F18:F{reserve_end}",
        CellIsRule(operator="equal", formula=[f"\"{l['status']['blocked']}\""], stopIfTrue=True, font=Font(bold=True, color=WHITE), fill=PatternFill("solid", fgColor=RED)),
    )

    footer_row = reserve_end + 2
    ws.merge_cells(f"A{footer_row}:H{footer_row}")
    ws[f"A{footer_row}"] = l["footer"]
    ws[f"A{footer_row}"].font = Font(name="Arial", size=10, italic=True, color=GRAY_TEXT)
    ws[f"A{footer_row}"].border = Border(top=Side(style="thin", color=ORANGE))

    note_row = footer_row + 1
    ws.merge_cells(f"A{note_row}:H{note_row}")
    ws[f"A{note_row}"] = l["note"]
    ws[f"A{note_row}"].font = Font(name="Arial", size=10, italic=True, color=GRAY_TEXT)

    ws.freeze_panes = "A18"
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = "17:17"

    return wb


def main():
    PROJECT_FOLDER.mkdir(parents=True, exist_ok=True)
    es_file = PROJECT_FOLDER / "Registro_Decisiones_IP_SR1400_INGECART_ES.xlsx"
    en_file = PROJECT_FOLDER / "Decision_Log_IP_SR1400_INGECART_EN.xlsx"
    build_workbook("es").save(es_file)
    build_workbook("en").save(en_file)
    print(es_file)
    print(en_file)


if __name__ == "__main__":
    main()
