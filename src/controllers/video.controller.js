import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const pipeline = [];

  /*
    1. Only show published videos

    Public video feed should not show
    private/unpublished videos.
  */
  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  /*
    2. Search videos

    Searches:
    - title
    - description

    Example:
    ?query=node
  */
  if (query?.trim()) {
    pipeline.push({
      $match: {
        $or: [
          {
            title: {
              $regex: query,
              $options: "i",
            },
          },
          {
            description: {
              $regex: query,
              $options: "i",
            },
          },
        ],
      },
    });
  }

  /*
    3. Filter videos by user

    Example:
    ?userId=64abc123
  */
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }

    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  /*
    4. Get owner details

    Similar to your:
    getWatchHistory()
    controller style
  */
  pipeline.push({
    $lookup: {
      from: "users",

      localField: "owner",

      foreignField: "_id",

      as: "owner",

      pipeline: [
        {
          $project: {
            fullname: 1,

            username: 1,

            avatar: 1,
          },
        },
      ],
    },
  });

  /*
    5. Convert owner array into object

    Before:

    owner:[
      {
        username:"salman"
      }
    ]


    After:

    owner:{
       username:"salman"
    }
  */

  pipeline.push({
    $addFields: {
      owner: {
        $first: "$owner",
      },
    },
  });

  /*
    6. Sorting protection

    Only allow valid fields.
  */

  const allowedSortFields = ["createdAt", "views", "duration", "title"];

  const finalSortField = allowedSortFields.includes(sortBy)
    ? sortBy
    : "createdAt";

  const finalSortType = sortType === "asc" ? 1 : -1;

  pipeline.push({
    $sort: {
      [finalSortField]: finalSortType,
    },
  });

  /*
    7. Final response fields

    Avoid sending unnecessary data.
  */

  pipeline.push({
    $project: {
      videoFile: 1,

      thumbnail: 1,

      title: 1,

      description: 1,

      duration: 1,

      views: 1,

      isPublished: 1,

      owner: 1,

      createdAt: 1,

      updatedAt: 1,
    },
  });

  /*
    8. Create aggregate query
  */

  const videosAggregate = Video.aggregate(pipeline);

  /*
    9. Pagination

    mongoose-aggregate-paginate-v2
  */

  const videos = await Video.aggregatePaginate(videosAggregate, {
    page: Number(page),
    limit: Number(limit),
  });

  /*
    10. Response
  */

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  const { videoFile, thumbnail } = req.files;

  const userId = req.user?._id;

  if (!title.trim()) {
    throw new ApiError(400, "Video title is required");
  }

  if (!description) {
    throw new ApiError(400, "Video description is required");
  }

  const videoPath = req.files?.videoFile?.[0]?.path;
  const thumbnailPath = req.files?.thumbnail?.[0]?.path;

  if (!videoPath) {
    throw new ApiError(400, "video file is required");
  }

  if (!thumbnailPath) {
    throw new ApiError(400, "thumbnail is required");
  }

  const uploadedVideo = await uploadOnCloudinary(videoPath);

  if (!uploadedVideo) {
    throw new ApiError(500, "Failed to upload video to cloudinary");
  }

  const uploadedThumbnail = await uploadOnCloudinary(thumbnailPath);

  if (!uploadedThumbnail) {
    await deleteFromCloudinary(uploadedVideo.public_id);

    throw new ApiError(500, "Failed to upload thumbnail to cloudinary");
  }

  const videoDocument = await Video.create({
    title: title.trim(),
    description: description.trim(),
    videoFile: uploadedVideo.url,
    thumbnail: uploadedThumbnail.url,
    duration: uploadedVideo.duration,
    owner: userId,
  });

  if (!videoDocument) {
    throw new ApiError(500, "Failed to publish video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videoDocument, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId).populate(
    "owner",
    "username fullname avatar"
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  video.views += 1;
  await video.save({ validateBeforeSave: false });

  // a better way to increment views
  // await Video.findByIdAndUpdate(videoId, {
  //   $inc: {
  //     views: 1,
  //   },
  // });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const { title, description } = req.body;

  const userId = req.user?._id;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!title.trim()) {
    throw new ApiError(400, "Video title is required");
  }
  if (!description.trim()) {
    throw new ApiError(400, "Video description is required");
  }

  const video = await Video.findById(videoid);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized access");
  }

  const thumbnailPath = req.files?.path;

  if (thumbnailPath) {
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailPath);

    if (!uploadedThumbnail) {
      throw new ApiError(500, "Failed to upload video thumbnail");
    }

    await deleteFromCloudinary(oldPublicId);

    video.thumbnail = uploadedThumbnail.url;
  }

  // video.title = title.trim();
  // video.description = description.trim();

  if (title?.trim()) {
    video.title = title.trim();
  }

  if (description?.trim()) {
    video.description = description.trim();
  }

  video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized access");
  }

  await deleteFromCloudinary(video.videoFilePublicId, "video");

  await deleteFromCloudinary(video.thumbnailPublicId, "image");

  await video.deleteOne(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized access");
  }

  video.isPublished = !video.isPublished;

  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video,
        `Video is ${video.isPublished ? "published" : "unpublished"} successfully`
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
