
import React, { useState } from 'react';
import { WeeklyResult, WeeklyPrice } from '../types';

interface Props {
  data: WeeklyResult[];
  onAddPreviousWeek: () => void;
  onAddNextWeek: () => void;
  onRowUpdate: (index: number, field: keyof WeeklyPrice, value: any) => void;
  onDeleteRows: (indices: number[]) => void;
  maxLeverage: number;
  onMaxLeverageChange: (val: number) => void;
}

const ResultsTable: React.FC<Props> = ({ 
  data, 
  onAddPreviousWeek, 
  onAddNextWeek, 
  onRowUpdate, 
  onDeleteRows,
  maxLeverage,
  onMaxLeverageChange
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [tooltip, setTooltip] = useState<{ x: number, y: number, row: WeeklyResult } | null>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIndices = data.map((_, i) => i);
      setSelectedIndices(new Set(allIndices));
    } else {
      setSelectedIndices(new Set());
    }
  };

  const handleSelectRow = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedIndices.size === 0) return;
    onDeleteRows(Array.from(selectedIndices));
    setSelectedIndices(new Set()); // Clear selection after delete
  };

  const handleMouseEnterAction = (e: React.MouseEvent, row: WeeklyResult) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
        x: rect.left + (rect.width / 2),
        y: rect.top, 
        row
    });
  };

  const handleMouseLeaveAction = () => {
    setTooltip(null);
  };

  const isAllSelected = data.length > 0 && selectedIndices.size === data.length;
  const isIndeterminate = selectedIndices.size > 0 && selectedIndices.size < data.length;

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden relative">
      {/* Tooltip Portal */}
      {tooltip && (
        <div 
            className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 text-xs w-64 pointer-events-none backdrop-blur-md bg-slate-800/95"
            style={{ 
                left: tooltip.x, 
                top: tooltip.y - 10, 
                transform: 'translate(-50%, -100%)' 
            }}
        >
            <div className="font-bold text-slate-200 mb-2 pb-1 border-b border-slate-700 flex justify-between">
                <span>Action Details</span>
                <span className={`uppercase ${tooltip.row.action === 'ADD' ? 'text-emerald-400' : tooltip.row.action === 'HOLD' ? 'text-slate-400' : 'text-blue-400'}`}>
                    {tooltip.row.action}
                </span>
            </div>

            {tooltip.row.action === 'ADD' && (
                <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 mb-1">
                        <span>Step</span>
                        <span className="text-right">BTC</span>
                        <span className="text-right">Avg Price</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 items-center">
                        <span className="text-slate-500">Before:</span>
                        <span className="text-right font-mono text-slate-300">{tooltip.row.preActionHoldings?.toFixed(4)}</span>
                        <span className="text-right font-mono text-indigo-300">${Math.round(tooltip.row.preActionCostBasis || 0).toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 items-center">
                        <span className="text-emerald-400 font-bold">Buy:</span>
                        <span className="text-right font-mono text-emerald-400">+{tooltip.row.btcAdded.toFixed(4)}</span>
                        <span className="text-right font-mono text-emerald-400">@ ${tooltip.row.openPrice.toLocaleString()}</span>
                    </div>
                    
                    <div className="border-t border-slate-700 my-1"></div>

                    <div className="grid grid-cols-3 gap-1 items-center font-bold">
                        <span className="text-slate-200">After:</span>
                        <span className="text-right font-mono text-slate-100">{tooltip.row.totalBtcHoldings.toFixed(4)}</span>
                        <span className="text-right font-mono text-indigo-300">
                             ${Math.round(((tooltip.row.preActionCostBasis! * tooltip.row.preActionHoldings!) + (tooltip.row.btcAdded * tooltip.row.openPrice)) / tooltip.row.totalBtcHoldings).toLocaleString()}
                        </span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 italic leading-tight">
                        {tooltip.row.actionReason}
                    </div>
                </div>
            )}

            {tooltip.row.action === 'HOLD' && (
                <div>
                    <p className="text-slate-300 mb-1">Logic:</p>
                    <p className="text-slate-400 italic leading-relaxed">
                        {tooltip.row.actionReason || "Maintained current position."}
                    </p>
                </div>
            )}

            {tooltip.row.action === 'OPEN' && (
                <div className="space-y-2">
                     <div className="grid grid-cols-3 gap-1 items-center">
                        <span className="text-blue-400 font-bold">Buy:</span>
                        <span className="text-right font-mono text-blue-400">{tooltip.row.btcAdded.toFixed(4)}</span>
                        <span className="text-right font-mono text-blue-400">@ ${tooltip.row.openPrice.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mt-2">
                        {tooltip.row.actionReason}
                    </p>
                </div>
            )}

             {tooltip.row.action === 'LIQUIDATED' && (
                <div>
                    <p className="text-rose-400 font-bold mb-1">Position Liquidated</p>
                    {tooltip.row.theoreticalLiqPrice && tooltip.row.theoreticalLiqPrice > 0 && (
                        <div className="mb-2 bg-rose-900/30 p-2 rounded border border-rose-900/50">
                            <span className="text-rose-300 block text-[10px] uppercase">Est. Liquidation Price:</span>
                            <span className="text-white font-mono font-bold text-sm">
                                ${tooltip.row.theoreticalLiqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    <p className="text-slate-400 italic leading-relaxed">
                        {tooltip.row.actionReason}
                    </p>
                </div>
            )}
        </div>
      )}

      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-200">Weekly Ledger</h3>
          <span className="text-xs text-slate-400 italic">Metrics shown as ranges: Low Price Scenario - High Price Scenario</span>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {selectedIndices.size > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete ({selectedIndices.size})</span>
            </button>
          )}

          <button 
            onClick={onAddPreviousWeek}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Previous Week</span>
          </button>
          
          <button 
            onClick={onAddNextWeek}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Next Week</span>
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm text-left text-slate-300 whitespace-nowrap">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3 text-center w-10">
                <input 
                  type="checkbox" 
                  className="rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                  checked={isAllSelected}
                  ref={input => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-center">Wk</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 w-28">Open Price</th>
              <th className="px-4 py-3 w-28 text-rose-300">Low Price</th>
              <th className="px-4 py-3 w-28 text-emerald-300">High Price</th>
              <th className="px-4 py-3 text-center">Action</th>
              <th className="px-4 py-3 text-right">Added BTC</th>
              <th className="px-4 py-3 text-right">Total BTC</th>
              <th className="px-4 py-3 text-right text-indigo-300">Avg Price</th>
              <th className="px-4 py-3 text-right">Pos Value <span className="text-[10px] lowercase text-slate-500">(low-high)</span></th>
              <th className="px-4 py-3 text-right">Debt</th>
              <th className="px-4 py-3 text-right text-indigo-400">Equity <span className="text-[10px] lowercase text-slate-500">(low-high)</span></th>
              <th className="px-4 py-3 text-center">
                <div className="flex flex-col items-center">
                  <span>Lev <span className="text-[10px] lowercase text-slate-500">(low-high)</span></span>
                  <div className="flex items-center gap-1 mt-1">
                     <span className="text-[10px] text-slate-500 font-normal lowercase">max:</span>
                     <input 
                      type="number"
                      min="1"
                      value={maxLeverage}
                      onChange={(e) => onMaxLeverageChange(Number(e.target.value))}
                      className="w-10 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-center text-white focus:border-indigo-500 outline-none"
                     />
                  </div>
                </div>
              </th>
              <th className="px-4 py-3 text-right">PnL <span className="text-[10px] lowercase text-slate-500">(low-high)</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {data.map((row, index) => {
              const isProfit = row.floatingPnL >= 0;
              const isLiq = row.isLiquidated;
              const isSelected = selectedIndices.has(index);
              
              let actionColor = 'text-slate-400';
              if (row.action === 'OPEN') actionColor = 'text-blue-400 font-bold';
              if (row.action === 'ADD') actionColor = 'text-emerald-400 font-bold';
              if (row.action === 'LIQUIDATED') actionColor = 'text-red-500 font-bold bg-red-900/20';

              // Formatting Ranges
              const formatRange = (low: number, high: number, prefix: string = '') => {
                 return (
                     <div className="flex flex-col items-end leading-tight">
                         <span className="text-xs text-emerald-400/80">{prefix}{Math.round(high).toLocaleString()}</span>
                         <span className="text-rose-400/80">{prefix}{Math.round(low).toLocaleString()}</span>
                     </div>
                 );
              }

              const formatLevRange = (low: number, high: number) => {
                return (
                    <div className="flex flex-col items-center leading-tight text-xs">
                        <span className="text-slate-400">{low.toFixed(2)}x</span>
                        <span className="text-slate-600 mx-1">|</span>
                        <span className="text-slate-400">{high.toFixed(2)}x</span>
                    </div>
                );
              }

              return (
                <tr 
                  key={row.date + index} 
                  className={`transition-colors ${isLiq ? 'opacity-50' : ''} ${isSelected ? 'bg-indigo-900/30' : 'hover:bg-slate-700/50'}`}
                >
                  <td className="px-4 py-3 text-center">
                    <input 
                      type="checkbox"
                      className="rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      checked={isSelected}
                      onChange={() => handleSelectRow(index)}
                    />
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-slate-500">{row.weekIndex}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(row.date).toLocaleDateString()}</td>
                  
                  {/* Editable Open Price Input */}
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.openPrice === 0 ? '' : row.openPrice}
                        onChange={(e) => onRowUpdate(index, 'openPrice', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 pl-4 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-right font-mono text-xs"
                        placeholder="Open"
                      />
                    </div>
                  </td>

                  {/* Editable Low Price Input */}
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-rose-900 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.lowPrice === 0 ? '' : row.lowPrice}
                        onChange={(e) => onRowUpdate(index, 'lowPrice', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-rose-900/50 rounded px-2 py-1 pl-4 text-rose-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none text-right font-mono text-xs"
                        placeholder="Low"
                      />
                    </div>
                  </td>

                  {/* Editable High Price Input */}
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-900 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.highPrice === 0 ? '' : row.highPrice}
                        onChange={(e) => onRowUpdate(index, 'highPrice', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-emerald-900/50 rounded px-2 py-1 pl-4 text-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-right font-mono text-xs"
                        placeholder="High"
                      />
                    </div>
                  </td>
                  
                  <td 
                    className={`px-4 py-3 text-center cursor-help ${actionColor}`}
                    onMouseEnter={(e) => handleMouseEnterAction(e, row)}
                    onMouseLeave={handleMouseLeaveAction}
                  >
                    <span className="border-b border-dashed border-current/30 pb-0.5">{row.action}</span>
                  </td>
                  
                  <td className="px-4 py-3 text-right font-mono text-emerald-300/80">
                    {row.btcAdded > 0 ? `+${row.btcAdded.toFixed(4)}` : '-'}
                  </td>
                  
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {row.totalBtcHoldings.toFixed(4)}
                  </td>
                  
                  <td className="px-4 py-3 text-right font-mono text-indigo-300/80">
                     ${Math.round(row.costBasis).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {formatRange(row.positionValue, row.positionValueHigh, '$')}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-slate-500">
                    -${Math.round(row.debt).toLocaleString()}
                  </td>
                  
                  <td className="px-4 py-3 text-right font-mono font-bold text-indigo-400">
                     {formatRange(row.equity, row.equityHigh, '$')}
                  </td>
                  
                  <td className="px-4 py-3 text-center font-mono">
                    {formatLevRange(row.leverageHigh, row.leverage)}
                  </td>
                  
                  <td className={`px-4 py-3 text-right font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatRange(row.floatingPnL, row.floatingPnLHigh, isProfit ? '+' : '')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
