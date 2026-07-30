import NewUserForm from "./NewUserForm";
import BackButton from "@/components/BackButton";

export default function NewUserPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add User</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create a new team member account</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <NewUserForm />
      </div>
    </div>
  );
}
