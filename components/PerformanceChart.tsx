import React, { useMemo } from 'react';
import { ComposedChart, Area, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { WeeklyResult, WeeklyPrice } from '../types';

interface Props {
  results: WeeklyResult[]; // Current simulation results
  fullData: WeeklyPrice[]; // All available data for slider context
  range: [number, number]; // Current [start, end] indices
  onRangeChange: (range: [number, number]) => void;
  onRestartFromLowest: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isProfit = data.floatingPnL >= 0;
    
    // Format the date label (label is now ISO string from XAxis dataKey)
    const dateLabel = new Date(label).toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    
    let actionColor = 'text-slate-500';
    if (data.action === 'OPEN') actionColor = 'text-blue-400 font-bold';
    if (data.action === 'ADD') actionColor = 'text-emerald-400 font-bold';
    if (data.action === 'LIQUIDATED') actionColor = 'text-red-500 font-bold';

    return (
      <div className="bg-slate-800 border border-slate-600 p-4 rounded-lg shadow-xl text-xs min-w-[260px] z-50 backdrop-blur-sm bg-slate-800/95">
        <div className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-2 flex justify-between items-center">
            <span>{dateLabel}</span>
            <span className="text-slate-500 font-normal">Week {data.weekIndex}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {/* Market Data */}
            <div className="text-slate-400">Open Price:</div>
            <div className="text-right font-mono text-slate-200">${data.openPrice?.toLocaleString()}</div>

            <div className="text-rose-400">Low Price:</div>
            <div className="text-right font-mono text-rose-300">${data.lowPrice?.toLocaleString()}</div>

            {/* Action & Holdings */}
            <div className="text-slate-400">Action:</div>
            <div className={`text-right ${actionColor}`}>{data.action}</div>

            <div className="text-slate-400">BTC Held:</div>
            <div className="text-right font-mono text-slate-200">{data.totalBtcHoldings?.toFixed(4)}</div>
            
            <div className="text-indigo-300">Avg Price:</div>
            <div className="text-right font-mono text-indigo-300">${Math.round(data.costBasis || 0).toLocaleString()}</div>

            <div className="col-span-2 border-t border-slate-700 my-1"></div>

            {/* Financials (Low) */}
            <div className="text-slate-400">Pos Value (Low):</div>
            <div className="text-right font-mono text-indigo-400">${Math.round(data.positionValue).toLocaleString()}</div>

            <div className="text-slate-400">Debt:</div>
            <div className="text-right font-mono text-slate-500">-${Math.round(data.debt).toLocaleString()}</div>

            <div className="text-slate-400">Equity (Low):</div>
            <div className="text-right font-mono text-emerald-400">${Math.round(data.equity).toLocaleString()}</div>
            
            <div className="text-slate-400">Lev (Low):</div>
            <div className="text-right font-mono text-orange-300">{data.leverage?.toFixed(2)}x</div>

             <div className="text-slate-400">PnL (Low):</div>
            <div className={`text-right font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}{Math.round(data.floatingPnL).toLocaleString()}
            </div>
        </div>
      </div>
    );
  }
  return null;
};

const PerformanceChart: React.FC<Props> = ({ results, fullData, range, onRangeChange, onRestartFromLowest }) => {
  
  // Process chart data
  const formattedData = useMemo(() => {
    return results.map(d => ({
      ...d,
      // We keep dateShort for potential other uses, but XAxis will use 'date' (ISO)
      dateShort: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      Equity: Math.round(d.equity),
      Position: Math.round(d.positionValue),
      PnL: Math.round(d.floatingPnL)
    }));
  }, [results]);

  // Calculate lowest price in the *full* dataset to enable the button if needed
  const globalLowestPrice = useMemo(() => {
      if (fullData.length === 0) return 0;
      const min = Math.min(...fullData.filter(d => d.openPrice > 0).map(d => d.openPrice));
      return min === Infinity ? 0 : min;
  }, [fullData]);

  // Slider helpers
  const minVal = range[0];
  const maxVal = range[1];
  const maxLimit = fullData.length > 0 ? fullData.length - 1 : 0;

  // Calculate percentage for visual slider tracks
  const minPercent = maxLimit > 0 ? (minVal / maxLimit) * 100 : 0;
  const maxPercent = maxLimit > 0 ? (maxVal / maxLimit) * 100 : 100;

  // Handlers for slider
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxVal);
    onRangeChange([value, maxVal]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minVal);
    onRangeChange([minVal, value]);
  };

  // Get label info for slider handles
  const getLabel = (index: number) => {
    if (!fullData[index]) return '...';
    const d = fullData[index];
    const date = new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
    return `${date} ($${d.openPrice})`;
  };

  const startLabel = getLabel(minVal);
  const endLabel = getLabel(maxVal);

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
      <style>{`
        .multi-range-slider-container input[type=range] {
          pointer-events: none;
          position: absolute;
          height: 0;
          width: 100%;
          outline: none;
          z-index: 3;
        }
        .multi-range-slider-container input[type=range]::-webkit-slider-thumb {
          pointer-events: all;
          width: 20px;
          height: 20px;
          -webkit-appearance: none;
          border-radius: 50%;
          background: #f8fafc;
          border: 2px solid #6366f1;
          cursor: pointer;
          margin-top: -8px; /* Adjust based on track height */
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .multi-range-slider-container input[type=range]::-moz-range-thumb {
          pointer-events: all;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f8fafc;
          border: 2px solid #6366f1;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h3 className="text-lg font-bold text-slate-200">Performance & Simulation Window</h3>
            <p className="text-xs text-slate-400">Drag the sliders to adjust start (open) and end (close) weeks.</p>
        </div>
        
        {globalLowestPrice > 0 && (
          <button
            onClick={onRestartFromLowest}
            className="px-3 py-2 text-xs font-medium rounded-md border bg-indigo-900/50 text-indigo-300 border-indigo-700 hover:bg-indigo-800 transition-colors whitespace-nowrap"
          >
            Set Start to Low (${globalLowestPrice.toLocaleString()})
          </button>
        )}
      </div>

      <div className="h-[350px] w-full mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData}>
            <defs>
              <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPosition" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="date" // Changed from dateShort to unique ISO date
              stroke="#94a3b8" 
              tick={{fontSize: 12}} 
              minTickGap={30}
              tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
            />
            <YAxis 
              yAxisId="left"
              stroke="#94a3b8" 
              tick={{fontSize: 12}}
              tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#64748b" 
              tick={{fontSize: 12}}
              tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} />
            
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="Position" 
              name="Total Position Value"
              stroke="#6366f1" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPosition)" 
            />
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="Equity" 
              name="User Equity"
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorEquity)" 
              activeDot={{ r: 6 }}
            />
            <Bar 
              yAxisId="right"
              dataKey="PnL"
              name="Floating PnL"
              barSize={20}
              opacity={0.8}
            >
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.PnL >= 0 ? '#34d399' : '#f87171'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Dual Range Slider UI */}
      <div className="px-4 pb-2 relative multi-range-slider-container">
        {/* Labels */}
        <div className="flex justify-between text-xs font-mono text-indigo-300 mb-2 select-none">
          <div>
            <span className="text-slate-400">Start:</span> {startLabel}
          </div>
          <div>
            <span className="text-slate-400">End:</span> {endLabel}
          </div>
        </div>

        <div className="relative w-full h-6">
          {/* Track Background */}
          <div className="absolute top-[9px] bottom-0 left-0 right-0 h-1.5 bg-slate-700 rounded-full z-0" />
          
          {/* Active Range Highlight */}
          <div 
            className="absolute top-[9px] bottom-0 h-1.5 bg-indigo-500 rounded-full z-1"
            style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
          />

          {/* Range Inputs */}
          <input 
            type="range" 
            min={0} 
            max={maxLimit} 
            value={minVal} 
            onChange={handleMinChange}
            className="absolute top-0 w-full pointer-events-none z-[3]"
          />
          <input 
            type="range" 
            min={0} 
            max={maxLimit} 
            value={maxVal} 
            onChange={handleMaxChange}
            className="absolute top-0 w-full pointer-events-none z-[4]" 
          />
        </div>
        
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 select-none">
           <span>Week 1</span>
           <span>Week {fullData.length}</span>
        </div>
      </div>

    </div>
  );
};

export default PerformanceChart;