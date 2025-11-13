import { Badge } from "@/components/ui/badge";
import { Farm, Lot } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LotDetailsProps {
  lot: Lot;
  farm: Farm;
}

export default function LotDetails({ lot, farm }: LotDetailsProps) {
  // Format dates
  const formatDate = (dateString: string, formatStr: string) => {
    try {
      // Check if the date string is valid
      if (!dateString || dateString === "") {
        return "N/A";
      }
      
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Date invalide";
      }
      
      return format(date, formatStr, { locale: fr });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date invalide";
    }
  };

  const harvestDate = formatDate(lot.harvestDate, "dd/MM/yyyy");
  const createdAt = formatDate(lot.createdAt, "dd/MM/yyyy HH:mm");
  
  // Get status display
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "harvested":
        return "Récolté";
      case "packaged":
        return "Emballé";
      case "cooled":
        return "Refroidi";
      case "shipped":
        return "Expédié";
      case "delivered":
        return "Livré";
      default:
        return status;
    }
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "harvested":
      case "packaged":
        return "bg-neutral-100 text-neutral-800";
      case "cooled":
        return "bg-yellow-100 text-yellow-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };
  
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <span className="bg-neutral-100 px-2 py-1 rounded text-sm text-neutral-800">Lot #</span>
          <span className="font-mono font-bold text-lg ml-2">{lot.lotNumber}</span>
        </div>
        <div className="mt-2 md:mt-0">
          <Badge className={`px-3 py-1 ${getStatusBadgeClass(lot.currentStatus)}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {lot.currentStatus === "delivered" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : lot.currentStatus === "shipped" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            {getStatusDisplay(lot.currentStatus)}
          </Badge>
        </div>
      </div>
      
      {/* Lot Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-neutral-500">Ferme</p>
          <p className="font-medium">{farm.name}</p>
        </div>
        <div>
          <p className="text-sm text-neutral-500">Code Ferme</p>
          <p className="font-medium font-mono">{farm.code}</p>
        </div>
        <div>
          <p className="text-sm text-neutral-500">Date Récolte</p>
          <p className="font-medium">{harvestDate}</p>
        </div>
        <div>
          <p className="text-sm text-neutral-500">Quantité</p>
          <p className="font-medium">{lot.initialQuantity} kg</p>
        </div>
        <div>
          <p className="text-sm text-neutral-500">Dernière Mise à Jour</p>
          <p className="font-medium">{createdAt}</p>
        </div>
      </div>
    </div>
  );
}
