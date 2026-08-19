// Pulls the 11-char video ID out of any common YouTube URL shape (watch,
// youtu.be short link, shorts, or an existing embed URL). Null if the text
// isn't a recognizable YouTube link.
export function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

// Autoplay requires mute in every modern browser; loop requires repeating the
// id in the playlist param (a YouTube embed quirk, not a typo).
export function youtubeEmbedSrc(id: string): string {
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0&modestbranding=1`;
}
