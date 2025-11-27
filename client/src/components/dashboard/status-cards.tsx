import { Loader2, Package, Truck, CheckCircle, Tractor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsData {
  totalLots: number;
  activeFarms: number;
  inTransit: number;
  deliveredToday: number;
}

interface StatusCardsProps {
  stats?: StatsData;
  isLoading: boolean;
}

export default function StatusCards({ stats, isLoading }: StatusCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Lots */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500">Total Lots</p>
              {isLoading ? (
                <Loader2 className="h-6 w-6 mt-1 animate-spin text-primary" />
              ) : (
                <h3 className="text-2xl font-bold">{stats?.totalLots || 0}</h3>
              )}
            </div>
            <div className="bg-primary-100 p-3 rounded-full">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-2 text-sm text-green-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span>5.3% depuis hier</span>
          </div>
        </CardContent>
      </Card>

      {/* In Transit */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500">En Transit</p>
              {isLoading ? (
                <Loader2 className="h-6 w-6 mt-1 animate-spin text-primary" />
              ) : (
                <h3 className="text-2xl font-bold">{stats?.inTransit || 0}</h3>
              )}
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Truck className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="mt-2 text-sm text-neutral-500 flex items-center">
            <span>Lots en route</span>
          </div>
        </CardContent>
      </Card>

      {/* Delivered Today */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500">Livré Aujourd'hui</p>
              {isLoading ? (
                <Loader2 className="h-6 w-6 mt-1 animate-spin text-primary" />
              ) : (
                <h3 className="text-2xl font-bold">{stats?.deliveredToday || 0}</h3>
              )}
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="mt-2 text-sm text-green-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span>12% depuis hier</span>
          </div>
        </CardContent>
      </Card>

      {/* Active Farms */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500">Fermes Actives</p>
              {isLoading ? (
                <Loader2 className="h-6 w-6 mt-1 animate-spin text-primary" />
              ) : (
                <h3 className="text-2xl font-bold">{stats?.activeFarms || 0}</h3>
              )}
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Tractor className="h-5 w-5 text-orange-500" />
            </div>
          </div>
          <div className="mt-2 text-sm text-green-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span>8% depuis hier</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
