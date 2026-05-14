import mongoose from 'mongoose';

const MONGODB_SAVE_URI = process.env.MONGODB_SAVE_URI;

if (!MONGODB_SAVE_URI) {
  throw new Error(
    '❌ MONGODB_SAVE_URI is not defined. Add it to .env.local and to Vercel Environment Variables.'
  );
}

interface MongooseCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseSaveCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseSaveCache ?? { conn: null, promise: null };
global._mongooseSaveCache = cached;

/**
 * Connects to the specialized 'db-save' MongoDB database.
 * Uses createConnection to maintain a separate connection pool from the main app database.
 */
async function connectToSaveDatabase(): Promise<mongoose.Connection> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.createConnection(MONGODB_SAVE_URI, {
      bufferCommands: false,
      maxPoolSize: 5, // Smaller pool for specialized tasks
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    }).asPromise();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToSaveDatabase;
