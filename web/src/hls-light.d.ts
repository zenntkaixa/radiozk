// hls.js ships no declarations for its "light" build. It has the same API as the full build minus subtitles,
// alternate audio tracks and DRM, none of which a live audio stream needs.
declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export default Hls;
}
