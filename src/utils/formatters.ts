export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function extractFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

export function getFileExtension(filePath: string): string {
  const name = extractFilename(filePath);
  const lastDot = name.lastIndexOf('.');
  return lastDot !== -1 ? name.slice(lastDot + 1).toLowerCase() : '';
}

export function replaceFileExtension(filePath: string, newExt: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const sanitizedExt = newExt.startsWith('.') ? newExt : `.${newExt}`;
  if (lastDot === -1) return `${filePath}${sanitizedExt}`;
  return `${filePath.slice(0, lastDot)}${sanitizedExt}`;
}

export function suggestOutputPath(videoPath: string, targetExt?: string): string {
  const lastDot = videoPath.lastIndexOf('.');
  const ext = targetExt || (lastDot !== -1 ? videoPath.slice(lastDot + 1) : 'mkv');
  const sanitizedExt = ext.startsWith('.') ? ext : `.${ext}`;

  if (lastDot === -1) {
    return `${videoPath}_subbed${sanitizedExt}`;
  }
  return `${videoPath.slice(0, lastDot)}_subbed${sanitizedExt}`;
}
