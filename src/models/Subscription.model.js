import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId, // subscribing user
      ref: "User",
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId, // subscriber user
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);
