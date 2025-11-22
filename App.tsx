import React, { useState, useEffect, useMemo } from 'react';
import { WeeklyPrice, SimulationParams, WeeklyResult } from './types';
import { runSimulation } from './utils/simulation';
import InvestmentForm from './components/InvestmentForm';
import ResultsTable from './components/ResultsTable';
import PerformanceChart from './components/PerformanceChart';
import DataImport from './components/DataImport';

const STORAGE_KEY_PRICES = 'btc_strategy_prices';
const STORAGE_KEY_PARAMS = 'btc_strategy_params';

const App: React.FC = () => {
  // Lazy initialization for Params
  const [params, setParams] = useState<SimulationParams>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PARAMS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure maxLeverage exists for older saved data
        return { 
          initialCapital: 10000, 
          leverage: 2.0, 
          maxLeverage: 10, 
          ...parsed 
        };
      } catch (e) {
        console.error("Failed to parse saved params", e);
      }
    }
    return {
      initialCapital: 10000,
      leverage: 2.0,
      maxLeverage: 10,
    };
  });

  // Lazy initialization for Price Data
  const [priceData, setPriceData] = useState<WeeklyPrice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PRICES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Backwards compatibility: ensure lowPrice exists
        return parsed.map((p: any) => ({
          ...p,
          lowPrice: p.lowPrice !== undefined ? p.lowPrice : p.openPrice
        }));
      } catch (e) {
        console.error("Failed to parse saved prices", e);
      }
    }

    // Default initialization if no data exists
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diff));
    const dateStr = monday.toISOString().split('T')[0];

    return [{
      weekIndex: 1,
      date: dateStr,
      openPrice: 0,
      lowPrice: 0
    }];
  });

  // State for the active simulation range [startIndex, endIndex]
  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 0]);

  // Effect to sync slider range when priceData length changes (e.g. load, add row)
  useEffect(() => {
    setSliderRange(prev => {
      const maxIndex = priceData.length - 1;
      
      // If data is empty or just init
      if (maxIndex < 0) return [0, 0];

      // If this is the very first load (prev is 0,0) and we have data, open full range
      if (prev[0] === 0 && prev[1] === 0 && maxIndex > 0) {
        return [0, maxIndex];
      }

      // Otherwise, clamp existing values to new bounds
      const newStart = Math.min(prev[0], maxIndex);
      let newEnd = Math.min(prev[1], maxIndex);
      
      if (newEnd < newStart) newEnd = newStart;
      
      return [newStart, newEnd === 0 ? maxIndex : newEnd];
    });
  }, [priceData.length]);

  // Derive the subset of data to simulate based on slider range
  const simulationData = useMemo(() => {
    if (priceData.length === 0) return [];
    // Slice is non-inclusive of end, so add 1
    const subset = priceData.slice(sliderRange[0], sliderRange[1] + 1);
    return subset; 
  }, [priceData, sliderRange]);

  // Use useMemo to derive results synchronously from simulationData.
  const results = useMemo(() => {
    return runSimulation(simulationData, params);
  }, [simulationData, params]);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(priceData));
  }, [priceData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PARAMS, JSON.stringify(params));
  }, [params]);

  const handleAddPreviousWeek = () => {
    setPriceData(prev => {
      const oldestEntry = prev[0];
      let newDateStr = "";
      
      if (oldestEntry) {
        const oldestDate = new Date(oldestEntry.date);
        const prevWeekDate = new Date(oldestDate);
        prevWeekDate.setDate(oldestDate.getDate() - 7);
        newDateStr = prevWeekDate.toISOString().split('T')[0];
      } else {
        newDateStr = new Date().toISOString().split('T')[0];
      }

      const newEntry: WeeklyPrice = {
        weekIndex: 0, 
        date: newDateStr,
        openPrice: 0,
        lowPrice: 0
      };

      setSliderRange(r => [r[0] + 1, r[1] + 1]);

      return [newEntry, ...prev];
    });
  };

  const handleAddNextWeek = () => {
    setPriceData(prev => {
      const newestEntry = prev[prev.length - 1];
      let newDateStr = "";
      
      if (newestEntry) {
        const newestDate = new Date(newestEntry.date);
        const nextWeekDate = new Date(newestDate);
        nextWeekDate.setDate(newestDate.getDate() + 7);
        newDateStr = nextWeekDate.toISOString().split('T')[0];
      } else {
        newDateStr = new Date().toISOString().split('T')[0];
      }

      const newEntry: WeeklyPrice = {
        weekIndex: 0, 
        date: newDateStr,
        openPrice: 0,
        lowPrice: 0
      };
      
      setSliderRange(r => {
         if (r[1] === prev.length - 1) {
             return [r[0], r[1] + 1];
         }
         return r;
      });

      return [...prev, newEntry];
    });
  };

  const handleRowUpdate = (index: number, field: keyof WeeklyPrice, value: any) => {
    // The index coming from ResultsTable is relative to simulationData.
    const absoluteIndex = sliderRange[0] + index;
    
    setPriceData(prev => {
      const newData = [...prev];
      if (newData[absoluteIndex]) {
        newData[absoluteIndex] = { ...newData[absoluteIndex], [field]: value };
      }
      return newData;
    });
  };

  const handleDeleteRows = (relativeIndices: number[]) => {
    const absoluteIndices = relativeIndices.map(i => i + sliderRange[0]);
    
    setPriceData(prev => {
      return prev.filter((_, index) => !absoluteIndices.includes(index));
    });
  };

  const handleRestartFromLowest = () => {
    let minP = Infinity;
    let minIdx = -1;

    priceData.forEach((p, i) => {
      // Use lowPrice for restart point logic as well, as it's the safest "bottom"
      const effectiveLow = p.lowPrice > 0 ? p.lowPrice : p.openPrice;
      if (effectiveLow > 0 && effectiveLow < minP) {
        minP = effectiveLow;
        minIdx = i;
      }
    });

    if (minIdx >= 0) {
      setSliderRange([minIdx, priceData.length - 1]);
    }
  };

  const handleImportData = (newData: WeeklyPrice[]) => {
    setPriceData(newData);
    setSliderRange([0, newData.length - 1]);
  };

  const handleClearData = () => {
    if(window.confirm("Are you sure you want to clear all data and reset?")) {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
      const monday = new Date(today.setDate(diff));
      const dateStr = monday.toISOString().split('T')[0];

      const defaultData = [{ weekIndex: 1, date: dateStr, openPrice: 0, lowPrice: 0 }];
      setPriceData(defaultData);
      setSliderRange([0, 0]);
    }
  };

  const handleMaxLevChange = (val: number) => {
    setParams(prev => ({ ...prev, maxLeverage: val }));
  };

  // Summary Stats
  const lastResult = results[results.length - 1];
  const totalProfit = lastResult ? lastResult.floatingPnL : 0;
  const roi = lastResult && params.initialCapital > 0 ? (totalProfit / params.initialCapital) * 100 : 0;
  const isLiquidated = lastResult?.isLiquidated;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-10 border-b border-slate-800 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
                  BTC Leveraged DCA
                </h1>
                <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-700">Manual Entry Mode</span>
              </div>
              <p className="text-slate-400 mt-2">
                Strategy: Maintain {params.leverage}x leverage by reinvesting floating profits. Hold on loss.
              </p>
            </div>
            {lastResult && (
              <div className="flex gap-4 text-right">
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 hidden md:block">
                  <div className="text-xs text-slate-500 uppercase">Position Size</div>
                  <div className="text-xl font-mono font-bold text-indigo-300">
                    ${Math.round(lastResult.positionValue).toLocaleString()}
                  </div>
                </div>
                
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <div className="text-xs text-slate-500 uppercase">Final Equity</div>
                  <div className={`text-xl font-mono font-bold ${isLiquidated ? 'text-red-500' : 'text-white'}`}>
                    ${Math.round(lastResult.equity).toLocaleString()}
                  </div>
                </div>
                
                <div className={`bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 ${totalProfit >= 0 ? 'border-emerald-900/50 bg-emerald-900/10' : 'border-rose-900/50 bg-rose-900/10'}`}>
                  <div className="text-xs text-slate-500 uppercase">Total PnL</div>
                  <div className={`text-xl font-mono font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {isLiquidated ? 'BUSTED' : `${totalProfit >= 0 ? '+' : ''}${Math.round(totalProfit).toLocaleString()} (${roi.toFixed(2)}%)`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Controls */}
        <InvestmentForm 
          params={params} 
          setParams={setParams} 
          onClear={handleClearData}
        />

        {/* Visualization with Range Slider */}
        <PerformanceChart 
          results={results} 
          fullData={priceData}
          range={sliderRange}
          onRangeChange={setSliderRange}
          onRestartFromLowest={handleRestartFromLowest} 
        />

        <ResultsTable 
          data={results} 
          onAddPreviousWeek={handleAddPreviousWeek}
          onAddNextWeek={handleAddNextWeek}
          onRowUpdate={handleRowUpdate}
          onDeleteRows={handleDeleteRows}
          maxLeverage={params.maxLeverage}
          onMaxLeverageChange={handleMaxLevChange}
        />
        
        {/* Data Import */}
        <DataImport onImport={handleImportData} />

      </div>
    </div>
  );
};

export default App;