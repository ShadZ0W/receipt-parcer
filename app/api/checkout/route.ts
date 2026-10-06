import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-09-30.endive", 
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { priceId, mode, plan } = body; // Add 'plan' here

    if (!priceId) return NextResponse.json({ error: "Price ID required" }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode || "subscription",
      // Attach the plan string to the return URL
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true&plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create checkout." }, { status: 500 });
  }
}