import { Link } from "@remix-run/react";
import { Outlet } from "react-router";
import { ErrorContent } from "~/components/errors";
import { ShelfSymbolLogo } from "~/components/marketing/logos";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col justify-center">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <ShelfSymbolLogo className="h-12 w-auto" />
        </Link>
        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight">
          Authentication
        </h1>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export const ErrorBoundary = () => <ErrorContent />;
