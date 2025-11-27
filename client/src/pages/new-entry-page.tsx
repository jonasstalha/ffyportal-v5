import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Save, CheckCircle, Clock, ArrowLeft, ArrowRight, Package, Truck, Factory, Warehouse, Ship, MapPin, Users, Globe } from "lucide-react";
import { addAvocadoTracking, getFarms, getAvocadoTrackingByLotNumber, updateAvocadoTracking } from "@/lib/firebaseService";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMultiLots } from "@/hooks/useMultiLots";
import { useAuth } from "@/hooks/use-auth";
import MultiLotSelector from "@/components/multi-lot/MultiLotSelector";
import { MultiLot } from "@/lib/multiLotService";

export default function NewEntryPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [farms, setFarms] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseRooms, setSelectedWarehouseRooms] = useState<any[]>([]);
  const [farmLoading, setFarmLoading] = useState(true);
  const [warehouseLoading, setWarehouseLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLotSelector, setShowLotSelector] = useState(true);
  const [selectedLot, setSelectedLot] = useState<MultiLot | null>(null);
  const [isEditingLegacyLot, setIsEditingLegacyLot] = useState(false);
  const [legacyLotId, setLegacyLotId] = useState<string | null>(null);

  const { 
    addLot, 
    updateLot, 
    updateLotStep, 
    completeLot, 
    getLot,
    loading: multiLotLoading, 
    error: multiLotError 
  } = useMultiLots();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load farms
        setFarmLoading(true);
        const farmsData = await getFarms();
        setFarms(farmsData);
        setFarmLoading(false);

        // Load warehouses (salles collection used across app)
        setWarehouseLoading(true);
        const { collection, getDocs } = await import('firebase/firestore');
        const { firestore: db } = await import('@/lib/firebase');

        const warehousesQuery = collection(db, "salles");
        const warehousesSnapshot = await getDocs(warehousesQuery);
        const warehousesData = warehousesSnapshot.docs.map(d => {
          const data = d.data() as any;
          // Map common field names used in this UI: nom, localisation, salles, capaciteTotale
          return {
            id: d.id,
            nom: data.name || data.nom || data.label || data.code || d.id,
            localisation: data.location || data.localisation || data.location || "",
            salles: data.salles || data.rooms || [],
            capaciteTotale: data.capacity || data.capaciteTotale || data.capacite || null,
            // include raw data for fallback
            raw: data,
          };
        });
        setWarehouses(warehousesData);
        setWarehouseLoading(false);

      } catch (error) {
        console.error("Error loading data:", error);
        setError("Erreur lors du chargement des données");
        setFarmLoading(false);
        setWarehouseLoading(false);
      }
    };

    loadData();
  }, []);

  // Separate effect to handle lot loading when lots are available
  useEffect(() => {
    const loadLot = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const lotId = urlParams.get('lotId');
      const legacyLotId = urlParams.get('legacyLotId');
      
      if (lotId && !multiLotLoading) {
        // Handle multi-lot loading
        const lot = getLot(lotId);
        if (lot) {
          setSelectedLot(lot);
          setShowLotSelector(false);
          // Initialize formData with the lot data
          setFormData({
            ...lot,
            selectedFarm: lot.harvest?.farmLocation || "",
            packagingDate: lot.packaging?.packagingDate || "",
            boxId: lot.packaging?.boxId || "",
            boxTypes: lot.packaging?.boxTypes || [],
            calibers: lot.packaging?.calibers || [],
            avocadoCount: lot.packaging?.avocadoCount || 0,
            status: lot.status || "draft",
            completedSteps: lot.completedSteps || [],
            createdAt: lot.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          
          // Set current step based on completed steps
          const completedSteps = lot.completedSteps || [];
          if (completedSteps.length > 0) {
            setCurrentStep(Math.max(...completedSteps) + 1);
          } else {
            setCurrentStep(1);
          }
        }
      } else if (legacyLotId) {
        // Handle legacy lot loading
        try {
          const legacyLot = await getAvocadoTrackingByLotNumber(legacyLotId);
          if (legacyLot) {
            setIsEditingLegacyLot(true);
            setLegacyLotId(legacyLot.id);
            setShowLotSelector(false);
            // Convert legacy lot to the expected format
            setFormData({
              id: legacyLot.id,
              harvest: legacyLot.harvest,
              transport: legacyLot.transport,
              sorting: legacyLot.sorting,
              packaging: legacyLot.packaging,
              export: legacyLot.export,
              delivery: legacyLot.delivery,
              selectedFarm: legacyLot.harvest?.farmLocation || "",
              packagingDate: legacyLot.packaging?.packagingDate || "",
              boxId: legacyLot.packaging?.boxId || "",
              boxTypes: legacyLot.packaging?.boxTypes || [],
              calibers: legacyLot.packaging?.calibers || [],
              avocadoCount: legacyLot.packaging?.avocadoCount || 0,
              status: "draft", // Legacy lots can always be edited
              completedSteps: [],
              currentStep: 1,
              assignedUsers: user ? [user.uid] : [],
              globallyAccessible: true,
              createdBy: user?.uid || "",
              createdAt: legacyLot.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            
            // Set step based on legacy lot completion
            let step = 1;
            if (legacyLot.harvest?.harvestDate) step = 2;
            if (legacyLot.transport?.arrivalDateTime) step = 3;
            if (legacyLot.sorting?.sortingDate) step = 4;
            if (legacyLot.packaging?.packagingDate) step = 5;
            if (legacyLot.export?.loadingDate) step = 6;
            if (legacyLot.delivery?.actualDeliveryDate) step = 7;
            setCurrentStep(step);
          }
        } catch (error) {
          console.error("Error loading legacy lot:", error);
          setError("Erreur lors du chargement du lot");
        }
      }
    };

    loadLot();
  }, [multiLotLoading, getLot, user]);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Initialize formData from selected lot or create new
  const [formData, setFormData] = useState(() => {
    if (selectedLot) {
      return {
        ...selectedLot,
        selectedFarm: selectedLot.harvest?.farmLocation || "",
        packagingDate: selectedLot.packaging?.packagingDate || "",
        boxId: selectedLot.packaging?.boxId || "",
        boxTypes: selectedLot.packaging?.boxTypes || [],
        calibers: selectedLot.packaging?.calibers || [],
        avocadoCount: selectedLot.packaging?.avocadoCount || 0,
        status: selectedLot.status || "draft",
        completedSteps: selectedLot.completedSteps || [],
        createdAt: selectedLot.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      harvest: {
        harvestDate: "",
        farmLocation: "",
        farmerId: "",
        lotNumber: "",
        variety: "hass",
        avocadoType: "",
      },
      transport: {
        lotNumber: "",
        transportCompany: "",
        driverName: "",
        vehicleId: "",
        departureDateTime: "",
        arrivalDateTime: "",
        temperature: 0,
      },
      sorting: {
        lotNumber: "",
        sortingDate: "",
        qualityGrade: "A",
        rejectedCount: 0,
        notes: "",
      },
      packaging: {
        lotNumber: "",
        packagingDate: "",
        boxId: "",
        workerIds: [],
        netWeight: 0,
        avocadoCount: 0,
        boxType: "case",
        boxTypes: [],
        calibers: [],
        boxWeights: [],
        paletteNumbers: [],
      },
      storage: {
        boxId: "",
        entryDate: "",
        storageTemperature: 0,
        storageRoomId: "",
        exitDate: "",
        warehouseId: "",
        warehouseName: "",
      },
      export: {
        boxId: "",
        loadingDate: "",
        containerId: "",
        driverName: "",
        vehicleId: "",
        destination: "",
      },
      delivery: {
        boxId: "",
        estimatedDeliveryDate: "",
        actualDeliveryDate: "",
        clientName: "",
        clientLocation: "",
        notes: "",
      },
      selectedFarm: "",
      packagingDate: "",
      boxId: "",
      boxTypes: [],
      calibers: [],
      avocadoCount: 0,
      status: "draft",
      completedSteps: [],
      currentStep: 1,
      assignedUsers: user ? [user.uid] : [],
      globallyAccessible: true,
      createdBy: user?.uid || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Update form data when selected lot changes
  useEffect(() => {
    if (selectedLot) {
      setFormData({
        ...selectedLot,
        selectedFarm: selectedLot.harvest?.farmLocation || "",
        packagingDate: selectedLot.packaging?.packagingDate || "",
        boxId: selectedLot.packaging?.boxId || "",
        boxTypes: selectedLot.packaging?.boxTypes || [],
        calibers: selectedLot.packaging?.calibers || [],
        avocadoCount: selectedLot.packaging?.avocadoCount || 0,
        updatedAt: new Date().toISOString(),
      });
      setCurrentStep(selectedLot.currentStep || 1);
      setShowLotSelector(false);
    }
  }, [selectedLot]);

  const toast = (message: string) => {
    // Simple toast function for notifications
    console.log("🎉 " + message);
    // You can replace this with actual toast implementation later
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return formData.harvest.harvestDate && formData.harvest.farmerId && formData.harvest.lotNumber;
      case 2:
        return formData.transport.transportCompany && formData.transport.driverName;
      case 3:
        return formData.sorting.sortingDate && formData.sorting.qualityGrade;
      case 4:
        return formData.packagingDate && formData.boxId;
      case 5:
        return formData.storage.entryDate && formData.storage.storageRoomId && formData.storage.warehouseId;
      case 6:
        return formData.export.loadingDate && formData.export.containerId;
      case 7:
        return formData.delivery.estimatedDeliveryDate && formData.delivery.clientName;
      default:
        return false;
    }
  };

  const validateAllSteps = () => {
    const step1Valid = formData.harvest.harvestDate && formData.harvest.farmerId && formData.harvest.lotNumber;
    const step2Valid = formData.transport.transportCompany && formData.transport.driverName;
    const step3Valid = formData.sorting.sortingDate && formData.sorting.qualityGrade;
    const step4Valid = formData.packagingDate && formData.boxId;
    const step5Valid = formData.storage.entryDate && formData.storage.storageRoomId && formData.storage.warehouseId;
    const step6Valid = formData.export.loadingDate && formData.export.containerId;
    const step7Valid = formData.delivery.estimatedDeliveryDate && formData.delivery.clientName;
    
    // Debug logging
    console.log('Step validation debug:', {
      step1Valid,
      step2Valid, 
      step3Valid,
      step4Valid,
      step5Valid,
      step6Valid,
      step7Valid,
      formData: {
        harvest: formData.harvest,
        transport: formData.transport,
        sorting: formData.sorting,
        packagingDate: formData.packagingDate,
        boxId: formData.boxId,
        storage: formData.storage,
        export: formData.export,
        delivery: formData.delivery
      }
    });
    
    return step1Valid && step2Valid && step3Valid && step4Valid && step5Valid && step6Valid && step7Valid;
  };

  const getStepCompletionPercentage = () => {
    // Auto-mark completed steps based on validation
    const step1Valid = formData.harvest.harvestDate && formData.harvest.farmerId && formData.harvest.lotNumber;
    const step2Valid = formData.transport.transportCompany && formData.transport.driverName;
    const step3Valid = formData.sorting.sortingDate && formData.sorting.qualityGrade;
    const step4Valid = formData.packagingDate && formData.boxId;
    const step5Valid = formData.storage.entryDate && formData.storage.storageRoomId && formData.storage.warehouseId;
    const step6Valid = formData.export.loadingDate && formData.export.containerId;
    const step7Valid = formData.delivery.estimatedDeliveryDate && formData.delivery.clientName;
    
    const validSteps = [step1Valid, step2Valid, step3Valid, step4Valid, step5Valid, step6Valid, step7Valid];
    const completedCount = validSteps.filter(Boolean).length;
    
    console.log('Real-time progress calculation:', {
      validSteps,
      completedCount,
      percentage: Math.round((completedCount / 7) * 100),
      formDataCompletedSteps: formData.completedSteps
    });
    
    return Math.round((completedCount / 7) * 100);
  };

  const saveDraft = async (silent = false) => {
    setIsSavingDraft(true);
    try {
      if (isEditingLegacyLot && legacyLotId) {
        // Update existing legacy lot in avocado-tracking collection
        const { id, createdAt, updatedAt, selectedFarm, packagingDate, boxId, boxTypes, calibers, avocadoCount, status, completedSteps, currentStep, assignedUsers, globallyAccessible, createdBy, lastSaved, ...legacyData } = formData;
        await updateAvocadoTracking(legacyLotId, {
          ...legacyData,
          updatedAt: new Date().toISOString()
        });
      } else if (selectedLot && selectedLot.id) {
        // Update existing multi-lot
        const { id, createdAt, updatedAt, ...updateData } = formData;
        await updateLot(selectedLot.id, {
          ...updateData,
          storage: {
            ...updateData.storage,
            warehouseName: updateData.storage?.warehouseName ?? ""
          },
          status: 'draft',
          lastSaved: new Date().toISOString()
        });
      } else {
        // Create new lot
        const { id, createdAt, updatedAt, ...draftData } = formData;
        const draftSubmission = {
          ...draftData,
          storage: {
            ...draftData.storage,
            warehouseName: draftData.storage?.warehouseName ?? ""
          },
          status: 'draft',
          lastSaved: new Date().toISOString(),
          lotNumber: draftData.harvest?.lotNumber || `LOT-${Date.now()}`
        };
        const newLotId = await addLot(draftSubmission);
        // Note: selectedLot will be updated through the subscription
      }
      
      setLastSaved(new Date().toISOString());
      if (!silent) {
        toast("Brouillon sauvegardé - Vos modifications ont été sauvegardées.");
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      setError('Failed to save draft. Please try again.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const forceCompleteLot = async () => {
    if (selectedLot && selectedLot.id) {
      try {
        setIsSubmitting(true);
        
        // Force mark all steps as completed
        const allSteps = [1, 2, 3, 4, 5, 6, 7];
        
        // Update the lot with all steps completed
        await updateLot(selectedLot.id, {
          completedSteps: allSteps,
          status: 'completed',
          updatedAt: new Date().toISOString()
        });
        
        // Complete and archive the lot
        await completeLot(selectedLot.id);
        
        toast("Lot finalisé ! Le lot a été marqué comme 100% complété et archivé.");
        
        // Navigate to lots page
        setLocation('/lots');
      } catch (error) {
        console.error('Error force completing lot:', error);
        setError('Failed to finalize lot. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEditingLegacyLot && legacyLotId) {
        // Update legacy lot in avocado-tracking collection
        const { id, createdAt, updatedAt, selectedFarm, packagingDate, boxId, boxTypes, calibers, avocadoCount, status, completedSteps, currentStep, assignedUsers, globallyAccessible, createdBy, lastSaved, ...legacyData } = formData;
        await updateAvocadoTracking(legacyLotId, {
          ...legacyData,
          updatedAt: new Date().toISOString()
        });
        toast("Lot mis à jour - Le lot hérité a été mis à jour avec les dernières informations.");
        setLocation('/lots');
      } else if (selectedLot && selectedLot.id) {
        // Complete the lot if all steps are done
        const allStepsCompleted = formData.completedSteps?.length === 7;
        
        if (allStepsCompleted) {
          await completeLot(selectedLot.id);
          toast("Lot terminé! Le lot a été marqué comme terminé et sera archivé.");
          // Navigate to lots page
          setLocation('/lots');
        } else {
          // Update the lot with current progress
          const { id, createdAt, updatedAt, ...updateData } = formData;
          await updateLot(selectedLot.id, {
            ...updateData,
            status: 'in-progress'
          });
          toast("Lot mis à jour - Le lot a été mis à jour avec les dernières informations.");
        }
      } else {
        // This shouldn't happen, but fallback to old behavior
        const { id, createdAt, updatedAt, ...submissionData } = formData;
        await addAvocadoTracking(submissionData);
        setLocation('/lots');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setError('Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (section, field, value) => {
    setFormData((prev) => {
      const updatedSection = {
        ...(prev[section] || {}),
        [field]: value,
      };
      const newData = {
        ...prev,
        [section]: updatedSection,
        updatedAt: new Date().toISOString(),
      };
      return newData;
    });
  };

  const markStepComplete = async () => {
    if (validateCurrentStep() && isEditingLegacyLot && legacyLotId) {
      try {
        // For legacy lots, save the current data to avocado-tracking
        const { id, createdAt, updatedAt, selectedFarm, packagingDate, boxId, boxTypes, calibers, avocadoCount, status, completedSteps, currentStep, assignedUsers, globallyAccessible, createdBy, lastSaved, ...legacyData } = formData;
        await updateAvocadoTracking(legacyLotId, {
          ...legacyData,
          updatedAt: new Date().toISOString()
        });
        
        setFormData(prev => ({
          ...prev,
          completedSteps: [...new Set([...(prev.completedSteps || []), currentStep])],
          updatedAt: new Date().toISOString(),
        }));
        
        toast("Étape mise à jour - Les données de l'étape ont été sauvegardées.");
      } catch (error) {
        console.error('Error updating legacy lot step:', error);
        setError('Failed to update step. Please try again.');
      }
    } else if (validateCurrentStep() && selectedLot && selectedLot.id) {
      try {
        // Update the step data based on current step
        const stepData = getStepData(currentStep);
        await updateLotStep(selectedLot.id, currentStep, stepData);
        
        setFormData(prev => ({
          ...prev,
          completedSteps: [...new Set([...(prev.completedSteps || []), currentStep])],
          updatedAt: new Date().toISOString(),
        }));

        // Check if all steps are now completed
        const newCompletedSteps = [...new Set([...(formData.completedSteps || []), currentStep])];
        if (newCompletedSteps.length === 7 && validateAllSteps()) {
          // Automatically complete and archive the lot
          await completeLot(selectedLot.id);
          toast("Lot complété ! Le lot a été automatiquement complété et archivé.");
        }
      } catch (error) {
        console.error('Error updating step:', error);
        setError('Failed to update step. Please try again.');
      }
    } else if (validateCurrentStep()) {
      // For new lots, just mark locally
      setFormData(prev => ({
        ...prev,
        completedSteps: [...new Set([...(prev.completedSteps || []), currentStep])],
        updatedAt: new Date().toISOString(),
      }));
    }
  };

  const getStepData = (step: number) => {
    switch (step) {
      case 1:
        return { harvest: formData.harvest };
      case 2:
        return { transport: formData.transport };
      case 3:
        return { sorting: formData.sorting };
      case 4:
        return { 
          packaging: {
            packagingDate: formData.packagingDate,
            boxId: formData.boxId,
            boxTypes: formData.boxTypes || [],
            calibers: formData.calibers || [],
            avocadoCount: formData.avocadoCount || 0,
            workerIds: formData.packaging?.workerIds || [],
            netWeight: formData.packaging?.netWeight || 0,
            boxType: formData.packaging?.boxType || "",
            boxWeights: formData.packaging?.boxWeights || [],
            paletteNumbers: formData.packaging?.paletteNumbers || []
          }
        };
      case 5:
        return { storage: formData.storage };
      case 6:
        return { export: formData.export };
      case 7:
        return { delivery: formData.delivery };
      default:
        return {};
    }
  };

  const nextStep = async () => {
    await markStepComplete();
    setCurrentStep(prev => Math.min(prev + 1, 7));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  const handleLotSelect = (lot: MultiLot) => {
    setSelectedLot(lot);
    setShowLotSelector(false);
  };

  const handleNewLot = () => {
    setSelectedLot(null);
    setCurrentStep(1);
    setFormData({
      harvest: {
        harvestDate: "",
        farmLocation: "",
        farmerId: "",
        lotNumber: "",
        variety: "hass",
        avocadoType: "",
      },
      transport: {
        lotNumber: "",
        transportCompany: "",
        driverName: "",
        vehicleId: "",
        departureDateTime: "",
        arrivalDateTime: "",
        temperature: 0,
      },
      sorting: {
        lotNumber: "",
        sortingDate: "",
        qualityGrade: "A",
        rejectedCount: 0,
        notes: "",
      },
      packaging: {
        lotNumber: "",
        packagingDate: "",
        boxId: "",
        workerIds: [],
        netWeight: 0,
        avocadoCount: 0,
        boxType: "case",
        boxTypes: [],
        calibers: [],
        boxWeights: [],
        paletteNumbers: [],
      },
      storage: {
        boxId: "",
        entryDate: "",
        storageTemperature: 0,
        storageRoomId: "",
        exitDate: "",
        warehouseId: "",
        warehouseName: "",
      },
      export: {
        boxId: "",
        loadingDate: "",
        containerId: "",
        driverName: "",
        vehicleId: "",
        destination: "",
      },
      delivery: {
        boxId: "",
        estimatedDeliveryDate: "",
        actualDeliveryDate: "",
        clientName: "",
        clientLocation: "",
        notes: "",
      },
      selectedFarm: "",
      packagingDate: "",
      boxId: "",
      boxTypes: [],
      calibers: [],
      avocadoCount: 0,
      status: "draft",
      completedSteps: [],
      currentStep: 1,
      assignedUsers: user ? [user.uid] : [],
      globallyAccessible: true,
      createdBy: user?.uid || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowLotSelector(false);
  };

  const handleBoxTypeToggle = (boxType) => {
    setFormData(prev => ({
      ...prev,
      boxTypes: prev.boxTypes.includes(boxType)
        ? prev.boxTypes.filter(t => t !== boxType)
        : [...prev.boxTypes, boxType]
    }));
  };

  const handleCaliberToggle = (caliber) => {
    setFormData(prev => ({
      ...prev,
      calibers: prev.calibers.includes(caliber)
        ? prev.calibers.filter(c => c !== caliber)
        : [...prev.calibers, caliber]
    }));
  };

  const stepIcons = {
    1: "🌱",
    2: "🚛",
    3: "🏭",
    4: "📦",
    5: "🏪",
    6: "🚢",
    7: "📍"
  };

  const stepTitles = {
    1: t('newEntry.harvest'),
    2: "Transport",
    3: t('newEntry.sorting'),
    4: t('newEntry.packaging'),
    5: t('newEntry.storage'),
    6: t('newEntry.shipping'),
    7: "Livraison"
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-3 text-green-800">
                <span className="text-2xl">🌱</span>
                <div>
                  <div>{t('newEntry.harvestTitle')}</div>
                  <div className="text-sm font-normal text-green-600">{t('newEntry.harvestSubtitle')}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="harvestDate" className="flex items-center gap-2 font-semibold">
                    📅 {t('newEntry.harvestDate')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="harvestDate"
                    type="datetime-local"
                    value={formData.harvest?.harvestDate || ""}
                    onChange={(e) => handleChange("harvest", "harvestDate", e.target.value)}
                    className="border-2 focus:border-green-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selectedFarm" className="flex items-center gap-2 font-semibold">
                    🏡 {t('newEntry.farm')}
                  </Label>
                  <Select
                    value={formData.selectedFarm || ""}
                    onValueChange={(value) => setFormData({ ...formData, selectedFarm: value })}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.chooseFarm')} />
                    </SelectTrigger>
                    <SelectContent>
                      {farms.map((farm) => (
                        <SelectItem key={farm.id} value={farm.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{farm.name}</span>
                            <span className="text-gray-500">- {farm.location}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="farmerId" className="flex items-center gap-2 font-semibold">
                    👨‍🌾 {t('newEntry.agronomistId')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="farmerId"
                    value={formData.harvest?.farmerId || ""}
                    onChange={(e) => handleChange("harvest", "farmerId", e.target.value)}
                    className="border-2 focus:border-green-500 transition-colors"
                    placeholder={t('newEntry.agronomistPlaceholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lotNumber" className="flex items-center gap-2 font-semibold">
                    🏷️ {t('newEntry.lotId')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lotNumber"
                    value={formData.harvest?.lotNumber || ""}
                    onChange={(e) => handleChange("harvest", "lotNumber", e.target.value)}
                    className="border-2 focus:border-green-500 transition-colors"
                    placeholder={t('newEntry.lotPlaceholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avocadoType" className="flex items-center gap-2 font-semibold">
                    🥑 {t('newEntry.avocadoType')}
                  </Label>
                  <Select
                    value={formData.harvest?.avocadoType || ""}
                    onValueChange={(value) => handleChange("harvest", "avocadoType", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conventionnel">🌱 Conventionnel</SelectItem>
                      <SelectItem value="bio">🌿 Bio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variety" className="flex items-center gap-2 font-semibold">
                    🌳 {t('newEntry.variety')}
                  </Label>
                  <Select
                    value={formData.harvest?.variety || "hass"}
                    onValueChange={(value) => handleChange("harvest", "variety", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.selectVariety')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hass">🥑 Hass</SelectItem>
                      <SelectItem value="fuerte">🌿 Fuerte</SelectItem>
                      <SelectItem value="bacon">🥓 Bacon</SelectItem>
                      <SelectItem value="zutano">🌱 Zutano</SelectItem>
                      <SelectItem value="other">❓ Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardTitle className="flex items-center gap-3 text-blue-800">
                <span className="text-2xl">🚛</span>
                <div>
                  <div>Transport vers l'usine</div>
                  <div className="text-sm font-normal text-blue-600">Informations de transport et logistique</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="transportCompany" className="flex items-center gap-2 font-semibold">
                    🏢 Société de transport <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="transportCompany"
                    value={formData.transport?.transportCompany || ""}
                    onChange={(e) => handleChange("transport", "transportCompany", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Transport Express SA"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverName" className="flex items-center gap-2 font-semibold">
                    👨‍💼 Nom du chauffeur <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="driverName"
                    value={formData.transport?.driverName || ""}
                    onChange={(e) => handleChange("transport", "driverName", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Jean Dupont"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleId" className="flex items-center gap-2 font-semibold">
                    🚚 ID du véhicule
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="vehicleId"
                      value={formData.transport?.vehicleId || ""}
                      onChange={(e) => handleChange("transport", "vehicleId", e.target.value)}
                      className="border-2 focus:border-blue-500 transition-colors"
                      placeholder="Ex: VH-2024-001"
                      lang="ar"
                      dir="rtl"
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="px-3"
                        >
                          ع
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px]">
                        <div className="h-[400px] w-full">
                          <iframe
                            src="https://www.lexilogos.com/keyboard/arabic.htm"
                            className="w-full h-full border-none"
                            title="Arabic Keyboard"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature" className="flex items-center gap-2 font-semibold">
                    🌡️ Température (°C)
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={formData.transport?.temperature || ""}
                    onChange={(e) => handleChange("transport", "temperature", parseFloat(e.target.value) || 0)}
                    className="border-2 focus:border-blue-500 transition-colors"
                    placeholder="Ex: 4.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departureDateTime" className="flex items-center gap-2 font-semibold">
                    🕐 Date et heure de départ
                  </Label>
                  <Input
                    id="departureDateTime"
                    type="datetime-local"
                    value={formData.transport?.departureDateTime || ""}
                    onChange={(e) => handleChange("transport", "departureDateTime", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalDateTime" className="flex items-center gap-2 font-semibold">
                    🕑 Date et heure d'arrivée
                  </Label>
                  <Input
                    id="arrivalDateTime"
                    type="datetime-local"
                    value={formData.transport?.arrivalDateTime || ""}
                    onChange={(e) => handleChange("transport", "arrivalDateTime", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50">
              <CardTitle className="flex items-center gap-3 text-purple-800">
                <span className="text-2xl">🏭</span>
                <div>
                  <div>{t('newEntry.sortingTitle')}</div>
                  <div className="text-sm font-normal text-purple-600">{t('newEntry.sortingSubtitle')}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sortingDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de tri <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sortingDate"
                    type="datetime-local"
                    value={formData.sorting?.sortingDate || ""}
                    onChange={(e) => handleChange("sorting", "sortingDate", e.target.value)}
                    className="border-2 focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualityGrade" className="flex items-center gap-2 font-semibold">
                    ⭐ {t('newEntry.qualityGrade')} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.sorting?.qualityGrade || "A"}
                    onValueChange={(value) => handleChange("sorting", "qualityGrade", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-purple-500">
                      <SelectValue placeholder={t('newEntry.selectGrade')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">🌟 Grade A - Premium</SelectItem>
                      <SelectItem value="B">⭐ Grade B - Standard</SelectItem>
                      <SelectItem value="C">✨ Grade C - Économique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rejectedCount" className="flex items-center gap-2 font-semibold">
                    ❌ Avocats rejetés
                  </Label>
                  <Input
                    id="rejectedCount"
                    type="number"
                    min="0"
                    value={formData.sorting?.rejectedCount || ""}
                    onChange={(e) => handleChange("sorting", "rejectedCount", parseInt(e.target.value) || 0)}
                    className="border-2 focus:border-purple-500 transition-colors"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="sortingNotes" className="flex items-center gap-2 font-semibold">
                    📝 {t('newEntry.observations')}
                  </Label>
                  <Textarea
                    id="sortingNotes"
                    value={formData.sorting?.notes || ""}
                    onChange={(e) => handleChange("sorting", "notes", e.target.value)}
                    className="border-2 focus:border-purple-500 transition-colors"
                    placeholder={t('newEntry.observationsPlaceholder')}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardTitle className="flex items-center gap-3 text-amber-800">
                <span className="text-2xl">📦</span>
                <div>
                  <div>Emballage</div>
                  <div className="text-sm font-normal text-amber-600">Conditionnement des avocats</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="packagingDate" className="flex items-center gap-2 font-semibold">
                    📅 Date d'emballage <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="packagingDate"
                    type="datetime-local"
                    value={formData.packagingDate || ""}
                    onChange={(e) => setFormData({ ...formData, packagingDate: e.target.value })}
                    className="border-2 focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="boxId" className="flex items-center gap-2 font-semibold">
                    📦 ID de la boîte <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="boxId"
                    value={formData.boxId || ""}
                    onChange={(e) => setFormData({ ...formData, boxId: e.target.value })}
                    className="border-2 focus:border-amber-500 transition-colors"
                    placeholder="Ex: BOX-2024-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    ⚖️ Poids net de la boîte <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    {["4kg", "10kg"].map((weight) => (
                      <div key={weight} className="flex items-center space-x-2">
                        <Checkbox
                          id={`boxWeight-${weight}`}
                          checked={formData.packaging?.boxWeights?.includes(weight)}
                          onCheckedChange={() => {
                            const currentWeights = formData.packaging?.boxWeights || [];
                            const newWeights = currentWeights.includes(weight)
                              ? currentWeights.filter(w => w !== weight)
                              : [...currentWeights, weight];
                            handleChange("packaging", "boxWeights", newWeights);
                          }}
                        />
                        <label
                          htmlFor={`boxWeight-${weight}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {weight}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    📦 Numéro de palette <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-4">
                    {["220", "264", "90"].map((number) => (
                      <div key={number} className="flex items-center space-x-2">
                        <Checkbox
                          id={`palette-${number}`}
                          checked={formData.packaging?.paletteNumbers?.includes(number)}
                          onCheckedChange={() => {
                            const currentNumbers = formData.packaging?.paletteNumbers || [];
                            const newNumbers = currentNumbers.includes(number)
                              ? currentNumbers.filter(n => n !== number)
                              : [...currentNumbers, number];
                            handleChange("packaging", "paletteNumbers", newNumbers);
                          }}
                        />
                        <label
                          htmlFor={`palette-${number}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {number}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    📦 Type d'emballage <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    {["Caisse plastique", "Box"].map((boxType) => (
                      <div key={boxType} className="flex items-center space-x-2">
                        <Checkbox
                          id={`boxType-${boxType}`}
                          checked={formData.boxTypes.includes(boxType)}
                          onCheckedChange={() => handleBoxTypeToggle(boxType)}
                        />
                        <label
                          htmlFor={`boxType-${boxType}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {boxType}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    📏 Calibres
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {["12", "14", "16", "18", "20", "22", "24", "26", "28", "30"].map((caliber) => (
                      <div key={caliber} className="flex items-center space-x-2">
                        <Checkbox
                          id={`caliber-${caliber}`}
                          checked={formData.calibers.includes(caliber)}
                          onCheckedChange={() => handleCaliberToggle(caliber)}
                        />
                        <label
                          htmlFor={`caliber-${caliber}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Calibre {caliber}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50">
              <CardTitle className="flex items-center gap-3 text-indigo-800">
                <span className="text-2xl">🏪</span>
                <div>
                  <div>Stockage</div>
                  <div className="text-sm font-normal text-indigo-600">Informations de stockage</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="entryDate" className="flex items-center gap-2 font-semibold">
                    📅 Date d'entrée <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="entryDate"
                    type="datetime-local"
                    value={formData.storage?.entryDate || ""}
                    onChange={(e) => handleChange("storage", "entryDate", e.target.value)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exitDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de sortie
                  </Label>
                  <Input
                    id="exitDate"
                    type="datetime-local"
                    value={formData.storage?.exitDate || ""}
                    onChange={(e) => handleChange("storage", "exitDate", e.target.value)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storageTemperature" className="flex items-center gap-2 font-semibold">
                    🌡️ Température (°C)
                  </Label>
                  <Input
                    id="storageTemperature"
                    type="number"
                    step="0.1"
                    value={formData.storage?.storageTemperature || ""}
                    onChange={(e) => handleChange("storage", "storageTemperature", parseFloat(e.target.value) || 0)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                    placeholder="Ex: 4.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storageWarehouse" className="flex items-center gap-2 font-semibold">
                    🏢 Entrepôt de stockage <span className="text-red-500">*</span>
                  </Label>
                  {warehouseLoading ? (
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                      <span className="text-sm text-gray-600">Chargement des entrepôts...</span>
                    </div>
                  ) : (
                    <select
                      value={formData.storage?.warehouseId || ""}
                      onChange={async (e) => {
                        const selectedWarehouse = warehouses.find(w => w.id === e.target.value);
                        if (selectedWarehouse) {
                          handleChange("storage", "warehouseId", selectedWarehouse.id);
                          handleChange("storage", "warehouseName", selectedWarehouse.nom);
                          // Reset room selection when warehouse changes
                          handleChange("storage", "storageRoomId", "");

                          // Fetch latest warehouse doc to get real rooms/freezers (salles)
                          try {
                            const { doc, getDoc } = await import('firebase/firestore');
                            const { firestore: db } = await import('@/lib/firebase');
                            const warehouseRef = doc(db, 'salles', selectedWarehouse.id);
                            const warehouseSnap = await getDoc(warehouseRef);
                            if (warehouseSnap.exists()) {
                              const data = warehouseSnap.data() as any;
                              const rooms = data.salles || data.rooms || [];
                              setSelectedWarehouseRooms(Array.isArray(rooms) ? rooms : []);
                            } else {
                              setSelectedWarehouseRooms([]);
                            }
                          } catch (err) {
                            console.error('Error loading warehouse rooms:', err);
                            setSelectedWarehouseRooms([]);
                          }
                        }
                      }}
                      className="w-full p-3 border-2 rounded-lg focus:border-indigo-500 transition-colors"
                      required
                    >
                      <option value="">Sélectionner un entrepôt</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.nom} - {warehouse.localisation}
                          {warehouse.capaciteTotale && ` (Capacité: ${warehouse.capaciteTotale} tonnes)`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {formData.storage?.warehouseId && (
                  <div className="space-y-2">
                    <Label htmlFor="storageRoomId" className="flex items-center gap-2 font-semibold">
                      🏠 Salle de stockage <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={formData.storage?.storageRoomId || ""}
                      onChange={(e) => handleChange("storage", "storageRoomId", e.target.value)}
                      className="w-full p-3 border-2 rounded-lg focus:border-indigo-500 transition-colors"
                      required
                    >
                      <option value="">Sélectionner une salle</option>
                      {(() => {
                        const selectedWarehouse = warehouses.find(w => w.id === formData.storage?.warehouseId);
                        // Prefer rooms we fetched from the doc after selection, otherwise fallback to mapped warehouse.salles
                        const warehouseRooms = (selectedWarehouseRooms && selectedWarehouseRooms.length > 0)
                          ? selectedWarehouseRooms
                          : (selectedWarehouse?.salles || []);

                        // Default freezer rooms that are always available
                        const defaultFreezerRooms = [
                          { nom: "Freezer 1", capacite: "50", temperature: "-18" },
                          { nom: "Freezer 2", capacite: "50", temperature: "-18" }
                        ];

                        // Combine warehouse-specific rooms with default freezer rooms
                        const allRooms = [...warehouseRooms, ...defaultFreezerRooms];

                        return allRooms.map((salle: any, index: number) => (
                          <option key={`${salle.nom}-${index}`} value={salle.nom}>
                            {salle.nom}
                            {salle.capacite && ` (Capacité: ${salle.capacite} tonnes)`}
                            {salle.temperature && ` - ${salle.temperature}°C`}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 6:
        return (
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardTitle className="flex items-center gap-3 text-teal-800">
                <span className="text-2xl">🚢</span>
                <div>
                  <div>Export</div>
                  <div className="text-sm font-normal text-teal-600">Informations d'exportation</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="loadingDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de chargement <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="loadingDate"
                    type="datetime-local"
                    value={formData.export?.loadingDate || ""}
                    onChange={(e) => handleChange("export", "loadingDate", e.target.value)}
                    className="border-2 focus:border-teal-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="containerId" className="flex items-center gap-2 font-semibold">
                    🗳️ ID du conteneur <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="containerId"
                    value={formData.export?.containerId || ""}
                    onChange={(e) => handleChange("export", "containerId", e.target.value)}
                    placeholder="Ex: CONT-2024-001"
                    className="border-2 focus:border-teal-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exportDriverName" className="flex items-center gap-2 font-semibold">
                    👨‍💼 Nom du chauffeur
                  </Label>
                  <Input
                    id="exportDriverName"
                    value={formData.export?.driverName || ""}
                    onChange={(e) => handleChange("export", "driverName", e.target.value)}
                    placeholder="Ex: Jean Dupont"
                    className="border-2 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exportVehicleId" className="flex items-center gap-2 font-semibold">
                    🚛 ID du véhicule
                  </Label>
                  <Input
                    id="exportVehicleId"
                    value={formData.export?.vehicleId || ""}
                    onChange={(e) => handleChange("export", "vehicleId", e.target.value)}
                    placeholder="Ex: VH-2024-001"
                    className="border-2 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="destination" className="flex items-center gap-2 font-semibold">
                    🌍 Destination
                  </Label>
                  <Input
                    id="destination"
                    value={formData.export?.destination || ""}
                    onChange={(e) => handleChange("export", "destination", e.target.value)}
                    placeholder="Ex: Port de Marseille, France"
                    className="border-2 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 7:
        return (
          <Card className="border-l-4 border-l-pink-500">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50">
              <CardTitle className="flex items-center gap-3 text-pink-800">
                <span className="text-2xl">📍</span>
                <div>
                  <div>Livraison</div>
                  <div className="text-sm font-normal text-pink-600">Livraison finale au client</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="estimatedDeliveryDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de livraison estimée <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="estimatedDeliveryDate"
                    type="datetime-local"
                    value={formData.delivery?.estimatedDeliveryDate || ""}
                    onChange={(e) => handleChange("delivery", "estimatedDeliveryDate", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actualDeliveryDate" className="flex items-center gap-2 font-semibold">
                    ✅ Date de livraison réelle
                  </Label>
                  <Input
                    id="actualDeliveryDate"
                    type="datetime-local"
                    value={formData.delivery?.actualDeliveryDate || ""}
                    onChange={(e) => handleChange("delivery", "actualDeliveryDate", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientName" className="flex items-center gap-2 font-semibold">
                    🏢 Nom du client <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    value={formData.delivery?.clientName || ""}
                    onChange={(e) => handleChange("delivery", "clientName", e.target.value)}
                    placeholder="Ex: SuperMarché Bio SA"
                    className="border-2 focus:border-pink-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientLocation" className="flex items-center gap-2 font-semibold">
                    📍 Lieu de livraison
                  </Label>
                  <Input
                    id="clientLocation"
                    value={formData.delivery?.clientLocation || ""}
                    onChange={(e) => handleChange("delivery", "clientLocation", e.target.value)}
                    placeholder="Ex: Paris, France"
                    className="border-2 focus:border-pink-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="deliveryNotes" className="flex items-center gap-2 font-semibold">
                    📝 Notes de livraison
                  </Label>
                  <Textarea
                    id="deliveryNotes"
                    value={formData.delivery?.notes || ""}
                    onChange={(e) => handleChange("delivery", "notes", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                    placeholder="Instructions spéciales, observations..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Lot Selector */}
        {showLotSelector && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Package className="h-6 w-6" />
                Gestion des lots multiples
              </CardTitle>
              <p className="text-gray-600">
                Sélectionnez un lot existant ou créez-en un nouveau. Les lots sont sauvegardés globalement et accessibles à tous les utilisateurs.
              </p>
            </CardHeader>
            <CardContent>
              <MultiLotSelector
                selectedLot={selectedLot}
                onLotSelect={handleLotSelect}
                onNewLot={handleNewLot}
              />
            </CardContent>
          </Card>
        )}

        {/* Show lot management buttons when a lot is selected */}
        {!showLotSelector && (
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setShowLotSelector(true)}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Changer de lot
              </Button>
              {selectedLot && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>Lot: {selectedLot.lotNumber || selectedLot.harvest?.lotNumber}</span>
                  {selectedLot.globallyAccessible && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Globe className="h-3 w-3" />
                      <span className="text-xs">Global</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedLot && selectedLot.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Lot terminé</span>
              </div>
            )}
          </div>
        )}

        {!showLotSelector && (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                🥑 <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  {selectedLot ? 'Continuer le Suivi' : 'Nouveau Suivi d\'Avocats'}
                </span>
              </h1>
              <p className="text-gray-600 text-lg">
                {selectedLot 
                  ? `Continuez le suivi du lot ${selectedLot.lotNumber || selectedLot.harvest?.lotNumber}`
                  : 'Suivez le parcours de vos avocats de la ferme à la livraison'
                }
              </p>
            </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Progression du suivi</h3>
            <span className="text-sm font-medium text-gray-600">
              {getStepCompletionPercentage()}% complété
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / 7) * 100}%` }}
            ></div>
          </div>

          {/* Step Navigator */}
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <button
                key={step}
                onClick={() => goToStep(step)}
                className={`p-3 rounded-lg text-center transition-all duration-200 ${currentStep === step
                  ? 'bg-blue-500 text-white shadow-lg scale-105'
                  : formData.completedSteps?.includes(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
              >
                <div className="text-lg mb-1">{stepIcons[step]}</div>
                <div className="text-xs font-medium">{stepTitles[step]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-600">{error}</AlertDescription>
          </Alert>
        )}

        {/* Auto-save Status */}
        {(isSavingDraft || lastSaved) && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Clock className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              {isSavingDraft ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sauvegarde en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Dernière sauvegarde: {lastSaved ? new Date(lastSaved).toLocaleTimeString() : 'Jamais'}</span>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-8 border-t">
            <Button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('newEntry.previous')}
            </Button>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => saveDraft()}
                disabled={isSavingDraft}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isSavingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('newEntry.saveDraft')}
              </Button>

              {currentStep < 7 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!validateCurrentStep()}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
                >
                  {t('newEntry.next')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !validateCurrentStep()}
                    className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {isSubmitting ? t('newEntry.saving') : t('newEntry.finalize')}
                  </Button>
                  
                  {selectedLot && selectedLot.id && (
                    <Button
                      type="button"
                      onClick={forceCompleteLot}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Globe className="h-4 w-4" />
                      )}
                      Finaliser le suivi complet
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Validation Alert */}
        {!validateCurrentStep() && (
          <Alert className="mt-4 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('newEntry.validationMessage')}
            </AlertDescription>
          </Alert>
        )}
          </>
        )}
      </div>
    </div>
  );
}