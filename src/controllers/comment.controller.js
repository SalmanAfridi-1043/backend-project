import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  // getting video id
  const { videoId } = req.params;

  //getting pagination values from parameters
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  // selecting which videos should be skiped
  const skip = (Number(page) - 1) * Number(limit);

  //getting all comments on this video
  //arrage in newest to oldest
  // skip previous pages comments
  const comments = await Comment.find({
    video: videoId,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "All comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  // getting video id to be commented
  const videoId = req.params;

  // getting comment content
  const { content } = req.body;

  // getting current user to comment
  const user = req.user?._id;

  // validate the video based on id
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(401, "Invalid video id");
  }

  // check if the content is empty
  if (!content?.trim()) {
    throw new ApiError(400, "Comments is required");
  }

  // creating new comment
  const comment = await Comment.create({
    content,
    video: videoId,
    owner,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  // getting comment id from user requrest
  const { commentId } = req.params;

  // getting new content in the user request
  const { content } = req.body;

  // getting user id to validate
  const userId = req.user?._id;

  // check if the comment is valid (exist)
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(401, "Invalid comment id");
  }

  // chech if the comment is empty
  if (!content?.trim()) {
    throw new ApiError(400, "Comment is required");
  }

  // get comment from database based on its id
  const comment = await Comment.findById(commentId);

  // check if no such comment exist in database
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // check if the user is the old comment owner
  if (comment.owner?.toString() !== userId.toString()) {
    throw new ApiError(403, "you are not allowed to update this comment");
  }

  // update the comment
  comment.content = content.trim();
  await comment.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(400, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // find the user request comment id
  const { commentId } = req.params;
  // get user from request
  const userId = req.user?._id;

  // check if comment id is valid
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, " Invalid comment id");
  }

  //find comment in database based on the comment id
  const comment = await Comment.findById(commentId);

  // check if comment exists
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // check if current user is the owner
  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(403, " You cannot delete the comment");
  }

  // delete the comment
  await comment.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
