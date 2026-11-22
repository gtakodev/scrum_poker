import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import PageMessage from "@/components/PageMessage";

export default function NotFoundPage() {
  return (
    <PageMessage>
      <h1>404</h1>
      <p>Page not found</p>
      <Link to="/" className="back-link">
        <ArrowLeft aria-hidden="true" /> Back to Home
      </Link>
    </PageMessage>
  );
}
