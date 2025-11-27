
import React, { useState } from 'react';
import { Download, Package, CheckCircle, Truck, FlaskConical, Calculator, Tractor, Users } from 'lucide-react';

const DocumentTemplates: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const categories = [
        { id: 'packaging', name: 'Emballage', icon: Package, color: '#10B981' },
        { id: 'quality', name: 'Qualité', icon: CheckCircle, color: '#06B6D4' },
        { id: 'logistics', name: 'Logistique / Export', icon: Truck, color: '#F59E0B' },
        { id: 'sanitary', name: 'Sanitaire / Réglementaire', icon: FlaskConical, color: '#EF4444' },
        { id: 'accounting', name: 'Comptabilité / Achat / Vente', icon: Calculator, color: '#8B5CF6' },
        { id: 'production', name: 'Production / Ferme', icon: Tractor, color: '#84CC16' },
        { id: 'hr', name: 'Ressources Humaines', icon: Users, color: '#F97316' },
    ];

    const documents = [
        // Emballage
        { id: 'pack-1', title: 'Rapport d\'emballage', description: 'Document de suivi des opérations d\'emballage', category: 'packaging' },
        { id: 'pack-2', title: 'Facture d\'achat de cartons', description: 'Facture pour l\'achat de matériaux d\'emballage', category: 'packaging' },
        { id: 'pack-3', title: 'Bon de sortie de stock', description: 'Document de sortie des produits du stock', category: 'packaging' },
        { id: 'pack-4', title: 'Suivi de lot emballé', description: 'Traçabilité des lots emballés', category: 'packaging' },
        { id: 'pack-5', title: 'Rapport de conditionnement', description: 'Rapport détaillé du processus de conditionnement', category: 'packaging' },

        // Qualité
        { id: 'qual-1', title: 'Rapport qualité (contrôle interne)', description: 'Contrôle qualité interne des produits', category: 'quality' },
        { id: 'qual-2', title: 'Rapport pré-export', description: 'Contrôle qualité avant exportation', category: 'quality' },
        { id: 'qual-3', title: 'Rapport de tri', description: 'Document de tri et classification des produits', category: 'quality' },
        { id: 'qual-4', title: 'Fiche de calibration', description: 'Calibration et mesures des produits', category: 'quality' },
        { id: 'qual-5', title: 'Rapport maturité', description: 'Évaluation de la maturité des produits', category: 'quality' },
        { id: 'qual-6', title: 'Fiche de non-conformité', description: 'Signalement des non-conformités détectées', category: 'quality' },

        // Logistique / Export
        { id: 'log-1', title: 'Facture commerciale (Commercial Invoice)', description: 'Facture commerciale pour export', category: 'logistics' },
        { id: 'log-2', title: 'Packing List', description: 'Liste détaillée du contenu des colis', category: 'logistics' },
        { id: 'log-3', title: 'Bon de livraison', description: 'Document de livraison des marchandises', category: 'logistics' },
        { id: 'log-4', title: 'Rapport de chargement', description: 'Rapport des opérations de chargement', category: 'logistics' },
        { id: 'log-5', title: 'Rapport de transport', description: 'Suivi et rapport de transport', category: 'logistics' },
        { id: 'log-6', title: 'Bill of Lading (B/L)', description: 'Connaissement maritime', category: 'logistics' },
        { id: 'log-7', title: 'Rapport de température', description: 'Suivi de la chaîne du froid', category: 'logistics' },

        // Sanitaire / Réglementaire
        { id: 'san-1', title: 'Certificat phytosanitaire (phyto)', description: 'Certificat phytosanitaire officiel', category: 'sanitary' },
        { id: 'san-2', title: 'Rapport ONSSA', description: 'Rapport de l\'Office National de Sécurité Sanitaire', category: 'sanitary' },
        { id: 'san-3', title: 'Certificat d\'origine', description: 'Certificat d\'origine des produits', category: 'sanitary' },
        { id: 'san-4', title: 'Rapport audit interne (ONSSA, GlobalG.A.P)', description: 'Rapports d\'audits de certification', category: 'sanitary' },
        { id: 'san-5', title: 'Fiche HACCP', description: 'Fiche de contrôle HACCP', category: 'sanitary' },

        // Comptabilité / Achat / Vente
        { id: 'acc-1', title: 'Facture fournisseur', description: 'Facture reçue d\'un fournisseur', category: 'accounting' },
        { id: 'acc-2', title: 'Facture client', description: 'Facture émise pour un client', category: 'accounting' },
        { id: 'acc-3', title: 'Facture transport', description: 'Facture des services de transport', category: 'accounting' },
        { id: 'acc-4', title: 'Bordereau de paiement', description: 'Bordereau de paiement bancaire', category: 'accounting' },
        { id: 'acc-5', title: 'Reçu bancaire', description: 'Reçu de transaction bancaire', category: 'accounting' },
        { id: 'acc-6', title: 'Relevé de compte', description: 'Relevé de compte bancaire', category: 'accounting' },
        { id: 'acc-7', title: 'Devis', description: 'Devis commercial', category: 'accounting' },

        // Production / Ferme
        { id: 'prod-1', title: 'Rapport de récolte', description: 'Rapport des opérations de récolte', category: 'production' },
        { id: 'prod-2', title: 'Rapport journalier de production', description: 'Rapport quotidien de production', category: 'production' },
        { id: 'prod-3', title: 'Rapport de traitement phytosanitaire', description: 'Suivi des traitements phytosanitaires', category: 'production' },
        { id: 'prod-4', title: 'Fiche de parcelle', description: 'Informations détaillées par parcelle', category: 'production' },
        { id: 'prod-5', title: 'Journal des activités agricoles', description: 'Journal quotidien des activités', category: 'production' },

        // Ressources Humaines
        { id: 'hr-1', title: 'Fiche de paie ouvrier', description: 'Bulletin de salaire des ouvriers', category: 'hr' },
        { id: 'hr-2', title: 'Fiche présence', description: 'Fiche de présence du personnel', category: 'hr' },
        { id: 'hr-3', title: 'Rapport heures travaillées', description: 'Rapport des heures de travail', category: 'hr' },
        { id: 'hr-4', title: 'Bulletin de salaire', description: 'Bulletin de salaire mensuel', category: 'hr' },
        { id: 'hr-5', title: 'Contrat ouvrier', description: 'Contrat de travail des ouvriers', category: 'hr' },
        { id: 'hr-6', title: 'Rapport de performance journalier', description: 'Évaluation quotidienne de performance', category: 'hr' },
    ];

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doc.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getCategoryColor = (categoryId: string) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.color : '#6B7280';
    };

    const downloadDocument = (docId: string) => {
        console.log(`Téléchargement du document ${docId}`);
        // Implémentation du téléchargement
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        Gestion des Documents
                    </h1>
                    <p className="text-gray-600">
                        Système de gestion des documents agricoles et commerciaux
                    </p>
                </div>

                {/* Search and Filters */}
                <div className="mb-8 space-y-4">
                    <div className="flex justify-center">
                        <input
                            type="text"
                            placeholder="Rechercher un document..."
                            className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Category Filters */}
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                selectedCategory === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Tous
                        </button>
                        {categories.map((category) => {
                            const IconComponent = category.icon;
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                                        selectedCategory === category.id
                                            ? 'text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                                    style={{
                                        backgroundColor: selectedCategory === category.id ? category.color : undefined,
                                    }}
                                >
                                    <IconComponent size={16} />
                                    {category.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredDocuments.map((doc) => {
                        const category = categories.find(cat => cat.id === doc.category);
                        const IconComponent = category?.icon || Package;
                        
                        return (
                            <div
                                key={doc.id}
                                className={`bg-white rounded-xl p-6 shadow-sm border border-gray-200 transition-all duration-300 cursor-pointer ${
                                    hoveredId === doc.id ? 'shadow-lg -translate-y-1' : ''
                                }`}
                                onMouseEnter={() => setHoveredId(doc.id)}
                                onMouseLeave={() => setHoveredId(null)}
                            >
                                {/* Category Badge */}
                                <div className="flex items-center justify-between mb-4">
                                    <div 
                                        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-white"
                                        style={{ backgroundColor: getCategoryColor(doc.category) }}
                                    >
                                        <IconComponent size={14} />
                                        {category?.name}
                                    </div>
                                </div>

                                {/* Document Icon */}
                                <div 
                                    className="w-16 h-16 rounded-lg flex items-center justify-center mb-4 mx-auto"
                                    style={{ backgroundColor: `${getCategoryColor(doc.category)}20` }}
                                >
                                    <IconComponent 
                                        size={28} 
                                        style={{ color: getCategoryColor(doc.category) }}
                                    />
                                </div>

                                {/* Content */}
                                <h3 className="font-semibold text-gray-800 mb-2 text-center line-clamp-2">
                                    {doc.title}
                                </h3>
                                <p className="text-gray-600 text-sm mb-4 text-center line-clamp-3">
                                    {doc.description}
                                </p>

                                {/* Download Button */}
                                <button
                                    onClick={() => downloadDocument(doc.id)}
                                    className={`w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                        hoveredId === doc.id
                                            ? 'text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                    style={{
                                        backgroundColor: hoveredId === doc.id ? getCategoryColor(doc.category) : undefined,
                                        color: hoveredId === doc.id ? 'white' : undefined,
                                    }}
                                >
                                    <Download size={16} />
                                    Télécharger
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* No Results */}
                {filteredDocuments.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                            <Package size={64} className="mx-auto" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-600 mb-2">
                            Aucun document trouvé
                        </h3>
                        <p className="text-gray-500">
                            Essayez de modifier vos critères de recherche
                        </p>
                    </div>
                )}

                {/* Stats */}
                <div className="mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {categories.map((category) => {
                        const count = documents.filter(doc => doc.category === category.id).length;
                        const IconComponent = category.icon;
                        
                        return (
                            <div 
                                key={category.id}
                                className="bg-white rounded-lg p-4 text-center border border-gray-200"
                            >
                                <div 
                                    className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
                                    style={{ backgroundColor: `${category.color}20` }}
                                >
                                    <IconComponent size={20} style={{ color: category.color }} />
                                </div>
                                <div className="text-2xl font-bold text-gray-800">{count}</div>
                                <div className="text-xs text-gray-600">{category.name}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DocumentTemplates;