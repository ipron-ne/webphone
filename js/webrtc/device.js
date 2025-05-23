/*
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const selectors = [audioInputSelect, audioOutputSelect];

try {
  audioOutputSelect.disabled = !(
    "sinkId" in HTMLMediaElement.prototype || false
  );
} catch (e) {
  console.log("e : ", e);
}

var device_found;

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });

  device_found = true;
}

function updateDeviceList() {
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
}

let constraints = { audio: true, video: false };
navigator.mediaDevices.getUserMedia(constraints).then(function (stream){
  stream.getTracks().forEach(function (track) {
    track.stop();
  });
  console.log("getUserMedia succeed");
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
}).catch(function(err){
  console.log("getUserMedia error: " + err);
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
});

navigator.mediaDevices.ondevicechange = updateDeviceList;

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}
