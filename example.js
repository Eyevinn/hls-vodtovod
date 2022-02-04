const { HLSVod } = require("./dist/index.js");

(async () => {
  const playlist = [
    {
      id: "002",
      uri: "https://lab-live.cdn.eyevinn.technology/DEMUX_001/master_demux_aac-en-fr.m3u8",
    },
    {
      id: "001",
      uri: "https://lab-live.cdn.eyevinn.technology/ED_V4/master.m3u8",
    },

    {
      id: "003",
      uri: "https://lab-live.cdn.eyevinn.technology/ED_V4/master.m3u8",
    },
  ];

  const hlsVod = new HLSVod(playlist);
  await hlsVod.load();
  console.log(hlsVod.getBandwidths());
  console.log(hlsVod.toString());

  const bw = hlsVod.getBandwidths()[0];
  console.log(hlsVod.getVariant(bw).toString());

  const group = hlsVod.getAudioGroups()[0];
  const lang = hlsVod.getAudioLanguagesForGroup(group)[0];
  console.log(hlsVod.getAudioVariant(group, lang).toString());
})();
