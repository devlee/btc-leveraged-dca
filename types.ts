
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
  reinvestmentRatio: number; // 0-100, percentage of "buy signal" to execute
}

export interface WeeklyResult {
  weekIndex: number;
  date: string;
  openPrice: number;
  lowPrice: number;
  
  // Action taken
  action: 'OPEN' | 'ADD' | 'HOLD' | 'LIQUIDATED';
  btcAdded: number;
  actionReason?: string; // Logic explanation for the action

  // State BEFORE action (for tooltip)
  preActionHoldings?: number;
  preActionCostBasis?: number;
  theoreticalLiqPrice?: number; // Price at which liquidation would trigger

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
