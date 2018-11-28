// typescript

let fs = require('fs')

const MINIMUM_TWEET_COUNT = 5
const MAXIMUM_IMAGE_COUNT_PER_THREAD = 12

let originalData = {}
let tweetLookupTable = {}
let threadTweets = []

////////////////

function generateLookupTable() {
  for (var i in originalData.tweets) {
    const tweet = originalData.tweets[i]
    tweetLookupTable[tweet.id_str] = tweet
  }
}

function findUltimateParent(tweet) {
  let currentTweet = tweet

  while (currentTweet.in_reply_to_status_id_str && 
        tweetLookupTable[currentTweet.in_reply_to_status_id_str]) {
    currentTweet = tweetLookupTable[currentTweet.in_reply_to_status_id_str]
  }

  return currentTweet
}

////////////

console.log('Twitter thread list 1.00')
console.log('Marcin Wichary, 2018')
console.log('--------------------')

let directory = process.argv[2]
if (directory.substr(directory.length - 1, 1) != '/') {
  directory += '/'
}

if (!fs.existsSync(`${directory}account.js`) || !fs.existsSync(`${directory}tweet.js`)) {
  console.warn()
  console.warn('Please run this script where you unpacked the archive, or specify the')
  console.warn('path to the archive as an argument.')
  process.exit(1)
}
//console.warn(directory)

console.log('Reading files…')
let accountFileContents = fs.readFileSync(`${directory}account.js`, 'utf8')
let tweetFileContents = fs.readFileSync(`${directory}tweet.js`, 'utf8')

console.log('Processing data…')
accountFileContents = accountFileContents.replace(/window.YTD.account.part0 =/, '')
tweetFileContents = tweetFileContents.replace(/window.YTD.tweet.part0 =/, '')
originalData = {
  account: JSON.parse(accountFileContents),
  tweets: JSON.parse(tweetFileContents),
}

generateLookupTable()

for (var i in originalData.tweets) {
  const tweet = originalData.tweets[i]

  if (tweet.in_reply_to_status_id_str && tweetLookupTable[tweet.in_reply_to_status_id_str]) {
    const parentTweet = findUltimateParent(tweet)

    // needs to be your tweet
    if (parentTweet) {
      if (parentTweet.thread_length) {
        parentTweet.thread_length++
      } else {
        parentTweet.thread_length = 1
      }

      if (!parentTweet.favorite_count_combined) {
        parentTweet.favorite_count_combined = parseInt(parentTweet.favorite_count) + parseInt(tweet.favorite_count)
      } else {
        parentTweet.favorite_count_combined += parseInt(tweet.favorite_count)
      }

      if (!parentTweet.retweet_count_combined) {
        parentTweet.retweet_count_combined = parseInt(parentTweet.retweet_count) + parseInt(tweet.retweet_count)
      } else {
        parentTweet.retweet_count_combined += parseInt(tweet.retweet_count)
      }

      if (!parentTweet.images_combined) {
        parentTweet.images_combined = []
      }
      if (tweet.extended_entities && !tweet.extended_entities_processed) {
        for (var i = tweet.extended_entities.media.length - 1; i >= 0; i--) {
          parentTweet.images_combined.unshift(tweet.extended_entities.media[i].media_url_https)
        }
        tweet.extended_entities_processed = true
      }
      
      if (threadTweets.indexOf(parentTweet) == -1) {
        threadTweets.push(parentTweet)
      }
    }
  }
}

const threadTweetsStartingWithSelf = 
    threadTweets.filter(tweet => !tweet.in_reply_to_status_id_str)

const threadTweetsAppropriateLength = 
    threadTweetsStartingWithSelf.filter(tweet => tweet.thread_length >= MINIMUM_TWEET_COUNT)

console.log()
console.log(`${originalData.tweets.length} tweets found`)
console.log(`…${threadTweets.length} tweets in any threads`)
console.log(`……${threadTweetsStartingWithSelf.length} tweets starting threads`)
console.log(`………${threadTweetsAppropriateLength.length} threads of appropriate length`)

for (var i in threadTweetsAppropriateLength) {
  const tweet = threadTweetsAppropriateLength[i]

  if (tweet.extended_entities && !tweet.extended_entities_processed) {
    for (var i = tweet.extended_entities.media.length - 1; i >= 0; i--) {
      tweet.images_combined.unshift(tweet.extended_entities.media[i].media_url_https)
    }
    tweet.extended_entities_processed = true
  }


  tweet.thread_score = 
      tweet.thread_length * 5.0 + 
      tweet.retweet_count_combined * 2.0 + 
      tweet.favorite_count_combined * 1.0
}

const threadTweetsSortedByScore = 
    threadTweetsAppropriateLength.sort((a, b) => (a.thread_score < b.thread_score) ? 1 : -1)

const filteredOutput = {
  account: {
    username: originalData.account[0].account.username,
    accountDisplayName: originalData.account[0].account.accountDisplayName,
    lastUpdated: new Date().getTime(),
  },
  tweets: [],
}

for (var i in threadTweetsSortedByScore) {
  const tweet = threadTweetsSortedByScore[i]

  let outputTweet = {
    'id_str': tweet.id_str,
    'full_text': tweet.full_text,
    'created_at': Date.parse(tweet.created_at),

    'images_combined': tweet.images_combined.slice(0, MAXIMUM_IMAGE_COUNT_PER_THREAD),

    'thread_score': tweet.thread_score,
    'thread_length': tweet.thread_length,
    'retweet_count_combined': tweet.retweet_count_combined,
    'favorite_count_combined': tweet.favorite_count_combined,
  } 

  filteredOutput.tweets.push(outputTweet)
}

fs.writeFileSync('thread-list.json', 'const data = ' + JSON.stringify(filteredOutput, null, 2), 'utf8')

console.log()
console.log('Thread list generated! Type `open thread-list.html` (on a Mac) to view it.')
