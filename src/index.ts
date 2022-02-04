import { IManifestLoader, HTTPManifestLoader } from "./manifest_loader";

export interface IPlaylistEntry {
  id: string;
  title?: string;
  uri: string;
}

export interface IVideoVariants {
  [bw: string]: IVariantItem[];
}

export interface IAudioVariants {
  [group: string]: { [lang: string]: IVariantItem[] };
}

export interface IM3UVideoVariants {
  [bw: string]: any;
}

export interface IM3UAudioVariants {
  [group: string]: { [lang: string]: any };
}

export interface IVariantItem {
  stream: any;
  variant: any;
  item: any;
}

const findNearestBw = (bw, array) => {
  const sorted = array.sort((a, b) => b - a);
  return sorted.reduce((a, b) => {
    return Math.abs(b - bw) < Math.abs(a - bw) ? b : a;
  });
};

export class HLSVod {
  private playlist: IPlaylistEntry[];
  private variants: IM3UVideoVariants;
  private audioVariants: IM3UAudioVariants;
  private streams: any[];
  private audioStreams: any[];

  constructor(playlist: IPlaylistEntry[]) {
    this.playlist = playlist;
    this.variants = {};
    this.audioVariants = {};
    this.streams = [];
    this.audioStreams = [];
  }

  async load(manifestLoader?: IManifestLoader) {
    let loader = manifestLoader;
    if (!manifestLoader) {
      loader = new HTTPManifestLoader();
    }
    let m3ulist = [];
    for (let entry of this.playlist) {
      const m3u = await loader.load(entry.uri);
      console.log(JSON.stringify(m3u, null, 2));
      m3ulist.push({
        id: entry.id,
        title: entry.title,
        uri: entry.uri,
        m3u: m3u,
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
      this.streams.map((streamItem) => {
        const uri = modifier(streamItem.get("bandwidth"));
        streamItem.set("uri", uri);
      });
      this.audioStreams.map((mediaItem) => {
        const uri = modifier(mediaItem.get("group") + "-" + mediaItem.get("language"));
        mediaItem.set("uri", uri);
      });
    }
    return this.streams.concat(this.audioStreams);
  }

  toString(modifier?: (bw: string) => string) {
    let m3u8 = "";
    m3u8 += "#EXTM3U\n" + "#EXT-X-VERSION:3\n" + "#EXT-X-INDEPENDENT-SEGMENTS\n";
    this.getMultiVariant(modifier).map((item) => {
      m3u8 += item.toString() + "\n";
    });
    return m3u8;
  }

  mapAudioVariants(newAudioVariants, currentAudioVariants) {
    const currGroups = Object.keys(currentAudioVariants);
    const newGroups = Object.keys(newAudioVariants);
    if (newGroups.length === 0) {
      return;
    }
    console.log(1337, currentAudioVariants, newAudioVariants);
    console.log(newAudioVariants["audio"]);
    currGroups.forEach((currGroup) => {
      if (newGroups.length > 0) {
        let currGroupLangs: string[];
        let newGroupLangs: string[];

        if (newGroups.includes(currGroup)) {
          // Group Matches. Next Compare the group Langs
          currGroupLangs = Object.keys(currentAudioVariants[currGroup]);
          newGroupLangs = Object.keys(newAudioVariants[currGroup]);
          currGroupLangs.forEach((currGroupLang) => {
            if (newGroupLangs.includes(currGroupLang)) {
              currentAudioVariants[currGroup][currGroupLang].push(newAudioVariants[currGroup][currGroupLang][0]);
            } else {
              // Push Default
              currentAudioVariants[currGroup][currGroupLang].push(newAudioVariants[currGroup][newGroupLangs[0]][0]);
            }
          });
        } else {
          currGroupLangs = Object.keys(currentAudioVariants[currGroup]);
          // Use default rather than matching.
          const defaultGroup = newGroups[0];
          const defaultGroupLangs = Object.keys(newAudioVariants[defaultGroup]);
          currGroupLangs.forEach((currGroupLang) => {
            if (defaultGroupLangs.includes(currGroupLang)) {
              currentAudioVariants[currGroup][currGroupLang].push(newAudioVariants[defaultGroup][currGroupLang][0]);
            } else {
              // Push Default

              const defaultGroupLang = defaultGroupLangs[0];
              let thing = newAudioVariants[defaultGroup][defaultGroupLang][0];
              console.log(1998, defaultGroupLangs, defaultGroup, defaultGroupLang, thing);
              currentAudioVariants[currGroup][currGroupLang].push(thing);
            }
          });
        }
      }
    });
  }

  private async concat(m3ulist: any[], loader: IManifestLoader) {
    let i = 0;
    let variants: IVideoVariants = {};
    let audioVariants: IAudioVariants = {};

    for (let vodItem of m3ulist) {
      let temp: IAudioVariants = {}; // reset temp.
      let baseUrl;
      const m = vodItem.uri.match(/^(.*)\/.*?$/);
      if (m) {
        baseUrl = m[1] + "/";
      }
      // Load Video
      for (let streamItem of vodItem.m3u.items.StreamItem) {
        const variant = await loader.load(baseUrl + streamItem.get("uri"));
        variant.items.PlaylistItem.map((item) => {
          const uri = item.get("uri");
          item.set("uri", baseUrl + uri);
        });
        const bw = streamItem.get("bandwidth");
        if (i > 0) {
          const nearestBw = findNearestBw(bw, Object.keys(variants));
          variants[nearestBw].push({
            stream: streamItem,
            variant: variant,
            item: vodItem,
          });
        } else {
          variants[bw] = [];
          variants[bw].push({
            stream: streamItem,
            variant: variant,
            item: vodItem,
          });
        }
      }
      // Load Audio
      for (let mediaItem of vodItem.m3u.items.MediaItem) {
        if (mediaItem.attributes.attributes["type"] === "AUDIO") {
          const audioVariantM3U = await loader.load(baseUrl + mediaItem.get("uri"));
          audioVariantM3U.items.PlaylistItem.map((item) => {
            // Turn relative path to absolute path on all segment items
            const uri = item.get("uri");
            item.set("uri", baseUrl + uri);
          });
          const groupId = mediaItem.get("group-id");
          const language = mediaItem.get("language");
          // Non-first VODs do this!
          if (i > 0) {
            if (!temp[groupId]) {
              temp[groupId] = {};
            }
            if (language) {
              if (!temp[groupId][language]) {
                temp[groupId][language] = [];
                temp[groupId][language].push({
                  stream: mediaItem,
                  variant: audioVariantM3U,
                  item: vodItem,
                });
              }
            } else {
              // To cover case where no language attribute is present. Language is an Optional attribute after all.
              if (!temp[groupId]["none"]) {
                temp[groupId]["none"] = [];
                temp[groupId]["none"].push({
                  stream: mediaItem,
                  variant: audioVariantM3U,
                  item: vodItem,
                });
              }
            }
          } else {
            // The first VOD does this!
            if (!audioVariants[groupId]) {
              audioVariants[groupId] = {};
            }
            if (language) {
              if (!audioVariants[groupId][language]) {
                audioVariants[groupId][language] = [];
                // To avoid pushing same lang tracks eg(en & en comentary). Only push to a new lang once.
                audioVariants[groupId][language].push({
                  stream: mediaItem,
                  variant: audioVariantM3U,
                  item: vodItem,
                });
              }
            } else {
              if (!audioVariants[groupId]["none"]) {
                audioVariants[groupId]["none"] = [];
                audioVariants[groupId]["none"].push({
                  stream: mediaItem,
                  variant: audioVariantM3U,
                  item: vodItem,
                });
              }
            }
          }
        }
      }

      /**
       *  LOG CITY!!
       *
       *
       *
       *
       *
       *
       */
      if (Object.keys(temp).length > 0) {
        console.log(`-=TEMP=-\nGroups & Langs->`);

        Object.keys(temp)?.forEach((group, indexG) => {
          console.log(`G${indexG}:${group}`);
          Object.keys(temp[group]).forEach((lang, indexL) => {
            console.log(`L${indexL}:${lang}`);
          });
        });
      }
      if (Object.keys(audioVariants).length > 0) {
        console.log(`-=AUDIO-VARI=-\nGroups & Langs->`);

        Object.keys(audioVariants)?.forEach((group, indexG) => {
          console.log(`G${indexG}:${group}`);
          Object.keys(audioVariants[group]).forEach((lang, indexL) => {
            console.log(`L${indexL}:${lang}_____size=${audioVariants[group][lang].length}`);
          });
        });
      }
      // MAP THEM: Merge as good as possible
      this.mapAudioVariants(temp, audioVariants);
      i++;
    }

    // ---Add Metadata on all relavent segItems in each 'PlaylistItem'---

    // For Video
    Object.keys(variants).map((bw) => {
      if (variants[bw].length !== m3ulist.length) {
        delete variants[bw];
      } else {
        let newM3u;
        let offset = 0;
        for (let i = 0; i < variants[bw].length; i++) {
          const m3u = variants[bw][i].variant;
          const startDate = new Date(1 + offset).toISOString();
          if (i === 0) {
            newM3u = m3u;
            variants[bw][i].stream.set("uri", "manifest_" + bw + ".m3u8");
            this.streams.push(variants[bw][i].stream);
            newM3u.items.PlaylistItem[0].set("date", new Date(1));
            newM3u.items.PlaylistItem[0].set(
              "daterange",
              `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${newM3u.totalDuration()}",X-TITLE="${
                variants[bw][i].item.title
              }",X-ASSET-ID="${variants[bw][i].item.id}"`
            );
            offset += newM3u.totalDuration() * 1000;
          } else {
            m3u.items.PlaylistItem[0].set("discontinuity", true);
            m3u.items.PlaylistItem[0].set(
              "daterange",
              `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${m3u.totalDuration()}",X-TITLE="${
                variants[bw][i].item.title
              }",X-ASSET-ID="${variants[bw][i].item.id}"`
            );
            newM3u.items.PlaylistItem = newM3u.items.PlaylistItem.concat(m3u.items.PlaylistItem);
            offset += m3u.totalDuration() * 1000;
          }
        }
        const targetDuration = newM3u.items.PlaylistItem.map((item) => item.get("duration")).reduce((prev, current) =>
          prev > current ? prev : current
        );
        newM3u.set("targetDuration", Math.ceil(targetDuration));
        this.variants[bw] = newM3u;
      }
    });
    // For audio
    const groups = Object.keys(audioVariants);
    groups.forEach((group) => {
      const groupLangs = Object.keys(audioVariants[group]);
      groupLangs.forEach((groupLang) => {
        if (audioVariants[group][groupLang].length !== m3ulist.length) {
          delete audioVariants[group][groupLang];
        } else {
          let newM3u;
          let offset = 0;

          for (let i = 0; i < audioVariants[group][groupLang].length; i++) {
            const m3u = audioVariants[group][groupLang][i].variant;
            const startDate = new Date(1 + offset).toISOString();
            if (i === 0) {
              newM3u = m3u;
              audioVariants[group][groupLang][i].stream.set("uri", "manifest_" + group + "-" + groupLang + ".m3u8");
              this.audioStreams.push(audioVariants[group][groupLang][i].stream);
              newM3u.items.PlaylistItem[0].set("date", new Date(1));
              newM3u.items.PlaylistItem[0].set(
                "daterange",
                `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${newM3u.totalDuration()}",X-TITLE="${
                  audioVariants[group][groupLang][i].item.title
                }",X-ASSET-ID="${audioVariants[group][groupLang][i].item.id}"`
              );
              offset += newM3u.totalDuration() * 1000;
            } else {
              m3u.items.PlaylistItem[0].set("discontinuity", true);
              m3u.items.PlaylistItem[0].set(
                "daterange",
                `ID=${i + 1},CLASS="se.eyevinn.vodtovod",START-DATE="${startDate}",DURATION="${m3u.totalDuration()}",X-TITLE="${
                  audioVariants[group][groupLang][i].item.title
                }",X-ASSET-ID="${audioVariants[group][groupLang][i].item.id}"`
              );
              newM3u.items.PlaylistItem = newM3u.items.PlaylistItem.concat(m3u.items.PlaylistItem);
              offset += m3u.totalDuration() * 1000;
            }
          }
          const targetDuration = newM3u.items.PlaylistItem.map((item) => item.get("duration")).reduce((prev, current) =>
            prev > current ? prev : current
          );
          newM3u.set("targetDuration", Math.ceil(targetDuration));

          if (!this.audioVariants[group]) {
            this.audioVariants[group] = {};
          }
          this.audioVariants[group][groupLang] = newM3u;
        }
      });
    });
  }
}
