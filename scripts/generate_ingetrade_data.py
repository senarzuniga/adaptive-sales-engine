"""
GENERACIÓN DE DATOS SIMULADOS - INGETRADE_TRIAL
Empresa de trading de maquinaria industrial
Facturación anual: 3M€ | Antigüedad: 5 años | 2 comerciales
"""

import json
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any
from dataclasses import dataclass, field
import os

@dataclass
class CompanyProfile:
    name: str
    industry: str
    founded_year: int
    annual_revenue: float
    employees: int
    sales_team_size: int
    avg_project_value: float
    max_project_value: float
    markets: List[str]

@dataclass
class SalesData:
    year: int
    quarter: int
    revenue: float
    margin: float
    leads: int
    opportunities: int
    won_deals: int

class DataGeneratorINGETRADE:
    """Generador de datos simulados para INGETRADE_TRIAL"""
    
    def __init__(self):
        self.company = CompanyProfile(
            name="INGETRADE_TRIAL",
            industry="Industrial Machinery Trading",
            founded_year=2020,
            annual_revenue=3_000_000,
            employees=15,
            sales_team_size=2,
            avg_project_value=50_000,
            max_project_value=1_000_000,
            markets=["Spain", "Portugal", "France"]
        )
        
        self.sales_reps = ["Carlos Méndez", "Laura Gutiérrez"]
        self.products = [
            "CNC Machine X2000", "Industrial Robot ARM-7", "Injection Press IP-500",
            "Quality Control System QCS-4", "Conveyor Belt CB-100", "Packaging Line PL-3",
            "3D Scanner SCAN-1", "Laser Cutter LC-5", "Maintenance Package PREM-24",
            "Software License PRO-1", "Training Program BAS-8", "Spare Parts Kit SP-200"
        ]
        
        self.regions = ["North", "South", "East", "West", "Central"]
        self.customer_types = ["new", "existing", "growth", "strategic"]
        self.statuses = ["open", "negotiation", "closed-won", "closed-lost", "postponed"]
        
    def generate_annual_data(self, year: int) -> List[Dict]:
        """Genera datos anuales con tendencia realista"""
        
        # Tendencia de crecimiento: +15% anual
        growth_rate = 1.15 ** (year - 2020)
        base_revenue = 1_200_000 * growth_rate
        
        # Variación estacional
        seasonal_factors = [0.8, 0.9, 1.0, 1.1, 1.2, 1.0, 0.9, 0.8, 1.0, 1.1, 1.2, 1.3]
        
        monthly_data = []
        for month in range(1, 13):
            seasonal = seasonal_factors[month - 1]
            month_revenue = base_revenue / 12 * seasonal * random.uniform(0.9, 1.1)
            
            margin_pct = random.uniform(18, 32)
            
            monthly_data.append({
                "year": year,
                "month": month,
                "quarter": (month - 1) // 3 + 1,
                "revenue": round(month_revenue, 2),
                "margin": round(month_revenue * margin_pct / 100, 2),
                "margin_pct": round(margin_pct, 1),
                "leads": random.randint(8, 25),
                "opportunities": random.randint(5, 18),
                "won_deals": random.randint(3, 12)
            })
        
        return monthly_data
    
    def generate_opportunities(self, years: int = 5) -> List[Dict]:
        """Genera pipeline de oportunidades"""
        
        opportunities = []
        start_date = datetime(2021, 1, 1)
        end_date = datetime.now()
        
        for i in range(200):  # 200 oportunidades en 5 años
            created_date = start_date + timedelta(days=random.randint(0, (end_date - start_date).days))
            
            value = random.uniform(10_000, self.company.max_project_value)
            probability = random.uniform(10, 95)
            
            # Determinar estado basado en antigüedad
            days_old = (datetime.now() - created_date).days
            if days_old > 180 and probability < 50:
                status = "closed-lost"
            elif days_old > 90 and probability > 70:
                status = "closed-won"
            elif days_old > 60:
                status = random.choice(["negotiation", "open"])
            else:
                status = "open"
            
            opportunities.append({
                "id": f"OPP-ING-{2021 + i:04d}",
                "company": self.company.name,
                "sales_rep": random.choice(self.sales_reps),
                "created_date": created_date.isoformat(),
                "expected_close": (created_date + timedelta(days=random.randint(30, 180))).isoformat(),
                "value": round(value, 2),
                "probability": round(probability, 1),
                "status": status,
                "product": random.choice(self.products),
                "region": random.choice(self.regions),
                "customer_type": random.choice(self.customer_types)
            })
        
        return opportunities
    
    def generate_customers(self) -> List[Dict]:
        """Genera base de clientes"""
        
        customer_names = [
            "Metalurgias del Norte SA", "Tecnologías Integradas SL", "Automoción del Sur SL",
            "Plásticos Industriales SL", "Componentes Metálicos SA", "Maquinaria Avanzada SL",
            "Sistemas de Montaje SA", "Industrias Químicas SL", "Energías Renovables SA",
            "Logística Industrial SL"
        ]
        
        customers = []
        for i, name in enumerate(customer_names):
            first_purchase = datetime(2021 + random.randint(0, 3), random.randint(1, 12), random.randint(1, 28))
            
            customers.append({
                "id": f"CUST-ING-{i+1:04d}",
                "name": name,
                "industry": random.choice(["automotive", "metalworking", "plastics", "logistics"]),
                "first_purchase": first_purchase.isoformat(),
                "total_purchases": random.randint(1, 15),
                "total_value": round(random.uniform(10_000, 800_000), 2),
                "kam": random.choice(self.sales_reps),
                "status": random.choice(["active", "strategic", "at_risk"]),
                "region": random.choice(self.regions)
            })
        
        return customers
    
    def generate_offers(self) -> List[Dict]:
        """Genera ofertas históricas y activas"""
        
        offers = []
        for i in range(150):
            offer_date = datetime(2021, 1, 1) + timedelta(days=random.randint(0, (datetime.now() - datetime(2021, 1, 1)).days))
            
            value = random.uniform(5_000, self.company.max_project_value)
            margin = random.uniform(10, 35)
            
            offers.append({
                "offer_number": f"OF-ING-{2021 + i:04d}",
                "customer": random.choice(["Metalurgias del Norte SA", "Tecnologías Integradas SL", "Automoción del Sur SL"]),
                "date": offer_date.isoformat(),
                "value": round(value, 2),
                "margin_pct": round(margin, 1),
                "status": random.choice(["sent", "accepted", "rejected", "expired"]),
                "sales_rep": random.choice(self.sales_reps),
                "product": random.choice(self.products)
            })
        
        return offers
    
    def generate_complete_dataset(self) -> Dict:
        """Genera dataset completo para INGETRADE_TRIAL"""
        
        print("\n📊 GENERANDO DATOS PARA INGETRADE_TRIAL")
        print(f"   Empresa: {self.company.name}")
        print(f"   Facturación anual: {self.company.annual_revenue:,.0f}€")
        print(f"   Comerciales: {self.company.sales_team_size}")
        
        # Generar datos por año
        all_monthly = []
        for year in range(2021, datetime.now().year + 1):
            year_data = self.generate_annual_data(year)
            all_monthly.extend(year_data)
        
        opportunities = self.generate_opportunities()
        customers = self.generate_customers()
        offers = self.generate_offers()
        
        # Calcular KPIs
        total_revenue = sum(m["revenue"] for m in all_monthly)
        total_margin = sum(m["margin"] for m in all_monthly)
        avg_margin = total_margin / total_revenue * 100 if total_revenue > 0 else 0
        win_rate = len([o for o in opportunities if o["status"] == "closed-won"]) / len(opportunities) * 100 if opportunities else 0
        
        dataset = {
            "company": {
                "name": self.company.name,
                "industry": self.company.industry,
                "founded_year": self.company.founded_year,
                "annual_revenue": self.company.annual_revenue,
                "employees": self.company.employees,
                "sales_team": self.sales_reps,
                "avg_project_value": self.company.avg_project_value,
                "markets": self.company.markets
            },
            "kpis": {
                "total_revenue_5_years": total_revenue,
                "total_margin_5_years": total_margin,
                "average_margin_pct": avg_margin,
                "win_rate_pct": win_rate,
                "active_opportunities": len([o for o in opportunities if o["status"] in ["open", "negotiation"]]),
                "total_customers": len(customers)
            },
            "monthly_sales": all_monthly,
            "opportunities": opportunities,
            "customers": customers,
            "offers": offers,
            "generated_at": datetime.now().isoformat()
        }
        
        return dataset

def main():
    generator = DataGeneratorINGETRADE()
    dataset = generator.generate_complete_dataset()
    
    # Guardar dataset
    output_path = r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\data\ingetrade_trial_data.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Dataset guardado: {output_path}")
    print(f"\n📈 KPIs INGETRADE_TRIAL:")
    print(f"   Ingresos totales (5 años): {dataset['kpis']['total_revenue_5_years']:,.0f}€")
    print(f"   Margen promedio: {dataset['kpis']['average_margin_pct']:.1f}%")
    print(f"   Win rate: {dataset['kpis']['win_rate_pct']:.1f}%")
    print(f"   Clientes activos: {dataset['kpis']['total_customers']}")
    
    return dataset

if __name__ == "__main__":
    main()
