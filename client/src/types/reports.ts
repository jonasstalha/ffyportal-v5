export interface ProductivityMetrics {
  outputPerHour: number;
  wastePerHour: number;
}

export interface AnalyticsData {
  efficiency: string;
  wasteRate: string;
  qualityScore: number;
  productivityMetrics: ProductivityMetrics;
}

export interface DailyStats {
  shift: 'matin' | 'apres-midi' | 'nuit';
  efficiency: number;
  wastage: number;
  productivity: number;
}

export interface DashboardMetrics {
  shiftPerformance: DailyStats;
}

export interface ReportData {
  id: string;
  date: string;
  employee: string;
  shift: 'matin' | 'apres-midi' | 'nuit';
  entrants: number;
  emballes: number;
  dechets: number;
  pertes: number;
  resteAuj: number;
  retour: number;
  consommation: number;
  dechetMachine: number;
  dechetPetit: number;
  tauxDechets: number;
  tauxPertes: number;
  efficiency: number;
  qualityGrade: 'A' | 'B' | 'C';
  timestamp: any;
  userId: string;
  resto?: number;
  processedHours?: number;
  temperature?: number;
  humidity?: number;
  unfound?: number;
  workerAllocations?: number;
  numberOfBeneficiaries?: number;
  notes?: string;
  year?: number;
  month?: number;
  week?: number;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  analyticsData?: AnalyticsData;
  dashboardMetrics?: DashboardMetrics;
}