import React, { useState, useEffect } from 'react';
import { getQualityControlLots } from '@/lib/qualityControlService';

const QualityControlDebug: React.FC = () => {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLots = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const controllerLots = await getQualityControlLots('controller');
        console.log('Fetched lots:', controllerLots);
        
        // Check for duplicates
        const ids = controllerLots.map(lot => lot.id);
        const uniqueIds = Array.from(new Set(ids));
        const hasDuplicates = ids.length !== uniqueIds.length;
        
        if (hasDuplicates) {
          console.warn('Duplicate lot IDs found:', ids);
        }
        
        setLots(controllerLots);
      } catch (err: any) {
        console.error('Error fetching lots:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLots();
  }, []);

  if (loading) return <div className="p-4">Loading lots...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Quality Control Debug</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Lot Summary</h2>
        <div className="bg-gray-100 p-3 rounded-lg">
          <p><strong>Total Lots:</strong> {lots.length}</p>
          <p><strong>Unique IDs:</strong> {new Set(lots.map(lot => lot.id)).size}</p>
          <p><strong>Has Duplicates:</strong> {lots.length !== new Set(lots.map(lot => lot.id)).size ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Lot Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Lot Number</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Phase</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Created</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Controller</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, index) => (
                <tr key={`${lot.id}-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-300 px-4 py-2 font-mono text-sm">{lot.id}</td>
                  <td className="border border-gray-300 px-4 py-2">{lot.lotNumber}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      lot.status === 'completed' ? 'bg-green-100 text-green-800' :
                      lot.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {lot.status}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      lot.phase === 'chief' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {lot.phase}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">
                    {new Date(lot.createdAt).toLocaleString()}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">{lot.controller || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lots.length === 0 && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          No lots found. This is normal if you haven't created any quality control lots yet.
        </div>
      )}
    </div>
  );
};

export default QualityControlDebug;
