export interface CVProfile {
  name: string;
  targetRoles: string[];
  location: string;
  experienceYears: number;
  skills: string[];
  technologies: string[];
  languages: string[];
  seniority: string;
}

export interface CVAnalysisResult {
  profile: CVProfile;
  rawText: string;
  analyzedAt: string;
}
