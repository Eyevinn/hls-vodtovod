import { HLSVod, IPlaylistEntry } from "./index";
import { FileManifestLoader } from "./manifest_loader";

describe("VOD2VOD library", () => {
  test("can load and parse an HLS VOD on Internet", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "5050630b-b599-4e66-8033-f9f6139a7284",
        uri: "https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest.m3u8",
      },
      {
        id: "21053ee7-b289-4210-869e-43f355357332",
        uri: "https://lab.cdn.eyevinn.technology/THE_GRAND_BUDAPEST_HOTEL_Trailer_2014.mp4/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    await hlsVod.load();
    const bws = hlsVod.getBandwidths();
    //console.log(hlsVod.getVariant(bws[0]).toString());
    expect(hlsVod.getMultiVariant().length).toEqual(2);
  });

  test("can load and parse an HLS VOD on disk", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/slate/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);
    expect(hlsVod.getMultiVariant().length).toEqual(7);
  });

  test("can concatenate two VODs of same bitrates", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/vinn/master.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/vinn/master.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const bw = hlsVod.getBandwidths()[0];
    const m3u = hlsVod.getVariant(bw);
    expect(m3u.get("targetDuration")).toEqual(11);
    expect(Math.ceil(m3u.totalDuration())).toEqual(212);
  });

  test("can concatenate three VODs of different bitrates", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/slate/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/vinn/master.m3u8",
      },
      {
        id: "003",
        uri: "./testvectors/slate/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const bw = hlsVod.getBandwidths()[0];
    const m3u = hlsVod.getVariant(bw);
    expect(m3u.get("targetDuration")).toEqual(11);
    expect(Math.ceil(m3u.totalDuration())).toEqual(126);
    const streamList = hlsVod.getMultiVariant();
    expect(streamList.length).toEqual(3);
    streamList.map((stream) => {
      expect(stream.get("uri")).toEqual("manifest_" + stream.get("bandwidth") + ".m3u8");
    });
  });

  test("can specify format of variant playlist URIs", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/slate/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/vinn/master.m3u8",
      },
      {
        id: "003",
        uri: "./testvectors/slate/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const streamList = hlsVod.getMultiVariant((bw) => "media?bw=" + bw);
    streamList.map((stream) => {
      expect(stream.get("uri")).toEqual("media?bw=" + stream.get("bandwidth"));
    });
  });

  test("inserts a daterange for each VOD", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        title: "First one",
        uri: "./testvectors/slate/manifest.m3u8",
      },
      {
        id: "002",
        title: "Second one",
        uri: "./testvectors/vinn/master.m3u8",
      },
      {
        id: "003",
        title: "Last one",
        uri: "./testvectors/slate/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);
    const bws = hlsVod.getBandwidths();
    const lines = hlsVod.getVariant(bws[0]).toString().split("\n");
    expect(lines[5]).toEqual("#EXT-X-PROGRAM-DATE-TIME:1970-01-01T00:00:00.001Z");
    expect(lines[6]).toEqual(
      '#EXT-X-DATERANGE:ID="1",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:00:00.001Z",DURATION=10,X-TITLE="First one",X-ASSET-ID="001"'
    );
    expect(lines[10]).toEqual(
      '#EXT-X-DATERANGE:ID="2",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:00:10.001Z",DURATION=105.68644400000001,X-TITLE="Second one",X-ASSET-ID="002"'
    );
    expect(lines[40]).toEqual(
      '#EXT-X-DATERANGE:ID="3",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:01:55.687Z",DURATION=10,X-TITLE="Last one",X-ASSET-ID="003"'
    );
  });
});

describe("VOD2VOD library, Multi-Audio Tracks", () => {
  test("can load and parse a demux HLS VOD on Internet", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "5050630b-b599-4e66-8033-f9f6139a7284",
        uri: "https://lab-live.cdn.eyevinn.technology/ED_V4/master.m3u8",
      },
      {
        id: "21053ee7-b289-4210-869e-43f355357332",
        uri: "https://lab-live.cdn.eyevinn.technology/DEMUX_001/master_demux_aac-en-sp.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    await hlsVod.load();
    const bws = hlsVod.getBandwidths();
    const groups = hlsVod.getAudioGroups();
    bws.forEach((bw) => {
      expect(hlsVod.getVariant(bw).items.PlaylistItem.length).toEqual(10);
    });
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        expect(hlsVod.getAudioVariant(group, groupLang).items.PlaylistItem.length).toEqual(10);
      });
    });
    expect(hlsVod.getMultiVariant().length).toEqual(5);
  }, 6000);

  test("can load and parse a demuxed HLS VOD on disk", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);
    expect(hlsVod.getMultiVariant().length).toEqual(9);
  });

  test("can concatenate two demuxed VODs of same GroupIDs (and same languages)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_vinn-aac-enfr/master.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_vinn-aac-enfr/master.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(11);
        expect(Math.ceil(m3u.totalDuration())).toEqual(212);
      });
    });
  });

  test("can concatenate three demuxed VODs of different GroupIDs (and same languages)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_vinn-ec3-enfr/master.m3u8",
      },
      {
        id: "003",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    expect(groups.length).toEqual(1);
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      expect(groupLangs.length).toEqual(2);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(11);
        expect(Math.ceil(m3u.totalDuration())).toEqual(126);
        const streamList = hlsVod.getMultiVariant();
        expect(streamList.length).toEqual(5);
        const audioStreams = streamList.slice(-2);
        audioStreams.map((stream) => {
          expect(stream.get("uri")).toEqual("manifest_" + stream.get("group-id") + "-" + stream.get("language") + ".m3u8");
        });
      });
    });
  });

  test("can concatenate two demuxed VODs of same GroupIDs (and 1 different language -> replace with default language)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_slate-aac-ensv/manifest.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(10);
        expect(Math.ceil(m3u.totalDuration())).toEqual(20);
      });
      const m3u_1 = hlsVod.getAudioVariant(group, groupLangs[0]);
      expect(m3u_1.items.PlaylistItem[0].get("uri")).toEqual("./testvectors/demux_slate-aac-enfr/manifest_aac-en_00001.aac");
      expect(m3u_1.items.PlaylistItem[1].get("uri")).toEqual("./testvectors/demux_slate-aac-ensv/manifest_aac-en_00001.aac");
      const m3u_2 = hlsVod.getAudioVariant(group, groupLangs[1]);
      expect(m3u_2.items.PlaylistItem[0].get("uri")).toEqual("./testvectors/demux_slate-aac-enfr/manifest_aac-fr_00001.aac");
      expect(m3u_2.items.PlaylistItem[1].get("uri")).toEqual("./testvectors/demux_slate-aac-ensv/manifest_aac-en_00001.aac");
    });
  });

  test("can concatenate two demuxed VODs of same GroupIDs (and 2 different language -> replace with default language)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_slate-aac-svno/manifest.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(10);
        expect(Math.ceil(m3u.totalDuration())).toEqual(20);
      });
      const m3u_1 = hlsVod.getAudioVariant(group, groupLangs[0]);
      expect(m3u_1.items.PlaylistItem[0].get("uri")).toEqual("./testvectors/demux_slate-aac-enfr/manifest_aac-en_00001.aac");
      expect(m3u_1.items.PlaylistItem[1].get("uri")).toEqual("./testvectors/demux_slate-aac-svno/manifest_aac-no_00001.aac");
      const m3u_2 = hlsVod.getAudioVariant(group, groupLangs[1]);
      expect(m3u_2.items.PlaylistItem[0].get("uri")).toEqual("./testvectors/demux_slate-aac-enfr/manifest_aac-fr_00001.aac");
      expect(m3u_2.items.PlaylistItem[1].get("uri")).toEqual("./testvectors/demux_slate-aac-svno/manifest_aac-no_00001.aac");
    });
  });

  test("can concatenate two demuxed VODs with 1 of 2 GroupIDs matching (and same languages)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aacec3-enfr/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(10);
        expect(Math.ceil(m3u.totalDuration())).toEqual(20);
      });
      const m3u_1 = hlsVod.getAudioVariant(group, groupLangs[0]);
      expect(m3u_1.items.PlaylistItem[0].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-en_00001.aac`);
      expect(m3u_1.items.PlaylistItem[1].get("uri")).toEqual("./testvectors/demux_slate-aac-enfr/manifest_aac-en_00001.aac");
      const m3u_2 = hlsVod.getAudioVariant(group, groupLangs[1]);
      expect(m3u_2.items.PlaylistItem[0].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-fr_00001.aac`);
      expect(m3u_2.items.PlaylistItem[1].get("uri")).toEqual("./testvectors/demux_slate-aac-enfr/manifest_aac-fr_00001.aac");
    });
  });

  test("can concatenate two demuxed VODs with 2 of 2 GroupIDs matching (and same languages)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aacec3-enfr/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_slate-aacec3-enfr/manifest.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(10);
        expect(Math.ceil(m3u.totalDuration())).toEqual(20);
      });
      const m3u_1 = hlsVod.getAudioVariant(group, groupLangs[0]);
      expect(m3u_1.items.PlaylistItem[0].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-en_00001.aac`);
      expect(m3u_1.items.PlaylistItem[1].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-en_00001.aac`);
      const m3u_2 = hlsVod.getAudioVariant(group, groupLangs[1]);
      expect(m3u_2.items.PlaylistItem[0].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-fr_00001.aac`);
      expect(m3u_2.items.PlaylistItem[1].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-fr_00001.aac`);
    });
  });

  test("can concatenate two demuxed VODs with 0 of 2 GroupIDs matching (and no common languages)", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        uri: "./testvectors/demux_slate-aacec3-enfr/manifest.m3u8",
      },
      {
        id: "002",
        uri: "./testvectors/demux_slate-audio-dkde/manifest.m3u8",
      },
    ];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const groups = hlsVod.getAudioGroups();
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      groupLangs.forEach((groupLang) => {
        const m3u = hlsVod.getAudioVariant(group, groupLang);
        expect(m3u.get("targetDuration")).toEqual(10);
        expect(Math.ceil(m3u.totalDuration())).toEqual(20);
      });
      const m3u_1 = hlsVod.getAudioVariant(group, groupLangs[0]);
      expect(m3u_1.items.PlaylistItem[0].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-en_00001.aac`);
      expect(m3u_1.items.PlaylistItem[1].get("uri")).toEqual(`./testvectors/demux_slate-audio-dkde/manifest_audio-dk_00001.aac`);
      const m3u_2 = hlsVod.getAudioVariant(group, groupLangs[1]);
      expect(m3u_2.items.PlaylistItem[0].get("uri")).toEqual(`./testvectors/demux_slate-aacec3-enfr/manifest_${group}-fr_00001.aac`);
      expect(m3u_2.items.PlaylistItem[1].get("uri")).toEqual(`./testvectors/demux_slate-audio-dkde/manifest_audio-dk_00001.aac`);
    });
  });

  test("can specify format of variant playlist URIs", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        title: "First one",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
      {
        id: "002",
        title: "Second one",
        uri: "./testvectors/demux_vinn-aac-enfr/master.m3u8",
      },
      {
        id: "003",
        title: "Last one",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const streamList = hlsVod.getMultiVariant(
      (bw) => "media?bw=" + bw,
      (gl) => "media?groupId:lang=" + gl
    );
    const streams = streamList.slice(5);
    const audioStreams = streamList.slice(-2);
    streams.map((stream) => {
      expect(stream.get("uri")).toEqual("media?bwt=" + stream.get("bandwidth"));
    });
    audioStreams.map((stream) => {
      expect(stream.get("uri")).toEqual("media?groupId:lang=" + stream.get("group-id") + "-" + stream.get("language"));
    });
  });

  test("inserts a daterange for each demuxed VOD", async () => {
    const playlist: IPlaylistEntry[] = [
      {
        id: "001",
        title: "First one",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
      {
        id: "002",
        title: "Second one",
        uri: "./testvectors/demux_vinn-aac-enfr/master.m3u8",
      },
      {
        id: "003",
        title: "Last one",
        uri: "./testvectors/demux_slate-aac-enfr/manifest.m3u8",
      },
    ];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);
    const bws = hlsVod.getBandwidths();
    const lines = hlsVod.getVariant(bws[0]).toString().split("\n");
    expect(lines[5]).toEqual("#EXT-X-PROGRAM-DATE-TIME:1970-01-01T00:00:00.001Z");
    expect(lines[6]).toEqual(
      '#EXT-X-DATERANGE:ID="1",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:00:00.001Z",DURATION=10,X-TITLE="First one",X-ASSET-ID="001"'
    );
    expect(lines[10]).toEqual(
      '#EXT-X-DATERANGE:ID="2",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:00:10.001Z",DURATION=105.68644400000001,X-TITLE="Second one",X-ASSET-ID="002"'
    );
    expect(lines[40]).toEqual(
      '#EXT-X-DATERANGE:ID="3",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:01:55.687Z",DURATION=10,X-TITLE="Last one",X-ASSET-ID="003"'
    );
    const groups = hlsVod.getAudioGroups();
    expect(groups.length).toEqual(1);
    groups.forEach((group) => {
      const groupLangs = hlsVod.getAudioLanguagesForGroup(group);
      expect(groupLangs.length).toEqual(2);
      groupLangs.forEach((groupLang) => {
        const lines = hlsVod.getAudioVariant(group, groupLang).toString().split("\n");
        expect(lines[5]).toEqual("#EXT-X-PROGRAM-DATE-TIME:1970-01-01T00:00:00.001Z");
        expect(lines[6]).toEqual(
          '#EXT-X-DATERANGE:ID="1",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:00:00.001Z",DURATION=10,X-TITLE="First one",X-ASSET-ID="001"'
        );
        expect(lines[10]).toEqual(
          '#EXT-X-DATERANGE:ID="2",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:00:10.001Z",DURATION=105.68644400000001,X-TITLE="Second one",X-ASSET-ID="002"'
        );
        expect(lines[40]).toEqual(
          '#EXT-X-DATERANGE:ID="3",CLASS="se.eyevinn.vodtovod",START-DATE="1970-01-01T00:01:55.687Z",DURATION=10,X-TITLE="Last one",X-ASSET-ID="003"'
        );
      });
    });
  });
});
