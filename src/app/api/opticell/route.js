import fs from "fs";
import path from "path";

/**
 * GET /api/opticell
 * Reads opticell_clean1.csv from /public/data/ and returns it as JSON.
 * Uses native CSV parsing — no external dependencies required.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public/data/opticell_clean1.csv");

    if (!fs.existsSync(filePath)) {
      return Response.json(
        { error: "CSV data file not found on server." },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.trim().split("\n");

    if (lines.length < 2) {
      return Response.json({ count: 0, data: [] });
    }

    // Parse headers (first line)
    const headers = lines[0].split(",").map((h) => h.trim());

    // Parse each data row into an object
    const data = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((header, i) => {
        const raw = values[i] ?? "";
        const num = parseFloat(raw);
        row[header] = isNaN(num) ? raw : num;
      });
      return row;
    });

    return Response.json({ count: data.length, data });
  } catch (error) {
    console.error("[GET /api/opticell]", error);
    return Response.json({ error: "Failed to parse CSV data." }, { status: 500 });
  }
}
