# twitter-thread-list

A tool to generate a list of your most popular Twitter threads. 

[Here’s an example from my data](https://aresluna.org/twitter-threads).

You can use this to allow others access – or just for yourself for reflection or another form of archiving.

## Instructions

1. [Request your Twitter data](https://twitter.com/settings/your_twitter_data)  (this might take some time – you will get an email whenever that’s ready – so do this first).

2. [Install Node](https://nodejs.org/en/download/)

3. Run `npm install feed`.

4. Clone or copy this script to your computer.

5. Unpack your Twitter data once you got it.

6. Run the script by providing the directory where the files reside, e.g.: 

`node generate-thread-list.js /~/Downloads/twitter-2018-11-25-501cabffd3e92d9a0ff16656406`

## Result

Open `thread-list.html` in your browser.

**OR**

Get the generated `thread-list.json` or `thread-list.rss` and use them in some other way.

## Version history

- 1.02 Use smaller images for better performance
- 1.01 Add RSS (Atom) support
- 1.00 Initial release
