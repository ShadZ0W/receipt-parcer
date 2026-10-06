"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const FREE_LIMIT = 3;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Paywall states
  const [usageCount, setUsageCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Initialize usage and check for Stripe success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      localStorage.setItem("isPro", "true");
      // Clean up the URL
      window.history.replaceState(null, "", "/");
    }

    const storedPro = localStorage.getItem("isPro") === "true";
    const storedCount = parseInt(localStorage.getItem("usageCount") || "0", 10);
    
    setIsPro(storedPro);
    setUsageCount(storedCount);
  }, []);

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
      setError("File is too large. Please keep uploads under 5MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to process receipt");

      setData(result);

      // Increment usage if they are on the free tier
      if (!isPro) {
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        localStorage.setItem("usageCount", newCount.toString());
      }

    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      e.target.value = ""; 
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url; // Redirect to Stripe
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
      ["Total", `${data.currency || "$"}${data.total || "0.00"}`],
      [], 
      ["Item Description", "Quantity", "Unit Price", "Total Amount"]
    ];

    data.items.forEach((it: any) => {
      exportData.push([it.description, it.qty || 1, it.unit_price || "", it.amount || ""]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    worksheet["!cols"] = [{ wch: 45 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];

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
              onClick={handleCheckout}
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
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              {loading ? (
                <p className="text-blue-600 font-medium animate-pulse">Extracting line items with AI...</p>
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

        {/* Extracted Data Table (Same as before) */}
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
    </main>
  );
}