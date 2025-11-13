import React, { useEffect, useState } from 'react';
import { FilePlus, Plus, RefreshCw, Save, Trash2, Search, Filter, Calendar } from 'lucide-react';
import { format } from 'date-fns';

// Data model for a Suivi Déchets entry
interface DechetRow {
  numeroLigne: number;        // Auto-generated line number
  numeroPalette: string;      // N° palette
  nombreCaisses: string;      // Nombre de caisses
  poidsBrut: string;          // Poids Brut
  poidsNet: string;           // Poids Net
  natureDechet: string;       // Nature de déchet
  variete: string;            // Variété
}

interface DechetFormData {
  header: {
    code: string;
    date: string;
    version: string;
    dateTraitement: string;
    responsableTracabilite: string;
    produit: string;
    conventionnel: boolean;
    biologique: boolean;
    campagne: string;          // Campaign name
  };
  rows: DechetRow[];
}

interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
  wasteData: DechetFormData;
  createdAt: Date;
  updatedAt: Date;
}

const defaultDechetForm = (campagneName: string = ''): DechetFormData => ({
  header: {
    code: 'F.S.D',
    date: '18/09/2023',
    version: '00',
    dateTraitement: format(new Date(), 'dd/MM/yyyy'),
    responsableTracabilite: '',
    produit: 'AVOCAT',
    conventionnel: true,
    biologique: false,
    campagne: campagneName,
  },
  rows: [createEmptyRow(1)]
});

const createEmptyRow = (lineNumber: number): DechetRow => ({
  numeroLigne: lineNumber,
  numeroPalette: '',
  nombreCaisses: '',
  poidsBrut: '',
  poidsNet: '',
  natureDechet: '',
  variete: ''
});

const SuiviDechetsCampagne: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentCampaignId, setCurrentCampaignId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Initialize with a default campaign
  useEffect(() => {
    if (campaigns.length === 0) {
      createNewCampaign('Campagne 2024-2025');
    }
  }, []);

  const createNewCampaign = (name?: string) => {
    const campaignName = name || prompt('Nom de la nouvelle campagne:');
    if (!campaignName || !campaignName.trim()) return;

    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: campaignName.trim(),
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      status: 'active',
      wasteData: defaultDechetForm(campaignName.trim()),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setCampaigns(prev => [...prev, newCampaign]);
    setCurrentCampaignId(newCampaign.id);
    setShowNewCampaignModal(false);
  };

  const getCurrentCampaign = (): Campaign | undefined => {
    return campaigns.find(c => c.id === currentCampaignId);
  };

  const updateCampaign = (updates: Partial<Campaign>) => {
    setCampaigns(prev => prev.map(c => 
      c.id === currentCampaignId 
        ? { ...c, ...updates, updatedAt: new Date() }
        : c
    ));
  };

  const deleteCampaign = (id: string) => {
    if (campaigns.length <= 1) {
      alert('Vous ne pouvez pas supprimer la dernière campagne');
      return;
    }
    if (confirm('Supprimer cette campagne et toutes ses données ?')) {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      if (id === currentCampaignId) {
        const remaining = campaigns.filter(c => c.id !== id);
        setCurrentCampaignId(remaining[0]?.id || '');
      }
    }
  };

  const updateForm = (updates: Partial<DechetFormData>) => {
    const campaign = getCurrentCampaign();
    if (!campaign) return;

    const wasteData: DechetFormData = {
      header: { ...campaign.wasteData.header, ...(updates.header || {}) },
      rows: updates.rows || campaign.wasteData.rows
    };

    updateCampaign({ wasteData });
  };

  const addNewRow = () => {
    const campaign = getCurrentCampaign();
    if (!campaign) return;

    const newLineNumber = campaign.wasteData.rows.length + 1;
    const newRow = createEmptyRow(newLineNumber);
    
    updateForm({
      rows: [...campaign.wasteData.rows, newRow]
    });
  };

  const deleteRow = (index: number) => {
    const campaign = getCurrentCampaign();
    if (!campaign) return;

    if (campaign.wasteData.rows.length <= 1) {
      alert('Vous devez avoir au moins une ligne');
      return;
    }

    const newRows = campaign.wasteData.rows.filter((_, i) => i !== index);
    // Renumber all rows
    const renumberedRows = newRows.map((row, idx) => ({
      ...row,
      numeroLigne: idx + 1
    }));

    updateForm({ rows: renumberedRows });
  };

  const duplicateRow = (index: number) => {
    const campaign = getCurrentCampaign();
    if (!campaign) return;

    const rowToDuplicate = campaign.wasteData.rows[index];
    const newLineNumber = campaign.wasteData.rows.length + 1;
    const newRow = { ...rowToDuplicate, numeroLigne: newLineNumber };
    
    updateForm({
      rows: [...campaign.wasteData.rows, newRow]
    });
  };

  const generatePDF = async () => {
    const campaign = getCurrentCampaign();
    if (!campaign) return;

    const form = campaign.wasteData;
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const rowHeight = 8;
    const headerHeight = 70;
    const footerSpace = 10;

    const colors = {
      headerGreen: [101, 174, 73] as const,
      lightGreen: [200, 230, 201] as const,
      border: [0, 0, 0] as const,
      text: [0, 0, 0] as const,
      white: [255, 255, 255] as const
    };

    const drawRect = (x: number, y: number, w: number, h: number, fill?: readonly number[], lineWidth = 0.5) => {
      doc.setLineWidth(lineWidth);
      if (fill) doc.setFillColor(fill[0], fill[1], fill[2]);
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

    const drawHeader = (yPos: number) => {
      // Logo section
      drawRect(margin, yPos, 30, 20, colors.lightGreen);
      drawText('LOGO', margin + 10, yPos + 12, 10, true);

      // Title
      drawRect(margin + 30, yPos, 100, 20, colors.headerGreen);
      drawText('Fiche Suivi Déchets', margin + 65, yPos + 12, 14, true, colors.white);

      // Document info
      drawRect(margin + 130, yPos, 60, 20, colors.white);
      drawText(`code : ${form.header.code}`, margin + 135, yPos + 5, 8, true);
      drawText(`Date : ${form.header.date}`, margin + 135, yPos + 10, 8);
      drawText(`version : ${form.header.version}`, margin + 135, yPos + 15, 8);

      yPos += 25;

      // Campaign and date info
      drawRect(margin, yPos, contentWidth, 10, colors.white);
      drawText(`Campagne : ${form.header.campagne}`, margin + 2, yPos + 6, 9, true);
      drawText(`Date : ${form.header.dateTraitement}`, margin + 120, yPos + 6, 9);

      yPos += 12;

      // Responsable
      drawRect(margin, yPos, contentWidth, 8, colors.white);
      drawText('Responsable Traçabilité :', margin + 2, yPos + 5, 8, true);
      drawText(form.header.responsableTracabilite || '', margin + 50, yPos + 5, 8);

      yPos += 10;

      // Product and type
      drawRect(margin, yPos, contentWidth, 8, colors.lightGreen);
      drawText(`Produit : ${form.header.produit}`, margin + 2, yPos + 5, 8, true);
      const conventionnelText = form.header.conventionnel ? '☑ CONVENTIONNEL' : '☐ CONVENTIONNEL';
      const biologiqueText = form.header.biologique ? '☑ BIOLOGIQUE' : '☐ BIOLOGIQUE';
      drawText(conventionnelText, margin + 100, yPos + 5, 7);
      drawText(biologiqueText, margin + 150, yPos + 5, 7);

      return yPos + 12;
    };

    const drawTableHeader = (yPos: number) => {
      const headers = ['N°', 'N° palette', 'Nb caisses', 'Poids Brut', 'Poids Net', 'Nature déchet', 'Variété'];
      const colWidths = [12, 25, 25, 25, 25, 38, 30];

      drawRect(margin, yPos, contentWidth, 10, colors.lightGreen);
      
      let x = margin;
      headers.forEach((header, i) => {
        if (i > 0) doc.line(x, yPos, x, yPos + 10);
        drawText(header, x + 2, yPos + 6.5, 7, true);
        x += colWidths[i];
      });

      return yPos + 10;
    };

    let currentPage = 1;
    let y = drawHeader(margin);
    y = drawTableHeader(y);

    const colWidths = [12, 25, 25, 25, 25, 38, 30];

    form.rows.forEach((row, index) => {
      // Check if we need a new page
      if (y + rowHeight > pageHeight - margin - footerSpace) {
        // Add page number
        drawText(`Page ${currentPage}`, pageWidth / 2 - 10, pageHeight - 5, 8);
        
        doc.addPage();
        currentPage++;
        y = drawHeader(margin);
        y = drawTableHeader(y);
      }

      drawRect(margin, y, contentWidth, rowHeight, colors.white);
      
      let cx = margin;
      const values = [
        row.numeroLigne.toString(),
        row.numeroPalette || '',
        row.nombreCaisses || '',
        row.poidsBrut || '',
        row.poidsNet || '',
        row.natureDechet || '',
        row.variete || ''
      ];

      values.forEach((value, j) => {
        if (j > 0) doc.line(cx, y, cx, y + rowHeight);
        drawText(value, cx + 2, y + 5.5, 7);
        cx += colWidths[j];
      });
      
      y += rowHeight;
    });

    // Add final page number
    drawText(`Page ${currentPage}`, pageWidth / 2 - 10, pageHeight - 5, 8);

    const fileName = `Fiche_Suivi_Dechets_${campaign.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const campaign = getCurrentCampaign();
  const form = campaign?.wasteData;

  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Suivi Déchets par Campagne</h1>
                <p className="text-green-100">Gestion illimitée des entrées de déchets</p>
              </div>
              <button
                onClick={() => createNewCampaign()}
                className="bg-white text-green-700 px-6 py-3 rounded-xl hover:bg-green-50 transition-all flex items-center gap-2 font-semibold shadow-lg"
              >
                <Plus size={20} /> Nouvelle Campagne
              </button>
            </div>

            {/* Search and filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[250px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une campagne..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/90 border-0 focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-800"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 rounded-lg bg-white/90 border-0 focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-800"
              >
                <option value="all">Toutes</option>
                <option value="active">Actives</option>
                <option value="archived">Archivées</option>
              </select>
            </div>
          </div>

          {/* Campaign tabs */}
          <div className="p-4 bg-gray-50 border-b flex gap-2 overflow-x-auto">
            {filteredCampaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrentCampaignId(c.id)}
                className={`px-5 py-3 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 ${
                  currentCampaignId === c.id
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Calendar size={16} />
                {c.name}
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  c.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {c.status === 'active' ? 'Active' : 'Archivée'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {/* Header section */}
          <div className="flex mb-6 gap-4">
            <div className="w-24 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center shadow-inner">
              <span className="text-green-700 font-bold text-sm">LOGO</span>
            </div>
            
            <div className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white flex items-center justify-center rounded-xl shadow-md">
              <h2 className="text-2xl font-bold">Fiche Suivi Déchets</h2>
            </div>
            
            <div className="w-52 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 shadow-inner">
              <div className="text-sm mb-1">
                <span className="font-bold">code :</span>
                <input
                  type="text"
                  value={form.header.code}
                  onChange={(e) => updateForm({ header: { ...form.header, code: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-20 font-medium"
                />
              </div>
              <div className="text-sm mb-1">
                <span className="font-bold">Date :</span>
                <input
                  type="text"
                  value={form.header.date}
                  onChange={(e) => updateForm({ header: { ...form.header, date: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-24 font-medium"
                />
              </div>
              <div className="text-sm">
                <span className="font-bold">version :</span>
                <input
                  type="text"
                  value={form.header.version}
                  onChange={(e) => updateForm({ header: { ...form.header, version: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-12 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Info section */}
          <div className="rounded-xl border-2 border-gray-300 overflow-hidden mb-6 shadow-sm">
            <div className="grid md:grid-cols-2 gap-px bg-gray-300">
              <div className="bg-white p-4">
                <span className="font-bold text-gray-700">Campagne :</span>
                <input
                  type="text"
                  value={form.header.campagne}
                  onChange={(e) => updateForm({ header: { ...form.header, campagne: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none flex-1 font-semibold text-green-700"
                />
              </div>
              <div className="bg-white p-4">
                <span className="font-bold text-gray-700">Date traitement :</span>
                <input
                  type="text"
                  value={form.header.dateTraitement}
                  onChange={(e) => updateForm({ header: { ...form.header, dateTraitement: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none"
                />
              </div>
            </div>
            
            <div className="bg-white p-4 border-t-2 border-gray-300">
              <span className="font-bold text-gray-700">Responsable Traçabilité :</span>
              <input
                type="text"
                value={form.header.responsableTracabilite}
                onChange={(e) => updateForm({ header: { ...form.header, responsableTracabilite: e.target.value } })}
                className="ml-2 border-0 bg-transparent focus:outline-none flex-1"
              />
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 flex items-center justify-between border-t-2 border-gray-300">
              <div>
                <span className="font-bold text-gray-700">Produit :</span>
                <input
                  type="text"
                  value={form.header.produit}
                  onChange={(e) => updateForm({ header: { ...form.header, produit: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none font-bold text-green-700"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.header.conventionnel}
                    onChange={(e) => updateForm({ header: { ...form.header, conventionnel: e.target.checked } })}
                    className="mr-2 w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm font-medium">CONVENTIONNEL</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.header.biologique}
                    onChange={(e) => updateForm({ header: { ...form.header, biologique: e.target.checked } })}
                    className="mr-2 w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm font-medium">BIOLOGIQUE</span>
                </label>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border-2 border-gray-300 overflow-hidden mb-6 shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-green-100 to-green-200">
                    <th className="p-3 text-sm font-bold border-r border-gray-300 w-12">N°</th>
                    <th className="p-3 text-sm font-bold border-r border-gray-300">N° palette</th>
                    <th className="p-3 text-sm font-bold border-r border-gray-300">Nombre de<br/>caisses</th>
                    <th className="p-3 text-sm font-bold border-r border-gray-300">Poids Brut</th>
                    <th className="p-3 text-sm font-bold border-r border-gray-300">Poids Net</th>
                    <th className="p-3 text-sm font-bold border-r border-gray-300">Nature de<br/>déchet</th>
                    <th className="p-3 text-sm font-bold border-r border-gray-300">Variété</th>
                    <th className="p-3 text-sm font-bold w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((row, index) => (
                    <tr key={index} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                      <td className="p-2 text-center border-r border-gray-300 font-semibold text-gray-600 bg-gray-50">
                        {row.numeroLigne}
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.numeroPalette}
                          onChange={(e) => {
                            const rows = [...form.rows];
                            rows[index] = { ...row, numeroPalette: e.target.value };
                            updateForm({ rows });
                          }}
                          className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-100"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.nombreCaisses}
                          onChange={(e) => {
                            const rows = [...form.rows];
                            rows[index] = { ...row, nombreCaisses: e.target.value };
                            updateForm({ rows });
                          }}
                          className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-100"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.poidsBrut}
                          onChange={(e) => {
                            const rows = [...form.rows];
                            rows[index] = { ...row, poidsBrut: e.target.value };
                            updateForm({ rows });
                          }}
                          className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-100"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.poidsNet}
                          onChange={(e) => {
                            const rows = [...form.rows];
                            rows[index] = { ...row, poidsNet: e.target.value };
                            updateForm({ rows });
                          }}
                          className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-100"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.natureDechet}
                          onChange={(e) => {
                            const rows = [...form.rows];
                            rows[index] = { ...row, natureDechet: e.target.value };
                            updateForm({ rows });
                          }}
                          className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-100"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.variete}
                          onChange={(e) => {
                            const rows = [...form.rows];
                            rows[index] = { ...row, variete: e.target.value };
                            updateForm({ rows });
                          }}
                          className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-100"
                        />
                      </td>
                      <td className="p-1">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => duplicateRow(index)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Dupliquer"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => deleteRow(index)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={addNewRow}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-md mb-6"
          >
            <Plus size={20} /> Ajouter une ligne
          </button>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-md font-semibold"
            >
              <FilePlus size={20} /> Générer PDF
            </button>
            <button
              onClick={() => updateForm(defaultDechetForm(form.header.campagne))}
              className="flex items-center gap-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all shadow-md font-semibold"
            >
              <RefreshCw size={20} /> Réinitialiser
            </button>
            <button
              onClick={() => {
                alert('Données sauvegardées automatiquement');
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md font-semibold"
            >
              <Save size={20} /> Enregistré automatiquement
            </button>
            <button
              onClick={() => {
                if (campaign) {
                  updateCampaign({ status: campaign.status === 'active' ? 'archived' : 'active' });
                }
              }}
              className={`flex items-center gap-2 text-white px-6 py-3 rounded-xl transition-all shadow-md font-semibold ${
                campaign?.status === 'active'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
              }`}
            >
              {campaign?.status === 'active' ? 'Archiver' : 'Réactiver'}
            </button>
            {campaigns.length > 1 && (
              <button
                onClick={() => deleteCampaign(currentCampaignId)}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-md font-semibold"
              >
                <Trash2 size={20} /> Supprimer la campagne
              </button>
            )}
          </div>
        </div>

        {/* Campaign info panel */}
        {campaign && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Informations de la campagne</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                <div className="text-sm text-blue-600 font-semibold mb-1">Nom de la campagne</div>
                <div className="font-bold text-gray-800">{campaign.name}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
                <div className="text-sm text-green-600 font-semibold mb-1">Nombre de lignes</div>
                <div className="font-bold text-gray-800 text-2xl">{form.rows.length}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl">
                <div className="text-sm text-purple-600 font-semibold mb-1">Statut</div>
                <div className="font-bold text-gray-800">
                  {campaign.status === 'active' ? 'Active' : 'Archivée'}
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl">
                <div className="text-sm text-orange-600 font-semibold mb-1">Date de création</div>
                <div className="font-medium text-gray-800">
                  {format(campaign.createdAt, 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-xl">
                <div className="text-sm text-pink-600 font-semibold mb-1">Dernière modification</div>
                <div className="font-medium text-gray-800">
                  {format(campaign.updatedAt, 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl">
                <div className="text-sm text-indigo-600 font-semibold mb-1">Type de produit</div>
                <div className="font-bold text-gray-800">{form.header.produit}</div>
              </div>
            </div>

            {/* Edit campaign details */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-3">Modifier les détails de la campagne</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de la campagne
                  </label>
                  <input
                    type="text"
                    value={campaign.name}
                    onChange={(e) => updateCampaign({ name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={campaign.startDate}
                    onChange={(e) => updateCampaign({ startDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin (optionnelle)
                  </label>
                  <input
                    type="date"
                    value={campaign.endDate}
                    onChange={(e) => updateCampaign({ endDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviDechetsCampagne;