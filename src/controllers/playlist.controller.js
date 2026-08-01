import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, discription } = req.body;

  const userId = req.user?._id;

  if (!name?.trim()) {
    throw new ApiError(400, "Playlist name is required");
  }

  const existingPlaylist = await Playlist.findOne({
    owner: userId,
    name: name.trim(),
  });

  if (existingPlaylist) {
    throw new ApiError(409, "Playlist with this name already exists");
  }

  const playlist = await Playlist.create({
    owner: userId,
    name: name.trim(),
    discription: discription?.trim() || "",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const allUserPlaylists = await Playlist.find({
    owner: userId,
  }).select("name discription videos createdAt");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        allUserPlaylists,
        "All playlists fetched successfully"
      )
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username fullname avatar")
    .populate("videos");

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // check playlist ownership
  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized request");
  }

  const isVideoInPlaylist = playlist.videos.some(
    (id) => id.toString() === videoId.toString()
  );

  if (isVideoInPlaylist) {
    throw new ApiError(409, "Video already exists in playlist");
  }

  playlist.videos.push(videoId);

  await playlist.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Video add to playlist successfully"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized request");
  }

  const isVideoInPlaylist = playlist.videos.some(
    (id) => id.toString() === videoId.toString()
  );

  if (!isVideoInPlaylist) {
    throw new ApiError(404, "Video not found in playlist");
  }

  playlist.videos = playlist.videos.filter(
    (id) => id.toString() !== videoId.toString()
  );

  await playlist.save({ validateBeforeSave: false });

  //production approach
  // const updatePlaylist = await playlist.findByIdAndUpdate(
  //   playlistId,

  //   {
  //     $pull: {
  //       videos: videoId,
  //     },
  //   },
  //   { new: true }
  // );

  // now return the updatePlaylist

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video removed from playlist successfully")
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  const userId = req.user?._id;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized request");
  }

  await playlist.deleteOne();

  // production approach
  // const deletePlaylist = await Playlist.findByIdAndDelete({
  //   _id: playlistId,
  //   owner: userId,
  // });

  // if (!deletePlaylist) {
  //   throw new ApiError(404, "Playlist not found or unauthorized");
  // }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, discription } = req.body;

  const userId = req.user?._id;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  if (!name?.trim()) {
    throw new ApiError(400, "Playlist name is required");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "Unauthorized request");
  }

  playlist.name = name.trim();
  playlist.discription = discription?.trim() || "";

  await playlist.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
