import mongoose from "mongoose";

const incentiveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    month: {
      type: String,
      required: true,
      trim: true, // e.g. "APRIL, 26"
    },
    product: {
      type: String,
      required: true,
      default: "Mutual Funds",
      trim: true,
    },
    // Transaction per month (replaces total income)
    transactionPerMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Maintained for backward compatibility
    totalIncome: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Projected Income (Yearly) = transactionPerMonth * 12
    projectedIncomeYearly: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Actual Income (Yearly) = defaults to transactionPerMonth * 12, editable by admin
    actualIncomeYearly: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Commission percentage input by admin (e.g. 50%)
    commissionPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Incentive amount = Projected Income (Yearly) * (Commission% / 2) / 100 (auto-computed, editable)
    incentiveAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    disbursementDate: {
      type: Date,
      required: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Incentive =
  mongoose.models.Incentive || mongoose.model("Incentive", incentiveSchema);

export default Incentive;
