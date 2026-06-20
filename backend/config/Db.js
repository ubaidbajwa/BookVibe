// --- Imports ---

import mongoose from 'mongoose';

// --- Database Connection ---

/**
 * Establishes a connection to the MongoDB database.
 * 
 * @async
 * @function connectDB
 * @returns {Promise<void>}
 * @throws {Error} If the connection fails, the process will exit with code 1.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// --- Exports ---

export {
  connectDB
};
