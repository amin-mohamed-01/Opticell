import { NextRequest, NextResponse } from 'next/server';
import connectToTestDatabase from '@/lib/test-mongodb';
import { ReadingSchema, IReading } from '@/models/Reading';
import mongoose from 'mongoose';

/**
 * POST /api/internal/ingest-test-data
 * Hidden endpoint for uploading sensor readings to the test MongoDB instance.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Basic validation
    if (
      typeof body.sensorId !== 'number' ||
      typeof body.data !== 'object' ||
      body.data === null
    ) {
      return NextResponse.json(
        { error: 'Invalid payload. Expected: { sensorId: number, data: object }' },
        { status: 400 }
      );
    }

    // Connect to TEST database
    const conn = await connectToTestDatabase();
    
    // Define the model on the test connection to ensure it uses the correct DB
    const TestReading = conn.models.Reading || conn.model<IReading>('Reading', ReadingSchema);

    // Prepare data for insertion
    const readingData: any = {
      sensorId: body.sensorId,
      data: body.data,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    };

    // If _id is provided, try to use it
    if (body._id) {
      // If it looks like a hex string for ObjectId, convert it
      if (typeof body._id === 'string' && /^[0-9a-fA-F]{24}$/.test(body._id)) {
        readingData._id = new mongoose.Types.ObjectId(body._id);
      } else {
        readingData._id = body._id;
      }
    }

    // Insert into test collection
    const result = await TestReading.create(readingData);

    return NextResponse.json({
      success: true,
      message: 'Data ingested into test database',
      insertedId: result._id,
      data: result
    }, { status: 201 });

  } catch (error: any) {
    console.error('[POST /api/internal/ingest-test-data]', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to ingest data', 
      details: error.message 
    }, { status: 500 });
  }
}
