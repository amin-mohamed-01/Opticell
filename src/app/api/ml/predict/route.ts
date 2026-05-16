import { NextRequest, NextResponse } from 'next/server';
import connectToSaveDatabase from '@/lib/mongodb-save';
import mongoose from 'mongoose';

const ML_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://memo-009-opticell-ml-backend.hf.space';

// CORS Headers for public API access
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    // Call the new pull-based endpoint on the ML backend
    // This is more efficient as the ML backend now handles its own DB connection
    const mlRes = await fetch(`${ML_BACKEND_URL}/predict-latest?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!mlRes.ok) {
      const errBody = await mlRes.json().catch(() => ({}));
      throw new Error(errBody.detail || `ML Backend Error: ${mlRes.status}`);
    }

    const result = await mlRes.json();

    // Check if the result already has the 'prediction' wrapper (new format)
    // If not, wrap it to maintain compatibility with the frontend
    const finalResponse = result.prediction ? {
      success: true,
      ...result
    } : {
      success: true,
      prediction: {
        predicted_label: result.predicted_label,
        predicted_rul: result.predicted_rul
      },
      latest_reading: result.latest_reading || null,
      ...result
    };

    return NextResponse.json(finalResponse, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('❌ ML Prediction Route Error:', error);
    
    // Provide a more descriptive error for the frontend
    return NextResponse.json({
      error: 'Prediction failed',
      message: error.message,
      details: error.stack,
      hint: 'Verify that the ML Backend is running at ' + (process.env.NEXT_PUBLIC_API_URL || 'the default HF Space URL')
    }, { status: 500, headers: getCorsHeaders() });
  }
}
