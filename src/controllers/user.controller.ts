import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function addAddress(req: Request, res: Response) {
  try {
    const { label, fullName, streetAddress, city, state, zipCode, phoneNumber, isDefault } =
      req.body;

    const userId = req.user!.id;

    if (!fullName || !streetAddress || !city || !state || !zipCode) {
      return res.status(400).json({ error: "Missing required address fields" });
    }

    await prisma.$transaction(async (tx) => {
      // if this is set as default, unset all other defaults
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      await tx.address.create({
        data: {
          userId,
          label,
          fullName,
          streetAddress,
          city,
          state,
          zipCode,
          phoneNumber,
          isDefault: isDefault || false,
        },
      });
    });

    const addresses = await prisma.address.findMany({ where: { userId } });

    res.status(201).json({ message: "Address added successfully", addresses });
  } catch (error) {
    console.error("Error in addAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAddresses(req: Request, res: Response) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.id },
    });

    res.status(200).json({ addresses });
  } catch (error) {
    console.error("Error in getAddresses controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateAddress(req: Request, res: Response) {
  try {
    const { label, fullName, streetAddress, city, state, zipCode, phoneNumber, isDefault } =
      req.body;

    const { addressId } = req.params;
    const userId = req.user!.id;

    const address = await prisma.address.findUnique({
      where: { id: addressId, userId },
    });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    await prisma.$transaction(async (tx) => {
      // if this is set as default, unset all other defaults
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      await tx.address.update({
        where: { id: addressId },
        data: {
          label,
          fullName,
          streetAddress,
          city,
          state,
          zipCode,
          phoneNumber,
          isDefault,
        },
      });
    });

    const addresses = await prisma.address.findMany({ where: { userId } });

    res.status(200).json({ message: "Address updated successfully", addresses });
  } catch (error) {
    console.error("Error in updateAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteAddress(req: Request, res: Response) {
  try {
    const { addressId } = req.params;
    const userId = req.user!.id;

    await prisma.address.delete({
      where: { id: addressId, userId },
    });

    const addresses = await prisma.address.findMany({ where: { userId } });

    res.status(200).json({ message: "Address deleted successfully", addresses });
  } catch (error) {
    console.error("Error in deleteAddress controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addToWishlist(req: Request, res: Response) {
  try {
    const { productId } = req.body;
    const userId = req.user!.id;

    // check if product is already in the wishlist
    const userWithProduct = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wishlist: {
          where: { id: productId },
        },
      },
    });

    if (userWithProduct?.wishlist.length) {
      return res.status(400).json({ error: "Product already in wishlist" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        wishlist: {
          connect: { id: productId },
        },
      },
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { wishlist: true },
    });

    res.status(200).json({ message: "Product added to wishlist", wishlist: updatedUser?.wishlist });
  } catch (error) {
    console.error("Error in addToWishlist controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function removeFromWishlist(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const userId = req.user!.id;

    // check if product is in the wishlist
    const userWithProduct = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wishlist: {
          where: { id: productId },
        },
      },
    });

    if (!userWithProduct?.wishlist.length) {
      return res.status(400).json({ error: "Product not found in wishlist" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        wishlist: {
          disconnect: { id: productId },
        },
      },
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { wishlist: true },
    });

    res.status(200).json({ message: "Product removed from wishlist", wishlist: updatedUser?.wishlist });
  } catch (error) {
    console.error("Error in removeFromWishlist controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getWishlist(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { wishlist: true },
    });

    res.status(200).json({ wishlist: user?.wishlist || [] });
  } catch (error) {
    console.error("Error in getWishlist controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    console.log("📡 getMe: Request received");
    
    // User is already attached by protectRoute middleware (auto-created if needed)
    const user = req.user!;
    
    console.log("✅ getMe: Returning user:", user.email);

    res.status(200).json({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("❌ getMe: Error in controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
