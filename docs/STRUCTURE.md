# Estructura del Proyecto

Este proyecto está organizado en dos carpetas principales dentro de `src/`:

## 📁 Estructura de Directorios

```
src/
├── frontend/          # Código del frontend (UI, componentes, páginas)
│   ├── components/   # Componentes de React
│   │   ├── dashboard/
│   │   ├── layout/
│   │   └── ui/       # Componentes UI reutilizables (shadcn/ui)
│   ├── pages/        # Páginas de la aplicación
│   ├── hooks/        # Custom hooks de React
│   ├── lib/          # Utilidades del frontend
│   │   └── utils.ts  # Funciones utilitarias (cn, etc.)
│   ├── App.tsx       # Componente principal de la app
│   ├── main.tsx      # Punto de entrada de la aplicación
│   ├── index.css     # Estilos globales
│   └── App.css       # Estilos del componente App
│
└── backend/          # Código del backend (API, lógica de negocio)
    ├── lib/
    │   ├── api/      # Servicios API (documentos, usuarios, chat, etc.)
    │   │   ├── chat.ts
    │   │   ├── departments.ts
    │   │   ├── documents.ts
    │   │   └── users.ts
    │   ├── supabase.ts           # Cliente de Supabase
    │   └── checkSupabaseConfig.ts # Verificación de configuración
    └── database.sql  # Esquema de base de datos
```

## 🎯 Separación Frontend/Backend

### Frontend (`src/frontend/`)
Contiene todo lo relacionado con la interfaz de usuario:
- **Componentes React**: Componentes visuales y de UI
- **Páginas**: Páginas/rutas de la aplicación
- **Hooks**: Custom hooks de React
- **Estilos**: Archivos CSS
- **Utilidades del frontend**: Funciones helper para UI (como `cn` para clases de Tailwind)

### Backend (`src/backend/`)
Contiene toda la lógica de negocio y comunicación con servicios externos:
- **API Services**: Funciones que interactúan con Supabase y APIs externas
- **Configuración**: Cliente de Supabase y verificaciones
- **Base de datos**: Esquemas y scripts SQL

## 📦 Imports y Alias

### Alias configurados en `vite.config.ts` y `tsconfig.json`:

- `@/*` → `src/frontend/*`
  - Usado para imports del frontend
  - Ejemplo: `import { Button } from "@/components/ui/button"`

- `@backend/*` → `src/backend/*`
  - Usado para imports del backend
  - Ejemplo: `import { getDocuments } from "@backend/lib/api/documents"`

### Ejemplos de uso:

**En componentes del frontend:**
```typescript
// Importar componentes UI
import { Button } from "@/components/ui/button"

// Importar servicios del backend
import { getDocuments } from "@backend/lib/api/documents"
```

**En servicios del backend:**
```typescript
// Importar cliente de Supabase (ruta relativa)
import { supabase } from '../supabase'

// Importar tipos de otros servicios
import type { Department } from './documents'
```

## 🔄 Flujo de Datos

```
Frontend (UI) 
    ↓ (llama a)
Backend (API Services)
    ↓ (usa)
Supabase Client
    ↓ (comunica con)
Supabase (Base de datos)
```

## 📝 Notas Importantes

1. **No mezclar responsabilidades**: 
   - El frontend NO debe importar directamente `supabase.ts`
   - El frontend debe usar los servicios del backend (`@backend/lib/api/*`)

2. **Utils compartido**:
   - `utils.ts` está en `frontend/lib/` porque es usado principalmente por componentes UI
   - Si necesitas utilidades compartidas, considera crear un archivo separado

3. **Base de datos**:
   - `database.sql` está en `backend/` como referencia del esquema
   - No se ejecuta directamente, es solo documentación

## 🚀 Desarrollo

Para trabajar en el proyecto:

- **Frontend**: Edita archivos en `src/frontend/`
- **Backend**: Edita archivos en `src/backend/lib/api/`
- **Configuración**: Actualiza `src/backend/lib/supabase.ts` para cambios en la conexión

