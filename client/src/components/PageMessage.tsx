import type { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";

export default function PageMessage({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="site-width message-layout">
        <div className="app-panel message-panel">{children}</div>
      </main>
    </>
  );
}
