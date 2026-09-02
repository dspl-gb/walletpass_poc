import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container py-24 text-center">
      <h1 className="font-display text-3xl">Pass not found</h1>
      <p className="mt-2 text-muted-foreground">That membership card does not exist, or it belongs to another visitor.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
