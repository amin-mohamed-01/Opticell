import { NextRequest, NextResponse } from 'next/server';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// CORS Headers for public API access
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const connection = await connectToSaveDatabase();
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: getCorsHeaders() });
    }

    const dataToSave = {
      ...body,
      _uploadedAt: new Date(),
    };

    const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
    const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);

    const result = await UploadModel.create(dataToSave);
    console.log('✅ Data uploaded to db-save:', result._id);

    return NextResponse.json({
      success: true,
      message: 'Data uploaded successfully to db-save',
      id: result._id,
    }, { status: 201, headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('❌ Error uploading to db-save:', error);
    return NextResponse.json({
      error: 'Failed to upload data',
      details: error.message
    }, { status: 500, headers: getCorsHeaders() });
  }
}

// Public API: Fetch data from uploads collection
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const sensorId = searchParams.get('sensorId');

    const connection = await connectToSaveDatabase();
    const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
    const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);

    let query = {};
    if (sensorId) {
      query = { sensorId: parseInt(sensorId) || sensorId };
    }

    // Return the uploads sorted by timestamp DESC
    const uploads = await UploadModel.find(query)
      .sort({ _uploadedAt: -1 })
      .limit(limit);

    return NextResponse.json({
      status: 'success',
      count: uploads.length,
      data: uploads
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('⚠️ db-save primary cluster failed, attempting fallback to main readings...', error.message);
    
    try {
      // FALLBACK: Try to get data from the main readings collection
      // This ensures the dashboard always has "Real Data" even if the specialized cluster is down
      const mainRes = await fetch(`${req.nextUrl.origin}/api/readings?t=${Date.now()}`);
      if (mainRes.ok) {
        const readings = await mainRes.json();
        return NextResponse.json({
          status: 'success',
          source: 'fallback-readings',
          count: readings.length,
          data: readings
        }, { headers: getCorsHeaders() });
      }
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
    }

    return NextResponse.json({ 
      error: 'Failed to fetch data from all sources', 
      details: error.message 
    }, { status: 500, headers: getCorsHeaders() });
  }
}

