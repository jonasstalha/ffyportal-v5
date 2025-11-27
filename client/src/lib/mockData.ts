import { AvocadoTracking } from "@shared/types/avocado-tracking";
import { Farm, Lot, StatsData } from "@shared/schema";

// Mock data for avocado tracking
export let mockAvocadoTrackingData: AvocadoTracking[] = [
  {
    id: "tracking1",
    harvest: {
      harvestDate: new Date().toISOString(),
      farmLocation: "Location 1",
      farmerId: "farmer1",
      lotNumber: "L1",
      variety: "hass"
    },
    transport: {
      lotNumber: "L1",
      transportCompany: "Company 1",
      driverName: "Driver 1",
      vehicleId: "vehicle1",
      departureDateTime: new Date().toISOString(),
      arrivalDateTime: new Date().toISOString(),
      temperature: 4
    },
    sorting: {
      lotNumber: "L1",
      sortingDate: new Date().toISOString(),
      staffInvolved: ["staff1", "staff2"],
      qualityGrade: "A",
      rejectedCount: 0,
      notes: "Notes 1"
    },
    packaging: {
      lotNumber: "L1",
      packagingDate: new Date().toISOString(),
      boxId: "box1",
      workerIds: ["worker1", "worker2"],
      netWeight: 10,
      avocadoCount: 20,
      boxType: "case"
    },
    storage: {
      boxId: "box1",
      entryDate: new Date().toISOString(),
      storageTemperature: 4,
      storageRoomId: "room1",
      exitDate: new Date().toISOString()
    },
    export: {
      boxId: "box1",
      loadingDate: new Date().toISOString(),
      containerId: "container1",
      driverName: "Driver 1",
      vehicleId: "vehicle1",
      destination: "Destination 1"
    },
    delivery: {
      boxId: "box1",
      estimatedDeliveryDate: new Date().toISOString(),
      actualDeliveryDate: new Date().toISOString(),
      clientName: "Client 1",
      clientLocation: "Location 1",
      notes: "Notes 1"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "tracking2",
    harvest: {
      harvestDate: "2023-04-20T07:30:00",
      farmLocation: "Location 2",
      farmerId: "farmer2",
      lotNumber: "L2",
      variety: "hass"
    },
    transport: {
      lotNumber: "L2",
      transportCompany: "Company 2",
      driverName: "Driver 2",
      vehicleId: "vehicle2",
      departureDateTime: "2023-04-20T08:30:00",
      arrivalDateTime: "2023-04-20T10:30:00",
      temperature: 4
    },
    sorting: {
      lotNumber: "L2",
      sortingDate: "2023-04-20T11:30:00",
      staffInvolved: ["staff3", "staff4"],
      qualityGrade: "B",
      rejectedCount: 5,
      notes: "Notes 2"
    },
    packaging: {
      lotNumber: "L2",
      packagingDate: "2023-04-20T12:30:00",
      boxId: "box2",
      workerIds: ["worker3", "worker4"],
      netWeight: 15,
      avocadoCount: 30,
      boxType: "case"
    },
    storage: {
      boxId: "box2",
      entryDate: "2023-04-20T13:30:00",
      storageTemperature: 4,
      storageRoomId: "room2",
      exitDate: "2023-04-21T09:30:00"
    },
    export: {
      boxId: "box2",
      loadingDate: "2023-04-21T10:30:00",
      containerId: "container2",
      driverName: "Driver 2",
      vehicleId: "vehicle2",
      destination: "Destination 2"
    },
    delivery: {
      boxId: "box2",
      estimatedDeliveryDate: "2023-04-22T10:30:00",
      actualDeliveryDate: "2023-04-22T11:30:00",
      clientName: "Client 2",
      clientLocation: "Location 2",
      notes: "Notes 2"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Mock data for farms
export let mockFarms: Farm[] = [
  {
    id: "farm1",
    name: "Ferme Atlas",
    code: "FA-001",
    location: "Marrakech",
    active: true,
    description: "Ferme spécialisée dans les avocats",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "farm2",
    name: "Ferme Sahara",
    code: "FS-002",
    location: "Agadir",
    active: true,
    description: "Ferme spécialisée dans les oranges",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "farm3",
    name: "Ferme Oasis",
    code: "FO-003",
    location: "Tanger",
    active: false,
    description: "Ferme spécialisée dans les citrons",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Mock data for lots
export let mockLots: Lot[] = [
  {
    id: "lot1",
    lotNumber: "LOT-001",
    farmId: "farm1",
    harvestDate: new Date().toISOString(),
    initialQuantity: 1000,
    currentStatus: "shipped",
    notes: "Lot d'avocats de première qualité",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lot2",
    lotNumber: "LOT-002",
    farmId: "farm2",
    harvestDate: new Date().toISOString(),
    initialQuantity: 500,
    currentStatus: "delivered",
    notes: "Lot d'oranges bio",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// Mock data for stats
export const mockStats: StatsData = {
  totalLots: 2,
  activeFarms: mockFarms.filter(farm => farm.active).length,
  inTransit: 1,
  deliveredToday: 1
};

// Export mock API
export const mockApi = {
  getAvocadoTrackingData: () => Promise.resolve(mockAvocadoTrackingData),
  getFarms: () => Promise.resolve(mockFarms),
  getLots: () => Promise.resolve(mockLots),
  getStats: () => Promise.resolve(mockStats),
  addAvocadoTracking: (data: AvocadoTracking) => {
    mockAvocadoTrackingData = [...mockAvocadoTrackingData, data];
    return Promise.resolve(data);
  },
  addFarm: (data: Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log("Mock API: Adding farm with data:", data);

    // Validate required fields
    if (!data.name || !data.location || !data.code) {
      console.error("Mock API: Missing required fields", data);
      return Promise.reject(new Error("Missing required fields: name, location, and code are required"));
    }

    const newFarm: Farm = {
      ...data,
      id: `farm${mockFarms.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log("Mock API: Created new farm:", newFarm);
    mockFarms.push(newFarm);
    console.log("Mock API: Updated farms array, new length:", mockFarms.length);

    return Promise.resolve(newFarm);
  },
  addLot: (data: Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newLot: Lot = {
      ...data,
      id: `lot${mockLots.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockLots.push(newLot);
    return Promise.resolve(newLot);
  },
  updateFarm: (id: string, data: Partial<Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const index = mockFarms.findIndex(f => f.id === id);
    if (index === -1) {
      return Promise.reject(new Error(`Farm with id ${id} not found`));
    }
    const updatedFarm: Farm = {
      ...mockFarms[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    mockFarms[index] = updatedFarm;
    return Promise.resolve(updatedFarm);
  },
  updateLot: (id: string, data: Partial<Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const index = mockLots.findIndex(l => l.id === id);
    if (index === -1) {
      return Promise.reject(new Error(`Lot with id ${id} not found`));
    }
    const updatedLot: Lot = {
      ...mockLots[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    mockLots[index] = updatedLot;
    return Promise.resolve(updatedLot);
  },
  deleteFarm: (id: string) => {
    const index = mockFarms.findIndex(f => f.id === id);
    if (index === -1) {
      return Promise.reject(new Error(`Farm with id ${id} not found`));
    }
    mockFarms = mockFarms.filter(f => f.id !== id);
    return Promise.resolve();
  },
  deleteLot: (id: string) => {
    const index = mockLots.findIndex(l => l.id === id);
    if (index === -1) {
      return Promise.reject(new Error(`Lot with id ${id} not found`));
    }
    mockLots = mockLots.filter(l => l.id !== id);
    return Promise.resolve();
  },
  generatePDF: (lotId: string | number) => {
    // Check if lotId is valid
    if (!lotId) {
      return Promise.reject(new Error("Lot ID is required for PDF generation"));
    }

    const lotNumber = typeof lotId === 'number' ? `LOT-${lotId}` : lotId;
    const lot = mockAvocadoTrackingData.find(lot => lot.harvest.lotNumber === lotNumber);
    if (!lot) {
      return Promise.reject(new Error(`Lot with ID ${lotNumber} not found`));
    }

    // Create HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Lot Tracking Report - ${lot.harvest.lotNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Lot Tracking Report - ${lot.harvest.lotNumber}</h1>
          
          <div class="section">
            <h2>Harvest Information</h2>
            <p><span class="label">Date:</span> ${new Date(lot.harvest.harvestDate).toLocaleDateString()}</p>
            <p><span class="label">Location:</span> ${lot.harvest.farmLocation}</p>
            <p><span class="label">Farmer ID:</span> ${lot.harvest.farmerId}</p>
            <p><span class="label">Variety:</span> ${lot.harvest.variety}</p>
          </div>
          
          <div class="section">
            <h2>Transport Information</h2>
            <p><span class="label">Company:</span> ${lot.transport.transportCompany}</p>
            <p><span class="label">Driver:</span> ${lot.transport.driverName}</p>
            <p><span class="label">Vehicle ID:</span> ${lot.transport.vehicleId}</p>
            <p><span class="label">Temperature:</span> ${lot.transport.temperature}°C</p>
          </div>
          
          <div class="section">
            <h2>Quality Information</h2>
            <p><span class="label">Grade:</span> ${lot.sorting.qualityGrade}</p>
            <p><span class="label">Rejected Count:</span> ${lot.sorting.rejectedCount}</p>
            <p><span class="label">Notes:</span> ${lot.sorting.notes}</p>
          </div>
          
          <div class="section">
            <h2>Packaging Information</h2>
            <p><span class="label">Box ID:</span> ${lot.packaging.boxId}</p>
            <p><span class="label">Net Weight:</span> ${lot.packaging.netWeight} kg</p>
            <p><span class="label">Count:</span> ${lot.packaging.avocadoCount}</p>
            <p><span class="label">Type:</span> ${lot.packaging.boxType}</p>
          </div>
          
          <div class="section">
            <h2>Delivery Information</h2>
            <p><span class="label">Client:</span> ${lot.delivery.clientName}</p>
            <p><span class="label">Received:</span> ${lot.delivery.received ? 'Yes' : 'No'}</p>
            <p><span class="label">Received By:</span> ${lot.delivery.receivedBy || 'N/A'}</p>
          </div>
        </body>
      </html>
    `;

    // In a real implementation, this would generate a PDF from the HTML
    // For now, we'll just return a mock Blob
    return Promise.resolve(new Blob([htmlContent], { type: 'text/html' }));
  }
};