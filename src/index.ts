import m3u8 from "@eyevinn/m3u8";
import { IManifestLoader, HTTPManifestLoader } from "./manifest_loader";

export interface IPlaylistEntry {
  id: string;
  title?: string;
  uri: string;
}

const findNearestBw = (bw, array) => {
  const sorted = array.sort((a, b) => (b - a));
  return sorted.reduce((a, b) => {
    return Math.abs(b - bw) < Math.abs(a - bw) ? b : a;
  });
};

export class HLSVod {
  private playlist: IPlaylistEntry[];
  private variants: {[bw: string]: any};
  private streams: any[];

  constructor(playlist: IPlaylistEntry[]) {
    this.playlist = playlist;
    this.variants = {};
    this.streams = [];
  }

  async load(manifestLoader?: IManifestLoader) {
    let loader = manifestLoader;
    if (!manifestLoader) {
      loader = new HTTPManifestLoader();
    }
    let m3ulist = [];
    for(let entry of this.playlist) {
      const m3u = await loader.load(entry.uri);
      m3ulist.push({ uri: entry.uri, m3u: m3u });
    }
    await this.concat(m3ulist, loader);
  }

  getVariant(bw) {
    return this.variants[bw];
  }

  getBandwidths() {
    return Object.keys(this.variants);
  }

  getMultiVariant() {
    return this.streams;
  }

  toString() {
    let m3u8 = "";
    m3u8 += "#EXTM3U\n" +
      "#EXT-X-VERSION:3\n" +
      "#EXT-X-INDEPENDENT-SEGMENTS\n";
    this.getMultiVariant().map(item => {
      m3u8 += item.toString() + "\n";
    })
    return m3u8;
  }

  private async concat(m3ulist: any[], loader: IManifestLoader) {
    let i = 0;
    let variants = {};
    for(let item of m3ulist) {
      let baseUrl;
      const m = item.uri.match(/^(.*)\/.*?$/);
      if (m) {
        baseUrl = m[1] + "/";
      }
      for(let streamItem of item.m3u.items.StreamItem) {
        const variant = await loader.load(baseUrl + streamItem.get("uri"));
        variant.items.PlaylistItem.map(item => {
          const uri = item.get("uri");
          item.set("uri", baseUrl + uri);
        });
        const bw = streamItem.get("bandwidth");
        if (i > 0) {
          const nearestBw = findNearestBw(bw, Object.keys(variants));
          variants[nearestBw].push({ stream: streamItem, variant: variant });
        } else {
          variants[bw] = [];
          variants[bw].push({ stream: streamItem, variant: variant });
        }
      }
      i++;
    }
    Object.keys(variants).map(bw => {
      if (variants[bw].length !== m3ulist.length) {
        delete variants[bw];
      } else {
        let newM3u;
        for (let i = 0; i < variants[bw].length; i++) {
          const m3u = variants[bw][i].variant;
          if (i === 0) {
            newM3u = m3u;
            variants[bw][i].stream.set("uri", "manifest_" + bw + ".m3u8");
            this.streams.push(variants[bw][i].stream);
          } else {
            m3u.items.PlaylistItem[0].set("discontinuity", true);
          }
          newM3u.items.PlaylistItem = newM3u.items.PlaylistItem.concat(m3u.items.PlaylistItem);
        }
        const targetDuration = newM3u.items.PlaylistItem
                                .map(item => item.get("duration"))
                                .reduce((prev, current) => prev > current ? prev : current);
        newM3u.set("targetDuration", Math.ceil(targetDuration));
        this.variants[bw] = newM3u;
      }
    });
  }
}