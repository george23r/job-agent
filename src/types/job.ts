export type JobSource = "linkedin" | "computrabajo" | "indeed" | "magneto";

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  modality?: string;
  url: string;
  postedAt?: string;
  source: JobSource;
}

export interface JobMatch extends JobPosting {
  matchScore?: number;
  matchReason?: string;
}
