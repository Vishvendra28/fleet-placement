import { prisma } from "@/lib/prisma";
import NewPlacementForm from "./NewPlacementForm";

export default async function NewPlacementPage() {
  const [clients, vehicles] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { vehicleNumber: "asc" } }),
  ]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add New Trip</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create one or more trip placements for a specific date</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <NewPlacementForm clients={clients} vehicles={vehicles} />
      </div>
    </div>
  );
}
