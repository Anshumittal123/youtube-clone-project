import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/apiResponse.js'; 
import jwt from 'jsonwebtoken'


const generateAccessAndRefereshToken = async(userId) =>{
    try {
        const user =  await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({vaildateBeforeSave: false});

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token."); 
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary
    // create user object - create entry in db.
    // remove password and refresh token field from respone
    // check for user creation 
    // return response

    const {fullName, email, username, password } = req.body
    // console.log("email: ", email);
    // console.log("REQ BODY: ", req.body);

    // if(fullName === "" || email === ""){

    // }

    if(
        [fullName, email, username, password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    // console.log(existedUser);

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists");
    }

    // console.log('req of a file', req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.file?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar =  await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refeshToken"
    );

    if(!createdUser){
      throw new ApiError(500, "Something went wrong while registering the user");   
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully.")
    )

})

const loginUser = asyncHandler(async (req, res)=>{
    // req body  => data
    // username or email
    //  find the user
    // password check
    // access and referesh token
    // send cookie

    const {email, username, password} = req.body;
    console.log(email);

    // if(!(username || email)){
    //     throw new ApiError(400, "username or password is required.");
    // }

    if(!username && !email){
        throw new ApiError(400, "username or password is required.");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User doesn't exists.");
    }

    const isPasswordVaild =  await user.isPasswordCorrect(password);

    if(!isPasswordVaild){
        throw new ApiError(401, "Invaild User credentials.");
    }

    const {accessToken, refreshToken}  = await generateAccessAndRefereshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "lax", // or "strict"
    }

    console.log("Sending cookies...");
    console.log("AccessToken:", accessToken);
    console.log("RefreshToken:", refreshToken);


    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged In successfully!!"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})   // it give me an error so, need to debug

const refreshAccessToken = asyncHandler(async (req, res)=>{
    try {
        const incomingRefreshToken  = req.cookies.refreshToken || req.body.refreshToken
    
        if(!incomingRefreshToken){
            throw new ApiError(401, "unauthorized request")
        }
    
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options ={
            httpOnly: true,
            secure: true,
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
};