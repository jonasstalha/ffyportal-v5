import React, { useState, useEffect, useMemo } from 'react';
import { Weight, Plus, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

// Weight constants per box (kg)
const WEIGHT_PER_BOX = {
    net: 4.8,
    brut: 5.3
};

// Types
interface InvoiceTemplate {
    id: string;
    name: string;
    type: 'standard' | 'proforma' | 'delivery';
    header: {
        companyName: string;
        address: string;
        city: string;
        country: string;
        phoneNumber: string;
        email: string;
    };
    footer: {
        paymentTerms: string;
        bankDetails: {
            bankName: string;
            accountNumber: string;
            iban: string;
            swift: string;
        };
        notes: string;
    };
    weightCalculation: boolean;
    createdAt: string;
    updatedAt: string;
}

// Default template
const defaultTemplate: InvoiceTemplate = {
    id: `template-${Date.now()}`,
    name: 'Template Standard',
    type: 'standard',
    header: {
        companyName: 'FRUITS FOR YOU',
        address: 'Lot N°14 Rez De Chaussée Zone Industrielle',
        city: 'Kénitra',
        country: 'Maroc',
        phoneNumber: '+212 5XX-XXXXXX',
        email: 'contact@fruitsforyou.ma'
    },
    footer: {
        paymentTerms: 'Paiement à 30 jours',
        bankDetails: {
            bankName: 'Banque Populaire',
            accountNumber: 'XXXXXXXXXXXXX',
            iban: 'MAXX XXXX XXXX XXXX XXXX XXXX XXX',
            swift: 'BCPOMAMC'
        },
        notes: 'Merci de votre confiance'
    },
    weightCalculation: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

// List of roles that can access invoice templates
const ALLOWED_ROLES = ['admin', 'logistics', 'comptabilite']; 

export default function FacturesTemplates(): JSX.Element {
    const { user } = useAuth();

    // Check for access
    if (!user || !user.role || !ALLOWED_ROLES.includes(user.role)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold text-red-600 mb-4">Accès Refusé</h2>
                    <p className="text-gray-600">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
                    <Button 
                        onClick={() => window.history.back()}
                        className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                    >
                        Retour
                    </Button>
                </div>
            </div>
        );
    }

    // State management
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([defaultTemplate]);
    const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Load templates from localStorage
    useEffect(() => {
        const savedTemplates = localStorage.getItem('invoiceTemplates');
        if (savedTemplates) {
            setTemplates(JSON.parse(savedTemplates));
        } else {
            localStorage.setItem('invoiceTemplates', JSON.stringify([defaultTemplate]));
        }
    }, []);

    // Save templates to localStorage
    useEffect(() => {
        if (templates.length > 0) {
            localStorage.setItem('invoiceTemplates', JSON.stringify(templates));
        }
    }, [templates]);

    // Filter templates
    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            const matchesSearch = 
                template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                template.header.companyName.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesFilter = filter === 'all' || template.type === filter;
            
            return matchesSearch && matchesFilter;
        });
    }, [templates, searchTerm, filter]);

    // Create new template
    const createNewTemplate = () => {
        const newTemplate: InvoiceTemplate = {
            ...defaultTemplate,
            id: `template-${Date.now()}`,
            name: `Template ${templates.length + 1}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setTemplates(prevTemplates => [...prevTemplates, newTemplate]);
        setSelectedTemplate(newTemplate);
        setIsEditing(true);
    };

    // Save template changes
    const saveTemplate = (template: InvoiceTemplate) => {
        const updatedTemplate = {
            ...template,
            updatedAt: new Date().toISOString()
        };

        setTemplates(prevTemplates =>
            prevTemplates.map(t => t.id === template.id ? updatedTemplate : t)
        );
        setSelectedTemplate(updatedTemplate);
        setIsEditing(false);
    };

    // Calculate weights
    const calculateWeights = (boxes: number): { net: string; gross: string; } => ({
        net: (boxes * WEIGHT_PER_BOX.net).toFixed(2),
        gross: (boxes * WEIGHT_PER_BOX.brut).toFixed(2)
    });

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-md shadow-sm border border-gray-200 mb-6">
                    <div className="bg-emerald-600 px-4 py-3 rounded-t-md flex justify-between items-center">
                        <h1 className="text-white font-semibold text-lg">Modèles de Factures</h1>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Rechercher..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-64 bg-white/10 text-white placeholder:text-white/60"
                                />
                                <Select value={filter} onValueChange={setFilter}>
                                    <SelectTrigger className="bg-white/10 text-white border-white/20">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les types</SelectItem>
                                        <SelectItem value="standard">Standard</SelectItem>
                                        <SelectItem value="proforma">Proforma</SelectItem>
                                        <SelectItem value="delivery">Livraison</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button 
                                onClick={createNewTemplate}
                                className="bg-white text-emerald-600 hover:bg-emerald-50"
                            >
                                <Plus size={16} className="mr-2" />
                                Nouveau Modèle
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {selectedTemplate ? (
                            <div className="space-y-6">
                                {/* Template Editor */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Header Section */}
                                    <div className="space-y-4">
                                        <h2 className="font-semibold text-gray-700 text-lg">En-tête</h2>
                                        <div className="space-y-3">
                                            <div>
                                                <Label>Nom de l'entreprise</Label>
                                                <Input
                                                    value={selectedTemplate.header.companyName}
                                                    onChange={(e) => {
                                                        if (!isEditing) return;
                                                        setSelectedTemplate({
                                                            ...selectedTemplate,
                                                            header: {
                                                                ...selectedTemplate.header,
                                                                companyName: e.target.value
                                                            }
                                                        });
                                                    }}
                                                    readOnly={!isEditing}
                                                />
                                            </div>
                                            <div>
                                                <Label>Adresse</Label>
                                                <Input
                                                    value={selectedTemplate.header.address}
                                                    onChange={(e) => {
                                                        if (!isEditing) return;
                                                        setSelectedTemplate({
                                                            ...selectedTemplate,
                                                            header: {
                                                                ...selectedTemplate.header,
                                                                address: e.target.value
                                                            }
                                                        });
                                                    }}
                                                    readOnly={!isEditing}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Section */}
                                    <div className="space-y-4">
                                        <h2 className="font-semibold text-gray-700 text-lg">Pied de page</h2>
                                        <div className="space-y-3">
                                            <div>
                                                <Label>Conditions de paiement</Label>
                                                <Input
                                                    value={selectedTemplate.footer.paymentTerms}
                                                    onChange={(e) => {
                                                        if (!isEditing) return;
                                                        setSelectedTemplate({
                                                            ...selectedTemplate,
                                                            footer: {
                                                                ...selectedTemplate.footer,
                                                                paymentTerms: e.target.value
                                                            }
                                                        });
                                                    }}
                                                    readOnly={!isEditing}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    {isEditing ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    const savedTemplate = templates.find(t => t.id === selectedTemplate.id);
                                                    if (savedTemplate) {
                                                        setSelectedTemplate(savedTemplate);
                                                    }
                                                }}
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                onClick={() => saveTemplate(selectedTemplate)}
                                            >
                                                Enregistrer
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            onClick={() => setIsEditing(true)}
                                        >
                                            Modifier
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTemplates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => setSelectedTemplate(template)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-medium text-gray-900">{template.name}</h3>
                                            <Badge variant={
                                                template.type === 'standard' ? 'default' :
                                                template.type === 'proforma' ? 'secondary' : 
                                                'outline'
                                            }>
                                                {template.type}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-4">
                                            {template.header.companyName}
                                        </p>
                                        <div className="text-xs text-gray-400">
                                            Dernière modification: {new Date(template.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-sm text-emerald-700">
                    <p className="flex items-center gap-2">
                        <Weight size={16} />
                        Les poids sont calculés automatiquement en utilisant les constantes suivantes:
                    </p>
                    <ul className="list-disc list-inside mt-2 ml-4">
                        <li>Poids Net par caisse: {WEIGHT_PER_BOX.net} KG</li>
                        <li>Poids Brut par caisse: {WEIGHT_PER_BOX.brut} KG</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}