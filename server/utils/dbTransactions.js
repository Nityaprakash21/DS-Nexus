import mongoose from "mongoose";

let isTransactionSupported = null;

// Determine if the current MongoDB topology supports ACID replica-set transactions
export const canUseTransactions = () => {
  if (isTransactionSupported !== null) return isTransactionSupported;
  const topology = mongoose.connection?.client?.topology?.description;
  if (!topology) return null;
  const servers = Array.from(topology.servers?.values() || []);
  if (topology.type === "Single" && servers.some((s) => s.type === "Standalone")) {
    return false;
  }
  if (topology.type?.includes("ReplicaSet") || topology.type?.includes("Sharded")) {
    return true;
  }
  return null;
};

// Check if an error indicates that transactions or sessions are unsupported on this deployment
export const isStandaloneOrNoTxError = (err) => {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const origMsg = (err.originalError?.message || "").toLowerCase();
  const respMsg = (err.errorResponse?.errmsg || err.errorResponse?.message || "").toLowerCase();
  const combined = `${msg} ${origMsg} ${respMsg}`;

  return (
    combined.includes("replica set") ||
    combined.includes("retryable write") ||
    combined.includes("retrywrites=false") ||
    combined.includes("standalone") ||
    combined.includes("transactions are not supported") ||
    err.code === 20 ||
    err.originalError?.code === 20
  );
};

// Resilient ACID Transaction Helper
// Executes multi-collection mutations with ACID atomicity on MongoDB Replica Sets (Production/Atlas),
// with automatic fallback on standalone development databases.
export const runInTransaction = async (workFn) => {
  // If we already know the current deployment is standalone or does not support transactions,
  // bypass session creation directly for optimal performance and reliability.
  if (canUseTransactions() === false) {
    return await workFn(null);
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    isTransactionSupported = true;
    return result;
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (_) {}
    }
    // If standalone development instance without replica set, execute without transaction session
    if (isStandaloneOrNoTxError(err)) {
      isTransactionSupported = false;
      return await workFn(null);
    }
    throw err;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (_) {}
    }
  }
};
