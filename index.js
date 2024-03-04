let express = require("express");
let mongoose = require("mongoose");
let cors = require("cors");
let app = express();
let jwt = require("jsonwebtoken");
let multer = require("multer");
let { CloudinaryStorage } = require("multer-storage-cloudinary");
let cloudinary = require("cloudinary").v2;

require("dotenv").config();

cloudinary.config({
  cloud_name: "dcdynkm5d",
  api_key: "157745433978489",
  api_secret: "AqvKiU623z4vCZStGiBvBgk-2vQ",
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    format: async (req, file) => "png",
  },
});

const uplaod = multer({
  storage: storage,
});

let frontend_key = process.env.FRONTEND_KEY;
let securityKey = process.env.TOKEN_SECURITY_KEY;
let mongodbKey = process.env.MONGODB_KEY;
let port = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: frontend_key,
//   })
// );
app.use(cors());
app.use(express.json());

mongoose.connect(mongodbKey);

let registerSchema = mongoose.Schema({
  email: String,
  userName: String,
  password: String,
  profilePic: String,
  following: Array,
  settings: Object,
});

let postsSchema = mongoose.Schema({
  user: String,
  post: String,
  caption: String,
  likes: Array,
  comments: Array,
  time: Number,
});

let messagesSchema = mongoose.Schema({
  users: Array,
  messages: Array,
});

let registerModel = mongoose.model("account", registerSchema);
let postsModel = mongoose.model("posts", postsSchema);
let messagesModel = mongoose.model("messages", messagesSchema);

app.get("/token", checker, (req, res) => {
  res.json({ result: "ok" });
});

app.get("/login/:email/:password", async (req, res) => {
  let result = await registerModel.findOne({ email: req.params.email });
  if (result !== null) {
    if (result.password === req.params.password) {
      jwt.sign({ result }, securityKey, (err, token) => {
        res.json({ result, token: token });
      });
    } else {
      res.json({ result: "wrong password" });
    }
  } else {
    res.json({ result: "empty" });
  }
});

app.get("/signUp/:email/:password/:userName", async (req, res) => {
  let result_email = await registerModel.findOne({ email: req.params.email });
  let result_userName = await registerModel.findOne({
    userName: req.params.userName,
  });
  if (result_email !== null) {
    res.json({ result: "email present" });
  } else if (result_email === null && result_userName !== null) {
    res.json({ result: "userName present" });
  } else {
    await registerModel({
      email: req.params.email,
      password: req.params.password,
      userName: req.params.userName,
      settings: {
        accountPrivacy: "public",
      },
    }).save();
    jwt.sign({ result: "saved" }, securityKey, (err, token) => {
      res.json({ result: "saved", token: token });
    });
  }
});

function checker(req, res, next) {
  let token = req.headers.authorization;
  if (token) {
    jwt.verify(token, securityKey, (err, valid) => {
      if (err) {
        res.json({ result: "token error" });
      } else {
        next();
      }
    });
  } else {
    res.json({ result: "token error" });
  }
}

app.get("/home/:user", checker, async (req, res) => {
  let user = await registerModel.findOne({ email: req.params.user });
  let posts = await postsModel.find({ user: { $in: user.following } });

  let postUser = posts.map((item) => item.user);
  let profilePicArray = [];
  for (let i = 0; i < postUser.length; i++) {
    let profilePic = await registerModel.findOne({ email: postUser[i] });
    profilePicArray.push(profilePic.profilePic);
  }

  let SortedTimeArray = [];
  for (let i = 0; i < posts.length; i++) {
    let profilePic = await registerModel.findOne({ email: posts[i].user });

    let tempObject = {
      profilePic: profilePic.profilePic,
      _id: posts[i]._id,
      user: posts[i].user,
      post: posts[i].post,
      caption: posts[i].caption,
      comments: posts[i].comment,
      likes: posts[i].likes,
    };
    SortedTimeArray.push(tempObject);
  }

  res.json({ result: SortedTimeArray });
});

app.get("/addPost/:email", checker, (req, res) => {
  res.json({ result: "hello, addPost" });
});

app.get("/profile/:email", checker, async (req, res) => {
  let email = req.params.email;
  let FollowerData = await registerModel.find({ following: email });
  let followers = FollowerData.map((item) => ({
    email: item.email,
    profilePic: item.profilePic,
  }));
  let followingData = await registerModel.findOne({ email: email });
  let followingsProfilePicFind = await registerModel.find({
    email: followingData.following,
  });
  let followings = followingsProfilePicFind.map((item) => ({
    email: item.email,
    profilePic: item.profilePic,
  }));

  let peopleData = await registerModel.find({});
  let filterPeople = peopleData.filter(
    (item) =>
      item.email !== email && !followingData.following.includes(item.email)
  );

  let people = filterPeople.map((item) => ({
    email: item.email,
    profilePic: item.profilePic,
  }));

  let postsData = await postsModel.find({ user: { $in: email } });

  let result = {
    userName: followingData.userName,
    profilePic: followingData.profilePic,
    people: people,
    followers: followers,
    followings: followings,
    posts: postsData,
  };
  res.json({ result });
});

app.get("/follow/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;

  let colloction = await registerModel.updateOne(
    { email: user },
    { $push: { following: target } }
  );
  res.json({ result: colloction.acknowledged });
});

app.get("/unFollow/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;
  let colloction = await registerModel.updateOne(
    { email: user },
    { $pull: { following: target } }
  );
  res.json({ result: colloction.acknowledged });
});

app.post("/post/:user", checker, uplaod.single("image"), async (req, res) => {
  if (req.file) {
    let result = await cloudinary.uploader.upload(req.file.path);
    await postsModel({
      user: req.params.user,
      post: result.secure_url,
      caption: req.body.caption,
      time: Date.now(),
    }).save();
  }
  res.json({ result: true });
});

app.get("/like/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;

  let likeObj = {
    likes: user,
    time: Date.now(),
  };

  await postsModel.updateOne({ _id: target }, { $push: { likes: likeObj } });
  res.json({ result: false });
});

app.get("/dislike/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;

  let likeObj = {
    likes: user,
  };

  await postsModel.updateOne({ _id: target }, { $pull: { likes: likeObj } });
  res.json({ result: false });
});

app.post("/addComment/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;
  let comment = req.body.comment;
  let commentObject = {
    commenter: user,
    comment: comment,
    time: Date.now(),
  };
  let acknowledgment = await postsModel.updateOne(
    { _id: target },
    { $push: { comments: commentObject } }
  );
  res.json({ result: acknowledgment.acknowledged });
});

app.get("/getComments/:user/:target", checker, async (req, res) => {
  let commentsData = await postsModel.findOne({ _id: req.params.target });
  let SortedTimeArray = [];

  for (let i = 0; i < commentsData.comments.length; i++) {
    let tempCommentData = await registerModel.findOne({
      email: commentsData.comments[i].commenter,
    });
    let tempObject = {
      commenter: commentsData.comments[i].commenter,
      comment: commentsData.comments[i].comment,
      commenterPic: tempCommentData.profilePic,
    };
    SortedTimeArray.push(tempObject);
  }
  res.json({ result: SortedTimeArray });
});

app.delete("/deleteComment/:comment/:post", checker, async (req, res) => {
  let comment = req.params.comment;
  let post = req.params.post;
  let commentData = await postsModel.findOne({ _id: post });
  let commentArray = commentData.comments;
  commentArray.splice(comment, 1);
  let deleteComment = await postsModel.updateOne(
    { _id: post },
    { comments: commentArray }
  );
  res.json({ result: deleteComment.acknowledged });
});

app.get("/getLikes/:target", checker, async (req, res) => {
  let likesResult = await postsModel.findOne({ _id: req.params.target });
  res.json({ result: likesResult.likes });
});

app.post(
  "/changeProfilePic/:user",
  uplaod.single("image"),
  async (req, res) => {
    let previousProfilePic = await registerModel.findOne({
      userName: req.params.user,
    });
    let result = await cloudinary.uploader.upload(req.file.path);
    await registerModel.updateOne(
      { userName: req.params.user },
      { $set: { profilePic: result.secure_url } }
    );

    let imageToDelete = previousProfilePic.profilePic;
    if (imageToDelete !== null) {
      let imageToDeleteArray = imageToDelete.split("/");
      let imageToDeletePublicId = `${
        imageToDeleteArray[imageToDeleteArray.length - 1].split(".")[0]
      }`;
      await cloudinary.uploader.destroy(imageToDeletePublicId);
    }
    res.json({ result: "likesResult.likes" });
  }
);

app.get("/changeProfilePic/:user", async (req, res) => {
  let post = await registerModel.findOne({ userName: req.params.user });
  res.json({ result: post.profilePic });
});

app.get("/deleteProfilePic/:user", async (req, res) => {
  let previousProfilePic = await registerModel.findOne({
    userName: req.params.user,
  });
  let imageToDelete = previousProfilePic.profilePic;
  let imageToDeleteArray = imageToDelete.split("/");
  let imageToDeletePublicId = `${
    imageToDeleteArray[imageToDeleteArray.length - 1].split(".")[0]
  }`;
  await cloudinary.uploader.destroy(imageToDeletePublicId);

  let deletePost = await registerModel.updateOne(
    { userName: req.params.user },
    { $set: { profilePic: null } }
  );

  res.json({ result: deletePost.acknowledged });
});

app.get("/peopleProfile/:target", checker, async (req, res) => {
  let target = req.params.target;
  let personalInfoData = await registerModel.findOne({ email: target });
  let postsInfoData = await postsModel.find({ user: target });
  let followersInfoData = await registerModel.find({
    following: { $in: target },
  });

  let followingsProfilePic = [];
  for (let i = 0; i < personalInfoData.following.length; i++) {
    let followingsProfilePicFind = await registerModel.findOne({
      email: { $in: personalInfoData.following[i] },
    });
    followingsProfilePic.push(followingsProfilePicFind.profilePic);
  }
  let infoObj = {
    personalInfo: personalInfoData,
    posts: postsInfoData,
    followers: followersInfoData.map((item) => item.email),
    followersProfilePic: followersInfoData.map((item) => item.profilePic),
    followingsProfilePic,
  };

  res.json({ result: infoObj });
});

app.get("/messages/:email", checker, async (req, res) => {
  let userData = await registerModel.findOne({ email: req.params.email });
  let followings = userData.following;
  let followersArray = await registerModel.find({
    following: req.params.email,
  });
  let followers = followersArray.map((item) => item.email);
  let messagePeople = followers.filter((item) => followings.includes(item));
  res.json({ result: messagePeople });
});

app.get("/getfollowingsList/:email", checker, async (req, res) => {
  let userData = await registerModel.findOne({ email: req.params.email });
  let followings = userData.following;
  res.json({ result: followings });
});

app.post("/messageTo/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;
  let messageText = req.body.messageText;

  let messageObj = {
    sender: user,
    text: messageText,
  };

  let acknowledgment = await messagesModel.updateOne(
    { $or: [{ users: [user, target] }, { users: [target, user] }] },
    { $push: { messages: messageObj } }
  );

  res.json({ result: acknowledgment.acknowledged });
});

app.get("/makeMessageDb/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;

  let alreadyAvailable = await messagesModel.find({
    $or: [{ users: [target, user] }, { users: [user, target] }],
  });

  if (alreadyAvailable.length === 0) {
    await messagesModel({
      users: [user, target],
    }).save();
  }
  res.json({ result: "messageTo" });
});

app.get("/getMessagesData/:user/:target", checker, async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;

  let alreadyAvailable = await messagesModel.findOne({
    $or: [{ users: [target, user] }, { users: [user, target] }],
  });
  if (alreadyAvailable) {
    res.json({ result: alreadyAvailable.messages });
  } else {
    res.json({ result: [] });
  }
});

app.get("/timer/:user/:target", async (req, res) => {
  let user = req.params.user;
  let target = req.params.target;

  let messagesData = await messagesModel.findOne({
    $or: [{ users: [user, target] }, { users: [target, user] }],
  });
  res.json({ result: messagesData.messages.length });
});

app.get("/search/:email", checker, (req, res) => {
  res.json({ result: "hello, Search" });
});

app.get("/searchResult/:searchText", checker, async (req, res) => {
  let searchText = req.params.searchText;

  let searchedArray = await registerModel.find({
    $or: [
      { email: new RegExp(searchText, "i") },
      { userName: new RegExp(searchText, "i") },
    ],
  });
  let filteredArray = searchedArray.map((item) => ({
    email: item.email,
    profilePic: item.profilePic,
    userName: item.userName,
  }));
  res.json({ result: filteredArray });
});

app.get("/settings/:email", checker, (req, res) => {
  res.json({ result: "hello, settings" });
});

app.post("/setAccountPrivacyState/:email", checker, async (req, res) => {
  let accountPrivacyValue = req.body.accountPrivacy;
  let email = req.params.email;
  let settingsObject = {
    accountPrivacy: accountPrivacyValue,
  };
  await registerModel.updateOne(
    { email: email },
    { $set: { settings: settingsObject } }
  );
  res.json({ result: accountPrivacyValue });
});

app.get("/getAccountPrivacyState/:email", checker, async (req, res) => {
  let email = req.params.email;
  let user = await registerModel.findOne({ email: email });
  let accountPrivacyState = user.settings.accountPrivacy;
  res.json({ result: accountPrivacyState });
});

app.post("/share/:email/:targetedPic", checker, async (req, res) => {
  let user = req.params.email;
  let tempTargetedPic = req.params.targetedPic;
  let targetedPic = tempTargetedPic.replaceAll("-", "/");
  let selectedPeople = req.body.selectedPeople;

  selectedPeople.forEach(async (item) => {
    let temp = await messagesModel.findOne({
      $or: [{ users: [user, item] }, { users: [item, user] }],
    });
    if (temp === null) {
      await messagesModel({
        users: [user, item],
      }).save();
    }
    await messagesModel.updateOne(
      {
        $or: [{ users: [user, item] }, { users: [item, user] }],
      },
      { $push: { messages: { sender: user, pic: targetedPic } } }
    );
  });

  res.json({ result: "accountPrivacyValue" });
});

app.get("/notifications/:email", checker, async (req, res) => {
  let email = req.params.email;
  let user = await postsModel.find({ user: email });

  let SortedTimeArray = user.flatMap((item) => [
    ...item.likes.map((likesItem) => ({
      post: item.post,
      liker: likesItem.likes,
      time: likesItem.time,
    })),
    ...item.comments.map((commentsItem) => ({
      post: item.post,
      commenter: commentsItem.commenter,
      comment: commentsItem.comment,
      time: commentsItem.time,
    })),
  ]);

  SortedTimeArray.sort((a, b) => b.time - a.time);
  res.json({ result: SortedTimeArray });
});

app.delete("/deletePost/:target", checker, async (req, res) => {
  let findPost = await postsModel.findOne({ _id: req.params.target });
  let imageToDeleteArray = findPost.post.split("/");
  let imageToDelete = imageToDeleteArray[imageToDeleteArray.length - 1];
  let imageToDeletePublicId = imageToDelete.split(".")[0];
  await cloudinary.uploader.destroy(imageToDeletePublicId);
  await postsModel.deleteOne({ _id: req.params.target });
  res.json({ result: "deleted" });
});

app.listen(port, () => {
  console.log("ok");
});
