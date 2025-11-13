import React from 'react';

const RapportGenerating: React.FC = () => {
    const handleRedirect = () => {
        window.open('https://springgreen-parrot-975992.hostingersite.com/', '_blank');
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <h1 className="text-2xl font-bold mb-4">Generate Your Rapport</h1>
            <p className="text-gray-600 mb-6">Click the button below to visit the rapport generation website.</p>
            <button
                onClick={handleRedirect}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
            >
                Go to Rapportfy
            </button>
        </div>
    );
};

export default RapportGenerating;