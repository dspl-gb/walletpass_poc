export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Wallet credentials stay on the server. This demo has no login or registration.</p>
        <p>Apple Wallet · Google Wallet</p>
      </div>
    </footer>
  );
}
