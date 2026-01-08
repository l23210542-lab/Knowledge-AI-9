# KnowledgeHub AI

Una plataforma de conocimiento interno que centraliza documentación empresarial y permite su consulta mediante un asistente de IA basado en RAG (Retrieval-Augmented Generation).

## 📋 Descripción

KnowledgeHub AI es una solución MVP diseñada para resolver el problema de documentación dispersa en las organizaciones. Permite a los usuarios subir documentos internos (PDF, TXT, Markdown) y consultarlos usando lenguaje natural, obteniendo respuestas precisas basadas exclusivamente en la documentación proporcionada.

### Características Principales

- 📄 **Gestión de Documentos**: Subida y organización de documentos por departamentos
- 🤖 **Chat con IA**: Consulta inteligente usando RAG (Retrieval-Augmented Generation)
- 🔍 **Búsqueda Semántica**: Búsqueda de información relevante usando embeddings vectoriales
- 📊 **Dashboard**: Visualización de estadísticas y documentos recientes
- 💾 **Persistencia de Sesión**: Historial de conversación durante la sesión del navegador
- 🔐 **Integración con Supabase**: Base de datos PostgreSQL con pgvector para búsqueda semántica

## 🛠️ Tecnologías Utilizadas

### Frontend
- **React 18** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **React Router** - Enrutamiento
- **Tailwind CSS** - Framework de estilos
- **shadcn/ui** - Componentes UI
- **Radix UI** - Componentes primitivos accesibles
- **Lucide React** - Iconos

### Backend & Servicios
- **Supabase** - Backend as a Service
  - PostgreSQL con extensión pgvector
  - Supabase Storage para archivos
  - Row Level Security (RLS)
- **OpenAI API** - IA y embeddings
  - `text-embedding-3-small` para embeddings
  - `gpt-3.5-turbo` para generación de respuestas
- **PDF.js** - Procesamiento de archivos PDF

### Herramientas de Desarrollo
- **ESLint** - Linter
- **TypeScript** - Compilador de tipos
- **PostCSS** - Procesamiento de CSS

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** >= 18.x ([instalar con nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **npm** >= 9.x (incluido con Node.js)
- **Cuenta de Supabase** ([crear cuenta](https://supabase.com))
- **API Key de OpenAI** ([obtener aquí](https://platform.openai.com/api-keys))

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <YOUR_GIT_URL>
cd blueprint-builder-main
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Supabase Configuration
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key

# OpenAI Configuration
VITE_OPENAI_API_KEY=sk-proj-tu_api_key_de_openai

# API URL (opcional, para desarrollo)
VITE_API_URL=http://localhost:3000
```

**Nota**: El archivo `.env` ya está incluido en `.gitignore` y no se subirá al repositorio.

### 4. Configurar Supabase

Sigue la guía completa en [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) para:

1. Crear las tablas en Supabase
2. Configurar Supabase Storage
3. Configurar políticas RLS
4. Habilitar la extensión pgvector

**Resumen rápido**:

```sql
-- Ejecutar en SQL Editor de Supabase
-- Ver docs/SUPABASE_SETUP.md para el script completo
```

### 5. Copiar el worker de PDF.js

El worker de PDF.js debe estar en la carpeta `public/`:

```bash
# Windows (PowerShell)
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" -Destination "public\pdf.worker.min.mjs" -Force

# Linux/Mac
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

## ▶️ Ejecución

### Modo Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:8080`

### Build de Producción

```bash
npm run build
```

Los archivos compilados se generarán en la carpeta `dist/`

### Preview del Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## 📁 Estructura del Proyecto

```
blueprint-builder-main/
├── public/                 # Archivos estáticos
│   ├── pdf.worker.min.mjs # Worker de PDF.js
│   └── ...
├── src/
│   ├── frontend/          # Código del frontend
│   │   ├── components/    # Componentes React
│   │   │   ├── dashboard/ # Componentes del dashboard
│   │   │   ├── layout/    # Layout y navegación
│   │   │   └── ui/        # Componentes UI (shadcn/ui)
│   │   ├── pages/         # Páginas de la aplicación
│   │   │   ├── Chat.tsx   # Página de chat con IA
│   │   │   ├── Documents.tsx # Listado de documentos
│   │   │   ├── Upload.tsx # Subida de documentos
│   │   │   └── ...
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilidades del frontend
│   │   ├── App.tsx        # Componente principal
│   │   └── main.tsx       # Punto de entrada
│   │
│   └── backend/           # Código del backend
│       ├── lib/
│       │   ├── api/       # Servicios API
│       │   │   ├── chat.ts              # Lógica de RAG y chat
│       │   │   ├── documents.ts         # Gestión de documentos
│       │   │   ├── documentProcessing.ts # Procesamiento de PDF/TXT/MD
│       │   │   ├── departments.ts       # Gestión de departamentos
│       │   │   └── users.ts             # Gestión de usuarios
│       │   ├── supabase.ts              # Cliente de Supabase
│       │   └── checkSupabaseConfig.ts   # Verificación de config
│       └── database.sql   # Esquema de base de datos
│
├── docs/                  # Documentación
│   ├── prd.md            # Product Requirement Document
│   ├── SUPABASE_SETUP.md # Guía de configuración de Supabase
│   ├── ENV_SETUP.md      # Configuración de variables de entorno
│   ├── OPENAI_SETUP.md   # Configuración de OpenAI
│   ├── STRUCTURE.md      # Estructura del proyecto
│   └── ...
│
├── .env                   # Variables de entorno (no versionado)
├── package.json          # Dependencias y scripts
├── tsconfig.json         # Configuración de TypeScript
├── vite.config.ts        # Configuración de Vite
└── tailwind.config.ts    # Configuración de Tailwind
```

## 🎯 Uso

### Subir Documentos

1. Navega a la página **"Subir"**
2. Selecciona uno o más archivos (PDF, TXT, MD)
3. Asigna un departamento a cada documento
4. Haz clic en **"Subir"**

**Formatos soportados**:
- PDF (`.pdf`)
- Texto plano (`.txt`)
- Markdown (`.md`)

**Límites**:
- Tamaño máximo: 10MB por archivo
- Los documentos se procesan automáticamente al hacer la primera consulta

### Consultar con IA

1. Navega a la página **"Chat"**
2. Escribe tu pregunta en lenguaje natural
3. El sistema buscará información relevante en los documentos subidos
4. Recibirás una respuesta basada en el contenido de los documentos

**Características del chat**:
- Historial de conversación durante la sesión
- Fuentes de información citadas
- Respuestas basadas exclusivamente en documentos subidos

### Ver Documentos

1. Navega a la página **"Documentos"**
2. Visualiza todos los documentos subidos
3. Filtra por departamento
4. Ver el estado de procesamiento de cada documento

## 🔧 Configuración Avanzada

### Variables de Entorno

Consulta [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md) para detalles sobre:
- Configuración de variables de entorno
- Troubleshooting de problemas comunes
- Validación de credenciales

### Supabase

Consulta [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) para:
- Configuración completa de Supabase
- Creación de tablas y políticas RLS
- Configuración de Storage
- Solución de problemas de RLS

### OpenAI

Consulta [`docs/OPENAI_SETUP.md`](./docs/OPENAI_SETUP.md) para:
- Obtención de API key
- Configuración en el proyecto
- Troubleshooting

## 📚 Documentación Adicional

- [`docs/prd.md`](./docs/prd.md) - Product Requirement Document completo
- [`docs/STRUCTURE.md`](./docs/STRUCTURE.md) - Estructura detallada del proyecto
- [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) - Guía de configuración de Supabase
- [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md) - Configuración de variables de entorno
- [`docs/OPENAI_SETUP.md`](./docs/OPENAI_SETUP.md) - Configuración de OpenAI
- [`docs/STORAGE_RLS_FIX.md`](./docs/STORAGE_RLS_FIX.md) - Solución de problemas de RLS en Storage

## 🐛 Solución de Problemas

### Error: "Supabase credentials not found"

- Verifica que el archivo `.env` existe en la raíz del proyecto
- Asegúrate de que las variables comienzan con `VITE_`
- Reinicia el servidor de desarrollo después de modificar `.env`

### Error: "StorageApiError: new row violates row-level security policy"

- Consulta [`docs/STORAGE_RLS_FIX.md`](./docs/STORAGE_RLS_FIX.md)
- Configura las políticas RLS para el bucket `documents` en Supabase

### Error: "OpenAI no está configurado"

- Verifica que `VITE_OPENAI_API_KEY` está en tu archivo `.env`
- Asegúrate de que la API key es válida y tiene créditos disponibles

### Los PDFs no se procesan

- Verifica que `public/pdf.worker.min.mjs` existe
- Revisa la consola del navegador para errores específicos
- Asegúrate de tener conexión a internet (el worker puede requerir recursos externos)

### La conversación se borra al cambiar de página

- Esto es normal: la conversación persiste durante la sesión pero se borra al recargar
- El historial se guarda en `sessionStorage` del navegador

## 🚢 Despliegue

### Build para Producción

```bash
npm run build
```

### Variables de Entorno en Producción

Asegúrate de configurar las mismas variables de entorno en tu plataforma de despliegue:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY`

### Plataformas Recomendadas

- **Vercel** - Despliegue automático desde Git
- **Netlify** - Similar a Vercel
- **Supabase Hosting** - Integración nativa con Supabase

## 📝 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Crea un build de producción |
| `npm run build:dev` | Crea un build en modo desarrollo |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | Ejecuta el linter |

## 🤝 Contribuir

Este es un proyecto MVP. Para contribuir:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y está bajo desarrollo.

## 👥 Autor

Desarrollado como parte de un proyecto de plataforma de conocimiento interno.

---

**Nota**: Este es un proyecto MVP. Algunas funcionalidades pueden estar en desarrollo activo.
