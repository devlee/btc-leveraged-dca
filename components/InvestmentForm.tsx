import React from 'react';
import { SimulationParams } from '../types';

interface Props {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  onClear: () => void;
}

const InvestmentForm: React.FC<Props> = ({ params, setParams, onClear }) => {
  
  const handleChange = (key: keyof SimulationParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Initial Capital */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Initial Capital ($)</label>
          <input
            type="number"
            value={params.initialCapital}
            onChange={(e) => handleChange('initialCapital', Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g. 10000"
          />
          <p className="text-xs text-slate-500">Starting margin for the contract.</p>
        </div>

        {/* Leverage */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-indigo-400">
            Target Leverage (n)
            <span className="ml-2 text-lg text-white font-bold">{params.leverage}x</span>
          </label>
          <input
            type="range"
            min="1.1"
            max="5.0"
            step="0.1"
            value={params.leverage}
            onChange={(e) => handleChange('leverage', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1.1x (Safe)</span>
            <span>2x (Default)</span>
            <span>5x (Risky)</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Strategy: Open at {params.leverage}x. If profitable, use profits to buy more BTC to maintain {params.leverage}x. If in loss, hold.
          </p>
        </div>

      </div>

      <div className="mt-8 flex justify-end border-t border-slate-700 pt-6">
        <button
          onClick={onClear}
          className="px-6 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-500"
        >
          Reset / Clear Data
        </button>
      </div>
    </div>
  );
};

export default InvestmentForm;
