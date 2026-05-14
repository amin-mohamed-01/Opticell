import mongoose from 'mongoose';

const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI as string;

if (!TEST_MONGODB_URI) {
  throw new Error(
    '❌ TEST_MONGODB_URI is not defined. Add it to .env.local and to Vercel Environment Variables.'
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseTestCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseTestCache ?? { conn: null, promise: null };
global._mongooseTestCache = cached;

async function connectToTestDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(TEST_MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToTestDatabase;
