import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReading extends Document {
  sensorId: number;
  data: Record<string, number | string>;
  timestamp: Date;
}

const ReadingSchema = new Schema<IReading>(
  {
    sensorId: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, required: true, default: () => new Date() },
  },
  {
    collection: 'sensor_readings',
    versionKey: false,
  }
);

const Reading: Model<IReading> =
  mongoose.models.Reading ?? mongoose.model<IReading>('Reading', ReadingSchema);

export default Reading;
