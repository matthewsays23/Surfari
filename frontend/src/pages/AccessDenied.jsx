import React from "react";

export default function AccessDenied() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
      <p className="mt-2 text-gray-600">
        You must be an admin in the Surfari group to access this panel.
      </p>
    </div>
  );
}
