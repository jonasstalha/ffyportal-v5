import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Farm } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface FilterBarProps {
  filters: {
    search: string;
    farmId: string;
    status: string;
    date: string;
  };
  onFilterChange: (filters: any) => void;
  farms: Farm[];
  isLoading: boolean;
}

export default function FilterBar({ filters, onFilterChange, farms, isLoading }: FilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value });
  };
  
  const handleFarmChange = (value: string) => {
    onFilterChange({ farmId: value });
  };
  
  const handleStatusChange = (value: string) => {
    onFilterChange({ status: value });
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ date: e.target.value });
  };
  
  const handleFilterClick = () => {
    // Trigger the query explicitly if needed
    // This is already handled by the filters dependency in the parent component
  };
  
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          {/* Search Input */}
          <div className="flex-grow">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                type="text"
                placeholder="Rechercher par lot, ferme, etc."
                className="pl-10"
                value={filters.search}
                onChange={handleSearchChange}
              />
            </div>
          </div>
          
          {/* Farm Select */}
          <div className="md:w-52">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Ferme</label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={filters.farmId} onValueChange={handleFarmChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les fermes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les fermes</SelectItem>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id.toString()}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Status Select */}
          <div className="md:w-52">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Statut</label>
            <Select value={filters.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tous statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="harvested">Récolté</SelectItem>
                <SelectItem value="packaged">Emballé</SelectItem>
                <SelectItem value="cooled">Refroidi</SelectItem>
                <SelectItem value="shipped">Expédié</SelectItem>
                <SelectItem value="delivered">Livré</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Date Input */}
          <div className="md:w-44">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <Input
              type="date"
              value={filters.date}
              onChange={handleDateChange}
            />
          </div>
          
          {/* Filter Button */}
          <div className="flex items-end">
            <Button onClick={handleFilterClick} className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtrer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
