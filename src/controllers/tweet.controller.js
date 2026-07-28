import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const userId = req.user?._id;

  if (!content?.trim()) {
    throw new ApiError(404, "Tweet content is required");
  }

  const user = await Tweet.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const tweet = await Tweet.create({
    content: content.trim(),
    owner: userId,
  });

  if (content.trim().length > 280) {
    throw new ApiError(400, "Tweet cannot exceed 280 characters");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const user = await Tweet.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const allTweets = await Tweet.find({
    owner: userId,
  }).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  const { content } = req.body;

  const userId = req.user?._id;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet it");
  }

  if (!content?.trim()) {
    throw new ApiError(404, "Tweet content is required");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet does not exist");
  }

  if (tweet.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized access");
  }

  if (tweet.content === content.trim()) {
    throw new ApiError(400, "No changes detected");
  }

  tweet.content = content.trim();

  await tweet.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet it");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet does not exist");
  }

  if (tweet.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized request");
  }

  await tweet.deleteOne();

  // production approach
  //   const deletedTweet = await Tweet.findOneAndDelete({
  //   _id: tweetId,
  //   owner: userId,
  // });

  // if (!deletedTweet) {
  //   throw new ApiError(
  //     404,
  //     "Tweet not found or unauthorized"
  //   );
  // }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
