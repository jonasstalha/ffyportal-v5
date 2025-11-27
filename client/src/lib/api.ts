// Define a type for the lot parameter
export interface Lot {
  id: string;
  currentStep: number;
  formData: Record<string, any>; // Adjust this type as needed for specific form data structure
}

export const fetchLots = async () => {
  // Placeholder implementation for fetching lots from the backend
  return [
    {
      id: "1",
      currentStep: 1,
      formData: {
        harvest: {
          harvestDate: "2025-09-01",
          farmLocation: "Farm A",
          farmerId: "123",
          lotNumber: "LOT001",
          variety: "hass",
          avocadoType: "conventionnel",
        },
        transport: {
          lotNumber: "LOT001",
          transportCompany: "Transport Co",
          driverName: "John Doe",
          vehicleId: "VH001",
          departureDateTime: "2025-09-01T08:00",
          arrivalDateTime: "2025-09-01T12:00",
          temperature: 4.5,
        },
        sorting: {
          lotNumber: "LOT001",
          sortingDate: "2025-09-02",
          qualityGrade: "A",
          rejectedCount: 0,
          notes: "",
        },
        packaging: {
          lotNumber: "LOT001",
          packagingDate: "2025-09-03",
          boxId: "BOX001",
          workerIds: ["W001"],
          netWeight: 100,
          avocadoCount: 50,
          boxType: "case",
          boxTypes: ["case"],
          calibers: ["12"],
          boxWeights: ["4kg"],
          paletteNumbers: ["220"],
        },
        storage: {
          boxId: "BOX001",
          entryDate: "2025-09-03",
          storageTemperature: 4,
          storageRoomId: "ROOM001",
          exitDate: "",
        },
        export: {
          boxId: "BOX001",
          loadingDate: "2025-09-04",
          containerId: "CONT001",
          driverName: "Jane Doe",
          vehicleId: "VH002",
          destination: "Port A",
        },
        delivery: {
          boxId: "BOX001",
          estimatedDeliveryDate: "2025-09-05",
          actualDeliveryDate: "",
          clientName: "Client A",
          clientLocation: "City A",
          notes: "",
        },
        selectedFarm: "Farm A",
        packagingDate: "2025-09-03",
        boxId: "BOX001",
        boxTypes: ["case"],
        calibers: ["12"],
        avocadoCount: 50,
        status: "draft",
        completedSteps: [],
        createdAt: "2025-09-01T00:00:00",
        updatedAt: "2025-09-01T00:00:00",
      },
    },
  ];
};

export const saveLot = async (lot: Lot) => {
  // Placeholder implementation for saving a lot to the backend
  console.log("Saving lot to backend:", lot);
  return lot;
};
