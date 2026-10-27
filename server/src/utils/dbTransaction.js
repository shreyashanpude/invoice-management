const mongoose = require('mongoose');

/**
 * Run a callback inside a MongoDB session/transaction when available.
 * Falls back gracefully on standalone MongoDB (no replica set).
 *
 * Usage:
 *   await withTransaction(async (session) => {
 *     await Model.create([doc], { session });
 *     await Other.findByIdAndUpdate(id, update, { session });
 *   });
 */
const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    // Check if transactions are supported (requires replica set)
    let useTransaction = false;
    try {
      session.startTransaction();
      useTransaction = true;
    } catch (e) {
      // Standalone node — transactions not supported
      useTransaction = false;
      session.endSession();
    }

    if (useTransaction) {
      try {
        const result = await fn(session);
        await session.commitTransaction();
        return result;
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } else {
      // Run without session/transaction
      return await fn(null);
    }
  } catch (err) {
    try { session.endSession(); } catch {}
    throw err;
  }
};

module.exports = { withTransaction };
