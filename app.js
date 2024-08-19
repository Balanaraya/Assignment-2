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

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
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
})app.post('/login', async (request, response) => {


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

  const select = `SELECT * FROM tweet WHERE  tweet LIKE '${search_q}' LIMIT ${limit} OFFSET ${offset};`

  const dbResponse = await db.run(select)

  response.send(dbResponse)
})

app.get('/user/following/', authenticateToken, async (req, res) => {
  const {username, userId} = req

  const Allname = `SELECT name FROM follower INNER JOIN user ON user.user_id=follower.following_user_id
            WHERE follower_user_id='${userId}' ;`
  const followername = await db.all(Allname)
  res.send(followername)
})

app.get('/user/followers/', authenticateToken, async (req, res) => {
  const {username, userId} = req

  const Allfollower = `SELECT DISTINCT name FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id
            WHERE following_user_id='${userId}' ;`
  const followers = await db.all(Allfollower)
  res.send(followers)
})

app.get('/tweets/:tweetId/', authenticateToken, async (req, res) => {
  const {tweetId} = req.params

  const getTweetQuery = `SELECT tweet, 
  (SELECT COUNT() FROM Like WHERE tweet_id=${tweetId}) AS Likes,
   (SELECT COUNT() FROM reply WHERE tweet_id=${tweetId}) AS replies,
   date_time AS dateTime
   FROM tweet 
   WHERE tweet.tweet_id=${tweetId};`
  const tweet = await db.get(getTweetQuery)
  res.send(tweet)
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
  const getTweetQuery = `SELECT * FROM tweet WHERE user_id='${userId} AND tweet_id='${tweetId}';`
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
