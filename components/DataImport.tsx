
import React, { useState } from 'react';
import { WeeklyPrice } from '../types';

interface Props {
  onImport: (data: WeeklyPrice[]) => void;
}

const DataImport: React.FC<Props> = ({ onImport }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleImport = () => {
    try {
      if (!input.trim()) return;
      const rawData = JSON.parse(input);
      
      if (!Array.isArray(rawData)) {
        throw new Error('Data must be an array (e.g. [[timestamp, "open", "high", "low"...], ...])');
      }

      const formattedData: WeeklyPrice[] = rawData.map((item: any, index: number) => {
        // We expect at least timestamp and price. 
        if (!Array.isArray(item) || item.length < 2) {
           throw new Error(`Item at index ${index} is invalid. Expected array [timestamp, "open", "high", "low"...]`);
        }
        
        const timestamp = item[0];
        const priceStr = item[1]; // Open
        const highPriceStr = item[2]; // High (3rd element)
        const lowPriceStr = item[3]; // Low (4th element)
        
        // Check validation
        if (typeof timestamp !== 'number') throw new Error(`Invalid timestamp at index ${index}`);
        
        const date = new Date(timestamp).toISOString().split('T')[0];
        const openPrice = parseFloat(Number(priceStr).toFixed(2));
        
        // Default lowPrice to openPrice if missing
        let lowPrice = openPrice;
        if (lowPriceStr !== undefined) {
            lowPrice = parseFloat(Number(lowPriceStr).toFixed(2));
        }

        // Default highPrice to openPrice if missing
        let highPrice = openPrice;
        if (highPriceStr !== undefined) {
            highPrice = parseFloat(Number(highPriceStr).toFixed(2));
        }

        if (isNaN(openPrice)) throw new Error(`Invalid price format at index ${index}`);

        return {
          weekIndex: 0, // Will be re-indexed by logic later
          date,
          openPrice,
          lowPrice,
          highPrice
        };
      });

      onImport(formattedData);
      setInput('');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to parse JSON');
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-200">Import Weekly Data (JSON)</h3>
      </div>
      
      <p className="text-xs text-slate-400 mb-3">
        Paste a JSON array of arrays. Expected format: <code className="bg-slate-900 px-1 rounded text-indigo-300">[timestamp, "open", "high", "low", "close"...]</code>. 
        <br/>Index 2 is High, Index 3 is Low.
      </p>
      
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none custom-scrollbar"
        placeholder='[[1757894400000, "115268.01", "116000", "114000.50", ...], ...]'
      />
      
      <div className="flex justify-between items-start mt-3">
        <div className="text-rose-400 text-sm font-medium">
          {error && <span>Error: {error}</span>}
        </div>
        <button
          onClick={handleImport}
          disabled={!input.trim()}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Apply JSON Data
        </button>
      </div>
    </div>
  );
};

export default DataImport;
