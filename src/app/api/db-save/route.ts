import { NextRequest, NextResponse } from 'next/server';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    // 1. Connect to the specialized database
    const connection = await connectToSaveDatabase();

    // 2. Parse the request body (any JSON)
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 3. Prepare the data with a server-side timestamp
    const dataToSave = {
      ...body,
      _uploadedAt: new Date(),
    };

    // 4. Use a generic collection to store the data
    // We use Schema.Types.Mixed and strict: false to allow any structure
    const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
    
    // Check if model already exists on this connection
    const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);

    // 5. Save the data
    const result = await UploadModel.create(dataToSave);

    console.log('✅ Data uploaded to db-save:', result._id);

    return NextResponse.json({
      success: true,
      message: 'Data uploaded successfully to db-save',
      id: result._id,
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error uploading to db-save:', error);
    return NextResponse.json({ 
      error: 'Failed to upload data', 
      details: error.message 
    }, { status: 500 });
  }
}

// Optional: GET handler to verify connection or list recent uploads (be careful with privacy)
export async function GET() {
  try {
    const connection = await connectToSaveDatabase();
    const UploadSchema = new mongoose.Schema({}, { strict: false, collection: 'uploads', versionKey: false });
    const UploadModel = connection.models.Upload || connection.model('Upload', UploadSchema);
    
    // Return the last 5 uploads for verification
    const recentUploads = await UploadModel.find().sort({ _uploadedAt: -1 }).limit(5);

    return NextResponse.json({
      status: 'connected',
      database: 'db-save',
      recentCount: recentUploads.length,
      recent: recentUploads
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Connection failed', details: error.message }, { status: 500 });
  }
}
