// Incentive Calculation Domain Service
// Contains pure financial formulas for incentives, commissions, and yearly projections

export const calculateIncentiveMetrics = ({
  transactionPerMonth,
  totalIncome,
  projectedIncomeYearly,
  actualIncomeYearly,
  commissionPercentage,
  incentiveAmount,
}) => {
  const transPerMonth =
    transactionPerMonth !== undefined && transactionPerMonth !== null
      ? parseFloat(Number(transactionPerMonth).toFixed(2))
      : parseFloat(Number(totalIncome || 0).toFixed(2));

  const projYearly =
    projectedIncomeYearly !== undefined && projectedIncomeYearly !== null
      ? parseFloat(Number(projectedIncomeYearly).toFixed(2))
      : parseFloat((transPerMonth * 12).toFixed(2));

  const actYearly =
    actualIncomeYearly !== undefined && actualIncomeYearly !== null
      ? parseFloat(Number(actualIncomeYearly).toFixed(2))
      : projYearly;

  const commPct =
    commissionPercentage !== undefined && commissionPercentage !== null
      ? parseFloat(Number(commissionPercentage).toFixed(2))
      : 0;

  const calculatedIncentive =
    incentiveAmount !== undefined && incentiveAmount !== null
      ? parseFloat(Number(incentiveAmount).toFixed(2))
      : parseFloat(((transPerMonth * commPct) / 100).toFixed(2));

  return {
    transactionPerMonth: transPerMonth,
    totalIncome: transPerMonth,
    projectedIncomeYearly: projYearly,
    actualIncomeYearly: actYearly,
    commissionPercentage: commPct,
    incentiveAmount: calculatedIncentive,
  };
};

export const aggregateIncentiveStats = (incentives = []) => {
  const totalTransactionVolume = incentives.reduce(
    (sum, item) => sum + (Number(item.transactionPerMonth || item.totalIncome) || 0),
    0
  );
  const totalIncentivePaid = incentives.reduce(
    (sum, item) => sum + (Number(item.incentiveAmount) || 0),
    0
  );
  const totalProjectedVolume = incentives.reduce(
    (sum, item) => sum + (Number(item.projectedIncomeYearly) || 0),
    0
  );

  return {
    totalRecords: incentives.length,
    totalTransactionVolume: parseFloat(totalTransactionVolume.toFixed(2)),
    totalIncentivePaid: parseFloat(totalIncentivePaid.toFixed(2)),
    totalProjectedVolume: parseFloat(totalProjectedVolume.toFixed(2)),
    avgCommissionPct:
      incentives.length > 0
        ? parseFloat(
            (
              incentives.reduce((sum, item) => sum + (Number(item.commissionPercentage) || 0), 0) /
              incentives.length
            ).toFixed(2)
          )
        : 0,
  };
};
