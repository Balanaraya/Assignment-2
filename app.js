/*
const express = require('express')
const bcrypt = require('bcrypt')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const getFollowingPeopleIdOfUser = async username => {
  const getFollowingPeopleQuery = `SELECT following_user_id  FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id
            WHERE user.username='${username}' ;`

  const followername = await db.all(getFollowingPeopleQuery)
  const arrayOfId = followername.map(eachUser => eachUser.following_user_id)

  return arrayOfId
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken) {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

//Tweet Access Verification

const tweetaccessVerification = async (request, response, next) => {
  const {userId} = request
  const {tweetId} = request.params
  const getTweetQuery = `SELECT * FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
   WHERE  tweet.tweet_id='${tweetId}' AND  follower_user_id='${userId};`

  const tweet = await db.get(getTweetQuery)

  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

app.post('/register/', async (request, response) => {
  const {username, name, password, gender} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)

  const selectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
  `
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO user (username, password, name, gender)
        VALUES (
       
          '${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}'
        );
      `
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      await db.run(createUserQuery)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

///

app.post('/login', async (request, response) => {
  const {username, password} = request.body

  const selectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
  `
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      }

      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const {username} = request
  try {
    const followingPeopleIds = await getFollowingPeopleIdOfUser(username)

  

    const selectQuery = `
      SELECT username, tweet, date_time AS dateTime 
      FROM user 
      INNER JOIN tweet ON user.user_id = tweet.user_id 
      WHERE user.user_id IN (${followingPeopleIds})
      ORDER BY date_time DESC
      LIMIT 4;
    `

    const tweets = await db.all(selectQuery)
    response.send(tweets)
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

app.get('/user/following/', authenticateToken, async (req, res) => {
  const {userId, username} = req

  const followingQuery = `
      SELECT name
      FROM follower 
      INNER JOIN user ON user.user_id = follower.following_user_id
      WHERE follower_user_id = ${userId};
    `

  const followingList = await db.all(followingQuery)

  // Extract the names from the result and send the response

  res.send(followingList)
})

app.get('/user/followers/', authenticateToken, async (req, res) => {
  const {username, userId} = req

  const Allfollower = `SELECT  name FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id
            WHERE following_user_id='${userId}' ;`
  const followers = await db.all(Allfollower)
  res.send(followers)
})

app.get('/tweets/:tweetId/', authenticateToken, async (req, res) => {
  const {userId} = req
  const {tweetId} = req.params

  console.log('UserId:', userId)
  console.log('TweetId:', tweetId)

  try {
    const checkIfFollowingQuery = `
      SELECT tweet.tweet_id 
      FROM tweet 
      INNER JOIN follower ON tweet.user_id = follower.following_user_id 
      WHERE tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${userId};
    `

    const tweet = await db.get(checkIfFollowingQuery)
    console.log('Query Result:', tweet)

    if (tweet === undefined) {
      return res.status(401).send('Invalid Request')
    }

    const getTweetQuery = `
      SELECT tweet, 
             (SELECT COUNT() FROM Like WHERE tweet_id = ${tweetId}) AS likes,
             (SELECT COUNT() FROM reply WHERE tweet_id = ${tweetId}) AS replies,
             date_time AS dateTime
      FROM tweet 
      WHERE tweet.tweet_id = ${tweetId};
    `
    const tweetDetails = await db.get(getTweetQuery)
    response.send({jwtToken})
  } catch (error) {
    console.error('Error:', error)
    res.status(500).send('Internal Server Error')
  }
})

app.get('/tweets/:tweetId/likes/', authenticateToken, async (req, res) => {
  const {tweetId} = req.params
  const getLikesQuery = `SELECT username FROM user INNER JOIN like ON user.user_id=like.user_id
  WHERE tweet_id='${tweetId}';`

  const likedUser = await db.all(getLikesQuery)
  const userArray = likedUser.map(eachUser => eachUser.username)

  res.send({likes: userArray})
})




app.get('/tweets/:tweetId/replies/', authenticateToken, async (req, res) => {
  const {tweetId} = req.params
  const getRepliedQuery = `SELECT name,reply FROM user INNER JOIN reply ON user.user_id=reply.user_id
  WHERE tweet_id='${tweetId}';`
  const repliedUser = await db.all(getRepliedQuery)
  res.send({repliedUser})
}) 



app.get('/user/tweets/', authenticateToken, async (req, res) => {
  const {userId} = req
  const getTweetQuery = `SELECT tweet, COUNT(DISTINCT like_id) AS likes,
  COUNT(DISTINCT reply_id) AS replies,
  date_time AS dateTime
  FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id LEFT JOIN like ON tweet.tweet_id=like.tweet_id
  WHERE tweet.user_id=${userId}
  
  GROUP BY tweet.tweet_id;`
  const tweets = await db.all(getTweetQuery)

  rep.send(tweets)
})

app.post('/user/tweets/', authenticateToken, async (req, res) => {
  const {tweet} = req.body
  const userId = parseInt(req.userId)
  const dateTime = new Date().toJSON().substring(0, 19).replace('T', ' ')
  const createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
  VALUES('${tweet}','${userId}','${dateTime}')`

  await db.run(createTweetQuery)
  res.send('Created a Tweet')
})




app.delete('/tweets/:tweetId/', authenticateToken, async (req, res) => {
  const {userId} = req
  const {tweetId} = req.params

  const getTweetQuery = `SELECT * FROM tweet WHERE user_id='${userId}' AND tweet_id='${tweetId}';`
  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    res.status(401)
    res.send('Invalid Request')
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id='${tweetId}';`
    await db.run(deleteTweetQuery)
    
    res.send('Tweet Removed')
  }
})



module.exports = app

*/

const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`DB Error : ${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

// GETTING ARRAY OF USER FOLLOWING ID'S

const getFollowingPeopleIdsOfUser = async username => {
  const getTheFollowingPeopleQuery = `
  SELECT
        following_user_id FROM follower
  INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE user.username='${username}';`

  const followingPeople = await db.all(getTheFollowingPeopleQuery)
  const arrayOfIds = followingPeople.map(eachUser => eachUser.following_user_id)
  return arrayOfIds
}

// AUTHENTICATION TOKEN

const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken) {
    jwt.verify(jwtToken, 'SECRET_KEY', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

//TWEET ACCESS VERIFICATION

const tweetAccessVerification = async (request, response, next) => {
  const {tweetId} = request.params
  const {userId} = request

  const getTweetQuery = `SELECT
*
FROM tweet INNER JOIN follower
ON tweet.user_id = follower.following_user_id
WHERE tweet.tweet_id = '${tweetId}' AND follower_user_id = '${userId}';`
  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

// API - 1

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const userDBDetails = await db.get(getUserQuery)

  // scenario 1
  if (userDBDetails !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    // scenario 2
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      // scenario 3
      const hashedPassword = await bcrypt.hash(password, 10)
      const createUserQuery = `INSERT INTO user(username,password,name,gender)
       VALUES('${username}','${hashedPassword}','${name}','${gender}')`
      await db.run(createUserQuery)
      response.send('User created successfully')
    }
  }
})

// API - 2

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const userDbDetails = await db.get(getUserQuery)
  if (userDbDetails !== undefined) {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      userDbDetails.password,
    )

    if (isPasswordCorrect) {
      const payload = {username, userId: userDbDetails.user_id}
      const jwtToken = jwt.sign(payload, 'SECRET_KEY')
      response.send({jwtToken})
    } else {
      // scenario 2
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    // scenario 1
    response.status(400)
    response.send('Invalid user')
  }
})

//API - 3

app.get('/user/tweets/feed/', authentication, async (request, response) => {
  const {username} = request

  const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)

  const getTweetsQuery = `SELECT
    username,tweet, date_time as dateTime
    FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE 
    user.user_id IN (${followingPeopleIds})
    ORDER BY date_time DESC
    LIMIT 4;
    `
  const tweets = await db.all(getTweetsQuery)
  response.send(tweets)
})

// API - 4

app.get('/user/following/', authentication, async (request, response) => {
  const {username, userId} = request
  console.log(userId)
  const getFollowingUsersQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE follower_user_id = '${userId}';
    `

  const followingPeople = await db.all(getFollowingUsersQuery)
  response.send(followingPeople)
})

// API - 5

app.get('/user/followers/', authentication, async (request, response) => {
  const {username, userId} = request
  const getFollowersQuery = `SELECT DISTINCT name FROM follower
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE following_user_id = '${userId}';
    `
  const followers = await db.all(getFollowersQuery)
  response.send(followers)
})

// API - 6

app.get(
  '/tweets/:tweetId/',
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getTweetQuery = `SELECT tweet,
    (SELECT COUNT() FROM like WHERE tweet_id = '${tweetId}') AS likes,
    (SELECT COUNT() FROM reply WHERE tweet_id = '${tweetId}') AS replies,
    date_time AS dateTime
    FROM tweet
    WHERE tweet.tweet_id = '${tweetId}' ;`
    const tweet = await db.get(getTweetQuery)
    response.send(tweet)
  },
)

// API - 7

app.get(
  '/tweets/:tweetId/likes/',
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const {tweetId} = request.params
    const getLikesQuery = `SELECT username
    FROM user INNER JOIN like ON user.user_id = like.user_id
    WHERE tweet_id = '${tweetId}';
    `
    const likedUsers = await db.all(getLikesQuery)
    const usersArray = likedUsers.map(eachUser => eachUser.username)
    response.send({likes: usersArray})
  },
)

// API - 8

app.get(
  '/tweets/:tweetId/replies/',
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const {tweetId} = request.params
    const getRepliedQuery = `SELECT name,reply
    FROM user INNER JOIN reply ON user.user_id = reply.user_id
    WHERE tweet_id = '${tweetId}';
    `
    const repliedUsers = await db.all(getRepliedQuery)
    response.send({replies: repliedUsers})
  },
)

// API - 9

app.get('/user/tweets/', authentication, async (request, response) => {
  const {userId} = request
  const getTweetsQuery = `
    SELECT tweet,
    COUNT(DISTINCT like_id) AS likes,
    COUNT(DISTINCT reply_id) AS replies,
    date_time AS dateTime
    FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;`
  const tweets = await db.all(getTweetsQuery)
  response.send(tweets)
})

// API - 10

app.post('/user/tweets/', authentication, async (request, response) => {
  const {tweet} = request.body
  const userId = parseInt(request.userId)
  const dateTime = new Date().toJSON().substring(0, 19).replace('T', ' ')
  const createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES('${tweet}','${userId}','${dateTime}')
    `
  await db.run(createTweetQuery)
  response.send('Created a Tweet')
})

// API - 11

app.delete('/tweets/:tweetId/', authentication, async (request, response) => {
  const {tweetId} = request.params
  const {userId} = request
  const getTheTweetQuery = `SELECT * FROM tweet WHERE user_id = '${userId}' AND tweet_id = '${tweetId}';`
  const tweet = await db.get(getTheTweetQuery)

  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id ='${tweetId}';`
    await db.run(deleteTweetQuery)
    response.send('Tweet Removed')
  }
})

module.exports = app
