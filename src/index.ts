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
      m3ulist.push({
        id: entry.id,
        title: entry.title,
        uri: entry.uri,
        m3u: m3u
      });
    }
    await this.concat(m3ulist, loader);
  }

  getVariant(bw) {
    return this.variants[bw];
  }

  getBandwidths() {
    return Object.keys(this.variants);
  }

  getMultiVariant(modifier?: (bw: string) => string) {
    if (modifier) {
      this.streams.map(streamItem => {
        const uri = modifier(streamItem.get("bandwidth"));
        streamItem.set("uri", uri);
      });
    }
    return this.streams;
  }

  toString(modifier?: (bw: string) => string) {
    let m3u8 = "";
    m3u8 += "#EXTM3U\n" +
      "#EXT-X-VERSION:3\n" +
      "#EXT-X-INDEPENDENT-SEGMENTS\n";
    this.getMultiVariant(modifier).map(item => {
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
          variants[nearestBw].push({ stream: streamItem, variant: variant, item: item });
        } else {
          variants[bw] = [];
          variants[bw].push({ stream: streamItem, variant: variant, item: item });
        }
      }
      i++;
    }
    Object.keys(variants).map(bw => {
      if (variants[bw].length !== m3ulist.length) {
        delete variants[bw];
      } else {
        let newM3u;
        let offset = 0;
        for (let i = 0; i < variants[bw].length; i++) {
          const m3u = variants[bw][i].variant;
          const startDate = (new Date(1 + offset)).toISOString();
          if (i === 0) {
            newM3u = m3u;
            variants[bw][i].stream.set("uri", "manifest_" + bw + ".m3u8");
            this.streams.push(variants[bw][i].stream);
            newM3u.items.PlaylistItem[0].set("date", new Date(1));
            newM3u.items.PlaylistItem[0].set("daterange", 
              `ID=${variants[bw][i].item.id},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${newM3u.totalDuration()}",X-TITLE="${variants[bw][i].item.title}"`);
            offset += newM3u.totalDuration() * 1000;
          } else {
            m3u.items.PlaylistItem[0].set("discontinuity", true);
            m3u.items.PlaylistItem[0].set("daterange", 
              `ID=${variants[bw][i].item.id},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${m3u.totalDuration()}",X-TITLE="${variants[bw][i].item.title}"`);
            newM3u.items.PlaylistItem = newM3u.items.PlaylistItem.concat(m3u.items.PlaylistItem);
            offset += m3u.totalDuration() * 1000;
          }
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