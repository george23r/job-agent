# Job Agent

Plataforma de búsqueda de empleo potenciada con IA, diseñada para el mercado colombiano. Busca en LinkedIn, Indeed, Computrabajo y Magneto simultáneamente, compara los resultados con tu perfil de CV y te permite exportar todo a **Excel** o **PDF** con un solo clic.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-1.52-green?logo=playwright)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-orange?logo=openai)

---

## Funcionalidades

- **Con IA** — Sube tu CV y GPT-4o-mini analiza tu perfil, extrae términos de búsqueda y le asigna un puntaje a cada oferta laboral según tus habilidades (0–100%).
- **Sin IA** — Sube tu CV y el sistema extrae tu cargo y ciudad mediante expresiones regulares — sin necesidad de clave API. La búsqueda inicia automáticamente.
- **4 fuentes en paralelo** — LinkedIn, Indeed (con bypass de Cloudflare), Computrabajo y Magneto.
- **Filtros inteligentes** — Filtra por fuente, modalidad (remoto / híbrido / presencial) y ciudad.
- **Exportar a Excel** — Dos hojas: listado completo de ofertas con anchos de columna + estadísticas resumidas.
- **Exportar a PDF** — PDF con diseño propio, insignias de puntaje de compatibilidad, colores por fuente y paginación.
- **Historial de búsquedas** — Últimas 5 búsquedas en modo Sin IA guardadas en localStorage.
- **Búsqueda automática** — Espera 3 segundos tras escribir en modo Sin IA; también se activa automáticamente al subir el CV.
- **Búsquedas programadas** — Un scheduler en segundo plano ejecuta búsquedas cada N horas (configurable).

---

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Animaciones | Framer Motion |
| Scraping | Playwright (contexto Chrome persistente) |
| IA | OpenAI GPT-4o-mini vía SDK oficial |
| Exportar a Excel | SheetJS (xlsx) |
| Exportar a PDF | PDFKit |
| Parseo de CV | pdf-parse + mammoth (DOCX) |
| Logs | Pino |

---

## Cómo empezar

### Requisitos previos

- Node.js 18+
- Google Chrome instalado (Chrome del sistema, no Chromium)
- Clave de API de OpenAI (solo requerida para el modo **Con IA**)

### 1. Clonar e instalar

```bash
git clone https://github.com/george23r/job-agent.git
cd job-agent
npm install
```

### 2. Configurar el entorno

Crea un archivo `.env.local` con las siguientes variables:

```env
# Requerido para el modo Con IA
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Ruta al perfil de Chrome con sesiones activas en los sitios de empleo
CHROME_USER_DATA_DIR=C:\Users\TuNombre\AppData\Local\Google\Chrome\User Data

# Ruta al ejecutable de Chrome (evita la detección de bots de Cloudflare)
CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Scheduler (opcional)
ENABLE_SCHEDULER=true
SEARCH_INTERVAL_HOURS=6
LOG_LEVEL=info
```

### 3. Iniciar sesión en los sitios de empleo

Abre Chrome con el perfil configurado en `CHROME_USER_DATA_DIR` e inicia sesión en:

- [linkedin.com](https://www.linkedin.com)
- [co.indeed.com](https://co.indeed.com)
- [computrabajo.com.co](https://www.computrabajo.com.co)
- [magneto365.com](https://magneto365.com)

> Cierra Chrome antes de iniciar la app — Playwright necesita acceso exclusivo al perfil.

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Uso

### Con IA

1. Cambia a **Con IA** en la barra superior.
2. Sube tu CV (PDF o DOCX, máximo 10 MB).
3. GPT-4o-mini extrae tu perfil y genera términos de búsqueda.
4. Haz clic en **Buscar vacantes** — los resultados aparecerán de las 4 fuentes.
5. Filtra por fuente, modalidad o ciudad.
6. Haz clic en **Excel** o **PDF** para exportar.

### Sin IA

1. Cambia a **Sin IA** en la barra superior.
2. Sube tu CV — el cargo y la ciudad se extraen automáticamente mediante expresiones regulares, sin necesidad de clave API.
3. La búsqueda inicia automáticamente dentro del primer segundo tras subir el archivo.
4. También puedes escribir el cargo manualmente — la búsqueda automática se activa tras 3 segundos.
5. Usa los chips de roles comunes para cargos frecuentes en IT colombiano.

### Exportar resultados

Una vez cargados los resultados, aparecen dos botones en la parte superior derecha:

| Botón | Resultado |
| --- | --- |
| **Excel** | `.xlsx` con dos hojas: listado completo + estadísticas |
| **PDF** | `.pdf` con insignias de puntaje, colores por fuente y número de página |

---

## Variables de entorno

| Variable | Descripción | Requerida |
| --- | --- | --- |
| `OPENAI_API_KEY` | Clave de API de OpenAI | Solo Con IA |
| `OPENAI_MODEL` | Modelo (por defecto: `gpt-4o-mini`) | No |
| `CHROME_USER_DATA_DIR` | Ruta al perfil de Chrome con sesiones activas | Sí |
| `CHROME_EXECUTABLE_PATH` | Ruta al ejecutable de Chrome | Recomendado |
| `ENABLE_SCHEDULER` | Scheduler automático (`true`/`false`) | No |
| `SEARCH_INTERVAL_HOURS` | Intervalo del scheduler en horas (por defecto: `6`) | No |
| `LOG_LEVEL` | Nivel de log: `trace`, `debug`, `info`, `warn`, `error` | No |

---

## Estructura del proyecto

```text
src/
├── app/
│   ├── api/
│   │   ├── cv/          # Endpoints de carga y parseo de CV
│   │   ├── jobs/
│   │   │   └── export/  # Exportar a Excel + PDF (GET ?format=xlsx|pdf)
│   │   └── search/      # Endpoint de orquestación de búsqueda
│   ├── layout.tsx
│   └── page.tsx         # UI principal
├── components/          # CVUploadZone, JobCard, NoAISearchForm, etc.
├── playwright/          # Scrapers: linkedin, indeed, computrabajo, magneto
├── services/            # cv.ts (Con IA), cv-noai.ts (regex), openai.ts
├── lib/                 # store, scheduler, logger, rate-limit
├── types/               # job.ts, cv.ts
└── utils/               # normalize, dedupe
```

---

## Notas sobre Cloudflare / Indeed

Indeed usa detección de bots de Cloudflare. El scraper lo evita mediante:

- **Chrome del sistema** (huella TLS real) en lugar del Chromium integrado de Playwright — configura `CHROME_EXECUTABLE_PATH`.
- Flag `--disable-blink-features=AutomationControlled` en Chrome.
- Patch de `navigator.webdriver` y lista de plugins falsos inyectados vía `addInitScript`.

---

## Licencia

MIT — ver [LICENSE](LICENSE).

---

*Construido con Next.js, Playwright y OpenAI. Diseñado para el mercado laboral colombiano.*
