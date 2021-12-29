import { HLSVod, IPlaylistEntry } from "./index";
import { FileManifestLoader } from "./manifest_loader";

describe("VOD2VOD library", () => {
  test("can load and parse an HLS VOD on Internet", async () => {
    const playlist: IPlaylistEntry[] = [{
      id: "001",
      uri: "https://lab.cdn.eyevinn.technology/NO_TIME_TO_DIE_short_Trailer_2021.mp4/manifest.m3u8",
    }];
    const hlsVod = new HLSVod(playlist);
    await hlsVod.load();
    expect(hlsVod.getMultiVariant().length).toEqual(4);
  });

  test("can load and parse an HLS VOD on disk", async () => {
    const playlist: IPlaylistEntry[] = [{
      id: "001",
      uri: "./testvectors/slate/manifest.m3u8",
    }];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);
    expect(hlsVod.getMultiVariant().length).toEqual(7);
  });

  test("can concatenate two VODs of same bitrates", async () => {
    const playlist: IPlaylistEntry[] = [{
      id: "001",
      uri: "./testvectors/vinn/master.m3u8",
    }, {
      id: "002",
      uri: "./testvectors/vinn/master.m3u8",
    }];

    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const bw = hlsVod.getBandwidths()[0];
    const m3u = hlsVod.getVariant(bw);
    expect(m3u.get("targetDuration")).toEqual(11);
    expect(Math.ceil(m3u.totalDuration())).toEqual(318);
  });

  test("can concatenate three VODs of different bitrates", async () => {
    const playlist: IPlaylistEntry[] = [{
      id: "001",
      uri: "./testvectors/slate/manifest.m3u8",
    }, {
      id: "002",
      uri: "./testvectors/vinn/master.m3u8",
    }, {
      id: "003",
      uri: "./testvectors/slate/manifest.m3u8",
    }];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const bw = hlsVod.getBandwidths()[0];
    const m3u = hlsVod.getVariant(bw);
    expect(m3u.get("targetDuration")).toEqual(11);
    expect(Math.ceil(m3u.totalDuration())).toEqual(136);
    const streamList = hlsVod.getMultiVariant();
    expect(streamList.length).toEqual(3);
    streamList.map(stream => {
      expect(stream.get("uri")).toEqual("manifest_" + stream.get("bandwidth") + ".m3u8");
    });
  });

  test("can specify format of variant playlist URIs", async () => {
    const playlist: IPlaylistEntry[] = [{
      id: "001",
      uri: "./testvectors/slate/manifest.m3u8",
    }, {
      id: "002",
      uri: "./testvectors/vinn/master.m3u8",
    }, {
      id: "003",
      uri: "./testvectors/slate/manifest.m3u8",
    }];
    const hlsVod = new HLSVod(playlist);
    const loader = new FileManifestLoader();
    await hlsVod.load(loader);

    const streamList = hlsVod.getMultiVariant((bw) => "media?bw=" + bw);
    streamList.map(stream => {
      expect(stream.get("uri")).toEqual("media?bw=" + stream.get("bandwidth"));
    });
  });
});