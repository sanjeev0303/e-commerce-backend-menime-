import { EventSchemas, Inngest } from "inngest";
import { prisma } from "./prisma";

type ClerkUserCreated = {
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    first_name: string | null;
    last_name: string | null;
    image_url: string;
  };
};

type ClerkUserDeleted = {
  data: {
    id: string;
  };
};

type Events = {
  "clerk/user.created": ClerkUserCreated;
  "clerk/user.deleted": ClerkUserDeleted;
};

export const inngest = new Inngest({
  id: "ecommerce-app",
  schemas: new EventSchemas().fromRecord<Events>(),
});

const syncUser = inngest.createFunction(
  { id: "sync-user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { id, email_addresses, first_name, last_name, image_url } = event.data;

    const email = email_addresses[0]?.email_address;
    const name = `${first_name || ""} ${last_name || ""}`.trim() || "User";

    if (!email) return;

    await prisma.user.create({
      data: {
        clerkId: id,
        email,
        name,
        imageUrl: image_url,
      },
    });
  }
);

const deleteUserFromDB = inngest.createFunction(
  { id: "delete-user-from-db" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { id } = event.data;
    // Use deleteMany to avoid error if user doesn't exist in our DB
    await prisma.user.deleteMany({ where: { clerkId: id } });
  }
);

export const functions = [syncUser, deleteUserFromDB];
