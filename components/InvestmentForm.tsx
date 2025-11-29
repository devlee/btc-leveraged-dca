
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

  // Safe fallback if reinvestmentRatio is undefined in old state
  const reinvestRatio = params.reinvestmentRatio ?? 100;

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Capital & Reinvestment Logic */}
        <div className="space-y-6">
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

            {/* Reinvestment Ratio */}
            <div className="space-y-2 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <label className="text-sm font-medium text-emerald-400 flex justify-between">
                    <span>Profit Reinvestment %</span>
                    <span className="text-white font-bold">{reinvestRatio}%</span>
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={reinvestRatio}
                    onChange={(e) => handleChange('reinvestmentRatio', Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0% (Accumulate Cash)</span>
                    <span>100% (Max Compound)</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Determines what % of the necessary buy amount is executed when profitable.
                    <br/><span className="text-slate-500">Lower this to de-risk and take some profit off the table.</span>
                </p>
            </div>
        </div>

        {/* Right Column: Leverage Settings */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-indigo-400">
            Target Leverage (n)
            <span className="ml-2 text-lg text-white font-bold">{params.leverage}x</span>
          </label>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.1"
            value={params.leverage}
            onChange={(e) => handleChange('leverage', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1.0x (Safe)</span>
            <span>2x (Default)</span>
            <span>5x (Risky)</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-3">
            Strategy Summary: 
            <ul className="list-disc ml-4 mt-1 space-y-1 text-slate-500">
                <li>Open position at <strong>{params.leverage}x</strong> leverage.</li>
                <li>If profitable, use <strong>{reinvestRatio}%</strong> of the calculated rebalance amount to maintain leverage.</li>
                <li>If in loss, HOLD (do not add funds).</li>
            </ul>
          </div>
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
