import React, { useState, useEffect } from 'react';
import { getQualityControlLotsForRapport } from '../lib/qualityControlService';
import { Loader2, Database, CheckCircle, AlertTriangle } from 'lucide-react';

const FirebaseLotsDebug: React.FC = () => {
  const [lots, setLots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const loadLots = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Loading lots from Firebase...');
      
      const data = await getQualityControlLotsForRapport();
      console.log('Raw Firebase data:', data);
      
      setLots(data);
      setLastUpdate(new Date().toLocaleString());
      
      if (data.length === 0) {
        setError('No lots found. Make sure you have saved some quality control data first.');
      }
    } catch (err) {
      console.error('Error loading lots:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLots();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6" />
            Firebase Lots Debug Tool
          </h2>
          <button
            onClick={loadLots}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {lastUpdate && (
          <div className="mb-4 text-sm text-gray-500">
            Last updated: {lastUpdate}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-2 text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-800">{lots.length}</div>
            <div className="text-blue-600">Total Lots</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-800">
              {lots.filter(lot => lot.status === 'completed').length}
            </div>
            <div className="text-green-600">Completed</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-800">
              {lots.reduce((total, lot) => total + (lot.calibres?.length || 0), 0)}
            </div>
            <div className="text-purple-600">Total Calibres</div>
          </div>
        </div>

        {lots.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Lots Data Preview</h3>
            {lots.map((lot, index) => (
              <div key={lot.id || index} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">Basic Info</h4>
                    <div className="mt-2 space-y-1 text-sm">
                      <div><span className="text-gray-500">ID:</span> {lot.id}</div>
                      <div><span className="text-gray-500">Lot Number:</span> {lot.lotNumber}</div>
                      <div><span className="text-gray-500">Date:</span> {lot.date}</div>
                      <div><span className="text-gray-500">Controller:</span> {lot.controller}</div>
                      <div><span className="text-gray-500">Status:</span> {lot.status}</div>
                      <div><span className="text-gray-500">Reference:</span> {lot.palletNumber}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Calibres</h4>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lot.calibres && lot.calibres.length > 0 ? (
                        lot.calibres.map((calibre: any, idx: number) => (
                          <span 
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {calibre}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">No calibres</span>
                      )}
                    </div>
                    {lot.formData && (
                      <div className="mt-2 text-xs text-gray-500">
                        <div>Product: {lot.formData.product || 'N/A'}</div>
                        <div>Variety: {lot.formData.variety || 'N/A'}</div>
                        <div>Palettes: {lot.formData.palettes?.length || 0}</div>
                      </div>
                    )}
                  </div>
                </div>
                
                {lot.formData && lot.formData.palettes && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                      View Palette Details ({lot.formData.palettes.length} palettes)
                    </summary>
                    <div className="mt-2 p-3 bg-white rounded border text-xs">
                      <pre className="overflow-auto">
                        {JSON.stringify(lot.formData.palettes.slice(0, 3), null, 2)}
                        {lot.formData.palettes.length > 3 && '\n... and more palettes'}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {lots.length === 0 && !isLoading && !error && (
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Lots Found</h3>
            <p className="text-gray-500">
              No quality control lots found in Firebase. 
              <br />
              Make sure to save some lots from the Quality Control page first.
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">How to get lots:</h4>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Go to the Quality Control page</li>
            <li>2. Fill out a complete quality control form</li>
            <li>3. Click "Sauvegarder" to save to Firebase</li>
            <li>4. The lot will appear here once saved</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default FirebaseLotsDebug;
