import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import iconUrl from '../../../assets/icon.png';
import {
  archiveEmballageLot,
  deleteEmballageArchive,
  getEmballageArchives,
  renameEmballageArchive,
  saveEmballageLot,
} from '@/lib/emballagesService';

// Mock services - in real app these would be imported
const mockLotService = {
  lots: [] as any[],
  subscribe: (callback: (lots: any[]) => void) => {
    callback(mockLotService.lots);
    return () => {};
  },
  add: async (lot: any) => {
    const newLot = { ...lot, id: `lot-${Date.now()}` };
    mockLotService.lots.push(newLot);
    return newLot.id as string;
  },
  update: async (id: string, updates: any) => {
    const index = mockLotService.lots.findIndex((l) => l.id === id);
    if (index !== -1) {
      mockLotService.lots[index] = { ...mockLotService.lots[index], ...updates };
    }
  },
  delete: async (id: string) => {
    mockLotService.lots = mockLotService.lots.filter((l) => l.id !== id);
  },
};

const mockArchiveService = {
  archives: [] as any[],
  subscribe: (callback: (archives: any[]) => void, _errorCallback?: (error: any) => void) => {
    callback(mockArchiveService.archives);
    return () => {};
  },
  add: async (archive: any) => {
    const newArchive = {
      ...archive,
      id: `archive-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockArchiveService.archives.push(newArchive);
  },
  update: async (id: string, updates: any) => {
    const index = mockArchiveService.archives.findIndex((a) => a.id === id);
    if (index !== -1) {
      mockArchiveService.archives[index] = {
        ...mockArchiveService.archives[index],
        ...updates,
        updatedAt: new Date(),
      };
    }
  },
  delete: async (id: string) => {
    mockArchiveService.archives = mockArchiveService.archives.filter((a) => a.id !== id);
  },
};

// Data model for packaging traceability
interface EmballageRow {
  dateConditionnement: string; // Date de conditionnement
  produit: string; // Produit
  typeEmballage: string; // Type d'emballage utilisé
  numeroLot: string; // N° de lot
  quantite: string; // Quantité
  fournisseur: string; // Fournisseur
}

interface EmballageFormData {
  header: {
    code: string; // SMQ.ENR07
    version: string; // Version 01
    date: string; // Date creation
    responsableEmballage: string; // Responsable emballage
    responsableQualite: string; // Responsable qualité
  };
  rows: EmballageRow[];
}

const defaultEmballageForm = (): EmballageFormData => ({
  header: {
    code: 'SMQ.ENR07',
    version: '01',
    date: '01/07/2023',
    responsableEmballage: '',
    responsableQualite: '',
  },
  rows: Array.from({ length: 26 }, () => ({
    dateConditionnement: '',
    produit: '',
    typeEmballage: '',
    numeroLot: '',
    quantite: '',
    fournisseur: '',
  })),
});

const SuiviEmballages: React.FC = () => {
  const [lots, setLots] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [currentLotId, setCurrentLotId] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const { toast } = useToast();

  // Helpers for date normalization
  const toISODate = (val?: string) => {
    if (!val) return '';
    if (val.includes('-')) return val; // already yyyy-MM-dd
    if (val.includes('/')) {
      const [dd, mm, yyyy] = val.split('/');
      if (yyyy && mm && dd) return `${yyyy.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return '';
  };

  // Only emballage lots
  const emballageLots = useMemo(() => lots.filter((l) => l.type === 'emballages'), [lots]);

  // Convert SharedLot to local model
  const sharedToLocal = (sl: any): EmballageFormData => {
    return sl.emballageData || defaultEmballageForm();
  };

  const getCurrentLot = () => emballageLots.find((l) => l.id === currentLotId);
  const getCurrentForm = (): EmballageFormData => {
    const lot = getCurrentLot();
    if (!lot) return defaultEmballageForm();
    const data = sharedToLocal(lot);
    const def = defaultEmballageForm();
    return {
      header: { ...def.header, ...data.header },
      rows: data.rows?.length ? data.rows : def.rows,
    };
  };

  const createNewLot = async (): Promise<string> => {
    const form = defaultEmballageForm();
    const lotNumber = `Emballages ${emballageLots.length + 1}`;
    const newId = await mockLotService.add({
      lotNumber,
      status: 'brouillon',
      type: 'emballages',
      emballageData: form,
    });
  // Sync local state since mock service doesn't push updates
  setLots([...mockLotService.lots]);
    setCurrentLotId(newId);
    return newId;
  };

  const duplicateLot = async (lotId: string) => {
    const lot = emballageLots.find((l) => l.id === lotId);
    if (!lot) return;
    const newId = await mockLotService.add({
      lotNumber: `${lot.lotNumber} (Copie)`,
      status: lot.status,
      type: 'emballages',
      emballageData: sharedToLocal(lot),
    });
  setLots([...mockLotService.lots]);
    setCurrentLotId(newId);
  };

  const removeLot = async (lotId: string) => {
    if (emballageLots.length <= 1) {
      toast({ title: 'Action non autorisée', description: 'Vous ne pouvez pas supprimer le dernier lot.' });
      return;
    }
    if (window.confirm('Supprimer ce lot ?')) {
      await mockLotService.delete(lotId);
  setLots([...mockLotService.lots]);
      const remaining = emballageLots.filter((l) => l.id !== lotId);
      setCurrentLotId(remaining[0]?.id || '');
      toast({ title: 'Lot supprimé', description: 'Le lot a été supprimé.' });
    }
  };

  const updateForm = async (updates: Partial<EmballageFormData>) => {
    if (!currentLotId) return;
    const current = getCurrentForm();
    const next: EmballageFormData = {
      header: { ...current.header, ...(updates.header || {}) },
      rows: updates.rows || current.rows,
    };
    await mockLotService.update(currentLotId, { emballageData: next });
  setLots((prev) => prev.map((l) => (l.id === currentLotId ? { ...l, emballageData: next } : l)));
  };

  // Mock subscriptions
  useEffect(() => {
    const unsubLots = mockLotService.subscribe(setLots);
    // Fetch archives from backend
    (async () => {
      try {
        const items = await getEmballageArchives();
        setArchives(items);
      } catch (e) {
        console.error('Erreur de chargement des archives', e);
      }
    })();

    // Create initial lot if none exists
    if (emballageLots.length === 0) {
      createNewLot();
    }

    return () => {
      unsubLots();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToArchive = async () => {
    setIsArchiving(true);
    try {
      const form = getCurrentForm();
      const lot = getCurrentLot();
      const lotNumber = lot?.lotNumber || `Emballages ${new Date().toISOString()}`;
      const id = await archiveEmballageLot({
        id: lot?.id,
        lotNumber,
        status: lot?.status || 'termine',
        emballageData: form,
        archived: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      setSelectedArchiveId(id);
      const items = await getEmballageArchives();
      setArchives(items);
      toast({ title: 'Archivé', description: 'Fiche emballages archivée avec succès.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: "Erreur lors de l'archivage.", variant: 'destructive' as any });
    } finally {
      setIsArchiving(false);
    }
  };

  const loadArchive = async (archive: any) => {
    let targetId = currentLotId;
    if (!targetId) {
      targetId = await createNewLot();
    }
    if (!targetId) return;
    await mockLotService.update(targetId, { emballageData: archive.emballageData || archive.data });
    setLots((prev) => prev.map((l) => (l.id === targetId ? { ...l, emballageData: archive.emballageData || archive.data } : l)));
    setSelectedArchiveId(archive.id);
  toast({ title: 'Archive chargée', description: "Archive chargée dans l'éditeur." });
  };

  const updateArchiveFromEditor = async () => {
    if (!selectedArchiveId) {
      toast({ title: 'Aucune archive', description: 'Sélectionnez une archive avant de mettre à jour.' });
      return;
    }
    const form = getCurrentForm();
    await saveEmballageLot({
      id: selectedArchiveId,
      lotNumber: getCurrentLot()?.lotNumber || 'Emballages',
      status: getCurrentLot()?.status || 'termine',
      emballageData: form,
      archived: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    const items = await getEmballageArchives();
    setArchives(items);
    toast({ title: 'Archive mise à jour', description: 'Les données ont été enregistrées.' });
  };

  const deleteArchive = async (id: string) => {
  if (!window.confirm('Supprimer cette archive ?')) return;
    await deleteEmballageArchive(id);
    const items = await getEmballageArchives();
    setArchives(items);
  toast({ title: 'Archive supprimée', description: "L'archive a été supprimée." });
  };

  const saveWorking = async () => {
    if (!currentLotId) {
      toast({ title: 'Aucun lot', description: 'Veuillez sélectionner un lot.' });
      return;
    }
    const data = getCurrentForm();
    await mockLotService.update(currentLotId, { emballageData: data });
    setLots((prev) => prev.map((l) => (l.id === currentLotId ? { ...l, emballageData: data } : l)));
    const lot = getCurrentLot();
    // Persist draft save to backend as non-archived
    await saveEmballageLot({
      id: lot?.id,
      lotNumber: lot?.lotNumber || `Emballages ${new Date().toISOString()}`,
      status: lot?.status || 'brouillon',
      emballageData: data,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    toast({ title: 'Enregistré', description: 'Données enregistrées dans le lot courant.' });
  };

  const generatePDF = async () => {
    const form = getCurrentForm();
    const lot = getCurrentLot();

    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('p', 'mm', 'a4');

  const pageWidth = 210;
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;

    // Colors
    const colors = {
      headerGreen: [101, 174, 73] as const,
      lightGreen: [200, 230, 201] as const,
      border: [0, 0, 0] as const,
      text: [0, 0, 0] as const,
      white: [255, 255, 255] as const,
    };

    const drawRect = (x: number, y: number, w: number, h: number, fill?: readonly number[], lineWidth = 0.3) => {
      doc.setLineWidth(lineWidth);
      if (fill) {
        doc.setFillColor(fill[0], fill[1], fill[2]);
      }
      doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      doc.rect(x, y, w, h, fill ? 'FD' : 'S');
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      size: number,
      bold: boolean = false,
      color: readonly [number, number, number] = colors.text
    ) => {
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(text, x, y);
    };

    let y = margin;

    const fmtDate = (iso?: string) => {
      if (!iso) return '';
      const [yyyy, mm, dd] = iso.split('-');
      if (!yyyy || !mm || !dd) return iso;
      return `${dd}/${mm}/${yyyy}`;
    };

  // Title section (compact) with logo
  const titleH = 16;
  drawRect(margin, y, contentWidth, titleH, colors.headerGreen);
  try {
    // Load logo image
  const img = await fetch(iconUrl).then(r => r.blob());
    const reader = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(img);
    });
    // Draw logo on the left
    const logoW = 20; const logoH = 8;
    doc.addImage(reader, 'PNG', margin + 3, y + 4, logoW, logoH);
  } catch {}
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11.5);
  doc.text('SUIVI DE LA TRAÇABILITÉ DES EMBALLAGES', margin + contentWidth / 2, y + 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Fruits For You', margin + contentWidth - 35, y + 6);

  y += titleH + 3;

  // Document info section (compact)
  const infoH = 14;
  drawRect(margin, y, contentWidth, infoH, colors.white);
  drawText(`${form.header.code}`, margin + 4, y + 6, 9, true);
  drawText(`Version ${form.header.version}`, margin + 4, y + 11, 8);
  drawText('Page 1 sur 1', margin + contentWidth / 2, y + 11, 8);
  drawText('SYSTÈME DE MANAGEMENT DE LA QUALITÉ', margin + contentWidth - 85, y + 6, 7.5);
  drawText(form.header.date, margin + contentWidth - 28, y + 11, 8);

  y += infoH + 3;

  // Responsables section (compact)
  const respH = 10;
  drawRect(margin, y, contentWidth, respH, colors.white);
  drawText('Responsable emballage :', margin + 4, y + 7, 8.5, true);
  drawText(form.header.responsableEmballage || '', margin + 58, y + 7, 8.5);
  drawText('Responsable qualité :', margin + 118, y + 7, 8.5, true);
  drawText(form.header.responsableQualite || '', margin + 168, y + 7, 8.5);

  y += respH + 3;

    // Table headers
    const headers = [
      'Date de conditionnement',
      'Produit',
      "Type d'emballage utilisé",
      'N° de lot',
      'Quantité',
      'Fournisseur',
    ];
    const colWidths = [35, 30, 35, 25, 25, 40];

    const headerH = 14;
    drawRect(margin, y, contentWidth, headerH, colors.lightGreen);

    let x = margin;
    headers.forEach((header, i) => {
      if (i > 0) {
        doc.line(x, y, x, y + headerH);
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.text(header, x + colWidths[i] / 2, y + headerH / 2 + 2, { align: 'center' });
      x += colWidths[i];
    });

    y += headerH;

    // Table rows (compact height)
    const rowH = 9;
    for (let i = 0; i < 20; i++) {
      const row = form.rows[i];
      drawRect(margin, y, contentWidth, rowH, colors.white);

      let cx = margin;
      const values = [
        fmtDate(row?.dateConditionnement) || '',
        row?.produit || '',
        row?.typeEmballage || '',
        row?.numeroLot || '',
        row?.quantite || '',
        row?.fournisseur || '',
      ];

      values.forEach((value, j) => {
        if (j > 0) {
          doc.line(cx, y, cx, y + rowH);
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7.5);
        doc.text(String(value), cx + 2, y + rowH / 2 + 2.2);
        cx += colWidths[j];
      });
      y += rowH;
    }

    const fileName = `Suivi_Emballages_${(lot?.lotNumber || 'Lot').replace(/\s+/g, '_')}_${format(
      new Date(),
      'yyyyMMdd_HHmm'
    )}.pdf`;
    doc.save(fileName);
  };

  // Auto-select first lot
  useEffect(() => {
    if (!currentLotId && emballageLots.length) {
      setCurrentLotId(emballageLots[0].id);
    }
  }, [emballageLots, currentLotId]);

  const form = getCurrentForm();

  return (
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl">
        {/* Header Controls */}
        <div className="bg-white border-b p-4 shadow-sm rounded-t-xl">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Suivi de la Traçabilité des Emballages - Multi-lots</h1>
            <div className="flex gap-3">
              <button
                onClick={createNewLot}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
              >
                <Plus size={20} /> Nouveau Lot
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {emballageLots.map((lot) => (
              <div key={lot.id} className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => setCurrentLotId(lot.id)}
                  className={`px-4 py-2 flex items-center gap-2 transition-all ${
                    currentLotId === lot.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package size={16} />
                  {lot.lotNumber}
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      lot.status === 'termine'
                        ? 'bg-green-200 text-green-800'
                        : lot.status === 'en_cours'
                        ? 'bg-yellow-200 text-yellow-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {lot.status}
                  </span>
                </button>
                <div className="flex">
                  <button
                    onClick={() => duplicateLot(lot.id)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                    title="Dupliquer"
                  >
                    <Copy size={16} />
                  </button>
                  {emballageLots.length > 1 && (
                    <button
                      onClick={() => removeLot(lot.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form matching the packaging traceability PDF layout */}
        <div className="p-6">
          {/* Title section */}
          <div className="bg-green-600 text-white text-center py-3 rounded-lg mb-6">
            <h2 className="text-xl font-bold">SUIVI DE LA TRAÇABILITÉ DES EMBALLAGES</h2>
          </div>

          {/* Document info section */}
          <div className="border-2 border-gray-400 mb-4 p-4 bg-gray-50">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.header.code}
                    onChange={(e) => updateForm({ header: { ...form.header, code: e.target.value } })}
                    className="border-0 bg-transparent focus:outline-none font-bold text-lg w-24"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Version</span>
                  <input
                    type="text"
                    value={form.header.version}
                    onChange={(e) => updateForm({ header: { ...form.header, version: e.target.value } })}
                    className="border-0 bg-transparent focus:outline-none font-bold w-8"
                  />
                </div>
                <div className="text-sm">Page 1 sur 1</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">SYSTÈME DE MANAGEMENT DE LA QUALITÉ</div>
                <input
                  type="text"
                  value={form.header.date}
                  onChange={(e) => updateForm({ header: { ...form.header, date: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none text-sm mt-2"
                />
              </div>
            </div>
          </div>

          {/* Responsables section */}
          <div className="border-2 border-gray-400 mb-6 p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold">Responsable emballage :</span>
                <input
                  type="text"
                  value={form.header.responsableEmballage}
                  onChange={(e) => updateForm({ header: { ...form.header, responsableEmballage: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                  style={{ minWidth: '150px' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Responsable qualité :</span>
                <input
                  type="text"
                  value={form.header.responsableQualite}
                  onChange={(e) => updateForm({ header: { ...form.header, responsableQualite: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                  style={{ minWidth: '150px' }}
                />
              </div>
            </div>
          </div>

          {/* Table for packaging data */}
          <div className="border-2 border-gray-400 mb-6">
            {/* Table header */}
            <div className="flex bg-green-100 border-b border-gray-400">
              <div className="w-40 p-3 border-r border-gray-400 text-center">
                <div className="text-sm font-bold leading-tight">Date de<br />conditionnement</div>
              </div>
              <div className="w-32 p-3 border-r border-gray-400 text-center">
                <div className="text-sm font-bold">Produit</div>
              </div>
              <div className="w-40 p-3 border-r border-gray-400 text-center">
                <div className="text-sm font-bold leading-tight">Type<br />d'emballage<br />utilisé</div>
              </div>
              <div className="w-28 p-3 border-r border-gray-400 text-center">
                <div className="text-sm font-bold">N° de lot</div>
              </div>
              <div className="w-28 p-3 border-r border-gray-400 text-center">
                <div className="text-sm font-bold">Quantité</div>
              </div>
              <div className="w-44 p-3 text-center">
                <div className="text-sm font-bold">Fournisseur</div>
              </div>
            </div>

            {/* Table rows */}
            {form.rows.map((row, index) => (
              <div key={index} className="flex border-b border-gray-400 hover:bg-gray-50">
                <div className="w-40 border-r border-gray-400">
                  <input
                    type="date"
                    value={toISODate(row.dateConditionnement)}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, dateConditionnement: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-32 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.produit}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, produit: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-40 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.typeEmballage}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, typeEmballage: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-28 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.numeroLot}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, numeroLot: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-28 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.quantite}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, quantite: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-44">
                  <input
                    type="text"
                    value={row.fournisseur}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, fournisseur: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all"
            >
              <FilePlus size={20} /> Générer PDF
            </button>
            <button
              onClick={() => updateForm(defaultEmballageForm())}
              className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all"
            >
              <RefreshCw size={20} /> Réinitialiser
            </button>
            <button
              onClick={saveWorking}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all"
            >
              <Save size={20} /> Enregistrer
            </button>
            <button
              onClick={saveToArchive}
              disabled={isArchiving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-60"
            >
              <FilePlus size={20} /> {isArchiving ? 'Archivage...' : 'Archiver'}
            </button>
            {selectedArchiveId && (
              <button
                onClick={updateArchiveFromEditor}
                className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-all"
              >
                <Save size={20} /> Mettre à jour l'archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Archived packaging forms */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl mt-6 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold">Archives - Fiches Emballages</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Les archives sont des copies figées de vos fiches emballages. Utilisez Archiver pour ajouter une nouvelle fiche ici.
        </p>
        {archives.length === 0 ? (
          <div className="text-gray-500">Aucune archive pour le moment.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archives.map((a) => (
              <div key={a.id} className={`border rounded-lg p-4 ${selectedArchiveId === a.id ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.lotNumber}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadArchive(a)}
                      className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={async () => {
                        const name = prompt("Renommer l'archive en :", a.lotNumber);
                        if (name && name.trim()) {
                          await renameEmballageArchive(a.id, name.trim());
                          const items = await getEmballageArchives();
                          setArchives(items);
                          toast({ title: 'Archive renommée', description: 'Le nom du lot a été mis à jour.' });
                        }
                      }}
                      className="px-2 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => deleteArchive(a.id)}
                      className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Dernière mise à jour: {a.updatedAt?.toLocaleString?.() || ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviEmballages;
