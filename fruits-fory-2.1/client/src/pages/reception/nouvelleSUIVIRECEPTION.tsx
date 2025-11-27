import React, { useState, useEffect } from 'react';
import { Download, Printer, Save, Archive, Plus, Trash2, FileText } from 'lucide-react';

const SuiviReception = () => {
  const [activeType, setActiveType] = useState('CONVENTIONNEL');
  const [archives, setArchives] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    version: '01',
    chau: 'ZAGEL',
    matricule: '1837 A 13',
    dateMatricule: new Date().toISOString().split('T')[0],
    responsable: 'LAILA LAKTOB',
    compagne1: '2023/2024',
    compagne2: '2024/2025',
    bonLivraison: '',
    produit: 'AVOCAT',
    bonReception: '',
    rows: [{ id: 1, noPalette: '', nrCaisse: '', tarePalette: '', poidsBrut: '', poidsNet: '', variete: 'ZUTANO', lotIntern: '', decision: '' }]
  });

  const [totals, setTotals] = useState({
    totalPalettes: 0,
    totalCaisses: 0,
    totalPoids: 0,
    poidsUsine: 0,
    poidsTicket: 0,
    ecart: 0
  });

  useEffect(() => {
    calculateTotals();
  }, [formData.rows]);

  const calculateTotals = () => {
    const totalPalettes = formData.rows.length;
    const totalCaisses = formData.rows.reduce((sum, row) => sum + (parseFloat(row.nrCaisse) || 0), 0);
    const totalPoids = formData.rows.reduce((sum, row) => sum + (parseFloat(row.poidsNet) || 0), 0);
    
    setTotals({
      totalPalettes,
      totalCaisses,
      totalPoids: totalPoids.toFixed(2),
      poidsUsine: totals.poidsUsine || 0,
      poidsTicket: totals.poidsTicket || 0,
      ecart: (totals.poidsUsine - totals.poidsTicket).toFixed(2)
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRowChange = (id, field, value) => {
    setFormData(prev => {
      const updatedRows = prev.rows.map(row => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };
          
          // Auto-calculate Poids Net
          if (field === 'poidsBrut' || field === 'tarePalette') {
            const brut = parseFloat(updated.poidsBrut) || 0;
            const tare = parseFloat(updated.tarePalette) || 0;
            updated.poidsNet = (brut - tare).toFixed(2);
          }
          
          return updated;
        }
        return row;
      });
      return { ...prev, rows: updatedRows };
    });
  };

  const addRow = () => {
    const newId = Math.max(...formData.rows.map(r => r.id), 0) + 1;
    setFormData(prev => ({
      ...prev,
      rows: [...prev.rows, { 
        id: newId, 
        noPalette: '', 
        nrCaisse: '', 
        tarePalette: '', 
        poidsBrut: '', 
        poidsNet: '', 
        variete: 'ZUTANO', 
        lotIntern: '', 
        decision: '' 
      }]
    }));
  };

  const deleteRow = (id) => {
    if (formData.rows.length > 1) {
      setFormData(prev => ({
        ...prev,
        rows: prev.rows.filter(row => row.id !== id)
      }));
    }
  };

  const saveToArchive = () => {
    const record = {
      ...formData,
      type: activeType,
      totals,
      savedAt: new Date().toISOString(),
      id: Date.now()
    };
    setArchives(prev => [...prev, record]);
    alert('✓ Enregistré avec succès!');
  };

  const generatePDF = () => {
    const content = `
SUIVI RECEPTION SMQ, ENR24
Date: ${formData.date} | Version: ${formData.version}
CHAU: ${formData.chau} | MATRICULE: ${formData.matricule}
Responsable: ${formData.responsable}
Compagne: ${formData.compagne1} ${formData.compagne2}

N° BON DE LIVRAISON: ${formData.bonLivraison}
PRODUIT: ${formData.produit}
TYPE: ${activeType}
N° BON DE RECEPTION: ${formData.bonReception}

TABLEAU DE RECEPTION:
${formData.rows.map(row => `
N°${row.noPalette} | Caisses: ${row.nrCaisse} | Tare: ${row.tarePalette}kg | 
Brut: ${row.poidsBrut}kg | Net: ${row.poidsNet}kg | 
Variété: ${row.variete} | Lot: ${row.lotIntern}
`).join('\n')}

TOTAUX:
Palettes: ${totals.totalPalettes} | Caisses: ${totals.totalCaisses} | Poids Total: ${totals.totalPoids}kg
Poids Usine: ${totals.poidsUsine}kg | Poids Ticket: ${totals.poidsTicket}kg | Écart: ${totals.ecart}kg
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUIVI_RECEPTION_${formData.bonReception}_${Date.now()}.txt`;
    a.click();
    alert('✓ PDF généré et téléchargé!');
  };

  const exportToExcel = () => {
    let csv = 'N° PALETTE,NR CAISSE,TARE PALETTE,POIDS BRUT (kg),POIDS NET (kg),VARIETE,N° DE LOT INTERN,DECISION\n';
    formData.rows.forEach(row => {
      csv += `${row.noPalette},${row.nrCaisse},${row.tarePalette},${row.poidsBrut},${row.poidsNet},${row.variete},${row.lotIntern},${row.decision}\n`;
    });
    csv += `\nTOTAUX:,${totals.totalCaisses},,${totals.totalPoids}\n`;
    csv += `\nPOIDS USINE,POIDS TICKET,ECART\n`;
    csv += `${totals.poidsUsine},${totals.poidsTicket},${totals.ecart}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUIVI_RECEPTION_${formData.bonReception}_${Date.now()}.csv`;
    a.click();
    alert('✓ Exporté en Excel!');
  };

  const printForm = () => {
    window.print();
    alert('✓ Impression lancée!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h1 className="text-3xl font-bold text-center">SUIVI RECEPTION SMQ, ENR24</h1>
          <div className="flex justify-between mt-4 text-sm">
            <span>Date: {formData.date}</span>
            <span>Version: {formData.version}</span>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CHAU</label>
              <input 
                type="text" 
                value={formData.chau}
                onChange={(e) => handleInputChange('chau', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">MATRICULE</label>
              <input 
                type="text" 
                value={formData.matricule}
                onChange={(e) => handleInputChange('matricule', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">DATE</label>
              <input 
                type="date" 
                value={formData.dateMatricule}
                onChange={(e) => handleInputChange('dateMatricule', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Responsable</label>
              <input 
                type="text" 
                value={formData.responsable}
                onChange={(e) => handleInputChange('responsable', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Compagne 1</label>
              <input 
                type="text" 
                value={formData.compagne1}
                onChange={(e) => handleInputChange('compagne1', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Compagne 2</label>
              <input 
                type="text" 
                value={formData.compagne2}
                onChange={(e) => handleInputChange('compagne2', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Product Info & Type Selection */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">N° BON DE LIVRAISON</label>
                <input 
                  type="text" 
                  value={formData.bonLivraison}
                  onChange={(e) => handleInputChange('bonLivraison', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">PRODUIT</label>
                <input 
                  type="text" 
                  value={formData.produit}
                  onChange={(e) => handleInputChange('produit', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">N° BON DE RECEPTION</label>
                <input 
                  type="text" 
                  value={formData.bonReception}
                  onChange={(e) => handleInputChange('bonReception', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">TYPE</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveType('CONVENTIONNEL')}
                    className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all ${
                      activeType === 'CONVENTIONNEL' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    CONVENTIONNEL
                  </button>
                  <button
                    onClick={() => setActiveType('BIOLOGIQUE')}
                    className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all ${
                      activeType === 'BIOLOGIQUE' 
                        ? 'bg-green-600 text-white shadow-lg' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    BIOLOGIQUE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-6 overflow-x-auto">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Tableau de Réception - {activeType}</h2>
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Plus size={16} /> Ajouter Ligne
            </button>
          </div>
          
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                <th className="border border-gray-300 p-2 text-xs">N° PALETTE</th>
                <th className="border border-gray-300 p-2 text-xs">NR CAISSE</th>
                <th className="border border-gray-300 p-2 text-xs">TARE PALETTE</th>
                <th className="border border-gray-300 p-2 text-xs">POIDS BRUT (kg)</th>
                <th className="border border-gray-300 p-2 text-xs">POIDS NET (kg)</th>
                <th className="border border-gray-300 p-2 text-xs">VARIETE</th>
                <th className="border border-gray-300 p-2 text-xs">N° DE LOT INTERN</th>
                <th className="border border-gray-300 p-2 text-xs">DECISION</th>
                <th className="border border-gray-300 p-2 text-xs">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {formData.rows.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50 transition-colors">
                  <td className="border border-gray-300 p-1">
                    <input 
                      type="text" 
                      value={row.noPalette}
                      onChange={(e) => handleRowChange(row.id, 'noPalette', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input 
                      type="number" 
                      value={row.nrCaisse}
                      onChange={(e) => handleRowChange(row.id, 'nrCaisse', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input 
                      type="number" 
                      step="0.01"
                      value={row.tarePalette}
                      onChange={(e) => handleRowChange(row.id, 'tarePalette', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input 
                      type="number" 
                      step="0.01"
                      value={row.poidsBrut}
                      onChange={(e) => handleRowChange(row.id, 'poidsBrut', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-gray-300 p-1 bg-yellow-50">
                    <input 
                      type="number" 
                      step="0.01"
                      value={row.poidsNet}
                      readOnly
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent font-semibold"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <select 
                      value={row.variete}
                      onChange={(e) => handleRowChange(row.id, 'variete', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    >
                      <option>ZUTANO</option>
                      <option>HASS</option>
                      <option>FUERTE</option>
                    </select>
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input 
                      type="text" 
                      value={row.lotIntern}
                      onChange={(e) => handleRowChange(row.id, 'lotIntern', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input 
                      type="text" 
                      value={row.decision}
                      onChange={(e) => handleRowChange(row.id, 'decision', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-400 rounded"
                    />
                  </td>
                  <td className="border border-gray-300 p-1 text-center">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      disabled={formData.rows.length === 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* Totals Row */}
              <tr className="bg-blue-100 font-bold">
                <td className="border border-gray-300 p-2 text-sm">TOTAL</td>
                <td className="border border-gray-300 p-2 text-sm text-center">{totals.totalCaisses}</td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2"></td>
                <td className="border border-gray-300 p-2 text-sm text-center">{totals.totalPoids}</td>
                <td className="border border-gray-300 p-2" colSpan="4"></td>
              </tr>
            </tbody>
          </table>

          {/* Weight Verification */}
          <div className="mt-6 bg-gray-50 p-4 rounded-lg border-2 border-gray-300">
            <h3 className="font-bold text-gray-800 mb-3">Vérification des Poids</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">POIDS USINE</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={totals.poidsUsine}
                  onChange={(e) => setTotals(prev => ({
                    ...prev, 
                    poidsUsine: parseFloat(e.target.value) || 0,
                    ecart: ((parseFloat(e.target.value) || 0) - prev.poidsTicket).toFixed(2)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">POIDS TICKET</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={totals.poidsTicket}
                  onChange={(e) => setTotals(prev => ({
                    ...prev, 
                    poidsTicket: parseFloat(e.target.value) || 0,
                    ecart: (prev.poidsUsine - (parseFloat(e.target.value) || 0)).toFixed(2)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ECART</label>
                <input 
                  type="text" 
                  value={totals.ecart}
                  readOnly
                  className="w-full px-3 py-2 border-2 border-orange-400 rounded-md bg-orange-50 font-bold text-orange-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-gray-50 border-t flex flex-wrap gap-3 justify-center">
          <button
            onClick={saveToArchive}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Save size={18} /> Enregistrer
          </button>
          <button
            onClick={() => alert('Archivé: ' + archives.length + ' enregistrements')}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-lg"
          >
            <Archive size={18} /> Archive ({archives.length})
          </button>
          <button
            onClick={printForm}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors shadow-lg"
          >
            <Printer size={18} /> Imprimer
          </button>
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-lg"
          >
            <FileText size={18} /> Générer PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-lg"
          >
            <Download size={18} /> Exporter Excel
          </button>
        </div>

        {/* Archives Preview */}
        {archives.length > 0 && (
          <div className="p-6 border-t">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Archives ({archives.length})</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {archives.map(archive => (
                <div key={archive.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{archive.type} - Bon: {archive.bonReception}</span>
                    <span className="text-sm text-gray-600">{new Date(archive.savedAt).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {archive.rows.length} palettes | {archive.totals.totalPoids}kg
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviReception;