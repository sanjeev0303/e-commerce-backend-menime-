import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { ENV } from "../config";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: ENV.RAZORPAY_KEY_ID,
  key_secret: ENV.RAZORPAY_KEY_SECRET,
});

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    images?: string[];
  };
  quantity: number;
}

interface ShippingAddress {
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
}

/**
 * Create a Razorpay order
 * This must be called before initiating payment on the client
 */
export async function createRazorpayOrder(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { cartItems, shippingAddress } = req.body as {
      cartItems: CartItem[];
      shippingAddress: ShippingAddress;
    };

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "No cart items provided" });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: "Shipping address is required" });
    }

    // Calculate totals
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const shipping = 10.0; // $10 shipping fee
    const tax = subtotal * 0.08; // 8% tax
    const totalAmount = subtotal + shipping + tax;

    // Convert to paise (Razorpay expects amount in smallest currency unit)
    // For INR: 1 INR = 100 paise
    // For USD: we'll treat as INR for now, multiply by 100
    const amountInPaise = Math.round(totalAmount * 100);

    // Create Razorpay order
    const options = {
      amount: amountInPaise,
      currency: "INR", // Change to your preferred currency
      receipt: `receipt_${Date.now()}_${user.id}`,
      notes: {
        userId: user.id,
        clerkId: user.clerkId,
        itemCount: cartItems.length.toString(),
      },
    };

    const order = await razorpay.orders.create(options);

    // Store order details temporarily for verification
    // In production, you might want to store this in database
    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: ENV.RAZORPAY_KEY_ID,
      user: {
        name: user.name || "",
        email: user.email || "",
        phone: shippingAddress.phoneNumber || "",
      },
      // Store for later verification
      cartItems,
      shippingAddress,
      totalAmount,
    });
  } catch (error: any) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      error: error.message || "Failed to create payment order",
    });
  }
}

/**
 * Verify Razorpay payment and create order in database
 */
export async function verifyPayment(req: Request, res: Response) {
  try {
    const user = req.user!;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      cartItems,
      shippingAddress,
      totalAmount,
    } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      cartItems: CartItem[];
      shippingAddress: ShippingAddress;
      totalAmount: number;
    };

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Payment verified - create order in database
    const order = await prisma.$transaction(async (tx) => {
      // 1. Validate stock for all items
      for (const item of cartItems) {
        const product = await tx.product.findUnique({
          where: { id: item.product.id },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.product.name}`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      // 2. Create Order
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          clerkId: user.clerkId,
          shippingAddress: shippingAddress as unknown as Record<string, string>,
          paymentResult: {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            status: "completed",
          },
          totalPrice: totalAmount,
          items: {
            create: cartItems.map((item) => ({
              name: item.product.name,
              price: item.product.price,
              quantity: item.quantity,
              image: item.product.images?.[0] || "",
              productId: item.product.id,
            })),
          },
        },
        include: { items: true },
      });

      // 3. Update Stock
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.product.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return newOrder;
    });

    res.status(200).json({
      success: true,
      message: "Payment verified and order created successfully",
      order,
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      error: error.message || "Failed to verify payment",
    });
  }
}
