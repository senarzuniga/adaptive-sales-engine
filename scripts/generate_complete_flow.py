"""
FLUJO COMPLETO: LEADS → OPORTUNIDADES → VENTAS → POSTVENTA
Simulación completa del ciclo de negocio para ambas empresas trial
"""

import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any

class FullBusinessFlow:
    """Simula el flujo completo de negocio desde lead hasta postventa"""
    
    def __init__(self, company_name: str, company_data: Dict):
        self.company_name = company_name
        self.data = company_data
        self.flow = {
            "leads": [],
            "opportunities": [],
            "sales": [],
            "post_sales": [],
            "loyalty_actions": []
        }
    
    def generate_post_sales_flow(self, sales: List[Dict]) -> List[Dict]:
        """Genera flujo de postventa para ventas cerradas"""
        
        post_sales = []
        
        for sale in sales:
            # Fecha de entrega (30-90 días después de la venta)
            delivery_date = datetime.fromisoformat(sale["date"]) + timedelta(days=random.randint(20, 60))
            
            # Ticket de soporte (30% de probabilidad)
            if random.random() < 0.3:
                ticket = {
                    "sale_id": sale["id"],
                    "company": self.company_name,
                    "ticket_id": f"TKT-{self.company_name[:3]}-{len(post_sales)+1:04d}",
                    "created_date": (delivery_date + timedelta(days=random.randint(5, 90))).isoformat(),
                    "type": random.choice(["installation", "training", "maintenance", "warranty", "technical"]),
                    "priority": random.choice(["low", "medium", "high", "critical"]),
                    "status": random.choice(["open", "in_progress", "resolved", "closed"]),
                    "resolution_time_hours": random.randint(2, 120)
                }
                post_sales.append(ticket)
            
            # Oportunidad de cross-selling (40% de probabilidad)
            if random.random() < 0.4:
                cross_sell = {
                    "sale_id": sale["id"],
                    "company": self.company_name,
                    "opportunity_id": f"CS-{self.company_name[:3]}-{len(post_sales)+1:04d}",
                    "created_date": (delivery_date + timedelta(days=random.randint(30, 180))).isoformat(),
                    "product": random.choice(["extended_warranty", "maintenance_contract", "spare_parts", "training", "upgrade"]),
                    "value": sale["value"] * random.uniform(0.1, 0.4),
                    "probability": random.randint(20, 80),
                    "status": random.choice(["open", "negotiation", "won", "lost"])
                }
                post_sales.append(cross_sell)
        
        return post_sales
    
    def generate_loyalty_actions(self, customers: List[Dict]) -> List[Dict]:
        """Genera acciones de fidelización"""
        
        loyalty_actions = []
        action_types = [
            "anniversary_congratulation", "satisfaction_survey", "product_update_notification",
            "exclusive_offer", "training_invitation", "case_study_request", "referral_program"
        ]
        
        for customer in customers:
            # 2-3 acciones por cliente al año
            num_actions = random.randint(2, 4)
            
            for i in range(num_actions):
                action_date = datetime(2024, random.randint(1, 12), random.randint(1, 28))
                
                loyalty_actions.append({
                    "company": self.company_name,
                    "customer_id": customer["id"],
                    "customer_name": customer["name"],
                    "action_id": f"LOY-{self.company_name[:3]}-{len(loyalty_actions)+1:04d}",
                    "action_date": action_date.isoformat(),
                    "action_type": random.choice(action_types),
                    "executed_by": "automated_system",
                    "response": random.choice(["pending", "positive", "negative", "no_response"]),
                    "value_generated": random.uniform(100, 5000) if random.random() < 0.3 else 0
                })
        
        return loyalty_actions
    
    def generate_complete_flow(self) -> Dict:
        """Genera flujo completo de negocio"""
        
        print(f"\n🔄 Generando flujo completo para {self.company_name}")
        # 1. Leads
        leads = self.data.get("leads", [])
        if not leads and "opportunities" in self.data:
            # Generar leads ficticios a partir de oportunidades
            leads = [{
                "id": f"LEAD-{self.company_name[:3]}-{i+1:04d}",
                "company_name": opp.get("company", self.company_name),
                "created_date": opp.get("created_date", datetime.now().isoformat()),
                "score": random.randint(10, 80),
                "status": "converted",
                "assigned_to": None,
                "industry": "auto",
                "contact_name": f"Contacto {i+1}",
                "contact_email": f"contacto{i+1}@{self.company_name.lower()}.es"
            } for i, opp in enumerate(self.data["opportunities"])]
        if not leads and "offers" in self.data:
            # Generar leads ficticios a partir de ofertas
            leads = [{
                "id": f"LEAD-{self.company_name[:3]}-{i+1:04d}",
                "company_name": offer.get("customer", self.company_name),
                "created_date": offer.get("date", datetime.now().isoformat()),
                "score": random.randint(10, 80),
                "status": "converted",
                "assigned_to": None,
                "industry": "auto",
                "contact_name": f"Contacto {i+1}",
                "contact_email": f"contacto{i+1}@{self.company_name.lower()}.es"
            } for i, offer in enumerate(self.data["offers"])]
        self.flow["leads"] = leads[:50]
        # 2. Oportunidades
        opportunities = self.data.get("opportunities", [])
        if not opportunities:
            # Generar oportunidades ficticias a partir de leads
            opportunities = []
            for lead in leads[:40]:
                opp = {
                    "id": f"OPP-{self.company_name[:3]}-{len(opportunities)+1:04d}",
                    "lead_id": lead["id"],
                    "company": lead.get("company_name", self.company_name),
                    "value": random.uniform(5000, 150000),
                    "probability": random.randint(20, 90),
                    "status": random.choice(["open", "negotiation", "won", "lost"]),
                    "created_date": lead["created_date"]
                }
                opportunities.append(opp)
        self.flow["opportunities"] = opportunities
        # 3. Ventas
        sales = self.data.get("sales", [])
        if not sales:
            for opp in opportunities:
                if opp["status"] == "won" or (opp["probability"] > 70 and random.random() < 0.6):
                    sale = {
                        "id": f"SALE-{self.company_name[:3]}-{len(sales)+1:04d}",
                        "opportunity_id": opp["id"],
                        "company": opp["company"],
                        "value": opp["value"],
                        "date": (datetime.fromisoformat(opp["created_date"]) + timedelta(days=random.randint(15, 90))).isoformat(),
                        "product": random.choice(["Maquinaria CNC", "Sistema de Embalaje", "Software de Gestión"])
                    }
                    sales.append(sale)
        self.flow["sales"] = sales
        # 4. Postventa
        self.flow["post_sales"] = self.generate_post_sales_flow(sales)
        # 5. Fidelización
        customers = self.data.get("customers", [])
        if not customers and sales:
            # Generar clientes ficticios a partir de ventas
            unique_customers = {}
            for sale in sales:
                cname = sale["company"]
                if cname not in unique_customers:
                    unique_customers[cname] = {
                        "id": f"CUST-{self.company_name[:3]}-{len(unique_customers)+1:04d}",
                        "name": cname
                    }
            customers = list(unique_customers.values())
        self.flow["loyalty_actions"] = self.generate_loyalty_actions(customers)
        # 6. Métricas
        self.flow["metrics"] = {
            "total_leads": len(self.flow["leads"]),
            "total_opportunities": len(self.flow["opportunities"]),
            "total_sales": len(self.flow["sales"]),
            "total_sales_value": sum(s["value"] for s in self.flow["sales"]),
            "total_post_sales_actions": len(self.flow["post_sales"]),
            "total_loyalty_actions": len(self.flow["loyalty_actions"]),
            "conversion_lead_to_opp": round(len(self.flow["opportunities"]) / max(len(self.flow["leads"]), 1) * 100, 1),
            "conversion_opp_to_sale": round(len(self.flow["sales"]) / max(len(self.flow["opportunities"]), 1) * 100, 1)
        }
        return self.flow

def main():
    # Cargar datos de ambas empresas
    with open(r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\data\ingetrade_trial_data.json", 'r', encoding='utf-8') as f:
        ingetrade_data = json.load(f)
    
    with open(r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\data\flexosol_trial_data.json", 'r', encoding='utf-8') as f:
        flexosol_data = json.load(f)
    
    # Generar flujos
    ingetrade_flow = FullBusinessFlow("INGETRADE_TRIAL", ingetrade_data).generate_complete_flow()
    flexosol_flow = FullBusinessFlow("FLEXOSOL_TRIAL", flexosol_data).generate_complete_flow()
    
    # Guardar flujos
    output_path = r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\data\complete_flows.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            "INGETRADE_TRIAL": ingetrade_flow,
            "FLEXOSOL_TRIAL": flexosol_flow,
            "generated_at": datetime.now().isoformat()
        }, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 60)
    print("📊 FLUJOS COMPLETOS GENERADOS")
    print("=" * 60)
    
    print(f"\n🏭 INGETRADE_TRIAL:")
    print(f"   Leads: {ingetrade_flow['metrics']['total_leads']}")
    print(f"   Oportunidades: {ingetrade_flow['metrics']['total_opportunities']}")
    print(f"   Ventas: {ingetrade_flow['metrics']['total_sales']} (valor: {ingetrade_flow['metrics']['total_sales_value']:,.0f}€)")
    print(f"   Postventa: {ingetrade_flow['metrics']['total_post_sales_actions']} acciones")
    print(f"   Fidelización: {ingetrade_flow['metrics']['total_loyalty_actions']} acciones")
    
    print(f"\n🌿 FLEXOSOL_TRIAL:")
    print(f"   Leads: {flexosol_flow['metrics']['total_leads']}")
    print(f"   Oportunidades: {flexosol_flow['metrics']['total_opportunities']}")
    print(f"   Ventas: {flexosol_flow['metrics']['total_sales']} (valor: {flexosol_flow['metrics']['total_sales_value']:,.0f}€)")
    print(f"   Postventa: {flexosol_flow['metrics']['total_post_sales_actions']} acciones")
    print(f"   Fidelización: {flexosol_flow['metrics']['total_loyalty_actions']} acciones")

if __name__ == "__main__":
    main()
