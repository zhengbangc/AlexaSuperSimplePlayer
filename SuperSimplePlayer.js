var lastPlayedByUser = {};
// var podcastURL = "https://feeds.soundcloud.com/stream/334797455-zhengbang-chen-533973568-60-bpm-beats-per-minute-metronome-click-track.mp3";
// http://feeds.soundcloud.com/stream/334844018-zhengbang-chen-533973568-180bpm.mp3
var podcastURLBase = "https://s3.amazonaws.com/zhengbangchen/bpms/";
var currentBPM = 60;
// Entry-point for the Lambda
exports.handler = function(event, context) {
    var player = new metronomeLite(event, context);
    player.handle();
};

// The metronomeLite has helpful routines for interacting with Alexa, within minimal overhead
var metronomeLite = function (event, context) {
    this.event = event;
    this.context = context;
};

// Handles an incoming Alexa request
metronomeLite.prototype.handle = function () {
    var requestType = this.event.request.type;
    var userId = this.event.context ? this.event.context.System.user.userId : this.event.session.user.userId;

    // On launch, we tell the user what they can do (Play audio :-))
    if (requestType === "LaunchRequest") {
        this.say("Welcome to metronome lite, your best tempo companion. Please give me some number of beats per minute. For example, you can ask metronome lite to play sixty beats per minute");

    // Handle Intents here - Play, Pause and Resume is all for now
    } else if (requestType === "IntentRequest") {
        var intent = this.event.request.intent;
        if (intent.name === "Play") {
            this.play(podcastURLBase + Math.ceil(currentBPM/5) * 5 + "bpm.mp3", 0, currentBPM);
        } else if (intent.name === "playNumberBPMIntent") {
            currentBPM = parseInt(intent.slots.numberBPM.value);
            if (currentBPM <= 180 && currentBPM >= 60) {
                this.play(podcastURLBase + Math.ceil(currentBPM/5) * 5 + "bpm.mp3", 0, currentBPM);
            }
            else
                this.say("Invalid input. Please ask metronome lite to play a number of BPM ranging from 60 to 180");
        } else if (intent.name === "playFasterIntent"){
            if (currentBPM + 5 > 180)
                currentBPM = 180;
            else 
                currentBPM = currentBPM + 5;
            this.play(podcastURLBase + Math.ceil(currentBPM/5) * 5 + "bpm.mp3", 0, currentBPM);
        } else if (intent.name === "playSlowerIntent"){
            if (currentBPM - 5 < 60)
                currentBPM = 60;
            else 
                currentBPM = currentBPM - 5;
            this.play(podcastURLBase + Math.ceil(currentBPM/5) * 5 + "bpm.mp3", 0, currentBPM);
        } else if (intent.name === "AMAZON.PauseIntent") {
            this.stop();
        } else if (intent.name === "AMAZON.ResumeIntent") {
            // var lastPlayed = this.loadLastPlayed(userId);
            // var offsetInMilliseconds = 0;
            // if (lastPlayed !== null) {
            //     offsetInMilliseconds = lastPlayed.request.offsetInMilliseconds;
            // }
            // this.play(podcastURL, offsetInMilliseconds);
            this.play(podcastURLBase + Math.ceil(currentBPM/5) * 5 + "bpm.mp3", 0, currentBPM);
        } else if (intent.name === "AMAZON.HelpIntent") {
            this.say("This metronome can play beats from 60 bpm to 180 bpm. The default is set to 60 bpm. Simply ask metronome lite to play some number of BPM within the range. Or you can ask metronome lite to play faster or slower. Immediately your beats will be ready for you.");
        } else if (intent.name === "AMAZON.CancelIntent") {
            this.stop();
        } else if (intent.name === "AMAZON.StopIntent") {
            this.stop();
        }
    } else if (requestType === "AudioPlayer.PlaybackStopped") {
        // We save off the PlaybackStopped Intent, so we know what was last playing
        this.saveLastPlayed(userId, this.event);
        // We respond with just true to acknowledge the request
        this.context.succeed(true);
    }
};

/**
 * Creates a proper Alexa response using Text-To-Speech
 * @param message
 * @param repromptMessage
 */
metronomeLite.prototype.say = function (message) {
    var response = {
        version: "1.0",
        response: {
            shouldEndSession: false,
            outputSpeech: {
                type: "SSML",
                ssml: "<speak> " + message + " </speak>"
            }
        }
    };
    this.context.succeed(response);
};

/**
 * Plays a particular track, from specific offset
 * @param audioURL The URL to play
 * @param offsetInMilliseconds The point from which to play - we set this to something other than zero when resuming
 */
metronomeLite.prototype.play = function (audioURL, offsetInMilliseconds, beatsPerMinute) {
    var response = {
        version: "1.0",
        response: {
            shouldEndSession: true,
            outputSpeech: {
                type: "SSML",
                ssml: "<speak> Playing " + beatsPerMinute + " beats per minute </speak>"
            },
            card: {
                type: "Simple",
                title: "Playing " + beatsPerMinute + " BPM",
                content: "You can ask Metronome Lite to play faster or slower. Or, you can ask metronome lite to play a different BPM."
            },
            directives: [
                {
                    type: "AudioPlayer.Play",
                    playBehavior: "REPLACE_ALL", // Setting to REPLACE_ALL means that this track will start playing immediately
                    audioItem: {
                        stream: {
                            url: audioURL,
                            token: "0", // Unique token for the track - needed when queueing multiple tracks
                            expectedPreviousToken: null, // The expected previous token - when using queues, ensures safety
                            offsetInMilliseconds: offsetInMilliseconds,
                            streamFormat: "AUDIO_MPEG"
                        }
                    }
                }
            ]
        }
    };

    this.context.succeed(response);
};

// Stops the playback of Audio
metronomeLite.prototype.stop = function () {
    var response = {
        version: "1.0",
        response: {
            shouldEndSession: true,
            directives: [
                {
                    type: "AudioPlayer.Stop"
                }
            ]
        }
    };

    this.context.succeed(response);
};

// Saves information into our super simple, not-production-grade cache
metronomeLite.prototype.saveLastPlayed = function (userId, lastPlayed) {
    lastPlayedByUser[userId] = lastPlayed;
};

// Load information from our super simple, not-production-grade cache
metronomeLite.prototype.loadLastPlayed = function (userId) {
    var lastPlayed = null;
    if (userId in lastPlayedByUser) {
        lastPlayed = lastPlayedByUser[userId];
    }
    return lastPlayed;
};
