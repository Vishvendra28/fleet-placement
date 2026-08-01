import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewPlacementForm from "@/components/NewPlacementForm";
import BackButton from "@/components/BackButton";

export default async function NewPlacementPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "PLANNING_TEAM" && session.user.role !== "PLACEMENT_TEAM") redirect("/dashboard");

  const [clients, vehicles] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { vehicleNumber: "asc" } }),
  ]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Trip</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create one or more trip placements for a specific date</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <NewPlacementForm clients={clients} vehicles={vehicles} />
      </div>
    </div>
  );
}
