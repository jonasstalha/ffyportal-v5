import React, { useState } from 'react';
import { Plus, Download, Edit2, Trash2, Search, FileText, Save, X } from 'lucide-react';

const ReceptionApp = () => {
  const [activeTab, setActiveTab] = useState('conv');
  const [convData, setConvData] = useState([]);
  const [bioData, setBioData] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [formData, setFormData] = useState({
    date: '',
    numLot: '',
    interne: '',
    matricule: '',
    chauffeur: '',
    poidsNetUsine: '',
    dechet: '',
    feurte: '',
    poidsNetTicket: '',
    ecart: 0,
    lieu: '',
    variete: ''
  });

  const [errors, setErrors] = useState({});

  const currentData = activeTab === 'conv' ? convData : bioData;
  const setCurrentData = activeTab === 'conv' ? setConvData : setBioData;

  const calculateEcart = (poidsUsine, poidsTicket) => {
    const usine = parseFloat(poidsUsine) || 0;
    const ticket = parseFloat(poidsTicket) || 0;
    return usine - ticket;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    
    if (name === 'poidsNetUsine' || name === 'poidsNetTicket') {
      newFormData.ecart = calculateEcart(newFormData.poidsNetUsine, newFormData.poidsNetTicket);
    }
    
    setFormData(newFormData);
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.date) newErrors.date = 'Date requise';
    if (!formData.numLot) newErrors.numLot = 'N° LOT requis';
    if (!formData.interne) newErrors.interne = 'INTERNE requis';
    if (!formData.matricule) newErrors.matricule = 'Matricule requis';
    if (!formData.chauffeur) newErrors.chauffeur = 'Chauffeur requis';
    if (!formData.poidsNetUsine) newErrors.poidsNetUsine = 'Poids Net Usine requis';
    if (!formData.poidsNetTicket) newErrors.poidsNetTicket = 'Poids Net Ticket requis';
    if (!formData.lieu) newErrors.lieu = 'Lieu requis';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      date: '',
      numLot: '',
      interne: '',
      matricule: '',
      chauffeur: '',
      poidsNetUsine: '',
      dechet: '',
      feurte: '',
      poidsNetTicket: '',
      ecart: 0,
      lieu: '',
      variete: ''
    });
    setErrors({});
    setShowAddForm(false);
    setIsEditing(null);
  };

  const handleAdd = () => {
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newEntry = {
      ...formData,
      id: Date.now(),
      poidsNetUsine: parseFloat(formData.poidsNetUsine) || 0,
      dechet: parseFloat(formData.dechet) || 0,
      feurte: parseFloat(formData.feurte) || 0,
      poidsNetTicket: parseFloat(formData.poidsNetTicket) || 0,
      ecart: calculateEcart(formData.poidsNetUsine, formData.poidsNetTicket),
      variete: activeTab === 'conv' ? 'HASS CONV' : 'HASS BIO'
    };
    
    setCurrentData([...currentData, newEntry]);
    resetForm();
    alert('Ligne ajoutée avec succès!');
  };

  const handleEdit = (item) => {
    setIsEditing(item.id);
    setFormData({
      ...item,
      poidsNetUsine: item.poidsNetUsine.toString(),
      dechet: item.dechet.toString(),
      feurte: item.feurte.toString(),
      poidsNetTicket: item.poidsNetTicket.toString()
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = () => {
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const updatedEntry = {
      ...formData,
      id: isEditing,
      poidsNetUsine: parseFloat(formData.poidsNetUsine) || 0,
      dechet: parseFloat(formData.dechet) || 0,
      feurte: parseFloat(formData.feurte) || 0,
      poidsNetTicket: parseFloat(formData.poidsNetTicket) || 0,
      ecart: calculateEcart(formData.poidsNetUsine, formData.poidsNetTicket),
      variete: activeTab === 'conv' ? 'HASS CONV' : 'HASS BIO'
    };

    setCurrentData(currentData.map(item => 
      item.id === isEditing ? updatedEntry : item
    ));
    resetForm();
    alert('Ligne mise à jour avec succès!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette ligne?\nCette action est irréversible.')) {
      setCurrentData(currentData.filter(item => item.id !== id));
      alert('Ligne supprimée avec succès!');
    }
  };

  const filteredData = currentData.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const generatePDF = () => {
    if (currentData.length === 0) {
      alert('Aucune donnée à exporter!');
      return;
    }

    const data = activeTab === 'conv' ? convData : bioData;
    const type = activeTab === 'conv' ? 'CONVENTIONNEL' : 'BIOLOGIQUE';
    
    const totalPoidsUsine = data.reduce((sum, item) => sum + parseFloat(item.poidsNetUsine || 0), 0);
    const totalDechet = data.reduce((sum, item) => sum + parseFloat(item.dechet || 0), 0);
    const totalFeurte = data.reduce((sum, item) => sum + parseFloat(item.feurte || 0), 0);
    const totalPoidsTicket = data.reduce((sum, item) => sum + parseFloat(item.poidsNetTicket || 0), 0);
    const totalEcart = data.reduce((sum, item) => sum + parseFloat(item.ecart || 0), 0);
    
    const content = `
═══════════════════════════════════════════════════════════════════
        RAPPORT DE RÉCEPTION AVOCAT ${type}
        Année 2024/2025
═══════════════════════════════════════════════════════════════════

Date d'impression: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}
Total Lignes: ${data.length}

${data.map((item, idx) => `
───────────────────────────────────────────────────────────────────
Ligne ${idx + 1}
───────────────────────────────────────────────────────────────────
Date:                ${item.date}
N° LOT:              ${item.numLot}
INTERNE:             ${item.interne}
Matricule:           ${item.matricule}
Chauffeur:           ${item.chauffeur}
Poids Net Usine:     ${item.poidsNetUsine} kg
Déchet:              ${item.dechet} kg
FEURTE:              ${item.feurte} kg
Poids Net Ticket:    ${item.poidsNetTicket} kg
ÉCART:               ${item.ecart} kg ${item.ecart < 0 ? '(NÉGATIF)' : item.ecart > 0 ? '(POSITIF)' : ''}
Lieu:                ${item.lieu}
Variété:             ${item.variete}
`).join('\n')}

═══════════════════════════════════════════════════════════════════
                          TOTAUX GÉNÉRAUX
═══════════════════════════════════════════════════════════════════
Total Poids Net Usine:     ${totalPoidsUsine.toFixed(2)} kg
Total Déchet:              ${totalDechet.toFixed(2)} kg
Total FEURTE:              ${totalFeurte.toFixed(2)} kg
Total Poids Net Ticket:    ${totalPoidsTicket.toFixed(2)} kg
Total ÉCART:               ${totalEcart.toFixed(2)} kg
═══════════════════════════════════════════════════════════════════

Fin du rapport
    `;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapport_Reception_${type}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Rapport téléchargé avec succès!');
  };

  const downloadCSV = () => {
    if (currentData.length === 0) {
      alert('Aucune donnée à exporter!');
      return;
    }

    const data = activeTab === 'conv' ? convData : bioData;
    const headers = ['DATE', 'N° LOT', 'INTERNE', 'Matricule', 'Chauffeur', 'Poids Net Usine', 'Déchet', 'FEURTE', 'Poids Net Ticket', 'ÉCART', 'LE LIEU', 'VARIÉTÉ'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        item.date,
        `"${item.numLot}"`,
        item.interne,
        `"${item.matricule}"`,
        `"${item.chauffeur}"`,
        item.poidsNetUsine,
        item.dechet,
        item.feurte,
        item.poidsNetTicket,
        item.ecart,
        `"${item.lieu}"`,
        `"${item.variete}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reception_${activeTab.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Fichier CSV téléchargé avec succès!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📋 Réception Avocat HASS 2024/2025
          </h1>
          <p className="text-gray-600">Système de Gestion Complet des Réceptions</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => {
                setActiveTab('conv');
                resetForm();
              }}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'conv'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🌱 CONVENTIONNEL ({convData.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('bio');
                resetForm();
              }}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'bio'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🌿 BIOLOGIQUE ({bioData.length})
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  resetForm();
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md font-semibold"
            >
              <Plus size={20} />
              {showAddForm ? 'Fermer Formulaire' : 'Ajouter Nouvelle Ligne'}
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md font-semibold"
              disabled={currentData.length === 0}
            >
              <Download size={20} />
              Exporter Excel (CSV)
            </button>
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md font-semibold"
              disabled={currentData.length === 0}
            >
              <FileText size={20} />
              Générer Rapport
            </button>
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher dans tous les champs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {showAddForm && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {isEditing ? '✏️ Modifier la Ligne' : '➕ Nouvelle Ligne'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.date ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">N° LOT *</label>
                  <input
                    type="text"
                    name="numLot"
                    value={formData.numLot}
                    onChange={handleInputChange}
                    placeholder="Ex: 01-0329"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.numLot ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.numLot && <p className="text-red-500 text-xs mt-1">{errors.numLot}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">INTERNE *</label>
                  <input
                    type="text"
                    name="interne"
                    value={formData.interne}
                    onChange={handleInputChange}
                    placeholder="Ex: 79827"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.interne ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.interne && <p className="text-red-500 text-xs mt-1">{errors.interne}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Matricule *</label>
                  <input
                    type="text"
                    name="matricule"
                    value={formData.matricule}
                    onChange={handleInputChange}
                    placeholder="Ex: A 40"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.matricule ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.matricule && <p className="text-red-500 text-xs mt-1">{errors.matricule}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Chauffeur *</label>
                  <input
                    type="text"
                    name="chauffeur"
                    value={formData.chauffeur}
                    onChange={handleInputChange}
                    placeholder="Ex: ABDERAHIM"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.chauffeur ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.chauffeur && <p className="text-red-500 text-xs mt-1">{errors.chauffeur}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Poids Net Usine (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="poidsNetUsine"
                    value={formData.poidsNetUsine}
                    onChange={handleInputChange}
                    placeholder="Ex: 2338"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.poidsNetUsine ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.poidsNetUsine && <p className="text-red-500 text-xs mt-1">{errors.poidsNetUsine}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Déchet (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="dechet"
                    value={formData.dechet}
                    onChange={handleInputChange}
                    placeholder="Ex: 0"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">FEURTE (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="feurte"
                    value={formData.feurte}
                    onChange={handleInputChange}
                    placeholder="Ex: 0"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Poids Net Ticket (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="poidsNetTicket"
                    value={formData.poidsNetTicket}
                    onChange={handleInputChange}
                    placeholder="Ex: 2338"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.poidsNetTicket ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.poidsNetTicket && <p className="text-red-500 text-xs mt-1">{errors.poidsNetTicket}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ÉCART (kg) - Calculé Auto</label>
                  <input
                    type="number"
                    step="0.01"
                    name="ecart"
                    value={formData.ecart}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 font-bold"
                    disabled
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">LE LIEU *</label>
                  <input
                    type="text"
                    name="lieu"
                    value={formData.lieu}
                    onChange={handleInputChange}
                    placeholder="Ex: FOUARAT (MORAD)"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.lieu ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lieu && <p className="text-red-500 text-xs mt-1">{errors.lieu}</p>}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={isEditing ? handleUpdate : handleAdd}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md font-bold"
                >
                  <Save size={20} />
                  {isEditing ? 'Mettre à Jour' : 'Enregistrer'}
                </button>
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition shadow-md font-bold"
                >
                  <X size={20} />
                  Annuler
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">* Champs obligatoires</p>
            </div>
          )}

          <div className="overflow-x-auto shadow-lg rounded-lg">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">DATE</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">N° LOT</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">INTERNE</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">Matricule</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">Chauffeur</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">Poids Net Usine</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">Déchet</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">FEURTE</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">Poids Net Ticket</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">ÉCART</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">LE LIEU</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">VARIÉTÉ</th>
                  <th className="border border-gray-700 px-3 py-3 text-center text-xs font-bold">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.date}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm font-semibold">{item.numLot}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.interne}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.matricule}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.chauffeur}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">{item.poidsNetUsine}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">{item.dechet}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">{item.feurte}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">{item.poidsNetTicket}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-right text-sm font-bold ${
                        item.ecart < 0 ? 'text-red-600 bg-red-50' : item.ecart > 0 ? 'text-green-600 bg-green-50' : 'text-gray-600'
                      }`}>
                        {item.ecart}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.lieu}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          activeTab === 'bio' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.variete}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="13" className="border border-gray-300 px-3 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <div className="text-6xl mb-4">📦</div>
                        <p className="text-xl font-semibold mb-2">Aucune donnée disponible</p>
                        <p className="text-sm">Cliquez sur "Ajouter Nouvelle Ligne" pour commencer à saisir des données</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-yellow-100 to-yellow-200 font-bold">
                    <td colSpan="5" className="border border-gray-400 px-3 py-3 text-sm uppercase">
                      📊 TOTAUX
                    </td>
                    <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                      {filteredData.reduce((sum, item) => sum + parseFloat(item.poidsNetUsine || 0), 0).toFixed(2)} kg
                    </td>
                    <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                      {filteredData.reduce((sum, item) => sum + parseFloat(item.dechet || 0), 0).toFixed(2)} kg
                    </td>
                    <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                      {filteredData.reduce((sum, item) => sum + parseFloat(item.feurte || 0), 0).toFixed(2)} kg
                    </td>
                    <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                      {filteredData.reduce((sum, item) => sum + parseFloat(item.poidsNetTicket || 0), 0).toFixed(2)} kg
                    </td>
                    <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                      {filteredData.reduce((sum, item) => sum + parseFloat(item.ecart || 0), 0).toFixed(2)} kg
                    </td>
                    <td colSpan="3" className="border border-gray-400"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {filteredData.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-bold text-gray-800 mb-2">📈 Statistiques</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Total Lignes</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredData.length}</p>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Poids Total Usine</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredData.reduce((sum, item) => sum + parseFloat(item.poidsNetUsine || 0), 0).toFixed(0)} kg
                  </p>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Poids Total Ticket</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {filteredData.reduce((sum, item) => sum + parseFloat(item.poidsNetTicket || 0), 0).toFixed(0)} kg
                  </p>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Écart Total</p>
                  <p className={`text-2xl font-bold ${
                    filteredData.reduce((sum, item) => sum + parseFloat(item.ecart || 0), 0) < 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {filteredData.reduce((sum, item) => sum + parseFloat(item.ecart || 0), 0).toFixed(0)} kg
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReceptionApp;