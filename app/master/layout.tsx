import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar user={session.user} />
      <main className="md:ml-60 min-h-screen p-4 md:p-8 pt-14 md:pt-8">
        {children}
      </main>
    </div>
  );
}
