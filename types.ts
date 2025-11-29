
export interface WeeklyPrice {
  weekIndex: number;
  date: string;
  openPrice: number;
  lowPrice: number;
  highPrice: number;
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
  highPrice: number;
  
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
  
  // Low Scenario (Conservative)
  positionValue: number; // Notional Value at Low
  debt: number;          // Borrowed/Margin used
  equity: number;        // Position - Debt at Low
  leverage: number;      // Position / Equity at Low
  floatingPnL: number;   // Equity - Initial at Low
  
  // High Scenario (Best Case)
  positionValueHigh: number;
  equityHigh: number;
  leverageHigh: number;
  floatingPnLHigh: number;

  isLiquidated: boolean;
  
  // Forecast
  nextWeekCondition: string; // Description of what might happen next
}
