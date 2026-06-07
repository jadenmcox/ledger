import { DesktopNav, MobileHeader, MobileNav } from "@/components/nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen">
      <DesktopNav />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
