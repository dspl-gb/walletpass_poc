import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { WalletConfigStatus } from "@/lib/wallet/common/types";

export function StatusBanner({
  status,
  memoryStore,
}: {
  status: WalletConfigStatus;
  memoryStore?: boolean;
}) {
  if (status.mockMode) {
    return (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Demo Mode
          <Badge variant="mock">MOCK_WALLET_MODE</Badge>
        </AlertTitle>
        <AlertDescription>
          Wallet buttons work, but they will not add a real pass. Apple returns a clearly marked mock
          response, and Google opens an explanation page. Set <code>MOCK_WALLET_MODE=false</code> to
          download a .pkpass built from pass data.
          {memoryStore ? " Passes are stored in memory until the server restarts because Supabase is not configured." : null}
        </AlertDescription>
      </Alert>
    );
  }

  const missing: string[] = [];
  if (!status.supabaseConfigured) missing.push("Supabase");
  if (!status.appleConfigured) missing.push("Apple Wallet certificates");
  if (!status.googleConfigured) missing.push("Google Wallet service account");

  if (missing.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Ready to issue real wallet passes</AlertTitle>
        <AlertDescription>
          Apple and Google credentials are configured on the server. They are never sent to the browser.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <CircleDashed className="h-4 w-4" />
      <AlertTitle>Waiting on credentials</AlertTitle>
      <AlertDescription>
        Still needed: {missing.join(", ")}. Wallet buttons will return a clear error until signing
        credentials are added on the server.
      </AlertDescription>
    </Alert>
  );
}
