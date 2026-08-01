import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  const subscriberId = req.user?._id;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const channel = await User.findById(channelId);

  if (!channel) {
    throw new ApiError(404, "Channel with this id not found");
  }

  if (channelId.toString() === subscriberId?.toString()) {
    throw new ApiError(400, "You can't subscribe to your own channel");
  }

  const isChannelSubscribe = await Subscription.findOne({
    channel: channelId,
    subscriber: subscriberId,
  });

  if (isChannelSubscribe) {
    await isChannelSubscribe.deleteOne();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribed: false },
          "Channel unsubscribed successfully"
        )
      );
  }

  const subscription = await Subscription.create({
    channel: channelId,
    subscriber: subscriberId,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subscription, subscribed: true },
        "Channel subscribed successfully"
      )
    );
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const channel = await User.findById(channelId);

  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  const totalSubscriber = await Subscription.find({
    channel: channelId,
  }).populate("subscriber", "username fullname avatar");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        totalSubscriber,
        "Channel subscribers fetched successfully"
      )
    );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber id");
  }

  const user = await User.findById(subscriberId);

  if (!user) {
    throw new ApiError(400, "Invalid user id");
  }

  const totalSubscribedChannel = await Subscription.find({
    subscriber: subscriberId,
  }).populate("channel", "username fullname avatar");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        totalSubscribedChannel,
        "Subscribed channels fetched successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
