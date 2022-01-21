# hls-vodtovod

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Slack](http://slack.streamingtech.se/badge.svg)](http://slack.streamingtech.se)

Node library to concatenate a list of HLS VODs into a new HLS VOD

Try a demo here: https://poc.eyevinn.technology/hls-vodtovod/index.html

## Installation

```
npm install --save @eyevinn/hls-vodtovod
```

## Usage

```javascript
const { HLSVod } = require("@eyevinn/hls-vodtovod");

const playlist = [{
  id: "001",
  uri: "https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest.m3u8",
}, {
  id: "002",
  uri: "https://lab.cdn.eyevinn.technology/THE_GRAND_BUDAPEST_HOTEL_Trailer_2014.mp4/manifest.m3u8",
}];

const hlsVod = new HLSVod(playlist);
await hlsVod.load();
const bw = hlsVod.getBandwidths()[0];
console.log(hlsVod.getVariant(bw).toString());

// #EXTM3U
// #EXT-X-VERSION:3
// #EXT-X-TARGETDURATION:12
// #EXT-X-MEDIA-SEQUENCE:1
// #EXT-X-PLAYLIST-TYPE:VOD
// #EXTINF:11.0000,
// https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest_2_00001.ts
// #EXTINF:12.0000,
// https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest_2_00002.ts
// #EXTINF:11.0000,
// https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest_2_00003.ts
// ...
// #EXTINF:7.0000,
// https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest_2_00008.ts
// #EXT-X-DISCONTINUITY
// #EXTINF:11.0000,
// https://lab.cdn.eyevinn.technology/THE_GRAND_BUDAPEST_HOTEL_Trailer_2014.mp4/manifest_1_00001.ts
// #EXTINF:12.0000,
// https://lab.cdn.eyevinn.technology/THE_GRAND_BUDAPEST_HOTEL_Trailer_2014.mp4/manifest_1_00002.ts
// #EXTINF:11.0000,
// https://lab.cdn.eyevinn.technology/THE_GRAND_BUDAPEST_HOTEL_Trailer_2014.mp4/manifest_1_00003.ts
// ...
// #EXT-X-ENDLIST

console.log(hlsVod.toString());

// #EXTM3U
// #EXT-X-VERSION:3
// #EXT-X-INDEPENDENT-SEGMENTS
// #EXT-X-STREAM-INF:BANDWIDTH=1689191,AVERAGE-BANDWIDTH=1423776,CODECS="avc1.4d4028,mp4a.40.2",RESOLUTION=1600x900,FRAME-RATE=23.976
// manifest_1689191.m3u8
```


# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!

