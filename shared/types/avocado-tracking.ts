// This file contains the definition for the AvocadoTracking type.

export interface Harvest {
    harvestDate: string;
    farmLocation: string;
    farmerId: string;
    lotNumber: string;
    variety: string;
}

export interface Transport {
    lotNumber: string;
    transportCompany: string;
    driverName: string;
    vehicleId: string;
    departureDateTime: string;
    arrivalDateTime: string;
    temperature: number;
}

export interface Sorting {
    lotNumber: string; // Added missing property
    sortingDate: string; // Added missing property
    qualityGrade: string;
    rejectedCount: number;
    notes?: string;
}

export interface Packaging {
    lotNumber: string; // Added missing property
    packagingDate: string; // Added missing property
    boxId: string;
    workerIds: string[]; // Added missing property
    netWeight: number;
    avocadoCount: number;
    boxType: string;
}

export interface Delivery {
    boxId: string; // Added missing property
    estimatedDeliveryDate: string; // Added missing property
    clientName: string;
    clientLocation: string;
    actualDeliveryDate?: string;
    notes?: string;
}

export interface Storage {
    boxId: string;
    entryDate: string;
    storageTemperature: number;
    storageRoomId: string;
    exitDate?: string;
}

export interface Export {
    boxId: string;
    loadingDate: string;
    containerId: string;
    driverName: string;
    vehicleId: string;
    destination: string;
}

export interface AvocadoTracking {
    id: string;
    harvest: Harvest;
    transport: Transport;
    sorting: Sorting;
    packaging: Packaging;
    storage: Storage; // Added missing field
    export: Export;   // Added missing field
    delivery: Delivery;
}
