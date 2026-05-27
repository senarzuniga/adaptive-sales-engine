"""
GENERACIÓN DE DATOS SIMULADOS - FLEXOSOL_TRIAL
Empresa de soluciones de embalaje flexible
Facturación anual: 5M€ | 1 comercial | Mailing + posicionamiento
"""

import json
import random
import numpy as np
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from dataclasses import dataclass, field

@dataclass
class CompanyProfile:
    name: str
    industry: str
    founded_year: int
    annual_revenue: float
    employees: int
    sales_team_size: int
    avg_project_value: float
    marketing_channels: List[str]
    markets: List[str]

class DataGeneratorFLEXOSOL:
    """Generador de datos simulados para FLEXOSOL_TRIAL"""
    
    def __init__(self):
        self.company = CompanyProfile(
            name="FLEXOSOL_TRIAL",
            industry="Flexible Packaging Solutions",
            founded_year=2018,
            annual_revenue=5_000_000,
            employees=25,
            sales_team_size=1,
            avg_project_value=35_000,
            marketing_channels=["email_marketing", "seo", "content_marketing", "linkedin"],
            markets=["Spain", "Italy", "Portugal", "France", "Germany"]
        )
        
        self.sales_rep = ["Elena Martínez"]
        self.products = [
            "Flexible Packaging Film FP-100", "Biodegradable Wrap BW-50", "High-Barrier Pouch HP-200",
            "Stand-up Pouch SP-75", "Spout Pouch SP-90", "Retort Pouch RP-150",
            "Laminated Roll LR-300", "Printed Film PF-80", "Vacuum Bag VB-60",
            "Shrink Film SF-40", "Stretch Wrap SW-200", "Specialty Laminate SL-500"
        ]
        
        self.industries = ["food", "beverage", "pharmaceutical", "cosmetics", "chemical"]
        self.lead_sources = ["email_campaign", "linkedin", "organic_search", "referral", "website"]
        
    def generate_marketing_metrics(self) -> List[Dict]:
        """Genera métricas de marketing y mailing"""
        
        metrics = []
        start_date = datetime(2023, 1, 1)
        
        for i in range(24):  # 24 meses
            month_date = start_date + timedelta(days=30 * i)
            
            # Tendencia de crecimiento de mailing
            email_growth = 1.05 ** (i / 12)
            emails_sent = int(1000 * email_growth * random.uniform(0.9, 1.1))
            open_rate = random.uniform(15, 35)
            click_rate = random.uniform(2, 8) * (1 + i / 48)
            
            metrics.append({
                "year": month_date.year,
                "month": month_date.month,
                "month_name": month_date.strftime("%B"),
                "emails_sent": emails_sent,
                "open_rate": round(open_rate, 1),
                "click_rate": round(click_rate, 1),
                "leads_from_email": int(emails_sent * click_rate / 100 * random.uniform(0.05, 0.15)),
                "linkedin_impressions": int(random.uniform(5000, 20000)),
                "website_visits": int(random.uniform(1000, 5000)),
                "organic_searches": int(random.uniform(500, 3000))
            })
        
        return metrics
    
    def generate_leads(self, count: int = 300) -> List[Dict]:
        """Genera leads con scoring"""
        
        leads = []
        start_date = datetime(2022, 1, 1)
        
        company_names = [
            "Envases del Mediterráneo", "Alimentos Naturales SA", "Bebidas del Sur SL",
            "Laboratorios Farma SL", "Cosméticos Esenciales SA", "Industrias Cárnicas SL",
            "Pescados del Atlántico SA", "Productos Lácteos SL", "Vinos y Bodegas SA",
            "Snacks Saludables SL", "Platos Preparados SA", "Alimentos Congelados SL"
        ]
        
        for i in range(count):
            created_date = start_date + timedelta(days=random.randint(0, (datetime.now() - start_date).days))
            
            # Lead scoring basado en comportamiento
            score = 0
            source = random.choice(self.lead_sources)
            
            if source == "email_campaign":
                score += random.randint(10, 40)
            elif source == "linkedin":
                score += random.randint(5, 30)
            elif source == "organic_search":
                score += random.randint(0, 20)
            
            # Lead se convierte en oportunidad si score > 50
            is_opportunity = score > 50 and random.random() < 0.6
            
            leads.append({
                "id": f"LEAD-FLX-{i+1:04d}",
                "company_name": random.choice(company_names),
                "created_date": created_date.isoformat(),
                "source": source,
                "score": score,
                "status": "converted" if is_opportunity else "contacted" if score > 20 else "new",
                "assigned_to": self.sales_rep[0] if score > 20 else None,
                "industry": random.choice(self.industries),
                "contact_name": f"Contacto {i+1}",
                "contact_email": f"contacto{i+1}@{random.choice(company_names).replace(' ', '').lower()}.es"
            })
        
        return leads
    
    def generate_conversion_funnel(self, leads: List[Dict]) -> Dict:
        """Genera embudo de conversión"""
        
        total_leads = len(leads)
        contacted = len([l for l in leads if l["status"] in ["contacted", "converted"]])
        opportunities = len([l for l in leads if l["status"] == "converted"])
        
        # Convertir oportunidades en ventas
        won_deals = int(opportunities * random.uniform(0.25, 0.45))
        
        return {
            "total_leads": total_leads,
            "contacted_leads": contacted,
            "opportunities_created": opportunities,
            "won_deals": won_deals,
            "conversion_rates": {
                "lead_to_contact": round(contacted / total_leads * 100, 1) if total_leads > 0 else 0,
                "contact_to_opportunity": round(opportunities / contacted * 100, 1) if contacted > 0 else 0,
                "opportunity_to_sale": round(won_deals / opportunities * 100, 1) if opportunities > 0 else 0,
                "overall_conversion": round(won_deals / total_leads * 100, 1) if total_leads > 0 else 0
            }
        }
    
    def generate_posicionamiento_data(self) -> Dict:
        """Genera datos de posicionamiento SEO"""
        
        keywords = [
            {"keyword": "flexible packaging solutions", "position": random.randint(1, 15), "volume": 1200},
            {"keyword": "biodegradable wrapping", "position": random.randint(2, 20), "volume": 800},
            {"keyword": "custom printed pouches", "position": random.randint(1, 10), "volume": 600},
            {"keyword": "stand up pouches", "position": random.randint(3, 25), "volume": 1500},
            {"keyword": "retort packaging", "position": random.randint(5, 30), "volume": 400}
        ]
        
        # Evolución de posiciones
        position_history = []
        for month in range(12):
            position_history.append({
                "month": month + 1,
                "average_position": max(1, 20 - month * 1.2 + random.uniform(-3, 3)),
                "keywords_in_top10": int(2 + month * 0.5 + random.uniform(-1, 2))
            })
        
        return {
            "keywords": keywords,
            "position_history": position_history,
            "domain_authority": random.randint(25, 45),
            "backlinks_count": random.randint(500, 2000),
            "organic_traffic": random.randint(2000, 8000)
        }
    
    def generate_complete_dataset(self) -> Dict:
        """Genera dataset completo para FLEXOSOL_TRIAL"""
        
        print("\n📊 GENERANDO DATOS PARA FLEXOSOL_TRIAL")
        print(f"   Empresa: {self.company.name}")
        print(f"   Facturación anual: {self.company.annual_revenue:,.0f}€")
        print(f"   Comerciales: {self.company.sales_team_size}")
        
        marketing_metrics = self.generate_marketing_metrics()
        leads = self.generate_leads(350)
        conversion_funnel = self.generate_conversion_funnel(leads)
        posicionamiento = self.generate_posicionamiento_data()
        
        # Calcular ingresos estimados
        estimated_revenue = self.company.annual_revenue * 4  # 4 años
        estimated_margin = 0.28 * estimated_revenue
        
        dataset = {
            "company": {
                "name": self.company.name,
                "industry": self.company.industry,
                "founded_year": self.company.founded_year,
                "annual_revenue": self.company.annual_revenue,
                "employees": self.company.employees,
                "sales_team": self.sales_rep,
                "avg_project_value": self.company.avg_project_value,
                "marketing_channels": self.company.marketing_channels,
                "markets": self.company.markets
            },
            "kpis": {
                "estimated_revenue_4_years": estimated_revenue,
                "estimated_margin_4_years": estimated_margin,
                "estimated_margin_pct": 28,
                "total_leads_generated": conversion_funnel["total_leads"],
                "conversion_rate": conversion_funnel["conversion_rates"]["overall_conversion"],
                "active_leads": len([l for l in leads if l["status"] == "new"])
            },
            "marketing_metrics": marketing_metrics,
            "leads": leads,
            "conversion_funnel": conversion_funnel,
            "seo_positioning": posicionamiento,
            "generated_at": datetime.now().isoformat()
        }
        
        return dataset

def main():
    generator = DataGeneratorFLEXOSOL()
    dataset = generator.generate_complete_dataset()
    
    # Guardar dataset
    output_path = r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\data\flexosol_trial_data.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Dataset guardado: {output_path}")
    print(f"\n📈 KPIs FLEXOSOL_TRIAL:")
    print(f"   Ingresos estimados (4 años): {dataset['kpis']['estimated_revenue_4_years']:,.0f}€")
    print(f"   Leads generados: {dataset['kpis']['total_leads_generated']}")
    print(f"   Tasa conversión: {dataset['kpis']['conversion_rate']:.1f}%")
    
    return dataset

if __name__ == "__main__":
    main()
