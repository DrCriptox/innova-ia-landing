"""
Genera docs/requisitos-calificacion.xlsx — tabla §7 editable
con los mismos datos que se le entregaron al usuario en chat.
"""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

wb = Workbook()
ws = wb.active
ws.title = "Requisitos de Calificación"

# ─────────────────────────────────────────────
# Estilos
# ─────────────────────────────────────────────
GOLD = "B8841F"
GOLD_LIGHT = "FFF8E8"
DARK = "1A1A1A"
GREEN = "4ADE80"
WHITE = "FFFFFF"
BORDER = "D4D4D4"

thin = Side(border_style="thin", color=BORDER)
border = Border(left=thin, right=thin, top=thin, bottom=thin)

header_font = Font(name="Calibri", size=11, bold=True, color=WHITE)
header_fill = PatternFill("solid", fgColor=DARK)
header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

cell_font = Font(name="Calibri", size=11)
cell_align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
cell_align_left = Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1)

rank_font = Font(name="Calibri", size=11, bold=True)
gold_font = Font(name="Calibri", size=11, bold=True, color=GOLD)
green_font = Font(name="Calibri", size=11, bold=True, color="2E7D32")
elite_fill = PatternFill("solid", fgColor="FFF8E8")
leyenda_fill = PatternFill("solid", fgColor="FCE4A6")

# ─────────────────────────────────────────────
# Título y subtítulo
# ─────────────────────────────────────────────
ws.merge_cells("A1:G1")
ws["A1"] = "§7 REQUISITOS DE CALIFICACIÓN — Plan de Carrera Sky"
ws["A1"].font = Font(name="Calibri", size=16, bold=True, color=DARK)
ws["A1"].alignment = Alignment(horizontal="left", vertical="center")
ws.row_dimensions[1].height = 28

ws.merge_cells("A2:G2")
ws["A2"] = "Cada rango exige cumplir TODOS los criterios en el mismo mes calendario · PROPUESTA — REVISAR"
ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="666666")
ws["A2"].alignment = Alignment(horizontal="left", vertical="center")
ws.row_dimensions[2].height = 18

# Fila vacía
ws.row_dimensions[3].height = 8

# ─────────────────────────────────────────────
# Headers
# ─────────────────────────────────────────────
headers = ["#", "Rango", "Facturación estructura/mes", "PV mínimo", "Patrocinados activos", "Piernas calificadas", "Cobro estimado"]
for col_idx, h in enumerate(headers, 1):
    cell = ws.cell(row=4, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = border
ws.row_dimensions[4].height = 36

# ─────────────────────────────────────────────
# Datos
# ─────────────────────────────────────────────
data = [
    (1,  "Consultor",            2000,    200,   1, "—",              "$220 – $439"),
    (2,  "Ejecutivo",            4000,    200,   2, "—",              "$440 – $879"),
    (3,  "Director 1500",        8000,    300,   3, "1 (Ejecutivo+)", "$880 – $1,649"),
    (4,  "Director 2500",       15000,    300,   4, "2 (Ejecutivo+)", "$1,650 – $2,749"),
    (5,  "Director 4K",         25000,    400,   4, "2 (D1500+)",     "$2,750 – $4,399"),
    (6,  "Presidente 7K",       40000,    500,   5, "3 (D1500+)",     "$4,400 – $8,799"),
    (7,  "Presidente 15K",      80000,    500,   5, "3 (D2500+)",     "$8,800 – $16,499"),
    (8,  "Presidente 25K",     150000,    500,   5, "3 (D4K+)",       "$16,500 – $27,499"),
    (9,  "Embajador Elite 30K",250000,   1000,   6, "3 (P7K+)",       "$27,500 – $54,999"),
    (10, "Embajador Corona 60K",500000,  1000,   6, "3 (P15K+)",      "$55,000 – $109,999"),
    (11, "Icon 120K",          1000000,  1000,   6, "3 (P25K+)",      "$110,000 – $274,999"),
    (12, "Leyenda 300K",       2500000,  1000,   6, "3 (Embajador+)", "$275,000+"),
]

start_row = 5
for i, row in enumerate(data):
    r = start_row + i
    num, rango, factura, pv, patroc, piernas, cobro = row

    # Numero
    c = ws.cell(row=r, column=1, value=num)
    c.font = cell_font
    c.alignment = cell_align_center

    # Rango
    c = ws.cell(row=r, column=2, value=rango)
    c.font = rank_font
    c.alignment = cell_align_left

    # Facturacion (numero)
    c = ws.cell(row=r, column=3, value=factura)
    c.font = gold_font
    c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
    c.number_format = '"$"#,##0'

    # PV (numero)
    c = ws.cell(row=r, column=4, value=pv)
    c.font = cell_font
    c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
    c.number_format = '"$"#,##0'

    # Patrocinados
    c = ws.cell(row=r, column=5, value=patroc)
    c.font = cell_font
    c.alignment = cell_align_center

    # Piernas
    c = ws.cell(row=r, column=6, value=piernas)
    c.font = cell_font
    c.alignment = cell_align_center

    # Cobro estimado
    c = ws.cell(row=r, column=7, value=cobro)
    c.font = green_font
    c.alignment = Alignment(horizontal="right", vertical="center", indent=1)

    # Bordes en todas las celdas
    for col in range(1, 8):
        ws.cell(row=r, column=col).border = border

    # Fills por tier (Embajador Elite/Corona/Icon = elite, Leyenda = leyenda)
    if num in (9, 10, 11):
        for col in range(1, 8):
            ws.cell(row=r, column=col).fill = elite_fill
    elif num == 12:
        for col in range(1, 8):
            ws.cell(row=r, column=col).fill = leyenda_fill

    ws.row_dimensions[r].height = 26

# ─────────────────────────────────────────────
# Definiciones (debajo de la tabla)
# ─────────────────────────────────────────────
defs_row = start_row + len(data) + 2

ws.cell(row=defs_row, column=1, value="DEFINICIONES").font = Font(bold=True, size=11, color=GOLD)
defs_row += 1

definitions = [
    ("PV (Volumen Personal)",     "Ventas que TÚ cierras directamente con clientes/socios."),
    ("Patrocinados activos",      "Socios que TÚ trajiste personalmente y que cumplen su PV mínimo ese mes."),
    ("Piernas calificadas",       "Ramas independientes (downlines de patrocinados directos distintos) donde alguien dentro alcanza el rango indicado entre paréntesis."),
    ("Cobro estimado",            "Ingreso aproximado mensual proyectado por la combinación FSB + Uninivel + Pool."),
    ("Regla 50/50 (sugerida)",    "Ninguna pierna puede aportar más del 50% del volumen requerido para el rango."),
]

for term, desc in definitions:
    c = ws.cell(row=defs_row, column=1, value=term)
    c.font = Font(bold=True, size=10)
    c.alignment = Alignment(vertical="top")
    ws.merge_cells(start_row=defs_row, start_column=2, end_row=defs_row, end_column=7)
    c = ws.cell(row=defs_row, column=2, value=desc)
    c.font = Font(size=10, color="444444")
    c.alignment = Alignment(vertical="top", wrap_text=True)
    ws.row_dimensions[defs_row].height = 22
    defs_row += 1

# ─────────────────────────────────────────────
# Pendientes
# ─────────────────────────────────────────────
defs_row += 1
ws.cell(row=defs_row, column=1, value="PENDIENTES DE CONFIRMAR").font = Font(bold=True, size=11, color=GOLD)
defs_row += 1

pending = [
    "PV mínimos por rango (¿OK los valores propuestos?)",
    "Número de patrocinados activos por rango",
    "Piernas calificadas y su rango exigido",
    "Activar/no activar regla 50/50",
]

for p in pending:
    ws.merge_cells(start_row=defs_row, start_column=1, end_row=defs_row, end_column=7)
    c = ws.cell(row=defs_row, column=1, value="☐  " + p)
    c.font = Font(size=10)
    c.alignment = Alignment(vertical="center", indent=1)
    ws.row_dimensions[defs_row].height = 20
    defs_row += 1

# ─────────────────────────────────────────────
# Anchos de columna
# ─────────────────────────────────────────────
widths = [5, 22, 22, 12, 14, 18, 22]
for i, w in enumerate(widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w

# Freeze panes (header siempre visible al hacer scroll)
ws.freeze_panes = "A5"

# ─────────────────────────────────────────────
# Pie de página
# ─────────────────────────────────────────────
ws.oddFooter.center.text = "Innova IA · Sky System — Plan de Carrera · v1.0 — Mayo 2026"
ws.oddFooter.center.size = 9
ws.oddFooter.center.color = "888888"

# ─────────────────────────────────────────────
# Guardar
# ─────────────────────────────────────────────
output = "/home/user/innova-ia-landing/docs/requisitos-calificacion.xlsx"
wb.save(output)
print(f"Generado: {output}")
