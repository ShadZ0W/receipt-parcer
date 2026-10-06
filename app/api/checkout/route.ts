import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-09-30.endive", // Updated to match the latest SDK types
});

export async function POST(req: NextRequest) {
  try {
    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      // payment_method_types is intentionally omitted; Stripe manages this via your Dashboard
      line_items: [
        {
          price: "prod_VO2y4Bg9yNR3iZ", // <-- REPLACE THIS WITH YOUR ACTUAL STRIPE PRICE ID
          quantity: 1,
        },
      ],
      mode: "payment", 
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`,
    });

    // Return the secure checkout URL to the frontend
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}