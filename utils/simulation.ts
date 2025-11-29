
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

  // Handle default if new param missing
  const reinvestRatio = params.reinvestmentRatio ?? 100;
  const reinvestPercent = reinvestRatio / 100;

  // We iterate through each week
  for (let i = 0; i < prices.length; i++) {
    const week = prices[i];
    const currentPrice = week.openPrice;
    // Use lowPrice if available, otherwise fallback to currentPrice
    const lowPrice = week.lowPrice && week.lowPrice > 0 ? week.lowPrice : currentPrice;
    
    let action: 'OPEN' | 'ADD' | 'HOLD' | 'LIQUIDATED' = 'HOLD';
    let btcAdded = 0;
    let actionReason = "";
    let justLiquidated = false; // Flag to indicate liquidation happened THIS week
    let calculatedLiqPrice = 0;

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

    // If already liquidated previously, just push dead state
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

      // Calculate Theoretical Liquidation Price (Post-Open)
      // Liq when Equity <= 0 (Price <= Debt/Holdings) OR Lev >= MaxLev
      // P_maxLev => Holdings * P / (Holdings*P - Debt) = MaxLev => P = (MaxLev * Debt) / (Holdings * (MaxLev - 1))
      const bankruptcyPrice = debt / btcHoldings;
      const maxLevPrice = (params.maxLeverage * debt) / (btcHoldings * (params.maxLeverage - 1));
      calculatedLiqPrice = Math.max(bankruptcyPrice, maxLevPrice);

      // Immediate Risk Check on Week 1 Low
      const posValueAtLow = btcHoldings * lowPrice;
      const equityAtLow = posValueAtLow - debt;
      const levAtLow = equityAtLow > 0 ? posValueAtLow / equityAtLow : Infinity;

      if (equityAtLow <= 0 || levAtLow >= params.maxLeverage) {
        action = 'LIQUIDATED';
        actionReason = "Liquidated immediately due to Week 1 low price.";
        justLiquidated = true;
      }

    } else {
      // Subsequent Weeks

      // 0. Calculate Liquidation Threshold (based on incoming state)
      // This is the price that would have killed the position *before* any rebalancing.
      if (btcHoldings > 0) {
        const bankruptcyPrice = debt / btcHoldings;
        // avoid divide by zero if maxLeverage is 1
        const maxLevPrice = params.maxLeverage > 1 
            ? (params.maxLeverage * debt) / (btcHoldings * (params.maxLeverage - 1))
            : bankruptcyPrice; 
        calculatedLiqPrice = Math.max(bankruptcyPrice, maxLevPrice);
      }

      // A. RISK CHECK (Liquidation logic based on WEEKLY LOW)
      // We calculate what the account looks like at the lowest point of the week.
      const posValueAtLow = btcHoldings * lowPrice;
      const equityAtLow = posValueAtLow - debt;
      const levAtLow = equityAtLow > 0 ? posValueAtLow / equityAtLow : Infinity;

      // Liquidation Check: Equity <= 0 OR Leverage (at Low) >= Max Leverage
      if (equityAtLow <= 0 || levAtLow >= params.maxLeverage) {
        action = 'LIQUIDATED';
        actionReason = equityAtLow <= 0 ? "Equity hit 0 at weekly low." : `Leverage (${levAtLow.toFixed(2)}x) exceeded max (${params.maxLeverage}x) at weekly low.`;
        justLiquidated = true;
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
        } else if (reinvestRatio === 0) {
            actionReason = `Profitable, but Reinvestment Ratio is set to 0%. Holding.`;
        }

        // We only ADD position to restore leverage if we are profitable.
        if (hasFloatingProfit && currentLeverage < params.leverage && reinvestPercent > 0) {
          const targetPosition = equity * params.leverage;
          const rawDifference = targetPosition - positionValue;
          
          // Apply Reinvestment Ratio
          // If ratio is 50%, we only buy 50% of the difference needed to reach target leverage.
          const difference = rawDifference * reinvestPercent;

          if (difference > 0) {
            const btcToBuy = difference / currentPrice;
            btcHoldings += btcToBuy;
            debt += difference; // We borrow more to buy more
            
            // Update Cost Basis
            totalCostBasisUSD += (btcToBuy * currentPrice);
            
            btcAdded = btcToBuy;
            action = 'ADD';
            
            const pctText = reinvestRatio < 100 ? ` (${reinvestRatio}% reinvest)` : '';
            actionReason = `Profit detected. Lev dropped to ${currentLeverage.toFixed(2)}x. Rebalancing${pctText} towards ${params.leverage}x.`;
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
    let reportedEquity = 0;

    if (justLiquidated) {
        // SPECIAL CASE: The week we busted.
        // We report the theoretical values that triggered the bust.
        // posValue is based on Low. Debt is full debt. Equity is negative.
        finalPositionValue = btcHoldings * lowPrice;
        reportedEquity = finalPositionValue - debt;
        // Prevent leverage division by zero or negative flip messiness, usually logic defines busted leverage as High or 0.
        // We'll show the leverage that killed it (if equity > 0 but high) or just 0 if equity <= 0
        finalLeverage = reportedEquity > 0 ? finalPositionValue / reportedEquity : 0; 
        floatingPnL = reportedEquity - params.initialCapital;
        finalCostBasis = btcHoldings > 0 ? totalCostBasisUSD / btcHoldings : 0;
        
        // Set the message
        actionReason += ` (Debt: $${Math.round(debt)}, Pos: $${Math.round(finalPositionValue)})`;
    } else {
        // Normal survival case
        finalPositionValue = btcHoldings * lowPrice; 
        reportedEquity = finalPositionValue - debt;
        finalLeverage = reportedEquity > 0 ? finalPositionValue / reportedEquity : 0;
        floatingPnL = reportedEquity - params.initialCapital;
        finalCostBasis = btcHoldings > 0 ? totalCostBasisUSD / btcHoldings : 0;
    }

    // Forecast / Logic Description
    let nextMsg = "";
    if (justLiquidated) {
      nextMsg = `Liquidated at Low: $${lowPrice}`;
    } else if (reportedEquity > params.initialCapital) {
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
      theoreticalLiqPrice: calculatedLiqPrice,
      totalBtcHoldings: btcHoldings,
      costBasis: finalCostBasis,
      positionValue: finalPositionValue,
      debt,
      equity: reportedEquity,
      leverage: finalLeverage,
      floatingPnL,
      isLiquidated: justLiquidated || isLiquidated,
      nextWeekCondition: nextMsg
    });

    // Post-reporting cleanup for next iteration
    // If we just liquidated, the NEXT week starts with 0.
    if (justLiquidated) {
        isLiquidated = true;
        equity = 0;
        btcHoldings = 0;
        debt = 0;
        totalCostBasisUSD = 0;
    } else {
        // Update equity for next loop based on close price (which is next open)?
        // Actually, the simulation variable 'equity' tracks the "strategy view" which is usually based on currentPrice.
        // However, 'equity' variable is recalculated at start of next strategy block via (btcHoldings * currentPrice - debt).
        // So we don't need to manually update `equity` here, just debt and btcHoldings persist.
    }
  }

  return results;
};
