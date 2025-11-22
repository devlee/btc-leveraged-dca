export interface WeeklyPrice {
  weekIndex: number;
  date: string;
  openPrice: number;
  lowPrice: number;
}

export interface SimulationParams {
  initialCapital: number;
  leverage: number; // n, target leverage
  maxLeverage: number; // Liquidation threshold
}

export interface WeeklyResult {
  weekIndex: number;
  date: string;
  openPrice: number;
  lowPrice: number;
  
  // Action taken
  action: 'OPEN' | 'ADD' | 'HOLD' | 'LIQUIDATED';
  btcAdded: number;
  
  // Snapshot AFTER action
  totalBtcHoldings: number;
  costBasis: number;     // Average entry price
  positionValue: number; // Notional Value
  debt: number;          // Borrowed/Margin used
  equity: number;        // Position - Debt
  leverage: number;      // Position / Equity
  
  // Performance
  floatingPnL: number;   // Equity - Initial
  isLiquidated: boolean;
  
  // Forecast
  nextWeekCondition: string; // Description of what might happen next
}