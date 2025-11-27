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
        setError("Erreur lors du chargement des donnÃ©es");
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
    console.log("ğŸ‰ " + message);
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
        toast("Brouillon sauvegardÃ© - Vos modifications ont Ã©tÃ© sauvegardÃ©es.");
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
        
        toast("Lot finalisÃ© ! Le lot a Ã©tÃ© marquÃ© comme 100% complÃ©tÃ© et archivÃ©.");
        
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
        toast("Lot mis Ã  jour - Le lot hÃ©ritÃ© a Ã©tÃ© mis Ã  jour avec les derniÃ¨res informations.");
        setLocation('/lots');
      } else if (selectedLot && selectedLot.id) {
        // Complete the lot if all steps are done
        const allStepsCompleted = formData.completedSteps?.length === 7;
        
        if (allStepsCompleted) {
          await completeLot(selectedLot.id);
          toast("Lot terminÃ©! Le lot a Ã©tÃ© marquÃ© comme terminÃ© et sera archivÃ©.");
          // Navigate to lots page
          setLocation('/lots');
        } else {
          // Update the lot with current progress
          const { id, createdAt, updatedAt, ...updateData } = formData;
          await updateLot(selectedLot.id, {
            ...updateData,
            status: 'in-progress'
          });
          toast("Lot mis Ã  jour - Le lot a Ã©tÃ© mis Ã  jour avec les derniÃ¨res informations.");
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
        
        toast("Ã‰tape mise Ã  jour - Les donnÃ©es de l'Ã©tape ont Ã©tÃ© sauvegardÃ©es.");
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
          toast("Lot complÃ©tÃ© ! Le lot a Ã©tÃ© automatiquement complÃ©tÃ© et archivÃ©.");
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
    1: "ğŸŒ±",
    2: "ğŸš›",
    3: "ğŸ­",
    4: "ğŸ“¦",
    5: "ğŸª",
    6: "ğŸš¢",
    7: "ğŸ“"
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
                <span className="text-2xl">ğŸŒ±</span>
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
                    ğŸ“… {t('newEntry.harvestDate')} <span className="text-red-500">*</span>
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
                    ğŸ¡ {t('newEntry.farm')}
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
                    ğŸ‘¨â€ğŸŒ¾ {t('newEntry.agronomistId')} <span className="text-red-500">*</span>
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
                    ğŸ·ï¸ {t('newEntry.lotId')} <span className="text-red-500">*</span>
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
                    ğŸ¥‘ {t('newEntry.avocadoType')}
                  </Label>
                  <Select
                    value={formData.harvest?.avocadoType || ""}
                    onValueChange={(value) => handleChange("harvest", "avocadoType", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conventionnel">ğŸŒ± Conventionnel</SelectItem>
                      <SelectItem value="bio">ğŸŒ¿ Bio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variety" className="flex items-center gap-2 font-semibold">
                    ğŸŒ³ {t('newEntry.variety')}
                  </Label>
                  <Select
                    value={formData.harvest?.variety || "hass"}
                    onValueChange={(value) => handleChange("harvest", "variety", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.selectVariety')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hass">ğŸ¥‘ Hass</SelectItem>
                      <SelectItem value="fuerte">ğŸŒ¿ Fuerte</SelectItem>
                      <SelectItem value="bacon">ğŸ¥“ Bacon</SelectItem>
                      <SelectItem value="zutano">ğŸŒ± Zutano</SelectItem>
                      <SelectItem value="other">â“ Autre</SelectItem>
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
                <span className="text-2xl">ğŸš›</span>
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
                    ğŸ¢ SociÃ©tÃ© de transport <span className="text-red-500">*</span>
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
                    ğŸ‘¨â€ğŸ’¼ Nom du chauffeur <span className="text-red-500">*</span>
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
                    ğŸšš ID du vÃ©hicule
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
                          Ø¹
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
                    ğŸŒ¡ï¸ TempÃ©rature (Â°C)
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
                    ğŸ• Date et heure de dÃ©part
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
                    ğŸ•‘ Date et heure d'arrivÃ©e
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
                <span className="text-2xl">ğŸ­</span>
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
                    ğŸ“… Date de tri <span className="text-red-500">*</span>
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
                    â­ {t('newEntry.qualityGrade')} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.sorting?.qualityGrade || "A"}
                    onValueChange={(value) => handleChange("sorting", "qualityGrade", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-purple-500">
                      <SelectValue placeholder={t('newEntry.selectGrade')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">ğŸŒŸ Grade A - Premium</SelectItem>
                      <SelectItem value="B">â­ Grade B - Standard</SelectItem>
                      <SelectItem value="C">âœ¨ Grade C - Ã‰conomique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rejectedCount" className="flex items-center gap-2 font-semibold">
                    âŒ Avocats rejetÃ©s
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
                    ğŸ“ {t('newEntry.observations')}
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
                <span className="text-2xl">ğŸ“¦</span>
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
                    ğŸ“… Date d'emballage <span className="text-red-500">*</span>
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
                    ğŸ“¦ ID de la boÃ®te <span className="text-red-500">*</span>
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
                    âš–ï¸ Poids net de la boÃ®te <span className="text-red-500">*</span>
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
                    ğŸ“¦ NumÃ©ro de palette <span className="text-red-500">*</span>
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
                    ğŸ“¦ Type d'emballage <span className="text-red-500">*</span>
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
                    ğŸ“ Calibres
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
                <span className="text-2xl">ğŸª</span>
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
                    ğŸ“… Date d'entrÃ©e <span className="text-red-500">*</span>
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
                    ğŸ“… Date de sortie
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
                    ğŸŒ¡ï¸ TempÃ©rature (Â°C)
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
                    ğŸ¢ EntrepÃ´t de stockage <span className="text-red-500">*</span>
                  </Label>
                  {warehouseLoading ? (
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                      <span className="text-sm text-gray-600">Chargement des entrepÃ´ts...</span>
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
                      <option value="">SÃ©lectionner un entrepÃ´t</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.nom} - {warehouse.localisation}
                          {warehouse.capaciteTotale && ` (CapacitÃ©: ${warehouse.capaciteTotale} tonnes)`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {formData.storage?.warehouseId && (
                  <div className="space-y-2">
                    <Label htmlFor="storageRoomId" className="flex items-center gap-2 font-semibold">
                      ğŸ  Salle de stockage <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={formData.storage?.storageRoomId || ""}
                      onChange={(e) => handleChange("storage", "storageRoomId", e.target.value)}
                      className="w-full p-3 border-2 rounded-lg focus:border-indigo-500 transition-colors"
                      required
                    >
                      <option value="">SÃ©lectionner une salle</option>
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
                            {salle.capacite && ` (CapacitÃ©: ${salle.capacite} tonnes)`}
                            {salle.temperature && ` - ${salle.temperature}Â°C`}
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
                <span className="text-2xl">ğŸš¢</span>
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
                    ğŸ“… Date de chargement <span className="text-red-500">*</span>
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
                    ğŸ—³ï¸ ID du conteneur <span className="text-red-500">*</span>
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
                    ğŸ‘¨â€ğŸ’¼ Nom du chauffeur
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
                    ğŸš› ID du vÃ©hicule
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
                    ğŸŒ Destination
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
                <span className="text-2xl">ğŸ“</span>
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
                    ğŸ“… Date de livraison estimÃ©e <span className="text-red-500">*</span>
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
                    âœ… Date de livraison rÃ©elle
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
                    ğŸ¢ Nom du client <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    value={formData.delivery?.clientName || ""}
                    onChange={(e) => handleChange("delivery", "clientName", e.target.value)}
                    placeholder="Ex: SuperMarchÃ© Bio SA"
                    className="border-2 focus:border-pink-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientLocation" className="flex items-center gap-2 font-semibold">
                    ğŸ“ Lieu de livraison
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
                    ğŸ“ Notes de livraison
                  </Label>
                  <Textarea
                    id="deliveryNotes"
                    value={formData.delivery?.notes || ""}
                    onChange={(e) => handleChange("delivery", "notes", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                    placeholder="Instructions spÃ©ciales, observations..."
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
                ¨ƒx‹Å0‰[Şl¨$C”ŒH–p‹
ÒR2LˆĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+K­ªÂîù·®ûótz¼ü†}õC£††]6Œ›‹”¨‚Ô%â%Ø\…š ìñz²{kAÑØ£ë8ù¯öJÊ•šÂ~ãğ6M2)¸t`W§áE÷Œİú%ì\°¨!_Uª}@Şç¿÷Hè\E6p	G¡<Å¿3CÎN«^˜“ÕM Òíz?»İG„­vÂNM‰ú2`üØ‚aKpÉöæiØâäÏ•ˆø3kà6K=#±)Sá½g—ë—˜­Y%mjT<Í.¢ Öp<S®SUÆ,;¶™«í$,q1Tír|ÊPŠÇce¹#r&ªıhÁÙgäûR<N.#©ÒsZG‡wºG|Å+˜Q¤ãõì{¥
àvòPÁ[äëöhÕµØòËuX¥5dĞc!êKÒHAcÑ>¢¦YÏ´<Æ)>o˜cĞÖJµäø¬¬bnp
œæP0÷«ç2ŠFÂúñø»^“º±L¢‹+(l·j;z|æ’Ğ¤BOc9¥]N÷\x2))ÒSPWš(Ì¿YÚ± ›æŒª‡	>p×›ŸÔ¡êëßÍg¬q°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡Ïç¡Tà(ÏZë0–—Ôºá6RªÍ'yïÓó £#FyÍŠsTß¤ ËÔåL€’`-8ñi´ü&;²¥ë—½V	‰<—MCÁfE‰Ú¢uİ%ÊüÄ–*¦¾5-8\áâ3iSà9·äŒÓt*ØÕŒÄz­èr&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™¸Õ»ÈáÇåç)"qFREÏ–«Vx+¿„çİùàúĞ²=tí‚‘–ËÕØqg›€TR–Ï¢¯ÃÑ’/Ëé  !¶ ô†÷Ü‰¦	U1èî“1©»Íª”°óŞ®¯Îô;5§ÁÅOSÚ#$æG¿ˆìxÕ õgù-}­\c’Q6C¹*;/ŒßâìvãÚ
õ…Sí³fBe<Ôæ£?—Š‰nÎòKÓ’"SŞwº"tßX©-pÌ(©=•Mq=–|ûB—°‘Ò€¢K't|xùüÛ!ApTe Ì…ê3öSÙ½'^	²²	‘yÀ fxL˜vØÁmaĞp2ŸçÄ¨ëRlG¿”~Û¯à‹Ä¸›¼~&SZì3½ª•QÅüî2º_…S¯æsvGÔosâj0ìãÂªc”UÈ!4çFÙŞ#è¦0êÎÀ„şÅxLâ’¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ƒG1mBKŒ˜mU‰]=„¯¢ì6U¹`¡7t§‘tUÀúgtaî¦ËlÑ'î¦"í*,€â-ş!û#;¶JKY6ü‘' ï•óùo+•œ(0*ë‡ÙTƒ	‡İÛ¦<·`±v?ŠYªØã%ö&x¬2¡ëŞŒ¢Ñ½äC2îK’Ğ“éZ±k¿P½£Ûœ¤÷ ÜÜî–
 ƒ§üôÔ_~7¥C„ÊMËƒa†?U¾†w¥/Û¥Ró~3}¹ïtS¾rÚQTËÂ€Ä‘ìò»ŠpPÿğ¤›Ì„|„
(”v–uÙ+„èÖuÛg}’±w»	õŸ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qó;ã`¹ÊL2zUîg¢®%#¨âu™çá È4¬¨4²˜·–ô
ÅYnÅ,š'¿Û,Q¶s‚^ A)-§–EfÀ2.Vg¡;Ş©h‰o±ÇŠ)|úqY?D»±7Ïö(ŠAXÖ„avüÖ U§ÅÎ(Ì‚t|ƒ…Ê(Í¤Lí"IQ% ±$&Ïî›´”Ó“ÛÆ &z.WŸ@ğ>ûÙL9şÌ?_L¿êOğøûÜ¨¾Îº¿\Œ«>T»¼¿øOö#•¿‰Ne	ôHëÏNO‹‚È	E@0ëÇ.§ôÿî$»®Ã»Ş³yùòµ\ç~S¦ª	ö•Û¿:¾mKŸÒ #HI‰/¹ì&6faòè3ëÜ¼º Ó>ÿáöë¿hà›ñ{´ŒX4äŠ›#ÆøéIşr·£Ï^®ó‚ñG…İ)jqÃñï
5¹â>øú^ü6¾\‹¾ætL[RqVx‚ÅíTöNP%¶%œé`½Î$k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ğ¸»ÅÁ[|Èî)sœ+¦gI	IÁˆ8y•-Dæ] û(IÑ=}­bwö9bÿúo{«Ä–ê0ÇÍ¹¹/ö¯ïœ2ÑxK½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÙ>¼N#Ù½Ø¤©Îâwê™lAlå“{lò;kÜCÚ©‚`¬òÕ€%×—‡Ò€@§VY[l¥_ÃsûécA7µãÈ¦¨y*¨jù$'ËÄ¸ÔÃ`›—\Saq·”“Ğs›©ˆ·û}Ûõoz?­O–Ns	·¹Ém)x™íFDU Qû¡ù¬.Ø¼“i´»N˜ŠLïğÛÒì­¤y–LÑ s97ZDœ†s½#ææT½ˆ÷Ğ{Õıù=¨ı	H}ª™ß`¼É¶×­·æ ÏoÇŸîsñúœø–·]$£=FØ’yd£ [Ğ÷¦YÖA™
ñ:9ïÅ&³ZèfÀÁBê&°}(¾`½µN{äÁ÷Ù69+a&Ü†áW}ÍÀ[=tü”Ş/¹ûMª~¡Ïä3¿I|Q<iI-?‡¯¹G.O*Š ¸§Uu`FGí j=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖA'™+cµZYºÏ(±Y,[šFXÆ.+¢”v=öî[Â… ½<ƒ.có\åy´ä<†lBYÈÉILÑ+’f{:|2cê"¼Ìm)› ‚Öşb_oÃMºGÌÏl" Óÿï-2­dúù·Å×Ûfè• ŒıXÙå1LÈ!QkT‘’¾"v{¤Ö8/M­’gĞÖ
A*Og¬Ø,½ÃNk+Ü™–‘"ËëÏ³îJäÿ±z¯’“ª1nóÈ0ìdV*ûo$Ú¢Á‡mİFz½ VI9Q¶ii2áwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍ1¨aÛ£¤€½ÛX7áTqƒ»>°¿iV¨ ˆS_fÚEì(Ş¯àÅ~şÏíYÎrÎÍ„²œš‰0 ×.×°ÎÓlÆ!æyÍºqXÚ ¨ÄG1ïÊÊbtXñ6û¾Šf>¡5n¸™ò8½UÒ`o’‡ú(#u/øİ…@=Áÿì]*Äaj7–éRûB	²dÉº’W£Ô–Æı’Æê,|êc²yy%´g®7S)ÚXkºŠË²$¶Ä™Ñ4ÀÊ§çÖ¼«(bb÷@€Ã¼¹Œ€ë¯A½ïÚõ´ºu­¬z@Ãˆ²ßÙ×ø¡EO›uªDŒÛ€ë£kPÙã+¤î„R\½ç570èÛğ±«¹„º @±ßØ'Ü´~6[§ôaìŠÑø&îd½\ôÙ{Õ¾ ò'ò<^aÖ¶R¶C»a9¿®Â9ğtò°Š]éUsìÔâ2Ig¸Äı@²WŠÁzÈQ{Óˆ²×r,bt–¡ç>İG*K€‡è]'[º„Ü³.Q×øXÓŸ«BTrúåuĞŞ%&¥ÕF€üÇârç+©’9¹¢O[±°“QšyĞu’TyÎÖu\™ee•p©«õä¬Ipÿa–®ÿÛà¡ôŞ—©ÁBéÎ˜6˜‰•ØĞ K~#?jgÁùë¢#õ6?4Å5t
sFlÃğïc­ÒF!<gª—RÚÏ#k®0¡+Ÿè¥µÏ)$>3°icĞLË¹|ûpªÎz%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_…'¼âş2±ëlà¨w¦ƒeoÈú­àáÌ.?¬oÁ#Î¦´ÅblÀà§Vip;ÂjJ”ßsøc~àïµóÓ2œf-™,ë•ÛšİÔ£xODş³<•F ¡²ö-=jµøá¥veİ¥0„êX¦÷xlÍB3Vkë9ÈèZCŸºR‡Ëîä§¤HŒŞ”2ãnúvÊ#åÅÄÆ|©¢†y]wîvõhqxö^ı†-N~]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¶qs+àèŸ÷×¸`%iS›ÈVŸ˜›X¹wëTBÙå*9äê·ğYë‰¸©r×#0¡¯C8¹gÌj\R”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*É'²c‹v)@n§³V.bb/V{…³1wË©ÈT³‡ª]h¶Ax±…¼oó³2xˆdX²ÁÁX§&5]c‚%\Tîb­B6«X…nÆºhA"fi-	%ı„}/Î`˜T”°0‡Úò"	fæq€p×ëì½
÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öOÙ>üÏúÛ¿ê¼ÁOÿ
uø³<ENÊKˆÈ™d@ûºú7şÆ=¿®M³ÿş„²û
ğú­{®^s*3BnËìÌ4µo_‚	RH @C:y*İ&"fšá·óÌ¸ªm[˜8‹ö‚ı´½øƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¾‹Ê‚ç ¹×éÏhú[¦î
!¸«ğû[ıÀ> ¢™Æôm8£ğ^X—µ-~Ò ÎÂeHuù`9“aªÛW’“"“D"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡ç½HœIK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‰ûŒ¤ê {«ù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d<¨	zôÍü®=cæK>˜³[ÀÇ«i„’­zLÉl¥DW’lÈ2;GíŞ’d†“×¡!_¢p]A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKï°‘g$Ú$¨ğÑpŸ•ß‘ak—–¡“êç¿Û?½:ø»ÔKK7©Yí0ù8ı)&›\	á©ûåÎşOôûÉ4­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÂR2LÈP%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑIeE0ì#.+O­ªÂîñ·®ÿótz¼ü–]ÕC£¦†İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz²{kAÑØ£ë8ù¯÷JÊ•šË~ã°6M2)¸t`×¦áE÷ŒÍú%ì\°ª)_Uª}@Şç¿÷Hè\Ep	G¡<…¿3CÎN«^˜“ÔM Òíz?ªİG„­vÂFM‰ú2düØ‚aKpÉöäiØâäÏ•ˆø3ià69#±)Sá½g—ë—˜­Y%mjV<Í.¢€Ôp<S®WUÆ,;¶™«í$$qTír|ÊPŠÇce¹#ò&*ıhÁùgäûR<^.+©ÒsZG‡wºG|Å+˜Q ãõì1z¥ŠàvòPÁ[ôëöhÕµØòËuX¤5dĞc!ÈKÒHAcÑ>¢¦YÏ”<Æ)>oØcĞÖNµäø¬¬bnr
œæP0÷ëç2ŠFÊûñø»^“º1L¢‹+(l÷j;zyæ’À¤BOc9¥]N÷\x2))ÒSRWš(ÌŸYÚ± ›æŒª‡>p×‹ßÔ¡êëßÉg¬p°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏÒë°–—Ôšá6RªÍ'xïÓÓ £#FyÍŠsTß¤ KÔÅl€’`-8ñk´ü&;²¥ë—½V)‹<—MCÁdE‰Ú¢uXİ%ÊüÄ–*¦¶5-8|áâ#iSà)·äŒÓ|*ØÕŒÄz­ér&Y1´(ï.1jˆÎ+—‚Ùê…´fˆ4™¸Õ»ÈáÇåç)"pFRE7Ï¶«x+¿„çİùàúĞ²=tí‚‘–Ë•ØqG›€TR–Ï¢¯ÓÑ’/Ëé" !² ô†÷Ü‰¦	U1èî“1©»Íª”°óŞ®¯Şô;4[§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}®\c’Q6C¹*;/Œßâävãú
õ…[íY³fReÔæ£?—Š‰nÎòKÓ’"SŞwº"tßX©-GpÌ
©-•Mq}”|ûB—°‘Ò€¢K't|xùüÛ ApTe ˆ•ê3öSù½'^	²ò	‘yÀ fxL˜tØÁmaĞp2›çÄ¨ë‚RlG¿”~Û¯à‹Ô¸›¼~&CZì3Š½€ª•QÅüî2ª_…S¯æsvGÔOsâj0íãÂªc–UÈ!4çFYŞ!h¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[~ ”ìØ…¨”gÂ—+ƒG1mBKŒ˜mU‰]=„/œ"ì6U¹`¡7v‘tUÀúgtaî¦ËlÑ'î¦&í*,¢â-ş!û#3öJKy2¼‘' ï•óùo+•œ(0*ë‡ÙTƒ	‡İÛ¦<·c±v?
YªØãö&|¬2±ëÜŒ¢Ñ½äC2îK’Ğ’éZ±k½P½#Óœ¤ó ÜÜî–
 ƒ§üÔÔ_~7¥C„ÊË£a†?U¾†w¥-Û¥Ró~;}¹otS¾rÚQTËÂ€Ä‘ìò;ŠpPßğ¤ÛÌÄ|„(”v–uÙ+„êÖuÛgm’±w»õŸ€“ÿQ/ëş0é5Î«4@¸ºñik‰Ş©ƒ{qã;ãa¹ÊL2zUîg¢®%#¨âu™ç È4¬¨4°˜·¶ô
ÅYnÄ,’'¿[,Q¶s‚^ A--§–EfÈ2.VgÍ¡;Ş©h‰o³ÃŠ)|øqY?D»±7Ïö(ŠEXŞ„avşÖ U§ÅÎ(Ì‚t|ƒ…Î,Í¥Lí"IY% ñ$Ïî›´Ó“ÛÆ "z.uŸ@ğ¾ûÜL=şÌ?_L¿êOğ¸ûÜ¨¾Îº¿\«6T»¼¿ùOöc— ¿™Fe	ôhëÏNN‹‚È‘	EA0ûÇ.‡ôûş$»®Ã»Ö³yùòµ\ç~S§ªöÕÛ¿:¾mKŸÒ #HI‰?¹ì&6faòè3ëÜ¼º Ó>ıáöë¿hà›á{´ŒX5äŠ›#ÆøéIşr·£Ï^®÷‚ñG…İ)jqÃñï
7¹ã>øúNü6¾\‹¾ætl[RqVx‚ÅíTvNP%6%œù`½Î$k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ö¸»„ÅÁ[|Éî)sEœ+¦f@	KÁˆ8y•-Dæ\ û(IÑ9}­bwö8bûúo{©Ä–ê0ÅÍ¹¹/ö¯Ïœ2Ñ8K½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÉ>½N#Ù½Øä©Î€âwÊlAlå“{lò;kŞCÚé‚`®öÕ€'××‡Ò€B§VYKm¥_ÃsûécA®7µãÈ¶¨y*¨bù$'ËÄ¸ÔÃ`›—\Saq·”“Ğs›©ˆ·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDE^ Qû¡ù¬.Ø¼“i´»N˜Ê1LïñœÛÒÌ­$¤y–LÑ s97ZTœ†s½#ææT½ˆ÷Ğ{Õıù=ªı	H}ª™ß`¸É¶×­·æÏoÇŸîsñúœø–·]$£=NØ’yd£ Ğ÷¦YÖA™
ñ:¹ïÅ&³zèfĞÁBê&°}(¾`½•N{äÁÿÙ6)+a&Ü†áW}ÍÀ[=tü”Ş/¹{Íª~¡Ïä3¿I|Q<iI3%?‡¯¹C.OªŠ ¸§Uu`FWm	j=ÕÔ×C,vÎle¬€têØ3 nØëÀ—×9kê·h°ósñ†ÖA'™+cµZšºÏ(±Y,[ŠFÆ,+¢ƒ–v=öîÛÂ…°½<ƒ.có\åy´ì<–lBYÈÉILÑ+’f{8|2cú"¼Ìm)› ‚Òşb_WoÃMºGÌÏl"àÓÿï)­dúù7Å×Ûfè• ¯ŒıXÙå1DÈ!QoT‘’¾"v{Å?$Ö</M¥’gĞÖAOg®Ø,½ÃNk+Ü™–±#Ë«Ï³îJäÿ±~¿—ª1nóÀ0ìdV(ûo$Ú¢Á‡mİF~½ VI9Q·ii2áwäaeÏïÛà”¹ôè
Ît¿?ËÜ·à€õÏÍuªaÛ£¤€¼ÛX7iTqƒ»>°¿iT¨ ˆS_fÚEì(Ş¯àÁ~şÏíÎpÎÍ„ œ™0 İn×²ÎÓlÆ!æiºqXÚ ¨ÅÇ1ïÊÊbtXñ6»¾‹f>¡5n¸™ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]*àaj7–éRûB²dÉº’W£Ô†Æı’Æê,|âb²yy%´e®7)ÊXkºŠ€Ë²$¶D™Ñ4ÀÊ§÷Ö¼«(bb÷@€Ã¼¹Œ€é¯A½ïÚõ´ºõ­¬z@Áˆ²ßÙ×ø¡EO›uªDÛ€ë£kP.Yã=+ î„R\½g57pèÛğ±«¹„º @±ßØ'Ü´~6[§ôaìŠÑø¦îd½\ôÙ{Õ¾ ò'ò<^aŞ¶P·C»!9¿¦‡Â9ğtò°Š]	ùUsìTâ"Ig¸ÄıD²WÊÁzÈQ{Óˆ²×r,bt–¡ã>İg*K€ƒè]'[º„Ü³.Q×øØÓ«BTzúåuĞŞ%&¥ÕF„üÇâr÷#©’¹¹¢o[± “Qšyu’TyLVu\™ee•ğ©£õä¬ipÿa–®ÿÛ ¡ôŞ—©ÁBéÎ˜4ˆ‰•ØĞ K~#?jgÁùë¢#õv>4Å5t
sFìÃğïc­ÒF!<g«—RÚÎ#k®0¡+Ÿà¥µÏ)$>3°iCĞLË¹|»pªÎz%ø¬…œáV.#Û£Çç­	ÒK’h×IW!_?…/¼âş3±éhà¨w¢“eoÈú­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öip;Âj
ßsøã~àï½óÓ2œg)™,ë•ÛİÔ£XOÄş³<µF€¡ºö-=j½Øá¡vuİ¥1„êX¦÷xlÍB7Vkë9ÈèZC¿ºV‡Ëîô§¤HˆÌ”2ãnú$6Ê#’åÅÆÆl©¢†}]wîvõhqxö^ı†-N~]ƒñÚÔTz¼É—lÍvÚzºx°ÛÄ´­œ‚ÜM¶qs# è÷×¸`%aS›KVŸ˜›Y¹wëTFÙå*9äê·ğY«‰¼©r×#0¡C0¹gÌj\P”ÃÖ/‡(æu>¿çÔsèÛ&åÁTqKe¿JÌY\hòÂ*É'²c‹v)@n§£V.bb/V{…³1wË©V³‡ª]h¶Ax1…¼oó³2xˆdX¢ÁÁX§&5]c‚%\Tîb­B6«X…nÆºhA"	fi-	%ı„}/Îd˜T”°0‡Şò"	fæq€ğßëì½÷şï¿Ê§ğûòõÿ/³»ÌÄ#<öÏÙ>üÏúÛ¿ê¼ÁOõ
õø³<ENÊC˜Èù$@ûºúşoö=¿.M³ÿş”²û
ğú{®^S*3BnËíÌ4µo_‚	RH @C:x*İ&"fšñ·óÌ¸ªmSš8‹ö’ı´½ø‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ıÀ>(¢™Æüm8£ğ^X—µ-~R ÎÂeHuù`9“áª›’“"“F"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹ú =xÄÛË4ğøã½ºÌòL´èŠ)s¨ª‡ç½H¼IK‹Û8¥9òM³8Ñ1}-œëw–_U¬ü?‹ûŒ¤j"{ëù@™ÍÆ{ïÜ€™8“©F.{Š×Ùl€¹« ŒƒØ&¶d8¨	zôÍ|®=cæK>˜·[ÀÅ«i„’­zLÉl¥dW’lÈ2;GíŞd†“×!_‚p}A‚–	%4{h«G1î™kÁ/´§Ü¶)IKÏ°g$Ú$¨ğÓpŸ•ß‘ak–¡“jç¿Û>½zø»ÔKÁK7¹Yí0¹8İ)f›\	ã©ûåÎöOôûÉ4­Gªƒx‹Å0‰[Şl($œŒH–p‹
ÒR2LˆĞ%6%"dÆ µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü–}õC£††İ6Œ›‹”¨‚Ü%â%Ø\…š(ìñz2{kAÑØ¢ë8ù¯×JÊ•šÂ~ãğ&Í2)¸t`×§á÷Œİú%è\°¨)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎNë^˜“ÕM Òíz?ºİW„­vÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3ià69#±)Sá½g—ë·˜­Y%ljV<Í.¢ Ôp<S®SUÆ,;¶™«­$,q3Tír|ÊPŠÇce¹#r&*ıhÁùgäûR<N.#©ÒsZG‡wºG|Å+˜Q¤ãõì1{¥àvòTÁ[ôëöiÕµØòËuX¥5dĞc!ÊIÒÈAcÑ>¢¦ÙÇ”<Æƒ)>_o˜cĞÖNµäø¬¬`nr
œÆP2÷ëç2ŠFÊûñø»^“º±Lâ‹+(n÷j;zyæ’À¤BOc9¥]N÷\x2))ÂSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëÏÉg¬q°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿aó