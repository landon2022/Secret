require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const HttpsProxyAgent = require('https-proxy-agent');
// const bcrypt = require("bcrypt");
// const md5 = require("md5");
// const encrypt = require("mongoose-encryption");
const app = express();

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(session({
    secret: process.env.SESSION_SECRET,//should be an env var
    resave: false,
    saveUninitialized: false,
  }));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");
const userSchema = new mongoose.Schema({
    email:String,
    password:String,
    googleId:String,
    secrets:Array
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// const secret = process.env.SECRET;
// userSchema.plugin(encrypt,{secret:secret,encryptedFields: ["password"]});
const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

const gStrategy = new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    proxy: true
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log("testpoint1");
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
);

// const agent = new HttpsProxyAgent("http://43.154.217.49:13579");
// gStrategy._oauth2.setAgent(agent);

passport.use(gStrategy);

app.get("/", function (req, res) {
    res.render("home")
});



app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login", function (req, res) {
    res.render("login")
});

app.get("/register", function (req, res) {
    res.render("register")
});

app.get("/secrets", function(req, res) {
  const secrets = [];
  User.find({secrets:{$ne:null}}, function(err, foundusers) {
    if (err) {
      console.log(err);
    }else {
      if (foundusers) {
        foundusers.forEach(function(user){
          user.secrets.forEach(function(secret){
            secrets.push(secret)
          });
        });
        shuffle(secrets)
        res.render("secrets",{Secrets:secrets});
      }
    }
  });
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit")
  }else {
    res.redirect("/login")
  }
});

app.post("/submit", function(req, res) {
  const secret = req.body.secret;
  console.log(req.user);
  User.findById(req.user.id, function(err, founduser) {
    if (err) {
      console.log(err);
    }else {
      founduser.secrets.push(secret);
      founduser.save(function(){
        res.redirect("/secrets")
      });
    }
  });
});

app.get('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
});

app.post("/register", function(req, res) {
    User.register({username:req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register")
        }else {
            passport.authenticate('local')(req, res, function() {
                res.redirect("/secrets")
            });
        }
    });



    // const email = req.body.username;
    // const password = req.body.password;
    // bcrypt.hash(password, 10, function(err, hash) {
    //     const newUser = new User({
    //         email:email,
    //         password:hash
    //     });
    //     newUser.save(function(){
    //         res.render("secrets")
    //     });
    // });

});

app.post("/login", function(req, res) {
    const user = new User({
        username:req.body.username,
        password:req.body.password
    });
    req.logIn(user,function(err){
        if (err) {
            console.log(err);
            res.redirect("/login")
        }else {
            passport.authenticate('local')(req, res, function() {
                res.redirect("/secrets")
            });
        }
    });


    // const email = req.body.username;
    // const password = req.body.password;
    // User.findOne({email:email}, function(err, foundUser) {
    //     if (err) {
    //         console.log(err);
    //     } else {
    //         bcrypt.compare(password, foundUser.password, function(err, result) {
    //             if (result === true) {
    //                 res.render("secrets")    
    //             }
    //         });
    //     }
    // });
});

app.listen(3000, function(){
    console.log("Running at port 3000.");
});
