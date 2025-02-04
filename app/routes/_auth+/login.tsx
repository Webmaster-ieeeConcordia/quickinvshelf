import { json, redirect } from "@remix-run/node";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
 LoaderFunction } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation , Form as RemixForm , Form } from "@remix-run/react";

import { useZorm } from "react-zorm";
import { z } from "zod";


import Input from "~/components/forms/input";
import PasswordInput from "~/components/forms/password-input";
import { Button } from "~/components/shared/button";
import { config } from "~/config/shelf.config";
import { useSearchParams } from "~/hooks/search-params";
import { ContinueWithEmailForm } from "~/modules/auth/components/continue-with-email-form";
import { signInWithEmail } from "~/modules/auth/service.server";
 


import {
  getSelectedOrganisation,
  setSelectedOrganizationIdCookie,
} from "~/modules/organization/context.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { setCookie } from "~/utils/cookies.server";
import { makeShelfError, notAllowedMethod } from "~/utils/error";
import { isFormProcessing } from "~/utils/form";
import {
  data,
  error,
  getActionMethod,
  parseData,
  safeRedirect,
} from "~/utils/http.server";
import { validEmail } from "~/utils/misc";


export const loader: LoaderFunction = async ({ request, context }) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");

  // Prevent redirect loops
  if (redirectTo === "/auth/discord" && url.pathname === "/auth/discord") {
    return null; // Do nothing; avoid infinite loop
  }

  // If the user is authenticated, redirect to the assets page
  if (context.isAuthenticated) {
    return redirect("/assets");
  }

  // Provide default data for rendering the page
  const title = "Log in";
  const subHeading = "Welcome back! Enter your details below to log in.";

  return json({
    title,
    subHeading,
    disableSignup: config.disableSignup,
    disableSSO: config.disableSSO,
  });
};



const LoginFormSchema = z.object({
  email: z
    .string()
    .transform((email) => email.toLowerCase())
    .refine(validEmail, () => ({
      message: "Please enter a valid email",
    })),
  password: z.string().min(8, "Password is too short. Minimum 8 characters."),
  redirectTo: z.string().optional(),
});

export async function action({ context, request }: ActionFunctionArgs) {
  try {
    const method = getActionMethod(request);

    switch (method) {
      case "POST": {
        const { email, password, redirectTo } = parseData(
          await request.formData(),
          LoginFormSchema
        );

        const authSession = await signInWithEmail(email, password);

        if (!authSession) {
          return redirect(`/otp?email=${encodeURIComponent(email)}&mode=login`);
        }
        const { userId } = authSession;

        /**
         * The only reason we need to do this is because of the initial login
         * Theoretically, the user should always have a selected organization cookie as soon as they login for the first time
         * However we do this check to make sure they are still part of that organization
         */
        const { organizationId } = await getSelectedOrganisation({
          userId,
          request,
        });

        // Set the auth session and redirect to the assets page
        context.setSession(authSession);

        return redirect(safeRedirect(redirectTo || "/assets"), {
          headers: [
            setCookie(await setSelectedOrganizationIdCookie(organizationId)),
          ],
        });
      }
    }

    throw notAllowedMethod(method);
  } catch (cause) {
    const reason = makeShelfError(cause);
    return json(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.title) : "" },
];


export default function IndexLoginForm() {
  const { title, subHeading } = useLoaderData<{
    title: string;
    subHeading: string;
  }>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  return (
    <div className="w-full max-w-md">
      <h1 className="text-center text-2xl font-bold">{title}</h1>
      <p className="text-center text-gray-600">{subHeading}</p>
      <div className="mt-6">
        <Form action="/auth/discord" method="post">
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="size-5" viewBox="0 0 71 55" fill="none">
              <path
                d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7 0.4C20.3 1.3 15.4 2.8 10.9 4.9C1.6 18.7 0 32.1 0.3 45.4C6.5 50 12.3 52.7 18.1 54.5C58.6 52.7 64.5 50 70.6 45.6C72.2 30.1 68.2 16.8 60.2 5.0Z"
                fill="#5865F2"
              />
            </svg>
            {isLoading ? "Connecting..." : "Continue with Discord"}
          </button>
        </Form>
      </div>
    </div>
  );
}