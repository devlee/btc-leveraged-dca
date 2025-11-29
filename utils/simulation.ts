
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
    // Use highPrice if available, otherwise fallback to max(current, low)
    const highPrice = week.highPrice && week.highPrice > 0 ? week.highPrice : Math.max(currentPrice, lowPrice);
    
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
        highPrice: 0,
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
        positionValueHigh: 0,
        equityHigh: equity,
        leverageHigh: 0,
        floatingPnLHigh: equity - params.initialCapital,
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
        highPrice: highPrice,
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
        positionValueHigh: 0,
        equityHigh: 0,
        leverageHigh: 0,
        floatingPnLHigh: -params.initialCapital,
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
      if (btcHoldings > 0) {
        const bankruptcyPrice = debt / btcHoldings;
        const maxLevPrice = params.maxLeverage > 1 
            ? (params.maxLeverage * debt) / (btcHoldings * (params.maxLeverage - 1))
            : bankruptcyPrice; 
        calculatedLiqPrice = Math.max(bankruptcyPrice, maxLevPrice);
      }

      // A. RISK CHECK (Liquidation logic based on WEEKLY LOW)
      const posValueAtLow = btcHoldings * lowPrice;
      const equityAtLow = posValueAtLow - debt;
      const levAtLow = equityAtLow > 0 ? posValueAtLow / equityAtLow : Infinity;

      // Liquidation Check
      if (equityAtLow <= 0 || levAtLow >= params.maxLeverage) {
        action = 'LIQUIDATED';
        actionReason = equityAtLow <= 0 ? "Equity hit 0 at weekly low." : `Leverage (${levAtLow.toFixed(2)}x) exceeded max (${params.maxLeverage}x) at weekly low.`;
        justLiquidated = true;
      } else {
        // B. STRATEGY CHECK (Based on OPEN Price)
        const positionValue = btcHoldings * currentPrice;
        equity = positionValue - debt;
        const currentLeverage = equity > 0 ? positionValue / equity : Infinity;

        const hasFloatingProfit = equity > params.initialCapital;
        
        if (!hasFloatingProfit) {
            actionReason = `PnL ≤ 0 (Equity: $${Math.round(equity).toLocaleString()}). Strategy only adds when in profit.`;
        } else if (currentLeverage >= params.leverage) {
            actionReason = `Current Lev (${currentLeverage.toFixed(2)}x) ≥ Target (${params.leverage}x). No need to add.`;
        } else if (reinvestRatio === 0) {
            actionReason = `Profitable, but Reinvestment Ratio is set to 0%. Holding.`;
        }

        // Add Logic
        if (hasFloatingProfit && currentLeverage < params.leverage && reinvestPercent > 0) {
          const targetPosition = equity * params.leverage;
          const rawDifference = targetPosition - positionValue;
          const difference = rawDifference * reinvestPercent;

          if (difference > 0) {
            const btcToBuy = difference / currentPrice;
            btcHoldings += btcToBuy;
            debt += difference; 
            totalCostBasisUSD += (btcToBuy * currentPrice);
            btcAdded = btcToBuy;
            action = 'ADD';
            
            const pctText = reinvestRatio < 100 ? ` (${reinvestRatio}% reinvest)` : '';
            actionReason = `Profit detected. Lev dropped to ${currentLeverage.toFixed(2)}x. Rebalancing${pctText} towards ${params.leverage}x.`;
          }
        }
      }
    }

    // 2. Final State for Week (Reported Ranges)
    
    // --- LOW SCENARIO ---
    let finalPositionValue = btcHoldings * lowPrice;
    let reportedEquity = finalPositionValue - debt;
    // Handle liquidation reporting specifically
    if (justLiquidated) {
        actionReason += ` (Debt: $${Math.round(debt)}, Pos Low: $${Math.round(finalPositionValue)})`;
    }
    let finalLeverage = reportedEquity > 0 ? finalPositionValue / reportedEquity : 0;
    let floatingPnL = reportedEquity - params.initialCapital;

    // --- HIGH SCENARIO ---
    let finalPositionValueHigh = btcHoldings * highPrice;
    let reportedEquityHigh = finalPositionValueHigh - debt;
    let finalLeverageHigh = reportedEquityHigh > 0 ? finalPositionValueHigh / reportedEquityHigh : 0;
    let floatingPnLHigh = reportedEquityHigh - params.initialCapital;
    
    const finalCostBasis = btcHoldings > 0 ? totalCostBasisUSD / btcHoldings : 0;

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
      highPrice: highPrice,
      action,
      btcAdded,
      actionReason,
      preActionHoldings,
      preActionCostBasis,
      theoreticalLiqPrice: calculatedLiqPrice,
      totalBtcHoldings: btcHoldings,
      costBasis: finalCostBasis,
      
      // Low Stats
      positionValue: finalPositionValue,
      debt,
      equity: reportedEquity,
      leverage: finalLeverage,
      floatingPnL,

      // High Stats
      positionValueHigh: finalPositionValueHigh,
      equityHigh: reportedEquityHigh,
      leverageHigh: finalLeverageHigh,
      floatingPnLHigh,

      isLiquidated: justLiquidated || isLiquidated,
      nextWeekCondition: nextMsg
    });

    // Post-reporting cleanup
    if (justLiquidated) {
        isLiquidated = true;
        equity = 0;
        btcHoldings = 0;
        debt = 0;
        totalCostBasisUSD = 0;
    }
  }

  return results;
};
