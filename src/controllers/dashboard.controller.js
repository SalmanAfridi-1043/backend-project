import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const getChannelStats = asyncHandler(async (req, res) => {
  // current user
  const channelId = req.user?._id;

  if (!channelId) {
    throw new ApiError(400, "Channel does not exist");
  }

  // total subscriber
  const totalSubscriber = await Subscription.countDocuments({
    channel: channelId,
  });

  // total uploaded videos
  const totalVideos = await Video.countDocuments({
    owner: channelId,
  });

  // total viewers
  const viewResult = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(channelId),
      },
    },

    {
      $group: {
        _id: null,
        totalViews: {
          $sum: "$views",
        },
      },
    },
  ]);

  const totalViews = viewResult[0]?.totalViews || 0;

  // getting all video's id from channel
  const videos = await Video.find({ owner: channelId }, { _id: 1 });
  const totalVideosId = videos.map((video) => video._id);

  //Total likes
  const totalLikes = await Like.countDocuments({
    video: {
      $in: totalVideosId,
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalSubscriber,
        totalVideos,
        totalViews,
        totalLikes,
      },
      "Channel fetched successfully"
    )
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // getting channel/user id
  const channelId = req.user?._id;
  if (!channelId) {
    throw new ApiError(401, "Unauthorized request");
  }

  // getting all videos in descentding order (newest first )
  const totalVideos = await Video.find({
    owner: channelId,
  })
    .select("title thumbnail duration views isPublished createdAt")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponse(200, totalVideos, "Channel videos fetched successfully")
    );
});

export { getChannelStats, getChannelVideos };
