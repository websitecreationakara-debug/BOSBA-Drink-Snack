import { useEffect, useState } from "react";

const STORAGE_KEY = "bosba-drink-snack:age-verified";

export function AgeGate() {
  // Starts "unknown" so the very first paint doesn't flash the gate before
  // we've had a chance to check sessionStorage (or flash the site content
  // before we've had a chance to show the gate).
  const [verified, setVerified] = useState<boolean | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    try {
      setVerified(sessionStorage.getItem(STORAGE_KEY) === "yes");
    } catch {
      // sessionStorage unavailable — fail open rather than lock the site out.
      setVerified(true);
    }
  }, []);

  if (verified === null || verified) return null;

  const confirm = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "yes");
    } catch {
      // ignore — the gate will just reappear if storage isn't available
    }
    setVerified(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1b140f] px-6">
      <div className="w-full max-w-sm text-center">
        <img src="/logo.png" alt="BOSBA Drink Snack" className="size-16 mx-auto rounded-full" />

        {declined ? (
          <>
            <h1 className="font-display font-semibold text-2xl text-white mt-6">
              Sorry, come back another time
            </h1>
            <p className="text-white/70 mt-3 text-sm">
              You must be 18 or older to enter BOSBA Drink Snack.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#d9503c] mt-6">
              Age Verification
            </p>
            <h1 className="font-display font-semibold text-3xl text-white mt-2">
              Are you 18 or older?
            </h1>
            <p className="text-white/70 mt-3 text-sm">
              BOSBA Drink Snack sells alcohol. Please confirm your age to continue.
            </p>
            <div className="flex gap-3 mt-7">
              <button
                type="button"
                onClick={() => setDeclined(true)}
                className="flex-1 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                No, I'm under 18
              </button>
              <button
                type="button"
                onClick={confirm}
                className="flex-1 rounded-full bg-[#d9503c] px-6 py-3 text-sm font-semibold text-[#1b140f] hover:opacity-90 transition-opacity"
              >
                Yes, I'm 18+
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
