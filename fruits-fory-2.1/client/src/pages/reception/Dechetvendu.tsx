import React, { useState, useEffect } from 'react';
import { Download, Printer, Archive, Plus, Trash2, Search, Filter, Save, Edit2, CheckCircle, AlertCircle, Calendar, TrendingUp, Package, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AvocadoWasteTracker() {
  // Editable titles
  const [mainTitle, setMainTitle] = useState('SUIVI VENDU DÉCHETS AVOCATS 2024/2025');
  const [section1Title, setSection1Title] = useState('Suivi des Ventes');
  const [section2Title, setSection2Title] = useState('VENDU DE DÉCHET');
  const [table1Title, setTable1Title] = useState('AGADIR 1');
  const [table2Title, setTable2Title] = useState('AGADIR 2');

  // Editable column headers for main table
  const [mainHeaders, setMainHeaders] = useState({
    date: 'DATE',
    matricule: 'Matricule',
    chauffeur: 'Chauffeur',
    poidsKg: 'POIDS KG',
    prixKg: 'PRIX/KG',
    prixTotal: 'PRIX TOTAL DH',
    fournisseur: 'FOURNISSEUR',
    payer: 'PAYÉ',
    variete: 'VARIÉTÉ'
  });

  // Editable column headers for Agadir tables
  const [agadirHeaders, setAgadirHeaders] = useState({
    palette: 'N° PALETTE',
    nrCaisse: 'NR CAISSE',
    tare: 'TARE PALETTE',
    poidsBrut: 'POIDS BRUT (kg)',
    poidsNet: 'POIDS NET (kg)'
  });

  const [mainData, setMainData] = useState([
    { date: '', matricule: '', chauffeur: '', poidsKg: '', prixKg: '', prixTotal: '', fournisseur: '', payer: '', variete: '' }
  ]);

  const [agadirData1, setAgadirData1] = useState([
    { palette: '1', nrCaisse: '24', tare: '23', poidsBrut: '604', poidsNet: '514.04' }
  ]);

  const [agadirData2, setAgadirData2] = useState([
    { palette: '1', nrCaisse: '19', tare: '23', poidsBrut: '447', poidsNet: '370.99' }
  ]);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayer, setFilterPayer] = useState('all');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  // Show notification
  const showNotif = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Calculate statistics
  const calculateStats = () => {
    const totalPoids = mainData.reduce((sum, row) => sum + (parseFloat(row.poidsKg) || 0), 0);
    const totalRevenue = mainData.reduce((sum, row) => sum + (parseFloat(row.prixTotal) || 0), 0);
    const totalPalettes = agadirData1.length + agadirData2.length;
    const totalCaisses = [...agadirData1, ...agadirData2].reduce((sum, row) => sum + (parseFloat(row.nrCaisse) || 0), 0);
    const avgPrice = totalPoids > 0 ? (totalRevenue / totalPoids).toFixed(2) : 0;

    return { totalPoids, totalRevenue, totalPalettes, totalCaisses, avgPrice };
  };

  const stats = calculateStats();

  // Calculate totals for Agadir tables
  const calculateTotals = (data) => {
    return data.reduce((acc, row) => ({
      nrCaisse: acc.nrCaisse + (parseFloat(row.nrCaisse) || 0),
      tare: acc.tare + (parseFloat(row.tare) || 0),
      poidsBrut: acc.poidsBrut + (parseFloat(row.poidsBrut) || 0),
      poidsNet: acc.poidsNet + (parseFloat(row.poidsNet) || 0)
    }), { nrCaisse: 0, tare: 0, poidsBrut: 0, poidsNet: 0 });
  };

  const totals1 = calculateTotals(agadirData1);
  const totals2 = calculateTotals(agadirData2);

  // Filter data based on search and filter
  const filteredMainData = mainData.filter(row => {
    const matchesSearch = Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesFilter = filterPayer === 'all' || row.payer === filterPayer;
    return matchesSearch && matchesFilter;
  });

  // Add row functions
  const addMainRow = () => {
    setMainData([...mainData, { date: '', matricule: '', chauffeur: '', poidsKg: '', prixKg: '', prixTotal: '', fournisseur: '', payer: '', variete: '' }]);
    showNotif('Ligne ajoutée avec succès');
  };

  const addAgadirRow1 = () => {
    setAgadirData1([...agadirData1, { palette: (agadirData1.length + 1).toString(), nrCaisse: '', tare: '', poidsBrut: '', poidsNet: '' }]);
    showNotif('Ligne ajoutée au tableau Agadir 1');
  };

  const addAgadirRow2 = () => {
    setAgadirData2([...agadirData2, { palette: (agadirData2.length + 1).toString(), nrCaisse: '', tare: '', poidsBrut: '', poidsNet: '' }]);
    showNotif('Ligne ajoutée au tableau Agadir 2');
  };

  // Delete row functions
  const deleteMainRow = (index) => {
    if (mainData.length > 1) {
      setMainData(mainData.filter((_, i) => i !== index));
      showNotif('Ligne supprimée', 'warning');
    }
  };

  const deleteAgadirRow1 = (index) => {
    if (agadirData1.length > 1) {
      setAgadirData1(agadirData1.filter((_, i) => i !== index));
      showNotif('Ligne supprimée du tableau Agadir 1', 'warning');
    }
  };

  const deleteAgadirRow2 = (index) => {
    if (agadirData2.length > 1) {
      setAgadirData2(agadirData2.filter((_, i) => i !== index));
      showNotif('Ligne supprimée du tableau Agadir 2', 'warning');
    }
  };

  // Update cell functions
  const updateMainCell = (index, field, value) => {
    const updated = [...mainData];
    updated[index][field] = value;
    
    if (field === 'poidsKg' || field === 'prixKg') {
      const poids = parseFloat(updated[index].poidsKg) || 0;
      const prix = parseFloat(updated[index].prixKg) || 0;
      updated[index].prixTotal = (poids * prix).toFixed(2);
    }
    
    setMainData(updated);
  };

  const updateAgadirCell1 = (index, field, value) => {
    const updated = [...agadirData1];
    updated[index][field] = value;
    
    if (field === 'poidsBrut' || field === 'tare') {
      const brut = parseFloat(updated[index].poidsBrut) || 0;
      const tare = parseFloat(updated[index].tare) || 0;
      updated[index].poidsNet = (brut - tare).toFixed(2);
    }
    
    setAgadirData1(updated);
  };

  const updateAgadirCell2 = (index, field, value) => {
    const updated = [...agadirData2];
    updated[index][field] = value;
    
    if (field === 'poidsBrut' || field === 'tare') {
      const brut = parseFloat(updated[index].poidsBrut) || 0;
      const tare = parseFloat(updated[index].tare) || 0;
      updated[index].poidsNet = (brut - tare).toFixed(2);
    }
    
    setAgadirData2(updated);
  };

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(mainData.map(row => ({
      [mainHeaders.date]: row.date,
      [mainHeaders.matricule]: row.matricule,
      [mainHeaders.chauffeur]: row.chauffeur,
      [mainHeaders.poidsKg]: row.poidsKg,
      [mainHeaders.prixKg]: row.prixKg,
      [mainHeaders.prixTotal]: row.prixTotal,
      [mainHeaders.fournisseur]: row.fournisseur,
      [mainHeaders.payer]: row.payer,
      [mainHeaders.variete]: row.variete
    })));
    XLSX.utils.book_append_sheet(wb, ws1, section1Title);
    
    const ws2 = XLSX.utils.json_to_sheet(agadirData1.map(row => ({
      [agadirHeaders.palette]: row.palette,
      [agadirHeaders.nrCaisse]: row.nrCaisse,
      [agadirHeaders.tare]: row.tare,
      [agadirHeaders.poidsBrut]: row.poidsBrut,
      [agadirHeaders.poidsNet]: row.poidsNet
    })));
    XLSX.utils.book_append_sheet(wb, ws2, table1Title);
    
    const ws3 = XLSX.utils.json_to_sheet(agadirData2.map(row => ({
      [agadirHeaders.palette]: row.palette,
      [agadirHeaders.nrCaisse]: row.nrCaisse,
      [agadirHeaders.tare]: row.tare,
      [agadirHeaders.poidsBrut]: row.poidsBrut,
      [agadirHeaders.poidsNet]: row.poidsNet
    })));
    XLSX.utils.book_append_sheet(wb, ws3, table2Title);
    
    XLSX.writeFile(wb, `${mainTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotif('Fichier Excel téléchargé avec succès!');
  };

  const handlePrint = () => {
    window.print();
    showNotif('Impression lancée');
  };

  const handleArchive = () => {
    const archiveData = {
      date: new Date().toISOString(),
      mainTitle,
      section1Title,
      section2Title,
      table1Title,
      table2Title,
      mainHeaders,
      agadirHeaders,
      mainData,
      agadirData1,
      agadirData2
    };
    
    const archives = JSON.parse(localStorage.getItem('avocadoArchives') || '[]');
    archives.push(archiveData);
    localStorage.setItem('avocadoArchives', JSON.stringify(archives));
    
    showNotif('Données archivées avec succès!');
  };

  const handleSave = () => {
    const saveData = {
      mainTitle,
      section1Title,
      section2Title,
      table1Title,
      table2Title,
      mainHeaders,
      agadirHeaders,
      mainData,
      agadirData1,
      agadirData2
    };
    localStorage.setItem('avocadoCurrentData', JSON.stringify(saveData));
    showNotif('Données sauvegardées avec succès!');
  };

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('avocadoCurrentData');
    if (saved) {
      const data = JSON.parse(saved);
      setMainTitle(data.mainTitle || mainTitle);
      setSection1Title(data.section1Title || section1Title);
      setSection2Title(data.section2Title || section2Title);
      setTable1Title(data.table1Title || table1Title);
      setTable2Title(data.table2Title || table2Title);
      setMainHeaders(data.mainHeaders || mainHeaders);
      setAgadirHeaders(data.agadirHeaders || agadirHeaders);
      setMainData(data.mainData || mainData);
      setAgadirData1(data.agadirData1 || agadirData1);
      setAgadirData2(data.agadirData2 || agadirData2);
    }
  }, []);

  // Editable title component
  const EditableTitle = ({ value, onChange, className, placeholder }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    return isEditing ? (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={() => {
          onChange(tempValue);
          setIsEditing(false);
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
          }
        }}
        className={`${className} border-2 border-blue-400 rounded px-2 py-1 focus:outline-none focus:border-blue-600`}
        autoFocus
        placeholder={placeholder}
      />
    ) : (
      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
        <span className={className}>{value}</span>
        <Edit2 size={16} className="text-gray-400 group-hover:text-blue-600 transition print:hidden" />
      </div>
    );
  };

  // Editable header component
  const EditableHeader = ({ value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    return isEditing ? (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={() => {
          onChange(tempValue);
          setIsEditing(false);
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
          }
        }}
        className="w-full bg-blue-700 text-white px-2 py-1 border-2 border-white rounded focus:outline-none"
        autoFocus
      />
    ) : (
      <div className="flex items-center justify-center gap-1 cursor-pointer group" onClick={() => setIsEditing(true)}>
        <span>{value}</span>
        <Edit2 size={12} className="text-blue-200 group-hover:text-white transition print:hidden" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6 print:p-2">
      {/* Notification */}
      {showNotification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl transform transition-all duration-300 ${
          notificationType === 'success' ? 'bg-green-600' : 
          notificationType === 'warning' ? 'bg-orange-600' : 'bg-red-600'
        } text-white print:hidden`}>
          {notificationType === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
          <span className="font-medium">{notificationMessage}</span>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 rounded-2xl shadow-2xl p-8 mb-6 print:shadow-none print:bg-white">
          <EditableTitle 
            value={mainTitle}
            onChange={setMainTitle}
            className="text-4xl font-bold text-white text-center mb-6 print:text-gray-900"
            placeholder="Titre principal"
          />
          
          {/* Statistics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 print:hidden">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Package className="text-blue-300" size={24} />
                <span className="text-blue-200 text-sm font-medium">Total Poids</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.totalPoids.toFixed(2)} kg</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="text-green-300" size={24} />
                <span className="text-blue-200 text-sm font-medium">Revenue Total</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.totalRevenue.toFixed(2)} DH</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-yellow-300" size={24} />
                <span className="text-blue-200 text-sm font-medium">Prix Moyen/kg</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.avgPrice} DH</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Package className="text-purple-300" size={24} />
                <span className="text-blue-200 text-sm font-medium">Palettes</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.totalPalettes}</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Package className="text-orange-300" size={24} />
                <span className="text-blue-200 text-sm font-medium">Caisses</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.totalCaisses}</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center print:hidden">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Save size={20} />
              Sauvegarder
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Download size={20} />
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Printer size={20} />
              Imprimer PDF
            </button>
            <button
              onClick={handleArchive}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Archive size={20} />
              Archiver
            </button>
          </div>
        </div>

        {/* Main Tracking Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 print:shadow-none">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <EditableTitle 
              value={section1Title}
              onChange={setSection1Title}
              className="text-2xl font-bold text-gray-800"
              placeholder="Titre de section"
            />
            
            {/* Search and Filter */}
            <div className="flex flex-wrap gap-3 w-full md:w-auto print:hidden">
              <div className="relative flex-1 md:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none w-full md:w-64"
                />
              </div>
              
              <select
                value={filterPayer}
                onChange={(e) => setFilterPayer(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Tous les paiements</option>
                <option value="Oui">Payé</option>
                <option value="Non">Non payé</option>
              </select>
              
              <button
                onClick={addMainRow}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Plus size={20} />
                Ajouter
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-lg border-2 border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.date} onChange={(val) => setMainHeaders({...mainHeaders, date: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.matricule} onChange={(val) => setMainHeaders({...mainHeaders, matricule: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.chauffeur} onChange={(val) => setMainHeaders({...mainHeaders, chauffeur: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.poidsKg} onChange={(val) => setMainHeaders({...mainHeaders, poidsKg: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.prixKg} onChange={(val) => setMainHeaders({...mainHeaders, prixKg: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.prixTotal} onChange={(val) => setMainHeaders({...mainHeaders, prixTotal: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.fournisseur} onChange={(val) => setMainHeaders({...mainHeaders, fournisseur: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.payer} onChange={(val) => setMainHeaders({...mainHeaders, payer: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold">
                    <EditableHeader value={mainHeaders.variete} onChange={(val) => setMainHeaders({...mainHeaders, variete: val})} />
                  </th>
                  <th className="border border-blue-500 p-3 text-sm font-semibold print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMainData.map((row, index) => {
                  const actualIndex = mainData.findIndex(r => r === row);
                  return (
                    <tr key={actualIndex} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="border border-gray-300 p-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateMainCell(actualIndex, 'date', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.matricule}
                          onChange={(e) => updateMainCell(actualIndex, 'matricule', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          placeholder="Matricule"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.chauffeur}
                          onChange={(e) => updateMainCell(actualIndex, 'chauffeur', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          placeholder="Nom du chauffeur"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="number"
                          value={row.poidsKg}
                          onChange={(e) => updateMainCell(actualIndex, 'poidsKg', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="number"
                          value={row.prixKg}
                          onChange={(e) => updateMainCell(actualIndex, 'prixKg', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-300 p-2 bg-green-50">
                        <input
                          type="text"
                          value={row.prixTotal}
                          readOnly
                          className="w-full p-2 bg-green-50 font-bold text-green-700 rounded text-sm text-center"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.fournisseur}
                          onChange={(e) => updateMainCell(actualIndex, 'fournisseur', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          placeholder="Fournisseur"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <select
                          value={row.payer}
                          onChange={(e) => updateMainCell(actualIndex, 'payer', e.target.value)}
                          className={`w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm font-medium ${
                            row.payer === 'Oui' ? 'text-green-700 bg-green-50' : 
                            row.payer === 'Non' ? 'text-red-700 bg-red-50' : ''
                          }`}
                        >
                          <option value="">Sélectionner</option>
                          <option value="Oui">✓ Oui</option>
                          <option value="Non">✗ Non</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.variete}
                          onChange={(e) => updateMainCell(actualIndex, 'variete', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          placeholder="Variété"
                        />
                      </td>
                      <td className="border border-gray-300 p-2 text-center print:hidden">
                        <button
                          onClick={() => deleteMainRow(actualIndex)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors duration-150"
                          disabled={mainData.length === 1}
                        >
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vendu de Déchet Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 print:shadow-none">
          <EditableTitle 
            value={section2Title}
            onChange={setSection2Title}
            className="text-3xl font-bold text-gray-800 text-center mb-8"
            placeholder="Titre de section"
          />
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Agadir Table 1 */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-5 border-2 border-blue-200">
              <div className="flex justify-between items-center mb-4">
                <EditableTitle 
                  value={table1Title}
                  onChange={setTable1Title}
                  className="text-xl font-bold text-blue-800"
                  placeholder="Nom du tableau"
                />
                <button
                  onClick={addAgadirRow1}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 print:hidden"
                >
                  <Plus size={18} />
                  Ajouter
                </button>
              </div>
              
              <div className="overflow-x-auto rounded-lg border-2 border-blue-300">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <th className="border border-blue-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.palette} onChange={(val) => setAgadirHeaders({...agadirHeaders, palette: val})} />
                      </th>
                      <th className="border border-blue-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.nrCaisse} onChange={(val) => setAgadirHeaders({...agadirHeaders, nrCaisse: val})} />
                      </th>
                      <th className="border border-blue-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.tare} onChange={(val) => setAgadirHeaders({...agadirHeaders, tare: val})} />
                      </th>
                      <th className="border border-blue-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.poidsBrut} onChange={(val) => setAgadirHeaders({...agadirHeaders, poidsBrut: val})} />
                      </th>
                      <th className="border border-blue-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.poidsNet} onChange={(val) => setAgadirHeaders({...agadirHeaders, poidsNet: val})} />
                      </th>
                      <th className="border border-blue-500 p-2 font-semibold print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agadirData1.map((row, index) => (
                      <tr key={index} className="hover:bg-blue-100 transition-colors duration-150">
                        <td className="border border-gray-300 p-2 text-center font-semibold bg-gray-50">{row.palette}</td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="number"
                            value={row.nrCaisse}
                            onChange={(e) => updateAgadirCell1(index, 'nrCaisse', e.target.value)}
                            className="w-full p-2 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="number"
                            value={row.tare}
                            onChange={(e) => updateAgadirCell1(index, 'tare', e.target.value)}
                            className="w-full p-2 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="number"
                            value={row.poidsBrut}
                            onChange={(e) => updateAgadirCell1(index, 'poidsBrut', e.target.value)}
                            className="w-full p-2 text-center rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-gray-300 p-1 bg-green-50">
                          <input
                            type="text"
                            value={row.poidsNet}
                            readOnly
                            className="w-full p-2 text-center bg-green-50 font-bold text-green-700 rounded"
                          />
                        </td>
                        <td className="border border-gray-300 p-1 text-center print:hidden">
                          <button
                            onClick={() => deleteAgadirRow1(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors duration-150"
                            disabled={agadirData1.length === 1}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-yellow-100 to-orange-100 font-bold border-t-4 border-orange-400">
                      <td className="border border-gray-300 p-3 text-center text-orange-800">TOTAL</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals1.nrCaisse}</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals1.tare}</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals1.poidsBrut.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals1.poidsNet.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 print:hidden"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Agadir Table 2 */}
            <div className="bg-gradient-to-br from-slate-50 to-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
              <div className="flex justify-between items-center mb-4">
                <EditableTitle 
                  value={table2Title}
                  onChange={setTable2Title}
                  className="text-xl font-bold text-emerald-800"
                  placeholder="Nom du tableau"
                />
                <button
                  onClick={addAgadirRow2}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 print:hidden"
                >
                  <Plus size={18} />
                  Ajouter
                </button>
              </div>
              
              <div className="overflow-x-auto rounded-lg border-2 border-emerald-300">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
                      <th className="border border-emerald-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.palette} onChange={(val) => setAgadirHeaders({...agadirHeaders, palette: val})} />
                      </th>
                      <th className="border border-emerald-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.nrCaisse} onChange={(val) => setAgadirHeaders({...agadirHeaders, nrCaisse: val})} />
                      </th>
                      <th className="border border-emerald-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.tare} onChange={(val) => setAgadirHeaders({...agadirHeaders, tare: val})} />
                      </th>
                      <th className="border border-emerald-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.poidsBrut} onChange={(val) => setAgadirHeaders({...agadirHeaders, poidsBrut: val})} />
                      </th>
                      <th className="border border-emerald-500 p-2 font-semibold">
                        <EditableHeader value={agadirHeaders.poidsNet} onChange={(val) => setAgadirHeaders({...agadirHeaders, poidsNet: val})} />
                      </th>
                      <th className="border border-emerald-500 p-2 font-semibold print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agadirData2.map((row, index) => (
                      <tr key={index} className="hover:bg-emerald-100 transition-colors duration-150">
                        <td className="border border-gray-300 p-2 text-center font-semibold bg-gray-50">{row.palette}</td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="number"
                            value={row.nrCaisse}
                            onChange={(e) => updateAgadirCell2(index, 'nrCaisse', e.target.value)}
                            className="w-full p-2 text-center rounded border border-gray-300 focus:border-emerald-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="number"
                            value={row.tare}
                            onChange={(e) => updateAgadirCell2(index, 'tare', e.target.value)}
                            className="w-full p-2 text-center rounded border border-gray-300 focus:border-emerald-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="number"
                            value={row.poidsBrut}
                            onChange={(e) => updateAgadirCell2(index, 'poidsBrut', e.target.value)}
                            className="w-full p-2 text-center rounded border border-gray-300 focus:border-emerald-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-gray-300 p-1 bg-green-50">
                          <input
                            type="text"
                            value={row.poidsNet}
                            readOnly
                            className="w-full p-2 text-center bg-green-50 font-bold text-green-700 rounded"
                          />
                        </td>
                        <td className="border border-gray-300 p-1 text-center print:hidden">
                          <button
                            onClick={() => deleteAgadirRow2(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors duration-150"
                            disabled={agadirData2.length === 1}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-yellow-100 to-orange-100 font-bold border-t-4 border-orange-400">
                      <td className="border border-gray-300 p-3 text-center text-orange-800">TOTAL</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals2.nrCaisse}</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals2.tare}</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals2.poidsBrut.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-center text-orange-800">{totals2.poidsNet.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 print:hidden"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-white rounded-lg shadow-lg px-8 py-4 print:shadow-none">
            <p className="text-gray-600 text-sm font-medium">
              © 2024/2025 - Système de Gestion Industrielle des Déchets d'Avocats
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Plateforme professionnelle de suivi et d'analyse
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          input, select {
            border: none !important;
            background: transparent !important;
          }
          .bg-gradient-to-r,
          .bg-gradient-to-br,
          .bg-gradient-to-l {
            background: white !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}