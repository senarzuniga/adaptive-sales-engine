"""
ANÁLISIS DETALLADO DE DIFERENCIAS ENTRE REPOSITORIOS
Identifica TODAS las discrepancias entre adaptive-sales-engine y ACS
"""

import os
import json
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Tuple

class RepoComparator:
    """Compara dos repositorios y encuentra todas las diferencias"""
    
    def __init__(self, target_path: str, reference_path: str):
        self.target_path = Path(target_path)
        self.reference_path = Path(reference_path)
        self.differences = {
            "missing_files": [],
            "missing_folders": [],
            "different_content": [],
            "only_in_target": [],
            "only_in_reference": []
        }
        
    def analyze(self) -> Dict:
        """Ejecuta análisis completo de diferencias"""
        
        print("\n🔍 ANALIZANDO DIFERENCIAS ENTRE REPOSITORIOS...")
        print(f"   Target: {self.target_path}")
        print(f"   Reference: {self.reference_path}")
        
        # Analizar estructura de directorios
        self._compare_structure()
        
        # Analizar archivos críticos
        self._compare_critical_files()
        
        # Analizar configuraciones
        self._compare_configurations()
        
        # Analizar paneles y vistas
        self._compare_panels()
        
        return self.differences
    
    def _compare_structure(self):
        """Compara estructura de directorios"""
        
        reference_dirs = set()
        target_dirs = set()
        
        if self.reference_path.exists():
            for item in self.reference_path.rglob("*"):
                if item.is_dir():
                    rel_path = item.relative_to(self.reference_path)
                    reference_dirs.add(str(rel_path))
        
        if self.target_path.exists():
            for item in self.target_path.rglob("*"):
                if item.is_dir():
                    rel_path = item.relative_to(self.target_path)
                    target_dirs.add(str(rel_path))
        
        missing_in_target = reference_dirs - target_dirs
        missing_in_reference = target_dirs - reference_dirs
        
        self.differences["missing_folders"] = list(missing_in_target)[:50]
        self.differences["only_in_target"] = list(missing_in_reference)[:50]
        
        print(f"\n   📁 Carpetas faltantes en target: {len(missing_in_target)}")
        print(f"   📁 Carpetas solo en target: {len(missing_in_reference)}")
    
    def _compare_critical_files(self):
        """Compara archivos críticos"""
        
        critical_patterns = [
            "**/dashboard/**/*.html",
            "**/panels/**/*.vue",
            "**/views/**/*.tsx",
            "**/components/**/*.tsx",
            "**/pages/**/*.tsx",
            "**/api/**/*.ts",
            "**/routes/**/*.ts",
            "**/src/**/*.tsx",
            "**/src/**/*.jsx"
        ]
        
        reference_files = set()
        target_files = set()
        
        for pattern in critical_patterns:
            if self.reference_path.exists():
                for file in self.reference_path.glob(pattern):
                    if file.is_file():
                        rel_path = file.relative_to(self.reference_path)
                        reference_files.add(str(rel_path))
            
            if self.target_path.exists():
                for file in self.target_path.glob(pattern):
                    if file.is_file():
                        rel_path = file.relative_to(self.target_path)
                        target_files.add(str(rel_path))
        
        missing = reference_files - target_files
        self.differences["missing_files"] = list(missing)[:100]
        
        print(f"\n   📄 Archivos faltantes en target: {len(missing)}")
        
        # Mostrar los más importantes
        important_missing = [f for f in missing if any(x in str(f).lower() for x in 
            ['panel', 'dashboard', 'menu', 'nav', 'layout', 'app', 'main'])]
        for f in important_missing[:20]:
            print(f"      - {f}")
    
    def _compare_configurations(self):
        """Compara archivos de configuración"""
        
        config_files = [
            "package.json", "vite.config.ts", "webpack.config.js",
            "tsconfig.json", ".env", ".env.example", "config.json"
        ]
        
        for config in config_files:
            ref_config = self.reference_path / config
            target_config = self.target_path / config
            
            if ref_config.exists() and not target_config.exists():
                self.differences["missing_files"].append(config)
                print(f"   ⚠️ Config faltante: {config}")
    
    def _compare_panels(self):
        """Compara paneles y menús disponibles"""
        
        panel_patterns = ["*panel*", "*menu*", "*nav*", "*sidebar*", "*layout*"]
        
        reference_panels = set()
        target_panels = set()
        
        for pattern in panel_patterns:
            if self.reference_path.exists():
                for file in self.reference_path.rglob(pattern):
                    if file.is_file() and any(file.suffix in ['.tsx', '.jsx', '.vue', '.html']):
                        reference_panels.add(file.stem)
            
            if self.target_path.exists():
                for file in self.target_path.rglob(pattern):
                    if file.is_file() and any(file.suffix in ['.tsx', '.jsx', '.vue', '.html']):
                        target_panels.add(file.stem)
        
        missing_panels = reference_panels - target_panels
        
        print(f"\n   🎨 Paneles faltantes en target: {len(missing_panels)}")
        for panel in list(missing_panels)[:20]:
            print(f"      - {panel}")
        
        self.differences["missing_panels"] = list(missing_panels)

def main():
    comparator = RepoComparator(
        target_path=r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine",
        reference_path=r"C:\Users\Inaki Senar\Documents\GitHub\ACS"
    )
    
    differences = comparator.analyze()
    
    # Guardar resultados
    report_path = r"C:\Users\Inaki Senar\Documents\GitHub\adaptive-sales-engine\difference_report.json"
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(differences, f, indent=2, default=str)
    
    print(f"\n📊 Reporte guardado: {report_path}")
    print(f"   Total diferencias encontradas: {sum(len(v) for v in differences.values())}")
    
    return differences

if __name__ == "__main__":
    main()
