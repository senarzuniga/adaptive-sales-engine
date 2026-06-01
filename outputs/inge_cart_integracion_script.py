# Script profesional de integración y validación para Ingecart
# Uso: Ejecuta este script en el entorno backend configurado con acceso a Supabase

import json
import os
from infrastructure.supabase_client import get_supabase

MODEL_PATH = os.path.join("outputs", "inge_cart_integracion_modelo.json")

with open(MODEL_PATH, encoding="utf-8") as f:
    data = json.load(f)

supabase = get_supabase()
assert supabase, "Supabase no configurado"

# 1. Empresa
company = data["company"]
company_name = company["company_name"]
res = supabase.table("companies").select("*").eq("company_name", company_name).single().execute()
company_row = res.data if hasattr(res, 'data') else res["data"]
if not company_row:
    res = supabase.table("companies").insert(company).execute()
    company_row = res.data[0] if hasattr(res, 'data') else res["data"][0]
company_id = company_row["id"]

# 2. Ofertas
for oferta in data["ofertas"]:
    oferta["company_id"] = company_id
    # Validación básica
    if not oferta.get("offer_number") or not oferta.get("customer_name"):
        print(f"Oferta inválida: {oferta}")
        continue
    # Evitar duplicados
    exists = supabase.table("offers").select("id").eq("offer_number", oferta["offer_number"]).eq("company_id", company_id).execute()
    if exists.data:
        print(f"Oferta duplicada: {oferta['offer_number']}")
        continue
    supabase.table("offers").insert(oferta).execute()

# 3. Clientes
for cliente in data["clientes"]:
    cliente["company_id"] = company_id
    if not cliente.get("customer_name"):
        print(f"Cliente inválido: {cliente}")
        continue
    exists = supabase.table("customers").select("id").eq("customer_name", cliente["customer_name"]).eq("company_id", company_id).execute()
    if exists.data:
        print(f"Cliente duplicado: {cliente['customer_name']}")
        continue
    supabase.table("customers").insert(cliente).execute()

# 4. Inteligencia y competidores
insights = [data["plan_estrategico"], data["competidores"]]
supabase.table("agent_insights").insert({
    "company_id": company_id,
    "agent": "intelligence",
    "insights": insights
}).execute()

print("Integración y validación completadas. Lanza los agentes de enriquecimiento desde el panel o backend.")
