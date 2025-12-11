import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware";
import { getAllProducts } from "../controllers";
import { getProductById } from "../controllers";

const router = Router();

router.get("/", protectRoute, getAllProducts);
router.get("/:id", protectRoute, getProductById);

export default router;
