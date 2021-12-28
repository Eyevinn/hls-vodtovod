const { HLSVod } = require("./dist/index.js");

(async () => {
  const playlist = [{
    id: "001",
    uri: "https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest.m3u8",
  }, {
    id: "002",
    uri: "https://lab.cdn.eyevinn.technology/THE_GRAND_BUDAPEST_HOTEL_Trailer_2014.mp4/manifest.m3u8",
  }, {
    id: "003",
    uri: "https://lab.cdn.eyevinn.technology/stswe19-three-roads-to-jerusalem.mp4/manifest.m3u8",
  }];

  const hlsVod = new HLSVod(playlist);
  await hlsVod.load();
  const bw = hlsVod.getBandwidths()[0];
  console.log(hlsVod.getVariant(bw).toString());
})();