import { NextRequest, NextResponse } from 'next/server';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * GET /api/stream
 *
 * Sequential cursor-based API — always returns exactly ONE document at a time.
 *
 * Query params:
 *   after  — (optional) the _id of the last document the client received.
 *             When provided, returns the next document uploaded AFTER that one
 *             in chronological order.
 *             When omitted, returns the oldest document in the collection.
 *
 * Response:
 *   { data: <document> }   — next document exists
 *   { data: null }         — no new data yet, client should wait and retry
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const afterId = searchParams.get('after');

    const connection = await connectToSaveDatabase();
    const UploadSchema = new mongoose.Schema(
      {},
      { strict: false, collection: 'uploads', versionKey: false }
    );
    const UploadModel =
      connection.models.Upload ||
      connection.model('Upload', UploadSchema);

    let doc: any = null;

    if (afterId) {
      // Find the document with this _id first to get its _uploadedAt timestamp
      const anchor = await UploadModel.findById(afterId).lean();

      if (anchor && (anchor as any)._uploadedAt) {
        // Return the next document AFTER this timestamp in ascending order
        doc = await UploadModel.findOne({
          _uploadedAt: { $gt: (anchor as any)._uploadedAt },
        })
          .sort({ _uploadedAt: 1 })
          .lean();
      } else {
        // Anchor not found — return oldest document as fallback
        doc = await UploadModel.findOne({}).sort({ _uploadedAt: 1 }).lean();
      }
    } else {
      // No cursor — return the very first (oldest) document
      doc = await UploadModel.findOne({}).sort({ _uploadedAt: 1 }).lean();
    }

    return NextResponse.json(
      { data: doc ?? null },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('❌ /api/stream error:', error.message);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
