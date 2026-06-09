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
 * Server-Sent Events (SSE) API — maintains a persistent connection with the client
 * and streams real-time updates using MongoDB Change Streams.
 */
export async function GET(req: NextRequest) {
  try {
    const connection = await connectToSaveDatabase();
    const UploadSchema = new mongoose.Schema(
      {},
      { strict: false, collection: 'uploads', versionKey: false }
    );
    const UploadModel =
      connection.models.Upload ||
      connection.model('Upload', UploadSchema);

    // Create a ReadableStream to stream Server-Sent Events (SSE) to the client
    const stream = new ReadableStream({
      async start(controller) {
        // 1. On first connection: query MongoDB for the single most recent document
        const latestDoc = await UploadModel.findOne({}, {}, { sort: { _id: -1 } }).lean();
        const encoder = new TextEncoder();

        if (latestDoc) {
          // Send the initial most recent document immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(latestDoc)}\n\n`));
        }

        // 2. Open a MongoDB Change Stream to listen for new inserts
        const changeStream = UploadModel.watch([], { fullDocument: 'updateLookup' });

        // 3. On every 'change' event where operationType is 'insert', send the new document
        changeStream.on('change', (change) => {
          if (change.operationType === 'insert') {
            const newDoc = change.fullDocument;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(newDoc)}\n\n`));
          }
        });

        // 4. On client disconnect, close the change stream cleanly
        req.signal.addEventListener('abort', () => {
          changeStream.close();
          controller.close();
        });
      }
    });

    // Return the stream with appropriate SSE headers
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('❌ /api/stream error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
