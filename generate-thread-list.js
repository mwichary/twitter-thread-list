const fs = require('fs')
const Feed = require('feed').Feed

const MINIMUM_TWEET_COUNT = 5
const MAXIMUM_IMAGE_COUNT_PER_THREAD = 12

let originalData = {}
let tweetsById = {}
let threadTweets = []

// Functions
// -----------------------------------------

function generateLookupTable() {
  for (let i in originalData.tweets) {
    const tweet = originalData.tweets[i]
    tweetsById[tweet.id_str] = tweet
  }
}

function findUltimateParent(tweet) {
  let currentTweet = tweet

  while (currentTweet.in_reply_to_status_id_str && 
    tweetsById[currentTweet.in_reply_to_status_id_str]) {
    currentTweet = tweetsById[currentTweet.in_reply_to_status_id_str]
  }

  return currentTweet
}

// Code starts here
// -----------------------------------------

console.log('Twitter thread list 1.03')
console.log('Marcin Wichary, 2018–2019')
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

// Process stuff
// -----------------------------------------

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

for (let i in originalData.tweets) {
  const tweet = originalData.tweets[i]

  if (tweet.in_reply_to_status_id_str && tweetsById[tweet.in_reply_to_status_id_str]) {
    const parentTweet = findUltimateParent(tweet)

    // needs to be your tweet
    if (parentTweet) {
      if (parentTweet.thread_length) {
        parentTweet.thread_length++
      } else {
        parentTweet.thread_length = 1
      }

      if (!parentTweet.last_updated_at || Date.parse(tweet.created_at) > parentTweet.last_updated_at) {
        parentTweet.last_updated_at = Date.parse(tweet.created_at)
      }

      if (!parentTweet.favorite_count_combined) {
        parentTweet.favorite_count_combined = 
            parseInt(parentTweet.favorite_count) + parseInt(tweet.favorite_count)
      } else {
        parentTweet.favorite_count_combined += parseInt(tweet.favorite_count)
      }

      if (!parentTweet.retweet_count_combined) {
        parentTweet.retweet_count_combined = 
            parseInt(parentTweet.retweet_count) + parseInt(tweet.retweet_count)
      } else {
        parentTweet.retweet_count_combined += parseInt(tweet.retweet_count)
      }

      if (!parentTweet.images_combined) {
        parentTweet.images_combined = []
      }
      if (tweet.extended_entities && !tweet.extended_entities_processed) {
        for (let i = tweet.extended_entities.media.length - 1; i >= 0; i--) {
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

for (let i in threadTweetsAppropriateLength) {
  const tweet = threadTweetsAppropriateLength[i]

  if (tweet.extended_entities && !tweet.extended_entities_processed) {
    for (let i = tweet.extended_entities.media.length - 1; i >= 0; i--) {
      tweet.images_combined.unshift(tweet.extended_entities.media[i].media_url_https)
    }
    tweet.extended_entities_processed = true
  }

  tweet.thread_score = 
      tweet.thread_length * 5.0 + 
      tweet.retweet_count_combined * 2.0 + 
      tweet.favorite_count_combined * 1.0
}

// concat() is there to make copies instead of sorting in place
const threadTweetsSortedByScore = 
    threadTweetsAppropriateLength.concat().sort((a, b) => (a.thread_score < b.thread_score) ? 1 : -1)

const threadTweetsSortedByLastUpdatedDate = 
    threadTweetsAppropriateLength.concat().sort((a, b) => (a.last_updated_at < b.last_updated_at) ? 1 : -1)

// Generate JSON output
// -----------------------------------------

const filteredOutput = {
  account: {
    username: originalData.account[0].account.username,
    accountDisplayName: originalData.account[0].account.accountDisplayName,
    lastUpdated: new Date().getTime(),
  },
  tweets: [],
}

for (let i in threadTweetsSortedByScore) {
  const tweet = threadTweetsSortedByScore[i]

  const outputTweet = {
    'id_str': tweet.id_str,
    'full_text': tweet.full_text,
    'created_at': Date.parse(tweet.created_at),
    'last_updated_at': tweet.last_updated_at,

    'images_combined': tweet.images_combined.slice(0, MAXIMUM_IMAGE_COUNT_PER_THREAD),

    'thread_score': tweet.thread_score,
    'thread_length': tweet.thread_length,
    'retweet_count_combined': tweet.retweet_count_combined,
    'favorite_count_combined': tweet.favorite_count_combined,
  } 

  filteredOutput.tweets.push(outputTweet)
}

fs.writeFileSync('thread-list.json', 'const data = ' + JSON.stringify(filteredOutput, null, 2), 'utf8')

// Generate RSS (Atom) feed
// -----------------------------------------

const feed = new Feed({
  title: `${filteredOutput.account.accountDisplayName}’s Twitter threads`,
  description: `An automatically-generated list of Twitter threads from @${filteredOutput.account.username}`,
  generator: 'https://github.com/mwichary/twitter-thread-list',
})

for (let i in threadTweetsSortedByLastUpdatedDate) {
  const tweet = threadTweetsSortedByLastUpdatedDate[i]

  feed.addItem({
    title: tweet.full_text,
    content: `Thread with ${tweet.thread_length} tweets. ` + 
    `Created on ${new Date(tweet.created_at).toDateString()}, last updated on ${new Date(tweet.last_updated_at).toDateString()}.`,
    link: `https://twitter.com/${filteredOutput.account.username}/status/${tweet.id_str}`,
    date: new Date(tweet.last_updated_at)
  })
}
let feedOutput = feed.atom1()
fs.writeFileSync('thread-list.rss', feedOutput, 'utf8')

// Copy .html file
// -----------------------------------------

fs.copyFile(`${__dirname}/thread-list.html`, './thread-list.html', (err) => {} )

// Fin
// -----------------------------------------

console.log()
console.log('Thread list generated! Type `open thread-list.html` (on a Mac) to view it.')
