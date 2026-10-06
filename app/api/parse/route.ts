import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Updated prompt to mandate subtotal and tax extraction
    const prompt = `
      Analyze this receipt/invoice and extract the following information in strict JSON format:
      - vendor: Name of the store, company, or restaurant
      - date: Date of the transaction
      - invoice_number: Receipt or invoice number
      - currency: Currency symbol (e.g., $, €, £)
      - subtotal: The total amount before taxes (as a string or number)
      - tax: The total tax, GST, or VAT amount (as a string or number)
      - total: The grand total amount (as a string or number)
      - items: An array of objects, where each object has:
        - description: Name of the item
        - qty: Quantity purchased
        - unit_price: Price per single unit
        - amount: Total price for that item row

      Return ONLY valid JSON without any markdown formatting, backticks, or extra text.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ]);

    const text = result.response.text();
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(jsonString);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Parsing Error:", error);
    return NextResponse.json({ error: "Failed to extract receipt data." }, { status: 500 });
  }
}