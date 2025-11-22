import { WeeklyPrice, SimulationParams, WeeklyResult } from "../types";

export const runSimulation = (
  prices: WeeklyPrice[],
  params: SimulationParams
): WeeklyResult[] => {
  const results: WeeklyResult[] = [];
  
  let equity = params.initialCapital;
  let debt = 0;
  let btcHoldings = 0;
  let totalCostBasisUSD = 0; // Tracks sum of (BTC bought * Price bought)
  let isLiquidated = false;

  // We iterate through each week
  for (let i = 0; i < prices.length; i++) {
    const week = prices[i];
    const currentPrice = week.openPrice;
    // Use lowPrice if available, otherwise fallback to currentPrice
    const lowPrice = week.lowPrice && week.lowPrice > 0 ? week.lowPrice : currentPrice;
    
    let action: 'OPEN' | 'ADD' | 'HOLD' | 'LIQUIDATED' = 'HOLD';
    let btcAdded = 0;
    let actionReason = "";

    // Capture state BEFORE any action this week
    const preActionHoldings = btcHoldings;
    const preActionCostBasis = btcHoldings > 0 ? totalCostBasisUSD / btcHoldings : 0;

    // Safety check for invalid input during manual typing
    if (!currentPrice || currentPrice <= 0) {
      results.push({
        weekIndex: i + 1,
        date: week.date,
        openPrice: 0,
        lowPrice: 0,
        action: 'HOLD',
        btcAdded: 0,
        actionReason: "Waiting for price input",
        preActionHoldings,
        preActionCostBasis,
        totalBtcHoldings: btcHoldings,
        costBasis: btcHoldings > 0 ? totalCostBasisUSD / btcHoldings : 0,
        positionValue: 0,
        debt,
        equity,
        leverage: 0,
        floatingPnL: equity - params.initialCapital,
        isLiquidated,
        nextWeekCondition: "Waiting for price input..."
      });
      continue;
    }

    // If already liquidated, just push dead state
    if (isLiquidated) {
      results.push({
        weekIndex: i + 1,
        date: week.date,
        openPrice: currentPrice,
        lowPrice: lowPrice,
        action: 'LIQUIDATED',
        btcAdded: 0,
        actionReason: "Account previously liquidated",
        preActionHoldings,
        preActionCostBasis,
        totalBtcHoldings: 0,
        costBasis: 0,
        positionValue: 0,
        debt: 0,
        equity: 0,
        leverage: 0,
        floatingPnL: -params.initialCapital,
        isLiquidated: true,
        nextWeekCondition: "Account Liquidated"
      });
      continue;
    }

    // 1. Initial Action (Week 1)
    if (i === 0) {
      // Initial Week: Open Position at Open Price
      const targetPosition = equity * params.leverage;
      btcHoldings = targetPosition / currentPrice;
      debt = targetPosition - equity;
      
      // Track Cost
      totalCostBasisUSD = targetPosition; // Initial purchase value
      
      action = 'OPEN';
      btcAdded = btcHoldings;
      actionReason = `Initial entry. Leverage set to ${params.leverage}x.`;

      // Immediate Risk Check on Week 1 Low
      const posValueAtLow = btcHoldings * lowPrice;
      const equityAtLow = posValueAtLow - debt;
      const levAtLow = equityAtLow > 0 ? posValueAtLow / equityAtLow : Infinity;

      if (equityAtLow <= 0 || levAtLow >= params.maxLeverage) {
        isLiquidated = true;
        equity = 0;
        btcHoldings = 0;
        debt = 0;
        totalCostBasisUSD = 0;
        action = 'LIQUIDATED';
        actionReason = "Liquidated immediately due to Week 1 low price.";
      }

    } else {
      // Subsequent Weeks

      // A. RISK CHECK (Liquidation logic based on WEEKLY LOW)
      // We calculate what the account looks like at the lowest point of the week.
      const posValueAtLow = btcHoldings * lowPrice;
      const equityAtLow = posValueAtLow - debt;
      const levAtLow = equityAtLow > 0 ? posValueAtLow / equityAtLow : Infinity;

      // Liquidation Check: Equity <= 0 OR Leverage (at Low) >= Max Leverage
      if (equityAtLow <= 0 || levAtLow >= params.maxLeverage) {
        isLiquidated = true;
        equity = 0;
        btcHoldings = 0;
        debt = 0;
        totalCostBasisUSD = 0;
        action = 'LIQUIDATED';
        actionReason = equityAtLow <= 0 ? "Equity hit 0 at weekly low." : `Leverage (${levAtLow.toFixed(2)}x) exceeded max (${params.maxLeverage}x) at weekly low.`;
      } else {
        // B. STRATEGY CHECK (Based on OPEN Price - Standard Mark to Market)
        // If we survived the low, we proceed to check if we should ADD based on the "close/open" price
        const positionValue = btcHoldings * currentPrice;
        equity = positionValue - debt;
        const currentLeverage = equity > 0 ? positionValue / equity : Infinity;

        // Rule: If Floating Profit > 0 (Equity > Initial), Maintain Leverage n.
        // Else: Hold.
        
        const hasFloatingProfit = equity > params.initialCapital;
        
        // Determine default reason for holding
        if (!hasFloatingProfit) {
            actionReason = `PnL ≤ 0 (Equity: $${Math.round(equity).toLocaleString()}). Strategy only adds when in profit.`;
        } else if (currentLeverage >= params.leverage) {
            actionReason = `Current Lev (${currentLeverage.toFixed(2)}x) ≥ Target (${params.leverage}x). No need to add.`;
        }

        // We only ADD position to restore leverage if we are profitable.
        if (hasFloatingProfit && currentLeverage < params.leverage) {
          const targetPosition = equity * params.leverage;
          const difference = targetPosition - positionValue;
          
          if (difference > 0) {
            const btcToBuy = difference / currentPrice;
            btcHoldings += btcToBuy;
            debt += difference; // We borrow more to buy more
            
            // Update Cost Basis
            totalCostBasisUSD += (btcToBuy * currentPrice);
            
            btcAdded = btcToBuy;
            action = 'ADD';
            actionReason = `Profit detected. Lev dropped to ${currentLeverage.toFixed(2)}x. Rebalancing to ${params.leverage}x.`;
          }
        }
      }
    }

    // 2. Final State for Week (Reported)
    // UPDATED: All reported values are now based on the WEEKLY LOW PRICE
    let finalPositionValue = 0;
    let finalLeverage = 0;
    let floatingPnL = 0;
    let finalCostBasis = 0;

    if (isLiquidated) {
        equity = 0;
        floatingPnL = -params.initialCapital;
        finalCostBasis = 0;
    } else {
        // Use lowPrice for final reporting to show worst-case scenario for the week
        finalPositionValue = btcHoldings * lowPrice; 
        equity = finalPositionValue - debt;
        finalLeverage = equity > 0 ? finalPositionValue / equity : 0;
        floatingPnL = equity - params.initialCapital;
        finalCostBasis = btcHoldings > 0 ? totalCostBasisUSD / btcHoldings : 0;
    }

    // Forecast / Logic Description
    let nextMsg = "";
    if (isLiquidated) {
      nextMsg = `Liquidated at Low: $${lowPrice}`;
    } else if (equity > params.initialCapital) {
      nextMsg = `In Profit (at Low). Maintaining strategy.`;
    } else {
      nextMsg = "In Loss (at Low). Holding position.";
    }

    results.push({
      weekIndex: i + 1,
      date: week.date,
      openPrice: currentPrice,
      lowPrice: lowPrice,
      action,
      btcAdded,
      actionReason,
      preActionHoldings,
      preActionCostBasis,
      totalBtcHoldings: btcHoldings,
      costBasis: finalCostBasis,
      positionValue: finalPositionValue,
      debt,
      equity,
      leverage: finalLeverage,
      floatingPnL,
      isLiquidated,
      nextWeekCondition: nextMsg
    });
  }

  return results;
};