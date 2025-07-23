export const formatSeconds = (seconds) => {
  if (seconds === undefined) return '';
  const date = new Date(1_970, 0, 1);
  date.setSeconds(seconds);
  if (seconds >= 3_600) {
    return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/u, '$1');
  }

  return date.toTimeString().replace(/.*(\d{2}:\d{2}).*/u, '$1');
};

export const formatBytesAsUnit = (bytes, unit, decimals = 2) => {
  if (unit === 'B') return bytes + ' ' + unit;

  const k = 1_024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = { EB: 6, GB: 3, KB: 1, MB: 2, PB: 5, TB: 4, YB: 8, ZB: 7 };

  return Number.parseFloat((bytes / k ** sizes[unit]).toFixed(dm));
};

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 B';

  const k = 1_024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const index = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    Number.parseFloat((bytes / k ** index).toFixed(dm)) + ' ' + sizes[index]
  );
};

export const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

export const getFileName = (fullPath) => {
  return fullPath.split('\\').pop().split('/').pop();
};

export const getDirectoryName = (fullPath) => {
  let path = fullPath;

  if (path.lastIndexOf('\\') > 0) {
    path = path.slice(0, Math.max(0, path.lastIndexOf('\\')));
  }

  if (path.lastIndexOf('/') > 0) {
    path = path.slice(0, Math.max(0, path.lastIndexOf('/')));
  }

  return path;
};

export const formatAttributes = ({
  bitRate,
  isVariableBitRate,
  bitDepth,
  sampleRate,
}) => {
  const isLossless = Boolean(sampleRate) && Boolean(bitDepth);

  if (isLossless) {
    return `${bitDepth}/${sampleRate / 1_000}kHz`;
  }

  if (isVariableBitRate) {
    return `${bitRate} Kbps, VBR`;
  }

  return bitRate ? `${bitRate} Kbps` : '';
};

export const sleep = (milliseconds) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

/* https://www.npmjs.com/package/js-file-download
 *
 * Copyright 2017 Kenneth Jiang
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions
 * of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 * TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE
 */
export const downloadFile = (data, filename, mime) => {
  const blob = new Blob([data], { type: mime || 'application/octet-stream' });

  if (typeof window.navigator.msSaveBlob === 'undefined') {
    const blobURL = window.URL.createObjectURL(blob);
    const temporaryLink = document.createElement('a');
    temporaryLink.style.display = 'none';
    temporaryLink.href = blobURL;
    temporaryLink.setAttribute('download', filename);

    if (typeof temporaryLink.download === 'undefined') {
      temporaryLink.setAttribute('target', '_blank');
    }

    document.body.append(temporaryLink);
    temporaryLink.click();
    temporaryLink.remove();
    window.URL.revokeObjectURL(blobURL);
    return;
  }

  // IE workaround
  window.navigator.msSaveBlob(blob, filename);
};
