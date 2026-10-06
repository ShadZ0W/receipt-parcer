"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const FREE_LIMIT = 3;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [usageCount, setUsageCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // New Timer States
  const [expiry, setExpiry] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      const plan = params.get("plan");
      let expiryTime = null;

      if (plan === "24h") expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      if (plan === "monthly") expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
      if (plan === "lifetime") expiryTime = -1; // -1 represents lifetime

      if (expiryTime) localStorage.setItem("proExpiry", expiryTime.toString());
      window.history.replaceState(null, "", "/");
    }

    const storedExpiry = localStorage.getItem("proExpiry");
    if (storedExpiry) {
      setExpiry(parseInt(storedExpiry, 10));
      setIsPro(true);
    } else {
      // Fallback for older testing
      setIsPro(localStorage.getItem("isPro") === "true");
    }
    setUsageCount(parseInt(localStorage.getItem("usageCount") || "0", 10));
  }, []);

  // Countdown logic
  useEffect(() => {
    if (!expiry || expiry === -1) return;

    const interval = setInterval(() => {
      const difference = expiry - Date.now();

      if (difference <= 0) {
        setIsPro(false);
        localStorage.removeItem("proExpiry");
        setTimeLeft("Expired");
        clearInterval(interval);
      } else {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const m = Math.floor((difference / 1000 / 60) % 60);
        setTimeLeft(d > 0 ? `${d}d ${h}h remaining` : `${h}h ${m}m remaining`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiry]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setData(null);

    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setError("Unsupported format. Please upload a JPG, PNG, WEBP, or PDF.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Keep uploads under 5MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    setProgress(20);
    setProgressText("Uploading document...");
    
    const form = new FormData();
    form.append("file", file);

    try {
      // Fake progress interval to keep the user engaged while waiting for AI
      const progressInterval = setInterval(() => {
        setProgress((prev) => (prev >= 85 ? 85 : prev + 15));
        setProgressText("AI is extracting line items & taxes...");
      }, 800);

      const res = await fetch("/api/parse", { method: "POST", body: form });
      clearInterval(progressInterval);
      
      const result = await res.json();

      // Strict failure check: Do not charge a scan if the AI failed to read it
      if (!res.ok || !result.items || result.items.length === 0) {
        throw new Error(result.error || "Failed to extract receipt data. Your free attempt was not used.");
      }

      setProgress(100);
      setProgressText("Formatting spreadsheet...");
      setData(result);

      if (!isPro) {
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        localStorage.setItem("usageCount", newCount.toString());
      }

    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setTimeout(() => setLoading(false), 800); // Allow 100% to show briefly
      e.target.value = ""; 
    }
  };

  const handleCheckout = async (priceId: string, mode: string, plan: string) => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode, plan }) // Passes the plan to the backend
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url; 
    } catch (err) {
      setError("Failed to load checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!data?.items) return;
    
    const exportData = [
      ["Receipt Summary", ""],
      ["Vendor", data.vendor || "Unknown Vendor"],
      ["Date", data.date || "N/A"],
      ["Invoice #", data.invoice_number || "N/A"],
      [], 
      // Added a Category column so users can easily tag expenses for tax software
      ["Item Description", "Category", "Quantity", "Unit Price", "Total Amount"]
    ];

    data.items.forEach((it: any) => {
      exportData.push([it.description, "", it.qty || 1, it.unit_price || "", it.amount || ""]);
    });

    // Append strict financial totals at the bottom
    exportData.push([]);
    exportData.push(["", "", "", "Subtotal:", `${data.currency || "$"}${data.subtotal || "0.00"}`]);
    exportData.push(["", "", "", "Tax / GST:", `${data.currency || "$"}${data.tax || "0.00"}`]);
    exportData.push(["", "", "", "Grand Total:", `${data.currency || "$"}${data.total || "0.00"}`]);

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    // Adjusted column widths to accommodate the new Category column
    worksheet["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
    
    const safeVendorName = (data.vendor || "receipt").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `${safeVendorName}_expenses.xlsx`);
  };

  const hitLimit = !isPro && usageCount >= FREE_LIMIT;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-16 px-4">
      <div className="max-w-2xl w-full text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Turn Invoices & Receipts into Excel in 5 Seconds
        </h1>
        <p className="text-slate-600 text-lg">
          Drop your PDF or photo, preview the extraction, and export cleanly to a spreadsheet.
        </p>

        {/* Timer Banner */}
        {isPro && (
          <div className="mt-2 flex justify-center">
            {expiry === -1 ? (
              <div className="inline-block bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 text-sm font-extrabold px-6 py-2 rounded-full shadow-md border border-yellow-300 animate-in fade-in zoom-in duration-500">
                👑 Lifetime Founding Member
              </div>
            ) : (
              <div className="inline-block bg-emerald-100 text-emerald-800 text-sm font-bold px-5 py-2 rounded-full shadow-sm border border-emerald-200 animate-in fade-in zoom-in duration-500">
                ✓ Pro Active - {timeLeft}
              </div>
            )}
          </div>
        )}

        {!isPro && (
          <p className="text-sm font-medium text-slate-500">
            Free scans remaining: {Math.max(0, FREE_LIMIT - usageCount)} / {FREE_LIMIT}
          </p>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        {hitLimit ? (
          <div className="mt-8 bg-white border-2 border-blue-100 rounded-xl p-10 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">You've reached your free limit</h3>
            <p className="text-slate-600 mb-6">Upgrade to Pro for unlimited exports and priority processing.</p>
            <button
              onClick={() => handleCheckout("prod_VO2y4Bg9yNR3iZ", "subscription", "monthly")}
              disabled={checkoutLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow transition disabled:opacity-50"
            >
              {checkoutLoading ? "Redirecting..." : "Unlock Unlimited Access"}
            </button>
          </div>
        ) : (
          <div className="mt-8 relative border-2 border-dashed border-slate-300 rounded-xl p-10 bg-white shadow-sm hover:border-slate-400 transition cursor-pointer overflow-hidden group">
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp, application/pdf"
              onChange={handleUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none w-full">
              {loading ? (
                <div className="w-full max-w-xs mx-auto text-center space-y-4">
                  <p className="text-blue-600 font-medium animate-pulse">{progressText}</p>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-slate-700 font-semibold group-hover:text-blue-600 transition">
                    Click or drag file to upload
                  </p>
                  <p className="text-slate-400 text-sm">JPG, PNG, WEBP, or PDF (Max 5MB)</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Extracted Data Table */}
        {data && (
          <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{data.vendor || "Unknown Vendor"}</h3>
                <p className="text-sm text-slate-500">Date: {data.date} | Total: {data.currency || "$"} {data.total}</p>
              </div>
              <button
                onClick={downloadExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow transition"
              >
                Download Excel (.xlsx)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b text-slate-400 uppercase text-xs">
                    <th className="py-2">Item</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items?.map((it: any, i: number) => (
                    <tr key={i} className="border-b text-slate-700 hover:bg-slate-50">
                      <td className="py-2 pr-4">{it.description}</td>
                      <td className="py-2 pr-4">{it.qty || 1}</td>
                      <td className="py-2">{it.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Section */}
      {!isPro && (
        <div className="mt-20 w-full pt-16 border-t border-slate-200">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Upgrade to Pro</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
            
            {/* 24-Hour Pass */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition flex flex-col">
              <h3 className="text-xl font-bold text-slate-800">24-Hour Pass</h3>
              <p className="text-slate-500 mt-2 mb-6">Perfect for processing a quick batch of expense reports.</p>
              <div className="text-4xl font-extrabold text-slate-900 mb-6">$4.99<span className="text-lg text-slate-500 font-medium">/once</span></div>
              <ul className="space-y-3 mb-8 flex-1 text-slate-700">
                <li className="flex gap-2">✓ 24 hours of unlimited scans</li>
                <li className="flex gap-2">✓ Excel (.xlsx) exports</li>
                <li className="flex gap-2">✓ Standard AI processing</li>
              </ul>
              <button
                onClick={() => handleCheckout("price_1UNGsAQ4pIBaDs86VjTn5jDO", "payment", "24h")}
                disabled={checkoutLoading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {checkoutLoading ? "Redirecting..." : "Get 24-Hour Pass"}
              </button>
            </div>

            {/* Monthly Plan */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md transition flex flex-col relative">
              <h3 className="text-xl font-bold text-slate-800">Pro Subscription</h3>
              <p className="text-slate-500 mt-2 mb-6">Ideal for freelancers and professionals needing ongoing access.</p>
              <div className="text-4xl font-extrabold text-slate-900 mb-6">$9.99<span className="text-lg text-slate-500 font-medium">/mo</span></div>
              <ul className="space-y-3 mb-8 flex-1 text-slate-700">
                <li className="flex gap-2">✓ Unlimited receipt scans</li>
                <li className="flex gap-2">✓ Excel (.xlsx) exports</li>
                <li className="flex gap-2">✓ Priority AI processing</li>
              </ul>
              <button
                onClick={() => handleCheckout("price_1UNGsgQ4pIBaDs86SZaGbbe9", "subscription", "monthly")}
                disabled={checkoutLoading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {checkoutLoading ? "Redirecting..." : "Get Monthly"}
              </button>
            </div>

            {/* Lifetime / Annual Plan */}
            <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-8 shadow-sm hover:shadow-md transition flex flex-col relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-blue-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                Best Value
              </div>
              <h3 className="text-xl font-bold text-slate-800">Lifetime Pass</h3>
              <p className="text-slate-500 mt-2 mb-6">Pay once, convert receipts forever. No recurring subscriptions.</p>
              <div className="text-4xl font-extrabold text-slate-900 mb-6">$49.99<span className="text-lg text-slate-500 font-medium">/once</span></div>
              <ul className="space-y-3 mb-8 flex-1 text-slate-700">
                <li className="flex gap-2 font-medium">✓ Everything in Pro</li>
                <li className="flex gap-2">✓ Pay once, never again</li>
                <li className="flex gap-2">✓ Early access to new features</li>
              </ul>
              <button
                onClick={() => handleCheckout("price_1UNVc1Q4pIBaDs86Vo0F2fhs", "payment", "lifetime")}
                disabled={checkoutLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition disabled:opacity-50"
              >
                {checkoutLoading ? "Redirecting..." : "Get Lifetime"}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}