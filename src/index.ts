import { IManifestLoader, HTTPManifestLoader } from "./manifest_loader";

export interface IPlaylistEntry {
  id: string;
  title?: string;
  uri: string;
}

export interface IVariantData {
  stream?: any;
  variant: any;
  item: any;
}

export interface IVideoVariants {
  [bw: string]: any;
}

export interface IAudioVariants {
  [group: string]: { [lang:string]: any };
}

/**
 * 
 * variants = {
 *  100: {},
 *  200: {},
 *  group-1: {
 *    en: {},
 *    sv: {}
 *  }
 * }
 * 
 */

const findNearestBw = (bw, array) => {
  const sorted = array.sort((a, b) => (b - a));
  return sorted.reduce((a, b) => {
    return Math.abs(b - bw) < Math.abs(a - bw) ? b : a;
  });
};

export class HLSVod {
  private playlist: IPlaylistEntry[];
  private variants: IVideoVariants;
  private audioVariants: IAudioVariants;
  private streams: any[];
  private mediaAudio: any[]

  constructor(playlist: IPlaylistEntry[]) {
    this.playlist = playlist;
    this.variants = {};
    this.audioVariants = {};
    this.streams = [];
    this.mediaAudio = [];
  }

  async load(manifestLoader?: IManifestLoader) {
    let loader = manifestLoader;
    if (!manifestLoader) {
      loader = new HTTPManifestLoader();
    }
    let m3ulist = [];
    for(let entry of this.playlist) {
      const m3u = await loader.load(entry.uri);
      console.log(JSON.stringify(m3u, null, 2))
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

  getAudioVariant(groupId, lang) {
    return this.audioVariants[groupId][lang];
  }

  getBandwidths() {
    return Object.keys(this.variants);
  }

  getAudioGroups() {
    return Object.keys(this.audioVariants);
  }

  getAudioLanguagesForGroup(groupId: string) {
    return Object.keys(this.audioVariants[groupId]);
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

  mapAudioVariants(newAudioVariants, currentAudioVariants) {
    const currGroups = Object.keys(currentAudioVariants);
    const newGroups = Object.keys(newAudioVariants);
    console.log(1337, newGroups)
    currGroups.forEach(group => {
      if (newGroups.includes(group)) {
        const currLangs = Object.keys(currentAudioVariants[group]);
        const newLangs = Object.keys(newAudioVariants[group]);
        currLangs.forEach(lang => {
          if (newLangs.includes(lang)) {
            currentAudioVariants[group][lang].push(newAudioVariants[group][lang])
          } else {
            // Push Default
            currentAudioVariants[group][lang].push(newAudioVariants[group][newLangs[0]])
          }
        })
      } else {
        const currLangs = Object.keys(currentAudioVariants[group]);
        const newLangs = Object.keys(newAudioVariants[newGroups[0]]);
        currLangs.forEach(lang => {
          if (newLangs.includes(lang)) {
            currentAudioVariants[group][lang].push(newAudioVariants[newGroups[0]][lang])
          } else {
            // Push Default
            currentAudioVariants[group][lang].push(newAudioVariants[newGroups[0]][newLangs[0]])
          }
        })
      }
    })
  }

  private async concat(m3ulist: any[], loader: IManifestLoader) {
    let i = 0;
    let variants: IVideoVariants = {};
    let audioVariants: IAudioVariants = {}

    for(let item of m3ulist) {
      let temp = {}
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

      for (let mediaItem of item.m3u.items.MediaItem) {
        if (mediaItem.attributes.attributes['type'] === 'AUDIO') {
          const variant = await loader.load(baseUrl + mediaItem.get("uri"));
          variant.items.PlaylistItem.map(item => {
            const uri = item.get("uri");
            item.set("uri", baseUrl + uri);
          });
          const groupId = mediaItem.get("group-id");
          const language = mediaItem.get('language');
          if (i > 0) {
            if (!temp[groupId]) {
              temp[groupId] = {}
            }
            if (language) {
              if (!temp[groupId][language]) {
                temp[groupId][language] = []
              }
              temp[groupId][language].push({ media: mediaItem, variant: variant, item: item });
            } else {
              if (!temp[groupId]['none']) {
                temp[groupId]['none'] = []
              }
              temp[groupId]['none'].push({ media: mediaItem, variant: variant, item: item });
            }
            // MAP THEM
            this.mapAudioVariants(temp, audioVariants);
          } else {
            if (!audioVariants[groupId]) {
              audioVariants[groupId] = {}
            }
            if (language) {
              if (!audioVariants[groupId][language]) {
                audioVariants[groupId][language] = []
              }
              audioVariants[groupId][language].push({ media: mediaItem, variant: variant, item: item });
            } else {
              if (!audioVariants[groupId]['none']) {
                audioVariants[groupId]['none'] = []
              }
              audioVariants[groupId]['none'].push({ media: mediaItem, variant: variant, item: item });
            }
          }
        }
      }
      i++;
    }
    // For Video
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
              `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${newM3u.totalDuration()}",X-TITLE="${variants[bw][i].item.title}",X-ASSET-ID="${variants[bw][i].item.id}"`);
            offset += newM3u.totalDuration() * 1000;
          } else {
            m3u.items.PlaylistItem[0].set("discontinuity", true);
            m3u.items.PlaylistItem[0].set("daterange", 
              `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${m3u.totalDuration()}",X-TITLE="${variants[bw][i].item.title}",X-ASSET-ID="${variants[bw][i].item.id}"`);
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
    // For audio
    // TODO:
    const groups = Object.keys(audioVariants);
    groups.forEach(group => {
      const langs = Object.keys(audioVariants[group]);
      langs.forEach(lang => {
        audioVariants[group][lang].map(() => {
          console.log(32, group,lang)
          console.log(33, JSON.stringify(audioVariants[group][lang].length)) // TODO: TypeError: Cannot read properties of undefined (reading 'length')
          if (audioVariants[group][lang].length !== m3ulist.length) {
            delete audioVariants[group][lang];
          } else {
            let newM3u;
            let offset = 0;

            for (let i = 0; i < audioVariants[group][lang].length; i++) {
              const m3u = audioVariants[group][lang][i].variant;
              const startDate = (new Date(1 + offset)).toISOString();
              if (i === 0) {
                newM3u = m3u;
                audioVariants[group][lang][i].media.set("uri", "manifest_" + group + "-" + lang + ".m3u8");
                this.mediaAudio.push(audioVariants[group][lang][i].media);
                newM3u.items.PlaylistItem[0].set("date", new Date(1));
                newM3u.items.PlaylistItem[0].set("daterange", 
                  `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${newM3u.totalDuration()}",X-TITLE="${audioVariants[group][lang][i].item.title}",X-ASSET-ID="${audioVariants[group][lang][i].item.id}"`);
                offset += newM3u.totalDuration() * 1000;
              } else {
                m3u.items.PlaylistItem[0].set("discontinuity", true);
                m3u.items.PlaylistItem[0].set("daterange", 
                  `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${m3u.totalDuration()}",X-TITLE="${audioVariants[group][lang][i].item.title}",X-ASSET-ID="${audioVariants[group][lang][i].item.id}"`);
                newM3u.items.PlaylistItem = newM3u.items.PlaylistItem.concat(m3u.items.PlaylistItem);
                offset += m3u.totalDuration() * 1000;
              }
            }
            const targetDuration = newM3u.items.PlaylistItem
            .map(item => item.get("duration"))
            .reduce((prev, current) => prev > current ? prev : current);
            newM3u.set("targetDuration", Math.ceil(targetDuration));

            if (!this.audioVariants[group]) {
              this.audioVariants[group] = {};
            }
            this.audioVariants[group][lang] = newM3u;
          }
        })
      })
    })
  }
}