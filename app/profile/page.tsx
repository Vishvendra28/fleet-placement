import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import BackButton from "@/components/BackButton";
import PushTestButton from "@/app/components/PushTestButton";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PLANNING_TEAM: "Planning Team",
  PLACEMENT_TEAM: "Placement Team",
  DRIVER_MANAGEMENT: "Driver Management",
  MAINTENANCE_TEAM: "Maintenance Team",
  STORE_AND_TYRE: "Store & Tyre",
  E_LOCK_TEAM: "E-Lock Team",
  KAM: "Key Account Manager",
};

const ROLE_COLOR: Record<Role, string> = {
  ADMIN: "bg-violet-100 text-violet-700 border-violet-200",
  PLANNING_TEAM: "bg-blue-100 text-blue-700 border-blue-200",
  PLACEMENT_TEAM: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DRIVER_MANAGEMENT: "bg-orange-100 text-orange-700 border-orange-200",
  MAINTENANCE_TEAM: "bg-pink-100 text-pink-700 border-pink-200",
  STORE_AND_TYRE: "bg-yellow-100 text-yellow-700 border-yellow-200",
  E_LOCK_TEAM: "bg-cyan-100 text-cyan-700 border-cyan-200",
  KAM: "bg-red-100 text-red-700 border-red-200",
};

const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN:
    "Full access to all pages and features. Can manage placements, view and resolve all issues, access the Master data (routes, clients, vendors, KAMs), view analytics, vehicle health, and full activity history.",
  PLANNING_TEAM:
    "Manages the placement pipeline. Can view the dashboard, raise and resolve issues, see D-1 Pending and Same Day Pending queues, and track active placements.",
  PLACEMENT_TEAM:
    "Handles day-to-day placement operations. Can view placements, raise issues, and work through the D-1 and Same Day Pending queues.",
  DRIVER_MANAGEMENT:
    "Focuses on driver-related issues. Can view the dashboard and raise or manage issues that relate to driver assignments and availability.",
  MAINTENANCE_TEAM:
    "Handles vehicle health and maintenance issues. Can view the dashboard, raise maintenance issues, and update vehicle status.",
  STORE_AND_TYRE:
    "Handles tyre, stepney, cargo net, and tirpal-related equipment issues. Can view the dashboard and manage assigned equipment issue alerts.",
  E_LOCK_TEAM:
    "Handles E-Lock equipment issues. Receives alerts when an E-Lock is marked unhealthy or damaged, and can mark those issues as in-progress or resolved.",
  KAM:
    "Key Account Manager. Can view the dashboard to monitor placement status for their assigned clients.",
};

const ROLE_ACCESS: Record<Role, string[]> = {
  ADMIN: [
    "Dashboard",
    "Issues",
    "D-1 Pending",
    "Same Day Pending",
    "Master (routes, clients, vendors, KAMs)",
    "Analytics",
    "Vehicle Health",
    "All Issues (admin view)",
    "Activity History",
    "Profile",
  ],
  PLANNING_TEAM: ["Dashboard", "Issues", "D-1 Pending", "Same Day Pending", "Profile"],
  PLACEMENT_TEAM: ["Dashboard", "Issues", "D-1 Pending", "Same Day Pending", "Profile"],
  DRIVER_MANAGEMENT: ["Dashboard", "Issues", "Profile"],
  MAINTENANCE_TEAM: ["Dashboard", "Issues", "Profile"],
  STORE_AND_TYRE: ["Dashboard", "Issues", "Profile"],
  E_LOCK_TEAM: ["Dashboard", "Issues", "Profile"],
  KAM: ["Dashboard", "Profile"],
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { user } = session;
  const initials = user.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
      </div>

      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-gray-900 truncate">{user.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          <span className={`mt-2 inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLOR[user.role as Role]}`}>
            {ROLE_LABEL[user.role as Role]}
          </span>
        </div>
      </div>

      {/* Push notifications */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Push Notifications</h2>
        <p className="text-sm text-gray-600">
          Click below to register this device and send a test notification. If you see the notification, push alerts are working on this device.
        </p>
        <PushTestButton />
      </div>

      {/* Role description */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Role & Permissions</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{ROLE_DESCRIPTION[user.role as Role]}</p>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pages you can access</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {ROLE_ACCESS[user.role as Role].map((page) => (
              <li key={page} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {page}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
