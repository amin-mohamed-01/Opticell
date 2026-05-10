// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

// ───────────────────────────────────────────────
// Global MongoDB client caching (very important for Next.js)
// ───────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI as string;
const dbName = 'opticell_db';
const collectionName = 'chats';

let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

// ───────────────────────────────────────────────
// GET    →   get all chats
// ───────────────────────────────────────────────
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);

    const chats = await db
      .collection(collectionName)
      .find({})
      .sort({ updatedAt: -1 }) // newest first
      .toArray();

    return NextResponse.json(chats);
  } catch (error) {
    console.error('GET /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

// ───────────────────────────────────────────────
// POST   →   create new chat  OR  update existing chat
// ───────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { _id, ...chatData } = body;

    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const now = new Date();

    if (_id) {
      // ── Update existing chat ──
      await collection.updateOne(
        { _id: new ObjectId(_id) },
        {
          $set: {
            ...chatData,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json({ success: true, _id });
    } else {
      // ── Create new chat ──
      const result = await collection.insertOne({
        ...chatData,
        createdAt: now,
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        _id: result.insertedId.toString(),
      });
    }
  } catch (error) {
    console.error('POST /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to save chat' }, { status: 500 });
  }
}

// ───────────────────────────────────────────────
// DELETE   →   delete one chat
// ───────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(dbName);

    const result = await db.collection(collectionName).deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}