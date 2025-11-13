import { ReactNode } from 'react';

export interface HeaderData {
  title: string;
  category?: 'convo' | 'bio';
  smq?: string;
  dateReport?: string;
  version?: string;
  chau?: string;
  matricule?: string;
  dateMatricule?: string;
  responsable?: string;
  compagne1?: string;
  compagne2?: string;
  bonLivraison?: string;
  produit?: string;
  bonReception?: string;
  compagne: string;
}

export interface ReceptionRow {
  id: number;
  date: string;
  nrCaisse: string;
  tarePalette: string;
  poidsBrut: string;
  poidsNetUsine: string;
  dechet: string;
  feurte: string;
  poidsNetTicket: string;
  poidsNet: string;
  variete: string;
  numeroLotInterne: string;
  decision: string;
  matricule: string;
  chauffeur: string;
}

export interface Totals {
  totalPalettes: number;
  totalCaisses: number;
  totalPoids: number;
  poidsUsine: number;
  poidsTicket: number;
  ecart: number;
}

export interface ReceptionFormData {
  type: string;
  totals: Totals;
  savedAt: string;
  id: number;
  date: string;
  version: string;
  chau: string;
  matricule: string;
  dateMatricule: string;
  responsable: string;
  compagne1: string;
  compagne2: string;
  bonLivraison: string;
  produit: string;
  bonReception: string;
  header: HeaderData;
  rows: ReceptionRow[];
}

export interface FormEvent {
  target: {
    value: string;
  };
}

export interface ReceptionFormProps {
  onSave?: (data: ReceptionFormData) => void;
  onArchive?: (data: ReceptionFormData) => void;
  children?: ReactNode;
}

export interface FormEvent {
  target: {
    value: string;
  };
}