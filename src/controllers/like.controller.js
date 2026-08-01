import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  // if (!mongoose.Types.ObjectId.isValid(videoId)) {
  // }

  // chech if video is valid based on database
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  // check if the video is liked or not
  const checkIsLikedByUser = await Like.findOne({
    video: videoId,
    likedBy: userId,
  });

  // if video has like, then delete/unlike it
  if (checkIsLikedByUser) {
    await checkIsLikedByUser.deleteOne();

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video like removed successfully"));
  }

  const like = await Like.create({
    video: videoId,
    likedBy: userId,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, like, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const checkIsLikedByUser = await Like.findOne({
    comment: commentId,
    likedBy: userId,
  });

  if (checkIsLikedByUser) {
    await checkIsLikedByUser.deleteOne();
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Comment like removed successfully"));
  }

  const like = await Like.create({
    comment: commentId,
    likedBy: userId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, like, "Comment liked successfully"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }

  const checkIsLikedByUser = await Like.findOne({
    tweet: tweetId,
    likedBy: userId,
  });

  if (checkIsLikedByUser) {
    await checkIsLikedByUser.deleteOne();
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet like removed successfully"));
  }

  const like = await Like.create({
    tweet: tweetId,
    likedBy: userId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, like, "Tweet liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const likedVideos = await Like.find({
    likedBy: userId,
    video: {
      $exists: true,
    },
  }).populate("video");

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
