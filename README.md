# ERP RRHH — Estancias Espíritu

Sistema de planillas y RRHH multiempresa (reemplazo de SIDPLAN). Fase 1: planilla mensual B1 + B2.

## Estructura
| Carpeta | Contenido |
| --- | --- |
| `supabase/migrations/` | Esquema PostgreSQL (32 tablas) |
| `supabase/seed.sql` | Carga inicial: 64 trabajadores activos, empresas, conceptos, centros de costo (generado) |
| `scripts/generar_seed.py` | Regenera `seed.sql` desde `datos/migracion-sidplan.xlsx` y `datos/catalogos.json` |
| `src/lib/motor/` | Motor de cálculo B1, B2, RC-IVA, aportes patronales (sin dependencias de BD) |
| `src/lib/motor/__tests__/` | Pruebas contra la planilla real de septiembre 2026 (118 casos) |

## Comandos
```bash
npm install
npm test               # motor de cálculo contra septiembre 2026
python3 scripts/generar_seed.py
npm run dev            # app en http://localhost:3000
```

## Puesta en marcha con Supabase
1. Crear proyecto en supabase.com (región São Paulo).
2. SQL Editor → ejecutar `supabase/migrations/*.sql` y luego `supabase/seed.sql`.
3. Copiar `.env.example` a `.env.local` con la URL y las claves del proyecto.
