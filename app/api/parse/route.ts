import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API configuration error. Please contact support." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Security Gate: Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds the 5MB limit. Please compress and try again." },
        { status: 413 }
      );
    }

    // Security Gate: Validate File Type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Only JPG, PNG, WEBP, and PDF are supported." },
        { status: 415 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    const modelsReq = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const modelsData = await modelsReq.json();
    
    if (!modelsReq.ok) {
      return NextResponse.json({ error: "Failed to initialize AI connection." }, { status: 500 });
    }

    const validModels = modelsData.models
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => m.name.replace("models/", ""))
      .filter((name: string) => name.includes("flash") || name.includes("pro"));

    const prompt = `
    Analyze this receipt and return ONLY raw JSON matching this exact structure. Do not include markdown formatting like \`\`\`json.
    {
      "vendor": "Store Name",
      "date": "YYYY-MM-DD",
      "invoice_number": "12345",
      "tax": 0.00,
      "total": 0.00,
      "currency": "$",
      "items": [
        { "description": "Item name", "qty": 1, "unit_price": 0.00, "amount": 0.00 }
      ]
    }
    `;

    let lastError = null;

    for (const model of validModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedText = rawText.replace(/```json\s*|\s*```/g, "").trim();
        return NextResponse.json(JSON.parse(cleanedText));
      } else {
        lastError = data.error?.message;
        if (response.status === 503) {
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    }

    return NextResponse.json({ error: "AI service is currently congested. Please wait a moment and try again." }, { status: 503 });
  } catch (error: any) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Failed to process receipt. Ensure the image is clear and readable." }, { status: 500 });
  }
}