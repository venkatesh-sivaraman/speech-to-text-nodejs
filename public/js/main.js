(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "name": "SpeechToTextBrowserStarterApp",
  "version": "0.2.1",
  "description": "A sample browser app for Bluemix that use the speech-to-text service, fetching a token via Node.js",
  "dependencies": {
    "body-parser": "~1.10.2",
    "connect": "^3.3.5",
    "errorhandler": "~1.2.4",
    "express": "~4.10.8",
    "harmon": "^1.3.1",
    "http-proxy": "^1.11.1",
    "request": "~2.53.0",
    "transformer-proxy": "^0.3.1"
  },
  "engines": {
    "node": ">=0.10"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/watson-developer-cloud/speech-to-text-browser.git"
  },
  "author": "IBM Corp.",
  "browserify-shim": {
    "jquery": "global:jQuery"
  },
  "browserify": {
    "transform": [
      "browserify-shim"
    ]
  },
  "contributors": [
    {
      "name": "German Attanasio Ruiz",
      "email": "germanatt@us.ibm.com"
    },
    {
      "name": "Daniel Bolano",
      "email": "dbolano@us.ibm.com"
    },
    {
      "name": "Britany L. Ponvelle",
      "email": "blponvelle@us.ibm.com"
    },
    {
      "name": "Eric S. Bullington",
      "email": "esbullin@us.ibm.com"
    }
  ],
  "license": "Apache-2.0",
  "bugs": {
    "url": "https://github.com/watson-developer-cloud/speech-to-text-browser/issues"
  },
  "scripts": {
    "start": "node app.js",
    "build": "browserify -o public/js/main.js src/index.js",
    "watch": "watchify -v -d -o public/js/main.js src/index.js"
  },
  "devDependencies": {
    "browserify": "^10.2.4",
    "browserify-shim": "^3.8.9",
    "watchify": "^3.2.3"
  }
}

},{}],2:[function(require,module,exports){
/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var utils = require('./utils');
/**
 * Captures microphone input from the browser.
 * Works at least on latest versions of Firefox and Chrome
 */
function Microphone(_options) {
  var options = _options || {};

  // we record in mono because the speech recognition service
  // does not support stereo.
  this.bufferSize = options.bufferSize || 8192;
  this.inputChannels = options.inputChannels || 1;
  this.outputChannels = options.outputChannels || 1;
  this.recording = false;
  this.requestedAccess = false;
  this.sampleRate = 16000;
  // auxiliar buffer to keep unused samples (used when doing downsampling)
  this.bufferUnusedSamples = new Float32Array(0);

  // Chrome or Firefox or IE User media
  if (!navigator.getUserMedia) {
    navigator.getUserMedia = navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia;
  }

}

/**
 * Called when the user reject the use of the michrophone
 * @param  error The error
 */
Microphone.prototype.onPermissionRejected = function() {
  console.log('Microphone.onPermissionRejected()');
  this.requestedAccess = false;
  this.onError('Permission to access the microphone rejeted.');
};

Microphone.prototype.onError = function(error) {
  console.log('Microphone.onError():', error);
};

/**
 * Called when the user authorizes the use of the microphone.
 * @param  {Object} stream The Stream to connect to
 *
 */
Microphone.prototype.onMediaStream =  function(stream) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx)
    throw new Error('AudioContext not available');

  if (!this.audioContext)
    this.audioContext = new AudioCtx();

  var gain = this.audioContext.createGain();
  var audioInput = this.audioContext.createMediaStreamSource(stream);

  audioInput.connect(gain);

  this.mic = this.audioContext.createScriptProcessor(this.bufferSize,
    this.inputChannels, this.outputChannels);

  // uncomment the following line if you want to use your microphone sample rate
  //this.sampleRate = this.audioContext.sampleRate;
  console.log('Microphone.onMediaStream(): sampling rate is:', this.sampleRate);

  this.mic.onaudioprocess = this._onaudioprocess.bind(this);
  this.stream = stream;

  gain.connect(this.mic);
  this.mic.connect(this.audioContext.destination);
  this.recording = true;
  this.requestedAccess = false;
  this.onStartRecording();
};

/**
 * callback that is being used by the microphone
 * to send audio chunks.
 * @param  {object} data audio
 */
Microphone.prototype._onaudioprocess = function(data) {
  if (!this.recording) {
    // We speak but we are not recording
    return;
  }

  // Single channel
  var chan = data.inputBuffer.getChannelData(0);

  this.onAudio(this._exportDataBufferTo16Khz(new Float32Array(chan)));

  //export with microphone mhz, remember to update the this.sampleRate
  // with the sample rate from your microphone
  // this.onAudio(this._exportDataBuffer(new Float32Array(chan)));

};

/**
 * Start the audio recording
 */
Microphone.prototype.record = function() {
  if (!navigator.getUserMedia){
    this.onError('Browser doesn\'t support microphone input');
    return;
  }
  if (this.requestedAccess) {
    return;
  }

  this.requestedAccess = true;
  navigator.getUserMedia({ audio: true },
    this.onMediaStream.bind(this), // Microphone permission granted
    this.onPermissionRejected.bind(this)); // Microphone permission rejected
};

/**
 * Stop the audio recording
 */
Microphone.prototype.stop = function() {
  if (!this.recording)
    return;
  this.recording = false;
  this.stream.stop();
  this.requestedAccess = false;
  this.mic.disconnect(0);
  this.mic = null;
  this.onStopRecording();
};

/**
 * Creates a Blob type: 'audio/l16' with the chunk and downsampling to 16 kHz
 * coming from the microphone.
 * Explanation for the math: The raw values captured from the Web Audio API are
 * in 32-bit Floating Point, between -1 and 1 (per the specification).
 * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
 * Multiply to control the volume of the output. We store in little endian.
 * @param  {Object} buffer Microphone audio chunk
 * @return {Blob} 'audio/l16' chunk
 * @deprecated This method is depracated
 */
Microphone.prototype._exportDataBufferTo16Khz = function(bufferNewSamples) {
  var buffer = null,
    newSamples = bufferNewSamples.length,
    unusedSamples = this.bufferUnusedSamples.length;

  if (unusedSamples > 0) {
    buffer = new Float32Array(unusedSamples + newSamples);
    for (var i = 0; i < unusedSamples; ++i) {
      buffer[i] = this.bufferUnusedSamples[i];
    }
    for (i = 0; i < newSamples; ++i) {
      buffer[unusedSamples + i] = bufferNewSamples[i];
    }
  } else {
    buffer = bufferNewSamples;
  }

  // downsampling variables
  var filter = [
      -0.037935, -0.00089024, 0.040173, 0.019989, 0.0047792, -0.058675, -0.056487,
      -0.0040653, 0.14527, 0.26927, 0.33913, 0.26927, 0.14527, -0.0040653, -0.056487,
      -0.058675, 0.0047792, 0.019989, 0.040173, -0.00089024, -0.037935
    ],
    samplingRateRatio = this.audioContext.sampleRate / 16000,
    nOutputSamples = Math.floor((buffer.length - filter.length) / (samplingRateRatio)) + 1,
    pcmEncodedBuffer16k = new ArrayBuffer(nOutputSamples * 2),
    dataView16k = new DataView(pcmEncodedBuffer16k),
    index = 0,
    volume = 0x7FFF, //range from 0 to 0x7FFF to control the volume
    nOut = 0;

  for (var i = 0; i + filter.length - 1 < buffer.length; i = Math.round(samplingRateRatio * nOut)) {
    var sample = 0;
    for (var j = 0; j < filter.length; ++j) {
      sample += buffer[i + j] * filter[j];
    }
    sample *= volume;
    dataView16k.setInt16(index, sample, true); // 'true' -> means little endian
    index += 2;
    nOut++;
  }

  var indexSampleAfterLastUsed = Math.round(samplingRateRatio * nOut);
  var remaining = buffer.length - indexSampleAfterLastUsed;
  if (remaining > 0) {
    this.bufferUnusedSamples = new Float32Array(remaining);
    for (i = 0; i < remaining; ++i) {
      this.bufferUnusedSamples[i] = buffer[indexSampleAfterLastUsed + i];
    }
  } else {
    this.bufferUnusedSamples = new Float32Array(0);
  }

  return new Blob([dataView16k], {
    type: 'audio/l16'
  });
  };

/**
 * Creates a Blob type: 'audio/l16' with the
 * chunk coming from the microphone.
 */
var exportDataBuffer = function(buffer, bufferSize) {
  var pcmEncodedBuffer = null,
    dataView = null,
    index = 0,
    volume = 0x7FFF; //range from 0 to 0x7FFF to control the volume

  pcmEncodedBuffer = new ArrayBuffer(bufferSize * 2);
  dataView = new DataView(pcmEncodedBuffer);

  /* Explanation for the math: The raw values captured from the Web Audio API are
   * in 32-bit Floating Point, between -1 and 1 (per the specification).
   * The values for 16-bit PCM range between -32768 and +32767 (16-bit signed integer).
   * Multiply to control the volume of the output. We store in little endian.
   */
  for (var i = 0; i < buffer.length; i++) {
    dataView.setInt16(index, buffer[i] * volume, true);
    index += 2;
  }

  // l16 is the MIME type for 16-bit PCM
  return new Blob([dataView], { type: 'audio/l16' });
};

Microphone.prototype._exportDataBuffer = function(buffer){
  utils.exportDataBuffer(buffer, this.bufferSize);
}; 


// Functions used to control Microphone events listeners.
Microphone.prototype.onStartRecording =  function() {};
Microphone.prototype.onStopRecording =  function() {};
Microphone.prototype.onAudio =  function() {};

module.exports = Microphone;


},{"./utils":7}],3:[function(require,module,exports){
module.exports={
   "models": [
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-US_BroadbandModel", 
         "rate": 16000, 
         "name": "en-US_BroadbandModel", 
         "language": "en-US", 
         "description": "US English broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/en-US_NarrowbandModel", 
         "rate": 8000, 
         "name": "en-US_NarrowbandModel", 
         "language": "en-US", 
         "description": "US English narrowband model (8KHz)"
      },
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/es-ES_BroadbandModel", 
         "rate": 16000, 
         "name": "es-ES_BroadbandModel", 
         "language": "es-ES", 
         "description": "Spanish broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/es-ES_NarrowbandModel", 
         "rate": 8000, 
         "name": "es-ES_NarrowbandModel", 
         "language": "es-ES", 
         "description": "Spanish narrowband model (8KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ja-JP_BroadbandModel", 
         "rate": 16000, 
         "name": "ja-JP_BroadbandModel", 
         "language": "ja-JP", 
         "description": "Japanese broadband model (16KHz)"
      }, 
      {
         "url": "https://stream.watsonplatform.net/speech-to-text/api/v1/models/ja-JP_NarrowbandModel", 
         "rate": 8000, 
         "name": "ja-JP_NarrowbandModel", 
         "language": "ja-JP", 
         "description": "Japanese narrowband model (8KHz)"
      }
   ]
}

},{}],4:[function(require,module,exports){

var effects = require('./views/effects');
var display = require('./views/displaymetadata');
var hideError = require('./views/showerror').hideError;
var initSocket = require('./socket').initSocket;

exports.handleFileUpload = function(token, model, file, contentType, callback, onend) {

    // Set currentlyDisplaying to prevent other sockets from opening
    localStorage.setItem('currentlyDisplaying', true);

    // $('#progressIndicator').css('visibility', 'visible');

    $.subscribe('progress', function(evt, data) {
      console.log('progress: ', data);
    });

    console.log('contentType', contentType);

    var baseString = '';
    var baseJSON = '';

    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': contentType,
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    options.model = model;

    function onOpen(socket) {
      console.log('Socket opened');
    }

    function onListening(socket) {
      console.log('Socket listening');
      callback(socket);
    }

    function onMessage(msg) {
      if (msg.results) {
        // Convert to closure approach
        baseString = display.showResult(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
    }

    function onError(evt) {
      localStorage.setItem('currentlyDisplaying', false);
      onend(evt);
      console.log('Socket err: ', evt.code);
    }

    function onClose(evt) {
      localStorage.setItem('currentlyDisplaying', false);
      onend(evt);
      console.log('Socket closing: ', evt);
    }

    initSocket(options, onOpen, onListening, onMessage, onError, onClose);

  }

},{"./socket":6,"./views/displaymetadata":9,"./views/effects":11,"./views/showerror":18}],5:[function(require,module,exports){

'use strict';

var initSocket = require('./socket').initSocket;
var display = require('./views/displaymetadata');

exports.handleMicrophone = function(token, model, mic, callback) {

  if (model.indexOf('Narrowband') > -1) {
    var err = new Error('Microphone transcription cannot accomodate narrowband models, please select another');
    callback(err, null);
    return false;
  }

  $.publish('clearscreen');

  // Test out websocket
  var baseString = '';
  var baseJSON = '';

  var options = {};
  options.token = token;
  options.message = {
    'action': 'start',
    'content-type': 'audio/l16;rate=16000',
    'interim_results': true,
    'continuous': true,
    'word_confidence': true,
    'timestamps': true,
    'max_alternatives': 3
  };
  options.model = model;

  function onOpen(socket) {
    console.log('Mic socket: opened');
    callback(null, socket);
  }

  function onListening(socket) {

    mic.onAudio = function(blob) {
      if (socket.readyState < 2) {
        socket.send(blob)
      }
    };
  }

  function onMessage(msg, socket) {
    console.log('Mic socket msg: ', msg);
    if (msg.results) {
      // Convert to closure approach
      baseString = display.showResult(msg, baseString);
      baseJSON = display.showJSON(msg, baseJSON);
    }
  }

  function onError(r, socket) {
    console.log('Mic socket err: ', err);
  }

  function onClose(evt) {
    console.log('Mic socket close: ', evt);
  }

  initSocket(options, onOpen, onListening, onMessage, onError, onClose);

}

},{"./socket":6,"./views/displaymetadata":9}],6:[function(require,module,exports){
/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global $:false */


var utils = require('./utils');
var Microphone = require('./Microphone');
var showerror = require('./views/showerror');
var showError = showerror.showError;
var hideError = showerror.hideError;

// Mini WS callback API, so we can initialize
// with model and token in URI, plus
// start message

// Initialize closure, which holds maximum getToken call count
var tokenGenerator = utils.createTokenGenerator();

var initSocket = exports.initSocket = function(options, onopen, onlistening, onmessage, onerror, onclose) {
  var listening;
  function withDefault(val, defaultVal) {
    return typeof val === 'undefined' ? defaultVal : val;
  }
  var socket;
  var token = options.token;
  var model = options.model || localStorage.getItem('currentModel');
  var message = options.message || {'action': 'start'};
  var sessionPermissions = withDefault(options.sessionPermissions, JSON.parse(localStorage.getItem('sessionPermissions')));
  var sessionPermissionsQueryParam = sessionPermissions ? '0' : '1';
  var url = options.serviceURI || 'wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token='
    + token
    + '&X-WDC-PL-OPT-OUT=' + sessionPermissionsQueryParam
    + '&model=' + model;
  console.log('URL model', model);
  try {
    socket = new WebSocket(url);
  } catch(err) {
    console.error('WS connection error: ', err);
  }
  socket.onopen = function(evt) {
    listening = false;
    $.subscribe('hardsocketstop', function(data) {
      console.log('MICROPHONE: close.');
      socket.send(JSON.stringify({action:'stop'}));
    });
    $.subscribe('socketstop', function(data) {
      console.log('MICROPHONE: close.');
      socket.close();
    });
    socket.send(JSON.stringify(message));
    onopen(socket);
  };
  socket.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg.error) {
      showError(msg.error);
      $.publish('hardsocketstop');
      return;
    }
    if (msg.state === 'listening') {
      // Early cut off, without notification
      if (!listening) {
        onlistening(socket);
        listening = true;
      } else {
        console.log('MICROPHONE: Closing socket.');
        socket.close();
      }
    }
    onmessage(msg, socket);
  };

  socket.onerror = function(evt) {
    console.log('WS onerror: ', evt);
    showError('Application error ' + evt.code + ': please refresh your browser and try again');
    $.publish('clearscreen');
    onerror(evt);
  };

  socket.onclose = function(evt) {
    console.log('WS onclose: ', evt);
    if (evt.code === 1006) {
      // Authentication error, try to reconnect
      console.log('generator count', tokenGenerator.getCount());
      if (tokenGenerator.getCount() > 1) {
        $.publish('hardsocketstop');
        throw new Error("No authorization token is currently available");
      }
      tokenGenerator.getToken(function(token, err) {
        if (err) {
          $.publish('hardsocketstop');
          return false;
        }
        console.log('Fetching additional token...');
        options.token = token;
        initSocket(options, onopen, onlistening, onmessage, onerror, onclose);
      });
      return false;
    }
    if (evt.code === 1011) {
      console.error('Server error ' + evt.code + ': please refresh your browser and try again');
      return false;
    }
    if (evt.code > 1000) {
      console.error('Server error ' + evt.code + ': please refresh your browser and try again');
      // showError('Server error ' + evt.code + ': please refresh your browser and try again');
      return false;
    }
    // Made it through, normal close
    $.unsubscribe('hardsocketstop');
    $.unsubscribe('socketstop');
    onclose(evt);
  };

}
},{"./Microphone":2,"./utils":7,"./views/showerror":18}],7:[function(require,module,exports){
(function (global){

// For non-view logic
var $ = (typeof window !== "undefined" ? window.jQuery : typeof global !== "undefined" ? global.jQuery : null);

var fileBlock = function(_offset, length, _file, readChunk) {
  var r = new FileReader();
  var blob = _file.slice(_offset, length + _offset);
  r.onload = readChunk;
  r.readAsArrayBuffer(blob);
}

// Based on alediaferia's SO response
// http://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
exports.onFileProgress = function(options, ondata, onerror, onend) {
  var file       = options.file;
  var fileSize   = file.size;
  var chunkSize  = options.bufferSize || 8192;
  var offset     = 0;
  var readChunk = function(evt) {
    if (offset >= fileSize) {
      console.log("Done reading file");
      onend();
      return;
    }
    if (evt.target.error == null) {
      var buffer = evt.target.result;
      var len = buffer.byteLength;
      offset += len;
      ondata(buffer); // callback for handling read chunk
    } else {
      var errorMessage = evt.target.error;
      console.log("Read error: " + errorMessage);
      onerror(errorMessage);
      return;
    }
    fileBlock(offset, chunkSize, file, readChunk);
  }
  fileBlock(offset, chunkSize, file, readChunk);
}

exports.createTokenGenerator = function() {
  // Make call to API to try and get token
  var hasBeenRunTimes = 0;
  return {
    getToken: function(callback) {
    ++hasBeenRunTimes;
    if (hasBeenRunTimes > 5) {
      var err = new Error('Cannot reach server');
      callback(null, err);
      return;
    }
    var url = '/token';
    var tokenRequest = new XMLHttpRequest();
    tokenRequest.open("GET", url, true);
    tokenRequest.onload = function(evt) {
      var token = tokenRequest.responseText;
      callback(token);
    };
    tokenRequest.send();
    },
    getCount: function() { return hasBeenRunTimes; }
  }
};

exports.getToken = (function() {
  // Make call to API to try and get token
  var hasBeenRunTimes = 0;
  return function(callback) {
    hasBeenRunTimes++
    if (hasBeenRunTimes > 5) {
      var err = new Error('Cannot reach server');
      callback(null, err);
      return;
    }
    var url = '/token';
    var tokenRequest = new XMLHttpRequest();
    tokenRequest.open("GET", url, true);
    tokenRequest.onload = function(evt) {
      var token = tokenRequest.responseText;
      callback(token);
    };
    tokenRequest.send();
  }
})();

exports.initPubSub = function() {
  var o         = $({});
  $.subscribe   = o.on.bind(o);
  $.unsubscribe = o.off.bind(o);
  $.publish     = o.trigger.bind(o);
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],8:[function(require,module,exports){


exports.initAnimatePanel = function() {
  $('.panel-heading span.clickable').on("click", function (e) {
    if ($(this).hasClass('panel-collapsed')) {
      // expand the panel
      $(this).parents('.panel').find('.panel-body').slideDown();
      $(this).removeClass('panel-collapsed');
      $(this).find('i').removeClass('caret-down').addClass('caret-up');
    }
    else {
      // collapse the panel
      $(this).parents('.panel').find('.panel-body').slideUp();
      $(this).addClass('panel-collapsed');
      $(this).find('i').removeClass('caret-up').addClass('caret-down');
    }
  });
}


},{}],9:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window.jQuery : typeof global !== "undefined" ? global.jQuery : null);
var scrolled = false;

var showTimestamp = function(timestamps, confidences) {
  var word = timestamps[0],
      t0 = timestamps[1],
      t1 = timestamps[2];
  var timelength = t1 - t0;
  // Show confidence if defined, else 'n/a'
  var displayConfidence = confidences ? confidences[1].toString().substring(0, 3) : 'n/a';
  $('#metadataTable > tbody:last-child').append(
      '<tr>'
      + '<td>' + word + '</td>'
      + '<td>' + t0 + '</td>'
      + '<td>' + t1 + '</td>'
      + '<td>' + displayConfidence + '</td>'
      + '</tr>'
      );
}


var showMetaData = function(alternative) {
  var confidenceNestedArray = alternative.word_confidence;;
  var timestampNestedArray = alternative.timestamps;
  if (confidenceNestedArray && confidenceNestedArray.length > 0) {
    for (var i = 0; i < confidenceNestedArray.length; i++) {
      var timestamps = timestampNestedArray[i];
      var confidences = confidenceNestedArray[i];
      showTimestamp(timestamps, confidences);
    }
    return;
  } else {
    if (timestampNestedArray && timestampNestedArray.length > 0) {
      timestampNestedArray.forEach(function(timestamp) {
        showTimestamp(timestamp);
      });
    }
  }
}

var Alternatives = function(){

  var stringOne = '',
    stringTwo = '',
    stringThree = '';

  this.clearString = function() {
    stringOne = '';
    stringTwo = '';
    stringThree = '';
  };

  this.showAlternatives = function(alternatives, isFinal, testing) {
    var $hypotheses = $('.hypotheses ol');
    $hypotheses.empty();
    // $hypotheses.append($('</br>'));
    alternatives.forEach(function(alternative, idx) {
      var $alternative;
      if (alternative.transcript) {
        console.log('ALTERNATIVES INDEX', idx);
        var transcript = alternative.transcript.replace(/%HESITATION\s/g, '');
        transcript = transcript.replace(/(.)\1{2,}/g, '');
        switch (idx) {
          case 0:
            stringOne = stringOne + transcript;
            $alternative = $('<li data-hypothesis-index=' + idx + ' >' + stringOne + '</li>');
            break;
          case 1:
            stringTwo = stringTwo + transcript;
            $alternative = $('<li data-hypothesis-index=' + idx + ' >' + stringTwo + '</li>');
            break;
          case 2:
            stringThree = stringThree + transcript;
            $alternative = $('<li data-hypothesis-index=' + idx + ' >' + stringThree + '</li>');
            break;
        }
        $hypotheses.append($alternative);
      }
    });
  };
}

var alternativePrototype = new Alternatives();

// TODO: Convert to closure approach
var processString = function(baseString, isFinished) {

  if (isFinished) {
    var formattedString = baseString.slice(0, -1);
    formattedString = formattedString.charAt(0).toUpperCase() + formattedString.substring(1);
    formattedString = formattedString.trim() + '.';
    $('#resultsText').val(formattedString);
  } else {
    $('#resultsText').val(baseString);
  }

}

exports.showJSON = function(msg, baseJSON) {
  var json = JSON.stringify(msg, null, 2);
  baseJSON += json;
  baseJSON += '\n';
  $('#resultsJSON').val(baseJSON);
  return baseJSON;
}

function updateScroll(){
    if(!scrolled){
        var element = $('.table-scroll').get(0);
        element.scrollTop = element.scrollHeight;
    }
}

var initScroll = function() {
  $('.table-scroll').on('scroll', function(){
      scrolled=true;
  });
}


exports.showResult = function(msg, baseString, callback) {

  var idx = +msg.result_index;

  if (msg.results && msg.results.length > 0) {

    var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    //Capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      baseString += text;
      var displayFinalString = baseString;
      displayFinalString = displayFinalString.replace(/%HESITATION\s/g, '');
      displayFinalString = displayFinalString.replace(/(.)\1{2,}/g, '');
      processString(displayFinalString, true);
      showMetaData(alternatives[0]);
      // Only show alternatives if we're final
      alternativePrototype.showAlternatives(alternatives);
    } else {
      var tempString = baseString + text;
      tempString = tempString.replace(/%HESITATION\s/g, '');
      tempString = tempString.replace(/(.)\1{2,}/g, '');
      processString(tempString, false);
    }
  }

  updateScroll();

  return baseString;

};

$.subscribe('clearscreen', function() {
  var $hypotheses = $('.hypotheses ul');
  scrolled = false;
  $hypotheses.empty();
  alternativePrototype.clearString();
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){

'use strict';

var handleSelectedFile = require('./fileupload').handleSelectedFile;

exports.initDragDrop = function(ctx) {

  var dragAndDropTarget = $(document);

  dragAndDropTarget.on('dragenter', function (e) {
    e.stopPropagation();
    e.preventDefault();
  });

  dragAndDropTarget.on('dragover', function (e) {
    e.stopPropagation();
    e.preventDefault();
  });

  dragAndDropTarget.on('drop', function (e) {
    console.log('File dropped');
    e.preventDefault();
    var evt = e.originalEvent;
    // Handle dragged file event
    handleFileUploadEvent(evt);
  });

  function handleFileUploadEvent(evt) {
    // Init file upload with default model
    var file = evt.dataTransfer.files[0];
    handleSelectedFile(ctx.token, file);
  }

}

},{"./fileupload":12}],11:[function(require,module,exports){



exports.flashSVG = function(el) {
  el.css({ fill: '#A53725' });
  function loop() {
    el.animate({ fill: '#A53725' },
        1000, 'linear')
      .animate({ fill: 'white' },
          1000, 'linear');
  }
  // return timer
  var timer = setTimeout(loop, 2000);
  return timer;
};

exports.stopFlashSVG = function(timer) {
  el.css({ fill: 'white' } );
  clearInterval(timer);
}

exports.toggleImage = function(el, name) {
  if(el.attr('src') === 'images/' + name + '.svg') {
    el.attr("src", 'images/stop-red.svg');
  } else {
    el.attr('src', 'images/stop.svg');
  }
}

var restoreImage = exports.restoreImage = function(el, name) {
  el.attr('src', 'images/' + name + '.svg');
}

exports.stopToggleImage = function(timer, el, name) {
  clearInterval(timer);
  restoreImage(el, name);
}

},{}],12:[function(require,module,exports){

'use strict';

var showError = require('./showerror').showError;
var showNotice = require('./showerror').showNotice;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var effects = require('./effects');
var utils = require('../utils');

// Need to remove the view logic here and move this out to the handlefileupload controller
var handleSelectedFile = exports.handleSelectedFile = (function() {

    var running = false;
    localStorage.setItem('currentlyDisplaying', false);

    return function(token, file) {

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    // if (currentlyDisplaying) {
    //   showError('Currently another file is playing, please stop the file or wait until it finishes');
    //   return;
    // }

    $.publish('clearscreen');

    localStorage.setItem('currentlyDisplaying', true);
    running = true;

    // Visual effects
    var uploadImageTag = $('#fileUploadTarget > img');
    var timer = setInterval(effects.toggleImage, 750, uploadImageTag, 'stop');
    var uploadText = $('#fileUploadTarget > span');
    uploadText.text('Stop Transcribing');

    function restoreUploadTab() {
      clearInterval(timer);
      effects.restoreImage(uploadImageTag, 'upload');
      uploadText.text('Select File');
    }

    // Clear flashing if socket upload is stopped
    $.subscribe('hardsocketstop', function(data) {
      restoreUploadTab();
    });


    // Get current model
    var currentModel = localStorage.getItem('currentModel');
    console.log('currentModel', currentModel);

    // Read first 4 bytes to determine header
    var blobToText = new Blob([file]).slice(0, 4);
    var r = new FileReader();
    r.readAsText(blobToText);
    r.onload = function() {
      var contentType;
      if (r.result === 'fLaC') {
        contentType = 'audio/flac';
        showNotice('Notice: browsers do not support playing FLAC audio, so no audio will accompany the transcription');
      } else if (r.result === 'RIFF') {
        contentType = 'audio/wav';
        var audio = new Audio();
        var wavBlob = new Blob([file], {type: 'audio/wav'});
        var wavURL = URL.createObjectURL(wavBlob);
        audio.src = wavURL;
        audio.play();
        $.subscribe('hardsocketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
      } else {
        restoreUploadTab();
        showError('Only WAV or FLAC files can be transcribed, please try another file format');
        return;
      }
      handleFileUpload(token, currentModel, file, contentType, function(socket) {
        var blob = new Blob([file]);
        var parseOptions = {
          file: blob
        };
        utils.onFileProgress(parseOptions,
          // On data chunk
          function(chunk) {
            socket.send(chunk);
          },
          // On file read error
          function(evt) {
            console.log('Error reading file: ', evt.message);
            showError('Error: ' + evt.message);
          },
          // On load end
          function() {
            socket.send(JSON.stringify({'action': 'stop'}));
          });
      }, 
        function(evt) {
          effects.stopToggleImage(timer, uploadImageTag, 'upload');
          uploadText.text('Select File');
          localStorage.setItem('currentlyDisplaying', false);
        }
      );
    };
  }
})();


exports.initFileUpload = function(ctx) {

  var fileUploadDialog = $("#fileUploadDialog");

  fileUploadDialog.change(function(evt) {
    var file = fileUploadDialog.get(0).files[0];
    handleSelectedFile(ctx.token, file);
  });

  $("#fileUploadTarget").click(function(evt) {

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    if (currentlyDisplaying) {
      console.log('HARD SOCKET STOP');
      $.publish('hardsocketstop');
      localStorage.setItem('currentlyDisplaying', false);
      return;
    }

    fileUploadDialog.val(null);

    fileUploadDialog
    .trigger('click');

  });

}
},{"../handlefileupload":4,"../utils":7,"./effects":11,"./showerror":18}],13:[function(require,module,exports){

var initSessionPermissions = require('./sessionpermissions').initSessionPermissions;
var initSelectModel = require('./selectmodel').initSelectModel;
var initAnimatePanel = require('./animatepanel').initAnimatePanel;
var initShowTab = require('./showtab').initShowTab;
var initDragDrop = require('./dragdrop').initDragDrop;
var initPlaySample = require('./playsample').initPlaySample;
var initRecordButton = require('./recordbutton').initRecordButton;
var initFileUpload = require('./fileupload').initFileUpload;


exports.initViews = function(ctx) {
  console.log('Initializing views...');
  initSelectModel(ctx);
  initPlaySample(ctx);
  initDragDrop(ctx);
  initRecordButton(ctx);
  initFileUpload(ctx);
  initSessionPermissions();
  initShowTab();
  initAnimatePanel();
  initShowTab();
}
},{"./animatepanel":8,"./dragdrop":10,"./fileupload":12,"./playsample":14,"./recordbutton":15,"./selectmodel":16,"./sessionpermissions":17,"./showtab":19}],14:[function(require,module,exports){

'use strict';

var utils = require('../utils');
var onFileProgress = utils.onFileProgress;
var handleFileUpload = require('../handlefileupload').handleFileUpload;
var initSocket = require('../socket').initSocket;
var showError = require('./showerror').showError;
var effects = require('./effects');


var LOOKUP_TABLE = {
  'en-US_BroadbandModel': ['Us_English_Broadband_Sample_1.wav', 'Us_English_Broadband_Sample_2.wav'],
  'en-US_NarrowbandModel': ['Us_English_Narrowband_Sample_1.wav', 'Us_English_Narrowband_Sample_2.wav'],
  'es-ES_BroadbandModel': ['Es_ES_spk24_16khz.wav', 'Es_ES_spk19_16khz.wav'],
  'es-ES_NarrowbandModel': ['Es_ES_spk24_8khz.wav', 'Es_ES_spk19_8khz.wav'],
  'ja-JP_BroadbandModel': ['sample-Ja_JP-wide1.wav', 'sample-Ja_JP-wide2.wav'],
  'ja-JP_NarrowbandModel': ['sample-Ja_JP-narrow3.wav', 'sample-Ja_JP-narrow4.wav']
};

var playSample = (function() {

  var running = false;
  localStorage.setItem('currentlyDisplaying', false);

  return function(token, imageTag, iconName, url, callback) {

    $.publish('clearscreen');

    var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

    console.log('CURRENTLY DISPLAYING', currentlyDisplaying);

    // This error handling needs to be expanded to accomodate
    // the two different play samples files
    if (currentlyDisplaying) {
      console.log('HARD SOCKET STOP');
      $.publish('socketstop');
      localStorage.setItem('currentlyDisplaying', false);
      effects.stopToggleImage(timer, imageTag, iconName);
      effects.restoreImage(imageTag, iconName);
      running = false;
      return;
    }

    if (currentlyDisplaying && running) {
      showError('Currently another file is playing, please stop the file or wait until it finishes');
      return;
    }

    localStorage.setItem('currentlyDisplaying', true);
    running = true;

    var timer = setInterval(effects.toggleImage, 750, imageTag, iconName);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
      var blob = xhr.response;
      var currentModel = localStorage.getItem('currentModel') || 'en-US_BroadbandModel';
      var reader = new FileReader();
      var blobToText = new Blob([blob]).slice(0, 4);
      reader.readAsText(blobToText);
      reader.onload = function() {
        var contentType = reader.result === 'fLaC' ? 'audio/flac' : 'audio/wav';
        console.log('Uploading file', reader.result);
        var mediaSourceURL = URL.createObjectURL(blob);
        var audio = new Audio();
        audio.src = mediaSourceURL;
        audio.play();
        $.subscribe('hardsocketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
        $.subscribe('socketstop', function() {
          audio.pause();
          audio.currentTime = 0;
        });
        handleFileUpload(token, currentModel, blob, contentType, function(socket) {
          var parseOptions = {
            file: blob
          };
          onFileProgress(parseOptions,
            // On data chunk
            function(chunk) {
              socket.send(chunk);
            },
            // On file read error
            function(evt) {
              console.log('Error reading file: ', evt.message);
              // showError(evt.message);
            },
            // On load end
            function() {
              socket.send(JSON.stringify({'action': 'stop'}));
            });
        }, 
        // On connection end
          function(evt) {
            effects.stopToggleImage(timer, imageTag, iconName);
            effects.restoreImage(imageTag, iconName);
            localStorage.getItem('currentlyDisplaying', false);
          }
        );
      };
    };
    xhr.send();
  };
})();


exports.initPlaySample = function(ctx) {

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][0];
    var el = $('.play-sample-1');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function(evt) {
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE);

  (function() {
    var fileName = 'audio/' + LOOKUP_TABLE[ctx.currentModel][1];
    var el = $('.play-sample-2');
    el.off('click');
    var iconName = 'play';
    var imageTag = el.find('img');
    el.click( function(evt) {
      playSample(ctx.token, imageTag, iconName, fileName, function(result) {
        console.log('Play sample result', result);
      });
    });
  })(ctx, LOOKUP_TABLE);

};
},{"../handlefileupload":4,"../socket":6,"../utils":7,"./effects":11,"./showerror":18}],15:[function(require,module,exports){

'use strict';

var Microphone = require('../Microphone');
var handleMicrophone = require('../handlemicrophone').handleMicrophone;
var showError = require('./showerror').showError;

exports.initRecordButton = function(ctx) {

  var recordButton = $('#recordButton');

  recordButton.click((function() {

    var running = false;
    var token = ctx.token;
    var micOptions = {
      bufferSize: ctx.buffersize
    };
    var mic = new Microphone(micOptions);

    return function(evt) {
      // Prevent default anchor behavior
      evt.preventDefault();

      var currentModel = localStorage.getItem('currentModel');
      var currentlyDisplaying = JSON.parse(localStorage.getItem('currentlyDisplaying'));

      if (currentlyDisplaying) {
        showError('Currently another file is playing, please stop the file or wait until it finishes');
        return;
      }

      if (!running) {
        console.log('Not running, handleMicrophone()');
        handleMicrophone(token, currentModel, mic, function(err, socket) {
          if (err) {
            var msg = 'Error: ' + err.message;
            console.log(msg);
            showError(msg);
            running = false;
          } else {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'images/stop.svg');
            console.log('starting mic');
            mic.record();
            running = true;
          }
        });
      } else {
        console.log('Stopping microphone, sending stop action message');
        recordButton.removeAttr('style');
        recordButton.find('img').attr('src', 'images/microphone.svg');
        $.publish('hardsocketstop');
        mic.stop();
        running = false;
      }
    }
  })());
}
},{"../Microphone":2,"../handlemicrophone":5,"./showerror":18}],16:[function(require,module,exports){

var initPlaySample = require('./playsample').initPlaySample;

exports.initSelectModel = function(ctx) {

  function isDefault(model) {
    return model === 'en-US_BroadbandModel';
  }

  ctx.models.forEach(function(model) {
    $("#dropdownMenuList").append(
      $("<li>")
        .attr('role', 'presentation')
        .append(
          $('<a>').attr('role', 'menu-item')
            .attr('href', '/')
            .attr('data-model', model.name)
            .append(model.description)
          )
      )
  });

  $("#dropdownMenuList").click(function(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    console.log('Change view', $(evt.target).text());
    var newModelDescription = $(evt.target).text();
    var newModel = $(evt.target).data('model');
    $('#dropdownMenuDefault').empty().text(newModelDescription);
    $('#dropdownMenu1').dropdown('toggle');
    localStorage.setItem('currentModel', newModel);
    ctx.currentModel = newModel;
    initPlaySample(ctx);
    $.publish('clearscreen');
  });

}
},{"./playsample":14}],17:[function(require,module,exports){

'use strict';

exports.initSessionPermissions = function() {
  console.log('Initializing session permissions handler');
  // Radio buttons
  var sessionPermissionsRadio = $("#sessionPermissionsRadioGroup input[type='radio']");
  sessionPermissionsRadio.click(function(evt) {
    var checkedValue = sessionPermissionsRadio.filter(':checked').val();
    console.log('checkedValue', checkedValue);
    localStorage.setItem('sessionPermissions', checkedValue);
  });
}

},{}],18:[function(require,module,exports){

'use strict';

exports.showError = function(msg) {
  console.log('Error: ', msg);
  var errorAlert = $('.error-row');
  errorAlert.hide();
  errorAlert.css('background-color', '#d74108');
  errorAlert.css('color', 'white');
  var errorMessage = $('#errorMessage');
  errorMessage.text(msg);
  errorAlert.show();
  $('#errorClose').click(function(e) {
    e.preventDefault();
    errorAlert.hide();
    return false;
  });
}

exports.showNotice = function(msg) {
  console.log('Notice: ', msg);
  var noticeAlert = $('.notification-row');
  noticeAlert.hide();
  noticeAlert.css('border', '2px solid #ececec');
  noticeAlert.css('background-color', '#f4f4f4');
  noticeAlert.css('color', 'black');
  var noticeMessage = $('#notificationMessage');
  noticeMessage.text(msg);
  noticeAlert.show();
  $('#notificationClose').click(function(e) {
    e.preventDefault();
    noticeAlert.hide();
    return false;
  });
}

exports.hideError = function() {
  var errorAlert = $('.error-row');
  errorAlert.hide();
}
},{}],19:[function(require,module,exports){


exports.initShowTab = function() {
  $('#nav-tabs a').on("click", function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
}

},{}],20:[function(require,module,exports){
/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global $:false */

'use strict';

var Microphone = require('./Microphone');
var models = require('./data/models.json').models;
var utils = require('./utils');
utils.initPubSub();
var initViews = require('./views').initViews;
var pkg = require('../package.json');

window.BUFFERSIZE = 8192;

$(document).ready(function() {

  // Temporary app data
  $('#appSettings')
    .html(
      '<p>Version: ' + pkg.version + '</p>'
      + '<p>Buffer Size: ' + BUFFERSIZE + '</p>'
    );


  // Make call to API to try and get token
  utils.getToken(function(token) {

    window.onbeforeunload = function(e) {
      localStorage.clear();
    };

    if (!token) {
      console.error('No authorization token available');
      console.error('Attempting to reconnect...');
    }

    var viewContext = {
      currentModel: 'en-US_BroadbandModel',
      models: models,
      token: token,
      bufferSize: BUFFERSIZE
    };

    initViews(viewContext);

    // Save models to localstorage
    localStorage.setItem('models', JSON.stringify(models));

    // Set default current model
    localStorage.setItem('currentModel', 'en-US_BroadbandModel');
    localStorage.setItem('sessionPermissions', 'true');


    $.subscribe('clearscreen', function() {
      $('#resultsText').text('');
      $('#resultsJSON').text('');
      $('.error-row').hide();
      $('.notification-row').hide();
      $('.hypotheses > ul').empty();
      $('#metadataTableBody').empty();
    });

  });

});
},{"../package.json":1,"./Microphone":2,"./data/models.json":3,"./utils":7,"./views":13}]},{},[20])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5ucG0vbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL01pY3JvcGhvbmUuanMiLCJzcmMvZGF0YS9tb2RlbHMuanNvbiIsInNyYy9oYW5kbGVmaWxldXBsb2FkLmpzIiwic3JjL2hhbmRsZW1pY3JvcGhvbmUuanMiLCJzcmMvc29ja2V0LmpzIiwic3JjL3V0aWxzLmpzIiwic3JjL3ZpZXdzL2FuaW1hdGVwYW5lbC5qcyIsInNyYy92aWV3cy9kaXNwbGF5bWV0YWRhdGEuanMiLCJzcmMvdmlld3MvZHJhZ2Ryb3AuanMiLCJzcmMvdmlld3MvZWZmZWN0cy5qcyIsInNyYy92aWV3cy9maWxldXBsb2FkLmpzIiwic3JjL3ZpZXdzL2luZGV4LmpzIiwic3JjL3ZpZXdzL3BsYXlzYW1wbGUuanMiLCJzcmMvdmlld3MvcmVjb3JkYnV0dG9uLmpzIiwic3JjL3ZpZXdzL3NlbGVjdG1vZGVsLmpzIiwic3JjL3ZpZXdzL3Nlc3Npb25wZXJtaXNzaW9ucy5qcyIsInNyYy92aWV3cy9zaG93ZXJyb3IuanMiLCJzcmMvdmlld3Mvc2hvd3RhYi5qcyIsInNyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJuYW1lXCI6IFwiU3BlZWNoVG9UZXh0QnJvd3NlclN0YXJ0ZXJBcHBcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4yLjFcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkEgc2FtcGxlIGJyb3dzZXIgYXBwIGZvciBCbHVlbWl4IHRoYXQgdXNlIHRoZSBzcGVlY2gtdG8tdGV4dCBzZXJ2aWNlLCBmZXRjaGluZyBhIHRva2VuIHZpYSBOb2RlLmpzXCIsXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJvZHktcGFyc2VyXCI6IFwifjEuMTAuMlwiLFxuICAgIFwiY29ubmVjdFwiOiBcIl4zLjMuNVwiLFxuICAgIFwiZXJyb3JoYW5kbGVyXCI6IFwifjEuMi40XCIsXG4gICAgXCJleHByZXNzXCI6IFwifjQuMTAuOFwiLFxuICAgIFwiaGFybW9uXCI6IFwiXjEuMy4xXCIsXG4gICAgXCJodHRwLXByb3h5XCI6IFwiXjEuMTEuMVwiLFxuICAgIFwicmVxdWVzdFwiOiBcIn4yLjUzLjBcIixcbiAgICBcInRyYW5zZm9ybWVyLXByb3h5XCI6IFwiXjAuMy4xXCJcbiAgfSxcbiAgXCJlbmdpbmVzXCI6IHtcbiAgICBcIm5vZGVcIjogXCI+PTAuMTBcIlxuICB9LFxuICBcInJlcG9zaXRvcnlcIjoge1xuICAgIFwidHlwZVwiOiBcImdpdFwiLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3dhdHNvbi1kZXZlbG9wZXItY2xvdWQvc3BlZWNoLXRvLXRleHQtYnJvd3Nlci5naXRcIlxuICB9LFxuICBcImF1dGhvclwiOiBcIklCTSBDb3JwLlwiLFxuICBcImJyb3dzZXJpZnktc2hpbVwiOiB7XG4gICAgXCJqcXVlcnlcIjogXCJnbG9iYWw6alF1ZXJ5XCJcbiAgfSxcbiAgXCJicm93c2VyaWZ5XCI6IHtcbiAgICBcInRyYW5zZm9ybVwiOiBbXG4gICAgICBcImJyb3dzZXJpZnktc2hpbVwiXG4gICAgXVxuICB9LFxuICBcImNvbnRyaWJ1dG9yc1wiOiBbXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiR2VybWFuIEF0dGFuYXNpbyBSdWl6XCIsXG4gICAgICBcImVtYWlsXCI6IFwiZ2VybWFuYXR0QHVzLmlibS5jb21cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJuYW1lXCI6IFwiRGFuaWVsIEJvbGFub1wiLFxuICAgICAgXCJlbWFpbFwiOiBcImRib2xhbm9AdXMuaWJtLmNvbVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcIm5hbWVcIjogXCJCcml0YW55IEwuIFBvbnZlbGxlXCIsXG4gICAgICBcImVtYWlsXCI6IFwiYmxwb252ZWxsZUB1cy5pYm0uY29tXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwibmFtZVwiOiBcIkVyaWMgUy4gQnVsbGluZ3RvblwiLFxuICAgICAgXCJlbWFpbFwiOiBcImVzYnVsbGluQHVzLmlibS5jb21cIlxuICAgIH1cbiAgXSxcbiAgXCJsaWNlbnNlXCI6IFwiQXBhY2hlLTIuMFwiLFxuICBcImJ1Z3NcIjoge1xuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3dhdHNvbi1kZXZlbG9wZXItY2xvdWQvc3BlZWNoLXRvLXRleHQtYnJvd3Nlci9pc3N1ZXNcIlxuICB9LFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwic3RhcnRcIjogXCJub2RlIGFwcC5qc1wiLFxuICAgIFwiYnVpbGRcIjogXCJicm93c2VyaWZ5IC1vIHB1YmxpYy9qcy9tYWluLmpzIHNyYy9pbmRleC5qc1wiLFxuICAgIFwid2F0Y2hcIjogXCJ3YXRjaGlmeSAtdiAtZCAtbyBwdWJsaWMvanMvbWFpbi5qcyBzcmMvaW5kZXguanNcIlxuICB9LFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJicm93c2VyaWZ5XCI6IFwiXjEwLjIuNFwiLFxuICAgIFwiYnJvd3NlcmlmeS1zaGltXCI6IFwiXjMuOC45XCIsXG4gICAgXCJ3YXRjaGlmeVwiOiBcIl4zLjIuM1wiXG4gIH1cbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQgSUJNIENvcnAuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlICdMaWNlbnNlJyk7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuICdBUyBJUycgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuLyoqXG4gKiBDYXB0dXJlcyBtaWNyb3Bob25lIGlucHV0IGZyb20gdGhlIGJyb3dzZXIuXG4gKiBXb3JrcyBhdCBsZWFzdCBvbiBsYXRlc3QgdmVyc2lvbnMgb2YgRmlyZWZveCBhbmQgQ2hyb21lXG4gKi9cbmZ1bmN0aW9uIE1pY3JvcGhvbmUoX29wdGlvbnMpIHtcbiAgdmFyIG9wdGlvbnMgPSBfb3B0aW9ucyB8fCB7fTtcblxuICAvLyB3ZSByZWNvcmQgaW4gbW9ubyBiZWNhdXNlIHRoZSBzcGVlY2ggcmVjb2duaXRpb24gc2VydmljZVxuICAvLyBkb2VzIG5vdCBzdXBwb3J0IHN0ZXJlby5cbiAgdGhpcy5idWZmZXJTaXplID0gb3B0aW9ucy5idWZmZXJTaXplIHx8IDgxOTI7XG4gIHRoaXMuaW5wdXRDaGFubmVscyA9IG9wdGlvbnMuaW5wdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLm91dHB1dENoYW5uZWxzID0gb3B0aW9ucy5vdXRwdXRDaGFubmVscyB8fCAxO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnJlcXVlc3RlZEFjY2VzcyA9IGZhbHNlO1xuICB0aGlzLnNhbXBsZVJhdGUgPSAxNjAwMDtcbiAgLy8gYXV4aWxpYXIgYnVmZmVyIHRvIGtlZXAgdW51c2VkIHNhbXBsZXMgKHVzZWQgd2hlbiBkb2luZyBkb3duc2FtcGxpbmcpXG4gIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG5cbiAgLy8gQ2hyb21lIG9yIEZpcmVmb3ggb3IgSUUgVXNlciBtZWRpYVxuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhO1xuICB9XG5cbn1cblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgdXNlciByZWplY3QgdGhlIHVzZSBvZiB0aGUgbWljaHJvcGhvbmVcbiAqIEBwYXJhbSAgZXJyb3IgVGhlIGVycm9yXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uUGVybWlzc2lvblJlamVjdGVkID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uUGVybWlzc2lvblJlamVjdGVkKCknKTtcbiAgdGhpcy5yZXF1ZXN0ZWRBY2Nlc3MgPSBmYWxzZTtcbiAgdGhpcy5vbkVycm9yKCdQZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgbWljcm9waG9uZSByZWpldGVkLicpO1xufTtcblxuTWljcm9waG9uZS5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gIGNvbnNvbGUubG9nKCdNaWNyb3Bob25lLm9uRXJyb3IoKTonLCBlcnJvcik7XG59O1xuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSB1c2VyIGF1dGhvcml6ZXMgdGhlIHVzZSBvZiB0aGUgbWljcm9waG9uZS5cbiAqIEBwYXJhbSAge09iamVjdH0gc3RyZWFtIFRoZSBTdHJlYW0gdG8gY29ubmVjdCB0b1xuICpcbiAqL1xuTWljcm9waG9uZS5wcm90b3R5cGUub25NZWRpYVN0cmVhbSA9ICBmdW5jdGlvbihzdHJlYW0pIHtcbiAgdmFyIEF1ZGlvQ3R4ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuXG4gIGlmICghQXVkaW9DdHgpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0NvbnRleHQgbm90IGF2YWlsYWJsZScpO1xuXG4gIGlmICghdGhpcy5hdWRpb0NvbnRleHQpXG4gICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9DdHgoKTtcblxuICB2YXIgZ2FpbiA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgdmFyIGF1ZGlvSW5wdXQgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gIGF1ZGlvSW5wdXQuY29ubmVjdChnYWluKTtcblxuICB0aGlzLm1pYyA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3Nvcih0aGlzLmJ1ZmZlclNpemUsXG4gICAgdGhpcy5pbnB1dENoYW5uZWxzLCB0aGlzLm91dHB1dENoYW5uZWxzKTtcblxuICAvLyB1bmNvbW1lbnQgdGhlIGZvbGxvd2luZyBsaW5lIGlmIHlvdSB3YW50IHRvIHVzZSB5b3VyIG1pY3JvcGhvbmUgc2FtcGxlIHJhdGVcbiAgLy90aGlzLnNhbXBsZVJhdGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlO1xuICBjb25zb2xlLmxvZygnTWljcm9waG9uZS5vbk1lZGlhU3RyZWFtKCk6IHNhbXBsaW5nIHJhdGUgaXM6JywgdGhpcy5zYW1wbGVSYXRlKTtcblxuICB0aGlzLm1pYy5vbmF1ZGlvcHJvY2VzcyA9IHRoaXMuX29uYXVkaW9wcm9jZXNzLmJpbmQodGhpcyk7XG4gIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuXG4gIGdhaW4uY29ubmVjdCh0aGlzLm1pYyk7XG4gIHRoaXMubWljLmNvbm5lY3QodGhpcy5hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICB0aGlzLnJlY29yZGluZyA9IHRydWU7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMub25TdGFydFJlY29yZGluZygpO1xufTtcblxuLyoqXG4gKiBjYWxsYmFjayB0aGF0IGlzIGJlaW5nIHVzZWQgYnkgdGhlIG1pY3JvcGhvbmVcbiAqIHRvIHNlbmQgYXVkaW8gY2h1bmtzLlxuICogQHBhcmFtICB7b2JqZWN0fSBkYXRhIGF1ZGlvXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLl9vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgaWYgKCF0aGlzLnJlY29yZGluZykge1xuICAgIC8vIFdlIHNwZWFrIGJ1dCB3ZSBhcmUgbm90IHJlY29yZGluZ1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFNpbmdsZSBjaGFubmVsXG4gIHZhciBjaGFuID0gZGF0YS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcblxuICB0aGlzLm9uQXVkaW8odGhpcy5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHoobmV3IEZsb2F0MzJBcnJheShjaGFuKSkpO1xuXG4gIC8vZXhwb3J0IHdpdGggbWljcm9waG9uZSBtaHosIHJlbWVtYmVyIHRvIHVwZGF0ZSB0aGUgdGhpcy5zYW1wbGVSYXRlXG4gIC8vIHdpdGggdGhlIHNhbXBsZSByYXRlIGZyb20geW91ciBtaWNyb3Bob25lXG4gIC8vIHRoaXMub25BdWRpbyh0aGlzLl9leHBvcnREYXRhQnVmZmVyKG5ldyBGbG9hdDMyQXJyYXkoY2hhbikpKTtcblxufTtcblxuLyoqXG4gKiBTdGFydCB0aGUgYXVkaW8gcmVjb3JkaW5nXG4gKi9cbk1pY3JvcGhvbmUucHJvdG90eXBlLnJlY29yZCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIW5hdmlnYXRvci5nZXRVc2VyTWVkaWEpe1xuICAgIHRoaXMub25FcnJvcignQnJvd3NlciBkb2VzblxcJ3Qgc3VwcG9ydCBtaWNyb3Bob25lIGlucHV0Jyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLnJlcXVlc3RlZEFjY2Vzcykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gdHJ1ZTtcbiAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7IGF1ZGlvOiB0cnVlIH0sXG4gICAgdGhpcy5vbk1lZGlhU3RyZWFtLmJpbmQodGhpcyksIC8vIE1pY3JvcGhvbmUgcGVybWlzc2lvbiBncmFudGVkXG4gICAgdGhpcy5vblBlcm1pc3Npb25SZWplY3RlZC5iaW5kKHRoaXMpKTsgLy8gTWljcm9waG9uZSBwZXJtaXNzaW9uIHJlamVjdGVkXG59O1xuXG4vKipcbiAqIFN0b3AgdGhlIGF1ZGlvIHJlY29yZGluZ1xuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5yZWNvcmRpbmcpXG4gICAgcmV0dXJuO1xuICB0aGlzLnJlY29yZGluZyA9IGZhbHNlO1xuICB0aGlzLnN0cmVhbS5zdG9wKCk7XG4gIHRoaXMucmVxdWVzdGVkQWNjZXNzID0gZmFsc2U7XG4gIHRoaXMubWljLmRpc2Nvbm5lY3QoMCk7XG4gIHRoaXMubWljID0gbnVsbDtcbiAgdGhpcy5vblN0b3BSZWNvcmRpbmcoKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIEJsb2IgdHlwZTogJ2F1ZGlvL2wxNicgd2l0aCB0aGUgY2h1bmsgYW5kIGRvd25zYW1wbGluZyB0byAxNiBrSHpcbiAqIGNvbWluZyBmcm9tIHRoZSBtaWNyb3Bob25lLlxuICogRXhwbGFuYXRpb24gZm9yIHRoZSBtYXRoOiBUaGUgcmF3IHZhbHVlcyBjYXB0dXJlZCBmcm9tIHRoZSBXZWIgQXVkaW8gQVBJIGFyZVxuICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICogVGhlIHZhbHVlcyBmb3IgMTYtYml0IFBDTSByYW5nZSBiZXR3ZWVuIC0zMjc2OCBhbmQgKzMyNzY3ICgxNi1iaXQgc2lnbmVkIGludGVnZXIpLlxuICogTXVsdGlwbHkgdG8gY29udHJvbCB0aGUgdm9sdW1lIG9mIHRoZSBvdXRwdXQuIFdlIHN0b3JlIGluIGxpdHRsZSBlbmRpYW4uXG4gKiBAcGFyYW0gIHtPYmplY3R9IGJ1ZmZlciBNaWNyb3Bob25lIGF1ZGlvIGNodW5rXG4gKiBAcmV0dXJuIHtCbG9ifSAnYXVkaW8vbDE2JyBjaHVua1xuICogQGRlcHJlY2F0ZWQgVGhpcyBtZXRob2QgaXMgZGVwcmFjYXRlZFxuICovXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fZXhwb3J0RGF0YUJ1ZmZlclRvMTZLaHogPSBmdW5jdGlvbihidWZmZXJOZXdTYW1wbGVzKSB7XG4gIHZhciBidWZmZXIgPSBudWxsLFxuICAgIG5ld1NhbXBsZXMgPSBidWZmZXJOZXdTYW1wbGVzLmxlbmd0aCxcbiAgICB1bnVzZWRTYW1wbGVzID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzLmxlbmd0aDtcblxuICBpZiAodW51c2VkU2FtcGxlcyA+IDApIHtcbiAgICBidWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHVudXNlZFNhbXBsZXMgKyBuZXdTYW1wbGVzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVudXNlZFNhbXBsZXM7ICsraSkge1xuICAgICAgYnVmZmVyW2ldID0gdGhpcy5idWZmZXJVbnVzZWRTYW1wbGVzW2ldO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbmV3U2FtcGxlczsgKytpKSB7XG4gICAgICBidWZmZXJbdW51c2VkU2FtcGxlcyArIGldID0gYnVmZmVyTmV3U2FtcGxlc1tpXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYnVmZmVyID0gYnVmZmVyTmV3U2FtcGxlcztcbiAgfVxuXG4gIC8vIGRvd25zYW1wbGluZyB2YXJpYWJsZXNcbiAgdmFyIGZpbHRlciA9IFtcbiAgICAgIC0wLjAzNzkzNSwgLTAuMDAwODkwMjQsIDAuMDQwMTczLCAwLjAxOTk4OSwgMC4wMDQ3NzkyLCAtMC4wNTg2NzUsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjAwNDA2NTMsIDAuMTQ1MjcsIDAuMjY5MjcsIDAuMzM5MTMsIDAuMjY5MjcsIDAuMTQ1MjcsIC0wLjAwNDA2NTMsIC0wLjA1NjQ4NyxcbiAgICAgIC0wLjA1ODY3NSwgMC4wMDQ3NzkyLCAwLjAxOTk4OSwgMC4wNDAxNzMsIC0wLjAwMDg5MDI0LCAtMC4wMzc5MzVcbiAgICBdLFxuICAgIHNhbXBsaW5nUmF0ZVJhdGlvID0gdGhpcy5hdWRpb0NvbnRleHQuc2FtcGxlUmF0ZSAvIDE2MDAwLFxuICAgIG5PdXRwdXRTYW1wbGVzID0gTWF0aC5mbG9vcigoYnVmZmVyLmxlbmd0aCAtIGZpbHRlci5sZW5ndGgpIC8gKHNhbXBsaW5nUmF0ZVJhdGlvKSkgKyAxLFxuICAgIHBjbUVuY29kZWRCdWZmZXIxNmsgPSBuZXcgQXJyYXlCdWZmZXIobk91dHB1dFNhbXBsZXMgKiAyKSxcbiAgICBkYXRhVmlldzE2ayA9IG5ldyBEYXRhVmlldyhwY21FbmNvZGVkQnVmZmVyMTZrKSxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGLCAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG4gICAgbk91dCA9IDA7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgKyBmaWx0ZXIubGVuZ3RoIC0gMSA8IGJ1ZmZlci5sZW5ndGg7IGkgPSBNYXRoLnJvdW5kKHNhbXBsaW5nUmF0ZVJhdGlvICogbk91dCkpIHtcbiAgICB2YXIgc2FtcGxlID0gMDtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGZpbHRlci5sZW5ndGg7ICsraikge1xuICAgICAgc2FtcGxlICs9IGJ1ZmZlcltpICsgal0gKiBmaWx0ZXJbal07XG4gICAgfVxuICAgIHNhbXBsZSAqPSB2b2x1bWU7XG4gICAgZGF0YVZpZXcxNmsuc2V0SW50MTYoaW5kZXgsIHNhbXBsZSwgdHJ1ZSk7IC8vICd0cnVlJyAtPiBtZWFucyBsaXR0bGUgZW5kaWFuXG4gICAgaW5kZXggKz0gMjtcbiAgICBuT3V0Kys7XG4gIH1cblxuICB2YXIgaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkID0gTWF0aC5yb3VuZChzYW1wbGluZ1JhdGVSYXRpbyAqIG5PdXQpO1xuICB2YXIgcmVtYWluaW5nID0gYnVmZmVyLmxlbmd0aCAtIGluZGV4U2FtcGxlQWZ0ZXJMYXN0VXNlZDtcbiAgaWYgKHJlbWFpbmluZyA+IDApIHtcbiAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXMgPSBuZXcgRmxvYXQzMkFycmF5KHJlbWFpbmluZyk7XG4gICAgZm9yIChpID0gMDsgaSA8IHJlbWFpbmluZzsgKytpKSB7XG4gICAgICB0aGlzLmJ1ZmZlclVudXNlZFNhbXBsZXNbaV0gPSBidWZmZXJbaW5kZXhTYW1wbGVBZnRlckxhc3RVc2VkICsgaV07XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuYnVmZmVyVW51c2VkU2FtcGxlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMCk7XG4gIH1cblxuICByZXR1cm4gbmV3IEJsb2IoW2RhdGFWaWV3MTZrXSwge1xuICAgIHR5cGU6ICdhdWRpby9sMTYnXG4gIH0pO1xuICB9O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBCbG9iIHR5cGU6ICdhdWRpby9sMTYnIHdpdGggdGhlXG4gKiBjaHVuayBjb21pbmcgZnJvbSB0aGUgbWljcm9waG9uZS5cbiAqL1xudmFyIGV4cG9ydERhdGFCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGJ1ZmZlclNpemUpIHtcbiAgdmFyIHBjbUVuY29kZWRCdWZmZXIgPSBudWxsLFxuICAgIGRhdGFWaWV3ID0gbnVsbCxcbiAgICBpbmRleCA9IDAsXG4gICAgdm9sdW1lID0gMHg3RkZGOyAvL3JhbmdlIGZyb20gMCB0byAweDdGRkYgdG8gY29udHJvbCB0aGUgdm9sdW1lXG5cbiAgcGNtRW5jb2RlZEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJTaXplICogMik7XG4gIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KHBjbUVuY29kZWRCdWZmZXIpO1xuXG4gIC8qIEV4cGxhbmF0aW9uIGZvciB0aGUgbWF0aDogVGhlIHJhdyB2YWx1ZXMgY2FwdHVyZWQgZnJvbSB0aGUgV2ViIEF1ZGlvIEFQSSBhcmVcbiAgICogaW4gMzItYml0IEZsb2F0aW5nIFBvaW50LCBiZXR3ZWVuIC0xIGFuZCAxIChwZXIgdGhlIHNwZWNpZmljYXRpb24pLlxuICAgKiBUaGUgdmFsdWVzIGZvciAxNi1iaXQgUENNIHJhbmdlIGJldHdlZW4gLTMyNzY4IGFuZCArMzI3NjcgKDE2LWJpdCBzaWduZWQgaW50ZWdlcikuXG4gICAqIE11bHRpcGx5IHRvIGNvbnRyb2wgdGhlIHZvbHVtZSBvZiB0aGUgb3V0cHV0LiBXZSBzdG9yZSBpbiBsaXR0bGUgZW5kaWFuLlxuICAgKi9cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICBkYXRhVmlldy5zZXRJbnQxNihpbmRleCwgYnVmZmVyW2ldICogdm9sdW1lLCB0cnVlKTtcbiAgICBpbmRleCArPSAyO1xuICB9XG5cbiAgLy8gbDE2IGlzIHRoZSBNSU1FIHR5cGUgZm9yIDE2LWJpdCBQQ01cbiAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhVmlld10sIHsgdHlwZTogJ2F1ZGlvL2wxNicgfSk7XG59O1xuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5fZXhwb3J0RGF0YUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlcil7XG4gIHV0aWxzLmV4cG9ydERhdGFCdWZmZXIoYnVmZmVyLCB0aGlzLmJ1ZmZlclNpemUpO1xufTsgXG5cblxuLy8gRnVuY3Rpb25zIHVzZWQgdG8gY29udHJvbCBNaWNyb3Bob25lIGV2ZW50cyBsaXN0ZW5lcnMuXG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0YXJ0UmVjb3JkaW5nID0gIGZ1bmN0aW9uKCkge307XG5NaWNyb3Bob25lLnByb3RvdHlwZS5vblN0b3BSZWNvcmRpbmcgPSAgZnVuY3Rpb24oKSB7fTtcbk1pY3JvcGhvbmUucHJvdG90eXBlLm9uQXVkaW8gPSAgZnVuY3Rpb24oKSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBNaWNyb3Bob25lO1xuXG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gICBcIm1vZGVsc1wiOiBbXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VuLVVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVuLVVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVuLVVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlVTIEVuZ2xpc2ggYnJvYWRiYW5kIG1vZGVsICgxNktIeilcIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VuLVVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVuLVVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlbi1VU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJVUyBFbmdsaXNoIG5hcnJvd2JhbmQgbW9kZWwgKDhLSHopXCJcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VzLUVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDE2MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVzLUVTX0Jyb2FkYmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImVzLUVTXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlNwYW5pc2ggYnJvYWRiYW5kIG1vZGVsICgxNktIeilcIlxuICAgICAgfSwgXG4gICAgICB7XG4gICAgICAgICBcInVybFwiOiBcImh0dHBzOi8vc3RyZWFtLndhdHNvbnBsYXRmb3JtLm5ldC9zcGVlY2gtdG8tdGV4dC9hcGkvdjEvbW9kZWxzL2VzLUVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiA4MDAwLCBcbiAgICAgICAgIFwibmFtZVwiOiBcImVzLUVTX05hcnJvd2JhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJlcy1FU1wiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJTcGFuaXNoIG5hcnJvd2JhbmQgbW9kZWwgKDhLSHopXCJcbiAgICAgIH0sIFxuICAgICAge1xuICAgICAgICAgXCJ1cmxcIjogXCJodHRwczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL21vZGVscy9qYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwicmF0ZVwiOiAxNjAwMCwgXG4gICAgICAgICBcIm5hbWVcIjogXCJqYS1KUF9Ccm9hZGJhbmRNb2RlbFwiLCBcbiAgICAgICAgIFwibGFuZ3VhZ2VcIjogXCJqYS1KUFwiLCBcbiAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJKYXBhbmVzZSBicm9hZGJhbmQgbW9kZWwgKDE2S0h6KVwiXG4gICAgICB9LCBcbiAgICAgIHtcbiAgICAgICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9zdHJlYW0ud2F0c29ucGxhdGZvcm0ubmV0L3NwZWVjaC10by10ZXh0L2FwaS92MS9tb2RlbHMvamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJyYXRlXCI6IDgwMDAsIFxuICAgICAgICAgXCJuYW1lXCI6IFwiamEtSlBfTmFycm93YmFuZE1vZGVsXCIsIFxuICAgICAgICAgXCJsYW5ndWFnZVwiOiBcImphLUpQXCIsIFxuICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIkphcGFuZXNlIG5hcnJvd2JhbmQgbW9kZWwgKDhLSHopXCJcbiAgICAgIH1cbiAgIF1cbn1cbiIsIlxudmFyIGVmZmVjdHMgPSByZXF1aXJlKCcuL3ZpZXdzL2VmZmVjdHMnKTtcbnZhciBkaXNwbGF5ID0gcmVxdWlyZSgnLi92aWV3cy9kaXNwbGF5bWV0YWRhdGEnKTtcbnZhciBoaWRlRXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpLmhpZGVFcnJvcjtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKS5pbml0U29ja2V0O1xuXG5leHBvcnRzLmhhbmRsZUZpbGVVcGxvYWQgPSBmdW5jdGlvbih0b2tlbiwgbW9kZWwsIGZpbGUsIGNvbnRlbnRUeXBlLCBjYWxsYmFjaywgb25lbmQpIHtcblxuICAgIC8vIFNldCBjdXJyZW50bHlEaXNwbGF5aW5nIHRvIHByZXZlbnQgb3RoZXIgc29ja2V0cyBmcm9tIG9wZW5pbmdcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuXG4gICAgLy8gJCgnI3Byb2dyZXNzSW5kaWNhdG9yJykuY3NzKCd2aXNpYmlsaXR5JywgJ3Zpc2libGUnKTtcblxuICAgICQuc3Vic2NyaWJlKCdwcm9ncmVzcycsIGZ1bmN0aW9uKGV2dCwgZGF0YSkge1xuICAgICAgY29uc29sZS5sb2coJ3Byb2dyZXNzOiAnLCBkYXRhKTtcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKCdjb250ZW50VHlwZScsIGNvbnRlbnRUeXBlKTtcblxuICAgIHZhciBiYXNlU3RyaW5nID0gJyc7XG4gICAgdmFyIGJhc2VKU09OID0gJyc7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICBvcHRpb25zLm1lc3NhZ2UgPSB7XG4gICAgICAnYWN0aW9uJzogJ3N0YXJ0JyxcbiAgICAgICdjb250ZW50LXR5cGUnOiBjb250ZW50VHlwZSxcbiAgICAgICdpbnRlcmltX3Jlc3VsdHMnOiB0cnVlLFxuICAgICAgJ2NvbnRpbnVvdXMnOiB0cnVlLFxuICAgICAgJ3dvcmRfY29uZmlkZW5jZSc6IHRydWUsXG4gICAgICAndGltZXN0YW1wcyc6IHRydWUsXG4gICAgICAnbWF4X2FsdGVybmF0aXZlcyc6IDNcbiAgICB9O1xuICAgIG9wdGlvbnMubW9kZWwgPSBtb2RlbDtcblxuICAgIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTb2NrZXQgb3BlbmVkJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25MaXN0ZW5pbmcoc29ja2V0KSB7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGxpc3RlbmluZycpO1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UobXNnKSB7XG4gICAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgICAgLy8gQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG4gICAgICAgIGJhc2VTdHJpbmcgPSBkaXNwbGF5LnNob3dSZXN1bHQobXNnLCBiYXNlU3RyaW5nKTtcbiAgICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uRXJyb3IoZXZ0KSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIG9uZW5kKGV2dCk7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGVycjogJywgZXZ0LmNvZGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uQ2xvc2UoZXZ0KSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIG9uZW5kKGV2dCk7XG4gICAgICBjb25zb2xlLmxvZygnU29ja2V0IGNsb3Npbmc6ICcsIGV2dCk7XG4gICAgfVxuXG4gICAgaW5pdFNvY2tldChvcHRpb25zLCBvbk9wZW4sIG9uTGlzdGVuaW5nLCBvbk1lc3NhZ2UsIG9uRXJyb3IsIG9uQ2xvc2UpO1xuXG4gIH1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW5pdFNvY2tldCA9IHJlcXVpcmUoJy4vc29ja2V0JykuaW5pdFNvY2tldDtcbnZhciBkaXNwbGF5ID0gcmVxdWlyZSgnLi92aWV3cy9kaXNwbGF5bWV0YWRhdGEnKTtcblxuZXhwb3J0cy5oYW5kbGVNaWNyb3Bob25lID0gZnVuY3Rpb24odG9rZW4sIG1vZGVsLCBtaWMsIGNhbGxiYWNrKSB7XG5cbiAgaWYgKG1vZGVsLmluZGV4T2YoJ05hcnJvd2JhbmQnKSA+IC0xKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcignTWljcm9waG9uZSB0cmFuc2NyaXB0aW9uIGNhbm5vdCBhY2NvbW9kYXRlIG5hcnJvd2JhbmQgbW9kZWxzLCBwbGVhc2Ugc2VsZWN0IGFub3RoZXInKTtcbiAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcblxuICAvLyBUZXN0IG91dCB3ZWJzb2NrZXRcbiAgdmFyIGJhc2VTdHJpbmcgPSAnJztcbiAgdmFyIGJhc2VKU09OID0gJyc7XG5cbiAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgb3B0aW9ucy50b2tlbiA9IHRva2VuO1xuICBvcHRpb25zLm1lc3NhZ2UgPSB7XG4gICAgJ2FjdGlvbic6ICdzdGFydCcsXG4gICAgJ2NvbnRlbnQtdHlwZSc6ICdhdWRpby9sMTY7cmF0ZT0xNjAwMCcsXG4gICAgJ2ludGVyaW1fcmVzdWx0cyc6IHRydWUsXG4gICAgJ2NvbnRpbnVvdXMnOiB0cnVlLFxuICAgICd3b3JkX2NvbmZpZGVuY2UnOiB0cnVlLFxuICAgICd0aW1lc3RhbXBzJzogdHJ1ZSxcbiAgICAnbWF4X2FsdGVybmF0aXZlcyc6IDNcbiAgfTtcbiAgb3B0aW9ucy5tb2RlbCA9IG1vZGVsO1xuXG4gIGZ1bmN0aW9uIG9uT3Blbihzb2NrZXQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldDogb3BlbmVkJyk7XG4gICAgY2FsbGJhY2sobnVsbCwgc29ja2V0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uTGlzdGVuaW5nKHNvY2tldCkge1xuXG4gICAgbWljLm9uQXVkaW8gPSBmdW5jdGlvbihibG9iKSB7XG4gICAgICBpZiAoc29ja2V0LnJlYWR5U3RhdGUgPCAyKSB7XG4gICAgICAgIHNvY2tldC5zZW5kKGJsb2IpXG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uTWVzc2FnZShtc2csIHNvY2tldCkge1xuICAgIGNvbnNvbGUubG9nKCdNaWMgc29ja2V0IG1zZzogJywgbXNnKTtcbiAgICBpZiAobXNnLnJlc3VsdHMpIHtcbiAgICAgIC8vIENvbnZlcnQgdG8gY2xvc3VyZSBhcHByb2FjaFxuICAgICAgYmFzZVN0cmluZyA9IGRpc3BsYXkuc2hvd1Jlc3VsdChtc2csIGJhc2VTdHJpbmcpO1xuICAgICAgYmFzZUpTT04gPSBkaXNwbGF5LnNob3dKU09OKG1zZywgYmFzZUpTT04pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uRXJyb3Iociwgc29ja2V0KSB7XG4gICAgY29uc29sZS5sb2coJ01pYyBzb2NrZXQgZXJyOiAnLCBlcnIpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25DbG9zZShldnQpIHtcbiAgICBjb25zb2xlLmxvZygnTWljIHNvY2tldCBjbG9zZTogJywgZXZ0KTtcbiAgfVxuXG4gIGluaXRTb2NrZXQob3B0aW9ucywgb25PcGVuLCBvbkxpc3RlbmluZywgb25NZXNzYWdlLCBvbkVycm9yLCBvbkNsb3NlKTtcblxufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNCBJQk0gQ29ycC4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4vKmdsb2JhbCAkOmZhbHNlICovXG5cblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIE1pY3JvcGhvbmUgPSByZXF1aXJlKCcuL01pY3JvcGhvbmUnKTtcbnZhciBzaG93ZXJyb3IgPSByZXF1aXJlKCcuL3ZpZXdzL3Nob3dlcnJvcicpO1xudmFyIHNob3dFcnJvciA9IHNob3dlcnJvci5zaG93RXJyb3I7XG52YXIgaGlkZUVycm9yID0gc2hvd2Vycm9yLmhpZGVFcnJvcjtcblxuLy8gTWluaSBXUyBjYWxsYmFjayBBUEksIHNvIHdlIGNhbiBpbml0aWFsaXplXG4vLyB3aXRoIG1vZGVsIGFuZCB0b2tlbiBpbiBVUkksIHBsdXNcbi8vIHN0YXJ0IG1lc3NhZ2VcblxuLy8gSW5pdGlhbGl6ZSBjbG9zdXJlLCB3aGljaCBob2xkcyBtYXhpbXVtIGdldFRva2VuIGNhbGwgY291bnRcbnZhciB0b2tlbkdlbmVyYXRvciA9IHV0aWxzLmNyZWF0ZVRva2VuR2VuZXJhdG9yKCk7XG5cbnZhciBpbml0U29ja2V0ID0gZXhwb3J0cy5pbml0U29ja2V0ID0gZnVuY3Rpb24ob3B0aW9ucywgb25vcGVuLCBvbmxpc3RlbmluZywgb25tZXNzYWdlLCBvbmVycm9yLCBvbmNsb3NlKSB7XG4gIHZhciBsaXN0ZW5pbmc7XG4gIGZ1bmN0aW9uIHdpdGhEZWZhdWx0KHZhbCwgZGVmYXVsdFZhbCkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/IGRlZmF1bHRWYWwgOiB2YWw7XG4gIH1cbiAgdmFyIHNvY2tldDtcbiAgdmFyIHRva2VuID0gb3B0aW9ucy50b2tlbjtcbiAgdmFyIG1vZGVsID0gb3B0aW9ucy5tb2RlbCB8fCBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY3VycmVudE1vZGVsJyk7XG4gIHZhciBtZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlIHx8IHsnYWN0aW9uJzogJ3N0YXJ0J307XG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnMgPSB3aXRoRGVmYXVsdChvcHRpb25zLnNlc3Npb25QZXJtaXNzaW9ucywgSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnc2Vzc2lvblBlcm1pc3Npb25zJykpKTtcbiAgdmFyIHNlc3Npb25QZXJtaXNzaW9uc1F1ZXJ5UGFyYW0gPSBzZXNzaW9uUGVybWlzc2lvbnMgPyAnMCcgOiAnMSc7XG4gIHZhciB1cmwgPSBvcHRpb25zLnNlcnZpY2VVUkkgfHwgJ3dzczovL3N0cmVhbS53YXRzb25wbGF0Zm9ybS5uZXQvc3BlZWNoLXRvLXRleHQvYXBpL3YxL3JlY29nbml6ZT93YXRzb24tdG9rZW49J1xuICAgICsgdG9rZW5cbiAgICArICcmWC1XREMtUEwtT1BULU9VVD0nICsgc2Vzc2lvblBlcm1pc3Npb25zUXVlcnlQYXJhbVxuICAgICsgJyZtb2RlbD0nICsgbW9kZWw7XG4gIGNvbnNvbGUubG9nKCdVUkwgbW9kZWwnLCBtb2RlbCk7XG4gIHRyeSB7XG4gICAgc29ja2V0ID0gbmV3IFdlYlNvY2tldCh1cmwpO1xuICB9IGNhdGNoKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1dTIGNvbm5lY3Rpb24gZXJyb3I6ICcsIGVycik7XG4gIH1cbiAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGxpc3RlbmluZyA9IGZhbHNlO1xuICAgICQuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNSUNST1BIT05FOiBjbG9zZS4nKTtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHthY3Rpb246J3N0b3AnfSkpO1xuICAgIH0pO1xuICAgICQuc3Vic2NyaWJlKCdzb2NrZXRzdG9wJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY29uc29sZS5sb2coJ01JQ1JPUEhPTkU6IGNsb3NlLicpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgfSk7XG4gICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgIG9ub3Blbihzb2NrZXQpO1xuICB9O1xuICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgIGlmIChtc2cuZXJyb3IpIHtcbiAgICAgIHNob3dFcnJvcihtc2cuZXJyb3IpO1xuICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobXNnLnN0YXRlID09PSAnbGlzdGVuaW5nJykge1xuICAgICAgLy8gRWFybHkgY3V0IG9mZiwgd2l0aG91dCBub3RpZmljYXRpb25cbiAgICAgIGlmICghbGlzdGVuaW5nKSB7XG4gICAgICAgIG9ubGlzdGVuaW5nKHNvY2tldCk7XG4gICAgICAgIGxpc3RlbmluZyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnTUlDUk9QSE9ORTogQ2xvc2luZyBzb2NrZXQuJyk7XG4gICAgICAgIHNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbm1lc3NhZ2UobXNnLCBzb2NrZXQpO1xuICB9O1xuXG4gIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgY29uc29sZS5sb2coJ1dTIG9uZXJyb3I6ICcsIGV2dCk7XG4gICAgc2hvd0Vycm9yKCdBcHBsaWNhdGlvbiBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgICQucHVibGlzaCgnY2xlYXJzY3JlZW4nKTtcbiAgICBvbmVycm9yKGV2dCk7XG4gIH07XG5cbiAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbihldnQpIHtcbiAgICBjb25zb2xlLmxvZygnV1Mgb25jbG9zZTogJywgZXZ0KTtcbiAgICBpZiAoZXZ0LmNvZGUgPT09IDEwMDYpIHtcbiAgICAgIC8vIEF1dGhlbnRpY2F0aW9uIGVycm9yLCB0cnkgdG8gcmVjb25uZWN0XG4gICAgICBjb25zb2xlLmxvZygnZ2VuZXJhdG9yIGNvdW50JywgdG9rZW5HZW5lcmF0b3IuZ2V0Q291bnQoKSk7XG4gICAgICBpZiAodG9rZW5HZW5lcmF0b3IuZ2V0Q291bnQoKSA+IDEpIHtcbiAgICAgICAgJC5wdWJsaXNoKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBhdXRob3JpemF0aW9uIHRva2VuIGlzIGN1cnJlbnRseSBhdmFpbGFibGVcIik7XG4gICAgICB9XG4gICAgICB0b2tlbkdlbmVyYXRvci5nZXRUb2tlbihmdW5jdGlvbih0b2tlbiwgZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBhZGRpdGlvbmFsIHRva2VuLi4uJyk7XG4gICAgICAgIG9wdGlvbnMudG9rZW4gPSB0b2tlbjtcbiAgICAgICAgaW5pdFNvY2tldChvcHRpb25zLCBvbm9wZW4sIG9ubGlzdGVuaW5nLCBvbm1lc3NhZ2UsIG9uZXJyb3IsIG9uY2xvc2UpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChldnQuY29kZSA9PT0gMTAxMSkge1xuICAgICAgY29uc29sZS5lcnJvcignU2VydmVyIGVycm9yICcgKyBldnQuY29kZSArICc6IHBsZWFzZSByZWZyZXNoIHlvdXIgYnJvd3NlciBhbmQgdHJ5IGFnYWluJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChldnQuY29kZSA+IDEwMDApIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1NlcnZlciBlcnJvciAnICsgZXZ0LmNvZGUgKyAnOiBwbGVhc2UgcmVmcmVzaCB5b3VyIGJyb3dzZXIgYW5kIHRyeSBhZ2FpbicpO1xuICAgICAgLy8gc2hvd0Vycm9yKCdTZXJ2ZXIgZXJyb3IgJyArIGV2dC5jb2RlICsgJzogcGxlYXNlIHJlZnJlc2ggeW91ciBicm93c2VyIGFuZCB0cnkgYWdhaW4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gTWFkZSBpdCB0aHJvdWdoLCBub3JtYWwgY2xvc2VcbiAgICAkLnVuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcpO1xuICAgICQudW5zdWJzY3JpYmUoJ3NvY2tldHN0b3AnKTtcbiAgICBvbmNsb3NlKGV2dCk7XG4gIH07XG5cbn0iLCJcbi8vIEZvciBub24tdmlldyBsb2dpY1xudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy5qUXVlcnkgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLmpRdWVyeSA6IG51bGwpO1xuXG52YXIgZmlsZUJsb2NrID0gZnVuY3Rpb24oX29mZnNldCwgbGVuZ3RoLCBfZmlsZSwgcmVhZENodW5rKSB7XG4gIHZhciByID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgdmFyIGJsb2IgPSBfZmlsZS5zbGljZShfb2Zmc2V0LCBsZW5ndGggKyBfb2Zmc2V0KTtcbiAgci5vbmxvYWQgPSByZWFkQ2h1bms7XG4gIHIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XG59XG5cbi8vIEJhc2VkIG9uIGFsZWRpYWZlcmlhJ3MgU08gcmVzcG9uc2Vcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQ0MzgxODcvamF2YXNjcmlwdC1maWxlcmVhZGVyLXBhcnNpbmctbG9uZy1maWxlLWluLWNodW5rc1xuZXhwb3J0cy5vbkZpbGVQcm9ncmVzcyA9IGZ1bmN0aW9uKG9wdGlvbnMsIG9uZGF0YSwgb25lcnJvciwgb25lbmQpIHtcbiAgdmFyIGZpbGUgICAgICAgPSBvcHRpb25zLmZpbGU7XG4gIHZhciBmaWxlU2l6ZSAgID0gZmlsZS5zaXplO1xuICB2YXIgY2h1bmtTaXplICA9IG9wdGlvbnMuYnVmZmVyU2l6ZSB8fCA4MTkyO1xuICB2YXIgb2Zmc2V0ICAgICA9IDA7XG4gIHZhciByZWFkQ2h1bmsgPSBmdW5jdGlvbihldnQpIHtcbiAgICBpZiAob2Zmc2V0ID49IGZpbGVTaXplKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIkRvbmUgcmVhZGluZyBmaWxlXCIpO1xuICAgICAgb25lbmQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGV2dC50YXJnZXQuZXJyb3IgPT0gbnVsbCkge1xuICAgICAgdmFyIGJ1ZmZlciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgdmFyIGxlbiA9IGJ1ZmZlci5ieXRlTGVuZ3RoO1xuICAgICAgb2Zmc2V0ICs9IGxlbjtcbiAgICAgIG9uZGF0YShidWZmZXIpOyAvLyBjYWxsYmFjayBmb3IgaGFuZGxpbmcgcmVhZCBjaHVua1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlID0gZXZ0LnRhcmdldC5lcnJvcjtcbiAgICAgIGNvbnNvbGUubG9nKFwiUmVhZCBlcnJvcjogXCIgKyBlcnJvck1lc3NhZ2UpO1xuICAgICAgb25lcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmaWxlQmxvY2sob2Zmc2V0LCBjaHVua1NpemUsIGZpbGUsIHJlYWRDaHVuayk7XG4gIH1cbiAgZmlsZUJsb2NrKG9mZnNldCwgY2h1bmtTaXplLCBmaWxlLCByZWFkQ2h1bmspO1xufVxuXG5leHBvcnRzLmNyZWF0ZVRva2VuR2VuZXJhdG9yID0gZnVuY3Rpb24oKSB7XG4gIC8vIE1ha2UgY2FsbCB0byBBUEkgdG8gdHJ5IGFuZCBnZXQgdG9rZW5cbiAgdmFyIGhhc0JlZW5SdW5UaW1lcyA9IDA7XG4gIHJldHVybiB7XG4gICAgZ2V0VG9rZW46IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgKytoYXNCZWVuUnVuVGltZXM7XG4gICAgaWYgKGhhc0JlZW5SdW5UaW1lcyA+IDUpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nhbm5vdCByZWFjaCBzZXJ2ZXInKTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIGVycik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB1cmwgPSAnL3Rva2VuJztcbiAgICB2YXIgdG9rZW5SZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdG9rZW5SZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcbiAgICB0b2tlblJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICB2YXIgdG9rZW4gPSB0b2tlblJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgY2FsbGJhY2sodG9rZW4pO1xuICAgIH07XG4gICAgdG9rZW5SZXF1ZXN0LnNlbmQoKTtcbiAgICB9LFxuICAgIGdldENvdW50OiBmdW5jdGlvbigpIHsgcmV0dXJuIGhhc0JlZW5SdW5UaW1lczsgfVxuICB9XG59O1xuXG5leHBvcnRzLmdldFRva2VuID0gKGZ1bmN0aW9uKCkge1xuICAvLyBNYWtlIGNhbGwgdG8gQVBJIHRvIHRyeSBhbmQgZ2V0IHRva2VuXG4gIHZhciBoYXNCZWVuUnVuVGltZXMgPSAwO1xuICByZXR1cm4gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBoYXNCZWVuUnVuVGltZXMrK1xuICAgIGlmIChoYXNCZWVuUnVuVGltZXMgPiA1KSB7XG4gICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdDYW5ub3QgcmVhY2ggc2VydmVyJyk7XG4gICAgICBjYWxsYmFjayhudWxsLCBlcnIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdXJsID0gJy90b2tlbic7XG4gICAgdmFyIHRva2VuUmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHRva2VuUmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgdG9rZW5SZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIHRva2VuID0gdG9rZW5SZXF1ZXN0LnJlc3BvbnNlVGV4dDtcbiAgICAgIGNhbGxiYWNrKHRva2VuKTtcbiAgICB9O1xuICAgIHRva2VuUmVxdWVzdC5zZW5kKCk7XG4gIH1cbn0pKCk7XG5cbmV4cG9ydHMuaW5pdFB1YlN1YiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbyAgICAgICAgID0gJCh7fSk7XG4gICQuc3Vic2NyaWJlICAgPSBvLm9uLmJpbmQobyk7XG4gICQudW5zdWJzY3JpYmUgPSBvLm9mZi5iaW5kKG8pO1xuICAkLnB1Ymxpc2ggICAgID0gby50cmlnZ2VyLmJpbmQobyk7XG59IiwiXG5cbmV4cG9ydHMuaW5pdEFuaW1hdGVQYW5lbCA9IGZ1bmN0aW9uKCkge1xuICAkKCcucGFuZWwtaGVhZGluZyBzcGFuLmNsaWNrYWJsZScpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoJCh0aGlzKS5oYXNDbGFzcygncGFuZWwtY29sbGFwc2VkJykpIHtcbiAgICAgIC8vIGV4cGFuZCB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZURvd24oKTtcbiAgICAgICQodGhpcykucmVtb3ZlQ2xhc3MoJ3BhbmVsLWNvbGxhcHNlZCcpO1xuICAgICAgJCh0aGlzKS5maW5kKCdpJykucmVtb3ZlQ2xhc3MoJ2NhcmV0LWRvd24nKS5hZGRDbGFzcygnY2FyZXQtdXAnKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBjb2xsYXBzZSB0aGUgcGFuZWxcbiAgICAgICQodGhpcykucGFyZW50cygnLnBhbmVsJykuZmluZCgnLnBhbmVsLWJvZHknKS5zbGlkZVVwKCk7XG4gICAgICAkKHRoaXMpLmFkZENsYXNzKCdwYW5lbC1jb2xsYXBzZWQnKTtcbiAgICAgICQodGhpcykuZmluZCgnaScpLnJlbW92ZUNsYXNzKCdjYXJldC11cCcpLmFkZENsYXNzKCdjYXJldC1kb3duJyk7XG4gICAgfVxuICB9KTtcbn1cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LmpRdWVyeSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwualF1ZXJ5IDogbnVsbCk7XG52YXIgc2Nyb2xsZWQgPSBmYWxzZTtcblxudmFyIHNob3dUaW1lc3RhbXAgPSBmdW5jdGlvbih0aW1lc3RhbXBzLCBjb25maWRlbmNlcykge1xuICB2YXIgd29yZCA9IHRpbWVzdGFtcHNbMF0sXG4gICAgICB0MCA9IHRpbWVzdGFtcHNbMV0sXG4gICAgICB0MSA9IHRpbWVzdGFtcHNbMl07XG4gIHZhciB0aW1lbGVuZ3RoID0gdDEgLSB0MDtcbiAgLy8gU2hvdyBjb25maWRlbmNlIGlmIGRlZmluZWQsIGVsc2UgJ24vYSdcbiAgdmFyIGRpc3BsYXlDb25maWRlbmNlID0gY29uZmlkZW5jZXMgPyBjb25maWRlbmNlc1sxXS50b1N0cmluZygpLnN1YnN0cmluZygwLCAzKSA6ICduL2EnO1xuICAkKCcjbWV0YWRhdGFUYWJsZSA+IHRib2R5Omxhc3QtY2hpbGQnKS5hcHBlbmQoXG4gICAgICAnPHRyPidcbiAgICAgICsgJzx0ZD4nICsgd29yZCArICc8L3RkPidcbiAgICAgICsgJzx0ZD4nICsgdDAgKyAnPC90ZD4nXG4gICAgICArICc8dGQ+JyArIHQxICsgJzwvdGQ+J1xuICAgICAgKyAnPHRkPicgKyBkaXNwbGF5Q29uZmlkZW5jZSArICc8L3RkPidcbiAgICAgICsgJzwvdHI+J1xuICAgICAgKTtcbn1cblxuXG52YXIgc2hvd01ldGFEYXRhID0gZnVuY3Rpb24oYWx0ZXJuYXRpdmUpIHtcbiAgdmFyIGNvbmZpZGVuY2VOZXN0ZWRBcnJheSA9IGFsdGVybmF0aXZlLndvcmRfY29uZmlkZW5jZTs7XG4gIHZhciB0aW1lc3RhbXBOZXN0ZWRBcnJheSA9IGFsdGVybmF0aXZlLnRpbWVzdGFtcHM7XG4gIGlmIChjb25maWRlbmNlTmVzdGVkQXJyYXkgJiYgY29uZmlkZW5jZU5lc3RlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbmZpZGVuY2VOZXN0ZWRBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHRpbWVzdGFtcHMgPSB0aW1lc3RhbXBOZXN0ZWRBcnJheVtpXTtcbiAgICAgIHZhciBjb25maWRlbmNlcyA9IGNvbmZpZGVuY2VOZXN0ZWRBcnJheVtpXTtcbiAgICAgIHNob3dUaW1lc3RhbXAodGltZXN0YW1wcywgY29uZmlkZW5jZXMpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRpbWVzdGFtcE5lc3RlZEFycmF5ICYmIHRpbWVzdGFtcE5lc3RlZEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgIHRpbWVzdGFtcE5lc3RlZEFycmF5LmZvckVhY2goZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgICAgIHNob3dUaW1lc3RhbXAodGltZXN0YW1wKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG52YXIgQWx0ZXJuYXRpdmVzID0gZnVuY3Rpb24oKXtcblxuICB2YXIgc3RyaW5nT25lID0gJycsXG4gICAgc3RyaW5nVHdvID0gJycsXG4gICAgc3RyaW5nVGhyZWUgPSAnJztcblxuICB0aGlzLmNsZWFyU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgc3RyaW5nT25lID0gJyc7XG4gICAgc3RyaW5nVHdvID0gJyc7XG4gICAgc3RyaW5nVGhyZWUgPSAnJztcbiAgfTtcblxuICB0aGlzLnNob3dBbHRlcm5hdGl2ZXMgPSBmdW5jdGlvbihhbHRlcm5hdGl2ZXMsIGlzRmluYWwsIHRlc3RpbmcpIHtcbiAgICB2YXIgJGh5cG90aGVzZXMgPSAkKCcuaHlwb3RoZXNlcyBvbCcpO1xuICAgICRoeXBvdGhlc2VzLmVtcHR5KCk7XG4gICAgLy8gJGh5cG90aGVzZXMuYXBwZW5kKCQoJzwvYnI+JykpO1xuICAgIGFsdGVybmF0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uKGFsdGVybmF0aXZlLCBpZHgpIHtcbiAgICAgIHZhciAkYWx0ZXJuYXRpdmU7XG4gICAgICBpZiAoYWx0ZXJuYXRpdmUudHJhbnNjcmlwdCkge1xuICAgICAgICBjb25zb2xlLmxvZygnQUxURVJOQVRJVkVTIElOREVYJywgaWR4KTtcbiAgICAgICAgdmFyIHRyYW5zY3JpcHQgPSBhbHRlcm5hdGl2ZS50cmFuc2NyaXB0LnJlcGxhY2UoLyVIRVNJVEFUSU9OXFxzL2csICcnKTtcbiAgICAgICAgdHJhbnNjcmlwdCA9IHRyYW5zY3JpcHQucmVwbGFjZSgvKC4pXFwxezIsfS9nLCAnJyk7XG4gICAgICAgIHN3aXRjaCAoaWR4KSB7XG4gICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgc3RyaW5nT25lID0gc3RyaW5nT25lICsgdHJhbnNjcmlwdDtcbiAgICAgICAgICAgICRhbHRlcm5hdGl2ZSA9ICQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBzdHJpbmdPbmUgKyAnPC9saT4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHN0cmluZ1R3byA9IHN0cmluZ1R3byArIHRyYW5zY3JpcHQ7XG4gICAgICAgICAgICAkYWx0ZXJuYXRpdmUgPSAkKCc8bGkgZGF0YS1oeXBvdGhlc2lzLWluZGV4PScgKyBpZHggKyAnID4nICsgc3RyaW5nVHdvICsgJzwvbGk+Jyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBzdHJpbmdUaHJlZSA9IHN0cmluZ1RocmVlICsgdHJhbnNjcmlwdDtcbiAgICAgICAgICAgICRhbHRlcm5hdGl2ZSA9ICQoJzxsaSBkYXRhLWh5cG90aGVzaXMtaW5kZXg9JyArIGlkeCArICcgPicgKyBzdHJpbmdUaHJlZSArICc8L2xpPicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgJGh5cG90aGVzZXMuYXBwZW5kKCRhbHRlcm5hdGl2ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59XG5cbnZhciBhbHRlcm5hdGl2ZVByb3RvdHlwZSA9IG5ldyBBbHRlcm5hdGl2ZXMoKTtcblxuLy8gVE9ETzogQ29udmVydCB0byBjbG9zdXJlIGFwcHJvYWNoXG52YXIgcHJvY2Vzc1N0cmluZyA9IGZ1bmN0aW9uKGJhc2VTdHJpbmcsIGlzRmluaXNoZWQpIHtcblxuICBpZiAoaXNGaW5pc2hlZCkge1xuICAgIHZhciBmb3JtYXR0ZWRTdHJpbmcgPSBiYXNlU3RyaW5nLnNsaWNlKDAsIC0xKTtcbiAgICBmb3JtYXR0ZWRTdHJpbmcgPSBmb3JtYXR0ZWRTdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBmb3JtYXR0ZWRTdHJpbmcuc3Vic3RyaW5nKDEpO1xuICAgIGZvcm1hdHRlZFN0cmluZyA9IGZvcm1hdHRlZFN0cmluZy50cmltKCkgKyAnLic7XG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGZvcm1hdHRlZFN0cmluZyk7XG4gIH0gZWxzZSB7XG4gICAgJCgnI3Jlc3VsdHNUZXh0JykudmFsKGJhc2VTdHJpbmcpO1xuICB9XG5cbn1cblxuZXhwb3J0cy5zaG93SlNPTiA9IGZ1bmN0aW9uKG1zZywgYmFzZUpTT04pIHtcbiAgdmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeShtc2csIG51bGwsIDIpO1xuICBiYXNlSlNPTiArPSBqc29uO1xuICBiYXNlSlNPTiArPSAnXFxuJztcbiAgJCgnI3Jlc3VsdHNKU09OJykudmFsKGJhc2VKU09OKTtcbiAgcmV0dXJuIGJhc2VKU09OO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTY3JvbGwoKXtcbiAgICBpZighc2Nyb2xsZWQpe1xuICAgICAgICB2YXIgZWxlbWVudCA9ICQoJy50YWJsZS1zY3JvbGwnKS5nZXQoMCk7XG4gICAgICAgIGVsZW1lbnQuc2Nyb2xsVG9wID0gZWxlbWVudC5zY3JvbGxIZWlnaHQ7XG4gICAgfVxufVxuXG52YXIgaW5pdFNjcm9sbCA9IGZ1bmN0aW9uKCkge1xuICAkKCcudGFibGUtc2Nyb2xsJykub24oJ3Njcm9sbCcsIGZ1bmN0aW9uKCl7XG4gICAgICBzY3JvbGxlZD10cnVlO1xuICB9KTtcbn1cblxuXG5leHBvcnRzLnNob3dSZXN1bHQgPSBmdW5jdGlvbihtc2csIGJhc2VTdHJpbmcsIGNhbGxiYWNrKSB7XG5cbiAgdmFyIGlkeCA9ICttc2cucmVzdWx0X2luZGV4O1xuXG4gIGlmIChtc2cucmVzdWx0cyAmJiBtc2cucmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cbiAgICB2YXIgYWx0ZXJuYXRpdmVzID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzO1xuICAgIHZhciB0ZXh0ID0gbXNnLnJlc3VsdHNbMF0uYWx0ZXJuYXRpdmVzWzBdLnRyYW5zY3JpcHQgfHwgJyc7XG5cbiAgICAvL0NhcGl0YWxpemUgZmlyc3Qgd29yZFxuICAgIC8vIGlmIGZpbmFsIHJlc3VsdHMsIGFwcGVuZCBhIG5ldyBwYXJhZ3JhcGhcbiAgICBpZiAobXNnLnJlc3VsdHMgJiYgbXNnLnJlc3VsdHNbMF0gJiYgbXNnLnJlc3VsdHNbMF0uZmluYWwpIHtcbiAgICAgIGJhc2VTdHJpbmcgKz0gdGV4dDtcbiAgICAgIHZhciBkaXNwbGF5RmluYWxTdHJpbmcgPSBiYXNlU3RyaW5nO1xuICAgICAgZGlzcGxheUZpbmFsU3RyaW5nID0gZGlzcGxheUZpbmFsU3RyaW5nLnJlcGxhY2UoLyVIRVNJVEFUSU9OXFxzL2csICcnKTtcbiAgICAgIGRpc3BsYXlGaW5hbFN0cmluZyA9IGRpc3BsYXlGaW5hbFN0cmluZy5yZXBsYWNlKC8oLilcXDF7Mix9L2csICcnKTtcbiAgICAgIHByb2Nlc3NTdHJpbmcoZGlzcGxheUZpbmFsU3RyaW5nLCB0cnVlKTtcbiAgICAgIHNob3dNZXRhRGF0YShhbHRlcm5hdGl2ZXNbMF0pO1xuICAgICAgLy8gT25seSBzaG93IGFsdGVybmF0aXZlcyBpZiB3ZSdyZSBmaW5hbFxuICAgICAgYWx0ZXJuYXRpdmVQcm90b3R5cGUuc2hvd0FsdGVybmF0aXZlcyhhbHRlcm5hdGl2ZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgdGVtcFN0cmluZyA9IGJhc2VTdHJpbmcgKyB0ZXh0O1xuICAgICAgdGVtcFN0cmluZyA9IHRlbXBTdHJpbmcucmVwbGFjZSgvJUhFU0lUQVRJT05cXHMvZywgJycpO1xuICAgICAgdGVtcFN0cmluZyA9IHRlbXBTdHJpbmcucmVwbGFjZSgvKC4pXFwxezIsfS9nLCAnJyk7XG4gICAgICBwcm9jZXNzU3RyaW5nKHRlbXBTdHJpbmcsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVTY3JvbGwoKTtcblxuICByZXR1cm4gYmFzZVN0cmluZztcblxufTtcblxuJC5zdWJzY3JpYmUoJ2NsZWFyc2NyZWVuJywgZnVuY3Rpb24oKSB7XG4gIHZhciAkaHlwb3RoZXNlcyA9ICQoJy5oeXBvdGhlc2VzIHVsJyk7XG4gIHNjcm9sbGVkID0gZmFsc2U7XG4gICRoeXBvdGhlc2VzLmVtcHR5KCk7XG4gIGFsdGVybmF0aXZlUHJvdG90eXBlLmNsZWFyU3RyaW5nKCk7XG59KTsiLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIGhhbmRsZVNlbGVjdGVkRmlsZSA9IHJlcXVpcmUoJy4vZmlsZXVwbG9hZCcpLmhhbmRsZVNlbGVjdGVkRmlsZTtcblxuZXhwb3J0cy5pbml0RHJhZ0Ryb3AgPSBmdW5jdGlvbihjdHgpIHtcblxuICB2YXIgZHJhZ0FuZERyb3BUYXJnZXQgPSAkKGRvY3VtZW50KTtcblxuICBkcmFnQW5kRHJvcFRhcmdldC5vbignZHJhZ2VudGVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfSk7XG5cbiAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfSk7XG5cbiAgZHJhZ0FuZERyb3BUYXJnZXQub24oJ2Ryb3AnLCBmdW5jdGlvbiAoZSkge1xuICAgIGNvbnNvbGUubG9nKCdGaWxlIGRyb3BwZWQnKTtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgdmFyIGV2dCA9IGUub3JpZ2luYWxFdmVudDtcbiAgICAvLyBIYW5kbGUgZHJhZ2dlZCBmaWxlIGV2ZW50XG4gICAgaGFuZGxlRmlsZVVwbG9hZEV2ZW50KGV2dCk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVVcGxvYWRFdmVudChldnQpIHtcbiAgICAvLyBJbml0IGZpbGUgdXBsb2FkIHdpdGggZGVmYXVsdCBtb2RlbFxuICAgIHZhciBmaWxlID0gZXZ0LmRhdGFUcmFuc2Zlci5maWxlc1swXTtcbiAgICBoYW5kbGVTZWxlY3RlZEZpbGUoY3R4LnRva2VuLCBmaWxlKTtcbiAgfVxuXG59XG4iLCJcblxuXG5leHBvcnRzLmZsYXNoU1ZHID0gZnVuY3Rpb24oZWwpIHtcbiAgZWwuY3NzKHsgZmlsbDogJyNBNTM3MjUnIH0pO1xuICBmdW5jdGlvbiBsb29wKCkge1xuICAgIGVsLmFuaW1hdGUoeyBmaWxsOiAnI0E1MzcyNScgfSxcbiAgICAgICAgMTAwMCwgJ2xpbmVhcicpXG4gICAgICAuYW5pbWF0ZSh7IGZpbGw6ICd3aGl0ZScgfSxcbiAgICAgICAgICAxMDAwLCAnbGluZWFyJyk7XG4gIH1cbiAgLy8gcmV0dXJuIHRpbWVyXG4gIHZhciB0aW1lciA9IHNldFRpbWVvdXQobG9vcCwgMjAwMCk7XG4gIHJldHVybiB0aW1lcjtcbn07XG5cbmV4cG9ydHMuc3RvcEZsYXNoU1ZHID0gZnVuY3Rpb24odGltZXIpIHtcbiAgZWwuY3NzKHsgZmlsbDogJ3doaXRlJyB9ICk7XG4gIGNsZWFySW50ZXJ2YWwodGltZXIpO1xufVxuXG5leHBvcnRzLnRvZ2dsZUltYWdlID0gZnVuY3Rpb24oZWwsIG5hbWUpIHtcbiAgaWYoZWwuYXR0cignc3JjJykgPT09ICdpbWFnZXMvJyArIG5hbWUgKyAnLnN2ZycpIHtcbiAgICBlbC5hdHRyKFwic3JjXCIsICdpbWFnZXMvc3RvcC1yZWQuc3ZnJyk7XG4gIH0gZWxzZSB7XG4gICAgZWwuYXR0cignc3JjJywgJ2ltYWdlcy9zdG9wLnN2ZycpO1xuICB9XG59XG5cbnZhciByZXN0b3JlSW1hZ2UgPSBleHBvcnRzLnJlc3RvcmVJbWFnZSA9IGZ1bmN0aW9uKGVsLCBuYW1lKSB7XG4gIGVsLmF0dHIoJ3NyYycsICdpbWFnZXMvJyArIG5hbWUgKyAnLnN2ZycpO1xufVxuXG5leHBvcnRzLnN0b3BUb2dnbGVJbWFnZSA9IGZ1bmN0aW9uKHRpbWVyLCBlbCwgbmFtZSkge1xuICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgcmVzdG9yZUltYWdlKGVsLCBuYW1lKTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2hvd0Vycm9yID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93RXJyb3I7XG52YXIgc2hvd05vdGljZSA9IHJlcXVpcmUoJy4vc2hvd2Vycm9yJykuc2hvd05vdGljZTtcbnZhciBoYW5kbGVGaWxlVXBsb2FkID0gcmVxdWlyZSgnLi4vaGFuZGxlZmlsZXVwbG9hZCcpLmhhbmRsZUZpbGVVcGxvYWQ7XG52YXIgZWZmZWN0cyA9IHJlcXVpcmUoJy4vZWZmZWN0cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuLy8gTmVlZCB0byByZW1vdmUgdGhlIHZpZXcgbG9naWMgaGVyZSBhbmQgbW92ZSB0aGlzIG91dCB0byB0aGUgaGFuZGxlZmlsZXVwbG9hZCBjb250cm9sbGVyXG52YXIgaGFuZGxlU2VsZWN0ZWRGaWxlID0gZXhwb3J0cy5oYW5kbGVTZWxlY3RlZEZpbGUgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgcnVubmluZyA9IGZhbHNlO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKHRva2VuLCBmaWxlKSB7XG5cbiAgICB2YXIgY3VycmVudGx5RGlzcGxheWluZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnKSk7XG5cbiAgICAvLyBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgIC8vICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgYW5vdGhlciBmaWxlIGlzIHBsYXlpbmcsIHBsZWFzZSBzdG9wIHRoZSBmaWxlIG9yIHdhaXQgdW50aWwgaXQgZmluaXNoZXMnKTtcbiAgICAvLyAgIHJldHVybjtcbiAgICAvLyB9XG5cbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuICAgIHJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgLy8gVmlzdWFsIGVmZmVjdHNcbiAgICB2YXIgdXBsb2FkSW1hZ2VUYWcgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IGltZycpO1xuICAgIHZhciB0aW1lciA9IHNldEludGVydmFsKGVmZmVjdHMudG9nZ2xlSW1hZ2UsIDc1MCwgdXBsb2FkSW1hZ2VUYWcsICdzdG9wJyk7XG4gICAgdmFyIHVwbG9hZFRleHQgPSAkKCcjZmlsZVVwbG9hZFRhcmdldCA+IHNwYW4nKTtcbiAgICB1cGxvYWRUZXh0LnRleHQoJ1N0b3AgVHJhbnNjcmliaW5nJyk7XG5cbiAgICBmdW5jdGlvbiByZXN0b3JlVXBsb2FkVGFiKCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICBlZmZlY3RzLnJlc3RvcmVJbWFnZSh1cGxvYWRJbWFnZVRhZywgJ3VwbG9hZCcpO1xuICAgICAgdXBsb2FkVGV4dC50ZXh0KCdTZWxlY3QgRmlsZScpO1xuICAgIH1cblxuICAgIC8vIENsZWFyIGZsYXNoaW5nIGlmIHNvY2tldCB1cGxvYWQgaXMgc3RvcHBlZFxuICAgICQuc3Vic2NyaWJlKCdoYXJkc29ja2V0c3RvcCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJlc3RvcmVVcGxvYWRUYWIoKTtcbiAgICB9KTtcblxuXG4gICAgLy8gR2V0IGN1cnJlbnQgbW9kZWxcbiAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICAgIGNvbnNvbGUubG9nKCdjdXJyZW50TW9kZWwnLCBjdXJyZW50TW9kZWwpO1xuXG4gICAgLy8gUmVhZCBmaXJzdCA0IGJ5dGVzIHRvIGRldGVybWluZSBoZWFkZXJcbiAgICB2YXIgYmxvYlRvVGV4dCA9IG5ldyBCbG9iKFtmaWxlXSkuc2xpY2UoMCwgNCk7XG4gICAgdmFyIHIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIHIucmVhZEFzVGV4dChibG9iVG9UZXh0KTtcbiAgICByLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvbnRlbnRUeXBlO1xuICAgICAgaWYgKHIucmVzdWx0ID09PSAnZkxhQycpIHtcbiAgICAgICAgY29udGVudFR5cGUgPSAnYXVkaW8vZmxhYyc7XG4gICAgICAgIHNob3dOb3RpY2UoJ05vdGljZTogYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgcGxheWluZyBGTEFDIGF1ZGlvLCBzbyBubyBhdWRpbyB3aWxsIGFjY29tcGFueSB0aGUgdHJhbnNjcmlwdGlvbicpO1xuICAgICAgfSBlbHNlIGlmIChyLnJlc3VsdCA9PT0gJ1JJRkYnKSB7XG4gICAgICAgIGNvbnRlbnRUeXBlID0gJ2F1ZGlvL3dhdic7XG4gICAgICAgIHZhciBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgICB2YXIgd2F2QmxvYiA9IG5ldyBCbG9iKFtmaWxlXSwge3R5cGU6ICdhdWRpby93YXYnfSk7XG4gICAgICAgIHZhciB3YXZVUkwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKHdhdkJsb2IpO1xuICAgICAgICBhdWRpby5zcmMgPSB3YXZVUkw7XG4gICAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICAgICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdG9yZVVwbG9hZFRhYigpO1xuICAgICAgICBzaG93RXJyb3IoJ09ubHkgV0FWIG9yIEZMQUMgZmlsZXMgY2FuIGJlIHRyYW5zY3JpYmVkLCBwbGVhc2UgdHJ5IGFub3RoZXIgZmlsZSBmb3JtYXQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaGFuZGxlRmlsZVVwbG9hZCh0b2tlbiwgY3VycmVudE1vZGVsLCBmaWxlLCBjb250ZW50VHlwZSwgZnVuY3Rpb24oc29ja2V0KSB7XG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IoW2ZpbGVdKTtcbiAgICAgICAgdmFyIHBhcnNlT3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlOiBibG9iXG4gICAgICAgIH07XG4gICAgICAgIHV0aWxzLm9uRmlsZVByb2dyZXNzKHBhcnNlT3B0aW9ucyxcbiAgICAgICAgICAvLyBPbiBkYXRhIGNodW5rXG4gICAgICAgICAgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICAgIHNvY2tldC5zZW5kKGNodW5rKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIE9uIGZpbGUgcmVhZCBlcnJvclxuICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yIHJlYWRpbmcgZmlsZTogJywgZXZ0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgc2hvd0Vycm9yKCdFcnJvcjogJyArIGV2dC5tZXNzYWdlKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIE9uIGxvYWQgZW5kXG4gICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0sIFxuICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICBlZmZlY3RzLnN0b3BUb2dnbGVJbWFnZSh0aW1lciwgdXBsb2FkSW1hZ2VUYWcsICd1cGxvYWQnKTtcbiAgICAgICAgICB1cGxvYWRUZXh0LnRleHQoJ1NlbGVjdCBGaWxlJyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfTtcbiAgfVxufSkoKTtcblxuXG5leHBvcnRzLmluaXRGaWxlVXBsb2FkID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgdmFyIGZpbGVVcGxvYWREaWFsb2cgPSAkKFwiI2ZpbGVVcGxvYWREaWFsb2dcIik7XG5cbiAgZmlsZVVwbG9hZERpYWxvZy5jaGFuZ2UoZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGZpbGUgPSBmaWxlVXBsb2FkRGlhbG9nLmdldCgwKS5maWxlc1swXTtcbiAgICBoYW5kbGVTZWxlY3RlZEZpbGUoY3R4LnRva2VuLCBmaWxlKTtcbiAgfSk7XG5cbiAgJChcIiNmaWxlVXBsb2FkVGFyZ2V0XCIpLmNsaWNrKGZ1bmN0aW9uKGV2dCkge1xuXG4gICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuXG4gICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdIQVJEIFNPQ0tFVCBTVE9QJyk7XG4gICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmaWxlVXBsb2FkRGlhbG9nLnZhbChudWxsKTtcblxuICAgIGZpbGVVcGxvYWREaWFsb2dcbiAgICAudHJpZ2dlcignY2xpY2snKTtcblxuICB9KTtcblxufSIsIlxudmFyIGluaXRTZXNzaW9uUGVybWlzc2lvbnMgPSByZXF1aXJlKCcuL3Nlc3Npb25wZXJtaXNzaW9ucycpLmluaXRTZXNzaW9uUGVybWlzc2lvbnM7XG52YXIgaW5pdFNlbGVjdE1vZGVsID0gcmVxdWlyZSgnLi9zZWxlY3Rtb2RlbCcpLmluaXRTZWxlY3RNb2RlbDtcbnZhciBpbml0QW5pbWF0ZVBhbmVsID0gcmVxdWlyZSgnLi9hbmltYXRlcGFuZWwnKS5pbml0QW5pbWF0ZVBhbmVsO1xudmFyIGluaXRTaG93VGFiID0gcmVxdWlyZSgnLi9zaG93dGFiJykuaW5pdFNob3dUYWI7XG52YXIgaW5pdERyYWdEcm9wID0gcmVxdWlyZSgnLi9kcmFnZHJvcCcpLmluaXREcmFnRHJvcDtcbnZhciBpbml0UGxheVNhbXBsZSA9IHJlcXVpcmUoJy4vcGxheXNhbXBsZScpLmluaXRQbGF5U2FtcGxlO1xudmFyIGluaXRSZWNvcmRCdXR0b24gPSByZXF1aXJlKCcuL3JlY29yZGJ1dHRvbicpLmluaXRSZWNvcmRCdXR0b247XG52YXIgaW5pdEZpbGVVcGxvYWQgPSByZXF1aXJlKCcuL2ZpbGV1cGxvYWQnKS5pbml0RmlsZVVwbG9hZDtcblxuXG5leHBvcnRzLmluaXRWaWV3cyA9IGZ1bmN0aW9uKGN0eCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHZpZXdzLi4uJyk7XG4gIGluaXRTZWxlY3RNb2RlbChjdHgpO1xuICBpbml0UGxheVNhbXBsZShjdHgpO1xuICBpbml0RHJhZ0Ryb3AoY3R4KTtcbiAgaW5pdFJlY29yZEJ1dHRvbihjdHgpO1xuICBpbml0RmlsZVVwbG9hZChjdHgpO1xuICBpbml0U2Vzc2lvblBlcm1pc3Npb25zKCk7XG4gIGluaXRTaG93VGFiKCk7XG4gIGluaXRBbmltYXRlUGFuZWwoKTtcbiAgaW5pdFNob3dUYWIoKTtcbn0iLCJcbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcbnZhciBvbkZpbGVQcm9ncmVzcyA9IHV0aWxzLm9uRmlsZVByb2dyZXNzO1xudmFyIGhhbmRsZUZpbGVVcGxvYWQgPSByZXF1aXJlKCcuLi9oYW5kbGVmaWxldXBsb2FkJykuaGFuZGxlRmlsZVVwbG9hZDtcbnZhciBpbml0U29ja2V0ID0gcmVxdWlyZSgnLi4vc29ja2V0JykuaW5pdFNvY2tldDtcbnZhciBzaG93RXJyb3IgPSByZXF1aXJlKCcuL3Nob3dlcnJvcicpLnNob3dFcnJvcjtcbnZhciBlZmZlY3RzID0gcmVxdWlyZSgnLi9lZmZlY3RzJyk7XG5cblxudmFyIExPT0tVUF9UQUJMRSA9IHtcbiAgJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJzogWydVc19FbmdsaXNoX0Jyb2FkYmFuZF9TYW1wbGVfMS53YXYnLCAnVXNfRW5nbGlzaF9Ccm9hZGJhbmRfU2FtcGxlXzIud2F2J10sXG4gICdlbi1VU19OYXJyb3diYW5kTW9kZWwnOiBbJ1VzX0VuZ2xpc2hfTmFycm93YmFuZF9TYW1wbGVfMS53YXYnLCAnVXNfRW5nbGlzaF9OYXJyb3diYW5kX1NhbXBsZV8yLndhdiddLFxuICAnZXMtRVNfQnJvYWRiYW5kTW9kZWwnOiBbJ0VzX0VTX3NwazI0XzE2a2h6LndhdicsICdFc19FU19zcGsxOV8xNmtoei53YXYnXSxcbiAgJ2VzLUVTX05hcnJvd2JhbmRNb2RlbCc6IFsnRXNfRVNfc3BrMjRfOGtoei53YXYnLCAnRXNfRVNfc3BrMTlfOGtoei53YXYnXSxcbiAgJ2phLUpQX0Jyb2FkYmFuZE1vZGVsJzogWydzYW1wbGUtSmFfSlAtd2lkZTEud2F2JywgJ3NhbXBsZS1KYV9KUC13aWRlMi53YXYnXSxcbiAgJ2phLUpQX05hcnJvd2JhbmRNb2RlbCc6IFsnc2FtcGxlLUphX0pQLW5hcnJvdzMud2F2JywgJ3NhbXBsZS1KYV9KUC1uYXJyb3c0LndhdiddXG59O1xuXG52YXIgcGxheVNhbXBsZSA9IChmdW5jdGlvbigpIHtcblxuICB2YXIgcnVubmluZyA9IGZhbHNlO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIGZhbHNlKTtcblxuICByZXR1cm4gZnVuY3Rpb24odG9rZW4sIGltYWdlVGFnLCBpY29uTmFtZSwgdXJsLCBjYWxsYmFjaykge1xuXG4gICAgJC5wdWJsaXNoKCdjbGVhcnNjcmVlbicpO1xuXG4gICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuXG4gICAgY29uc29sZS5sb2coJ0NVUlJFTlRMWSBESVNQTEFZSU5HJywgY3VycmVudGx5RGlzcGxheWluZyk7XG5cbiAgICAvLyBUaGlzIGVycm9yIGhhbmRsaW5nIG5lZWRzIHRvIGJlIGV4cGFuZGVkIHRvIGFjY29tb2RhdGVcbiAgICAvLyB0aGUgdHdvIGRpZmZlcmVudCBwbGF5IHNhbXBsZXMgZmlsZXNcbiAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgY29uc29sZS5sb2coJ0hBUkQgU09DS0VUIFNUT1AnKTtcbiAgICAgICQucHVibGlzaCgnc29ja2V0c3RvcCcpO1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRseURpc3BsYXlpbmcnLCBmYWxzZSk7XG4gICAgICBlZmZlY3RzLnN0b3BUb2dnbGVJbWFnZSh0aW1lciwgaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgIGVmZmVjdHMucmVzdG9yZUltYWdlKGltYWdlVGFnLCBpY29uTmFtZSk7XG4gICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbnRseURpc3BsYXlpbmcgJiYgcnVubmluZykge1xuICAgICAgc2hvd0Vycm9yKCdDdXJyZW50bHkgYW5vdGhlciBmaWxlIGlzIHBsYXlpbmcsIHBsZWFzZSBzdG9wIHRoZSBmaWxlIG9yIHdhaXQgdW50aWwgaXQgZmluaXNoZXMnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudGx5RGlzcGxheWluZycsIHRydWUpO1xuICAgIHJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIHRpbWVyID0gc2V0SW50ZXJ2YWwoZWZmZWN0cy50b2dnbGVJbWFnZSwgNzUwLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuXG4gICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYic7XG4gICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIHZhciBibG9iID0geGhyLnJlc3BvbnNlO1xuICAgICAgdmFyIGN1cnJlbnRNb2RlbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50TW9kZWwnKSB8fCAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICAgICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICB2YXIgYmxvYlRvVGV4dCA9IG5ldyBCbG9iKFtibG9iXSkuc2xpY2UoMCwgNCk7XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChibG9iVG9UZXh0KTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0gcmVhZGVyLnJlc3VsdCA9PT0gJ2ZMYUMnID8gJ2F1ZGlvL2ZsYWMnIDogJ2F1ZGlvL3dhdic7XG4gICAgICAgIGNvbnNvbGUubG9nKCdVcGxvYWRpbmcgZmlsZScsIHJlYWRlci5yZXN1bHQpO1xuICAgICAgICB2YXIgbWVkaWFTb3VyY2VVUkwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgICAgICB2YXIgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICAgICAgYXVkaW8uc3JjID0gbWVkaWFTb3VyY2VVUkw7XG4gICAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICAgICAgJC5zdWJzY3JpYmUoJ2hhcmRzb2NrZXRzdG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgYXVkaW8ucGF1c2UoKTtcbiAgICAgICAgICBhdWRpby5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIH0pO1xuICAgICAgICAkLnN1YnNjcmliZSgnc29ja2V0c3RvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGF1ZGlvLnBhdXNlKCk7XG4gICAgICAgICAgYXVkaW8uY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB9KTtcbiAgICAgICAgaGFuZGxlRmlsZVVwbG9hZCh0b2tlbiwgY3VycmVudE1vZGVsLCBibG9iLCBjb250ZW50VHlwZSwgZnVuY3Rpb24oc29ja2V0KSB7XG4gICAgICAgICAgdmFyIHBhcnNlT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGZpbGU6IGJsb2JcbiAgICAgICAgICB9O1xuICAgICAgICAgIG9uRmlsZVByb2dyZXNzKHBhcnNlT3B0aW9ucyxcbiAgICAgICAgICAgIC8vIE9uIGRhdGEgY2h1bmtcbiAgICAgICAgICAgIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgICAgICAgICAgIHNvY2tldC5zZW5kKGNodW5rKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBPbiBmaWxlIHJlYWQgZXJyb3JcbiAgICAgICAgICAgIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgcmVhZGluZyBmaWxlOiAnLCBldnQubWVzc2FnZSk7XG4gICAgICAgICAgICAgIC8vIHNob3dFcnJvcihldnQubWVzc2FnZSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gT24gbG9hZCBlbmRcbiAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7J2FjdGlvbic6ICdzdG9wJ30pKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBcbiAgICAgICAgLy8gT24gY29ubmVjdGlvbiBlbmRcbiAgICAgICAgICBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgIGVmZmVjdHMuc3RvcFRvZ2dsZUltYWdlKHRpbWVyLCBpbWFnZVRhZywgaWNvbk5hbWUpO1xuICAgICAgICAgICAgZWZmZWN0cy5yZXN0b3JlSW1hZ2UoaW1hZ2VUYWcsIGljb25OYW1lKTtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJywgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfTtcbiAgICB4aHIuc2VuZCgpO1xuICB9O1xufSkoKTtcblxuXG5leHBvcnRzLmluaXRQbGF5U2FtcGxlID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBmaWxlTmFtZSA9ICdhdWRpby8nICsgTE9PS1VQX1RBQkxFW2N0eC5jdXJyZW50TW9kZWxdWzBdO1xuICAgIHZhciBlbCA9ICQoJy5wbGF5LXNhbXBsZS0xJyk7XG4gICAgZWwub2ZmKCdjbGljaycpO1xuICAgIHZhciBpY29uTmFtZSA9ICdwbGF5JztcbiAgICB2YXIgaW1hZ2VUYWcgPSBlbC5maW5kKCdpbWcnKTtcbiAgICBlbC5jbGljayggZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBwbGF5U2FtcGxlKGN0eC50b2tlbiwgaW1hZ2VUYWcsIGljb25OYW1lLCBmaWxlTmFtZSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdQbGF5IHNhbXBsZSByZXN1bHQnLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pKGN0eCwgTE9PS1VQX1RBQkxFKTtcblxuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZpbGVOYW1lID0gJ2F1ZGlvLycgKyBMT09LVVBfVEFCTEVbY3R4LmN1cnJlbnRNb2RlbF1bMV07XG4gICAgdmFyIGVsID0gJCgnLnBsYXktc2FtcGxlLTInKTtcbiAgICBlbC5vZmYoJ2NsaWNrJyk7XG4gICAgdmFyIGljb25OYW1lID0gJ3BsYXknO1xuICAgIHZhciBpbWFnZVRhZyA9IGVsLmZpbmQoJ2ltZycpO1xuICAgIGVsLmNsaWNrKCBmdW5jdGlvbihldnQpIHtcbiAgICAgIHBsYXlTYW1wbGUoY3R4LnRva2VuLCBpbWFnZVRhZywgaWNvbk5hbWUsIGZpbGVOYW1lLCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1BsYXkgc2FtcGxlIHJlc3VsdCcsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSkoY3R4LCBMT09LVVBfVEFCTEUpO1xuXG59OyIsIlxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4uL01pY3JvcGhvbmUnKTtcbnZhciBoYW5kbGVNaWNyb3Bob25lID0gcmVxdWlyZSgnLi4vaGFuZGxlbWljcm9waG9uZScpLmhhbmRsZU1pY3JvcGhvbmU7XG52YXIgc2hvd0Vycm9yID0gcmVxdWlyZSgnLi9zaG93ZXJyb3InKS5zaG93RXJyb3I7XG5cbmV4cG9ydHMuaW5pdFJlY29yZEJ1dHRvbiA9IGZ1bmN0aW9uKGN0eCkge1xuXG4gIHZhciByZWNvcmRCdXR0b24gPSAkKCcjcmVjb3JkQnV0dG9uJyk7XG5cbiAgcmVjb3JkQnV0dG9uLmNsaWNrKChmdW5jdGlvbigpIHtcblxuICAgIHZhciBydW5uaW5nID0gZmFsc2U7XG4gICAgdmFyIHRva2VuID0gY3R4LnRva2VuO1xuICAgIHZhciBtaWNPcHRpb25zID0ge1xuICAgICAgYnVmZmVyU2l6ZTogY3R4LmJ1ZmZlcnNpemVcbiAgICB9O1xuICAgIHZhciBtaWMgPSBuZXcgTWljcm9waG9uZShtaWNPcHRpb25zKTtcblxuICAgIHJldHVybiBmdW5jdGlvbihldnQpIHtcbiAgICAgIC8vIFByZXZlbnQgZGVmYXVsdCBhbmNob3IgYmVoYXZpb3JcbiAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICB2YXIgY3VycmVudE1vZGVsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2N1cnJlbnRNb2RlbCcpO1xuICAgICAgdmFyIGN1cnJlbnRseURpc3BsYXlpbmcgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjdXJyZW50bHlEaXNwbGF5aW5nJykpO1xuXG4gICAgICBpZiAoY3VycmVudGx5RGlzcGxheWluZykge1xuICAgICAgICBzaG93RXJyb3IoJ0N1cnJlbnRseSBhbm90aGVyIGZpbGUgaXMgcGxheWluZywgcGxlYXNlIHN0b3AgdGhlIGZpbGUgb3Igd2FpdCB1bnRpbCBpdCBmaW5pc2hlcycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghcnVubmluZykge1xuICAgICAgICBjb25zb2xlLmxvZygnTm90IHJ1bm5pbmcsIGhhbmRsZU1pY3JvcGhvbmUoKScpO1xuICAgICAgICBoYW5kbGVNaWNyb3Bob25lKHRva2VuLCBjdXJyZW50TW9kZWwsIG1pYywgZnVuY3Rpb24oZXJyLCBzb2NrZXQpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB2YXIgbXNnID0gJ0Vycm9yOiAnICsgZXJyLm1lc3NhZ2U7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhtc2cpO1xuICAgICAgICAgICAgc2hvd0Vycm9yKG1zZyk7XG4gICAgICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlY29yZEJ1dHRvbi5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICAgICAgICAgICAgcmVjb3JkQnV0dG9uLmZpbmQoJ2ltZycpLmF0dHIoJ3NyYycsICdpbWFnZXMvc3RvcC5zdmcnKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzdGFydGluZyBtaWMnKTtcbiAgICAgICAgICAgIG1pYy5yZWNvcmQoKTtcbiAgICAgICAgICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnU3RvcHBpbmcgbWljcm9waG9uZSwgc2VuZGluZyBzdG9wIGFjdGlvbiBtZXNzYWdlJyk7XG4gICAgICAgIHJlY29yZEJ1dHRvbi5yZW1vdmVBdHRyKCdzdHlsZScpO1xuICAgICAgICByZWNvcmRCdXR0b24uZmluZCgnaW1nJykuYXR0cignc3JjJywgJ2ltYWdlcy9taWNyb3Bob25lLnN2ZycpO1xuICAgICAgICAkLnB1Ymxpc2goJ2hhcmRzb2NrZXRzdG9wJyk7XG4gICAgICAgIG1pYy5zdG9wKCk7XG4gICAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pKCkpO1xufSIsIlxudmFyIGluaXRQbGF5U2FtcGxlID0gcmVxdWlyZSgnLi9wbGF5c2FtcGxlJykuaW5pdFBsYXlTYW1wbGU7XG5cbmV4cG9ydHMuaW5pdFNlbGVjdE1vZGVsID0gZnVuY3Rpb24oY3R4KSB7XG5cbiAgZnVuY3Rpb24gaXNEZWZhdWx0KG1vZGVsKSB7XG4gICAgcmV0dXJuIG1vZGVsID09PSAnZW4tVVNfQnJvYWRiYW5kTW9kZWwnO1xuICB9XG5cbiAgY3R4Lm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJChcIiNkcm9wZG93bk1lbnVMaXN0XCIpLmFwcGVuZChcbiAgICAgICQoXCI8bGk+XCIpXG4gICAgICAgIC5hdHRyKCdyb2xlJywgJ3ByZXNlbnRhdGlvbicpXG4gICAgICAgIC5hcHBlbmQoXG4gICAgICAgICAgJCgnPGE+JykuYXR0cigncm9sZScsICdtZW51LWl0ZW0nKVxuICAgICAgICAgICAgLmF0dHIoJ2hyZWYnLCAnLycpXG4gICAgICAgICAgICAuYXR0cignZGF0YS1tb2RlbCcsIG1vZGVsLm5hbWUpXG4gICAgICAgICAgICAuYXBwZW5kKG1vZGVsLmRlc2NyaXB0aW9uKVxuICAgICAgICAgIClcbiAgICAgIClcbiAgfSk7XG5cbiAgJChcIiNkcm9wZG93bk1lbnVMaXN0XCIpLmNsaWNrKGZ1bmN0aW9uKGV2dCkge1xuICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBjb25zb2xlLmxvZygnQ2hhbmdlIHZpZXcnLCAkKGV2dC50YXJnZXQpLnRleHQoKSk7XG4gICAgdmFyIG5ld01vZGVsRGVzY3JpcHRpb24gPSAkKGV2dC50YXJnZXQpLnRleHQoKTtcbiAgICB2YXIgbmV3TW9kZWwgPSAkKGV2dC50YXJnZXQpLmRhdGEoJ21vZGVsJyk7XG4gICAgJCgnI2Ryb3Bkb3duTWVudURlZmF1bHQnKS5lbXB0eSgpLnRleHQobmV3TW9kZWxEZXNjcmlwdGlvbik7XG4gICAgJCgnI2Ryb3Bkb3duTWVudTEnKS5kcm9wZG93bigndG9nZ2xlJyk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2N1cnJlbnRNb2RlbCcsIG5ld01vZGVsKTtcbiAgICBjdHguY3VycmVudE1vZGVsID0gbmV3TW9kZWw7XG4gICAgaW5pdFBsYXlTYW1wbGUoY3R4KTtcbiAgICAkLnB1Ymxpc2goJ2NsZWFyc2NyZWVuJyk7XG4gIH0pO1xuXG59IiwiXG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuaW5pdFNlc3Npb25QZXJtaXNzaW9ucyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnSW5pdGlhbGl6aW5nIHNlc3Npb24gcGVybWlzc2lvbnMgaGFuZGxlcicpO1xuICAvLyBSYWRpbyBidXR0b25zXG4gIHZhciBzZXNzaW9uUGVybWlzc2lvbnNSYWRpbyA9ICQoXCIjc2Vzc2lvblBlcm1pc3Npb25zUmFkaW9Hcm91cCBpbnB1dFt0eXBlPSdyYWRpbyddXCIpO1xuICBzZXNzaW9uUGVybWlzc2lvbnNSYWRpby5jbGljayhmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgY2hlY2tlZFZhbHVlID0gc2Vzc2lvblBlcm1pc3Npb25zUmFkaW8uZmlsdGVyKCc6Y2hlY2tlZCcpLnZhbCgpO1xuICAgIGNvbnNvbGUubG9nKCdjaGVja2VkVmFsdWUnLCBjaGVja2VkVmFsdWUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzZXNzaW9uUGVybWlzc2lvbnMnLCBjaGVja2VkVmFsdWUpO1xuICB9KTtcbn1cbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnNob3dFcnJvciA9IGZ1bmN0aW9uKG1zZykge1xuICBjb25zb2xlLmxvZygnRXJyb3I6ICcsIG1zZyk7XG4gIHZhciBlcnJvckFsZXJ0ID0gJCgnLmVycm9yLXJvdycpO1xuICBlcnJvckFsZXJ0LmhpZGUoKTtcbiAgZXJyb3JBbGVydC5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Q3NDEwOCcpO1xuICBlcnJvckFsZXJ0LmNzcygnY29sb3InLCAnd2hpdGUnKTtcbiAgdmFyIGVycm9yTWVzc2FnZSA9ICQoJyNlcnJvck1lc3NhZ2UnKTtcbiAgZXJyb3JNZXNzYWdlLnRleHQobXNnKTtcbiAgZXJyb3JBbGVydC5zaG93KCk7XG4gICQoJyNlcnJvckNsb3NlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlcnJvckFsZXJ0LmhpZGUoKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xufVxuXG5leHBvcnRzLnNob3dOb3RpY2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgY29uc29sZS5sb2coJ05vdGljZTogJywgbXNnKTtcbiAgdmFyIG5vdGljZUFsZXJ0ID0gJCgnLm5vdGlmaWNhdGlvbi1yb3cnKTtcbiAgbm90aWNlQWxlcnQuaGlkZSgpO1xuICBub3RpY2VBbGVydC5jc3MoJ2JvcmRlcicsICcycHggc29saWQgI2VjZWNlYycpO1xuICBub3RpY2VBbGVydC5jc3MoJ2JhY2tncm91bmQtY29sb3InLCAnI2Y0ZjRmNCcpO1xuICBub3RpY2VBbGVydC5jc3MoJ2NvbG9yJywgJ2JsYWNrJyk7XG4gIHZhciBub3RpY2VNZXNzYWdlID0gJCgnI25vdGlmaWNhdGlvbk1lc3NhZ2UnKTtcbiAgbm90aWNlTWVzc2FnZS50ZXh0KG1zZyk7XG4gIG5vdGljZUFsZXJ0LnNob3coKTtcbiAgJCgnI25vdGlmaWNhdGlvbkNsb3NlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBub3RpY2VBbGVydC5oaWRlKCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KTtcbn1cblxuZXhwb3J0cy5oaWRlRXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGVycm9yQWxlcnQgPSAkKCcuZXJyb3Itcm93Jyk7XG4gIGVycm9yQWxlcnQuaGlkZSgpO1xufSIsIlxuXG5leHBvcnRzLmluaXRTaG93VGFiID0gZnVuY3Rpb24oKSB7XG4gICQoJyNuYXYtdGFicyBhJykub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICQodGhpcykudGFiKCdzaG93JylcbiAgfSk7XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0IElCTSBDb3JwLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbi8qZ2xvYmFsICQ6ZmFsc2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTWljcm9waG9uZSA9IHJlcXVpcmUoJy4vTWljcm9waG9uZScpO1xudmFyIG1vZGVscyA9IHJlcXVpcmUoJy4vZGF0YS9tb2RlbHMuanNvbicpLm1vZGVscztcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnV0aWxzLmluaXRQdWJTdWIoKTtcbnZhciBpbml0Vmlld3MgPSByZXF1aXJlKCcuL3ZpZXdzJykuaW5pdFZpZXdzO1xudmFyIHBrZyA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuXG53aW5kb3cuQlVGRkVSU0laRSA9IDgxOTI7XG5cbiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCkge1xuXG4gIC8vIFRlbXBvcmFyeSBhcHAgZGF0YVxuICAkKCcjYXBwU2V0dGluZ3MnKVxuICAgIC5odG1sKFxuICAgICAgJzxwPlZlcnNpb246ICcgKyBwa2cudmVyc2lvbiArICc8L3A+J1xuICAgICAgKyAnPHA+QnVmZmVyIFNpemU6ICcgKyBCVUZGRVJTSVpFICsgJzwvcD4nXG4gICAgKTtcblxuXG4gIC8vIE1ha2UgY2FsbCB0byBBUEkgdG8gdHJ5IGFuZCBnZXQgdG9rZW5cbiAgdXRpbHMuZ2V0VG9rZW4oZnVuY3Rpb24odG9rZW4pIHtcblxuICAgIHdpbmRvdy5vbmJlZm9yZXVubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICAgIH07XG5cbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdObyBhdXRob3JpemF0aW9uIHRva2VuIGF2YWlsYWJsZScpO1xuICAgICAgY29uc29sZS5lcnJvcignQXR0ZW1wdGluZyB0byByZWNvbm5lY3QuLi4nKTtcbiAgICB9XG5cbiAgICB2YXIgdmlld0NvbnRleHQgPSB7XG4gICAgICBjdXJyZW50TW9kZWw6ICdlbi1VU19Ccm9hZGJhbmRNb2RlbCcsXG4gICAgICBtb2RlbHM6IG1vZGVscyxcbiAgICAgIHRva2VuOiB0b2tlbixcbiAgICAgIGJ1ZmZlclNpemU6IEJVRkZFUlNJWkVcbiAgICB9O1xuXG4gICAgaW5pdFZpZXdzKHZpZXdDb250ZXh0KTtcblxuICAgIC8vIFNhdmUgbW9kZWxzIHRvIGxvY2Fsc3RvcmFnZVxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcblxuICAgIC8vIFNldCBkZWZhdWx0IGN1cnJlbnQgbW9kZWxcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY3VycmVudE1vZGVsJywgJ2VuLVVTX0Jyb2FkYmFuZE1vZGVsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3Nlc3Npb25QZXJtaXNzaW9ucycsICd0cnVlJyk7XG5cblxuICAgICQuc3Vic2NyaWJlKCdjbGVhcnNjcmVlbicsIGZ1bmN0aW9uKCkge1xuICAgICAgJCgnI3Jlc3VsdHNUZXh0JykudGV4dCgnJyk7XG4gICAgICAkKCcjcmVzdWx0c0pTT04nKS50ZXh0KCcnKTtcbiAgICAgICQoJy5lcnJvci1yb3cnKS5oaWRlKCk7XG4gICAgICAkKCcubm90aWZpY2F0aW9uLXJvdycpLmhpZGUoKTtcbiAgICAgICQoJy5oeXBvdGhlc2VzID4gdWwnKS5lbXB0eSgpO1xuICAgICAgJCgnI21ldGFkYXRhVGFibGVCb2R5JykuZW1wdHkoKTtcbiAgICB9KTtcblxuICB9KTtcblxufSk7Il19
