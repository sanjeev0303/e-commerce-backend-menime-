import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware";
import { createReview, deleteReview } from "../controllers";

const router = Router();

router.post("/", protectRoute, createReview);
// we did not implement this function in the mobile app - in the frontend
// but jic if you'd like to see the backend code here it is - i provided
router.delete("/:reviewId", protectRoute, deleteReview);

export default router;
