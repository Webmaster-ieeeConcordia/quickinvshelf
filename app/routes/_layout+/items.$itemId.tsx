import type {
  ActionArgs,
  LinksFunction,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { useCatch, useLoaderData } from "@remix-run/react";

import mapCss from "maplibre-gl/dist/maplibre-gl.css";
import { DeleteItem } from "~/components/items/delete-item";
import { ItemImage } from "~/components/items/item-image";
import { LocationDetails } from "~/components/items/location";
import { Notes } from "~/components/items/notes";
import ContextualSidebar from "~/components/layout/contextual-sidebar";

import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";

import { Badge } from "~/components/shared";
import { Button } from "~/components/shared/button";
import TextualDivider from "~/components/shared/textual-divider";
import ProfilePicture from "~/components/user/profile-picture";
import { usePosition, useUserData } from "~/hooks";
import { requireAuthSession, commitAuthSession } from "~/modules/auth";
import { deleteItem, getItem } from "~/modules/item";
import { getScanByQrId } from "~/modules/scan";
import { parseScanData } from "~/modules/scan/utils.server";
import { assertIsDelete, getRequiredParam } from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { parseMarkdownToReact } from "~/utils/md.server";
import { deleteAssets } from "~/utils/storage.server";

export async function loader({ request, params }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);
  const id = getRequiredParam(params, "itemId");

  const item = await getItem({ userId, id });
  if (!item) {
    throw new Response("Not Found", { status: 404 });
  }
  /** We get the first QR code(for now we can only have 1)
   * And using the ID of tha qr code, we find the latest scan
   */
  const lastScan = item.qrCodes[0]?.id
    ? parseScanData({
        scan: (await getScanByQrId({ qrId: item.qrCodes[0].id })) || null,
        userId,
      })
    : null;

  const notes = item.notes.map((note) => ({
    ...note,
    content: parseMarkdownToReact(note.content),
  }));

  const header: HeaderData = {
    title: item.title,
    subHeading: item.id,
  };

  return json({
    item: {
      ...item,
      notes,
    },
    lastScan,
    header,
  });
}
export async function action({ request, params }: ActionArgs) {
  assertIsDelete(request);
  const id = getRequiredParam(params, "itemId");
  const authSession = await requireAuthSession(request);
  const formData = await request.formData();
  const mainImageUrl = formData.get("mainImage") as string;

  await deleteItem({ userId: authSession.userId, id });
  await deleteAssets({
    url: mainImageUrl,
    bucketName: "items",
  });

  sendNotification({
    title: "Item deleted",
    message: "Your item has been deleted successfully",
    icon: { name: "trash", variant: "error" },
  });

  return redirect(`/items`, {
    headers: {
      "Set-Cookie": await commitAuthSession(request, { authSession }),
    },
  });
}

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [
  { title: appendToMetaTitle(data.header.title) },
];

export const handle = {
  breadcrumb: () => "single",
};

export const links: LinksFunction = () => [{ rel: "stylesheet", href: mapCss }];

export default function ItemDetailsPage() {
  const { item } = useLoaderData<typeof loader>();
  const user = useUserData();
  usePosition();
  return (
    <>
      <ItemImage
        item={{
          itemId: item.id,
          mainImage: item.mainImage,
          mainImageExpiration: item.mainImageExpiration,
          alt: item.title,
        }}
        className="mx-auto mb-8 h-[240px] w-full rounded-lg object-cover sm:w-[343px] md:hidden"
      />
      <Header>
        <Button
          to="qr"
          variant="secondary"
          icon="barcode"
          onlyIconOnMobile={true}
        >
          Download QR Tag
        </Button>
        <Button to="edit" icon="pen" role="link" onlyIconOnMobile={true}>
          Edit
        </Button>
        <DeleteItem item={item} />
      </Header>
      <div className="mt-8 block lg:flex">
        <div className="shrink-0 overflow-hidden lg:w-[343px] xl:w-[400px]">
          <ItemImage
            item={{
              itemId: item.id,
              mainImage: item.mainImage,
              mainImageExpiration: item.mainImageExpiration,
              alt: item.title,
            }}
            className="mx-auto mb-8 hidden h-auto w-[343px] rounded-lg object-cover md:block lg:w-full"
          />
          <p className="mb-8 text-gray-600">{item.description}</p>
          <TextualDivider text="Details" className="mb-8 lg:hidden" />
          <ul className="item-information mb-8">
            {item?.category ? (
              <li className="mb-4 flex justify-between">
                <span className="font-medium text-gray-600">Category</span>
                <div className="max-w-[250px]">
                  <Badge color={item.category?.color}>
                    {item.category?.name}
                  </Badge>
                </div>
              </li>
            ) : null}
            <li className="mb-4 flex justify-between">
              <span className="font-medium text-gray-600">Owner</span>
              <div className="max-w-[250px]">
                <span className="mb-1 ml-1 inline-flex items-center rounded-2xl bg-gray-100 px-2 py-0.5">
                  <ProfilePicture width="w-4" height="h-4" />
                  <span className="ml-1.5 text-[12px] font-medium text-gray-700">
                    {user?.firstName} {user?.lastName}
                  </span>
                </span>
              </div>
            </li>
          </ul>

          <LocationDetails />
        </div>

        <div className="w-full lg:ml-8">
          <TextualDivider text="Notes" className="mb-8 lg:hidden" />
          <Notes />
        </div>
      </div>
      <ContextualSidebar />
    </>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  return <div>An unexpected error occurred: {error.message}</div>;
}

export function CatchBoundary() {
  const caught = useCatch();

  if (caught.status === 404) {
    return <div>Item not found</div>;
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}
