// Exporting AvocadoTracking type
export type { AvocadoTracking } from './types/avocado-tracking';

// Reception Day interface
export interface ReceptionDay {
  id: string;
  date: string;
  category: 'conventionnel' | 'biologique';
  totalLots: number;
  totalWeight: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

// Farm, Lot, and StatsData interfaces
export interface Farm {
  id: string;
  name: string;
  location: string;
  farmerId: string;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
}

export interface Lot {
  id: string;
  name: string;
  description: string;
  lotNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StatsData {
  total: number;
  completed: number;
  pending: number;
  totalLots?: number;
  activeFarms?: number;
}

// Mock data for testing
export const mockFarms: Farm[] = [
  { id: "farm1", name: "Farm A", location: "Location A", farmerId: "farmer1" },
  { id: "farm2", name: "Farm B", location: "Location B", farmerId: "farmer2" },
];

export const mockLots: Lot[] = [
  { id: "lot1", name: "Lot 1", description: "Description for Lot 1" },
  { id: "lot2", name: "Lot 2", description: "Description for Lot 2" },
];
