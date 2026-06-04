import type { CVProfile } from "@/types/cv";

const TECH_KEYWORDS = [
  // Languages
  "Python","JavaScript","TypeScript","Java","C++","C#","Go","Rust","PHP","Ruby","Swift","Kotlin","Scala","MATLAB","Bash","Shell","PowerShell","SQL","PL/SQL","T-SQL",
  // Frontend
  "React","Next.js","Vue","Angular","Svelte","HTML","CSS","SASS","SCSS","Tailwind","Bootstrap","jQuery","Redux","Webpack","Vite",
  // Backend
  "Node.js","NestJS","Express","Django","FastAPI","Flask","Spring","Laravel","ASP.NET",".NET","GraphQL","REST","gRPC",
  // Databases
  "PostgreSQL","MySQL","MongoDB","Redis","SQLite","Oracle","SQL Server","DynamoDB","Firestore","Elasticsearch","MariaDB",
  // Cloud / DevOps
  "AWS","Azure","GCP","Google Cloud","Docker","Kubernetes","Terraform","Ansible","Jenkins","GitHub Actions","GitLab CI","Linux","Nginx","Apache",
  // Data / AI
  "Machine Learning","Deep Learning","TensorFlow","PyTorch","Scikit-learn","Pandas","NumPy","Power BI","Tableau","Spark","Hadoop","Airflow",
  // Tools
  "Git","GitHub","GitLab","Jira","Confluence","Figma","Postman","Swagger",
  // Soft skills (ES)
  "Liderazgo","Comunicación","Trabajo en equipo","Gestión de proyectos","Resolución de problemas","Planificación",
  // Soft skills (EN)
  "Leadership","Communication","Teamwork","Project Management","Problem solving","Agile","Scrum","Kanban",
  // Networks / IT Support
  "TCP/IP","DHCP","DNS","VPN","Active Directory","Windows Server","VMware","Cisco","Soporte técnico","Helpdesk","ITIL","ServiceDesk",
];

const SOFT_KWS = new Set([
  "Liderazgo","Comunicación","Trabajo en equipo","Gestión de proyectos","Resolución de problemas","Planificación",
  "Leadership","Communication","Teamwork","Project Management","Problem solving","Agile","Scrum","Kanban","ITIL","ServiceDesk","Soporte técnico","Helpdesk",
]);

const SENIORITY_PATTERNS: [RegExp, string][] = [
  [/semi\s*senior|ssr\.?\b/i, "Semi Senior"],
  [/senior|sr\.?\b/i, "Senior"],
  [/junior|jr\.?\b/i, "Junior"],
  [/lead|tech\s*lead/i, "Tech Lead"],
  [/manager|gerente/i, "Manager"],
  [/intern|pasante|practicante/i, "Intern"],
];

const CITY_NAMES = [
  "Bogotá","Bogota","Medellín","Medellin","Cali","Barranquilla","Cartagena","Bucaramanga",
  "Pereira","Manizales","Ibagué","Cucuta","Santa Marta","Villavicencio","Pasto","Montería",
  "Remoto","Colombia",
  "Lima","Santiago","Buenos Aires","Ciudad de México","CDMX","Guadalajara","Monterrey","Quito","Caracas",
];

// Headers that mark the start of the work experience section
const EXPERIENCE_HEADERS = /\b(experiencia\s*(laboral|profesional|de\s*trabajo)?|work\s*experience|employment|historial\s*laboral)\b/i;
// Headers that mark the start of education (so we stop counting years)
const EDUCATION_HEADERS = /\b(educaci[oó]n|formaci[oó]n\s*(acad[eé]mica)?|estudios|academic|education|university|universidad|instituto|colegio|grado|t[ií]tulo)\b/i;

export interface NoAIParseResult {
  profile: CVProfile;
  terms: string[];
}

function extractName(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12);
  for (const line of lines) {
    // 2-4 capitalized words, no digits, reasonable length
    if (
      line.length > 4 &&
      line.length < 55 &&
      !/\d/.test(line) &&
      /^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(\s[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){1,3}$/.test(line)
    ) {
      return line;
    }
  }
  return "";
}

function extractLocation(text: string): string {
  for (const city of CITY_NAMES) {
    const re = new RegExp(`\\b${city}\\b`, "i");
    if (re.test(text)) return city;
  }
  return "";
}

function extractExperienceYears(text: string): number {
  // 1. Explicit statement: "5 años de experiencia"
  const explicit = text.match(/(\d+)\s*(?:años?|years?)\s*(?:de\s+)?(?:experiencia|experience)/i);
  if (explicit) return Math.min(parseInt(explicit[1], 10), 40);

  // 2. Look only inside the work experience section (between experience header and education header)
  const lines = text.split("\n");
  let inExperience = false;
  const expLines: string[] = [];

  for (const line of lines) {
    if (!inExperience && EXPERIENCE_HEADERS.test(line)) {
      inExperience = true;
      continue;
    }
    if (inExperience) {
      if (EDUCATION_HEADERS.test(line)) break; // stop at education
      expLines.push(line);
    }
  }

  if (expLines.length > 0) {
    const expText = expLines.join(" ");
    const years = [...expText.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map((m) => parseInt(m[1], 10));
    if (years.length >= 2) {
      const min = Math.min(...years);
      const max = Math.max(...years);
      const diff = max - min;
      if (diff >= 1 && diff <= 35) return diff;
    }
  }

  // 3. No reliable data found — return 0 (better than a wrong number)
  return 0;
}

function extractSeniority(text: string): string {
  for (const [re, label] of SENIORITY_PATTERNS) {
    if (re.test(text)) return label;
  }
  return "";
}

function extractMatchedKeywords(text: string): string[] {
  return TECH_KEYWORDS.filter((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

function extractTargetRoles(text: string): string[] {
  const rolePatterns = [
    /desarrollador[a]?\s+(?:de\s+)?(?:software|web|m[oó]vil|backend|frontend|fullstack|full[- ]?stack)/gi,
    /(?:software|web|mobile|backend|frontend|fullstack|full[- ]?stack)\s+developer/gi,
    /ingenier[oa]\s+de?\s+(?:software|sistemas|datos|infraestructura|redes|soporte)/gi,
    /(?:data|ML|machine\s*learning|AI|IA)\s+(?:engineer|scientist|analyst|engineer)/gi,
    /(?:devops|cloud|security|cybersecurity|QA)\s+engineer/gi,
    /(?:analista|analyst)\s+(?:de\s+)?(?:datos?|sistemas?|soporte|TI|IT|infraestructura|programaci[oó]n)/gi,
    /(?:t[eé]cnico|technician)\s+(?:de\s+)?(?:soporte|redes|sistemas|TI|IT|electr[oó]nica)/gi,
    /(?:administrador|administrator)\s+(?:de\s+)?(?:sistemas?|redes?|base\s+de\s+datos?|servidores?)/gi,
    /(?:scrum\s+master|product\s+owner|project\s+manager|tech\s+lead|arquitecto\s+de\s+software)/gi,
    /especialista\s+(?:en\s+)?(?:soporte|TI|IT|redes|sistemas|infraestructura|seguridad)/gi,
    /coordinador[a]?\s+(?:de\s+)?(?:TI|IT|sistemas|infraestructura|tecnolog[ií]a)/gi,
  ];

  const found = new Set<string>();
  for (const pattern of rolePatterns) {
    const matches = text.match(pattern) ?? [];
    for (const m of matches) {
      const clean = m.trim().replace(/\s+/g, " ");
      if (clean.length >= 5 && clean.length < 60) found.add(clean);
    }
  }
  return [...found].slice(0, 5);
}

// Extract the professional objective/summary section for extra role hints
function extractObjectiveText(text: string): string {
  const lines = text.split("\n");
  let inObjective = false;
  const objectiveLines: string[] = [];
  const objectiveHeader = /\b(objetivo|perfil\s*(profesional)?|resumen|summary|profile|about\s*me|sobre\s*m[ií])\b/i;

  for (const line of lines) {
    if (!inObjective && objectiveHeader.test(line)) {
      inObjective = true;
      continue;
    }
    if (inObjective) {
      // Stop at next section header (all-caps line or known header)
      if (line.length > 2 && /^[A-ZÁÉÍÓÚÑÜ\s]{4,}$/.test(line) && EXPERIENCE_HEADERS.test(line)) break;
      if (line.length > 2 && objectiveLines.length > 10) break;
      objectiveLines.push(line);
    }
  }
  return objectiveLines.join(" ");
}

function generateTerms(profile: CVProfile, allKeywords: string[], location: string): string[] {
  const terms = new Set<string>();

  // Priority 1: detected roles (most accurate)
  for (const role of profile.targetRoles.slice(0, 4)) {
    terms.add(role);
    if (location) terms.add(`${role} ${location}`);
  }

  // Priority 2: if roles detected + key tech, combine them
  if (profile.targetRoles.length > 0 && allKeywords.length > 0) {
    const topTech = allKeywords.filter((k) => !SOFT_KWS.has(k)).slice(0, 3);
    for (const tech of topTech) {
      const base = profile.targetRoles[0];
      terms.add(`${base} ${tech}`);
    }
  }

  // Priority 3: if NO role detected, use tech + context terms (NOT bare keywords)
  if (profile.targetRoles.length === 0) {
    const techOnly = allKeywords.filter((k) => !SOFT_KWS.has(k)).slice(0, 4);
    // Combine pairs of tech keywords into meaningful search terms
    if (techOnly.length >= 2) {
      terms.add(`${techOnly[0]} ${techOnly[1]}`);
      if (location) terms.add(`${techOnly[0]} ${techOnly[1]} ${location}`);
    }
    if (techOnly.length >= 1 && location) {
      terms.add(`${techOnly[0]} ${location}`);
    }
  }

  // Last resort: if still nothing, add generic but useful terms
  if (terms.size === 0) {
    const generic = ["Soporte TI", "Técnico de sistemas", "Analista de sistemas", "Helpdesk"];
    for (const g of generic) {
      terms.add(location ? `${g} ${location}` : g);
    }
  }

  return [...terms].filter((t) => t.trim().length > 3).slice(0, 10);
}

export function parseCvNoAI(text: string): NoAIParseResult {
  const name = extractName(text);
  const location = extractLocation(text);
  const experienceYears = extractExperienceYears(text);
  const seniority = extractSeniority(text);
  const keywords = extractMatchedKeywords(text);

  // Also search the objective section for roles
  const objectiveText = extractObjectiveText(text);
  const targetRolesFromBody = extractTargetRoles(text);
  const targetRolesFromObjective = extractTargetRoles(objectiveText);
  const targetRoles = [
    ...new Set([...targetRolesFromObjective, ...targetRolesFromBody]),
  ].slice(0, 5);

  const technologies = keywords.filter((k) => !SOFT_KWS.has(k));
  const skills = keywords.filter((k) => SOFT_KWS.has(k));

  const profile: CVProfile = {
    name,
    targetRoles,
    location,
    experienceYears,
    skills,
    technologies,
    languages: [],
    seniority,
  };

  const terms = generateTerms(profile, keywords, location);

  return { profile, terms };
}
