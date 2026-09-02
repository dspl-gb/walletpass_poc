import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function GoogleMockPage({
  searchParams,
}: {
  searchParams: Promise<{ passId?: string }>;
}) {
  const { passId } = await searchParams;

  return (
    <div className="container max-w-2xl py-16">
      <Card className="border-amber-700/30">
        <CardHeader>
          <CardTitle className="font-display text-2xl">This is not Google Wallet</CardTitle>
          <CardDescription>
            MOCK_WALLET_MODE is enabled. The app did not create a Google Wallet object and did not add
            anything to a wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Mock response only</AlertTitle>
            <AlertDescription>
              Configure <code>GOOGLE_ISSUER_ID</code> and a service account, then set{" "}
              <code>MOCK_WALLET_MODE=false</code> to generate a real save URL.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            {passId ? (
              <Button asChild>
                <Link href={`/passes/${passId}`}>Back to pass</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/admin/demo">Demo Mode</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
