import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function getCart(req: Request, res: Response) {
  try {
    let cart = await prisma.cart.findUnique({
      where: { clerkId: req.user!.clerkId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart) {
      const userId = req.user!.id;
      const clerkId = req.user!.clerkId;

      cart = await prisma.cart.create({
        data: {
          userId,
          clerkId,
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });
    }

    res.status(200).json({ cart });
  } catch (error) {
    console.error("Error in getCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addToCart(req: Request, res: Response) {
  try {
    const { productId, quantity = 1 } = req.body;

    // validate product exists and has stock
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    let cart = await prisma.cart.findUnique({
      where: { clerkId: req.user!.clerkId },
      include: { items: true },
    });

    if (!cart) {
      const userId = req.user!.id;
      const clerkId = req.user!.clerkId;

      cart = await prisma.cart.create({
        data: {
          userId,
          clerkId,
        },
        include: { items: true },
      });
    }

    // check if item already in the cart
    const existingItem = cart.items.find((item) => item.productId === productId);
    if (existingItem) {
      // increment quantity by 1
      const newQuantity = existingItem.quantity + 1;
      if (product.stock < newQuantity) {
        return res.status(400).json({ error: "Insufficient stock" });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      // add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    res.status(200).json({ message: "Item added to cart", cart: updatedCart });
  } catch (error) {
    console.error("Error in addToCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateCartItem(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    const cart = await prisma.cart.findUnique({
      where: { clerkId: req.user!.clerkId },
      include: { items: true },
    });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const existingItem = cart.items.find((item) => item.productId === productId);
    if (!existingItem) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    // check if product exists & validate stock
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity },
    });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    res.status(200).json({ message: "Cart updated successfully", cart: updatedCart });
  } catch (error) {
    console.error("Error in updateCartItem controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function removeFromCart(req: Request, res: Response) {
  try {
    const { productId } = req.params;

    const cart = await prisma.cart.findUnique({
      where: { clerkId: req.user!.clerkId },
      include: { items: true },
    });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const existingItem = cart.items.find((item) => item.productId === productId);
    if (existingItem) {
      await prisma.cartItem.delete({
        where: { id: existingItem.id },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    res.status(200).json({ message: "Item removed from cart", cart: updatedCart });
  } catch (error) {
    console.error("Error in removeFromCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const clearCart = async (req: Request, res: Response) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { clerkId: req.user!.clerkId },
    });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: true },
    });

    res.status(200).json({ message: "Cart cleared", cart: updatedCart });
  } catch (error) {
    console.error("Error in clearCart controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
